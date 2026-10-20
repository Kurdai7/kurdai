// Single native video/audio job; no TTS, image generator, or paid retry.
import {copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {save} from './engine.js';
import {createPrunaNativeClient} from './pruna-native.js';
import {createNativeCandidateClient} from './native-candidates.js';
import {NATIVE_CANDIDATE_MODELS,validateNativeCandidate} from '../native-candidate-cost.js';
import {download} from './providers.js';
import {normalizeVoiced} from './media.js';
const exec=promisify(execFile);
async function inspect(path) {
 const {stdout}=await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{timeout:30000,maxBuffer:1024*1024});
 const data=JSON.parse(stdout),v=data.streams.find(s=>s.codec_type==='video');
 return {width:v?.width,height:v?.height,duration:Number(data.format?.duration),audioPresent:data.streams.some(s=>s.codec_type==='audio')};
}
export async function advanceNative(job,directory,config,dependencies={}) {
 if(job.status!=='running')return;
 const persist=()=>save(job,directory);
 try {
  const input=validateNativeCandidate(job.input);
  if(job.inflight?.state==='submitting')throw new Error('Uncertain prior submission.');
  const pruna=input.model==='p-video-2';
  const client=dependencies.client||(pruna?createPrunaNativeClient({apiKey:config.PRUNA_API_KEY,enabled:config.NATIVE_GENERATION_ENABLED==='true'&&config.PRUNA_NATIVE_ENABLED==='true'}):createNativeCandidateClient({apiKey:config.FAL_KEY,enabled:config.NATIVE_GENERATION_ENABLED==='true'}));
  if(!job.inflight){
   const q=job.quote,age=Date.now()-Date.parse(job.approvedAt);
   if(pruna && (config.PRUNA_NATIVE_ENABLED!=='true'||q?.provider!=='pruna'||q?.draft!==true))throw new Error('Pruna activation and Draft quote are required.');
   if(config.NATIVE_GENERATION_ENABLED!=='true'||config.NATIVE_BILLING_VERIFIED!=='true'||config.LONG_DURABLE_STORAGE!=='true')throw new Error('Candidate configuration is disabled.');
   if(!NATIVE_CANDIDATE_MODELS.includes(q?.model)||q.model!==input.model||q.canStart!==true||q.provider!==(pruna?'pruna':'fal')||q.outputSeconds!==input.duration||!Number.isFinite(q.apiUSD)||q.apiUSD<=0||!Number.isFinite(q.totalEUR)||q.totalEUR<=0)throw new Error('A route-specific complete quote is required.');
   if(!Number.isFinite(age)||age<0||age>86400000||job.approvedTotalEUR!==q.totalEUR||(job.reservedAPIUSD||0)!==0)throw new Error('Current approval and an unused reservation are required.');
   job.inflight={kind:'native',state:'submitting'};job.reservedAPIUSD=q.apiUSD;
   await persist(); // Must acknowledge durable metadata before the one billable POST.
   const task=await client.submit(input);
   job.inflight={kind:'native',state:'polling',task};await persist();return;
  }
  if(job.inflight.kind!=='native'||job.inflight.state!=='polling'||job.inflight.task?.model!==input.model)throw new Error('Invalid saved task.');
  const result=await client.poll(job.inflight.task);
  if(result.status!=='completed')return;
  const source=join(directory,'native-source.mp4'),clip=join(directory,'clip-0.mp4');
  await (dependencies.download||(pruna?client.download:download))(result.url,source);
  const info=await (dependencies.inspect||inspect)(source);
  const dimensions=input.aspectRatio==='16:9'?[1280,720]:[720,1280];
  if(info.width<dimensions[0]||info.height<dimensions[1]||!info.audioPresent||!Number.isFinite(info.duration)||Math.abs(info.duration-input.duration)>.15)throw new Error('Native output does not meet the approved duration, audio or resolution.');
  await (dependencies.normalize||normalizeVoiced)(source,clip,input.aspectRatio,input.resolution,input.duration);
  await (dependencies.copy||copyFile)(clip,join(directory,'final.mp4'));
  job.providerTaskId=job.inflight.task.id;job.nativeMedia={...info,speechVerified:false};
  job.completedSegments=1;job.inflight=null;job.status='ready';await persist();
 }catch{
  job.status=job.inflight?.state==='submitting'?'uncertain':'failed';
  job.error='Native video processing stopped. Inspect the saved task before continuing; no automatic paid retry.';
  await persist();
 }
}
