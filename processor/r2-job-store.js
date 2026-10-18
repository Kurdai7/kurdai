// One private, conditional-write manifest fences overlapping Render instances.
// A failed/ambiguous write poisons this writer: it cannot submit more paid work.
import {randomUUID} from 'node:crypto';
import {putR2Object,readR2Object} from './r2-storage.js';
const KEY='processor/job-state-v1.json';
const LIMIT=20*1024*1024;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function validate(state) {
  if(state?.version!==1 || !Array.isArray(state.jobs) || state.jobs.length>500 ||
    typeof state.paidTestReserved!=='boolean')throw new Error('Invalid durable job state');
  const seen=new Set();
  for(const job of state.jobs) {
    if(!uuid.test(job.id) || seen.has(job.id) || !/^[a-zA-Z0-9_-]{1,100}$/.test(job.owner || '') ||
      !job.input || !['quoted','running','uncertain','created','pending','processing','ready','failed','completed','cancelled','timeout','deleted'].includes(job.status))
      throw new Error('Invalid durable job record');
    seen.add(job.id);
  }
  return state;
}
export async function openJobStore(env,transport={put:putR2Object,read:readR2Object}) {
  let state={version:1,jobs:[],paidTestReserved:false},etag=null,healthy=true;
  try {const result=await transport.read(env,KEY,LIMIT);state=validate(JSON.parse(result.bytes));etag=result.etag;
    if(!etag)throw new Error('Missing durable state ETag');
  } catch(error) {if(error.status!==404)throw error;}
  const writer=randomUUID();
  async function commit(next) {
    if(!healthy)throw new Error('Durable writer requires operator reconciliation');
    validate(next);const bytes=Buffer.from(JSON.stringify({...next,writer}));
    if(bytes.length>LIMIT)throw new Error('Durable job state is full');
    try {
      const nextETag=await transport.put(env,KEY,bytes,etag?{ifMatch:etag}:{ifNoneMatch:'*'});
      if(!nextETag)throw new Error('Missing durable write acknowledgement');
      etag=nextETag;state=JSON.parse(bytes);
    } catch {healthy=false;throw new Error('Durable job write failed; paid submission blocked');}
  }
  // Claim a new generation before serving any request. Old processes retain a
  // stale ETag, so their next pre-submission checkpoint cannot succeed.
  await commit(state);
  return {
    jobs:state.jobs, get healthy(){return healthy;},
    get paidTestReserved(){return state.paidTestReserved;},
    async save(jobs){await commit({...state,jobs});},
    async reservePaidTest(jobs){
      if(state.paidTestReserved)throw new Error('Single paid test already reserved');
      await commit({...state,jobs,paidTestReserved:true});
    }
  };
}
