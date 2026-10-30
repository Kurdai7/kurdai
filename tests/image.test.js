import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeImageRequest,quotaWindow} from '../image.js';

test('image prompts are required and bounded',()=>{
 assert.deepEqual(normalizeImageRequest({prompt:'  a Kurdish mountain village  '}),{prompt:'a Kurdish mountain village'});
 assert.throws(()=>normalizeImageRequest({prompt:''}),/وەسفی/);
 assert.throws(()=>normalizeImageRequest({prompt:'x'.repeat(1201)}),/١٢٠٠/);
 assert.throws(()=>normalizeImageRequest([]),/دروست/);
});

test('free image quota resets after five hours from first use',()=>{
 const now=200000;
 assert.deepEqual(quotaWindow(now,now-17999,2),{startedAt:now-17999,used:2});
 assert.deepEqual(quotaWindow(now,now-18000,2),{startedAt:now,used:0});
 assert.deepEqual(quotaWindow(now,undefined,0),{startedAt:now,used:0});
});
