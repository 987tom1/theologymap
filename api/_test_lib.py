"""Self-check for the pure helpers in _lib.py. Run: py api/_test_lib.py

Deliberately tiny: no framework, no fixtures, no network. Everything else in
_lib.py talks to Supabase and is verified against production, not here.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import _like_literal, _pick_exact, q  # noqa: E402


def test_like_literal():
    # An ordinary name passes through untouched.
    assert _like_literal("Thomas") == "Thomas"
    # The two ILIKE wildcards become literals, so a name matches only itself.
    assert _like_literal("%") == "\\%"
    assert _like_literal("a_b") == "a\\_b"
    # The escape character itself is escaped first, so it cannot escape ours.
    assert _like_literal("c\\d") == "c\\\\d"
    assert _like_literal("\\%") == "\\\\\\%"


def test_pick_exact():
    rows = [{"name": "Sarah"}, {"name": "Thomas"}, {"name": "thom"}]
    # Case-insensitive, matching the users_name_lower_key index.
    assert _pick_exact(rows, "THOMAS")["name"] == "Thomas"
    # A pattern is not a name. PostgREST rewrites `*` to `%` before Postgres sees
    # it, so `ilike` can return rows the caller never named — phase 2, B3. The
    # exact comparison, not the pattern, is what decides.
    assert _pick_exact(rows, "Thom*") is None
    assert _pick_exact(rows, "%") is None
    assert _pick_exact(rows, "_hom_s") is None
    # And it never falls back to rows[0] when nothing matches.
    assert _pick_exact(rows, "nobody") is None


def test_q():
    # A value can never add its own filter to a PostgREST path — phase 2, B6.
    assert q("a&select=pin") == "a%26select%3Dpin"
    assert q("2026-08-22T19:48:05.271808+00:00") == "2026-08-22T19%3A48%3A05.271808%2B00%3A00"


if __name__ == "__main__":
    test_like_literal()
    test_pick_exact()
    test_q()
    print("api/_test_lib.py: PASS")
