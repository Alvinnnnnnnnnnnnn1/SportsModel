export interface WorkerAttempt {at:string;status:'completed'|'failed'|'disabled'|'blocked';screened:number;registered:number;excluded:number;}
/** Operational health only. A successful run with rejected data is not proof of source quality. */
export function v6WorkerHealth(input:{enabled:boolean;killSwitch:boolean;lastAttempt:WorkerAttempt|null;now:string;maximumGapHours?:number}) {
  const now=Date.parse(input.now),maximum=input.maximumGapHours??26;
  if(!Number.isFinite(now)||!Number.isFinite(maximum)||maximum<=0)throw new Error('Invalid health clock/interval');
  if(input.killSwitch)return {status:'stopped',sourceStatus:'unverified'};
  if(!input.enabled)return {status:'disabled',sourceStatus:'unverified'};
  const last=input.lastAttempt;
  if(!last)return {status:'never_run',sourceStatus:'unverified'};
  const age=now-Date.parse(last.at);
  if(!Number.isFinite(age)||age<0)return {status:'invalid_clock',sourceStatus:'unverified'};
  if(age>maximum*3600000)return {status:'missed_run',sourceStatus:'unverified'};
  if(last.status==='failed')return {status:'failed',sourceStatus:'unverified'};
  if(last.status==='disabled')return {status:'disabled',sourceStatus:'unverified'};
  if(last.status==='blocked')return {status:'recent_run',sourceStatus:'source_permission_blocked'};
  return {status:'recent_run',sourceStatus:last.screened===0?'no_source_data':last.excluded>=last.screened?'all_screened_blocked':'review_required'};
}
