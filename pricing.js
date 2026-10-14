// Planning only. These routes are NOT enabled generation adapters or checkout products.
// Quotes reviewed 2026-10-14. Live credentials, invoices and quality tests are still required.
export const ASSUMPTIONS = Object.freeze({
  reviewedOn: '2026-10-14', usdPerEur: 1.1188, fxBuffer: 0.02,
  vatRate: 0.255, paymentRate: 0.015, paymentFixedEur: 0.25,
  smallestPackEur: 2, creditValueEur: 0.01, retryCostBuffer: 0.20,
  refundReserveRate: 0.03, monthlyInfrastructureEur: 5, variableInfrastructureEur: 0.001,
  monthlyOutputs: 100, incomeTaxReserveScenario: 0.30
});
export const CREDIT_PACKS = Object.freeze([
  { amountCents: 200, credits: 200 },
  { amountCents: 500, credits: 500 },
  { amountCents: 1000, credits: 1000 }
]);
export const PROPOSED_PRODUCTS = Object.freeze([
  { id: 'economy-wan-5', tier: 'Economy', model: 'Wan 2.2 Fast 5B', provider: 'fal',
    endpoint: 'fal-ai/wan/v2.2-5b/text-to-video/fast-wan', seconds: 5, resolution: '720p', apiUsd: 0.025,
    credits: 15, audio: false, liveEnabled: false, qualification: 'Requires verification of actual frame count, duration and invoice. No native 10s offer; text-to-video only.' },
  { id: 'standard-seedance-5', tier: 'Standard', model: 'Seedance 1.0 Pro Fast', provider: 'fal',
    endpoint: 'fal-ai/bytedance/seedance/v1/pro/fast/text-to-video', seconds: 5, resolution: '720p', apiUsd: 0.108,
    credits: 30, audio: false, liveEnabled: false, qualification: 'Calculated from 1280×720, 24 FPS and $1/M video tokens. Bill may vary with actual dimensions/frame count.' },
  { id: 'standard-seedance-10', tier: 'Standard', model: 'Seedance 1.0 Pro Fast', provider: 'fal',
    endpoint: 'fal-ai/bytedance/seedance/v1/pro/fast/text-to-video', seconds: 10, resolution: '720p', apiUsd: 0.216,
    credits: 55, audio: false, liveEnabled: false, qualification: 'Calculated token estimate; native 10s endpoint.' },
  { id: 'budget-hailuo-6', tier: 'Budget image-to-video', model: 'Hailuo 02', provider: 'MiniMax direct',
    seconds: 6, resolution: '512p', apiUsd: 0.10, credits: 30, audio: false, liveEnabled: false,
    qualification: 'Native 6s, not 5s. This price is from MiniMax direct, not the fal endpoint. Direct end-user SaaS terms require confirmation.' },
  { id: 'budget-hailuo-10', tier: 'Budget image-to-video', model: 'Hailuo 02', provider: 'MiniMax direct',
    seconds: 10, resolution: '512p', apiUsd: 0.15, credits: 40, audio: false, liveEnabled: false,
    qualification: 'Direct price; direct end-user SaaS terms require confirmation.' },
  { id: 'pro-kling-5', tier: 'Pro', model: 'Kling 2.5 Turbo Standard', provider: 'fal',
    endpoint: 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video', seconds: 5, resolution: 'provider standard', apiUsd: 0.21,
    credits: 55, audio: false, liveEnabled: false, qualification: 'Image-to-video. Input image cost is additional if KurdAI generates the image.' },
  { id: 'pro-kling-10', tier: 'Pro', model: 'Kling 2.5 Turbo Standard', provider: 'fal',
    endpoint: 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video', seconds: 10, resolution: 'provider standard', apiUsd: 0.42,
    credits: 100, audio: false, liveEnabled: false, qualification: 'Image-to-video; not a guaranteed seamless extension or Sorani audio model.' }
]);
export function unitEconomics(product, overrides = {}) {
  const a = { ...ASSUMPTIONS, ...overrides };
  if (a.monthlyOutputs <= 0 || a.smallestPackEur <= 0 || a.usdPerEur <= 0) throw new Error('Positive volume, exchange rate and pack size are required.');
  const price = product.credits * a.creditValueEur;
  const api = product.apiUsd / a.usdPerEur * (1 + a.fxBuffer);
  const retry = api * a.retryCostBuffer;
  const vat = price - price / (1 + a.vatRate);
  // Fixed fee allocated proportionally to the value consumed from a prepaid pack.
  const payment = price * (a.paymentRate + a.paymentFixedEur / a.smallestPackEur);
  const infrastructure = a.monthlyInfrastructureEur / a.monthlyOutputs + a.variableInfrastructureEur;
  const refundReserve = price * a.refundReserveRate;
  const contribution = price - vat - api - retry - payment - infrastructure - refundReserve;
  const denominator = 1 / (1 + a.vatRate) - a.paymentRate - a.paymentFixedEur / a.smallestPackEur - a.refundReserveRate;
  return { price, api, retry, vat, payment, infrastructure, refundReserve, contribution,
    illustrativeAfterTax: contribution * (1 - a.incomeTaxReserveScenario),
    breakEven: denominator > 0 ? (api + retry + infrastructure) / denominator : Infinity,
    note: 'Excludes owner pay, marketing, accounting, YEL, domain and costs beyond the stated infrastructure budget. Income-tax reserve is an illustration, not the owner’s tax rate.' };
}
