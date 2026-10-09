import { site } from '../lib/data.mjs';
export function GET(){return new Response(`User-agent: *\nAllow: /\nSitemap: ${site.site}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});}
