from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import datetime
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "engine"))
from _lib import (pg, q, read_json, reply, error, guard, unknown_user,  # noqa: E402
                  row_by_name, snapshot_map)
import render as render_engine  # noqa: E402

# Bind at import time, deliberately — see api/gallery.py's identical comment.
# `api/render.py` is a sibling module also called `render`; if vercel.json's
# includeFiles for THIS function ever stops bundling engine/render.py, this
# import silently succeeds against the wrong module and node_count comes back
# wrong for everyone instead of failing loudly on the first request.
parse_text = render_engine.parse_text

MAX_MARKDOWN_BYTES = 524288  # 512 KB, matches the users_markdown_len check constraint.


def _get_map(self):
    qs = parse_qs(urlparse(self.path).query)
    user_id = (qs.get("user_id") or [None])[0]
    name = (qs.get("name") or [None])[0]

    # Phase 6, design 4.7: compare needs to read someone else's map. The plan
    # said to guard the `user_id` path on is_public, but phase 2 (B1) already
    # moved the public read key OFF the id — the id authorises a save, the
    # gallery no longer publishes it, and the only caller that still holds one
    # is the owner (wizard, editor) or the admin console. Guarding `user_id`
    # would lock an owner out of their own unlisted map; guarding the PUBLIC
    # key is the same rule applied where the exposure actually is. So `name`
    # is the compare-target path and it returns markdown only for a public
    # map. `id` is never in the reply, exactly as /api/gallery is careful not
    # to publish one. This mirrors api/render.py's `name` branch.
    if name and not user_id:
        row = row_by_name(name, "markdown,updated_at,is_public,name")
        if row is None or not row["is_public"]:
            return unknown_user(self)
        return reply(self, 200, {
            "markdown": row["markdown"],
            "updated_at": row["updated_at"],
            "is_public": row["is_public"],
            "name": row["name"],
        })

    if not user_id:
        return error(self, 400, "bad_request", "Missing user_id, or a name.")

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
    #
    # The result is reported back because snapshot_map swallows every failure,
    # which would otherwise leave the migration unverifiable from outside: no
    # route reads map_versions, so a missing table looks exactly like a healthy
    # throttled save. False is the ordinary answer (nothing stored yet, or
    # within the hour); it is only diagnostic against a save that should have
    # snapshotted. Not a credential and not a new route.
    snapshotted = snapshot_map(user_id, force)

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
        return reply(self, 200, {"updated_at": rows[0]["updated_at"],
                                 "snapshotted": snapshotted})
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


def _versions(self, body):
    """{action: "versions", user_id} -> the caller's own version list, newest first.

    Never returns markdown — twenty rows of up to 512 KB is a multi-megabyte
    reply for a list nobody reads in full. The full markdown is still fetched
    from PostgREST server-side, because node_count needs it; it just never
    leaves this function.
    """
    user_id = body.get("user_id")
    if not user_id:
        return error(self, 400, "bad_request", "Missing user_id.")

    # Look the row up first, as every route here does, so "no such user" is
    # told apart from "no versions yet" before anything else happens.
    status, rows, _ = pg("GET", f"/users?id=eq.{q(user_id)}&select=id")
    if status != 200 or not rows:
        return unknown_user(self)

    status, versions, _ = pg(
        "GET",
        f"/map_versions?user_id=eq.{q(user_id)}&select=id,saved_at,markdown"
        "&order=saved_at.desc",
    )
    if status != 200:
        return error(self, 500, "server_error", "Could not load versions.")

    out = []
    for v in versions or []:
        markdown = v.get("markdown") or ""
        item = {"id": v["id"], "saved_at": v["saved_at"],
                "bytes": len(markdown.encode("utf-8"))}
        try:
            item["node_count"] = len(parse_text(markdown))
        except Exception:
            pass  # a nicety, not the point — ship the row without it
        out.append(item)
    return reply(self, 200, out)


def _restore(self, body):
    """{action: "restore", user_id, version_id, expected_updated_at} ->
    replace the caller's map with that version.

    Same optimistic-concurrency PATCH as an ordinary save, and the version
    must belong to the caller — filtered on user_id AND id, never id alone.
    """
    user_id = body.get("user_id")
    if not user_id:
        return error(self, 400, "bad_request", "Missing user_id.")

    version_id = body.get("version_id")
    if not version_id:
        return error(self, 400, "bad_request", "Missing version_id.")

    expected_updated_at = body.get("expected_updated_at")
    if not isinstance(expected_updated_at, str) or not expected_updated_at:
        return error(self, 400, "bad_request", "Missing expected_updated_at.")

    status, rows, _ = pg("GET", f"/users?id=eq.{q(user_id)}&select=markdown,copied_from")
    if status != 200 or not rows:
        return unknown_user(self)
    current_markdown = rows[0]["markdown"]

    # A version id is not a credential — this is the check that keeps it from
    # becoming one.
    status, versions, _ = pg(
        "GET",
        f"/map_versions?id=eq.{q(version_id)}&user_id=eq.{q(user_id)}&select=markdown",
    )
    if status != 200 or not versions:
        return error(self, 404, "unknown_version", "No such version.")
    restored_markdown = versions[0]["markdown"]

    # Restoring is exactly the "replace a whole map in one action" case
    # map_versions exists for, so the person must be able to undo the undo.
    # force=True: this must be preserved even if it happened within the hour.
    snapshotted = snapshot_map(user_id, True)

    patch = {"markdown": restored_markdown}
    if rows[0].get("copied_from") and restored_markdown != current_markdown:
        patch["copied_from"] = None
        patch["copied_at"] = None

    status, patched, _ = pg(
        "PATCH",
        f"/users?id=eq.{q(user_id)}&updated_at=eq.{q(expected_updated_at)}"
        "&select=updated_at",
        patch,
        headers={"Prefer": "return=representation"},
    )
    if status == 200 and patched:
        return reply(self, 200, {"updated_at": patched[0]["updated_at"],
                                 "snapshotted": snapshotted})
    if status == 200 and not patched:
        return error(self, 409, "conflict", "This map was changed somewhere else.")
    return error(self, 500, "server_error", "Could not restore that version.")


def _set_visibility(self, body):
    """{action: "set_visibility", user_id, is_public} -> the owner listing or
    unlisting their own map.

    The same control admin.py has, for the owner. `user_id` is the credential
    here exactly as it is for save and restore (phase 2, B1) - no new trust is
    introduced. Unlisting is not privacy: it removes the map from the gallery
    and stops the name-keyed render, nothing more.
    """
    user_id = body.get("user_id")
    if not user_id:
        return error(self, 400, "bad_request", "Missing user_id.")
    is_public = body.get("is_public")
    if not isinstance(is_public, bool):
        return error(self, 400, "bad_request", "Missing is_public.")

    # Look the row up first, as every route here does.
    status, rows, _ = pg("GET", f"/users?id=eq.{q(user_id)}&select=id")
    if status != 200 or not rows:
        return unknown_user(self)

    status, patched, _ = pg(
        "PATCH",
        f"/users?id=eq.{q(user_id)}&select=is_public",
        {"is_public": is_public},
        headers={"Prefer": "return=representation"},
    )
    if status == 200 and patched:
        return reply(self, 200, {"is_public": patched[0]["is_public"]})
    return error(self, 500, "server_error", "Could not change that setting.")


class handler(BaseHTTPRequestHandler):
    @guard
    def do_GET(self):
        return _get_map(self)

    @guard
    def do_POST(self):
        body = read_json(self)
        action = body.get("action")
        if action == "copy_from":
            return _copy_from(self, body)
        if action == "versions":
            return _versions(self, body)
        if action == "restore":
            return _restore(self, body)
        if action == "set_visibility":
            return _set_visibility(self, body)
        return _save_map(self, body)

    def do_PUT(self):
        error(self, 405, "method_not_allowed", "Use GET or POST.")

    do_DELETE = do_PUT
    do_PATCH = do_PUT
