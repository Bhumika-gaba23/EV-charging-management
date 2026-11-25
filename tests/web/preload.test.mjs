import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync('frontend/index.html','utf8'),app=readFileSync('frontend/chargeflow.js','utf8'),scene=readFileSync('frontend/vehicle-scene.js','utf8'),nginx=readFileSync('deployment/nginx.conf.template','utf8');
test('early-download hints match the URLs the app really imports',()=>{
 const preloaded=[...html.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map(m=>m[1]);
 // The scene module is imported by chargeflow.js with a version; the preload must carry the same one.
 const imported=app.match(/import\("\.\/(vehicle-scene\.js\?v=[^"]+)"\)/)?.[1];
 assert.ok(imported,'chargeflow.js imports vehicle-scene.js');assert.ok(preloaded.includes(imported),`modulepreload must list ${imported}`);
 // Its own static imports must be preloaded too, with identical addresses.
 for(const m of scene.matchAll(/from "\.\/([^"]+)"/g))assert.ok(preloaded.includes(m[1]),`modulepreload must list ${m[1]}`);
 // The import map has to come first or the browser ignores it.
 assert.ok(html.indexOf('type="importmap"')<html.indexOf('rel="modulepreload"'));
});
test('the preloaded model URL matches the one the scene requests',()=>{
 for(const id of ['car','scooter','bike']){
  const requested=scene.match(new RegExp(`${id}: \{ url: "([^"]+)"`))?.[1];
  assert.ok(requested,`${id} url`);
  assert.ok(html.includes(requested.replace(`assets/models/${id}.glb`,'assets/models/" + id + ".glb')),`index.html preloads ${requested}`);
 }
});
test('nginx compresses the 3D models and scripts and caches heavy binaries',()=>{
 assert.match(nginx,/gzip on;/);assert.match(nginx,/gzip_types[^;]*application\/octet-stream/);assert.match(nginx,/max-age=604800/);
 assert.match(nginx,/location \/ \{[^}]*no-cache/,'HTML and scripts stay revalidated');
});
test('the server vehicle catalog points at pictures that exist and carry no baked-in shadow',()=>{
 const catalog=JSON.parse(readFileSync('database/seed/customer_catalog.json','utf8'));
 const images=Object.values(catalog.vehicles).map(v=>v.image);
 assert.equal(images.length,7); // car, scooter, bike, cargo + Pluggo SUV, Hatch, E-Scooter
 for(const image of images){
  assert.match(image,/-poster-clean\.png/,`${image} must be a clean (shadow-free) picture`);
  assert.ok(existsSync('frontend/'+image.split('?')[0]),`${image} must exist`);
 }
 // The app must also refuse to let a server override its pictures.
 assert.match(app,/\{image,\.\.\.profile\}/);
});
