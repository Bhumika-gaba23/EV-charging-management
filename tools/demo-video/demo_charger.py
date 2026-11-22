"""Emulated OCPP 1.6J wallbox for the demo video: connects to the gateway and behaves like hardware."""
import asyncio
import base64

from ocpp.routing import on
from ocpp.v16 import ChargePoint, call, call_result
from ocpp.v16.enums import Action, RemoteStartStopStatus, ConfigurationStatus
from websockets.asyncio.client import connect

CP_ID, PASSWORD = 'DEMO-MH-01', 'demo-charger-password-01'


class Wallbox(ChargePoint):
    meter = 0
    tx = None
    tag = None
    running = False

    @on(Action.remote_start_transaction)
    async def remote_start(self, id_tag, connector_id=None, **_):
        self.tag = id_tag
        print('IN  RemoteStartTransaction  connector 1', flush=True)
        asyncio.get_running_loop().call_later(1.0, lambda: asyncio.ensure_future(self.begin()))
        return call_result.RemoteStartTransaction(status=RemoteStartStopStatus.accepted)

    @on(Action.remote_stop_transaction)
    async def remote_stop(self, transaction_id, **_):
        print(f'IN  RemoteStopTransaction  tx={transaction_id}', flush=True)
        asyncio.get_running_loop().call_later(0.5, lambda: asyncio.ensure_future(self.finish()))
        return call_result.RemoteStopTransaction(status=RemoteStartStopStatus.accepted)

    @on(Action.change_configuration)
    async def config(self, key, value, **_):
        return call_result.ChangeConfiguration(status=ConfigurationStatus.accepted)

    async def status(self, value):
        await self.call(call.StatusNotification(connector_id=1, error_code='NoError', status=value))

    async def begin(self):
        await self.call(call.Authorize(id_tag=self.tag))
        await self.status('Preparing')
        reply = await self.call(call.StartTransaction(connector_id=1, id_tag=self.tag, meter_start=self.meter, timestamp='2026-11-23T10:00:00Z'))
        self.tx = reply.transaction_id
        print(f'OUT StartTransaction  tx {self.tx}  ->  Accepted', flush=True)
        await self.status('Charging')
        self.running = True
        while self.running:
            await asyncio.sleep(1)
            if not self.running:
                break
            self.meter += 120  # 120 Wh per second: a sped-up 30 kW DC charger
            print(f'OUT MeterValues  Energy.Active.Import.Register={self.meter} Wh', flush=True)
            await self.call(call.MeterValues(connector_id=1, transaction_id=self.tx, meter_value=[{
                'timestamp': '2026-11-23T10:01:00Z',
                'sampledValue': [{'value': str(self.meter), 'measurand': 'Energy.Active.Import.Register', 'unit': 'Wh'}]}]))

    async def finish(self):
        self.running = False
        self.meter += 30
        print(f'OUT StopTransaction  meterStop={self.meter} Wh', flush=True)
        await self.call(call.StopTransaction(meter_stop=self.meter, timestamp='2026-11-23T10:05:00Z', transaction_id=self.tx, reason='Remote'))
        await self.status('Available')


async def main():
    auth = {'Authorization': 'Basic ' + base64.b64encode(f'{CP_ID}:{PASSWORD}'.encode()).decode()}
    async with connect(f'ws://127.0.0.1:9016/ocpp/{CP_ID}', additional_headers=auth, subprotocols=['ocpp1.6']) as ws:
        box = Wallbox(CP_ID, ws)
        task = asyncio.create_task(box.start())
        await box.call(call.BootNotification(charge_point_model='DC Wallbox 30 kW', charge_point_vendor='Demo'))
        print('OUT BootNotification  30 kW wallbox  ->  Accepted', flush=True)
        await box.status('Available')
        print('OUT StatusNotification  connector 1 Available', flush=True)
        await task


asyncio.run(main())
