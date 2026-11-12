import type {ModelDevelopmentSummary,Model2ProspectiveSummary} from './prediction/report';
/** Public shape of the private read-only V6 view. Never includes raw sources or credentials. */
export type V6Section = 'overview'|'research'|'models'|'positions'|'health';
export const v6Sections: {id:V6Section;label:string;href:string}[] = [
 {id:'overview',label:'V6 Overview',href:'/v6'}, {id:'research',label:'Autonomous Research',href:'/v6/research'},
 {id:'models',label:'Model Intelligence',href:'/v6/models'}, {id:'positions',label:'Paper Position Ledger',href:'/v6/positions'}, {id:'health',label:'Automation Health',href:'/v6/health'},
];
export interface V6Metric {brier:number;logLoss:number;calibration:{count:number;meanProbability:number|null;observedRate:number|null}[];}
export interface V6Selection {deVigProbability?:number;verification?:string;sourceClass?:string;models?:{name:string;version:string;probability:number|null;ev:number|null;firstPass:string[];secondPass:string[];decision:string}[];key:string;eventId:string;fixture:string;sport:string;selection:string;market:string;odds:number|null;breakEven:number|null;probability:number|null;eloProbability:number|null;ev:number|null;startsAt:string;quoteAt:string|null;capturedAt:string;forecastAt:string|null;frozenAt:string;pass1:string[];pass2:string[];limitations:string[];outcome:string;homeScore:number|null;awayScore:number|null;decision:string;}
export interface V6Dashboard {
 storage?:'local'|'cloud';
 development?:ModelDevelopmentSummary|null;
 model2Prospective?:Model2ProspectiveSummary|null;
 generatedAt:string;productionStatus:'disabled';openingCents:number;stakeCents:number;
 sources:{name:string;status:'available'|'missing'|'invalid';asOf:string|null;reason:string}[];
 selections:V6Selection[];
 evaluation:{fixtures:number;verified:number;unresolved:number;from?:string|null;to?:string|null;metrics:Record<'eloOnly'|'challenger'|'bookmakerDeVig',V6Metric|null>;limitations:string[]}|null;
 historical:{games:number;heldOut:number;asOf:string;from?:string|null;to?:string|null;eloOnly:V6Metric;challenger:V6Metric;limitations:string[]}|null;
 ledger:{available:boolean;registered:number;pendingCents:number;profitCents:number;equityCents:number;roi:number|null;positions:{id:string;fixture:string;market:string;selection:string;odds:number;probability:number|null;stakeCents:number;registeredAt:string;quoteAt:string|null;forecastAt:string|null;outcome:string;profitCents:number|null;tier:string}[]};
 health:{cloud?:{activeHost:string;lastAttempt:string|null;leaseUntil:string|null;pilotExpiresAt:string;snapshotRevision:number;localHost:string;status:string};mode:string;killSwitch:boolean|null;credential:string;lastRun:string|null;jobs:{kind:string;dueAt:string;status:string;attempts:number;error:string|null}[];blockers:string[];quota:{provider:string;used:number|null;remaining:number|null;asOf:string|null}[]};
}
