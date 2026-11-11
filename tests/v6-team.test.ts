/** Invented sources in temporary local stores; never hosted or genuine performance. */
import { describe,it,expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { digest,type RawEvidence } from '@/lib/v6/evidence.server';
import { teamSources } from '@/lib/v6/team-sources.server';
import { freeSources } from '@/lib/v6/free-sources.server';
import { teamGames,usableTeamGames,type TeamGame } from '@/lib/v6/team-games';
import { ingestTeamGames,loadTeamDataset,latestTeamGames } from '@/lib/v6/team-dataset.server';
import { teamRegistry,canonicalTeamRows,resolveTeamLabel } from '@/lib/v6/team-identity';
import { regularSeasonCoverage } from '@/lib/v6/team-coverage';
import { evaluateTeamModel,forecastTeamGame } from '@/lib/v6/team-model';
import { screenTeamSlate,gradeTeamMoneyline,verifyObservedTeamScore } from '@/lib/v6/team-pilot';
import { freezeTeamShadow } from '@/lib/v6/team-shadow.server';
import { registerPaper,appendGrade,paperAccounting,qualification } from '@/lib/v6/engine';
import { emptyV6State } from '@/lib/v6/types';
import { runV6Worker,v6PolicyHash } from '@/lib/v6/worker';
import { localV6Repository } from '@/lib/v6/repository.server';
const at='2026-11-11T12:00:00.000Z',start='2026-11-12T00:10:00.000Z',scheduled='2026-11-12T00:00:00.000Z',after='2026-11-12T04:00:00.000Z';
const origins:Record<RawEvidence['provider'],string>={'api-nba':'https://v2.nba.api-sports.io','api-basketball':'https://v1.basketball.api-sports.io','the-odds-api.com':'https://api.the-odds-api.com',balldontlie:'https://api.balldontlie.io',thesportsdb:'https://www.thesportsdb.com'};
function evidence(provider:RawEvidence['provider'],endpoint:string,body:unknown,time=at):RawEvidence{const raw=JSON.stringify(body);return {id:crypto.randomUUID(),provider,sourceUrl:origins[provider]+endpoint,retrievedAt:time,sourceUpdatedAt:null,raw,hash:digest(raw)};}
const catalogue=()=>evidence('balldontlie','/v1/teams',{data:Array.from({length:30},(_,i)=>({id:i+1,full_name:'LOCAL Team '+i,city:'LOCAL',name:'Team '+i,abbreviation:'T'+String(i).padStart(2,'0'),conference:i<15?'East':'West',division:'Atlantic'}))});
const rows=():TeamGame[]=>Array.from({length:600},(_,i)=>({provider:'api-nba',sourceGameId:String(i),league:'NBA',season:2026,startsAt:new Date(Date.parse('2026-08-01T00:00:00Z')+Math.floor(i/6)*86400000+i%6*3600000).toISOString(),
 home:{id:String(i%30+1),name:'LOCAL Team '+i%30,code:'T'+String(i%30).padStart(2,'0')},away:{id:String((i+1)%30+1),name:'LOCAL Team '+(i+1)%30,code:'T'+String((i+1)%30).padStart(2,'0')},homeScore:i%4===0?120:100,awayScore:i%4===0?100:110,
 final:true,compatibleTraining:true,sourceUpdatedAt:null,retrievedAt:'2026-11-11T11:00:00.000Z',receiptId:crypto.randomUUID(),rawHash:'a'.repeat(64)}));
const pending=(history:TeamGame[]):TeamGame=>({...history[0],provider:'balldontlie',sourceGameId:'999',startsAt:scheduled,homeScore:null,awayScore:null,final:false});
const odds=()=>evidence('the-odds-api.com','/v4/sports/basketball_nba/odds?bookmakers=sportsbet&markets=h2h',[{id:'LOCAL',sport_key:'basketball_nba',commence_time:start,home_team:'LOCAL Team 0',away_team:'LOCAL Team 1',bookmakers:[{key:'sportsbet',sid:'LOCAL-BOOK',markets:[{key:'h2h',last_update:at,outcomes:[{name:'LOCAL Team 0',price:1.9},{name:'LOCAL Team 1',price:2}]}]}]}]);
async function temp(work:(root:string)=>Promise<void>){const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-team-'));try{await work(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
async function slate(){const history=rows(),registry=await teamRegistry(catalogue(),history);registry.recordedAt=at;const all=[...canonicalTeamRows(history,registry).matched,pending(history)];return {history:all,registry,source:odds()};}
describe('V6 team market source, independent model and frozen shadow',()=>{
 it('allows only free team/game reads, protects keys and observes persistent five-per-minute/429 budgets',()=>temp(async root=>{
  let clock=Date.parse(at),calls=0;
  const fetcher:typeof fetch=async(input,init)=>{calls++;expect(new URL(String(input)).origin).toBe('https://api.balldontlie.io');expect((init?.headers as Record<string,string>).Authorization).toBe('LOCAL KEY');return new Response('{}',{status:429,headers:{'retry-after':'120'}});};
  const api=teamSources({root,bdlKey:'LOCAL KEY',clock:()=>clock,fetcher});
  await expect(api.read('balldontlie','/v1/stats')).rejects.toThrow(/free/);expect(calls).toBe(0);
  await expect(api.read('balldontlie','/v1/games')).rejects.toThrow(/429/);clock+=13000;
  await expect(teamSources({root,bdlKey:'LOCAL KEY',clock:()=>clock,fetcher}).read('balldontlie','/v1/games')).rejects.toThrow(/quota/);expect(calls).toBe(1);
  await expect(teamSources({root,fetcher}).read('balldontlie','/v1/games')).rejects.toThrow(/not configured/);
  const receipt=JSON.parse(await fs.readFile(path.join(root,'balldontlie-team-budget.json'),'utf8'));expect(receipt.requests).toBe(1);expect(JSON.stringify(receipt)).not.toContain('LOCAL KEY');
 }));
 it('budgets completed scores at two credits and shares pre-existing odds reservations',()=>temp(async root=>{
  await fs.writeFile(path.join(root,'odds-shared-budget.json'),JSON.stringify({period:'2026-11',reserved:5,remaining:495,used:5,lastRequest:0,uncertain:false,freeConfirmed:true}));let clock=Date.parse(at),used=5;
  const api=freeSources({root,oddsKey:'LOCAL KEY',oddsPilot:'team-moneyline-v1',clock:()=>clock,fetcher:async input=>{if(new URL(String(input)).pathname.endsWith('/scores'))used+=2;else used++;return new Response('[]',{headers:{'x-requests-used':String(used),'x-requests-remaining':String(500-used)}});}});
  await api.read('the-odds-api.com','/v4/sports/basketball_nba/scores',{daysFrom:'3'},2);clock+=2000;
  await expect(api.read('the-odds-api.com','/v4/sports/basketball_nba/scores',{daysFrom:'4'},2)).rejects.toThrow(/daysFrom/);
  expect(JSON.parse(await fs.readFile(path.join(root,'odds-shared-budget.json'),'utf8')).reserved).toBe(7);
  await expect(api.read('the-odds-api.com','/v4/sports/basketball_nba/scores',{daysFrom:'3'},1)).rejects.toThrow(/credit cost/);
 }));
 it('requires exact final scores, preserves unknown start times and excludes incompatible/nonfinal games',async()=>{
  const e=evidence('balldontlie','/v1/games?season_type=regular',{data:[{id:1,season:2026,status:'Final',status_state:'final',postseason:false,home_team:{id:1,full_name:'LOCAL H'},visitor_team:{id:2,full_name:'LOCAL A'},home_team_score:120,visitor_team_score:110}]});
  expect((await teamGames(e))[0].startsAt).toBeNull();expect(usableTeamGames(await teamGames(e),at).games).toHaveLength(0);
  const data=rows();expect(usableTeamGames([...data,{...data[0],final:false,sourceGameId:'OTHER'}],at).games).toHaveLength(600);
  expect(usableTeamGames([...data,{...data[0],provider:'balldontlie',homeScore:119}],at).conflicts).toHaveLength(1);
  await expect(teamGames({...e,hash:'0'.repeat(64)})).rejects.toThrow(/hash/);
 });
 it('stores game revisions and duplicate replays without changing original source or accepting stale corrections',()=>temp(async root=>{
  const body={data:[{id:1,season:2026,status:'Final',status_state:'final',postseason:false,datetime:'2026-11-10T00:00:00Z',home_team:{id:1,full_name:'LOCAL H',abbreviation:'H'},visitor_team:{id:2,full_name:'LOCAL A',abbreviation:'A'},home_team_score:120,visitor_team_score:110}]};
  const e=evidence('balldontlie','/v1/games?season_type=regular',body);expect((await ingestTeamGames(root,e)).inserted).toBe(1);expect((await ingestTeamGames(root,e)).unchanged).toBe(1);
  body.data[0].home_team_score=121;const changed=evidence('balldontlie','/v1/games?season_type=regular',body,'2026-11-11T13:00:00Z');expect((await ingestTeamGames(root,changed)).revised).toBe(1);
  expect(latestTeamGames(await loadTeamDataset(root))[0].homeScore).toBe(121);await expect(ingestTeamGames(root,e)).rejects.toThrow(/Stale/);
 }));
 it('requires a complete thirty-team catalogue, exact provider IDs/codes and no fuzzy name authority',async()=>{
  const r=await teamRegistry(catalogue(),rows());expect(new Set(Object.values(r.mappings).map(m=>m.canonicalId)).size).toBe(30);expect(resolveTeamLabel(r,'local team 0')).toBeNull();expect(resolveTeamLabel(r,'LOCAL Team 0')?.canonicalId).toBe('NBA:T00');
  const bad=catalogue(),body=JSON.parse(bad.raw);body.data.push({...body.data[0],id:999});await expect(teamRegistry(evidence('balldontlie','/v1/teams',body),rows())).rejects.toThrow(/thirty/);
 });
 it('proves pagination chains, accepts evidenced short terminal pages and rejects overlap/missing middle pages',async()=>{
  const a=evidence('balldontlie','/v1/games?seasons[]=2026&season_type=regular&per_page=100&end_date=2026-11-11',{data:Array.from({length:100},(_,i)=>({id:i})),meta:{next_cursor:100,per_page:100}});
  const b=evidence('balldontlie','/v1/games?seasons[]=2026&season_type=regular&per_page=100&end_date=2026-11-11&cursor=100',{data:[{id:101}],meta:{prev_cursor:100,per_page:100}});
  expect((await regularSeasonCoverage([a,b],2026,at)).complete).toBe(true);expect((await regularSeasonCoverage([a],2026,at)).complete).toBe(false);
  const bad=JSON.parse(b.raw);bad.data=[{id:0}];expect((await regularSeasonCoverage([a,evidence('balldontlie',new URL(b.sourceUrl).pathname+new URL(b.sourceUrl).search,bad)],2026,at)).reason).toBe('overlapping_game_pages');
 });
 it('walks forward by date, reports calibration and keeps future results out of earlier forecasts',async()=>{
  const data=rows(),report=evaluateTeamModel(data);expect(report.teams).toBe(30);expect(report.heldOutGames).toBeGreaterThan(100);expect(report.challenger?.calibration).toHaveLength(10);expect(report.promoted).toBe(false);
  const future={...data.at(-1)!,sourceGameId:'FUTURE',startsAt:'2026-11-14T00:00:00Z',retrievedAt:'2026-11-14T04:00:00Z'};
  const input={home:'LOCAL Team 0',away:'LOCAL Team 1',season:2026,startsAt:scheduled,at,completeRegularSeasons:[2026]};
  const one=await forecastTeamGame(data,input),two=await forecastTeamGame([...data,future],input);expect(one.forecast?.inputsHash).toBe(two.forecast?.inputsHash);expect(one.forecast?.validation).toBe('experimental');
  expect((await forecastTeamGame(data,{...input,completeRegularSeasons:[]})).forecast).toBeNull();
 });
 it('freezes attributable pre-event prices/probabilities, de-vigs both sides and applies two passes without promotion',async()=>{
  const s=await slate(),screen=await screenTeamSlate(s.source,s.history,s.registry,[2026],at);expect(screen.candidates).toHaveLength(2);expect(screen.candidates.every(c=>c.forecast!==null)).toBe(true);
  expect(screen.candidates[0].proof).toMatchObject({startsAt:start,statsStartsAt:scheduled,earliestStartsAt:scheduled,clockDifferenceSeconds:600});
  expect(screen.candidates.reduce((n,c)=>n+c.deVigMarketProbability,0)).toBeCloseTo(1);expect(screen.candidates.every(c=>!c.qualifies&&!c.financialRegistration)).toBe(true);
  const c=screen.candidates[0];expect(c.forecast!.inputs.team?.safeEventStartsAt).toBe(scheduled);expect(qualification(c.observation!,c.forecast,at,'v6-prospective')).toContain('model_not_validated');
  expect(qualification(c.observation!,c.forecast,'2026-11-12T00:05:00Z','v6-prospective')).toContain('earliest_scheduled_start_gate');
  const wrong={...s.history.at(-1)!,sourceGameId:'AMBIGUOUS'};expect((await screenTeamSlate(s.source,[...s.history,wrong],s.registry,[2026],at)).candidates[0].pass2.reasons).toContain('exact_current_fixture_missing_or_ambiguous');
 });
 it('rejects stale/ambiguous quotes, unknown teams and absent independent history without invented probabilities',async()=>{
  const s=await slate(),body=JSON.parse(s.source.raw);body[0].bookmakers[0].markets[0].last_update='2026-11-10T00:00:00Z';
  const stale=evidence('the-odds-api.com',new URL(s.source.sourceUrl).pathname+new URL(s.source.sourceUrl).search,body);expect((await screenTeamSlate(stale,s.history,s.registry,[2026],at)).candidates[0].pass2.reasons).toContain('stale_or_future_quote');
  expect((await screenTeamSlate(s.source,[],s.registry,[],at)).candidates[0].forecast).toBeNull();
  body[0].bookmakers[0].markets[0].outcomes.push(body[0].bookmakers[0].markets[0].outcomes[0]);await expect(screenTeamSlate(evidence('the-odds-api.com',new URL(s.source.sourceUrl).pathname+new URL(s.source.sourceUrl).search,body),s.history,s.registry,[2026],at)).rejects.toThrow(/ambiguous/);
 });
 it('restarts/replays a frozen shadow without later promotion or implicit positions',()=>temp(async root=>{
  const s=await slate(),saved=await freezeTeamShadow(root,s.source,s.history,s.registry,[2026],at),replay=await freezeTeamShadow(root,s.source,[],s.registry,[],after);
  expect(replay.status).toBe('already_recorded');expect(replay.hash).toBe(saved.hash);expect(replay.record.positionsRegistered).toBe(0);expect(replay.record.screen.at).toBe(at);
  await expect(freezeTeamShadow(root,{...s.source,retrievedAt:after},[],s.registry,[],after)).rejects.toThrow(/replay/);
 }));
 it('grades exact same-event results only after independent agreement and applies A$50 corrections once',async()=>{
  const s=await slate(),screen=await screenTeamSlate(s.source,s.history,s.registry,[2026],at),c=screen.candidates.find(c=>c.forecast!.probability>.55)!;
  // Artificial validation is a test control, not a real model approval.
  const o={...c.observation!,sourceClass:'synthetic' as const},f={...c.forecast!,validation:'out_of_sample_validated' as const};o.odds=3;
  const t=f.inputs.team!;t.homeOdds=1.15/(o.market.subjectId===t.homeId?f.probability:1-f.probability);t.awayOdds=1.15/(o.market.subjectId===t.awayId?f.probability:1-f.probability);
  // Engine source odds are bounded to four decimal places, even in simulations.
  t.homeOdds=Math.round(t.homeOdds*10000)/10000;t.awayOdds=Math.round(t.awayOdds*10000)/10000;o.odds=o.market.subjectId===t.homeId?t.homeOdds:t.awayOdds;f.inputsHash=digest(JSON.stringify(f.inputs));
  const registered=await registerPaper(emptyV6State('LOCAL','v6-synthetic'),o,f,'pre_event_once',at);expect(registered.reasons).toEqual([]);const p=registered.position!;
  const scores=evidence('the-odds-api.com','/v4/sports/basketball_nba/scores',{unused:true},after);
  const primary=(home=120)=>evidence('the-odds-api.com','/v4/sports/basketball_nba/scores',[{id:'LOCAL',sport_key:'basketball_nba',commence_time:start,completed:true,home_team:'LOCAL Team 0',away_team:'LOCAL Team 1',scores:[{name:'LOCAL Team 0',score:String(home)},{name:'LOCAL Team 1',score:'110'}],last_update:after}],after);
  const secondary=(home=120)=>evidence('balldontlie','/v1/games/999',{data:{id:999,season:2026,status:'Final',status_state:'final',postseason:false,datetime:scheduled,home_team:{id:1,full_name:'LOCAL Team 0'},visitor_team:{id:2,full_name:'LOCAL Team 1'},home_team_score:home,visitor_team_score:110}},after);
  void scores;const result=await gradeTeamMoneyline(p,c.proof!,primary(),secondary(),after);expect(result.grade).not.toBeNull();
  let state=await appendGrade(registered.state,result.grade!);const pnl=paperAccounting(state).profitCents;expect(Math.abs(pnl)).toBeGreaterThan(0);
  expect((await gradeTeamMoneyline(p,c.proof!,primary(),secondary(),after,result.grade)).status).toBe('unchanged');state=await appendGrade(state,result.grade!);expect(paperAccounting(state).profitCents).toBe(pnl);
  expect((await gradeTeamMoneyline(p,c.proof!,primary(),secondary(119),after)).status).toBe('unresolved');
  expect((await verifyObservedTeamScore(c.proof!,primary(),secondary(),after)).result?.financialSettlement).toBe(false);
  expect((await verifyObservedTeamScore(c.proof!,primary(),secondary(119),after)).status).toBe('unresolved');
  const correction=await gradeTeamMoneyline(p,c.proof!,primary(100),secondary(100),after,result.grade);expect(correction.grade?.revision).toBe(2);
  const corrected=await appendGrade(state,correction.grade!);expect(paperAccounting(corrected).profitCents).not.toBe(pnl);expect(paperAccounting(corrected).decisiveStakeCents).toBe(5000);
  expect((await gradeTeamMoneyline(p,c.proof!,primary(100),secondary(100),after,correction.grade)).status).toBe('unchanged');
  expect((await gradeTeamMoneyline(p,{...c.proof!,registryHash:'0'.repeat(64)},primary(),secondary(),after)).status).toBe('unresolved');
  await expect(appendGrade({...state,ownerId:'OTHER'},result.grade!)).rejects.toThrow(/ownership/);
 });
 it('uses the existing worker in dry-run, preserves actual methods and replay state without activation',()=>temp(async root=>{
  const s=await slate(),screen=await screenTeamSlate(s.source,s.history,s.registry,[2026],at),repo=localV6Repository(root,'LOCAL'),forecasts=new Map(screen.candidates.map(c=>[c.observation!.id,c.forecast!]));
  const provider={collectionPermitted:true,collect:async()=>screen.candidates.map(c=>c.observation!),grade:async()=>null},model={modelId:'nba-team-elo-form-rest',version:'experimental-1',validationManifestHash:'a'.repeat(64),forecast:async(o:{id:string})=>forecasts.get(o.id)!};
  const options={runId:'LOCAL-team-run',now:at,clock:()=>at,mode:'dry_run' as const,killSwitch:false,activation:null};
  const result=await runV6Worker(repo,provider,model,options);expect(result.state.runs[0].rejections.every(r=>r.reasons.includes('model_not_validated'))).toBe(true);expect(result.state.positions).toHaveLength(0);
  expect((await runV6Worker(localV6Repository(root,'LOCAL'),provider,model,options)).status).toBe('already_processed');
  await expect(runV6Worker(repo,provider,model,{...options,runId:'NOT-APPROVED',mode:'armed',activation:{ownerId:'OTHER',policyHash:await v6PolicyHash(),activatedAt:at}})).rejects.toThrow(/Activate/);
 }));
});
