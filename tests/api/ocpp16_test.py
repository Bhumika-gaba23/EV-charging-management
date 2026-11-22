"""Physical-charger path: real C++ API + OCPP 1.6J gateway + an emulated charger.

The charger is built on the `ocpp` library's charge-point side, which validates every message
the gateway sends against the official OCPP 1.6 JSON schemas.
"""
import asyncio
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

from ocpp.routing import on
from ocpp.v16 import ChargePoint, call
from ocpp.v16 import call_result
from ocpp.v16.enums import Action, RemoteStartStopStatus, ConfigurationStatus
from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus

from customer_integration import BINARY, ROOT, Client, stop, wait_ready

API_PORT, OCPP_PORT = 18089, 19016
CP_ID, PASSWORD = 'TEST-CP-1', '0123456789abcdef'
CHARGERS = json.dumps({CP_ID: {'password': PASSWORD, 'connectors': {'1': 'CP-01'}}})
PLAN = {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car', 'target': 80, 'budget': 300}


class Charger(ChargePoint):
    """Emulated wallbox: accepts or refuses remote commands, then behaves like hardware."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.remote_start = 'Accepted'
        self.auto_start = True
        self.meter = 1_000_000  # Wh
        self.tx = None
        self.tag = None
        self.config = {}
        self.events = []

    @on(Action.remote_start_transaction)
    async def on_remote_start(self, id_tag, connector_id=None, **_):
        self.events.append(('RemoteStart', id_tag, connector_id))
        self.tag = id_tag
        if self.remote_start == 'Accepted' and self.auto_start:
            asyncio.get_running_loop().call_later(0.2, lambda: asyncio.ensure_future(self.begin(connector_id)))
        return call_result.RemoteStartTransaction(status=self.remote_start)

    @on(Action.remote_stop_transaction)
    async def on_remote_stop(self, transaction_id, **_):
        self.events.append(('RemoteStop', transaction_id))
        asyncio.get_running_loop().call_later(0.2, lambda: asyncio.ensure_future(self.finish(500, 'Remote')))
        return call_result.RemoteStopTransaction(status=RemoteStartStopStatus.accepted)

    @on(Action.change_configuration)
    async def on_config(self, key, value, **_):
        self.config[key] = value
        return call_result.ChangeConfiguration(status=ConfigurationStatus.accepted)

    async def status(self, status, error='NoError'):
        await self.call(call.StatusNotification(connector_id=1, error_code=error, status=status))

    async def begin(self, connector_id=1):
        auth = await self.call(call.Authorize(id_tag=self.tag))
        assert auth.id_tag_info['status'] == 'Accepted', auth
        await self.status('Preparing')
        reply = await self.call(call.StartTransaction(connector_id=connector_id, id_tag=self.tag, meter_start=self.meter,
                                                      timestamp='2026-11-23T10:00:00Z'))
        assert reply.id_tag_info['status'] == 'Accepted', reply
        self.tx = reply.transaction_id
        await self.status('Charging')

    async def deliver(self, wh):
        self.meter += wh
        await self.call(call.MeterValues(connector_id=1, transaction_id=self.tx, meter_value=[{
            'timestamp': '2026-11-23T10:01:00Z',
            'sampledValue': [{'value': str(self.meter), 'measurand': 'Energy.Active.Import.Register', 'unit': 'Wh'}]}]))

    async def finish(self, extra_wh, reason):
        self.meter += extra_wh
        await self.call(call.StopTransaction(meter_stop=self.meter, timestamp='2026-11-23T10:05:00Z',
                                             transaction_id=self.tx, reason=reason))
        self.tx = None
        await self.status('Available')


def auth(password=PASSWORD, user=CP_ID):
    return {'Authorization': 'Basic ' + base64.b64encode(f'{user}:{password}'.encode()).decode()}


async def handshake(path=f'/ocpp/{CP_ID}', headers=None, subprotocols=('ocpp1.6',)):
    try:
        async with connect(f'ws://127.0.0.1:{OCPP_PORT}{path}', additional_headers=auth() if headers is None else headers, subprotocols=list(subprotocols)):
            return 101
    except InvalidStatus as error:
        return error.response.status_code


async def until(check, timeout=8, message='condition'):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = await asyncio.to_thread(check)
        if value:
            return value
        await asyncio.sleep(0.2)
    raise AssertionError(f'timed out waiting for {message}')


def connector_available(client):
    catalog = client.call('state')[1]['catalog']
    connector = next(c for s in catalog['stations'] for c in s['connectors'] if c['id'] == 'CP-01')
    assert connector['ocpp'] is True
    return connector['available']


def session(client, sid):
    return next(s for s in client.call('state')[1]['state']['sessions'] if s['id'] == sid)


async def scenario(customer):
    # Offline before the charger connects.
    assert connector_available(customer) is False
    code, reply = customer.call('verify', 'POST', {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car'})
    assert code == 409 and 'offline' in reply['error'], reply

    # Handshake security: unknown charger, wrong password, wrong user, no subprotocol.
    assert await handshake('/ocpp/UNKNOWN-CP') == 404
    assert await handshake(headers=auth('wrong-password-123')) == 401
    assert await handshake(headers=auth(user='OTHER')) == 401
    assert await handshake(headers={}) == 401
    assert await handshake(subprotocols=('ocpp2.0.1',)) == 400

    async with connect(f'ws://127.0.0.1:{OCPP_PORT}/ocpp/{CP_ID}', additional_headers=auth(), subprotocols=['ocpp1.6']) as ws:
        assert ws.subprotocol == 'ocpp1.6'
        charger = Charger(CP_ID, ws)
        loop = asyncio.create_task(charger.start())
        boot = await charger.call(call.BootNotification(charge_point_model='Wallbox 7kW', charge_point_vendor='TestVendor'))
        assert boot.status == 'Accepted' and boot.interval == 60
        await until(lambda: charger.config.get('MeterValueSampleInterval') == '10', message='meter interval configured')
        assert charger.config['MeterValuesSampledData'] == 'Energy.Active.Import.Register'
        await charger.status('Available')
        await until(lambda: connector_available(customer), message='connector available')
        assert (await charger.call(call.Authorize(id_tag='RANDOMRFID'))).id_tag_info['status'] == 'Invalid', 'free RFID charging refused'

        # 1. App start -> RemoteStart -> StartTransaction -> MeterValues -> app stop -> RemoteStop -> StopTransaction.
        code, started = customer.call('sessions', 'POST', PLAN, 'ocpp-1')
        assert code == 200, started
        sid = started['sessionId']
        await until(lambda: charger.tx, message='transaction started')
        assert charger.events[0][0] == 'RemoteStart' and charger.events[0][2] == 1
        await charger.deliver(1500)
        await until(lambda: abs(session(customer, sid)['energy'] - 1.5) < 1e-6, message='1.5 kWh metered')
        await asyncio.sleep(1.5)
        assert abs(session(customer, sid)['energy'] - 1.5) < 1e-6, 'no simulated energy on a real charger'
        assert customer.call(f'sessions/{sid}/stop', 'POST', {})[0] == 200
        await until(lambda: any(e[0] == 'RemoteStop' for e in charger.events), message='RemoteStop')
        await until(lambda: abs(session(customer, sid)['energy'] - 2.0) < 1e-6, message='final StopTransaction reading billed')
        final = session(customer, sid)
        assert final['ended'] and final['reason'] == 'Stopped by you', final
        assert customer.call(f'sessions/{sid}/checkout', 'POST', {})[0] == 200
        await until(lambda: connector_available(customer), message='connector free again')

        # 2. The driver unplugs at the charger: the app session ends with that reason.
        sid = customer.call('sessions', 'POST', PLAN, 'ocpp-2')[1]['sessionId']
        await until(lambda: charger.tx, message='second transaction')
        await charger.deliver(800)
        await until(lambda: session(customer, sid)['energy'] > 0.79, message='meter 0.8 kWh')
        await charger.finish(200, 'EVDisconnected')
        await until(lambda: session(customer, sid)['ended'], message='charger-side stop ends the session')
        ended = session(customer, sid)
        assert ended['reason'] == 'Cable unplugged at the charger' and abs(ended['energy'] - 1.0) < 1e-6, ended
        assert customer.call(f'sessions/{sid}/checkout', 'POST', {})[0] == 200

        # 3. The charger refuses RemoteStart: the session ends without charge.
        charger.remote_start = 'Rejected'
        await until(lambda: connector_available(customer), message='available before refusal test')
        sid = customer.call('sessions', 'POST', PLAN, 'ocpp-3')[1]['sessionId']
        await until(lambda: session(customer, sid)['ended'], message='refused start ends session')
        refused = session(customer, sid)
        assert refused['reason'] == 'The charger refused to start' and refused['energy'] == 0, refused
        assert customer.call(f'sessions/{sid}/checkout', 'POST', {})[0] == 200

        # 4. Accepted but never plugged in: ends after the start timeout.
        charger.remote_start, charger.auto_start = 'Accepted', False
        sid = customer.call('sessions', 'POST', PLAN, 'ocpp-4')[1]['sessionId']
        await until(lambda: session(customer, sid)['ended'], timeout=12, message='start timeout')
        assert 'did not start' in session(customer, sid)['reason']
        assert customer.call(f'sessions/{sid}/checkout', 'POST', {})[0] == 200
        charger.auto_start = True

        # 5. Faulted connector cannot be booked.
        await charger.status('Faulted', 'GroundFailure')
        await until(lambda: not connector_available(customer), message='faulted connector unavailable')
        code, reply = customer.call('verify', 'POST', {'station': 'CP', 'connector': 'CP-01', 'vehicle': 'car'})
        assert code == 409 and 'Faulted' in reply['error'], reply
        await charger.status('Available')
        await until(lambda: connector_available(customer), message='recovered')
        loop.cancel()

    # 6. Disconnected charger goes offline.
    await until(lambda: not connector_available(customer), message='offline after disconnect')


def main():
    with tempfile.TemporaryDirectory(prefix='pluggo-ocpp-') as tmp:
        folder = Path(tmp)
        env = {**os.environ, 'CHARGEFLOW_PORT': str(API_PORT), 'CHARGEFLOW_CUSTOMER_DB': str(folder / 'db.sqlite3'),
               'CHARGEFLOW_SIMULATION_MODE': 'clock', 'CHARGEFLOW_SIMULATOR_KEY': 'ocpp-test-key',
               'PLUGGO_REAL_CONNECTORS': 'CP-01'}
        for name in ('PLUGGO_FIREBASE_PROJECT_ID', 'RAZORPAY_KEY_ID', 'PLUGGO_OPERATOR_PHONES'):
            env.pop(name, None)
        server = subprocess.Popen([str(BINARY)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        gateway = None
        try:
            wait_ready(API_PORT)
            gateway = subprocess.Popen([sys.executable, str(ROOT / 'ocpp-gateway/gateway.py')], cwd=ROOT, stdout=subprocess.DEVNULL,
                                       stderr=open(folder / 'gateway.log', 'w'),
                                       env={**env, 'PLUGGO_CUSTOMER_API': f'http://127.0.0.1:{API_PORT}',
                                            'PLUGGO_CUSTOMER_WS': f'ws://127.0.0.1:{API_PORT}/ocpp/customer',
                                            'PLUGGO_OCPP_CHARGERS': CHARGERS, 'PLUGGO_OCPP_PORT': str(OCPP_PORT),
                                            'PLUGGO_OCPP_START_TIMEOUT': '4'})
            customer = Client(API_PORT)
            assert customer.call('bootstrap')[0] == 200
            time.sleep(1.5)
            active = __import__('urllib.request').request.urlopen(__import__('urllib.request').request.Request(
                f'http://127.0.0.1:{API_PORT}/api/customer/simulator/active', headers={'X-Charger-Key': 'ocpp-test-key'}))
            assert json.load(active)['ok']
            try:
                asyncio.run(scenario(customer))
            except Exception:
                print((folder / 'gateway.log').read_text()[-3000:])
                raise
            print('PASS: OCPP 1.6J gateway: handshake auth (unknown/wrong password/no subprotocol), boot + meter interval config, '
                  'offline/faulted/available status, RFID refused, RemoteStart->StartTransaction->MeterValues->RemoteStop->StopTransaction '
                  'with final reading billed, charger-side unplug, refused start, start timeout, disconnect')
        finally:
            if gateway:
                stop(gateway)
            stop(server)


if __name__ == '__main__':
    main()
