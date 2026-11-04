import { z } from 'zod';
import { historicalIdentity, sha256, detectHistoricalDuplicates } from './duplicates';
import type { HistoricalLeg, HistoricalRecord, HistoricalSnapshot, ImportIssue, ImportPreview, ImportPreviewRow, ImportTransformation, VerificationStatus } from './types';
import { historicalSnapshotSchema } from './validation';
import { multiplyMoney } from '@/lib/domain/calculations';
export const IMPORT_MAX_BYTES = 1048576;
export const IMPORT_MAX_ROWS = 500;
export const HISTORICAL_FIELDS = ['externalId', 'eventId', 'marketId', 'kind', 'sport', 'event', 'participant', 'market', 'selection', 'line', 'bookmaker', 'odds', 'predictionAt', 'placedAt', 'settledAt', 'probability', 'probabilitySource', 'probabilityMethod', 'modelVersion', 'strategy', 'sourceReference', 'stakeCents', 'stake', 'stakeType', 'payoutCents', 'payout', 'outcome', 'verification', 'notes', 'legs'] as const;
const fields = new Set<string>(HISTORICAL_FIELDS);
const aliases: Record<string, string> = { betType: 'kind', type: 'kind', player: 'participant', team: 'participant', 'player/team': 'participant', marketType: 'market', threshold: 'line', decimalOdds: 'odds', predictedAt: 'predictionAt', source: 'sourceReference' };
for (const field of HISTORICAL_FIELDS)
    aliases[field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)] = field;
const stamp = z.string().datetime({ offset: true });
const forbiddenKey = /^(?:password|passwd|access_token|refresh_token|service_role_key|service_role|private_key|client_secret|accesstoken|refreshtoken|servicerolekey|servicerole|privatekey|clientsecret)$/i;
function sourceSafety(text: string): void {
    if (new TextEncoder().encode(text).byteLength > IMPORT_MAX_BYTES)
        throw new Error('Import is limited to 1 MiB. Split the source into smaller reviewed batches.');
    if (/\u0000|[\u0001-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
        throw new Error('Binary or unsupported control characters are not accepted. Use UTF-8 text CSV or JSON.');
    const credentialText = text.replace(/[\\"']/g, '');
    if (/sb_secret_|-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/i.test(text) || /(?:password|passwd|access_token|refresh_token|service_role_key|private_key|client_secret)\s*[:=]/i.test(credentialText))
        throw new Error('The source appears to contain credentials. Remove credential fields before importing; no source was retained.');
}
function scanDecodedSource(value: unknown, depth = 0): void {
    if (depth > 12)
        throw new Error('Deeply nested sources require manual mapping before import.');
    // JSON escapes are decoded before this check. PostgreSQL JSONB cannot store
    // U+0000, and other binary C0 characters are not supported research facts.
    // Horizontal tabs, newlines and carriage returns remain valid text.
    const invalidControl = /\u0000|[\u0001-\u0008\u000b\u000c\u000e-\u001f]/;
    const invalidUnicode = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    if (typeof value === 'string' && invalidControl.test(value))
        throw new Error('Decoded source text contains binary or unsupported control characters. No source was retained.');
    if (typeof value === 'string' && invalidUnicode.test(value))
        throw new Error('Decoded source text contains malformed Unicode. Use valid UTF-8 text; no source was retained.');
    if (Array.isArray(value)) {
        for (const item of value)
            scanDecodedSource(item, depth + 1);
        return;
    }
    if (value && typeof value === 'object')
        for (const [key, entry] of Object.entries(value)) {
            if (invalidControl.test(key))
                throw new Error('Decoded source field names contain binary or unsupported control characters. No source was retained.');
            if (invalidUnicode.test(key))
                throw new Error('Decoded source field names contain malformed Unicode. No source was retained.');
            if (key.length > 500)
                throw new Error('Source field names exceed 500 characters. Map the source to the supported template.');
            if (forbiddenKey.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))
                throw new Error('Credential-bearing or unsafe fields are prohibited. No source was retained.');
            scanDecodedSource(entry, depth + 1);
        }
}
export function parseCsv(text: string): Record<string, string>[] {
    const rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false, closed = false;
    const input = text.replace(/^\uFEFF/, '');
    const finishCell = () => { row.push(cell); cell = ''; closed = false; };
    const finishRow = () => { finishCell(); if (row.some(value => value.trim() !== ''))
        rows.push(row); row = []; if (rows.length > IMPORT_MAX_ROWS + 1)
        throw new Error('Import is limited to 500 records.'); };
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (quoted) {
            if (char === '"') {
                if (input[i + 1] === '"') {
                    cell += '"';
                    i++;
                }
                else {
                    quoted = false;
                    closed = true;
                }
            }
            else
                cell += char;
            continue;
        }
        if (closed && char !== ',' && char !== '\r' && char !== '\n')
            throw new Error('Malformed CSV: unexpected characters after a closing quote.');
        if (char === '"') {
            if (cell.length)
                throw new Error('Malformed CSV: quotes must enclose the entire field.');
            quoted = true;
        }
        else if (char === ',')
            finishCell();
        else if (char === '\n' || char === '\r') {
            if (char === '\r' && input[i + 1] === '\n')
                i++;
            finishRow();
        }
        else
            cell += char;
    }
    if (quoted)
        throw new Error('Malformed CSV: an enclosed field was not closed.');
    if (cell.length || row.length || closed)
        finishRow();
    if (rows.length < 2)
        throw new Error('CSV needs a header and at least one research record.');
    const headers = rows.shift()!.map(header => header.trim());
    if (headers.length > 100)
        throw new Error('At most 100 source fields per record are supported. Map the source to the research template.');
    if (headers.some(header => !header) || new Set(headers).size !== headers.length)
        throw new Error('CSV headers must be non-empty and unique.');
    if (headers.some(header => forbiddenKey.test(header) || ['__proto__', 'constructor', 'prototype'].includes(header)))
        throw new Error('Unsafe or credential-bearing CSV headers are not accepted.');
    return rows.map((values, index) => { if (values.length !== headers.length)
        throw new Error(`CSV record ${index + 1} has a different number of fields than the header.`); return Object.fromEntries(headers.map((header, i) => [header, values[i]])); });
}
const nullish = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && (!value.trim() || value.trim().toLowerCase() === 'null'));
export function normalizeHistoricalRow(raw: Record<string, unknown>, verification: VerificationStatus): {
    snapshot: HistoricalSnapshot;
    issues: ImportIssue[];
    transformations: ImportTransformation[];
} {
    scanDecodedSource(raw);
    const issues: ImportIssue[] = [], transformations: ImportTransformation[] = [];
    const issue = (field: string, severity: 'error' | 'warning', code: string, message: string) => issues.push({ field: field.slice(0,500), severity, code, message });
    const transformed = (field: string, original: unknown, normalized: unknown, rule: string) => { if (JSON.stringify(original ?? null) !== JSON.stringify(normalized))
        transformations.push({ field, original: original ?? null, normalized, rule }); };
    const value: Record<string, unknown> = Object.create(null);
    for (const [sourceField, entry] of Object.entries(raw)) {
        const field = fields.has(sourceField) ? sourceField : Object.prototype.hasOwnProperty.call(aliases, sourceField) ? aliases[sourceField] : undefined;
        if (!field) {
            issue(sourceField, 'warning', 'unmapped_field', 'Unmapped source field retained in the original row; manual mapping may be needed.');
            continue;
        }
        if (Object.prototype.hasOwnProperty.call(value, field) && !nullish(entry) && JSON.stringify(value[field]) !== JSON.stringify(entry))
            issue(field, 'error', 'conflicting_mapping', 'Two source fields map to this field with different values.');
        else
            value[field] = entry;
        if (field !== sourceField)
            transformed(field, { field: sourceField, value: entry }, entry, 'explicit_header_alias');
    }
    const text = (field: string, limit = 500): string | null => {
        const input = value[field];
        if (nullish(input)) {
            transformed(field, input, null, 'missing_to_null');
            return null;
        }
        if (typeof input !== 'string' && typeof input !== 'number') {
            issue(field, 'error', 'invalid_text', 'Expected a text field.');
            return null;
        }
        const result = String(input).trim();
        if (result.length > limit) {
            issue(field, 'error', 'text_too_long', `Text exceeds ${limit} characters.`);
            return null;
        }
        transformed(field, input, result, 'trim_text');
        return result;
    };
    const enumeration = <T extends string>(field: string, accepted: readonly T[], upper = false): T | null => {
        const input = text(field);
        if (input === null)
            return null;
        const result = upper ? input.toUpperCase() : input.toLowerCase();
        if (!accepted.includes(result as T)) {
            issue(field, 'error', 'unsupported_value', `Expected one of: ${accepted.join(', ')}.`);
            return null;
        }
        transformed(field, input, result, 'normalize_enum_case');
        return result as T;
    };
    const number = (field: string, minimum: number, maximum: number, decimals?: number): number | null => {
        const input = value[field];
        if (nullish(input)) {
            transformed(field, input, null, 'missing_to_null');
            return null;
        }
        if ((typeof input !== 'number' && typeof input !== 'string') || (typeof input === 'string' && !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(input.trim()))) {
            issue(field, 'error', 'invalid_number', 'Use a plain non-negative decimal number; no currency signs, percentages or exponents.');
            return null;
        }
        const result = Number(input);
        if (!Number.isFinite(result) || result < minimum || result > maximum || (decimals !== undefined && Math.abs(result * 10 ** decimals - Math.round(result * 10 ** decimals)) > 0.00001)) {
            issue(field, 'error', 'number_out_of_range', `Number must be between ${minimum} and ${maximum}${decimals === undefined ? '' : ` with at most ${decimals} decimal places`}.`);
            return null;
        }
        transformed(field, input, result, 'parse_decimal');
        return result;
    };
    const date = (field: string): string | null => {
        const input = text(field);
        if (input === null)
            return null;
        if (!stamp.safeParse(input).success || !Number.isFinite(Date.parse(input))) {
            issue(field, 'error', 'ambiguous_timestamp', 'Use an exact ISO timestamp including Z or an explicit UTC offset; dates without a timezone are not inferred.');
            return null;
        }
        const result = new Date(input).toISOString();
        transformed(field, input, result, 'normalize_exact_instant_to_utc');
        return result;
    };
    const cents = (amount: string, integer: string): number | null => {
        const explicit = number(integer, 0, 100000000, 0);
        let converted: number | null = null;
        if (!nullish(value[amount])) {
            const rawAmount = String(value[amount]).trim();
            if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(rawAmount))
                issue(amount, 'error', 'invalid_financial_amount', 'Use a non-negative AUD amount with at most two decimal places; no symbols or rounding.');
            else {
                const [whole, fraction = ''] = rawAmount.split('.');
                const exact = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
                if (exact > 100000000n)
                    issue(amount, 'error', 'financial_amount_too_large', 'Amount exceeds supported precision.');
                else {
                    converted = Number(exact);
                    transformed(integer, value[amount], converted, 'exact_aud_to_integer_cents');
                }
            }
        }
        if (explicit !== null && converted !== null && explicit !== converted)
            issue(integer, 'error', 'contradictory_amount', 'AUD and cents fields disagree; resolve explicitly before importing.');
        return explicit ?? converted;
    };
    const snapshot: HistoricalSnapshot = {
        externalId: text('externalId'), eventId: text('eventId'), marketId: text('marketId'), kind: enumeration('kind', ['actual', 'paper']), sport: enumeration('sport', ['NBA', 'NBL', 'ATP', 'WTA'], true),
        event: text('event'), participant: text('participant'), market: text('market'), selection: text('selection'), line: text('line', 100), bookmaker: text('bookmaker'), odds: number('odds', 1.0001, 10000, 4),
        predictionAt: date('predictionAt'), placedAt: date('placedAt'), settledAt: date('settledAt'), probability: number('probability', 0, 1), probabilitySource: text('probabilitySource'), probabilityMethod: text('probabilityMethod'), modelVersion: text('modelVersion'), strategy: enumeration('strategy', ['A', 'B', 'C'], true), sourceReference: text('sourceReference', 2000), stakeCents: cents('stake', 'stakeCents'), stakeType: enumeration('stakeType', ['cash', 'bonus']), payoutCents: cents('payout', 'payoutCents'), outcome: enumeration('outcome', ['pending', 'won', 'lost', 'void']), verification, notes: text('notes', 5000), legs: [],
    };
    const originalVerification = enumeration('verification', ['unverified', 'user_confirmed', 'synthetic']);
    if (originalVerification === 'synthetic' && verification !== 'synthetic') {
        snapshot.verification = 'synthetic';
        issue('verification', 'error', 'synthetic_relabel_prohibited', 'Synthetic source provenance cannot be relabelled as real historical data. Use a synthetic/demo batch.');
    }
    if (originalVerification !== verification)
        transformed('verification', originalVerification, snapshot.verification, 'explicit_batch_verification_classification');
    let rawLegs = value.legs;
    if (typeof rawLegs === 'string' && rawLegs.trim()) {
        try {
            rawLegs = JSON.parse(rawLegs);
            transformed('legs', value.legs, rawLegs, 'parse_legs_json');
        }
        catch {
            issue('legs', 'error', 'malformed_legs', 'Parlay legs must be a JSON array.');
            rawLegs = [];
        }
    }
    scanDecodedSource(rawLegs);
    if (!nullish(rawLegs) && !Array.isArray(rawLegs)) {
        issue('legs', 'error', 'invalid_legs', 'Parlay legs must be an array.');
        rawLegs = [];
    }
    if (Array.isArray(rawLegs) && rawLegs.length > 20)
        issue('legs', 'error', 'too_many_legs', 'At most 20 legs are accepted per record.');
    if (Array.isArray(rawLegs))
        snapshot.legs = rawLegs.slice(0, 20).map((rawLeg, index) => {
            if (!rawLeg || typeof rawLeg !== 'object' || Array.isArray(rawLeg)) {
                issue(`legs.${index}`, 'error', 'invalid_leg', 'Each leg must be a JSON object.');
                rawLeg = {};
            }
        const sourceEntry = rawLeg as Record<string, unknown>;
        const tooManyFields = Object.keys(sourceEntry).length > 20;
        const entry = tooManyFields ? {} : sourceEntry;
        if (tooManyFields)
            issue(`legs.${index}`, 'error', 'too_many_leg_fields', 'At most 20 source fields per leg are supported; map the source explicitly.');
        const supportedLegFields = new Set(['id', 'sport', 'eventId', 'event', 'participant', 'marketId', 'market', 'selection', 'line', 'odds', 'outcome', 'statistic']);
        for (const key of Object.keys(entry))
            if (!supportedLegFields.has(key))
                issue(`legs.${index}.${key}`, 'warning', 'unmapped_leg_field', 'Unmapped leg field is preserved in the original source; manual mapping may be needed.');
            const original: Record<string, unknown> = { ...entry, kind: snapshot.kind, verification, notes: null, legs: [] };
            // Leg fields are parsed independently: missing player/market/line/odds remain null.
            const parsed = normalizeLeg(original, index, issue, transformations);
            return parsed;
        });
    if (!snapshot.legs.length && ['event', 'participant', 'market', 'selection'].some(field => snapshot[field as keyof HistoricalSnapshot] !== null)) {
        snapshot.legs = [{ id: crypto.randomUUID(), sport: snapshot.sport, eventId: snapshot.eventId, event: snapshot.event, participant: snapshot.participant, marketId: snapshot.marketId, market: snapshot.market, selection: snapshot.selection, line: snapshot.line, odds: snapshot.odds, outcome: snapshot.outcome, statistic: null }];
        transformed('legs', null, snapshot.legs, 'single_selection_to_leg_without_inventing_values');
    }
    if (new Set(snapshot.legs.map(l => l.id)).size !== snapshot.legs.length)
        issue('legs', 'error', 'duplicate_leg_id', 'Leg identifiers must be unique within a record.');
    const missing = ['kind', 'sport', 'event', 'participant', 'market', 'selection', 'line', 'bookmaker', 'odds', 'predictionAt', 'strategy', 'sourceReference'] as const;
    for (const field of missing)
        if (snapshot[field] === null)
            issue(field, 'warning', 'missing_information', 'Unknown source information stays null and must be reviewed.');
    if (snapshot.kind === 'actual')
        for (const field of ['placedAt', 'stakeCents', 'stakeType', 'outcome'] as const)
            if (snapshot[field] === null)
                issue(field, 'warning', 'missing_financial_information', 'Actual ledger confirmation is blocked until required financial details are resolved.');
    if (snapshot.probability !== null)
        for (const field of ['probabilitySource', 'probabilityMethod', 'modelVersion', 'predictionAt'] as const)
            if (snapshot[field] === null)
                issue(field, 'warning', 'missing_probability_provenance', 'The supplied estimate is retained unverified; it is excluded from accuracy calculations/ledger promotion until provenance is complete.');
    if (snapshot.outcome === 'pending' && snapshot.settledAt !== null)
        issue('settledAt', 'error', 'contradictory_settlement', 'A pending record cannot have a settlement timestamp.');
    for (const field of ['predictionAt', 'placedAt'] as const)
        if (snapshot.settledAt && snapshot[field] && Date.parse(snapshot.settledAt) < Date.parse(snapshot[field]!))
            issue('settledAt', 'error', 'settlement_before_origin', 'Settlement cannot precede a known original prediction/placement timestamp.');
    if (snapshot.outcome !== null && snapshot.outcome !== 'pending' && snapshot.settledAt === null)
        issue('settledAt', 'warning', 'unknown_settlement_timestamp', 'Settlement time is unknown; it is not replaced with the import time.');
    const outcomes = snapshot.legs.map(l => l.outcome);
    if (snapshot.outcome === 'won' && (outcomes.some(o => o === 'lost' || o === 'pending') || (outcomes.length > 0 && outcomes.every(o => o === 'void'))))
        issue('outcome', 'error', 'contradictory_leg_outcomes', 'A won record cannot contain lost/pending legs or only void legs.');
    if (snapshot.outcome === 'lost' && outcomes.length && outcomes.every(o => o === 'won' || o === 'void'))
        issue('outcome', 'error', 'contradictory_leg_outcomes', 'A lost record cannot contain only won/void legs.');
    if (snapshot.outcome === 'void' && outcomes.some(o => o !== null && o !== 'void'))
        issue('outcome', 'error', 'contradictory_leg_outcomes', 'A void record cannot contain a non-void leg.');
    const partialVoid = snapshot.outcome === 'won' && outcomes.includes('void');
    if (partialVoid)
        issue('legs', 'warning', 'partial_void_requires_reconciliation', 'A won parlay contains void legs. Original odds are preserved; adjusted settlement odds/returns are not inferred. The archive cannot be promoted to the ledger until supported settlement pricing is available.');
    if (snapshot.payoutCents !== null) {
        if (snapshot.outcome === 'pending' && snapshot.payoutCents !== 0)
            issue('payoutCents', 'error', 'payout_for_pending', 'Pending records cannot have a realised payout.');
        if (snapshot.outcome === 'lost' && snapshot.payoutCents !== 0)
            issue('payoutCents', 'error', 'payout_for_loss', 'A lost record has no payout under supported settlement rules.');
        if (!partialVoid && snapshot.stakeCents !== null && snapshot.odds !== null && snapshot.stakeType && snapshot.outcome && snapshot.outcome !== 'pending') {
            const expected = snapshot.outcome === 'lost' ? 0 : snapshot.outcome === 'void' ? snapshot.stakeType === 'cash' ? snapshot.stakeCents : 0 : multiplyMoney(snapshot.stakeCents, snapshot.stakeType === 'cash' ? snapshot.odds : snapshot.odds - 1);
            if (expected !== snapshot.payoutCents)
                issue('payoutCents', 'error', 'payout_mismatch', 'Reported payout contradicts stake, final odds, stake type and outcome. Resolve the source explicitly; no automatic adjustment.');
        }
    }
    if (!['event', 'participant', 'selection', 'sourceReference', 'externalId'].some(field => snapshot[field as keyof HistoricalSnapshot] !== null))
        issue('record', 'error', 'empty_record', 'Record has no identifiable research or source information.');
    const checked = historicalSnapshotSchema.safeParse(snapshot);
    if (!checked.success)
        for (const problem of checked.error.issues)
            issue(problem.path.join('.'), 'error', 'invalid_snapshot', problem.message);
    return { snapshot, issues, transformations };
}
function normalizeLeg(raw: Record<string, unknown>, index: number, issue: (field: string, severity: 'error' | 'warning', code: string, message: string) => void, transforms: ImportTransformation[]): HistoricalLeg {
    const prefix = `legs.${index}`;
    const text = (key: string, max = 500): string | null => { const v = raw[key]; if (nullish(v))
        return null; if (typeof v !== 'string' && typeof v !== 'number') {
        issue(`${prefix}.${key}`, 'error', 'invalid_leg_field', 'Expected text.');
        return null;
    } const result = String(v).trim(); if (result.length > max) {
        issue(`${prefix}.${key}`, 'error', 'leg_text_too_long', 'Leg text exceeds supported length.');
        return null;
    } if (result !== v)
        transforms.push({ field: `${prefix}.${key}`, original: v, normalized: result, rule: 'trim_leg_text' }); return result; };
    const enumeration = <T extends string>(key: string, values: readonly T[], upper = false): T | null => { const v = text(key); if (v === null)
        return null; const result = upper ? v.toUpperCase() : v.toLowerCase(); if (!values.includes(result as T)) {
        issue(`${prefix}.${key}`, 'error', 'unsupported_leg_value', `Expected ${values.join(', ')}.`);
        return null;
    } return result as T; };
    const originalId = text('id');
    const id = originalId && z.string().uuid().safeParse(originalId).success ? originalId : crypto.randomUUID();
    if (originalId && id !== originalId)
        issue(`${prefix}.id`, 'error', 'invalid_leg_id', 'A supplied leg ID must be a UUID.');
    if (!originalId)
        transforms.push({ field: `${prefix}.id`, original: null, normalized: id, rule: 'generated_metadata_uuid_not_source_fact' });
    const originalOdds = raw.odds;
    let odds: number | null = null;
    if (!nullish(originalOdds)) {
        if ((typeof originalOdds === 'number' || typeof originalOdds === 'string') && /^\d+(?:\.\d{1,4})?$/.test(String(originalOdds).trim()) && Number(originalOdds) > 1 && Number(originalOdds) <= 10000)
            odds = Number(originalOdds);
        else
            issue(`${prefix}.odds`, 'error', 'invalid_leg_odds', 'Use decimal odds >1 with at most four places.');
    }
    const leg = { id, sport: enumeration('sport', ['NBA', 'NBL', 'ATP', 'WTA'], true), eventId: text('eventId'), event: text('event'), participant: text('participant'), marketId: text('marketId'), market: text('market'), selection: text('selection'), line: text('line', 100), odds, outcome: enumeration('outcome', ['pending', 'won', 'lost', 'void']), statistic: text('statistic') };
    for (const field of ['sport', 'event', 'participant', 'market', 'selection', 'line', 'odds'] as const)
        if (leg[field] === null)
            issue(`${prefix}.${field}`, 'warning', 'missing_leg_information', 'Unknown leg information remains null.');
    return leg;
}
export async function parseHistoricalSource(input: {
    text: string;
    format: 'csv' | 'json' | 'manual';
    sourceName: string;
    verification: VerificationStatus;
    existingRecords?: HistoricalRecord[];
}): Promise<ImportPreview> {
    sourceSafety(input.text);
    if (!input.sourceName.trim() || input.sourceName.length > 255)
        throw new Error('A source name of at most 255 characters is required.');
    let rawRows: unknown;
    if (input.format === 'csv')
        rawRows = parseCsv(input.text);
    else {
        let decoded: unknown;
        try {
            decoded = JSON.parse(input.text.replace(/^\uFEFF/, ''));
        }
        catch {
            throw new Error('Malformed JSON. Use a record array or a supported {records: [...]} envelope.');
        }
        if (Array.isArray(decoded))
            rawRows = decoded;
        else if (decoded && typeof decoded === 'object' && Array.isArray((decoded as Record<string, unknown>).records))
            rawRows = (decoded as Record<string, unknown>).records;
        else
            throw new Error('Unsupported JSON structure. Raw ChatGPT conversation exports require manual mapping to the historical research template; nothing was imported.');
    }
    if (!Array.isArray(rawRows) || !rawRows.length)
        throw new Error('The source must contain at least one research record.');
    if (rawRows.length > IMPORT_MAX_ROWS)
        throw new Error('Import is limited to 500 records.');
    scanDecodedSource(rawRows);
    const rows: ImportPreviewRow[] = [];
    for (let index = 0; index < rawRows.length; index++) {
        const raw = rawRows[index];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            throw new Error(`Record ${index + 1} must be a JSON object. No records were saved.`);
        if (Object.keys(raw).length > 100)
            throw new Error('At most 100 source fields per record are supported. Map the source to the research template.');
        if ('mapping' in raw || 'messages' in raw || ('role' in raw && 'content' in raw))
            throw new Error('Raw ChatGPT conversation exports require manual mapping to the historical research template; nothing was imported.');
        const normalized = normalizeHistoricalRow(raw as Record<string, unknown>, input.verification);
        const fingerprint = await sha256(historicalIdentity(normalized.snapshot));
        const row: ImportPreviewRow = { rowNumber: index + 1, raw, snapshot: normalized.snapshot, fingerprint, issues: normalized.issues, transformations: normalized.transformations, duplicates: detectHistoricalDuplicates(normalized.snapshot, fingerprint, input.existingRecords ?? [], rows) };
        rows.push(row);
    }
    return { sourceName: input.sourceName.trim(), format: input.format, rawSource: input.text, sourceHash: await sha256(input.text), rows };
}
/** Manual corrections never replace the original uploaded row or source bytes. */
export async function reviseImportRow(preview: ImportPreview, rowNumber: number, correctedRawRecord: Record<string, unknown>, existingRecords: HistoricalRecord[] = []): Promise<ImportPreview> {
    const original = preview.rows.find(row => row.rowNumber === rowNumber);
    if (!original)
        throw new Error('Import row does not exist.');
    const parsed = await parseHistoricalSource({ text: JSON.stringify([correctedRawRecord]), format: 'manual', sourceName: preview.sourceName, verification: original.snapshot.verification, existingRecords: [] });
    const nextRow = parsed.rows[0];
    const before = original.transformations.filter(change => change.rule === 'manual_resolution').at(-1)?.normalized ?? original.raw;
    const correction: ImportTransformation = { field: 'record', original: before, normalized: structuredClone(correctedRawRecord), rule: 'manual_resolution' };
    const rows = preview.rows.map(row => row.rowNumber === rowNumber ? { ...nextRow, rowNumber, raw: original.raw, transformations: [...original.transformations, correction, ...nextRow.transformations] } : { ...row });
    const previous: ImportPreviewRow[] = [];
    for (const row of rows) {
        row.duplicates = detectHistoricalDuplicates(row.snapshot, row.fingerprint, existingRecords, previous);
        previous.push(row);
    }
    return { ...preview, rows };
}
