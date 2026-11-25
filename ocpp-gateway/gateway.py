"""OCPP 1.6J gateway: connects physical chargers to Pluggo's C++ charging server.

Chargers connect to  wss://<host>/ocpp/<charge-point-id>  with the "ocpp1.6" subprotocol and
HTTP Basic credentials (OCPP 1.6 Security Profile 1/2: TLS is terminated by the host). Every
message is validated against the official OCPP 1.6 JSON schemas by the `ocpp` library.

Customer sessions stay owned by the C++ server; the gateway only drives the hardware:
  app start  -> RemoteStartTransaction -> StartTransaction -> MeterValues -> server energy (and the car's SoC on DC chargers)
  server end (target, budget or user stop) -> RemoteStopTransaction -> StopTransaction
  driver stops at the charger -> StopTransaction -> session ends in the app
Connector status (StatusNotification, online/offline) is reported to the server, which only
offers a real connector to customers while it is online and Available.

Configuration (environment):
  PLUGGO_OCPP_CHARGERS  JSON: {"<charge-point-id>": {"password": "<16-40 chars>",
                                                      "connectors": {"1": "<Pluggo connector id>"}}}
  PLUGGO_OCPP_PORT      listen port (default 9016, loopback only; the host proxies /ocpp/)
  PLUGGO_CUSTOMER_API, PLUGGO_CUSTOMER_WS, CHARGEFLOW_SIMULATOR_KEY  private server channel
"""
import asyncio
import base64
import binascii
from dataclasses import dataclass, field
from datetime import datetime, timezone
import hmac
import http
import json
import logging
import os
import re
import time
import urllib.request
import uuid
import zlib

from ocpp.routing import after, on
from ocpp.v16 import ChargePoint as OcppChargePoint, call, call_result
from ocpp.v16.enums import Action, AuthorizationStatus, ConfigurationStatus, RegistrationStatus, RemoteStartStopStatus
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

LOG = logging.getLogger('pluggo.ocpp')
API = os.getenv('PLUGGO_CUSTOMER_API', 'http://127.0.0.1:18080').rstrip('/')
WS = os.getenv('PLUGGO_CUSTOMER_WS', 'ws://127.0.0.1:18080/ocpp/customer')
KEY = os.getenv('CHARGEFLOW_SIMULATOR_KEY', 'local-simulator-key')
PORT = int(os.getenv('PLUGGO_OCPP_PORT', '9016'))
START_TIMEOUT = float(os.getenv('PLUGGO_OCPP_START_TIMEOUT', '90'))  # seconds to plug in after RemoteStart
ENERGY = 'Energy.Active.Import.Register'
SOC = 'SoC'  # the car's battery %, which DC chargers receive from the car over CCS2


def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def load_chargers(raw):
    """Validates PLUGGO_OCPP_CHARGERS. Returns {cp_id: {"password", "connectors": {int: str}}}."""
    if not raw.strip():
        return {}
    data = json.loads(raw)
    chargers = {}
    for cp_id, item in data.items():
        if not re.fullmatch(r'[A-Za-z0-9._-]{1,48}', cp_id):
            raise SystemExit(f'Invalid charge point id {cp_id!r}')
        password = str(item.get('password', ''))
        if not 16 <= len(password) <= 40:
            raise SystemExit(f'Charge point {cp_id}: password must be 16-40 characters (OCPP 1.6 security profile)')
        connectors = {int(k): str(v) for k, v in (item.get('connectors') or {}).items()}
        if not connectors or any(k < 1 for k in connectors):
            raise SystemExit(f'Charge point {cp_id}: map at least one connector number (1, 2, ...) to a Pluggo connector')
        chargers[cp_id] = {'password': password, 'connectors': connectors}
    pluggo = [c for cp in chargers.values() for c in cp['connectors'].values()]
    if len(pluggo) != len(set(pluggo)):
        raise SystemExit('Each Pluggo connector can belong to one physical connector only')
    return chargers


def real_connectors(raw):
    return sorted(c for cp in load_chargers(raw).values() for c in cp['connectors'].values())


def transaction_id(session_id):
    """Stable OCPP transaction id for a session, so a restarted gateway can still match meter values."""
    return zlib.crc32(session_id.encode()) & 0x7FFFFFFF or 1


def id_tag(session_id):
    return re.sub(r'[^A-Za-z0-9]', '', session_id)[:20].upper()


def soc_percent(meter_values):
    """Latest SoC reading (the car's own battery %) from OCPP MeterValue entries, or None."""
    reading = None
    for entry in meter_values or []:
        for sample in entry.get('sampled_value', []):
            if sample.get('measurand') != SOC:
                continue
            try:
                value = float(sample['value'])
            except (KeyError, ValueError):
                continue
            if 0 <= value <= 100:
                reading = value
    return reading


def energy_wh(meter_values):
    """Latest Energy.Active.Import.Register reading in Wh from OCPP MeterValue entries, or None."""
    reading = None
    for entry in meter_values or []:
        for sample in entry.get('sampled_value', []):
            if sample.get('measurand', ENERGY) != ENERGY or sample.get('phase'):
                continue
            try:
                value = float(sample['value'])
            except (KeyError, ValueError):
                continue
            reading = value * 1000 if sample.get('unit') == 'kWh' else value
    return reading


class Server:
    """Private channel to the C++ server: the same authenticated socket the simulator uses."""

    def __init__(self):
        self.socket = None
        self.lock = asyncio.Lock()

    async def send(self, action, payload):
        async with self.lock:
            if self.socket is None:
                self.socket = await connect(WS, additional_headers={'X-Charger-Key': KEY}, subprotocols=['ocpp2.0.1'])
            uid = uuid.uuid4().hex
            try:
                await self.socket.send(json.dumps([2, uid, action, payload]))
                reply = json.loads(await asyncio.wait_for(self.socket.recv(), timeout=5))
            except Exception:
                socket, self.socket = self.socket, None
                await socket.close()
                raise
            if reply[0] != 3 or reply[1] != uid:
                raise RuntimeError('Unexpected server acknowledgement')

    def active(self):
        request = urllib.request.Request(API + '/api/customer/simulator/active', headers={'X-Charger-Key': KEY})
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.load(response)['sessions']


@dataclass
class Transaction:
    session: str
    connector_id: int
    meter_start: float
    energy_kwh: float = 0.0
    stop_sent: bool = False


@dataclass
class ChargerState:
    cp_id: str
    config: dict
    point: 'ChargePoint | None' = None
    statuses: dict = field(default_factory=dict)       # connector_id -> (status, error_code)
    transactions: dict = field(default_factory=dict)   # transaction_id -> Transaction
    starting: dict = field(default_factory=dict)       # session id -> monotonic time RemoteStart was accepted

    def connector_id(self, pluggo_connector):
        return next((k for k, v in self.config['connectors'].items() if v == pluggo_connector), None)


class ChargePoint(OcppChargePoint):
    def __init__(self, state, gateway, connection):
        super().__init__(state.cp_id, connection, response_timeout=15)
        self.state, self.gateway = state, gateway

    @on(Action.boot_notification)
    async def on_boot(self, charge_point_model, charge_point_vendor, **_):
        LOG.info('%s booted (%s %s)', self.state.cp_id, charge_point_vendor, charge_point_model)
        return call_result.BootNotification(current_time=now(), interval=60, status=RegistrationStatus.accepted)

    @after(Action.boot_notification)
    async def configure(self, **_):
        # Ask for an energy reading every 10 s, so a stop leaves at most a few Wh unbilled, and the car's
        # SoC with it. AC chargers never get SoC from the car and may refuse it: then energy alone.
        async def setting(key, value):
            try:
                result = await self.call(call.ChangeConfiguration(key=key, value=value))
                status = getattr(result, 'status', 'no reply')
                LOG.info('%s %s=%s: %s', self.state.cp_id, key, value, status)
                return status == ConfigurationStatus.accepted
            except Exception as error:
                LOG.warning('%s could not set %s: %s', self.state.cp_id, key, error)
                return False
        await setting('MeterValueSampleInterval', '10')
        if not await setting('MeterValuesSampledData', f'{ENERGY},{SOC}'):
            await setting('MeterValuesSampledData', ENERGY)

    @on(Action.heartbeat)
    async def on_heartbeat(self, **_):
        return call_result.Heartbeat(current_time=now())

    @on(Action.status_notification)
    async def on_status(self, connector_id, error_code, status, **_):
        self.state.statuses[connector_id] = (status, error_code)
        await self.gateway.report(self.state)
        return call_result.StatusNotification()

    @on(Action.authorize)
    async def on_authorize(self, id_tag, **_):
        ok = self.gateway.session_for_tag(self.state, id_tag) is not None
        return call_result.Authorize(id_tag_info={'status': AuthorizationStatus.accepted if ok else AuthorizationStatus.invalid})

    @on(Action.start_transaction)
    async def on_start(self, connector_id, id_tag, meter_start, timestamp, **_):
        session = self.gateway.session_for_tag(self.state, id_tag)
        if session is None or self.state.connector_id(session['connector']) != connector_id:
            LOG.warning('%s refused start on connector %s for tag %s', self.state.cp_id, connector_id, id_tag)
            return call_result.StartTransaction(transaction_id=transaction_id('refused:' + id_tag),
                                                id_tag_info={'status': AuthorizationStatus.invalid})
        tx = transaction_id(session['id'])
        self.state.transactions[tx] = Transaction(session['id'], connector_id, float(meter_start))
        self.state.starting.pop(session['id'], None)
        LOG.info('%s started transaction %s for session %s', self.state.cp_id, tx, session['id'])
        return call_result.StartTransaction(transaction_id=tx, id_tag_info={'status': AuthorizationStatus.accepted})

    @on(Action.meter_values)
    async def on_meter(self, connector_id, meter_value, transaction_id=None, **_):
        reading = energy_wh(meter_value)
        if transaction_id is not None and reading is not None:
            await self.gateway.meter(self.state, transaction_id, reading, connector_id, soc_percent(meter_value))
        return call_result.MeterValues()

    @on(Action.stop_transaction)
    async def on_stop(self, meter_stop, timestamp, transaction_id, reason=None, **_):
        await self.gateway.stopped(self.state, transaction_id, float(meter_stop), reason)
        return call_result.StopTransaction(id_tag_info={'status': AuthorizationStatus.accepted})


class Gateway:
    def __init__(self, chargers, server=None):
        self.chargers = {cp_id: ChargerState(cp_id, config) for cp_id, config in chargers.items()}
        self.server = server or Server()
        self.sessions = {}  # latest active sessions from the server, by id

    # ---- charger connections -------------------------------------------------------------
    def check_request(self, connection, request):
        """Rejects unknown charge points and wrong passwords before the WebSocket opens."""
        match = re.fullmatch(r'/ocpp/([A-Za-z0-9._-]{1,48})/?', request.path.split('?')[0])
        state = self.chargers.get(match.group(1)) if match else None
        if state is None:
            return connection.respond(http.HTTPStatus.NOT_FOUND, 'Unknown charge point\n')
        header = request.headers.get('Authorization', '')
        try:
            user, _, password = base64.b64decode(header.removeprefix('Basic ').strip(), validate=True).decode().partition(':')
        except (binascii.Error, UnicodeDecodeError):
            user, password = '', ''
        if not header.startswith('Basic ') or user != state.cp_id or not hmac.compare_digest(password, state.config['password']):
            response = connection.respond(http.HTTPStatus.UNAUTHORIZED, 'Invalid credentials\n')
            response.headers['WWW-Authenticate'] = 'Basic realm="Pluggo OCPP"'
            return response
        if 'ocpp1.6' not in request.headers.get('Sec-WebSocket-Protocol', '').replace(' ', '').split(','):
            return connection.respond(http.HTTPStatus.BAD_REQUEST, 'Use the ocpp1.6 subprotocol\n')
        return None

    async def handle(self, connection):
        cp_id = connection.request.path.split('?')[0].rstrip('/').rsplit('/', 1)[1]
        state = self.chargers[cp_id]
        if state.point is not None:
            await state.point._connection.close(code=1000, reason='Replaced by a new connection')
        point = ChargePoint(state, self, connection)
        state.point = point
        LOG.info('%s connected', cp_id)
        await self.report(state)
        try:
            await point.start()
        except ConnectionClosed:
            pass
        finally:
            if state.point is point:
                state.point = None
                LOG.info('%s disconnected', cp_id)
                await self.report(state)

    # ---- server side ---------------------------------------------------------------------
    async def report(self, state):
        for number, pluggo in state.config['connectors'].items():
            status, error = state.statuses.get(number, ('Unknown', 'NoError'))
            try:
                await self.server.send('ConnectorStatus', {'connector': pluggo, 'online': state.point is not None,
                                                           'status': status, 'errorCode': error})
            except Exception as error_:  # the next poll retries
                LOG.warning('status report failed: %s', error_)

    def session_for_tag(self, state, tag):
        for session in self.sessions.values():
            if id_tag(session['id']) == tag and state.connector_id(session['connector']) is not None:
                return session
        return None

    def transaction(self, state, tx):
        """Finds a transaction, rebuilding it from the server's sessions after a gateway restart."""
        if tx in state.transactions:
            return state.transactions[tx]
        session = next((s for s in self.sessions.values() if transaction_id(s['id']) == tx), None)
        if session is None or state.connector_id(session['connector']) is None:
            return None
        recovered = Transaction(session['id'], state.connector_id(session['connector']), meter_start=float('nan'),
                                energy_kwh=session['energy'])
        state.transactions[tx] = recovered
        return recovered

    async def meter(self, state, tx_id, reading_wh, connector_id, soc=None):
        tx = self.transaction(state, tx_id)
        if tx is None:
            return
        if tx.meter_start != tx.meter_start:  # recovered: continue from the energy the server already has
            tx.meter_start = reading_wh - tx.energy_kwh * 1000
        tx.energy_kwh = max(tx.energy_kwh, (reading_wh - tx.meter_start) / 1000)
        pluggo = state.config['connectors'][tx.connector_id]
        event = {'eventType': 'Updated', 'sessionId': tx.session, 'connector': pluggo,
                 'energyKWh': tx.energy_kwh, 'transactionInfo': {'transactionId': str(tx_id)}}
        if soc is not None:
            event['soc'] = soc  # the server stops the charge when the car reaches the driver's target
        await self.server.send('TransactionEvent', event)

    async def stopped(self, state, tx_id, meter_stop_wh, reason):
        tx = self.transaction(state, tx_id)
        if tx is None:
            return
        await self.meter(state, tx_id, meter_stop_wh, tx.connector_id)
        state.transactions.pop(tx_id, None)
        if not tx.stop_sent and tx.session in self.sessions:  # stopped at the charger, not by Pluggo
            pluggo = state.config['connectors'][tx.connector_id]
            text = {'EVDisconnected': 'Cable unplugged at the charger', 'Local': 'Stopped at the charger',
                    'EmergencyStop': 'Emergency stop at the charger', 'PowerLoss': 'Charger lost power'}.get(reason or 'Local', 'Stopped at the charger')
            await self.server.send('TransactionEnded', {'sessionId': tx.session, 'connector': pluggo,
                                                        'energyKWh': tx.energy_kwh, 'reason': text})
        LOG.info('%s finished transaction %s (%s)', state.cp_id, tx_id, reason or 'Remote')

    async def end_unstarted(self, state, session, reason):
        state.starting.pop(session['id'], None)
        await self.server.send('TransactionEnded', {'sessionId': session['id'], 'connector': session['connector'],
                                                    'energyKWh': 0, 'reason': reason})

    async def sync(self):
        """One pass: start new sessions on chargers, stop ended ones, report status."""
        sessions = [s for s in await asyncio.to_thread(self.server.active) if s.get('external')]
        self.sessions = {s['id']: s for s in sessions}
        for state in self.chargers.values():
            await self.report(state)
            point = state.point
            active_tx = {tx.session for tx in state.transactions.values()}
            for session in sessions:
                number = state.connector_id(session['connector'])
                if number is None or session['id'] in active_tx:
                    continue
                if session['id'] in state.starting:
                    if time.monotonic() - state.starting[session['id']] > START_TIMEOUT:
                        await self.end_unstarted(state, session, 'Charging did not start. Plug in the cable and try again.')
                    continue
                if point is None:
                    await self.end_unstarted(state, session, 'The charger went offline before charging started')
                    continue
                result = await point.call(call.RemoteStartTransaction(id_tag=id_tag(session['id']), connector_id=number))
                if result is not None and result.status == RemoteStartStopStatus.accepted:
                    state.starting[session['id']] = time.monotonic()
                    LOG.info('%s accepted RemoteStart for session %s', state.cp_id, session['id'])
                else:
                    await self.end_unstarted(state, session, 'The charger refused to start')
            for tx_id, tx in list(state.transactions.items()):
                if tx.session not in self.sessions and not tx.stop_sent and point is not None:
                    result = await point.call(call.RemoteStopTransaction(transaction_id=tx_id))
                    tx.stop_sent = result is not None and result.status == RemoteStartStopStatus.accepted
                    LOG.info('%s RemoteStop for transaction %s: %s', state.cp_id, tx_id, 'accepted' if tx.stop_sent else 'refused')
            state.starting = {sid: at for sid, at in state.starting.items() if sid in self.sessions}

    async def run(self):
        async with serve(self.handle, '127.0.0.1', PORT, subprotocols=['ocpp1.6'], process_request=self.check_request,
                         ping_interval=30, ping_timeout=30, max_size=65536):
            LOG.info('OCPP 1.6J gateway listening on 127.0.0.1:%s for %s charger(s)', PORT, len(self.chargers))
            while True:
                try:
                    await self.sync()
                except Exception as error:  # server restarting or a charger timing out: retry next second
                    LOG.warning('sync failed: %s: %s', type(error).__name__, error)
                await asyncio.sleep(1)


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')
    logging.getLogger('ocpp').setLevel(logging.WARNING)
    chargers = load_chargers(os.getenv('PLUGGO_OCPP_CHARGERS', ''))
    if not chargers:
        raise SystemExit('PLUGGO_OCPP_CHARGERS is empty: no physical chargers to serve')
    asyncio.run(Gateway(chargers).run())


if __name__ == '__main__':
    main()
