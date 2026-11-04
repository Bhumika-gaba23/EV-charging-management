// Refresh the public India directory; run manually, not once per visitor.
import { mkdir, writeFile } from 'node:fs/promises';
const query = '[out:json][timeout:120];area["ISO3166-1"="IN"][admin_level=2]->.india;nwr[amenity=charging_station](area.india);out center tags;';
const response = await fetch('https://overpass.kumi.systems/api/interpreter', {
  method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'VoltWayStationDirectory/1.0'},
  body:new URLSearchParams({data:query}), signal:AbortSignal.timeout(150000)
});
if (!response.ok) throw new Error(`Station source returned ${response.status}`);
const data = await response.json();
if (data.remark) throw new Error(data.remark);
const stations = data.elements.map(item => ({id:`${item.type}/${item.id}`,lat:item.lat ?? item.center?.lat,lon:item.lon ?? item.center?.lon,tags:item.tags || {}})).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon));
if (!stations.length) throw new Error('Empty station directory; previous data preserved.');
await mkdir('frontend/data',{recursive:true});
await writeFile('frontend/data/india-stations.json',JSON.stringify({source:'OpenStreetMap contributors',license:'ODbL',updatedAt:new Date().toISOString(),stations}));
console.log(`Saved ${stations.length} India charging-station listings.`);
