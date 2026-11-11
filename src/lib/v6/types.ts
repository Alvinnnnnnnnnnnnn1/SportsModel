import { z } from 'zod';
const text = z.string().trim().min(1).max(500);
const stamp = z.string().datetime({ offset: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const url = z.string().url().refine(value => { const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&![...u.searchParams.keys()].some(key=>/key|token|password|secret/i.test(key)); });
export const marketSchema = z.object({
  sport: z.enum(['NBA','NBL','ATP','WTA']), eventId: text, subjectId: text,
  statistic: z.enum(['points','rebounds','assists','threes','PRA','PR','PA','RA','moneyline','spread','total','games','sets']),
  operator: z.enum(['gt','gte','lt','lte','eq','win']), threshold: z.number().finite().nullable(),
  period: z.enum(['full_game','match','set','quarter']), periodNumber: z.number().int().positive().nullable(),
  overtime: z.enum(['included','excluded','not_applicable']), termsVersion: text,
}).strict().superRefine((m,c)=>{
  if ((m.operator==='win')!==(m.threshold===null)) c.addIssue({code:'custom',message:'Win has no threshold; all numerical markets require their exact line.'});
  if ((m.statistic==='moneyline')!==(m.operator==='win')) c.addIssue({code:'custom',message:'Moneyline requires win semantics.'});
  if (['set','quarter'].includes(m.period)!==(m.periodNumber!==null)) c.addIssue({code:'custom',message:'An exact period number is required only for set/quarter markets.'});
});
export type CanonicalMarket = z.infer<typeof marketSchema>;
export const observationSchema = z.object({
  id: z.string().uuid(), sourceClass: z.enum(['prospective','synthetic']), provider: text,
  permissionReference: url, bookmaker: text, market: marketSchema, eventStartsAt: stamp,
  odds: z.number().min(1.0001).max(10000).refine(n=>Math.abs(n*10000-Math.round(n*10000))<.00001),
  observedAt: stamp, retrievedAt: stamp, sourceUpdatedAt: stamp.nullable(), sourceUrl: url, rawHash: hash,
  status: z.enum(['prematch_open','in_play','closed','unknown']),
}).strict();
export type Observation = z.infer<typeof observationSchema>;
export const forecastSchema = z.object({
  market: marketSchema, probability: z.number().min(0).max(1), pushProbability: z.number().min(0).max(1), modelId: text, version: text,
  method: z.enum(['poisson_minutes_rate','surface_elo','nba_team_elo']), validation: z.enum(['experimental','out_of_sample_validated']),
  generatedAt: stamp, inputCutoff: stamp, inputsHash: hash, evidenceUrls: z.array(url).min(1),
  inputs: z.object({minutes:z.number().finite().nullable(),ratePerMinute:z.number().finite().nullable(),surface:z.enum(['hard','clay','grass']).nullable(),rating:z.number().finite().nullable(),opponentRating:z.number().finite().nullable(),sampleSize:z.number().int().positive(),sourceObservedAt:stamp,sourceUrl:url,
    team:z.object({homeId:text,awayId:text,homeRating:z.number().min(0).max(5000),awayRating:z.number().min(0).max(5000),homeCourt:z.literal(60),formAdjustment:z.number().min(-160).max(160),restAdjustment:z.number().min(-20).max(20),shrinkage:z.literal(.05),historyHash:hash,registryHash:hash,safeEventStartsAt:stamp,researchPolicyId:text.optional(),homeOdds:z.number().min(1.0001).max(10000).optional(),awayOdds:z.number().min(1.0001).max(10000).optional()}).strict().optional()}).strict(),
}).strict().refine(f => f.probability + f.pushProbability <= 1 + 1e-12, 'Win and push probabilities exceed one');
export type Forecast = z.infer<typeof forecastSchema>;
export const positionSchema = z.object({
  id: z.string().uuid(), ownerId: text, cohort: z.enum(['v6-prospective','v6-synthetic']),
  key: hash, policyId: z.literal('v6-uncapped-paper-1'), registeredAt: stamp, decisionWindow: z.literal('pre_event_once'),
  classification: z.enum(['model_supported','exploratory']), stakeCents: z.literal(5000),
  observation: observationSchema, forecast: forecastSchema.nullable(),
}).strict().superRefine((p,c)=>{
  if ((p.classification==='model_supported') !== (p.forecast!==null)) c.addIssue({code:'custom',message:'Model-supported classification requires its original forecast'});
  if (p.forecast && JSON.stringify(p.forecast.market)!==JSON.stringify(p.observation.market)) c.addIssue({code:'custom',message:'Forecast and quote market identity differ'});
});
export type PaperPosition = z.infer<typeof positionSchema>;
export const gradeSchema = z.object({
  id: z.string().uuid(), positionId: z.string().uuid(), revision: z.number().int().positive(),
  previousGradeId: z.string().uuid().nullable(), positionHash: hash, recordedAt: stamp,
  outcome: z.enum(['won','lost','void','push','unresolved']), sourceClass: z.enum(['prospective','synthetic']),
  sourceUrl: url, sourceHash: hash, eventId: text, subjectId: text, termsVersion: text,
  market: marketSchema, winnerId: text.nullable(),
  final: z.literal(true), publishedAt: stamp.nullable(), observedAt:stamp.optional(), rawEvidence:z.string().max(8000000).optional(), observedValue: z.number().finite().nullable(),
  exception: z.enum(['none','dnp','retirement','postponed','ambiguous_terms']),
}).strict().refine(g=>g.publishedAt!==null||g.observedAt!==undefined&&g.rawEvidence!==undefined,'Missing source-issued time requires the actual final-observation time and retained raw evidence');
export type Grade = z.infer<typeof gradeSchema>;
export const v6StateSchema = z.object({
  version: z.literal(1), ownerId: text, cohort: z.enum(['v6-prospective','v6-synthetic']),
  revision: z.number().int().nonnegative(), positions: z.array(positionSchema), grades: z.array(gradeSchema),
  runs: z.array(z.object({id:text,at:stamp,mode:z.enum(['disabled','dry_run','armed']), screened:z.number().int().nonnegative(),registered:z.number().int().nonnegative(),observations:z.array(observationSchema),preflightExclusions:z.array(z.object({sourceHash:hash,sourceIdentity:text,reasons:z.array(text).min(1)}).strict()).optional(),rejections:z.array(z.object({observationId:text,reasons:z.array(text)}))}).strict()),
}).strict().superRefine((s,c)=>{
  const fail=(message:string)=>c.addIssue({code:'custom',message});
  if(new Set(s.positions.map(p=>p.id)).size!==s.positions.length||new Set(s.positions.map(p=>p.key)).size!==s.positions.length)fail('Duplicate V6 position identity');
  if(new Set(s.grades.map(g=>g.id)).size!==s.grades.length||new Set(s.grades.map(g=>`${g.positionId}:${g.revision}`)).size!==s.grades.length)fail('Duplicate V6 grade revision');
  if(new Set(s.runs.map(r=>r.id)).size!==s.runs.length)fail('Duplicate worker run');
  for(const p of s.positions)if(p.ownerId!==s.ownerId||p.cohort!==s.cohort||(p.observation.sourceClass==='synthetic')!==(s.cohort==='v6-synthetic')||Date.parse(p.registeredAt)>=Date.parse(p.observation.eventStartsAt))fail('Invalid prospective cohort or registration');
  for(const g of s.grades)if(!s.positions.some(p=>p.id===g.positionId))fail('Orphan grade');
});
export type V6State = z.infer<typeof v6StateSchema>;
export const emptyV6State = (ownerId:string,cohort:V6State['cohort']='v6-prospective'):V6State => ({version:1,ownerId,cohort,revision:0,positions:[],grades:[],runs:[]});
