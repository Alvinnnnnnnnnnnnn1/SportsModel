/** ACTUAL hosted read-only acceptance. User signs in directly in a visible browser.
 * No passwords/session tokens/cookies/source bodies are logged or saved. No writes,
 * browser traces, screenshots, bypass secrets, account creation or provider calls. */
import {createRequire} from 'node:module';import fs from 'node:fs/promises';import path from 'node:path';import {parseEnv} from 'node:util';import assert from 'node:assert/strict';
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];},url=new URL(option('--url')??''),runtime=option('--runtime'),reportFile=path.resolve(option('--report')??'.local/v6/preview-acceptance-20261113/hosted-browser.json');
if(url.protocol!=='https:'||!/^sports-model-[a-z0-9]+-alvinnnnnnnnnnnnn1s-projects\.vercel\.app$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash)throw new Error('Exact existing-project Preview URL required');
const env=parseEnv(await fs.readFile('.env.local','utf8')),publicUrl=env.NEXT_PUBLIC_SUPABASE_URL,publicKey=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(publicUrl!=='https://ilgoswfckkzpoktabbfi.supabase.co'||!publicKey?.startsWith('sb_publishable_'))throw new Error('Public expected-project configuration required');
const expectedSha='2cd0d2805f1e2d5faeed91f33ca92587966b8812',authKey='sb-ilgoswfckkzpoktabbfi-auth-token',report={format:'edgelab.v6-hosted-preview-acceptance',at:new Date().toISOString(),origin:url.origin,expectedSha,transport:'actual_hosted_browser',writesPerformed:false,tests:[],owner:null,crossOwner:{verified:false,reason:process.argv.includes('--owner-only')?'Not requested in this run':'Waiting for existing second account'},complete:false};
// CLI deployments need not supply VERCEL_GIT_COMMIT_SHA. An optional *sanitized*
// management receipt provides a separate deployment-identity check in that case.
let deployment=null;
if(option('--deployment-receipt')){
 const receipt=JSON.parse(await fs.readFile(option('--deployment-receipt'),'utf8'));
 assert.equal(receipt.project?.id,'prj_EzTK6B2NMuhSCQdg0IqksRBSNWMY');
 assert.equal(receipt.preview?.url,url.hostname);assert.equal(receipt.preview?.sha,expectedSha);
 assert.equal(receipt.preview?.readyState,'READY');assert.equal(receipt.preview?.target,null);
 deployment={id:receipt.preview.id,sha:receipt.preview.sha,evidence:'Separately captured Vercel management receipt'};
}
const save=async()=>{await fs.mkdir(path.dirname(reportFile),{recursive:true,mode:0o700});await fs.writeFile(reportFile,JSON.stringify(report,null,2),{mode:0o600});};
const record=(name,passed,detail)=>{report.tests.push({name,passed,detail});console.log(`${passed?'PASS':'FAIL'} ${name}`);};
const {chromium}=createRequire(path.resolve(runtime,'package.json'))('playwright'),browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});let runtimeErrors=0;
async function waitForSession(page,label){page.on('pageerror',()=>runtimeErrors++);await page.goto(new URL('/settings',url).href);console.log(`WAIT ${label}: sign into Vercel if needed, then Settings using the existing ${label==='OWNER'?'personal owner':'dedicated second test'} Supabase account. Do not save or import anything.`);
 await page.waitForFunction(({origin,key})=>{if(location.origin!==origin)return false;try{return !!JSON.parse(localStorage.getItem(key)??'null')?.access_token&&localStorage.getItem('edgelab:workspace')==='supabase';}catch{return false;}},{origin:url.origin,key:authKey},{timeout:600000});
 await page.getByText('Loading workspace…',{exact:true}).waitFor({state:'hidden',timeout:30000}).catch(()=>{});
}
async function privateProbe(page){return page.evaluate(async({key})=>{const session=JSON.parse(localStorage.getItem(key)??'null');const r=await fetch('/api/v6/dashboard',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});const value=await r.json();const payload=JSON.parse(atob(session.access_token.split('.')[1].replaceAll('-','+').replaceAll('_','/')));return {status:r.status,error:value.error,sha:r.headers.get('x-edgelab-revision'),mode:r.headers.get('x-edgelab-evidence-mode'),subject:payload.sub};},{key:authKey});}
async function fingerprint(page){return page.evaluate(async({key,publicUrl,publicKey})=>{const session=JSON.parse(localStorage.getItem(key)),sub=JSON.parse(atob(session.access_token.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).sub;const headers={apikey:publicKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
 const load=async(name,body)=>{const response=await fetch(publicUrl+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(body)});if(!response.ok)throw new Error('Read-only workspace check failed');return response.json();};const core=await load('edgelab_load_workspace',{}),history=await load('edgelab_load_history',{expected_owner_id:sub});const bytes=new TextEncoder().encode(JSON.stringify({core,history})),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');return {hash,coreRevision:core.revision,historyRevision:history.revision,bets:core.workspace?.bets?.length??0,funding:core.workspace?.transactions?.length??0};},{key:authKey,publicUrl,publicKey});}
try{
 const context=await browser.newContext({viewport:{width:1400,height:1000},timezoneId:'Australia/Melbourne'}),page=await context.newPage();await waitForSession(page,'OWNER');
 const owner=await privateProbe(page);report.owner={status:owner.status,sha:owner.sha,mode:owner.mode,expectedUnconnected:owner.error==='Cloud research evidence not yet connected'};
 record('existing owner passes hosted Auth and owner gate',owner.status===503&&report.owner.expectedUnconnected,'Storage unprovisioned; no source data returned');
 record('cloud evidence mode',owner.mode==='cloud','Response header');
 record('exact deployed revision',owner.sha===expectedSha||(owner.sha===null&&deployment!==null),owner.sha===null?deployment??'Optional revision header absent; management receipt required':'Response revision header');
 const baseline=await fingerprint(page);report.baseline={coreRevision:baseline.coreRevision,historyRevision:baseline.historyRevision,bets:baseline.bets,funding:baseline.funding};
 const probe=async(name,pathname,options,expected)=>{const r=await context.request.fetch(new URL(pathname,url).href,{method:'GET',...options});const body=await r.text();let json=null;try{json=JSON.parse(body);}catch{/* Platform protection differs from application response. */}const noCorsWildcard=r.headers()['access-control-allow-origin']!=='*';record(name,r.status()===expected&&json!==null&&noCorsWildcard,{status:r.status(),applicationJson:json!==null,noCorsWildcard});if(json)assert.ok(!/sb_secret_|service_role|access_token|refresh_token|\.local\//i.test(body),'Sensitive error response');return r;};
 await probe('anonymous application access rejected','/api/v6/dashboard',{},401);
 await probe('invalid session rejected','/api/v6/dashboard',{headers:{Authorization:'Bearer invalid-session'}},401);
 await probe('cross-origin request rejected','/api/v6/dashboard',{headers:{Origin:'https://outside.invalid'}},403);
 await probe('cross-site request rejected','/api/v6/dashboard',{headers:{'Sec-Fetch-Site':'cross-site'}},403);
 await probe('arbitrary query rejected','/api/v6/dashboard?file=worker-credential.json',{},400);
 // This route is POST-only. GET 405 cannot establish its localhost guard.
 // Hosted origin rejection runs before authentication/body/provider processing.
 await probe('sports proxy stays localhost-only','/api/sports',{method:'POST',data:{}},403);
 const post=await context.request.post(new URL('/api/v6/dashboard',url).href,{data:{}});record('dashboard mutations rejected',post.status()===405,{status:post.status()});
 for(const route of ['/v6','/v6/research','/v6/models','/v6/positions','/v6/health']){await page.goto(new URL(route,url).href);await page.getByRole('alert').filter({hasText:'Cloud research evidence not yet connected'}).waitFor({timeout:30000});record('V6 route '+route,true,'Actual owner HTTPS page; explicit unprovisioned state');}
 for(const route of ['/','/ledger','/research','/paper','/analytics','/notifications','/settings','/imports']){await page.goto(new URL(route,url).href);await page.getByRole('heading',{level:1}).waitFor({timeout:30000});await page.getByText('Loading workspace…',{exact:true}).waitFor({state:'hidden',timeout:30000});record('private V5 route '+route,true,'Existing normal owner; no form submitted');}
 await page.reload();const refreshed=await privateProbe(page);record('owner session survives reload',refreshed.status===503&&refreshed.error==='Cloud research evidence not yet connected','Existing Supabase browser session');
 const after=await fingerprint(page);record('core and historical workspace unchanged',baseline.hash===after.hash,'Read-only RPC fingerprints before/after');record('no browser runtime exceptions',runtimeErrors===0,{count:runtimeErrors});
 await save();console.log('OWNER_REPORT_READY '+reportFile);
 if(!process.argv.includes('--owner-only')){
  // Reuse only the Preview edge-auth cookies in memory. No Supabase localStorage
  // is copied, and no cookie/session is exported to disk or printed.
  const second=await browser.newContext({viewport:{width:1400,height:1000},timezoneId:'Australia/Melbourne'});await second.addCookies((await context.cookies(url.origin)).filter(c=>!/^sb-|supabase|auth-token/i.test(c.name)));
  const otherPage=await second.newPage();await waitForSession(otherPage,'SECOND ACCOUNT');const other=await privateProbe(otherPage);report.crossOwner={verified:other.subject!==owner.subject&&other.status===403,reason:other.subject===owner.subject?'Same account; not a cross-owner test':'Distinct existing authenticated account',status:other.status};record('distinct hosted account cannot access owner V6 evidence',report.crossOwner.verified,'Normal JWT/owner gate; no service-role access');await second.close();
 }
 report.complete=report.tests.every(t=>t.passed)&&report.crossOwner.verified;await save();console.log('REPORT_READY '+reportFile);await context.close();
}catch{report.failure='Hosted acceptance stopped; inspect the visible browser and non-secret page errors. Credentials and response bodies withheld.';await save();console.error(report.failure);process.exitCode=1;}finally{await browser.close();}
