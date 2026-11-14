import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {digest,type RawEvidence} from './evidence.server';
import {journalV6Repository} from './journal-repository.server';
import {appendGrade,paperAccounting,hypotheticalProfit,qualification,decisionKey} from './engine';
import {teamGames} from './team-games';
import {resolveTeamLabel} from './team-identity';
import {TEAM_FIXTURE_MATCH,TEAM_TERMS} from './team-pilot';
import {gradeReconciledTeamPosition} from './reconciled-grading';
import {probabilityMetrics,type ProbabilityRow} from './prediction/statistics';
import {controlledConfigSchema} from './controlled-activation';
import type {V6Dashboard,V6Selection} from './dashboard';
import type {TeamFixtureProof} from './team-pilot';
import type {TeamRegistry} from './team-identity';

const base='local-paper/p0-20261114',stamp=z.string().datetime({offset:true}),hash=z.string().regex(/^[a-f0-9]{64}$/),text=z.string().min(1).max(500),prob=z.number().finite().min(0).max(1);
type QuotedMarket={key:string;last_update?:string;outcomes:{name:string;price:number}[]};
type OddsFixture={id:string;home_team:string;away_team:string;commence_time:string;bookmakers:{key:string;markets:QuotedMarket[]}[]};
const fixtureIds=['21718104','21718105','21718106','21718107','21718108'];
export const localPermitSchema=z.object({format:z.literal('edgelab.v6-local-paper-permit'),version:z.literal(1),approved:z.literal(true),ownerId:text,recordedAt:stamp,scope:z.literal('NBA_Sportsbet_local_experimental_paper_batch_2026-11-15'),paperOnly:z.literal(true),hosted:z.literal(false),challengerRegistration:z.literal(false),openingReferenceCents:z.literal(500000),stakeCents:z.literal(5000),controlArtifactHash:hash,challengerArtifactHash:hash});
const scopeSchema=z.object({format:z.literal('edgelab.v6-bounded-local-paper-consumer'),version:z.literal(1),enabled:z.boolean(),approvalHash:hash,initialExecutionHash:hash,fixtureIds:z.array(z.string()),expiresAt:stamp,providerRequestsAllowed:z.literal(0),globalUnattendedRegistration:z.literal(false),hosted:z.literal(false)});
const models=z.object({eloOnly:prob,marginElo:prob,features:prob,challenger:prob,winRate:prob,eloCalibrated:prob,marginCalibrated:prob,featuresCalibrated:prob}).nullable();
const selection=z.object({selection:text,odds:z.number().min(1.0001).max(10000),breakEven:prob.nullable(),marketProbability:prob.nullable(),quoteAt:stamp.nullable(),eloProbability:prob.nullable(),reasons:z.array(text)});
const fixture=z.object({proof:z.object({eventId:text.nullable(),statsGameId:z.string(),homeName:text,awayName:text,earliestStartsAt:stamp}),generatedAt:stamp,inputCutoff:stamp,controlArtifactHash:hash,challengerArtifactHash:hash,control:models,challenger:models,controlReasons:z.array(text),challengerReasons:z.array(text),limitations:z.array(text),selections:z.array(selection).max(2)});
const executionSchema=z.object({format:z.literal('edgelab.v6-local-paper-execution'),at:stamp,committedAt:stamp,runId:text,sourceReceipt:z.string().uuid(),financialWrites:z.literal(0),hostedWrites:z.literal(0),fixtures:z.array(fixture).max(5),positions:z.number().int().nonnegative()});
const sealSchema=z.object({format:z.literal('edgelab.v6-local-paper-research-seal'),version:z.literal(1),sealedAt:stamp,generatedAt:stamp,executionHash:hash,captureHash:hash,approvalHash:hash,sourceReceipt:z.string().uuid()});
/** Pure constructor shared with the writer; binds THIS cycle's exact bytes. */
export function localResearchSeal(executionRaw:string,permitRaw:string,captureHash:string,sealedAt:string){const e=executionSchema.parse(JSON.parse(executionRaw));return sealSchema.parse({format:'edgelab.v6-local-paper-research-seal',version:1,sealedAt,generatedAt:e.at,executionHash:digest(executionRaw),captureHash,approvalHash:digest(permitRaw),sourceReceipt:e.sourceReceipt});}
const receiptSchema=z.object({id:z.string().uuid(),provider:z.enum(['the-odds-api.com','balldontlie']),sourceUrl:z.string().url(),retrievedAt:stamp,sourceUpdatedAt:stamp.nullable(),raw:z.string().max(16000000),hash});

/** Fixed relative paths only; no browser-provided filename, symlinks, credentials
 * or unbounded file reads. This reader has no persistence/provider capability. */
async function safePath(root:string,relative:string){
 const home=await fs.realpath(root),parts=relative.split('/');let file=home;
 for(const part of parts){if(!part||part==='.'||part==='..'||part.includes(path.sep))throw new Error('Invalid evidence path');file=path.join(file,part);if((await fs.lstat(file)).isSymbolicLink())throw new Error('Evidence symlink rejected');}
 if(!(await fs.realpath(file)).startsWith(home+path.sep))throw new Error('Evidence escaped root');return file;
}
async function bytes(root:string,relative:string){const file=await safePath(root,relative),stat=await fs.stat(file);if(!stat.isFile()||stat.size>64000000)throw new Error('Invalid evidence size/type');return fs.readFile(file,'utf8');}
const json=async(root:string,relative:string)=>JSON.parse(await bytes(root,relative));
async function exists(root:string,relative:string){try{await safePath(root,relative);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}}
async function receipt(root:string,id:string){const value=receiptSchema.parse(await json(root,`evidence-receipts/${z.string().uuid().parse(id)}.json`));if(value.id!==id||digest(value.raw)!==value.hash)throw new Error('Source receipt integrity');const u=new URL(value.sourceUrl);if(u.username||u.password||[...u.searchParams.keys()].some(k=>/key|token|password|secret/i.test(k))||u.origin!==(value.provider==='balldontlie'?'https://api.balldontlie.io':'https://api.the-odds-api.com'))throw new Error('Source receipt origin');return value;}

/** Also used at the real commit boundary: expiry is checked AFTER calculation,
 * never extended by dashboard access, retries, changed scope or a running job. */
export async function boundedLocalCommitAllowed(root:string,permitRaw:string,scopeRaw:string|null,now?:string){
 if(process.env.VERCEL==='1'||process.env.V6_EVIDENCE_MODE==='cloud')return false;
 const permit=localPermitSchema.parse(JSON.parse(permitRaw)),at=Date.parse(now??new Date().toISOString()),start=Date.parse(permit.recordedAt);
 if(!Number.isFinite(at)||at<start||at>=start+86400000||await bytes(root,`${base}/approval.json`)!==permitRaw)return false;
 if(scopeRaw){if(await bytes(root,`${base}/consumer-scope.json`)!==scopeRaw)return false;const s=scopeSchema.parse(JSON.parse(scopeRaw));if(!s.enabled||s.approvalHash!==digest(permitRaw)||Date.parse(s.expiresAt)!==start+86400000||s.fixtureIds.slice().sort().join(',')!==fixtureIds.join(','))return false;}
 const config=controlledConfigSchema.parse(await json(root,'source-pilot/config.json'));
 return (now!==undefined?Date.parse(now):Date.now())<start+86400000&&config.ownerId===permit.ownerId&&config.sourceOnly===true&&config.mode==='dry_run'&&config.sourcesEnabled&&!config.killSwitch&&!await exists(root,'source-pilot/STOP')&&!await exists(root,`${base}/STOP`);
}

export async function loadLocalPaperView(root:string,researchOwnerId:string,now:string){
 if(process.env.VERCEL==='1'||process.env.V6_EVIDENCE_MODE==='cloud')throw new Error('Local PAPER journal is not a hosted evidence source');
 const permitRaw=await bytes(root,`${base}/approval.json`),permit=localPermitSchema.parse(JSON.parse(permitRaw)),scope=scopeSchema.parse(await json(root,`${base}/consumer-scope.json`));
 if(permit.ownerId!==researchOwnerId||scope.approvalHash!==digest(permitRaw)||scope.fixtureIds.slice().sort().join(',')!==fixtureIds.join(',')||Date.parse(scope.expiresAt)!==Date.parse(permit.recordedAt)+86400000||Date.parse(permit.recordedAt)>Date.parse(now))throw new Error('Local paper owner/scope mismatch');
 const readExecution=async(relative:string,initial=false)=>{
  const raw=await bytes(root,`${relative}/execution.json`),e=executionSchema.parse(JSON.parse(raw)),s=sealSchema.parse(await json(root,`${relative}/${initial?'initial-research-seal':'research-seal'}.json`));
  if(Date.parse(e.at)<Date.parse(permit.recordedAt)||Date.parse(e.committedAt)<Date.parse(e.at)||Date.parse(e.committedAt)>=Date.parse(scope.expiresAt)||digest(raw)!==s.executionHash||s.approvalHash!==digest(permitRaw)||e.sourceReceipt!==s.sourceReceipt||s.generatedAt!==e.at||Date.parse(s.sealedAt)<Date.parse(e.committedAt)||Date.parse(s.sealedAt)>Date.parse(now)||e.fixtures.some(f=>!fixtureIds.includes(f.proof.statsGameId)||f.controlArtifactHash!==permit.controlArtifactHash||f.challengerArtifactHash!==permit.challengerArtifactHash||f.generatedAt!==e.at||Date.parse(f.inputCutoff)>Date.parse(e.at)||Date.parse(e.committedAt)>=Date.parse(f.proof.earliestStartsAt))||new Set(e.fixtures.map(f=>f.proof.statsGameId)).size!==e.fixtures.length)throw new Error('Frozen research seal/clock mismatch');
  if(initial&&(digest(await bytes(root,`${base}/capture.json`))!==s.captureHash||scope.initialExecutionHash!==s.executionHash))throw new Error('Original capture changed');
  const r=await receipt(root,e.sourceReceipt);if(r.provider!=='the-odds-api.com'||new URL(r.sourceUrl).pathname!=='/v4/sports/basketball_nba/odds'||Date.parse(r.retrievedAt)>Date.parse(e.at)||Date.parse(e.at)-Date.parse(r.retrievedAt)>300000)throw new Error('Research source receipt/clock mismatch');
  // Matched prices must occur in the exact retained bookmaker/event/selection.
  const markets=z.array(z.object({id:z.string(),bookmakers:z.array(z.object({key:z.string(),last_update:stamp.nullable().optional(),markets:z.array(z.object({key:z.string(),last_update:stamp.nullable().optional(),outcomes:z.array(z.object({name:z.string(),price:z.number()}))}))}))})).parse(JSON.parse(r.raw));
  for(const f of e.fixtures)for(const q of f.selections){const event=markets.find(g=>g.id===f.proof.eventId),book=event?.bookmakers.find(b=>b.key==='sportsbet'),market=book?.markets.find(m=>m.key==='h2h');if(!market?.outcomes.some(o=>o.name===q.selection&&o.price===q.odds)||(q.quoteAt===null?(market.last_update??book?.last_update??null)!==null:Date.parse(q.quoteAt)!==Date.parse(market.last_update??book?.last_update??'')))throw new Error('Unattributable research quote');}
  return {e,r};
 };
 const initial=await readExecution(base,true),reports=[initial];
 if(await exists(root,`${base}/cycles`))for(const name of (await fs.readdir(await safePath(root,`${base}/cycles`))).sort()){if(!z.string().uuid().safeParse(name).success)continue;reports.push(await readExecution(`${base}/cycles/${name}`));}
 const ledgerPath=await safePath(root,`${base}/ledger`),files=(await fs.readdir(ledgerPath)).filter(n=>/^\d{12}\.json$/.test(n));if(!files.length||files.length>10000)throw new Error('Missing or oversized committed ledger');for(const name of files)await bytes(root,`${base}/ledger/${name}`);
 const {state,integrity}=await journalV6Repository(ledgerPath,researchOwnerId).snapshot();
 if(reports.some(({e})=>!state.runs.some(r=>r.id===e.runId)))throw new Error('Research run absent from committed journal');
 if(!integrity.files||state.runs.some(r=>Date.parse(r.at)>Date.parse(now))||Date.parse(integrity.lastCommitAt!)>Date.parse(now))throw new Error('Future journal clock');
 const contexts=await Promise.all(reports.map(async({e})=>{const relative=e===initial.e?base:`${base}/cycles/${e.sourceReceipt}`,c=await json(root,`${relative}/registration-context.json`);if(c.approvalHash!==digest(JSON.stringify(JSON.parse(permitRaw)))||c.sourceReceipt!==e.sourceReceipt||c.at!==e.at)throw new Error('Registration context mismatch');return c;}));
 const proofs=new Map<string,{proof:TeamFixtureProof;registry:TeamRegistry;originalFixtures:RawEvidence;originalOdds:RawEvidence}>();
 for(const p of state.positions){
  if(!p.forecast||p.forecast.method!=='nba_team_elo_only'||p.forecast.modelId!=='nba-team-elo-only'||p.forecast.version!=='candidate-1'||Date.parse(p.registeredAt)>=Date.parse(scope.expiresAt)||Date.parse(p.registeredAt)<Date.parse(permit.recordedAt)||p.observation.bookmaker!=='sportsbet'||qualification(p.observation,p.forecast,p.registeredAt,'v6-prospective').length||digest(JSON.stringify(p.forecast.inputs))!==p.forecast.inputsHash)throw new Error('Unqualified local position');
  const context=contexts.find(c=>c.proofs?.[p.observation.id]),body=await bytes(root,`${base}/proofs/${p.observation.id}.json`);if(!context||digest(body)!==context.proofs[p.observation.id].hash)throw new Error('Registered proof hash mismatch');
  const proof=JSON.parse(body);if(!fixtureIds.includes(proof.proof.statsGameId)||!reports.some(({e})=>e.runId===state.runs.find(r=>r.observations.some(o=>o.id===p.observation.id))?.id&&e.fixtures.some(f=>f.proof.statsGameId===proof.proof.statsGameId)))throw new Error('Registered fixture/run outside permit');
  for(const original of [proof.originalFixtures,proof.originalOdds]){const r=await receipt(root,original.id);for(const key of ['raw','hash','provider','sourceUrl','retrievedAt','sourceUpdatedAt'])if(r[key as keyof typeof r]!==original[key])throw new Error('Original registered receipt changed');}
  const t=proof.proof as TeamFixtureProof,registry=proof.registry as TeamRegistry,{hash:registryHash,...registryBody}=registry;
  const original=(JSON.parse(proof.originalOdds.raw) as OddsFixture[]).find(g=>g.id===t.eventId),market=original?.bookmakers.find(b=>b.key==='sportsbet')?.markets.find(m=>m.key==='h2h');
  const games=await teamGames(proof.originalFixtures),matches=games.filter(g=>g.sourceGameId===t.statsGameId&&g.home.name===t.statsHomeName&&g.away.name===t.statsAwayName),game=matches[0],team=p.forecast.inputs.team!;
  if(!original||matches.length!==1||!game.startsAt||registryHash!==digest(JSON.stringify(registryBody))||registryHash!==t.registryHash||Date.parse(registry.recordedAt)>Date.parse(p.registeredAt)||resolveTeamLabel(registry,original.home_team)?.canonicalId!==t.homeId||resolveTeamLabel(registry,original.away_team)?.canonicalId!==t.awayId||original.home_team!==t.homeName||original.away_team!==t.awayName||Date.parse(original.commence_time)!==Date.parse(t.startsAt)||Date.parse(game.startsAt)!==Date.parse(t.statsStartsAt!)||Math.abs(Date.parse(game.startsAt)-Date.parse(t.startsAt))>TEAM_FIXTURE_MATCH.maximumDifferenceSeconds*1000||Date.parse(t.earliestStartsAt)!==Math.min(Date.parse(t.startsAt),Date.parse(game.startsAt))||team.homeId!==t.homeId||team.awayId!==t.awayId||team.registryHash!==t.registryHash||team.safeEventStartsAt!==t.earliestStartsAt||p.observation.market.eventId!=='the-odds-api.com:'+t.eventId||![t.homeId,t.awayId].includes(p.observation.market.subjectId)||p.observation.market.statistic!=='moneyline'||p.observation.market.termsVersion!==TEAM_TERMS.version||p.observation.rawHash!==proof.originalOdds.hash||Date.parse(p.observation.eventStartsAt)!==Date.parse(t.startsAt)||Date.parse(p.observation.sourceUpdatedAt!)!==Date.parse(market?.last_update??'')||!market?.outcomes.some(o=>o.name===(p.observation.market.subjectId===t.homeId?t.homeName:t.awayName)&&o.price===p.observation.odds)||p.key!==await decisionKey(p.observation,p.decisionWindow))throw new Error('Registered exact fixture/quote mismatch');
  proofs.set(p.id,proof);
 }
 let checked={...state,grades:[] as typeof state.grades};
 const receipts:RawEvidence[]=[];
 if(state.grades.length){const names=(await fs.readdir(await safePath(root,'evidence-receipts'))).filter(n=>z.string().uuid().safeParse(n.replace(/\.json$/,'')).success&&n.endsWith('.json'));for(const name of names){const raw=await json(root,`evidence-receipts/${name}`);if(raw.provider==='the-odds-api.com'&&new URL(raw.sourceUrl).pathname.endsWith('/scores')||raw.provider==='balldontlie'&&/^\/v1\/games\/\d+$/.test(new URL(raw.sourceUrl).pathname))receipts.push(await receipt(root,raw.id));}}
 for(const g of state.grades){
  if(Date.parse(g.recordedAt)>Date.parse(now)||!g.rawEvidence)throw new Error('Unverified grade');
  const raw=JSON.parse(g.rawEvidence),scores=receipts.find(r=>r.provider==='the-odds-api.com'&&r.raw===raw.scores&&Date.parse(r.retrievedAt)<=Date.parse(g.recordedAt)),secondary=receipts.find(r=>r.provider==='balldontlie'&&r.raw===raw.secondary&&Date.parse(r.retrievedAt)<=Date.parse(g.recordedAt));if(!scores||!secondary)throw new Error('Independent result receipts unavailable');
  const p=state.positions.find(p=>p.id===g.positionId)!,previous=checked.grades.filter(x=>x.positionId===p.id).at(-1)??null,reproduced=await gradeReconciledTeamPosition(p,{...proofs.get(p.id)!,scores,secondary,at:g.recordedAt},previous);
  if(!reproduced.grade||reproduced.grade.sourceHash!==g.sourceHash||reproduced.grade.outcome!==g.outcome||reproduced.grade.winnerId!==g.winnerId)throw new Error('Independent grade reproduction failed');checked=await appendGrade(checked,g);
 }
 const a=paperAccounting(checked),selections:V6Selection[]=[];
 for(const {e,r} of reports)for(const f of e.fixtures)for(const home of [true,false]){
  const name=home?f.proof.homeName:f.proof.awayName,q=f.selections.find(q=>q.selection===name),models=[...(['control','challenger'] as const).flatMap(lineage=>Object.entries(f[lineage]??{}).map(([key,p])=>({name:`${lineage==='control'?'Original':'BDL experimental'} · ${key}`,version:lineage==='control'?f.controlArtifactHash:f.challengerArtifactHash,probability:home?p:1-p,ev:null,firstPass:q?.reasons??['Sportsbet_exact_quote_unavailable'],secondPass:lineage==='challenger'?[...f.challengerReasons,'challenger_not_approved_for_registration']:f.controlReasons,decision:'observational_research_only'})))];
  selections.push({key:digest(`${e.sourceReceipt}:${f.proof.statsGameId}:${name}`),eventId:f.proof.eventId??`balldontlie:${f.proof.statsGameId}`,statsEventId:f.proof.statsGameId,inputCutoff:f.inputCutoff,fixture:`${f.proof.awayName} at ${f.proof.homeName}`,sport:'NBA',selection:name,market:'Full-game moneyline · overtime included',odds:q?.odds??null,breakEven:q?.breakEven??null,probability:f.control?(home?f.control.eloOnly:1-f.control.eloOnly):null,eloProbability:f.control?(home?f.control.eloOnly:1-f.control.eloOnly):null,ev:null,startsAt:f.proof.earliestStartsAt,quoteAt:q?.quoteAt??null,capturedAt:r.retrievedAt,forecastAt:f.generatedAt,frozenAt:e.committedAt,pass1:q?.reasons??['Sportsbet_exact_quote_unavailable'],pass2:f.controlReasons,limitations:f.limitations,outcome:'unresolved',homeScore:null,awayScore:null,decision:'observational_research_only',sourceClass:'bounded_local_research',models});
 }
 const settled=state.grades.filter(g=>g.outcome!=='unresolved').sort((x,y)=>x.recordedAt.localeCompare(y.recordedAt));let running=500000;
 const positions=state.positions.map(p=>{const g=state.grades.filter(g=>g.positionId===p.id).at(-1),proof=proofs.get(p.id)!.proof,profit=g?hypotheticalProfit(p,g.outcome):null;return {id:p.id,fixture:`${proof.awayName} at ${proof.homeName}`,market:`Full-game moneyline · overtime included · ${p.observation.market.termsVersion}`,selection:p.observation.market.subjectId===proof.homeId?proof.homeName:proof.awayName,odds:p.observation.odds,probability:p.forecast!.probability,stakeCents:p.stakeCents,registeredAt:p.registeredAt,quoteAt:p.observation.sourceUpdatedAt,forecastAt:p.forecast!.generatedAt,outcome:g?.outcome??'pending',profitCents:profit,tier:p.researchTier??'experimental',modelId:p.forecast!.modelId,modelVersion:p.forecast!.version,inputCutoff:p.forecast!.inputCutoff,returnCents:profit===null?null:p.stakeCents+profit,settledAt:g?.recordedAt??null,correlationGroup:p.observation.market.eventId,equityAfterCents:null as number|null};});
 // Latest retained grade per position, ordered by its real commit clock. Corrections
 // replace that position's contribution, never double the opening reference.
 const contributions=new Map<string,number>();for(const g of [...state.grades].sort((x,y)=>x.recordedAt.localeCompare(y.recordedAt))){const p=state.positions.find(p=>p.id===g.positionId)!,profit=hypotheticalProfit(p,g.outcome)??0;running+=profit-(contributions.get(p.id)??0);contributions.set(p.id,profit);positions.find(row=>row.id===p.id)!.equityAfterCents=running;}
 const stopped=await exists(root,'source-pilot/STOP')||await exists(root,`${base}/STOP`),config=controlledConfigSchema.parse(await json(root,'source-pilot/config.json'));if(config.ownerId!==researchOwnerId||!config.sourceOnly)throw new Error('Source owner mismatch');
 const killed=stopped||config.killSwitch||config.mode!=='dry_run'||!config.sourcesEnabled,lastCaptureAt=reports.map(x=>x.r.retrievedAt).sort().at(-1)!,keys=new Set(reports.flatMap(({e})=>e.fixtures.filter(f=>f.control).map(f=>f.proof.statsGameId)));
 const samples:Record<string,ProbabilityRow[]>={'Elo control':[],'BDL experimental challenger':[],'Sportsbet de-vig benchmark':[]};
 const scoredFixtures=new Set<string>();
 for(const p of [...state.positions].sort((x,y)=>x.registeredAt.localeCompare(y.registeredAt))){
  const g=state.grades.filter(g=>g.positionId===p.id).at(-1);if(!g||!['won','lost'].includes(g.outcome)||scoredFixtures.has(p.observation.market.eventId))continue;scoredFixtures.add(p.observation.market.eventId);
  const proof=proofs.get(p.id)!.proof,home=p.observation.market.subjectId===proof.homeId,y=Number(g.winnerId===proof.homeId),meta={y,date:proof.startsAt.slice(0,10),season:2026};
  samples['Elo control'].push({...meta,p:home?p.forecast!.probability:1-p.forecast!.probability});
  const f=reports.flatMap(r=>r.e.fixtures).find(f=>f.proof.statsGameId===proof.statsGameId&&f.generatedAt===p.forecast!.generatedAt);if(f?.challenger)samples['BDL experimental challenger'].push({...meta,p:f.challenger.eloOnly});
  const book=JSON.parse(proofs.get(p.id)!.originalOdds.raw).find((e:{id:string})=>e.id===proof.eventId)?.bookmakers.find((b:{key:string})=>b.key==='sportsbet'),market=book?.markets.find((m:{key:string})=>m.key==='h2h'),quotes=market?.outcomes as {name:string;price:number}[]|undefined;
  const h=quotes?.find(o=>o.name===proof.homeName)?.price,a=quotes?.find(o=>o.name===proof.awayName)?.price;if(h&&a&&h>1&&a>1)samples['Sportsbet de-vig benchmark'].push({...meta,p:(1/h)/(1/h+1/a)});
 }
 const metrics=Object.entries(samples).map(([model,rows])=>{const m=probabilityMetrics(rows);return {sport:'NBA' as const,market:'moneyline' as const,model,games:rows.length,brier:m?.brier??null,logLoss:m?.logLoss??null,calibration:m?.calibration??[]};});
 const localPaper:NonNullable<V6Dashboard['localPaper']>={kind:'bounded_local',integrity,registration:killed?'stopped':Date.parse(now)>=Date.parse(scope.expiresAt)?'expired':scope.enabled?'bounded_active':'disabled',expiresAt:scope.expiresAt,fixtureIds:scope.fixtureIds,settlement:killed?'stopped':'retained_results_only',forecastFixtures:keys.size,probabilityOutputs:reports.reduce((n,{e})=>n+e.fixtures.reduce((n,f)=>n+Object.keys(f.control??{}).length+Object.keys(f.challenger??{}).length,0),0),lastCaptureAt,lastSettlementAt:settled.at(-1)?.recordedAt??null,qualifiedSelections:state.positions.length,modelHashes:{control:permit.controlArtifactHash,challenger:permit.challengerArtifactHash},metrics};
 // No mutually exclusive selections are counted as independent games. Existing
 // observational chart samples remain separate; local scores use one earliest registered forecast per verified fixture, never both sides.
 return {localPaper,selections,ledger:{origin:'bounded_local' as const,available:true,registered:state.positions.length,pendingCents:a.pendingCents,profitCents:a.profitCents,equityCents:a.equityCents,roi:a.roi,positions}};
}
