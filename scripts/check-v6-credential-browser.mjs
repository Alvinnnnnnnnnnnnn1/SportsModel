/** Disposable browser, fake identity/capability, intercepted RPCs only. No hosted writes. */
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';import path from 'node:path';import {createServer} from 'vite';
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];},runtime=option('--runtime');if(!runtime)throw new Error('Pass --runtime optional Playwright installation');
const app=new URL(option('--url')??'http://localhost:3000');if(app.protocol!=='http:'||!['localhost','127.0.0.1'].includes(app.hostname))throw new Error('Loopback only');
const publicUrl=(await readFile('.env.local','utf8')).match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];if(!publicUrl)throw new Error('Public project configuration required');const supabase=new URL(publicUrl);
const owner='98000000-0000-4000-8000-000000000001',user={id:owner,email:'synthetic-v6-owner@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z',email_confirmed_at:'2026-01-01T00:00:00Z'},encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),exp=Math.floor(Date.now()/1000)+3600;
const session={access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:owner,role:'authenticated',exp})+'.SYNTHETIC',refresh_token:'SYNTHETIC',token_type:'bearer',expires_in:3600,expires_at:exp,user};
const loader=await createServer({configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':process.cwd()+'/src'}},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});let actual,history;
try{actual=(await loader.ssrLoadModule('/src/lib/domain/fixtures.ts')).createEmptyData();history=(await loader.ssrLoadModule('/src/lib/imports/types.ts')).emptyHistoricalWorkspace();}finally{await loader.close();}
const {chromium}=createRequire(path.resolve(runtime,'package.json'))('playwright'),browser=await chromium.launch({headless:true,executablePath:option('--browser')??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext();
await context.addInitScript(({key,session})=>{localStorage.setItem('edgelab:workspace','supabase');localStorage.setItem(key,JSON.stringify(session));},{key:`sb-${supabase.hostname.split('.')[0]}-auth-token`,session});
let issued=0,revoked=0,unexpected=0;const rows=[],fakeSecret='edgelab_v6_'+'f'.repeat(64),id='98000000-0000-4000-8000-000000000002';
await context.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());if(u.origin===app.origin){if(u.pathname==='/api/sports')return route.fulfill({status:503,body:'Provider disabled'});return route.continue();}
 if(u.origin!==supabase.origin){unexpected++;return route.abort();}
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':app.origin,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},...(status===204?{}:{body:JSON.stringify(data)})});
 if(r.method()==='OPTIONS')return send(null,204);if(u.pathname==='/auth/v1/user')return send(user);const b=r.postDataJSON();
 if(u.pathname.endsWith('/edgelab_load_workspace'))return send({revision:0,workspace:actual});if(u.pathname.endsWith('/edgelab_load_history'))return send(history);
 if(u.pathname.endsWith('/v6_list_worker_credentials')){assert.equal(b.expected_owner,owner);return send(rows);}
 if(u.pathname.endsWith('/v6_issue_worker_credential')){assert.equal(b.expected_owner,owner);assert.equal(b.capability_scope,'research_only');issued++;const expiresAt=new Date(Date.now()+30*86400000).toISOString();rows.push({credentialId:id,scope:'research_only',createdAt:new Date().toISOString(),expiresAt,revokedAt:null});return send({credentialId:id,ownerId:owner,credential:fakeSecret,scope:'research_only',expiresAt});}
 if(u.pathname.endsWith('/v6_revoke_worker_credential')){assert.equal(b.expected_owner,owner);assert.equal(b.credential_id,id);revoked++;rows[0].revokedAt=new Date().toISOString();return send(true);}
 unexpected++;return send({message:'Unexpected write blocked'},403);
});
const page=await context.newPage();page.setDefaultTimeout(25000);
try{
 await page.goto(new URL('/settings',app).href);await page.getByText('V6 restricted worker access · advanced setup',{exact:true}).click();
 const create=page.getByRole('button',{name:'Create and download restricted credential',exact:true});assert.equal(await create.isDisabled(),true);assert.equal(issued,0);await page.getByRole('button',{name:'Check worker credentials',exact:true}).click();assert.equal(issued,0);
 console.log('PASS advanced credential setup stays idle until explicit owner action');
 await page.getByRole('checkbox',{name:/I approve creating this restricted credential/}).check();const download=page.waitForEvent('download');await create.click();const file=await download;assert.equal(file.suggestedFilename(),'edgelab-v6-worker-credential.json');const content=JSON.parse(await readFile(await file.path(),'utf8'));assert.equal(content.ownerId,owner);assert.equal(content.scope,'research_only');assert.equal((await page.locator('body').innerText()).includes(fakeSecret),false);assert.equal(issued,1);
 await page.getByRole('button',{name:'Revoke '+id.slice(0,8),exact:true}).click();await page.getByRole('status').filter({hasText:'Worker credential revoked.'}).waitFor();assert.equal(revoked,1);console.log('PASS one-time fake download stays outside page text; revoke uses only owner-scoped RPC');
 await page.reload();await page.getByText('V6 restricted worker access · advanced setup',{exact:true}).click();await page.getByRole('button',{name:'Check worker credentials',exact:true}).click();await page.getByText(/research_only.*revoked/).waitFor();assert.equal(await page.getByRole('button',{name:'Revoke '+id.slice(0,8),exact:true}).count(),0);assert.equal(issued,1);assert.equal(unexpected,0);
 console.log('PASS metadata survives reload with no financial, provider or hosted request');
 const demoContext=await browser.newContext();await demoContext.route('**/*',route=>new URL(route.request().url()).origin===app.origin?route.continue():route.abort());const demo=await demoContext.newPage();await demo.goto(new URL('/settings',app).href);assert.equal(await demo.getByText('V6 restricted worker access · advanced setup',{exact:true}).count(),0);await demoContext.close();
 console.log('PASS demo mode exposes no private credential controls');
}finally{await browser.close();}
