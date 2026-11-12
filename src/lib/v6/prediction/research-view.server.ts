import fs from 'node:fs/promises';import path from 'node:path';
import {loadModel2Slate,latestModel2Results} from './shadow.server';
import type {V6Selection} from '../dashboard';
/** Display-only projection. Raw features, source URLs/bodies and owner IDs stay server side. */
export async function model2ResearchView(root:string,ownerId:string):Promise<V6Selection[]>{
 let files:string[];try{files=await fs.readdir(path.join(root,'model-development/slates'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
 const rows:V6Selection[]=[];
 for(const file of files.filter(f=>/^[a-f0-9-]{36}\.json$/.test(f)).sort()){
  const slate=await loadModel2Slate(root,file.slice(0,-5),ownerId),latest=await latestModel2Results(root,slate);
  for(const fixture of slate.record.fixtures){const result=latest?.record.results.find(r=>r.eventId===fixture.eventId);for(const selection of fixture.selections){const mov=selection.forecasts.find(f=>f.key==='marginElo'),elo=selection.forecasts.find(f=>f.key==='eloOnly'),home=selection.selection===fixture.proof.homeName;
   const verified=result?.status==='verified',won=result?.y===Number(home);
   rows.push({key:slate.record.sourceReceipt+':'+selection.key,eventId:fixture.eventId,fixture:`${fixture.proof.awayName} at ${fixture.proof.homeName}`,sport:'NBA',selection:selection.selection,market:'Full-game moneyline · overtime included',odds:selection.odds,breakEven:1/selection.odds,probability:mov?.probability??null,eloProbability:elo?.probability??null,ev:mov?.decision.estimatedEV??null,startsAt:fixture.proof.startsAt,quoteAt:selection.sourceUpdatedAt,capturedAt:selection.retrievedAt,forecastAt:fixture.generatedAt,frozenAt:slate.record.committedAt??slate.record.at,pass1:mov?.decision.pass1??['independent_forecast_unavailable'],pass2:mov?.decision.pass2??[],limitations:fixture.limitations,outcome:verified?(won?'won':'lost'):'unresolved',homeScore:result?.decision?.result.homeScore??null,awayScore:result?.decision?.result.awayScore??null,decision:mov?.decision.researchDecision??'excluded',deVigProbability:home?fixture.marketHomeProbability:1-fixture.marketHomeProbability,verification:verified?'independently_verified_observational':result?.reason??'result_not_checked',models:selection.forecasts.map(m=>({name:m.name,version:m.version,probability:m.probability,ev:m.decision.estimatedEV,firstPass:m.decision.pass1,secondPass:m.decision.pass2,decision:m.decision.researchDecision})),sourceClass:'prospective_shadow_only'});
  }}
 }
 return rows;
}
