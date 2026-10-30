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


test('translation mode detects source and returns only the selected target language',()=>{
 const input=normalizeChatRequest({message:'Hello, how are you?',mode:'translate',targetLanguage:'sorani',history:[{role:'assistant',content:'ignored'}]});
 assert.equal(input.mode,'translate');
 assert.equal(input.targetLanguage,'sorani');
 assert.deepEqual(input.history,[]);
 const messages=buildChatMessages(input);
 assert.match(messages[0].content,/Detect the source language automatically/);
 assert.match(messages[0].content,/Sorani Kurdish/);
 assert.match(messages[0].content,/Return only the translated text/);
});

test('translation supports other languages to Kurdish Badini and Kurdish to Finnish',()=>{
 const badini=normalizeChatRequest({message:'Good morning',mode:'translate',targetLanguage:'badini'});
 assert.match(buildChatMessages(badini)[0].content,/Badini Kurdish/);
 const finnish=normalizeChatRequest({message:'بەیانی باش',mode:'translate',targetLanguage:'finnish'});
 assert.match(buildChatMessages(finnish)[0].content,/Finnish/);
});

test('translation mode ignores conversation history and falls back to Sorani target',()=>{
 const input=normalizeChatRequest({message:'text',mode:'translate',targetLanguage:'auto',history:[{role:'user',content:'old'}]});
 assert.equal(input.targetLanguage,'sorani');
 assert.deepEqual(input.history,[]);
});
