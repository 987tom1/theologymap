# debug.md — Theology Mind Map (Project 12)

Non-obvious failure modes found while building and hosting this project. Read before
touching `api/*.py`, `engine/render.py`, `engine/editor.html`, or anything under
`web/`. Full write-ups live in `docs/hosting/phase-*-outcome.md` and
`docs/hosting/phase-2-review.md`; this file is the index plus the lesson, not the
full narrative.

**The pattern behind nearly every real bug this project has produced: it lived in a
seam between two files or two sub-phases, never inside a function's own logic.** A
relative import under a rewrite, a response's content type, a PostgREST status code,
an interpreter's name, a public reply publishing a private write credential. Each
file was individually correct against its own brief. Check the joins, not the parts.

### A. `web/index.html`'s relative `./session.js` import 404s under a Vercel rewrite — FIXED (phase 1b)

`/app` is a **rewrite** to `/web/index.html`, not a redirect — the browser's address
bar and its relative-URL base stay at `/app`, so a relative `./session.js` resolves to
`/session.js`, which doesn't exist. The subagent that wrote the file was correct
against its own brief; the brief didn't name the rewrite trap. Fixed to the absolute
`/web/session.js`. **Every page reached through a rewrite (`/edit`, `/gallery`,
`/view`, `/admin`) must import by absolute path**, not relative.

### B. The same rewrite trap, five files deep, in the editor — DEFENDED (phase 1c)

`/edit` is a rewrite to `/engine/editor.html`, which pulls in five relative resources
(`editor-core.js`, `shared-fields.js`, `map-view.js`, `storage-local.js`, and a link
to `../theology-map.html`) — reproducing §A's bug five times at once if untreated.
Fixed with one line in `<head>`: `if (location.pathname === '/edit')
document.write('<base href="/engine/">')`, scoped to the one path that needs it so
`file://`, `localhost:8420` and direct `/engine/editor.html` access are untouched.

### C. `apiFetch` silently returns `null` on `/api/render`'s HTML response — FIXED (phase 1d)

`session.js`'s `apiFetch` unconditionally calls `res.json()`. `/api/render` returns
`text/html` on success, so `res.json()` throws, the `.catch(() => null)` swallows it,
and since the HTTP status was 200 the caller gets `null` with no error — the page
would have rendered blank with no console error. `web/view.html` now uses plain
`fetch()` + `res.text()`, the same pattern `engine/editor.html`'s `render()` already
used for the identical reason. **`apiFetch` is JSON-in/JSON-out and is the wrong tool
for `/api/render`** — the two call sites that avoid it say so in place.

### D. Every successful admin write returned 500 — PostgREST answers with 204, not 200 — FIXED (phase 1e)

`api/admin.py`'s `reset_pin`, `set_visibility` and admin `save_map` checked
`status != 200`. **PostgREST answers a write with `204 No Content` unless the caller
asks for `Prefer: return=representation`**, so every one of these three *succeeded*
and then reported `500 server_error` — the worst shape of bug: the admin sees a
failure, retries, and the database changed the whole time. `_delete_account` already
had it right (`status not in (200, 204)`), which is what made the inconsistency
visible. Fixed by making all four checks `not in (200, 204)`. Code review missed this
because the bug isn't in the code's logic, it's in an undocumented assumption about
what PostgREST returns on a write.

### E. ILIKE wildcards in the name match — two rounds — FIXED (phase 1e, then phase 2 B3)

**Round 1 (phase 1e).** `verify_credentials` matched names with `name=ilike.<raw
name>`. `%` and `_` are ILIKE metacharacters, so a name containing either could be
handed the wrong row, and signing up as `%` and logging in matched the whole table —
with no `order=`, `rows[0]` is arbitrary, so a lucky PIN match signs in as *anyone*,
admin included. Fixed by escaping `%`, `_` and `\` before building the pattern.

**Round 2 (phase 2, B3).** The escaping wasn't enough: **PostgREST additionally maps
`*` to `%` in `like`/`ilike` values before Postgres ever sees the pattern** — a
character round 1 never escaped. Reproduced live: `{"name":"__phase2_victim*","pin":
"<real PIN>"}` logged in as that user. **Fixed at the root instead of chasing the
next metacharacter**: `verify_credentials` now selects candidate rows and requires an
exact case-insensitive equality **in Python** before comparing the PIN, killing the
whole class of PostgREST pattern semantics rather than escaping one more character.
`api/_test_lib.py` pins the `*` case as a runnable assertion.

### F. `py`, not `python` — the local render server that wouldn't start — FIXED (phase 1e)

`start_editor.bat` shelled out to `python`, which on this machine hits the Microsoft
Store stub and fails silently rather than launching `render_server.py`. **Bare
`python` never works here; only `py` (3.11.9) is reachable.** Every brief or doc that
says `python engine/...` means `py engine/...` — this is now stated directly in
`CLAUDE.md`. Found because this was the third bug in three sub-phases living in a
launcher or a seam rather than a function (alongside §A and §B): "check the
environment an otherwise-correct file runs in," not just the file.

### G. Any stranger could overwrite any public map — no PIN, no account — FIXED (phase 2, B1)

`POST /api/map` authenticates a write with `user_id` + `expected_updated_at` alone.
`api/gallery.py` published **both** — `id` and `updated_at` — for every public row,
signed out, to anyone. Reproduced live against a test account: read the gallery,
POST a vandalised markdown with that id and token, 200. **The gallery handed out
both halves of the write credential.** Neither file was wrong on its own — design
§11.8 chose "possession of the id authorises writing" deliberately, as a
capability-URL model appropriate for a tool whose brief puts security out of scope —
but a later sub-phase published the capability nobody had told was secret. **Fixed
by taking the capability back out of public view**, not by adding auth: `gallery.py`
no longer returns `id`; the public read path is keyed by the already-unique,
already-public `name` instead (`/view?name=`, `api/render.py` accepts `{name}`).
After the fix, `id` exists in exactly two places: the owner's own `localStorage`,
and an admin's `list_users` reply.

**The standing question this leaves for the read path:** see §L below.

### H. Stored XSS in the renderer — a map that runs script on theologymap's origin — FIXED (phase 2, B2)

`engine/render.py`'s `<script id="data" type="application/json">__DATA__</script>`
used `json.dumps(...)` with no escaping. `json.dumps` does not escape `<`, so a node
title containing `</script>` closes the data block early and everything after is
parsed as HTML. Proved live: a title of
`Innocent</script><script>alert(document.domain)</script>` came back verbatim in the
rendered page. The exploitation path is `web/view.html`'s
`<iframe sandbox="allow-scripts allow-same-origin" srcdoc=…>` — `allow-same-origin`
keeps the parent's origin, so injected script could read
`parent.localStorage['theologymap:user']`, the visitor's write credential
(read one map, lose your own). A second smaller instance in the same file:
`data-goto="${l}"` interpolated a raw `link` value without the `esc()` every
neighbouring interpolation used. **Fixed at the root, in the renderer** (so the
export, the local file and the hosted route all inherit it): every `<` in the JSON
payload is emitted as its JSON escape sequence, `data-goto` is `esc()`'d like its
neighbours, and — belt and braces — `allow-same-origin` was dropped from `view.html`'s
sandbox (costs nothing; the rendered map uses no storage, cookies or same-origin
API). **This regenerated `theology-map.html`**, so its byte-identity baseline hash
moved; only phases 2 and 7 have ever been licensed to move it, always via
`py engine/render.py`, never by hand.

### I. A malformed admin call answered 500, not 403 — FIXED (phase 2, B4)

`require_admin(body.get("name"), body.get("pin"))` with no `name` in the body raised
`AttributeError` inside `_like_literal(None)`, which `guard` turned into a generic
`500`. Every *other* rejection (non-admin, wrong PIN, unknown name) was a
byte-identical `403` — deliberately, to avoid user enumeration — and this one path
was a crash, distinguishable from the rest. Fixed by making `verify_credentials`
return `None` for a non-string name or PIN, so the missing-field case joins the
identical 403.

### J. The admin self-delete guard compared strings, not rows — FIXED (phase 2, B5)

`api/admin.py` compared `target_id == admin_row["id"]` as raw strings. Postgres
accepts a uuid in any case; a request body's uppercase id passes the database lookup
but fails the string equality — so an admin passing their own id in uppercase would
delete their own row. **Unrecoverable by any route**: nothing can set `is_admin`, so
the site would have had no admin until Thomas ran SQL by hand. Fixed by comparing the
*looked-up row's* id (always PostgREST's canonical form) instead of the raw request
value.

### K. Every PostgREST path was built by f-string interpolation — HARDENED (phase 2, B6)

`f"/users?id=eq.{user_id}"` etc., unquoted, built from query-string and JSON-body
values. Not exploitable today — the column is `uuid`, so anything surviving
injection makes PostgREST 400; explicit `select=` keys mean an injected duplicate
raises `KeyError`, not a leak — but it's one column-type change away from being real.
Hardened with `quote(str(value), safe="")` at every site.

### L. `GET /api/map` has no ownership check — hidden maps stay readable — NOT FIXED, deliberately (phase 2, B7)

Anyone holding a `user_id` can read that user's markdown, including a map an admin
has since hidden — `is_public` is checked in `api/render.py`, with no counterpart in
`api/map.py`'s `GET`. §G's fix substantially closes this in practice (ids are no
longer published, so "anyone holding a `user_id`" now means "the owner, or an
admin"), but not in principle: an id noted from the gallery *before* that fix still
reads a since-hidden map. Left open because the real fix — `set_visibility` rotating
the row's id on hide — is a data-model change the brief reserves for Thomas, not a
patch a remote session can make unilaterally.

### M. The four empty-save guards, and where `force:true` walks past them — RESIDUAL RISK, not fixed (phase 2, B8)

All four guards exist and were verified present (no-token gate, client shrink guard,
server `would_erase`, local draft copy) — but `force: true` in the save body walks
past guards 2 and 3 together, and the only thing deciding to send it is a `<dialog>`
whose OK button is relabelled by three different call sites in `engine/editor.html`.
The two-tab conflict dialog's "Overwrite" path re-fetches a token and calls
`flushAutosave({force: true})` directly — bypassing the empty-save guards on exactly
the path most likely to be reached in a confused state. None of this is fixed because
each is a UX decision needing a browser to test, which this program's remote-session
model forbids. If you're asked to "harden autosave," read `engine/editor.html`'s save
path line by line rather than trusting this summary — it may have moved.

### N. Two modules both named `render` — a gallery count that could silently bind the wrong one — GUARDED, not proven (phase 3)

`api/gallery.py` does `import render` to reach `engine/render.py`; `api/render.py` is
a sibling module of the identical name on the same `sys.path`. **If a function's
`vercel.json` `includeFiles` ever fails to bundle `engine/render.py`, the import
silently binds the wrong module** and every count comes back zero — a gallery that
looks perfectly healthy and is wrong. Not provable by observation (see §O — there was
no non-empty map to read a real count from at the time), so it's guarded by
construction instead: `parse_text` is resolved off the imported module **at import
time**, so a wrong binding fails the function outright with a 500 rather than quietly
returning zeros. **Any future route importing `render` needs its own `includeFiles`
entry**, and should resolve the attribute it needs at import time for the same
reason.

### O. "node_count: 0 for Thomas" looked like a live bug and wasn't — a wrong turn, recorded so it isn't repeated (phase 3)

`/api/gallery` reported `node_count: 0` for Thomas's hosted row. Read as a bug, it
cost real investigation time and a hardening commit whose message calls it a
production failure. **It was not a bug**: Thomas's *hosted* row is a genuinely empty
map — `theology-map.md` on disk is his personal file and is explicitly not user 1's
database row (Project 13's non-negotiables say so). Confirmed by rendering the
stored map (`POST /api/render {"name":"Thomas"}`) and counting nodes in the embedded
`<script id="data">` block: zero, honestly. **Check what the system actually holds
before concluding the code is wrong about it** — the gallery will keep reporting
zeroes until somebody saves a real map through `/edit`; the 99-node map lives only on
a disk the server has never seen.

### P. `Path.write_text` silently rewrote nine files to CRLF, hiding a 28-line change inside a 2,200-line diff — FIXED (phase 4)

Editing repo files from Python on this (Windows) machine via `pathlib.Path.write_text`
translates `\n` to `\r\n` on write, with no warning. Nine files — `api/_lib.py`,
`api/map.py`, `api/admin.py`, `CLAUDE.md` among them — were silently rewritten
line-ending-wide, so the merge commit's diffstat read `CLAUDE.md | 1121 ++++----` for
what was actually a small addition, and a real 28-line change was buried inside a
diff that looked like a full-file rewrite. Caught at the merge (the diffstat itself
was the tell), fixed on `main`, LF restored on all nine files with every gate
(including byte identity) re-run, never force-pushed. **The repo is LF everywhere
except `documentation/verses.md`, which was already CRLF and stays that way.** There
is no `.gitattributes` catching this — **use `write_bytes`, or pass `newline=""`,
editing a repo file from Python on this machine**, and treat a diffstat many times
larger than the change you made as a line-ending rewrite, not a real diff, before
reading past it.

### Q. An ID selector beat the browser's own `[hidden]` rule — the sign-in boxes never actually hid — FIXED (post-phase-8)

`web/index.html` toggles panes with `$(id).hidden = !ids.includes(id)`, which relies
on the browser's UA-stylesheet rule `[hidden] { display: none }` — an attribute
selector, low specificity. `#signed-out` also carried an author rule,
`#signed-out { display: grid; ... }`, an ID selector, which **outranks** the UA
rule regardless of the `hidden` attribute's presence. So every signed-in visitor to
`/app` still saw the sign-in/create-account boxes: `render()`'s `getUser()` check
and `show()` call were both correct, and the bug was invisible to that code entirely
— it lived in CSS specificity, not logic. Fixed with `#signed-out[hidden] { display:
none; }`, which wins the fight back. **Any pane hidden by toggling the `hidden`
attribute needs its own `[hidden]` override if it also carries an author `display`
rule on the same selector** — nothing else in this file did, which is why only this
one pane was affected.

### R. Two "just produced something" flows dropped straight into the raw editor, not the finished map — FIXED (post-phase-8)

The wizard's Finish button and `first-run.js`'s `copy_from` both did
`location.href = '/edit'` on success — the same target as "Write my first belief",
which makes sense there (nothing to view yet) but not for these two, which just
built or copied a real map. Landing straight in the raw form editor skips the
payoff and makes the editor read as the app's front door rather than one of two
optional next steps. Both now go to `/app` instead, reusing the existing map-home
hub (`View and export` / `Open the editor`, already built) rather than adding a
new screen. Found and fixed from a product-feel complaint, not a script error —
worth remembering that not every "why does this take me to the wrong place" report
is a bug in the destination page; sometimes it's the wrong redirect target upstream.

### S. `engine/editor.html` never carried the site's nav — by original design, not a bug, but incomplete — FIXED (post-phase-8)

The offline tool must load from `file://` with no network, so `editor.html` never
imported `web/chrome.js` (an ES module hitting `/web/session.js`) — correct for the
constraint, but it meant the *hosted* editor had no way back to `/app` or
`/gallery` short of the browser back button, unlike every other `web/*.html` page.
Fixed by dynamically importing `web/session.js` (for `clearUser` only) and adding
`My map` / `Gallery` / `Sign out` links into the existing header's `.toplinks`,
gated behind the same `if (HOSTED)` branch that already dynamically imports
`storage-hosted.js` — so the local tool's `file://` path is completely untouched.
Deliberately not a full `chrome.js` `mount()`: that replaces its host element and
builds its own header, which would have doubled up with `editor.html`'s existing
one (different title, different sub-text, the "Open the map ↗" link) rather than
extending it.

---

## Diagnosing a live failure

1. **A diffstat wildly bigger than the change you made is a line-ending rewrite, not
   a real diff.** Check `git diff --stat` against what you actually edited before
   trusting it — see §P.
2. **`render_markdown` byte identity is the fastest sanity check that the renderer
   hasn't drifted.** `theology-map.md` should hash to a known value both CRLF and
   LF-normalised (current values in `CLAUDE.md`'s "hosted app" section); only phases
   licensed to change the renderer's *output* (2, 7) are allowed to move that hash,
   and only by regenerating with `py engine/render.py` — never by hand.
3. **`py`, never `python`.** Bare `python` hits the Microsoft Store stub and fails
   with no useful error (§F). Any doc still saying `python engine/...` is wrong.
4. **A route importing `render.py` that returns plausible-looking zeros, not an
   error, may be bound to the wrong same-named module.** Check `vercel.json`'s
   `includeFiles` for that function before trusting the count (§N) — and check
   what the database row actually holds before concluding the code is wrong (§O).
5. **A pane that won't hide despite correct JS logic is a CSS specificity bug, not
   a script bug.** If a `hidden`-toggled element also carries an author rule on the
   same selector (`#id { display: ... }`), that ID rule beats the browser's own
   `[hidden] { display: none }`, and toggling the attribute does nothing visible —
   see §Q. Check the stylesheet for a same-selector `display` rule before reading
   the JS a second time.
5. **A bug that looks like it's inside one file's logic and yet the file's own
   review found nothing wrong is very likely a seam bug.** Ask what environment or
   caller the file assumes, not what the file itself does — every real bug this
   project has produced so far fits that shape (§A–§F, §G).
