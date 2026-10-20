import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {advancePrunaChain,prunaSegments,trimPrunaClip,assemblePrunaClips} from '../processor/pruna-chain.js';
import {publicLongJob} from '../processor/engine.js';
import {quoteNativeCandidate} from '../native-candidate-cost.js';
const config={PRUNA_NATIVE_ENABLED:'true',NATIVE_GENERATION_ENABLED:'true',NATIVE_BILLING_VERIFIED:'true',LONG_DURABLE_STORAGE:'true'};
const input={model:'p-video-2',duration:70,resolution:'704p',aspectRatio:'16:9',language:'sorani',prompt:'A cartoon family walks forward.',identity:'Same family and clothes',dialogueText:Array.from({length:160},(_,i)=>'وشە'+i).join(' ')};
const costs={prunaEnabled:true,prunaConfigured:true,prunaBillingVerified:true,durableStorage:true,usdPerEUR:1,mediaEUR:0,fxPercent:0,vatPercent:0};
const make=()=>{const quote=quoteNativeCandidate(input,costs);return {id:'chain',input,quote,status:'running',approvedAt:new Date().toISOString(),approvedTotalEUR:quote.totalEUR,completedSegments:0,reservedAPIUSD:0};};
async function dir(t){const d=await mkdtemp(join(tmpdir(),'pruna-chain-'));t.after(()=>rm(d,{recursive:true,force:true}));return d;}
test('70 seconds reserves four unique tasks, carries final frames, preserves dialogue order and produces one file',async t=>{
 const directory=await dir(t),j=make(),requests=[];
 const deps={client:{submit:async(i,options)=>{const saved=JSON.parse(await readFile(join(directory,'job.json')));assert.equal(saved.inflight.state,'submitting');requests.push({i,options});return {model:'p-video-2',id:'task'+requests.length};},poll:async()=>({status:'completed',url:'https://api.pruna.ai/test'})},download:async(u,p)=>writeFile(p,'native'),lastFrame:async(s,p)=>{assert.match(s,/clip-/);await writeFile(p,Buffer.from([255,216,255,0]));},inspect:async p=>({width:1280,height:704,duration:p.endsWith('final.mp4')?70:requests.at(-1).i.duration+.04,audioPresent:true}),trim:async(s,p)=>copyFile(s,p),assemble:async(d,count,seconds)=>{assert.equal(count,4);assert.equal(seconds,70);await writeFile(join(d,'final.mp4'),'one voiced MP4');}};
 for(let i=0;i<8;i++)await advancePrunaChain(j,directory,config,deps);
 assert.equal(j.status,'ready');assert.equal(requests.length,4);assert.deepEqual(requests.map(x=>x.i.duration),[20,20,20,10]);assert.equal(j.reservedAPIUSD,1.11);assert.equal(publicLongJob(j).totalSegments,4);
 assert.equal(requests.map(x=>x.i.dialogueText).join(' '),input.dialogueText);assert.equal(requests[0].i.image,undefined);assert.ok(requests.slice(1).every(x=>x.i.image.startsWith('data:image/jpeg;base64,')));
 await advancePrunaChain(j,directory,config,deps);assert.equal(requests.length,4);
});
test('unknown segment submission is never retried; disabled flags and insufficient quotes cannot spend',async t=>{
 for(const mode of ['uncertain','disabled','budget']){
  const d=await dir(t),j=make();let posts=0;if(mode==='budget')j.quote.apiUSD=.01;
  const c=mode==='disabled'?{}:config;
  const deps={client:{submit:async()=>{posts++;throw new Error('secret');}}};
  await advancePrunaChain(j,d,c,deps);await advancePrunaChain(j,d,c,deps);
  assert.equal(posts,mode==='uncertain'?1:0);assert.equal(j.status,mode==='uncertain'?'uncertain':'failed');assert.doesNotMatch(j.error,/secret/);
 }
});
test('short dialogue is never repeated to fill later segments',()=>{
 const parts=prunaSegments({...input,dialogueText:'سڵاو هاوڕێیان.'});assert.equal(parts[0].dialogueText,'سڵاو هاوڕێیان.');assert.ok(parts.slice(1).every(p=>p.dialogueText===''));
});
test('real FFmpeg assembly retains native 704p pixels and audio for one 70-second MP4',async t=>{
 const d=await dir(t),exec=promisify(execFile),source=join(d,'source.mp4');
 await exec('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=blue:s=1280x704:r=24','-f','lavfi','-i','sine=frequency=300:sample_rate=48000','-t','20.05','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',source],{timeout:120000});
 for(let i=0;i<4;i++)await trimPrunaClip(source,join(d,`clip-${i}.mp4`),i===3?10:20);
 await assemblePrunaClips(d,4,70);
 const {stdout}=await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',join(d,'final.mp4')]);const media=JSON.parse(stdout),v=media.streams.find(x=>x.codec_type==='video');
 assert.equal(v.width,1280);assert.equal(v.height,704);assert.ok(media.streams.some(x=>x.codec_type==='audio'));assert.ok(Math.abs(Number(media.format.duration)-70)<.15);
});
