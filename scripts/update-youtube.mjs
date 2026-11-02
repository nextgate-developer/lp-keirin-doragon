import {appendFile} from 'node:fs/promises';
import {syncYoutube,YoutubeRssUnavailableError} from './lib/youtube-rss.mjs';
import {saveDiagnostic} from './lib/youtube-http-diagnostics.mjs';
import {runManagedSync} from './lib/youtube-health.mjs';
import {createGithubHealthStore} from './lib/youtube-health-store.mjs';

try{
  if(process.argv.slice(2).some(arg=>!['--check','--managed'].includes(arg)))throw new Error('Supported options: --check --managed');
  const managed=process.argv.includes('--managed');
  const branch=process.env.GITHUB_REF_NAME;
  if(managed&&!['main','investigation/youtube-rss'].includes(branch))throw new Error('Managed RSS is restricted to main or investigation/youtube-rss');
  // A manually dispatched investigation run can never update published data.
  const check=process.argv.includes('--check')||(managed&&branch!=='main');
  const sync=()=>syncYoutube(new URL('../src/data/youtube.json',import.meta.url),{
    check,onSourceFailure:async(url,error)=>{
      console.warn(`RSS source failed (${new URL(url).searchParams.has('playlist_id')?'uploads':'channel'}): ${error.message}`);
      if(error.httpDiagnostic){
        try{await saveDiagnostic(error.httpDiagnostic);}catch{console.warn('RSS diagnostic could not be saved');}
      }
    },
    onRetry:(retry,error,{waitMs,maxRetries})=>console.warn(`RSS retry ${retry}/${maxRetries} in ${waitMs/1000}s: ${error.message}`)
  });
  const result=managed?await runManagedSync({sync,isUnavailable:error=>error instanceof YoutubeRssUnavailableError,
    store:createGithubHealthStore({repository:process.env.GITHUB_REPOSITORY,token:process.env.GITHUB_TOKEN,
      branch:branch==='main'?'automation/youtube-rss-health':'automation/youtube-rss-health-test'})}):await sync();
  if(managed){
    if(!process.env.GITHUB_OUTPUT||!process.env.GITHUB_STEP_SUMMARY)throw new Error('Managed RSS requires Actions output paths');
    await appendFile(process.env.GITHUB_OUTPUT,`available=${result.available}\nchanged=${result.changed}\nnotify=${result.notify}\n`);
    const summary=[
      '## YouTube RSS fetch status',
      `- Mode: ${branch==='main'?'production':'investigation (check only; no publication)'}`,
      `- Fetch: ${result.available?'available':'unavailable; existing videos retained'}`,
      `- Last successful fetch: ${result.state.lastSuccessAt??'none observed yet'}`,
      `- Hours without a successful fetch: ${(result.unavailableMs/3600000).toFixed(2)}`,
      `- Outage notification due: ${result.notify?'yes':'no'}`,
      `- Last notification marker: ${result.state.lastNotifiedAt??'none'}`,
      ...(result.state.lastError?[`- Fetch error: ${result.state.lastError}`]:[])
    ].join('\n')+'\n';
    await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
    console.log(summary);
  }
  if(!managed||result.available)console.log(`YouTube RSS: ${result.count} videos; ${result.changed?(check?'changes available (check only)':'updated'):'unchanged'}`);
}catch(error){
  console.error(`YouTube RSS processing failed: ${error.message}`);
  process.exitCode=1;
}
