# Project 12 — Theology Mind Map

A mind map of Thomas's theological positions, organised by Gavin Ortlund's
theological triage (*Finding the Right Hills to Die On*).

## The one rule

**`theology-map.md` holds the content and is what you edit.**
`theology-map.html`, `documentation/theology-map.mm` and
`documentation/study-list.md` are generated — never hand-edit them, they are
overwritten on every run. `documentation/verses.md` is a second source file,
but it is mostly machine-filled (below).

## Folder layout (flattened 2026-08-12, engine/ and documentation/ split out 2026-08-12)

Root holds only what a non-technical user needs to click: `theology-map.html`
(the map) and `start_editor.bat` (launches the editor), plus the one file you
hand-edit, `theology-map.md`. Everything else is sorted into two subfolders:

- `documentation/` — `README.md` (usage instructions), `verses.md` (source
  data, mostly machine-filled), and the two secondary generated outputs
  `theology-map.mm` / `study-list.md`.
- `engine/` — `render.py`, `fetch_verses.py`, `render_server.py`,
  `editor.html`, `editor-core.js`, `map-view.js`, `shared-fields.js`. Not
  meant to be opened directly.

`render.py` and `fetch_verses.py` resolve `ROOT` as
`Path(__file__).parent.parent` (one level up from `engine/`) and read/write
`documentation/verses.md` via a `DOCS = ROOT / "documentation"` constant —
`theology-map.md` and `theology-map.html` stay at `ROOT` directly since one
is hand-edited and the other is meant to be double-clicked.

```
python engine/render.py         # build everything
python engine/fetch_verses.py   # fill any blank verse text (needs network)
```

`render.py` writes `theology-map.html`, `documentation/theology-map.mm` and
`documentation/study-list.md`. Standard library only, no installs. It prints
node counts, scripture-reference counts, and warns on broken `link` targets —
a broken link means the slug doesn't match any node title.

Because GitHub auto-renders whichever `README.md` sits at the repo root as
the landing page, moving it into `documentation/` means the GitHub repo page
no longer shows it automatically — only relevant if that mattered to you.

## Editing via the browser form

Double-clicking `start_editor.bat` starts `engine/render_server.py` and
opens `engine/editor.html` for `theology-map.md`. `theology-map.html`'s
header also carries a direct "Edit ✎" link to it. It's a separate
hand-written page, not part of `render.py`'s generated output, so editing it
doesn't risk the ~1300-line generator. Loading a file shows two tabs, both
editing the same live in-memory model so switching tabs never loses work:

- **Map** (default) — the same node-link pan/zoom layout as
  `theology-map.html`'s Map view. Collapsed leaf tiles render exactly like
  the read-only public Map view (plain title + tier/confidence/`#study`
  chips) — a domain that's merely expanded still looks like the ordinary
  map until a doctrine itself is dropped down. Only an open leaf switches to
  editable controls (title, tier, confidence, flags, hold/why/vs/todo, refs,
  links); the Texts field shows a placeholder demonstrating the
  semicolon-separated format. Each domain box has a small edit (✎) button
  to rename it in place. "+ New node"/"+ New domain" tiles use inverted
  (ink-on-paper) colouring so they read as clearly distinct actions, and
  each open leaf has a delete link.
- **List** — the original structured form: pick a node in the sidebar tree,
  edit its fields, add/delete nodes and domains.

A toolbar indicator ("N nodes edited, N created, N deleted", any zero terms
omitted) tracks changes across both tabs and resets on save; a node created
and then deleted before saving nets to zero rather than counting as deleted.

- `editor-core.js` is the parser/serializer, a JS port of `render.py`'s
  `parse()`/field logic kept in lockstep with it by hand. Round-trip fidelity
  (parse → serialize → re-parse gives an identical model) was verified against
  the live file during development — if you touch either the Python parser or
  this file, re-verify both stay in sync.
- `map-view.js` is the Map tab's layout/pan/zoom engine, a hand-ported copy
  of the Map-view JS embedded in `render.py`'s generated HTML (same
  lockstep-by-hand convention as `editor-core.js`) — if you touch the Map
  view in `render.py`, re-verify this file matches. Unlike `render.py`'s
  version it reads the editor's `domains` array directly (already grouped by
  real domain). Leaf tiles are keyed by a stable per-node id
  (not `n.slug`, which changes the moment a title is edited) so renaming an
  open tile doesn't collapse it.
- `shared-fields.js` holds the tag-chip link-editor widget used by both the
  List form and Map tiles, so there's one implementation to keep in sync
  rather than two.
- **Connect** (Chrome/Edge only, via the File System Access API) grants the
  page a write handle to `theology-map.md` directly — no server needed to
  read or save. **Upload a copy** is the fallback for any browser: it loads
  the file read-only, and you copy the regenerated text out (button in the
  editor) to paste back in by hand.
- **Save & render** POSTs to `render_server.py`, which chains
  `render.py` → `fetch_verses.py` → `render.py` again — rebuild, fetch text
  for any newly-added scripture refs, then rebuild once more so that text
  actually lands in the HTML — and reports success or failure back into the
  page. Without the server running, Save still writes the file — start
  `start_editor.bat` (or run `python engine/render_server.py` yourself) and
  click Save & render again, or just run `python engine/render.py` by hand.
  Save always rewrites the whole file regardless of which tab or how many
  edits were made — there's no per-tile autosave.
- A page button cannot launch a local process — browser sandboxing forbids
  it outright, for any site. `start_editor.bat` is the actual launcher;
  the editor can only detect whether the server is already running and say
  so.
- The editor does not support reordering domains; it's deliberately just
  add/edit/delete/rename, per the "very very very simple" brief it was built
  to. Domain rename (List tab: none yet; Map tab: the ✎ button) updates
  `domain.name` and each of its nodes' in-memory `.domain` field — that
  field is never serialized (the file format implies domain from section
  headers), so this is purely a display-consistency nicety, not something
  `theology-map.md`'s format requires.

## Node syntax

```
# Domain name

## Node title · T2 · confident · #study
  hold  The position held.
  why   One line of rationale.
  vs    The rival view rejected.
  todo  What still needs working out.
  refs  2 Tim 3:16-17; Heb 1:1-2
  link  slug-of-a-related-node
```

Every field is optional. Repeat `link` for multiple targets. Continuation lines
that don't start with a field keyword append to the previous field. Field order
in the file is conventionally hold → why → vs → todo → refs → link, though the
parser doesn't require it.

`refs` holds key scripture references, semicolon-separated, rendered as small
pills under a "Texts" label. Keep to one to four, and prefer the texts actually
argued over for that doctrine — including the ones the opposing view leans on —
rather than merely topical verses. Roughly 80 of the 99 nodes carry them;
method and history nodes (hermeneutics, translations, the creeds, the Fathers,
Pentecostal heritage) deliberately do not.

**Tier** — `T1`, `T1.5`, `T2`, `T2.5`, `T3`, `T4`. Half-steps are deliberate;
Thomas uses them where a doctrine genuinely sits between two of Ortlund's ranks
(free will/sovereignty and women in ministry are both T2.5).

**Confidence** — `certain`, `confident`, `leaning`, `open`, `rejected`. An
ordinal band, not a percentage. Renders as a filled bar. Confidence is
independent of `#study`: a position can be held confidently and still be under
active study.

**Flags** — `#study` (needs work), `#assumed` (inferred by Claude from stated
positions, not yet confirmed by Thomas — renders with a dashed border).

`#thread` (a cross-cutting-theme flag with its own Threads view) was removed
entirely in phase 0.5 of the hosting program (2026-08-18) — see
`docs/hosting/phase-0.5-outcome.md`. The parser, renderer, editor and
`map-view.js` no longer treat it specially; there are four views now, not
five. Thomas also confirmed, explicitly and with the tradeoff named to him,
that the three `#thread`-flagged nodes themselves should be deleted along
with the mechanism — they and their "Cross-cutting threads" domain heading no
longer exist in `theology-map.md`. Their text is recoverable from git history;
see the Working notes section below for the commit.

No node currently carries `#assumed` — Thomas worked through all 40 and either
confirmed, retiered or rewrote them (2026-08-11). The flag and its rendering
stay supported for the next round of inference.

Slugs are derived from the title: lowercased, apostrophes dropped, everything
else non-alphanumeric collapsed to hyphens. `The Lord's Supper` →
`the-lords-supper`.

## verses.md and the scripture popovers

Clicking a reference pill in the HTML opens a popover with the verse text.
That text lives in `verses.md`, one entry per reference:

```
## 2 Tim 3:16-17
Every scripture is inspired by God and useful for teaching, ...
```

The two scripts divide the work:

- `render.py` **syncs the reference list**. It collects every reference used
  across the map and appends an empty stub to `verses.md` for any it doesn't
  already find. It never overwrites or reorders existing text. It reports how
  many references are in use and how many still lack text, and lists the gaps
  in `build/study-list.md`.
- `fetch_verses.py` **fills the text**, querying Biblical Studies Press's free
  NET Bible endpoint (`labs.bible.org/api/`). By default it only fills blanks,
  so anything corrected by hand survives; `--all` re-fetches everything.

So the loop after adding references is: `python render.py` then
`python fetch_verses.py`. All 156 current references have text.

**Never write verse text from memory.** It comes out subtly wrong, which in a
theology reference is worse than a visible blank. Fetch it or leave it empty.

**A blank after fetching almost always means a bad reference, not a network
problem** — usually versification. The NET follows the critical text, so some
references drawn from a KJV-based source are off by one; `2 Cor 13:14` was
already caught and corrected to `13:13`. Check Psalms, 2 Corinthians and
Malachi in particular.

Translation choice is confined to `fetch_verses.py`. NET is used under its
permissive free-use policy; the attribution notice in `verses.md`'s header and
in the page footer must travel with the text.

## Outputs

| File | Purpose |
|---|---|
| `theology-map.html` | Four views — see below. Text filter, three-way study filter, hide-inferred toggle, expand-all / collapse-all. Theme-aware. Print stylesheet lays it out in two columns for A3. |
| `theology-map.mm` | Freeplane / XMind. Drag-editable — this is the endgame for hand-arranging the map. Field content lands in each node's Note. |
| `study-list.md` | Auto-generated: open questions by domain, then everything still marked `#assumed`, then any references still lacking verse text. |

The `.mm` is a one-way export. Rearranging it in Freeplane will not flow back
into `theology-map.md`, so do that only once the content is settled.

### The four HTML views

- **Map** (default) — a balanced node-link tree. The root sits in the middle
  with its 14 domains alternating right and left, matching the `.mm` export's
  convention; each side keeps its own vertical cursor so the two pack
  independently. Within each domain, leaves are ordered by tier (T1 down to
  T4, untiered last). Box widths are content-driven, not fixed: CSS sizes
  each box to its content (`width:max-content`, clamped) and the layout pass
  measures the result via `offsetWidth`, the same way it already measures
  heights via `offsetHeight`. Collapsed leaves clamp to roughly 150-320px;
  an expanded leaf's detail panel clamps to roughly 340-560px (a comfortable
  reading measure, hard-capped at 560px); domain boxes clamp to roughly
  140-240px. Every second leaf is staggered outward by half of its own
  measured width to tighten vertical packing. Click a box to expand it;
  click a leaf to open its detail in place. Drag or one-finger swipe to pan,
  wheel or pinch to zoom (cursor-anchored, clamped 0.3–2.5x), "reset view"
  to recentre on the root. Starts with only the
  root and the domain boxes showing. Below 860px it falls back to the
  single-sided left-to-right layout.
- **Domain** / **Tier** / **Confidence** — grouped card lists. Groups are
  collapsed by default and toggle on click. An active text filter auto-expands
  any group holding a match, without disturbing the stored collapse state.
  Cards within a Domain group are ordered by tier (T1 down to T4, untiered
  last), matching the Map view; within a tier, file order is preserved.

Expand-all and collapse-all drive both the map and the list groups. Printing
force-switches to the domain view with everything expanded, then restores
whatever view was on screen.

### Phone layout

Below 640px the view switcher and search stay on the top row and the secondary
controls (study filter, hide-inferred, expand/collapse) move behind a "Filters"
disclosure, collapsed by default; the kicker, subtitle and tier legend hide to
keep the sticky header short. Card field labels stack above their values below
560px. Map panning and pinch-zoom use pointer events with a 6px threshold so a
tap on a box still registers as a tap rather than a drag.

Design language, if you touch the CSS: warm paper-and-ink palette in both
themes, serif reserved for content and sans for chrome, prose capped at 58ch,
tier colours a garnet→slate warm-to-cool ramp chosen for WCAG AA contrast with
white chip text. Don't reintroduce traffic-light tier colours — the earlier
amber values failed contrast.

## Working notes

- Source conversation: 2026-08-10. Reference points Thomas named — International
  Network of Churches (his movement), Mike Winger, Gavin Ortlund.
- Originally roughly 35 nodes carried positions Thomas stated directly, with 40
  inferred and marked `#assumed`. He reviewed all of them on 2026-08-11, so
  every node is now his own stated position. 33 remain flagged `#study`.
- Write node text in Thomas's own voice — first person or neutral, never
  second person. The original draft addressed him as "you"/"yours"; he rewrote
  those, so don't reintroduce them.
- Before phase 0.5, three nodes (not five, despite an earlier version of this
  note) carried `#thread`: a sacramental instinct running against low-church
  defaults; the semantic range of "prophecy" and "God told me"; and a higher
  view of the great tradition than the movement usually carries. This was the
  most load-bearing writing in the map, and Thomas removed it anyway — told
  explicitly that it would be lost, he chose deletion over keeping it as inert
  data. Both the `#thread` mechanism and these three nodes (titles: "A
  sacramental instinct", "The vocabulary of hearing God", "A high view of the
  great tradition") were removed from `theology-map.md` in phase 0.5
  (2026-08-18). **Full text recoverable at commit `e4f7ba2748a06476d5562ddaf0c8778ea56a6fc8`**
  (`git show e4f7ba2748a06476d5562ddaf0c8778ea56a6fc8:theology-map.md`), the
  last commit where they still existed — see
  `docs/hosting/phase-0.5-outcome.md` for the full account, including why the
  two Molinism/trichotomy themes an earlier version of this note also named
  were never actually encoded as `#thread` nodes and so have no such recovery
  point.
- Two corrections worth preserving, because both are easy to re-introduce:
  Thomas's view of Christ's restrained power is **krypsis** (voluntary non-use),
  *not* ontological kenosis; and his answer on the unevangelised is the
  **Molinist** one (Craig's transworld damnation), not inclusivism.
