import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';

test('real Worker and D1 register, verify, login, logout and bound public requests without any paid provider',async t=>{
  const bundle=await build({entryPoints:['worker.js'],bundle:true,write:false,format:'esm',platform:'browser'});
  let messages=[],providerCalls=0,mailStatus=200;
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,
    compatibilityDate:'2026-09-25',d1Databases:['DB'],bindings:{EMAIL_API_KEY:'test-only-not-a-real-key',
      EMAIL_FROM:'test@example.test',VIDEO_TEST_EMAIL:'owner@example.test',VIDEO_GENERATION_ENABLED:'true',GEMINI_API_KEY:'test-not-a-real-key'},
    outboundService:async request=>{
      if(request.url!=='https://api.resend.com/emails'){providerCalls++;throw Error('Paid provider forbidden');}
      messages.push(await request.json());return Response.json({id:'fake-mail'},{status:mailStatus});
    }}));
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('DB');
  const health=async()=> (await mf.dispatchFetch('https://kurdai.test/api/health')).json();
  const emptyHealth=await health();
  assert.equal(emptyHealth.databaseConfigured,true);
  assert.equal(emptyHealth.databaseReady,false);
  assert.equal(emptyHealth.registrationConfigured,false);
  assert.deepEqual(emptyHealth.missingSchema,['users','verification_tokens','sessions','credit_ledger']);
  // D1 exec expects one complete statement per line.
  const schema=await readFile(new URL('../schema.sql',import.meta.url),'utf8');
  for(const statement of schema.split(';').map(s=>s.trim()).filter(Boolean)) await db.prepare(statement).run();
  assert.equal((await health()).databaseReady,true);
  assert.equal((await health()).registrationConfigured,true);
  assert.equal((await health()).emailDeliveryVerified,false);
  const post=(path,data,ip='192.0.2.1')=>mf.dispatchFetch('https://kurdai.test'+path,{method:'POST',
    headers:{'Content-Type':'application/json','CF-Connecting-IP':ip},body:JSON.stringify(data)});
  const credentials={email:'reader@example.test',password:'offline-test-password-2026'};
  const registration=await post('/api/register',credentials);assert.equal(registration.status,201);
  assert.equal(messages.length,1);assert.deepEqual(messages[0].to,[credentials.email]);
  const repeat=async()=>post('/api/register',{email:'READER@example.test',password:'different-valid-password'},'192.0.2.22');
  assert.equal((await repeat()).status,409);
  assert.equal(messages.length,1,'Duplicate signup must not resend mail or replace the password');
  assert.equal((await post('/api/login',credentials)).status,403);
  const verifyUrl=messages[0].html.match(/href="([^"]+)"/)[1];
  assert.equal((await mf.dispatchFetch(verifyUrl)).status,200);
  assert.equal((await mf.dispatchFetch(verifyUrl)).status,400);
  assert.equal((await (await repeat()).json()).code,'ACCOUNT_ALREADY_EXISTS');
  assert.equal(await db.prepare('SELECT verified FROM users WHERE email=?').bind(credentials.email).first('verified'),1);
  assert.equal((await post('/api/login',{...credentials,password:'wrong'})).status,401);
  const login=await post('/api/login',credentials);assert.equal(login.status,200);
  const session=(await login.json()).token;
  const signed=(path,options={})=>mf.dispatchFetch('https://kurdai.test'+path,{...options,headers:{Authorization:'Bearer '+session,...options.headers}});
  const me=await(await signed('/api/me')).json();assert.equal(me.email,credentials.email);assert.equal(me.verified,true);
  const caps=await(await signed('/api/video-capabilities')).json();assert.equal(caps.accountAllowed,false);
  assert.equal(caps.publicGenerationEnabled,false);assert.equal(caps.providerGenerationVerified,false);
  for(const mode of ['new','frame','extend']) {
    const r=await signed('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})});
    assert.equal(r.status,403);
  }
  assert.equal((await signed('/api/long/start',{method:'POST',body:'{}'})).status,403);
  await signed('/api/logout',{method:'POST'});
  assert.equal((await signed('/api/me')).status,401);
  const invalid=await mf.dispatchFetch('https://kurdai.test/api/login',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.2'},body:'{'});
  assert.equal(invalid.status,400);
  const large=await post('/api/login',{email:credentials.email,password:'a'.repeat(5000)},'192.0.2.3');assert.equal(large.status,413);
  const attempts=await Promise.all(Array.from({length:15},()=>post('/api/login',{...credentials,password:'wrong'},'192.0.2.4')));
  assert.equal(attempts.filter(r=>r.status===401).length,10);assert.equal(attempts.filter(r=>r.status===429).length,5);
  assert.ok(attempts.find(r=>r.status===429).headers.get('Retry-After'));
  assert.equal(providerCalls,0);assert.equal(messages.length,1);
  mailStatus=401;
  const failedEmail={email:'mail-failure@example.test',password:credentials.password};
  const emailFailure=await post('/api/register',failedEmail,'192.0.2.20');
  assert.equal(emailFailure.status,503);
  assert.equal((await emailFailure.json()).code,'REGISTRATION_EMAIL_FAILED');
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM users WHERE email=?').bind(failedEmail.email).first('n'),0);
  await db.prepare('DROP TABLE verification_tokens').run();
  const brokenHealth=await health();
  assert.equal(brokenHealth.databaseReady,false);
  assert.equal(brokenHealth.registrationConfigured,false);
  assert.deepEqual(brokenHealth.missingSchema,['verification_tokens']);
  const databaseFailure=await post('/api/register',{...credentials,email:'db-failure@example.test'},'192.0.2.21');
  assert.equal(databaseFailure.status,503);
  assert.equal((await databaseFailure.json()).code,'REGISTRATION_DATABASE_FAILED');
  assert.equal(messages.length,2,'Database failure must not send email');
});
