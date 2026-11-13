// /line.html（X広告から公式LINEへの中継ページ）の「LINEアプリで開く」
// iPhone は href の https://line.me/... のまま開く（11/13 社長のiPhoneのXアプリで、line:// は反応なし、ページ内で line.me を押すとLINEアプリが一発で開いた）。
// Android だけ、押したときに intent でLINEアプリを直接呼ぶ。読み込んだ瞬間には飛ばさない。PCなどは href のまま。
// 押した数は click-tracking.js が href（https）と data-track-placement から数える（こちらより先に動く）。
const LINE_ID = '@683pdsif';

export function lineAppUrl(userAgent, platform = '', maxTouchPoints = 0) {
  const ua = String(userAgent || '');
  // iPhone・iPad（iPadOS はMacの顔をする）は https のまま開く
  if (/iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) return null;
  if (/Android/i.test(ua)) {
    return 'intent://ti/p/' + LINE_ID +
      '#Intent;scheme=line;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=jp.naver.line.android;end';
  }
  return null;
}

if (typeof document !== 'undefined') {
  const button = document.querySelector('[data-line-app]');
  const app = lineAppUrl(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  if (button && app) {
    button.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      window.location.href = app;
    });
  }
}
