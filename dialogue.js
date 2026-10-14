// Capability labels deliberately distinguish prompting, documented TTS support and tested audio.
export const DIALECTS = Object.freeze({
  sorani: { label: 'کوردی سۆرانی (Sorani Kurdish)', code: 'ckb', nativeVideoVerified: false,
    ttsDocumented: 'gemini-3.8-flash-lite-tts', ttsEnabled: false,
    instruction: 'All spoken dialogue must be natural Sorani Kurdish (Central Kurdish). Use Sorani vocabulary, grammar, pronunciation and intonation only. Never mix Badini or Kurmanji. Read supplied Sorani lines verbatim; do not translate or paraphrase. No English speech.' },
  badini: { label: 'کوردی بادینی (Badini Kurdish)', code: 'badini', nativeVideoVerified: false,
    ttsDocumented: 'kurdishtts-v5-badini', ttsEnabled: false,
    instruction: 'All spoken dialogue must be Badini Kurdish (Behdini), the Northern Kurdish variety spoken in Duhok and Badinan. Use specifically Badini vocabulary, grammar, pronunciation and intonation. Never replace it with Sorani or a generic Kurmanji accent. Read supplied Badini lines verbatim; do not translate or paraphrase. No English speech.' }
});
export function dialogueInstruction(language) {
  if (language === 'none') return 'No spoken dialogue.';
  if (!DIALECTS[language]) throw new Error('Choose Sorani, Badini or no dialogue.');
  return DIALECTS[language].instruction;
}
export const AUDIO_COSTS = Object.freeze({ reviewed: '2026-10-14',
  geminiLiteInputPerMillionUSD: 0.50, geminiLiteOutputPerSecondUSD: 0.00015,
  geminiRateExpires: '2026-12-31',
  kurdishTTSCharacterPackPer1000USD: 0.006,
  // Subscription/license allocation is additional; a top-up alone does not prove a commercial license.
  kurdishTTSSubscriptionRequired: true });
export function audioPreview(language, text = '', seconds = 70) {
  if (language === 'none') return { language, enabled: true, apiUSD: 0, estimateUSD: 0, reason: 'Silent output.' };
  if (!DIALECTS[language]) throw new Error('Invalid dialogue language.');
  const estimateUSD = language === 'sorani' ? seconds * AUDIO_COSTS.geminiLiteOutputPerSecondUSD :
    text.length * AUDIO_COSTS.kurdishTTSCharacterPackPer1000USD / 1000;
  return { language, enabled: false, apiUSD: null, estimateUSD,
    estimateBasis: language === 'sorani' ? 'Output audio only; add $0.50 per million actual input tokens, through 2026-12-31.' :
      'Character top-up reference only; add actual subscription/license allocation. Confirm Unicode billing with provider.',
    reason: 'TTS is not enabled or tested. Full audio cost, commercial access, voice and muxing must be verified before spending.' };
}
