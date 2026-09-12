# Project 12 — Theology Mind Map

A mind map of Thomas's theological positions, organised by Gavin Ortlund's theological
triage (*Finding the Right Hills to Die On*). It exists twice: as an **offline tool**
you double-click, and as a **hosted app** other people use.

## The one rule

**`theology-map.md` holds the content and is what you edit.** `theology-map.html` and
`documentation/study-list.md` are generated — never hand-edit them, they are overwritten
on every run. `documentation/verses.md` is a second source file, but mostly machine-filled.
`content/traditions/` is generated too.

## Where the documentation lives

| File | What it is | Read it |
|---|---|---|
| **`CLAUDE.md`** (this file) | Every rule that is still live. Architecture, invariants, gates. | Always |
| `debug.md` | 23 diagnostic rules for a live failure, plus what is still open. | Before touching `api/`, `render.py`, `editor.html` or `web/` |
| `documentation/changelog.md` | Round-by-round history. Why decisions were made. | When you need the *why* behind a rule |
| `documentation/debug-archive.md` | The 37 full bug write-ups (§A–§AK). | When a `debug.md` rule is not enough |
| `docs/hosting/phase-*-outcome.md` | Per-phase accounts. | Phase archaeology |
| `documentation/ux-firstprinciples-*.md`, `design-modern-feel.md` | The 2026-09 assessments. | Before UI work |

Restructured 2026-09-10: chronology moved out of this file. Pre-restructure version is
`git show 4e78bda:CLAUDE.md`.

---

## 1. Two worlds, one renderer

The hosted app is **additive**. `start_editor.bat` must keep working offline, against
`theology-map.md` on disk, with no network and no database. **If a change would make the
local tool need either, it is the wrong change.**

Live at `https://theologymap-thomas-l-s-projects.vercel.app`. Vercel serves the static
files and runs `api/*.py`; Supabase Postgres holds two tables.

**Standard library only.** `requirements.txt` is empty and stays empty. No bundler, no
CDN import, no framework, no npm dependency browser-side.

`engine/render.py` is the renderer for both worlds:

| Entry point | Who calls it |
|---|---|
| `render_markdown(markdown_text, verses)` | the **pure** function — markdown in, HTML out, touches no files |
| `parse_text(str)` / `parse_verses_text(str)` | pure parsers; `parse(path)` / `parse_verses(path)` are thin file wrappers |
| `main()` | the **file** wrapper — reads `theology-map.md`, writes the generated files. The local workflow. |

`api/render.py` imports it and calls `render_markdown`. **Do not port the four views or
the print stylesheet to JS, and do not copy `render.py` into `api/`.**

```
py engine/render.py         # build everything
py engine/fetch_verses.py   # fill blank verse text (needs network)
```

**`py`, not `python`.** Bare `python` hits the Microsoft Store stub. Python is 3.11.9.

### The renderer's byte-identity gate

A change that does **not** intend to alter output must leave `render_markdown` on
`theology-map.md` hashing to:

- `3b6b23cc196d3a7f6c2e68c5ac12c10e9479c0f6bc742aa4a893a0f1bebbfd6c` as written by
  `Path.write_text` on Windows (CRLF)
- `20dceabf54ff3f9d9bb6fcfd530fe739df0f7d494369ba96bbc317aa45ec0d91` LF-normalised (what a
  Linux-side or hosted check compares against)

Run the full hashes yourself; the abbreviations above are for recognition only.

**Corrected 2026-09-10.** This file previously carried `9a702faf…9d5fda` / `43feab4f…9ea498`,
which had been **stale since `cb08cea`** — `theology-map.html` changed and neither this file nor
the plan index was updated, so the recorded gate had not matched the repo for several commits.
Regenerating on a clean tree hashed to `f5396e31…6db99e` (CRLF), not the recorded value. The
pair before this one (`84650d62…976146` CRLF / `ad8c2515…e220e44e` LF) was post-P3. **The pair
above is post-P4, updated again by the P4 whole-phase-review fix wave (F2)** — P4 Task 6 added
the reduced-motion guard to `render.py`'s own embedded `<style>` (it cannot link
`engine/theme.css`, so it carries a hand-copied second copy of that guard), which was a
licensed, on-purpose move of the full-output hash; that gave `27ae2c0f…f427f384` (CRLF) /
`6f7c7759…f7f057a1` (LF). F2 then found that `el.scrollIntoView({ behavior: 'smooth', ... })`
in that same embedded script overrides the computed `scroll-behavior`, so Task 6's guard did
not close it — jumping to a `:target` node still smooth-scrolled under
`prefers-reduced-motion: reduce`. Making `behavior` conditional on the media query moved the
hash a second time, to the pair above, for the same reason: still licensed, still
presentation-only. Both times, `documentation/study-list.md` and the embedded
`<script id="data">` payload stayed byte-identical, which is what proves only presentation
moved. **When a licensed phase moves the output, update this pair in the same commit** — a
gate nobody can pass is a gate the next session learns to ignore. **P7 Task 12 moved the pair
a third time**, to `20219445…777402` (CRLF) / `b780879c…da911e` (LF) — `.node`'s radius
(9px → `var(--r3)`, 12px) and the D4 label-register reduction (six selectors losing
`text-transform: uppercase` and their `letter-spacing`) are the licensed felt changes;
`documentation/study-list.md` and the `<script id="data">` payload again stayed
byte-identical, which is what proves only presentation moved this time too.

**P9 moved it a fourth time, to the pair above, and for a different reason than the other
three: not presentation, but the engine itself.** The Map view's ~390 embedded lines were
deleted and `engine/map-view.js` is now inlined in their place (§8), so the embedded script
is a different string. The same two invariants held —
`documentation/study-list.md` (`f4a30fe1…9f3df7`) and the `<script id="data">` payload
(`4d8d919e…c8bd7e`) — which is what proves the *content* did not move even though nearly a
thousand lines of the file did.

A phase **licensed to change the output on purpose** (a restyle) may move them — but
then the gate becomes **two invariants that must stay byte-identical**:
`documentation/study-list.md`, and the embedded `<script id="data">` payload
(`4d8d919e…c8bd7e`). That proves only *presentation* moved. The `.mm` export was a third
invariant until `render_mm` was deleted; those hashes are history now.

Regenerate with `py engine/render.py`. **Never hand-edit a generated file to make a hash
match.** The gate has moved six times, each for a documented reason —
`documentation/changelog.md`.

`.gitattributes` pins the generated files to `eol=crlf` so regenerating on Linux does not
rewrite every line.

---

## 2. Folder layout

Root holds only what a non-technical user clicks: `theology-map.html`, `start_editor.bat`,
and the one file you hand-edit, `theology-map.md`.

- **`documentation/`** — `README.md`, `verses.md` (source data, mostly machine-filled),
  generated `study-list.md`, and the assessment/history docs listed above.
- **`engine/`** — `render.py`, `fetch_verses.py`, `render_server.py`, `editor.html`,
  `editor-core.js`, `map-view.js`, `shared-fields.js`, `wizard-generate.js`,
  `compare-core.js`, `build_traditions.js`, `validate_content.py`, `corpus_refs.py`,
  `apply_corrections.py`, `theme.css`. Not meant to be opened directly.
- **`content/wizard/`** — the corpus. `manifest.json` (fourteen domains in map order),
  `traditions.json` (fourteen registered, twelve selectable), one file per domain.
  **86 doctrines, 250 positions, 53 `tradition_overrides`, 569 sources.**
- **`content/traditions/`** — generated by `node engine/build_traditions.js`.
- **`web/`** — the hosted pages. **`api/`** — six serverless functions.
- **`supabase/migrations/`** — deploy themselves on push (see §6).

`render.py` and `fetch_verses.py` resolve `ROOT` as `Path(__file__).parent.parent` and
reach `verses.md` via `DOCS = ROOT / "documentation"`.

---

## 3. The content files

### Node syntax — `theology-map.md`

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

Every field optional. Repeat `link` for multiple targets. Continuation lines append to the
previous field. Conventional order hold → why → vs → todo → refs → link; the parser does
not require it.

- **Tier** — `T1`, `T1.5`, `T2`, `T2.5`, `T3`, `T4`. Half-steps are deliberate (free
  will/sovereignty and women in ministry are both T2.5).
- **Confidence** — `certain`, `confident`, `leaning`, `open`, `rejected`. An ordinal band,
  not a percentage. Independent of `#study`.
- **Flags** — `#study` (needs work), `#assumed` (inferred, unconfirmed — dashed border).
  No node currently carries `#assumed`. `#thread` was removed entirely in phase 0.5.
- **Slugs** derive from the title: lowercased, apostrophes dropped, other non-alphanumerics
  collapsed to hyphens. `The Lord's Supper` → `the-lords-supper`.
- **`refs`** — one to four, semicolon-separated. Prefer the texts actually argued over,
  including the ones the opposing view leans on. ~80 of 99 nodes carry them; method and
  history nodes deliberately do not.

**`serializeNode` neutralises newlines silently.** A newline in a field used to split one
belief into two and strand its `refs`. Fields collapse to one line and `·`/`|` are stripped
from titles, with no message to the person — Thomas's call.

### verses.md

`render.py` **syncs the reference list** (appends empty stubs, never overwrites or
reorders). `fetch_verses.py` **fills the text** from the NET Bible endpoint
(`labs.bible.org/api/`), blanks only unless `--all`. All 156 references have text.

- **Never write verse text from memory.** Subtly wrong text in a theology reference is
  worse than a visible blank. Fetch it or leave it empty.
- **A blank after fetching is usually a bad reference, not a network problem** — usually
  versification. NET follows the critical text; check Psalms, 2 Corinthians and Malachi.
- Translation choice is confined to `fetch_verses.py`. **The NET attribution notice in
  `verses.md`'s header and the page footer must travel with the text.**

### The corpus — `content/wizard/`

**Validate every change with `py engine/validate_content.py`** — twenty error rules, four
warnings, a coverage matrix; exit 0 is the gate.

**`engine/apply_corrections.py` is how a batch of corrections gets applied.** Typed
operations (`held_by.set`/`.add`/`.remove`, `position.sources`, `doctrine.sources`,
`override.set`, `position.hold`), every id validated, `--dry` supported, and it pushes
superseded wording into `superseded_holds` for you. It exists because clusters share domain
files (concurrent writes clobber) and because a dry run makes a batch reviewable.
**It also writes the corpus's canonical JSON formatting — apart from it and `render.py`,
nothing writes `content/wizard/*.json`.** A stray `json.dump` reformats a whole file and
buries the real change in a 2000-line diff.

**Rewording a `hold` orphans every map still carrying the old wording**, because compare
recovers a position by exact normalised match on the `hold` sentence. Push the previous
text into that position's (or override's) `superseded_holds` array.
`engine/compare-core.js` matches against it. **Nothing enforces this** — it is on whoever
edits the corpus.

### The tradition maps — `content/traditions/`

Generated by `node engine/build_traditions.js`. **Never hand-edited.** Twelve
`in_scorecard` maps (606 nodes) plus `manifest.json`. A correction goes into the corpus and
the maps are rebuilt. The build is deterministic and idempotent — re-running on an unchanged
corpus leaves `git diff` empty. **Do not put a clock or any varying value into a generated
file**; `manifest.json` records `corpus_sha256` for that reason.
`tests/build-traditions.test.js` gates it.

---

## 4. The four views, and the design language

- **Map** (default) — a balanced node-link tree. Root centred, 14 domains alternating
  right and left, each side keeping its own vertical cursor. Within a domain, leaves order
  by tier (T1→T4, untiered last). Box widths are content-driven: CSS sizes each to content
  (`width:max-content`, clamped), the layout pass measures via `offsetWidth`. Collapsed
  leaves ~150–320px; an expanded leaf's detail panel ~340–560px; domain boxes ~140–240px.
  Every second leaf staggers outward by half its measured width. Drag/swipe to pan, wheel
  or pinch to zoom (cursor-anchored, 0.3–2.5x). Below 860px it falls back to single-sided
  left-to-right.
- **Domain / Tier / Confidence** — grouped card lists, collapsed by default. An active text
  filter auto-expands any group holding a match without disturbing stored collapse state.

Expand-all and collapse-all drive both. Printing force-switches to Domain, everything
expanded, then restores. The print stylesheet is A3 (`@page { size: A3; margin: 12mm }`) and
tier chips carry `print-color-adjust:exact`.

**Phone (below 640px):** view switcher and search on the top row; study filter,
hide-inferred and expand/collapse behind a "Filters" disclosure; kicker, subtitle and tier
legend hidden. Card field labels stack below 560px. Pan and pinch use pointer events with a
6px threshold so a tap still registers as a tap.

**Design language.** Warm paper-and-ink palette in both themes, serif for content and sans
for chrome, prose capped at 58ch, tier colours a garnet→slate warm-to-cool ramp chosen for
WCAG AA contrast with white chip text. **Do not reintroduce traffic-light tier colours** —
the earlier amber values failed contrast.

**Field labels are phase 3 design §2.2's table**, the same words in the generated views, the
editor and the wizard: *What I hold, Why, What I'd reject, Still working out, Texts,
Related*. `todo` is **never** shown as "Study" — `#study` is a different thing. User-facing
copy says **belief** and **area**, never "node" or "domain". `card()` and `mboxHTML()` share
one `detailRows()` builder so they cannot drift.

---

## 5. The editor

`engine/editor.html` is the same page locally and hosted. `HOSTED` is true for any
non-`file:`, non-`localhost` origin (or `?mode=hosted`), and `boot()` picks an adapter:

- `engine/storage-local.js` — File System Access API + `http://localhost:8420`.
- `engine/storage-hosted.js` — `/api/map` and `/api/render`, plus autosave.

Interface: `{ mode, supportsAutosave, init(ui), load(), save(text, token, force),
render(text), beaconFlush(text, token), buttons }`. **Add a mode by adding an adapter, not
by branching inside `editor.html`.**

Two tabs, both editing the same live in-memory model:

- **List** (default) — the structured form: pick a node in the sidebar tree, edit fields,
  add/delete nodes and domains.
- **Map** — the same node-link layout. Collapsed leaves render exactly like the read-only
  Map view; only an open leaf switches to editable controls. Each domain box has a ✎ to
  rename in place.

`/edit?open=<slug>` expands the area, opens the tile and selects the title — and is the one
thing that opens on **Map**, because `applyOpenParam()` only knows how to drive `MapView`.
**An unresolvable slug is ignored silently**; a stale bookmark must never be an error.

**Promoted vs optional fields.** Both surfaces show **What I hold**, **Tier** and
**Confidence** directly and put the other five behind a `<details class="optional">`. The
first thing a person does is write what they hold; classifying it comes second.

**Every visible string in `editor.html`'s markup is the `file://` tool's wording.** Anything
hosted-specific belongs in the `if (HOSTED)` branch, not in the HTML — the hosted branch
rewrites the title, subtitle, "open the map" link and the empty-state sentence.

**Autosave is hosted-only.** 1200 ms idle debounce, 15 s forced-flush ceiling, flush on
`visibilitychange → hidden`, best-effort `sendBeacon` on `beforeunload`. **The local
workflow's explicit Save & render is unchanged and has no autosave.**

**Save & render** POSTs to `render_server.py`, which chains `render.py` → `fetch_verses.py`
→ `render.py` again. Without the server, Save still writes the file. **A page button cannot
launch a local process** — browser sandboxing forbids it; the editor can only detect whether
the server is already running.

The editor does not support reordering domains — deliberately just add/edit/delete/rename,
per the "very very very simple" brief.

---

## 6. The hosted app

### `api/` — six serverless functions

**`api/_lib.py` is the only file in the repo that knows Supabase exists.** It resolves the
env vars, speaks PostgREST over `urllib`, and owns the reply/error shapes. **No Supabase key
of any kind ever reaches the browser** — every read and write goes through these routes with
the service-role key, server-side, specifically so PINs stay off the wire.

| File | What it does |
|---|---|
| `_lib.py` | env resolver, `pg()`, `reply`/`error`/`unknown_user`, `read_json`, `verify_credentials`, `require_admin`, `guard`, `snapshot_map`. Not a route (a leading `_` is not routed). |
| `render.py` | `POST {markdown}`, `{name}` **or** `{user_id}` → `text/html` |
| `auth.py` | `POST {action: "signup"\|"login", name, pin}` → `{user_id, name, is_admin}` |
| `map.py` | `GET ?user_id=` → the owner's map + `updated_at` token + `is_public`. `GET ?name=` → the **public** read path (markdown only when `is_public`, 404 otherwise, never an id). `POST` saves with optimistic concurrency, or `{action:…}` for `copy_from` / `versions` / `restore` / `set_visibility` |
| `gallery.py` | `GET` → public maps, newest first, `limit=200`: `name`, `updated_at`, counts derived on read, `started_from` for an unedited copy |
| `admin.py` | `POST` — `list_users`, `delete_account`, `reset_pin`, `set_visibility`, `versions`, `restore`. Every action re-verifies name+PIN server-side first. |

House rules every route follows, because breaking one is silent:

- **`sys.path.insert(0, str(Path(__file__).resolve().parent))` before `from _lib import …`.**
  Vercel puts `/var/task` on `sys.path` but not `/var/task/api`.
- **Never `select=` the `pin` column on any path reaching a reply body. No response, on any
  route, ever contains a PIN.**
- **Wrap handlers in `@guard`**, so a missing env var reaches the screen as a 500 naming the
  variable rather than a blank page.
- **Look the row up first, then act** — that is how "no such user" is told apart from a stale
  token, before any write happens.
- **PostgREST answers a write with 204 No Content** unless you ask for
  `Prefer: return=representation`. Success checks are `not in (200, 204)`.
- **Interpolate nothing into a PostgREST path without `_lib.q()`.**
- **A name becomes a row in exactly one place: `_lib.row_by_name()`.** `ilike` only narrows;
  the exact case-insensitive comparison decides. PostgREST rewrites `*` to `%` inside a
  `like`/`ilike` value, so escaping metacharacters is not enough and never was.
- **No serverless route may call an external host on a page load.** Hosted users get no verse
  fetching; `verses.md` ships as a bundled read-only asset and `fetch_verses.py` stays local.
  A hosted user citing an uncited reference sees "Not yet added to verses.md" rather than
  invented text.

**Two modules are called `render`.** `api/gallery.py` and `api/render.py` both `import
render` to reach `engine/render.py`, and `api/render.py` is itself a sibling on the same
`sys.path`. If a function's `includeFiles` does not bundle `engine/render.py`, the import
**silently succeeds against the wrong module** and every count comes back zero. **Any route
importing `render` needs its own `includeFiles` entry in `vercel.json` and resolves the
attribute it needs at import time** (`parse_text = render_engine.parse_text`), turning a
missing bundle into a 500 on the first request instead.

**The rule to check on every new route: *what does this route trust, and who else publishes
that value?*** The row `id` authorises a save in `map.py`; `gallery.py` published it; so for
a day any stranger could overwrite any public map. Both files were correct alone. **The `id`
is a credential** — it belongs in the owner's `localStorage` and in an admin's `list_users`
reply, and nowhere else. **Never add `id` back to the gallery**, and never let `markdown`
into its body.

### `web/` and the URL map

Vercel **rewrites** (not redirects), so the address bar keeps the short path.

**Import by absolute path — every module path, static or dynamic.** A relative
`./session.js` resolves to `/session.js` and 404s. `engine/editor.html` writes a
`<base href="/engine/">` when reached at `/edit` so its five relative `<script src>` tags
resolve — **but that base does not cover a dynamic `import()`**: Safari resolves those
against the page URL from an inline classic script. Nothing else may lean on it.

| URL | Serves |
|---|---|
| `/` | `web/landing.html` — the front door, **and the only sign-in / create-account screen**. Forms under `#signin`, hidden when signed in; success lands on `/wizard`. |
| `/thomas` | `theology-map.html` — Thomas's own map |
| `/edit` | `engine/editor.html` in hosted mode |
| `/gallery` | `web/gallery.html` — public maps |
| `/view?name=` | `web/view.html` — read-only render + Export HTML. Keyed by **name**, not row id; names are unique on `lower(name)`. |
| `/view?tradition=` | the same page rendering a **generated tradition map**, with a standing line saying it is a generated summary, not a person's map |
| `/admin` | `web/admin.html` |
| `/history` | `web/history.html` — the caller's own earlier versions, and Restore. Nothing else. |
| `/wizard` | `web/wizard.html` — the launchpad and the questions. Signed-out visitors go to `/`. |
| `/learn` | `web/learn.html` — the by-doctrine reference surface. `?doctrine=<id>` is the page that matters; `?tradition=<id>` its transpose. Works signed out. |
| `/compare` | `web/compare.html` — my map against a tradition or another member. `?tradition=`, `?name=`, `?doctrine=` skip the picker. Signed in only. |

**`/app` no longer exists.** Anything still redirecting to it is stale; the signed-out
redirect is `/`.

**The nav is one list in `web/chrome.js`.** Since P6 it is **`My map · Questions · Learn ·
Browse · ⋯`** signed in and **`Learn · Browse · Sign in`** signed out, where `⋯` is a native
`popover` holding Edit, History, Compare, Listing status, Admin and Sign out. Below 640px the
row scrolls horizontally rather than wrapping — that is `engine/theme.css`'s
`.tm-chrome .toplinks` rule, and **the `⋯` button belongs inside `.toplinks`**, not beside it:
appended as a sibling it is inline-level after a flex container and renders on its own line at
every width, which is how P6 first shipped it. `chrome.js` used to set `flexWrap` inline, and an
inline style beats a media query, so that rule was dead from the day it was written. **Do not put
the wrap styles back on the element.**

`engine/editor.html` carries a **hand-written copy of the same list** because it cannot import
`chrome.js` — the documented `file://` exception, kept in step by hand. **Any nav change is
three edits now: `chrome.js`, `engine/theme.css` and `editor.html`.** Both files hold the list as
a literal `[href, label]` array so a reorder or relabel is a one-line diff in each; keep them
line-for-line identical. **Home is the first item in the `⋯` menu, not in the visible row.**
D6's target list omitted it entirely, on the grounds that Home's only job for a signed-in user
was to be a menu of the items evicted from the nav; **Thomas rejected that on 2026-09-11** — `/`
is a real destination and the nav needed a route to it — and the overflow is where a genuine but
occasional return path belongs, so the visible budget stays at four. `Listing status` points at
`/#vis-row`, whose id is created in JS during `/`'s signed-in tile build rather than in its
markup; that deep link works only because the HTML spec retries scroll-to-fragment after load.

**Both copies must implement the current-page match identically.** It compares the **raw** href
against `location.pathname`, and additionally requires `search` to agree when the href carries
one — path-only marked "My map" while you were looking at someone else's map. **An href carrying a fragment never
marks the page current** — it points at a region, not a destination — which is what keeps Home
(`/`) and Listing status (`/#vis-row`) from both claiming `/`, and stops `Sign in`'s `/#signin`
claiming it signed out. `Sign out` never goes through the match at all: its `href="#"` resolves to the current page, which marked it as current on
`/edit`. Two independently written copies of that one rule is how that bug arrived.

`mount(pageTitle, actions = [])` takes an optional array of built elements for a
right-aligned header actions row. `/view` is the one caller that passes any.

**`web/corpus.js` is the one browser-side corpus loader.** `/wizard`, `/learn` and
`/compare` all import `loadCorpus()` and `STANCE_TEXT` from it. A fourth page fetching
`content/wizard/*.json` itself is the duplication this file exists to prevent.

**`web/session.js` is the only module that touches `localStorage` for the signed-in user**
(key `theologymap:user`). One way to get the current user: `getUser()` / `requireUser(why)`.
`apiFetch()` is JSON-in/JSON-out and shows the shared error banner itself — **it is the wrong
tool for `/api/render`**, which replies `text/html`; those two call sites use plain `fetch()`
+ `res.text()`. **The Error `apiFetch` throws carries `.code` and `.status`** — a caller that
must branch on *why* a call failed matches on the code, never the message.

`storage-hosted.js` deliberately does **not** use `apiFetch` for `/api/map`: on a 404
`unknown_user`, `apiFetch` clears the session and redirects, which must never happen
mid-edit. A vanished account has to leave the draft in `localStorage` and say so in place.
**Do not "fix" this back.**

### The schema

`supabase/migrations/`. **Migrations deploy themselves** — the Supabase↔GitHub integration
applies new files on push to the production branch. Write it, commit it, push it, **then
verify it landed; committed is not applied.**

`users`: `id` (uuid pk) · `name` (unique on `lower(name)`, the login identifier) · `pin`
(plaintext, 4–12 chars, **never selected into a reply body**) · `markdown` (≤512 KB) ·
`is_admin` (**no route anywhere may write this column**) · `is_public` (default true;
controls the gallery listing and the name-keyed render — **not secrecy**) · `copied_from` /
`copied_at` · `created_at` / `updated_at` (the concurrency token, advanced by a trigger).

`map_versions(id, user_id, markdown, saved_at)` — `users.markdown` stays the head pointer.

**Every write path to `users.markdown` calls `_lib.snapshot_map(user_id, force)` first** —
`map.py`'s save and `admin.py`'s `restore`. One PostgREST RPC to `public.snapshot_map`; the
rules live in the SQL, not in `api/`, so the call sites cannot drift: **at most one snapshot
per user per hour, always one on a `force: true` save, last 20 kept.** The helper is
best-effort and swallows every failure — losing a snapshot must never cost somebody their
save — **which also means it cannot tell you whether the migration landed.** Probe the RPC.

**Concurrency is optimistic on `updated_at`; there is no `rev` column.** `POST /api/map`
sends `expected_updated_at`, the route PATCHes with `&updated_at=eq.<token>`, and zero rows
back means somebody else saved first (409 `conflict`). **Four guards stop an empty save
erasing real work:** no token means the scheduler never arms; a client-side shrink check; a
server-side 409 `would_erase` against the row's actual stored markdown; and a
`localStorage['theologymap:draft:<name>']` copy written before every network call.

**RLS is on with no policies**, so the anon key reads nothing. Access control lives in
`api/`, not in RLS.

**The one SQL statement a human runs** is the admin bootstrap, because sign-up is open and
any route that could grant admin could grant it to anyone:

```sql
update public.users set is_admin = true where lower(name) = lower('Thomas');
```

### Security posture

Plaintext PIN comparison, `localStorage` for the user id, no hashing, no JWT library, no
rate limiting. **Do not "improve" this into a real auth system.** Keep it honest instead by
never storing anything a user would mind leaking, and by never putting a PIN in a response.

`web/admin.html` may cache the admin PIN in `sessionStorage` (`theologymap:adminpin`) — it
dies with the tab, never reaches localStorage, a cookie, a URL or a log.

### Environment facts

- **The Supabase/Vercel account is not the one this machine's Claude MCP tools authenticate
  to.** No session can apply a migration, read an env var or inspect a table through MCP.
  `list_projects` returns two unrelated live apps that both have their own `users` tables —
  **never run DDL against either.**
- **Branch previews have no database.** The Supabase env vars are Production-only, so any
  DB-backed route 500s `misconfigured` on a preview URL. Probe with
  `POST /api/render {"user_id":"00000000-0000-0000-0000-000000000000"}`: `404 unknown_user`
  means credentials resolved, `500 misconfigured` means they did not. DB checks run on
  production, after merging.
- **The first request after a deploy 404s while the function cold-builds**; the second
  succeeds. Poll the route, not `/`.

---

## 7. Invariants — do not undo these

Each one has been undone or nearly undone at least once. Grouped by what breaks.

### Product ethics

- **Compare is descriptive, never evaluative.** "Closest tradition" is said of **traditions
  only** and always with its denominator. There is deliberately **no person-vs-person
  scorecard, no score attached to a named person, and no leaderboard**, and no comparison is
  notified, logged or counted anywhere. `engine/compare-core.js` says so at `scorecard()` and
  `web/compare.js` again at the member branch. **A later session will find the missing
  people-vs-people scorecard and read it as an obvious symmetry to add. It is not. Do not add
  it.** Person-to-person gets the per-doctrine diff only.
- **Tier comparison is a separate question from the diff.** `CompareCore.tierDiff` reports
  where a person's `tier` departs from the corpus `suggested_tier` — which `diff()` cannot
  see, because it resolves on the `hold` sentence and never reads `tier`. **The baseline is
  the corpus suggestion, never an average over other members' maps**: with a handful of
  accounts that is noise, and "almost nobody tiers this the way this person does" is a
  judgement about a person. A members-aggregate needs its own decision, not a quiet reuse.
- **`/learn` says *suggested* on every tier chip**, carries a legend explaining the ramp, and
  renders each doctrine's `tier_note`. The chip is corpus data and renders signed out —
  without that word a stranger reads a colour-coded `T1` as this site's verdict.
- **Unlist, never Hide.** `is_public` controls listing, not secrecy: anyone holding the row id
  still reads the map through `/api/map`. Unlisting is not privacy and the copy must not
  imply it is.

### Access control

- **The `is_public` asymmetry in `api/render.py` is deliberate.** The `name` branch checks it;
  the **`user_id` branch must not.** The id is a save-authorising secret, and guarding it locks
  an owner out of their own unlisted map — which happened, silently, to every unlisted map and
  its Export HTML. `api/map.py` documents the same rule from the other side. **Making the two
  branches "consistent" reopens the bug.**
- **`/view` must not redirect an owner on a 404.** The "My map" test is gated on `res.ok` on
  purpose: `/api/render` 404s an **unlisted** map as well as a missing one, so redirecting on
  any 404 bounces an owner who just unlisted their own map back to the wizard every time.

### Data safety

- **`pruneLinks(domains)` runs immediately before every `serialize`.** A wizard map is partial
  by definition and `render.py` warns on a `link` whose target does not exist.
- **`applyAnswer`'s revisit rebuild preserves the person's own writing.** Every fallback chain
  is `answer.x !== undefined ? answer.x : (prev.x || <corpus default> || '')`, which keeps
  explicit-clear semantics (an empty string still clears), and `_intendedLinks` is a
  de-duplicated union, not a replacement. **Do not reorder `prev.x ||` ahead of the
  `!== undefined` test** — `tests/wizard-generate.test.js` pins both halves precisely because
  a mutation that did so passed every other test.
- **A handler bound inside a per-render builder, onto markup that outlives the render, must be a
  property assignment.** `buildCustom()` runs once per question against `#custom-answer` /
  `#custom-fields`, which are static markup — so `addEventListener` accumulates one listener per
  question, forever, and listeners fire in registration order. P5 shipped that, and the oldest
  surviving closure won: expanding the custom tile on question 1 and clicking it on question 5
  bound question 1's *detached* fields, which either saved question 1's sentence under question
  5's doctrine or, more often, made `currentAnswer()` return `null` so the answer was **silently
  discarded while the question advanced**. `$('custom-fields').onclick = pick` — an assignment,
  scoped to the body so collapsing the tile cannot re-select it. The position cards are rebuilt
  every render, so `addEventListener` there is fine; the difference is what outlives the render.
- **Nothing in the wizard's render path may be deferred past the render.** P5 briefly queued the
  revisit preselect behind a double `requestAnimationFrame` to make an entrance animation
  visible. Nothing scoped the callback to the question that queued it, so question N's preselect
  could land after question N±1 had rendered and pair N±1's doctrine with N's belief text, on a
  screen showing no selection. **Deleted, not guarded** — and the animation it existed for was
  wrong anyway: restored controls *are* the arriving screen, and the grammar says a page arriving
  does not Settle.
- **`normalise` strips exactly four things** — lowercase, collapse whitespace, one trailing
  full stop, one layer of surrounding quotes — and nothing else. Any fuzzier matching reports
  a confident wrong answer where an honest `own-wording` belongs.
  `tests/compare-core.test.js` pins this because a strip-all-punctuation mutation passed
  every other test in the file.
- **`closestTradition` flags *every* tied row** and does not return `denominatorNote`. Ties
  compare on one scale (`score`, within an epsilon), never a raw-count tolerance, and every
  row carries its own `numerator`/`denominator` for the caller to build the sentence. The old
  code named one tradition with full confidence on a four-way tie.
- **Scripts that edit repo files read and write bytes.** `pathlib`'s `write_text` translates
  `\n` to `os.linesep` on Windows; `read_text(newline='')` needs 3.13 and this machine is 3.11.
  **Read `git diff --stat` before committing, not after.**

### CSS and markup

- **Any pane hidden by the `hidden` attribute needs its own `[hidden]` override if it also
  carries an author `display` rule on the same selector.** An ID selector outranks the
  browser's `[hidden] { display: none }`. `web/wizard.html` carries one global
  `[hidden] { display: none !important }` as the root-cause fix for the whole class.
- **`render.py`'s embedded `:root` and `engine/theme.css` declare the same tokens with the
  same values, by hand.** The generated map must stay one self-contained double-clickable
  file, so it cannot link the stylesheet. **Nothing checks that they agree.**
- **`--t1`…`--t4` live in `engine/theme.css`.** Four hand-copied duplicates in `web/` were
  deleted. **Do not reintroduce a tier hex literal in a `web/` file** — read the token.
  `render.py` keeps its copy for the self-containment reason above; that one is legitimate.
- **Every `web/*.html` page links `theme.css` BEFORE its own `<style>`; `engine/editor.html`
  links it AFTER.** So a shared rule in `theme.css` that must beat a page-local rule needs to
  win on **specificity**, not presence — on a tie it loses to `web/` and wins in the editor,
  which is how the 44px coarse-pointer floor sat inert on `/wizard` for a whole phase while
  appearing to work in `/edit`. Matters most when snapping page-local values to tokens. §10
  has the full case.
- **One uppercase register, and it is `.kicker`.** D4 (P7) reduced six label registers to
  one. `.kicker` keeps `text-transform: uppercase` and `letter-spacing: .16em`; every other
  label is sentence case at `600 var(--fs-000)/var(--lh-ui) var(--sans)` in `var(--muted)`.
  Three declarations exist — `theme.css`, `render.py`, `editor.html` — because of the
  permanent three-way fork, not because there are three registers. **Adding a seventh
  uppercase label is how the "generated" look comes back**; the design review named six
  registers as the single loudest tell in the sheet.
- **A `@media` query adds nothing to specificity.** A rule inside `@media (pointer: coarse)`
  **ties** with an unwrapped rule on the same selector and loses to it on source order if the
  base rule is declared later in the same file. P6 shipped `.tm-more a { padding: 16px 0 }`
  inside the coarse block *above* the base `.tm-more a { padding: var(--s2) var(--s4) }`, so the
  44px floor was inert and touch targets were ~33px — the same failure as the `/wizard` case
  above, one file later. **A cascade derivation is not finished until you have named the
  declaration that actually wins.** Two review rounds passed a comment whose arithmetic described
  a rule that never applied.
- **`[popover]`'s UA stylesheet is `position: fixed; inset: 0; width/height: fit-content;
  margin: auto`, and that `inset: 0` must be reset before you set anchor edges.** Overriding
  `top`/`right` while `left: 0` survives over-constrains the box, so CSS **drops `right`** in
  LTR and the menu lands against the page edge instead of under its button. `inset: auto` first,
  in the anchored rule **and** in the `@supports not (position-anchor: --x)` fallback. It looks
  redundant and it is not.
- **A second rendered element sharing a `view-transition-name` aborts the entire transition,
  silently, with no console error.** Four names are live: `tm-chrome` (`theme.css`), and
  `q-title`/`q-crumb`/`q-nav` (`web/wizard.html`). `.wz-nav`'s is a **class**, so a second
  `.wz-nav` anywhere kills every transition on the page. Since P6 the chrome and the wizard's nav
  render simultaneously, so this is one duplicate away from a total, invisible failure.
- **`--line` and `--field-line` are not interchangeable.** `--field-line` is for interactive
  control boundaries *only* (WCAG 2.1 SC 1.4.11 needs 3:1; `--line` on `--panel` is 1.36:1).
  `--line` stays the decorative divider.
- **`/learn`'s position cards let their `gap` own all vertical spacing.**
  `.lp-pos > *, .lp-mine > * { margin: 0 }` exists because every row is a `<p>` and flex gaps
  *add to* margins rather than collapsing them. The reset is scoped with `>` on purpose and
  must stay declared *after* `.lp-prose`/`.lp-hint`/`.lp-refs` to win on order. **Add a row to
  these cards without a margin of its own.**
- **`.tm-main` in `web/view.html` carries `width: 100%; box-sizing: border-box` and must keep
  it.** `/view` is the only page making `<body>` a flex column, and `theme.css`'s
  `margin-inline: auto` on a flex item cancels the cross-axis stretch — without an explicit
  width the iframe collapses to its 300px intrinsic width, which reads correct on a phone.
- **Tier and confidence stay real `<input type="radio">` on both surfaces.** Arrow-key
  operation and radiogroup semantics come from the platform. **Do not hand-roll
  `role="radiogroup"`.**
- **`.sel`'s tint and border are the only selection signal.** The tick is gone deliberately.
- **`#home-empty` is deleted.** Its third first-run offer — *start from someone else's map* —
  lives on `#screen-intro`, the screen a new account actually lands on. **Do not re-add a
  second empty-state home.**

### The framed map

- **A framed map trims its own header.** `render.py` marks `<html class="framed">` when
  `window.top !== window.self` — the same test that removes the Edit link — hiding the
  kicker, subtitle and tier legend and visually-hiding the `h1`, because `/view`'s own chrome
  carries all four.
- **`#mapwrap`'s height comes from `sizeMap()`**, which measures the header's real
  `offsetHeight` rather than a hand-tuned `calc(100vh - Npx)`. The CSS constants stay as the
  no-JS fallback. **`sizeMap()` runs before `redrawMap()`** — the redraw centres against the
  wrap's height.
- **The Map view sets `main.wide`** (`max-width: none`); the card views keep the 1080px
  reading measure.
- **`/view`'s Fullscreen is not the Fullscreen API.** iOS Safari has no `requestFullscreen()`
  on a non-video element. It is `body.tm-enlarged`. **It deliberately does not fix-position
  the iframe** — iOS Safari does not re-resolve the inner `100vh` against a fixed frame's new
  height. The button is a standalone fixed element outside `mount()`'s actions row; Escape is
  the only other way out, since the frame is sandboxed without `allow-same-origin`.

### Behaviour that is silent and deliberate

- **"Ignore for now" is a third state and lives only in the browser** —
  `localStorage['tmm.wizard.ignored']`, a JSON slug array beside `tmm.wizard.tradition`. A
  *preference, not content*, so every read and write is wrapped in try/catch and a
  private-mode browser degrades to "nothing ignored". It is deliberately **not**
  `web/session.js`'s key. **Not in the markdown**, because a node is the only thing the file
  format can hold and a node for a skipped question would put a belief you never stated on
  your map. **Not a column**, because that is a migration, a route and a new thing every save
  path must not clobber, for a "move past this" gesture.
- **`domainProgress()` iterates the corpus manifest**, so an area a person invented never
  appears in the launchpad's Areas list — but still counts in "beliefs written" and "areas
  covered", which read the map. The two numbers mean different things on purpose.
- **Slug matching is global.** `## Inerrancy` under `# Ethics` marks the *Scripture* doctrine
  answered; answering it moves the node and leaves an empty `# Ethics` heading. Defensible —
  one belief, one slug is the rule `pruneLinks` and `compare-core.js` both rest on — but silent.
- **`addManualNode` refuses an empty title or a duplicate slug** by returning `domains`
  unchanged; callers detect it by node count.
- **`refs.js`'s curated table omits the Schleitheim Confession and the Longer Catechism of
  St Philaret** deliberately — no live free-text host could be verified, and **a dead link is
  worse than plain text.** 249 of the corpus's 569 sources carry a real `url`, which wins;
  the curated table and the Google-search fallback cover the rest. No `held_by` citation
  carries a `url`, the schema having no place for one. `tests/refs.test.js` is the gate.
- **A skeleton is cleared on *throw* exits, not just `return` exits.** `apiFetch` **throws**
  on every failure but the `unknown_user` redirect, and `web/corpus.js`'s bare `fetch` calls
  **reject** on a dropped connection rather than returning `null` — so guarding only the
  `if (!x) return` paths leaves `main()` rejecting unhandled with `aria-busy="true"` and the
  pulse running forever. P8 shipped that on four sites and its own comments claimed every exit
  path was covered. Both pages now net it at the **entry points** — `main()`, and `route()`'s
  other two callers — not at each call site. **A page that pulses forever is worse than the
  blank page it replaced**: it actively says it is still loading.
- **`/compare`'s `route()` removes `#tm-banner` at the top of every route.** Before `pushState`
  every transition reloaded the document, which cleared `web/session.js`'s banner for free.
  Nothing else removes it, so a failed comparison's error would otherwise sit above the next
  successful one describing nothing. `session.js` still owns the element; `route()` only
  removes it.
- **`renderResults` and `renderPicker` are re-entrant.** They ran once per document until P8.
  Every host either writes must clear before it fills, and `route()` clears each result pane's
  content **and** re-hides it before handing off — `renderResults` writes those `hidden` flags
  only once it holds both maps, well after its early returns. Three review rounds went into
  this: the visible failure is the *previous* comparison's scorecard sitting under the *new*
  tradition's heading.
- **`content/traditions/manifest.json` is generated and nothing checks it is current.**
  `engine/build_traditions.js` emits it from the same `in_scorecard` filter
  `engine/compare-core.js` reads, so the two agree *whenever the manifest was regenerated after
  the corpus last changed*. Flip a tradition's `in_scorecard` in
  `content/wizard/traditions.json` without re-running `node engine/build_traditions.js` and
  `/compare` silently drops that column — `loadTraditionMaps`' `if (!entry) return;` skips it
  and caches the short set as good for the whole visit. `tests/check_tradition_maps.py` does
  **not** gate this; it parses the generated `.md` files. It is a convention, like
  `superseded_holds`, not a guarantee.

---

## 8. Known forks, and the one being resolved

Some duplication here is deliberate. Know which is which.

| Fork | Status |
|---|---|
| `engine/render.py`'s embedded Map JS (~390 lines) vs `engine/map-view.js` (~430) | **RESOLVED 2026-09-12 (P9).** Not a fork any more — see below. |
| The token `:root` block, forked **three** ways — `engine/theme.css`, `engine/render.py`, `engine/editor.html` | **Permanent, and reconciled 2026-09-10 (P2).** Both generated and `file://` files must be self-contained. Change one, change all three. The old drift (`--good`/`--bad` missing from `render.py`; `--mono`/`--shadow` from the other two) is gone, and `--accent` now has a job as `accent-color`. P2 added eight spacing steps, four radii, three elevations, three durations, three easings and seven type steps to all three. **Still nothing checks that they agree** — the reconciliation was hand-verified, not enforced. |
| `slugify` in `editor-core.js` and `chrome.js` | **Permanent.** An ES module cannot import the former; `file://`-served `editor.html` cannot load the latter. Change one, change the other, **and `render.py`'s too**. |
| `editor-core.js` parser vs `render.py`'s `parse()` | **Permanent lockstep, by hand.** Round-trip fidelity was verified against the live file. Touch either, re-verify both. |
| `engine/editor.html`'s **header styling** vs `.tm-chrome` | **No longer a fork — resolved by divergence 2026-09-12.** `theme.css` used to claim it mirrored the editor's header rules. P7 moved `.tm-chrome` onto the type and spacing scales and deliberately left `editor.html` alone, and Thomas ruled the offline tool keeps its own visual language. **Do not re-sync them.** This is separate from the row below, which is still live. |
| The nav list in `chrome.js` vs `editor.html` | **Permanent lockstep, by hand.** The documented `file://` exception. Since P6 it is three edits, not two — `engine/theme.css` carries the popover's styles. Both sides hold the list as a literal `[href, label]` array to keep the diff one line. |

**The helpers this repo forks are `el`, `escapeHtml` and `slugify`.** They now live in one
place each — `el` and `slugify` exported from `web/chrome.js`, `escapeHtml` from
`engine/editor-core.js` (which `editor.html` loads first, so the global is there for
`map-view.js` and `shared-fields.js`). **Another copy of any of them is a bug in waiting.**

**`citeLink`/`sourceLine` live in `web/refs.js`**, parameterised by class name and an optional
`onFollow`. `refs.js` stays **DOM-free and takes `el` as an argument** rather than importing
`chrome.js`: `tests/refs.test.js` `require()`s it under plain Node, where an absolute
`/web/...` import resolves against the filesystem root and fails.

### The map-view unfork — done, and the lockstep gate is retired

**Resolved by P9 on 2026-09-12.** `engine/map-view.js` is now the **one** source of the Map
view's layout/pan/zoom engine. `render.py` reads it at import time (`MAP_VIEW_JS`) and inlines
it into the generated page with `.replace("__MAPJS__", …)` beside `__DATA__`. The ~390
embedded lines are deleted.

**The lockstep gate is gone with it.** The old rule — only `_leafHeaderEditable`,
`_leafMetaEditable` and `_leafDetail` may be touched, merge-gated on
`git diff -U0 main -- engine/map-view.js | grep '^@@'` — was armed because a second copy had
to be hand-carried. There is no second copy. **Edit the map engine in `map-view.js` and
nowhere else**; it is ordinary code now, and both consumers get the change.

What replaced the fork is four options, supplied by `render.py` only — the editor passes none:

| Option | Job |
|---|---|
| `readonly` | drops the ✎ rename, `+ New node` and `+ New domain` chrome, and routes leaves through `leafHTML` |
| `leafHTML(n, open, id)` | the read-only leaf body. **`id` is the engine's box id and must land in `data-id`** — a leaf labelled with its slug toggles a key the view does not hold |
| `escapeHtml` | injected, because `window.EditorCore` exists only in the editor and a local copy here would be a fourth copy of a one-place helper |
| `forceOpen(domain)` | overrides a manually-collapsed domain — the generated map's search auto-expand |

**`expandAll(nodes)` takes the caller's own full node list**, and must keep doing so. Reading
the tree instead would expand only what the live search filter currently shows, leaving every
other belief collapsed once the filter is cleared — which is not what that button did when the
generated map owned its own copy of this code.

**Three things about it are easy to undo and must not be:**

- **`_leafMetaEditable` deliberately returns an empty `DocumentFragment`**: `_mountLeaf` /
  `_updateLeaf` append meta before detail, so moving every editable control into `_leafDetail`
  is how an open tile gets the wizard's field order. Anyone "tidying" it back into returning a
  `.mmeta` div will re-order the tile. (The gate is retired; this reason never depended on it.)
- **Leaf ids are a per-node WeakMap token, not the slug.** The generated map used to key on
  `n.slug`; a slug changes the moment a title is edited, which silently collapsed an open tile
  on the next redraw. `editor.html`'s `applyOpenParam()` depends on the `leaf` id prefix.
- **`render.py`'s `mapDomains()` groups over every node and filters inside each area**, never
  the reverse. An area whose nodes all fail the live search filter must still show its box
  reading "0 nodes"; grouping a pre-filtered list deletes the box instead.
  `MapView.groupByDomain` is deliberately a dumb grouper for that reason, and
  `tests/map-view.test.js` pins it — including a read of the real `<script id="data">` payload
  that prints the fourteen area labels a person actually sees.

`render.py` now **depends on a second file on disk**, so `vercel.json` bundles
`engine/map-view.js` for every function importing `render`, and the read is at **import**
time so a missing bundle is a 500 rather than a map with no boxes (debug.md rule 18).

**Left in deliberately:** `_lib.py`'s `URL_CANDIDATES`/`KEY_CANDIDATES` still try two env-var
names each. Only the live Vercel environment shows which is set, and guessing takes the site
down. Read the dashboard, then cut.

---

## 9. The test gate

Run all of it before any push:

```
node --test tests/*.test.js          # 51 checks across four JS suites
py tests/syntax_check.py             # node --check every inline <script> and .js under web/ and engine/
py engine/validate_content.py        # corpus: 20 error rules, 4 warnings, coverage matrix
py tests/test_validate_content.py
py api/_test_lib.py                  # _lib.py's pure helpers
py tests/check_tradition_maps.py
py tests/check_generated_map.py
```

- **Pass the glob, not the directory.** `node --test tests/` fails on this machine with
  `Cannot find module ...\tests` — a Node 24 / Windows quirk. Bare `node --test` works but
  discovers recursively.
- Each JS suite also runs standalone (`node tests/refs.test.js`) — `test()` auto-runs when the
  file is executed directly.
- **`syntax_check.py` exists because an unescaped apostrophe in `web/gallery.html` blanked the
  entire Browse screen in production.** A module that fails to parse runs none of its lines, so
  the page renders nothing while the server logs stay clean. **Run it before any push touching
  browser code.**
- After any change to `render.py`, re-run the byte-identity check (§1).

---

## 10. Current direction (decided 2026-09-10)

Three assessments were run from first principles — two on UX
(`documentation/ux-firstprinciples-constrained.md`, `-unconstrained.md`) and one on visual
and motion design (`documentation/design-modern-feel.md`). Both UX lanes converged on one
diagnosis: **the app is four correct programs sharing a stylesheet, and the person is the
integration layer.** The unconstrained lane, licensed to propose a rewrite, recommended
against one.

Thomas's decisions:

1. **"The map is the app" is the direction of travel.** Eventually the map is always on
   screen, clickable, editable in place, with compare as a colour layer over it. **The
   map-view unfork (§8) is the enabling step and goes ahead now.** Not a rewrite — both
   reports argue the current architecture can absorb it.
2. **Accounts stay required before the question flow.** An anonymous start was proposed and
   declined; a name and PIN are cheap and every map stays real and saved.
3. **The nav becomes `My map · Questions · Learn · Browse · ⋯`** — four visible items plus a
   native `popover` overflow (Edit, History, Compare, Listing status, Admin, Sign out).
   **This reverses the 2026-08-29 decision** that "My map", History, Unlist/Relist, Learn and
   Compare are tiles on `/` and not nav links, on the grounds that its premise — "six nav
   items is what fits a phone" — is already false in this codebase's own CSS
   (`theme.css`'s `.toplinks` scrolls horizontally below 640px, which is the concession you
   make when items do *not* fit) and that three of the six slots held
   navigation-to-navigation. **`/` keeps every tile it has**: tiles are the discoverable
   surface for a first visit, the nav is the return path for visit forty. Remember the
   `editor.html` hand-copy (§8).

~~Known bug: `/learn`'s "Answer this question" points at `/edit?open=<slug>`~~ — **fixed in P1.**
`web/learn.js` now routes on whether the doctrine actually has a node: `/edit?open=<slug>` when
it does, `/wizard?doctrine=<id>` when it does not. An unanswered doctrine no longer lands a
first-timer on the raw editor's pan/zoom canvas with nothing open.

~~**Growth marker:** `/compare` still eagerly loads all 475 KB of tradition maps. Lazy-loading
the eleven non-target maps is the next performance move.~~ — **closed by P8 on 2026-09-12.**
Both halves of that sentence were wrong. The twelve maps are **408,501 bytes**, not 475 KB, and
the old code fetched the target's own file **twice** — once for the diff, once again inside the
scorecard's `Promise.all`. And it is **all twelve** that had to move, not "the eleven non-target"
ones: `CompareCore.closestTradition` (`engine/compare-core.js:230-264`) tallies **every** scorecard
tradition exactly as `scorecard` does, so the closest-tradition line is a second consumer of the
same full set, not a free rider on the target's map. **Deferring the scorecard alone would have
saved zero bytes.** Both consumers now sit behind one explicit "Show the all-traditions
scorecard" button — not an `IntersectionObserver`, because a scroll must never start a 400 KB
download — and the set is cached at module scope for the visit, since the twelve files are the
same twelve whichever tradition is the target. Eager bytes on first paint: **~416-464 KB down to
7,759-55,197**, the target's own map alone. **The cost is that the closest-tradition line is no
longer on the first screen** — it arrives on the same tap as the scorecard.

The design review (`documentation/design-modern-feel.md`) recommends **evolving the
paper-and-ink language rather than shifting to a next-gen register**, on the grounds that
what reads as dated is 22 font sizes, six uppercase label registers, eight radii, a missing
`color-scheme` and no motion grammar — none of it caused by the palette — and that the
high-tech register is the visual language of *computed authority*, which is the thing this
product's architecture spends its whole existence refusing to be. Its one exception is the
map's **ground plane**. Three defects it found that are live now:

Three of the four were fixed by P3 on 2026-09-10 and are recorded here as history, because
each is easy to reintroduce:

- ~~There is no `color-scheme` property anywhere in the repo~~ — **fixed.** `color-scheme:
  light dark` and `accent-color: var(--ink)` are in all three `:root` copies. Native controls,
  scrollbars, carets and the `<dialog>` backdrop now follow the page in both themes.
- ~~`web/wizard.html` deletes the focus outline from the belief textarea~~ — **fixed.** The
  `outline: none` rule is gone and the ring lives on the wrapper, `.wz-holdfield:focus-within`,
  which is the thing that looks like the control. `engine/theme.css` now carries one shared
  state system — focus, hover, press, `:disabled`, `::selection` — and `web/admin.html` and
  `engine/editor.html` dropped their local `:disabled` rules to it.
- ~~`theme.css` sets `.wz-radio span { min-height: 38px }` inside the 44px block~~ — **fixed,
  and the obvious fix was not enough.** Raising the value alone was **inert**: `web/wizard.html`
  declares `.wz-radio span { min-height: 30px }` at the same specificity and links `theme.css`
  *before* its own `<style>`, so the page-local rule won on source order. The floor is now
  `.wz-radio input + span, .mradio input + span`, which wins on **specificity** and so cannot be
  defeated by a page's link order. **A rule in `theme.css` that must beat a `web/` page's own
  rule needs specificity, not just presence** — every `web/*.html` page links `theme.css` first.
  `engine/editor.html` is the exception, linking it last, which is why `.addbtn`'s deliberate
  34px opt-out there uses a class to beat the element-selector floor.
- ~~**Still live: `prefers-reduced-motion` and hard-coded durations.**~~ — **fixed in P4.** P2
  zeroed `--dur-1/2/3` to `1ms` under the query in all three copies, so any rule reading those
  tokens is guarded by construction; P4 added the blanket `*, *::before, *::after` `!important`
  backstop as the **last rule in `engine/theme.css`** for the ones that hard-code, and a
  hand-copied second copy as the last rule in `render.py`'s embedded stylesheet, because the
  generated map is self-contained and cannot link the stylesheet. **Both must stay last in their
  file.** Two holes needed closing after the fact: `/wizard` animated on **first paint**, because
  `main()` awaits the corpus after the page has already painted and every arrival then went
  through `startViewTransition` (a one-shot `painted` flag in `showScreen` fixes it), and
  `render.py`'s `scrollIntoView({ behavior: 'smooth' })` overrides `scroll-behavior`, so CSS
  could not reach it and it needed its own `matchMedia` guard.

**P4, P5 and P6 shipped 2026-09-11** (session B), 25 commits on top of P1–P3.

- **P4 — Motion.** Cross-document `@view-transition` with `.tm-chrome` Held; `startViewTransition`
  around `showScreen` Holding `#q-title`/`#wz-crumb`/`.wz-nav`; `::details-content` +
  `interpolate-size` for disclosures; `@starting-style` for injected controls; the two guards
  above. **Four verbs and nothing else — Tint, Settle, Travel, Hold — and every duration and
  easing reads a `--dur-*`/`--ease-*` token**, including the `::view-transition-*` pseudos, which
  ran on the UA default until the phase review caught it. `.mbox details.optional::details-content`
  is opted **out** of the disclosure animation on purpose: `map-view.js` measures `offsetHeight`
  synchronously in a `toggle` handler and never re-measures, so an animated open made the tiles
  overlap — the exact bug that handler's own comment exists to prevent.
- **P5 — The question screen.** `.wz-nav` is `position: sticky; bottom: 0`, and its
  `-18px`/`-36px` bleed margins are **hard-bound to `.wz-screen-body`'s `padding: 22px 18px 36px`**
  — not on the spacing scale, and they move together or not at all. `#custom-answer` is a lazily
  built `<details>`; unselected positions render as `<p class="wz-hold">` and swap to a textarea
  inside `pick()`, which every path that sets `chosen` for a position must route through, or
  `currentAnswer()`'s `chosen.hold.value` throws on a revisited question. **The honest height
  reduction is ~25% / ~19%** (three- and six-position doctrines), carried almost entirely by the
  collapsed custom tile: the median corpus `hold` is 213 characters and renders 5–6 lines, so
  swapping a fixed 5-row textarea for a paragraph makes a quarter to two-thirds of positions
  *taller*, and only the `.wz-holdfield` chrome (20px) is a guaranteed saving. The swap is still
  right — a paragraph is the correct rendering for an unpicked choice — and **"Next reachable
  without scrolling" is delivered by the sticky nav, not by height.**
- **P6 — The nav (D6).** The reversal above, implemented. `wizard.js` no longer hides the chrome
  on the question screen, so `.tm-chrome` finally Holds across a question change instead of
  fading, and `#wz-brand` is reduced to the crumb alone because `mount('Build a map')` already
  supplies the kicker and `h1`. `#wz-header` still toggles, so a thin crumb bar still appears and
  disappears — **that residue is by design; Thomas accepted it on 2026-09-11** on the grounds
  that `.tm-chrome`, the half the spec names, no longer moves at all.

**P9 shipped 2026-09-12** (session D), four commits — **the pivot**. The map-view fork is
gone: `engine/map-view.js` is the one source and `render.py` inlines it at render time from a
file it reads at import. ~390 embedded lines deleted, `render.py` down 367 lines net. The
engine gained four options (`readonly`, `leafHTML`, `escapeHtml`, `forceOpen`) and two methods
(`expandAll`, `collapseAll`) so the generated read-only map and the editor share one
implementation instead of two hand-synced ones; the editor passes none of the four and is
unchanged. `MapView.groupByDomain` is the flat-to-grouped adapter, and
`tests/map-view.test.js` is the one test this phase could have (debug.md rule 21), including a
rule-22 read of the real data payload. **The lockstep gate is retired** — see §8 — which
unblocks P10.

**P7 shipped 2026-09-12** (session C), nine commits. **Type and spacing** — every `gap`,
`padding`, `margin`, `border-radius` and `font` shorthand in `engine/theme.css`, all eight
`web/` pages and `render.py`'s embedded stylesheet now reads a token. `.node` and `.tm-card`
share a radius again (9px → `var(--r3)`), which is the change the design review named as the
one that would be felt. **D4 landed: one uppercase register.** `grep -rn "text-transform:
*uppercase" web/ engine/` returns exactly three hits, all `.kicker` — one each in
`theme.css`, `render.py` and `editor.html`, which is the permanent three-way fork, not three
registers. Zero in `web/`. P1 Task 5's deferred rename finished: `.wz-quiet`/`.wz-hint`/
`.lp-hint`/`.wz-framing`/`.lab`/`.lp-pos-label` became four `.tm-*` names across ~41 call
sites in seven files, and the alias selectors are gone.

**Three more inert coarse-pointer floors were found and fixed** — `.lp-row`,
`.cmp-row > summary` and `.cmp-acc > summary` each tied with a later page-local rule and
lost, leaving targets at ~42.3, ~40.3 and ~33.6px. All three now win on **specificity**
(`a.lp-row`, `details.cmp-row > summary`, `details.cmp-acc > summary`), so no page-side edit
can defeat them again. That is the fourth, fifth and sixth instance of this one bug.

**`/compare`'s row summaries clear 44px by 0.29px at 360px** — `.cmp-q`'s
`var(--fs-1)/var(--lh-snug)` line box plus `var(--s3)` padding — and the margin depends on
the `vw` term of a token declared in a different file. **A one-step change to `--fs-1` or
`--lh-snug` drops a touch target under the WCAG floor silently.** Derived in
`engine/theme.css` beside the rule.

**Four questions the whole-phase review raised, all decided by Thomas on 2026-09-12:**

- **The 44px margin on `/compare` stands as documented.** It passes at every width and the
  derivation now sits beside the rule. Not widened — that would be a visual change to the
  diff rows' rhythm with no acceptance criterion behind it.
- **`engine/editor.html`'s header is independent**, not drifted. See §8.
- **The `-.012em` tracking stays**, on the large serif headings and off the small chips. It
  exceeded P7's own stated scope, but it is what design-modern-feel B1 asks for, and B1 notes
  only two rules in the repo were doing it before.
- **P7 ships unwalked, by decision.** Its criteria are greppable and green; nobody has seen a
  rendered page. If a layout problem surfaces during P8, check whether it is P7's before
  blaming the new code.

Still genuinely open for P11: `render.py`'s `dd.rel a` went from a 20px pill to `var(--r2)`,
the one place in the phase a pill became a rounded rectangle; and `.tm-lead`, `.tm-working`,
`.tm-span` and `.chip-select` in `theme.css` have no call site anywhere (all four were
already dead before P7, and P7 spent a substitution re-tokenising the first).

---

## 11. Content working notes

- Source conversation 2026-08-10. Reference points Thomas named: International Network of
  Churches (his movement), Mike Winger, Gavin Ortlund.
- Originally ~35 nodes carried positions Thomas stated directly, with 40 inferred and marked
  `#assumed`. He reviewed all of them on 2026-08-11, so **every node is now his own stated
  position.** 33 remain flagged `#study`.
- **Write node text in Thomas's own voice** — first person or neutral, never second person.
  The original draft addressed him as "you"/"yours"; he rewrote those. Don't reintroduce them.
- Three nodes carried `#thread` before phase 0.5: a sacramental instinct running against
  low-church defaults; the semantic range of "prophecy" and "God told me"; and a higher view
  of the great tradition than the movement usually carries. This was the most load-bearing
  writing in the map, and **Thomas removed it anyway** — told explicitly it would be lost, he
  chose deletion over keeping it as inert data. **Full text recoverable at
  `git show e4f7ba2748a06476d5562ddaf0c8778ea56a6fc8:theology-map.md`.**
- Two corrections worth preserving, because both are easy to re-introduce: Thomas's view of
  Christ's restrained power is **krypsis** (voluntary non-use), *not* ontological kenosis; and
  his answer on the unevangelised is the **Molinist** one (Craig's transworld damnation), not
  inclusivism.
