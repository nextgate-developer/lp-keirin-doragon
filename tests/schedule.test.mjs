import test from 'node:test';
import assert from 'node:assert/strict';
import { topics,faq,archives,site } from '../src/lib/data-node.mjs';
import { validateContent } from '../src/lib/validation.mjs';
import { allSessions,selectSession,displayTime } from '../src/lib/schedule.mjs';
import { legacyDestination } from '../src/scripts/legacy-links.js';
test('current data: every session is counted with a valid timestamp',()=>{
  const stats=validateContent({topics,faq,archives,site});
  assert.equal(allSessions(topics).length,stats.sessions);
  assert.ok(stats.sessions>0);assert.ok(allSessions(topics).every(s=>Number.isFinite(s.start)));
});
test('JST start/end boundaries, next session and all ended',()=>{
  const s=allSessions(topics),first=s[0];
  assert.equal(first.start,Date.parse(topics[0].sessions[0].startsAt));
  assert.equal(selectSession(s,first.start-1).phase,'upcoming');
  assert.equal(selectSession(s,first.start).phase,'scheduled-window');
  assert.equal(selectSession(s,first.end-1).session,first);
  assert.notEqual(selectSession(s,first.end).session,first);
  assert.equal(selectSession(s,s.at(-1).end).phase,'empty');
});
test('tentative and overnight sessions preserve semantics',()=>{
  const overnight={startsAt:'2026-10-08T23:30:00+09:00',endsAt:'2026-10-09T01:00:00+09:00',approximate:true};
  assert.equal(displayTime(overnight),'23:30頃〜翌01:00頃');
  const s=allSessions([{...topics[0],tentative:true,sessions:[overnight]}]);
  assert.equal(s[0].end-s[0].start,90*60000);assert.equal(s[0].tentative,true);
});
test('invalid calendar days, overlapping sessions and FAQ duplicates fail build',()=>{
  const data=()=>structuredClone({topics,faq,archives,site});
  let d=data();d.topics[0].sessions[0].startsAt='2026-02-30T21:30:00+09:00';assert.throws(()=>validateContent(d),/startsAt/);
  d=data();d.topics[0].sessions[0].endsAt=d.topics[0].sessions[0].startsAt;assert.throws(()=>validateContent(d),/after/);
  d=data();d.faq[0].questions.push(d.faq[0].questions[0]);assert.throws(()=>validateContent(d),/duplicate/);
});
test('old routes and FAQ anchor work; unknown or external routes are rejected',()=>{
  const routes=['/','/faq.html','/topics/'+topics[0].slug+'.html'];
  assert.equal(legacyDestination('#/faq.html#faq-q-22',routes),'/faq.html#faq-q-22');
  assert.equal(legacyDestination('#/index.html#about',routes),'/#about');
  assert.equal(legacyDestination('#/topics/'+topics[0].slug+'.html',routes),routes[2]);
  assert.equal(legacyDestination('#/https://example.com',routes),null);
  assert.equal(legacyDestination('#/unknown.html',routes),null);
});
