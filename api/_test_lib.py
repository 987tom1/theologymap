"""Self-check for the pure helpers in _lib.py. Run: py api/_test_lib.py

Deliberately tiny: no framework, no fixtures, no network. Everything else in
_lib.py talks to Supabase and is verified against production, not here.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import _like_literal  # noqa: E402


def test_like_literal():
    # An ordinary name passes through untouched.
    assert _like_literal("Thomas") == "Thomas"
    # The two ILIKE wildcards become literals, so a name matches only itself.
    assert _like_literal("%") == "\\%"
    assert _like_literal("a_b") == "a\\_b"
    # The escape character itself is escaped first, so it cannot escape ours.
    assert _like_literal("c\\d") == "c\\\\d"
    assert _like_literal("\\%") == "\\\\\\%"


if __name__ == "__main__":
    test_like_literal()
    print("api/_test_lib.py: PASS")
