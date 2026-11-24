"""Container supervisor: public frontend + loopback C++ API + private simulator.

When PLUGGO_BACKUP_URL is set, Litestream restores the SQLite database from
S3-compatible storage (for example Cloudflare R2) before the API starts and then
streams every change back to it, so restarts and redeploys keep customer data.
"""
import json
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
# Clipboard copies can include a trailing newline; normalize before validation.
gateway_key=os.getenv('PLUGGO_GATEWAY_KEY', '').strip() or secrets.token_hex(32)
if not re.fullmatch(r'[A-Za-z0-9_+/=\-]{32,128}',gateway_key):raise SystemExit('PLUGGO_GATEWAY_KEY must be a 32–128 character URL-safe/hex/base64 token')
config=(root/'nginx.conf.template').read_text().replace('__PORT__',str(port)).replace('__GATEWAY_KEY__',gateway_key)
config_path=Path('/tmp/pluggo-nginx.conf');config_path.write_text(config);config_path.chmod(0o600)
db_path=Path(os.getenv('CHARGEFLOW_CUSTOMER_DB','/data/pluggo.sqlite3'))
# Physical OCPP 1.6J chargers: {"<charge-point-id>": {"password": "...", "connectors": {"1": "CP-01"}}}.
# The gateway validates the details; the API only needs to know which connectors are real.
chargers_raw=os.getenv('PLUGGO_OCPP_CHARGERS','').strip()
try:real_connectors=sorted(str(c) for cp in (json.loads(chargers_raw) if chargers_raw else {}).values() for c in (cp.get('connectors') or {}).values())
except (ValueError,AttributeError) as error:raise SystemExit(f'PLUGGO_OCPP_CHARGERS is not valid JSON: {error}')
env={**os.environ,'CHARGEFLOW_PORT':'18080','CHARGEFLOW_BIND_ADDRESS':'127.0.0.1','CHARGEFLOW_SIMULATION_MODE':'meter','CHARGEFLOW_SIMULATOR_KEY':secrets.token_hex(32),'PLUGGO_CUSTOMER_API':'http://127.0.0.1:18080','PLUGGO_CUSTOMER_WS':'ws://127.0.0.1:18080/ocpp/customer','CHARGEFLOW_CUSTOMER_DB':str(db_path),'PLUGGO_REAL_CONNECTORS':','.join(real_connectors),'PLUGGO_OCPP_PORT':'9016'}

def backup_config():
    """Return the Litestream config path, or None when backups are not configured."""
    url=os.getenv('PLUGGO_BACKUP_URL','').strip()
    if not url:return None
    if not re.fullmatch(r's3://[a-z0-9][a-z0-9.\-]{1,62}(/[A-Za-z0-9._\-/]*)?',url):raise SystemExit('PLUGGO_BACKUP_URL must look like s3://bucket-name/pluggo')
    for name in ('LITESTREAM_ACCESS_KEY_ID','LITESTREAM_SECRET_ACCESS_KEY'):
        if not os.getenv(name,'').strip():raise SystemExit(f'{name} is required when PLUGGO_BACKUP_URL is set')
        env[name]=os.environ[name].strip()
    endpoint=os.getenv('PLUGGO_BACKUP_ENDPOINT','').strip().strip('"\'')
    # Cloudflare's bucket page shows the endpoint with the bucket name after it
    # (https://<account>.r2.cloudflarestorage.com/pluggo-backup); only the host part is needed.
    match=re.fullmatch(r'(https?://[A-Za-z0-9.\-]+(?::\d+)?)(/[A-Za-z0-9._\-/]*)?',endpoint) if endpoint else None
    if endpoint and not match:raise SystemExit('PLUGGO_BACKUP_ENDPOINT must be a URL such as https://<account>.r2.cloudflarestorage.com')
    if match:endpoint=match.group(1)
    host=re.sub(r'^https?://','',endpoint).split(':')[0].lower() if endpoint else ''
    # These hosts answer with web pages, which Litestream reports as "expected element type <Error> but have <html>".
    if host=='dash.cloudflare.com' or host.endswith('.cloudflare.com'):
        raise SystemExit('PLUGGO_BACKUP_ENDPOINT is a Cloudflare dashboard link. Use the S3 API endpoint instead: '
                         'https://<account-id>.r2.cloudflarestorage.com (R2 overview → Account Details → S3 API).')
    if host.endswith('.r2.dev'):
        raise SystemExit('PLUGGO_BACKUP_ENDPOINT is a public bucket URL (r2.dev). Use the S3 API endpoint instead: '
                         'https://<account-id>.r2.cloudflarestorage.com (R2 overview → Account Details → S3 API).')
    # An R2 endpoint is <32 hex account id>[.eu|.fedramp].r2.cloudflarestorage.com; a shortened or
    # placeholder ID ("…xxxxxx") names no server and fails with "tls: handshake failure".
    if host.endswith('.r2.cloudflarestorage.com') and not re.fullmatch(r'[0-9a-f]{32}(\.(eu|fedramp))?\.r2\.cloudflarestorage\.com',host):
        raise SystemExit(f'PLUGGO_BACKUP_ENDPOINT host "{host}" does not start with a full 32-character Cloudflare account ID. '
                         'Copy the S3 API value from R2 overview → Account Details with its copy button.')
    if host:print(f'Backup endpoint: {host}',flush=True)
    lines=['dbs:',f'  - path: {db_path}','    replicas:',f'      - url: {url}','        sync-interval: 1s','        snapshot-interval: 6h','        retention: 72h']
    if endpoint:lines+=[f'        endpoint: {endpoint.rstrip("/")}','        region: auto','        force-path-style: true']
    path=Path('/tmp/pluggo-litestream.yml');path.write_text('\n'.join(lines)+'\n');path.chmod(0o600)
    return path

processes=[]
backup=None
def stop(process,timeout):
    if process is None or process.poll() is not None:return
    process.terminate()
    try:process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:process.kill();process.wait()
def shutdown(*_):
    for process in reversed(processes):stop(process,5)
    # Stop replication last so the API's final writes reach the backup.
    stop(backup,15)
    if _:raise SystemExit(0)
signal.signal(signal.SIGTERM,shutdown)
signal.signal(signal.SIGINT,shutdown)
try:
    db_path.parent.mkdir(parents=True,exist_ok=True)
    litestream_config=backup_config()
    if litestream_config:
        # A failed restore must stop the boot: starting empty would hide the saved data.
        if subprocess.run(['litestream','restore','-config',str(litestream_config),'-if-db-not-exists','-if-replica-exists',str(db_path)],env=env).returncode:
            raise SystemExit('Backup restore failed. Check LITESTREAM_ACCESS_KEY_ID / LITESTREAM_SECRET_ACCESS_KEY (an R2 token with '
                             'Object Read & Write on the bucket), PLUGGO_BACKUP_URL (s3://<bucket>/pluggo) and PLUGGO_BACKUP_ENDPOINT.')
        env['PLUGGO_BACKUP']='litestream'
        print(f'Backups on: {db_path} is restored from and replicated to {os.environ["PLUGGO_BACKUP_URL"].strip()}',flush=True)
    else:print('Backups off: set PLUGGO_BACKUP_URL to keep data across restarts',flush=True)
    processes.append(subprocess.Popen([str(root/'ev_web_api')],env=env))
    for _ in range(100):
        if processes[0].poll() is not None:raise RuntimeError('Customer API failed to start')
        try:
            with urllib.request.urlopen('http://127.0.0.1:18080/api/ready',timeout=.5):break
        except OSError:time.sleep(.1)
    else:raise RuntimeError('Customer database/API not ready')
    if litestream_config:backup=subprocess.Popen(['litestream','replicate','-config',str(litestream_config)],env=env)
    processes.append(subprocess.Popen([sys.executable,str(root/'customer_simulator.py')],env=env))
    if real_connectors:
        processes.append(subprocess.Popen([sys.executable,str(root/'gateway.py')],env=env))
        print(f'OCPP 1.6J gateway on: chargers connect to wss://<host>/ocpp/<charge-point-id> ({", ".join(real_connectors)})',flush=True)
    subprocess.run(['nginx','-t','-c','/tmp/pluggo-nginx.conf'],check=True)
    processes.append(subprocess.Popen(['nginx','-c','/tmp/pluggo-nginx.conf','-g','daemon off;']))
    while all(process.poll() is None for process in processes) and (backup is None or backup.poll() is None):time.sleep(.5)
    raise RuntimeError('One of the application services exited')
finally:shutdown()
