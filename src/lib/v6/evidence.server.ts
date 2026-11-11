import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const digest = (value:string) => createHash('sha256').update(value).digest('hex');
export async function atomicPrivateJson(file:string,value:unknown) {
  await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
  const temporary=file+'.'+crypto.randomUUID()+'.tmp';
  const handle=await fs.open(temporary,'wx',0o600);
  try { await handle.writeFile(JSON.stringify(value,null,2));await handle.sync(); }
  finally { await handle.close(); }
  try {await fs.rename(temporary,file);}finally{await fs.unlink(temporary).catch(()=>{});}
}
/** Single-host cross-process serialization; ambiguous/live locks fail closed. */
export async function exclusive<T>(file:string,work:()=>Promise<T>):Promise<T> {
  await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
  let handle:fs.FileHandle|undefined;
  for(let attempt=0;attempt<40;attempt++) {
    try {handle=await fs.open(file,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid}));break;}
    catch(error) {
      if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
      // Recover only an unmistakably dead PID; serialize recovery with its own mutex.
      let recovery:fs.FileHandle|undefined;
      try {
        recovery=await fs.open(file+'.recovery','wx',0o600);
        const lock=JSON.parse(await fs.readFile(file,'utf8')) as {pid:number};
        if(Number.isSafeInteger(lock.pid)&&lock.pid>0)try{process.kill(lock.pid,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')await fs.unlink(file);}
      }catch{/* Another process or ambiguous lock: wait, never bypass it. */}
      finally {if(recovery){await recovery.close();await fs.unlink(file+'.recovery');}}
      await new Promise(resolve=>setTimeout(resolve,25));
    }
  }
  if(!handle)throw new Error('V6 evidence writer busy; retry later');
  try{return await work();}finally{await handle.close();await fs.unlink(file);}
}
export interface RawEvidence {id:string;provider:'api-nba'|'api-basketball'|'the-odds-api.com'|'balldontlie'|'thesportsdb';sourceUrl:string;retrievedAt:string;sourceUpdatedAt:string|null;raw:string;hash:string;}
/** Content-addressed raw source is independent of model/position state. */
export async function retainEvidence(root:string,evidence:RawEvidence) {
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(evidence.id)||!/^[a-f0-9]{64}$/.test(evidence.hash))throw new Error('Invalid evidence identifier');
  if(digest(evidence.raw)!==evidence.hash)throw new Error('Evidence SHA mismatch');
  const url=new URL(evidence.sourceUrl);
  const expected={'api-nba':'https://v2.nba.api-sports.io','api-basketball':'https://v1.basketball.api-sports.io','the-odds-api.com':'https://api.the-odds-api.com',balldontlie:'https://api.balldontlie.io',thesportsdb:'https://www.thesportsdb.com'}[evidence.provider];
  if(url.origin!==expected||url.username||url.password||[...url.searchParams.keys()].some(k=>/key|token|secret|password/i.test(k)))throw new Error('Invalid/credential-bearing evidence URL');
  const filename=path.join(root,'evidence',evidence.hash+'.json');
  return exclusive(filename+'.lock',async()=>{
    let exists=false;
    try {const old=JSON.parse(await fs.readFile(filename,'utf8')) as RawEvidence;if(old.raw!==evidence.raw||old.hash!==evidence.hash)throw new Error('Immutable source hash collision');exists=true;}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(!exists)await atomicPrivateJson(filename,evidence);
    // Identical bytes can be observed twice at different real times. Keep the
    // original blob plus every fetch receipt rather than reusing a stale clock.
    const receipt=path.join(root,'evidence-receipts',evidence.id+'.json');await fs.mkdir(path.dirname(receipt),{recursive:true,mode:0o700});
    try{const out=await fs.open(receipt,'wx',0o600);try{await out.writeFile(JSON.stringify(evidence));await out.sync();}finally{await out.close();}}
    catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const old=JSON.parse(await fs.readFile(receipt,'utf8'));if(JSON.stringify(old)!==JSON.stringify(evidence))throw new Error('Immutable evidence receipt changed');}
    return evidence;
  });
}
