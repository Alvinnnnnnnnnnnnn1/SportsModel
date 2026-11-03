"use client";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleHelp,
  FlaskConical,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import type { Outcome, Sport, Strategy } from "@/lib/domain/types";
export function SportBadge({ sport }: { sport: Sport | string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded border px-1.5 py-1 text-[9px] font-semibold tracking-wide",
        {
          NBA: "border-orange-300/15 bg-orange-300/5 text-orange-200/80",
          NBL: "border-blue-300/15 bg-blue-300/5 text-blue-200/80",
          ATP: "border-lime-300/15 bg-lime-300/5 text-lime-200/80",
          WTA: "border-violet-300/15 bg-violet-300/5 text-violet-200/80",
        }[sport] ?? "border-border text-muted-foreground",
      )}
    >
      {sport}
    </span>
  );
}
export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <Badge
      className={cn(
        "gap-1.5 capitalize",
        {
          won: "border-emerald-400/10 bg-emerald-400/5 text-emerald-300",
          lost: "border-red-300/10 bg-red-300/5 text-red-300",
          pending: "border-amber-300/10 bg-amber-300/5 text-amber-200/80",
          void: "text-muted-foreground",
        }[outcome],
      )}
    >
      <span className="size-1 rounded-full bg-current" />
      {outcome}
    </Badge>
  );
}
export function StrategyBadge({ strategy }: { strategy: Strategy }) {
  return (
    <Badge className="border-[#3c4b3f] bg-[#1b281f] text-[#a7c1ac]">
      TRACK {strategy}
    </Badge>
  );
}
export function SimulationNote({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-[#c4af75]" />
      <span>
        {children ??
          "Synthetic fixture data. These estimates are illustrative and do not demonstrate a statistical advantage."}
      </span>
    </div>
  );
}
export function StatCard({
  title,
  value,
  detail,
  icon,
  positive,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  positive?: boolean;
}) {
  return (
    <div className="panel min-w-0 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{title}</span>
        <span className="text-[#6e8475]">{icon}</span>
      </div>
      <div
        className={cn(
          "tabular text-[27px] font-medium tracking-[-1px]",
          positive === true && "text-primary",
          positive === false && "text-red-300",
        )}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        {positive === true ? (
          <ArrowUpRight className="size-3 text-primary" />
        ) : positive === false ? (
          <ArrowDownRight className="size-3 text-red-300" />
        ) : (
          <CircleHelp className="size-3" />
        )}
        {detail}
      </div>
    </div>
  );
}
