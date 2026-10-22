import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProcessor} from '../processor/server.js';
import {memoryJobStorage,durableTestFlags} from './helpers/r2-memory.js';

test('public readiness reports the selected Pruna route without authorizing spending or leaking credentials',async t=>{
 const root=await mkdtemp(join(tmpdir(),'kurdai-pruna-readiness-'));
 const config={...durableTestFlags,LONG_DATA_DIR:root,LONG_VIDEO_SERVICE_SECRET:'synthetic-service-secret-'.repeat(3),
  PRUNA_API_KEY:'synthetic-pruna-key',PRUNA_NATIVE_ENABLED:'true',NATIVE_GENERATION_ENABLED:'true',NATIVE_BILLING_VERIFIED:'true',
  LONG_USD_PER_EUR:'1.1',LONG_MEDIA_EUR:'0.01',LONG_FX_PERCENT:'0',LONG_VAT_PERCENT:'0',BILLABLE_REQUESTS_ENABLED:'false'};
 const processor=await createProcessor(config,{jobStorage:memoryJobStorage()});
 await new Promise(resolve=>processor.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>processor.server.close(resolve));await processor.close();await rm(root,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${processor.server.address().port}/readiness`;
 const first=await(await fetch(url)).json();
 assert.equal(first.selectedVideoModel,'p-video-2');
 assert.equal(first.prunaSetup.apiKeyPresent,true);
 assert.equal(first.prunaVideoReady,false);
 assert.ok(first.prunaSetup.pendingSetup.includes('api_spending_disabled'));
 assert.deepEqual(first.prunaSetup.missingCostSettings,[]);
 assert.ok(!JSON.stringify(first).includes(config.PRUNA_API_KEY));
 assert.ok(!JSON.stringify(first).includes(config.LONG_VIDEO_SERVICE_SECRET));
 delete config.LONG_FX_PERCENT;
 const second=await(await fetch(url)).json();
 assert.deepEqual(second.prunaSetup.missingCostSettings,['LONG_FX_PERCENT']);
 assert.equal(second.prunaVideoReady,false);
 assert.equal(second.paidGenerationRequestsVerified,false);
});
