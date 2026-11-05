import type { QuotaStatus, SportsProviderId } from './types';
export class SportsAccessError extends Error {
  constructor(public code: 'DISABLED' | 'INVALID_REQUEST' | 'QUOTA_EXHAUSTED' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'CANCELLED', message: string, public providerMessage?: string) { super(message); }
}
export interface BudgetState { utcDay: string; used: number; remainingDaily: number | null; requestTimes?: number[]; blockedUntil?: number; remainingMinute?: number | null; }
export interface BudgetStore { read(provider: SportsProviderId): BudgetState | null; write(provider: SportsProviderId, state: BudgetState): void; }
export interface TransportOptions {
  fetcher?: typeof fetch; now?: () => number; sleep?: (milliseconds: number) => Promise<void>;
  store?: BudgetStore; dayBudget?: number; minuteBudget?: number; minSpacingMs?: number;
}
/** Single-process queue. Configuration and persistent budget storage are server-only.
 * Cancellation detaches one subscriber without aborting other shared subscribers.
 * An outbound timeout bounds the shared fetch. No timers perform polling. */
export class SportsTransport {
  private queue: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, { promise: Promise<{ value: unknown; retrievedAt: string; cached: boolean }>; controller: AbortController; subscribers: number }>();
  private cache = new Map<string, { value: unknown; retrievedAt: string; expires: number }>();
  private failures = new Map<string, number>();
  private calls: number[] = []; private lastStart = -Infinity;
  private quota: QuotaStatus;
  private fetcher: typeof fetch; private now: () => number; private sleep: (ms: number) => Promise<void>;
  constructor(readonly provider: SportsProviderId, private options: TransportOptions = {}) {
    if ([options.dayBudget, options.minuteBudget, options.minSpacingMs].some(value => value !== undefined && (!Number.isSafeInteger(value) || value < 1))) throw new SportsAccessError('INVALID_REQUEST', 'Sports budgets must be positive integers.');
    this.fetcher = options.fetcher ?? fetch; this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const saved = options.store?.read(provider), day = this.day();
    this.calls = saved?.requestTimes?.filter(time => time > this.now() - 60000) ?? [];
    this.lastStart = this.calls.at(-1) ?? -Infinity;
    this.quota = { utcDay: day, used: saved?.utcDay === day ? saved.used : 0,
      dayBudget: provider === 'thesportsdb' ? null : Math.min(70, Math.max(1, options.dayBudget ?? 70)),
      minuteUsed: 0, minuteBudget: Math.min(provider === 'thesportsdb' ? 20 : 6, Math.max(1, options.minuteBudget ?? (provider === 'thesportsdb' ? 20 : 6))),
      remainingDaily: saved?.utcDay === day ? saved.remainingDaily : null, remainingMinute: saved?.remainingMinute ?? null, blockedUntil: saved?.blockedUntil ?? 0, lastSuccess: null };
  }
  private day() { return new Date(this.now()).toISOString().slice(0, 10); }
  status(): QuotaStatus {
    if (this.quota.utcDay !== this.day()) { this.quota = { ...this.quota, utcDay: this.day(), used: 0, remainingDaily: null }; }
    this.calls = this.calls.filter(time => time > this.now() - 60000);
    if (this.now() - this.lastStart >= 60000) this.quota.remainingMinute = null;
    return { ...this.quota, minuteUsed: this.calls.length };
  }
  request(url: string, headers: Record<string, string>, ttl: number, signal?: AbortSignal): Promise<{ value: unknown; retrievedAt: string; cached: boolean }> {
    if (signal?.aborted) return Promise.reject(new SportsAccessError('CANCELLED', 'Sports request cancelled.'));
    const cached = this.cache.get(url);
    if (cached && cached.expires > this.now()) return Promise.resolve({ ...cached, cached: true });
    if ((this.failures.get(url) ?? 0) > this.now()) return Promise.reject(new SportsAccessError('UNAVAILABLE', 'Recent provider failure; retry after the short cooldown.'));
    let shared = this.pending.get(url);
    if (!shared) {
      if (this.pending.size >= 30) return Promise.reject(new SportsAccessError('RATE_LIMITED', 'The sports request queue is full.'));
      const controller = new AbortController();
      const promise = this.queue.catch(() => undefined).then(() => this.perform(url, headers, ttl, controller.signal));
      shared = { promise, controller, subscribers: 0 }; this.pending.set(url, shared); this.queue = promise;
      void promise.finally(() => this.pending.delete(url)).catch(() => undefined);
    }
    const subscribed = shared; subscribed.subscribers++;
    return new Promise((resolve, reject) => {
      let active = true;
      const detach = () => { if (!active) return; active = false; signal?.removeEventListener('abort', cancel); if (--subscribed.subscribers === 0) subscribed.controller.abort(); };
      const cancel = () => { detach(); reject(new SportsAccessError('CANCELLED', 'Sports request cancelled.')); };
      signal?.addEventListener('abort', cancel, { once: true });
      subscribed.promise.then(value => { if (active) { resolve(structuredClone(value)); detach(); } }, reason => { if (active) { reject(reason); detach(); } });
    });
  }

  private async perform(url: string, headers: Record<string, string>, ttl: number, signal: AbortSignal) {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal.aborted) throw new SportsAccessError('CANCELLED', 'Sports request cancelled.');
        const q = this.status();
        if ((q.dayBudget !== null && q.used >= q.dayBudget) || q.remainingDaily === 0) throw new SportsAccessError('QUOTA_EXHAUSTED', 'Daily sports-data budget exhausted; resets at 00:00 UTC.');
        const minuteWait = this.calls.length >= q.minuteBudget ? this.calls[0] + 60001 - this.now() : 0;
        const wait = Math.max(0, minuteWait, this.lastStart + Math.max(this.provider === 'thesportsdb' ? 3000 : 10000, this.options.minSpacingMs ?? 0) - this.now(), q.blockedUntil - this.now(), q.remainingMinute === 0 ? this.lastStart + 60001 - this.now() : 0);
        if (wait > 60000) throw new SportsAccessError('RATE_LIMITED', 'Provider cooldown exceeds one minute; try later.');
        if (wait) await new Promise<void>((resolve, reject) => {
          const cancelled = () => reject(new SportsAccessError('CANCELLED', 'Sports request cancelled.'));
          signal.addEventListener('abort', cancelled, { once: true });
          this.sleep(wait).then(() => { signal.removeEventListener('abort', cancelled); resolve(); }, reject);
        });
        if (signal.aborted) throw new SportsAccessError('CANCELLED', 'Sports request cancelled.');
        if (this.day() !== q.utcDay) this.status();
        this.lastStart = this.now(); this.calls.push(this.lastStart); this.quota.used++;
        if (this.quota.remainingDaily !== null) this.quota.remainingDaily = Math.max(0, this.quota.remainingDaily - 1);
        // Reserve durably before transport: failed/aborted requests also consume budget.
        this.persist();
        let response: Response;
        try { response = await this.fetcher(url, { headers, signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), cache: 'no-store', redirect: 'error' }); }
        catch { if (signal.aborted) throw new SportsAccessError('CANCELLED', 'Sports request cancelled.'); throw new SportsAccessError('UNAVAILABLE', 'Provider transport failed or timed out. No result was inferred.'); }
        const numberHeader = (name: string) => { const raw = response.headers.get(name); return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null; };
        const daily = numberHeader('x-ratelimit-requests-remaining');
        this.quota.remainingDaily = daily ?? this.quota.remainingDaily;
        this.quota.remainingMinute = numberHeader('x-ratelimit-remaining'); this.persist();
        if (response.status === 429) {
          const raw = response.headers.get('retry-after');
          const ms = raw && /^\d+(\.\d+)?$/.test(raw) ? Number(raw) * 1000 : raw ? Date.parse(raw) - this.now() : 60000;
          this.quota.blockedUntil = this.now() + Math.max(3000, Number.isFinite(ms) ? ms : 60000); this.persist();
          if (attempt === 0 && this.quota.blockedUntil - this.now() <= 60000) continue;
          throw new SportsAccessError('RATE_LIMITED', 'Provider rate limit reached. Retry-After is respected.');
        }
        if (!response.ok) throw new SportsAccessError('UNAVAILABLE', `Sports provider returned HTTP ${response.status}; no result was inferred.`);
        const text = await response.text();
        if (text.length > 4000000) throw new SportsAccessError('UNAVAILABLE', 'Provider response exceeded the supported size.');
        let value: unknown;
        try { value = JSON.parse(text); } catch { throw new SportsAccessError('UNAVAILABLE', 'Provider returned invalid JSON.'); }
        if (value && typeof value === 'object' && 'errors' in value && value.errors && Object.keys(value.errors).length) {
          const privateKey = headers['x-apisports-key'];
          const detail = JSON.stringify(value.errors).slice(0, 1000);
          throw new SportsAccessError('UNAVAILABLE', 'Provider rejected the request or this subscription does not cover it.', privateKey ? detail.split(privateKey).join('[REDACTED]') : detail);
        }
        this.quota.lastSuccess = new Date(this.now()).toISOString();
        if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(url, { value, retrievedAt: this.quota.lastSuccess, expires: this.now() + ttl });
        return { value: structuredClone(value), retrievedAt: this.quota.lastSuccess, cached: false };
      }
      throw new SportsAccessError('RATE_LIMITED', 'Provider retries exhausted.');
    } catch (reason) { if (!(reason instanceof SportsAccessError && reason.code === 'CANCELLED')) this.failures.set(url, this.now() + 15000); throw reason; }
  }
  private persist() { this.options.store?.write(this.provider, { utcDay: this.quota.utcDay, used: this.quota.used, remainingDaily: this.quota.remainingDaily, requestTimes: this.calls, blockedUntil: this.quota.blockedUntil, remainingMinute: this.quota.remainingMinute }); }
}
