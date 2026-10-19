import {advanceNative} from './native-engine.js';
import {NATIVE_CANDIDATE_MODELS} from '../native-candidate-cost.js';
// Separate FFmpeg host, NOT a Cloudflare Worker. One process per durable data directory.
import http from 'node:http';
import { spendingPolicy, budgetAllows, euroBudgetAllows, budgetMonth } from '../spending.js';
import { buildLtxRequest, submitLtxOnce, pollLtx } from '../ltx-provider.js';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, unlink, access, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { longInput, quoteLong } from '../long-video.js';
import { verifyRuntime, duration } from './media.js';
import { advance, save, load, publicLongJob, registerRemoteSave } from './engine.js';
import {openJobStore} from './r2-job-store.js';
import { advanceOmni } from './omni-engine.js';
import { OMNI_MODEL } from '../omni-cost.js';
import { advanceSmoke, SMOKE_MODEL } from './smoke.js';
import {archiveFinalVideo,restoreFinalVideo} from './r2-video-archive.js';
import { putR2Object, getR2Object, deleteR2Object } from './r2-storage.js';

// Fixed, non-secret configuration summary for operators. Never log env values.
export function configurationStatus(config) {
  const costSettings = ['OMNI_INPUT_TOKENS_PER_SEGMENT', 'OMNI_TEXT_TOKENS_PER_SEGMENT',
    'LONG_MEDIA_EUR', 'LONG_FX_PERCENT', 'LONG_VAT_PERCENT'];
  return {
    geminiConfigured: typeof config.GEMINI_API_KEY === 'string' && !!config.GEMINI_API_KEY.trim(),
    durableStorageConfirmed: config.LONG_DURABLE_STORAGE === 'true',
    omniEnabled: config.OMNI_GENERATION_ENABLED === 'true',
    billingVerified: config.OMNI_BILLING_VERIFIED === 'true',
    apiSpendingEnabled: spendingPolicy(config).enabled,
    missingCostSettings: costSettings.filter(key => config[key] === undefined ||
      String(config[key]).trim() === '' || !Number.isFinite(Number(config[key])) || Number(config[key]) < 0)
  };
}

export async function createProcessor(config, dependencies = {}) {
  const mediaTools = await verifyRuntime();
  const root = resolve(config.LONG_DATA_DIR || './long-video-data');
  await mkdir(root, { recursive: true, mode: 0o700 });
  // A writable local directory is not proof of durable storage across deploys.
  const durableStorageAcknowledged = config.LONG_DURABLE_STORAGE === 'true';
  let storageReadWriteOK = false;
  const storageProbe = join(root, '.probe-' + randomUUID());
  try {
    const value = randomUUID();
    await writeFile(storageProbe, value, {flag:'wx',mode:0o600});
    storageReadWriteOK = (await readFile(storageProbe,'utf8')) === value;
  } catch {
    storageReadWriteOK = false;
  } finally {
    await unlink(storageProbe).catch(() => {});
  }
  // Optional, non-billable-provider R2 connectivity check using only a tiny random object.
  // This does NOT certify job durability and never enables paid generation.
  let r2StorageProbeOK = false;
  if (config.R2_STORAGE_PROBE_ENABLED === 'true') {
    const key = 'probes/' + randomUUID();
    let uploaded = false;
    try {
      const marker = Buffer.from(randomUUID());
      await putR2Object(config, key, marker);
      uploaded = true;
      const recovered = await getR2Object(config, key);
      r2StorageProbeOK = marker.equals(recovered);
    } catch {
      r2StorageProbeOK = false;
    } finally {
      if (uploaded) {
        try { await deleteR2Object(config, key); }
        catch { r2StorageProbeOK = false; }
      }
    }
  }
  if (config.R2_STORAGE_PROBE_ENABLED === 'true') {
    console.info('r2_storage_probe', JSON.stringify({passed:r2StorageProbeOK}));
  }
  if (!config.LONG_VIDEO_SERVICE_SECRET || config.LONG_VIDEO_SERVICE_SECRET.length < 32)
    throw new Error('A service secret of at least 32 characters is required.');
  // Lock prevents a second processor from submitting duplicate jobs against the same files.
  const lock = join(root, '.processor-lock'); await mkdir(lock);
  let chain = Promise.resolve();
  const serial = fn => { const task = chain.then(fn); chain = task.catch(() => {}); return task; };
  const jobs = new Map();
  for (const id of await readdir(root)) if (/^[a-f0-9-]{36}$/.test(id)) {
    const job = await load(join(root, id)); jobs.set(id, job);
  }
  let jobStore,unregisterRemote;
  if(config.R2_JOB_METADATA_ENABLED==='true') {
    try {
      jobStore=await openJobStore(config,dependencies.jobStorage);
      for(const job of jobStore.jobs) jobs.set(job.id,job);
      for(const job of jobs.values()) {
        if(['running','created','pending','processing'].includes(job.status)) {
          if(job.input.model===SMOKE_MODEL) job.completedSegments=0;
          else {job.status='uncertain';job.error='Processor restarted. Provider reconciliation required; no automatic paid resubmission.';}
        }
        // A synthetic test can be safely rebuilt when its final archive failed.
        if(job.status==='ready' && job.input.model===SMOKE_MODEL && !job.r2VideoArchived) {
          job.status='running';job.completedSegments=0;job.r2ArchiveAttempted=false;
        }
      }
      await jobStore.save([...jobs.values()]);
      if(!jobStore.paidTestReserved && [...jobs.values()].some(j=>j.input.model==='ltx-2.3' && j.approvedAt))
        await jobStore.reservePaidTest([...jobs.values()]);
      // Rehydrate the local cache only after the durable state is acknowledged.
      for(const job of jobs.values()) await save(job,join(root,job.id));
      unregisterRemote=registerRemoteSave(root,async job=>{
        const snapshot=new Map(jobs);snapshot.set(job.id,job);
        await jobStore.save([...snapshot.values()]);
      });
      console.info('r2_job_metadata_recovery',JSON.stringify({passed:true,jobs:jobs.size,
        completed:[...jobs.values()].filter(j=>j.status==='ready' && j.r2VideoArchived).length,
        uncertain:[...jobs.values()].filter(j=>j.status==='uncertain').length}));
    } catch {
      await rm(lock,{recursive:true,force:true});
      throw new Error('Durable job recovery failed. Refusing to start with an empty job ledger.');
    }
  }
  let durabilitySmoke={ready:false,restoredFromR2:false};
  const verifySmoke=async(job,restoredFromR2)=>{
    const path=join(root,job.id,'final.mp4'),bytes=await readFile(path);
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const seconds=await duration(path);
    if(Math.abs(seconds-70)>0.1 || (job.finalSHA256 && sha256!==job.finalSHA256))
      throw new Error('Synthetic archive verification failed');
    durabilitySmoke={ready:true,restoredFromR2,sha256,duration:seconds,aiGenerated:false};
    console.info('r2_durability_smoke',JSON.stringify(durabilitySmoke));
  };
  if(config.R2_DURABILITY_SMOKE_ENABLED==='true') {
    if(!jobStore?.healthy || config.R2_VIDEO_ARCHIVE_ENABLED!=='true')
      throw new Error('Synthetic durability check requires remote metadata and video archive');
    const prior=[...jobs.values()].find(j=>j.owner==='storage-self-test' && j.input.model===SMOKE_MODEL);
    if(prior?.status==='ready' && prior.r2VideoArchived) {
      const dir=join(root,prior.id);await rm(join(dir,'final.mp4'),{force:true});
      await restoreFinalVideo(config,prior.id,dir,prior.finalSHA256);await verifySmoke(prior,true);
    } else if(!prior) {
      const id=randomUUID(),job={id,owner:'storage-self-test',input:{model:SMOKE_MODEL,duration:70,aspectRatio:'16:9'},
        status:'running',completedSegments:0,reservedAPIUSD:0,
        quote:{model:SMOKE_MODEL,totalEUR:0,apiUSD:0,retailMarkupEUR:0,aiGenerated:false}};
      await save(job,join(root,id));jobs.set(id,job);
    }
  }
  const policy = () => spendingPolicy(config);
  const quote = input => {
    const result = quoteLong(input, costs(input));
    if (!budgetAllows(policy(), result.apiUSD)) {
      result.canStart = false;
      result.blockedReasons = [...(result.blockedReasons || []), 'API spending is disabled or exceeds the configured per-job/day limit.'];
    }
    if (!euroBudgetAllows(config, result.totalEUR)) {
      result.canStart = false;
      result.blockedReasons = [...(result.blockedReasons || []), 'Processor EUR reservation limit is invalid or below this job estimate.'];
    }
    return result;
  };
  // One bounded, global write counter also protects disk and FFmpeg from repeated requests.
  let writeWindow = 0, writes = 0;
  const costs = input => ({ mediaEUR: config.LONG_MEDIA_EUR, fxPercent: config.LONG_FX_PERCENT,
    vatPercent: config.LONG_VAT_PERCENT,
    omniInputTokensPerSegment: config.OMNI_INPUT_TOKENS_PER_SEGMENT,
    omniTextTokensPerSegment: config.OMNI_TEXT_TOKENS_PER_SEGMENT,
    omniConfigured: !!config.GEMINI_API_KEY,
    omniEnabled: config.OMNI_GENERATION_ENABLED === 'true',
    omniBillingVerified: config.OMNI_BILLING_VERIFIED === 'true',
    durableStorage: config.LONG_DURABLE_STORAGE === 'true' && storageReadWriteOK && jobStore?.healthy===true && config.R2_VIDEO_ARCHIVE_ENABLED==='true',
    enabled: config.LONG_DURABLE_STORAGE==='true' && jobStore?.healthy===true && config.R2_VIDEO_ARCHIVE_ENABLED==='true' && config.LONG_VIDEO_ENABLED === 'true' && !!config.DASHSCOPE_API_KEY && (!!input?.image || !!config.FAL_KEY)
      && new Date().toISOString().slice(0, 10) <= '2026-10-21' });
  const send = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const hash = value => createHash('sha256').update(value).digest();
  const server = http.createServer(async (req, res) => {
    try {
      // Loopback health check returns no owner data, job IDs, configuration or keys.
      const publicPath = new URL(req.url || '/', 'http://processor').pathname.replace(/\/+$/, '') || '/';
      if(req.method==='GET' && /^\/pruna-review\/(auth|sorani|badini)(\.mp4)?$/.test(publicPath)) {
        if(!config.PRUNA_REVIEW_TOKEN || !timingSafeEqual(hash(req.headers.authorization || ''),hash(`Bearer ${config.PRUNA_REVIEW_TOKEN}`)))
          return send(res,{error:'Unauthorized.'},401);
        if(publicPath==='/pruna-review/auth'){
          const {probePrunaAuthentication}=await import('./pruna-review.js');
          return send(res,await probePrunaAuthentication(config));
        }
        const [,dialect,video]=publicPath.match(/^\/pruna-review\/(sorani|badini)(\.mp4)?$/);
        const {reviewKey}=await import('./pruna-review.js');
        try {
          const bytes=await getR2Object(config,reviewKey(dialect,video?'mp4':'json'),video?50*1024*1024:100000);
          res.writeHead(200,{'Content-Type':video?'video/mp4':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
          return res.end(bytes);
        }catch{return send(res,{error:'Evaluation output is not ready.'},404);}
      }
      if (req.method === 'GET' && publicPath === '/readiness') {
        // Public diagnostic exposes no keys, billing details, owner IDs or file paths.
        const flags=configurationStatus(config);
        return send(res,{
          processorOnline:true,
          durableStorageAcknowledged,
          storageReadWriteOK,
          r2StorageProbeOK,
          jobMetadataDurable:jobStore?.healthy===true,
          finalVideoArchiveEnabled:config.R2_VIDEO_ARCHIVE_ENABLED==='true',
          syntheticDurabilityTest:durabilitySmoke,
          geminiKeyPresent:flags.geminiConfigured,
          omniVideoReady:storageReadWriteOK && jobStore?.healthy===true && config.R2_VIDEO_ARCHIVE_ENABLED==='true' && flags.geminiConfigured && flags.durableStorageConfirmed &&
            flags.omniEnabled && flags.billingVerified && flags.apiSpendingEnabled &&
            flags.missingCostSettings.length===0,
          pendingSetup:[
            ...(!storageReadWriteOK?['storage_read_write_failed']:[]),
            ...(!flags.durableStorageConfirmed?['durable_storage']:[]),
            ...(!flags.omniEnabled?['omni_generation_disabled']:[]),
            ...(!flags.billingVerified?['omni_billing_unverified']:[]),
            ...(!flags.apiSpendingEnabled?['api_spending_disabled']:[]),
            ...(flags.missingCostSettings.length?['cost_configuration_incomplete']:[])
          ],
          // Do not report a fabricated paid-request count: this process cannot audit provider billing.
          paidGenerationRequestsVerified:false
        });
      }
      if (req.method === 'GET' && req.url === '/healthz') return send(res, {ok: true, mediaTools, protocolVersion: 4, outputDurations: Array.from({length:14},(_,i)=>(i+1)*5)});
      if (!timingSafeEqual(hash(req.headers.authorization || ''), hash(`Bearer ${config.LONG_VIDEO_SERVICE_SECRET}`))) return send(res, { error: 'Unauthorized.' }, 401);
      const owner = req.headers['x-kurdai-owner'];
      if (typeof owner !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(owner)) return send(res, { error: 'Invalid owner.' }, 400);
      const url = new URL(req.url, 'http://processor');
      if (config.PROCESSOR_DIAGNOSTICS === 'true') console.info('processor_request', JSON.stringify({method: req.method,
        route: ['/v1/health','/v1/quote','/v1/start','/v1/jobs','/v1/status','/v1/file'].includes(url.pathname) ? url.pathname : 'unknown'}));
      if (req.method === 'GET' && url.pathname === '/v1/health') {
        const ready = image => quote({resolution:'480p',image,language:'none'}).canStart;
        const omni=quote({model:OMNI_MODEL,duration:5,language:'sorani',resolution:'720p'});
        return send(res, {spending:policy(), processorReachable: true, mediaTools, outputDurations: Array.from({length:14},(_,i)=>(i+1)*5), protocolVersion: 4,
          canStartWithReference: ready(true), canStartFromText: ready(false),
          providerConfigured: {wan: !!config.DASHSCOPE_API_KEY, openingImage: !!config.FAL_KEY, wavespeed: typeof config.WAVESPEED_API_KEY === 'string' && !!config.WAVESPEED_API_KEY.trim()},
          missingCosts: ['LONG_MEDIA_EUR','LONG_FX_PERCENT','LONG_VAT_PERCENT'].filter(k => config[k] === undefined || config[k] === ''),
          audioEnabled: {sorani: false, badini: false},
          syntheticTest:{available:true,duration:70,providerRequests:0,aiGenerated:false},
          models:{[OMNI_MODEL]:{configured:!!config.GEMINI_API_KEY,canStart:omni.canStart,
            blockedReasons:omni.blockedReasons,nativeAudio:true,speechQualityVerified:false}},paidProviderProbe: false});
      }
      if (req.method === 'GET' && url.pathname === '/v1/gemini/probe') {
        // GET model metadata: no content generation, no billable inference.
        // Never echo API credentials or vendor response body.
        if (!config.GEMINI_API_KEY) return send(res,{configured:false,reachable:false,modelAvailable:false},503);
        try {
          const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-omni-1.1-flash',{
            method:'GET',headers:{'x-goog-api-key':config.GEMINI_API_KEY},
            redirect:'manual',signal:AbortSignal.timeout(12000)
          });
          await response.body?.cancel();
          return send(res,{configured:true,reachable:true,modelAvailable:response.ok,
            providerHTTPStatus:response.status,paidRequests:0},response.ok?200:424);
        } catch {
          return send(res,{configured:true,reachable:false,modelAvailable:false,
            error:'Provider metadata request failed.',paidRequests:0},502);
        }
      }
      if (req.method === 'GET' && url.pathname === '/v1/jobs')
        return send(res, { jobs: [...jobs.values()].filter(j => j.owner === owner).map(publicLongJob).reverse().slice(0, 30) });
      if (req.method === 'GET') {
        const job = jobs.get(url.searchParams.get('id'));
        if (!job || job.owner !== owner) return send(res, { error: 'Not found.' }, 404);
        if (url.pathname === '/v1/status') return send(res, publicLongJob(job));
        if (url.pathname === '/v1/file' && job.status === 'ready') {
          const file = join(root, job.id, 'final.mp4');
          if (config.R2_VIDEO_ARCHIVE_ENABLED === 'true' && job.r2VideoArchived === true) {
            try { await access(file); }
            catch {
              try { await restoreFinalVideo(config,job.id,join(root,job.id),job.finalSHA256); }
              catch (error) {
                // Concurrent restore can create the file first; never overwrite it.
                if (error.code !== 'EEXIST') throw error;
              }
            }
          }
          await access(file);
          res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'private, no-store' });
          createReadStream(file).on('error', () => res.destroy()).pipe(res); return;
        }
        return send(res, { error: 'Not ready or unknown route.' }, 404);
      }
      if (req.method !== 'POST') return send(res, { error: 'Method not allowed.' }, 405);
      const window = Math.floor(Date.now() / 60000);
      if (window !== writeWindow) { writeWindow = window; writes = 0; }
      if (++writes > 20) { res.setHeader('Retry-After', '60'); return send(res,{error:'Too many requests. Wait before retrying.'},429); }
      if (Number(req.headers['content-length']) > 17000000) return send(res,{error:'Request too large.'},413);
      const decoder=new StringDecoder('utf8');let raw = '',rawBytes=0;
      for await (const chunk of req) { rawBytes+=chunk.length; if(rawBytes>17000000) { send(res,{error:'Request too large.'},413);return; } raw+=decoder.write(chunk); }
      raw+=decoder.end();
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, {error: 'Invalid JSON request.', code: 'PROCESSOR_INVALID_INPUT'}, 400); }
      await serial(async () => {
        if (url.pathname === '/v1/smoke') {
          if(!['16:9','9:16'].includes(body.aspectRatio)) return send(res,{error:'Invalid aspect ratio.'},400);
          // One reusable test per owner and ratio bounds disk use and makes replay harmless.
          const existing=[...jobs.values()].find(j=>j.owner===owner && j.input.model===SMOKE_MODEL && j.input.aspectRatio===body.aspectRatio);
          if(existing) return send(res,publicLongJob(existing));
          if([...jobs.values()].some(j=>['running','uncertain','processing'].includes(j.status))) return send(res,{error:'Another job is active; finish it first.'},409);
          const id=randomUUID(),job={id,owner,input:{model:SMOKE_MODEL,duration:70,aspectRatio:body.aspectRatio},
            status:'running',completedSegments:0,reservedAPIUSD:0,
            quote:{model:SMOKE_MODEL,totalEUR:0,apiUSD:0,retailMarkupEUR:0,aiGenerated:false}};
          await save(job,join(root,id));jobs.set(id,job);return send(res,publicLongJob(job),202);
        }
        if (url.pathname === '/v1/ltx/preflight') {
          // Non-billable validation: never sends a provider request.
          // Full EUR cost remains unknown until taxes/fees are verified.
          if (!['sorani','badini'].includes(body.language)) return send(res,{error:'Choose Sorani or Badini.'},400);
          if (typeof body.visualPrompt !== 'string' || body.visualPrompt.length > 2000 ||
              typeof body.dialogueText !== 'string' || body.dialogueText.length > 500)
            return send(res,{error:'Invalid prompt length.'},400);
          try {
            const candidate = buildLtxRequest({
              language:body.language,dialogueText:body.dialogueText,visualPrompt:body.visualPrompt,
              aspectRatio:body.aspectRatio || '16:9',maxEUR:0.20
            });
            return send(res,{
              model:'ltx-2.3',duration:5,resolution:'720p',
              providerKeyConfigured:typeof config.WAVESPEED_API_KEY==='string' && !!config.WAVESPEED_API_KEY.trim(),
              budget:candidate.budget,canSubmit:false,
              reason:'No paid submission: provider cost extras and Kurdish voice remain unverified.'
            });
          } catch (error) {
            return send(res,{error:'LTX preflight rejected the input.',code:'LTX_PREFLIGHT_INVALID'},400);
          }
        }
        if (url.pathname === '/v1/ltx/start') {
          // Single-use, durable, explicitly approved paid submission. No retry on uncertainty.
          if (config.LTX_PAID_TEST_ENABLED !== 'true' ||
              (config.LONG_DURABLE_STORAGE !== 'true' || !storageReadWriteOK || !jobStore?.healthy || config.R2_VIDEO_ARCHIVE_ENABLED!=='true') ||
              config.LTX_TOTAL_COST_VERIFIED !== 'true' ||
              !config.WAVESPEED_API_KEY)
            return send(res,{error:'Paid LTX test not enabled or storage/cost/key not verified.'},409);
          if (body.approved !== true || body.approvedMaxEUR !== 0.20)
            return send(res,{error:'Explicit approval of a maximum of 0.20 EUR required.'},400);
          const extraEUR=Number(config.LTX_VERIFIED_EXTRA_EUR);
          const usdPerEUR=Number(config.LTX_VERIFIED_USD_PER_EUR);
          if (config.LTX_VERIFIED_EXTRA_EUR === undefined ||
              config.LTX_VERIFIED_USD_PER_EUR === undefined ||
              !Number.isFinite(extraEUR) || extraEUR < 0 ||
              !Number.isFinite(usdPerEUR) || usdPerEUR <= 0)
            return send(res,{error:'Missing verified total-cost inputs.'},409);
          let candidate;
          try {
            candidate=buildLtxRequest({language:body.language,dialogueText:body.dialogueText,
              visualPrompt:body.visualPrompt,aspectRatio:body.aspectRatio || '16:9',
              extraEUR,maxEUR:0.20,usdPerEUR});
          } catch { return send(res,{error:'Invalid LTX request.'},400); }
          if (!candidate.budget.withinBudget || !candidate.budget.fullCostKnown ||
              candidate.budget.estimatedTotalEUR > 0.20)
            return send(res,{error:'Verified budget exceeds 0.20 EUR.'},409);
          // LTX must obey the same explicit global API spending policy as other paid routes.
          const today = new Date().toISOString().slice(0, 10);
          const reservedTodayUSD = [...jobs.values()].filter(j => j.approvedAt?.startsWith(today))
            .reduce((sum, j) => sum + (Number.isFinite(j.quote?.apiUSD) ? j.quote.apiUSD : Infinity), 0);
          if (!budgetAllows(policy(), 0.15, reservedTodayUSD))
            return send(res,{error:'API spending policy blocks this LTX test.'},409);
          if ([...jobs.values()].some(j => ['running', 'uncertain', 'processing'].includes(j.status)))
            return send(res,{error:'Another video job is active or uncertain; resolve it before any paid LTX test.'},409);
          // At most one paid LTX test across all owners, including after a restart.
          const marker=join(root,'ltx-single-paid-test');
          // Conditional remote reservation survives a completely empty Render disk.
          if(jobStore.paidTestReserved) return send(res,{error:'Single paid test already reserved. Do not retry.'},409);
          await jobStore.reservePaidTest([...jobs.values()]);
          try { await mkdir(marker); } catch (error) {
            if (error.code === 'EEXIST') return send(res,{error:'Single paid test already reserved. Never retry automatically.'},409);
            throw error;
          }
          const id=randomUUID(),job={id,owner,input:{model:'ltx-2.3',duration:5,
            language:body.language,aspectRatio:body.aspectRatio || '16:9'},
            quote:{totalEUR:candidate.budget.estimatedTotalEUR,apiUSD:0.15},
            status:'uncertain',approvedAt:new Date().toISOString(),
            reservedAPIUSD:0.15,completedSegments:0};
          await save(job,join(root,id));jobs.set(id,job);
          // Persist uncertain status BEFORE any billable POST. Never auto-resubmit.
          try {
            const result=await submitLtxOnce({apiKey:config.WAVESPEED_API_KEY,
              request:{...candidate,canSubmit:true},approved:true});
            job.predictionId=result.id;job.status='processing';await save(job,join(root,id));
            return send(res,{id,status:job.status,providerPredictionId:result.id},202);
          } catch {
            job.status='uncertain';job.error='Provider submission uncertain. Check WaveSpeed dashboard; do not retry.';
            await save(job,join(root,id));
            return send(res,{id,status:'uncertain',error:job.error},202);
          }
        }
        if (url.pathname === '/v1/ltx/poll') {
          const job=jobs.get(body.id);
          if (!job || job.owner!==owner || job.input.model!=='ltx-2.3')
            return send(res,{error:'Not found.'},404);
          if (!job.predictionId) return send(res,{id:job.id,status:job.status,error:job.error||null});
          try {
            const result=await pollLtx({apiKey:config.WAVESPEED_API_KEY,predictionId:job.predictionId});
            job.status=result.status;job.providerOutputs=result.outputs;
            await save(job,join(root,job.id));
            return send(res,{id:job.id,status:job.status,outputs:result.outputs});
          } catch {
            return send(res,{id:job.id,status:job.status,error:'Polling failed; retry GET/status only, never resubmit.'},502);
          }
        }
        if (url.pathname === '/v1/quote') {
          let input;
          try { input = longInput(body); } catch (error) { return send(res, {error: error.message, code: 'PROCESSOR_INVALID_INPUT'}, 400); }
          let previousInteractionId;
          if(input.mode==='extension') {
            const source=jobs.get(input.sourceJobId);
            if(!source || source.owner!==owner) return send(res,{error:'Extension source not found.'},404);
            if(!publicLongJob(source).canExtend) return send(res,{error:'Choose a completed Omni video with saved continuation context.'},409);
            if(input.language!==source.input.language || input.aspectRatio!==source.input.aspectRatio || input.resolution!==source.input.resolution)
              return send(res,{error:'Keep the source video dialect, aspect ratio and resolution for extension.'},409);
            // Resolve provider context only from the owner's durable record.
            // Caller-supplied interaction IDs are never trusted or forwarded.
            previousInteractionId=source.previousInteractionId;
            input.identity=source.input.identity;
          }
          const costQuote = quote(input);
          // Keep at most ten unstarted quotes, including uploaded reference images.
          const pending = [...jobs.values()].filter(j => j.owner === owner && j.status === 'quoted')
            .sort((a,b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
          for (const stale of pending.slice(0, Math.max(0, pending.length - 9))) {
            await rm(join(root, stale.id), {recursive:true,force:true}); jobs.delete(stale.id);
          }
          const id = randomUUID(), expiresAt = new Date(Date.now() + 15 * 60000).toISOString();
          const job = { id, owner, input, quote:costQuote, expiresAt, status: 'quoted', completedSegments: 0, reservedAPIUSD: 0,
            ...(previousInteractionId?{previousInteractionId}:{}) };
          await save(job, join(root, id)); jobs.set(id, job);
          return send(res, { ...costQuote, id, expiresAt });
        }
        if (url.pathname !== '/v1/start') return send(res, { error: 'Unknown route.' }, 404);
        const job = jobs.get(body.id);
        if (!job || job.owner !== owner) return send(res, { error: 'Not found.' }, 404);
        if (job.status !== 'quoted') return send(res, publicLongJob(job)); // Replay never generates again.
        if(config.LONG_DURABLE_STORAGE!=='true' || !jobStore?.healthy || config.R2_VIDEO_ARCHIVE_ENABLED!=='true')
          return send(res,{error:'Verified durable job metadata and final video storage are required before paid generation.'},409);
        const current = quote(job.input);
        if (!current.canStart || JSON.stringify(current) !== JSON.stringify(job.quote)) return send(res, { error: 'Processor or costs changed; request a new quote.' }, 409);
        if (Date.parse(job.expiresAt) < Date.now()) return send(res, { error: 'Quote expired.' }, 409);
        if (body.approved !== true || body.approvedTotalEUR !== job.quote.totalEUR)
          return send(res, { error: 'Explicit approval of the quoted total is required.' }, 400);
        if ([...jobs.values()].some(j => ['running', 'uncertain', 'processing'].includes(j.status)))
          return send(res, { error: 'An active or uncertain job must be resolved first.' }, 409);
        const day = new Date().toISOString().slice(0,10);
        const reserved = [...jobs.values()].filter(j => j.approvedAt?.startsWith(day))
          .reduce((sum,j) => sum + (Number.isFinite(j.quote?.apiUSD) ? j.quote.apiUSD : Infinity), 0);
        if (!budgetAllows(policy(), job.quote.apiUSD, reserved))
          return send(res,{error:'Daily API reservation limit reached. No paid request was sent.'},409);
        const month = budgetMonth(new Date().toISOString());
        let monthlyEUR = 0, lifetimeEUR = 0;
        for (const previous of jobs.values()) if (previous.approvedAt) {
          const amount = previous.approvedTotalEUR;
          const exposure = Number.isFinite(amount) && amount > 0 ? amount : Infinity;
          lifetimeEUR += exposure;
          const previousMonth = budgetMonth(previous.approvedAt);
          if (previousMonth === month || previousMonth === null) monthlyEUR += exposure;
        }
        if (!euroBudgetAllows(config, job.quote.totalEUR, monthlyEUR, lifetimeEUR))
          return send(res,{error:'Monthly or total EUR reservation limit reached. No paid request was sent.'},409);
        // Approval and its full reservation are saved together before any provider submission.
        job.status = 'running'; job.approvedAt = new Date().toISOString(); job.approvedTotalEUR=body.approvedTotalEUR;
        await save(job, join(root, job.id)); send(res, publicLongJob(job), 202);
      });
    } catch (error) {
      if (config.PROCESSOR_DIAGNOSTICS === 'true') console.error('processor_request_failed', JSON.stringify({
        method: req.method, route: ['/v1/health','/v1/quote','/v1/start','/v1/jobs','/v1/status','/v1/file'].includes(String(req.url).split('?')[0]) ? String(req.url).split('?')[0] : 'unknown',
        errorType: ['TypeError','Error','SyntaxError','RangeError'].includes(error.name) ? error.name : 'Error',
        code: /^[A-Z_]{1,40}$/.test(error.code || '') ? error.code : 'INTERNAL'
      })); // Never log body, prompts, owners, headers, credential values or raw exceptions.
      if (!res.headersSent) send(res, {error: 'Processor request failed. Check server logs and stored job status.', code: 'PROCESSOR_INTERNAL_ERROR'}, 500);
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 15000;
  let timer, closed = false;
  const tick = () => serial(async () => {
    const job = [...jobs.values()].find(j => j.status === 'running') ||
      (config.R2_VIDEO_ARCHIVE_ENABLED === 'true' ? [...jobs.values()].find(j => j.status === 'ready' && !j.r2VideoArchived && !j.r2ArchiveAttempted) : undefined);
    if(job?.status==='ready') { /* Archive an old completed job without re-entering generation. */ }
    else if (job?.input.model===SMOKE_MODEL) await advanceSmoke(job,join(root,job.id));
    else if (job && !job.inflight && !budgetAllows(policy(),job.quote.apiUSD)) {
      job.status='failed';job.error='API spending was disabled; no new provider request was sent.';
      await save(job,join(root,job.id));
    } else if (job?.input.model===OMNI_MODEL) {
      // A later configuration change must not silently unlock or reprice a job.
      if(!job.inflight && job.completedSegments<job.input.duration/5 && !quoteLong(job.input,costs(job.input)).canStart) {
        job.status='failed';job.error='Omni configuration changed; no new generation request was sent.';
        await save(job,join(root,job.id));return;
      }
      await advanceOmni(job,join(root,job.id),config,dependencies.omni || {});
    } else if (job && NATIVE_CANDIDATE_MODELS.includes(job.input.model)) {
      await advanceNative(job,join(root,job.id),config,dependencies.native || {});
    } else if (job) await advance(job, join(root, job.id), config, dependencies);
    // Archive only completed media; never enable or submit paid provider work.
    if (job?.status === 'ready' && config.R2_VIDEO_ARCHIVE_ENABLED === 'true' && !job.r2VideoArchived && !job.r2ArchiveAttempted) {
      try {
        await archiveFinalVideo(config,job.id,join(root,job.id,'final.mp4'));
        const localBytes=await readFile(join(root,job.id,'final.mp4'));
        const remoteBytes=await getR2Object(config,'jobs/'+job.id+'/final.mp4');
        if(!localBytes.equals(remoteBytes))throw new Error('Archive read-back mismatch');
        job.finalSHA256=createHash('sha256').update(localBytes).digest('hex');
        job.r2VideoArchived = true;
        job.r2ArchiveAttempted = true;
        await save(job,join(root,job.id));
        if(job.owner==='storage-self-test' && job.input.model===SMOKE_MODEL)await verifySmoke(job,false);
      } catch {
        // Do not falsely report durable video storage or leak storage credentials.
        job.r2VideoArchived = false;
        job.r2ArchiveAttempted = true;
        await save(job,join(root,job.id));
      }
    }
  });
  return { server, tick,
    start() { timer = setInterval(() => tick().catch(() => {}), 15000); timer.unref(); },
    async close() { if (closed) return; closed = true; clearInterval(timer); await chain; unregisterRemote?.();await rm(lock, { recursive: true, force: true }); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.PROCESSOR_BIND_HOST || '127.0.0.1';
  if (!['127.0.0.1','0.0.0.0'].includes(host)) throw new Error('Use an explicit loopback or container bind address.');
  const port = Number(process.env.PORT || 8788);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const processor = await createProcessor(process.env);
  processor.server.listen(port, host, () => {
    if (process.env.PROCESSOR_DIAGNOSTICS === 'true') {
      console.info('processor_listening', JSON.stringify({host, port}));
      console.info('processor_configuration', JSON.stringify(configurationStatus(process.env)));
    }
  });
  // Single non-billable metadata probe at boot. Never generate content, log keys,
  // or treat a model lookup as proof of working video generation.
  if (process.env.GEMINI_API_KEY) {
    void (async () => {
      try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-omni-1.1-flash', {
          method:'GET',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY},
          redirect:'manual',signal:AbortSignal.timeout(12000)
        });
        await response.body?.cancel();
        console.info('gemini_model_metadata_probe',JSON.stringify({
          model:'gemini-omni-1.1-flash',httpStatus:response.status,
          accessible:response.ok,paidGenerationRequestsVerified:false
        }));
      } catch {
        console.info('gemini_model_metadata_probe',JSON.stringify({
          model:'gemini-omni-1.1-flash',reachable:false,paidGenerationRequestsVerified:false
        }));
      }
    })();
  }
  processor.start();
  if(process.env.PRUNA_FREE_EVALUATION==='2026-10-19-two-dialects') {
    import('./pruna-review.js').then(({runPrunaReview})=>runPrunaReview(process.env))
      .then(result=>console.info('pruna_review',JSON.stringify(result)))
      .catch(error=>console.error('pruna_review_stopped',error.message.replace(/[^a-zA-Z0-9 .;:_-]/g,'').slice(0,180)));
  }
  const shutdown = () => processor.server.close(async () => { await processor.close(); process.exit(0); });
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
