/** Offline child process. Explicit local inputs, no .env/API/session/worker. */
import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';
const spec=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
if(spec.format!=='edgelab.v6-offline-replay'||spec.registerPositions!==false)throw new Error('Offline replay specification required');
globalThis.fetch=async()=>{throw new Error('Network forbidden in offline model replay');};
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const {teamEloProbability,teamEloOnlyProbability}=await loader.ssrLoadModule('/src/lib/v6/models.ts');
 const {forecastTeamGame,diagnoseHistoricalTeamState}=await loader.ssrLoadModule('/src/lib/v6/team-model.ts');
 const {forecastDevelopmentModels,predictionArtifactSchema}=await loader.ssrLoadModule('/src/lib/v6/prediction/forecast.ts');
 const {evaluatePredictionDevelopment}=await loader.ssrLoadModule('/src/lib/v6/prediction/evaluation.ts');
 const {marginFeatureReplay,featureProbability}=await loader.ssrLoadModule('/src/lib/v6/prediction/models.ts'),{calibratedProbability}=await loader.ssrLoadModule('/src/lib/v6/prediction/statistics.ts');
 const rows=JSON.parse(await fs.readFile(path.resolve(spec.historyFile),'utf8'));
 const artifact=spec.artifactFile?JSON.parse(await fs.readFile(path.resolve(spec.artifactFile),'utf8')):null;
 if(artifact)predictionArtifactSchema.parse(artifact);
 if(spec.evaluateArtifact){const evaluation=await evaluatePredictionDevelopment(rows);console.log(JSON.stringify({artifactHash:evaluation.artifactHash,artifact:evaluation.artifact,historyHash:digest(JSON.stringify(rows)),registerPositions:false}));}
 else if(spec.retrospectiveDiagnostic===true){
  const fixtures=spec.queries.map(input=>{const state=diagnoseHistoricalTeamState(rows,{...input,originalCutoff:input.at,sameDateBlock:false}),dated=diagnoseHistoricalTeamState(rows,{...input,originalCutoff:input.at,sameDateBlock:true}),f=state.features,base=dated.features;
   let probabilities=null;if(artifact){const replay=marginFeatureReplay(dated.history,artifact.marginParameters),features=replay.featureSnapshot(input.home,input.away,input.season);if(!features)throw new Error('Missing reconstructed features');const margin=features.marginProbability,p=featureProbability(features.x,artifact.coefficients);probabilities={eloOnly:base.eloOnly,challenger:base.challenger,winRate:base.historicalWinRate,marginElo:margin,features:p,eloCalibrated:calibratedProbability(base.eloOnly,artifact.calibrators.eloOnly),marginCalibrated:calibratedProbability(margin,artifact.calibrators.marginElo),featuresCalibrated:calibratedProbability(p,artifact.calibrators.features)};}
   return {input,classification:state.classification,registrationAllowed:false,actualLatestRetrieval:state.actualLatestRetrieval,sourceAvailableAtOriginalCutoff:state.sourceAvailableAtOriginalCutoff,frozenSelections:(input.selections??[]).map(s=>({key:s.key,probability:(s.method==='nba_team_elo_only'?teamEloOnlyProbability:teamEloProbability)(s.market,{homeId:s.homeId,awayId:s.awayId,homeRating:f.homeRating,awayRating:f.awayRating,homeCourt:60,formAdjustment:s.method==='nba_team_elo_only'?0:f.formAdjustment,restAdjustment:s.method==='nba_team_elo_only'?0:f.restAdjustment,shrinkage:s.method==='nba_team_elo_only'?0:.05})})),baseline:{eloOnly:f.eloOnly,challenger:f.challenger,winRate:f.historicalWinRate},probabilities};});console.log(JSON.stringify({historyHash:digest(JSON.stringify(rows)),artifactHash:artifact?digest(JSON.stringify(artifact)):null,fixtures,registerPositions:false,classification:'RETROSPECTIVE_RECONSTRUCTION_DIAGNOSTIC'}));
 }
 else{const fixtures=[];for(const input of spec.queries){const b=await forecastTeamGame(rows,input),development=artifact?await forecastDevelopmentModels(rows,artifact,input):null;
  const frozenSelections=(input.selections??[]).map(s=>{const f=b.forecast?.inputs.features;return {key:s.key,probability:f?(s.method==='nba_team_elo_only'?teamEloOnlyProbability:teamEloProbability)(s.market,{homeId:s.homeId,awayId:s.awayId,homeRating:f.homeRating,awayRating:f.awayRating,homeCourt:60,formAdjustment:s.method==='nba_team_elo_only'?0:f.formAdjustment,restAdjustment:s.method==='nba_team_elo_only'?0:f.restAdjustment,shrinkage:s.method==='nba_team_elo_only'?0:.05}):null};});
  fixtures.push({input,frozenSelections,baseline:b.forecast?{eloOnly:b.forecast.eloOnlyHome,challenger:b.forecast.probabilityHome,winRate:b.forecast.historicalWinRateHome}:null,probabilities:development?.probabilities??null,reasons:b.reasons,historyHash:b.forecast?.inputs.historyHash??null});}
 console.log(JSON.stringify({historyHash:digest(JSON.stringify(rows)),artifactHash:artifact?digest(JSON.stringify(artifact)):null,fixtures,registerPositions:false}));}
}finally{await loader.close();}
