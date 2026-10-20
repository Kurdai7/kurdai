import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canUseVideoWorkflow} from '../video-access.js';
const live={PUBLIC_VIDEO_ENABLED:'true',PUBLIC_RELEASE_VERIFIED:'true',VIDEO_PURCHASED_CREDITS_ENABLED:'true',STRIPE_MODE:'live'};
test('public workflow requires verified users and all live credit gates; owner access is preserved',()=>{
 assert.equal(canUseVideoWorkflow(live,{verified:true,email:'user@example.com'}),true);
 for(const patch of [{PUBLIC_VIDEO_ENABLED:'false'},{PUBLIC_RELEASE_VERIFIED:'false'},{VIDEO_PURCHASED_CREDITS_ENABLED:'false'},{STRIPE_MODE:'test'}])assert.equal(canUseVideoWorkflow({...live,...patch},{verified:true,email:'user@example.com'}),false);
 assert.equal(canUseVideoWorkflow(live,{verified:false}),false);assert.equal(canUseVideoWorkflow(live,null),false);
 assert.equal(canUseVideoWorkflow({VIDEO_TEST_EMAIL:'owner@example.com'},{verified:true,email:' Owner@example.com '}),true);
});
