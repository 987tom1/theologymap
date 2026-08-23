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

**Branch:** `phase-3-ui` (same one). **Model:** Opus main thread, two Sonnet
subagents. **Merged to `main`** with `--no-ff`; every gate below passed first.

### What landed

| Task | Who | What |
|---|---|---|
| 5 — gallery cards | Sonnet | `web/gallery.html`: rows → a `.tm-grid` of cards, tier-spread bar + the same counts as text, relative "Updated", empty/error states, trailing "Make your own map" card |
| 6 — first run | **main thread** | `web/first-run.js` (new) + `web/index.html` rebuilt into three states; `/edit?open=<slug>` deep link in `engine/editor.html` |
| 7 — sharing | Sonnet | `web/view.html`: Copy link, a primary "Make your own map" card under the map, phone-sized iframe |
| **8 — start from someone else's map** | **main thread — RUN, not skipped** | migration, `copy_from` action, provenance clearing, `started_from` on the gallery card, first-run card 2 live |
| — landing page | **main thread** | `web/landing.html` (new), `/` → it, `/thomas` → `theology-map.html`. A `decisions.md` scope increase the plan predates — see below |
| 9 — integration, docs, merge | main thread | one clipboard helper, phase 2's backlog, `CLAUDE.md`, this file, the merge |

Commits, in order: `c696e62` (Task 7), `5fe910d` (Task 5), `bf1411c` (Task 8
server side), `c9ae6a1` (Tasks 6+8 client side), `c826aef` (landing page),
`78380d5` (phase 2 backlog), `176b9bd` (one clipboard helper).

### Task 8 ran. The plan's "GATED. DO NOT START." is stale, and the plan says so about itself in the wrong place

`phase-3-plan.md`'s Task 8 header still reads **GATED. DO NOT START.**, and its
"Model assignment at a glance" table still reads **GATED on Q1**. Both are wrong as
of 2026-08-18. `decisions.md`, under *Amendments — 2026-08-18, after the phase 3
design review*, answers Q1 in Thomas's own words:

> **Copy provenance is two columns on `users`:** `copied_from uuid`, `copied_at
> timestamptz`. … **Phase 3 task 8 is unblocked.**

`run-order.md`'s "Before session 1" checklist says the same thing in as many words.
**Believe those two files over the plan.** The plan was not rewritten in place when
the decision landed — the same pattern `hosting-brief.md` uses — so a session that
reads only its assigned plan section will skip a task Thomas has already paid for.
Q2 is answered in the same amendment (provenance is visible to others, worded
*"Started from Sarah's map"*, and stops being shown once the copier has edited), so
nothing in Task 8 was left to guess.

**What it required, since this is the phase's only schema change:**

- `supabase/migrations/20260823120000_copied_from.sql` — `copied_from uuid
  references public.users(id) on delete set null`, `copied_at timestamptz`.
  Migrations deploy themselves on the merge push; **verify it landed** before
  trusting any of the below (`run-order.md`, "How the database actually gets
  changed"). This is the second of the program's two remaining migrations; the
  other is phase 4's `map_versions`.
- `api/map.py` gained `{action: "copy_from", user_id, source_name}`. It is keyed by
  **name**, not by row id, because the id authorises a save and `/api/gallery`
  deliberately does not publish it — the client has nothing but a name to offer.
  Four guards, all server-side: the caller must exist; the caller's map must be
  empty (`409 not_empty` — copying is a starting point, not an import); the source
  must exist; the source's `is_public` must be true (`403 not_public`).
- `api/map.py`'s save clears both columns **in the same PATCH** as the first
  divergent write, so there is no window in which the gallery says "started from
  Sarah's map" about work the person has already made theirs.
- `api/gallery.py` resolves `copied_from` to a name **from the rows it already
  fetched**, with no second round trip and no PostgREST self-join. A source that has
  since been unlisted is not in those rows and simply goes unnamed. `id` and
  `copied_from` are selected to be used, never published — every response item is
  built field by field from a literal dict, which is the discipline B1 cost us.

### The landing page — a scope increase that was Thomas's, not mine

`decisions.md` (2026-08-18, after the phase 3 design review):

> **`/` becomes a proper landing page** … This is a **scope increase on phase 3**
> and Thomas chose it knowingly. Constraint: links already shared point at `/`, …
> the landing page must keep his own map reachable at a stable URL and should link
> to it prominently rather than stranding those visitors.

`phase-3-design.md` §4.1 argues the opposite — leave `/` alone — and logs the
question as **Q4**. The design is older than the decision, `decisions.md` overrides
every brief and plan, and **session 8 is the last phase-3 session**, so it landed
here or nowhere. No task in the plan covers it; it is its own commit (`c826aef`).

- `/` → `web/landing.html`. What the tool is, in two paragraphs; a primary "Make
  your own map" card; a second card reading **Read Thomas's map**; a gallery link;
  and a `.tm-note` saying in as many words that if you followed a link here
  expecting Thomas's map, it is at `/thomas` and has not changed.
- `/thomas` → `theology-map.html`, unchanged and untouched. `render.py` is not
  modified, and `/theology-map.html` also still resolves, so nothing that pointed
  at the file itself broke.

**This is the one change in the phase a visitor will notice as a loss** — a shared
link now costs one extra click to reach Thomas's map. That is the cost
`decisions.md` priced and accepted. Reversing it is one line of `vercel.json`.

### Decisions I made for you

- **`web/first-run.js` is an ES module, not the IIFE the plan drafts.**
  `web/session.js` exports named bindings and puts nothing on `window`. Exactly the
  correction session 7 made to `web/chrome.js`, for the same reason, and the plan's
  code block had the same defect in both places.

- **`web/index.html` reloads the page after a successful sign-in** instead of
  re-rendering. `chrome.js`'s `mount()` calls `host.replaceWith(head)`, so it
  destroys its own mount point and cannot run twice on one page. A reload re-runs
  the header, the map fetch and the pane choice together, which is precisely what
  signing in has to change. Cheaper than making `mount()` idempotent for one caller.

- **`?open=<slug>` is driven entirely from `engine/editor.html`, not from
  `map-view.js`.** The natural implementation is a `MapView.prototype.openNode`,
  and the phase's own merge gate forbids it: hunks are permitted in three
  editable-leaf functions and nowhere else. `applyOpenParam()` therefore does what
  a person would — expands the area, redraws, finds the mounted tile by title, adds
  it to `mapDetailOpen`, redraws, focuses `.mtitle-input`. It reads the parameter
  once and consumes it, so a later local Connect does not re-open. **Net effect:
  `engine/map-view.js` has zero changed lines this session.**

- **`.tm-grid` and the whole-card-is-a-link rules moved into `engine/theme.css`.**
  Three surfaces wanted them (gallery, first run, the copy picker). The first-run
  block uses `auto-fit` and a 780px cap so its two cards sit side by side on a wide
  screen instead of shrinking into a four-track row; the gallery keeps `auto-fill`.
  Both collapse to one column on a 360px phone with no breakpoint at all.

- **`/app`'s map home offers "View and export" as one link, not two.** The plan
  lists Open the editor, View, Export and Copy link. Export *is* `/view`'s Export
  HTML button — the render route's HTML output is the export, and Task 7 Step 3
  forbids a second exporter. Two links to the same page would have been the
  duplication Task 9 Step 1 exists to remove.

- **`copy_from` refuses to overwrite a non-empty map** (`409 not_empty`). The screen
  that offers it only appears while the map is empty; this is the server saying the
  same thing to anything that calls the route directly. Trust-boundary validation,
  which the house rules do not let me simplify away.

- **The picker hides maps with zero beliefs, and the caller's own map.** Starting
  from an empty map is a no-op that costs a page load and a provenance row.

- **`copied_at` is an ISO timestamp generated in Python**, not the string `"now()"`.
  PostgREST would send `now()` as a JSON string and Postgres would fail to cast it.

### Phase 2's backlog, folded in (Task 9 Step 2)

`phase-2-review.md` §G7 listed five things "logged for phase 3, deliberately not
fixed here". Three are now done:

- **`api/gallery.py` had no `limit`.** `decisions.md`'s 200-row ceiling had never
  been written down in code; it is now `&limit=200`, which also caps the cost of the
  per-row parse. Past 200 rows the counts need caching or denormalising — a schema
  change and a separate decision, unchanged.
- **The gallery has a loading skeleton, not a spinner on white.** Phase 2 measured
  `/api/gallery` at 0.72–2.09 s because it parses every public map on read, and said
  in as many words to design for that rather than architect around it. Three
  card-shaped placeholders, `aria-hidden`, `aria-busy` on the grid, and a pulse that
  respects `prefers-reduced-motion`. Cleared on both the success and the error path,
  so a failed fetch never leaves a skeleton pretending to load.
- **`engine/storage-hosted.js` both opened a tab and forced a download** on Render.
  One click, one outcome: it opens the tab. Exporting a file is `/view`'s Export
  HTML button, which is a deliberate act rather than a side effect.

Two are **not** done, on purpose:

- **The `<dialog id="dlgConfirm">` relabelled by three call sites.** It is part of
  the autosave and shrink-guard machinery, and this phase's own global constraints
  say autosave is inherited from 1c and not redesigned here. It belongs with the
  controller extraction below.
- **`beaconFlush` has no observable result (B8).** Same reason — see the next
  section.

### One way to do each thing (Task 9 Step 1)

- **Clipboard:** phase 3 briefly had three copies. Now one, `copyButton()` in
  `web/chrome.js`, used by `/view` and `/app`. `engine/editor.html` keeps its own,
  and that is **not** drift: the editor must load from `file://` with no network, so
  it cannot import anything under `/web`. Said in place, in both files.
- **Relative time:** one implementation, in `web/gallery.html`, on
  `Intl.RelativeTimeFormat`. Nothing else needs it yet.
- **Card grid and card-as-link:** one implementation, in `engine/theme.css`.
- **Serializer:** first run builds its starter map with `EditorCore.serialize`, not
  a second writer. `web/index.html` loads `engine/editor-core.js` as a classic
  script for it — the file is UMD and predates the module pages.
- **Left alone, deliberately:** `web/view.html` has its own four-line `slugify` for
  the export filename, which is not `EditorCore.slugify` (that one also maps `&` to
  `and`). It predates this phase, it names a download and carries no contract, and
  pulling a 170-line parser onto `/view` to dedupe it would be the more expensive
  mistake. Recorded so the next reviewer does not rediscover it as a finding.

### The `editor.html` controller extraction — still not done

Session 7 deferred it; session 8 deferred it again, and this is now the second
outcome file to say so, which is the point at which it should stop being a phase's
leftover and become somebody's task. Nothing this session touched the autosave
machinery — `phase-2-review.md`'s B8 line-number map still reads true, allowing for
the ~40 lines `applyOpenParam()` adds above it.

**The argument has not changed and is worth restating once:** `flushAutosave` and
its four empty-save guards are the only code in the app that can destroy someone's
work, and browser automation is forbidden program-wide, so extracting *the autosave
controller specifically* behind the existing adapter seam is the only way this
program will ever observe them running. It is testability, not tidiness, and it
pairs naturally with phase 4's `map_versions` — which exists precisely because
`force: true` walks past all four guards.

### Responsive reasoning — 360 / 768 / 1400 (owed by session 7, written here)

Session 7's table left Task 3's row reading *(filled in below)* and never filled it
in. Recovered by reading what actually shipped, so the record is complete:

- **360px** — `@media (max-width:640px)`. The editor's `.layout` goes to
  `flex-direction:column`, so the tree stops being a 290px sidebar and becomes a
  full-width block above the form, capped at `max-height:45vh` so it can never eat
  the screen. The tree is a `<details class="treedrawer">` whose open state defaults
  to **closed** below 640px and open above it, and which **preserves its state
  across a re-render** — a search keystroke re-renders the tree, and slamming the
  drawer shut mid-search was a real bug (`d3d99bf`). The header's kicker and
  subtitle hide, the two tab buttons go `flex:1` so they are thumb-sized, and the
  save indicator takes `order:-1` with `flex-basis:100%` so it sits on its own line
  *above* the controls rather than being pushed off the end of the bar. `theme.css`
  adds `@media (pointer: coarse)` 44px minimums on every button, select, tab and
  disclosure summary — that rule is keyed on pointer type, not width, so it also
  covers a touchscreen laptop.
- **768px** — `@media (max-width:900px) and (min-width:641px)`. Two columns, but the
  tree narrows from 290px to 240px. The only change at this size: the form is the
  scarce resource on a tablet, not the tree.
- **1400px** — no breakpoint. The form is capped by the 58ch prose rule and the
  page containers by `max-width:1200px`, so a wide screen gets whitespace rather
  than a line length nobody can read. The gallery grid fills the extra width with
  more cards, which is the one place more width genuinely helps.

The card grids need no breakpoint at all: `repeat(auto-fill, minmax(300px, 1fr))`
collapses to one column below ~330px of available track, which covers every phone.

### The vocabulary table — the contract phase 4 must reuse verbatim

From `phase-3-design.md` §2.2, reproduced in full so phase 4's session does not have
to open a second file. **Phase 4's wizard uses these labels exactly.**

| Concept | Stored as | UI label | Never say |
|---|---|---|---|
| tier | `T1`…`T4` | **Tier** + gloss | "importance", "priority", "level" |
| confidence | `certain`…`rejected` | **Confidence** + gloss | "certainty %", "how sure (1-5)" |
| study flag | `#study` | **`#study` — I still need to work this out** | "needs review", "TODO" |
| `hold` | `hold` | **What I hold** | "position", "belief", "answer" |
| `why` | `why` | **Why** | "reasoning", "justification" |
| `vs` | `vs` | **What I'd reject** | "against", "opposing view" |
| `todo` | `todo` | **Still working out** | "Study", "Todo" |
| `refs` | `refs` | **Texts** | "verses", "scripture", "citations" |
| `link` | `link` | **Related** | "links", "see also" |
| a node | — | **belief** in prose, **node** never | "node" in user-facing copy |
| a domain | `# Heading` | **area** in prose, heading in the tree | "domain" in user-facing copy |

The last two rows are the ones that get broken: the file format's word is `domain`
and the code's word is `node`, but every user-facing string says **a belief** and
**an area**. Code identifiers are unchanged.

### Where the wizard goes (phase 4)

Everything phase 3 owed phase 4 is in place and inert:

- **Route:** `/wizard` → `web/wizard.html`, to be added to `vercel.json`. The file
  does not exist. Nothing else is reserved.
- **The gate is one constant**, `WIZARD_ENABLED` at the top of `web/first-run.js`,
  currently `false`. Flipping it to `true` does two things and nothing else: first
  run renders card 1 (`--ink` fill, spanning the full grid row above the other two,
  `href="/wizard"`), and `/app`'s map home shows its quiet *"Answer the questions to
  fill gaps"* link. `web/index.html` imports the constant rather than keeping its
  own copy, so there is one switch, not two.
- **Phase 3 ships no dead primary call to action.** With the gate `false`, card 1 is
  not rendered at all and the two live cards lay out two-up.
- **The contract: no new API surface.** The wizard builds `theology-map.md`-format
  markdown in the browser with `EditorCore.serialize` — it does not get its own
  writer — and saves through the existing `POST /api/map` with the phase-1c
  concurrency token. On finish it redirects to `/edit`, and it may use
  `/edit?open=<slug>` to land on a specific belief; that deep link is live and
  tested. It inherits `engine/theme.css` and adds no colour token.
- **`map_versions` opens phase 4**, per `decisions.md` — not phase 3. It is the
  first feature that can replace a whole map in one action.

### Verification that gated the merge

Every command run, output read, nothing inferred.

| Check | Result |
|---|---|
| `py engine/render.py` → no diff on the three generated files | **PASS**, re-run after every task |
| Round trip: `parse → serialize → parse` over the real 99-node file | **PASS** — `domains 14 nodes 99`, models identical |
| Contrast script (spec §3.5) | **PASS** — `RESULT: all pass` (full output below) |
| `engine/editor-core.js` and `engine/render.py` untouched vs `main` | **PASS** — zero changed lines in either |
| Lockstep gate: `git diff -U0 main -- engine/map-view.js \| grep -c '^@@'` | **PASS** — **0 hunks**; the file is untouched this session |
| `grep -c "calc(100vh" engine/editor.html` | **PASS** — `0` |
| `grep -riE "denomination\|#thread" web/ engine/theme.css` | **PASS** — no matches |
| `grep -n "?id=" web/gallery.html` | **PASS** — no matches |
| `node --check` on every module: `chrome.js`, `first-run.js`, `session.js`, and the inline module of `index.html` / `gallery.html` / `view.html` | **PASS** |
| `node --check` on `editor.html`'s inline IIFE and `storage-hosted.js` | **PASS** |
| `py -m py_compile api/*.py` | **PASS** |
| `py api/_test_lib.py` | **PASS** |
| Starter markdown round-trips: `serialize → parse` on the first-run node | **PASS** — `1 1 My first belief`, slug `my-first-belief` |
| `map_stats` over the real map | **PASS** — 99 / 36 / tier counts sum to 99 |
| Local workflow, run not read: `py engine/render_server.py`, then fetch | **PASS** — `editor.html` 200 (43815 B), `theme.css` 200 (6606 B), all four editor scripts 200, `POST /api/render` 200; server killed, `git status` clean afterwards; **no network call** |
| `engine/editor.html` loads every asset by a **relative** path | **PASS** — one `<link>`, four `<script src>`, and the hosted adapter still a **dynamic** `import('./storage-hosted.js')` so `file://` cannot 404 it |

### What could not be checked before merging, and why

- **No Vercel preview URL is recorded.** Branch previews have no database (the
  Supabase env vars are Production-only), so a preview would 500 on every
  database-backed route and would not be the before/after pair the plan wants; and
  the Vercel project is on an account this machine's MCP tools cannot reach, so no
  session can read the generated preview URL to quote it. Production results are
  below instead. Saying this rather than quoting a URL I could not fetch.
- **Nothing on this branch could be exercised against the real database before the
  merge**, for the same reason. That includes the migration, `copy_from`, provenance
  clearing and `started_from`.

### Production, after the merge

Branch previews have no database, so everything below ran against production once
the merge deployed. Every row is a command that was run and an output that was read.

| Check | Result |
|---|---|
| **The migration applied.** `GET /api/gallery` | **PASS — 200.** This is the proof, not a separate query: `api/gallery.py`'s select now names `copied_from`. If the column did not exist PostgREST would answer 400 and the route would return `500 server_error`. It returned 200 with rows, so the column is there. Committed *and* applied. |
| Credentials resolve (`POST /api/render {"user_id":"000…0"}`) | **PASS** — `404 unknown_user`, not `500 misconfigured` |
| `/` is the landing page | **PASS** — 200, 2014 bytes (was 123,870 — Thomas's map) |
| `/thomas` is Thomas's map | **PASS** — 200, **123,870 bytes, byte-for-byte the same file `/` used to serve**; `/theology-map.html` also still 200 at the same size |
| All product pages 200 signed out (`/app`, `/gallery`, `/admin`, `/edit`, `/view?name=Thomas`) | **PASS** |
| New assets serve (`/web/first-run.js`, `/web/landing.html`, `/web/chrome.js`, `/engine/theme.css`) | **PASS** — 200; 6394 / 2014 / 2422 / 6606 bytes |
| Gallery body carries no `markdown`, no `pin`, no `id`, no `copied_from` | **PASS** — zero occurrences of each |
| `copy_from` guards, all read-only probes with a bogus user id | **PASS** — no `source_name` → `400 bad_request`; unknown `user_id` → `404 unknown_user`; no `user_id` → `400 bad_request` |
| The ordinary save path still guarded | **PASS** — `GET` and `POST /api/map` with a bogus user id both `404 unknown_user` |
| **Byte identity, hosted**: `POST /api/render` with the full 99-node map | **PASS** — `eaedf3e4…1a90`, phase 2's LF baseline exactly. **The hashes did not move.** |

**What production could not tell me at merge time.** There was no map on production
with a non-empty `markdown`, so the *happy paths* of `copy_from`, of provenance
clearing, and of `started_from` were proven only by their guards and by local
reasoning. That gap is now closed — see the next section, which also records a
**500 the guards were hiding**.

---

## Addendum, same day — a seeded map, and the bug it immediately found

Thomas asked for his real map to be seeded into the hosted `Thomas` row so phase 4
has something to test against. Done through the admin `save_map` route (name + PIN
verified server-side; no session ever held the row id or wrote it anywhere).

**Before overwriting, I looked at what was there** — the rule this program keeps
having to relearn. The row was **not** empty: it held 29 bytes,
`# Beliefs

## My first belief
`, byte-for-byte what `startByHand()` in
`web/first-run.js` produces, with an `updated_at` later than the one my own
pre-merge check had seen. **Somebody clicked "Write my first belief" on the new
first-run screen and it worked.** A placeholder node with no fields, so overwriting
it destroyed nothing.

That also settles the thing session 7 could only prove *by construction*: the
sibling-`render`-module trap is **not** firing. Local `map_stats` on those 29 bytes
returns `node_count: 1`; production returned `node_count: 1`. Observed, not argued.

### The bug: `copy_from` returned 500 on production, and every guard I had probed returned before reaching it

`_lib.row_by_name(name, select)` ends in `_pick_exact`, which decides the match with
`row["name"].casefold()`. `api/map.py`'s `_copy_from` called it with
`select="id,markdown,is_public"` — **no `name` column** — so the lookup raised
`KeyError`, `@guard` turned it into `500 server_error`, and the message said
nothing. The repo's other two callers both happen to include `name`, so the trap had
never been sprung.

**Why the pre-merge verification missed it, stated plainly rather than excused:**
every `copy_from` probe I ran before merging used a bogus `user_id`, and the caller
lookup returns `404 unknown_user` *before* `row_by_name` is ever reached. Three
green guard checks, and not one of them executed the failing line. A route's error
paths passing is not evidence its success path exists.

**Fixed in the shared helper, not at the call site** (`de09a32`). `row_by_name` now
puts `name` into the select itself, via a pure `_with_name()` with a regression test
in `api/_test_lib.py`. Patching `api/map.py` alone would have left the trap armed
for the next caller; this makes it unfireable. Phase 2's Blue hat asked integration
passes to consider *"what does each route trust, and who else publishes that
value?"* — this is the same shape one level down: what does a shared helper
**require** of its callers, and does anything enforce it?

### Verified on production after the fix, with a real map to copy

| Check | Result |
|---|---|
| Seed: `theology-map.md` → the hosted `Thomas` row via admin `save_map` | **PASS** — 26,733 bytes sent; stored markdown **character-identical** to the file on disk |
| `/api/gallery` for Thomas | **PASS** — **99 beliefs, 36 open questions**, tiers `{T1 11, T1.5 8, T2 22, T2.5 19, T3 37, T4 2, untiered 0}` — matching the local numbers exactly |
| Gallery reply still leaks nothing | **PASS** — keys are exactly `name`, `updated_at`, `node_count`, `open_count`, `tier_counts` |
| `POST /api/render {"name":"Thomas"}` — the public read path, now with real content | **PASS** — `eaedf3e4…1a90`, the phase-2 LF baseline. **The hashes did not move.** |
| `copy_from` **happy path** (Thomas → Test1) | **PASS** — 200; 26,448 chars; byte-identical to the source |
| `started_from` on the copier's gallery card | **PASS** — `'Thomas'`, alongside `node_count: 99` |
| Provenance **clears on the first divergent save** | **PASS** — one edit later, `started_from` is `None` and the count moved to 100 |
| Guard: source not public | **PASS** — `403 not_public` |
| Guard: caller's map not empty | **PASS** — `409 not_empty` |
| Guard: source does not exist | **PASS** — `404 unknown_user` |
| Guard: copying from yourself | **PASS** — `400 bad_request` |
| `Test1` restored to empty afterwards | **PASS** — 0 bytes; the site is as it was apart from the seed |

**Consequence for the next session:** the hosted `Thomas` row is now a **copy** of
`theology-map.md`, not a link to it. Nothing syncs them; they diverge the moment
either side is edited. Project 13's non-negotiable 5 still stands — the file on disk
is Thomas's personal copy and is *not* user 1's row — and this addendum does not
change that, it just means the row is no longer empty. `decisions.md` already wanted
this: *"Thomas's own map is a comparison target like anyone else's."* Phase 6 needs
it; phase 4 now gets a real gallery card, a real `copy_from` source and real counts
to test against.

### Contrast script output

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

### Questions for Thomas

Restated from `phase-3-design.md` §14 so he does not have to open two files, with
what has happened to each since.

- **Q1 — provenance: column or markdown line? ANSWERED, and built.** Two columns,
  Option A. Task 8 shipped in this session. Nothing outstanding.
- **Q2 — is provenance shown to other people? ANSWERED, and built.** Visible on the
  gallery card, worded *"Started from Sarah's map"*, and it disappears the moment
  the copier saves anything different.
- **Q3 — what should the starter belief be called?** Default taken and shipped:
  **`My first belief`** in an area called **`Beliefs`**. Still trivially changeable
  — two constants at the top of `web/first-run.js`. Worth a glance because
  `Beliefs` becomes a real heading in that person's `theology-map.md` if they never
  rename it.
- **Q4 — what should `/` be? ANSWERED by `decisions.md`, and built.** `/` is now a
  landing page and Thomas's map is at `/thomas`. **This is the change most likely to
  surprise someone who follows an old link**, which is why the landing page says
  where the map went rather than just linking it. One line of `vercel.json` to undo.
- **Q5 — is the 200-row gallery ceiling acceptable?** `decisions.md` says the
  ceiling stands, and it is now actually enforced (`limit=200`) rather than being a
  decision nobody had implemented. **Still open in one sense:** past 200 maps the
  gallery silently shows the 200 most recently updated rather than failing, which is
  the right behaviour but is a behaviour, not a plan. Fixing it properly is caching
  or denormalising, i.e. a schema change.
- **Q6 — do the generated views need their own design phase? ANSWERED.** They became
  **phase 7**, with its own brief. Expect the editor and the product pages to look
  more considered than the map they surround until it runs. Accepted, not an
  oversight.

**One new question this session raises:**

- **Q7 — should `copy_from` be reachable after the first day?** Today it refuses if
  your map is non-empty, so "start from someone else's map" is strictly a first-run
  action. That is what the design describes and it makes the guard trivially safe.
  If Thomas wants "take a copy of Sarah's and merge it into mine" later, that is a
  different feature with a different guard, and it should be phase 6's problem, not
  a loosened `409`.

### Decisions worth revisiting

Per `decisions.md`'s standing instruction — implemented as written, flagged here.

- **"Public means comparable" collides gently with the copy picker.** The picker
  lists every public map with at least one belief. A church member who publishes a
  half-finished map to get feedback has also, without being asked, offered it as a
  template for strangers to fork. Nothing here is private that was not already
  readable — the decision is sound — but the *social* reading of "public" changes
  when copying exists, and it may be worth a line of copy on the gallery or the
  visibility control saying so. Not a code change.
- **`on delete set null` on `copied_from` quietly erases attribution** when the
  source account is deleted. That is Option A's known cost and Thomas chose it. It
  means a deleted account can leave a copy that no longer says whose it was, and
  nobody is notified. The alternative — denormalising the source's *name* into a
  text column — survives deletion but goes stale on a rename, and is a second
  data-model call. Not made.
- **The gallery's "Make your own map" card shows to a signed-in user whose own map
  is absent from the list**, which includes the case where they have unlisted a real
  map. Mildly wrong, cheap to fix, and left as-is because the alternative is
  publishing enough about the signed-in user's own row to tell the two cases apart.

### Known limits carried forward

- **The 200-row gallery ceiling is now enforced rather than merely decided.** Past
  that, the gallery shows the 200 most recently updated public maps. `/api/gallery`
  still parses every one of those on every request.
- **Cold start is unchanged** — ~0.2–0.9 s over the static baseline warm, ~1.5 s
  cold — but the gallery now shows a skeleton for it instead of nothing.
- **The autosave controller is still untestable**, and is now two phases overdue.
- **`copy_from` is first-run only**, by design. See Q7.
- **Nothing in this phase was exercised in a browser**, by house rule. Everything
  above is the result of running code, reading responses, and parsing files.
