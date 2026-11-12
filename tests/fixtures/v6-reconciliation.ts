/** Entirely invented source responses for isolated local tests. */
import { digest,type RawEvidence } from '@/lib/v6/evidence.server';
import type { ReconciliationInput } from '@/lib/v6/team-reconciliation';
export const freeze='2026-11-12T22:00:00.000Z',start='2026-11-13T00:00:00.000Z',after='2026-11-13T04:00:00.000Z';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally malformed provider payloads in tests only
export const changed=(e:RawEvidence,change:(body:any)=>void)=>{const body=JSON.parse(e.raw);change(body);const raw=JSON.stringify(body);return {...e,raw,hash:digest(raw)};};
export function reconciliationFixture():ReconciliationInput {
 const evidence=(provider:RawEvidence['provider'],url:string,at:string,body:unknown):RawEvidence=>{const raw=JSON.stringify(body);return {id:crypto.randomUUID(),provider,sourceUrl:url,retrievedAt:at,sourceUpdatedAt:null,raw,hash:digest(raw)};};
 const registryData={version:1,recordedAt:'2026-11-12T21:00:00.000Z',catalogueHash:'a'.repeat(64),catalogueReceiptId:crypto.randomUUID(),sourceHashes:[],blocked:[],mappings:{
  'balldontlie:1':{canonicalId:'NBA:LOCAL-H',name:'LOCAL Home',code:'H',aliases:['LOCAL Home']},'balldontlie:2':{canonicalId:'NBA:LOCAL-A',name:'LOCAL Away',code:'A',aliases:['LOCAL Away']}}};
 const registry={...registryData,hash:digest(JSON.stringify(registryData))};
 const b={id:7,season:2026,datetime:start,status:'Scheduled',status_state:'scheduled',postponed:false,postseason:false,home_team:{id:1,full_name:'LOCAL Home'},visitor_team:{id:2,full_name:'LOCAL Away'},home_team_score:0,visitor_team_score:0};
 const q={id:'LOCAL',sport_key:'basketball_nba',commence_time:start,home_team:'LOCAL Home',away_team:'LOCAL Away',bookmakers:[{key:'sportsbet',markets:[{key:'h2h',last_update:freeze,outcomes:[{name:'LOCAL Home',price:1.8},{name:'LOCAL Away',price:2.5}]}]}]};
 return {proof:{eventId:'LOCAL',homeName:'LOCAL Home',awayName:'LOCAL Away',statsHomeName:'LOCAL Home',statsAwayName:'LOCAL Away',homeId:'NBA:LOCAL-H',awayId:'NBA:LOCAL-A',startsAt:start,statsStartsAt:start,earliestStartsAt:start,statsGameId:'7',clockDifferenceSeconds:0,registryHash:registry.hash,termsVersion:'sportsbet-nba-fullgame-moneyline-ot-v1'},registry,
 originalOdds:evidence('the-odds-api.com','https://api.the-odds-api.com/v4/sports/basketball_nba/odds?bookmakers=sportsbet&markets=h2h',freeze,[q]),
 originalFixtures:evidence('balldontlie','https://api.balldontlie.io/v1/games?seasons[]=2026',freeze,{data:[b]}),
 scores:evidence('the-odds-api.com','https://api.the-odds-api.com/v4/sports/basketball_nba/scores?eventIds=LOCAL',after,[{...q,commence_time:'2026-11-13T00:03:00.000Z',completed:true,last_update:after,scores:[{name:'LOCAL Home',score:'120'},{name:'LOCAL Away',score:'110'}]}]),
 secondary:evidence('balldontlie','https://api.balldontlie.io/v1/games/7',after,{data:{...b,status:'Final',status_state:'final',home_team_score:120,visitor_team_score:110}}),frozenAt:freeze,at:after,
 quote:{selectionName:'LOCAL Home',odds:1.8,sourceUpdatedAt:freeze,retrievedAt:freeze,forecastAt:freeze}};
}
