"""Temporary authenticated gateway exposing only the operator demonstration API.
Keep this running for a tunnel-backed demo; no customer/private API is forwarded.
"""
import hmac
import http.client
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
KEY=(ROOT/'secrets/operator_gateway_key.txt').read_text().strip()
ALLOWED={
 '/api/health':{'GET'},'/api/station':{'GET'},'/api/queue':{'GET','POST'},
 '/api/plan':{'POST'},'/api/budget':{'POST'},'/api/queue/serve':{'POST'},
 '/api/solar/simulate':{'POST'},'/api/emergency':{'POST'},
 **{'/api/chargers/'+i:{'GET'} for i in ['A1','A2','B1','B2']},
}
class Gateway(BaseHTTPRequestHandler):
 def handle_request(self):
  if not hmac.compare_digest(self.headers.get('X-Pluggo-Gateway-Key',''),KEY):self.send_error(401,'Invalid gateway credential');return
  if self.path not in ALLOWED:self.send_error(404);return
  if self.command not in ALLOWED[self.path]:self.send_error(405);return
  try:length=int(self.headers.get('Content-Length','0'))
  except ValueError:self.send_error(400);return
  if not 0<=length<=16384:self.send_error(413);return
  connection=http.client.HTTPConnection('127.0.0.1',18080,timeout=10)
  try:
   body=self.rfile.read(length) if length else None
   connection.request(self.command,self.path,body=body,headers={'Content-Type':'application/json'})
   response=connection.getresponse();content=response.read()
   self.send_response(response.status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content)
  except OSError:self.send_error(503,'Local C++ engine unavailable')
  finally:connection.close()
 def do_GET(self):self.handle_request()
 def do_POST(self):self.handle_request()
print('Operator demo gateway: http://127.0.0.1:18085 (authenticated allowlist)',flush=True)
ThreadingHTTPServer(('127.0.0.1',18085),Gateway).serve_forever()
