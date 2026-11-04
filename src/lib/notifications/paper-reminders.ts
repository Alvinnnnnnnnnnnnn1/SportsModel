import type { AppData, AppNotification, Mode } from '@/lib/domain/types';
import type { HistoricalPaperResult, HistoricalRecord } from '@/lib/imports/types';

const PREFIX = 'Paper result source: ';
export function paperReminderRecordId(notification: AppNotification): string | null {
  const match = notification.message.match(/^Paper result source: ([0-9a-f-]{36})\n/i);
  return match?.[1] ?? null;
}

/** A source-linked reminder only; neither a new forecast nor a financial action. */
export function addPaperResultReminder(
  data: AppData, record: HistoricalRecord, result: HistoricalPaperResult | undefined, mode: Mode,
): AppData {
  if (record.snapshot.kind !== 'paper' && !(record.snapshot.kind === null && result))
    throw new Error('Only registered paper predictions can have result reminders.');
  const outcome = result?.outcome ?? record.snapshot.outcome;
  if (outcome !== null && outcome !== 'pending') throw new Error('This paper prediction is already settled.');
  if ((record.snapshot.verification === 'synthetic') !== (mode === 'demo'))
    throw new Error('Synthetic and private paper reminders must stay in their own workspace.');
  const existing = data.notifications.find(notification => notification.id === record.id);
  if (existing) {
    if (paperReminderRecordId(existing) !== record.id) throw new Error('Notification identity conflict. No record was replaced.');
    return data;
  }
  const s = record.snapshot;
  const notification: AppNotification = {
    id: record.id, title: `${mode === 'demo' ? 'SYNTHETIC · ' : ''}Paper result outstanding · ${s.sport ?? 'sport unknown'}`,
    message: `${PREFIX}${record.id}\n${s.event ?? 'Event unknown'} · ${s.participant ?? 'Participant unknown'} · ${s.selection ?? 'Selection unknown'} · Line ${s.line ?? 'unknown'}. Record only source-supported final results. This reminder does not settle a prediction or change bankroll.`,
    createdAt: new Date().toISOString(), simulated: mode === 'demo',
  };
  return { ...data, notifications: [notification, ...data.notifications] };
}
