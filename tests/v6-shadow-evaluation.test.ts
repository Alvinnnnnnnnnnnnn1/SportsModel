/** Invented forecasts/results in isolated temp files. No hosted or source reads. */
import {describe,it,expect} from 'vitest';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {evaluateFrozenShadow,binaryMetrics,loadShadowResults} from '@/lib/v6/shadow-evaluation.server';
import {atomicPrivateJson,digest,retainEvidence,type RawEvidence} from '@/lib/v6/evidence.server';
const at='2026-11-11T12:00:00.000Z',start='2026-11-12T00:10:00.000Z',statsStart='2026-11-12T00:00:00.000Z',after='2026-11-12T04:00:00.000Z';
const evidence=(provider:'balldontlie'|'the-odds-api.com',endpoint:string,body:unknown):RawEvidence=>{const raw=JSON.stringify(body);return {id:crypto.randomUUID(),provider,sourceUrl:(provider==='balldontlie'?'https://api.balldontlie.io':'https://api.the-odds-api.com')+endpoint,retrievedAt:after,sourceUpdatedAt:null,raw,hash:digest(raw)};};
async function fixture(root:string,drift=false){
 const id=crypto.randomUUID(),inputs={sampleSize:500,sourceObservedAt:at},proof={eventId:'LOCAL',homeName:'LOCAL H',awayName:'LOCAL A',homeId:'H',awayId:'A',startsAt:start,statsStartsAt:statsStart,earliestStartsAt:statsStart,statsGameId:'7',registryHash:'a'.repeat(64),termsVersion:'LOCAL TEST'};
 const candidates=['H','A'].map((side,i)=>{const market={subjectId:side,eventId:'the-odds-api.com:LOCAL'};return {key:digest(side),eventId:'LOCAL',selection:'LOCAL '+side,originalOdds:i?2.2:1.8,sourceUpdatedAt:at,retrievedAt:at,proof,
  observation:{market,odds:i?2.2:1.8,sourceUpdatedAt:at},forecast:{market,probability:i?.4:.6,generatedAt:at,inputs,inputsHash:digest(JSON.stringify(inputs))},
  deVigMarketProbability:i?.45:.55,pass2:{eloProbability:i?.42:.58,reasons:['model_validation_and_standing_activation_missing']}};});
 const record={format:'edgelab.v6-frozen-team-shadow',version:1,id,screen:{at,candidates},registry:{mappings:{H:{canonicalId:'H',name:'LOCAL H'},A:{canonicalId:'A',name:'LOCAL A'}}},positionsRegistered:0,financialWrites:0};
 const frozen={record,hash:digest(JSON.stringify(record))};await atomicPrivateJson(path.join(root,'team-shadow',id+'.json'),frozen);
 const a=evidence('the-odds-api.com','/v4/sports/basketball_nba/scores?eventIds=LOCAL',[{id:'LOCAL',sport_key:'basketball_nba',commence_time:drift?'2026-11-12T00:11:00.000Z':start,completed:true,home_team:'LOCAL H',away_team:'LOCAL A',scores:[{name:'LOCAL H',score:'120'},{name:'LOCAL A',score:'110'}],last_update:after}]);
 const b=evidence('balldontlie','/v1/games/7',{data:{id:7,season:2026,datetime:statsStart,status:'Final',status_state:'final',postseason:false,home_team:{id:1,full_name:'LOCAL H'},visitor_team:{id:2,full_name:'LOCAL A'},home_team_score:120,visitor_team_score:110}});
 await retainEvidence(root,a);await retainEvidence(root,b);
 const payload={shadowHash:frozen.hash,at:after,results:[{eventId:'LOCAL',status:drift?'unresolved':'verified',reason:drift?'final_scores_or_fixture_clocks_disagree':null,result:drift?null:{receiptIds:[a.id,b.id]}}],positions:0,settlements:0,financialWrites:0};
 const data={revision:1,previousHash:null,factHash:digest(JSON.stringify(payload.results)),payload};await atomicPrivateJson(path.join(root,'team-shadow-results',id+'.json'),[{...data,hash:digest(JSON.stringify(data))}]);
 return {id,frozen};
}
async function temp(work:(root:string)=>Promise<void>){const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-eval-'));try{await work(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
describe('genuine-shadow evaluation semantics with synthetic evidence',()=>{
 it('uses one fixture unit, preserves complementary selections and never registers or changes originals',()=>temp(async root=>{
  const {id,frozen}=await fixture(root),before=await fs.readFile(path.join(root,'team-shadow',id+'.json'),'utf8'),{report}=await evaluateFrozenShadow(root,id,after);
  expect(report.fixtures).toBe(1);expect(report.verifiedSelections).toBe(2);expect(report.primaryVerifiedMetrics.challenger?.games).toBe(1);expect(report.primaryVerifiedMetrics.challenger?.brier).toBeCloseTo(.16,12);
  expect(report.selections.map(s=>s.outcome)).toEqual(['won','lost']);expect(report.positions).toBe(0);expect(report.financialWrites).toBe(0);
  expect(report.shadowHash).toBe(frozen.hash);expect(await fs.readFile(path.join(root,'team-shadow',id+'.json'),'utf8')).toBe(before);
 }));
 it('keeps source-agreed clock drift unresolved and out of primary metrics without discarding reported outcomes',()=>temp(async root=>{
  const {id}=await fixture(root,true),{report}=await evaluateFrozenShadow(root,id,after);
  expect(report.verifiedSelections).toBe(0);expect(report.unresolvedSelections).toBe(2);expect(report.primaryVerifiedMetrics.challenger).toBeNull();
  expect(report.provisionalSourceAgreementMetrics.metrics.challenger?.games).toBe(1);expect(report.games[0].oddsStartChangeSeconds).toBe(60);
  expect(report.selections.every(s=>s.outcome==='unresolved'&&s.scoreClassification==='provisional_unresolved')).toBe(true);
  expect(report.selections[0].sourceReportedOutcome).toBe('won');
 }));
 it('rejects corrupted result chains and invalid probability inputs',()=>temp(async root=>{
  const {id}=await fixture(root),file=path.join(root,'team-shadow-results',id+'.json'),history=JSON.parse(await fs.readFile(file,'utf8'));history[0].payload.results[0].status='unresolved';
  await fs.writeFile(file,JSON.stringify(history));await expect(loadShadowResults(root,id)).rejects.toThrow(/hash/);
  expect(()=>binaryMetrics([{p:1.1,y:1}])).toThrow(/Invalid/);expect(binaryMetrics([])).toBeNull();
 }));
});
