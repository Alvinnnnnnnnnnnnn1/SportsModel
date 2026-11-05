import type { AppData, Mode } from '@/lib/domain/types';
import type { HistoricalWorkspace } from '@/lib/imports/types';

export interface PersonalWorkspaceReport {
  format: 'edgelab.personal-workspace-check';
  version: 1;
  checkedAt: string;
  scope: 'read-only existing authenticated session';
  status: 'passed' | 'failed';
  code: 'read_access_verified' | 'private_workspace_required' | 'session_unavailable_or_changed' | 'workspace_read_failed';
  normalUserIdentityVerified: boolean;
  writesPerformed: 0;
  settings: AppData['settings'] | null;
  settingsStored: boolean | null;
  recordedDepositsCents: number | null;
  counts: {
    actualBets: number;
    fundingTransactions: number;
    legacyPapers: number;
    legacyNotifications: number;
    legacyAudit: number;
    historyBatches: number;
    historicalRecords: number;
    historicalPaperResults: number;
    historicalNotifications: number;
    historicalAudit: number;
    historyRevision: number;
  } | null;
  unverified: readonly string[];
}
interface VerificationInput {
  mode: Mode;
  expectedUserId: string | null;
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  loadActual: () => Promise<AppData | null>;
  loadHistory: () => Promise<HistoricalWorkspace>;
  now?: Date;
}
const unverified = [
  'Settings save and read-after-write are not tested by this read-only check.',
  'Refresh persistence requires a second check after a browser reload.',
  'Positive historical writes, duplicate rejection, forecast immutability and cross-account isolation are not tested here.',
] as const;

/** Uses the caller's existing normal session. Its capabilities contain no write operation. */
export async function verifyPersonalWorkspace(input: VerificationInput): Promise<PersonalWorkspaceReport> {
  const base = {
    format: 'edgelab.personal-workspace-check' as const, version: 1 as const,
    checkedAt: (input.now ?? new Date()).toISOString(),
    scope: 'read-only existing authenticated session' as const, writesPerformed: 0 as const,
    settings: null, settingsStored: null, recordedDepositsCents: null, counts: null, unverified,
  };
  const failed = (code: PersonalWorkspaceReport['code']): PersonalWorkspaceReport => ({ ...base, status: 'failed', code, normalUserIdentityVerified: false });
  if (input.mode !== 'supabase' || !input.expectedUserId) return failed('private_workspace_required');
  const sameUser = async () => {
    try {
      const { data, error } = await input.getUser();
      return !error && data.user?.id === input.expectedUserId;
    } catch { return false; }
  };
  if (!await sameUser()) return failed('session_unavailable_or_changed');
  let actual: AppData | null;
  let history: HistoricalWorkspace;
  try { [actual, history] = await Promise.all([input.loadActual(), input.loadHistory()]); }
  catch { return failed('workspace_read_failed'); }
  // Discard all read results if the identity changed while requests were in flight.
  if (!await sameUser()) return failed('session_unavailable_or_changed');
  return {
    ...base, status: 'passed', code: 'read_access_verified', normalUserIdentityVerified: true,
    settings: actual ? { ...actual.settings } : null, settingsStored: actual !== null,
    recordedDepositsCents: actual ? actual.transactions.filter(t => t.kind === 'deposit').reduce((sum, t) => sum + t.amountCents, 0) : 0,
    counts: {
      actualBets: actual?.bets.length ?? 0, fundingTransactions: actual?.transactions.length ?? 0,
      legacyPapers: actual?.paperPredictions.length ?? 0, legacyNotifications: actual?.notifications.length ?? 0,
      legacyAudit: actual?.audit.length ?? 0, historyBatches: history.batches.length,
      historicalRecords: history.records.length, historicalPaperResults: history.paperResults.length,
      historicalNotifications: history.notifications.length, historicalAudit: history.audit.length,
      historyRevision: history.revision,
    },
  };
}

/** A successful write response is not enough: verify the stored values using a normal repository read. */
export function assertSettingsReadback(expected: AppData['settings'], stored: AppData | null, minimumSettingsAudits = 0): void {
  if (!stored || stored.audit.filter(entry => entry.entityType === 'settings').length < minimumSettingsAudits || (['fundingCapCents','defaultStakeCents','currency','timezone'] as const).some(key => stored.settings[key] !== expected[key])) {
    throw new Error('The settings write could not be confirmed by a private database read. No deposit was created. Reload this workspace and run the read-only check before saving again.');
  }
}
