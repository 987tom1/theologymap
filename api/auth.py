from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import read_json, reply, error, guard, pg, verify_credentials  # noqa: E402


def _signup(self, body):
    name = (body.get("name") or "").strip()
    pin = body.get("pin")
    if not name:
        return error(self, 400, "bad_request", "Enter a name.")
    # A1: the database's own length constraint on `name` returns a bare 500
    # server_error with no code the signup form can branch on. Catch it here
    # first so the form can show you a real sentence instead.
    if len(name) > 60:
        return error(self, 400, "name_too_long",
                     "Your name needs to be 60 characters or fewer.")
    if not isinstance(pin, str) or not (4 <= len(pin) <= 12):
        return error(self, 400, "bad_request", "PIN must be 4-12 characters.")

    # A2: select= makes "no PIN in a reply" structural instead of incidental —
    # today's safety is only that the reply below is built field by field.
    status, parsed, _ = pg("POST", "/users?select=id,name,is_admin",
                            {"name": name, "pin": pin},
                            headers={"Prefer": "return=representation"})
    if status == 201 and parsed:
        row = parsed[0]
        return reply(self, 200, {"user_id": row["id"], "name": row["name"],
                                  "is_admin": row["is_admin"]})
    if status == 409 and isinstance(parsed, dict) and parsed.get("code") == "23505":
        return error(self, 409, "name_taken",
                     "That name is already in use — pick another, or sign in.")
    return error(self, 500, "server_error", "Could not create the account.")


def _login(self, body):
    name = body.get("name") or ""
    pin = body.get("pin") or ""
    row = verify_credentials(name, pin)
    if row is None:
        return error(self, 401, "bad_credentials", "Incorrect name or PIN.")
    return reply(self, 200, {"user_id": row["id"], "name": row["name"],
                              "is_admin": row["is_admin"]})


class handler(BaseHTTPRequestHandler):
    @guard
    def do_POST(self):
        body = read_json(self)
        action = body.get("action")
        if action == "signup":
            return _signup(self, body)
        if action == "login":
            return _login(self, body)
        return error(self, 400, "bad_request", "Unknown action.")

    def do_GET(self):
        error(self, 405, "method_not_allowed", "Use POST.")

    do_PUT = do_GET
    do_DELETE = do_GET
    do_PATCH = do_GET
