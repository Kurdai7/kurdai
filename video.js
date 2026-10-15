// Official API contracts: https://ai.google.dev/gemini-api/docs/veo
// No provider keys, generated URIs, or uploaded image data are returned to clients.
import { spendingPolicy, budgetAllows } from './spending.js';
import { nativeCost, inputHash } from './native-cost.js';
import { DIALECTS, dialogueInstruction } from './dialogue.js';
export const MODELS = ['veo-3.1-fast-generate-preview', 'veo-3.1-generate-preview', 'veo-3.1-lite-generate-preview'];
const API = 'https://generativelanguage.googleapis.com/v1beta/';
const MAX_BODY = 18 * 1024 * 1024;
const MAX_VIDEO = 12 * 1024 * 1024;
const OPERATION = /^models\/veo-3\.1(?:-fast|-lite)?-generate-preview\/operations\/[a-zA-Z0-9_-]+$/;
export const VIDEO_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS video_jobs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL, operation TEXT, status TEXT NOT NULL, video_uri TEXT, error TEXT,
    model TEXT NOT NULL, mode TEXT NOT NULL, aspect_ratio TEXT NOT NULL, resolution TEXT NOT NULL,
    duration INTEGER NOT NULL, extension_count INTEGER NOT NULL DEFAULT 0, parent_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'unknown', UNIQUE(user_id, request_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS video_jobs_active_user ON video_jobs(user_id)
    WHERE status IN ('submitting', 'running', 'uncertain')`,
  'CREATE INDEX IF NOT EXISTS video_jobs_history ON video_jobs(user_id, created_at DESC)',
  `CREATE TABLE IF NOT EXISTS video_quotes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, request_id TEXT NOT NULL,
    input_hash TEXT NOT NULL, cost_json TEXT NOT NULL, expires_at TEXT NOT NULL, UNIQUE(user_id,request_id))`
];
const json = (data, status = 200) => Response.json(data, { status, headers: {
  'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'
}});
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();

async function limitedBytes(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) fail('File is too large.', 413);
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) fail('File is too large.', 413);
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export function validateImage(value) {
  if (!value || !['image/jpeg', 'image/png'].includes(value.mimeType))
    fail('Use a PNG or JPEG image.');
  const data = value.data;
  if (typeof data !== 'string' || !data.length || data.length > 5592408 ||
      data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) fail('Invalid image or image larger than 4 MiB.');
  let bytes;
  try { bytes = atob(data); } catch { fail('Invalid image encoding.'); }
  if (bytes.length > 4 * 1024 * 1024) fail('Image larger than 4 MiB.');
  const png = bytes.startsWith('\x89PNG\r\n\x1a\n');
  const jpeg = bytes.startsWith('\xff\xd8\xff');
  if (value.mimeType === 'image/png' ? !png : !jpeg) fail('Image content does not match its file type.');
  return { inlineData: { mimeType: value.mimeType, data } };
}

export function validateInput(body) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 4000) fail('Prompt must contain 1 to 4000 characters.');
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId || '')) fail('A valid request ID is required.');
  const mode = body.mode || 'new';
  if (!['new', 'extend', 'frame'].includes(mode)) fail('Invalid generation mode.');
  const model = body.model || MODELS[0];
  if (!MODELS.includes(model)) fail('Unsupported Veo model.');
  const aspectRatio = body.aspectRatio || '16:9';
  if (!['16:9', '9:16'].includes(aspectRatio)) fail('Choose 16:9 or 9:16.');
  const resolution = body.resolution || '720p';
  if (!['720p', '1080p'].includes(resolution)) fail('Choose 720p or 1080p.');
  const duration = body.duration ?? 8;
  if (![4, 6, 8].includes(duration)) fail('Veo supports 4, 6, or 8 seconds for a new clip.');
  if (!['sorani', 'badini', 'none'].includes(body.language || 'sorani')) fail('Invalid dialogue language.');
  const styles = ['3D Animation', 'Cartoon', 'Cinematic', 'Realistic'];
  if (!styles.includes(body.style || '3D Animation')) fail('Invalid video style.');
  if (body.referenceImages !== undefined && !Array.isArray(body.referenceImages)) fail('Invalid reference images.');
  const references = body.referenceImages || [];
  if (references.length > 3) fail('Use at most three reference images.');
  if (model.includes('-lite-') && (references.length || mode === 'extend'))
    fail('Veo Lite supports text and first-frame images, but not reference images or native extension.');
  const images = references.map(image => ({ image: validateImage(image), referenceType: 'asset' }));
  const frame = body.firstFrame ? validateImage(body.firstFrame) : null;
  if (mode === 'frame' && !frame) fail('Choose the previous final frame.');
  if (mode !== 'frame' && frame) fail('Starting frames require frame mode.');
  if (images.length && mode !== 'new') fail('Reference images are available for new videos; use the original clip for extension.');
  if ((images.length || resolution === '1080p' || mode === 'extend') && duration !== 8)
    fail('References, 1080p, and extension require an 8-second generation setting.');
  if (mode === 'extend' && resolution !== '720p') fail('Video extension requires 720p.');
  const language = dialogueInstruction(body.language || 'sorani');
  const continuity = mode === 'extend' || mode === 'frame' ?
    'Continue immediately from the final frame and action. Preserve camera movement, lighting, faces, clothing and character proportions. No reset, recap, black frame or title card.' :
    'Preserve the identity, faces, clothing and proportions of the supplied reference characters throughout the shot.';
  const style = body.style || '3D Animation';
  const visual = ['3D Animation', 'Cartoon'].includes(style) ? `${style}. Clearly stylized animation; no live-action humans.` : `${style} visual style.`;
  return { model, mode, duration, resolution, aspectRatio, language: body.language || 'sorani',
    instance: { prompt: `${visual}\n${continuity}\n${language}\nNo subtitles unless explicitly requested below.\n\n${prompt}`,
      ...(images.length ? { referenceImages: images } : {}), ...(frame ? { image: frame } : {}) } };
}

function expired(job) { return Date.now() - Date.parse(job.updated_at) >= 48 * 60 * 60 * 1000; }
export function publicJob(job) {
  const ready = job.status === 'ready';
  return { id: job.id, operation: job.operation, status: job.status, ready,
    done: ['ready', 'failed', 'uncertain'].includes(job.status), error: job.error || null,
    apiCost: job.cost_json ? JSON.parse(job.cost_json) : null,
    model: job.model, mode: job.mode, aspectRatio: job.aspect_ratio, language: job.language || 'unknown',
    resolution: job.resolution, duration: job.duration, createdAt: job.created_at,
    expired: ready && expired(job),
    canExtend: ready && !expired(job) && job.resolution === '720p' && job.duration <= 141 && job.extension_count < 20 && !job.model.includes('-lite-') && ['sorani', 'badini', 'none'].includes(job.language),
    ...(ready ? { videoUrl: `/api/video-file?job=${encodeURIComponent(job.id)}` } : {}) };
}

function checkVideoURI(value) {
  let uri; try { uri = new URL(value); } catch { fail('Invalid provider video URI.', 502); }
  if (uri.protocol !== 'https:' || uri.hostname !== 'generativelanguage.googleapis.com' || uri.port || uri.username || uri.password)
    fail('Unexpected provider video host.', 502);
  return uri;
}

// Follow signed Google download redirects without forwarding the API key to other hosts.
export async function downloadVideo(value, key) {
  let uri = checkVideoURI(value);
  for (let hops = 0; hops < 5; hops++) {
    const headers = uri.hostname === 'generativelanguage.googleapis.com' ? { 'x-goog-api-key': key } : {};
    const response = await fetch(uri.href, { headers, redirect: 'manual', signal: AbortSignal.timeout(60000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) fail('Missing video redirect.', 502);
    uri = new URL(location, uri);
    const host = uri.hostname;
    if (uri.protocol !== 'https:' || uri.port || uri.username || uri.password ||
        !(host === 'generativelanguage.googleapis.com' || host === 'storage.googleapis.com' ||
          host.endsWith('.googleusercontent.com') || host.endsWith('.gstatic.com')))
      fail('Unexpected video redirect host.', 502);
  }
  fail('Too many video download redirects.', 502);
}

async function providerError(response, fallback) {
  const data = await response.json().catch(() => ({}));
  // Do not expose provider strings which may contain signed URIs or credentials.
  if (response.status === 429) return 'Google quota or billing limit reached. Check the Google project quota and billing.';
  if (response.status === 401 || response.status === 403) return 'Google API access was denied. Check the configured project access and billing.';
  if (response.status === 404) return 'This Veo model or generated file is unavailable in the configured Google project.';
  return data.error?.code ? `${fallback} (Google code ${Number(data.error.code) || response.status}).` : fallback;
}

async function ensureSchema(db) {
  await db.batch(VIDEO_SCHEMA.map(sql => db.prepare(sql)));
  const columns = await db.prepare('PRAGMA table_info(video_jobs)').all();
  if (!columns.results.some(column => column.name === 'language')) {
    try { await db.prepare("ALTER TABLE video_jobs ADD COLUMN language TEXT NOT NULL DEFAULT 'unknown'").run(); }
    catch (error) { if (!/duplicate column/i.test(error.message)) throw error; }
  }
  for (const column of ['quote_id', 'cost_json']) {
    if (!columns.results.some(c => c.name === column)) {
      try { await db.prepare(`ALTER TABLE video_jobs ADD COLUMN ${column} TEXT`).run(); }
      catch (error) { if (!/duplicate column/i.test(error.message)) throw error; }
    }
  }
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS video_jobs_quote ON video_jobs(quote_id) WHERE quote_id IS NOT NULL').run();
}
async function ownedJob(db, user, jobId) {
  return db.prepare('SELECT * FROM video_jobs WHERE id=? AND user_id=?').bind(jobId, user.id).first();
}

export async function handleVideo(request, env, user) {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/video-capabilities' && request.method === 'GET') {
      const allowed = !!user && !!env.VIDEO_TEST_EMAIL && user.email.trim().toLowerCase() === env.VIDEO_TEST_EMAIL.trim().toLowerCase();
      return json({ spending:spendingPolicy(env), configured: !!env.DB && !!env.GEMINI_API_KEY && env.VIDEO_GENERATION_ENABLED === 'true' && spendingPolicy(env).enabled,
        accountAllowed: allowed, accountVerified: !!user?.verified,
        missingConfiguration: [!env.DB && 'DB', !env.GEMINI_API_KEY && 'GEMINI_API_KEY',
          env.VIDEO_GENERATION_ENABLED !== 'true' && 'VIDEO_GENERATION_ENABLED', !env.VIDEO_TEST_EMAIL && 'VIDEO_TEST_EMAIL'].filter(Boolean),
        publicGenerationEnabled:false,providerGenerationVerified:false,
        featureStatus:{textToVideo:'owner-test-only',imageToVideo:'owner-test-only',referenceImages:'owner-test-only',extension:'owner-test-only',longVideo:'not-ready'},
        costApprovalRequired: true, models: MODELS, durations: [4, 6, 8], aspectRatios: ['16:9', '9:16'],
        maxReferenceImages: 3, extensionSeconds: 7, soraniGuaranteed: false, badiniGuaranteed: false,
        dialogueLanguages: Object.entries(DIALECTS).map(([id, d]) => ({ id, label: d.label,
          nativeVideoVerified: false, ttsDocumented: d.ttsDocumented, ttsEnabled: false })),
        audioBilling: 'Native Veo audio is included in the video rate; separate TTS is disabled.', billing: 'owner_google_project' });
    }
    if (!user) return json({ error: 'Please log in.' }, 401);
    if (!user.verified) return json({ error: 'Verify your email first.' }, 403);
    if (!env.DB) return json({ error: 'Database is not configured.' }, 503);
    await ensureSchema(env.DB);
    if (url.pathname === '/api/video-jobs' && request.method === 'GET') {
      const rows = await env.DB.prepare('SELECT * FROM video_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(user.id).all();
      return json({ jobs: rows.results.map(publicJob) });
    }
    if (['/api/generate', '/api/video-quote'].includes(url.pathname) && request.method === 'POST') {
      if (env.VIDEO_GENERATION_ENABLED !== 'true' || !env.GEMINI_API_KEY)
        return json({ error: 'Video generation is not configured or enabled.' }, 503);
      // Preserve the existing owner's billing boundary. Public credit debiting is not implemented.
      if (!env.VIDEO_TEST_EMAIL || user.email.trim().toLowerCase() !== env.VIDEO_TEST_EMAIL.trim().toLowerCase())
        return json({ error: 'Generation is currently available only to the configured test account.' }, 403);
      if (!request.headers.get('content-type')?.includes('application/json')) fail('Use a JSON request.', 415);
      let body;
      try { body = JSON.parse(new TextDecoder().decode(await limitedBytes(request, MAX_BODY))); }
      catch (error) { if (error.status) throw error; fail('Invalid JSON request.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Invalid request.');
      const input = validateInput(body);
      const existing = await env.DB.prepare('SELECT * FROM video_jobs WHERE user_id=? AND request_id=?').bind(user.id, body.requestId).first();
      if (existing) return json(publicJob(existing));
      let parent = null;
      let duration = input.duration; let extensionCount = 0;
      if (input.mode === 'extend') {
        parent = await ownedJob(env.DB, user, body.parentJobId || '');
        if (!parent || !publicJob(parent).canExtend) fail('Select a ready 720p Veo video from this account, generated or extended within 48 hours.');
        if (input.aspectRatio !== parent.aspect_ratio) fail('Extension must keep the original aspect ratio.');
        if (input.model !== parent.model) fail('Extension must keep the original Veo model.');
        if (parent.language !== input.language) fail('Extension must keep the original dialogue language. Older videos with unknown language require a new clip.');
      }
      const hash = await inputHash(input, body);
      const cost = nativeCost(input, parent);
      if (!budgetAllows(spendingPolicy(env), cost.apiUSD))
        return json({error:'API spending is disabled or the request exceeds its limit. No paid request was sent.'},503);
      if (url.pathname === '/api/video-quote') {
        const previous = await env.DB.prepare('SELECT * FROM video_quotes WHERE user_id=? AND request_id=?').bind(user.id, body.requestId).first();
        if (previous) {
          if (previous.input_hash !== hash) fail('Request changed. Request a new quote with a new request ID.', 409);
          return json({ ...JSON.parse(previous.cost_json), id: previous.id, expiresAt: previous.expires_at });
        }
        const id = crypto.randomUUID(), expiresAt = new Date(Date.now() + 15 * 60000).toISOString();
        await env.DB.prepare('INSERT OR IGNORE INTO video_quotes (id,user_id,request_id,input_hash,cost_json,expires_at) VALUES (?,?,?,?,?,?)')
          .bind(id, user.id, body.requestId, hash, JSON.stringify(cost), expiresAt).run();
        const saved = await env.DB.prepare('SELECT * FROM video_quotes WHERE user_id=? AND request_id=?').bind(user.id, body.requestId).first();
        if (saved.input_hash !== hash) fail('Request changed. Request a new quote with a new request ID.', 409);
        return json({ ...JSON.parse(saved.cost_json), id: saved.id, expiresAt: saved.expires_at });
      }
      const quote = await env.DB.prepare('SELECT * FROM video_quotes WHERE id=? AND user_id=?').bind(body.quoteId || '', user.id).first();
      if (!quote || quote.request_id !== body.requestId || quote.input_hash !== hash ||
          Date.parse(quote.expires_at) <= Date.now() || quote.cost_json !== JSON.stringify(cost) || !cost.canStart ||
          body.approved !== true || body.approvedAPIEUR !== cost.apiEUR)
        fail('A current matching API cost quote and explicit approval are required. No paid request was sent.', 409);
      if (parent) {
        // REST extension accepts inline video data. Use only a server-owned Veo output.
        const source = await downloadVideo(parent.video_uri, env.GEMINI_API_KEY);
        if (!source.ok) fail(await providerError(source, 'Could not read the source video.'), 502);
        const bytes = await limitedBytes(source, MAX_VIDEO);
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192)
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        input.instance.video = { inlineData: { mimeType: 'video/mp4', data: btoa(binary) } };
        duration = parent.duration + 7;
        extensionCount = parent.extension_count + 1;
      }
      const jobId = crypto.randomUUID(); const stamp = now();
      const claim = await env.DB.prepare(`INSERT OR IGNORE INTO video_jobs
        (id,user_id,request_id,status,model,mode,aspect_ratio,resolution,duration,extension_count,parent_id,created_at,updated_at,language,quote_id,cost_json)
        SELECT ?,?,?,'submitting',?,?,?,?,?,?,?,?,?,?,?,?
        WHERE (SELECT COALESCE(SUM(CASE WHEN json_valid(cost_json) AND json_type(cost_json,'$.apiUSD') IN ('integer','real')
          AND json_extract(cost_json,'$.apiUSD') > 0 THEN json_extract(cost_json,'$.apiUSD') ELSE 1e99 END),0)
          FROM video_jobs WHERE created_at >= ?) + ? <= ?`).bind(jobId, user.id, body.requestId,
        input.model, input.mode, input.aspectRatio, input.resolution, duration, extensionCount, parent?.id || null, stamp, stamp, input.language, quote.id, quote.cost_json, stamp.slice(0,10), cost.apiUSD, spendingPolicy(env).perDayUSD).run();
      if (!claim.meta?.changes) {
        const replay = await env.DB.prepare('SELECT * FROM video_jobs WHERE user_id=? AND request_id=?').bind(user.id, body.requestId).first();
        if (replay) return json(publicJob(replay));
        const active = await env.DB.prepare("SELECT id FROM video_jobs WHERE user_id=? AND status IN ('submitting','running','uncertain')").bind(user.id).first();
        return json({ error: 'An active request or the daily API reservation limit blocks generation. No new paid request was sent.', jobId: active?.id }, 409);
      }
      let result;
      try {
        result = await fetch(`${API}models/${input.model}:predictLongRunning`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify({ instances: [input.instance], parameters: {
            aspectRatio: input.aspectRatio, resolution: input.resolution, durationSeconds: input.duration
          } }), signal: AbortSignal.timeout(60000)
        });
        if (!result.ok) {
          const message = await providerError(result, 'Google rejected the video request.');
          // 5xx responses are ambiguous: do not automatically issue another paid call.
          await env.DB.prepare('UPDATE video_jobs SET status=?,error=?,updated_at=? WHERE id=?')
            .bind(result.status >= 500 ? 'uncertain' : 'failed', message, now(), jobId).run();
          return json(publicJob(await ownedJob(env.DB, user, jobId)), 200);
        }
        const data = await result.json();
        if (!OPERATION.test(data.name || '')) throw new Error('Missing valid provider operation');
        await env.DB.prepare("UPDATE video_jobs SET operation=?,status='running',updated_at=? WHERE id=?").bind(data.name, now(), jobId).run();
        if (parent) await env.DB.prepare('UPDATE video_jobs SET updated_at=? WHERE id=?').bind(now(), parent.id).run();
      } catch {
        await env.DB.prepare("UPDATE video_jobs SET status='uncertain',error=?,updated_at=? WHERE id=? AND status='submitting'")
          .bind('The request outcome is uncertain. Do not retry payment; check Google generation logs before an administrator clears the active request.', now(), jobId).run();
      }
      return json(publicJob(await ownedJob(env.DB, user, jobId)), 202);
    }
    if (['/api/video-status', '/api/video-file'].includes(url.pathname) && request.method === 'GET') {
      const job = await ownedJob(env.DB, user, url.searchParams.get('job') || '');
      if (!job) return json({ error: 'Video job not found for this account.' }, 404);
      if (url.pathname === '/api/video-file') {
        if (job.status !== 'ready' || !job.video_uri) fail('Video is not ready.', 409);
        if (expired(job)) fail('Google video retention has expired. Use your downloaded copy.', 410);
        if (!env.GEMINI_API_KEY) fail('Video API is not configured.', 503);
        const result = await downloadVideo(job.video_uri, env.GEMINI_API_KEY);
        if (!result.ok) fail(await providerError(result, 'Video download failed.'), 502);
        return new Response(result.body, { headers: { 'Content-Type': 'video/mp4',
          'Content-Disposition': `inline; filename="kurdai-${job.id}.mp4"`,
          'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
      }
      if (job.status !== 'running') return json(publicJob(job));
      if (!OPERATION.test(job.operation || '')) fail('Invalid stored operation.', 502);
      if (!env.GEMINI_API_KEY) fail('Video API is not configured.', 503);
      const result = await fetch(API + job.operation, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(30000) });
      if (!result.ok) return json({ error: await providerError(result, 'Could not check video status. Resume checking; do not create another video.') }, 502);
      const data = await result.json();
      if (!data.done) return json(publicJob(job));
      const uri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (uri) {
        checkVideoURI(uri);
        await env.DB.prepare("UPDATE video_jobs SET status='ready',video_uri=?,updated_at=? WHERE id=? AND status='running'").bind(uri, now(), job.id).run();
      } else {
        const filtered = data.response?.generateVideoResponse?.raiMediaFilteredReasons;
        const message = data.error ? 'Google could not complete this video. Review the prompt, project access, and provider logs.' :
          filtered?.length ? 'Google safety or audio processing blocked this video. Review the prompt.' : 'Google completed the operation without a video file.';
        await env.DB.prepare("UPDATE video_jobs SET status='failed',error=?,updated_at=? WHERE id=? AND status='running'").bind(message, now(), job.id).run();
      }
      return json(publicJob(await ownedJob(env.DB, user, job.id)));
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    if (!error.status) console.error('Video workflow failed:', error.name);
    return json({ error: error.status ? error.message : 'Video service error. Check the existing job before retrying generation.' }, error.status || 503);
  }
}
