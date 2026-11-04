'use client';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { useHistory } from '../history-provider';
import { Button } from '../ui/button';
export function HistoryStatus() {
  const { loading, error, needsMigration, reload } = useHistory();
  if (loading) return <div role="status" className="panel flex items-center gap-3 p-4 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading historical workspace…</div>;
  if (!error) return null;
  return <div role="alert" className="panel flex items-start gap-3 border-amber-300/20 p-4"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-200" /><div className="min-w-0 flex-1"><p className="text-xs text-amber-100">{needsMigration ? 'Hosted historical RPCs are unavailable' : 'Historical workspace unavailable'}</p><p className="mt-2 break-words text-[11px] leading-relaxed text-muted-foreground">{error}</p>{needsMigration && <p className="mt-2 text-[11px] text-muted-foreground">The existing ledger and research workspace remain available. Check the configured project and deployed migration/schema cache. The reviewed historical migration is already deployed to the intended project; do not reapply it. Demo remains separate.</p>}</div><Button size="sm" variant="outline" onClick={reload}>Retry</Button></div>;
}
