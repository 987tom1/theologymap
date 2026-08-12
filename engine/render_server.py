"""Local server for the theology-map editor.

Serves the whole project as static files and exposes one endpoint the
editor's "Save & render" button calls: it runs render.py (rebuild the map,
add stubs for any new scripture refs), then fetch_verses.py (fill in text
for those stubs, needs network), then render.py again so the freshly
fetched verse text actually makes it into the HTML.

Usage:  python engine/render_server.py
Then open http://localhost:8420/engine/editor.html
(or just double-click start_editor.bat in the project root, which does both)

Standard library only.
"""

from __future__ import annotations

import http.server
import json
import socketserver
import subprocess
import sys
from pathlib import Path

ENGINE = Path(__file__).parent
ROOT = ENGINE.parent
PORT = 8420


def run(script: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(ENGINE / script)],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/api/render":
            self.send_error(404)
            return

        output_parts = []

        step1 = run("render.py")
        output_parts.append("--- render.py ---\n" + step1.stdout + step1.stderr)
        if step1.returncode != 0:
            self._reply(False, "\n".join(output_parts))
            return

        step2 = run("fetch_verses.py")
        output_parts.append("--- fetch_verses.py ---\n" + step2.stdout + step2.stderr)
        # A network hiccup here shouldn't block the render — the map still
        # renders fine with whatever verse text it already had.

        step3 = run("render.py")
        output_parts.append("--- render.py (re-run with fetched verses) ---\n" + step3.stdout + step3.stderr)

        self._reply(step3.returncode == 0, "\n".join(output_parts))

    def _reply(self, ok: bool, output: str) -> None:
        body = json.dumps({"ok": ok, "output": output}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


def main() -> None:
    with socketserver.TCPServer(("localhost", PORT), Handler) as httpd:
        print(f"Serving {ROOT} at http://localhost:{PORT}/engine/editor.html")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
