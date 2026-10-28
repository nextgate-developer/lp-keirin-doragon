import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import configured from '../src/data/youtube.json' with {type:'json'};
import {CHANNEL_ID} from '../src/lib/youtube.mjs';
import {parseYoutubeFeed,fetchYoutube,syncYoutube} from '../scripts/lib/youtube-rss.mjs';

// Stable fixtures: future channel uploads must not change test assumptions.
const data={...configured,videos:Array.from({length:6},(_,i)=>({
  id:`sample0000${i}`,title:`Video ${i}`,publishedAt:`2026-10-${27-i}T09:00:00Z`,
  videoUrl:`https://www.youtube.com/shorts/sample0000${i}`,
  thumbnailUrl:`https://i1.ytimg.com/vi/sample0000${i}/hqdefault.jpg`
}))};
const entries=[...data.videos].reverse();
function feed(videos=entries){
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/"><yt:channelId>${CHANNEL_ID}</yt:channelId>${videos.map(v=>`<entry><yt:videoId>${v.id}</yt:videoId><title>${v.title.replaceAll('&','&amp;').replaceAll('<','&lt;')}</title><published>${v.publishedAt}</published><link rel="alternate" href="${v.videoUrl}"/><media:group><media:thumbnail url="${v.thumbnailUrl}"/></media:group></entry>`).join('')}</feed>`;
}
const ok=()=>new Response(feed());

test('RSS sorts latest six, excludes fixed PR and supports normal videos and escaped titles',()=>{
  const normal={...data.videos[0],videoUrl:`https://www.youtube.com/watch?v=${data.videos[0].id}`,title:'<script>alert(1)</script> & title'};
  const pr={...data.promotion,publishedAt:'2026-10-28T00:00:00Z'};
  const videos=parseYoutubeFeed(feed([...entries.slice(0,-1),normal,pr]),pr.id);
  assert.equal(videos.length,6);
  assert.equal(videos[0].id,normal.id);
  assert.equal(videos[0].title,normal.title);
  assert.ok(videos[0].videoUrl.includes('/watch?'));
  assert.ok(!videos.some(v=>v.id===pr.id));
});

test('malformed, empty, wrong-channel and unsafe RSS are rejected',()=>{
  assert.equal(parseYoutubeFeed(feed().replace(CHANNEL_ID,CHANNEL_ID.slice(2)),data.promotion.id).length,6);
  for(const xml of ['<feed>',feed([]),feed().replace(CHANNEL_ID,'wrong'),feed().replace('<feed ','<!DOCTYPE feed><feed '),feed([...entries,entries[0]]),feed().replace('https://i1.ytimg.com','https://evil.example'),feed().replace(entries[0].publishedAt,'invalid')]){
    assert.throws(()=>parseYoutubeFeed(xml,data.promotion.id));
  }
});

test('404 and invalid XML retry twice with backoff before success',async()=>{
  let calls=0;const waits=[];
  const result=await fetchYoutube(data,{fetchImpl:async()=>++calls===1?new Response('',{status:404}):calls===2?new Response('<broken>'):ok(),sleep:async ms=>waits.push(ms)});
  assert.equal(calls,3);assert.deepEqual(waits,[2000,4000]);assert.equal(result.length,6);
});

test('all failures preserve file bytes; no-op/check do not write; valid changes preserve PR',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'kd-youtube-'));const file=join(folder,'youtube.json');
  const original=JSON.stringify(data,null,2)+'\n';
  try{
    await writeFile(file,original);
    for(const failure of [async()=>new Response('',{status:404}),async()=>new Response(feed([])),async()=>{throw new DOMException('Timeout','TimeoutError');}]){
      let calls=0;
      await assert.rejects(syncYoutube(file,{fetchImpl:async()=>{calls++;return failure();},sleep:async()=>{}}));
      assert.equal(calls,3);assert.equal(await readFile(file,'utf8'),original);
    }
    assert.equal((await syncYoutube(file,{fetchImpl:async()=>ok()})).changed,false);
    assert.equal(await readFile(file,'utf8'),original);
    const changedFeed=()=>new Response(feed(entries.map((v,i)=>i? v:{...v,title:'Updated title'})));
    assert.equal((await syncYoutube(file,{check:true,fetchImpl:async()=>changedFeed()})).changed,true);
    assert.equal(await readFile(file,'utf8'),original);
    await syncYoutube(file,{fetchImpl:async()=>changedFeed()});
    const saved=JSON.parse(await readFile(file,'utf8'));
    assert.deepEqual(saved.promotion,data.promotion);assert.ok(saved.videos.some(v=>v.title==='Updated title'));
  }finally{await unlink(file);await rmdir(folder);}
});
