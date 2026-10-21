// Preparation only. No bank calls, payment creation or credit writes are enabled.
// Keep this boundary closed until the bank approves the merchant integration.
export function fibCapabilities() {
  return {provider:'fib',currency:'IQD',enabled:false,stage:'preparation',
    checkoutImplemented:false,fulfillmentImplemented:false,
    blockers:['merchant_approval','bank_credentials','approved_iqd_catalogue','sandbox_end_to_end_verification'],
    creditsGranted:false};
}

export function handleFib(request) {
  const url=new URL(request.url);
  const headers={'Cache-Control':'no-store'};
  if(url.pathname==='/api/fib/capabilities' && request.method==='GET')
    return Response.json(fibCapabilities(),{headers});
  // A callback's id/status is not payment evidence. Never acknowledge fulfillment
  // or touch the shared credit ledger from an unverified bank callback.
  return Response.json({error:'FIB payments are not available yet. No payment or credits were created.'},
    {status:503,headers});
}
