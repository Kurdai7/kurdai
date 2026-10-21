import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Stripe from 'stripe';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {TEST_CREDIT_PACKS} from '../billing-packs.js';

for (const pack of TEST_CREDIT_PACKS) test(`actual Worker/D1: EUR${pack.amountCents/100} grants ${pack.credits} test credits exactly once`,async t=>{
 const bundle=await build({entryPoints:['worker.js'],bundle:true,write:false,format:'esm',platform:'browser'});
 const sessions=new Map();let providerCreates=0;
 const secret='whsec_syntheticOnlySecret',token='test-only-owner-session';
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,
  compatibilityDate:'2026-09-25',d1Databases:['DB'],bindings:{VIDEO_TEST_EMAIL:'owner@example.test',
   STRIPE_MODE:'test',STRIPE_RESTRICTED_KEY:' \nrk_test_syn\nthetic\tOnly\n ',STRIPE_WEBHOOK_SECRET:secret,STRIPE_CHECKOUT_ENABLED:'true',
   STRIPE_CREDIT_PACKS:JSON.stringify(TEST_CREDIT_PACKS)},
  outboundService:async request=>{
   const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com');
   assert.equal(request.headers.get('authorization'),'Bearer rk_test_syntheticOnly');
   if(request.method==='POST') {
    providerCreates++;assert.equal(url.pathname,'/v1/checkout/sessions');
    assert.ok(request.headers.get('idempotency-key'));
    const form=new URLSearchParams(await request.text());assert.equal(form.get('mode'),'payment');
    assert.equal(form.get('line_items[0][price]'),pack.priceId);assert.equal(form.get('payment_method_types'),null);
    const id='cs_test_worker1',orderId=form.get('client_reference_id');
    const session={id,object:'checkout.session',livemode:false,mode:'payment',currency:'eur',amount_total:pack.amountCents,
     status:'open',payment_status:'unpaid',metadata:{app:'kurdai',order_id:orderId},client_reference_id:orderId,
     url:'https://checkout.stripe.com/c/pay/'+id,line_items:{data:[{quantity:1,price:{id:pack.priceId}}],has_more:false}};
    sessions.set(id,session);return Response.json(session);
   }
   assert.equal(request.method,'GET');return Response.json(sessions.get('cs_test_worker1'));
  }}));
 t.after(()=>mf.dispose());const db=await mf.getD1Database('DB');
 const schema=await readFile('schema.sql','utf8');for(const sql of schema.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').bind('owner','owner@example.test','hash',1,new Date().toISOString()).run();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const hash=Buffer.from(digest).toString('hex');
 await db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').bind(hash,'owner',new Date(Date.now()+3600000).toISOString(),new Date().toISOString()).run();
 const signed=(path,options={})=>mf.dispatchFetch('https://kurdai.net/api/billing/'+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers}});
 const cap=await(await signed('capabilities')).json();assert.equal(cap.enabled,true);assert.equal(cap.mode,'test');assert.equal(cap.publicPaymentsEnabled,false);
 const body=JSON.stringify({packId:pack.id,requestId:crypto.randomUUID()});
 const response=await signed('checkout',{method:'POST',headers:{'content-type':'application/json'},body});assert.equal(response.status,201);
 const checkout=await response.json();assert.ok(checkout.orderId);
 const stored=await db.prepare('SELECT amount_cents,credits,price_id FROM billing_orders WHERE id=?').bind(checkout.orderId).first();
 assert.deepEqual(stored,{amount_cents:pack.amountCents,credits:pack.credits,price_id:pack.priceId});
 await signed('checkout',{method:'POST',headers:{'content-type':'application/json'},body});assert.equal(providerCreates,1);
 // A valid signed completion event while payment is pending must not grant credits.
 const session=sessions.get('cs_test_worker1');
 const stripe=new Stripe('rk_test_syntheticOnly');
 const deliver=async(eventId)=>{
  const raw=JSON.stringify({id:eventId,livemode:false,type:'checkout.session.completed',data:{object:session}});
  const sig=await stripe.webhooks.generateTestHeaderStringAsync({payload:raw,secret,cryptoProvider:Stripe.createSubtleCryptoProvider()});
  return mf.dispatchFetch('https://kurdai.net/api/billing/webhook',{method:'POST',body:raw,headers:{'stripe-signature':sig}});
 };
 assert.equal((await deliver('evt_pending')).status,200);
 assert.equal((await(await signed('balance')).json()).credits,0);
 session.payment_status='paid';session.status='complete';
 // Stripe may deliver different events for one session concurrently. Use actual D1
 // batches and SDK signature validation; only the provider HTTP transport is mocked.
 const deliveries=await Promise.all(Array.from({length:8},(_,i)=>deliver('evt_concurrent'+i)));
 assert.ok(deliveries.every(r=>r.status===200));
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM billing_fulfillments').first()).n,1);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM billing_ledger').first()).n,1);
 const payload=JSON.stringify({id:'evt_synthetic',livemode:false,type:'checkout.session.completed',data:{object:session}});
 const signature=await new Stripe('rk_test_syntheticOnly').webhooks.generateTestHeaderStringAsync({payload,secret,cryptoProvider:Stripe.createSubtleCryptoProvider()});
 for(let i=0;i<2;i++) {
  const webhook=await mf.dispatchFetch('https://kurdai.net/api/billing/webhook',{method:'POST',body:payload,headers:{'stripe-signature':signature}});
  assert.equal(webhook.status,200);
 }
 const balance=await(await signed('balance')).json();assert.equal(balance.credits,pack.credits);
 assert.equal((await(await signed('order?id='+checkout.orderId)).json()).status,'paid');
 const anonymous=await mf.dispatchFetch('https://kurdai.net/api/billing/balance');assert.equal(anonymous.status,401);
});
