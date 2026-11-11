/** One-shot real team shadow. No production activation, scheduling or Supabase. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
const live=process.argv.includes('--confirm-free-read-only'),index=process.argv.indexOf('--odds-receipt');
if(!live&&index<0)throw new Error('Use --confirm-free-read-only for a bounded live audit, or --odds-receipt UUID for offline replay');
if(live)process.loadEnvFile('.env.local');const root=path.resolve('.local/v6');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {freeSources}=await loader.ssrLoadModule('/src/lib/v6/free-sources.server.ts');
 const {loadTeamDataset,latestTeamGames}=await loader.ssrLoadModule('/src/lib/v6/team-dataset.server.ts');
 const {teamRegistry,canonicalTeamRows,resolveTeamLabel}=await loader.ssrLoadModule('/src/lib/v6/team-identity.ts');
 const {regularSeasonCoverage}=await loader.ssrLoadModule('/src/lib/v6/team-coverage.ts');
 const {teamGames}=await loader.ssrLoadModule('/src/lib/v6/team-games.ts');
 const {TEAM_FIXTURE_MATCH}=await loader.ssrLoadModule('/src/lib/v6/team-pilot.ts');
 const {freezeTeamShadow}=await loader.ssrLoadModule('/src/lib/v6/team-shadow.server.ts');
 const {localV6Repository}=await loader.ssrLoadModule('/src/lib/v6/repository.server.ts');
 const {runV6Worker}=await loader.ssrLoadModule('/src/lib/v6/worker.ts');
 const {TEAM_MODEL}=await loader.ssrLoadModule('/src/lib/v6/team-model.ts');
 const {atomicPrivateJson,digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const receipts=await Promise.all((await fs.readdir(path.join(root,'evidence-receipts'))).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',f),'utf8'))));
 const catalogue=receipts.filter(e=>e.provider==='balldontlie'&&new URL(e.sourceUrl).pathname==='/v1/teams').sort((a,b)=>a.retrievedAt.localeCompare(b.retrievedAt)).at(-1);
 if(!catalogue)throw new Error('Real retained NBA team catalogue is required');
 const raw=latestTeamGames(await loadTeamDataset(root)),registry=await teamRegistry(catalogue,raw),rows=canonicalTeamRows(raw,registry).matched;
 const at=new Date().toISOString(),coverage=await regularSeasonCoverage(receipts,2026,at);
 let source,scores=null;
 if(live){
  const api=freeSources({root,oddsKey:process.env.THE_ODDS_API_KEY,oddsPilot:'team-moneyline-v1'});
  await api.read('the-odds-api.com','/v4/sports');await new Promise(r=>setTimeout(r,1100));
  scores=await api.read('the-odds-api.com','/v4/sports/basketball_nba/scores',{daysFrom:'3',dateFormat:'iso'},2);await new Promise(r=>setTimeout(r,1100));
  source=await api.read('the-odds-api.com','/v4/sports/basketball_nba/odds',{bookmakers:'sportsbet',markets:'h2h',oddsFormat:'decimal',dateFormat:'iso',includeSids:'true'},1);
 }else{
  const id=process.argv[index+1];if(!/^[a-f0-9-]{36}$/i.test(id??''))throw new Error('Invalid source receipt');source=JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',id+'.json'),'utf8'));
  const si=process.argv.indexOf('--scores-receipt');if(si>=0){const id=process.argv[si+1];if(!/^[a-f0-9-]{36}$/i.test(id??''))throw new Error('Invalid score receipt');scores=JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',id+'.json'),'utf8'));}
 }
 const frozen=await freezeTeamShadow(root,source,rows,registry,coverage.complete?[2026]:[],new Date().toISOString());
 const candidates=frozen.record.screen.candidates,modelForecasts=new Map(candidates.filter(c=>c.forecast&&c.observation).map(c=>[c.observation.id,c.forecast]));
 const repo=localV6Repository(path.join(root,'team-shadow-worker'),'local-team-shadow-not-a-supabase-account');
 const worker=await runV6Worker(repo,{collectionPermitted:true,collect:async()=>candidates.flatMap(c=>c.observation?[c.observation]:[]),
  screeningExclusions:async()=>candidates.filter(c=>!c.observation).map(c=>({sourceHash:c.rawHash,sourceIdentity:c.key,reasons:c.pass2.reasons})),grade:async()=>null},
  {modelId:TEAM_MODEL.id,version:TEAM_MODEL.version,validationManifestHash:digest(JSON.stringify(TEAM_MODEL)),forecast:async o=>modelForecasts.get(o.id)??null},
  {runId:'team-shadow:'+source.id,now:new Date().toISOString(),mode:'dry_run',killSwitch:false,activation:null});
 let finalAudit=null;
 if(scores){const finals=(await teamGames(scores)).filter(g=>g.final),matches=finals.map(g=>{const candidates=rows.filter(r=>r.provider==='balldontlie'&&r.final&&r.startsAt&&g.startsAt&&r.home.name===resolveTeamLabel(registry,g.home.name)?.name&&r.away.name===resolveTeamLabel(registry,g.away.name)?.name&&Math.abs(Date.parse(r.startsAt)-Date.parse(g.startsAt))<=TEAM_FIXTURE_MATCH.maximumDifferenceSeconds*1000);
   return {eventId:g.sourceGameId,statsGameId:candidates.length===1?candidates[0].sourceGameId:null,oddsStartsAt:g.startsAt,statsStartsAt:candidates.length===1?candidates[0].startsAt:null,homeScore:g.homeScore,awayScore:g.awayScore,verified:candidates.length===1&&candidates[0].homeScore===g.homeScore&&candidates[0].awayScore===g.awayScore};});
  finalAudit={scoresReceiptId:scores.id,scoresHash:scores.hash,finals:finals.length,independentScoreMatches:matches.filter(m=>m.verified).length,fixtureMatchPolicy:TEAM_FIXTURE_MATCH,matches,prospectiveSettlements:0};}
 const summary={format:'edgelab.v6-team-pilot-run',at:new Date().toISOString(),shadowId:frozen.record.id,shadowHash:frozen.hash,freezeStatus:frozen.status,coverage,canonicalTeams:new Set(Object.values(registry.mappings).map(m=>m.canonicalId)).size,
  screened:candidates.length,preEventIndependentForecasts:candidates.filter(c=>c.forecast).length,exactFixtureSelections:candidates.filter(c=>c.proof?.statsGameId).length,qualified:0,positions:worker.state.positions.length,grades:worker.state.grades.length,workerStatus:worker.status,finalAudit,hostedWrites:0,financialWrites:0};
 const file=path.join(root,'team-reports',digest(JSON.stringify(summary))+'.json');await atomicPrivateJson(file,summary);console.log(JSON.stringify({...summary,report:file}));
}finally{await loader.close();}
