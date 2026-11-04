import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1200,height:850}});
await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,options){return get.call(this,type,type.startsWith('webgl')?{...options,preserveDrawingBuffer:true}:options);};});
await page.goto('http://127.0.0.1:4173/?demo=1');
await page.evaluate(async()=>{
 document.body.innerHTML='<div class="vehicle-stage" style="width:1100px;height:740px"><div class="stage-watermark"></div><div id="poster" style="width:1100px;height:740px"></div></div>';
 const {createShowroom}=await import('./vehicle-scene.js');
 window.posterScene=createShowroom(document.querySelector('#poster'),()=>{throw Error('render failed')});
 window.posterScene.setMotion(false);
});
for(const id of ['car','scooter','bike','cargo']){
 await page.evaluate(async id=>{await window.posterScene.setVehicle(id);},id);
 const data=await page.evaluate(()=>{const c=document.querySelector('#poster canvas');window.posterScene.reset();return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const copy=document.createElement('canvas');copy.width=c.width;copy.height=c.height;copy.getContext('2d').drawImage(c,0,0);resolve(copy.toDataURL('image/png').split(',')[1]);})));});
 await writeFile(`frontend/assets/models/${id}-poster.png`,Buffer.from(data,'base64'));
 await page.screenshot({path:`docs/web-preview/${id}-white.png`});
}
}finally{await browser.close();}
