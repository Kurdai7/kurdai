// Candidate evaluation only: no HTTP client, credentials, or production imports.
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export function preparePrunaTests(now=new Date()) {
 const day=now.toISOString().slice(0,10);
 // The published promotion has no precise end time. Stop using it at the start
 // of its final date; require a new review rather than assume an extra day.
 const reviewed=day==='2026-10-19';
 // Account Playground showed the regular rate on review day; a public promo
 // is not proof this account receives it. Never automatically apply it.
 const promotion=false;
 const directRate=0.025,runwareRate=promotion?0.0125:0.025;
 const lines={sorani:'سڵاو، بەخێربێن بۆ کورد ئەی.',badini:'سلاڤ، تو چەوای؟'};
 const cases=Object.entries(lines).map(([dialect,line])=>{
  const language=dialect==='sorani'?'Sorani Kurdish (Central Kurdish)':'Badini Kurdish (Behdini)';
  const prompt=`A single adult Kurdish character in a clearly stylized 3D cartoon, facing the camera. One continuous five-second shot. Speak only ${language}, exactly once, with natural pronunciation and synchronized lips: «${line}». No translation, other speech, music, subtitles or live-action people.`;
  return {dialect,speechVerified:false,dialogueDraftRequiresNativeReview:true,
   pruna:{endpoint:'https://api.pruna.ai/v1/predictions',modelHeader:'p-video-2-pro',
    body:{input:{prompt,duration:5,resolution:'768p',aspect_ratio:'16:9',mode:'cost',prompt_upsampler:'off'}}},
   runware:{model:'prunaai:p-video@2-pro',taskType:'videoInference',taskUUID:randomUUID(),
    positivePrompt:prompt,duration:5,width:1344,height:768,numberResults:1,
    settings:{mode:'cost',promptUpsampling:'off'},includeCost:true,outputType:'URL',outputFormat:'MP4',deliveryMethod:'async'},
   estimatesUSD:{directFiveSeconds:5*directRate,runwareFiveSeconds:5*runwareRate,
    // Not a guaranteed provider cap: actual returned duration is billable.
    directFifteenSeconds:15*directRate,runwareFifteenSeconds:15*runwareRate}};
 });
 return {offline:true,networkRequests:0,productionEnabled:false,canSubmit:false,reviewed:'2026-10-19',
  priceReviewCurrent:reviewed,runwarePromotionApplied:promotion,promotionPublishedThrough:'2026-10-29',
  nativeAudioDocumented:true,soraniVerified:false,badiniVerified:false,totalInvoiceEUR:null,
  excludedCosts:['actual returned seconds beyond requested duration','applicable tax','bank FX spread','storage and delivery','failed or repeated paid attempts'],
  blockers:['No real Sorani or Badini output reviewed.','Explicit paid-call approval required.',
   'Account price is USD0.025/s; public promotional pricing is not account-verified.','No final tax/FX-inclusive charge cap established.','Provider access and model-specific commercial terms must be checked.',
   ...(!reviewed?['Published prices require a fresh review before any paid request.']:[])],
  cases,sources:['https://docs.pruna.ai/en/stable/docs_pruna_endpoints/performance_models/p-video-2-pro.html',
   'https://runware.ai/docs/models/prunaai-p-video-2-pro','https://runware.ai/terms']};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
 console.log(JSON.stringify(preparePrunaTests(),null,2));
