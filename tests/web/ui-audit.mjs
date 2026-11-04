import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const folder=process.env.AUDIT_FOLDER||'docs/ui-audit/before';await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const results=[];
try {for(const [device,width,height] of [['desktop',1440,1000],['phone',390,844]]){
 const context=await browser.newContext({viewport:{width,height}});const p=await context.newPage();const capture=async options=>{await p.waitForTimeout(550);await p.screenshot(options);};const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.BACKEND_AUDIT==='1' ? 'http://127.0.0.1:4173/' : 'http://127.0.0.1:4173/?demo=1');if(process.env.BACKEND_AUDIT==='1')await p.waitForFunction(()=>window.pluggoBackend?.connected);await p.waitForFunction(()=>window.pluggoPerformance?.().ready);
 for(const route of ['home','stations','sessions','garage']){
  await p.getByRole('link',{name:route==='home'?'Home':route==='stations'?'Stations':route==='sessions'?'Sessions':'My garage',exact:true}).click();
  await p.locator(`#page-${route}`).waitFor({state:'visible'});await p.waitForTimeout(route==='stations'?1200:400);if(route==='stations')await p.waitForFunction(()=>document.querySelectorAll('.leaflet-tile-loaded').length>0,{},{timeout:10000}).catch(()=>{});
  await capture({path:`${folder}/${device}-${route}.png`,fullPage:true});
  await capture({path:`${folder}/${device}-${route}-viewport.png`});
  results.push({device,route,...await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,smallText:[...document.querySelectorAll('.page.active p,.page.active small,.page.active button,.page.active label')].filter(e=>e.getBoundingClientRect().height&&parseFloat(getComputedStyle(e).fontSize)<10).length})),errors:[...errors]});
 }
 await p.getByRole('link',{name:'Stations',exact:true}).click();await p.locator('#stationSelection [data-station="CP"]').click();
 await capture({path:`${folder}/${device}-station-details.png`,fullPage:false});
 await p.locator('#selectCharger').click();await capture({path:`${folder}/${device}-charge-setup.png`,fullPage:false});
 await p.locator('#chargePlan button[type="submit"],#dialogActions button[form="chargePlan"]').click();
 await capture({path:`${folder}/${device}-charging.png`,fullPage:false});
 await p.getByRole('button',{name:'Stop demo charging'}).click();await p.getByRole('button',{name:'Continue to demo checkout'}).click();
 await capture({path:`${folder}/${device}-checkout.png`,fullPage:false});
 await p.getByRole('button',{name:'Complete demo payment · ₹0'}).click();await capture({path:`${folder}/${device}-receipt.png`,fullPage:false});
 await p.locator('#closeDialog').click();await p.getByRole('link',{name:'Sessions',exact:true}).click();await p.locator('#page-sessions').waitFor({state:'visible'});await p.waitForTimeout(400);
 await capture({path:`${folder}/${device}-sessions-history.png`,fullPage:true});
 if(process.env.BACKEND_AUDIT==='1')await context.request.post('http://127.0.0.1:4173/api/customer/reset',{headers:{'X-Pluggo-Request':'1'},data:{}});
 await context.close();
}await writeFile(`${folder}/metrics.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
