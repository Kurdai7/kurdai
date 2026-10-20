import {KURDISH_WARDROBE} from './kurdish-wardrobe.js';
// Gemini Omni transport. Not enabled by the website until its separate quote/
// approval integration is complete. Never reuse the silent Wan price for this model.
export const OMNI_MODEL = 'gemini-omni-1.1-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const interactionID = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,300}$/.test(value);
function safeUsage(value) {
  if(!value || typeof value!=='object')return {};
  const usage={};
  for(const key of ['total_input_tokens','total_output_tokens','total_thought_tokens','total_cached_tokens','total_tool_use_tokens','total_tokens'])
    if(Number.isSafeInteger(value[key]) && value[key]>=0)usage[key]=value[key];
  for(const key of ['input_tokens_by_modality','output_tokens_by_modality'])
    if(Array.isArray(value[key]))usage[key]=value[key].filter(x=>['text','video','audio','image'].includes(x?.modality) && Number.isSafeInteger(x.tokens) && x.tokens>=0)
      .map(x=>({modality:x.modality,tokens:x.tokens}));
  return Object.keys(usage).length?{usage}:{};
}

export function omniRequest(input, previousInteractionId) {
  if (!input || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 10000)
    throw new Error('A story prompt of 1–10000 characters is required.');
  if (!['16:9','9:16'].includes(input.aspectRatio)) throw new Error('Invalid Omni aspect ratio.');
  if (!['360p','720p','1080p','4k'].includes(input.resolution)) throw new Error('Invalid Omni resolution.');
  if (!['none','sorani','badini'].includes(input.language)) throw new Error('Choose a separate dialogue language.');
  if (![5,10].includes(input.segmentSeconds)) throw new Error('Choose a five- or ten-second segment.');
  if (previousInteractionId !== undefined && !interactionID(previousInteractionId)) throw new Error('Invalid previous interaction ID.');
  const dialogue = String(input.dialogueText || '').trim();
  if (dialogue.length > 5000 || (input.language === 'none' && dialogue)) throw new Error('Invalid dialogue input.');
  const language = input.language === 'sorani'
    ? 'Speak only Sorani Kurdish (Central Kurdish), with natural Sorani pronunciation and expressions. Do not switch to Badini, Kurmanji, Arabic or English.'
    : input.language === 'badini'
      ? 'Speak only Badini Kurdish, with natural Badini pronunciation and expressions. Do not switch to Sorani, Arabic or English.'
      : 'No spoken dialogue.';
  const text = [previousInteractionId
    ? 'Extend the previously generated video from its exact final frame. Output only the new continuation. Preserve the same camera motion, setting, faces, clothes, proportions and character voices. No cut, reset, black frame or recap.'
    : 'Create a stylized animated video. Preserve the supplied character identities and reference designs. No live-action people.',
    KURDISH_WARDROBE,
    `Generate ${input.segmentSeconds} seconds.`,
    `Character identities: ${String(input.identity || '').slice(0,2000)}`,
    `Story action: ${input.prompt.trim()}`, language,
    dialogue ? `Speak these exact lines in order, without translation or additional dialogue:\n${dialogue}` : '',
    'Do not overlay subtitles or title text.'].filter(Boolean).join('\n');
  const images = [...(input.image ? [input.image] : []), ...(input.referenceImages || [])];
  if (!Array.isArray(input.referenceImages || []) || images.length > 3) throw new Error('Use at most three image references.');
  const content = images.map(image => {
    if (typeof image !== 'string') throw new Error('Invalid image reference.');
    const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    if (!match || match[2].length > 5592408) throw new Error('Use uploaded PNG/JPEG images up to 4 MiB.');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.toString('base64') !== match[2] || bytes.length > 4194304 ||
        !(match[1] === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.subarray(0,3).equals(Buffer.from([255,216,255]))))
      throw new Error('Image content does not match its type.');
    return {type:'image', mime_type:match[1], data:match[2]};
  });
  return {model:OMNI_MODEL, input:[...content,{type:'text',text}],
    response_format:{type:'video',aspect_ratio:input.aspectRatio,resolution:input.resolution,delivery:'uri'},
    store:true, background:false, stream:false,
    ...(previousInteractionId ? {previous_interaction_id:previousInteractionId} : {})};
}

function fileResource(uri) {
  let url;
  try { url = new URL(uri); } catch { throw new Error('Invalid Omni file URI.'); }
  const match = /^\/v1beta\/files\/([A-Za-z0-9_-]+)(?::download)?$/.exec(url.pathname);
  if (url.origin !== 'https://generativelanguage.googleapis.com' || url.username || url.password || url.hash || !match)
    throw new Error('Untrusted Omni file URI.');
  return `${BASE}/files/${match[1]}`;
}

export function parseOmniInteraction(data) {
  if (!interactionID(data?.id)) throw new Error('No valid Omni interaction ID; do not resubmit automatically.');
  if (['failed','cancelled','canceled'].includes(data.status)) throw new Error('Omni generation failed; no automatic paid retry.');
  if (['in_progress','queued'].includes(data.status)) return {id:data.id,status:data.status,...safeUsage(data.usage)};
  if (data.status !== 'completed') throw new Error('Unknown Omni status; inspect the provider before resubmitting.');
  const videos = (data.steps || []).filter(step => step.type === 'model_output')
    .flatMap(step => Array.isArray(step.content) ? step.content : []).filter(item => item.type === 'video');
  if (videos.length !== 1 || videos[0].mime_type !== 'video/mp4') throw new Error('Expected one Omni MP4 output.');
  const video = videos[0];
  if (video.uri) return {id:data.id,status:'completed',fileResource:fileResource(video.uri),...safeUsage(data.usage)};
  if (typeof video.data !== 'string' || video.data.length > 89478488 || !/^[A-Za-z0-9+/]+={0,2}$/.test(video.data))
    throw new Error('Invalid or oversized inline Omni output.');
  const bytes = Buffer.from(video.data,'base64');
  if (bytes.toString('base64') !== video.data || bytes.length > 67108864 || bytes.subarray(4,8).toString() !== 'ftyp')
    throw new Error('Invalid inline Omni MP4.');
  return {id:data.id,status:'completed',bytes,...safeUsage(data.usage)};
}

// An uncertain POST is intentionally never retried here. The calling job engine
// must persist its submission marker and approved quote before calling submit.
export function createOmniClient(config, fetcher = fetch) {
  async function call(url, options = {}, binary = false) {
    if (!config.apiKey) throw new Error('Omni API access is not configured.');
    const response = await fetcher(url,{...options,redirect:'manual',signal:AbortSignal.timeout(240000),
      headers:{'x-goog-api-key':config.apiKey,'Content-Type':'application/json'}});
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Omni HTTP ${response.status}; inspect the provider before resubmitting.`);
    }
    const chunks=[]; let length=0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > (binary ? 67108864 : 96*1024*1024)) throw new Error('Omni response exceeds the media limit.');
      chunks.push(chunk);
    }
    const bytes=Buffer.concat(chunks);
    if (binary) {
      if (bytes.subarray(4,8).toString() !== 'ftyp') throw new Error('Omni download is not an MP4.');
      return bytes;
    }
    try {return JSON.parse(bytes.toString());} catch {throw new Error('Invalid Omni JSON response.');}
  }
  return {
    async submit(input, previousInteractionId) {
      if (config.enabled !== true) throw new Error('Omni generation is disabled; no paid request was sent.');
      const body = omniRequest(input,previousInteractionId);
      return parseOmniInteraction(await call(`${BASE}/interactions`,{method:'POST',body:JSON.stringify(body)}));
    },
    async poll(id) {
      if (!interactionID(id)) throw new Error('Invalid Omni interaction ID.');
      return parseOmniInteraction(await call(`${BASE}/interactions/${encodeURIComponent(id)}`));
    },
    async media(result) {
      if (result.bytes) return result.bytes;
      const resource = fileResource(result.fileResource);
      const metadata=await call(resource);
      const state=typeof metadata.state === 'object' ? metadata.state.name : metadata.state;
      if (state === 'PROCESSING') return null;
      if (state !== 'ACTIVE') throw new Error('Omni output file is not active.');
      return call(`${resource}:download?alt=media`,{},true);
    }
  };
}
