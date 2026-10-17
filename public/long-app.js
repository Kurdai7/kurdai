const $ = id => document.getElementById(id);
let quote = null, output = null, timer = null, generation = 0;
const token = () => localStorage.getItem('kurdai_session_token');
function show(text) { $('longCost').textContent = text; $('longCost').classList.add('show'); }
const money = amount => amount == null ? 'دیاری نەکراوە' : `€${amount.toFixed(4)}`;
async function call(path, body) {
  const response = await fetch(`/api/long/${path}`, { method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token() || ''}`, 'Content-Type': 'application/json' },
    ...(path === 'capabilities' ? {signal: AbortSignal.timeout(12000)} : {}),
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json(); if (!response.ok) throw Object.assign(new Error((data.error || 'داواکاری سەرکەوتوو نەبوو.') + (data.code ? ` [${data.code} · v${data.diagnosticVersion || 3}]` : '')), {code: data.code}); return data;
}
function invalidate() { generation++; quote = null; $('longStart').disabled = true; }
for (const id of ['prompt', 'aspectRatio', 'longModel', 'longResolution', 'longDuration', 'longIdentity', 'longReference', 'longLanguage', 'longDialogue']) $(id).addEventListener('input', invalidate);
function modelChanged() {
  invalidate();const omni=$('longModel').value==='gemini-omni-1.1-flash';
  for(const option of $('longDuration').options) option.disabled=!omni && !['60','70'].includes(option.value);
  for(const option of $('longResolution').options) option.disabled=omni && option.value==='480p';
  if(omni) $('longResolution').value='720p';
  if(!omni && !['60','70'].includes($('longDuration').value)) $('longDuration').value='60';
  if(!omni) $('longLanguage').value='none';
}
$('longModel').addEventListener('change',modelChanged);modelChanged();
function reset() {
  generation++; clearTimeout(timer); invalidate();
  $('longVideo').pause(); $('longVideo').removeAttribute('src'); $('longVideo').load();
  if (output) URL.revokeObjectURL(output); output = null;
  $('longVideo').hidden = $('longDownload').hidden = true;
}
$('logoutBtn').addEventListener('click', reset);
$('loginBtn').addEventListener('click', reset);
$('longQuote').addEventListener('click', async () => {
  invalidate(); const button = $('longQuote'); button.disabled = true;
  const session = token(); const version = generation;
  try {
    const files=Array.from($('longReference').files),images=[];
    if(files.length>($('longModel').value==='gemini-omni-1.1-flash'?3:1)) throw new Error('Omni تا سێ وێنە، Wan تەنها یەک وێنە پەسەند دەکات.');
    for (const file of files) {
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 4 * 1024 * 1024) throw new Error('وێنەی PNG/JPEG بەکاربهێنە، تا 4 MiB.');
      images.push(await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }));
    }
    const data = await call('quote', { model:$('longModel').value,prompt: $('prompt').value, aspectRatio: $('aspectRatio').value,
      resolution: $('longResolution').value, duration: Number($('longDuration').value), identity: $('longIdentity').value, image:images[0] || null,referenceImages:images.slice(1),
      language: $('longLanguage').value, dialogueText: $('longDialogue').value });
    if (session !== token() || version !== generation) return;
    if (data.outputSeconds !== Number($('longDuration').value) || data.model !== $('longModel').value)
      throw new Error('سێرڤەری Render هێشتا ماوەی هەڵبژێردراو پشتگیری ناکات؛ پێویستی بە Deploy ـی کۆدی نوێ هەیە. هیچ دروستکردنێک دەست پێ ناکات.');
    quote = data;
    show(`${data.model}\n${data.outputSeconds} چرکە · ${data.segments} × ٥ · ${$('longResolution').value} · ${data.nativeAudio?'دەنگ لە دەرئەنجامی Omni دایە؛ کوالێتی زمان تاقی نەکراوەتەوە':'بێ دەنگ'}\nAPI: ${data.apiUSD==null?'کۆی تۆکنەکان دیاری نەکراوە':`$${data.apiUSD.toFixed(3)} ≈ ${money(data.apiEUR)}`}\n${data.apiMinimumEUR==null?'':`تەنها دەرئەنجامی ڤیدیۆی داواکراو: ${money(data.apiMinimumEUR)}؛ تێکست، مێژووی دیمەن و خەرجییەکانی تر زیاد دەبن.\n`}پرۆسێسکردن: ${money(data.mediaEUR)} · گۆڕینی دراو: ${money(data.fxEUR)} · باج: ${money(data.vatEUR)}\nکۆی خەرجی: ${money(data.totalEUR)} · قازانجی فرۆشتن: €0\n${data.canStart ? 'ئەمە هەڵسەنگاندنی پارێزراوی خەرجییە، پسوڵە یان سنووری گەرەنتیکراوی پارەدان نییە. پێش دەستپێکردن قبوڵی بکە.' : (data.blockedReasons || ['هێشتا چالاک نییە؛ دەستگەیشتنی API و کۆی خەرجی پێویستیان بە ڕێکخستن هەیە.']).join('\n')}`);
    if(data.creditPrice) show(`${$('longCost').textContent}\nکرێدیتی پێویست: ${data.creditPrice}${data.creditMode==='test'?' (تاقیکردنەوە)':''}`);
    if(data.serviceCostBreakdown) {
      const b=data.serviceCostBreakdown;
      show(`${$('longCost').textContent}\n${b.mode==='image-to-video'?'بە وێنە':'بە دەق'} — دەرئەنجامی دیمەنی یەکەم: ${money(b.firstSegmentVideoEUR)}\nدەرئەنجامی بەردەوامکردن: ${money(b.continuationVideoEUR)}؛ لە کۆی دەرئەنجامەکەدا هەژمار کراوە.\nتۆکنی چوونەژوورەوە/مێژوو: دیاری نەکراوە · تێکستی دەرچوو: دیاری نەکراوە\nدەنگی ناوخۆی Omni: خەرجی جیاوازی نییە؛ کوالێتی سۆرانی/بادینی تاقی نەکراوەتەوە.`);
    }
    $('longCost').style.whiteSpace = 'pre-line'; $('longStart').disabled = !(data.canStart && Number.isFinite(data.totalEUR) && data.totalEUR>0 && Number.isFinite(data.apiUSD));
    if (data.audioQuote && !data.audioQuote.native && data.audioQuote.language !== 'none') {
      const a = data.audioQuote;
      show(`${$('longCost').textContent}\nدەنگ: هێشتا چالاک نییە؛ کۆی نرخ دیاری نەکراوە.\nهەڵسەنگاندنی بەشێکی API ـی دەنگ: $${a.estimateUSD.toFixed(6)}؛ ${a.language === 'sorani' ? 'تەنها دەرئەنجامی دەنگە؛ خەرجیی تێکستی چوونەژوورەوە زیاد دەبێت.' : 'تەنها بەهای پیتەکانە؛ بەشی بەشداری و مۆڵەت زیاد دەبێت.'}\nتا پشتڕاستکردنەوەی دەنگ و کۆی خەرجی، دروستکردنی بە دەنگ داخراوە.`);
    }
  } catch (e) { show(e.message); } finally { button.disabled = false; }
});
async function refresh(id) {
  clearTimeout(timer); const session = token(), version = generation;
  try {
    const job = await call(`status?id=${encodeURIComponent(id)}`);
    if (session !== token() || version !== generation) return;
    show(`${job.model==='synthetic-test-no-ai'?'تاقیکردنەوەی دەستکرد؛ AI و قسەکردنی کوردی نییە. خەرجی API: €0\n':''}${job.status} · ${job.completedSegments}/${job.totalSegments}\n${job.error || ''}\nخەرجیی API ـی تەرخانکراو (پسوڵە نییە): $${job.reservedAPIUSD.toFixed(3)}`);
    if (job.status === 'ready') {
      const response = await fetch(job.videoUrl, { headers: { Authorization: `Bearer ${session}` } });
      if (!response.ok) throw new Error('داگرتنی ڤیدیۆ سەرکەوتوو نەبوو.');
      const blob = await response.blob(); if (session !== token() || version !== generation) return;
      if (output) URL.revokeObjectURL(output); output = URL.createObjectURL(blob);
      $('longVideo').src = $('longDownload').href = output;
      $('longDownload').download = `KurdAI-${job.duration}s.mp4`;
      $('longVideo').hidden = $('longDownload').hidden = false;
    } else if (job.status === 'running') timer = setTimeout(() => refresh(id), 15000);
  } catch (e) { show(e.message); }
}
$('longStart').addEventListener('click', async () => {
  if (!quote?.canStart || $('longStart').disabled || !Number.isFinite(quote.totalEUR) || quote.totalEUR<=0) return;
  if (!window.confirm(`${quote.model}\nخەرجیی پێشبینیکراوی ${money(quote.totalEUR)} بۆ ${quote.outputSeconds} چرکە قبوڵ دەکەیت؟ پسوڵەی کۆتایی لەوانەیە جیاواز بێت. داواکارییەکان پارە خەرج دەکەن؛ یەکسانی ڕوخسار و دەنگ گەرەنتی نییە.`)) return;
  $('longStart').disabled = true;
  try {
    const job = await call('start', { id: quote.id, approved: true, approvedTotalEUR: quote.totalEUR,
      ...(quote.creditPrice ? {approvedCredits:quote.creditPrice} : {}) });
    await refresh(job.id);
  } catch (e) { show(e.message); }
});

$('longSmoke').addEventListener('click',async()=>{
  const button=$('longSmoke');button.disabled=true;invalidate();
  const session=token(),version=generation;
  show('تاقیکردنەوەی دەستکردی ٧٠ چرکە؛ هیچ API ـێکی پارەدار بانگ ناکرێت. نزیکەی ٤ خولەک چاوەڕێ بکە.');
  try {
    const job=await call('smoke',{aspectRatio:$('aspectRatio').value});
    if(session===token() && version===generation) await refresh(job.id);
  } catch(error) { if(session===token() && version===generation) show(error.message); }
  finally {button.disabled=false;}
});
$('longRefresh').addEventListener('click', async () => {
  try { const { jobs } = await call('jobs'); const job = jobs.find(j => j.status !== 'quoted');
    if (job) await refresh(job.id); else show('هێشتا دروستکردنی ڤیدیۆ دەستی پێ نەکردووە.');
  } catch (e) { show(e.message); }
});

$('longReadiness').addEventListener('click', async () => {
  const button = $('longReadiness'); button.disabled = true;
  const session = token(), version = generation;
  show('پشکنینی پەیوەندی Cloudflare بە Render… هیچ داواکارییەکی ڤیدیۆ نەنێردراوە.');
  try {
    let state;
    // Retry only the read-only probe. Never repeat quote/start/smoke submissions.
    for (let attempt = 1; attempt <= 6; attempt++) {
      if (session !== token() || version !== generation) return;
      try { state = await call('capabilities'); break; }
      catch (error) {
        const retryable = ['TypeError','TimeoutError','AbortError'].includes(error.name) || ['PROCESSOR_READINESS_TIMEOUT','PROCESSOR_NETWORK_ERROR'].includes(error.code);
        if (!retryable || attempt === 6) throw error;
        show(`پەیوەندی هێشتا پشتڕاست نەکراوەتەوە؛ هەوڵی ${attempt + 1}/6 بۆ پشکنینی بێ پارە. هیچ ڤیدیۆیەک داوا نەکراوە.`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    if (session !== token() || version !== generation) return;
    if(state.processorReachable && $('longModel').value==='gemini-omni-1.1-flash') {
      const model=state.models?.['gemini-omni-1.1-flash'];
      show(`سێرڤەر: بەردەستە.\nOmni 1.1 Flash: ${model ? (model.canStart?'ڕێکخراوە؛ تاقیکردنەوەی AI هێشتا نەکراوە.':(model.blockedReasons || []).join('\n')):'سێرڤەر پێویستی بە Deploy ـی کۆدی نوێی Omni هەیە.'}\nسۆرانی و بادینی جیاوازن؛ کوالێتیی دەنگ و جێگیری کارەکتەر هێشتا بە API تاقی نەکراونەتەوە.\nهیچ داواکارییەکی ڤیدیۆ نەنێردراوە.`);
      return;
    }
    show(state.processorReachable ?
      `سێرڤەر: بەردەستە.\nبە وێنەی خۆت: ${state.canStartWithReference ? 'ڕێکخراوە' : 'هێشتا ئامادە نییە'}. بە دەق: ${state.canStartFromText ? 'ڕێکخراوە' : 'هێشتا ئامادە نییە'}.\nدەنگی سۆرانی/بادینی: هێشتا چالاک نییە. ئەمە تەنها پشکنینی ڕێکخستنەکانە؛ تاقیکردنەوەی ڤیدیۆی AI نییە.` :
      `سێرڤەری ڤیدیۆ پەیوەست نەکراوە. ڕێکخستنە ونەکان: ${(state.missingConfiguration || []).join(', ')}. هیچ داواکارییەکی AI نەنێردراوە.`);
  } catch (error) { if (session === token() && version === generation) show(error.message); }
  finally { button.disabled = false; }
});
