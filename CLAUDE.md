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

- `84650d62…976146` as written by `Path.write_text` on Windows (CRLF)
- `ad8c2515…e220e44e` LF-normalised (what a Linux-side or hosted check compares against)

Run the full hashes yourself; the abbreviations above are for recognition only.

**Corrected 2026-09-10.** This file previously carried `9a702faf…9d5fda` / `43feab4f…9ea498`,
which had been **stale since `cb08cea`** — `theology-map.html` changed and neither this file nor
the plan index was updated, so the recorded gate had not matched the repo for several commits.
Regenerating on a clean tree hashed to `f5396e31…6db99e` (CRLF), not the recorded value. The
pair above is post-P3 and was verified by regenerating on a clean tree. **When a licensed phase
moves the output, update this pair in the same commit** — a gate nobody can pass is a gate the
next session learns to ignore.

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

**The nav is one list in `web/chrome.js`.** Below 640px it scrolls horizontally rather than
wrapping — that is `engine/theme.css`'s `.tm-chrome .toplinks` rule. `chrome.js` used to set
`flexWrap` inline, and an inline style beats a media query, so that rule was dead from the
day it was written. **Do not put the wrap styles back on the element.**
`engine/editor.html` carries a **hand-written copy of the same list** because it cannot
import `chrome.js` — the documented `file://` exception, kept in step by hand. Any nav
change is two edits.

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

---

## 8. Known forks, and the one being resolved

Some duplication here is deliberate. Know which is which.

| Fork | Status |
|---|---|
| `engine/render.py`'s embedded Map JS (~390 lines) vs `engine/map-view.js` (~430) | **Being resolved** — see below |
| The token `:root` block, forked **three** ways — `engine/theme.css`, `engine/render.py`, `engine/editor.html` | **Permanent, and reconciled 2026-09-10 (P2).** Both generated and `file://` files must be self-contained. Change one, change all three. The old drift (`--good`/`--bad` missing from `render.py`; `--mono`/`--shadow` from the other two) is gone, and `--accent` now has a job as `accent-color`. P2 added eight spacing steps, four radii, three elevations, three durations, three easings and seven type steps to all three. **Still nothing checks that they agree** — the reconciliation was hand-verified, not enforced. |
| `slugify` in `editor-core.js` and `chrome.js` | **Permanent.** An ES module cannot import the former; `file://`-served `editor.html` cannot load the latter. Change one, change the other, **and `render.py`'s too**. |
| `editor-core.js` parser vs `render.py`'s `parse()` | **Permanent lockstep, by hand.** Round-trip fidelity was verified against the live file. Touch either, re-verify both. |
| The nav list in `chrome.js` vs `editor.html` | **Permanent lockstep, by hand.** The documented `file://` exception. |

**The helpers this repo forks are `el`, `escapeHtml` and `slugify`.** They now live in one
place each — `el` and `slugify` exported from `web/chrome.js`, `escapeHtml` from
`engine/editor-core.js` (which `editor.html` loads first, so the global is there for
`map-view.js` and `shared-fields.js`). **Another copy of any of them is a bug in waiting.**

**`citeLink`/`sourceLine` live in `web/refs.js`**, parameterised by class name and an optional
`onFollow`. `refs.js` stays **DOM-free and takes `el` as an argument** rather than importing
`chrome.js`: `tests/refs.test.js` `require()`s it under plain Node, where an absolute
`/web/...` import resolves against the filesystem root and fails.

### The map-view unfork — decided work

The largest duplication in the repo, hand-kept in lockstep. **Decided 2026-09-10 to resolve
it** (see §10). The sketch: make `map-view.js` the one source and have `render.py` inline it
with a second `.replace("__MAPJS__", …)` beside `__DATA__`. The two consumers read different
input shapes — a flat `nodes` array vs the editor's grouped `domains` — so it needs a small
adapter, and a browser to verify pan, zoom, pinch and detail-open. **Not a test-covered
change. It gets its own session.**

**Until it lands, the lockstep rule is precise.** Only three functions —
`_leafHeaderEditable`, `_leafMetaEditable`, `_leafDetail` — have no counterpart in
`render.py`'s embedded view and are the only ones a hosted-UI phase may touch.
`_leafHeaderReadonly`, `_leafMetaReadonly`, `_mboxHTML`, `redraw`, `assignX`, `assignY`,
`edges`, `_bindPanZoom` and `MAP_TWO_SIDE_BREAK = 860` are lockstep-bearing and must not
change. The merge gate is `git diff -U0 main -- engine/map-view.js | grep '^@@'` showing hunks
in those three functions and nowhere else. Anything wanting a new public method on `MapView`
should drive it from `editor.html` instead — see `applyOpenParam()`.
**`_leafMetaEditable` deliberately returns an empty `DocumentFragment`**: `_mountLeaf` /
`_updateLeaf` append meta before detail, so moving every editable control into `_leafDetail`
is how an open tile gets the wizard's field order without touching those two lockstep-bearing
builders. Anyone "tidying" it back into returning a `.mmeta` div will re-order the tile.

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

**Growth marker:** `/compare` still eagerly loads all 475 KB of tradition maps. Lazy-loading
the eleven non-target maps is the next performance move.

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
- **Still live: `prefers-reduced-motion` and hard-coded durations.** P2 zeroes `--dur-1/2/3` to
  `1ms` under `prefers-reduced-motion: reduce` in all three copies, so **any rule reading those
  tokens is guarded by construction.** But `render.py`'s `.mbox` transition still hard-codes
  `transform .28s ease` and is not guarded. P4 owns the blanket `*` backstop that catches
  hard-coded durations.

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
