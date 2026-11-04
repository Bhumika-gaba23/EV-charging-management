import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173');await p.waitForFunction(()=>window.pluggoBackend?.connected);await p.waitForFunction(()=>window.pluggoPerformance?.().ready);
 assert.equal(await p.locator('#connectionMode').innerText(),'SERVER DEMO');assert.equal(await p.locator('#backendBanner').isVisible(),false);
 await p.locator('#vehicleDropdown summary').click();await p.getByRole('menuitemradio',{name:/Urban Scooter/}).click();
 await p.waitForFunction(async()=>{const response=await fetch('/api/customer/state');const data=await response.json();return data.state.vehicle==='scooter';});
 await p.reload();await p.waitForFunction(()=>window.pluggoBackend?.connected);assert.equal(await p.locator('#selectedVehicleName').innerText(),'Urban Scooter');
 await p.locator('#findStations').click();await p.getByRole('button',{name:'View Central Circle',exact:true}).click();await p.locator('[data-connector="CP-03"]').check();await p.locator('#selectCharger').click();await p.getByRole('button',{name:'Start simulated charging'}).click();
 await p.waitForFunction(async()=>{const r=await fetch('/api/customer/state');const d=await r.json();return d.state.sessions.length===1;});
 const server=await context.request.get('http://127.0.0.1:4173/api/customer/state').then(r=>r.json());const id=server.state.sessions[0].id;assert.ok(server.state.sessions[0].backendOwned);
 const second=await browser.newContext();await second.request.get('http://127.0.0.1:4173/api/customer/bootstrap');const strangers=await second.request.get('http://127.0.0.1:4173/api/customer/state').then(r=>r.json());assert.equal(strangers.state.sessions.length,0);
 const occupied=strangers.catalog.stations.find(s=>s.id==='CP').connectors.find(c=>c.id==='CP-03');assert.equal(occupied.available,false);
 await p.locator('#closeDialog').click();await p.getByRole('link',{name:'Home',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#homeBatteryProgress').value>25);assert.match(await p.locator('#homePowerValue').innerText(),/1.5\s*kW/);
 await p.evaluate(()=>{const old=localStorage.getItem('chargeflow.web.v1');const value=JSON.parse(old);value.sessions=[{id:'injected',energy:999999}];localStorage.setItem('chargeflow.web.v1',JSON.stringify(value));});
 await p.reload();await p.waitForFunction(()=>window.pluggoBackend?.connected);await p.getByRole('link',{name:'Sessions',exact:true}).click();await p.getByRole('button',{name:'View live session'}).click();await p.getByRole('button',{name:'Stop demo charging'}).click();await p.getByRole('button',{name:'Continue to demo checkout'}).click();await p.getByRole('button',{name:'Complete demo payment · ₹0'}).click();await p.waitForFunction(()=>document.querySelector('#dialogBody').textContent.includes('Demo payment completed'));
 const paid=await context.request.get('http://127.0.0.1:4173/api/customer/state').then(r=>r.json());assert.equal(paid.state.sessions[0].id,id);assert.equal(paid.state.sessions[0].settled,true);assert.equal(paid.state.sessions[0].receipt.amountCollected,0);
 await p.locator('#closeDialog').click();await p.getByRole('link',{name:'Home',exact:true}).click();
 await p.route('**/api/customer/state',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Test outage'})}));await p.waitForFunction(()=>window.pluggoBackend?.connected===false);await p.locator('#backendBanner').waitFor({state:'visible'});
 await p.unroute('**/api/customer/state');await p.locator('#retryBackend').click();await p.waitForFunction(()=>window.pluggoBackend?.connected);assert.equal(await p.locator('#backendBanner').isVisible(),false);
 await context.request.post('http://127.0.0.1:4173/api/customer/reset',{headers:{'X-Pluggo-Request':'1'},data:{}});await p.reload();await p.waitForFunction(()=>window.pluggoBackend?.connected);await p.getByRole('link',{name:'Sessions',exact:true}).click();assert.equal(await p.locator('.session-card').count(),0);
 assert.deepEqual(errors,[]);await second.close();await context.close();console.log('PASS: frontend ↔ real C++ backend, vehicle preferences, authoritative availability, session start/live/stop/checkout, guest isolation, local-storage tamper rejection, outage/retry and server reset.');
}finally{await browser.close();}
