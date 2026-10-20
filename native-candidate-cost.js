// Candidate quotes are deliberately non-payable until their actual routes are qualified.
export const NATIVE_CANDIDATE_MODELS=Object.freeze(['pixverse-v6','kling-3.0-standard','p-video-2']);
export function validateNativeCandidate(body) {
 if(!NATIVE_CANDIDATE_MODELS.includes(body?.model))throw new Error('Unknown candidate model.');
 if(body.mode && body.mode!=='new')throw new Error('Candidate video extension is not integrated.');
 if(body.image || body.referenceImages?.length)throw new Error('Candidate image references are not integrated yet.');
 if(!Array.isArray(body.referenceImages || []))throw new Error('Invalid references.');
 if(body.resolution!=='720p'||!['16:9','9:16'].includes(body.aspectRatio))throw new Error('Choose 720p and 16:9 or 9:16.');
 const maxSeconds=body.model==='p-video-2'?20:15;
 if(!Number.isInteger(body.duration)||body.duration<3||body.duration>maxSeconds)throw new Error(`Choose 3–${maxSeconds} seconds.`);
 if(!['sorani','badini'].includes(body.language))throw new Error('Choose Sorani or Badini separately.');
 const prompt=String(body.prompt||'').trim(),dialogueText=String(body.dialogueText||'').trim(),identity=String(body.identity||'').trim();
 if(!prompt||!dialogueText)throw new Error('Enter the scene and exact Kurdish dialogue.');
 if(new TextEncoder().encode(prompt+dialogueText+identity).length>1500)throw new Error('Shorten the scene, identities and dialogue to 1500 UTF-8 bytes.');
 return {model:body.model,mode:'new',prompt,dialogueText,identity,language:body.language,duration:body.duration,resolution:'720p',aspectRatio:body.aspectRatio};
}
export function quoteNativeCandidate(input) {
 // Published fal route rates; these are not final account invoices or EUR quotes.
 const kling=input.model==='kling-3.0-standard',pruna=input.model==='p-video-2';
 return {model:input.model,outputSeconds:input.duration,segments:1,segmentSeconds:input.duration,
  reviewed:'2026-10-20',nativeAudio:true,audio:true,
  audioQuote:{native:true,language:input.language},
  apiUSD:null,apiEUR:null,totalEUR:null,mediaEUR:null,fxEUR:null,vatEUR:null,retailMarkupEUR:0,
  ownerReview:pruna?{source:'VdoBloom web app',reviewed:'2026-10-20',soraniAccepted:true,apiVerified:false,badiniVerified:false}:null,
  providerReference:{provider:pruna?'Pruna':'fal',resolution:'720p',audio:true,
   outputUSD:Number((input.duration*(pruna?0.015:kling?0.126:0.06)).toFixed(6)),invoiceVerified:false,appliesToPreparedAdapter:true,...(pruna?{draft:true,billedBy:'returned whole seconds'}:{})},
  canStart:false,blockedReasons:[
   ...(pruna?['سۆرانی لە VdoBloom پەسەند کراوە؛ کلیلی API ـی Pruna هێشتا 401 دەدات. نرخی Draft تەنها هەڵسەنگاندنە.']:[]),
   'چالاککردنی API و تاقیکردنەوەی ڤیدیۆی ڕاستەقینە هێشتا ماون؛ هیچ پارەیەک وەرناگیرێت.',
   'نرخی کۆتایی، باج و خەرجییە زیادەکان پشتڕاست نەکراونەتەوە.',
   ...(kling?['ڕێگای Kling لە fal بۆ پاراستنی دیالۆگی کوردی هێشتا پەسەند نەکراوە.']:[]),
   ...(input.language==='badini'?['کوالێتی بادینی پێویستی بە گوێگرتن لە تاقیکردنەوەی جیاواز هەیە.']:[])
  ]};
}
