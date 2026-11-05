import { betReturn } from './calculations';
import type { Bet } from './types';
import { betSchema } from './validation';

const TICKET_PREFIX = '[EdgeLab ticket reference] ';
const PAYOUT_PREFIX = '[EdgeLab recorded cash payout cents] ';

export function readLedgerEvidence(notes: string): { notes: string; ticketReference: string; payoutCents: number | null } {
  let ticketReference = '', payoutCents: number | null = null;
  const retained = notes.split('\n').filter(line => {
    if (line.startsWith(TICKET_PREFIX)) { ticketReference = line.slice(TICKET_PREFIX.length); return false; }
    if (line.startsWith(PAYOUT_PREFIX) && /^\d+$/.test(line.slice(PAYOUT_PREFIX.length))) {
      const value = Number(line.slice(PAYOUT_PREFIX.length));
      if (Number.isSafeInteger(value) && value <= 100_000_000) { payoutCents = value; return false; }
    }
    return true;
  });
  return { notes: retained.join('\n').trim(), ticketReference, payoutCents };
}

/** Existing audited notes carry optional evidence; no new database entity or payout transaction. */
export function writeLedgerEvidence(notes: string, ticketReference: string, payoutCents: number | null): string {
  if (/[\r\n]/.test(ticketReference) || ticketReference.trim().length > 200) throw new Error('Use one ticket reference of at most 200 characters.');
  if (payoutCents !== null && (!Number.isSafeInteger(payoutCents) || payoutCents < 0 || payoutCents > 100_000_000)) throw new Error('Enter a valid recorded cash payout.');
  const original = readLedgerEvidence(notes).notes;
  return [original, ...(ticketReference.trim() ? [TICKET_PREFIX + ticketReference.trim()] : []), ...(payoutCents === null ? [] : [PAYOUT_PREFIX + payoutCents])].filter(Boolean).join('\n');
}

export function enteredMoneyCents(value: string, label: string, allowZero = false): number {
  const cents = Math.round(Number(value) * 100);
  if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isSafeInteger(cents) || cents < (allowZero ? 0 : 1) || cents > 100_000_000)
    throw new Error(`Enter ${label} ${allowZero ? 'of zero or more' : 'greater than zero'} with at most two decimal places.`);
  return cents;
}

export function reviewLedgerEntry(value: unknown, recordedPayoutCents: number | null): { bet: Bet | null; issues: string[]; cashReturnCents: number | null } {
  const parsed = betSchema.safeParse(value);
  if (!parsed.success) return { bet: null, issues: parsed.error.issues.map(issue => `${friendlyLedgerField(issue.path.join('.'))}: ${issue.message}`), cashReturnCents: null };
  const bet = parsed.data;
  if (bet.outcome === 'pending') return recordedPayoutCents === null ? { bet, issues: [], cashReturnCents: null } : { bet: null, issues: ['A pending wager cannot have a recorded cash payout.'], cashReturnCents: null };
  const expected = betReturn(bet);
  if (recordedPayoutCents === null) return { bet: null, issues: ['Enter the actual cash payout, including zero for a loss or a bonus void.'], cashReturnCents: expected };
  if (recordedPayoutCents !== expected) return { bet: null, issues: ['The recorded cash payout does not match the cash/bonus settlement calculation. Check the original settlement price and terms; no balancing transaction will be created.'], cashReturnCents: expected };
  return { bet, issues: [], cashReturnCents: expected };
}

export function friendlyLedgerField(path: string): string {
  const names: Record<string, string> = { odds: 'Accepted / final settlement odds', placedAt: 'Placement timestamp', settledAt: 'Settlement timestamp', bookmaker: 'Bookmaker', stakeCents: 'Stake', stakeType: 'Cash / bonus classification', strategy: 'Research track', notes: 'Notes', legs: 'Exact selections', outcome: 'Outcome', participant: 'Participant', event: 'Fixture', sport: 'Sport', market: 'Exact market', selection: 'Selection', line: 'Threshold', probability: 'Original probability', probabilityProvenance: 'Original forecast provenance' };
  const match = /^legs\.(\d+)\.(.+)$/.exec(path);
  return match ? `Leg ${Number(match[1]) + 1} · ${names[match[2]] ?? match[2]}` : names[path] ?? path;
}

/** Groups repeated validator wording into an actionable checklist; exact messages remain available. */
export function financialRequirementChecklist(issues: { field: string; message: string }[]): string[] {
  const groups = new Map<string, Set<string>>();
  for (const issue of issues) {
    const leg = /^legs\.(\d+)\.(.+)$/.exec(issue.field);
    const key = leg ? `Leg ${Number(leg[1]) + 1}` : friendlyLedgerField(issue.field);
    const requirement = leg ? friendlyLedgerField(leg[2]) : issue.message;
    const existing = groups.get(key) ?? new Set<string>(); existing.add(requirement); groups.set(key, existing);
  }
  return [...groups].map(([key, values]) => `${key}: ${[...values].join('; ')}`);
}

export function melbourneInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const part = (name: string) => parts.find(value => value.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function utcFromMelbourne(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter the original Melbourne date and time.');
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall)) throw new Error('Enter a valid original date and time.');
  let utc = wall;
  for (let i = 0; i < 3; i++) utc += wall - Date.parse(`${melbourneInput(new Date(utc).toISOString())}:00Z`);
  const iso = new Date(utc).toISOString();
  if (melbourneInput(iso) !== value) throw new Error('That Melbourne time does not exist because of daylight saving. Choose the correct original time.');
  return iso;
}

export function originalOrEnteredTimestamp(value: string, original?: string): string {
  return original && melbourneInput(original) === value ? original : utcFromMelbourne(value);
}
