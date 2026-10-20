import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPrunaNativeClient,prunaNativeRequest} from '../processor/pruna-native.js';
const input={model:'p-video-2',language:'sorani',duration:5,resolution:'720p',aspectRatio:'16:9',prompt:'A cartoon father waves.',dialogueText:'سڵاو',identity:'Kurdish clothes'};
test('Pruna requests native audio and preserves separate dialect dialogue without audio input',()=>{
 for(const language of ['sorani','badini']){
  const b=prunaNativeRequest({...input,language}).input;
  assert.equal(b.save_audio,true);assert.equal(b.draft,true);assert.equal(b.disable_safety_filter,false);
  assert.equal(b.audio,undefined);assert.ok(b.prompt.includes(input.dialogueText));assert.match(b.prompt,language==='sorani'?/Sorani Kurdish/:/Badini Kurdish/);
 }
 assert.throws(()=>prunaNativeRequest({...input,mode:'extension'}),/extension/);
});
test('Pruna persists task identity, polls and downloads without sending keys to sibling output hosts',async t=>{
 const root=await mkdtemp(join(tmpdir(),'pruna-transport-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const calls=[];const client=createPrunaNativeClient({apiKey:'private',enabled:true},async(url,o)=>{
  calls.push({url,o});
  if(o.method==='POST')return Response.json({id:'task-1'});
  if(url.includes('/status/'))return Response.json({status:'succeeded',generation_url:'https://media.pruna.ai/test.mp4'});
  return new Response('video');
 });
 const task=await client.submit(input),result=await client.poll(task);await client.download(result.url,join(root,'video.mp4'));
 assert.equal(await readFile(join(root,'video.mp4'),'utf8'),'video');assert.equal(calls.filter(c=>c.o.method==='POST').length,1);
 assert.equal(calls[0].o.headers.apikey,'private');assert.equal(calls[0].o.headers.Model,'p-video-2');assert.equal(calls[2].o.headers.apikey,undefined);
 const count=calls.length;await assert.rejects(client.download('https://attacker.example/x',join(root,'bad')),/Untrusted/);assert.equal(calls.length,count);
 await assert.rejects(client.poll({...task,id:'../other'}),/Invalid saved/);
});
test('Pruna disabled requests, uncertain requests and rejected authentication never retry',async()=>{
 let calls=0;
 await assert.rejects(createPrunaNativeClient({apiKey:'private'},async()=>{calls++;}).submit(input),/disabled/);assert.equal(calls,0);
 const client=createPrunaNativeClient({enabled:true,apiKey:'private'},async()=>{calls++;throw new Error('private');});
 await assert.rejects(client.submit(input),e=>/uncertain/.test(e.message)&&!e.message.includes('private'));assert.equal(calls,1);
 const rejected=createPrunaNativeClient({enabled:true,apiKey:'private'},async()=>{calls++;return new Response('private',{status:401});});
 await assert.rejects(rejected.submit(input),/HTTP 401/);assert.equal(calls,2);
});
