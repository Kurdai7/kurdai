import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
test('70-second UI quotes freely, blocks unknown costs, requires approval, invalidates changed input and resumes without paid POST', async () => {
  const dom = new JSDOM(readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), { url: 'https://kurdai.net', runScripts: 'outside-only' });
  const w = dom.window, $ = id => w.document.getElementById(id), records = [];
  w.localStorage.setItem('kurdai_session_token', 'owner');
  w.HTMLMediaElement.prototype.pause = w.HTMLMediaElement.prototype.load = () => {};
  w.URL.createObjectURL = () => 'blob:70'; w.URL.revokeObjectURL = () => {};
  let enabled = false, consent = false, serverSeconds = 60;
  w.confirm = () => consent;
  w.fetch = async (path, options = {}) => {
    records.push({ path, options });
    const q = { id: 'quote', model:'gemini-omni-1.1-flash',nativeAudio:true, outputSeconds: serverSeconds, segments:serverSeconds/5, apiUSD: 1.053, apiEUR: 1.053 / 1.1188, mediaEUR: enabled ? 0.01 : null,
      fxEUR: enabled ? 0 : null, vatEUR: enabled ? 0 : null, totalEUR: enabled ? 0.9512 : null, canStart: enabled,
      planningEstimate:enabled?undefined:{basis:'unverified-planning-reserve',payable:false,totalEUR:1.31} };
    if (path.endsWith('/capabilities')) return {ok:true,json:async()=>({processorReachable:false,missingConfiguration:['LONG_VIDEO_SERVICE_URL']})};
    if (path.endsWith('/quote')) return { ok: true, json: async () => q };
    if (path.endsWith('/jobs')) return { ok: true, json: async () => ({ jobs: [{ id: 'quote', status: 'ready' }] }) };
    if (path.includes('/file')) return { ok: true, blob: async () => new w.Blob(['synthetic']) };
    return { ok: true, json: async () => ({ id: 'quote', status: 'ready', completedSegments: 14,
      reservedAPIUSD: 1.053, videoUrl: '/api/long/file?id=quote' }) };
  };
  const wait = () => new Promise(resolve => setTimeout(resolve, 10));
  w.eval(readFileSync(new URL('../public/long-app.js', import.meta.url), 'utf8'));
  $('longReadiness').click();await wait();assert.match($('longCost').textContent,/LONG_VIDEO_SERVICE_URL/);assert.equal(records.filter(x=>x.options.method==='POST').length,0);
  $('prompt').value = 'Kurdish animation';
  assert.equal($('longDuration').value,'60');
  $('longQuote').click(); await wait(); assert.equal($('longStart').disabled, true);
  assert.match($('longCost').textContent,/بودجەی خەمڵێنراوی کاتی: €1.3100/);
  assert.match($('longCost').textContent, /0.9412/);
  assert.equal(JSON.parse(records.find(x=>x.path.endsWith('/quote')).options.body).duration,60);
  serverSeconds=70; $('longQuote').click(); await wait(); assert.equal($('longStart').disabled,true); assert.match($('longCost').textContent,/Deploy/);
  serverSeconds=60;
  enabled = true; $('longQuote').click(); await wait(); assert.equal($('longStart').disabled, false);
  $('longStart').click(); await wait(); assert.equal(records.filter(x => x.path.endsWith('/start')).length, 0);
  $('prompt').dispatchEvent(new w.Event('input')); assert.equal($('longStart').disabled, true);
  $('longQuote').click(); await wait(); consent = true; $('longStart').click(); await wait(); await wait();
  assert.equal(records.filter(x => x.path.endsWith('/start')).length, 1);
  const body = JSON.parse(records.find(x => x.path.endsWith('/start')).options.body);
  assert.equal(body.approved, true); assert.equal(body.approvedTotalEUR, 0.9512);
  assert.equal($('longVideo').hidden, false); assert.equal($('longDownload').hidden, false);
  $('longRefresh').click(); await wait(); assert.equal(records.filter(x => x.path.endsWith('/start')).length, 1);
  $('logoutBtn').click(); assert.equal($('longVideo').hidden, true);
  // The explicit free test bypasses the paid quote/approval path and labels the result.
  const starts=records.filter(x=>x.path.endsWith('/start')).length;
  const originalFetch=w.fetch;
  w.fetch=async(path,options)=>{
    if(path.endsWith('/smoke') || path.includes('/status')) {
      records.push({path,options});return {ok:true,json:async()=>({id:'smoke',model:'synthetic-test-no-ai',status:'ready',
        completedSegments:14,totalSegments:14,duration:70,reservedAPIUSD:0,videoUrl:'/api/long/file?id=smoke'})};
    }
    return originalFetch(path,options);
  };
  $('longSmoke').click();await wait();await wait();
  assert.equal(records.filter(x=>x.path.endsWith('/start')).length,starts);
  assert.match($('longCost').textContent,/€0/);assert.equal($('longStart').disabled,true);
  assert.equal($('longDownload').download,'KurdAI-70s.mp4');
  dom.window.close();
});

test('Omni UI handles unknown token costs, binds model and offers 5–70s without sending generation',async()=>{
  const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://kurdai.net',runScripts:'outside-only'});
  const w=dom.window,$=id=>w.document.getElementById(id),requests=[];
  w.HTMLMediaElement.prototype.pause=w.HTMLMediaElement.prototype.load=()=>{};
  let model='gemini-omni-1.1-flash';
  w.fetch=async(path,options)=>{requests.push({path,options});return{ok:true,json:async()=>({model,outputSeconds:5,segments:1,
    apiUSD:null,apiEUR:null,apiMinimumEUR:0.4527,mediaEUR:null,fxEUR:null,vatEUR:null,totalEUR:null,
    nativeAudio:true,audioQuote:{native:true,language:'sorani'},canStart:false,blockedReasons:['Missing context costs']})};};
  w.eval(readFileSync(new URL('../public/long-app.js',import.meta.url),'utf8'));
  assert.equal($('longModel').value,model);assert.equal($('longResolution').value,'720p');assert.equal($('longLanguage').value,'sorani');
  assert.equal($('longDuration').options.length,14);$('longDuration').value='5';$('prompt').value='Animated family';
  const wait=()=>new Promise(resolve=>setTimeout(resolve,10));$('longQuote').click();await wait();
  assert.equal($('longStart').disabled,true);assert.match($('longCost').textContent,/0.4527/);assert.match($('longCost').textContent,/Missing context/);
  assert.equal(JSON.parse(requests[0].options.body).model,model);assert.equal(requests.some(r=>r.path.endsWith('/start')),false);
  model='wan2.2-i2v-flash';$('longQuote').click();await wait();assert.match($('longCost').textContent,/Deploy/);assert.equal($('longStart').disabled,true);
  $('longModel').value=model;$('longModel').dispatchEvent(new w.Event('change'));
  assert.equal($('longDuration').value,'60');assert.equal($('longLanguage').value,'none');dom.window.close();
});

test('pending native models preserve dialects, enforce actual resolutions and cannot request generation',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://kurdai.net',runScripts:'outside-only'});
 const w=dom.window,$=id=>w.document.getElementById(id),requests=[];
 w.fetch=async(...args)=>{requests.push(args);throw new Error('Unexpected network request');};
 w.eval(readFileSync(new URL('../public/long-app.js',import.meta.url),'utf8'));
 $('longLanguage').value='sorani';
 for(const [model,resolution] of [['seedance-2.0-mini','720p'],['heygen-video-1','768p']]) {
  $('longModel').value=model;$('longModel').dispatchEvent(new w.Event('change'));
  assert.equal($('longLanguage').value,'sorani');assert.equal($('longResolution').value,resolution);
  for(const value of ['460p','520p']) assert.equal([...$('longResolution').options].find(o=>o.value===value).disabled,true);
  assert.ok(Number($('longDuration').value)<=15);
  $('longQuote').click();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal($('longStart').disabled,true);assert.match($('longCost').textContent,/پەیوەست نەکراوە/);
 }
 assert.equal(requests.length,0);
 $('longModel').value='wan2.2-i2v-flash';$('longModel').dispatchEvent(new w.Event('change'));
 assert.equal($('longResolution').value,'720p');assert.equal($('longDuration').value,'60');
 dom.window.close();
});


test('new native choices can request only a free blocked quote without enabling start',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://kurdai.net',runScripts:'outside-only'});
 const w=dom.window,$=id=>w.document.getElementById(id),requests=[];
 w.localStorage.setItem('kurdai_session_token','owner');
 w.fetch=async(path,options)=>{requests.push(path);const input=JSON.parse(options.body);return {ok:true,json:async()=>({model:input.model,outputSeconds:input.duration,segments:1,segmentSeconds:input.duration,nativeAudio:true,apiUSD:null,totalEUR:null,canStart:false,blockedReasons:['API integration pending']})};};
 w.eval(readFileSync(new URL('../public/long-app.js',import.meta.url),'utf8'));
 for(const model of ['pixverse-v6','kling-3.0-standard']){
  $('longModel').value=model;$('longModel').dispatchEvent(new w.Event('change'));$('longDuration').value='10';$('longQuote').click();
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal($('longStart').disabled,true);assert.match($('longCost').textContent,/API integration pending/);assert.match($('longCost').textContent,/1 × 10/);
 }
 assert.equal(requests.length,2);assert.ok(requests.every(p=>p.endsWith('/quote')));dom.window.close();
});
test('P-Video 2 allows 20 seconds, preserves Badini, and exposes a blocked free quote',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://kurdai.net',runScripts:'outside-only'});
 const w=dom.window,$=id=>w.document.getElementById(id),requests=[];
 w.HTMLMediaElement.prototype.pause=w.HTMLMediaElement.prototype.load=()=>{};
 w.fetch=async(path,options)=>{requests.push(path);const i=JSON.parse(options.body);return {ok:true,json:async()=>({model:i.model,outputSeconds:i.duration,segments:1,segmentSeconds:i.duration,nativeAudio:true,canStart:false,totalEUR:null,apiUSD:null,blockedReasons:['Pruna authentication HTTP 401']})};};
 w.eval(readFileSync(new URL('../public/long-app.js',import.meta.url),'utf8'));
 $('longLanguage').value='badini';$('longModel').value='p-video-2';$('longModel').dispatchEvent(new w.Event('change'));
 assert.equal($('longLanguage').value,'badini');assert.equal($('longDuration').querySelector('[value="20"]').disabled,false);
 assert.equal($('longDuration').querySelector('[value="25"]').disabled,false);assert.equal($('longDuration').querySelector('[value="70"]').disabled,false);
 $('prompt').value='A Kurdish family';$('longDialogue').value='سلاڤ';
 $('longDuration').value='20';$('longQuote').click();await new Promise(r=>setTimeout(r,20));
 assert.equal($('longStart').disabled,true);assert.match($('longCost').textContent,/401/);assert.deepEqual(requests,['/api/long/quote']);dom.window.close();
});

test('Pruna missing scene and dialogue focus the correct local field, retain text, and never submit incomplete quotes',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://kurdai.net',runScripts:'outside-only'});
 const w=dom.window,$=id=>w.document.getElementById(id),requests=[];
 w.fetch=async(path,options)=>{requests.push(JSON.parse(options.body));const i=requests.at(-1);return {ok:true,json:async()=>({model:i.model,outputSeconds:i.duration,segments:1,nativeAudio:true,canStart:false})};};
 w.eval(readFileSync(new URL('../public/long-app.js',import.meta.url),'utf8'));
 $('longModel').value='p-video-2';$('longModel').dispatchEvent(new w.Event('change'));
 $('longPanel').hidden=false;
 $('longDialogue').value='سڵاو، بەخێربێن';$('longQuote').click();await new Promise(r=>setTimeout(r,10));
 assert.equal(requests.length,0);assert.equal(w.document.activeElement.id,'longPrompt');assert.equal($('longDialogue').value,'سڵاو، بەخێربێن');
 $('longPrompt').value='A Kurdish cartoon village';$('longPrompt').dispatchEvent(new w.Event('input'));
 assert.equal($('prompt').value,'A Kurdish cartoon village');
 $('longDialogue').value='';$('longQuote').click();await new Promise(r=>setTimeout(r,10));
 assert.equal(requests.length,0);assert.equal(w.document.activeElement.id,'longDialogue');
 $('longDialogue').value='سڵاو';$('longQuote').click();await new Promise(r=>setTimeout(r,10));
 assert.equal(requests.length,1);assert.equal(requests[0].prompt,'A Kurdish cartoon village');assert.equal(requests[0].dialogueText,'سڵاو');assert.equal($('longStart').disabled,true);
 dom.window.close();
});
