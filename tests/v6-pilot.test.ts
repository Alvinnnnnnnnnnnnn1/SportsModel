/** Invented local fixtures only; all real source observations remain ignored. */
import { describe,it,expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { digest,retainEvidence,type RawEvidence } from '@/lib/v6/evidence.server';
import { freeSources } from '@/lib/v6/free-sources.server';
import { nbaPointsForecast,evaluateNbaPoints,pointsThreshold,type NbaGameLog } from '@/lib/v6/nba-points';
import { nbaPlayerLogs,nbaMinutes } from '@/lib/v6/nba-source';
import { appendIdentityRevision,identityReasons,type IdentityRevision } from '@/lib/v6/identity-registry.server';
import { nbaGradeProposal } from '@/lib/v6/nba-grading';
import { screenNbaShadow } from '@/lib/v6/shadow';
import { registerPaper,appendGrade,paperAccounting } from '@/lib/v6/engine';
import { emptyV6State } from '@/lib/v6/types';
import { v6WorkerHealth } from '@/lib/v6/health';
import { now,observation,forecast } from './fixtures/v6';
const at='2026-11-11T04:00:00Z';
const evidence=(endpoint:string,body:unknown,provider:RawEvidence['provider']='api-nba'):RawEvidence=>{const raw=JSON.stringify(body);return {id:crypto.randomUUID(),provider,sourceUrl:(provider==='api-nba'?'https://v2.nba.api-sports.io':'https://api.the-odds-api.com')+endpoint,retrievedAt:at,sourceUpdatedAt:null,raw,hash:digest(raw)};};
const game=()=>({id:100,league:'standard',season:2026,stage:2,date:{start:'2026-11-11T01:00:00.000Z',end:null},status:{short:3},teams:{home:{id:1,name:'LOCAL Home'},visitors:{id:2,name:'LOCAL Away'}}});
const box=()=>({player:{id:7},team:{id:2},game:{id:100},points:25,min:'32:00',comment:null as string|null});
const envelope=(response:unknown[])=>({errors:[],response});
const mapping=():IdentityRevision=>({version:1,id:crypto.randomUUID(),mappingKey:'LOCAL-map',revision:1,previousHash:null,recordedAt:now,league:'NBA',season:2026,eventStartsAt:game().date.start,internalFixtureId:'SYNTHETIC-LOCAL-event',oddsEventId:'LOCAL-odds',sportsbetEventId:'LOCAL-book',statsGameId:'100',internalPlayerId:'SYNTHETIC-LOCAL-player-1',oddsPlayerId:null,statsPlayerId:'7',playerLabel:'LOCAL Player',market:'player_points',side:'Over',line:20.5,period:'full_game',overtime:'included',termsHash:'a'.repeat(64),sourceHashes:['a'.repeat(64)],authority:null,status:'blocked',reasons:[]});
const logs=():NbaGameLog[]=>Array.from({length:40},(_,i)=>({playerId:'7',teamId:'2',gameId:String(i),season:2026,stage:2,startsAt:new Date(Date.parse('2026-10-01T00:00:00Z')+i*86400000).toISOString(),completedAt:null,finalObservedAt:new Date(Date.parse('2026-10-01T04:00:00Z')+i*86400000).toISOString(),minutes:20+i%10,points:10+i%15,participated:true,final:true,sourceHashes:['a'.repeat(64)]}));
describe('V6 evidence, independent NBA baseline and shadow/result pilot',()=>{
 it('distinguishes stopped, missed and failed runs from fresh runs whose source data is blocked',()=>{
  const base={enabled:true,killSwitch:false,lastAttempt:null,now:at};
  expect(v6WorkerHealth(base).status).toBe('never_run');expect(v6WorkerHealth({...base,killSwitch:true}).status).toBe('stopped');
  const last={at:now,status:'completed' as const,screened:10,registered:0,excluded:10};expect(v6WorkerHealth({...base,lastAttempt:last}).sourceStatus).toBe('all_screened_blocked');
  expect(v6WorkerHealth({...base,lastAttempt:{...last,at:'2026-11-09T00:00:00Z'}}).status).toBe('missed_run');expect(v6WorkerHealth({...base,lastAttempt:{...last,status:'failed'}}).status).toBe('failed');
 });
 it('retains identical raw bytes with distinct actual fetch receipts and refuses hash corruption',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-evidence-'));try{
   const e=evidence('/games',envelope([game()]));await retainEvidence(root,e);const later={...e,id:crypto.randomUUID(),retrievedAt:'2026-11-11T05:00:00Z'};
   expect((await retainEvidence(root,later)).retrievedAt).toBe(later.retrievedAt);expect(await fs.readdir(path.join(root,'evidence-receipts'))).toHaveLength(2);
   await expect(retainEvidence(root,{...e,retrievedAt:later.retrievedAt})).rejects.toThrow(/receipt changed/);
   await expect(retainEvidence(root,{...e,id:'../../bad'})).rejects.toThrow(/identifier/);
   await expect(retainEvidence(root,{...e,raw:'changed'})).rejects.toThrow(/SHA/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
 });
 it('shares free odds reservations across processes/instances, adopts four previous credits and never refunds failed calls',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-quota-'));try{
   await fs.writeFile(path.join(root,'odds-pilot-budget.json'),JSON.stringify({period:'2026-11',reservations:4}));
   let clock=Date.parse(now),used=4,calls=0;
   const fetcher:typeof fetch=async input=>{calls++;if(new URL(String(input)).pathname.endsWith('/odds'))used++;return new Response('[]',{headers:{'x-requests-remaining':String(500-used),'x-requests-used':String(used)}});};
   const a=freeSources({root,oddsKey:'LOCAL-test-key',clock:()=>clock,fetcher}),b=freeSources({root,oddsKey:'LOCAL-test-key',clock:()=>clock,fetcher});
   await a.read('the-odds-api.com','/v4/sports');clock+=2000;
   const request=(x:typeof a)=>x.read('the-odds-api.com','/v4/sports/basketball_nba/events/LOCAL/odds',{markets:'player_points',bookmakers:'sportsbet'},1);
   const concurrent=await Promise.allSettled([request(a),request(b)]);expect(concurrent.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(calls).toBe(2);
   clock+=2000;await request(b);clock+=2000;await expect(request(a)).rejects.toThrow(/allowance/);expect(used).toBe(6);
   await expect(a.read('the-odds-api.com','https://bad.invalid/')).rejects.toThrow(/endpoint/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
 });
 it('keeps uncertain transport reservations and requires a new free status/catalogue check before retry',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-fail-'));try{
   let clock=Date.parse(now),calls=0;
   const fetcher:typeof fetch=async()=>{calls++;if(calls===1)return new Response('[]',{headers:{'x-requests-remaining':'500','x-requests-used':'0'}});throw new Error('network failure');};
   const api=freeSources({root,oddsKey:'LOCAL-test-key',clock:()=>clock,fetcher});await api.read('the-odds-api.com','/v4/sports');clock+=2000;
   await expect(api.read('the-odds-api.com','/v4/sports/basketball_nba/odds',{markets:'h2h',bookmakers:'sportsbet'},1)).rejects.toThrow(/reservation retained/);
   clock+=2000;await expect(api.read('the-odds-api.com','/v4/sports/basketball_nba/odds',{markets:'h2h',bookmakers:'sportsbet'},1)).rejects.toThrow(/uncertain/);expect(calls).toBe(2);
  }finally{await fs.rm(root,{recursive:true,force:true});}
 });
 it('retains shared pilot credits under an approved controlled allowance and rejects overspending before transport',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-controlled-quota-'));try{
   let clock=Date.parse(now),calls=0;await fs.writeFile(path.join(root,'odds-shared-budget.json'),JSON.stringify({period:'2026-11',reserved:10,remaining:490,used:10,lastRequest:0,uncertain:false,freeConfirmed:true}));
   const fetcher:typeof fetch=async()=>{calls++;return new Response('[]',{headers:{'x-requests-remaining':'489','x-requests-used':'11'}});};
   const make=(ceiling:number)=>freeSources({root,oddsKey:'LOCAL-test-key',clock:()=>clock,fetcher,controlledQuota:{monthlyCeiling:ceiling,approvalHash:'a'.repeat(64)}});
   await make(11).read('the-odds-api.com','/v4/sports/basketball_nba/odds',{markets:'h2h',bookmakers:'sportsbet'},1);clock+=2000;
   await expect(make(11).read('the-odds-api.com','/v4/sports/basketball_nba/odds',{markets:'h2h',bookmakers:'sportsbet'},1)).rejects.toThrow(/allowance/);
   await expect(make(401).read('the-odds-api.com','/v4/sports/basketball_nba/odds',{markets:'h2h',bookmakers:'sportsbet'},1)).rejects.toThrow(/approval/);expect(calls).toBe(1);
   expect(JSON.parse(await fs.readFile(path.join(root,'odds-shared-budget.json'),'utf8')).reserved).toBe(11);
  }finally{await fs.rm(root,{recursive:true,force:true});}
 });
 it('requires free NBA subscription verification, discards account fields and retains denied-scope evidence without retry',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-nba-free-'));try{
   let clock=Date.parse(now),calls=0;
   const fetcher:typeof fetch=async input=>{calls++;const u=new URL(String(input));
    if(u.pathname==='/status')return new Response(JSON.stringify({response:{account:{email:'LOCAL-private@example.invalid'},subscription:{active:true,plan:'Free'},requests:{limit_day:100,current:0}}}),{headers:{'x-ratelimit-requests-remaining':'100'}});
    return new Response(JSON.stringify({errors:{plan:'LOCAL TEST subscription scope denial'},response:[]}));};
   const api=freeSources({root,nbaKey:'LOCAL-test-key',clock:()=>clock,fetcher});
   await expect(api.read('api-nba','/games',{season:'2026'})).rejects.toThrow(/free plan/);expect(calls).toBe(0);
   const status=await api.read('api-nba','/status');expect(status.raw).not.toContain('LOCAL-private');clock+=17000;
   await expect(api.read('api-nba','/games',{season:'2026'})).rejects.toThrow(/scope rejected/);
   clock+=17000;await expect(api.read('api-nba','/games',{season:'2023'})).rejects.toThrow(/uncertain/);expect(calls).toBe(2);
   expect(await fs.readdir(path.join(root,'evidence'))).toHaveLength(2);
  }finally{await fs.rm(root,{recursive:true,force:true});}
 });
 it('joins exact historical game/player IDs and keeps unknown minutes and DNP distinct from observed zero',async()=>{
  const g=evidence('/games',envelope([game()])),b=box();b.min='';
  let result=await nbaPlayerLogs(g,evidence('/players/statistics',envelope([b])));expect(result.logs[0]).toMatchObject({minutes:null,participated:null,completedAt:null});
  b.min='0';b.comment='Did not play';result=await nbaPlayerLogs(g,evidence('/players/statistics',envelope([b])));expect(result.logs[0].participated).toBe(false);
  expect(nbaMinutes('12:60')).toBeNull();expect(nbaMinutes('12:30')).toBe(12.5);
  b.team.id=99;await expect(nbaPlayerLogs(g,evidence('/players/statistics',envelope([b])))).rejects.toThrow(/team/);
 });
 it('fits a frozen full distribution with separate minutes/rate shrinkage and no future or missing-data leakage',async()=>{
  const data=logs(),input={playerId:'7',cutoff:now,eventStartsAt:game().date.start,calculatedAt:now};
  const result=await nbaPointsForecast(data,input);expect(result.status).toBe('experimental');const f=result.forecast!;
  expect(f.expectedMinutes).toBeGreaterThan(0);expect(f.rateSD).toBeGreaterThan(0);expect(f.distribution.reduce((a,b)=>a+b,0)).toBeCloseTo(1,8);
  const p=pointsThreshold(f.distribution,20.5,'Over'),u=pointsThreshold(f.distribution,20.5,'Under');expect(p.winProbability+u.winProbability).toBeCloseTo(1,8);
  const future={...data[0],gameId:'future',startsAt:'2026-11-12T00:00:00Z',finalObservedAt:'2026-11-12T04:00:00Z',points:150};expect((await nbaPointsForecast([...data,future],input)).forecast?.inputsHash).toBe(f.inputsHash);
  expect((await nbaPointsForecast(data.slice(0,5),input)).forecast).toBeNull();expect((await nbaPointsForecast(data,{...input,cutoff:'2027-01-01T00:00:00Z',calculatedAt:'2027-01-01T00:00:00Z',eventStartsAt:'2027-01-02T00:00:00Z'})).reason).toMatch(/too_old/);
  expect((await nbaPointsForecast(data,{...input,calculatedAt:'2026-11-12T00:00:00Z'})).forecast).toBeNull();
  await expect(nbaPointsForecast([...data,{...data[0],points:99}],input)).rejects.toThrow(/Conflicting/);
 });
 it('compares chronological held-out scores with a simple benchmark without claiming independent threshold samples',async()=>{
  const report=await evaluateNbaPoints(logs());expect(report.uniquePlayerGames).toBe(20);expect(report.thresholdObservations).toBe(100);expect(report.archivedPublicationTimesVerified).toBe(false);expect(report.model?.brier).toBeGreaterThan(0);expect(report.benchmark?.logLoss).toBeGreaterThan(0);
 });
 it('preserves blocked versioned mappings and rejects name-only authority, pointer tricks, changed replay and stale revisions',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-map-'));try{
   const e=evidence('/games',envelope([game()])),m=mapping();m.sourceHashes=[e.hash];m.recordedAt=at;
   expect(identityReasons(m,[e])).toContain('non_name_cross_provider_authority_missing');
   await expect(appendIdentityRevision(root,{...m,status:'verified'},[e])).rejects.toThrow(/authority/);
   const one=await appendIdentityRevision(root,m,[e]);expect((await appendIdentityRevision(root,m,[e])).hash).toBe(one.hash);
   await expect(appendIdentityRevision(root,{...m,line:21.5},[e])).rejects.toThrow(/replay/);
   await expect(appendIdentityRevision(root,{...m,id:crypto.randomUUID()},[e])).rejects.toThrow(/revision/);
   const two=await appendIdentityRevision(root,{...m,id:crypto.randomUUID(),revision:2,previousHash:one.hash,recordedAt:'2026-11-11T05:00:00Z'},[e]);expect(two.record.status).toBe('blocked');
  }finally{await fs.rm(root,{recursive:true,force:true});}
 });
 it('screens every exact real-shaped market as shadow only, preserving nulls and rejecting duplicates/malformed quotes',async()=>{
  const raw={id:'LOCAL',sport_key:'basketball_nba',commence_time:'2026-11-11T06:00:00Z',home_team:'LOCAL H',away_team:'LOCAL A',bookmakers:[{key:'sportsbet',sid:'LOCAL-book',markets:[{key:'player_points',last_update:at,outcomes:[{name:'Over',description:'LOCAL Player',point:20.5,price:1.9,participant_id:null}]}]}]};
  const e=evidence('/v4/sports/basketball_nba/events/LOCAL/odds',raw,'the-odds-api.com');
  const screen=await screenNbaShadow(e,logs(),[],at);expect(screen).toMatchObject({registrations:0,qualifiedProposals:0,screened:1});expect(screen.candidates[0]).toMatchObject({probability:null,expectedValue:null,stakeCents:5000,registrationProposal:null});
  raw.bookmakers[0].markets[0].outcomes.push(raw.bookmakers[0].markets[0].outcomes[0]);await expect(screenNbaShadow(evidence('/v4/sports/basketball_nba/events/LOCAL/odds',raw,'the-odds-api.com'),[],[],at)).rejects.toThrow(/Duplicate/);
 });
 it('grades final exact points with a nullable publication clock, immutable raw evidence, restart/replay and correct A$50 results',async()=>{
  const o=observation();o.market.operator='gt';o.market.threshold=20.5;const registered=await registerPaper(emptyV6State('LOCAL','v6-synthetic'),o,await forecast(o),'pre_event_once',now),p=registered.position!;
  const m={...mapping(),status:'verified' as const},g=evidence('/games',envelope([game()])),b=evidence('/players/statistics',envelope([box()]));
  const result=await nbaGradeProposal(p,m,g,b,{version:o.market.termsVersion,hash:m.termsHash!,approvedAt:'2026-11-10T00:00:00Z',fullGameOvertime:true,dnpVoid:false},at);
  expect(result.grade?.publishedAt).toBeNull();expect(result.grade?.observedAt).toBe(at);
  let state=await appendGrade(registered.state,result.grade!);expect(paperAccounting(state).profitCents).toBe(4500);state=await appendGrade(state,result.grade!);expect(state.grades).toHaveLength(1);
  const repeated=await nbaGradeProposal(p,m,g,b,{version:o.market.termsVersion,hash:m.termsHash!,approvedAt:'2026-11-10T00:00:00Z',fullGameOvertime:true,dnpVoid:false},at,result.grade);expect(repeated.status).toBe('unchanged');
  const later='2026-11-11T05:00:00Z';expect((await nbaGradeProposal(p,m,{...g,retrievedAt:later},{...b,retrievedAt:later},{version:o.market.termsVersion,hash:m.termsHash!,approvedAt:'2026-11-10T00:00:00Z',fullGameOvertime:true,dnpVoid:false},later,result.grade)).status).toBe('unchanged');
  await expect(appendGrade(registered.state,{...result.grade!,rawEvidence:'tampered'})).rejects.toThrow(/hash/);expect(state.positions[0]).toEqual(p);
  const notFinal=game();notFinal.status.short=2;expect((await nbaGradeProposal(p,m,evidence('/games',envelope([notFinal])),b,{version:o.market.termsVersion,hash:m.termsHash!,approvedAt:'2026-11-10T00:00:00Z',fullGameOvertime:true,dnpVoid:false},at)).grade).toBeNull();
 });
 it('grades a push or a positively evidenced DNP void only under frozen supported terms',async()=>{
  const o=observation();o.market.operator='gt';o.market.threshold=21;o.market.termsVersion='nba-points-ot-dnp-void-v1:'+'a'.repeat(64);
  const first=await registerPaper(emptyV6State('LOCAL','v6-synthetic'),o,await forecast(o),'pre_event_once',now),p=first.position!;
  const m={...mapping(),status:'verified' as const,line:21},rules={version:o.market.termsVersion,hash:'a'.repeat(64),approvedAt:'2026-11-10T00:00:00Z',fullGameOvertime:true as const,dnpVoid:true};
  const g=evidence('/games',envelope([game()])),stats=box();stats.points=21;
  const push=await nbaGradeProposal(p,m,g,evidence('/players/statistics',envelope([stats])),rules,at);expect(push.grade?.outcome).toBe('push');expect(paperAccounting(await appendGrade(first.state,push.grade!)).profitCents).toBe(0);
  const dnp={...box(),points:null,min:'0',comment:'Did not play'};
  const voided=await nbaGradeProposal(p,m,g,evidence('/players/statistics',envelope([dnp])),rules,at);expect(voided.grade?.outcome).toBe('void');expect(paperAccounting(await appendGrade(first.state,voided.grade!))).toMatchObject({voids:1,pendingCents:0,profitCents:0});
  dnp.comment='';expect((await nbaGradeProposal(p,m,g,evidence('/players/statistics',envelope([dnp])),rules,at)).grade).toBeNull();
 });
});
