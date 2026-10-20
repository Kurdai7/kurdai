import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {manualPrunaReview,manualReviewApproval} from '../processor/pruna-manual-review.js';
const env={PRUNA_AUTO_TOPUP_DISABLED:'true',PRUNA_FREE_CREDIT_VERIFIED:'true'};
function fixture(fail=false){const objects=new Map();let posts=0;return {objects,get posts(){return posts;},io:{get:async(e,k)=>{if(!objects.has(k))throw {status:404};return objects.get(k);},put:async(e,k,b,c)=>{if(c?.ifNoneMatch&&objects.has(k))throw {status:412};objects.set(k,b);},client:{submit:async i=>{posts++;assert.equal(objects.size,1);assert.equal(i.duration,4);if(fail)throw new Error('private');return {model:i.model,id:'task'};},poll:async()=>({status:'completed',url:'https://api.pruna.ai/test'}),download:async(u,p)=>writeFile(p,'video')},inspect:async()=>({width:1280,height:720,duration:4,audioPresent:true})}};}
test('approved review reserves before its sole POST and archives native media',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-20T12:00:00Z')});const f=fixture();
 await manualPrunaReview(env,'submit',manualReviewApproval,f.io);await manualPrunaReview(env,'submit',manualReviewApproval,f.io);assert.equal(f.posts,1);
 const result=await manualPrunaReview(env,'status',null,f.io);assert.equal(result.status,'completed');assert.equal(result.speechVerified,false);assert.equal(result.referenceOutputUSD,.06);
 await manualPrunaReview(env,'status',null,f.io);assert.equal(f.posts,1);assert.equal(f.objects.size,2);
});
test('uncertain POST and concurrent reservation never lead to another POST',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-20T12:00:00Z')});const f=fixture(true);
 const r=await Promise.allSettled([manualPrunaReview(env,'submit',manualReviewApproval,f.io),manualPrunaReview(env,'submit',manualReviewApproval,f.io)]);assert.ok(r.some(x=>x.status==='rejected'));
 await manualPrunaReview(env,'submit',manualReviewApproval,f.io);assert.equal(f.posts,1);
});
test('GET does not submit; missing approval and expired date cannot spend',async t=>{
 const f=fixture();assert.equal((await manualPrunaReview(env,'status',null,f.io)).status,'not_submitted');
 await assert.rejects(manualPrunaReview(env,'submit','wrong',f.io),/approval/);
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-21T12:00:00Z')});await assert.rejects(manualPrunaReview(env,'submit',manualReviewApproval,f.io),/approval/);assert.equal(f.posts,0);
});
