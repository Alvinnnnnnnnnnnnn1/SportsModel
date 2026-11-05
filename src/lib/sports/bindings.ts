import { z } from 'zod';
import type { HistoricalWorkspace } from '../imports/types';
import { parseHistoricalSource } from '../imports';
import { providerBindingsSchema } from './grading';
import type { SettlementTarget } from '../results';
export const bindingJournalSchema = z.object({
  format: z.literal('edgelab.sports-identity-review'), version: z.literal(1),
  targetKey: z.string().regex(/^(actual|paper|historical_paper):[a-f0-9-]{36}$/), identityHash: z.string().regex(/^[a-f0-9]{64}$/),
  reviewedAt: z.string().datetime({ offset: true }), bindings: providerBindingsSchema,
}).strict();
export function currentSportsBindings(history: HistoricalWorkspace, target: SettlementTarget) {
  for (const record of [...history.records].reverse()) {
    const raw = record.raw as { sourceDocument?: unknown } | null;
    const parsed = bindingJournalSchema.safeParse(raw?.sourceDocument);
    if (parsed.success && parsed.data.targetKey === target.key && parsed.data.identityHash === target.identityHash) return parsed.data;
  }
  return null;
}
export async function prepareSportsBindings(target: SettlementTarget, bindings: z.infer<typeof providerBindingsSchema>, history: HistoricalWorkspace, mode: 'demo' | 'supabase') {
  const source = bindingJournalSchema.parse({ format: 'edgelab.sports-identity-review', version: 1, targetKey: target.key, identityHash: target.identityHash, reviewedAt: new Date().toISOString(), bindings });
  if (bindings.length !== target.legs.length || target.legs.some(leg => !bindings.some(binding => binding.legId === leg.legId))) throw new Error('Every original leg needs exactly one reviewed provider binding.');
  const previous = currentSportsBindings(history, target);
  const canonical = (value: typeof bindings) => JSON.stringify([...value].sort((a, b) => a.legId.localeCompare(b.legId)));
  if (previous && canonical(previous.bindings) === canonical(bindings)) return null;
  const verification = mode === 'demo' ? 'synthetic' as const : 'user_confirmed' as const;
  return parseHistoricalSource({ text: JSON.stringify([{ externalId: `sports-identity:${crypto.randomUUID()}`, kind: null, sourceReference: `edgelab:sports-identity:${target.key}`, event: target.event, notes: 'Owner-reviewed provider identity mapping only. No forecast, wager, result or funding change.', verification, sourceDocument: source }]), sourceName: 'reviewed-provider-identities.json', format: 'manual', verification, existingRecords: history.records });
}
