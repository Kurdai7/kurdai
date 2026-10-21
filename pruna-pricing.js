// Reviewed against https://docs.api.pruna.ai/guides/models/p-video-2 on 2026-10-21.
// Applies only to our fixed 720p, draft=true transport. Provider invoices win.
export const PRUNA_DRAFT_USD_PER_SECOND=0.015;
export const PRUNA_PRICE_REVIEWED='2026-10-21';
export function prunaOutputCost(seconds) {
 if(!Number.isFinite(seconds)||seconds<=0)throw new Error('Invalid output duration.');
 return Number((seconds*PRUNA_DRAFT_USD_PER_SECOND).toFixed(6));
}
export function recordPrunaUsage(job,taskId,seconds) {
 if(typeof taskId!=='string'||!taskId)throw new Error('Missing provider task.');
 const usage=job.providerUsage || (job.providerUsage={});
 const tasks=usage.prunaTasks || (usage.prunaTasks=[]);
 if(tasks.some(t=>t.taskId===taskId))return;
 tasks.push({taskId,measuredOutputSeconds:seconds,
  // The provider's whole-second rounding rule is not an invoice; retain both.
  conservativeBilledSeconds:Math.ceil(seconds),
  listPriceUSD:prunaOutputCost(Math.ceil(seconds)),invoiceVerified:false});
 usage.prunaOutputUSD=Number(tasks.reduce((sum,t)=>sum+t.listPriceUSD,0).toFixed(6));
 usage.currency='USD';usage.priceReviewed=PRUNA_PRICE_REVIEWED;
 usage.basis='Measured media duration, rounded up at published Draft rate; invoice reconciliation pending.';
}
