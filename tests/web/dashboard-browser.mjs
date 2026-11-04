import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const base=process.env.DASHBOARD_URL||'http://127.0.0.1:4173/operator.html';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const p=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await p.waitForFunction(()=>document.querySelector('#headerApiStatus').textContent!=='CONNECTING');
 assert.equal(await p.locator('#vehicleLanding').isVisible(),false);assert.match(await p.title(),/Pluggo/);
 await p.locator('.nav-item[data-target="schedule"]').click();await p.locator('#planForm button[type="submit"]').click();await p.waitForFunction(()=>document.querySelector('#planResult .result-status strong').textContent!=='READY TO CALCULATE');assert.match(await p.locator('#planResult .result-main').innerText(),/kW/);
 await p.locator('#vehicleTypeButton').click();await p.locator('.vehicle-choice[data-vehicle="cargo"]').click();assert.equal(await p.locator('#capacity').inputValue(),'20');assert.equal(await p.locator('#selectedVehicleLabel').innerText(),'CARGO EV');
 await p.locator('.nav-item[data-target="queue"]').click();const old=await p.locator('#queueList .queue-item').count();const registration='TEST-'+Date.now().toString().slice(-7);
 await p.locator('#qReg').fill(registration);await p.locator('#qUrgency').selectOption('emergency');await p.locator('#queueForm button[type="submit"]').click();await p.waitForFunction(n=>document.querySelectorAll('#queueList .queue-item').length===n,old+1);assert.match(await p.locator('#queueList').innerText(),new RegExp(registration));
 await p.locator('#serveNext').click();await p.waitForFunction(n=>document.querySelectorAll('#queueList .queue-item').length===n,old);
 await p.locator('.nav-item[data-target="energy"]').click();await p.locator('#storeEnergy').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.startsWith('Solar simulation complete.'));
 await p.locator('.nav-item[data-target="emergency"]').click();await p.locator('#eReg').fill('DEMO AMB');await p.locator('#emergencyForm button[type="submit"]').click();await p.waitForFunction(()=>document.querySelector('#emergencyResult').textContent.includes('DEMO AMB'));await p.locator('#dismissBanner').click();
 await p.locator('.operator-profile').click();await p.locator('#operatorInfo').waitFor({state:'visible'});await p.locator('#closeOperatorInfo').click();
 await p.locator('#openScanner').click();await p.locator('#manualChargerId').fill('A1');await p.locator('#manualChargerForm button').click();await p.locator('#scannerResult').waitFor({state:'visible'});await p.locator('#closeScanner').click();
 await mkdir('docs/ui-audit/dashboard',{recursive:true});
 for(const theme of ['light','dark']) {await p.locator('#themeToggle').click();assert.ok(await p.evaluate(()=>['light','dark'].includes(document.documentElement.dataset.theme)));}
 for(const width of [1440,1024,390,320]) {
  await p.setViewportSize({width,height:900});
  for(const view of ['overview','schedule','queue','energy','emergency']) {await p.locator(`.nav-item[data-target="${view}"]`).click();await p.waitForTimeout(100);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}:${view} overflow`);}
 }
 await p.setViewportSize({width:1440,height:1000});await p.locator('.nav-item[data-target="overview"]').click();await p.waitForTimeout(450);await p.screenshot({path:'docs/ui-audit/dashboard/desktop-overview.png',fullPage:true});
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);await p.screenshot({path:'docs/ui-audit/dashboard/phone-overview.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: dashboard C++/demo planner, cargo profile, queue add/serve, solar simulation, emergency flow, operator info, manual scanner, both themes and 20 responsive route checks.');
}finally{await browser.close();}
