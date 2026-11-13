import test from 'node:test';
import assert from 'node:assert/strict';
import { lineAppUrl } from '../src/scripts/line-bridge.js';

const iphoneX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/11.30';
const androidX = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 TwitterAndroid';
const pc = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';

test('LINE bridge keeps https on iPhone and uses intent on Android', () => {
  assert.equal(lineAppUrl(iphoneX, 'iPhone', 5), null);
  assert.equal(lineAppUrl(mac, 'MacIntel', 5), null, 'iPadOS reports a Mac user agent');
  assert.equal(lineAppUrl(androidX, 'Linux armv8l', 5),
    'intent://ti/p/@683pdsif#Intent;scheme=line;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=jp.naver.line.android;end');
});

test('LINE bridge leaves PCs on the https link', () => {
  assert.equal(lineAppUrl(pc, 'Win32', 0), null);
  assert.equal(lineAppUrl(mac, 'MacIntel', 0), null);
  assert.equal(lineAppUrl(''), null);
});
