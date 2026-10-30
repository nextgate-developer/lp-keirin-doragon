import {syncYoutube} from './lib/youtube-rss.mjs';

try{
  if(process.argv.slice(2).some(arg=>arg!=='--check'))throw new Error('Supported option: --check');
  const check=process.argv.includes('--check');
  const result=await syncYoutube(new URL('../src/data/youtube.json',import.meta.url),{
    check,onSourceFailure:(url,error)=>console.warn(`RSS source failed (${new URL(url).searchParams.has('playlist_id')?'uploads':'channel'}): ${error.message}`),
    onRetry:(retry,error,{waitMs,maxRetries})=>console.warn(`RSS retry ${retry}/${maxRetries} in ${waitMs/1000}s: ${error.message}`)
  });
  console.log(`YouTube RSS: ${result.count} videos; ${result.changed?(check?'changes available (check only)':'updated'):'unchanged'}`);
}catch(error){
  console.error(`YouTube RSS failed; existing data retained: ${error.message}`);
  process.exitCode=1;
}
