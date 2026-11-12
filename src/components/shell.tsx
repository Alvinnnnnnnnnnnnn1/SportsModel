"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Menu,
  Radar,
  Settings2,
  ShieldCheck,
  X,
  BookOpen,
  CircleHelp,
  FileUp,
} from "lucide-react";
import { useApp } from "./app-provider";
import { useHistory } from "./history-provider";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
const navigation = [
  { href: "/v6", label: "EdgeLab V6", icon: Activity },
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/ledger", label: "Betting Ledger", icon: BookOpen },
  { href: "/research", label: "Research Inbox", icon: Radar },
  { href: "/paper", label: "Paper Tracking", icon: ListChecks },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/imports", label: "Historical Import", icon: FileUp },
  { href: "/settings", label: "Settings", icon: Settings2 },
];
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex size-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
        <Activity className="size-5 text-primary" />
      </div>
      <span className="text-[22px] font-semibold tracking-[-1px]">
        edge<span className="font-normal text-primary">lab</span>
      </span>
    </div>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { mode, data, loading, error, user, reload } = useApp();
  const { history } = useHistory();
  const unread = data.notifications.filter(
    (n) => !n.readAt && !n.dismissedAt,
  ).length + history.notifications.filter(n => !n.readAt && !n.dismissedAt).length;
  const current =
    navigation.find((item) => item.href === pathname || (item.href === "/v6" && pathname.startsWith("/v6/")))?.label ?? "Workspace";
  return (
    <div className="min-h-screen">
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col border-r border-border bg-[#101512] px-4 py-7 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link
          href="/"
          className="mb-9 px-3"
          onClick={() => setOpen(false)}
          aria-label="EdgeLab overview"
        >
          <Logo />
        </Link>
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-[#161e19] px-3 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#27372d] text-primary">
            <FlaskConical className="size-4" />
          </div>
          <div>
            <div className="text-xs font-medium">Personal workspace</div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Private research environment
            </div>
          </div>
          <ChevronRight className="ml-auto size-3 text-muted-foreground" />
        </div>
        <div className="section-kicker mb-3 px-3 text-[9px]">Workspace</div>
        <nav className="space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={(pathname === href || (href === "/v6" && pathname.startsWith("/v6/"))) ? "page" : undefined}
              className={cn(
                "group flex h-11 items-center gap-3 rounded-lg px-3 text-[12px] transition-colors",
                (pathname === href || (href === "/v6" && pathname.startsWith("/v6/")))
                  ? "bg-[#213429] text-primary"
                  : "text-[#96a399] hover:bg-white/4 hover:text-foreground",
              )}
            >
              <Icon className="size-[17px]" strokeWidth={1.7} />
              {label}
              {label === "Notifications" && unread > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-md bg-[#304b39] text-[10px] text-primary">
                  {unread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-10">
          <div className="rounded-xl border border-[#2e3c31] bg-gradient-to-br from-[#1e2c22] to-[#121a15] p-4">
            <ShieldCheck className="mb-3 size-5 text-primary" />
            <p className="text-xs font-medium">Research with discipline.</p>
            <p className="mt-2 text-[11px] leading-[1.7] text-muted-foreground">
              Track your process.
              <br />
              Understand your performance.
            </p>
            <Link
              href="/settings"
              className="mt-3 flex items-center gap-1 text-[11px] text-primary"
            >
              Your experiment settings <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <Link
            href="/settings"
            className="mt-5 flex items-center gap-2 px-3 text-[11px] text-muted-foreground"
          >
            <CircleHelp className="size-4" /> Workspace & data settings
          </Link>
          <div className="mt-5 flex items-center justify-between border-t border-border px-2 pt-5">
            <span className="text-[10px] text-muted-foreground">
              EDGELAB <span className="ml-1 text-[#536258]">v0.1</span>
            </span>
            <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" /> Local MVP
            </span>
          </div>
        </div>
      </aside>
      <div className="lg:ml-[236px]">
        <header className="flex h-[72px] items-center justify-between border-b border-border px-5 md:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(!open)}
              aria-label="Toggle navigation"
            >
              {open ? <X /> : <Menu />}
            </Button>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Workspace
            </span>
            <ChevronRight className="hidden size-3 text-[#566459] sm:block" />
            <span className="text-xs">{current}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-[10px] tracking-wide text-muted-foreground md:block">
              AUD <span className="mx-2 text-[#44534a]">/</span> MELBOURNE
            </span>
            <Link
              href="/notifications"
              aria-label={`${unread} unread notifications`}
              className="relative rounded-lg p-2 text-muted-foreground hover:bg-white/5"
            >
              <Bell className="size-[17px]" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary ring-2 ring-background" />
              )}
            </Link>
            <div className="h-6 border-l border-border" />
            <Link
              href="/settings"
              aria-label="Account settings"
              className="flex size-8 items-center justify-center rounded-full border border-[#41513f] bg-[#273125] text-[10px] font-medium text-[#c6d6bb]"
            >
              {user?.email?.slice(0, 2).toUpperCase() ?? "EL"}
            </Link>
          </div>
        </header>
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-b px-5 py-2.5 text-[10px] md:px-8",
            mode === "demo"
              ? "border-[#574a293d] bg-[#332b142b] text-[#c9b67c]"
              : "border-emerald-900/30 bg-emerald-950/20 text-emerald-300",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-[.12em]",
                mode === "demo"
                  ? "border-[#71603c] text-[#dfc480]"
                  : "border-primary/30",
              )}
            >
              {mode === "demo" ? "DEMO MODE" : "PRIVATE WORKSPACE"}
            </span>
            <span>
              {mode === "demo"
                ? "V5 demo sports data, forecasts and results are synthetic. Private V6 evidence requires sign-in."
                : "Authenticated data only. Live research providers are not connected."}
            </span>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-1 hover:underline"
          >
            {mode === "demo" ? "Manage workspace" : "Account settings"}
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <main className="mx-auto max-w-[1680px] px-5 py-7 md:px-8 md:py-8">
          {error && (
            <div
              role="alert"
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-200"
            >
              <span>Workspace unavailable: {error}</span>
              <Button variant="outline" size="sm" onClick={reload}>
                Retry load
              </Button>
            </div>
          )}
          {!loading &&
            mode === "supabase" &&
            !user &&
            pathname !== "/settings" && (
              <div className="panel mb-6 flex items-center justify-between gap-4 p-4 text-sm">
                <span>Sign in to load your private workspace.</span>
                <Button asChild size="sm">
                  <Link href="/settings">Sign in</Link>
                </Button>
              </div>
            )}
          {loading ? (
            <div
              role="status"
              aria-label="Loading workspace"
              className="animate-pulse space-y-6"
            >
              <div className="h-12 w-64 rounded-lg bg-secondary" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="panel h-32 bg-secondary/30" />
                ))}
              </div>
              <div className="panel h-80 bg-secondary/20" />
              <span className="sr-only">Loading workspace…</span>
            </div>
          ) : (
            <div className="page-enter">{children}</div>
          )}
        </main>
        <footer className="mx-5 mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[9px] text-[#63756a] md:mx-8">
          <span>EdgeLab · A considered approach to sports research.</span>
          <span>
            Research only · Manual tracking ·{" "}
            {mode === "demo" ? "Synthetic data" : "Private data"}
          </span>
        </footer>
      </div>
    </div>
  );
}
