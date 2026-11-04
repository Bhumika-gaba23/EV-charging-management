import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const customer=process.env.CUSTOMER_URL||'https://pluggo-customer-demo.onrender.com';
const dashboard=process.env.DASHBOARD_URL||'https://oops-omega.vercel.app';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext();
const headers={'X-Pluggo-Request':'1'};
async function call(path,data,key){const r=await context.request.fetch(customer+'/api/customer/'+path,{method:data?'POST':'GET',headers:{...headers,...(key?{'Idempotency-Key':key}:{})},...(data?{data}:{}),timeout:60000});const j=await r.json();assert.ok(r.ok(),JSON.stringify(j));return j;}
let started=false;
try {
 const boot=await call('bootstrap');
 const station=boot.catalog.stations.find(s=>s.connectors.some(c=>c.available&&boot.catalog.vehicles.car.connectors.includes(c.type)));
 assert.ok(station,'No available simulated car connector');
 const connector=station.connectors.find(c=>c.available&&boot.catalog.vehicles.car.connectors.includes(c.type));
 const created=await call('sessions',{station:station.id,connector:connector.id,vehicle:'car',target:80,budget:1000},'shared-'+Date.now());started=true;
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(dashboard);
 await p.waitForFunction(id=>[...document.querySelectorAll('.slot-row')].some(r=>r.textContent.includes(id)&&r.textContent.includes('CHARGING')),connector.id,{timeout:30000});
 await p.waitForFunction(()=>document.querySelector('#energyDelivered').textContent!=='0.00',null,{timeout:20000});
 assert.match(await p.locator('#customerSessionList').innerText(),new RegExp(connector.id));
 await mkdir('docs/ui-audit/shared-sessions',{recursive:true});await p.screenshot({path:'docs/ui-audit/shared-sessions/active.png',fullPage:true});
 const snap=await call('state');const session=snap.state.sessions.find(s=>s.id===created.sessionId);assert.ok(session.energy>0&&session.cost>0);
 await call(`sessions/${created.sessionId}/stop`,{});
 await p.waitForFunction(id=>[...document.querySelectorAll('.slot-row')].some(r=>r.textContent.includes(id)&&r.textContent.includes('AVAILABLE')),connector.id,{timeout:15000});
 await p.waitForFunction(()=>document.querySelector('#customerSessionList').textContent.includes('Finished'));
 await p.screenshot({path:'docs/ui-audit/shared-sessions/stopped.png',fullPage:true});await p.locator('.nav-item[data-target="recent"]').click();
 await p.locator('#recentVehicleFilter').selectOption('finished');
 const detail=p.locator('.recent-vehicle-card').filter({hasText:created.sessionId});await detail.waitFor();
 assert.match(await detail.innerText(),/FINISHED/);assert.match(await detail.innerText(),/Energy delivered/);assert.match(await detail.innerText(),/Stopped by you/);
 await p.locator('#recentVehicleFilter').selectOption('active');assert.equal(await p.locator('.recent-vehicle-card').filter({hasText:created.sessionId}).count(),0);
 await p.locator('#recentVehicleFilter').selectOption('all');await p.waitForTimeout(500);await p.screenshot({path:'docs/ui-audit/shared-sessions/recent-vehicles.png',fullPage:true});
 for(const width of [390,320]){await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);
 console.log('PASS: customer session appears on live operator dashboard; metering advances energy/cost; stopping releases connector and updates history.');
} finally {if(started)await call('reset',{});await browser.close();}
