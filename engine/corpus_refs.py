#!/usr/bin/env python3
"""Append verses.md stubs for every scripture reference in the wizard corpus.

The corpus lives outside theology-map.md, so render.py's own reference sync
never sees it: a `refs` line the wizard puts in somebody's map would render
with no verse text behind it. This closes that gap by reusing render.py's
sync rather than reimplementing it.

    py engine/corpus_refs.py      # then: py engine/fetch_verses.py

render.sync_verses() takes *nodes*, not references — it calls collect_refs()
itself — so the corpus is handed over as one throwaway node per reference
string. That is the whole adaptation; the appending, the stub marker and the
write-only-if-changed logic all stay in render.py where they already work.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import render  # noqa: E402


def corpus_refs(dirpath):
    """Every distinct reference in the corpus, in first-seen order."""
    refs = []
    manifest = json.loads((dirpath / "manifest.json").read_text(encoding="utf-8"))
    for entry in manifest["domains"]:
        path = dirpath / entry["file"]
        # A manifest entry with no file on disk is the normal state until
        # phase 5 lands that domain, not an error.
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for doctrine in data["doctrines"]:
            raw = [doctrine.get("refs")]
            raw += [p.get("refs") for p in doctrine.get("positions", [])]
            for part in raw:
                for ref in (part or "").split(";"):
                    ref = ref.strip()
                    if ref and ref not in refs:
                        refs.append(ref)
    return refs


def main():
    refs = corpus_refs(ROOT / "content" / "wizard")
    print(f"{len(refs)} distinct references in the corpus")
    render.sync_verses([{"refs": r} for r in refs])
    print("verses.md synced — now run: py engine/fetch_verses.py")


if __name__ == "__main__":
    main()
