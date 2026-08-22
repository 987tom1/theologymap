"""THROWAWAY — phase 1c post-merge DB verification.

Branch previews have no Supabase credentials (docs/hosting/run-order.md), so
api/map.py's concurrency/empty-save/vanished-account behaviour can only be
proven against production. Mirrors phase 1b's identical smoketest.py: the only
thing this route can do is delete rows whose name carries the double-underscore
test-data prefix this file's own verification uses, so a stray hit while it is
briefly live cannot touch a real user's row. Added, used, removed — see
docs/hosting/phase-1c-outcome.md.
"""

from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import pg, reply, error, guard  # noqa: E402


class handler(BaseHTTPRequestHandler):
    @guard
    def do_DELETE(self):
        status, rows, _ = pg("DELETE", "/users?name=like.__*&select=id,name",
                              headers={"Prefer": "return=representation"})
        reply(self, 200, {"deleted": len(rows) if isinstance(rows, list) else 0})

    def do_GET(self):
        error(self, 405, "method_not_allowed", "Use DELETE.")

    do_POST = do_GET
    do_PUT = do_GET
    do_PATCH = do_GET
