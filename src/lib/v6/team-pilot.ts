import { z } from 'zod';
import { sha256 } from '@/lib/imports/duplicates';
import type { RawEvidence } from './evidence.server';
import { deVig,teamEloProbability,teamEloOnlyProbability } from './models';
import { forecastTeamGame,TEAM_MODEL } from './team-model';
import { teamGames,type TeamGame } from './team-games';
import { resolveTeamLabel,type TeamRegistry } from './team-identity';
import { observationSchema,forecastSchema,type Observation,type Forecast,type PaperPosition,type Grade } from './types';
import { positionHash } from './engine';
import { TEAM_RESEARCH_POLICY } from './team-research-policy';
export { TEAM_RESEARCH_POLICY } from './team-research-policy';
const stamp=z.string().datetime({offset:true});
export const TEAM_TERMS=Object.freeze({version:'sportsbet-nba-fullgame-moneyline-ot-v1',sourceUrl:'https://helpcentre.sportsbet.com.au/hc/en-us/articles/18431711744781-Does-My-NBA-Bet-Include-Overtime',
 fullGame:true,overtime:true,postponed:'unresolved',ties:'unresolved'});
const eventSchema=z.object({id:z.string().min(1),sport_key:z.literal('basketball_nba'),commence_time:stamp,home_team:z.string().min(1),away_team:z.string().min(1),bookmakers:z.array(z.object({key:z.string(),sid:z.string().nullish(),markets:z.array(z.object({key:z.string(),last_update:stamp.nullish(),outcomes:z.array(z.object({name:z.string(),price:z.number().min(1.0001).max(10000).refine(n=>Math.abs(n*10000-Math.round(n*10000))<.00001),point:z.number().optional()}))}))}))});
export const TEAM_FIXTURE_MATCH=Object.freeze({version:'nba-team-scheduled-time-1',maximumDifferenceSeconds:900,deadline:'earliest_attributed_start',uniqueExactHomeAwayRequired:true});
export interface TeamFixtureProof {eventId:string;homeName:string;awayName:string;statsHomeName:string;statsAwayName:string;homeId:string;awayId:string;startsAt:string;statsStartsAt:string|null;earliestStartsAt:string;clockDifferenceSeconds:number|null;statsGameId:string|null;registryHash:string;termsVersion:string;}
export async function screenTeamSlate(source:RawEvidence,rows:TeamGame[],registry:TeamRegistry,completeSeasons:number[],at:string,modelChoice:'challenger'|'elo_only'='challenger'){
 stamp.parse(at);const url=new URL(source.sourceUrl);
 if(source.provider!=='the-odds-api.com'||await sha256(source.raw)!==source.hash||url.origin!=='https://api.the-odds-api.com'||url.pathname!=='/v4/sports/basketball_nba/odds'||url.searchParams.get('bookmakers')!=='sportsbet'||url.searchParams.get('markets')!=='h2h'||Date.parse(source.retrievedAt)>Date.parse(at))throw new Error('Invalid exact Sportsbet team source');
 if(Date.parse(registry.recordedAt)>Date.parse(at))throw new Error('Future team registry');
 const events=z.array(eventSchema).parse(JSON.parse(source.raw)),seen=new Set<string>(),candidates=[],snapshots:Record<string,TeamGame[]>={};
 for(const e of events){
  if(e.home_team===e.away_team)throw new Error('Ambiguous team event');
  const home=resolveTeamLabel(registry,e.home_team),away=resolveTeamLabel(registry,e.away_team);
  const fixtureMatches=rows.filter(g=>g.provider==='balldontlie'&&Date.parse(g.retrievedAt)<=Date.parse(at)&&g.startsAt&&g.home.name===home?.name&&g.away.name===away?.name&&Math.abs(Date.parse(g.startsAt)-Date.parse(e.commence_time))<=TEAM_FIXTURE_MATCH.maximumDifferenceSeconds*1000);
  const seasons=[...new Set(fixtureMatches.map(g=>g.season).filter((s):s is number=>s!==null))];
  const season=seasons.length===1?seasons[0]:null;
  const statsStartsAt=fixtureMatches.length===1?fixtureMatches[0].startsAt:null,earliestStartsAt=statsStartsAt&&Date.parse(statsStartsAt)<Date.parse(e.commence_time)?statsStartsAt:e.commence_time;
  const modeled=home&&away&&season!==null&&Date.parse(earliestStartsAt)>Date.parse(at)?await forecastTeamGame(rows,{home:home.name,away:away.name,season,startsAt:earliestStartsAt,at,completeRegularSeasons:completeSeasons}):null;
  if(modeled?.forecast&&modeled.historySnapshot)snapshots[modeled.forecast.inputs.historyHash]=modeled.historySnapshot;
  for(const book of e.bookmakers)if(book.key==='sportsbet')for(const market of book.markets)if(market.key==='h2h'){
   if(market.outcomes.length!==2||new Set(market.outcomes.map(o=>o.name)).size!==2||market.outcomes.some(o=>![e.home_team,e.away_team].includes(o.name)||o.point!==undefined))throw new Error('Incomplete/ambiguous two-way NBA moneyline');
   const baseline=deVig(market.outcomes.map(o=>o.price),true)!;
   for(const [i,o]of market.outcomes.entries()){
    const key=await sha256(JSON.stringify([e.id,'sportsbet','h2h',o.name]));if(seen.has(key))throw new Error('Duplicate team selection');seen.add(key);
    const subject=o.name===e.home_team?home:away,reasons:string[]=[],limitations=['injury_roster_evidence_unavailable','alternative_markets_not_collected','experimental_model_not_activated'];
    if(!home||!away||!subject)reasons.push('canonical_team_identity_missing');
    if(fixtureMatches.length!==1||season===null)reasons.push('exact_current_fixture_missing_or_ambiguous');
    if(Date.parse(at)>=Date.parse(earliestStartsAt))reasons.push('event_already_started');
    if(!market.last_update)reasons.push('quote_update_unknown');else if(Date.parse(market.last_update)>Date.parse(source.retrievedAt)||Date.parse(at)-Date.parse(market.last_update)>300000||Date.parse(at)-Date.parse(source.retrievedAt)>300000)reasons.push('stale_or_future_quote');
    let observation:Observation|null=null,forecast:Forecast|null=null;
    const proof:TeamFixtureProof|null=home&&away?{eventId:e.id,homeName:e.home_team,awayName:e.away_team,statsHomeName:home.name,statsAwayName:away.name,homeId:home.canonicalId,awayId:away.canonicalId,startsAt:e.commence_time,statsStartsAt,earliestStartsAt,clockDifferenceSeconds:statsStartsAt?Math.abs(Date.parse(statsStartsAt)-Date.parse(e.commence_time))/1000:null,statsGameId:fixtureMatches.length===1?fixtureMatches[0].sourceGameId:null,registryHash:registry.hash,termsVersion:TEAM_TERMS.version}:null;
    if(proof&&subject)observation=observationSchema.parse({id:crypto.randomUUID(),sourceClass:'prospective',provider:'the-odds-api.com',permissionReference:'https://the-odds-api.com/terms-and-conditions.html',bookmaker:'sportsbet',
     market:{sport:'NBA',eventId:'the-odds-api.com:'+e.id,subjectId:subject.canonicalId,statistic:'moneyline',operator:'win',threshold:null,period:'full_game',periodNumber:null,overtime:'included',termsVersion:TEAM_TERMS.version},eventStartsAt:e.commence_time,odds:o.price,observedAt:source.retrievedAt,retrievedAt:source.retrievedAt,sourceUpdatedAt:market.last_update??null,sourceUrl:source.sourceUrl,rawHash:source.hash,status:Date.parse(e.commence_time)>Date.parse(at)?'prematch_open':'unknown'});
    if(observation&&modeled?.forecast&&proof){const f=modeled.forecast,features=f.inputs.features;
     const inputs={minutes:null,ratePerMinute:null,surface:null,rating:null,opponentRating:null,sampleSize:f.sampleSize,sourceObservedAt:rows.filter(g=>g.final&&g.compatibleTraining&&Date.parse(g.retrievedAt)<=Date.parse(at)).map(g=>g.retrievedAt).sort().at(-1)!,sourceUrl:'https://api.balldontlie.io/v1/games',
      team:{homeId:proof.homeId,awayId:proof.awayId,homeRating:features.homeRating,awayRating:features.awayRating,homeCourt:60 as const,formAdjustment:features.formAdjustment,restAdjustment:features.restAdjustment,shrinkage:.05 as const,historyHash:f.inputs.historyHash,registryHash:registry.hash,safeEventStartsAt:proof.earliestStartsAt,researchPolicyId:TEAM_RESEARCH_POLICY.id,homeOdds:market.outcomes.find(o=>o.name===e.home_team)!.price,awayOdds:market.outcomes.find(o=>o.name===e.away_team)!.price}};
     if(modelChoice==='elo_only'){inputs.team.formAdjustment=0;inputs.team.restAdjustment=0;}
     const finalInputs=modelChoice==='elo_only'?{...inputs,team:{...inputs.team,shrinkage:0 as const}}:inputs;
     forecast=forecastSchema.parse({market:observation.market,probability:modelChoice==='elo_only'?teamEloOnlyProbability(observation.market,finalInputs.team):teamEloProbability(observation.market,finalInputs.team),pushProbability:0,modelId:modelChoice==='elo_only'?'nba-team-elo-only':TEAM_MODEL.id,version:modelChoice==='elo_only'?'candidate-1':TEAM_MODEL.version,method:modelChoice==='elo_only'?'nba_team_elo_only':'nba_team_elo',validation:'experimental',generatedAt:at,inputCutoff:at,inputsHash:await sha256(JSON.stringify(finalInputs)),evidenceUrls:['https://api.balldontlie.io/v1/games'],inputs:finalInputs});
    }else reasons.push(...(modeled?.reasons??['independent_current_team_forecast_missing']));
    const p=forecast?.probability??null,ev=p===null?null:p*o.price-1,elo=modeled?.forecast?(o.name===e.home_team?modeled.forecast.eloOnlyHome:1-modeled.forecast.eloOnlyHome):null;
    const pass1=[...reasons];if(p!==null&&p<TEAM_RESEARCH_POLICY.minWinProbability)reasons.push('win_likelihood_below_frozen_threshold');if(ev!==null&&ev<TEAM_RESEARCH_POLICY.minExpectedValue)reasons.push('insufficient_expected_value');
    const stressedP=p===null?null:.5+(p-.5)*TEAM_RESEARCH_POLICY.sensitivityRetention,stressedEV=stressedP===null?null:stressedP*o.price-1;
    if(p!==null&&elo!==null&&Math.abs(p-elo)>TEAM_RESEARCH_POLICY.maxModelEloDisagreement)reasons.push('model_baseline_disagreement');
    if(p!==null&&Math.abs(p-baseline[i])>TEAM_RESEARCH_POLICY.maxModelMarketDisagreement)reasons.push('large_market_disagreement_requires_review');
    if(stressedEV!==null&&stressedEV<TEAM_RESEARCH_POLICY.minExpectedValue)reasons.push('sensitivity_ev_failed');
    reasons.push('model_validation_and_standing_activation_missing');
    candidates.push({key,eventId:e.id,sportsbetEventId:book.sid??null,selection:o.name,originalOdds:o.price,sourceUpdatedAt:market.last_update??null,retrievedAt:source.retrievedAt,eventStartsAt:e.commence_time,rawHash:source.hash,
     breakEvenProbability:1/o.price,deVigMarketProbability:baseline[i],forecast,estimatedEV:ev,proof,observation,
     pass1:{reasons:pass1},pass2:{eloProbability:elo,stressedProbability:stressedP,stressedEV,reasons:[...new Set(reasons)]},
     classifications:[...(p!==null&&p>=.7?['high_probability']:[]),...(ev!==null&&ev>=.02?['potential_value']:[]),...(!forecast?['exploratory']:[])],limitations,decision:'excluded' as const,qualifies:false,financialRegistration:false,correlationCluster:e.id});
   }
  }
 }
 return {format:'edgelab.v6-team-shadow',version:1,at,policy:TEAM_RESEARCH_POLICY,terms:TEAM_TERMS,fixtureMatchPolicy:TEAM_FIXTURE_MATCH,sourceReceiptId:source.id,sourceHash:source.hash,candidates,snapshots,registrations:0,settlements:0};
}
/** Exact same-provider event ID plus independent final-score agreement. This
 * prepares an audited paper grade, never a bookmaker settlement or cash write.
 */
export async function gradeTeamMoneyline(position:PaperPosition,proof:TeamFixtureProof,scores:RawEvidence,secondary:RawEvidence,at:string,previous:Grade|null=null){
 const fail=(reason:string)=>({status:'unresolved' as const,reason,grade:null});const m=position.observation.market;
 if(m.sport!=='NBA'||m.statistic!=='moneyline'||m.period!=='full_game'||m.overtime!=='included'||m.termsVersion!==TEAM_TERMS.version||proof.termsVersion!==m.termsVersion||m.eventId!=='the-odds-api.com:'+proof.eventId||![proof.homeId,proof.awayId].includes(m.subjectId)||Date.parse(position.observation.eventStartsAt)!==Date.parse(proof.startsAt))return fail('exact_team_market_proof_mismatch');
 const originalTeam=position.forecast?.inputs.team;
 if(!position.forecast||!['nba_team_elo','nba_team_elo_only'].includes(position.forecast.method)||!originalTeam||originalTeam.homeId!==proof.homeId||originalTeam.awayId!==proof.awayId||originalTeam.registryHash!==proof.registryHash||originalTeam.safeEventStartsAt!==proof.earliestStartsAt)return fail('frozen_team_forecast_proof_mismatch');
 if(scores.provider!=='the-odds-api.com'||secondary.provider!=='balldontlie'&&secondary.provider!=='thesportsdb'||[scores,secondary].some(e=>Date.parse(e.retrievedAt)>Date.parse(at)))return fail('invalid_result_provider_or_clock');
 const primary=(await teamGames(scores)).filter(g=>g.sourceGameId===proof.eventId),other=await teamGames(secondary);
 const exact=(g:TeamGame)=>g.final&&g.startsAt!==null&&Date.parse(g.startsAt)===Date.parse(g.provider==='the-odds-api.com'?proof.startsAt:proof.statsStartsAt??proof.startsAt)&&g.home.name===(g.provider==='the-odds-api.com'?proof.homeName:proof.statsHomeName)&&g.away.name===(g.provider==='the-odds-api.com'?proof.awayName:proof.statsAwayName)&&g.homeScore!==null&&g.awayScore!==null&&g.homeScore!==g.awayScore;
 if(primary.length!==1||!exact(primary[0]))return fail('same_event_final_score_unavailable');const result=primary[0],cross=other.filter(g=>exact(g)&&(secondary.provider!=='balldontlie'||proof.statsGameId===g.sourceGameId));
 if(cross.length!==1||cross[0].homeScore!==result.homeScore||cross[0].awayScore!==result.awayScore)return fail('independent_final_score_unverified_or_conflicting');
 if(Date.parse(at)<Date.parse(proof.startsAt)||[scores,secondary].some(s=>Date.parse(s.retrievedAt)<Date.parse(proof.startsAt)))return fail('final_observation_before_start');
 const winnerId=result.homeScore!>result.awayScore!?proof.homeId:proof.awayId,outcome=winnerId===m.subjectId?'won':'lost';
 const rawEvidence=JSON.stringify({scoresUrl:scores.sourceUrl,scoresRaw:scores.raw,secondaryUrl:secondary.sourceUrl,secondaryRaw:secondary.raw,proof}),sourceHash=await sha256(rawEvidence);
 if(previous?.sourceHash===sourceHash&&previous.outcome===outcome)return {status:'unchanged' as const,reason:null,grade:null};
 const observedAt=[scores.retrievedAt,secondary.retrievedAt].sort().at(-1)!;
 const grade:Grade={id:crypto.randomUUID(),positionId:position.id,revision:(previous?.revision??0)+1,previousGradeId:previous?.id??null,positionHash:await positionHash(position),recordedAt:at,outcome,sourceClass:position.observation.sourceClass,sourceUrl:scores.sourceUrl,sourceHash,eventId:m.eventId,subjectId:m.subjectId,termsVersion:m.termsVersion,market:structuredClone(m),winnerId,final:true,publishedAt:result.sourceUpdatedAt,observedAt,rawEvidence,observedValue:null,exception:'none'};
 return {status:'grade_proposed' as const,reason:null,grade};
}

/** Outcome verification for observations is deliberately not position grading.
 * Repeated team-side/quote rows share one underlying event result and no P/L.
 */
export async function verifyObservedTeamScore(proof:TeamFixtureProof,scores:RawEvidence,secondary:RawEvidence,at:string){
 const fail=(reason:string)=>({status:'unresolved' as const,reason,result:null});
 if(scores.provider!=='the-odds-api.com'||secondary.provider!=='balldontlie'||!proof.statsGameId||!proof.statsStartsAt||[scores,secondary].some(e=>Date.parse(e.retrievedAt)>Date.parse(at)||Date.parse(e.retrievedAt)<Date.parse(proof.earliestStartsAt)))return fail('result_provider_identity_or_clock_missing');
 const a=(await teamGames(scores)).filter(g=>g.sourceGameId===proof.eventId),b=(await teamGames(secondary)).filter(g=>g.sourceGameId===proof.statsGameId);
 if(a.length!==1||b.length!==1)return fail('exact_event_ids_missing');const primary=a[0],other=b[0];
 if(!primary.final||!other.final||primary.startsAt===null||other.startsAt===null||Date.parse(primary.startsAt)!==Date.parse(proof.startsAt)||Date.parse(other.startsAt)!==Date.parse(proof.statsStartsAt)
  ||primary.home.name!==proof.homeName||primary.away.name!==proof.awayName||other.home.name!==proof.statsHomeName||other.away.name!==proof.statsAwayName
  ||primary.homeScore===null||primary.awayScore===null||primary.homeScore===primary.awayScore||primary.homeScore!==other.homeScore||primary.awayScore!==other.awayScore)return fail('final_scores_or_fixture_clocks_disagree');
 return {status:'verified' as const,reason:null,result:{eventId:proof.eventId,statsGameId:proof.statsGameId,winnerId:primary.homeScore>primary.awayScore?proof.homeId:proof.awayId,homeScore:primary.homeScore,awayScore:primary.awayScore,
  publishedAt:primary.sourceUpdatedAt,observedAt:[scores.retrievedAt,secondary.retrievedAt].sort().at(-1)!,sourceHashes:[scores.hash,secondary.hash],receiptIds:[scores.id,secondary.id],financialSettlement:false}};
}
