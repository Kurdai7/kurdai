import test from 'node:test';
import assert from 'node:assert/strict';
import {adminMonthlyBudgetAllows} from '../spending.js';
import {isVideoAdmin} from '../video-access.js';
import {handleLong} from '../long-video.js';
import {prunaOutputCost,recordPrunaUsage} from '../pruna-pricing.js';
import {quoteNativeCandidate} from '../native-candidate-cost.js';
import {videoCreditPrice} from '../video-credits.js';

test('live customer rate cannot silently underprice the approved packs',()=>{
 assert.throws(()=>videoCreditPrice({STRIPE_MODE:'live',VIDEO_CREDITS_PER_EUR:'10'},
  {canStart:true,totalEUR:.5}),/reviewed credit-pack economics/);
 assert.equal(videoCreditPrice({STRIPE_MODE:'live',VIDEO_CREDITS_PER_EUR:'100'},
  {canStart:true,totalEUR:.5}),50);
});

test('admin budget retains failures, legacy jobs, and uncertain exposure across Helsinki months',()=>{
 const now='2026-10-21T12:00:00Z';
 const j=(amount,extra={})=>({approvedAt:now,approvedTotalEUR:amount,...extra});
 assert.equal(adminMonthlyBudgetAllows({},[j(9.9)],.1,now),true);
 assert.equal(adminMonthlyBudgetAllows({},[j(9.9,{status:'failed'})],.100001,now),false);
 assert.equal(adminMonthlyBudgetAllows({},[j(10,{status:'uncertain'})],.01,now),false);
 assert.equal(adminMonthlyBudgetAllows({},[j(100,{billingClass:'customer'})],.1,now),true);
 assert.equal(adminMonthlyBudgetAllows({},[j(10,{approvedAt:'2026-09-30T20:59:59Z'})],.1,now),true);
 assert.equal(adminMonthlyBudgetAllows({},[j(10,{approvedAt:'2026-09-30T21:00:00Z'})],.1,now),false);
 assert.equal(adminMonthlyBudgetAllows({ADMIN_AI_MAX_MONTH_EUR:'100'},[],10.01,now),false);
 assert.equal(adminMonthlyBudgetAllows({ADMIN_AI_MAX_MONTH_EUR:'1'},[],1.01,now),false);
 assert.equal(adminMonthlyBudgetAllows({},[j(NaN)],.1,now),false);
});

test('verified server-configured admin bypasses purchased credits even when credit charging is enabled',async t=>{
 const env={VIDEO_TEST_EMAIL:'admin@example.test',VIDEO_PURCHASED_CREDITS_ENABLED:'true',
  STRIPE_MODE:'test',LONG_VIDEO_SERVICE_URL:'https://processor.example',LONG_VIDEO_SERVICE_SECRET:'x'.repeat(32),
  DB:{prepare(){throw Error('Purchased-credit database must not be accessed for admin generation');}}};
 const user={id:'admin',email:' Admin@example.test ',verified:true};
 assert.equal(isVideoAdmin(env,user),true);assert.equal(isVideoAdmin(env,{...user,verified:false}),false);
 assert.equal(isVideoAdmin({...env,VIDEO_ADMIN_EMAIL:'someone-else@example.test'},user),false);
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let calls=0;
 globalThis.fetch=async(u,o)=>{calls++;assert.equal(o.headers['X-KurdAI-Billing'],'admin');
  return Response.json({id:'test',canStart:true,totalEUR:.1,apiUSD:.09,status:'running'});};
 const r=await handleLong(new Request('https://kurdai.net/api/long/start',{method:'POST',body:'{}'}),env,user);
 assert.equal(r.status,200);const data=await r.json();assert.equal(data.creditPrice,0);
 assert.equal(data.creditBilling,'admin');assert.equal(data.adminMonthlyLimitEUR,10);assert.equal(calls,1);
});

test('Pruna published base cost stays separate from conservative reservations and invoice reconciliation',()=>{
 assert.equal(prunaOutputCost(5),.075);assert.equal(prunaOutputCost(10),.15);assert.equal(prunaOutputCost(60),.9);
 const job={};recordPrunaUsage(job,'one',5.04);recordPrunaUsage(job,'one',5.04);
 recordPrunaUsage(job,'two',10);
 assert.equal(job.providerUsage.prunaTasks.length,2);assert.equal(job.providerUsage.prunaOutputUSD,.24);
 assert.equal(job.providerUsage.prunaTasks[0].invoiceVerified,false);
 const quote=quoteNativeCandidate({model:'p-video-2',duration:60,resolution:'704p',language:'sorani'});
 assert.deepEqual(quote.segmentDurations,[20,20,20]);assert.equal(quote.providerReference.outputUSD,.9);
 assert.equal(quote.apiUSD,.945);assert.equal(quote.providerReference.invoiceVerified,false);
});
