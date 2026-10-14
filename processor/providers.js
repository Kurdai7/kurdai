// Secrets are injected in the processor host; never sent to the website.
import { writeFile } from 'node:fs/promises';
export const WAN_BASE = 'https://dashscope-intl.aliyuncs.com/api/v1';
export async function jsonCall(url, options) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}; inspect the provider console before retrying.`);
  return data;
}
export async function submitImage(input, key) {
  const size = input.aspectRatio === '16:9' ? { width: 848, height: 480 } : { width: 480, height: 848 };
  const data = await jsonCall('https://queue.fal.run/fal-ai/flux/schnell', { method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `Stylized animation, a single opening frame, consistent character design. ${input.identity}. ${input.prompt}`,
      image_size: size, num_images: 1, output_format: 'png', enable_safety_checker: true }) });
  if (!/^[a-zA-Z0-9_-]+$/.test(data.request_id || '')) throw new Error('No valid image request ID.');
  for (const field of ['status_url', 'response_url']) {
    const u = new URL(data[field]);
    if (u.protocol !== 'https:' || u.hostname !== 'queue.fal.run' || u.port || u.username || u.password || !u.pathname.startsWith('/fal-ai/flux/'))
      throw new Error('Invalid image queue URL.');
  }
  return { requestId: data.request_id, statusURL: data.status_url, responseURL: data.response_url };
}
export async function imageResult(task, key) {
  const options = { headers: { Authorization: `Key ${key}` } };
  const status = await jsonCall(task.statusURL, options);
  if (status.status !== 'COMPLETED') return null;
  if (status.error) throw new Error('Image request failed. No automatic paid retry.');
  const data = await jsonCall(task.responseURL, options);
  if (data.has_nsfw_concepts?.some(Boolean)) throw new Error('Opening image was blocked by the safety checker.');
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('No opening image returned.');
  return url;
}
export async function submitWan(input, image, prompt, key) {
  const data = await jsonCall(`${WAN_BASE}/services/aigc/video-generation/video-synthesis`, { method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' },
    body: JSON.stringify({ model: 'wan2.2-i2v-flash', input: { prompt, img_url: image },
      parameters: { resolution: input.resolution.toUpperCase(), duration: 5, prompt_extend: false,
        seed: 724127, watermark: true } }) });
  const id = data.output?.task_id;
  if (!/^[a-zA-Z0-9_-]+$/.test(id || '')) throw new Error('No valid video task ID.');
  return id;
}
export async function wanResult(id, key) {
  const data = await jsonCall(`${WAN_BASE}/tasks/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } });
  const status = data.output?.task_status;
  if (['FAILED', 'CANCELED', 'UNKNOWN'].includes(status)) throw new Error(`Video task ${status}; no automatic paid retry.`);
  if (status !== 'SUCCEEDED') return null;
  if (!data.output?.video_url) throw new Error('No output video URL.');
  if (data.usage?.duration && Number(data.usage.duration) !== 5) throw new Error('Unexpected billed duration; inspect invoice.');
  return data.output.video_url;
}
export async function download(url, path) {
  const u = new URL(url);
  const hosts = ['fal.media', 'aliyuncs.com', 'storage.googleapis.com'];
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !hosts.some(host => u.hostname === host || u.hostname.endsWith(`.${host}`)))
    throw new Error('Provider returned an untrusted download host.');
  const response = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error('Media download failed.');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 64 * 1024 * 1024) throw new Error('Media exceeds 64 MiB download limit.');
    chunks.push(chunk);
  }
  await writeFile(path, Buffer.concat(chunks));
}
