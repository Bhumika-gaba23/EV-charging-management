import {readFile,writeFile} from 'node:fs/promises';
const path='frontend/data/india-stations.json';
const data=JSON.parse(await readFile(path,'utf8'));
const source='https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/india.geojson';
const response=await fetch(source);if(!response.ok)throw new Error(`Boundary lookup failed: ${response.status}`);
const boundaries=await response.json();
function ringContains([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function contains(point,geometry){const polys=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];return polys.some(poly=>ringContains(point,poly[0])&&!poly.slice(1).some(r=>ringContains(point,r)));}
const states=new Map();
for(const feature of boundaries.features){const name=feature.properties.st_nm;let bounds=states.get(name)||[90,180,-90,-180];const polys=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];for(const poly of polys)for(const ring of poly)for(const [x,y] of ring){bounds=[Math.min(bounds[0],y),Math.min(bounds[1],x),Math.max(bounds[2],y),Math.max(bounds[3],x)];}states.set(name,bounds);}
let count=0;
for(const station of data.stations){const feature=boundaries.features.find(f=>contains([station.lon,station.lat],f.geometry));if(feature){station.state=feature.properties.st_nm;count++;}}
if(!count)throw new Error('No state assignments; directory preserved.');
data.stateRegions=[...states].sort(([a],[b])=>a.localeCompare(b)).map(([name,bounds])=>({name,bounds}));
data.stateLookupSource=source;
await writeFile(path,JSON.stringify(data));console.log(`Assigned states to ${count}/${data.stations.length} stations; ${states.size} states and UTs indexed.`);
