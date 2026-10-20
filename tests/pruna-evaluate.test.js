import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {submitPrunaEvaluation} from '../scripts/pruna-evaluate.js';
test('evaluation refuses network access without verified free credit and disabled auto-topup',async()=>{
 let calls=0;
 await assert.rejects(submitPrunaEvaluation({dialect:'sorani',apiKey:'test',directory:'/unused',fetchImpl:()=>{calls++;}}),/blocked/);
 assert.equal(calls,0);
});
test('an uncertain submission cannot be charged twice and never leaks the key',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pruna-eval-'));let calls=0;
 const options={dialect:'sorani',apiKey:'private-test-value',directory,freeCreditVerified:true,autoTopUpDisabled:true,
  fetchImpl:async()=>{calls++;throw new Error('private-test-value');}};
 try {
  await assert.rejects(submitPrunaEvaluation(options),/uncertain/);
  await assert.rejects(submitPrunaEvaluation(options),{code:'EEXIST'});
  assert.equal(calls,1);
  assert.doesNotMatch(await readFile(join(directory,'sorani.reservation.json'),'utf8'),/private-test-value/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('separate dialect requests use native 768p Cost audio/video and retain only safe task metadata',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pruna-eval-'));const prompts=[];
 try {for(const dialect of ['sorani','badini']){
  const record=await submitPrunaEvaluation({dialect,apiKey:'private-test-value',directory,freeCreditVerified:true,autoTopUpDisabled:true,
   fetchImpl:async(url,request)=>{
    assert.equal(url,'https://api.pruna.ai/v1/predictions');assert.equal(request.headers.Model,'p-video-2-pro');
    const {input}=JSON.parse(request.body);assert.equal(input.duration,5);assert.equal(input.resolution,'768p');
    assert.equal(input.mode,'cost');assert.equal(input.prompt_upsampler,'off');prompts.push(input.prompt);
    return {ok:true,json:async()=>({id:`task_${dialect}`,secret:'private-test-value'})};}});
  assert.equal(record.speechVerified,false);
  assert.doesNotMatch(await readFile(join(directory,`${dialect}.task.json`),'utf8'),/private-test-value/);
 }assert.notEqual(prompts[0],prompts[1]);
 }finally{await rm(directory,{recursive:true,force:true});}
});
