import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 // A style saved by the previous release ("glass") must fall back to Dark instead of breaking the page.
 await ctx.addInitScript(()=>{if(!localStorage.getItem('seeded')){localStorage.setItem('seeded','1');localStorage.setItem('pluggo.style','glass');}});
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/?demo=1#settings');await p.locator('#page-settings').waitFor({state:'visible'});
 assert.equal(await p.evaluate(()=>document.documentElement.dataset.style),'dark');
 assert.equal(await p.locator('[data-app-style]').count(),2);
 // Every glass surface uses the same 20px blur; the slider starts mid-way and only changes the tint.
 const blur=sel=>p.locator(sel).first().evaluate(e=>getComputedStyle(e).backdropFilter);
 assert.match(await blur('.settings-group'),/blur\(20px\)/);assert.match(await blur('.glass-nav'),/blur\(20px\)/);
 assert.equal(await p.locator('#glassLevel').inputValue(),'60');
 const tint=()=>p.locator('.settings-group').first().evaluate(e=>+getComputedStyle(e).backgroundColor.match(/[\d.]+/g).pop());
 await p.locator('#glassLevel').fill('0');const clear=await tint();
 await p.locator('#glassLevel').fill('100');const frosted=await tint();
 assert.ok(frosted>clear+0.4,`frosted ${frosted} should be much denser than clear ${clear}`);
 assert.match(await blur('.settings-group'),/blur\(20px\)/,'blur stays 20px at every level');
 // The choice is remembered, applies in Light too, and no lens-refraction filter is left behind.
 await p.locator('#glassLevel').fill('30');await p.reload();assert.equal(await p.locator('#glassLevel').inputValue(),'30');
 await p.locator('[data-app-style="light"]').click();assert.equal(await p.evaluate(()=>document.documentElement.dataset.style),'light');
 assert.match(await blur('.settings-group'),/blur\(20px\)/);
 assert.equal(await p.locator('#lg-refract').count(),0);
 // Light carries no drop shadows at all.
 assert.equal(await p.locator('.settings-group').first().evaluate(e=>getComputedStyle(e).boxShadow),'none');
 assert.deepEqual(errors,[]);
 console.log('PASS: one 20px blur, a clear-to-frosted slider that persists, Dark and Light only (old "glass" falls back to Dark), no refraction filter, no Light shadows.');
}finally{await browser.close();}
