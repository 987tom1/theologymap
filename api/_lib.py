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


def verify_credentials(name, pin):
    """Return the user row for a matching name+pin, else None.

    Plaintext comparison, per the brief — security is out of scope. The point
    of doing it here rather than in the client is that the pin column never
    goes on the wire. Name matching is case-insensitive, matching the
    users_name_lower_key unique index.
    """
    status, rows, _ = pg(
        "GET",
        "/users?select=id,name,pin,is_admin&name=ilike." + quote(name),
    )
    if status != 200 or not rows:
        return None
    row = rows[0]
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
