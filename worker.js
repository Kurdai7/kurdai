/**
 * KurdAI API starter for Cloudflare Workers + D1.
 * Bind D1 database as DB. Configure EMAIL_API_KEY and EMAIL_FROM secrets,
 * then implement a real provider in sendVerificationEmail before production.
 * Never deploy until reviewing security, abuse prevention, and email delivery.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: corsHeaders });
const nowIso = () => new Date().toISOString();
const id = () => crypto.randomUUID();
async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function passwordDigest(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(x => parseInt(x, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function helsinkiDay(date = new Date()) {
  // Intl formats Europe/Helsinki correctly across daylight-saving changes.
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
async function sendVerificationEmail(env, email, token, requestUrl) {
  // Deliberately fail closed: configure an actual email provider before enabling registration.
  // Never return the verification token to the browser in production.
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) throw new Error('Email provider is not configured');
  // Resend API example. Set EMAIL_API_KEY and EMAIL_FROM in Worker secrets/vars.
  const verifyUrl = `${new URL(requestUrl).origin}/api/verify?token=${encodeURIComponent(token)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'Verify your KurdAI account',
      html: `<p>Welcome to KurdAI.</p><p><a href="${verifyUrl}">Verify your email</a></p><p>This link expires in 30 minutes.</p>`
    })
  });
  if (!response.ok) throw new Error('Email provider rejected the message');
}
async function currentUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const sessionHash = await sha256(match[1]);
  const row = await env.DB.prepare('SELECT u.id, u.email, u.verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(sessionHash, nowIso()).first();
  return row || null;
}
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    try {
      // Serve the existing static KurdAI interface for all non-API routes.
      // The ASSETS binding is configured in wrangler.toml.
      if (!url.pathname.startsWith('/api/')) {
        if (!env.ASSETS) return new Response('KurdAI static assets binding is not configured.', { status: 503 });
        return env.ASSETS.fetch(request);
      }
      if (!env.DB) return json({ error: 'D1 database binding DB is not configured.' }, 503);
      if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true, service: 'KurdAI API starter' });

      if (url.pathname === '/api/register' && request.method === 'POST') {
        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
        if (password.length < 12) return json({ error: 'Use a password with at least 12 characters.' }, 400);
        const userId = id();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
        const passwordHash = await passwordDigest(password, saltHex);
        const token = `${id()}${id().replaceAll('-', '')}`;
        const tokenHash = await sha256(token);
        const created = nowIso();
        try {
          await env.DB.prepare('INSERT INTO users (id,email,password_hash,verified,created_at) VALUES (?,?,?,?,?)').bind(userId, email, `${saltHex}:${passwordHash}`, 0, created).run();
          await env.DB.prepare('INSERT INTO verification_tokens (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(tokenHash, userId, new Date(Date.now() + 30 * 60 * 1000).toISOString(), created).run();
          await sendVerificationEmail(env, email, token, request.url);
        } catch (e) {
          await env.DB.prepare('DELETE FROM users WHERE id=? AND verified=0').bind(userId).run().catch(() => {});
          return json({ error: 'Registration could not finish. Check the email-provider setup and try again.' }, 503);
        }
        return json({ ok: true, message: 'Check your email for the verification link.' }, 201);
      }

      if (url.pathname === '/api/verify' && request.method === 'GET') {
        const token = url.searchParams.get('token') || '';
        if (!token || token.length > 200) return json({ error: 'Invalid verification link.' }, 400);
        const tokenHash = await sha256(token);
        const row = await env.DB.prepare('SELECT user_id, expires_at FROM verification_tokens WHERE token_hash=?').bind(tokenHash).first();
        if (!row || row.expires_at < nowIso()) return json({ error: 'This verification link is invalid or expired.' }, 400);
        await env.DB.prepare('UPDATE users SET verified=1 WHERE id=?').bind(row.user_id).run();
        await env.DB.prepare('DELETE FROM verification_tokens WHERE user_id=?').bind(row.user_id).run();
        return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>KurdAI</title><main style="font-family:system-ui;max-width:520px;margin:4rem auto;padding:1rem;text-align:center"><h1>Email verified</h1><p>Your KurdAI email is verified. Account login and video generation still need to be connected.</p></main>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      if (url.pathname === '/api/login' && request.method === 'POST') {
        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const user = await env.DB.prepare('SELECT id,email,password_hash,verified FROM users WHERE email=?').bind(email).first();
        if (!user) return json({ error: 'Email or password is incorrect.' }, 401);
        const [saltHex, storedHash] = user.password_hash.split(':');
        const candidate = await passwordDigest(password, saltHex);
        if (candidate !== storedHash) return json({ error: 'Email or password is incorrect.' }, 401);
        if (!user.verified) return json({ error: 'Verify your email before logging in.' }, 403);
        const session = `${id()}${id().replaceAll('-', '')}`;
        await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(await sha256(session), user.id, new Date(Date.now() + 7 * 86400000).toISOString(), nowIso()).run();
        return json({ ok: true, token: session, email: user.email });
      }

      if (url.pathname === '/api/logout' && request.method === 'POST') {
        const user = await currentUser(request, env);
        const auth = request.headers.get('Authorization') || '';
        const match = auth.match(/^Bearer\s+(.+)$/i);
        if (match) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(match[1])).run();
        return json({ ok: true });
      }

      if (url.pathname === '/api/me' && request.method === 'GET') {
        const user = await currentUser(request, env);
        if (!user) return json({ error: 'Please log in.' }, 401);
        const day = helsinkiDay();
        // One daily 30-credit grant per verified account, based on Finland's local date.
        const grantId = `daily:${user.id}:${day}`;
        await env.DB.prepare('INSERT OR IGNORE INTO credit_ledger (id,user_id,amount,reason,local_day,created_at) VALUES (?,?,?,?,?,?)').bind(grantId, user.id, 30, 'daily_grant', day, nowIso()).run();
        // Daily free credits reset at Finland midnight: show only today's ledger entries.
        // Future purchased credit packs must use a separate balance/category so they do not reset.
        const total = await env.DB.prepare('SELECT COALESCE(SUM(amount),0) AS credits FROM credit_ledger WHERE user_id=? AND local_day=?').bind(user.id, day).first();
        return json({ email: user.email, verified: !!user.verified, dailyCredits: total.credits, localDay: day });
      }
      return json({ error: 'Not found.' }, 404);
    } catch (e) {
      return json({ error: 'Unexpected server error.' }, 500);
    }
  }
};
