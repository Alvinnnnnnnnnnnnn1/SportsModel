import {z} from 'zod';
const timestamp=z.string().datetime({offset:true});
/** Price comparison only, not an edge estimate. No quote retrieval or closing-price storage is implied. */
export interface IdentifiedPrice {eventId:string|null;marketId:string|null;selection:string|null;line:string|null;decimalOdds:number|null;timestamp:string|null;source:string|null;kind:'accepted_execution'|'original_forecast'|'closing'|'comparison'|'reported_quote';}
export function calculateClv(original:IdentifiedPrice,closing:IdentifiedPrice,eventStartsAt:string|null):{priceImprovementPercent:number|null;impliedProbabilityChange:number|null;reason:string|null}{
 const unavailable=(reason:string)=>({priceImprovementPercent:null,impliedProbabilityChange:null,reason});
 if(!['accepted_execution','original_forecast'].includes(original.kind)||closing.kind!=='closing')return unavailable('Requires original accepted/registered price and an explicitly identified closing quote; comparison/reported quotes are insufficient.');
 for(const key of ['eventId','marketId','selection','line'] as const)if(!original[key]?.trim()||!closing[key]?.trim()||original[key]!==closing[key])return unavailable('Exact event, market, selection and line identities must match.');
 if(!original.source||!closing.source)return unavailable('Both prices require attributable sources.');
 if(original.decimalOdds===null||closing.decimalOdds===null||![original.decimalOdds,closing.decimalOdds].every(v=>Number.isFinite(v)&&v>1&&v<=10000&&Math.abs(v*10000-Math.round(v*10000))<.00001))return unavailable('Both original and closing decimal odds must be valid.');
 if(![original.timestamp,closing.timestamp,eventStartsAt].every(value=>timestamp.safeParse(value).success))return unavailable('Exact ISO timestamps with UTC or offset are required; date-only values cannot establish a closing price.');
 const a=Date.parse(original.timestamp??''),b=Date.parse(closing.timestamp??''),start=Date.parse(eventStartsAt??'');
 if(![a,b,start].every(Number.isFinite)||a>b||b>start)return unavailable('Document original/closing times and event start, with closing quote after the original and no later than event start.');
 return {priceImprovementPercent:(original.decimalOdds/closing.decimalOdds-1)*100,impliedProbabilityChange:1/closing.decimalOdds-1/original.decimalOdds,reason:null};
}
