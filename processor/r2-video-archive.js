// Optional private final-video archive. Never claim this makes job metadata durable.
// Explicit calls only: no background uploads, no provider generation, no public URLs.
import {readFile, writeFile, mkdir, link, unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {putR2Object,getR2Object} from './r2-storage.js';
const jobId = id => {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))
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
export async function restoreFinalVideo(env,id,directory,expectedSHA256) {
  if(expectedSHA256!==undefined && !/^[a-f0-9]{64}$/.test(expectedSHA256))
    throw new Error('Invalid archived video checksum');
  const bytes=await getR2Object(env,finalVideoKey(id));
  if (!bytes.length || bytes.length > 100*1024*1024) throw new Error('Invalid archived video size');
  if(expectedSHA256!==undefined && createHash('sha256').update(bytes).digest('hex')!==expectedSHA256)
    throw new Error('Archived video checksum mismatch');
  await mkdir(directory,{recursive:true,mode:0o700});
  const path=join(directory,'final.mp4');
  const temporary=join(directory,'.restore-'+randomUUID());
  try {
    await writeFile(temporary,bytes,{flag:'wx',mode:0o600});
    // Publish only complete files; another restore can win without overwrite.
    await link(temporary,path);
  } finally {await unlink(temporary).catch(()=>{});}
  return path;
}
