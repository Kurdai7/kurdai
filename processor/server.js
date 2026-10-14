// Separate FFmpeg host, NOT a Cloudflare Worker. One process per durable data directory.
import http from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, readFile, access, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { longInput, quoteLong } from '../long-video.js';
import { verifyRuntime } from './media.js';
import { advance, save, load, publicLongJob } from './engine.js';

export async function createProcessor(config, dependencies = {}) {
  const mediaTools = await verifyRuntime();
  const root = resolve(config.LONG_DATA_DIR || './long-video-data');
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (!config.LONG_VIDEO_SERVICE_SECRET || config.LONG_VIDEO_SERVICE_SECRET.length < 32)
    throw new Error('A service secret of at least 32 characters is required.');
  // Lock prevents a second processor from submitting duplicate jobs against the same files.
  const lock = join(root, '.processor-lock'); await mkdir(lock);
  let chain = Promise.resolve();
  const serial = fn => { const task = chain.then(fn); chain = task.catch(() => {}); return task; };
  const jobs = new Map();
  for (const id of await readdir(root)) if (/^[a-f0-9-]{36}$/.test(id)) {
    const job = await load(join(root, id)); jobs.set(id, job);
  }
  const costs = input => ({ mediaEUR: config.LONG_MEDIA_EUR, fxPercent: config.LONG_FX_PERCENT,
    vatPercent: config.LONG_VAT_PERCENT,
    enabled: config.LONG_VIDEO_ENABLED === 'true' && !!config.DASHSCOPE_API_KEY && (!!input?.image || !!config.FAL_KEY)
      && new Date().toISOString().slice(0, 10) <= '2026-10-21' });
  const send = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const hash = value => createHash('sha256').update(value).digest();
  const server = http.createServer(async (req, res) => {
    try {
      // Loopback health check returns no owner data, job IDs, configuration or keys.
      if (req.method === 'GET' && req.url === '/healthz') return send(res, {ok: true, mediaTools, protocolVersion: 3, outputDurations: [60,70]});
      if (!timingSafeEqual(hash(req.headers.authorization || ''), hash(`Bearer ${config.LONG_VIDEO_SERVICE_SECRET}`))) return send(res, { error: 'Unauthorized.' }, 401);
      const owner = req.headers['x-kurdai-owner'];
      if (typeof owner !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(owner)) return send(res, { error: 'Invalid owner.' }, 400);
      const url = new URL(req.url, 'http://processor');
      if (config.PROCESSOR_DIAGNOSTICS === 'true') console.info('processor_request', JSON.stringify({method: req.method,
        route: ['/v1/health','/v1/quote','/v1/start','/v1/jobs','/v1/status','/v1/file'].includes(url.pathname) ? url.pathname : 'unknown'}));
      if (req.method === 'GET' && url.pathname === '/v1/health') {
        const ready = image => quoteLong({resolution:'480p',image,language:'none'}, costs({image})).canStart;
        return send(res, {processorReachable: true, mediaTools, outputDurations: [60,70], protocolVersion: 3,
          canStartWithReference: ready(true), canStartFromText: ready(false),
          providerConfigured: {wan: !!config.DASHSCOPE_API_KEY, openingImage: !!config.FAL_KEY},
          missingCosts: ['LONG_MEDIA_EUR','LONG_FX_PERCENT','LONG_VAT_PERCENT'].filter(k => config[k] === undefined || config[k] === ''),
          audioEnabled: {sorani: false, badini: false}, paidProviderProbe: false});
      }
      if (req.method === 'GET' && url.pathname === '/v1/jobs')
        return send(res, { jobs: [...jobs.values()].filter(j => j.owner === owner).map(publicLongJob).reverse().slice(0, 30) });
      if (req.method === 'GET') {
        const job = jobs.get(url.searchParams.get('id'));
        if (!job || job.owner !== owner) return send(res, { error: 'Not found.' }, 404);
        if (url.pathname === '/v1/status') return send(res, publicLongJob(job));
        if (url.pathname === '/v1/file' && job.status === 'ready') {
          const file = join(root, job.id, 'final.mp4'); await access(file);
          res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'private, no-store' });
          createReadStream(file).on('error', () => res.destroy()).pipe(res); return;
        }
        return send(res, { error: 'Not ready or unknown route.' }, 404);
      }
      if (req.method !== 'POST') return send(res, { error: 'Method not allowed.' }, 405);
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 5700000) { send(res, { error: 'Request too large.' }, 413); return; } }
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, {error: 'Invalid JSON request.', code: 'PROCESSOR_INVALID_INPUT'}, 400); }
      await serial(async () => {
        if (url.pathname === '/v1/quote') {
          let input;
          try { input = longInput(body); } catch (error) { return send(res, {error: error.message, code: 'PROCESSOR_INVALID_INPUT'}, 400); }
          const quote = quoteLong(input, costs(input));
          const id = randomUUID(), expiresAt = new Date(Date.now() + 15 * 60000).toISOString();
          const job = { id, owner, input, quote, expiresAt, status: 'quoted', completedSegments: 0, reservedAPIUSD: 0 };
          await save(job, join(root, id)); jobs.set(id, job);
          return send(res, { ...quote, id, expiresAt });
        }
        if (url.pathname !== '/v1/start') return send(res, { error: 'Unknown route.' }, 404);
        const job = jobs.get(body.id);
        if (!job || job.owner !== owner) return send(res, { error: 'Not found.' }, 404);
        if (job.status !== 'quoted') return send(res, publicLongJob(job)); // Replay never generates again.
        const current = quoteLong(job.input, costs(job.input));
        if (!current.canStart || JSON.stringify(current) !== JSON.stringify(job.quote)) return send(res, { error: 'Processor or costs changed; request a new quote.' }, 409);
        if (Date.parse(job.expiresAt) < Date.now()) return send(res, { error: 'Quote expired.' }, 409);
        if (body.approved !== true || body.approvedTotalEUR !== job.quote.totalEUR)
          return send(res, { error: 'Explicit approval of the quoted total is required.' }, 400);
        if ([...jobs.values()].some(j => ['running', 'uncertain'].includes(j.status)))
          return send(res, { error: 'An active or uncertain job must be resolved first.' }, 409);
        job.status = 'running'; job.approvedAt = new Date().toISOString();
        await save(job, join(root, job.id)); send(res, publicLongJob(job), 202);
      });
    } catch (error) {
      if (config.PROCESSOR_DIAGNOSTICS === 'true') console.error('processor_request_failed', JSON.stringify({
        method: req.method, route: ['/v1/health','/v1/quote','/v1/start','/v1/jobs','/v1/status','/v1/file'].includes(String(req.url).split('?')[0]) ? String(req.url).split('?')[0] : 'unknown',
        errorType: ['TypeError','Error','SyntaxError','RangeError'].includes(error.name) ? error.name : 'Error',
        code: /^[A-Z_]{1,40}$/.test(error.code || '') ? error.code : 'INTERNAL'
      })); // Never log body, prompts, owners, headers, credential values or raw exceptions.
      if (!res.headersSent) send(res, {error: 'Processor request failed. Check server logs and stored job status.', code: 'PROCESSOR_INTERNAL_ERROR'}, 500);
    }
  });
  let timer, closed = false;
  const tick = () => serial(async () => {
    const job = [...jobs.values()].find(j => j.status === 'running');
    if (job) await advance(job, join(root, job.id), config, dependencies);
  });
  return { server, tick,
    start() { timer = setInterval(() => tick().catch(() => {}), 15000); timer.unref(); },
    async close() { if (closed) return; closed = true; clearInterval(timer); await chain; await rm(lock, { recursive: true, force: true }); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.PROCESSOR_BIND_HOST || '127.0.0.1';
  if (!['127.0.0.1','0.0.0.0'].includes(host)) throw new Error('Use an explicit loopback or container bind address.');
  const port = Number(process.env.PORT || 8788);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const processor = await createProcessor(process.env);
  processor.server.listen(port, host); processor.start();
  const shutdown = () => processor.server.close(async () => { await processor.close(); process.exit(0); });
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
