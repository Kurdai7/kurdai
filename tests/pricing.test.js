import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREDIT_PACKS, PROPOSED_PRODUCTS, unitEconomics } from '../pricing.js';
test('small packs retain a constant cent per credit without unsustainable bonus discounts', () => {
  for (const pack of CREDIT_PACKS) assert.equal(pack.amountCents, pack.credits);
});
test('proposed products cover listed costs at the conservative 100 outputs/month assumption', () => {
  for (const product of PROPOSED_PRODUCTS) {
    assert.equal(product.liveEnabled, false);
    const costs = unitEconomics(product);
    assert.ok(costs.contribution > 0, product.id);
    assert.ok(costs.price > costs.breakEven, product.id);
  }
});
test('€0.10 economy is loss-making at low volume but contribution-positive at 1000 outputs', () => {
  const product = { ...PROPOSED_PRODUCTS[0], credits: 10 };
  assert.ok(unitEconomics(product, { monthlyOutputs: 100 }).contribution < 0);
  assert.ok(unitEconomics(product, { monthlyOutputs: 1000 }).contribution > 0);
});
test('income tax is applied to remaining profit, VAT is extracted from gross, and Stripe fixed fee is allocated once', () => {
  const costs = unitEconomics(PROPOSED_PRODUCTS[0]);
  assert.ok(Math.abs(costs.vat - (.15 - .15 / 1.255)) < 1e-10);
  assert.ok(Math.abs(costs.payment - .15 * (.015 + .25 / 2)) < 1e-10);
  assert.ok(Math.abs(costs.illustrativeAfterTax - costs.contribution * .7) < 1e-10);
  assert.throws(() => unitEconomics(PROPOSED_PRODUCTS[0], { monthlyOutputs: 0 }));
});
