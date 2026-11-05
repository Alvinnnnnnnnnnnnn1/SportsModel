import { z } from 'zod';
import type { Mode } from '@/lib/domain/types';
import type { HistoricalLeg, HistoricalRecord, HistoricalSnapshot } from '@/lib/imports/types';
import { isRecoverySource, mapRecoverySource, recoveryRowInfo, type RecoveryPreview } from '@/lib/imports/recovery';
import { combineRecoveryAndSupplement, isCombinedRecovery, isPaperSupplement, loadCombinedRecovery, mapPaperSupplement } from '@/lib/imports/paper-supplement';
import { isOwnerCheckpointEnvelope, restoreOwnerCheckpointReview, type OwnerCheckpointReview } from './owner-checkpoint';
import { sha256, detectHistoricalDuplicates } from '@/lib/imports/duplicates';
export interface ContinuityEvidenceItem {
  evidenceId: string; category: string; sourceReference: string | null;
  facts: Omit<HistoricalSnapshot,'legs'> & {legs:Omit<HistoricalLeg,'id'>[]};
  registeredRecordId: string | null;
}
export interface ContinuityEvidenceBundle {
  format:'edgelab.continuity-evidence';version:1;sourceClass:'unverified'|'synthetic';
  sources:{name:string;sha256:string;rawSource:string}[];
  summary:RecoveryPreview['summary'];items:ContinuityEvidenceItem[];
  warnings:string[];checkpoint:Record<string,unknown>|null;
  ownerCheckpoint?:Pick<OwnerCheckpointReview,'mapping'|'stableSourceId'|'pendingExposureCents'|'modelledAfterExposureCents'|'rawOwnerSourceHash'|'warnings'>|null;
}
const sourceSchema=z.object({name:z.string().min(1).max(255),sha256:z.string().regex(/^[a-f0-9]{64}$/),rawSource:z.string().max(1048576)}).strict();
const envelopeSchema=z.object({format:z.literal('edgelab.continuity-evidence'),version:z.literal(1),sources:z.array(sourceSchema).min(1).max(3)}).passthrough();
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** A source-evidence attachment, never an import commit or a financial workspace. Derived facts are rebuilt on every load. */
export async function prepareContinuityEvidence(input:{files:{name:string;text:string}[];existingRecords:HistoricalRecord[];mode:Mode}):Promise<ContinuityEvidenceBundle>{
  if(!input.files.length||input.files.length>3)throw new Error('Select the primary recovery and optional paper supplement, or one combined review archive.');
  const files:{name:string;text:string}[]=[];
  for(const file of input.files){
    if(new TextEncoder().encode(file.text).length>4*1048576)throw new Error('Continuity evidence file exceeds 4 MiB.');
    let raw:unknown;try{raw=JSON.parse(file.text.replace(/^\uFEFF/,''));}catch{throw new Error('Continuity evidence must be valid JSON.');}
    if(object(raw)&&raw.format==='edgelab.continuity-evidence'){
      const parsed=envelopeSchema.safeParse(raw);if(!parsed.success)throw new Error('Invalid local continuity evidence envelope.');
      for(const source of parsed.data.sources){if(await sha256(source.rawSource)!==source.sha256)throw new Error('Continuity evidence source hash mismatch.');files.push({name:source.name,text:source.rawSource});}
    }else files.push(file);
  }
  if(files.length>3)throw new Error('A continuity attachment retains at most three original sources.');
  const decoded=files.map(file=>JSON.parse(file.text.replace(/^\uFEFF/,'')) as unknown);
  const ownerIndex=decoded.findIndex(isOwnerCheckpointEnvelope);
  if(decoded.filter(isOwnerCheckpointEnvelope).length>1)throw new Error('Attach only one owner checkpoint mapping at a time.');
  const owner=ownerIndex>=0?await restoreOwnerCheckpointReview({text:files[ownerIndex].text,sourceName:files[ownerIndex].name,existingRecords:input.existingRecords}):null;
  const historicalFiles=files.filter((_,i)=>i!==ownerIndex),historicalDecoded=decoded.filter((_,i)=>i!==ownerIndex);
  const primaryIndex=historicalDecoded.findIndex(isRecoverySource),combinedIndex=historicalDecoded.findIndex(isCombinedRecovery);
  let result:RecoveryPreview|null=null;let sources:ContinuityEvidenceBundle['sources']=[];
  const inspectSources=historicalDecoded.flatMap(raw=>object(raw)&&Array.isArray(raw.sources)?raw.sources.flatMap(source=>{if(!object(source)||typeof source.rawSource!=='string')return[];try{return[JSON.parse(source.rawSource.replace(/^\uFEFF/,'')) as unknown];}catch{return[];}}):[raw]);
  const fixture=inspectSources.some(raw=>object(raw)&&object(raw.source)&&raw.source.type==='synthetic_fixture')||owner?.preview.rows[0]?.snapshot.verification==='synthetic';
  if(fixture&&owner&&owner.preview.rows[0]?.snapshot.verification!=='synthetic')throw new Error('Real owner checkpoint evidence cannot be mixed into synthetic Demo retention.');
  if(fixture&&input.mode!=='demo')throw new Error('Synthetic continuity sources stay in Demo.');
  const verification=fixture?'synthetic':'unverified';
  if(combinedIndex>=0){
    if(historicalFiles.length!==1)throw new Error('A combined review already contains both historical sources.');
    const combined=await loadCombinedRecovery({text:historicalFiles[0].text,sourceName:historicalFiles[0].name,existingRecords:input.existingRecords,verification});result=combined;
    sources=combined.sourceManifests.map(s=>({name:s.sourceName,sha256:s.sourceHash,rawSource:s.rawSource}));
  }else if(historicalFiles.length){
    if(primaryIndex<0)throw new Error('Select the primary historical recovery first.');
    result=await mapRecoverySource({text:historicalFiles[primaryIndex].text,sourceName:historicalFiles[primaryIndex].name,existingRecords:input.existingRecords,verification});
    const supplementIndex=historicalDecoded.findIndex(isPaperSupplement);
    if(historicalFiles.length===2&&supplementIndex<0)throw new Error('The second historical source must be the explicit paper supplement.');
    if(supplementIndex>=0)result=await combineRecoveryAndSupplement({base:result,supplement:await mapPaperSupplement({text:historicalFiles[supplementIndex].text,sourceName:historicalFiles[supplementIndex].name,verification}),existingRecords:input.existingRecords});
    sources=await Promise.all(historicalFiles.map(async f=>({name:f.name,sha256:await sha256(f.text),rawSource:f.text})));
  }
  if(!result&&!owner)throw new Error('Select primary recovery or an explicit owner checkpoint review.');
  if(owner)sources.push({name:files[ownerIndex].name,sha256:await sha256(files[ownerIndex].text),rawSource:files[ownerIndex].text});
  const items=(result?.preview.rows??[]).map(row=>{
    const info=recoveryRowInfo(row);const duplicates=detectHistoricalDuplicates(row.snapshot,row.fingerprint,input.existingRecords);
    const registered=duplicates.find(d=>d.level==='exact');
    return {evidenceId:row.snapshot.sourceReference??`${result!.preview.sourceHash}#row:${row.rowNumber}`,category:info?.category??'historical_review',sourceReference:row.snapshot.sourceReference,facts:{...row.snapshot,legs:row.snapshot.legs.map(({id,...leg})=>{void id;return leg;})},registeredRecordId:registered?.recordId??null};
  });
  if(owner)for(const row of owner.preview.rows){const duplicate=detectHistoricalDuplicates(row.snapshot,row.fingerprint,input.existingRecords).find(d=>d.level==='exact');items.push({evidenceId:row.snapshot.sourceReference!,category:'owner_confirmed_pending_actual_review',sourceReference:row.snapshot.sourceReference,facts:{...row.snapshot,legs:row.snapshot.legs.map(({id,...leg})=>{void id;return leg;})},registeredRecordId:duplicate?.recordId??null});}
  const primary=sources.find(s=>isRecoverySource(JSON.parse(s.rawSource.replace(/^\uFEFF/,'')) as unknown));
  const original=primary?JSON.parse(primary.rawSource.replace(/^\uFEFF/,'')) as Record<string,unknown>:{};
  const summary=result?.summary??{total:0,actualCash:0,actualBonus:0,actualUnclassified:0,paperSettled:0,paperUnresolved:0,day6CashProposals:0,day6PaperProposals:0,unidentifiedNotCreated:0};
  return {format:'edgelab.continuity-evidence',version:1,sourceClass:verification,sources,summary:{...summary,total:items.length},items,warnings:[...(result?.globalIssues.map(i=>i.message)??[]),...(owner?.warnings??[]),'Local source evidence is not registered history, a financial ledger entry or an approved forecast.','Source-time outcomes and proposed amounts remain claims. No current result, funding or probability is inferred.'],checkpoint:object(original.checkpoint)?structuredClone(original.checkpoint):null,ownerCheckpoint:owner?{mapping:owner.mapping,stableSourceId:owner.stableSourceId,pendingExposureCents:owner.pendingExposureCents,modelledAfterExposureCents:owner.modelledAfterExposureCents,rawOwnerSourceHash:owner.rawOwnerSourceHash,warnings:owner.warnings}:null};
}
export function continuityEvidenceStorageKey(mode:Mode,userId:string|null):string|null{return mode==='demo'?'edgelab:continuity-evidence:demo:v1':userId?`edgelab:continuity-evidence:private:${userId}:v1`:null;}
export async function loadContinuityEvidence(storage:Pick<Storage,'getItem'>,key:string,options:{mode:Mode;existingRecords:HistoricalRecord[]}):Promise<ContinuityEvidenceBundle|null>{
  const text=storage.getItem(key);if(!text)return null;
  return prepareContinuityEvidence({files:[{name:'retained-local-continuity.json',text}],...options});
}
export function saveContinuityEvidence(storage:Pick<Storage,'setItem'>,key:string,bundle:ContinuityEvidenceBundle):void{
  if(!key.startsWith('edgelab:continuity-evidence:'))throw new Error('Invalid continuity evidence storage key.');
  if((key.includes(':demo:')&&bundle.sourceClass!=='synthetic')||(key.includes(':private:')&&bundle.sourceClass==='synthetic'))throw new Error('Demo and private continuity evidence must stay separate.');
  storage.setItem(key,JSON.stringify({format:bundle.format,version:1,sources:bundle.sources}));
}
