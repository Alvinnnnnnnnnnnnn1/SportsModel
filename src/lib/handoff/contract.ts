import { z } from 'zod';
const text = z.string().trim().min(1).max(2000);
const shortText = z.string().trim().min(1).max(500);
const timestamp = z.string().datetime({ offset: true });
const price = z.number().min(1.0001).max(10000).refine(value => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.00001, 'Original decimal odds support at most four places.');
const sourceUrl = z.string().max(2000).url().refine(value => { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && ![...url.searchParams.keys()].some(key => /^(?:api_?key|password|access_?token|refresh_?token|token|secret|key)$/i.test(key)); }, 'Use an HTTP(S) source URL without embedded credentials.');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(value + 'T00:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }, 'Use a valid calendar date.');
const evidence = z.object({ claim: text, sourceUrl: sourceUrl.nullable(), observedAt: timestamp.nullable(), verification: z.enum(['source_linked', 'unverified']) }).strict();
const probability = z.object({ value: z.number().min(0).max(1).nullable(), origin: z.enum(['deterministic_model', 'external_forecast', 'llm', 'unknown']).nullable(), source: shortText.nullable(), method: shortText.nullable(), modelVersion: shortText.nullable(), timestamp: timestamp.nullable() }).strict();
// Optional backward-compatible v1 extension. Unknown individual-leg prices stay
// null; the candidate originalOdds is the quoted ticket price, never a product.
export const researchLegSchema = z.object({
  id: z.string().uuid(), sport: z.enum(['NBA', 'NBL', 'ATP', 'WTA']).nullable(),
  eventId: shortText.nullable(), event: shortText.nullable(), participant: shortText.nullable(),
  marketId: shortText.nullable(), market: shortText.nullable(), selection: shortText.nullable(),
  line: z.string().trim().min(1).max(100).nullable(), odds: price.nullable(),
}).strict();
export const researchCandidateSchema = z.object({
  id: z.string().trim().min(1).max(100), sport: z.enum(['NBA', 'NBL', 'ATP', 'WTA']).nullable(),
  eventId: shortText.nullable(), event: shortText.nullable(), startsAt: timestamp.nullable(),
  participant: shortText.nullable(), marketId: shortText.nullable(), market: shortText.nullable(),
  selection: shortText.nullable(), line: z.string().trim().min(1).max(100).nullable(),
  bookmaker: shortText.nullable(), originalOdds: price.nullable(), oddsTimestamp: timestamp.nullable(),
  oddsSource: shortText.nullable(), oddsSourceUrl: sourceUrl.nullable(), predictionTimestamp: timestamp.nullable(),
  legs: z.array(researchLegSchema).min(1).max(20).optional(),
  probability, strategy: z.enum(['A', 'B', 'C']).nullable(),
  evidence: z.array(evidence).max(30), sourceUrls: z.array(sourceUrl).max(30),
  confidence: z.enum(['low', 'medium', 'high', 'unknown']), uncertainty: text.nullable(),
  decision: z.enum(['paper', 'watch', 'pass']), proposedStatus: z.enum(['paper_only', 'actual_requires_manual_confirmation']),
  rationale: text.nullable(), passReasons: z.array(shortText).max(30),
  hypotheticalStakeCents: z.number().int().min(0).max(100000000).nullable(), hypotheticalStakeType: z.enum(['cash','bonus']).nullable(),
  estimatedEv: z.number().min(-1).max(10000).nullable(),
}).strict();
export const researchPassSchema = z.object({ id: z.string().trim().min(1).max(100), sport: z.enum(['NBA', 'NBL', 'ATP', 'WTA']).nullable(), event: shortText.nullable(), reason: text, sourceUrls: z.array(sourceUrl).max(30) }).strict();
export const researchResponseSchema = z.object({
  format: z.literal('edgelab.research-response'), version: z.literal(1),
  id: z.string().trim().min(1).max(100), createdAt: timestamp.nullable().optional(), researchDate: date, researchDay: z.number().int().min(1).max(1000000),
  dayStatus: z.enum(['draft', 'completed']), source: text.nullable(), researchMethod: text.nullable(),
  sourceUrls: z.array(sourceUrl).max(30), rulesSourceReference: text.nullable(),
  candidates: z.array(researchCandidateSchema).max(100), passes: z.array(researchPassSchema).max(100),
}).strict().superRefine((value, ctx) => {
  if (!value.candidates.length && !value.passes.length) ctx.addIssue({ code: 'custom', message: 'Record at least one proposed candidate or a reason for passing.' });
  const ids = [...value.candidates, ...value.passes].map(row => row.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Response record identifiers must be unique.' });
});
export type ResearchCandidate = z.infer<typeof researchCandidateSchema>;
export type ResearchResponse = z.infer<typeof researchResponseSchema>;
export type ResearchPass = z.infer<typeof researchPassSchema>;
/** Machine-readable JSON Schema; semantic review rules remain separately enforced. */
export const researchResponseJsonSchema = z.toJSONSchema(researchResponseSchema, { unrepresentable: 'any' });
export const RESEARCH_RESPONSE_TEMPLATE: ResearchResponse = {
  format: 'edgelab.research-response', version: 1, id: 'replace-with-unique-response-id', createdAt: null,
  researchDate: '2026-11-04', researchDay: 6, dayStatus: 'draft',
  source: null, researchMethod: null, sourceUrls: [], rulesSourceReference: null,
  candidates: [], passes: [{ id: 'pass-1', sport: null, event: null, reason: 'No source-supported opportunity has been established. Replace this reason only with documented research.', sourceUrls: [] }],
};
