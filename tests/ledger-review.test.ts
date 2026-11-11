import { describe, expect, it } from 'vitest';
import type { Bet } from '@/lib/domain/types';
import { enteredMoneyCents, financialRequirementChecklist, manualPlacementFields, originalOrEnteredTimestamp, readLedgerEvidence, reviewLedgerEntry, utcFromMelbourne, writeLedgerEvidence } from '@/lib/domain/ledger-review';

function wager(overrides: Partial<Bet> = {}): Bet {
  return { id: '70000000-0000-4000-8000-000000000001', placedAt: '2026-01-01T00:00:37.125Z', settledAt: '2026-01-02T00:00:47.000Z', confirmedAt: '2026-01-01T00:01:00Z', bookmaker: 'SYNTHETIC Book', stakeCents: 500, stakeType: 'cash', odds: 2.1, outcome: 'won', strategy: 'C', notes: 'SYNTHETIC original note', legs: [{ id: '70000000-0000-4000-8000-000000000002', sport: 'NBA', event: 'SYNTHETIC A vs B', participant: 'SYNTHETIC Player', market: 'points', selection: 'Over 20.5', line: '20.5', odds: 2.1, outcome: 'won' }], ...overrides };
}
describe('manual financial review and evidence notes', () => {
  it('keeps known private placements compatible with deployed SQL without promoting incomplete historical placements', () => {
    const source = wager();
    expect(manualPlacementFields('supabase', source.placedAt, source.confirmedAt)).toEqual({});
    expect(() => manualPlacementFields('supabase', null, source.confirmedAt)).toThrow(/actual placement time/);
    expect(manualPlacementFields('demo', null, source.confirmedAt)).toEqual({ recordedAt: source.confirmedAt, placementStatus: 'unknown_owner_reported', lifecycle: 'provisional' });
    expect(source.placedAt).toBe('2026-01-01T00:00:37.125Z');
  });
  it('keeps ticket and payout evidence in existing notes without overwriting unrelated research', () => {
    const text = writeLedgerEvidence('SYNTHETIC original note\nsecond source line', 'SYNTHETIC-ticket-1', 1050);
    expect(readLedgerEvidence(text)).toEqual({ notes: 'SYNTHETIC original note\nsecond source line', ticketReference: 'SYNTHETIC-ticket-1', payoutCents: 1050 });
    const revised = writeLedgerEvidence(text, 'SYNTHETIC-ticket-2', 0);
    expect(revised.match(/EdgeLab ticket reference/g)).toHaveLength(1);
    expect(readLedgerEvidence(revised).payoutCents).toBe(0);
    expect(() => writeLedgerEvidence('note', 'unsafe\nnew field', 0)).toThrow('one ticket');
  });
  it('requires actual payout reconciliation and never treats bonus principal as cash returned', () => {
    expect(reviewLedgerEntry(wager(), 1050).bet).not.toBeNull();
    expect(reviewLedgerEntry(wager(), null).issues[0]).toContain('actual cash payout');
    expect(reviewLedgerEntry(wager({ stakeType: 'bonus' }), 550).bet).not.toBeNull();
    expect(reviewLedgerEntry(wager({ stakeType: 'bonus' }), 1050).bet).toBeNull();
    expect(reviewLedgerEntry(wager({ stakeType: 'bonus' }), 1050).issues[0]).toContain('cash/bonus');
  });
  it('never registers a pending payout or invents missing execution fields', () => {
    const pending = wager({ outcome: 'pending', settledAt: undefined, legs: wager().legs.map(leg => ({ ...leg, outcome: 'pending' })) });
    expect(reviewLedgerEntry(pending, null).bet).not.toBeNull();
    expect(reviewLedgerEntry(pending, 0).bet).toBeNull();
    expect(reviewLedgerEntry({ ...pending, odds: null, placedAt: '' }, null).bet).toBeNull();
    expect(reviewLedgerEntry({ ...pending, odds: null }, null).issues[0]).toContain('Accepted');
  });
  it('leaves the reviewed source untouched, rejects contradictory settlement and accepts explicit zero loss payouts', () => {
    const value = wager(); const before = structuredClone(value);
    expect(reviewLedgerEntry(value, 500).bet).toBeNull(); expect(value).toEqual(before);
    const lost = wager({ outcome: 'lost', legs: wager().legs.map(leg => ({ ...leg, outcome: 'lost' })) });
    expect(reviewLedgerEntry(lost, 0).bet).not.toBeNull();
    expect(reviewLedgerEntry({ ...lost, settledAt: '2025-12-30T00:00:00Z' }, 0).bet).toBeNull();
  });
  it('preserves exact original timestamp precision during an unchanged edit and validates Melbourne input', () => {
    expect(originalOrEnteredTimestamp('2026-01-01T11:00', '2026-01-01T00:00:37.125Z')).toBe('2026-01-01T00:00:37.125Z');
    expect(utcFromMelbourne('2026-01-01T12:00')).toBe('2026-01-01T01:00:00.000Z');
    expect(() => utcFromMelbourne('')).toThrow('original');
    expect(() => utcFromMelbourne('2026-10-04T02:30')).toThrow('daylight saving');
  });
  it('rejects fractional cents and groups leg eligibility without dropping exact requirements', () => {
    expect(enteredMoneyCents('5.00', 'a stake')).toBe(500);
    expect(enteredMoneyCents('0', 'a payout', true)).toBe(0);
    expect(() => enteredMoneyCents('5.001', 'a stake')).toThrow();
    const list = financialRequirementChecklist([{ field: 'legs.0.odds', message: 'missing' }, { field: 'legs.0.outcome', message: 'missing' }, { field: 'placedAt', message: 'Original timestamp unknown' }]);
    expect(list).toHaveLength(2); expect(list[0]).toContain('Leg 1'); expect(list[0]).toContain('odds'); expect(list[0]).toContain('Outcome');
  });
});
