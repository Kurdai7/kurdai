// LTX-2.3 evaluation only. No provider requests, charges, or false Kurdish-audio claims.
// Prices are indicative; operator must verify current vendor rates before enabling.
export const LTX_MODEL = 'ltx-2.3';
export const LTX_EVALUATION = Object.freeze({
  provider: 'WaveSpeedAI',
  endpoint: 'https://wavespeed.ai/models/wavespeed-ai/ltx-2.3/text-to-video',
  resolution: '720p',
  durationSeconds: 5,
  quotedUSD: 0.15,
  speechVerified: Object.freeze({ sorani: false, badini: false }),
  apiIntegrated: false,
  spendingEnabled: false
});
export function evaluateLtx({ duration = 5, resolution = '720p', language = 'none', maxEUR = 0.20, usdPerEUR = 1.12, extraEUR = null } = {}) {
  if (duration !== 5 || resolution !== '720p') throw new Error('Only 5s 720p is under evaluation.');
  if (!['none', 'sorani', 'badini'].includes(language)) throw new Error('Unsupported language.');
  if (!(Number.isFinite(maxEUR) && maxEUR >= 0 && Number.isFinite(usdPerEUR) && usdPerEUR > 0))
    throw new Error('Invalid budget or exchange rate.');
  const estimatedBaseEUR = LTX_EVALUATION.quotedUSD / usdPerEUR;
  const fullCostKnown = Number.isFinite(extraEUR) && extraEUR >= 0;
  const estimatedTotalEUR = fullCostKnown ? estimatedBaseEUR + extraEUR : null;
  return {
    model: LTX_MODEL, duration, resolution, language, estimatedBaseEUR,
    estimatedTotalEUR, fullCostKnown, budgetEUR: maxEUR,
    withinBudget: fullCostKnown && estimatedTotalEUR <= maxEUR,
    speechVerified: language === 'none',
    canGenerate: false,
    reasons: ['Provider API not integrated or tested.', ...(language === 'none' ? [] : ['Kurdish speech unverified.']),
      ...(!fullCostKnown ? ['Extra charges and taxes unverified.'] : []),
      ...(fullCostKnown && estimatedTotalEUR > maxEUR ? ['Budget exceeded.'] : [])]
  };
}
