import path from 'node:path';
import {digest} from '../evidence.server';
import {validateSnapshot,type SourceSnapshot} from './snapshot.server';

/** Offline, conservative intake plan. This neither grants rights nor authorises
 * upload. Unknown/mixed providers and unresolved parent provenance stay local. */
export function prepareSourceRetentionPlan(raw:SourceSnapshot,objects:Map<string,string>){
 const manifest=validateSnapshot(raw);
 const nodes=manifest.files.map(file=>{
  const body=objects.get(file.hash);
  if(!body||digest(body)!==file.hash||Buffer.byteLength(body)!==file.bytes)throw new Error('Retention object integrity mismatch');
  const value:unknown=JSON.parse(body),providers=new Set<string>(),references=new Set<string>();
  const walk=(item:unknown)=>{
   if(typeof item==='string'){references.add(item);return;}
   if(!item||typeof item!=='object')return;
   for(const [key,child]of Object.entries(item)){
    if(key==='provider'&&typeof child==='string')providers.add(child);
    walk(child);
   }
  };walk(value);
  const internal=/^(odds-shared-budget|balldontlie-team-budget|model-development\/protocols\/[a-f0-9]{64})\.json$/.test(file.path);
  const unsupported=[...providers].filter(p=>!['the-odds-api.com','balldontlie'].includes(p));
  return {file,providers:[...providers].sort(),references,allowed:unsupported.length===0&&(providers.size>0||internal),reason:unsupported.length?'Provider retention not established for this cloud transfer: '+unsupported.join(', '):providers.size||internal?'Private source/operational retention reviewed; owner upload approval still required':'Parent-source retention requires review'};
 });
 const identities=new Map<string,Set<number>>();
 for(let i=0;i<nodes.length;i++)for(const identity of [nodes[i].file.hash,path.basename(nodes[i].file.path,'.json')]){
  const members=identities.get(identity)??new Set<number>();members.add(i);identities.set(identity,members);
 }
 // A permitted receipt does not clear an excluded model/dataset it embeds or
 // references. Propagate exclusions without altering any original source bytes.
 let changed=true;
 while(changed){changed=false;for(let i=0;i<nodes.length;i++){
  const node=nodes[i];if(!node.allowed)continue;
  const blocked=[...node.references].some(r=>[...(identities.get(r)??[])].some(parent=>parent!==i&&!nodes[parent].allowed));
  if(blocked){node.allowed=false;node.reason='References evidence withheld from cloud transfer';changed=true;}
 }}
 const filtered=validateSnapshot({...manifest,files:nodes.filter(n=>n.allowed).map(n=>n.file)});
 return {
  manifest:filtered,
  review:{format:'edgelab.v6-source-retention-review',version:1,
   originalSnapshotHash:digest(JSON.stringify(manifest)),snapshotHash:digest(JSON.stringify(filtered)),
   termsReviewedOn:'2026-11-13',
   termsReferences:['https://the-odds-api.com/terms-and-conditions.html','https://www.balldontlie.io/terms.html','https://api-sports.io/terms'],
   cloudUploadApproved:false,publicRedistributionApproved:false,hostTransferReady:false,
   files:nodes.map(n=>({...n.file,providers:n.providers,decision:n.allowed?'include_in_preview':'withhold_locally',reason:n.reason})),
  },
 };
}
