from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import pg, read_json, reply, error, guard, unknown_user, require_admin  # noqa: E402

MAX_MARKDOWN_BYTES = 524288  # 512 KB, matches the users_markdown_len check constraint.

# PostgREST answers a write with 204 No Content unless the caller asks for
# `Prefer: return=representation`. None of the writes below need the row back,
# so every success check here is `not in (200, 204)`, matching _delete_account's.
# Checking `!= 200` would have turned every successful admin write into a 500.


def _lookup(target_id):
    """Return the row (id only) for target_id, or None if it doesn't exist."""
    status, rows, _ = pg("GET", f"/users?id=eq.{target_id}&select=id")
    if status != 200 or not rows:
        return None
    return rows[0]


def _list_users(self, body, admin_row):
    status, rows, _ = pg(
        "GET", "/users?select=id,name,is_admin,is_public,updated_at,markdown"
    )
    if status != 200:
        return error(self, 500, "server_error", "Could not list users.")
    users = [
        {
            "id": row["id"],
            "name": row["name"],
            "is_admin": row["is_admin"],
            "is_public": row["is_public"],
            "updated_at": row["updated_at"],
            "markdown_length": len(row["markdown"]),
        }
        for row in rows
    ]
    return reply(self, 200, users)


def _delete_account(self, body, admin_row):
    target_id = body.get("target_id")
    if not target_id:
        return error(self, 400, "bad_request", "Missing target_id.")
    if not _lookup(target_id):
        return unknown_user(self)
    if target_id == admin_row["id"]:
        return error(self, 400, "bad_request", "Cannot delete your own account.")

    status, _, _ = pg("DELETE", f"/users?id=eq.{target_id}")
    if status not in (200, 204):
        return error(self, 500, "server_error", "Could not delete that account.")
    return reply(self, 200, {"ok": True})


def _reset_pin(self, body, admin_row):
    target_id = body.get("target_id")
    if not target_id:
        return error(self, 400, "bad_request", "Missing target_id.")
    new_pin = body.get("new_pin")
    if not isinstance(new_pin, str) or not (4 <= len(new_pin) <= 12):
        return error(self, 400, "bad_request", "new_pin must be 4-12 characters.")
    if not _lookup(target_id):
        return unknown_user(self)

    status, _, _ = pg("PATCH", f"/users?id=eq.{target_id}", {"pin": new_pin})
    if status not in (200, 204):
        return error(self, 500, "server_error", "Could not reset that PIN.")
    return reply(self, 200, {"ok": True})


def _set_visibility(self, body, admin_row):
    target_id = body.get("target_id")
    if not target_id:
        return error(self, 400, "bad_request", "Missing target_id.")
    is_public = body.get("is_public")
    if not isinstance(is_public, bool):
        return error(self, 400, "bad_request", "is_public must be a boolean.")
    if not _lookup(target_id):
        return unknown_user(self)

    status, _, _ = pg("PATCH", f"/users?id=eq.{target_id}", {"is_public": is_public})
    if status not in (200, 204):
        return error(self, 500, "server_error", "Could not update visibility.")
    return reply(self, 200, {"ok": True})


def _save_map(self, body, admin_row):
    target_id = body.get("target_id")
    if not target_id:
        return error(self, 400, "bad_request", "Missing target_id.")

    markdown = body.get("markdown")
    if not isinstance(markdown, str):
        return error(self, 400, "bad_request", "Missing markdown.")

    # Look the row up first: need its current markdown for the empty-save
    # guard, and this is also how we tell "no such user" apart from anything
    # else before we ever touch the PATCH.
    status, rows, _ = pg("GET", f"/users?id=eq.{target_id}&select=markdown")
    if status != 200 or not rows:
        return unknown_user(self)
    current_markdown = rows[0]["markdown"]

    if len(markdown.encode("utf-8")) > MAX_MARKDOWN_BYTES:
        return error(self, 413, "too_large", "That map is too large to save (512 KB limit).")

    force = body.get("force") is True
    if not markdown.strip() and current_markdown.strip() and not force:
        return error(self, 409, "would_erase",
                     "This would erase the whole map. Confirm to continue.")

    status, _, _ = pg("PATCH", f"/users?id=eq.{target_id}", {"markdown": markdown})
    if status not in (200, 204):
        return error(self, 500, "server_error", "Could not save the map.")
    return reply(self, 200, {"ok": True})


ACTIONS = {
    "list_users": _list_users,
    "delete_account": _delete_account,
    "reset_pin": _reset_pin,
    "set_visibility": _set_visibility,
    "save_map": _save_map,
}


class handler(BaseHTTPRequestHandler):
    @guard
    def do_POST(self):
        body = read_json(self)
        admin_row = require_admin(body.get("name"), body.get("pin"))

        action = body.get("action")
        fn = ACTIONS.get(action)
        if fn is None:
            return error(self, 400, "bad_request", "Unknown action.")
        return fn(self, body, admin_row)

    def do_GET(self):
        error(self, 405, "method_not_allowed", "Use POST.")

    do_PUT = do_GET
    do_DELETE = do_GET
    do_PATCH = do_GET
