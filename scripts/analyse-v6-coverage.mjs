/** Offline incremental source-qualified dataset and unchanged challenger evaluation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
const root=path.resolve('.local/v6');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {ingestNbaTraining,loadTrainingDataset,trainingSummary}=await loader.ssrLoadModule('/src/lib/v6/training-dataset.server.ts');
 const {evaluateNbaPoints}=await loader.ssrLoadModule('/src/lib/v6/nba-points.ts');
 const {atomicPrivateJson,digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const receipts=(await Promise.all(['evidence','evidence-receipts'].map(async directory=>Promise.all((await fs.readdir(path.join(root,directory))).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await fs.readFile(path.join(root,directory,f),'utf8'))))))).flat();
 const sources=[...new Map(receipts.filter(e=>e.provider==='api-nba').sort((a,b)=>Date.parse(b.retrievedAt)-Date.parse(a.retrievedAt)).map(e=>[e.hash,e])).values()];
 const ingestions=[];
 for(const box of sources.filter(e=>new URL(e.sourceUrl).pathname==='/players/statistics')){
  const params=new URL(box.sourceUrl).searchParams,body=JSON.parse(box.raw);if(Object.keys(body.errors??{}).length||!body.response?.length)continue;
  const games=sources.find(e=>new URL(e.sourceUrl).pathname==='/games'&&new URL(e.sourceUrl).searchParams.get('season')===params.get('season')&&JSON.parse(e.raw).response?.length);
  if(games)ingestions.push(await ingestNbaTraining(root,games,box,new Date().toISOString()));
 }
 const store=await loadTrainingDataset(root),logs=Object.values(store.rows).map(rs=>rs.at(-1).log),evaluation=await evaluateNbaPoints(logs);
 const report={format:'edgelab.v6-training-audit',at:new Date().toISOString(),summary:trainingSummary(store),ingestions,evaluation,
  challengerPromoted:false,reason:'Experimental model requires genuinely current features and objective prospective validation',registrations:0,hostedWrites:0};
 const file=path.join(root,'training-reports',digest(JSON.stringify(report))+'.json');await atomicPrivateJson(file,report);
 console.log(JSON.stringify({report:file,summary:report.summary,model:evaluation.model,benchmark:evaluation.benchmark,heldOutPlayerGames:evaluation.uniquePlayerGames,thresholdScores:evaluation.thresholdObservations,registrations:0}));
}finally{await loader.close();}
