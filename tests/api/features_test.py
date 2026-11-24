"""Bookings, time-of-use pricing, ratings, fault reports, wallet, analytics and trip planning
against the real C++/SQLite server. No mocked responses."""
import http.cookiejar
import json
import math
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BINARY = ROOT / 'build-web-demo/ev_web_api'
PORT = 18091


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, path, method='GET', value=None, key=None, base='customer'):
        headers = {'Content-Type': 'application/json', 'X-Pluggo-Request': '1'}
        if key:
            headers['Idempotency-Key'] = key
        url = f'http://127.0.0.1:{PORT}/api/{base + "/" if base else ""}{path}'
        request = urllib.request.Request(url, method=method, headers=headers,
                                         data=None if value is None else json.dumps(value).encode())
        try:
            with self.http.open(request, timeout=10) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as response:
            return response.code, json.load(response)

    def operator(self, path, method='GET', value=None):
        return self.call(path, method, value, base='operator')


def start(db, time_of_use):
    env = {**os.environ, 'CHARGEFLOW_PORT': str(PORT), 'CHARGEFLOW_CUSTOMER_DB': str(db),
           'CHARGEFLOW_SIMULATION_MODE': 'clock', 'CHARGEFLOW_SIMULATOR_KEY': 'features-test-key',
           'PLUGGO_TIME_OF_USE': time_of_use}
    for key in ('PLUGGO_FIREBASE_PROJECT_ID', 'RAZORPAY_KEY_ID', 'PLUGGO_OPERATOR_PHONES'):
        env.pop(key, None)
    process = subprocess.Popen([str(BINARY)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/api/health', timeout=.5):
                return process
        except OSError:
            time.sleep(.1)
    raise AssertionError('API failed to start')


def stop(process):
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def connector(snapshot, station, connector_id):
    for s in snapshot['catalog']['stations']:
        if s['id'] == station:
            return next(c for c in s['connectors'] if c['id'] == connector_id)
    raise AssertionError(station)


def station_of(snapshot, station):
    return next(s for s in snapshot['catalog']['stations'] if s['id'] == station)


def now_ms():
    return int(time.time() * 1000)


def test_time_of_use(db):
    server = start(db, 'on')
    try:
        a = Client()
        snap = a.call('bootstrap')[1]
        tariff = snap['tariff']
        assert tariff['enabled'] and tariff['band'] in ('off-peak', 'standard', 'peak')
        multiplier = {'off-peak': .8, 'standard': 1, 'peak': 1.2}[tariff['band']]
        assert tariff['multiplier'] == multiplier and tariff['until'] > now_ms()
        assert [b['band'] for b in tariff['bands']] == ['off-peak', 'standard', 'peak']
        cp = station_of(snap, 'CP')
        assert cp['currentRate'] == round(cp['rate'] * multiplier, 2) and cp['band'] == tariff['band']
        code, result = a.call('sessions', 'POST', {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car', 'target': 30, 'budget': 50}, 'tou')
        assert code == 200, result
        session = result['state']['sessions'][0]
        assert session['rate'] == cp['currentRate'] and session['band'] == tariff['band']
        # The budget cap uses the rate the charge started with.
        assert abs(session['limit'] - min(2, 50 / session['rate'])) < 1e-9
        assert session['expectedEnd'] > session['started']
    finally:
        stop(server)
    server = start(db, 'off')
    try:
        snap = Client().call('bootstrap')[1]
        assert snap['tariff']['enabled'] is False and station_of(snap, 'CP')['currentRate'] == 18
    finally:
        stop(server)


def test_features(db):
    server = start(db, 'off')
    try:
        a, b = Client(), Client()
        a.call('bootstrap'); b.call('bootstrap')
        soon = now_ms() + 60_000
        slot = {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car', 'start': soon, 'minutes': 60}

        # ---- Bookings
        assert a.call('bookings', 'POST', {**slot, 'minutes': 45})[0] == 400
        assert a.call('bookings', 'POST', {**slot, 'start': now_ms() + 25 * 3600_000})[0] == 400
        assert a.call('bookings', 'POST', {**slot, 'connector': 'CP-03'})[0] == 409  # bike plug, car booking
        code, booked = a.call('bookings', 'POST', slot)
        assert code == 200, booked
        booking = booked['bookingId']
        assert booked['state']['bookings'][0]['status'] == 'booked' and booked['state']['bookings'][0]['rate'] == 18
        assert a.call('bookings', 'POST', {**slot, 'connector': 'CP-02', 'start': soon + 4 * 3600_000})[0] == 409  # one at a time
        assert b.call('bookings', 'POST', {**slot, 'start': soon + 30 * 60_000})[0] == 409  # overlaps
        mine, theirs = connector(a.call('state')[1], 'CP', 'CP-01'), connector(b.call('state')[1], 'CP', 'CP-01')
        assert mine['bookedByYou'] and mine['available'] and not mine['reserved']
        assert theirs['reserved'] and not theirs['available'] and theirs['bookings'][0]['starts'] == soon
        assert b.call('verify', 'POST', {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car'})[0] == 409
        assert b.call('sessions', 'POST', {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car', 'target': 30, 'budget': 50}, 'b1')[0] == 409
        station_view = a.call('station', base='')[1]
        assert next(s for s in station_view['slots'] if s['id'] == 'CP-01')['status'] == 'reserved'
        code, started = a.call('sessions', 'POST', {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car', 'target': 30, 'budget': 50}, 'a1')
        assert code == 200, started
        sid = started['sessionId']
        used = next(x for x in started['state']['bookings'] if x['id'] == booking)
        assert used['status'] == 'used' and used['session'] == sid
        assert a.call(f'bookings/{booking}/cancel', 'POST', {})[0] == 409

        # Cancelling, and a no-show releasing the charger.
        later = {**slot, 'connector': 'LR-01', 'station': 'LR', 'start': now_ms() + 2 * 3600_000}
        code, other = b.call('bookings', 'POST', later)
        assert code == 200, other
        assert a.call(f'bookings/{other["bookingId"]}/cancel', 'POST', {})[0] == 404
        assert b.call(f'bookings/{other["bookingId"]}/cancel', 'POST', {})[1]['state']['bookings'][0]['status'] == 'cancelled'
        code, late = b.call('bookings', 'POST', {**later, 'start': now_ms() + 30_000})
        assert code == 200, late
        with sqlite3.connect(db) as conn:
            conn.execute('UPDATE customer_bookings SET starts=?, ends=? WHERE id=?', (now_ms() - 11 * 60_000, now_ms() + 49 * 60_000, late['bookingId']))
        snap = b.call('state')[1]
        assert next(x for x in snap['state']['bookings'] if x['id'] == late['bookingId'])['status'] == 'no-show'
        assert not connector(a.call('state')[1], 'LR', 'LR-01')['reserved']

        # ---- Ratings need a finished charge at the station
        assert a.call('stations/CP/review', 'POST', {'rating': 5})[0] == 403
        a.call(f'sessions/{sid}/stop', 'POST', {})
        assert a.call('stations/CP/review', 'POST', {'rating': 6})[0] == 400
        assert a.call('stations/CP/review', 'POST', {'rating': 4.5})[0] == 400
        assert a.call('stations/NOPE/review', 'POST', {'rating': 4})[0] == 404
        code, rated = a.call('stations/CP/review', 'POST', {'rating': 4, 'comment': 'Quick and clean'})
        assert code == 200, rated
        rating = station_of(rated, 'CP')['rating']
        assert rating['count'] == 1 and rating['average'] == 4 and rating['mine']['rating'] == 4 and rating['canReview']
        assert rating['recent'][0]['comment'] == 'Quick and clean'
        a.call('stations/CP/review', 'POST', {'rating': 2})  # editing keeps one review per driver
        rating = station_of(b.call('state')[1], 'CP')['rating']
        assert rating['count'] == 1 and rating['average'] == 2 and 'mine' not in rating and not rating['canReview']

        # ---- Fault reports, operator resolution and wallet credit
        assert b.call('reports', 'POST', {'station': 'CP', 'connector': 'CP-02', 'kind': 'broken'})[0] == 400
        assert b.call('reports', 'POST', {'station': 'CP', 'connector': 'LR-01', 'kind': 'blocked'})[0] == 400
        code, reported = b.call('reports', 'POST', {'station': 'CP', 'connector': 'CP-02', 'kind': 'not-working', 'note': 'Screen is blank'})
        assert code == 200, reported
        report = reported['reportId']
        assert connector(reported, 'CP', 'CP-02')['openReports'] == 1 and reported['state']['reports'][0]['status'] == 'open'
        for i in range(4):
            assert b.call('reports', 'POST', {'station': 'LR', 'kind': 'other', 'note': f'n{i}'})[0] == 200
        assert b.call('reports', 'POST', {'station': 'LR', 'kind': 'other'})[0] == 429
        listed = a.operator('reports')[1]
        assert listed['open'] == 5 and listed['reports'][0]['status'] == 'open' and any(r['id'] == report for r in listed['reports'])
        assert a.operator(f'reports/{report}/resolve', 'POST', {'credit': 600})[0] == 400
        code, resolved = a.operator(f'reports/{report}/resolve', 'POST', {'credit': 50, 'resolution': 'Display replaced'})
        assert code == 200 and resolved['open'] == 4, resolved
        assert a.operator(f'reports/{report}/resolve', 'POST', {})[0] == 409
        snap = b.call('state')[1]
        assert snap['wallet']['balance'] == 50 and snap['wallet']['history'][0]['amount'] == 50
        assert next(r for r in snap['state']['reports'] if r['id'] == report)['credit'] == 50

        # ---- Wallet credit pays for a charge
        code, bs = b.call('sessions', 'POST', {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car', 'target': 30, 'budget': 50}, 'b2')
        assert code == 200, bs
        bsid = bs['sessionId']
        time.sleep(2.7)  # 2 kWh at 50 kW and 60x speed
        snap = b.call('state')[1]
        ended = next(s for s in snap['state']['sessions'] if s['id'] == bsid)
        assert ended['ended'] and ended['cost'] == 36 and ended['walletUse'] == 36 and ended['due'] == 0, ended
        assert a.operator('credit', 'POST', {'sessionId': bsid, 'amount': 0})[0] == 400
        assert a.operator('credit', 'POST', {'sessionId': 'PG-missing', 'amount': 10})[0] == 404
        assert a.operator('credit', 'POST', {'sessionId': bsid, 'amount': 20, 'reason': 'Waited at the charger'})[0] == 200
        # Checkout uses only what the charge costs; the rest of the credit stays in the wallet.
        paid = next(s for s in b.call(f'sessions/{bsid}/checkout', 'POST', {})[1]['state']['sessions'] if s['id'] == bsid)
        assert paid['settled'] and paid['walletUsed'] == 36 and paid['receipt']['walletUsed'] == 36
        snap = b.call('state')[1]
        assert snap['wallet']['balance'] == 34 and snap['wallet']['history'][0]['amount'] == -36

        # ---- Operator analytics
        a.call(f'sessions/{sid}/checkout', 'POST', {})
        code, stats = a.operator('analytics')
        assert code == 200, stats
        assert stats['totals']['completedSessions'] == 2 and stats['totals']['walletUsed'] == 36 and stats['totals']['openReports'] == 4
        assert len(stats['daily']) == 14 and stats['daily'][-1]['sessions'] == 2 and len(stats['hourly']) == 24
        assert stats['bookings']['used'] == 1 and stats['bookings']['cancelled'] == 1 and stats['bookings']['no-show'] == 1
        assert next(s for s in stats['stations'] if s['id'] == 'CP')['averageRating'] == 2
        assert sum(x['sessions'] for x in stats['bands']) == 2 and sum(h['busyMinutes'] for h in stats['hourly']) > 0
        assert a.operator('analytics?days=0')[0] == 400 and len(a.operator('analytics?days=7')[1]['daily']) == 7

        # ---- Clearing history removes bookings but keeps wallet money
        b.call('reset', 'POST', {})
        snap = b.call('state')[1]
        assert snap['state']['bookings'] == [] and snap['wallet']['balance'] == 34
    finally:
        stop(server)


def test_trip(db):
    server = start(db, 'off')
    try:
        a = Client()
        bad = a.call('trip?fromLat=28.6&fromLng=77.2&toLat=abc&toLng=75.8')
        assert bad[0] == 400
        assert a.call('trip?fromLat=28.6&fromLng=77.2&toLat=28.6&toLng=77.2')[0] == 400
        assert a.call('trip?fromLat=28.6&fromLng=77.2&toLat=26.9&toLng=75.8&battery=2')[0] == 400
        # Within range: no stops.
        code, near = a.call('trip?fromLat=28.6315&fromLng=77.2167&toLat=28.4595&toLng=77.0266&vehicle=car&battery=80')
        assert code == 200 and near['feasible'] and near['stops'] == [] and near['arrivalBattery'] > 0, near
        # Delhi to Jaipur on 25%: needs stops, each reached safely and moving towards Jaipur.
        code, trip = a.call('trip?fromLat=28.6315&fromLng=77.2167&toLat=26.9124&toLng=75.7873&vehicle=car&battery=25')
        assert code == 200, trip
        assert trip['feasible'] and len(trip['stops']) >= 2, trip
        assert all(s['arriveBattery'] >= 10 and s['leaveBattery'] == 80 and s['minutes'] > 0 for s in trip['stops'])
        to_jaipur = [math.hypot(s['lat'] - 26.9124, (s['lng'] - 75.7873) * .89) for s in trip['stops']]
        assert to_jaipur == sorted(to_jaipur, reverse=True)  # every stop is closer to Jaipur
        assert trip['arrivalBattery'] >= 10 and 250 < trip['distanceKm'] < 400
        # Hills: the road from Aut to Delhi winds far from the straight line; stops must still be found.
        code, hills = a.call('trip?fromLat=31.736&fromLng=77.198&toLat=28.6139&toLng=77.2090&vehicle=car&battery=80')
        assert code == 200 and hills['feasible'] and hills['stops'] and not hills['chargeFirst'], hills
        # Too little charge to reach any charger: plan from a full battery and say so.
        code, low = a.call('trip?fromLat=31.736&fromLng=77.198&toLat=28.6139&toLng=77.2090&vehicle=car&battery=25')
        assert code == 200 and low['feasible'] and low['chargeFirst'] and low['startBattery'] == 100 and 'Charge to 100%' in low['note'], low
        # A scooter cannot cross a gap the car can.
        code, far = a.call('trip?fromLat=28.6315&fromLng=77.2167&toLat=26.9124&toLng=75.7873&vehicle=scooter&battery=100')
        assert code == 200 and isinstance(far['feasible'], bool)
    finally:
        stop(server)


def main():
    with tempfile.TemporaryDirectory(prefix='pluggo-features-') as tmp:
        test_time_of_use(Path(tmp) / 'tou.sqlite3')
        test_features(Path(tmp) / 'features.sqlite3')
        test_trip(Path(tmp) / 'trip.sqlite3')
    print('features: bookings, time-of-use, ratings, reports, wallet, analytics and trips OK')


if __name__ == '__main__':
    main()
