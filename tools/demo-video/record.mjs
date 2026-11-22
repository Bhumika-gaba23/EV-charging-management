// Records the Pluggo demo: drives the real app inside stage.html and captures Chrome screencast frames.
// Usage (repo root): see tools/demo-video/README.md
import {mkdirSync, rmSync, writeFileSync, readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const {chromium} = await import(pathToFileURL(`${HERE}/../../tests/web/node_modules/playwright/index.mjs`).href);
const DIR = `${HERE}/out`;
mkdirSync(DIR, {recursive: true});
const APP = 'http://127.0.0.1:4173';
const DELHI = {latitude: 28.6315, longitude: 77.2167}, BENGALURU = {latitude: 12.9716, longitude: 77.5946};
rmSync(`${DIR}/frames`, {recursive: true, force: true});
mkdirSync(`${DIR}/frames`, {recursive: true});

const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']});
const context = await browser.newContext({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, geolocation: DELHI, permissions: ['geolocation']});
await context.route(`${APP}/__stage.html`, (route) => route.fulfill({contentType: 'text/html', body: readFileSync(`${HERE}/stage.html`)}));
const page = await context.newPage();
page.setDefaultTimeout(8000);
page.on('pageerror', (e) => console.log('stage error', e.message));
await page.goto(`${APP}/__stage.html`);

const wait = (ms) => page.waitForTimeout(ms);
const stage = (fn, ...args) => page.evaluate(([f, a]) => window.stage[f](...a), [fn, args]);
const phone = () => page.frame({name: 'phone'});
const dash = () => page.frame({name: 'dash'});
const P = page.frameLocator('#phone');
const D = page.frameLocator('#dash');
async function openPhone(hash) {
  await page.evaluate((u) => { document.getElementById('phone').src = u; }, `${APP}/${hash}`);
  await page.waitForTimeout(300);
  await phone().waitForFunction(() => window.pluggoBackend?.connected, null, {timeout: 20000}).catch(() => {});
}
const go = (hash) => phone().evaluate((h) => { location.hash = h; }, hash);

// Preload behind the title card.
await stage('layout', 'phone');
await openPhone('#home');
await page.evaluate((u) => { document.getElementById('dash').src = u; }, `${APP}/operator.html#overview`);
await wait(2500);

// ---- screencast ---------------------------------------------------------------------------------
const client = await context.newCDPSession(page);
const frames = [];
let index = 0;
client.on('Page.screencastFrame', async ({data, metadata, sessionId}) => {
  const file = `frames/f${String(index++).padStart(6, '0')}.jpg`;
  writeFileSync(`${DIR}/${file}`, Buffer.from(data, 'base64'));
  frames.push({file, ts: metadata.timestamp});
  await client.send('Page.screencastFrameAck', {sessionId}).catch(() => {});
});
await client.send('Page.startScreencast', {format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1});
const started = Date.now() / 1000;
const marks = [];
const mark = (name) => { marks.push({name, at: Date.now() / 1000 - started}); console.log(`${(Date.now() / 1000 - started).toFixed(1)}s ${name}`); };

// ---- 1. Title -----------------------------------------------------------------------------------
mark('title');
await stage('chapter', '', -1);
await stage('card', `<div class="logo"><img src="/assets/pluggo.svg" alt="">pluggo.</div><p style="font-size:44px;margin-top:18px;color:#e6e7ea">EV charging, one tap.</p><p class="sub">Team GitBlame · Manthan Kriti 2026</p>`);
await wait(6000);

// ---- 2. Problem ---------------------------------------------------------------------------------
mark('problem');
await stage('card', `<h1>Charging an EV in India<br>is still hard.</h1><ul><li><b>01</b>A different app for every charging network</li><li><b>02</b>You only learn the cost after you charge</li><li><b>03</b>Chargers that turn out to be offline</li></ul>`);
await wait(8000);

// ---- 3. Home and garage -------------------------------------------------------------------------
mark('home');
await stage('hideCard');
await stage('chapter', '01 · Your vehicle', 0);
await stage('caption', 'Home', 'Your car,<br>your range.', 'Pick a car, scooter, bike or cargo three-wheeler. Pluggo knows its battery, range and which connectors fit.', ['Live battery & range', '4 vehicle types', '3D preview']);
await wait(3500);
for (const v of ['scooter', 'bike', 'car']) {
  await P.locator(`button[data-vehicle="${v}"]`).first().click().catch(() => {});
  await wait(1800);
}
await go('#garage');
await wait(3500);

// ---- 4. Find a charger --------------------------------------------------------------------------
mark('stations');
await stage('chapter', '02 · Find a charger', 1);
await go('#stations');
await stage('caption', 'Stations', 'Every charger<br>near you.', 'Pluggo network stations show live availability, connector fit and price per kWh.', ['Live availability', 'Compatible connectors only', '₹ per kWh']);
await wait(5500);
await stage('caption', 'All chargers', '2,374 real stations.<br>Free, no API key.', 'Real chargers across India from Open Charge Map and OpenStreetMap: operator, power, price and directions.', ['Open Charge Map', 'OpenStreetMap', 'New Delhi shown']);
await P.locator('#realStationSource').click();
await phone().waitForFunction(() => /\d+ real charging stations/.test(document.querySelector('#resultCount').textContent), null, {timeout: 15000}).catch(() => {});
await wait(4000);
await P.locator('.leaflet-marker-icon[title="EESL - Devinder Collections"]').first().dispatchEvent('click').catch((e) => console.log('EESL marker', e.message));
await wait(4000);
await P.locator('#demoStationSource').click();
await wait(1500);

// ---- 5. Charge ----------------------------------------------------------------------------------
mark('charge');
await stage('chapter', '03 · Charge', 2);
await stage('caption', 'Start', 'Set a target.<br>Set a budget.', 'Charging stops at your target or your budget, whichever comes first. The server checks the connector, the price and the energy, not the phone.', ['Target %', 'Budget ₹', 'Server-verified']);
await P.locator('[data-station="CP"]').first().click();
await wait(2500);
await P.locator('#selectCharger').click();
await wait(2500);
const target = P.locator('#chargeTarget');
await target.evaluate((el) => { el.value = 90; el.dispatchEvent(new Event('input', {bubbles: true})); }).catch(() => {});
await wait(1200);
await P.getByRole('button', {name: 'Start charging'}).click();
await wait(1500);
await stage('caption', 'Live session', 'Watch it charge.', 'Battery, energy and cost update every few seconds from the charger\'s meter. Leave the app; charging carries on.', ['Battery %', 'kWh', 'Cost so far']);
await wait(6500);

// ---- 6. Operator view ---------------------------------------------------------------------------
mark('operator');
await stage('chapter', '04 · Operations', 3);
await stage('layout', 'split');
await stage('caption', 'Operator dashboard', 'The station sees it live.', 'Same session, same server: connector occupancy, energy and revenue refresh every 3 seconds. Operators sign in with a registered phone number.', [], true);
await wait(9000);
await D.locator('.nav-item[data-target="recent"]').click().catch(() => {});
await wait(4500);
await D.locator('.nav-item[data-target="overview"]').click().catch(() => {});

// ---- 7. Stop and receipt ------------------------------------------------------------------------
mark('stop');
await stage('chapter', '05 · Pay', 4);
await stage('layout', 'phone');
await stage('caption', 'Stop & pay', 'Pay only for<br>what you used.', 'Stop any time and see exactly what you used. This local demo collects ₹0; live, Razorpay takes UPI or card, verified on the server, and nobody is charged twice.', ['Razorpay', 'Signed webhooks', 'Refunds']);
await wait(1500);
await P.locator('#stopCharge').click().catch(() => {});
await wait(3000);
await P.locator('#checkoutButton').click().catch(() => {});
await wait(2500);
await P.locator('#completePayment').click().catch(() => {});
await wait(4500);
await P.locator('#receiptDone').click().catch(() => {});
await wait(800);

// ---- 8. Real charger (OCPP 1.6J) ----------------------------------------------------------------
mark('ocpp');
await stage('chapter', '06 · Real chargers', 5);
await stage('layout', 'ocpp');
await stage('caption', 'OCPP 1.6J', 'Works with real chargers.', 'Any OCPP 1.6J charger can join with a password. Here an emulated 30 kW wallbox connects; the app starts it remotely and bills from its own meter.', [], true);
await go('#stations');
await wait(2000);
const charger = spawn('docker', ['exec', 'pluggo-demo', '/app/venv/bin/python', '-u', '/video/demo_charger.py']);
let buffer = '';
charger.stdout.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n'); buffer = lines.pop();
  for (const line of lines) if (line.trim()) {
    const pretty = line.replace(/Energy\.Active\.Import\.Register=(\d+) Wh/, (_, wh) => `energy ${(Number(wh) / 1000).toFixed(2)} kWh`).replace(/\s{2,}/g, '  ');
    page.evaluate((l) => window.stage.log(l), pretty).catch(() => {});
  }
});
charger.stderr.on('data', (d) => console.log('charger:', String(d).trim().slice(0, 200)));
await wait(4000);
await P.locator('#stationSearch').pressSequentially('Mandi', {delay: 120});
await P.locator('#stationSearch').press('Enter');
await wait(2000);
await P.locator('[data-station="MH"]').first().click();
await wait(2000);
await P.locator('input[name=connector][value="MH-01"]').check({force: true}).catch(() => {});
await P.locator('#selectCharger').click();
await wait(2000);
await P.getByRole('button', {name: 'Start charging'}).click();
await wait(11000);
await P.locator('#stopCharge').click().catch(() => {});
await wait(3500);
await P.locator('#checkoutButton').click().catch(() => {});
await wait(1500);
await P.locator('#completePayment').click().catch(() => {});
await wait(2500);
await P.locator('#receiptDone').click().catch(() => {});

// ---- 9. History and trust -----------------------------------------------------------------------
mark('trust');
await stage('chapter', '07 · History & trust', 6);
await stage('layout', 'phone');
await stage('caption', 'Sessions', 'Every charge,<br>every receipt.', 'Monthly spend, energy and history, saved to your phone number on every device.', ['Monthly summary', 'Share receipt']);
await go('#sessions');
await wait(5500);
await stage('caption', 'Privacy', 'Your data,<br>your call.', 'Explicit consent at sign-in, a full privacy policy, and one-tap account deletion, written for India\'s DPDP Act 2023.', ['Consent', 'Delete account', 'DPDP Act 2023']);
await page.evaluate((u) => { document.getElementById('phone').src = u; }, `${APP}/privacy.html`);
await wait(2500);
for (let i = 0; i < 6; i++) { await phone().evaluate(() => window.scrollBy({top: 260, behavior: 'smooth'})).catch(() => {}); await wait(700); }
await wait(1000);

// ---- 10. Closing --------------------------------------------------------------------------------
mark('closing');
await stage('chapter', '', 8);
await stage('hideCaption');
await stage('card', `<div class="logo" style="font-size:96px"><img src="/assets/pluggo.svg" alt="" style="width:96px;height:96px">pluggo.</div>
  <p style="margin-top:26px">C++17 engine · SQLite · OCPP 1.6J · Razorpay · Firebase phone sign-in · Open Charge Map · OpenStreetMap</p>
  <p style="margin-top:34px;font-size:30px;color:#e6e7ea">pluggo-customer-demo.onrender.com</p>
  <p class="sub">Team GitBlame · Manthan Kriti 2026</p>`);
await wait(8000);
mark('end');

await client.send('Page.stopScreencast');
charger.kill();
await browser.close();
writeFileSync(`${DIR}/frames.json`, JSON.stringify({frames, marks, started}, null, 1));
console.log(`frames: ${frames.length}`);
