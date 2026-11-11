import { sha256 } from '@/lib/imports/duplicates';
import { RECONCILIATION_SOURCE_FORMAT } from '@/lib/reconciliation/source';

const table = (heading: string, header: string[], rows: string[][]) => `## ${heading}\n${[header, header.map(() => '---'), ...rows].map(row => `| ${row.join(' | ')} |`).join('\n')}\n`;
export function syntheticReconciliationMarkdown() {
  const actual = Array.from({ length: 12 }, (_, i) => [`A${String(i + 1).padStart(2, '0')} (source day unknown)`, `NBA — SYNTHETIC LOCAL fixture ${i}`, `SYNTHETIC LOCAL selection ${i}; SYNTHETIC LOCAL leg ${i}`, `A$${i === 0 ? '10' : '5'}.00 ${i === 5 ? 'Bonus' : i > 5 ? 'Cash (planned)' : 'Cash'}`, i === 5 ? '1.86' : i === 0 ? '2.50' : '2.00', i === 0 || i === 5 ? 'Won' : i < 6 ? 'Lost' : 'Match won; settlement unverified', `synthetic-actual-${i}`]);
  const paper = Array.from({ length: 15 }, (_, i) => [`H${String(i + 1).padStart(2, '0')}`, 'NBA', `SYNTHETIC LOCAL historical paper ${i}`, i === 3 ? 'Unknown' : '1.72', i < 8 ? 'Won' : i < 11 ? 'Lost' : 'Unresolved at source checkpoint', `synthetic-paper-${i}`]);
  return '# SYNTHETIC LOCAL TEST ONLY; never send this fixture to hosted storage\n' +
    table('A. ACTUAL', ['ID / day', 'Sport and fixture', 'Exact selection(s)/legs', 'Funding / nominal stake', 'Odds quoted', 'Last-known result / settlement', 'Existing EdgeLab source ref'], actual) +
    // Explicit source payouts, retained separately from execution evidence.
    'SYNTHETIC accounting: A01 A$25; bonus payout A$4.30.\n' +
    table('B. PAPER', ['Historical ref', 'Sport', 'Exact selection / legs', 'Original paper odds', 'Last-known paper outcome', 'Source/ref'], paper) +
    table('C. PAPER proposals', ['Research ID', 'Sport', 'Paper selection', 'Original research odds', 'Registration status'], Array.from({ length: 4 }, (_, i) => [`P${17 + i}`, 'NBL', `SYNTHETIC LOCAL proposal ${i}`, '2.16', 'Unregistered proposal'])) +
    table('D. PAPER proposals', ['Existing Day 7 candidate ID', 'Sport', 'Paper selection and fixture', 'Original odds', 'Paper status'], Array.from({ length: 3 }, (_, i) => [`d7-synthetic-${i}`, 'ATP', `SYNTHETIC LOCAL day7 ${i} — SYNTHETIC LOCAL fixture`, '1.44', 'Unregistered proposal'])) +
    table('E. PAPER proposals', ['Existing Day 8 candidate ID', 'Sport', 'Paper selection and fixture', 'Original odds', 'Event start as supplied (AEDT)', 'Status'], Array.from({ length: 12 }, (_, i) => [`d8-synthetic-${i}`, 'WTA', `SYNTHETIC LOCAL day8 ${i} — SYNTHETIC LOCAL fixture`, '1.76', '2026-11-07T11:40:00+11:00', 'Tracking requested; preregistration unknown']));
}
export async function syntheticReconciliationSource(sourceText = syntheticReconciliationMarkdown()) {
  return JSON.stringify({ format: RECONCILIATION_SOURCE_FORMAT, version: 1, sourceName: 'SYNTHETIC-local-only.md', sourceText, sourceHash: await sha256(sourceText) });
}
