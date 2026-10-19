import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePrunaTests} from '../scripts/pruna-preflight.js';
test('Pruna candidate preparation stays offline, preserves separate dialects and refuses to claim paid readiness',()=>{
 const plan=preparePrunaTests(new Date('2026-10-19T08:00:00Z'));
 assert.equal(plan.canSubmit,false);assert.equal(plan.productionEnabled,false);assert.equal(plan.totalInvoiceEUR,null);
 assert.deepEqual(plan.cases.map(c=>c.dialect),['sorani','badini']);
 for(const c of plan.cases){
  assert.equal(c.speechVerified,false);assert.equal(c.runware.numberResults,1);
  assert.equal(c.runware.model,'prunaai:p-video@2-pro');
  assert.equal(c.runware.width,1344);assert.equal(c.runware.height,768);
  assert.equal(c.pruna.body.input.duration,5);assert.equal(c.pruna.body.input.mode,'cost');
  assert.equal(c.pruna.body.input.prompt_upsampler,'off');assert.equal(c.runware.settings.promptUpsampling,'off');
  assert.equal(c.estimatesUSD.directFiveSeconds,0.125);assert.equal(c.estimatesUSD.runwareFiveSeconds,0.0625);
  assert.ok(c.estimatesUSD.runwareFifteenSeconds>c.estimatesUSD.runwareFiveSeconds);
 }
 assert.notEqual(plan.cases[0].runware.taskUUID,plan.cases[1].runware.taskUUID);
 assert.match(plan.cases[0].runware.positivePrompt,/Central Kurdish/);assert.match(plan.cases[1].runware.positivePrompt,/Behdini/);
});
test('a later review never silently carries forward the promotional rate or authorizes generation',()=>{
 for(const date of ['2026-10-20','2026-10-29','2026-11-01']){
  const plan=preparePrunaTests(new Date(date));assert.equal(plan.priceReviewCurrent,false);
  assert.equal(plan.runwarePromotionApplied,false);assert.equal(plan.canSubmit,false);
  assert.equal(plan.cases[0].estimatesUSD.runwareFiveSeconds,0.125);
 }
});
