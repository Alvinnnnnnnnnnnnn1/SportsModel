import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {digest} from '../evidence.server';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const snapshotSchema=z.object({format:z.literal('edgelab.v6-source-snapshot'),version:z.literal(1),files:z.array(z.object({path:z.string(),hash,bytes:z.number().int().min(1).max(16*1024*1024)}).strict()).max(2000)}).strict();
export type SourceSnapshot=z.infer<typeof snapshotSchema>;
// Credentials, activation files, logs, V5 workspaces and arbitrary files never enter a snapshot.
export function sourceFileAllowed(name:string):boolean {
 if(name.includes('..')||name.includes('\\')||name.startsWith('/')||!name.endsWith('.json'))return false;
 return /^(?:evidence\/[a-f0-9]{64}|evidence-receipts\/[a-f0-9-]{36}|source-quota-receipts\/[a-f0-9-]{36}|team-games\/dataset|team-games\/snapshots\/[a-f0-9]{64}|team-registry\/[a-f0-9]{64}|team-reports\/[a-f0-9]{64}|team-shadow\/[a-f0-9-]{36}|team-shadow-reconciliations\/[a-f0-9-]{36}\/(?:decisions|evaluations)\/[a-f0-9]{64}|observations\/[a-f0-9-]{36}|model-development\/(?:artifacts|reports|protocols|histories)\/[a-f0-9]{64}|model-development\/slates\/[a-f0-9-]{36}|model-development\/results\/[a-f0-9-]{36}\/[a-f0-9]{64}|model-development\/shadow-config|controlled\/discovered-fixtures|controlled\/features|controlled\/histories\/[a-f0-9]{64}|controlled\/(?:screens|proofs)\/[a-f0-9-]{36}|controlled\/[a-f0-9]{64}\/(?:scheduler|health)|controlled\/[a-f0-9]{64}\/source-only-state\/[a-f0-9]{64}|controlled\/[a-f0-9]{64}\/alerts\/[a-f0-9]{64}|odds-shared-budget|balldontlie-team-budget)\.json$/.test(name);
}
export function validateSnapshot(raw:unknown):SourceSnapshot {
 const snapshot=snapshotSchema.parse(raw),names=new Set<string>();let size=0;
 for(const file of snapshot.files){if(!sourceFileAllowed(file.path)||names.has(file.path))throw new Error('Invalid snapshot path or duplicate');names.add(file.path);size+=file.bytes;}
 if(size>96*1024*1024)throw new Error('Snapshot exceeds free storage guard');return snapshot;
}
export async function snapshotDirectory(root:string):Promise<{manifest:SourceSnapshot;objects:Map<string,string>}> {
 const base=await fs.realpath(root),files:SourceSnapshot['files']=[],objects=new Map<string,string>();
 async function walk(dir:string){for(const item of await fs.readdir(dir,{withFileTypes:true})){
  const absolute=path.join(dir,item.name),relative=path.relative(base,absolute).split(path.sep).join('/');
  if(item.isSymbolicLink()){if(sourceFileAllowed(relative))throw new Error('Source snapshot rejects symlinks');continue;}
  if(item.isDirectory()){await walk(absolute);continue;}if(!item.isFile()||!sourceFileAllowed(relative))continue;
  if((await fs.stat(absolute)).size>16*1024*1024)throw new Error('Source object exceeds limit');
  const body=await fs.readFile(absolute,'utf8');JSON.parse(body);const hash=digest(body);files.push({path:relative,hash,bytes:Buffer.byteLength(body)});objects.set(hash,body);
 }}await walk(base);files.sort((a,b)=>a.path.localeCompare(b.path));return {manifest:validateSnapshot({format:'edgelab.v6-source-snapshot',version:1,files}),objects};
}
export async function restoreSnapshot(root:string,raw:unknown,get:(hash:string)=>Promise<string>){
 const manifest=validateSnapshot(raw);await fs.mkdir(root,{recursive:true,mode:0o700});
 for(const file of manifest.files){const body=await get(file.hash);if(digest(body)!==file.hash||Buffer.byteLength(body)!==file.bytes)throw new Error('Source object content hash mismatch');JSON.parse(body);
  const target=path.join(root,file.path);await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fs.writeFile(target,body,{mode:0o600,flag:'wx'});
 }return manifest;
}
