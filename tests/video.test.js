import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleVideo, validateInput, downloadVideo, VIDEO_SCHEMA } from '../video.js';
import worker from '../worker.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run('owner', 'owner@example.com', 'hash', 1, new Date().toISOString());
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run('other', 'other@example.com', 'hash', 1, new Date().toISOString());
  function prepare(sql) {
    let args = [];
    return { bind(...values) { args = values; return this; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { const out = db.prepare(sql).run(...args); return { meta: { changes: Number(out.changes) } }; }
    };
  }
  let queue = Promise.resolve();
  return { prepare, batch(statements) { const next = queue.then(async () => { db.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } }); queue = next.catch(() => {}); return next; }, raw: db };
}
const owner = { id: 'owner', email: ' OWNER@example.com ', verified: 1 };
const other = { id: 'other', email: 'other@example.com', verified: 1 };
const fresh = overrides => ({ requestId: crypto.randomUUID(), prompt: 'کارتۆنێکی کوردی، سڵاو.', duration: 8, ...overrides });
function env() { return { DB: d1(), GEMINI_API_KEY: 'test-secret', VIDEO_GENERATION_ENABLED: 'true', VIDEO_TEST_EMAIL: 'owner@example.com' }; }
function post(body) { return new Request('https://kurdai.net/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
const get = path => new Request(`https://kurdai.net${path}`);
const operation = 'models/veo-3.1-fast-generate-preview/operations/test123';
const videoURI = 'https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media';
const originalFetch = globalThis.fetch;
function mockFetch(t, fn) { globalThis.fetch = fn; t.after(() => { globalThis.fetch = originalFetch; }); }
const png = { mimeType: 'image/png', data: Buffer.from('\x89PNG\r\n\x1a\nfixture', 'latin1').toString('base64') };

test('validates aspect ratios, durations, reference limits and contradictory combinations', () => {
  const input = validateInput(fresh({ aspectRatio: '9:16', referenceImages: [png] }));
  assert.equal(input.aspectRatio, '9:16'); assert.equal(input.instance.referenceImages.length, 1);
  assert.match(input.instance.prompt, /natural Sorani Kurdish/); assert.match(input.instance.prompt, /no live-action humans/);
  for (const invalid of [{ duration: 70 }, { aspectRatio: '1:1' }, { duration: 4, resolution: '1080p' },
    { duration: 6, referenceImages: [png] }, { referenceImages: Array(4).fill(png) },
    { mode: 'extend', referenceImages: [png] }, { mode: 'frame' }, { firstFrame: png },
    { referenceImages: [{ ...png, mimeType: 'image/jpeg' }] }, { model: 'arbitrary' }])
    assert.throws(() => validateInput(fresh(invalid)));
});

test('generation persists one job and is idempotent for replay/concurrent requests', async t => {
  const config = env(); let calls = 0; let sent;
  mockFetch(t, async (url, options) => { calls++; sent = JSON.parse(options.body); return Response.json({ name: operation }); });
  const body = fresh({ aspectRatio: '9:16', referenceImages: [png] });
  const results = await Promise.all([handleVideo(post(body), config, owner), handleVideo(post(body), config, owner)]);
  assert.equal(calls, 1); const jobs = await Promise.all(results.map(r => r.json()));
  assert.equal(jobs[0].id, jobs[1].id); assert.equal(sent.parameters.aspectRatio, '9:16');
  assert.equal(sent.instances[0].referenceImages[0].image.inlineData.mimeType, 'image/png');
  const blocked = await handleVideo(post(fresh()), config, owner); assert.equal(blocked.status, 409); assert.equal(calls, 1);
});

test('authentication and owner billing boundary block calls before Google', async t => {
  mockFetch(t, () => { throw new Error('Must not call Google'); }); const config = env();
  assert.equal((await handleVideo(post(fresh()), config, null)).status, 401);
  assert.equal((await handleVideo(post(fresh()), config, other)).status, 403);
  assert.equal((await handleVideo(post(fresh()), config, { ...owner, verified: 0 })).status, 403);
  config.VIDEO_GENERATION_ENABLED = 'false'; assert.equal((await handleVideo(post(fresh()), config, owner)).status, 503);
  const cap = await (await handleVideo(get('/api/video-capabilities'), config, owner)).json(); assert.equal(cap.configured, false);
});

test('polling stores result, streams privately and prevents another user accessing it', async t => {
  const config = env(); let calls = 0;
  mockFetch(t, async (url, options) => {
    calls++;
    if (options?.method === 'POST') return Response.json({ name: operation });
    if (url === videoURI) return new Response('mp4-fixture', { headers: { 'Content-Type': 'video/mp4' } });
    return Response.json({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: videoURI } }] } } });
  });
  const created = await (await handleVideo(post(fresh()), config, owner)).json();
  assert.equal((await handleVideo(get(`/api/video-status?job=${created.id}`), config, other)).status, 404);
  const ready = await (await handleVideo(get(`/api/video-status?job=${created.id}`), config, owner)).json();
  assert.equal(ready.ready, true); assert.equal(ready.canExtend, true); assert.ok(!JSON.stringify(ready).includes(videoURI));
  const file = await handleVideo(get(ready.videoUrl), config, owner); assert.equal(await file.text(), 'mp4-fixture'); assert.equal(file.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await handleVideo(get(ready.videoUrl), config, other)).status, 404);
  assert.equal(calls, 3);
});

test('extension uses an owned generated video, retains ratio, and combines duration by +7', async t => {
  const config = env(); await config.DB.batch(VIDEO_SCHEMA.map(sql => config.DB.prepare(sql)));
  const stamp = new Date().toISOString();
  config.DB.raw.prepare(`INSERT INTO video_jobs (id,user_id,request_id,operation,status,video_uri,model,mode,aspect_ratio,resolution,duration,extension_count,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('parent','owner','old-request-id-123',operation,'ready',videoURI,'veo-3.1-fast-generate-preview','new','9:16','720p',8,0,stamp,stamp);
  let sent;
  mockFetch(t, async (url, options) => {
    if (options?.method === 'POST') { sent = JSON.parse(options.body); return Response.json({ name: operation }); }
    return new Response('original-video');
  });
  const wrong = await handleVideo(post(fresh({ mode: 'extend', parentJobId: 'parent', aspectRatio: '16:9' })), config, owner); assert.equal(wrong.status, 400);
  config.DB.raw.prepare('UPDATE video_jobs SET updated_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z', 'parent');
  assert.equal((await handleVideo(post(fresh({ mode: 'extend', parentJobId: 'parent', aspectRatio: '9:16' })), config, owner)).status, 400);
  config.DB.raw.prepare('UPDATE video_jobs SET updated_at=?,resolution=? WHERE id=?').run(stamp, '1080p', 'parent');
  assert.equal((await handleVideo(post(fresh({ mode: 'extend', parentJobId: 'parent', aspectRatio: '9:16' })), config, owner)).status, 400);
  config.DB.raw.prepare('UPDATE video_jobs SET resolution=? WHERE id=?').run('720p', 'parent');
  const response = await handleVideo(post(fresh({ mode: 'extend', parentJobId: 'parent', aspectRatio: '9:16' })), config, owner);
  const job = await response.json(); assert.equal(job.duration, 15);
  assert.equal(sent.parameters.durationSeconds, 8); assert.equal(sent.parameters.resolution, '720p');
  assert.equal(Buffer.from(sent.instances[0].video.inlineData.data, 'base64').toString(), 'original-video');
  assert.match(sent.instances[0].prompt, /Continue immediately from the final frame/);
});

test('a previous final frame is sent as image input, not misrepresented as native extension', async t => {
  const config = env(); let sent;
  mockFetch(t, async (url, options) => { sent = JSON.parse(options.body); return Response.json({ name: operation }); });
  const result = await (await handleVideo(post(fresh({ mode: 'frame', firstFrame: png, duration: 6 })), config, owner)).json();
  assert.equal(result.mode, 'frame'); assert.equal(result.duration, 6);
  assert.equal(sent.instances[0].image.inlineData.data, png.data); assert.equal(sent.instances[0].video, undefined);
});

test('Google quota failures release active lock; ambiguous network outcomes do not retry', async t => {
  const config = env(); let calls = 0;
  mockFetch(t, async () => { calls++; return Response.json({ error: { message: 'key=secret', code: 429 } }, { status: 429 }); });
  const body = fresh(); const failed = await (await handleVideo(post(body), config, owner)).json(); assert.equal(failed.status, 'failed'); assert.match(failed.error, /quota/); assert.ok(!failed.error.includes('secret'));
  globalThis.fetch = async () => { calls++; throw new Error('network'); };
  const retryBody = fresh(); const uncertain = await (await handleVideo(post(retryBody), config, owner)).json(); assert.equal(uncertain.status, 'uncertain');
  await handleVideo(post(retryBody), config, owner); assert.equal(calls, 2);
  assert.equal((await handleVideo(post(fresh()), config, owner)).status, 409);
});

test('safety filtering reaches terminal failure rather than polling forever', async t => {
  const config = env(); let generated = false;
  mockFetch(t, async () => { if (!generated) { generated = true; return Response.json({ name: operation }); }
    return Response.json({ done: true, response: { generateVideoResponse: { raiMediaFilteredReasons: ['blocked'] } } }); });
  const created = await (await handleVideo(post(fresh()), config, owner)).json();
  const failed = await (await handleVideo(get(`/api/video-status?job=${created.id}`), config, owner)).json(); assert.equal(failed.status, 'failed'); assert.equal(failed.done, true);
});

test('cross-origin redirects never receive key and untrusted download hosts are blocked', async t => {
  const seen = [];
  mockFetch(t, async (url, options) => { seen.push({ url, options }); return seen.length === 1 ? new Response(null, { status: 302, headers: { location: 'https://storage.googleapis.com/signed-video?sig=test' } }) : new Response('bytes'); });
  await downloadVideo(videoURI, 'PRIVATE'); assert.equal(seen[0].options.headers['x-goog-api-key'], 'PRIVATE'); assert.equal(seen[1].options.headers['x-goog-api-key'], undefined);
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://attacker.example/steal' } });
  await assert.rejects(() => downloadVideo(videoURI, 'PRIVATE'), /Unexpected video redirect/);
  await assert.rejects(() => downloadVideo('https://attacker.example', 'PRIVATE'), /Unexpected provider/);
});

test('Worker health reports missing bindings and API does not fall through to static assets', async () => {
  const response = await worker.fetch(get('/api/health'), {}); assert.equal(response.status, 503);
  const payload = await response.json(); assert.equal(payload.videoConfigured, false);
  const missing = await worker.fetch(get('/api/video-status?job=x'), {}); assert.equal(missing.status, 401);
  const asset = await worker.fetch(get('/'), { ASSETS: { fetch: () => new Response('site') } }); assert.equal(await asset.text(), 'site');
});
