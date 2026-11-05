import type { HistoricalRecord, HistoricalSnapshot, ImportDuplicate, ImportPreviewRow } from './types';
import { wagerClaimSourceReferences } from './wager-claim-provenance';
const normalized = (value: string | null) => value?.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase() ?? null;
export function historicalIdentity(snapshot: HistoricalSnapshot): string {
    return JSON.stringify({ externalId: snapshot.externalId, kind: snapshot.kind, sport: snapshot.sport, eventId: snapshot.eventId, event: normalized(snapshot.event), participant: normalized(snapshot.participant), marketId: snapshot.marketId, market: normalized(snapshot.market), selection: normalized(snapshot.selection), line: normalized(snapshot.line), bookmaker: normalized(snapshot.bookmaker), odds: snapshot.odds, predictionAt: snapshot.predictionAt, placedAt: snapshot.placedAt, legs: snapshot.legs.map(leg => JSON.stringify({ sport: leg.sport, eventId: leg.eventId, event: normalized(leg.event), participant: normalized(leg.participant), marketId: leg.marketId, market: normalized(leg.market), selection: normalized(leg.selection), line: normalized(leg.line), odds: leg.odds })).sort() });
}
export async function sha256(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function compare(a: HistoricalSnapshot, fingerprint: string, b: HistoricalSnapshot, otherHash: string, recordId: string): ImportDuplicate | null {
    if (fingerprint === otherHash)
        return { recordId, level: 'exact', reason: 'Same normalized type, event, market, selection, original price and timestamps.' };
    if (a.externalId && a.sourceReference && a.externalId === b.externalId && a.sourceReference === b.sourceReference)
        return { recordId, level: 'exact', reason: 'Same external reference ID within the same source reference.' };
    if (a.externalId && a.externalId === b.externalId)
        return { recordId, level: 'probable', reason: 'External reference matches, but the source namespace is absent or different.' };
    if (a.kind !== b.kind || a.kind === null || a.sport !== b.sport || a.sport === null)
        return null;
    const sameEvent = a.eventId && b.eventId ? a.eventId === b.eventId : Boolean(a.event && b.event && normalized(a.event) === normalized(b.event));
    const sameMarket = a.marketId && b.marketId ? a.marketId === b.marketId : Boolean(a.market && b.market && normalized(a.market) === normalized(b.market));
    const sameSelection = Boolean(a.selection && b.selection && normalized(a.selection) === normalized(b.selection));
    const compatibleLine = a.line === null || b.line === null || normalized(a.line) === normalized(b.line);
    if (sameEvent && sameMarket && sameSelection && compatibleLine)
        return { recordId, level: 'probable', reason: 'Event, type, market and selection overlap; price, line or timestamp differs or is missing. No automatic merge.' };
    return null;
}
export function detectHistoricalDuplicates(snapshot: HistoricalSnapshot, fingerprint: string, existing: HistoricalRecord[], previous: ImportPreviewRow[] = [], raw?: unknown): ImportDuplicate[] {
    const result: ImportDuplicate[] = [];
    const sourceOverlap = (other: HistoricalSnapshot, otherRaw: unknown, recordId: string): ImportDuplicate | null => {
        if (snapshot.kind !== 'actual' || other.kind !== 'actual') return null;
        const incoming = wagerClaimSourceReferences(raw), retained = wagerClaimSourceReferences(otherRaw);
        if ((other.sourceReference && incoming.includes(other.sourceReference)) || (snapshot.sourceReference && retained.includes(snapshot.sourceReference)))
            return { recordId, level: 'probable', reason: 'The wager claim cites the same original archived record across source namespaces. Review its identity and evidence; no automatic merge or second financial registration.' };
        return null;
    };
    for (const record of existing) {
        const match = compare(snapshot, fingerprint, record.snapshot, record.fingerprint, record.id) ?? sourceOverlap(record.snapshot, record.raw, record.id);
        if (match)
            result.push(match);
    }
    for (const row of previous) {
        const match = compare(snapshot, fingerprint, row.snapshot, row.fingerprint, `row:${row.rowNumber}`) ?? sourceOverlap(row.snapshot, row.raw, `row:${row.rowNumber}`);
        if (match)
            result.push(match);
    }
    return result;
}
