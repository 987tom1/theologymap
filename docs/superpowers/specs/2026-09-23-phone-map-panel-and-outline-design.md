# Map + panel, list as outline — design

**Date:** 2026-09-23 · **Status:** draft, awaiting Thomas's review
**Wireframes:** https://claude.ai/artifact/NmWaW6Jokf5CszYQhDFgqs (options A and E)

## Goal

On a phone the Map view is a one-sided tree panned by thumb, and an opened belief's
detail panel (340–560px) is wider than the screen. Fix it so that **phone and desktop
behave the same way**, differing only in where things dock:

- **Map views become option E — the map plus a detail panel.** A belief never expands
  inside the canvas. Selecting one highlights its tile and shows its detail in a panel:
  a bottom sheet below 640px, a right-side panel at 640px and up. Applies everywhere
  `engine/map-view.js` runs: `/thomas`, `/view` (framed), `theology-map.html` offline, and
  the editor's Map tab.
- **List views become option A — the outline.** Areas fold; inside an area each belief is
  one compact row (tier chip, title, confidence, study dot) on a branch line, and a belief
  opens in place, full width. Applies to the generated page's Domain / Tier / Confidence
  views and to the editor's List tab.

Decided by Thomas 2026-09-23: the panel replaces in-canvas expansion **on desktop too**
(consistency and simpler code over side-by-side open tiles).

## Non-goals

- The compare colour layer on `/view` (wireframe E's Browse frame). A later spec.
- Drag-to-resize the bottom sheet, and drawn related-link curves on the canvas. Deferred —
  see "Deferred".
- Options B, C, D.
- Any change to parsing, serialisation, content, or the `<script id="data">` payload.

## Invariants this must keep

- Offline still works: `theology-map.html` stays one self-contained file, `start_editor.bat`
  unchanged. No new dependency, no CDN.
- Byte-identity gate (§1): `render_markdown`'s output **will move** — licensed, presentation
  only. `documentation/study-list.md` and the `<script id="data">` payload must stay
  byte-identical. Update the recorded hash pair **in the commit that moves it**.
- `map-view.js` stays the one map engine (§8). The map's CSS is still forked between
  `render.py`'s embedded `<style>` and `editor.html`'s — panel CSS goes in both.
- Field labels, promoted-vs-optional field order, real radio inputs for tier/confidence,
  `pruneLinks` before serialise, autosave — untouched.
- 44px coarse-pointer floors must win on specificity (§7 CSS). New tappable rows and the
  panel's close button are checked against that rule.

---

## Part 1 — Map + panel (option E)

### Engine: `engine/map-view.js`

**Selection replaces the open set.** `mapDetailOpen` (a Set — many open tiles) becomes
`selectedId` (one leaf id or `null`). Leaf tiles always render closed: title + chips. The
selected tile gets class `msel` (inked border, tier left edge kept) and its parent edge is
drawn in `--ink` instead of the faded tier colour.

Consequences, all simplifications:
- Leaf tile sizes never change on interaction, so the `<details>` toggle → `redraw()` hack
  (design 6.3) and the "open tile overlaps" class of bug go away.
- Editable leaves no longer need `_mountLeaf`/`_updateLeaf` focus preservation — closed
  tiles hold no controls. Both consumers' leaves take the string path. The editor's leaf is
  `_leafHeaderReadonly` + `_leafMetaReadonly` rendered to a string by a default `leafHTML`.

**The panel.** One `<aside class="map-panel">` appended to the MapView container, a
sibling of `.map-panzoom` (so it does not pan or zoom). Hidden when nothing is selected.

| Width | Dock | Size |
|---|---|---|
| < 640px | bottom sheet, full width, rounded top, grab bar | `max-height: 60%` of the wrap, scrolls inside |
| ≥ 640px | right side, full wrap height | `width: min(400px, 40%)`, scrolls inside |

Pure CSS media query on the container's own classes; the engine does not branch on width
for docking. Header row: title, tier chip, confidence, study chip, and a **Close** button
(`aria-label="Close"`, 44px under coarse pointer). `role="region"`,
`aria-label` = the belief's title.

Panel body comes from the consumer:
- **Read-only** (`render.py`): a new option `panelHTML(n)` returning markup. `render.py`
  builds it from the existing `detailRows(n)` plus a **Related** row of
  `<a data-goto="slug">` links — the same row `card()` already builds (so extract it to one
  `relatedRow(n)` helper both call).
- **Editor**: no option; the engine mounts `_leafHeaderEditable(n)` + `_leafDetail(n)` into
  the panel — the exact controls an open tile holds today, same order, same wording. The
  delete button stays at the bottom.

The panel body is built **only when the selection changes**, never on `redraw()`. A redraw
(resize, tier change reordering tiles, an edit elsewhere) updates tiles and leaves the
panel's DOM alone, so a focused textarea keeps its caret. This replaces `_updateLeaf`'s
"already open and staying open" branch.

**Interaction.**
- Tap/click a leaf: select it (tap the selected leaf again, press Escape, or Close:
  deselect). Tapping empty canvas does **not** deselect — a pan starts on empty canvas and
  must not close the panel.
- Enter / Space on a focused leaf selects it (keyboard parity; arrow traversal from P10
  unchanged). **Selecting by keyboard moves focus to the panel's Close button**, because
  the panel comes after every tile in DOM order and Tab would otherwise walk the whole
  map to reach it. Closing the panel returns focus to the tile. Selecting by pointer does
  not move focus.
- On select, **reveal**: if the tile is outside the visible area — the wrap minus the
  panel's rect — pan (not zoom) the minimum distance to bring it inside with a 16px margin.
  The pan math is a pure exported function `revealPan(tile, view, pan)` → `{panX, panY}`,
  tested under node.
- Domain boxes still toggle collapse. Collapsing the selected leaf's area deselects it.

**Public API changes.**
- New `select(node)` — expands the node's area, selects it, redraws, reveals, builds the
  panel. Takes the node object, so leaf ids stay private.
- New `deselect()`.
- `expandAll(nodes)` — now opens every area (there is no longer "every belief open").
  Keeps its signature; `nodes` becomes unused but stays accepted so callers don't change.
  So the generated page's **Expand all** on the Map view now means "open every area".
- `collapseAll()` — collapses areas and deselects.
- `forgetNode(node)` — deselects if it was the selected node.
- Remove `onLeafToggle` (no caller passes it) and `mapDetailOpen`.
- `.maphint` copy: "Drag to pan · pinch or scroll to zoom · tap a belief to read it".

**New node from the map** (editor): `addnode` selects the new node and focuses its title
input in the panel (today it opens the tile). The `mbox-enter` Settle stays on the tile.

### Consumer: `engine/render.py` (generated page)

- Pass `panelHTML`; `mapLeafHTML` loses its `open` branch (`mdetail` never renders in a
  tile). Delete now-dead `.mbox-leaf.mopen` / `.mdetail` tile CSS; add panel CSS.
- `gotoNode(slug)` in Map view: call `mapView.select(node)` instead of switching to the
  Domain view. (Today a Related link on the map throws you out of the map.)
- Verse popovers (`.refchip`) work inside the panel — `positionPopover` already positions
  against the button; check it is not clipped by the panel's overflow (popover is appended
  to `body`, so it should not be).
- Print: panel `display:none` (map is already hidden in print).
- `sizeMap()` unchanged — the panel sits inside the wrap.
- `/view` framed/enlarged: the panel lives inside the iframe's own map wrap, so no `/view`
  change. Verify on iOS Safari (§7 "framed map").

### Consumer: `engine/editor.html` (Map tab)

- `applyOpenParam()` shrinks to: find node by slug → `mv.select(node)` → focus + select
  the panel's title input. The title-matching walk over `mapEls` goes away.
- `confirmDeleteNodeFromMap` unchanged in shape (`forgetNode` now deselects).
- Fullscreen (`editor-enlarged`) unchanged; panel inside the wrap follows it.
- Panel CSS added to the editor's `<style>` (the fork).

---

## Part 2 — Outline list, generated page (option A)

`render.py`'s `render()` card branch and `card()`.

- **Rows.** Inside an expanded group, each belief is a row button: tier chip, title, a
  confidence word, a study dot; `.dom` area label kept in Tier/Confidence views as today.
  Rows sit on a branch line (`border-left` on the group body, a short tick per row — CSS
  only). The row is the `<article class="node" id="slug">` header, so `id` anchors and
  `:target` keep working.
- **Open in place.** Tapping a row toggles that belief's `<dl>` (plus Related) below it.
  State: `expandedBeliefs` Set of slugs, beside `expandedGroups`. `aria-expanded` on the
  row button.
- **Tier-mix strip** on each Domain-view group header: a 4px bar of the group's tier
  proportions, visible open or closed. Not on Tier/Confidence groups (meaningless there).
- **Search** auto-expands groups with a match (today) **and** the matching beliefs, so a
  match on `hold` text is visible.
- **Expand all / Collapse all** open/close groups **and** beliefs. **Print** forces both
  open, as today's print forces groups.
- `gotoNode` in a card view: expand group + belief, scroll, flash (as today).

## Part 3 — Outline list, editor List tab (option A)

`engine/editor.html`. The sidebar-plus-form layout becomes one column (max-width 760px,
centred): search field on top, then the outline. The selected belief's form renders
**inline, directly under its row**, not in a separate pane.

- `renderTreeList` builds area `<details>` + belief rows as now, and inserts the persistent
  `formEl` (the existing `<main class="form">`, re-tagged `<div>`) after the active row.
- **`touch()` stops rebuilding the tree.** It updates the active row's title/tier text in
  place. A full `renderTreeList` runs only on structural change: select, add, delete,
  rename area, search. This is what keeps focus in the inline form while typing (moving a
  node that contains the focused element drops focus).
- `renderForm()` unchanged in content and order. The Back/Next bar (P12) stays, sticky to
  the viewport bottom while a form is open; Back/Next opens the neighbouring row's form
  inline and scrolls it into view.
- `+ New belief in <area>` stays as the last row of each area; `+ New area` at the end.
- The phone-only "All beliefs (N)" drawer (`.treedrawer`) is deleted — the outline is the
  page at every width. Its open-state carry-over logic goes with it.
- Empty state (nothing selected) is just the outline, no "Pick a belief on the left".
  **Every visible string in `editor.html`'s markup is the `file://` wording** (§5) — the
  hosted branch's rewrites are unaffected.

---

## Phasing

Each phase ships on its own: full test gate (§9), commit per task, push to `main`
(standing authorisation), browser walk on the live site.

1. **Map + panel** — Part 1. Moves the byte-identity hash.
2. **Generated outline** — Part 2. Moves it again.
3. **Editor outline** — Part 3. No `render.py` change.

## Testing

- `tests/map-view.test.js`: `revealPan` cases — tile already visible (no pan), tile left of
  / right of / under the bottom sheet / under the side panel, tile larger than the view
  (align top-left). Existing tests unchanged.
- Full §9 gate every phase; `py tests/check_generated_map.py`; byte-identity invariants
  (study-list, data payload) checked and the new pair recorded.
- Browser walk (Thomas, live), per phase, at 390px and ≥1280px: select / deselect / Escape
  / Related link / search / expand-collapse all / verse chip in panel / `/view` framed and
  Fullscreen on iPhone / `/edit?open=<slug>` / add node from map / type in panel while
  resizing / dark theme / reduced motion.

## Docs to update in the same phases

`CLAUDE.md` §4 (Map and card views, phone behaviour), §5 (editor tabs, `?open=`), §7
("map-view.js measures offsetHeight in a toggle handler" note, framed-map notes), §8
(engine options table: `panelHTML`, `select`, removed `onLeafToggle`), §1 hash pair.
`debug.md` if a new diagnostic rule is learned.

## Deferred (ponytail)

- Sheet drag-to-resize / snap points — fixed 60% max-height with inner scroll until it
  proves cramped.
- Drawn dashed curves to related beliefs on the canvas — Related is a list in the panel.
- Minimap — the existing Reset view button covers "where am I".
- Compare colour layer on `/view` — its own spec.
