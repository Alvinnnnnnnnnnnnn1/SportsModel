import { describe, expect, it } from 'vitest';
import { createEmptyData } from '@/lib/domain/fixtures';
import { addPaperResultReminder, paperReminderRecordId } from '@/lib/notifications/paper-reminders';
import { parseHistoricalSource, prepareImportCommit } from '@/lib/imports';
import type { HistoricalPaperResult } from '@/lib/imports/types';
async function source(kind: 'paper'|'actual'|null = 'paper') {
  const preview=await parseHistoricalSource({ text:JSON.stringify([{kind,event:'SYNTHETIC reminder fixture',sport:'NBA',participant:'SYNTHETIC player',market:'Points',selection:'Over',line:'18.5',outcome:'pending',verification:'synthetic'}]),format:'json',sourceName:'synthetic-reminder.json',verification:'synthetic' });
  return prepareImportCommit(preview,[{rowNumber:1,include:true,allowProbableDuplicate:false,acknowledgeIncomplete:true}],'synthetic').records[0];
}
describe('source-linked paper result reminders',()=>{
  it('creates a synthetic reminder without changing forecasts or financial collections',async()=>{
    const data=createEmptyData();const record=await source(); const frozen=structuredClone(record);
    const next=addPaperResultReminder(data,record,undefined,'demo');
    expect(next.notifications).toHaveLength(1);expect(next.notifications[0].simulated).toBe(true);
    expect(paperReminderRecordId(next.notifications[0])).toBe(record.id);
    expect(next.bets).toBe(data.bets);expect(next.transactions).toBe(data.transactions);expect(next.paperPredictions).toBe(data.paperPredictions);expect(record).toEqual(frozen);
  });
  it('reuses one reminder identity even after read and dismissal without resetting history',async()=>{
    const data=createEmptyData(),record=await source();const first=addPaperResultReminder(data,record,undefined,'demo');
    first.notifications[0].readAt='2026-11-04T00:00:00Z';first.notifications[0].dismissedAt='2026-11-04T00:01:00Z';
    expect(addPaperResultReminder(first,record,undefined,'demo')).toBe(first);expect(first.notifications).toHaveLength(1);
  });
  it('rejects settled results, actual records and unregistered unknown kinds',async()=>{
    const data=createEmptyData(),paper=await source();paper.snapshot.outcome='won';
    expect(()=>addPaperResultReminder(data,paper,undefined,'demo')).toThrow('already settled');
    expect(()=>addPaperResultReminder(data,{...paper,snapshot:{...paper.snapshot,outcome:'pending'}},{recordId:paper.id,outcome:'lost'} as HistoricalPaperResult,'demo')).toThrow('already settled');
    expect(()=>addPaperResultReminder(data,{...paper,snapshot:{...paper.snapshot,kind:'actual'}},undefined,'demo')).toThrow('Only registered paper');
    expect(()=>addPaperResultReminder(data,{...paper,snapshot:{...paper.snapshot,kind:null}},undefined,'demo')).toThrow('Only registered paper');
  });
  it('allows an explicitly registered unknown kind and labels unknown results as unresolved only',async()=>{
    const record=await source(null);record.snapshot.outcome=null;
    const result={recordId:record.id,outcome:'pending'} as HistoricalPaperResult;
    const next=addPaperResultReminder(createEmptyData(),record,result,'demo');expect(next.notifications[0].message).toContain('does not settle');expect(record.snapshot.kind).toBeNull();
  });
  it('preserves demo/private separation and rejects conflicting notification identities',async()=>{
    const record=await source(),data=createEmptyData();
    expect(()=>addPaperResultReminder(data,record,undefined,'supabase')).toThrow('own workspace');
    const privateRecord={...record,snapshot:{...record.snapshot,verification:'user_confirmed' as const}};
    expect(()=>addPaperResultReminder(data,privateRecord,undefined,'demo')).toThrow('own workspace');
    expect(addPaperResultReminder(data,privateRecord,undefined,'supabase').notifications[0].simulated).toBe(false);
    const first=addPaperResultReminder(data,record,undefined,'demo');first.notifications[0].message='Unrelated message';
    expect(()=>addPaperResultReminder(first,record,undefined,'demo')).toThrow('identity conflict');
  });
});
