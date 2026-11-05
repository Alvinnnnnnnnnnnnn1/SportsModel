'use client';
import { useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { useApp } from './app-provider';
import { Button } from './ui/button';
import { createSupabaseRepository, getSupabaseClient } from '@/lib/persistence';
import { createSupabaseHistoricalRepository } from '@/lib/imports/repository';
import { verifyPersonalWorkspace, type PersonalWorkspaceReport } from '@/lib/workspace-verification';
import { money } from '@/lib/utils';

export function WorkspaceVerification() {
  const { mode, user, loading } = useApp();
  // Key the interactive panel by identity so pending results cannot survive an account switch.
  return <VerificationPanel key={`${mode}:${user?.id ?? 'signed-out'}`} mode={mode} userId={user?.id ?? null} loading={loading} />;
}
function VerificationPanel({ mode, userId, loading }: { mode: 'demo' | 'supabase'; userId: string | null; loading: boolean }) {
  const [report, setReport] = useState<PersonalWorkspaceReport>();
  const [busy, setBusy] = useState(false);
  async function check() {
    if (mode !== 'supabase' || !userId) return;
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true); setReport(undefined);
    try {
      setReport(await verifyPersonalWorkspace({
        mode, expectedUserId: userId, getUser: () => client.auth.getUser(),
        loadActual: () => createSupabaseRepository(userId).load(),
        loadHistory: () => createSupabaseHistoricalRepository(userId).load(),
      }));
    } finally { setBusy(false); }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `edgelab-personal-workspace-check-${report.checkedAt.slice(0, 10)}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="panel p-5 sm:p-6" aria-label="Personal workspace verification">
    <h2 className="flex items-center gap-2.5 text-sm font-semibold"><ShieldCheck className="size-4 text-emerald-400" />Personal workspace verification</h2>
    <p className="mt-3 text-xs leading-relaxed text-slate-400">Check settings and research reads with your current signed-in session. This action creates no records and changes no settings, deposits or forecasts. No account setup or credentials are requested.</p>
    <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={loading || busy || mode !== 'supabase' || !userId} onClick={() => void check()}>{busy ? 'Checking access…' : 'Check private workspace · read only'}</Button>{report && <Button size="sm" variant="outline" onClick={download}><Download />Download sanitized check</Button>}</div>
    {mode !== 'supabase' && <p className="mt-3 text-xs text-slate-500">Available in your existing private workspace.</p>}
    {report && <div className="mt-4 space-y-3" role="status">
      {report.status === 'passed' ? <><p className="text-xs text-emerald-300">Authenticated settings and research reads passed with a stable normal-user identity.</p><p className="text-xs text-slate-400">{report.settingsStored ? `Stored cap ${money(report.settings!.fundingCapCents)} · default stake ${money(report.settings!.defaultStakeCents)}` : 'No stored settings record yet. Displayed application defaults are not evidence of a previous save.'} · recorded deposits {money(report.recordedDepositsCents ?? 0)}.</p><p className="text-xs text-slate-400">Historical records {report.counts!.historicalRecords} · paper-result records {report.counts!.historicalPaperResults} · historical alerts {report.counts!.historicalNotifications} · history revision {report.counts!.historyRevision}.</p></> : <p className="text-xs text-amber-200">{report.code === 'session_unavailable_or_changed' ? 'The authenticated session changed or could not be verified. No read results were retained. Return to the existing private workspace before retrying.' : 'Private workspace reads could not be completed. Check the existing workspace connection and retry; no records were changed.'}</p>}
      <p className="text-[11px] leading-relaxed text-slate-500">Read-only evidence. Saving, hosted historical writes and cross-account behavior are not tested here. To check refresh persistence, reload this page and run the check again. The downloadable report contains counts and settings, without account IDs, email addresses, source records or tokens.</p>
    </div>}
  </section>;
}
