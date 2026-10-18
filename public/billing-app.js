// The server verifies payments; return URLs never grant credits or submit a purchase.
(() => {
 const $=id=>document.getElementById(id),panel=$('billingPanel');
 const token=()=>localStorage.getItem('kurdai_session_token');
 const ku=(ckb,en)=>document.documentElement.lang==='en'?en:ckb;
 let epoch=0,context=null,busy=false;
 const pendingKey='kurdai_billing_order';
 const returned=new URL(location.href).searchParams.get('order');
 let returnedOrder=/^[a-f0-9-]{36}$/.test(returned || '')?returned:null;
 function pending(){try{return JSON.parse(sessionStorage.getItem(pendingKey));}catch{return null;}}
 function active(c){return c && c.epoch===epoch && token()===c.token;}
 async function api(path,c,options={}) {
  const response=await fetch('/api/billing/'+path,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},signal:AbortSignal.timeout(20000)});
  const data=await response.json();if(!response.ok)throw Error('Billing request failed');return data;
 }
 function buttons(){for(const b of $('billingPacks').querySelectorAll('button'))b.disabled=busy;}
 function render(c) {
  $('billingTitle').textContent=ku('کرییدیتی کڕدراو','Purchased credits');
  $('billingRefresh').textContent=ku('پشکنینی دۆخی پارەدان','Check payment status');
  $('billingBalance').textContent=ku(`کرییدیتی کڕدراو: ${c.credits} — جیاوازە لە کرییدیتی ڕۆژانە.`,`Purchased credits: ${c.credits} — separate from daily credits.`);
  $('billingPacks').replaceChildren();
  if(c.mode==='test')$('billingBalance').textContent=ku('تاقیکردنەوە — پارەی ڕاستەقینە نییە. ','Test mode — no real money. ')+$('billingBalance').textContent;
  if(c.enabled)for(const p of c.packs){
   const button=document.createElement('button');button.type='button';button.className='chip';
   const price=new Intl.NumberFormat(document.documentElement.lang==='en'?'en-FI':'ckb',{style:'currency',currency:'EUR'}).format(p.amountCents/100);
   button.textContent=ku(`${p.credits} کرییدیت — ${price}`,`${p.credits} credits — ${price}`);
   button.addEventListener('click',()=>checkout(c,p));$('billingPacks').append(button);
  }
  buttons();
 }
 async function refresh() {
  const c={epoch:++epoch,token:token()};context=null;busy=false;panel.hidden=true;
  $('billingPacks').replaceChildren();$('billingBalance').textContent='';$('billingMessage').textContent='';
  if(!c.token)return;
  try{
   Object.assign(c,await api('capabilities',c));
   if(!active(c) || !c.configured || !c.accountId)return;
   const balance=await api('balance',c);if(!active(c))return;
   c.credits=balance.credits;context=c;render(c);panel.hidden=false;
   if(!c.enabled)$('billingMessage').textContent=ku('کڕینی کرییدیت ئێستا بەردەست نییە.','Credit purchases are currently unavailable.');
   const saved=pending();
   const own=saved?.accountId===c.accountId && saved?.mode===c.mode;
   if(returnedOrder || (own && saved.orderId)) {
    const order=await api('order?id='+encodeURIComponent(returnedOrder || saved.orderId),c);if(!active(c))return;
    if(order.status==='paid') {
     const settled=await api('balance',c);if(!active(c))return;
     c.credits=settled.credits;render(c);
    }
    $('billingMessage').textContent=order.status==='paid'?ku('پارەدان پشتڕاست کرایەوە.','Payment verified.'):
      order.status==='expired'?ku('کاتی پارەدانەکە بەسەرچووە.','Checkout expired.'):
      ku('پارەدان هێشتا پشتڕاست نەکراوەتەوە؛ دواتر دۆخەکە بپشکنە.','Payment is not verified yet; check its status again later.');
    if(own && saved.orderId===order.id && ['paid','expired'].includes(order.status))sessionStorage.removeItem(pendingKey);
    if(order.id===returnedOrder && ['paid','expired'].includes(order.status)) {
     returnedOrder=null;
     const clean=new URL(location.href);clean.searchParams.delete('order');clean.searchParams.delete('checkout');
     history.replaceState(history.state,'',clean.href);
    }
   }
  }catch{if(active(c) && !panel.hidden)$('billingMessage').textContent=ku('پشکنین سەرکەوتوو نەبوو؛ پێش پارەدانێکی تر دۆخی پێشوو بپشکنە.','Status check failed; check the existing order before another payment.');}
 }
 async function checkout(c,pack){
  if(!active(c) || !c.enabled || busy)return;
  const saved=pending();
  if(saved?.accountId===c.accountId && saved.mode===c.mode && saved.packId!==pack.id){
   $('billingMessage').textContent=ku('سەرەتا پارەدانی پێشوو تەواو بکە یان دۆخەکەی بپشکنە.','Finish or check your existing checkout first.');return;
  }
  const order=saved?.accountId===c.accountId && saved.mode===c.mode?saved:
    {accountId:c.accountId,mode:c.mode,packId:pack.id,requestId:crypto.randomUUID()};
  busy=true;buttons();
  try{
   sessionStorage.setItem(pendingKey,JSON.stringify(order));
   const result=await api('checkout',c,{method:'POST',body:JSON.stringify({requestId:order.requestId,packId:order.packId})});
   if(!active(c))return;
   order.orderId=result.orderId;sessionStorage.setItem(pendingKey,JSON.stringify(order));
   const url=new URL(result.url);
   if(url.protocol!=='https:' || url.hostname!=='checkout.stripe.com' || url.username || url.password)throw Error('Invalid checkout destination');
   location.assign(url.href);
  }catch{if(active(c))$('billingMessage').textContent=ku('پارەدان تەواو نەبوو. بۆ بەردەوامبوون هەمان پاکێج هەڵبژێرە؛ داواکاریی نوێ دروست ناکرێت.','Checkout did not finish. Select the same pack to resume the same order.');}
  finally{if(active(c)){busy=false;buttons();}}
 }
 document.addEventListener('kurdai-account-change',refresh);
 document.addEventListener('kurdai-balance-change',refresh);
 window.addEventListener('storage',event=>{if(event.key==='kurdai_session_token')refresh();});
 $('billingRefresh').addEventListener('click',()=>{if(!busy)refresh();});
 $('languageToggle').addEventListener('click',()=>{if(context && active(context))render(context);});
 refresh();
})();
