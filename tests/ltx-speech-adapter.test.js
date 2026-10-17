import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareLtxSpeech } from '../ltx-speech-adapter.js';
test('Sorani speech is kept distinct and not falsely enabled', () => {
  const x=prepareLtxSpeech({language:'sorani',dialogueText:'سڵاو، بەخێربێن بۆ کورد ئەی.',visualPrompt:'Animated host.'});
  assert.match(x.prompt,/Sorani Kurdish/);
  assert.match(x.prompt,/سڵاو، بەخێربێن/);
  assert.equal(x.canSubmit,false);
  assert.equal(x.speechVerified,false);
});
test('Badini speech is kept distinct and not falsely enabled', () => {
  const x=prepareLtxSpeech({language:'badini',dialogueText:'سلاڤ، بخێر هاتن بۆ کورد ئەی.',visualPrompt:'Animated host.'});
  assert.match(x.prompt,/Badini Kurdish/);
  assert.match(x.prompt,/سلاڤ، بخێر هاتن/);
  assert.equal(x.canSubmit,false);
});
test('Missing dialogue and unsupported dialect are rejected', () => {
  assert.throws(()=>prepareLtxSpeech({language:'sorani',dialogueText:'',visualPrompt:'Scene'}));
  assert.throws(()=>prepareLtxSpeech({language:'english',dialogueText:'Hello',visualPrompt:'Scene'}));
});
