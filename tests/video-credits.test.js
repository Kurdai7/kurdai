import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {reserveVideoCredits,settleVideoCredits,videoCreditPrice} from '../video-credits.js';
import {BILLING_SCHEMA} from '../billing.js';
import {handleLong} from '../long-video.js';

async function setup(t) {
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,
    script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-25',d1Databases:['DB']}));
  t.after(()=>mf.dispose()); const db=await mf.getD1Database('DB');
  await db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY)').run();
  await db.prepare("INSERT INTO users VALUES ('owner'),('other')").run();
  await db.batch(BILLING_SCHEMA.map(sql=>db.prepare(sql)));
  await db.prepare("INSERT INTO billing_ledger VALUES ('purchase','owner','test',100,'stripe_purchase',1)").run();
  return db;
}
const balance=async(db,mode='test')=>(await db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM billing_ledger WHERE user_id=? AND mode=?').bind('owner',mode).first()).n;
test('actual D1: concurrent video requests cannot overspend or debit a replay twice',async t=>{
  const db=await setup(t),a=crypto.randomUUID(),b=crypto.randomUUID();
  const results=await Promise.allSettled([reserveVideoCredits(db,'owner','test',a,70),reserveVideoCredits(db,'owner','test',b,70)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await balance(db),30);
  const winner=results[0].status==='fulfilled'?a:b;
  await assert.rejects(reserveVideoCredits(db,'owner','test',winner,71),/price changed/);
  await Promise.all(Array.from({length:8},()=>reserveVideoCredits(db,'owner','test',winner,70)));
  assert.equal(await balance(db),30);
  await assert.rejects(reserveVideoCredits(db,'owner','live',crypto.randomUUID(),1),e=>e.status===402);
  await assert.rejects(reserveVideoCredits(db,'other','test',crypto.randomUUID(),1),e=>e.status===402);
});
test('actual D1: failure refunds exactly once; uncertainty holds; delivery cannot be refunded later',async t=>{
  const db=await setup(t),id=crypto.randomUUID();
  await reserveVideoCredits(db,'owner','test',id,70);
  await settleVideoCredits(db,'owner','test',id,'uncertain'); assert.equal(await balance(db),30);
  await Promise.all(Array.from({length:8},()=>settleVideoCredits(db,'owner','test',id,'failed')));
  assert.equal(await balance(db),100);
  await assert.rejects(reserveVideoCredits(db,'owner','test',id,70),/refunded/);
  const delivered=crypto.randomUUID();await reserveVideoCredits(db,'owner','test',delivered,50);
  await settleVideoCredits(db,'owner','test',delivered,'ready');
  await settleVideoCredits(db,'owner','test',delivered,'failed');assert.equal(await balance(db),50);
  await assert.rejects(reserveVideoCredits(db,'owner','test',crypto.randomUUID(),20,false),e=>e.status===402);
});
test('retail credit pricing requires explicit configuration and a startable server quote',()=>{
  assert.equal(videoCreditPrice({VIDEO_CREDITS_PER_EUR:'100'},{totalEUR:0.4527,canStart:true}),46);
  for(const quote of [{totalEUR:null,canStart:true},{totalEUR:1,canStart:false},{totalEUR:NaN,canStart:true}])
    assert.throws(()=>videoCreditPrice({VIDEO_CREDITS_PER_EUR:'100'},quote));
  assert.throws(()=>videoCreditPrice({},{totalEUR:1,canStart:true}));
});
test('proxy: server quote controls debit; lost response holds funds; status reconciles failure',async t=>{
  const db=await setup(t),id=crypto.randomUUID(),quote={totalEUR:0.7,canStart:true};
  const env={DB:db,VIDEO_TEST_EMAIL:'owner@example.test',LONG_VIDEO_SERVICE_URL:'https://processor.example.test',
    LONG_VIDEO_SERVICE_SECRET:'s'.repeat(32),STRIPE_MODE:'test',VIDEO_PURCHASED_CREDITS_ENABLED:'true',VIDEO_CREDITS_PER_EUR:'100'};
  const user={id:'owner',email:env.VIDEO_TEST_EMAIL,verified:true};
  let starts=0,lost=true,state='quoted';
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async(url,options)=>{
    assert.equal(options.headers['X-KurdAI-Owner'],'owner');
    if(new URL(url).pathname==='/v1/start') {starts++;state='running';if(lost)throw new TypeError('lost response');}
    return Response.json({id,status:state,quote});
  };
  const start=approvedCredits=>handleLong(new Request('https://kurdai.net/api/long/start',{method:'POST',body:JSON.stringify({id,approved:true,approvedTotalEUR:0.7,approvedCredits})}),env,user);
  assert.equal((await start(1)).status,409);assert.equal(starts,0);assert.equal(await balance(db),100);
  assert.equal((await start(70)).status,503);assert.equal(starts,1);assert.equal(await balance(db),30);
  lost=false;assert.equal((await start(70)).status,200);assert.equal(await balance(db),30);
  state='failed';const status=()=>handleLong(new Request('https://kurdai.net/api/long/status?id='+id),env,user);
  assert.equal((await status()).status,200);await status();assert.equal(await balance(db),100);
});
