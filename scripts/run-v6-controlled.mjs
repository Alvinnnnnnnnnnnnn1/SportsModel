/** Independent headless registered-worker tick. No Next HTTP server or V5 access. */
import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';
const ix=process.argv.indexOf('--config');if(ix<0||!process.argv[ix+1])throw new Error('Pass --config PATH and --once, --plan or --health');
const filename=path.resolve(process.argv[ix+1]),root=path.resolve('.local/v6'),loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {controlledConfigSchema}=await loader.ssrLoadModule('/src/lib/v6/controlled-activation.ts');
 const {planControlledJobs,runControlledTick}=await loader.ssrLoadModule('/src/lib/v6/controlled-scheduler.server.ts');
 const {prepareControlledTeamPorts}=await loader.ssrLoadModule('/src/lib/v6/controlled-team-runtime.server.ts');
 const {localV6Repository}=await loader.ssrLoadModule('/src/lib/v6/repository.server.ts');
 const {digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const clock=()=>new Date().toISOString();
 const privateJson=async value=>{if(!value)return null;const file=await fs.realpath(path.resolve(value));if(!file.startsWith(root+path.sep))throw new Error('Model/approval files must stay inside private .local/v6');return JSON.parse(await fs.readFile(file,'utf8'));};
 const readControl=async()=>{const config=controlledConfigSchema.parse(JSON.parse(await fs.readFile(filename,'utf8')));return {config,manifest:await privateJson(config.modelManifest),receipt:await privateJson(config.activationReceipt)};};
 const controls=await readControl(),operational=path.join(root,'controlled',digest(controls.config.ownerId));
 let fixtures=[];try{fixtures=JSON.parse(await fs.readFile(path.join(root,'controlled/discovered-fixtures.json'),'utf8')).fixtures;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(process.argv.includes('--health')){
  let health=null;try{health=JSON.parse(await fs.readFile(path.join(operational,'health.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  console.log(JSON.stringify({mode:controls.config.mode,killSwitch:controls.config.killSwitch,lastAttempt:health,missedRun:health?Date.now()-Date.parse(health.at)>26*3600000:null,externalAlertDelivery:false}));
 }else if(process.argv.includes('--plan'))console.log(JSON.stringify({at:clock(),jobs:planControlledJobs(fixtures,clock()),installed:false}));
 else if(process.argv.includes('--once')){
  if(controls.config.sourcesEnabled&&controls.config.mode!=='disabled'&&!controls.config.killSwitch)try{process.loadEnvFile('.env.local');}catch(e){if(e.code!=='ENOENT')throw e;}
  const repository=localV6Repository(path.join(operational,'state'),controls.config.ownerId);
  const result=await runControlledTick(operational,{repository,clock,readControl,prepare:async job=>prepareControlledTeamPorts(root,repository,job,await readControl(),{oddsKey:process.env.THE_ODDS_API_KEY,bdlKey:process.env.BALLDONTLIE_API_KEY},clock)},planControlledJobs(fixtures,clock()));
  console.log(JSON.stringify({...result,v5Access:false,hostedWrites:0}));
 }else throw new Error('Pass --once, --plan or --health');
}finally{await loader.close();}
