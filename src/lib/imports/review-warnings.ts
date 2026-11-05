import type { ImportIssue, ImportPreviewRow } from './types';
import { previewFinancialReview } from './calculations';
export type ReviewWarningClass='blocking'|'requires_review'|'informational';
export const REVIEW_WARNING_LABELS={blocking:'Blocking',requires_review:'Requires review',informational:'Informational'} as const;
export interface ClassifiedIssue { issue:ImportIssue; classification:ReviewWarningClass; label:string; impact:string; origin:'source'|'financial'|'duplicate'; }
export function classifyImportIssue(row:ImportPreviewRow,issue:ImportIssue):ClassifiedIssue {
  let classification:ReviewWarningClass='requires_review';
  if(issue.severity==='error'||issue.code==='financial_confirmation_blocked')classification='blocking';
  else if(row.snapshot.kind==='actual'&&(issue.code==='missing_financial_information'||['placedAt','settledAt','stakeCents','stakeType','odds','strategy'].includes(issue.field)||/^legs\.\d+\.(event|sport|participant|market|selection|line|odds|outcome)$/.test(issue.field)))classification='blocking';
  else if(['recovery_preview_only','explicit_approval_required','proposals_not_registered','unregistered_day6_proposal','distinct_historical_proposal'].includes(issue.code)||['externalId','eventId','marketId','statistic'].includes(issue.field)||(['modelVersion','probabilitySource','probabilityMethod'].includes(issue.field)&&row.snapshot.probability===null))classification='informational';
  return {issue,classification,label:REVIEW_WARNING_LABELS[classification],origin:'source',impact:classification==='blocking'?(row.snapshot.kind==='actual'?'Prevents actual financial registration.':'Structural errors/exact duplicates must be resolved before archival import.'):classification==='requires_review'?'Retain as unverified review evidence; exclude unsupported financial/forecast metrics.':'Optional metadata or a separation/approval notice; no facts are inferred.'};
}
export function reviewWarningsForRow(row:ImportPreviewRow){
  const items:ClassifiedIssue[]=row.issues.map(issue=>classifyImportIssue(row,issue));
  const financial=previewFinancialReview(row);
  if(financial)for(const issue of financial.issues)if(!items.some(item=>item.issue.field===issue.field&&item.classification==='blocking'))items.push({...classifyImportIssue(row,issue),origin:'financial'});
  for(const duplicate of row.duplicates){const issue:ImportIssue={field:'duplicate',severity:duplicate.level==='exact'?'error':'warning',code:`${duplicate.level}_duplicate`,message:duplicate.reason};items.push({...classifyImportIssue(row,issue),origin:'duplicate'});}
  return {items,groups:{blocking:items.filter(i=>i.classification==='blocking'),requires_review:items.filter(i=>i.classification==='requires_review'),informational:items.filter(i=>i.classification==='informational')}};
}
export function describeEligibility(row:ImportPreviewRow){
  const {groups}=reviewWarningsForRow(row);const marker=row.transformations.some(t=>['recovery_mapping_v1','paper_supplement_mapping_v1'].includes(t.rule));
  const proposal=row.transformations.some(t=>t.rule==='recovery_mapping_v1'&&t.normalized!==null&&typeof t.normalized==='object'&&'category' in t.normalized&&typeof t.normalized.category==='string'&&t.normalized.category.startsWith('day6_'));
  return {archive:marker?'review_only':row.issues.some(i=>i.severity==='error')||row.duplicates.some(d=>d.level==='exact')?'blocked':'manual_confirmation_required',financial:row.snapshot.kind!=='actual'?'not_applicable':groups.blocking.length?'blocked':'separate_confirmation_required',verifiedForecast:'not_independently_verified' as const,recordClass:proposal?'research_proposal':row.snapshot.kind==='actual'&&groups.blocking.length?'blocked_financial':'historical_review'};
}
