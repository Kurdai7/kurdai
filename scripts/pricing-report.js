import { PROPOSED_PRODUCTS, unitEconomics } from '../pricing.js';
for (const monthlyOutputs of [100, 1000]) {
  console.log(`\nMonthly completed outputs: ${monthlyOutputs}`);
  console.table(PROPOSED_PRODUCTS.map(product => {
    const cost = unitEconomics(product, { monthlyOutputs });
    return { product: product.id, price: cost.price.toFixed(2), breakEven: cost.breakEven.toFixed(4), contribution: cost.contribution.toFixed(4), afterIllustrative30PercentTax: cost.illustrativeAfterTax.toFixed(4) };
  }));
}
