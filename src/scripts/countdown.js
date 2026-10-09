import { selectSession } from '../lib/schedule.mjs';
const parseIsoDay=value=>{const date=new Date(value+'T00:00:00Z');return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate(),utc:date.getTime()};};
const readSessions=doc=>JSON.parse(doc.getElementById('kd-sessions-data').textContent);
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
        nodes.link.setAttribute('href', '/topics.html');
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


initialiseBroadcastNotice(document);
