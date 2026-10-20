// Prepared catalogue only. Live activation is a separate, explicit owner decision.
export const PACKS_VERSION='2026-10-21-v2';
export const VIDEO_COST_CREDITS_PER_EUR=100;
// Planning reserves, NOT a statement of the owner's VAT registration or negotiated fees.
export const PACK_RESERVES=Object.freeze({feeBps:600,fixedFeeCents:30,salesTaxBps:3500,operationsBps:500});
export const PREPARED_PACKS=Object.freeze([
 Object.freeze({id:'starter_eur1',amountCents:100,credits:30}),
 Object.freeze({id:'value_eur5',amountCents:500,credits:280})
]);
export const TEST_CREDIT_PACKS=Object.freeze([
 Object.freeze({...PREPARED_PACKS[0],priceId:'price_1USkNvLYuEhQ3izYWc8pYaCu'}),
 Object.freeze({...PREPARED_PACKS[1],priceId:'price_1USkOULYuEhQ3izY69GNaw4J'})
]);
export function packEconomics(pack, rate=VIDEO_COST_CREDITS_PER_EUR, reserves=PACK_RESERVES) {
 if(!pack || !Number.isSafeInteger(pack.amountCents) || pack.amountCents<50 ||
  !Number.isSafeInteger(pack.credits) || pack.credits<1 || !Number.isSafeInteger(rate) || rate<1 ||
  !reserves || !['feeBps','fixedFeeCents','salesTaxBps','operationsBps'].every(k=>Number.isSafeInteger(reserves[k])&&reserves[k]>=0&&reserves[k]<=10000))
  return {safe:false};
 const gross=pack.amountCents*10000;
 if(!Number.isSafeInteger(gross))return {safe:false};
 const afterTax=Math.floor(gross*10000/(10000+reserves.salesTaxBps));
 const fee=Math.ceil(gross*reserves.feeBps/10000)+reserves.fixedFeeCents*10000;
 const operations=Math.ceil(gross*reserves.operationsBps/10000);
 const service=Math.ceil(pack.credits*1000000/rate);
 const remainder=afterTax-fee-operations-service;
 return {safe:remainder>=0,grossEUR:gross/1000000,feeReserveEUR:fee/1000000,
  salesTaxReserveEUR:(gross-afterTax)/1000000,operationsReserveEUR:operations/1000000,
  maximumServiceCostEUR:service/1000000,remainderEUR:remainder/1000000};
}
export function preparedLiveEconomics(env,packs) {
 if(env.STRIPE_PACK_ECONOMICS_VERIFIED!=='true' || Number(env.VIDEO_CREDITS_PER_EUR)!==VIDEO_COST_CREDITS_PER_EUR ||
  packs.length!==PREPARED_PACKS.length)return false;
 return packs.every(p=>{
  const expected=PREPARED_PACKS.find(x=>x.id===p.id);
  return expected && p.amountCents===expected.amountCents && p.credits===expected.credits &&
   !TEST_CREDIT_PACKS.some(x=>x.priceId===p.priceId) && packEconomics(p).safe;
 });
}
