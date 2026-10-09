import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { topics,faq,site,featured } from '../src/lib/data-node.mjs';
import { displayTime,sessionDay,allSessions } from '../src/lib/schedule.mjs';
const routes=['index.html','topics.html','faq.html','archives.html','viewing-guide.html',...topics.map(t=>'topics/'+t.slug+'.html')];
for(const route of routes){
  const html=fs.readFileSync('dist/'+route,'utf8'),$=load(html);
  assert.ok($('h1').length||route==='index.html',route+': heading missing');
  assert.ok($('title').text().trim(),route+': title missing');
  assert.ok($('meta[name="description"]').attr('content'),route+': description missing');
  assert.equal($('link[rel="canonical"]').attr('href'),new URL(route==='index.html'?'/':'/'+route,site.site).href);
  for(const name of ['og:title','og:description','og:url','og:image'])assert.ok($(`meta[property="${name}"]`).attr('content'),route+': '+name);
  assert.equal($('template[data-route]').length,0,route+': legacy templates remain');
  const ids=$('[id]').toArray().map(el=>$(el).attr('id'));
  assert.equal(new Set(ids).size,ids.length,route+': duplicate HTML ids');
  assert.ok(fs.existsSync(path.join('dist',new URL($('meta[property="og:image"]').attr('content')).pathname)),route+': OGP image missing');
  for(const el of $('[srcset]').toArray())for(const item of $(el).attr('srcset').split(',')){
    const asset=item.trim().split(/\s+/)[0];
    assert.ok(fs.existsSync(path.join('dist',asset)),route+': missing responsive image '+asset);
  }
  for(const el of $('[src],a[href]').toArray()){
    const value=$(el).attr('src')||$(el).attr('href');
    assert.ok(!value.startsWith('#/'),route+': old internal link remains');
    if(!value.startsWith('/'))continue;
    const local=value.split(/[?#]/)[0];
    assert.ok(fs.existsSync(path.join('dist',local==='/'?'index.html':local)),route+': missing '+local);
  }
}
const home=load(fs.readFileSync('dist/index.html','utf8'));
const list=load(fs.readFileSync('dist/topics.html','utf8'));
assert.equal(list('[data-topic-card]').length,topics.length);
assert.deepEqual(JSON.parse(home('#kd-sessions-data').text()),allSessions(topics));
for(const topic of topics){
  const detail=load(fs.readFileSync('dist/topics/'+topic.slug+'.html','utf8'));
  const card=list(`[data-topic-card]`).filter((_,el)=>list(el).find('h2 a').attr('href')==='/topics/'+topic.slug+'.html');
  assert.equal(detail('.broadcast-schedule li').length,topic.sessions.length);
  for(const [i,s] of topic.sessions.entries()){
    const row=detail('.broadcast-schedule li').eq(i);
    assert.equal(row.find('time').attr('datetime'),sessionDay(s));assert.equal(row.find('.session-time').text(),displayTime(s));
    if(s.guest)assert.equal(row.find('.session-guest strong').text(),s.guestLabel||'ゲスト',topic.slug+': guest label changed');
    assert.ok(card.find('time').toArray().some(el=>list(el).attr('datetime')===sessionDay(s)));
    assert.ok(card.text().includes(displayTime(s)));assert.ok(card.attr('data-search').includes(s.guest));
  }
  if(featured.includes(topic)){
    const teaser=home(`.topic-teasers a[href="/topics/${topic.slug}.html"]`);
    assert.ok(teaser.length);assert.ok(teaser.find('.teaser-time').text().includes(displayTime(topic.sessions[0])));
  }
}
assert.equal(load(fs.readFileSync('dist/faq.html','utf8'))('.faq-item').length,faq.reduce((n,g)=>n+g.questions.length,0));
assert.equal((fs.readFileSync('dist/sitemap.xml','utf8').match(/<loc>/g)||[]).length,routes.length);
assert.equal(load(fs.readFileSync('dist/archives.html','utf8'))('.archive-grid').length,1);
assert.equal(load(fs.readFileSync('dist/404.html','utf8'))('meta[name="robots"]').attr('content'),'noindex,follow');
console.log(`Generated HTML verified: ${routes.length} routes, ${topics.length} topics, all session displays and metadata.`);
