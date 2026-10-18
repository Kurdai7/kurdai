// WaveSpeedAI LTX-2.3 transport. Opt-in only; caller owns budget authorization,
// durable idempotency, and all paid submission decisions. Never auto-retry POST.
import { prepareLtxSpeech } from './ltx-speech-adapter.js';
export const LTX_SUBMIT_URL='https://api.wavespeed.ai/api/v3/wavespeed-ai/ltx-2.3/text-to-video';
export const LTX_RESULT_BASE='https://api.wavespeed.ai/api/v3/predictions/';
export function buildLtxRequest({language,dialogueText,visualPrompt,aspectRatio='16:9',extraEUR=null,maxEUR=0.20,usdPerEUR=1.12}) {
  if (!['16:9','9:16'].includes(aspectRatio)) throw new Error('Invalid aspect ratio.');
  const prepared=prepareLtxSpeech({language,dialogueText,visualPrompt,extraEUR,maxEUR,usdPerEUR});
  return Object.freeze({url:LTX_SUBMIT_URL,body:Object.freeze({
    prompt:prepared.prompt,resolution:'720p',aspect_ratio:aspectRatio,duration:5
  }),budget:prepared.budget,canSubmit:false,
    reason:'Requires explicit paid-test approval, provider key, durable deduplication and dialect acceptance.'});
}
export function ltxResultUrl(id) {
  if(typeof id!=='string'|| !/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw new Error('Invalid prediction id.');
  return LTX_RESULT_BASE+encodeURIComponent(id)+'/result';
}
export function parseLtxStatus(response) {
  const data=response?.data;
  if(!data||typeof data!=='object')throw new Error('Missing prediction data.');
  const status=String(data.status||'');
  if(!['created','pending','processing','completed','failed','cancelled','timeout','deleted'].includes(status))
    throw new Error('Unknown prediction status.');
  return Object.freeze({id:data.id,status,terminal:['completed','failed','cancelled','timeout','deleted'].includes(status),
    outputs:status==='completed'&&Array.isArray(data.outputs)?data.outputs:[]});
}

/**
 * Transport primitives. The authenticated processor must persist an approved,
 * single-use reservation before invoking submitLtxOnce. No automatic retries.
 * An ambiguous timeout MUST be reconciled in the vendor dashboard.
 */
export async function submitLtxOnce({apiKey,request,approved=false,fetchImpl=fetch}) {
  if (approved !== true || request?.canSubmit !== true)
    throw new Error('Paid LTX submission is disabled until approved quote and durable reservation are verified.');
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('Missing WaveSpeed API key.');
  if (request.url !== LTX_SUBMIT_URL || request.body?.duration !== 5 ||
      request.body?.resolution !== '720p') throw new Error('Unexpected LTX request.');
  const response = await fetchImpl(request.url,{
    method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify(request.body),signal:AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`WaveSpeed submit returned HTTP ${response.status}; do not retry automatically.`);
  const payload=await response.json();
  const id=payload?.data?.id;
  if(typeof id!=='string'|| !/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new Error('WaveSpeed submission returned no valid prediction ID; reconcile provider dashboard.');
  return Object.freeze({id,status:payload.data.status||'created'});
}
export async function pollLtx({apiKey,predictionId,fetchImpl=fetch}) {
  if(typeof apiKey!=='string'||!apiKey.trim()) throw new Error('Missing WaveSpeed API key.');
  const response=await fetchImpl(ltxResultUrl(predictionId),{
    method:'GET',headers:{Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(20000)
  });
  if(!response.ok) throw new Error(`WaveSpeed status returned HTTP ${response.status}.`);
  return parseLtxStatus(await response.json());
}
