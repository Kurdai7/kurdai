// Fail-closed speech request preparation for the future LTX-2.3 adapter.
// No provider API call occurs here. Never label an untested voice as supported.
import { dialogueInstruction } from './dialogue.js';
import { evaluateLtx, LTX_MODEL } from './ltx-evaluation.js';

export function prepareLtxSpeech({language, dialogueText, visualPrompt, maxEUR=0.20, usdPerEUR=1.12, extraEUR=null}) {
  if (!['sorani','badini'].includes(language)) throw new Error('Choose Sorani or Badini.');
  const line = String(dialogueText ?? '').trim();
  const scene = String(visualPrompt ?? '').trim();
  if (!line || line.length > 500) throw new Error('Provide 1–500 characters of dialogue.');
  if (!scene || scene.length > 800) throw new Error('Provide 1–800 characters of visual prompt.');
  const budget = evaluateLtx({language, maxEUR, usdPerEUR, extraEUR});
  return Object.freeze({
    model: LTX_MODEL, language, duration:5, resolution:'720p',
    prompt: scene + '\n' + dialogueInstruction(language) + '\nSpoken dialogue: ' + line,
    budget,
    speechVerified:false, providerConfigured:false, canSubmit:false,
    reason:'LTX API adapter and Kurdish speech verification are not complete.'
  });
}
