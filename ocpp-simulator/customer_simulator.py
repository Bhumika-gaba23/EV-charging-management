"""Local development meter adapter for the server-owned customer sessions.
Polls active sessions and sends authenticated OCPP-shaped TransactionEvent frames.
No physical charger is controlled. The C++ server clamps energy, targets and budgets.
"""
import asyncio
import json
import os
import time
import urllib.request
import uuid
from urllib.parse import urlsplit
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, InvalidHandshake

API=os.getenv('PLUGGO_CUSTOMER_API','http://127.0.0.1:18080').rstrip('/')
KEY=os.getenv('CHARGEFLOW_SIMULATOR_KEY','local-simulator-key')
parsed=urlsplit(API)
WS=os.getenv('PLUGGO_CUSTOMER_WS',f'{"wss" if parsed.scheme=="https" else "ws"}://{parsed.netloc}/ocpp/customer')
def active():
    request=urllib.request.Request(API+'/api/customer/simulator/active',headers={'X-Charger-Key':KEY})
    with urllib.request.urlopen(request,timeout=5) as response:return json.load(response)
async def call(socket,action,payload):
    uid=uuid.uuid4().hex
    await socket.send(json.dumps([2,uid,action,payload]))
    reply=json.loads(await asyncio.wait_for(socket.recv(),timeout=5))
    if reply[0]!=3 or reply[1]!=uid:raise RuntimeError('Unexpected simulator acknowledgement')
async def main():
    while True:
        try:
            async with connect(WS,additional_headers={'X-Charger-Key':KEY},subprotocols=['ocpp2.0.1']) as socket:
                await call(socket,'BootNotification',{'chargingStation':{'model':'Pluggo customer simulator','vendorName':'Pluggo'}})
                print('Customer meter simulator connected',flush=True)
                last={}
                while True:
                    state=await asyncio.to_thread(active)
                    current=time.monotonic()
                    for session in state['sessions']:
                        previous=last.get(session['id'],current)
                        # Use only elapsed connected time: reconnects cannot fabricate a long meter jump.
                        elapsed=min(2,max(0,current-previous))
                        energy=session['energy']+elapsed*session['power']*state['speed']/3600
                        if state['mode']=='meter':
                            await call(socket,'TransactionEvent',{'eventType':'Updated','sessionId':session['id'],'connector':session['connector'],'energyKWh':energy,'transactionInfo':{'transactionId':session['id']}})
                        last[session['id']]=current
                    last={key:value for key,value in last.items() if any(s['id']==key for s in state['sessions'])}
                    await call(socket,'Heartbeat',{})
                    await asyncio.sleep(1)
        except (OSError,RuntimeError,ValueError,asyncio.TimeoutError,ConnectionClosed,InvalidHandshake) as error:
            print('Customer simulator reconnecting:',type(error).__name__,flush=True)
            await asyncio.sleep(2)
if __name__=='__main__':asyncio.run(main())
