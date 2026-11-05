import { parseHistoricalSource } from './parser';
import { sha256,detectHistoricalDuplicates } from './duplicates';
import { mapRecoverySource,guardRecoveryPreviewMapping,recoveryRowInfo,type RecoveryPreview,type RecoveryRowInfo } from './recovery';
import type { HistoricalRecord,ImportIssue,ImportPreview } from './types';
type Obj=Record<string,unknown>;
const obj=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const warning=(field:string,code:string,message:string,severity:'warning'|'error'='warning'):ImportIssue=>({field,code,message,severity});
export interface SupplementMatch {reference:string|null;relatedReference:string;status:'exact_duplicate'|'probable_duplicate'|'distinct_historical_proposal';reason:string;}
export interface PaperSupplementPreview {preview:ImportPreview;categories:RecoveryRowInfo[];globalIssues:ImportIssue[];sourceMetadata:Obj;missingRecovery:string[];matches:SupplementMatch[];}
export interface CombinedRecoveryPreview extends RecoveryPreview {
 paperReconciliation:{total:number;settledWins:number;settledLosses:number;unresolved:number;expectedWins:number|null;expectedLosses:number|null;expectedUnresolved:number;matchesCheckpoint:boolean;secondarySourceRecords:number;remainingUnaccounted:number;verifiedForecasts:0;fullHypotheticalProfitCents:null;knownPrimaryPartialProfitCents:number|null;missingCombinedOdds:string[];missingStakes:number;};
 supplementMetadata:Obj;matches:SupplementMatch[];excludedDuplicates:{reference:string|null;reason:string}[];
 sourceManifests:{sourceName:string;sourceHash:string;rawSource:string}[];originalBaseSummary:RecoveryPreview['summary'];
}
export function isPaperSupplement(v:unknown):boolean{return obj(v)&&Array.isArray(v.paper_records)&&typeof v.file_purpose==='string';}
export function isCombinedRecovery(v:unknown):boolean{return obj(v)&&v.format==='edgelab.combined-recovery-review'&&Array.isArray(v.sources);}
export async function mapPaperSupplement(input:{text:string;sourceName:string;existingRecords?:HistoricalRecord[];verification?:'unverified'|'synthetic'}):Promise<PaperSupplementPreview>{
 if(new TextEncoder().encode(input.text).byteLength>1048576)throw new Error('Supplement exceeds 1 MiB.');
 let decoded:unknown;try{decoded=JSON.parse(input.text.replace(/^\uFEFF/,''));}catch{throw new Error('Malformed paper supplement JSON.');}
 if(!obj(decoded)||!isPaperSupplement(decoded))throw new Error('Unsupported historical paper supplement format.');
 const verification=input.verification??'unverified';
 if(verification==='synthetic'&&decoded.fixture_type!=='synthetic')throw new Error('Real paper supplements must remain unverified.');
 await parseHistoricalSource({text:JSON.stringify([{sourceReference:'supplement-safety',sourceDocument:decoded}]),format:'json',sourceName:input.sourceName,verification});
 const sourceHash=await sha256(input.text);const sourceRows=decoded.paper_records as unknown[];
 if(!sourceRows.length||sourceRows.length>500||sourceRows.some(v=>!obj(v)))throw new Error('Provide 1–500 explicit supplementary paper records.');
 const originals=sourceRows as Obj[];
 const categories:RecoveryRowInfo[]=originals.map((raw,index)=>({rowNumber:index+1,category:'paper_settled',sourcePointer:`/paper_records/${index}`,reference:typeof raw.external_review_id==='string'?raw.external_review_id:null,sourceLine:null,previewOnly:true,requiresExplicitApproval:true}));
 const mapped=originals.map((raw,index)=>{
  const rawLegs=Array.isArray(raw.legs)?raw.legs:[];
  const legs=rawLegs.map((value)=>{
   if(!obj(value))throw new Error('Each supplementary leg must be an explicit object.');
   const stat=value.actual_stat_reported;
   return {sport:raw.sport??null,eventId:raw.event_id??null,event:raw.event_name??null,participant:value.participant_reported??null,marketId:null,market:value.market_reported??null,selection:value.selection_reported??null,line:value.threshold??null,odds:value.individual_leg_odds??null,outcome:value.leg_outcome_reported??null,statistic:stat===undefined||stat===null?null:typeof stat==='number'||typeof stat==='string'?String(stat):null};
  });
  return {externalId:raw.external_review_id??null,kind:'paper',sport:raw.sport??null,eventId:raw.event_id??null,event:raw.event_name??null,participant:legs.length===1?legs[0].participant:null,market:legs.length===1?legs[0].market:null,marketId:null,selection:raw.description_reported??null,line:legs.length===1?legs[0].line:null,bookmaker:raw.bookmaker??null,odds:raw.reported_decimal_combined_odds??null,predictionAt:raw.original_prediction_timestamp??null,settledAt:null,placedAt:null,probability:raw.forecast_probability??null,probabilitySource:null,probabilityMethod:null,modelVersion:null,strategy:raw.strategy_track??null,stakeCents:null,stakeType:null,payoutCents:null,outcome:raw.reported_outcome??null,verification,sourceReference:`paper-supplement-sha256:${sourceHash}#record:${encodeURIComponent(String(raw.external_review_id??index))}`,notes:'Historical review archive: secondary conversation summary; source-reported result only. No independently verified original forecast, event result or stake.',legs};
 });
 const preview=await parseHistoricalSource({text:JSON.stringify(mapped),format:'json',sourceName:input.sourceName,verification,existingRecords:input.existingRecords});
 preview.rawSource=input.text;preview.sourceHash=sourceHash;
 for(const row of preview.rows){
  const raw=originals[row.rowNumber-1];row.raw=structuredClone(raw);
  row.transformations.unshift({field:'record',original:structuredClone(raw),normalized:structuredClone(row.snapshot),rule:'secondary_paper_summary_to_historical_review'});
  row.transformations.push({field:'supplementEvidence',original:null,normalized:{sourceHash,sourcePointer:categories[row.rowNumber-1].sourcePointer,researchDay:raw.research_day??null,evidenceTier:'secondary_summary_requires_source_review'},rule:'paper_supplement_mapping_v1'},{field:'recoveryMetadata',original:null,normalized:categories[row.rowNumber-1],rule:'recovery_mapping_v1'});
  row.issues.push(warning('source','secondary_summary_requires_review','Recovered from a previous conversation summary. Original pre-event registration and official result evidence remain unverified.'),warning('stakeCents','historical_stake_unknown','No original hypothetical stake was supplied. It remains null; the default stake is not substituted.'),warning('sport','sport_not_supplied','No explicit sport was supplied; player names do not establish a verified league/fixture.'),warning('predictionAt','original_forecast_time_unknown','Research day and summary dates are source labels, not original forecast timestamps. Exclude this record from verified forecast metrics.'));
  if(raw.bet_type!=='paper')row.issues.push(warning('kind','contradictory_supplement_type','A supplementary historical paper source cannot be classified as an actual wager.','error'));
  if(!['won','lost','void'].includes(String(raw.reported_outcome)))row.issues.push(warning('outcome','unsettled_supplement_record','This settled-paper supplement must contain an explicit settled source outcome.','error'));
  if(typeof raw.external_review_id!=='string'||!raw.external_review_id.trim())row.issues.push(warning('externalId','missing_supplement_reference','The original supplementary review identifier is required.','error'));
  if(typeof raw.review_warning==='string')row.issues.push(warning('source.review_warning','secondary_source_warning',raw.review_warning));
  for(const [i,leg]of row.snapshot.legs.entries()){
   const original=(raw.legs as Obj[])[i];const stat=original.actual_stat_reported,threshold=original.threshold;
   if(stat!==null&&stat!==undefined&&(typeof stat!=='number'||!Number.isFinite(stat)||stat<0))row.issues.push(warning(`legs.${i}.statistic`,'invalid_reported_statistic','Reported numerical statistics must be finite nonnegative values. Raw evidence is retained.','error'));
   if(typeof stat==='number'&&typeof threshold==='number'&&String(original.selection_reported).includes('+')&&['won','lost'].includes(String(leg.outcome))&&((stat>=threshold)!==(leg.outcome==='won')))row.issues.push(warning(`legs.${i}.outcome`,'statistic_outcome_conflict','Source statistic contradicts the stated at-least threshold/outcome. Do not silently correct it.','error'));
  }
 }
 guardRecoveryPreviewMapping(preview);
 return {preview,categories,globalIssues:[warning('source','secondary_summary_requires_review','All supplement records are secondary summary evidence, not verified original predictions.'),warning('approval','explicit_approval_required','No source flag authorizes import. This supplement is review-only and cannot affect cash, bonus, funding or bankroll.')],sourceMetadata:{sourceHash,sourceName:input.sourceName,primaryInput:decoded.primary_input??null,confidence:decoded.confidence??null,sourceEvidence:decoded.source_evidence??null,reviewConstraints:decoded.review_constraints??null,reportedReconciliation:decoded.reconciliation??null,previewOnly:true},missingRecovery:['Verify original registration, fixture/player identity, exact market and quote provenance against the original conversation/export.','Recover missing original stakes, sport/bookmaker, exact times, fixture IDs and three absent combined prices where actually recorded.','Retain the source-reported leg statistics/outcomes, but obtain official result evidence before treating them as verified outcomes.'],matches:[]};
}
export function combineRecoveryAndSupplement(input:{base:RecoveryPreview;supplement:PaperSupplementPreview;existingRecords?:HistoricalRecord[]}):Promise<CombinedRecoveryPreview>{return combine(input);}
async function combine({base,supplement,existingRecords}:{base:RecoveryPreview;supplement:PaperSupplementPreview;existingRecords?:HistoricalRecord[]}):Promise<CombinedRecoveryPreview>{
 const rows=structuredClone(base.preview.rows),categories=structuredClone(base.categories),excludedDuplicates:CombinedRecoveryPreview['excludedDuplicates']=[],matches:SupplementMatch[]=[];
 for(const sourceRow of supplement.preview.rows){
  const sourceDuplicates=detectHistoricalDuplicates(sourceRow.snapshot,sourceRow.fingerprint,[],rows);
  const exactSourceDuplicate=sourceDuplicates.find(d=>d.level==='exact');
  // Source coverage is independent of storage: keep evidence that is already archived,
  // but never count a repeated row inside this preview as another prediction.
  if(exactSourceDuplicate){excludedDuplicates.push({reference:sourceRow.snapshot.externalId,reason:'Exact source/selection identity already represented in this preview; original evidence is retained without another prediction row.'});matches.push({reference:sourceRow.snapshot.externalId,relatedReference:exactSourceDuplicate.recordId,status:'exact_duplicate',reason:exactSourceDuplicate.reason});continue;}
  const archivedDuplicates=detectHistoricalDuplicates(sourceRow.snapshot,sourceRow.fingerprint,existingRecords??[]).map(d=>d.level==='exact'?{...d,reason:`Already archived: ${d.reason} Retained only for complete source review; do not import another record.`}:d);
  const row=structuredClone(sourceRow);row.rowNumber=rows.length+1;row.duplicates=[...archivedDuplicates,...sourceDuplicates];
  for(const duplicate of archivedDuplicates.filter(d=>d.level==='exact')){
   matches.push({reference:row.snapshot.externalId,relatedReference:duplicate.recordId,status:'exact_duplicate',reason:duplicate.reason});
   row.issues.push(warning('duplicate','already_archived','This source record already exists in the authenticated archive. It remains in source-count reconciliation only; exact duplicates cannot be imported again.'));
  }
  const info={...supplement.categories[sourceRow.rowNumber-1],rowNumber:row.rowNumber};
  const marker=row.transformations.find(t=>t.rule==='recovery_mapping_v1')!;marker.normalized=info;
  for(const other of rows){
   if(other.snapshot.kind==='paper'&&other.snapshot.selection?.normalize('NFKC').toLowerCase()===row.snapshot.selection?.normalize('NFKC').toLowerCase()&&!row.duplicates.some(d=>d.recordId===`row:${other.rowNumber}`))row.duplicates.push({recordId:`row:${other.rowNumber}`,level:'probable',reason:'Repeated explicit historical selection with incomplete fixture/time identity; review without automatic merge.'});
   const metadata=recoveryRowInfo(other);const raw=obj(row.raw)?row.raw:{};
   if(metadata?.category.startsWith('day6_')&&/maxey/i.test(row.snapshot.selection??'')&&/maxey/i.test(other.snapshot.selection??'')&&String(raw.research_day)==='Day 4'){
    const reason=`Historical ${row.snapshot.externalId} is a source-reported Day 4 selection at ${row.snapshot.odds??'unknown price'}; ${other.snapshot.externalId} is a separate unregistered Day 6 proposal at ${other.snapshot.odds??'unknown price'}. Keep both sources distinct; fixture identity remains unverified.`;
    matches.push({reference:row.snapshot.externalId,relatedReference:other.snapshot.externalId??`row:${other.rowNumber}`,status:'distinct_historical_proposal',reason});row.issues.push(warning('identity','distinct_historical_proposal',reason));
   }
  }
  for(const duplicate of row.duplicates.filter(d=>d.level==='probable'))matches.push({reference:row.snapshot.externalId,relatedReference:duplicate.recordId,status:'probable_duplicate',reason:duplicate.reason});
  rows.push(row);categories.push(info);
 }
 const primaryRows=rows.filter(row=>!row.transformations.some(t=>t.rule==='paper_supplement_mapping_v1'));
 const primarySettled=primaryRows.filter(row=>recoveryRowInfo(row)?.category==='paper_settled');
 const papers=rows.filter(row=>row.snapshot.kind==='paper'),secondary=papers.filter(row=>row.transformations.some(t=>t.rule==='paper_supplement_mapping_v1'));
 const aggregate=base.unidentifiedAggregate;const outcomes=aggregate&&obj(aggregate.known_aggregate_outcomes)?aggregate.known_aggregate_outcomes:{};
 const expectedWins=typeof outcomes.won==='number'?primarySettled.filter(r=>r.snapshot.outcome==='won').length+outcomes.won:null;
 const expectedLosses=typeof outcomes.lost==='number'?primarySettled.filter(r=>r.snapshot.outcome==='lost').length+outcomes.lost:null;
 const unresolved=papers.filter(row=>row.snapshot.outcome==='pending'||row.snapshot.outcome===null).length;
 const wins=papers.filter(row=>row.snapshot.outcome==='won').length,losses=papers.filter(row=>row.snapshot.outcome==='lost').length;
 const expectedUnresolved=primaryRows.filter(row=>recoveryRowInfo(row)?.category==='paper_unresolved').length;
 const sourceMissing=aggregate&&typeof aggregate.count==='number'?aggregate.count:0;const remaining=Math.max(0,sourceMissing-secondary.length);
 const paperReconciliation:CombinedRecoveryPreview['paperReconciliation']={total:papers.length,settledWins:wins,settledLosses:losses,unresolved,expectedWins,expectedLosses,expectedUnresolved,matchesCheckpoint:wins===expectedWins&&losses===expectedLosses&&unresolved===expectedUnresolved&&remaining===0&&secondary.length===sourceMissing&&papers.length===(expectedWins??0)+(expectedLosses??0)+expectedUnresolved,secondarySourceRecords:secondary.length,remainingUnaccounted:remaining,verifiedForecasts:0,fullHypotheticalProfitCents:null,knownPrimaryPartialProfitCents:base.reconciliation.identifiedPaperReportedHypotheticalProfitCents,missingCombinedOdds:secondary.filter(r=>r.snapshot.odds===null).map(r=>r.snapshot.externalId??`row:${r.rowNumber}`),missingStakes:papers.filter(r=>r.snapshot.stakeCents===null).length};
 const sources=[{sourceName:base.preview.sourceName,sourceHash:base.preview.sourceHash,rawSource:base.preview.rawSource},{sourceName:supplement.preview.sourceName,sourceHash:supplement.preview.sourceHash,rawSource:supplement.preview.rawSource}];
 const rawSource=JSON.stringify({format:'edgelab.combined-recovery-review',version:1,previewOnly:true,sources},null,2);
 const preview={...base.preview,sourceName:'combined-historical-review.json',rawSource,sourceHash:await sha256(rawSource),rows};guardRecoveryPreviewMapping(preview);
 const globalIssues=[...base.globalIssues.filter(i=>i.code!=='unidentified_papers_not_created'),...supplement.globalIssues,warning('paperCoverage','secondary_coverage_only',`${secondary.length} formerly unidentified records are provisionally described by secondary summaries; ${remaining} remain unaccounted. Count reconciliation is not proof of original registration or results.`)];
 if(!paperReconciliation.matchesCheckpoint)globalIssues.push(warning('paperCoverage','combined_paper_count_mismatch','Combined paper counts do not reconcile. No records were invented or merged to force agreement.','error'));
 const reconciliation={...structuredClone(base.reconciliation),comparisons:base.reconciliation.comparisons.map(c=>c.key.startsWith('paper_')?{...c,label:`Original primary source only · ${c.label}`}:structuredClone(c)),identifiedPaperStakeCents:null,identifiedPaperReportedHypotheticalProfitCents:null,identifiedPaperArithmeticGrossCents:null,identifiedPaperArithmeticProfitCents:null,notes:[...base.reconciliation.notes,'Combined historical paper P/L/ROI are unknown: the supplement supplies no original stakes and three combined prices are absent. Earlier A$17 is only the four-primary-winner partial sample.']};
 return {...base,preview,categories,globalIssues,summary:{...base.summary,total:rows.length,paperSettled:wins+losses,paperUnresolved:unresolved,unidentifiedNotCreated:remaining},reconciliation,missingRecovery:[...base.missingRecovery.filter(item=>!item.startsWith('Recover the seven unidentified')),...supplement.missingRecovery],sourceMetadata:{...base.sourceMetadata,combinedReview:true,sourceManifests:sources.map(({sourceName,sourceHash})=>({sourceName,sourceHash}))},paperReconciliation,supplementMetadata:supplement.sourceMetadata,matches,excludedDuplicates,sourceManifests:sources,originalBaseSummary:base.summary,existingRecordsCompared:existingRecords!==undefined};
}
export async function loadCombinedRecovery(input:{text:string;sourceName:string;existingRecords?:HistoricalRecord[];verification?:'unverified'|'synthetic'}):Promise<CombinedRecoveryPreview>{
 const decoded:unknown=JSON.parse(input.text);if(!obj(decoded)||!isCombinedRecovery(decoded)||!Array.isArray(decoded.sources)||decoded.sources.length!==2)throw new Error('Combined review archive must retain exactly two original source manifests.');
 const [a,b]=decoded.sources;if(!obj(a)||!obj(b)||typeof a.rawSource!=='string'||typeof b.rawSource!=='string'||typeof a.sourceName!=='string'||typeof b.sourceName!=='string'||await sha256(a.rawSource)!==a.sourceHash||await sha256(b.rawSource)!==b.sourceHash)throw new Error('Original source manifest/hash mismatch.');
 return combineRecoveryAndSupplement({base:await mapRecoverySource({text:a.rawSource,sourceName:a.sourceName,existingRecords:input.existingRecords,verification:input.verification}),supplement:await mapPaperSupplement({text:b.rawSource,sourceName:b.sourceName,verification:input.verification}),existingRecords:input.existingRecords});
}
