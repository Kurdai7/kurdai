// One owner-approved free-credit evaluation. No startup hook or public generation flag.
import {createPrunaNativeClient} from './pruna-native.js';
import {getR2Object,putR2Object} from './r2-storage.js';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export const manualReviewKey='evaluations/pruna-pvideo2-20261020/sorani.json';
export const manualReviewApproval='p-video-2-sorani-4s-free-credit-max-usd-0.30-2026-10-20';
export const manualReviewInput=Object.freeze({model:'p-video-2',language:'sorani',duration:4,resolution:'720p',aspectRatio:'16:9',identity:'One adult Kurdish man wearing traditional Kurdish clothes.',prompt:'A stylized 3D cartoon man faces the camera in a peaceful Kurdish village. One continuous four-second shot.',dialogueText:'سڵاو هاوڕێیان، چۆنن؟ هیوادارم هەمووتان باش و تەندروست بن.'});
async function inspect(path){
 const {stdout}=await exec('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',path],{timeout:30000,maxBuffer:100000});
 const d=JSON.parse(stdout),v=d.streams.find(s=>s.codec_type==='video'),audio=d.streams.some(s=>s.codec_type==='audio'),seconds=Number(d.format?.duration);
 if(!v||!audio||v.width<1280||v.height<720||!Number.isFinite(seconds)||Math.abs(seconds-4)>.2)throw new Error('Output requires manual review; no new generation.');
 return {width:v.width,height:v.height,duration:seconds,audioPresent:audio};
}
export async function manualPrunaReview(env,action,approval,dependencies={}) {
 const io={get:getR2Object,put:putR2Object,inspect,...dependencies};
 const client=io.client||createPrunaNativeClient({enabled:true,apiKey:env.PRUNA_API_KEY});
 let state;
 try{state=JSON.parse(await io.get(env,manualReviewKey,100000));}catch(e){if(e.status!==404)throw new Error('Cannot read durable review reservation.');}
 if(action==='submit'){
  if(approval!==manualReviewApproval||new Date().toISOString().slice(0,10)!=='2026-10-20'||env.PRUNA_AUTO_TOPUP_DISABLED!=='true'||env.PRUNA_FREE_CREDIT_VERIFIED!=='true')throw new Error('This evaluation requires its dated, free-credit-only approval.');
  if(!state){
   state={status:'reserved',model:'p-video-2',language:'sorani',requestedSeconds:4,approval:manualReviewApproval,maxReferenceUSD:.30,speechVerified:false};
   await io.put(env,manualReviewKey,Buffer.from(JSON.stringify(state)),{ifNoneMatch:'*'});
   let task;try{task=await client.submit(manualReviewInput);}catch{throw new Error('Submission stopped; reservation retained, no retry.');}
   state={...state,status:'submitted',task};await io.put(env,manualReviewKey,Buffer.from(JSON.stringify(state)));
  }
  return state;
 }
 if(!state)return {status:'not_submitted'};
 if(!state.task||state.status==='completed')return state;
 const result=await client.poll(state.task);
 if(result.status!=='completed')return {...state,providerStatus:result.status};
 const dir=await mkdtemp(join(tmpdir(),'pruna-owner-review-'));
 try{
  const path=join(dir,'clip.mp4');await client.download(result.url,path);
  const metadata=await io.inspect(path),bytes=await readFile(path);
  await io.put(env,manualReviewKey.replace('.json','.mp4'),bytes);
  state={...state,status:'completed',...metadata,referenceOutputUSD:Math.ceil(metadata.duration)*.015,invoiceVerified:false,speechVerified:false};
  await io.put(env,manualReviewKey,Buffer.from(JSON.stringify(state)));return state;
 }finally{await rm(dir,{recursive:true,force:true});}
}
