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
