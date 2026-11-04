"""Container supervisor: public frontend + loopback C++ API + private simulator."""
import os
import re
from pathlib import Path
import secrets
import signal
import subprocess
import sys
import time
import urllib.request

port=int(os.getenv('PORT','10000'))
if not 1024<=port<=65535 or port==18080:raise SystemExit('PORT must be 1024–65535 and different from the private API port 18080')
root=Path(__file__).resolve().parent
gateway_key=os.getenv('PLUGGO_GATEWAY_KEY') or secrets.token_hex(32)
if not re.fullmatch(r'[A-Za-z0-9_+/=\-]{32,128}',gateway_key):raise SystemExit('PLUGGO_GATEWAY_KEY must be a 32–128 character URL-safe/hex/base64 token')
config=(root/'nginx.conf.template').read_text().replace('__PORT__',str(port)).replace('__GATEWAY_KEY__',gateway_key)
config_path=Path('/tmp/pluggo-nginx.conf');config_path.write_text(config);config_path.chmod(0o600)
env={**os.environ,'CHARGEFLOW_PORT':'18080','CHARGEFLOW_BIND_ADDRESS':'127.0.0.1','CHARGEFLOW_SIMULATION_MODE':'meter','CHARGEFLOW_SIMULATOR_KEY':secrets.token_hex(32),'PLUGGO_CUSTOMER_API':'http://127.0.0.1:18080','PLUGGO_CUSTOMER_WS':'ws://127.0.0.1:18080/ocpp/customer'}
processes=[]
def shutdown(*_):
    for process in reversed(processes):
        if process.poll() is None:process.terminate()
    for process in processes:
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill();process.wait()
    if _:raise SystemExit(0)
signal.signal(signal.SIGTERM,shutdown)
signal.signal(signal.SIGINT,shutdown)
try:
    processes.append(subprocess.Popen([str(root/'ev_web_api')],env=env))
    for _ in range(100):
        if processes[0].poll() is not None:raise RuntimeError('Customer API failed to start')
        try:
            with urllib.request.urlopen('http://127.0.0.1:18080/api/ready',timeout=.5):break
        except OSError:time.sleep(.1)
    else:raise RuntimeError('Customer database/API not ready')
    processes.append(subprocess.Popen([sys.executable,str(root/'customer_simulator.py')],env=env))
    subprocess.run(['nginx','-t','-c','/tmp/pluggo-nginx.conf'],check=True)
    processes.append(subprocess.Popen(['nginx','-c','/tmp/pluggo-nginx.conf','-g','daemon off;']))
    while all(process.poll() is None for process in processes):time.sleep(.5)
    raise RuntimeError('One of the application services exited')
finally:shutdown()
