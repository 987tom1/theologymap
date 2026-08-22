"""THROWAWAY. Deployed to production briefly to run the optimistic-concurrency
smoke test that plan Task 1a.3 Step 4 could not run (no database existed yet).
Removed by a follow-up commit right after use — never a permanent route.

Only ever inserts and deletes a row it creates itself in this request; it
never accepts a caller-supplied id, so a stray hit while this is briefly live
cannot touch a real user's row.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import uuid                                                # noqa: E402
from http.server import BaseHTTPRequestHandler              # noqa: E402
from urllib.parse import quote                               # noqa: E402
from _lib import pg, reply, guard                            # noqa: E402


class handler(BaseHTTPRequestHandler):
    @guard
    def do_DELETE(self):
        """Cleanup for 1b's verification-table test rows. Only ever deletes
        rows whose name starts with '__' (the test-data convention used
        throughout this file and phase-1b-outcome.md's verification run) —
        never accepts an id, so it cannot touch a real user's row."""
        status, rows, _ = pg("DELETE", "/users?name=like.__*",
                              headers={"Prefer": "return=representation"})
        reply(self, 200, {"deleted": len(rows) if rows else 0})

    @guard
    def do_POST(self):
        name = f"__smoketest_{uuid.uuid4().hex[:12]}"

        status, rows, _ = pg(
            "POST", "/users", {"name": name, "pin": "0000"},
            headers={"Prefer": "return=representation"},
        )
        if status not in (200, 201) or not rows:
            return reply(self, 500, {"step": "insert", "status": status, "body": rows})
        row = rows[0]
        uid, token = row["id"], row["updated_at"]

        fresh_status, fresh_rows, _ = pg(
            "PATCH",
            f"/users?id=eq.{uid}&updated_at=eq.{quote(token)}",
            {"markdown": "smoketest-fresh"},
            headers={"Prefer": "return=representation"},
        )
        fresh_count = len(fresh_rows) if fresh_rows else 0

        # token is now stale — the trigger bumped updated_at on the write above
        stale_status, stale_rows, _ = pg(
            "PATCH",
            f"/users?id=eq.{uid}&updated_at=eq.{quote(token)}",
            {"markdown": "smoketest-stale"},
            headers={"Prefer": "return=representation"},
        )
        stale_count = len(stale_rows) if stale_rows else 0

        pg("DELETE", f"/users?id=eq.{uid}")

        reply(self, 200, {
            "fresh_status": fresh_status, "fresh_rows": fresh_count,
            "stale_status": stale_status, "stale_rows": stale_count,
            "pass": fresh_count == 1 and stale_count == 0,
        })
