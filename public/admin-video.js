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
function readReferenceImage(){
 const file=$('referenceImage').files?.[0];
 if(!file)return Promise.resolve(null);
 if(!['image/png','image/jpeg'].includes(file.type))return Promise.reject(new Error('تەنها PNG یان JPEG قبوڵ دەکرێت.'));
 if(file.size>4*1024*1024)return Promise.reject(new Error('قەبارەی وێنە نابێت لە 4MB زیاتر بێت.'));
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result));
  reader.onerror=()=>reject(new Error('خوێندنەوەی وێنەکە سەرکەوتوو نەبوو.'));
  reader.readAsDataURL(file);
 });
}
async function input(){return {model:'p-video-2',mode:'new',prompt:$('prompt').value.trim(),identity:$('identity').value.trim(),dialogueText:$('dialogue').value.trim(),language:'sorani',duration:Number($('duration').value),resolution:'704p',aspectRatio:$('ratio').value,image:await readReferenceImage()};}
$('referenceImage').addEventListener('change',()=>{
 const file=$('referenceImage').files?.[0],preview=$('referencePreview');
 if(!file){preview.hidden=true;preview.removeAttribute('src');$('referenceHint').textContent='وێنەی کارەکتەر یان دیمەن باربکە بۆ پاراستنی شێوە و ناسنامەی وێنەکە.';return;}
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>4*1024*1024){$('referenceHint').textContent='هەڵە: تەنها PNG/JPEG تا 4MB.';preview.hidden=true;return;}
 preview.src=URL.createObjectURL(file);preview.hidden=false;$('referenceHint').textContent='وێنەکە ئامادەیە؛ لە هەژمارکردنی نرخدا بەکاردێت.';
 quoteData=null;$('start').disabled=true;$('quoteBox').hidden=true;
});
$('quote').addEventListener('click',async()=>{
 const b=$('quote');b.disabled=true;b.textContent='چاوەڕێ بکە...';$('start').disabled=true;$('quoteBox').hidden=true;$('quoteError').hidden=true;$('quoteError').textContent='';quoteData=null;
 try{
  if(!$('prompt').value.trim())throw new Error('تکایە چیرۆک و کردار بنووسە.');
  if(!$('dialogue').value.trim())throw new Error('تکایە دیالۆگی کوردی بنووسە.');
  const payload=await input();const q=await api('/api/admin/video/quote',{method:'POST',body:JSON.stringify(payload)});quoteData=q;$('quoteBox').hidden=false;
  $('price').textContent=q.totalEUR==null?(q.planningEstimate?'€'+q.planningEstimate.totalEUR.toFixed(2)+' (تەنها هەڵسەنگاندن)':'نرخ دیاری نەکراوە'):'€'+q.totalEUR.toFixed(4);
  $('details').textContent='مۆدێل: P-Video 2 · '+q.outputSeconds+' چرکە · خەرجی API: '+(q.apiUSD==null?'—':'$'+q.apiUSD.toFixed(4))+' · native resolution: '+q.nativeResolution+' · نرخی هەر چرکەی دەرچوو: $0.015';
  $('blockers').textContent=(q.blockedReasons||[]).join(' ');
  $('start').disabled=!q.canStart;$('approve').checked=false;
  if(q.canStart)$('start').disabled=true;
 }catch(e){$('quoteError').textContent=e.message||'هەڵەیەک ڕوویدا؛ دووبارە هەوڵ بدەرەوە.';$('quoteError').hidden=false;}
 finally{b.disabled=false;b.textContent='هەژمارکردنی نرخ';}
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
for(const id of ['prompt','identity','dialogue','duration','ratio'])$(id).addEventListener('input',()=>{quoteData=null;$('start').disabled=true;$('quoteBox').hidden=true;$('quoteError').hidden=true;});
check();