/** Offline checks only. Secret values are compared in memory and never printed. */
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const sha=s=>createHash('sha256').update(s).digest('hex');
process.loadEnvFile('.env.local');const privateKeys=['API_SPORTS_KEY','THE_ODDS_API_KEY','BALLDONTLIE_API_KEY','V6_SOURCE_CAPABILITY'].filter(k=>process.env[k]?.length>=8);
async function walk(root){const out=[];for(const item of await fs.readdir(root,{withFileTypes:true})){const file=path.join(root,item.name);if(item.isDirectory())out.push(...await walk(file));else if(item.isFile())out.push(file);}return out;}
const staticFiles=await walk('.next/static');for(const file of staticFiles){const body=await fs.readFile(file);for(const key of privateKeys)assert.equal(body.includes(Buffer.from(process.env[key])),false,`Private variable ${key} appeared in a browser bundle`);}
console.log('PASS browser bundles contain none of the configured private source/capability values');
const traces=(await walk('.next/server')).filter(f=>f.endsWith('.nft.json'));for(const file of traces){const trace=JSON.parse(await fs.readFile(file,'utf8'));assert.ok(trace.files.every(f=>!/(?:^|\/)\.local\/|(?:^|\/)\.env(?:\.|$)/.test(f)),'Private file in production trace');}
console.log('PASS production output traces exclude .local and environment files');
assert.equal(sha(await fs.readFile('supabase/proposals/202611110001_v6_paper.sql')),'c3a0d368ddbda1b50f3dab13aeec7cb3a939e423bce894aa1d55cfe9f13a3dff');
assert.equal(sha(await fs.readFile('.local/v6/source-pilot/config.json')),'2badec1068928b44c272c7641724d6e0d7d8dc675e1f03bdb85b9c0f169f7177');
assert.equal(sha(await fs.readFile('.local/v6/source-pilot/approved-receipt.json')),'c5f236058560271ff86fe4c3f7c042d8a93ced970e171835adfb64c6ded55a16');
assert.equal(sha(await fs.readFile('.local/v6/team-games/dataset.json')),'31aa630215a5583b90f87f92e6193883a778f6795a9068f2014118685c9283a0');
console.log('PASS original PAPER SQL, active local source config/receipt and protected 5,082-game dataset hashes are unchanged');
const disabled=JSON.parse(execFileSync(process.execPath,['scripts/run-v6-cloud-source.mjs'],{encoding:'utf8',env:{...process.env,V6_CLOUD_SOURCE_ENABLED:'false'}}));assert.equal(disabled.status,'cloud_disabled');assert.equal(disabled.providerRequests,0);assert.equal(disabled.paperRegistrations,0);
console.log('PASS cloud CLI remains disabled with zero provider operations');
const ix=process.argv.indexOf('--bundle');if(ix>=0){const bundle=process.argv[ix+1],manifest=JSON.parse(await fs.readFile(path.join(bundle,'manifest.json'),'utf8'));for(const f of manifest.files){const body=await fs.readFile(path.join(bundle,'objects',f.hash+'.json'));assert.equal(sha(body),f.hash);for(const key of privateKeys)assert.equal(body.includes(Buffer.from(process.env[key])),false,`Private variable ${key} appeared in staged source evidence`);}console.log('PASS staged objects preserve their hashes and contain no configured source/capability secrets');}
