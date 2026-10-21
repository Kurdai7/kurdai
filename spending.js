// Application reservations, not a provider invoice cap. Each backend has its own ledger.
// No billable request is allowed without an explicit opt-in AND positive limits.
export function spendingPolicy(config) {
  const amount = key => {
    const value = config[key];
    return typeof value === 'string' && /^\d+(?:\.\d{1,6})?$/.test(value)
      && Number.isFinite(Number(value)) ? Number(value) : 0;
  };
  const perJobUSD = amount('API_MAX_JOB_USD'), perDayUSD = amount('API_MAX_DAY_USD');
  return { enabled: config.BILLABLE_REQUESTS_ENABLED === 'true' && perJobUSD > 0 && perDayUSD > 0,
    perJobUSD, perDayUSD, scope: 'per-backend', basis: 'reserved API estimates; excludes tax, hosting and storage' };
}
export function budgetAllows(policy, estimate, reserved = 0) {
  return policy.enabled && Number.isFinite(estimate) && estimate > 0 &&
    Number.isFinite(reserved) && reserved >= 0 && estimate <= policy.perJobUSD &&
    Math.round((reserved + estimate) * 1e6) <= Math.round(policy.perDayUSD * 1e6);
}

// Optional processor EUR reservation limits. These do not cap a provider invoice.
// Keep approved failed/uncertain jobs reserved; never refund an unknown exposure.
export function euroBudgetAllows(config, estimate, monthlyReserved = 0, lifetimeReserved = 0) {
  if (!Number.isFinite(estimate) || estimate <= 0) return false;
  for (const [key, reserved] of [['PROCESSOR_MAX_MONTH_EUR', monthlyReserved], ['PROCESSOR_MAX_TOTAL_EUR', lifetimeReserved]]) {
    if (config[key] === undefined) continue;
    const raw = config[key];
    if (typeof raw !== 'string' || !/^\d+(?:\.\d{1,6})?$/.test(raw)) return false;
    const limit = Number(raw);
    if (!(limit > 0) || !Number.isSafeInteger(Math.round(limit * 1e6)) ||
        !Number.isFinite(reserved) || reserved < 0 ||
        Math.ceil((reserved + estimate) * 1e6) > Math.round(limit * 1e6)) return false;
  }
  return true;
}

export function budgetMonth(stamp) {
  const date = new Date(stamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en', {timeZone:'Europe/Helsinki', year:'numeric', month:'2-digit'})
    .formatToParts(date);
  return `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}`;
}

// Conservative reservations survive failure and uncertainty. Legacy unclassified
// jobs were owner-only and count as admin exposure. Customers have a separate cap.
export function adminMonthlyBudgetAllows(config,jobs,estimate,stamp=new Date().toISOString()) {
 const configured=config.ADMIN_AI_MAX_MONTH_EUR ?? '10';
 if(typeof configured!=='string'||!/^\d+(?:\.\d{1,6})?$/.test(configured))return false;
 const limit=Math.min(10,Number(configured)),month=budgetMonth(stamp);
 if(!(limit>0)||!month||!Number.isFinite(estimate)||estimate<=0)return false;
 let reserved=0;
 for(const job of jobs) {
  if(!job.approvedAt || job.billingClass==='customer')continue;
  const previousMonth=budgetMonth(job.approvedAt);
  if(previousMonth!==month && previousMonth!==null)continue;
  if(!Number.isFinite(job.approvedTotalEUR)||job.approvedTotalEUR<=0)return false;
  reserved+=job.approvedTotalEUR;
 }
 return Math.round(reserved*1e6)+Math.ceil(estimate*1e6)<=Math.floor(limit*1e6);
}

