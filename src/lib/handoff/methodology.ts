import { z } from 'zod';
import type { Mode } from '@/lib/domain/types';
import type { HistoricalWorkspace, ImportPreview, VerificationStatus } from '@/lib/imports/types';
import { parseHistoricalSource } from '@/lib/imports/parser';
import { sha256 } from '@/lib/imports/duplicates';

const nonblank = (maximum: number) => z.string().min(1).max(maximum).refine(value => value.trim().length > 0, 'Text cannot be only whitespace.');
const day = z.number().int().min(0).max(1000000).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use an exact valid calendar date.').nullable();
const hash = z.string().regex(/^[a-f0-9]{64}$/);

/** A methodology is policy text supplied/reviewed by the owner, never evidence of betting advantage. */
export const methodologyDocumentSchema = z.object({
  format: z.literal('edgelab.experiment-methodology'), version: z.literal(1),
  documentId: z.literal('sports-betting-experiment'), revision: z.number().int().min(1).max(1000000),
  title: nonblank(200), text: nonblank(20000),
  originalText: nonblank(50000).nullable(),
  sourceReferences: z.array(nonblank(2000)).min(1).max(50),
  supersedesHash: hash.nullable(), approvalStatus: z.enum(['proposed','owner_approved']),
}).strict();
export type ExperimentMethodology = z.infer<typeof methodologyDocumentSchema>;

export const PROPOSED_EXPERIMENT_METHODOLOGY: Readonly<ExperimentMethodology> = Object.freeze({
  format: 'edgelab.experiment-methodology', version: 1, documentId: 'sports-betting-experiment', revision: 1,
  title: 'Sports Betting Experiment methodology',
  text: [
    'Scope and operating boundaries',
    '- Research NBA and Australian NBL basketball, and ATP and WTA tennis. Sportsbet is the primary bookmaker research context; this does not establish available prices, market coverage or a verified account balance.',
    '- Preserve the lifetime A$500 funding cap, with no reload beyond that cap. Generally use A$5 exploratory stakes; this is the existing usual stake, not a fabricated per-entry restriction or deposit.',
    '- Use Track A — High Probability (likely outcomes without equating probability with positive EV), Track B — Potential Value (attributable prices versus independent forecasts, preserving disagreements), and Track C — Alternative Markets (props, spreads, handicaps, totals, alternate thresholds, singles and same-game multis).',
    '- Preserve original strategy classifications, including mixed Track A/B labels. If the application schema permits only one track, retain the original mixed label separately in immutable source/provenance and flag classification mapping for review; never silently change it to a single track.',
    '- Do not increase stakes to recover losses. Do not force daily wagering or a paper quota. NO BET and source-backed passes are valid research outcomes.',
    '',
    'Evidence and forecasting',
    '- High probability alone does not imply positive expected value. Use attributable original decimal odds, exact market identities and source timestamps. Never invent available bookmaker odds or missing player statistics.',
    '- Record the bookmaker-implied break-even probability as 1 / original decimal odds for a standard win/loss market. Where appropriate, compare with de-vig market probabilities using a complete set of comparable, mutually exclusive and exhaustive outcome prices; document the method, quote timing and assumptions. Do not call a raw implied probability a fair probability or invent missing prices to remove the margin.',
    '- Numerical forecasts require independent, attributable forecasting methods: documented deterministic calculations or external forecasts with original source, method, model/version and time. Unsupported LLM-generated probabilities are not independent model forecasts; keep missing estimates null.',
    '- Calculate expected value only when both the original odds and probability estimate have defensible provenance and the calculation matches the payout and settlement terms. Otherwise keep estimated EV null and flag the missing evidence for review.',
    '- Record uncertainty, assumptions, sample limitations and model disagreements. A source link or owner review is provenance, not independent verification.',
    '',
    'Research methods and model validation',
    '- Possible NBA/NBL research methods include team ratings, player minutes and usage, injury and rotation effects, game pace and context, and player-statistical distributions.',
    '- Possible ATP/WTA research methods include surface-adjusted Elo, serve and return performance, match conditions and rest, and model disagreement. These are approaches to investigate, not claims that any of these models are already implemented or validated in EdgeLab.',
    '- Validate models with time-ordered out-of-sample testing, using only information available at the forecast time. Track model/version, data provenance, evaluation periods, sample size and uncertainty; do not tune a model on its reported evaluation outcomes.',
    '- Compare forecasting performance against bookmaker-based baselines, distinguishing raw implied probabilities from de-vig baselines where available. Report Brier score, log loss and calibration when valid probabilities and outcomes exist, with sample-size and uncertainty reporting. Do not fabricate missing forecasts or claim an advantage from insufficient evidence.',
    '- Keep hit rate, probability calibration and profitability separate: a high hit rate does not establish calibrated probabilities or positive ROI. Use attributable original prices, cash/bonus payout terms and eligible samples for the corresponding evaluation.',
    '',
    'Paper research integrity',
    '- Preserve all pre-registered research hypotheses. Retain both successful and unsuccessful candidates, including rejected cash candidates, passed candidates and NO BET decisions, with their original rationale and source evidence. Assess paper performance using original recorded odds; comparison quotes never overwrite original forecasts.',
    '- Pre-register eligible paper forecasts before outcomes. If original timing or pre-event registration cannot be established, retain historical proposals in the review archive; never retrospectively promote a proposal into a qualifying forecast. Keep original predictions, odds, timestamps and provenance immutable. Record event dates separately from research creation, prediction, quote and settlement timestamps. Unknown original facts remain null.',
    '- Record a hypothetical A$5 stake where applicable to a newly pre-registered paper position, together with individual selection and parlay-leg outcomes. Preserve any explicitly sourced historical stake; leave missing historical stakes null rather than applying the usual stake retrospectively. Hypothetical paper P/L remains separate from actual cash P/L.',
    '',
    'Records, evaluation and review',
    '- Keep cash wagers, bonus bets and cash winnings, paper predictions, funding transactions, payouts and hypothetical returns separate. Paper results never affect actual bankroll or financial ROI. A funding cap or modelled allocation is not a deposit or verified bookmaker balance.',
    '- Preserve exact event/market/selection/threshold identities and every individual parlay leg, including original leg odds where known and separately recorded final statistics/outcomes. Never infer missing legs, prices or timestamps from a summary.',
    '- Track closing line value (CLV), calibration, Brier scores and ROI when the necessary attributable prices, timestamps, probabilities and outcomes are present. Show missing data or insufficient samples; do not infer a statistical advantage. CLV is an evaluation objective, not a claim that a live closing-price feed exists.',
    '- CLV comparisons require identical markets, selections, thresholds and settlement terms for the same event and participant. Preserve the original and closing quotes and their source timestamps separately; flag incompatible identities or terms rather than calculating a misleading comparison.',
    '- Do not assume independence between same-game multi legs. Record the actual quoted SGM price separately from any theoretical combined price, identifying its method and correlation assumptions; a product of leg prices is not evidence of an available SGM quote or a valid joint probability.',
    '- Distinguish verified database facts, owner-attested source records, unverified historical archives, owner-reported checkpoints, unresolved historical predictions and unregistered proposals. Aggregate checkpoints never create individual bets or predictions.',
    '- Preserve actual/paper source relationships. A former paper proposal linked to an owner-confirmed actual placement does not establish an independent paper position without distinct registration evidence.',
    '',
    'Manual control and cost',
    '- Register an actual wager only after the owner separately confirms a bet placed manually outside EdgeLab. Research proposals and paper approvals never place or automatically register a real wager.',
    '- Never access bookmaker accounts or credentials, scrape bookmakers, or execute wagers. No automatic bookmaker account access or wagering is permitted.',
    '- The current EdgeLab MVP operates at A$0 additional cost. Paid APIs, infrastructure or subscriptions require separate explicit owner approval. Any future infrastructure upgrades must not automatically change the betting experiment\'s funding cap, staking rules or methodology.',
    '- The copy/paste research handoff requires no paid API, OpenAI API key, paid subscription or background service. This proposed document does not approve any spending.',
    '',
    'Source completeness',
    '- This draft reconstructs the explicit requirements supplied by the owner. It does not claim to contain the full original conversation methodology. Preserve any subsequently supplied original text verbatim and review proposed revisions before approval; do not silently replace original rules.',
  ].join('\n'),
  originalText: null,
  sourceReferences: ['Owner-supplied EdgeLab research continuity requirements, 4 November 2026; full original conversation methodology not supplied','Owner-supplied Day 6 continuation and methodology requirements, 5 November 2026; reconstructed policy, not the exact original transcript','Owner-requested Revision 1 refinements, 5 November 2026: market benchmarking, model validation, paper integrity, CLV/SGM correlation, mixed strategy labels and explicit future cost approval; formal methodology approval still pending'],
  supersedesHash: null, approvalStatus: 'proposed',
});

/** Stable content hash excludes approval status, so approval never rewrites the proposed policy. */
export async function methodologyContentHash(document: ExperimentMethodology): Promise<string> {
  const parsed = methodologyDocumentSchema.parse(document);
  const { approvalStatus, ...content } = parsed;
  void approvalStatus;
  return sha256(JSON.stringify(content));
}

export function formatMethodologyMarkdown(document: ExperimentMethodology): string {
  const d = methodologyDocumentSchema.parse(document);
  return [`# ${d.title}`, '', `Document: ${d.documentId} · schema ${d.version} · revision ${d.revision}`, '',
    `Status: ${d.approvalStatus === 'proposed' ? 'PROPOSED — not approved or saved' : 'Owner approved — not independently verified'}.`,
    'Full original methodology: '+(d.originalText === null ? 'not available; this document is a reconstructed proposal.' : 'supplied source text is preserved below; completeness requires separate owner attestation.'),
    '', d.text, '', '## Source references', '', ...d.sourceReferences.map(ref=>`- ${ref}`),
    ...(d.originalText===null?[]:['','## Original methodology text — retained verbatim','',d.originalText]),
    '', 'Approval is separate from confirming a completed research day, verifying historical claims, importing records or registering an actual wager.', '',
  ].join('\n');
}

export const experimentContextV2Schema = z.object({
  format: z.literal('edgelab.experiment-context'), version: z.literal(2), contextId: z.string().uuid(),
  ownerReportedDay: day, sourceConfirmedCompletedDay: day,
  sourceConfirmedDayReference: nonblank(2000).nullable(),
  researchCreationDate: date, eventDate: date,
  methodology: methodologyDocumentSchema.nullable(), methodologyHash: hash.nullable(),
  methodologyApprovalConfirmed: z.boolean(), rulesCompleteConfirmed: z.boolean(),
  sourceReference: nonblank(2000), confirmed: z.literal(true), recordedAt: z.string().datetime({offset:true}),
}).strict().superRefine((value,ctx)=>{
  const reject=(field:string,message:string)=>ctx.addIssue({code:'custom',path:[field],message});
  if(value.sourceConfirmedCompletedDay!==null&&value.sourceConfirmedDayReference===null)reject('sourceConfirmedDayReference','A source-confirmed completed day requires its explicit evidence reference. Owner-reported days alone are not confirmation.');
  if(value.sourceConfirmedCompletedDay===null&&value.sourceConfirmedDayReference!==null)reject('sourceConfirmedCompletedDay','A completed-day evidence reference must identify an explicit source-confirmed day.');
  if(value.methodology!==null&&(!value.methodologyApprovalConfirmed||value.methodology.approvalStatus!=='owner_approved'||value.methodologyHash===null))reject('methodologyApprovalConfirmed','Saving methodology requires explicit owner approval and its immutable content hash.');
  if(value.methodology===null&&(value.methodologyHash!==null||value.methodologyApprovalConfirmed))reject('methodology','Methodology approval cannot refer to an absent document.');
  if(value.rulesCompleteConfirmed&&value.methodology?.originalText===null)reject('rulesCompleteConfirmed','Approving a reconstructed methodology does not establish the complete original rule set. Supply the original text before a separate completeness attestation.');
  if(value.rulesCompleteConfirmed&&value.methodology===null)reject('rulesCompleteConfirmed','Full original rules cannot be confirmed without supplied methodology text.');
  if(value.ownerReportedDay===null&&value.sourceConfirmedCompletedDay===null&&value.methodology===null)reject('context','Provide an owner report, a source-confirmed day or explicitly approved methodology.');
});
export type ExperimentContextV2 = z.infer<typeof experimentContextV2Schema>;
export interface ExperimentContextV2Input {
  ownerReportedDay:number|null;sourceConfirmedCompletedDay:number|null;sourceConfirmedDayReference:string|null;
  researchCreationDate:string|null;eventDate:string|null;
  methodology:ExperimentMethodology|null;sourceReference:string;verification:VerificationStatus;confirmed:true;
  methodologyApprovalConfirmed?:boolean;rulesCompleteConfirmed?:boolean;
}

/** Prepare an append-only journal preview. This function never writes to local or hosted storage. */
export async function prepareExperimentContextV2Preview(input:ExperimentContextV2Input):Promise<ImportPreview>{
  if(input.methodology!==null&&!input.methodologyApprovalConfirmed)throw new Error('Review the proposed methodology and explicitly approve it before preparing a saved journal entry.');
  const document=input.methodology===null?null:methodologyDocumentSchema.parse({...input.methodology,approvalStatus:'owner_approved'});
  const context=experimentContextV2Schema.parse({format:'edgelab.experiment-context',version:2,contextId:crypto.randomUUID(),ownerReportedDay:input.ownerReportedDay,sourceConfirmedCompletedDay:input.sourceConfirmedCompletedDay,sourceConfirmedDayReference:input.sourceConfirmedDayReference,researchCreationDate:input.researchCreationDate,eventDate:input.eventDate,methodology:document,methodologyHash:document===null?null:await methodologyContentHash(document),methodologyApprovalConfirmed:input.methodologyApprovalConfirmed??false,rulesCompleteConfirmed:input.rulesCompleteConfirmed??false,sourceReference:input.sourceReference,confirmed:input.confirmed,recordedAt:new Date().toISOString()});
  const rawSource=JSON.stringify(context,null,2);
  // Include the full context in parsing so existing recursive credential, Unicode,
  // nesting and size guards cover original text retained outside snapshot.notes.
  const preview=await parseHistoricalSource({text:JSON.stringify([{externalId:`context:${context.contextId}`,kind:null,event:'Experiment context journal',sourceReference:context.sourceReference,notes:document?`Owner-approved methodology revision ${document.revision}; full policy and original text retained in the immutable source.`:'Owner-reported/source-confirmed research day journal; no financial effect.',verification:input.verification,sourceDocument:context}]),sourceName:'experiment-context-journal-v2.json',format:'manual',verification:input.verification});
  preview.rawSource=rawSource;preview.sourceHash=await sha256(rawSource);preview.rows[0].raw=context;
  // sourceDocument is an intentionally mapped provenance container, not an
  // unknown input field requiring the user to map it a second time.
  preview.rows[0].issues=preview.rows[0].issues.filter(issue=>!(issue.field==='sourceDocument'&&issue.code==='unmapped_field'));
  preview.rows[0].transformations.unshift({field:'context',original:context,normalized:preview.rows[0].snapshot,rule:'owner_attested_experiment_context_journal_v2'});
  return preview;
}

export function isExperimentContextV2(value:unknown):value is ExperimentContextV2{return experimentContextV2Schema.safeParse(value).success;}
export function readExperimentContextV2(history:HistoricalWorkspace,mode:Mode):{context:ExperimentContextV2|null;recordId:string|null}{
  const classification=mode==='demo'?'synthetic':'user_confirmed';
  const records=history.records.map((record,index)=>({record,index})).filter(({record})=>record.snapshot.verification===classification).sort((a,b)=>b.record.importedAt.localeCompare(a.record.importedAt)||b.index-a.index);
  for(const {record}of records){const parsed=experimentContextV2Schema.safeParse(record.raw);if(parsed.success)return{context:parsed.data,recordId:record.id};}
  return{context:null,recordId:null};
}

/** Prepare a new revision; the previous document is never changed or re-approved implicitly. */
export async function proposeMethodologyRevision(current:ExperimentMethodology,changes:Partial<Pick<ExperimentMethodology,'title'|'text'|'originalText'|'sourceReferences'>>):Promise<ExperimentMethodology>{
  const previous=methodologyDocumentSchema.parse(current);
  if(previous.originalText!==null&&changes.originalText===null)throw new Error('Retain the previously supplied original methodology text; do not silently clear it in a revision.');
  return methodologyDocumentSchema.parse({...previous,...changes,revision:previous.revision+1,supersedesHash:await methodologyContentHash(previous),approvalStatus:'proposed'});
}

/** A newer day-only journal must not hide an earlier approved methodology. */
export function readApprovedMethodology(history:HistoricalWorkspace,mode:Mode):{document:ExperimentMethodology;hash:string;recordId:string}|null{
  const classification=mode==='demo'?'synthetic':'user_confirmed';
  const records=history.records.map((record,index)=>({record,index})).filter(({record})=>record.snapshot.verification===classification).sort((a,b)=>b.record.importedAt.localeCompare(a.record.importedAt)||b.index-a.index);
  for(const {record}of records){const parsed=experimentContextV2Schema.safeParse(record.raw);if(parsed.success&&parsed.data.methodology!==null&&parsed.data.methodologyHash!==null)return{document:parsed.data.methodology,hash:parsed.data.methodologyHash,recordId:record.id};}
  return null;
}
