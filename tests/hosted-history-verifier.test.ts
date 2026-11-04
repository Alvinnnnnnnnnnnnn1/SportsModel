import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  emptyHistoricalProbeWorkspace, isEmptyHistoricalProbeWorkspace,
  runHostedHistoryAccessChecks, runAnonymousHistoryChecks,
  syntheticHistoricalRejectionProbe,
  type ProbeClient, type ProbeResponse, type ProbeWorkspace,
} from "../scripts/check-hosted-history-access.mjs";
const ownerA = "10000000-0000-4000-8000-000000000001";
const ownerB = "10000000-0000-4000-8000-000000000002";
interface Call { type: string; name: string; args?: Record<string, unknown>; }
function client(owner: string, options: { workspace?: ProbeWorkspace; unexpectedSave?: boolean; crossRows?: boolean; syntheticValidatorAccepts?: boolean; anonymous?: boolean } = {}) {
  const workspace = options.workspace ?? emptyHistoricalProbeWorkspace(); const calls: Call[] = [];
  const result = (data: unknown, error: ProbeResponse["error"] = null) => Promise.resolve({ data, error });
  const instance: ProbeClient = {
    rpc(name, args) {
      calls.push({ type: "rpc", name, args });
      if (options.anonymous) return result(null, { code: "42501", message: "denied" });
      if (name === "edgelab_load_history") return args.expected_owner_id !== owner ? result(null, { code: "P0001", message: "Authenticated historical owner changed; reload before accessing history" }) : result(structuredClone(workspace));
      if (name === "edgelab_save_history") {
        if (options.unexpectedSave) return result(1);
        return args.expected_owner_id !== owner ? result(null, { code: "P0001", message: "Authenticated historical owner changed; reload before accessing history" }) : result(null, { code: "P0001", message: "Historical batch source/hash or confirmation summary is invalid; synthetic data stays in Demo" });
      }
      if (name === "edgelab_history_batch" || name === "edgelab_history_record") return result(options.syntheticValidatorAccepts ?? false);
      throw new Error("Unexpected mock RPC");
    },
    from(table) {
      calls.push({ type: "table", name: table });
      return { select: () => ({ eq: (field: string, target: string) => { expect(field).toBe("user_id"); expect(target).not.toBe(owner); return { limit: () => result(options.crossRows ? [{ user_id: target }] : []) }; }, limit: () => options.anonymous ? result(null, { code: "42501" }) : result([]) }) };
    },
  };
  return { instance, calls };
}
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No hosted network is permitted in verifier unit tests"); })); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("safe hosted historical verifier input and scope", () => {
  it("uses an exact empty-history guard rather than assuming populated legacy accounts are empty", () => {
    expect(isEmptyHistoricalProbeWorkspace(emptyHistoricalProbeWorkspace())).toBe(true);
    for (const value of [null, {}, { ...emptyHistoricalProbeWorkspace(), revision: 1 }, { ...emptyHistoricalProbeWorkspace(), records: [{}] }, { ...emptyHistoricalProbeWorkspace(), notifications: [{}] }, { ...emptyHistoricalProbeWorkspace(), audit: [{}] }]) expect(isEmptyHistoricalProbeWorkspace(value)).toBe(false);
  });
  it("never relabels the synthetic rejection payload or invents real funding/history", () => {
    const workspace = syntheticHistoricalRejectionProbe();
    const batch = workspace.batches[0] as { verification: string; rawSource: string; sourceHash: string; summary: { actual: number; paper: number } };
    const record = workspace.records[0] as { snapshot: { verification: string; kind: string; notes: string }; raw: { verification: string } };
    expect(batch.verification).toBe("synthetic"); expect(record.snapshot.verification).toBe("synthetic"); expect(record.raw.verification).toBe("synthetic");
    expect(batch.rawSource).toContain("SYNTHETIC"); expect(record.snapshot.notes).toContain("must not persist"); expect(record.snapshot.kind).toBe("paper"); expect(batch.summary).toMatchObject({ actual: 0, paper: 1 });
    expect(batch.sourceHash).toBe(createHash("sha256").update(batch.rawSource).digest("hex"));
  });
  it("defaults to read/validator-only checks without save RPCs", async () => {
    const a = client(ownerA), b = client(ownerB);
    const report = await runHostedHistoryAccessChecks({ clients: [a.instance, b.instance], identities: [ownerA, ownerB] });
    expect(report.negativeWriteStatus).toBe("not_requested"); expect(report.results).toHaveLength(6); expect(report.results.every(r => r.passed)).toBe(true);
    expect([...a.calls, ...b.calls].filter(call => call.name === "edgelab_save_history")).toEqual([]);
    expect(report.results.find(result => result.name.startsWith("Cross-owner reads"))?.detail).toContain("not non-empty");
  });
  it("only sends explicit expected-failure save probes after both histories are empty", async () => {
    const a = client(ownerA), b = client(ownerB);
    const report = await runHostedHistoryAccessChecks({ clients: [a.instance, b.instance], identities: [ownerA, ownerB], negativeWrites: true });
    expect(report.negativeWriteStatus).toBe("rejected_unchanged"); expect(report.results).toHaveLength(8);
    const writes = [...a.calls, ...b.calls].filter(call => call.name === "edgelab_save_history"); expect(writes).toHaveLength(3);
    for (const write of writes) expect((write.args?.workspace as { batches: { verification: string }[] }).batches[0].verification).toBe("synthetic");
  });
  it("skips all save probes when either test account already contains historical data", async () => {
    const a = client(ownerA, { workspace: { ...emptyHistoricalProbeWorkspace(), revision: 1, records: [{ id: "existing-record-retained" }] } }), b = client(ownerB);
    const report = await runHostedHistoryAccessChecks({ clients: [a.instance, b.instance], identities: [ownerA, ownerB], negativeWrites: true });
    expect(report.negativeWriteStatus).toBe("skipped_nonempty_history"); expect(report.results.some(result => result.skipped && result.passed === null)).toBe(true);
    expect([...a.calls, ...b.calls].some(call => call.name === "edgelab_save_history")).toBe(false);
  });
  it("stops immediately on an unexpectedly accepted save instead of cleaning or claiming success", async () => {
    const a = client(ownerA, { unexpectedSave: true }), b = client(ownerB);
    await expect(runHostedHistoryAccessChecks({ clients: [a.instance, b.instance], identities: [ownerA, ownerB], negativeWrites: true })).rejects.toThrow("unexpectedly succeeded");
    expect(a.calls.filter(call => call.name === "edgelab_save_history")).toHaveLength(1); expect([...a.calls, ...b.calls].some(call => call.type === "delete")).toBe(false);
  });
  it("does not claim isolation when any cross-owner rows are visible", async () => {
    const a = client(ownerA, { crossRows: true }), b = client(ownerB);
    await expect(runHostedHistoryAccessChecks({ clients: [a.instance, b.instance], identities: [ownerA, ownerB] })).rejects.toThrow();
  });
  it("refuses to continue if deployed validators unexpectedly accept synthetic classifications", async () => {
    const a = client(ownerA, { syntheticValidatorAccepts: true }), b = client(ownerB);
    await expect(runHostedHistoryAccessChecks({ clients: [a.instance, b.instance], identities: [ownerA, ownerB], negativeWrites: true })).rejects.toThrow();
    expect([...a.calls, ...b.calls].some(call => call.name === "edgelab_save_history")).toBe(false);
  });
  it("requires two distinct normal identity contexts", async () => {
    const a = client(ownerA);
    await expect(runHostedHistoryAccessChecks({ clients: [a.instance, a.instance], identities: [ownerA, ownerA] })).rejects.toThrow();
  });
  it("tests anonymous table and RPC execution denial without privileged access", async () => {
    const anonymous = client("", { anonymous: true }); const report = await runAnonymousHistoryChecks(anonymous.instance, ownerA);
    expect(report).toHaveLength(2); expect(report.every(result => result.passed)).toBe(true);
    expect(anonymous.calls.filter(call => call.type === "table")).toHaveLength(6); expect(anonymous.calls.filter(call => call.type === "rpc")).toHaveLength(2);
  });
  it("does not pass anonymous checks for unexpected table access", async () => {
    const anonymous = client(""); await expect(runAnonymousHistoryChecks(anonymous.instance, ownerA)).rejects.toThrow();
  });
});
