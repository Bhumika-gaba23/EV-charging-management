"""Operator dashboard access against the real C++ API.

With Firebase phone sign-in configured, every operator route needs a valid Firebase ID
token whose phone number is listed in PLUGGO_OPERATOR_PHONES. Firebase is replaced by the
local certificate stand-in from integrations_test; no network access is used.
"""
import http.server
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

from customer_integration import BINARY, ROOT, stop, wait_ready
from integrations_test import PROJECT, Fakes, make_key, token

OPERATOR, CUSTOMER = '+919876543210', '+919000000001'
PLAN = {'registration': 'OPS-1', 'capacity': 60, 'soc': 20, 'connector': 'CCS2', 'maxRate': 50, 'target': 80, 'hours': 2}


def call(port, path, method='GET', value=None, bearer=None):
    headers = {'Content-Type': 'application/json'}
    if bearer:
        headers['Authorization'] = 'Bearer ' + bearer
    data = json.dumps(value).encode() if value is not None else None
    request = urllib.request.Request(f'http://127.0.0.1:{port}/api/{path}', data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def serve(port, folder, extra):
    env = {**os.environ, 'CHARGEFLOW_PORT': str(port), 'CHARGEFLOW_CUSTOMER_DB': str(folder / f'{port}.sqlite3'),
           'CHARGEFLOW_SIMULATION_MODE': 'clock', 'CHARGEFLOW_SIMULATOR_KEY': 'operator-test-key', **extra}
    for name in ('PLUGGO_FIREBASE_PROJECT_ID', 'PLUGGO_OPERATOR_PHONES'):
        if name not in extra:
            env.pop(name, None)
    server = subprocess.Popen([str(BINARY)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    wait_ready(port)
    return server


def main():
    with tempfile.TemporaryDirectory(prefix='pluggo-operator-') as tmp:
        folder = Path(tmp)
        good_key, good_cert = make_key(folder, 'good')
        rogue_key, _ = make_key(folder, 'rogue')
        Fakes.certs = {'kid-1': good_cert}
        fake = http.server.ThreadingHTTPServer(('127.0.0.1', 18097), Fakes)
        threading.Thread(target=fake.serve_forever, daemon=True).start()
        firebase = {'PLUGGO_FIREBASE_PROJECT_ID': PROJECT, 'PLUGGO_FIREBASE_API_KEY': 'public-web-key',
                    'PLUGGO_FIREBASE_CERTS_URL': 'http://127.0.0.1:18097/certs'}
        servers = []
        try:
            # 1. Protected: Firebase on and one operator number listed.
            servers.append(serve(18084, folder, {**firebase, 'PLUGGO_OPERATOR_PHONES': f' {OPERATOR}, +91invalid '}))
            code, info = call(18084, 'operator/auth')
            assert code == 200 and info['required'] and not info['signedIn'] and info['firebase']['projectId'] == PROJECT, info
            assert info['firebase']['apiKey'] == 'public-web-key' and info['status'] == 401
            for path, method, body in [('station', 'GET', None), ('queue', 'GET', None), ('chargers/A1', 'GET', None),
                                       ('plan', 'POST', PLAN), ('queue/serve', 'POST', {}),
                                       ('emergency', 'POST', {'registration': 'AMB', 'soc': 5})]:
                assert call(18084, path, method, body)[0] == 401, f'{path} must need sign-in'
            assert call(18084, 'station', bearer='not-a-real-token-at-all')[0] == 401
            assert call(18084, 'station', bearer=token(rogue_key, phone_number=OPERATOR))[0] == 401, 'forged signature'
            assert call(18084, 'station', bearer=token(good_key, phone_number=OPERATOR, exp=int(time.time()) - 5))[0] == 401, 'expired'
            assert call(18084, 'station', bearer=token(good_key, phone_number=OPERATOR, aud='other'))[0] == 401, 'wrong project'
            code, denied = call(18084, 'station', bearer=token(good_key, phone_number=CUSTOMER))
            assert code == 403 and 'not registered' in denied['error'], denied
            code, info = call(18084, 'operator/auth', bearer=token(good_key, phone_number=CUSTOMER))
            assert not info['signedIn'] and info['status'] == 403

            operator = token(good_key, phone_number=OPERATOR)
            assert call(18084, 'operator/auth', bearer=operator)[1]['signedIn'] is True
            for path, method, body in [('station', 'GET', None), ('queue', 'GET', None), ('chargers/A1', 'GET', None),
                                       ('plan', 'POST', PLAN)]:
                code, reply = call(18084, path, method, body, operator)
                assert code == 200 and reply['ok'], (path, code, reply)
            assert call(18084, 'health')[0] == 200, 'liveness stays public'

            # 2. Fail closed: Firebase on but no operator list means nobody gets in.
            servers.append(serve(18085, folder, firebase))
            assert call(18085, 'station', bearer=operator)[0] == 403
            assert call(18085, 'operator/auth')[1]['required'] is True

            # 3. Local development: no identity provider, the dashboard stays open.
            servers.append(serve(18086, folder, {}))
            code, info = call(18086, 'operator/auth')
            assert code == 200 and info['required'] is False and info['signedIn'] is True
            assert call(18086, 'station')[0] == 200
            print('PASS: operator routes need a listed phone (missing/forged/expired/wrong-project/unlisted refused), '
                  'empty list fails closed, local development stays open')
        finally:
            for server in servers:
                stop(server)
            fake.shutdown()


if __name__ == '__main__':
    main()
