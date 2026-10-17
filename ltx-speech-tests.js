// Speech test vectors only. No synthesized audio is produced by this file.
import { dialogueInstruction } from './dialogue.js';
export const LTX_SPEECH_CASES = Object.freeze([
  Object.freeze({
    language: 'sorani',
    text: 'سڵاو، بەخێربێن بۆ کورد ئەی.',
    expected: 'Natural Sorani Kurdish, exact words, no Badini or English speech.'
  }),
  Object.freeze({
    language: 'badini',
    text: 'سلاڤ، بخێر هاتن بۆ کورد ئەی.',
    expected: 'Natural Badini Kurdish, exact words, no Sorani or English speech.'
  })
]);
export function speechTestPlan() {
  return LTX_SPEECH_CASES.map(item => ({
    ...item, prompt: dialogueInstruction(item.language) + ' Spoken line: ' + item.text,
    providerCallMade: false, audioGenerated: false, pronunciationVerified: false,
    readyForPaidTest: false
  }));
}
