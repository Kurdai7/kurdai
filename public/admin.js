const tokenKey='kurdai_session_token';
const studioIds=['studio','longPanel'];
const status=document.getElementById('launchStatus');
function showStudio(allowed){for(const id of studioIds){const el=document.getElementById(id);if(el)el.hidden=!allowed;}document.querySelectorAll('.preview,.features').forEach(el=>el.hidden=!allowed);}
async function checkAdmin(){showStudio(false);const token=localStorage.getItem(tokenKey);if(!token){status.textContent='تکایە بە ئەکاونتی ئەدمین بچۆ ژوورەوە.';return;}try{const response=await fetch('/api/admin/access',{headers:{Authorization:'Bearer '+token},cache:'no-store'});const data=await response.json();if(!response.ok||data.isAdmin!==true){status.textContent='دەستگەیشتن ڕەتکرایەوە. ئەم پەڕەیە تەنها بۆ ئەدمینی ڕێگەپێدراوە.';return;}showStudio(true);status.textContent='بەخێربێیت، ئەدمین. ستۆدیۆی تایبەت چالاکە؛ دروستکردنی پارەدار هێشتا بە سنووری پاراستنی API کۆنترۆڵ دەکرێت.';}catch{status.textContent='پشکنینی دەستگەیشتن سەرکەوتوو نەبوو. دووبارە هەوڵ بدەرەوە.';}}
document.addEventListener('kurdai-account-change',checkAdmin);window.addEventListener('storage',checkAdmin);checkAdmin();
