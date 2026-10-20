import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createProcessor} from '../processor/server.js';
import {save} from '../processor/engine.js';

test('Pruna extension quotes enforce ownership and source settings, deriving the actual retained final frame without AI calls',async t=>{
 const root=await mkdtemp(join(tmpdir(),'pruna-extension-')),id='11111111-1111-4111-8111-111111111111',dir=join(root,id),secret='local-test-only-'.repeat(4);
 const input={model:'p-video-2',duration:4,resolution:'704p',aspectRatio:'16:9',language:'sorani',prompt:'Continue walking',identity:'A family in Kurdish clothes',dialogueText:'سڵاو'};
 await save({id,owner:'owner',status:'ready',input,completedSegments:1},dir);
 await promisify(execFile)('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=blue:s=1280x704:r=24','-t','0.1','-c:v','libx264','-pix_fmt','yuv420p',join(dir,'final.mp4')]);
 const processor=await createProcessor({LONG_DATA_DIR:root,LONG_VIDEO_SERVICE_SECRET:secret});
 await new Promise(resolve=>processor.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>processor.server.close(resolve));await processor.close();await rm(root,{recursive:true,force:true});});
 const endpoint=`http://127.0.0.1:${processor.server.address().port}/v1/quote`;
 const request=(owner,extra={})=>fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${secret}`,'x-kurdai-owner':owner,'content-type':'application/json'},body:JSON.stringify({...input,mode:'extension',sourceJobId:id,...extra})});
 assert.equal((await request('stranger')).status,404);
 assert.equal((await request('owner',{language:'badini'})).status,409);
 assert.equal((await request('owner',{aspectRatio:'9:16'})).status,409);
 const response=await request('owner',{identity:'untrusted replacement',previousInteractionId:'untrusted'});assert.equal(response.status,200);
 const quote=await response.json();assert.equal(quote.canStart,false);
 const job=JSON.parse(await readFile(join(root,quote.id,'job.json')));
 assert.equal(job.input.identity,input.identity);assert.match(job.input.image,/^data:image\/jpeg;base64,/);assert.equal(job.previousInteractionId,undefined);
 assert.equal(job.status,'quoted');assert.equal(job.reservedAPIUSD,0);
});
