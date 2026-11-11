/** Synthetic local fixtures. No live providers, private account or hosted writes. */
import { describe,it,expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { digest,retainEvidence,type RawEvidence } from '@/lib/v6/evidence.server';
import { freeSources } from '@/lib/v6/free-sources.server';
import { ingestNbaTraining,loadTrainingDataset,trainingSummary } from '@/lib/v6/training-dataset.server';
import { preserveNbaScreen,observeNbaOutcome } from '@/lib/v6/observations.server';
import { appendIdentityRevision,type IdentityRevision } from '@/lib/v6/identity-registry.server';
const at='2026-11-11T04:00:00.000Z',start='2026-11-12T00:00:00.000Z',after='2026-11-12T04:00:00.000Z';
const evidence=(endpoint:string,body:unknown,provider:RawEvidence['provider']='api-nba',time=at):RawEvidence=>{
 const origin={'api-nba':'https://v2.nba.api-sports.io','api-basketball':'https://v1.basketball.api-sports.io','the-odds-api.com':'https://api.the-odds-api.com',balldontlie:'https://api.balldontlie.io',thesportsdb:'https://www.thesportsdb.com'}[provider],raw=JSON.stringify(body);
 return {id:crypto.randomUUID(),provider,sourceUrl:origin+endpoint,retrievedAt:time,sourceUpdatedAt:null,raw,hash:digest(raw)};
};
const env=(response:unknown[])=>({errors:[],response});
const game=(date='2026-11-10T00:00:00.000Z')=>({id:100,league:'standard',season:2026,stage:2,date:{start:date,end:null},status:{short:3},teams:{home:{id:1,name:'LOCAL H'},visitors:{id:2,name:'LOCAL A'}}});
const box=(points=20)=>({player:{id:7},team:{id:2},game:{id:100},points,min:'25:30',starter:undefined as boolean|undefined});
const odds=(id='LOCAL',time=at)=>evidence(`/v4/sports/basketball_nba/events/${id}/odds`,{id,sport_key:'basketball_nba',commence_time:start,home_team:'LOCAL H',away_team:'LOCAL A',bookmakers:[{key:'sportsbet',markets:[{key:'player_points',last_update:time,outcomes:[{name:'Over',description:'LOCAL P',point:20.5,price:1.9,participant_id:'7'}]}]}]},'the-odds-api.com',time);
async function temp(work:(root:string)=>Promise<void>){const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-observational-'));try{await work(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
describe('isolated observational and historical training data',()=>{
 it('verifies API-Basketball as a separate free subscription and prevents paid-plan state reuse',()=>temp(async root=>{
  let now=Date.parse(at),paid=false,calls=0;
  const fetcher:typeof fetch=async input=>{calls++;const url=new URL(String(input));expect(url.origin).toBe('https://v1.basketball.api-sports.io');
   return new Response(JSON.stringify(url.pathname==='/status'?{response:{account:{email:'LOCAL PRIVATE'},subscription:{plan:paid?'Paid':'Free',active:true},requests:{limit_day:100,current:1}}}:env([{id:12,name:'NBA',seasons:[{season:'2026-2027'}]}])),{headers:{'x-ratelimit-requests-remaining':'99'}});};
  const api=freeSources({root,nbaKey:'LOCAL KEY',fetcher,clock:()=>now});
  await expect(api.read('api-basketball','/leagues')).rejects.toThrow(/free plan/);expect(calls).toBe(0);
  expect((await api.read('api-basketball','/status')).raw).not.toContain('LOCAL PRIVATE');now+=17000;
  expect((await api.read('api-basketball','/leagues',{name:'NBA'})).provider).toBe('api-basketball');now+=17000;
  paid=true;await expect(api.read('api-basketball','/status')).rejects.toThrow(/active free/);now+=17000;
  await expect(api.read('api-basketball','/games')).rejects.toThrow(/free plan/);expect(calls).toBe(3);
  await expect(api.read('api-basketball','/bets')).rejects.toThrow(/endpoint/);
  await expect(api.read('espn' as RawEvidence['provider'],'/games')).rejects.toThrow(/provider/);
  const invalid={...odds(),provider:'api-basketball' as const};await expect(retainEvidence(root,invalid)).rejects.toThrow(/URL/);
 }));
 it('deduplicates exact player-games across refreshes, qualifies IDs, preserves null facts and appends corrections',()=>temp(async root=>{
  const games=evidence('/games?season=2026',env([game()])),stats=evidence('/players/statistics?id=7&season=2026',env([box()]));
  expect(await ingestNbaTraining(root,games,stats,at)).toMatchObject({inserted:1,totalPlayerGames:1});
  expect(await ingestNbaTraining(root,games,stats,at)).toMatchObject({unchanged:1,inserted:0});
  const later='2026-11-11T05:00:00.000Z',changed=evidence('/players/statistics?id=7&season=2026',env([box(21)]),'api-nba',later);
  expect(await ingestNbaTraining(root,games,changed,later)).toMatchObject({revised:1,totalPlayerGames:1});
  const store=await loadTrainingDataset(root),history=Object.values(store.rows)[0];expect(history).toHaveLength(2);
  expect(history[0].facts).toMatchObject({opponentId:'1',home:false,starter:null,points:20});expect(history[1].facts.points).toBe(21);
  expect(history[0].sourcePublishedAt).toBeNull();expect(history[0].availableAt).toBe(at);expect(trainingSummary(store)).toMatchObject({totalPlayerGames:1,revisions:2,players:1});
  await expect(ingestNbaTraining(root,games,stats,later)).rejects.toThrow(/Stale/);
 }));
 it('rejects wrong fixture/team and future final evidence atomically without damaging prior labels',()=>temp(async root=>{
  const games=evidence('/games',env([game()])),stats=evidence('/players/statistics',env([box()]));await ingestNbaTraining(root,games,stats,at);
  const before=await fs.readFile(path.join(root,'training/player-games.json'),'utf8');
  const bad=box();bad.team.id=999;await expect(ingestNbaTraining(root,games,evidence('/players/statistics',env([bad])),at)).rejects.toThrow(/team/);
  await expect(ingestNbaTraining(root,evidence('/games',env([game(start)])),stats,at)).rejects.toThrow(/availability/);
  const orphan=box();orphan.game.id=101;await expect(ingestNbaTraining(root,games,evidence('/players/statistics',env([orphan])),at)).rejects.toThrow(/unknown exact/);
  expect(await fs.readFile(path.join(root,'training/player-games.json'),'utf8')).toBe(before);
  const corrupt=JSON.parse(before);Object.values(corrupt.rows as Record<string,{facts:{points:number}}[]>)[0][0].facts.points=99;
  await fs.writeFile(path.join(root,'training/player-games.json'),JSON.stringify(corrupt));await expect(loadTrainingDataset(root)).rejects.toThrow(/integrity/);
 }));
 it('freezes all blocked quotes outside positions, retains exact clocks and cannot upgrade a replay after start',()=>temp(async root=>{
  const e=odds(),one=await preserveNbaScreen(root,e,[],[],at);expect(one.record).toMatchObject({financialPosition:false,classification:'pre_event_observation'});
  const c=one.record.screen.candidates[0];expect(c).toMatchObject({originalOdds:1.9,sourceUpdatedAt:at,retrievedAt:at,probability:null,expectedValue:null,diagnosticForecast:null,registrationProposal:null});
  expect(one.record.identities[0].playerId).toBeNull();expect(c.reasons).toContain('verified_non_name_identity_missing');
  const replay=await preserveNbaScreen(root,e,[],[],after);expect(replay.status).toBe('already_recorded');expect(replay.hash).toBe(one.hash);expect(replay.record.recordedAt).toBe(at);
  await expect(preserveNbaScreen(root,{...e,retrievedAt:after},[],[],after)).rejects.toThrow(/replay/);
  await expect(observeNbaOutcome(root,e.id,c.key,evidence('/games',env([game(start)]),'api-nba',after),evidence('/players/statistics',env([box()]),'api-nba',after),after)).rejects.toThrow(/mapping unavailable/);
  expect(await fs.readdir(path.join(root,'observations'))).toHaveLength(1);await expect(fs.stat(path.join(root,'positions'))).rejects.toThrow();
 }));
 it('archives late data as retrospective and refuses future clocks or fabricated verified registry mappings',()=>temp(async root=>{
  const e=odds();expect((await preserveNbaScreen(root,e,[],[],after)).record.classification).toBe('retrospective_source_review');
  await expect(preserveNbaScreen(root,odds('OTHER',after),[],[],at)).rejects.toThrow(/source/);
  const m={version:1,id:crypto.randomUUID(),mappingKey:'LOCAL-map',revision:1,previousHash:null,recordedAt:at,league:'NBA',season:2026,eventStartsAt:start,internalFixtureId:'NBA:100',oddsEventId:'NEXT',sportsbetEventId:null,statsGameId:'100',internalPlayerId:'api-nba:7',oddsPlayerId:'7',statsPlayerId:'7',playerLabel:'LOCAL P',market:'player_points',side:'Over',line:20.5,period:'full_game',overtime:'included',termsHash:'a'.repeat(64),sourceHashes:[e.hash],authority:null,status:'verified',reasons:[]} as IdentityRevision;
  await expect(preserveNbaScreen(root,odds('NEXT'),[],[m],at)).rejects.toThrow();
 }));
 it('appends real-shaped exact statistical outcomes idempotently without grading or retrospective paper promotion',()=>temp(async root=>{
  const e=odds(),profile=evidence('/players',env([{id:7,firstname:'LOCAL',lastname:'P'}]));await retainEvidence(root,e);await retainEvidence(root,profile);
  const m:IdentityRevision={version:1,id:crypto.randomUUID(),mappingKey:'LOCAL-map',revision:1,previousHash:null,recordedAt:at,league:'NBA',season:2026,eventStartsAt:start,internalFixtureId:'NBA:100',oddsEventId:'LOCAL',sportsbetEventId:null,statsGameId:'100',internalPlayerId:'api-nba:7',oddsPlayerId:'7',statsPlayerId:'7',playerLabel:'LOCAL P',market:'player_points',side:'Over',line:20.5,period:'full_game',overtime:'included',termsHash:'a'.repeat(64),sourceHashes:[e.hash,profile.hash],authority:{namespace:'nba_player_id',oddsSourceHash:e.hash,statsSourceHash:profile.hash,oddsPath:'/bookmakers/0/markets/0/outcomes/0/participant_id',statsPath:'/response/0/id'},status:'verified',reasons:[]};
  // Profile/name alone cannot establish a fixture, season or roster relationship.
  await expect(appendIdentityRevision(root,m,[e,profile])).rejects.toThrow(/authority/);
  const fixture=evidence('/games?season=2026',env([game(start)])),roster=evidence('/players?team=2&season=2026',env([{id:7,firstname:'LOCAL',lastname:'P'}]));
  await retainEvidence(root,fixture);await retainEvidence(root,roster);
  m.fixtureAuthority={gamesSourceHash:fixture.hash,rosterSourceHash:roster.hash,gamesReceiptId:fixture.id,rosterReceiptId:roster.id,statsTeamId:'2'};m.sourceHashes.push(fixture.hash,roster.hash);
  await expect(appendIdentityRevision(root,{...m,fixtureAuthority:{...m.fixtureAuthority,statsTeamId:'99'}},[e,profile,fixture,roster])).rejects.toThrow(/roster/);
  await expect(appendIdentityRevision(root,{...m,eventStartsAt:'2026-11-12T01:00:00.000Z'},[e,profile,fixture,roster])).rejects.toThrow(/fixture_date/);
  // Identical profile/roster bytes have the same content hash but different query
  // scope. Verification must use the exact roster fetch receipt, not its first blob.
  expect(roster.hash).toBe(profile.hash);expect(roster.id).not.toBe(profile.id);
  await expect(appendIdentityRevision(root,{...m,fixtureAuthority:{...m.fixtureAuthority,rosterReceiptId:profile.id}},[e,profile,fixture,roster])).rejects.toThrow(/roster/);
  await appendIdentityRevision(root,m,[e,profile,fixture,roster]);const saved=await preserveNbaScreen(root,e,[],[m],at),key=saved.record.screen.candidates[0].key;
  const games=evidence('/games',env([game(start)]),'api-nba',after),stats=evidence('/players/statistics',env([box(25)]),'api-nba',after);
  expect((await observeNbaOutcome(root,e.id,key,games,stats,after)).record.record).toMatchObject({points:25,financialSettlement:false,sourcePublishedAt:null});
  expect((await observeNbaOutcome(root,e.id,key,games,stats,after)).status).toBe('unchanged');
  const correction=evidence('/players/statistics',env([box(24)]),'api-nba',after);expect((await observeNbaOutcome(root,e.id,key,games,correction,after)).record.revision).toBe(2);
  const reloaded=await preserveNbaScreen(root,e,[],[],after);expect(reloaded.hash).toBe(saved.hash);expect(reloaded.record.screen.registrations).toBe(0);
 }));
});
