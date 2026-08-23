"""Every generated tradition map must parse with zero warnings and no broken links.

The JS side (tests/build-traditions.test.js) checks the generator against
editor-core.js's parser. This checks the same files against render.py's parser,
which is the hand-maintained port on the other side of the lockstep rule. Both
gates, or neither is worth much.
"""
import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import render

fails = 0
paths = sorted((ROOT / "content" / "traditions").glob("*.md"))
if not paths:
    print("NO TRADITION MAPS — run `node engine/build_traditions.js` first")
    sys.exit(1)

for path in paths:
    nodes = render.parse_text(path.read_text(encoding="utf-8"))
    slugs = {n["slug"] for n in nodes}
    if not nodes:
        print(f"EMPTY {path.name}"); fails += 1
    for n in nodes:
        for target in n.get("link", []):
            if target not in slugs:
                print(f"BROKEN LINK {path.name}: {n['slug']} -> {target}"); fails += 1
        if not n.get("hold"):
            print(f"NO HOLD {path.name}: {n['slug']}"); fails += 1
    print(f"{path.name}: {len(nodes)} nodes")
print(f"{len(paths)} tradition maps checked, {fails} problems")
sys.exit(1 if fails else 0)
