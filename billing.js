import Stripe from 'stripe';
import { authLimit } from './auth-guard.js';

// Paid credits never mix with daily display credits or Stripe test credits.
export const BILLING_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS billing_orders (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), mode TEXT NOT NULL,
    request_id TEXT NOT NULL, pack_id TEXT NOT NULL, price_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL, credits INTEGER NOT NULL,
    created_at INTEGER NOT NULL, session_id TEXT UNIQUE, checkout_url TEXT,
    status TEXT NOT NULL DEFAULT 'creating', UNIQUE(user_id,mode,request_id))`,
  `CREATE TABLE IF NOT EXISTS billing_fulfillments (
    session_id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES billing_orders(id))`,
  `CREATE TABLE IF NOT EXISTS billing_ledger (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), mode TEXT NOT NULL,
    amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL)`
];
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const fail = (message,status=400) => {throw Object.assign(new Error(message),{status});};
export function billingConfiguration(env) {
  const mode=env.STRIPE_MODE;
  let packs=[];
  try {
    const values=JSON.parse(env.STRIPE_CREDIT_PACKS || '[]');
    if(!Array.isArray(values) || values.length>10) throw Error();
    const ids=new Set();
    for(const p of values) {
      if(!/^[a-z0-9_-]{1,50}$/.test(p.id) || !/^price_[a-zA-Z0-9]+$/.test(p.priceId) ||
        !Number.isSafeInteger(p.amountCents) || p.amountCents<50 || p.amountCents>100000 ||
        !Number.isSafeInteger(p.credits) || p.credits<1 || p.credits>1000000 || ids.has(p.id)) throw Error();
      ids.add(p.id);packs.push({id:p.id,priceId:p.priceId,amountCents:p.amountCents,credits:p.credits});
    }
  } catch {packs=[];}
  const keyValid=['test','live'].includes(mode) && new RegExp(`^rk_${mode}_[A-Za-z0-9]+$`).test(env.STRIPE_RESTRICTED_KEY || '');
  const liveApproved=mode==='test' || (env.STRIPE_LIVE_APPROVED==='true' && env.PUBLIC_RELEASE_VERIFIED==='true' && env.STRIPE_CATALOG_APPROVED==='true');
  return {mode:['test','live'].includes(mode)?mode:null,packs,
    configured:!!env.DB && keyValid && /^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET || ''),
    enabled:env.STRIPE_CHECKOUT_ENABLED==='true' && keyValid && liveApproved && packs.length>0 && !!env.DB && /^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET || '')};
}
async function bodyText(request,limit) {
  if(Number(request.headers.get('content-length'))>limit) fail('Request too large.',413);
  const reader=request.body?.getReader();if(!reader)return '';
  const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>limit){await reader.cancel();fail('Request too large.',413);}chunks.push(value);}
  const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(all);
}
function stripeClient(env) {
  return new Stripe(env.STRIPE_RESTRICTED_KEY,{httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:0,timeout:20000});
}
function sessionMatches(s,order) {
  return s.livemode===(order.mode==='live') && s.mode==='payment' &&
    s.metadata?.app==='kurdai' && s.metadata?.order_id===order.id && s.client_reference_id===order.id &&
    s.currency==='eur' && s.amount_total===order.amount_cents &&
    (!order.session_id || order.session_id===s.id);
}
async function fulfill(db,client,event,mode) {
  if(event.livemode!==(mode==='live')) fail('Wrong Stripe environment.');
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'].includes(event.type))return;
  const incoming=event.data?.object;
  if(!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(incoming?.id || '') || incoming.metadata?.app!=='kurdai')return;
  const order=await db.prepare('SELECT * FROM billing_orders WHERE id=? AND mode=?').bind(incoming.metadata.order_id || '',mode).first();
  if(!order)return;
  const session=await client.checkout.sessions.retrieve(incoming.id,{expand:['line_items']});
  if(!sessionMatches(session,order))fail('Stripe order does not match.',409);
  if(event.type==='checkout.session.expired' && session.status==='expired') {
    await db.prepare("UPDATE billing_orders SET status='expired' WHERE id=? AND status!='paid'").bind(order.id).run();return;
  }
  // Unpaid/failed/late duplicate events never remove a completed fulfillment.
  if(session.payment_status!=='paid')return;
  const lines=session.line_items;
  if(lines?.has_more || lines?.data?.length!==1 || lines.data[0].quantity!==1 || lines.data[0].price?.id!==order.price_id)
    fail('Stripe line items do not match.',409);
  const stamp=Math.floor(Date.now()/1000);
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO billing_fulfillments (session_id,order_id) VALUES (?,?)').bind(session.id,order.id),
    db.prepare(`INSERT OR IGNORE INTO billing_ledger (id,user_id,mode,amount,reason,created_at)
      SELECT ?,user_id,mode,credits,'stripe_purchase',? FROM billing_orders
      WHERE id=? AND EXISTS (SELECT 1 FROM billing_fulfillments WHERE session_id=? AND order_id=?)`)
      .bind(`stripe:${mode}:${session.id}`,stamp,order.id,session.id,order.id),
    db.prepare("UPDATE billing_orders SET session_id=?,status='paid' WHERE id=? AND (session_id IS NULL OR session_id=?)").bind(session.id,order.id,session.id)
  ]);
}
export async function handleBilling(request,env,user,dependencies={}) {
  const url=new URL(request.url),config=billingConfiguration(env);
  try {
    const allowed=!!user?.verified && (config.mode==='live' || (!!env.VIDEO_TEST_EMAIL && user.email.trim().toLowerCase()===env.VIDEO_TEST_EMAIL.trim().toLowerCase()));
    if(url.pathname==='/api/billing/capabilities' && request.method==='GET')
      return json({mode:config.mode,configured:config.configured,enabled:config.enabled && allowed,
        publicPaymentsEnabled:config.enabled && config.mode==='live',
        packs:config.enabled && allowed?config.packs.map(({priceId,...p})=>p):[],currency:'eur'});
    const webhook=url.pathname==='/api/billing/webhook' && request.method==='POST';
    if(!webhook && !user)return json({error:'Please log in.'},401);
    if(!webhook && !allowed)return json({error:'Billing is unavailable for this account.'},403);
    if(!config.configured)return json({error:'Stripe is not configured. No payment was created.'},503);
    // Process already-created payments even when creation has been disabled.
    const client=dependencies.client || stripeClient(env);
    if(webhook) {
      const raw=await bodyText(request,262144);
      let event;
      try {event=await client.webhooks.constructEventAsync(raw,request.headers.get('stripe-signature') || '',env.STRIPE_WEBHOOK_SECRET,300,Stripe.createSubtleCryptoProvider());}
      catch {return json({error:'Invalid Stripe signature.'},400);}
      await env.DB.batch(BILLING_SCHEMA.map(sql=>env.DB.prepare(sql)));
      await fulfill(env.DB,client,event,config.mode);return json({received:true});
    }
    await env.DB.batch(BILLING_SCHEMA.map(sql=>env.DB.prepare(sql)));
    if(url.pathname==='/api/billing/balance' && request.method==='GET') {
      const row=await env.DB.prepare('SELECT COALESCE(SUM(amount),0) AS credits FROM billing_ledger WHERE user_id=? AND mode=?').bind(user.id,config.mode).first();
      return json({mode:config.mode,credits:row.credits});
    }
    if(url.pathname==='/api/billing/order' && request.method==='GET') {
      const order=await env.DB.prepare('SELECT id,status FROM billing_orders WHERE id=? AND user_id=? AND mode=?').bind(url.searchParams.get('id') || '',user.id,config.mode).first();
      return order?json(order):json({error:'Order not found.'},404);
    }
    if(url.pathname!=='/api/billing/checkout' || request.method!=='POST')return json({error:'Not found.'},404);
    if(!config.enabled)return json({error:'Checkout is disabled. No payment was created.'},503);
    const retry=await authLimit(request,env.DB,'checkout-write');
    if(retry)return new Response(JSON.stringify({error:'Too many checkout requests.'}),{status:429,headers:{'Retry-After':String(retry),'Cache-Control':'no-store'}});
    if(!request.headers.get('content-type')?.includes('application/json'))fail('Use a JSON request.',415);
    let body;try {body=JSON.parse(await bodyText(request,2048));}catch(e){if(e.status)throw e;fail('Invalid JSON request.');}
    if(!body || !/^[a-f0-9-]{36}$/.test(body.requestId || ''))fail('A unique request ID is required.');
    const pack=config.packs.find(p=>p.id===body.packId);if(!pack)fail('Unknown credit pack.');
    const stamp=Math.floor(Date.now()/1000);
    await env.DB.prepare(`INSERT OR IGNORE INTO billing_orders
      (id,user_id,mode,request_id,pack_id,price_id,amount_cents,credits,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),user.id,config.mode,body.requestId,pack.id,pack.priceId,pack.amountCents,pack.credits,stamp).run();
    const order=await env.DB.prepare('SELECT * FROM billing_orders WHERE user_id=? AND mode=? AND request_id=?').bind(user.id,config.mode,body.requestId).first();
    if(order.pack_id!==pack.id)fail('Request ID already belongs to a different pack.',409);
    if(order.session_id)return json({orderId:order.id,url:order.checkout_url,status:order.status});
    if(stamp-order.created_at>3600)fail('Checkout outcome needs reconciliation; do not retry payment.',409);
    // Stable values and provider idempotency survive concurrent POSTs or a lost response.
    const session=await client.checkout.sessions.create({mode:'payment',adaptive_pricing:{enabled:false},
      integration_identifier:'kurdai_checkout_rhvtzqmp',
      line_items:[{price:order.price_id,quantity:1}],client_reference_id:order.id,
      metadata:{app:'kurdai',order_id:order.id},expires_at:order.created_at+7200,
      success_url:'https://kurdai.net/?checkout=returned&order='+order.id,
      cancel_url:'https://kurdai.net/?checkout=cancelled&order='+order.id
    },{idempotencyKey:`kurdai:${config.mode}:${order.id}`});
    if(!sessionMatches(session,order))fail('Stripe checkout configuration does not match.',502);
    const target=new URL(session.url);
    if(target.protocol!=='https:' || target.hostname!=='checkout.stripe.com' || target.username || target.password)fail('Invalid checkout destination.',502);
    await env.DB.prepare("UPDATE billing_orders SET session_id=?,checkout_url=?,status=CASE WHEN status='paid' THEN 'paid' ELSE 'open' END WHERE id=?")
      .bind(session.id,session.url,order.id).run();
    return json({orderId:order.id,url:session.url,status:'open'},201);
  } catch(error) {
    return json({error:[400,409,413,415].includes(error.status)?error.message:'Billing request failed. Resume the same order; do not make another payment.'},[400,409,413,415].includes(error.status)?error.status:502);
  }
}
