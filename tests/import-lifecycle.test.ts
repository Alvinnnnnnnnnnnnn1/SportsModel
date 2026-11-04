import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_HISTORICAL_RECORDS,
  commitHistoricalImport,
  computeHypothetical,
  createHistoricalNotification,
  dismissHistoricalNotification,
  emptyHistoricalWorkspace,
  financialReview,
  historicalWorkspaceSchema,
  markHistoricalNotificationRead,
  parseHistoricalSource,
  prepareImportCommit,
  registerHistoricalPaper,
  settleHistoricalPaper,
  validateHistoricalTransition,
  type HistoricalPaperResult,
  type HistoricalRecord,
  type HistoricalWorkspace,
} from '../src/lib/imports';
import { calculateMetrics } from '../src/lib/domain/calculations';

async function imported(changes: Record<string, unknown> = {}, actual = false) {
  const raw = { ...structuredClone(SYNTHETIC_HISTORICAL_RECORDS[actual ? 1 : 0]), ...changes };
  const preview = await parseHistoricalSource({ text: JSON.stringify([raw]), format: 'json', sourceName: 'Synthetic lifecycle fixture.json', verification: 'synthetic' });
  return commitHistoricalImport(emptyHistoricalWorkspace(), prepareImportCommit(preview, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }], 'synthetic'));
}
function result(record: HistoricalRecord, changes: Partial<HistoricalPaperResult> = {}): HistoricalPaperResult {
  return { recordId: record.id, outcome: 'won', settledAt: '2026-10-01T10:00:00.000Z', statistic: 'Synthetic final result', legs: record.snapshot.legs.map(leg => ({ legId: leg.id, outcome: 'won', statistic: 'SYNTHETIC 25 points' })), updatedAt: '2026-10-01T10:00:00.000Z', ...changes };
}

describe('actual financial reconciliation and separation', () => {
  it('does not convert paper predictions into actual wagers', async () => {
    const workspace = await imported();
    expect(financialReview(workspace.records[0]).bet).toBeNull();
    expect(financialReview(workspace.records[0]).issues).toContainEqual(expect.objectContaining({ field: 'kind', severity: 'error' }));
    expect(workspace).not.toHaveProperty('transactions');
    expect(calculateMetrics([], []).bankrollCents).toBe(0);
  });

  it('offers a separate deterministic bonus-bet confirmation without manufacturing deposits', async () => {
    const workspace = await imported({}, true);
    const review = financialReview(workspace.records[0]);
    expect(review.issues).toEqual([]);
    expect(review.expectedPayoutCents).toBe(500);
    expect(review.bet).toMatchObject({ id: workspace.records[0].id, stakeCents: 500, stakeType: 'bonus', placedAt: '2026-10-02T05:10:00.000Z', settledAt: '2026-10-02T08:00:00.000Z', outcome: 'won' });
    expect(calculateMetrics([review.bet!], [])).toMatchObject({ totalDepositsCents: 0, cashProfitCents: 0, bonusProfitCents: 500, profitCents: 500, roi: null });
    expect(workspace.records[0].snapshot.payoutCents).toBe(500);
  });

  it('blocks ledger promotion when original placement, stake, exact legs or provenance is incomplete', async () => {
    for (const changes of [{ placedAt: null }, { stake: null }, { line: null }, { probability: 0.7 }]) {
      const workspace = await imported(changes, true);
      expect(financialReview(workspace.records[0]).bet).toBeNull();
      expect(financialReview(workspace.records[0]).issues.length).toBeGreaterThan(0);
    }
  });

  it('keeps imported real financial dates and complete probability provenance instead of import dates', async () => {
    const workspace = await imported({ probability: 0.7, probabilitySource: 'Synthetic fixed numerical test', probabilityMethod: 'Synthetic supplied estimate', modelVersion: 'synthetic-v1' }, true);
    const review = financialReview(workspace.records[0]);
    expect(review.issues).toEqual([]);
    expect(review.bet).toMatchObject({ probability: 0.7, probabilityProvenance: { source: 'Synthetic fixed numerical test', timestamp: '2026-10-02T05:00:00.000Z', method: 'Synthetic supplied estimate', modelVersion: 'synthetic-v1', simulated: true } });
    expect(review.bet!.placedAt).not.toBe(workspace.records[0].importedAt);
  });

  it.each([
    { stakeType: 'cash', outcome: 'won', expectedReturn: 950, expectedProfit: 450 },
    { stakeType: 'cash', outcome: 'lost', expectedReturn: 0, expectedProfit: -500 },
    { stakeType: 'cash', outcome: 'void', expectedReturn: 500, expectedProfit: 0 },
    { stakeType: 'bonus', outcome: 'won', expectedReturn: 450, expectedProfit: 450 },
    { stakeType: 'bonus', outcome: 'lost', expectedReturn: 0, expectedProfit: 0 },
    { stakeType: 'bonus', outcome: 'void', expectedReturn: 0, expectedProfit: 0 },
  ])('calculates paper $stakeType $outcome deterministically without changing actual totals', async ({ stakeType, outcome, expectedReturn, expectedProfit }) => {
    const workspace = await imported({ stakeType });
    const record = workspace.records[0];
    const settled = result(record, { outcome: outcome as HistoricalPaperResult['outcome'], legs: record.snapshot.legs.map(leg => ({ legId: leg.id, outcome: outcome as HistoricalPaperResult['outcome'], statistic: null })) });
    expect(computeHypothetical(record, settled)).toMatchObject({ stakeCents: 500, returnCents: expectedReturn, profitCents: expectedProfit, eligible: true });
    expect(calculateMetrics([], []).bankrollCents).toBe(0);
  });

  it('does not invent a default paper stake or stake type for incomplete historical predictions', async () => {
    const workspace = await imported({ stake: null, stakeType: null });
    expect(computeHypothetical(workspace.records[0], result(workspace.records[0]))).toMatchObject({ stakeCents: null, returnCents: null, profitCents: null, eligible: false });
  });

  it('retains source payouts for partially void parlays without inventing adjusted settlement prices', async () => {
    const makeLeg = (outcome: 'won' | 'void', index: number) => ({ sport: 'NBL', event: `SYNTHETIC fixture ${index}`, participant: `SYNTHETIC team ${index}`, market: 'Match winner', selection: `SYNTHETIC team ${index} to win`, line: 'Moneyline', odds: 2, outcome });
    const actual = await imported({ odds: 4, stakeType: 'cash', payout: '10.00', legs: [makeLeg('won', 1), makeLeg('void', 2)] }, true);
    expect(actual.records[0].snapshot.payoutCents).toBe(1_000);
    expect(actual.records[0].snapshot.odds).toBe(4);
    expect(actual.records[0].issues).toContainEqual(expect.objectContaining({ code: 'partial_void_requires_reconciliation', severity: 'warning' }));
    expect(financialReview(actual.records[0])).toMatchObject({ bet: null, expectedPayoutCents: null });
    const paper = await imported({ odds: 4, legs: [makeLeg('won', 1), makeLeg('void', 2)] });
    const source = paper.records[0];
    const settled = result(source, { legs: source.snapshot.legs.map(leg => ({ legId: leg.id, outcome: leg.outcome!, statistic: null })) });
    expect(computeHypothetical(source, settled)).toMatchObject({ eligible: false, returnCents: null, profitCents: null, accuracyEligible: false, brierScore: null });
  });

  it('never reports hypothetical returns for actual records', async () => {
    const workspace = await imported({}, true);
    expect(computeHypothetical(workspace.records[0], result(workspace.records[0]))).toMatchObject({ eligible: false, returnCents: null, profitCents: null, brierScore: null });
  });
});

describe('paper lifecycle with immutable forecasts', () => {
  it('registers a paper prediction and persists result/leg statistics in a separate audited projection', async () => {
    const initial = await imported();
    const originalSnapshot = structuredClone(initial.records[0].snapshot);
    const registered = registerHistoricalPaper(initial, initial.records[0].id);
    expect(registered.paperResults[0]).toMatchObject({ outcome: 'pending', settledAt: null });
    expect(registered.audit.at(-1)?.action).toBe('paper_registered');
    expect(registerHistoricalPaper(registered, initial.records[0].id)).toBe(registered);
    const settled = settleHistoricalPaper(registered, initial.records[0].id, result(initial.records[0]));
    expect(settled.records[0].snapshot).toEqual(originalSnapshot);
    expect(settled.paperResults[0]).toMatchObject({ outcome: 'won', legs: [{ legId: originalSnapshot.legs[0].id, outcome: 'won', statistic: 'SYNTHETIC 25 points' }] });
    expect(settled.audit.at(-1)).toMatchObject({ action: 'paper_result_recorded', before: registered.paperResults[0], after: settled.paperResults[0] });
    expect(JSON.parse(JSON.stringify(settled))).toEqual(settled);
    expect(historicalWorkspaceSchema.parse(JSON.parse(JSON.stringify(settled)))).toEqual(settled);
    expect(settled.revision).toBe(initial.revision + 2);
  });

  it('requires an explicit paper registration for an unclassified archived research alert', async () => {
    const initial = await imported({ kind: null });
    const record = initial.records[0];
    expect(computeHypothetical(record).eligible).toBe(false);
    expect(() => settleHistoricalPaper(initial, record.id, result(record))).toThrow('Explicitly add');
    const registered = registerHistoricalPaper(initial, record.id);
    expect(registered.records[0].snapshot.kind).toBeNull();
    expect(registered.paperResults[0].outcome).toBe('pending');
    expect(computeHypothetical(record, result(record)).eligible).toBe(true);
  });

  it('prevents actual records from being registered or settled as paper', async () => {
    const workspace = await imported({}, true);
    expect(() => registerHistoricalPaper(workspace, workspace.records[0].id)).toThrow('cannot be converted');
    expect(() => settleHistoricalPaper(workspace, workspace.records[0].id, result(workspace.records[0]))).toThrow('actual ledger');
  });

  it('accepts an unknown result timestamp as null and excludes it from accuracy and Brier score', async () => {
    const workspace = await imported({ probability: 0.6, probabilitySource: 'Synthetic fixture', probabilityMethod: 'Fixed supplied test value', modelVersion: 'synthetic-v1' });
    const record = workspace.records[0];
    const settled = settleHistoricalPaper(workspace, record.id, result(record, { settledAt: null }));
    expect(settled.paperResults[0].settledAt).toBeNull();
    expect(computeHypothetical(record, settled.paperResults[0])).toMatchObject({ profitCents: 450, accuracyEligible: false, hit: null, brierScore: null });
  });

  it('does not replace an explicitly unknown updated result timestamp with the original source settlement', async () => {
    const workspace = await imported({ outcome: 'won', settledAt: '2026-10-01T10:00:00Z', probability: 0.6, probabilitySource: 'Synthetic fixture', probabilityMethod: 'Supplied numerical fixture', modelVersion: 'synthetic-v1' });
    const record = workspace.records[0];
    expect(computeHypothetical(record).accuracyEligible).toBe(true);
    expect(computeHypothetical(record, result(record, { settledAt: null })).accuracyEligible).toBe(false);
  });

  it('calculates accuracy and Brier only from a known earlier forecast with supplied provenance', async () => {
    const workspace = await imported({ probability: 0.6, probabilitySource: 'Synthetic fixture', probabilityMethod: 'Fixed supplied test value', modelVersion: 'synthetic-v1' });
    const record = workspace.records[0];
    expect(computeHypothetical(record, result(record))).toMatchObject({ hit: 1, accuracyEligible: true, brierScore: (0.6 - 1) ** 2 });
    const noProvenance = await imported({ probability: 0.6 });
    expect(computeHypothetical(noProvenance.records[0], result(noProvenance.records[0])).brierScore).toBeNull();
    expect(computeHypothetical(record, result(record, { settledAt: record.snapshot.predictionAt })).accuracyEligible).toBe(false);
  });

  it('rejects a result before a known original prediction', async () => {
    const workspace = await imported();
    expect(() => settleHistoricalPaper(workspace, workspace.records[0].id, result(workspace.records[0], { settledAt: '2026-10-01T06:00:00Z' }))).toThrow('cannot precede');
  });

  it('requires exactly the registered leg IDs and compatible individual outcomes', async () => {
    const workspace = await imported();
    const record = workspace.records[0];
    for (const invalid of [
      result(record, { legs: [] }),
      result(record, { legs: [{ legId: crypto.randomUUID(), outcome: 'won', statistic: null }] }),
      result(record, { legs: [{ legId: record.snapshot.legs[0].id, outcome: 'lost', statistic: null }] }),
      result(record, { outcome: 'lost' }),
      result(record, { outcome: 'void' }),
      result(record, { outcome: 'pending' }),
    ]) expect(() => settleHistoricalPaper(workspace, record.id, invalid)).toThrow();
  });

  it('rejects retrospective snapshot edits, original source edits and audit deletion', async () => {
    const workspace = await imported();
    const cases: HistoricalWorkspace[] = [];
    const snapshot = structuredClone(workspace); snapshot.revision++; snapshot.records[0].snapshot.odds = 2.1; cases.push(snapshot);
    const source = structuredClone(workspace); source.revision++; source.batches[0].rawSource = 'changed'; cases.push(source);
    const audit = structuredClone(workspace); audit.revision++; audit.audit = []; cases.push(audit);
    for (const after of cases) expect(() => validateHistoricalTransition(workspace, after)).toThrow('immutable');
  });

  it('requires an audited result mutation and exactly one revision increment', async () => {
    const workspace = await imported();
    const unaudited = structuredClone(workspace); unaudited.revision++; unaudited.paperResults.push(result(workspace.records[0]));
    expect(() => validateHistoricalTransition(workspace, unaudited)).toThrow('audit');
    const skippedRevision = structuredClone(workspace); skippedRevision.revision += 2;
    expect(() => validateHistoricalTransition(workspace, skippedRevision)).toThrow('exactly once');
  });

  it('rejects a result audit whose before/after payload does not describe the actual mutation', async () => {
    const workspace = await imported();
    const after = settleHistoricalPaper(workspace, workspace.records[0].id, result(workspace.records[0]));
    after.audit.at(-1)!.after = { unrelated: 'Synthetic inaccurate audit' };
    expect(() => validateHistoricalTransition(workspace, after)).toThrow('accurate before/after audit');
  });
});

describe('historical research notification lifecycle', () => {
  it('creates a labelled notification exactly once and persists read/dismiss state with history', async () => {
    const initial = await imported();
    const notified = createHistoricalNotification(initial, initial.records[0].id);
    const notification = notified.notifications[0];
    expect(notification).toMatchObject({ recordId: initial.records[0].id, dedupeKey: `historical-research:${initial.records[0].id}`, readAt: null, dismissedAt: null });
    expect(notification.title).toContain('Synthetic');
    expect(notification.message).toContain('Original price');
    expect(createHistoricalNotification(notified, initial.records[0].id)).toBe(notified);
    const read = markHistoricalNotificationRead(notified, notification.id);
    const dismissed = dismissHistoricalNotification(read, notification.id);
    expect(dismissed.notifications[0].readAt).not.toBeNull();
    expect(dismissed.notifications[0].dismissedAt).not.toBeNull();
    expect(markHistoricalNotificationRead(dismissed, notification.id)).toBe(dismissed);
    expect(dismissHistoricalNotification(dismissed, notification.id)).toBe(dismissed);
    expect(createHistoricalNotification(dismissed, initial.records[0].id)).toBe(dismissed);
    expect(dismissed.audit.map(entry => entry.action)).toEqual(['import_confirmed', 'notification_created', 'notification_read', 'notification_dismissed']);
    expect(historicalWorkspaceSchema.parse(JSON.parse(JSON.stringify(dismissed)))).toEqual(dismissed);
  });

  it('dismisses an unread notification while retaining its implicit read timestamp', async () => {
    const initial = await imported();
    const notified = createHistoricalNotification(initial, initial.records[0].id);
    const dismissed = dismissHistoricalNotification(notified, notified.notifications[0].id);
    expect(dismissed.notifications[0].readAt).toBe(dismissed.notifications[0].dismissedAt);
    expect(dismissed.audit.at(-1)?.action).toBe('notification_dismissed');
  });

  it('follows an alert source to explicit paper tracking without changing the source classification', async () => {
    const initial = await imported({ kind: null });
    const notified = createHistoricalNotification(initial, initial.records[0].id);
    const tracked = registerHistoricalPaper(notified, notified.notifications[0].recordId);
    expect(tracked.paperResults[0].recordId).toBe(initial.records[0].id);
    expect(tracked.records).toEqual(initial.records);
    expect(tracked.notifications).toEqual(notified.notifications);
    expect(tracked).not.toHaveProperty('bets');
  });

  it('cannot address records or notifications outside the current user workspace', async () => {
    const accountA = await imported();
    const accountB = emptyHistoricalWorkspace();
    const notificationA = createHistoricalNotification(accountA, accountA.records[0].id).notifications[0];
    expect(() => createHistoricalNotification(accountB, accountA.records[0].id)).toThrow('not found');
    expect(() => registerHistoricalPaper(accountB, accountA.records[0].id)).toThrow('not found');
    expect(() => markHistoricalNotificationRead(accountB, notificationA.id)).toThrow('not found');
    expect(() => dismissHistoricalNotification(accountB, notificationA.id)).toThrow('not found');
    expect(accountB).toEqual(emptyHistoricalWorkspace());
  });

  it('prevents unaudited notification mutation, detail rewriting, unread resets and deletion', async () => {
    const initial = await imported();
    const notified = createHistoricalNotification(initial, initial.records[0].id);
    const read = markHistoricalNotificationRead(notified, notified.notifications[0].id);
    const detail = structuredClone(read); detail.revision++; detail.notifications[0].message = 'changed';
    expect(() => validateHistoricalTransition(read, detail)).toThrow('immutable');
    const reset = structuredClone(read); reset.revision++; reset.notifications[0].readAt = null;
    expect(() => validateHistoricalTransition(read, reset)).toThrow('cannot be reset');
    const deleted = structuredClone(read); deleted.revision++; deleted.notifications = [];
    expect(() => validateHistoricalTransition(read, deleted)).toThrow('cannot be deleted');
    const unaudited = structuredClone(notified); unaudited.revision++; unaudited.notifications[0].readAt = new Date().toISOString();
    expect(() => validateHistoricalTransition(notified, unaudited)).toThrow('audit');
  });
});
