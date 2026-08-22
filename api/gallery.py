from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "engine"))
import render as render_engine   # noqa: E402
from _lib import pg, reply, error, guard  # noqa: E402

TIER_KEYS = ("T1", "T1.5", "T2", "T2.5", "T3", "T4")


def map_stats(markdown):
    """Derived gallery numbers. Never returns any of the markdown itself."""
    counts = {k: 0 for k in TIER_KEYS}
    counts["untiered"] = 0
    total = 0
    open_count = 0
    # parse_text returns a FLAT list of node dicts (engine/render.py:91).
    for n in render_engine.parse_text(markdown or ""):
        total += 1
        tier = n.get("tier")
        counts[tier if tier in counts else "untiered"] += 1
        # "Open questions" = #study flagged, OR confidence 'open'. Deduplicated
        # by construction: one increment per node. Phase 6 must use this same
        # definition - see docs/hosting/phase-3-design.md section 7.1.
        if "study" in (n.get("flags") or []) or n.get("confidence") == "open":
            open_count += 1
    return {"node_count": total, "open_count": open_count, "tier_counts": counts}


def _list_gallery(self):
    # NOT `id`. The row id is what authorises a save in api/map.py, so publishing
    # it here let any signed-out visitor overwrite any public map — phase 2, B1.
    # Names are unique (users_name_lower_key) and already public, so the public
    # read path is keyed by name instead: /view?name= and POST /api/render {name}.
    status, rows, _ = pg("GET", "/users?select=name,updated_at,markdown"
                                 "&is_public=is.true&order=updated_at.desc")
    if status != 200:
        return error(self, 500, "server_error", "Could not load the gallery.")
    out = []
    for row in rows or []:
        item = {"name": row["name"], "updated_at": row["updated_at"]}
        try:
            item.update(map_stats(row.get("markdown")))
        except Exception:
            # One malformed map must not 500 the whole gallery for everyone else.
            item.update({"node_count": 0, "open_count": 0,
                         "tier_counts": {k: 0 for k in TIER_KEYS} | {"untiered": 0}})
        out.append(item)
    return reply(self, 200, out)


class handler(BaseHTTPRequestHandler):
    @guard
    def do_GET(self):
        return _list_gallery(self)

    def do_POST(self):
        error(self, 405, "method_not_allowed", "Use GET.")

    do_PUT = do_POST
    do_DELETE = do_POST
    do_PATCH = do_POST
