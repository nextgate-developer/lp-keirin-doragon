import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export function summarizeResponse({url,status,headers,body,truncated=false,...extra}){
  const safeHeaders=Object.fromEntries([...new Headers(headers)].filter(([key])=>!['set-cookie','cookie','authorization','proxy-authorization'].includes(key)).map(([key,value])=>[key,value.slice(0,4096)]));
  return {...extra,at:new Date().toISOString(),url,status,headers:safeHeaders,
    body:body.slice(0,32768),truncated:truncated||body.length>32768,
    sampleSha256:createHash('sha256').update(body.slice(0,32768)).digest('hex'),
    isFeed:/<feed[\s>]/.test(body),entries:(body.match(/<entry[\s>]/g)||[]).length,
    title:body.match(/<title[^>]*>([^<]*)/i)?.[1]?.slice(0,200)};
}

export async function captureResponse(response,url){
  const chunks=[];let bytes=0,truncated=false;
  if(response.body){
    const reader=response.body.getReader();
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        const remaining=32768-bytes;
        chunks.push(value.slice(0,remaining));bytes+=Math.min(value.length,remaining);
        if(value.length>remaining||bytes===32768){truncated=true;await reader.cancel();break;}
      }
    }finally{reader.releaseLock();}
  }
  return summarizeResponse({url,status:response.status,headers:response.headers,body:Buffer.concat(chunks).toString('utf8'),truncated});
}

export async function saveDiagnostic(report,directory='test-results/youtube-http'){
  await mkdir(directory,{recursive:true});
  await writeFile(join(directory,`${Date.now()}-${randomUUID()}.json`),JSON.stringify(report,null,2)+'\n');
}
