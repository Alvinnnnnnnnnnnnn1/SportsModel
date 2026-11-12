/** Offline aggregation only. Does not discover fixtures, access keys or grade positions. */
import path from 'node:path';import {createServer} from 'vite';
const i=process.argv.indexOf('--owner');if(i<0||!process.argv[i+1])throw new Error('Pass the existing worker --owner ID');const owner=process.argv[i+1];
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{const {evaluateModel2Slates}=await loader.ssrLoadModule('/src/lib/v6/prediction/shadow.server.ts');console.log(JSON.stringify(await evaluateModel2Slates(path.resolve('.local/v6'),owner),null,2));}finally{await loader.close();}
