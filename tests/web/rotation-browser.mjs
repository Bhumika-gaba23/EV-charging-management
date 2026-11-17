import {chromium} from 'playwright';import assert from 'node:assert/strict';
// Android battery savers report "reduce motion". Rotation starts off there, but the
// Settings switch must stay usable and turning it on must make the vehicle rotate.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/?demo=1');await p.waitForFunction(()=>window.pluggoPerformance?.().ready);
 assert.equal(await p.evaluate(()=>pluggoPerformance().autoRotate),false);
 await p.goto('http://127.0.0.1:4173/?demo=1#settings');assert.equal(await p.locator('#previewMotion').isDisabled(),false);
 await p.locator('#previewMotion').check();await p.goto('http://127.0.0.1:4173/?demo=1#home');await p.waitForFunction(()=>window.pluggoPerformance?.().ready);
 const start=await p.evaluate(()=>pluggoPerformance().azimuth);await p.waitForTimeout(1200);
 const stats=await p.evaluate(()=>pluggoPerformance());assert.equal(stats.autoRotate,true);assert.ok(Math.abs(stats.azimuth-start)>.03,'vehicle should rotate');
 assert.deepEqual(errors,[]);console.log('PASS: reduce-motion phones start without rotation, keep the switch usable, and rotate once the user turns it on.');
}finally{await browser.close();}
