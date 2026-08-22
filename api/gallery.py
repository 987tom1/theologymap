from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import pg, reply, error, guard  # noqa: E402


def _list_gallery(self):
    status, rows, _ = pg("GET", "/users?select=id,name,updated_at"
                                 "&is_public=is.true&order=updated_at.desc")
    if status != 200:
        return error(self, 500, "server_error", "Could not load the gallery.")
    return reply(self, 200, rows or [])


class handler(BaseHTTPRequestHandler):
    @guard
    def do_GET(self):
        return _list_gallery(self)

    def do_POST(self):
        error(self, 405, "method_not_allowed", "Use GET.")

    do_PUT = do_POST
    do_DELETE = do_POST
    do_PATCH = do_POST
