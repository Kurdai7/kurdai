import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {advanceNative} from '../processor/native-engine.js';
import {publicLongJob,registerRemoteSave} from '../processor/engine.js';
const config={NATIVE_GENERATION_ENABLED:'true',NATIVE_BILLING_VERIFIED:'true',LONG_DURABLE_STORAGE:'true'};
const job=()=>({id:'test',status:'running',input:{model:'pixverse-v6',prompt:'Cartoon father',dialogueText:'سڵاو',language:'sorani',duration:6,resolution:'720p',aspectRatio:'16:9'},approvedAt:new Date().toISOString(),approvedTotalEUR:.4,quote:{provider:'fal',model:'pixverse-v6',canStart:true,outputSeconds:6,apiUSD:.35,totalEUR:.4},reservedAPIUSD:0});
async function directory(t){const root=await mkdtemp(join(tmpdir(),'native-job-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('single native audio/video job reserves before submit and never resubmits during polling or after readiness',async t=>{
 const root=await directory(t),dir=join(root,'test'),j=job();let submits=0;
 const deps={client:{submit:async input=>{submits++;const saved=JSON.parse(await readFile(join(dir,'job.json')));assert.equal(saved.inflight.state,'submitting');assert.equal(saved.reservedAPIUSD,.35);return {model:input.model,id:'task'};},poll:async()=>({status:'completed',url:'https://v3.fal.media/output.mp4'})},download:async(u,p)=>writeFile(p,'source'),inspect:async()=>({width:1280,height:720,duration:6,audioPresent:true}),normalize:async(s,p)=>writeFile(p,'native video with audio')};
 await advanceNative(j,dir,config,deps);assert.equal(submits,1);
 await advanceNative(j,dir,config,deps);assert.equal(j.status,'ready');assert.equal(j.nativeMedia.speechVerified,false);assert.equal(publicLongJob(j).totalSegments,1);
 assert.equal(await readFile(join(dir,'final.mp4'),'utf8'),'native video with audio');
 await advanceNative(j,dir,config,deps);assert.equal(submits,1);
});
test('unknown POST result is terminal uncertain and never retried',async t=>{
 const dir=join(await directory(t),'test'),j=job();let submits=0;
 const deps={client:{submit:async()=>{submits++;throw new Error('private key');}}};
 await advanceNative(j,dir,config,deps);assert.equal(j.status,'uncertain');assert.doesNotMatch(j.error,/private key/);
 await advanceNative(j,dir,config,deps);assert.equal(submits,1);
});
test('disabled configuration and incomplete quotes prevent any POST',async t=>{
 const root=await directory(t);let submits=0;const deps={client:{submit:async()=>{submits++;}}};
 for(const [i,c,q]of [[0,{},{}],[1,config,{totalEUR:null}],[2,config,{provider:'other'}]]){
  const j=job();Object.assign(j.quote,q);await advanceNative(j,join(root,String(i)),c,deps);assert.equal(j.status,'failed');
 }assert.equal(submits,0);
});
test('missing audio, short media or low resolution never becomes a ready video',async t=>{
 const root=await directory(t);
 for(const [i,override]of [{audioPresent:false},{duration:5},{height:480}].entries()){
  const j=job();j.inflight={kind:'native',state:'polling',task:{model:j.input.model,id:'task'}};
  await advanceNative(j,join(root,String(i)),config,{client:{poll:async()=>({status:'completed',url:'https://v3.fal.media/test.mp4'})},download:async()=>{},inspect:async()=>({width:1280,height:720,duration:6,audioPresent:true,...override}),normalize:async()=>{throw new Error('must not normalize');}});
  assert.equal(j.status,'failed');
 }
});
test('durable reservation failure sends no request',async t=>{
 const root=await directory(t),dir=join(root,'test'),j=job();let submits=0;
 const unregister=registerRemoteSave(root,async()=>{throw new Error('storage unavailable');});t.after(unregister);
 await assert.rejects(advanceNative(j,dir,config,{client:{submit:async()=>{submits++;}}}));assert.equal(submits,0);
});
test('Pruna native route uses its own explicit gate and reserves exactly one native task',async t=>{
 const root=await directory(t);let submissions=0;
 const make=()=>{const j=job();j.input.model='p-video-2';Object.assign(j.quote,{model:'p-video-2',provider:'pruna',draft:true});return j;};
 const deps={client:{submit:async input=>{submissions++;return {id:'pruna-task',model:input.model};},poll:async()=>({status:'IN_PROGRESS'})}};
 const blocked=make();await advanceNative(blocked,join(root,'blocked'),config,deps);assert.equal(submissions,0);assert.equal(blocked.status,'failed');
 const j=make();await advanceNative(j,join(root,'allowed'),{...config,PRUNA_NATIVE_ENABLED:'true'},deps);assert.equal(submissions,1);assert.equal(publicLongJob(j).totalSegments,1);
 await advanceNative(j,join(root,'allowed'),{...config,PRUNA_NATIVE_ENABLED:'true'},deps);assert.equal(submissions,1);
});

test('Pruna preserves native 704p pixels and audio without upscaling',async t=>{
 const root=await directory(t),dir=join(root,'native704'),j=job();j.input.model='p-video-2';j.input.resolution='704p';
 Object.assign(j.quote,{model:'p-video-2',provider:'pruna',draft:true});j.inflight={kind:'native',state:'polling',task:{id:'native-task',model:'p-video-2'}};
 await advanceNative(j,dir,{...config,PRUNA_NATIVE_ENABLED:'true'},{client:{poll:async()=>({status:'completed',url:'https://api.pruna.ai/test'})},download:async(u,p)=>{const {mkdir}=await import('node:fs/promises');await mkdir(dir,{recursive:true});await writeFile(p,'original native audio and pixels');},inspect:async()=>({width:1280,height:704,duration:6.04,audioPresent:true}),normalize:async()=>{throw new Error('Do not upscale');}});
 assert.equal(j.status,'ready');assert.equal(await readFile(join(dir,'final.mp4'),'utf8'),'original native audio and pixels');assert.equal(j.nativeMedia.height,704);
});
