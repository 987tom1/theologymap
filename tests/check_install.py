"""Add-to-Home-Screen gate: every hosted page links the manifest and apple-touch-icon,
and every icon the manifest names exists.  Run: py tests/check_install.py"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = sorted((ROOT / "web").glob("*.html")) + [ROOT / "engine" / "editor.html"]
assert len(PAGES) == 9, PAGES  # eight web pages + /edit

for p in PAGES:
    t = p.read_text(encoding="utf-8")
    for needle in ('rel="manifest" href="/web/manifest.webmanifest"', 'rel="apple-touch-icon" href="/web/icons/icon-180.png"'):
        assert needle in t, f"{p.name} missing {needle}"

m = json.loads((ROOT / "web" / "manifest.webmanifest").read_text(encoding="utf-8"))
assert m["display"] == "standalone" and m["start_url"] == "/"
for ic in m["icons"] + [{"src": "/web/icons/icon-180.png"}]:
    assert (ROOT / ic["src"].lstrip("/")).is_file(), ic["src"]
print("OK", len(PAGES), "pages,", len(m["icons"]), "manifest icons")
