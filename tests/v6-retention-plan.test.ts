import {describe,it,expect} from 'vitest';
import {prepareSourceRetentionPlan} from '@/lib/v6/cloud/retention-plan.server';
import {digest} from '@/lib/v6/evidence.server';
import type {SourceSnapshot} from '@/lib/v6/cloud/snapshot.server';

function fixture(items:{path?:string;value:unknown}[]){
 const objects=new Map<string,string>();const files=items.map(item=>{
  const body=JSON.stringify(item.value),hash=digest(body);objects.set(hash,body);
  return {path:item.path??'evidence/'+hash+'.json',hash,bytes:Buffer.byteLength(body)};
 });
 return {manifest:{format:'edgelab.v6-source-snapshot',version:1,files} as SourceSnapshot,objects};
}
describe('offline, fail-closed source retention preview',()=>{
 it('withholds nested/mixed API-Sports and unknown sources without rewriting permitted bodies',()=>{
  const f=fixture([{value:{provider:'the-odds-api.com',originalOdds:1.72,sourceUpdatedAt:null}},{value:{provider:'thesportsdb'}},{value:[{provider:'balldontlie'},{provider:'api-nba'}]},{path:'odds-shared-budget.json',value:{reserved:10,used:10,remaining:490}}]);
  const result=prepareSourceRetentionPlan(f.manifest,f.objects);
  expect(result.manifest.files.map(x=>x.path)).toEqual([f.manifest.files[0].path,'odds-shared-budget.json']);
  expect(result.manifest.files[0]).toEqual(f.manifest.files[0]);expect(f.objects.get(result.manifest.files[0].hash)).toContain('1.72');
  expect(result.review).toMatchObject({cloudUploadApproved:false,publicRedistributionApproved:false,hostTransferReady:false});
  expect(result.review.files[2].providers).toEqual(['api-nba','balldontlie']);
 });
 it('does not approve derived artifacts from unknown parents or indirectly referenced withheld evidence',()=>{
  const f=fixture([{value:{provider:'api-basketball'}},{path:'model-development/artifacts/'+digest('model')+'.json',value:{coefficients:[1,2]}}]);
  const providerBody=JSON.stringify({provider:'balldontlie',parent:f.manifest.files[0].hash}),hash=digest(providerBody);
  f.objects.set(hash,providerBody);f.manifest.files.push({path:'evidence/'+hash+'.json',hash,bytes:Buffer.byteLength(providerBody)});
  const result=prepareSourceRetentionPlan(f.manifest,f.objects);
  expect(result.manifest.files).toHaveLength(0);expect(result.review.files[2].reason).toContain('withheld');
 });
 it('rejects object mutation, incorrect byte counts and duplicate/traversal paths before preparation',()=>{
  const f=fixture([{value:{provider:'balldontlie'}}]);
  expect(()=>prepareSourceRetentionPlan(f.manifest,new Map([[f.manifest.files[0].hash,'{}']]))).toThrow('integrity');
  expect(()=>prepareSourceRetentionPlan({...f.manifest,files:[{...f.manifest.files[0],bytes:1}]},f.objects)).toThrow('integrity');
  expect(()=>prepareSourceRetentionPlan({...f.manifest,files:[...f.manifest.files,...f.manifest.files]},f.objects)).toThrow('duplicate');
 });
});
