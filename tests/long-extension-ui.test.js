import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const wait=()=>new Promise(r=>setTimeout(r,15));
const sourceId='123e4567-e89b-42d3-a456-426614174000';
function setup(t,fetcher) {
  const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://kurdai.net',runScripts:'outside-only'});
  const w=dom.window;w.localStorage.setItem('kurdai_session_token','synthetic-owner');
  w.HTMLMediaElement.prototype.pause=w.HTMLMediaElement.prototype.load=()=>{};
  w.fetch=fetcher;w.eval(readFileSync(new URL('../public/long-app.js',import.meta.url),'utf8'));
  t.after(()=>dom.window.close());return {w,$:id=>w.document.getElementById(id)};
}
test('extension UI loads only eligible own jobs and binds dialect, ratio and source to a free quote',async t=>{
  const calls=[];
  const {w,$}=setup(t,async(path,options)=>{
    calls.push({path,options});
    return {ok:true,json:async()=>path.endsWith('/jobs')?{jobs:[
      {id:sourceId,canExtend:true,model:'gemini-omni-1.1-flash',duration:5,language:'badini',aspectRatio:'9:16',resolution:'720p'},
      {id:'unusable',canExtend:false,model:'synthetic-test-no-ai'}
    ]}:{model:'gemini-omni-1.1-flash',mode:'extension',sourceJobId:sourceId,outputSeconds:10,segments:2,canStart:false,apiUSD:null,totalEUR:null,blockedReasons:['Spending disabled']}};
  });
  $('longMode').value='extension';$('longMode').dispatchEvent(new w.Event('change'));await wait();
  assert.equal($('longSourcePanel').hidden,false);assert.equal($('longSource').options.length,2);
  $('longSource').value=sourceId;$('longSource').dispatchEvent(new w.Event('change'));
  assert.equal($('longLanguage').value,'badini');assert.equal($('aspectRatio').value,'9:16');
  $('longDuration').value='10';$('prompt').value='بەردەوام بە';$('longQuote').click();await wait();
  const quote=JSON.parse(calls.find(c=>c.path.endsWith('/quote')).options.body);
  assert.equal(quote.mode,'extension');assert.equal(quote.sourceJobId,sourceId);assert.equal(quote.language,'badini');
  assert.equal(quote.duration,10);assert.equal(quote.aspectRatio,'9:16');assert.equal($('longStart').disabled,true);
  assert.equal(calls.some(c=>c.path.endsWith('/start')),false);
  $('logoutBtn').click();assert.equal($('longSource').options.length,1);
});
test('download rejects upstream URLs before attaching the bearer session',async t=>{
  const calls=[];
  const {$}=setup(t,async(path)=>{
    calls.push(path);return {ok:true,json:async()=>path.endsWith('/jobs')?{jobs:[{id:sourceId,status:'ready'}]}:
      {id:sourceId,status:'ready',model:'synthetic-test-no-ai',completedSegments:14,totalSegments:14,reservedAPIUSD:0,videoUrl:'https://attacker.test/video.mp4'}};
  });
  $('longRefresh').click();await wait();await wait();
  assert.equal(calls.length,2);assert.ok(calls.every(p=>p.startsWith('/api/long/')));
  assert.equal($('longVideo').hidden,true);assert.match($('longCost').textContent,/ناونیشانی/);
});
test('a start response arriving after logout cannot poll or display another session',async t=>{
  const calls=[];let finish;
  const {$}=setup(t,async(path)=>{
    calls.push(path);
    if(path.endsWith('/start'))return new Promise(r=>{finish=()=>r({ok:true,json:async()=>({id:sourceId})});});
    return {ok:true,json:async()=>({id:sourceId,model:'gemini-omni-1.1-flash',outputSeconds:60,segments:12,
      apiUSD:1,totalEUR:1,canStart:true,nativeAudio:true})};
  });
  const w=$('longStart').ownerDocument.defaultView;w.confirm=()=>true;
  $('longQuote').click();await wait();$('longStart').click();await wait();
  assert.ok(finish);$('logoutBtn').click();w.localStorage.setItem('kurdai_session_token','different-owner');finish();await wait();
  assert.equal(calls.some(p=>p.includes('/status')),false);assert.equal($('longVideo').hidden,true);
});
