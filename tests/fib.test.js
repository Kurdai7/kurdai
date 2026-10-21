import test from 'node:test';
import assert from 'node:assert/strict';
import {handleFib} from '../fib.js';

test('FIB remains unavailable even when deployment flags or callback claims say paid',async()=>{
 const cap=await handleFib(new Request('https://kurdai.net/api/fib/capabilities')).json();
 assert.equal(cap.enabled,false);
 assert.equal(cap.currency,'IQD');
 for(const path of ['checkout','callback']) {
  const response=handleFib(new Request('https://kurdai.net/api/fib/'+path,{method:'POST',
   body:JSON.stringify({id:'forged',status:'PAID',credits:1000000})}),
   {FIB_ENABLED:'true',DB:{prepare(){throw Error('Must not access credits');}}});
  assert.equal(response.status,503);
  assert.equal(response.headers.get('cache-control'),'no-store');
 }
});
