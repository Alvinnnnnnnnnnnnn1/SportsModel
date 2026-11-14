/** Invented fixtures in disposable roots; never private/genuine research. */
import fs from 'node:fs/promises';import path from 'node:path';
import {reconciliationFixture,changed,freeze,start,after} from './v6-reconciliation';
import {digest} from '@/lib/v6/evidence.server';
import {journalV6Repository} from '@/lib/v6/journal-repository.server';
import {registerPaper} from '@/lib/v6/engine';
import {teamEloOnlyProbability} from '@/lib/v6/models';
import type {Forecast,Observation} from '@/lib/v6/types';
export const frozen='2026-11-14T01:00:00.000Z',starts='2026-11-15T00:00:00.000Z',finished='2026-11-15T04:00:00.000Z',owner='SYNTHETIC-V61-TEST-OWNER',base='local-paper/p0-20261114';
export async function write(root:string,file:string,value:unknown){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),JSON.stringify(value,null,2));}
export async function localViewFixture(root:string,register=true){
 const i=JSON.parse(JSON.stringify(reconciliationFixture()).replaceAll(freeze,frozen).replaceAll(start,starts).replaceAll(after,finished).replaceAll('2026-11-13T00:03:00.000Z','2026-11-15T00:03:00.000Z')) as ReturnType<typeof reconciliationFixture>;
 i.proof.statsGameId='21718104';i.originalFixtures=changed(i.originalFixtures,b=>{b.data[0].id=21718104;});i.secondary=changed(i.secondary,b=>{b.data.id=21718104;});i.secondary.sourceUrl=i.secondary.sourceUrl.replace('/7','/21718104');for(const e of [i.originalOdds,i.originalFixtures,i.scores,i.secondary])e.hash=digest(e.raw);
 const permit={format:'edgelab.v6-local-paper-permit',version:1,approved:true,ownerId:owner,recordedAt:'2026-11-14T00:59:00.000Z',scope:'NBA_Sportsbet_local_experimental_paper_batch_2026-11-15',paperOnly:true,hosted:false,challengerRegistration:false,openingReferenceCents:500000,stakeCents:5000,controlArtifactHash:'a'.repeat(64),challengerArtifactHash:'b'.repeat(64)},permitRaw=JSON.stringify(permit,null,2),runId='SYNTHETIC-V61-RUN';
 await write(root,`${base}/approval.json`,permit);await write(root,'source-pilot/config.json',{version:1,ownerId:owner,mode:'dry_run',killSwitch:false,sourcesEnabled:true,modelManifest:null,activationReceipt:null,monthlyOddsCeiling:60,sourceOnly:true});
 const market={sport:'NBA' as const,eventId:'the-odds-api.com:LOCAL',subjectId:i.proof.homeId,statistic:'moneyline' as const,operator:'win' as const,threshold:null,period:'full_game' as const,periodNumber:null,overtime:'included' as const,termsVersion:i.proof.termsVersion};
 const o:Observation={id:crypto.randomUUID(),sourceClass:'prospective',provider:'the-odds-api.com',permissionReference:'https://the-odds-api.com/terms-and-conditions.html',bookmaker:'sportsbet',market,eventStartsAt:starts,odds:1.8,observedAt:frozen,retrievedAt:frozen,sourceUpdatedAt:frozen,sourceUrl:i.originalOdds.sourceUrl,rawHash:i.originalOdds.hash,status:'prematch_open'};
 const team={homeId:i.proof.homeId,awayId:i.proof.awayId,homeRating:1570,awayRating:1500,homeCourt:60 as const,formAdjustment:0,restAdjustment:0,shrinkage:0 as const,historyHash:'c'.repeat(64),registryHash:i.registry.hash,safeEventStartsAt:starts,researchPolicyId:'nba-moneyline-two-pass-1',homeOdds:1.8,awayOdds:2.5},inputs={minutes:null,ratePerMinute:null,surface:null,rating:null,opponentRating:null,sampleSize:600,sourceObservedAt:frozen,sourceUrl:i.originalFixtures.sourceUrl,team};
 const f:Forecast={market,probability:teamEloOnlyProbability(market,team),pushProbability:0,modelId:'nba-team-elo-only',version:'candidate-1',method:'nba_team_elo_only',validation:'chronologically_evaluated',researchTier:'experimental',generatedAt:frozen,inputCutoff:frozen,inputsHash:digest(JSON.stringify(inputs)),evidenceUrls:[i.originalFixtures.sourceUrl],inputs};
 const repo=journalV6Repository(path.join(root,base,'ledger'),owner,'v6-prospective',()=> '2026-11-14T01:00:01.000Z');
 await repo.transact(async s=>{const r=register?await registerPaper(s,o,f,'pre_event_once',frozen):{state:s,reasons:[]};if(r.reasons.length)throw new Error('Bad synthetic test fixture '+r.reasons.join(','));return {...r.state,revision:s.revision+1,runs:[{id:runId,at:frozen,mode:'armed',screened:1,registered:register?1:0,observations:register?[o]:[],rejections:[]}]};});
 const control={eloOnly:f.probability,marginElo:.6,features:.6,challenger:.6,winRate:.6,eloCalibrated:.6,marginCalibrated:.6,featuresCalibrated:.6};
 const execution={format:'edgelab.v6-local-paper-execution',at:frozen,committedAt:'2026-11-14T01:00:01.000Z',runId,sourceReceipt:i.originalOdds.id,financialWrites:0,hostedWrites:0,positions:register?1:0,fixtures:[{proof:i.proof,generatedAt:frozen,inputCutoff:frozen,controlArtifactHash:permit.controlArtifactHash,challengerArtifactHash:permit.challengerArtifactHash,control,challenger:control,controlReasons:[],challengerReasons:['experimental'],limitations:['SYNTHETIC TEST ONLY'],selections:[{selection:i.proof.homeName,odds:1.8,breakEven:1/1.8,marketProbability:.58,quoteAt:frozen,eloProbability:f.probability,reasons:[]}]}]};
 await write(root,`${base}/execution.json`,execution);await write(root,`${base}/capture.json`,{synthetic:true});
 const executionHash=digest(await fs.readFile(path.join(root,base,'execution.json'),'utf8'));
 await write(root,`${base}/initial-research-seal.json`,{format:'edgelab.v6-local-paper-research-seal',version:1,sealedAt:'2026-11-14T01:00:02.000Z',generatedAt:frozen,executionHash,captureHash:digest(await fs.readFile(path.join(root,base,'capture.json'),'utf8')),approvalHash:digest(permitRaw),sourceReceipt:i.originalOdds.id});
 const scope={format:'edgelab.v6-bounded-local-paper-consumer',version:1,enabled:true,approvalHash:digest(permitRaw),initialExecutionHash:executionHash,fixtureIds:['21718104','21718105','21718106','21718107','21718108'],expiresAt:'2026-11-15T00:59:00.000Z',providerRequestsAllowed:0,globalUnattendedRegistration:false,hosted:false};
 await write(root,`${base}/consumer-scope.json`,scope);
 const body=JSON.stringify({proof:i.proof,registry:i.registry,originalFixtures:i.originalFixtures,originalOdds:i.originalOdds});await write(root,`${base}/registration-context.json`,{approvalHash:digest(JSON.stringify(permit)),sourceReceipt:i.originalOdds.id,at:frozen,proofs:register?{[o.id]:{hash:digest(body)}}:{}});
 await fs.mkdir(path.join(root,base,'proofs'),{recursive:true});await fs.writeFile(path.join(root,base,'proofs',o.id+'.json'),body);
 for(const e of [i.originalOdds,i.originalFixtures,i.scores,i.secondary])await write(root,`evidence-receipts/${e.id}.json`,e);
 return {i,o,f,permit,permitRaw,scope,execution,repo};
}
