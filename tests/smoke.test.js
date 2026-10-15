import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProcessor} from '../processor/server.js';
import {handleLong} from '../long-video.js';
import {duration} from '../processor/media.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('owner-only free smoke traverses Worker and processor, yields a real voiced 70s MP4 without provider requests',async t=>{
  const root=await mkdtemp(join(tmpdir(),'kurdai-free-smoke-'));
  const secret='synthetic-test-secret-'.repeat(3);
  // Every paid feature remains disabled; no provider credentials are configured.
  const processor=await createProcessor({LONG_DATA_DIR:root,LONG_VIDEO_SERVICE_SECRET:secret});
  await new Promise(resolve=>processor.server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${processor.server.address().port}`,realFetch=globalThis.fetch;
  let providerCalls=0;
  globalThis.fetch=(url,options)=>{
    const u=new URL(url);
    if(u.origin!=='https://processor.test') {providerCalls++;throw Error('Network/provider request forbidden');}
    return realFetch(origin+u.pathname+u.search,options);
  };
  t.after(async()=>{globalThis.fetch=realFetch;await new Promise(resolve=>processor.server.close(resolve));await processor.close();await rm(root,{recursive:true,force:true});});
  const owner={id:'owner',email:'owner@example.test',verified:true};
  const env={VIDEO_TEST_EMAIL:owner.email,LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:secret};
  const request=(path,data,user=owner)=>handleLong(new Request('https://kurdai.net/api/long/'+path,data?{method:'POST',body:JSON.stringify(data)}:{}),env,user);
  assert.equal((await request('smoke',{aspectRatio:'16:9'},null)).status,401);
  assert.equal((await request('smoke',{aspectRatio:'16:9'},{...owner,email:'other@example.test'})).status,403);
  assert.equal((await request('smoke',{aspectRatio:'bad'})).status,400);
  for(const ratio of ['16:9','9:16']) {
    const first=await(await request('smoke',{aspectRatio:ratio})).json();
    assert.equal(first.model,'synthetic-test-no-ai');assert.equal(first.quote.totalEUR,0);
    assert.equal((await(await request('smoke',{aspectRatio:ratio})).json()).id,first.id);
    assert.equal((await request('status?id='+first.id,undefined,{...owner,id:'another'})).status,404);
    for(let i=0;i<15;i++) await processor.tick();
    const ready=await(await request('status?id='+first.id)).json();
    assert.equal(ready.status,'ready');assert.equal(ready.completedSegments,14);assert.equal(ready.reservedAPIUSD,0);
    assert.ok(Math.abs(await duration(join(root,first.id,'final.mp4'))-70)<0.08);
    const {stdout}=await promisify(execFile)('ffprobe',['-v','error','-show_streams','-of','json',join(root,first.id,'final.mp4')]);
    const streams=JSON.parse(stdout).streams,video=streams.find(s=>s.codec_type==='video');
    assert.ok(streams.some(s=>s.codec_type==='audio'));
    assert.equal(video.width,ratio==='16:9'?480:270);
    const download=await request(ready.videoUrl.replace('/api/long/',''));
    assert.equal(download.headers.get('content-type'),'video/mp4');
    assert.ok((await download.arrayBuffer()).byteLength>1000);
  }
  assert.equal(providerCalls,0);
});
