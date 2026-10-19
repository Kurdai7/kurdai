// Private operator tool only. Never imported by the public worker or processor.
import {mkdir, open, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {preparePrunaTests} from './pruna-preflight.js';

export async function submitPrunaEvaluation({dialect, apiKey, freeCreditVerified=false,
 autoTopUpDisabled=false, directory, fetchImpl=fetch}) {
 const candidate=preparePrunaTests().cases.find(c=>c.dialect===dialect);
 if(!candidate || !apiKey || !directory || !freeCreditVerified || !autoTopUpDisabled)
  throw new Error('Evaluation blocked: dialect, private key, persistent directory and verified free-credit-only billing are required.');
 await mkdir(directory,{recursive:true,mode:0o700});
 // Reserve before sending: a timeout must never lead to a second generation.
 const marker=await open(join(directory,`${dialect}.reservation.json`),'wx',0o600);
 await marker.writeFile(JSON.stringify({dialect,started:new Date().toISOString(),state:'reserved-do-not-resubmit'}));
 await marker.close();
 let response;
 try {
  response=await fetchImpl(candidate.pruna.endpoint,{method:'POST',redirect:'error',
   signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',
    apikey:apiKey,Model:candidate.pruna.modelHeader},body:JSON.stringify(candidate.pruna.body)});
 } catch {throw new Error('Submission outcome uncertain. Reservation retained; do not retry.');}
 if(!response.ok) throw new Error(`Provider returned HTTP ${response.status}. Reservation retained; do not retry.`);
 const result=await response.json();
 if(typeof result.id!=='string' || !/^[A-Za-z0-9_-]{1,200}$/.test(result.id))
  throw new Error('Provider returned an unrecognized task ID. Do not resubmit.');
 // Persist only the task ID, not arbitrary responses which could echo secrets.
 const record={dialect,id:result.id,model:'p-video-2-pro',requestedSeconds:5,
  resolution:'768p',mode:'cost',speechVerified:false};
 await writeFile(join(directory,`${dialect}.task.json`),JSON.stringify(record,null,2),{mode:0o600});
 return record;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const dialect=process.argv[2];
 if(!process.argv.includes('--submit')){
  console.log(JSON.stringify({offline:true,canSubmit:false,keyConfigured:!!process.env.PRUNA_API_KEY,
   dialects:preparePrunaTests().cases.map(c=>c.dialect),productionEnabled:false}));
 } else {
  try {console.log(JSON.stringify(await submitPrunaEvaluation({dialect,apiKey:process.env.PRUNA_API_KEY,
   freeCreditVerified:process.env.PRUNA_FREE_CREDIT_VERIFIED==='true',
   autoTopUpDisabled:process.env.PRUNA_AUTO_TOPUP_DISABLED==='true',directory:process.env.PRUNA_EVALUATION_DIR})));}
  catch(error){console.error(error.message);process.exitCode=1;}
 }
}
