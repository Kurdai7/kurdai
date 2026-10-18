import test from 'node:test';
import assert from 'node:assert/strict';
import {finalVideoKey,archiveFinalVideo,restoreFinalVideo} from '../processor/r2-video-archive.js';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const id='123e4567-e89b-42d3-a456-426614174000';
test('private archive uses job-scoped key',()=>{
  assert.equal(finalVideoKey(id),'jobs/'+id+'/final.mp4');
  for(const bad of ['../other','',id+'/../../x','a'.repeat(36)])
    assert.throws(()=>finalVideoKey(bad),/Invalid job ID/);
});
test('archive refuses nonexistent files before attempting network writes',async()=>{
  await assert.rejects(archiveFinalVideo({},id,'/path/that/does/not/exist.mp4'),{code:'ENOENT'});
});
test('restore checks the durable checksum before publishing and preserves existing files',async t=>{
  const root=await mkdtemp(join(tmpdir(),'kurdai-checksum-'));
  const original=globalThis.fetch,bytes=Buffer.from('synthetic archived media');
  const sha=createHash('sha256').update(bytes).digest('hex');
  const env={R2_ENDPOINT:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/',
    R2_BUCKET:'kurdai-videos',R2_ACCESS_KEY_ID:'synthetic',R2_SECRET_ACCESS_KEY:'synthetic'};
  let response=bytes;
  globalThis.fetch=async()=>new Response(response);
  t.after(async()=>{globalThis.fetch=original;await rm(root,{recursive:true,force:true});});
  response=Buffer.from('corrupted archive');
  await assert.rejects(restoreFinalVideo(env,id,root,sha),/checksum mismatch/);
  await assert.rejects(access(join(root,'final.mp4')),{code:'ENOENT'});
  await assert.rejects(restoreFinalVideo(env,id,root,'invalid'),/Invalid archived video checksum/);
  response=bytes;
  assert.equal(await restoreFinalVideo(env,id,root,sha),join(root,'final.mp4'));
  assert.deepEqual(await readFile(join(root,'final.mp4')),bytes);
  await assert.rejects(restoreFinalVideo(env,id,root,sha),{code:'EEXIST'});
  assert.deepEqual(await readFile(join(root,'final.mp4')),bytes);
});
