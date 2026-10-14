import {test} from 'node:test';
import assert from 'node:assert/strict';
import {omniRequest,parseOmniInteraction,createOmniClient,OMNI_MODEL} from '../processor/omni.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {normalizeVoiced,assembleVoiced,duration} from '../processor/media.js';
import {advanceOmni} from '../processor/omni-engine.js';
const input={prompt:'A cartoon family walks through a forest.',identity:'The same family, blue and green clothes.',
  aspectRatio:'16:9',resolution:'720p',language:'sorani',dialogueText:'با پێکەوە بڕۆین.',segmentSeconds:5};
const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom')]);
const completed=uri=>({id:'v1_test',status:'completed',steps:[{type:'model_output',content:[{type:'video',mime_type:'video/mp4',uri}]}]});

test('Omni preserves separate dialects, references and multi-turn voice context',()=>{
  for(const language of ['sorani','badini']) {
    const body=omniRequest({...input,language},'v1_previous');
    assert.equal(body.model,OMNI_MODEL);assert.equal(body.previous_interaction_id,'v1_previous');
    assert.equal(body.store,true);assert.equal(body.response_format.delivery,'uri');
    assert.match(body.input.at(-1).text,/exact final frame/);
    assert.match(body.input.at(-1).text,language==='sorani'?/Speak only Sorani Kurdish/:/Speak only Badini Kurdish/);
    assert.ok(body.input.at(-1).text.includes(input.dialogueText));
  }
  const png='data:image/png;base64,iVBORw0KGgo=';
  assert.equal(omniRequest({...input,image:png}).input[0].mime_type,'image/png');
  assert.throws(()=>omniRequest({...input,image:'https://private.test/image'}),/uploaded/);
  assert.throws(()=>omniRequest({...input,referenceImages:[png,png,png,png]}),/three/);
  assert.throws(()=>omniRequest(input,'bad/id'),/interaction/);
});

test('Omni disabled transport sends no request; uncertain submission is never retried',async()=>{
  let calls=0;
  const fetcher=async()=>{calls++;throw new TypeError('private error');};
  await assert.rejects(createOmniClient({apiKey:'dummy',enabled:false},fetcher).submit(input),/disabled/);
  assert.equal(calls,0);
  await assert.rejects(createOmniClient({apiKey:'dummy',enabled:true},fetcher).submit(input),TypeError);
  assert.equal(calls,1);
});

test('Omni reads raw REST steps, polls only trusted Google files and blocks redirects',async()=>{
  assert.deepEqual(parseOmniInteraction({id:'v1_wait',status:'in_progress'}),{id:'v1_wait',status:'in_progress'});
  assert.throws(()=>parseOmniInteraction(completed('https://attacker.test/v1beta/files/a')),/Untrusted/);
  const inline={id:'v1_test',status:'completed',steps:[{type:'model_output',content:[{type:'video',mime_type:'video/mp4',data:mp4.toString('base64')}]}]};
  assert.deepEqual(parseOmniInteraction(inline).bytes,mp4);
  inline.usage={total_input_tokens:12,total_output_tokens:28960,output_tokens_by_modality:[{modality:'video',tokens:28960}],privateKey:'must-never-persist'};
  const usage=parseOmniInteraction(inline).usage;
  assert.equal(usage.total_input_tokens,12);assert.equal(usage.output_tokens_by_modality[0].tokens,28960);
  assert.equal(JSON.stringify(usage).includes('privateKey'),false);
  let calls=[];
  const client=createOmniClient({apiKey:'dummy-test-only',enabled:true},async(url,options)=>{
    calls.push(url);assert.equal(options.redirect,'manual');assert.equal(options.headers['x-goog-api-key'],'dummy-test-only');
    if(url.endsWith('/interactions')) {
      const body=JSON.parse(options.body);assert.equal(body.model,OMNI_MODEL);assert.equal(body.store,true);
      return Response.json(completed('https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media'));
    }
    if(url.endsWith('/files/abc')) return Response.json({state:'ACTIVE'});
    return new Response(mp4);
  });
  const result=await client.submit(input);assert.deepEqual(await client.media(result),mp4);assert.equal(calls.length,3);
  const redirect=createOmniClient({apiKey:'dummy',enabled:true},async()=>new Response(null,{status:302,headers:{Location:'https://attacker.test/'}}));
  await assert.rejects(redirect.submit(input),/HTTP 302/);
});

test('Omni voiced media path retains audio and rejects silent provider output',async()=>{
  const root=await mkdtemp(join(tmpdir(),'kurdai-omni-audio-')),run=promisify(execFile);
  try {
    const source=join(root,'source.mp4');
    await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=160x90:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','5','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
    await normalizeVoiced(source,join(root,'clip-0.mp4'),'16:9','360p');
    const output=await assembleVoiced(root,1);
    assert.ok(Math.abs(await duration(output)-5)<0.08);
    const {stdout}=await run('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=codec_name','-of','csv=p=0',output]);
    assert.match(stdout,/aac/);
    const silent=join(root,'silent.mp4');await run('ffmpeg',['-loglevel','error','-y','-i',source,'-an','-c:v','copy',silent]);
    await assert.rejects(normalizeVoiced(silent,join(root,'invalid.mp4'),'16:9','360p'),/no audio track/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('60/70 second Omni orchestration carries interaction state, binds approval and never retries uncertain POSTs',async()=>{
  const root=await mkdtemp(join(tmpdir(),'kurdai-omni-state-'));
  try {
    for (const seconds of [60,70]) {
      const count=seconds/5,job={id:'test',status:'running',input:{...input,duration:seconds,dialogueSegments:Array(count).fill(input.dialogueText)},
        quote:{model:OMNI_MODEL,totalEUR:10,apiUSD:count,segmentBudgetsUSD:Array(count).fill(1)},approvedTotalEUR:10,
        approvedAt:new Date().toISOString(),completedSegments:0,reservedAPIUSD:0};
      let calls=0,assembled=0;
      const dependencies={client:{
        async submit(value,previous) {assert.equal(previous,calls?`v1_${calls}`:undefined);assert.equal(value.dialogueText,input.dialogueText);calls++;return{id:`v1_${calls}`};},
        async poll(id){return{id,status:'completed'};},async media(){return mp4;}
      },media:{async normalizeVoiced(){},async assembleVoiced(path,n){assert.equal(n,count);assembled++;}}};
      for(let tick=0;tick<count*2+1;tick++)await advanceOmni(job,join(root,String(seconds)),{OMNI_GENERATION_ENABLED:'true'},dependencies);
      assert.equal(job.status,'ready');assert.equal(calls,count);assert.equal(assembled,1);
      assert.equal(job.completedSegments,count);assert.equal(job.reservedAPIUSD,count);
      const uncertain={...job,status:'running',completedSegments:0,inflight:{state:'submitting'}};
      await advanceOmni(uncertain,join(root,'uncertain'),{OMNI_GENERATION_ENABLED:'true'},dependencies);
      assert.equal(uncertain.status,'uncertain');assert.equal(calls,count);
      const unapproved={...job,status:'running',completedSegments:0,inflight:null,approvedTotalEUR:0};
      await advanceOmni(unapproved,join(root,'unapproved'),{OMNI_GENERATION_ENABLED:'true'},dependencies);
      assert.equal(unapproved.status,'failed');assert.equal(calls,count);
    }
  }finally{await rm(root,{recursive:true,force:true});}
});
