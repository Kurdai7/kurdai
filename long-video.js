// Owner costs only. No credits, retail margin, checkout fees or assumed tax.
import { audioPreview } from './dialogue.js';
import { OMNI_MODEL, validateOmniInput, quoteOmni } from './omni-cost.js';
import { reserveVideoCredits, settleVideoCredits, videoCreditPrice } from './video-credits.js';
export const LONG_PRICES = Object.freeze({ reviewed: '2026-10-14', fxDate: '2026-10-14',
  usdPerEUR: 1.1195, wan480PerSecond: 0.015, wan720PerSecond: 0.036, firstImageUSD: 0.003 });
export function longInput(body) {
  if (body?.model === OMNI_MODEL) return validateOmniInput(body);
  if (body?.model && body.model !== 'wan2.2-i2v-flash') throw new Error('Unknown video model.');
  const prompt = String(body.prompt || '').trim();
  if (!prompt || prompt.length > 650) throw new Error('Use a prompt of 1–650 characters for the economy model.');
  if (!['16:9', '9:16'].includes(body.aspectRatio)) throw new Error('Choose 16:9 or 9:16.');
  if (!['480p', '720p'].includes(body.resolution)) throw new Error('Choose 480p or 720p.');
  const identity = String(body.identity || '').trim();
  if (identity.length > 200) throw new Error('Character description must be at most 200 characters.');
  // Deliberately reject remote user URLs; the processor never downloads arbitrary URLs.
  const image = body.image || null;
  if (image && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(image)) throw new Error('Use an uploaded PNG/JPEG reference.');
  if (image && image.length > 5600000) throw new Error('Reference image exceeds 4 MiB.');
  if (image) {
    const bytes = atob(image.split(',')[1]);
    if (bytes.length > 4 * 1024 * 1024) throw new Error('Reference image exceeds 4 MiB.');
    if (!(image.startsWith('data:image/png;') ? bytes.startsWith('\x89PNG\r\n\x1a\n') : bytes.startsWith('\xff\xd8\xff')))
      throw new Error('Image content does not match its type.');
  }
  const language = body.language || 'none';
  if (!['none', 'sorani', 'badini'].includes(language)) throw new Error('Invalid dialogue language.');
  const dialogueText = String(body.dialogueText || '').trim();
  if (dialogueText.length > 5000) throw new Error('Dialogue exceeds 5000 characters.');
  if (language === 'none' && dialogueText) throw new Error('Choose a dialogue language before entering spoken lines.');
  const duration = body.duration === undefined ? 70 : body.duration;
  if (![60, 70].includes(duration)) throw new Error("Choose 60 or 70 seconds.");
  const input = { prompt, identity, image, language, dialogueText, aspectRatio: body.aspectRatio, resolution: body.resolution, duration };
  if (segmentPrompt(input, input.duration / 5 - 1).length > 800) throw new Error('Shorten the story and character description: the economy API allows 800 characters including continuity instructions.');
  return input;
}
export function quoteLong(input, costs = {}) {
  if (input.model === OMNI_MODEL) return quoteOmni(input,costs);
  const seconds = input.duration ?? 70;
  if (![60, 70].includes(seconds)) throw new Error('Choose 60 or 70 seconds.');
  const audioQuote = audioPreview(input.language || 'none', input.dialogueText || '', seconds);
  const apiUSD = seconds * (input.resolution === '720p' ? LONG_PRICES.wan720PerSecond : LONG_PRICES.wan480PerSecond)
    + (input.image ? 0 : LONG_PRICES.firstImageUSD);
  const known = ['mediaEUR', 'fxPercent', 'vatPercent'].every(k =>
    ['number','string'].includes(typeof costs[k]) && String(costs[k]).trim() !== '' && Number.isFinite(Number(costs[k])) && Number(costs[k]) >= 0)
    && Number(costs.fxPercent) <= 100 && Number(costs.vatPercent) <= 100;
  const apiEUR = apiUSD / LONG_PRICES.usdPerEUR;
  const mediaEUR = known ? Number(costs.mediaEUR) : null;
  const fxEUR = known ? apiEUR * Number(costs.fxPercent) / 100 : null;
  const vatEUR = known ? (apiEUR + fxEUR + mediaEUR) * Number(costs.vatPercent) / 100 : null;
  return { ...LONG_PRICES, model: 'wan2.2-i2v-flash', outputSeconds: seconds, segments: seconds / 5,
    segmentSeconds: 5, imageAPIUSD: input.image ? 0 : LONG_PRICES.firstImageUSD,
    apiUSD: Number(apiUSD.toFixed(6)), apiEUR, mediaEUR, fxEUR, vatEUR,
    totalEUR: known && audioQuote.enabled ? apiEUR + mediaEUR + fxEUR + vatEUR : null,
    costBasis: 'provider list price estimate; final invoice may differ', retailMarkupEUR: 0,
    audio: false, audioQuote, audioAPIUSD: audioQuote.apiUSD, identityGuaranteed: false, native70: false,
    canStart: known && costs.enabled === true && audioQuote.enabled,
    limitations: ['Silent video; Sorani speech and lip sync are not included.',
      'Last-frame conditioning reduces seams; identity and seamless movement are not guaranteed.',
      'Sorani prompt understanding is unverified; English motion instructions are recommended.',
      'No automatic paid retries. Failed jobs retain completed segments and may incur partial cost.'] };
}
export function segmentPrompt(input, index) {
  return `Stylized animation. Continuous shot, same camera, light, face, clothing and proportions. No cuts or new characters. Continue motion from the supplied image. ${input.identity}\nStory: ${input.prompt}\nPart ${index + 1}/${(input.duration ?? 70) / 5}, time ${index * 5}–${(index + 1) * 5}s. ${index === (input.duration ?? 70) / 5 - 1 ? 'End the action naturally.' : 'Progress the action gradually; do not end or recap.'}`;
}

export async function handleLong(request, env, user) {
  const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    if (!user) return json({ error: 'Please log in.' }, 401);
    if (!user.verified || !env.VIDEO_TEST_EMAIL || user.email.trim().toLowerCase() !== env.VIDEO_TEST_EMAIL.trim().toLowerCase())
      return json({ error: 'Only the verified owner can use the 70-second workflow.' }, 403);
    const url = new URL(request.url);
    const missingConfiguration = ['LONG_VIDEO_SERVICE_URL','LONG_VIDEO_SERVICE_SECRET'].filter(k => !env[k]);
    const configured = !missingConfiguration.length;
    if (request.method === 'GET' && url.pathname === '/api/long/capabilities' && !configured)
      return json({processorReachable: false, configured: false, missingConfiguration,
        canStartWithReference: false, canStartFromText: false, audioEnabled: {sorani: false, badini: false}, paidProviderProbe: false});
    if (request.method === 'POST' && url.pathname === '/api/long/quote' && !configured) {
      const input = longInput(await request.json());
      return json({ ...quoteLong(input), blockedReason: 'Media processor, provider access and full processing/FX/tax costs are not configured. No paid call is enabled.' });
    }
    if (!configured) return json({ error: 'The 70-second processor is not configured. No paid request was sent.' }, 503);
    // Validate quotes here too, so an empty form never becomes an opaque host error.
    if (request.method === 'POST' && url.pathname === '/api/long/quote') {
      let body;
      try { body = await request.clone().json(); } catch { return json({error: 'Invalid JSON request.'}, 400); }
      longInput(body);
    }
    const serviceSecret = String(env.LONG_VIDEO_SERVICE_SECRET).trim();
    if (!/^[\x21-\x7e]{32,}$/.test(serviceSecret))
      return json({error: 'Secret ـی Cloudflare شێوەی دروستی نییە؛ بەهای نوێی Render بە تەواوی کۆپی بکە، نەک ناوی خانەکە.', code: 'PROCESSOR_SECRET_FORMAT'}, 503);
    const base = new URL(env.LONG_VIDEO_SERVICE_URL);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('Processor requires HTTPS.');
    const path = url.pathname === '/api/long/capabilities' ? '/health' : url.pathname.slice('/api/long'.length);
    if (!((request.method === 'POST' && ['/quote', '/start', '/smoke'].includes(path)) ||
      (request.method === 'GET' && ['/health', '/status', '/file', '/jobs'].includes(path)))) return json({ error: 'Unknown route.' }, 404);
    const upstream = new URL(`/v1${path}`, base);
    if (url.searchParams.has('id')) upstream.searchParams.set('id', url.searchParams.get('id'));
    // Opt-in only: keep the existing owner-only gate and require an approved
    // retail rate. Never infer a selling price from a client's request body.
    const chargeCredits = env.VIDEO_PURCHASED_CREDITS_ENABLED === 'true';
    const billingMode = env.STRIPE_MODE;
    let startBody;
    const processorHeaders = { Authorization: `Bearer ${serviceSecret}`, 'X-KurdAI-Owner': user.id,
      'Content-Type': 'application/json' };
    if (chargeCredits && path === '/start') {
      startBody = await request.clone().json();
      if (!/^[a-f0-9-]{36}$/.test(startBody.id || '')) return json({error:'Invalid video ID.'},400);
      const checkUrl = new URL('/v1/status',base); checkUrl.searchParams.set('id',startBody.id);
      const check = await fetch(checkUrl,{headers:processorHeaders,redirect:'manual',signal:AbortSignal.timeout(30000)});
      if (!check.ok) { await check.body?.cancel(); return json({error:'Cannot confirm the video quote. No start request was sent.'},503); }
      const job = await check.json();
      if (job.id !== startBody.id) return json({error:'Processor video ID mismatch.'},502);
      const credits = videoCreditPrice(env,job.quote);
      if (startBody.approved !== true || startBody.approvedTotalEUR !== job.quote.totalEUR || startBody.approvedCredits !== credits)
        return json({error:'Approve the current video cost and credit price first.'},409);
      await reserveVideoCredits(env.DB,user.id,billingMode,job.id,credits,job.status==='quoted');
    }
    // Bound each readiness probe below client connection timeouts; the UI retries
    // only this read. Synthetic media and downloads retain their longer windows.
    const response = await fetch(upstream, { method: request.method, redirect: 'manual', signal: AbortSignal.timeout(path === '/file' ? 120000 : path === '/health' ? 10000 : path === '/smoke' ? 90000 : 30000),
      headers: { Authorization: `Bearer ${serviceSecret}`, 'X-KurdAI-Owner': user.id,
        'Content-Type': 'application/json' },
      ...(request.method === 'POST' ? { body: await request.text() } : {}) });
    // workerd supports manual/follow only. Never follow a redirect with credentials.
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return json({error: 'Processor redirect blocked; configure its direct HTTPS origin. No automatic generation retry was sent.', code: 'PROCESSOR_REDIRECT_BLOCKED'}, 502);
    }
    if (path === '/health' && [401,403].includes(response.status))
      return json({error: 'Render وەڵامی دا، بەڵام Secret ـی Cloudflare لەگەڵ Render یەکسان نییە.', code: 'PROCESSOR_AUTH_REJECTED'}, 503);
    if (chargeCredits && ['/quote','/start','/status'].includes(path)) {
      const data=await response.json();
      if (path==='/quote' && response.ok) {
        try { data.creditPrice=videoCreditPrice(env,data); data.creditMode=billingMode; }
        catch { data.canStart=false; data.blockedReasons=[...(data.blockedReasons || []),'Video credit pricing is not ready.']; }
      }
      if (response.ok && ['/start','/status'].includes(path) && data.id) {
        if (path==='/start' && data.id!==startBody.id) return json({error:'Processor video ID mismatch; reservation held for review.'},502);
        if (path==='/status' && data.id!==url.searchParams.get('id')) return json({error:'Processor video ID mismatch.'},502);
        await settleVideoCredits(env.DB,user.id,billingMode,data.id,data.status);
      }
      // Only explicit input/readiness rejections prove a start was not accepted.
      if (path==='/start' && [400,401,403,404,409,422].includes(response.status))
        await settleVideoCredits(env.DB,user.id,billingMode,startBody.id,'rejected');
      return json(data,response.status);
    }
    return new Response(response.body, { status: response.status, headers: { 'Cache-Control': 'private, no-store',
      'Content-Type': response.headers.get('content-type') || 'application/json',
      ...(path === '/file' ? { 'Content-Disposition': 'attachment; filename="KurdAI-video.mp4"' } : {}) } });
  } catch (error) {
    if ([400,402,409,503].includes(error.status)) return json({error:error.message},error.status);
    if (['TimeoutError','AbortError'].includes(error.name) && request.method === 'GET' && new URL(request.url).pathname === '/api/long/capabilities')
      return json({error: 'Render did not answer this 10-second readiness probe. No video request was sent.', code: 'PROCESSOR_READINESS_TIMEOUT', diagnosticVersion: 4}, 503);
    if (['TimeoutError','AbortError','TypeError'].includes(error.name))
      return json({error: 'The private video processor is unreachable. No automatic generation retry was sent.', code: 'PROCESSOR_NETWORK_ERROR', diagnosticVersion: 3}, 503);
    return json({ error: error.message }, 400);
  }
}
