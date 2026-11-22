// Operator sign-in gate on the dashboard. The real dashboard files are served from frontend/;
// only the API replies are stubbed (the C++ checks are covered by tests/api/operator_auth_test.py).
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {extname, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png'};
const firebase = {projectId: 'pluggo-test', apiKey: 'AIza-not-a-real-key', authDomain: 'pluggo-test.firebaseapp.com', appId: '1:1:web:1'};

async function open(browser, {required, signedIn = false}) {
  const page = await browser.newPage({viewport: {width: 1280, height: 860}});
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const calls = [];
  await page.route('http://pluggo.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      calls.push({path: url.pathname, auth: route.request().headers().authorization || ''});
      if (url.pathname === '/api/operator/auth') {
        return route.fulfill({json: {ok: true, required, signedIn: !required || signedIn, ...(required ? {firebase, status: 401, reason: 'Operator sign-in required'} : {})}});
      }
      if (required && !signedIn) return route.fulfill({status: 401, json: {ok: false, error: 'Operator sign-in required'}});
      return route.fulfill({status: 503, json: {ok: false, error: 'offline in this test'}});
    }
    const file = resolve(frontend, '.' + url.pathname);
    try {
      return route.fulfill({body: await readFile(file), contentType: types[extname(file)] || 'application/octet-stream'});
    } catch { return route.fulfill({status: 404, body: 'missing'}); }
  });
  await page.goto('http://pluggo.test/operator.html#overview');
  return {page, errors, calls};
}

const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  // Open dashboard (local development): no gate.
  {
    const {page, errors} = await open(browser, {required: false});
    await page.waitForTimeout(600);
    assert.equal(await page.locator('#operatorGate').isVisible(), false, 'gate hidden when not required');
    assert.deepEqual(errors, []);
    await page.close();
  }
  // Protected dashboard: gate covers everything until a listed phone signs in.
  {
    const {page, errors} = await open(browser, {required: true});
    await page.locator('#operatorGate').waitFor({state: 'visible'});
    assert.equal(await page.evaluate(() => document.body.classList.contains('operator-locked')), true);
    assert.equal(await page.locator('#operatorPhone').evaluate((el) => document.activeElement === el), true, 'phone field focused');
    await page.locator('#operatorPhone').fill('12345');
    await page.locator('#operatorPhoneForm button').click();
    assert.match(await page.locator('#operatorGateMessage').textContent(), /valid 10-digit/);
    await mkdir('docs/ui-audit/dashboard', {recursive: true});
    for (const [theme, width] of [['dark', 1280], ['light', 390]]) {
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      await page.setViewportSize({width, height: 860});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `no horizontal scroll at ${width}px`);
      await page.screenshot({path: `docs/ui-audit/dashboard/operator-signin-${theme}-${width}.png`});
    }
    // The server rejecting a request mid-session brings the gate back with its reason.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('operator-auth-required', {detail: {error: 'Your operator sign-in has expired. Sign in again.'}})));
    assert.match(await page.locator('#operatorGateMessage').textContent(), /expired/);
    assert.deepEqual(errors, []);
    await page.close();
  }
  // The API client sends the token once one is set.
  {
    const {page, calls} = await open(browser, {required: false});
    await page.evaluate(() => { window.chargeFlowApi.token = 'test-id-token-value'; return window.chargeFlowApi.station().catch(() => {}); });
    assert.equal(calls.at(-1).auth, 'Bearer test-id-token-value');
    await page.close();
  }
  console.log('PASS: operator gate hidden when open, shown and focused when protected, phone validation, expiry message, token header, no overflow at 1280/390px in both themes');
} finally { await browser.close(); }
