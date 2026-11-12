/** Offline preparation ONLY. No env, HTTP, database, credentials or service control. */
import fs from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';
const i=process.argv.indexOf('--bundle');if(i<0)throw new Error('Supply existing private --bundle');
const root=await fs.realpath('.local/v6'),base=await fs.realpath(process.argv[i+1]);
if(!base.startsWith(root+path.sep))throw new Error('Private staging directory required');
const output=path.join(root,'cloud-transfer','retention-'+new Date().toISOString().replaceAll(':','-'));
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const {digest}=await loader.ssrLoadModule('/src/lib/v6/evidence.server.ts');
 const {sourceRetentionInventory}=await loader.ssrLoadModule('/src/lib/v6/cloud/inventory.server.ts');
 const {prepareSourceRetentionPlan}=await loader.ssrLoadModule('/src/lib/v6/cloud/retention-plan.server.ts');
 const staging=JSON.parse(await fs.readFile(path.join(base,'staging.json'),'utf8'));
 const raw=await fs.readFile(path.join(base,'manifest.json'),'utf8'),inventoryRaw=await fs.readFile(path.join(base,'retention-inventory.json'),'utf8');
 if(digest(raw)!==staging.snapshotHash||digest(inventoryRaw)!==staging.inventoryHash)throw new Error('Original snapshot/inventory changed');
 const manifest=JSON.parse(raw),objects=new Map();
 const oldInventory=JSON.parse(inventoryRaw);
 if(oldInventory.files.length!==manifest.files.length||oldInventory.files.some((f,i)=>f.path!==manifest.files[i].path||f.hash!==manifest.files[i].hash||f.bytes!==manifest.files[i].bytes))throw new Error('Original inventory does not match source manifest');
 for(const f of manifest.files){const file=await fs.realpath(path.join(base,'objects',f.hash+'.json'));if(!file.startsWith(base+path.sep))throw new Error('Outside private bundle');objects.set(f.hash,await fs.readFile(file,'utf8'));}
 const plan=prepareSourceRetentionPlan(manifest,objects),newRaw=JSON.stringify(plan.manifest),snapshotHash=digest(newRaw);
 const newInventoryRaw=JSON.stringify(sourceRetentionInventory(plan.manifest,objects),null,2),inventoryHash=digest(newInventoryRaw);
 const reviewRaw=JSON.stringify(plan.review,null,2),retentionReviewHash=digest(reviewRaw);
 await fs.mkdir(path.join(output,'objects'),{recursive:true,mode:0o700});
 const included=new Set();for(const f of plan.manifest.files){if(included.has(f.hash))continue;included.add(f.hash);await fs.writeFile(path.join(output,'objects',f.hash+'.json'),objects.get(f.hash),{mode:0o600,flag:'wx'});}
 for(const [name,body]of [['manifest.json',newRaw],['retention-inventory.json',newInventoryRaw],['retention-review.json',reviewRaw],['staging.json',JSON.stringify({...staging,exportedAt:new Date().toISOString(),snapshotHash,inventoryHash,retentionReviewHash,cloudActivationApproved:false,sourceRightsReviewRequired:true,localStopped:false},null,2)]])await fs.writeFile(path.join(output,name),body,{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({status:'filtered_local_preview_only',output,snapshotHash,inventoryHash,retentionReviewHash,included:plan.manifest.files.length,withheld:manifest.files.length-plan.manifest.files.length,uniqueObjects:included.size,objectBytes:[...included].reduce((n,h)=>n+Buffer.byteLength(objects.get(h)),0),hostedWrites:0,hostTransferReady:false}));
}finally{await loader.close();}
