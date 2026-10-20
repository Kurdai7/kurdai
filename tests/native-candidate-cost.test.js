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
  assert.equal(q.providerReference.appliesToPreparedAdapter,true);assert.equal(q.providerReference.provider,'fal');
  assert.equal(q.providerReference.outputUSD,model==='kling-3.0-standard'?0.63:0.3);
 }
 assert.throws(()=>longInput({...base,model:'pixverse-v6',duration:70}),/3–15/);
 assert.throws(()=>longInput({...base,model:'pixverse-v6',image:'https://example.com/image'}),/references/);
});
test('owner Worker quote fallback exposes a blocked candidate without provider traffic',async()=>{
 const req=new Request('https://kurdai.net/api/long/quote',{method:'POST',body:JSON.stringify({...base,model:'pixverse-v6'})});
 const response=await handleLong(req,{VIDEO_TEST_EMAIL:'owner@example.com'},{id:'owner',email:'owner@example.com',verified:true});
 assert.equal(response.status,200);const q=await response.json();assert.equal(q.model,'pixverse-v6');assert.equal(q.canStart,false);assert.equal(q.totalEUR,null);
});
test('P-Video 2 keeps both dialects and published Draft pricing without authorizing billing',async()=>{
 for(const language of ['sorani','badini']){
  const i=longInput({...base,model:'p-video-2',language,duration:20});
  const q=quoteLong(i,{enabled:true,omniEnabled:true,omniConfigured:true});
  assert.equal(q.canStart,false);assert.equal(q.totalEUR,null);assert.equal(q.apiUSD,null);
  assert.equal(q.providerReference.outputUSD,.3);assert.equal(q.providerReference.draft,true);
  assert.equal(q.providerReference.provider,'Pruna');assert.equal(q.ownerReview.apiVerified,true);
  assert.equal(q.audioQuote.language,language);assert.equal(i.dialogueText,base.dialogueText);
 }
 assert.equal(longInput({...base,model:'p-video-2',duration:70}).duration,70);assert.throws(()=>longInput({...base,model:'p-video-2',duration:71}),/3–70/);
 const req=new Request('https://kurdai.net/api/long/quote',{method:'POST',body:JSON.stringify({...base,model:'p-video-2'})});
 const res=await handleLong(req,{VIDEO_TEST_EMAIL:'owner@example.com'},{id:'owner',email:'owner@example.com',verified:true});
 assert.equal(res.status,200);const q=await res.json();assert.equal(q.canStart,false);assert.equal(q.providerReference.outputUSD,.075);
});

test('Pruna retail quote requires reviewed flags, native resolution and explicit cost components',()=>{
 const i=longInput({...base,model:'p-video-2',resolution:'704p'});
 const costs={durableStorage:true,prunaEnabled:true,prunaConfigured:true,prunaBillingVerified:true,usdPerEUR:1,mediaEUR:.01,fxPercent:2,vatPercent:25};
 const q=quoteLong(i,costs);assert.equal(q.canStart,true);assert.equal(q.provider,'pruna');assert.equal(q.draft,true);assert.equal(q.apiUSD,.09);assert.equal(q.estimateSeconds,6);assert.equal(q.totalEUR,.1273);
 for(const patch of [{durableStorage:false},{prunaEnabled:false},{prunaConfigured:false},{prunaBillingVerified:false},{usdPerEUR:''},{mediaEUR:''},{vatPercent:101}])assert.equal(quoteLong(i,{...costs,...patch}).canStart,false);
 assert.equal(quoteLong({...i,language:'badini'},costs).canStart,true);assert.match(quoteLong({...i,language:'badini'},costs).limitations.join(' '),/بادینی/);assert.equal(quoteLong({...i,resolution:'720p'},costs).canStart,false);
});

test('long Sorani dialogue cannot be squeezed into a short Pruna clip',()=>{
 assert.throws(()=>longInput({...base,model:'p-video-2',duration:4,dialogueText:'سڵاو هاوڕێیان چۆنن هیوادارم هەمووتان باش و تەندروست بن ئەمڕۆ ڕۆژێکی جوانە'}),/دیالۆگەکە/);
 assert.equal(longInput({...base,model:'p-video-2',duration:4,dialogueText:'سڵاو، بەخێربێن بۆ کورد ئەی.'}).duration,4);
});
