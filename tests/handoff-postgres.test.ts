import {applyLocalMigration} from '../scripts/lib/local-migration.mjs';
/**
 * Optional actual-domain -> PostgreSQL lifecycle test. Runtime lives outside app
 * dependencies. Everything is a labelled synthetic in-memory fixture; this file
 * never reads .env.local, connects to Supabase, sends email or touches real data.
 */
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEmptyData } from '@/lib/domain/fixtures';
import type { AppData } from '@/lib/domain/types';
import { calculateMetrics } from '@/lib/domain/calculations';
import { commitHistoricalImport, computeHypothetical, dismissHistoricalNotification, emptyHistoricalWorkspace, financialReview, markHistoricalNotificationRead, parseHistoricalSource, prepareImportCommit, settleHistoricalPaper, validateHistoricalWorkspace } from '@/lib/imports';
import type { HistoricalWorkspace, ImportDecision } from '@/lib/imports/types';
import { buildResearchHandoff, commitApprovedResearch, getResearchRecordMetadata, parseResearchResponse, prepareExperimentContextPreview, SYNTHETIC_RESEARCH_RESPONSE } from '@/lib/handoff';
interface Database {
  exec(sql: string): Promise<unknown>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}
const runtimePrefix = process.env.EDGELAB_POSTGRES_RUNTIME;
const approved = (rows: { rowNumber: number }[]): ImportDecision[] => rows.map(row => ({ rowNumber: row.rowNumber, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }));
const owner = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const reviewTime = new Date('2026-11-04T00:10:00Z');

describe.skipIf(!runtimePrefix)('optional actual-domain / embedded PostgreSQL continuation lifecycle', () => {
  it('persists history -> ledger -> prompt -> response -> immutable paper/results/alerts and isolates two ordinary owners', async () => {
    // Explicit, opt-in test runtime. No optional dependency is added to package.json.
    const runtime = createRequire(path.resolve(runtimePrefix!, 'package.json'));
    const { PGlite } = runtime('@electric-sql/pglite') as { PGlite: new () => Database };
    const db = new PGlite();
    const login = async (user: string, role: 'authenticated' | 'anon' = 'authenticated') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      await db.query("select set_config('edgelab.history_save','',false)");
      await db.exec(`set role ${role}`);
    };
    const load = async (expectedOwner = owner) => {
      const result = await db.query<{ result: HistoricalWorkspace }>('select public.edgelab_load_history($1::uuid) result', [expectedOwner]);
      return validateHistoricalWorkspace(result.rows[0].result);
    };
    const save = async (workspace: HistoricalWorkspace, expectedRevision: number, expectedOwner = owner) => {
      const result = await db.query<{ result: string | number }>('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid) result', [JSON.stringify(workspace), expectedRevision, expectedOwner]);
      expect(Number(result.rows[0].result)).toBe(expectedRevision + 1);
      return load(expectedOwner);
    };
    try {
      await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;");
      const directory = path.resolve('supabase/migrations');
      const names = (await readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
      expect(names).toEqual(['202611030001_edgelab.sql','202611030002_harden_workspace_integrity.sql','202611040001_historical_import.sql','202611130002_v6_source_cloud_compatible.sql','202611130003_v6_source_rpc_acl.sql']);
      for (const name of names) await applyLocalMigration(db, name, (await readFile(path.join(directory, name), 'utf8')).replace('create extension if not exists pgcrypto;', '-- builtin UUID generation is available in embedded PostgreSQL'));
      await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
      await login(owner);
      expect((await db.query<{ role: string }>('select current_user role')).rows[0].role).toBe('authenticated');
      expect(await load()).toEqual(emptyHistoricalWorkspace());

      // Owner attestation is simulated ONLY inside this local Auth shim. All
      // source labels remain SYNTHETIC LOCAL TEST; nothing is sent to production.
      const historicalSource = JSON.stringify([
        { externalId:'LOCAL-OLD-ACTUAL-1',kind:'actual',sport:'NBL',event:'SYNTHETIC LOCAL TEST old cash event',participant:'SYNTHETIC LOCAL TEST Home',market:'Match winner',selection:'SYNTHETIC LOCAL TEST Home to win',line:'Moneyline',bookmaker:'SYNTHETIC LOCAL TEST BOOK',odds:2.5,predictionAt:'2026-11-01T00:00:00Z',placedAt:'2026-11-01T00:05:00Z',settledAt:'2026-11-01T02:00:00Z',strategy:'A',sourceReference:'SYNTHETIC LOCAL TEST supplied historical source',stakeCents:500,stakeType:'cash',payoutCents:1250,outcome:'won',verification:'user_confirmed',notes:'SYNTHETIC LOCAL TEST ONLY. No actual wager or hosted import.' },
        { externalId:'LOCAL-OLD-PAPER-1',kind:'paper',sport:'ATP',event:'SYNTHETIC LOCAL TEST old paper event',participant:'SYNTHETIC LOCAL TEST Player',market:'Match winner',selection:'SYNTHETIC LOCAL TEST Player to win',line:'Moneyline',bookmaker:'SYNTHETIC LOCAL TEST BOOK',odds:1.8,predictionAt:'2026-11-01T00:00:00Z',strategy:'C',sourceReference:'SYNTHETIC LOCAL TEST supplied historical source',stakeCents:500,stakeType:'cash',outcome:'pending',verification:'user_confirmed',notes:'SYNTHETIC LOCAL TEST pending paper only.' },
      ],null,2);
      const oldPreview = await parseHistoricalSource({text:historicalSource,sourceName:'SYNTHETIC LOCAL TEST Days1-5.json',format:'json',verification:'user_confirmed'});
      let history = commitHistoricalImport(emptyHistoricalWorkspace(),prepareImportCommit(oldPreview,approved(oldPreview.rows),'user_confirmed'));
      history = await save(history,0);
      expect(history.records).toHaveLength(2);
      expect(history.batches[0].rawSource).toBe(historicalSource);
      expect(history.audit.some(entry=>entry.action==='import_confirmed')).toBe(true);
      expect((await db.query<{n:number}>('select count(*)::int n from public.bets')).rows[0].n).toBe(0);
      expect((await db.query<{n:number}>('select count(*)::int n from public.financial_transactions')).rows[0].n).toBe(0);

      // Separate explicit financial registration uses the actual domain review;
      // historical archive confirmation never creates funding or a ledger bet.
      const actual = history.records.find(record=>record.snapshot.kind==='actual')!;
      const financial = financialReview(actual);expect(financial.issues).toEqual([]);expect(financial.bet).not.toBeNull();
      const app = createEmptyData();app.bets.push({...financial.bet!,confirmedAt:reviewTime.toISOString()});
      const writeLedger = await db.query<{result:string|number}>('select public.edgelab_save_workspace($1::jsonb,$2::bigint) result',[JSON.stringify(app),0]);
      expect(Number(writeLedger.rows[0].result)).toBe(1);
      const persistedApp = (await db.query<{result:{workspace:AppData;revision:number}}>('select public.edgelab_load_workspace() result')).rows[0].result.workspace;
      expect(persistedApp.bets[0].id).toBe(actual.id);expect(persistedApp.transactions).toEqual([]);
      const originalFinancialMetrics = calculateMetrics(persistedApp.bets,persistedApp.transactions);
      expect(originalFinancialMetrics.profitCents).toBe(750);

      const contextPreview = await prepareExperimentContextPreview({completedDay:5,rulesText:'SYNTHETIC LOCAL TEST partial rule source; not a real rulebook.',sourceReference:'SYNTHETIC LOCAL TEST original context source',verification:'user_confirmed',confirmed:true,rulesCompleteConfirmed:false});
      const contextRevision = history.revision;
      history = await save(commitHistoricalImport(history,prepareImportCommit(contextPreview,approved(contextPreview.rows),'user_confirmed',history.records)),contextRevision);
      const handoff = buildResearchHandoff({appData:persistedApp,history,mode:'supabase',now:reviewTime});
      expect(handoff.context.latestConfirmedCompletedDay).toBe(5);expect(handoff.context.proposedResearchDay).toBe(6);expect(handoff.context.fullOriginalRulesAvailable).toBe(false);
      expect(handoff.context.outstanding).toHaveLength(1);expect(handoff.prompt).toContain('No funding is inferred');expect(handoff.reconciliation.fundingInferred).toBe(false);

      const source = structuredClone(SYNTHETIC_RESEARCH_RESPONSE);
      source.id='LOCAL-PGLITE-SYNTHETIC-RESPONSE-6';
      const responseText = JSON.stringify(source,null,2);
      const response = await parseResearchResponse({text:responseText,sourceName:'SYNTHETIC LOCAL TEST response.json',verification:'user_confirmed',existingRecords:history.records,now:reviewTime});
      const priorRevision = history.revision;
      const next = commitApprovedResearch(history,response,approved(response.importPreview.rows),'user_confirmed',{confirmDayCompletion:true,now:reviewTime});
      expect(next.revision).toBe(priorRevision+1);expect(next.notifications).toHaveLength(1);expect(next.paperResults).toHaveLength(1);
      history = await save(next,priorRevision);
      const forecast = history.records.find(record=>getResearchRecordMetadata(record)?.responseId===source.id&&record.snapshot.kind==='paper')!;
      expect(forecast.raw).toEqual(source.candidates[0]);
      expect(history.batches.find(batch=>batch.id===forecast.batchId)?.rawSource).toBe(responseText);
      expect(history.paperResults.find(result=>result.recordId===forecast.id)?.outcome).toBe('pending');
      expect(history.notifications[0].recordId).toBe(forecast.id);
      expect(history.audit.every(entry=>!entry.recordId||entry.batchId===history.records.find(record=>record.id===entry.recordId)?.batchId)).toBe(true);
      expect((await db.query<{n:number}>('select count(*)::int n from public.bets')).rows[0].n).toBe(1);
      expect((await db.query<{n:number}>('select count(*)::int n from public.financial_transactions')).rows[0].n).toBe(0);
      expect(buildResearchHandoff({appData:persistedApp,history,mode:'supabase',now:reviewTime}).context.latestConfirmedCompletedDay).toBe(6);

      // Save settlement with original forecast/source fully frozen, then compute
      // hypothetical performance from the SQL-reloaded actual domain entities.
      const frozen = structuredClone(forecast);
      const beforeSettlementRevision = history.revision;
      history = await save(settleHistoricalPaper(history,forecast.id,{recordId:forecast.id,outcome:'won',settledAt:'2026-11-05T03:00:00Z',statistic:'SYNTHETIC LOCAL TEST final result',legs:forecast.snapshot.legs.map(leg=>({legId:leg.id,outcome:'won',statistic:'SYNTHETIC LOCAL TEST 24 points'})),updatedAt:new Date().toISOString()}),beforeSettlementRevision);
      expect(history.records.find(record=>record.id===forecast.id)).toEqual(frozen);
      expect(computeHypothetical(frozen,history.paperResults.find(result=>result.recordId===forecast.id))).toMatchObject({returnCents:950,profitCents:450,accuracyEligible:true});
      expect(computeHypothetical(frozen,history.paperResults.find(result=>result.recordId===forecast.id)).brierScore).toBeCloseTo(.16);
      expect(calculateMetrics(persistedApp.bets,persistedApp.transactions)).toEqual(originalFinancialMetrics);
      expect(buildResearchHandoff({appData:persistedApp,history,mode:'supabase',now:reviewTime}).context.outstanding).toHaveLength(1);
      const notificationId = history.notifications[0].id;
      let revision=history.revision;history=await save(markHistoricalNotificationRead(history,notificationId),revision);expect(history.notifications[0].readAt).not.toBeNull();
      revision=history.revision;history=await save(dismissHistoricalNotification(history,notificationId),revision);expect(history.notifications[0].dismissedAt).not.toBeNull();
      expect(history.audit.some(entry=>entry.action==='paper_result_recorded')).toBe(true);expect(history.audit.some(entry=>entry.action==='notification_dismissed')).toBe(true);

      // Both domain duplicate review and database immutability are independently
      // exercised; bypassing the UI does not allow a frozen forecast rewrite.
      const duplicate=await parseResearchResponse({text:responseText,sourceName:'duplicate.json',verification:'user_confirmed',existingRecords:history.records,now:reviewTime});
      expect(duplicate.importPreview.rows[0].duplicates.some(match=>match.level==='exact')).toBe(true);
      expect(()=>commitApprovedResearch(history,duplicate,approved(duplicate.importPreview.rows),'user_confirmed',{now:reviewTime})).toThrow('duplicate');
      const altered=structuredClone(history);altered.revision++;altered.records.find(record=>record.id===forecast.id)!.snapshot.odds=2.1;
      await expect(db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid)',[JSON.stringify(altered),history.revision,owner])).rejects.toThrow(/immutable/i);
      expect((await load()).records.find(record=>record.id===forecast.id)).toEqual(frozen);
      const oldRevision=history.revision;
      history=await save({...history,revision:oldRevision+1},oldRevision);
      await expect(db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid)',[JSON.stringify({...history,revision:oldRevision+1}),oldRevision,owner])).rejects.toThrow(/revision conflict/i);

      await login(other);
      expect((await db.query<{role:string}>('select current_user role')).rows[0].role).toBe('authenticated');
      await expect(load(owner)).rejects.toThrow(/owner changed/i);expect(await load(other)).toEqual(emptyHistoricalWorkspace());
      for (const name of ['historical_workspace_revisions','historical_import_batches','historical_research_records','historical_paper_results','historical_notifications','historical_audit_history']) expect((await db.query<{n:number}>(`select count(*)::int n from public.${name}`)).rows[0].n).toBe(0);
      expect((await db.query('update public.historical_research_records set payload=payload where id=$1 returning id',[forecast.id])).rows).toHaveLength(0);
      await expect(db.query('insert into public.historical_workspace_revisions(user_id,revision) values($1,0)',[owner])).rejects.toThrow(/row-level security/i);
      await expect(db.query('select public.edgelab_save_history($1::jsonb,$2::bigint,$3::uuid)',[JSON.stringify({...history,revision:history.revision+1}),history.revision,owner])).rejects.toThrow(/owner changed/i);
      await login('','anon');
      await expect(db.query('select public.edgelab_load_history($1::uuid)',[owner])).rejects.toThrow(/permission denied|Authentication required/i);
      await expect(db.query('select * from public.historical_research_records')).rejects.toThrow(/permission denied/i);
      await login(owner);expect((await load()).records.find(record=>record.id===forecast.id)).toEqual(frozen);
    } finally { await db.close(); }
  },45000);
});
