// Optional private final-video archive. Never claim this makes job metadata durable.
// Explicit calls only: no background uploads, no provider generation, no public URLs.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {putR2Object,getR2Object} from './r2-storage.js';
const jobId = id => {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9-]{27,28}$/.test(id))
    throw new Error('Invalid job ID');
  return id;
};
export const finalVideoKey = id => 'jobs/'+jobId(id)+'/final.mp4';
export async function archiveFinalVideo(env,id,localPath) {
  const bytes=await readFile(localPath);
  if (!bytes.length || bytes.length > 100*1024*1024) throw new Error('Invalid final video size');
  await putR2Object(env,finalVideoKey(id),bytes);
  return {archived:true,bytes:bytes.length};
}
export async function restoreFinalVideo(env,id,directory) {
  const bytes=await getR2Object(env,finalVideoKey(id));
  if (!bytes.length || bytes.length > 100*1024*1024) throw new Error('Invalid archived video size');
  await mkdir(directory,{recursive:true,mode:0o700});
  const path=join(directory,'final.mp4');
  await writeFile(path,bytes,{flag:'wx',mode:0o600});
  return path;
}
