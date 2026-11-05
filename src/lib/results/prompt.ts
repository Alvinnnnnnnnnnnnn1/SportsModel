import { settlementResponseJsonSchema, type SettlementTarget, type SettlementObservation, type SettlementResponse } from './contract';

export function observationForTarget(target:SettlementTarget):SettlementObservation {
  return {kind:target.kind,recordId:target.recordId,identityHash:target.identityHash,sport:target.sport,event:target.event,eventDate:target.eventDate,outcome:null,settledAt:null,eventCompleted:false,termsConfirmed:false,termsReference:null,verification:'owner_attested',ownerAttested:false,sources:[],notes:null,actualPayoutCents:null,legs:target.legs.map(leg=>({legId:leg.legId,sport:leg.sport,event:leg.event,participant:leg.participant,market:leg.market,selection:leg.selection,line:leg.line,outcome:null,statistic:null,observedValue:null,clearanceMargin:null})),specialCases:[],specialCaseResolution:null};
}
export function settlementResponseTemplate(targets:SettlementTarget[],now=new Date()):SettlementResponse {
  return{format:'edgelab.settlement-response',version:1,id:crypto.randomUUID(),createdAt:now.toISOString(),observations:targets.filter(t=>t.eligible&&!t.settled).map(observationForTarget)};
}
export function generateResultsCheckPrompt(targets:SettlementTarget[],now=new Date()):string {
  const unresolved=targets.filter(target=>target.eligible&&!target.settled);
  return [
    'EdgeLab results check — manual evidence collection, no automatic settlement.',
    'Use inspectable primary sports-result sources. Do not access any bookmaker account, invent statistics, accepted ticket prices, dates or settlement rules, or treat elapsed time as a result.',
    'Return ONLY edgelab.settlement-response version 1 JSON, using the exact template below. Echo record, kind, fingerprint and leg identities unchanged. Set createdAt to the response creation timestamp; all reported observations/results must already be known then. Keep unknown facts null/false. This is a separate results contract, not a research-response.',
    'For each result provide event date, actual result timestamp, final-event evidence, source URLs with actual observation times, and all exact leg outcomes/statistics. Record source_supplied when supplying inspectable sources; it is not independent verification. Never claim owner_attested or set ownerAttested=true on the owner’s behalf. Leave owner approval and unknown sportsbook payout/terms for the owner.',
    'Do not settle DNP, retirement, postponement, dead heats, ambiguous overtime, voids or SGMs under unknown rules. Preserve uncertainty in notes, specialCases and specialCaseResolution; unresolved records stay pending. Clearance margins require an attributable statistic and exact numerical threshold. Paper amounts are hypothetical; actualPayoutCents must stay null unless explicitly supplied by the owner’s ticket evidence.',
    `Prepared ${now.toISOString()}; ${unresolved.length} eligible unresolved positions. All dates display in Australia/Melbourne; timestamps use ISO UTC/offset.`,
    'POSITION CONTEXT (research source/session, original and accepted odds, missing evidence and earlier observations):',
    JSON.stringify(unresolved.map(target=>({key:target.key,researchDay:target.researchDay,sessionId:target.sessionId,sourceReference:target.sourceReference,startsAt:target.startsAt,originalOdds:target.originalOdds,acceptedOdds:target.acceptedOdds,stakeCents:target.stakeCents,stakeType:target.stakeType,probability:target.probability,probabilityProvenance:target.probabilityProvenance,missingEvidence:['Final result and event completion','Exact settlement rule reference','Actual payout for actual wagers'],previousEvidence:target.previousEvidence})),null,2),
    'STRICT RESPONSE TEMPLATE:',JSON.stringify(settlementResponseTemplate(unresolved,now),null,2),
    'Downloadable exact JSON Schema is available in EdgeLab Import Results. No observation will be applied without validation and explicit owner batch approval.',
  ].join('\n\n');
}
export function downloadableSettlementSchema():string{return JSON.stringify(settlementResponseJsonSchema,null,2);}
