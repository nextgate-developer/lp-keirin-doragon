import {execFileSync} from 'node:child_process';
import {lookup} from 'node:dns/promises';
import https from 'node:https';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {FEED_URL} from '../src/lib/youtube.mjs';
import {summarizeResponse,saveDiagnostic} from './lib/youtube-http-diagnostics.mjs';

// Diagnostic only: DNS pinning retains the original hostname, TLS verification and SNI.
// It is not a production failover strategy and never changes video data.
const executable=process.platform==='win32'?'curl.exe':'curl';
const version=execFileSync(executable,['--version'],{encoding:'utf8'});
const supportsH2=/^Features:.*\bHTTP2\b/m.test(version);
const addresses=[...new Set((await lookup('www.youtube.com',{all:true,family:4})).map(item=>item.address))].slice(0,2);
const headers={Accept:'application/atom+xml, application/xml','User-Agent':'node','Accept-Encoding':'identity',Connection:'close'};
const started=Date.now();
console.log(JSON.stringify({kind:'controlled setup',at:new Date().toISOString(),platform:process.platform,addresses,supportsH2,curl:version.split('\n')[0]}));

async function curlProbe(ip,variant){
  const directory=await mkdtemp(join(tmpdir(),'youtube-controlled-'));
  const headerFile=join(directory,'headers.txt'),bodyFile=join(directory,'body.txt');
  try{
    const args=['--max-time','10','--max-filesize','1048576','--compressed','-sS',
      '--resolve',`www.youtube.com:443:${ip}`,variant.http==='2'?'--http2':'--http1.1',
      '-H',`Accept: ${headers.Accept}`,'-H',`Accept-Encoding: ${variant.encoding}`,
      '-H','Connection: close','-A',variant.ua,'-D',headerFile,'-o',bodyFile,'-w','%{json}',FEED_URL];
    const metadata=JSON.parse(execFileSync(executable,args,{encoding:'utf8',timeout:12000,maxBuffer:1024*1024}));
    const blocks=(await readFile(headerFile,'utf8')).trim().split(/\r?\n\r?\n/);
    const responseHeaders=new Headers();
    for(const line of blocks.at(-1).split(/\r?\n/).slice(1)){
      const colon=line.indexOf(':');
      if(colon>0)responseHeaders.append(line.slice(0,colon),line.slice(colon+1).trim());
    }
    return summarizeResponse({url:FEED_URL,status:metadata.http_code,headers:responseHeaders,body:await readFile(bodyFile,'utf8'),
      connection:{remoteIp:metadata.remote_ip,httpVersion:metadata.http_version,firstByteSeconds:metadata.time_starttransfer,totalSeconds:metadata.time_total}});
  }finally{
    await Promise.all([headerFile,bodyFile].map(file=>unlink(file).catch(()=>{})));
    await rmdir(directory);
  }
}

function nativeProbe(ip,url=FEED_URL){
  return new Promise((resolve,reject)=>{
    const request=https.get(url,{headers,agent:false,family:4,autoSelectFamily:false,lookup:(_hostname,_options,callback)=>callback(null,ip,4)},response=>{
      const chunks=[];let size=0;
      response.on('error',reject);
      response.on('data',chunk=>{
        size+=chunk.length;
        if(size>1024*1024){response.destroy(new Error('Response too large'));return;}
        chunks.push(chunk);
      });
      response.on('end',()=>resolve(summarizeResponse({url,status:response.statusCode,headers:response.headers,
        body:Buffer.concat(chunks).toString('utf8'),connection:{remoteIp:response.socket?.remoteAddress,httpVersion:response.httpVersion}})));
    });
    const timer=setTimeout(()=>request.destroy(new Error('10s request deadline')),10000);
    request.on('error',reject);
    request.on('close',()=>clearTimeout(timer));
  });
}

const variants=[
  {label:'baseline',ua:'node',encoding:'identity',http:'1.1'},
  {label:'UA only',ua:'Mozilla/5.0',encoding:'identity',http:'1.1'},
  {label:'encoding only',ua:'node',encoding:'gzip, deflate',http:'1.1'},
  ...(supportsH2?[{label:'HTTP version only',ua:'node',encoding:'identity',http:'2'}]:[]),
  {label:'client only',ua:'node',encoding:'identity',http:'1.1',native:true}
];
const results=[];
outer:for(let round=1;round<=2;round++){
  for(const ip of addresses){
    // Reverse order in round 2 to reduce the chance that time/order looks like a header effect.
    for(const variant of round===1?variants:[...variants].reverse()){
      if(Date.now()-started>180000){console.log('Controlled diagnostic stopped at 180s budget');break outer;}
      let report;
      try{report=await(variant.native?nativeProbe(ip):curlProbe(ip,variant));}
      catch(error){report={url:FEED_URL,error:error.message.slice(0,300),at:new Date().toISOString()};}
      report={...report,kind:'controlled',round,requestedIp:ip,variant:variant.label,platform:process.platform,
        request:{client:variant.native?'node:https':'curl',ua:variant.ua,encoding:variant.encoding,http:variant.http}};
      await saveDiagnostic(report);
      const {body,...summary}=report;
      results.push(summary);
      console.log(JSON.stringify(summary));
      await delay(500);
    }
  }
}
await saveDiagnostic({kind:'controlled results',platform:process.platform,results});

// A public channel ID from Google's own example, independent of Keirin Dragon:
// https://developers.google.com/youtube/data/getting-started
const referenceUrl='https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw';
for(const url of [FEED_URL,referenceUrl,FEED_URL,referenceUrl]){
  if(Date.now()-started>180000)break;
  let report;
  try{report=await nativeProbe(addresses[0],url);}
  catch(error){report={url,error:error.message.slice(0,300)};}
  report={...report,kind:'cross-channel',platform:process.platform,requestedIp:addresses[0]};
  await saveDiagnostic(report);
  const {body,...summary}=report;
  console.log(JSON.stringify(summary));
  await delay(500);
}
