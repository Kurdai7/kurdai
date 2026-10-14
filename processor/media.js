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
  await run(['-protocol_whitelist', 'file,pipe', '-sseof', '-0.033334', '-i', source, '-frames:v', '1', target]);
}
export async function assemble(directory, count = 14) {
  if (count !== 14) throw new Error('All fourteen clips are required for 70 seconds.');
  const list = join(directory, 'concat.txt');
  await writeFile(list, Array.from({ length: count }, (_, i) => `file 'clip-${i}.mp4'`).join('\n'));
  const output = join(directory, 'final.mp4');
  await run(['-protocol_whitelist', 'file,pipe', '-f', 'concat', '-safe', '1', '-i', list,
    '-map', '0:v:0', '-an', '-c', 'copy', '-t', '70', '-movflags', '+faststart', output]);
  if (Math.abs(await duration(output) - 70) > 0.04) throw new Error('Final video failed the 70-second duration check.');
  return output;
}

// Local readiness only; never contacts a generation provider.
export async function verifyRuntime() {
  await exec('ffmpeg', ['-version'], {timeout: 10000, maxBuffer: 65536});
  await exec('ffprobe', ['-version'], {timeout: 10000, maxBuffer: 65536});
  const {stdout} = await exec('ffmpeg', ['-hide_banner','-encoders'], {timeout: 10000, maxBuffer: 65536});
  if (!stdout.includes('libx264')) throw new Error('FFmpeg requires the libx264 encoder.');
  return {ffmpeg: true, ffprobe: true, libx264: true};
}
