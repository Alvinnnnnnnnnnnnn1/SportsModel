"use client";

import { useMemo } from "react";
import { useApp } from "../app-provider";
import { useHistory } from "../history-provider";
import { buildReconciliationPreview, historicalAccountingCheckpoint } from "@/lib/reconciliation/checkpoint";
import { money } from "@/lib/utils";

export function ReconciliationPreview() {
  const { data } = useApp();
  const { history } = useHistory();
  const rows = useMemo(() => buildReconciliationPreview(data, history), [data, history]);
  const actual = rows.filter((row) => row.source.category === "actual");
  const paper = rows.filter((row) => row.source.category !== "actual");
  const matched = rows.filter((row) => row.duplicateStatus !== "no_match").length;

  return (
    <section className="panel overflow-hidden" aria-label="Historical reconciliation preview">
      <div className="border-b border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Historical experiment reconciliation</h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
              Read-only preview for the supplied A01–A12 and 34 paper/proposal register. Matching uses exact IDs and existing source references only.
            </p>
          </div>
          <span className="rounded-full border border-amber-200/20 bg-amber-200/5 px-3 py-1 text-[10px] text-amber-100">No records changed</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="Actual claims" value={`${actual.length}/12`} />
          <Metric label="Paper / proposals" value={`${paper.length}/34`} />
          <Metric label="Exact or candidate matches" value={`${matched}`} />
          <Metric label="Unmatched actions" value={`${rows.length - matched}`} />
        </div>
      </div>
      <details className="border-b border-border p-5">
        <summary className="cursor-pointer text-xs font-medium">A01–A06 owner-reported accounting checkpoint</summary>
        <div className="mt-4 grid gap-3 text-[11px] sm:grid-cols-3">
          <Metric label="Cash stakes" value={money(historicalAccountingCheckpoint.cashStakeCents)} />
          <Metric label="Bonus stake" value={money(historicalAccountingCheckpoint.bonusStakeCents)} />
          <Metric label="Reported net" value={money(historicalAccountingCheckpoint.reportedNetCents)} />
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          This is owner-reported source arithmetic, not a verified sportsbook balance or a hosted financial mutation. A07–A12 have no invented payouts.
        </p>
      </details>
      <div className="table-wrap max-h-[34rem] overflow-auto">
        <table className="data-table">
          <thead><tr><th>Source ID</th><th>Selection</th><th>Type</th><th>Match</th><th>Action</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.source.sourceId}>
              <td className="font-mono text-[10px]">{row.source.sourceId}</td>
              <td><p>{row.source.selection}</p><p className="mt-1 text-[10px] text-muted-foreground">{row.source.event ?? row.source.sport}</p></td>
              <td>{row.source.category}</td>
              <td>{row.duplicateStatus === "no_match" ? "No exact match" : `${row.existingStatus} · ${row.existingRecordId}`}</td>
              <td><span className="text-[10px]">{row.action.replaceAll("_", " ")}</span><p className="mt-1 max-w-xs text-[9px] text-muted-foreground">{row.reason}</p></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-background/30 p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}
