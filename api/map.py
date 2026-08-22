from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import quote, urlparse, parse_qs
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import pg, read_json, reply, error, guard, unknown_user  # noqa: E402

MAX_MARKDOWN_BYTES = 524288  # 512 KB, matches the users_markdown_len check constraint.


def _get_map(self):
    qs = parse_qs(urlparse(self.path).query)
    user_id = (qs.get("user_id") or [None])[0]
    if not user_id:
        return error(self, 400, "bad_request", "Missing user_id.")

    status, rows, _ = pg("GET", f"/users?id=eq.{user_id}"
                                 "&select=markdown,updated_at,is_public,name")
    if status != 200 or not rows:
        return unknown_user(self)
    row = rows[0]
    return reply(self, 200, {
        "markdown": row["markdown"],
        "updated_at": row["updated_at"],
        "is_public": row["is_public"],
        "name": row["name"],
    })


def _save_map(self, body):
    user_id = body.get("user_id")
    if not user_id:
        return error(self, 400, "bad_request", "Missing user_id.")

    markdown = body.get("markdown")
    if not isinstance(markdown, str):
        return error(self, 400, "bad_request", "Missing markdown.")

    expected_updated_at = body.get("expected_updated_at")
    if not isinstance(expected_updated_at, str) or not expected_updated_at:
        return error(self, 400, "bad_request", "Missing expected_updated_at.")

    # Look the row up first: need its current markdown for the empty-save
    # guard, and this is also how we tell "no such user" apart from "stale
    # token" before we ever touch the PATCH.
    status, rows, _ = pg("GET", f"/users?id=eq.{user_id}&select=markdown")
    if status != 200 or not rows:
        return unknown_user(self)
    current_markdown = rows[0]["markdown"]

    if len(markdown.encode("utf-8")) > MAX_MARKDOWN_BYTES:
        return error(self, 413, "too_large", "That map is too large to save (512 KB limit).")

    force = body.get("force") is True
    if not markdown.strip() and current_markdown.strip() and not force:
        return error(self, 409, "would_erase",
                     "This would erase the whole map. Confirm to continue.")

    status, rows, _ = pg(
        "PATCH",
        f"/users?id=eq.{user_id}&updated_at=eq.{quote(expected_updated_at)}"
        "&select=updated_at",
        {"markdown": markdown},
        headers={"Prefer": "return=representation"},
    )
    if status == 200 and rows:
        return reply(self, 200, {"updated_at": rows[0]["updated_at"]})
    if status == 200 and not rows:
        return error(self, 409, "conflict", "This map was changed somewhere else.")
    return error(self, 500, "server_error", "Could not save the map.")


class handler(BaseHTTPRequestHandler):
    @guard
    def do_GET(self):
        return _get_map(self)

    @guard
    def do_POST(self):
        body = read_json(self)
        return _save_map(self, body)

    def do_PUT(self):
        error(self, 405, "method_not_allowed", "Use GET or POST.")

    do_DELETE = do_PUT
    do_PATCH = do_PUT
