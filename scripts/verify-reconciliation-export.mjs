/** Read-only verification of owner-downloaded private exports. Never contacts Supabase. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const [directory, afterPath] = process.argv.slice(2);
if (!directory || !afterPath) throw new Error('Usage: node scripts/verify-reconciliation-export.mjs .local/private-import-directory /absolute/fresh-continuity-export.json');
const local = path.resolve(directory);
if (!local.startsWith(path.resolve('.local') + path.sep)) throw new Error('Use the ignored private import directory.');
const beforeText = await fs.readFile(path.join(local, 'before-backup.json'), 'utf8');
const afterText = await fs.readFile(afterPath, 'utf8');
const before = JSON.parse(beforeText), after = JSON.parse(afterText);
assert.equal(after.format, 'edgelab.continuity-backup'); assert.equal(after.workspaceMode, 'supabase');
assert(Date.parse(after.exportedAt) > Date.parse(before.exportedAt), 'Use a fresh export after the save and reload.');
const loader = await createServer({ configFile: false, envDir: false, appType: 'custom', resolve: { alias: { '@': `${process.cwd()}/src` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
try {
  const { appDataSchema } = await loader.ssrLoadModule('/src/lib/domain/validation.ts');
  const { historicalWorkspaceSchema } = await loader.ssrLoadModule('/src/lib/imports/validation.ts');
  const { prepareReconciliationImport } = await loader.ssrLoadModule('/src/lib/reconciliation/source.ts');
  const { reviewArchivedWagerClaims, summarizeWagerClaims } = await loader.ssrLoadModule('/src/lib/imports/wager-claims.ts');
  const sourceText = await fs.readFile(path.join(local, 'canonical-reconciliation-source.json'), 'utf8');
  const data = appDataSchema.parse(after.actualWorkspace), history = historicalWorkspaceSchema.parse(after.historicalWorkspace);
  const oldData = appDataSchema.parse(before.actualWorkspace), oldHistory = historicalWorkspaceSchema.parse(before.historicalWorkspace);
  assert.deepEqual(data, oldData, 'Core actual, financial, settings or audit data changed; review before claiming an archive-only import.');
  for (const key of ['batches', 'records', 'audit']) for (const item of oldHistory[key])
    assert.deepEqual(history[key].find(value => value.id === item.id), item, `Existing ${key} must remain intact.`);
  const notificationProgress = [];
  for (const notification of oldHistory.notifications) {
    const current = history.notifications.find(value => value.id === notification.id);
    assert(current, 'An existing notification is missing.');
    const immutable = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['readAt', 'dismissedAt'].includes(key)));
    assert.deepEqual(immutable(current), immutable(notification), 'Original notification evidence changed.');
    for (const [field, action] of [['readAt', 'notification_read'], ['dismissedAt', 'notification_dismissed']]) {
      if (current[field] === notification[field]) continue;
      assert.equal(notification[field], null, 'A previously recorded notification timestamp cannot be replaced or reset.');
      assert(current[field] && Number.isFinite(Date.parse(current[field])), 'Notification progress needs an exact timestamp.');
      assert(history.audit.some(entry => entry.action === action && entry.after?.id === notification.id && entry.after[field] === current[field]), 'Notification progress needs its retained lifecycle audit.');
      notificationProgress.push({ field, timestamp: current[field], action });
    }
  }
  assert.deepEqual(history.paperResults, oldHistory.paperResults, 'No new paper registration or settlement was authorized by archive import.');
  const review = await prepareReconciliationImport({ text: sourceText, sourceName: 'canonical-reconciliation-source.json', data, history, mode: 'supabase' });
  assert.equal(review.items.length, 46);
  assert(review.links.every(link => link.matches.length), 'Not all source items are represented yet.');
  assert(review.links.every(link => new Set(link.matches.map(match => match.id)).size === 1), 'Multiple distinct destination positions match a source item; review duplicates.');
  assert(review.preview.rows.every(row => row.duplicates.some(duplicate => duplicate.level === 'exact')), 'Reimport must exclude all 46 source positions.');
  const newRecords = history.records.filter(record => !oldHistory.records.some(old => old.id === record.id));
  const oldReview = await prepareReconciliationImport({ text: sourceText, sourceName: 'canonical-reconciliation-source.json', data: oldData, history: oldHistory, mode: 'supabase' });
  const previouslyMissing = new Set(oldReview.links.filter(link => !link.matches.length).map(link => link.sourceId));
  assert.equal(newRecords.length, previouslyMissing.size);
  assert.equal(history.paperResults.length, oldHistory.paperResults.length);
  for (const record of newRecords) {
    const metadata = record.raw.reconciliation;
    assert(previouslyMissing.has(metadata.sourceId));
    assert.equal(record.snapshot.verification, 'unverified');
    assert.equal(record.snapshot.predictionAt, null); assert.equal(record.snapshot.probability, null);
    assert.equal(record.snapshot.placedAt, null); assert.equal(record.snapshot.settledAt, null);
    if (record.snapshot.kind === 'actual') {
      assert.equal(record.snapshot.odds, null); assert.equal(record.snapshot.stakeCents, null);
      assert.equal(record.snapshot.payoutCents, null); assert.equal(record.snapshot.outcome, null);
    }
  }
  const claims = reviewArchivedWagerClaims(history.records, data.bets, 'supabase');
  assert.equal(claims.summary.duplicateUncertainty, false, 'Historical financial claim overlaps require manual review.');
  const settled = claims.rows.map(row => row.claim).filter(claim => claim.reportedOutcome && claim.reportedOutcome !== 'pending' && claim.reportedStakeCents !== null && claim.reportedCashPayoutCents !== null && claim.stakeType !== null);
  const subtotal = summarizeWagerClaims(settled);
  assert.equal(settled.length, 6);
  assert.equal(subtotal.settledCashStakeCents, 3000);
  assert.equal(subtotal.settledCashReturnCents, 2500);
  assert.equal(subtotal.bonusCashWinningsCents, 430);
  assert.equal(subtotal.reportedRealisedProfitCents, -70);
  const report = { status: 'verified_owner_export_after_reported_refresh', evidence: 'Private client export; no privileged/direct hosted query by this script.',
    sourceHash: review.source.sourceHash, afterExportedAt: after.exportedAt,
    actualClaims: review.items.filter(item => item.category === 'actual').length,
    paperSources: review.items.filter(item => item.category !== 'actual').length,
    newArchiveRecords: newRecords.length, linkedSourceItems: review.links.length,
    counts: { actual: data.bets.length, transactions: data.transactions.length, archive: history.records.length, archivePaperTracked: history.paperResults.length },
    unchangedCoreWorkspace: true, existingHistoryPreserved: true, originalUnknownsPreserved: true, interveningAuditedNotificationProgress: notificationProgress,
    duplicateReplay: 'all_46_excluded', retrospectiveRegistrations: 0, financialWrites: 0,
    reportedSettledSourceSubtotal: { claims: settled.length, cashStakeCents: subtotal.settledCashStakeCents, cashReturnCents: subtotal.settledCashReturnCents, bonusCashWinningsCents: subtotal.bonusCashWinningsCents, profitCents: subtotal.reportedRealisedProfitCents, independentlyVerified: false } };
  const fingerprint = createHash('sha256').update(afterText).digest('hex');
  const artifacts = { [`after-backup-${fingerprint.slice(0, 12)}.json`]: afterText,
    [`verified-${fingerprint.slice(0, 12)}-${createHash('sha256').update(JSON.stringify(report)).digest('hex').slice(0, 8)}.json`]: JSON.stringify(report, null, 2) };
  for (const [name, contents] of Object.entries(artifacts)) {
    try { await fs.writeFile(path.join(local, name), contents, { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST' || await fs.readFile(path.join(local, name), 'utf8') !== contents) throw error; }
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await loader.close(); }
