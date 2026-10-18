import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('signed-in public accounts cannot expose owner generation and retain format/dialect choices',async()=>{
  const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://kurdai.net',runScripts:'outside-only'});
  const w=dom.window,$=id=>w.document.getElementById(id),calls=[];
  w.localStorage.setItem('kurdai_session_token','public-test-session');
  w.HTMLMediaElement.prototype.pause=w.HTMLMediaElement.prototype.load=()=>{};
  w.fetch=async(path,options)=>{
    calls.push(path);
    const data=path==='/api/me'?{email:'public@example.test',dailyCredits:30}:
      path==='/api/health'?{registrationConfigured:false}:
      path==='/api/video-capabilities'?{configured:true,accountAllowed:false,accountVerified:true}:{jobs:[]};
    return {ok:true,status:200,json:async()=>data};
  };
  w.eval(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal($('longPanel').hidden,true);assert.equal($('generate').disabled,true);
  assert.equal($('nativeQuote').disabled,true);assert.equal($('registerBtn').disabled,true);
  $('generate').click();$('nativeQuote').click();
  assert.equal(calls.includes('/api/generate'),false);assert.equal(calls.includes('/api/video-quote'),false);
  assert.deepEqual(Array.from($('aspectRatio').options,o=>o.value),['16:9','9:16']);
  assert.deepEqual(Array.from($('language').options,o=>o.value),['sorani','badini','none']);
  dom.window.close();
});

test('dialect recommendations choose existing routes without spending, exposing panels or changing extension inputs',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://kurdai.net',runScripts:'outside-only'});
 const w=dom.window,$=id=>w.document.getElementById(id),calls=[];
 w.fetch=async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({})};};
 w.HTMLMediaElement.prototype.pause=w.HTMLMediaElement.prototype.load=()=>{};
 w.eval(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'));
 w.eval(readFileSync(new URL('../public/long-app.js',import.meta.url),'utf8'));
 await new Promise(resolve=>setTimeout(resolve,10));
 $('recommendSorani').click();assert.equal($('longPanel').hidden,true);
 $('recommendBadini').click();assert.equal($('model').value,'veo-3.1-lite-generate-preview');assert.equal($('language').value,'badini');
 $('videoMode').value='extend';$('model').value='veo-3.1-fast-generate-preview';$('recommendBadini').click();
 assert.equal($('videoMode').value,'extend');assert.equal($('model').value,'veo-3.1-fast-generate-preview');
 $('longPanel').hidden=false;$('longMode').value='extension';$('longLanguage').value='badini';$('recommendSorani').click();assert.equal($('longLanguage').value,'badini');
 $('longMode').value='new';$('longModel').value='heygen-video-1';$('longStart').disabled=false;$('recommendSorani').click();
 assert.equal($('longModel').value,'gemini-omni-1.1-flash');assert.equal($('longLanguage').value,'sorani');assert.equal($('longStart').disabled,true);
 assert.equal(calls.filter(c=>c.options?.method==='POST').length,0);
 dom.window.close();
});
