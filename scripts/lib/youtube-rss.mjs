import {load} from 'cheerio';
import {XMLValidator} from 'fast-xml-parser';
import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {CHANNEL_ID,validateVideo,validateYoutube} from '../../src/lib/youtube.mjs';

const MAX_BYTES=1024*1024;
export const RSS_RETRY_DELAYS_MS=Object.freeze([60000,180000,300000]);
export const RSS_REQUEST_TIMEOUT_MS=15000;

export function parseYoutubeFeed(xml,promotionId){
  if(Buffer.byteLength(xml)>MAX_BYTES||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw new Error('Invalid RSS XML');
  const $=load(xml,{xmlMode:true});
  const feed=$('feed');
  // YouTube's Atom feed currently omits the UC prefix used in its channel URL.
  const channel=feed.children('yt\\:channelId').text().trim();
  if(feed.length!==1||![CHANNEL_ID,CHANNEL_ID.slice(2)].includes(channel))throw new Error('Unexpected RSS channel');
  const ids=new Set();
  const videos=feed.children('entry').toArray().map(entry=>{
    const node=$(entry);
    const video={
      id:node.children('yt\\:videoId').text().trim(),
      title:node.children('title').text().trim(),
      publishedAt:node.children('published').text().trim(),
      videoUrl:node.children('link[rel="alternate"]').attr('href'),
      thumbnailUrl:node.find('media\\:thumbnail').first().attr('url')
    };
    validateVideo(video);
    if(ids.has(video.id))throw new Error('Duplicate RSS entry');
    ids.add(video.id);
    video.publishedAt=new Date(video.publishedAt).toISOString();
    return video;
  }).filter(video=>video.id!==promotionId).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,6);
  if(!videos.length)throw new Error('RSS has no usable videos');
  return videos;
}

async function readBounded(response){
  if(Number(response.headers.get('content-length'))>MAX_BYTES)throw new Error('RSS response too large');
  const chunks=[];
  let size=0;
  for await(const chunk of response.body){
    size+=chunk.byteLength;
    if(size>MAX_BYTES)throw new Error('RSS response too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchYoutube(data,{fetchImpl=fetch,sleep=delay,onRetry=()=>{}}={}){
  validateYoutube(data);
  for(let attempt=0;attempt<=RSS_RETRY_DELAYS_MS.length;attempt++){
    try{
      const response=await fetchImpl(data.sourceUrl,{signal:AbortSignal.timeout(RSS_REQUEST_TIMEOUT_MS),redirect:'error',headers:{Accept:'application/atom+xml, application/xml'}});
      if(!response.ok){await response.body?.cancel();throw new Error(`RSS HTTP ${response.status}`);}
      return parseYoutubeFeed(await readBounded(response),data.promotion.id);
    }catch(error){
      if(attempt===RSS_RETRY_DELAYS_MS.length)throw error;
      const waitMs=RSS_RETRY_DELAYS_MS[attempt];
      onRetry(attempt+1,error,{waitMs,maxRetries:RSS_RETRY_DELAYS_MS.length});
      await sleep(waitMs);
    }
  }
}

export async function syncYoutube(file,{check=false,now=()=>new Date(),...options}={}){
  if(file instanceof URL)file=fileURLToPath(file);
  const original=await readFile(file,'utf8');
  const data=validateYoutube(JSON.parse(original));
  const videos=await fetchYoutube(data,options);
  // Normalize timestamps before comparison to avoid a commit for formatting alone.
  const previous=data.videos.map(video=>({...video,publishedAt:new Date(video.publishedAt).toISOString()}));
  const changed=JSON.stringify(videos)!==JSON.stringify(previous);
  if(!changed||check)return {changed,count:videos.length};
  const updated=validateYoutube({...data,mode:'rss',snapshotDate:now().toISOString().slice(0,10),videos});
  const temporary=`${file}.${randomUUID()}.tmp`;
  try{
    await writeFile(temporary,JSON.stringify(updated,null,2)+'\n',{flag:'wx'});
    await rename(temporary,file);
  }finally{
    await rm(temporary,{force:true});
  }
  return {changed,count:videos.length};
}
