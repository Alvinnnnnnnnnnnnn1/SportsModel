/** Explicit permanent-free team/game audit. No production worker or Supabase. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
if(!process.argv.includes('--confirm-free-read-only'))throw new Error('Explicit --confirm-free-read-only required');
process.loadEnvFile('.env.local');
const root=path.resolve('.local/v6'),directory=path.join(root,'team-source-'+new Date().toISOString().replace(/[:.]/g,'-'));
await fs.mkdir(directory,{recursive:true,mode:0o700});
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
const report={format:'edgelab.v6-team-source-audit',at:new Date().toISOString(),requests:[],coverage:[],registrations:0,hostedWrites:0};
try{
 const {teamSources}=await loader.ssrLoadModule('/src/lib/v6/team-sources.server.ts');
 const {ingestTeamGames}=await loader.ssrLoadModule('/src/lib/v6/team-dataset.server.ts');
 const {atomicPrivateJson}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const source=teamSources({root,bdlKey:process.env.BALLDONTLIE_API_KEY}),last={balldontlie:0,thesportsdb:0};
 const read=async(provider,endpoint,parameters={})=>{
  const delay=Math.max(0,last[provider]+(provider==='balldontlie'?12600:3100)-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));
  const row={provider,endpoint,parameters};report.requests.push(row);
  try{const e=await source.read(provider,endpoint,parameters);await atomicPrivateJson(path.join(directory,`source-${report.requests.length}.json`),e);Object.assign(row,{hash:e.hash,receiptId:e.id,retrievedAt:e.retrievedAt,status:'received'});
   const body=JSON.parse(e.raw);row.count=body.data?.length??body.events?.length??body.countries?.length??null;
   if(endpoint.includes('games')||endpoint.includes('eventsseason')||endpoint.includes('lookupevent'))row.ingestion=await ingestTeamGames(root,e);
   console.log(JSON.stringify(row));return body;
  }catch(error){Object.assign(row,{status:'blocked',error:error.message});console.log(JSON.stringify(row));return null;}
  finally{last[provider]=Date.now();await atomicPrivateJson(path.join(directory,'report.json'),report);}
 };
 if(process.argv.includes('--secondary-only')){
  const leagues=await read('thesportsdb','/api/v1/json/123/search_all_leagues.php',{c:'United States',s:'Basketball'});
  const exact=(leagues?.countries??[]).filter(l=>l.strLeague==='NBA');
  if(exact.length===1)await read('thesportsdb','/api/v1/json/123/eventsseason.php',{id:exact[0].idLeague,s:'2026-2027'});
 }else{
  if(!process.env.BALLDONTLIE_API_KEY?.trim())throw new Error('BALLDONTLIE_API_KEY absent; no requests');
  if(!process.argv.includes('--previous-season-only')&&!process.argv.includes('--fixtures-only'))await read('balldontlie','/v1/teams');
  for(const season of process.argv.includes('--previous-season-only')?['2025']:['2026']){
   let cursor=null;const seen=new Set(),receiptIds=[];let complete=false;
   for(let page=0;page<16;page++){
    const parameters={'seasons[]':season,season_type:'regular',per_page:'100'};
    if(season==='2026')parameters.end_date=new Date().toISOString().slice(0,10);
    if(process.argv.includes('--fixtures-only')){parameters.start_date=new Date().toISOString().slice(0,10);parameters.end_date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);}
    if(cursor!==null)parameters.cursor=String(cursor);
    const body=await read('balldontlie','/v1/games',parameters);if(!body)break;
    receiptIds.push(report.requests.at(-1).receiptId);
    const next=body.meta?.next_cursor;if(next===null||next===undefined){complete=true;break;}
    if(!Number.isSafeInteger(next)||seen.has(next))throw new Error('Invalid/repeated source pagination cursor');seen.add(next);cursor=next;
    if(page===15)throw new Error('Bounded pagination limit reached; dataset explicitly incomplete');
   }
   report.coverage.push({provider:'balldontlie',season:Number(season),seasonType:'regular',through:season==='2026'?new Date().toISOString().slice(0,10):null,complete,receiptIds,scope:process.argv.includes('--fixtures-only')?'upcoming_range':'season_to_date'});
  }
 }
}finally{await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2),{mode:0o600});await loader.close();console.log(JSON.stringify({directory,registrations:0,hostedWrites:0}));}
