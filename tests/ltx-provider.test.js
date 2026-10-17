import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLtxRequest,ltxResultUrl,parseLtxStatus} from '../ltx-provider.js';
test('official endpoint and 5-second 720p body with Sorani',()=>{
 const x=buildLtxRequest({language:'sorani',dialogueText:'سڵاو',visualPrompt:'Animated Kurdish presenter'});
 assert.match(x.url,/api\.wavespeed\.ai\/api\/v3\/wavespeed-ai\/ltx-2\.3\/text-to-video/);
 assert.equal(x.body.duration,5);assert.equal(x.body.resolution,'720p');
 assert.match(x.body.prompt,/سڵاو/);assert.equal(x.canSubmit,false);
});
test('Badini remains separate and payment blocked',()=>{
 const x=buildLtxRequest({language:'badini',dialogueText:'سلاڤ',visualPrompt:'Animated presenter',extraEUR:0});
 assert.match(x.body.prompt,/Badini Kurdish/);assert.equal(x.canSubmit,false);
});
test('prediction results are polled with validated IDs',()=>{
 assert.equal(ltxResultUrl('abc_123'),'https://api.wavespeed.ai/api/v3/predictions/abc_123/result');
 assert.throws(()=>ltxResultUrl('../secret'));
 assert.deepEqual(parseLtxStatus({data:{id:'a',status:'processing'}}).outputs,[]);
 assert.equal(parseLtxStatus({data:{id:'a',status:'completed',outputs:['https://example.com/video.mp4']}}).terminal,true);
});
