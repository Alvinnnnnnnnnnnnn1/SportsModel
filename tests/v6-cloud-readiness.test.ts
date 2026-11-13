import {describe,it,expect} from 'vitest';
import {digest,type RawEvidence} from '@/lib/v6/evidence.server';
import {teamGames} from '@/lib/v6/team-games';
import {dependencyGraph,reconstructBdlJournal,checkedReceipt,bdlOnlyRegistry} from '@/lib/v6/cloud/readiness.server';
import {verifyReadinessBindings} from '@/lib/v6/cloud/provisioning.server';
import type {SourceSnapshot} from '@/lib/v6/cloud/snapshot.server';

const receipt=(provider:RawEvidence['provider']='balldontlie'):RawEvidence=>{
 const raw=JSON.stringify({data:[{id:1,season:2025,datetime:'2026-01-01T00:00:00Z',status:'Final',postseason:false,home_team:{id:1,full_name:'LOCAL Home',abbreviation:'H'},visitor_team:{id:2,full_name:'LOCAL Away',abbreviation:'A'},home_team_score:100,visitor_team_score:90}]});
 return {id:crypto.randomUUID(),provider,sourceUrl:provider==='balldontlie'?'https://api.balldontlie.io/v1/games?season_type=regular':'https://v2.nba.api-sports.io/games',retrievedAt:'2026-01-02T00:00:00Z',sourceUpdatedAt:null,raw,hash:digest(raw)};
};
function source(items:{path:string;value:unknown}[]){const objects=new Map<string,string>(),files=items.map(i=>{const body=JSON.stringify(i.value),hash=digest(body);objects.set(hash,body);return {path:i.path,hash,bytes:Buffer.byteLength(body)};});return {manifest:{format:'edgelab.v6-source-snapshot',version:1,files} as SourceSnapshot,objects};}
describe('typed cloud model dependency provenance',()=>{
 it('does not confuse a raw quote receipt UUID with a dependent shadow UUID',()=>{
  const e=receipt(),input=source([{path:'evidence-receipts/'+e.id+'.json',value:e},{path:'team-shadow/'+e.id+'.json',value:{artifactHash:'a'.repeat(64)}}]);
  const graph=dependencyGraph(input.manifest,input.objects);expect(graph.nodes[0].classification).toBe('permitted_private_retention');expect(graph.nodes[0].dependencies).toEqual([]);expect(graph.nodes[1].classification).toBe('unavailable');
 });
 it('propagates excluded mixed-history lineage into derived models and config',()=>{
  const history='b'.repeat(64),artifact='c'.repeat(64),input=source([{path:'team-games/snapshots/'+history+'.json',value:[{provider:'api-nba'}]},{path:'model-development/artifacts/'+artifact+'.json',value:{sourceDatasetHash:history}},{path:'model-development/shadow-config.json',value:{artifactHash:artifact}}]);
  const graph=dependencyGraph(input.manifest,input.objects);expect(graph.nodes.every(n=>n.classification==='excluded_rights_unverified')).toBe(true);expect(graph.nodes[2].dependencies).toEqual(['model-development/artifacts/'+artifact+'.json']);expect(graph.cloudUploadApproved).toBe(false);
 });
 it('rejects changed bytes and credential-bearing or origin-spoofed source receipts',()=>{
  const e=receipt(),f=source([{path:'evidence-receipts/'+e.id+'.json',value:e}]);expect(()=>dependencyGraph(f.manifest,new Map([[f.manifest.files[0].hash,'{}']]))).toThrow('integrity');expect(()=>checkedReceipt({...e,sourceUrl:e.sourceUrl+'&apiKey=LOCAL'})).toThrow();expect(()=>checkedReceipt({...e,sourceUrl:'https://evil.invalid/v1/games'})).toThrow();
 });
 it('keeps result evaluations with withheld forecasts or missing strict-result hashes local',()=>{
  const shadowId=crypto.randomUUID(),e=receipt(),input=source([{path:'evidence-receipts/'+e.id+'.json',value:e},{path:'team-shadow/'+shadowId+'.json',value:{historyHash:'f'.repeat(64)}},{path:'team-shadow-reconciliations/'+shadowId+'/evaluations/'+digest('LOCAL evaluation')+'.json',value:{shadowId,sourceHashes:[e.hash],originalResultRevisionHash:'e'.repeat(64)}}]);
  const n=dependencyGraph(input.manifest,input.objects).nodes[2];expect(n.classification).not.toBe('derived_private_retention');expect(n.dependencies).toContain('team-shadow/'+shadowId+'.json');expect(n.missing).toContain('originalResultRevisionHash:'+'e'.repeat(64));
 });
 it('replays retained BDL facts, preserves earlier omitted metadata and rejects invented statistics',async()=>{
  const e=receipt(),g=(await teamGames(e))[0];delete g.home.code;delete g.away.code;
  const {retrievedAt,receiptId,rawHash,...facts}=g;void retrievedAt;void receiptId;void rawHash;
  const data={revision:1,previousHash:null,factsHash:digest(JSON.stringify(facts)),record:g},key=digest(JSON.stringify([g.provider,g.sourceGameId])),store={format:'edgelab.v6-team-games',version:1,rows:{[key]:[{...data,hash:digest(JSON.stringify(data))}]}};
  const result=await reconstructBdlJournal(store,[e]);expect(result.canonical).toEqual([g]);expect(result.legacyOmittedTeamCodes).toBe(2);expect(result.modelEquivalent).toBe(false);expect(result.missingTrainingSeasons).toEqual([2022,2023,2024]);expect(result.dataset.rows[key][0].record.home.code).toBeUndefined();
  await expect(reconstructBdlJournal(store,[])).rejects.toThrow('receipt missing');
  const changed=structuredClone(data);changed.record.homeScore=101;store.rows[key]=[{...changed,hash:digest(JSON.stringify(changed))}];await expect(reconstructBdlJournal(store,[e])).rejects.toThrow('disagrees');
 });
 it('never allows a well-hashed partial archive to become a full-runner approval',()=>{
  const dependency=JSON.stringify({snapshotHash:'a',fullRunnerReady:false}),model=JSON.stringify({fullRunnerReady:false,independentProcessesIdentical:true});const staging={snapshotHash:'a',dependencyManifestHash:digest(dependency),modelReadinessHash:digest(model),bundlePurpose:'partial_source_archive_only'};
  expect(()=>verifyReadinessBindings(staging,dependency,model)).toThrow('blocked');expect(()=>verifyReadinessBindings(staging,dependency+' ',model)).toThrow('binding');
 });
 it('records a new identity reconstruction time without backdating it to the old catalogue',async()=>{
  const e=receipt(),rows=await teamGames(e),raw=JSON.stringify({data:Array.from({length:30},(_,i)=>({id:i+1,full_name:i===0?'LOCAL Home':i===1?'LOCAL Away':'LOCAL '+i,abbreviation:i===0?'H':i===1?'A':'T'+i,city:'LOCAL',name:String(i),conference:'East',division:'Atlantic'}))});
  const catalog={...e,sourceUrl:'https://api.balldontlie.io/v1/teams',raw,hash:digest(raw)},at='2026-11-13T04:00:00Z';
  expect(bdlOnlyRegistry(catalog,rows,at).recordedAt).toBe(at);expect(catalog.retrievedAt).toBe('2026-01-02T00:00:00Z');
  const changed=structuredClone(rows);changed[0].home.name='Almost LOCAL Home';expect(()=>bdlOnlyRegistry(catalog,changed,at)).toThrow('identity mismatch');
 });
});
