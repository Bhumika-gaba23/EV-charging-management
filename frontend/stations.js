(() => {
  'use strict';
  const el = id => document.getElementById(id);
  document.querySelector('.station-search label').textContent='Search state, city, station or operator';
  el('stationSearch').placeholder='Try Kerala, Karnataka, Bengaluru…';
  let map, layer, userMarker, userPosition, stations = [], filtered = [], selectedId;
  const markers = new Map();
  let searchTimer;
  let stateRegions=[];
  const normalize=text=>String(text).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
  const indiaBounds = [[6.5,68],[37.6,97.6]];
  const cities = {delhi:[28.6139,77.209],mumbai:[19.076,72.8777],bengaluru:[12.9716,77.5946],bangalore:[12.9716,77.5946],chennai:[13.0827,80.2707],hyderabad:[17.385,78.4867],pune:[18.5204,73.8567],kolkata:[22.5726,88.3639],ahmedabad:[23.0225,72.5714],jaipur:[26.9124,75.7873],lucknow:[26.8467,80.9462],chandigarh:[30.7333,76.7794],kochi:[9.9312,76.2673],gurugram:[28.4595,77.0266],gurgaon:[28.4595,77.0266],noida:[28.5355,77.391],bhopal:[23.2599,77.4126],indore:[22.7196,75.8577],nagpur:[21.1458,79.0882],surat:[21.1702,72.8311],goa:[15.4909,73.8278],patna:[25.5941,85.1376],bhubaneswar:[20.2961,85.8245],guwahati:[26.1445,91.7362],srinagar:[34.0837,74.7973],thiruvananthapuram:[8.5241,76.9366],coimbatore:[11.0168,76.9558],visakhapatnam:[17.6868,83.2185],ranchi:[23.3441,85.3096],raipur:[21.2514,81.6296],dehradun:[30.3165,78.0322]};
  function escape(value) { return String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function distance(a,b) {
    const rad = x => x * Math.PI / 180;
    const dLat=rad(b[0]-a[0]), dLon=rad(b[1]-a[1]);
    const h=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;
    return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function sockets(tags) {
    const names={type2_combo:'CCS2',type1_combo:'CCS1',type2:'Type 2',type2_cable:'Type 2 cable',chademo:'CHAdeMO',bharat_ac001:'Bharat AC',bharat_dc001:'Bharat DC',cee_blue:'Industrial AC',chademo_combo:'CHAdeMO'};
    return Object.entries(tags).filter(([k,v]) => /^socket:[^:]+$/.test(k) && v!=='0' && v!=='no').map(([k,v]) => `${names[k.slice(7)] || k.slice(7).replaceAll('_',' ')}${/^\d+$/.test(v)?` ×${v}`:''}`);
  }
  function name(s) { return s.tags.name || s.tags['name:en'] || s.tags.brand || s.tags.operator || 'EV charging station'; }
  function address(s) { const t=s.tags; return [t['addr:housenumber'],t['addr:street'],t['addr:suburb'],t['addr:city'],t['addr:state'],t['addr:postcode']].filter(Boolean).join(', ') || t['addr:full'] || 'Address not listed'; }
  function row(label,value) { return `<div><dt>${escape(label)}</dt><dd>${escape(value || 'Not listed')}</dd></div>`; }
  function safeLink(value) { try {const url=new URL(value); return ['https:','http:'].includes(url.protocol)?url.href:null;} catch {return null;} }
  function selectStation(id, pan = true) {
    const s=stations.find(item=>item.id===id); if(!s)return;
    selectedId=id;
    markers.forEach((marker,key)=>marker.setStyle({radius:key===id?8:5,fillColor:key===id?'#e39d42':'#245c40',weight:key===id?3:1}));
    const t=s.tags, connector=sockets(t).join(', '), power=Object.entries(t).filter(([k])=>k.endsWith(':output')).map(([,v])=>v).join(', ');
    const phone=t['contact:phone'] || t.phone;
    const website=safeLink(t.website || t['contact:website']);
    const directions=`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=driving`;
    el('stationDetail').hidden=false;
    el('stationDetail').innerHTML=`<article class="station-detail"><button class="detail-close" type="button" aria-label="Close station details">CLOSE ×</button><p class="eyebrow">STATION DETAILS</p><h2>${escape(name(s))}</h2><dl>${row('Operator',t.operator || t.brand)}${row('Address',address(s))}${row('Connectors',connector)}${row('Power',power)}${row('Hours',t.opening_hours)}${row('Access',t.access)}${row('Pricing',t.charge || (t.fee==='no'?'Listed as free; confirm with operator':'Not provided — check operator'))}${row('Live bays','Not supplied by public directory')}${row('Phone',phone)}${row('Distance',userPosition?`${distance(userPosition,[s.lat,s.lon]).toFixed(1)} km straight-line`:'Use Near me')}${row('Coordinates',`${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`)}</dl>${website?`<p><a href="${escape(website)}" target="_blank" rel="noopener noreferrer">Operator website ↗</a></p>`:''}<a class="directions-link" href="${directions}" target="_blank" rel="noopener noreferrer">GET DIRECTIONS ↗</a><p class="station-data-note"><a href="https://www.openstreetmap.org/${escape(s.id)}" target="_blank" rel="noopener noreferrer">View source listing ↗</a></p></article>`;
    el('stationDetail').querySelector('button').onclick=()=>{el('stationDetail').hidden=true;selectedId=null;};
    if(pan && map)map.setView([s.lat,s.lon],15,{animate:false});
    el('stationDetail').parentElement.scrollTop=0;
  }
  function list() {
    el('stationCount').textContent=`${filtered.length.toLocaleString('en-IN')} stations${userPosition?' · nearest first':''}`;
    if(!filtered.length)el('stationCount').textContent='No matching stations. Try another state or reset filters.';
  }
  function filter(fit = false) {
    const query=el('stationSearch').value.trim().toLowerCase(), city=cities[query], connector=el('stationConnector').value, access=el('stationAccess').value;
    const queryState=stateRegions.find(region=>normalize(region.name)===normalize(query));
    const selectedState=el('stationState').value;
    filtered=stations.filter(s=>{
      const t=s.tags, text=Object.values(t).join(' ').toLowerCase();
      if(selectedState!=='all' && s.state!==selectedState)return false;
      if(map && el('stationsInView').checked && !map.getBounds().contains([s.lat,s.lon]))return false;
      if(query && !(queryState?s.state===queryState.name:city?distance(city,[s.lat,s.lon])<65:`${text} ${s.state || ''}`.toLowerCase().includes(query)))return false;
      if(access==='public' && !['yes','public','permissive'].includes(t.access))return false;
      const types=sockets(t).join(' ').toLowerCase();
      if(connector==='ccs' && !types.includes('ccs'))return false;
      if(connector==='type2' && !types.includes('type 2'))return false;
      if(connector==='chademo' && !types.includes('chademo'))return false;
      if(connector==='bharat' && (!types || /ccs|type 2|chademo/.test(types)))return false;
      return true;
    });
    const sortOrigin=userPosition || city;
    filtered.sort((a,b)=>sortOrigin?distance(sortOrigin,[a.lat,a.lon])-distance(sortOrigin,[b.lat,b.lon]):name(a).localeCompare(name(b)));
    list();
    if(map){
      const ids=new Set(filtered.map(s=>s.id));
      markers.forEach((marker,id)=>{if(ids.has(id)){if(!layer.hasLayer(marker))layer.addLayer(marker);}else if(layer.hasLayer(marker))layer.removeLayer(marker);});
      if(fit && filtered.length)map.fitBounds(filtered.map(s=>[s.lat,s.lon]),{padding:[24,24],maxZoom:13,animate:false});
      if(fit && !filtered.length && city)map.setView(city,11);
      const region=queryState || stateRegions.find(r=>r.name===selectedState);
      if(fit && region)map.fitBounds([[region.bounds[0],region.bounds[1]],[region.bounds[2],region.bounds[3]]],{padding:[16,16],animate:false});
    }
    if(selectedId && !filtered.some(s=>s.id===selectedId))el('stationDetail').hidden=true;
  }
  function locate() {
    if(!navigator.geolocation){el('locationStatus').textContent='Location is unsupported. Search for your city instead.';return;}
    el('locateStations').disabled=true;el('locationStatus').textContent='Waiting for location permission…';
    navigator.geolocation.getCurrentPosition(position=>{
      userPosition=[position.coords.latitude,position.coords.longitude];
      el('stationState').value='all';
      el('stationsInView').checked=false;
      el('locateStations').disabled=false;
      el('stationSearch').value='';el('stationConnector').value='all';el('stationAccess').value='all';filter();
      el('locationStatus').textContent=`Nearest listings sorted by straight-line distance · location accuracy ±${Math.round(position.coords.accuracy)} m. Directions show the driving route.`;
      if(map){if(userMarker)map.removeLayer(userMarker);userMarker=L.circleMarker(userPosition,{radius:9,color:'#fff',weight:3,fillColor:'#287bde',fillOpacity:1}).bindTooltip('Your location').addTo(map);map.setView(userPosition,12);}
    },error=>{el('locateStations').disabled=false;el('locationStatus').textContent=error.code===1?'Location permission denied. Search your city instead, or allow location in your browser settings.':'Could not determine your location. Search your city or try Near me again.';},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
  }
  async function init() {
    if(window.L){
      map=L.map('indiaStationMap',{preferCanvas:true,scrollWheelZoom:false}).fitBounds(indiaBounds);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
      layer=L.layerGroup().addTo(map);
      map.on('moveend',()=>{if(el('stationsInView').checked)filter();});
      new ResizeObserver(()=>map.invalidateSize()).observe(el('indiaStationMap'));
    }else el('indiaStationMap').innerHTML='<p class="station-empty">Map could not load. Station search and details are still available below.</p>';
    try {
      const response=await fetch('data/india-stations.json');if(!response.ok)throw new Error();
      const data=await response.json();stations=data.stations;
      stateRegions=data.stateRegions || [];
      el('stationState').innerHTML='<option value="all">All states</option>'+stateRegions.map(region=>`<option value="${escape(region.name)}">${escape(region.name)} (${stations.filter(s=>s.state===region.name).length})</option>`).join('');
      if(map)stations.forEach(s=>markers.set(s.id,L.circleMarker([s.lat,s.lon],{radius:5,color:'#fff',weight:1,fillColor:'#245c40',fillOpacity:.9}).on('click',()=>selectStation(s.id,false))));
      el('stationDataNote').innerHTML=`OpenStreetMap directory · Updated ${escape(new Date(data.updatedAt).toLocaleDateString('en-IN'))} · Coverage may be incomplete. Live availability and prices are not verified. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a>`;
      filter();
    }catch{el('stationCount').textContent='Directory unavailable. Refresh to retry.';}
  }
  el('stationSearchForm').addEventListener('submit',event=>{event.preventDefault();filter(true);});
  el('stationSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>filter(true),300);});
  el('stationsInView').addEventListener('change',()=>filter());
  el('stationState').addEventListener('change',()=>{clearTimeout(searchTimer);el('stationSearch').value='';el('stationsInView').checked=false;filter(true);});
  const mapCard=document.querySelector('.station-map-card');
  function expandMap(expand){
    mapCard.classList.toggle('expanded',expand);
    el('expandStationMap').setAttribute('aria-expanded',String(expand));
    el('expandStationMap').textContent=expand?'CLOSE ×':'EXPAND ↗';
    requestAnimationFrame(()=>map?.invalidateSize());
  }
  el('expandStationMap').onclick=()=>expandMap(!mapCard.classList.contains('expanded'));
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && mapCard.classList.contains('expanded')){expandMap(false);el('expandStationMap').focus();}});
  el('stationConnector').addEventListener('change',()=>filter());el('stationAccess').addEventListener('change',()=>filter());
  el('resetStationMap').onclick=()=>{clearTimeout(searchTimer);el('stationState').value='all';el('stationsInView').checked=false;el('stationSearch').value='';el('stationConnector').value='all';el('stationAccess').value='all';el('stationDetail').hidden=true;filter();map?.fitBounds(indiaBounds);};
  el('locateStations').onclick=locate;
  init();
})();
