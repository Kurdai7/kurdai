import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('email readiness names missing bindings without sending mail or exposing secret values',async t=>{
 const bundle=await build({entryPoints:['worker.js'],bundle:true,write:false,format:'esm',platform:'browser'});
 const schema=await readFile('schema.sql','utf8');
 for(const bindings of [{},{EMAIL_API_KEY:'synthetic-private-key'},{EMAIL_FROM:'private-sender@example.test'},
  {EMAIL_API_KEY:'synthetic-private-key',EMAIL_FROM:'private-sender@example.test'}]) {
  let outbound=0;
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-25',
   d1Databases:['DB'],bindings,outboundService:()=>{outbound++;throw Error('No network permitted');}}));
  try {
   const db=await mf.getD1Database('DB');
   for(const sql of schema.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
   const result=await(await mf.dispatchFetch('https://kurdai.test/api/health')).json();
   const missing=['EMAIL_API_KEY','EMAIL_FROM'].filter(k=>!bindings[k]);
   assert.equal(result.version,'public-readiness-v5');
   assert.deepEqual(result.missingEmailConfiguration,missing);
   assert.equal(result.registrationConfigured,missing.length===0);
   assert.equal(result.emailDeliveryVerified,false);assert.equal(outbound,0);
   assert.doesNotMatch(JSON.stringify(result),/synthetic-private-key|private-sender/);
  } finally {await mf.dispose();}
 }
});
