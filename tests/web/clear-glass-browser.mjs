import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/#home');await p.waitForFunction(()=>window.pluggoBackend?.connected&&window.pluggoPerformance?.().ready);
 assert.equal(await p.locator('#connectionMode').isVisible(),false);
 assert.equal(await p.locator('.vehicle-page-dots button').count(),4);
 const geometry=await p.evaluate(()=>{
  const nav=document.querySelector('.glass-nav'),lens=document.querySelector('.nav-lens');
  return {radius:parseFloat(getComputedStyle(nav).borderRadius),height:nav.getBoundingClientRect().height,lensRadius:parseFloat(getComputedStyle(lens).borderRadius),aa:document.querySelector('#vehicleCanvas canvas').getContext('webgl2').getContextAttributes().antialias};
 });assert.ok(geometry.radius>=geometry.height/2);assert.ok(geometry.lensRadius>=20);assert.equal(geometry.aa,true);
 await mkdir('docs/ui-audit/clear-glass',{recursive:true});
 await p.screenshot({path:'docs/ui-audit/clear-glass/phone-home.png',fullPage:true});
 await p.locator('#vehicleDropdown summary').click();await p.getByRole('menuitemradio',{name:/Pluggo Cargo/}).click();
 await p.waitForFunction(()=>pluggoPerformance().ready&&pluggoPerformance().vehicle==='cargo');
 assert.match(await p.locator('#homeBatteryCapacity').innerText(),/5.0 of 20 kWh/);
 assert.ok(await p.evaluate(()=>pluggoPerformance().drawCalls<25));
 await p.waitForTimeout(650);await p.screenshot({path:'docs/ui-audit/clear-glass/phone-cargo.png',fullPage:true});
 await p.reload();await p.waitForFunction(()=>window.pluggoBackend?.connected);assert.equal(await p.locator('#selectedVehicleName').innerText(),'Pluggo Cargo');
 await p.locator('#findStations').click();
 const glass=await p.locator('#stationSelection').evaluate(e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,blur:s.backdropFilter,color:s.color};});
 assert.equal(glass.blur,'blur(20px) saturate(1.1)');assert.match(glass.background,/0.04\)/);assert.equal(glass.color,'rgb(21, 23, 25)');
 await p.waitForTimeout(700);await p.waitForFunction(()=>document.querySelectorAll('.leaflet-tile-loaded').length>0,{},{timeout:12000}).catch(()=>{});await p.screenshot({path:'docs/ui-audit/clear-glass/phone-stations.png'});
 await p.getByRole('button',{name:'View Central Circle',exact:true}).click();await p.locator('[data-connector="CP-03"]').check();await p.locator('#selectCharger').click();await p.getByRole('button',{name:'Start simulated charging'}).click();
 await p.getByRole('button',{name:'Stop demo charging'}).click();await p.getByRole('button',{name:'Continue to demo checkout'}).click();await p.getByRole('button',{name:'Complete demo payment · ₹0'}).click();
 const state=await context.request.get('http://127.0.0.1:4173/api/customer/state').then(r=>r.json());assert.equal(state.state.sessions[0].vehicle,'cargo');assert.equal(state.state.sessions[0].power,3.3);assert.equal(state.state.sessions[0].settled,true);assert.equal(state.state.sessions[0].receipt.amountCollected,0);
 await p.locator('#closeDialog').click();await p.getByRole('link',{name:'Stations',exact:true}).click();
 for(const width of [320,390,1440]) {await p.setViewportSize({width,height:844});await p.waitForTimeout(200);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.screenshot({path:'docs/ui-audit/clear-glass/desktop-stations.png'});
 await context.request.post('http://127.0.0.1:4173/api/customer/reset',{headers:{'X-Pluggo-Request':'1'},data:{}});
 assert.deepEqual(errors,[]);await context.close();console.log('PASS: clear 20px glass, capsule navbar, hidden preview badge, antialiasing, cargo selection/model/preferences and backend charging/receipt, phone/desktop overflow.');
}finally{await browser.close();}
