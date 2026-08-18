# Phase 1 — implementation plan

> **For the session executing this:** each sub-phase below (1a–1e) is a **separate
> session on a separate branch**. Do not attempt more than one in a sitting. Every
> section is written to be pasted in cold, with no memory of any other session.
> Steps use checkbox (`- [ ]`) syntax so progress is trackable.

**Goal:** anyone can make an account, sign in with a name and PIN, edit and
autosave their own map, browse and export other people's, and an admin can
moderate — all against Supabase, all rendered by the existing `engine/render.py`.

**Architecture:** one Postgres table (`users`), six Python serverless functions
under `api/` that own *all* database access with the service-role key, a handful
of static pages under `web/`, and the existing editor gaining a hosted mode behind
a storage-adapter seam. `engine/render.py` gains three small pure functions and
keeps its file-writing wrapper untouched, so the local offline workflow is
unchanged.

**Tech stack:** Python 3.9+ standard library only (no `requirements.txt` entries),
vanilla browser JS with no bundler and no CDN imports, Supabase Postgres via
PostgREST over `urllib`, Vercel static hosting + Python functions.

**Spec:** `docs/hosting/phase-1-design.md`. **Read it alongside this plan** — the
plan argues from it and does not repeat its reasoning.

**Locked decisions:** `docs/hosting/decisions.md`. These are Thomas's calls,
already made. They override the briefs. Do not re-open them and do not ask — he is
away.

---

## Global constraints

Every task's requirements implicitly include all of these.

1. **One render implementation.** `engine/render.py` is the renderer. The hosted
   route imports it. Do **not** port the Map / Domain / Tier / Confidence views or
   the print stylesheet to JS, and do **not** copy `render.py` into `api/`.
2. **The local workflow must keep working, unmodified and offline.**
   `start_editor.bat` → `engine/render_server.py` → `engine/editor.html`, editing
   `theology-map.md` on disk, with Connect / Upload a copy / Save & render all
   behaving exactly as today. No network required.
3. **Do not fork `engine/editor-core.js` or `engine/map-view.js`.** Two copies of
   the parser is the failure mode this project exists to avoid. `editor-core.js`
   is a hand-maintained JS port of `render.py`'s `parse()`; touch one, re-verify
   the other.
4. **Generated files are never hand-edited**: `theology-map.html`,
   `documentation/theology-map.mm`, `documentation/study-list.md`.
5. **Never write verse text from memory.** It comes from the NET Bible API via
   `engine/fetch_verses.py`, which stays local-only. **No serverless route calls
   an external host on a page load.**
6. **The repo is public.** No secrets, no `.env` committed, no service-role key in
   any client-side file. `.env*` must be in `.gitignore`.
7. **There are FOUR views** — Map, Domain, Tier, Confidence. `#thread` was removed
   program-wide by phase 0.5. Do no thread work.
8. **`tier`, `confidence` and `#study` all stay**, in the file format and the UI.
9. **`requirements.txt` stays empty.** If a dependency creeps in, stop and
   reconsider.
10. **Do not read `theology-map.html` or `documentation/verses.md` into context** —
    167 KB of generated output between them. Every check that seems to need them
    is done by hashing instead.
11. **No `claude-in-chrome`, no browser automation, ever.** Verify by reading
    responses, calling functions directly, and running code.
12. **Merging beats waiting.** Merge your sub-phase to `main` once *its own*
    verification passes; the next sub-phase depends on it. **Never force-push,
    never rewrite `main`'s history, and never merge a sub-phase whose verification
    failed** — if it failed, stop and write down precisely why in the outcome file.
13. **Push mechanical work to Sonnet subagents in parallel.** Reserve the main
    thread for judgment calls. Each sub-phase below says explicitly what goes
    where.
14. **A truthful partial phase beats a phase that claims to be done.** If a
    sub-phase is much bigger than described, finish what you can, merge what
    verifies, and say clearly in the outcome file what is missing.

## Environment facts a cold session needs

- Repo: `C:\Users\ThomasPC\Desktop\AIProjects\Project 12 - Theology Mind Map`,
  public at `github.com/987tom1/theologymap`.
- Vercel project `theologymap` under team `thomas-l-s-projects`, auto-deploys on
  push to `main`. Production alias:
  `https://theologymap-thomas-l-s-projects.vercel.app`
  (`theologymap.vercel.app` 404s — do not use it).
- **Vercel Authentication (deployment protection) was ON as of phase 0**, 302ing
  every URL to `vercel.com/sso-api`. Re-test it at the start of every sub-phase:
  `curl -sI https://theologymap-thomas-l-s-projects.vercel.app/`. A 200 means live
  verification is available; a 302 means it is not, and you fall back to
  `vercel dev` or to local-only verification (see each sub-phase's Verification).
- **Python was NOT on PATH as of 2026-08-18.** `python` / `python3` / `py` all hit
  the Microsoft Store stub. Node v24.19.0 **is** present. 1a fixes this first.
- A GitHub Pages deployment also exists at `https://987tom1.github.io/theologymap/`.
  Ignore it; it is not the hosted app.

## File structure this phase produces

| Path | Responsibility | Sub-phase |
|---|---|---|
| `supabase/migrations/20260818120000_users.sql` | the `users` table, indexes, constraints, `updated_at` trigger, RLS on | 1a |
| `requirements.txt` | empty; makes Vercel detect the Python runtime | 1a |
| `vercel.json` | rewrites + `functions.includeFiles` for the render bundle | 1a, extended in 1b/1d |
| `api/_lib.py` | the **only** file that knows Supabase: env resolver, PostgREST over `urllib`, JSON replies, error codes, `verify_credentials`, `require_admin` | 1a, extended 1b/1d |
| `api/render.py` | markdown or `user_id` in → HTML out, via `render.render_markdown` | 1a |
| `api/auth.py` | signup / login | 1b |
| `api/map.py` | GET own map, POST save with optimistic concurrency | 1c |
| `api/gallery.py` | list public maps | 1d |
| `api/admin.py` | five admin actions, each re-verifying name+PIN | 1d |
| `web/session.js` | the one module that knows the `localStorage` key; `apiFetch`, error banner | 1b |
| `web/index.html` | sign in / sign up | 1b |
| `web/gallery.html` | the gallery | 1d |
| `web/view.html` | read-only render of someone's map + Export | 1d |
| `web/admin.html` | admin console | 1d |
| `engine/render.py` | **modified**: +3 pure functions, 2 one-line wrapper rewrites | 1a |
| `engine/storage-local.js` | local adapter: File System Access API + `localhost:8420` | 1c |
| `engine/storage-hosted.js` | hosted adapter: `/api/map`, `/api/render`, autosave | 1c |
| `engine/editor.html` | **modified**: adapter seam + mode switch + autosave indicator | 1c |
| `CLAUDE.md` | **modified**: the new `api/` layer, hosted-vs-local split, schema | 1e |

**Autosave lands in 1c.** **Admin lands in 1b (the credential helpers) and 1d (the
routes and the page).** Both are stated again in place below.

---

---

# 1a — Data model, Supabase wiring, and the render API route

**Model: Opus main thread.** This sub-phase holds the load-bearing decisions and
the byte-identity gate. Very little of it is mechanical.

**Branch:** `phase-1a-schema`

## Preconditions — check all four before writing anything

- [ ] **Phase 0.5's code removal is merged and the tree is clean.** Run
      `git status --short` and `git log --oneline -5`. As of 2026-08-18 the merge
      commit `0f57c4e` ("remove #thread mechanism from code") is on `main`, and it
      says **data untouched** — so a second 0.5 pass over `theology-map.md` may
      still be coming. If `engine/render.py`, `engine/editor.html`,
      `engine/map-view.js` or `theology-map.html` are **dirty**, a 0.5 session is
      still in flight — **stop and wait**. Do not refactor on top of a half-removed
      `#thread`.
- [ ] `git grep -n 'thread' -- engine/render.py engine/map-view.js` returns
      nothing meaningful. If the *code* still handles threads, 0.5 is incomplete —
      stop. `#thread` tokens still present in `theology-map.md` are fine and are
      0.5's remaining data work, not yours; the parser simply treats them as an
      unrecognised flag.
- [ ] **A real Python 3.9+ is on PATH.** `python --version` must print a version,
      not the Microsoft Store message. If it does not, install one
      (`winget install Python.Python.3.12`, then open a new shell) before going
      further. **Every gate in this sub-phase needs it.** If Python genuinely
      cannot be installed, stop and record that in `phase-1a-outcome.md` — 1a
      cannot be verified without it, and an unverified 1a must not be merged.
- [ ] You have read `docs/hosting/phase-1-design.md` §1–§5 and §10.

## Files touched

- Create: `supabase/migrations/20260818120000_users.sql`
- Create: `requirements.txt` (empty)
- Create: `api/_lib.py`, `api/render.py`
- Modify: `engine/render.py` (add three functions, rewrite two wrappers)
- Modify: `vercel.json`, `.gitignore`
- Create: `docs/hosting/phase-1a-outcome.md`

## Tasks

### Task 1a.1 — Capture the pre-refactor baseline hash

This must happen **before** `render.py` is touched. It is what the whole sub-phase
is measured against.

- [ ] **Step 1: Create a pristine worktree at HEAD.**

```bash
cd "C:/Users/ThomasPC/Desktop/AIProjects/Project 12 - Theology Mind Map"
git worktree add ../tmp-baseline HEAD
```

The worktree exists so that `sync_verses()`'s write to `verses.md`, and the `.mm`
and `study-list.md` writes, land somewhere disposable instead of dirtying the repo.

- [ ] **Step 2: Run the unmodified renderer there and hash its output.**

```bash
cd ../tmp-baseline && python engine/render.py && sha256sum theology-map.html
```

Record that hash. Call it `BASELINE_HASH`. **This is the gate.**

- [ ] **Step 3: Hash the committed file, for information only.**

```bash
cd "C:/Users/ThomasPC/Desktop/AIProjects/Project 12 - Theology Mind Map"
sha256sum theology-map.html
```

If it differs from `BASELINE_HASH`, the committed HTML was already stale before
you touched anything. Note it in the outcome file and continue — `BASELINE_HASH`
is still the gate, because it is what the unmodified renderer produces from
today's source. **Do not open either file.**

- [ ] **Step 4: Record the parser-lockstep baseline too.**

```bash
node -e "
const fs=require('fs'), core=require('./engine/editor-core.js');
const src=fs.readFileSync('theology-map.md','utf8');
const once=core.serialize(core.parse(src));
const twice=core.serialize(core.parse(once));
console.log('round-trip stable:', once===twice);
console.log('node count JS   :', core.parse(src).reduce((a,d)=>a+d.nodes.length,0));
"
python -c "
import sys; sys.path.insert(0,'engine')
from pathlib import Path
import render
print('node count PY   :', len(render.parse(Path('theology-map.md'))))
"
```

`round-trip stable: true` and matching node counts are both required. Record both.

### Task 1a.2 — Extract the pure functions from `render.py`

The whole diff is roughly 15 lines. **Resist any temptation to tidy anything
else** — the byte-identity bar rewards the smallest possible change.

- [ ] **Step 1: Rename `parse` to `parse_text` and change its input.**

In `engine/render.py`, the function currently at line 91 becomes:

```python
def parse_text(markdown_text: str) -> list[dict]:
    """Parse the outline text into a flat list of node dicts."""
    nodes: list[dict] = []
    domain = None
    node = None
    last_field = None

    for raw in markdown_text.splitlines():
        ...   # every remaining line of the current body, unchanged
    return nodes
```

The **only** edit inside the body is the loop header: `markdown_text.splitlines()`
replaces `path.read_text(encoding="utf-8").splitlines()`.

- [ ] **Step 2: Add the thin file wrapper back under the original name.**

```python
def parse(path: Path) -> list[dict]:
    """Parse theology-map.md from disk. Thin wrapper over parse_text()."""
    return parse_text(path.read_text(encoding="utf-8"))
```

`main()` and `sync_verses()` keep calling `parse(SRC)` unchanged.

- [ ] **Step 3: Do the same split for `parse_verses`.**

```python
def parse_verses_text(text: str) -> "OrderedDict[str, str]":
    """Parse verses.md *text* into an ordered {reference: text} dict."""
    verses: "OrderedDict[str, str]" = OrderedDict()
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    parts = re.split(r"(?m)^## (.+?)\s*$", text)
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
```

- [ ] **Step 4: Add the hosted entry point.**

```python
def render_markdown(markdown_text: str, verses: "OrderedDict[str, str]") -> str:
    """The whole hosted render path: markdown string in, HTML string out.

    Pure. Reads nothing, writes nothing, needs no ROOT. This is the function
    api/render.py calls.
    """
    return render_html(parse_text(markdown_text), verses)
```

- [ ] **Step 5: Confirm nothing else changed.**

```bash
git diff --stat engine/render.py
```

Expect a small number of changed lines in one file. `render_html`, `render_mm`,
`render_study`, `sync_verses`, `collect_refs`, `slugify`, `esc`, `main()` and
every module constant (`ROOT`, `DOCS`, `SRC`, `VERSES`, `BUILD`, `TIER_META`,
`CONF_META`, …) must be untouched. If `git diff` shows more, revert the extra.

- [ ] **Step 6: Run the byte-identity gate.**

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

**`Path.write_text` is mandatory** — it is what `main()` uses, so it applies the
same Windows newline translation. Writing with `open(..., newline='')` or in
binary mode produces a spurious mismatch that has nothing to do with the refactor.

**PASS = this hash equals `BASELINE_HASH` from Task 1a.1.**

If it does not match, diagnose in this order and write the finding into the
outcome file: (1) `sync_verses()` added a stub between the two runs, so the
`verses` dicts differ — compare `len(v)` in both; (2) the committed HTML was
stale, which Task 1a.1 Step 3 already isolated; (3) node dict key order changed,
which it must not, because `parse_text` builds each dict from the same literal.
**Do not merge 1a on a failed gate.**

- [ ] **Step 7: Confirm the local workflow still runs.**

```bash
python engine/render.py
git status --short
```

It must print its usual node/reference report, and the only files it may change
are the three generated ones (and `verses.md` if a stub was added). Restore them
with `git checkout --` if they changed, so the refactor commit stays clean.

- [ ] **Step 8: Commit.**

```bash
git add engine/render.py
git commit -m "1a: extract parse_text/parse_verses_text/render_markdown as pure functions"
```

### Task 1a.3 — The migration

- [ ] **Step 1: Write `supabase/migrations/20260818120000_users.sql`** — copy the
      DDL from `docs/hosting/phase-1-design.md` §1 verbatim. It creates the
      `pgcrypto` extension, the `users` table (`id`, `name`, `pin`, `markdown`,
      `is_admin` default false, `is_public` default **true**, `created_at`,
      `updated_at`), a unique index on `lower(name)`, a partial gallery index, the
      three length checks, the `touch_updated_at` trigger, and enables RLS with
      **no policies**.
- [ ] **Step 2: Apply it to the live project.** Use the Supabase MCP
      `apply_migration` tool, or the Supabase CLI, or paste it into the dashboard
      SQL editor. The checked-in file is the source of truth either way.
- [ ] **Step 3: Verify the shape came out right** — `list_tables`, or
      `select column_name, data_type, column_default from information_schema.columns
      where table_name = 'users' order by ordinal_position;`. Confirm
      `is_public` defaults `true` and `is_admin` defaults `false`.
- [ ] **Step 4: Prove the concurrency mechanism works before 1c depends on it.**
      Insert one throwaway row, read its `updated_at`, then issue
      `PATCH /users?id=eq.<id>&updated_at=eq.<token>` with
      `Prefer: return=representation` and confirm it returns one row; repeat with
      a stale token and confirm it returns **zero** rows. If the equality filter
      on `timestamptz` misbehaves (text formatting, `+` needing URL encoding),
      switch to the documented fallback in design §8 — a `save_map(p_id, p_expected,
      p_markdown)` SQL function added to the same migration — and say so in the
      outcome file so 1c builds against the right one. Delete the throwaway row.
- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/20260818120000_users.sql
git commit -m "1a: users table migration with is_admin, is_public and updated_at trigger"
```

### Task 1a.4 — Discover the environment variable names

- [ ] **Step 1:** Try `vercel env ls` from the repo. If the CLI is installed and
      authenticated, this is authoritative — record the exact names and skip to
      Step 4.
- [ ] **Step 2:** Try the Vercel MCP tools once. Phase 0 found them blind to this
      project (empty `list_projects`, 404 on lookup, 403 on create). Do not spend
      time here.
- [ ] **Step 3:** If both failed and deployment protection is **off**, deploy a
      throwaway `api/_envcheck.py` that returns the sorted **names only** of
      `os.environ` keys matching `SUPABASE|POSTGRES|DATABASE` — **never a value** —
      `curl` it, record the list, then **delete the file before merging**. If
      protection is on, skip; this is blocked.
- [ ] **Step 4:** Whatever you learned, record the exact variable names in
      `phase-1a-outcome.md` under a heading **"Environment variables 1b–1e must
      use"**. If discovery was blocked entirely, say so plainly and list the
      candidates the resolver will try, so Thomas can confirm from the dashboard.
- [ ] **Step 5:** Add `.env` and `.env.*` to `.gitignore` (it currently holds only
      `__pycache__/`, `*.pyc`, `.venv/`). **Never commit a `.env`.**

### Task 1a.5 — `api/_lib.py`

**Dispatch to a Sonnet subagent** — this is a known-shape module with no judgment
calls once the design is fixed. Give the subagent design §2, §5 and §6, and the
variable names from Task 1a.4.

- [ ] **Step 1:** Subagent writes `api/_lib.py` containing:
  - `URL_CANDIDATES` / `KEY_CANDIDATES` tuples and the `_require(candidates, what)`
    resolver from design §5, raising a `RuntimeError` naming **every** candidate it
    tried.
  - `pg(method, path, body=None, headers=None)` — a PostgREST call over
    `urllib.request` with `apikey` and `Authorization: Bearer <service-role key>`,
    returning `(status, parsed_json, response_headers)`. **Standard library only.**
  - `reply(handler, status, obj)` / `reply_html(handler, status, text)` — JSON and
    HTML responses with the right `Content-Type`.
  - `read_json(handler)` — read `Content-Length` bytes and parse, returning `{}`
    on an empty body.
  - `guard(fn)` — a decorator that turns `RuntimeError` into a 500 whose JSON body
    carries the message verbatim (this is how the missing-variable name reaches
    the screen), and any other exception into a 500 with a generic message.
  - `error(handler, status, code, message)` and the single canonical
    `unknown_user` 404, used by every route.
  - A `class handler(BaseHTTPRequestHandler)` that returns 404 for everything, so
    the file is harmless whether or not Vercel treats `_`-prefixed files as routes.
- [ ] **Step 2:** Main thread reviews it for: no key or URL ever appearing in a
      response body, no `print` of a secret, no third-party import.
- [ ] **Step 3:** `git add api/_lib.py && git commit -m "1a: shared Supabase/PostgREST helper for the api layer"`

### Task 1a.6 — `api/render.py`

Main thread — this one is load-bearing.

- [ ] **Step 1: Write the function.**

```python
from http.server import BaseHTTPRequestHandler
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import render as render_engine          # noqa: E402
from _lib import pg, read_json, reply, reply_html, error, guard   # noqa: E402

_VERSES = None


def verses():
    global _VERSES
    if _VERSES is None:
        _VERSES = render_engine.parse_verses_text(
            (ROOT / "documentation" / "verses.md").read_text(encoding="utf-8")
        )
    return _VERSES


class handler(BaseHTTPRequestHandler):
    @guard
    def do_POST(self):
        body = read_json(self)
        markdown = body.get("markdown")
        if markdown is None:
            user_id = body.get("user_id")
            if not user_id:
                return error(self, 400, "bad_request",
                             "Send either markdown or user_id.")
            status, rows, _ = pg("GET", f"/users?id=eq.{user_id}"
                                        "&select=markdown,is_public,name")
            if status != 200 or not rows:
                return error(self, 404, "unknown_user", "No such map.")
            if not rows[0]["is_public"]:
                return error(self, 404, "unknown_user", "No such map.")
            markdown = rows[0]["markdown"]
        reply_html(self, 200, render_engine.render_markdown(markdown, verses()))
```

Note what is **absent**: no call to `sync_verses`, no write of any kind, no
`labs.bible.org`, no `theology-map.md`.

- [ ] **Step 2: Create an empty `requirements.txt`** at the repo root. Vercel uses
      its presence to detect the Python runtime. It stays empty — `render.py` is
      standard library only. If you ever feel the need to add a line, stop.
- [ ] **Step 3: Extend `vercel.json`** — keep phase 0's `/` rewrite exactly as it
      is, and add:

```json
"functions": {
  "api/render.py": { "includeFiles": "{engine/render.py,documentation/verses.md}" }
}
```

- [ ] **Step 4: Prove the bundle resolves.** Run `vercel dev` if the CLI is
      available and POST `theology-map.md` at it; otherwise deploy to a preview and
      POST there. If the import or the `verses.md` read fails, widen the glob to
      `"{engine,documentation}/**"` and, once only, log the resolved `ROOT` plus a
      directory listing from inside the function to pin the layout down.
      **The fallback is never "copy `render.py` into `api/`."**
- [ ] **Step 5: The end-to-end gate.**

```bash
curl -s -X POST <base>/api/render \
  -H 'Content-Type: application/json' \
  --data-binary @<(python -c "import json,pathlib;print(json.dumps({'markdown':pathlib.Path('theology-map.md').read_text(encoding='utf-8')}))") \
  -o ../tmp-hosted.html
sha256sum ../tmp-hosted.html
```

This should equal `BASELINE_HASH`. If it differs only by line endings, the
transport is normalising newlines — record that fact precisely rather than
"fixing" the renderer, and note that the *local* gate (Task 1a.2 Step 6) is the
one the brief actually names.

- [ ] **Step 6: Commit.**

```bash
git add api/render.py requirements.txt vercel.json .gitignore
git commit -m "1a: hosted render route calling render.render_markdown, with bundled verses.md"
```

## What goes to Sonnet subagents

- `api/_lib.py` (Task 1a.5) — one subagent, known shape.

Everything else stays on the main thread: the `render.py` refactor, the migration,
the byte-identity gate, and env discovery are all judgment calls or gates.

## Verification that gates the merge

| Check | Pass condition |
|---|---|
| Byte identity (**the bar**) | `sha256(render_markdown output)` == `BASELINE_HASH` |
| Local workflow intact | `python engine/render.py` runs and writes all three files, offline |
| Parser lockstep | `once === twice` true; Python and JS node counts equal |
| `git diff engine/render.py` | small, additive, no unrelated restructuring |
| Migration | applied; `is_public` default `true`, `is_admin` default `false`, RLS enabled with no policies |
| Concurrency mechanism | conditional PATCH returns 1 row with a fresh token, 0 with a stale one |
| Secrets | `git diff` contains no key, no URL, no `.env` |
| `requirements.txt` | empty |
| Hosted route | returns HTML; hash matches, or the difference is explained precisely |

Then merge to `main` with `--no-ff` and a message naming the phase.

## Outcome file — `docs/hosting/phase-1a-outcome.md`

Must contain, at minimum:

- The three hashes (`BASELINE_HASH`, committed file, refactored output) and the
  verdict.
- **"Environment variables 1b–1e must use"** — the exact names, or a plain
  statement that discovery was blocked and why.
- Whether `updated_at=eq.` conditional PATCH works, or whether 1c must use the
  `save_map` RPC fallback.
- The **admin bootstrap SQL** Thomas must run once:
  `update public.users set is_admin = true where lower(name) = lower('Thomas');`
- **What would have to change if map history is wanted later** (design §1 has the
  paragraph — copy it).
- Under **"decisions worth revisiting"**: no `rev` column (design §8); no verse
  fetching for hosted users (design §4); server-mediated data access instead of
  the brief's anon key (design §2).
- Whether Vercel deployment protection is still on.

---

---

# 1b — Accounts and PIN login

**Model: Sonnet**, with Opus only if the login edge cases get interesting.

**Branch:** `phase-1b-auth`

## Preconditions

- [ ] Read `docs/hosting/phase-1a-outcome.md` — especially the environment
      variable names and the admin bootstrap SQL.
- [ ] Read `docs/hosting/phase-1-design.md` §2, §6, §9.
- [ ] `main` contains `api/_lib.py`, `api/render.py` and the migration.
- [ ] `curl -sI https://theologymap-thomas-l-s-projects.vercel.app/` — record
      whether deployment protection is still on.

## Context a cold session needs

Security is **explicitly out of scope** for this auth, per the source brief.
Plaintext PIN comparison, `localStorage` for the user id, no hashing, no JWT
library, no rate limiting. **Do not "improve" this into a real auth system.** The
one thing that *is* required, from `decisions.md`: **the PIN never reaches the
client.** Comparison happens inside the serverless function. Since 1a gave the
browser no database access at all, that is satisfied as long as no route ever puts
`pin` in a response body.

**Sign-up is open** — anyone can pick a name and a PIN. No invite code, no gate.

**New users start with an empty map**, not a copy of `theology-map.md`. Thomas's
map is his personal reference copy, not a template. ("Start from a template"
belongs to phase 4's wizard.)

**Keep the UI deliberately plain.** Phase 3 redesigns all of it. Do not invest in
styling.

## Files touched

- Create: `api/auth.py`
- Modify: `api/_lib.py` (add `verify_credentials`, `require_admin`)
- Create: `web/session.js`, `web/index.html`
- Modify: `vercel.json` (add the `/app` rewrite)
- Create: `docs/hosting/phase-1b-outcome.md`

## Tasks

### Task 1b.1 — Credential helpers in `api/_lib.py`

**This is where the admin work starts.** `api/admin.py` does not exist yet — it
lands in 1d — but the helper it will depend on belongs here, next to the login
that uses the identical comparison.

- [ ] **Step 1: Add to `api/_lib.py`.**

```python
def verify_credentials(name, pin):
    """Return the user row for a matching name+pin, else None.

    Plaintext comparison, per the brief — security is out of scope. The point
    of doing it here rather than in the client is that the pin column never
    goes on the wire. Name matching is case-insensitive, matching the
    users_name_lower_key unique index.
    """
    status, rows, _ = pg(
        "GET",
        "/users?select=id,name,pin,is_admin&name=ilike." + quote(name),
    )
    if status != 200 or not rows:
        return None
    row = rows[0]
    return row if row["pin"] == pin else None


class Forbidden(Exception):
    pass


def require_admin(name, pin):
    """verify_credentials(), then is_admin. Raises Forbidden otherwise.

    Every admin action calls this. The is_admin flag is NEVER trusted from
    the client — it is re-read from the database on every single call.
    """
    row = verify_credentials(name, pin)
    if row is None or not row.get("is_admin"):
        raise Forbidden()
    return row
```

- [ ] **Step 2:** Extend `guard` so `Forbidden` becomes a **403** with
      `{"error": "forbidden"}` and no detail — a wrong PIN and a non-admin must be
      indistinguishable from outside.
- [ ] **Step 3: Commit.**

### Task 1b.2 — `api/auth.py`

**Dispatch to a Sonnet subagent.** Give it design §2 and §6 and this task verbatim.

- [ ] **Step 1:** `POST /api/auth` with `{action, name, pin}`.
  - `action: "signup"` — reject a blank name or a PIN outside 4–12 characters with
    400 and a plain message. Insert `{name, pin}`; `markdown` defaults to `''`,
    `is_public` to `true`, `is_admin` to `false`. A unique-violation from
    `users_name_lower_key` (PostgREST returns 409 with code `23505`) becomes
    **409 `name_taken`, "That name is already in use — pick another, or sign in."**
    On success return `{user_id, name, is_admin}`.
  - `action: "login"` — `verify_credentials(name, pin)`. On failure return
    **401 `bad_credentials`** with one message covering both unknown name and wrong
    PIN. On success return `{user_id, name, is_admin}`.
- [ ] **Step 2:** `pin` appears in **no** response body, ever, on any path.
- [ ] **Step 3:** Every other method returns 405.

### Task 1b.3 — `web/session.js`

**Dispatch to a Sonnet subagent, in parallel with 1b.2.**

This is the **one** module that knows the `localStorage` key. Nothing else in the
codebase may read or write it directly — that is what makes 1e's "one consistent
way of getting the current user id" true by construction rather than by cleanup.

- [ ] **Step 1:** Implement, with no framework and no imports:

```js
// web/session.js  — the single source of truth for who is signed in.
const KEY = 'theologymap:user';

export function getUser()  // -> {id, name, is_admin} | null
export function setUser(u) // persists {id, name, is_admin}
export function clearUser()
export function requireUser()  // getUser() or redirect to /app

// Wraps fetch for /api/*: JSON in, JSON out, and centralises two things —
//  * an 'unknown_user' 404 clears the session and sends the page to /app with
//    "That account no longer exists. Please sign in again."
//  * any other error renders the shared banner instead of only hitting console.
export async function apiFetch(path, options)

export function showError(message)   // the shared banner
export function showNotice(message)
```

- [ ] **Step 2:** Load it as `<script type="module">` from every page. **Never
      store the PIN** — only `{id, name, is_admin}`. `is_admin` here decides
      whether an admin *link* is shown and nothing more; the server re-verifies
      every admin action.

### Task 1b.4 — `web/index.html`

**Dispatch to a Sonnet subagent, in parallel.**

- [ ] **Step 1:** Two plain forms — Sign in (name, PIN) and Create an account
      (name, PIN) — a signed-in header strip showing the name with a **Sign out**
      button (which calls `clearUser()`), and links to `/gallery`, `/edit`, and
      `/admin` (the last shown only when `is_admin`).
- [ ] **Step 2:** Handle the three collisions with plain messages, no jargon:
      duplicate name on sign-up, wrong PIN, unknown name.
- [ ] **Step 3:** Add the `/app` → `/web/index.html` rewrite to `vercel.json`.

### Task 1b.5 — Verify and merge

- [ ] Main thread reviews all three subagent outputs together for a consistent
      error shape and no PIN leakage.
- [ ] Run the verification table below.
- [ ] Merge to `main` with `--no-ff`.

## What goes to Sonnet subagents

Tasks 1b.2, 1b.3 and 1b.4 in **parallel** — three independent files with fixed
interfaces. Task 1b.1 and the final review stay on the main thread.

## Verification that gates the merge

Against `vercel dev`, or the deployment if protection is off:

| Check | Pass condition |
|---|---|
| Signup | new name → 200 with a `user_id`; row exists with `markdown = ''`, `is_public = true`, `is_admin = false` |
| Duplicate name | same name again, and with different capitalisation → 409 `name_taken` |
| Login good | correct name+PIN → 200 with `user_id` |
| Login bad PIN | → 401 `bad_credentials` |
| Login unknown name | → 401 `bad_credentials`, **same message** as wrong PIN |
| **PIN leakage** | `grep` every response body from every call for the test PIN — **zero hits** |
| Bad method | GET `/api/auth` → 405 |
| Local workflow | `python engine/render.py` still runs; `git diff` touches nothing under `engine/` |

## Outcome file — `docs/hosting/phase-1b-outcome.md`

The `web/session.js` interface (1c and 1d both import it), the exact error codes
and status codes chosen, whether `verify_credentials`'s `ilike` name match behaved
as expected against the `lower(name)` unique index, and anything 1c/1d must know.

---

---

# 1c — The hosted editor, with autosave

**Model: Opus** to plan the repointing and own the autosave failure modes;
**Sonnet subagents** for the mechanical wiring.

**Branch:** `phase-1c-editor`

## Preconditions

- [ ] Read `docs/hosting/phase-1a-outcome.md` and `phase-1b-outcome.md`.
- [ ] Read `docs/hosting/phase-1-design.md` §7 and §8 **in full**. This sub-phase
      is mostly §8.
- [ ] `main` has `api/_lib.py`, `api/auth.py`, `api/render.py`, `web/session.js`.
- [ ] Node is available: `node --version`.

## The hard requirement

**`start_editor.bat` must still work exactly as it does today** — offline, against
the local `theology-map.md`, with Connect / Upload a copy / Save & render all
behaving unchanged. If a change would make the local tool need the internet or a
database, it is the wrong change.

**Do not fork `engine/editor-core.js` or `engine/map-view.js`.** They are
hand-maintained ports of `render.py`'s `parse()` and Map view. Two copies of the
parser is the failure mode this whole project exists to avoid.

## The chosen shape (decided in design §7 — do not re-litigate)

A **mode switch inside the existing `engine/editor.html`**, behind a storage
adapter. Not a separate hosted entry point. The reason: the editor's ~470-line
application controller lives *inline in `editor.html`*, not in the shared JS
files, so a second entry point would fork it — a third copy of the largest,
least-tested piece.

## Files touched

- Create: `engine/storage-local.js`, `engine/storage-hosted.js`
- Modify: `engine/editor.html` (adapter seam, mode switch, autosave indicator)
- Create: `api/map.py`
- Modify: `vercel.json` (add the `/edit` rewrite)
- Create: `docs/hosting/phase-1c-outcome.md`
- **Not touched:** `engine/editor-core.js`, `engine/map-view.js`,
  `engine/shared-fields.js`, `engine/render.py`, `engine/render_server.py`

## Tasks

### Task 1c.1 — `api/map.py`

**Dispatch to a Sonnet subagent** — but hand it the concurrency and empty-save
rules verbatim; they are not obvious and it must not improvise.

- [ ] **Step 1: `GET /api/map?user_id=<uuid>`** → 200
      `{markdown, updated_at, is_public, name}`, or 404 `unknown_user`.
      `updated_at` is returned as the **opaque concurrency token** — the exact
      string the database produced, never reformatted.
- [ ] **Step 2: `POST /api/map`** with
      `{user_id, markdown, expected_updated_at, force?}`:
  1. 404 `unknown_user` if the row is missing.
  2. **Empty-save guard**: if `markdown` is empty or whitespace while the stored
     row's is not, and `force` is not `true`, return **409 `would_erase`** with
     *"This would erase the whole map. Confirm to continue."*
  3. **Conditional update**:
     `PATCH /users?id=eq.<id>&updated_at=eq.<expected_updated_at>` with
     `Prefer: return=representation`. **Zero rows returned ⇒ 409 `conflict`.**
     One row ⇒ 200 `{updated_at: <new token from the representation>}`.
     If 1a's outcome file says the conditional PATCH was unreliable, use the
     `save_map` RPC fallback it describes instead — same semantics.
  4. Reject `markdown` over 512 KB with 413 (the `users_markdown_len` check
     constraint would otherwise surface as an opaque database error).
- [ ] **Step 3:** Accept a `sendBeacon` POST — the body arrives as a `Blob`, so do
      not require an exact `Content-Type`; parse the body regardless.
- [ ] **Step 4:** No route ever returns `pin`.

### Task 1c.2 — Cut the storage seam in `editor.html`

**Main thread.** This is surgery on a working file; a subagent will not feel where
the seams are.

- [ ] **Step 1: Read `engine/editor.html`'s inline IIFE**, specifically the
      handlers for `btnConnect`, `btnUpload`/`fileInput`, `btnSave` and
      `btnRender`, plus `markLoaded()` and `setStatus()`. That is the entire
      surface that moves.
- [ ] **Step 2: Define the adapter interface** at the top of the IIFE, exactly as
      design §7 specifies:

```js
// { mode, supportsAutosave, init(ui), load(), save(text, token),
//   render(text), buttons: {connect, upload, save, render} }
```

- [ ] **Step 3: Create `engine/storage-local.js`** by **moving** — not rewriting —
      today's handlers into it: `showOpenFilePicker`, the `fileInput` fallback,
      `fileHandle.createWritable()`, and
      `fetch('http://localhost:8420/api/render')` with its existing error message
      about `start_editor.bat`. `supportsAutosave: false`. Preserve the wording of
      every status message; this path is verified by behaviour, not by tests.
- [ ] **Step 4: Add the mode switch** as the first line of the IIFE:

```js
const HOSTED =
  new URLSearchParams(location.search).get('mode') === 'hosted' ||
  !(location.protocol === 'file:' ||
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname));
```

- [ ] **Step 5:** In hosted mode only, inject `<script src="/web/session.js">`
      before booting, so `file://` never requests a URL that does not exist there.
- [ ] **Step 6: Verify local mode is untouched**, before writing a line of hosted
      code: start `start_editor.bat`, Connect, edit a node, Save, Save & render,
      and confirm `theology-map.md` and `theology-map.html` both update. Then
      `git checkout -- theology-map.md theology-map.html` and the two other
      generated files.
- [ ] **Step 7: Commit** the seam on its own, so a later bisect can separate
      "the refactor broke local" from "autosave broke hosted".

### Task 1c.3 — `engine/storage-hosted.js` — load, save, render

**Sonnet subagent**, against the interface Task 1c.2 fixed.

- [ ] **Step 1: `load()`** — `requireUser()` from `web/session.js`, then
      `GET /api/map?user_id=`. Returns `{text, label: user.name, token: updated_at}`.
      On failure, throw; the editor must go read-only with an error, **never
      silently empty** — that is guard 1 of the empty-save defences.
- [ ] **Step 2: `save(text, token)`** — `POST /api/map`. Returns the new token.
      Maps 409 `conflict` and 409 `would_erase` to distinct typed errors the
      editor can branch on.
- [ ] **Step 3: `render(text)`** — `POST /api/render`, take the HTML body, open it
      in a new tab via a Blob URL, and offer a download named
      `theology-map-<slug of user name>.html`.
- [ ] **Step 4:** Hide the Connect and Upload buttons; the Save button becomes the
      autosave indicator. Keep **Preview & copy full text** visible — it is the
      escape hatch when an account has vanished.

### Task 1c.4 — Autosave

**Main thread.** This is the piece `decisions.md` sends phase 2 to review
specifically, and every guard here exists because of a named failure mode.

- [ ] **Step 1: The scheduler.** 1200 ms idle debounce; a forced flush after 15 s
      of continuous editing; flush on `visibilitychange → hidden`; best-effort
      flush on `beforeunload` via `navigator.sendBeacon('/api/map', blob)`. The
      existing `beforeunload` dirty-guard **stays** — it is the real safety net.
      Hook the scheduler onto the same `touch(node)` path the change indicator
      already uses.
- [ ] **Step 2: Skip-if-unchanged.** Serialize, compare to `lastSavedText`, return
      early if equal. Without this, a tab switch bumps `updated_at` and reshuffles
      the gallery for no reason.
- [ ] **Step 3: Guard 1 — no token, no save.** The scheduler must not exist until
      `load()` has succeeded and set `lastSavedText` and `token`.
- [ ] **Step 4: Guard 2 — client shrink guard.** If the new text is empty while
      `lastSavedText` was not, **or** it is under half the old length and the old
      was over 500 characters, do not autosave. Show *"This would delete most of
      your map. Save anyway?"* with an explicit button that resends with
      `force: true`.
- [ ] **Step 5: Guard 4 — local draft.** Before each scheduled save, write the
      serialized text to `localStorage` under `theologymap:draft:<user_id>`; clear
      it on a confirmed save. On load, if a draft exists and is newer than the
      server's `updated_at`, offer to restore it. (Guard 3 is server-side, in Task
      1c.1.)
- [ ] **Step 6: Conflict handling.** On 409 `conflict`: stop autosaving, show a
      blocking banner — *"This map was changed somewhere else (another tab or
      window). Your unsaved changes are still here."* — with exactly two buttons,
      **Reload** (discard local, re-fetch) and **Overwrite** (re-`GET` for the
      current token, then save with it). No third path, and it never resolves
      itself silently.
- [ ] **Step 7: Cross-tab nicety.** `BroadcastChannel('theologymap-editor')` — post
      on every successful save; a tab that hears one it did not send goes read-only
      with the same banner. This is a nicety, **not** the mechanism; the server
      check is the mechanism and also covers two devices.
- [ ] **Step 8: The indicator.** *Saving…* / *Saved 10:42* / *Not saved —
      <reason>*, in the filebar's existing status element. Never silent. A failed
      save must look different from a successful one.
- [ ] **Step 9: Vanished account.** On 404 `unknown_user`, do **not** let
      `session.js` clear and redirect out from under the editor: stop autosave,
      keep the draft, and show *"Your account is no longer available — copy your
      map out before leaving this page"* beside the existing **Preview & copy full
      text** button.

### Task 1c.5 — Re-verify parser lockstep

- [ ] **Step 1:** Run the round-trip check against the live `theology-map.md`:

```bash
node -e "
const fs=require('fs'), core=require('./engine/editor-core.js');
const src=fs.readFileSync('theology-map.md','utf8');
const once=core.serialize(core.parse(src));
const twice=core.serialize(core.parse(once));
console.log('round-trip stable:', once===twice);
"
```

`round-trip stable: true` is mandatory.

- [ ] **Step 2:** Compare node counts from `EditorCore.parse` and
      `render.parse_text` on the same source. They must be equal.
- [ ] **Step 3:** Confirm `git diff` shows **no change** to `editor-core.js` or
      `map-view.js`. If either changed, you forked something. Undo it.

## What goes to Sonnet subagents

- Task 1c.1 (`api/map.py`) and Task 1c.3 (`storage-hosted.js`) — in parallel, once
  Task 1c.2 has fixed the adapter interface.

The seam surgery (1c.2), autosave (1c.4) and lockstep (1c.5) stay on the main
thread.

## Verification that gates the merge

| Check | Pass condition |
|---|---|
| **Local, offline** | `start_editor.bat` → Connect → edit → Save → Save & render all behave as before, with the network off |
| Local mode selection | opening `editor.html` from `file://` and from `localhost:8420` both give local mode |
| Hosted load/save | sign in, edit, wait 2 s, reload — the edit is there |
| Skip-if-unchanged | switching tabs with no edit produces **no** `POST /api/map` |
| **Concurrent tabs** | two tabs, edit both → the second save 409s and the banner appears; Overwrite then succeeds |
| **Empty save** | clear every node → no silent save; confirm → saves; without confirm the server 409s `would_erase` |
| Vanished account | delete the row by hand, edit → the copy-out message appears, no crash, draft still in `localStorage` |
| Parser lockstep | `once === twice` true; node counts equal; **zero diff** in `editor-core.js` / `map-view.js` |
| Save & render (hosted) | returns HTML and offers a download |

## Outcome file — `docs/hosting/phase-1c-outcome.md`

The adapter interface as built; the autosave constants actually used; which of the
four empty-save guards were implemented and which (if any) were not; whether the
conditional PATCH or the `save_map` RPC ended up being used; and under **decisions
worth revisiting**, the `rev` column argument from design §8 — phase 2 should take
that one with Thomas present.

---

---

# 1d — Gallery, export, and the admin surface

**Model: Sonnet.** The gallery and export are small once 1a exists; the admin
routes are mechanical CRUD behind one shared credential check. Opus only for the
final review.

**Branch:** `phase-1d-gallery-admin`

## Preconditions

- [ ] Read `docs/hosting/phase-1a-outcome.md`, `phase-1b-outcome.md`,
      `phase-1c-outcome.md`.
- [ ] Read `docs/hosting/phase-1-design.md` §6 and §9.
- [ ] `main` has `api/_lib.py` with `verify_credentials` and `require_admin` (from
      1b), `api/auth.py`, `api/map.py`, `api/render.py`, `web/session.js`.

## Scope note for a cold session

**The admin surface is not in the original brief.** It comes from
`docs/hosting/decisions.md` and is real, required scope for phase 1. Admin can:
delete an account, reset another user's PIN, hide a map from the gallery, and
edit/restore any map. **Every admin action re-verifies name + PIN server-side; the
`is_admin` flag is never trusted from the client.**

`is_public` already exists on the table with default `true` (1a). 1d is where
something finally toggles it.

**Read-only means read-only** — no edit affordances anywhere on someone else's map.

Keep the UI plain. Phase 3 redesigns it.

## Files touched

- Create: `api/gallery.py`, `api/admin.py`
- Create: `web/gallery.html`, `web/view.html`, `web/admin.html`
- Modify: `vercel.json` (rewrites for `/gallery`, `/view`, `/admin`)
- Create: `docs/hosting/phase-1d-outcome.md`

## Tasks

### Task 1d.1 — `api/gallery.py`

**Sonnet subagent.**

- [ ] **Step 1:** `GET /api/gallery` →
      `GET /users?select=id,name,updated_at&is_public=is.true&order=updated_at.desc`,
      returned as a JSON array.
- [ ] **Step 2:** Return `id`, `name`, `updated_at` and **nothing else**. Not
      `pin`, not `markdown` (that is `/api/render`'s job), not `is_admin`.
- [ ] **Step 3:** No auth required — the gallery is visible signed out.

### Task 1d.2 — `web/gallery.html` and `web/view.html`

**Sonnet subagent, in parallel with 1d.1** (the interface is fixed above).

- [ ] **Step 1: `web/gallery.html`** — fetch `/api/gallery`, render a plain list of
      name + last-updated, each linking to `/view?id=<id>`. Works signed out.
      Empty state: *"No maps yet."* Error state uses `session.js`'s banner, never
      a silent empty list.
- [ ] **Step 2: `web/view.html`** — read `?id=`, `POST /api/render` with
      `{user_id: id}`, and put the returned HTML in a sandboxed `<iframe srcdoc>`
      so the rendered map's own scripts and styles cannot collide with the host
      page. **No edit controls.**
- [ ] **Step 3: Export** — an **Export HTML** button that downloads the same
      response body as
      `theology-map-<slug of that user's name>.html`, via a Blob URL. The render
      route's HTML output *is* the export; do not build a second exporter.
- [ ] **Step 4:** Put the same Export button on the signed-in user's own map, in
      `web/index.html` or the editor's filebar — whichever is one line.

### Task 1d.3 — `api/admin.py`

**Sonnet subagent.** Hand it design §9 verbatim.

- [ ] **Step 1: Every action** takes `{name, pin, action, ...}` and starts with
      `require_admin(name, pin)` from `api/_lib.py`. A wrong PIN and a non-admin
      both give **403 `forbidden`** with no distinguishing detail.
- [ ] **Step 2: The five actions.**

| `action` | Extra fields | Effect |
|---|---|---|
| `list_users` | — | `[{id, name, is_admin, is_public, updated_at, markdown_length}]`. **Never PINs**, never markdown bodies. |
| `delete_account` | `target_id` | `DELETE /users?id=eq.<target_id>` |
| `reset_pin` | `target_id`, `new_pin` | `PATCH` the `pin` column; validate 4–12 characters |
| `set_visibility` | `target_id`, `is_public` | `PATCH` the `is_public` column |
| `save_map` | `target_id`, `markdown` | `PATCH` the `markdown` column; the empty-save guard applies unless `force` is set |

- [ ] **Step 3: Guards.** `target_id` must resolve or the call 404s
      `unknown_user`. An admin cannot `delete_account` their **own** id. There is
      **no action at all** that changes `is_admin` — that stays a SQL statement
      Thomas runs by hand, or open sign-up would let anyone promote themselves.
- [ ] **Step 4:** No response body ever contains a `pin`, not even the one just set
      by `reset_pin`.

### Task 1d.4 — `web/admin.html`

**Sonnet subagent, in parallel with 1d.3.**

- [ ] **Step 1:** A name + PIN box at the top. Hold the PIN **in a JS variable for
      the page's lifetime only** — **never** in `localStorage`. A PIN in
      `localStorage` is exactly the "something a user would be upset to leak" the
      program's non-negotiables warn about.
- [ ] **Step 2:** Call `list_users` and render a table: name, last updated, size,
      public/hidden, admin flag.
- [ ] **Step 3:** Per-row buttons — **Hide** / **Unhide** (`set_visibility`),
      **Reset PIN** (prompts for the new one, then shows it once so the admin can
      pass it on out of band — there is no email), **Edit map** (opens
      `/edit?as=<target_id>`), **Delete** (confirms by making the admin **type the
      target's name**, then `delete_account`).
- [ ] **Step 4:** Show the admin link on `/app` only when `getUser().is_admin`,
      and treat that purely as cosmetic — the server re-checks every call.
- [ ] **Step 5:** Add the `/gallery`, `/view` and `/admin` rewrites to
      `vercel.json`.

### Task 1d.5 — Review and merge

- [ ] Main thread reviews all four subagent outputs together.
- [ ] Run the verification table.
- [ ] Merge to `main` with `--no-ff`.

## What goes to Sonnet subagents

Tasks 1d.1, 1d.2, 1d.3 and 1d.4 — all four in **parallel**; the interfaces above
fix every contract between them. Only the final cross-review is main-thread.

## Verification that gates the merge

| Check | Pass condition |
|---|---|
| Gallery | lists public maps, newest first; visible signed out |
| Hidden map | `set_visibility` false → gone from `/api/gallery`, **and** `POST /api/render {user_id}` for it 404s |
| Read-only view | renders; no edit control anywhere on the page |
| Export | downloads HTML whose hash equals a direct `/api/render` of the same markdown |
| Admin auth | non-admin credentials → 403 on every action; wrong PIN → 403, indistinguishable |
| `delete_account` | the row is gone; that user's `localStorage` id then gets `unknown_user` everywhere |
| `reset_pin` | the new PIN logs in; the old one does not |
| Self-delete | an admin deleting their own id is refused |
| No `is_admin` route | `grep -rn "is_admin" api/` shows only reads, never a write |
| **PIN leakage** | every response body from every route in this sub-phase, grepped for the test PIN — **zero hits** |

## Outcome file — `docs/hosting/phase-1d-outcome.md`

What the admin console can and cannot do; the **"edit / restore" ambiguity** —
restore is implemented as "edit and save", because true restore needs the
`map_versions` table from design §1, which is a data-model change and therefore
**stops and waits** for Thomas; and confirmation that `is_public` now has a real
toggle behind it.

---

---

# 1e — Integration pass

**Model: Opus.** Not new features — the seams four separate sessions left rough.

**Branch:** `phase-1e-integration`

## Preconditions

- [ ] Read all four previous outcome files.
- [ ] `main` has everything from 1a–1d.

## Tasks

### Task 1e.1 — One way to do each thing

- [ ] **Step 1:** `grep -rn "localStorage" web/ engine/` — every hit outside
      `web/session.js` must be either the editor's `theologymap:draft:` key or
      removed. There is **one** way to get the current user id.
- [ ] **Step 2:** `grep -rn "SUPABASE\|supabase\|postgrest" api/ web/ engine/` —
      hits only in `api/_lib.py`. There is **one** place that knows the config.
- [ ] **Step 3:** `grep -rn "fetch(" web/ engine/storage-hosted.js` — every `/api/`
      call goes through `session.js`'s `apiFetch`, so error handling is not
      reimplemented four times.

### Task 1e.2 — Errors reach the user

- [ ] **Step 1:** `grep -rn "console.error" web/ engine/` — every one must be
      accompanied by a visible message. A silent failure is a bug.
- [ ] **Step 2:** Force each failure by hand and confirm the screen says something
      useful: Supabase env var missing (the 500 must name the variable), row
      missing, 409 conflict, 409 would_erase, 403 forbidden, network down.

### Task 1e.3 — Signed-out visitors get a coherent experience

- [ ] **Step 1:** With `localStorage` cleared: `/gallery` and `/view?id=` work;
      `/edit` and `/admin` redirect to `/app` with an explanation rather than
      erroring or rendering half a page.
- [ ] **Step 2:** `/` still serves `theology-map.html` exactly as phase 0 left it.

### Task 1e.4 — Dead code

- [ ] **Step 1:** Remove anything the repointing orphaned — leftover File System
      Access branches in the hosted path, unused status helpers, `api/_envcheck.py`
      if 1a left it behind (it must not reach `main`).
- [ ] **Step 2:** Confirm `requirements.txt` is still empty.
- [ ] **Step 3:** Confirm no `.env` is tracked: `git ls-files | grep -i env`.

### Task 1e.5 — Update `CLAUDE.md`

**This is the contract the next session reads.** Add:

- [ ] The `api/` layer: what each of the six files does, and that `api/_lib.py` is
      the only file that knows Supabase.
- [ ] `render.py`'s entry points: `render_markdown(markdown_text, verses)` is the
      pure function; `main()` is the file wrapper; **one implementation, two
      callers**.
- [ ] The hosted-vs-local split: the storage adapter, the `HOSTED` mode switch, and
      the standing rule that `start_editor.bat` must keep working offline.
- [ ] The Supabase schema, in a short table, and the admin bootstrap SQL.
- [ ] Autosave: that it is hosted-only, and that the local workflow's explicit
      Save & render is unchanged.
- [ ] The `web/` folder and the URL map.

### Task 1e.6 — Full-system pass, then hand off

- [ ] **Step 1:** Signup → edit → autosave → reload → gallery → view → export →
      admin hide → admin reset PIN → login with the new PIN → admin delete, in one
      sitting, recording each result.
- [ ] **Step 2:** Re-run the 1a byte-identity gate one final time — the refactored
      `render_markdown` must **still** hash to `BASELINE_HASH` after four
      sub-phases of change.
- [ ] **Step 3:** Re-run the parser round-trip check.
- [ ] **Step 4:** Run `start_editor.bat` once more, offline, end to end.
- [ ] **Step 5:** Merge to `main` and write the outcome file.

## What goes to Sonnet subagents

Nothing. 1e is judgment — deciding what is duplication and what is legitimate
similarity is exactly the call a subagent cannot make with a cold context.

## Verification that gates the merge

| Check | Pass condition |
|---|---|
| Single source of truth | the three greps in Task 1e.1 come back clean |
| Errors visible | every forced failure produces a visible, accurate message |
| Signed out | gallery and view work; edit and admin redirect cleanly |
| Byte identity | still equals `BASELINE_HASH` |
| Parser lockstep | round-trip stable; `editor-core.js` and `map-view.js` unchanged since 1a |
| Local workflow | `start_editor.bat` works offline, end to end |
| `CLAUDE.md` | describes the system as it now is |
| Secrets | no `.env` tracked; no key in any client file |

## Outcome file — `docs/hosting/phase-1e-outcome.md`

What landed across all of phase 1, what was deferred and why, what surprised you,
and an explicit list of the things **phase 2's review should attack first** — at
minimum the three `decisions.md` names for the black hat: concurrent tabs, an
empty save overwriting real work, and a `localStorage` user id with no matching
row. Add: the service-role-key-everywhere choice from design §2, the `rev`-column
question from §8, and hosted maps having no verse text from §4.

Then hand off to **phase 2**.
