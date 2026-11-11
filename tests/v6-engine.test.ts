import { describe,it,expect } from 'vitest';
import { appendGrade, decisionKey, exactMarket, gradeCount, hypotheticalProfit, paperAccounting, qualification, registerPaper } from '@/lib/v6/engine';
import { poissonCountProbability,surfaceEloProbability,deVig } from '@/lib/v6/models';
import { emptyV6State, v6StateSchema } from '@/lib/v6/types';
import { now,observation,forecast,grade } from './fixtures/v6';

describe('isolated V6 uncapped notional paper domain',()=>{
  it('registers every distinct qualifying position beyond opening reference without deposits, caps or a balance gate',async()=>{
    let state=emptyV6State('LOCAL-owner','v6-synthetic');
    for(let i=0;i<121;i++){const o=observation(i);const result=await registerPaper(state,o,await forecast(o),'pre_event_once',now);expect(result.reasons).toEqual([]);state=result.state;}
    expect(state.positions).toHaveLength(121);
    expect(paperAccounting(state)).toMatchObject({openingReferenceCents:500000,pendingCents:605000,availableCents:-105000,virtualExcessExposureCents:105000,profitCents:0,roi:null,uniqueFixtures:1});
    expect((state as unknown as Record<string,unknown>).transactions).toBeUndefined();
  });
  it('keeps distinct exact lines while preventing repricing replay for the same market/window/policy',async()=>{
    const o=observation(),f=await forecast(o),first=await registerPaper(emptyV6State('LOCAL','v6-synthetic'),o,f,'pre_event_once',now);
    const changed=structuredClone(o);changed.odds=2;changed.id=crypto.randomUUID();
    expect((await registerPaper(first.state,changed,f,'pre_event_once',now)).state).toBe(first.state);
    changed.market.threshold=22;
    expect(exactMarket(changed.market,o.market)).toBe(false);
    expect(await decisionKey(changed,'pre_event_once')).not.toBe(await decisionKey(o,'pre_event_once'));
    expect((await registerPaper(first.state,changed,await forecast(changed),'pre_event_once',now)).state.positions).toHaveLength(2);
    o.odds=99;expect(first.position?.observation.odds).toBe(1.9);
  });
  it('grades exact integer-count boundaries independently and calculates deterministic model baselines',()=>{
    const m=observation().market;
    expect(gradeCount({...m,operator:'gte',threshold:3},3)).toBe('won');
    expect(gradeCount({...m,operator:'gt',threshold:3.5},3)).toBe('lost');
    expect(gradeCount({...m,operator:'lt',threshold:26.5},26)).toBe('won');
    expect(gradeCount({...m,operator:'gt',threshold:3},3)).toBe('push');
    expect(gradeCount({...m,operator:'gte',threshold:3},3.1)).toBe('unresolved');
    expect(poissonCountProbability({...m,statistic:'threes',operator:'gte',threshold:3},30,.1)).toBeGreaterThan(poissonCountProbability({...m,statistic:'threes',operator:'gt',threshold:3.5},30,.1));
    expect(surfaceEloProbability(1500,1500)).toBe(.5);expect(surfaceEloProbability(1700,1500)).toBeGreaterThan(.5);
    expect(deVig([1.9],false)).toBeNull();expect(deVig([1.9,1.9],true)).toEqual([.5,.5]);
  });
  it('rejects missing independent forecasts, stale/future prices, experimental models, look-ahead, wrong terms and synthetic contamination',async()=>{
    const o=observation(),f=await forecast(o);
    expect(qualification(o,null,now,'v6-synthetic')).toContain('no_independent_forecast');
    expect(qualification(o,f,now,'v6-prospective')).toContain('cohort_mismatch');
    expect(qualification({...o,sourceUpdatedAt:null},f,now,'v6-synthetic')).toContain('source_timestamp_unknown');
    expect(qualification({...o,observedAt:'2026-11-10T00:00:00Z'},f,now,'v6-synthetic')).toContain('stale_quote');
    expect(qualification(o,{...f,validation:'experimental'},now,'v6-synthetic')).toContain('model_not_validated');
    expect(qualification(o,{...f,probability:.01},now,'v6-synthetic')).toContain('unreproducible_probability');
    const integer={...o,market:{...o.market,operator:'gt' as const,threshold:21}},integerForecast=await forecast(integer);
    expect(integerForecast.pushProbability).toBeGreaterThan(0);
    expect(qualification(integer,{...integerForecast,pushProbability:0},now,'v6-synthetic')).toContain('unreproducible_push_probability');
    expect(qualification(o,{...f,market:{...f.market,overtime:'excluded'}},now,'v6-synthetic')).toContain('forecast_market_mismatch');
    expect((await registerPaper(emptyV6State('LOCAL','v6-synthetic'),o,{...f,inputsHash:'0'.repeat(64)},'pre_event_once',now)).reasons).toContain('model_inputs_hash_mismatch');
  });
  it('settles exact cents and append-only corrections once without changing original forecasts',async()=>{
    const o=observation();const first=await registerPaper(emptyV6State('LOCAL','v6-synthetic'),o,await forecast(o),'pre_event_once',now),p=first.position!;
    expect(hypotheticalProfit(p,'won')).toBe(4500);expect(hypotheticalProfit(p,'lost')).toBe(-5000);expect(hypotheticalProfit(p,'void')).toBe(0);expect(hypotheticalProfit(p,'push')).toBe(0);
    const g=await grade(p);let state=await appendGrade(first.state,g);expect((await appendGrade(state,g))).toBe(state);
    expect(paperAccounting(state)).toMatchObject({profitCents:4500,roi:.9,wins:1,pendingCents:0});
    const correction={...await grade(p,'lost'),revision:2,previousGradeId:g.id};state=await appendGrade(state,correction);
    expect(paperAccounting(state)).toMatchObject({profitCents:-5000,roi:-1,losses:1,wins:0});expect(state.positions[0]).toEqual(p);
    await expect(appendGrade(state,{...correction,id:crypto.randomUUID()})).rejects.toThrow(/Stale/);
    await expect(appendGrade(first.state,{...g,subjectId:'wrong'})).rejects.toThrow(/identity/);
    await expect(appendGrade(first.state,{...g,exception:'dnp'})).rejects.toThrow(/unresolved/);
    const fractional={...p,observation:{...p.observation,odds:1.9001}};expect(hypotheticalProfit(fractional,'won')).toBe(4501);
    expect(()=>v6StateSchema.parse({...state,positions:[p,p]})).toThrow(/Duplicate/);
  });
});
