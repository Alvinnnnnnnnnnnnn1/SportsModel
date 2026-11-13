import {applyLocalMigration} from '../scripts/lib/local-migration.mjs';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { AppData, Bet, Candidate, Mode } from '@/lib/domain/types';
import { createEmptyData } from '@/lib/domain/fixtures';
import { calculateMetrics } from '@/lib/domain/calculations';
import { commitHistoricalImport, createHistoricalNotification, emptyHistoricalWorkspace, registerHistoricalPaper, validateHistoricalTransition } from '@/lib/imports';
import { parseResearchResponse, prepareResearchCommit } from '@/lib/handoff/response';
import type { ResearchCandidate, ResearchResponse } from '@/lib/handoff/contract';
import { applyAppResultBatch, applyHistoricalResultBatch } from '@/lib/daily/result-batch';
import { readResearchRecordLink, researchPlacementDuplicate, withResearchRecordLink } from '@/lib/daily/placement';
import { buildSettlementTargets, type SettlementResponse, type SettlementTarget } from '@/lib/results';

const forecastAt = '2026-11-03T00:00:00Z';
const startsAt = '2026-11-04T01:00:00Z';
const settledAt = '2026-11-04T13:00:00Z';
const uuid = () => crypto.randomUUID();
function actual(stakeType: 'cash' | 'bonus'): Bet {
  return { id: uuid(), placedAt: forecastAt, bookmaker: 'SYNTHETIC fixture book', stakeCents: 500, stakeType, odds: stakeType === 'bonus' ? 1.86 : 2, outcome: 'pending', strategy: 'B', notes: 'SYNTHETIC batch test; no actual account or wager.', confirmedAt: forecastAt, legs: [{ id: uuid(), sport: 'NBA', event: `SYNTHETIC ${stakeType} event`, participant: `SYNTHETIC ${stakeType} player`, market: 'Player points', selection: 'Over 18.5 points', line: '18.5', odds: stakeType === 'bonus' ? 1.86 : 2, outcome: 'pending' }] };
}
function candidate(mode: Mode): Candidate {
  return { id: uuid(), sport: 'NBA', event: 'SYNTHETIC core paper event', participant: 'SYNTHETIC paper player', market: 'Player points', selection: 'Over 18.5 points', line: '18.5', bookmaker: 'SYNTHETIC fixture book', odds: 2, strategy: 'A', rationale: 'SYNTHETIC paper-only test.', uncertainty: 'high', startsAt, registeredAt: forecastAt, oddsProvenance: { source: 'SYNTHETIC local source', method: 'SYNTHETIC fixed fixture', modelVersion: 'synthetic-v1', timestamp: '2026-11-02T23:50:00Z', simulated: mode === 'demo' } };
}
async function fixture(mode: Mode = 'demo') {
  const data = createEmptyData(); data.bets = [actual('cash'), actual('bonus')];
  const core = candidate(mode); data.candidates = [core];
  data.paperPredictions = [{ id: uuid(), candidate: core, registeredAt: forecastAt, hypotheticalStakeCents: 500, outcome: 'pending' }];
  const original: ResearchCandidate = { id: 'SYNTHETIC-imported-paper', sport: 'NBA', eventId: 'SYNTHETIC-event-id', event: 'SYNTHETIC historical paper event', startsAt, participant: 'SYNTHETIC imported player', marketId: 'SYNTHETIC-market', market: 'Player points', selection: 'Over 18.5 points', line: '18.5', bookmaker: 'SYNTHETIC fixture book', originalOdds: 2, oddsTimestamp: '2026-11-02T23:50:00Z', oddsSource: 'SYNTHETIC quoted source', oddsSourceUrl: null, predictionTimestamp: '2026-11-02T23:55:00Z', probability: { value: null, origin: null, source: null, method: null, modelVersion: null, timestamp: null }, strategy: 'C', evidence: [{ claim: 'SYNTHETIC testing evidence, not real statistics.', sourceUrl: null, observedAt: '2026-11-02T23:50:00Z', verification: 'unverified' }], sourceUrls: [], confidence: 'unknown', uncertainty: 'SYNTHETIC fixture only.', decision: 'paper', proposedStatus: 'paper_only', rationale: 'SYNTHETIC pre-event registration fixture.', passReasons: [], hypotheticalStakeCents: 500, hypotheticalStakeType: 'cash', estimatedEv: null };
  const response: ResearchResponse = { format: 'edgelab.research-response', version: 1, id: 'SYNTHETIC-paper-session', createdAt: forecastAt, researchDate: '2026-11-03', researchDay: 6, dayStatus: 'draft', source: 'SYNTHETIC fixture source', researchMethod: 'SYNTHETIC fixed values only', sourceUrls: [], rulesSourceReference: null, candidates: [original], passes: [] };
  const verification = mode === 'demo' ? 'synthetic' : 'user_confirmed';
  const preview = await parseResearchResponse({ text: JSON.stringify(response), sourceName: 'SYNTHETIC-research.json', verification, now: new Date(forecastAt) });
  let history = commitHistoricalImport(emptyHistoricalWorkspace(), prepareResearchCommit(preview, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }], verification, [], { now: new Date(forecastAt) }));
  history = registerHistoricalPaper(history, history.records[0].id);
  history = createHistoricalNotification(history, history.records[0].id);
  // Explicit synthetic fixture metadata establishes a known pre-event write.
  // No generated/import time is substituted into real user records.
  history.records[0].importedAt = forecastAt; history.batches[0].createdAt = forecastAt;
  history.paperResults[0].updatedAt = forecastAt;
  for (const audit of history.audit) {
    audit.timestamp = forecastAt;
    if (audit.action === 'paper_registered') (audit.after as { updatedAt: string }).updatedAt = forecastAt;
  }
  return { data, history };
}
function observation(target: SettlementTarget) {
  const paper = target.kind === 'paper';
  return { kind: target.kind, recordId: target.recordId, identityHash: target.identityHash, sport: target.sport, event: target.event, eventDate: '2026-11-04', outcome: paper ? 'lost' as const : 'won' as const, settledAt, eventCompleted: true, termsConfirmed: true, termsReference: 'SYNTHETIC normal full-participation settlement; no ambiguous special rules.', verification: 'owner_attested' as const, ownerAttested: true, sources: [], notes: 'SYNTHETIC owner test attestation only.', actualPayoutCents: target.kind === 'actual' ? target.stakeType === 'bonus' ? 430 : 1000 : null, legs: target.legs.map(leg => ({ legId: leg.legId, sport: leg.sport, event: leg.event, participant: leg.participant, market: leg.market, selection: leg.selection, line: leg.line, outcome: paper ? 'lost' as const : 'won' as const, statistic: paper ? '17 points' : '20 points', observedValue: paper ? 17 : 20, clearanceMargin: paper ? -1.5 : 1.5 })), specialCases: [], specialCaseResolution: null };
}
async function resultResponse(data: AppData, history: Awaited<ReturnType<typeof fixture>>['history']): Promise<SettlementResponse> {
  return { format: 'edgelab.settlement-response', version: 1, id: 'SYNTHETIC-results-response', createdAt: '2026-11-05T00:00:00Z', observations: (await buildSettlementTargets(data, history)).map(observation) };
}

describe('reviewed daily batch persistence uses existing workspaces without a second ledger', () => {
  it('settles cash, bonus and core paper in one pure app transform with correct separate totals', async () => {
    const { data, history } = await fixture(); const before = structuredClone(data), oldHistory = structuredClone(history);
    const response = await resultResponse(data, history), keys = response.observations.filter(o => o.kind !== 'historical_paper').map(o => `${o.kind}:${o.recordId}`);
    const next = await applyAppResultBatch(data, history, response, keys, 'demo');
    expect(next.summary.applied).toHaveLength(3); expect(data).toEqual(before); expect(history).toEqual(oldHistory);
    expect(next.data.bets.every(bet => bet.outcome === 'won')).toBe(true);
    expect(calculateMetrics(next.data.bets, next.data.transactions)).toMatchObject({ profitCents: 930, bonusProfitCents: 430, totalDepositsCents: 0 });
    expect(next.data.paperPredictions[0].outcome).toBe('lost'); expect(next.data.paperPredictions[0].candidate).toEqual(before.paperPredictions[0].candidate);
    expect(next.data.audit).toHaveLength(3); expect(next.data.transactions).toEqual([]);
    expect((next.data.audit[0].after as { settlementEvidence: unknown }).settlementEvidence).toBeTruthy();
  });
  it('persists imported-paper evidence, result and accurate audits in exactly one historical revision', async () => {
    const { data, history } = await fixture(); const before = structuredClone(history);
    const response = await resultResponse(data, history), keys = response.observations.filter(o => o.kind === 'historical_paper').map(o => `${o.kind}:${o.recordId}`);
    const next = await applyHistoricalResultBatch(history, data, response, keys, 'demo');
    expect(next.data.revision).toBe(history.revision + 1); expect(next.summary.applied).toHaveLength(1);
    expect(next.data.records.slice(0, history.records.length)).toEqual(before.records);
    expect(next.data.audit.slice(0, history.audit.length)).toEqual(before.audit);
    expect(next.data.notifications).toEqual(before.notifications); expect(history).toEqual(before);
    expect(next.data.paperResults[0].outcome).toBe('won'); expect(next.data.records.at(-1)?.snapshot.kind).toBeNull();
    validateHistoricalTransition(before, next.data);
  });
  it('makes replay a no-op in each workspace and supports retry after a partial two-workspace save', async () => {
    const { data, history } = await fixture(); const response = await resultResponse(data, history);
    const appKeys = response.observations.filter(o => o.kind !== 'historical_paper').map(o => `${o.kind}:${o.recordId}`), historyKeys = response.observations.filter(o => o.kind === 'historical_paper').map(o => `${o.kind}:${o.recordId}`);
    const first = await applyAppResultBatch(data, history, response, appKeys, 'demo');
    const replay = await applyAppResultBatch(first.data, history, response, appKeys, 'demo');
    expect(replay.data).toBe(first.data); expect(replay.summary.applied).toEqual([]); expect(replay.summary.alreadyApplied).toHaveLength(3);
    const remaining = await applyHistoricalResultBatch(history, first.data, response, historyKeys, 'demo');
    const repeatedHistory = await applyHistoricalResultBatch(remaining.data, first.data, response, historyKeys, 'demo');
    expect(repeatedHistory.data).toBe(remaining.data); expect(repeatedHistory.summary.alreadyApplied).toHaveLength(1);
  });
  it('rejects a response-id collision and later replay after an audited record was changed', async () => {
    const { data, history } = await fixture(); const response = await resultResponse(data, history), key = `actual:${data.bets[0].id}`;
    const applied = await applyAppResultBatch(data, history, response, [key], 'demo');
    const changedResponse = structuredClone(response); changedResponse.observations[0].notes = 'SYNTHETIC different evidence';
    await expect(applyAppResultBatch(applied.data, history, changedResponse, [key], 'demo')).rejects.toThrow('response ID');
    const changedData = structuredClone(applied.data); changedData.bets[0].notes += '\nSYNTHETIC later correction.';
    await expect(applyAppResultBatch(changedData, history, response, [key], 'demo')).rejects.toThrow('since changed');
  });
  it('fails the whole workspace batch before applying any row when one payout is inconsistent', async () => {
    const { data, history } = await fixture(); const before = structuredClone(data), response = await resultResponse(data, history);
    const bonus = response.observations.find(o => o.kind === 'actual' && o.recordId === data.bets[1].id)!; bonus.actualPayoutCents = 930;
    await expect(applyAppResultBatch(data, history, response, response.observations.filter(o => o.kind === 'actual').map(o => `actual:${o.recordId}`), 'demo')).rejects.toThrow('cash payout');
    expect(data).toEqual(before);
  });
  it('rejects unknown/cross-owner IDs, duplicate selections, stale identities and credential-bearing evidence', async () => {
    const { data, history } = await fixture(), response = await resultResponse(data, history), key = `actual:${data.bets[0].id}`;
    await expect(applyAppResultBatch(createEmptyData(), emptyHistoricalWorkspace(), response, [key], 'demo')).rejects.toThrow('authenticated workspace');
    await expect(applyAppResultBatch(data, history, response, [key, key], 'demo')).rejects.toThrow('once');
    const stale = structuredClone(data); stale.bets[0].odds = 3;
    await expect(applyAppResultBatch(stale, history, response, [key], 'demo')).rejects.toThrow('changed since');
    const unsafe = structuredClone(response); unsafe.observations[0].notes = 'SYNTHETIC password: do-not-store';
    await expect(applyAppResultBatch(data, history, unsafe, [key], 'demo')).rejects.toThrow('credentials');
  });
  it('keeps origin links immutable and prevents a second placed position from the same imported research source', async () => {
    const id = uuid(), record = actual('cash'); record.notes = withResearchRecordLink(record.notes, id);
    expect(readResearchRecordLink(record.notes)).toBe(id); expect(researchPlacementDuplicate([record], id)?.id).toBe(record.id);
    expect(researchPlacementDuplicate([record], uuid())).toBeUndefined();
    expect(withResearchRecordLink(record.notes, id)).toBe(record.notes);
    expect(() => withResearchRecordLink(record.notes, uuid())).toThrow('different research record');
    expect(() => withResearchRecordLink('', 'not-a-uuid')).toThrow('saved EdgeLab identifier');
  });
});

const postgresRuntime = process.env.EDGELAB_POSTGRES_RUNTIME;
interface TestDatabase {
  exec(sql: string): Promise<unknown>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}
describe.skipIf(!postgresRuntime)('optional local PostgreSQL daily batch persistence', () => {
  it('round-trips source receipts and results through existing normal-user RPCs without a migration or funding write', async () => {
    const { PGlite } = createRequire(path.resolve(postgresRuntime!, 'package.json'))('@electric-sql/pglite') as { PGlite: new () => TestDatabase };
    const db = new PGlite(), owner = uuid(), other = uuid();
    const login = async (id: string, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec(`set role ${role}`); };
    const loadHistory = async (expected = owner) => (await db.query<{ result: Awaited<ReturnType<typeof fixture>>['history'] }>('select public.edgelab_load_history($1::uuid) result', [expected])).rows[0].result;
    const loadApp = async () => (await db.query<{ result: { workspace: AppData; revision: number } }>('select public.edgelab_load_workspace() result')).rows[0].result;
    try {
      await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
      for (const name of (await readdir('supabase/migrations')).filter(value => value.endsWith('.sql')).sort()) await applyLocalMigration(db, name, (await readFile(`supabase/migrations/${name}`, 'utf8')).replace('create extension if not exists pgcrypto;', '-- builtin UUIDs'));
      await db.query('insert into auth.users(id) values($1),($2)', [owner, other]); await login(owner);
      expect((await db.query<{ actor: string }>('select current_user actor')).rows[0].actor).toBe('authenticated');
      const initial = await fixture('supabase'); initial.history.revision = 1;
      initial.data.bets[0].notes = withResearchRecordLink(initial.data.bets[0].notes, initial.history.records[0].id);
      initial.data.bets[0].placedAt = '2026-11-03T00:10:00Z';
      initial.data.bets[0].confirmedAt = initial.data.bets[0].placedAt;
      await db.query('select public.edgelab_save_workspace($1::jsonb,0)', [JSON.stringify(initial.data)]);
      await db.query('select public.edgelab_save_history($1::jsonb,0,$2::uuid)', [JSON.stringify(initial.history), owner]);
      const beforeApp = await loadApp(), beforeHistory = await loadHistory();
      expect(readResearchRecordLink(beforeApp.workspace.bets[0].notes)).toBe(beforeHistory.records[0].id);
      expect(beforeApp.workspace.bets[0].candidateId).toBeUndefined();
      const response = await resultResponse(beforeApp.workspace, beforeHistory);
      const appKeys = response.observations.filter(row => row.kind !== 'historical_paper').map(row => `${row.kind}:${row.recordId}`), historyKeys = response.observations.filter(row => row.kind === 'historical_paper').map(row => `${row.kind}:${row.recordId}`);
      const updatedApp = await applyAppResultBatch(beforeApp.workspace, beforeHistory, response, appKeys, 'supabase');
      await db.query('select public.edgelab_save_workspace($1::jsonb,$2::bigint)', [JSON.stringify(updatedApp.data), beforeApp.revision]);
      const savedApp = await loadApp();
      const updatedHistory = await applyHistoricalResultBatch(beforeHistory, savedApp.workspace, response, historyKeys, 'supabase');
      await db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid)', [JSON.stringify(updatedHistory.data), beforeHistory.revision, owner]);
      const savedHistory = await loadHistory();
      expect(savedApp.workspace.bets.map(bet => bet.outcome)).toEqual(['won', 'won']);
      expect(savedHistory.paperResults[0].outcome).toBe('won');
      expect(savedHistory.records.slice(0, beforeHistory.records.length)).toEqual(beforeHistory.records);
      expect(savedHistory.notifications).toEqual(beforeHistory.notifications);
      expect((await db.query<{ count: number }>('select count(*)::int count from public.financial_transactions')).rows[0].count).toBe(0);
      expect((await applyAppResultBatch(savedApp.workspace, savedHistory, response, appKeys, 'supabase')).summary.alreadyApplied).toHaveLength(3);
      expect((await applyHistoricalResultBatch(savedHistory, savedApp.workspace, response, historyKeys, 'supabase')).summary.alreadyApplied).toHaveLength(1);
      await expect(db.query('select public.edgelab_save_workspace($1::jsonb,$2::bigint)', [JSON.stringify(savedApp.workspace), beforeApp.revision])).rejects.toThrow(/revision conflict/i);
      await expect(db.query("update public.historical_research_records set payload=jsonb_set(payload,'{raw}', '{}'::jsonb) where id=$1::uuid", [beforeHistory.records[0].id])).rejects.toThrow(/immutable|rewrit/i);
      await login(other); expect((await loadHistory(other)).records).toEqual([]);
      expect((await db.query<{ count: number }>('select count(*)::int count from public.bets')).rows[0].count).toBe(0);
      expect((await db.query<{ count: number }>('select count(*)::int count from public.audit_history')).rows[0].count).toBe(0);
      await expect(loadHistory(owner)).rejects.toThrow(/owner changed/i);
      await login('', 'anon'); await expect(loadHistory()).rejects.toThrow(/permission denied/i);
    } finally { await db.close(); }
  }, 30000);
});
