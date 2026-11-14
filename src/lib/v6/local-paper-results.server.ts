import fs from 'node:fs/promises';import path from 'node:path';
import {journalV6Repository} from './journal-repository.server';
import {digest,exclusive,type RawEvidence} from './evidence.server';
import type {Grade} from './types';
import {appendGrade,paperAccounting} from './engine';
import {gradeReconciledTeamPosition} from './reconciled-grading';
import type {TeamFixtureProof} from './team-pilot';import type {TeamRegistry} from './team-identity';

/** Passive consumer attached to the EXISTING source-worker tick. Zero fetches,
 * zero registration capability. Genuine results must already have been retained
 * by the approved source-only worker and pass the original independent grader. */
export async function settleLocalPaperFromRetainedSources(root:string,clock=()=>new Date().toISOString()){
 const base=path.join(root,'local-paper/p0-20261114');let permit,manifest;
 try{permit=JSON.parse(await fs.readFile(path.join(base,'approval.json'),'utf8'));manifest=JSON.parse(await fs.readFile(path.join(base,'registration-context.json'),'utf8'));}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {status:'no_local_paper_context',providerRequests:0,gradesAppended:0};throw e;}
 if(permit.format!=='edgelab.v6-local-paper-permit'||permit.approved!==true||permit.scope!=='NBA_Sportsbet_local_experimental_paper_batch_2026-11-15'||permit.paperOnly!==true||permit.hosted!==false||permit.challengerRegistration!==false||manifest.approvalHash!==digest(JSON.stringify(permit)))throw new Error('Local paper permit/context mismatch');
 const sourceKilled=async()=>{try{const c=JSON.parse(await fs.readFile(path.join(root,'source-pilot/config.json'),'utf8'));return c.killSwitch===true||c.mode==='disabled';}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}};
 if(await sourceKilled())return {status:'emergency_stopped',providerRequests:0,gradesAppended:0};
 let cycles:string[]=[];try{cycles=await fs.readdir(path.join(base,'cycles'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 for(const cycle of cycles){let context;try{context=JSON.parse(await fs.readFile(path.join(base,'cycles',cycle,'registration-context.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')continue;throw e;}if(context.approvalHash!==manifest.approvalHash)throw new Error('Paper cycle approval mismatch');for(const [id,link]of Object.entries(context.proofs)){if(manifest.proofs[id]&&JSON.stringify(manifest.proofs[id])!==JSON.stringify(link))throw new Error('Paper proof link changed');manifest.proofs[id]=link;}}
 for(const stop of [path.join(root,'source-pilot/STOP'),path.join(base,'STOP')])try{await fs.access(stop);return {status:'emergency_stopped',providerRequests:0,gradesAppended:0};}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 return exclusive(path.join(base,'result-consumer.lock'),async()=>{
 const repo=journalV6Repository(path.join(base,'ledger'),permit.ownerId),state=await repo.read(),now=clock();
 if(!state.positions.length)return {status:'no_registered_positions',providerRequests:0,gradesAppended:0,accounting:paperAccounting(state),integrity:await repo.integrity()};
 const receipts:RawEvidence[]=[];for(const name of await fs.readdir(path.join(root,'evidence-receipts'))){if(name.endsWith('.json')){const e=JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',name),'utf8'));const u=new URL(e.sourceUrl);if(e.provider==='the-odds-api.com'&&u.pathname.endsWith('/scores')||e.provider==='balldontlie'&&/^\/v1\/games\/\d+$/.test(u.pathname))receipts.push(e);}}
 const pending=[];const grades:Grade[]=[];
 for(const p of state.positions){
  if(Date.parse(p.observation.eventStartsAt)>Date.parse(now)){pending.push({positionId:p.id,reason:'event_not_started'});continue;}
  const link=manifest.proofs[p.observation.id];if(!link)throw new Error('Registered paper proof link absent');const body=await fs.readFile(path.join(base,'proofs',p.observation.id+'.json'),'utf8');if(digest(body)!==link.hash)throw new Error('Frozen paper proof changed');
  const proof=JSON.parse(body) as {proof:TeamFixtureProof;registry:TeamRegistry;originalFixtures:RawEvidence;originalOdds:RawEvidence};
  const eligible=receipts.filter(e=>Date.parse(e.retrievedAt)<=Date.parse(now)&&Date.parse(e.retrievedAt)>=Date.parse(p.observation.eventStartsAt)).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt));
  const scores=eligible.find(e=>e.provider==='the-odds-api.com'&&Array.isArray(JSON.parse(e.raw))&&JSON.parse(e.raw).some((g:{id:string;completed:boolean})=>g.id===proof.proof.eventId&&g.completed));
  const secondary=eligible.find(e=>e.provider==='balldontlie'&&new URL(e.sourceUrl).pathname==='/v1/games/'+proof.proof.statsGameId);
  if(!scores||!secondary){pending.push({positionId:p.id,reason:'independent_final_evidence_not_retained'});continue;}
  const previous=state.grades.filter(g=>g.positionId===p.id).sort((a,b)=>a.revision-b.revision).at(-1)??null,result=await gradeReconciledTeamPosition(p,{...proof,scores,secondary,at:now},previous);
  if(result.grade)grades.push(result.grade);else pending.push({positionId:p.id,reason:result.reason??result.status});
 }
 if(grades.length)await repo.transact(async before=>{if(await sourceKilled())throw new Error('Source emergency stop before paper grade commit');if(digest(JSON.stringify(JSON.parse(await fs.readFile(path.join(base,'approval.json'),'utf8'))))!==manifest.approvalHash)throw new Error('Paper approval changed before grade commit');for(const stop of [path.join(root,'source-pilot/STOP'),path.join(base,'STOP')])try{await fs.access(stop);throw new Error('Paper emergency stop before grade commit');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}let draft=before;for(const g of grades)draft=await appendGrade(draft,g);return {...draft,revision:before.revision+1};});
 return {status:grades.length?'verified_paper_grades_appended':'awaiting_or_unchanged_results',gradesAppended:grades.length,pending,providerRequests:0,accounting:paperAccounting(await repo.read()),integrity:await repo.integrity()};
 });
}
