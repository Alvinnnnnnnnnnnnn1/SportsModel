/** Deterministic binary scores and regularised numerical fitting. No LLM/provider dependencies. */
export const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
export const sigmoid=(n:number)=>1/(1+Math.exp(-clamp(n,-35,35)));
export const logit=(p:number)=>Math.log(clamp(p,1e-9,1-1e-9)/(1-clamp(p,1e-9,1-1e-9)));
export interface ProbabilityRow {p:number;y:number;date:string;season:number;}
export function probabilityMetrics(rows:ProbabilityRow[]){
 if(!rows.length)return null;
 if(rows.some(r=>!Number.isFinite(r.p)||r.p<0||r.p>1||![0,1].includes(r.y)))throw new Error('Invalid probability/outcome');
 const calibration=Array.from({length:10},(_,i)=>{const b=rows.filter(r=>Math.min(9,Math.floor(r.p*10))===i);return {lower:i/10,count:b.length,meanProbability:b.length?b.reduce((n,r)=>n+r.p,0)/b.length:null,observedRate:b.length?b.reduce((n,r)=>n+r.y,0)/b.length:null,sparse:b.length<30};});
 return {games:rows.length,brier:rows.reduce((n,r)=>n+(r.p-r.y)**2,0)/rows.length,
 logLoss:rows.reduce((n,r)=>{const p=clamp(r.p,1e-12,1-1e-12);return n-r.y*Math.log(p)-(1-r.y)*Math.log(1-p);},0)/rows.length,
 ece:calibration.reduce((n,b)=>n+(b.count/rows.length)*Math.abs((b.meanProbability??0)-(b.observedRate??0)),0),calibration};
}
export function dot(a:number[],b:number[]){if(a.length!==b.length)throw new Error('Feature dimension changed');return a.reduce((n,v,i)=>n+v*b[i],0);}
function solve(matrix:number[][],vector:number[]){
 const a=matrix.map((row,i)=>[...row,vector[i]]),n=vector.length;
 for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
  [a[i],a[pivot]]=[a[pivot],a[i]];if(Math.abs(a[i][i])<1e-12)throw new Error('Singular statistical fit');const d=a[i][i];for(let k=i;k<=n;k++)a[i][k]/=d;
  for(let j=0;j<n;j++)if(j!==i){const scale=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=scale*a[i][k];}}
 return a.map(row=>row[n]);
}
/** Newton logistic regression; mean log loss + L2 around an explicit prior.
 * No automatic refitting outside the caller's named training period. */
export function fitLogistic(rows:{x:number[];y:number}[],lambda:number,prior?:number[],slopeBounds?:[number,number]){
 if(rows.length<30||rows.some(r=>![0,1].includes(r.y)||r.x.some(n=>!Number.isFinite(n)))||new Set(rows.map(r=>r.y)).size!==2||!Number.isFinite(lambda)||lambda<=0)throw new Error('Insufficient/invalid logistic training data');
 const n=rows[0].x.length;if(rows.some(r=>r.x.length!==n)||prior&&prior.length!==n)throw new Error('Feature dimensions');const center=prior??Array(n).fill(0),weights=[...center];
 for(let iteration=0;iteration<60;iteration++){
  const gradient=Array(n).fill(0),hessian=Array.from({length:n},()=>Array(n).fill(0));
  for(const r of rows){const p=sigmoid(dot(weights,r.x)),v=p*(1-p);for(let i=0;i<n;i++){gradient[i]+=(p-r.y)*r.x[i]/rows.length;for(let j=0;j<n;j++)hessian[i][j]+=v*r.x[i]*r.x[j]/rows.length;}}
  for(let i=0;i<n;i++){const penalty=i===0?1e-5:lambda;gradient[i]+=penalty*(weights[i]-center[i]);hessian[i][i]+=penalty;}
  const step=solve(hessian,gradient);for(let i=0;i<n;i++)weights[i]-=clamp(step[i],-1,1);
  if(slopeBounds)weights[1]=clamp(weights[1],...slopeBounds);
  if(Math.max(...step.map(Math.abs))<1e-8)break;
 }
 return weights;
}
export function fitCalibration(rows:ProbabilityRow[]){
 if(rows.length<500)throw new Error('Calibration requires at least 500 earlier games');
 return fitLogistic(rows.map(r=>({x:[1,logit(r.p)],y:r.y})),.01,[0,1],[.25,2]);
}
export const calibratedProbability=(p:number,weights:number[])=>clamp(sigmoid(dot([1,logit(p)],weights)),.01,.99);
/** Paired moving blocks of seven consecutive NBA event dates, within season.
 * Repeated-team dependence beyond these blocks remains a reported limitation. */
export function pairedBlockInterval(rows:(ProbabilityRow&{baseline:number})[],replicates=400){
 const days=[...Map.groupBy(rows,r=>`${r.season}:${r.date}`).values()];if(days.length<14)return null;
 const seasons=[...Map.groupBy(days,d=>d[0].season).values()],deltas:{brier:number;logLoss:number}[]=[];let seed=20261112;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let r=0;r<replicates;r++){const sample:typeof rows=[];for(const season of seasons){let added=0;while(added<season.length){const start=Math.floor(random()*season.length);for(let k=0;k<7&&start+k<season.length&&added<season.length;k++,added++)sample.push(...season[start+k]);}}
  const a=probabilityMetrics(sample)!,b=probabilityMetrics(sample.map(r=>({...r,p:r.baseline})))!;deltas.push({brier:a.brier-b.brier,logLoss:a.logLoss-b.logLoss});}
 const interval=(key:'brier'|'logLoss')=>{const sorted=deltas.map(d=>d[key]).sort((a,b)=>a-b);return [sorted[Math.floor(.025*replicates)],sorted[Math.min(replicates-1,Math.floor(.975*replicates))]] as [number,number];};
 return {method:'paired seven-event-date moving-block bootstrap within season',replicates,seed:20261112,brier:interval('brier'),logLoss:interval('logLoss'),limitations:'Dependence beyond seven event dates and previously inspected history are not eliminated'};
}
