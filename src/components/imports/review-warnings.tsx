'use client';
import type { ImportPreviewRow } from '@/lib/imports/types';
import { reviewWarningsForRow,REVIEW_WARNING_LABELS } from '@/lib/imports/review-warnings';
export function ReviewWarnings({row,compact=false}:{row:ImportPreviewRow;compact?:boolean}){
 const {groups}=reviewWarningsForRow(row);
 const content=<div className="space-y-3">{(Object.keys(groups) as (keyof typeof groups)[]).map(key=>groups[key].length>0&&<div key={key}><h4 className={key==='blocking'?'text-[11px] font-medium text-red-300':key==='requires_review'?'text-[11px] font-medium text-amber-200':'text-[11px] font-medium text-muted-foreground'}>{REVIEW_WARNING_LABELS[key]} ({groups[key].length})</h4>{groups[key].map((item,i)=><p key={i} className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">{item.issue.field}: {item.issue.message}</p>)}</div>)}</div>;
 return compact?<><div className="space-y-1">{row.duplicates.map((d,i)=><p key={i} className="text-[10px] text-amber-200">{d.level.toUpperCase()} duplicate: {d.reason}</p>)}</div><details className="mt-2 rounded border border-border p-2"><summary className="cursor-pointer text-[10px]">{groups.blocking.length} blocking · {groups.requires_review.length} requires review · {groups.informational.length} informational</summary><div className="mt-3">{content}</div></details></>:content;
}
