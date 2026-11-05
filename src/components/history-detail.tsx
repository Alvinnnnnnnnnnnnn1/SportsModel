'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BellPlus, FileCheck2, ShieldCheck, Wallet, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useApp } from './app-provider';
import { useHistory } from './history-provider';
import { ApprovalStatusBadges } from './approval-status';
import { BetForm } from './bet-form';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import type { HistoricalRecord } from '@/lib/imports/types';
import type { Bet } from '@/lib/domain/types';
import { computeHypothetical, financialReview } from '@/lib/imports';
import { readArchivedWagerClaim } from '@/lib/imports/wager-claim-provenance';
import { findHistoricalLedgerMatches } from '@/lib/imports/wager-claims';
import { financialRequirementChecklist } from '@/lib/domain/ledger-review';
import { dateTime, money, percent } from '@/lib/utils';

export function HistoricalField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div><dt className="text-[10px] text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-xs">{value === null || value === undefined || value === '' ? <span className="italic text-[#748379]">Unknown</span> : value}</dd></div>;
}
function WagerClaimProvenance({ record }: { record: HistoricalRecord }) {
  const source = readArchivedWagerClaim(record);
  if (!source) return null;
  const claim = source.claim;
  return <section className="mt-4 space-y-3 rounded-lg border border-border p-4" aria-label="Reported wager provenance">
    <p className="text-xs text-amber-200">{source.sourceClass === 'synthetic' ? 'SYNTHETIC historical claim fixture' : 'Owner-reported historical claim'} · execution and source-time outcome remain subject to verification.</p>
    <dl className="grid grid-cols-2 gap-4"><HistoricalField label={claim.reportedOddsKind === 'pre_placement_quote' ? 'Reported pre-placement quote' : 'Owner-reported price'} value={claim.reportedOdds} /><HistoricalField label="Accepted execution odds" value={claim.acceptedOdds} /><HistoricalField label="Execution price source" value={claim.acceptedOddsSource} /><HistoricalField label="Ticket reference" value={claim.ticketId} /></dl>
    <p className="text-[11px] text-muted-foreground">A reported price is not accepted execution evidence. A source-pending status is not a newly verified outcome.</p>
  </section>;
}
function FinancialConfirmation({ record, onClose }: { record: HistoricalRecord; onClose: () => void }) {
  const { confirmActual } = useHistory();
  const { mode, notify, data } = useApp();
  const [confirmed, setConfirmed] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const review = financialReview(record);
  const ledgerMatches = readArchivedWagerClaim(record) ? findHistoricalLedgerMatches(record, data.bets) : [];
  const requirements = financialRequirementChecklist(review.issues);
  const eligible = !!review.bet && ledgerMatches.length === 0;
  async function save() {
    if (!eligible || !confirmed || saving) return;
    setSaving(true); setError('');
    try { await confirmActual(record.id); notify('Historical actual entry registered · no funding inferred'); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The ledger entry was not saved.'); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>Review financial registration</DialogTitle><DialogDescription>Archive approval preserved evidence only. This separate action would register an actual wager and change ledger totals.</DialogDescription></DialogHeader>
    <ApprovalStatusBadges facts={{ archived: true, mode, ownerAttested: record.snapshot.verification === 'user_confirmed' }} />
    <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4"><HistoricalField label="Recorded stake" value={record.snapshot.stakeCents === null ? null : money(record.snapshot.stakeCents)} /><HistoricalField label="Stake type" value={record.snapshot.stakeType} /><HistoricalField label={readArchivedWagerClaim(record) ? 'Accepted execution odds' : 'Original odds'} value={record.snapshot.odds} /><HistoricalField label="Source-reported outcome" value={record.snapshot.outcome} /><HistoricalField label="Reported payout" value={record.snapshot.payoutCents === null ? null : money(record.snapshot.payoutCents)} /><HistoricalField label="Calculated cash return" value={review.expectedPayoutCents === null ? null : money(review.expectedPayoutCents)} /></dl>
    <WagerClaimProvenance record={record} />
    {ledgerMatches.length > 0 && <p role="alert" className="text-xs text-amber-200">An actual ledger entry overlaps this source or selection. Review the linked wager instead of registering it again.</p>}
    {requirements.length > 0 && <section className="space-y-3 rounded-lg border border-amber-300/20 p-4" aria-label="Financial registration requirements"><h3 className="text-sm font-medium">Financial registration blocked · {requirements.length} outstanding requirements</h3><ul className="list-disc space-y-2 pl-4 text-xs text-muted-foreground">{requirements.map(item => <li key={item}>{item}</li>)}</ul><details><summary className="cursor-pointer text-[11px] text-primary">Exact validation details ({review.issues.length})</summary><div className="mt-2 space-y-1">{review.issues.map((issue, index) => <p key={index} className="text-[10px] text-muted-foreground">{issue.field}: {issue.message}</p>)}</div></details><p className="text-[11px] text-muted-foreground">Preserve new supporting evidence as a separately reviewed Historical Import source. The archived original stays immutable; do not fill unknowns with a quote, import time or guessed result.</p></section>}
    {eligible && <label className="flex gap-3 rounded-lg border border-border p-3 text-xs leading-relaxed"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>{mode === 'demo' ? 'I confirm this is a synthetic actual-ledger test.' : 'I confirm I placed this bet outside EdgeLab and reviewed its execution price, stake, timestamps and outcome.'} I authorize this entry to change actual-ledger totals.</span></label>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>{eligible ? 'Cancel' : 'Back to source'}</Button><Button disabled={!eligible || !confirmed || saving} onClick={() => void save()} title={!eligible ? 'Resolve the checklist and any linked-ledger duplicate before financial registration.' : !confirmed ? 'Explicit financial authorization is required.' : undefined}><Wallet />{saving ? 'Recording…' : 'Confirm financial registration'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
export function HistoryDetail({ record, onClose }: { record?: HistoricalRecord; onClose: () => void }) {
  const { history, createNotification } = useHistory();
  const { data, notify, mode } = useApp();
  const [financial, setFinancial] = useState(false), [busy, setBusy] = useState(false), [editing, setEditing] = useState<Bet>();
  if (!record) return null;
  const s = record.snapshot, ledgerBet = data.bets.find(bet => bet.id === record.id);
  const source = readArchivedWagerClaim(record);
  const paper = history.paperResults.find(result => result.recordId === record.id);
  const hypothetical = paper ? computeHypothetical(record, paper) : null;
  const alert = history.notifications.find(notification => notification.recordId === record.id);
  const audits = history.audit.filter(entry => entry.recordId === record.id || entry.batchId === record.batchId);
  const hasResearchSelection = s.kind === 'paper' || s.kind === 'actual' || s.selection !== null || s.market !== null;
  async function generate() {
    if (!record || alert || busy) return;
    setBusy(true);
    try { await createNotification(record.id); notify('Research notification registered'); }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Notification was not saved.'); }
    finally { setBusy(false); }
  }
  return <>
    <Dialog open={!financial && !editing} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><ApprovalStatusBadges facts={{ archived: true, mode, ownerAttested: s.verification === 'user_confirmed', financialRegistered: !!ledgerBet, paperRegistered: !!paper, outcome: ledgerBet?.outcome ?? paper?.outcome, paperSettlementEligible: hypothetical?.accuracyEligible ?? false }} /><DialogTitle>{s.participant ?? s.event ?? 'Historical research record'}</DialogTitle><DialogDescription>Original evidence archived {dateTime(record.importedAt)}. Archive saving, paper tracking and financial registration are separate actions.</DialogDescription></DialogHeader>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border p-4 sm:grid-cols-3"><HistoricalField label="Sport" value={s.sport} /><HistoricalField label="Event" value={s.event} /><HistoricalField label="Market" value={s.market} /><HistoricalField label="Exact selection" value={s.selection} /><HistoricalField label="Threshold / line" value={s.line} /><HistoricalField label="Bookmaker" value={s.bookmaker} /><HistoricalField label={source ? 'Accepted execution odds' : 'Original research / source odds'} value={s.odds} /><HistoricalField label="Original probability" value={s.probability === null ? null : percent(s.probability * 100)} /><HistoricalField label="Strategy" value={s.strategy === null ? null : `Track ${s.strategy}`} /><HistoricalField label="Recorded stake" value={s.stakeCents === null ? null : money(s.stakeCents)} /><HistoricalField label="Stake type" value={s.stakeType} /><HistoricalField label="Source-reported outcome" value={s.outcome} /><HistoricalField label="Registered / tracking outcome" value={ledgerBet?.outcome ?? paper?.outcome ?? null} /><HistoricalField label="Evidence classification" value={s.verification === 'user_confirmed' ? 'Owner-attested · not independently verified' : s.verification === 'synthetic' ? 'Synthetic fixture' : 'Unverified source'} /><HistoricalField label="Registration" value={ledgerBet ? 'Financially registered' : paper ? 'Paper tracking only' : 'Archived evidence only'} /></dl>
      <WagerClaimProvenance record={record} />
      {s.kind === 'paper' && !hypothetical?.accuracyEligible && <p className="text-[11px] text-amber-200">Historical source outcomes do not establish a qualifying pre-event forecast or independently verified settlement.</p>}
      <section className="rounded-lg border border-border p-4"><h3 className="text-xs font-medium">Source and linked records</h3><dl className="mt-3 grid grid-cols-2 gap-4"><HistoricalField label="Source reference" value={s.sourceReference} /><HistoricalField label="External reference" value={s.externalId} /><HistoricalField label="Original prediction timestamp" value={s.predictionAt ? dateTime(s.predictionAt) : null} /><HistoricalField label="Original placement" value={s.placedAt ? dateTime(s.placedAt) : null} /><HistoricalField label="Source result timestamp" value={s.settledAt ? dateTime(s.settledAt) : null} /><HistoricalField label="Original payout" value={s.payoutCents === null ? null : money(s.payoutCents)} /><HistoricalField label="Probability method / version" value={s.probabilityMethod === null && s.modelVersion === null ? null : `${s.probabilityMethod ?? 'Unknown method'} · ${s.modelVersion ?? 'Unknown version'}`} /><HistoricalField label="Linked actual / paper / alert" value={`${ledgerBet ? '1 actual' : '0 actual'} · ${paper ? '1 paper state' : '0 paper states'} · ${alert ? '1 notification' : '0 notifications'}`} /></dl></section>
      {s.legs.length > 0 && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Original selections and leg evidence ({s.legs.length})</summary><div className="mt-3 space-y-2">{s.legs.map((leg, index) => <div key={leg.id} className="rounded-lg border border-border p-3 text-xs"><p>{index + 1}. {leg.sport ?? 'Unknown sport'} · {leg.participant ?? 'Unknown participant'}</p><p className="mt-1 text-muted-foreground">{leg.market ?? 'Unknown market'} · {leg.selection ?? 'Unknown selection'} · line {leg.line ?? 'unknown'} · odds {leg.odds ?? 'unknown'} · source outcome {leg.outcome ?? 'unknown'}</p>{leg.statistic && <p className="mt-1 text-muted-foreground">Source statistic: {leg.statistic}</p>}</div>)}</div></details>}
      {record.issues.length > 0 && <details className="rounded-lg border border-border p-3"><summary className="flex cursor-pointer items-center gap-2 text-xs text-amber-200"><AlertTriangle className="size-3.5" />Missing information and review flags ({record.issues.length})</summary><div className="mt-3 space-y-1">{record.issues.map((issue, index) => <p key={index} className="text-[11px] text-muted-foreground">{issue.field}: {issue.message}</p>)}</div></details>}
      <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Review source · original row and transformations</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{JSON.stringify({ raw: record.raw, transformations: record.transformations }, null, 2)}</pre></details>
      <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Audit history ({audits.length})</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{JSON.stringify(audits, null, 2)}</pre></details>
      <p className="flex gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" />Original evidence is immutable. New evidence and result changes use separate reviewed, audited actions; a source URL or owner attestation alone is not independent verification.</p>
      <DialogFooter>{hasResearchSelection && <Button variant="outline" disabled={busy || !!alert} onClick={() => void generate()} title={alert ? 'One source-linked notification already exists; use Notifications to review it.' : undefined}><BellPlus />{alert ? 'Notification registered' : 'Create research notification'}</Button>}{s.kind === 'paper' && <Button variant="outline" asChild><Link href="/paper" onClick={onClose}>Open paper tracking <ArrowUpRight /></Link></Button>}{ledgerBet ? <Button onClick={() => setEditing(ledgerBet)}><FileCheck2 />{ledgerBet.outcome === 'pending' ? 'Settle registered wager' : 'Review registered wager'}</Button> : s.kind === 'actual' && <Button onClick={() => setFinancial(true)}><FileCheck2 />Review actual-ledger registration</Button>}</DialogFooter>
    </DialogContent></Dialog>
    {financial && <FinancialConfirmation record={record} onClose={() => setFinancial(false)} />}
    <BetForm open={!!editing} initial={editing} onOpenChange={open => { if (!open) setEditing(undefined); }} />
  </>;
}
