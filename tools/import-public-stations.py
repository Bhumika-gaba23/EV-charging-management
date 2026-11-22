"""Build database/seed/public_stations.json: real EV charging stations in India. Free, no keys.

Sources
- Open Charge Map, from its public data export on GitHub (github.com/openchargemap/ocm-export):
  addresses, operators, connector types, power and prices. CC BY 4.0, Open Charge Map contributors.
- OpenStreetMap via the Overpass API: adds stations Open Charge Map does not list.
  ODbL, © OpenStreetMap contributors. Skipped with a warning if Overpass is busy.

Stations within 75 m of each other with compatible names are merged (Open Charge Map's details
win, OpenStreetMap fills gaps). Stations Open Charge Map marks as not operational, planned or
removed are left out. Run from the repository root (needs git and Python 3.9+):

    python tools/import-public-stations.py

The server loads the file at start-up (CHARGEFLOW_PUBLIC_STATIONS_FILE). Re-run monthly.
"""
import datetime as dt
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'database/seed/public_stations.json'
USER_AGENT = 'pluggo-station-import/1.0 (open-source EV charging project)'
OCM_EXPORT = 'https://github.com/openchargemap/ocm-export.git'
OVERPASS = 'https://overpass-api.de/api/interpreter'
OVERPASS_QUERY = '''[out:json][timeout:240];
area["ISO3166-1"="IN"][admin_level=2]->.india;
nwr["amenity"="charging_station"](area.india);
out center tags;'''

# Connector names drivers know. OSM socket:* keys and Open Charge Map connection type IDs.
OSM_SOCKETS = {
    'type2_combo': 'CCS2', 'ccs2': 'CCS2', 'ccs': 'CCS2', 'type2': 'Type 2', 'type2_cable': 'Type 2',
    'chademo': 'CHAdeMO', 'type1_combo': 'CCS1', 'type1': 'Type 1', 'gb_dc': 'GB/T DC', 'gb_ac': 'GB/T AC',
    'bharat_ac001': 'Bharat AC-001', 'bharat_dc001': 'Bharat DC-001', 'type3c': 'Type 3',
    'schuko': '3-pin socket', 'bs1363': '3-pin socket', 'typeg': '3-pin socket', 'typed': '3-pin socket',
    'tesla_supercharger': 'Tesla', 'tesla_destination': 'Tesla',
}
OCM_CONNECTIONS = {
    33: 'CCS2', 25: 'Type 2', 1036: 'Type 2', 2: 'CHAdeMO', 32: 'CCS1', 1: 'Type 1', 1040: 'GB/T DC',
    1038: 'GB/T DC', 1039: 'GB/T AC', 28: '3-pin socket', 3: '3-pin socket', 16: '3-pin socket',
    34: 'Industrial 3-pin', 35: 'Industrial 5-pin', 27: 'Tesla', 30: 'Tesla',
}
OCM_CLOSED = {100, 150, 200, 210}  # not operational, planned, removed, duplicate


def clean(value, limit=120):
    return re.sub(r'\s+', ' ', str(value or '')).strip()[:limit]


def ocm_stations():
    """Open Charge Map's India records from its GitHub export (sparse, shallow clone)."""
    with tempfile.TemporaryDirectory(prefix='ocm-export-') as tmp:
        git = ['git', '-c', 'advice.detachedHead=false']
        subprocess.run(git + ['clone', '-q', '--depth', '1', '--filter=blob:none', '--sparse', OCM_EXPORT, tmp], check=True)
        subprocess.run(git + ['-C', tmp, 'sparse-checkout', 'set', '--skip-checks', 'data/IN', 'data/referencedata.json'], check=True)
        data = Path(tmp) / 'data'
        reference = json.loads((data / 'referencedata.json').read_text(encoding='utf-8'))
        operators = {o['ID']: re.sub(r'\s*\((IN|India)\)$', '', o['Title']) for o in reference['Operators']}
        statuses = {s['ID']: s['Title'] for s in reference['StatusTypes']}
        stations = []
        for path in sorted((data / 'IN').glob('*.json')):
            poi = json.loads(path.read_text(encoding='utf-8'))
            info = poi.get('AddressInfo') or {}
            if info.get('Latitude') is None or info.get('Longitude') is None or poi.get('StatusTypeID') in OCM_CLOSED:
                continue
            connections = poi.get('Connections') or []
            sockets = sorted({OCM_CONNECTIONS.get(c.get('ConnectionTypeID'), '') for c in connections} - {''})
            powers = [c['PowerKW'] for c in connections if isinstance(c.get('PowerKW'), (int, float)) and c['PowerKW'] > 0]
            points = sum(c.get('Quantity') or 1 for c in connections) or poi.get('NumberOfPoints')
            operator = operators.get(poi.get('OperatorID'), '')
            address = ', '.join(p for p in (clean(info.get('AddressLine1')), clean(info.get('AddressLine2')),
                                             clean(info.get('Town')), clean(info.get('StateOrProvince'))) if p)
            stations.append({
                'id': f"ocm:{poi['ID']}", 'name': clean(info.get('Title') or 'EV charging station'),
                'operator': '' if operator.startswith('(') else clean(operator),
                'lat': round(info['Latitude'], 6), 'lng': round(info['Longitude'], 6), 'address': address,
                'city': clean(info.get('Town'), 60), 'state': clean(info.get('StateOrProvince'), 60), 'sockets': sockets,
                'capacity': points or None, 'powerKW': max(powers) if powers else None,
                'price': clean(poi.get('UsageCost'), 60), 'status': statuses.get(poi.get('StatusTypeID'), ''),
                'access': '', 'hours': clean(info.get('AccessComments'), 80), 'fee': '',
                'verifiedAt': clean(poi.get('DateLastVerified') or poi.get('DateLastStatusUpdate'), 10),
                'sources': ['ocm'],
            })
        return stations


def osm_stations():
    request = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({'data': OVERPASS_QUERY}).encode(),
                                     headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=300) as response:
        data = json.load(response)
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
            'state': clean(tags.get('addr:state'), 60), 'sockets': sockets,
            'capacity': int(tags['capacity']) if str(tags.get('capacity', '')).isdigit() else None,
            'powerKW': None, 'price': clean(tags.get('charge'), 60), 'status': '',
            'access': clean(tags.get('access'), 20), 'hours': clean(tags.get('opening_hours'), 80),
            'fee': clean(tags.get('fee'), 20), 'verifiedAt': '', 'sources': ['osm'],
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
    """Adds `extra` stations to `base`, folding near-duplicates into the existing entry."""
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
            for key in ('operator', 'address', 'city', 'state', 'capacity', 'price', 'hours', 'access', 'fee'):
                match[key] = match[key] or station[key]
            match['sources'] = sorted(set(match['sources']) | set(station['sources']))
            merged += 1
        else:
            base.append(station)
            grid.setdefault(cell, []).append(station)
            added += 1
    return added, merged


def main():
    print('Downloading Open Charge Map stations for India (GitHub export)...', flush=True)
    stations = ocm_stations()
    print(f'  {len(stations)} operational stations from Open Charge Map')
    sources = [{'name': 'Open Charge Map contributors', 'license': 'CC BY 4.0', 'url': 'https://openchargemap.org'}]
    print('Downloading OpenStreetMap charging stations for India...', flush=True)
    try:
        extra = osm_stations()
        added, merged = merge(stations, extra)
        print(f'  {len(extra)} from OpenStreetMap: {added} added, {merged} merged into Open Charge Map entries')
        sources.append({'name': 'OpenStreetMap contributors', 'license': 'ODbL 1.0', 'url': 'https://www.openstreetmap.org/copyright'})
    except OSError as error:
        print(f'  OpenStreetMap skipped ({error}); run again later to add it')
    if len(stations) < 500:
        sys.exit(f'Only {len(stations)} stations downloaded; refusing to overwrite {OUTPUT}')
    stations.sort(key=lambda s: s['id'])
    payload = {'updatedAt': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'country': 'IN',
               'sources': sources, 'count': len(stations), 'stations': stations}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Wrote {len(stations)} stations to {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
