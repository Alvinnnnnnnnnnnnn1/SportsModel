'use client';
import type { ImportPreviewRow } from '@/lib/imports/types';
import { reviewWarningsForRow } from '@/lib/imports/review-warnings';
import { previewFinancialReview } from '@/lib/imports/calculations';
export function ReviewWarnings({row,compact=false}:{row:ImportPreviewRow;compact?:boolean}){
 const {groups}=reviewWarningsForRow(row);
 const archiveErrors=row.issues.filter(issue=>issue.severity==='error');
 const exact=row.duplicates.filter(duplicate=>duplicate.level==='exact');
 const financial=previewFinancialReview(row);
 const archiveBlocked=archiveErrors.length>0||exact.length>0;
 const content=<div className="space-y-3">
  {archiveBlocked&&<div><h4 className="text-[11px] font-medium text-red-300">Archive import blocked</h4>{archiveErrors.map((issue,i)=><p key={i} className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">{issue.field}: {issue.message}</p>)}{exact.map((duplicate,i)=><p key={`duplicate:${i}`} className="mt-1 text-[10px] text-muted-foreground">EXACT duplicate: {duplicate.reason}</p>)}</div>}
  {!!financial?.issues.length&&<div><h4 className="text-[11px] font-medium text-amber-200">Financial registration unavailable ({financial.issues.length})</h4><p className="mt-1 text-[10px] text-muted-foreground">These requirements do not prevent preserving an otherwise valid record in the archive.</p>{financial.issues.map((issue,i)=><p key={i} className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">{issue.field}: {issue.message}</p>)}</div>}
  {groups.requires_review.length>0&&<div><h4 className="text-[11px] font-medium text-amber-200">Requires review ({groups.requires_review.length})</h4>{groups.requires_review.map((item,i)=><p key={i} className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">{item.issue.field}: {item.issue.message}</p>)}</div>}
  {groups.informational.length>0&&<div><h4 className="text-[11px] font-medium text-muted-foreground">Optional metadata ({groups.informational.length})</h4>{groups.informational.map((item,i)=><p key={i} className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">{item.issue.field}: {item.issue.message}</p>)}</div>}
 </div>;
 return compact?<><p className={`text-[10px] ${archiveBlocked?'text-red-300':'text-muted-foreground'}`}>{archiveBlocked?(exact.length?'Already saved or repeated · import blocked':archiveErrors[0]?.message):financial?.issues.length?'Archive eligible · financial evidence incomplete':'Archive eligible · review source evidence'}</p><details className="mt-2 rounded border border-border p-2"><summary className="cursor-pointer text-[10px]">View {row.issues.length+row.duplicates.length} source flags{financial?.issues.length?' and financial requirements':''}</summary><div className="mt-3">{content}</div></details></>:content;
}
