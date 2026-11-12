import {digest} from '../evidence.server';
import {validateSnapshot,type SourceSnapshot} from './snapshot.server';
const references:Record<string,string>={
 'the-odds-api.com':'https://the-odds-api.com/terms-and-conditions.html',
 balldontlie:'https://www.balldontlie.io/terms.html',
 'api-nba':'https://api-sports.io/terms',
 'api-basketball':'https://api-sports.io/terms',
};
/** A classification for owner review, never a grant of retention/redistribution rights.
 * Includes no raw bodies, source URLs, account fields or credential values. */
export function sourceRetentionInventory(raw:SourceSnapshot,objects:Map<string,string>){
 const manifest=validateSnapshot(raw),files=manifest.files.map(file=>{
  const body=objects.get(file.hash);if(!body||digest(body)!==file.hash)throw new Error('Inventory object integrity');
  const value=JSON.parse(body),providers=new Set<string>();
  for(const p of [value.provider,value.record?.source?.provider])if(typeof p==='string'&&p in references)providers.add(p);
  if(file.path==='team-games/dataset.json')for(const history of Object.values(value.rows??{}) as {record?:{provider?:string}}[][])for(const item of history){const p=item.record?.provider;if(p&&p in references)providers.add(p);}
  const kind=/^(evidence|evidence-receipts)\//.test(file.path)?'provider_receipt':/^team-games\//.test(file.path)?'training_history':/^model-development\/(artifacts|reports|protocols)\//.test(file.path)||/^team-reports\//.test(file.path)?'model_development':/^(team-shadow|observations|model-development\/(slates|results))/.test(file.path)?'observational_research':'operational_or_derived';
  return {...file,kind,providers:[...providers].sort(),termsReferences:[...providers].sort().map(p=>references[p]),retentionReviewRequired:true,classification:providers.size?'Private research retention; verify existing source terms before cloud transfer':'Derived/operational or indirect provenance; review parent sources',apiNbaRestriction:providers.has('api-nba')?'Existing historical/denial evidence only; no new current-season access authorised':null};
 });
 return {format:'edgelab.v6-source-retention-inventory',version:1,snapshotHash:digest(JSON.stringify(manifest)),reviewState:'requires_owner_review',publicRedistributionApproved:false,cloudTransferApproved:false,files};
}
