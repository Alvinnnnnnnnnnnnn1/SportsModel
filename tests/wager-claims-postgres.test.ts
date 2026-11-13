/**
 * Optional ephemeral PostgreSQL only. All names and attestations below are
 * SYNTHETIC LOCAL TEST fixtures; owner_reported exercises the private code path
 * through a local Auth shim. This never reads .env or contacts hosted Supabase.
 */
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { commitHistoricalImport, createHistoricalNotification, emptyHistoricalWorkspace, financialReview, parseHistoricalSource, prepareImportCommit, registerHistoricalPaper, validateHistoricalWorkspace } from '@/lib/imports';
import { prepareWagerClaimsReview, reviewArchivedWagerClaims } from '@/lib/imports/wager-claims';
import type { HistoricalWagerClaim, WagerClaimsEnvelope } from '@/lib/imports/wager-claim-provenance';
import type { HistoricalWorkspace } from '@/lib/imports/types';

interface Database {
  exec(sql: string): Promise<unknown>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}
const runtimePrefix = process.env.EDGELAB_POSTGRES_RUNTIME;
const owner = '90000000-0000-4000-8000-000000000001';
const other = '90000000-0000-4000-8000-000000000002';
const approved = (rows: { rowNumber: number }[]) => rows.map(row => ({ rowNumber: row.rowNumber, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }));

function claim(reference: string, changes: Partial<HistoricalWagerClaim> = {}): HistoricalWagerClaim {
  const participant = `SYNTHETIC LOCAL TEST ${reference}`;
  return {
    reference, sport: 'NBA', eventId: null, event: `SYNTHETIC LOCAL TEST ${reference} fixture`, participant,
    marketId: null, market: 'Player points', selection: 'Over 10.5 points', line: '10.5', bookmaker: 'SYNTHETIC LOCAL TEST BOOK',
    reportedStakeCents: 500, stakeType: 'cash', reportedOdds: 2, reportedOddsKind: 'owner_reported',
    acceptedOdds: null, acceptedOddsSource: null, placedAt: null, settledAt: null, ticketId: null,
    reportedOutcome: 'lost', reportedCashPayoutCents: 0, strategy: null,
    sourceReferences: [`SYNTHETIC LOCAL TEST ${reference} source; no real wager`], evidenceNotes: ['SYNTHETIC LOCAL TEST ONLY. Execution evidence unavailable.'],
    legs: [{ sport: 'NBA', eventId: null, event: null, participant, marketId: null, market: 'Player points', selection: 'Over 10.5 points', line: '10.5', odds: null, outcome: null, statistic: null }],
    ...changes,
  };
}

describe.skipIf(!runtimePrefix)('historical wager claim archive / existing PostgreSQL compatibility', () => {
  it('persists nullable execution evidence privately without financial effects and preserves existing history', async () => {
    const { PGlite } = createRequire(path.resolve(runtimePrefix!, 'package.json'))('@electric-sql/pglite') as { PGlite: new () => Database };
    const db = new PGlite();
    const login = async (id: string, role: 'authenticated' | 'anon' = 'authenticated') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query("select set_config('edgelab.history_save','',false)");
      await db.exec(`set role ${role}`);
    };
    const load = async (expected = owner) => validateHistoricalWorkspace((await db.query<{ result: HistoricalWorkspace }>('select public.edgelab_load_history($1::uuid) result', [expected])).rows[0].result);
    const save = async (next: HistoricalWorkspace, expectedRevision: number) => {
      await db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid)', [JSON.stringify(next), expectedRevision, owner]);
      return load();
    };
    try {
      await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
      const names = (await readdir('supabase/migrations')).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
      expect(names).toEqual(['202611030001_edgelab.sql', '202611030002_harden_workspace_integrity.sql', '202611040001_historical_import.sql', '202611130002_v6_source_cloud_compatible.sql']);
      for (const name of names) await db.exec((await readFile(path.join('supabase/migrations', name), 'utf8')).replace('create extension if not exists pgcrypto;', '-- embedded PostgreSQL provides UUID generation'));
      await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
      await login(owner);
      expect((await db.query<{ role: string }>('select current_user role')).rows[0].role).toBe('authenticated');

      const paper = await parseHistoricalSource({ text: JSON.stringify([{ externalId: 'SYNTHETIC-OLD-PAPER', kind: 'paper', sport: 'NBA', event: 'SYNTHETIC LOCAL TEST original paper fixture', participant: 'SYNTHETIC LOCAL TEST paper player', market: 'Player points', selection: 'Over 20.5 points', line: '20.5', bookmaker: 'SYNTHETIC LOCAL TEST BOOK', odds: 1.72, predictionAt: null, strategy: 'A', sourceReference: 'SYNTHETIC LOCAL TEST prior historical paper', stakeCents: null, stakeType: 'cash', outcome: 'won', notes: 'SYNTHETIC LOCAL TEST prior source only; no qualifying registration timing.' }]), sourceName: 'SYNTHETIC-local-prior-paper.json', format: 'json', verification: 'unverified' });
      let history = await save(commitHistoricalImport(emptyHistoricalWorkspace(), prepareImportCommit(paper, approved(paper.rows), 'unverified')), 0);
      let previousRevision = history.revision;
      history = await save(registerHistoricalPaper(history, history.records[0].id), previousRevision);
      previousRevision = history.revision;
      history = await save(createHistoricalNotification(history, history.records[0].id), previousRevision);
      const prior = structuredClone(history);

      const envelope: WagerClaimsEnvelope = {
        format: 'edgelab.historical-wager-claims', version: 1, sourceClass: 'owner_reported', sourceId: 'SYNTHETIC-LOCAL-WAGER-REVIEW',
        sourceReference: 'SYNTHETIC LOCAL TEST owner attestation', sourceText: 'SYNTHETIC LOCAL TEST source; an ephemeral Auth shim only, never hosted evidence.', checkpoint: null,
        records: [
          claim('SYNTHETIC-CASH-WIN', { reportedStakeCents: 1000, reportedOdds: 2.5, reportedOutcome: 'won', reportedCashPayoutCents: 2500 }),
          claim('SYNTHETIC-BONUS-WIN', { stakeType: 'bonus', reportedOdds: 1.86, reportedOutcome: 'won', reportedCashPayoutCents: 430 }),
          claim('SYNTHETIC-PENDING', { reportedOdds: 2.04, reportedOddsKind: 'pre_placement_quote', reportedOutcome: 'pending', reportedCashPayoutCents: null }),
        ],
      };
      const originalText = JSON.stringify(envelope);
      const review = await prepareWagerClaimsReview({ text: originalText, sourceName: 'SYNTHETIC-local-wager-claims.json', existingRecords: history.records, bets: [], mode: 'supabase' });
      expect(review.rows.every(row => row.archiveEligible && row.financial.bet === null)).toBe(true);
      expect(review.summary).toMatchObject({ reportedRealisedProfitCents: 1930, bonusCashWinningsCents: 430, pendingCashExposureCents: 500, fundingInferred: false });
      previousRevision = history.revision;
      history = await save(commitHistoricalImport(history, prepareImportCommit(review.preview, approved(review.preview.rows), 'unverified', history.records)), previousRevision);
      const refreshed = await load();
      expect(refreshed).toEqual(history);
      expect(refreshed.records[0]).toEqual(prior.records[0]);
      expect(refreshed.paperResults).toEqual(prior.paperResults);
      expect(refreshed.notifications).toEqual(prior.notifications);
      expect(refreshed.audit.slice(0, prior.audit.length)).toEqual(prior.audit);
      expect(JSON.parse(refreshed.batches.at(-1)!.rawSource).sourceEvidence.originalSource).toBe(originalText);
      expect(refreshed.audit.some(entry => entry.action === 'import_confirmed' && entry.after !== null && typeof entry.after === 'object' && 'financialEffect' in entry.after && entry.after.financialEffect === 'archive_only_no_funding_or_ledger_writes')).toBe(true);

      const claimRecords = refreshed.records.slice(1);
      expect(claimRecords.map(record => record.snapshot.odds)).toEqual([null, null, null]);
      expect(claimRecords.every(record => record.snapshot.placedAt === null && record.snapshot.settledAt === null && record.snapshot.verification === 'unverified')).toBe(true);
      expect(Object.fromEntries(claimRecords.map(record => {
        const claim = (record.raw as { sourceDocument: { claim: HistoricalWagerClaim } }).sourceDocument.claim;
        return [claim.reference, claim.reportedOdds];
      }))).toEqual({ 'SYNTHETIC-CASH-WIN': 2.5, 'SYNTHETIC-BONUS-WIN': 1.86, 'SYNTHETIC-PENDING': 2.04 });
      expect(claimRecords.every(record => financialReview(record).bet === null)).toBe(true);
      expect(reviewArchivedWagerClaims(refreshed.records, [], 'supabase').summary).toMatchObject({ claimCount: 3, reportedRealisedProfitCents: 1930, bonusCashWinningsCents: 430, pendingCashExposureCents: 500 });
      expect((await db.query<{ n: number }>('select count(*)::int n from public.bets')).rows[0].n).toBe(0);
      expect((await db.query<{ n: number }>('select count(*)::int n from public.financial_transactions')).rows[0].n).toBe(0);

      const duplicate = await prepareWagerClaimsReview({ text: originalText, sourceName: 'SYNTHETIC-local-wager-repeat.json', existingRecords: refreshed.records, bets: [], mode: 'supabase' });
      expect(duplicate.rows.every(row => row.duplicates.some(match => match.level === 'exact') && !row.archiveEligible)).toBe(true);
      expect(() => prepareImportCommit(duplicate.preview, approved(duplicate.preview.rows), 'unverified', refreshed.records)).toThrow(/duplicate/i);
      const changed = structuredClone(refreshed);
      changed.revision++;
      (changed.records[1].raw as { sourceDocument: { claim: HistoricalWagerClaim } }).sourceDocument.claim.reportedOdds = 9;
      await expect(save(changed, refreshed.revision)).rejects.toThrow(/immutable/i);
      expect(await load()).toEqual(refreshed);

      await login(other);
      expect((await db.query<{ role: string }>('select current_user role')).rows[0].role).toBe('authenticated');
      expect(await load(other)).toEqual(emptyHistoricalWorkspace());
      await expect(load(owner)).rejects.toThrow(/owner changed/i);
      expect((await db.query('select id from public.historical_research_records')).rows).toEqual([]);
      expect((await db.query('update public.historical_research_records set payload=payload where id=$1 returning id', [claimRecords[0].id])).rows).toEqual([]);
      await expect(db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid)', [JSON.stringify({ ...refreshed, revision: refreshed.revision + 1 }), refreshed.revision, owner])).rejects.toThrow(/owner changed/i);
      await login('', 'anon');
      await expect(load(owner)).rejects.toThrow(/permission denied|Authentication required/i);
      await expect(db.query('select id from public.historical_research_records')).rejects.toThrow(/permission denied/i);
      await login(owner);
      expect(await load()).toEqual(refreshed);
    } finally {
      await db.close();
    }
  }, 45000);
});
