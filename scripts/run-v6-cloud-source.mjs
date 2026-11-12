/** Disabled by default. No source keys are read before the cloud activation gate. */
import {createServer} from 'vite';import {execFileSync} from 'node:child_process';
if(process.env.V6_CLOUD_SOURCE_ENABLED!=='true'){
 console.log(JSON.stringify({status:'cloud_disabled',providerRequests:0,paperRegistrations:0}));
}else{
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='Alvinnnnnnnnnnnnn1/SportsModel'||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==process.env.V6_CLOUD_REVIEWED_SHA||!/^[a-f0-9]{40}$/.test(process.env.V6_CLOUD_REVIEWED_SHA??''))throw new Error('Pinned reviewed Actions revision required');
 const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
 try{
  const {cloudSourceClient}=await loader.ssrLoadModule('/src/lib/v6/cloud/client.server.ts');
  const {runCloudSourceTick}=await loader.ssrLoadModule('/src/lib/v6/cloud/runner.server.ts');
  const rpc=cloudSourceClient({url:process.env.NEXT_PUBLIC_SUPABASE_URL,publishableKey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,pilotId:process.env.V6_CLOUD_PILOT_ID,capability:process.env.V6_SOURCE_CAPABILITY});
  const result=await runCloudSourceTick(rpc,{enabled:true,reviewedCodeRevision:process.env.V6_CLOUD_REVIEWED_SHA,keys:{oddsKey:process.env.THE_ODDS_API_KEY,bdlKey:process.env.BALLDONTLIE_API_KEY}});
  console.log(JSON.stringify(result));
 }catch{console.error('Source-only cloud tick failed safely. Inspect private audit and scheduler state; no credentials or source bodies logged.');process.exitCode=1;}
 finally{await loader.close();}
}
