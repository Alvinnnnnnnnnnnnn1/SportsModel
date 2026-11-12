import { marketSchema, type CanonicalMarket } from './types';
/** Experimental numerical baselines only. No validation, calibration or activation is implied. */
export function poissonCountProbability(market:CanonicalMarket,minutes:number,ratePerMinute:number):number {
  const m=marketSchema.parse(market);
  if(!['NBA','NBL'].includes(m.sport)||!['points','rebounds','assists','threes'].includes(m.statistic)||m.period!=='full_game'||m.operator==='win')throw new Error('Unsupported Poisson market');
  if(!Number.isFinite(minutes)||minutes<=0||minutes>60||!Number.isFinite(ratePerMinute)||ratePerMinute<0||minutes*ratePerMinute>200)throw new Error('Invalid pre-event minutes/rate');
  const lambda=minutes*ratePerMinute;
  const cdf=(k:number)=>{if(k<0)return 0;let term=Math.exp(-lambda),sum=term;for(let i=1;i<=Math.min(k,1000);i++){term*=lambda/i;sum+=term;}return Math.max(0,Math.min(1,sum));};
  const line=m.threshold!;
  return m.operator==='gte'?1-cdf(Math.ceil(line)-1):m.operator==='gt'?1-cdf(Math.floor(line)):m.operator==='lt'?cdf(Math.ceil(line)-1):m.operator==='lte'?cdf(Math.floor(line)):Number.isInteger(line)?cdf(line)-cdf(line-1):0;
}
export function surfaceEloProbability(rating:number,opponentRating:number):number {
  if(!Number.isFinite(rating)||!Number.isFinite(opponentRating)||rating<0||opponentRating<0||rating>5000||opponentRating>5000)throw new Error('Invalid surface Elo inputs');
  return 1/(1+10**((opponentRating-rating)/400));
}
/** Candidate baseline is a distinct method, never a relabelled challenger. */
export function teamEloOnlyProbability(market:CanonicalMarket,inputs:{homeId:string;awayId:string;homeRating:number;awayRating:number;homeCourt:number;formAdjustment:number;restAdjustment:number;shrinkage:number}):number {
 if(inputs.formAdjustment!==0||inputs.restAdjustment!==0||inputs.shrinkage!==0)throw new Error('Elo-only cannot contain challenger adjustments');
 teamEloProbability(market,{...inputs,shrinkage:.05});
 const home=1/(1+10**(-(inputs.homeRating-inputs.awayRating+inputs.homeCourt)/400));return market.subjectId===inputs.homeId?home:1-home;
}
/** Frozen team model formula, distinct from tennis Elo. */
export function teamEloProbability(market:CanonicalMarket,inputs:{homeId:string;awayId:string;homeRating:number;awayRating:number;homeCourt:number;formAdjustment:number;restAdjustment:number;shrinkage:number}):number {
 const m=marketSchema.parse(market);
 if(m.sport!=='NBA'||m.statistic!=='moneyline'||m.operator!=='win'||m.period!=='full_game'||m.overtime!=='included'||inputs.homeId===inputs.awayId||![inputs.homeId,inputs.awayId].includes(m.subjectId))throw new Error('Unsupported NBA team moneyline');
 const values=[inputs.homeRating,inputs.awayRating,inputs.homeCourt,inputs.formAdjustment,inputs.restAdjustment,inputs.shrinkage];
 if(values.some(v=>!Number.isFinite(v))||inputs.homeCourt!==60||inputs.shrinkage!==.05||Math.abs(inputs.formAdjustment)>160||Math.abs(inputs.restAdjustment)>20||inputs.homeRating<0||inputs.homeRating>5000||inputs.awayRating<0||inputs.awayRating>5000)throw new Error('Invalid frozen team model inputs');
 const delta=inputs.homeRating-inputs.awayRating+inputs.homeCourt+inputs.formAdjustment+inputs.restAdjustment;
 const home=(1-inputs.shrinkage)/(1+10**(-delta/400))+inputs.shrinkage*.5;
 return m.subjectId===inputs.homeId?home:1-home;
}
/** Integer-line over/under can push; alternate >=/<= lines cannot. */
export function poissonPushProbability(market:CanonicalMarket,minutes:number,ratePerMinute:number):number {
  if (!['gt','lt'].includes(market.operator) || !Number.isInteger(market.threshold)) return 0;
  return poissonCountProbability({...market,operator:'eq'},minutes,ratePerMinute);
}
/** Margin-free baseline requires a complete mutually exclusive market on identical terms. */
export function deVig(prices:number[],completeMarket:boolean):number[]|null {
  if(!completeMarket||prices.length<2||prices.some(p=>!Number.isFinite(p)||p<=1))return null;
  const inverse=prices.map(p=>1/p),sum=inverse.reduce((a,b)=>a+b,0);return inverse.map(p=>p/sum);
}
