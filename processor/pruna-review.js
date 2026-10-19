// One explicitly approved, private evaluation. Not a production video provider.
import {putR2Object,getR2Object} from './r2-storage.js';
import {preparePrunaTests} from '../scripts/pruna-preflight.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const exec=promisify(execFile);
export const reviewKey=(dialect,suffix='json')=>`evaluations/pruna-native-2026-10-19/${dialect}.${suffix}`;
export function reviewEnabled(env,now=new Date()) {
 return env.PRUNA_FREE_EVALUATION==='2026-10-19-two-dialects' &&
  now.toISOString().slice(0,10)==='2026-10-19' && env.PRUNA_FREE_CREDIT_VERIFIED==='true' &&
  env.PRUNA_AUTO_TOPUP_DISABLED==='true' && !!env.PRUNA_API_KEY &&
  typeof env.PRUNA_REVIEW_TOKEN==='string' && env.PRUNA_REVIEW_TOKEN.length>=32;
}
export async function runPrunaReview(env,io={put:putR2Object,get:getR2Object,fetch:fetch,
 wait:ms=>new Promise(r=>setTimeout(r,ms)),inspect:inspectVideo}) {
 if(!reviewEnabled(env))return {enabled:false};
 const results=[];
 for(const candidate of preparePrunaTests().cases){
  const {dialect}=candidate;const key=reviewKey(dialect);
  let state;
  try {state=JSON.parse(await io.get(env,key,100000));}
  catch(error){if(error.status!==404)throw new Error('Cannot read evaluation reservation.');}
  if(!state){
   // R2 conditional writes prevent retries across restarts and overlapping deploys.
   state={dialect,status:'reserved',model:'p-video-2-pro',speechVerified:false};
   await io.put(env,key,Buffer.from(JSON.stringify(state)),{ifNoneMatch:'*'});
   let response;
   try {response=await io.fetch(candidate.pruna.endpoint,{method:'POST',redirect:'error',
    signal:AbortSignal.timeout(60000),headers:{apikey:env.PRUNA_API_KEY,Model:'p-video-2-pro',
     'Content-Type':'application/json'},body:JSON.stringify(candidate.pruna.body)});}
   catch {throw new Error('Uncertain Pruna submission; reserved permanently, no retry.');}
   if(!response.ok)throw new Error(`Pruna submission HTTP ${response.status}; no retry.`);
   const data=await response.json();
   if(typeof data.id!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(data.id))throw new Error('Uncertain task ID; no retry.');
   state={...state,id:data.id,status:'submitted'};
   await io.put(env,key,Buffer.from(JSON.stringify(state)));
  }
  if(state.status==='completed'){results.push(state);continue;}
  if(!state.id)throw new Error('Prior submission uncertain; manual reconciliation required.');
  let completed;
  for(let attempt=0;attempt<180;attempt++){
   const response=await io.fetch(`https://api.pruna.ai/v1/predictions/status/${state.id}`,{
    headers:{apikey:env.PRUNA_API_KEY},redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error(`Pruna status HTTP ${response.status}; no new generation.`);
   const data=await response.json();
   if(data.status==='failed'||data.status==='canceled'||data.status==='cancelled')throw new Error('Pruna task failed; no retry.');
   if(data.status==='succeeded'||data.status==='completed'){completed=data;break;}
   await io.wait(5000);
  }
  if(!completed)throw new Error('Pruna still processing; task retained, no new generation.');
  const value=completed.generation_url || completed.output?.generation_url ||
   (typeof completed.output==='string'?completed.output:null);
  if(!value)throw new Error('Completed output shape needs review; no new generation.');
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||
   !(url.hostname==='api.pruna.ai'||url.hostname.endsWith('.pruna.ai')))
   throw new Error('Output host needs operator verification; no credentials sent.');
  const media=await io.fetch(url.href,{redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!media.ok)throw new Error('Output download failed; task retained.');
  if(Number(media.headers.get('content-length'))>50*1024*1024)throw new Error('Output exceeds review size limit.');
  const chunks=[];let total=0;
  for await(const chunk of media.body){total+=chunk.length;if(total>50*1024*1024)throw new Error('Output exceeds review size limit.');chunks.push(Buffer.from(chunk));}
  const bytes=Buffer.concat(chunks),metadata=await io.inspect(bytes);
  await io.put(env,reviewKey(dialect,'mp4'),bytes);
  state={...state,status:'completed',...metadata,bytes:bytes.length,
   sha256:createHash('sha256').update(bytes).digest('hex'),speechVerified:false,
   listCostUSD:Math.ceil(metadata.duration)*0.025,cashChargedVerified:false};
  await io.put(env,key,Buffer.from(JSON.stringify(state)));results.push(state);
 }
 return {enabled:true,results};
}
async function inspectVideo(bytes){
 const directory=await mkdtemp(join(tmpdir(),'pruna-media-'));
 try {const file=join(directory,'clip.mp4');await writeFile(file,bytes,{mode:0o600});
  const {stdout}=await exec('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file],{timeout:30000,maxBuffer:100000});
  const data=JSON.parse(stdout),video=data.streams.find(s=>s.codec_type==='video'),audio=data.streams.find(s=>s.codec_type==='audio');
  const duration=Number(data.format.duration);
  if(!video||!audio||video.height!==768||!Number.isFinite(duration)||duration<4.8||duration>15.1)
   throw new Error('Output did not satisfy audio, resolution or duration review.');
  return {width:video.width,height:video.height,duration,audioPresent:true};
 }finally{await rm(directory,{recursive:true,force:true});}
}
