/** Owner-approved bounded read only. Uses the EXISTING shared source journal.
 * Never imports into the original dataset, changes the pilot, or retries errors. */
import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';
const i=process.argv.indexOf('--approval-file');if(i<0)throw new Error('Exact private approval file required');
const root=await fs.realpath('.local/v6'),approvalFile=await fs.realpath(process.argv[i+1]);if(!approvalFile.startsWith(root+path.sep))throw new Error('Private approval file required');const approval=JSON.parse(await fs.readFile(approvalFile,'utf8')),directory=path.dirname(approvalFile);
if(approval.format!=='edgelab.v6-bdl-history-approval'||approval.approved!==true||approval.scope!=='BDL_games_regular_2022_2023_2024_only'||approval.maxRequests!==42||!Number.isFinite(Date.parse(approval.recordedAt))||Date.parse(approval.recordedAt)>Date.now()||Date.now()-Date.parse(approval.recordedAt)>23*3600000)throw new Error('Fresh bounded owner approval required');
try{await fs.access(path.join(directory,'report.json'));throw new Error('Existing acquisition report: inspect, never blindly repeat');}catch(e){if(e.code!=='ENOENT')throw e;}
// Claim once before any report/environment/transport operation. Keep the marker
// after failure: an ambiguous crash requires review, never a blind retry. This
// also closes the two-process race before the shared provider lock is reached.
const claim=await fs.open(path.join(directory,'acquisition.claim'),'wx',0o600);try{await claim.writeFile(JSON.stringify({pid:process.pid,claimedAt:new Date().toISOString()}));await claim.sync();}finally{await claim.close();}
process.loadEnvFile('.env.local');if(!process.env.BALLDONTLIE_API_KEY?.trim())throw new Error('Existing BDL key absent; no requests');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
const report={format:'edgelab.v6-bdl-history-acquisition',version:1,startedAt:new Date().toISOString(),approvalReference:approval.reference,requests:[],seasons:[],status:'preflight',providerBillingTierIndependentlyVisible:false,permanentFreeAccountOwnerAttested:true,hostedWrites:0,oddsRequests:0};
const write=async()=>fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2),{mode:0o600});
try{
 const {teamSources}=await loader.ssrLoadModule('/src/lib/v6/team-sources.server.ts'),{digest,exclusive}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts'),{ingestTeamGames}=await loader.ssrLoadModule('/src/lib/v6/team-dataset.server.ts');
 const {historyRequest,validateHistoryPage,BDL_HISTORY_BOUNDS}=await loader.ssrLoadModule('/src/lib/v6/history-recovery.ts'),{planControlledJobs}=await loader.ssrLoadModule('/src/lib/v6/controlled-scheduler.server.ts');
 const plan=JSON.parse(await fs.readFile(path.join(root,'source-pilot/proposal/plan.json'),'utf8')),day=new Date().toISOString().slice(0,10),originalHash=digest(await fs.readFile(path.join(root,'team-games/dataset.json'),'utf8'));
 const readBudget=async()=>{const b=JSON.parse(await fs.readFile(path.join(root,'balldontlie-team-budget.json'),'utf8'));return {stored:b,effective:b.day===day?b:{day,requests:0,lastAt:0,blockedUntil:0,starts:[]}};};const initial=await readBudget();
 report.preflight={day,storedJournal:initial.stored,effectiveRequests:initial.effective.requests,remainingDaily:60-initial.effective.requests,originalDatasetHash:originalHash,docsFreeGamesVerifiedAt:approval.docsVerifiedAt};
 if(initial.effective.requests+42>60||initial.effective.blockedUntil>Date.now())throw new Error('Insufficient shared daily allowance or provider block');
 const priority=()=>{if(new Date().toISOString().slice(0,10)!==day||Date.now()-Date.parse(approval.recordedAt)>23*3600000)throw new Error('Acquisition day/approval window elapsed');if(planControlledJobs([],new Date().toISOString(),plan).some(j=>Date.parse(j.deadline)>Date.now()&&Date.parse(j.dueAt)<Date.now()+15*60000))throw new Error('Daily pilot takes priority');};priority();
 await exclusive(path.join(root,'history-acquisition.lock'),async()=>{
  let lastStart=0,phase=0,expected=initial.effective.requests;
  const source=teamSources({root,bdlKey:process.env.BALLDONTLIE_API_KEY,authorizeRead:async()=>{priority();const b=(await readBudget()).effective;if(b.requests!==expected+(phase===0?0:1))throw new Error('Competing shared BDL reservation detected');phase++;},fetcher:async(url,options)=>{const parsed=new URL(url);if(parsed.origin!=='https://api.balldontlie.io'||parsed.pathname!=='/v1/games')throw new Error('Unapproved acquisition endpoint');lastStart=Date.now();const r=await fetch(url,options);const selected={};for(const h of ['x-ratelimit-limit','x-ratelimit-remaining','ratelimit-limit','retry-after'])if(r.headers.has(h))selected[h]=r.headers.get(h);Object.assign(report.requests.at(-1),{actualRequestAt:new Date(lastStart).toISOString(),httpStatus:r.status,rateHeaders:selected});return r;}});
  report.status='collecting';await write();
  for(const season of BDL_HISTORY_BOUNDS.seasons){let cursor=null;const ids=new Set(),cursors=new Set();const result={season,pages:0,games:0,complete:false,receiptIds:[]};report.seasons.push(result);
   for(let page=0;page<14;page++){
    const journal=(await readBudget()).effective;if(journal.requests!==expected)throw new Error('Competing source use detected');
    const delay=Math.max(0,lastStart+12600-Date.now(),journal.lastAt+12600-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));priority();
    try{await fs.access(path.join(root,'balldontlie-team-budget.json.lock'));throw new Error('Another source request active');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(report.requests.length>=42)throw new Error('Approved total exhausted');phase=0;const parameters=historyRequest(season,cursor),row={season,page:page+1,cursor,parameters,intentAt:new Date().toISOString(),status:'reserved_or_unknown'};report.requests.push(row);await write();
    const evidence=await source.read('balldontlie','/v1/games',parameters);expected++;Object.assign(row,{status:'received',receiptId:evidence.id,hash:evidence.hash,retrievedAt:evidence.retrievedAt});await write();
    const parsed=await validateHistoryPage(evidence,season,cursor,ids,cursors);row.status='validated';for(const id of parsed.ids)ids.add(id);if(parsed.next!==null)cursors.add(parsed.next);result.pages++;result.games+=parsed.games.length;result.receiptIds.push(evidence.id);
    await ingestTeamGames(path.join(directory,'dataset'),evidence);await write();console.log(JSON.stringify({season,page:page+1,games:parsed.games.length,cumulative:report.requests.length,nextCursor:parsed.next,receiptId:evidence.id,status:'genuine_received'}));
    if(parsed.next===null){result.complete=true;break;}if(page===13)throw new Error('Approved per-season pagination exhausted');cursor=parsed.next;
   }
  }
  if(!report.seasons.every(s=>s.complete))throw new Error('Historical coverage incomplete');if(digest(await fs.readFile(path.join(root,'team-games/dataset.json'),'utf8'))!==originalHash)throw new Error('Original dataset changed');report.status='completed';
 });
}catch(e){report.status='stopped';report.error=typeof e?.message==='string'&&!e.message.includes(process.env.BALLDONTLIE_API_KEY)?e.message:'Acquisition stopped; inspect private receipts';process.exitCode=1;console.error('STOP '+report.error);}
finally{report.finishedAt=new Date().toISOString();report.finalSharedJournal=JSON.parse(await fs.readFile(path.join(root,'balldontlie-team-budget.json'),'utf8'));await write();await loader.close();console.log(JSON.stringify({directory,status:report.status,requests:report.requests.length,seasons:report.seasons,remainingDaily:60-(report.finalSharedJournal.day===new Date().toISOString().slice(0,10)?report.finalSharedJournal.requests:0),hostedWrites:0}));}
