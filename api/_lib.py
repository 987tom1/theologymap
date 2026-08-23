"""Everything that knows about Supabase lives here, and nowhere else.

Per docs/hosting/phase-1-design.md §2: the browser never holds a Supabase key
of any kind. Every read and write goes through an api/*.py function using the
service-role key from a Vercel environment variable. Standard library only —
requirements.txt stays empty.
"""

import json
import os
import urllib.error
import urllib.request
from functools import wraps
from http.server import BaseHTTPRequestHandler
from urllib.parse import quote

# design §5. Trimmed to the single confirmed name once discovery succeeds.
URL_CANDIDATES = (
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
)
KEY_CANDIDATES = (
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
)


def _require(candidates, what):
    for name in candidates:
        value = os.environ.get(name)
        if value:
            return name, value
    raise RuntimeError(
        f"Supabase {what} is not configured. Tried, in order: "
        + ", ".join(candidates)
        + ". Set the one Vercel's Supabase integration actually exposes, in "
          "Project Settings -> Environment Variables."
    )


def pg(method, path, body=None, headers=None):
    """One PostgREST call. Returns (status, parsed_json_or_None, headers)."""
    _, base = _require(URL_CANDIDATES, "URL")
    _, key = _require(KEY_CANDIDATES, "service-role key")

    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(
        base.rstrip("/") + "/rest/v1" + path,
        data=data,
        headers=req_headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            status, resp_headers = resp.status, dict(resp.headers)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        status, resp_headers = exc.code, dict(exc.headers)

    try:
        parsed = json.loads(raw) if raw.strip() else None
    except ValueError:
        parsed = None
    return status, parsed, resp_headers


def snapshot_map(user_id, force=False):
    """Preserve the map currently stored for `user_id`, before it is overwritten.

    Locked by docs/hosting/decisions.md (2026-08-23): the wizard is the first
    feature that can replace a whole map in one action, and `force: True` walks
    past all four empty-save guards. Every write path to `users.markdown` calls
    this first.

    The throttle (one per user per hour, always on force) and the retention
    (last 20) live in the SQL function `public.snapshot_map`, not here, so the
    two call sites cannot drift and the whole snapshot is one round trip on a
    path autosave hits constantly.

    Best-effort by design: it never raises and never blocks the save. Losing a
    snapshot is a far smaller failure than losing the ability to save at all --
    which also means this function cannot tell you whether the migration landed.
    Probe the RPC directly for that; see supabase/verify-map-versions-migration.sql.

    Returns True only when a row was actually written.
    """
    try:
        status, parsed, _ = pg("POST", "/rpc/snapshot_map",
                               {"p_user_id": user_id, "p_force": bool(force)})
    except Exception:
        return False
    return status in (200, 204) and parsed is True


def _send(handler, status, content_type, payload):
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def reply(handler, status, obj):
    _send(handler, status, "application/json; charset=utf-8",
          json.dumps(obj).encode("utf-8"))


def reply_html(handler, status, text):
    _send(handler, status, "text/html; charset=utf-8", text.encode("utf-8"))


def error(handler, status, code, message):
    reply(handler, status, {"error": code, "message": message})


def unknown_user(handler):
    """The single canonical 404 for an id with no row. design §8, failure 3."""
    return error(handler, 404, "unknown_user", "No such map.")


def read_json(handler):
    length = int(handler.headers.get("Content-Length") or 0)
    if not length:
        return {}
    try:
        return json.loads(handler.rfile.read(length).decode("utf-8")) or {}
    except ValueError:
        return {}


def q(value):
    """One URL-path value, safe to interpolate into a PostgREST query string.

    Every route builds its paths with f-strings; without this a value from a
    request body could add its own filters. Nothing is exploitable today (the
    only interpolated column is a uuid, so anything odd 400s), but it is one
    column-type change away from being real. phase 2, B6.
    """
    return quote(str(value), safe="")


def _like_literal(text):
    """Escape LIKE/ILIKE metacharacters so a name matches only itself."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _with_name(select):
    """`select` plus the `name` column, which _pick_exact cannot work without.

    Pure, so api/_test_lib.py can hold it to the case that bit us. The exact
    comparison in _pick_exact reads row["name"], so a caller that selects
    everything EXCEPT name gets a KeyError -> @guard -> a 500 with no useful
    message. Phase 3's copy_from did exactly that, and it only showed up on the
    one code path that reached it, because every guard ahead of it returns
    first. Adding the column here means no future caller can get it wrong;
    fixing the one call site would have left the trap armed.
    """
    cols = [c.strip() for c in select.split(",") if c.strip()]
    if "name" not in cols:
        cols.append("name")
    return ",".join(cols)


def row_by_name(name, select):
    """The one row whose name equals `name`, case-insensitively. Else None.

    The single place that turns a name into a row — used by login, by every
    admin action (through verify_credentials) and by the public read path.
    See verify_credentials for why the ilike pattern only narrows and the
    exact comparison below decides. `select` need not include `name`; it is
    added for you, because the comparison below cannot run without it.
    """
    if not isinstance(name, str) or not name:
        return None
    status, rows, _ = pg(
        "GET",
        f"/users?select={_with_name(select)}&name=ilike." + quote(_like_literal(name)),
    )
    if status != 200 or not rows:
        return None
    return _pick_exact(rows, name)


def _pick_exact(rows, name):
    """The row whose name IS `name`, case-insensitively. Else None.

    Pure, so api/_test_lib.py can hold it to the cases that bit us.
    """
    wanted = name.casefold()
    for row in rows:
        if row["name"].casefold() == wanted:
            return row
    return None


def verify_credentials(name, pin):
    """Return the user row for a matching name+pin, else None.

    Plaintext comparison, per the brief — security is out of scope. The point
    of doing it here rather than in the client is that the pin column never
    goes on the wire. Name matching is case-insensitive, matching the
    users_name_lower_key unique index.

    `ilike` is a pattern match, and escaping its metacharacters is a game we
    have now lost twice: 1e escaped `%` and `_`, and phase 2 found that
    PostgREST *additionally* rewrites `*` to `%` before Postgres sees the
    pattern, so `name=__phase2_victim*` logged in as that user. So the pattern
    is no longer trusted to be exact: it narrows the query, and the exact
    case-insensitive name equality below decides. That also removes the
    dependence on `rows[0]` when a pattern matches more than one row.
    """
    if not isinstance(pin, str):
        return None   # a missing field is a rejection, not a 500 (phase 2, B4)
    row = row_by_name(name, "id,name,pin,is_admin")
    if row is None:
        return None
    return row if row["pin"] == pin else None


class Forbidden(Exception):
    pass


def require_admin(name, pin):
    """verify_credentials(), then is_admin. Raises Forbidden otherwise.

    Every admin action calls this. The is_admin flag is NEVER trusted from
    the client — it is re-read from the database on every single call.
    """
    row = verify_credentials(name, pin)
    if row is None or not row.get("is_admin"):
        raise Forbidden()
    return row


def guard(fn):
    """A missing env var must reach the screen by name, not as a blank page."""
    @wraps(fn)
    def wrapper(self, *args, **kwargs):
        try:
            return fn(self, *args, **kwargs)
        except Forbidden:
            return error(self, 403, "forbidden", "Forbidden.")
        except RuntimeError as exc:
            return error(self, 500, "misconfigured", str(exc))
        except Exception:
            return error(self, 500, "server_error",
                         "Something went wrong handling that request.")
    return wrapper


class handler(BaseHTTPRequestHandler):
    """Not a route. Present so the runtime is happy either way."""

    def do_GET(self):
        error(self, 404, "not_found", "Not a route.")

    do_POST = do_GET
