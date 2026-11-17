import {chromium} from 'playwright';import assert from 'node:assert/strict';
import {stations,vehicles} from '../../frontend/demo-data.js';
// A fake charging server that, like the one that shipped, still lists the OLD vehicle pictures (with the baked-in shadow).
const catalogVehicles=Object.fromEntries(Object.entries(vehicles).map(([id,v])=>[id,{...v,image:`assets/models/${id}-poster.png?v=silver-5`}]));
const payload={ok:true,state:{vehicle:'scooter',saved:[],sessions:[]},catalog:{stations,vehicles:catalogVehicles},account:{signedIn:false,phone:''},
 backend:{authRequired:true,firebase:{projectId:'demo',apiKey:'demo',authDomain:'demo.firebaseapp.com',appId:'demo'},payments:'razorpay',storage:'sqlite',simulationMode:'meter',simulatorConnected:true}};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await ctx.route('**/api/customer/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)}));
 await ctx.route('https://www.gstatic.com/**',route=>route.abort());
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/');await p.waitForFunction(()=>window.pluggoBackend?.connected);
 // 1. The app keeps its own clean pictures even though the server lists the old ones.
 await p.waitForFunction(()=>document.querySelector('#vehicleFallback').src.includes('scooter-poster-clean'));
 assert.equal(await p.locator('#vehicleFallback').evaluate(e=>e.src.includes('silver-5')),false);
 await p.goto('http://127.0.0.1:4173/#garage');await p.locator('#garageVehicles img').first().waitFor();
 for(const src of await p.locator('#garageVehicles img').evaluateAll(a=>a.map(i=>i.getAttribute('src'))))assert.match(src,/-poster-clean\.png/);
 // 2. Sign-in is a plain sheet, not a modal one, so a CAPTCHA box can float above it.
 await p.goto('http://127.0.0.1:4173/#settings');await p.locator('#signInButton').click();
 assert.equal(await p.locator('#flowDialog').evaluate(d=>d.open&&!d.matches(':modal')),true);
 assert.equal(await p.locator('#dialogScrim').isVisible(),true);
 // Stand-in for Google's reCAPTCHA box: added to the page with a huge z-index, like the real one.
 await p.evaluate(()=>{const c=document.createElement('div');c.id='fakeCaptcha';c.style.cssText='position:fixed;left:50px;top:300px;width:260px;height:120px;z-index:2000000000;background:#fff;border:2px solid #4285f4';document.body.append(c);});
 const hit=await p.evaluate(()=>{const r=document.querySelector('#fakeCaptcha').getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.id});
 assert.equal(hit,'fakeCaptcha','the CAPTCHA must be on top of the sign-in sheet');
 await p.mouse.click(180,360);
 assert.equal(await p.locator('#flowDialog').evaluate(d=>d.open),true,'tapping the CAPTCHA must not close the sheet');
 await p.locator('#phoneInput').fill('9999999999');assert.equal(await p.locator('#phoneInput').inputValue(),'9999999999');
 // 3. Escape and the close button still work; the dim layer goes away.
 await p.keyboard.press('Escape');assert.equal(await p.locator('#flowDialog').evaluate(d=>d.open),false);await p.locator('#dialogScrim').waitFor({state:'hidden'});
 // 4. Other sheets are still modal.
 await p.goto('http://127.0.0.1:4173/#stations');await p.locator('#stationSelection [data-station]').first().click();
 assert.equal(await p.locator('#flowDialog').evaluate(d=>d.open&&d.matches(':modal')),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: the app keeps its clean vehicle pictures when the server lists old ones; sign-in is a non-modal sheet that stays open under the CAPTCHA; other sheets stay modal.');
}finally{await browser.close();}
