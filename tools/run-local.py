"""Run frontend, C++ API and customer charging simulator together."""
import argparse
import os
from pathlib import Path
import secrets
import signal
import subprocess
import sys
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--build',action='store_true')
parser.add_argument('--port',type=int,default=4173)
parser.add_argument('--api-port',type=int,default=18080)
parser.add_argument('--mode',choices=['meter','clock'],default='meter')
args=parser.parse_args()
if args.build or not (ROOT/'build-web-demo/ev_web_api').exists():
    subprocess.run(['sh','tools/build-local.sh'],cwd=ROOT,check=True)
try: import websockets  # noqa: F401
except ImportError:
    raise SystemExit('Install the simulator dependency in your Python environment: pip install -r ocpp-simulator/requirements.txt')
key_path=ROOT/'secrets/local_simulator_key.txt'
if not key_path.exists():
    key_path.parent.mkdir(exist_ok=True)
    key_path.write_text(secrets.token_hex(32)+'\n');key_path.chmod(0o600)
env={**os.environ,'CHARGEFLOW_PORT':str(args.api_port),'CHARGEFLOW_SIMULATION_MODE':args.mode,'CHARGEFLOW_SIMULATOR_KEY':key_path.read_text().strip(),'CHARGEFLOW_CUSTOMER_DB':str(ROOT/'data/pluggo.sqlite3'),'PLUGGO_CUSTOMER_API':f'http://127.0.0.1:{args.api_port}'}
processes=[]
def stop_all(*_):
    for process in reversed(processes):
        if process.poll() is None: process.terminate()
    for process in processes:
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill();process.wait()
    if _: raise SystemExit(0)
signal.signal(signal.SIGINT,stop_all);signal.signal(signal.SIGTERM,stop_all)
try:
    processes.append(subprocess.Popen([str(ROOT/'build-web-demo/ev_web_api')],cwd=ROOT,env=env))
    for _ in range(100):
        if processes[0].poll() is not None: raise RuntimeError('The API could not start; check the port and database path.')
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{args.api_port}/api/health',timeout=.5): break
        except OSError: time.sleep(.1)
    else: raise RuntimeError('The API did not become ready.')
    processes.append(subprocess.Popen([sys.executable,'ocpp-simulator/customer_simulator.py'],cwd=ROOT,env=env))
    processes.append(subprocess.Popen([sys.executable,'tools/dev-server.py','--port',str(args.port),'--api',f'http://127.0.0.1:{args.api_port}'],cwd=ROOT,env=env))
    print(f'Pluggo: http://127.0.0.1:{args.port} — persistent C++ backend + {args.mode} simulator',flush=True)
    while all(process.poll() is None for process in processes): time.sleep(.5)
    raise RuntimeError('A local service stopped; see its output above.')
finally: stop_all()
