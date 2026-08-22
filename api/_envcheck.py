"""THROWAWAY — 1a env-var discovery only. Names, never values. Delete before merge."""
from http.server import BaseHTTPRequestHandler
import json
import os
import re


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        names = sorted(n for n in os.environ
                       if re.search(r"SUPABASE|POSTGRES|DATABASE", n))
        payload = json.dumps({"names": names}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
