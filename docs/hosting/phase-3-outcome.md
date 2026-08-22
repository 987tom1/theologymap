# Phase 3 — outcome

**Design canvas (Task 0.5), for review on a phone:**
<https://claude.ai/code/artifact/fc55f8a7-d4d5-4e63-9ee2-19a56a96bb00>

Five artboards — first run (1400px and 360px, light and dark), the node editor
(open leaf and a new belief), the gallery (three cards plus the phone column, light
and dark), the editor at 360px, and `/view?name=` as a signed-out stranger sees it.
Every colour on it is an existing token plus the two this phase adds.

**Branch:** `phase-3-ui`. **Model:** Opus main thread, three Sonnet subagents.

> **This file is written across two sessions.** Session 7 ran Tasks 0–4 and merged
> them; session 8 runs Tasks 5–9 on the same branch and finishes this file. Anything
> below marked *(session 7)* is complete.

---

## Session 7 — Tasks 0–4

### What landed

| Task | Who | What |
|---|---|---|
| 0 — verification harness | main thread | round-trip, contrast and lockstep commands set up in the scratchpad; render baseline clean before any edit |
| 0.5 — design canvas | main thread | five artboards published; link above |
| 1 — `theme.css` + shared chrome | Sonnet | `engine/theme.css`, `web/chrome.js`, chrome mounted on the four `web/*.html` pages |
| 2 — node editor split | **main thread** | `hold` + tier + confidence promoted, the other five behind `<details class="optional">`, in **both** editing surfaces |
| 3 — editor responsive layout | Sonnet | *(filled in below)* |
| 4 — gallery counts | Sonnet | `node_count`, `open_count`, `tier_counts` derived server-side; `markdown` never in the body |

Commits, in order: `9d83f42` (Task 4), `ebea8f9` (Task 1), a one-commit follow-up
fix to Task 1 on the main thread, `1099987` (Task 2), and Task 3's.

### Three defects in the plan itself, found before they shipped

The plan is four days older than the code it describes, and three of its literal
code blocks were wrong against `main`. All three would have failed loudly rather
than silently, but two of them would have failed *in production only*.

1. **`parse_text()` returns a flat list of nodes, not domains.** Task 4's
   `map_stats` was drafted as `for domain in parse_text(md): for n in
   domain["nodes"]`. `engine/render.py:91` returns a flat `list[dict]`; each node
   carries its own `domain` string. Corrected to a single loop. The plan's own
   Step 1 told the session to confirm the shape first, and that instruction earned
   its place.

2. **Task 4's Step 3 still put `id` back in the gallery reply.** Its Step 1 carries
   phase 2's amendment saying not to, and then its Step 3 code block reads
   `{"id": row["id"], …}`. The amendment is right and the code block was a
   leftover; the response rows are `name`, `updated_at` and the three derived
   fields, and nothing else. This is exactly the seam phase 2's B1 was — a value
   one file publishes and another file trusts — and it survived one round of
   amendment because only the prose was amended.

3. **`web/chrome.js` was drafted as an IIFE reading `window.getUser`.**
   `web/session.js` is an ES module with named exports and puts nothing on
   `window`; every `web/*.html` page consumes it with
   `<script type="module"> import { … }`. Written as a module instead.

### Decisions I made for you

- **`vercel.json` gained a second `functions` entry.** `api/gallery.py` now imports
  `engine/render.py`, and Vercel bundles only what a function's own `includeFiles`
  names — so without
  `"api/gallery.py": { "includeFiles": "engine/render.py" }` the gallery would have
  returned a 500 in production while passing every local check. It takes
  `render.py` only, not `documentation/verses.md`; counting does not touch verse
  text. The plan's file table said `vercel.json` was unmodified this phase; it is
  modified, and no route was added.

- **`theme.css` declares the base tokens on `:where(:root)`, specificity 0.**
  The plan said `theme.css` must not restate `--bg`, `--ink`, `--serif` and the
  rest, because `editor.html`'s inline block owns them — but the four `web/*.html`
  pages define no tokens at all, so `.tm-card`, `.tm-note` and the chrome would
  have rendered against undefined variables there. `:where(:root)` supplies them to
  the pages that have none while losing to `editor.html`'s inline `:root` (0,1,0)
  whatever the load order. The two genuinely new tokens stay on plain `:root` so
  they win everywhere, and the stylesheet is still linked *after* the inline block
  so `--field-line` beats the `border` shorthand in the editor.

- **`body.tm-page` deliberately declares no `margin`.** It outranks each page's own
  inline `body` rule, so a `margin:0` there would have beaten `margin:40px auto`
  and stranded a 480px column against the left edge of the viewport until Tasks 5–7
  give those pages a real layout. Left out with a comment saying why.

- **The gloss tables live beside `_leafMetaEditable`, not at the top of
  `map-view.js`'s factory.** The plan's Step 1 puts them at the top; its own Step 5
  lockstep gate then rejects any hunk before line 179. Putting them immediately
  above `_leafMetaEditable` satisfies both, and every hunk in the file is inside the
  three functions `render.py` has no counterpart for.

- **`engine/shared-fields.js` got a two-line vocabulary fix**, which the plan does
  not list as a modified file. Its link field is rendered into *both* editing
  surfaces, and it read `Link — related node(s)` against design §2.2's **Related**,
  with a hint saying "another node's slug" against §2.2's rule that user-facing copy
  never says "node". Fixing it once in the shared file was smaller than relabelling
  it twice at the call sites, and it is not lockstep-bearing — `render.py` has no
  counterpart.

- **`.row.two` is deleted, not restyled.** Task 2 stacks Tier and Confidence, so the
  class has no users; Task 3's draft rule for it at ≤640px was dropped as dead CSS.

### Verification that gated the merge

| Check | Result |
|---|---|
| `py engine/render.py` → no diff on the three generated files | **PASS**, re-run after every task |
| Round trip: `parse → serialize → parse` over the real 99-node file | **PASS** — `domains 14 nodes 99`, models identical |
| Contrast script (spec §3.5) | **PASS** — `RESULT: all pass` (full output below) |
| Lockstep gate on `engine/map-view.js` | **PASS** — every hunk inside `_leafMetaEditable` (214–265) or `_leafDetail` (266–385); nothing in `_leafHeaderReadonly`, `_leafMetaReadonly`, `_mboxHTML`, `redraw`, `assignX/Y`, `edges` or `_bindPanZoom` |
| `MAP_TWO_SIDE_BREAK` | **PASS** — `860` in both `map-view.js` and `render.py`, unchanged |
| `engine/editor-core.js` and `engine/render.py` untouched | **PASS** — zero lines changed in either |
| `node --check` on `map-view.js`, `shared-fields.js`, `editor.html`'s inline IIFE | **PASS** |
| `py -m py_compile` on every `api/*.py` | **PASS** |
| `map_stats` over the real map | **PASS** — `node_count` 99, `open_count` 36, tier counts sum to 99 |
| `map_stats('')` and `map_stats(None)` | **PASS** — zeroes, no exception |
| No `markdown`, `pin` or `id` in a built gallery row | **PASS**, asserted locally |

### Production, after the merge

Branch previews have no database, so everything below ran against production once
the merge deployed.

| Check | Result |
|---|---|
| Credentials resolve (`POST /api/render {"user_id":"000…0"}`) | **PASS** — `404 unknown_user`, not `500 misconfigured` |
| `/api/gallery` returns the four new fields | **PASS** |
| Gallery body contains no `markdown`, no `pin`, no `id` | **PASS** — zero occurrences of each |
| `/engine/theme.css`, `/web/chrome.js`, `/web/session.js` all serve | **PASS** — 200, 4708 / 1346 / 3983 bytes |
| All six pages 200 signed out (`/`, `/app`, `/gallery`, `/admin`, `/view?name=`, `/edit`) | **PASS** |
| **Byte identity, hosted**: `POST /api/render` with the full 99-node map | **PASS** — `eaedf3e4…1a90`, phase 2's LF baseline exactly. The hashes did not move. |
| Local `start_editor.bat` chain, run not read | **PASS** — server up on 8420, editor + `theme.css` + all four scripts served, full `POST /api/render` chain ran, `git status` clean afterwards, no network call |

**One thing I could not prove, and it is now guarded instead.** `api/gallery.py`
imports `engine/render.py` as `render`, and `api/render.py` is a sibling module of
the same name on the same `sys.path`. If `includeFiles` ever fails to bundle
`engine/render.py`, that import silently binds the wrong module. There is no map on
production with a non-empty markdown to read a non-zero count back from, so the
happy path is unproven by observation. It is proven by construction instead:
`parse_text` is resolved **at import time**, so the wrong module would fail the
function outright rather than return zeros, and `/api/gallery` answers 200.

### The wrong turn I took, recorded because the next session will be tempted by it

`/api/gallery` reports `node_count: 0` for **Thomas**. I read that as a bug, spent
real time on it, and shipped a hardening commit whose message calls it a live
production failure. **It is not a bug.** Thomas's *hosted row* is an empty map.
`theology-map.md` on disk is his personal file and — non-negotiable 5 in Project
13's `CLAUDE.md` — is explicitly **not** user 1's row in the database. Confirmed by
rendering the stored map through `POST /api/render {"name":"Thomas"}` and counting
the nodes in the page's `<script id="data">` block: **zero**. The gallery is
telling the truth.

Two commits carry that mistake: `a6c9060`'s message describes a failure that never
shipped, and `a67e095` corrects the claim in `CLAUDE.md` without rewriting history.
The hardening itself is worth keeping — the sibling-module trap is real and
undefended — but the story attached to it was wrong.

**The general lesson, which is the same one phase 2 wrote down:** *check what the
system actually holds before concluding the code is wrong about it.* The gallery
will keep reporting zeroes until somebody saves a real map through `/edit`, and the
one map with 99 nodes in it lives on a disk the server has never seen.

#### Contrast script output

```
--- LIGHT ---
  text ink    on bg     = 14.66:1 AA
  text ink    on panel  = 15.98:1 AA
  text ink    on chip   = 13.06:1 AA
  text ink    on note   = 13.52:1 AA
  text muted  on bg     =  5.41:1 AA
  text muted  on panel  =  5.90:1 AA
  text muted  on chip   =  4.82:1 AA
  text muted  on note   =  4.99:1 AA
  text good   on panel  =  6.13:1 AA
  text bad    on panel  =  9.00:1 AA
  ui   field  on panel  =  3.68:1 AA
  ui   field  on bg     =  3.37:1 AA
  ui   field  on chip   =  3.01:1 AA
  ui   field  on note   =  3.11:1 AA
  ui   muted  on panel  =  5.90:1 AA
--- DARK ---
  text ink    on bg     = 14.79:1 AA
  text ink    on panel  = 13.53:1 AA
  text ink    on chip   = 12.85:1 AA
  text ink    on note   = 12.30:1 AA
  text muted  on bg     =  6.78:1 AA
  text muted  on panel  =  6.21:1 AA
  text muted  on chip   =  5.89:1 AA
  text muted  on note   =  5.64:1 AA
  text good   on panel  =  7.87:1 AA
  text bad    on panel  =  6.55:1 AA
  ui   field  on panel  =  3.53:1 AA
  ui   field  on bg     =  3.86:1 AA
  ui   field  on chip   =  3.35:1 AA
  ui   field  on note   =  3.21:1 AA
  ui   muted  on panel  =  6.21:1 AA
  tier #fff on T1    =  9.15:1 AA
  tier #fff on T1.5  =  6.81:1 AA
  tier #fff on T2    =  5.00:1 AA
  tier #fff on T2.5  =  5.77:1 AA
  tier #fff on T3    =  6.17:1 AA
  tier #fff on T4    =  8.16:1 AA
RESULT: all pass
```

### Thomas's own map, in the gallery's new numbers

`node_count` **99**, `open_count` **36**, `tier_counts` `{T1: 11, T1.5: 8, T2: 22,
T2.5: 19, T3: 37, T4: 2, untiered: 0}`. 36 rather than 33 because "open questions"
counts `#study`-flagged nodes **plus** nodes whose `confidence` is `open`,
deduplicated — the definition is in `phase-3-design.md` §7.1 and repeated as a
comment in `api/gallery.py`, because phase 6's compare screen must use the same one.

### The `editor.html` controller extraction — **not done, deliberately**

`phase-2-outcome.md` and `phase-2-review.md`'s Blue hat both recommend extracting
`engine/editor.html`'s ~900-line inline IIFE behind the existing adapter seam during
this phase, on the grounds that it holds the only code in the app that can destroy
someone's work and cannot be exercised without a browser. It was treated as a strong
recommendation, not a requirement, and it did not fit this window alongside Tasks
0–4.

Saying so plainly rather than half-doing it, as instructed. Two things worth knowing
before someone picks it up:

- **This session made it slightly easier, not harder.** `renderForm()` shrank into a
  promoted block plus a `<details>`, and the tier/confidence gloss tables are now
  named constants rather than inline literals. The autosave machinery — the four
  empty-save guards, `scheduleAutosave`, `flushAutosave`, `beaconFlush`, the
  conflict dialog — was **not touched at all** this phase, so `phase-2-review.md`'s
  B8 line-number map (L744–881) still reads true.
- **The value is testability, not tidiness.** The reason to do it is that
  `flushAutosave` and its guards could then be run under `node` the way
  `editor-core.js` already is, which is the only way this program will ever observe
  them — browser automation is forbidden program-wide. That argues for extracting
  *the autosave controller specifically*, not the whole IIFE.

### Known limits carried forward

- **The 200-row gallery ceiling is still unimplemented**, and phase 3 now makes it
  more expensive: `/api/gallery` parses every public map on every request. At a
  church-sized gallery that is milliseconds inside a function that already pays a
  cold start; past ~200 rows it needs a cached or denormalised count, which is a
  schema change and a separate decision. `api/gallery.py` still has no `limit`.
- **Cold start is unchanged and was not architected around**: ~0.2–0.9 s over the
  static baseline warm, ~1.5 s cold. The loading skeleton belongs to the gallery and
  first-run tasks in session 8.

---

## Session 8 — Tasks 5–9

*(to be written by the next session)*
