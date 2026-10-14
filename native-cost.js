// Provider list prices verified 2026-10-14, not a guarantee of the final invoice.
export const NATIVE_PRICES = Object.freeze({ reviewed: '2026-10-14', validUntil: '2026-10-21T00:00:00Z',
  fxDate: '2026-10-14', usdPerEUR: 1.1195,
  source: 'https://ai.google.dev/gemini-api/docs/pricing',
  fxSource: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html' });
export function nativeCost(input, parent = null) {
  const fast = input.model.includes('-fast-'), lite = input.model.includes('-lite-');
  const rate = lite ? (input.resolution === '1080p' ? .08 : .05) : fast ? (input.resolution === '1080p' ? .12 : .10) : .40;
  // Extension's incremental billing basis is not independently verified. Show a
  // conservative full-output ceiling, never claim seven seconds is the entire bill.
  const seconds = input.mode === 'extend' ? parent.duration + 7 : input.duration;
  const apiUSD = Number((seconds * rate).toFixed(6));
  return { ...NATIVE_PRICES, model: input.model, outputSeconds: seconds, billableSecondsBudget: seconds,
    apiUSD, apiEUR: Number((apiUSD / NATIVE_PRICES.usdPerEUR).toFixed(6)), usdPerSecond: rate,
    audioIncluded: true, retailMarkupEUR: 0, totalInvoiceEUR: null,
    basis: input.mode === 'extend' ? 'conservative full-output API budget; incremental extension billing unverified' : 'provider list-price API estimate',
    excluded: ['bank FX spread', 'applicable tax', 'hosting/storage/transfer'],
    canStart: Date.now() < Date.parse(NATIVE_PRICES.validUntil) };
}
export async function inputHash(input, body) {
  const canonical = JSON.stringify({ input, parentJobId: body.parentJobId || null, requestId: body.requestId });
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)))].map(v => v.toString(16).padStart(2, '0')).join('');
}
