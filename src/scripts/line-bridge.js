// /line.html（X広告から公式LINEへの中継ページ）の「LINEアプリで開く」
// Xなどのアプリ内ブラウザで line.me を開くとQRの画面で止まるので、押したときだけLINEアプリを直接呼ぶ。
// 読み込んだ瞬間には飛ばさない。PCなどは href の https://line.me/... のまま開く。
// 押した数は click-tracking.js が href（https）と data-track-placement から数える（こちらより先に動く）。
const LINE_ID = '@683pdsif';

export function lineAppUrl(userAgent, platform = '', maxTouchPoints = 0) {
  const ua = String(userAgent || '');
  // iPadOS のSafariはMacの顔をするので、タッチ操作の有無で見分ける
  if (/iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'line://ti/p/' + LINE_ID;
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
