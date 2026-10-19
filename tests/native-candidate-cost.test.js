import {test} from 'node:test';
import assert from 'node:assert/strict';
import {longInput,quoteLong,handleLong} from '../long-video.js';
import {nativeCandidateRequest} from '../processor/native-candidates.js';
const base={prompt:'An animated father waves.',dialogueText:'سڵاو، بەخێربێن.',duration:5,aspectRatio:'16:9',resolution:'720p',language:'sorani'};
test('candidate quotes never become payable even with all legacy spending flags enabled',()=>{
 for(const model of ['pixverse-v6','kling-3.0-standard'])for(const language of ['sorani','badini']){
  const i=longInput({...base,model,language});const q=quoteLong(i,{enabled:true,omniEnabled:true,omniConfigured:true,mediaEUR:0,fxPercent:0,vatPercent:0});
  assert.equal(q.canStart,false);assert.equal(q.totalEUR,null);assert.equal(q.apiUSD,null);
  assert.equal(q.audioQuote.language,language);assert.ok(nativeCandidateRequest(i).body.prompt.includes(base.dialogueText));
  assert.equal(q.providerReference.appliesToPreparedAdapter,model==='kling-3.0-standard');
 }
 assert.throws(()=>longInput({...base,model:'pixverse-v6',duration:70}),/3–15/);
 assert.throws(()=>longInput({...base,model:'pixverse-v6',image:'https://example.com/image'}),/references/);
});
test('owner Worker quote fallback exposes a blocked candidate without provider traffic',async()=>{
 const req=new Request('https://kurdai.net/api/long/quote',{method:'POST',body:JSON.stringify({...base,model:'pixverse-v6'})});
 const response=await handleLong(req,{VIDEO_TEST_EMAIL:'owner@example.com'},{id:'owner',email:'owner@example.com',verified:true});
 assert.equal(response.status,200);const q=await response.json();assert.equal(q.model,'pixverse-v6');assert.equal(q.canStart,false);assert.equal(q.totalEUR,null);
});
