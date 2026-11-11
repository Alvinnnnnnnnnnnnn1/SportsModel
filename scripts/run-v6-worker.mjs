/** Local headless worker. No legacy repository, Supabase credentials, bookmaker or LLM tools. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { z } from 'zod';
const i=process.argv.indexOf('--config'),filename=process.argv[i+1];
if(i<0||!filename||!process.argv.includes('--once'))throw new Error('Usage: node scripts/run-v6-worker.mjs --config .local/v6/worker.json --once');
const configSchema=z.object({version:z.literal(1),ownerId:z.string().min(1).max(200),mode:z.enum(['disabled','dry_run','armed']),killSwitch:z.boolean(),inbox:z.string().nullable(),activation:z.object({ownerId:z.string(),policyHash:z.string().regex(/^[a-f0-9]{64}$/),activatedAt:z.string().datetime({offset:true})}).nullable()}).strict();
const config=configSchema.parse(JSON.parse(await fs.readFile(filename,'utf8')));
const root=path.resolve('.local/v6');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
  const {localV6Repository}=await loader.ssrLoadModule('/src/lib/v6/repository.server.ts');
  const {runV6Worker}=await loader.ssrLoadModule('/src/lib/v6/worker.ts');
  const {observationSchema}=await loader.ssrLoadModule('/src/lib/v6/types.ts');
  const {paperAccounting}=await loader.ssrLoadModule('/src/lib/v6/engine.ts');
  const repo=localV6Repository(path.join(root,'state'),config.ownerId,'v6-prospective');
  const provider={collectionPermitted:false,collect:async()=>[],grade:async()=>null};
  if(config.inbox){
    const inbox=path.resolve(config.inbox);
    if(!inbox.startsWith(root+path.sep))throw new Error('V6 input must stay in ignored .local/v6.');
    const bundle=z.object({format:z.literal('edgelab.v6-source-inbox'),version:z.literal(1),observations:z.array(observationSchema)}).strict().parse(JSON.parse(await fs.readFile(inbox,'utf8')));
    // Named sources and explicit rights are validated again per observation.
    provider.collectionPermitted=bundle.observations.every(o=>o.sourceClass==='prospective'&&o.provider==='the-odds-api.com'&&o.permissionReference==='https://the-odds-api.com/terms-and-conditions.html');
    provider.collect=async()=>bundle.observations;
  }
  // No activated/validated statistical model or live result adapter exists yet.
  // A missing model deliberately screens out positions rather than fabricating one.
  const result=await runV6Worker(repo,provider,null,{runId:crypto.randomUUID(),now:new Date().toISOString(),mode:config.mode,killSwitch:config.killSwitch,activation:config.activation});
  console.log(JSON.stringify({status:result.status,mode:config.mode,metrics:paperAccounting(result.state),model:'not_activated',liveGrading:'not_connected',v5Access:false},null,2));
}finally{await loader.close();}
