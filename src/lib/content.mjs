import fs from 'node:fs';
import path from 'node:path';
export function assembleContent({site,topics,faq,archives}) {
  topics=[...topics].sort((a,b)=>String(a.sessions?.[0]?.startsAt||'').localeCompare(String(b.sessions?.[0]?.startsAt||'')));
  return {site,topics,faq,archives,
    featured:topics.filter(t=>t.featuredOrder!==null).sort((a,b)=>a.featuredOrder-b.featuredOrder),
    months:[...new Set(topics.flatMap(t=>(Array.isArray(t.sessions)?t.sessions:[]).flatMap(s=>typeof s.startsAt==='string'?[s.startsAt.slice(0,7)]:[])))].sort(),
    categories:[...new Set(topics.map(t=>t.category))],
  };
}
export function loadContent(directory='src/data') {
  const data=path.resolve(directory);
  const read=file=>JSON.parse(fs.readFileSync(path.join(data,file),'utf8'));
  return assembleContent({site:read('site.json'),faq:read('faq.json'),archives:read('archives.json'),
    topics:fs.readdirSync(path.join(data,'topics')).filter(x=>x.endsWith('.json')).map(file=>read('topics/'+file)),
  });
}
