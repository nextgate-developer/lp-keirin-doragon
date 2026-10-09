// Site-side GTM integration only. GA4 forwarding is configured in the GTM container.
const trackedKeys = {
  registration: 'registration_click', live: 'live_click', line: 'line_click',
  events: 'content_click', movie: 'content_click', previewMovie: 'content_click',
  youtube: 'sns_click', x: 'sns_click',
};
const trackedPaths = {
  '/topics.html': ['schedule_click', 'topics'],
  '/faq.html': ['faq_click', 'faq'],
  '/viewing-guide.html': ['viewing_guide_click', 'viewing_guide'],
};
const mounted = new WeakMap();

export function isProductionHost(location) {
  return location.hostname === 'lp.keirin-dragon.com';
}

export function classifyClick({ key, pathname, internal }) {
  if (Object.hasOwn(trackedKeys, key)) return { name: trackedKeys[key], target: key };
  if (!internal) return null;
  if (Object.hasOwn(trackedPaths, pathname)) {
    const [name, target] = trackedPaths[pathname];
    return { name, target };
  }
  const topic = pathname.match(/^\/topics\/([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/);
  return topic ? { name: 'topic_click', target: 'topic', topicSlug: topic[1] } : null;
}

export function payloadFor(action, pagePath, placement, destinationType) {
  // Reset every field on every push: GTM must not reuse a previous topic/FAQ value.
  // Do not collect query strings, URL fragments, free text or personal identifiers.
  return {
    event: 'kd_' + action.name,
    kd_tracking_version: 1,
    kd_page_path: pagePath === '/index.html' ? '/' : pagePath.split(/[?#]/)[0],
    kd_placement: placement,
    kd_target: action.target,
    kd_destination_type: destinationType,
    kd_topic_slug: action.topicSlug || '',
    kd_faq_number: action.faqNumber || '',
    kd_faq_category: action.faqCategory || '',
  };
}

function placementFor(element) {
  const explicit = element.closest('[data-track-placement]');
  if (explicit) return explicit.dataset.trackPlacement;
  for (const [selector, placement] of [
    ['.floating-registration', 'floating'], ['.hero', 'hero'],
    ['.social-link', 'footer_sns'], ['.registration', 'bottom_registration'],
    ['.service-trial-offer', 'service_registration'],
    ['.community-grid', 'contents_cards'], ['.movie-card', 'contents_movie'],
    ['.movie-teaser-link', 'contents_preview'], ['[data-next-live]', 'next_live'],
    ['.live', 'live_section'], ['.topics-home', 'top_topics'],
    ['.topic-list-card', 'topic_list'], ['.breadcrumbs', 'breadcrumbs'],
    ['.topic-detail', 'topic_detail'], ['.faq-related', 'faq_related'],
    ['.service-nav', 'service_nav'], ['.footer-nav', 'footer_nav'],
    ['.service-help', 'viewing_help'],
  ]) {
    if (element.closest(selector)) return placement;
  }
  return 'page_content';
}

export function mountTracking(doc, location, emit) {
  if (mounted.has(doc)) return mounted.get(doc);
  const safelyEmit = payload => {
    try { emit(payload); } catch { /* Analytics must never prevent navigation or a dialog. */ }
  };
  const click = event => {
    if (event.button !== undefined && event.button !== 0) return;
    const element = event.target?.closest?.('a,button');
    if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return;
    const key = element.getAttribute('data-link');
    const href = element.getAttribute('href');
    const pending = element.hasAttribute('data-coming-soon');
    if (!pending && !href) return;
    let destination;
    try { destination = href ? new URL(href, location.href) : null; } catch { return; }
    if (destination && !['https:', 'http:'].includes(destination.protocol)) return;
    const internal = destination?.origin === location.origin;
    const action = classifyClick({ key, pathname: destination?.pathname || '', internal });
    if (!action) return;
    const type = pending ? 'coming_soon' : internal ? 'internal' : 'external';
    safelyEmit(payloadFor(action, location.pathname, placementFor(element), type));
  };
  const toggle = event => {
    const item = event.target;
    if (!item.matches?.('details.faq-item') || !item.open) return;
    const number = Number(item.dataset.faqNumber);
    if (!Number.isInteger(number) || number < 1) return;
    safelyEmit(payloadFor({ name: 'faq_open', target: 'faq_question', faqNumber: number,
      faqCategory: item.closest('.faq-group')?.id || '' }, location.pathname, 'faq_question', 'expand'));
  };
  doc.addEventListener('click', click, true);
  doc.addEventListener('toggle', toggle, true);
  const unmount = () => {
    doc.removeEventListener('click', click, true);
    doc.removeEventListener('toggle', toggle, true);
    mounted.delete(doc);
  };
  mounted.set(doc, unmount);
  return unmount;
}

if (typeof window !== 'undefined' && isProductionHost(window.location)) {
  mountTracking(document, window.location, payload => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  });
}
