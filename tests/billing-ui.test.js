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
