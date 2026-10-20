import test from 'node:test';
import assert from 'node:assert/strict';
import {PREPARED_PACKS,TEST_CREDIT_PACKS,PACK_RESERVES,packEconomics,preparedLiveEconomics} from '../billing-packs.js';
test('EUR1 has 30 credits and EUR5 has 280 credits; both retain conservative cost reserves',()=>{
 assert.deepEqual(PREPARED_PACKS.map(p=>[p.amountCents,p.credits]),[[100,30],[500,280]]);
 for(const pack of PREPARED_PACKS) {
  const q=packEconomics(pack);assert.equal(q.safe,true);assert.ok(q.remainderEUR>0);
  assert.equal(q.maximumServiceCostEUR,pack.credits/100);
  assert.ok(q.maximumServiceCostEUR+q.feeReserveEUR+q.salesTaxReserveEUR+q.operationsReserveEUR<=q.grossEUR);
 }
 assert.ok(PREPARED_PACKS[1].credits/5>PREPARED_PACKS[0].credits);
});
test('pack guard rejects overissued credits, lower cost rate and malformed fee assumptions',()=>{
 for(const p of PREPARED_PACKS) {
  assert.equal(packEconomics({...p,credits:p.amountCents}).safe,false);
  assert.equal(packEconomics(p,1).safe,false);
 }
 for(const invalid of [null,{}, {feeBps:NaN}, {...PACK_RESERVES,feeBps:-1}, {...PACK_RESERVES,salesTaxBps:Infinity}])
  assert.equal(packEconomics(PREPARED_PACKS[0],100,invalid).safe,false);
});
test('live needs reviewed economics and cannot use test prices or altered packs',()=>{
 const packs=TEST_CREDIT_PACKS.map((p,i)=>({...p,priceId:'price_livePrepared'+i}));
 const env={STRIPE_PACK_ECONOMICS_VERIFIED:'true',VIDEO_CREDITS_PER_EUR:'100'};
 assert.equal(preparedLiveEconomics(env,packs),true);
 assert.equal(preparedLiveEconomics({},packs),false);
 assert.equal(preparedLiveEconomics(env,TEST_CREDIT_PACKS),false);
 assert.equal(preparedLiveEconomics({...env,VIDEO_CREDITS_PER_EUR:'50'},packs),false);
 assert.equal(preparedLiveEconomics(env,[...packs,{...packs[0]}]),false);
 assert.equal(preparedLiveEconomics(env,packs.map(p=>({...p,credits:p.credits+1}))),false);
});
