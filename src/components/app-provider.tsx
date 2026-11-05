"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type {
  AppData,
  Bet,
  Candidate,
  ExperimentSettings,
  Mode,
  Outcome,
  Transaction,
} from "@/lib/domain/types";
import { createDemoData, createEmptyData } from "@/lib/domain/fixtures";
import {
  appDataSchema,
  betSchema,
  settingsSchema,
} from "@/lib/domain/validation";
import {
  mockResearchEngine,
  createTestNotification,
} from "@/lib/providers/mock";
import {
  createDemoRepository,
  createSupabaseRepository,
  getSupabaseClient,
  isSupabaseConfigured,
  type Repository,
} from "@/lib/persistence";
import type { HistoricalRecord, HistoricalPaperResult } from '@/lib/imports/types';
import { addPaperResultReminder } from '@/lib/notifications/paper-reminders';
import { paperApprovalBlocker } from '@/lib/approval/paper';
interface AppContextValue {
  data: AppData;
  mode: Mode;
  loading: boolean;
  error: string | null;
  user: User | null;
  configured: boolean;
  running: boolean;
  setMode: (mode: Mode) => void;
  reload: () => void;
  notify: (message: string) => void;
  addBet: (bet: Bet) => Promise<void>;
  updateBet: (bet: Bet) => Promise<void>;
  addPaper: (candidate: Candidate) => Promise<void>;
  settlePaper: (
    id: string,
    outcome: Outcome,
    statistic?: string,
  ) => Promise<void>;
  markRead: (id?: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  runResearch: () => Promise<void>;
  testNotification: () => Promise<void>;
  updateSettings: (settings: ExperimentSettings) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  remindPaperResult: (record: HistoricalRecord, result?: HistoricalPaperResult) => Promise<void>;
}
const Context = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("EdgeLab context is unavailable");
  return value;
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(createEmptyData);
  const [mode, changeMode] = useState<Mode>("demo");
  const [booted, setBooted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [revision, setRevision] = useState(0);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const repository = useRef<Repository | null>(null);
  const currentData = useRef(data);
  const generation = useRef(0);
  const authIdentity = useRef<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const researchLock = useRef<string | null>(null);
  const notify = useCallback((message: string) => setToast(message), []);
  const invalidateWorkspace = useCallback(() => {
    generation.current++;
    repository.current = null;
    currentData.current = createEmptyData();
    setData(currentData.current);
    setUser(null);
    setError(null);
    setLoading(true);
    researchLock.current = null;
    setRunning(false);
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        if (
          isSupabaseConfigured &&
          window.localStorage.getItem("edgelab:workspace") === "supabase"
        )
          changeMode("supabase");
      } catch {
        /* Demo repository reports unavailable storage when loading. */
      }
      setBooted(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!booted) return;
    let active = true;
    const epoch = ++generation.current;
    repository.current = null;
    const load = async () => {
      setLoading(true);
      setError(null);
      setUser(null);
      try {
        const nextRepo = mode === "demo" ? createDemoRepository() : null;
        let selected = nextRepo;
        if (mode === "supabase") {
          const client = getSupabaseClient();
          if (!client)
            throw new Error(
              "Configure the public Supabase environment variables, then restart the app.",
            );
          const { data: auth, error: authError } = await client.auth.getUser();
          if (authError && authError.name !== "AuthSessionMissingError")
            throw authError;
          if (active && generation.current === epoch) {
            authIdentity.current = auth.user?.id ?? null;
            setUser(auth.user);
          }
          if (auth.user) selected = createSupabaseRepository(auth.user.id);
        }
        let loaded = selected ? await selected.load() : null;
        if (!loaded) {
          loaded = mode === "demo" ? createDemoData() : createEmptyData();
          if (selected && mode === "demo") await selected.save(loaded);
        }
        const parsed = appDataSchema.parse(loaded) as AppData;
        if (!active || generation.current !== epoch) return;
        currentData.current = parsed;
        repository.current = selected;
        setData(parsed);
      } catch (reason) {
        if (active && generation.current === epoch) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load this workspace.",
          );
          currentData.current = createEmptyData();
          setData(currentData.current);
        }
      } finally {
        if (active && generation.current === epoch) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [booted, mode, revision]);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    const { data: subscription } = client.auth.onAuthStateChange(
      (event, session) => {
        const nextIdentity = session?.user.id ?? null;
        if (event === "INITIAL_SESSION") {
          authIdentity.current = nextIdentity;
          return;
        }
        if (
          (event === "SIGNED_IN" || event === "SIGNED_OUT") &&
          nextIdentity !== authIdentity.current
        ) {
          authIdentity.current = nextIdentity;
          invalidateWorkspace();
          setRevision((value) => value + 1);
        }
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, [invalidateWorkspace]);
  const mutate = useCallback((transform: (value: AppData) => AppData) => {
    const epoch = generation.current;
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        if (epoch !== generation.current || !repository.current)
          throw new Error(
            "Open an available workspace and sign in before saving.",
          );
        const next = appDataSchema.parse(
          transform(currentData.current),
        ) as AppData;
        await repository.current.save(next);
        if (epoch !== generation.current) return;
        currentData.current = next;
        setData(next);
      });
    queue.current = task;
    return task;
  }, []);
  const addBet = (bet: Bet) =>
    mutate((value) => {
      const parsed = betSchema.parse(bet) as Bet;
      if (value.bets.some((item) => item.id === parsed.id))
        throw new Error("This bet is already registered.");
      return {
        ...value,
        bets: [parsed, ...value.bets],
        audit: [
          ...value.audit,
          {
            id: crypto.randomUUID(),
            entityType: "bet",
            entityId: bet.id,
            action: "created_manual_confirmation",
            timestamp: new Date().toISOString(),
            before: null,
            after: parsed,
          },
        ],
      };
    });
  const updateBet = (bet: Bet) =>
    mutate((value) => {
      const before = value.bets.find((item) => item.id === bet.id);
      if (!before) throw new Error("This entry no longer exists.");
      const after = betSchema.parse({
        ...bet,
        confirmedAt: before.confirmedAt,
        candidateId: before.candidateId,
        probability: before.probability,
        oddsProvenance: before.oddsProvenance,
        probabilityProvenance: before.probabilityProvenance,
      }) as Bet;
      return {
        ...value,
        bets: value.bets.map((item) => (item.id === bet.id ? after : item)),
        audit: [
          ...value.audit,
          {
            id: crypto.randomUUID(),
            entityType: "bet",
            entityId: bet.id,
            action: "edited",
            timestamp: new Date().toISOString(),
            before,
            after,
          },
        ],
      };
    });
  const addPaper = (candidate: Candidate) =>
    mutate((value) => {
      const blocker = paperApprovalBlocker(candidate, value);
      if (blocker) throw new Error(blocker);
      const now = new Date().toISOString();
      return {
        ...value,
        paperPredictions: [
          {
            id: crypto.randomUUID(),
            candidate: structuredClone(candidate),
            registeredAt: now,
            hypotheticalStakeCents: value.settings.defaultStakeCents,
            outcome: "pending",
          },
          ...value.paperPredictions,
        ],
      };
    });
  const settlePaper = (id: string, outcome: Outcome, statistic?: string) =>
    mutate((value) => {
      const before = value.paperPredictions.find((item) => item.id === id);
      if (!before) throw new Error("Prediction not found.");
      const after = {
        ...before,
        outcome,
        statistic,
        settledAt: outcome === "pending" ? undefined : new Date().toISOString(),
      };
      return {
        ...value,
        paperPredictions: value.paperPredictions.map((item) =>
          item.id === id ? after : item,
        ),
        audit: [
          ...value.audit,
          {
            id: crypto.randomUUID(),
            entityType: "paper",
            entityId: id,
            action: "outcome_updated",
            timestamp: new Date().toISOString(),
            before,
            after,
          },
        ],
      };
    });
  const runResearch = async () => {
    if (mode !== "demo")
      throw new Error("Simulated research is isolated to the demo workspace.");
    if (researchLock.current) return;
    const epoch = generation.current;
    const runId = crypto.randomUUID();
    researchLock.current = runId;
    setRunning(true);
    const run = {
      id: runId,
      startedAt: new Date().toISOString(),
      status: "running" as const,
      candidateCount: 0,
      simulated: true,
    };
    try {
      await mutate((value) => ({
        ...value,
        researchRuns: [run, ...value.researchRuns],
      }));
      if (epoch !== generation.current) return;
      const result = await mockResearchEngine.run();
      if (epoch !== generation.current) return;
      await mutate((value) => ({
        ...value,
        candidates: [...result.candidates, ...value.candidates],
        notifications: [...result.notifications, ...value.notifications],
        researchRuns: value.researchRuns.map((item) =>
          item.id === run.id
            ? { ...result.run, id: run.id, startedAt: run.startedAt }
            : item,
        ),
      }));
      if (epoch === generation.current)
        notify(
          `Simulation complete · ${result.candidates.length} research candidates generated`,
        );
    } catch (reason) {
      if (epoch !== generation.current) return;
      const message =
        reason instanceof Error ? reason.message : "Simulation failed.";
      await mutate((value) => ({
        ...value,
        researchRuns: value.researchRuns.map((item) =>
          item.id === run.id
            ? {
                ...item,
                status: "failed",
                error: message,
                completedAt: new Date().toISOString(),
              }
            : item,
        ),
      })).catch(() => {});
      notify(message);
    } finally {
      if (researchLock.current === runId) {
        researchLock.current = null;
        setRunning(false);
      }
    }
  };
  const testNotification = async () => {
    if (mode !== "demo")
      throw new Error("Test notifications are available in demo mode.");
    const { candidate, notification } = createTestNotification();
    await mutate((value) => ({
      ...value,
      candidates: [candidate, ...value.candidates],
      notifications: [notification, ...value.notifications],
    }));
    notify("Simulated test notification created");
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("EdgeLab · SIMULATED research", {
          body: notification.message,
        });
      } catch {
        notify(
          "In-app test saved. Browser alert delivery is unavailable in this browser.",
        );
      }
    }
  };
  const updateSettings = (settings: ExperimentSettings) =>
    mutate((value) => {
      const after = settingsSchema.parse(settings) as ExperimentSettings;
      return {
        ...value,
        settings: after,
        audit: [
          ...value.audit,
          {
            id: crypto.randomUUID(),
            entityType: "settings",
            entityId: "experiment",
            action: "updated",
            timestamp: new Date().toISOString(),
            before: value.settings,
            after,
          },
        ],
      };
    });
  const addTransaction = (transaction: Transaction) =>
    mutate((value) => ({
      ...value,
      transactions: [...value.transactions, transaction],
      audit: [
        ...value.audit,
        {
          id: crypto.randomUUID(),
          entityType: "transaction",
          entityId: transaction.id,
          action: "recorded",
          timestamp: new Date().toISOString(),
          before: null,
          after: transaction,
        },
      ],
    }));
  return (
    <Context.Provider
      value={{
        data,
        mode,
        loading,
        error,
        user,
        configured: isSupabaseConfigured,
        running,
        setMode: (next) => {
          if (next === mode) return;
          invalidateWorkspace();
          changeMode(next);
          try {
            window.localStorage.setItem("edgelab:workspace", next);
          } catch {
            /* Workspace data save reports storage errors independently. */
          }
        },
        reload: () => {
          invalidateWorkspace();
          setRevision((value) => value + 1);
        },
        notify,
        addBet,
        updateBet,
        addPaper,
        settlePaper,
        runResearch,
        testNotification,
        updateSettings,
        addTransaction,
        remindPaperResult: (record, result) => mutate(value => addPaperResultReminder(value, record, result, mode)),
        markRead: (id) =>
          mutate((value) => ({
            ...value,
            notifications: value.notifications.map((item) =>
              !id || item.id === id
                ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
                : item,
            ),
          })),
        dismiss: (id) =>
          mutate((value) => ({
            ...value,
            notifications: value.notifications.map((item) =>
              item.id === id
                ? {
                    ...item,
                    dismissedAt: new Date().toISOString(),
                    readAt: item.readAt ?? new Date().toISOString(),
                  }
                : item,
            ),
          })),
      }}
    >
      {children}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[80] flex w-max max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-500/30 bg-[#18241f] px-5 py-3 text-sm text-emerald-100 shadow-xl"
        >
          <span className="size-1.5 rounded-full bg-primary" />
          {toast}
          <button
            aria-label="Dismiss message"
            className="ml-3 text-lg"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
