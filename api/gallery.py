from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "engine"))
import render as render_engine   # noqa: E402
from _lib import pg, reply, error, guard  # noqa: E402

# Bind the one function we need AT IMPORT TIME, deliberately.
#
# `api/render.py` is a sibling module also called `render`, so `import render`
# has two candidates and which one wins depends on whether vercel.json actually
# bundled `engine/render.py` into THIS function. If it did not, the import
# silently succeeds against the wrong module and every count below comes out
# zero -- a gallery that looks fine and is wrong, which is the exact failure the
# repo's own rule about failing loudly exists to prevent. Resolving the
# attribute here turns that into a 500 on the first request instead.
parse_text = render_engine.parse_text

TIER_KEYS = ("T1", "T1.5", "T2", "T2.5", "T3", "T4")


def map_stats(markdown):
    """Derived gallery numbers. Never returns any of the markdown itself."""
    counts = {k: 0 for k in TIER_KEYS}
    counts["untiered"] = 0
    total = 0
    open_count = 0
    # parse_text returns a FLAT list of node dicts (engine/render.py:91).
    for n in parse_text(markdown or ""):
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
    # `id` and `copied_from` are selected to be USED, never to be published: the
    # row id authorises a save (phase 2, B1). Every response item below is built
    # field by field from a literal dict, so neither can leak by accident.
    # limit=200 implements decisions.md's gallery ceiling, which phase 2 (G7)
    # found had never been written down in code. It also caps the cost of the
    # per-row parse below. Past 200 rows the counts need caching or
    # denormalising, which is a schema change and a separate decision.
    status, rows, _ = pg("GET", "/users?select=id,name,updated_at,markdown,copied_from"
                                 "&is_public=is.true&order=updated_at.desc&limit=200")
    if status != 200:
        return error(self, 500, "server_error", "Could not load the gallery.")
    rows = rows or []
    # Phase 3 task 8: "Started from Sarah's map", resolved without a second round
    # trip or a PostgREST self-join. api/map.py clears copied_from on the first
    # divergent save, so this only ever describes an unedited copy. A source that
    # has since been unlisted is not in `rows` and simply goes unnamed.
    names_by_id = {r["id"]: r["name"] for r in rows}
    out = []
    for row in rows:
        item = {"name": row["name"], "updated_at": row["updated_at"]}
        started_from = names_by_id.get(row.get("copied_from"))
        if started_from:
            item["started_from"] = started_from
        try:
            item.update(map_stats(row.get("markdown")))
        except Exception:
            # One malformed map must not 500 the whole gallery for everyone else.
            # Scoped to a parse failure on one row on purpose: anything that would
            # break every row (a missing bundle, the wrong `render` module) has
            # already failed loudly at import, above.
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
