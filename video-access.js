// Public access requires the separately enabled purchased-credit path.
export function paidVideoPublicAccess(env) {
 return env.PUBLIC_VIDEO_ENABLED==='true' && env.PUBLIC_RELEASE_VERIFIED==='true' &&
  env.VIDEO_PURCHASED_CREDITS_ENABLED==='true' && env.STRIPE_MODE==='live';
}
export function canUseVideoWorkflow(env,user) {
 if(!user?.verified)return false;
 const owner=!!env.VIDEO_TEST_EMAIL&&typeof user.email==='string'&&user.email.trim().toLowerCase()===env.VIDEO_TEST_EMAIL.trim().toLowerCase();
 return owner||paidVideoPublicAccess(env);
}
