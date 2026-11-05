import type { Mode, Outcome } from '@/lib/domain/types';

/** Presentation dimensions only; these never replace stored classifications or authorization. */
export interface ApprovalStatusFacts {
  archived?: boolean;
  mode?: Mode;
  ownerAttested?: boolean;
  evidenceProvided?: boolean;
  financialRegistered?: boolean;
  paperRegistered?: boolean;
  outcome?: Outcome | null;
  paperSettlementEligible?: boolean;
}
export interface ApprovalStatus {
  key: 'draft' | 'archived' | 'owner_attested' | 'evidence_supported' | 'financial_registered' | 'paper_registered' | 'settled';
  label: string;
  description: string;
  tone: 'neutral' | 'info' | 'review' | 'positive';
}

export function getApprovalStatuses(facts: ApprovalStatusFacts = {}): ApprovalStatus[] {
  const result: ApprovalStatus[] = [];
  if (!facts.archived && !facts.financialRegistered && !facts.paperRegistered)
    result.push({ key: 'draft', label: 'Draft', description: 'Not approved or saved. Reviewing or retaining a browser attachment does not archive or register it.', tone: 'neutral' });
  if (facts.archived)
    result.push({ key: 'archived', label: 'Archived', description: facts.mode === 'demo' ? 'Original synthetic evidence is preserved in this browser’s Demo archive. No actual financial registration is implied.' : 'Original evidence is preserved in your private archive. Archive approval does not register an actual wager.', tone: 'info' });
  if (facts.ownerAttested)
    result.push({ key: 'owner_attested', label: 'Owner-attested', description: 'Personally confirmed by the workspace owner; not independently verified by EdgeLab.', tone: 'review' });
  if (facts.evidenceProvided)
    result.push({ key: 'evidence_supported', label: 'Evidence-supported', description: 'Supporting material was supplied. Its accuracy and independent verification remain unestablished; inspect the source and verification level.', tone: 'info' });
  if (facts.financialRegistered)
    result.push({ key: 'financial_registered', label: 'Financially registered', description: 'This actual wager passed the financial requirements and separate owner confirmation. External verification is a separate matter.', tone: 'positive' });
  if (facts.paperRegistered)
    result.push({ key: 'paper_registered', label: 'Paper registered', description: 'A paper tracking position is saved. It is not an actual wager and never changes actual bankroll or financial ROI.', tone: 'info' });
  const outcomeRecorded = facts.outcome !== undefined && facts.outcome !== null && facts.outcome !== 'pending';
  if (outcomeRecorded && (facts.financialRegistered || (facts.paperRegistered && facts.paperSettlementEligible)))
    result.push({ key: 'settled', label: 'Settled', description: 'A registered actual wager or eligible paper position has a recorded result. This does not establish independent external verification.', tone: 'positive' });
  return result;
}
