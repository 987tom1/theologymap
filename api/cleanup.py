"""THROWAWAY. Deletes only the __-prefixed test rows this phase's live checks
created, then gets removed in the next commit — same add/use/remove lifecycle
1b and 1c used, and for the same reason: branch previews have no database, so a
one-off production job needs a route, and there is no admin PIN available.

It takes no caller-supplied id and can only ever match `name like '\\_\\_%'`, so
a stray hit while it is live cannot touch a real account.
"""

from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import pg, reply, error, guard  # noqa: E402


class handler(BaseHTTPRequestHandler):
    @guard
    def do_POST(self):
        status, rows, _ = pg(
            # select=name so return=representation cannot hand back a pin.
            "DELETE", "/users?name=like." + "%5C_%5C_%25" + "&select=name",
            headers={"Prefer": "return=representation"},
        )
        if status not in (200, 204):
            return error(self, 500, "server_error", f"PostgREST said {status}.")
        return reply(self, 200, {"deleted": [r["name"] for r in (rows or [])]})

    def do_GET(self):
        error(self, 405, "method_not_allowed", "Use POST.")
