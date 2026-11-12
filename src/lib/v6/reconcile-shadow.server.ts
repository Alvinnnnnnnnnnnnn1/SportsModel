import fs from 'node:fs/promises';
import path from 'node:path';
import { loadTeamShadow } from './team-shadow.server';
import { evaluateFrozenShadow,binaryMetrics } from './shadow-evaluation.server';
import { reconcileTeamEvent,EVENT_RECONCILIATION_POLICY } from './team-reconciliation';
import { teamGames } from './team-games';
import { digest,atomicPrivateJson,exclusive,type RawEvidence } from './evidence.server';

/** New content-addressed decisions; the original strict journal is never edited. */
export async function reconcileFrozenShadow(root:string,id:string,at:string){
 const frozen=await loadTeamShadow(root,id),original=await evaluateFrozenShadow(root,id,at),source=frozen.record.source;
 const receipts=await Promise.all((await fs.readdir(path.join(root,'evidence-receipts'))).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',f),'utf8')) as Promise<RawEvidence>));
 const decisions:{hash:string;file:string;decision:Awaited<ReturnType<typeof reconcileTeamEvent>>&{originalStrictStatus:'verified'|'unresolved'}}[]=[];
 for(const game of original.report.games){
  const c=frozen.record.screen.candidates.find(c=>c.eventId===game.eventId)!,p=c.proof!;
  const name=(id:string)=>Object.values(frozen.record.registry.mappings).find(m=>m.canonicalId===id)?.name;
  const proof={...p,statsHomeName:p.statsHomeName??name(p.homeId)!,statsAwayName:p.statsAwayName??name(p.awayId)!};
  const pre=receipts.filter(e=>e.provider==='balldontlie'&&new URL(e.sourceUrl).pathname==='/v1/games'&&Date.parse(e.retrievedAt)<=Date.parse(frozen.record.screen.at)).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt));
  let originalFixtures:RawEvidence|undefined;
  for(const e of pre)if((await teamGames(e)).some(g=>g.sourceGameId===proof.statsGameId)){originalFixtures=e;break;}
  const scores=receipts.find(e=>e.id===game.primaryReceiptId),secondary=receipts.find(e=>e.id===game.secondaryReceiptId);
  if(!originalFixtures||!scores||!secondary)throw new Error('Reconciliation requires all four retained source receipts');
  const result=await reconcileTeamEvent({proof,registry:frozen.record.registry,originalOdds:source,originalFixtures,scores,secondary,frozenAt:frozen.record.screen.at,at,
   quote:{selectionName:c.selection,odds:c.originalOdds,sourceUpdatedAt:c.sourceUpdatedAt,retrievedAt:c.retrievedAt,forecastAt:c.forecast!.generatedAt}});
  const selectionQuoteChecks=await Promise.all(frozen.record.screen.candidates.filter(s=>s.eventId===game.eventId).map(async s=>({key:s.key,selection:s.selection,originalOdds:s.originalOdds,
   eligibility:(await reconcileTeamEvent({proof,registry:frozen.record.registry,originalOdds:source,originalFixtures,scores,secondary,frozenAt:frozen.record.screen.at,at,quote:{selectionName:s.selection,odds:s.originalOdds,sourceUpdatedAt:s.sourceUpdatedAt,retrievedAt:s.retrievedAt,forecastAt:s.forecast!.generatedAt}})).quoteEligibility})));
  if(selectionQuoteChecks.some(s=>!s.eligibility.eligible))result.quoteEligibility.eligible=false;
  const decision={format:'edgelab.v6-event-reconciliation',version:1,shadowId:id,shadowHash:frozen.hash,originalResultRevisionHash:original.report.resultRevisionHash,
   policyHash:digest(JSON.stringify(EVENT_RECONCILIATION_POLICY)),originalStrictStatus:game.verification,...result,selectionQuoteChecks};
  const hash=digest(JSON.stringify(decision)),file=path.join(root,'team-shadow-reconciliations',id,digest(JSON.stringify(EVENT_RECONCILIATION_POLICY)),digest(game.eventId),hash+'.json');
  await exclusive(file+'.lock',async()=>{try{if(await fs.readFile(file,'utf8')!==JSON.stringify({hash,decision},null,2))throw new Error('Immutable reconciliation decision changed');}
   catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await atomicPrivateJson(file,{hash,decision});}});
  decisions.push({hash,file,decision});
 }
 const verified=decisions.filter(d=>d.decision.identity.verified&&d.decision.result.verified&&d.decision.quoteEligibility.eligible),ids=new Set(verified.map(d=>d.decision.eventId));
 const games=original.report.games.filter(g=>ids.has(g.eventId));
 const metrics={eloOnly:binaryMetrics(games.filter(g=>g.eloHomeProbability!==null).map(g=>({p:g.eloHomeProbability!,y:g.y!}))),challenger:binaryMetrics(games.map(g=>({p:g.homeProbability,y:g.y!}))),bookmakerDeVig:binaryMetrics(games.map(g=>({p:g.deVigHomeProbability,y:g.y!})))};
 const selections=original.report.selections.map(s=>{const d=decisions.find(d=>d.decision.eventId===s.eventId)!;return {...s,originalStrictVerification:s.verification,reconciliationDecisionHash:d.hash,
  verification:ids.has(s.eventId)?'verified_under_event_reconciliation_v1':'unresolved',outcome:ids.has(s.eventId)?s.sourceReportedOutcome:'unresolved',scoreClassification:ids.has(s.eventId)?'reconciled_observational':'unresolved',financialPosition:false,paperSettlement:false};});
 const report={format:'edgelab.v6-reconciled-shadow-evaluation',version:1,shadowId:id,shadowHash:frozen.hash,policy:EVENT_RECONCILIATION_POLICY,decisions,
  fixtures:decisions.length,originalStrictVerified:original.report.verifiedFixtures,newlyVerified:verified.filter(d=>d.decision.originalStrictStatus!=='verified').length,
  verifiedFixtures:verified.length,unresolvedFixtures:decisions.length-verified.length,verifiedSelections:selections.filter(s=>s.outcome!=='unresolved').length,
  metrics,selections,independentUnit:'one home-win forecast per distinct fixture',uniqueEventDates:new Set(games.map(g=>g.frozenOddsStart.slice(0,10))).size,
  limitations:['Ten fixtures on one slate cannot establish calibration or sportsbook edge','Actual tip-off timestamps unknown; conservative earliest schedule plus capture safety used','Elo/challenger share ratings and are not independent models','Identity-only tolerance never changes pre-event quote deadline'],positions:0,settlements:0,financialWrites:0};
 const file=path.join(root,'team-shadow-reconciliations',id,'evaluations',digest(JSON.stringify(report))+'.json');await atomicPrivateJson(file,report);return {file,report};
}
