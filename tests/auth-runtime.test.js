import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';

test('real Worker and D1 register, verify, login, logout and bound public requests without any paid provider',async t=>{
  const bundle=await build({entryPoints:['worker.js'],bundle:true,write:false,format:'esm',platform:'browser'});
  let messages=[],providerCalls=0;
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,
    compatibilityDate:'2026-09-25',d1Databases:['DB'],bindings:{EMAIL_API_KEY:'test-only-not-a-real-key',
      EMAIL_FROM:'test@example.test',VIDEO_TEST_EMAIL:'owner@example.test',VIDEO_GENERATION_ENABLED:'true',GEMINI_API_KEY:'test-not-a-real-key'},
    outboundService:async request=>{
      if(request.url!=='https://api.resend.com/emails'){providerCalls++;throw Error('Paid provider forbidden');}
      messages.push(await request.json());return Response.json({id:'fake-mail'});
    }}));
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('DB');
  // D1 exec expects one complete statement per line.
  const schema=await readFile(new URL('../schema.sql',import.meta.url),'utf8');
  for(const statement of schema.split(';').map(s=>s.trim()).filter(Boolean)) await db.prepare(statement).run();
  const post=(path,data,ip='192.0.2.1')=>mf.dispatchFetch('https://kurdai.test'+path,{method:'POST',
    headers:{'Content-Type':'application/json','CF-Connecting-IP':ip},body:JSON.stringify(data)});
  const credentials={email:'reader@example.test',password:'offline-test-password-2026'};
  const registration=await post('/api/register',credentials);assert.equal(registration.status,201);
  assert.equal(messages.length,1);assert.deepEqual(messages[0].to,[credentials.email]);
  assert.equal((await post('/api/login',credentials)).status,403);
  const verifyUrl=messages[0].html.match(/href="([^"]+)"/)[1];
  assert.equal((await mf.dispatchFetch(verifyUrl)).status,200);
  assert.equal((await mf.dispatchFetch(verifyUrl)).status,400);
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
});
