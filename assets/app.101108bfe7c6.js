try { window.KD_ARCHIVES = JSON.parse(document.getElementById("kd-archives-data").textContent); } catch (_) { window.KD_ARCHIVES = []; }
/* The notice reflects scheduled times; it does not detect actual live status. */
(function () {
  'use strict';
  const DAY_MS = 86400000;
  const JST_MS = 9 * 3600000;

  function parseIsoDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const utc = Date.UTC(year, month - 1, day);
    const check = new Date(utc);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    return { value, year, month, day, utc };
  }

  function parseClockRange(value) {
    if (typeof value !== 'string') return null;
    const match = value.match(/^\s*(\d{1,2}):(\d{2})\s*[〜～~–—-]\s*(\d{1,2}):(\d{2})\s*$/);
    if (!match) return null;
    const [startHour, startMinute, endHour, endMinute] = match.slice(1).map(Number);
    if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const overnight = endMinutes <= startMinutes;
    const pad = number => String(number).padStart(2, '0');
    return { startMinutes, endMinutes, overnight, text: `${pad(startHour)}:${pad(startMinute)}〜${overnight ? '翌' : ''}${pad(endHour)}:${pad(endMinute)}` };
  }

  function makeSession({ date, time, title, route, tentative = false }) {
    const day = parseIsoDay(date);
    const clock = parseClockRange(time);
    if (!day || !clock || typeof title !== 'string' || !title.trim() || typeof route !== 'string' || !/^topics\/[\p{L}\p{N}_.~-]+\.html$/u.test(route) || route.includes('..')) return null;
    return Object.freeze({
      date, time: clock.text, title: title.trim(), route: '#/' + route, tentative: Boolean(tentative),
      start: day.utc - JST_MS + clock.startMinutes * 60000,
      end: day.utc - JST_MS + clock.endMinutes * 60000 + (clock.overnight ? DAY_MS : 0),
    });
  }

  function readSessions(doc) {
    const sessions = [];
    for (const template of doc.querySelectorAll('template[data-route]')) {
      const route = template.dataset.route || '';
      if (!route.startsWith('topics/')) continue;
      const content = template.content;
      if (!content) continue;
      const title = content.querySelector('h1')?.textContent || '';
      const tentative = (content.querySelector('.schedule-timezone')?.textContent || '').includes('暫定');
      for (const item of content.querySelectorAll('.broadcast-schedule ol > li')) {
        const date = item.querySelector('.session-when time[datetime]')?.getAttribute('datetime');
        const time = item.querySelector('.session-time')?.textContent;
        const session = makeSession({ date, time, title, route, tentative });
        if (session) sessions.push(session);
      }
    }
    return sessions.sort((a, b) => a.start - b.start || a.end - b.end || a.route.localeCompare(b.route));
  }

  function selectSession(sessions, now) {
    if (!Number.isFinite(now)) return { phase: 'empty', session: null };
    const session = sessions.find(item => item.end > now);
    return session ? { phase: now < session.start ? 'upcoming' : 'scheduled-window', session } : { phase: 'empty', session: null };
  }

  function formatDay(value) {
    const day = parseIsoDay(value);
    if (!day) return '';
    return `${day.year}年${day.month}月${day.day}日（${'日月火水木金土'[new Date(day.utc).getUTCDay()]}）`;
  }

  function formatCountdown(start, now) {
    if (!Number.isFinite(start) || !Number.isFinite(now) || start <= now) return '';
    const total = Math.ceil((start - now) / 60000);
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const minutes = total % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}日`);
    if (days > 0 || hours > 0) parts.push(`${hours}時間`);
    parts.push(`${minutes}分`);
    return '開始予定まで ' + parts.join('');
  }

  function initialiseBroadcastNotice(root) {
    window.KD_BROADCAST_NOTICE?.destroy();
    const panel = root.querySelector('[data-next-live]');
    if (!panel) return function () {};
    const selectors = {
      label: '[data-next-live-label]', datetime: '[data-next-live-datetime]',
      date: '[data-next-live-date]', time: '[data-next-live-time]', zone: '[data-next-live-zone]',
      title: '[data-next-live-title]', countdown: '[data-next-live-countdown]',
      note: '[data-next-live-note]', link: '[data-next-live-link]',
    };
    const nodes = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, panel.querySelector(selector)]));
    if (Object.values(nodes).some(node => !node)) return function () {};
    const doc = root.ownerDocument || document;
    const sessions = readSessions(doc);
    const disposers = [];
    let timer = null;
    let disposed = false;
    let pageHidden = false;
    nodes.countdown.setAttribute('aria-live', 'off');

    function update() {
      if (disposed) return;
      const now = Date.now();
      const { phase, session } = selectSession(sessions, now);
      panel.dataset.nextLiveState = phase;
      nodes.title.hidden = false;
      if (!session) {
        nodes.label.textContent = '次回の配信予定';
        nodes.datetime.hidden = true;
        nodes.date.textContent = '';
        nodes.date.removeAttribute('datetime');
        nodes.time.textContent = '';
        nodes.zone.textContent = '';
        nodes.title.textContent = '次回の予定は準備中です。';
        nodes.countdown.textContent = '';
        nodes.countdown.hidden = true;
        nodes.note.textContent = '配信予定・トピック一覧をご確認ください。';
        nodes.link.setAttribute('href', '#/topics.html');
        nodes.link.textContent = '配信予定・トピック一覧を見る';
        return;
      }
      nodes.datetime.hidden = false;
      nodes.date.textContent = formatDay(session.date);
      nodes.date.setAttribute('datetime', session.date);
      nodes.time.textContent = session.time + (session.tentative ? '（暫定）' : '');
      nodes.zone.textContent = '日本時間';
      nodes.title.textContent = session.title;
      nodes.link.setAttribute('href', session.route);
      nodes.link.textContent = 'この配信の詳細を見る';
      if (phase === 'scheduled-window') {
        nodes.label.textContent = '配信予定の時間帯です';
        nodes.countdown.textContent = '';
        nodes.countdown.hidden = true;
        nodes.note.textContent = (session.tentative ? '開始・終了時刻は暫定です。' : '') + '実際の配信状況は視聴ページでご確認ください。';
      } else {
        nodes.label.textContent = '次回の配信予定';
        nodes.countdown.textContent = session.tentative ? '' : formatCountdown(session.start, now);
        nodes.countdown.hidden = session.tentative;
        nodes.note.textContent = session.tentative ? '開始時刻は暫定です。確定情報は配信予定・トピック一覧でご確認ください。' : '配信予定は変更になる場合があります。';
      }
    }
    function pause() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    }
    function resume() {
      if (disposed) return;
      pause();
      update();
      if (!pageHidden && doc.visibilityState !== 'hidden') timer = window.setInterval(update, 30000);
    }
    function listen(target, name, callback) {
      target.addEventListener(name, callback);
      disposers.push(() => target.removeEventListener(name, callback));
    }
    function destroy() {
      if (disposed) return;
      disposed = true;
      pause();
      for (const dispose of disposers.splice(0)) dispose();
      if (window.KD_BROADCAST_NOTICE === controller) window.KD_BROADCAST_NOTICE = null;
    }
    const controller = { destroy };
    window.KD_BROADCAST_NOTICE = controller;
    listen(doc, 'visibilitychange', () => doc.visibilityState === 'hidden' ? pause() : resume());
    listen(window, 'pagehide', () => { pageHidden = true; pause(); });
    listen(window, 'pageshow', () => { pageHidden = false; resume(); });
    resume();
    return destroy;
  }

  window.KD_BROADCAST = Object.freeze({ parseIsoDay, parseClockRange, makeSession, readSessions, selectSession, formatDay, formatCountdown, initialiseBroadcastNotice });
  window.initialiseBroadcastNotice = initialiseBroadcastNotice;
})();

(function (global) {
  'use strict';
  function publicVideoURL(value) {
    if (typeof value !== 'string' || value.trim() !== value || /[\u0000-\u0020]/.test(value)) return null;
    try {
      var url = new URL(value);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
      return url;
    } catch (_) { return null; }
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
  }
  function normaliseArchives(items) {
    if (!Array.isArray(items)) return [];
    var seen = new Set();
    return items.filter(function (item) {
      if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || seen.has(item.id)) return false;
      if (typeof item.title !== 'string' || !item.title.trim() || !validDate(item.publishedAt) || !publicVideoURL(item.videoUrl)) return false;
      seen.add(item.id); return true;
    }).slice().sort(function (a,b) { return b.publishedAt.localeCompare(a.publishedAt); });
  }
  function playerSource(value) {
    var url = publicVideoURL(value); if (!url) return null;
    var host = url.hostname.toLowerCase(), id;
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host)) {
      id = url.searchParams.get('v');
      if (!id) { var match = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/); id = match && match[1]; }
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return {type:'iframe',url:'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=0&rel=0'};
    if (['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)) {
      var vimeo = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/);
      if (vimeo) { var embed = new URL('https://player.vimeo.com/video/'+vimeo[1]); embed.searchParams.set('autoplay','0'); var hash=url.searchParams.get('h')||vimeo[2]; if(hash)embed.searchParams.set('h',hash); return {type:'iframe',url:embed.href}; }
    }
    if (/\.mp4$/i.test(url.pathname)) return {type:'video',url:url.href};
    return {type:'external',url:url.href};
  }
  function initialiseArchives(root) {
    var grid = root.querySelector('[data-archive-grid]'); if (!grid) return function(){};
    var items=normaliseArchives(global.KD_ARCHIVES), empty=root.querySelector('[data-archive-empty]'), count=root.querySelector('[data-archive-count]');
    grid.replaceChildren(); if(empty)empty.hidden=items.length>0;
    if(count){count.hidden=!items.length;count.textContent=items.length+'本の公開動画';}
    items.forEach(function(item){
      var card=document.createElement('article');card.className='archive-card';card.id='archive-'+item.id;
      var player=document.createElement('div');player.className='archive-player';
      var source=playerSource(item.videoUrl), button=document.createElement(source.type==='external'?'a':'button');
      button.className='archive-watch';button.textContent='この動画を見る';
      if(source.type==='external'){button.href=source.url;button.target='_blank';button.rel='noopener noreferrer';button.setAttribute('aria-label',item.title+'を見る（別タブ）');}
      else {button.type='button';button.setAttribute('aria-label',item.title+'のプレーヤーを開く');button.addEventListener('click',function(){
        var media=document.createElement(source.type==='video'?'video':'iframe');media.src=source.url;
        if(source.type==='video'){media.controls=true;media.preload='metadata';media.playsInline=true;media.setAttribute('aria-label',item.title);}
        else{media.title=item.title;media.allow='fullscreen; picture-in-picture';media.allowFullscreen=true;media.referrerPolicy='strict-origin-when-cross-origin';}
        player.replaceChildren(media);media.tabIndex=0;media.focus({preventScroll:true});
      },{once:true});}
      player.append(button);card.append(player);
      var body=document.createElement('div');body.className='archive-card-body';
      var date=document.createElement('time');date.dateTime=item.publishedAt;date.textContent=item.publishedAt.replace(/-/g,'/')+' 公開';body.append(date);
      var title=document.createElement('h2');title.textContent=item.title;body.append(title);
      if(typeof item.description==='string'&&item.description.trim()){var description=document.createElement('p');description.textContent=item.description;body.append(description);}
      var link=document.createElement('a');link.className='archive-original';link.href=item.videoUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='動画の公開元で見る（別タブ）';body.append(link);card.append(body);grid.append(card);
    });
    return function(){grid.querySelectorAll('video').forEach(function(video){video.pause();video.removeAttribute('src');video.load();});grid.querySelectorAll('iframe').forEach(function(frame){frame.src='about:blank';});};
  }
  global.KD_ARCHIVE_HELPERS={publicVideoURL:publicVideoURL,normaliseArchives:normaliseArchives,playerSource:playerSource};
  global.initialiseArchives=initialiseArchives;
})(window);

/* Standalone LP runtime. No login, analytics, payment or personal meeting URL. */
(function (global, doc) {
  'use strict';

  const defaults = {
    registration: null, live: null, line: null, events: null, movie: null,
    youtube: null, x: null, operator: null, terms: null, faq: null,
    privacy: null, commerce: null, disclaimer: null, previewMovie: null,
    support: ''
  };
  global.KD_LP_CONFIG = Object.assign({}, defaults, global.KD_LP_CONFIG || {});
  const templates = new Map();
  let mountedRoute = null;
  let routeDisposers = [];
  let root = null;
  let navigationFrame = null;

  function safeURL(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text || text === '#' || /[\u0000-\u0020\u007f\\]/.test(text)) return null;
    if (text.startsWith('#')) return text;
    if (/^https:\/\//i.test(text)) {
      try {
        const parsed = new URL(text);
        return parsed.protocol === 'https:' && parsed.hostname && !parsed.username && !parsed.password ? parsed.href : null;
      } catch (_) { return null; }
    }
    // The CMS may supply a same-site relative URL, but never a protocol-relative URL or executable scheme.
    if (text.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(text)) return null;
    try {
      const parsed = new URL(text, 'https://lp-relative.invalid/');
      return parsed.origin === 'https://lp-relative.invalid' ? text : null;
    } catch (_) { return null; }
  }

  function safeAssetPath(value) {
    if (typeof value !== 'string' || !/^assets\/[a-zA-Z\d_./%-]+$/.test(value)) return null;
    try {
      const decoded = decodeURIComponent(value);
      if (decoded.includes('\\') || /[\u0000-\u0020]/.test(decoded) || decoded.split('/').some(part => part === '..')) return null;
      return value;
    } catch (_) { return null; }
  }

  // Static image URLs are present in the HTML; no Base64 decoding or Blob allocation.
  function assetURL(value) { return safeAssetPath(value); }
  function hydrateAssets(scope) { /* Native src/srcset and CSS load assets progressively. */ }

  function bindLinks(scope) {
    for (const link of scope.querySelectorAll('[data-link]')) {
      const key = link.getAttribute('data-link');
      const configured = Object.prototype.hasOwnProperty.call(global.KD_LP_CONFIG, key) ? global.KD_LP_CONFIG[key] : null;
      let destination = safeURL(configured);
      if (key === 'support' && (!destination || !/^https:\/\//i.test(destination))) destination = null;
      if (destination) {
        link.removeAttribute('data-coming-soon');
        link.removeAttribute('aria-haspopup');
        link.removeAttribute('aria-controls');
        link.setAttribute('role', 'link');
        link.setAttribute('href', destination);
        link.removeAttribute('aria-disabled');
        link.removeAttribute('tabindex');
        if (link.hasAttribute('data-optional-link')) link.hidden = false;
        if (link.target === '_blank') link.setAttribute('rel', 'noopener noreferrer');
      } else if (['registration','live','line','events','movie','previewMovie','youtube','x'].includes(key)) {
        // The launch placeholder is a button; once configured it becomes a real link.
        link.removeAttribute('href');
        link.removeAttribute('aria-disabled');
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.setAttribute('data-coming-soon', key);
        link.setAttribute('aria-haspopup', 'dialog');
        link.setAttribute('aria-controls', 'coming-soon-dialog');
      } else {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('tabindex', '-1');
        if (link.hasAttribute('data-optional-link')) link.hidden = true;
      }
    }
  }

  function readArchives() {
    const node = doc.getElementById('kd-archives-data');
    if (!node) {
      if (!Array.isArray(global.KD_ARCHIVES)) global.KD_ARCHIVES = [];
      return;
    }
    try {
      const parsed = JSON.parse(node.textContent);
      global.KD_ARCHIVES = Array.isArray(parsed) ? parsed : [];
    } catch (_) { global.KD_ARCHIVES = []; }
  }

  function normaliseSearch(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim();
  }

  function matchesTopic(card, search, month, category) {
    const content = normaliseSearch(card.getAttribute('data-search') || card.textContent);
    const terms = normaliseSearch(search).split(/\s+/).filter(Boolean);
    const months = (card.getAttribute('data-months') || '').split(/\s+/);
    return terms.every(term => content.includes(term)) && (!month || months.includes(month)) &&
      (!category || card.getAttribute('data-category') === category);
  }

  function initialiseTopicFilters(scope) {
    const form = scope.querySelector('[data-topic-filters]');
    if (!form) return function () {};
    const cards = Array.from(scope.querySelectorAll('[data-topic-card]'));
    const count = scope.querySelector('[data-topic-count]');
    const empty = scope.querySelector('[data-no-results]');
    let resetTimer = null;
    function apply() {
      let visible = 0;
      const search = form.elements.namedItem('search').value;
      const month = form.elements.namedItem('month').value;
      const category = form.elements.namedItem('category').value;
      for (const card of cards) {
        const match = matchesTopic(card, search, month, category);
        card.hidden = !match;
        if (match) visible += 1;
      }
      if (count) count.textContent = visible + '件のトピック';
      if (empty) empty.hidden = visible !== 0;
    }
    function submit(event) { event.preventDefault(); apply(); }
    function reset() {
      global.clearTimeout(resetTimer);
      resetTimer = global.setTimeout(apply, 0); // Native form reset runs after its event listeners.
    }
    form.hidden = false;
    form.addEventListener('input', apply);
    form.addEventListener('change', apply);
    form.addEventListener('submit', submit);
    form.addEventListener('reset', reset);
    apply();
    return function () {
      global.clearTimeout(resetTimer);
      form.removeEventListener('input', apply);
      form.removeEventListener('change', apply);
      form.removeEventListener('submit', submit);
      form.removeEventListener('reset', reset);
    };
  }

  function initialiseMotion(scope) {
    const media = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const targets = Array.from(scope.querySelectorAll('[data-attention]'));
    const timers = new Map();
    const played = new WeakSet();
    const revealed = new WeakSet();
    const activeAnimations = new Set();
    const revealTargets = Array.from(scope.querySelectorAll([
      '.masthead', '.hero-headline', '.topics-panel', '.about-panel',
      '.live>h2', '.live-dragon', '.daily-heading', '.live-description',
      '.more>h2', '.community-grid>.content-card', '.movie-card',
      '.people-heading', '.people>.person', '.registration>h2', '.gifts', '.footer-charm'
    ].join(',')));
    let observer = null;
    let revealObserver = null;
    let destroyed = false;
    function stop() {
      if (observer) observer.disconnect();
      observer = null;
      if (revealObserver) revealObserver.disconnect();
      revealObserver = null;
      activeAnimations.forEach(animation => animation.cancel());
      activeAnimations.clear();
      timers.forEach(timer => global.clearTimeout(timer));
      timers.clear();
      targets.forEach(node => node.classList.remove('attention-active'));
    }
    function play(node) {
      if (destroyed || played.has(node) || (media && media.matches)) return;
      played.add(node);
      node.classList.add('attention-active');
      timers.set(node, global.setTimeout(function () { node.classList.remove('attention-active'); timers.delete(node); }, 5000));
    }
    function refresh() {
      stop();
      if (destroyed || (media && media.matches) || typeof global.IntersectionObserver !== 'function') return;
      observer = new global.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            play(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.35 });
      targets.forEach(node => { if (!played.has(node)) observer.observe(node); });
      // Animate only after intersection; source content remains visible if this enhancement is unavailable.
      revealObserver = new global.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          const node = entry.target;
          if (!entry.isIntersecting || revealed.has(node)) return;
          revealed.add(node);
          revealObserver.unobserve(node);
          if (typeof node.animate !== 'function') return;
          const baseTransform = global.getComputedStyle(node).transform;
          const transform = baseTransform === 'none' ? '' : baseTransform;
          const index = node.classList.contains('content-card') && node.parentElement ? Array.from(node.parentElement.children).indexOf(node) : 0;
          const animation = node.animate([
            { opacity: 0.35, transform: 'translateY(20px) ' + transform },
            { opacity: 1, transform: transform || 'none' }
          ], { duration: 650, delay: Math.min(index, 2) * 110, easing: 'cubic-bezier(.2,.7,.25,1)', iterations: 1 });
          activeAnimations.add(animation);
          animation.onfinish = function () { activeAnimations.delete(animation); };
          animation.oncancel = function () { activeAnimations.delete(animation); };
        });
      }, { threshold: 0.05 });
      revealTargets.forEach(node => { if (!revealed.has(node)) revealObserver.observe(node); });
    }
    if (media && media.addEventListener) media.addEventListener('change', refresh);
    refresh();
    const controller = { destroy: function () {
      destroyed = true;
      stop();
      if (media && media.removeEventListener) media.removeEventListener('change', refresh);
      if (global.KD_LP_MOTION === controller) global.KD_LP_MOTION = null;
    } };
    global.KD_LP_MOTION = controller;
    return controller.destroy;
  }

  function initialiseFloatingDock(scope) {
    const dock = scope.querySelector('[data-floating-dock]');
    const page = scope.querySelector('[data-floating-page]') || scope.querySelector('.lp');
    const heroCTA = scope.querySelector('.trial-offer--hero') || scope.querySelector('.hero-cta');
    const finalCTA = scope.querySelector('.trial-offer--final') || scope.querySelector('.registration-cta');
    const contentTrigger = scope.querySelector('[data-floating-trigger]');
    if (!dock || !page) return function () {};
    const alwaysVisible = dock.dataset.floatingMode === 'always';
    if (!alwaysVisible && (!heroCTA || !finalCTA)) return function () {};
    let frame = null;
    let destroyed = false;
    let observer = null;
    let resizeObserver = null;
    const disposers = [];
    page.setAttribute('data-floating-registration', '');
    function listen(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      disposers.push(() => target.removeEventListener(name, handler, options));
    }
    function measure() {
      const height = dock.getBoundingClientRect().height;
      if (height > 0) {
        const value = Math.ceil(height) + 'px';
        if (page.style.getPropertyValue('--kd-floating-measured-height') !== value) page.style.setProperty('--kd-floating-measured-height', value);
      }
    }
    function update() {
      frame = null;
      if (destroyed) return;
      const viewport = global.visualViewport;
      const top = viewport ? viewport.offsetTop : 0;
      const bottom = top + (viewport ? viewport.height : global.innerHeight);
      const hero = heroCTA ? heroCTA.getBoundingClientRect() : null;
      const final = finalCTA ? finalCTA.getBoundingClientRect() : null;
      const finalVisible = final && final.top < bottom && final.bottom > top;
      const trigger = contentTrigger ? contentTrigger.getBoundingClientRect() : null;
      const contentReached = trigger && trigger.top <= top + (bottom - top) * 0.5;
      const heroPassed = hero && hero.bottom <= top;
      const show = Boolean(alwaysVisible || ((heroPassed || contentReached) && !finalVisible));
      if (dock.hidden === show) dock.hidden = !show;
      if (show) measure();
    }
    function schedule() {
      if (!destroyed && frame === null) frame = global.requestAnimationFrame(update);
    }
    listen(global, 'scroll', schedule, { passive: true });
    listen(global, 'resize', schedule, { passive: true });
    listen(scope, 'load', schedule, true);
    if (global.visualViewport) {
      listen(global.visualViewport, 'resize', schedule, { passive: true });
      listen(global.visualViewport, 'scroll', schedule, { passive: true });
    }
    if (typeof global.IntersectionObserver === 'function') {
      observer = new global.IntersectionObserver(schedule, { threshold: [0, 1] });
      if (heroCTA) observer.observe(heroCTA);
      if (finalCTA) observer.observe(finalCTA);
      if (contentTrigger) observer.observe(contentTrigger);
    }
    if (typeof global.ResizeObserver === 'function') {
      resizeObserver = new global.ResizeObserver(schedule);
      resizeObserver.observe(dock);
      resizeObserver.observe(page);
    }
    schedule();
    const controller = { destroy: function () {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) global.cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      disposers.splice(0).forEach(dispose => dispose());
      dock.hidden = true;
      page.removeAttribute('data-floating-registration');
      page.style.removeProperty('--kd-floating-measured-height');
      if (global.KD_FLOATING_REGISTRATION === controller) global.KD_FLOATING_REGISTRATION = null;
    } };
    global.KD_FLOATING_REGISTRATION = controller;
    return controller.destroy;
  }

  function decodeFragment(value) {
    try { return decodeURIComponent(value); } catch (_) { return ''; }
  }

  function routeForHash(hash) {
    if (hash.startsWith('#/')) {
      const remainder = hash.slice(2);
      const splitAt = remainder.indexOf('#');
      const route = decodeFragment(splitAt < 0 ? remainder : remainder.slice(0, splitAt)) || 'index.html';
      const anchor = splitAt < 0 ? '' : decodeFragment(remainder.slice(splitAt + 1));
      return { route, anchor };
    }
    return { route: mountedRoute || 'index.html', anchor: hash.startsWith('#') ? decodeFragment(hash.slice(1)) : '' };
  }

  function focusElement(element) {
    if (!element) return;
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
  }

  function moveToLocation(anchor, focusHeading, routeChanged) {
    if (navigationFrame !== null) global.cancelAnimationFrame(navigationFrame);
    navigationFrame = global.requestAnimationFrame(function () {
      navigationFrame = null;
      if (anchor) {
        const target = doc.getElementById(anchor);
        if (target && root.contains(target)) {
          target.scrollIntoView({ block: 'start', behavior: 'instant' });
          if (focusHeading) focusElement(target);
          return;
        }
      }
      if (routeChanged && focusHeading) {
        global.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        focusElement(root.querySelector('h1') || root.querySelector('main'));
      }
    });
  }

  function addModule(initialiser) {
    if (typeof initialiser !== 'function') return;
    try {
      const result = initialiser(root);
      if (typeof result === 'function') routeDisposers.push(result);
      else if (result && typeof result.destroy === 'function') routeDisposers.push(() => result.destroy());
    } catch (_) {
      // A failed optional enhancement must not remove the source content or stop routing.
      root.dataset.enhancementState = 'partial';
    }
  }

  function cleanupRoute() {
    routeDisposers.splice(0).reverse().forEach(dispose => { try { dispose(); } catch (_) { /* Continue independent cleanup. */ } });
  }

  function render(options) {
    const settings = options || {};
    const location = routeForHash(global.location.hash || '');
    const requestedRoute = location.route;
    const route = templates.has(requestedRoute) ? requestedRoute : 'index.html';
    const template = templates.get(route);
    if (!template || !root) return;
    const changed = route !== mountedRoute;
    if (changed || settings.force) {
      cleanupRoute();
      const keepInitialContent = root.dataset.prerenderRoute === route && !settings.force;
      if (!keepInitialContent) root.replaceChildren(template.content.cloneNode(true));
      delete root.dataset.prerenderRoute;
      delete root.dataset.enhancementState;
      root.dataset.route = route;
      if (route !== requestedRoute) root.dataset.routeFallback = requestedRoute;
      else delete root.dataset.routeFallback;
      doc.title = template.getAttribute('data-title') || '競輪ドラゴン';
      doc.body.className = template.getAttribute('data-body-class') || '';
      mountedRoute = route;
      hydrateAssets(root);
      bindLinks(root);
      addModule(initialiseTopicFilters);
      addModule(initialiseMotion);
      addModule(initialiseFloatingDock);
      addModule(global.initialiseBroadcastNotice);
      addModule(global.initialiseArchives);
    }
    moveToLocation(location.anchor, Boolean(settings.focusHeading), changed || settings.force);
  }

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest ? event.target.closest('a') : null;
    if (!link || !root.contains(link)) return;
    if (link.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#') || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    if (href === '#') { event.preventDefault(); return; }
    event.preventDefault();
    // Keep route identity when a section/skip link is used on a secondary page.
    const next = href.startsWith('#/') ? href : '#/' + (mountedRoute || 'index.html') + href;
    if (global.location.hash === next) {
      render({ focusHeading: true, force: false });
      if (next.indexOf('#', 1) < 0) {
        global.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        focusElement(root.querySelector('h1') || root.querySelector('main'));
      }
    } else global.location.hash = next;
  }

  function start() {
    root = doc.getElementById('preview-root');
    if (!root) return;
    doc.querySelectorAll('template[data-route]').forEach(template => templates.set(template.getAttribute('data-route'), template));
    // Capture the already-visible homepage once; editors maintain only one homepage in index.html.
    const homeTemplate = doc.createElement('template');
    homeTemplate.setAttribute('data-title', '競輪ドラゴン｜めちゃ×2競輪がくわしくなるオンラインサロン');
    homeTemplate.setAttribute('data-body-class', '');
    root.childNodes.forEach(node => homeTemplate.content.appendChild(node.cloneNode(true)));
    templates.set('index.html', homeTemplate);
    readArchives();
    render({ focusHeading: false });
    doc.addEventListener('click', onClick);
    global.addEventListener('hashchange', () => render({ focusHeading: true }));
  }

  global.KD_LP_RUNTIME = Object.freeze({
    safeURL, safeAssetPath, assetURL, hydrateAssets, bindLinks, normaliseSearch,
    matchesTopic, routeForHash, render, initialiseTopicFilters, initialiseFloatingDock
  });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window, document);

/* Unprepared destinations: retain visible labels and open one shared dismissible notice. */
(function () {
  'use strict';
  const dialog = document.getElementById('coming-soon-dialog');
  if (!dialog) return;
  function closeNotice() { if (dialog.open) dialog.close(); }
  document.addEventListener('click', function (event) {
    const trigger = event.target.closest('[data-coming-soon]');
    if (!trigger) return;
    event.preventDefault();
    if (typeof dialog.showModal !== 'function') { window.alert('Coming soon'); return; }
    if (!dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('kd-coming-soon-open');
    }
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const trigger = event.target.closest('a[data-coming-soon][role="button"]');
    if (!trigger || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    trigger.click();
  });
  dialog.querySelector('[data-coming-soon-close]').addEventListener('click', closeNotice);
  dialog.addEventListener('click', function (event) {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeNotice();
  });
  dialog.addEventListener('close', function () { document.documentElement.classList.remove('kd-coming-soon-open'); });
  window.addEventListener('hashchange', closeNotice);
})();
