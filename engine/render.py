"""Render theology-map.md into an interactive HTML map, a Freeplane/XMind .mm
file, and a generated study list.

Usage:  python render.py

Reads   theology-map.md, documentation/verses.md
Writes  theology-map.html
        documentation/theology-map.mm
        documentation/study-list.md

Standard library only.
"""

from __future__ import annotations

import html
import json
import re
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).parent.parent
DOCS = ROOT / "documentation"
SRC = ROOT / "theology-map.md"
VERSES = DOCS / "verses.md"
BUILD = ROOT

VERSES_HEADER = """<!--
verses.md — scripture text for the Theology Map's verse popovers.

This file is partly auto-managed by render.py. On every run, render.py
collects every distinct reference used in a `refs` field across
theology-map.md and appends an empty stub entry here for any reference it
doesn't already find — under a clearly marked "auto-added stubs" section.
It never overwrites or reorders text a human has already written; edit
freely, fill in stubs, reorder, whatever you like above that marker.

Format: `## <reference>` starts an entry. Every following line up to the
next `## ` is that entry's text. An entry with no text (or only whitespace)
counts as "not yet filled in" and renders a placeholder in the HTML instead
of an empty box.

Scripture quoted by permission. Quotations designated (NET) are from the
NET Bible® copyright ©1996-2017 by Biblical Studies Press, L.L.C.
http://netbible.com All rights reserved.
-->
"""

STUB_MARKER = """
<!-- ======================================================================
     New references — auto-added by render.py as empty stubs below.
     Fill in the NET wording above the marker (or leave a stub blank);
     nothing under this comment is ever reordered or overwritten by a
     future run once you've given it text.
     ====================================================================== -->
"""

FIELDS = ("hold", "why", "vs", "todo", "link", "refs")
CONFIDENCES = ("certain", "confident", "leaning", "open", "rejected")
TIER_ORDER = ["T1", "T1.5", "T2", "T2.5", "T3", "T4"]

TIER_META = {
    # A single warm-to-cool ramp (garnet → rust → ochre → olive → teal → slate)
    # rather than stock status-badge hues — gravity reads as temperature
    # descending, and every value is dark/muted enough to hold white text at
    # AA contrast (checked: 5.0–9.2:1) in both the light and dark themes.
    "T1": ("Essential to the gospel", "#7c2d3b"),
    "T1.5": ("Near-essential", "#8a4a24"),
    "T2": ("Church-defining", "#8c6a1f"),
    "T2.5": ("Strains partnership", "#5f6b35"),
    "T3": ("Important, not divisive", "#2f6b63"),
    "T4": ("Matters of liberty", "#33526e"),
}

CONF_META = {
    "certain": (100, "Settled. I would teach and defend this."),
    "confident": (78, "Held with good reason, open to sharpening."),
    "leaning": (55, "A working position, not yet settled."),
    "open": (25, "Genuinely undecided."),
    "rejected": (0, "Considered and rejected."),
}


def slugify(text: str) -> str:
    text = text.lower().replace("&", "and")
    text = re.sub(r"['’]", "", text)  # possessives keep their word intact
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def parse_text(markdown_text: str) -> list[dict]:
    """Parse the outline text into a flat list of node dicts."""
    nodes: list[dict] = []
    domain = None
    node = None
    last_field = None

    for raw in markdown_text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            last_field = None
            continue

        if line.startswith("# "):
            domain = line[2:].strip()
            node = None
            last_field = None
            continue

        if line.startswith("## "):
            parts = [p.strip() for p in re.split(r"\s+[·|]\s+", line[3:].strip())]
            title = parts[0]
            node = {
                "title": title,
                "slug": slugify(title),
                "domain": domain or "Uncategorised",
                "tier": None,
                "confidence": None,
                "flags": [],
                "hold": "",
                "why": "",
                "vs": "",
                "todo": "",
                "link": [],
                "refs": "",
            }
            for token in parts[1:]:
                low = token.lower()
                if token.upper() in TIER_META:
                    node["tier"] = token.upper()
                elif low in CONFIDENCES:
                    node["confidence"] = low
                elif token.startswith("#"):
                    node["flags"].append(low[1:])
            nodes.append(node)
            last_field = None
            continue

        if node is None:
            continue

        stripped = line.strip()
        match = re.match(r"^(hold|why|vs|todo|link|refs)\s+(.*)$", stripped)
        if match:
            key, value = match.group(1), match.group(2).strip()
            if key == "link":
                node["link"].append(value)
                last_field = None
            else:
                node[key] = (node[key] + " " + value).strip() if node[key] else value
                last_field = key
        elif last_field:
            node[last_field] = (node[last_field] + " " + stripped).strip()

    return nodes


def parse(path: Path) -> list[dict]:
    """Parse theology-map.md from disk. Thin wrapper over parse_text()."""
    return parse_text(path.read_text(encoding="utf-8"))


def collect_refs(nodes: list[dict]) -> list[str]:
    """Every distinct scripture reference used across all nodes, in first-seen order."""
    seen: set[str] = set()
    order: list[str] = []
    for n in nodes:
        for r in (n.get("refs") or "").split(";"):
            r = r.strip()
            if r and r not in seen:
                seen.add(r)
                order.append(r)
    return order


def parse_verses_text(text: str) -> "OrderedDict[str, str]":
    """Parse verses.md *text* into an ordered {reference: text} dict.

    HTML comments are stripped first (the header block and stub-section
    markers are both comments), then `## <ref>` starts an entry and every
    line up to the next `## ` is its text.
    """
    verses: "OrderedDict[str, str]" = OrderedDict()
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    parts = re.split(r"(?m)^## (.+?)\s*$", text)
    # parts = [preamble, ref1, body1, ref2, body2, ...]
    for i in range(1, len(parts), 2):
        ref = parts[i].strip()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        body = re.sub(r"\s+", " ", body).strip()
        verses[ref] = body
    return verses


def parse_verses(path: Path) -> "OrderedDict[str, str]":
    """Parse verses.md from disk. Thin wrapper over parse_verses_text()."""
    if not path.exists():
        return OrderedDict()
    return parse_verses_text(path.read_text(encoding="utf-8"))


def render_markdown(markdown_text: str, verses: "OrderedDict[str, str]") -> str:
    """The whole hosted render path: markdown string in, HTML string out.

    Pure. Reads nothing, writes nothing, needs no ROOT. This is the function
    api/render.py calls.
    """
    return render_html(parse_text(markdown_text), verses)


def sync_verses(nodes: list[dict]) -> "OrderedDict[str, str]":
    """Read verses.md, append stubs for any reference in use that's missing,
    write back only if something changed, and return the merged map."""
    used = collect_refs(nodes)
    verses = parse_verses(VERSES)
    missing = [r for r in used if r not in verses]

    if not missing and VERSES.exists():
        return verses

    if VERSES.exists():
        text = VERSES.read_text(encoding="utf-8")
    else:
        text = VERSES_HEADER

    if missing:
        if not text.endswith("\n"):
            text += "\n"
        text += STUB_MARKER
        for r in missing:
            text += f"\n## {r}\n\n"
            verses[r] = ""
        print(f"verses.md: added {len(missing)} stub(s): {', '.join(missing)}")

    VERSES.write_text(text, encoding="utf-8")
    return verses


def esc(text: str) -> str:
    return html.escape(text or "", quote=True)


# --------------------------------------------------------------------------- HTML


def render_html(nodes: list[dict], verses: "OrderedDict[str, str]") -> str:
    # Ship only the verses THIS map cites, not everything in verses.md.
    # Until phase 4 the two sets were identical, so this changes no existing
    # output byte — verified against phase 2's baseline hash. It stops being a
    # no-op the moment engine/corpus_refs.py lands the wizard corpus's
    # references: those belong in verses.md, so a wizard-built map's popovers
    # have text, but they are not cited by Thomas's map or by anybody else's,
    # and without this filter every page load and every hosted /api/render
    # response would carry the whole corpus's scripture text. Phase 5 multiplies
    # that by fourteen domains.
    used = {r: verses[r] for r in collect_refs(nodes) if r in verses}
    payload = json.dumps(
        {
            "nodes": nodes,
            "tierMeta": TIER_META,
            "confMeta": CONF_META,
            "tierOrder": TIER_ORDER,
            "confOrder": list(CONFIDENCES),
            "verses": used,
        },
        ensure_ascii=False,
    )
    # A hosted map is somebody else's text. json.dumps does not escape `<`, so a
    # node title containing `</script>` would close the data block below and turn
    # the rest into live HTML. `<` is the same string after JSON.parse.
    payload = payload.replace("<", "\\u003c")

    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Theology Map</title>
<style>
  :root {
    --bg: #f6f3ec; --panel: #fffdf8; --ink: #23201a; --muted: #6b6255;
    --line: #e2dbcb; --accent: #23201a; --chip: #ede6d6;
    /* Phase 7 adopts phase 3's two extra tokens verbatim (engine/theme.css).
       --field-line is for interactive control boundaries only: --line against
       --panel is 1.36:1 and fails WCAG 2.1 SC 1.4.11 (3:1). --note is a quiet
       surface that is NOT perceivable alone (1.08:1 on --bg), so it never
       appears without a rule and a label beside it. */
    --field-line: #8f8369; --note: #f0ead9;
    --serif: ui-serif, Constantia, "Iowan Old Style", "Palatino Linotype", Georgia, serif;
    --sans: ui-sans-serif, "Segoe UI", system-ui, sans-serif;
    --mono: ui-monospace, "Cascadia Mono", "Consolas", monospace;
    --shadow: 0 1px 2px rgba(30,24,12,.05), 0 6px 16px -10px rgba(30,24,12,.20);
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#15120d; --panel:#201b14; --ink:#ece4d5; --muted:#a89a85;
            --line:#372f22; --accent:#ece4d5; --chip:#271f16;
            --field-line:#7d7059; --note:#2a2318;
            --shadow: 0 1px 2px rgba(0,0,0,.35), 0 8px 20px -12px rgba(0,0,0,.55); }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font: 15px/1.6 var(--serif); text-rendering:optimizeLegibility; }
  header { position:sticky; top:0; z-index:10; background:var(--bg);
           border-bottom:1px solid var(--line); padding:15px 22px 11px; }
  .kicker { margin:0 0 3px; font:600 10px/1 var(--sans); letter-spacing:.16em;
    text-transform:uppercase; color:var(--muted); }
  /* Was an inline style attribute on the anchor. Same look, but it can now be
     hidden by the print block and given a focus ring like every other link. */
  .kicker .editlink { float:right; color:var(--muted); text-transform:none;
    letter-spacing:0; font-weight:600; text-decoration:none; }
  .kicker .editlink:hover { color:var(--ink); }
  h1 { margin:0; font-family:var(--serif); font-size:23px; letter-spacing:-0.01em;
    font-weight:600; }
  /* Title row: heading left, filter controls right. Merges what used to be
     two stacked rows (h1, then the search box inside .viewrow) into one, to
     shave height off the sticky header on a phone. */
  .titlerow { display:flex; align-items:center; gap:12px; flex-wrap:nowrap; margin:0 0 3px; }
  .titlefilters { display:flex; align-items:center; gap:8px; margin-left:auto; min-width:0; }
  .sub { color:var(--muted); font:12.5px/1.5 var(--sans); margin-bottom:11px; max-width:58ch; }
  .bar { display:flex; gap:16px; align-items:center; flex-wrap:wrap; font-family:var(--sans); }
  .views { display:flex; gap:2px; background:var(--chip); padding:3px; border-radius:7px; }
  .views button { border:0; background:transparent; color:var(--muted); cursor:pointer;
    padding:5px 12px; border-radius:5px; font:600 12.5px/1 var(--sans); letter-spacing:.01em; }
  .views button[aria-pressed="true"] { background:var(--panel); color:var(--ink);
    box-shadow:var(--shadow); }
  .seg { display:flex; gap:2px; background:var(--chip); padding:3px; border-radius:7px; }
  .seg button { border:0; background:transparent; color:var(--muted); cursor:pointer;
    padding:5px 10px; border-radius:5px; font:600 12px/1 var(--sans); }
  .seg button[aria-pressed="true"] { background:var(--panel); color:var(--ink);
    box-shadow:var(--shadow); }
  input[type=search] { border:1px solid var(--field-line); background:var(--panel); color:var(--ink);
    padding:6px 11px; border-radius:6px; font:13px/1 var(--sans); min-width:190px; }
  input[type=search]::placeholder { color:var(--muted); }
  label.tog { font:12px/1 var(--sans); color:var(--muted); display:flex; gap:5px;
    align-items:center; cursor:pointer; }
  label.tog input { accent-color:var(--accent); }
  .btnrow { display:flex; gap:6px; }
  .btnrow button { font:600 11.5px/1 var(--sans); border:1px solid var(--field-line);
    background:var(--panel); color:var(--muted); padding:5px 10px; border-radius:6px; cursor:pointer; }
  .btnrow button:hover { color:var(--ink); border-color:var(--muted); }
  /* One focus treatment for every control on the page, not just .refchip.
     --muted is 5.41:1 on --bg and 5.90:1 on --panel, so it is visible in both
     themes on every surface a control sits on. */
  a:focus-visible, button:focus-visible, input:focus-visible,
  summary:focus-visible, [tabindex]:focus-visible {
    outline:2px solid var(--muted); outline-offset:2px; border-radius:4px; }
  main { padding:18px 22px 90px; max-width:1080px; margin-inline:auto; }
  main.wide { max-width:none; padding:16px 16px 16px; }
  .group { margin-bottom:22px; }
  .group > h2 { font:700 11px/1.3 var(--sans); text-transform:uppercase; letter-spacing:.12em;
    color:var(--muted); margin:0 0 11px; cursor:pointer; user-select:none;
    display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    padding-bottom:8px; border-bottom:1px solid var(--line); }
  .group > h2:hover { color:var(--ink); }
  .group > h2 .chev { display:inline-block; transition:transform .15s ease; font-size:9px;
    color:var(--muted); }
  .group.expanded > h2 .chev { transform:rotate(90deg); }
  .group .cardwrap { display:none; }
  .group.expanded .cardwrap { display:block; }
  /* Geometry and surface taken from theme.css's .tm-card so a card here and a
     card in the hosted app are the same object: --panel, --field-line, 9px
     radius, 16px/18px padding, 17px serif heading. The 3px tier rail on the
     left edge is this view's own addition and stays. */
  .node { background:var(--panel); border:1px solid var(--field-line);
    border-left:3px solid var(--tier, var(--field-line));
    border-radius:9px; padding:14px 18px 15px; margin-bottom:10px; break-inside:avoid;
    scroll-margin-top:96px; }
  .node.assumed { border-style:dashed; }
  .nhead { display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
  .ntitle { font-family:var(--serif); font-weight:600; font-size:17px; line-height:1.3;
    letter-spacing:-.003em; }
  .chip { font:600 10px/1 var(--sans); letter-spacing:.05em;
    text-transform:uppercase; padding:3.5px 6.5px; border-radius:4px;
    background:var(--chip); color:var(--muted); }
  .chip.tier { color:#fff; }
  .dom { font:11.5px/1 var(--sans); color:var(--muted); }
  .meter { display:inline-flex; align-items:center; gap:6px; }
  .meter .track { width:46px; height:5px; border-radius:3px; background:var(--chip);
    border:1px solid var(--field-line); overflow:hidden; }
  .meter .fill { height:100%; border-radius:3px; background:var(--tier, var(--muted));
    display:block; opacity:.9; }
  dl { margin:10px 0 0; padding-top:10px; border-top:1px solid var(--line);
    display:grid; grid-template-columns:max-content 1fr; gap:7px 16px; align-items:baseline; }
  dt { font:700 10px/1.8 var(--sans); letter-spacing:.08em;
    text-transform:uppercase; color:var(--muted); white-space:nowrap; }
  /* 58ch is the prose cap from phase 3 §3. min() keeps it from overflowing a
     narrow container (a map tile, a print column) where 58ch is wider than the
     box. */
  dd { margin:0; font:14.5px/1.6 var(--serif); max-width:min(58ch, 100%); }
  dd.todo { color:var(--muted); font-style:italic; }
  dd.refs, dd.rel { max-width:none; display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
  .refchip { font:500 11px/1.5 var(--mono); letter-spacing:.01em;
    color:var(--muted); background:transparent; border:1px solid var(--field-line);
    padding:2.5px 7px; border-radius:4px; white-space:nowrap;
    cursor:pointer; appearance:none; }
  .refchip:hover { color:var(--ink); border-color:var(--muted); }
  .refchip[aria-expanded="true"] { color:var(--ink); background:var(--chip); border-color:var(--muted); }
  .refchip:focus-visible { outline:2px solid var(--muted); outline-offset:2px; }

  /* ---------- verse popover ---------- */
  /* Scripture is the one place on the page that is quoted rather than written,
     so the popover uses --note (phase 3 §3.3) with the mandatory left rule and
     labelled head — --note alone is 1.08:1 on --bg and carries nothing. */
  .versepop { position:fixed; z-index:100; max-width:min(46ch, calc(100vw - 28px));
    background:var(--note); color:var(--ink);
    border:1px solid var(--field-line); border-left:3px solid var(--muted);
    border-radius:0 9px 9px 0; box-shadow:var(--shadow);
    padding:12px 16px 13px; }
  .versepop-head { font:700 11px/1 var(--sans); letter-spacing:.04em; text-transform:uppercase;
    color:var(--muted); margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--line); }
  .versepop-body { font:14.5px/1.6 var(--serif); color:var(--ink); }
  .versepop-empty { font:13px/1.5 var(--sans); font-style:italic; color:var(--muted); }
  .versepop-attr { margin-top:9px; font:11px/1.4 var(--sans); color:var(--muted); }

  .pagefoot { max-width:1080px; margin:0 auto; padding:18px 22px 40px;
    font:11.5px/1.5 var(--sans); color:var(--muted); }
  .pagefoot a { color:inherit; }
  dd.rel a { font:11.5px/1.4 var(--sans); color:var(--muted); text-decoration:none;
    border:1px solid var(--field-line); padding:3.5px 9px; border-radius:20px;
    cursor:pointer; }
  dd.rel a:hover { color:var(--ink); border-color:var(--muted); }
  .node:target { outline:2px solid var(--muted); outline-offset:3px; }
  .node.flash { animation:flash 1.4s ease; }
  @keyframes flash { 0%{outline:2px solid var(--muted);outline-offset:3px;} 100%{outline:2px solid transparent;} }
  .legend { display:flex; gap:13px; flex-wrap:wrap; margin-top:10px;
    font:11px/1 var(--sans); color:var(--muted); }
  .legend span { display:flex; align-items:center; gap:6px; }
  /* Tier colour is never the sole channel (phase 3 §3.2, failure B). Each
     swatch is 1.87:1-3.42:1 on the dark panel on its own, so it carries a
     --field-line border to be perceivable and always sits beside its label. */
  .sw { width:10px; height:10px; border-radius:3px; display:inline-block;
    border:1px solid var(--field-line); flex:0 0 auto; }
  .empty { color:var(--muted); font-style:italic; }

  /* ---------- map view ---------- */
  #mapwrap { display:none; position:relative; width:100%; height:calc(100vh - 130px);
    overflow:hidden; border:1px solid var(--line); border-radius:9px; background:var(--bg);
    background-image:radial-gradient(var(--line) 1px, transparent 1px);
    background-size:24px 24px; cursor:grab; touch-action:none; }
  #mapwrap.dragging { cursor:grabbing; }
  #mapwrap.active { display:block; }
  #mapPanZoom { position:absolute; left:0; top:0; transform-origin:0 0; }
  #mapSvg { position:absolute; left:0; top:0; overflow:visible; pointer-events:none; }
  #mapSvg path { fill:none; stroke:var(--line); stroke-width:1.4; }
  #mapSvg path.edge-domain { stroke-width:1.6; opacity:.9; }
  #mapSvg path.edge-leaf { stroke-width:1.1; opacity:.75; }
  .mbox { position:absolute; left:0; top:0; background:var(--panel); border:1px solid var(--line);
    border-radius:7px; padding:9px 12px; box-shadow:var(--shadow);
    transition:transform .28s ease; cursor:pointer; font:13px/1.4 var(--sans);
    width:max-content; }
  .mbox-root { width:150px; background:var(--ink); color:var(--bg); font-family:var(--serif);
    font-weight:700; font-size:14.5px; text-align:center; cursor:default; border-color:var(--ink); }
  .mbox-domain { min-width:140px; max-width:min(240px, 80vw); font-weight:700; font-size:12px;
    letter-spacing:.03em; text-transform:uppercase; border-left:3px solid var(--muted); }
  /* Collapsed leaf: shrink to its title/chips, clamped (150-320px) so a
     long title wraps to two lines instead of stretching the box. Expanded
     leaf (detail open): grow to a comfortable reading measure (roughly
     340-560px, ~45-70ch at this font size), hard-capped at 560px so
     paragraphs don't read as one long line. Both clamps fall back to a
     viewport-relative max on narrow/phone widths so nothing can overflow. */
  .mbox-leaf { min-width:150px; max-width:min(320px, 86vw); border-left:3px solid var(--tier, var(--line)); }
  .mbox-leaf.mopen { border-color:var(--field-line); border-left-color:var(--tier, var(--field-line)); }
  .mbox-leaf.mopen { min-width:min(340px, 80vw); max-width:min(560px, 92vw); }
  .mbox-leaf .mtitle b { font-family:var(--serif); font-weight:600; }
  .mbox-leaf.assumed { border-style:dashed; }
  .mtitle { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .mtitle b { font-weight:600; font-size:13.5px; }
  .mchev { font-size:10px; color:var(--muted); transition:transform .15s ease; flex:0 0 auto; }
  .mbox.mopen .mchev { transform:rotate(90deg); }
  .mmeta { display:flex; gap:5px; flex-wrap:wrap; margin-top:6px; }
  .mdetail { margin-top:9px; border-top:1px solid var(--line); padding-top:8px; }
  /* A map tile is 340-560px wide, and "What I'd reject" as a max-content label
     column would eat ~100px of that. Labels stack above their values here, the
     same shape the card views take below 560px. */
  .mdetail dl { grid-template-columns:1fr; gap:2px 0; border-top:0; padding-top:0; margin-top:0; }
  .mdetail dt { padding-top:6px; }
  .mdetail dt:first-child { padding-top:0; }
  .mdetail dd { font-size:13.5px; }
  .mcount { font-weight:400; color:var(--muted); font-size:11px; }
  .mapcontrols { position:absolute; right:10px; top:10px; z-index:5; display:flex; gap:6px; }
  .mapcontrols button { font:600 11.5px/1 var(--sans); border:1px solid var(--field-line);
    background:var(--panel); color:var(--muted); padding:5px 9px; border-radius:6px; cursor:pointer;
    box-shadow:var(--shadow); }
  .mapcontrols button:hover { color:var(--ink); }
  /* Sits over the dotted map ground, so it needs its own surface to stay
     readable rather than borrowing the page background. */
  .maphint { position:absolute; left:10px; bottom:8px; font:11px/1.4 var(--sans);
    color:var(--muted); z-index:5; background:var(--bg); padding:4px 8px;
    border-radius:6px; max-width:calc(100% - 20px); }

  /* ---------- header restructure: secondary filters behind a disclosure ---------- */
  .viewrow { display:flex; gap:16px; align-items:center; flex:1 1 auto; min-width:0; }
  .filtersToggle { display:none; }
  .secondary { display:contents; }

  /* ---------- touch tap targets (any coarse pointer, any width) ---------- */
  @media (pointer:coarse) {
    .refchip { padding:7px 10px; }
    .views button, .seg button { padding:9px 13px; }
    .group > h2 { padding-top:4px; padding-bottom:10px; }
    .btnrow button { padding:8px 12px; }
    label.tog { padding:6px 0; }
    .mapcontrols button { padding:8px 12px; }
    .views button, .seg button, .refchip, .filtersToggle { min-height:44px; }
  }

  /* ---------- phone layout ---------- */
  @media (max-width:640px) {
    header { padding:10px 14px 8px; }
    .kicker { display:none; }
    h1 { font-size:19px; }
    .sub { display:none; }
    .legend { display:none; }
    .titlerow { gap:8px; }
    .bar { gap:8px; row-gap:8px; }
    .viewrow { gap:8px; width:100%; }
    .views { overflow-x:auto; -webkit-overflow-scrolling:touch; flex:0 1 auto; scrollbar-width:thin; }
    .views button { white-space:nowrap; }
    input[type=search] { flex:1 1 auto; min-width:0; width:auto; }
    .filtersToggle { display:inline-flex; align-items:center; gap:5px; font:600 12px/1 var(--sans);
      border:1px solid var(--field-line); background:var(--panel); color:var(--muted);
      padding:7px 11px; border-radius:6px; cursor:pointer; }
    .filtersToggle[aria-expanded="true"] { color:var(--ink); border-color:var(--muted); }
    .secondary { display:none; width:100%; flex-direction:column; align-items:flex-start; gap:8px; }
    .secondary.open { display:flex; }
    #mapwrap { height:calc(100vh - 108px); }
    main { padding:14px 14px 70px; }
    .node { padding:12px 14px 13px; margin-bottom:8px; }
    .ntitle { font-size:16px; }
    dd { font-size:14px; }
    .group { margin-bottom:18px; }
    .pagefoot { padding:16px 14px 32px; }
  }

  @media (max-width:560px) {
    dl { grid-template-columns:1fr; gap:2px 0; }
    dt { padding-top:6px; }
    dt:first-child { padding-top:0; }
  }

  /* A3 two-column, per the brief. Printing force-switches to the domain view
     with every group expanded, then restores whatever was on screen. */
  @media print {
    @page { size: A3; margin: 12mm; }
    header { position:static; border-bottom:1px solid #999; }
    .views, .seg, input, label.tog, .btnrow, #mapwrap, .mapcontrols,
    .filtersToggle, .maphint, .kicker .editlink { display:none !important; }
    body { background:#fff; color:#000; font-size:10.5px; }
    /* Both are hidden below 640px to keep the sticky header short on a phone;
       on paper there is no sticky header and the tier legend is the key to
       every chip, so they come back. */
    .sub { display:block !important; }
    .legend { display:flex !important; margin-top:8px; }
    main { max-width:none; padding:8px 0 0; columns:2; column-gap:20px; }
    /* Tier chips are white text on a dark fill and the confidence meter is a
       bare colour bar; browsers drop background colours in print by default,
       which would render the chip white-on-white and the meter blank. These
       three are the only places colour carries meaning on paper. */
    .chip.tier, .meter .fill, .sw {
      -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .node { break-inside:avoid; padding:9px 12px 10px; margin-bottom:8px;
      border-color:#bbb; border-left-width:3px; box-shadow:none; }
    /* A group heading stranded at the foot of a column is the one thing a
       two-column print gets wrong on its own. */
    .group { break-inside:auto; margin-bottom:14px; }
    .group > h2 { break-after:avoid; border-bottom-color:#999; }
    dl { padding-top:7px; margin-top:7px; border-top-color:#ccc; }
    .refchip, dd.rel a { border-color:#bbb; cursor:default; }
    .group .cardwrap { display:block !important; }
    .group > h2 .chev { display:none; }
    .versepop { display:none !important; }
    /* The NET attribution must travel with the text — it is a licence
       condition, not decoration. It never gets display:none. */
    .pagefoot { max-width:none; padding:12px 0 0; font-size:9px;
      border-top:1px solid #ccc; margin-top:10px; }
  }
</style>
</head>
<body>
<header>
  <p class="kicker">A personal systematic reference
    <a class="editlink" id="editlink" href="engine/editor.html">Edit &#9998;</a>
  </p>
  <div class="titlerow">
    <h1>Theology Map</h1>
    <div class="titlefilters">
      <input type="search" id="q" placeholder="Filter&hellip;">
      <button type="button" id="filtersToggle" class="filtersToggle" aria-expanded="false"
        aria-controls="secondaryControls">Filters &#9662;</button>
    </div>
  </div>
  <div class="sub">Positions by Ortlund triage tier &middot; tier is how much weight it carries,
    confidence is how settled it is &middot; a dashed border marks a position inferred and not yet confirmed</div>
  <div class="bar">
    <div class="viewrow">
      <div class="views" id="views">
        <button data-view="map" aria-pressed="true">Map</button>
        <button data-view="domain" aria-pressed="false">Domain</button>
        <button data-view="tier" aria-pressed="false">Tier</button>
        <button data-view="confidence" aria-pressed="false">Confidence</button>
      </div>
    </div>
    <div class="secondary" id="secondaryControls">
      <div class="seg" id="studyFilter">
        <button data-val="all" aria-pressed="true">All</button>
        <button data-val="only" aria-pressed="false">Only study</button>
        <button data-val="hide" aria-pressed="false">Hide study</button>
      </div>
      <label class="tog"><input type="checkbox" id="hideAssumed"> hide inferred</label>
      <div class="btnrow">
        <button id="expandAll" type="button">Expand all</button>
        <button id="collapseAll" type="button">Collapse all</button>
      </div>
    </div>
  </div>
  <div class="legend" id="legend"></div>
</header>
<main id="out"></main>
<div id="mapwrap" class="active">
  <div class="mapcontrols">
    <button id="mapReset" type="button">Reset view</button>
  </div>
  <div class="maphint">Drag/swipe to pan &middot; scroll or pinch to zoom &middot; tap a box to expand</div>
  <div id="mapPanZoom">
    <svg id="mapSvg"></svg>
    <div id="mapBoxes"></div>
  </div>
</div>
<footer class="pagefoot">Scripture quoted by permission. Quotations designated (NET) are from the
  NET Bible&reg; copyright &copy;1996-2017 by Biblical Studies Press, L.L.C.
  <a href="http://netbible.com" target="_blank" rel="noopener">netbible.com</a> All rights reserved.</footer>
<script id="data" type="application/json">__DATA__</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const all = D.nodes;
let view = 'map';
let studyFilter = 'all'; // all | only | hide

document.getElementById('legend').innerHTML = D.tierOrder.map(t =>
  `<span><i class="sw" style="background:${D.tierMeta[t][1]}"></i>${t} &mdash; ${D.tierMeta[t][0]}</span>`
).join('');

// Framed (e.g. /view's sandboxed iframe) means someone else's map: the
// editor cannot work from inside that frame, so don't invite the tap.
if (window.top !== window.self) document.getElementById('editlink').remove();

const esc = s => (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const refChips = s => (s||'').split(';').map(r => r.trim()).filter(Boolean)
  .map(r => `<button type="button" class="refchip" data-ref="${esc(r)}" aria-expanded="false">${esc(r)}</button>`).join('');
const nodeText = n => [n.title,n.domain,n.hold,n.why,n.vs,n.todo,n.refs].join(' ').toLowerCase();

// Tier order for map/domain-view sorting: T1 first through T4, untiered last.
// Array.prototype.sort is spec-stable, so nodes sharing a tier keep their
// original (file) order rather than being re-sorted alphabetically.
function tierRank(n) {
  const i = D.tierOrder.indexOf(n.tier);
  return i === -1 ? D.tierOrder.length : i;
}
const sortByTier = list => list.slice().sort((a, b) => tierRank(a) - tierRank(b));

// -------------------------------------------------------------- verse popovers
const verses = D.verses || {};
let openPopover = null; // { btn, el }

function closePopover() {
  if (!openPopover) return;
  openPopover.btn.setAttribute('aria-expanded', 'false');
  openPopover.el.remove();
  openPopover = null;
}

function positionPopover(pop, btn) {
  const margin = 10;
  const r = btn.getBoundingClientRect();
  pop.style.left = '0px'; pop.style.top = '0px'; // measure at natural size first
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  // A detached or hidden pill reports an all-zero rect. Anchoring to that
  // would pin the popover to the top-left corner, which reads as a bug
  // rather than as the missing anchor it actually is — centre instead.
  if (!r.width && !r.height) {
    pop.style.left = Math.max(margin, (window.innerWidth - pw) / 2) + 'px';
    pop.style.top = Math.max(margin, (window.innerHeight - ph) / 2) + 'px';
    return;
  }
  let left = r.left;
  let top = r.bottom + 8;
  if (left + pw > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - pw - margin);
  if (left < margin) left = margin;
  if (top + ph > window.innerHeight - margin) {
    const above = r.top - ph - 8;
    top = above >= margin ? above : Math.max(margin, window.innerHeight - ph - margin);
  }
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function openPopoverFor(btn) {
  if (openPopover && openPopover.btn === btn) { closePopover(); return; }
  closePopover();
  const ref = btn.dataset.ref;
  const text = (verses[ref] || '').trim();
  const pop = document.createElement('div');
  pop.className = 'versepop';
  pop.setAttribute('role', 'dialog');
  pop.innerHTML = `<div class="versepop-head">${esc(ref)}</div>` +
    (text
      ? `<div class="versepop-body">${esc(text)}</div><div class="versepop-attr">(NET)</div>`
      : `<div class="versepop-body versepop-empty">Not yet added to verses.md</div>`);
  document.body.appendChild(pop);
  positionPopover(pop, btn);
  btn.setAttribute('aria-expanded', 'true');
  openPopover = { btn, el: pop };
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.refchip');
  if (btn) { e.stopPropagation(); openPopoverFor(btn); return; }
  if (openPopover && !e.target.closest('.versepop')) closePopover();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePopover();
});

function passesFilters(n, q) {
  if (studyFilter === 'only' && !n.flags.includes('study')) return false;
  if (studyFilter === 'hide' && n.flags.includes('study')) return false;
  if (document.getElementById('hideAssumed').checked && n.flags.includes('assumed')) return false;
  if (q && !nodeText(n).includes(q)) return false;
  return true;
}

// The field labels are phase 3 design §2.2's table, verbatim, so the public
// views and the editor say the same words about the same field. In particular
// `todo` is "Still working out" and never "Study" or "Todo" — the #study flag
// is a different thing and used to share that word. Presentation only: the
// stored field keys in theology-map.md are untouched.
const FIELD_ROWS = [
  ['hold', 'What I hold', ''],
  ['why',  'Why', ''],
  ['vs',   "What I'd reject", ''],
  ['todo', 'Still working out', ' class="todo"'],
];
const detailRows = n => {
  const rows = FIELD_ROWS
    .filter(([k]) => n[k])
    .map(([k, label, cls]) => `<dt>${label}</dt><dd${cls}>${esc(n[k])}</dd>`);
  if (n.refs) rows.push(`<dt>Texts</dt><dd class="refs">${refChips(n.refs)}</dd>`);
  return rows;
};

function card(n) {
  const tier = n.tier ? D.tierMeta[n.tier] : null;
  const conf = n.confidence ? D.confMeta[n.confidence] : null;
  const rows = detailRows(n);
  if (n.link.length) rows.push(`<dt>Related</dt><dd class="rel">${n.link.map(l =>
    `<a href="#" data-goto="${esc(l)}">${esc((all.find(x=>x.slug===l)||{title:l}).title)}</a>`).join('')}</dd>`);
  return `<article class="node${n.flags.includes('assumed')?' assumed':''}" id="${n.slug}"
      style="--tier:${tier?tier[1]:'var(--line)'}">
    <div class="nhead">
      <span class="ntitle">${esc(n.title)}</span>
      ${tier?`<span class="chip tier" style="background:${tier[1]}" title="${esc(tier[0])}">${n.tier}</span>`:''}
      ${conf?`<span class="meter" title="${esc(conf[1])}"><span class="track"><span class="fill"
          style="width:${conf[0]}%"></span></span><span class="chip">${n.confidence}</span></span>`:''}
      ${n.flags.includes('study')?'<span class="chip">study</span>':''}
      ${view!=='domain'&&n.domain?`<span class="dom">${esc(n.domain)}</span>`:''}
    </div>
    ${rows.length?`<dl>${rows.join('')}</dl>`:''}
  </article>`;
}

// -------------------------------------------------------------- list views
let expandedGroups = new Set(); // "view::name" entries the user explicitly opened

function groupKey(name) { return view + '::' + name; }

function render() {
  const mapwrap = document.getElementById('mapwrap');
  const out = document.getElementById('out');
  // The card views want a reading measure; the map wants the whole window, and
  // on a wide screen (or inside /view's fullscreen frame) 1080px leaves most of
  // it empty. `main.wide` was already defined and unset — this is its one caller.
  document.querySelector('main').classList.toggle('wide', view === 'map');
  if (view === 'map') {
    mapwrap.classList.add('active');
    out.style.display = 'none';
    redrawMap();
    return;
  }
  mapwrap.classList.remove('active');
  out.style.display = '';

  const q = document.getElementById('q').value.trim().toLowerCase();
  let set = all.filter(n => passesFilters(n, q));

  let groups;
  if (view === 'tier') {
    groups = D.tierOrder.map(t => [`${t} — ${D.tierMeta[t][0]}`, set.filter(n => n.tier === t)]);
    const untiered = set.filter(n => !n.tier);
    if (untiered.length) groups.push(['Untiered', untiered]);
  } else if (view === 'confidence') {
    const order = ['open','leaning','confident','certain','rejected'];
    groups = order.map(c => [c, set.filter(n => n.confidence === c)]);
    const none = set.filter(n => !n.confidence);
    if (none.length) groups.push(['unmarked', none]);
  } else {
    const seen = [];
    set.forEach(n => { if (!seen.includes(n.domain)) seen.push(n.domain); });
    groups = seen.map(d => [d, sortByTier(set.filter(n => n.domain === d))]);
  }

  const html = groups.filter(([,ns]) => ns.length)
    .map(([name, ns]) => {
      const key = groupKey(name);
      const isExpanded = expandedGroups.has(key) || (q && ns.length > 0);
      return `<section class="group${isExpanded?' expanded':''}" data-key="${esc(key)}">
        <h2 aria-expanded="${isExpanded}"><span class="chev">&#9656;</span>${esc(name)}
          <span class="mcount">(${ns.length})</span></h2>
        <div class="cardwrap">${ns.map(card).join('')}</div>
      </section>`;
    })
    .join('');
  out.innerHTML = html || '<p class="empty">Nothing matches that filter.</p>';
}

document.getElementById('out').addEventListener('click', e => {
  const h2 = e.target.closest('.group > h2');
  if (h2) {
    const sec = h2.closest('.group');
    const key = sec.dataset.key;
    const nowExpanded = !sec.classList.contains('expanded');
    if (nowExpanded) expandedGroups.add(key); else expandedGroups.delete(key);
    sec.classList.toggle('expanded', nowExpanded);
    h2.setAttribute('aria-expanded', String(nowExpanded));
    return;
  }
  const a = e.target.closest('a[data-goto]');
  if (a) {
    e.preventDefault();
    gotoNode(a.dataset.goto);
  }
});

function gotoNode(slug) {
  const target = all.find(x => x.slug === slug);
  if (!target) return;
  if (view === 'map') {
    switchView('domain');
  }
  // make sure its group is expanded, then scroll + flash
  requestAnimationFrame(() => {
    const groupName = view === 'domain' ? target.domain
      : view === 'tier' ? (target.tier ? `${target.tier} — ${D.tierMeta[target.tier][0]}` : 'Untiered')
      : (target.confidence || 'unmarked');
    expandedGroups.add(groupKey(groupName));
    render();
    requestAnimationFrame(() => {
      const el = document.getElementById(target.slug);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1500);
      }
    });
  });
}

function switchView(v) {
  view = v;
  [...document.querySelectorAll('#views button')]
    .forEach(x => x.setAttribute('aria-pressed', String(x.dataset.view === v)));
}

document.getElementById('views').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  switchView(b.dataset.view);
  render();
});
document.getElementById('studyFilter').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  studyFilter = b.dataset.val;
  [...document.querySelectorAll('#studyFilter button')]
    .forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  render();
});
['q','hideAssumed'].forEach(id =>
  document.getElementById(id).addEventListener('input', render));

document.getElementById('filtersToggle').addEventListener('click', () => {
  const sec = document.getElementById('secondaryControls');
  const open = sec.classList.toggle('open');
  document.getElementById('filtersToggle').setAttribute('aria-expanded', String(open));
});

document.getElementById('expandAll').addEventListener('click', () => {
  if (view === 'map') {
    mapManualCollapsed.clear();
    all.forEach(n => mapDetailOpen.add(n.slug));
    redrawMap();
    return;
  }
  document.querySelectorAll('#out .group').forEach(sec => expandedGroups.add(sec.dataset.key));
  render();
});
document.getElementById('collapseAll').addEventListener('click', () => {
  if (view === 'map') {
    mapDetailOpen.clear();
    mapManualCollapsed = new Set(domainIds());
    redrawMap();
    return;
  }
  document.querySelectorAll('#out .group').forEach(sec => expandedGroups.delete(sec.dataset.key));
  render();
});

// -------------------------------------------------------------- map view
//
// Two-sided balanced layout: the root sits at x=0 (centred), with domain
// branches alternating right (side=1) / left (side=-1) — the same
// convention render_mm() uses for the .mm export. Below MAP_TWO_SIDE_BREAK
// (phone widths) everything folds back to the old single-sided
// left-to-right layout (all boxes get side=1, root's left edge at x=0)
// since a split map doesn't have room to breathe on a narrow screen.
// Box widths are no longer fixed constants — CSS sizes each box to its
// content (width:max-content, clamped by min/max-width per box type/state
// in the stylesheet) and the layout pass below measures the result from the
// live DOM via offsetWidth, the same way it already measures heights via
// offsetHeight. Only the gaps between columns stay as constants.
const GAP_Y = 14;
const DOMAIN_GAP = 60, LEAF_GAP = 70;
// The stagger applied to every second leaf must NOT derive from that box's
// own measured width: a box roughly doubles in width when its detail opens,
// so a width-derived offset would double too and the box would visibly jump
// outward on expand instead of staying put. A constant keeps a box's x
// stable across expand/collapse.
const STAGGER_X = 110;
const MAP_TWO_SIDE_BREAK = 860;
let panX = 0, panY = 0, zoom = 1;
let needsCenter = true; // recompute pan on next redraw so the root lands mid-viewport
let mapManualCollapsed = null; // Set of collapsible domain ids that are closed
let mapDetailOpen = new Set();  // leaf slugs whose detail panel is open
let mapEls = new Map(); // id -> DOM element, persisted across redraws for CSS transitions

function domainNames() {
  const seen = [];
  all.forEach(n => { if (!seen.includes(n.domain)) seen.push(n.domain); });
  return seen;
}
function domainIds() {
  return domainNames().map(d => 'domain:' + d);
}
if (!mapManualCollapsed) mapManualCollapsed = new Set(domainIds());

function buildMapTree() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  const twoSided = window.innerWidth >= MAP_TWO_SIDE_BREAK;
  const root = { id: 'root', type: 'root', title: 'My Theology', depth: 0, side: 0, twoSided, children: [] };
  let idx = 0;
  const nextSide = () => { const s = (twoSided && idx % 2 === 1) ? -1 : 1; idx++; return s; };
  domainNames().forEach(dname => {
    const members = sortByTier(all.filter(n => n.domain === dname && passesFilters(n, q)));
    const id = 'domain:' + dname;
    const hasMatches = q && members.length > 0;
    const isOpen = !mapManualCollapsed.has(id) || hasMatches;
    const side = nextSide();
    const dom = { id, type:'domain', title: dname, depth: 1, side, total: members.length, children: [] };
    if (isOpen) {
      dom.children = members.map(n => leafBox(n, 2, side));
    }
    root.children.push(dom);
  });
  return root;
}

function leafBox(n, depth, side) {
  return { id: n.slug, type:'leaf', title: n.title, depth, side, node: n, children: [] };
}

function flatten(tree, acc) {
  acc.push(tree);
  tree.children.forEach(c => flatten(c, acc));
  return acc;
}

function mboxHTML(box) {
  if (box.type === 'root') {
    return `<div class="mbox mbox-root" data-id="${esc(box.id)}">${esc(box.title)}</div>`;
  }
  if (box.type === 'domain') {
    const openState = box.children.length > 0;
    return `<div class="mbox mbox-domain${openState?' mopen':''}" data-id="${esc(box.id)}">
      <div class="mtitle"><b>${esc(box.title)}</b>${box.total ? '<span class="mchev">&#9656;</span>' : ''}</div>
      <div class="mmeta"><span class="mcount">${box.total} node${box.total===1?'':'s'}</span></div>
    </div>`;
  }
  // leaf
  const n = box.node;
  const open = mapDetailOpen.has(n.slug);
  const tier = n.tier ? D.tierMeta[n.tier] : null;
  const conf = n.confidence ? D.confMeta[n.confidence] : null;
  const rows = detailRows(n);
  return `<div class="mbox mbox-leaf${open?' mopen':''}${n.flags.includes('assumed')?' assumed':''}"
      data-id="${esc(box.id)}" style="--tier:${tier?tier[1]:'var(--line)'}">
    <div class="mtitle"><b>${esc(n.title)}</b><span class="mchev">&#9656;</span></div>
    <div class="mmeta">
      ${tier?`<span class="chip tier" style="background:${tier[1]}">${n.tier}</span>`:''}
      ${conf?`<span class="chip">${n.confidence}</span>`:''}
      ${n.flags.includes('study')?'<span class="chip">study</span>':''}
    </div>
    ${open && rows.length ? `<div class="mdetail"><dl>${rows.join('')}</dl></div>` : ''}
  </div>`;
}

function redrawMap() {
  const tree = buildMapTree();
  const list = flatten(tree, []);
  const liveIds = new Set(list.map(b => b.id));
  const boxesEl = document.getElementById('mapBoxes');

  // remove stale elements
  for (const [id, el] of [...mapEls.entries()]) {
    if (!liveIds.has(id)) { el.remove(); mapEls.delete(id); }
  }
  // create/update elements — a pure write pass. Content, classes and (via
  // CSS) width are all settled here but nothing is measured yet, so this
  // loop never forces a synchronous layout.
  list.forEach(box => {
    let el = mapEls.get(box.id);
    if (!el) {
      const tmp = document.createElement('div');
      tmp.innerHTML = mboxHTML(box);
      el = tmp.firstElementChild;
      boxesEl.appendChild(el);
      mapEls.set(box.id, el);
    } else {
      const tmp = document.createElement('div');
      tmp.innerHTML = mboxHTML(box);
      const fresh = tmp.firstElementChild;
      el.className = fresh.className;
      el.innerHTML = fresh.innerHTML;
    }
    box.el = el;
  });

  // Measure once, in its own pass, after every box has its final content —
  // batching these reads separately from the writes above (and before any
  // positioning writes below) avoids interleaved read/write layout thrash.
  // Width is no longer a shared constant: each box is sized by CSS
  // (width:max-content, clamped per box type/state) and read back here via
  // offsetWidth, the same way offsetHeight already drives row heights.
  list.forEach(box => {
    box.h = box.el.offsetHeight;
    box.w = box.el.offsetWidth;
  });

  // layout: x is derived per-branch from each box's own measured width —
  // a domain's leaf column begins after that *specific* domain box's edge
  // plus a fixed gap, not a shared column constant, so branches with wider
  // or narrower boxes don't force every other branch to match. y is an
  // independent top-down cursor per side so left and right each pack
  // tightly instead of one side inheriting the other's spacing. Root x is
  // fixed at 0 (or its left edge at 0 in single-sided fallback); leaves
  // stagger every second box outward by the fixed STAGGER_X (right on the
  // right side, left on the left side) so neighbouring boxes interlock.
  const rootL = tree.twoSided ? -tree.w / 2 : 0;
  const rootR = tree.twoSided ? tree.w / 2 : tree.w;

  function assignX(box, parent) {
    if (box.type === 'root') {
      box.x = rootL;
    } else if (box.type === 'domain') {
      box.x = box.side === 1 ? rootR + DOMAIN_GAP : rootL - DOMAIN_GAP - box.w;
    } else {
      // leaf: column anchored off this leaf's own domain parent's measured
      // edge, then mirrored — on the left side a box extends leftward, so
      // its x (left edge) has to be pulled back by its own measured width.
      box.x = box.side === 1
        ? parent.x + parent.w + LEAF_GAP
        : parent.x - LEAF_GAP - box.w;
    }
    box.children.forEach(c => assignX(c, box));
  }
  assignX(tree, null);

  let cursorRight = 0, cursorLeft = 0;
  function assignY(box) {
    if (!box.children.length) {
      if (box.side === -1) { box.y = cursorLeft; cursorLeft += box.h + GAP_Y; }
      else { box.y = cursorRight; cursorRight += box.h + GAP_Y; }
      return;
    }
    box.children.forEach(assignY);
    box.children.forEach((c, i) => {
      if (c.type === 'leaf' && i % 2 === 1) c.x += c.side === 1 ? STAGGER_X : -STAGGER_X;
    });
    if (box.type === 'domain') {
      const first = box.children[0], last = box.children[box.children.length - 1];
      box.y = (first.y + first.h / 2 + last.y + last.h / 2) / 2 - box.h / 2;
    }
  }
  assignY(tree);
  // root sits vertically centred relative to the whole tree (both sides)
  {
    let minY = Infinity, maxY = -Infinity;
    tree.children.forEach(dom => {
      minY = Math.min(minY, dom.y);
      maxY = Math.max(maxY, dom.y + dom.h);
    });
    if (minY === Infinity) { minY = 0; maxY = tree.h; }
    tree.y = (minY + maxY) / 2 - tree.h / 2;
  }

  list.forEach(box => {
    box.el.style.transform = `translate(${box.x}px, ${box.y}px)`;
  });

  // connectors: a right-side edge leaves the parent's right edge and
  // terminates on the child's left edge; a left-side edge is the mirror —
  // parent's left edge to the child's right edge — bezier controls mirrored.
  const svg = document.getElementById('mapSvg');
  let paths = '';
  function edges(box) {
    box.children.forEach(c => {
      const y1 = box.y + box.h / 2, y2 = c.y + c.h / 2;
      let x1, x2;
      if (c.side === 1) { x1 = box.x + box.w; x2 = c.x; }
      else { x1 = box.x; x2 = c.x + c.w; }
      const mx = (x1 + x2) / 2;
      const edgeClass = c.depth === 1 ? 'edge-domain' : 'edge-leaf';
      paths += `<path class="${edgeClass}" d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"></path>`;
      edges(c);
    });
  }
  edges(tree);
  svg.innerHTML = paths;

  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  list.forEach(b => {
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y + b.h);
  });
  svg.setAttribute('width', maxX - minX + 40);
  svg.setAttribute('height', maxY - minY + 40);

  // on first paint (and after "reset view") centre the root in the viewport
  if (needsCenter) {
    const rect = document.getElementById('mapwrap').getBoundingClientRect();
    zoom = 1;
    panX = rect.width / 2 - (tree.x + tree.w / 2);
    panY = rect.height / 2 - (tree.y + tree.h / 2);
    needsCenter = false;
  }

  applyPanZoom();
}

function applyPanZoom() {
  document.getElementById('mapPanZoom').style.transform =
    `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

document.getElementById('mapBoxes').addEventListener('click', e => {
  // A verse pill lives inside a leaf box, and this listener sits on an
  // ancestor of it — so it runs BEFORE the document-level .refchip handler.
  // Without this bail-out the box toggles shut, redrawMap() tears the pill
  // out of the DOM, and the popover then measures a detached element and
  // lands at 0,0. Let the pill (and its popover) own their own clicks.
  if (e.target.closest('.refchip') || e.target.closest('.versepop')) return;
  const box = e.target.closest('.mbox');
  if (!box) return;
  const id = box.dataset.id;
  if (id === 'root') return;
  if (id.startsWith('domain:')) {
    if (mapManualCollapsed.has(id)) mapManualCollapsed.delete(id); else mapManualCollapsed.add(id);
  } else {
    if (mapDetailOpen.has(id)) mapDetailOpen.delete(id); else mapDetailOpen.add(id);
  }
  redrawMap();
});

// pan + zoom — unified pointer events so mouse drag and one-finger touch
// drag share one code path; a second touch pointer switches to pinch-zoom
// anchored on the pinch midpoint. A small movement threshold keeps a tap
// on the background from being mistaken for the start of a drag (taps that
// land on a box are ignored here entirely and reach the .mbox click
// handler below untouched).
(function () {
  const wrap = document.getElementById('mapwrap');
  const DRAG_THRESHOLD = 6;
  const pointers = new Map(); // pointerId -> {x,y}
  let dragging = false, moved = false;
  let startX = 0, startY = 0, lastX = 0, lastY = 0;
  let pinchStartDist = 0, pinchStartZoom = 1;

  function zoomAt(mx, my, newZoom) {
    newZoom = Math.min(2.5, Math.max(0.3, newZoom));
    const cx = (mx - panX) / zoom, cy = (my - panY) / zoom;
    panX = mx - cx * newZoom;
    panY = my - cy * newZoom;
    zoom = newZoom;
  }

  function pinchGeometry() {
    const pts = [...pointers.values()];
    return {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
      mx: (pts[0].x + pts[1].x) / 2,
      my: (pts[0].y + pts[1].y) / 2,
    };
  }

  wrap.addEventListener('pointerdown', e => {
    if (e.target.closest('.mbox') || e.target.closest('.mapcontrols')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    if (pointers.size === 1) {
      dragging = true; moved = false;
      startX = lastX = e.clientX; startY = lastY = e.clientY;
      wrap.classList.add('dragging');
    } else if (pointers.size === 2) {
      dragging = false;
      const g = pinchGeometry();
      pinchStartDist = g.dist;
      pinchStartZoom = zoom;
    }
  });

  wrap.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2) {
      if (pinchStartDist <= 0) return;
      const rect = wrap.getBoundingClientRect();
      const g = pinchGeometry();
      const newZoom = pinchStartZoom * (g.dist / pinchStartDist);
      zoomAt(g.mx - rect.left, g.my - rect.top, newZoom);
      applyPanZoom();
      return;
    }

    if (!dragging) return;
    if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
    moved = true;
    panX += e.clientX - lastX; panY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    applyPanZoom();
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStartDist = 0;
    if (pointers.size === 0) {
      dragging = false; wrap.classList.remove('dragging');
    } else if (pointers.size === 1) {
      const [[, p]] = pointers;
      dragging = true; moved = true; lastX = p.x; lastY = p.y;
    }
  }
  wrap.addEventListener('pointerup', endPointer);
  wrap.addEventListener('pointercancel', endPointer);

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    if (Math.min(2.5, Math.max(0.3, zoom + delta)) === zoom) return;
    const rect = wrap.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, zoom + delta);
    applyPanZoom();
  }, { passive: false });
})();

document.getElementById('mapReset').addEventListener('click', () => {
  needsCenter = true;
  redrawMap();
});

window.addEventListener('resize', () => {
  closePopover();
  // Box widths are vw-clamped in CSS and re-measured from the DOM on every
  // redraw, so a resize just needs to trigger that redraw (also re-checks
  // the two-sided vs. phone single-sided breakpoint).
  if (view === 'map') redrawMap();
});

// -------------------------------------------------------------- print
let preprintView = null;
window.addEventListener('beforeprint', () => {
  preprintView = view;
  switchView('domain');
  document.querySelectorAll('#out .group').forEach(sec => sec.classList.add('expanded'));
  expandedGroups = new Set([...expandedGroups, ...[...document.querySelectorAll('#out .group')].map(s => s.dataset.key)]);
  render();
  document.querySelectorAll('#out .group').forEach(sec => sec.classList.add('expanded'));
});
window.addEventListener('afterprint', () => {
  if (preprintView) { switchView(preprintView); render(); preprintView = null; }
});

render();
</script>
</body>
</html>
""".replace("__DATA__", payload)


# ----------------------------------------------------------------------------- MM


def render_mm(nodes: list[dict]) -> str:
    """Freeplane / XMind compatible mind map."""

    def note(n: dict) -> str:
        bits = []
        if n["hold"]:
            bits.append("HOLD: " + n["hold"])
        if n["why"]:
            bits.append("WHY: " + n["why"])
        if n["vs"]:
            bits.append("NOT: " + n["vs"])
        if n["todo"]:
            bits.append("STUDY: " + n["todo"])
        if n["refs"]:
            bits.append("TEXTS: " + n["refs"])
        if not bits:
            return ""
        body = "".join(f"<p>{esc(b)}</p>" for b in bits)
        return (
            '<richcontent TYPE="NOTE"><html><head></head><body>'
            f"{body}</body></html></richcontent>"
        )

    out = ['<map version="freeplane 1.9.0">', '<node TEXT="My Theology">']
    domains = []
    for n in nodes:
        if n["domain"] not in domains:
            domains.append(n["domain"])

    for i, domain in enumerate(domains):
        pos = "right" if i % 2 == 0 else "left"
        out.append(f'<node TEXT="{esc(domain)}" POSITION="{pos}" FOLDED="true">')
        for n in [x for x in nodes if x["domain"] == domain]:
            colour = TIER_META.get(n["tier"], (None, "#57534e"))[1]
            label = n["title"]
            suffix = []
            if n["tier"]:
                suffix.append(n["tier"])
            if n["confidence"]:
                suffix.append(n["confidence"])
            if "study" in n["flags"]:
                suffix.append("study")
            if "assumed" in n["flags"]:
                suffix.append("inferred")
            if suffix:
                label += "  [" + " · ".join(suffix) + "]"
            style = 'STYLE="fork"'
            out.append(f'<node TEXT="{esc(label)}" COLOR="{colour}" {style}>')
            body = note(n)
            if body:
                out.append(body)
            out.append("</node>")
        out.append("</node>")

    out.append("</node>")
    out.append("</map>")
    return "\n".join(out)


# ----------------------------------------------------------------------- STUDY LIST


def render_study(nodes: list[dict], missing_refs: list[str]) -> str:
    lines = [
        "# Study list",
        "",
        "_Generated by `render.py` from every node flagged `#study`. Do not edit "
        "this file — edit `theology-map.md` and re-run the build._",
        "",
    ]

    study = [n for n in nodes if "study" in n["flags"]]
    by_domain: dict[str, list[dict]] = {}
    for n in study:
        by_domain.setdefault(n["domain"], []).append(n)

    lines += [f"## Open questions ({len(study)})", ""]
    for domain, items in by_domain.items():
        lines.append(f"### {domain}")
        for n in items:
            conf = f" _{n['confidence']}_" if n["confidence"] else ""
            tier = f"`{n['tier']}` " if n["tier"] else ""
            lines.append(f"- **{n['title']}** {tier}{conf}")
            if n["hold"]:
                lines.append(f"  - Currently: {n['hold']}")
            if n["todo"]:
                lines.append(f"  - To do: {n['todo']}")
        lines.append("")

    unmarked = [n for n in nodes if "assumed" in n["flags"]]
    lines += [
        f"## Inferred, awaiting your confirmation ({len(unmarked)})",
        "",
        "These were filled in from the positions you did state. Correct or delete "
        "them in `theology-map.md`, then remove the `#assumed` flag.",
        "",
    ]
    for n in unmarked:
        lines.append(f"- {n['domain']} → **{n['title']}** — {n['hold'] or '(no position set)'}")
    lines.append("")

    lines += [
        f"## Scripture text still needed ({len(missing_refs)})",
        "",
        "References used somewhere in the map that have no text yet in "
        "`verses.md`. Fill these in with the NET Bible wording — leave any "
        "you're not confident of blank rather than guessing.",
        "",
    ]
    if missing_refs:
        lines += [f"- {r}" for r in missing_refs]
    else:
        lines.append("_None — every reference in use has text._")
    lines.append("")

    return "\n".join(lines)


def main() -> None:
    nodes = parse(SRC)
    verses = sync_verses(nodes)
    used_refs = collect_refs(nodes)
    missing_text = [r for r in used_refs if not verses.get(r, "").strip()]

    BUILD.mkdir(exist_ok=True)
    DOCS.mkdir(exist_ok=True)
    (BUILD / "theology-map.html").write_text(render_html(nodes, verses), encoding="utf-8")
    (DOCS / "theology-map.mm").write_text(render_mm(nodes), encoding="utf-8")
    (DOCS / "study-list.md").write_text(render_study(nodes, missing_text), encoding="utf-8")

    study = [n for n in nodes if "study" in n["flags"]]
    assumed = [n for n in nodes if "assumed" in n["flags"]]
    domains = {n["domain"] for n in nodes}
    print(f"{len(nodes)} nodes across {len(domains)} domains")
    print(f"  {len(study)} flagged #study, {len(assumed)} inferred (#assumed)")
    print(f"  {len(used_refs)} scripture references in use, {len(missing_text)} still without text")
    missing = [n["slug"] for n in nodes for l in n["link"]
               if l not in {x["slug"] for x in nodes}]
    if missing:
        print(f"  WARNING broken links from: {sorted(set(missing))}")
    print("wrote theology-map.html, documentation/theology-map.mm, documentation/study-list.md")


if __name__ == "__main__":
    main()
