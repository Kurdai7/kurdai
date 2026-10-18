import test from 'node:test';
import assert from 'node:assert/strict';
import {finalVideoKey,archiveFinalVideo} from '../processor/r2-video-archive.js';
const id='123e4567-e89b-42d3-a456-426614174000';
test('private archive uses job-scoped key',()=>{
  assert.equal(finalVideoKey(id),'jobs/'+id+'/final.mp4');
  for(const bad of ['../other','',id+'/../../x','a'.repeat(36)])
    assert.throws(()=>finalVideoKey(bad),/Invalid job ID/);
});
test('archive refuses nonexistent files before attempting network writes',async()=>{
  await assert.rejects(archiveFinalVideo({},id,'/path/that/does/not/exist.mp4'),{code:'ENOENT'});
});
