"""Serve the static RISB site locally, including JavaScript modules on Windows."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
assert SimpleHTTPRequestHandler.extensions_map['.mjs'] == 'text/javascript'

class LocalHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/.netlify/functions/get-secret-message':
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 1024:
                self.send_error(400)
                return
            payload = json.loads(self.rfile.read(length))
            valid = isinstance(payload, dict) and payload.get('input') == 'risb-local'
        except (ValueError, UnicodeError):
            self.send_error(400)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'valid': valid}).encode())

if __name__ == '__main__':
    handler = partial(LocalHandler, directory=str(ROOT))
    print('RISB local: http://127.0.0.1:8767 - clave de prueba: risb-local', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8767), handler).serve_forever()
