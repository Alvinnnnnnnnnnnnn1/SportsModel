/** Explicit, bounded read-only free-plan pilot. No bookmaker request or Supabase access. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { z } from 'zod';
if(!process.argv.includes('--confirm-free-pilot'))throw new Error('Pass --confirm-free-pilot for at most four h2h credits; no polling.');
try{process.loadEnvFile('.env.local');}catch{throw new Error('Could not read the local environment; no request was made.');}
const apiKey=process.env.THE_ODDS_API_KEY;
if(!apiKey)throw new Error('THE_ODDS_API_KEY is absent. Do not paste it into chat.');
const root=path.resolve('.local/v6'),period=new Date().toISOString().slice(0,7);
await fs.mkdir(root,{recursive:true,mode:0o700});
const lockPath=path.join(root,'odds-pilot.lock'),lock=await fs.open(lockPath,'wx',0o600);
const directory=path.join(root,'odds-pilot-'+new Date().toISOString().replace(/[:.]/g,'-'));
await fs.mkdir(directory,{mode:0o700});
const budgetPath=path.join(root,'odds-pilot-budget.json');
const report={provider:'the-odds-api.com',permissionReference:'https://the-odds-api.com/terms-and-conditions.html',retrievedAt:new Date().toISOString(),requests:0,reservedCredits:0,quota:null,coverage:[],financialWrites:0,paperRegistrations:0,bookmakerDirectRequests:0};
let loader;
try{
  let budget={period,reservations:0};
  try{const old=JSON.parse(await fs.readFile(budgetPath,'utf8'));if(old.period===period)budget=old;}catch(error){if(error.code!=='ENOENT')throw new Error('Pilot budget is invalid; refusing requests.');}
  if(!Number.isSafeInteger(budget.reservations)||budget.reservations<0||budget.reservations>=4)throw new Error('This month’s bounded pilot has already reserved its four credits. No repeat odds requests.');
  loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
  const {normalizeTheOddsApiResponse,readOddsQuota}=await loader.ssrLoadModule('/src/lib/providers/the-odds-api.ts');
  const get=async(endpoint,parameters={},cost=0)=>{
    if(cost){
      if(!report.quota||report.quota.remaining<101||budget.reservations+cost>4)throw new Error('Free credits/reserve are insufficient or unknown.');
      budget.reservations+=cost;report.reservedCredits+=cost;
      const temp=budgetPath+'.tmp';await fs.writeFile(temp,JSON.stringify(budget),{mode:0o600});await fs.rename(temp,budgetPath);
    }
    const url=new URL(endpoint,'https://api.the-odds-api.com');
    if(url.origin!=='https://api.the-odds-api.com'||!/^\/v4\/sports(?:\/[a-z0-9_]+(?:\/events\/[a-f0-9]+)?\/odds)?$/.test(url.pathname))throw new Error('Endpoint is not allowlisted.');
    for(const [key,value]of Object.entries(parameters))url.searchParams.set(key,value);
    const safeUrl=url.toString();url.searchParams.set('apiKey',apiKey);
    report.requests++;const started=Date.now();let response;
    try{response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});}catch{throw new Error('Provider transport failed; no retry or alternate host was used.');}
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>2097152){await response.body.cancel().catch(()=>{});throw new Error('Provider response exceeded 2 MiB.');}chunks.push(chunk);}
    const text=Buffer.concat(chunks).toString('utf8'),retrievedAt=new Date().toISOString();
    report.quota=readOddsQuota(response.headers,retrievedAt);
    const entry={url:safeUrl,status:response.status,retrievedAt,latencyMs:Date.now()-started,hash:createHash('sha256').update(text).digest('hex')};
    await fs.writeFile(path.join(directory,`request-${report.requests}.json`),JSON.stringify({...entry,rawResponse:JSON.parse(text.replaceAll(apiKey,'[REDACTED]'))},null,2),{mode:0o600});
    if(!response.ok)throw new Error(`Provider returned HTTP ${response.status}; no retry/upgrade was attempted.`);
    if(report.quota.remaining===null||report.quota.used===null||report.quota.remaining+report.quota.used!==500)throw new Error('Free 500-credit plan could not be established from actual headers. Stopping before more requests.');
    return {raw:JSON.parse(text),...entry};
  };
  const catalog=await get('/v4/sports');
  const active=catalog.raw.filter(s=>s.active===true&&!s.has_outrights);
  if(process.argv.includes('--nba-props-only')){
    let fixture;
    for(const folder of(await fs.readdir(root)).filter(name=>name.startsWith('odds-pilot-')).sort().reverse()){
      try{const original=JSON.parse(await fs.readFile(path.join(root,folder,'request-2.json'),'utf8'));fixture=original.rawResponse?.find?.(event=>event.sport_key==='basketball_nba'&&Date.parse(event.commence_time)>Date.now()+600000&&event.bookmakers.some(book=>book.key==='sportsbet'));if(fixture)break;}catch{/* No prior supported fixture in this evidence directory. */}
    }
    if(!fixture||!/^[a-f0-9]+$/.test(fixture.id))throw new Error('No exact upcoming NBA event ID was retained from the bounded h2h sample.');
    const fetched=await get(`/v4/sports/basketball_nba/events/${fixture.id}/odds`,{bookmakers:'sportsbet',markets:'player_points',regions:'au',oddsFormat:'decimal',dateFormat:'iso'},1);
    const outcome=z.object({name:z.enum(['Over','Under']),description:z.string().min(1),price:z.number().min(1.0001).max(10000),point:z.number().finite()});
    const quotes=[];
    if(fetched.raw.id!==fixture.id||fetched.raw.sport_key!=='basketball_nba')throw new Error('Prop fixture identity mismatched.');
    for(const book of fetched.raw.bookmakers??[])if(book.key==='sportsbet')for(const market of book.markets??[])if(market.key==='player_points')for(const row of market.outcomes??[]){
      const value=outcome.parse(row);quotes.push({eventId:fixture.id,eventStartsAt:fetched.raw.commence_time,bookmaker:'sportsbet',market:'player_points',participant:value.description,side:value.name,threshold:value.point,odds:value.price,sourceUpdatedAt:market.last_update??null,legacyBookmakerUpdatedAt:book.last_update??null,retrievedAt:fetched.retrievedAt,participantId:null});
    }
    await fs.writeFile(path.join(directory,'NBA-player-points.json'),JSON.stringify(quotes,null,2),{mode:0o600});
    report.coverage.push({sport:'NBA',market:'player_points',eventId:fixture.id,status:quotes.length?'provider_sportsbet_props_observed':'no_sportsbet_props_in_sample',quotes:quotes.length,missingStableParticipantIds:true,sourceUrl:fetched.url,rawHash:fetched.hash});
  }else for(const [sport,prefix]of [['NBA','basketball_nba'],['NBL','basketball_nbl'],['ATP','tennis_atp_'],['WTA','tennis_wta_']]){
    const providerSport=active.find(s=>s.key===prefix||prefix.endsWith('_')&&s.key.startsWith(prefix));
    if(!providerSport){report.coverage.push({sport,status:'no_active_catalogue_key',quotes:0});continue;}
    const fetched=await get(`/v4/sports/${providerSport.key}/odds`,{bookmakers:'sportsbet',markets:'h2h',oddsFormat:'decimal',dateFormat:'iso',regions:'au'},1);
    const normalized=normalizeTheOddsApiResponse(fetched.raw,{sport,providerSportKey:providerSport.key,markets:['h2h']},{now:fetched.retrievedAt,maxAgeSeconds:300});
    const coverage={sport,providerSportKey:providerSport.key,status:normalized.quotes.length?'provider_sportsbet_quotes_observed':'empty_sportsbet_sample',quotes:normalized.quotes.length,fresh:normalized.quotes.filter(q=>q.usableWithoutFreshnessReview).length,markets:['h2h'],playerProps:'not_piloted',missingStableParticipantIds:true,sourceUrl:fetched.url,rawHash:fetched.hash};
    report.coverage.push(coverage);
    await fs.writeFile(path.join(directory,`${sport}-quotes.json`),JSON.stringify(normalized,null,2),{mode:0o600});
    console.log(JSON.stringify(coverage));
  }
  report.status='bounded_pilot_complete_not_autonomy';
}catch(error){report.status='stopped_fail_closed';report.error=error.message.includes(apiKey)?'Provider check stopped; details redacted.':error.message;}
finally{
  await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2),{mode:0o600});
  if(loader)await loader.close();await lock.close();await fs.unlink(lockPath);
}
console.log(JSON.stringify({directory,...report},null,2));
if(report.status==='stopped_fail_closed')process.exitCode=1;
