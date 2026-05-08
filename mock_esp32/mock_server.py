#!/usr/bin/env python3
"""
Local mock server that simulates the ESP32 locker API.

Run:
  python3 mock_esp32/mock_server.py

It listens on port 5001 by default and exposes:
  POST /api/locker/open  -> {status: ok, command: open}
  POST /api/locker/close -> {status: ok, command: close}
  GET  /api/locker/status -> {open: true|false}

CORS is enabled for ease of testing from http://localhost:3000.
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import urllib

HOST = '0.0.0.0'
PORT = 5001

locker_open = False

class Handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        global locker_open
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == '/api/locker/status':
            self._set_headers(200)
            self.wfile.write(json.dumps({'open': locker_open}).encode('utf-8'))
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({'error': 'not found'}).encode('utf-8'))

    def do_POST(self):
        global locker_open
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == '/api/locker/open':
            locker_open = True
            print('Mock: open command received')
            self._set_headers(200)
            self.wfile.write(json.dumps({'status': 'ok', 'command': 'open'}).encode('utf-8'))
            return

        if parsed_path.path == '/api/locker/close':
            locker_open = False
            print('Mock: close command received')
            self._set_headers(200)
            self.wfile.write(json.dumps({'status': 'ok', 'command': 'close'}).encode('utf-8'))
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({'error': 'not found'}).encode('utf-8'))


if __name__ == '__main__':
    server = HTTPServer((HOST, PORT), Handler)
    print(f'Mock ESP32 server listening on http://{HOST}:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Shutting down mock server')
        server.server_close()
