import { z } from 'zod';
import type { Bet, Provenance, Strategy } from '@/lib/domain/types';
import type { HistoricalLeg } from '@/lib/imports/types';

/** Read-only research prefill. Execution prices/times are deliberately absent. */
export interface ResearchPlacement {
  recordId: string;
  sourceReference: string;
  quoteOdds: number | null;
  quoteTimestamp: string | null;
  bookmaker: string | null;
  strategy: Strategy | null;
  probability?: number;
  probabilityProvenance?: Provenance;
  legs: HistoricalLeg[];
}
const PREFIX = '[EdgeLab research record] ';

export function readResearchRecordLink(notes: string): string | null {
  const values = notes.split('\n').filter(line => line.startsWith(PREFIX)).map(line => line.slice(PREFIX.length));
  return values.length === 1 && z.string().uuid().safeParse(values[0]).success ? values[0] : null;
}

export function withResearchRecordLink(notes: string, recordId: string): string {
  if (!z.string().uuid().safeParse(recordId).success) throw new Error('The originating research record must have its saved EdgeLab identifier.');
  const markerLines = notes.split('\n').filter(line => line.startsWith(PREFIX));
  if (markerLines.some(line => line !== PREFIX + recordId)) throw new Error('This wager already references a different research record. Keep its original source link.');
  return [...notes.split('\n').filter(line => !line.startsWith(PREFIX)), PREFIX + recordId].filter(Boolean).join('\n');
}

export function researchPlacementDuplicate(bets: Bet[], recordId: string, exceptBetId?: string): Bet | undefined {
  return bets.find(bet => bet.id !== exceptBetId && readResearchRecordLink(bet.notes) === recordId);
}
