/** Test-only child. No .env, private archive, hosted endpoint or production approval. */
import fs from 'node:fs/promises';import {createServer} from 'vite';
const [repo,fixturePath,relay,baseClock]=process.argv.slice(2),fixture=JSON.parse(await fs.readFile(fixturePath,'utf8'));
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(relay)||fixture.synthetic!==true)throw new Error('Isolated test relay required');
const nativeFetch=globalThis.fetch;
const request=async(action,p={})=>{const response=await nativeFetch(relay+'/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,p})});if(!response.ok)throw new Error('Synthetic relay rejected '+action);return response.json();};
const started=Date.now(),clock=()=>new Date(Date.parse(baseClock)+Date.now()-started).toISOString();
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(!['api.the-odds-api.com','api.balldontlie.io'].includes(url.hostname)||init?.method!=='GET')throw new Error('External network prohibited in synthetic worker');
 const response=await nativeFetch(relay+'/source',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:url.hostname,endpoint:url.pathname,parameters:Object.fromEntries([...url.searchParams].filter(([k])=>k!=='apiKey'))})});
 if(!response.ok)throw new Error('Synthetic source not supported');const result=await response.json();return Response.json(result.body,{status:200,headers:result.headers});
};
const loader=await createServer({root:repo,configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':repo+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {runCloudSourceTick}=await loader.ssrLoadModule(repo+'/src/lib/v6/cloud/runner.server.ts');
 const result=await runCloudSourceTick({call:request},{enabled:true,clock,reviewedCodeRevision:'b'.repeat(40),keys:{oddsKey:'SYNTHETIC-ODDS-SECRET',bdlKey:'SYNTHETIC-BDL-SECRET'},resolveControls:()=>fixture.verifiedSyntheticControls});
 console.log(JSON.stringify({pid:process.pid,result}));
}finally{await loader.close();globalThis.fetch=nativeFetch;}
