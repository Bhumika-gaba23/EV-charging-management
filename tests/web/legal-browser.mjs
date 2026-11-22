// Consent at sign-in, account deletion and the policy pages. The API and the Firebase SDK are
// stand-ins; the server-side erasure is covered by tests/api/payments_test.py.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {stations, vehicles} from '../../frontend/demo-data.js';

const base = process.env.PLUGGO_URL || 'http://127.0.0.1:4173';
const firebase = {projectId: 'demo', apiKey: 'demo', authDomain: 'demo.firebaseapp.com', appId: 'demo'};
const payload = (signedIn) => ({ok: true, state: {vehicle: 'car', saved: [], sessions: []}, catalog: {stations, vehicles},
  account: {signedIn, phone: signedIn ? '+919876543210' : ''},
  backend: {authRequired: true, firebase, payments: 'razorpay', storage: 'sqlite', simulationMode: 'meter', simulatorConnected: true}});
const fakeApp = 'export const initializeApp = () => ({});';
const fakeAuth = `const user = {metadata: {lastSignInTime: new Date().toUTCString()}};
export const getAuth = () => ({currentUser: user, authStateReady: async () => {}});
export const deleteUser = async () => { window.__firebaseDeleted = true; };
export const signOut = async () => {};
export class RecaptchaVerifier { clear() {} }
export const signInWithPhoneNumber = async () => { window.__otpSent = true; return {confirm: async () => ({user: {getIdToken: async () => 't'}})}; };`;

const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
try {
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  let signedIn = true, deleteCalls = 0;
  await ctx.route('**/api/customer/**', (route) => {
    const url = route.request().url();
    if (url.includes('/account/delete')) {
      assert.equal(route.request().method(), 'POST');
      assert.equal(route.request().headers()['x-pluggo-request'], '1');
      deleteCalls += 1; signedIn = false;
      return route.fulfill({json: {...payload(false), deleted: true}});
    }
    return route.fulfill({json: payload(signedIn)});
  });
  await ctx.route('https://www.gstatic.com/**', (route) => route.fulfill({contentType: 'text/javascript',
    body: route.request().url().endsWith('firebase-app.js') ? fakeApp : fakeAuth}));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // 1. Delete account: confirm sheet, server erase, Firebase record removed, signed out.
  await page.goto(`${base}/#settings`);
  await page.waitForFunction(() => window.pluggoBackend?.connected);
  await page.locator('#deleteAccountButton').click();
  assert.match(await page.locator('#dialogTitle').textContent(), /Delete your account/);
  assert.match(await page.locator('#flowDialog').textContent(), /anonymous accounting records/);
  await page.locator('#cancelDelete').click();
  assert.equal(deleteCalls, 0, 'cancel keeps the account');
  await page.locator('#deleteAccountButton').click();
  await page.locator('#confirmDelete').click();
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('deleted'));
  assert.equal(deleteCalls, 1);
  assert.equal(await page.evaluate(() => window.__firebaseDeleted), true, 'Firebase sign-in record deleted');
  await page.locator('#signInButton').waitFor();

  // 2. Sign-in needs explicit consent, with links to both policies.
  await page.locator('#signInButton').click();
  await page.locator('#phoneInput').fill('9876543210');
  await page.locator('#sendCode').click();
  assert.match(await page.locator('#signInError').textContent(), /agree to the Terms of Use and Privacy Policy/);
  assert.equal(await page.evaluate(() => window.__otpSent || false), false, 'no SMS without consent');
  assert.equal(await page.locator('.consent-check a[href="terms.html"]').count(), 1);
  assert.equal(await page.locator('.consent-check a[href="privacy.html"]').count(), 1);
  await page.locator('#consentInput').check();
  await page.locator('#sendCode').click();
  await page.waitForFunction(() => window.__otpSent === true);
  await mkdir('docs/ui-audit/legal', {recursive: true});

  // 3. Policy pages render on a phone without horizontal scrolling; contact falls back politely.
  for (const name of ['privacy', 'terms']) {
    await page.goto(`${base}/${name}.html`);
    await page.waitForFunction(() => document.querySelector('[data-legal-contact]')?.textContent.length > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} fits 390px`);
    assert.match(await page.locator('[data-legal-contact]').first().textContent(), /Contact us|@/);
    await page.screenshot({path: `docs/ui-audit/legal/${name}-390.png`});
  }
  assert.match(await page.locator('body').textContent(), /Consumer Protection Act/);
  assert.deepEqual(errors, []);
  console.log('PASS: account deletion (confirm, cancel, server erase, Firebase record), sign-in consent required with policy links, policy pages at 390px');
} finally { await browser.close(); }
