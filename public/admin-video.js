const $=id=>document.getElementById(id),tokenKey='kurdai_session_token';let quoteData=null;
const token=()=>localStorage.getItem(tokenKey);
async function api(path,options={}){const t=token();if(!t)throw new Error('تکایە سەرەتا بچۆ ژوورەوە.');const r=await fetch(path,{...options,headers:{Authorization:'Bearer '+t,'Content-Type':'application/json',...(options.headers||{})},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d;}
async function check(){
 try{
  await api('/api/admin/overview');
  $('studio').hidden=false;
  try{
   const d=await api('/api/admin/video/capabilities');
   $('access').textContent=d.processorReachable
    ?'دەستگەیشتنی ئەدمین پشتڕاست کراوەتەوە؛ پڕۆسێسەر ئامادەیە. هێشتا دروستکردنی پارەدار بە پشکنینی خەرجی دەبەسترێتەوە.'
    :'دەستگەیشتنی ئەدمین پشتڕاست کراوەتەوە؛ پڕۆسێسەر پەیوەستە بەڵام دروستکردنی پارەدار هێشتا داخراوە.';
  }catch{$('access').textContent='دەستگەیشتنی ئەدمین پشتڕاست کراوەتەوە؛ پشکنینی پڕۆسێسەر ئێستا بەردەست نییە.';}
 }catch(e){$('studio').hidden=true;$('access').textContent=e.message;}
}
function input(){return {model:'p-video-2',mode:'new',prompt:$('prompt').value.trim(),identity:$('identity').value.trim(),dialogueText:$('dialogue').value.trim(),language:'sorani',duration:Number($('duration').value),resolution:'704p',aspectRatio:$('ratio').value};}
$('quote').addEventListener('click',async()=>{
 const b=$('quote');b.disabled=true;$('start').disabled=true;$('quoteBox').hidden=true;quoteData=null;
 try{
  const q=await api('/api/admin/video/quote',{method:'POST',body:JSON.stringify(input())});quoteData=q;$('quoteBox').hidden=false;
  $('price').textContent=q.totalEUR==null?(q.planningEstimate?'€'+q.planningEstimate.totalEUR.toFixed(2)+' (تەنها هەڵسەنگاندن)':'نرخ دیاری نەکراوە'):'€'+q.totalEUR.toFixed(4);
  $('details').textContent='مۆدێل: P-Video 2 · '+q.outputSeconds+' چرکە · خەرجی API: '+(q.apiUSD==null?'—':'$'+q.apiUSD.toFixed(4))+' · native resolution: '+q.nativeResolution+' · نرخی هەر چرکەی دەرچوو: $0.015';
  $('blockers').textContent=(q.blockedReasons||[]).join(' ');
  $('start').disabled=!q.canStart;$('approve').checked=false;
  if(q.canStart)$('start').disabled=true;
 }catch(e){$('access').textContent=e.message;}
 finally{b.disabled=false;}
});
$('approve').addEventListener('change',()=>{$('start').disabled=!(quoteData?.canStart&&$('approve').checked);});
$('start').addEventListener('click',async()=>{
 if(!quoteData?.canStart||!$('approve').checked)return;
 if(!window.confirm('ئەم خەرجییە قبوڵ دەکەیت؟ تەنها کاتێک دەست پێ دەکات کە هەموو سنوور و نرخەکان پشتڕاست کرابنەوە.'))return;
 const b=$('start');b.disabled=true;
 try{
  const d=await api('/api/admin/video/start',{method:'POST',body:JSON.stringify({id:quoteData.id,approved:true,approvedTotalEUR:quoteData.totalEUR})});
  $('access').textContent='داواکاری تۆمارکرا: '+d.status+' · ID: '+d.id+' · ئەم داواکارییە تەنها لە ڕێگەی ئەدمینەوە بەڕێوە دەچێت.';
 }catch(e){$('access').textContent=e.message;}
});
for(const id of ['prompt','identity','dialogue','duration','ratio'])$(id).addEventListener('input',()=>{quoteData=null;$('start').disabled=true;$('quoteBox').hidden=true;});
check();