import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MS,recordFetchResult,runManagedSync,validateHealth} from '../scripts/lib/youtube-health.mjs';
import {createGithubHealthStore} from '../scripts/lib/youtube-health-store.mjs';
import {YoutubeRssUnavailableError} from '../scripts/lib/youtube-rss.mjs';

const start=Date.parse('2026-11-01T00:00:00Z');
const at=hours=>new Date(start+hours*3600000);
const record=(previous,hours,available=false)=>recordFetchResult(previous,{now:at(hours),available,error:'RSS HTTP 404'});

test('six-hour failures notify at the 24-hour boundary and only once in a rolling day',()=>{
  let state=record(null,0,true).state;
  for(const hours of [6,12,18,24,30,36,42,48]){
    const result=record(state,hours);
    assert.equal(result.notify,[24,48].includes(hours),`hour ${hours}`);
    state=result.state;
  }
});

test('unchanged videos still reset fetch health; recovery and another outage respect the alert cooldown',()=>{
  let state=record(null,0,true).state;
  state=record(state,24).state;
  state=record(state,25,true).state;
  assert.equal(record(state,48).notify,false);
  assert.equal(record(state,49).notify,true);
});

test('first deployment with no history starts a full observation period, not a false outage',()=>{
  const initial=record(null,0);
  assert.equal(initial.notify,false);
  assert.equal(initial.state.lastSuccessAt,null);
  assert.equal(recordFetchResult(initial.state,{available:false,now:new Date(start+DAY_MS-1)}).notify,false);
  assert.equal(record(initial.state,24).notify,true);
});

test('delayed runs and manual reruns do not create duplicate outage notifications',()=>{
  let state=record(null,0,true).state;
  const first=record(state,27);assert.equal(first.notify,true);state=first.state;
  for(const hours of [27,27.01,30,48,50.999])assert.equal(record(state,hours).notify,false);
  assert.equal(record(state,51).notify,true);
});

test('managed sync persists no-change successes and notification markers before returning',async()=>{
  let state=null,saves=0;
  const store={load:async()=>state,save:async value=>{state=structuredClone(value);saves++;}};
  const isUnavailable=error=>error instanceof YoutubeRssUnavailableError;
  const healthy=await runManagedSync({store,sync:async()=>({changed:false,count:6}),isUnavailable,now:()=>at(0)});
  assert.equal(healthy.available,true);assert.equal(healthy.changed,false);assert.equal(saves,1);
  const down=await runManagedSync({store,sync:async()=>{throw new YoutubeRssUnavailableError('RSS HTTP 404');},isUnavailable,now:()=>at(24)});
  assert.equal(down.notify,true);assert.equal(down.available,false);assert.equal(down.changed,false);
  assert.equal(state.lastNotifiedAt,at(24).toISOString());
});

test('programming errors, corrupt state and persistence failures remain hard failures',async()=>{
  const store={load:async()=>null,save:async()=>assert.fail('must not save programming failures')};
  await assert.rejects(runManagedSync({store,sync:async()=>{throw new TypeError('bug');},isUnavailable:()=>false}),/bug/);
  assert.throws(()=>validateHealth({version:1}),/Invalid RSS health/);
  const state=record(null,1,true).state;
  assert.throws(()=>record(state,0),/clock moved backwards/);
  await assert.rejects(runManagedSync({store:{load:async()=>null,save:async()=>{throw new Error('storage down');}},
    sync:async()=>({changed:false,count:6}),isUnavailable:()=>false,now:()=>at(0)}),/storage down/);
});

test('GitHub state initializes a state-only branch and updates using the existing file SHA',async()=>{
  const state=record(null,0,true).state,calls=[];
  let created=false;
  const fetchImpl=async(url,options)=>{
    const body=options.body?JSON.parse(options.body):undefined;
    calls.push({url,method:options.method,body});
    if(url.includes('/git/ref/'))return created?Response.json({object:{sha:'commit'}}):new Response('',{status:404});
    if(url.endsWith('/git/trees'))return Response.json({sha:'tree',tree:[{path:'state.json',sha:'file1'}]});
    if(url.endsWith('/git/commits'))return Response.json({sha:'commit'});
    if(url.endsWith('/git/refs')){created=true;return Response.json({ref:'state'});}
    if(options.method==='PUT')return Response.json({content:{sha:'file2'}});
    return Response.json({encoding:'base64',sha:'file1',content:Buffer.from(JSON.stringify(state)).toString('base64')});
  };
  const store=createGithubHealthStore({repository:'owner/repo',branch:'automation/youtube-rss-health-test',token:'test-token',fetchImpl});
  assert.equal(await store.load(),null);await store.save(state);
  assert.deepEqual(calls.find(c=>c.url.endsWith('/git/commits')).body.parents,[]);
  assert.equal(calls.find(c=>c.url.endsWith('/git/trees')).body.tree.length,1);
  assert.deepEqual(await store.load(),state);
  await store.save(record(state,6).state);
  const update=calls.find(c=>c.method==='PUT');assert.equal(update.body.sha,'file1');assert.equal(update.body.branch,'automation/youtube-rss-health-test');
});

test('GitHub storage permission or corrupt-file errors are not treated as missing history',async()=>{
  const config={repository:'owner/repo',branch:'automation/youtube-rss-health-test',token:'test'};
  await assert.rejects(createGithubHealthStore({...config,fetchImpl:async()=>new Response('',{status:403})}).load(),/HTTP 403/);
  await assert.rejects(createGithubHealthStore({...config,fetchImpl:async url=>url.includes('/git/ref/')?Response.json({object:{sha:'x'}}):new Response('',{status:404})}).load(),/HTTP 404/);
});
