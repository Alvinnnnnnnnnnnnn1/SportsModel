/** Entirely invented local fixtures; no user files, credentials or hosted access. */
import { describe, expect, it } from 'vitest';
import { createDemoData, createEmptyData } from '@/lib/domain/fixtures';
import { emptyHistoricalWorkspace } from '@/lib/imports/types';
import { commitHistoricalImport, prepareImportCommit, registerHistoricalPaper } from '@/lib/imports/commands';
import { buildDailyCyclePrompt, collectDailyCyclePositions, dailyCycleHistoricalMemory, prepareDailyCycleSettlements, reviewDailyCycle, type DailyCycle } from '@/lib/daily-cycle';
import { computeHypothetical, financialReview } from '@/lib/imports/calculations';
import { buildResearchHandoff } from '@/lib/handoff/context';
import { readArchivedWagerClaim } from '@/lib/imports/wager-claim-provenance';
import { assertReconciliationSelection, parseReconciliationMarkdown, prepareReconciliationImport, sourceItemMatches } from '@/lib/reconciliation/source';

import { syntheticReconciliationMarkdown, syntheticReconciliationSource } from './fixtures/reconciliation-source';

const inputs = async () => ({ text: await syntheticReconciliationSource(), sourceName: 'SYNTHETIC-local-only.json', data: createEmptyData(), history: emptyHistoricalWorkspace(), mode: 'supabase' as const });
const decisions = (rows: { rowNumber: number }[]) => rows.map(row => ({ rowNumber: row.rowNumber, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }));

describe('owner-selected canonical reconciliation adapter (offline only)', () => {
  it('preserves all source rows, original references, unknown execution facts and individual legs', async () => {
    const input = await inputs(), before = structuredClone(input);
    const review = await prepareReconciliationImport(input);
    expect(review.items).toHaveLength(46);
    expect(review.items.filter(i => i.category === 'actual')).toHaveLength(12);
    expect(review.items.filter(i => i.category !== 'actual')).toHaveLength(34);
    expect(input).toEqual(before);
    expect(review.preview.rows.every(row => !row.issues.some(issue => issue.severity === 'error'))).toBe(true);
    const first = review.preview.rows[0];
    expect(first.snapshot).toMatchObject({ externalId: 'A01', odds: null, probability: null, placedAt: null, settledAt: null, stakeCents: 1000, payoutCents: 2500 });
    expect(first.snapshot.legs).toHaveLength(2);
    expect(first.snapshot.legs.every(leg => leg.odds === null && leg.outcome === null)).toBe(true);
    const bonus = review.preview.rows[5];
    expect(bonus.snapshot).toMatchObject({ stakeType: 'bonus', stakeCents: 500, payoutCents: 430, odds: null });
    const later = review.preview.rows[6];
    expect(later.snapshot).toMatchObject({ stakeCents: null, odds: null, outcome: null, payoutCents: null });
    expect(review.preview.rows[15].snapshot.odds).toBeNull();
    expect(review.preview.rawSource).toContain('Cash (planned)');
    const corrected = parseReconciliationMarkdown(syntheticReconciliationMarkdown().replace('NBA — SYNTHETIC LOCAL fixture 4', 'NBA / multi — SYNTHETIC LOCAL ambiguous ticket') + '\n- **A09** — Original research quote 2.11; EdgeLab actual saved with 2.07 but fixture unverified.');
    expect(corrected.find(item => item.id === 'A09')?.quote).toBe(2.11);
    expect(corrected.find(item => item.id === 'A05')?.event).toBeNull();
  });

  it('persists only immutable archive records in memory, excludes retrospective metrics, and replays idempotently', async () => {
    const input = await inputs(), review = await prepareReconciliationImport(input);
    const commit = prepareImportCommit(review.preview, decisions(review.preview.rows), 'unverified');
    const history = commitHistoricalImport(input.history, commit);
    expect(history.records).toHaveLength(46);
    expect(history.paperResults).toHaveLength(0);
    expect(history.notifications).toHaveLength(0);
    expect(history.audit[0].after).toMatchObject({ financialEffect: 'archive_only_no_funding_or_ledger_writes' });
    expect(input.data.bets).toHaveLength(0);
    expect(input.data.transactions).toHaveLength(0);
    expect(history.records.filter(r => r.snapshot.kind === 'actual').every(r => financialReview(r).bet === null)).toBe(true);
    expect(history.records.filter(r => r.snapshot.kind === 'paper').every(r => computeHypothetical(r).accuracyEligible === false)).toBe(true);
    expect(readArchivedWagerClaim(history.records[0])?.claim).toMatchObject({ acceptedOdds: null, reportedOdds: 2.5, reportedCashPayoutCents: 2500 });
    const replay = await prepareReconciliationImport({ ...input, history });
    expect(replay.preview.rows.every(row => row.duplicates.some(d => d.level === 'exact'))).toBe(true);
    expect(() => prepareImportCommit(replay.preview, decisions(replay.preview.rows), 'unverified', history.records)).toThrow(/duplicate/i);
    const context = buildResearchHandoff({ appData: input.data, history, mode: 'supabase' }).context;
    expect(context.groups.unregisteredProposals).toHaveLength(19);
    expect(context.groups.unregisteredProposals.every(p => !p.alreadyRegistered && p.predictionTimestamp === null)).toBe(true);
  });

  it('matches exact ledger UUIDs, archive UUIDs and namespaced candidate IDs, never text substrings or cross-types', async () => {
    const input = await inputs();
    const bet = createDemoData().bets[0];
    input.data.bets.push({ ...bet, id: 'a0000000-0000-4000-8000-000000000001', notes: 'synthetic-actual-0 appears in notes only' });
    let review = await prepareReconciliationImport(input);
    expect(review.links[0].matches).toHaveLength(0);
    input.data.bets[0].candidateId = 'synthetic-actual-0';
    review = await prepareReconciliationImport(input);
    expect(review.links[0].matches).toEqual([{ id: input.data.bets[0].id, storage: 'ledger' }]);
    expect(() => assertReconciliationSelection(review.preview, decisions([review.preview.rows[0]]), input.data, input.history)).toThrow(/already present/);
    const one = review.preview.rows[34]; // first Day 8 candidate
    const commit = prepareImportCommit(review.preview, decisions([one]), 'unverified');
    const history = commitHistoricalImport(input.history, commit);
    const saved = history.records[0];
    saved.raw = { id: 'd8-synthetic-0' };
    saved.snapshot.externalId = 'SYNTHETIC-response:d8-synthetic-0';
    saved.snapshot.sourceReference = 'edgelab:research-response:SYNTHETIC-response:d8-synthetic-0';
    expect(sourceItemMatches(review.items[34], input.data, history)).toEqual([{ id: saved.id, storage: 'archive' }]);
    expect(sourceItemMatches({ ...review.items[34], category: 'actual' }, input.data, history)).toHaveLength(0);
    saved.snapshot.sourceReference += '-different';
    expect(sourceItemMatches(review.items[34], input.data, history)).toHaveLength(0);
  });

  it('rejects modified sources, changed headers, malformed numbers, missing rows, duplicate identities, credentials and Demo imports', async () => {
    const input = await inputs();
    await expect(prepareReconciliationImport({ ...input, mode: 'demo' })).rejects.toThrow(/private workspace/);
    const changed = JSON.parse(input.text); changed.sourceText += 'changed';
    await expect(prepareReconciliationImport({ ...input, text: JSON.stringify(changed) })).rejects.toThrow(/hash mismatch/);
    for (const text of [syntheticReconciliationMarkdown().replace('Odds quoted', 'Accepted odds'), syntheticReconciliationMarkdown().replace('1.72', '-1'), syntheticReconciliationMarkdown().replace('H15', 'H14'), syntheticReconciliationMarkdown().replace(/^\| P20.*\n/m, '')])
      await expect(prepareReconciliationImport({ ...input, text: await syntheticReconciliationSource(text) })).rejects.toThrow();
    await expect(prepareReconciliationImport({ ...input, text: await syntheticReconciliationSource(syntheticReconciliationMarkdown() + '\npassword=not-a-real-secret') })).rejects.toThrow(/credentials/);
    expect(() => parseReconciliationMarkdown('# unrelated file')).toThrow(/Section A/);
  });

  it('carries all saved historical memory into the daily prompt without turning proposals into positions or automatically settling historical papers', async () => {
    const input = await inputs(), review = await prepareReconciliationImport(input);
    let history = commitHistoricalImport(input.history, prepareImportCommit(review.preview, decisions(review.preview.rows), 'unverified'));
    expect(collectDailyCyclePositions(input.data, history)).toHaveLength(0);
    const paper = history.records.find(record => record.snapshot.externalId === 'H05')!;
    history = registerHistoricalPaper(history, paper.id);
    const context = buildResearchHandoff({ appData: input.data, history, mode: 'supabase' }).context;
    const prompt = buildDailyCyclePrompt({ data: input.data, history, researchDate: '2026-11-11', researchSessionId: 'SYNTHETIC-local-session', previousCheckpoint: null, researchContext: context });
    for (const item of review.items) expect(prompt).toContain(item.id);
    expect(prompt).toContain('unregistered_paper_proposal');
    expect(prompt).toContain('historical_actual_claim_not_financially_registered');
    expect(prompt).toContain('proposed_not_saved');
    expect(prompt).toContain('lifetimeFundingCapCents');
    expect(dailyCycleHistoricalMemory(input.data, history)).toHaveLength(46);
    const positions = collectDailyCyclePositions(input.data, history);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ positionId: paper.id, storage: 'historical', kind: 'paper' });
    const cycle: DailyCycle = { format: 'edgelab.daily-cycle', version: 1,
      metadata: { cycleId: 'SYNTHETIC-local-cycle', researchSessionId: 'SYNTHETIC-local-session', researchDate: '2026-11-11', generatedAt: null, sourceDataCutoff: null, previousCheckpoint: null, methodologyVersion: null, modelVersion: null, contextVersion: null },
      resultUpdates: [{ positionId: paper.id, candidateId: null, identity: { eventId: null, sport: paper.snapshot.sport, event: paper.snapshot.event, participant: paper.snapshot.participant, market: paper.snapshot.market, selection: paper.snapshot.selection, line: paper.snapshot.line }, eventStatus: 'unknown', sportingOutcome: 'UNRESOLVED', legs: [], sources: [], sourcePublicationAt: null, retrievedAt: null, matchConfidence: 'unknown', uncertainty: null, actualPayoutCents: null, deterministicSettlementEligible: false, financialSettlementReviewRequired: false }],
      betRecommendations: [], paperRecommendations: [], modelFeedback: { resultsEvaluated: 0, calibration: null, forecastErrors: [], missingDataPatterns: [], marketObservations: [], proposedModelVersion: null, validationStatus: 'insufficient_evidence', evidenceLimitations: [] },
      processing: { outstandingActualReviewed: 0, resolved: 0, unresolved: 1, paperReviewed: 1, unresolvedReasons: [] } };
    const cycleReview = reviewDailyCycle({ raw: cycle, data: input.data, history, previousCycleKeys: [] });
    expect(cycleReview.matchedResults).toBe(1);
    expect((await prepareDailyCycleSettlements(cycleReview, input.data, history)).skipped).toContain(`historical_paper:${paper.id}`);
  });
});
