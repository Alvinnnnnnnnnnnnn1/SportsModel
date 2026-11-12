import {z} from 'zod';
import {sha256} from '@/lib/imports/duplicates';
import type {RawEvidence} from './evidence.server';
export const TEAM_CATALOGUE_POLICY=Object.freeze({id:'nba-team-catalogue-refresh-1',maximumAgeDays:7,unchangedCanonicalMembershipRequired:true});
async function signature(e:RawEvidence){
 if(e.provider!=='balldontlie'||new URL(e.sourceUrl).origin!=='https://api.balldontlie.io'||new URL(e.sourceUrl).pathname!=='/v1/teams'||await sha256(e.raw)!==e.hash)throw new Error('Invalid canonical catalogue source');
 const rows=z.array(z.object({id:z.number().int().positive(),full_name:z.string(),abbreviation:z.string(),conference:z.string(),division:z.string()})).parse(JSON.parse(e.raw).data)
  .filter(t=>['East','West'].includes(t.conference)&&['Atlantic','Central','Southeast','Northwest','Pacific','Southwest'].includes(t.division));
 if(rows.length!==30||new Set(rows.map(t=>t.id)).size!==30||new Set(rows.map(t=>t.abbreviation)).size!==30)throw new Error('Canonical thirty-team membership required');
 return JSON.stringify(rows.sort((a,b)=>a.id-b.id).map(t=>[t.id,t.abbreviation,t.full_name]));
}
/** Under an activated source policy only. Native ID/code/name changes require
 * review; harmless metadata/fetch-time changes do not need a daily user prompt. */
export async function currentTeamCatalogue(old:RawEvidence|undefined,at:string,refresh:()=>Promise<RawEvidence>){
 if(!old)throw new Error('Reviewed canonical catalogue bootstrap required');const prior=await signature(old),now=Date.parse(z.string().datetime({offset:true}).parse(at));
 if(Date.parse(old.retrievedAt)>now)throw new Error('Future canonical catalogue');
 if(now-Date.parse(old.retrievedAt)<=7*86400000)return old;
 const next=await refresh();if(await signature(next)!==prior)throw new Error('Canonical team membership changed; explicit identity review required');
 if(Date.parse(next.retrievedAt)>now+60000||now-Date.parse(next.retrievedAt)>7*86400000)throw new Error('Refreshed catalogue clock invalid');return next;
}
