/** Actual scheduler and collector orchestration, intercepted synthetic provider responses only. */
import {it,expect,vi} from 'vitest';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {model2Fixture} from './fixtures/v6-prediction';
import {freeze,after} from './fixtures/v6-reconciliation';
import {digest,retainEvidence,type RawEvidence} from '@/lib/v6/evidence.server';
import {ingestTeamGames} from '@/lib/v6/team-dataset.server';
import {controlledConfigSchema,policyBundleHash} from '@/lib/v6/controlled-activation';
import {runControlledTick, type ScheduledJob} from '@/lib/v6/controlled-scheduler.server';
import {prepareControlledTeamPorts} from '@/lib/v6/controlled-team-runtime.server';
import {localV6Repository} from '@/lib/v6/repository.server';
import {evaluateModel2Slates} from '@/lib/v6/prediction/shadow.server';
const transport=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('@/lib/v6/free-sources.server',()=>({freeSources:(options:{root:string})=>({read:(provider:string,endpoint:string,params:Record<string,string>,cost:number)=>transport.read(options.root,provider,endpoint,params,cost)})}));
vi.mock('@/lib/v6/team-sources.server',()=>({teamSources:(options:{root:string})=>({read:(provider:string,endpoint:string,params:Record<string,string>)=>transport.read(options.root,provider,endpoint,params,0)})}));
it('runs existing scheduled discovery and results through source-only approvals; forecasts and grades observations with zero positions',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'v6-model-runtime-'));
 try{
  const {data,history}=await model2Fixture(root);let now=freeze;
  const evidence=(provider:RawEvidence['provider'],url:string,body:unknown):RawEvidence=>{const raw=JSON.stringify(body);return {id:crypto.randomUUID(),provider,sourceUrl:url,retrievedAt:now,sourceUpdatedAt:null,raw,hash:digest(raw)};};
  const historical=evidence('api-nba','https://v2.nba.api-sports.io/games?season=2026',{errors:[],response:history.map((g,i)=>({id:'SYNTHETIC-TRAIN-'+i,league:'standard',season:2026,stage:2,date:{start:g.startsAt},status:{short:3},teams:{home:{id:1,name:'LOCAL Home',code:'H'},visitors:{id:2,name:'LOCAL Away',code:'A'}},scores:{home:{points:g.homeScore},visitors:{points:g.awayScore}}}))});
  await ingestTeamGames(root,historical);
  const catalog=evidence('balldontlie','https://api.balldontlie.io/v1/teams',{data:Array.from({length:30},(_,i)=>({id:i+1,full_name:i===0?'LOCAL Home':i===1?'LOCAL Away':'LOCAL '+i,abbreviation:i===0?'H':i===1?'A':'T'+i,city:'LOCAL',name:i===0?'Home':i===1?'Away':String(i),conference:'East',division:'Atlantic'}))});await retainEvidence(root,catalog);
  const config=controlledConfigSchema.parse({version:1,ownerId:'synthetic-owner',mode:'dry_run',killSwitch:false,sourcesEnabled:true,modelManifest:null,activationReceipt:null,monthlyOddsCeiling:300});
  const receipt={format:'edgelab.v6-shadow-collection',version:1,ownerId:config.ownerId,approvedAt:freeze,expiresAt:'2026-11-15T00:00:00Z',approvalReference:'SYNTHETIC TEST CONTROL ONLY',policyBundleHash:await policyBundleHash(),scope:'zero_cost_read_only_shadow',sourceRightsConfirmed:true,monthlyOddsCeiling:300};
  transport.read.mockImplementation(async(directory:string,provider:RawEvidence['provider'],endpoint:string,params:Record<string,string>)=>{
   let result:RawEvidence;
   if(endpoint==='/v1/games'&&params.start_date){const body=JSON.parse(data.originalFixtures.raw);for(const g of body.data){g.home_team.abbreviation='H';g.visitor_team.abbreviation='A';}result=evidence(provider,'https://api.balldontlie.io/v1/games?'+new URLSearchParams(params),{...body,meta:{per_page:100,next_cursor:null}});}
   else if(endpoint==='/v1/games')result=evidence(provider,'https://api.balldontlie.io/v1/games?'+new URLSearchParams(params),{data:[],meta:{per_page:100,next_cursor:null}});
   else if(endpoint==='/v4/sports/basketball_nba/odds')result=data.originalOdds;
   else if(endpoint==='/v4/sports/basketball_nba/scores')result=data.scores;
   else if(endpoint==='/v1/games/7')result=data.secondary;
   else if(endpoint==='/v4/sports')result=evidence(provider,'https://api.the-odds-api.com/v4/sports',[]);
   else throw new Error('Unexpected synthetic provider endpoint');
   await retainEvidence(directory,result);return result;
  });
  const repository=localV6Repository(path.join(root,'test-owner-state'),config.ownerId),controls={config,manifest:null,receipt};
  const ports={repository,clock:()=>now,readControl:async()=>controls,prepare:async(job:ScheduledJob)=>prepareControlledTeamPorts(root,repository,job,controls,{},()=>now)};
  const job=(id:string,kind:ScheduledJob['kind']):ScheduledJob=>({id,kind,dueAt:now,deadline:new Date(Date.parse(now)+3600000).toISOString(),status:'pending',attempts:0,nextAt:now,leaseUntil:null,lastError:null,controlHash:null});
  expect((await runControlledTick(path.join(root,'scheduler'),ports,[job('TEST-DISCOVERY','discovery')])).status).toBe('completed');
  const calls=transport.read.mock.calls;expect(calls.some(c=>c[2]==='/v1/games'&&c[3].start_date===freeze.slice(0,10))).toBe(true);
  expect((await repository.read()).positions).toEqual([]);const files=await fs.readdir(path.join(root,'model-development/slates'));expect(files).toHaveLength(1);
  now=after;expect((await runControlledTick(path.join(root,'scheduler'),ports,[job('TEST-RESULTS','results')])).status).toBe('completed');
  const report=await evaluateModel2Slates(root,config.ownerId);expect(report.fixtures).toBe(1);expect(report.models).toHaveLength(9);expect((await repository.read()).positions).toEqual([]);expect((await repository.read()).grades).toEqual([]);
  const before=transport.read.mock.calls.length;config.mode='disabled';expect((await runControlledTick(path.join(root,'scheduler'),ports,[job('TEST-OFF','discovery')])).status).toBe('disabled');expect(transport.read.mock.calls.length).toBe(before);
 }finally{await fs.rm(root,{recursive:true,force:true});}
},30000);
