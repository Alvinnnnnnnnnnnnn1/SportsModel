'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from './app-provider';
import type { HistoricalWorkspace, HistoricalPaperResult, ImportDecision, ImportPreview, VerificationStatus } from '@/lib/imports/types';
import { emptyHistoricalWorkspace } from '@/lib/imports/types';
import { createDemoHistoricalRepository, createSupabaseHistoricalRepository, HistoricalStorageError } from '@/lib/imports/repository';
import type { HistoricalRepository } from '@/lib/imports/types';
import { commitHistoricalImport, prepareImportCommit, registerHistoricalPaper, settleHistoricalPaper, createHistoricalNotification, markHistoricalNotificationRead, dismissHistoricalNotification, financialReview } from '@/lib/imports';
import { commitApprovedResearch, prepareResearchCommit, type ResearchPreview, type PriorResearchSelection } from '@/lib/handoff';
import { findHistoricalLedgerMatches } from '@/lib/imports/wager-claims';
import { readArchivedWagerClaim } from '@/lib/imports/wager-claim-provenance';
import { assertReconciliationSelection } from '@/lib/reconciliation/source';
import { latestDailyDecision, prepareDailyDecisionPreview, researchPaperBlockers, sourceResearchCandidate } from '@/lib/daily/research';
import { applyHistoricalResultBatch, type ResultBatchSummary } from '@/lib/daily/result-batch';
import type { SettlementResponse } from '@/lib/results';
import { archiveDailyCycle, savedDailyCycles, type DailyCycleReceipt } from '@/lib/daily-cycle/archive';
interface HistoryContextValue {
  saveDailyCycle: (text: string) => Promise<DailyCycleReceipt>;
  readCurrentHistory: () => HistoricalWorkspace;
  history: HistoricalWorkspace; loading: boolean; error: string | null; needsMigration: boolean;
  reload: () => void;
  refresh: () => Promise<void>;
  commitPreview: (preview: ImportPreview, decisions: ImportDecision[], verification: VerificationStatus) => Promise<void>;
  recordPaperResult: (id: string, result: HistoricalPaperResult) => Promise<void>;
  createNotification: (id: string) => Promise<void>;
  registerPaper: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>; dismiss: (id: string) => Promise<void>;
  confirmActual: (id: string) => Promise<void>;
  approveResearch: (preview: ResearchPreview, decisions: ImportDecision[], verification: VerificationStatus, confirmDayCompletion: boolean, previousProposals?: PriorResearchSelection[]) => Promise<void>;
  archiveResearch: (preview: ResearchPreview, decisions: ImportDecision[], verification: VerificationStatus, previousProposals?: PriorResearchSelection[]) => Promise<void>;
  decideResearch: (recordId: string, decision: 'watch' | 'pass', reason: string) => Promise<void>;
  registerResearchPaper: (recordId: string) => Promise<void>;
  applyResultBatch: (response: SettlementResponse, selectedKeys: string[]) => Promise<ResultBatchSummary>;
}
const Context = createContext<HistoryContextValue | null>(null);
export function useHistory() { const value = useContext(Context); if (!value) throw new Error('Historical workspace context is unavailable'); return value; }
export function HistoryProvider({ children }: { children: ReactNode }) {
  const { mode, user, loading: appLoading, data, readCurrentData, addBet } = useApp();
  const identity = mode === 'demo' ? 'demo' : user ? `private:${user.id}` : 'signed-out';
  const [state, setState] = useState({ identity: '', history: emptyHistoricalWorkspace(), loading: true, error: null as string | null, needsMigration: false });
  const [reloadVersion, setReloadVersion] = useState(0);
  const generation = useRef(0); const activeIdentity = useRef(identity);
  const repository = useRef<HistoricalRepository | null>(null); const current = useRef(emptyHistoricalWorkspace());
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let alive = true; const epoch = ++generation.current;
    activeIdentity.current = identity; repository.current = null; current.current = emptyHistoricalWorkspace();
    const load = async () => {
      if (appLoading) return;
      setState({ identity, history: emptyHistoricalWorkspace(), loading: true, error: null, needsMigration: false });
      try {
        const selected = mode === 'demo' ? createDemoHistoricalRepository() : user ? createSupabaseHistoricalRepository(user.id) : null;
        const loaded = selected ? await selected.load() : emptyHistoricalWorkspace();
        if (!alive || epoch !== generation.current) return;
        current.current = loaded; repository.current = selected;
        setState({ identity, history: loaded, loading: false, error: null, needsMigration: false });
      } catch (reason) {
        if (!alive || epoch !== generation.current) return;
        setState({ identity, history: emptyHistoricalWorkspace(), loading: false, error: reason instanceof Error ? reason.message : 'Historical workspace could not be loaded', needsMigration: reason instanceof HistoricalStorageError && reason.code === 'NEW_MIGRATION_REQUIRED' });
      }
    };
    void load(); return () => { alive = false; };
  }, [identity, appLoading, mode, user, reloadVersion]);
  const mutate = useCallback((expectedIdentity: string, transform: (workspace: HistoricalWorkspace) => HistoricalWorkspace | Promise<HistoricalWorkspace>) => {
    const epoch = generation.current;
    const work = queue.current.catch(() => {}).then(async () => {
      if (epoch !== generation.current || activeIdentity.current !== expectedIdentity || !repository.current) throw new Error('This workspace changed. Reopen it before saving.');
      const selectedRepository = repository.current;
      const before = current.current; const next = await transform(before);
      if (epoch !== generation.current || activeIdentity.current !== expectedIdentity || repository.current !== selectedRepository) throw new Error('This workspace changed. Reopen it before saving.');
      if (next === before || next.revision === before.revision) return;
      await selectedRepository.save(next, before.revision);
      if (epoch !== generation.current || activeIdentity.current !== expectedIdentity) return;
      current.current = next; setState({ identity: expectedIdentity, history: next, loading: false, error: null, needsMigration: false });
    });
    queue.current = work; return work;
  }, []);
  const displayed = state.identity === identity && !appLoading ? state.history : emptyHistoricalWorkspace();
  const refresh = () => {
    const epoch = generation.current;
    const work = queue.current.catch(() => {}).then(async () => {
      const selected = repository.current;
      if (epoch !== generation.current || activeIdentity.current !== identity || !selected) throw new Error('Open the intended historical workspace before refreshing.');
      try {
        const loaded = await selected.load();
        if (epoch !== generation.current || activeIdentity.current !== identity || repository.current !== selected) throw new Error('This historical workspace changed during refresh.');
        current.current = loaded; setState({ identity, history: loaded, loading: false, error: null, needsMigration: false });
      } catch (cause) {
        if (epoch === generation.current && activeIdentity.current === identity) setState(previous => ({ ...previous, loading: false, error: cause instanceof Error ? cause.message : 'Historical records could not be refreshed.', needsMigration: cause instanceof HistoricalStorageError && cause.code === 'NEW_MIGRATION_REQUIRED' }));
        throw cause;
      }
    });
    queue.current = work;
    return work;
  };
  const confirmActual = async (id: string) => {
    if (appLoading || state.identity !== identity || !repository.current) throw new Error('Open the current historical workspace first.');
    const record = displayed.records.find(item => item.id === id);
    if (!record || record.snapshot.kind !== 'actual') throw new Error('Only an actual record can be registered in the actual ledger.');
    if (mode === 'supabase' && record.snapshot.verification === 'synthetic') throw new Error('Synthetic records stay in Demo.');
    if (data.bets.some(bet => bet.id === id)) throw new Error('This record is already registered in the ledger.');
    if (readArchivedWagerClaim(record) && findHistoricalLedgerMatches(record, data.bets).length) throw new Error('This source or selection overlaps an existing actual wager. Review the duplicate evidence before financial registration; no second bet was recorded.');
    const review = financialReview(record);
    if (!review.bet) throw new Error(review.issues.map(issue => issue.message).join(' '));
    await addBet({ ...review.bet, id, confirmedAt: new Date().toISOString() });
  };
  const archiveResearch = (preview: ResearchPreview, decisions: ImportDecision[], verification: VerificationStatus, previousProposals?: PriorResearchSelection[]) => mutate(identity, value => commitHistoricalImport(value, prepareResearchCommit(preview, decisions, verification, value.records, { confirmDayCompletion: false, previousProposals })));
  const decideResearch = (recordId: string, decision: 'watch' | 'pass', reason: string) => mutate(identity, async value => {
    const record = value.records.find(item => item.id === recordId);
    if (!record) throw new Error('This research source is no longer in the current workspace.');
    const previous = latestDailyDecision(value, recordId);
    if (previous?.decision === decision && previous.reason === reason.trim()) return value;
    const preview = await prepareDailyDecisionPreview(record, decision, reason);
    return commitHistoricalImport(value, prepareImportCommit(preview, [{ rowNumber: 1, include: true, acknowledgeIncomplete: true, allowProbableDuplicate: false }], record.snapshot.verification, value.records));
  });
  const registerResearchPaper = (recordId: string) => mutate(identity, value => {
    const record = value.records.find(item => item.id === recordId);
    if (!record) throw new Error('This research source is no longer in the current workspace.');
    if (value.paperResults.some(result => result.recordId === recordId)) return value;
    const issues = researchPaperBlockers(record, value, readCurrentData());
    if (issues.length) throw new Error(issues.join(' '));
    let next = registerHistoricalPaper(value, recordId);
    next = createHistoricalNotification(next, recordId);
    return { ...next, revision: value.revision + 1 };
  });
  const applyResultBatch = async (response: SettlementResponse, selectedKeys: string[]) => {
    let summary: ResultBatchSummary = { applied: [], alreadyApplied: [] };
    await mutate(identity, async value => {
      const reviewed = await applyHistoricalResultBatch(value, readCurrentData(), response, selectedKeys, mode);
      summary = reviewed.summary;
      return reviewed.data;
    });
    return summary;
  };
  const registerPaper = (recordId: string) => mutate(identity, value => {
    const record = value.records.find(item => item.id === recordId);
    if (record && sourceResearchCandidate(record) && !value.paperResults.some(result => result.recordId === recordId)) {
      const issues = researchPaperBlockers(record, value, readCurrentData());
      if (issues.length) throw new Error(issues.join(' '));
    }
    return registerHistoricalPaper(value, recordId);
  });
  const commitPreview = (preview: ImportPreview, decisions: ImportDecision[], verification: VerificationStatus) => mutate(identity, value => {
    assertReconciliationSelection(preview, decisions, readCurrentData(), value);
    return commitHistoricalImport(value, prepareImportCommit(preview, decisions, verification, value.records));
  });
  const saveDailyCycle = async (text: string) => {
    let receipt: DailyCycleReceipt | undefined;
    await mutate(identity, async value => {
      const next = await archiveDailyCycle(value, text, mode); receipt = next.receipt; return next.history;
    });
    await refresh();
    const readBack = savedDailyCycles(current.current).find(item => item.recordId === receipt?.recordId);
    if (!readBack) throw new Error('The cycle save could not be confirmed by read-back. Reload before retrying; do not assume it failed.');
    return readBack;
  };
  return <Context.Provider value={{ saveDailyCycle, readCurrentHistory: () => structuredClone(current.current), history: displayed, loading: appLoading || state.identity !== identity || state.loading, error: state.identity === identity ? state.error : null, needsMigration: state.identity === identity && state.needsMigration, reload: () => setReloadVersion(value => value + 1), refresh, archiveResearch, decideResearch, registerResearchPaper, applyResultBatch, commitPreview, registerPaper, recordPaperResult: (id, result) => mutate(identity, value => settleHistoricalPaper(value, id, result)), approveResearch: (preview, decisions, verification, confirmDayCompletion, previousProposals) => mutate(identity, value => commitApprovedResearch(value, preview, decisions, verification, { confirmDayCompletion, previousProposals })), createNotification: id => mutate(identity, value => createHistoricalNotification(value, id)), markRead: id => mutate(identity, value => markHistoricalNotificationRead(value, id)), dismiss: id => mutate(identity, value => dismissHistoricalNotification(value, id)), confirmActual }}>{children}</Context.Provider>;
}
