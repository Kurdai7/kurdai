import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeCandidateRequest,createNativeCandidateClient} from '../processor/native-candidates.js';
const input={model:'pixverse-v6',mode:'new',prompt:'A cartoon father greets the viewer.',dialogueText:'سڵاو، بەخێربێن.',language:'sorani',duration:5,resolution:'720p',aspectRatio:'16:9'};
test('native candidates keep audio in the same video request and preserve dialect lines',()=>{
 for(const model of ['pixverse-v6','kling-3.0-standard'])for(const language of ['sorani','badini']){
  const r=nativeCandidateRequest({...input,model,language});assert.ok(r.body.generate_audio_switch||r.body.generate_audio);
  assert.match(r.body.prompt,language==='sorani'?/Sorani Kurdish/:/Badini Kurdish/);assert.ok(r.body.prompt.includes(input.dialogueText));
 }
 assert.throws(()=>nativeCandidateRequest({...input,image:'data:image/png;base64,abc'}),/references/);
 assert.throws(()=>nativeCandidateRequest({...input,prompt:'ک'.repeat(1500)}),/UTF-8/);
 assert.throws(()=>nativeCandidateRequest({...input,duration:70}),/3–15/);
});
test('disabled and invalid submissions make zero network calls',async()=>{
 let calls=0;const transport=()=>{calls++;throw new Error('secret');};
 await assert.rejects(createNativeCandidateClient({apiKey:'secret'},transport).submit(input),/disabled/);
 await assert.rejects(createNativeCandidateClient({enabled:true,apiKey:'secret'},transport).submit({...input,language:'mixed'}),/dialect/);
 assert.equal(calls,0);
});
test('queue transport submits once, polls without resubmission and blocks credential exfiltration',async()=>{
 const calls=[];const reply=x=>new Response(JSON.stringify(x));
 const client=createNativeCandidateClient({enabled:true,apiKey:'secret'},async(url,request)=>{
  calls.push({url,method:request.method});
  if(request.method==='POST')return reply({request_id:'task1',status_url:'https://queue.fal.run/fal-ai/pixverse/requests/task1/status',response_url:'https://queue.fal.run/fal-ai/pixverse/requests/task1'});
  return reply(url.endsWith('/status')?{status:'COMPLETED'}:{video:{url:'https://v3.fal.media/result.mp4',content_type:'video/mp4'}});
 });
 const task=await client.submit(input);const result=await client.poll(task);assert.equal(result.status,'completed');assert.equal(result.speechVerified,false);
 assert.equal(calls.filter(c=>c.method==='POST').length,1);
 await assert.rejects(client.poll({...task,responseURL:'https://attacker.example/'}),/Untrusted/);assert.equal(calls.length,3);
});
test('uncertain submissions do not retry and provider errors never disclose secrets',async()=>{
 let calls=0;const client=createNativeCandidateClient({enabled:true,apiKey:'secret'},async()=>{calls++;throw new Error('secret');});
 await assert.rejects(client.submit(input),e=>!e.message.includes('secret')&&/uncertain/.test(e.message));assert.equal(calls,1);
});
