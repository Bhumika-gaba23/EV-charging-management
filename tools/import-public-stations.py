"""Build database/seed/public_stations.json: real EV charging stations in India.

Sources
- OpenStreetMap via the Overpass API (always; no key). Data © OpenStreetMap contributors, ODbL.
- Open Charge Map (optional): set OCM_API_KEY (free at https://openchargemap.org/site/develop/api).
  Data licensed CC BY 4.0 by Open Charge Map contributors.

Stations within 75 m of each other with compatible names are merged, keeping OSM's name and
adding Open Charge Map's connector details. Run from the repository root:

    python tools/import-public-stations.py            # OSM only
    OCM_API_KEY=... python tools/import-public-stations.py

The server loads the file at start-up (CHARGEFLOW_PUBLIC_STATIONS_FILE). Re-run monthly.
"""
import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'database/seed/public_stations.json'
USER_AGENT = 'pluggo-station-import/1.0 (open-source EV charging project)'
OVERPASS = 'https://overpass-api.de/api/interpreter'
OVERPASS_QUERY = '''[out:json][timeout:240];
area["ISO3166-1"="IN"][admin_level=2]->.india;
nwr["amenity"="charging_station"](area.india);
out center tags;'''

# OSM socket:* keys and Open Charge Map connection type IDs mapped to the names drivers know.
OSM_SOCKETS = {
    'type2_combo': 'CCS2', 'ccs2': 'CCS2', 'ccs': 'CCS2', 'type2': 'Type 2', 'type2_cable': 'Type 2', 'chademo': 'CHAdeMO',
    'type1_combo': 'CCS1', 'type1': 'Type 1', 'gb_dc': 'GB/T DC', 'gb_ac': 'GB/T AC',
    'bharat_ac001': 'Bharat AC-001', 'bharat_dc001': 'Bharat DC-001', 'type3c': 'Type 3',
    'schuko': '3-pin socket', 'bs1363': '3-pin socket', 'typeg': '3-pin socket', 'typed': '3-pin socket',
    'tesla_supercharger': 'Tesla', 'tesla_destination': 'Tesla',
}
OCM_CONNECTIONS = {
    33: 'CCS2', 25: 'Type 2', 1036: 'Type 2', 2: 'CHAdeMO', 32: 'CCS1', 1: 'Type 1',
    1038: 'GB/T DC', 1039: 'GB/T AC', 28: '3-pin socket', 3: '3-pin socket', 27: 'Tesla', 30: 'Tesla',
}


def fetch(url, data=None):
    request = urllib.request.Request(url, data=data, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.load(response)


def clean(value, limit=120):
    value = re.sub(r'\s+', ' ', str(value or '')).strip()
    return value[:limit]


def osm_stations():
    data = fetch(OVERPASS, urllib.parse.urlencode({'data': OVERPASS_QUERY}).encode())
    stations = []
    for element in data.get('elements', []):
        tags = element.get('tags', {})
        lat = element.get('lat', element.get('center', {}).get('lat'))
        lng = element.get('lon', element.get('center', {}).get('lon'))
        if lat is None or lng is None:
            continue
        sockets = sorted({OSM_SOCKETS.get(key.split(':')[1], key.split(':')[1].replace('_', ' ').title())
                          for key, value in tags.items()
                          if key.count(':') == 1 and key.startswith('socket:') and value not in ('no', '0')})
        address = ', '.join(part for part in (clean(tags.get('addr:street')), clean(tags.get('addr:suburb')),
                                              clean(tags.get('addr:city')), clean(tags.get('addr:state'))) if part)
        stations.append({
            'id': f"osm:{element['type']}/{element['id']}",
            'name': clean(tags.get('name') or tags.get('brand') or tags.get('operator') or 'EV charging station'),
            'operator': clean(tags.get('operator') or tags.get('network') or tags.get('brand')),
            'lat': round(lat, 6), 'lng': round(lng, 6), 'address': address,
            'city': clean(tags.get('addr:city') or tags.get('addr:district'), 60),
            'state': clean(tags.get('addr:state'), 60),
            'sockets': sockets,
            'capacity': int(tags['capacity']) if str(tags.get('capacity', '')).isdigit() else None,
            'access': clean(tags.get('access'), 20),
            'hours': clean(tags.get('opening_hours'), 80),
            'fee': clean(tags.get('fee'), 20),
            'sources': ['osm'],
        })
    return stations


def ocm_stations(key):
    query = urllib.parse.urlencode({'countrycode': 'IN', 'maxresults': 20000, 'compact': 'true', 'verbose': 'false', 'key': key})
    stations = []
    for poi in fetch('https://api.openchargemap.io/v3/poi/?' + query):
        info = poi.get('AddressInfo') or {}
        if info.get('Latitude') is None or info.get('Longitude') is None:
            continue
        sockets = sorted({OCM_CONNECTIONS.get(c.get('ConnectionTypeID'), '') for c in poi.get('Connections') or []} - {''})
        address = ', '.join(part for part in (clean(info.get('AddressLine1')), clean(info.get('Town')),
                                              clean(info.get('StateOrProvince'))) if part)
        stations.append({
            'id': f"ocm:{poi['ID']}", 'name': clean(info.get('Title') or 'EV charging station'), 'operator': '',
            'lat': round(info['Latitude'], 6), 'lng': round(info['Longitude'], 6), 'address': address,
            'city': clean(info.get('Town'), 60), 'state': clean(info.get('StateOrProvince'), 60), 'sockets': sockets,
            'capacity': poi.get('NumberOfPoints'), 'access': '', 'hours': clean(info.get('AccessComments'), 80), 'fee': '',
            'sources': ['ocm'],
        })
    return stations


def distance_m(a, b):
    lat1, lat2 = math.radians(a['lat']), math.radians(b['lat'])
    dlat, dlng = lat2 - lat1, math.radians(b['lng'] - a['lng'])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def words(name):
    return set(re.findall(r'[a-z0-9]{3,}', name.lower())) - {'charging', 'station', 'electric', 'vehicle', 'charger'}


def merge(base, extra):
    """Adds Open Charge Map stations, folding near-duplicates into the OSM entry."""
    grid = {}
    for station in base:
        grid.setdefault((round(station['lat'], 3), round(station['lng'], 3)), []).append(station)
    added = merged = 0
    for station in extra:
        cell = (round(station['lat'], 3), round(station['lng'], 3))
        nearby = [s for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                  for s in grid.get((round(cell[0] + dx / 1000, 3), round(cell[1] + dy / 1000, 3)), [])]
        match = next((s for s in nearby if distance_m(s, station) <= 75 and
                      (not words(s['name']) or not words(station['name']) or words(s['name']) & words(station['name']))), None)
        if match:
            match['sockets'] = sorted(set(match['sockets']) | set(station['sockets']))
            match['capacity'] = match['capacity'] or station['capacity']
            match['address'] = match['address'] or station['address']
            match['city'] = match['city'] or station['city']
            match['state'] = match['state'] or station['state']
            match['sources'] = sorted(set(match['sources']) | {'ocm'})
            merged += 1
        else:
            base.append(station)
            grid.setdefault(cell, []).append(station)
            added += 1
    return added, merged


def main():
    print('Downloading OpenStreetMap charging stations for India...', flush=True)
    stations = osm_stations()
    print(f'  {len(stations)} from OpenStreetMap')
    sources = [{'name': 'OpenStreetMap contributors', 'license': 'ODbL 1.0', 'url': 'https://www.openstreetmap.org/copyright'}]
    key = os.getenv('OCM_API_KEY', '').strip()
    if key:
        print('Downloading Open Charge Map stations for India...', flush=True)
        extra = ocm_stations(key)
        added, merged = merge(stations, extra)
        print(f'  {len(extra)} from Open Charge Map: {added} added, {merged} merged into OpenStreetMap entries')
        sources.append({'name': 'Open Charge Map contributors', 'license': 'CC BY 4.0', 'url': 'https://openchargemap.org'})
    else:
        print('  OCM_API_KEY not set: skipping Open Charge Map')
    if len(stations) < 100:
        sys.exit(f'Only {len(stations)} stations downloaded; refusing to overwrite {OUTPUT}')
    stations.sort(key=lambda s: s['id'])
    payload = {'updatedAt': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'country': 'IN',
               'sources': sources, 'count': len(stations), 'stations': stations}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Wrote {len(stations)} stations to {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
