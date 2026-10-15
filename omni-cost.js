// Shared browser/Worker/Node-safe Omni validation and owner cost estimates.
// These are provider list-price estimates, never a promised final invoice.
export const OMNI_MODEL = 'gemini-omni-1.1-flash';
export const OMNI_PRICES = Object.freeze({reviewed:'2026-10-15',expires:'2026-10-21',
  inputPerMillionUSD:1.5,textPerMillionUSD:9,videoPerMillionUSD:17.5,videoTokensPerSecond720:5792,
  usdPerEUR:1.1195,fxDate:'2026-10-14'});
const number = value => ['string','number'].includes(typeof value) && String(value).trim() !== '' &&
  Number.isFinite(Number(value)) && Number(value)>=0 ? Number(value) : null;

export function validateOmniInput(body) {
  const prompt=String(body.prompt || '').trim(), identity=String(body.identity || '').trim();
  if (!prompt || prompt.length>10000) throw new Error('پرۆمپتێک لە ١ تا ١٠٠٠٠ پیت بنووسە.');
  if (identity.length>2000) throw new Error('ناسنامەی کارەکتەر زیاتر لە ٢٠٠٠ پیتە.');
  const duration=body.duration;
  if (!Number.isInteger(duration) || duration<5 || duration>70 || duration%5) throw new Error('ماوەی ٥ تا ٧٠ چرکە، بە هەنگاوی ٥ چرکە، هەڵبژێرە.');
  if (!['16:9','9:16'].includes(body.aspectRatio)) throw new Error('16:9 یان 9:16 هەڵبژێرە.');
  // Only 720p has a verified token-per-second cost in this implementation.
  if (body.resolution!=='720p') throw new Error('Omni لەم وەشانەدا بە 720p کار دەکات.');
  const language=body.language || 'none', dialogueText=String(body.dialogueText || '').trim();
  if (!['none','sorani','badini'].includes(language)) throw new Error('زمانی دیالۆگ هەڵبژێرە.');
  if (dialogueText.length>5000 || (language==='none' && dialogueText)) throw new Error('زمانێک بۆ دیالۆگە نووسراوەکە هەڵبژێرە.');
  if (!Array.isArray(body.referenceImages || [])) throw new Error('وێنەی ڕەفەرەنس دروست نییە.');
  const images=[...(body.image ? [body.image] : []),...(body.referenceImages || [])];
  if (images.length>3) throw new Error('تا سێ وێنە بەکاربهێنە.');
  let imageBytes=0;
  for(const image of images) {
    if (typeof image!=='string' || image.length>5592450) throw new Error('وێنەی PNG/JPEG تا 4 MiB بەکاربهێنە.');
    const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    if(!match) throw new Error('تەنها وێنەی بارکراوی PNG/JPEG پەسەند دەکرێت.');
    const bytes=atob(match[2]);imageBytes+=bytes.length;
    if(bytes.length>4194304 || btoa(bytes)!==match[2] || !(match[1]==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):bytes.startsWith('\xff\xd8\xff')))
      throw new Error('ناوەڕۆکی وێنە دروست نییە.');
  }
  if(imageBytes>12*1024*1024) throw new Error('قەبارەی وێنەکان زۆرە.');
  // Preserve exact lines and order; no automatic dialect translation or paid planner.
  const lines=dialogueText?dialogueText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean):[];
  const count=duration/5;
  if(lines.length>count) throw new Error(`بۆ ئەم ماوەیە تا ${count} هێڵی دیالۆگ بنووسە؛ هەر هێڵێک بۆ دیمەنێکە.`);
  if(lines.some(line=>line.length>140)) throw new Error('هەر هێڵی دیالۆگ کورت بکەوە، تا ١٤٠ پیت بۆ دیمەنێک.');
  const dialogueSegments=Array(count).fill('');
  lines.forEach((line,i)=>{dialogueSegments[i]=line;});
  return {model:OMNI_MODEL,prompt,identity,duration,aspectRatio:body.aspectRatio,resolution:'720p',language,dialogueText,
    dialogueSegments,image:images[0] || null,referenceImages:images.slice(1)};
}

export function quoteOmni(input,costs={}) {
  const count=input.duration/5;
  const perSecond=OMNI_PRICES.videoTokensPerSecond720*OMNI_PRICES.videoPerMillionUSD/1e6;
  const minimum=input.duration*perSecond;
  const inputTokens=number(costs.omniInputTokensPerSegment),textTokens=number(costs.omniTextTokensPerSegment);
  const media=number(costs.mediaEUR),fx=number(costs.fxPercent),vat=number(costs.vatPercent);
  const metersKnown=inputTokens!==null && textTokens!==null;
  // Budget ten seconds per request even though only five seconds are requested.
  // Actual token usage is reconciled after each response, not hidden in credits.
  const step=metersKnown?Number((10*perSecond+inputTokens*OMNI_PRICES.inputPerMillionUSD/1e6+textTokens*OMNI_PRICES.textPerMillionUSD/1e6).toFixed(6)):null;
  const apiUSD=step===null?null:Number((step*count).toFixed(6));
  const apiEUR=apiUSD===null?null:apiUSD/OMNI_PRICES.usdPerEUR;
  const complete=apiEUR!==null && media!==null && fx!==null && vat!==null && fx<=100 && vat<=100;
  const fxEUR=complete?apiEUR*fx/100:null,vatEUR=complete?(apiEUR+fxEUR+media)*vat/100:null;
  const blockers=[];
  if(!metersKnown) blockers.push('خەرجی تۆکنی چوونەژوورەوە، مێژووی بەردەوامکردن و تێکستی دەرچوو هێشتا دیاری نەکراوە.');
  if(!complete) blockers.push('کۆی خەرجی پرۆسێسکردن، گۆڕینی دراو یان باج تەواو نییە.');
  if(costs.omniConfigured!==true) blockers.push('پەیوەندی Gemini API لە سێرڤەری ڤیدیۆ ڕێک نەخراوە.');
  if(costs.durableStorage!==true) blockers.push('هەڵگرتنی بەردەوامی فایل و دۆخی داواکاری هێشتا پشتڕاست نەکراوەتەوە.');
  if(costs.omniBillingVerified!==true) blockers.push('ژمێریاری تۆکن و دەرئەنجامی بەردەوامکردنی Omni پێویستی بە پشتڕاستکردنەوە هەیە.');
  if(costs.omniEnabled!==true) blockers.push('دروستکردنی Omni لە سێرڤەر هێشتا داخراوە.');
  if(new Date().toISOString().slice(0,10)>OMNI_PRICES.expires) blockers.push('نرخەکان پێویستیان بە نوێکردنەوە هەیە.');
  return {...OMNI_PRICES,model:OMNI_MODEL,outputSeconds:input.duration,segments:count,segmentSeconds:5,
    apiMinimumUSD:Number(minimum.toFixed(6)),apiMinimumEUR:minimum/OMNI_PRICES.usdPerEUR,
    serviceCostBreakdown:{currency:'EUR',outputOnly:true,
      firstSegmentVideoEUR:5*perSecond/OMNI_PRICES.usdPerEUR,
      continuationVideoEUR:(input.duration-5)*perSecond/OMNI_PRICES.usdPerEUR,
      inputAndHistoryEUR:null,textOutputEUR:null,
      nativeAudioAdditionalEUR:0,stitchingEUR:media,
      mode:input.image?'image-to-video':'text-to-video',
      note:'Continuation output is included, not added again to the requested-duration video total. Input/history and generated text remain additional unknown costs.'},
    apiUSD,apiEUR,mediaEUR:media,fxEUR,vatEUR,totalEUR:complete?apiEUR+media+fxEUR+vatEUR:null,
    segmentBudgetsUSD:step===null?[]:Array(count).fill(Number(step.toFixed(6))),
    retailMarkupEUR:0,audio:input.language!=='none',nativeAudio:true,audioAPIUSD:0,
    audioQuote:{language:input.language,enabled:true,native:true},identityGuaranteed:false,native70:false,
    canStart:blockers.length===0,blockedReasons:blockers,
    costBasis:'Conservative token allowance estimate, not a guaranteed charge cap or final invoice. Native audio is included in video output; input/context/text tokens are additional.',
    limitations:['Sorani/Badini API speech quality and consistent character voices remain unverified.',
      'Identity and seamless continuation are requested, not guaranteed.',
      'Failed/short outputs can incur charges. Uncertain submissions are never automatically retried.']};
}
