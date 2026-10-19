import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewEnabled,runPrunaReview,probePrunaAuthentication} from '../processor/pruna-review.js';
const env={PRUNA_FREE_EVALUATION:'2026-10-19-two-dialects',PRUNA_FREE_CREDIT_VERIFIED:'true',
 PRUNA_AUTO_TOPUP_DISABLED:'true',PRUNA_API_KEY:'fake',PRUNA_REVIEW_TOKEN:'x'.repeat(32)};
test('review is private, explicit and expires after approval date',()=>{
 assert.equal(reviewEnabled(env,new Date('2026-10-19')),true);
 assert.equal(reviewEnabled(env,new Date('2026-10-20')),false);
 assert.equal(reviewEnabled({...env,PRUNA_FREE_CREDIT_VERIFIED:'false'},new Date('2026-10-19')),false);
});
test('durable reservation prevents duplicate submission after network uncertainty',async()=>{
 const objects=new Map();let submissions=0;
 const io={get:async(e,k)=>{if(!objects.has(k))throw {status:404};return objects.get(k);},
 put:async(e,k,b,c)=>{if(c?.ifNoneMatch&&objects.has(k))throw {status:412};objects.set(k,b);},
 fetch:async()=>{submissions++;throw new Error('network');}};
 await assert.rejects(runPrunaReview(env,io),/Uncertain/);
 await assert.rejects(runPrunaReview(env,io),/Prior submission uncertain/);
 assert.equal(submissions,1);
});
test('two native-audio tasks archive separately and restart never resubmits',async()=>{
 const objects=new Map();let submissions=0;
 const io={get:async(e,k)=>{if(!objects.has(k))throw {status:404};return objects.get(k);},
 put:async(e,k,b,c)=>{if(c?.ifNoneMatch&&objects.has(k))throw {status:412};objects.set(k,b);},
 wait:async()=>{},inspect:async()=>({width:1344,height:768,duration:5,audioPresent:true}),
 fetch:async(url,request={})=>{
  if(request.method==='POST'){submissions++;const body=JSON.parse(request.body);assert.equal(body.input.mode,'cost');return {ok:true,json:async()=>({id:`id${submissions}`})};}
  if(String(url).includes('/status/'))return {ok:true,json:async()=>({status:'succeeded',generation_url:'https://api.pruna.ai/v1/predictions/delivery/test.mp4'})};
  return {ok:true,headers:new Headers(),body:(async function*(){yield Buffer.from('test-video');})()};}};
 const result=await runPrunaReview(env,io);assert.equal(result.results.length,2);
 await runPrunaReview(env,io);assert.equal(submissions,2);
 assert.deepEqual(result.results.map(x=>x.dialect),['sorani','badini']);
 for(const value of objects.values())assert.ok(!value.toString().includes('PRUNA_API_KEY'));
});

test('verified legacy 401 recovery is exclusive, audited and never retries a new rejection',async()=>{
 const key='evaluations/pruna-native-2026-10-19/sorani.json';
 const objects=new Map([[key,Buffer.from(JSON.stringify({dialect:'sorani',status:'reserved',model:'p-video-2-pro',speechVerified:false}))]]);
 let submissions=0;
 const io={get:async(e,k)=>{if(!objects.has(k))throw {status:404};return objects.get(k);},
 put:async(e,k,b,c)=>{if(c?.ifNoneMatch&&objects.has(k))throw {status:412};objects.set(k,b);},
 fetch:async()=>{submissions++;return {ok:false,status:401};}};
 await assert.rejects(runPrunaReview(env,io),/Prior submission uncertain/);
 assert.equal(submissions,0);
 const recovery={...env,PRUNA_RECONCILE_401:'cb9991d-20261019T165529Z'};
 await assert.rejects(runPrunaReview(recovery,io),/HTTP 401/);
 await assert.rejects(runPrunaReview(recovery,io),/Prior submission uncertain/);
 assert.equal(submissions,1);
 assert.equal(JSON.parse(objects.get(key)).status,'authentication_rejected');
 assert.equal(JSON.parse(objects.get('evaluations/pruna-native-2026-10-19/sorani.401-recovery.json')).httpStatus,401);
});

test('authentication diagnosis only performs a bounded GET and never leaks key',async()=>{
 const result=await probePrunaAuthentication({...env,PRUNA_API_KEY:'  secret-value  '},async(url,request)=>{
  assert.equal(request.method,'GET');assert.equal(request.headers.apikey,'secret-value');
  assert.equal(request.redirect,'error');assert.ok(!request.body);
  assert.ok(url.endsWith('/status/kurdai-auth-probe-does-not-exist'));
  return {status:401};
 });
 assert.equal(result.authenticationRejected,true);assert.equal(result.edgeWhitespace,true);
 assert.equal(result.generationSubmitted,false);assert.ok(!JSON.stringify(result).includes('secret-value'));
});
