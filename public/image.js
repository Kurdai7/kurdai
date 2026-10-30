const $=id=>document.getElementById(id);
const tokenKey='kurdai_session_token';
const token=()=>localStorage.getItem(tokenKey);
let enabled=false,busy=false;
function setMessage(s){$('message').textContent=s||'';}
function formatReset(seconds){return new Date(seconds*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});}
async function api(path,options={}){
 const headers={'Content-Type':'application/json',...options.headers};
 if(token())headers.Authorization='Bearer '+token();
 const response=await fetch(path,{...options,headers});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.error||'داواکاری سەرکەوتوو نەبوو.'),{status:response.status,data});
 return data;
}
async function refresh(){
 enabled=false;$('generate').disabled=true;
 if(!token()){$('quota').textContent='بۆ وەرگرتنی ٢ وێنەی بەخۆڕایی، تکایە لە سەرەتا بچۆ ژوورەوە.';return;}
 try{
  const q=await api('/api/image');
  enabled=q.enabled===true;
  $('quota').textContent=q.enabled
   ? '٢ وێنەی بەخۆڕایی هەیە بۆ هەر ٥ کاتژمێر. ماوە: '+q.remaining+' وێنە.'+(q.remaining<2?' · نوێبوونەوە: '+formatReset(q.resetsAt):'')
   : 'Image Generator هێشتا لەلایەن بەڕێوەبەرەوە چالاک نەکراوە. هیچ خەرجییەک ناکرێت.';
  $('generate').disabled=!enabled;
 }catch(e){$('quota').textContent=e.status===401?'تکایە بچۆ ژوورەوە و ئیمەیڵەکەت پشتڕاست بکەرەوە.':e.message;}
}
$('generate').addEventListener('click',async()=>{
 if(busy||!enabled)return;
 const prompt=$('prompt').value.trim();
 if(!prompt){setMessage('تکایە وەسفی وێنەکە بنووسە.');return;}
 busy=true;$('generate').disabled=true;$('generate').textContent='وێنەکە دروست دەکرێت...';setMessage('');
 try{
  const data=await api('/api/image',{method:'POST',body:JSON.stringify({prompt})});
  $('preview').replaceChildren();const img=document.createElement('img');img.alt='KurdAI generated image';img.src=data.image;$('preview').append(img);
  $('download').href=data.image;$('download').hidden=false;
  $('quota').textContent='وێنەکە دروست کرا. وێنەی بەخۆڕایی ماوە: '+data.remaining+'.';
 }catch(e){
  setMessage(e.message);
  if(e.data?.resetsAt)$('quota').textContent='دوو وێنەی بەخۆڕایی بەکارهاتوون. کاتی نوێبوونەوە: '+formatReset(e.data.resetsAt)+'. کرێدیتی وێنە هێشتا چالاک نییە.';
 }finally{busy=false;$('generate').textContent='دروستکردنی وێنە';await refresh();}
});
$('new').addEventListener('click',()=>{$('preview').innerHTML='<div class="empty">وێنەکەت لێرە پیشان دەدرێت</div>';$('download').hidden=true;setMessage('');});
refresh();
