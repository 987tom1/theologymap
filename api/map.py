from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import datetime
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import (pg, q, read_json, reply, error, guard, unknown_user,  # noqa: E402
                  row_by_name, snapshot_map)

MAX_MARKDOWN_BYTES = 524288  # 512 KB, matches the users_markdown_len check constraint.


def _get_map(self):
    qs = parse_qs(urlparse(self.path).query)
    user_id = (qs.get("user_id") or [None])[0]
    if not user_id:
        return error(self, 400, "bad_request", "Missing user_id.")

    status, rows, _ = pg("GET", f"/users?id=eq.{q(user_id)}"
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
    status, rows, _ = pg("GET", f"/users?id=eq.{q(user_id)}&select=markdown,copied_from")
    if status != 200 or not rows:
        return unknown_user(self)
    current_markdown = rows[0]["markdown"]

    if len(markdown.encode("utf-8")) > MAX_MARKDOWN_BYTES:
        return error(self, 413, "too_large", "That map is too large to save (512 KB limit).")

    force = body.get("force") is True
    if not markdown.strip() and current_markdown.strip() and not force:
        return error(self, 409, "would_erase",
                     "This would erase the whole map. Confirm to continue.")

    # Snapshot the stored map before replacing it (decisions.md, 2026-08-23).
    # Best-effort and throttled server-side; it never blocks the save.
    snapshot_map(user_id, force)

    patch = {"markdown": markdown}
    # Task 8: provenance survives exactly until the copier makes it theirs.
    # Cleared in the SAME patch as the divergent save, so there is no window
    # where the gallery says "started from Sarah's map" about edited work.
    if rows[0].get("copied_from") and markdown != current_markdown:
        patch["copied_from"] = None
        patch["copied_at"] = None

    status, rows, _ = pg(
        "PATCH",
        f"/users?id=eq.{q(user_id)}&updated_at=eq.{q(expected_updated_at)}"
        "&select=updated_at",
        patch,
        headers={"Prefer": "return=representation"},
    )
    if status == 200 and rows:
        return reply(self, 200, {"updated_at": rows[0]["updated_at"]})
    if status == 200 and not rows:
        return error(self, 409, "conflict", "This map was changed somewhere else.")
    return error(self, 500, "server_error", "Could not save the map.")


def _copy_from(self, body):
    """Start from someone else's map — phase 3 task 8, design section 5.3.

    Keyed by the source's NAME, not its row id: the id authorises a save
    (phase 2, B1) and /api/gallery deliberately does not publish it, so the
    client has nothing but a name to offer here anyway.
    """
    user_id = body.get("user_id")
    source_name = body.get("source_name")
    if not user_id:
        return error(self, 400, "bad_request", "Missing user_id.")
    if not isinstance(source_name, str) or not source_name.strip():
        return error(self, 400, "bad_request", "Missing source_name.")

    # Look the caller up first, as every route here does, so "no such user" is
    # told apart from an occupied map before anything is written.
    status, rows, _ = pg("GET", f"/users?id=eq.{q(user_id)}&select=id,markdown")
    if status != 200 or not rows:
        return unknown_user(self)
    if rows[0]["markdown"].strip():
        # Copying is a starting point, not an import. The screen that offers it
        # only appears on an empty map; this is the server saying the same thing
        # to anything that calls the route directly.
        return error(self, 409, "not_empty",
                     "You already have a map. Copying would replace it.")

    source = row_by_name(source_name, "id,markdown,is_public")
    if not source:
        return unknown_user(self)
    if not source["is_public"]:
        return error(self, 403, "not_public", "That map is not in the gallery.")
    if source["id"] == rows[0]["id"]:
        return error(self, 400, "bad_request", "That is already your own map.")

    status, patched, _ = pg(
        "PATCH",
        f"/users?id=eq.{q(user_id)}&select=updated_at",
        {"markdown": source["markdown"], "copied_from": source["id"],
         "copied_at": datetime.datetime.now(datetime.timezone.utc).isoformat()},
        headers={"Prefer": "return=representation"},
    )
    if status == 200 and patched:
        return reply(self, 200, {"updated_at": patched[0]["updated_at"]})
    return error(self, 500, "server_error", "Could not copy that map.")


class handler(BaseHTTPRequestHandler):
    @guard
    def do_GET(self):
        return _get_map(self)

    @guard
    def do_POST(self):
        body = read_json(self)
        if body.get("action") == "copy_from":
            return _copy_from(self, body)
        return _save_map(self, body)

    def do_PUT(self):
        error(self, 405, "method_not_allowed", "Use GET or POST.")

    do_DELETE = do_PUT
    do_PATCH = do_PUT
