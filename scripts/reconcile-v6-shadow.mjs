/** Offline reconciliation of retained genuine sources. No HTTP, positions or approvals. */
import path from 'node:path';import {createServer} from 'vite';
const ix=process.argv.indexOf('--shadow-id');if(ix<0||!process.argv[ix+1])throw new Error('Pass --shadow-id UUID');
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{const {reconcileFrozenShadow}=await loader.ssrLoadModule('/src/lib/v6/reconcile-shadow.server.ts');
 const {file,report}=await reconcileFrozenShadow(path.resolve('.local/v6'),process.argv[ix+1],new Date().toISOString());
 console.log(JSON.stringify({file,originalStrictVerified:report.originalStrictVerified,newlyVerified:report.newlyVerified,verifiedFixtures:report.verifiedFixtures,unresolvedFixtures:report.unresolvedFixtures,metrics:report.metrics,positions:0,settlements:0,networkRequests:0},null,2));
}finally{await loader.close();}
