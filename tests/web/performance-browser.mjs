import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {choosePerformanceProfile} from '../../frontend/performance-profile.js';
assert.equal(choosePerformanceProfile({memory:2,cores:8}),'lite');
assert.equal(choosePerformanceProfile({memory:4,cores:8}),'lite');
assert.equal(choosePerformanceProfile({memory:8,cores:2}),'lite');
assert.equal(choosePerformanceProfile({memory:8,cores:8,saveData:true}),'lite');
assert.equal(choosePerformanceProfile({memory:8,cores:8}),'full');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await context.newPage();
 await p.addInitScript(()=>{
  window.showroomAnimationFrames=0;
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=callback=>raf(time=>{
   if(callback.name==='animate')window.showroomAnimationFrames++;
   callback(time);
  });
 });
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/?demo=1&performance=lite');
 await p.waitForFunction(()=>window.pluggoPerformance?.().ready);
 let stats=await p.evaluate(()=>pluggoPerformance());assert.equal(stats.profile,'lite');assert.equal(stats.targetFps,60);assert.equal(stats.fpsCap,null);assert.ok(stats.pixelRatio>1&&stats.pixelRatio<=2);assert.equal(stats.antialias,true);
 const sample=()=>p.evaluate(()=>({draws:pluggoPerformance().renderedFrames,callbacks:window.showroomAnimationFrames}));
 const before=await sample();await p.waitForTimeout(1500);const after=await sample();
 assert.ok(after.draws>before.draws);
 assert.equal(after.draws-before.draws,after.callbacks-before.callbacks,'Every showroom display callback must render; no software FPS cap');
 await p.getByRole('link',{name:'My garage',exact:true}).click();
 for(const vehicle of ['scooter','bike','car']) {
  await p.locator(`#garageVehicles [data-vehicle="${vehicle}"]`).click();
  await p.waitForFunction(id=>window.pluggoPerformance().ready&&window.pluggoPerformance().vehicle===id,vehicle);
  assert.ok((await p.evaluate(()=>pluggoPerformance())).cachedModels<=2);
 }
 await p.getByRole('switch',{name:'Animate vehicle previews'}).uncheck();
 await p.getByRole('link',{name:'Home',exact:true}).click();await p.waitForTimeout(1000);await p.waitForFunction(()=>!window.pluggoPerformance().running);
 const idle=await p.evaluate(()=>pluggoPerformance().renderedFrames);await p.waitForTimeout(600);assert.equal(await p.evaluate(()=>pluggoPerformance().renderedFrames),idle);
 await p.evaluate(()=>window.dispatchEvent(new Event('pluggo:memorypressure')));
 await p.locator('#vehicleFallback').waitFor({state:'visible'});assert.equal(await p.locator('#vehicleCanvas').isVisible(),false);assert.equal(await p.evaluate(()=>pluggoPerformance().cachedModels),0);
 const poster=await context.newPage();let modelRequests=0;poster.on('request',r=>{if(/\.glb(?:\?|$)|three\.(?:core\.|module\.)min\.js/.test(r.url()))modelRequests++;});
 await poster.goto('http://127.0.0.1:4173/?demo=1&performance=poster');
 await poster.locator('#vehicleFallback').waitFor({state:'visible'});
 await poster.locator('#vehicleDropdown summary').click();await poster.getByRole('menuitemradio',{name:/Urban Scooter/}).click();
 await poster.getByRole('link',{name:'Stations',exact:true}).click();
 assert.equal(await poster.locator('#stationSelection').evaluate(e=>getComputedStyle(e).backdropFilter),'blur(20px) saturate(1.1)');
 await poster.getByRole('button',{name:'View Central Circle',exact:true}).click();await poster.locator('[data-connector="CP-03"]').check();await poster.locator('#selectCharger').click();await poster.getByRole('button',{name:'Start simulated charging'}).click();await poster.getByRole('button',{name:'Stop demo charging'}).click();await poster.getByRole('button',{name:'Continue to demo checkout'}).click();await poster.getByRole('button',{name:'Complete demo payment · ₹0'}).click();
 assert.match(await poster.locator('#dialogBody').innerText(),/Demo payment completed/);assert.equal(modelRequests,0);assert.deepEqual(errors,[]);
 await context.close();console.log('PASS: low-memory policy, uncapped display-frame rendering, sharp antialiased rendering, bounded model cache, idle sleep, memory-pressure cleanup, poster mode without GLB/Three downloads, 20px glass and complete charging flow.');
}finally{await browser.close();}
