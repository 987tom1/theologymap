"""Fill in verses.md with NET Bible text from the publisher's free API.

Usage:
    python fetch_verses.py            # fill only entries that are blank
    python fetch_verses.py --all      # re-fetch every entry, overwriting text

Reads and rewrites verses.md in place, preserving its comment blocks, entry
order, and any entry whose text you have edited by hand (unless --all).

Source: https://labs.bible.org/api/ — Biblical Studies Press's own free NET
Bible endpoint. Network access required; run it once after adding new refs.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
VERSES = ROOT / "verses.md"
API = "https://labs.bible.org/api/?passage={}&type=json"
PAUSE = 0.15  # be polite to a free service
TIMEOUT = 25


def fetch(reference: str) -> str:
    """Return the NET text for a reference, or '' if it can't be resolved."""
    url = API.format(urllib.parse.quote(reference))
    req = urllib.request.Request(url, headers={"User-Agent": "theology-map/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    if not payload:
        return ""

    # Single verse: no number prefix. Multiple: prefix each with its verse
    # number so a range stays readable in the popover.
    if len(payload) == 1:
        return clean(payload[0].get("text", ""))

    parts = []
    for v in payload:
        text = clean(v.get("text", ""))
        if text:
            parts.append(f"{v.get('verse', '')} {text}".strip())
    return " ".join(parts)


def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)          # the API occasionally returns markup
    text = text.replace("¶", "").strip()     # pilcrows
    return re.sub(r"\s+", " ", text)


def split_entries(body: str) -> list[tuple[str, str]]:
    """Split the non-comment body into (reference, text) pairs, in order."""
    entries = []
    current = None
    buf: list[str] = []
    for line in body.splitlines():
        if line.startswith("## "):
            if current is not None:
                entries.append((current, "\n".join(buf).strip()))
            current = line[3:].strip()
            buf = []
        elif current is not None:
            buf.append(line)
    if current is not None:
        entries.append((current, "\n".join(buf).strip()))
    return entries


def main() -> None:
    refetch_all = "--all" in sys.argv
    raw = VERSES.read_text(encoding="utf-8")

    # Keep every HTML comment block exactly where it is.
    comments = re.findall(r"<!--.*?-->", raw, flags=re.DOTALL)
    body = re.sub(r"<!--.*?-->", "", raw, flags=re.DOTALL)

    entries = split_entries(body)
    if not entries:
        print("No entries found in verses.md — run render.py first to create stubs.")
        return

    targets = [r for r, t in entries if refetch_all or not t]
    print(f"{len(entries)} entries; fetching {len(targets)}")

    filled: dict[str, str] = {}
    failed: list[str] = []
    for i, ref in enumerate(targets, 1):
        try:
            text = fetch(ref)
        except Exception as exc:  # network hiccup, bad reference, rate limit
            text = ""
            print(f"  [{i}/{len(targets)}] {ref} — ERROR {exc}")
        if text:
            filled[ref] = text
            print(f"  [{i}/{len(targets)}] {ref} — {len(text)} chars")
        else:
            failed.append(ref)
            if ref not in filled:
                print(f"  [{i}/{len(targets)}] {ref} — NO TEXT RETURNED")
        time.sleep(PAUSE)

    out = []
    if comments:
        out.append(comments[0])
        out.append("")
    for ref, text in entries:
        out.append(f"## {ref}")
        out.append(filled.get(ref, text))
        out.append("")
    for extra in comments[1:]:
        out.append(extra)
        out.append("")

    VERSES.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")

    still_blank = [r for r, t in split_entries(VERSES.read_text(encoding="utf-8")) if not t.strip()]
    print(f"\nfilled {len(filled)}, still blank {len(still_blank)}")
    if still_blank:
        print("blank: " + ", ".join(still_blank))


if __name__ == "__main__":
    main()
