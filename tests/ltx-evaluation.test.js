import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLtx } from '../ltx-evaluation.js';
test('LTX estimate stays disabled even when nominal cost fits', () => {
  const result = evaluateLtx({language:'sorani', extraEUR:0});
  assert.equal(result.withinBudget,true);
  assert.equal(result.canGenerate,false);
  assert.equal(result.speechVerified,false);
});
test('LTX rejects unknown extra charges and over-budget costs', () => {
  assert.equal(evaluateLtx().withinBudget,false);
  assert.equal(evaluateLtx({extraEUR:0.10}).withinBudget,false);
});
test('LTX requires exact duration and resolution', () => {
  assert.throws(()=>evaluateLtx({duration:10}));
  assert.throws(()=>evaluateLtx({resolution:'480p'}));
});
