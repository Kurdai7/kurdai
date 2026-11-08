// Public access requires the separately enabled purchased-credit path.
export function paidVideoPublicAccess(env) {
 return env.PUBLIC_VIDEO_ENABLED==='true' && env.PUBLIC_RELEASE_VERIFIED==='true' &&
  env.VIDEO_PURCHASED_CREDITS_ENABLED==='true' && env.STRIPE_MODE==='live';
}
// Admin access is granted only by the dedicated server-side VIDEO_ADMIN_EMAIL secret.
export function isVideoAdmin(env,user) {
 const email=env.VIDEO_ADMIN_EMAIL;
 return !!user?.verified && typeof email==='string' && !!email.trim() &&
  typeof user.email==='string' && user.email.trim().toLowerCase()===email.trim().toLowerCase();
}
export function canUseVideoWorkflow(env,user) {
 if(!user?.verified)return false;
 // The legacy test email may use the customer workflow, but never grants admin powers.
 const testOwner=typeof env.VIDEO_TEST_EMAIL==='string' && !!env.VIDEO_TEST_EMAIL.trim() &&
  typeof user.email==='string' && user.email.trim().toLowerCase()===env.VIDEO_TEST_EMAIL.trim().toLowerCase();
 return isVideoAdmin(env,user)||testOwner||paidVideoPublicAccess(env);
}
