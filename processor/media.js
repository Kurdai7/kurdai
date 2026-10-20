import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const exec = promisify(execFile);
const run = args => exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], { timeout: 180000, maxBuffer: 1024 * 1024 });
export async function prepareOpening(source, target, aspectRatio) {
  const [w, h] = aspectRatio === '9:16' ? [480, 848] : [848, 480];
  await run(['-protocol_whitelist', 'file,pipe', '-i', source, '-frames:v', '1',
    '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, target]);
}
export async function duration(path) {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path]);
  return Number(stdout.trim());
}
export async function normalize(source, target, aspectRatio, resolution) {
  if (await duration(source) < 4.95) throw new Error('Provider returned less than five seconds; stopping without another paid request.');
  const size = resolution === '720p' ? [1280, 720] : [848, 480];
  if (aspectRatio === '9:16') size.reverse();
  await run(['-protocol_whitelist', 'file,pipe', '-i', source, '-map', '0:v:0', '-an',
    '-vf', `scale=${size[0]}:${size[1]}:force_original_aspect_ratio=increase,crop=${size[0]}:${size[1]},setsar=1,fps=30`,
    '-frames:v', '150', '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', target]);
  if (Math.abs(await duration(target) - 5) > 0.04) throw new Error('Invalid normalized segment duration.');
}
export async function lastFrame(source, target) {
  await run(['-protocol_whitelist', 'file,pipe', '-sseof', '-1', '-i', source, '-vf', 'reverse', '-frames:v', '1', target]);
}
export async function assemble(directory, count = 14) {
  if (![12,14].includes(count)) throw new Error('Twelve or fourteen complete clips are required.');
  const seconds = count * 5;
  const list = join(directory, 'concat.txt');
  await writeFile(list, Array.from({ length: count }, (_, i) => `file 'clip-${i}.mp4'`).join('\n'));
  const output = join(directory, 'final.mp4');
  await run(['-protocol_whitelist', 'file,pipe', '-f', 'concat', '-safe', '1', '-i', list,
    '-map', '0:v:0', '-an', '-c', 'copy', '-t', String(seconds), '-movflags', '+faststart', output]);
  if (Math.abs(await duration(output) - seconds) > 0.04) throw new Error('Final video failed its duration check.');
  return output;
}

// Omni produces native audio. Keep it throughout normalization and assembly;
// never pass voiced output through the silent economy '-an' path.
export async function normalizeVoiced(source, target, aspectRatio, resolution, seconds = 5) {
  const sourceSeconds = await duration(source);
  if (!Number.isFinite(sourceSeconds) || sourceSeconds < seconds - 0.04)
    throw new Error('Omni returned a short segment; stop without a paid retry.');
  const {stdout} = await exec('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=codec_type','-of','csv=p=0',source]);
  if (!stdout.includes('audio')) throw new Error('Omni returned no audio track; do not label the video as voiced.');
  const size = resolution === '720p' ? [1280,720] : [640,360];
  if (aspectRatio === '9:16') size.reverse();
  // Continuations may include the source clip. Retain only the requested tail.
  await run(['-protocol_whitelist','file,pipe','-ss',String(Math.max(0,sourceSeconds-seconds)),'-i',source,
    '-map','0:v:0','-map','0:a:0','-t',String(seconds),
    '-vf',`scale=${size[0]}:${size[1]}:force_original_aspect_ratio=increase,crop=${size[0]}:${size[1]},setsar=1,fps=30`,
    '-af','aresample=48000,apad','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','128k','-ac','2','-movflags','+faststart',target]);
  if (Math.abs(await duration(target)-seconds)>0.06) throw new Error('Invalid voiced segment duration.');
}

export async function assembleVoiced(directory, count) {
  if (!Number.isInteger(count) || count < 1 || count > 14) throw new Error('Use one to fourteen voiced clips.');
  const list = join(directory,'concat-voiced.txt'), target = join(directory,'final.mp4');
  await writeFile(list,Array.from({length:count},(_,i)=>`file 'clip-${i}.mp4'`).join('\n'));
  await run(['-protocol_whitelist','file,pipe','-f','concat','-safe','1','-i',list,
    '-map','0:v:0','-map','0:a:0','-t',String(count*5),'-c:v','copy',
    '-af','aresample=async=1:first_pts=0','-c:a','aac','-b:a','128k','-movflags','+faststart',target]);
  if (Math.abs(await duration(target)-count*5)>0.08) throw new Error('Voiced output failed its duration check.');
  return target;
}

// Local readiness only; never contacts a generation provider.
export async function verifyRuntime() {
  await exec('ffmpeg', ['-version'], {timeout: 10000, maxBuffer: 65536});
  await exec('ffprobe', ['-version'], {timeout: 10000, maxBuffer: 65536});
  const {stdout} = await exec('ffmpeg', ['-hide_banner','-encoders'], {timeout: 10000, maxBuffer: 65536});
  if (!stdout.includes('libx264')) throw new Error('FFmpeg requires the libx264 encoder.');
  return {ffmpeg: true, ffprobe: true, libx264: true};
}
