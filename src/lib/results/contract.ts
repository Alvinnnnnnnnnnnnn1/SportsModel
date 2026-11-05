import { z } from 'zod';
import type { Bet, Outcome, PaperPrediction, Sport } from '@/lib/domain/types';
import type { HistoricalPaperResult } from '@/lib/imports/types';

const nullableText = z.string().trim().min(1).max(2000).nullable();
const timestamp = z.string().datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const parsed = new Date(value+'T00:00:00Z'); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value; }, 'Use an exact calendar date.').nullable();
const sport = z.enum(['NBA','NBL','ATP','WTA']).nullable();
const result = z.enum(['won','lost','void']).nullable();
const url = z.string().max(2000).url().refine(value => { const parsed = new URL(value); return ['http:','https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && ![...parsed.searchParams.keys()].some(key => /^(?:api_?key|password|access_?token|refresh_?token|token|secret|key)$/i.test(key)); }, 'Use a source HTTP(S) URL without credentials.');

export const settlementLegSchema = z.object({
  legId: z.string().uuid(), sport, event: nullableText, participant: nullableText,
  market: nullableText, selection: nullableText, line: z.string().max(100).nullable(),
  outcome: result, statistic: z.string().max(500).nullable(),
  observedValue: z.number().finite().nullable(), clearanceMargin: z.number().finite().nullable(),
}).strict();
export const settlementObservationSchema = z.object({
  kind: z.enum(['actual','paper','historical_paper']), recordId: z.string().uuid(), identityHash: z.string().regex(/^[a-f0-9]{64}$/),
  sport, event: nullableText, eventDate: date, outcome: result, settledAt: timestamp.nullable(),
  eventCompleted: z.boolean(), termsConfirmed: z.boolean(), termsReference: nullableText,
  verification: z.enum(['source_supplied','owner_attested']), ownerAttested: z.boolean(),
  sources: z.array(z.object({url,observedAt:timestamp,note:nullableText}).strict()).max(30),
  notes: nullableText, actualPayoutCents: z.number().int().min(0).max(100000000).nullable(),
  legs: z.array(settlementLegSchema).max(20),
  specialCases: z.array(z.enum(['dnp','postponed','retirement','dead_heat','overtime_ambiguous','void_rule_ambiguous','other'])).max(10),
  specialCaseResolution: nullableText,
}).strict();
export const settlementResponseSchema = z.object({
  format:z.literal('edgelab.settlement-response'),version:z.literal(1),
  id:z.string().trim().min(1).max(200),createdAt:timestamp,
  observations:z.array(settlementObservationSchema).min(1).max(200),
}).strict().superRefine((value,ctx)=>{
  const keys=value.observations.map(row=>settlementTargetKey(row.kind,row.recordId));
  if(new Set(keys).size!==keys.length)ctx.addIssue({code:'custom',path:['observations'],message:'A settlement response can contain a position only once.'});
});
export type SettlementResponse=z.infer<typeof settlementResponseSchema>;
export type SettlementObservation=z.infer<typeof settlementObservationSchema>;
export type SettlementKind=SettlementObservation['kind'];
export type SettlementLeg=z.infer<typeof settlementLegSchema>;
export const settlementResponseJsonSchema=z.toJSONSchema(settlementResponseSchema,{unrepresentable:'any'});

export interface SettlementTargetLeg {
  legId:string;sport:Sport|null;event:string|null;participant:string|null;market:string|null;selection:string|null;line:string|null;odds:number|null;
}
export interface SettlementTarget {
  key:string;kind:SettlementKind;recordId:string;identityHash:string;eligible:boolean;exclusionReason:string|null;
  settled:boolean;currentOutcome:Outcome;sport:Sport|null;event:string|null;eventDate:string|null;startsAt:string|null;
  participant:string|null;market:string|null;selection:string|null;line:string|null;legs:SettlementTargetLeg[];
  odds:number|null;originalOdds:number|null;acceptedOdds:number|null;stakeCents:number|null;stakeType:'cash'|'bonus'|null;
  probability:number|null;probabilityProvenance:unknown;sourceReference:string|null;researchDay:number|null;sessionId:string|null;registeredAt:string;
  previousEvidence:unknown[];
}
export interface SettlementReviewRow {
  key:string;kind:SettlementKind;recordId:string;target:SettlementTarget|null;observation:SettlementObservation;
  eligible:boolean;alreadyApplied:boolean;issues:string[];warnings:string[];
  actualBet:Bet|null;corePaper:PaperPrediction|null;historicalPaper:HistoricalPaperResult|null;
  expectedPayoutCents:number|null;hypotheticalProfitCents:number|null;
  legClearances:{legId:string;value:number|null;margin:number|null;method:string|null}[];
}
export interface SettlementReview {
  response:SettlementResponse;responseHash:string;rows:SettlementReviewRow[];warnings:string[];
}
export interface SettlementEvidence {
  format:'edgelab.settlement-evidence';version:1;responseId:string;responseHash:string;targetKey:string;observation:SettlementObservation;
}
export const settlementTargetKey=(kind:SettlementKind,recordId:string)=>`${kind}:${recordId}`;
export function makeSettlementEvidence(response:SettlementResponse,responseHash:string,observation:SettlementObservation):SettlementEvidence {
  return {format:'edgelab.settlement-evidence',version:1,responseId:response.id,responseHash,targetKey:settlementTargetKey(observation.kind,observation.recordId),observation:structuredClone(observation)};
}
