import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {openJobStore} from '../processor/r2-job-store.js';
import {createProcessor} from '../processor/server.js';
import {duration} from '../processor/media.js';
const digest=b=>createHash('sha256').update(b).digest('hex');
function transport() {
  const objects=new Map();let fail=false;
  return {objects,get fail(){return fail;},set fail(v){fail=v;},
    async read(_env,key){const row=objects.get(key);if(!row)throw Object.assign(new Error('missing'),{status:404});return {bytes:Buffer.from(row.bytes),etag:row.etag};},
    async put(_env,key,bytes,condition){
      if(fail)throw new Error('unavailable');const old=objects.get(key);
      if((condition.ifNoneMatch==='*' && old) || (condition.ifMatch && old?.etag!==condition.ifMatch))
        throw Object.assign(new Error('conflict'),{status:412});
      const etag='"'+randomUUID()+'"';objects.set(key,{bytes:Buffer.from(bytes),etag});return etag;
    }
  };
}
test('manifest CAS fences old instances and persists single paid-test reservation',async()=>{
  const storage=transport();const a=await openJobStore({},storage);
  await a.reservePaidTest([]);
  const b=await openJobStore({},storage);assert.equal(b.paidTestReserved,true);
  await assert.rejects(a.save([]),/blocked/);assert.equal(a.healthy,false);
  await assert.rejects(b.reservePaidTest([]),/already reserved/);
  storage.fail=true;await assert.rejects(b.save([]),/blocked/);storage.fail=false;
  await assert.rejects(b.save([]),/reconciliation/);
});
test('corrupt or unreadable durable state fails closed instead of starting an empty ledger',async()=>{
  for(const bytes of ['not json',JSON.stringify({version:1,jobs:[{id:'../x'}],paidTestReserved:false})]) {
    const storage=transport();storage.objects.set('processor/job-state-v1.json',{bytes:Buffer.from(bytes),etag:'"x"'});
    await assert.rejects(openJobStore({},storage));
  }
  await assert.rejects(openJobStore({}, {read:async()=>{throw Object.assign(new Error('forbidden'),{status:403});}}));
});
test('real synthetic 70s MP4 and metadata survive an empty disk; paid jobs never resubmit after restart',async t=>{
  const root=await mkdtemp(join(tmpdir(),'kurdai-r2-recovery-')),storage=transport();
  const config={LONG_DATA_DIR:join(root,'data'),LONG_VIDEO_SERVICE_SECRET:'test-secret-'.repeat(4),
    R2_JOB_METADATA_ENABLED:'true',R2_VIDEO_ARCHIVE_ENABLED:'true',R2_ENDPOINT:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/',
    R2_BUCKET:'kurdai-videos',R2_ACCESS_KEY_ID:'synthetic',R2_SECRET_ACCESS_KEY:'synthetic'};
  let processor;const original=globalThis.fetch;let paidCalls=0;
  globalThis.fetch=async(url,options={})=>{
    const u=new URL(url);
    if(!u.hostname.endsWith('.r2.cloudflarestorage.com')) {paidCalls++;throw new Error('External provider forbidden');}
    const key=u.pathname.split('/').slice(2).join('/');
    if(options.method==='PUT'){await storage.put({},key,options.body,{});return new Response(null,{status:200});}
    const row=storage.objects.get(key);return row?new Response(row.bytes,{status:200}):new Response(null,{status:404});
  };
  const start=async()=>{
    processor=await createProcessor(config,{jobStorage:storage});
    await new Promise(r=>processor.server.listen(0,'127.0.0.1',r));
  };
  const close=async()=>{if(processor){await new Promise(r=>processor.server.close(r));await processor.close();processor=null;}};
  t.after(async()=>{globalThis.fetch=original;await close();await rm(root,{recursive:true,force:true});});
  const call=async(path,body,owner='owner')=>original('http://127.0.0.1:'+processor.server.address().port+'/v1/'+path,{
    method:body?'POST':'GET',headers:{authorization:'Bearer '+config.LONG_VIDEO_SERVICE_SECRET,'x-kurdai-owner':owner,'content-type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{})});
  await start();const created=await(await call('smoke',{aspectRatio:'16:9'})).json();
  // Lose partial synthetic clips too: safe synthetic generation resumes from zero.
  await processor.tick();await close();await rm(config.LONG_DATA_DIR,{recursive:true,force:true});await start();
  for(let i=0;i<15;i++)await processor.tick();
  const ready=await(await call('status?id='+created.id)).json();assert.equal(ready.status,'ready');
  const originalFile=Buffer.from(await(await call('file?id='+created.id)).arrayBuffer());
  assert.ok(storage.objects.has('jobs/'+created.id+'/final.mp4'));
  // Persist a simulated interrupted paid POST without contacting any provider.
  await close();const state=await openJobStore(config,storage),interrupted=randomUUID();
  await state.save([...state.jobs,{id:interrupted,owner:'owner',input:{model:'gemini-omni-1.1-flash',duration:5},
    status:'running',completedSegments:0,inflight:{state:'submitting'},quote:{apiUSD:0.1},approvedAt:new Date().toISOString(),reservedAPIUSD:0.1}]);
  await rm(config.LONG_DATA_DIR,{recursive:true,force:true});await start();
  const restored=await(await call('status?id='+created.id)).json();assert.equal(restored.status,'ready');
  const downloaded=Buffer.from(await(await call('file?id='+created.id)).arrayBuffer());assert.equal(digest(downloaded),digest(originalFile));
  const target=join(root,'verified.mp4');await writeFile(target,downloaded);assert.ok(Math.abs((await duration(target))-70)<0.1);
  assert.equal((await call('file?id='+created.id,null,'other')).status,404);
  const held=await(await call('status?id='+interrupted)).json();assert.equal(held.status,'uncertain');
  assert.equal((await(await call('start',{id:interrupted,approved:true})).json()).status,'uncertain');
  await processor.tick();assert.equal(paidCalls,0);
  const repeated=await(await call('smoke',{aspectRatio:'16:9'})).json();assert.equal(repeated.id,created.id);
  // A corrupt remote object must not become a downloadable cached file.
  await rm(join(config.LONG_DATA_DIR,created.id,'final.mp4'));
  const archive=storage.objects.get('jobs/'+created.id+'/final.mp4'),saved=archive.bytes;
  archive.bytes=Buffer.from('corrupted archive');
  assert.equal((await call('file?id='+created.id)).status,500);
  await assert.rejects(readFile(join(config.LONG_DATA_DIR,created.id,'final.mp4')),{code:'ENOENT'});
  archive.bytes=saved;
  const recovered=await call('file?id='+created.id);assert.equal(recovered.status,200);
  assert.equal(digest(Buffer.from(await recovered.arrayBuffer())),digest(originalFile));
  assert.equal(paidCalls,0);
});
