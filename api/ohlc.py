"""Vercel Python serverless function: POST /api/ohlc.

Body: {"symbols": ["360ONE", ...]}
Resp: {"data": {SYMBOL: {"months": [{date,open,high,low,close}]}}, "errors": {}, "meta": {}}

OHLC comes from the official NSE Bhavcopy (current + previous month aggregated). RSI is NOT
produced here — it is taken from the user's uploaded MRSI_Digger file in the frontend.
"""

import json
from http.server import BaseHTTPRequestHandler

from bhavcopy import fetch_monthly_ohlc


class handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # CORS preflight
        self._send(204, {})

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")
            symbols = body.get("symbols", [])
            if not isinstance(symbols, list):
                self._send(400, {"error": "symbols must be a list"})
                return
            result = fetch_monthly_ohlc(symbols)
            self._send(200, result)
        except Exception as exc:
            self._send(500, {"error": str(exc)})
