import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, copyFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { longInput, quoteLong, handleLong } from '../long-video.js';
import { advance, load } from '../processor/engine.js';
import { createProcessor } from '../processor/server.js';
import { normalize, prepareOpening, lastFrame, assemble, duration } from '../processor/media.js';
import { submitWan, submitImage, imageResult, download } from '../processor/providers.js';
const input = longInput({ prompt: 'A Kurdish animated character walks through the village.', identity: 'Red dress, black braid.', aspectRatio: '16:9', resolution: '480p' });
const costs = { mediaEUR: 0.01, fxPercent: 2, vatPercent: 0, enabled: true };
const temp = async t => { const path = await mkdtemp(join(tmpdir(), 'kurdai-long-')); t.after(() => rm(path, { recursive: true, force: true })); return path; };
const job = () => ({ id: crypto.randomUUID(), input, status: 'running', approvedAt: new Date().toISOString(),
  completedSegments: 0, reservedAPIUSD: 0, quote: quoteLong(input, costs) });

test('70-second admin quote counts all 14 video calls and the opening image; unknown costs block spending', async () => {
  const q = quoteLong(input, costs);
  assert.equal(q.apiUSD, 1.053); assert.equal(q.imageAPIUSD, 0.003); assert.equal(q.retailMarkupEUR, 0);
  assert.equal(q.totalEUR, q.apiEUR * 1.02 + 0.01); assert.equal(q.canStart, true);
  assert.equal(quoteLong(input).totalEUR, null); assert.equal(quoteLong(input).canStart, false);
  assert.equal(quoteLong({ ...input, image: 'existing' }, costs).apiUSD, 1.05);
  assert.equal(quoteLong({ ...input, resolution: '720p' }, costs).apiUSD, 2.523);
  assert.throws(() => longInput({ ...input, image: 'https://localhost/private' }));
  assert.throws(() => longInput({ ...input, image: 'data:image/png;base64,YQ==' }));
  const request = new Request('https://kurdai.net/api/long/quote', { method: 'POST', body: JSON.stringify(input) });
  assert.equal((await handleLong(request.clone(), {}, null)).status, 401);
  const response = await handleLong(request.clone(), { VIDEO_TEST_EMAIL: 'owner@example.com' }, { id: 'owner', email: 'owner@example.com', verified: true });
  assert.equal((await response.json()).canStart, false);
});

test('durable engine makes one image and 14 dependent I2V calls, saves frames, then produces one final file', async t => {
  const directory = await temp(t); const j = job(); let videos = 0, images = 0, assembled = 0;
  const p = { async submitImage() { images++; return 'image'; }, async imageResult() { return 'https://provider/image'; },
    async submitWan(_input, frame, prompt) { videos++; assert.match(frame, /^data:image\/png/); assert.match(prompt, /Red dress/); return `video-${videos}`; },
    async wanResult() { return 'https://provider/video'; }, async download(_url, path) { await writeFile(path, 'bytes'); } };
  const m = { async prepareOpening(_a, b) { await writeFile(b, 'png'); }, async normalize(_a, b) { await writeFile(b, 'clip'); },
    async lastFrame(_a, b) { await writeFile(b, 'png'); }, async assemble() { assembled++; } };
  for (let tick = 0; tick < 40 && j.status === 'running'; tick++) await advance(j, directory, {}, { providers: p, media: m });
  assert.equal(j.status, 'ready'); assert.equal(videos, 14); assert.equal(images, 1); assert.equal(assembled, 1);
  assert.equal(j.completedSegments, 14); assert.equal(j.reservedAPIUSD, j.quote.apiUSD);
  assert.equal((await load(directory)).status, 'ready');
  await advance(j, directory, {}, { providers: p, media: m }); assert.equal(videos, 14);
});

test('an ambiguous submission or interrupted submission never retries; approved budget is enforced', async t => {
  const directory = await temp(t); const j = job(); let calls = 0;
  const deps = { providers: { async submitImage() { calls++; throw new Error('Network timeout'); } } };
  await advance(j, directory, {}, deps); assert.equal(j.status, 'uncertain');
  await advance(j, directory, {}, deps); assert.equal(calls, 1);
  const interrupted = { ...job(), inflight: { state: 'submitting' } };
  await advance(interrupted, directory, {}, deps); assert.equal(interrupted.status, 'uncertain'); assert.equal(calls, 1);
  const budget = job(); budget.quote.apiUSD = 0;
  await advance(budget, directory, {}, deps); assert.equal(budget.status, 'failed'); assert.equal(calls, 1);
});

test('processor binds approval to owner, quote and total, is idempotent and retains its task across restart', async t => {
  const root = await temp(t);
  const config = { LONG_DATA_DIR: root, LONG_VIDEO_SERVICE_SECRET: 'x'.repeat(32), LONG_VIDEO_ENABLED: 'true',
    LONG_MEDIA_EUR: '0.01', LONG_FX_PERCENT: '0', LONG_VAT_PERCENT: '0', FAL_KEY: 'mock', DASHSCOPE_API_KEY: 'mock' };
  const p = await createProcessor(config);
  await new Promise(resolve => p.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${p.server.address().port}`;
  const headers = { Authorization: `Bearer ${config.LONG_VIDEO_SERVICE_SECRET}`, 'X-KurdAI-Owner': 'owner', 'Content-Type': 'application/json' };
  const post = (path, body, overrides = {}) => fetch(base + path, { method: 'POST', headers: { ...headers, ...overrides }, body: JSON.stringify(body) });
  t.after(async () => { await new Promise(resolve => p.server.close(resolve)); await p.close(); });
  assert.equal((await post('/v1/quote', input, { Authorization: 'bad' })).status, 401);
  const q = await (await post('/v1/quote', input)).json(); assert.equal(q.canStart, true);
  assert.equal((await post('/v1/start', { id: q.id })).status, 400);
  const approval = { id: q.id, approved: true, approvedTotalEUR: q.totalEUR };
  assert.equal((await post('/v1/start', approval, { 'X-KurdAI-Owner': 'other' })).status, 404);
  assert.equal((await post('/v1/start', { ...approval, approvedTotalEUR: 0 })).status, 400);
  assert.equal((await post('/v1/start', approval)).status, 202);
  assert.equal((await post('/v1/start', approval)).status, 200);
  const q2 = await (await post('/v1/quote', input)).json();
  assert.equal((await post('/v1/start', { ...approval, id: q2.id, approvedTotalEUR: q2.totalEUR })).status, 409);
  assert.equal((await load(join(root, q.id))).reservedAPIUSD, 0); // No tick, so absolutely no provider request.
  await new Promise(resolve => p.server.close(resolve)); await p.close();
  const restarted = await createProcessor(config);
  await new Promise(resolve => restarted.server.listen(0, '127.0.0.1', resolve));
  const response = await fetch(`http://127.0.0.1:${restarted.server.address().port}/v1/status?id=${q.id}`, { headers });
  assert.equal((await response.json()).status, 'running');
  await new Promise(resolve => restarted.server.close(resolve)); await restarted.close();
});

test('provider adapter sends documented parameters and uses returned fal queue URLs without leaking keys', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/video-synthesis')) return Response.json({ output: { task_id: 'video-1' } });
    if (options.method === 'POST') return Response.json({ request_id: 'image-1', status_url: 'https://queue.fal.run/fal-ai/flux/schnell/requests/image-1/status', response_url: 'https://queue.fal.run/fal-ai/flux/schnell/requests/image-1/response' });
    if (url.endsWith('/status')) return Response.json({ status: 'COMPLETED' });
    return Response.json({ images: [{ url: 'https://v3.fal.media/opening.png' }] });
  };
  await submitWan(input, 'data:image/png;base64,AAAA', 'continuous', 'secret');
  const body = JSON.parse(calls[0].options.body); assert.equal(body.parameters.duration, 5); assert.equal(body.parameters.resolution, '480P'); assert.equal(body.parameters.prompt_extend, false);
  const task = await submitImage(input, 'fal-secret');
  assert.equal(await imageResult(task, 'fal-secret'), 'https://v3.fal.media/opening.png');
  assert.match(calls.at(-1).url, /\/response$/);
  await assert.rejects(download('https://127.0.0.1/private', '/tmp/not-created'));
});

test('real FFmpeg normalizes media, extracts final frame and muxes a verified 70-second MP4 without paid AI', async t => {
  const directory = await temp(t); const source = join(directory, 'source.mp4');
  await promisify(execFile)('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=30', '-t', '5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', source]);
  await normalize(source, join(directory, 'clip-0.mp4'), '16:9', '480p');
  await lastFrame(join(directory, 'clip-0.mp4'), join(directory, 'frame.png')); await access(join(directory, 'frame.png'));
  await prepareOpening(join(directory, 'frame.png'), join(directory, 'portrait.png'), '9:16');
  for (let i = 1; i < 14; i++) await copyFile(join(directory, 'clip-0.mp4'), join(directory, `clip-${i}.mp4`));
  const final = await assemble(directory); assert.equal(await duration(final), 70);
});
