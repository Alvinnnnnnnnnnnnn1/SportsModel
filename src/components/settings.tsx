"use client";

import { useState } from "react";
import Link from "next/link";
import { WorkspaceVerification } from "./workspace-verification";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Database,
  Download,
  FlaskConical,
  LockKeyhole,
  LogOut,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseRepository, getSupabaseClient } from "@/lib/persistence";
import { assertSettingsReadback } from "@/lib/workspace-verification";
import {
  signInWithEmail,
  signOutCurrentSession,
  signUpWithEmail,
} from "@/lib/auth/actions";
import { dateTime, money } from "@/lib/utils";

function parseAmount(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error(
      "Use a positive AUD amount with at most two decimal places.",
    );
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100_000_000)
    throw new Error("Enter an amount between $0.01 and $1,000,000.");
  return cents;
}

export function Settings() {
  const {
    data,
    mode,
    user,
    configured,
    setMode,
    updateSettings,
    addTransaction,
    notify,
  } = useApp();
  const [fundingCap, setFundingCap] = useState(
    (data.settings.fundingCapCents / 100).toFixed(2),
  );
  const [defaultStake, setDefaultStake] = useState(
    (data.settings.defaultStakeCents / 100).toFixed(2),
  );
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit");
  const [note, setNote] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingFunding, setSavingFunding] = useState(false);
  const [permission, setPermission] = useState<string | null>(null);
  const [error, setError] = useState("");
  const totalDeposits = data.transactions
    .filter((item) => item.kind === "deposit")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const capRemaining = data.settings.fundingCapCents - totalDeposits;

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavingSettings(true);
    try {
      const expected = {
        ...data.settings,
        fundingCapCents: parseAmount(fundingCap),
        defaultStakeCents: parseAmount(defaultStake),
      };
      await updateSettings(expected);
      if (mode === "supabase") {
        if (!user) throw new Error("Your private session changed. Reload before checking the saved settings.");
        assertSettingsReadback(expected, await createSupabaseRepository(user.id).load(), data.audit.filter(entry => entry.entityType === "settings").length + 1);
      }
      notify(mode === "supabase" ? "Private settings saved and read back · change recorded in audit history" : "Demo settings saved · change recorded in local audit history");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save settings.",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function recordFunding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavingFunding(true);
    try {
      await addTransaction({
        id: crypto.randomUUID(),
        kind,
        amountCents: parseAmount(amount),
        createdAt: new Date().toISOString(),
        note: note.trim(),
      });
      setAmount("");
      setNote("");
      notify("Funding record saved · no money has been transferred");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to record funding.",
      );
    } finally {
      setSavingFunding(false);
    }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      notify("This browser does not support desktop notifications.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      notify(
        result === "granted"
          ? "Browser notifications enabled while EdgeLab is open"
          : "Browser notification permission was not granted",
      );
    } catch {
      notify("Unable to request notification permission in this browser.");
    }
  }

  function exportData() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { workspace: mode, exportedAt: new Date().toISOString(), data },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `edgelab-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Workspace snapshot downloaded");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-400">
          Your workspace
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Settings
        </h1>
        <p className="muted mt-2 text-sm">
          Configure your research environment and experiment reference settings.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-300"
        >
          {error}
        </p>
      )}
      <WorkspaceVerification />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="panel p-5 sm:p-6">
          <SectionTitle
            icon={<FlaskConical className="size-4" />}
            title="Experiment settings"
            description="Configurable references for your existing experiment."
          />
          <form onSubmit={saveSettings} className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-2 text-sm">
                <span className="label">Lifetime funding cap · AUD</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={fundingCap}
                  onChange={(event) => setFundingCap(event.target.value)}
                  required
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="label">Default experimental stake · AUD</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={defaultStake}
                  onChange={(event) => setDefaultStake(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="label">Currency</p>
                <p className="mt-2 text-sm text-slate-300">
                  Australian dollar · AUD
                </p>
              </div>
              <div>
                <p className="label">Display timezone</p>
                <p className="mt-2 text-sm text-slate-300">
                  Australia/Melbourne
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-400">
              Your lifetime deposits total{" "}
              <span className="text-slate-200">{money(totalDeposits)}</span>.{" "}
              {capRemaining >= 0 ? (
                <span>
                  {money(capRemaining)} remains against the configured reference
                  cap.
                </span>
              ) : (
                <span className="text-amber-300">
                  Deposits exceed the reference cap by {money(-capRemaining)}.
                </span>
              )}{" "}
              These settings do not enforce or replace your existing experiment
              rules.
            </div>
            <Button
              type="submit"
              disabled={savingSettings || (mode === "supabase" && !user)}
            >
              <Save className="mr-2 size-3.5" />
              {savingSettings ? "Saving…" : "Save settings"}
            </Button>
          </form>
        </section>

        <section className="panel p-5 sm:p-6">
          <SectionTitle
            icon={<Database className="size-4" />}
            title="Storage & workspace"
            description="Synthetic demo data and private records stay separate."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setMode("demo")}
              className={`rounded-xl border p-4 text-left transition-colors ${mode === "demo" ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/10 hover:border-white/20"}`}
            >
              <div className="flex items-center gap-2">
                <FlaskConical className="size-4 text-emerald-400" />
                <span className="text-sm font-medium">Demo workspace</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Synthetic fixtures stored in this browser. No account or API
                keys.
              </p>
              <span className="mt-3 inline-block text-[10px] uppercase tracking-wider text-emerald-400">
                {mode === "demo" ? "Active" : "Available locally"}
              </span>
            </button>
            <button
              onClick={() => setMode("supabase")}
              disabled={!configured}
              className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${mode === "supabase" ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/10 hover:border-white/20"}`}
            >
              <div className="flex items-center gap-2">
                <LockKeyhole className="size-4 text-sky-400" />
                <span className="text-sm font-medium">Private workspace</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Supabase Auth and private PostgreSQL records. Starts empty.
              </p>
              <span className="mt-3 inline-block text-[10px] uppercase tracking-wider text-sky-400">
                {mode === "supabase"
                  ? "Active"
                  : configured
                    ? "Configured"
                    : "Setup required"}
              </span>
            </button>
          </div>
          {!configured && (
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              To enable private storage, configure your free Supabase project,
              apply the SQL migration and set the public environment variables
              in <code>.env.local</code>. See the repository README for the
              exact steps. No service-role key is used.
            </p>
          )}
          {configured && <AuthPanel />}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
            <span className="text-xs text-slate-500">
              Export ledger/settings only. Use the complete experiment backup to include historical sources and paper results.
            </span>
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="mr-1.5 size-3.5" />
              Export JSON
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/research">Complete experiment backup</Link>
            </Button>
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <SectionTitle
            icon={<ArrowDownLeft className="size-4" />}
            title="Funding records"
            description="Bookkeeping only. No deposits, withdrawals or transfers are executed."
          />
          <form onSubmit={recordFunding} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-2 text-sm">
                <span className="label">Record type</span>
                <select
                  aria-label="Record type"
                  className="input w-full"
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as "deposit" | "withdrawal")
                  }
                >
                  <option value="deposit">Deposit record</option>
                  <option value="withdrawal">Withdrawal record</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="label">Amount · AUD</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>
            </div>
            <label className="block space-y-2 text-sm">
              <span className="label">Note</span>
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional reference for your records"
                maxLength={1000}
              />
            </label>
            <Button
              variant="outline"
              type="submit"
              disabled={savingFunding || (mode === "supabase" && !user)}
            >
              <PlusIcon />
              {savingFunding ? "Recording…" : "Add funding record"}
            </Button>
          </form>
          <div className="mt-6 border-t border-white/[0.07] pt-4">
            <h3 className="text-xs font-medium text-slate-400">
              Transaction history
            </h3>
            {data.transactions.length ? (
              <ul className="mt-3 max-h-72 divide-y divide-white/[0.05] overflow-y-auto">
                {[...data.transactions]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((transaction) => (
                    <li
                      key={transaction.id}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 rounded-lg bg-white/5 p-2">
                          {transaction.kind === "deposit" ? (
                            <ArrowDownLeft className="size-3.5 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="size-3.5 text-slate-400" />
                          )}
                        </span>
                        <div>
                          <p className="text-xs capitalize text-slate-300">
                            {transaction.kind} record
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {dateTime(transaction.createdAt)}
                          </p>
                          {transaction.note && (
                            <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                              {transaction.note}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-sm font-medium tabular-nums ${transaction.kind === "deposit" ? "text-emerald-400" : "text-slate-300"}`}
                      >
                        {transaction.kind === "deposit" ? "+" : "−"}
                        {money(transaction.amountCents)}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="py-6 text-sm text-slate-500">
                No funding records yet.
              </p>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="panel p-5 sm:p-6">
            <SectionTitle
              icon={<Bell className="size-4" />}
              title="Browser notifications"
              description="Optional alerts while this browser tab is open."
            />
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              Allow browser notifications to display a simulated test alert from
              the notification centre. Background push delivery is not
              implemented. In-app notifications work without browser permission.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={enableNotifications}>
                Enable browser notifications
              </Button>
              {permission && (
                <span className="text-xs capitalize text-slate-500">
                  {permission === "unsupported"
                    ? "Unsupported browser"
                    : `Permission: ${permission}`}
                </span>
              )}
            </div>
          </section>
          <section className="panel p-5 sm:p-6">
            <SectionTitle
              icon={<ShieldCheck className="size-4" />}
              title="Research boundaries"
              description="A private research and record-keeping environment."
            />
            <ul className="mt-4 space-y-3 text-xs leading-relaxed text-slate-400">
              <li>
                All demo sports, odds, forecasts and outcomes are synthetic and
                explicitly labelled.
              </li>
              <li>
                No bookmaker accounts, login credentials, scraping or wager
                execution.
              </li>
              <li>No paid APIs or AI-generated numerical probabilities.</li>
              <li>
                Forecast provenance is preserved. Paper outcomes never affect
                actual bankroll.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="text-emerald-400">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        {description}
      </p>
    </div>
  );
}
function PlusIcon() {
  return <Settings2 className="mr-2 size-3.5" />;
}

function AuthPanel() {
  const { user, setMode, notify } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signUp, setSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase is not configured.");
      if (signUp) {
        const result = await signUpWithEmail(
          client,
          { email, password },
          window.location.origin,
        );
        setPassword("");
        if (result.status === "authenticated") {
          setMode("supabase");
          notify("Account created · private workspace opened");
        } else
          notify(
            "Check your email to confirm your account, then sign in here.",
          );
      } else {
        await signInWithEmail(client, { email, password });
        setPassword("");
        setMode("supabase");
        notify("Signed in to your private workspace");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Authentication failed.",
      );
    } finally {
      setPassword("");
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase is not configured.");
      await signOutCurrentSession(client);
      setMode("demo");
      notify("Signed out · returned to isolated demo workspace");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to sign out.";
      setError(message);
      // SIGNED_OUT can unmount this panel before a remote revocation error renders.
      notify(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 rounded-xl border border-white/[0.07] p-4">
      {user ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">Signed in with Supabase</p>
            <p className="mt-1 text-sm text-slate-200">{user.email}</p>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={signOut}>
            <LogOut className="mr-1.5 size-3.5" />
            Sign out
          </Button>
        </div>
      ) : (
        <form onSubmit={authenticate} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {signUp
                ? "Create your private account"
                : "Sign in to private storage"}
            </h3>
            <button
              type="button"
              className="text-xs text-emerald-400 hover:underline"
              onClick={() => {
                setSignUp(!signUp);
                setError("");
              }}
            >
              {signUp ? "Use existing account" : "Create account"}
            </button>
          </div>
          <label className="block space-y-1.5 text-xs">
            <span className="label">Email</span>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="block space-y-1.5 text-xs">
            <span className="label">Password</span>
            <Input
              type="password"
              autoComplete={signUp ? "new-password" : "current-password"}
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Please wait…" : signUp ? "Create account" : "Sign in"}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
