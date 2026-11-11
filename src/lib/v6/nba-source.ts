import { z } from 'zod';
import { sha256 } from '@/lib/imports/duplicates';
import { nbaGameLogSchema,type NbaGameLog } from './nba-points';
import type { RawEvidence } from './evidence.server';
const stamp=z.string().datetime({offset:true});
const id=z.number().int().positive().transform(String);
const nbaGame=z.object({id,league:z.string(),season:z.number().int(),stage:z.number().int(),date:z.object({start:stamp,end:stamp.nullable()}),status:z.object({short:z.number().int()}),teams:z.object({home:z.object({id,name:z.string()}),visitors:z.object({id,name:z.string()})})});
export type NbaFixture=z.infer<typeof nbaGame>;
async function checked(e:RawEvidence,endpoint:string) {
  if(e.provider!=='api-nba'||new URL(e.sourceUrl).origin!=='https://v2.nba.api-sports.io'||new URL(e.sourceUrl).pathname!==endpoint||await sha256(e.raw)!==e.hash)throw new Error('NBA source identity/hash invalid');
  const body=z.object({errors:z.union([z.array(z.unknown()),z.record(z.string(),z.unknown())]),response:z.array(z.unknown())}).parse(JSON.parse(e.raw));
  if(Object.keys(body.errors).length)throw new Error('NBA provider scope/error response');return body.response;
}
export async function nbaFixtures(evidence:RawEvidence) {
  const rows=z.array(nbaGame).parse(await checked(evidence,'/games'));
  if(new Set(rows.map(g=>g.id)).size!==rows.length)throw new Error('Duplicate NBA fixture IDs');
  return rows.filter(g=>g.league==='standard');
}
export function nbaMinutes(raw:unknown):number|null {
  if(typeof raw==='number')return Number.isFinite(raw)&&raw>=0&&raw<=75?raw:null;
  if(typeof raw!=='string')return null;
  if(/^\d{1,2}:\d{2}$/.test(raw)){const [minutes,seconds]=raw.split(':').map(Number);return seconds<60&&minutes+seconds/60<=75?minutes+seconds/60:null;}
  if(/^\d{1,2}(\.\d+)?$/.test(raw)&&Number(raw)<=75)return Number(raw);
  return null;
}
export async function nbaPlayerLogs(games:RawEvidence,statistics:RawEvidence) {
  const fixtures=await nbaFixtures(games),rows=await checked(statistics,'/players/statistics');
  const playerStat=z.object({player:z.object({id}),team:z.object({id}),game:z.object({id}),points:z.number().int().nonnegative().nullable(),min:z.unknown().optional(),comment:z.string().nullable().optional()});
  const logs:NbaGameLog[]=[],unmatched:string[]=[],seen=new Set<string>();
  for(const input of rows){const r=playerStat.parse(input),g=fixtures.find(g=>g.id===r.game.id);
    if(!g){unmatched.push(r.game.id);continue;}
    if(![g.teams.home.id,g.teams.visitors.id].includes(r.team.id))throw new Error('NBA player team does not belong to exact fixture');
    const key=r.player.id+':'+g.id;if(seen.has(key))throw new Error('Duplicate NBA player-game row');seen.add(key);
    const minutes=nbaMinutes(r.min),dnp=minutes===0&&/^(DNP|Did not play)(\b|\s|$)/i.test(r.comment??'');
    logs.push(nbaGameLogSchema.parse({playerId:r.player.id,teamId:r.team.id,gameId:g.id,season:g.season,stage:g.stage,startsAt:g.date.start,completedAt:g.date.end,
      finalObservedAt:[games.retrievedAt,statistics.retrievedAt].sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)!,minutes,points:r.points,participated:minutes!==null&&minutes>0?true:dnp?false:null,final:g.status.short===3,
      sourceHashes:[games.hash,statistics.hash]}));
  }
  return {logs,unmatchedGameIds:[...new Set(unmatched)],sourcePublicationTimestamp:null};
}
