import {VIDEO_COST_CREDITS_PER_EUR} from './billing-packs.js';
import { BILLING_SCHEMA } from './billing.js';

const reservationSchema = `CREATE TABLE IF NOT EXISTS video_credit_reservations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), mode TEXT NOT NULL,
  job_id TEXT NOT NULL, credits INTEGER NOT NULL CHECK(credits>0),
  status TEXT NOT NULL CHECK(status IN ('reserved','captured','refunded')),
  UNIQUE(user_id,mode,job_id))`;
const failure = (message,status=409) => Object.assign(new Error(message),{status});
function key(userId,mode,jobId) {
  if (!['test','live'].includes(mode) || !/^[a-f0-9-]{36}$/.test(jobId || ''))
    throw failure('Invalid video billing request.',400);
  return JSON.stringify([userId,mode,jobId]);
}
async function initialize(db) {
  await db.batch([...BILLING_SCHEMA,reservationSchema].map(sql=>db.prepare(sql)));
}
export async function reserveVideoCredits(db,userId,mode,jobId,credits,allowNew=true) {
  const id=key(userId,mode,jobId);
  if (!Number.isSafeInteger(credits) || credits<1 || credits>1000000)
    throw failure('Video credit price is not configured.',503);
  await initialize(db);
  const stamp=Math.floor(Date.now()/1000);
  // Each conditional debit executes inside D1's atomic batch. Parallel jobs
  // cannot both spend the same balance, and replay cannot debit twice.
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO billing_ledger (id,user_id,mode,amount,reason,created_at)
      SELECT ?,?,?,-?,'video_reservation',? WHERE ?=1 AND
      NOT EXISTS (SELECT 1 FROM video_credit_reservations WHERE id=?) AND
      (SELECT COALESCE(SUM(amount),0) FROM billing_ledger WHERE user_id=? AND mode=?)>=?`)
      .bind('video:debit:'+id,userId,mode,credits,stamp,allowNew?1:0,id,userId,mode,credits),
    db.prepare(`INSERT OR IGNORE INTO video_credit_reservations (id,user_id,mode,job_id,credits,status)
      SELECT ?,?,?,?,?, 'reserved' WHERE EXISTS
      (SELECT 1 FROM billing_ledger WHERE id=?)`)
      .bind(id,userId,mode,jobId,credits,'video:debit:'+id)
  ]);
  const row=await db.prepare('SELECT credits,status FROM video_credit_reservations WHERE id=?').bind(id).first();
  if (!row) throw failure('Not enough purchased credits.',402);
  if (row.credits!==credits) throw failure('Reserved video price changed. Review the existing job.');
  if (row.status==='refunded') throw failure('This video was refunded. Request a new quote.');
  return row;
}
export async function settleVideoCredits(db,userId,mode,jobId,outcome) {
  const id=key(userId,mode,jobId);
  // Network errors, uncertain jobs and unfinished work retain their reservation.
  if (!['ready','failed','rejected'].includes(outcome)) return;
  await initialize(db);
  const status=outcome==='ready'?'captured':'refunded';
  await db.batch([
    db.prepare("UPDATE video_credit_reservations SET status=? WHERE id=? AND status='reserved'").bind(status,id),
    db.prepare(`INSERT OR IGNORE INTO billing_ledger (id,user_id,mode,amount,reason,created_at)
      SELECT ?,user_id,mode,credits,'video_refund',? FROM video_credit_reservations
      WHERE id=? AND status='refunded'`)
      .bind('video:refund:'+id,Math.floor(Date.now()/1000),id)
  ]);
}
export function videoCreditPrice(env,quote) {
  const rate=Number(env.VIDEO_CREDITS_PER_EUR ?? (env.STRIPE_MODE==='test'?VIDEO_COST_CREDITS_PER_EUR:NaN));
  if (!Number.isSafeInteger(rate) || rate<1 || rate>1000000 ||
    !Number.isFinite(quote?.totalEUR) || quote.totalEUR<=0 || quote.canStart!==true)
    throw failure('Video credit price or processor readiness is not confirmed.',503);
  const credits=Math.ceil(quote.totalEUR*rate);
  if (!Number.isSafeInteger(credits) || credits<1 || credits>1000000)
    throw failure('Video credit price is outside the supported limit.',503);
  return credits;
}
