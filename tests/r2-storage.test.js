import test from 'node:test';
import assert from 'node:assert/strict';
import {putR2Object,getR2Object,checkR2Object,deleteR2Object} from '../processor/r2-storage.js';
const env={R2_ENDPOINT:'https://6ce5ce0077cd8bab866c919a889bcb5e.r2.cloudflarestorage.com/',
  R2_BUCKET:'kurdai-videos',R2_ACCESS_KEY_ID:'test-access',R2_SECRET_ACCESS_KEY:'test-secret'};
test('R2 requests use private SigV4 headers and bucket-scoped paths',async()=>{
  const original=globalThis.fetch, calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url:String(url),options});
    return {ok:true,status:200,body:{cancel:async()=>{}},arrayBuffer:async()=>new TextEncoder().encode('video').buffer};
  };
  try {
    await putR2Object(env,'jobs/123/clip-0.mp4',Buffer.from('video'));
    const data=await getR2Object(env,'jobs/123/clip-0.mp4');
    assert.equal(data.toString(),'video');
    assert.equal(await checkR2Object(env,'jobs/123/clip-0.mp4'),true);
    assert.deepEqual(calls.map(c=>c.options.method),['PUT','GET','HEAD']);
    for(const call of calls) {
      assert.equal(call.url,env.R2_ENDPOINT+'kurdai-videos/jobs/123/clip-0.mp4');
      assert.match(call.options.headers.authorization,/^AWS4-HMAC-SHA256 Credential=test-access\//);
      assert.equal(call.options.headers.host,'6ce5ce0077cd8bab866c919a889bcb5e.r2.cloudflarestorage.com');
      assert.equal(call.options.redirect,'error');
    }
  } finally {globalThis.fetch=original;}
});
test('R2 refuses unsafe keys and endpoints before network access',async()=>{
  for(const key of ['../secret','jobs//file','/absolute','a?x=1']) {
    await assert.rejects(putR2Object(env,key,'x'),/Invalid object key/);
  }
  await assert.rejects(putR2Object({...env,R2_ENDPOINT:'https://example.com/'},'safe','x'),/Invalid Cloudflare R2 endpoint/);
  await assert.rejects(putR2Object({...env,R2_BUCKET:'other/bucket'},'safe','x'),/Invalid bucket/);
});
test('R2 failed writes do not masquerade as success',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:false,status:403,body:{cancel:async()=>{}}});
  try {await assert.rejects(putR2Object(env,'jobs/a','x'),/HTTP 403/);}
  finally {globalThis.fetch=original;}
});

test('R2 DELETE uses a signed request and rejects failed cleanup',async()=>{
  const original=globalThis.fetch;
  let method;
  globalThis.fetch=async(_url,options)=>{method=options.method;return {ok:true,status:204,body:{cancel:async()=>{}}};};
  try {await deleteR2Object(env,'probes/abc');assert.equal(method,'DELETE');}
  finally {globalThis.fetch=original;}
  globalThis.fetch=async()=>({ok:false,status:403,body:{cancel:async()=>{}}});
  try {await assert.rejects(deleteR2Object(env,'probes/abc'),/HTTP 403/);}
  finally {globalThis.fetch=original;}
});
