/** Offline preparation only. Never reads credentials, calls Supabase, or writes a workspace. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

const [sourcePath, backupPath, outputPath] = process.argv.slice(2);
if (!sourcePath || !backupPath || !outputPath) throw new Error('Usage: node scripts/prepare-reconciliation-import.mjs /absolute/source.md /absolute/private-backup.json .local/private-import-directory');
const root = process.cwd();
const output = path.resolve(outputPath);
if (!output.startsWith(path.resolve(root, '.local') + path.sep)) throw new Error('Private import artifacts must stay under ignored .local/.');
const [sourceText, backupText] = await Promise.all([fs.readFile(sourcePath, 'utf8'), fs.readFile(backupPath, 'utf8')]);
const hash = text => createHash('sha256').update(text).digest('hex');
const backup = JSON.parse(backupText);
if (backup.format !== 'edgelab.continuity-backup' || backup.version !== 1 || backup.workspaceMode !== 'supabase') throw new Error('Use Research → Export complete experiment from the authenticated private workspace.');
const server = await createServer({ configFile: false, envDir: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': path.join(root, 'src') } } });
try {
  const { appDataSchema } = await server.ssrLoadModule('/src/lib/domain/validation.ts');
  const { historicalWorkspaceSchema } = await server.ssrLoadModule('/src/lib/imports/validation.ts');
  const { prepareReconciliationImport, RECONCILIATION_SOURCE_FORMAT } = await server.ssrLoadModule('/src/lib/reconciliation/source.ts');
  const { prepareImportCommit, commitHistoricalImport } = await server.ssrLoadModule('/src/lib/imports/commands.ts');
  const data = appDataSchema.parse(backup.actualWorkspace), history = historicalWorkspaceSchema.parse(backup.historicalWorkspace);
  const source = { format: RECONCILIATION_SOURCE_FORMAT, version: 1, sourceName: path.basename(sourcePath), sourceText, sourceHash: hash(sourceText) };
  const text = JSON.stringify(source, null, 2);
  const review = await prepareReconciliationImport({ text, sourceName: 'canonical-reconciliation-source.json', data, history, mode: 'supabase' });
  const decisions = review.preview.rows.map(row => ({ rowNumber: row.rowNumber, include: !row.duplicates.length && !row.issues.some(issue => issue.severity === 'error'), allowProbableDuplicate: false, acknowledgeIncomplete: true }));
  // Validation rehearsal in memory only. These generated IDs are never sent to Supabase.
  const commit = prepareImportCommit(review.preview, decisions, 'unverified', history.records);
  const next = commitHistoricalImport(history, commit);
  const replay = await prepareReconciliationImport({ text, sourceName: 'canonical-reconciliation-source.json', data, history: next, mode: 'supabase' });
  if (!replay.preview.rows.every(row => row.duplicates.some(d => d.level === 'exact'))) throw new Error('In-memory duplicate replay did not account for every source item.');
  const report = {
    status: 'offline_preview_no_hosted_writes', sourceHash: source.sourceHash, backupHash: hash(backupText), exportedAt: backup.exportedAt,
    originalCounts: { actual: data.bets.length, corePaper: data.paperPredictions.length, archive: history.records.length, trackedArchivePaper: history.paperResults.length, transactions: data.transactions.length, coreAudit: data.audit.length, historyAudit: history.audit.length },
    inventory: { actualClaims: review.items.filter(i => i.category === 'actual').length, paperAndProposals: review.items.filter(i => i.category !== 'actual').length },
    linked: review.links.filter(link => link.matches.length),
    newArchive: commit.records.map(record => ({ sourceId: record.snapshot.externalId, kind: record.snapshot.kind, warnings: record.issues.map(issue => `${issue.code}: ${issue.message}`) })),
    blocked: review.preview.rows.filter(row => row.issues.some(issue => issue.severity === 'error')).map(row => ({ rowNumber: row.rowNumber, issues: row.issues })),
    unapprovedProbableMatches: review.preview.rows.filter(row => row.duplicates.some(d => d.level === 'probable') && !row.duplicates.some(d => d.level === 'exact')).map(row => ({ rowNumber: row.rowNumber, duplicates: row.duplicates })),
    offlineIdempotency: 'pass', hostedWrites: 0,
    expectedAfterArchive: { archive: next.records.length, actual: data.bets.length, trackedPaper: history.paperResults.length, transactions: data.transactions.length },
  };
  await fs.mkdir(output, { recursive: true, mode: 0o700 });
  for (const [name, contents] of Object.entries({ 'source.md': sourceText, 'before-backup.json': backupText,
    'canonical-reconciliation-source.json': text, 'preview.json': JSON.stringify(review.preview, null, 2),
    'reconciliation-report.json': JSON.stringify(report, null, 2) })) {
    // Preserve artifacts across authentication failures and repeated preparation.
    try { await fs.writeFile(path.join(output, name), contents, { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST' || await fs.readFile(path.join(output, name), 'utf8') !== contents) throw error; }
  }
  console.log(JSON.stringify({ output, sourceHash: report.sourceHash, backupExportedAt: report.exportedAt,
    originalCounts: report.originalCounts, inventory: report.inventory, linked: report.linked.length,
    newArchive: report.newArchive.length, blocked: report.blocked.length,
    probableMatches: report.unapprovedProbableMatches.length, expectedAfterArchive: report.expectedAfterArchive,
    offlineIdempotency: report.offlineIdempotency, hostedWrites: 0 }, null, 2));
} finally { await server.close(); }
