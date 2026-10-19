// Offline preparation only. This script has no provider client or HTTP calls.
import {validateInput} from '../video.js';
import {nativeCost} from '../native-cost.js';
import {validateOmniInput,quoteOmni} from '../omni-cost.js';
import {omniRequest} from '../processor/omni.js';

const scene='One adult Kurdish character in a clearly stylized 3D cartoon, facing the camera. One continuous shot, matching lip movements, no music, no subtitles.';
const badini=validateInput({requestId:'offline-badini-preflight',model:'veo-3.1-lite-generate-preview',mode:'new',duration:4,
 resolution:'720p',aspectRatio:'16:9',language:'badini',style:'3D Animation',
 prompt:scene+' Speak only Badini Kurdish, once: «سلاڤ، تو چەوای؟». Do not translate or add dialogue.'});
const badiniQuote=nativeCost(badini);
const sorani=validateOmniInput({model:'gemini-omni-1.1-flash',mode:'new',duration:5,resolution:'720p',aspectRatio:'16:9',
 language:'sorani',prompt:scene,dialogueText:'سڵاو، بەخێربێن بۆ کورد ئەی.'});
// Validate the actual transport payload, but never create a client or submit it.
const soraniRequest=omniRequest({...sorani,segmentSeconds:5});
const soraniQuote=quoteOmni(sorani);
console.log(JSON.stringify({offline:true,networkRequests:0,readyForPaidTest:false,
 approvalRequired:true,paidTestCapEUR:0.20,
 cases:[{dialect:'badini',model:badini.model,seconds:badini.duration,resolution:badini.resolution,
   apiOutputUSD:badiniQuote.apiUSD,estimatedOutputEUR:badiniQuote.apiEUR,
   totalInvoiceEUR:null,pricingReviewed:badiniQuote.reviewed,fxDate:badiniQuote.fxDate,
   speechVerified:false,prompt:badini.instance.prompt,
   blockers:['Explicit spending approval required.','Tax, FX charges and final total remain unverified.','Owner authorization and deployment spending gates must be checked before submission.']},
  {dialect:'sorani',model:soraniRequest.model,seconds:sorani.duration,resolution:sorani.resolution,
   apiOutputMinimumUSD:soraniQuote.apiMinimumUSD,estimatedOutputMinimumEUR:soraniQuote.apiMinimumEUR,
   totalInvoiceEUR:null,pricingReviewed:soraniQuote.reviewed,fxDate:soraniQuote.fxDate,
   speechVerified:false,dialogueText:sorani.dialogueText,
   blockers:['The output-only minimum exceeds the EUR0.20 paid-test cap.',...soraniQuote.blockedReasons]}],
 acceptance:['A native speaker must review each dialect separately; prompting alone is not evidence.',
  'Check actual dialogue, dialect, lip synchronization, dimensions, duration and audio stream.',
  'Record actual provider usage and charges. Do not retry uncertain submissions.']},null,2));
