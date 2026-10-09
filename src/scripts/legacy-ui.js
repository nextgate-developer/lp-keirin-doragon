(function(global,doc){
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

  function bindLinks(scope) {
    const config=global.KD_LP_CONFIG||{};
    for (const link of scope.querySelectorAll('[data-link]')) {
      const key = link.getAttribute('data-link');
      const configured = Object.prototype.hasOwnProperty.call(config, key) ? config[key] : null;
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


function start(){bindLinks(doc);initialiseTopicFilters(doc);initialiseMotion(doc);initialiseFloatingDock(doc);}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window,document);
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
