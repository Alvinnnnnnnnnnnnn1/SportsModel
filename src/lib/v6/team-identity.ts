import { z } from 'zod';
import { sha256 } from '@/lib/imports/duplicates';
import type { RawEvidence } from './evidence.server';
import type { TeamGame } from './team-games';
/** Exact provider IDs + shared league-qualified abbreviation, never fuzzy names.
 * Canonicalisation is a separately retained transformation, not a raw-source edit.
 */
export async function teamRegistry(catalogue:RawEvidence,rows:TeamGame[]){
 if(catalogue.provider!=='balldontlie'||new URL(catalogue.sourceUrl).origin!=='https://api.balldontlie.io'||new URL(catalogue.sourceUrl).pathname!=='/v1/teams'||await sha256(catalogue.raw)!==catalogue.hash)throw new Error('Invalid team catalogue');
 const teams=z.array(z.object({id:z.number().int().positive(),full_name:z.string().min(1),city:z.string(),name:z.string(),abbreviation:z.string(),conference:z.string(),division:z.string()})).parse(JSON.parse(catalogue.raw).data)
  .filter(t=>['East','West'].includes(t.conference)&&['Atlantic','Central','Southeast','Northwest','Pacific','Southwest'].includes(t.division));
 if(teams.length!==30||new Set(teams.map(t=>t.id)).size!==30||new Set(teams.map(t=>t.abbreviation)).size!==30)throw new Error('Exact thirty-team NBA catalogue required');
 const knownCodes=new Set(rows.filter(r=>r.provider==='api-nba'&&r.compatibleTraining).flatMap(r=>[r.home.code,r.away.code]).filter((s):s is string=>Boolean(s))),mappings:Record<string,{canonicalId:string;name:string;code:string;aliases:string[]}>={},blocked:string[]=[];
 for(const row of rows)for(const side of [row.home,row.away]){
  if(!side.id||!side.code||!knownCodes.has(side.code)){blocked.push(row.provider+':'+side.id);continue;}
  const matches=teams.filter(t=>t.abbreviation===side.code);if(matches.length!==1){blocked.push(row.provider+':'+side.id);continue;}
  const t=matches[0];if(row.provider==='balldontlie'&&(String(t.id)!==side.id||t.full_name!==side.name)){blocked.push(row.provider+':'+side.id);continue;}
  const key=row.provider+':'+side.id,value={canonicalId:'NBA:'+side.code,name:t.full_name,code:side.code,aliases:[...new Set([t.full_name,`${t.city} ${t.name}`.trim()])]};
  if(mappings[key]&&JSON.stringify(mappings[key])!==JSON.stringify(value))throw new Error('Conflicting team identifier bridge');mappings[key]=value;
 }
 const registry={version:1,recordedAt:new Date().toISOString(),catalogueHash:catalogue.hash,catalogueReceiptId:catalogue.id,sourceHashes:[...new Set(rows.map(r=>r.rawHash))].sort(),mappings,blocked:[...new Set(blocked)]};
 return {...registry,hash:await sha256(JSON.stringify(registry))};
}
export type TeamRegistry=Awaited<ReturnType<typeof teamRegistry>>;
export function resolveTeamLabel(registry:TeamRegistry,label:string){
 const found=[...new Map(Object.values(registry.mappings).filter(m=>m.name===label||m.aliases?.includes(label)).map(m=>[m.canonicalId,m])).values()];return found.length===1?found[0]:null;
}
export function canonicalTeamRows(rows:TeamGame[],registry:TeamRegistry){
 const matched:TeamGame[]=[],blocked:TeamGame[]=[];
 for(const row of rows){const h=registry.mappings[row.provider+':'+row.home.id],a=registry.mappings[row.provider+':'+row.away.id];if(!h||!a){blocked.push(row);continue;}
  matched.push({...row,home:{...row.home,name:h.name},away:{...row.away,name:a.name}});}
 return {matched,blocked};
}
