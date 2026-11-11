import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { emptyV6State, v6StateSchema, type V6State } from './types';
export interface V6Repository { read():Promise<V6State>; transact(change:(state:V6State)=>Promise<V6State>):Promise<V6State>; }

/** Isolated local V6 storage. No Supabase client, V5 data, token or financial capability. */
export function localV6Repository(root:string,ownerId:string,cohort:V6State['cohort']='v6-prospective'):V6Repository {
  const file=path.join(root,createHash('sha256').update(`${ownerId}:${cohort}`).digest('hex')+'.json'),lock=file+'.lock';
  const read=async()=>{
    try{const s=v6StateSchema.parse(JSON.parse(await fs.readFile(file,'utf8')));if(s.ownerId!==ownerId||s.cohort!==cohort)throw new Error('V6 owner/cohort mismatch');return s;}
    catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return emptyV6State(ownerId,cohort);throw e;}
  };
  const recover=async()=>{
    let recovery:fs.FileHandle;
    try{recovery=await fs.open(lock+'.recovery','wx',0o600);}catch{return;}
    try{
      const stale=JSON.parse(await fs.readFile(lock,'utf8')) as {pid:number};
      if(!Number.isSafeInteger(stale.pid)||stale.pid<=0)return;
      try{process.kill(stale.pid,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')await fs.unlink(lock);}
    }catch{/* Missing or ambiguous locks fail closed; never delete a live process lock. */}
    finally{await recovery.close();await fs.unlink(lock+'.recovery');}
  };
  return {read,async transact(change){
    await fs.mkdir(root,{recursive:true,mode:0o700});
    let handle:fs.FileHandle|undefined;
    for(let i=0;i<80;i++){
      try{handle=await fs.open(lock,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid}));break;}
      catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;if(i===0)await recover();await new Promise(resolve=>setTimeout(resolve,25));}
    }
    if(!handle)throw new Error('V6 worker is busy; retry on the next scheduled run.');
    let temp:string|undefined;
    try{
      const before=await read(),next=v6StateSchema.parse(await change(structuredClone(before)));
      if(next.ownerId!==ownerId||next.cohort!==cohort)throw new Error('V6 destination changed');
      if(JSON.stringify(before)===JSON.stringify(next))return before;
      if(next.revision!==before.revision+1)throw new Error('V6 revision must advance once per transaction');
      for(const key of ['positions','grades','runs'] as const)for(const old of before[key])if(!next[key].some(item=>item.id===old.id&&JSON.stringify(item)===JSON.stringify(old)))throw new Error('V6 original evidence and journal are append-only');
      temp=file+'.'+crypto.randomUUID()+'.tmp';
      const output=await fs.open(temp,'wx',0o600);try{await output.writeFile(JSON.stringify(next));await output.sync();}finally{await output.close();}
      await fs.rename(temp,file);temp=undefined;return structuredClone(next);
    }finally{if(temp)await fs.unlink(temp).catch(()=>{});await handle.close();await fs.unlink(lock);}
  }};
}
