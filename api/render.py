from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
# Vercel puts /var/task on sys.path but not /var/task/api, so a sibling module
# is not importable without this. Verified on the 1a preview deployment.
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "engine"))
import render as render_engine          # noqa: E402
from _lib import pg, read_json, reply_html, error, guard, unknown_user  # noqa: E402

_VERSES = None


def verses():
    global _VERSES
    if _VERSES is None:
        _VERSES = render_engine.parse_verses_text(
            (ROOT / "documentation" / "verses.md").read_text(encoding="utf-8")
        )
    return _VERSES


class handler(BaseHTTPRequestHandler):
    @guard
    def do_POST(self):
        body = read_json(self)
        markdown = body.get("markdown")
        if markdown is None:
            user_id = body.get("user_id")
            if not user_id:
                return error(self, 400, "bad_request",
                             "Send either markdown or user_id.")
            status, rows, _ = pg("GET", f"/users?id=eq.{user_id}"
                                        "&select=markdown,is_public,name")
            if status != 200 or not rows:
                return unknown_user(self)
            if not rows[0]["is_public"]:
                return unknown_user(self)
            markdown = rows[0]["markdown"]
        reply_html(self, 200, render_engine.render_markdown(markdown, verses()))
