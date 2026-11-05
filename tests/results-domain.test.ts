import { describe, expect, it } from 'vitest';
import { createEmptyData } from '@/lib/domain/fixtures';
import type { AppData, Bet, Candidate } from '@/lib/domain/types';
import { emptyHistoricalWorkspace, type HistoricalWorkspace } from '@/lib/imports/types';
import { parseHistoricalSource, prepareImportCommit, commitHistoricalImport, registerHistoricalPaper } from '@/lib/imports';
import { withResearchRecordLink } from '@/lib/daily/placement';
import {
  buildSettlementTargets, historicalSettlementExclusions, observationForTarget, parseSettlementResponse,
  reviewSettlementResponse, makeSettlementEvidence, generateResultsCheckPrompt, observedLegClearance,
  settlementResponseJsonSchema, type SettlementResponse, type SettlementObservation, type SettlementTarget,
} from '@/lib/results';

const base=Date.now(),hour=3600000;
const iso=(offset:number)=>new Date(base+offset).toISOString();
const now=new Date(base+3*hour);
function fixture(){
  const data=createEmptyData(),history=emptyHistoricalWorkspace();
  const candidate:Candidate={id:crypto.randomUUID(),sport:'NBA',event:'SYNTHETIC North vs South',participant:'SYNTHETIC Player',market:'Player points',selection:'Over 20.5 points',line:'20.5',bookmaker:'SYNTHETIC Book',odds:1.9,probability:0.6,strategy:'B',rationale:'SYNTHETIC test only',uncertainty:'illustrative',startsAt:iso(hour),registeredAt:iso(-hour),oddsProvenance:{source:'SYNTHETIC quoted price',timestamp:iso(-hour),method:'fixed fixture',modelVersion:'synthetic-v1',simulated:true},probabilityProvenance:{source:'SYNTHETIC numerical fixture',timestamp:iso(-hour),method:'fixed input only',modelVersion:'synthetic-v1',simulated:true}};
  const bet:Bet={id:crypto.randomUUID(),candidateId:candidate.id,placedAt:iso(-hour),confirmedAt:iso(-hour),bookmaker:'SYNTHETIC Book',stakeCents:500,stakeType:'cash',odds:2,outcome:'pending',strategy:'B',notes:'SYNTHETIC registered wager; no real bet.',legs:[{id:crypto.randomUUID(),sport:candidate.sport,event:candidate.event,participant:candidate.participant,market:candidate.market,selection:candidate.selection,line:candidate.line,odds:2,outcome:'pending'}]};
  data.candidates=[candidate];data.bets=[bet];
  return{data,history,candidate,bet};
}
function ready(target:SettlementTarget):SettlementObservation {
  const observation=observationForTarget(target);
  return{...observation,outcome:'won',settledAt:iso(2*hour),eventCompleted:true,termsConfirmed:true,termsReference:'SYNTHETIC owner attestation: full game including overtime; exact ticket rules reviewed',verification:'owner_attested',ownerAttested:true,actualPayoutCents:target.kind==='actual'?1000:null,legs:observation.legs.map(leg=>({...leg,outcome:'won',statistic:'SYNTHETIC final points 22',observedValue:22,clearanceMargin:1.5}))};
}
const response=(observations:SettlementObservation[],id=crypto.randomUUID()):SettlementResponse=>({format:'edgelab.settlement-response',version:1,id,createdAt:iso(2*hour+600000),observations});
async function review(data:AppData,history:HistoricalWorkspace,observations:SettlementObservation[],id?:string){return reviewSettlementResponse({response:response(observations,id),appData:data,history,mode:'demo',now});}

async function historicalFixture(){
  const f=fixture(),c=f.candidate;
  const raw={id:'SYNTHETIC-imported-research',sport:c.sport,eventId:'SYNTHETIC-event',event:c.event,startsAt:c.startsAt,participant:c.participant,marketId:'SYNTHETIC-market',market:c.market,selection:c.selection,line:c.line,bookmaker:c.bookmaker,originalOdds:c.odds,oddsTimestamp:iso(-hour),oddsSource:'SYNTHETIC source',oddsSourceUrl:null,predictionTimestamp:iso(-hour),probability:{value:0.6,origin:'deterministic_model',source:'SYNTHETIC source',method:'fixed numerical fixture',modelVersion:'synthetic-v1',timestamp:iso(-hour)},strategy:'B',evidence:[{claim:'SYNTHETIC fixture',sourceUrl:null,observedAt:iso(-hour),verification:'unverified'}],sourceUrls:[],confidence:'unknown',uncertainty:'SYNTHETIC only',decision:'paper',proposedStatus:'paper_only',rationale:'SYNTHETIC',passReasons:[],hypotheticalStakeCents:500,hypotheticalStakeType:'cash',estimatedEv:null};
  const p=await parseHistoricalSource({text:JSON.stringify([{externalId:raw.id,kind:'paper',sport:c.sport,event:c.event,participant:c.participant,market:c.market,selection:c.selection,line:c.line,bookmaker:c.bookmaker,odds:c.odds,predictionAt:iso(-hour),probability:0.6,probabilitySource:'SYNTHETIC',probabilityMethod:'fixed input',modelVersion:'synthetic-v1',strategy:'B',sourceReference:'SYNTHETIC original response',stakeCents:500,stakeType:'cash',outcome:'pending',legs:[{...f.bet.legs[0],odds:c.odds}],verification:'synthetic'}]),sourceName:'synthetic-research.json',format:'json',verification:'synthetic'});
  p.rows[0].raw=raw;
  p.rows[0].transformations.push({field:'context',original:null,normalized:{responseId:'SYNTHETIC-session-6',researchDay:6,researchDate:now.toISOString().slice(0,10),dayStatus:'draft',createdAt:iso(-hour),sessionFingerprint:null},rule:'research_response_context_metadata'});
  let history=commitHistoricalImport(emptyHistoricalWorkspace(),prepareImportCommit(p,[{rowNumber:1,include:true,allowProbableDuplicate:false,acknowledgeIncomplete:true}],'synthetic'));
  history=registerHistoricalPaper(history,history.records[0].id);
  return{...f,history,record:history.records[0]};
}

describe('daily result targets and source evidence boundaries',()=>{
  it('keeps research quotes separate from accepted odds and preserves exact leg IDs',async()=>{
    const f=fixture(),before=structuredClone(f.data),targets=await buildSettlementTargets(f.data,f.history);
    expect(targets[0]).toMatchObject({kind:'actual',acceptedOdds:2,originalOdds:1.9,stakeCents:500,eventDate:observationForTarget(targets[0]).eventDate});
    expect(targets[0].legs[0].legId).toBe(f.bet.legs[0].id);expect(targets[0].sourceReference).toBe('SYNTHETIC quoted price');expect(f.data).toEqual(before);
  });
  it('resolves imported-research placement links without inventing a core-candidate FK',async()=>{
    const f=await historicalFixture();f.data.candidates=[];delete f.data.bets[0].candidateId;
    f.data.bets[0].notes=withResearchRecordLink(f.data.bets[0].notes,f.record.id);
    const target=(await buildSettlementTargets(f.data,f.history)).find(t=>t.kind==='actual')!;
    expect(target).toMatchObject({sessionId:'SYNTHETIC-session-6',researchDay:6,originalOdds:1.9,acceptedOdds:2,startsAt:f.candidate.startsAt,sourceReference:'SYNTHETIC original response'});
    expect(f.data.bets[0].candidateId).toBeUndefined();
  });
  it('does not carry an original fixture start into a changed actual fixture',async()=>{
    const f=fixture();f.data.bets[0].legs[0].event='SYNTHETIC different event';
    expect((await buildSettlementTargets(f.data,f.history))[0]).toMatchObject({startsAt:null,eventDate:null});
  });
  it('excludes archived actual claims and ineligible historical paper review records',async()=>{
    const f=await historicalFixture();const record=f.history.records[0];record.snapshot.verification='unverified';
    const targets=await buildSettlementTargets(f.data,f.history);
    expect(targets.find(t=>t.kind==='historical_paper')?.eligible).toBe(false);
    const archived=structuredClone(record);archived.id=crypto.randomUUID();archived.snapshot.kind='actual';f.history.records.push(archived);
    expect(historicalSettlementExclusions(f.data,f.history)).toHaveLength(1);
    expect((await buildSettlementTargets(f.data,f.history)).some(t=>t.recordId===archived.id)).toBe(false);
  });
  it('requires actual paper registration before the event, not merely an older source timestamp',async()=>{
    const f=await historicalFixture();const audit=f.history.audit.find(a=>a.action==='paper_registered')!;audit.timestamp=iso(2*hour);
    expect((await buildSettlementTargets(f.data,f.history)).find(t=>t.kind==='historical_paper')?.eligible).toBe(false);
  });
  it('does not infer an event date from placement when there is no linked event start',async()=>{
    const f=fixture();delete f.data.bets[0].candidateId;
    const target=(await buildSettlementTargets(f.data,f.history))[0];expect(target.eventDate).toBeNull();
    expect((await review(f.data,f.history,[ready(target)])).rows[0].issues).toContain('Supply the exact event date from the result evidence. Placement date is not an event date.');
  });
});

describe('strict settlement-response review',()=>{
  it('prepares a cash payout through the existing financial validator without changing the source or ledger',async()=>{
    const f=fixture(),before=structuredClone(f.data),target=(await buildSettlementTargets(f.data,f.history))[0];
    const result=await review(f.data,f.history,[ready(target)]);
    expect(result.rows[0]).toMatchObject({eligible:true,expectedPayoutCents:1000,actualBet:{outcome:'won',odds:2,stakeCents:500}});
    expect(result.rows[0].legClearances[0].margin).toBe(1.5);expect(f.data).toEqual(before);
  });
  it('keeps promotional face value separate from cash winnings',async()=>{
    const f=fixture();f.data.bets[0].stakeType='bonus';f.data.bets[0].odds=1.86;f.data.bets[0].legs[0].odds=1.86;
    const observation=ready((await buildSettlementTargets(f.data,f.history))[0]);observation.actualPayoutCents=430;
    expect((await review(f.data,f.history,[observation])).rows[0]).toMatchObject({eligible:true,expectedPayoutCents:430});
    observation.actualPayoutCents=930;
    expect((await review(f.data,f.history,[observation])).rows[0].eligible).toBe(false);
  });
  it('blocks an unknown actual payout rather than treating a calculated value as bookmaker confirmation',async()=>{
    const f=fixture(),observation=ready((await buildSettlementTargets(f.data,f.history))[0]);observation.actualPayoutCents=null;
    expect((await review(f.data,f.history,[observation])).rows[0].issues.join(' ')).toContain('actual cash payout');
  });
  it('requires explicit event completion and known settlement terms',async()=>{
    const f=fixture(),observation=ready((await buildSettlementTargets(f.data,f.history))[0]);observation.eventCompleted=false;observation.termsConfirmed=false;observation.termsReference=null;
    const row=(await review(f.data,f.history,[observation])).rows[0];
    expect(row.eligible).toBe(false);expect(row.issues.join(' ')).toContain('Elapsed time alone');expect(row.issues.join(' ')).toContain('Unknown Sportsbet rules');
  });
  it('never upgrades unsupported ChatGPT conclusions to source verification',async()=>{
    const f=fixture(),observation=ready((await buildSettlementTargets(f.data,f.history))[0]);observation.verification='source_supplied';observation.ownerAttested=false;
    expect((await review(f.data,f.history,[observation])).rows[0].eligible).toBe(false);
    observation.sources=[{url:'https://example.invalid/synthetic-final-source',observedAt:iso(2*hour+1000),note:'SYNTHETIC inspectable URL fixture only'}];
    const row=(await review(f.data,f.history,[observation])).rows[0];expect(row.eligible).toBe(true);expect(row.warnings.join(' ')).toContain('not independent verification');
  });
  it('rejects cross-account IDs, stale fingerprints and changed market identities',async()=>{
    const f=fixture(),target=(await buildSettlementTargets(f.data,f.history))[0];
    const foreign=ready(target);foreign.recordId=crypto.randomUUID();expect((await review(f.data,f.history,[foreign])).rows[0].issues.join(' ')).toContain('authenticated workspace');
    const stale=ready(target);f.data.bets[0].stakeCents=1000;expect((await review(f.data,f.history,[stale])).rows[0].issues.join(' ')).toContain('changed since');
    const different=ready((await buildSettlementTargets(f.data,f.history))[0]);different.legs[0].line='19.5';expect((await review(f.data,f.history,[different])).rows[0].eligible).toBe(false);
  });
  it('rejects impossible source timing, event-date mismatches and incomplete legs',async()=>{
    const f=fixture(),target=(await buildSettlementTargets(f.data,f.history))[0],observation=ready(target);
    observation.eventDate='2000-01-01';observation.settledAt=iso(-2*hour);observation.sources=[{url:'https://example.invalid/synthetic',observedAt:iso(-hour),note:null}];observation.legs=[];
    const row=(await review(f.data,f.history,[observation])).rows[0];expect(row.eligible).toBe(false);expect(row.issues.length).toBeGreaterThan(3);
  });
  it('rejects observations that did not yet exist at the stated response creation time',async()=>{
    const f=fixture(),observation=ready((await buildSettlementTargets(f.data,f.history))[0]);
    observation.sources=[{url:'https://example.invalid/synthetic',observedAt:iso(2*hour+1200000),note:null}];
    expect((await review(f.data,f.history,[observation])).rows[0].issues.join(' ')).toContain('observed after the response');
  });
  it('checks clearance arithmetic without assuming a same-game multi joint probability',async()=>{
    const f=fixture(),observation=ready((await buildSettlementTargets(f.data,f.history))[0]);observation.legs[0].clearanceMargin=10;
    expect((await review(f.data,f.history,[observation])).rows[0].issues.join(' ')).toContain('clearance margin');
    observation.legs[0].clearanceMargin=1.5;observation.legs[0].outcome='lost';observation.outcome='lost';observation.actualPayoutCents=0;
    expect((await review(f.data,f.history,[observation])).rows[0].issues.join(' ')).toContain('stated loss contradicts');
    expect(observedLegClearance({...observation.legs[0],selection:'At least 22 points',line:'22',observedValue:22}).margin).toBe(0);
  });
  it('leaves retirement/DNP and ambiguous void cases pending without explicit resolution',async()=>{
    const f=fixture(),observation=ready((await buildSettlementTargets(f.data,f.history))[0]);observation.specialCases=['retirement'];observation.ownerAttested=false;
    expect((await review(f.data,f.history,[observation])).rows[0].issues.join(' ')).toContain('explicit owner-attested rule resolution');
  });
  it('does not turn an exact strict threshold into a loss under an unknown push rule',async()=>{
    const f=fixture(),observation=ready((await buildSettlementTargets(f.data,f.history))[0]);
    observation.legs[0].observedValue=20.5;observation.legs[0].clearanceMargin=0;observation.legs[0].outcome='lost';observation.outcome='lost';observation.actualPayoutCents=0;
    expect((await review(f.data,f.history,[observation])).rows[0].issues.join(' ')).toContain('push/void rule reconciliation');
  });
  it('blocks mixed win/void multis without inventing adjusted prices',async()=>{
    const f=fixture();f.data.bets[0].legs.push({...f.data.bets[0].legs[0],id:crypto.randomUUID(),participant:'SYNTHETIC second player'});
    const observation=ready((await buildSettlementTargets(f.data,f.history))[0]);observation.legs[1].outcome='void';
    expect((await review(f.data,f.history,[observation])).rows[0].issues.join(' ')).toContain('adjusted pricing');
  });
  it('settles eligible historical paper separately with immutable original source and hypothetical returns',async()=>{
    const f=await historicalFixture(),before=structuredClone(f.history.records[0]);
    const target=(await buildSettlementTargets(f.data,f.history)).find(t=>t.kind==='historical_paper')!;
    const result=await review(f.data,f.history,[ready(target)]);
    expect(result.rows[0]).toMatchObject({eligible:true,actualBet:null,expectedPayoutCents:950,hypotheticalProfitCents:450,historicalPaper:{recordId:target.recordId,outcome:'won'}});
    expect(f.history.records[0]).toEqual(before);
  });
  it('preserves core paper forecasts while calculating only hypothetical amounts',async()=>{
    const f=fixture();f.data.paperPredictions=[{id:crypto.randomUUID(),candidate:structuredClone(f.candidate),registeredAt:iso(-hour),hypotheticalStakeCents:500,outcome:'pending'}];
    const target=(await buildSettlementTargets(f.data,f.history)).find(t=>t.kind==='paper')!,before=structuredClone(f.data.paperPredictions[0]);
    const result=await review(f.data,f.history,[ready(target)]);
    expect(result.rows[0]).toMatchObject({eligible:true,actualBet:null,expectedPayoutCents:950,hypotheticalProfitCents:450});expect(result.rows[0].corePaper?.candidate).toEqual(before.candidate);expect(f.data.paperPredictions[0]).toEqual(before);
  });
  it('makes exact saved responses idempotent and blocks changed response IDs or later corrections',async()=>{
    const f=fixture(),observation=ready((await buildSettlementTargets(f.data,f.history))[0]),input=response([observation]);
    const first=await reviewSettlementResponse({response:input,appData:f.data,history:f.history,mode:'demo',now});
    const after=first.rows[0].actualBet!;f.data.bets=[after];
    f.data.audit.push({id:crypto.randomUUID(),entityType:'bet',entityId:after.id,action:'settled_batch',timestamp:now.toISOString(),before:f.bet,after:{record:after,settlementEvidence:makeSettlementEvidence(input,first.responseHash,observation)}});
    const replay=await reviewSettlementResponse({response:input,appData:f.data,history:f.history,mode:'demo',now});expect(replay.rows[0]).toMatchObject({eligible:false,alreadyApplied:true});
    const changed=structuredClone(input);changed.observations[0].notes='SYNTHETIC different evidence';expect((await reviewSettlementResponse({response:changed,appData:f.data,history:f.history,mode:'demo',now})).rows[0].issues.join(' ')).toContain('different saved evidence');
    f.data.bets[0]={...f.data.bets[0],notes:'SYNTHETIC later correction'};
    expect((await reviewSettlementResponse({response:input,appData:f.data,history:f.history,mode:'demo',now})).rows[0].issues.join(' ')).toContain('has since changed');
  });
});

describe('results contract and fallback prompt',()=>{
  it('keeps results contract separate and rejects malformed, duplicated or credential-bearing fields',async()=>{
    expect(()=>parseSettlementResponse('{bad')).toThrow('valid');
    expect(()=>parseSettlementResponse(JSON.stringify({format:'edgelab.research-response',version:1}))).toThrow();
    const f=fixture(),observation=ready((await buildSettlementTargets(f.data,f.history))[0]);
    expect(()=>parseSettlementResponse(JSON.stringify(response([observation,observation])))).toThrow('only once');
    observation.sources=[{url:'https://example.invalid/result?api_key=SYNTHETIC',observedAt:iso(2*hour),note:null}];expect(()=>parseSettlementResponse(JSON.stringify(response([observation])))).toThrow('without credentials');
    observation.sources=[];observation.notes='password: SYNTHETIC-never-retain';await expect(review(f.data,f.history,[observation])).rejects.toThrow('credentials');
    expect(settlementResponseJsonSchema).toHaveProperty('$schema');
  });
  it('includes exact record/leg IDs, missing evidence and independent-verification limitations in the prompt',async()=>{
    const f=fixture(),targets=await buildSettlementTargets(f.data,f.history),prompt=generateResultsCheckPrompt(targets,now);
    expect(prompt).toContain(f.bet.id);expect(prompt).toContain(f.bet.legs[0].id);expect(prompt).toContain('edgelab.settlement-response');expect(prompt).toContain('not independent verification');expect(prompt).toContain('Never claim owner_attested');expect(prompt).toContain('actualPayoutCents');
    expect(observationForTarget(targets[0])).toMatchObject({outcome:null,eventCompleted:false,termsConfirmed:false,ownerAttested:false,actualPayoutCents:null});
  });
});
