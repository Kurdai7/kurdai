// Continue from each retained final frame; submit every segment only after a durable reservation.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {save} from './engine.js';
import {createPrunaNativeClient} from './pruna-native.js';
import {validateNativeCandidate} from '../native-candidate-cost.js';
import {lastFrame} from './media.js';
import {prunaOutputCost,recordPrunaUsage} from '../pruna-pricing.js';
const exec=promisify(execFile);
export function prunaSegments(input){
 const words=input.dialogueText.match(/\S+\s*/gu)||[];let offset=0;
 return Array.from({length:Math.ceil(input.duration/20)},(_,index)=>{
  const seconds=Math.min(20,input.duration-index*20),count=Math.min(words.length-offset,Math.floor(seconds*2.5));
  const dialogueText=words.slice(offset,offset+count).join('').trim();offset+=count;
  return {seconds,dialogueText};
 });
}
async function inspect(path){
 const {stdout}=await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{timeout:30000,maxBuffer:100000});const d=JSON.parse(stdout),v=d.streams.find(s=>s.codec_type==='video');
 return {width:v?.width,height:v?.height,duration:Number(d.format?.duration),audioPresent:d.streams.some(s=>s.codec_type==='audio')};
}
export async function trimPrunaClip(source,target,seconds){
 await exec('ffmpeg',['-v','error','-nostdin','-y','-protocol_whitelist','file,pipe','-i',source,'-map','0:v:0','-map','0:a:0','-t',String(seconds),'-c:v','copy','-af','aresample=48000,apad','-c:a','aac','-movflags','+faststart',target],{timeout:180000,maxBuffer:100000});
}
export async function assemblePrunaClips(directory,count,seconds){
 const list=join(directory,'native-concat.txt');await writeFile(list,Array.from({length:count},(_,i)=>`file 'clip-${i}.mp4'`).join('\n'));
 await exec('ffmpeg',['-v','error','-nostdin','-y','-protocol_whitelist','file,pipe','-f','concat','-safe','1','-i',list,'-map','0:v:0','-map','0:a:0','-t',String(seconds),'-c:v','copy','-af','aresample=async=1:first_pts=0','-c:a','aac','-movflags','+faststart',join(directory,'final.mp4')],{timeout:180000,maxBuffer:100000});
}
export async function advancePrunaChain(job,directory,config,deps={}){
 if(job.status!=='running')return;const persist=()=>save(job,directory);
 try{
  const input=validateNativeCandidate(job.input),parts=prunaSegments(input),index=job.completedSegments||0,q=job.quote;
  if(input.model!=='p-video-2'||input.duration<=20||input.resolution!=='704p')throw new Error('Invalid chain.');
  if(job.inflight?.state==='submitting')throw new Error('Uncertain saved submission.');
  const client=deps.client||createPrunaNativeClient({apiKey:config.PRUNA_API_KEY,enabled:true});
  if(!job.inflight){
   const age=Date.now()-Date.parse(job.approvedAt);
   if(config.PRUNA_NATIVE_ENABLED!=='true'||config.NATIVE_GENERATION_ENABLED!=='true'||config.NATIVE_BILLING_VERIFIED!=='true'||config.LONG_DURABLE_STORAGE!=='true')throw new Error('Disabled chain.');
   if(q?.model!=='p-video-2'||q.provider!=='pruna'||q.draft!==true||q.canStart!==true||q.outputSeconds!==input.duration||!Number.isFinite(q.totalEUR)||q.totalEUR<=0||job.approvedTotalEUR!==q.totalEUR||!Number.isFinite(age)||age<0||age>86400000||!Number.isFinite(q.apiUSD)||q.apiUSD<=0)throw new Error('Current complete approval required.');
   if(index>=parts.length)throw new Error('Saved chain needs reconciliation.');
   const part=parts[index],cost=prunaOutputCost(part.seconds+1);
   if(!Number.isFinite(job.reservedAPIUSD)||job.reservedAPIUSD<0||job.reservedAPIUSD+cost>q.apiUSD+.000001)throw new Error('Approved budget exceeded.');
   let image=index?null:input.image;
   if(index){const path=join(directory,'continuation.jpg');await (deps.lastFrame||lastFrame)(join(directory,`clip-${index-1}.mp4`),path);image='data:image/jpeg;base64,'+(await readFile(path)).toString('base64');}
   job.reservedAPIUSD=Number((job.reservedAPIUSD+cost).toFixed(6));job.inflight={kind:'pruna-chain',state:'submitting',index,seconds:part.seconds};await persist();
   const task=await client.submit({...input,duration:part.seconds,dialogueText:part.dialogueText,image,prompt:`${index?'Continue the exact final frame in the supplied image. Same faces, outfits, lighting and camera motion; no reset, recap or cut. ':''}${input.prompt}\nProgress the story, part ${index+1}/${parts.length}. Do not repeat earlier actions or dialogue.`},{silent:!part.dialogueText});
   job.inflight={...job.inflight,state:'polling',task};await persist();return;
  }
  const pending=job.inflight;if(pending.kind!=='pruna-chain'||pending.index!==index||pending.seconds!==parts[index]?.seconds||pending.task?.model!=='p-video-2')throw new Error('Invalid saved task.');
  const result=await client.poll(pending.task);if(result.status!=='completed')return;
  const source=join(directory,`source-${index}.mp4`),clip=join(directory,`clip-${index}.mp4`);
  await (deps.download||client.download)(result.url,source);const info=await (deps.inspect||inspect)(source);
  recordPrunaUsage(job,pending.task.id,info.duration);await persist();
  const expected=input.aspectRatio==='16:9'?[1280,704]:[704,1280];
  if(info.width!==expected[0]||info.height!==expected[1]||!info.audioPresent||!Number.isFinite(info.duration)||Math.abs(info.duration-pending.seconds)>.15)throw new Error('Native media mismatch.');
  await (deps.trim||trimPrunaClip)(source,clip,pending.seconds);
  job.nativeClips=[...(job.nativeClips||[]),{taskId:pending.task.id,...info}];job.completedSegments=index+1;job.inflight=null;
  if(job.completedSegments===parts.length){await (deps.assemble||assemblePrunaClips)(directory,parts.length,input.duration);const final=await (deps.inspect||inspect)(join(directory,'final.mp4'));if(!final.audioPresent||final.width!==expected[0]||final.height!==expected[1]||Math.abs(final.duration-input.duration)>.15)throw new Error('Final media mismatch.');job.nativeMedia={...final,speechVerified:false,continuityGuaranteed:false};job.status='ready';}
  await persist();
 }catch{job.status=job.inflight?.state==='submitting'?'uncertain':'failed';job.error='Native continuation stopped; retain tasks and completed clips. No automatic generation retry.';await persist();}
}

