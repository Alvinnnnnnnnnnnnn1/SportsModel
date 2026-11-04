import { describe, expect, it } from 'vitest';
import { mapRecoverySource } from '@/lib/imports/recovery';
import { prepareImportCommit } from '@/lib/imports/commands';
import { reviseImportRow } from '@/lib/imports/parser';
import { recoveryPreviewJson, recoveryPreviewMarkdown, recoveryRowFinancialReview } from '@/lib/imports/recovery-report';
async function preview(){
 return mapRecoverySource({sourceName:'SYNTHETIC-recovery-review.json',verification:'synthetic',text:JSON.stringify({
  file_purpose:'SYNTHETIC local review only',import_approved:true,source:{type:'synthetic_fixture',filename:'SYNTHETIC excerpt.txt',sha256:'a'.repeat(64),source_report_as_of:'2026-01-01T00:00:00Z'},
  reported_actual_wagers_pending_ticket_verification:[{reference:'SYNTHETIC-A1',record_type:'actual_wager',sport:'NBA',selection_text:'SYNTHETIC winner',stake_type:'cash',stake_aud:5,combined_decimal_odds:2,reported_outcome:'won',reported_cash_return_aud:10,reported_cash_pnl_effect_aud:5,bookmaker:'SYNTHETIC TEST BOOK',source_location:{line:1,excerpt:'SYNTHETIC | source\nwith ```quoted``` text'},legs:[]}],
  historical_paper_predictions_identified_settled:[],historical_paper_predictions_identified_unresolved_at_source_time:[],
  historical_paper_predictions_unidentified:{count:7,known_aggregate_outcomes:{won:4,lost:3}},
  upcoming_research_proposals_not_registered:{cash_proposals:[{id:'SYNTHETIC-P1',sport:'NBA',selection_text:'SYNTHETIC future selection',odds_snapshot:2,stake_proposal_aud:5,status:'conditional_research_only_not_placed',source_location:{line:2,excerpt:'SYNTHETIC proposed; not placed'}}],paper_proposals:[],research_date_local:'2026-01-02'},
 })});
}
describe('complete recovery review and import lock',()=>{
 it('blocks source approval booleans and checked row decisions from becoming an import',async()=>{
  const result=await preview();expect(()=>prepareImportCommit(result.preview,result.preview.rows.map(row=>({rowNumber:row.rowNumber,include:true,acknowledgeIncomplete:true,allowProbableDuplicate:true})),'synthetic')).toThrow('preview-only');
 });
 it('keeps the lock after a manual source-row correction rather than dropping provenance',async()=>{
  const result=await preview();const revised=await reviseImportRow(result.preview,1,{...result.preview.rows[0].snapshot,event:'SYNTHETIC source-supported corrected event'});
  expect(()=>prepareImportCommit(revised,[{rowNumber:1,include:true,acknowledgeIncomplete:true,allowProbableDuplicate:true}],'synthetic')).toThrow('preview-only');
 });
 it('writes a complete JSON review with no approval or hosted-write claim and every warning',async()=>{
  const result=await preview();const json=JSON.parse(recoveryPreviewJson(result));
  expect(json).toMatchObject({previewOnly:true,commitAllowed:false,hostedWritesPerformed:false});
  expect(json.preview.rawSource).toBe(result.preview.rawSource);expect(json.preview.rows).toHaveLength(2);
  expect(json.preview.rows[0].issues).toEqual(result.preview.rows[0].issues);expect(json.globalIssues).toEqual(result.globalIssues);
  expect(json.unidentifiedAggregate.count).toBe(7);expect(json.financialReadiness[0]).toMatchObject({sourceFieldsComplete:false,financialRegistrationApproved:false});
 });
 it('shows all source mappings, unknowns, duplicate limitations and blocker details in Markdown',async()=>{
  const result=await preview();const markdown=recoveryPreviewMarkdown(result);
  for(const row of result.preview.rows){for(const issue of row.issues)expect(markdown).toContain(issue.code);expect(markdown).toContain(`Row ${row.rowNumber}`);}
  expect(markdown).toContain('Unknown (null)');expect(markdown).toContain('Original recovery source');expect(markdown).toContain('Original source row');expect(markdown).toContain('Every transformation');expect(markdown).toContain('no — no authenticated workspace snapshot supplied');expect(markdown).toContain('````json');
 });
 it('evaluates actual readiness without inventing missing timestamps and ignores proposal finances',async()=>{
  const result=await preview();expect(recoveryRowFinancialReview(result.preview.rows[0])?.bet).toBeNull();expect(recoveryRowFinancialReview(result.preview.rows[1])).toBeNull();
  expect(result.preview.rows[0].snapshot.placedAt).toBeNull();expect(result.preview.rows[1].snapshot.kind).toBeNull();expect(result.preview.rows[1].snapshot.stakeCents).toBeNull();expect(result.reconciliation.fundingInferred).toBe(false);
 });
});
