import { z } from 'zod';
import { sha256 } from '@/lib/imports/duplicates';
import type { RawEvidence } from './evidence.server';
const stamp=z.string().datetime({offset:true}),id=z.union([z.string().min(1),z.number().int().nonnegative()]).transform(String),score=z.number().int().min(0).max(400).nullable();
export const teamGameSchema=z.object({provider:z.enum(['api-nba','balldontlie','the-odds-api.com','thesportsdb']),sourceGameId:z.string().min(1),league:z.literal('NBA'),season:z.number().int().nullable(),
 startsAt:stamp.nullable(),home:z.object({id:z.string().nullable(),name:z.string().min(1),code:z.string().nullable().optional()}).strict(),away:z.object({id:z.string().nullable(),name:z.string().min(1),code:z.string().nullable().optional()}).strict(),
 homeScore:score,awayScore:score,final:z.boolean(),compatibleTraining:z.boolean(),sourceUpdatedAt:stamp.nullable(),retrievedAt:stamp,receiptId:z.string().uuid(),rawHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type TeamGame=z.infer<typeof teamGameSchema>;
export const fixtureKey=(g:Pick<TeamGame,'startsAt'|'home'|'away'>)=>g.startsAt?JSON.stringify(['NBA',new Date(g.startsAt).toISOString(),g.home.name,g.away.name]):null;
export async function teamGames(e:RawEvidence):Promise<TeamGame[]>{
 if(await sha256(e.raw)!==e.hash)throw new Error('Team evidence hash mismatch');
 const u=new URL(e.sourceUrl),body=JSON.parse(e.raw),base={provider:e.provider,league:'NBA',sourceUpdatedAt:null,retrievedAt:e.retrievedAt,receiptId:e.id,rawHash:e.hash};
 let rows:unknown[]=[];
 if(e.provider==='api-nba'){
  if(u.origin!=='https://v2.nba.api-sports.io'||u.pathname!=='/games'||Object.keys(body.errors??{}).length)throw new Error('Wrong NBA games scope');
  const t=z.object({id,name:z.string(),code:z.string().nullable().optional()});
  const games=z.array(z.object({id,league:z.string(),season:z.number().int(),stage:z.number().int(),date:z.object({start:stamp}),status:z.object({short:z.number().int()}),teams:z.object({home:t,visitors:t}),scores:z.object({home:z.object({points:score}),visitors:z.object({points:score})})})).parse(body.response);
  rows=games.filter(g=>g.league==='standard').map(g=>({...base,sourceGameId:g.id,season:g.season,startsAt:g.date.start,home:g.teams.home,away:g.teams.visitors,homeScore:g.scores.home.points,awayScore:g.scores.visitors.points,final:g.status.short===3,compatibleTraining:g.stage===2}));
 }else if(e.provider==='balldontlie'){
  if(u.origin!=='https://api.balldontlie.io'||!/^\/v1\/games(?:\/\d+)?$/.test(u.pathname))throw new Error('Wrong BALLDONTLIE games endpoint');
  const t=z.object({id,full_name:z.string().min(1),abbreviation:z.string().optional()}),schema=z.object({id,season:z.number().int(),datetime:stamp.nullish(),status:z.string(),status_state:z.string().optional(),postseason:z.boolean(),postponed:z.boolean().optional(),home_team:t,visitor_team:t,home_team_score:score,visitor_team_score:score});
  const games=z.array(schema).parse(Array.isArray(body.data)?body.data:[body.data]);
  rows=games.map(g=>({...base,sourceGameId:g.id,season:g.season,startsAt:g.datetime??null,home:{id:g.home_team.id,name:g.home_team.full_name,code:g.home_team.abbreviation??null},away:{id:g.visitor_team.id,name:g.visitor_team.full_name,code:g.visitor_team.abbreviation??null},homeScore:g.home_team_score,awayScore:g.visitor_team_score,
   final:g.status==='Final'&&!g.postponed&&(g.status_state===undefined||g.status_state==='final'),compatibleTraining:!g.postseason&&!g.postponed&&u.searchParams.get('season_type')==='regular'}));
 }else if(e.provider==='the-odds-api.com'){
  if(u.origin!=='https://api.the-odds-api.com'||u.pathname!=='/v4/sports/basketball_nba/scores')throw new Error('Wrong scores source');
  const games=z.array(z.object({id:z.string(),sport_key:z.literal('basketball_nba'),commence_time:stamp,completed:z.boolean(),home_team:z.string(),away_team:z.string(),scores:z.array(z.object({name:z.string(),score:z.string().regex(/^\d+$/)})).nullable(),last_update:stamp.nullish()})).parse(body);
  rows=games.map(g=>{const scores=g.scores??[];
   if(scores.length&& (scores.length!==2||new Set(scores.map(s=>s.name)).size!==2||scores.some(s=>![g.home_team,g.away_team].includes(s.name))))throw new Error('Ambiguous NBA score outcomes');
   return {...base,sourceGameId:g.id,season:null,startsAt:g.commence_time,home:{id:null,name:g.home_team},away:{id:null,name:g.away_team},homeScore:scores.find(s=>s.name===g.home_team)?Number(scores.find(s=>s.name===g.home_team)!.score):null,awayScore:scores.find(s=>s.name===g.away_team)?Number(scores.find(s=>s.name===g.away_team)!.score):null,final:g.completed,compatibleTraining:false,sourceUpdatedAt:g.last_update??null};});
 }else if(e.provider==='thesportsdb'){
  if(u.origin!=='https://www.thesportsdb.com'||!/^\/api\/v1\/json\/123\/(?:eventsseason|lookupevent)\.php$/.test(u.pathname))throw new Error('Wrong free results endpoint');
  const games=z.array(z.object({idEvent:z.string(),strLeague:z.string(),strSport:z.string(),strSeason:z.string().nullable(),strTimestamp:z.string().nullish().transform(s=>stamp.safeParse(s).success?s!:null),idHomeTeam:z.string().nullable(),idAwayTeam:z.string().nullable(),strHomeTeam:z.string(),strAwayTeam:z.string(),intHomeScore:z.string().regex(/^\d+$/).nullable(),intAwayScore:z.string().regex(/^\d+$/).nullable(),strStatus:z.string().nullable()})).parse(body.events??[]);
  rows=games.filter(g=>g.strLeague==='NBA'&&g.strSport==='Basketball').map(g=>({...base,sourceGameId:g.idEvent,season:g.strSeason&&/^\d{4}-\d{4}$/.test(g.strSeason)?Number(g.strSeason.slice(0,4)):null,startsAt:g.strTimestamp??null,home:{id:g.idHomeTeam,name:g.strHomeTeam},away:{id:g.idAwayTeam,name:g.strAwayTeam},homeScore:g.intHomeScore===null?null:Number(g.intHomeScore),awayScore:g.intAwayScore===null?null:Number(g.intAwayScore),final:['Match Finished','FT','AOT'].includes(g.strStatus??''),compatibleTraining:false}));
 }else throw new Error('Unsupported team-game provider');
 const parsed=z.array(teamGameSchema).parse(rows),seen=new Set<string>();
 for(const g of parsed){if(seen.has(g.sourceGameId)||g.home.name===g.away.name||g.home.id!==null&&g.home.id===g.away.id)throw new Error('Duplicate/ambiguous team-game identity');seen.add(g.sourceGameId);
  if(g.final&&g.startsAt&&Date.parse(g.retrievedAt)<Date.parse(g.startsAt))throw new Error('Final score before event start');}
 return parsed;
}
/** One label per exact game, not one per side/quote/provider. Conflicting scores
 * are excluded until a source correction resolves them; never silently averaged.
 */
export function usableTeamGames(rows:TeamGame[],cutoff:string,retrospective=false){
 stamp.parse(cutoff);const qualified=rows.map(g=>teamGameSchema.parse(g)).filter(g=>g.compatibleTraining&&g.final&&g.season!==null&&g.startsAt&&Date.parse(g.startsAt)<Date.parse(cutoff)&&g.homeScore!==null&&g.awayScore!==null&&g.homeScore!==g.awayScore&&(retrospective||Date.parse(g.retrievedAt)<=Date.parse(cutoff)));
 const grouped=new Map<string,TeamGame[]>();for(const g of qualified){const key=fixtureKey(g)!;grouped.set(key,[...(grouped.get(key)??[]),g]);}
 const conflicts:string[]=[],games:TeamGame[]=[];for(const [key,group]of grouped){if(new Set(group.map(g=>JSON.stringify([g.homeScore,g.awayScore]))).size!==1)conflicts.push(key);else games.push(group.sort((a,b)=>Date.parse(a.retrievedAt)-Date.parse(b.retrievedAt))[0]);}
 return {games:games.sort((a,b)=>a.startsAt!.localeCompare(b.startsAt!)),conflicts};
}
