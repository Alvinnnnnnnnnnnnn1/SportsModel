export type Sport = "NBA" | "NBL" | "ATP" | "WTA";
export type Strategy = "A" | "B" | "C";
export type Outcome = "pending" | "won" | "lost" | "void";
export type Mode = "demo" | "supabase";
export type RecordLifecycle = "valid" | "provisional" | "entered_in_error" | "superseded";
export type PlacementStatus = "known_owner_attested" | "unknown_owner_reported" | "source_verified";
export interface BetLeg {
  id: string;
  sport: Sport;
  event: string;
  participant: string;
  market: string;
  selection: string;
  line: string;
  odds: number;
  outcome: Outcome;
  statistic?: string;
}
export interface Bet {
  id: string;
  placedAt: string | null;
  recordedAt?: string;
  placementStatus?: PlacementStatus;
  lifecycle?: RecordLifecycle;
  lifecycleReason?: string;
  lifecycleChangedAt?: string;
  supersededBy?: string;
  accountingExcluded?: boolean;
  settledAt?: string;
  bookmaker: string;
  stakeCents: number;
  stakeType: "cash" | "bonus";
  odds: number;
  outcome: Outcome;
  strategy: Strategy;
  legs: BetLeg[];
  notes: string;
  confirmedAt: string;
  probability?: number;
  candidateId?: string;
  oddsProvenance?: Provenance;
  probabilityProvenance?: Provenance;
}
export interface Provenance {
  source: string;
  timestamp: string;
  method: string;
  modelVersion: string;
  simulated: boolean;
}
export interface Candidate {
  id: string;
  sport: Sport;
  event: string;
  participant: string;
  market: string;
  selection: string;
  line: string;
  bookmaker: string;
  odds: number;
  probability?: number;
  strategy: Strategy;
  rationale: string;
  uncertainty: "illustrative" | "high" | "medium";
  startsAt: string;
  registeredAt: string;
  oddsProvenance: Provenance;
  probabilityProvenance?: Provenance;
}
export interface PaperPrediction {
  id: string;
  candidate: Candidate;
  registeredAt: string;
  lifecycle?: RecordLifecycle;
  lifecycleReason?: string;
  lifecycleChangedAt?: string;
  supersededBy?: string;
  accountingExcluded?: boolean;
  hypotheticalStakeCents: number;
  outcome: Outcome;
  settledAt?: string;
  statistic?: string;
}
export interface AppNotification {
  id: string;
  candidateId?: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  dismissedAt?: string;
  simulated: boolean;
}
export interface ResearchRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  candidateCount: number;
  simulated: boolean;
  error?: string;
}
export interface Transaction {
  id: string;
  kind: "deposit" | "withdrawal";
  amountCents: number;
  createdAt: string;
  note: string;
}
export interface ExperimentSettings {
  fundingCapCents: number;
  defaultStakeCents: number;
  currency: "AUD";
  timezone: "Australia/Melbourne";
}
export interface AuditEntry {
  id: string;
  entityType: "bet" | "paper" | "settings" | "transaction";
  entityId: string;
  action: string;
  timestamp: string;
  actor?: string;
  before: unknown;
  after: unknown;
}
export interface AppData {
  version: 1;
  settings: ExperimentSettings;
  bets: Bet[];
  transactions: Transaction[];
  candidates: Candidate[];
  paperPredictions: PaperPrediction[];
  notifications: AppNotification[];
  researchRuns: ResearchRun[];
  audit: AuditEntry[];
}
export const STRATEGIES: Record<Strategy, string> = {
  A: "High Probability",
  B: "Potential Value",
  C: "Alternative Markets",
};
export const SPORTS: Sport[] = ["NBA", "NBL", "ATP", "WTA"];
