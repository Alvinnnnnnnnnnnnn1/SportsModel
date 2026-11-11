/** Offline real-source analysis. No network, policy activation, positions or Supabase. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
const root=path.resolve('.local/v6');
const option=name=>{const i=process.argv.indexOf(name);if(i<0)throw new Error('Pass '+name);return process.argv[i+1];};
const oddsDir=await fs.realpath(option('--odds-directory')),historyDir=await fs.realpath(option('--history-directory'));
if(![oddsDir,historyDir].every(p=>p.startsWith(root+path.sep)))throw new Error('Use retained private V6 evidence only');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {nbaPlayerLogs}=await loader.ssrLoadModule('/src/lib/v6/nba-source.ts');
 const {evaluateNbaPoints}=await loader.ssrLoadModule('/src/lib/v6/nba-points.ts');
 const {appendIdentityRevision}=await loader.ssrLoadModule('/src/lib/v6/identity-registry.server.ts');
 const {screenNbaShadow}=await loader.ssrLoadModule('/src/lib/v6/shadow.ts');
 const {atomicPrivateJson,digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const {localV6Repository}=await loader.ssrLoadModule('/src/lib/v6/repository.server.ts');
 const {runV6Worker}=await loader.ssrLoadModule('/src/lib/v6/worker.ts');
 const sources=async dir=>Promise.all((await fs.readdir(dir)).filter(f=>/^source-\d+\.json$/.test(f)).map(async f=>JSON.parse(await fs.readFile(path.join(dir,f),'utf8'))));
 const historic=await sources(historyDir),live=await sources(oddsDir);
 const games=historic.find(e=>new URL(e.sourceUrl).pathname==='/games'),stats=historic.find(e=>new URL(e.sourceUrl).pathname==='/players/statistics');
 const odds=live.find(e=>e.provider==='the-odds-api.com'&&new URL(e.sourceUrl).pathname.endsWith('/odds'));
 if(!games||!stats||!odds)throw new Error('Missing retained games, player logs or exact odds');
 const normalized=await nbaPlayerLogs(games,stats),evaluation=await evaluateNbaPoints(normalized.logs);
 const payload=JSON.parse(odds.raw),at=new Date().toISOString(),mappings=[];
 const profile=historic.find(e=>new URL(e.sourceUrl).pathname==='/players');
 for(const b of payload.bookmakers)if(b.key==='sportsbet')for(const market of b.markets)if(market.key==='player_points')for(const o of market.outcomes){
   const players=profile?JSON.parse(profile.raw).response.filter(p=>`${p.firstname} ${p.lastname}`===o.description):[];
   const player=players.length===1?players[0]:null;
   const mappingKey=JSON.stringify([payload.id,o.description,o.name,o.point]);
   const proposal={version:1,id:crypto.randomUUID(),mappingKey,revision:1,previousHash:null,recordedAt:at,league:'NBA',season:null,eventStartsAt:payload.commence_time,
     internalFixtureId:`v6:odds:${payload.id}`,oddsEventId:payload.id,sportsbetEventId:b.sid??null,statsGameId:null,
     internalPlayerId:null,oddsPlayerId:o.participant_id??null,statsPlayerId:player?String(player.id):null,playerLabel:o.description,
     market:'player_points',side:o.name,line:o.point,period:'full_game',overtime:'included',termsHash:null,
     sourceHashes:[odds.hash,...(player&&profile?[profile.hash]:[])],authority:null,status:'blocked',reasons:[]};
   // Reanalysis cannot create a second mapping history; new evidence requires
   // an explicit appended revision, never overwriting an existing source map.
   const filename=path.join(root,'identity-registry',digest(mappingKey)+'.json');
   try{const old=JSON.parse(await fs.readFile(filename,'utf8'));mappings.push(old.at(-1).record);}
   catch(error){if(error.code!=='ENOENT')throw error;const saved=await appendIdentityRevision(root,proposal,[odds,...(player&&profile?[profile]:[])]);mappings.push(saved.record);}
 }
 const shadow=await screenNbaShadow(odds,normalized.logs,mappings,at);
 const workerRepository=localV6Repository(path.join(root,'shadow-worker'),'local-source-audit-not-a-supabase-account');
 const worker=await runV6Worker(workerRepository,{collectionPermitted:true,collect:async()=>[],grade:async()=>null,
   screeningExclusions:async()=>shadow.candidates.map(c=>({sourceHash:c.rawHash,sourceIdentity:c.key,reasons:c.reasons}))},null,
   {runId:'nba-source-shadow:'+odds.hash,now:at,mode:'dry_run',killSwitch:false,activation:null});
 const report={format:'edgelab.v6-nba-pilot-analysis',version:1,at,scope:'private_local_evidence_only',sourceHashes:[games.hash,stats.hash,odds.hash],
   historicalLogs:normalized.logs.length,unmatchedGames:normalized.unmatchedGameIds,evaluation,verifiedCrossProviderMappings:mappings.filter(m=>m.status==='verified').length,
   shadow,worker:{status:worker.status,journalledRuns:worker.state.runs.length,positions:worker.state.positions.length,grades:worker.state.grades.length,ownerContext:'local audit only, not authenticated Supabase'},hostedWrites:0,registrations:0,settlements:0};
 const out=path.join(root,'shadow-reports',digest(JSON.stringify(report))+'.json');await atomicPrivateJson(out,report);
 console.log(JSON.stringify({report:out,logs:report.historicalLogs,unmatched:report.unmatchedGames.length,backtest:evaluation.model,benchmark:evaluation.benchmark,heldOutGames:evaluation.uniquePlayerGames,screened:shadow.screened,verifiedMappings:report.verifiedCrossProviderMappings,registrations:0,settlements:0}));
}finally{await loader.close();}
