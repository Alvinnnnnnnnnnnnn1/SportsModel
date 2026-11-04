import { sha256 } from '@/lib/imports/duplicates';
import { IMPORT_MAX_BYTES, parseHistoricalSource } from '@/lib/imports/parser';
import type { VerificationStatus } from '@/lib/imports/types';

export const CONVERSATION_EXPORT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_CONVERSATIONS = 5000;
const MAX_NODES = 50_000;
type JsonObject = Record<string, unknown>;

export interface ConversationMessage {
  nodeId: string;
  messageId: string | null;
  role: string;
  createdAt: string | null;
  text: string;
  unsupportedParts: number;
  originalMessage: JsonObject;
  sourceReference: string;
}
export interface ExportConversation {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  nodeCount: number;
  original: JsonObject;
}
export interface ConversationExport {
  sourceName: string;
  sourceHash: string;
  conversations: ExportConversation[];
}
export interface ConversationSelection {
  conversation: ExportConversation;
  branch: 'current' | 'all';
  messages: ConversationMessage[];
  warnings: string[];
}
export interface MessageMapping {
  nodeId: string;
  /** Fields explicitly supplied by the user, not extracted from conversation prose. */
  fields: JsonObject | JsonObject[];
}
export interface MappedConversationSource { text: string; sourceName: string; }

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function sourceId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200)
    throw new Error(`The selected conversation has no supported ${field}. Map this export manually.`);
  return value;
}
function timestamp(value: unknown): string | null {
  // These are source-message metadata only. They never become prediction/placement times.
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const milliseconds = value * 1000;
  if (!Number.isSafeInteger(Math.trunc(milliseconds)) || milliseconds > 8_640_000_000_000_000) return null;
  return new Date(milliseconds).toISOString();
}

/** Local-only parser for user-selected extracted JSON, never an account or history fetch. */
export async function parseConversationExport(input: { text: string; sourceName: string }): Promise<ConversationExport> {
  if (new TextEncoder().encode(input.text).byteLength > CONVERSATION_EXPORT_MAX_BYTES)
    throw new Error('Use an extracted JSON export up to 25 MiB. Select a smaller relevant conversation file for larger exports.');
  if (!input.sourceName.trim() || input.sourceName.length > 255)
    throw new Error('Use a source filename up to 255 characters.');
  let decoded: unknown;
  try { decoded = JSON.parse(input.text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('The conversation export is not valid JSON. Extract the archive locally and select conversations.json; ZIP and HTML are not parsed.'); }
  const values = Array.isArray(decoded) ? decoded : object(decoded) && object(decoded.mapping) ? [decoded] : null;
  if (!values?.length || values.length > MAX_CONVERSATIONS)
    throw new Error('Choose a nonempty conversations.json array or one extracted conversation object (up to 5,000 conversations).');
  const ids = new Set<string>();
  const conversations = values.map((value, index) => {
    if (!object(value) || !object(value.mapping))
      throw new Error(`Conversation ${index + 1} has an unsupported structure. No data was saved; map it to the historical template manually.`);
    const id = sourceId(value.id ?? value.conversation_id, 'conversation ID');
    if (ids.has(id)) throw new Error('The export contains duplicate conversation IDs. Choose an unambiguous extracted conversation.');
    ids.add(id);
    const nodeCount = Object.keys(value.mapping).length;
    if (nodeCount > MAX_NODES) throw new Error('A conversation exceeds 50,000 source nodes. Extract a smaller relevant source manually.');
    return {
      id, title: typeof value.title === 'string' && value.title.trim() ? value.title : '(Untitled source conversation)',
      createdAt: timestamp(value.create_time), updatedAt: timestamp(value.update_time), nodeCount, original: value,
    };
  });
  return { sourceName: input.sourceName, sourceHash: await sha256(input.text), conversations };
}

function messageFromNode(conversation: ExportConversation, nodeId: string, node: unknown): ConversationMessage | null {
  if (!object(node) || !object(node.message)) return null;
  sourceId(nodeId, 'message node ID');
  const message = node.message;
  const messageId = typeof message.id === 'string' ? sourceId(message.id, 'message ID') : null;
  const content = object(message.content) ? message.content : {};
  const parts = Array.isArray(content.parts) ? content.parts : typeof content.text === 'string' ? [content.text] : [];
  const text = parts.filter((part): part is string => typeof part === 'string').join('\n');
  const role = object(message.author) && typeof message.author.role === 'string' ? message.author.role : 'unknown';
  return {
    nodeId, messageId, role, text, createdAt: timestamp(message.create_time),
    unsupportedParts: parts.filter(part => typeof part !== 'string').length,
    originalMessage: message,
    sourceReference: `chatgpt-export:${encodeURIComponent(conversation.id)}/node:${encodeURIComponent(nodeId)}${messageId ? `/message:${encodeURIComponent(messageId)}` : ''}`,
  };
}

export function selectConversation(source: ConversationExport, conversationId: string, branch: 'current' | 'all'): ConversationSelection {
  const conversation = source.conversations.find(item => item.id === conversationId);
  if (!conversation) throw new Error('Choose a conversation from this selected export.');
  const mapping = conversation.original.mapping as JsonObject;
  const warnings = ['All branches of the selected conversation remain in the retained source. Only explicitly mapped messages become proposed records.'];
  let nodeIds: string[];
  if (branch === 'current') {
    const current = conversation.original.current_node;
    if (typeof current !== 'string' || !Object.hasOwn(mapping, current))
      throw new Error('This export has no usable current branch. Choose All branches and review message order manually.');
    nodeIds = [];
    const seen = new Set<string>();
    let cursor: string | null = current;
    while (cursor !== null) {
      if (seen.has(cursor)) throw new Error('The selected message branch contains a cycle. Map this source manually.');
      if (!Object.hasOwn(mapping, cursor) || !object(mapping[cursor]))
        throw new Error('The selected branch references a missing source node. Map this source manually.');
      seen.add(cursor); nodeIds.push(cursor);
      const parent: unknown = (mapping[cursor] as JsonObject).parent;
      if (parent !== null && parent !== undefined && typeof parent !== 'string')
        throw new Error('The selected branch has an unsupported parent reference.');
      cursor = typeof parent === 'string' ? parent : null;
    }
    nodeIds.reverse();
  } else {
    nodeIds = Object.keys(mapping);
    warnings.push('All branches may contain alternative or superseded answers. Node order is preserved from the file; timestamps and branch membership must be reviewed manually.');
  }
  const messages = nodeIds.map(id => messageFromNode(conversation, id, mapping[id])).filter((message): message is ConversationMessage => message !== null);
  if (!messages.length) throw new Error('No supported message objects were found in the selected branch.');
  if (messages.some(message => message.unsupportedParts > 0)) warnings.push('Attachments and non-text parts are not interpreted. Their original metadata is retained; no files or URLs are fetched.');
  if (messages.some(message => message.createdAt === null)) warnings.push('Some source message timestamps are missing or invalid and remain unknown.');
  return { conversation, branch, messages, warnings };
}

/** A nullable draft: source message time is intentionally not a prediction time. */
export function emptyMessageMapping(): JsonObject {
  return { kind: null, sport: null, event: null, participant: null, market: null, selection: null, line: null,
    bookmaker: null, odds: null, predictionAt: null, placedAt: null, settledAt: null, probability: null,
    probabilitySource: null, probabilityMethod: null, modelVersion: null, strategy: null, stakeCents: null,
    stakeType: null, payoutCents: null, outcome: null, notes: null, legs: [] };
}

export async function createMappedConversationSource(input: {
  source: ConversationExport; selection: ConversationSelection; mappings: MessageMapping[];
  verification: VerificationStatus;
}): Promise<MappedConversationSource> {
  const { source, selection, mappings, verification } = input;
  if (!source.conversations.some(conversation => conversation === selection.conversation))
    throw new Error('The selected source changed. Review the conversation again.');
  if (!mappings.length || mappings.length > 500) throw new Error('Explicitly map between 1 and 500 source messages.');
  if (new Set(mappings.map(mapping => mapping.nodeId)).size !== mappings.length)
    throw new Error('Map each source message once; enter an explicit array of record objects for multiple predictions in one message.');
  const records = mappings.flatMap(mapping => {
    const message = selection.messages.find(item => item.nodeId === mapping.nodeId);
    if (!message) throw new Error('A mapped message is not in the selected conversation branch.');
    const rows = Array.isArray(mapping.fields) ? mapping.fields : [mapping.fields];
    if (!rows.length || rows.some(fields => !object(fields))) throw new Error('Each manual mapping must be a JSON object or a nonempty array of record objects.');
    return rows.map((fields, rowIndex) => ({
      ...emptyMessageMapping(), ...fields,
      sourceReference: message.sourceReference, verification,
      sourceExcerpt: {
        conversationId: selection.conversation.id, nodeId: message.nodeId, messageId: message.messageId,
        role: message.role, messageCreatedAt: message.createdAt, text: message.text,
        manuallyMappedRecordIndex: rowIndex + 1, manuallyMappedRecordCount: rows.length,
        originalMessage: message.originalMessage,
      },
    }));
  });
  if (records.length > 500) throw new Error('A prepared import may contain at most 500 explicitly mapped records. Split the source into separately reviewed batches.');
  const text = JSON.stringify({
    formatVersion: 1,
    provenance: {
      format: 'chatgpt_selected_conversation_v1', sourceName: source.sourceName, exportSha256: source.sourceHash,
      selectedConversationId: selection.conversation.id, reviewedBranch: selection.branch,
      selectedNodeIds: mappings.map(mapping => mapping.nodeId),
      originalSelectedConversation: selection.conversation.original,
      transformation: 'User-selected conversation object reserialized from supplied JSON. Betting fields are manual mappings; no prose extraction or timestamp inference.',
    },
    records,
  }, null, 2);
  if (new TextEncoder().encode(text).byteLength > IMPORT_MAX_BYTES)
    throw new Error('The selected conversation and mappings exceed the historical 1 MiB source limit. Supply a smaller explicitly extracted conversation or manually split structured records with source references; nothing was truncated or saved.');
  const sourceName = `conversation-${selection.conversation.id.slice(0, 80)}-mapped.json`;
  // Apply the same credential, Unicode, amount and source checks before handing a draft to the normal review UI.
  await parseHistoricalSource({ text, format: 'json', sourceName, verification });
  return { text, sourceName };
}
