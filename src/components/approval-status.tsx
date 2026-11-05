import { getApprovalStatuses, type ApprovalStatusFacts } from '@/lib/approval/status';
import { Badge } from './ui/badge';
const styles = { neutral: 'border-border text-muted-foreground', info: 'border-sky-300/20 bg-sky-300/5 text-sky-200', review: 'border-amber-300/20 bg-amber-300/5 text-amber-200', positive: 'border-primary/20 bg-primary/5 text-primary' };

/** Separate status dimensions. The tooltip/legend explains each without claiming verification. */
export function ApprovalStatusBadges({ facts = {}, compact = false }: { facts?: ApprovalStatusFacts; compact?: boolean }) {
  const statuses = getApprovalStatuses(facts);
  return <div className="space-y-2" aria-label="Record approval statuses">
    <div className="flex flex-wrap gap-1.5">{statuses.map(status => <Badge key={status.key} title={status.description} className={styles[status.tone]}>{status.label}</Badge>)}</div>
    {!compact && <details className="text-[10px] text-muted-foreground"><summary className="cursor-pointer">What these statuses mean</summary><dl className="mt-2 space-y-2">{statuses.map(status => <div key={status.key}><dt className="font-medium text-foreground">{status.label}</dt><dd className="mt-0.5 leading-relaxed">{status.description}</dd></div>)}</dl></details>}
  </div>;
}
