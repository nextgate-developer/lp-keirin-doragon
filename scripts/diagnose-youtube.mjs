import {execFileSync} from 'node:child_process';
import {CHANNEL_ID,FEED_URL} from '../src/lib/youtube.mjs';

const urls=[FEED_URL,FEED_URL.replace('www.youtube.com','www.youtube.com').replace('/feeds/videos.xml','/feeds/videos.xml/'),FEED_URL.replace('www.youtube.com','youtube.com'),`https://www.youtube.com/feeds/videos.xml?playlist_id=UU${CHANNEL_ID.slice(2)}`];
console.log(JSON.stringify({node:process.version,platform:process.platform}));
for(const url of urls){
  for(const client of ['fetch','curl']){
    try{
      let status,body,type;
      if(client==='fetch'){
        const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'follow'});
        status=response.status;type=response.headers.get('content-type');body=await response.text();
      }else{
        const output=execFileSync(process.platform==='win32'?'curl.exe':'curl',['-L','--max-time','15','-sS','-A','Mozilla/5.0','-w','\nSTATUS:%{http_code} TYPE:%{content_type}',url],{encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024});
        const match=output.match(/\nSTATUS:(\d+) TYPE:([^\n]*)$/);
        status=Number(match?.[1]);type=match?.[2];body=output.slice(0,match?.index);
      }
      console.log(JSON.stringify({client,url,status,type,feed:body.includes('<feed'),entries:(body.match(/<entry>/g)||[]).length,channel:body.match(/<yt:channelId>([^<]+)/)?.[1],errorTitle:body.match(/<title>([^<]+)/)?.[1]?.slice(0,120)}));
    }catch(error){console.log(JSON.stringify({client,url,error:error.message.slice(0,200)}));}
  }
}
