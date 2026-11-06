import type { AppData } from "@/lib/domain/types";
import type { HistoricalWorkspace } from "@/lib/imports/types";

export type ReconciliationCategory = "actual" | "paper" | "proposal";
export type ReconciliationAction =
  | "keep_existing"
  | "link_existing"
  | "stage_provisional"
  | "keep_proposal"
  | "leave_unresolved"
  | "needs_review";

export interface ReconciliationSourceRow {
  sourceId: string;
  category: ReconciliationCategory;
  selection: string;
  event: string | null;
  sport: "NBA" | "NBL" | "ATP" | "WTA";
  originalOdds: number | null;
  reportedStakeCents: number | null;
  stakeType: "cash" | "bonus" | null;
  sourceOutcome: "won" | "lost" | "unresolved" | null;
  settlementStatus: "owner_reported" | "unverified" | "not_applicable";
  sourceReference: string | null;
  registrationExpected: boolean;
}

export interface ReconciliationMatch {
  source: ReconciliationSourceRow;
  existingRecordId: string | null;
  existingStatus: "registered" | "archived" | "unmatched";
  duplicateStatus: "exact_match" | "candidate_match" | "no_match";
  action: ReconciliationAction;
  reason: string;
}

type ActualTuple = [
  string,
  ReconciliationSourceRow["sport"],
  string,
  string,
  number,
  number,
  "cash" | "bonus",
  ReconciliationSourceRow["sourceOutcome"],
  ReconciliationSourceRow["settlementStatus"],
  string,
];

const actualRow = ([
  sourceId,
  sport,
  event,
  selection,
  originalOdds,
  reportedStakeCents,
  stakeType,
  sourceOutcome,
  settlementStatus,
  sourceReference,
]: ActualTuple): ReconciliationSourceRow => ({
  sourceId, sport, event, selection, originalOdds, reportedStakeCents, stakeType, sourceOutcome, settlementStatus, sourceReference, category: "actual", registrationExpected: true,
});

export const actualReconciliationRows: ReconciliationSourceRow[] = ([
  ["A01", "NBA", "Portland vs Utah", "Scoot Henderson under 20.5 PRA + Toumani Camara 2+ threes", 2.5, 1000, "cash", "won", "owner_reported", "0d824fc2-4a12-4e1a-a638-7b94a4106677"],
  ["A02", "NBA", "Minnesota vs San Antonio", "Jaden McDaniels 6+ rebounds + Victor Wembanyama 20+ points", 2.54, 500, "cash", "lost", "owner_reported", "86169373-66d5-4fc0-8a71-0f53afebeb6a"],
  ["A03", "NBL", "South East Melbourne vs Tasmania", "Nathan Sobey 15+ points + Will Magnay 4+ assists", 2, 500, "cash", "lost", "owner_reported", "4d045dca-3c9c-4a51-a762-0052b0081f86"],
  ["A04", "NBL", "Melbourne United vs New Zealand Breakers", "Sam Mennenga 20+ points + Josh Oduro 15+ points", 1.75, 500, "cash", "lost", "owner_reported", "5f79c48b-c1d0-45b5-9ce1-3e965a182daf"],
  ["A05", "NBA", "Fixture classification unresolved", "Jayson Tatum 6+ assists + Paul George 15+ points + Franz Wagner 15+ points", 2.1, 500, "cash", "lost", "owner_reported", "494766ba-a0c0-464c-a7f7-68c60c834418"],
  ["A06", "NBA", "LA Clippers vs Golden State Warriors", "De'Anthony Melton 2+ made threes", 1.86, 500, "bonus", "won", "owner_reported", "9da934dc-aa53-4372-a306-4525b2655f8c"],
  ["A07", "ATP", "Matteo Berrettini vs Ugo Humbert", "Matteo Berrettini match winner", 2.04, 500, "cash", "won", "unverified", "2f3bbf25-729d-452c-8aa2-8ca0b5c2c273"],
  ["A08", "WTA", "Magda Linette vs Moyuka Uchijima", "Magda Linette match winner", 1.72, 500, "cash", "won", "unverified", "081e96fa-0f49-4165-95a5-7b557a29e837"],
  ["A09", "ATP", "Rinky Hijikata vs Tomas Martin Etcheverry", "Rinky Hijikata match winner", 2.07, 500, "cash", "won", "unverified", "d20b7cba-8c2d-4f4a-a55c-89eefc4757aa"],
  ["A10", "ATP", "Rinky Hijikata vs Luca Van Assche", "Rinky Hijikata match winner", 2.44, 500, "cash", "unresolved", "unverified", "d8-atp-hijikata-vanassche-ml"],
  ["A11", "NBL", "Brisbane Bullets at Melbourne United", "Brisbane Bullets match winner", 5.1, 500, "cash", "unresolved", "unverified", "d8-nbl-brisbane-melbourne-ml"],
  ["A12", "NBA", "Philadelphia 76ers at Cleveland Cavaliers", "Cleveland Cavaliers match winner", 2.19, 500, "cash", "unresolved", "unverified", "d8-nba-cleveland-philadelphia-ml"],
] satisfies ActualTuple[]).map(actualRow);

const paper = (sourceId: string, sport: ReconciliationSourceRow["sport"], selection: string, originalOdds: number | null, sourceOutcome: ReconciliationSourceRow["sourceOutcome"], sourceReference: string | null, registrationExpected: boolean, category: "paper" | "proposal" = "proposal"): ReconciliationSourceRow => ({
  sourceId, category, sport, selection, event: null, originalOdds, reportedStakeCents: null, stakeType: null, sourceOutcome, settlementStatus: registrationExpected ? "owner_reported" : "not_applicable", sourceReference, registrationExpected,
});

export const paperReconciliationRows: ReconciliationSourceRow[] = [
  paper("H01", "NBA", "Jayson Tatum 7+ assists + Paul George 5+ rebounds", 3.1, "won", null, false, "paper"),
  paper("H02", "NBA", "Julius Randle 6+ rebounds + Pascal Siakam 20+ points", 1.9, "lost", null, false, "paper"),
  paper("H03", "NBA", "Luka Doncic 6+ assists + Walker Kessler 8+ rebounds", 1.72, "won", null, false, "paper"),
  paper("H04", "NBA", "Darius Garland 4+ assists + Franz Wagner 10+ points", null, "lost", null, false, "paper"),
  paper("H05", "NBA", "Tyrese Maxey 25+ points vs Chicago Bulls", 1.72, "won", "d5379c5c-138e-498e-8509-bd9f9cef5bcf", true, "paper"),
  paper("H06", "NBA", "Nikola Jokic 7+ assists vs Portland", null, "won", null, false, "paper"),
  paper("H07", "NBA", "Victor Wembanyama 22+ points vs Utah", null, "lost", null, false, "paper"),
  paper("H08", "WTA", "Maya Joint ML vs Maddison Inglis", 1.22, "won", null, false, "paper"),
  paper("H09", "ATP", "Tommy Paul ML vs Holger Rune", 1.41, "won", null, false, "paper"),
  paper("H10", "ATP", "Alex Michelsen ML vs Jiri Lehecka", 2.26, "won", null, false, "paper"),
  paper("H11", "ATP", "Casper Ruud ML vs Rafael Jodar", 2.51, "won", null, false, "paper"),
  paper("H12", "WTA", "Leylah Fernandez ML vs Sofia Kenin", 1.33, "unresolved", null, false, "paper"),
  paper("H13", "WTA", "Claire Liu ML vs Katie Boulter", 2.34, "unresolved", null, false, "paper"),
  paper("H14", "NBL", "Brisbane Bullets +3.5 vs Perth", 1.92, "unresolved", null, false, "paper"),
  paper("H15", "NBA", "Dylan Windler 15+ points vs Perth", 1.53, "unresolved", null, false, "paper"),
  paper("P17", "NBA", "New Orleans Pelicans ML vs Utah Jazz", 1.49, null, null, false),
  paper("P18", "NBA", "Tyrese Maxey 25+ points vs Detroit Pistons", 2.16, null, null, false),
  paper("P19", "NBL", "Illawarra Hawks +3.5 vs Cairns Taipans", 1.93, null, null, false),
  paper("P20", "NBL", "Makur Maker 20+ points vs Illawarra Hawks", 2.95, null, null, false),
  paper("d7-atp-ruud-struff-r16", "ATP", "Casper Ruud ML vs Jan-Lennard Struff", 1.56, null, null, false),
  paper("d7-nba-phoenix-orlando-ml", "NBA", "Phoenix Suns ML vs Orlando Magic", 1.89, null, null, false),
  paper("d7-nbl-mennenga-20plus", "NBL", "Sam Mennenga 20+ points vs Tasmania JackJumpers", 1.44, "unresolved", "73732665-3944-4add-9e22-45610019dac7", true, "paper"),
  paper("d8-nba-embiid-8plus-rebounds", "NBA", "Joel Embiid 8+ rebounds vs Cleveland", 1.76, null, null, false),
  paper("d8-nba-mitchell-2plus-threes", "NBA", "Donovan Mitchell 2+ threes vs Philadelphia", 1.32, null, null, false),
  paper("d8-nbl-bannan-4plus-assists", "NBL", "Josh Bannan 4+ assists vs Tasmania", 1.61, null, null, false),
  paper("d8-nbl-magnay-4plus-assists", "NBL", "Will Magnay 4+ assists vs New Zealand", 1.59, null, null, false),
  paper("d8-nbl-mathias-15plus-points", "NBL", "Dakota Mathias 15+ points vs Tasmania", 1.53, null, null, false),
  paper("d8-nbl-oduro-20plus-points", "NBL", "Josh Oduro 20+ points vs Brisbane", 1.88, null, null, false),
  paper("d8-nbl-travers-4plus-assists", "NBL", "Luke Travers 4+ assists vs Brisbane", 1.66, null, null, false),
  paper("d8-atp-shelton-paul-ml", "ATP", "Ben Shelton ML vs Tommy Paul", 2.11, null, null, false),
  paper("d8-atp-borges-ruud-ml", "ATP", "Nuno Borges ML vs Casper Ruud", 2.77, null, null, false),
  paper("d8-wta-cirstea-shubladze-ml", "WTA", "Sorana Cirstea ML vs Alexandra Shubladze", 1.31, null, null, false),
  paper("d8-wta-kudermetova-tjen-ml", "WTA", "Polina Kudermetova ML vs Janice Tjen", 2.5, null, null, false),
  paper("d8-wta-ruzic-eala-ml", "WTA", "Antonia Ruzic ML vs Alexandra Eala", 4.25, null, null, false),
];

export const reconciliationSourceRows = [...actualReconciliationRows, ...paperReconciliationRows];

export const historicalAccountingCheckpoint = {
  cashStakeCents: 3000,
  bonusStakeCents: 500,
  cashReturnCents: 2500,
  bonusCashWinningsCents: 430,
  reportedNetCents: -70,
  settledWins: 2,
  settledLosses: 4,
} as const;

function findExisting(row: ReconciliationSourceRow, data: AppData, history: HistoricalWorkspace) {
  const actual = data.bets.find((bet) => row.sourceReference === bet.id || row.sourceReference === bet.candidateId || bet.notes.includes(row.sourceReference ?? "__none__"));
  const paper = data.paperPredictions.find((item) => row.sourceReference === item.id || item.candidate.id === row.sourceReference);
  const archive = history.records.find((record) => record.id === row.sourceReference || record.snapshot.externalId === row.sourceReference || record.snapshot.sourceReference === row.sourceReference);
  return actual ? { id: actual.id, status: "registered" as const, exact: actual.id === row.sourceReference } : paper ? { id: paper.id, status: "registered" as const, exact: paper.id === row.sourceReference } : archive ? { id: archive.id, status: "archived" as const, exact: archive.id === row.sourceReference } : null;
}

export function buildReconciliationPreview(data: AppData, history: HistoricalWorkspace): ReconciliationMatch[] {
  return reconciliationSourceRows.map((source) => {
    const existing = findExisting(source, data, history);
    if (existing) return { source, existingRecordId: existing.id, existingStatus: existing.status, duplicateStatus: existing.exact ? "exact_match" : "candidate_match", action: "link_existing", reason: "An existing record or archive reference matches the supplied reconciliation key." };
    return {
      source,
      existingRecordId: null,
      existingStatus: "unmatched",
      duplicateStatus: "no_match",
      action: source.category === "actual" ? "stage_provisional" : source.category === "paper" ? "needs_review" : "keep_proposal",
      reason: source.category === "actual" ? "Owner-reported placement has no exact local match; do not create a financial record without explicit review." : source.category === "paper" ? "Historical paper evidence needs exact pre-event registration evidence before it enters validated paper analytics." : "Retain as an unregistered proposal; do not backdate paper registration.",
    };
  });
}
