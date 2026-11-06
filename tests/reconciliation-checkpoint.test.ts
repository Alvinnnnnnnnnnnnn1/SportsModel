import { describe, expect, it } from "vitest";
import { createEmptyData } from "../src/lib/domain/fixtures";
import { emptyHistoricalWorkspace } from "../src/lib/imports/types";
import {
  actualReconciliationRows,
  buildReconciliationPreview,
  historicalAccountingCheckpoint,
  paperReconciliationRows,
  reconciliationSourceRows,
} from "../src/lib/reconciliation/checkpoint";

describe("historical reconciliation checkpoint", () => {
  it("contains the complete supplied inventory without turning proposals into registrations", () => {
    expect(actualReconciliationRows).toHaveLength(12);
    expect(paperReconciliationRows).toHaveLength(34);
    expect(reconciliationSourceRows).toHaveLength(46);
    expect(paperReconciliationRows.filter((row) => row.registrationExpected)).toHaveLength(2);
    expect(paperReconciliationRows.filter((row) => row.category === "paper")).toHaveLength(16);
    expect(paperReconciliationRows.filter((row) => row.category === "proposal")).toHaveLength(18);
  });

  it("preserves the owner-reported A01-A06 arithmetic as separate cash and bonus values", () => {
    expect(historicalAccountingCheckpoint.cashStakeCents).toBe(3000);
    expect(historicalAccountingCheckpoint.bonusStakeCents).toBe(500);
    expect(historicalAccountingCheckpoint.cashReturnCents).toBe(2500);
    expect(historicalAccountingCheckpoint.bonusCashWinningsCents).toBe(430);
    expect(historicalAccountingCheckpoint.reportedNetCents).toBe(-70);
    expect(historicalAccountingCheckpoint.cashReturnCents + historicalAccountingCheckpoint.bonusCashWinningsCents - historicalAccountingCheckpoint.cashStakeCents).toBe(-70);
  });

  it("does not produce mutations or matches when the isolated workspace is empty", () => {
    const preview = buildReconciliationPreview(createEmptyData(), emptyHistoricalWorkspace());
    expect(preview).toHaveLength(46);
    expect(preview.every((row) => row.existingRecordId === null)).toBe(true);
    expect(preview.filter((row) => row.action === "stage_provisional")).toHaveLength(12);
    expect(preview.filter((row) => row.action === "keep_proposal")).toHaveLength(18);
    expect(preview.filter((row) => row.action === "needs_review")).toHaveLength(16);
  });
});
