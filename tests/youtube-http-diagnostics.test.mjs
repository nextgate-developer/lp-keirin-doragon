import test from 'node:test';
import assert from 'node:assert/strict';
import {captureResponse,summarizeResponse} from '../scripts/lib/youtube-http-diagnostics.mjs';

test('HTTP failure evidence retains status, headers and HTML, excluding credentials',async()=>{
  const report=await captureResponse(new Response('<title>Error 404 (Not Found)!!1</title>',{
    status:404,headers:{server:'gse','content-type':'text/html','set-cookie':'secret',authorization:'secret','retry-after':'60'}
  }),'https://www.youtube.com/feeds/videos.xml');
  assert.equal(report.status,404);
  assert.equal(report.headers.server,'gse');
  assert.equal(report.headers['retry-after'],'60');
  assert.equal(report.headers['set-cookie'],undefined);
  assert.equal(report.headers.authorization,undefined);
  assert.match(report.body,/Error 404/);
  assert.equal(report.isFeed,false);
});

test('capture is bounded and cancels an oversized response stream',async()=>{
  let cancelled=false;
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(65536).fill(65));},cancel(){cancelled=true;}});
  const report=await captureResponse(new Response(stream,{status:500}),'https://example.com');
  assert.equal(report.body.length,32768);
  assert.equal(report.truncated,true);
  assert.equal(cancelled,true);
});

test('Atom returned with 404 is recorded as 404, not converted to success',()=>{
  const report=summarizeResponse({url:'https://example.com',status:404,headers:{},body:'<feed><entry/></feed>'});
  assert.equal(report.status,404);
  assert.equal(report.isFeed,true);
  assert.match(report.sampleSha256,/^[a-f0-9]{64}$/);
});
