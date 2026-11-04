import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/#sessions');await p.waitForFunction(()=>window.pluggoBackend?.connected);
 assert.equal(await p.locator('.summary-stat').count(),4);assert.match(await p.locator('.summary-stat').nth(3).innerText(),/0/);
 const request=context.request,base='http://127.0.0.1:4173/api/customer/';
 const headers={'X-Pluggo-Request':'1','Idempotency-Key':crypto.randomUUID()};
 let r=await request.post(base+'sessions',{headers,data:{station:'CP',connector:'CP-01',vehicle:'car',target:80,budget:300}});assert.equal(r.status(),200);const start=await r.json(),id=start.sessionId;
 let delivered=0;
 for(let i=0;i<40&&delivered<.1;i++) {
  const state=await request.get(base+'state').then(r=>r.json());delivered=state.state.sessions[0]?.energy||0;
  if(delivered<.1)await p.waitForTimeout(150);
 }
 assert.ok(delivered>=.1,'Real simulator must deliver measurable energy before stopping');
 r=await request.post(base+`sessions/${id}/stop`,{headers,data:{}});assert.equal(r.status(),200);
 r=await request.post(base+`sessions/${id}/checkout`,{headers,data:{}});assert.equal(r.status(),200);const data=await r.json(),s=data.state.sessions[0];
 await p.waitForFunction(()=>document.querySelectorAll('.summary-stat')[3].querySelector('strong').textContent==='1');
 assert.equal(await p.locator('.summary-stat').first().locator('strong').innerText(),`₹${s.cost.toFixed(2)}`);assert.match(await p.locator('.summary-stat').first().innerText(),/₹0.00 actually collected/);
 assert.equal(await p.locator('.summary-stat').nth(1).locator('strong').innerText(),`${s.energy.toFixed(2)} kWh`);
 for(const period of ['week','all','month']) {await p.locator(`[data-summary-period="${period}"]`).click();assert.equal(await p.locator(`[data-summary-period="${period}"]`).getAttribute('aria-pressed'),'true');}
 await p.reload();await p.waitForFunction(()=>window.pluggoBackend?.connected);await p.waitForFunction(()=>document.querySelectorAll('.summary-stat')[3].querySelector('strong').textContent==='1');
 for(const width of [320,390,1440]) {await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(700);await mkdir('docs/ui-audit/session-summary',{recursive:true});await p.screenshot({path:'docs/ui-audit/session-summary/phone-sessions.png'});
 await request.post(base+'reset',{headers,data:{}});await p.reload();await p.waitForFunction(()=>window.pluggoBackend?.connected);await p.waitForFunction(()=>document.querySelectorAll('.summary-stat')[3].querySelector('strong').textContent==='0');
 assert.deepEqual(errors,[]);console.log('PASS: real backend totals after charging/checkout, estimated cost vs collected amount, period controls, reload persistence, reset and responsive layout.');
}finally{await browser.close();}
