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
