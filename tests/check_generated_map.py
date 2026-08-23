"""Parse every generated prefix map with render.py's own parser: zero warnings required.

`node tests/wizard-generate.test.js` writes tests/out/prefix-*.md, one per prefix
of the answer sequence. This is the other half of design section 5.6's gate: the
generator's own round-trip proves editor-core.js is happy, and this proves
render.py is, which is the parser that actually warns on a dangling link.

Run from the repo root:  py tests/check_generated_map.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import render  # noqa: E402

OUT = ROOT / "tests" / "out"
paths = sorted(OUT.glob("prefix-*.md"))

if not paths:
    print("No prefix maps found. Run `node tests/wizard-generate.test.js` first.")
    sys.exit(1)

fails = 0
for path in paths:
    nodes = render.parse_text(path.read_text(encoding="utf-8"))
    slugs = {n["slug"] for n in nodes}
    for n in nodes:
        for target in n.get("link", []):
            if target not in slugs:
                print(f"BROKEN LINK {path.name}: {n['slug']} -> {target}")
                fails += 1
    if not nodes:
        print(f"EMPTY {path.name}")
        fails += 1

print(f"{len(paths)} prefix maps checked, {fails} problems")
sys.exit(1 if fails else 0)
