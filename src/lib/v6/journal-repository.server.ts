import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {digest,exclusive} from './evidence.server';
import {emptyV6State,v6StateSchema,type V6State} from './types';
import type {V6Repository} from './repository.server';

/** Local paper authority: immutable, hash-linked revisions, no mutable head and
 * no source/API/V5 capability. A restart reconstructs state from committed files.
 * This detects changed revisions, not privileged directory deletion/truncation. */
export function journalV6Repository(root:string,ownerId:string,cohort:V6State['cohort']='v6-prospective',clock=()=>new Date().toISOString()):V6Repository&{integrity():Promise<{revision:number;headHash:string|null;files:number}>;snapshot():Promise<{state:V6State;integrity:{revision:number;headHash:string|null;files:number;lastCommitAt:string|null}}>}{
 const load=async()=>{
  let names:string[];try{names=(await fs.readdir(root)).filter(n=>/^\d{12}\.json$/.test(n)).sort();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;names=[];}
  let state=emptyV6State(ownerId,cohort),headHash:string|null=null,lastAt=0;
  for(const [i,name]of names.entries()){
   if(name!==String(i+1).padStart(12,'0')+'.json')throw new Error('Paper journal revision gap');
   const file=await fs.open(path.join(root,name),constants.O_RDONLY|constants.O_NOFOLLOW);
   let record;try{if(!(await file.stat()).isFile())throw new Error('Invalid journal file');record=JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
   const {hash,...entry}=record;
   if(entry.format!=='edgelab.v6-local-paper-journal'||entry.version!==1||entry.previousHash!==headHash||digest(JSON.stringify(entry))!==hash||!Number.isFinite(Date.parse(entry.at))||Date.parse(entry.at)<lastAt)throw new Error('Paper journal integrity failure');
   const next=v6StateSchema.parse(entry.state);if(next.ownerId!==ownerId||next.cohort!==cohort||next.revision!==state.revision+1||digest(JSON.stringify(next))!==entry.stateHash)throw new Error('Paper journal owner/revision/hash mismatch');
   for(const key of ['positions','grades','runs'] as const)for(const old of state[key])if(!next[key].some(item=>item.id===old.id&&JSON.stringify(item)===JSON.stringify(old)))throw new Error('Paper journal evidence mutation');
   state=next;headHash=hash;lastAt=Date.parse(entry.at);
  }return {state,headHash,lastAt,files:names.length};
 };
 return {read:async()=>(await load()).state,snapshot:async()=>{const s=await load();return {state:s.state,integrity:{revision:s.state.revision,headHash:s.headHash,files:s.files,lastCommitAt:s.lastAt?new Date(s.lastAt).toISOString():null}};},integrity:async()=>{const s=await load();return {revision:s.state.revision,headHash:s.headHash,files:s.files};},transact:async change=>{
  await fs.mkdir(root,{recursive:true,mode:0o700});return exclusive(path.join(root,'writer.lock'),async()=>{
   const before=await load(),next=v6StateSchema.parse(await change(structuredClone(before.state)));
   if(JSON.stringify(next)===JSON.stringify(before.state))return before.state;
   if(next.ownerId!==ownerId||next.cohort!==cohort||next.revision!==before.state.revision+1)throw new Error('Paper journal destination/revision changed');
   for(const key of ['positions','grades','runs'] as const)for(const old of before.state[key])if(!next[key].some(item=>item.id===old.id&&JSON.stringify(item)===JSON.stringify(old)))throw new Error('Paper journal is append-only');
   const at=clock();if(!Number.isFinite(Date.parse(at))||Date.parse(at)<before.lastAt)throw new Error('Paper journal clock moved backwards');
   const entry={format:'edgelab.v6-local-paper-journal',version:1,at,previousHash:before.headHash,stateHash:digest(JSON.stringify(next)),state:next},record={...entry,hash:digest(JSON.stringify(entry))};
   const temporary=path.join(root,crypto.randomUUID()+'.tmp'),target=path.join(root,String(next.revision).padStart(12,'0')+'.json');
   const out=await fs.open(temporary,'wx',0o600);try{await out.writeFile(JSON.stringify(record));await out.sync();}finally{await out.close();}
   try{await fs.link(temporary,target);}finally{await fs.unlink(temporary);}const directory=await fs.open(root,'r');try{await directory.sync();}finally{await directory.close();}
   return structuredClone(next);
  });
 }};
}
