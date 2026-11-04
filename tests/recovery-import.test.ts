import { describe, expect, it } from 'vitest';
import { mapRecoverySource, isRecoverySource, guardRecoveryPreviewMapping, recoveryRowInfo } from '@/lib/imports/recovery';
import { sha256 } from '@/lib/imports/duplicates';
import { reviseImportRow } from '@/lib/imports/parser';
import type { HistoricalRecord } from '@/lib/imports/types';

// Entirely invented local fixtures. No actual recovery file or personal history is embedded here.
function fixture() {
  const actual = [
    { reference:'TEST-B1',sport:'NBA',selection_text:'SYNTHETIC two-leg win',stake_aud:10,stake_type:'cash',combined_decimal_odds:2.5,reported_outcome:'won',reported_cash_return_aud:25,reported_cash_pnl_effect_aud:15 },
    ...[2,3,4,5].map(index=>({reference:`TEST-B${index}`,sport:'NBA',selection_text:`SYNTHETIC loss ${index}`,stake_aud:5,stake_type:'cash',combined_decimal_odds:2+index/10,reported_outcome:'lost',reported_cash_return_aud:0,reported_cash_pnl_effect_aud:-5})),
    { reference:'TEST-B6',sport:'NBA',selection_text:'SYNTHETIC bonus win',stake_aud:5,stake_type:'bonus',combined_decimal_odds:1.86,reported_outcome:'won',reported_cash_return_aud:4.3,reported_cash_pnl_effect_aud:4.3 },
  ].map((row,index)=>({...row,record_type:'actual_wager',source_location:{line:index+1,excerpt:`SYNTHETIC source row ${index+1}`},event:null,bookmaker:'SYNTHETIC TEST BOOK',bet_placed_at:null,settled_at:null,verified_original_ticket:false,approved_to_import:false,legs:[{participant:`SYNTHETIC player ${index+1}`,market:'points',selection:'at_least',line:20,outcome:null,statistic:null}]}));
  const paper = [1.22,1.41,2.26,2.51].map((odds,index)=>({record_type:'historical_paper_prediction',sport:'ATP',selection_text:`SYNTHETIC settled paper ${index+1}`,decimal_odds:odds,hypothetical_stake_aud:5,reported_outcome:'won',reported_score:'SYNTHETIC final score',hypothetical_pnl_aud_if_won:[1.1,2.05,6.3,7.55][index],original_prediction_at:null,independent_probability:null,source_location:{line:index+20,excerpt:`SYNTHETIC paper source ${index}`},verified_original_registration:false,approved_to_import:false}));
  const unresolved=[1.33,2.34,1.92,1.53].map((odds,index)=>({...paper[0],selection_text:`SYNTHETIC unresolved paper ${index+1}`,decimal_odds:odds,reported_outcome:'pending',reported_score:null,hypothetical_pnl_aud_if_won:null,source_location:{line:index+30,excerpt:`SYNTHETIC pending source ${index}`}}));
  return {
    file_purpose:'SYNTHETIC recovery staging fixture only; never hosted data',import_approved:false,
    source:{type:'synthetic_fixture',filename:'SYNTHETIC excerpt.txt',sha256:'a'.repeat(64),source_report_as_of:'2026-11-04T11:30:00+11:00',not_full_transcript:true,not_bookmaker_verified:true},
    checkpoint:{total_wagers_including_bonus:6,cash_wagers:5,bonus_wagers:1,actual_record:{won:2,lost:4,pending:0},cash_stakes_aud:30,cash_bet_gross_returns_aud:25,bonus_winnings_cash_return_aud:4.3,cash_bet_only_roi_pct:-16.6666666667,cash_pnl_excluding_promotions_aud:-5,modelled_cash_pnl_including_bonus_returns_aud:-0.7,modelled_allocation_aud:499.3,paper_summary:{settled_wins:8,settled_losses:3,unresolved:4,total_historical_predictions:15,individual_settled_wins_identified_in_excerpt:4,individual_other_settled_records_missing:7,individual_unresolved_records_identified:4}},
    reported_actual_wagers_pending_ticket_verification:actual,
    historical_paper_predictions_identified_settled:paper,
    historical_paper_predictions_identified_unresolved_at_source_time:unresolved,
    historical_paper_predictions_unidentified:{count:7,known_aggregate_outcomes:{won:4,lost:3},note:'SYNTHETIC aggregate; no placeholder rows'},
    upcoming_research_proposals_not_registered:{research_date_local:'2026-11-05',cash_proposals:[{id:'TEST-PROP-1',sport:'NBA',selection_text:'SYNTHETIC proposed cash one',strategy:'A/B',odds_snapshot:1.4,stake_proposal_aud:5,status:'conditional_research_only_not_placed',source_location:{line:40,excerpt:'SYNTHETIC proposal 1'}},{id:'TEST-PROP-2',sport:'WTA',selection_text:'SYNTHETIC proposed cash two',strategy:'B',odds_snapshot:1.66,stake_proposal_aud:5,status:'conditional_research_only_not_placed',source_location:{line:41,excerpt:'SYNTHETIC proposal 2'}}],paper_proposals:[1,2,3,4,5].map(index=>({id:`TEST-PAPER-PROP-${index}`,sport:'NBL',selection_text:`SYNTHETIC paper proposal ${index}`,strategy:index===1?'A/B':'C',odds_snapshot:2,hypothetical_stake_aud:5,status:'proposed_paper_not_confirmed_registered',approved_to_import:false,source_location:{line:50+index,excerpt:`SYNTHETIC paper proposal ${index}`}}))},
  };
}
const map = (value=fixture(),existingRecords?:HistoricalRecord[])=>mapRecoverySource({text:JSON.stringify(value,null,2),sourceName:'SYNTHETIC-recovery.json',verification:'synthetic',...(existingRecords?{existingRecords}: {})});

describe('recovery staging preview adapter',()=>{
  it('recognizes the explicit staging format without claiming arbitrary research/exports',()=>{
    expect(isRecoverySource(fixture())).toBe(true);expect(isRecoverySource({records:[]})).toBe(false);expect(isRecoverySource([])).toBe(false);expect(isRecoverySource(null)).toBe(false);
  });
  it('maps 21 identified rows into six categories without seven invented predictions',async()=>{
    const result=await map();expect(result.summary).toEqual({total:21,actualCash:5,actualBonus:1,actualUnclassified:0,paperSettled:4,paperUnresolved:4,day6CashProposals:2,day6PaperProposals:5,unidentifiedNotCreated:7});
    expect(result.preview.rows.filter(r=>r.snapshot.kind==='actual')).toHaveLength(6);expect(result.preview.rows.filter(r=>r.snapshot.kind==='paper')).toHaveLength(8);expect(result.preview.rows.filter(r=>r.snapshot.kind===null)).toHaveLength(7);
    expect(result.unidentifiedAggregate).toEqual(fixture().historical_paper_predictions_unidentified);expect(result.existingRecordsCompared).toBe(false);
  });
  it('preserves exact source bytes/hash, raw objects and stable source line references',async()=>{
    const value=fixture();const raw='\uFEFF'+JSON.stringify(value,null,4)+'\n';const result=await mapRecoverySource({text:raw,sourceName:'SYNTHETIC.json',verification:'synthetic'});
    expect(result.preview.rawSource).toBe(raw);expect(result.preview.sourceHash).toBe(await sha256(raw));expect(result.preview.rows[0].raw).toEqual(value.reported_actual_wagers_pending_ticket_verification[0]);
    expect(result.preview.rows[0].snapshot.sourceReference).toBe(`chatgpt-excerpt-sha256:${'a'.repeat(64)}#/reported_actual_wagers_pending_ticket_verification/0:line-1`);
    expect(recoveryRowInfo(result.preview.rows[0])).toMatchObject({rowNumber:1,category:'actual_cash',reference:'TEST-B1',sourceLine:1,previewOnly:true,requiresExplicitApproval:true});
    expect(result.sourceMetadata.sourceHashIndependentlyVerified).toBe(false);
  });
  it('does not infer participants/events/markets/times or copy combined odds into original legs',async()=>{
    const result=await map();const actual=result.preview.rows[0].snapshot;
    expect(actual.odds).toBe(2.5);expect(actual.legs[0].odds).toBeNull();expect(actual.legs[0].outcome).toBeNull();expect(actual.legs[0].sport).toBe('NBA');expect(actual.legs[0].line).toBe('20');
    expect(actual.event).toBeNull();expect(actual.participant).toBeNull();expect(actual.market).toBeNull();expect(actual.placedAt).toBeNull();expect(actual.settledAt).toBeNull();
    expect(result.preview.rows[0].transformations.some(t=>t.rule==='inherit_explicit_record_sport_scope')).toBe(true);
  });
  it('retains exact source paper prices/results but does not invent cash stake classification or independent probabilities',async()=>{
    const result=await map();const paper=result.preview.rows[6].snapshot;
    expect(paper.odds).toBe(1.22);expect(paper.stakeCents).toBe(500);expect(paper.stakeType).toBeNull();expect(paper.probability).toBeNull();expect(paper.predictionAt).toBeNull();expect(paper.outcome).toBe('won');expect(paper.legs[0].statistic).toBe('SYNTHETIC final score');expect(paper.bookmaker).toBeNull();expect(paper.line).toBeNull();expect(paper.market).toBeNull();
    expect(result.preview.rows[10].snapshot.outcome).toBe('pending');expect(result.preview.rows[10].issues.some(i=>i.code==='pending_at_original_source_time')).toBe(true);
  });
  it('does not register Day 6 cash or paper proposals and retains ambiguous tracks as null',async()=>{
    const result=await map();for(const row of result.preview.rows.slice(14)){expect(row.snapshot.kind).toBeNull();expect(row.snapshot.outcome).toBeNull();expect(row.snapshot.stakeCents).toBeNull();expect(row.snapshot.stakeType).toBeNull();expect(row.snapshot.payoutCents).toBeNull();expect(row.snapshot.predictionAt).toBeNull();expect(row.snapshot.placedAt).toBeNull();}
    expect(result.preview.rows[14].snapshot.odds).toBe(1.4);expect(result.preview.rows[14].snapshot.strategy).toBeNull();expect(result.preview.rows[15].snapshot.strategy).toBe('B');expect(result.preview.rows[14].raw).toHaveProperty('stake_proposal_aud',5);
  });
  it('reconciles cash and bonus separately without funding or ledger eligibility inference',async()=>{
    const result=await map();expect(result.reconciliation).toMatchObject({cashStakeCents:3000,cashGrossReturnCents:2500,bonusFaceStakeCents:500,bonusCashReturnCents:430,cashOnlyPnlCents:-500,modelledPnlCents:-70,reportedAllocationCents:49930,actualBankrollCents:null,fundingInferred:false,proposedCashStakeCents:1000,proposedPaperHypotheticalStakeCents:2500});expect(result.reconciliation.cashOnlyRoiPercent).toBeCloseTo(-16.6666666667);expect(result.reconciliation.actualCounts).toEqual({cash:5,bonus:1,unknownStakeType:0,won:2,lost:4,pending:0,unknownOutcome:0});expect(result.reconciliation.comparisons.every(c=>c.status==='matches')).toBe(true);
  });
  it('reconciles known paper arithmetic separately even with unknown stake types',async()=>{
    const {reconciliation}=await map();expect(reconciliation.identifiedPaperStakeCents).toBe(2000);expect(reconciliation.identifiedPaperReportedHypotheticalProfitCents).toBe(1700);expect(reconciliation.identifiedPaperArithmeticGrossCents).toBe(3700);expect(reconciliation.identifiedPaperArithmeticProfitCents).toBe(1700);expect(reconciliation.unresolvedPaperHypotheticalStakeCents).toBe(2000);expect(reconciliation.modelledPnlCents).toBe(-70);
  });
  it('marks source approvals as non-authoritative and every row permanently preview-only',async()=>{
    const value=fixture();value.import_approved=true;value.reported_actual_wagers_pending_ticket_verification[0].approved_to_import=true;const result=await map(value);
    expect(result.sourceMetadata.importApproved).toBe(false);expect(result.globalIssues.some(i=>i.code==='source_approval_is_not_consent')).toBe(true);
    expect(result.preview.rows.every(row=>recoveryRowInfo(row)?.previewOnly===true)).toBe(true);
  });
  it('keeps seven unidentified outcomes aggregate-only when all identified arrays are empty',async()=>{
    const value=fixture();value.reported_actual_wagers_pending_ticket_verification=[];value.historical_paper_predictions_identified_settled=[];value.historical_paper_predictions_identified_unresolved_at_source_time=[];value.upcoming_research_proposals_not_registered.cash_proposals=[];value.upcoming_research_proposals_not_registered.paper_proposals=[];
    const result=await map(value);expect(result.preview.rows).toEqual([]);expect(result.summary.unidentifiedNotCreated).toBe(7);expect(result.unidentifiedAggregate?.known_aggregate_outcomes).toEqual({won:4,lost:3});
  });
  it('flags known-amount gaps without fabricating zero totals',async()=>{
    const value=fixture();delete (value.reported_actual_wagers_pending_ticket_verification[1] as Record<string,unknown>).stake_aud;
    const result=await map(value);expect(result.reconciliation.cashStakeCents).toBeNull();expect(result.reconciliation.knownCashStakeCents).toBe(2500);expect(result.reconciliation.cashStakeUnknownRows).toBe(1);expect(result.reconciliation.modelledPnlCents).toBeNull();
  });
  it('flags contradictory reported checkpoint, payout and paper profit without overwriting originals',async()=>{
    const value=fixture();value.checkpoint.cash_stakes_aud=31;value.reported_actual_wagers_pending_ticket_verification[0].reported_cash_return_aud=24;value.historical_paper_predictions_identified_settled[0].hypothetical_pnl_aud_if_won=9;
    const result=await map(value);expect(result.globalIssues.some(i=>i.code==='checkpoint_mismatch'&&i.severity==='error')).toBe(true);expect(result.globalIssues.some(i=>i.code==='paper_profit_mismatch')).toBe(true);expect(result.preview.rows[0].issues.some(i=>i.code==='payout_mismatch')).toBe(true);expect(result.preview.rows[0].snapshot.payoutCents).toBe(2400);expect(result.preview.rows[6].raw).toHaveProperty('hypothetical_pnl_aud_if_won',9);
  });
  it('keeps date-only source facts raw while normalized exact instants remain null',async()=>{
    const value=fixture();(value.reported_actual_wagers_pending_ticket_verification[0] as Record<string,unknown>).bet_placed_at='2026-01-01';
    const result=await map(value);expect(result.preview.rows[0].snapshot.placedAt).toBeNull();expect(result.preview.rows[0].raw).toHaveProperty('bet_placed_at','2026-01-01');expect(result.preview.rows[0].issues.some(i=>i.code==='date_without_exact_instant')).toBe(true);
  });
  it('finds exact repeated source rows and repeated cross-category selections without merging',async()=>{
    const value=fixture();value.reported_actual_wagers_pending_ticket_verification.push(structuredClone(value.reported_actual_wagers_pending_ticket_verification[0]));value.upcoming_research_proposals_not_registered.cash_proposals[0].selection_text=value.reported_actual_wagers_pending_ticket_verification[0].selection_text;
    const result=await map(value);expect(result.preview.rows[6].duplicates.some(d=>d.level==='exact')).toBe(true);const proposal=result.preview.rows.find(row=>recoveryRowInfo(row)?.reference==='TEST-PROP-1')!;expect(proposal.duplicates.some(d=>d.level==='probable')).toBe(true);expect(proposal.snapshot.kind).toBeNull();
  });
  it('flags changed-price repeated selections despite missing original event and market identifiers',async()=>{
    const value=fixture();value.historical_paper_predictions_identified_settled.push({...value.historical_paper_predictions_identified_settled[0],decimal_odds:1.3,hypothetical_pnl_aud_if_won:1.5});
    const result=await map(value);expect(result.preview.rows[10].duplicates.some(d=>d.level==='probable'&&d.recordId==='row:7')).toBe(true);
    const existing={id:crypto.randomUUID(),snapshot:{...result.preview.rows[6].snapshot,odds:1.4},fingerprint:'b'.repeat(64)} as HistoricalRecord;
    const compared=await map(fixture(),[existing]);expect(compared.preview.rows[6].duplicates.some(d=>d.level==='probable'&&d.recordId===existing.id)).toBe(true);
  });
  it('compares to explicitly supplied existing records without claiming an authenticated database read',async()=>{
    const first=await map();const row=first.preview.rows[0];const existing={id:crypto.randomUUID(),snapshot:row.snapshot,fingerprint:row.fingerprint} as HistoricalRecord;
    const result=await map(fixture(),[existing]);expect(result.existingRecordsCompared).toBe(true);expect(result.preview.rows[0].duplicates.some(d=>d.recordId===existing.id&&d.level==='exact')).toBe(true);
  });
  it('protects proposals and source categories through manual normalized-row corrections',async()=>{
    const result=await map();const proposal=result.preview.rows[14];const revised=await reviseImportRow(result.preview,proposal.rowNumber,{...proposal.snapshot,kind:'actual',stakeCents:500,stakeType:'cash',outcome:'pending'});
    expect(()=>guardRecoveryPreviewMapping(revised)).toThrow('Day 6 proposals');
    const changed=structuredClone(result.preview);changed.rows[6].snapshot.kind='actual';expect(()=>guardRecoveryPreviewMapping(changed)).toThrow('Historical paper');
    const cash=structuredClone(result.preview);cash.rows[0].snapshot.stakeType='bonus';expect(()=>guardRecoveryPreviewMapping(cash)).toThrow('cash and bonus');
  });
  it('does not silently elevate extraction to user-confirmed verification or rewrite original reference IDs',async()=>{
    const result=await map();result.preview.rows[0].snapshot.verification='user_confirmed';expect(()=>guardRecoveryPreviewMapping(result.preview)).toThrow('unverified');
    const other=await map();other.preview.rows[0].snapshot.externalId='invented';expect(()=>guardRecoveryPreviewMapping(other.preview)).toThrow('reference IDs');
  });
  it('rejects malformed/unsafe/unsupported input without repository or network access',async()=>{
    await expect(mapRecoverySource({text:'{broken',sourceName:'x.json'})).rejects.toThrow('Malformed');
    await expect(mapRecoverySource({text:'{"records":[]}',sourceName:'x.json'})).rejects.toThrow('not the supported');
    const unsafe={...fixture(),unsafe:{access_token:'never retain this fake token'}};await expect(mapRecoverySource({text:JSON.stringify(unsafe),sourceName:'x.json',verification:'synthetic'})).rejects.toThrow(/credentials|Credential/);
    const missing=fixture();(missing as Record<string,unknown>).reported_actual_wagers_pending_ticket_verification=null;await expect(mapRecoverySource({text:JSON.stringify(missing),sourceName:'x.json',verification:'synthetic'})).rejects.toThrow('explicit array');
    await expect(mapRecoverySource({text:'x'.repeat(1048577),sourceName:'x.json'})).rejects.toThrow('1 MiB');
  });
  it('flags contradictory source record types and section outcomes instead of converting records',async()=>{
    const value=fixture();const first=value.reported_actual_wagers_pending_ticket_verification[0] as Record<string,unknown>;first.record_type='historical_paper_prediction';first.reported_status='settled';first.reported_outcome='pending';
    value.historical_paper_predictions_identified_settled[0].reported_outcome='pending';value.historical_paper_predictions_identified_settled[1].record_type='actual_wager';value.historical_paper_predictions_identified_unresolved_at_source_time[0].reported_outcome='won';
    const result=await map(value);expect(result.preview.rows[0].issues.some(i=>i.code==='contradictory_record_type'&&i.severity==='error')).toBe(true);expect(result.preview.rows[0].issues.some(i=>i.code==='contradictory_settlement_status')).toBe(true);expect(result.preview.rows[0].snapshot.kind).toBe('actual');
    expect(result.preview.rows[6].issues.some(i=>i.code==='contradictory_paper_section')).toBe(true);expect(result.preview.rows[7].issues.some(i=>i.code==='contradictory_record_type')).toBe(true);expect(result.preview.rows[10].issues.some(i=>i.code==='contradictory_paper_section')).toBe(true);expect(result.preview.rows[10].snapshot.kind).toBe('paper');
  });
  it('compares supplied calculation summaries and preserves a stake differing from the typical value',async()=>{
    const value={...fixture(),experiment_rules:{typical_stake_aud:5},reconciliation_calculations:{cash_stakes_calc_aud:30,cash_returns_calc_aud:25,bonus_cash_returns_calc_aud:4.3,modelled_net_calc_aud:-0.7}};
    const result=await map(value);expect(result.reconciliation.comparisons.filter(c=>c.key.endsWith('_calc_aud')).every(c=>c.status==='matches')).toBe(true);expect(result.preview.rows[0].snapshot.stakeCents).toBe(1000);expect(result.preview.rows[0].issues.some(i=>i.code==='reported_stake_differs_from_typical')).toBe(true);
    value.reconciliation_calculations.modelled_net_calc_aud=0;const mismatch=await map(value);expect(mismatch.globalIssues.some(i=>i.field==='checkpoint.modelled_net_calc_aud'&&i.code==='checkpoint_mismatch')).toBe(true);
  });
  it('preserves honest synthetic/private classification',async()=>{
    await expect(mapRecoverySource({text:JSON.stringify(fixture()),sourceName:'x.json'})).rejects.toThrow('Synthetic fixture sources must retain');
    const value=fixture();value.source.type='user_pasted_conversation_excerpt';await expect(mapRecoverySource({text:JSON.stringify(value),sourceName:'x.json',verification:'synthetic'})).rejects.toThrow('real recovery data must remain unverified');
    const result=await mapRecoverySource({text:JSON.stringify(value),sourceName:'x.json'});expect(result.preview.rows.every(row=>row.snapshot.verification==='unverified')).toBe(true);
  });
});
