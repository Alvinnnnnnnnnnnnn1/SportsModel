"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState,type ReactNode} from "react";
import {Activity,Bell,ChartNoAxesCombined,ChevronRight,LayoutDashboard,ListChecks,Menu,Radar,Settings2,BookOpen,FileUp,ShieldCheck} from "lucide-react";
import {useApp} from "./app-provider";
import {useHistory} from "./history-provider";
import {Button} from "./ui/button";
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogTrigger} from "./ui/dialog";
import {cn} from "@/lib/utils";
const primaryNavigation=[
 {href:"/v6",label:"Dashboard",icon:LayoutDashboard},
 {href:"/v6/research",label:"Research",icon:Radar},
 {href:"/v6/positions",label:"Paper Ledger",icon:ListChecks},
 {href:"/v6/models",label:"Model Analytics",icon:ChartNoAxesCombined},
];
const legacyNavigation=[
 {href:"/",label:"Overview",icon:LayoutDashboard},
 {href:"/ledger",label:"Betting Ledger",icon:BookOpen},
 {href:"/research",label:"Research Inbox",icon:Radar},
 {href:"/paper",label:"Paper Tracking",icon:ListChecks},
 {href:"/analytics",label:"Analytics",icon:ChartNoAxesCombined},
 {href:"/imports",label:"Historical Import",icon:FileUp},
];
export function Logo(){return <div className="flex items-center gap-2.5"><Activity className="size-5 text-primary" aria-hidden="true"/><span className="text-xl font-semibold tracking-tight">edge<span className="font-normal text-primary">lab</span></span></div>;}
function Sidebar({pathname,close}:{pathname:string;close:()=>void}){
 const isLegacy=!pathname.startsWith('/v6');
 const item=({href,label,icon:Icon}:typeof primaryNavigation[number])=><Link key={href} href={href} onClick={close} aria-current={pathname===href?'page':undefined} className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",pathname===href?"bg-primary/10 font-medium text-primary":"text-muted-foreground hover:bg-secondary hover:text-foreground")}><Icon className="size-4" strokeWidth={1.7} aria-hidden="true"/>{label}</Link>;
 return <div className="flex h-full flex-col overflow-y-auto px-4 py-6"><Link href="/v6" onClick={close} aria-label="EdgeLab home" className="mb-9 mr-8 px-3"><Logo/></Link>
 <p className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[.16em] text-muted-foreground">Paper experiment</p>
 <nav aria-label="Primary navigation" className="space-y-1">{primaryNavigation.map(item)}</nav>
 <nav aria-label="System navigation" className="mt-3 border-t border-border pt-3">{item({href:'/v6/health',label:'System Status',icon:ShieldCheck})}</nav>
 <details key={isLegacy?'legacy':'v6'} open={isLegacy} className="group mt-7"><summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Legacy V5<ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden="true"/></summary><p className="px-3 pb-2 pt-1 text-[11px] leading-relaxed text-muted-foreground">Original experiment and real-money records.</p><nav aria-label="Legacy V5 navigation" className="space-y-1">{legacyNavigation.map(item)}</nav></details>
 <nav aria-label="Account navigation" className="mt-auto border-t border-border pt-4">{item({href:'/settings',label:'Account settings',icon:Settings2})}</nav></div>;
}
export function Shell({children}:{children:ReactNode}){
 const pathname=usePathname(),[open,setOpen]=useState(false);
 const {mode,data,loading,error,user,reload}=useApp(),{history}=useHistory();
 const unread=data.notifications.filter(n=>!n.readAt&&!n.dismissedAt).length+history.notifications.filter(n=>!n.readAt&&!n.dismissedAt).length;
 const current=[...primaryNavigation,...legacyNavigation,{href:'/v6/health',label:'System Status'},{href:'/settings',label:'Account settings'},{href:'/notifications',label:'Notifications'}].find(n=>n.href===pathname)?.label??'Workspace';
 return (<div className="min-h-screen"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:p-3 focus:text-primary-foreground">Skip to content</a>
 <aside className="fixed inset-y-0 left-0 z-40 hidden w-[224px] border-r border-border bg-[#101512] lg:block"><Sidebar pathname={pathname} close={()=>setOpen(false)}/></aside>
 <div className="lg:ml-[224px]"><header className="flex h-16 items-center justify-between gap-3 border-b border-border px-5 md:px-8"><div className="flex min-w-0 items-center gap-3">
 <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Toggle navigation"><Menu/></Button></DialogTrigger><DialogContent className="inset-y-0 left-0 top-0 h-dvh max-h-dvh w-[264px] max-w-[calc(100vw-2rem)] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0"><DialogTitle className="sr-only">Navigation</DialogTitle><DialogDescription className="sr-only">Paper experiment and Legacy V5 navigation</DialogDescription><Sidebar pathname={pathname} close={()=>setOpen(false)}/></DialogContent></Dialog>
 <span className="truncate text-sm text-muted-foreground">{current}</span></div><div className="flex shrink-0 items-center gap-3"><span className="hidden text-[10px] text-muted-foreground xl:block">AUD · Australia/Melbourne</span><span title={mode==='demo'?'V5 demo data is entirely synthetic':'Authenticated private workspace'} className={cn("rounded-md border px-2 py-1 text-[9px] font-medium tracking-wide",mode==='demo'?'border-amber-300/20 text-amber-200':'border-border text-muted-foreground')}>{mode==='demo'?'DEMO MODE':'PRIVATE WORKSPACE'}</span><Link href="/notifications" aria-label={`${unread} unread notifications`} className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Bell className="size-4"/>{unread>0&&<span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">{unread}</span>}</Link></div></header>
 <main id="main-content" className="mx-auto max-w-[1680px] px-5 py-7 md:px-8 md:py-8">
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
            pathname !== "/settings" &&
            !pathname.startsWith("/v6") && (
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
      </div>
    </div>
  );
}
