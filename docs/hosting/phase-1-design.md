# Phase 1 — design

Written 2026-08-18 by a planning session with no live user. Thomas is away.
Every question that would normally have been asked was answered from
`docs/hosting/decisions.md`; where it was genuinely silent, the reversible
option was taken and recorded under **Decisions I made for you** (§11).

This file is the *design*. `phase-1-plan.md` is the *implementation plan*,
split along the brief's 1a–1e boundaries. Neither file changes any code.

## Inputs, in precedence order

1. `docs/hosting/decisions.md` — Thomas's locked calls. Override everything below.
2. `Project 13/CLAUDE.md` — program non-negotiables.
3. `Project 13/hosting-brief.md` — requirements of record.
4. `Project 13/phase-1-core-infrastructure.md` — the brief being planned.
5. `Project 12/CLAUDE.md` — the architecture contract.

## Assumed starting state

- **Phase 0.5 has landed for the code**: merge commit `0f57c4e`, "remove #thread
  mechanism from code", is on `main`, and its message says **data untouched** — so
  a second 0.5 pass over `theology-map.md` may still be coming. There are **four**
  views — Map, Domain, Tier, Confidence. Nothing in phase 1 touches threads.
  **1a must not start while a 0.5 session still has `engine/` or
  `theology-map.html` dirty**; leftover `#thread` tokens in `theology-map.md` are
  harmless (the parser treats them as an unrecognised flag) and are 0.5's work,
  not phase 1's.
- Phase 0 landed `vercel.json` with a single rewrite `/` → `/theology-map.html`.
- **Vercel Authentication (deployment protection) is still ON** unless Thomas has
  since turned it off. Every deployment URL 302s to `vercel.com/sso-api` for an
  unauthenticated client. This blocks *all* fetch-the-live-site verification. See
  §10, "Verification under deployment protection".
- **There is no working Python interpreter on this machine.** `python`, `python3`
  and `py` all resolve to the Microsoft Store stub or nothing; there is no
  `C:\Python*`, no `C:\Program Files\Python*`, and no `PythonCore` registry key.
  Phase 0 hit the same wall. Node v24.19.0 *is* present. **1a's first task is to
  get a real Python 3.9+ on PATH**, because 1a's verification bar cannot be met
  without running `render.py`.

---

# 1. Data model

## The DDL

Ships as `supabase/migrations/20260818120000_users.sql`, checked in, and applied
to the live project. Nothing is created by clicking in a dashboard.

```sql
-- Phase 1a — the one table the hosted app needs.
-- One map per user, per hosting-brief.md. No maps table, no versioning.

create extension if not exists pgcrypto;

create table public.users (
    id         uuid        primary key default gen_random_uuid(),
    name       text        not null,
    pin        text        not null,
    markdown   text        not null default '',
    is_admin   boolean     not null default false,
    is_public  boolean     not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Names are the login identifier, so they must be unique, and
-- "thomas" must collide with "Thomas".
create unique index users_name_lower_key on public.users (lower(name));

-- The gallery's only query: public rows, most recently edited first.
create index users_gallery_idx on public.users (updated_at desc) where is_public;

-- Cheap sanity rails. Not security — security is out of scope per the brief.
alter table public.users add constraint users_name_len
    check (char_length(name) between 1 and 60);
alter table public.users add constraint users_pin_len
    check (char_length(pin) between 4 and 12);
alter table public.users add constraint users_markdown_len
    check (char_length(markdown) <= 524288);   -- 512 KB; Thomas's own map is 27 KB

-- updated_at is the optimistic-concurrency token for autosave (§8),
-- so it must be maintained by the database, never by the caller.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger users_touch_updated_at
    before update on public.users
    for each row execute function public.touch_updated_at();

-- Row-level security ON with NO policies. Under PostgREST this means the
-- anon and authenticated roles can read and write exactly nothing. All access
-- goes through the serverless functions in api/, which use the service-role
-- key and bypass RLS by design. See §2 for why.
alter table public.users enable row level security;
```

## Why these columns and no others

| Column | Source | Note |
|---|---|---|
| `id`, `name`, `pin`, `markdown`, `created_at`, `updated_at` | brief 1a | verbatim |
| `is_admin` | decisions.md → Accounts and data | flag only; **never** trusted from the client |
| `is_public` | decisions.md → "defaults true", "exists from 1a" | brief 1d wanted it in 1d; the locked decision pulls it forward |

**No `rev` / `version` column.** Optimistic concurrency uses `updated_at`, which
the brief already mandates. decisions.md says uncovered judgment calls get decided
and documented loudly **except anything touching the data model, which stops and
waits**. Adding a column to solve concurrency would be exactly that. Using a
column the brief already requires is not. See §8.

**No `maps` table, no history table.** The brief forbids it in 1a and asks what
would have to change if history is wanted later. Answer, for the outcome file:

> Add `map_versions(id, user_id, markdown, saved_at)`; have `api/map.py`'s save
> insert a row there before the `UPDATE`; keep `users.markdown` as the head
> pointer so nothing else changes. The editor, gallery, render route and export
> all keep working untouched — they only ever read `users.markdown`. Retention
> would need a cap (last N per user, or an age-based purge) because autosave
> writes far more often than an explicit save button would.

**Admin bootstrap is a SQL statement, not a route.** No API can set `is_admin`,
or open sign-up would let anyone promote themselves. Thomas runs, once, in the
Supabase SQL editor:

```sql
update public.users set is_admin = true where lower(name) = lower('Thomas');
```

This goes in `phase-1a-outcome.md` and in `documentation/README.md`.

## Rejected: PIN-hiding via a view or a column-level grant

The brief suggests "a column the client cannot select". The obvious PostgREST
shape is a `public.users_public` view exposing everything but `pin`, with the base
table's grants revoked. Rejected because §2 removes the client's database access
entirely, which makes the view redundant — one fewer object to keep in sync with
the table, and no risk of a future session adding a column to the table and
forgetting the view.

---

# 2. How data is accessed: server-mediated, no Supabase client in the browser

**Decision: every read and write of the database happens inside an `api/*.py`
serverless function, using the service-role key from a Vercel env var. The browser
never holds a Supabase key of any kind and never talks to Supabase directly. The
only origin the client fetches is its own.**

This is a deliberate deviation from `hosting-brief.md`, which assumed "the anon
key will be in public client code". It satisfies every locked decision more
directly than the anon-key design does, and it is the smaller build.

**Why:**

- **The PIN problem disappears rather than being managed.** decisions.md requires
  PIN comparison server-side against a column the client cannot select. With no
  client database access, *no* column is client-selectable. There is no view to
  maintain, no policy to get subtly wrong, and no way for a later phase to
  accidentally widen the surface.
- **The admin requirement forces server routes anyway.** "Every admin action
  re-verifies name + PIN server-side" means `api/admin.py` must exist and must
  hold service-role credentials. Once that exists, a parallel anon-key path to the
  same table is a second way to do the same thing — precisely the duplication this
  program keeps fighting.
- **No external dependency at page load.** The repo is static with no bundler.
  Using `@supabase/supabase-js` would mean an ESM import from a CDN on every page
  — a third-party host in the critical path, on a site whose other standing rule is
  "the serverless route must not call an external host on page load".
- **`requirements.txt` stays empty.** PostgREST is plain HTTP with a bearer token;
  `api/_lib.py` talks to it with `urllib.request` from the standard library. No
  `supabase-py`, no `httpx`. This matches `render.py`'s standard-library-only
  discipline and keeps the brief's "if a dependency creeps in, stop and reconsider"
  trivially satisfied.
- **1e's job gets smaller.** "One place that knows the Supabase client config" is
  satisfied by construction: `api/_lib.py` is the only file that has ever heard of
  Supabase.

**Costs, stated honestly:**

- The service-role key bypasses RLS, so a bug in a route is a full-table bug. With
  one table, six routes, and a dataset whose worst leak is a church member's
  four-digit PIN, that trade is acceptable — and it is strictly better than the
  anon-key design, where the equivalent bug is a *policy* mistake nobody notices
  because it fails open silently.
- Every page load that needs data costs a Python cold start. The gallery and the
  editor's initial load are one request each. Acceptable.
- More Python, less JS. Six function files total, below the Vercel Hobby plan's
  12-function ceiling, with room for phases 3–6.

**Rejected alternative — anon key in client + `users_public` view.** Fewer server
routes for the read paths, and it is what the brief imagined. Rejected because it
still needs `api/auth.py` and `api/admin.py` for the PIN paths, so it produces two
data-access mechanisms instead of one, plus a CDN import, plus RLS policies whose
failure mode is silent.

**Rejected alternative — service-role key in the client.** Not considered
seriously; it is the one key the program's non-negotiables name explicitly.

---

# 3. The `render.py` extraction

## The finding that shapes everything

`render.py` is already 95% of the way there. Reading it:

- `render_html(nodes, verses) -> str` (line 227) is **already a pure function** of
  its two arguments. It touches no file, resolves no path, and returns the
  complete HTML document as a string.
- `render_mm()` and `render_study()` are likewise already pure.
- The only file-touching code in the render path is `parse(path)` (line 91), which
  does `path.read_text()` on its first line, and `parse_verses(path)` (line 171).
- `sync_verses()` (line 192) *writes* `verses.md`. It is the one function the
  hosted route must never call.
- `main()` (line 1322) is the file-I/O wrapper: parse → sync → render → write
  three files → print a report.

So the "extraction" is not a restructuring. It is three small functions and two
one-line rewrites — roughly 15 lines of diff. This is the single most important
finding in this design: **the brief's hardest-sounding task is its smallest.**

## The exact change

```python
def parse_text(markdown_text: str) -> list[dict]:
    """Parse the outline text into a flat list of node dicts."""
    # ... the entire current body of parse(), with only the loop header changed:
    #     for raw in markdown_text.splitlines():
    # (was: for raw in path.read_text(encoding="utf-8").splitlines():)


def parse(path: Path) -> list[dict]:
    """Parse theology-map.md from disk. Thin wrapper over parse_text()."""
    return parse_text(path.read_text(encoding="utf-8"))


def parse_verses_text(text: str) -> "OrderedDict[str, str]":
    """Parse verses.md *text* into an ordered {reference: text} dict."""
    # ... the entire current body of parse_verses() minus the exists() guard
    #     and the read_text() call.


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
```

`render_html`, `render_mm`, `render_study`, `sync_verses`, `collect_refs`,
`slugify`, `esc` and every module constant are **unchanged**. `main()` is
unchanged — it already has `nodes` in hand and has no reason to route through
`render_markdown`. Leaving it alone reduces the diff to the smallest thing that
can possibly work, which is exactly what a byte-identity bar rewards.

`ROOT`, `DOCS`, `SRC`, `VERSES`, `BUILD` stay as module-level constants. They
evaluate to harmless paths inside the serverless bundle and are never touched by
`render_markdown`. Moving them would be a restructure the brief forbids.

## The two callers

| Caller | Path in | Path out |
|---|---|---|
| `python engine/render.py`, and `render_server.py` which shells out to it | `main()` → `parse(SRC)` → `sync_verses()` → `render_html()` → writes 3 files | unchanged, offline, still writes the `.mm` and `study-list.md` |
| `api/render.py` (hosted) | request body → `render_markdown(md, bundled_verses)` | HTML string in the response; writes nothing |

One implementation. Two callers. No copy-paste. Nothing about the local workflow
changes: `start_editor.bat` → `render_server.py` → `render.py` → `fetch_verses.py`
→ `render.py` is the same sequence it is today, since `render_server.py` invokes
`render.py` as a subprocess and never imports it.

## Rejected: a `--stdin` CLI mode on `render.py`

Have `api/render.py` shell out to `python engine/render.py --stdin`. Rejected:
a subprocess spawn per request on a serverless function, `sys.executable` may not
be what Vercel's runtime expects, and it makes the hosted path depend on argv
parsing rather than a function signature. Importing a module is what Python is for.

## Rejected: moving the pure functions into a new `engine/render_core.py`

Cleaner on paper. Rejected because it doubles the diff, makes `render.py` a shim
whose git history no longer follows the renderer, and the brief explicitly says
"do not restructure it beyond what extracting the pure function requires". Three
added functions in place requires strictly less.

---

# 4. Verses in the hosted route

**Decision: `documentation/verses.md` ships as a read-only bundled asset of the
`api/render.py` function, parsed once per cold start and cached in a module-level
global.** This is the brief's own "pragmatic answer" and nothing found while
reading the code argues against it.

```python
ROOT = Path(__file__).resolve().parent.parent
_VERSES = None

def verses():
    global _VERSES
    if _VERSES is None:
        _VERSES = render_engine.parse_verses_text(
            (ROOT / "documentation" / "verses.md").read_text(encoding="utf-8")
        )
    return _VERSES
```

Bundling is declared in `vercel.json`:

```json
"functions": {
  "api/render.py": { "includeFiles": "{engine/render.py,documentation/verses.md}" }
}
```

`api/render.py` then does `sys.path.insert(0, str(ROOT / "engine"))` and
`import render as render_engine`. If `includeFiles` turns out not to place the
files where `__file__`-relative resolution expects, the fallback is to widen the
glob to `"{engine,documentation}/**"` and log the resolved `ROOT` and a directory
listing from the function once, during 1a, to pin the layout down. **The fallback
is never "copy `render.py` into `api/`."**

`fetch_verses.py` stays exactly as it is: local-only, network-touching, run by
hand or by `render_server.py`. **No serverless route ever calls
`labs.bible.org`.**

## The consequence, stated plainly

A hosted user's map may cite references that are not in Thomas's `verses.md`.
Those popovers render "Not yet added to verses.md" — `render_html`'s
`openPopoverFor` already handles a missing key that way (`verses[ref] || ''` → the
empty-state branch). Nothing breaks, nothing is fabricated, and the program's
hardest rule — never write verse text from memory — is kept by construction.

Filling those gaps is **out of scope for phase 1**. The shape when it is wanted: a
`verses(reference, text, fetched_at)` table seeded from `verses.md`, an
admin-triggered or scheduled function running `fetch_verses.py`'s logic against
the union of all users' references, and `api/render.py` merging the table over the
bundled file. That is a new table — a data-model change — so per decisions.md it
stops and waits for Thomas. Record it in `phase-1a-outcome.md` under "decisions
worth revisiting".

**Rejected: fetch verse text client-side on popover open.** Puts `labs.bible.org`
in the page's runtime path, which phase 0 explicitly verified was *not* the case
today and which the brief forbids. Also fails offline and rate-limits a free
service on behalf of every reader.

**Rejected: put `verses.md`'s content in the database in 1a.** New table,
stop-and-wait rule, and it buys nothing until something actually fetches into it.

---

# 5. Environment variables

## The rule

Vercel↔Supabase is already connected, so the variables exist. The job is to **use
the names Vercel actually exposes**, invent nothing, add nothing, commit nothing.

## Discovery, in order of preference

1. **`vercel env ls`** from the linked repo, if the Vercel CLI is installed and
   authenticated in the session. Cheapest and authoritative. Record the exact
   names.
2. **The Vercel MCP tools.** Phase 0 found them blind to this project (empty
   `list_projects`, 404 on direct lookup, 403 on create). Try once; do not spend
   time on it.
3. **A throwaway diagnostic function.** Deploy `api/_envcheck.py` returning **the
   sorted names only** of `os.environ` keys matching `SUPABASE|POSTGRES|DATABASE`
   — never a value. `curl` it, record the list, then **delete the file in the same
   sub-phase**; it must not reach `main`. Blocked while Vercel Authentication is
   on (§10).
4. **If all three are blocked**: ship the resolver below, which fails loudly with
   the full candidate list, and record the blocker in `phase-1a-outcome.md` as a
   dashboard task for Thomas.

## The resolver

`api/_lib.py` owns this and nothing else does.

```python
URL_CANDIDATES = (
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
)
KEY_CANDIDATES = (
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
)

def _require(candidates, what):
    for name in candidates:
        value = os.environ.get(name)
        if value:
            return name, value
    raise RuntimeError(
        f"Supabase {what} is not configured. Tried, in order: "
        + ", ".join(candidates)
        + ". Set the one Vercel's Supabase integration actually exposes, in "
          "Project Settings -> Environment Variables."
    )
```

Every route wraps its handler so this `RuntimeError` becomes a **500 with the
message in the JSON body**, and the client surfaces it verbatim. That is the
brief's "fail loudly at startup with the missing variable's name" — the failure is
a visible, named error on the page, never an empty gallery.

The candidate lists are the names the Vercel Supabase integration is documented to
publish. They are not invented, and the *first* thing 1a does after discovery
succeeds is cut each list down to the single confirmed name. **No `.env` file is
ever written into the repo**, and `.env*` is added to `.gitignore` in 1a (today it
holds only `__pycache__/`, `*.pyc`, `.venv/`).

Nothing else — no client page, no build step — reads an env var, because §2 gave
the browser nothing to configure.

---

# 6. Route and page inventory

Six Python files under `api/`, comfortably under the 12-function ceiling.

| File | Method | Body / query | Returns |
|---|---|---|---|
| `api/_lib.py` | — | shared: env resolver, PostgREST helper (`urllib`), JSON reply helpers, `verify_credentials()`, `require_admin()`, the single `unknown_user` error | not a route; still ships a `handler` returning 404 so the runtime is happy whether or not `_`-prefixed files are excluded |
| `api/render.py` | POST | `{markdown}` **or** `{user_id}` | `text/html` — the map |
| `api/auth.py` | POST | `{action: "signup"\|"login", name, pin}` | `{user_id, name, is_admin}` |
| `api/map.py` | GET | `?user_id=` | `{markdown, updated_at, is_public, name}` |
| `api/map.py` | POST | `{user_id, markdown, expected_updated_at, force?}` | `{updated_at}` or 409 |
| `api/gallery.py` | GET | — | `[{id, name, updated_at}]`, `is_public` rows only |
| `api/admin.py` | POST | `{name, pin, action, ...}` | per action (§9) |

`api/render.py` accepting `user_id` as well as `markdown` matters: the gallery and
the export button then need **one** round trip instead of two, and a hidden map
cannot be rendered by guessing an id (the route re-checks `is_public`; `markdown`
supplied directly is only ever the caller's own text).

`api/gallery.py` returns `id`, `name`, `updated_at` and nothing else. Not `pin`
(obviously), not `markdown` (the render route's job), not `is_admin` (no reason
for the world to know).

## Pages

Static HTML in a new `web/` folder, so the repo root keeps holding only what a
non-technical person double-clicks (`Project 12/CLAUDE.md`, "Folder layout").

| URL | File | Signed out |
|---|---|---|
| `/` | `theology-map.html` | **unchanged from phase 0** — Thomas's own map |
| `/app` | `web/index.html` — sign in / sign up, links onward | yes |
| `/gallery` | `web/gallery.html` | yes |
| `/view?id=` | `web/view.html` — read-only render + Export | yes |
| `/edit` | `engine/editor.html?mode=hosted` | redirects to `/app` |
| `/admin` | `web/admin.html` | redirects to `/app` |

`vercel.json` gains those rewrites alongside phase 0's. Leaving `/` pointing at
`theology-map.html` is deliberate and reversible: it keeps any link Thomas has
already sent working, and phase 3 owns the question of what the front door should
be. Flagged in §11.

`web/session.js` is the **one** module that knows the `localStorage` key. It
exposes `getUser()` / `setUser()` / `clearUser()` / `apiFetch()` and renders the
shared error banner. Every web page loads it, and so does the hosted editor (§7).
This satisfies 1e's "one consistent way of getting the current user id" up front
rather than repairing it afterwards.

---

# 7. The hosted editor: mode switch, not a second entry point

The brief allows either. **Chosen: a mode switch inside the existing
`engine/editor.html`, behind a storage-adapter interface.**

## Why

The hard rule is "do not fork `editor-core.js` or `map-view.js`". Reading
`editor.html` shows the rule does not go far enough: **the editor's application
logic is not in those files.** It is ~470 lines of inline IIFE inside
`editor.html` — the tree, the List form, the Map tab wiring, change tracking, the
delete and preview dialogs — plus ~230 lines of CSS and the markup itself. A
separate hosted entry point that only `<script src>`s the three shared JS files
would have to duplicate all of that. That is a third fork, of the largest and
least-tested piece, and it is exactly the failure mode the program exists to avoid.

What actually differs between local and hosted is small and has a clean seam:
**where the text comes from and where it goes.** Everything else — parse, model,
tabs, tree, map, serialize — is identical.

## The seam

Extract the file-handling parts of the IIFE behind an adapter object. Two
implementations, in two new files; neither contains any parsing, model or UI logic.

```js
// The interface both adapters satisfy.
{
  mode: 'local' | 'hosted',
  supportsAutosave: boolean,
  async init(ui),                 // wire the filebar; may resolve with no text loaded
  async load(),                   // -> { text, label, token }   token = concurrency token, hosted only
  async save(text, token),        // -> { token }  |  throws Conflict
  async render(text),             // local: POST http://localhost:8420/api/render
                                  // hosted: POST /api/render, hand back the HTML
  buttons: { connect, upload, save, render }   // which filebar controls to show
}
```

- `engine/storage-local.js` — lifts today's `btnConnect` / `btnUpload` / `btnSave`
  / `btnRender` handlers verbatim: the File System Access API, the `fileInput`
  fallback, `fetch('http://localhost:8420/api/render')`, the `fileHandle`
  lifecycle. **Behaviour unchanged, character for character wherever possible.**
- `engine/storage-hosted.js` — `load()` GETs `/api/map?user_id=`, `save()` POSTs
  `/api/map`, `render()` POSTs `/api/render` and opens or downloads the result.
  Hides Connect and Upload; replaces the Save button with the autosave indicator.

Mode selection, one expression at the top of the IIFE:

```js
const HOSTED =
  new URLSearchParams(location.search).get('mode') === 'hosted' ||
  !(location.protocol === 'file:' ||
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname));
```

The local workflow always arrives via `http://localhost:8420/...` or `file://`, so
it always gets local mode — this is provable, not hopeful. The `?mode=hosted`
escape hatch exists so the hosted path can be exercised against a local server.
`/edit` rewrites to `engine/editor.html?mode=hosted`, so the hosted site gets
hosted mode even though the file is also reachable at its raw path.

In hosted mode the page injects `<script src="/web/session.js">` before booting,
so the user id comes from the same one place the web pages use. In local mode that
script is never requested, so `file://` never sees a 404.

## Rejected: `web/edit.html` as a separate hosted entry point

Would need a copy of the editor's markup, CSS and ~470-line controller. Rejected
for the reason above. If a later phase extracts the controller into
`engine/editor-app.js` — which phase 3 may well want — a second entry point
becomes cheap, and this decision can be revisited then at no cost, because the
adapter interface is already the boundary.

## Rejected: `render_server.py` gains a `--hosted` mode

Would put the local server on the hosting critical path. Violates "the hosted app
is additive".

## Parser lockstep

Nothing in this design changes `editor-core.js`'s `parse`/`serialize`, and nothing
changes `render.py`'s `parse()` beyond moving its body into `parse_text()` with
the input line swapped. Lockstep is therefore preserved by construction — but it
is still verified, in 1a *and* 1c, by the round-trip check in §10.

---

# 8. Autosave

Locked by decisions.md: autosave with debounce is the hosted save model, it lands
in **1c**, and phase 2's black hat must specifically cover concurrent tabs, an
empty save overwriting real work, and a `localStorage` id with no matching row.
The local workflow's explicit **Save & render** is unchanged and autosave never
runs there (`storage-local.supportsAutosave === false`).

## Timing

| Knob | Value | Why |
|---|---|---|
| idle debounce | **1200 ms** after the last model change | long enough not to fire per keystroke, short enough that a distracted user loses nothing |
| max wait | **15 s** of continuous editing forces a flush | debounce alone can starve forever while someone types |
| skip-if-unchanged | serialize, compare to `lastSavedText`, return early if equal | a tab switch or a no-op field blur must not bump `updated_at` and reshuffle the gallery |
| flush on hide | `visibilitychange` → `hidden` | the common "switch tabs and forget" case |
| flush on unload | `beforeunload` → `navigator.sendBeacon('/api/map', blob)` | best effort only; the existing `beforeunload` dirty-guard stays as the real safety net |

The filebar's status element becomes the autosave indicator: *Saving…* /
*Saved 10:42* / *Not saved — <reason>*. It is never silent. A save that failed
must look different from a save that succeeded.

## Failure mode 1 — concurrent tabs

Two tabs of the same user, both editing, both autosaving: the last write silently
destroys the other's work.

**Solution: optimistic concurrency on `updated_at`, with no new column.**

- `GET /api/map` returns the row's `updated_at` as an opaque **token**.
- `POST /api/map` sends `{user_id, markdown, expected_updated_at}`. The route
  issues a conditional update — PostgREST
  `PATCH /users?id=eq.<id>&updated_at=eq.<token>` with
  `Prefer: return=representation` — and reads the response.
- **0 rows returned ⇒ somebody else wrote in between ⇒ 409 `conflict`.**
- 1 row returned ⇒ success; the new `updated_at` from the representation becomes
  the client's next token. The token is always the exact string the server
  returned, round-tripped verbatim, never reformatted client-side.
- On 409 the editor **stops autosaving immediately** and shows a blocking banner —
  *"This map was changed somewhere else (another tab or window). Your unsaved
  changes are still here."* — with exactly two buttons: **Reload** (discard local,
  re-fetch) and **Overwrite** (re-`GET` for the current token, then save with it).
  No third path, and it never resolves itself silently.
- Belt and braces within one browser: a `BroadcastChannel('theologymap-editor')`
  ping on every successful save. A second tab that hears one it did not send goes
  read-only with the same banner *before* it can produce a conflicting write. This
  is a nicety, not the mechanism — the server check is the mechanism, and it also
  covers two devices.

**Rejected: add a `rev bigint` column.** Cleaner, and immune to any timestamp
round-tripping quirk. Rejected only because it is a data-model change and
decisions.md says those stop and wait. Note it in `phase-1c-outcome.md` under
"decisions worth revisiting" so phase 2 can take it with Thomas present.

**Documented fallback if `updated_at=eq.` filtering proves unreliable through
PostgREST** (timestamptz text formatting; `+` in the offset needs URL encoding):
replace the conditional PATCH with a single SQL function
`save_map(p_id uuid, p_expected timestamptz, p_markdown text)` returning the new
`updated_at` or NULL, called via `POST /rpc/save_map`. Same semantics, no new
column, one extra object in the migration. **1a proves the PATCH form works in its
smoke test before 1c depends on it.**

## Failure mode 2 — an empty save overwrites real work

The dangerous sequence: load fails or half-fails, the model ends up empty, a
debounce timer fires, and `''` lands on top of a real map.

Four independent guards; a corruption has to defeat all four.

1. **No token, no save.** The autosave scheduler does not exist until `load()` has
   returned successfully and set `lastSavedText` and the token. A failed load
   leaves the editor read-only with an error, not empty and armed.
2. **Client shrink guard.** Before every save, compare the serialized text to
   `lastSavedText`. If the new text is empty while the old was not, **or** it is
   under half the old length and the old was over 500 characters, do not autosave.
   Show *"This would delete most of your map. Save anyway?"* with an explicit
   button. A user can genuinely empty their map — they just have to say so once.
3. **Server guard.** `api/map.py` rejects a save whose `markdown` is empty or
   whitespace while the stored row's is not, with 409 `would_erase`, unless the
   body carries `"force": true`. The client only ever sets `force` from the
   confirmation button in guard 2. A rogue script, a stale tab, or a future bug in
   the editor cannot erase a map without an explicit act.
4. **Local draft.** Every scheduled save first writes the serialized text to
   `localStorage` under `theologymap:draft:<user_id>`, cleared on a confirmed
   save. If the editor reloads and finds a draft newer than the server's
   `updated_at`, it offers to restore it. This is what turns "the network died" or
   "the row vanished" from data loss into an inconvenience.

## Failure mode 3 — a `localStorage` user id with no matching row

Happens after an admin deletes an account, or after the database is reset.

- Every route returns **404 `unknown_user`** for an id it cannot find. There is
  exactly one error code for this, produced in one place in `api/_lib.py`.
- `web/session.js` handles `unknown_user` centrally: clear the stored id, show
  *"That account no longer exists. Please sign in again."*, and send the page to
  `/app`.
- **Except in the editor**, where clearing must not discard work: the editor stops
  autosave, keeps the draft in `localStorage` (guard 4), and shows *"Your account
  is no longer available — copy your map out before leaving this page"* next to
  the existing **Preview & copy full text** button, which already does exactly
  that job and needs no changes.

---

# 9. The admin surface

Not in the brief at all; added by decisions.md. Everything here is new scope that
phase 1 now owns.

## The rule

**`is_admin` is never trusted from the client.** It is returned by `api/auth.py`
only so the UI can decide whether to *show* an admin link. Every admin action
re-sends `name` + `pin`, and `api/admin.py` re-verifies both against the database
and re-checks `is_admin` before doing anything. A non-admin who forges the flag
sees an admin page that returns 403 on every button.

`api/_lib.py`:

```python
def verify_credentials(name, pin):
    """Return the user row for a matching name+pin, else None. Plaintext compare,
    per the brief. Used by api/auth.py's login and by require_admin()."""

def require_admin(name, pin):
    """verify_credentials(), then row['is_admin'] is True, else raise Forbidden."""
```

## The actions

`POST /api/admin` with `{name, pin, action, ...}`:

| `action` | Extra fields | Effect |
|---|---|---|
| `list_users` | — | `[{id, name, is_admin, is_public, updated_at, markdown_length}]`. **Never PINs**, never markdown bodies. |
| `delete_account` | `target_id` | `DELETE` the row. Irreversible; the page confirms by making the admin type the target's name. |
| `reset_pin` | `target_id`, `new_pin` | sets `pin`. The admin tells the user the new PIN out of band; there is no email. |
| `set_visibility` | `target_id`, `is_public` | the "hide a map from the gallery" power. |
| `save_map` | `target_id`, `markdown` | the "edit / restore any map" power. Reuses `api/map.py`'s save logic, bypassing the empty-save guard only with explicit `force`. |

Guards on every action: an admin cannot delete their own account, there is **no
route at all** that changes `is_admin` (that stays a SQL statement), and
`target_id` must resolve to a row or the call 404s with `unknown_user`.

## "Edit / restore any map" — an ambiguity, resolved

decisions.md says admin can "edit/restore any map". With no version history there
is nothing to restore *from*, so `restore` is implemented as: the admin loads the
target's markdown into the editor (via `/edit?as=<target_id>`, which demands
name+PIN on every save), edits it, and saves through `admin.save_map`. Restoring a
*previous* state means pasting back an exported copy. **True restore needs the
`map_versions` table from §1 — a data-model change, so it stops and waits.**
Recorded in `phase-1d-outcome.md`.

## Where the admin page lives

`web/admin.html`: a name+PIN box at the top (held in memory for the page's
lifetime, **never** in `localStorage` — a PIN in `localStorage` is precisely the
"something a user would be upset to leak" the non-negotiables warn about), then
the user table with per-row buttons. Deliberately plain; phase 3 redesigns it.

---

# 10. Verification

## 1a's bar: byte-identical output

The brief's bar is that the extracted pure function's output is byte-identical to
the committed `theology-map.html`, proved **without reading that file into
context**. Both are satisfied by hashing.

**Step 1 — capture a pre-refactor baseline.** Do not trust the committed HTML to
be current; capture the truth instead.

```bash
git worktree add ../tmp-baseline HEAD          # pristine copy, pre-refactor code
cd ../tmp-baseline && python engine/render.py  # regenerates inside the worktree only
sha256sum theology-map.html                    # -> BASELINE_HASH
```

The worktree keeps `sync_verses()`'s write to `verses.md`, and the `.mm` /
`study-list.md` writes, out of the real working tree.

**Step 2 — hash the committed file**, for information:

```bash
sha256sum theology-map.html    # in the real repo
```

If it differs from `BASELINE_HASH`, the committed HTML was already stale before 1a
touched anything (phase 0.5 regenerating it makes this unlikely, but possible).
Say so in the outcome file and continue — `BASELINE_HASH` is the gate, because it
is what the *unmodified renderer produces from today's source*.

**Step 3 — after the refactor**, call the new pure function and hash its output.
**The write must use `Path.write_text`, exactly as `main()` does**, so Windows
newline translation matches; writing with `open(..., newline='')` or in binary
mode produces a spurious difference that has nothing to do with the refactor.

```bash
python -c "
import sys; sys.path.insert(0, 'engine')
from pathlib import Path
import render
md = Path('theology-map.md').read_text(encoding='utf-8')
v  = render.parse_verses_text(Path('documentation/verses.md').read_text(encoding='utf-8'))
Path('../tmp-check.html').write_text(render.render_markdown(md, v), encoding='utf-8')
"
sha256sum ../tmp-check.html
```

**Pass = this hash equals `BASELINE_HASH`.** Three hashes are compared and none of
the files is ever opened. Report all three in `phase-1a-outcome.md`.

Then `git worktree remove ../tmp-baseline` and delete `../tmp-check.html`.

**If it is not byte-identical**, the brief demands a precise explanation. Likely
culprits, in order: `sync_verses()` added a stub between the two runs so the
`verses` dict differs (compare `len(v)` across both); a stale committed HTML,
which step 1 already isolates; or dict key order in the JSON payload, which must
not change because `parse_text` builds each node dict in the same literal order.

## Parser lockstep, in 1a and again in 1c

Node v24.19.0 is present, and `editor-core.js` is already a UMD module that
`require()`s cleanly:

```bash
node -e "
const fs=require('fs'), core=require('./engine/editor-core.js');
const src=fs.readFileSync('theology-map.md','utf8');
const once=core.serialize(core.parse(src));
const twice=core.serialize(core.parse(once));
console.log('round-trip stable:', once===twice);
console.log('matches source   :', once===src);
"
```

`once === twice` is the mandatory gate (parse → serialize → re-parse is
idempotent). `once === src` is informational — the file may not be in exactly the
serializer's canonical whitespace. Additionally, print the node count and a hash
of a normalised model from **both** parsers, so a divergence between
`parse_text()` and `EditorCore.parse()` surfaces as a number rather than a feeling.

## Everything else

- `api/render.py`: POST the contents of `theology-map.md` and hash the response
  body; it must equal `BASELINE_HASH`. This is the end-to-end proof that the
  hosted route and the local renderer are the same renderer.
- `api/auth.py`, `api/map.py`, `api/gallery.py`, `api/admin.py`: exercised by
  `curl` against `vercel dev` locally, or against the deployment if protection is
  off. Signup → login → save → conflict → gallery → admin, checking status codes,
  and **grep every response body for the test PIN — it must never appear**.
- **No `claude-in-chrome`. Ever.** Non-negotiable across the whole program.

## Verification under deployment protection

Vercel Authentication was still on as of `phase-0-outcome.md`, and it 302s every
URL. Each sub-phase must:

1. Re-test it first:
   `curl -sI https://theologymap-thomas-l-s-projects.vercel.app/` — a 200 means
   Thomas turned it off and live verification is available.
2. If it is still on, verify locally with `vercel dev` (which needs the CLI and a
   `.env` pulled by `vercel env pull` into a **gitignored** file).
3. If neither is available, run the *local* verifications — which are the gating
   ones — merge, and record the un-run live checks explicitly in the outcome file.
   Merging beats waiting; claiming an unverified check does not.

---

# 11. Decisions I made for you

Every one is reversible, and none touches the data model or a file format beyond
what decisions.md already locked.

1. **All database access is server-side; no Supabase key in the browser** (§2).
   Deviates from the brief's anon-key assumption. Reversible: adding an anon-key
   client later is purely additive.
2. **`requirements.txt` stays empty; PostgREST is called with `urllib`** (§2).
   Reversible: adding `supabase-py` is one line, if a route ever needs it.
3. **`/` still serves `theology-map.html`** (§6). Phase 3 owns the front door;
   changing it is one line of `vercel.json`.
4. **Hosted pages live in `web/`**, keeping the repo root clickable per Project
   12's `CLAUDE.md`.
5. **Mode switch over a second entry point for the editor** (§7), justified by the
   470-line inline controller. Revisitable free of charge once phase 3 extracts it.
6. **Autosave numbers: 1200 ms debounce, 15 s max wait** (§8). Tuning constants,
   in one place, one line each.
7. **`updated_at` as the concurrency token instead of a `rev` column** (§8), chosen
   specifically to avoid a data-model change while Thomas is away.
8. **Saving your own map needs the `localStorage` id only, not the PIN.** That is
   the brief's model (security out of scope); requiring a PIN per autosave would
   force a PIN into `localStorage`, which is strictly worse. Admin actions always
   need it.
9. **Admin `restore` = "edit and save"** until a version table exists (§9).
10. **No verse fetching for hosted users in phase 1** (§4). Blanks render as
    blanks, which is the program's stated preference over anything invented.
11. **Six consolidated routes with an `action` field**, rather than one route per
    verb — keeps the function count low and the shared-code surface in one file.

---

# 12. Where the brief and the locked decisions genuinely conflict

| Topic | `hosting-brief.md` / phase-1 brief | `decisions.md` | Resolution |
|---|---|---|---|
| Autosave | 1c repoints Save; the brief defers autosave to phase 3 | autosave with debounce, **in 1c**, so phase 2 can review it | decisions win. Lands in **1c**. |
| Admin | absent entirely | `is_admin`, four powers, server-side re-verification every time | decisions win. **New scope for phase 1**: credential helpers land in **1b**, routes and page in **1d**. |
| `is_public` | 1d: "raise it, implement the column even if nothing toggles it" | defaults true, **exists from 1a** | decisions win. Column in **1a**'s migration; the admin hide toggle in **1d**. |
| Number of views | five, including Threads | four — `#thread` removed by phase 0.5 | decisions win. Phase 1 plans against four and does no thread work of its own. |
| Schema columns | `id, name, pin, markdown, created_at, updated_at` | adds `is_admin`, `is_public` | both; the union is §1's DDL. |
| Client key | "the anon key will be in public client code" | "PINs never reach the client" | no key at all (§2) — satisfies the decision more strongly than the brief's shape. |

Nothing else conflicts. Where the brief is silent *and* decisions.md is silent,
§11 applies.
