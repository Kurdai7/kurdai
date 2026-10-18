import {randomUUID} from 'node:crypto';
export function memoryJobStorage() {
  const objects=new Map();
  return {
    async read(_env,key){const row=objects.get(key);if(!row)throw Object.assign(new Error('missing'),{status:404});return {bytes:Buffer.from(row.bytes),etag:row.etag};},
    async put(_env,key,bytes,condition){const prior=objects.get(key);
      if((condition.ifNoneMatch==='*' && prior) || (condition.ifMatch && prior?.etag!==condition.ifMatch))
        throw Object.assign(new Error('conflict'),{status:412});
      const etag='"'+randomUUID()+'"';objects.set(key,{bytes:Buffer.from(bytes),etag});return etag;
    }
  };
}
export const durableTestFlags={R2_JOB_METADATA_ENABLED:'true',R2_VIDEO_ARCHIVE_ENABLED:'true',LONG_DURABLE_STORAGE:'true'};
