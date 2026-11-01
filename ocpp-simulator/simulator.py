import asyncio, json, os, random, uuid
from datetime import datetime, timezone
import websockets

BASE = os.getenv("OCPP_CSMS_URL", "ws://localhost:18080/ocpp")
COUNT = int(os.getenv("OCPP_CHARGER_COUNT", "4"))

async def call(ws, action, payload):
    uid = uuid.uuid4().hex
    await ws.send(json.dumps([2, uid, action, payload]))
    while True:
        reply = json.loads(await ws.recv())
        if reply[0] == 3 and reply[1] == uid: return reply[2]

async def charger(index):
    identity = f"CHARGER-{chr(65 + index // 2)}{index % 2 + 1}"
    uri = BASE
    while True:
        try:
            async with websockets.connect(uri, subprotocols=["ocpp2.0.1"]) as ws:
                await call(ws, "BootNotification", {"reason":"PowerUp","chargingStation":{"model":"ChargeFlow Sim","vendorName":"VoltWay","serialNumber":identity}})
                await call(ws, "StatusNotification", {"timestamp":datetime.now(timezone.utc).isoformat(),"connectorStatus":"Available","evseId":1,"connectorId":1})
                transaction = uuid.uuid4().hex
                soc, energy = random.randint(12, 38), 0.0
                await call(ws, "TransactionEvent", {"eventType":"Started","timestamp":datetime.now(timezone.utc).isoformat(),"triggerReason":"CablePluggedIn","seqNo":0,"transactionInfo":{"transactionId":transaction},"evse":{"id":1,"connectorId":1}})
                seq = 1
                while True:
                    await asyncio.sleep(5)
                    soc = min(100, soc + random.uniform(.3, 1.2)); energy += random.uniform(.2, .8)
                    await call(ws, "TransactionEvent", {"eventType":"Updated","timestamp":datetime.now(timezone.utc).isoformat(),"triggerReason":"MeterValuePeriodic","seqNo":seq,"transactionInfo":{"transactionId":transaction},"meterValue":[{"timestamp":datetime.now(timezone.utc).isoformat(),"sampledValue":[{"value":f"{energy:.3f}","measurand":"Energy.Active.Import.Register","unitOfMeasure":{"unit":"kWh"}},{"value":f"{soc:.1f}","measurand":"SoC","unitOfMeasure":{"unit":"Percent"}}]}]}); seq += 1
                    if seq % 6 == 0: await call(ws, "Heartbeat", {})
                    if soc >= 90: break
                await call(ws, "TransactionEvent", {"eventType":"Ended","timestamp":datetime.now(timezone.utc).isoformat(),"triggerReason":"EVCommunicationLost","seqNo":seq,"transactionInfo":{"transactionId":transaction}})
        except Exception as error:
            print(identity, "reconnecting:", error, flush=True); await asyncio.sleep(4)

async def main(): await asyncio.gather(*(charger(i) for i in range(COUNT)))
asyncio.run(main())
