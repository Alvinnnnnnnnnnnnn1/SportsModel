import { Suspense } from 'react';
import { HistoryPage } from '@/components/imports/history-page';
export default function Page() { return <Suspense fallback={<p className="text-xs text-muted-foreground">Loading historical research…</p>}><HistoryPage /></Suspense>; }
