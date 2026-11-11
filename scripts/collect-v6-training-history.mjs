/** Bounded expansion within the API-NBA Free provider-declared 2022–2024 scope. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
if(!process.argv.includes('--confirm-free-read-only'))throw new Error('Explicit --confirm-free-read-only required');
process.loadEnvFile('.env.local');
const root=path.resolve('.local/v6'),directory=path.join(root,'nba-training-'+new Date().toISOString().replace(/[:.]/g,'-'));
await fs.mkdir(directory,{recursive:true,mode:0o700});
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
const report={format:'edgelab.v6-historical-expansion',at:new Date().toISOString(),requests:[],registrations:0,hostedWrites:0};
try{
 const {freeSources}=await loader.ssrLoadModule('/src/lib/v6/free-sources.server.ts');
 const {atomicPrivateJson}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const source=freeSources({root,nbaKey:process.env.API_SPORTS_KEY});let last=0;
 const read=async(endpoint,parameters={})=>{
  const delay=Math.max(0,last+16100-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));
  const row={endpoint,parameters};report.requests.push(row);
  try{const e=await source.read('api-nba',endpoint,parameters);await atomicPrivateJson(path.join(directory,`source-${report.requests.length}.json`),e);Object.assign(row,{hash:e.hash,retrievedAt:e.retrievedAt,count:JSON.parse(e.raw).response?.length??null,status:'received'});console.log(JSON.stringify(row));return true;}
  catch(e){Object.assign(row,{status:'blocked',error:e.message});console.log(JSON.stringify(row));return false;}
  finally{last=Date.now();await atomicPrivateJson(path.join(directory,'report.json'),report);}
 };
 // ID 428 is established by the prior retained player-profile receipt; not a name-derived ID.
 if(await read('/status'))for(const season of ['2022','2024']){
  if(!await read('/games',{league:'standard',season}))break;
  if(!await read('/players/statistics',{id:'428',season}))break;
 }
}finally{await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2),{mode:0o600});await loader.close();console.log(JSON.stringify({directory,registrations:0,hostedWrites:0}));}
