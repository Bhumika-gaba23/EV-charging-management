import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const p=await browser.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/?demo=1');await p.waitForFunction(()=>window.pluggoPerformance?.().ready);await p.waitForTimeout(700);
 const positions=()=>p.evaluate(()=>['#vehicleStage','.home-widgets','.home-map-shortcut'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
 const closed=()=>p.waitForFunction(()=>!document.querySelector('#vehicleDropdown').open);
 for(const width of [390,320,1440]) {
  await p.setViewportSize({width,height:844});await p.waitForTimeout(350);
  const before=await positions();await p.locator('#vehicleDropdown summary').click();await p.waitForTimeout(350);
  assert.deepEqual(await positions(),before,'Opening the menu must not move page content');
  const menu=await p.locator('#vehicleMenu').boundingBox();assert.ok(menu.x>=0&&menu.x+menu.width<=width);
  assert.ok(await p.locator('#vehicleMenu').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+90));}),'Menu must receive input above the vehicle');
  assert.equal(await p.locator('#vehicleMenu').evaluate(e=>getComputedStyle(e).position),'absolute');
  assert.match(await p.locator('#vehicleMenu').evaluate(e=>getComputedStyle(e).backdropFilter),/blur\(20px\)/);
  await p.keyboard.press('Escape');await closed();
 }
 await p.setViewportSize({width:390,height:844});
 for(let i=0;i<3;i++) {await p.locator('#vehicleDropdown summary').click();await p.getByRole('menuitemradio',{name:/Urban Scooter/}).click();await closed();assert.equal(await p.locator('#selectedVehicleName').innerText(),'Urban Scooter');}
 await p.locator('#vehicleDropdown summary').focus();await p.keyboard.press('ArrowDown');await p.keyboard.press('End');await p.keyboard.press('Enter');await closed();assert.equal(await p.locator('#selectedVehicleName').innerText(),'Pluggo Cargo');
 await p.locator('#vehicleDropdown summary').click();await p.locator('.power-widget').click();await closed();
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#vehicleDropdown summary').click();assert.equal(await p.locator('#vehicleMenu').evaluate(e=>e.getAnimations().length),0);await p.keyboard.press('Escape');await closed();
 await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('#vehicleDropdown summary').click();await p.waitForTimeout(350);await mkdir('docs/ui-audit/menu-overlay',{recursive:true});await p.screenshot({path:'docs/ui-audit/menu-overlay/phone-menu.png'});
 assert.deepEqual(errors,[]);console.log('PASS: overlay menu causes zero layout movement, stays above model and inside viewport, glass blur, repeated open/close, selection, keyboard, outside dismissal and reduced motion.');
}finally{await browser.close();}
