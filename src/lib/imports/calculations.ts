import { isHistoricalReviewRecord } from './review-status';
import { betSchema } from '@/lib/domain/validation';
import { multiplyMoney } from '@/lib/domain/calculations';
import type { Bet, BetLeg, Outcome } from '@/lib/domain/types';
import type { HistoricalFinancialReview, HistoricalPaperResult, HistoricalRecord, ImportIssue, ImportPreviewRow } from './types';
export interface HypotheticalResult {
    stakeCents: number | null;
    returnCents: number | null;
    profitCents: number | null;
    brierScore: number | null;
    probability: number | null;
    eligible: boolean;
    reason: string | null;
    hit: number | null;
    accuracyEligible: boolean;
}
function resultAmounts(stakeCents: number, odds: number, type: 'cash' | 'bonus', outcome: Outcome): {
    returnCents: number | null;
    profitCents: number | null;
} {
    if (outcome === 'pending')
        return { returnCents: null, profitCents: null };
    const payout = outcome === 'lost' ? 0 : outcome === 'void' ? type === 'cash' ? stakeCents : 0 : multiplyMoney(stakeCents, type === 'cash' ? odds : odds - 1);
    return { returnCents: payout, profitCents: outcome === 'void' ? 0 : payout - (type === 'cash' ? stakeCents : 0) };
}
export function financialReview(record: HistoricalRecord): HistoricalFinancialReview {
    const s = record.snapshot;
    const issues: ImportIssue[] = [];
    const error = (field: string, message: string) => issues.push({ field, severity: 'error', code: 'financial_confirmation_blocked', message });
    if (s.kind !== 'actual')
        error('kind', 'Only a source explicitly classified actual can be confirmed in the actual ledger.');
    for (const field of ['placedAt', 'bookmaker', 'odds', 'stakeCents', 'stakeType', 'outcome', 'strategy', 'sourceReference'] as const)
        if (s[field] === null)
            error(field, 'Original financial information is missing; resolve it explicitly before confirmation.');
    if (s.stakeCents === 0)
        error('stakeCents', 'Actual ledger stake must be greater than zero.');
    if (s.outcome && s.outcome !== 'pending' && !s.settledAt)
        error('settledAt', 'Original settlement timestamp is required for a settled actual entry. Import time is not substituted.');
    if (s.outcome === 'pending' && s.settledAt)
        error('settledAt', 'Pending entries cannot have a settlement timestamp.');
    const partialVoid = s.outcome === 'won' && s.legs.some(leg => leg.outcome === 'void');
    if (partialVoid)
        error('legs', 'Won parlays with void legs require source-supported adjusted settlement pricing. Original odds and reported payouts remain archived; no ledger payout is inferred.');
    if (!s.legs.length)
        error('legs', 'At least one exact selection is required.');
    for (const [index, leg] of s.legs.entries())
        for (const field of ['sport', 'event', 'participant', 'market', 'selection', 'line', 'odds', 'outcome'] as const)
            if (leg[field] === null)
                error(`legs.${index}.${field}`, 'Required original leg information is unknown.');
    if (s.probability !== null)
        for (const field of ['predictionAt', 'probabilitySource', 'probabilityMethod', 'modelVersion'] as const)
            if (s[field] === null)
                error(field, 'A supplied probability requires its original documented source/method/version/timestamp before ledger registration.');
    let expectedPayoutCents: number | null = null;
    if (!partialVoid && s.stakeCents !== null && s.odds !== null && s.stakeType && s.outcome && s.outcome !== 'pending')
        expectedPayoutCents = resultAmounts(s.stakeCents, s.odds, s.stakeType, s.outcome).returnCents;
    if (s.payoutCents !== null && ((expectedPayoutCents !== null && expectedPayoutCents !== s.payoutCents) || (s.outcome === 'pending' && s.payoutCents !== 0)))
        error('payoutCents', 'Reported payout disagrees with deterministic settlement. No adjustment or funding transaction is inferred.');
    if (issues.length)
        return { bet: null, issues, expectedPayoutCents };
    const notes = `Historical record ${record.id}. Source: ${s.sourceReference}. Full original data and notes remain in the immutable archive.`;
    const bet: Bet = { id: record.id, placedAt: s.placedAt!, ...(s.settledAt ? { settledAt: s.settledAt } : {}), bookmaker: s.bookmaker!, stakeCents: s.stakeCents!, stakeType: s.stakeType!, odds: s.odds!, outcome: s.outcome!, strategy: s.strategy!, legs: s.legs.map(leg => ({ id: leg.id, sport: leg.sport!, event: leg.event!, participant: leg.participant!, market: leg.market!, selection: leg.selection!, line: leg.line!, odds: leg.odds!, outcome: leg.outcome!, ...(leg.statistic !== null ? { statistic: leg.statistic } : {}) } satisfies BetLeg)), notes, confirmedAt: record.importedAt,
        ...(s.probability === null ? {} : { probability: s.probability, probabilityProvenance: { source: s.probabilitySource!, timestamp: s.predictionAt!, method: s.probabilityMethod!, modelVersion: s.modelVersion!, simulated: s.verification === 'synthetic' } }) };
    const parsed = betSchema.safeParse(bet);
    if (!parsed.success)
        for (const problem of parsed.error.issues)
            error(problem.path.join('.'), problem.message);
    return { bet: parsed.success ? parsed.data : null, issues, expectedPayoutCents };
}
export function computeHypothetical(record: HistoricalRecord, result?: HistoricalPaperResult): HypotheticalResult {
    const s = record.snapshot;
    const outcome = result?.outcome ?? s.outcome;
    const settledAt = result ? result.settledAt : s.settledAt;
    const base: HypotheticalResult = { stakeCents: s.stakeCents, returnCents: null, profitCents: null, brierScore: null, probability: s.probability, eligible: false, reason: null, hit: null, accuracyEligible: false };
    if (s.kind === 'actual' || (s.kind === null && !result))
        return { ...base, reason: 'Only explicitly paper-tracked records have hypothetical returns.' };
    if (outcome === 'won' && (result?.legs ?? s.legs).some(leg => leg.outcome === 'void'))
        return { ...base, reason: 'Won parlays with void legs need source-supported adjusted settlement pricing; the original price cannot determine hypothetical returns or forecast accuracy.' };
    const decisive = outcome === 'won' || outcome === 'lost';
    const chronological = Boolean(s.predictionAt && settledAt && Date.parse(s.predictionAt) < Date.parse(settledAt));
    base.accuracyEligible = decisive && chronological && !isHistoricalReviewRecord(record);
    base.hit = base.accuracyEligible ? Number(outcome === 'won') : null;
    if (base.accuracyEligible && s.probability !== null && s.probabilitySource && s.probabilityMethod && s.modelVersion)
        base.brierScore = (s.probability - Number(outcome === 'won')) ** 2;
    if (s.stakeCents === null || s.odds === null || s.stakeType === null)
        return { ...base, reason: 'Original hypothetical stake, stake type or odds is unknown. No default is substituted.' };
    if (outcome === null || outcome === 'pending')
        return { ...base, reason: 'Prediction has no decisive settlement yet.' };
    return { ...base, ...resultAmounts(s.stakeCents, s.odds, s.stakeType, outcome), eligible: true };
}


export function previewFinancialReview(row:ImportPreviewRow){
 if(row.snapshot.kind!=='actual')return null;
 return financialReview({id:'00000000-0000-4000-8000-000000000001',batchId:'00000000-0000-4000-8000-000000000002',rowNumber:row.rowNumber,importedAt:new Date().toISOString(),raw:row.raw,fingerprint:row.fingerprint,snapshot:row.snapshot,issues:row.issues,transformations:row.transformations,probableDuplicateConfirmed:false,incompleteConfirmed:false});
}
