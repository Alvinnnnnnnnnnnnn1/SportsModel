import fs from 'node:fs/promises';import path from 'node:path';
import {dailyPaperApprovalSchema,DAILY_PAPER_POLICY,dailyPaperCodeHash,type DailyPaperProof} from './daily-paper-pilot.server';
import {digest,type RawEvidence} from './evidence.server';
import {journalV6Repository} from './journal-repository.server';
import {paperAccounting,hypotheticalProfit,qualification} from './engine';
import {gradeReconciledTeamPosition} from './reconciled-grading';
import type {V6Dashboard,V6Selection} from './dashboard';

/** No worker invocation, mutation or provider access. Evidence mismatches
 * withhold this entire journal instead of inventing account values. */
export async function dailyPaperView(root:string,ownerId:string,at:string){
 const base=path.join(root,'local-paper/daily-pilot');let approval;try{approval=dailyPaperApprovalSchema.parse(JSON.parse(await fs.readFile(path.join(base,'approval.json'),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
 const receipt=JSON.parse(await fs.readFile(path.join(root,'source-pilot/approved-receipt.json'),'utf8'));
 if(approval.ownerId!==ownerId||approval.sourceReceiptHash!==digest(JSON.stringify(receipt))||approval.policyHash!==digest(JSON.stringify(DAILY_PAPER_POLICY))||approval.codeHash!==await dailyPaperCodeHash())throw new Error('Daily PAPER owner/approval integrity');
 const state=await journalV6Repository(path.join(base,'ledger'),ownerId).read();const proofs=new Map<string,DailyPaperProof>();
 for(const p of state.positions){
  const proof:DailyPaperProof=JSON.parse(await fs.readFile(path.join(base,'proofs',p.observation.id+'.json'),'utf8'));
  if(!p.forecast||p.observation.sourceClass!=='prospective'||JSON.stringify(p.observation)!==JSON.stringify(proof.observation)||p.forecast.probability!==proof.forecast.probability||p.forecast.inputsHash!==proof.forecast.inputsHash||digest(JSON.stringify(p.forecast.inputs))!==p.forecast.inputsHash||qualification(p.observation,p.forecast,p.registeredAt,'v6-prospective').length||Date.parse(p.registeredAt)<Date.parse(approval.startsAt)||Date.parse(p.registeredAt)>=Date.parse(approval.expiresAt)||Date.parse(p.observation.eventStartsAt)>=Date.parse(approval.expiresAt)||Date.parse(p.forecast.generatedAt)<Date.parse(approval.startsAt)||digest(proof.rawSource.raw)!==p.observation.rawHash)throw new Error('Daily PAPER frozen proof mismatch');
  proofs.set(p.id,proof);
  const grade=state.grades.filter(g=>g.positionId===p.id).at(-1);if(!grade)continue;
  const raw=JSON.parse(grade.rawEvidence??'{}');let scores:RawEvidence|undefined,secondary:RawEvidence|undefined;
  for(const file of (await fs.readdir(path.join(root,'evidence-receipts'))).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n))){const e:RawEvidence=JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',file),'utf8'));if(e.provider==='the-odds-api.com'&&e.raw===raw.scores)scores=e;if(e.provider==='balldontlie'&&e.raw===raw.secondary)secondary=e;}
  if(!scores||!secondary)throw new Error('Independent PAPER grading receipts missing');
  const verified=await gradeReconciledTeamPosition(p,{proof:proof.proof,registry:proof.registry,originalFixtures:proof.originalFixtures,originalOdds:proof.rawSource,scores,secondary,at:grade.recordedAt},null);
  if(!verified.grade||verified.grade.outcome!==grade.outcome||verified.grade.sourceHash!==grade.sourceHash)throw new Error('Independent PAPER outcome mismatch');
 }
 const account=paperAccounting(state);let running=account.openingReferenceCents;
 const positions:V6Dashboard['ledger']['positions']=state.positions.map(p=>{const proof=proofs.get(p.id)!,g=state.grades.filter(g=>g.positionId===p.id).at(-1),profit=g?hypotheticalProfit(p,g.outcome):null;return {id:p.id,fixture:`${proof.proof.awayName} at ${proof.proof.homeName}`,market:'Full-game moneyline · overtime included',selection:p.observation.market.subjectId===proof.proof.homeId?proof.proof.homeName:proof.proof.awayName,odds:p.observation.odds,probability:p.forecast!.probability,stakeCents:p.stakeCents,registeredAt:p.registeredAt,quoteAt:p.observation.sourceUpdatedAt,forecastAt:p.forecast!.generatedAt,outcome:g?.outcome??'pending',profitCents:profit,returnCents:profit===null?null:p.stakeCents+profit,settledAt:g?.recordedAt??null,modelId:p.forecast!.modelId,modelVersion:p.forecast!.version,inputCutoff:p.forecast!.inputCutoff,correlationGroup:p.observation.market.eventId,tier:'experimental',equityAfterCents:null};});
 for(const p of [...positions].filter(p=>p.profitCents!==null).sort((a,b)=>(a.settledAt??'').localeCompare(b.settledAt??''))){running+=p.profitCents!;p.equityAfterCents=running;}
 const selections:V6Selection[]=positions.map(p=>{const proof=proofs.get(p.id)!,f=proof.forecast;return {key:digest('registered:'+p.id),eventId:proof.proof.eventId,statsEventId:proof.proof.statsGameId??undefined,sport:'NBA',fixture:p.fixture,selection:p.selection,market:p.market,marketFamily:'moneyline',odds:p.odds,breakEven:1/p.odds,probability:p.probability,eloProbability:p.probability,ev:p.probability===null?null:p.probability*p.odds-1,startsAt:proof.proof.earliestStartsAt,quoteAt:p.quoteAt,capturedAt:proof.observation.retrievedAt,forecastAt:p.forecastAt,inputCutoff:f.inputCutoff,frozenAt:p.registeredAt,pass1:[],pass2:[],limitations:['Registered under separate bounded experimental local policy; no real-money wager'],outcome:p.outcome,homeScore:null,awayScore:null,decision:'registered_paper',sourceClass:'registered_paper_snapshot'};});
 return {selections,approval:{status:Date.parse(at)<Date.parse(approval.startsAt)?'waiting':Date.parse(at)>=Date.parse(approval.expiresAt)?'registration_expired':'bounded_active',startsAt:approval.startsAt,expiresAt:approval.expiresAt},ledger:{origin:'owner_repository' as const,available:true,registered:positions.length,pendingCents:account.pendingCents,profitCents:account.profitCents,equityCents:account.equityCents,roi:account.roi,positions}};
}
