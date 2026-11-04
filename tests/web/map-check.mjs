import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try {
const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:4173/?demo=1#stations');
for(const width of [1440,390,320]){
 await p.setViewportSize({width,height:900});
 await p.locator('.leaflet-marker-icon').first().waitFor();
 assert.ok(await p.locator('.leaflet-marker-icon').count()>=2);
 assert.equal(await p.locator('#stationSelection').isVisible(),true);
 assert.match(await p.locator('#resultCount').textContent(),/5 compatible stations/);
 await p.waitForFunction(()=>document.querySelectorAll('.leaflet-tile-loaded').length>0,{},{timeout:20000});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:`docs/web-preview/stations-map-${width}.png`});
}
await p.locator('#availableFilter').click();assert.match(await p.locator('#resultCount').textContent(),/4 compatible stations/);
await p.locator('#stationSearch').fill('zzzzz');await p.locator('#mapEmpty').waitFor({state:'visible'});
await p.locator('#clearStationFilters').click();assert.ok(await p.locator('.leaflet-marker-icon').count()>=2);
await p.locator('#stationSelection [data-station="CP"]').click();await p.locator('#flowDialog').waitFor({state:'visible'});
assert.ok((await p.locator('#flowDialog').innerText()).includes('Central Circle'));
assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile map, availability, search, empty-state recovery and station details; no page errors.');
}finally{await browser.close();}
