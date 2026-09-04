from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import (pg, q, read_json, reply, error, guard, unknown_user,  # noqa: E402
                  require_admin, snapshot_map)

# PostgREST answers a write with 204 No Content unless the caller asks for
# `Prefer: return=representation`. None of the writes below need the row back,
# so every success check here is `not in (200, 204)`, matching _delete_account's.
# Checking `!= 200` would have turned every successful admin write into a 500.


def _lookup(target_id):
    """Return the row (id only) for target_id, or None if it doesn't exist."""
    status, rows, _ = pg("GET", f"/users?id=eq.{q(target_id)}&select=id")
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
    target = _lookup(target_id)
    if not target:
        return unknown_user(self)
    # Compare the row's own id, not the caller's string: Postgres accepts a uuid
    # in any case, so an uppercase target_id would slip past a string compare and
    # delete the admin's own row — unrecoverable, since no route sets is_admin.
    if target["id"] == admin_row["id"]:
        return error(self, 400, "bad_request", "Cannot delete your own account.")

    status, _, _ = pg("DELETE", f"/users?id=eq.{q(target_id)}")
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

    status, _, _ = pg("PATCH", f"/users?id=eq.{q(target_id)}", {"pin": new_pin})
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

    status, _, _ = pg("PATCH", f"/users?id=eq.{q(target_id)}", {"is_public": is_public})
    if status not in (200, 204):
        return error(self, 500, "server_error", "Could not update visibility.")
    return reply(self, 200, {"ok": True})


def _versions(self, body, admin_row):
    """{action: "versions", target_id} -> that user's version list, newest first.

    Same shape as api/map.py's own-account version, minus node_count: this is
    the smaller admin half of the phase and a parse import here would need its
    own vercel.json includeFiles entry for one nicety already marked optional
    (see phase-8-brief.md §1). Never returns markdown.
    """
    target_id = body.get("target_id")
    if not target_id:
        return error(self, 400, "bad_request", "Missing target_id.")
    if not _lookup(target_id):
        return unknown_user(self)

    # E3: this endpoint only ever computed integers from the text, so
    # `markdown` was pulling the full body of twenty versions per user for
    # nothing. Bytes-length needs its own count column to fix properly (a
    # migration this phase does not do), so it's dropped below instead.
    status, versions, _ = pg(
        "GET",
        f"/map_versions?user_id=eq.{q(target_id)}&select=id,saved_at"
        "&order=saved_at.desc",
    )
    if status != 200:
        return error(self, 500, "server_error", "Could not load versions.")

    out = [{"id": v["id"], "saved_at": v["saved_at"]} for v in (versions or [])]
    return reply(self, 200, out)


def _restore(self, body, admin_row):
    """{action: "restore", target_id, version_id} -> replace that user's map
    with that version. The locked "edit/restore any map" admin power.

    E2: this now reads updated_at first and PATCHes with it as the filter,
    exactly as api/map.py's own restore does. Without it, an admin restore
    landing between a user's autosave reads was silently undoable seconds
    later through the editor's own conflict-dialog force path — recoverable
    (a force save always snapshots) but silent for both sides. Now a save
    that lands in between gets a 409 conflict here instead.
    """
    target_id = body.get("target_id")
    if not target_id:
        return error(self, 400, "bad_request", "Missing target_id.")
    version_id = body.get("version_id")
    if not version_id:
        return error(self, 400, "bad_request", "Missing version_id.")

    status, rows, _ = pg("GET", f"/users?id=eq.{q(target_id)}&select=updated_at")
    if status != 200 or not rows:
        return unknown_user(self)
    expected_updated_at = rows[0]["updated_at"]

    # The version must belong to the target — filtered on user_id AND id.
    status, versions, _ = pg(
        "GET",
        f"/map_versions?id=eq.{q(version_id)}&user_id=eq.{q(target_id)}&select=markdown",
    )
    if status != 200 or not versions:
        return error(self, 404, "unknown_version", "No such version.")
    restored_markdown = versions[0]["markdown"]

    # Snapshot the current map first, force=True: the person must be able to
    # undo the undo, same as the self-service restore.
    snapshot_map(target_id, True)

    status, patched, _ = pg(
        "PATCH",
        f"/users?id=eq.{q(target_id)}&updated_at=eq.{q(expected_updated_at)}"
        "&select=updated_at",
        {"markdown": restored_markdown},
        headers={"Prefer": "return=representation"},
    )
    if status == 200 and patched:
        return reply(self, 200, {"ok": True})
    if status == 200 and not patched:
        return error(self, 409, "conflict", "This map was changed somewhere else.")
    return error(self, 500, "server_error", "Could not restore that version.")


ACTIONS = {
    "list_users": _list_users,
    "delete_account": _delete_account,
    "reset_pin": _reset_pin,
    "set_visibility": _set_visibility,
    "versions": _versions,
    "restore": _restore,
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
