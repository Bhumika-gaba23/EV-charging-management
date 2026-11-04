import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/?demo=1');await p.waitForFunction(()=>window.pluggoPerformance?.().ready);await p.waitForTimeout(600);
 assert.equal(await p.locator('.vehicle-selector').count(),0);assert.equal(await p.locator('.vehicle-wallet').count(),1);
 const cdp=await context.newCDPSession(p);
 async function swipe(x1,y1,x2,y2){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8}]});await p.waitForTimeout(16);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 let footer=await p.locator('#vehiclePagination').boundingBox();await swipe(footer.x+150,footer.y+30,footer.x+45,footer.y+30);
 await p.waitForFunction(()=>document.querySelector('#vehicleStage').dataset.vehicleKind==='scooter');assert.equal(await p.locator('#selectedVehicleName').innerText(),'Urban Scooter');assert.equal(await p.getByRole('button',{name:'Scooter',exact:true}).getAttribute('aria-pressed'),'true');
 await p.waitForFunction(()=>pluggoPerformance().ready&&pluggoPerformance().vehicle==='scooter');
 await p.getByRole('button',{name:'Bike',exact:true}).tap();await p.waitForFunction(()=>pluggoPerformance().ready&&pluggoPerformance().vehicle==='bike');
 await p.locator('#vehiclePagination').focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>pluggoPerformance().ready&&pluggoPerformance().vehicle==='cargo');await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>pluggoPerformance().ready&&pluggoPerformance().vehicle==='car');
 const picker=await p.locator('.home-vehicle-picker').boundingBox();await swipe(picker.x+Math.min(picker.width-10,120),picker.y+18,picker.x+10,picker.y+18);await p.waitForFunction(()=>pluggoPerformance().ready&&pluggoPerformance().vehicle==='scooter');assert.match(await p.evaluate(()=>location.hash),/^(#home)?$/);await p.locator('#vehiclePagination').focus();await p.keyboard.press('Home');await p.waitForFunction(()=>pluggoPerformance().ready&&pluggoPerformance().vehicle==='car');
 // Keep the vehicle static so a change in angle must come from the preview drag.
 await p.getByRole('link',{name:'My garage',exact:true}).tap();await p.locator('#previewMotion').uncheck();await p.getByRole('link',{name:'Home',exact:true}).tap();await p.waitForTimeout(500);
 const before=await p.evaluate(()=>pluggoPerformance().azimuth),canvas=await p.locator('#vehicleCanvas canvas').boundingBox();
 await swipe(canvas.x+canvas.width*.65,canvas.y+canvas.height*.5,canvas.x+canvas.width*.3,canvas.y+canvas.height*.5);await p.waitForTimeout(250);
 assert.equal(await p.locator('#vehicleStage').getAttribute('data-vehicle-kind'),'car');assert.ok(Math.abs(await p.evaluate(()=>pluggoPerformance().azimuth)-before)>.1);
 await p.setViewportSize({width:390,height:450});await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(200);footer=await p.locator('#vehiclePagination').boundingBox();await swipe(footer.x+80,footer.y+25,footer.x+80,footer.y-100);await p.waitForTimeout(200);assert.equal(await p.locator('#vehicleStage').getAttribute('data-vehicle-kind'),'car');assert.ok(await p.evaluate(()=>scrollY>0));
 await p.setViewportSize({width:390,height:844});await p.getByRole('link',{name:'Stations',exact:true}).tap();await p.locator('#stationSelection').waitFor();assert.match(await p.locator('#stationSelection').innerText(),/compatible plugs available/);
 assert.equal(await p.locator('#stationSelection .availability-dot:not(.busy)').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(67, 199, 123)');
 await p.locator('#stationSearch').fill('Garden');assert.match(await p.locator('#stationSelection').innerText(),/Compatible plugs in use/);
 assert.equal(await p.locator('#stationSelection .availability-dot.busy').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(237, 106, 103)');
 assert.deepEqual(errors,[]);await context.close();console.log('PASS: native touch swipes select, dot tap and keyboard select, model drag rotates without switching, vertical swipe scrolls, labelled green/red dots.');
}finally{await browser.close();}
