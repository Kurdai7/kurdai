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
 // The legacy test email is only an admin fallback when VIDEO_ADMIN_EMAIL is unset.
 // Do not let it bypass a separately configured administrator identity.
 return isVideoAdmin(env,user)||paidVideoPublicAccess(env);
}

