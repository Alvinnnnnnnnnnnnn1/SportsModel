import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyData } from '@/lib/domain/fixtures';
import { calculateMetrics } from '@/lib/domain/calculations';
import { emptyHistoricalWorkspace, commitHistoricalImport, prepareImportCommit, settleHistoricalPaper, computeHypothetical, validateHistoricalTransition, financialReview, parseHistoricalSource } from '@/lib/imports';
import type { HistoricalWorkspace, ImportDecision, VerificationStatus } from '@/lib/imports/types';
import { SYNTHETIC_RESEARCH_RESPONSE, researchResponseSchema, researchResponseJsonSchema, parseResearchResponse, prepareResearchCommit, commitApprovedResearch, buildResearchHandoff, prepareExperimentContextPreview, readExperimentContext, getResearchRecordMetadata, DAY_5_CHECKPOINT, reconcileDay5Checkpoint, reconcileImportPreview, reviewResearchCandidate, melbourneDate } from '@/lib/handoff';
const now = new Date('2026-11-04T00:10:00Z');
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());
const fixture = () => structuredClone(SYNTHETIC_RESEARCH_RESPONSE);
const decisions = (rows: {rowNumber: number}[]): ImportDecision[] => rows.map(row => ({ rowNumber: row.rowNumber, include: true, allowProbableDuplicate: false, acknowledgeIncomplete: true }));
async function preview(verification: VerificationStatus = 'synthetic', changes?: (response: ReturnType<typeof fixture>) => void, history: HistoricalWorkspace = emptyHistoricalWorkspace()) {
  const source = fixture(); changes?.(source);
  return parseResearchResponse({ text: JSON.stringify(source), sourceName: 'SYNTHETIC-research.json', verification, existingRecords: history.records, now });
}
async function context(history: HistoricalWorkspace, day: number | null, verification: VerificationStatus = 'synthetic', rulesText: string | null = null) {
  const source = await prepareExperimentContextPreview({ completedDay: day, rulesText, sourceReference: 'SYNTHETIC locally supplied context only', verification, confirmed: true });
  return commitHistoricalImport(history, prepareImportCommit(source, decisions(source.rows), verification, history.records));
}
describe('versioned research response contract and evidence', () => {
  it('publishes a machine-readable strict JSON schema and explicit synthetic fixture', () => {
    expect(researchResponseSchema.safeParse(fixture()).success).toBe(true);
    expect(researchResponseJsonSchema).toMatchObject({type:'object'});
    expect(SYNTHETIC_RESEARCH_RESPONSE.source).toContain('SYNTHETIC');
  });
  it.each(['NaN', 'Infinity', '1.23456', '0.9', '-1', '10001'])('rejects unsupported decimal odds %s', async value => {
    await expect(preview('synthetic', response => { response.candidates[0].originalOdds = (value === 'NaN' || value === 'Infinity' ? value : Number(value)) as never; })).rejects.toThrow();
  });
  it.each([-0.1, 1.1, '0.6', 'NaN', null])('validates supplied numerical probabilities without coercion %s', async value => {
    const source = fixture(); (source.candidates[0].probability as unknown as {value: unknown}).value = value;
    if (value === null) expect((await parseResearchResponse({text:JSON.stringify(source),sourceName:'test.json',verification:'synthetic',now})).candidateReviews[0].calculatedEv).toBeNull();
    else await expect(parseResearchResponse({text:JSON.stringify(source),sourceName:'test.json',verification:'synthetic',now})).rejects.toThrow();
  });
  it.each(['2026-02-30','not-a-date','2026-13-01'])('rejects invalid research calendar date %s', async researchDate => {
    await expect(preview('synthetic', response => { response.researchDate = researchDate; })).rejects.toThrow();
  });
  it.each([0, -1, 1.5, 1000001])('rejects invalid research day %s', async day => {
    await expect(preview('synthetic', response => { response.researchDay = day; })).rejects.toThrow();
  });
  it('rejects malformed JSON, unknown fields, unsupported sports and wrong version', async () => {
    await expect(parseResearchResponse({text:'[broken',sourceName:'bad.json',verification:'synthetic',now})).rejects.toThrow('Malformed research JSON');
    const source = fixture();
    await expect(parseResearchResponse({text:JSON.stringify({...source,version:2}),sourceName:'bad.json',verification:'synthetic',now})).rejects.toThrow('schema validation');
    await expect(parseResearchResponse({text:JSON.stringify({...source,password:'never-retained'}),sourceName:'bad.json',verification:'synthetic',now})).rejects.toThrow('schema validation');
    await expect(preview('synthetic', response => { response.candidates[0].sport = 'MLB' as never; })).rejects.toThrow();
  });
  it('rejects duplicate source IDs before preview and confirmed-actual declarations', async () => {
    await expect(preview('synthetic', response => { response.passes[0].id = response.candidates[0].id; })).rejects.toThrow('identifiers');
    await expect(preview('synthetic', response => { response.candidates[0].proposedStatus = 'manually_confirmed_actual' as never; })).rejects.toThrow();
  });
  it('rejects credential-bearing source URLs and source strings without retaining them', async () => {
    await expect(preview('synthetic', response => { response.sourceUrls = ['https://example.invalid/path?apiKey=not-a-real-key']; })).rejects.toThrow();
    await expect(preview('synthetic', response => { response.researchMethod = 'password: never-retained'; })).rejects.toThrow('credentials');
  });
  it('rejects escaped NUL, malformed Unicode and oversized source', async () => {
    await expect(preview('synthetic', response => { response.candidates[0].rationale = 'bad\u0000text'; })).rejects.toThrow();
    await expect(preview('synthetic', response => { response.candidates[0].rationale = 'bad\ud800text'; })).rejects.toThrow();
    await expect(parseResearchResponse({text:' '.repeat(1048577),sourceName:'too-large.json',verification:'synthetic',now})).rejects.toThrow('1 MiB');
  });
  it('flags missing prices/evidence as unknown without fabricating model estimates or cash funding', async () => {
    const parsed = await preview('synthetic', response => { const c = response.candidates[0]; c.originalOdds=null;c.oddsTimestamp=null;c.probability.value=null;c.estimatedEv=null;c.evidence=[];c.sourceUrls=[];c.oddsSourceUrl=null;c.hypotheticalStakeCents=null; });
    const row = parsed.importPreview.rows[0]; expect(row.snapshot.odds).toBeNull(); expect(row.snapshot.probability).toBeNull(); expect(row.snapshot.stakeCents).toBeNull();
    expect(parsed.candidateReviews[0].calculatedEv).toBeNull(); expect(parsed.candidateReviews[0].freshness).toBe('unknown'); expect(row.issues.some(issue=>issue.code==='missing_evidence')).toBe(true);
  });
  it('blocks LLM or insufficient numerical probability provenance', async () => {
    const llm = await preview('synthetic', response => { response.candidates[0].probability.origin='llm'; });
    expect(llm.candidateReviews[0].calculatedEv).toBeNull(); expect(llm.importPreview.rows[0].issues.some(issue=>issue.code==='llm_probability_forbidden')).toBe(true);
    expect(()=>prepareResearchCommit(llm,decisions(llm.importPreview.rows),'synthetic')).toThrow();
    const missing = await preview('synthetic', response => { response.candidates[0].probability.method=null; }); expect(missing.importPreview.rows[0].issues.some(issue=>issue.code==='incomplete_probability_provenance')).toBe(true);
  });
  it('keeps numerical method length compatible with immutable SQL snapshot fields', async () => {
    await expect(preview('synthetic', response=>{response.candidates[0].probability.method='x'.repeat(501);})).rejects.toThrow('schema validation');
  });
  it('does not accept a language-model label disguised as deterministic methodology', async () => {
    const parsed = await preview('synthetic', response=>{response.candidates[0].probability.method='ChatGPT judgement';}); expect(parsed.importPreview.rows[0].issues.some(issue=>issue.code==='unsupported_probability_method')).toBe(true);
  });
  it('flags inconsistent reported EV and future model information', async () => {
    const parsed = await preview('synthetic', response=>{response.candidates[0].estimatedEv=.7;response.candidates[0].probability.timestamp='2026-11-04T00:05:00Z';}); expect(parsed.importPreview.rows[0].issues.some(issue=>issue.code==='inconsistent_ev')).toBe(true); expect(parsed.importPreview.rows[0].issues.some(issue=>issue.code==='future_model_information')).toBe(true);
  });
  it('flags stale and future prices and blocks post-start retrospective forecasts', async () => {
    const stale = await preview('synthetic', response=>{response.candidates[0].oddsTimestamp='2026-11-01T00:00:00Z';}); expect(stale.candidateReviews[0].freshness).toBe('stale');
    const future = await preview('synthetic', response=>{response.candidates[0].oddsTimestamp='2026-11-05T00:00:00Z';}); expect(future.candidateReviews[0].freshness).toBe('future'); expect(future.importPreview.rows[0].issues.some(issue=>issue.severity==='error')).toBe(true);
    const started = await preview('synthetic', response=>{response.candidates[0].startsAt='2026-11-04T00:00:30Z';}); expect(started.importPreview.rows[0].issues.some(issue=>issue.code==='retrospective_prediction')).toBe(true);
  });
  it('blocks later-known prices and evidence from a frozen original forecast', async () => {
    const parsed = await preview('synthetic', response => { response.candidates[0].oddsTimestamp='2026-11-04T00:02:00Z';response.candidates[0].evidence[0].observedAt='2026-11-04T00:03:00Z'; });
    expect(parsed.importPreview.rows[0].issues.some(issue=>issue.code==='odds_postdate_prediction')).toBe(true);expect(parsed.importPreview.rows[0].issues.some(issue=>issue.code==='evidence_postdates_prediction')).toBe(true);expect(()=>commitApprovedResearch(emptyHistoricalWorkspace(),parsed,decisions(parsed.importPreview.rows),'synthetic')).toThrow();
  });
  it('blocks future evidence and flags unknown event/evidence timing', async () => {
    const future = await preview('synthetic', response => { response.candidates[0].evidence[0].observedAt='2026-11-05T00:00:00Z'; }); expect(future.importPreview.rows[0].issues.some(issue=>issue.code==='future_evidence')).toBe(true);
    const unknown = await preview('synthetic', response => { response.candidates[0].startsAt=null;response.candidates[0].evidence[0].observedAt=null; });expect(unknown.importPreview.rows[0].issues.some(issue=>issue.code==='unknown_evidence_time')).toBe(true);expect(unknown.importPreview.rows[0].issues.some(issue=>issue.field==='startsAt')).toBe(true);
  });
  it('does not infer cash stake classification and separately supports explicit hypothetical bonus stakes', async () => {
    const missing = await preview('synthetic', response=>{response.candidates[0].hypotheticalStakeType=null;}); expect(missing.importPreview.rows[0].snapshot.stakeType).toBeNull();
    const bonus = await preview('synthetic', response=>{response.candidates[0].hypotheticalStakeType='bonus';}); expect(bonus.importPreview.rows[0].snapshot.stakeType).toBe('bonus');
  });
  it('requires pass reasons and flags source day mismatch and actual proposals', async () => {
    const parsed = await preview('synthetic', response=>{response.researchDate='2026-11-03';response.candidates[0].decision='pass';response.candidates[0].proposedStatus='actual_requires_manual_confirmation';}); expect(parsed.importPreview.rows[0].issues.some(issue=>issue.code==='missing_pass_reason')).toBe(true); expect(parsed.importPreview.rows[0].issues.some(issue=>issue.code==='different_research_date')).toBe(true); expect(parsed.importPreview.rows[0].snapshot.kind).toBeNull();
  });
  it('preserves the exact source text and raw original candidate strings independently of normalization', async () => {
    const source = fixture();source.candidates[0].participant='  SYNTHETIC raw spacing  ';const text=JSON.stringify(source,null,4);
    const parsed = await parseResearchResponse({text,sourceName:'source.json',verification:'synthetic',now}); expect(parsed.importPreview.rawSource).toBe(text);expect((parsed.importPreview.rows[0].raw as {participant:string}).participant).toBe(source.candidates[0].participant);expect(parsed.importPreview.rows[0].snapshot.participant).toBe('SYNTHETIC raw spacing');
    expect(parsed.importPreview.rows[0].transformations.some(change=>change.rule==='research_response_v1_to_nullable_historical_snapshot')).toBe(true);
  });
});
describe('manual review, immutable paper and notification lifecycle', () => {
  it('saves an approved response atomically with one initial paper state and alert, no actual or funding write', async () => {
    const parsed=await preview(); const before=emptyHistoricalWorkspace(); const app=createEmptyData();const baseline=calculateMetrics(app.bets,app.transactions);
    const saved=commitApprovedResearch(before,parsed,decisions(parsed.importPreview.rows),'synthetic',{confirmDayCompletion:true});expect(saved.revision).toBe(1);expect(saved.records).toHaveLength(2);expect(saved.paperResults).toHaveLength(1);expect(saved.notifications).toHaveLength(1);expect(saved.records.filter(record=>record.snapshot.kind==='actual')).toHaveLength(0);expect(financialReview(saved.records[0]).bet).toBeNull();expect(calculateMetrics(app.bets,app.transactions)).toEqual(baseline);expect(getResearchRecordMetadata(saved.records[0])?.ownerConfirmedDayCompletion).toBe(true);
  });
  it('requires explicit incomplete-row acknowledgement and does not auto-include unselected rows', async () => {
    const parsed=await preview();const selected=decisions(parsed.importPreview.rows);selected[0].acknowledgeIncomplete=false;
    expect(()=>prepareResearchCommit(parsed,selected,'synthetic')).toThrow('acknowledgement');selected[0].acknowledgeIncomplete=true;selected[1].include=false;
    const saved=commitApprovedResearch(emptyHistoricalWorkspace(),parsed,selected,'synthetic');expect(saved.records).toHaveLength(1);expect(saved.batches[0].summary.skipped).toBe(1);expect(saved.batches[0].rawSource).toContain('SYNTHETIC-pass-1');
  });
  it('blocks exact duplicates at preview and again at commit without merging', async () => {
    const parsed=await preview();const saved=commitApprovedResearch(emptyHistoricalWorkspace(),parsed,decisions(parsed.importPreview.rows),'synthetic');const again=await preview('synthetic',undefined,saved);
    expect(again.importPreview.rows[0].duplicates.some(duplicate=>duplicate.level==='exact')).toBe(true);expect(()=>commitApprovedResearch(saved,parsed,decisions(parsed.importPreview.rows),'synthetic')).toThrow('duplicate');
  });
  it('rechecks timing at confirmation instead of accepting an expired review pane', async () => {
    const parsed=await preview();vi.setSystemTime(new Date('2026-11-05T01:00:00Z'));expect(()=>commitApprovedResearch(emptyHistoricalWorkspace(),parsed,decisions(parsed.importPreview.rows),'synthetic')).toThrow('Re-parse');
  });
  it('requires separate keep decisions for probable duplicates and never converts actual proposals', async () => {
    const parsed=await preview();const saved=commitApprovedResearch(emptyHistoricalWorkspace(),parsed,decisions(parsed.importPreview.rows),'synthetic');
    const revised=await preview('synthetic',response=>{response.id='SYNTHETIC-new-response';response.candidates[0].proposedStatus='actual_requires_manual_confirmation';response.candidates[0].originalOdds=2;response.candidates[0].estimatedEv=.2;},saved);
    expect(revised.importPreview.rows[0].duplicates.some(duplicate=>duplicate.level==='probable')).toBe(true);expect(()=>commitApprovedResearch(saved,revised,decisions(revised.importPreview.rows),'synthetic')).toThrow('duplicate');const approved=decisions(revised.importPreview.rows).map(decision=>({...decision,allowProbableDuplicate:true}));const next=commitApprovedResearch(saved,revised,approved,'synthetic');expect(next.records.every(record=>record.snapshot.kind!=='actual')).toBe(true);
  });
  it('records leg results and hypothetical analytics without retrospective original edits', async () => {
    const parsed=await preview();let saved=commitApprovedResearch(emptyHistoricalWorkspace(),parsed,decisions(parsed.importPreview.rows),'synthetic');const record=saved.records[0];const frozen=structuredClone(record);
    saved=settleHistoricalPaper(saved,record.id,{recordId:record.id,outcome:'won',settledAt:'2026-11-05T03:00:00Z',statistic:'SYNTHETIC final statistic',legs:record.snapshot.legs.map(leg=>({legId:leg.id,outcome:'won',statistic:'SYNTHETIC 24 points'})),updatedAt:now.toISOString()});expect(saved.records[0]).toEqual(frozen);expect(computeHypothetical(saved.records[0],saved.paperResults[0])).toMatchObject({profitCents:450,returnCents:950,accuracyEligible:true});expect(computeHypothetical(saved.records[0],saved.paperResults[0]).brierScore).toBeCloseTo(.16);
    const changed=structuredClone(saved);changed.revision++;changed.records[0].snapshot.odds=2;expect(()=>validateHistoricalTransition(saved,changed)).toThrow('immutable');
  });
  it('does not create alerts or paper results for passes or watch-only notes', async () => {
    const parsed=await preview('synthetic',response=>{response.candidates[0].decision='watch';});const saved=commitApprovedResearch(emptyHistoricalWorkspace(),parsed,decisions(parsed.importPreview.rows),'synthetic');expect(saved.notifications).toHaveLength(0);expect(saved.paperResults).toHaveLength(0);expect(saved.records.every(record=>record.snapshot.kind===null)).toBe(true);
  });
  it('requires a completed source and explicit owner day completion confirmation', async () => {
    const parsed=await preview('synthetic',response=>{response.dayStatus='draft';});expect(()=>prepareResearchCommit(parsed,decisions(parsed.importPreview.rows),'synthetic',[],{confirmDayCompletion:true})).toThrow('completed');
    const saved=commitApprovedResearch(emptyHistoricalWorkspace(),await preview(),decisions(parsed.importPreview.rows),'synthetic');expect(buildResearchHandoff({appData:createEmptyData(),history:saved,mode:'demo',now}).context.latestConfirmedCompletedDay).toBeNull();
  });
});
describe('permanent owner-attested context and conversation-independent handoff', () => {
  it('keeps Day 5 reported and Day 6 proposed without fabricating imported records or funding', () => {
    const app=createEmptyData();const history=emptyHistoricalWorkspace();const output=buildResearchHandoff({appData:app,history,mode:'supabase',now});expect(output.context).toMatchObject({latestConfirmedCompletedDay:null,reportedCompletedDay:5,proposedResearchDay:6,proposedDayBasis:'unverified_reported_checkpoint',ledgerRecordCount:0,sourceConfirmedHistoricalRecordCount:0,fullOriginalRulesAvailable:false});expect(app.transactions).toHaveLength(0);expect(history.records).toHaveLength(0);expect(output.prompt).toContain('not verified bookmaker cash');expect(output.prompt).toContain('Do not generate numerical probabilities with an LLM');expect(output.prompt).toContain('No API / NOT AUTONOMOUS'.toUpperCase());
  });
  it('requires explicit source reference and owner confirmation for context registration', async () => {
    await expect(prepareExperimentContextPreview({completedDay:5,rulesText:null,sourceReference:'',verification:'synthetic',confirmed:true})).rejects.toThrow();
    await expect(prepareExperimentContextPreview({completedDay:5,rulesText:null,sourceReference:'SYNTHETIC source',verification:'synthetic',confirmed:false as true})).rejects.toThrow();
  });
  it('retains append-only full original rule text and latest context source', async () => {
    let history=await context(emptyHistoricalWorkspace(),5,'synthetic','  SYNTHETIC original rule text retained verbatim.  ');expect(readExperimentContext(history,'demo').context?.rulesText).toBe('  SYNTHETIC original rule text retained verbatim.  ');const before=structuredClone(history);history=await context(history,6,'synthetic','SYNTHETIC additional source rules.');expect(history.records).toHaveLength(2);expect(history.records[0]).toEqual(before.records[0]);const latest=readExperimentContext(history,'demo');expect(latest.context?.completedDay).toBe(6);expect(latest.context?.rulesText).toBe('SYNTHETIC additional source rules.');const output=buildResearchHandoff({appData:createEmptyData(),history,mode:'demo',now});expect(output.context.latestConfirmedCompletedDay).toBe(6);expect(output.context.proposedResearchDay).toBe(7);
  });
  it('does not claim partial supplied rules are the complete original rulebook without explicit attestation', async () => {
    const partial = await context(emptyHistoricalWorkspace(),5,'synthetic','SYNTHETIC partial notes only');expect(buildResearchHandoff({appData:createEmptyData(),history:partial,mode:'demo',now}).context.fullOriginalRulesAvailable).toBe(false);
    const preview = await prepareExperimentContextPreview({completedDay:5,rulesText:'SYNTHETIC explicitly complete test rules',sourceReference:'SYNTHETIC original-source reference',verification:'synthetic',confirmed:true,rulesCompleteConfirmed:true});const complete=commitHistoricalImport(emptyHistoricalWorkspace(),prepareImportCommit(preview,decisions(preview.rows),'synthetic'));expect(buildResearchHandoff({appData:createEmptyData(),history:complete,mode:'demo',now}).context.fullOriginalRulesAvailable).toBe(true);
  });
  it('has no cross-account context singleton or hidden prior-conversation dependence', async () => {
    const first = await context(emptyHistoricalWorkspace(),9,'synthetic','SYNTHETIC owner A private rules');const a=buildResearchHandoff({appData:createEmptyData(),history:first,mode:'demo',now});const b=buildResearchHandoff({appData:createEmptyData(),history:emptyHistoricalWorkspace(),mode:'demo',now});expect(a.context.latestConfirmedCompletedDay).toBe(9);expect(b.context.latestConfirmedCompletedDay).toBeNull();expect(b.prompt).not.toContain('owner A private rules');
  });
  it('ignores unverified contexts and synthetic contexts when building a private handoff', async () => {
    let history=await context(emptyHistoricalWorkspace(),10,'unverified','SYNTHETIC mock only');history=await context(history,20,'synthetic','SYNTHETIC demo only');const output=buildResearchHandoff({appData:createEmptyData(),history,mode:'supabase',now});expect(output.context.latestConfirmedCompletedDay).toBeNull();expect(output.context.proposedResearchDay).toBe(6);expect(output.context.unverifiedHistoricalRecordCount).toBe(1);
  });
  it('uses owner-confirmed completed response metadata but not a mere completed source claim', async () => {
    const parsed=await preview('user_confirmed');let history=commitApprovedResearch(emptyHistoricalWorkspace(),parsed,decisions(parsed.importPreview.rows),'user_confirmed');expect(buildResearchHandoff({appData:createEmptyData(),history,mode:'supabase',now}).context.latestConfirmedCompletedDay).toBeNull();history=commitApprovedResearch(emptyHistoricalWorkspace(),parsed,decisions(parsed.importPreview.rows),'user_confirmed',{confirmDayCompletion:true});expect(buildResearchHandoff({appData:createEmptyData(),history,mode:'supabase',now}).context.latestConfirmedCompletedDay).toBe(6);
  });
  it('includes actual/paper outstanding selections and removes settled paper results from next prompt', async () => {
    const parsed=await preview('user_confirmed');let history=commitApprovedResearch(emptyHistoricalWorkspace(),parsed,decisions(parsed.importPreview.rows),'user_confirmed');let output=buildResearchHandoff({appData:createEmptyData(),history,mode:'supabase',now});expect(output.context.outstanding).toHaveLength(1);const record=history.records[0];history=settleHistoricalPaper(history,record.id,{recordId:record.id,outcome:'lost',settledAt:'2026-11-05T03:00:00Z',statistic:null,legs:record.snapshot.legs.map(leg=>({legId:leg.id,outcome:'lost',statistic:null})),updatedAt:now.toISOString()});output=buildResearchHandoff({appData:createEmptyData(),history,mode:'supabase',now});expect(output.context.outstanding).toHaveLength(0);
  });
  it('retains unknown paper outcomes in outstanding context without relabelling them pending', async () => {
    const parsed=await parseHistoricalSource({text:JSON.stringify([{kind:'paper',event:'SYNTHETIC source with an unknown final outcome',sourceReference:'SYNTHETIC unknown-outcome archive',outcome:null,verification:'user_confirmed'}]),sourceName:'unknown.json',format:'json',verification:'user_confirmed'});const commit=prepareImportCommit(parsed,decisions(parsed.rows),'user_confirmed');const history=commitHistoricalImport(emptyHistoricalWorkspace(),commit);const output=buildResearchHandoff({appData:createEmptyData(),history,mode:'supabase',now});expect(output.context.outstanding).toHaveLength(1);expect(output.context.outstanding[0].outcome).toBeNull();expect(history.records[0].snapshot.outcome).toBeNull();
  });
  it('marks application settings discrepancies without changing established experiment rules', () => {
    const app=createEmptyData();app.settings.fundingCapCents=25000;app.settings.defaultStakeCents=1000;const output=buildResearchHandoff({appData:app,history:emptyHistoricalWorkspace(),mode:'supabase',now});expect(output.context.knownRules.lifetimeFundingCapCents).toBe(50000);expect(output.context.knownRules.generalExperimentalStakeCents).toBe(500);expect(output.context.warnings.some(warning=>warning.includes('differ'))).toBe(true);expect(app.settings.fundingCapCents).toBe(25000);
  });
  it('uses Melbourne research dates across UTC day and daylight-saving boundaries', () => {
    expect(melbourneDate(new Date('2026-11-03T14:00:00Z'))).toBe('2026-11-04');expect(melbourneDate(new Date('2026-06-03T14:00:00Z'))).toBe('2026-06-04');
  });
});
describe('checkpoint reconciliation is comparison, never a synthetic ledger', () => {
  it('retains exact unverified supplied checkpoint figures without inferring a seventh wager or A$500 deposit', () => {
    expect(DAY_5_CHECKPOINT).toMatchObject({actualSettledCount:6,actualWon:2,actualLost:4,cashStakeCents:3000,cashReturnCents:2500,bonusCashReturnCents:430,modelledRealisedProfitCents:-70,allocatedExperimentalBalanceCents:49930,paperSettledCount:11,paperWon:8,paperLost:3,paperPending:4});const app=createEmptyData();const reconciliation=reconcileDay5Checkpoint(app,emptyHistoricalWorkspace());expect(reconciliation.fundingInferred).toBe(false);expect(reconciliation.lines.find(line=>line.key==='cashStakeCents')?.observed).toBe(0);expect(reconciliation.warnings.join(' ')).toContain('seventh wager');expect(app.transactions).toHaveLength(0);
  });
  it('reconciles a proposed paper-only preview without changing actual funding or asserting historical truth', async () => {
    const parsed=await preview();const result=reconcileImportPreview(parsed.importPreview);expect(result).toMatchObject({proposedActualCount:0,calculableActualCount:0,paperCount:1,fundingInferred:false,financialEffect:'preview_only_no_ledger_or_funding_writes'});expect(result.checkpoint.status).toBe('unverified_reference');
  });
  it('computes EV only from supported source inputs and flags a missing-method numerical estimate', () => {
    const candidate=fixture().candidates[0];expect(reviewResearchCandidate(candidate,now).calculatedEv).toBeCloseTo(.14);candidate.probability.method=null;expect(reviewResearchCandidate(candidate,now).calculatedEv).toBeNull();
  });
});
