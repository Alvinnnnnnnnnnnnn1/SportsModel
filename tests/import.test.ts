import { describe, expect, it } from 'vitest';
import {
  HISTORICAL_CSV_TEMPLATE,
  SYNTHETIC_HISTORICAL_JSON,
  SYNTHETIC_HISTORICAL_RECORDS,
  IMPORT_MAX_BYTES,
  commitHistoricalImport,
  emptyHistoricalWorkspace,
  historicalIdentity,
  parseCsv,
  parseHistoricalSource,
  prepareImportCommit,
  reviseImportRow,
  sha256,
  type ImportPreview,
  type VerificationStatus,
} from '../src/lib/imports';

const paper = () => structuredClone(SYNTHETIC_HISTORICAL_RECORDS[0]);
const actual = () => structuredClone(SYNTHETIC_HISTORICAL_RECORDS[1]);
const parse = (records: unknown[], verification: VerificationStatus = 'synthetic') =>
  parseHistoricalSource({ text: JSON.stringify(records), format: 'json', sourceName: 'Synthetic test fixture.json', verification });
const decisions = (preview: ImportPreview) => preview.rows.map(row => ({ rowNumber: row.rowNumber, include: true, allowProbableDuplicate: false, acknowledgeIncomplete: true }));
const register = (preview: ImportPreview) => commitHistoricalImport(emptyHistoricalWorkspace(), prepareImportCommit(preview, decisions(preview), 'synthetic'));

describe('historical upload formats and source preservation', () => {
  it('accepts the documented synthetic CSV and JSON templates without errors', async () => {
    for (const [format, text] of [['csv', HISTORICAL_CSV_TEMPLATE], ['json', SYNTHETIC_HISTORICAL_JSON]] as const) {
      const preview = await parseHistoricalSource({ text, format, sourceName: `Synthetic template.${format}`, verification: 'synthetic' });
      expect(preview.rows.length).toBeGreaterThan(0);
      expect(preview.rows.flatMap(row => row.issues).filter(issue => issue.severity === 'error')).toEqual([]);
      expect(preview.rows.every(row => row.snapshot.verification === 'synthetic')).toBe(true);
      expect(preview.rawSource).toBe(text);
      expect(preview.sourceHash).toBe(await sha256(text));
    }
  });

  it('supports quoted commas, escaped quotes, multiline cells, CRLF and BOM in CSV', () => {
    expect(parseCsv('\uFEFFevent,notes\r\n"SYNTHETIC A, B","A ""quoted"" note\r\nsecond line"\r\n')).toEqual([
      { event: 'SYNTHETIC A, B', notes: 'A "quoted" note\r\nsecond line' },
    ]);
  });

  it.each([
    'event,notes\n"unclosed,note',
    'event,notes\n"event"extra,note',
    'event,notes\neve"nt,note',
    'event,event\na,b',
    'event,\na,b',
    'event,notes\nonly-one-field',
    'event\n',
  ])('rejects malformed CSV atomically', async text => {
    await expect(parseHistoricalSource({ text, format: 'csv', sourceName: 'Synthetic malformed.csv', verification: 'synthetic' })).rejects.toThrow();
  });

  it('uses the same canonical validation for JSON envelopes, arrays and manual entry', async () => {
    const record = paper();
    const array = await parse([record]);
    const envelope = await parseHistoricalSource({ text: JSON.stringify({ records: [record] }), format: 'json', sourceName: 'Synthetic envelope.json', verification: 'synthetic' });
    const manual = await parseHistoricalSource({ text: JSON.stringify([record]), format: 'manual', sourceName: 'Synthetic manual entry', verification: 'synthetic' });
    expect(historicalIdentity(array.rows[0].snapshot)).toBe(historicalIdentity(envelope.rows[0].snapshot));
    expect(historicalIdentity(array.rows[0].snapshot)).toBe(historicalIdentity(manual.rows[0].snapshot));
    expect(array.rows[0].fingerprint).toBe(manual.rows[0].fingerprint);
    expect(array.rows[0].snapshot.legs[0].id).not.toBe(manual.rows[0].snapshot.legs[0].id);
    expect(manual.rows[0].snapshot.placedAt).toBeNull();
  });

  it('retains original row values, mapping transformations and unknown fields', async () => {
    const raw = { event: '  SYNTHETIC fixture  ', sport: 'nba', player: 'SYNTHETIC Player', predictionAt: '2026-10-01T18:00:00+11:00', stake: '0.29', mystery: 'Retain this unmapped original fact' };
    const preview = await parse([raw], 'unverified');
    const row = preview.rows[0];
    expect(row.raw).toEqual(raw);
    expect(row.snapshot).toMatchObject({ event: 'SYNTHETIC fixture', sport: 'NBA', participant: 'SYNTHETIC Player', predictionAt: '2026-10-01T07:00:00.000Z', stakeCents: 29 });
    expect(row.transformations.map(change => change.rule)).toEqual(expect.arrayContaining(['explicit_header_alias', 'trim_text', 'normalize_exact_instant_to_utc', 'exact_aud_to_integer_cents']));
    expect(row.issues).toContainEqual(expect.objectContaining({ field: 'mystery', severity: 'warning', code: 'unmapped_field' }));
  });

  it('keeps unknown original odds, timestamps, probabilities, stakes and classification null', async () => {
    const preview = await parse([{ event: 'SYNTHETIC unknown-history fixture' }], 'unverified');
    expect(preview.rows[0].snapshot).toMatchObject({ kind: null, odds: null, probability: null, predictionAt: null, placedAt: null, settledAt: null, stakeCents: null, payoutCents: null, sourceReference: null, stakeType: null, outcome: null });
    expect(preview.rows[0].snapshot.legs[0]).toMatchObject({ participant: null, market: null, selection: null, line: null, odds: null, outcome: null, statistic: null });
    expect(preview.rows[0].issues.some(issue => issue.code === 'missing_information')).toBe(true);
  });

  it('treats names inherited from Object.prototype as unmapped data rather than header aliases', async () => {
    const preview = await parse([{ event: 'SYNTHETIC prototype-name fixture', toString: 'Retained source text', hasOwnProperty: 'Retained source text' }]);
    expect(preview.rows[0].issues).toContainEqual(expect.objectContaining({ field: 'toString', code: 'unmapped_field' }));
    expect(preview.rows[0].issues).toContainEqual(expect.objectContaining({ field: 'hasOwnProperty', code: 'unmapped_field' }));
    expect(register(preview).records[0].raw).toMatchObject({ toString: 'Retained source text' });
  });

  it.each(['[{', '{}', 'null', '[]', '["not a record"]', '{"mapping":{}}', '[{"role":"user","content":"unmapped conversation"}]'])('rejects malformed or unmapped exports without retaining a batch', async text => {
    await expect(parseHistoricalSource({ text, format: 'json', sourceName: 'Synthetic unsupported.json', verification: 'unverified' })).rejects.toThrow();
  });

  it('bounds UTF-8 bytes and row count and rejects binary input', async () => {
    await expect(parseHistoricalSource({ text: 'a'.repeat(IMPORT_MAX_BYTES + 1), format: 'json', sourceName: 'Synthetic too large.json', verification: 'unverified' })).rejects.toThrow('1 MiB');
    await expect(parse(Array.from({ length: 501 }, (_, i) => ({ event: `SYNTHETIC fixture ${i}` })))).rejects.toThrow('500 records');
    await expect(parseHistoricalSource({ text: '[{"event":"SYNTHETIC\u0000fixture"}]', format: 'json', sourceName: 'Synthetic binary.json', verification: 'unverified' })).rejects.toThrow('Binary');
  });

  it.each(['\u0000', '\u0001', '\u0008', '\u000b', '\u000c', '\u000e', '\u001f'])('rejects JSON-escaped unsupported control characters in source values and keys', async control => {
    await expect(parse([{ event: `SYNTHETIC${control}fixture` }])).rejects.toThrow('unsupported control');
    await expect(parse([{ event: 'SYNTHETIC fixture', [`field${control}`]: 'source text' }])).rejects.toThrow('unsupported control');
  });

  it('rejects JSON-escaped controls inside CSV JSON legs while permitting text tabs and newlines', async () => {
    const legs = JSON.stringify([{ event: 'SYNTHETIC fixture\u0000' }]);
    const csv = `event,legs\nSYNTHETIC fixture,"${legs.replaceAll('"', '""')}"\n`;
    await expect(parseHistoricalSource({ text: csv, format: 'csv', sourceName: 'Synthetic escaped controls.csv', verification: 'synthetic' })).rejects.toThrow('unsupported control');
    const preview = await parse([{ event: 'SYNTHETIC fixture', notes: 'Observed source\ttext\nsecond line\r\nthird line' }]);
    expect(preview.rows[0].snapshot.notes).toBe('Observed source\ttext\nsecond line\r\nthird line');
  });

  it.each(['\uD800', '\uDBFF', '\uDC00', '\uDFFF', '\uD800\uD800\uDC00', '\uD800\uDC00\uDC00'])('rejects lone or malformed UTF-16 surrogate sequences in values and keys', async malformed => {
    await expect(parse([{ event: `SYNTHETIC ${malformed} fixture` }])).rejects.toThrow('malformed Unicode');
    await expect(parse([{ event: 'SYNTHETIC fixture', [`field${malformed}`]: 'original text' }])).rejects.toThrow('malformed Unicode');
  });

  it('preserves valid surrogate pairs as original Unicode source facts', async () => {
    const raw = { event: 'SYNTHETIC fixture \uD83C\uDFBE', notes: '\uD83D\uDCCA Source note', ['field\uD83D\uDCC4']: 'Unmapped original field' };
    const preview = await parse([raw]);
    expect(preview.rows[0].snapshot.event).toBe(raw.event);
    expect(preview.rows[0].snapshot.notes).toBe(raw.notes);
    expect(preview.rows[0].raw).toEqual(raw);
  });

  it.each([
    '[{"event":"SYNTHETIC", "password":"sensitive-placeholder"}]',
    '[{"event":"SYNTHETIC", "nested":{"access_token":"sensitive-placeholder"}}]',
    '[{"event":"SYNTHETIC", "refreshToken":"sensitive-placeholder"}]',
    '[{"event":"SYNTHETIC", "notes":"sb_secret_placeholder"}]',
    '[{"event":"SYNTHETIC", "notes":"-----BEGIN PRIVATE KEY-----"}]',
    '[{"event":"SYNTHETIC", "__proto__":{"polluted":true}}]',
  ])('rejects recognized credential-bearing or unsafe sources using value-free errors', async text => {
    try {
      await parseHistoricalSource({ text, format: 'json', sourceName: 'Synthetic unsafe.json', verification: 'unverified' });
      expect.unreachable('Unsafe source was accepted');
    } catch (error) {
      expect(String(error)).not.toContain('sensitive-placeholder');
      expect(String(error)).toMatch(/credentials|Credential-bearing|unsafe/i);
    }
  });

  it('rejects credential fields inside CSV JSON legs and escaped JSON source text', async () => {
    const legs = JSON.stringify([{ sport: 'NBA', password: 'sensitive-placeholder' }]);
    const csv = `event,legs\nSYNTHETIC fixture,"${legs.replaceAll('"', '""')}"\n`;
    await expect(parseHistoricalSource({ text: csv, format: 'csv', sourceName: 'Synthetic unsafe.csv', verification: 'synthetic' })).rejects.toThrow(/credentials|Credential-bearing/i);
    await expect(parse([{ event: 'SYNTHETIC fixture', notes: JSON.stringify({ password: 'sensitive-placeholder' }) }])).rejects.toThrow(/credentials|Credential-bearing/i);
  });
});

describe('historical field and financial validation', () => {
  it.each(['NBA', 'NBL', 'ATP', 'WTA'])('accepts supported sport %s', async sport => {
    const preview = await parse([{ ...paper(), sport }]);
    expect(preview.rows[0].snapshot.sport).toBe(sport);
    expect(preview.rows[0].issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  it.each([
    { stake: '5.001' }, { stake: '-5.00' }, { stake: '$5.00' },
    { stakeCents: 500.5 }, { stakeCents: -500 }, { stakeCents: '1e2' },
    { stake: '5.00', stakeCents: 600 }, { odds: 1 }, { odds: '1.12345' },
    { odds: 'NaN' }, { probability: '60%' }, { probability: 1.1 },
    { predictionAt: '2026-10-01' }, { predictionAt: '2026-10-01T07:00:00' },
    { sport: 'NFL' }, { kind: 'deposit' }, { strategy: 'D' },
  ])('blocks malformed, ambiguous or contradictory fields: %j', async changes => {
    const preview = await parse([{ ...paper(), ...changes }]);
    expect(preview.rows[0].issues.some(issue => issue.severity === 'error')).toBe(true);
    expect(() => prepareImportCommit(preview, decisions(preview), 'synthetic')).toThrow('unresolved errors');
  });

  it('flags missing provenance without synthesizing a numerical estimate or source', async () => {
    const preview = await parse([{ ...paper(), probability: 0.6 }]);
    expect(preview.rows[0].snapshot).toMatchObject({ probability: 0.6, probabilitySource: null, probabilityMethod: null, modelVersion: null });
    expect(preview.rows[0].issues.filter(issue => issue.code === 'missing_probability_provenance')).toHaveLength(3);
  });

  it('prevents synthetic source provenance from being relabelled as private real history', async () => {
    const preview = await parse([paper()], 'unverified');
    expect(preview.rows[0].snapshot.verification).toBe('synthetic');
    expect(preview.rows[0].issues).toContainEqual(expect.objectContaining({ code: 'synthetic_relabel_prohibited', severity: 'error' }));
    expect(() => prepareImportCommit(preview, decisions(preview), 'unverified')).toThrow();
  });

  it('requires acknowledgement before incomplete records are archived', async () => {
    const preview = await parse([{ event: 'SYNTHETIC incomplete archive' }]);
    const choice = { rowNumber: 1, include: true, allowProbableDuplicate: false, acknowledgeIncomplete: false };
    expect(() => prepareImportCommit(preview, [choice], 'synthetic')).toThrow('explicit acknowledgement');
    expect(prepareImportCommit(preview, [{ ...choice, acknowledgeIncomplete: true }], 'synthetic').records[0].snapshot.odds).toBeNull();
  });

  it('rejects contradictory settlements, zero actual stakes and unbalanced reported payouts', async () => {
    for (const raw of [
      { ...paper(), settledAt: '2026-10-01T08:00:00Z' },
      { ...actual(), settledAt: '2026-10-01T00:00:00Z' },
      { ...actual(), stake: '0.00' },
      { ...actual(), payout: '10.00' },
      { ...actual(), outcome: 'lost', payout: '5.00' },
    ]) {
      const preview = await parse([raw]);
      expect(preview.rows[0].issues.some(issue => issue.severity === 'error')).toBe(true);
      expect(() => prepareImportCommit(preview, decisions(preview), 'synthetic')).toThrow('unresolved errors');
    }
  });

  it('preserves individual parlay legs and flags missing leg details instead of copying guesses', async () => {
    const raw = { ...paper(), legs: [{ sport: 'NBA', event: 'SYNTHETIC Event A', participant: 'SYNTHETIC Player A', market: 'Points', selection: 'Over', line: '20.5', odds: 1.5, outcome: 'pending' }, { sport: 'WTA', event: 'SYNTHETIC Event B', selection: 'Match winner' }] };
    const preview = await parse([raw]);
    expect(preview.rows[0].snapshot.legs).toHaveLength(2);
    expect(preview.rows[0].snapshot.legs[1]).toMatchObject({ participant: null, market: null, line: null, odds: null });
    expect(preview.rows[0].issues).toContainEqual(expect.objectContaining({ field: 'legs.1.odds', severity: 'warning' }));
    expect(preview.rows[0].transformations.some(change => change.rule === 'generated_metadata_uuid_not_source_fact')).toBe(true);
  });
});

describe('duplicate review and import commit', () => {
  it('detects exact duplicates independent of generated leg metadata IDs', async () => {
    const preview = await parse([paper(), paper()]);
    expect(preview.rows[0].snapshot.legs[0].id).not.toBe(preview.rows[1].snapshot.legs[0].id);
    expect(preview.rows[0].fingerprint).toBe(preview.rows[1].fingerprint);
    expect(preview.rows[1].duplicates).toContainEqual(expect.objectContaining({ recordId: 'row:1', level: 'exact' }));
    expect(() => prepareImportCommit(preview, decisions(preview), 'synthetic')).toThrow('exact duplicate');
    const selected = decisions(preview); selected[0].include = false;
    expect(prepareImportCommit(preview, selected, 'synthetic').records).toHaveLength(1);
  });

  it('detects source-scoped external IDs and rejects matching IDs even when odds differ', async () => {
    const preview = await parse([paper(), { ...paper(), odds: 2.1 }]);
    expect(preview.rows[1].duplicates[0].level).toBe('exact');
    expect(() => prepareImportCommit(preview, decisions(preview).map(choice => ({ ...choice, allowProbableDuplicate: true })), 'synthetic')).toThrow('exact duplicate');
  });

  it('requires an explicit probable-duplicate decision and never merges records', async () => {
    const preview = await parse([{ ...paper(), externalId: null }, { ...paper(), externalId: null, odds: 2.1, predictionAt: '2026-10-01T07:05:00Z' }]);
    expect(preview.rows[1].duplicates[0].level).toBe('probable');
    expect(() => prepareImportCommit(preview, decisions(preview), 'synthetic')).toThrow('may duplicate');
    const choices = decisions(preview); choices[1].allowProbableDuplicate = true;
    const workspace = commitHistoricalImport(emptyHistoricalWorkspace(), prepareImportCommit(preview, choices, 'synthetic'));
    expect(workspace.records).toHaveLength(2);
    expect(workspace.records[1].probableDuplicateConfirmed).toBe(true);
  });

  it('rechecks duplicates against current records at confirmation and at commit', async () => {
    const preview = await parse([paper()]);
    const first = register(preview);
    expect(() => prepareImportCommit(preview, decisions(preview), 'synthetic', first.records)).toThrow('exact duplicate');
    const staleCommit = prepareImportCommit(preview, decisions(preview), 'synthetic');
    expect(() => commitHistoricalImport(first, staleCommit)).toThrow('after preview');
  });

  it('records every explicit review decision with an archive-only financial audit', async () => {
    const preview = await parse([paper(), actual()]);
    const workspace = register(preview);
    expect(workspace.revision).toBe(1);
    expect(workspace.batches[0].summary).toMatchObject({ parsed: 2, imported: 2, skipped: 0, actual: 1, paper: 1 });
    expect(workspace.batches[0].rawSource).toBe(preview.rawSource);
    expect(workspace.audit[0]).toMatchObject({ action: 'import_confirmed', before: null, after: { financialEffect: 'archive_only_no_funding_or_ledger_writes', decisions: decisions(preview) } });
    expect(workspace).not.toHaveProperty('bets');
    expect(workspace).not.toHaveProperty('transactions');
  });

  it('preserves original source and row when a user explicitly resolves invalid data', async () => {
    const original = { ...paper(), stake: '5.001' };
    const preview = await parse([original]);
    const corrected = { ...original, stake: '5.00' };
    const revised = await reviseImportRow(preview, 1, corrected);
    expect(revised.rawSource).toBe(preview.rawSource);
    expect(revised.sourceHash).toBe(preview.sourceHash);
    expect(revised.rows[0].raw).toEqual(original);
    expect(revised.rows[0].snapshot.stakeCents).toBe(500);
    expect(revised.rows[0].issues.filter(issue => issue.severity === 'error')).toEqual([]);
    expect(revised.rows[0].transformations).toContainEqual({ field: 'record', original, normalized: corrected, rule: 'manual_resolution' });
    expect(register(revised).records[0].raw).toEqual(original);
    expect(preview.rows[0].issues.some(issue => issue.severity === 'error')).toBe(true);
  });

  it('refreshes duplicate warnings after manual source corrections', async () => {
    const preview = await parse([paper(), { ...paper(), externalId: 'SYNTHETIC-OTHER', event: 'SYNTHETIC different fixture' }]);
    const revised = await reviseImportRow(preview, 2, paper());
    expect(revised.rows[1].duplicates[0].level).toBe('exact');
  });
});
