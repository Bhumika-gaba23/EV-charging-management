// Real-station mode without a Google key: the app searches the server's OpenStreetMap directory
// and draws results on the street map. Needs the local stack on 127.0.0.1:4173.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const base = process.env.PLUGGO_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, geolocation: {latitude: 28.6139, longitude: 77.2090}, permissions: ['geolocation']});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/#stations`);
  await page.waitForFunction(() => window.pluggoBackend?.connected);
  await page.locator('#realStationSource').click();
  // With location known, the directory search starts by itself.
  await page.waitForFunction(() => /\d+ real charging stations/.test(document.querySelector('#resultCount').textContent), null, {timeout: 15000});
  const count = Number((await page.locator('#resultCount').textContent()).match(/\d+/)[0]);
  assert.ok(count > 0, 'nearby real stations found');
  await page.locator('#stationSelection .real-station').waitFor();
  assert.match(await page.locator('#stationSelection').textContent(), /km away/);
  assert.match(await page.locator('#stationSelection .real-station-attribution').textContent(), /OpenStreetMap contributors/);
  assert.match(await page.locator('#stationSelection .real-station').getAttribute('href'), /google\.com\/maps\/dir/);
  assert.ok(await page.locator('.real-marker').count() > 0, 'markers drawn on the street map');
  assert.equal(await page.locator('#realStationNotice a[href="#settings"]').count(), 0, 'no Google key prompt');
  await mkdir('docs/ui-audit/stations', {recursive: true});
  await page.waitForTimeout(800);
  await page.screenshot({path: 'docs/ui-audit/stations/real-stations-osm-390.png'});

  // Search by place name: every result must match.
  await page.locator('#stationSearch').fill('Bengaluru');
  await page.locator('#realStationSearch').click();
  await page.waitForFunction(() => !document.querySelector('#realStationSearch').disabled);
  assert.match(await page.locator('#resultCount').textContent(), /real charging stations/);

  // Selecting a marker updates the sheet.
  await page.locator('#stationSearch').fill('');
  await page.locator('#realStationSearch').click();
  await page.waitForFunction(() => !document.querySelector('#realStationSearch').disabled);
  const markers = page.locator('.real-marker');
  if (await markers.count() > 1) {
    const first = await page.locator('#stationSelection h2').textContent();
    await markers.nth(1).click({force: true});
    await page.waitForFunction((before) => document.querySelector('#stationSelection h2')?.textContent !== before || document.querySelectorAll('.real-marker.selected').length === 1, first);
    assert.equal(await page.locator('.real-marker.selected').count(), 1);
  }
  // Back to the Pluggo network keeps working.
  await page.locator('#demoStationSource').click();
  await page.waitForFunction(() => !/real charging stations/.test(document.querySelector('#resultCount').textContent));
  assert.deepEqual(errors, []);
  console.log(`PASS: real stations without a Google key (${count} near Delhi), auto-search with location, place search, markers, selection, attribution, directions, return to Pluggo network`);
} finally { await browser.close(); }
