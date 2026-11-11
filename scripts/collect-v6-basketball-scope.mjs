/** Separately subscribed API-Basketball scope audit; no NBA/CDN/ESPN requests. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
if(!process.argv.includes('--confirm-free-read-only'))throw new Error('Explicit --confirm-free-read-only required');
process.loadEnvFile('.env.local');
const root=path.resolve('.local/v6'),directory=path.join(root,'basketball-scope-'+new Date().toISOString().replace(/[:.]/g,'-'));
await fs.mkdir(directory,{recursive:true,mode:0o700});
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
const report={format:'edgelab.v6-basketball-scope',at:new Date().toISOString(),requests:[],hostedWrites:0,registrations:0};
try{
 const {freeSources}=await loader.ssrLoadModule('/src/lib/v6/free-sources.server.ts');
 const {atomicPrivateJson}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const source=freeSources({root,nbaKey:process.env.API_SPORTS_KEY});let last=0;
 const read=async(endpoint,parameters={})=>{
  const delay=Math.max(0,last+16100-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));
  const row={endpoint,parameters};report.requests.push(row);
  try{const e=await source.read('api-basketball',endpoint,parameters);await atomicPrivateJson(path.join(directory,`source-${report.requests.length}.json`),e);
   const data=JSON.parse(e.raw);Object.assign(row,{hash:e.hash,retrievedAt:e.retrievedAt,count:Array.isArray(data.response)?data.response.length:null,status:'received'});console.log(JSON.stringify(row));return data.response;
  }catch(e){Object.assign(row,{status:'blocked',error:e.message});console.log(JSON.stringify(row));return null;}
  finally{last=Date.now();await atomicPrivateJson(path.join(directory,'report.json'),report);}
 };
 if(await read('/status')&&!process.argv.includes('--status-only')){
  const leagues=await read('/leagues',{name:'NBA'});
  const exact=(leagues??[]).filter(l=>l.name==='NBA'&&l.country?.name==='USA');
  report.leagues=exact;console.log(JSON.stringify({nbaLeagues:exact}));
  // Season strings come from this product's actual catalogue, never a guessed format.
  if(exact.length===1){
   const league=exact[0],season=league.seasons?.find(s=>String(s.season)==='2026-2027');
   if(season){
    const games=await read('/games',{league:String(league.id),season:String(season.season)});
    if(games){report.gameSummary={total:games.length,final:games.filter(g=>['FT','AOT'].includes(g.status?.short)).length};
     for(const g of games.filter(g=>['FT','AOT'].includes(g.status?.short)).sort((a,b)=>b.timestamp-a.timestamp).slice(0,3))await read('/games/statistics/players',{id:String(g.id)});
    }
   }else report.blocker='Current 2026-2027 season not in returned NBA catalogue';
  }
 }
}finally{await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2),{mode:0o600});await loader.close();console.log(JSON.stringify({directory,registrations:0,hostedWrites:0}));}
