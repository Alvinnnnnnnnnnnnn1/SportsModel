/** Offline source joins, canonical team bridges and unchanged chronological model. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
const root=path.resolve('.local/v6');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {ingestTeamGames,loadTeamDataset,latestTeamGames}=await loader.ssrLoadModule('/src/lib/v6/team-dataset.server.ts');
 const {teamRegistry,canonicalTeamRows}=await loader.ssrLoadModule('/src/lib/v6/team-identity.ts');
 const {regularSeasonCoverage}=await loader.ssrLoadModule('/src/lib/v6/team-coverage.ts');
 const {evaluateTeamModel}=await loader.ssrLoadModule('/src/lib/v6/team-model.ts');
 const {atomicPrivateJson,digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const receipts=(await Promise.all(['evidence','evidence-receipts'].map(async directory=>Promise.all((await fs.readdir(path.join(root,directory))).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await fs.readFile(path.join(root,directory,f),'utf8'))))))).flat();
 const sources=[...new Map(receipts.sort((a,b)=>a.retrievedAt.localeCompare(b.retrievedAt)).map(e=>[e.id,e])).values()];
 const games=sources.filter(e=>e.provider==='api-nba'&&new URL(e.sourceUrl).pathname==='/games'&&JSON.parse(e.raw).response?.length||e.provider==='balldontlie'&&new URL(e.sourceUrl).pathname==='/v1/games');
 const ingestions=[];for(const e of games)ingestions.push(await ingestTeamGames(root,e));
 const all=latestTeamGames(await loadTeamDataset(root));
 const catalogue=sources.filter(e=>e.provider==='balldontlie'&&new URL(e.sourceUrl).pathname==='/v1/teams').at(-1);if(!catalogue)throw new Error('Retained real team catalogue required');
 const registry=await teamRegistry(catalogue,all),canonical=canonicalTeamRows(all,registry),evaluation=evaluateTeamModel(canonical.matched),at=new Date().toISOString();
 const coverage=await Promise.all([2025,2026].map(async season=>({season,...await regularSeasonCoverage(sources,season,at)})));
 const counts={};for(const g of all){const k=g.provider+':'+g.season;counts[k]??={rows:0,final:0,compatibleFinal:0};counts[k].rows++;counts[k].final+=Number(g.final);counts[k].compatibleFinal+=Number(g.final&&g.compatibleTraining);}
 await atomicPrivateJson(path.join(root,'team-registry',registry.hash+'.json'),registry);
 const report={format:'edgelab.v6-team-model-analysis',at,counts,sourceGames:all.length,canonicalGames:canonical.matched.length,blockedCanonical:canonical.blocked.length,registry,coverage,evaluation,ingestions,registrations:0,hostedWrites:0};
 const file=path.join(root,'team-reports',digest(JSON.stringify(report))+'.json');await atomicPrivateJson(file,report);
 console.log(JSON.stringify({report:file,counts,canonicalTeams:new Set(Object.values(registry.mappings).map(m=>m.canonicalId)).size,blockedCanonical:canonical.blocked.length,coverage,
  heldOutGames:evaluation.heldOutGames,challenger:evaluation.challenger&&{brier:evaluation.challenger.brier,logLoss:evaluation.challenger.logLoss},eloOnly:evaluation.eloOnly&&{brier:evaluation.eloOnly.brier,logLoss:evaluation.eloOnly.logLoss},winRate:evaluation.historicalWinRate&&{brier:evaluation.historicalWinRate.brier,logLoss:evaluation.historicalWinRate.logLoss},registrations:0}));
}finally{await loader.close();}
