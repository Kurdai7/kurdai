// Private Cloudflare R2 S3-compatible object transport. No public bucket or SDK required.
// Not a durability guarantee until job metadata and media lifecycle are integrated.
import {createHash,createHmac} from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hmac = (key,value) => createHmac('sha256',key).update(value).digest();
const required = (value,name) => {if (!value) throw new Error(name+' is required');return value;};
function configOf(env) {
  const endpoint = new URL(required(env.R2_ENDPOINT,'R2_ENDPOINT'));
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash || endpoint.pathname !== '/' ||
      !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname))
    throw new Error('Invalid Cloudflare R2 endpoint');
  const bucket=required(env.R2_BUCKET,'R2_BUCKET');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Invalid bucket');
  return {endpoint,bucket,access:required(env.R2_ACCESS_KEY_ID,'R2_ACCESS_KEY_ID'),
    secret:required(env.R2_SECRET_ACCESS_KEY,'R2_SECRET_ACCESS_KEY')};
}
function requestParts(env,method,key,body,conditions={}) {
  const cfg=configOf(env);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,199}$/.test(key) || key.includes('..') || key.includes('//') || key.endsWith('/'))
    throw new Error('Invalid object key');
  const encoded=key.split('/').map(encodeURIComponent).join('/');
  const path='/'+cfg.bucket+'/'+encoded;
  const url=new URL(path,cfg.endpoint);
  const date=new Date().toISOString().replace(/[:-]|\.\d{3}/g,'');
  const short=date.slice(0,8), scope=short+'/auto/s3/aws4_request';
  const payload=body || Buffer.alloc(0), digest=sha(payload);
  const headers={'host':url.host,'x-amz-content-sha256':digest,'x-amz-date':date};
  if(conditions.ifMatch) headers['if-match']=conditions.ifMatch;
  if(conditions.ifNoneMatch) headers['if-none-match']=conditions.ifNoneMatch;
  const signed=Object.keys(headers).sort().join(';');
  const canonical=[method,path,'',...Object.keys(headers).sort().map(k=>k+':'+headers[k]),'',signed,digest].join('\n');
  const stringToSign=['AWS4-HMAC-SHA256',date,scope,sha(canonical)].join('\n');
  const keyBytes=hmac(hmac(hmac(hmac('AWS4'+cfg.secret,short),'auto'),'s3'),'aws4_request');
  const signature=createHmac('sha256',keyBytes).update(stringToSign).digest('hex');
  return {url,headers:{...headers,authorization:'AWS4-HMAC-SHA256 Credential='+cfg.access+'/'+scope+
    ', SignedHeaders='+signed+', Signature='+signature},payload};
}
export async function putR2Object(env,key,bytes,conditions={}) {
  const body=Buffer.from(bytes);
  const req=requestParts(env,'PUT',key,body,conditions);
  const response=await fetch(req.url,{method:'PUT',headers:req.headers,body,redirect:'error',
    signal:AbortSignal.timeout(60000)});
  await response.body?.cancel();
  if(!response.ok) throw Object.assign(new Error('R2 upload failed (HTTP '+response.status+')'),{status:response.status});
  return response.headers?.get('etag') || null;
}
export async function readR2Object(env,key,maxBytes=100*1024*1024) {
  const req=requestParts(env,'GET',key);
  const response=await fetch(req.url,{method:'GET',headers:req.headers,redirect:'error',
    signal:AbortSignal.timeout(60000)});
  if(!response.ok) {await response.body?.cancel();throw Object.assign(new Error('R2 download failed (HTTP '+response.status+')'),{status:response.status});}
  if(Number(response.headers?.get('content-length'))>maxBytes){await response.body?.cancel();throw new Error('R2 object exceeds size limit');}
  let bytes;
  if(response.body?.getReader) {
    const reader=response.body.getReader(),chunks=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>maxBytes){await reader.cancel();throw new Error('R2 object exceeds size limit');}chunks.push(Buffer.from(value));}
    bytes=Buffer.concat(chunks);
  } else bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>maxBytes)throw new Error('R2 object exceeds size limit');
  return {bytes,etag:response.headers?.get('etag') || null};
}
export const getR2Object = async(env,key,maxBytes)=>(await readR2Object(env,key,maxBytes)).bytes;
export async function checkR2Object(env,key) {
  const req=requestParts(env,'HEAD',key);
  const response=await fetch(req.url,{method:'HEAD',headers:req.headers,redirect:'error',
    signal:AbortSignal.timeout(15000)});
  await response.body?.cancel();
  return response.status===200;
}

export async function deleteR2Object(env,key) {
  const req=requestParts(env,'DELETE',key);
  const response=await fetch(req.url,{method:'DELETE',headers:req.headers,redirect:'error',
    signal:AbortSignal.timeout(15000)});
  await response.body?.cancel();
  if(!response.ok) throw new Error('R2 delete failed (HTTP '+response.status+')');
}
