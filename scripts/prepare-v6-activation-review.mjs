/** Builds a DRAFT only from retained evidence. No approvals, registrations or network. */
import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';
const ix=process.argv.indexOf('--evaluation');if(ix<0)throw new Error('Pass --evaluation PATH to a retained prospective evaluation');
const root=path.resolve('.local/v6'),file=await fs.realpath(process.argv[ix+1]);if(!file.startsWith(root+path.sep))throw new Error('Use private retained evaluation only');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {atomicPrivateJson,digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts'),{ELO_ONLY_DEFINITION}=await loader.ssrLoadModule('/src/lib/v6/team-model.ts'),{CONTROLLED_POLICY,policyBundleHash}=await loader.ssrLoadModule('/src/lib/v6/controlled-activation.ts');
 const raw=await fs.readFile(file,'utf8'),evaluation=JSON.parse(raw);
 if(!['edgelab.v6-prospective-evaluation','edgelab.v6-reconciled-shadow-evaluation'].includes(evaluation.format))throw new Error('Unexpected evaluation format');
 const reports=await Promise.all((await fs.readdir(path.join(root,'team-reports'))).map(async f=>JSON.parse(await fs.readFile(path.join(root,'team-reports',f),'utf8'))));
 const benchmark=reports.filter(r=>r.format==='edgelab.v6-team-model-analysis').sort((a,b)=>b.at.localeCompare(a.at))[0];if(!benchmark)throw new Error('Chronological benchmark absent');
 const manifest={format:'edgelab.v6-model-manifest',version:1,ownerId:'OWNER-REVIEW-REQUIRED',modelId:'nba-team-elo-only',modelVersion:'candidate-1',method:'nba_team_elo_only',
  status:'draft',approvedAt:null,approvalReference:null,chronologicalGames:benchmark.evaluation.heldOutGames,verifiedProspectiveFixtures:evaluation.verifiedFixtures,
  definitionHash:digest(JSON.stringify(ELO_ONLY_DEFINITION)),evaluationHash:digest(raw),teamResultsOnlyAccepted:false,readinessReview:null,
  limitations:['No independently verified injury/roster coverage','Versioned reconciliation decisions are distinct from original strict journal','Challenger and baseline share the same rating family','Thirty fixtures alone do not establish reliability; calibration/benchmark/multiple-slate uncertainty review required']};
 const review={manifest,policyBundleHash:await policyBundleHash(),controlledPolicy:CONTROLLED_POLICY,chronological:{elo:benchmark.evaluation.eloOnly,challenger:benchmark.evaluation.challenger},
  prospectiveVerified:evaluation.metrics??evaluation.primaryVerifiedMetrics,provisional:evaluation.provisionalSourceAgreementMetrics??null,
  blockers:['Explicit owner model and standing activation approvals absent','More fixtures AND independent slates plus multidimensional readiness review required','Hosted scoped identity/repository undeployed','Observational outcomes cannot upgrade original excluded forecasts into positions'],sourceEvaluation:file,activatesNothing:true};
 const out=path.join(root,'activation-review','elo-only-candidate-1-draft-'+digest(JSON.stringify(review))+'.json');await atomicPrivateJson(out,review);console.log(JSON.stringify({draft:out,chronologicalGames:manifest.chronologicalGames,verifiedProspectiveFixtures:manifest.verifiedProspectiveFixtures,requiredVerifiedFixtures:CONTROLLED_POLICY.minimumVerifiedProspectiveFixtures,status:'draft',activated:false}));
}finally{await loader.close();}
