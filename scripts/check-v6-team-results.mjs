/** Explicit one-shot result follow-up; no scheduling or paper/financial registration. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
const ix=process.argv.indexOf('--shadow-id'),id=process.argv[ix+1];
if(ix<0||!/^[a-f0-9-]{36}$/i.test(id??''))throw new Error('Pass --shadow-id UUID');
if(!process.argv.includes('--confirm-free-read-only'))throw new Error('Explicit --confirm-free-read-only required');
process.loadEnvFile('.env.local');const root=path.resolve('.local/v6');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {loadTeamShadow}=await loader.ssrLoadModule('/src/lib/v6/team-shadow.server.ts');
 const {freeSources}=await loader.ssrLoadModule('/src/lib/v6/free-sources.server.ts');
 const {teamSources}=await loader.ssrLoadModule('/src/lib/v6/team-sources.server.ts');
 const {verifyObservedTeamScore}=await loader.ssrLoadModule('/src/lib/v6/team-pilot.ts');
 const {atomicPrivateJson,digest,exclusive}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const frozen=await loadTeamShadow(root,id),byEvent=new Map();
 for(const c of frozen.record.screen.candidates)if(c.proof)byEvent.set(c.eventId,c.proof);
 const due=[...byEvent.values()].filter(p=>Date.parse(p.earliestStartsAt)+3*3600000<Date.now());
 if(!due.length){console.log(JSON.stringify({status:'not_due',networkRequests:0,earliestStart:[...byEvent.values()].map(p=>p.earliestStartsAt).sort()[0],settlements:0}));}
 else if(due.every(p=>Date.now()-Date.parse(p.earliestStartsAt)>3*86400000)){console.log(JSON.stringify({status:'score_retention_window_elapsed',networkRequests:0,settlements:0}));}
 else{
  const api=freeSources({root,oddsKey:process.env.THE_ODDS_API_KEY,oddsPilot:'team-moneyline-v1'}),secondary=teamSources({root,bdlKey:process.env.BALLDONTLIE_API_KEY});
  await api.read('the-odds-api.com','/v4/sports');await new Promise(r=>setTimeout(r,1100));
  const scores=await api.read('the-odds-api.com','/v4/sports/basketball_nba/scores',{daysFrom:'3',eventIds:due.map(p=>p.eventId).join(','),dateFormat:'iso'},2),results=[];
  for(const proof of due){
   if(!proof.statsGameId){results.push({eventId:proof.eventId,status:'unresolved',reason:'frozen_statistics_fixture_missing'});continue;}
   try{
    const box=await secondary.read('balldontlie','/v1/games/'+proof.statsGameId);
    // Earlier shadow versions retain exact source labels and canonical IDs.
    // Derive missing secondary labels solely from their frozen registry; no remap.
    const label=teamId=>Object.values(frozen.record.registry.mappings).find(t=>t.canonicalId===teamId)?.name;
    const supported={...proof,statsHomeName:proof.statsHomeName??label(proof.homeId),statsAwayName:proof.statsAwayName??label(proof.awayId)};
    const checked={eventId:proof.eventId,identityProof:supported,...await verifyObservedTeamScore(supported,scores,box,new Date().toISOString())};results.push(checked);
    console.log(JSON.stringify({eventId:proof.eventId,status:checked.status,reason:checked.reason,financialSettlement:false}));
   }catch(e){results.push({eventId:proof.eventId,status:'unresolved',reason:e.message});}
   if(due.length>1)await new Promise(r=>setTimeout(r,12600));
  }
  const at=new Date().toISOString(),payload={shadowHash:frozen.hash,at,results,positions:0,settlements:0,financialWrites:0};
  const file=path.join(root,'team-shadow-results',id+'.json');
  await exclusive(file+'.lock',async()=>{let history=[];try{history=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
   for(let i=0;i<history.length;i++){const {hash,...data}=history[i];if(digest(JSON.stringify(data))!==hash||data.previousHash!==(history[i-1]?.hash??null))throw new Error('Result journal integrity changed');}
   const factHash=digest(JSON.stringify(results.map(r=>({eventId:r.eventId,status:r.status,reason:r.reason,winner:r.result?.winnerId,scores:r.result&&[r.result.homeScore,r.result.awayScore],sourceHashes:r.result?.sourceHashes}))));
   if(history.at(-1)?.factHash!==factHash){const record={revision:history.length+1,previousHash:history.at(-1)?.hash??null,factHash,payload};await atomicPrivateJson(file,[...history,{...record,hash:digest(JSON.stringify(record))}]);}
  });
  console.log(JSON.stringify({status:'observation_results_checked',report:file,verified:results.filter(r=>r.status==='verified').length,unresolved:results.filter(r=>r.status!=='verified').length,settlements:0,financialWrites:0}));
 }
}finally{await loader.close();}
