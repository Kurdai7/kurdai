// Public access requires the separately enabled purchased-credit path.
export function paidVideoPublicAccess(env) {
 return env.PUBLIC_VIDEO_ENABLED==='true' && env.PUBLIC_RELEASE_VERIFIED==='true' &&
  env.VIDEO_PURCHASED_CREDITS_ENABLED==='true' && env.STRIPE_MODE==='live';
}
// Server configuration, never a role supplied by the browser.
export function isVideoAdmin(env,user) {
 const email=env.VIDEO_ADMIN_EMAIL || env.VIDEO_TEST_EMAIL;
 return !!user?.verified && typeof email==='string' && !!email.trim() &&
  typeof user.email==='string' && user.email.trim().toLowerCase()===email.trim().toLowerCase();
}
export function canUseVideoWorkflow(env,user) {
 if(!user?.verified)return false;
 const owner=!!env.VIDEO_TEST_EMAIL&&typeof user.email==='string'&&user.email.trim().toLowerCase()===env.VIDEO_TEST_EMAIL.trim().toLowerCase();
 return isVideoAdmin(env,user)||owner||paidVideoPublicAccess(env);
}

