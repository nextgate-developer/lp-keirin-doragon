import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { topics } from '../src/lib/data-node.mjs';
import { allSessions } from '../src/lib/schedule.mjs';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.pdf':'application/pdf'};
let servingDirectory='dist';
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const legacy=pathname.startsWith('/legacy/');
  const root=path.resolve(legacy?'.':servingDirectory);
  const relative=legacy?pathname.slice(8):pathname.slice(1);
  const file=path.resolve(root,relative||'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
fs.mkdirSync('test-results',{recursive:true});
try{
  for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.clock.setFixedTime(new Date('2026-10-06T12:00:00+09:00'));
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
    const open=async route=>{await page.goto(base+route);await page.waitForLoadState('networkidle');};
    const checkWidth=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow at '+width+' '+page.url());
    await open('/');
    await checkWidth();
    assert.ok((await page.locator('[data-next-live-label]').textContent())?.includes('次回'));
    assert.equal(await page.locator('[data-link="registration"]').first().getAttribute('href'),'https://line.me/R/ti/p/%40683pdsif');
    const current=await page.locator('.hero').boundingBox();
    await page.screenshot({path:`test-results/home-${width}.png`,fullPage:true});
    await page.locator('.hero').screenshot({path:`test-results/hero-${width}.png`});
    await page.locator('.about-panel').screenshot({path:`test-results/about-${width}.png`});
    await page.locator('[data-coming-soon="events"]').click();
    await page.locator('#coming-soon-dialog').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#coming-soon-dialog').evaluate(el=>el.open),false);
    assert.equal(await page.evaluate(()=>(window.dataLayer||[]).filter(item=>item?.event?.startsWith('kd_')).length),0,'localhost must not emit tracking events');
    await open('/legacy/');
    const original=await page.locator('.hero').boundingBox();
    assert.ok(Math.abs(current.width-original.width)<1&&Math.abs(current.height-original.height)<1,'hero dimensions changed');
    await page.screenshot({path:`test-results/legacy-home-${width}.png`,fullPage:true});
    const sessions=allSessions(topics),first=sessions[0];
    for(const [time,state] of [[first.start-1,'upcoming'],[first.start,'scheduled-window'],[first.end,'upcoming'],[sessions.at(-1).end,'empty']]){
      await page.clock.setFixedTime(new Date(time));await open('/');
      assert.equal(await page.locator('[data-next-live]').getAttribute('data-next-live-state'),state);
    }
    await page.clock.setFixedTime(new Date('2026-10-06T12:00:00+09:00'));
    await open('/topics.html');await checkWidth();
    await page.locator('input[name="search"]').fill('平原康多');
    assert.ok(await page.locator('[data-topic-card]:visible').count()>0);
    await page.locator('input[name="search"]').fill('存在しないテスト検索');
    assert.equal(await page.locator('[data-topic-card]:visible').count(),0);
    assert.equal(await page.locator('[data-no-results]').isVisible(),true);
    await page.locator('button[type="reset"]').click();
    await page.waitForFunction(n=>document.querySelectorAll('[data-topic-card]:not([hidden])').length===n,topics.length);
    assert.equal(await page.locator('[data-topic-card]:visible').count(),topics.length);
    await page.screenshot({path:`test-results/topics-${width}.png`,fullPage:true});
    await open('/topics/'+topics[0].slug+'.html');await checkWidth();await page.reload();
    assert.equal(await page.locator('.broadcast-schedule li').count(),topics[0].sessions.length);
    await page.screenshot({path:`test-results/detail-${width}.png`,fullPage:true});
    await open('/#/topics/'+topics[0].slug+'.html');
    await page.waitForURL('**/topics/'+topics[0].slug+'.html');
    await open('/#/faq.html#faq-q-22');await page.waitForURL('**/faq.html#faq-q-22');
    await checkWidth();
    await page.locator('#faq-q-22 summary').click();
    assert.ok((await page.locator('#faq-q-22').textContent()).includes('American Express'));
    await page.screenshot({path:`test-results/faq-${width}.png`,fullPage:true});
    for(const route of ['/archives.html','/viewing-guide.html']){await open(route);await checkWidth();}
    assert.deepEqual(errors,[],`browser errors at ${width}`);
    await page.close();
  }
  // Render the local build under the production hostname, without contacting GTM/GA4.
  // Block actual navigation after a click so we can inspect the queued dataLayer event.
  for(const width of [390,1440]){
    const origin='https://lp.keirin-dragon.com';
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==origin||['image','font','media'].includes(request.resourceType()))return route.abort();
      const root=path.resolve('dist'),file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Not found'});
      return route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
    });
    await context.addInitScript(()=>document.addEventListener('click',event=>{
      if(event.target.closest('a[href]'))event.preventDefault();
    }));
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-06T12:00:00+09:00'));
    const open=async route=>{await page.goto(origin+route);await page.waitForLoadState('networkidle');};
    const events=()=>page.evaluate(()=>(window.dataLayer||[]).filter(item=>item?.event?.startsWith('kd_')));
    const check=async(selector,name,placement,target,type,extra={})=>{
      const before=(await events()).length;
      await page.locator(selector).first().click();
      await page.waitForFunction(n=>(window.dataLayer||[]).filter(item=>item?.event?.startsWith('kd_')).length===n,before+1);
      const event=(await events()).at(-1);
      assert.equal(event.event,'kd_'+name);assert.equal(event.kd_placement,placement);
      assert.equal(event.kd_target,target);assert.equal(event.kd_destination_type,type);
      for(const [key,value] of Object.entries(extra))assert.equal(event[key],value);
      if(type==='coming_soon'){
        assert.equal(await page.locator('#coming-soon-dialog').evaluate(el=>el.open),true);
        await page.keyboard.press('Escape');
      }
    };
    await open('/?email=not-collected@example.com#not-collected');
    await check('.hero-cta .cta-label','registration_click','hero','registration','external');
    assert.equal((await events()).at(-1).kd_page_path,'/');
    assert.ok(!JSON.stringify(await events()).includes('not-collected'));
    await check('.registration-cta .cta-label','registration_click','bottom_registration','registration','external');
    await check('.live-cta .live-play','live_click','live_section','live','external');
    await check('.content-card-line .content-card-label','line_click','contents_cards','line','external');
    await check('.social-link[data-link="line"]','line_click','footer_sns','line','external');
    await check('.social-link[data-link="youtube"]','sns_click','footer_sns','youtube','external');
    await check('.social-link[data-link="x"]','sns_click','footer_sns','x','external');
    await check('.content-card-event .content-card-label','content_click','contents_cards','events','coming_soon');
    await check('.movie-card-watch','content_click','contents_movie','movie','coming_soon');
    await check('.movie-teaser-link','content_click','contents_preview','previewMovie','coming_soon');
    await check('.topic-button','schedule_click','top_topics','topics','internal');
    await check('.live-schedule-link','schedule_click','live_section','topics','internal');
    await check('.topic-teasers li:first-child a','topic_click','top_topics','topic','internal',{kd_topic_slug:topics[0].slug});
    await check('[data-next-live-link]','topic_click','next_live','topic','internal',{kd_topic_slug:topics[0].slug});
    await check('.footer-faq-link','faq_click','footer_nav','faq','internal');
    const beforeLegal=(await events()).length;
    await page.locator('.footer-nav-link[href$="terms-20261005.pdf"]').click();
    assert.equal((await events()).length,beforeLegal,'low-priority PDF excluded');
    await open('/topics.html');
    await check('.floating-registration-cta .cta-label','registration_click','floating','registration','external');
    await check('.topic-list-card h2 a','topic_click','topic_list','topic','internal',{kd_topic_slug:topics[0].slug});
    await check('.article-more','topic_click','topic_list','topic','internal',{kd_topic_slug:topics[0].slug});
    await open('/faq.html');
    const beforeFaq=(await events()).length;
    await page.locator('#faq-q-22 summary').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(n=>(window.dataLayer||[]).filter(item=>item?.event==='kd_faq_open').length===n,beforeFaq+1);
    const faqEvent=(await events()).at(-1);
    assert.equal(faqEvent.kd_faq_number,22);assert.equal(faqEvent.kd_placement,'faq_question');
    assert.equal(faqEvent.kd_faq_category,await page.locator('#faq-q-22').evaluate(el=>el.closest('.faq-group').id));
    await page.keyboard.press('Enter');await page.waitForTimeout(50);
    assert.equal((await events()).length,beforeFaq+1,'closing FAQ must not emit an event');
    await page.locator('#faq-q-22 summary').click();
    await page.waitForFunction(n=>(window.dataLayer||[]).filter(item=>item?.event==='kd_faq_open').length===n,beforeFaq+2);
    await check('.faq-related a[href="/viewing-guide.html"]','viewing_guide_click','faq_related','viewing_guide','internal');
    assert.equal((await events()).at(-1).kd_faq_number,'','FAQ context must not leak into the next click');
    await open('/viewing-guide.html');
    await check('.service-register','registration_click','service_registration','registration','external');
    await open('/archives.html');
    await check('.service-register','registration_click','service_registration','registration','external');
    await check('.service-nav a[href="/viewing-guide.html"]','viewing_guide_click','service_nav','viewing_guide','internal');
    assert.deepEqual(errors,[],`tracking errors at ${width}`);
    await context.close();
  }
  const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await nojs.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await nojs.goto(base+'/faq.html');assert.equal(await nojs.locator('.faq-item').count(),33);
  await nojs.goto(base+'/topics/'+topics[0].slug+'.html');assert.equal(await nojs.locator('.broadcast-schedule li').count(),topics[0].sessions.length);
  await nojs.close();
  if(fs.existsSync('test-results/propagation-latest.json')){
    servingDirectory=JSON.parse(fs.readFileSync('test-results/propagation-latest.json','utf8')).output;
    assert.ok(path.resolve(servingDirectory).startsWith(path.resolve('test-results')+path.sep));
    const archivePage=await browser.newPage();
    const videoRequests=[];
    await archivePage.route('**/*',route=>{
      if(route.request().url().startsWith(base))return route.continue();
      videoRequests.push(route.request().url());return route.abort();
    });
    await archivePage.goto(base+'/archives.html');await archivePage.waitForLoadState('networkidle');
    assert.equal(await archivePage.locator('.archive-card').count(),1);
    assert.equal(await archivePage.locator('.archive-player iframe').count(),0);
    assert.deepEqual(videoRequests,[]);
    await archivePage.locator('.archive-watch').click();
    assert.equal(await archivePage.locator('.archive-player iframe').getAttribute('src'),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0');
    await archivePage.close();
  }
  console.log('Browser checks passed: 390/1440px, original hero geometry, direct access/reload, old links, search, FAQ, dialog, assets, no-JS body and all medium-priority tracking events (one push per action, local disabled, FAQ keyboard/close and privacy checks).');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
