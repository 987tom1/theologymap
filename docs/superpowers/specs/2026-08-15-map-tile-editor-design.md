# Map tile editor — design

Date: 2026-08-15
Status: approved, ready for implementation plan

## Problem

`editor.html` currently offers one way to edit `theology-map.md`: a
structured form (the "List" tab) — pick a node from a tree in the sidebar,
edit its fields in a form on the right. This works but gives no sense of
where a node sits in the map's shape (domain, tier neighbours, which threads
run through it).

`theology-map.html` (generated, read-only) already has a "Map" view: a
node-link tree, pan/zoom, click-to-expand tiles showing full field detail.
Thomas wants that same visual layout available *inside the editor*, with the
expanded tiles directly editable — and wants it to be the default view after
loading a file, with the List form demoted to a second tab.

## Architecture & data flow

`editor.html` gains a tab switcher (Map | List) above the existing layout.
Both tabs operate on the exact same live `domains` array already held by
`editor.html`'s script — there is no second data model and no baked/generated
JSON. `MapView` (new) reads `domains` directly via a `getDomains()` accessor
and re-renders whenever it changes, whether the change came from a Map-tab
edit or a List-tab edit. Selecting a node in one tab's tree/list does not
need to sync selection state to the other tab; each tab keeps its own
open/selected state.

The map layout/pan/zoom engine (`buildMapTree`, `mboxHTML`→now editable,
`redrawMap`, the two-pass write-then-measure DOM sizing, `STAGGER_X`,
alternating left/right domain placement, `mapDetailOpen` /
`mapManualCollapsed` state, cursor-anchored zoom 0.3–2.5x) exists today only
embedded inside `render.py`'s Python string template — it's never been a
standalone file. It is hand-ported into a new `engine/map-view.js`, following
the same convention already established for `editor-core.js`: a duplicate,
not a shared/extracted single source, verified to match visually against
`theology-map.html`'s Map view at build time and re-verified any time either
copy changes. This mirrors the project's one existing precedent for this
exact problem (`editor-core.js` mirroring `render.py`'s parser) rather than
introducing a new pattern.

`map-view.js` exports a constructor, e.g. `MapView(container, { getDomains,
onChange, tierMeta, confMeta })`, mounted once into the Map tab's container
div. `tierMeta`/`confMeta` are copied from `render.py`'s `TIER_META`/
`CONF_META` dicts as a small JS constant (same values, same convention as
`editor-core.js`'s `TIERS`/`CONFIDENCES` arrays — hand-kept in sync, not
generated).

Field editing controls on an expanded tile (see below) reuse `editor-core.js`
directly for `newNode()`, `slugify()`, and the `TIERS`/`CONFIDENCES`
constants — no duplication of that logic. The tag-chip link editor currently
built inline inside `editor.html`'s form-rendering code is extracted into a
small shared helper (e.g. `renderLinkField(node, allSlugs, onChange)`) so
both tabs call the same implementation rather than maintaining two copies of
a non-trivial widget.

## Tabs, default view, and toolbar

On load (Connect or Upload), the editor switches to the Map tab
automatically — this is the new default. The List tab remains fully
functional and is one click away; switching tabs does not lose in-progress
edits since both read/write the same `domains` array. The existing
Save / Save & render buttons, status line, and `beforeunload` dirty guard
move into a toolbar shared by both tabs (not duplicated per-tab).

## Change-tracking indicator

Three pieces of state, reset on successful save:

- `editedNodes` — a `Set` of node references, added to whenever any field on
  an existing node changes (either tab).
- `createdNodes` — a `Set` of node references created this session (via
  "+ New node" in either tab).
- `deletedCount` — a counter, incremented on any node deletion.

Reconciliation rule: if a node in `createdNodes` is later deleted before
save, it's removed from `createdNodes` and does *not* increment
`deletedCount` (net zero — it never existed in the saved file). If a node in
`editedNodes` is deleted, it's removed from `editedNodes` and does increment
`deletedCount` (it existed, now it's gone).

Domain creation/deletion folds into the same counts rather than getting a
separate tally — a "domain" is really just a container, and the interesting
unit for Thomas is nodes.

Toolbar text (built from whichever counts are non-zero, comma-joined,
omitting zero terms): `"3 nodes edited, 1 created, 0 deleted"` →
`"3 nodes edited, 1 created"`. When nothing has changed, the toolbar shows
the existing "No changes" idle state rather than "0 edited, 0 created,
0 deleted".

`touch()` (currently no-argument) changes signature to `touch(node)` so it
can add `node` to `editedNodes`; call sites across both tabs are updated to
pass the node being edited. New-node and delete flows call the counter
updates directly rather than through `touch()`.

## Save & deploy model

One shared pipeline regardless of which tab was used or how many edits were
made: **Save** serializes the full `domains` array back to text
(`editor-core.js`'s `serialize()`) and writes the whole file — never a
per-node patch. **Save & render** does that, then POSTs to
`render_server.py` to rebuild `theology-map.html` and the other generated
outputs. This holds identically for a single new doctrine, a handful of
edits, or a heavy editing session — there's no batching or per-tile
autosave; autosave was considered and rejected as unnecessary complexity that
also wouldn't work in read-only Upload mode (no write handle to autosave to).
The existing `beforeunload` guard remains the only loss-prevention
mechanism; the new toolbar indicator supplements it by making the size of
unsaved work legible before that guard would ever fire.

## Tile edit-mode UI

Expanding a leaf tile (click, same trigger as today's read-only expand) puts
it directly into edit mode — there is no separate "view" vs "edit" state for
an expanded tile in the Map tab. Layout, in field order matching the List
form and the file's own field convention:

```
┌─────────────────────────────────────┐
│ [title text input.......] [T2▾][conf▾]
│ ☐ study   ☐ thread                    │
│ Hold  [textarea, auto-grow.........]  │
│ Why   [textarea..................]    │
│ Vs    [textarea..................]    │
│ Study [textarea..................]    │  (todo field, labelled "Study" per List form)
│ Texts [2 Tim 3:16-17; Heb 1:1-2....]  │  (refs, plain text input)
│ Link  (chip) (chip) [add slug +]      │
│                                        │
│ Delete this node                      │
└─────────────────────────────────────┘
```

- Title: borderless text input, styled to read as the existing bold tile
  heading; underline appears only on focus.
- Tier / confidence: small `<select>` elements styled as the existing chips.
- Flags: checkboxes beside their existing chip labels (`study`, `thread`).
- Hold / why / vs / todo: auto-growing `<textarea>`s replacing today's
  read-only `<dl>` rows.
- Refs: plain text input, semicolon-separated — matches the List form
  exactly; pill rendering stays exclusive to the public read-only map.
- Link: the shared `renderLinkField` helper (tag chips + datalist of
  `allSlugs(domains)`), identical widget to the List form.
- No new palette or type choices — everything above reuses the tokens
  already documented in Project 12's CLAUDE.md (warm paper-and-ink, serif
  content / sans chrome, tier ramp).

Because `redrawMap()` already re-measures each box's `offsetWidth`/
`offsetHeight` after render (it has to, since collapsed vs. expanded tiles
already differ in height today), a textarea growing taller triggers the same
existing reflow path — no new layout logic is needed for edit mode
specifically.

## Add / delete flows on the Map tab

**New node:** each domain box gets a dashed-border tile appended after its
last leaf, labelled "+ New node". Clicking calls `editor-core.js`'s
`newNode()`, appends it to that domain, and opens it immediately in the same
expanded/editable state described above.

**New domain:** a dashed-border box appended at the root level (peer to the
existing domain boxes), labelled "+ New domain". Clicking uses the same
`prompt()`-based name entry the List tab already uses (kept deliberately
plain and consistent across tabs rather than building a nicer modal for a
rare action), then adds the new domain box, collapsed, ready for its own
"+ New node".

**Delete:** a plain text link, "Delete this node", at the bottom of the
expanded tile. Reuses the existing `dlgConfirm` confirmation dialog the List
tab already uses — same copy, same behavior, just triggered from the tile
instead of the form.

## Testing

No automated test suite exists for the editor (it's DOM-driven, hand-verified
by design, matching the project's existing convention). Verification is
manual: round-trip a real edit through both tabs, confirm `theology-map.md`
serializes identically regardless of which tab made the change, and visually
compare the Map tab's layout against `theology-map.html`'s Map view to
confirm the ported `map-view.js` matches. This mirrors how `editor-core.js`
was verified against `render.py`'s parser during its own development.
