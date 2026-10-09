import { topics,site } from '../lib/data.mjs';
export function GET(){
  const paths=['/','/topics.html','/faq.html','/archives.html','/viewing-guide.html',...topics.map(t=>`/topics/${t.slug}.html`)];
  const body='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(path=>'<url><loc>'+new URL(path,site.site).href+'</loc></url>').join('')+'</urlset>';
  return new Response(body,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
