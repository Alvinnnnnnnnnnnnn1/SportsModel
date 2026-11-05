import type { AppData, Candidate } from '@/lib/domain/types';

/** The same eligibility reason is used by the button and the queued mutation. */
export function paperApprovalBlocker(candidate: Candidate, data: Pick<AppData, 'paperPredictions' | 'bets'>, now = Date.now()): string | null {
  if (data.paperPredictions.some(paper => paper.candidate.id === candidate.id)) return 'This prediction is already in paper tracking.';
  if (data.bets.some(bet => bet.candidateId === candidate.id)) return 'This selection already links to an actual wager. A later paper registration cannot establish a separate pre-event forecast.';
  if (!Number.isFinite(Date.parse(candidate.startsAt)) || Date.parse(candidate.startsAt) <= now) return 'Pre-event registration is no longer available. Preserve this source as historical evidence instead of registering a qualifying paper forecast.';
  return null;
}
