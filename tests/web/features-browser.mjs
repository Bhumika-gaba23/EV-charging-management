import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 // Settings → Charging & payment drives the charge sheet defaults.
 await p.goto('http://127.0.0.1:4173/?demo=1#settings');await p.locator('#prefTarget').selectOption('90');await p.locator('#prefBudget').selectOption('500');
 await p.goto('http://127.0.0.1:4173/?demo=1#stations');await p.locator('#stationSelection .station-sheet-actions').waitFor();
 // Pins carry prices; the station card collapses and expands.
 assert.ok(await p.locator('.pin-price').count()>0);
 await p.locator('.station-sheet-handle').click();assert.equal(await p.locator('#stationSelection .station-sheet-actions').isVisible(),false);
 await p.locator('.station-sheet-handle').click();assert.equal(await p.locator('#stationSelection .station-sheet-actions').isVisible(),true);
 await p.locator('#stationSelection [data-station]').first().click();await p.locator('#selectCharger').click();
 assert.equal(await p.locator('#chargeTarget').inputValue(),'90');assert.equal(await p.locator('#chargeBudget').inputValue(),'500');
 await p.locator('#dialogActions button[form="chargePlan"]').click();await p.locator('#closeDialog').click();
 // Sessions: live banner, three activity rings and the seven-day chart.
 await p.goto('http://127.0.0.1:4173/?demo=1#sessions');await p.locator('.live-banner').waitFor();
 assert.equal(await p.locator('.ring-legend li').count(),3);assert.equal(await p.locator('.week-bar').count(),7);
 await p.locator('.live-banner').click();await p.getByRole('button',{name:'Stop charging'}).click();await p.getByRole('button',{name:'Continue to payment'}).click();await p.getByRole('button',{name:'Complete checkout'}).click();
 assert.ok(await p.locator('#shareReceipt').isVisible());
 await p.locator('#receiptDone').click();await p.locator('#sessionList .month-label').first().waitFor();
 assert.equal(await p.locator('#liveBanner').isHidden(),true);
 assert.ok(await p.locator('.ring-fill').count()>0);
 // Garage hosts the live 3D stage; Home gets it back.
 await p.goto('http://127.0.0.1:4173/?demo=1#garage');await p.waitForFunction(()=>document.querySelector('#garageStage #vehicleStage'));
 assert.match(await p.locator('.garage-battery').first().innerText(),/%/);
 await p.getByRole('link',{name:'Home',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.vehicle-wallet #vehicleStage'));
 assert.match(await p.locator('#homeCtaLabel').innerText(),/Start charging/);
 assert.deepEqual(errors,[]);
 console.log('PASS: charging defaults from Settings, priced pins, collapsible station card, live banner, activity rings, weekly chart, share receipt, month history and the Garage 3D stage.');
}finally{await browser.close();}
