const $=id=>document.getElementById(id);
const messages=$('messages'),form=$('chatForm'),prompt=$('prompt'),send=$('send'),status=$('status'),language=$('language');
let history=[],busy=false;
const copy={ckb:{send:'ناردن ↑',placeholder:'پرسیارەکەت لێرە بنووسە...',wait:'KurdAI وەڵام ئامادە دەکات...',fail:'نەتوانرا وەڵام وەربگیرێت.'},en:{send:'Send ↑',placeholder:'Write your question here...',wait:'KurdAI is thinking...',fail:'Could not get a reply.'}};
function setLanguage(value){const en=value==='english';document.documentElement.lang=en?'en':'ckb';document.documentElement.dir=en?'ltr':'rtl';send.textContent=en?copy.en.send:copy.ckb.send;prompt.placeholder=en?copy.en.placeholder:copy.ckb.placeholder;$('clear').textContent=en?'New chat':'چاتی نوێ';}
language.addEventListener('change',()=>setLanguage(language.value));
function addBubble(role,text){const box=document.createElement('article');box.className='bubble '+role;const name=document.createElement('strong');name.textContent=role==='user'?'تۆ':'KurdAI';const p=document.createElement('p');p.textContent=text;box.append(name,p);messages.append(box);messages.scrollTop=messages.scrollHeight;return box;}
function newChat(){history=[];messages.replaceChildren();addBubble('assistant','سڵاو! چۆن دەتوانم یارمەتیت بدەم؟');status.textContent='';}
$('clear').addEventListener('click',newChat);
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;const message=prompt.value.trim();if(!message)return;
 busy=true;send.disabled=true;status.textContent=language.value==='english'?copy.en.wait:copy.ckb.wait;addBubble('user',message);prompt.value='';
 const pending=addBubble('assistant','…');
 try{
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,language:language.value,history})});
  const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Chat unavailable');
  pending.querySelector('p').textContent=data.answer;history.push({role:'user',content:message},{role:'assistant',content:data.answer});history=history.slice(-8);status.textContent=language.value==='english'?data.remainingToday+' free replies left today.':data.remainingToday+' وەڵامی خۆڕایی ماوە بۆ ئەمڕۆ.';
 }catch(error){pending.remove();status.textContent=error.message||copy.ckb.fail;addBubble('assistant',error.message||copy.ckb.fail);}
 finally{busy=false;send.disabled=false;prompt.focus();messages.scrollTop=messages.scrollHeight;}
});
setLanguage(language.value);
