import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,copyFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createProcessor} from '../processor/server.js';
import {handleLong,quoteLong} from '../long-video.js';
import {duration} from '../processor/media.js';

test('empty cost settings never silently authorize zero-cost processing',()=>{
  for (const value of ['', '  ', false, null, undefined, 'invalid']) {
    const q=quoteLong({resolution:'480p',image:true,language:'none'},{mediaEUR:value,fxPercent:0,vatPercent:0,enabled:true});
    assert.equal(q.canStart,false);assert.equal(q.totalEUR,null);
  }
});

for (const seconds of [60,70]) test(`Worker-to-private-processor HTTP workflow produces a real ${seconds}s MP4 using synthetic providers only`,async t=>{
  const root=await mkdtemp(join(tmpdir(),'kurdai-e2e-'));
  const run=promisify(execFile), source=join(root,'synthetic.mp4'), opening=join(root,'reference.png');
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=160x90:rate=30','-t','5','-c:v','libx264','-pix_fmt','yuv420p',source]);
  await run('ffmpeg',['-loglevel','error','-y','-i',source,'-frames:v','1',opening]);
  const config={LONG_DATA_DIR:join(root,'private'),LONG_VIDEO_SERVICE_SECRET:'test-only-credential-'.repeat(3),
    LONG_VIDEO_ENABLED:'true',LONG_MEDIA_EUR:'0.01',LONG_FX_PERCENT:'0',LONG_VAT_PERCENT:'0',DASHSCOPE_API_KEY:'dummy-not-a-key'};
  let submissions=0;
  const processor=await createProcessor(config,{providers:{
    async submitImage(){throw Error('Uploaded reference must not require an image provider');},
    async submitWan(input,image,prompt){
      submissions++;assert.match(image,/^data:image\/png;base64,/);assert.match(prompt,/same camera, light, face, clothing/);
      assert.equal(input.aspectRatio,'16:9');return `synthetic-${submissions}`;
    },
    async wanResult(id){return `https://synthetic.test/${id}`;},
    async download(url,target){assert.match(url,/^https:\/\/synthetic.test\//);await copyFile(source,target);}
  }});
  await new Promise(resolve=>processor.server.listen(0,'127.0.0.1',resolve));
  const local=`http://127.0.0.1:${processor.server.address().port}`;
  const realFetch=globalThis.fetch;
  globalThis.fetch=(url,options)=>{
    const parsed=new URL(url);
    if(parsed.origin!=='https://processor.test') throw Error('Unexpected network call; paid/external providers are forbidden in this test');
    return realFetch(local+parsed.pathname+parsed.search,options);
  };
  t.after(async()=>{globalThis.fetch=realFetch;await new Promise(resolve=>processor.server.close(resolve));await processor.close();await rm(root,{recursive:true,force:true});});
  const env={VIDEO_TEST_EMAIL:'owner@example.test',LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:config.LONG_VIDEO_SERVICE_SECRET};
  const owner={id:'owner',email:'owner@example.test',verified:true};
  const request=(path,body,user=owner)=>handleLong(new Request('https://kurdai.net/api/long/'+path,body?{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  }:{}),env,user);
  const readiness=await (await request('capabilities')).json();
  assert.equal(readiness.processorReachable,true);assert.equal(readiness.canStartWithReference,true);
  assert.equal(readiness.canStartFromText,false);assert.equal(readiness.providerConfigured.openingImage,false);
  assert.deepEqual(readiness.audioEnabled,{sorani:false,badini:false});assert.equal(submissions,0);
  const body={prompt:'One cartoon character walks forward.',identity:'Blue jacket, same face.',aspectRatio:'16:9',resolution:'480p',duration:seconds,language:'none',
    image:'data:image/png;base64,'+(await readFile(opening)).toString('base64')};
  const quote=await (await request('quote',body)).json();
  assert.equal(quote.canStart,true);assert.equal(quote.apiUSD,Number((seconds * 0.015).toFixed(6)));assert.equal(submissions,0);
  assert.equal((await request('start',{id:quote.id})).status,400);
  assert.equal((await request('start',{id:quote.id,approved:true,approvedTotalEUR:0})).status,400);assert.equal(submissions,0);
  const approval={id:quote.id,approved:true,approvedTotalEUR:quote.totalEUR};
  assert.equal((await request('start',approval)).status,202);
  assert.equal((await request('start',approval)).status,200);
  for(let tick=0;tick<30;tick++)await processor.tick();
  const result=await (await request('status?id='+quote.id)).json();
  assert.equal(result.status,'ready');assert.equal(result.duration,seconds);assert.equal(result.completedSegments,seconds/5);assert.equal(submissions,seconds/5);
  const file=await request('file?id='+quote.id);assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'video/mp4');
  assert.match(file.headers.get('content-disposition'),/KurdAI-video.mp4/);
  const downloaded=join(root,'downloaded.mp4');await writeFile(downloaded,new Uint8Array(await file.arrayBuffer()));
  assert.equal(await duration(downloaded),seconds);
  assert.equal((await request('file?id='+quote.id,null,{...owner,email:'other@example.test',id:'other'})).status,403);
  await request('start',approval);assert.equal(submissions,seconds/5);
  assert.equal(JSON.stringify(result).includes(config.LONG_VIDEO_SERVICE_SECRET),false);
});

test('missing processor configuration and network failure have explicit free diagnostics',async()=>{
  const owner={id:'owner',email:'owner@example.test',verified:true};
  const request=new Request('https://kurdai.net/api/long/capabilities');
  const data=await(await handleLong(request,{VIDEO_TEST_EMAIL:owner.email},owner)).json();
  assert.equal(data.processorReachable,false);assert.equal(data.paidProviderProbe,false);assert.equal(data.missingConfiguration.length,2);
  const original=globalThis.fetch;globalThis.fetch=async()=>{throw new TypeError('network failure with internal details');};
  try{
    const response=await handleLong(request,{VIDEO_TEST_EMAIL:owner.email,LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:'test-only-secret-at-least-32-characters'},owner);
    assert.equal(response.status,503);assert.match((await response.json()).error,/unreachable/);
  }finally{globalThis.fetch=original;}
});

test('free readiness allows cold startup without extending or retrying paid POSTs', async () => {
  const owner={id:'owner',email:'owner@example.test',verified:true};
  const env={VIDEO_TEST_EMAIL:owner.email,LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:'test-only-secret-at-least-32-characters'};
  const originalFetch=globalThis.fetch, originalTimeout=AbortSignal.timeout;
  const windows=[]; let calls=0;
  AbortSignal.timeout=ms=>{windows.push(ms);return new AbortController().signal;};
  globalThis.fetch=async()=>{calls++;throw new DOMException('simulated startup delay','TimeoutError');};
  try {
    const health=await handleLong(new Request('https://kurdai.net/api/long/capabilities'),env,owner);
    assert.equal(health.status,503);assert.match((await health.json()).error,/90 seconds.*No generation request/);
    assert.equal(calls,1);
    const start=await handleLong(new Request('https://kurdai.net/api/long/start',{method:'POST',body:'{}'}),env,owner);
    assert.equal(start.status,503);assert.equal(calls,2);
    assert.deepEqual(windows,[90000,30000]);
  } finally {globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout;}
});

 test('processor diagnostics reject invalid secret headers without leaking values or submitting requests', async()=>{
  const owner={id:'owner',email:'owner@example.test',verified:true};
  const env={VIDEO_TEST_EMAIL:owner.email,LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:'invalid\ncredential'};
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({error:'Unauthorized.'},{status:401});};
  try {
    const req=()=>new Request('https://kurdai.net/api/long/capabilities');
    const bad=await (await handleLong(req(),env,owner)).json();assert.equal(bad.code,'PROCESSOR_SECRET_FORMAT');assert.equal(calls,0);assert.equal(JSON.stringify(bad).includes(env.LONG_VIDEO_SERVICE_SECRET),false);
    const auth=await (await handleLong(req(),{...env,LONG_VIDEO_SERVICE_SECRET:'  '+ 'valid-dummy-credential-'.repeat(3)+'\n'},owner)).json();assert.equal(auth.code,'PROCESSOR_AUTH_REJECTED');assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
 });

test('configured Worker rejects empty quotes before contacting processor', async()=>{
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not fetch');};
  try {
    const r=await handleLong(new Request('https://kurdai.net/api/long/quote',{method:'POST',body:'{}'}),{VIDEO_TEST_EMAIL:'owner@test.example',LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:'x'.repeat(32)},{id:'owner',email:'owner@test.example',verified:true});
    assert.equal(r.status,400);assert.match((await r.json()).error,/prompt/);assert.equal(calls,0);
  }finally{globalThis.fetch=original;}
});
