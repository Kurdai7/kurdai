const $ = id => document.getElementById(id);
const tokenKey = 'kurdai_session_token';
const requestKey = 'kurdai_pending_request';
let selectedStyle = '3D Animation';
let jobs = [];
let currentJob = null;
let outputURL = null;
let firstFrame = null;
let busy = false;
let epoch = 0;
let previewURLs = [];
let generationAllowed=false;
const token = () => localStorage.getItem(tokenKey);
const ku = (sorani, english) => document.documentElement.lang === 'en' ? english : sorani;
function updateDialogueSupport() {
  const language = $('language').value;
  $('dialogueSupport').textContent = language === 'none' ? ku('بێ دیالۆگ داوا دەکرێت؛ TTS ـی جیاواز بەکار نایەت.', 'No dialogue is requested; no separate TTS is used.') :
    ku(`${language === 'badini' ? 'بادینی' : 'سۆرانی'} بە جیاوازی داوا دەکرێت؛ دەنگ و شێوەزار هێشتا بە ڤیدیۆی واقعی تاقی نەکراونەتەوە. دەنگ لە نرخی Veo دایە؛ TTS ـی جیاواز چالاک نییە.`,
      `${language === 'badini' ? 'Badini' : 'Sorani'} is requested separately. Actual speech and dialect accuracy are unverified. Native audio is included in Veo pricing; separate TTS is disabled.`);
}
$('language').addEventListener('change', updateDialogueSupport);
$('recommendSorani').addEventListener('click', () => {
  if (busy) return;
  if ($('longPanel').hidden) {
    $('dialectRecommendation').textContent=ku('بۆ Omni پێویستە ئەکاونتەکەت دەستگەیشتنی دروستکردنی ڤیدیۆی هەبێت. هیچ داواکارییەک نەنێردراوە.', 'Omni requires an account with video generation access. No request was sent.');
    return;
  }
  if ($('longMode').value==='extension') {
    $('dialectRecommendation').textContent=ku('لە Extension زمان و مۆدێلی ڤیدیۆی پێشوو دەپارێزرێن؛ بۆ سۆرانی ڤیدیۆی نوێ هەڵبژێرە.', 'Extension preserves the source dialect and model. Choose New Video for a new Sorani video.');
    return;
  }
  $('longModel').value='gemini-omni-1.1-flash';
  $('longModel').dispatchEvent(new Event('change'));
  $('longLanguage').value='sorani';$('longLanguage').dispatchEvent(new Event('input'));
  $('dialectRecommendation').textContent=ku('Omni بۆ سۆرانی هەڵبژێردرا. هیچ داواکارییەکی دروستکردن نەنێردراوە.', 'Omni selected for Sorani. No generation request was sent.');
  $('longModel').focus();
});
$('recommendBadini').addEventListener('click', () => {
  if (busy) return;
  if ($('videoMode').value==='extend' || $('referenceImages').files.length) {
    $('dialectRecommendation').textContent=ku('Veo Lite پشتگیری Reference Images یان Extension ناکات. وێنەکانت پارێزراون؛ ڤیدیۆی نوێ یان وێنەی سەرەتا هەڵبژێرە.', 'Veo Lite does not support reference images or extension. Your files are preserved; choose a new video or a first-frame image.');
    return;
  }
  $('model').value='veo-3.1-lite-generate-preview';$('language').value='badini';
  $('model').dispatchEvent(new Event('change'));$('language').dispatchEvent(new Event('input'));
  $('dialectRecommendation').textContent=ku('Veo 3.1 Lite بۆ بادینی هەڵبژێردرا. پشتگیری API هێشتا تاقی نەکراوەتەوە؛ هیچ داواکارییەک نەنێردراوە.', 'Veo 3.1 Lite selected for Badini. API speech remains unverified; no request was sent.');
  $('model').focus();
});

const errors = new Map([
  ['Too many attempts. Try again later.', 'هەوڵدانەوەکان زۆرن؛ دوای ١٥ خولەک دووبارە هەوڵ بدەرەوە.'],
  ['Email or password is incorrect.', 'ئیمەیڵ یان وشەی نهێنی هەڵەیە.'],
  ['Verify your email before logging in.', 'پێش چوونەژوورەوە ئیمەیڵەکەت پشتڕاست بکەرەوە.'],
  ['Registration is not available yet. Email verification is not configured.', 'تۆمارکردن هێشتا بەردەست نییە؛ خزمەتگوزاری پشتڕاستکردنەوەی ئیمەیڵ ڕێکنەخراوە.'],
  ['Veo Lite supports text and first-frame images, but not reference images or native extension.', 'Veo Lite تەنها دەق و وێنەی سەرەتا وەردەگرێت؛ بۆ Reference Images یان Extension مۆدێلی Fast یان Standard هەڵبژێرە.'],
  ['A current matching API cost quote and explicit approval are required. No paid request was sent.', 'نرخنامەی نوێ و ڕەزامەندی بۆ هەمان داواکاری پێویستە؛ هیچ داواکارییەکی پارەدار نەنێردراوە.'],
  ['Please log in.', 'تکایە سەرەتا بچۆ ژوورەوە.'],
  ['Verify your email first.', 'سەرەتا ئیمەیڵەکەت پشتڕاست بکەرەوە.'],
  ['Video generation is not configured or enabled.', 'بەشی ڤیدیۆ هێشتا لەلایەن بەڕێوەبەرەوە چالاک نەکراوە.'],
  ['Generation is currently available only to the configured test account.', 'ئێستا دروستکردنی ڤیدیۆ تەنها بۆ ئەکاونتی تاقیکردنەوەی ڕێکخراوە.'],
  ['Google quota or billing limit reached. Check the Google project quota and billing.', 'سنووری بەکارهێنان یان پارەدانی Google گەیشتووەتە کۆتایی؛ پڕۆژەی Google پێویستی بە پشکنین هەیە.'],
  ['Google API access was denied. Check the configured project access and billing.', 'Google ڕێگەی نەدا؛ دەستگەیشتن و پارەدانی پڕۆژەکە پێویستی بە پشکنین هەیە.'],
  ['Google safety or audio processing blocked this video. Review the prompt.', 'Google دروستکردنی ڤیدیۆکەی ڕاگرتووە؛ ناوەڕۆک یان دەنگی پرۆمپتەکە بپشکنە.']
]);
const readable = message => document.documentElement.lang === 'en' ? message : errors.get(message) || message;
function message(id, text, error = false) {
  const node = $(id); node.textContent = readable(text); node.classList.add('show');
  node.style.background = error ? '#fff0ef' : '#edf7ef'; node.style.color = error ? '#842b22' : '#20583a';
}
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status === 403 && !data.error) data.error = ku('دەستگەیشتن بە وێبسایت ڕەت کرایەوە (403)؛ ئەمە وەڵامی Google بۆ دروستکردنی ڤیدیۆ نییە.', 'Website access was denied (403); this is not a Google video-generation response.');
  const accountErrors = {
    ACCOUNT_ALREADY_EXISTS: ku('بەم ئیمەیڵە ئەکاونت هەیە؛ «چوونەژوورەوە» هەڵبژێرە.', 'An account already exists for this email. Sign in instead.'),
    REGISTRATION_EMAIL_FAILED: ku('ئیمەیڵی پشتڕاستکردنەوە نەنێردرا. پێویستە بەڕێوەبەری ماڵپەڕ پەیوەندی ئیمەیڵ چاک بکات.', 'Verification email could not be sent. The site operator must fix email delivery.'),
    REGISTRATION_DATABASE_FAILED: ku('پاشەکەوتکردنی ئەکاونت سەرکەوتوو نەبوو. پێویستە بەڕێوەبەری ماڵپەڕ داتابەیس چاک بکات.', 'Account storage is unavailable. The site operator must fix the database.')
  };
  if (!response.ok) throw Object.assign(new Error(accountErrors[data.code] || data.error || ku('پەیوەندی سەرکەوتوو نەبوو.', 'Request failed.')), { status: response.status, jobId: data.jobId });
  return data;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function clearOutput() {
  $('resultVideo').pause(); $('resultVideo').removeAttribute('src'); $('resultVideo').load();
  if (outputURL) URL.revokeObjectURL(outputURL);
  outputURL = null; currentJob = null;
  for (const id of ['resultVideo', 'downloadVideo', 'extendResult']) $(id).hidden = true;
  document.querySelector('.preview-screen').hidden = false;
}
function setBusy(value) { busy = value; $('generate').disabled = value || !generationAllowed || $('model').value==='p-video-2'; $('nativeQuote').disabled = value || !generationAllowed || $('model').value==='p-video-2'; }
function stateLabel(job) {
  return ({ ready: ku('ئامادەیە', 'Ready'), running: ku('دروست دەکرێت', 'Generating'),
    submitting: ku('دەنیردرێت', 'Submitting'), failed: ku('سەرکەوتوو نەبوو', 'Failed'),
    uncertain: ku('پێویستی بە پشکنینە', 'Needs review') })[job.status] || job.status;
}
async function refreshJobs() {
  if (!token()) return;
  const expected = token();
  const data = await api('/api/video-jobs');
  if (token() !== expected) return;
  jobs = data.jobs;
  const selectedSource = $('sourceJob').value;
  const selectedHistory = $('jobHistory').value;
  $('sourceJob').replaceChildren(new Option(ku('ڤیدیۆیەکی ئامادە هەڵبژێرە', 'Choose a ready video'), ''));
  $('jobHistory').replaceChildren(new Option(ku('داواکارییەک هەڵبژێرە', 'Choose a video request'), ''));
  for (const job of jobs) {
    const label = `${new Date(job.createdAt).toLocaleString()} · ${job.duration}s · ${job.aspectRatio} · ${stateLabel(job)}`;
    $('jobHistory').add(new Option(label, job.id));
    if (job.canExtend) $('sourceJob').add(new Option(label, job.id));
  }
  $('sourceJob').value = selectedSource; $('jobHistory').value = selectedHistory;
  const active = jobs.find(job => ['running', 'submitting', 'uncertain'].includes(job.status));
  $('resumeJob').hidden = !active;
  $('resumeJob').dataset.job = active?.id || '';
  $('generate').disabled = busy || !!active || !generationAllowed || $('model').value==='p-video-2';
  updateControls();
}
async function refreshAccount() {
  document.dispatchEvent(new Event('kurdai-account-change'));
  generationAllowed=false;setBusy(busy);$('longPanel').hidden=$('model').value!=='p-video-2';
  $('logoutBtn').hidden = !token();
  if (!token()) { $('creditStatus').textContent = ku('تکایە بچۆ ژوورەوە.', 'Please log in.'); return; }
  const expected = token();
  try {
    const data = await api('/api/me');
    if (token() !== expected) return;
    $('creditStatus').textContent = ku(`ئەکاونت: ${data.email} · کرێدیتی ئەمڕۆ: ${data.dailyCredits} (بۆ پارەدانی Google نییە)`, `Account: ${data.email} · Daily credits: ${data.dailyCredits} (not Google billing)`);
    const capability = await api('/api/video-capabilities');
    if (token() !== expected) return;
    generationAllowed=capability.configured===true && capability.accountAllowed===true && capability.accountVerified!==false;
    $('longPanel').hidden=$('model').value!=='p-video-2' && !((capability.longWorkflowAllowed===true || capability.accountAllowed===true) && capability.accountVerified!==false);
    setBusy(busy);
    if (!capability.configured && !capability.longWorkflowAllowed) message('toast', ku('بەشی ڤیدیۆ هێشتا ڕێکنەخراوە. هیچ داواکارییەکی بە پارە نەنێردراوە.', 'Video generation is not configured. No paid request was sent.') + (capability.missingConfiguration?.length ? ` (${capability.missingConfiguration.join(', ')})` : ''), true);
    else if (!capability.accountVerified && capability.accountVerified !== undefined) message('toast', 'Verify your email first.', true);
    else if (!capability.accountAllowed && !capability.longWorkflowAllowed) message('toast', 'Generation is currently available only to the configured test account.', true);
    await refreshJobs();
  } catch (error) {
    generationAllowed=false;setBusy(busy);$('longPanel').hidden=$('model').value!=='p-video-2';
    if(error.status===401){localStorage.removeItem(tokenKey);$('logoutBtn').hidden=true;}
    message('accountMessage', error.message, true);
  }
}
for (const action of ['register', 'login']) {
  $(`${action}Btn`).addEventListener('click', async () => {
    const email = $('accountEmail').value.trim(); const password = $('accountPassword').value;
    if (!$('accountEmail').checkValidity() || !email || password.length < (action === 'register' ? 12 : 1))
      return message('accountMessage', ku('ئیمەیڵێکی دروست و وشەی نهێنی بنووسە؛ بۆ ئەکاونتی نوێ لانیکەم ١٢ پیت.', 'Enter a valid email and password; new passwords need at least 12 characters.'), true);
    const button = $(`${action}Btn`); button.disabled = true;
    try {
      const data = await api(`/api/${action}`, { method: 'POST', body: JSON.stringify({ email, password }) });
      if (action === 'login') { epoch++; clearOutput(); localStorage.setItem(tokenKey, data.token); $('accountPassword').value = ''; await refreshAccount(); }
      message('accountMessage', action === 'login' ? ku('بە سەرکەوتوویی چوویتە ژوورەوە.', 'You are logged in.') : ku('ئیمەیڵەکەت بپشکنە بۆ پشتڕاستکردنەوە.', 'Check your email to verify your account.'));
    } catch (error) { message('accountMessage', error.message, true); }
    finally { button.disabled = false; }
  });
}
$('logoutBtn').addEventListener('click', async () => {
  const previousToken = token();
  epoch++; localStorage.removeItem(tokenKey); localStorage.removeItem(requestKey); jobs = []; setBusy(false); clearOutput();
  $('sourceJob').replaceChildren(new Option('—', '')); $('jobHistory').replaceChildren(new Option('—', '')); $('resumeJob').hidden = true;
  await refreshAccount();
  if (previousToken) fetch('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${previousToken}` } }).catch(() => {});
});

document.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-style]').forEach(item => item.classList.toggle('active', item === button));
  selectedStyle = button.dataset.style;
}));
function updateControls() {
  if ($('model').value==='p-video-2') {
    $('longPanel').hidden=false;
    if ($('longModel').value!=='p-video-2') { $('longModel').value='p-video-2'; $('longModel').dispatchEvent(new Event('change')); }
    $('generate').disabled=true; $('nativeQuote').disabled=true;
    $('dialogueSupport').textContent=ku('Pruna هەڵبژێردرا. ماوە، دیالۆگ و نرخ لە بەشی «دروستکردنی ڤیدیۆ بە دەنگ» لە خوارەوە ڕێکبخە. دروستکردن پێویستی بە چالاکبوونی ئەکاونت و ڕێکخستنی نرخ هەیە.', 'Pruna selected. Set duration, dialogue and quote in the native video section below. Generation requires account access and configured pricing.');
    return;
  }
  setBusy(busy);
  const mode = $('videoMode').value;
  $('sourceFields').hidden = mode !== 'extend'; $('frameFields').hidden = mode !== 'frame'; $('referenceFields').hidden = mode !== 'new';
  const parent = jobs.find(job => job.id === $('sourceJob').value);
  const extension = mode === 'extend';
  if (extension) {
    $('resolution').value = '720p';
    if (parent) { $('aspectRatio').value = parent.aspectRatio; $('model').value = parent.model;
      if (['sorani', 'badini', 'none'].includes(parent.language)) $('language').value = parent.language;
    }
  }
  const eight = extension || $('resolution').value === '1080p' || (mode === 'new' && $('referenceImages').files.length > 0);
  if (eight) $('duration').value = '8';
  $('duration').disabled = eight;
  $('resolution').disabled = extension; $('aspectRatio').disabled = extension; $('model').disabled = extension;
  $('language').disabled = extension && !!parent && ['sorani', 'badini', 'none'].includes(parent.language);
  updateDialogueSupport();
  $('previewDuration').textContent = extension && parent ? `${parent.duration} → ${parent.duration + 7}s` : `${$('duration').value}s`;
}
for (const id of ['videoMode', 'resolution', 'duration', 'sourceJob', 'aspectRatio', 'model']) $(id).addEventListener('change', updateControls);
async function imageData(file) {
  if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 4 * 1024 * 1024)
    throw new Error(ku('PNG یان JPEG هەڵبژێرە؛ تا ٤ MiB بۆ هەر وێنەیەک.', 'Use PNG or JPEG images, up to 4 MiB each.'));
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('Image read failed.')); reader.readAsDataURL(file);
  });
  return { mimeType: file.type, data };
}
function previews(files) {
  previewURLs.forEach(url => URL.revokeObjectURL(url)); previewURLs = []; $('imagePreviews').replaceChildren();
  for (const file of files) {
    const image = document.createElement('img'); image.alt = file.name || ku('دوا فڕەیم', 'Final frame');
    image.src = URL.createObjectURL(file); previewURLs.push(image.src); $('imagePreviews').append(image);
  }
}
$('referenceImages').addEventListener('change', () => {
  const files = [...$('referenceImages').files];
  if (files.length > 3 || files.some(file => file.size > 4 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(file.type))) {
    $('referenceImages').value = ''; previews([]); message('toast', ku('تا ٣ وێنەی PNG/JPEG هەڵبژێرە؛ هەریەک تا ٤ MiB.', 'Choose up to three PNG/JPEG images, 4 MiB each.'), true);
  } else previews(files);
  updateControls();
});
$('previousFrame').addEventListener('change', async () => {
  firstFrame = null;
  if (!$('previousFrame').files[0]) return;
  try { firstFrame = await imageData($('previousFrame').files[0]); previews([$ ('previousFrame').files[0]]); }
  catch (error) { $('previousFrame').value = ''; message('toast', error.message, true); }
});
$('captureFrame').addEventListener('click', async () => {
  const video = $('resultVideo');
  if (!outputURL || !Number.isFinite(video.duration)) return message('toast', ku('سەرەتا ڤیدیۆیەکی ئامادە پیشان بدە.', 'Load a completed video first.'), true);
  const button = $('captureFrame'); button.disabled = true;
  try {
    video.pause(); const target = Math.max(0, video.duration - 1 / 24);
    if (Math.abs(video.currentTime - target) > .001) await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('Could not seek the final frame.')); }, 10000);
      const done = () => { cleanup(); resolve(); };
      const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); };
      video.addEventListener('seeked', done); video.currentTime = target;
    });
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .95));
    firstFrame = await imageData(new File([blob], 'final-frame.jpg', { type: 'image/jpeg' }));
    $('previousFrame').value = ''; previews([blob]);
    message('toast', ku('دوا فڕەیم ئامادەیە بۆ دەستپێکردنی کلیپی نوێ.', 'The final frame is ready for a new clip.'));
  } catch (error) { message('toast', error.message, true); }
  finally { button.disabled = false; }
});
async function showOutput(job, expectedEpoch) {
  const response = await fetch(job.videoUrl, { headers: { Authorization: `Bearer ${token()}` } });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Video download failed.'); }
  const blob = await response.blob();
  if (epoch !== expectedEpoch) return;
  clearOutput(); outputURL = URL.createObjectURL(blob); currentJob = job;
  $('resultVideo').src = outputURL; $('resultVideo').hidden = false;
  $('downloadVideo').href = outputURL; $('downloadVideo').hidden = false; $('extendResult').hidden = !job.canExtend;
  document.querySelector('.preview-screen').hidden = true;
  $('previewStatus').textContent = ku('ڤیدیۆکە ئامادەیە', 'Video ready'); $('previewDuration').textContent = `${job.duration}s · ${job.aspectRatio} · ${job.resolution}`;
  message('toast', ku('ڤیدیۆکە ئامادەیە. دایبگرە و دەنگ و دیالۆگەکەی بپشکنە.', 'Your video is ready. Download it and review the audio and dialogue.'));
}
async function trackJob(jobId) {
  const expectedEpoch = ++epoch; const expectedToken = token();
  setBusy(true); $('resumeJob').hidden = false; $('resumeJob').dataset.job = jobId;
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (epoch !== expectedEpoch || token() !== expectedToken) return;
      const job = await api(`/api/video-status?job=${encodeURIComponent(jobId)}`);
      if (epoch !== expectedEpoch || token() !== expectedToken) return;
      $('previewStatus').textContent = stateLabel(job);
      if (job.ready) { await showOutput(job, expectedEpoch); localStorage.removeItem(requestKey); await refreshJobs(); return; }
      if (job.status === 'uncertain') throw new Error(ku('ئەنجامی داواکارییەکە نادیارە. بۆ ڕێگریکردن لە خەرجی دووبارە، پێویستە تۆماری Google بپشکنرێت.', 'The request outcome is uncertain. Check Google generation logs before sending another paid request.'));
      if (job.status === 'failed') { localStorage.removeItem(requestKey); throw new Error(job.error || 'Video generation failed.'); }
      message('toast', ku('ڤیدیۆکە دروست دەکرێت؛ دووبارە داواکاری مەبنێرە.', 'Your video is generating. Do not send another paid request.'));
      await delay(10000);
    }
    message('toast', ku('دروستکردن هێشتا تەواو نەبووە. بە دوگمەی پشکنینی داواکاریی پێشوو بەردەوام بە.', 'Generation is taking longer. Resume checking the existing request.'));
  } catch (error) { if (epoch === expectedEpoch) message('toast', error.message, true); }
  finally { if (epoch === expectedEpoch) { setBusy(false); await refreshJobs().catch(() => {}); } }
}
async function prepareNative(quoteOnly = false) {
  if ($('model').value==='p-video-2') return;
  if (busy) return;
  if (!token()) return message('toast', 'Please log in.', true);
  const prompt = $('prompt').value.trim();
  if (!prompt || prompt.length > 4000) return message('toast', ku('پرۆمپتێکی ١ تا ٤٠٠٠ پیتی بنووسە.', 'Write a prompt of 1–4000 characters.'), true);
  setBusy(true);
  const expectedEpoch = epoch;
  try {
    const mode = $('videoMode').value;
    const references = mode === 'new' ? await Promise.all([...$('referenceImages').files].map(imageData)) : [];
    if (mode === 'frame' && !firstFrame) throw new Error(ku('وێنەی دوا فڕەیم هەڵبژێرە یان لە ڤیدیۆکە وەریبگرە.', 'Choose or capture the previous final frame.'));
    if (mode === 'extend' && !$('sourceJob').value) throw new Error(ku('ڤیدیۆیەکی ئامادە بۆ Extension هەڵبژێرە.', 'Choose a ready video to extend.'));
    if (epoch !== expectedEpoch) return;
    let pending = JSON.parse(localStorage.getItem(requestKey) || 'null');
    if (pending?.token !== token()) pending = null;
    const requestId = pending?.id || crypto.randomUUID();
    const payload = { requestId, prompt, mode,
      model: $('model').value, duration: Number($('duration').value), resolution: $('resolution').value,
      aspectRatio: $('aspectRatio').value, language: $('language').value, style: selectedStyle,
      referenceImages: references, ...(mode === 'frame' ? { firstFrame } : {}),
      ...(mode === 'extend' ? { parentJobId: $('sourceJob').value } : {}) };
    const quote = await api('/api/video-quote', { method: 'POST', body: JSON.stringify(payload) });
    if (epoch !== expectedEpoch) return;
    if (quote.status) { if (!quoteOnly) await trackJob(quote.id); return; }
    const costText = ku(
      `خەرجی API بۆ Admin: نزیکەی €${quote.apiEUR.toFixed(4)} ($${quote.apiUSD.toFixed(4)}). دەنگ لە نرخەکەدایە؛ قازانجی فرۆشتن زیاد نەکراوە. باج، کرێی گۆڕینی دراو و سێرڤەر لەم ژمارەیەدا نین. نرخەکە خەمڵاندنە، نەک پسوولەی کۆتایی.`,
      `Admin API estimate: €${quote.apiEUR.toFixed(4)} ($${quote.apiUSD.toFixed(4)}). Includes native audio, no retail markup. Excludes tax, bank FX spread and hosting. This is an estimate, not the final invoice.`)
      + (mode === 'extend' ? ku(' بۆ Extension بودجە بە پارێزەوە بۆ هەموو ماوەی دەرئەنجامەکە حساب کراوە؛ بنەمای پارەدانی زیادکردن پشتڕاست نەکراوەتەوە.', ' Extension uses a conservative full-output budget; incremental extension billing is unverified.') : '');
    message('nativeCost', costText, !quote.canStart);
    if (!quote.canStart) throw new Error(ku('نرخنامەکە پێویستی بە نوێکردنەوە هەیە؛ هیچ داواکارییەکی پارەدار نەنێردرا.', 'Price review expired. No paid request was sent.'));
    if (quoteOnly) return;
    if (!confirm(costText + ku('\nئەم خەرجییە قبوڵ دەکەیت و داواکارییەکە دەنێریت؟', '\nApprove this API cost and submit this request?'))) return;
    if (epoch !== expectedEpoch) return;
    localStorage.setItem(requestKey, JSON.stringify({ id: requestId, token: token() }));
    const result = await api('/api/generate', { method: 'POST', body: JSON.stringify({ ...payload,
      quoteId: quote.id, approved: true, approvedAPIEUR: quote.apiEUR }) });
    if (epoch !== expectedEpoch) return;
    await trackJob(result.id);
  } catch (error) {
    if (epoch !== expectedEpoch) return;
    if (error.status && error.status < 500) localStorage.removeItem(requestKey);
    if (error.jobId) { $('resumeJob').dataset.job = error.jobId; $('resumeJob').hidden = false; }
    message('toast', error.message, true);
  } finally { setBusy(false); await refreshJobs().catch(() => {}); }
}
$('generate').addEventListener('click', () => prepareNative(false));
$('nativeQuote').addEventListener('click', () => prepareNative(true));
$('resumeJob').addEventListener('click', () => { if (!busy && $('resumeJob').dataset.job) trackJob($('resumeJob').dataset.job); });
$('loadJob').addEventListener('click', () => { if (!busy && $('jobHistory').value) trackJob($('jobHistory').value); });
$('extendResult').addEventListener('click', () => {
  if (!currentJob?.canExtend) return;
  $('videoMode').value = 'extend'; $('sourceJob').value = currentJob.id; updateControls(); $('prompt').focus();
});
// Translate text nodes rather than replacing h1/button markup or restoring stale account states.
const translations = new Map([
  ["چیرۆکەکەت بنووسە، شێوەزاری کوردی هەڵبژێرە و ئامادەبە بۆ دروستکردنی ڤیدیۆی AI.", "Write your story, choose a Kurdish dialect and prepare your AI video."],
  ["هەژمار دروست بکە یان بچۆ ژوورەوە بۆ بینینی کرێدیتەکانت.", "Create an account or log in to view your credits."],
  ["وردەکارییەکان دیاری بکە بۆ ئامادەکردنی ڤیدیۆکەت.", "Set up the details for your video."],
  ["شوێنی پیشاندانی ڤیدیۆی دروستکراو.", "Your generated video appears here."],
  ["چیرۆکە کوردییەکان بە شێوەیەکی نوێ", "A new way to tell Kurdish stories"],
  ["سۆرانی و بادینی", "Sorani and Badini"],
  ["بە ناسنامەی کوردی", "Kurdish identity"],
  ["لۆگۆی KurdAI بە ئاڵای کوردستان و دیزاینێکی مۆدێرن.", "KurdAI brings Kurdish identity to a modern creative studio."],
  ["پیشاندانی خەرجی API — بێ پارە", "View API cost — free"],
  ["پیشاندانی خەرجی — بێ پارە", "View cost — free"],
  ["پشکنینی پێشکەوتن", "Check progress"],
  ["کوردی سۆرانی (Sorani Kurdish)", "Sorani Kurdish"],
  ["کوردی بادینی (Badini Kurdish)", "Badini Kurdish"],
  ["کوالێتی ڤیدیۆی درێژ", "Video resolution"],
  ["زمانی دیالۆگی ڤیدیۆی درێژ", "Dialogue language"],
  ["دیالۆگی ڕاستەقینە بە زمانی هەڵبژێردراو", "Dialogue in your selected language"],
  ["قبوڵکردنی خەرجی و دروستکردنی ڤیدیۆی درێژ", "Approve cost and generate video"],

  ["ستۆدیۆ", "Studio"], ["پێشبینین", "Preview"], ["ئەکاونت", "Account"], ["٣. کارەکتەر و دیالۆگ", "3. Character and dialogue"],
  ["دروستکردنی ڤیدیۆ بە دەنگ", "Create video with audio"], ["وەسفی دیمەنی ڤیدیۆ", "Describe your scene"], ["ناسنامەی جێگیری کارەکتەرەکان", "Character identity"],
  ['داهێنان بە زمانی کوردی', 'Innovation in Kurdish'], ['هەنگاوێکی نوێ بۆ داهێنانی کوردی', 'A new era of Kurdish creativity'],
  ['بیرۆکەکەت بکە بە ', 'Turn your idea into '], ['ڤیدیۆ', 'video'], ['ئەکاونتی KurdAI', 'KurdAI Account'],
  ['ئیمەیڵ', 'Email'], ['وشەی نهێنی', 'Password'], ['دروستکردنی ئەکاونت', 'Create account'], ['چوونەژوورەوە', 'Log in'], ['دەرچوون', 'Log out'],
  ['ڤیدیۆی نوێ دروست بکە', 'Create a video'], ['چیرۆک یان بیرۆکەی ڤیدیۆ', 'Video story or prompt'], ['شێوەزاری کوردی', 'Dialogue language'],
  ['کوردی سۆرانی', 'Sorani Kurdish'], ['کوردی بادینی', 'Badini Kurdish'], ['بەبێ دیالۆگ', 'No dialogue'], ['ماوەی ڤیدیۆ', 'Video duration'],
  ['قەبارەی ڤیدیۆ', 'Aspect ratio'], ['کوالێتی', 'Resolution'], ['مۆدێلی ڤیدیۆ', 'Video model'], ['جۆری دروستکردن', 'Generation mode'],
  ['١. بیرۆکە و دەنگ', '1. Idea and dialogue'], ['٢. ڕێکخستنی ڤیدیۆ', '2. Video settings'], ['٣. شێوەی ڤیدیۆ', '3. Video style'], ['جۆری ڤیدیۆ', 'Video style'], ['پێشبینینی ڤیدیۆ', 'Video preview'], ['سینەمایی', 'Cinematic'], ['کارتۆن', 'Cartoon'], ['ڕاستەقینە', 'Realistic'],
  ['٣D ئەنیمەیشن', '3D Animation'], ['🎬 دروستکردنی ڤیدیۆ', '🎬 Generate video'], ['داگرتنی ڤیدیۆ', 'Download video'],
  ['بەردەوامکردنی ئەم ڤیدیۆیە', 'Extend this video'], ['داواکارییەکانی پێشوو', 'Previous requests'], ['پیشاندان / پشکنین', 'Load / check status'],
  ['بەردەوامبوون لە پشکنینی داواکاریی پێشوو', 'Resume previous request'], ['ڤیدیۆی نوێ / Reference Images', 'New video / Reference Images'],
  ['Video Extension — زیادکردنی ٧ چرکە', 'Video Extension — add 7 seconds'], ['Image to Video / وێنە یان دوا فڕەیم', 'New clip from final frame'],
  ['وێنەی سەرەتا یان دوا فڕەیم (PNG / JPEG)', 'Previous final frame (PNG / JPEG)'], ['وەرگرتنی دوا فڕەیمی ڤیدیۆی پیشاندراو', 'Capture final frame from loaded video'],
  ['وێنەکانی کارەکتەر و جل‌وبەرگ (تا ٣ وێنە)', 'Character and clothing references (up to 3 images)'], ['ڤیدیۆی پێشووی ئەم ئەکاونتە', 'Previous video from this account'],
  ['٤ چرکە', '4 seconds'], ['٦ چرکە', '6 seconds'], ['٨ چرکە', '8 seconds'], ['16:9 — ئاسۆیی', '16:9 — landscape'], ['9:16 — ستوونی / Reels', '9:16 — portrait / Reels'],
  ['720p — گونجاو بۆ Extension', '720p — supports extension'], ['1080p — ٨ چرکە', '1080p — 8 seconds'],
  ['KurdAI Public Beta', 'KurdAI Public Beta'],
  ['بەخێربێیت بۆ وەشانی گشتیی تاقیکردنەوەی KurdAI؛ هەژمار دروست بکە و ستۆدیۆ و ڕێکخستنەکانی ببینە.', 'Welcome to the KurdAI public beta. Create an account to explore the studio and settings.'],
  ['وەشانی Public Beta کراوەیە. هەژمار و ستۆدیۆ بەردەستن؛ بەڵام دروستکردنی ڤیدیۆی AI لەم وەشانەدا ناچالاکە. هیچ پارەیەک بۆ ڤیدیۆ وەرناگیرێت.', 'The Public Beta is open. Accounts and the studio are available, but AI video generation is disabled in this release. No video-generation charges will be made.'],
  ['داهێنان بە زمانی کوردی', 'Create in Kurdish'],
  ['بیرۆکەکەت بکە بە ', 'Turn your idea into '],
  ['بیرۆکە و دەنگ', 'Idea and dialogue'],
  ['ڕێکخستنی ڤیدیۆ', 'Video settings'],
  ['کارەکتەر و دیالۆگ', 'Characters and dialogue'],
  ['ڕێنمایی زمان و مۆدێل', 'Language and model guidance'],
  ['وێنە و ڤیدیۆی ڕەفەرەنس', 'Reference images and video'],
  ['ڤیدیۆ و داواکارییەکانی پێشوو', 'Previous videos and requests'],
  ['کرییدیتی کڕدراو', 'Purchased credits'],
  ['کرییدیت و پاکێجەکان', 'Credits and packages'],
  ['هەژمار دروست بکە یان بچۆ ژوورەوە بۆ بینینی کرێدیتەکانت.', 'Create an account or log in to view your credits.'],
  ['هەژمار و ستۆدیۆ بەردەستن', 'Accounts and studio are available'],
  ['دروستکردنی ڤیدیۆی AI هێشتا چالاک نییە', 'AI video generation is not enabled yet'],
  ['هیچ پارەیەک بۆ دروستکردنی ڤیدیۆ وەرناگیرێت.', 'No charges are made for video generation.']
]);
const textNodes = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) { const node = walker.currentNode; if (translations.has(node.textContent)) textNodes.push([node, node.textContent]); else if (translations.has(node.textContent.trim())) textNodes.push([node, node.textContent.trim()]); }
$('languageToggle').addEventListener('click', () => {
  const english = document.documentElement.lang !== 'en'; document.documentElement.lang = english ? 'en' : 'ckb'; document.documentElement.dir = english ? 'ltr' : 'rtl';
  for (const [node, original] of textNodes) if (node.isConnected) node.textContent = english ? translations.get(original) : original;
  $('languageToggle').textContent = english ? '🌐 EN / KU' : '🌐 KU / EN';
});
updateControls(); updateDialogueSupport(); refreshAccount();
api('/api/health').then(state=>{
  if(state.registrationConfigured===false) {
    $('registerBtn').disabled=true;
    message('accountMessage','Registration is not available yet. Email verification is not configured.',true);
  }
}).catch(()=>{});

for (const id of ['prompt','language','videoMode','resolution','duration','sourceJob','aspectRatio','model','referenceImages','previousFrame']) $(id).addEventListener('input', () => { $('nativeCost').textContent = ''; $('nativeCost').classList.remove('show'); });

