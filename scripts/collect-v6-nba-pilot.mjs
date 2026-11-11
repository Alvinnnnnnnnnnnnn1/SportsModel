/** Explicit bounded real read-only evidence collection. No positions, Supabase or bookmaker connection. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
if(!process.argv.includes('--confirm-free-read-only'))throw new Error('Explicit --confirm-free-read-only required');
process.loadEnvFile('.env.local');
const root=path.resolve('.local/v6');
const directory=path.join(root,'nba-shadow-'+new Date().toISOString().replace(/[:.]/g,'-'));
await fs.mkdir(directory,{recursive:true,mode:0o700});
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
const report={format:'edgelab.v6-real-source-pilot',version:1,at:new Date().toISOString(),observations:[],registrations:0,financialWrites:0,hostedWrites:0};
try{
 const {freeSources}=await loader.ssrLoadModule('/src/lib/v6/free-sources.server.ts');
 const {atomicPrivateJson}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const source=freeSources({root,oddsKey:process.env.THE_ODDS_API_KEY,nbaKey:process.env.API_SPORTS_KEY});
 let nbaLast=0,oddsLast=0;
 const read=async(provider,endpoint,parameters={},cost=0)=>{
   const last=provider==='api-nba'?nbaLast:oddsLast,spacing=provider==='api-nba'?16100:1100;
   const delay=Math.max(0,last+spacing-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));
   const row={provider,endpoint,parameters};report.observations.push(row);
   try{const e=await source.read(provider,endpoint,parameters,cost);row.hash=e.hash;row.retrievedAt=e.retrievedAt;const body=JSON.parse(e.raw);row.count=Array.isArray(body)?body.length:Array.isArray(body.response)?body.response.length:null;row.status='received';await atomicPrivateJson(path.join(directory,`source-${report.observations.length}.json`),e);console.log(JSON.stringify(row));return body;}
   catch(error){row.status='blocked';row.error=error.message;console.log(JSON.stringify(row));return null;}
   finally{if(provider==='api-nba')nbaLast=Date.now();else oddsLast=Date.now();await atomicPrivateJson(path.join(directory,'report.json'),report);}
 };
 const status=await read('api-nba','/status');
 if(status&&!process.argv.includes('--status-only')){
   // Current scope failed closed in the initial run. An explicitly requested
   // continuation recovers free status and moves to historical data only.
   if(!process.argv.includes('--historical-only'))await read('api-nba','/games',{league:'standard',season:'2026'});
   const players=process.argv.includes('--scope-only')?null:await read('api-nba','/players',{search:'Poeltl'});
   const exact=(players?.response??[]).filter(p=>p.firstname==='Jakob'&&p.lastname==='Poeltl');
   if(exact.length===1){
     const id=String(exact[0].id);report.historicalPlayerId=id;
     if(!process.argv.includes('--historical-only'))await read('api-nba','/players/statistics',{id,season:'2026'});
     await read('api-nba','/games',{league:'standard',season:'2023'});
     await read('api-nba','/players/statistics',{id,season:'2023'});
   }
 }
 if(!process.argv.includes('--historical-only')&&!process.argv.includes('--scope-only')&&!process.argv.includes('--status-only')){
 await read('the-odds-api.com','/v4/sports');
 const events=await read('the-odds-api.com','/v4/sports/basketball_nba/events');
 const retained=JSON.parse(await fs.readFile(path.join(root,'odds-pilot-2026-11-11T06-58-53-202Z/NBA-player-points.json'),'utf8'));
 const matching=(events??[]).filter(e=>e.id===retained[0].eventId&&Date.parse(e.commence_time)>Date.now()+600000);
 if(matching.length===1)await read('the-odds-api.com',`/v4/sports/basketball_nba/events/${matching[0].id}/odds`,{bookmakers:'sportsbet',markets:'player_points',oddsFormat:'decimal',dateFormat:'iso',includeSids:'true'},1);
 }
 report.status='evidence_collected_not_registered';
}finally{
 await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2),{mode:0o600});
 await loader.close();console.log(JSON.stringify({directory,status:report.status??'stopped',registrations:0,hostedWrites:0}));
}
