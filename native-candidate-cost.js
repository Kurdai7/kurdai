// Candidate quotes are deliberately non-payable until their actual routes are qualified.
import {prunaOutputCost,PRUNA_PRICE_REVIEWED} from './pruna-pricing.js';
export const NATIVE_CANDIDATE_MODELS=Object.freeze(['pixverse-v6','kling-3.0-standard','p-video-2']);
export function validateNativeCandidate(body,{internalPrompt=false}={}) {
 if(!NATIVE_CANDIDATE_MODELS.includes(body?.model))throw new Error('Unknown candidate model.');
 if(body.mode && body.mode!=='new' && !(body.model==='p-video-2'&&body.mode==='extension'))throw new Error('Candidate video extension is not integrated.');
 if(body.mode==='extension'&&!/^[a-f0-9-]{36}$/.test(body.sourceJobId||''))throw new Error('Choose a completed source video.');
 if((body.image && body.model!=='p-video-2') || body.referenceImages?.length)throw new Error('Candidate image references are not integrated yet.');
 if(!Array.isArray(body.referenceImages || []))throw new Error('Invalid references.');
 if(!['720p',...(body.model==='p-video-2'?['704p']:[])].includes(body.resolution)||!['16:9','9:16'].includes(body.aspectRatio))throw new Error('Choose 720p and 16:9 or 9:16.');
 const maxSeconds=body.model==='p-video-2'?70:15;
 if(!Number.isInteger(body.duration)||body.duration<3||body.duration>maxSeconds)throw new Error(`Choose 3–${maxSeconds} seconds.`);
 if(!['sorani','badini'].includes(body.language))throw new Error('Choose Sorani or Badini separately.');
 let image=null;
 if(body.model==='p-video-2'&&body.image){
  if(typeof body.image!=='string'||body.image.length>5600000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(body.image))throw new Error('Use an uploaded PNG/JPEG up to 4 MiB.');
  const bytes=atob(body.image.split(',')[1]);if(bytes.length>4194304||!(body.image.startsWith('data:image/png;')?bytes.startsWith('\x89PNG\r\n\x1a\n'):bytes.startsWith('\xff\xd8\xff')))throw new Error('Image content does not match type.');
  image=body.image;
 }
 const prompt=String(body.prompt||'').trim(),dialogueText=String(body.dialogueText||'').trim(),identity=String(body.identity||'').trim();
 if(!prompt||!dialogueText)throw new Error('Enter the scene and exact Kurdish dialogue.');
 if(body.model==='p-video-2' && dialogueText.split(/\s+/u).length>Math.floor(body.duration*2.5))throw new Error('دیالۆگەکە بۆ ئەم ماوەیە درێژە؛ دەقەکە کورت بکەرەوە یان ماوەکە زیاد بکە.');
 const maxBytes=body.model==='p-video-2'?(internalPrompt?11000:10000):1000;
 if(new TextEncoder().encode(prompt+dialogueText+identity).length>maxBytes)throw new Error(`Shorten the scene, identities and dialogue to ${maxBytes} UTF-8 bytes.`);
 return {model:body.model,mode:body.mode||'new',...(body.mode==='extension'?{sourceJobId:body.sourceJobId}:{}),...(image?{image}:{}),prompt,dialogueText,identity,language:body.language,duration:body.duration,resolution:body.resolution,aspectRatio:body.aspectRatio};
}
export function quoteNativeCandidate(input, costs={}) {
 if(input.model==='p-video-2')return quotePruna(input,costs);
 // Published fal route rates; these are not final account invoices or EUR quotes.
 const kling=input.model==='kling-3.0-standard',pruna=input.model==='p-video-2';
 return {model:input.model,outputSeconds:input.duration,segments:1,segmentSeconds:input.duration,
  reviewed:'2026-10-20',nativeAudio:true,audio:true,
  audioQuote:{native:true,language:input.language},
  apiUSD:null,apiEUR:null,totalEUR:null,mediaEUR:null,fxEUR:null,vatEUR:null,retailMarkupEUR:0,
  ownerReview:pruna?{source:'VdoBloom web app',reviewed:'2026-10-20',soraniAccepted:true,apiVerified:false,apiTransportVerified:true,apiSpeechVerified:false,badiniVerified:false,observedMedia:{width:1280,height:704,duration:4.041667,audioPresent:true}}:null,
  providerReference:{provider:pruna?'Pruna':'fal',resolution:'720p',audio:true,
   outputUSD:Number((input.duration*(pruna?0.015:kling?0.126:0.06)).toFixed(6)),invoiceVerified:false,appliesToPreparedAdapter:true,...(pruna?{draft:true,billedBy:'returned whole seconds'}:{})},
  canStart:false,blockedReasons:[
   ...(pruna?['سۆرانی لە VdoBloom پەسەند کراوە؛ تاقیکردنەوەی API بە دەنگ سەرکەوتوو بوو؛ قەبارەی ڕاستەقینە 1280×704 بوو، نەک 1280×720. گوێگرتنی ئەنجامی API هێشتا ماوە.']:[]),
   ...(pruna?[]:['چالاککردنی API و تاقیکردنەوەی ڤیدیۆی ڕاستەقینە هێشتا ماون؛ هیچ پارەیەک وەرناگیرێت.']),
   'نرخی کۆتایی، باج و خەرجییە زیادەکان پشتڕاست نەکراونەتەوە.',
   ...(kling?['ڕێگای Kling لە fal بۆ پاراستنی دیالۆگی کوردی هێشتا پەسەند نەکراوە.']:[]),
   ...(input.language==='badini'?['کوالێتی بادینی پێویستی بە گوێگرتن لە تاقیکردنەوەی جیاواز هەیە.']:[])
  ]};
}

function quotePruna(input,costs) {
 const segments=Math.ceil(input.duration/20),estimateSeconds=input.duration+segments;
 const result={model:'p-video-2',provider:'pruna',draft:true,outputSeconds:input.duration,segments,segmentSeconds:Math.min(20,input.duration),reviewed:'2026-10-20',nativeAudio:true,audio:true,audioQuote:{native:true,language:input.language},retailMarkupEUR:0,apiUSD:null,apiEUR:null,mediaEUR:null,fxEUR:null,vatEUR:null,totalEUR:null,canStart:false,
  ownerReview:{soraniAccepted:true,apiVerified:true,apiTransportVerified:true,apiSpeechVerified:true,badiniVerified:false,observedMedia:{width:1280,height:704,duration:4.041667,audioPresent:true}},
  providerReference:{provider:'Pruna',resolution:'720p',outputUSD:Number((input.duration*.015).toFixed(6)),audio:true,draft:true,invoiceVerified:false,appliesToPreparedAdapter:true,billedBy:'returned whole seconds'},
  segmentDurations:Array.from({length:segments},(_,i)=>Math.min(20,input.duration-i*20)),nativeResolution:'704p',resolutionLabel:'1280×704 (native)',estimateSeconds,blockedReasons:[]};
 // The published USD estimate is available even when EUR conversion and activation are missing.
 result.apiUSD=prunaOutputCost(estimateSeconds);
 result.reviewed=PRUNA_PRICE_REVIEWED;
 result.providerReference.outputUSD=prunaOutputCost(input.duration);
 result.providerReference.priceSource='https://docs.api.pruna.ai/guides/models/p-video-2';
 result.providerReference.priceReviewed=PRUNA_PRICE_REVIEWED;
 const missing=[];
 if(costs.prunaEnabled!==true||costs.prunaConfigured!==true)missing.push('پەیوەندی P-Video 2 بۆ داواکارییە گشتییەکان چالاک نەکراوە.');
 if(costs.durableStorage!==true)missing.push('پاشەکەوتکردنی پارێزراوی داواکاری و ڤیدیۆ هێشتا پشتڕاست نەکراوەتەوە.');
 if(costs.prunaBillingVerified!==true)missing.push('نرخی فرۆشتن و کرێدیت هێشتا چالاک نەکراون.');
 if(input.resolution!=='704p')missing.push('P-Video 2 لەم ڕێگەیەدا 704p دروست دەکات؛ 704p هەڵبژێرە.');
 const valid=k=>['string','number'].includes(typeof costs[k])&&String(costs[k]).trim()!==''&&Number.isFinite(Number(costs[k]))&&Number(costs[k])>=0;
 const known=['mediaEUR','fxPercent','vatPercent','usdPerEUR'].every(valid)&&Number(costs.usdPerEUR)>0&&Number(costs.fxPercent)<=100&&Number(costs.vatPercent)<=100;
 if(!known)missing.push('خەرجی، گۆڕینی دراو و باج دیاری نەکراون.');
 if(known){
  const apiUSD=prunaOutputCost(estimateSeconds),apiEUR=apiUSD/Number(costs.usdPerEUR),mediaEUR=Number(costs.mediaEUR),fxEUR=apiEUR*Number(costs.fxPercent)/100,vatEUR=(apiEUR+mediaEUR+fxEUR)*Number(costs.vatPercent)/100;
  Object.assign(result,{apiUSD,apiEUR,mediaEUR,fxEUR,vatEUR,totalEUR:Math.ceil((apiEUR+mediaEUR+fxEUR+vatEUR)*10000)/10000});
 }
 result.blockedReasons=missing;result.canStart=known&&missing.length===0;
 result.limitations=[...(input.language==='badini'?['کوالێتی بادینی هێشتا پەسەند نەکراوە؛ ئەنجامەکە پێویستی بە گوێگرتن هەیە.']:[]),'نرخەکە هەڵسەنگاندنە؛ یەک چرکە بۆ خەرجی ڕاوێژکراوی ماوە زیاد کراوە.', '704pی ڕاستەقینە؛ گەورەکردنەوە بۆ 720p نییە.'];
 return result;
}

