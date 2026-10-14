import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';

test('actual Workers runtime proxies readiness and blocks credential-bearing redirects', async t=>{
  const bundle=await build({stdin:{contents:`import {handleLong} from './long-video.js';export default {fetch(request){return handleLong(request,{VIDEO_TEST_EMAIL:'owner@example.test',LONG_VIDEO_SERVICE_URL:'https://processor.test',LONG_VIDEO_SERVICE_SECRET:'dummy-test-credential-at-least-32-characters'},{id:'owner',email:'owner@example.test',verified:true});}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
  let redirect=false,calls=0;
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,
    // The installed local workerd binary supports dates through 2026-09-25.
    // Production compatibility remains unchanged in wrangler.toml.
    compatibilityDate:'2026-09-25',outboundService:request=>{
      calls++;assert.equal(new URL(request.url).origin,'https://processor.test');
      assert.equal(request.headers.get('authorization'),'Bearer dummy-test-credential-at-least-32-characters');
      return redirect?new Response(null,{status:302,headers:{Location:'https://untrusted.test'}}):Response.json({processorReachable:true});
    }}));
  t.after(()=>mf.dispose());
  const first=await mf.dispatchFetch('https://kurdai.test/api/long/capabilities');
  assert.equal(first.status,200);assert.equal((await first.json()).processorReachable,true);assert.equal(calls,1);
  redirect=true;
  const blocked=await mf.dispatchFetch('https://kurdai.test/api/long/capabilities');
  assert.equal(blocked.status,502);assert.equal((await blocked.json()).code,'PROCESSOR_REDIRECT_BLOCKED');assert.equal(calls,2);
});
