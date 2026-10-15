import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import Stripe from 'stripe';
import {handleBilling,billingConfiguration,BILLING_SCHEMA} from '../billing.js';
function database() {
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('schema.sql','utf8'));
 db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run('owner','owner@example.test','hash',1,'2026-10-15');
 const prepare=sql=>{let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};};
 let queue=Promise.resolve();
 return {raw:db,prepare,batch(statements){const task=queue.then(async()=>{db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}});queue=task.catch(()=>{});return task;}};
}
const owner={id:'owner',email:'owner@example.test',verified:true};
const secret='whsec_syntheticOnlySecret';
const env=()=>({DB:database(),STRIPE_MODE:'test',STRIPE_RESTRICTED_KEY:'rk_test_syntheticOnly',STRIPE_WEBHOOK_SECRET:secret,
 STRIPE_CREDIT_PACKS:JSON.stringify([{id:'small',priceId:'price_testA',amountCents:200,credits:200},{id:'large',priceId:'price_testB',amountCents:500,credits:500}]),
 STRIPE_CHECKOUT_ENABLED:'true',VIDEO_TEST_EMAIL:owner.email});
const request=(path,body,headers={})=>new Request('https://kurdai.net/api/billing/'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});
function mockClient() {
 const sessions=new Map(),idempotent=new Map();let submissions=0;
 return {sessions,get submissions(){return submissions;},webhooks:new Stripe('rk_test_syntheticOnly').webhooks,
 checkout:{sessions:{async create(params,options){
  assert.equal(params.mode,'payment');assert.ok(!('payment_method_types' in params));assert.ok(!params.automatic_tax);assert.ok(!params.managed_payments);
  assert.match(params.integration_identifier,/_([a-z]{8})$/);
  if(idempotent.has(options.idempotencyKey))return idempotent.get(options.idempotencyKey);
  submissions++;const id='cs_test_'+submissions;
  const price=params.line_items[0].price;
  const s={id,livemode:false,mode:'payment',metadata:params.metadata,client_reference_id:params.client_reference_id,
   currency:'eur',amount_total:price==='price_testA'?200:500,payment_status:'unpaid',status:'open',url:'https://checkout.stripe.com/c/pay/'+id,
   line_items:{has_more:false,data:[{quantity:1,price:{id:price}}]}};
  sessions.set(id,s);idempotent.set(options.idempotencyKey,s);return s;
 },async retrieve(id){assert.ok(sessions.has(id));return sessions.get(id);}}}};
}
async function signedEvent(client,session,type='checkout.session.completed',overrides={}) {
 const body=JSON.stringify({id:'evt_'+crypto.randomUUID(),type,livemode:false,data:{object:session},...overrides});
 const header=await client.webhooks.generateTestHeaderStringAsync({payload:body,secret,cryptoProvider:Stripe.createSubtleCryptoProvider()});
 return request('webhook',body,{'stripe-signature':header});
}
test('billing config fails closed and live credentials require independent release approval',()=>{
 assert.equal(billingConfiguration({}).enabled,false);
 const config=env();assert.equal(billingConfiguration(config).enabled,true);
 assert.equal(billingConfiguration({...config,STRIPE_MODE:'live'}).configured,false);
 assert.equal(billingConfiguration({...config,STRIPE_MODE:'live',STRIPE_RESTRICTED_KEY:'rk_live_syntheticOnly'}).enabled,false);
 for(const packs of ['bad','{}','[{"id":"unsafe"}]'])assert.equal(billingConfiguration({...config,STRIPE_CREDIT_PACKS:packs}).enabled,false);
});
test('unsigned public webhooks cannot trigger database work or provider calls',async()=>{
 const config=env(),client=mockClient();let databaseCalls=0;
 config.DB={prepare(){databaseCalls++;throw Error('Unsigned webhook reached database');},batch(){databaseCalls++;throw Error('Unsigned webhook reached database');}};
 const response=await handleBilling(request('webhook',{type:'checkout.session.completed'}),config,null,{client});
 assert.equal(response.status,400);assert.equal(databaseCalls,0);assert.equal(client.submissions,0);
});
test('Checkout binds one immutable order to a verified user and survives concurrent replay',async()=>{
 const config=env(),client=mockClient(),body={requestId:crypto.randomUUID(),packId:'small',amountCents:1,credits:999999};
 assert.equal((await handleBilling(request('checkout',body),config,null,{client})).status,401);
 assert.equal((await handleBilling(request('checkout',body),config,{...owner,verified:false},{client})).status,403);
 assert.equal((await handleBilling(request('checkout',body),config,{...owner,email:'different@example.test'},{client})).status,403);
 const responses=await Promise.all([handleBilling(request('checkout',body),config,owner,{client}),handleBilling(request('checkout',body),config,owner,{client})]);
 const orders=await Promise.all(responses.map(r=>r.json()));assert.equal(client.submissions,1);assert.equal(orders[0].orderId,orders[1].orderId);
 const row=config.DB.raw.prepare('SELECT * FROM billing_orders').get();assert.equal(row.amount_cents,200);assert.equal(row.credits,200);
 assert.equal((await handleBilling(request('checkout',{...body,packId:'large'}),config,owner,{client})).status,409);
 assert.equal((await handleBilling(request('order?id='+row.id),config,{...owner,id:'another'},{client})).status,404);
 const balance=await(await handleBilling(request('balance'),config,owner,{client})).json();assert.equal(balance.credits,0);
});
test('signed webhook fulfills paid sessions exactly once across delayed, duplicate, concurrent and cross-mode events',async()=>{
 const config=env(),client=mockClient();
 await handleBilling(request('checkout',{requestId:crypto.randomUUID(),packId:'small'}),config,owner,{client});
 const session=client.sessions.values().next().value;
 const deliver=async(type,overrides)=>handleBilling(await signedEvent(client,session,type,overrides),config,null,{client});
 assert.equal((await deliver('checkout.session.completed')).status,200);
 assert.equal(config.DB.raw.prepare('SELECT COUNT(*) AS n FROM billing_ledger').get().n,0);
 session.payment_status='paid';session.status='complete';
 const out=await Promise.all([deliver('checkout.session.async_payment_succeeded'),deliver('checkout.session.completed'),deliver('checkout.session.completed')]);
 assert.ok(out.every(r=>r.status===200));
 assert.equal(config.DB.raw.prepare('SELECT SUM(amount) AS credits FROM billing_ledger').get().credits,200);
 assert.equal(config.DB.raw.prepare('SELECT COUNT(*) AS n FROM credit_ledger').get().n,0);
 assert.equal((await deliver('checkout.session.completed',{livemode:true})).status,400);
 config.STRIPE_CHECKOUT_ENABLED='false';config.STRIPE_CREDIT_PACKS='[]';
 assert.equal((await deliver('checkout.session.completed')).status,200);
 assert.equal(config.DB.raw.prepare('SELECT COUNT(*) AS n FROM billing_ledger').get().n,1);
});
test('signature, body alteration, stale timestamps and mismatched paid totals cannot grant credits',async()=>{
 const config=env(),client=mockClient();
 await handleBilling(request('checkout',{requestId:crypto.randomUUID(),packId:'small'}),config,owner,{client});
 const session=client.sessions.values().next().value;session.payment_status='paid';
 const signed=await signedEvent(client,session),raw=await signed.text();
 assert.equal((await handleBilling(request('webhook',raw+' ',{'stripe-signature':signed.headers.get('stripe-signature')}),config,null,{client})).status,400);
 const stale=await client.webhooks.generateTestHeaderStringAsync({payload:raw,secret,timestamp:Math.floor(Date.now()/1000)-600,cryptoProvider:Stripe.createSubtleCryptoProvider()});
 assert.equal((await handleBilling(request('webhook',raw,{'stripe-signature':stale}),config,null,{client})).status,400);
 session.amount_total=1;
 assert.equal((await handleBilling(await signedEvent(client,session),config,null,{client})).status,409);
 session.amount_total=200;session.line_items.data[0].price.id='price_wrong';
 assert.equal((await handleBilling(await signedEvent(client,session),config,null,{client})).status,409);
 assert.equal(config.DB.raw.prepare('SELECT COUNT(*) AS n FROM billing_ledger').get().n,0);
});
test('webhook handles race with session persistence without overwriting paid status',async()=>{
 const config=env(),client=mockClient();await config.DB.batch(BILLING_SCHEMA.map(sql=>config.DB.prepare(sql)));
 const id=crypto.randomUUID();
 await config.DB.prepare(`INSERT INTO billing_orders (id,user_id,mode,request_id,pack_id,price_id,amount_cents,credits,created_at) VALUES (?,'owner','test',?,'small','price_testA',200,200,?)`).bind(id,crypto.randomUUID(),Math.floor(Date.now()/1000)).run();
 const session=await client.checkout.sessions.create({mode:'payment',integration_identifier:'kurdai_checkout_rhvtzqmp',metadata:{app:'kurdai',order_id:id},client_reference_id:id,line_items:[{price:'price_testA'}]},{idempotencyKey:id});
 session.payment_status='paid';
 assert.equal((await handleBilling(await signedEvent(client,session),config,null,{client})).status,200);
 assert.equal(config.DB.raw.prepare('SELECT status FROM billing_orders').get().status,'paid');
});
