/** Offline provenance analysis. Never grants upload/activation authority. */
import {z} from 'zod';
import {isDeepStrictEqual} from 'node:util';
import {digest,type RawEvidence} from '../evidence.server';
import {teamGames,teamGameSchema,usableTeamGames,type TeamGame} from '../team-games';
import {ELO_ONLY_DEFINITION,TEAM_MODEL} from '../team-model';
import {PREDICTION_PROTOCOL} from '../prediction/evaluation';
import {validateSnapshot,type SourceSnapshot} from './snapshot.server';

export type RetentionClass='permitted_private_retention'|'derived_private_retention'|'excluded_rights_unverified'|'reconstructible'|'unavailable';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const receiptSchema=z.object({id:z.string().uuid(),provider:z.enum(['api-nba','api-basketball','balldontlie','the-odds-api.com','thesportsdb']),sourceUrl:z.string().url(),retrievedAt:z.string().datetime({offset:true}),sourceUpdatedAt:z.string().datetime({offset:true}).nullable(),raw:z.string(),hash}).strict();
const permitted=new Set(['balldontlie','the-odds-api.com']);
export function checkedReceipt(value:unknown):RawEvidence {
 const e=receiptSchema.parse(value),url=new URL(e.sourceUrl);
 const origins:Record<RawEvidence['provider'],string>={'api-nba':'https://v2.nba.api-sports.io','api-basketball':'https://v1.basketball.api-sports.io',balldontlie:'https://api.balldontlie.io','the-odds-api.com':'https://api.the-odds-api.com',thesportsdb:'https://www.thesportsdb.com'};
 if(digest(e.raw)!==e.hash||url.origin!==origins[e.provider]||url.username||url.password||url.hash||[...url.searchParams.keys()].some(k=>/key|token|secret|password/i.test(k)))throw new Error('Invalid source receipt provenance');
 return e;
}
const hashFields=new Set(['rawHash','sourceHash','sourceHashes','catalogueHash','historyHash','sourceDatasetHash','protocolHash','baselineDefinitionHash','artifactHash','registryHash','shadowHash','originalResultRevisionHash','reconciliationDecisionHash','policyHash']);
const receiptFields=new Set(['receiptId','receiptIds','catalogueReceiptId','sourceReceiptId','sourceReceipt','originalFixtureReceipt']);
function facts(value:unknown){
 const providers=new Set<string>(),refs:{field:string;value:string}[]=[];
 const walk=(v:unknown)=>{if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){
  if(k==='provider'&&typeof x==='string')providers.add(x);
  if(hashFields.has(k)||receiptFields.has(k)||k==='shadowId')for(const item of Array.isArray(x)?x:[x])if(typeof item==='string')refs.push({field:k,value:item});
  // Raw provider bytes are not references to application models merely because
  // an event/receipt UUID happens to equal a shadow-file name.
  if(k!=='raw')walk(x);
 }};walk(value);return {providers:[...providers].sort(),refs};
}
export function dependencyGraph(raw:SourceSnapshot,objects:Map<string,string>){
 const manifest=validateSnapshot(raw),values=new Map<string,unknown>(),identities=new Map<string,Set<string>>(),receipts=new Map<string,Set<string>>();
 const index=(map:Map<string,Set<string>>,key:string,id:string)=>map.set(key,new Set([...(map.get(key)??[]),id]));
 const code=[['code:elo-only',ELO_ONLY_DEFINITION],['code:challenger',TEAM_MODEL],['code:prediction-protocol',PREDICTION_PROTOCOL]] as const;
 for(const [id,v]of code)index(identities,digest(JSON.stringify(v)),id);
 for(const file of manifest.files){const body=objects.get(file.hash);if(!body||digest(body)!==file.hash||Buffer.byteLength(body)!==file.bytes)throw new Error('Dependency object integrity mismatch');const v=JSON.parse(body);values.set(file.path,v);index(identities,file.hash,file.path);index(identities,file.path.slice(file.path.lastIndexOf('/')+1,-5),file.path);
  const embedded=(x:unknown)=>{if(!x||typeof x!=='object')return;const o=x as Record<string,unknown>;if(typeof o.hash==='string'&&hash.safeParse(o.hash).success){const {hash:semantic,...rest}=o;if(digest(JSON.stringify(o.record??rest))===semantic)index(identities,semantic as string,file.path);}for(const [key,child]of Object.entries(o))if(key!=='raw')embedded(child);};embedded(v);
  if(file.path.startsWith('evidence-receipts/')||file.path.startsWith('evidence/')){const e=checkedReceipt(v);index(receipts,e.hash,file.path);index(receipts,e.id,file.path);}
 }
 const nodes=manifest.files.map(file=>{
  const {providers,refs}=facts(values.get(file.path)),dependencies=new Set<string>(),missing=new Set<string>();
  for(const r of refs){const source=receiptFields.has(r.field)||['rawHash','sourceHash','sourceHashes','catalogueHash'].includes(r.field)?receipts:identities;const candidates=source.get(r.value)??(r.field==='sourceHash'?identities.get(r.value):undefined);const found=r.field==='shadowId'?new Set([...(candidates??[])].filter(id=>id.startsWith('team-shadow/'))):candidates;if(!found?.size)missing.add(r.field+':'+r.value);else for(const id of found)if(id!==file.path)dependencies.add(id);}
  const directReceipt=/^(evidence|evidence-receipts)\//.test(file.path);
  const internal=/^(odds-shared-budget|balldontlie-team-budget|source-quota-receipts\/[a-f0-9-]{36}|model-development\/protocols\/[a-f0-9]{64}|controlled\/[a-f0-9]{64}\/(scheduler|health))\.json$/.test(file.path);
  let classification:RetentionClass=providers.some(p=>!permitted.has(p))?'excluded_rights_unverified':missing.size?'unavailable':directReceipt&&providers.length===1?'permitted_private_retention':internal||dependencies.size?'derived_private_retention':'unavailable';
  // A provider label on an arbitrary derived object never substitutes for parents.
  if(classification!=='excluded_rights_unverified'&&!directReceipt&&!internal&&!dependencies.size)classification='unavailable';
  return {...file,id:file.path,providers,dependencies:[...dependencies].sort(),missing:[...missing].sort(),classification,reason:classification==='excluded_rights_unverified'?'Restricted or unverified provider lineage':classification==='unavailable'?'Explicit parent provenance missing':'Private retention review only; upload approval absent'};
 });
 const byId=new Map(nodes.map(n=>[n.id,n]));let changed=true;
 while(changed){changed=false;for(const n of nodes){if(!['permitted_private_retention','derived_private_retention'].includes(n.classification))continue;const blocked=n.dependencies.map(id=>byId.get(id)).filter(x=>x&&['excluded_rights_unverified','unavailable'].includes(x.classification));if(blocked.length){n.classification='excluded_rights_unverified';n.reason='Depends on excluded/unavailable evidence';changed=true;}}}
 return {format:'edgelab.v6-cloud-dependencies',version:1,cloudUploadApproved:false,hostTransferReady:false,nodes,code:code.map(([id,v])=>({id,hash:digest(JSON.stringify(v)),classification:'derived_private_retention',reason:'Versioned software definition; no provider records'}))};
}

/** Filter an existing journal only after replaying each retained row from its
 * actual BDL receipt. No rewriting IDs, nullable facts, availability or outcomes. */
export async function reconstructBdlJournal(store:unknown,evidence:RawEvidence[]){
 const parsed=z.object({format:z.literal('edgelab.v6-team-games'),version:z.literal(1),rows:z.record(z.string(),z.array(z.object({revision:z.number().int(),previousHash:hash.nullable(),hash,factsHash:hash,record:teamGameSchema}).strict()))}).strict().parse(store);
 const eligible=evidence.filter(e=>e.provider==='balldontlie').map(checkedReceipt),byId=new Map(eligible.map(e=>[e.id,e])),cache=new Map<string,TeamGame[]>();
 const rows:typeof parsed.rows={};const parents=new Set<string>();let legacyOmittedTeamCodes=0;
 for(const [key,history]of Object.entries(parsed.rows)){
  if(!history.every(r=>r.record.provider==='balldontlie'))continue;
  for(let i=0;i<history.length;i++){const {hash:rowHash,...data}=history[i],g=data.record;
   if(data.revision!==i+1||data.previousHash!==(history[i-1]?.hash??null)||digest(JSON.stringify(data))!==rowHash||key!==digest(JSON.stringify([g.provider,g.sourceGameId])))throw new Error('BDL journal chain mismatch');
   const e=byId.get(g.receiptId);if(!e||e.hash!==g.rawHash)throw new Error('BDL original receipt missing');
   if(!cache.has(e.id))cache.set(e.id,await teamGames(e));const source=cache.get(e.id)!.find(s=>s.sourceGameId===g.sourceGameId);
   const replay=source?structuredClone(source):null;
   // Earlier decoder versions omitted this optional field. Preserve the stored
   // omission; compare every originally asserted fact, rather than adding codes
   // retrospectively or treating an additive decoder field as conflicting data.
   if(replay)for(const side of ['home','away'] as const)if(g[side].code===undefined){delete replay[side].code;legacyOmittedTeamCodes++;}
   if(!isDeepStrictEqual(replay,g))throw new Error('BDL row disagrees with original receipt');
   const {retrievedAt,receiptId,rawHash,...sourceFacts}=g;void retrievedAt;void receiptId;void rawHash;
   if(data.factsHash!==digest(JSON.stringify(sourceFacts)))throw new Error('BDL facts hash mismatch');parents.add(e.id);
  }rows[key]=history;
 }
 const dataset={format:parsed.format,version:parsed.version,rows},latest=Object.values(rows).map(rs=>rs.at(-1)!.record),canonical=usableTeamGames(latest,'9999-01-01T00:00:00Z',true);
 if(canonical.conflicts.length)throw new Error('Conflicting BDL reconstruction');
 return {method:'bdl-receipt-verified-journal-1',dataset,latest,canonical:canonical.games,receiptIds:[...parents].sort(),legacyOmittedTeamCodes,missingTrainingSeasons:[2022,2023,2024].filter(s=>!canonical.games.some(g=>g.season===s)),changesOriginal:false,modelEquivalent:false};
}

/** New reconstruction, not a replacement for the mixed historical registry. */
export function bdlOnlyRegistry(catalogue:RawEvidence,rows:TeamGame[],recordedAt:string){
 z.string().datetime({offset:true}).parse(recordedAt);
 const e=checkedReceipt(catalogue);if(e.provider!=='balldontlie'||new URL(e.sourceUrl).pathname!=='/v1/teams')throw new Error('BDL catalogue required');
 const teams=z.array(z.object({id:z.number().int().positive(),full_name:z.string(),city:z.string(),name:z.string(),abbreviation:z.string(),conference:z.string(),division:z.string()})).parse(JSON.parse(e.raw).data).filter(t=>['East','West'].includes(t.conference)&&['Atlantic','Central','Southeast','Northwest','Pacific','Southwest'].includes(t.division));
 if(teams.length!==30||new Set(teams.map(t=>t.id)).size!==30||new Set(teams.map(t=>t.abbreviation)).size!==30)throw new Error('Exact BDL thirty-team catalogue required');
 const mappings:Record<string,{canonicalId:string;name:string;code:string;aliases:string[]}>={};
 for(const g of rows)for(const side of [g.home,g.away]){const t=teams.find(t=>String(t.id)===side.id&&t.abbreviation===side.code&&t.full_name===side.name);if(g.provider!=='balldontlie'||!t)throw new Error('BDL exact identity mismatch');mappings['balldontlie:'+side.id]={canonicalId:'NBA:'+t.abbreviation,name:t.full_name,code:t.abbreviation,aliases:[t.full_name]};}
 const registry={version:1,recordedAt,catalogueHash:e.hash,catalogueReceiptId:e.id,sourceHashes:[...new Set(rows.map(g=>g.rawHash))].sort(),mappings,blocked:[]};
 return {...registry,hash:digest(JSON.stringify(registry))};
}
