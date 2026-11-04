"""Serve the app and proxy API calls to C++ without cross-origin cookies.
python3 tools/dev-server.py --port 4173 --api http://127.0.0.1:18080
"""
import argparse
import http.client
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=4173)
parser.add_argument('--bind',default='127.0.0.1')
parser.add_argument('--api',default='http://127.0.0.1:18080')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]/'frontend'
target=urlsplit(args.api)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(root),**kw)
    def proxy(self):
        connection=None
        try:
            length=int(self.headers.get('Content-Length','0'))
            if length>16384: self.send_error(413); return
            body=self.rfile.read(length) if length else None
            headers={k:v for k,v in self.headers.items() if k.lower() not in {'connection','content-length','transfer-encoding'}}
            connection=http.client.HTTPConnection(target.hostname,target.port or 80,timeout=15)
            connection.request(self.command,self.path,body=body,headers=headers)
            response=connection.getresponse();data=response.read()
            self.send_response(response.status)
            for key,value in response.getheaders():
                if key.lower() not in {'connection','transfer-encoding','content-length'}: self.send_header(key,value)
            self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        except (OSError,ValueError,http.client.HTTPException):
            data=b'{"ok":false,"error":"C++ backend is unavailable. Start ev_web_api."}'
            self.send_response(503);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        finally:
            if connection: connection.close()
    def do_GET(self):
        if self.path.startswith('/api/'): self.proxy()
        else: super().do_GET()
    def do_POST(self): self.proxy() if self.path.startswith('/api/') else self.send_error(405)
    def do_PUT(self): self.proxy() if self.path.startswith('/api/') else self.send_error(405)
    def end_headers(self):
        if not self.path.startswith('/api/'): self.send_header('Cache-Control','no-cache')
        super().end_headers()
print(f'Pluggo frontend: http://{args.bind}:{args.port} (API: {args.api})',flush=True)
ThreadingHTTPServer((args.bind,args.port),Handler).serve_forever()
