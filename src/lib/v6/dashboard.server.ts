import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { digest } from './evidence.server';
import { V6_POLICY } from './policy';
import { controlledConfigSchema } from './controlled-activation';
import { paperAccounting, hypotheticalProfit } from './engine';
import { v6StateSchema } from './types';
import {model2ResearchView} from './prediction/research-view.server';
import {evaluateModel2Slates} from './prediction/shadow.server';
import {developmentSummary,model2ProspectiveSummarySchema} from './prediction/report';
import type {ModelDevelopmentReport} from './prediction/evaluation';
import type { V6Dashboard } from './dashboard';
import {loadLocalPaperView} from './local-paper-view.server';
const text=z.string().max(250),stamp=z.string().datetime({offset:true}),prob=z.number().min(0).max(1),count=z.number().int().nonnegative(),hash=z.string().regex(/^[a-f0-9]{64}$/);
const metric=z.object({brier:z.number().finite().nonnegative(),logLoss:z.number().finite().nonnegative(),calibration:z.array(z.object({count,meanProbability:prob.nullable(),observedRate:prob.nullable()})).max(20)});
const shadowId='204dd518-19e2-4250-ad80-b6218430d838';
const candidate=z.object({key:hash,eventId:text,selection:text,originalOdds:z.number().min(1.0001).nullable(),breakEvenProbability:prob.nullable(),eventStartsAt:stamp,sourceUpdatedAt:stamp.nullable(),retrievedAt:stamp,
 forecast:z.object({probability:prob,generatedAt:stamp}).nullable(),estimatedEV:z.number().finite().nullable(),proof:z.object({homeName:text,awayName:text}).nullable(),
 pass1:z.object({reasons:z.array(text)}),pass2:z.object({eloProbability:prob.nullable(),reasons:z.array(text)}),limitations:z.array(text),decision:text});
const shadow=z.object({hash,record:z.object({id:z.literal(shadowId),positionsRegistered:z.literal(0),screen:z.object({at:stamp,candidates:z.array(candidate).max(5000)})})});
const evaluation=z.object({format:z.literal('edgelab.v6-reconciled-shadow-evaluation'),shadowHash:hash,fixtures:count,verifiedFixtures:count,unresolvedFixtures:count,
 metrics:z.object({eloOnly:metric.nullable(),challenger:metric.nullable(),bookmakerDeVig:metric.nullable()}),limitations:z.array(text),
 selections:z.array(z.object({key:hash,outcome:text,financialPosition:z.literal(false),paperSettlement:z.literal(false)})),
 decisions:z.array(z.object({decision:z.object({eventId:text,result:z.object({homeScore:z.number().int().nullable(),awayScore:z.number().int().nullable()})})}))});
const historical=z.object({format:z.literal('edgelab.v6-team-model-analysis'),at:stamp,evaluation:z.object({games:count,heldOutGames:count,scores:z.array(z.object({startsAt:stamp})).optional(),eloOnly:metric,challenger:metric,limitations:z.array(text)})});
/** Only fixed allowlisted files are read. Symlinks outside the private evidence root fail closed. */
async function read(root:string,relative:string):Promise<unknown>{
 const base=await fs.realpath(root),file=await fs.realpath(path.join(root,relative));
 if(!file.startsWith(base+path.sep))throw new Error('Outside evidence root');
 if((await fs.stat(file)).size>32*1024*1024)throw new Error('Evidence too large');
 return JSON.parse(await fs.readFile(file,'utf8'));
}
export async function readDashboardAccess(root:string){return z.object({version:z.literal(1),historyBatchId:z.string().uuid()}).strict().parse(await read(root,'dashboard-access.json'));}
/** No mutation, provider call, credential-file read or source grading is performed. */
export async function loadV6Dashboard(root:string,ownerId:string,now=new Date().toISOString(),researchOwnerId=ownerId):Promise<V6Dashboard>{
 const data:V6Dashboard={generatedAt:now,productionStatus:'disabled',openingCents:V6_POLICY.openingReferenceCents,stakeCents:V6_POLICY.stakeCents,sources:[],selections:[],evaluation:null,historical:null,
 ledger:{available:false,registered:0,pendingCents:0,profitCents:0,equityCents:V6_POLICY.openingReferenceCents,roi:null,positions:[]},
 health:{mode:'disabled',killSwitch:null,credential:'Not inspected · hosted schema not deployed; no credential file read',lastRun:null,jobs:[],quota:[],blockers:['Hosted V6 schema approval A pending','Experimental model qualification approval B pending','Unattended worker installation / activation approval C pending','Production autonomy disabled; dashboard is read only']}};
 const status=async<T>(name:string,load:()=>Promise<T>,apply:(value:T)=>void,asOf:()=>string|null=()=>null)=>{try{apply(await load());data.sources.push({name,status:'available',asOf:asOf(),reason:'Retained local evidence; no live request'});}catch(e){const missing=(e as NodeJS.ErrnoException).code==='ENOENT';data.sources.push({name,status:missing?'missing':'invalid',asOf:null,reason:missing?'No retained evidence available':'Evidence failed validation; contents withheld'});}};
 let frozenHash:string|null=null;
 await status('Frozen NBA observations',async()=>{const raw=await read(root,`team-shadow/${shadowId}.json`),value=shadow.parse(raw);if(digest(JSON.stringify((raw as {record:unknown}).record))!==value.hash)throw new Error('Integrity');return value;},value=>{
 frozenHash=value.hash;data.selections=value.record.screen.candidates.map(c=>({key:c.key,eventId:c.eventId,fixture:c.proof?`${c.proof.awayName} at ${c.proof.homeName}`:c.eventId,sport:'NBA',selection:c.selection,market:'Full-game moneyline · overtime included',odds:c.originalOdds,breakEven:c.breakEvenProbability,probability:c.forecast?.probability??null,eloProbability:c.pass2.eloProbability,ev:c.estimatedEV,startsAt:c.eventStartsAt,quoteAt:c.sourceUpdatedAt,capturedAt:c.retrievedAt,forecastAt:c.forecast?.generatedAt??null,frozenAt:value.record.screen.at,pass1:c.pass1.reasons,pass2:c.pass2.reasons,limitations:c.limitations,outcome:'unresolved',homeScore:null,awayScore:null,decision:c.decision}));
 },()=>data.selections[0]?.frozenAt??null);
 const reports=async<T>(directory:string,schema:z.ZodType<T>)=>{const names=(await fs.readdir(path.join(root,directory))).filter(f=>/^[a-f0-9]{64}\.json$/.test(f));const result:T[]=[];for(const name of names){const raw=await read(root,path.join(directory,name));if(digest(JSON.stringify(raw))!==name.slice(0,-5))throw new Error('Report integrity');const checked=schema.safeParse(raw);if(checked.success)result.push(checked.data);}if(!result.length)throw Object.assign(new Error('Missing'),{code:'ENOENT'});return result;};
 await status('Reconciled observational results',async()=>{const values=await reports(`team-shadow-reconciliations/${shadowId}/evaluations`,evaluation);return values.find(v=>v.shadowHash===frozenHash)??null;},value=>{
 if(!value||value.selections.length!==data.selections.length||new Set(value.selections.map(s=>s.key)).size!==value.selections.length||!value.selections.every(s=>data.selections.some(c=>c.key===s.key)))throw new Error('Mismatched observations');
 data.evaluation={fixtures:value.fixtures,verified:value.verifiedFixtures,unresolved:value.unresolvedFixtures,metrics:value.metrics,from:data.selections.map(c=>c.startsAt).sort()[0]??null,to:data.selections.map(c=>c.startsAt).sort().at(-1)??null,limitations:value.limitations};
 for(const c of data.selections){c.outcome=value.selections.find(s=>s.key===c.key)!.outcome;const result=value.decisions.find(d=>d.decision.eventId===c.eventId)?.decision.result;c.homeScore=result?.homeScore??null;c.awayScore=result?.awayScore??null;}
 });
 await status('Player-prop exclusion archive',async()=>{
  const raw=await read(root,'observations/b69ebf2c-ceb7-438f-b4cc-d65727c375b5.json');
  const schema=z.object({hash,record:z.object({financialPosition:z.literal(false),screen:z.object({at:stamp,candidates:z.array(z.object({key:hash,eventId:text,player:text,selection:text,threshold:z.number().finite().nullable(),market:text,originalOdds:z.number().min(1.0001),sourceUpdatedAt:stamp.nullable(),retrievedAt:stamp,eventStartsAt:stamp,probability:prob.nullable(),expectedValue:z.number().finite().nullable(),reasons:z.array(text),decision:text,prospectiveRegistration:z.literal(false)}))})})});
  const value=schema.parse(raw);if(digest(JSON.stringify((raw as {record:unknown}).record))!==value.hash)throw new Error('Integrity');return value;
 },v=>{for(const c of v.record.screen.candidates)data.selections.push({key:c.key,eventId:c.eventId,fixture:c.eventId,sport:'NBA',selection:`${c.player} ${c.selection} ${c.threshold??''}`,market:c.market,odds:c.originalOdds,breakEven:1/c.originalOdds,probability:c.probability,eloProbability:null,ev:c.expectedValue,startsAt:c.eventStartsAt,quoteAt:c.sourceUpdatedAt,capturedAt:c.retrievedAt,forecastAt:null,frozenAt:v.record.screen.at,pass1:c.reasons,pass2:['Independent forecast / second-pass evidence unavailable'],limitations:['Blocked identity mapping; not a qualifying forecast'],outcome:'unresolved',homeScore:null,awayScore:null,decision:c.decision});});
 await status('Chronological model evaluation',async()=>(await reports('team-reports',historical)).sort((a,b)=>b.at.localeCompare(a.at))[0],r=>{data.historical={games:r.evaluation.games,heldOut:r.evaluation.heldOutGames,asOf:r.at,from:r.evaluation.scores?.[0]?.startsAt??null,to:r.evaluation.scores?.at(-1)?.startsAt??null,eloOnly:r.evaluation.eloOnly,challenger:r.evaluation.challenger,limitations:r.evaluation.limitations};},()=>data.historical?.asOf??null);
 await status('Prediction Engine 2 evaluation',async()=>{const names=(await fs.readdir(path.join(root,'model-development/reports'))).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).sort();if(!names.length)throw Object.assign(new Error('Missing'),{code:'ENOENT'});const summaries=[];for(const name of names){const raw=await read(root,'model-development/reports/'+name) as ModelDevelopmentReport;if(digest(JSON.stringify(raw))!==name.slice(0,-5)||raw.format!=='edgelab.v6-model-development'||digest(JSON.stringify(raw.artifact))!==raw.artifactHash)throw new Error('Integrity');summaries.push(developmentSummary(raw));}return summaries.at(-1)!;},r=>{data.development=r;});
 await status('Prediction Engine 2 prospective shadows',async()=>model2ProspectiveSummarySchema.parse(await evaluateModel2Slates(root,researchOwnerId)),r=>{data.model2Prospective=r;});
 await status('New prospective model2 research',()=>model2ResearchView(root,researchOwnerId),rows=>{data.selections.push(...rows);},()=>data.selections.filter(s=>s.sourceClass==='prospective_shadow_only').map(s=>s.capturedAt).sort().at(-1)??null);
 const operational=`controlled/${digest(ownerId)}`;
 const researchOperational=`controlled/${digest(researchOwnerId)}`;
 await status('Owner prospective paper repository',async()=>v6StateSchema.parse(await read(root,`${operational}/state/${digest(ownerId+':v6-prospective')}.json`)),state=>{
 if(state.ownerId!==ownerId||state.cohort!=='v6-prospective'||state.grades.some(g=>g.sourceClass!=='prospective'))throw new Error('Owner/cohort');const a=paperAccounting(state);data.ledger={available:true,registered:state.positions.length,pendingCents:a.pendingCents,profitCents:a.profitCents,equityCents:a.equityCents,roi:a.roi,positions:state.positions.map(p=>{const g=state.grades.filter(g=>g.positionId===p.id).sort((a,b)=>b.revision-a.revision)[0];return {id:p.id,fixture:p.observation.market.eventId,market:`${p.observation.market.statistic} ${p.observation.market.operator} ${p.observation.market.threshold??''} · ${p.observation.market.period} · ${p.observation.market.termsVersion}`,selection:p.observation.market.subjectId,odds:p.observation.odds,probability:p.forecast?.probability??null,stakeCents:p.stakeCents,registeredAt:p.registeredAt,quoteAt:p.observation.sourceUpdatedAt,forecastAt:p.forecast?.generatedAt??null,outcome:g?.outcome??'pending',profitCents:g?hypotheticalProfit(p,g.outcome):null,tier:p.researchTier??'legacy_unclassified'};})};
 });
 // Absence is not evidence of a hosted zero balance. Only the nominal reference is known.
 await status('Bounded local PAPER journal',()=>loadLocalPaperView(root,researchOwnerId,now),local=>{
  if(data.ledger.available&&data.ledger.registered>0)throw new Error('Multiple ledgers require explicit selection');
  data.localPaper=local.localPaper;data.ledger=local.ledger;data.selections.push(...local.selections);
 },()=>data.localPaper?.integrity.lastCommitAt??null);

 await status('Worker scheduler',async()=>z.object({jobs:z.array(z.object({kind:text,dueAt:stamp,status:text,attempts:count,lastError:text.nullable()}))}).parse(await read(root,`${researchOperational}/scheduler.json`)),s=>{data.health.jobs=s.jobs.map(j=>({kind:j.kind,dueAt:j.dueAt,status:j.status,attempts:j.attempts,error:j.lastError?'Worker error retained locally; inspect private diagnostics':null}));});
 await status('Last worker execution',async()=>z.object({at:stamp,status:text,workerInvoked:z.boolean()}).parse(await read(root,`${researchOperational}/health.json`)),h=>{if(h.workerInvoked)data.health.lastRun=h.at;},()=>data.health.lastRun);
 await status('Worker controls',async()=>{let raw:unknown;if(researchOwnerId===ownerId)raw=await read(root,'controlled-config.json');else try{raw=await read(root,'source-pilot/config.json');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;raw=await read(root,'source-pilot/disabled-config.json');}return controlledConfigSchema.parse(raw);},c=>{if(c.ownerId!==researchOwnerId)throw new Error('Owner');data.health.mode=c.mode;data.health.killSwitch=c.killSwitch;if(c.sourceOnly){data.health.credential='Not required · source-only local research';if(c.mode==='disabled')data.health.blockers.push('Source-only research pilot awaits owner approval; collection is disabled');}});
 await status('Shared odds quota',async()=>z.object({used:count,remaining:count,period:text,lastRequest:z.number().finite()}).parse(await read(root,'odds-shared-budget.json')),q=>{data.health.quota.push({provider:'The Odds API · retained monthly quota',used:q.used,remaining:q.remaining,asOf:new Date(q.lastRequest).toISOString()});});
 await status('BALLDONTLIE quota',async()=>z.object({day:text,requests:count}).parse(await read(root,'balldontlie-team-budget.json')),q=>{data.health.quota.push({provider:'BALLDONTLIE · retained requests on '+q.day,used:q.requests,remaining:null,asOf:null});});
 if(researchOwnerId!==ownerId)try{await fs.access(path.join(root,'source-pilot/STOP'));data.health.killSwitch=true;data.health.blockers.push('Source emergency stop is engaged');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 return data;
}
