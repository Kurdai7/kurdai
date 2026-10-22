import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../public/billing-app.js',import.meta.url),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,15));
function setup(t,url='https://kurdai.net'){
 const dom=new JSDOM(html,{url,runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window;w.AbortSignal=AbortSignal;w.localStorage.setItem('kurdai_session_token','owner-session');
 return {w,$:id=>w.document.getElementById(id),start:()=>w.eval(script)};
}
const cap={mode:'live',accountId:'owner',configured:true,enabled:true,packs:[{id:'small',amountCents:200,credits:200}]};
const response=data=>({ok:true,json:async()=>data});
test('billing UI stays hidden on missing deployment or disabled credentials and never starts checkout',async t=>{
 const {w,$,start}=setup(t);let posts=0;
 w.fetch=async(path,opts)=>{if(opts.method==='POST')posts++;return response({...cap,configured:false});};start();await wait();
 assert.equal($('billingPanel').hidden,true);assert.equal($('billingPacks').children.length,0);assert.equal(posts,0);
});
test('a forged success return cannot grant credits or claim payment before signed server fulfillment',async t=>{
 const {w,$,start}=setup(t,'https://kurdai.net/?checkout=returned&order=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');let posts=0;
 w.fetch=async(path,opts)=>{if(opts.method==='POST')posts++;
 return response(path.endsWith('capabilities')?cap:path.endsWith('balance')?{credits:0}:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',status:'open'});};
 start();await wait();assert.equal($('billingPanel').hidden,false);assert.match($('billingBalance').textContent,/0/);
 assert.match($('billingMessage').textContent,/هێشتا/);assert.equal(posts,0);
});
test('checkout retries preserve the order identity and reject a malicious redirect',async t=>{
 const {w,$,start}=setup(t);const bodies=[];
 w.fetch=async(path,opts)=>{
 if(opts.method==='POST'){bodies.push(JSON.parse(opts.body));return response({orderId:'order-1',url:'https://checkout.stripe.com.evil.example/pay'});}
 return response(path.endsWith('capabilities')?cap:{credits:0});};
 start();await wait();const button=$('billingPacks').querySelector('button');button.click();button.click();await wait();
 assert.equal(bodies.length,1);assert.equal(w.location.hostname,'kurdai.net');
 button.click();await wait();assert.equal(bodies.length,2);assert.deepEqual(bodies[0],bodies[1]);
 assert.deepEqual(Object.keys(bodies[0]).sort(),['packId','requestId']);
});
test('a delayed billing response cannot expose a previous account after logout',async t=>{
 const {w,$,start}=setup(t);let resolve;
 w.fetch=()=>new Promise(r=>{resolve=r;});start();
 w.localStorage.removeItem('kurdai_session_token');w.document.dispatchEvent(new w.Event('kurdai-account-change'));
 resolve(response(cap));await wait();assert.equal($('billingPanel').hidden,true);assert.equal($('billingPacks').children.length,0);
});
test('video balance changes re-read server credits without creating checkout',async t=>{
 const {w,$,start}=setup(t);let credits=200,posts=0,reads=0;
 w.fetch=async(path,opts)=>{if(opts.method==='POST')posts++;
  if(path.endsWith('/balance'))reads++;
  return response(path.endsWith('/capabilities')?cap:{credits});};
 start();await wait();assert.match($('billingBalance').textContent,/200/);
 credits=106;w.document.dispatchEvent(new w.Event('kurdai-balance-change'));await wait();
 assert.match($('billingBalance').textContent,/106/);assert.equal(reads,2);assert.equal(posts,0);
 credits=200;w.document.dispatchEvent(new w.Event('kurdai-balance-change'));await wait();
 assert.match($('billingBalance').textContent,/200/);assert.equal(posts,0);
});
test('a ledger-backed purchase receipt identifies a settled return despite a stale order response',async t=>{
 const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 const {w,$,start}=setup(t,`https://kurdai.net/?order=${id}`);
 w.fetch=async(path)=>response(path.endsWith('capabilities')?cap:path.endsWith('balance')?
  {credits:340,latestPurchase:{id,credits:280,amountCents:500}}:{id,status:'open'});
 start();await wait();
 assert.match($('billingMessage').textContent,/پارەدان پشتڕاست کرایەوە/);
 assert.match($('billingBalance').textContent,/340/);
 assert.equal(w.location.search,'');
});
test('an unrelated pending checkout never marks a verified purchase unverified',async t=>{
 const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',paid='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 const {w,$,start}=setup(t,`https://kurdai.net/?order=${id}`);
 w.fetch=async(path)=>response(path.endsWith('capabilities')?cap:path.endsWith('balance')?
  {credits:340,latestPurchase:{id:paid,credits:280,amountCents:500}}:{id,status:'open'});
 start();await wait();
 assert.match($('billingMessage').textContent,/280/);
 assert.match($('billingMessage').textContent,/داواکارییەکی تری/);
 assert.ok(w.location.search.includes(id));
});
test('settled returns refresh credits and stop shadowing the next order',async t=>{
 const first='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',second='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 const {w,$,start}=setup(t,`https://kurdai.net/?checkout=returned&order=${first}&lang=en`);
 let credits=0,posts=0;const orders=[];
 w.fetch=async(path,opts)=>{
  if(opts.method==='POST')posts++;
  if(path.endsWith('/capabilities'))return response(cap);
  if(path.endsWith('/balance'))return response({credits});
  const id=new URL(path,w.location.href).searchParams.get('id');orders.push(id);credits=200;
  return response({id,status:'paid'});
 };
 start();await wait();
 assert.match($('billingBalance').textContent,/200/);
 assert.equal(w.location.search,'?lang=en');
 w.sessionStorage.setItem('kurdai_billing_order',JSON.stringify({accountId:'owner',mode:'live',orderId:second}));
 $('billingRefresh').click();await wait();
 assert.deepEqual(orders,[first,second]);assert.equal(w.sessionStorage.getItem('kurdai_billing_order'),null);assert.equal(posts,0);
});

