/** Read-only source state export. No API, DB, credential or service-control action. */
import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';
const root=path.resolve('.local/v6'),output=path.join(root,'cloud-transfer',new Date().toISOString().replaceAll(':','-'));
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {snapshotDirectory}=await loader.ssrLoadModule('/src/lib/v6/cloud/snapshot.server.ts');
 const {sourceRetentionInventory}=await loader.ssrLoadModule('/src/lib/v6/cloud/inventory.server.ts');
 const {digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const {ORIGINAL_PLAN,ORIGINAL_RECEIPT,ORIGINAL_CONFIG}=await loader.ssrLoadModule('/src/lib/v6/cloud/client.server.ts');
 const planBody=await fs.readFile(path.join(root,'source-pilot/proposal/plan.json'),'utf8'),plan=JSON.parse(planBody),planRaw=JSON.stringify(plan),receiptRaw=await fs.readFile(path.join(root,'source-pilot/approved-receipt.json'),'utf8');
 if(digest(planRaw)!==ORIGINAL_PLAN||digest(receiptRaw)!==ORIGINAL_RECEIPT||digest(await fs.readFile(path.join(root,'source-pilot/config.json'),'utf8'))!==ORIGINAL_CONFIG)throw new Error('Original approval/config drift');
 const scheduler=path.join(root,'controlled',digest(plan.ownerId),'scheduler.json');
 const readScheduler=async()=>{try{return await fs.readFile(scheduler,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;return null;}};
 const operation=await readScheduler();if(operation&&JSON.parse(operation).jobs.some(j=>j.status==='running'&&Date.parse(j.leaseUntil)>Date.now()))throw new Error('Source job in flight; wait for quiescence without stopping the approved pilot');
 const before={odds:await fs.readFile(path.join(root,'odds-shared-budget.json'),'utf8'),bdl:await fs.readFile(path.join(root,'balldontlie-team-budget.json'),'utf8')};
 const {manifest,objects}=await snapshotDirectory(root),manifestRaw=JSON.stringify(manifest),snapshotHash=digest(manifestRaw);
 const after={odds:await fs.readFile(path.join(root,'odds-shared-budget.json'),'utf8'),bdl:await fs.readFile(path.join(root,'balldontlie-team-budget.json'),'utf8')};
 if(operation!==await readScheduler()||JSON.stringify(before)!==JSON.stringify(after))throw new Error('Source counters changed during export; retry snapshot without touching the running service');
 await fs.mkdir(path.join(output,'objects'),{recursive:true,mode:0o700});
 for(const [hash,body]of objects)await fs.writeFile(path.join(output,'objects',hash+'.json'),body,{mode:0o600,flag:'wx'});
 await fs.writeFile(path.join(output,'manifest.json'),manifestRaw,{mode:0o600,flag:'wx'});
 const inventoryRaw=JSON.stringify(sourceRetentionInventory(manifest,objects),null,2),inventoryHash=digest(inventoryRaw);
 await fs.writeFile(path.join(output,'retention-inventory.json'),inventoryRaw,{mode:0o600,flag:'wx'});
 const bundle={inventoryHash,format:'edgelab.v6-source-cloud-staging',version:1,exportedAt:new Date().toISOString(),projectRef:'ilgoswfckkzpoktabbfi',pilotId:crypto.randomUUID(),planHash:ORIGINAL_PLAN,planRaw,receiptHash:ORIGINAL_RECEIPT,receiptRaw,snapshotHash,quotas:{odds:JSON.parse(before.odds),bdl:JSON.parse(before.bdl)},sourceRightsReviewRequired:true,cloudActivationApproved:false,localStopped:false};
 await fs.writeFile(path.join(output,'staging.json'),JSON.stringify(bundle,null,2),{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({status:'local_staging_only',output,objects:objects.size,files:manifest.files.length,bytes:[...objects.values()].reduce((n,b)=>n+Buffer.byteLength(b),0),snapshotHash,inventoryHash,oddsReserved:bundle.quotas.odds.reserved,providerUsed:bundle.quotas.odds.used,cloudWrites:0,localServiceChanged:false}));
}finally{await loader.close();}
