import {z} from 'zod';
import {digest,type RawEvidence} from './evidence.server';
import {teamGames,type TeamGame} from './team-games';
export const BDL_HISTORY_BOUNDS=Object.freeze({seasons:[2022,2023,2024] as const,pagesPerSeason:14,totalRequests:42,minSpacingMs:12600,requestsPerMinute:5,dailyCeiling:60});
export function historyRequest(season:number,cursor:number|null){
 if(!BDL_HISTORY_BOUNDS.seasons.some(s=>s===season)||cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<0))throw new Error('Unapproved historical request');
 return {'seasons[]':String(season),season_type:'regular',per_page:'100',...(cursor===null?{}:{cursor:String(cursor)})};
}
export async function inspectHistoryPage(e:RawEvidence,season:number,cursor:number|null,previousIds:Set<string>,seenCursors:Set<number>){
 const url=new URL(e.sourceUrl),params=historyRequest(season,cursor);
 if(e.provider!=='balldontlie'||digest(e.raw)!==e.hash||url.origin!=='https://api.balldontlie.io'||url.pathname!=='/v1/games'||url.username||url.password||url.searchParams.size!==Object.keys(params).length||Object.entries(params).some(([k,v])=>url.searchParams.get(k)!==v))throw new Error('Historical source scope/hash mismatch');
 const body=z.object({data:z.array(z.object({id:z.number().int(),season:z.number().int(),postseason:z.boolean()}).passthrough()).max(100),meta:z.object({per_page:z.literal(100),next_cursor:z.number().int().nonnegative().nullish(),prev_cursor:z.number().int().nonnegative().nullish()}).passthrough()}).parse(JSON.parse(e.raw));
 // BDL provides the NEXT cursor; prev_cursor is not a documented echo of
 // the request cursor. Validate the requested cursor through the receipt URL.
 if(body.data.some(g=>g.season!==season||g.postseason))throw new Error('Historical season/pagination mismatch');
 const ids=body.data.map(g=>String(g.id));if(new Set(ids).size!==ids.length||ids.some(id=>previousIds.has(id)))throw new Error('Duplicate historical game: retain page for correction review');
 const next=body.meta.next_cursor??null;if(next!==null&&(seenCursors.has(next)||next===cursor)||next===null&&body.meta.next_cursor===undefined&&body.data.length===100)throw new Error('Ambiguous or looping historical pagination');
 const games=await teamGames(e);if(games.length!==body.data.length)throw new Error('Historical decoder coverage mismatch');
 const incomplete=games.filter(g=>!g.final||!g.compatibleTraining||g.homeScore===null||g.awayScore===null||g.homeScore===g.awayScore||!g.startsAt);
 return {games,ids,next,incomplete};
}
export async function validateHistoryPage(e:RawEvidence,season:number,cursor:number|null,previousIds:Set<string>,seenCursors:Set<number>){
 const parsed=await inspectHistoryPage(e,season,cursor,previousIds,seenCursors);
 if(parsed.incomplete.length)throw new Error('Incomplete historical finals/identity; retain evidence without inventing facts');
 return parsed;
}

/** Explicit matching policy; day-level discrepancies are reported, never used
 * to rewrite a source-issued start or join ambiguous repeated fixtures. */
export function reconcileHistoricalGames(original:TeamGame[],recovered:TeamGame[]){
 const key=(g:TeamGame)=>JSON.stringify([g.season,g.home.code??g.home.name,g.away.code??g.away.name,g.startsAt?.slice(0,10)]),byKey=Map.groupBy(recovered,key);
 const matched:{original:TeamGame;recovered:TeamGame;startDifferenceSeconds:number;scoreEqual:boolean}[]=[],missing:TeamGame[]=[],ambiguous:TeamGame[]=[];const used=new Set<string>();
 for(const g of original){const candidates=byKey.get(key(g))??[];if(!candidates.length){missing.push(g);continue;}if(candidates.length!==1){ambiguous.push(g);continue;}const r=candidates[0];if(used.has(r.sourceGameId)){ambiguous.push(g);continue;}used.add(r.sourceGameId);matched.push({original:g,recovered:r,startDifferenceSeconds:(Date.parse(r.startsAt!)-Date.parse(g.startsAt!))/1000,scoreEqual:g.homeScore===r.homeScore&&g.awayScore===r.awayScore});}
 return {policy:'season-exact-team-code-home-away-UTC-event-date-1',matched,missing,ambiguous,additional:recovered.filter(g=>!used.has(g.sourceGameId)),scoreDiscrepancies:matched.filter(g=>!g.scoreEqual),startDiscrepancies:matched.filter(g=>g.startDifferenceSeconds!==0)};
}
