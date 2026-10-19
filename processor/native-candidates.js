// Private preparation only. Not registered as a public generation provider.
// The job engine must persist a submission reservation before using this transport.
const routes = Object.freeze({
 'pixverse-v6': 'fal-ai/pixverse/v6/text-to-video',
 'kling-3.0-standard': 'fal-ai/kling-video/v3/standard/text-to-video'
});
export function nativeCandidateRequest(input) {
 const route=routes[input?.model];
 if(!route) throw new Error('Unknown native video model.');
 if(input.mode && input.mode!=='new') throw new Error('Candidate extension is not integrated.');
 if(input.image || input.referenceImages?.length) throw new Error('Candidate references require a separate reviewed route.');
 if(input.resolution!=='720p' || !['16:9','9:16'].includes(input.aspectRatio)) throw new Error('Choose 720p and a supported aspect ratio.');
 if(!Number.isInteger(input.duration) || input.duration<3 || input.duration>15) throw new Error('Choose 3–15 whole seconds.');
 if(!['sorani','badini'].includes(input.language)) throw new Error('Choose one Kurdish dialect.');
 if(typeof input.prompt!=='string' || !input.prompt.trim() || typeof input.dialogueText!=='string' || !input.dialogueText.trim()) throw new Error('A scene and exact spoken dialogue are required.');
 const dialect=input.language==='sorani'?'Sorani Kurdish (Central Kurdish)':'Badini Kurdish (Behdini, Duhok dialect)';
 const prompt=`Stylized cartoon animation, one continuous shot, no live action. ${input.prompt.trim()}\nCharacter identities: ${String(input.identity || '').trim()}\nSpeak only ${dialect}. Say exactly, without translation: ${input.dialogueText.trim()}\nAccurate lip sync. No other dialogue, no subtitles, no background music.`;
 if(Buffer.byteLength(prompt,'utf8')>2048) throw new Error('Combined scene and dialogue exceed 2048 UTF-8 bytes.');
 const body={prompt,aspect_ratio:input.aspectRatio,enable_safety_checker:true};
 if(input.model==='pixverse-v6') Object.assign(body,{duration:input.duration,resolution:'720p',generate_audio_switch:true,generate_multi_clip_switch:false,thinking_type:'disabled'});
 else Object.assign(body,{duration:String(input.duration),generate_audio:true,shot_type:'customize'});
 return {route,body};
}
function queueURL(raw,route,id,kind) {
 let u;try{u=new URL(raw);}catch{throw new Error('Invalid provider queue URL.');}
 // fal returns model-family queue paths; accept only the selected model family.
 const family=route.split('/').slice(0,2).join('/');
 const path=`/${family}/requests/${id}${kind==='status'?'/status':''}`;
 if(u.origin!=='https://queue.fal.run'||u.username||u.password||u.hash||u.search||u.pathname!==path) throw new Error('Untrusted provider queue URL.');
 return u.href;
}
export function createNativeCandidateClient(config={},fetcher=fetch) {
 async function call(url,options={}) {
  if(!config.apiKey?.trim()) throw new Error('Native provider key is not configured.');
  let r;try{r=await fetcher(url,{...options,headers:{Authorization:`Key ${config.apiKey.trim()}`,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(60000)});}catch{throw new Error('Provider request uncertain; no automatic retry.');}
  if(!r.ok){await r.body?.cancel();throw new Error(`Native provider HTTP ${r.status}; no automatic retry.`);}
  const chunks=[];let size=0;
  for await(const chunk of r.body){size+=chunk.length;if(size>1024*1024)throw new Error('Provider metadata exceeds limit.');chunks.push(Buffer.from(chunk));}
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Error('Invalid provider metadata.');}
 }
 return {
  async submit(input) {
   if(config.enabled!==true) throw new Error('Candidate generation is disabled; no paid request sent.');
   const {route,body}=nativeCandidateRequest(input);
   const result=await call(`https://queue.fal.run/${route}`,{method:'POST',body:JSON.stringify(body)});
   const id=result.request_id;
   if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(id))throw new Error('Missing task ID; do not resubmit.');
   return {model:input.model,id,statusURL:queueURL(result.status_url,route,id,'status'),responseURL:queueURL(result.response_url,route,id,'result')};
  },
  async poll(task) {
   const route=routes[task?.model];if(!route||!/^[A-Za-z0-9_-]{1,200}$/.test(task.id||''))throw new Error('Invalid task.');
   const statusURL=queueURL(task.statusURL,route,task.id,'status');
   const responseURL=queueURL(task.responseURL,route,task.id,'result');
   const result=await call(statusURL);
   if(['IN_QUEUE','IN_PROGRESS'].includes(result.status))return {status:result.status};
   if(result.status!=='COMPLETED')throw new Error('Unexpected provider state; inspect task before retrying.');
   const output=await call(responseURL);
   let u;try{u=new URL(output.video?.url);}catch{throw new Error('Missing video output.');}
   const allowed=u.hostname==='storage.googleapis.com'||u.hostname==='fal.media'||u.hostname.endsWith('.fal.media');
   if(u.protocol!=='https:'||!allowed||u.username||u.password||u.port||u.hash||output.video.content_type!=='video/mp4')throw new Error('Untrusted video output.');
   return {status:'completed',url:u.href,speechVerified:false};
  }
 };
}
