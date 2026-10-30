const MODEL='@cf/black-forest-labs/flux-1-schnell';
const WINDOW_SECONDS=5*60*60;
const FREE_IMAGES=2;
const MAX_PROMPT_CHARS=1200;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function normalizeImageRequest(body){
  if(!body||typeof body!=='object'||Array.isArray(body)) throw new Error('پرۆمپتی وێنە دروست نییە.');
  const prompt=typeof body.prompt==='string'?body.prompt.trim():'';
  if(!prompt||prompt.length>MAX_PROMPT_CHARS) throw new Error('داواکاریی وێنە بنووسە؛ تا ١٢٠٠ پیت.');
  return {prompt};
}
export function quotaWindow(nowSeconds,startedAt,used){
  if(!Number.isFinite(startedAt)||nowSeconds-startedAt>=WINDOW_SECONDS) return {startedAt:nowSeconds,used:0};
  return {startedAt,used};
}
async function quota(db,userId,now){
  return db.prepare(`INSERT INTO image_usage(user_id,window_started_at,used)
    VALUES(?,?,1)
    ON CONFLICT(user_id) DO UPDATE SET
      window_started_at=CASE WHEN image_usage.window_started_at<=? THEN excluded.window_started_at ELSE image_usage.window_started_at END,
      used=CASE WHEN image_usage.window_started_at<=? THEN 1 ELSE image_usage.used+1 END
    WHERE image_usage.window_started_at<=? OR image_usage.used<?
    RETURNING window_started_at,used`)
    .bind(userId,now,now-WINDOW_SECONDS,now-WINDOW_SECONDS,now-WINDOW_SECONDS,FREE_IMAGES).first();
}
async function refund(db,userId,startedAt){
  await db.prepare('UPDATE image_usage SET used=MAX(0,used-1) WHERE user_id=? AND window_started_at=?')
    .bind(userId,startedAt).run().catch(()=>{});
}
export async function handleImage(request,env,user){
  if(request.method==='GET'){
    if(!user?.verified) return json({error:'Please log in with a verified account.'},401);
    if(!env.DB) return json({error:'Image service is unavailable.'},503);
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS image_usage(
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      window_started_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    )`).run();
    const row=await env.DB.prepare('SELECT window_started_at,used FROM image_usage WHERE user_id=?').bind(user.id).first();
    const now=Math.floor(Date.now()/1000);
    const current=quotaWindow(now,row?.window_started_at,row?.used??0);
    const used=current.startedAt===row?.window_started_at?current.used:0;
    return json({enabled:env.IMAGE_GENERATION_ENABLED==='true',model:MODEL,freeLimit:FREE_IMAGES,used,remaining:Math.max(0,FREE_IMAGES-used),resetsAt:current.startedAt+WINDOW_SECONDS,paidCreditsEnabled:false});
  }
  if(request.method!=='POST') return json({error:'Method not allowed.'},405);
  if(!user?.verified) return json({error:'Please log in with a verified account.'},401);
  if(env.IMAGE_GENERATION_ENABLED!=='true') return json({error:'Image generation is not enabled yet. No image request was sent.'},503);
  if(!env.AI||!env.DB) return json({error:'Image service is not configured.'},503);
  if(!request.headers.get('content-type')?.includes('application/json')) return json({error:'Use a JSON request.'},415);
  let input;
  try{
    const raw=await request.text();
    if(raw.length>5000) return json({error:'Prompt is too large.'},413);
    input=normalizeImageRequest(JSON.parse(raw));
  }catch(e){return json({error:e instanceof SyntaxError?'Invalid JSON.':e.message},400);}
  try{
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS image_usage(
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      window_started_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    )`).run();
    const now=Math.floor(Date.now()/1000);
    const reservation=await quota(env.DB,user.id,now);
    if(!reservation){
      const row=await env.DB.prepare('SELECT window_started_at,used FROM image_usage WHERE user_id=?').bind(user.id).first();
      const resetAt=(row?.window_started_at??now)+WINDOW_SECONDS;
      return json({code:'IMAGE_FREE_LIMIT',error:'You used your 2 free images. More image credits are not available yet.',remaining:0,resetsAt:resetAt,paidCreditsEnabled:false},402);
    }
    try{
      const result=await env.AI.run(MODEL,{prompt:input.prompt,width:512,height:512,steps:4});
      if(!result?.image||typeof result.image!=='string') throw new Error('Image model returned no image.');
      return json({ok:true,image:'data:image/jpeg;base64,'+result.image,remaining:Math.max(0,FREE_IMAGES-reservation.used),resetsAt:reservation.window_started_at+WINDOW_SECONDS,model:MODEL});
    }catch(error){
      await refund(env.DB,user.id,reservation.window_started_at);
      console.error('KurdAI image generation failed',{errorType:error?.name||'Error'});
      return json({error:'Image generation failed. Your free attempt has been returned; please try again.'},502);
    }
  }catch(error){
    console.error('KurdAI image request failed',{errorType:error?.name||'Error'});
    return json({error:'Image service is temporarily unavailable.'},503);
  }
}
