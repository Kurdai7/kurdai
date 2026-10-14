// Voiced pipeline behind the owner's immutable quote, configuration and storage gates.
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {save} from './engine.js';
import {createOmniClient,OMNI_MODEL} from './omni.js';
import * as media from './media.js';

export async function advanceOmni(job,directory,config,dependencies={}) {
  if (job.status !== 'running') return;
  const client=dependencies.client || createOmniClient({apiKey:config.GEMINI_API_KEY,enabled:config.OMNI_GENERATION_ENABLED === 'true'});
  const m=dependencies.media || media;
  const persist=()=>save(job,directory);
  try {
    const seconds=job.input.duration;
    if (!Number.isInteger(seconds) || seconds<5 || seconds>70 || seconds%5) throw new Error('Omni duration must be a multiple of five, from 5 to 70 seconds.');
    if (job.input.language !== 'none' && job.input.dialogueText &&
        (!Array.isArray(job.input.dialogueSegments) || job.input.dialogueSegments.length !== seconds/5))
      throw new Error('Spoken lines must be explicitly allocated to the selected segments.');
    if (job.inflight?.state === 'submitting') {
      job.status='uncertain';job.error='Interrupted Omni submission; inspect the provider before any new paid request.';
      await persist();return;
    }
    const i=job.completedSegments || 0, count=seconds/5;
    if (i === count) {await m.assembleVoiced(directory,count);job.status='ready';await persist();return;}
    if (!job.inflight) {
      if (config.OMNI_GENERATION_ENABLED !== 'true') throw new Error('Omni generation is disabled.');
      if (job.quote?.model !== OMNI_MODEL || !Number.isFinite(job.quote.totalEUR) || job.quote.totalEUR<=0 ||
          !Number.isFinite(job.quote.apiUSD) || job.quote.apiUSD<=0 || !Array.isArray(job.quote.segmentBudgetsUSD) || job.quote.segmentBudgetsUSD.length!==count)
        throw new Error('A complete Omni-specific approved quote is required. Wan prices cannot be reused.');
      const age=Date.now()-Date.parse(job.approvedAt);
      if (!Number.isFinite(age) || age<0 || age>86400000 || job.approvedTotalEUR!==job.quote.totalEUR)
        throw new Error('Explicit current approval of the full Omni total is required.');
      const cost=job.quote.segmentBudgetsUSD[i];
      if (!Number.isFinite(cost) || cost<=0 || (job.reservedAPIUSD||0)+cost>job.quote.apiUSD+0.000001)
        throw new Error('Omni exposure would exceed the approved estimate.');
      if (i>0 && !job.previousInteractionId) throw new Error('Missing prior Omni interaction; do not restart the story.');
      job.inflight={kind:'omni',state:'submitting'};
      job.reservedAPIUSD=Number(((job.reservedAPIUSD||0)+cost).toFixed(6));
      await persist(); // Before the one billable POST; no retries after an uncertain result.
      const result=await client.submit({...job.input,segmentSeconds:5,
        dialogueText:job.input.dialogueSegments?.[i] || '',
        prompt:job.input.actions?.[i] || `${job.input.prompt}\nStory part ${i+1}/${count}: advance the action from the prior ending; do not repeat earlier action or lines.`},job.previousInteractionId);
      if(result.usage) {job.providerUsage ||= {};job.providerUsage[result.id]=result.usage;}
      job.inflight={kind:'omni',state:'polling',id:result.id};await persist();
      // Persist only the interaction ID, never inline video buffers or output URIs.
      return;
    }
    const result=await client.poll(job.inflight.id);
    if (result.status !== 'completed') return;
    if(result.usage) {job.providerUsage ||= {};job.providerUsage[result.id]=result.usage;await persist();}
    const bytes=await client.media(result);
    if (!bytes) return;
    const source=join(directory,`raw-${i}.mp4`);
    await writeFile(source,bytes,{mode:0o600});
    await m.normalizeVoiced(source,join(directory,`clip-${i}.mp4`),job.input.aspectRatio,job.input.resolution,5);
    job.previousInteractionId=result.id;job.completedSegments=i+1;job.inflight=null;await persist();
  }catch(error){
    job.status=job.inflight?.state==='submitting'?'uncertain':'failed';
    // Adapter errors contain no provider body or credentials. No automatic retry.
    job.error='Omni processing stopped. Review the stored job and provider before continuing; no automatic paid retry was sent.';await persist();
  }
}
