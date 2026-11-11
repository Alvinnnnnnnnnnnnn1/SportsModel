/** Ephemeral SQL with invented fixtures only. No credentials or hosted transport. */
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareReconciliationImport } from '@/lib/reconciliation/source';
import { createEmptyData } from '@/lib/domain/fixtures';
import { commitHistoricalImport, prepareImportCommit } from '@/lib/imports/commands';
import { emptyHistoricalWorkspace, type HistoricalWorkspace } from '@/lib/imports/types';
import { syntheticReconciliationSource } from './fixtures/reconciliation-source';
import { manualPlacementFields } from '@/lib/domain/ledger-review';

interface Database { exec(sql: string): Promise<unknown>; query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }>; close(): Promise<void>; }
const runtime = process.env.EDGELAB_POSTGRES_RUNTIME;
describe.skipIf(!runtime)('reconciliation / deployed SQL compatibility (local)', () => {
  it('round-trips the full inventory with normal-user RLS, immutable source history, replay protection and no cash writes', async () => {
    const { PGlite } = createRequire(path.resolve(runtime!, 'package.json'))('@electric-sql/pglite') as { PGlite: new () => Database };
    const db = new PGlite();
    const owner = '91000000-0000-4000-8000-000000000001', other = '91000000-0000-4000-8000-000000000002';
    const login = async (id: string, role = 'authenticated') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query("select set_config('edgelab.history_save','',false)");
      await db.exec(`set role ${role}`);
    };
    const load = async (id = owner) => (await db.query<{ result: HistoricalWorkspace }>('select public.edgelab_load_history($1::uuid) result', [id])).rows[0].result;
    try {
      await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
      for (const name of (await readdir('supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) await db.exec((await readFile(`supabase/migrations/${name}`, 'utf8')).replace('create extension if not exists pgcrypto;', '-- builtin UUIDs'));
      await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
      await login(owner);
      const manual = { id: owner, placedAt: '2026-11-11T00:00:00Z', confirmedAt: '2026-11-11T00:01:00Z',
        bookmaker: 'SYNTHETIC LOCAL TEST BOOK', stakeCents: 500, stakeType: 'cash', odds: 2, outcome: 'pending', strategy: 'A', notes: 'SYNTHETIC local validation only; never written as a wager.',
        legs: [{ id: other, sport: 'NBA', event: 'SYNTHETIC LOCAL fixture', participant: 'SYNTHETIC LOCAL player', market: 'Points', selection: 'Over 10.5', line: '10.5', odds: 2, outcome: 'pending' }] };
      const validSnapshot = async (value: unknown) => (await db.query<{ ok: boolean }>('select public.edgelab_valid_bet_snapshot($1::jsonb) ok', [JSON.stringify(value)])).rows[0].ok;
      expect(await validSnapshot({ ...manual, recordedAt: manual.confirmedAt, lifecycle: 'valid', placementStatus: 'known_owner_attested' })).toBe(false);
      expect(await validSnapshot({ ...manual, ...manualPlacementFields('supabase', manual.placedAt, manual.confirmedAt) })).toBe(true);
      const input = { text: await syntheticReconciliationSource(), sourceName: 'SYNTHETIC-local-only.json', data: createEmptyData(), history: emptyHistoricalWorkspace(), mode: 'supabase' as const };
      const review = await prepareReconciliationImport(input);
      const next = commitHistoricalImport(input.history, prepareImportCommit(review.preview, review.preview.rows.map(row => ({ rowNumber: row.rowNumber, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false })), 'unverified'));
      const save = () => db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid)', [JSON.stringify(next), 0, owner]);
      await save();
      const loaded = await load();
      expect(loaded.records).toEqual(expect.arrayContaining(next.records));
      expect(loaded.records).toHaveLength(46);
      expect(loaded.batches[0].rawSource).toBe(next.batches[0].rawSource);
      expect(loaded.paperResults).toHaveLength(0);
      expect(loaded.notifications).toHaveLength(0);
      expect(loaded.records.find(r => r.snapshot.externalId === 'A10')?.snapshot).toMatchObject({ odds: null, stakeCents: null, outcome: null, payoutCents: null });
      expect((await db.query('select count(*)::int n from public.bets')).rows[0].n).toBe(0);
      expect((await db.query('select count(*)::int n from public.financial_transactions')).rows[0].n).toBe(0);
      await expect(save()).rejects.toThrow(/revision conflict/i);
      await expect(db.query("update public.historical_research_records set payload=jsonb_set(payload,'{snapshot,odds}','2.5'::jsonb) where id=$1", [loaded.records[0].id])).rejects.toThrow();
      const replay = await prepareReconciliationImport({ ...input, history: loaded });
      expect(replay.preview.rows.every(row => row.duplicates.some(d => d.level === 'exact'))).toBe(true);
      await login(other);
      expect((await load(other)).records).toHaveLength(0);
      await expect(load(owner)).rejects.toThrow(/owner changed/i);
      await expect(save()).rejects.toThrow(/owner changed/i);
      await login('', 'anon');
      await expect(load()).rejects.toThrow(/permission denied/i);
    } finally { await db.close(); }
  }, 30000);
});
