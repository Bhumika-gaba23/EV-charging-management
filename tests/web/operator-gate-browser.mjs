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

async function open(browser, {required, signedIn = false, station = null, onRefund = null}) {
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
      if (station && url.pathname === '/api/station') return route.fulfill({json: station});
      if (station && url.pathname === '/api/queue') return route.fulfill({json: {ok: true, items: []}});
      if (onRefund && url.pathname === '/api/operator/refund') return route.fulfill({json: onRefund(JSON.parse(route.request().postData()))});
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
  // Refunds: paid sessions offer a refund dialog; the request carries the chosen amount.
  {
    const paid = {id: 'sess-paid-1', vehicle: 'car', vehicleName: 'Tata Nexon EV', station: 'CP', connector: 'CP-01', started: Date.now() - 600000, ended: Date.now() - 60000,
      target: 80, energy: 4, cost: 72, rate: 18, power: 0, currentSoc: 60, settled: true, paid: 72, refunded: 10, paymentId: 'pay_ABC', reason: 'Charge target reached'};
    const unpaid = {...paid, id: 'sess-free-2', paymentId: '', paid: 0, refunded: 0};
    const station = {ok: true, slots: [{id: 'CP-01', stationName: 'Connaught Place', status: 'available', connector: 'CCS2'}], recentSessions: [paid, unpaid], activePowerKW: 0, energyKWh: 4, estimatedCost: 72};
    let sent = null;
    const {page, errors} = await open(browser, {required: false, station, onRefund: (body) => { sent = body; return {ok: true, refundId: 'rfnd_1', amount: body.amount, refunds: []}; }});
    await page.locator('.nav-item[data-target="recent"]').click();
    await page.locator('[data-refund="sess-paid-1"]').waitFor();
    assert.equal(await page.locator('[data-refund="sess-free-2"]').count(), 0, 'no refund for unpaid sessions');
    assert.match(await page.locator('#recentVehicleList').textContent(), /₹72\.00 paid · ₹10\.00 refunded/);
    await page.locator('[data-refund="sess-paid-1"]').click();
    assert.equal(await page.locator('#refundAmount').inputValue(), '62.00', 'defaults to the refundable remainder');
    await page.locator('#refundAmount').fill('20');
    await page.locator('#refundReason').fill('Charger fault');
    await page.screenshot({path: 'docs/ui-audit/dashboard/operator-refund-dialog.png'});
    await page.locator('#confirmRefund').click();
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('rfnd_1'));
    assert.deepEqual(sent, {sessionId: 'sess-paid-1', amount: 20, reason: 'Charger fault'});
    assert.equal(await page.locator('#refundDialog').isVisible(), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: refund dialog for paid sessions only, refundable default, request body; operator gate hidden when open, shown and focused when protected, phone validation, expiry message, token header, no overflow at 1280/390px in both themes');
} finally { await browser.close(); }
