import { describe, expect, it } from 'vitest';
import { getApprovalStatuses } from '@/lib/approval/status';

describe('approval statuses are separate dimensions rather than a verification promotion', () => {
  it('shows an unsaved browser attachment or reviewed proposal as draft', () => {
    expect(getApprovalStatuses().map(s => s.key)).toEqual(['draft']);
    expect(getApprovalStatuses()[0].description).toContain('browser attachment');
  });
  it('does not make an unverified archive owner-attested, financially registered or settled', () => {
    expect(getApprovalStatuses({ archived: true, outcome: 'won' }).map(s => s.key)).toEqual(['archived']);
  });
  it('labels Demo archiving as browser-only', () => {
    expect(getApprovalStatuses({ archived: true, mode: 'demo' })[0].description).toContain('browser');
  });
  it('keeps personal attestation and supporting material separate from independent verification', () => {
    const statuses = getApprovalStatuses({ archived: true, ownerAttested: true, evidenceProvided: true });
    expect(statuses.map(s => s.key)).toEqual(['archived', 'owner_attested', 'evidence_supported']);
    expect(statuses.find(s => s.key === 'owner_attested')?.description).toContain('not independently verified');
    expect(statuses.find(s => s.key === 'evidence_supported')?.description).toContain('unestablished');
  });
  it('allows an externally unverified actual wager to be financially registered and settled', () => {
    expect(getApprovalStatuses({ financialRegistered: true, ownerAttested: true, outcome: 'lost' }).map(s => s.key)).toEqual(['owner_attested', 'financial_registered', 'settled']);
  });
  it('does not treat an ineligible historical source outcome as a qualifying paper settlement', () => {
    expect(getApprovalStatuses({ archived: true, paperRegistered: true, outcome: 'won', paperSettlementEligible: false }).map(s => s.key)).toEqual(['archived', 'paper_registered']);
  });
  it('settles an eligible paper position without making it an actual wager', () => {
    expect(getApprovalStatuses({ archived: true, paperRegistered: true, outcome: 'lost', paperSettlementEligible: true }).map(s => s.key)).toEqual(['archived', 'paper_registered', 'settled']);
  });
  it('does not mark pending or unknown results as settled', () => {
    for (const outcome of ['pending', null, undefined] as const)
      expect(getApprovalStatuses({ financialRegistered: true, outcome }).some(s => s.key === 'settled')).toBe(false);
  });
});
