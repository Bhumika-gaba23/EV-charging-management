"""Phone sign-in and Razorpay checkout against the real C++ API.

Firebase and Razorpay are replaced by local stand-ins: a certificate endpoint serving a
self-signed RSA certificate (tokens are signed with its private key via the openssl CLI)
and a minimal Orders API. No network access or paid service is used.
"""
import base64
import hashlib
import hmac
import http.server
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time

from customer_integration import BINARY, ROOT, Client, stop, wait_ready

# Fixed base rates here; tests/api/features_test.py covers time-of-use pricing.
os.environ.setdefault('PLUGGO_TIME_OF_USE', 'off')

PROJECT = 'pluggo-test'
KEY_ID, KEY_SECRET = 'rzp_test_pluggo', 'test-secret-value'
ORDERS = []


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


class Fakes(http.server.BaseHTTPRequestHandler):
    certs = {}

    def log_message(self, *_):
        pass

    def reply(self, status, value, headers=None):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/certs':
            return self.reply(200, Fakes.certs, {'Cache-Control': 'public, max-age=600'})
        self.reply(404, {})

    def do_POST(self):
        expected = 'Basic ' + base64.b64encode(f'{KEY_ID}:{KEY_SECRET}'.encode()).decode()
        if self.path != '/v1/orders' or self.headers.get('Authorization') != expected:
            return self.reply(401, {'error': {'description': 'bad auth'}})
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        order = {'id': f'order_TEST{len(ORDERS) + 1}', 'amount': body['amount'], 'currency': body['currency']}
        ORDERS.append(order)
        self.reply(200, order)


def make_key(folder, name):
    key, cert = folder / f'{name}.key', folder / f'{name}.pem'
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(key),
                    '-out', str(cert), '-subj', '/CN=pluggo-test', '-days', '1'],
                   check=True, capture_output=True)
    return key, cert.read_text()


def token(key, kid='kid-1', **overrides):
    now = int(time.time())
    claims = {'aud': PROJECT, 'iss': f'https://securetoken.google.com/{PROJECT}', 'sub': 'uid-123',
              'phone_number': '+919876543210', 'iat': now - 10, 'auth_time': now - 10, 'exp': now + 3600}
    claims.update(overrides)
    signed = b64url(json.dumps({'alg': 'RS256', 'kid': kid, 'typ': 'JWT'}).encode()) + '.' + \
        b64url(json.dumps(claims).encode())
    signature = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', str(key)], input=signed.encode(),
                               check=True, capture_output=True).stdout
    return signed + '.' + b64url(signature)


def main():
    with tempfile.TemporaryDirectory(prefix='pluggo-integrations-') as tmp:
        folder = Path(tmp)
        good_key, good_cert = make_key(folder, 'good')
        rogue_key, _ = make_key(folder, 'rogue')
        Fakes.certs = {'kid-1': good_cert}
        fake = http.server.ThreadingHTTPServer(('127.0.0.1', 18096), Fakes)
        threading.Thread(target=fake.serve_forever, daemon=True).start()
        env = {**os.environ, 'CHARGEFLOW_PORT': '18082', 'CHARGEFLOW_CUSTOMER_DB': str(folder / 'db.sqlite3'),
               'CHARGEFLOW_SIMULATION_MODE': 'clock', 'CHARGEFLOW_SIMULATOR_KEY': 'integration-test-key',
               'PLUGGO_FIREBASE_PROJECT_ID': PROJECT, 'PLUGGO_FIREBASE_API_KEY': 'public-web-key',
               'PLUGGO_FIREBASE_CERTS_URL': 'http://127.0.0.1:18096/certs',
               'RAZORPAY_KEY_ID': KEY_ID, 'RAZORPAY_KEY_SECRET': KEY_SECRET,
               'PLUGGO_RAZORPAY_API_BASE': 'http://127.0.0.1:18096'}
        server = subprocess.Popen([str(BINARY)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            wait_ready(18082)
            phone, laptop = Client(18082), Client(18082)
            code, boot = phone.call('bootstrap')
            assert code == 200 and boot['backend']['authRequired'] and boot['backend']['payments'] == 'razorpay'
            assert boot['backend']['firebase']['projectId'] == PROJECT and boot['account']['signedIn'] is False
            plan = {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car', 'target': 30, 'budget': 50}
            assert phone.call('sessions', 'POST', plan, 'k1')[0] == 403, 'charging must need sign-in'

            # Forged, expired, wrong-project and unknown-key tokens are refused.
            assert phone.call('auth/firebase', 'POST', {'idToken': token(rogue_key)})[0] == 401
            assert phone.call('auth/firebase', 'POST', {'idToken': token(good_key, exp=int(time.time()) - 5)})[0] == 401
            assert phone.call('auth/firebase', 'POST', {'idToken': token(good_key, aud='someone-else')})[0] == 401
            assert phone.call('auth/firebase', 'POST', {'idToken': token(good_key, kid='kid-unknown')})[0] == 401
            assert phone.call('auth/firebase', 'POST', {'idToken': 'not-a-jwt'})[0] == 401
            assert phone.call('auth/firebase', 'POST', {'idToken': token(good_key)}, csrf=False)[0] == 403

            code, signed = phone.call('auth/firebase', 'POST', {'idToken': token(good_key)})
            assert code == 200 and signed['account'] == {'signedIn': True, 'phone': '+919876543210'}, signed.get('account')

            code, started = phone.call('sessions', 'POST', plan, 'k1')
            assert code == 200, started
            sid = started['sessionId']
            time.sleep(3.5)  # 2 kWh at 50 kW and 60x clock speed finishes in 2.4 s
            session = next(s for s in phone.call('state')[1]['state']['sessions'] if s['id'] == sid)
            assert session['ended'], session
            due = round(session['cost'] * 100)
            assert due >= 100

            unpaid = phone.call(f'sessions/{sid}/checkout', 'POST', {})
            assert unpaid[0] == 409 and 'Payment is required' in unpaid[1]['error'], unpaid
            code, order = phone.call(f'sessions/{sid}/payment', 'POST', {})
            assert code == 200 and order['amount'] == due and order['keyId'] == KEY_ID and order['phone'] == '+919876543210', order
            assert phone.call(f'sessions/{sid}/payment', 'POST', {})[1]['orderId'] == order['orderId'], 'order is reused'
            assert len(ORDERS) == 1
            assert laptop.call('bootstrap')[0] == 200
            assert laptop.call(f'sessions/{sid}/payment', 'POST', {})[0] == 404, 'other visitors cannot pay for it'

            forged = {'razorpay_order_id': order['orderId'], 'razorpay_payment_id': 'pay_TEST1', 'razorpay_signature': '0' * 64}
            assert phone.call(f'sessions/{sid}/checkout', 'POST', forged)[0] == 400
            genuine = dict(forged, razorpay_signature=hmac.new(KEY_SECRET.encode(), f"{order['orderId']}|pay_TEST1".encode(), hashlib.sha256).hexdigest())
            assert phone.call(f'sessions/{sid}/checkout', 'POST', dict(genuine, razorpay_order_id='order_OTHER'))[0] == 409
            code, paid = phone.call(f'sessions/{sid}/checkout', 'POST', genuine)
            receipt = next(s for s in paid['state']['sessions'] if s['id'] == sid)['receipt']
            assert code == 200 and receipt['amountCollected'] == due / 100 and receipt['paymentId'] == 'pay_TEST1' and receipt['provider'] == 'razorpay', receipt
            assert phone.call(f'sessions/{sid}/checkout', 'POST', genuine)[0] == 200, 'checkout retry is safe'

            # Signing in on a second device switches it to the same account and history.
            code, other = laptop.call('auth/firebase', 'POST', {'idToken': token(good_key)})
            assert code == 200 and [s['id'] for s in other['state']['sessions']] == [sid]
            assert [s['id'] for s in laptop.call('state')[1]['state']['sessions']] == [sid], 'cookie switched'

            code, out = laptop.call('auth/logout', 'POST', {})
            assert code == 200 and out['account']['signedIn'] is False and out['state']['sessions'] == []
            assert laptop.call('state')[1]['account']['signedIn'] is False
            assert phone.call('reset', 'POST', {})[0] == 200, 'reset removes paid sessions too'
            ready = json.load(__import__('urllib.request').request.urlopen('http://127.0.0.1:18082/api/ready'))
            assert ready['identityProvider'] == 'firebase-phone' and ready['payments'] == 'razorpay'
            print('PASS: phone sign-in (forged/expired/wrong-project rejected), cross-device account, '
                  'Razorpay order reuse, unpaid checkout refused, forged signature rejected, verified payment receipt, logout, reset')
        finally:
            stop(server)
            fake.shutdown()


if __name__ == '__main__':
    main()
