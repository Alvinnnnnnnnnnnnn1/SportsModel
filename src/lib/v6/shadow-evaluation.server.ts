import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { loadTeamShadow } from './team-shadow.server';
import { teamGames } from './team-games';
import { verifyObservedTeamScore,type TeamFixtureProof } from './team-pilot';
import { atomicPrivateJson,digest,type RawEvidence } from './evidence.server';
const hash=z.string().regex(/^[a-f0-9]{64}$/),stamp=z.string().datetime({offset:true});
const rowSchema=z.object({eventId:z.string(),status:z.enum(['verified','unresolved']),reason:z.string().nullable().optional(),identityProof:z.unknown().optional(),result:z.unknown().nullable().optional()}).passthrough();
const revisionSchema=z.object({revision:z.number().int().positive(),previousHash:hash.nullable(),factHash:hash,hash,payload:z.object({shadowHash:hash,at:stamp,results:z.array(rowSchema),positions:z.literal(0),settlements:z.literal(0),financialWrites:z.literal(0)}).strict()}).strict();
interface GameEvaluation {eventId:string;home:string;away:string;homeScore:number|null;awayScore:number|null;statsGameId:string|null;winner:string|null;
 verification:'verified'|'unresolved';reason:string|null;sourceAgreed:boolean;frozenOddsStart:string;finalReportedOddsStart:string|null;statsStart:string|null;
 oddsStartChangeSeconds:number|null;homeProbability:number;eloHomeProbability:number|null;deVigHomeProbability:number;y:number|null;
 primaryReceiptId:string;secondaryReceiptId:string|null;primaryHash:string;secondaryHash:string|null;}
export async function loadShadowResults(root:string,id:string){
 z.string().uuid().parse(id);const input:unknown[]=JSON.parse(await fs.readFile(path.join(root,'team-shadow-results',id+'.json'),'utf8'));
 const history=input.map((raw,i)=>{const {hash:stored,...data}=raw as Record<string,unknown>;if(digest(JSON.stringify(data))!==stored)throw new Error('Result journal hash mismatch');const r=revisionSchema.parse(raw);
  if(r.revision!==i+1||r.previousHash!==((input[i-1] as {hash:string}|undefined)?.hash??null))throw new Error('Result revision chain changed');
  if(new Set(r.payload.results.map(s=>s.eventId)).size!==r.payload.results.length)throw new Error('Duplicate result event');return r;});
 if(!history.length)throw new Error('No result revision');return history;
}
export function binaryMetrics(rows:{p:number;y:number}[]){
 if(!rows.length)return null;const epsilon=1e-15;
 if(rows.some(r=>!Number.isFinite(r.p)||r.p<0||r.p>1||![0,1].includes(r.y)))throw new Error('Invalid binary forecast');
 const calibration=Array.from({length:10},(_,i)=>{const b=rows.filter(r=>Math.min(9,Math.floor(r.p*10))===i);return {lower:i/10,count:b.length,meanProbability:b.length?b.reduce((n,r)=>n+r.p,0)/b.length:null,observedRate:b.length?b.reduce((n,r)=>n+r.y,0)/b.length:null};});
 return {games:rows.length,brier:rows.reduce((n,r)=>n+(r.p-r.y)**2,0)/rows.length,logLoss:rows.reduce((n,r)=>{const p=Math.min(1-epsilon,Math.max(epsilon,r.p));return n-r.y*Math.log(p)-(1-r.y)*Math.log(1-p);},0)/rows.length,
  logLossClip:epsilon,calibration,insufficientForModelPromotion:true};
}
/** Rechecks retained sources, never fetches or mutates a frozen forecast. Strict
 * metrics exclude clock discrepancies; source-agreed provisional scores stay separate.
 */
export async function evaluateFrozenShadow(root:string,id:string,at:string){
 stamp.parse(at);const frozen=await loadTeamShadow(root,id),history=await loadShadowResults(root,id),latest=history.at(-1)!;
 if(latest.payload.shadowHash!==frozen.hash||Date.parse(latest.payload.at)>Date.parse(at))throw new Error('Result/shadow identity or clock mismatch');
 const receipts=(await Promise.all((await fs.readdir(path.join(root,'evidence-receipts'))).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',f),'utf8')) as Promise<RawEvidence>)))
  .filter(e=>Date.parse(e.retrievedAt)<=Date.parse(latest.payload.at));
 const primaryIds=latest.payload.results.flatMap(r=>{const value=r.result as {receiptIds?:string[]}|null;return r.status==='verified'&&value?.receiptIds?.[0]?[value.receiptIds[0]]:[];});
 if(new Set(primaryIds).size>1)throw new Error('Mixed primary result receipt identities');
 const primary=receipts.filter(e=>e.provider==='the-odds-api.com'&&new URL(e.sourceUrl).pathname==='/v4/sports/basketball_nba/scores').sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt)).find(e=>primaryIds.length?e.id===primaryIds[0]:Date.parse(e.retrievedAt)>=Date.parse(frozen.record.screen.at)&&latest.payload.results.every(r=>new URL(e.sourceUrl).searchParams.get('eventIds')?.split(',').includes(r.eventId)));
 if(!primary)throw new Error('Retained scores receipt missing');const finals=await teamGames(primary),groups=Map.groupBy(frozen.record.screen.candidates,c=>c.eventId),games:GameEvaluation[]=[];
 const selections=[];
 for(const [eventId,candidates]of groups){
  if(candidates.length!==2||new Set(candidates.map(c=>c.observation?.market.subjectId)).size!==2)throw new Error('A team event must contain two distinct complementary selections');
  const original=candidates[0].proof;if(!original)throw new Error('Frozen fixture proof absent');
  const name=(id:string)=>Object.values(frozen.record.registry.mappings).find(t=>t.canonicalId===id)?.name;
  const proof:TeamFixtureProof={...original,statsHomeName:original.statsHomeName??name(original.homeId)!,statsAwayName:original.statsAwayName??name(original.awayId)!};
  const secondary=receipts.filter(e=>e.provider==='balldontlie'&&new URL(e.sourceUrl).pathname==='/v1/games/'+proof.statsGameId).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt))[0];
  const primaryRows=finals.filter(g=>g.sourceGameId===eventId),secondaryRows=secondary?await teamGames(secondary):[];
  const a=primaryRows.length===1?primaryRows[0]:null,b=secondaryRows.find(g=>g.sourceGameId===proof.statsGameId)??null;
  const checked=secondary?await verifyObservedTeamScore(proof,primary,secondary,latest.payload.at):null;
  const sourceAgreement=Boolean(a&&b&&a.final&&b.final&&a.home.name===proof.homeName&&a.away.name===proof.awayName&&b.home.name===proof.statsHomeName&&b.away.name===proof.statsAwayName&&a.homeScore!==null&&a.awayScore!==null&&a.homeScore!==a.awayScore&&a.homeScore===b.homeScore&&a.awayScore===b.awayScore);
  const journalStatus=latest.payload.results.find(r=>r.eventId===eventId)?.status;
  const strict=checked?.status==='verified'&&journalStatus==='verified',y=sourceAgreement?Number(a!.homeScore!>a!.awayScore!):null;
  const home=candidates.find(c=>c.observation!.market.subjectId===proof.homeId)!,away=candidates.find(c=>c!==home)!;
  for(const c of candidates){const f=c.forecast;
   if(!f||digest(JSON.stringify(f.inputs))!==f.inputsHash||Date.parse(f.generatedAt)>Date.parse(frozen.record.screen.at)||Date.parse(f.generatedAt)>=Date.parse(proof.earliestStartsAt)||c.originalOdds!==c.observation?.odds||c.sourceUpdatedAt!==c.observation?.sourceUpdatedAt)throw new Error('Original forecast/quote integrity failed');
   const outcome=y===null?null:c===home?y:1-y,p=f.probability;
   selections.push({key:c.key,eventId,selection:c.selection,originalOdds:c.originalOdds,sourceUpdatedAt:c.sourceUpdatedAt,retrievedAt:c.retrievedAt,frozenAt:frozen.record.screen.at,forecastGeneratedAt:f.generatedAt,originalProbability:p,
    eloProbability:c.pass2.eloProbability,outcome:strict?(outcome===1?'won':'lost'):'unresolved',sourceReportedOutcome:outcome===null?null:outcome===1?'won':'lost',verification:strict?'verified':'unresolved',reason:strict?null:checked?.reason??'journal_review_or_independent_result_missing',sourceAgreed:sourceAgreement,
    forecastError:outcome===null?null:p-outcome,brier:outcome===null?null:(p-outcome)**2,logLoss:outcome===null?null:binaryMetrics([{p,y:outcome}])!.logLoss,scoreClassification:strict?'verified':'provisional_unresolved',financialPosition:false,paperSettlement:false,originalExclusions:c.pass2.reasons});
  }
  const delta=a?.startsAt?(Date.parse(a.startsAt)-Date.parse(proof.startsAt))/1000:null;
  games.push({eventId,home:proof.homeName,away:proof.awayName,homeScore:a?.homeScore??null,awayScore:a?.awayScore??null,statsGameId:proof.statsGameId,
   winner:y===null?null:y===1?proof.homeName:proof.awayName,verification:strict?'verified':'unresolved',reason:strict?null:checked?.reason??'missing_independent_result',sourceAgreed:sourceAgreement,
   frozenOddsStart:proof.startsAt,finalReportedOddsStart:a?.startsAt??null,statsStart:b?.startsAt??null,oddsStartChangeSeconds:delta,
   homeProbability:home.forecast!.probability,eloHomeProbability:home.pass2.eloProbability,deVigHomeProbability:home.deVigMarketProbability,y,
   primaryReceiptId:primary.id,secondaryReceiptId:secondary?.id??null,primaryHash:primary.hash,secondaryHash:secondary?.hash??null});
  if(Math.abs(home.forecast!.probability+away.forecast!.probability-1)>1e-10)throw new Error('Complementary forecasts disagree');
 }
 const scores=(filter:(g:typeof games[number])=>boolean)=>{const g=games.filter(filter);return {challenger:binaryMetrics(g.map(r=>({p:r.homeProbability,y:r.y!}))),eloOnly:binaryMetrics(g.filter(r=>r.eloHomeProbability!==null).map(r=>({p:r.eloHomeProbability!,y:r.y!}))),bookmakerDeVig:binaryMetrics(g.map(r=>({p:r.deVigHomeProbability,y:r.y!})))};};
 const exclusions:Record<string,number>={};for(const c of frozen.record.screen.candidates)for(const reason of c.pass2.reasons)exclusions[reason]=(exclusions[reason]??0)+1;
 const report={format:'edgelab.v6-prospective-evaluation',version:1,at,shadowId:id,shadowHash:frozen.hash,resultRevision:latest.revision,resultRevisionHash:latest.hash,
  fixtures:games.length,verifiedFixtures:games.filter(g=>g.verification==='verified').length,unresolvedFixtures:games.filter(g=>g.verification!=='verified').length,sourceAgreedFixtures:games.filter(g=>g.sourceAgreed).length,
  verifiedSelections:selections.filter(s=>s.verification==='verified').length,unresolvedSelections:selections.filter(s=>s.verification!=='verified').length,games,selections,
  primaryVerifiedMetrics:scores(g=>g.verification==='verified'&&g.y!==null),provisionalSourceAgreementMetrics:{classification:'UNRESOLVED_IDENTITY_CLOCK_REVIEW_NOT_VERIFIED_PERFORMANCE',metrics:scores(g=>g.sourceAgreed&&g.y!==null)},
  exclusions,independentUnit:'one home-win forecast per fixture; paired sides are not independent',limitations:['Small ten-fixture slate cannot validate/promote a model','Elo/challenger share team ratings/data, not independent corroborating forecasts','Start-time discrepancies remain unresolved under the frozen rules'],positions:0,settlements:0,financialWrites:0};
 const file=path.join(root,'team-shadow-evaluations',id,digest(JSON.stringify(report))+'.json');await atomicPrivateJson(file,report);return {file,report};
}
