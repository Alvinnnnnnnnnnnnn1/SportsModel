import { sha256 } from '@/lib/imports/duplicates';
import { V6_POLICY } from './policy';
import { poissonCountProbability, poissonPushProbability, surfaceEloProbability } from './models';
import { marketSchema, observationSchema, forecastSchema, gradeSchema, positionSchema, v6StateSchema, type CanonicalMarket, type Forecast, type Grade, type Observation, type PaperPosition, type V6State } from './types';

export const marketKey = (market: CanonicalMarket) => { const m=marketSchema.parse(market);return JSON.stringify([m.sport,m.eventId,m.subjectId,m.statistic,m.operator,m.threshold,m.period,m.periodNumber,m.overtime,m.termsVersion]); };
export const exactMarket = (a:CanonicalMarket,b:CanonicalMarket) => marketKey(a)===marketKey(b);
export const positionHash = (p:PaperPosition) => sha256(JSON.stringify(positionSchema.parse(p)));
export const decisionKey = (o:Observation,window:string) => sha256(JSON.stringify([marketKey(o.market),o.bookmaker,window,V6_POLICY.id]));
export function gradeCount(m:CanonicalMarket,value:number):Grade['outcome'] {
  marketSchema.parse(m);
  if(!Number.isFinite(value)||m.operator==='win')return 'unresolved';
  if(['points','rebounds','assists','threes','PRA','PR','PA','RA','games','sets'].includes(m.statistic)&&(!Number.isInteger(value)||value<0))return 'unresolved';
  const line=m.threshold!;
  if(value===line && ['gt','lt'].includes(m.operator))return 'push';
  const won=m.operator==='gte'?value>=line:m.operator==='gt'?value>line:m.operator==='lte'?value<=line:m.operator==='lt'?value<line:value===line;
  return won?'won':'lost';
}
/** Exact cent half-up on source decimal odds; no floating-point money arithmetic. */
export function hypotheticalProfit(p:PaperPosition,outcome:Grade['outcome']):number|null {
  if(outcome==='unresolved')return null;
  if(outcome==='lost')return -p.stakeCents;
  if(outcome==='void'||outcome==='push')return 0;
  const scaled=BigInt(Math.round(p.observation.odds*10000));
  return Number((BigInt(p.stakeCents)*(scaled-10000n)+5000n)/10000n);
}
export function qualification(o:Observation,f:Forecast|null,now:string,cohort:V6State['cohort']):string[] {
  observationSchema.parse(o); if(f)forecastSchema.parse(f);
  const reasons:string[]=[],t=Date.parse(now),start=Date.parse(o.eventStartsAt);
  if(!Number.isFinite(t))throw new Error('Invalid worker clock');
  if((cohort==='v6-synthetic')!==(o.sourceClass==='synthetic'))reasons.push('cohort_mismatch');
  if(o.provider!=='the-odds-api.com'&&cohort!=='v6-synthetic')reasons.push('provider_not_permitted');
  if(o.permissionReference!=='https://the-odds-api.com/terms-and-conditions.html'&&cohort!=='v6-synthetic')reasons.push('unreviewed_permission');
  if(o.status!=='prematch_open'||start<=t)reasons.push('not_pre_event');
  if(Date.parse(o.observedAt)>t||Date.parse(o.retrievedAt)>t||Date.parse(o.observedAt)>Date.parse(o.retrievedAt))reasons.push('invalid_observation_clock');
  if(t-Date.parse(o.observedAt)>V6_POLICY.maxQuoteAgeSeconds*1000)reasons.push('stale_quote');
  if(o.sourceUpdatedAt===null)reasons.push('source_timestamp_unknown');
  else if(Date.parse(o.sourceUpdatedAt)>Date.parse(o.retrievedAt)||t-Date.parse(o.sourceUpdatedAt)>V6_POLICY.maxQuoteAgeSeconds*1000)reasons.push('invalid_source_timestamp');
  if(!f){if(!V6_POLICY.exploratoryEnabled)reasons.push('no_independent_forecast');return reasons;}
  if(!exactMarket(o.market,f.market))reasons.push('forecast_market_mismatch');
  if(f.validation!=='out_of_sample_validated')reasons.push('model_not_validated');
  if(Date.parse(f.inputCutoff)>Date.parse(f.generatedAt)||Date.parse(f.generatedAt)>t||Date.parse(f.inputCutoff)>=start)reasons.push('forecast_leakage');
  if(Date.parse(f.inputs.sourceObservedAt)>Date.parse(f.inputCutoff))reasons.push('input_snapshot_leakage');
  try{
    const calculated=f.method==='poisson_minutes_rate'&&f.inputs.minutes!==null&&f.inputs.ratePerMinute!==null?poissonCountProbability(f.market,f.inputs.minutes,f.inputs.ratePerMinute)
      :f.method==='surface_elo'&&['ATP','WTA'].includes(f.market.sport)&&f.market.statistic==='moneyline'&&f.inputs.surface&&f.inputs.rating!==null&&f.inputs.opponentRating!==null?surfaceEloProbability(f.inputs.rating,f.inputs.opponentRating):null;
    if(calculated===null||Math.abs(calculated-f.probability)>1e-10)reasons.push('unreproducible_probability');
    const push=f.method==='poisson_minutes_rate'&&f.inputs.minutes!==null&&f.inputs.ratePerMinute!==null?poissonPushProbability(f.market,f.inputs.minutes,f.inputs.ratePerMinute):0;
    if(Math.abs(push-f.pushProbability)>1e-10)reasons.push('unreproducible_push_probability');
  }catch{reasons.push('unsupported_model_inputs');}
  if(f.probability*(o.odds-1)-(1-f.probability-f.pushProbability)<V6_POLICY.minExpectedValue)reasons.push('insufficient_expected_value');
  return reasons;
}
export async function registerPaper(state:V6State,o:Observation,f:Forecast|null,window:'pre_event_once',now:string) {
  v6StateSchema.parse(state);const reasons=qualification(o,f,now,state.cohort);
  if(f&&await sha256(JSON.stringify(f.inputs))!==f.inputsHash)reasons.push('model_inputs_hash_mismatch');
  if(reasons.length)return {state,reasons,position:null};
  const key=await decisionKey(o,window),existing=state.positions.find(p=>p.key===key);
  if(existing)return {state,reasons:['duplicate_position'],position:existing};
  // Deliberately no available-balance, daily-count, sport-count or exposure gate.
  const position=positionSchema.parse({id:crypto.randomUUID(),ownerId:state.ownerId,cohort:state.cohort,key,policyId:V6_POLICY.id,registeredAt:now,decisionWindow:window,classification:f?'model_supported':'exploratory',stakeCents:V6_POLICY.stakeCents,observation:structuredClone(o),forecast:f?structuredClone(f):null});
  return {state:{...state,revision:state.revision+1,positions:[...state.positions,position]},reasons:[],position};
}
export async function appendGrade(state:V6State,input:Grade):Promise<V6State> {
  const g=gradeSchema.parse(input),p=state.positions.find(p=>p.id===g.positionId);
  if(!p||p.ownerId!==state.ownerId||p.cohort!==state.cohort)throw new Error('Position ownership/cohort mismatch');
  if(g.positionHash!==await positionHash(p)||!exactMarket(g.market,p.observation.market)||g.eventId!==p.observation.market.eventId||g.subjectId!==p.observation.market.subjectId||g.termsVersion!==p.observation.market.termsVersion)throw new Error('Grade identity mismatch');
  if((g.sourceClass==='synthetic')!==(state.cohort==='v6-synthetic'))throw new Error('Grade source/cohort mismatch');
  const evidenceAt=g.publishedAt??g.observedAt!;
  if(Date.parse(evidenceAt)<Date.parse(p.observation.eventStartsAt)||Date.parse(g.recordedAt)<Date.parse(evidenceAt)
    ||g.observedAt!==undefined&&(Date.parse(g.observedAt)>Date.parse(g.recordedAt)||Date.parse(g.observedAt)<Date.parse(evidenceAt)))throw new Error('Grade timestamps are invalid');
  if(g.rawEvidence!==undefined&&await sha256(g.rawEvidence)!==g.sourceHash)throw new Error('Grade raw evidence hash mismatch');
  const supportedDnpVoid=g.exception==='dnp'&&g.outcome==='void'&&g.observedValue===null&&g.rawEvidence!==undefined
    &&/^nba-points-ot-dnp-void-v1:[a-f0-9]{64}$/.test(p.observation.market.termsVersion);
  if(g.exception!=='none'&&g.outcome!=='unresolved'&&!supportedDnpVoid)throw new Error('Exceptional settlement remains unresolved until supported rule handling exists');
  if(p.observation.market.operator==='win'&&['won','lost'].includes(g.outcome)&&(!g.winnerId||g.outcome!==(g.winnerId===p.observation.market.subjectId?'won':'lost')))throw new Error('Missing or inconsistent official winner identity');
  if(g.observedValue!==null&&p.observation.market.operator!=='win'&&['won','lost','push'].includes(g.outcome)&&g.outcome!==gradeCount(p.observation.market,g.observedValue))throw new Error('Observed statistic disagrees with grade');
  if(['won','lost','push'].includes(g.outcome)&&g.observedValue===null&&p.observation.market.operator!=='win')throw new Error('Missing statistic cannot establish a grade');
  const previous=state.grades.filter(x=>x.positionId===p.id).sort((a,b)=>a.revision-b.revision).at(-1);
  const replay=state.grades.find(x=>x.id===g.id);
  if(replay){if(JSON.stringify(replay)!==JSON.stringify(g))throw new Error('Grade replay content changed');return state;}
  if(g.revision!==(previous?.revision??0)+1||g.previousGradeId!==(previous?.id??null))throw new Error('Stale grade revision');
  if(previous&&Date.parse(g.recordedAt)<Date.parse(previous.recordedAt))throw new Error('Grade revision clock moved backwards');
  return {...state,revision:state.revision+1,grades:[...state.grades,structuredClone(g)]};
}
export function paperAccounting(state:V6State) {
  v6StateSchema.parse(state);
  let profit=0,pending=0,decisiveStake=0,decisiveProfit=0,wins=0,losses=0,voids=0,pushes=0,brier=0,logLoss=0,scored=0;
  for(const p of state.positions){
    if(p.ownerId!==state.ownerId||p.cohort!==state.cohort)throw new Error('Mixed owner/cohort accounting is forbidden');
    const g=state.grades.filter(g=>g.positionId===p.id).sort((a,b)=>a.revision-b.revision).at(-1);
    const pnl=g?hypotheticalProfit(p,g.outcome):null;
    if(pnl===null){pending+=p.stakeCents;continue;}profit+=pnl;
    if(g?.outcome==='void')voids++; if(g?.outcome==='push')pushes++;
    if(g?.outcome==='won'||g?.outcome==='lost'){
      decisiveStake+=p.stakeCents;decisiveProfit+=pnl; wins+=Number(g.outcome==='won');losses+=Number(g.outcome==='lost');
      if(p.forecast&&p.classification==='model_supported'){const y=Number(g.outcome==='won'),prob=p.forecast.probability/(1-p.forecast.pushProbability);brier+=(prob-y)**2;logLoss+=-(y?Math.log(prob):Math.log(1-prob));scored++;}
    }
  }
  const equity=V6_POLICY.openingReferenceCents+profit,available=equity-pending;
  return {cohort:state.cohort,participation:V6_POLICY.participation,openingReferenceCents:V6_POLICY.openingReferenceCents,profitCents:profit,equityCents:equity,pendingCents:pending,availableCents:available,virtualExcessExposureCents:Math.max(0,-available),notionalTurnoverCents:state.positions.reduce((n,p)=>n+p.stakeCents,0),decisiveStakeCents:decisiveStake,roi:decisiveStake?decisiveProfit/decisiveStake:null,wins,losses,voids,pushes,scored,brier:scored?brier/scored:null,logLoss:scored?logLoss/scored:null,uniqueFixtures:new Set(state.positions.map(p=>p.observation.market.eventId)).size};
}
