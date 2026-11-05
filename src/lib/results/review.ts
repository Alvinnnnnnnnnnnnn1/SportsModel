import type { AppData, Mode, Bet, PaperPrediction } from '@/lib/domain/types';
import type { HistoricalWorkspace, HistoricalPaperResult } from '@/lib/imports/types';
import { sha256 } from '@/lib/imports/duplicates';
import { parseHistoricalSource } from '@/lib/imports/parser';
import { reviewLedgerEntry, readLedgerEvidence, writeLedgerEvidence } from '@/lib/domain/ledger-review';
import { multiplyMoney } from '@/lib/domain/calculations';
import { computeHypothetical } from '@/lib/imports/calculations';
import { buildSettlementTargets, collectedSettlementEvidence, targetCurrentRecord } from './targets';
import { settlementResponseSchema, settlementTargetKey, type SettlementResponse, type SettlementObservation, type SettlementReview, type SettlementReviewRow, type SettlementTarget, type SettlementEvidence, type SettlementLeg } from './contract';

export function parseSettlementResponse(text:string):SettlementResponse {
  if(new TextEncoder().encode(text).length>1048576)throw new Error('Results JSON is limited to 1 MiB.');
  let value:unknown;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('Results must be valid settlement-response JSON.');}
  return settlementResponseSchema.parse(value);
}
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical((value as Record<string,unknown>)[key])])):value;
const equal=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const dateMelbourne=(value:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);

export function observedLegClearance(leg:SettlementLeg):{legId:string;value:number|null;margin:number|null;method:string|null} {
  if(leg.observedValue===null||leg.line===null||!/^[-+]?\d+(?:\.\d+)?$/.test(leg.line.trim()))return{legId:leg.legId,value:leg.observedValue,margin:null,method:null};
  const threshold=Number(leg.line),selection=leg.selection??'';
  const under=/\bunder\b|\bless than\b/i.test(selection),over=/\bover\b|\bmore than\b|\bat[_ ]least\b|\bor more\b|\d\s*\+/i.test(selection);
  if(!under&&!over)return{legId:leg.legId,value:leg.observedValue,margin:null,method:null};
  return{legId:leg.legId,value:leg.observedValue,margin:under?threshold-leg.observedValue:leg.observedValue-threshold,method:under?'threshold minus observed statistic':'observed statistic minus threshold'};
}
function statistic(leg:SettlementLeg):string|null {
  const computed=observedLegClearance(leg);
  const parts=[leg.statistic,...(leg.observedValue===null?[]:[`Observed ${leg.observedValue}`]),...(computed.margin===null?[]:[`Clearance ${computed.margin}`])].filter(Boolean);
  return parts.length?parts.join(' · ').slice(0,500):null;
}
function overall(legs:SettlementLeg[]):'won'|'lost'|'void'|null {
  if(!legs.length||legs.some(leg=>leg.outcome===null))return null;
  return legs.some(leg=>leg.outcome==='lost')?'lost':legs.every(leg=>leg.outcome==='void')?'void':'won';
}
function rawReceiptRecord(data:AppData,evidence:SettlementEvidence):unknown {
  for(const audit of data.audit){
    const after=audit.after;
    if(after&&typeof after==='object'&&!Array.isArray(after)){
      const a=after as Record<string,unknown>,e=a.settlementEvidence as Partial<SettlementEvidence>|undefined;
      if(e?.format==='edgelab.settlement-evidence'&&e.responseHash===evidence.responseHash&&e.targetKey===evidence.targetKey)return a.record;
    }
  }
  return null;
}
function alreadyAppliedState(target:SettlementTarget,observation:SettlementObservation,evidence:SettlementEvidence,data:AppData,history:HistoricalWorkspace):boolean {
  const current=targetCurrentRecord(target,data,history);if(!current)return false;
  const receipt=rawReceiptRecord(data,evidence);
  if(receipt!==null)return equal(receipt,current);
  if(target.kind!=='historical_paper')return false;
  const result=current as HistoricalPaperResult;
  return result.outcome===observation.outcome&&!!result.settledAt&&!!observation.settledAt&&Date.parse(result.settledAt)===Date.parse(observation.settledAt)&&result.legs.length===observation.legs.length&&result.legs.every(leg=>{const expected=observation.legs.find(v=>v.legId===leg.legId);return expected&&expected.outcome===leg.outcome&&statistic(expected)===leg.statistic;});
}

/** Pure review only. It neither fetches a source nor writes a financial/paper record. */
export async function reviewSettlementResponse(input:{response:SettlementResponse;appData:AppData;history:HistoricalWorkspace;mode:Mode;now?:Date}):Promise<SettlementReview> {
  const response=settlementResponseSchema.parse(input.response),now=input.now??new Date();
  // Reuse source credential, Unicode, nesting and size guards for every retained observation.
  await parseHistoricalSource({text:JSON.stringify([{sourceDocument:response}]),sourceName:'settlement-response.json',format:'json',verification:input.mode==='demo'?'synthetic':'unverified'});
  const responseHash=await sha256(JSON.stringify(response));
  const targets=await buildSettlementTargets(input.appData,input.history),receipts=collectedSettlementEvidence(input.appData,input.history);
  const conflictingId=receipts.some(e=>e.responseId===response.id&&e.responseHash!==responseHash);
  const rows:SettlementReviewRow[]=response.observations.map(observation=>{
    const key=settlementTargetKey(observation.kind,observation.recordId),target=targets.find(item=>item.key===key)??null;
    const row:SettlementReviewRow={key,kind:observation.kind,recordId:observation.recordId,target,observation,eligible:false,alreadyApplied:false,issues:[],warnings:['Source links and owner attestation are provenance, not independent verification. Calculated returns are not independently confirmed bookmaker payouts.'],actualBet:null,corePaper:null,historicalPaper:null,expectedPayoutCents:null,hypotheticalProfitCents:null,legClearances:observation.legs.map(observedLegClearance)};
    const reject=(message:string)=>row.issues.push(message);
    if(conflictingId)reject('This response ID already identifies different saved evidence. Use a new response ID for a correction; do not replay changed evidence.');
    if(!target){reject('The exact position is not present in this authenticated workspace. Historical claims and unregistered proposals cannot be settled as registered positions.');return row;}
    const receipt=receipts.find(e=>e.responseHash===responseHash&&e.targetKey===key);
    if(receipt&&!conflictingId){
      if(alreadyAppliedState(target,observation,receipt,input.appData,input.history)){row.alreadyApplied=true;row.warnings=['This exact result is already saved. Repeated confirmation is a no-op.'];return row;}
      reject('This response was already applied and the current record has since changed. Review a new correction response rather than replaying an old result.');return row;
    }
    if(!target.eligible)reject(target.exclusionReason??'This position has no eligible original registration.');
    if(target.settled)reject('This position is already settled. Corrections require the existing individually audited record review; this pending-results batch does not overwrite a settlement.');
    if(observation.identityHash!==target.identityHash)reject('This position changed since the results prompt/review. Refresh the queue and use the current identity fingerprint.');
    if(observation.sport!==target.sport||observation.event!==target.event)reject('Sport or exact fixture identity does not match the registered position.');
    if(observation.eventDate===null)reject('Supply the exact event date from the result evidence. Placement date is not an event date.');
    if(target.eventDate!==null&&observation.eventDate!==target.eventDate)reject('Event date disagrees with the registered fixture date.');
    if(observation.eventDate&&observation.eventDate>dateMelbourne(now))reject('A future Melbourne event date cannot establish a finished event.');
    if(!observation.eventCompleted)reject('Event completion must be explicitly confirmed from the result evidence. Elapsed time alone is not a result.');
    if(!observation.termsConfirmed||!observation.termsReference?.trim())reject('Confirm the exact settlement terms and supply their reference or owner-attested description. Unknown Sportsbet rules cannot be inferred.');
    if(observation.outcome===null)reject('A proposed final outcome is still missing.');
    if(observation.settledAt===null)reject('Supply the original result/settlement timestamp; retrieval time is separate.');
    else {
      const at=Date.parse(observation.settledAt);
      if(at>now.getTime()+300000)reject('The settlement timestamp cannot be in the future.');
      if(at>Date.parse(response.createdAt)+300000)reject('The final settlement cannot postdate the response that reports it. Check the response creation timestamp.');
      if(at<Date.parse(target.registeredAt))reject('Settlement cannot precede the registered position.');
      if(target.startsAt&&at<Date.parse(target.startsAt))reject('A final result cannot precede the registered event start.');
    }
    if(Date.parse(response.createdAt)>now.getTime()+300000)reject('The response creation timestamp cannot be in the future.');
    if(observation.verification==='owner_attested'&&!observation.ownerAttested)reject('Owner-attested results require explicit owner attestation.');
    if(observation.verification==='source_supplied'&&!observation.sources.length)reject('Source-supplied results need an inspectable source URL and observation timestamp.');
    if(!observation.sources.length&&!observation.ownerAttested)reject('Provide inspectable result evidence or an explicit owner attestation; unsupported ChatGPT conclusions cannot be verified results.');
    for(const source of observation.sources){
      if(Date.parse(source.observedAt)>now.getTime()+300000)reject('A source observation timestamp cannot be in the future.');
      if(Date.parse(source.observedAt)>Date.parse(response.createdAt)+300000)reject('Source evidence cannot be observed after the response that reports it. Check its observation and response timestamps.');
      if(target.startsAt&&Date.parse(source.observedAt)<Date.parse(target.startsAt))reject('Result evidence observed before the registered event started cannot establish its final result.');
    }
    if(observation.specialCases.length&&(!observation.ownerAttested||!observation.specialCaseResolution?.trim()))reject('DNP, retirement, postponement, dead heats and ambiguous void/overtime cases need an explicit owner-attested rule resolution; otherwise leave them pending.');
    if(observation.legs.length!==target.legs.length||new Set(observation.legs.map(l=>l.legId)).size!==observation.legs.length)reject('Results must cover exactly the registered individual leg IDs, without additions or duplicates.');
    for(const leg of observation.legs){
      const original=target.legs.find(item=>item.legId===leg.legId);
      if(!original){reject('A result leg ID is not part of this registered position.');continue;}
      if(['sport','event','participant','market','selection','line'].some(field=>leg[field as keyof SettlementLeg]!==original[field as keyof typeof original]))reject(`Leg ${leg.legId}: exact event, participant, market, selection or threshold differs from the original.`);
      if(leg.outcome===null)reject(`Leg ${leg.legId}: final outcome is missing.`);
      const clearance=observedLegClearance(leg);
      if(leg.clearanceMargin!==null&&(clearance.margin===null||Math.abs(leg.clearanceMargin-clearance.margin)>0.000001))reject(`Leg ${leg.legId}: supplied clearance margin is inconsistent or unsupported by its observed statistic and exact line.`);
      if(clearance.margin!==null&&leg.outcome!==null){
        const atLeast=/\bat[_ ]least\b|\bor more\b|\d\s*\+/i.test(leg.selection??'');
        if(clearance.margin===0&&!atLeast&&leg.outcome!=='void')reject(`Leg ${leg.legId}: a statistic exactly on a strict threshold needs explicit push/void rule reconciliation. This batch does not infer a win or loss at the boundary.`);
        if(leg.outcome==='won'&&(atLeast?clearance.margin<0:clearance.margin<=0))reject(`Leg ${leg.legId}: the stated win contradicts its supplied final statistic and threshold.`);
        if(leg.outcome==='lost'&&(atLeast?clearance.margin>=0:clearance.margin>0))reject(`Leg ${leg.legId}: the stated loss contradicts its supplied final statistic and threshold.`);
      }
    }
    if(overall(observation.legs)!==observation.outcome)reject('Overall outcome does not agree with the complete individual leg outcomes.');
    if(observation.outcome==='won'&&observation.legs.some(leg=>leg.outcome==='void'))reject('A won multi with void legs needs source-supported adjusted pricing. This batch does not infer a new combined price; use the existing individual ledger review.');
    if(observation.kind!=='actual'&&observation.actualPayoutCents!==null)reject('Paper results must not carry an actual bookmaker payout. Their return is hypothetical only.');
    if(row.issues.length)return row;
    const settledAt=new Date(observation.settledAt!).toISOString();
    if(target.kind==='actual'){
      const original=input.appData.bets.find(bet=>bet.id===target.recordId)!;
      const ticket=readLedgerEvidence(original.notes).ticketReference;
      const proposal:Bet={...structuredClone(original),outcome:observation.outcome!,settledAt,notes:writeLedgerEvidence(original.notes,ticket,observation.actualPayoutCents),legs:original.legs.map(leg=>{const result=observation.legs.find(value=>value.legId===leg.id)!;const text=statistic(result);return{...leg,outcome:result.outcome!,...(text===null?{}:{statistic:text})};})};
      const financial=reviewLedgerEntry(proposal,observation.actualPayoutCents);
      row.issues.push(...financial.issues);row.actualBet=financial.bet;row.expectedPayoutCents=financial.cashReturnCents;
    } else if(target.kind==='paper'){
      const original=input.appData.paperPredictions.find(paper=>paper.id===target.recordId)!;
      const details=[observation.notes,...observation.legs.map(statistic)].filter(Boolean).join(' · ').slice(0,500);
      row.corePaper={...structuredClone(original),outcome:observation.outcome!,settledAt,...(details?{statistic:details}:{})} satisfies PaperPrediction;
      const returned=observation.outcome==='lost'?0:observation.outcome==='void'?original.hypotheticalStakeCents:multiplyMoney(original.hypotheticalStakeCents,original.candidate.odds);
      row.expectedPayoutCents=returned;row.hypotheticalProfitCents=returned-original.hypotheticalStakeCents;
    } else {
      const record=input.history.records.find(item=>item.id===target.recordId)!;
      row.historicalPaper={recordId:target.recordId,outcome:observation.outcome!,settledAt,statistic:observation.notes?.slice(0,500)??null,legs:observation.legs.map(leg=>({legId:leg.legId,outcome:leg.outcome!,statistic:statistic(leg)})),updatedAt:now.toISOString()};
      const hypothetical=computeHypothetical(record,row.historicalPaper);
      row.expectedPayoutCents=hypothetical.returnCents;row.hypotheticalProfitCents=hypothetical.profitCents;
    }
    row.eligible=row.issues.length===0;
    return row;
  });
  return{response,responseHash,rows,warnings:['Manual/source-supplied observations are not independently verified by EdgeLab. No live results provider or bookmaker account was accessed.']};
}
