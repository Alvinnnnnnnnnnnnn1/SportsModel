/** Keyless, offline retained-source continuation. Never invokes the scheduler. */
import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';
globalThis.fetch=async()=>{throw new Error('Retained forecast cycle cannot perform network requests');};
if(!['--freeze-retained','--reconcile-retained','--inspect'].some(a=>process.argv.includes(a)))throw new Error('Choose --freeze-retained, --reconcile-retained or --inspect');
const root=path.resolve('.local/v6'),loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const mod=f=>loader.ssrLoadModule('/src/lib/v6/'+f),{digest}=await mod('evidence.server.ts'),{collectionApprovalReasons}=await mod('controlled-activation.ts'),{freezeDailyForecasts,reconcileDailyForecasts}=await mod('daily-forecasts.server.ts');
 const configFile=path.join(root,'source-pilot/config.json'),receiptFile=path.join(root,'source-pilot/approved-receipt.json'),config=JSON.parse(await fs.readFile(configFile,'utf8')),receipt=JSON.parse(await fs.readFile(receiptFile,'utf8')),binding=digest(JSON.stringify({config,receipt}));
 const clock=()=>new Date().toISOString(),authorize=async()=>{const current={config:JSON.parse(await fs.readFile(configFile,'utf8')),receipt:JSON.parse(await fs.readFile(receiptFile,'utf8'))};if(digest(JSON.stringify(current))!==binding||!config.sourceOnly||config.mode!=='dry_run'||config.killSwitch||!config.sourcesEnabled||(await collectionApprovalReasons(config,receipt,clock())).length)throw new Error('Existing source-only authority is unavailable');try{await fs.access(path.join(root,'source-pilot/STOP'));throw new Error('Source stop is engaged');}catch(e){if(e.code!=='ENOENT')throw e;}};
 if(process.argv.includes('--inspect')){const {dailyForecastView}=await mod('forecast-view.server.ts');const view=await dailyForecastView(root,config.ownerId,clock());console.log(JSON.stringify({at:clock(),...view.summary,providerRequests:0,hostedWrites:0}));process.exitCode=0;}else{
 await authorize();const names=await fs.readdir(path.join(root,'evidence-receipts')),receipts=await Promise.all(names.filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(async n=>JSON.parse(await fs.readFile(path.join(root,'evidence-receipts',n),'utf8'))));
 let frozen=null;
 if(process.argv.includes('--freeze-retained')){
  const {loadTeamDataset,latestTeamGames}=await mod('team-dataset.server.ts'),{teamGames}=await mod('team-games.ts'),{teamRegistry,canonicalTeamRows}=await mod('team-identity.ts'),{regularSeasonCoverage}=await mod('team-coverage.ts');
  const at=clock(),cache=JSON.parse(await fs.readFile(path.join(root,'controlled/features.json'),'utf8'));if(Date.parse(at)-Date.parse(cache.at)>4*3600000||Date.parse(cache.at)>Date.parse(at))throw new Error('Fresh retained features required; no automatic fetch');
  const future=receipts.filter(r=>r.provider==='balldontlie'&&new URL(r.sourceUrl).pathname==='/v1/games'&&new URL(r.sourceUrl).searchParams.has('start_date')&&Date.parse(r.retrievedAt)<=Date.parse(at)&&Date.parse(at)-Date.parse(r.retrievedAt)<4*3600000).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt))[0];if(!future)throw new Error('Fresh exact future-fixture receipt absent; no automatic fetch');
  const latest=new Map(latestTeamGames(await loadTeamDataset(root)).map(g=>[g.provider+':'+g.sourceGameId,g]));for(const r of [...cache.receipts,future])for(const g of await teamGames(r))latest.set(g.provider+':'+g.sourceGameId,g);
  const catalog=receipts.filter(r=>r.provider==='balldontlie'&&new URL(r.sourceUrl).pathname==='/v1/teams').sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt))[0],rows=[...latest.values()],registry=await teamRegistry(catalog,rows,at),canonical=canonicalTeamRows(rows,registry).matched,season=Number(new URL(cache.receipts[0].sourceUrl).searchParams.get('seasons[]')),coverage=await regularSeasonCoverage(cache.receipts,season,at);
  frozen=await freezeDailyForecasts(root,{ownerId:config.ownerId,runId:'retained:'+future.id,rows:canonical,registry,fixtureReceipts:[future],completeSeasons:coverage.complete?[season]:[],at,latestStart:new Date(Date.parse(receipt.pilot.plan.expiresAt)-8*3600000).toISOString(),clock,beforeCommit:authorize});
 }
 const reconciled=await reconcileDailyForecasts(root,config.ownerId,receipts,clock(),clock,authorize);
 console.log(JSON.stringify({at:clock(),mode:'forecast_only',frozen,reconciled,providerRequests:0,paperRegistrations:0,paperSettlements:0,hostedWrites:0}));
 }
}finally{await loader.close();}
