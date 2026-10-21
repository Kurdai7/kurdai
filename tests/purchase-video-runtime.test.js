import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import Stripe from 'stripe';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {createProcessor} from '../processor/server.js';
import {duration} from '../processor/media.js';
import {TEST_CREDIT_PACKS} from '../billing-packs.js';
import {memoryJobStorage,durableTestFlags} from './helpers/r2-memory.js';

const scenarios=[{model:'gemini-omni-1.1-flash',pack:{id:'small',priceId:'price_synthetic',amountCents:200,credits:200}},
 ...TEST_CREDIT_PACKS.map(pack=>({model:'p-video-2',pack}))];
for(const {model,pack} of scenarios) test(`isolated Worker/D1: EUR${pack.amountCents/100} purchase funds one synthetic ${model} video without duplicate credits or debit`,async t=>{
 const root=await mkdtemp(join(tmpdir(),'kurdai-purchase-video-')),run=promisify(execFile),source=join(root,'source.mp4');
 await run('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=1280x704:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','5','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
 const bytes=await readFile(source),serviceSecret='synthetic-service-secret-'.repeat(3);
 let generated=0;
 const processor=await createProcessor({...durableTestFlags,LONG_DATA_DIR:join(root,'jobs'),LONG_VIDEO_SERVICE_SECRET:serviceSecret,
  BILLABLE_REQUESTS_ENABLED:'true',API_MAX_JOB_USD:'100',API_MAX_DAY_USD:'100',GEMINI_API_KEY:'synthetic-only',
  OMNI_GENERATION_ENABLED:'true',OMNI_BILLING_VERIFIED:'true',OMNI_INPUT_TOKENS_PER_SEGMENT:'10000',
  OMNI_TEXT_TOKENS_PER_SEGMENT:'1000',LONG_MEDIA_EUR:'0.01',LONG_FX_PERCENT:'0',LONG_VAT_PERCENT:'0',LONG_USD_PER_EUR:'1',
  PRUNA_API_KEY:'synthetic-only',PRUNA_NATIVE_ENABLED:'true',NATIVE_GENERATION_ENABLED:'true',NATIVE_BILLING_VERIFIED:'true'},
  {jobStorage:memoryJobStorage(),omni:{client:{async submit(){generated++;return {id:'v1_synthetic',status:'completed'};},
   async poll(){return {id:'v1_synthetic',status:'completed'};},async media(){return bytes;}}},
   native:{client:{async submit(){generated++;return {model:'p-video-2',id:'task_synthetic'};},
    async poll(){return {status:'completed',url:'https://api.pruna.ai/synthetic.mp4'};}},
    async download(_url,path){await writeFile(path,bytes);}}});
 await new Promise(r=>processor.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>processor.server.close(r));await processor.close();await rm(root,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+processor.server.address().port;
 const bundle=await build({entryPoints:['worker.js'],bundle:true,write:false,format:'esm',platform:'browser'});
 const token='synthetic-owner-session',secret='whsec_syntheticOnlySecret';let session,checkouts=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-25',d1Databases:['DB'],
  bindings:{VIDEO_ADMIN_EMAIL:'admin@example.test',VIDEO_TEST_EMAIL:'owner@example.test',STRIPE_MODE:'test',STRIPE_RESTRICTED_KEY:'rk_test_syntheticOnly',STRIPE_WEBHOOK_SECRET:secret,
   STRIPE_CHECKOUT_ENABLED:'true',STRIPE_CREDIT_PACKS:JSON.stringify([pack]),
   LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:serviceSecret,VIDEO_PURCHASED_CREDITS_ENABLED:'true',VIDEO_CREDITS_PER_EUR:'100'},
  outboundService:async request=>{
   const url=new URL(request.url);
   if(url.hostname==='processor.test') {
    assert.equal(request.headers.get('authorization'),'Bearer '+serviceSecret);
    return fetch(origin+url.pathname+url.search,{method:request.method,headers:request.headers,
     ...(request.method==='POST'?{body:await request.text()}:{}),redirect:'manual'});
   }
   assert.equal(url.hostname,'api.stripe.com','All other external services are forbidden');
   assert.equal(request.headers.get('authorization'),'Bearer rk_test_syntheticOnly');
   if(request.method==='POST') {
    assert.equal(url.pathname,'/v1/checkout/sessions');checkouts++;
    const form=new URLSearchParams(await request.text()),id=form.get('client_reference_id');
    session={id:'cs_test_synthetic1',livemode:false,mode:'payment',currency:'eur',amount_total:pack.amountCents,status:'open',payment_status:'unpaid',
     client_reference_id:id,metadata:{app:'kurdai',order_id:id},url:'https://checkout.stripe.com/c/pay/cs_test_synthetic1',
     line_items:{data:[{quantity:1,price:{id:pack.priceId}}],has_more:false}};
   } else {assert.equal(request.method,'GET');assert.equal(url.pathname,'/v1/checkout/sessions/cs_test_synthetic1');}
   return Response.json(session);
  }}));
 t.after(()=>mf.dispose());const db=await mf.getD1Database('DB');
 for(const sql of (await readFile('schema.sql','utf8')).split(';').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').bind('owner','owner@example.test','hash',1,new Date().toISOString()).run();
 const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
 await db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').bind(hash,'owner',new Date(Date.now()+3600000).toISOString(),new Date().toISOString()).run();
 const call=(path,body)=>mf.dispatchFetch('https://kurdai.net/api/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const balance=async()=>(await(await call('billing/balance')).json()).credits;
 const input={model,prompt:'Animated greeting',duration:5,resolution:model==='p-video-2'?'704p':'720p',aspectRatio:'16:9',language:'sorani',dialogueText:'سڵاو، بەخێربێن.'};
 const quoteResponse=await call('long/quote',input);assert.equal(quoteResponse.status,200);
 const quote=await quoteResponse.json();assert.equal(quote.canStart,true);assert.ok(quote.creditPrice>0 && quote.creditPrice<pack.credits);
 const approval={id:quote.id,approved:true,approvedTotalEUR:quote.totalEUR,approvedCredits:quote.creditPrice};
 assert.equal((await call('long/start',approval)).status,402);assert.equal(generated,0);
 const purchase={packId:pack.id,requestId:crypto.randomUUID()};
 assert.equal((await call('billing/checkout',purchase)).status,201);
 assert.equal((await call('billing/checkout',purchase)).status,200);assert.equal(checkouts,1);assert.equal(await balance(),0);
 const stripe=new Stripe('rk_test_syntheticOnly');
 const deliver=async n=>{
  const payload=JSON.stringify({id:'evt_synthetic'+n,type:'checkout.session.completed',livemode:false,data:{object:session}});
  const signature=await stripe.webhooks.generateTestHeaderStringAsync({payload,secret,cryptoProvider:Stripe.createSubtleCryptoProvider()});
  return mf.dispatchFetch('https://kurdai.net/api/billing/webhook',{method:'POST',body:payload,headers:{'stripe-signature':signature}});
 };
 assert.equal((await deliver(0)).status,200);assert.equal(await balance(),0);
 session.payment_status='paid';session.status='complete';
 assert.ok((await Promise.all([deliver(1),deliver(2),deliver(3)])).every(r=>r.status===200));
 assert.equal(await balance(),pack.credits);
 assert.equal((await call('long/start',approval)).status,202);
 assert.equal((await call('long/start',approval)).status,200);
 assert.equal(await balance(),pack.credits-quote.creditPrice);
 for(let i=0;i<3;i++)await processor.tick();
 const result=await(await call('long/status?id='+quote.id)).json();assert.equal(result.status,'ready');assert.equal(generated,1);
 const output=await call('long/file?id='+quote.id);assert.equal(output.status,200);assert.equal(output.headers.get('content-type'),'video/mp4');
 const target=join(root,'download.mp4');await writeFile(target,Buffer.from(await output.arrayBuffer()));assert.ok(Math.abs(await duration(target)-5)<0.08);
 await call('long/start',approval);await call('long/status?id='+quote.id);await deliver(4);
 assert.equal(await balance(),pack.credits-quote.creditPrice);assert.equal(checkouts,1);assert.equal(generated,1);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM billing_fulfillments').first()).n,1);
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM billing_ledger WHERE reason='video_reservation'").first()).n,1);
 assert.equal((await db.prepare('SELECT status FROM video_credit_reservations').first()).status,'captured');
 assert.equal((await mf.dispatchFetch('https://kurdai.net/api/long/file?id='+quote.id)).status,401);
});

