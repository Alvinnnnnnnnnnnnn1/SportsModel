import { describe, expect, it } from 'vitest';
import { archiveDailyCycle, savedDailyCycles } from '@/lib/daily-cycle/archive';
import { emptyHistoricalWorkspace } from '@/lib/imports/types';
import { localCycle } from './fixtures/daily-cycle';

describe('authenticated Daily Cycle source archive', () => {
  it('saves exact source/proposals/feedback with no financial, paper-state or result registration', async () => {
    const before = emptyHistoricalWorkspace(), cycle = localCycle(), text = JSON.stringify(cycle, null, 2);
    const result = await archiveDailyCycle(before, text, 'supabase');
    expect(before.records).toHaveLength(0);
    expect(result.history.records).toHaveLength(2);
    expect(result.history.paperResults).toEqual([]);
    expect(result.history.notifications).toEqual([]);
    expect(result.history.batches[0].rawSource).toBe(text);
    const paper = result.history.records[1];
    expect(paper.raw).toEqual(cycle.paperRecommendations[0]);
    expect(paper.snapshot).toMatchObject({ odds: 1.91, predictionAt: '2026-11-10T23:59:00.000Z', probability: null, stakeCents: null, outcome: null });
    expect(savedDailyCycles(structuredClone(result.history))[0].cycle.modelFeedback).toEqual(cycle.modelFeedback);
  });
  it('retains supported probability provenance, refuses changed-key content and renamed replay, and returns exact replay without writes', async () => {
    const cycle = localCycle();
    cycle.paperRecommendations[0].probabilityProvenance = { origin: 'external_forecast', source: 'LOCAL TEST independent model', method: 'local numerical fixture', modelVersion: 'local-v1', timestamp: '2026-11-10T23:57:00Z' };
    const text = JSON.stringify(cycle), first = await archiveDailyCycle(emptyHistoricalWorkspace(), text, 'supabase');
    expect(first.history.records[1].snapshot.probability).toBe(.63);
    expect((await archiveDailyCycle(first.history, text, 'supabase')).history).toBe(first.history);
    cycle.paperRecommendations[0].originalOdds = 2;
    await expect(archiveDailyCycle(first.history, JSON.stringify(cycle), 'supabase')).rejects.toThrow(/different immutable/);
    cycle.paperRecommendations[0].originalOdds = 1.91; cycle.metadata.cycleId = 'renamed'; cycle.paperRecommendations[0].candidateId = 'renamed';
    await expect(archiveDailyCycle(first.history, JSON.stringify(cycle), 'supabase')).rejects.toThrow(/already archived/);
  });
  it('rejects synthetic private records, malformed prices, credentials and invalid source data before mutation', async () => {
    const before = emptyHistoricalWorkspace();
    const cycle = localCycle(); cycle.sourceClass = 'synthetic';
    await expect(archiveDailyCycle(before, JSON.stringify(cycle), 'supabase')).rejects.toThrow(/Synthetic/);
    cycle.sourceClass = 'owner_research'; cycle.paperRecommendations[0].originalOdds = 1.12345;
    await expect(archiveDailyCycle(before, JSON.stringify(cycle), 'supabase')).rejects.toThrow();
    cycle.paperRecommendations[0].originalOdds = 1.91; cycle.paperRecommendations[0].reasoning = 'password=not-a-real-secret';
    await expect(archiveDailyCycle(before, JSON.stringify(cycle), 'supabase')).rejects.toThrow(/credentials/);
    cycle.paperRecommendations[0].reasoning = 'LOCAL TEST'; cycle.paperRecommendations[0].sources[0].url='https://example.invalid?apiKey=not-a-real-key';
    await expect(archiveDailyCycle(before, JSON.stringify(cycle), 'supabase')).rejects.toThrow();
    await expect(archiveDailyCycle(before, '{bad', 'supabase')).rejects.toThrow();
    expect(before).toEqual(emptyHistoricalWorkspace());
  });
});
