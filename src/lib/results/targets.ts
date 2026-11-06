import type { AppData, Bet, PaperPrediction } from '@/lib/domain/types';
import type { HistoricalWorkspace, HistoricalRecord } from '@/lib/imports/types';
import { sha256 } from '@/lib/imports/duplicates';
import { isHistoricalReviewRecord } from '@/lib/imports/review-status';
import { researchSessionMetadata } from '@/lib/handoff/response';
import { researchCandidateSchema } from '@/lib/handoff/contract';
import { readResearchRecordLink } from '@/lib/daily/placement';
import { settlementTargetKey, type SettlementTarget, type SettlementTargetLeg, type SettlementEvidence } from './contract';

const localDate=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function evidenceFrom(value:unknown):SettlementEvidence|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const evidence=(value as Record<string,unknown>).settlementEvidence;
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return null;
  const e=evidence as SettlementEvidence;
  return e.format==='edgelab.settlement-evidence'&&e.version===1&&typeof e.responseId==='string'&&typeof e.responseHash==='string'&&typeof e.targetKey==='string'?e:null;
}
export function collectedSettlementEvidence(data:AppData,history:HistoricalWorkspace):SettlementEvidence[] {
  return [...data.audit.map(a=>evidenceFrom(a.after)),...history.records.map(r=>evidenceFrom(r.raw))].filter((v):v is SettlementEvidence=>v!==null);
}
function context(record:HistoricalRecord|undefined){const meta=record?researchSessionMetadata(record):null;return{sourceReference:record?.snapshot.sourceReference??null,researchDay:meta?.researchDay??null,sessionId:meta?.responseId??null};}
const one=<T>(values:T[])=>values.length&&values.every(value=>value===values[0])?values[0]:null;

export async function buildSettlementTargets(data:AppData,history:HistoricalWorkspace):Promise<SettlementTarget[]> {
  const targets:SettlementTarget[]=[];const evidence=collectedSettlementEvidence(data,history);
  const add=async(target:Omit<SettlementTarget,'identityHash'|'previousEvidence'>,original:unknown)=>{
    targets.push({...target,identityHash:await sha256(JSON.stringify(original)),previousEvidence:evidence.filter(e=>e.targetKey===target.key)});
  };
  for(const bet of data.bets){
    const candidate=data.candidates.find(c=>c.id===bet.candidateId)??data.paperPredictions.find(p=>p.candidate.id===bet.candidateId)?.candidate;
    const linkedRecordId=readResearchRecordLink(bet.notes);
    const record=history.records.find(r=>r.id===linkedRecordId||r.id===bet.candidateId||r.id===bet.id);
    const raw=record?researchCandidateSchema.safeParse(record.raw):null;
    const sameCoreFixture=candidate&&bet.legs.every(leg=>leg.event===candidate.event&&leg.sport===candidate.sport);
    const sameImportedFixture=raw?.success&&bet.legs.every(leg=>leg.event===raw.data.event&&leg.sport===raw.data.sport);
    const startsAt=sameCoreFixture?candidate.startsAt:sameImportedFixture?raw.data.startsAt:null;
    const legs:SettlementTargetLeg[]=bet.legs.map(leg=>({legId:leg.id,sport:leg.sport,event:leg.event,participant:leg.participant,market:leg.market,selection:leg.selection,line:leg.line,odds:leg.odds}));
    if (bet.lifecycle === "provisional" || bet.lifecycle === "entered_in_error" || bet.lifecycle === "superseded" || bet.accountingExcluded) continue;
    await add({key:settlementTargetKey('actual',bet.id),kind:'actual',recordId:bet.id,eligible:true,exclusionReason:null,settled:bet.outcome!=='pending',currentOutcome:bet.outcome,sport:one(bet.legs.map(l=>l.sport)),event:one(bet.legs.map(l=>l.event)),eventDate:startsAt?localDate(startsAt):null,startsAt,participant:one(bet.legs.map(l=>l.participant)),market:one(bet.legs.map(l=>l.market)),selection:bet.legs.map(l=>l.selection).join(' + '),line:one(bet.legs.map(l=>l.line)),legs,odds:bet.odds,originalOdds:candidate?.odds??record?.snapshot.odds??null,acceptedOdds:bet.odds,stakeCents:bet.stakeCents,stakeType:bet.stakeType,probability:bet.probability??null,probabilityProvenance:bet.probabilityProvenance??null,...context(record),sourceReference:record?.snapshot.sourceReference??candidate?.oddsProvenance.source??bet.oddsProvenance?.source??null,registeredAt:bet.placedAt ?? bet.recordedAt ?? new Date().toISOString()},bet);
  }
  for(const paper of data.paperPredictions){
    if (paper.lifecycle === "provisional" || paper.lifecycle === "entered_in_error" || paper.lifecycle === "superseded" || paper.accountingExcluded) continue;
    const c=paper.candidate;const prereg=Date.parse(paper.registeredAt)<Date.parse(c.startsAt);
    await add({key:settlementTargetKey('paper',paper.id),kind:'paper',recordId:paper.id,eligible:prereg,exclusionReason:prereg?null:'Original pre-event paper registration cannot be established.',settled:paper.outcome!=='pending',currentOutcome:paper.outcome,sport:c.sport,event:c.event,eventDate:localDate(c.startsAt),startsAt:c.startsAt,participant:c.participant,market:c.market,selection:c.selection,line:c.line,legs:[{legId:c.id,sport:c.sport,event:c.event,participant:c.participant,market:c.market,selection:c.selection,line:c.line,odds:c.odds}],odds:c.odds,originalOdds:c.odds,acceptedOdds:null,stakeCents:paper.hypotheticalStakeCents,stakeType:'cash',probability:c.probability??null,probabilityProvenance:c.probabilityProvenance??null,sourceReference:c.oddsProvenance.source,researchDay:null,sessionId:null,registeredAt:paper.registeredAt},paper);
  }
  for(const result of history.paperResults){
    const record=history.records.find(r=>r.id===result.recordId);if(!record||record.snapshot.kind==='actual')continue;
    const s=record.snapshot,raw=researchCandidateSchema.safeParse(record.raw);
    const startsAt=raw.success?raw.data.startsAt:null;
    const registration=history.audit.find(audit=>audit.recordId===record.id&&audit.action==='paper_registered');
    const prereg=!!s.predictionAt&&!!startsAt&&!!registration&&Date.parse(s.predictionAt)<Date.parse(startsAt)&&Date.parse(record.importedAt)<Date.parse(startsAt)&&Date.parse(registration.timestamp)<Date.parse(startsAt)&&!isHistoricalReviewRecord(record);
    await add({key:settlementTargetKey('historical_paper',record.id),kind:'historical_paper',recordId:record.id,eligible:prereg,exclusionReason:prereg?null:'Historical review evidence has no qualifying pre-event registration. It remains outside the daily settlement batch.',settled:result.outcome!=='pending',currentOutcome:result.outcome,sport:s.sport,event:s.event,eventDate:startsAt?localDate(startsAt):null,startsAt,participant:s.participant,market:s.market,selection:s.selection,line:s.line,legs:s.legs.map(l=>({legId:l.id,sport:l.sport,event:l.event,participant:l.participant,market:l.market,selection:l.selection,line:l.line,odds:l.odds})),odds:s.odds,originalOdds:s.odds,acceptedOdds:null,stakeCents:s.stakeCents,stakeType:s.stakeType,probability:s.probability,probabilityProvenance:{source:s.probabilitySource,method:s.probabilityMethod,modelVersion:s.modelVersion,timestamp:s.predictionAt},...context(record),registeredAt:registration?.timestamp??record.importedAt}, {record:record.snapshot,registrationAt:registration?.timestamp??record.importedAt,result});
  }
  return targets;
}

export function historicalSettlementExclusions(data:AppData,history:HistoricalWorkspace) {
  return history.records.filter(record=>record.snapshot.kind==='actual'&&!data.bets.some(b=>b.id===record.id)).map(record=>({recordId:record.id,reason:'Archived historical actual claim only: it is not financially registered and cannot be settled through the daily queue.'}));
}
export function targetCurrentRecord(target:SettlementTarget,data:AppData,history:HistoricalWorkspace):Bet|PaperPrediction|HistoricalWorkspace['paperResults'][number]|null {
  return target.kind==='actual'?data.bets.find(v=>v.id===target.recordId)??null:target.kind==='paper'?data.paperPredictions.find(v=>v.id===target.recordId)??null:history.paperResults.find(v=>v.recordId===target.recordId)??null;
}
