import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/?demo=1#garage');await p.locator('#page-garage').waitFor({state:'visible'});
 await p.locator('[data-app-lang="hi"]').click();
 assert.equal(await p.evaluate(()=>document.documentElement.lang),'hi');
 assert.equal((await p.locator('.glass-nav a[data-page="home"]').innerText()).trim(),'होम');
 assert.equal(await p.locator('#stationSearch').getAttribute('placeholder'),'स्टेशन या इलाका खोजें');
 assert.equal(await p.locator('[data-app-lang="hi"]').getAttribute('aria-checked'),'true');
 // Text the app renders after switching is translated too, and the choice survives a reload.
 await p.goto('http://127.0.0.1:4173/?demo=1#stations');await p.locator('#stationSelection .station-sheet-actions').waitFor();
 assert.match(await p.locator('#stationSelection').innerText(),/चार्जर देखें/);
 await p.goto('http://127.0.0.1:4173/?demo=1#garage');await p.locator('[data-app-lang="en"]').click();
 assert.equal(await p.evaluate(()=>document.documentElement.lang),'en');
 assert.equal((await p.locator('.glass-nav a[data-page="home"]').innerText()).trim(),'Home');
 assert.equal(await p.locator('#stationSearch').getAttribute('placeholder'),'Search a station or area');
 assert.deepEqual(errors,[]);
 console.log('PASS: Hindi switch translates text and attributes, follows newly rendered content, persists across reloads and restores English.');
}finally{await browser.close();}
