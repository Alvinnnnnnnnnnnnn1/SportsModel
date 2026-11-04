'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from './app-provider';
import type { HistoricalWorkspace, HistoricalPaperResult, ImportDecision, ImportPreview, VerificationStatus } from '@/lib/imports/types';
import { emptyHistoricalWorkspace } from '@/lib/imports/types';
import { createDemoHistoricalRepository, createSupabaseHistoricalRepository, HistoricalStorageError } from '@/lib/imports/repository';
import type { HistoricalRepository } from '@/lib/imports/types';
import { commitHistoricalImport, prepareImportCommit, registerHistoricalPaper, settleHistoricalPaper, createHistoricalNotification, markHistoricalNotificationRead, dismissHistoricalNotification, financialReview } from '@/lib/imports';
interface HistoryContextValue {
  history: HistoricalWorkspace; loading: boolean; error: string | null; needsMigration: boolean;
  reload: () => void;
  commitPreview: (preview: ImportPreview, decisions: ImportDecision[], verification: VerificationStatus) => Promise<void>;
  recordPaperResult: (id: string, result: HistoricalPaperResult) => Promise<void>;
  createNotification: (id: string) => Promise<void>;
  registerPaper: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>; dismiss: (id: string) => Promise<void>;
  confirmActual: (id: string) => Promise<void>;
}
const Context = createContext<HistoryContextValue | null>(null);
export function useHistory() { const value = useContext(Context); if (!value) throw new Error('Historical workspace context is unavailable'); return value; }
export function HistoryProvider({ children }: { children: ReactNode }) {
  const { mode, user, loading: appLoading, data, addBet } = useApp();
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
  const mutate = useCallback((expectedIdentity: string, transform: (workspace: HistoricalWorkspace) => HistoricalWorkspace) => {
    const epoch = generation.current;
    const work = queue.current.catch(() => {}).then(async () => {
      if (epoch !== generation.current || activeIdentity.current !== expectedIdentity || !repository.current) throw new Error('This workspace changed. Reopen it before saving.');
      const before = current.current; const next = transform(before);
      if (next === before || next.revision === before.revision) return;
      await repository.current.save(next, before.revision);
      if (epoch !== generation.current || activeIdentity.current !== expectedIdentity) return;
      current.current = next; setState({ identity: expectedIdentity, history: next, loading: false, error: null, needsMigration: false });
    });
    queue.current = work; return work;
  }, []);
  const displayed = state.identity === identity && !appLoading ? state.history : emptyHistoricalWorkspace();
  const confirmActual = async (id: string) => {
    if (appLoading || state.identity !== identity || !repository.current) throw new Error('Open the current historical workspace first.');
    const record = displayed.records.find(item => item.id === id);
    if (!record || record.snapshot.kind !== 'actual') throw new Error('Only an actual record can be registered in the actual ledger.');
    if (mode === 'supabase' && record.snapshot.verification === 'synthetic') throw new Error('Synthetic records stay in Demo.');
    if (data.bets.some(bet => bet.id === id)) throw new Error('This record is already registered in the ledger.');
    const review = financialReview(record);
    if (!review.bet) throw new Error(review.issues.map(issue => issue.message).join(' '));
    await addBet({ ...review.bet, id, confirmedAt: new Date().toISOString() });
  };
  return <Context.Provider value={{ history: displayed, loading: appLoading || state.identity !== identity || state.loading, error: state.identity === identity ? state.error : null, needsMigration: state.identity === identity && state.needsMigration, reload: () => setReloadVersion(value => value + 1), commitPreview: (preview, decisions, verification) => mutate(identity, value => commitHistoricalImport(value, prepareImportCommit(preview, decisions, verification, value.records))), registerPaper: id => mutate(identity, value => registerHistoricalPaper(value, id)), recordPaperResult: (id, result) => mutate(identity, value => settleHistoricalPaper(value, id, result)), createNotification: id => mutate(identity, value => createHistoricalNotification(value, id)), markRead: id => mutate(identity, value => markHistoricalNotificationRead(value, id)), dismiss: id => mutate(identity, value => dismissHistoricalNotification(value, id)), confirmActual }}>{children}</Context.Provider>;
}
