// Fixed synthetic media only. No provider client, credentials or network calls.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {assembleVoiced} from './media.js';
import {save} from './engine.js';
export const SMOKE_MODEL = 'synthetic-test-no-ai';
const exec = promisify(execFile);
export async function advanceSmoke(job, directory) {
  if(job.status !== 'running') return;
  try {
    const i=job.completedSegments;
    if(i<14) {
      const size=job.input.aspectRatio==='9:16'?'270x480':'480x270';
      await exec('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y',
        '-f','lavfi','-i',`testsrc2=size=${size}:rate=30`,
        '-f','lavfi','-i',`sine=frequency=${220+i*30}:sample_rate=48000`,
        '-t','5','-c:v','libx264','-threads','1','-preset','ultrafast','-pix_fmt','yuv420p',
        '-c:a','aac','-ac','2',join(directory,`clip-${i}.mp4`)],{timeout:60000,maxBuffer:65536});
      job.completedSegments++;
    } else { await assembleVoiced(directory,14); job.status='ready'; }
  } catch { job.status='failed';job.error='Local synthetic media test failed. No AI request was sent.'; }
  await save(job,directory);
}
