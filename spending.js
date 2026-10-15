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
