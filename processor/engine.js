import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import * as providers from './providers.js';
import * as media from './media.js';
import { segmentPrompt } from '../long-video.js';
export async function save(job, directory) {
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, 'job.json.tmp');
  await writeFile(temporary, JSON.stringify(job), { mode: 0o600 });
  await rename(temporary, join(directory, 'job.json'));
}
export const load = directory => readFile(join(directory, 'job.json'), 'utf8').then(JSON.parse);
const dataImage = async path => {
  const bytes = await readFile(path);
  const type = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpeg' : 'png';
  return `data:image/${type};base64,${bytes.toString('base64')}`;
};
export function publicLongJob(job) {
  return { id: job.id, model:job.input.model || 'wan2.2-i2v-flash',status: job.status, completedSegments: job.completedSegments || 0,
    totalSegments: (job.input.duration ?? 70) / 5, duration: job.status === 'ready' ? (job.input.duration ?? 70) : null, quote: job.quote,
    error: job.error || null, approvedAt: job.approvedAt || null,
    reservedAPIUSD: job.reservedAPIUSD || 0,
    ...(job.input.model ? {providerUsage:job.providerUsage || {},invoiceReconciled:false} : {}),
    // Reserved is a conservative list-price exposure, not proof of provider billing.
    costStatus: 'List-price exposure only; reconcile the actual invoice.',
    ...(job.status === 'ready' ? { videoUrl: `/api/long/file?id=${job.id}` } : {}) };
}
export async function advance(job, directory, config, dependencies = {}) {
  const p = dependencies.providers || providers;
  const m = dependencies.media || media;
  if (job.status !== 'running') return;
  const persist = () => save(job, directory);
  // Persist BEFORE every billable POST. A crash in this window is never automatically retried.
  async function submit(kind, cost, action) {
    if (!job.approvedAt || Date.now() - Date.parse(job.approvedAt) > 86400000)
      throw new Error('Approval is missing or older than 24 hours; stop before a new paid request.');
    if ((job.reservedAPIUSD || 0) + cost > job.quote.apiUSD + 0.000001) throw new Error('Approved API budget exceeded.');
    job.inflight = { kind, state: 'submitting' };
    job.reservedAPIUSD = Number(((job.reservedAPIUSD || 0) + cost).toFixed(6));
    await persist();
    job.inflight.id = await action(); job.inflight.state = 'polling'; await persist();
  }
  try {
    if (job.inflight?.state === 'submitting') {
      job.status = 'uncertain'; job.error = 'A submission was interrupted; review the provider console. Automatic resubmission is blocked.';
      await persist(); return;
    }
    if (!job.openingReady) {
      if (job.input.image) {
        await writeFile(join(directory, 'opening-source'), Buffer.from(job.input.image.split(',')[1], 'base64'));
      } else {
        if (!job.inflight) { await submit('image', 0.003, () => p.submitImage(job.input, config.FAL_KEY)); return; }
        const url = await p.imageResult(job.inflight.id, config.FAL_KEY);
        if (!url) return;
        await p.download(url, join(directory, 'opening-source'));
      }
      await m.prepareOpening(join(directory, 'opening-source'), join(directory, 'opening.png'), job.input.aspectRatio);
      job.openingReady = true; job.inflight = null; await persist(); return;
    }
    const i = job.completedSegments || 0;
    if (i < (job.input.duration ?? 70) / 5) {
      if (!job.inflight) {
        const image = await dataImage(join(directory, i === 0 ? 'opening.png' : `frame-${i - 1}.png`));
        const cost = job.input.resolution === '720p' ? 0.18 : 0.075;
        await submit('video', cost, () => p.submitWan(job.input, image, segmentPrompt(job.input, i), config.DASHSCOPE_API_KEY)); return;
      }
      const url = await p.wanResult(job.inflight.id, config.DASHSCOPE_API_KEY);
      if (!url) return;
      const source = join(directory, `raw-${i}.mp4`), clip = join(directory, `clip-${i}.mp4`);
      await p.download(url, source);
      await m.normalize(source, clip, job.input.aspectRatio, job.input.resolution);
      await m.lastFrame(clip, join(directory, `frame-${i}.png`));
      job.completedSegments = i + 1; job.inflight = null; await persist(); return;
    }
    await m.assemble(directory, (job.input.duration ?? 70) / 5); job.status = 'ready'; await persist();
  } catch (error) {
    job.status = job.inflight?.state === 'submitting' ? 'uncertain' : 'failed';
    job.error = error.message; await persist();
  }
}
