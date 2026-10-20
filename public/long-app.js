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
for (const id of ['prompt', 'longPrompt', 'aspectRatio', 'longModel', 'longMode', 'longSource', 'longResolution', 'longDuration', 'longIdentity', 'longReference', 'longLanguage', 'longDialogue']) $(id).addEventListener('input', invalidate);
// Both editors represent the same scene; keep existing text across model changes.
$('prompt').addEventListener('input',()=>{ $('longPrompt').value=$('prompt').value; });
$('longPrompt').addEventListener('input',()=>{ $('prompt').value=$('longPrompt').value; });
function modelChanged() {
  invalidate();const selected=$('longModel').value;const omni=selected==='gemini-omni-1.1-flash';
  const pruna=selected==='p-video-2';
  const pending=['p-video-2','seedance-2.0-mini','heygen-video-1','pixverse-v6','kling-3.0-standard'].includes(selected);
  $('longModelNotice').textContent=pruna?'سۆرانیی P-Video 2 لە ڤیدیۆی API پەسەند کراوە. قەبارەی ڕاستەقینەی تاقیکردنەوە 1280×704 بوو؛ 720pی تەواو نییە. هەردوو زمان دەمێننەوە.':['pixverse-v6','kling-3.0-standard'].includes(selected)?'سۆرانی لەلایەن خاوەنی KurdAI تاقی کراوەتەوە؛ پەیوەندی API هێشتا ئامادە نییە. بادینی پێویستی بە تاقیکردنەوە هەیە.':pending?'ئەم مۆدێلە هێشتا پەیوەست نەکراوە؛ دەنگی سۆرانی و بادینی تاقی نەکراوەتەوە. دروستکردن داخراوە.': 'سۆرانی و بادینی هێشتا بە ڤیدیۆی ڕاستەقینە پشتڕاست نەکراونەتەوە.';
  for(const option of $('longDuration').options) option.disabled=pending ? Number(option.value)>(pruna?70:15) : (!omni && !['60','70'].includes(option.value));
  for(const option of $('longResolution').options) option.disabled=!([...(pruna?['704p']:['720p']),...(selected==='wan2.2-i2v-flash'?['480p']:[]),...(selected==='heygen-video-1'?['768p']:[])].includes(option.value)) || (selected==='heygen-video-1' && option.value==='720p');
  if(omni || pending) $('longResolution').value=selected==='heygen-video-1'?'768p':pruna?'704p':'720p';
  if(pending && Number($('longDuration').value)>(pruna?70:15)) $('longDuration').value='5';
  if(selected==='wan2.2-i2v-flash' && !['720p','480p'].includes($('longResolution').value)) $('longResolution').value='720p';
  if(!omni && !pending && !['60','70'].includes($('longDuration').value)) $('longDuration').value='60';
  if(selected==='wan2.2-i2v-flash') $('longLanguage').value='none';
  $('longMode').options[1].disabled=!(omni||pruna);
  if(!omni&&!pruna) $('longMode').value='new';
  $('longSourcePanel').hidden=$('longMode').value!=='extension';
}
$('longModel').addEventListener('change',modelChanged);modelChanged();
let sources=[];
function selectSource() {
  invalidate();const source=sources.find(j=>j.id===$('longSource').value);
  if(source) {
    $('longLanguage').value=source.language;$('aspectRatio').value=source.aspectRatio;
    $('longResolution').value=source.resolution;
  }
}
async function loadSources() {
  const session=token(),version=generation;
  try {
    const data=await call('jobs');if(session!==token() || version!==generation)return;
    sources=(data.jobs || []).filter(j=>j.canExtend && j.model===$('longModel').value);
    $('longSource').replaceChildren(new Option('ڤیدیۆ هەڵبژێرە',''),...sources.map(j=>new Option(`${j.duration}s · ${j.language} · ${j.id.slice(0,8)}`,j.id)));
    if(!sources.length)show('هێشتا ڤیدیۆیەکی تەواوکراوی ئەم مۆدێلە بۆ بەردەوامکردن نییە. هیچ AI بانگ نەکراوە.');
  } catch(error){if(session===token() && version===generation)show(error.message);}
}
$('longMode').addEventListener('change',()=>{invalidate();modelChanged();if($('longMode').value==='extension')loadSources();});
$('longSource').addEventListener('change',selectSource);
$('longSourcesRefresh').addEventListener('click',()=>{invalidate();loadSources();});
function reset() {
  generation++; clearTimeout(timer); invalidate();
  $('longVideo').pause(); $('longVideo').removeAttribute('src'); $('longVideo').load();
  if (output) URL.revokeObjectURL(output); output = null;
  $('longVideo').hidden = $('longDownload').hidden = true;
  sources=[];$('longSource').replaceChildren(new Option('ڤیدیۆ هەڵبژێرە',''));
}
$('logoutBtn').addEventListener('click', reset);
$('loginBtn').addEventListener('click', reset);
$('longQuote').addEventListener('click', async () => {
  invalidate(); const button = $('longQuote'); button.disabled = true;
  const session = token(); const version = generation;
  try {
    if(['seedance-2.0-mini','heygen-video-1'].includes($('longModel').value)) throw new Error('ئەم مۆدێلە هێشتا پەیوەست نەکراوە؛ نرخ و پشتگیری دیالێکت پێویستیان بە پشتڕاستکردنەوە هەیە.');
    if($('longMode').value==='extension' && !$('longSource').value)throw new Error('ڤیدیۆیەکی تەواوکراو بۆ بەردەوامکردن هەڵبژێرە.');
    const scene=($('longPrompt').value || $('prompt').value).trim();
    if($('longModel').value==='p-video-2' && !scene) { $('longPrompt').focus(); throw new Error('خانەی «وەسفی دیمەنی ڤیدیۆ» پڕ بکەرەوە؛ دیالۆگەکەت پارێزراوە.'); }
    if($('longModel').value==='p-video-2' && !$('longDialogue').value.trim()) { $('longDialogue').focus(); throw new Error('خانەی «دیالۆگی ڕاستەقینە» پڕ بکەرەوە؛ وەسفی دیمەنەکەت پارێزراوە.'); }
    const files=Array.from($('longReference').files),images=[];
    if(files.length>($('longModel').value==='gemini-omni-1.1-flash'?3:1)) throw new Error('Omni تا سێ وێنە، Wan تەنها یەک وێنە پەسەند دەکات.');
    for (const file of files) {
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 4 * 1024 * 1024) throw new Error('وێنەی PNG/JPEG بەکاربهێنە، تا 4 MiB.');
      images.push(await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }));
    }
    if(session!==token() || version!==generation)return;
    const data = await call('quote', { model:$('longModel').value,mode:$('longMode').value,
      ...($('longMode').value==='extension'?{sourceJobId:$('longSource').value}:{}),prompt: scene, aspectRatio: $('aspectRatio').value,
      resolution: $('longResolution').value, duration: Number($('longDuration').value), identity: $('longIdentity').value, image:images[0] || null,referenceImages:images.slice(1),
      language: $('longLanguage').value, dialogueText: $('longDialogue').value });
    if (session !== token() || version !== generation) return;
    if (data.outputSeconds !== Number($('longDuration').value) || data.model !== $('longModel').value)
      throw new Error('سێرڤەری Render هێشتا ماوەی هەڵبژێردراو پشتگیری ناکات؛ پێویستی بە Deploy ـی کۆدی نوێ هەیە. هیچ دروستکردنێک دەست پێ ناکات.');
    if($('longMode').value==='extension' && (data.mode!=='extension' || data.sourceJobId!==$('longSource').value))
      throw new Error('سێرڤەر بەردەوامکردنی ئەم ڤیدیۆیەی پشتڕاست نەکردەوە. هیچ دروستکردنێک دەست پێ ناکات.');
    quote = data;
    show(`${data.model}\n${data.outputSeconds} چرکە · ${data.segmentDurations?data.segmentDurations.join(' + '):`${data.segments} × ${data.segmentSeconds || 5}`} · ${$('longResolution').value} · ${data.nativeAudio?(data.ownerReview?.apiSpeechVerified && data.audioQuote?.language==='sorani'?'دەنگ و ڤیدیۆ پێکەوەن؛ دەنگی سۆرانی لە تاقیکردنەوەی API پەسەند کراوە':'دەنگ و ڤیدیۆ پێکەوەن؛ کوالێتی ئەم زمانە هێشتا پەسەند نەکراوە'):'بێ دەنگ'}\nAPI: ${data.apiUSD==null?'کۆی تۆکنەکان دیاری نەکراوە':`$${data.apiUSD.toFixed(3)} ≈ ${money(data.apiEUR)}`}\n${data.apiMinimumEUR==null?'':`تەنها دەرئەنجامی ڤیدیۆی داواکراو: ${money(data.apiMinimumEUR)}؛ تێکست، مێژووی دیمەن و خەرجییەکانی تر زیاد دەبن.\n`}پرۆسێسکردن: ${money(data.mediaEUR)} · گۆڕینی دراو: ${money(data.fxEUR)} · باج: ${money(data.vatEUR)}\nکۆی خەرجی: ${money(data.totalEUR)} · قازانجی فرۆشتن: €0\n${data.canStart ? 'ئەمە هەڵسەنگاندنی پارێزراوی خەرجییە، پسوڵە یان سنووری گەرەنتیکراوی پارەدان نییە. پێش دەستپێکردن قبوڵی بکە.' : (data.blockedReasons || ['هێشتا چالاک نییە؛ دەستگەیشتنی API و کۆی خەرجی پێویستیان بە ڕێکخستن هەیە.']).join('\n')}`);
    if(data.providerReference) show(`${$('longCost').textContent}\nنرخی بڵاوکراوەی ${data.providerReference.provider}: $${data.providerReference.outputUSD.toFixed(3)} بۆ دەرئەنجامی ڤیدیۆ بە دەنگ؛ باج و خەرجییەکانی تر لەخۆ ناگرێت. ئەمە نرخی کۆتایی فرۆشتن نییە.`);
    if(data.limitations?.length)show(`${$('longCost').textContent}\n${data.limitations.join('\n')}`);
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
  } catch (e) { if(session===token() && version===generation)show(e.message); } finally { button.disabled = false; }
});
async function refresh(id) {
  clearTimeout(timer); const session = token(), version = generation;
  try {
    const job = await call(`status?id=${encodeURIComponent(id)}`);
    if (session !== token() || version !== generation) return;
    if(['ready','failed'].includes(job.status))document.dispatchEvent(new Event('kurdai-balance-change'));
    show(`${job.model==='synthetic-test-no-ai'?'تاقیکردنەوەی دەستکرد؛ AI و قسەکردنی کوردی نییە. خەرجی API: €0\n':''}${job.status} · ${job.completedSegments}/${job.totalSegments}\n${job.error || ''}\nخەرجیی API ـی تەرخانکراو (پسوڵە نییە): $${job.reservedAPIUSD.toFixed(3)}`);
    if (job.status === 'ready') {
      // Never send a bearer session to a URL supplied by an upstream service.
      const expected=`/api/long/file?id=${encodeURIComponent(id)}`;
      if(job.id!==id || job.videoUrl!==expected)throw new Error('ناونیشانی داگرتنی ڤیدیۆ دروست نییە.');
      const response = await fetch(job.videoUrl, { headers: { Authorization: `Bearer ${session}` } });
      if (!response.ok) throw new Error('داگرتنی ڤیدیۆ سەرکەوتوو نەبوو.');
      const blob = await response.blob(); if (session !== token() || version !== generation) return;
      if (output) URL.revokeObjectURL(output); output = URL.createObjectURL(blob);
      $('longVideo').src = $('longDownload').href = output;
      $('longDownload').download = `KurdAI-${job.duration}s.mp4`;
      $('longVideo').hidden = $('longDownload').hidden = false;
    } else if (job.status === 'running') timer = setTimeout(() => refresh(id), 15000);
  } catch (e) { if(session===token() && version===generation)show(e.message); }
}
$('longStart').addEventListener('click', async () => {
  if (!quote?.canStart || $('longStart').disabled || !Number.isFinite(quote.totalEUR) || quote.totalEUR<=0) return;
  if (!window.confirm(`${quote.model}\nخەرجیی پێشبینیکراوی ${money(quote.totalEUR)} بۆ ${quote.outputSeconds} چرکە قبوڵ دەکەیت؟ پسوڵەی کۆتایی لەوانەیە جیاواز بێت. داواکارییەکان پارە خەرج دەکەن؛ یەکسانی ڕوخسار و دەنگ گەرەنتی نییە.`)) return;
  $('longStart').disabled = true;
  const session=token(),version=generation;
  try {
    const job = await call('start', { id: quote.id, approved: true, approvedTotalEUR: quote.totalEUR,
      ...(quote.creditPrice ? {approvedCredits:quote.creditPrice} : {}) });
    if(session===token() && version===generation) {
      document.dispatchEvent(new Event('kurdai-balance-change'));
      await refresh(job.id);
    }
  } catch (e) { if(session===token() && version===generation) {
    // A lost response can still leave a valid reservation. Re-read, never retry.
    document.dispatchEvent(new Event('kurdai-balance-change'));show(e.message);
  } }
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
  const session=token(),version=generation;
  try { const { jobs } = await call('jobs'); const job = jobs.find(j => j.status !== 'quoted');
    if(session!==token() || version!==generation)return;
    if (job) await refresh(job.id); else show('هێشتا دروستکردنی ڤیدیۆ دەستی پێ نەکردووە.');
  } catch (e) { if(session===token() && version===generation)show(e.message); }
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
    if(state.processorReachable && $('longModel').value==='p-video-2') {
      show('سێرڤەر: بەردەستە.\\nPruna P-Video 2: پەیوەندی API و دەنگی سۆرانی پێشتر تاقی کراونەتەوە و پەسەند کراون. کوالێتی بادینی هێشتا پەسەند نەکراوە.\\nبۆ پشکنینی نرخی ئەم داواکارییە و ڕێکخستنە ماوەکان، «پیشاندانی خەرجی — بێ پارە» هەڵبژێرە. پەیوەستبوونی سێرڤەر بە تەنها واتای چالاکبوونی دروستکردن نییە.\\nهیچ داواکارییەکی ڤیدیۆ نەنێردراوە.');
      return;
    }
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
