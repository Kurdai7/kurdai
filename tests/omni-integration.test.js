import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createProcessor} from '../processor/server.js';
import {handleLong,longInput,quoteLong} from '../long-video.js';
import {duration} from '../processor/media.js';
import {OMNI_MODEL} from '../omni-cost.js';
const body={model:OMNI_MODEL,prompt:'خێزانێکی کارتۆنی لە دارستانەکەدا بەردەوام دەڕوات.',identity:'هەمان خێزان بە جلە شینەکان.',
  duration:5,resolution:'720p',aspectRatio:'16:9',language:'sorani',dialogueText:'با پێکەوە بڕۆین.'};

test('Omni quotes distinguish output cost from unknown context and never borrow Wan prices',()=>{
  const input=longInput(body),q=quoteLong(input);
  assert.equal(q.model,OMNI_MODEL);assert.equal(q.apiMinimumUSD,0.5068);assert.equal(q.apiUSD,null);
  assert.equal(q.totalEUR,null);assert.equal(q.canStart,false);assert.equal(q.audioQuote.native,true);
  assert.equal(input.dialogueSegments[0],body.dialogueText);
  for(const language of ['sorani','badini']) assert.equal(longInput({...body,language}).language,language);
  for(const duration of [0,6,71,'5'])assert.throws(()=>longInput({...body,duration}));
  assert.throws(()=>longInput({...body,resolution:'480p'}));
  assert.throws(()=>longInput({...body,referenceImages:['https://private.test/image']}));
  assert.throws(()=>longInput({...body,dialogueText:'first\nsecond'}));
  for(const v of ['',false,null,undefined]) {
    const quote=quoteLong(input,{omniInputTokensPerSegment:v,omniTextTokensPerSegment:0,mediaEUR:0,fxPercent:0,vatPercent:0});
    assert.equal(quote.canStart,false);assert.equal(quote.apiUSD,null);
  }
});

for(const seconds of [5,60,70]) test(`Omni signed-in Worker HTTP, approval and voiced ${seconds}s MP4 work with synthetic generation only`,async t=>{
  const root=await mkdtemp(join(tmpdir(),'kurdai-omni-http-')),run=promisify(execFile),source=join(root,'source.mp4');
  await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=160x90:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','5','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
  const bytes=await readFile(source);
  const config={LONG_DATA_DIR:join(root,'jobs'),LONG_VIDEO_SERVICE_SECRET:'synthetic-only-secret-'.repeat(3),
    GEMINI_API_KEY:'dummy-not-a-real-key',OMNI_GENERATION_ENABLED:'true',OMNI_BILLING_VERIFIED:'true',LONG_DURABLE_STORAGE:'true',
    OMNI_INPUT_TOKENS_PER_SEGMENT:'10000',OMNI_TEXT_TOKENS_PER_SEGMENT:'1000',LONG_MEDIA_EUR:'0.01',LONG_FX_PERCENT:'0',LONG_VAT_PERCENT:'0'};
  let submissions=0;
  const processor=await createProcessor(config,{omni:{client:{
    async submit(input,previous) {
      assert.equal(previous,submissions?`v1_${submissions}`:undefined);
      assert.equal(input.dialogueText,submissions?'':body.dialogueText);
      assert.equal(input.language,'sorani');submissions++;return{id:`v1_${submissions}`,status:'completed'};
    },async poll(id){return{id,status:'completed'};},async media(){return bytes;}
  }}});
  await new Promise(resolve=>processor.server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${processor.server.address().port}`,realFetch=globalThis.fetch;
  globalThis.fetch=(url,options)=>{
    const u=new URL(url);if(u.origin!=='https://processor.test')throw Error('External/paid requests are forbidden in this test');
    return realFetch(origin+u.pathname+u.search,options);
  };
  t.after(async()=>{globalThis.fetch=realFetch;await new Promise(resolve=>processor.server.close(resolve));await processor.close();await rm(root,{recursive:true,force:true});});
  const owner={id:'owner',email:'owner@example.test',verified:true};
  const env={VIDEO_TEST_EMAIL:owner.email,LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:config.LONG_VIDEO_SERVICE_SECRET};
  const request=(path,data)=>handleLong(new Request('https://kurdai.net/api/long/'+path,data?{method:'POST',body:JSON.stringify(data)}:{}),env,owner);
  const health=await(await request('capabilities')).json();assert.equal(health.models[OMNI_MODEL].canStart,true);assert.equal(health.paidProviderProbe,false);assert.equal(submissions,0);
  const quote=await(await request('quote',{...body,duration:seconds,aspectRatio:seconds===70?'9:16':'16:9'})).json();
  assert.equal(quote.model,OMNI_MODEL);assert.equal(quote.canStart,true);assert.equal(quote.outputSeconds,seconds);assert.equal(submissions,0);
  assert.equal((await request('start',{id:quote.id,approved:true,approvedTotalEUR:0})).status,400);
  assert.equal(submissions,0);
  const approval={id:quote.id,approved:true,approvedTotalEUR:quote.totalEUR};
  assert.equal((await request('start',approval)).status,202);assert.equal((await request('start',approval)).status,200);
  for(let i=0;i<seconds/5*2+1;i++)await processor.tick();
  const job=await(await request('status?id='+quote.id)).json();assert.equal(job.status,'ready');assert.equal(submissions,seconds/5);
  assert.equal(job.duration,seconds);assert.equal(job.model,OMNI_MODEL);
  const file=await request('file?id='+quote.id),target=join(root,'download.mp4');assert.equal(file.status,200);
  await writeFile(target,new Uint8Array(await file.arrayBuffer()));assert.ok(Math.abs(await duration(target)-seconds)<0.08);
  const {stdout}=await run('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=codec_name','-of','csv=p=0',target]);assert.match(stdout,/aac/);
  await request('start',approval);assert.equal(submissions,seconds/5);
  const other=await handleLong(new Request('https://kurdai.net/api/long/file?id='+quote.id),env,{...owner,id:'other',email:'other@example.test'});assert.equal(other.status,403);
});
