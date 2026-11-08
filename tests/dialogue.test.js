import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DIALECTS,dialogueInstruction,audioPreview} from '../dialogue.js';

test('Sorani is explicitly the first-priority Kurdish dialogue profile',()=>{
  const instruction=dialogueInstruction('sorani');
  assert.equal(DIALECTS.sorani.code,'ckb');
  assert.match(instruction,/primary Kurdish language/i);
  assert.match(instruction,/conversational Sorani/i);
  assert.match(instruction,/Do not switch into Arabic, Persian or English/i);
  assert.match(instruction,/exactly as written/i);
  assert.match(instruction,/Do not translate, paraphrase, shorten, expand/i);
});

test('Sorani audio remains safely disabled until native voice quality is verified',()=>{
  assert.equal(DIALECTS.sorani.nativeVideoVerified,false);
  assert.equal(DIALECTS.sorani.ttsEnabled,false);
  const preview=audioPreview('sorani','سڵاو',5);
  assert.equal(preview.enabled,false);
  assert.equal(preview.apiUSD,null);
});
