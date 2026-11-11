'use client';

import Link from 'next/link';
import { Archive, ArrowRight, FileSearch, Save, X } from 'lucide-react';
import type { HistoricalWagerClaim } from '@/lib/imports/wager-claim-provenance';
import { money, signedMoney } from '@/lib/utils';
import { Button } from '../ui/button';
import { useWagerClaims } from './use-wager-claims';
import { summarizeWagerClaims } from '@/lib/imports/wager-claims';

const amount = (value: number | null) => value === null ? 'Incomplete evidence' : money(value);
const price = (value: number | null) => value === null ? 'Unknown' : new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false }).format(value);

function ClaimSummary({ state, preferSaved = false }: { state: ReturnType<typeof useWagerClaims>; preferSaved?: boolean }) {
  const { review: attachedReview, archived, mode } = state;
  const review = preferSaved && archived.rows.length ? undefined : attachedReview;
  // Choose one source set. Never add browser attachments to archive or ledger totals.
  const summary = review?.summary ?? archived.summary;
  const present = !!review || archived.rows.length > 0;
  if (!present) return <p className="text-xs leading-relaxed text-muted-foreground">No historical wager claim source is attached or saved in this workspace. Review a source file in Historical Import to show its provisional history here. The registered actual ledger remains separate.</p>;
  const source = review ? 'Browser attachment · source preview' : 'Saved historical archive';
  const knownSettled = (review?.envelope.records ?? archived.rows.map(row => row.claim)).filter(claim =>
    claim.reportedOutcome !== null && claim.reportedOutcome !== 'pending' && claim.reportedStakeCents !== null && claim.reportedCashPayoutCents !== null && claim.stakeType !== null);
  const settledSubtotal = !summary.duplicateUncertainty && knownSettled.length ? summarizeWagerClaims(knownSettled).reportedRealisedProfitCents : null;
  return <div className="space-y-3">
    <p className="text-[11px] text-amber-200">{mode === 'demo' ? 'SYNTHETIC claim fixture' : 'Owner-reported historical claims'} · {source} · {summary.claimCount} claims</p>
    {summary.duplicateUncertainty && <p className="text-xs text-amber-200">Possible duplicate claims require identity review. Financial rollups remain unknown; the source records have not been merged or deleted.</p>}
    {!review && archived.warnings.map((warning, index) => <p key={index} className="text-[11px] text-amber-200">{warning}</p>)}
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div><dt className="text-[10px] text-muted-foreground">Reported realised P/L</dt><dd className="mt-1 text-lg tabular-nums">{summary.reportedRealisedProfitCents === null ? 'Incomplete evidence' : signedMoney(summary.reportedRealisedProfitCents)}</dd><p className="mt-1 text-[10px] text-muted-foreground">{summary.settledCashCount} cash + {summary.settledBonusCount} promotional source outcomes</p></div>
      <div><dt className="text-[10px] text-muted-foreground">Reported unresolved cash exposure</dt><dd className="mt-1 text-lg tabular-nums">{amount(summary.pendingCashExposureCents)}</dd><p className="mt-1 text-[10px] text-muted-foreground">{summary.pendingCashCount} source-pending claims · current outcomes unverified</p></div>
      <div><dt className="text-[10px] text-muted-foreground">Reported settled cash stakes / returns</dt><dd className="mt-1 text-lg tabular-nums">{amount(summary.settledCashStakeCents)} / {amount(summary.settledCashReturnCents)}</dd><p className="mt-1 text-[10px] text-muted-foreground">Excludes promotional face value and paper activity</p></div>
      <div><dt className="text-[10px] text-muted-foreground">Reported promotional cash winnings</dt><dd className="mt-1 text-lg tabular-nums">{amount(summary.bonusCashWinningsCents)}</dd><p className="mt-1 text-[10px] text-muted-foreground">Promotional stake is not cash staked or returned</p></div>
    </dl>
    {summary.unknownFinancialRows > 0 && <p className="text-[11px] leading-relaxed text-amber-200">{summary.unknownFinancialRows} claims have incomplete financial evidence; their stakes or returns are not inferred. {settledSubtotal !== null ? `Known settled-source subset: ${signedMoney(settledSubtotal)} across ${knownSettled.length} reported settlements. This is a subtotal, not the complete experiment P/L or a verified balance.` : 'No complete settled-source subtotal is available.'}</p>}
    <p className="text-[11px] leading-relaxed text-muted-foreground">This provisional source summary is separate from registered actual-ledger totals, bankroll and ROI. {review ? 'An attached source may include claims already archived or registered; matches are shown in its review and these totals are never added to existing totals. ' : ''}No deposit, available sportsbook balance or new settlement is inferred.</p>
  </div>;
}

export function HistoricalWagerClaimsSummary() {
  const state = useWagerClaims();
  return <section className="panel space-y-4 p-5" aria-label="Historical wager claims summary">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-medium"><Archive className="size-4 text-amber-200" />Historical wager claims</h2><p className="mt-1 text-[11px] text-muted-foreground">Reported history awaiting evidence and separate financial approval.</p></div><Button size="sm" variant="outline" asChild><Link href="/imports#historical-wager-claims">Review historical wagers <ArrowRight /></Link></Button></div>
    {state.loading ? <p className="text-xs text-muted-foreground">Loading this workspace’s historical claim context…</p> : state.workspaceError ? <p role="alert" className="text-xs text-red-300">Private workspace reconciliation is unavailable: {state.workspaceError}</p> : !state.ready ? <p className="text-xs text-muted-foreground">Open your authenticated private workspace to review its historical claims.</p> : <ClaimSummary state={state} preferSaved />}
    {state.error && <p role="alert" className="text-xs text-amber-200">{state.error}</p>}
  </section>;
}

function ClaimDetails({ claim }: { claim: HistoricalWagerClaim }) {
  return <details className="mt-2"><summary className="cursor-pointer text-[10px] text-primary">Sources, original claims and missing evidence</summary><div className="mt-2 space-y-2 text-[10px] text-muted-foreground">
    <p>Accepted execution odds: {price(claim.acceptedOdds)} · Ticket ID: {claim.ticketId ?? 'Unknown'} · Original placement: {claim.placedAt ?? 'Unknown'} · Original settlement: {claim.settledAt ?? 'Unknown'}</p>
    {claim.sourceReferences.map((reference, index) => <p key={index} className="break-all">Source: {reference}</p>)}
    {claim.evidenceNotes.map((note, index) => <p key={index}>{note}</p>)}
    {claim.legs.length > 0 && <div className="space-y-1">{claim.legs.map((leg, index) => <p key={index}>{index + 1}. {leg.event ?? 'Fixture unknown'} · {leg.participant ?? 'Participant unknown'} · {leg.selection ?? 'Selection unknown'} · line {leg.line ?? 'unknown'} · original leg price {price(leg.odds)} · source outcome {leg.outcome ?? 'unknown'} · statistic {leg.statistic ?? 'unknown'}</p>)}</div>}
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded border border-border p-2">{JSON.stringify(claim, null, 2)}</pre>
  </div></details>;
}

export function WagerClaimsIntake({ onMappedSource }: { onMappedSource: (source: { text: string; sourceName: string }) => void }) {
  const state = useWagerClaims();
  const { review, archived, source } = state;
  const rows = review?.rows ?? [];
  const canReview = state.ready && !state.error && !!review && rows.some(row => row.archiveEligible);
  return <section id="historical-wager-claims" className="panel space-y-5 scroll-mt-6 p-5" aria-label="Historical actual wager claims review">
    <div><h2 className="flex items-center gap-2 text-sm font-medium"><FileSearch className="size-4 text-primary" />Historical actual wager claims</h2><p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">Attach a reviewed historical wager claims JSON file. Reported prices stay separate from accepted execution odds. Missing execution evidence blocks the actual ledger while incomplete history can be approved for the archive.</p></div>
    <label className="block"><span className="label">Historical wager claims JSON · up to 1 MiB</span><input aria-label="Historical wager claims JSON" type="file" accept=".json,application/json" disabled={!state.ready} className="mt-2 max-w-full text-xs" onChange={event => void state.choose(event.target.files?.[0])} /></label>
    {state.loading ? <p className="text-xs text-muted-foreground">Loading the current private archive and actual ledger before duplicate checks…</p> : state.workspaceError ? <p role="alert" className="text-xs text-red-300">Reconciliation is unavailable: {state.workspaceError}. Resolve the workspace error before continuing.</p> : !state.ready ? <p className="text-xs text-muted-foreground">Use your existing signed-in private workspace for owner-reported history. Demo accepts synthetic fixtures only.</p> : <ClaimSummary state={state} />}
    {source && <div className="flex flex-wrap items-center gap-2"><p className="mr-auto break-all text-[11px] text-muted-foreground">{source.name} · {source.retained ? 'retained in this browser for this workspace' : 'attached for this open page only'}</p><Button size="sm" variant="outline" disabled={!review || source.retained || !!state.error} onClick={state.retain}><Save />{source.retained ? 'Retained on this browser' : 'Retain on this browser'}</Button><Button size="sm" variant="ghost" onClick={state.clear}><X />Clear local attachment</Button></div>}
    {!source && state.error && <Button size="sm" variant="ghost" onClick={state.clear}>Clear invalid local attachment</Button>}
    {review && <>
      <div className="table-wrap rounded-lg border border-border"><table className="data-table"><thead><tr><th>Claim / source identity</th><th>Reported stake and price</th><th>Accepted execution</th><th>Reported cash payout / status</th><th>Registration and duplicates</th></tr></thead><tbody>{rows.map(row => {
        const claim = row.claim;
        return <tr key={row.rowNumber}><td className="max-w-sm whitespace-normal"><p className="text-[11px]">{claim.reference} · {claim.event ?? 'Event unknown'}</p><p className="mt-1 text-[10px] text-muted-foreground">{claim.participant ?? 'Participant unknown'} · {claim.selection ?? 'Selection unknown'}</p><ClaimDetails claim={claim} /></td><td><p>{claim.reportedStakeCents === null ? 'Unknown stake' : money(claim.reportedStakeCents)} · {claim.stakeType ?? 'Unknown type'}</p><p className="mt-1 text-[10px] text-amber-200">{claim.reportedOddsKind === 'pre_placement_quote' ? 'Pre-placement quote' : 'Owner-reported price'}: {price(claim.reportedOdds)}</p></td><td><p>{price(claim.acceptedOdds)}</p><p className="mt-1 text-[10px] text-muted-foreground">{claim.acceptedOddsSource ?? 'Execution-price evidence missing'}</p></td><td><p>{claim.reportedCashPayoutCents === null ? 'Unknown cash payout' : money(claim.reportedCashPayoutCents)}</p><p className="mt-1 text-[10px] text-muted-foreground">Source reported: {claim.reportedOutcome ?? 'unknown'}{claim.reportedOutcome === 'pending' ? ' · current outcome unverified' : ''}</p></td><td className="max-w-sm whitespace-normal"><p className="text-[10px] text-amber-200">{row.financial.bet ? 'Complete source · separate financial confirmation required' : 'Blocking: actual financial registration unavailable'}</p><p className="mt-1 text-[10px] text-muted-foreground">{row.archiveEligible ? 'Archive review available; no financial effect' : 'Archive selection blocked; inspect duplicate/validation warnings'}</p>{row.duplicates.map((duplicate, index) => <p key={`archive:${index}`} className="mt-2 text-[10px] text-amber-200">{duplicate.level.toUpperCase()} archive match: {duplicate.reason}</p>)}{row.ledgerMatches.map((match, index) => <p key={`ledger:${index}`} className="mt-2 text-[10px] text-amber-200">{match.level.toUpperCase()} ledger match: {match.reason}</p>)}{row.financial.issues.length > 0 && <details className="mt-2"><summary className="cursor-pointer text-[10px] text-primary">Missing / inconsistent financial evidence ({row.financial.issues.length})</summary><div className="mt-2 space-y-1">{row.financial.issues.map((issue, index) => <p key={index} className="text-[10px] text-muted-foreground">{issue.field}: {issue.message}</p>)}</div></details>}</td></tr>;
      })}</tbody></table></div>
      {review.warnings.length > 0 && <details className="rounded-lg border border-amber-200/20 p-3"><summary className="cursor-pointer text-xs text-amber-200">Source and reconciliation warnings ({review.warnings.length})</summary><div className="mt-3 space-y-2">{review.warnings.map((warning, index) => <p key={index} className="text-[11px] text-muted-foreground">{warning}</p>)}</div></details>}
      <p className="text-[11px] leading-relaxed text-muted-foreground">Continue opens the existing Historical Import review. Select individual rows, acknowledge warnings, review its final confirmation and explicitly approve archive saving. That save does not register any actual wager. Financially complete actual entries still require Review actual-ledger registration → Confirm financial registration for each entry.</p>
      <Button variant="outline" disabled={!canReview} onClick={() => onMappedSource({ text: review.rawSource, sourceName: review.sourceName })}>Review claims in existing importer <ArrowRight /></Button>
      {!canReview && <p className="text-[11px] text-amber-200">No new archive-eligible rows. Do not repeat an existing import; inspect the current matches and warnings.</p>}
    </>}
    {!review && archived.rows.length > 0 && <p className="text-[11px] text-muted-foreground">{archived.rows.length} saved claim records provide the provisional summary above. Open their immutable sources in the archive below; attach a source file only to review new or overlapping evidence.</p>}
    <p className="text-[10px] leading-relaxed text-muted-foreground">Browser retention is explicit and scoped to this user/workspace. It makes no Supabase write. Clearing an attachment never deletes saved records. Funding transactions must have their own evidence and are never generated from wager claims.</p>
    {state.error && <p role="alert" className="break-words text-xs text-red-300">{state.error}</p>}
  </section>;
}
