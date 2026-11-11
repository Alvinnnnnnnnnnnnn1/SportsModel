'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ZodError } from 'zod';
import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, ListChecks, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useApp } from '../app-provider';
import { useHistory } from '../history-provider';
import { HistoricalField } from '../history-detail';
import { IMPORT_MAX_BYTES, parseHistoricalSource, reviseImportRow } from '@/lib/imports';
import type { ImportDecision, ImportPreview, ImportPreviewRow, VerificationStatus } from '@/lib/imports/types';
import { money } from '@/lib/utils';
import { reconcileImportPreview } from '@/lib/handoff/checkpoint';
import { isRecoverySource, mapRecoverySource, recoveryRowInfo, type RecoveryPreview } from '@/lib/imports/recovery';
import { RecoveryReview } from './recovery-review';
import { isOwnerCheckpointEnvelope, restoreOwnerCheckpointReview, type OwnerCheckpointReview } from '@/lib/handoff/owner-checkpoint';
import { ReviewWarnings } from './review-warnings';
import { combineRecoveryAndSupplement, isCombinedRecovery, loadCombinedRecovery, mapPaperSupplement } from '@/lib/imports/paper-supplement';
import { isWagerClaimsSource, prepareWagerClaimsReview } from '@/lib/imports/wager-claims';
import { isReconciliationSource, prepareReconciliationImport } from '@/lib/reconciliation/source';
import { ApprovalStatusBadges } from '../approval-status';
import { acknowledgeSelectedArchiveRows, archiveRowEligibility, archiveSelectionBlockers, selectArchiveRows, summarizeArchiveReview } from '@/lib/imports/approval-review';
const SYNTHETIC_EXAMPLE = [{kind:'paper',sport:'NBA',event:'SYNTHETIC Hawks vs SYNTHETIC Comets',participant:'SYNTHETIC Example Player',market:'Player points',selection:'Over 18.5 points',line:'18.5',bookmaker:'SYNTHETIC Example Book',odds:1.9,predictionAt:'2026-01-01T00:00:00Z',placedAt:null,settledAt:null,probability:null,strategy:'C',sourceReference:'edgelab:synthetic-import-example',stakeCents:500,stakeType:'cash',payoutCents:null,outcome:'pending',verification:'synthetic',notes:'SYNTHETIC example only. No real event or wager.'}];
function errorText(error:unknown) {
  if(error instanceof ZodError){const first=error.issues[0];return `${first.path.join('.')||'Source'}: ${first.message}${error.issues.length>1?` (${error.issues.length} fields need review)` : ''}`;}
  return error instanceof Error?error.message:'This source could not be processed.';
}
function EditRow({row,preview,onSave,onClose}:{row:ImportPreviewRow;preview:ImportPreview;onSave:(preview:ImportPreview)=>void;onClose:()=>void}) {
  const {history}=useHistory();const [value,setValue]=useState(JSON.stringify(row.snapshot,null,2));const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const save=async()=>{setBusy(true);setError('');try{const corrected=JSON.parse(value);const revised=await reviseImportRow(preview,row.rowNumber,corrected,history.records);onSave(revised);onClose();}catch(reason){setError(errorText(reason));}finally{setBusy(false);}};
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Resolve source row {row.rowNumber}</DialogTitle><DialogDescription>Enter only source-supported corrections. Keep unknown values null. The original uploaded source and row stay intact; every correction is recorded as a manual transformation.</DialogDescription></DialogHeader><label className="label" htmlFor="row-correction">Proposed normalized record · JSON</label><textarea id="row-correction" className="input min-h-80 font-mono text-xs" style={{minHeight:'20rem'}} value={value} onChange={e=>setValue(e.target.value)} spellCheck={false} />{error&&<p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}<DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={()=>void save()}>{busy?'Revalidating…':'Apply audited correction'}</Button></DialogFooter></DialogContent></Dialog>;
}
function ManualRecord({onPreview}:{onPreview:(text:string)=>void}) {
  const [values,setValues]=useState<Record<string,string>>({});const [legs,setLegs]=useState('');const [error,setError]=useState('');
  const field=(name:string)=>({value:values[name]??'',onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setValues({...values,[name]:e.target.value})});
  const submit=(event:React.FormEvent)=>{event.preventDefault();setError('');try{const row:Record<string,unknown>={...values};for(const key of Object.keys(row))if(row[key]==='')row[key]=null;if(legs.trim())row.legs=JSON.parse(legs);onPreview(JSON.stringify([row],null,2));}catch{setError('Parlay legs must be a JSON array. No records were saved.');}};
  return <form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label><span className="label">Research type</span><select className="input" {...field('kind')}><option value="">Unknown</option><option value="paper">Paper prediction</option><option value="actual">Actual historical entry</option></select></label><label><span className="label">Sport</span><select className="input" {...field('sport')}><option value="">Unknown</option>{['NBA','NBL','ATP','WTA'].map(s=><option key={s}>{s}</option>)}</select></label><label><span className="label">Strategy</span><select className="input" {...field('strategy')}><option value="">Unknown</option>{['A','B','C'].map(s=><option key={s} value={s}>Track {s}</option>)}</select></label>{[['event','Event'],['participant','Player / team'],['market','Market type'],['selection','Exact selection'],['line','Threshold / line'],['bookmaker','Bookmaker'],['odds','Original decimal odds'],['predictionAt','Prediction timestamp · ISO with offset'],['placedAt','Original actual placement · ISO with offset'],['settledAt','Original settlement · ISO with offset'],['probability','Original probability · 0–1'],['sourceReference','Source reference'],['externalId','External reference ID'],['stake','Stake · AUD (optional)'],['payout','Reported payout · AUD (optional)'],['probabilitySource','Probability source'],['probabilityMethod','Probability method'],['modelVersion','Original model version']].map(([name,label])=><label key={name}><span className="label">{label}</span><input className="input" {...field(name)} placeholder={name.endsWith('At')?'2026-01-01T00:00:00Z':'Unknown if blank'} maxLength={500} /></label>)}<label><span className="label">Stake type</span><select className="input" {...field('stakeType')}><option value="">Unknown</option><option value="cash">Cash</option><option value="bonus">Bonus</option></select></label><label><span className="label">Recorded outcome</span><select className="input" {...field('outcome')}><option value="">Unknown</option>{['pending','won','lost','void'].map(o=><option key={o}>{o}</option>)}</select></label></div><label className="block"><span className="label">Individual parlay legs · optional JSON array</span><textarea className="input min-h-24 font-mono text-xs" value={legs} onChange={e=>setLegs(e.target.value)} placeholder='[{"sport":"NBA","event":"…","selection":"…","line":"…"}]' /></label><p className="text-[11px] leading-relaxed text-muted-foreground">Blank fields remain null. No stake, odds, probability, timestamp or funding transaction is inferred. Record N/A only when the source explicitly has no numerical threshold.</p>{error&&<p role="alert" className="text-xs text-red-300">{error}</p>}<Button type="submit"><ListChecks />Validate manual record</Button></form>;
}
interface ImportSuccess {
  sourceName: string; sourceHash: string; previousBatchIds: string[];
  rows: { rowNumber: number; label: string; kind: string | null }[];
}

export function ImportWizard({onCommitted,seedSource}:{onCommitted:(recordId?:string)=>void;seedSource?:{text:string;sourceName:string}}) {
  const {mode,user,notify,data}=useApp();
  const {history,loading:historyLoading,error:storageError,commitPreview}=useHistory();
  const loading=historyLoading||(mode==='supabase'&&!user);
  const fileReadVersion=useRef(0), analysisVersion=useRef(0), seeded=useRef(false);
  const [originalRecovery,setOriginalRecovery]=useState<RecoveryPreview>();
  const [recovery,setRecovery]=useState<RecoveryPreview>();
  const [ownerReview,setOwnerReview]=useState<OwnerCheckpointReview>();
  const [method,setMethod]=useState<'upload'|'json'|'manual'>(seedSource?'json':'upload');
  const [text,setText]=useState(seedSource?.text??'');
  const [sourceName,setSourceName]=useState(seedSource?.sourceName??'manual-history.json');
  const [verification,setVerification]=useState<VerificationStatus>(mode==='demo'?'synthetic':'unverified');
  const [preview,setPreview]=useState<ImportPreview>();
  const [decisions,setDecisions]=useState<ImportDecision[]>([]);
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [technicalError,setTechnicalError]=useState('');
  const [confirmOpen,setConfirmOpen]=useState(false), [success,setSuccess]=useState<ImportSuccess>();
  const [editing,setEditing]=useState<ImportPreviewRow>(), [detail,setDetail]=useState<number>();
  const previewOnly=!!recovery||!!ownerReview;
  const problem=useCallback((reason:unknown)=>{setError(errorText(reason));setTechnicalError(reason instanceof Error?reason.message:'');},[]);
  useEffect(()=>()=>{++fileReadVersion.current;++analysisVersion.current;seeded.current=false;},[]);

  const analyze=useCallback(async(value:string,type:'csv'|'json'|'manual',name:string)=>{
    const epoch=++analysisVersion.current;
    setBusy(true);setError('');setTechnicalError('');setConfirmOpen(false);setSuccess(undefined);
    try {
      if(mode==='supabase'&&(!user||loading||storageError))throw new Error('Wait for your signed-in private workspace and archive to load before validating a source.');
      let parsed:ImportPreview, nextRecovery:RecoveryPreview|undefined, nextOriginal:RecoveryPreview|undefined, nextOwner:OwnerCheckpointReview|undefined;
      let classification=verification;
      let decoded:unknown;
      if(type!=='csv'){try{decoded=JSON.parse(value.replace(/^\uFEFF/,''));}catch{decoded=undefined;}}
      if(isReconciliationSource(decoded)){
        const review=await prepareReconciliationImport({text:value,sourceName:name,data,history,mode});
        classification='unverified';parsed=review.preview;
      } else if(isWagerClaimsSource(decoded)){
        const review=await prepareWagerClaimsReview({text:value,sourceName:name,existingRecords:history.records,bets:data.bets,mode});
        classification=review.envelope.sourceClass==='synthetic'?'synthetic':'unverified';parsed=review.preview;
      } else if(isOwnerCheckpointEnvelope(decoded)){
        nextOwner=await restoreOwnerCheckpointReview({text:value,sourceName:name,existingRecords:history.records});
        classification=nextOwner.preview.rows[0]?.snapshot.verification??'user_confirmed';parsed=nextOwner.preview;
      } else if(isCombinedRecovery(decoded)){
        nextRecovery=await loadCombinedRecovery({text:value,sourceName:name,existingRecords:mode==='supabase'&&user&&!loading&&!storageError?history.records:undefined});
        classification='unverified';parsed=nextRecovery.preview;
      } else if(isRecoverySource(decoded)){
        nextOriginal=await mapRecoverySource({text:value,sourceName:name,existingRecords:mode==='supabase'&&user&&!loading&&!storageError?history.records:undefined});
        nextRecovery=nextOriginal;classification='unverified';parsed=nextRecovery.preview;
      } else parsed=await parseHistoricalSource({text:value,format:type,sourceName:name,verification,existingRecords:history.records});
      if(epoch!==analysisVersion.current)return;
      setOriginalRecovery(nextOriginal);setRecovery(nextRecovery);setOwnerReview(nextOwner);setVerification(classification);setPreview(parsed);
      setDecisions(parsed.rows.map(row=>({rowNumber:row.rowNumber,include:false,allowProbableDuplicate:false,acknowledgeIncomplete:false})));
    } catch(reason){if(epoch===analysisVersion.current){setPreview(undefined);problem(reason);}}
    finally{if(epoch===analysisVersion.current)setBusy(false);}
  },[verification,history,data,mode,user,loading,storageError,problem]);

  useEffect(()=>{
    if(!seedSource||seeded.current||loading||storageError)return;
    seeded.current=true;
    void analyze(seedSource.text,'json',seedSource.sourceName);
  },[seedSource,loading,storageError,analyze]);

  async function selectFile(file?:File){
    const epoch=++fileReadVersion.current;++analysisVersion.current;
    setPreview(undefined);setText('');setError('');setTechnicalError('');setSuccess(undefined);
    if(!file)return;
    try {
      if(file.size>IMPORT_MAX_BYTES)throw new Error('Choose a source file up to 1 MiB. Nothing was saved.');
      const extension=file.name.split('.').at(-1)?.toLowerCase();
      if(extension!=='csv'&&extension!=='json')throw new Error('Choose a CSV or JSON source file.');
      let contents:string;try{contents=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer());}catch{throw new Error('The source file is not valid UTF-8. No records were saved.');}
      if(epoch!==fileReadVersion.current)return;
      setSourceName(file.name);setText(contents);
      await analyze(contents,extension,file.name);
    } catch(reason){if(epoch===fileReadVersion.current)problem(reason);}
  }
  async function selectSupplement(file?:File){
    if(!file||!originalRecovery)return;
    const epoch=++analysisVersion.current;setBusy(true);setError('');setTechnicalError('');
    try {
      if(file.size>IMPORT_MAX_BYTES)throw new Error('Choose a supplementary JSON file up to 1 MiB.');
      let contents:string;try{contents=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer());}catch{throw new Error('The source file is not valid UTF-8. No records were saved.');}
      const supplement=await mapPaperSupplement({text:contents,sourceName:file.name});
      const result=await combineRecoveryAndSupplement({base:originalRecovery,supplement,existingRecords:mode==='supabase'&&user&&!loading&&!storageError?history.records:undefined});
      if(epoch!==analysisVersion.current)return;
      setRecovery(result);setPreview(result.preview);setConfirmOpen(false);
      setDecisions(result.preview.rows.map(row=>({rowNumber:row.rowNumber,include:false,allowProbableDuplicate:false,acknowledgeIncomplete:false})));
    } catch(reason){if(epoch===analysisVersion.current)problem(reason);}
    finally{if(epoch===analysisVersion.current)setBusy(false);}
  }
  const toggle=(rowNumber:number,update:Partial<ImportDecision>)=>{setConfirmOpen(false);setDecisions(old=>old.map(decision=>decision.rowNumber===rowNumber?{...decision,...update}:decision));};
  const selected=decisions.filter(decision=>decision.include);
  const summary=preview?summarizeArchiveReview(preview,decisions,previewOnly):null;
  const selectionBlockers=preview?archiveSelectionBlockers(preview,decisions,previewOnly):[];
  const canConfirm=!!preview&&!selectionBlockers.length&&!previewOnly&&!busy&&!loading&&!storageError;
  const warningRows=preview?.rows.filter(row=>selected.some(decision=>decision.rowNumber===row.rowNumber)&&row.issues.some(issue=>issue.severity==='warning'))??[];
  const allWarningsAcknowledged=warningRows.length>0&&warningRows.every(row=>decisions.find(decision=>decision.rowNumber===row.rowNumber)?.acknowledgeIncomplete);
  const shown=preview?.rows.find(row=>row.rowNumber===detail);
  const reconciliation=preview?reconcileImportPreview({...preview,rows:preview.rows.filter(row=>selected.some(decision=>decision.rowNumber===row.rowNumber))}):null;
  const savedBatch=success?history.batches.find(batch=>batch.sourceHash===success.sourceHash&&!success.previousBatchIds.includes(batch.id)):undefined;
  const savedRecords=savedBatch?history.records.filter(record=>record.batchId===savedBatch.id):[];

  async function commit(){
    if(!preview||!canConfirm||!confirmOpen)return;
    const completed:ImportSuccess={sourceName:preview.sourceName,sourceHash:preview.sourceHash,previousBatchIds:history.batches.map(batch=>batch.id),rows:preview.rows.filter(row=>selected.some(decision=>decision.rowNumber===row.rowNumber)).map(row=>({rowNumber:row.rowNumber,label:row.snapshot.participant??row.snapshot.event??row.snapshot.selection??`Source row ${row.rowNumber}`,kind:row.snapshot.kind}))};
    setBusy(true);setError('');setTechnicalError('');
    try {
      await commitPreview(preview,decisions,verification);
      setSuccess(completed);setConfirmOpen(false);setPreview(undefined);setDecisions([]);setText('');
      notify(`Archive import complete · ${completed.rows.length} source records saved`);onCommitted();
    } catch(reason){problem(reason);}
    finally{setBusy(false);}
  }

  return <section className="panel overflow-hidden" aria-label="Historical import approval">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
      <div><h2 className="text-sm font-medium">Import historical evidence</h2><p className="mt-1 text-[11px] text-muted-foreground">Upload → review records → confirm archive import</p></div>
      <ApprovalStatusBadges facts={success?{archived:true,mode,ownerAttested:verification==='user_confirmed'}:{}} compact />
    </div>
    <div className="space-y-5 p-5">
      {success?<section className="space-y-4" aria-label="Archive import complete">
        <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 text-primary" /><div><h3 className="text-base font-medium">{success.rows.length} records archived</h3><p className="mt-1 text-xs text-muted-foreground">{success.sourceName} · {success.rows.filter(row=>row.kind==='actual').length} actual-source archives · {success.rows.filter(row=>row.kind==='paper').length} paper-source archives</p></div></div>
        <p className="text-xs leading-relaxed text-muted-foreground">Original evidence, source hash and approval audit were saved. No actual wager, deposit or paper position was automatically registered.</p>
        <ul className="divide-y divide-border rounded-lg border border-border">{success.rows.map(row=>{const saved=savedRecords.find(record=>record.rowNumber===row.rowNumber);return <li key={row.rowNumber} className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs"><span>Row {row.rowNumber} · {row.label}</span>{saved&&<Button size="sm" variant="outline" onClick={()=>onCommitted(saved.id)}>Review saved record</Button>}</li>;})}</ul>
        <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href="#historical-archive">View saved archive <ArrowRight /></a></Button><Button variant="ghost" onClick={()=>{setSuccess(undefined);setOriginalRecovery(undefined);setRecovery(undefined);setOwnerReview(undefined);}}>Import another source</Button></div>
      </section>:!preview?<>
        <p className="text-xs leading-relaxed text-muted-foreground">Files are checked locally. Archiving preserves evidence; paper tracking and actual financial registration are separate actions.</p>
        <div className="flex flex-wrap gap-2">{[['upload','Upload file'],['json','Paste mapped JSON'],['manual','Enter record manually']].map(([key,label])=><Button key={key} size="sm" variant={method===key?'secondary':'ghost'} disabled={busy} onClick={()=>{setMethod(key as typeof method);setError('');setTechnicalError('');}}>{label}</Button>)}</div>
        <label className="block max-w-sm"><span className="label">Source assessment</span><select className="input" aria-label="Source verification classification" value={verification} disabled={busy} onChange={event=>setVerification(event.target.value as VerificationStatus)}><option value="unverified" disabled={mode==='demo'}>Unverified · not independently checked</option><option value="user_confirmed" disabled={mode==='demo'}>Owner-attested · not independently verified</option><option value="synthetic" disabled={mode!=='demo'}>Synthetic fixture / test only</option></select></label>
        {method==='upload'&&<>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/30 p-5"><FileUp className="size-6 text-primary" /><span className="text-xs">Choose a CSV or JSON file</span><span className="text-[10px] text-muted-foreground">Automatically validates and checks duplicates · up to 1 MiB / 500 records</span><input aria-label="Historical import source file" type="file" accept=".csv,.json,text/csv,application/json" className="mt-2 max-w-full text-xs text-muted-foreground" disabled={loading||busy||!!storageError} onChange={event=>void selectFile(event.target.files?.[0])} /></label>
          {busy&&<p role="status" className="text-xs text-muted-foreground">Validating source and checking duplicates…</p>}
          <Button variant="outline" disabled={mode!=='demo'||busy} onClick={()=>{setMethod('json');setSourceName('synthetic-example.json');setText(JSON.stringify(SYNTHETIC_EXAMPLE,null,2));setVerification('synthetic');}}><Sparkles />Load synthetic example</Button>
        </>}
        {method==='json'&&<>
          <label className="block"><span className="label">Mapped research records · JSON array or {'{ records: […] }'}</span><textarea className="input min-h-64 font-mono text-xs" aria-label="Historical import JSON" style={{minHeight:'16rem'}} value={text} disabled={busy} onChange={event=>{setText(event.target.value);setSourceName('pasted-research.json');}} placeholder='[{"kind":"paper","sport":"NBA","event":"…","odds":null,"predictionAt":null}]' spellCheck={false} /></label>
          <p className="text-[11px] text-muted-foreground">Unknown facts remain null. Conversation exports require the existing manual mapping first.</p>
          <Button disabled={!text||busy||loading||!!storageError} onClick={()=>void analyze(text,'json',sourceName)}><ListChecks />{busy?'Checking source…':'Validate mapped JSON'}</Button>
        </>}
        {method==='manual'&&<ManualRecord onPreview={value=>{setText(value);setSourceName('manual-research.json');void analyze(value,'manual','manual-research.json');}} />}
        {mode==='demo'&&<p className="text-[11px] text-amber-200/80">Demo saves only synthetic fixtures. Recovery sources remain local previews; authenticated history is separate.</p>}
      </>:<>
        {summary&&<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Archive validation summary">{[['Uploaded',summary.total],['Archive eligible',summary.eligible],['Duplicates',summary.duplicates],['Requires review',summary.requiresReview],['Blocked',summary.blocked],['Already saved',summary.alreadySaved]].map(([label,value])=><div key={String(label)} className="rounded-lg border border-border p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-lg tabular-nums">{value}</p></div>)}</div>}
        <div className="sticky top-3 z-20 space-y-3 rounded-xl border border-border bg-background/95 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={previewOnly||busy} onClick={()=>{setConfirmOpen(false);setDecisions(old=>selectArchiveRows(preview,old,true,previewOnly));}}>Select all eligible rows</Button><Button variant="ghost" size="sm" disabled={busy} onClick={()=>{setConfirmOpen(false);setDecisions(old=>selectArchiveRows(preview,old,false));}}>Deselect all</Button><span className="text-[11px] text-muted-foreground">{selected.length} selected</span></div><Button disabled={!canConfirm} onClick={()=>setConfirmOpen(true)}>Review archive import <ArrowRight /></Button></div>
          {warningRows.length>0&&<label className="flex items-start gap-3 text-xs leading-relaxed"><input aria-label="Acknowledge selected archive warnings" type="checkbox" className="mt-0.5" checked={allWarningsAcknowledged} disabled={busy} onChange={event=>{setConfirmOpen(false);setDecisions(old=>acknowledgeSelectedArchiveRows(preview,old,event.target.checked));}} /><span>I reviewed the missing or unverified information for all {warningRows.length} selected records. This acknowledges source limitations; it does not verify them.</span></label>}
          {selectionBlockers.length>0&&selected.length>0&&<p className="text-[11px] text-amber-200">{selectionBlockers.join(' ')}</p>}
          <p className="text-[10px] text-muted-foreground">Archive approval only. Actual financial registration and paper tracking remain separate.</p>
        </div>
        {ownerReview&&<section aria-label="Owner checkpoint financial review" className="rounded-xl border border-amber-200/20 p-4"><h3 className="text-sm">Owner-attested checkpoint · preview only</h3><p className="mt-2 text-xs text-amber-200">This source has not been approved for hosted saving. Reported quotes stay separate from unknown execution prices and placement times.</p><details className="mt-3"><summary className="cursor-pointer text-xs">Checkpoint evidence and financial requirements</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-[11px] text-muted-foreground">{JSON.stringify({stableSourceId:ownerReview.stableSourceId,pendingExposureCents:ownerReview.pendingExposureCents,modelledAfterExposureCents:ownerReview.modelledAfterExposureCents,realisedProfitReferenceCents:ownerReview.mapping.priorCheckpoint.realisedProfitCents,classifications:ownerReview.classifications,missingExecutionEvidence:ownerReview.financialReview,warnings:ownerReview.warnings,sourceMapping:ownerReview.mapping},null,2)}</pre></details></section>}
        {recovery&&<><RecoveryReview result={recovery} />{originalRecovery&&<label className="block rounded-lg border border-border p-4 text-xs"><span className="label">Add supplementary paper recovery · local comparison only</span><input aria-label="Supplementary paper recovery JSON" type="file" accept=".json,application/json" disabled={busy||loading} className="mt-2 max-w-full text-xs" onChange={event=>void selectSupplement(event.target.files?.[0])} /><p className="mt-2 text-[11px] text-muted-foreground">The original source stays intact. This recovery remains preview-only.</p></label>}</>}
        <div className="table-wrap rounded-lg border border-border"><table className="data-table"><thead><tr><th>Select</th><th>Event / selection</th><th>Original odds / stake</th><th>Eligibility and source flags</th><th>Review</th></tr></thead><tbody>{preview.rows.map(row=>{
          const decision=decisions.find(item=>item.rowNumber===row.rowNumber)!;
          const eligibility=archiveRowEligibility(row,previewOnly), info=recoveryRowInfo(row);
          const savedDuplicate=row.duplicates.find(duplicate=>duplicate.level==='exact'&&history.records.some(record=>record.id===duplicate.recordId));
          return <tr key={row.rowNumber}>
            <td><input aria-label={`Select row ${row.rowNumber}`} aria-describedby={!eligibility.eligible?`archive-row-blocker-${row.rowNumber}`:undefined} type="checkbox" checked={decision.include} disabled={!eligibility.eligible||busy} onChange={event=>toggle(row.rowNumber,{include:event.target.checked})} /></td>
            <td><p className="text-[11px]">{row.rowNumber}. {row.snapshot.participant??row.snapshot.event??'Unknown event / participant'}</p><p className="mt-1 text-[10px] text-muted-foreground">{row.snapshot.kind??'Unclassified'} · {row.snapshot.sport??'Unknown sport'}</p><p className="mt-1 max-w-64 text-[10px] text-muted-foreground">{row.snapshot.selection??'Unknown selection'} · {row.snapshot.line??'Unknown line'}</p>{info&&<p className="mt-1 text-[9px] text-amber-200">{info.category.replaceAll('_',' ')} · {info.reference??'Original ID unknown'} · source line {info.sourceLine??'unknown'}</p>}</td>
            <td><p>{row.snapshot.odds??'Unknown odds'}</p><p className="mt-1 text-[10px] text-muted-foreground">{row.snapshot.stakeCents===null?'Unknown stake':money(row.snapshot.stakeCents)} · {row.snapshot.stakeType??'Unknown type'}</p></td>
            <td className="max-w-sm whitespace-normal">{!eligibility.eligible&&<p id={`archive-row-blocker-${row.rowNumber}`} className="mb-2 text-[10px] text-red-300">{eligibility.reasons[0]}</p>}<ReviewWarnings row={row} compact />{row.duplicates.some(duplicate=>duplicate.level==='probable')&&eligibility.eligible&&<label className="mt-3 flex gap-2 text-[10px] leading-relaxed text-amber-200"><input aria-label={`Keep probable duplicate row ${row.rowNumber} separately`} type="checkbox" checked={decision.allowProbableDuplicate} disabled={busy} onChange={event=>toggle(row.rowNumber,{allowProbableDuplicate:event.target.checked})} />I reviewed this probable duplicate and want to keep it as separate evidence, without merging records.</label>}</td>
            <td><div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={()=>savedDuplicate?onCommitted(savedDuplicate.recordId):setDetail(row.rowNumber)}>{savedDuplicate?'Open saved record':'Review source'}</Button>{!previewOnly&&!row.duplicates.some(duplicate=>duplicate.level==='exact')&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>setEditing(row)}>Correct draft</Button>}</div></td>
          </tr>;
        })}</tbody></table></div>
        <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-[11px] text-muted-foreground">Source provenance and validation details</summary><p className="mt-3 break-all text-[10px] text-muted-foreground">{preview.sourceName} · SHA-256 {preview.sourceHash}</p><p className="mt-2 text-[10px] text-muted-foreground">Counts can overlap: an already-saved duplicate is also blocked. No source data or forecasts have been changed.</p></details>
        <Button variant="ghost" disabled={busy} onClick={()=>{++analysisVersion.current;setPreview(undefined);setRecovery(undefined);setOwnerReview(undefined);setOriginalRecovery(undefined);setDecisions([]);setConfirmOpen(false);}}><ArrowLeft />Choose another source</Button>
      </>}
      {storageError&&<p role="alert" className="text-xs text-red-300">Historical storage is unavailable. Resolve this before saving: {storageError}</p>}
      {error&&<div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-200"><p>{error}</p>{technicalError!==error&&technicalError&&<details className="mt-2"><summary className="cursor-pointer text-[11px]">Technical details</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px]">{technicalError}</pre></details>}</div>}
    </div>
    <Dialog open={confirmOpen} onOpenChange={open=>{if(!busy)setConfirmOpen(open);}}><DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Confirm archive import</DialogTitle><DialogDescription>Save only the {selected.length} selected source records to {mode==='demo'?'the synthetic browser archive':'your private Supabase archive'}.</DialogDescription></DialogHeader>
      {preview&&<div className="space-y-4"><dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4"><HistoricalField label="Source" value={preview.sourceName} /><HistoricalField label="Assessment" value={verification==='user_confirmed'?'Owner-attested · not independently verified':verification==='synthetic'?'Synthetic fixture':'Unverified'} /><HistoricalField label="Actual-source archives" value={selected.filter(decision=>preview.rows.some(row=>row.rowNumber===decision.rowNumber&&row.snapshot.kind==='actual')).length} /><HistoricalField label="Paper-source archives" value={selected.filter(decision=>preview.rows.some(row=>row.rowNumber===decision.rowNumber&&row.snapshot.kind==='paper')).length} /></dl>
        <p className="text-xs leading-relaxed text-muted-foreground">Your original source, selected rows, source hash and review decisions will be preserved with an audit entry. This does not register actual wagers, paper positions, deposits or verified outcomes.</p>
        {reconciliation&&reconciliation.proposedActualCount>0&&<details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Actual-source financial requirements</summary><p className="mt-3 text-[11px] text-muted-foreground">{reconciliation.proposedActualCount} selected actual-source rows; {reconciliation.calculableActualCount} financially complete; {reconciliation.unresolved.length} need evidence. Archive saving has no financial effect.</p><pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{JSON.stringify({cashStakeCents:reconciliation.cashStakeCents,cashReturnCents:reconciliation.cashReturnCents,bonusCashReturnCents:reconciliation.bonusCashReturnCents,unresolved:reconciliation.unresolved,fundingInferred:false},null,2)}</pre></details>}
        <p className="text-xs">Choosing <strong>Confirm archive import</strong> explicitly approves this archive save only.</p>
      </div>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setConfirmOpen(false)}>Cancel</Button><Button disabled={!canConfirm} onClick={()=>void commit()}><ShieldCheck />{busy?'Saving archive…':'Confirm archive import'}</Button></DialogFooter>
    </DialogContent></Dialog>
    {editing&&preview&&<EditRow row={editing} preview={preview} onSave={next=>{setPreview(next);setConfirmOpen(false);setDecisions(old=>old.map(decision=>decision.rowNumber===editing.rowNumber?{...decision,include:false,acknowledgeIncomplete:false,allowProbableDuplicate:false}:decision));}} onClose={()=>setEditing(undefined)} />}
    <Dialog open={!!shown} onOpenChange={open=>{if(!open)setDetail(undefined);}}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Review source row {shown?.rowNumber}</DialogTitle><DialogDescription>Draft only. Original source values and financial eligibility stay separate.</DialogDescription></DialogHeader>{shown&&<>
      <dl className="grid grid-cols-2 gap-4"><HistoricalField label="Type" value={shown.snapshot.kind} /><HistoricalField label="Event" value={shown.snapshot.event} /><HistoricalField label="Market" value={shown.snapshot.market} /><HistoricalField label="Selection / line" value={shown.snapshot.selection===null?null:`${shown.snapshot.selection} · ${shown.snapshot.line??'Unknown'}`} /><HistoricalField label="Original odds" value={shown.snapshot.odds} /><HistoricalField label="Stake" value={shown.snapshot.stakeCents===null?null:money(shown.snapshot.stakeCents)} /></dl>
      <ReviewWarnings row={shown} />
      {shown.duplicates.some(duplicate=>history.records.some(record=>record.id===duplicate.recordId))&&<section className="mt-3 space-y-2"><h3 className="text-xs font-medium">Existing linked archive records</h3>{shown.duplicates.filter(duplicate=>history.records.some(record=>record.id===duplicate.recordId)).map(duplicate=><div key={duplicate.recordId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-3"><p className="max-w-sm text-[10px] text-muted-foreground">{duplicate.level.toUpperCase()} · {duplicate.reason}</p><Button size="sm" variant="outline" onClick={()=>{setDetail(undefined);onCommitted(duplicate.recordId);}}>Open saved record</Button></div>)}</section>}
      <details className="mt-3 rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Original source and audited draft transformations</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{JSON.stringify({proposed:shown.snapshot,original:shown.raw,transformations:shown.transformations},null,2)}</pre></details>
    </>}</DialogContent></Dialog>
  </section>;
}
