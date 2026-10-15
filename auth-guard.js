// Atomic D1 counters are shared across Worker instances. No raw IPs are stored.
export async function authLimit(request, db, route) {
  const windowSeconds=900,now=Math.floor(Date.now()/1000),bucket=Math.floor(now/windowSeconds);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${route}:${request.headers.get('CF-Connecting-IP') || 'unknown'}:${bucket}`));
  const key=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const limit=route==='/api/register'?3:10;
  await db.prepare('CREATE TABLE IF NOT EXISTS auth_attempts (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL)').run();
  await db.prepare('DELETE FROM auth_attempts WHERE expires_at < ?').bind(now).run();
  const row=await db.prepare(`INSERT INTO auth_attempts (id,attempts,expires_at) VALUES (?,1,?)
    ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 WHERE attempts < ? RETURNING attempts`)
    .bind(key,(bucket+1)*windowSeconds,limit).first();
  return row ? 0 : (bucket+1)*windowSeconds-now;
}

export async function authBody(request) {
  if(!request.headers.get('Content-Type')?.includes('application/json')) throw Object.assign(new Error('Use a JSON request.'),{status:415});
  const chunks=[];let size=0;
  for await(const chunk of request.body || []) {
    size+=chunk.byteLength;if(size>4096)throw Object.assign(new Error('Request too large.'),{status:413});
    chunks.push(chunk);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let body;
  try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Object.assign(new Error('Invalid JSON request.'),{status:400});}
  if(!body || Array.isArray(body) || typeof body!=='object' || typeof body.email!=='string' || typeof body.password!=='string' || body.email.length>254 || body.password.length>256)
    throw Object.assign(new Error('Invalid email or password format.'),{status:400});
  return body;
}
