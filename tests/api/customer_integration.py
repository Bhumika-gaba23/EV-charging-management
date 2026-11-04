"""Real C++/SQLite integration tests; no mocked API responses or paid services."""
import concurrent.futures
import http.cookiejar
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
BINARY=ROOT/'build-web-demo/ev_web_api'
class Client:
    def __init__(self,port):
        self.base=f'http://127.0.0.1:{port}/api/customer/'
        self.jar=http.cookiejar.CookieJar();self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
    def call(self,path,method='GET',value=None,key=None,csrf=True,extra=None):
        headers={'Content-Type':'application/json',**(extra or {})}
        if csrf:headers['X-Pluggo-Request']='1'
        if key:headers['Idempotency-Key']=key
        request=urllib.request.Request(self.base+path,method=method,data=None if value is None else json.dumps(value).encode(),headers=headers)
        try:
            with self.http.open(request,timeout=10) as response:return response.status,json.load(response)
        except urllib.error.HTTPError as response:return response.code,json.load(response)

def wait_ready(port):
    for _ in range(100):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health',timeout=.5):return
        except OSError:time.sleep(.1)
    raise AssertionError('API failed to start')
def start(port,db,mode='clock'):
    env={**os.environ,'CHARGEFLOW_PORT':str(port),'CHARGEFLOW_CUSTOMER_DB':str(db),'CHARGEFLOW_SIMULATION_MODE':mode,'CHARGEFLOW_SIMULATOR_KEY':'integration-test-key'}
    process=subprocess.Popen([str(BINARY)],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);wait_ready(port);return process
def stop(process):
    if process and process.poll() is None:
        process.terminate()
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill();process.wait()

def main():
    server=meter_server=sim=None
    with tempfile.TemporaryDirectory(prefix='pluggo-api-test-') as tmp:
        try:
            db=Path(tmp)/'clock.sqlite3';server=start(18081,db)
            a,b=Client(18081),Client(18081)
            assert a.call('bootstrap')[0]==200;assert b.call('bootstrap')[0]==200
            assert b.call('state',extra={'Origin':'https://untrusted.example'})[0]==403
            assert a.call('preferences','PUT',{'vehicle':'bike','saved':['CP']},csrf=False)[0]==403
            assert a.call('preferences','PUT',{'vehicle':'bike','saved':['CP']})[0]==200
            value={'station':'CP','connector':'CP-01','vehicle':'car','target':30,'budget':50,'power':99999,'energy':99999,'cost':-1}
            assert a.call('sessions','POST',{**value,'target':200},'invalid')[0]==400
            assert a.call('sessions','POST',{**value,'connector':'CP-03'},'incompatible')[0]==409
            code,result=a.call('sessions','POST',value,'one');assert code==200 and result['ok']
            session=result['state']['sessions'][0];sid=session['id'];assert session['power']==50 and session['energy']<.1 and session['cost']>=0
            assert a.call('sessions','POST',value,'one')[1]['sessionId']==sid
            assert a.call('sessions','POST',{**value,'budget':100},'one')[0]==409
            assert b.call('sessions','POST',value,'two')[0]==409
            assert b.call(f'sessions/{sid}/stop','POST',{})[0]==404
            assert b.call(f'sessions/{sid}/checkout','POST',{})[0]==404
            assert a.call(f'sessions/{sid}/checkout','POST',{})[0]==409
            c,d=Client(18081),Client(18081);c.call('bootstrap');d.call('bootstrap')
            other={**value,'station':'LR','connector':'LR-01'}
            with concurrent.futures.ThreadPoolExecutor() as pool:
                results=list(pool.map(lambda pair:pair[0].call('sessions','POST',other,pair[1])[0],[(c,'race-c'),(d,'race-d')]))
            assert sorted(results)==[200,409],results
            c.call('reset','POST',{});d.call('reset','POST',{})
            time.sleep(2.7);snapshot=a.call('state')[1];session=snapshot['state']['sessions'][0]
            assert session['ended'] and abs(session['energy']-2)<1e-6 and session['cost']==36 and session['reason']=='Charge target reached'
            assert a.call('sessions','POST',other,'blocked-by-checkout')[0]==409
            paid=a.call(f'sessions/{sid}/checkout','POST',{})[1]['state']['sessions'][0]
            assert paid['receipt']['amountCollected']==0
            assert a.call(f'sessions/{sid}/checkout','POST',{})[1]['state']['sessions'][0]['receipt']['id']==paid['receipt']['id']
            stop(server);server=start(18081,db);restored=a.call('state')[1]['state'];assert restored['vehicle']=='bike' and restored['saved']==['CP'] and restored['sessions'][0]['settled']
            assert b.call('state')[1]['state']['sessions']==[]
            meter_server=start(18082,Path(tmp)/'meter.sqlite3','meter');m=Client(18082);m.call('bootstrap')
            assert m.call('sessions','POST',value,'offline')[0]==409
            assert m.call('simulator/active')[0]==401
            sim=subprocess.Popen(['python3',str(ROOT/'ocpp-simulator/customer_simulator.py')],cwd=ROOT,env={**os.environ,'PLUGGO_CUSTOMER_API':'http://127.0.0.1:18082','CHARGEFLOW_SIMULATOR_KEY':'integration-test-key'},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            for _ in range(50):
                if m.call('state')[1]['backend']['simulatorConnected']:break
                time.sleep(.1)
            assert m.call('state')[1]['backend']['simulatorConnected']
            result=m.call('sessions','POST',value,'meter-session')[1];mid=result['sessionId'];time.sleep(2.2)
            measured=m.call('state')[1]['state']['sessions'][0];assert measured['energy']>0 and measured['energy']<=2
            auth={'X-Charger-Key':'integration-test-key'}
            m.call('simulator/meter','POST',{'sessionId':mid,'connector':'CP-01','energyKWh':0},extra=auth)
            assert m.call('state')[1]['state']['sessions'][0]['energy']>=measured['energy']
            m.call('simulator/meter','POST',{'sessionId':mid,'connector':'CP-01','energyKWh':999,'cost':-1,'currentSoc':150},extra=auth)
            measured=m.call('state')[1]['state']['sessions'][0];assert measured['ended'] and measured['cost']==36 and measured['currentSoc']==30
            print('PASS: real C++ API, SQLite restart persistence, guest isolation, CSRF/origin checks, server validation, idempotency, connector races, target cap, receipt replay, and authenticated WebSocket simulator metering.')
        finally:
            stop(sim);stop(meter_server);stop(server)
if __name__=='__main__':main()
