import type { RecoveryPreview } from './recovery';
import { previewFinancialReview } from './calculations';
import { describeEligibility, reviewWarningsForRow } from './review-warnings';
import type { CombinedRecoveryPreview } from './paper-supplement';

const cell = (value: unknown): string => {
  if (value === null || value === undefined) return 'Unknown (null)';
  return (typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll('|','\\|').replaceAll('\r','').replaceAll('\n','<br>');
};
const jsonBlock = (value: unknown): string => {
  const content = typeof value === 'string' ? value : JSON.stringify(value,null,2);
  const longest = Math.max(2,...(content.match(/`+/g)??[]).map(run=>run.length));
  const fence='`'.repeat(longest+1);
  return `${fence}json\n${content}\n${fence}`;
};
export const recoveryRowFinancialReview=previewFinancialReview;

/** Complete local review artifact. No approval token, persistence call or import payload. */
export function recoveryPreviewJson(result: RecoveryPreview): string {
  return JSON.stringify({ reportType:'edgelab.recovery-preview',version:1,previewOnly:true,hostedWritesPerformed:false,
    commitAllowed:false,...result,
    reviewClassification:result.preview.rows.map(row=>({rowNumber:row.rowNumber,reference:row.snapshot.externalId,eligibility:describeEligibility(row),warnings:reviewWarningsForRow(row)})),
    financialReadiness:result.preview.rows.filter(row=>row.snapshot.kind==='actual').map(row=>({
      rowNumber:row.rowNumber,sourceFieldsComplete:recoveryRowFinancialReview(row)?.bet!==null,
      financialRegistrationApproved:false,issues:recoveryRowFinancialReview(row)?.issues??[],
    })),
  },null,2)+'\n';
}
export function recoveryPreviewMarkdown(result: RecoveryPreview): string {
  const preview=result.preview; const combined='paperReconciliation' in result?result as CombinedRecoveryPreview:null;
  const lines=[
    '# EdgeLab recovery import preview',
    '', 'Status: **local review only; no import approved or performed**.',
    '', `Source: ${cell(preview.sourceName)}`,`SHA-256: ${preview.sourceHash}`,
    '', 'Original recovery text and source rows are retained below. The source approval flags are not authorization to write. All mapped records remain unverified. No unidentified paper records, funding transactions, current results or placed Day 6 bets are invented.',
    '', '## Categories', '', '| Category | Identified rows |','| --- | --- |',
    ...Object.entries(result.summary).map(([key,value])=>`| ${cell(key)} | ${cell(value)} |`),
    '', combined?`${combined.paperReconciliation.total} historical papers are individually described: ${combined.paperReconciliation.settledWins} source-reported wins, ${combined.paperReconciliation.settledLosses} losses and ${combined.paperReconciliation.unresolved} unresolved at source time. Seven secondary-summary records provisionally fill the original aggregate gap; this is not independent verification.`:'Unidentified historical papers remain an aggregate gap only, not invented rows.',
    '', 'Day 6 proposals have null kind, outcome and committed stake; proposed values remain in original source metadata.',
    ...(combined?['', '## Combined paper reconciliation', '',jsonBlock(combined.paperReconciliation),'', '## Supplement source and duplicate comparison', '',jsonBlock({source:combined.supplementMetadata,matches:combined.matches,excludedDuplicates:combined.excludedDuplicates})]:[]),
    '', '## Financial reconciliation', '', jsonBlock(result.reconciliation),
    '', 'Known stake/return arithmetic is independent of ledger eligibility. Missing original dates, event/leg details or provenance block financial registration; they must not turn a known A$30 source total into a misleading A$0. Paper/proposal values never affect actual bankroll. Allocated balance is not proof of deposits or a bookmaker balance.',
    '', '## Global warnings and validation', '',
    ...result.globalIssues.map(issue=>`- **${issue.severity.toUpperCase()} · ${cell(issue.code)} · ${cell(issue.field)}:** ${cell(issue.message)}`),
    '', '## Information still needed from the original source', '',
    ...result.missingRecovery.map(item=>`- ${cell(item)}`),
    '', '## Duplicate review', '',
    `Existing workspace records compared: **${result.existingRecordsCompared?'yes, supplied snapshot only':'no — no authenticated workspace snapshot supplied'}**.`,
    'Within-file comparisons are included per row. Missing event identifiers and original timestamps weaken identity. A lack of detected matches is not proof that historical selections are unique. Uncertain records must not be merged automatically.',
    '', '## Complete mapped row review',
  ];
  for(const row of preview.rows){
    const group=result.categories.find(item=>item.rowNumber===row.rowNumber);
    const financial=recoveryRowFinancialReview(row);
    lines.push('',`### Row ${row.rowNumber} · ${cell(group?.category??'unknown category')} · ${cell(row.snapshot.selection)}`,
      '', 'Source/category metadata:', '',jsonBlock(group),
      '', '| Normalized field | Proposed value |','| --- | --- |',
      ...Object.entries(row.snapshot).filter(([key])=>key!=='legs').map(([key,value])=>`| ${cell(key)} | ${cell(value)} |`));
    if(row.snapshot.legs.length){
      lines.push('','Individual selections:','',jsonBlock(row.snapshot.legs));
    }
    lines.push('','Eligibility and classified review warnings:','',jsonBlock({eligibility:describeEligibility(row),warnings:reviewWarningsForRow(row)}));
    lines.push('','All row validation issues:','',...(row.issues.length?row.issues.map(issue=>`- **${issue.severity.toUpperCase()} · ${cell(issue.code)} · ${cell(issue.field)}:** ${cell(issue.message)}`):['- None reported.']));
    lines.push('','Duplicate matches:','',...(row.duplicates.length?row.duplicates.map(item=>`- **${item.level}:** ${cell(item.reason)} (reference ${cell(item.recordId)})`):['- No matches detected in the compared data; incomplete identity remains a limitation.']));
    if(financial)lines.push('','Financial registration readiness: **not approved**. Source completeness checks:','',...(financial.issues.length?financial.issues.map(issue=>`- ${cell(issue.field)}: ${cell(issue.message)}`):['- Required source fields pass validation, but this preview does not authorize registration.']));
    lines.push('','Original source row:','',jsonBlock(row.raw),'','Every transformation:','',jsonBlock(row.transformations));
  }
  lines.push('','## Unidentified aggregate metadata','',jsonBlock(result.unidentifiedAggregate),'','## Original recovery source','',jsonBlock(preview.rawSource),'','No Supabase request, migration, financial registration or record commit is performed by this report.');
  return lines.join('\n')+'\n';
}
