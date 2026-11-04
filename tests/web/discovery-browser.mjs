import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['geolocation'],geolocation:{latitude:19.076,longitude:72.8777}});
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.geoCalls=0;const get=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);navigator.geolocation.getCurrentPosition=(...args)=>{window.geoCalls++;return get(...args);};});
 await p.goto('http://127.0.0.1:4173/?demo=1');assert.equal(await p.evaluate(()=>geoCalls),0);
 await p.getByRole('link',{name:'Stations',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#locationMessage').textContent.includes('Using your device'));
 assert.equal(await p.evaluate(()=>geoCalls),1);
 await p.getByRole('link',{name:'Home',exact:true}).click();await p.getByRole('link',{name:'Stations',exact:true}).click();assert.equal(await p.evaluate(()=>geoCalls),1);
 await p.locator('#realStationSource').click();assert.match(await p.locator('#realStationNotice').innerText(),/API key/);assert.equal(await p.locator('.compact-station').count(),0);assert.equal(await p.locator('.street-marker').count(),0);
 await p.waitForTimeout(400);
 await p.screenshot({path:'docs/ui-audit/after/phone-real-stations-setup.png',fullPage:true});
 await p.locator('#demoStationSource').click();assert.match(await p.locator('#resultCount').textContent(),/5 compatible stations/);
 // Exercise the integration without a paid account or calls to Google.
 await context.addInitScript(()=>sessionStorage.setItem('chargeflow.maps.key','AIza'+'x'.repeat(30)));
 await p.route('https://maps.googleapis.com/maps/api/js?**',route=>route.fulfill({contentType:'application/javascript',body:`
 window.googleRequests=[];
 class GoogleMap {constructor(){this.ready=true;}fitBounds(){}setCenter(){}setZoom(){}}
 class Bounds{extend(){}}
 class Marker{constructor(options){this.map=options.map;}addListener(){}}
 window.google={maps:{Map:GoogleMap,LatLngBounds:Bounds,ColorScheme:{DARK:'dark'},marker:{AdvancedMarkerElement:Marker},importLibrary:async()=>({SearchNearbyRankPreference:{DISTANCE:'distance'},Place:{searchNearby:async request=>{window.googleRequests.push(request);if(window.failPlaces)throw Error('API denied');await new Promise(resolve=>setTimeout(resolve,200));return {places:[{id:'test-place',displayName:'<b>Real Charger</b>',formattedAddress:'Mumbai',location:{lat:19.08,lng:72.88}}]};},searchByText:async request=>{window.googleRequests.push(request);return {places:[]};}}})}};window.pluggoMapsReady();` }));
 await p.reload();await p.locator('#realStationSource').click();await p.waitForFunction(()=>document.querySelector('#mapsStatus').textContent.includes('configured'));
 await p.locator('#realStationSearch').click();await p.locator('.real-station').waitFor();assert.equal(await p.locator('.real-station b').count(),0);assert.match(await p.locator('#stationSelection').innerText(),/<b>Real Charger<\/b>/);
 assert.equal(await p.locator('.real-station [data-station]').count(),0);assert.equal(await p.evaluate(()=>googleRequests[0].locationRestriction.center.lat),19.076);
 await p.screenshot({path:'docs/ui-audit/after/phone-real-results-mocked.png',fullPage:true});
 await p.evaluate(()=>window.failPlaces=true);await p.locator('#realStationSearch').click();await p.waitForFunction(()=>document.querySelector('#realStationNotice').textContent.includes('search failed'));
 await p.evaluate(()=>window.failPlaces=false);await p.locator('#realStationSearch').click();await p.locator('#demoStationSource').click();await p.waitForTimeout(250);assert.equal(await p.locator('.real-station').count(),0);assert.match(await p.locator('#resultCount').textContent(),/5 compatible stations/);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS: automatic granted location once, missing key, mocked Google requests/results/error/stale response, safe result text, demo isolation.');
}finally{await browser.close();}
