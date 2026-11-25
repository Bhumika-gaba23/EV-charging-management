#!/usr/bin/env python3
"""Live controls on demo chargers: the charger's screen (status + cable), plug-in detection in the
app state, pause/resume (no energy while paused) and unplugging during a charge."""
import http.cookiejar
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BINARY = ROOT / 'build-web-demo/ev_web_api'
PORT = 18086
KEY = 'live-controls-key'


class Client:
    def __init__(self):
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, method='GET', value=None, key=None, headers=None):
        all_headers = {'Content-Type': 'application/json', 'X-Pluggo-Request': '1', **(headers or {})}
        if key:
            all_headers['Idempotency-Key'] = key
        request = urllib.request.Request(f'http://127.0.0.1:{PORT}/api/customer/{path}', method=method, headers=all_headers,
                                         data=None if value is None else json.dumps(value).encode())
        try:
            with self.http.open(request, timeout=10) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as response:
            return response.code, json.load(response)


def until(check, timeout=10, message='condition'):
    end = time.time() + timeout
    while time.time() < end:
        try:
            value = check()
        except OSError:  # server still starting
            value = None
        if value:
            return value
        time.sleep(0.2)
    raise AssertionError(f'timed out waiting for {message}')


def main():
    with tempfile.TemporaryDirectory() as folder:
        env = {**os.environ, 'CHARGEFLOW_PORT': str(PORT), 'CHARGEFLOW_CUSTOMER_DB': str(Path(folder) / 'live.sqlite3'),
               'CHARGEFLOW_SIMULATION_MODE': 'meter', 'CHARGEFLOW_SIMULATOR_KEY': KEY, 'PLUGGO_TIME_OF_USE': 'off'}
        for key in ('PLUGGO_FIREBASE_PROJECT_ID', 'RAZORPAY_KEY_ID', 'PLUGGO_OPERATOR_PHONES'):
            env.pop(key, None)
        server = subprocess.Popen([str(BINARY)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        sim = None
        try:
            customer = Client()
            until(lambda: customer.call('bootstrap')[0] == 200, message='server ready')
            sim = subprocess.Popen(['python3', str(ROOT / 'ocpp-simulator/customer_simulator.py')], cwd=ROOT,
                                   env={**os.environ, 'PLUGGO_CUSTOMER_API': f'http://127.0.0.1:{PORT}',
                                        'PLUGGO_CUSTOMER_WS': f'ws://127.0.0.1:{PORT}/ocpp/customer', 'CHARGEFLOW_SIMULATOR_KEY': KEY},
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            # The charger's screen: available, then the cable goes in and the app is told.
            code, view = customer.call('chargers/DB-01')
            assert code == 200 and view['status'] == 'available' and view['station'] == 'Dashboard' and view['demo'], view
            assert customer.call('chargers/NOPE-1')[0] == 404
            code, view = customer.call('chargers/DB-01/cable', 'POST', {'plugged': True})
            assert code == 200 and view['status'] == 'plugged' and view['plugged'], view
            assert 'DB-01' in customer.call('state')[1]['state']['plugged'], 'app learns the cable is in'
            assert customer.call('chargers/DB-01/cable', 'POST', {'plugged': 'yes'})[0] == 400

            # Start from the app: the charger shows the live charge; the plug is no longer "waiting".
            plan = {'station': 'DB', 'connector': 'DB-01', 'vehicle': 'car', 'model': 'nexon-ev-45', 'startSoc': 30, 'target': 90, 'budget': 1000}
            started = until(lambda: (reply := customer.call('sessions', 'POST', plan, 'live-1'))[0] == 200 and reply[1], timeout=20,
                            message='start once the simulator is connected')
            sid = started['sessionId']
            session = lambda: next(s for s in customer.call('state')[1]['state']['sessions'] if s['id'] == sid)
            until(lambda: session()['energy'] > 0, timeout=15, message='energy flowing')
            assert 'DB-01' not in customer.call('state')[1]['state']['plugged']
            view = customer.call('chargers/DB-01')[1]
            assert view['status'] == 'charging' and view['session']['model'] == 'Tata Nexon EV 45', view

            # Pause: no energy while paused; resume continues.
            code, _ = customer.call(f'sessions/{sid}/pause', 'POST', {})
            assert code == 200 and session()['paused']
            assert customer.call('chargers/DB-01')[1]['status'] == 'paused'
            held = session()['energy']
            time.sleep(2.5)
            assert abs(session()['energy'] - held) < 1e-9, 'no energy while paused'
            assert customer.call(f'sessions/{sid}/resume', 'POST', {})[0] == 200 and not session()['paused']
            until(lambda: session()['energy'] > held, message='energy after resume')

            # Unplugging at the charger ends the charge, as on a real one.
            customer.call('chargers/DB-01/cable', 'POST', {'plugged': False})
            ended = until(lambda: session()['ended'] and session(), message='unplug ends session')
            assert ended['reason'] == 'Cable unplugged at the charger', ended
            assert customer.call(f'sessions/{sid}/pause', 'POST', {})[0] == 409, 'cannot pause an ended charge'
            assert customer.call('chargers/DB-01')[1]['status'] == 'available'
        finally:
            for process in (sim, server):
                if process:
                    process.terminate()
                    process.wait(timeout=10)
    print('PASS: charger screen status and cable, plug-in detection, pause/resume without energy, unplug ends the charge')


if __name__ == '__main__':
    main()
