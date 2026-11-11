import { describe,it,expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { localV6Repository } from '@/lib/v6/repository.server';
import { runV6Worker,v6PolicyHash,type V6ReadProvider,type V6IndependentModel } from '@/lib/v6/worker';
import { paperAccounting,registerPaper } from '@/lib/v6/engine';
import { now,observation,forecast,grade } from './fixtures/v6';
const options=async()=>({runId:crypto.randomUUID(),now,clock:()=>now,mode:'armed' as const,killSwitch:false,activation:{ownerId:'LOCAL-ONLY',policyHash:await v6PolicyHash(),activatedAt:'2026-11-10T00:00:00Z'}});
const model:V6IndependentModel={modelId:'SYNTHETIC-LOCAL-model',version:'test-v1',validationManifestHash:'a'.repeat(64),forecast};
describe('V6 headless worker and isolated durable local repository',()=>{
  it('registers and grades under standing policy, survives a fresh repository instance, and replays without double profit',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'edgelab-v6-'));
    try{
      const repo=localV6Repository(root,'LOCAL-ONLY','v6-synthetic'),o=observation();let calls=0;
      const provider:V6ReadProvider={collectionPermitted:true,collect:async()=>{calls++;return[o];},grade:async()=>null};
      const opts=await options();let run=await runV6Worker(repo,provider,model,opts);expect(run.state.positions).toHaveLength(1);
      expect((await runV6Worker(repo,provider,model,opts)).status).toBe('already_processed');expect(calls).toBe(1);
      const reopened=localV6Repository(root,'LOCAL-ONLY','v6-synthetic');expect((await reopened.read()).positions).toEqual(run.state.positions);
      const g=await grade(run.state.positions[0]);provider.collect=async()=>[];provider.grade=async()=>g;
      run=await runV6Worker(reopened,provider,model,{...await options(),clock:()=>g.recordedAt});
      expect(paperAccounting(run.state).profitCents).toBe(4500);
      run=await runV6Worker(reopened,provider,model,{...await options(),clock:()=>g.recordedAt});expect(paperAccounting(run.state).profitCents).toBe(4500);expect(run.state.grades).toHaveLength(1);
      expect((await localV6Repository(root,'OTHER','v6-synthetic').read()).positions).toHaveLength(0);
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });
  it('serialises two different concurrent positions and deduplicates identical concurrent registrations without a volume gate',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'edgelab-v6-'));
    try{
      const a=localV6Repository(root,'LOCAL-ONLY','v6-synthetic'),b=localV6Repository(root,'LOCAL-ONLY','v6-synthetic');
      const apply=(repo:typeof a,index:number)=>repo.transact(async s=>{const o=observation(index);return (await registerPaper(s,o,await forecast(o),'pre_event_once',now)).state;});
      await Promise.all([apply(a,1),apply(b,2)]);expect((await a.read()).positions).toHaveLength(2);
      await Promise.all([apply(a,3),apply(b,3)]);expect((await a.read()).positions).toHaveLength(3);
      await expect(a.transact(async s=>({...s,revision:s.revision+1,positions:[]}))).rejects.toThrow(/append-only/);
      expect((await a.read()).positions).toHaveLength(3);
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });
  it('fails closed on permission, kill switch, policy mismatch, delayed clocks and late grade errors',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'edgelab-v6-'));
    try{
      const repo=localV6Repository(root,'LOCAL-ONLY','v6-synthetic');let calls=0;
      const provider:V6ReadProvider={collectionPermitted:false,collect:async()=>{calls++;return[observation()];},grade:async()=>null};
      expect((await runV6Worker(repo,provider,model,await options())).status).toBe('source_permission_blocked');expect(calls).toBe(0);
      provider.collectionPermitted=true;
      expect((await runV6Worker(repo,provider,model,{...await options(),killSwitch:true})).status).toBe('disabled');expect(calls).toBe(0);
      await expect(runV6Worker(repo,provider,model,{...await options(),activation:null})).rejects.toThrow(/standing policy/);
      let result=await runV6Worker(repo,provider,model,{...await options(),clock:()=> '2026-11-11T02:00:00Z'});expect(result.state.positions).toHaveLength(0);expect(result.state.runs[0].rejections[0].reasons).toContain('not_pre_event');
      result=await runV6Worker(repo,provider,model,await options());const before=structuredClone(result.state);
      provider.collect=async()=>[observation(99)];provider.grade=async p=>({...await grade(p),subjectId:'wrong'});
      await expect(runV6Worker(repo,provider,model,await options())).rejects.toThrow(/future-dated/);expect(await repo.read()).toEqual(before);
      await expect(runV6Worker(repo,provider,model,{...await options(),clock:()=> '2026-11-11T04:00:00Z'})).rejects.toThrow(/identity/);expect(await repo.read()).toEqual(before);
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });
  it('recovers a dead-process lock on restart without discarding positions or skipping replay checks',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'edgelab-v6-'));
    try{
      const repo=localV6Repository(root,'LOCAL-ONLY','v6-synthetic'),o=observation();
      await repo.transact(async state=>(await registerPaper(state,o,await forecast(o),'pre_event_once',now)).state);
      const filename=createHash('sha256').update('LOCAL-ONLY:v6-synthetic').digest('hex')+'.json';
      await fs.writeFile(path.join(root,filename+'.lock'),JSON.stringify({pid:2147483647}));
      const reopened=localV6Repository(root,'LOCAL-ONLY','v6-synthetic');
      await reopened.transact(async state=>(await registerPaper(state,o,await forecast(o),'pre_event_once',now)).state);
      expect((await reopened.read()).positions).toHaveLength(1);
      await expect(fs.stat(path.join(root,filename+'.lock'))).rejects.toThrow();
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });
  it('journals unmapped source exclusions without invented identities and honours a changed emergency-stop latch',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'edgelab-v6-'));
    try{
      const repo=localV6Repository(root,'LOCAL-ONLY','v6-synthetic');
      const provider:V6ReadProvider={collectionPermitted:true,collect:async()=>[],grade:async()=>null,screeningExclusions:async()=>[{sourceHash:'a'.repeat(64),sourceIdentity:'LOCAL-source-row',reasons:['canonical_player_unknown']}]};
      const run=await runV6Worker(repo,provider,null,{...await options(),mode:'dry_run'});expect(run.state.runs[0]).toMatchObject({screened:1,registered:0,observations:[]});expect(run.state.positions).toHaveLength(0);
      const before=await repo.read();provider.collect=async()=>[observation()];
      await expect(runV6Worker(repo,provider,model,{...await options(),canCommit:async()=>false})).rejects.toThrow(/stop/);expect(await repo.read()).toEqual(before);
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });
});
