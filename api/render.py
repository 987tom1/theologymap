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
from _lib import pg, q, row_by_name, read_json, reply_html, error, guard, unknown_user  # noqa: E402

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
            # `name` is the public read path (the gallery no longer publishes
            # ids — phase 2, B1). `user_id` still works for the owner and the
            # admin console, who legitimately hold one.
            name = body.get("name")
            user_id = body.get("user_id")
            if name:
                row = row_by_name(name, "markdown,is_public,name")
                # X3: is_public gates the NAME branch only. It is the public
                # read key, and name is exactly what a stranger can type into
                # /view?name= — see web/landing.html's "My map" tile.
                if row is None or not row["is_public"]:
                    return unknown_user(self)
            elif user_id:
                status, rows, _ = pg("GET", f"/users?id=eq.{q(user_id)}"
                                            "&select=markdown,is_public,name")
                row = rows[0] if status == 200 and rows else None
                # X3: user_id must NOT be gated on is_public. api/map.py:31-39
                # spells out why at length: the id is a save-authorising secret,
                # not a public key, and it is exactly how an owner reads their
                # own UNLISTED map (the wizard, the editor, "My map" on /). Add
                # this check back and you 404 an owner on their own map again —
                # that was the actual live bug (X3), not a hypothetical one.
                if row is None:
                    return unknown_user(self)
            else:
                return error(self, 400, "bad_request",
                             "Send markdown, or a name, or a user_id.")
            markdown = row["markdown"]
        reply_html(self, 200, render_engine.render_markdown(markdown, verses()))
