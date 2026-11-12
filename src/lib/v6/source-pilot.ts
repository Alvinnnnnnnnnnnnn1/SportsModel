import {z} from 'zod';
const stamp=z.string().datetime({offset:true}),hash=z.string().regex(/^[a-f0-9]{64}$/),count=z.number().int().nonnegative();
/** Operational source budget only; never changes paper eligibility or volume. */
export const sourcePilotPlanSchema=z.object({format:z.literal('edgelab.v6-source-pilot'),version:z.literal(1),ownerId:z.string().min(1),historyBatchId:z.string().uuid(),
 startsAt:stamp,expiresAt:stamp,period:z.string().regex(/^\d{4}-\d{2}$/),baselineReserved:count,baselineUsed:count,additionalOddsCredits:z.literal(50),monthlyOddsCeiling:z.number().int().max(400),providerReserve:z.literal(100),
 artifactHash:hash,scope:z.literal('NBA_Sportsbet_full_game_moneyline_observations_only'),
 cadence:z.object({discoveryHourMelbourne:z.literal(19),resultsHourMelbourne:z.literal(18),finalResultsHourMelbourne:z.literal(21),lastEventHoursBeforeEnd:z.literal(8),captureDays:z.literal(13),resultTailDays:z.literal(1),preStartJobs:z.literal(false),catchupMinutes:z.literal(120),tickSeconds:z.literal(60)}).strict(),
 paperRegistrations:z.literal(false),paperSettlements:z.literal(false),modelActivation:z.literal(false),hostedAccess:z.literal(false),externalMessaging:z.literal(false),
}).strict().superRefine((p,c)=>{if(Date.parse(p.expiresAt)-Date.parse(p.startsAt)!==14*86400000||p.startsAt.slice(0,7)!==p.period||new Date(Date.parse(p.expiresAt)-1).toISOString().slice(0,7)!==p.period)c.addIssue({code:'custom',message:'Pilot must span exactly 14 days inside one quota month'});if(p.monthlyOddsCeiling!==Math.max(p.baselineReserved,p.baselineUsed)+50)c.addIssue({code:'custom',message:'Keep cumulative reservations and provider usage; add at most 50'});});
export type SourcePilotPlan=z.infer<typeof sourcePilotPlanSchema>;
export const pilotReceiptExtension=z.object({plan:sourcePilotPlanSchema,planHash:hash,approvalStatus:z.enum(['pending','approved'])}).strict();

export class SourcePilotBlocked extends Error {}

/** Idle lifecycle states perform no environment/provider access and never shift dates. */
export function sourcePilotIdleState(plan:SourcePilotPlan,now:string,stopped=false){const t=Date.parse(now);if(!Number.isFinite(t))throw new Error('Invalid source pilot clock');if(stopped)return 'emergency_stopped';return t<Date.parse(plan.startsAt)?'scheduled_waiting':t>=Date.parse(plan.expiresAt)?'window_expired':null;}
