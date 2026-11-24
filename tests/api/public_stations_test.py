"""Real-station directory search against the real C++ API and the committed dataset."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request

from customer_integration import BINARY, ROOT, stop, wait_ready

# Fixed base rates here; tests/api/features_test.py covers time-of-use pricing.
os.environ.setdefault('PLUGGO_TIME_OF_USE', 'off')

PORT = 18088
DATA = json.loads((ROOT / 'database/seed/public_stations.json').read_text(encoding='utf-8'))


def get(port, **params):
    url = f'http://127.0.0.1:{port}/api/customer/public-stations?' + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return response.status, json.load(response), response.headers.get('Cache-Control')
    except urllib.error.HTTPError as error:
        return error.code, json.load(error), None


def serve(port, folder, extra):
    env = {**os.environ, 'CHARGEFLOW_PORT': str(port), 'CHARGEFLOW_CUSTOMER_DB': str(folder / f'{port}.sqlite3'),
           'CHARGEFLOW_SIMULATION_MODE': 'clock', 'CHARGEFLOW_SIMULATOR_KEY': 'stations-test-key', **extra}
    server = subprocess.Popen([str(BINARY)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    wait_ready(port)
    return server


def main():
    assert DATA['count'] == len(DATA['stations']) >= 100 and DATA['sources'][0]['license'] == 'CC BY 4.0'
    with tempfile.TemporaryDirectory(prefix='pluggo-stations-') as tmp:
        folder = Path(tmp)
        servers = [serve(PORT, folder, {})]
        try:
            # Near central Delhi: sorted by distance, all inside the radius, attribution included.
            code, near, cache = get(PORT, lat=28.6139, lng=77.2090, radius=15)
            assert code == 200 and near['stations'], near
            distances = [s['distanceKm'] for s in near['stations']]
            assert distances == sorted(distances) and distances[-1] <= 15, distances
            assert near['sources'][0]['name'] == 'Open Charge Map contributors' and cache == 'public, max-age=300'
            assert all(s['id'].startswith(('osm:', 'ocm:')) for s in near['stations'])
            assert len(get(PORT, lat=28.6139, lng=77.2090, radius=15, limit=3)[1]['stations']) == 3
            assert len(get(PORT, lat=28.6139, lng=77.2090, radius=99, limit=500)[1]['stations']) <= 100, 'limit capped'
            # Hill towns: the nearest charger can be ~100 km away, so a point search reaches 300 km (and no further).
            hills = get(PORT, lat=32.0104, lng=77.3166, radius=900, limit=50)[1]['stations']
            assert len(hills) >= 5 and max(s['distanceKm'] for s in hills) <= 300, 'hill search radius'

            # Text search without a location; every word must match.
            operator = next(s['operator'] for s in DATA['stations'] if len(s['operator']) > 4)
            word = operator.split()[0]
            code, named, _ = get(PORT, q=word)
            assert code == 200 and named['total'] >= 1, named
            text = lambda s: ' '.join(str(s.get(k, '')) for k in ('name', 'operator', 'address', 'city', 'state')).lower()
            assert all(word.lower() in text(s) for s in named['stations'])
            assert get(PORT, q='zzzz-no-such-station')[1]['total'] == 0

            # Validation.
            assert get(PORT)[0] == 400, 'needs location or search'
            assert get(PORT, lat='north', lng=77)[0] == 400
            assert get(PORT, lat=95, lng=77)[0] == 400
            assert get(PORT, lat=28.6, lng=77.2, radius=-1)[0] == 400
            assert get(PORT, q='x' * 81)[0] == 400

            # A server without the dataset says so instead of failing.
            servers.append(serve(PORT + 1, folder, {'CHARGEFLOW_PUBLIC_STATIONS_FILE': str(folder / 'missing.json')}))
            assert get(PORT + 1, lat=28.6, lng=77.2)[0] == 404
            print(f"PASS: real-station directory ({DATA['count']} stations) by distance, radius and limit, "
                  'word search, validation, attribution, missing dataset')
        finally:
            for server in servers:
                stop(server)


if __name__ == '__main__':
    main()
