import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spendingPolicy, budgetAllows } from '../spending.js';
import { createProcessor } from '../processor/server.js';
import { save } from '../processor/engine.js';
import { OMNI_MODEL } from '../omni-cost.js';

test('spending fails closed for missing, malformed and zero limits',()=>{
  assert.equal(spendingPolicy({}).enabled,false);
  const base={BILLABLE_REQUESTS_ENABLED:'true',API_MAX_JOB_USD:'2',API_MAX_DAY_USD:'3'};
  for(const value of ['', ' ', 'Infinity','NaN','-1','0','2e2',true,null])
    assert.equal(budgetAllows(spendingPolicy({...base,API_MAX_JOB_USD:value}),1),false);
  assert.equal(budgetAllows(spendingPolicy(base),2,1),true);
  assert.equal(budgetAllows(spendingPolicy(base),2,1.000001),false);
  assert.equal(budgetAllows(spendingPolicy(base),NaN),false);
});

const input={model:OMNI_MODEL,prompt:'Animated family walks through a forest.',identity:'Same blue clothes.',
  duration:5,resolution:'720p',aspectRatio:'16:9',language:'sorani',dialogueText:'با بڕۆین.'};
const configFor=root=>({LONG_DATA_DIR:root,LONG_VIDEO_SERVICE_SECRET:'test-only-secret-'.repeat(3),
  GEMINI_API_KEY:'dummy',OMNI_GENERATION_ENABLED:'true',OMNI_BILLING_VERIFIED:'true',LONG_DURABLE_STORAGE:'true',
  OMNI_INPUT_TOKENS_PER_SEGMENT:'10000',OMNI_TEXT_TOKENS_PER_SEGMENT:'1000',LONG_MEDIA_EUR:'0.01',LONG_FX_PERCENT:'0',LONG_VAT_PERCENT:'0'});
async function setup(t,config) {
  const processor=await createProcessor(config,{omni:{client:{submit(){throw Error('Paid call forbidden');}}}});
  await new Promise(r=>processor.server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>processor.server.close(r));await processor.close();await rm(config.LONG_DATA_DIR,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${processor.server.address().port}`;
  return {processor,request:(path,body)=>fetch(origin+'/v1/'+path,{method:body?'POST':'GET',
    headers:{authorization:`Bearer ${config.LONG_VIDEO_SERVICE_SECRET}`,'x-kurdai-owner':'owner'},body:body?JSON.stringify(body):undefined})};
}

test('processor default zero spend blocks approvals and bounds stored quote uploads and write bursts',async t=>{
  const root=await mkdtemp(join(tmpdir(),'kurdai-limits-'));
  const {request,processor}=await setup(t,configFor(root));
  let q;
  for(let i=0;i<12;i++) q=await(await request('quote',input)).json();
  assert.equal(q.canStart,false);
  assert.equal((await request('start',{id:q.id,approved:true,approvedTotalEUR:q.totalEUR})).status,409);
  assert.equal((await readdir(root)).filter(s=>/^[a-f0-9-]{36}$/.test(s)).length,10);
  for(let i=0;i<7;i++) await request('quote',input);
  const blocked=await request('quote',input);
  assert.equal(blocked.status,429);assert.ok(blocked.headers.get('retry-after'));
  await processor.tick();
});

test('processor restores reservations from persisted failed jobs before accepting new spend',async t=>{
  const root=await mkdtemp(join(tmpdir(),'kurdai-ledger-'));
  const id=randomUUID();
  await save({id,owner:'owner',input,status:'failed',approvedAt:new Date().toISOString(),quote:{apiUSD:2}},join(root,id));
  const config={...configFor(root),BILLABLE_REQUESTS_ENABLED:'true',API_MAX_JOB_USD:'2',API_MAX_DAY_USD:'2'};
  const {request}=await setup(t,config);
  const q=await(await request('quote',input)).json();assert.equal(q.canStart,true);
  const response=await request('start',{id:q.id,approved:true,approvedTotalEUR:q.totalEUR});
  assert.equal(response.status,409);assert.match((await response.json()).error,/Daily API reservation/);
});
