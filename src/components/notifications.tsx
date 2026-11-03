"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  BellRing,
  CheckCheck,
  Clock3,
  FlaskConical,
  Search,
  X,
} from "lucide-react";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import { ResearchDetail } from "./research";
import { SportBadge, StrategyBadge, SimulationNote } from "./shared";
import { cn, dateTime, freshness } from "@/lib/utils";
export function Notifications() {
  const { data, mode, markRead, dismiss, testNotification, notify } = useApp();
  const params = useSearchParams();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(params.get("detail"));
  const [testing, setTesting] = useState(false);
  const unread = data.notifications.filter(
    (n) => !n.readAt && !n.dismissedAt,
  ).length;
  const items = data.notifications.filter(
    (n) =>
      (tab === "dismissed"
        ? !!n.dismissedAt
        : !n.dismissedAt && (tab !== "unread" || !n.readAt)) &&
      `${n.title} ${n.message}`.toLowerCase().includes(query.toLowerCase()),
  );
  const safe = (operation: Promise<void>) =>
    void operation.catch((error) =>
      notify(
        error instanceof Error
          ? error.message
          : "Could not update notification",
      ),
    );
  const test = async () => {
    setTesting(true);
    try {
      await testNotification();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="section-kicker mb-2">Stay close to your research</div>
          <h1 className="page-heading">Notification centre</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {unread} unread alerts · Review the source before recording a
            decision.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!unread}
            onClick={() => safe(markRead())}
          >
            <CheckCheck />
            Mark all read
          </Button>
          <Button
            disabled={mode !== "demo" || testing}
            onClick={() => void test()}
          >
            <BellRing />
            {testing ? "Creating…" : "Test Notification"}
          </Button>
        </div>
      </div>
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex gap-1">
            {[
              ["all", "History"],
              ["unread", `Unread (${unread})`],
              ["dismissed", "Dismissed"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                aria-pressed={tab === value}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs",
                  tab === value
                    ? "bg-[#24382c] text-primary"
                    : "text-muted-foreground hover:bg-white/3",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
            <input
              aria-label="Search notifications"
              className="input pl-9"
              placeholder="Search notification history…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {items.length ? (
          items.map((n) => {
            const c = data.candidates.find((c) => c.id === n.candidateId);
            return (
              <article
                key={n.id}
                className={cn(
                  "flex gap-4 border-b border-border/60 p-5 last:border-0",
                  !n.readAt && !n.dismissedAt && "bg-primary/[.018]",
                )}
              >
                <div
                  className={cn(
                    "mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl border",
                    n.readAt
                      ? "border-border text-muted-foreground"
                      : "border-primary/20 bg-primary/5 text-primary",
                  )}
                >
                  <Bell className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xs font-medium">{n.title}</h2>
                    {!n.readAt && !n.dismissedAt && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                    {n.simulated && (
                      <span className="rounded border border-amber-200/15 px-1.5 py-0.5 text-[8px] tracking-wide text-amber-200/60">
                        SIMULATED
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {n.message}
                  </p>
                  {c && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <SportBadge sport={c.sport} />
                      <StrategyBadge strategy={c.strategy} />
                      <span className="text-[10px] text-muted-foreground">
                        {c.event} · {c.market}
                      </span>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground">
                      <span>{dateTime(n.createdAt)}</span>
                      {c && (
                        <span className="flex items-center gap-1">
                          <Clock3 className="size-3" />
                          Source: {freshness(c.oddsProvenance.timestamp)}
                        </span>
                      )}
                      {n.dismissedAt && (
                        <span>Dismissed {dateTime(n.dismissedAt)}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!n.readAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => safe(markRead(n.id))}
                        >
                          Mark read
                        </Button>
                      )}
                      {c && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(c.id);
                            safe(markRead(n.id));
                          }}
                        >
                          Research details
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                {!n.dismissedAt && (
                  <button
                    aria-label={`Dismiss ${n.title}`}
                    onClick={() => safe(dismiss(n.id))}
                    className="h-7 rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </article>
            );
          })
        ) : (
          <div className="empty-state min-h-72">
            <Bell className="mb-2 size-7 text-muted-foreground" />
            <p>
              {tab === "unread"
                ? "You’re all caught up."
                : "No notifications in this view."}
            </p>
            <p className="text-[11px]">
              {mode === "demo"
                ? "Run Daily Research or create a test notification to try the workflow."
                : "Live research notifications are not connected."}
            </p>
          </div>
        )}
      </div>
      <div className="panel flex items-start gap-3 p-4">
        <FlaskConical className="size-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs">
            In-app delivery is active while you use EdgeLab.
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            No scheduled research or background push is configured. Optional
            browser notifications are limited to test alerts while this site is
            open and permission is granted.
          </p>
        </div>
      </div>
      {mode === "demo" && <SimulationNote />}
      <ResearchDetail
        candidate={data.candidates.find((c) => c.id === selected)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
