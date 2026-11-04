'use client';
import { useRef, useState } from 'react';
import { FileSearch, ListChecks, ShieldCheck } from 'lucide-react';
import { useApp } from '../app-provider';
import { Button } from '../ui/button';
import { dateTime } from '@/lib/utils';
import {
  CONVERSATION_EXPORT_MAX_BYTES, createMappedConversationSource, emptyMessageMapping,
  parseConversationExport, selectConversation,
} from '@/lib/conversation-import';
import type { ConversationExport, ConversationSelection, MappedConversationSource } from '@/lib/conversation-import';

/** Draft preparation only. The ordinary import wizard owns validation/review/confirmation and saving. */
export function ConversationIntake({ onMappedSource }: { onMappedSource: (source: MappedConversationSource) => void }) {
  const { mode } = useApp();
  const [source, setSource] = useState<ConversationExport>();
  const [query, setQuery] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [branch, setBranch] = useState<'current' | 'all'>('current');
  const [selection, setSelection] = useState<ConversationSelection>();
  const [messagePage, setMessagePage] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileVersion = useRef(0);
  const visible = source?.conversations.filter(conversation => `${conversation.title} ${conversation.id}`.toLowerCase().includes(query.toLowerCase())) ?? [];

  async function readFile(file?: File) {
    const version = ++fileVersion.current;
    setSource(undefined); setSelection(undefined); setMessagePage(0); setDrafts({}); setConsent(false); setConversationId(''); setError(''); setBusy(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) { setError('Extract the downloaded archive locally, then select conversations.json or one extracted conversation JSON. ZIP, HTML and attachments are not parsed.'); return; }
    if (file.size > CONVERSATION_EXPORT_MAX_BYTES) { setError('Choose an extracted JSON file up to 25 MiB. Nothing was uploaded or saved.'); return; }
    setBusy(true);
    try {
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer()); }
      catch { throw new Error('The selected export is not valid UTF-8 JSON. Re-export or extract UTF-8 text; no data was saved.'); }
      const parsed = await parseConversationExport({ text, sourceName: file.name });
      if (version !== fileVersion.current) return;
      setSource(parsed); setQuery('');
    } catch (reason) {
      if (version === fileVersion.current) setError(reason instanceof Error ? reason.message : 'This export could not be read. No data was saved.');
    } finally { if (version === fileVersion.current) setBusy(false); }
  }

  function review() {
    setError(''); setSelection(undefined); setMessagePage(0); setDrafts({}); setConsent(false);
    if (!source) return;
    try { setSelection(selectConversation(source, conversationId, branch)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The selected conversation could not be reviewed.'); }
  }

  async function prepare() {
    if (!source || !selection || !consent) return;
    setBusy(true); setError('');
    try {
      const mappings = Object.entries(drafts).map(([nodeId, text]) => {
        let fields: unknown;
        try { fields = JSON.parse(text); }
        catch { throw new Error(`Manual mapping for source node ${nodeId} is not valid JSON. No records were saved.`); }
        const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
        if (Array.isArray(fields) ? !fields.length || fields.some(value => !object(value)) : !object(fields)) throw new Error('Each manual mapping must be an object or a nonempty array of record objects.');
        return { nodeId, fields: fields as Record<string, unknown> | Record<string, unknown>[] };
      });
      const mapped = await createMappedConversationSource({ source, selection, mappings, verification: mode === 'demo' ? 'synthetic' : 'unverified' });
      onMappedSource(mapped);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The mapping could not be prepared. No records were saved.'); }
    finally { setBusy(false); }
  }

  return <section className="panel overflow-hidden" aria-label="Selected conversation intake">
    <div className="flex items-start gap-3 border-b border-border p-5">
      <FileSearch className="mt-0.5 size-4 shrink-0 text-primary" />
      <div><h2 className="text-sm font-medium">Prepare a supplied conversation source</h2><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Optional local extraction for Days 1–5. This screen cannot access ChatGPT accounts or conversations. It prepares a manual draft; it does not save history.</p></div>
    </div>
    <div className="space-y-4 p-5">
      <p className="text-[11px] leading-relaxed text-muted-foreground">Obtain your own official data export, unzip it on your computer, then select its <code>conversations.json</code> or a JSON file containing only the relevant conversation object. The parser supports the export’s conversation/mapping/message structure, not every possible export version. Other formats still require manual structured mapping.</p>
      {mode === 'demo' && <p className="rounded-lg border border-amber-300/20 p-3 text-[11px] leading-relaxed text-amber-200">Demo accepts synthetic sources only. Use a synthetic export fixture here; prepare real history only in your authenticated workspace and confirm it separately.</p>}
      <label className="block"><span className="label">User-selected extracted conversation JSON · up to 25 MiB, local only</span><input type="file" accept=".json,application/json" aria-label="Select conversation export JSON" className="mt-2 max-w-full text-xs text-muted-foreground" onChange={event => void readFile(event.target.files?.[0])} /></label>
      {busy && <p role="status" className="text-xs text-muted-foreground">Preparing source preview…</p>}
      {source && <>
        <p className="text-[10px] leading-relaxed text-muted-foreground">{source.conversations.length} conversations found locally · SHA-256 {source.sourceHash.slice(0, 16)}… · Nothing has been uploaded.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Find the relevant conversation</span><input className="input" aria-label="Find export conversation" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title or source ID…" /></label>
          <label><span className="label">Choose exactly one source conversation</span><select className="input" aria-label="Choose export conversation" value={conversationId} onChange={event => { setConversationId(event.target.value); setSelection(undefined); setDrafts({}); setConsent(false); }}><option value="">Choose a source…</option>{visible.map(conversation => <option key={conversation.id} value={conversation.id}>{conversation.title.slice(0, 160)} · {conversation.id}</option>)}</select></label>
          <label><span className="label">Message branch for manual review</span><select className="input" aria-label="Conversation branch" value={branch} onChange={event => { setBranch(event.target.value as 'current' | 'all'); setSelection(undefined); setDrafts({}); setConsent(false); }}><option value="current">Current branch from export metadata</option><option value="all">All branches · review alternatives explicitly</option></select></label>
        </div>
        <Button size="sm" variant="outline" disabled={!conversationId || busy} onClick={review}><ListChecks />Review selected conversation</Button>
      </>}
      {selection && <>
        <div className="space-y-2 rounded-lg border border-amber-300/15 p-3">{selection.warnings.map(warning => <p key={warning} className="text-[11px] leading-relaxed text-amber-100/80">{warning}</p>)}<p className="text-[11px] leading-relaxed text-muted-foreground">All facts start null. Enter only source-supported fields. Message creation times are provenance metadata, not assumed forecast, placement or settlement times. No statements in a ChatGPT answer count as verified results without your review.</p></div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground"><p>Source messages {messagePage * 25 + 1}–{Math.min((messagePage + 1) * 25, selection.messages.length)} of {selection.messages.length} · {Object.keys(drafts).length} mapped drafts</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={messagePage === 0} onClick={() => setMessagePage(page => page - 1)}>Previous messages</Button><Button size="sm" variant="outline" disabled={(messagePage + 1) * 25 >= selection.messages.length} onClick={() => setMessagePage(page => page + 1)}>Next messages</Button></div></div>
        <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1" aria-label="Conversation source messages">
          {selection.messages.slice(messagePage * 25, (messagePage + 1) * 25).map((message, pageIndex) => { const index = messagePage * 25 + pageIndex; return <article key={message.nodeId} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs">{index + 1}. {message.role.slice(0, 100)} · {message.createdAt ? dateTime(message.createdAt) : 'Unknown source message time'}</p><p className="mt-1 break-all text-[9px] text-muted-foreground">Node {message.nodeId} · Message {message.messageId ?? 'ID unknown'}</p></div><label className="flex items-center gap-2 text-[11px]"><input type="checkbox" aria-label={`Map source message ${index + 1}`} checked={Object.hasOwn(drafts, message.nodeId)} onChange={event => { setConsent(false); setDrafts(old => { const next = { ...old }; if (event.target.checked) next[message.nodeId] = JSON.stringify(emptyMessageMapping(), null, 2); else delete next[message.nodeId]; return next; }); }} />Map this source message</label></div>
            <details className="mt-3"><summary className="cursor-pointer text-[11px] text-primary">Original text and source reference</summary><p className="mt-2 break-all text-[9px] text-muted-foreground">{message.sourceReference}</p><pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">{message.text || 'No supported text. Non-text parts remain in the retained source; attachments are not interpreted.'}</pre>{message.unsupportedParts > 0 && <p className="mt-2 text-[10px] text-amber-200">{message.unsupportedParts} non-text source parts retained, not interpreted.</p>}</details>
            {Object.hasOwn(drafts, message.nodeId) && <label className="mt-4 block"><span className="label">Manual historical fields for source message {index + 1} · JSON object or array</span><textarea className="input min-h-64 font-mono text-[11px]" style={{minHeight:'16rem'}} aria-label={`Mapped fields for source message ${index + 1}`} value={drafts[message.nodeId]} onChange={event => { setConsent(false); setDrafts(old => ({ ...old, [message.nodeId]: event.target.value })); }} spellCheck={false} /><span className="mt-2 block text-[10px] leading-relaxed text-muted-foreground">For multiple predictions in this message, enter an explicit array of record objects. A single parlay remains one record with a legs array. Do not infer missing odds, stakes, probabilities or dates. Source references/classification are attached separately; unknown facts stay null. The next screen checks duplicates, missing facts and reconciliation.</span></label>}
          </article>; })}
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/3 p-4 text-[11px] leading-relaxed"><input type="checkbox" className="mt-0.5" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I selected only the relevant experiment conversation and reviewed its content. I understand the complete selected conversation, including other branches, will accompany the proposed records. Prepare a draft only; saving still requires the import wizard’s explicit confirmation.</span></label>
        <Button disabled={busy || !consent || Object.keys(drafts).length === 0} onClick={() => void prepare()}><ShieldCheck />Prepare mapped records for review</Button>
      </>}
      {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs leading-relaxed text-red-200">{error}</p>}
    </div>
  </section>;
}
