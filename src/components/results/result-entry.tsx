'use client';

import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { SettlementObservation, SettlementTarget } from '@/lib/results';
import { dateTime, money } from '@/lib/utils';
import { melbourneInput, utcFromMelbourne } from '@/lib/domain/ledger-review';
import { Button } from '../ui/button';

export interface ResultEntryDraft {
  identityHash: string;
  started: boolean;
  outcome: '' | 'won' | 'lost' | 'void';
  eventDate: string;
  settledAt: string;
  sourceUrl: string;
  observedAt: string;
  sourceNote: string;
  additionalSources?: SettlementObservation['sources'];
  notes: string;
  actualPayout: string;
  eventCompleted: boolean;
  termsConfirmed: boolean;
  termsReference: string;
  ownerAttested: boolean;
  specialCases: SettlementObservation['specialCases'];
  specialCaseResolution: string;
  legs: Record<string, { outcome: '' | 'won' | 'lost' | 'void'; statistic: string; observedValue: string; clearanceMargin: string }>;
}

export function emptyResultDraft(target: SettlementTarget): ResultEntryDraft {
  return { identityHash: target.identityHash, started: false, outcome: '', eventDate: target.eventDate ?? '', settledAt: '', sourceUrl: '', observedAt: '', sourceNote: '', notes: '', actualPayout: '', eventCompleted: false, termsConfirmed: false, termsReference: '', ownerAttested: false, specialCases: [], specialCaseResolution: '', legs: Object.fromEntries(target.legs.map(leg => [leg.legId, { outcome: '', statistic: '', observedValue: '', clearanceMargin: '' }])) };
}

/** Provider proposals prefill observations only. Payout and terms remain blank. */
export function draftFromObservation(target: SettlementTarget, source: SettlementObservation): ResultEntryDraft {
  const first = source.sources[0];
  return { ...emptyResultDraft(target), started: true, outcome: source.outcome ?? '', eventDate: source.eventDate ?? '',
    settledAt: source.settledAt ? melbourneInput(source.settledAt) : '', sourceUrl: first?.url ?? '',
    observedAt: first ? melbourneInput(first.observedAt) : '', sourceNote: first?.note ?? '', additionalSources: source.sources.slice(1),
    notes: source.notes ?? '', eventCompleted: source.eventCompleted, termsConfirmed: false, termsReference: '', ownerAttested: false,
    legs: Object.fromEntries(source.legs.map(leg => [leg.legId, { outcome: leg.outcome ?? '', statistic: leg.statistic ?? '', observedValue: leg.observedValue === null ? '' : String(leg.observedValue), clearanceMargin: leg.clearanceMargin === null ? '' : String(leg.clearanceMargin) }])) };
}

const numberOrNull = (value: string, name: string): number | null => {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a finite number or blank.`);
  return number;
};

/** No inferred timing, payout, event result or leg statistics. */
export function observationFromDraft(target: SettlementTarget, draft: ResultEntryDraft): SettlementObservation {
  const payout = draft.actualPayout.trim();
  if (payout && !/^\d+(?:\.\d{1,2})?$/.test(payout)) throw new Error('Actual cash payout must use AUD with at most two decimal places.');
  return {
    kind: target.kind, recordId: target.recordId, identityHash: target.identityHash,
    sport: target.sport, event: target.event, eventDate: draft.eventDate || null,
    outcome: draft.outcome || null, settledAt: draft.settledAt ? utcFromMelbourne(draft.settledAt) : null,
    eventCompleted: draft.eventCompleted, termsConfirmed: draft.termsConfirmed, termsReference: draft.termsReference.trim() || null,
    verification: draft.sourceUrl.trim() ? 'source_supplied' : 'owner_attested', ownerAttested: draft.ownerAttested,
    sources: draft.sourceUrl.trim() ? [{ url: draft.sourceUrl.trim(), observedAt: draft.observedAt ? utcFromMelbourne(draft.observedAt) : '', note: draft.sourceNote.trim() || null }, ...(draft.additionalSources ?? [])] : draft.additionalSources ?? [],
    notes: draft.notes.trim() || null, actualPayoutCents: target.kind === 'actual' && payout ? Math.round(Number(payout) * 100) : null,
    legs: target.legs.map(leg => {
      const value = draft.legs[leg.legId] ?? { outcome: '', statistic: '', observedValue: '', clearanceMargin: '' };
      return { legId: leg.legId, sport: leg.sport, event: leg.event, participant: leg.participant, market: leg.market, selection: leg.selection, line: leg.line, outcome: value.outcome || null, statistic: value.statistic.trim() || null, observedValue: numberOrNull(value.observedValue, 'Observed value'), clearanceMargin: numberOrNull(value.clearanceMargin, 'Clearance margin') };
    }), specialCases: draft.specialCases, specialCaseResolution: draft.specialCaseResolution.trim() || null,
  };
}

export function ResultEntry({ target, draft, onChange, imported, disabled = false }: {
  target: SettlementTarget; draft: ResultEntryDraft; onChange: (value: ResultEntryDraft) => void;
  imported?: SettlementObservation; disabled?: boolean;
}) {
  const update = (changes: Partial<ResultEntryDraft>) => onChange({ ...draft, ...changes, started: true });
  const current = imported;
  const readOnly = disabled || !!current;
  return <div className="space-y-4">
    <dl className="grid gap-3 text-[11px] sm:grid-cols-3">
      <div><dt className="text-muted-foreground">Registered position</dt><dd className="mt-1">{target.kind === 'actual' ? `${target.stakeType ?? 'Unknown stake type'} actual wager` : 'Paper prediction'} · {target.stakeCents === null ? 'Stake unknown' : money(target.stakeCents)}</dd></div>
      <div><dt className="text-muted-foreground">Original research / accepted odds</dt><dd className="mt-1">{target.originalOdds ?? 'Unknown'} / {target.acceptedOdds ?? 'Not applicable / unknown'}</dd></div>
      <div><dt className="text-muted-foreground">Research session / day</dt><dd className="mt-1 break-all">{target.sessionId ?? 'Unknown session'} · {target.researchDay ?? 'Day unknown'}</dd></div>
    </dl>
    {current ? <section className="space-y-3 rounded-lg border border-border p-3 text-xs">
      <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" />Proposed {current.outcome ?? 'result unknown'} · {current.verification.replaceAll('_', ' ')}</p>
      <p className="text-muted-foreground">{current.verification === 'source_supplied' ? 'Result retrieved from supplied source evidence.' : 'Independent result unavailable — owner confirmation required.'}</p>
      <details><summary className="cursor-pointer text-[11px]">Advanced Details</summary><div className="mt-3 space-y-2 text-muted-foreground"><p>Settlement: {current.settledAt ? dateTime(current.settledAt) : 'Unknown'} · event date {current.eventDate ?? 'Unknown'}</p><p>Terms: {current.termsReference ?? 'Not supplied'} · {current.termsConfirmed ? 'Confirmed' : 'Not confirmed'}</p>{current.sources.map((source, index) => <p key={index} className="break-all"><a className="text-primary underline" href={source.url} target="_blank" rel="noreferrer">{source.url}<ExternalLink className="ml-1 inline size-3" /></a> · observed {dateTime(source.observedAt)}</p>)}<p>Actual payout: {current.actualPayoutCents === null ? 'Unknown / not applicable' : money(current.actualPayoutCents)}</p>{current.notes && <p>{current.notes}</p>}</div></details>
    </section> : <>
      <div className="space-y-3 rounded-lg border border-primary/15 bg-primary/5 p-4">
        <div><p className="text-xs font-medium">What was the result?</p><p className="mt-1 text-[11px] text-muted-foreground">Choose one outcome. Uncertain retirements, void rules and incomplete results belong in Advanced Details.</p></div>
        <div className="grid grid-cols-3 gap-2">
          {(['won', 'lost', 'void'] as const).map(outcome => <Button key={outcome} type="button" size="sm" variant={draft.outcome === outcome ? 'secondary' : 'outline'} disabled={readOnly} aria-pressed={draft.outcome === outcome} onClick={() => update({ outcome, actualPayout: target.kind === 'actual' && outcome === 'lost' ? '0.00' : draft.actualPayout, ...(target.legs.length === 1 ? { legs: { ...draft.legs, [target.legs[0].legId]: { ...draft.legs[target.legs[0].legId], outcome } } } : {}) })}>{outcome === 'void' ? 'Void / refund' : outcome[0].toUpperCase() + outcome.slice(1)}</Button>)}
        </div>
        {draft.outcome && target.kind === 'actual' && draft.outcome !== 'lost' && <label className="block"><span className="label">Actual sportsbook payout · AUD</span><input className="input" inputMode="decimal" aria-label={`Cash payout ${target.recordId}`} value={draft.actualPayout} disabled={readOnly} onChange={event => update({ actualPayout: event.target.value })} placeholder={draft.outcome === 'void' ? 'Enter credited refund' : 'Enter actual amount received'} /></label>}
        {draft.outcome && <label className="block"><span className="label">Settlement time · Melbourne</span><input className="input" type="datetime-local" aria-label={`Settlement time ${target.recordId}`} value={draft.settledAt} disabled={readOnly} onChange={event => update({ settledAt: event.target.value })} /></label>}
        <label className="flex gap-2 text-xs leading-relaxed"><input type="checkbox" aria-label={`Owner result confirmation ${target.recordId}`} checked={draft.ownerAttested} disabled={readOnly} onChange={event => update({ ownerAttested: event.target.checked, eventCompleted: event.target.checked, termsConfirmed: event.target.checked, termsReference: event.target.checked ? (draft.termsReference || 'Owner confirmed the registered market settlement terms.') : draft.termsReference })} /><span>I checked the final result and the applicable settlement terms. Independent verification is not claimed.</span></label>
      </div>
      <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Advanced Details</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label><span className="label">Event date · Melbourne</span><input className="input" type="date" aria-label={`Event date ${target.recordId}`} value={draft.eventDate} disabled={readOnly} onChange={event => update({ eventDate: event.target.value })} /></label>
        <label><span className="label">Inspectable result source URL</span><input className="input" type="url" aria-label={`Result source ${target.recordId}`} value={draft.sourceUrl} disabled={readOnly} onChange={event => update({ sourceUrl: event.target.value })} placeholder="https://…" /></label>
        <label><span className="label">Source observed at · Melbourne</span><input className="input" type="datetime-local" aria-label={`Observed time ${target.recordId}`} value={draft.observedAt} disabled={readOnly} onChange={event => update({ observedAt: event.target.value })} /></label>
        <div className="flex items-end"><Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={() => update({ observedAt: melbourneInput(new Date().toISOString()) })}>Use current observation time</Button></div>
        <label className="sm:col-span-2"><span className="label">Settlement terms / rule reference</span><input className="input" aria-label={`Settlement terms ${target.recordId}`} value={draft.termsReference} disabled={readOnly} onChange={event => update({ termsReference: event.target.value })} placeholder="Exact known market rules" maxLength={2000} /></label>
        <label className="sm:col-span-2"><span className="label">Result notes / supporting evidence</span><textarea className="input min-h-20" aria-label={`Result notes ${target.recordId}`} value={draft.notes} disabled={readOnly} onChange={event => update({ notes: event.target.value })} maxLength={2000} /></label>
        <label><span className="label">Exceptional settlement case</span><select className="input" aria-label={`Special case ${target.recordId}`} value={draft.specialCases[0] ?? ''} disabled={readOnly} onChange={event => update({ specialCases: event.target.value ? [event.target.value as SettlementObservation['specialCases'][number]] : [] })}><option value="">No exceptional case</option><option value="dnp">Did not play</option><option value="postponed">Postponed</option><option value="retirement">Retirement</option><option value="dead_heat">Dead heat</option><option value="overtime_ambiguous">Overtime ambiguous</option><option value="void_rule_ambiguous">Void rule ambiguous</option><option value="other">Other exception</option></select></label>
        {draft.specialCases.length > 0 && <label className="sm:col-span-2"><span className="label">Exception resolution</span><input className="input" aria-label={`Special case resolution ${target.recordId}`} value={draft.specialCaseResolution} disabled={readOnly} onChange={event => update({ specialCaseResolution: event.target.value })} maxLength={2000} placeholder="Unknown rules remain pending" /></label>}
      </div></details>
    </>}
    <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs">Individual legs and statistics ({target.legs.length})</summary><div className="mt-3 space-y-3">{target.legs.map((leg, index) => {
      const value = draft.legs[leg.legId] ?? { outcome: '', statistic: '', observedValue: '', clearanceMargin: '' };
      const observed = current?.legs.find(item => item.legId === leg.legId);
      return <div key={leg.legId} className="rounded border border-border p-3 text-xs"><p>{index + 1}. {leg.participant ?? 'Participant unknown'} · {leg.event ?? 'Fixture unknown'}</p><p className="mt-1 text-muted-foreground">{leg.market ?? 'Market unknown'} · {leg.selection ?? 'Selection unknown'} · line {leg.line ?? 'Unknown'} · original leg price {leg.odds ?? 'Unknown'}</p>
        {observed ? <p className="mt-2">Proposed {observed.outcome ?? 'unknown'} · statistic {observed.statistic ?? 'unknown'} · observed value {observed.observedValue ?? 'unknown'} · clearance {observed.clearanceMargin ?? 'unknown'}</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label><span className="label">Leg result</span><select className="input" aria-label={`Leg result ${leg.legId}`} value={value.outcome} disabled={readOnly} onChange={event => update({ legs: { ...draft.legs, [leg.legId]: { ...value, outcome: event.target.value as ResultEntryDraft['outcome'] } } })}><option value="">Unknown</option><option value="won">Won</option><option value="lost">Lost</option><option value="void">Void</option></select></label><label><span className="label">Final statistic / result</span><input className="input" aria-label={`Leg statistic ${leg.legId}`} value={value.statistic} maxLength={500} disabled={readOnly} onChange={event => update({ legs: { ...draft.legs, [leg.legId]: { ...value, statistic: event.target.value } } })} /></label><label><span className="label">Observed numerical value</span><input className="input" inputMode="decimal" aria-label={`Leg value ${leg.legId}`} value={value.observedValue} disabled={readOnly} onChange={event => update({ legs: { ...draft.legs, [leg.legId]: { ...value, observedValue: event.target.value } } })} /></label><label><span className="label">Clearance margin · if sourced</span><input className="input" inputMode="decimal" aria-label={`Leg clearance ${leg.legId}`} value={value.clearanceMargin} disabled={readOnly} onChange={event => update({ legs: { ...draft.legs, [leg.legId]: { ...value, clearanceMargin: event.target.value } } })} /></label></div>}
      </div>;
    })}</div></details>
  </div>;
}
