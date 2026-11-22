"""Payment recovery, webhooks and refunds against the real C++ API.

Razorpay and Firebase are replaced by local stand-ins. Covers:
- a customer who paid and closed the app is settled from Razorpay's records, not charged twice;
- an authorized-but-uncaptured payment is captured and settled;
- signed order.paid webhooks settle sessions; forged and replayed webhooks are refused or ignored;
- operators refund part or all of a paid session; refund webhooks update the refund status.
"""
import hashlib
import hmac
import http.server
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

from customer_integration import BINARY, ROOT, Client, stop, wait_ready
from integrations_test import KEY_ID, KEY_SECRET, PROJECT, Fakes, make_key, token

PORT, FAKE_PORT = 18087, 18098
WEBHOOK_SECRET = 'webhook-secret-value'
OPERATOR = '+919812345678'
PAYMENTS = {}   # order_id -> list of {id, status, amount}
CAPTURES, REFUNDS = [], []


class Razorpay(Fakes):
    def authorized(self):
        import base64
        return self.headers.get('Authorization') == 'Basic ' + base64.b64encode(f'{KEY_ID}:{KEY_SECRET}'.encode()).decode()

    def do_GET(self):
        if self.path.startswith('/v1/orders/') and self.path.endswith('/payments'):
            if not self.authorized():
                return self.reply(401, {})
            order = self.path.split('/')[3]
            return self.reply(200, {'entity': 'collection', 'items': PAYMENTS.get(order, [])})
        super().do_GET()

    def do_POST(self):
        parts = self.path.split('/')
        if self.path.startswith('/v1/payments/') and len(parts) == 5 and parts[4] in ('capture', 'refund'):
            if not self.authorized():
                return self.reply(401, {})
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            if parts[4] == 'capture':
                CAPTURES.append((parts[3], body['amount']))
                return self.reply(200, {'id': parts[3], 'status': 'captured'})
            REFUNDS.append((parts[3], body['amount']))
            return self.reply(200, {'id': f'rfnd_TEST{len(REFUNDS)}', 'amount': body['amount'], 'status': 'pending'})
        super().do_POST()


def raw(path, body, headers):
    request = urllib.request.Request(f'http://127.0.0.1:{PORT}/api/{path}', data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def webhook(event, event_id, secret=WEBHOOK_SECRET):
    body = json.dumps(event).encode()
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return raw('customer/razorpay/webhook', body, {'Content-Type': 'application/json', 'X-Razorpay-Signature': signature,
                                                   'X-Razorpay-Event-Id': event_id})


def operator_call(path, value, bearer):
    return raw(path, json.dumps(value).encode(), {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + bearer})


def charged_session(client, key, idem):
    plan = {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car', 'target': 30, 'budget': 50}
    code, started = client.call('sessions', 'POST', plan, idem)
    assert code == 200, started
    sid = started['sessionId']
    time.sleep(3.5)
    session = next(s for s in client.call('state')[1]['state']['sessions'] if s['id'] == sid)
    assert session['ended'], session
    return sid, round(session['cost'] * 100)


def session_of(client, sid):
    return next(s for s in client.call('state')[1]['state']['sessions'] if s['id'] == sid)


def main():
    with tempfile.TemporaryDirectory(prefix='pluggo-payments-') as tmp:
        folder = Path(tmp)
        good_key, good_cert = make_key(folder, 'good')
        Fakes.certs = {'kid-1': good_cert}
        fake = http.server.ThreadingHTTPServer(('127.0.0.1', FAKE_PORT), Razorpay)
        threading.Thread(target=fake.serve_forever, daemon=True).start()
        db = folder / 'db.sqlite3'
        env = {**os.environ, 'CHARGEFLOW_PORT': str(PORT), 'CHARGEFLOW_CUSTOMER_DB': str(db),
               'CHARGEFLOW_SIMULATION_MODE': 'clock', 'CHARGEFLOW_SIMULATOR_KEY': 'payments-test-key',
               'PLUGGO_FIREBASE_PROJECT_ID': PROJECT, 'PLUGGO_FIREBASE_API_KEY': 'public-web-key',
               'PLUGGO_FIREBASE_CERTS_URL': f'http://127.0.0.1:{FAKE_PORT}/certs',
               'RAZORPAY_KEY_ID': KEY_ID, 'RAZORPAY_KEY_SECRET': KEY_SECRET, 'RAZORPAY_WEBHOOK_SECRET': WEBHOOK_SECRET,
               'PLUGGO_RAZORPAY_API_BASE': f'http://127.0.0.1:{FAKE_PORT}', 'PLUGGO_OPERATOR_PHONES': OPERATOR}
        server = subprocess.Popen([str(BINARY)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            wait_ready(PORT)
            customer = Client(PORT)
            assert customer.call('bootstrap')[0] == 200
            assert customer.call('auth/firebase', 'POST', {'idToken': token(good_key)})[0] == 200

            # 1. Paid, then the app closed before checkout: the next payment attempt finds the
            #    captured payment and settles instead of opening a second Razorpay order.
            sid, due = charged_session(customer, good_key, 'p1')
            code, order = customer.call(f'sessions/{sid}/payment', 'POST', {})
            assert code == 200 and order['amount'] == due, order
            PAYMENTS[order['orderId']] = [{'id': 'pay_FAILED1', 'status': 'failed', 'amount': due},
                                          {'id': 'pay_CLOSED1', 'status': 'captured', 'amount': due}]
            code, again = customer.call(f'sessions/{sid}/payment', 'POST', {})
            assert code == 200 and again['settled'] is True and 'orderId' not in again, again
            receipt = session_of(customer, sid)['receipt']
            assert receipt['paymentId'] == 'pay_CLOSED1' and receipt['amountCollected'] == due / 100, receipt
            assert customer.call(f'sessions/{sid}/checkout', 'POST', {})[0] == 200, 'checkout after recovery is a no-op'
            assert customer.call(f'sessions/{sid}/payment', 'POST', {})[1]['settled'] is True, 'paying a settled session is safe'

            # 2. Authorized but not captured (manual-capture accounts): captured, then settled.
            sid2, due2 = charged_session(customer, good_key, 'p2')
            order2 = customer.call(f'sessions/{sid2}/payment', 'POST', {})[1]
            PAYMENTS[order2['orderId']] = [{'id': 'pay_AUTH2', 'status': 'authorized', 'amount': due2}]
            assert customer.call(f'sessions/{sid2}/payment', 'POST', {})[1]['settled'] is True
            assert CAPTURES == [('pay_AUTH2', due2)], CAPTURES

            # 3. Webhooks: forged refused, genuine settles, replay ignored, wrong amount ignored.
            sid3, due3 = charged_session(customer, good_key, 'p3')
            order3 = customer.call(f'sessions/{sid3}/payment', 'POST', {})[1]['orderId']
            paid = {'event': 'order.paid', 'payload': {'payment': {'entity': {'id': 'pay_HOOK3', 'order_id': order3, 'amount': due3, 'status': 'captured'}}}}
            assert webhook(paid, 'evt_1', secret='wrong-secret')[0] == 400
            assert webhook({**paid, 'payload': {'payment': {'entity': {'id': 'pay_X', 'order_id': order3, 'amount': due3 + 1}}}}, 'evt_0')[1]['settled'] is False
            assert session_of(customer, sid3)['settled'] is False
            code, reply = webhook(paid, 'evt_1')
            assert code == 200 and reply['settled'] is True, reply
            assert session_of(customer, sid3)['receipt']['paymentId'] == 'pay_HOOK3'
            assert webhook(paid, 'evt_1')[1].get('duplicate') is True
            assert webhook({'event': 'payment.failed', 'payload': {'payment': {'entity': {'id': 'pay_F', 'order_id': order3}}}}, 'evt_2')[0] == 200
            assert raw('customer/razorpay/webhook', b'{}', {'Content-Type': 'application/json'})[0] == 400, 'unsigned'

            # 4. Refunds: operators only, partial then the remainder, never more than was paid.
            stranger = token(good_key, phone_number='+919000000002')
            ops = token(good_key, phone_number=OPERATOR)
            assert operator_call('operator/refund', {'sessionId': sid}, stranger)[0] == 403
            assert operator_call('operator/refund', {'sessionId': sid, 'amount': due / 100 + 1}, ops)[0] == 400
            code, first = operator_call('operator/refund', {'sessionId': sid, 'amount': 0.5, 'reason': 'Charger fault'}, ops)
            assert code == 200 and first['amount'] == 0.5 and first['refunds'][0]['status'] == 'pending', first
            code, rest = operator_call('operator/refund', {'sessionId': sid}, ops)
            assert code == 200 and round(rest['amount'] * 100) == due - 50, rest
            assert REFUNDS == [('pay_CLOSED1', 50), ('pay_CLOSED1', due - 50)], REFUNDS
            assert operator_call('operator/refund', {'sessionId': sid}, ops)[0] == 409, 'already fully refunded'
            receipt = session_of(customer, sid)['receipt']
            assert receipt['refunded'] == due / 100 and receipt['netCollected'] == 0, receipt
            assert webhook({'event': 'refund.processed', 'payload': {'refund': {'entity': {'id': 'rfnd_TEST1', 'status': 'processed'}}}}, 'evt_3')[0] == 200
            with sqlite3.connect(db) as connection:
                statuses = dict(connection.execute('SELECT id,status FROM customer_refunds').fetchall())
            assert statuses == {'rfnd_TEST1': 'processed', 'rfnd_TEST2': 'pending'}, statuses
            print('PASS: paid-then-closed recovery (no second order), authorized capture, signed/replayed/forged/mismatched '
                  'webhooks, payment.failed, operator-only partial and full refunds with over-refund refused, refund webhooks')
        finally:
            stop(server)
            fake.shutdown()


if __name__ == '__main__':
    main()
