import {KURDISH_WARDROBE} from './kurdish-wardrobe.js';
// Native P-Video 2 transport. The caller reserves durably before the sole POST.
import {writeFile} from 'node:fs/promises';
import {validateNativeCandidate} from '../native-candidate-cost.js';
const origin='https://api.pruna.ai';
export function prunaNativeRequest(raw, {silent=false}={}) {
 const i=validateNativeCandidate(silent?{...raw,dialogueText:'-'}:raw,{internalPrompt:true});
 if(i.duration>20)throw new Error('Pruna native request is limited to 20 seconds.');
 if(i.model!=='p-video-2')throw new Error('Unknown Pruna native model.');
 const dialect=i.language==='sorani'?'Sorani Kurdish (Central Kurdish)':'Badini Kurdish (Behdini, Duhok dialect)';
 return {input:{prompt:`${i.mode==='extension'?'Continue from the exact supplied final frame. Preserve faces, outfits, lighting and camera motion. No reset, cut or recap. ':''}Stylized 3D cartoon animation, one continuous shot, no live action. ${i.prompt}\n${KURDISH_WARDROBE}\nCharacter identities: ${i.identity}\n${silent?'No spoken dialogue in this segment.':`Speak only ${dialect}. Say exactly, without translation: ${i.dialogueText}`}\nAccurate lip sync. No other dialogue, subtitles or background music.`,duration:i.duration,resolution:'720p',aspect_ratio:i.aspectRatio,fps:24,draft:true,save_audio:true,prompt_upsampling:false,disable_safety_filter:false}};
}
function id(value) {
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(value))throw new Error('Invalid saved Pruna task; do not resubmit.');
 return value;
}
function outputURL(value) {
 let u;try{u=new URL(value);}catch{throw new Error('Missing Pruna output.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!(u.hostname==='api.pruna.ai'||u.hostname.endsWith('.pruna.ai')))throw new Error('Untrusted Pruna output host.');
 return u;
}
export function createPrunaNativeClient(config={},fetcher=fetch) {
 async function request(url,options={},limit=1024*1024) {
  const u=new URL(url);
  if(!config.apiKey?.trim())throw new Error('Pruna API key is not configured.');
  let response;
  try{response=await fetcher(u.href,{...options,redirect:'error',signal:AbortSignal.timeout(60000),headers:{...options.headers,...(u.hostname==='api.pruna.ai'?{apikey:config.apiKey.trim()}:{})}});}
  catch{throw new Error('Pruna request uncertain; no automatic retry.');}
  if(!response.ok){await response.body?.cancel();throw new Error(`Pruna HTTP ${response.status}; no automatic generation retry.`);}
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('Pruna response exceeds limit.');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks);
 }
 async function json(url,options){const bytes=await request(url,options);try{return JSON.parse(bytes.toString());}catch{throw new Error('Invalid Pruna metadata.');}}
 return {
  async submit(input,options={}){
   if(config.enabled!==true)throw new Error('Pruna native generation is disabled.');
   const body=prunaNativeRequest(input,options);
   if(input.image){
    const match=/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+=*)$/.exec(input.image);if(!match)throw new Error('Invalid uploaded image.');
    const form=new FormData();form.append('content',new Blob([Buffer.from(match[2],'base64')],{type:match[1]}),match[1]==='image/png'?'frame.png':'frame.jpg');
    const uploaded=await json(`${origin}/v1/files`,{method:'POST',body:form});
    const url=new URL(uploaded.urls?.get);if(url.origin!==origin||url.username||url.password||url.search||url.hash||!/^\/v1\/files\/[A-Za-z0-9_-]+$/.test(url.pathname))throw new Error('Untrusted uploaded file URL.');
    body.input.image=url.href;
   }
   const data=await json(`${origin}/v1/predictions`,{method:'POST',headers:{Model:'p-video-2','Content-Type':'application/json'},body:JSON.stringify(body)});
   return {model:'p-video-2',id:id(data.id)};
  },
  async poll(task){
   if(task?.model!=='p-video-2')throw new Error('Invalid Pruna task model.');
   const data=await json(`${origin}/v1/predictions/status/${id(task.id)}`,{method:'GET'});
   if(['starting','queued','pending','processing','running'].includes(data.status))return {status:'IN_PROGRESS'};
   if(!['succeeded','completed'].includes(data.status))throw new Error('Pruna task stopped or returned an unknown state; do not resubmit.');
   const url=outputURL(data.generation_url||data.output?.generation_url||(typeof data.output==='string'?data.output:null));
   return {status:'completed',url:url.href,speechVerified:false};
  },
  async download(value,path){const u=outputURL(value);const bytes=await request(u.href,{method:'GET'},64*1024*1024);await writeFile(path,bytes,{mode:0o600});}
 };
}
