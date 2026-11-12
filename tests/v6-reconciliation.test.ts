import {describe,it,expect} from 'vitest';
import { reconcileTeamEvent } from '@/lib/v6/team-reconciliation';
import { reconciliationFixture,changed,start,freeze } from './fixtures/v6-reconciliation';
import { currentTeamCatalogue } from '@/lib/v6/team-catalogue';
import {digest,type RawEvidence} from '@/lib/v6/evidence.server';
describe('versioned event identity reconciliation with original quote safeguards',()=>{
 it('verifies bounded same-ID drift without changing any original source or inventing actual tip-off',async()=>{
  const i=reconciliationFixture(),original=JSON.stringify(i),d=await reconcileTeamEvent(i);
  expect(d.identity.verified).toBe(true);expect(d.result).toMatchObject({verified:true,winnerId:i.proof.homeId});expect(d.quoteEligibility).toMatchObject({eligible:true,actualStartedAt:null,conservativeDeadline:start});
  expect(d.settlementEligibility.eligible).toBe(false);expect(d.startDriftSeconds).toBe(180);expect(JSON.stringify(i)).toBe(original);
 });
 it.each(['id','team_id','home_away','season','league','postponed','shift','doubleheader'] as const)('rejects identity discrepancy: %s',async kind=>{
  const i=reconciliationFixture();
  if(kind==='id')i.secondary=changed(i.secondary,b=>{b.data.id=8;});
  if(kind==='team_id')i.secondary=changed(i.secondary,b=>{b.data.home_team.id=99;});
  if(kind==='home_away')i.secondary=changed(i.secondary,b=>{const t=b.data.home_team;b.data.home_team=b.data.visitor_team;b.data.visitor_team=t;});
  if(kind==='season')i.secondary=changed(i.secondary,b=>{b.data.season=2025;});
  if(kind==='league')i.originalOdds=changed(i.originalOdds,b=>{b[0].sport_key='basketball_nbl';});
  if(kind==='postponed')i.secondary=changed(i.secondary,b=>{b.data.postponed=true;});
  if(kind==='shift')i.scores=changed(i.scores,b=>{b[0].commence_time='2026-11-13T00:05:01.000Z';});
  if(kind==='doubleheader')i.originalFixtures=changed(i.originalFixtures,b=>{b.data.push({...b.data[0],id:8});});
  expect((await reconcileTeamEvent(i)).identity.verified).toBe(false);
 });
 it('keeps identity distinct from contradictory final scores and stale quote evidence',async()=>{
  const i=reconciliationFixture();i.secondary=changed(i.secondary,b=>{b.data.home_team_score=119;});
  const d=await reconcileTeamEvent(i);expect(d.identity.verified).toBe(true);expect(d.result.verified).toBe(false);
  const j=reconciliationFixture();j.quote.sourceUpdatedAt='2026-11-12T21:00:00.000Z';j.originalOdds=changed(j.originalOdds,b=>{b[0].bookmakers[0].markets[0].last_update=j.quote.sourceUpdatedAt;});
  const stale=await reconcileTeamEvent(j);expect(stale.result.verified).toBe(true);expect(stale.quoteEligibility.reasons).toContain('stale_or_future_quote');
 });
 it('does not use positive drift to accept an in-play or near-start capture',async()=>{
  const i=reconciliationFixture();i.frozenAt='2026-11-13T00:00:30.000Z';i.quote={...i.quote,retrievedAt:i.frozenAt,sourceUpdatedAt:i.frozenAt,forecastAt:i.frozenAt};
  i.originalOdds={...changed(i.originalOdds,b=>{b[0].bookmakers[0].markets[0].last_update=i.frozenAt;}),retrievedAt:i.frozenAt};
  const d=await reconcileTeamEvent(i);expect(d.identity.verified).toBe(true);expect(d.quoteEligibility.eligible).toBe(false);expect(d.quoteEligibility.conservativeDeadline).toBe(start);
 });
 it('never mistakes a different selection price for the quoted selection',async()=>{
  const i=reconciliationFixture();i.quote.odds=2.5;expect((await reconcileTeamEvent(i)).quoteEligibility.eligible).toBe(false);
 });
 it('rejects duplicate result rows and altered raw bytes',async()=>{
  const i=reconciliationFixture();i.scores=changed(i.scores,b=>{b.push({...b[0]});});expect((await reconcileTeamEvent(i)).identity.reasons).toContain('malformed_or_duplicate_provider_records');
  const j=reconciliationFixture();j.scores.raw+=' ';expect((await reconcileTeamEvent(j)).identity.reasons).toContain('source_hash_mismatch');
 });
 it('bounds identity at five minutes but never moves a pre-event deadline forward',async()=>{
  const i=reconciliationFixture();i.scores=changed(i.scores,b=>{b[0].commence_time='2026-11-13T00:05:00.000Z';});
  expect((await reconcileTeamEvent(i)).identity.verified).toBe(true);i.scores=changed(i.scores,b=>{b[0].commence_time='2026-11-12T23:59:00.000Z';});
  const d=await reconcileTeamEvent(i);expect(d.identity.verified).toBe(false);expect(i.frozenAt).toBe(freeze);
 });
 it('refreshes an unchanged native catalogue without daily prompts and blocks identity changes',async()=>{
  const raw=JSON.stringify({data:Array.from({length:30},(_,n)=>({id:n+1,full_name:'LOCAL TEST '+n,abbreviation:'T'+n,conference:'East',division:'Atlantic'}))});
  const old:RawEvidence={id:crypto.randomUUID(),provider:'balldontlie',sourceUrl:'https://api.balldontlie.io/v1/teams',retrievedAt:'2026-11-01T00:00:00.000Z',sourceUpdatedAt:null,raw,hash:digest(raw)};let calls=0;
  const fresh={...old,id:crypto.randomUUID(),retrievedAt:freeze};
  expect(await currentTeamCatalogue(old,freeze,async()=>{calls++;return fresh;})).toEqual(fresh);expect(calls).toBe(1);
  await currentTeamCatalogue(fresh,freeze,async()=>{throw new Error('Must not fetch a fresh catalogue');});
  await expect(currentTeamCatalogue(old,freeze,async()=>changed(fresh,b=>{b.data[0].id=99;}))).rejects.toThrow(/membership changed/);
 });
});
