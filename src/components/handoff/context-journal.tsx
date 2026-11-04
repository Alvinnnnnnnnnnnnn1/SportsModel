'use client';
import { useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { prepareExperimentContextPreview } from '@/lib/handoff';
import type { ImportPreview } from '@/lib/imports/types';
import { useApp } from '../app-provider';
import { useHistory } from '../history-provider';
import { Button } from '../ui/button';
export function ContextJournal() {
  const { mode, notify } = useApp(); const { commitPreview, loading, error: storageError } = useHistory();
  const [day, setDay] = useState(''); const [rules, setRules] = useState(''); const [source, setSource] = useState('');
  const [rulesComplete,setRulesComplete]=useState(false);
  const [preview, setPreview] = useState<ImportPreview>(); const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const verification = mode === 'demo' ? 'synthetic' : 'user_confirmed';
  const inspect = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setConfirmed(false);
    try {
      if (!day.trim() && !rules.trim()) throw new Error('Provide a source-supported completed day or the complete original rules. Unknown information should stay blank.');
      if (day && !/^\d+$/.test(day)) throw new Error('Completed research day must be a whole number.');
      setPreview(await prepareExperimentContextPreview({ completedDay: day.trim() ? Number(day) : null, rulesText: rules.trim() || null, sourceReference: source.trim(), verification, confirmed: true, rulesCompleteConfirmed: rulesComplete }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Context could not be reviewed.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!preview || !confirmed) return;
    setBusy(true); setError('');
    try { await commitPreview(preview, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }], verification); setPreview(undefined); setDay(''); setRules(''); setSource(''); setRulesComplete(false); setConfirmed(false); notify('Experiment context journal appended. Original records and rules were not overwritten.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Context could not be saved.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4" aria-label="Experiment context journal"><div><h3 className="text-sm font-medium">Preserve the experiment context</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Record the source-supported completed day and complete original rule text so the next conversation does not depend on memory. This is an append-only owner attestation, not a bet, forecast, deposit or independently verified source. The reported Day 5 checkpoint is not saved automatically.</p></div>{!preview ? <form className="space-y-4" onSubmit={event=>void inspect(event)}><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Source-confirmed completed day · optional</span><input className="input" aria-label="Source-confirmed completed day" inputMode="numeric" value={day} onChange={e=>setDay(e.target.value)} placeholder="Unknown if blank" /></label><label><span className="label">Original source reference</span><input className="input" aria-label="Experiment context source reference" value={source} onChange={e=>setSource(e.target.value)} placeholder="Conversation/message or rule document reference" maxLength={2000} required /></label></div><label className="block"><span className="label">Complete original experiment rules · leave blank if unavailable</span><textarea className="input min-h-48" style={{minHeight:'12rem'}} aria-label="Complete original experiment rules" value={rules} onChange={e=>setRules(e.target.value)} maxLength={5000} placeholder="Paste only the original source-supported rules. Do not invent missing restrictions." /></label><label className="flex gap-3 text-[11px] leading-relaxed"><input type="checkbox" checked={rulesComplete} onChange={e=>setRulesComplete(e.target.checked)} disabled={!rules.trim()} /><span>I confirm the supplied rule text is the complete original rule set. Otherwise it remains partial/unconfirmed context.</span></label><Button type="submit" variant="outline" disabled={busy||loading}>Review context journal</Button></form> : <><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border p-4 text-[11px] text-muted-foreground">{preview.rawSource}</pre><label className="flex gap-3 rounded-lg border border-primary/20 p-4 text-xs leading-relaxed"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /><span>I reviewed this source and explicitly confirm the completed day and, if supplied, the complete original rules. Missing fields remain unknown. Append this journal without changing any original forecast, financial record or existing rule.</span></label><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setPreview(undefined)}>Back to context</Button><Button disabled={!confirmed||busy||loading||!!storageError} onClick={()=>void save()}><FileCheck2 />{busy?'Saving…':'Confirm context journal'}</Button></div></>}{error&&<p role="alert" className="text-xs text-red-300">{error}</p>}</section>;
}
