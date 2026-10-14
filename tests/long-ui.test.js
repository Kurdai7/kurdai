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
  let enabled = false, consent = false;
  w.confirm = () => consent;
  w.fetch = async (path, options = {}) => {
    records.push({ path, options });
    const q = { id: 'quote', apiUSD: 1.053, apiEUR: 1.053 / 1.1188, mediaEUR: enabled ? 0.01 : null,
      fxEUR: enabled ? 0 : null, vatEUR: enabled ? 0 : null, totalEUR: enabled ? 0.9512 : null, canStart: enabled };
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
  $('longQuote').click(); await wait(); assert.equal($('longStart').disabled, true);
  assert.match($('longCost').textContent, /0.9412/);
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
  dom.window.close();
});
