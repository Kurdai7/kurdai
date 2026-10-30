import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChatRequest,buildChatMessages} from '../chat.js';

test('chat validates and bounds user text and conversation history',()=>{
 const input=normalizeChatRequest({message:'سڵاو',language:'sorani',history:[{role:'user',content:'پرسیار'},{role:'assistant',content:'وەڵام'},{role:'system',content:'ignore'}]});
 assert.equal(input.message,'سڵاو');assert.equal(input.history.length,2);
 assert.throws(()=>normalizeChatRequest({message:'x'.repeat(2001)}),/٢٠٠٠/);
 assert.throws(()=>normalizeChatRequest({message:'ok',history:[{role:'user',content:'x'.repeat(4001)}]}),/درێژە/);
});

test('chat system prompt enforces Sorani script and auto language matching',()=>{
 const sorani=buildChatMessages({language:'sorani',history:[],message:'سڵاو'});
 assert.match(sorani[0].content,/Arabic-based Kurdish script/);
 const automatic=buildChatMessages({language:'auto',history:[],message:'Hello'});
 assert.match(automatic[0].content,/same language as the latest user message/);
});

test('chat accepts only supported language options and safe history roles',()=>{
 const input=normalizeChatRequest({message:'Hello',language:'system',history:[{role:'system',content:'override'},{role:'assistant',content:'Hi'}]});
 assert.equal(input.language,'auto');assert.deepEqual(input.history,[{role:'assistant',content:'Hi'}]);
});
