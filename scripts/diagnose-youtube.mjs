import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FEED_URL,UPLOADS_FEED_URL} from '../src/lib/youtube.mjs';
import {captureResponse,summarizeResponse,saveDiagnostic} from './lib/youtube-http-diagnostics.mjs';

const accept='application/atom+xml, application/xml';
const probes=[['channel',FEED_URL],['uploads',UPLOADS_FEED_URL],
  ['no-www redirect comparison',FEED_URL.replace('www.youtube.com','youtube.com')],
  ['negative control: trailing slash',FEED_URL.replace('/feeds/videos.xml','/feeds/videos.xml/')]];
console.log(JSON.stringify({node:process.version,platform:process.platform,at:new Date().toISOString()}));
for(const [probe,url] of probes){
  for(const client of ['fetch','curl']){
    let report;
    try{
      if(client==='fetch'){
        const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'follow',headers:{Accept:accept}});
        report={...await captureResponse(response,url),effectiveUrl:response.url,redirected:response.redirected};
      }else{
        const directory=await mkdtemp(join(tmpdir(),'youtube-http-'));
        const headerFile=join(directory,'headers.txt'),bodyFile=join(directory,'body.txt');
        try{
          const output=execFileSync(process.platform==='win32'?'curl.exe':'curl',[
            '-L','--max-time','15','--max-filesize','1048576','-sS','-H',`Accept: ${accept}`,'-A','Mozilla/5.0',
            '-D',headerFile,'-o',bodyFile,'-w','%{json}',url
          ],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
          const metadata=JSON.parse(output);
          const blocks=(await readFile(headerFile,'utf8')).trim().split(/\r?\n\r?\n/);
          const headers=new Headers();
          for(const line of blocks.at(-1).split(/\r?\n/).slice(1)){
            const colon=line.indexOf(':');
            if(colon>0)headers.append(line.slice(0,colon),line.slice(colon+1).trim());
          }
          report=summarizeResponse({url,status:metadata.http_code,headers,body:await readFile(bodyFile,'utf8'),
            connection:{remoteIp:metadata.remote_ip,httpVersion:metadata.http_version,effectiveUrl:metadata.url_effective,
              redirects:metadata.num_redirects,dnsSeconds:metadata.time_namelookup,connectSeconds:metadata.time_connect,
              tlsSeconds:metadata.time_appconnect,firstByteSeconds:metadata.time_starttransfer,totalSeconds:metadata.time_total}});
        }finally{
          await Promise.all([headerFile,bodyFile].map(file=>unlink(file).catch(()=>{})));
          await rmdir(directory);
        }
      }
    }catch(error){report={url,at:new Date().toISOString(),error:error.message.slice(0,500)};}
    report={...report,probe,client,platform:process.platform,request:{accept,userAgent:client==='curl'?'Mozilla/5.0':'Node fetch default'}};
    await saveDiagnostic(report);
    console.log(JSON.stringify({...report,body:report.status>=400?report.body?.slice(0,4096):'[feed saved in artifact]'}));
  }
}
