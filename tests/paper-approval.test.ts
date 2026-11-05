import { describe, expect, it } from 'vitest';
import { paperApprovalBlocker } from '@/lib/approval/paper';
import { createDemoData, createEmptyData } from '@/lib/domain/fixtures';

describe('manual candidate paper approval', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const candidate = { ...createDemoData().candidates[0], id: 'SYNTHETIC-paper-candidate', startsAt: '2026-01-02T00:00:00Z' };
  it('permits a future source without changing any records', () => {
    const data = createEmptyData(), before = structuredClone(data);
    expect(paperApprovalBlocker(candidate, data, now)).toBeNull();
    expect(data).toEqual(before);
  });
  it('blocks repeated approval of an existing paper prediction', () => {
    const data = createEmptyData();
    data.paperPredictions = [{ id: crypto.randomUUID(), candidate, registeredAt: new Date(now).toISOString(), outcome: 'pending', hypotheticalStakeCents: 500 }];
    expect(paperApprovalBlocker(candidate, data, now)).toContain('already in paper tracking');
  });
  it('blocks retrospective paper creation for an actual-linked selection', () => {
    const data = createEmptyData(); data.bets = [{ ...createDemoData().bets[0], candidateId: candidate.id }];
    expect(paperApprovalBlocker(candidate, data, now)).toContain('actual wager');
    expect(data.transactions).toEqual([]);
  });
  it('blocks past-event or unknown event timing rather than manufacturing preregistration', () => {
    for (const startsAt of [new Date(now).toISOString(), '2025-12-31T23:59:00Z', 'unknown'])
      expect(paperApprovalBlocker({ ...candidate, startsAt }, createEmptyData(), now)).toContain('Pre-event registration');
  });
});
