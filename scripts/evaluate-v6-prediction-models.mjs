/** Offline only: reads a frozen existing NBA history snapshot. No env, API or account access. */
import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';
const root=path.resolve('.local/v6'),option=n=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1];};
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {PREDICTION_PROTOCOL,evaluatePredictionDevelopment}=await loader.ssrLoadModule('/src/lib/v6/prediction/evaluation.ts');
 const {digest,atomicPrivateJson}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const protocolHash=digest(JSON.stringify(PREDICTION_PROTOCOL)),protocolFile=path.join(root,'model-development/protocols',protocolHash+'.json');
 if(process.argv.includes('--prepare')){try{await fs.access(protocolFile);}catch{await atomicPrivateJson(protocolFile,PREDICTION_PROTOCOL);}console.log(JSON.stringify({status:'protocol_frozen_before_evaluation',protocolHash,protocolFile}));}
 else{
  if(option('--protocol-hash')!==protocolHash||JSON.stringify(JSON.parse(await fs.readFile(protocolFile,'utf8')))!==JSON.stringify(PREDICTION_PROTOCOL))throw new Error('Prepare and name the exact frozen protocol before evaluation');
  const snapshot=path.join(root,'team-games/snapshots/5459a26d13015afa7fc6793b6d970493042bec197c78e305d2d2d8ea6d92e808.json'),rows=JSON.parse(await fs.readFile(snapshot,'utf8'));if(digest(JSON.stringify(rows))!=='5459a26d13015afa7fc6793b6d970493042bec197c78e305d2d2d8ea6d92e808')throw new Error('Frozen dataset changed');
  const report=await evaluatePredictionDevelopment(rows),hash=digest(JSON.stringify(report)),file=path.join(root,'model-development/reports',hash+'.json'),artifactFile=path.join(root,'model-development/artifacts',report.artifactHash+'.json');
  await atomicPrivateJson(file,report);await atomicPrivateJson(artifactFile,report.artifact);
  console.log(JSON.stringify({file,reportHash:hash,artifactFile,artifactHash:report.artifactHash,periods:report.periods,selected:report.selection.selectedMargin,lambda:report.selection.selectedLambda,finalTest:report.finalTest,monitoring:report.monitoring,promoted:false,sourceRequests:0},null,2));
 }
}finally{await loader.close();}
