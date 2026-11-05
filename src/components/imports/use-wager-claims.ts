'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app-provider';
import { useHistory } from '../history-provider';
import { prepareWagerClaimsReview, reviewArchivedWagerClaims } from '@/lib/imports/wager-claims';

const MAX_BYTES = 1048576;
const STORAGE_EVENT = 'edgelab:wager-claims-change';
type Source = { identity: string; name: string; text: string; retained: boolean };
type Review = Awaited<ReturnType<typeof prepareWagerClaimsReview>>;

/** Explicit browser retention is independent of archive/financial approval. */
export function wagerClaimsStorageKey(mode: 'demo' | 'supabase', userId: string | null) {
  return mode === 'demo' ? 'edgelab:wager-claims:demo:v1' : userId ? `edgelab:wager-claims:private:${userId}:v1` : null;
}

export function useWagerClaims() {
  const { mode, user, data, loading: appLoading, error: appError } = useApp();
  const { history, loading: historyLoading, error: historyError } = useHistory();
  const identity = mode === 'demo' ? 'demo' : user?.id ?? 'signed-out';
  const storageKey = wagerClaimsStorageKey(mode, user?.id ?? null);
  const [source, setSource] = useState<Source | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ identity: string; message: string } | null>(null);
  const error = failure?.identity === identity ? failure.message : '';
  const setError = useCallback((message: string) => setFailure(message ? { identity, message } : null), [identity]);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ identity: string; sourceText: string; records: typeof history.records; bets: typeof data.bets; review: Review } | null>(null);
  const generation = useRef(0);
  const fileGeneration = useRef(0);
  const ready = !appLoading && !historyLoading && !appError && !historyError && (mode === 'demo' || !!user);

  useEffect(() => {
    ++generation.current;
    ++fileGeneration.current;
    let alive = true;
    const update = () => setRevision(value => value + 1);
    const storage = (event: StorageEvent) => { if (event.key === storageKey) update(); };
    const changed = (event: Event) => { if ((event as CustomEvent<{ key: string }>).detail?.key === storageKey) update(); };
    window.addEventListener('storage', storage);
    window.addEventListener(STORAGE_EVENT, changed);
    void Promise.resolve().then(() => {
      if (!alive) return;
      try {
        const raw = storageKey ? window.localStorage.getItem(storageKey) : null;
        let restored: Source | null = null;
        if (raw !== null) {
          if (new TextEncoder().encode(raw).length > MAX_BYTES * 7) throw new Error('Retained claim attachment is too large. Clear it and attach the source again.');
          const value: unknown = JSON.parse(raw);
          if (!value || typeof value !== 'object' || !('name' in value) || typeof value.name !== 'string' || !('text' in value) || typeof value.text !== 'string' || value.name.length > 255 || new TextEncoder().encode(value.text).length > MAX_BYTES) throw new Error('Retained claim attachment is invalid. Clear it and attach the source again.');
          restored = { identity, name: value.name, text: value.text, retained: true };
        }
        setSource(restored);
        setError('');
      } catch (reason) {
        setSource(null);
        setError(reason instanceof Error ? reason.message : 'The local claim attachment could not be read.');
      } finally {
        setLoadedIdentity(identity);
      }
    });
    return () => { alive = false; window.removeEventListener('storage', storage); window.removeEventListener(STORAGE_EVENT, changed); };
  }, [identity, storageKey, revision, setError]);

  const visibleSource = source?.identity === identity ? source : null;
  const archived = useMemo(() => reviewArchivedWagerClaims(history.records, data.bets, mode), [history.records, data.bets, mode]);
  const review = ready && state?.identity === identity && visibleSource && state.sourceText === visibleSource.text && state.records === history.records && state.bets === data.bets ? state.review : null;

  useEffect(() => {
    const epoch = ++generation.current;
    let alive = true;
    if (ready && visibleSource) {
      void prepareWagerClaimsReview({ text: visibleSource.text, sourceName: visibleSource.name, existingRecords: history.records, bets: data.bets, mode }).then(result => {
        if (alive && epoch === generation.current) setState({ identity, sourceText: visibleSource.text, records: history.records, bets: data.bets, review: result });
      }).catch(reason => {
        if (alive && epoch === generation.current) {
          setState(null);
          setError(reason instanceof Error ? reason.message : 'The historical claims could not be validated.');
        }
      });
    }
    return () => { alive = false; };
  }, [ready, visibleSource, identity, history.records, data.bets, mode, setError]);

  const choose = useCallback(async (file: File | undefined) => {
    if (!file || !storageKey || !ready) return;
    const epoch = ++fileGeneration.current;
    setError('');
    try {
      if (file.size > MAX_BYTES) throw new Error('Choose a historical wager claims JSON file up to 1 MiB.');
      if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Choose a JSON historical wager claims file.');
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      const result = await prepareWagerClaimsReview({ text, sourceName: file.name, existingRecords: history.records, bets: data.bets, mode });
      if (epoch !== fileGeneration.current) return;
      setSource({ identity, name: file.name, text, retained: false });
      setState({ identity, sourceText: text, records: history.records, bets: data.bets, review: result });
    } catch (reason) {
      if (epoch === fileGeneration.current) setError(reason instanceof Error ? reason.message : 'The file is not valid UTF-8 JSON.');
    }
  }, [storageKey, ready, history.records, data.bets, mode, identity, setError]);

  function retain() {
    if (!storageKey || !visibleSource || !review || !ready || error) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ name: visibleSource.name, text: visibleSource.text }));
      setSource({ ...visibleSource, retained: true });
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key: storageKey } }));
      setError('');
    } catch {
      setError('This browser could not retain the attachment. No database records were changed.');
    }
  }

  function clear() {
    ++generation.current;
    ++fileGeneration.current;
    try {
      if (storageKey) window.localStorage.removeItem(storageKey);
      setSource(null);
      setState(null);
      setError('');
      if (storageKey) window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key: storageKey } }));
    } catch {
      setError('The browser attachment could not be cleared. Existing archive records are unchanged.');
    }
  }

  return { mode, user, ready, loading: appLoading || historyLoading || loadedIdentity !== identity, workspaceError: appError ?? historyError, error, source: visibleSource, review, archived, choose, retain, clear };
}
