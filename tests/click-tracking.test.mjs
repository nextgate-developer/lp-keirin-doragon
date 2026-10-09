import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyClick, payloadFor, isProductionHost, mountTracking } from '../src/scripts/click-tracking.js';

test('registration/live/LINE remain distinct despite one shared destination', () => {
  const actions = ['registration', 'live', 'line'].map(key => classifyClick({ key, pathname: '/R/ti/p/', internal: false }));
  assert.deepEqual(actions.map(a => a.name), ['registration_click', 'live_click', 'line_click']);
});
test('medium-priority paths and placeholders are included, legal/archive/default navigation excluded', () => {
  for (const path of ['/topics.html', '/faq.html', '/viewing-guide.html', '/topics/2026-10-21-kumamoto.html']) {
    assert.ok(classifyClick({ pathname: path, internal: true }));
  }
  for (const key of ['events', 'movie', 'previewMovie', 'youtube', 'x']) assert.ok(classifyClick({ key, internal: false }));
  for (const path of ['/', '/archives.html', '/assets/pdf/terms-20261005.pdf']) assert.equal(classifyClick({ pathname: path, internal: true }), null);
  assert.equal(classifyClick({ pathname: '/faq.html', internal: false }), null);
});
test('payload clears optional data and omits query strings and fragments', () => {
  const payload = payloadFor({ name: 'registration_click', target: 'registration' }, '/topics.html?email=private@example.com#secret', 'hero', 'external');
  assert.equal(payload.event, 'kd_registration_click');assert.equal(payload.kd_page_path, '/topics.html');
  assert.equal(payload.kd_topic_slug, '');assert.equal(payload.kd_faq_number, '');assert.equal(payload.kd_faq_category, '');
  assert.ok(!JSON.stringify(payload).includes('private'));assert.ok(!JSON.stringify(payload).includes('secret'));
  assert.equal(payloadFor({name:'faq_open',target:'faq_question',faqNumber:22,faqCategory:'faq-category-4'},'/faq.html','faq_question','expand').kd_faq_number,22);
});
test('local previews do not send tracking; repeated mounting does not duplicate listeners', () => {
  for (const hostname of ['localhost','127.0.0.1','preview.example.com']) assert.equal(isProductionHost({hostname}), false);
  assert.equal(isProductionHost({hostname:'lp.keirin-dragon.com'}), true);
  const listeners = [];
  const doc = {addEventListener:(...args)=>listeners.push(args),removeEventListener:()=>{}};
  const cleanup = mountTracking(doc, {}, () => {});
  assert.equal(mountTracking(doc, {}, () => {}),cleanup);assert.equal(listeners.length,2);
  cleanup();mountTracking(doc, {}, () => {});assert.equal(listeners.length,4);
});
