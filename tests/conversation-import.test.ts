import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_EXPORT_MAX_BYTES, createMappedConversationSource, emptyMessageMapping,
  parseConversationExport, selectConversation,
} from '@/lib/conversation-import';
import { parseHistoricalSource } from '@/lib/imports/parser';

function fixture(id = 'synthetic-experiment', title = 'SYNTHETIC experiment conversation') {
  return {
    id, title, create_time: 1704067200, update_time: 1704074400, current_node: 'answer',
    mapping: {
      root: { id: 'root', parent: null, children: ['question'], message: null },
      question: { id: 'question', parent: 'root', children: ['answer', 'alternative'], message: { id: 'message-question', author: { role: 'user' }, create_time: 1704067200, content: { content_type: 'text', parts: ['SYNTHETIC user-supplied experiment question'] } } },
      answer: { id: 'answer', parent: 'question', children: [], message: { id: 'message-answer', author: { role: 'assistant' }, create_time: 1704070800, content: { content_type: 'text', parts: ['SYNTHETIC answer. No odds or stakes are stated.'] } } },
      alternative: { id: 'alternative', parent: 'question', children: [], message: { id: 'message-alternative', author: { role: 'assistant' }, create_time: 1704074400, content: { content_type: 'text', parts: ['SYNTHETIC superseded answer'] } } },
    },
  };
}
async function parsed(conversations: unknown = [fixture()]) {
  return parseConversationExport({ text: JSON.stringify(conversations), sourceName: 'synthetic-conversations.json' });
}

describe('explicit local conversation export parsing', () => {
  it('accepts an array or a single extracted conversation, with source hashes', async () => {
    const array = await parsed(); const single = await parsed(fixture());
    expect(array.conversations).toHaveLength(1); expect(single.conversations).toHaveLength(1);
    expect(array.sourceHash).toMatch(/^[a-f0-9]{64}$/); expect(single.sourceHash).not.toBe(array.sourceHash);
    expect(array.conversations[0].original).toEqual(fixture());
  });
  it('accepts a UTF-8 BOM without silently changing the source hash', async () => {
    const text = JSON.stringify([fixture()]);
    const ordinary = await parseConversationExport({ text, sourceName: 'ordinary.json' });
    const bom = await parseConversationExport({ text: '\uFEFF' + text, sourceName: 'bom.json' });
    expect(bom.conversations).toEqual(ordinary.conversations); expect(bom.sourceHash).not.toBe(ordinary.sourceHash);
  });
  it.each(['[broken', '{}', '[]', '[{"id":"no-map"}]', '{"records":[]}'])('rejects malformed or unsupported input %s', async text => {
    await expect(parseConversationExport({ text, sourceName: 'input.json' })).rejects.toThrow();
  });
  it('rejects ambiguous duplicate conversation IDs and missing IDs', async () => {
    await expect(parsed([fixture(), fixture()])).rejects.toThrow('duplicate conversation IDs');
    await expect(parsed([{ ...fixture(), id: null }])).rejects.toThrow('conversation ID');
  });
  it('bounds the whole source and filename without attempting a network request', async () => {
    await expect(parseConversationExport({ text: ' '.repeat(CONVERSATION_EXPORT_MAX_BYTES + 1), sourceName: 'oversize.json' })).rejects.toThrow('25 MiB');
    await expect(parseConversationExport({ text: '[]', sourceName: '' })).rejects.toThrow('filename');
  });
  it('follows the explicitly selected current branch and keeps source branch alternatives', async () => {
    const source = await parsed(); const selected = selectConversation(source, source.conversations[0].id, 'current');
    expect(selected.messages.map(message => message.nodeId)).toEqual(['question', 'answer']);
    expect(selected.conversation.original).toEqual(fixture());
    expect(selected.warnings.join(' ')).toContain('All branches');
    expect(selected.messages[1].createdAt).toBe('2024-01-01T01:00:00.000Z');
    expect(selected.messages[1].sourceReference).toContain('/node:answer/message:message-answer');
  });
  it('offers explicit all-branch review instead of inventing a current branch', async () => {
    const source = await parsed([{ ...fixture(), current_node: null }]);
    expect(() => selectConversation(source, 'synthetic-experiment', 'current')).toThrow('no usable current branch');
    expect(selectConversation(source, 'synthetic-experiment', 'all').messages).toHaveLength(3);
  });
  it('rejects branch cycles and missing ancestors', async () => {
    const cyclic = fixture(); cyclic.mapping.question.parent = 'answer';
    const source = await parsed([cyclic]); expect(() => selectConversation(source, 'synthetic-experiment', 'current')).toThrow('cycle');
    const missing = fixture(); missing.mapping.answer.parent = 'missing';
    expect(() => selectConversation({ ...source, conversations: [{ ...source.conversations[0], original: missing }] }, 'synthetic-experiment', 'current')).toThrow('missing source node');
  });
  it('retains attachments as source metadata without interpreting or fetching them', async () => {
    const conversation = fixture();
    const value = conversation as unknown as Record<string, unknown>;
    const mapping = value.mapping as Record<string, Record<string, unknown>>;
    mapping.answer.message = { author: {}, create_time: 'unknown', content: { parts: ['SYNTHETIC text', { image_asset_pointer: 'synthetic:not-a-network-address' }] } };
    const source = await parsed([conversation]); const selected = selectConversation(source, 'synthetic-experiment', 'current');
    const message = selected.messages[1];
    expect(message.messageId).toBeNull(); expect(message.createdAt).toBeNull(); expect(message.role).toBe('unknown');
    expect(message.text).toBe('SYNTHETIC text'); expect(message.unsupportedParts).toBe(1);
    expect(message.sourceReference).toBe('chatgpt-export:synthetic-experiment/node:answer');
    expect(selected.warnings.join(' ')).toContain('Attachments');
  });
});

describe('manual conversation mapping without financial inference', () => {
  it('starts unknown facts as null without copying the source message time', () => {
    const fields = emptyMessageMapping();
    for (const key of ['odds', 'stakeCents', 'payoutCents', 'probability', 'predictionAt', 'placedAt', 'settledAt', 'kind', 'sport']) expect(fields[key]).toBeNull();
    expect(fields.legs).toEqual([]);
  });
  it('retains only the selected conversation and original message references in a normal preview', async () => {
    const source = await parsed([fixture(), fixture('unrelated-private-source', 'OTHER CONVERSATION DO NOT RETAIN')]);
    const selection = selectConversation(source, 'synthetic-experiment', 'current');
    const mapped = await createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: {} }], verification: 'synthetic' });
    const envelope = JSON.parse(mapped.text);
    expect(mapped.text).not.toContain('OTHER CONVERSATION DO NOT RETAIN');
    expect(mapped.text).not.toContain('unrelated-private-source');
    expect(envelope.provenance.originalSelectedConversation).toEqual(fixture());
    expect(envelope.provenance.exportSha256).toBe(source.sourceHash);
    expect(envelope.records[0].sourceExcerpt.originalMessage).toEqual(fixture().mapping.answer.message);
    const preview = await parseHistoricalSource({ text: mapped.text, format: 'json', sourceName: mapped.sourceName, verification: 'synthetic' });
    const snapshot = preview.rows[0].snapshot;
    expect(snapshot.sourceReference).toBe(selection.messages[1].sourceReference);
    expect(snapshot.predictionAt).toBeNull(); expect(snapshot.odds).toBeNull(); expect(snapshot.stakeCents).toBeNull(); expect(snapshot.kind).toBeNull();
    expect(preview.rows[0].issues.some(issue => issue.field === 'sourceExcerpt' && issue.severity === 'warning')).toBe(true);
    expect(preview.rawSource).toBe(mapped.text);
  });
  it('uses only explicitly supplied betting fields and fixes the actual source reference', async () => {
    const source = await parsed(); const selection = selectConversation(source, 'synthetic-experiment', 'current');
    const mapped = await createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: { kind: 'paper', sport: 'NBA', event: 'SYNTHETIC manually mapped event', odds: 1.9, stakeCents: 500, sourceReference: 'replace-source-attempt', verification: 'user_confirmed' } }], verification: 'synthetic' });
    const envelope = JSON.parse(mapped.text); const row = envelope.records[0];
    expect(row.kind).toBe('paper'); expect(row.odds).toBe(1.9); expect(row.stakeCents).toBe(500); expect(row.predictionAt).toBeNull();
    expect(row.verification).toBe('synthetic'); expect(row.sourceReference).toBe(selection.messages[1].sourceReference);
    expect(envelope.transactions).toBeUndefined(); expect(envelope.bets).toBeUndefined();
  });
  it('preserves inconsistent numeric values for ordinary validator review rather than inventing replacements', async () => {
    const source = await parsed(); const selection = selectConversation(source, 'synthetic-experiment', 'current');
    const mapped = await createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: { odds: -1, stakeCents: 100.5 } }], verification: 'synthetic' });
    const preview = await parseHistoricalSource({ text: mapped.text, format: 'json', sourceName: mapped.sourceName, verification: 'synthetic' });
    expect(preview.rows[0].issues.some(issue => issue.severity === 'error' && issue.field === 'odds')).toBe(true);
    expect(preview.rows[0].issues.some(issue => issue.severity === 'error' && issue.field === 'stakeCents')).toBe(true);
  });
  it('supports explicitly mapped multiple predictions in one message without interpreting prose', async () => {
    const source = await parsed(); const selection = selectConversation(source, 'synthetic-experiment', 'current');
    const mapped = await createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: [
      { kind: 'paper', sport: 'NBA', event: 'SYNTHETIC event', selection: 'SYNTHETIC selection one', line: '18.5' },
      { kind: 'actual', sport: 'NBL', event: 'SYNTHETIC other event', selection: 'SYNTHETIC selection two', line: null },
    ] }], verification: 'synthetic' });
    const rows = JSON.parse(mapped.text).records;
    expect(rows).toHaveLength(2); expect(rows[0].sourceReference).toBe(rows[1].sourceReference);
    expect(rows.map((row: { sourceExcerpt: { manuallyMappedRecordIndex: number } }) => row.sourceExcerpt.manuallyMappedRecordIndex)).toEqual([1, 2]);
    expect(rows[0].kind).toBe('paper'); expect(rows[1].kind).toBe('actual');
    expect(rows[0].odds).toBeNull(); expect(rows[1].stakeCents).toBeNull();
    const preview = await parseHistoricalSource({ text: mapped.text, format: 'json', sourceName: mapped.sourceName, verification: 'synthetic' });
    expect(preview.rows).toHaveLength(2); expect(preview.rows[1].duplicates).toEqual([]);
  });
  it('rejects empty/malformed row arrays and more than 500 manually mapped records', async () => {
    const source = await parsed(); const selection = selectConversation(source, 'synthetic-experiment', 'current');
    await expect(createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: [] }], verification: 'synthetic' })).rejects.toThrow('nonempty array');
    await expect(createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: [null] as unknown as Record<string, unknown>[] }], verification: 'synthetic' })).rejects.toThrow('nonempty array');
    await expect(createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: Array.from({ length: 501 }, () => ({})) }], verification: 'synthetic' })).rejects.toThrow('500 explicitly mapped records');
  });
  it('rejects stale/mismatched selection, duplicate mappings and out-of-branch message references', async () => {
    const source = await parsed(); const selection = selectConversation(source, 'synthetic-experiment', 'current');
    await expect(createMappedConversationSource({ source, selection, mappings: [], verification: 'synthetic' })).rejects.toThrow('Explicitly map');
    await expect(createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: {} }, { nodeId: 'answer', fields: {} }], verification: 'synthetic' })).rejects.toThrow('once');
    await expect(createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'alternative', fields: {} }], verification: 'synthetic' })).rejects.toThrow('not in the selected');
    await expect(createMappedConversationSource({ source: await parsed(), selection, mappings: [{ nodeId: 'answer', fields: {} }], verification: 'synthetic' })).rejects.toThrow('source changed');
  });
  it('does not bypass normal credential/decoded-Unicode source restrictions', async () => {
    const source = await parsed(); const selection = selectConversation(source, 'synthetic-experiment', 'current');
    await expect(createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: { password: 'SYNTHETIC PROHIBITED FIELD' } }], verification: 'synthetic' })).rejects.toThrow('credentials');
    await expect(createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: { notes: '\u0000' } }], verification: 'synthetic' })).rejects.toThrow('control');
  });
  it('refuses an oversized selected source without truncation', async () => {
    const conversation = fixture(); conversation.mapping.answer.message.content.parts = ['SYNTHETIC ' + 'x'.repeat(600_000)];
    const source = await parsed([conversation]); const selection = selectConversation(source, 'synthetic-experiment', 'current');
    await expect(createMappedConversationSource({ source, selection, mappings: [{ nodeId: 'answer', fields: {} }], verification: 'synthetic' })).rejects.toThrow('1 MiB');
  });
});
