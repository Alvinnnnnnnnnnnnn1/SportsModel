/** Offline-only genuine forecast/result evaluation. No provider or account access. */
import path from 'node:path';
import { createServer } from 'vite';
const i=process.argv.indexOf('--shadow-id');if(i<0)throw new Error('Pass --shadow-id UUID');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':`${process.cwd()}/src`}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{const {evaluateFrozenShadow}=await loader.ssrLoadModule('/src/lib/v6/shadow-evaluation.server.ts');const {file,report}=await evaluateFrozenShadow(path.resolve('.local/v6'),process.argv[i+1],new Date().toISOString());
 console.log(JSON.stringify({report:file,fixtures:report.fixtures,verified:report.verifiedSelections,unresolved:report.unresolvedSelections,sourceAgreedFixtures:report.sourceAgreedFixtures,primaryMetrics:report.primaryVerifiedMetrics,provisionalMetrics:report.provisionalSourceAgreementMetrics,positions:0,settlements:0}));
}finally{await loader.close();}
