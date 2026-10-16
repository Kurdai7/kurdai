import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {handleLong} from '../long-video.js';

for (const permanent of [false,true]) test(`readiness ${permanent?'stops on authentication failure':'recovers from a disconnected read without submitting video'}`,async()=>{
  const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://kurdai.net',runScripts:'outside-only'});
  const w=dom.window, requests=[];
  w.localStorage.setItem('kurdai_session_token','test-session');
  w.setTimeout=fn=>setTimeout(fn,0);
  w.fetch=async(path,options)=>{
    requests.push({path,method:options.method});
    if(requests.length===1){
      if(!permanent)throw new w.TypeError('Failed to fetch');
      return {ok:false,json:async()=>({error:'Unauthorized',code:'PROCESSOR_AUTH_REJECTED'})};
    }
    return {ok:true,json:async()=>({processorReachable:true,models:{'gemini-omni-1.1-flash':{canStart:false,blockedReasons:['Spending disabled']}}})};
  };
  w.eval(readFileSync(new URL('../public/long-app.js',import.meta.url),'utf8'));
  w.document.getElementById('longReadiness').click();
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(requests.length,permanent?1:2);
  assert.ok(requests.every(r=>r.path==='/api/long/capabilities'&&r.method==='GET'));
  assert.match(w.document.getElementById('longCost').textContent,permanent?/PROCESSOR_AUTH_REJECTED/:/Spending disabled/);
  assert.equal(w.document.getElementById('longStart').disabled,true);
  dom.window.close();
});

test('an upstream readiness timeout returns a specific retryable code without disclosing secrets',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{throw Object.assign(new Error('private detail'),{name:'TimeoutError'});};
  try{
    const response=await handleLong(new Request('https://kurdai.net/api/long/capabilities'),{
      VIDEO_TEST_EMAIL:'owner@example.test',LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:'x'.repeat(40)
    },{id:'owner',email:'owner@example.test',verified:true});
    assert.equal(response.status,503);
    const result=await response.json();
    assert.equal(result.code,'PROCESSOR_READINESS_TIMEOUT');
    assert.doesNotMatch(JSON.stringify(result),/private detail|xxxxx/);
  }finally{globalThis.fetch=original;}
});
