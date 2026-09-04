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

### T. `order.indexOf(next)` always returned -1 — every path into the wizard's question screen was broken — FIXED (post-phase-8)

Reported as "on a phone, the button doesn't show the screen" — it wasn't phone-specific
at all; `startQuestions()` (fired by `#lens-next` and, on a return visit with a tradition
already picked, `#intro-start`) and `main()`'s own resume branch both crashed on *every*
platform, every time. Confirmed in Node with no browser involved:

```
const order = WG.orderedDoctrines(corpus);
const next = WG.nextDoctrine([], corpus);
order.indexOf(next);              // -1
order[0] === next;                // false — same slug, different object
```

**`allDoctrines()` wraps every doctrine in a fresh `Object.assign({domain}, doctrine)`
on every call**, so `WG.nextDoctrine()` — which calls `orderedDoctrines()` internally —
returns objects that are never reference-equal to anything in `order` (built once in
`main()`). `order.indexOf(next)` therefore always returned `-1`, `renderQuestion(-1)`
read `order[-1]` (`undefined`), and `existingNode(undefined doctrine)` threw
`TypeError: Cannot read properties of undefined (reading 'slug')` — the *first* line
inside `renderQuestion` to touch the doctrine object, which is why the failure looked
so total: nothing about the question screen ever started building.

**Why it looked mobile-only:** it wasn't. The reporter happened to test the flow that
exercises `startQuestions()` on their phone and hadn't hit the identical desktop path
yet; an incognito tab (which only rules out caching) still failed identically, which is
what pointed away from every caching/CSS theory and toward a real, deterministic script
error. **The fix that actually found this was adding error surfacing to a previously
silent failure path** (`renderQuestion`/`startQuestions` had no try/catch anywhere), not
a guess about mobile rendering — the stack trace named the exact line on the first try.

**Fix:** match by `.slug` instead of object identity — `order.findIndex(d => d.slug ===
next.slug)`, extracted as `orderIndexOf()` since both call sites needed it. **Any code
comparing a `WG.nextDoctrine()`/`WG.orderedDoctrines()` result against a *previously
computed* doctrine array with `===` or `.indexOf()` has this exact bug** — those
functions never return the same object twice.

---

### U. `/edit` "shows no file loaded and offers Connect theology-map.md" — the adapter was fine, the copy was not — FIXED (2026-08-27)

Reported as a broken hosted editor. Two hypotheses were chased and both were wrong:
that `boot()` threw before `adapter.buttons.*` hid the file bar, and that
`document.write('<base href="/engine/">')` was not firing so the relative module
imports 404'd. Neither. Probed the live site directly (`/edit`, `/engine/*.js`,
`/web/session.js` all 200; `/edit/` 404s but nothing links it) and then read the
page state with a session in `localStorage`:

```
connect: "none"   upload: "none"   base: ".../engine/"   nav: "My map Gallery Sign out"
```

Hosted mode was hiding the buttons and loading the map correctly the whole time.
What the person actually saw was `engine/editor.html`'s **empty-state paragraph** —
"Connect or upload `theology-map.md` above to start editing…" — which renders in
the List pane whenever the parsed map has zero beliefs. It is the `file://` tool's
copy, it names a file bar hosted mode does not draw, and a brand-new hosted account
has an empty map by definition, so every new user met it.

**The lesson: a bug report quoting on-screen text is a report about that text.**
Grep the exact words before theorising about the machinery that would have had to
fail to produce them. Both wrong hypotheses were about mechanisms; ten seconds of
`grep "Connect or upload"` was the whole investigation.

**The rule it leaves behind:** every visible string in `engine/editor.html`'s markup
is the local tool's wording. Anything hosted-specific is rewritten in the
`if (HOSTED)` branch of `boot()`, never in the HTML — the same convention the
hosted-only nav links already followed.

### V. One CSS class, two builders — the wizard's answer controls rendered twice — FIXED (2026-08-27)

"When I selected a view, then pressed Read more, the What I hold section and the
selectors beneath it were listed twice." Both halves of `web/wizard.js` were
individually correct: `select()` cleared every `.wz-answer` and appended a fresh
one to the chosen card, and `explainer()` returned a `div.wz-answer` holding the
Read-more body. They shared the class name, so the Read-more panel *was* an answer
panel as far as `select()`'s clear/append logic could tell, and the two collided.

The tempting fix is to give the popover a different parent. The real fix is that
**a class used as a selector for clearing is a namespace, and two builders may not
write into it.** `explainer()` now returns `.wz-explain`; every selectable tile
carries a dedicated empty `.wz-slot` that `select()` owns outright. The doctrine-level
`#q-readmore-body` used `.wz-answer` too — moving the per-card Read more into a
popover would have left that one broken.

Same shape as the seam bugs above: check every writer of a shared selector, not the
one the report names.

### W. `/view`'s owner redirect would have trapped anyone who unlisted their own map — CAUGHT IN REVIEW (2026-08-27)

Deleting `/app` moved "My map" onto `/view?name=<own name>`, so `/view` gained a
redirect: an owner whose map renders empty goes to `/wizard` instead of a dead
"Map not found." The first version fired on `!res.ok || !html.includes('mbox-leaf')`.

`POST /api/render {name}` 404s for a map that is merely **unlisted** exactly as it
does for one that does not exist — and self-service unlisting shipped in the same
round. So an owner who unlisted their map would click "My map", get a 404, and be
bounced to the wizard, every time, with no way to reach their own map. Gated on
`res.ok` instead, with the 404 telling an owner it is the unlisted case. (Both ends
have since moved — "My map" and Unlist are tiles on `/` rather than nav links since
2026-08-29 — but the 404 ambiguity that made this a trap has not, so the `res.ok`
gate stays load-bearing.)

**Two features written in the same round, each correct alone.** That is this
project's signature failure and the reason the file opens the way it does: it was
found by asking "who else produces a 404 here?", not by reading either diff again.

### X. The editor's initial markup was a convincing fake of a broken adapter — FIXED (2026-08-27)

A phone screenshot after the §U fix shipped: `/edit`, signed in, a map with real
content, and the page showing the **old** title, no nav, "No file loaded yet." and
the full local file bar — Connect / Upload / Preview / Save to file / Save & render.

The deployed build was correct. Loading the same URL with a session in
`localStorage` returned title `My map`, `btnConnect` `display:none`, the full nav
and the hosted empty-state copy, on both hostnames; `curl` confirmed both edges
served the new file. It was a cached copy of the previous `editor.html` in a phone
browser.

**But the screenshot was indistinguishable from a genuine failure, and that is the
actual defect.** Every file-bar control was visible in the raw markup and hidden
only part-way through `boot()`, which does two dynamic imports and a network load
and **had no error path at all**. So *any* throw in `boot()` — a 404 on a module, a
storage adapter that failed to construct, a stale cached page — leaves the local
tool's controls sitting on a hosted screen, looking exactly like "no file loaded
yet" rather than like an error. This is the same shape as §T: a silent throw
masquerading as a UI state.

Two fixes, both about the failure mode rather than the cache:

- **The file bar starts hidden.** `boot()` reveals what the chosen adapter supports.
  A boot that never finishes now shows nothing misleading instead of showing the
  wrong tool's controls. `fileStatus` starts at "Starting the editor…", and the
  local "No file loaded yet." is set only once local mode is actually known.
- **`boot()` is wrapped**, and a throw reports itself into the status line, naming
  the error and suggesting a reload.

**The lesson: initial markup is a state your users will see, and it should never be
a plausible-looking *wrong* state.** If a page's static HTML happens to look like a
legitimate screen, every startup failure will be misread as that screen — by users
filing reports and by whoever reads them.

### Y. Safari ignores `<base>` when resolving `import()` from an inline classic script — FIXED (2026-08-27)

The real cause of the report §X investigated. Once §X made `boot()` surface its
exception, the phone said it in one line:

> The editor could not start: Importing a module script failed.

`engine/editor.html` had exactly one **relative** dynamic import:

```js
const { createHostedAdapter } = await import('./storage-hosted.js');
```

It depends on the `<base href="/engine/">` that line 12 `document.write`s when the
page is reached at `/edit`. Chrome applies that base and fetches
`/engine/storage-hosted.js`. **Safari does not apply the document base when
resolving a dynamic `import()` from an inline *classic* script** — it resolves
against the page URL — so it asked for `/storage-hosted.js`, which 404s:

```
/storage-hosted.js         404
/engine/storage-hosted.js  200
```

A failed module fetch rejects the promise with a generic "Importing a module script
failed", `boot()` threw, and nothing after it ran: no adapter, no nav, no map, and
(before §X) no error either. Every symptom in one line of resolution.

Fixed by making it absolute — `import('/engine/storage-hosted.js')`. That branch
only runs on the hosted origin, so `file://` never reaches it and the offline tool
pays nothing.

**This is `debug.md` §A and §B a third time**, one layer deeper than either: §A was
a relative *static* import under a rewrite, §B was five relative `<script src>`
tags, and this is a relative *dynamic* import that the fix for §B (the injected
`<base>`) appeared to cover and did not, on one engine. The rule is now without
exception: **under a Vercel rewrite, every path in `editor.html` that is not a
`<script src>`/`<link href>` relied upon by the `file://` tool is absolute.** Do not
let `<base>` stand in for it — one browser honours it and one does not, so a
`<base>`-dependent path is a path that works only where you happened to test.

### Z. A popover anchored to the wrong containing block ran off the left edge of a phone — FIXED (2026-08-29)

Reported as "the Read more goes slightly off the left side of the screen on an iPhone".
`.wz-pop` is `position:absolute; right:0; width:min(420px, 86vw)`, and it was appended to
`.wz-tools` — itself a ~90px absolutely-positioned box pinned to the card's top right. So
`right:0` resolved against *that* box, not the card, and a 420px popover hanging off a 90px
anchor near the right edge of a 390px screen has nowhere to go but off the left. The fix is
the containing block, not the width: the popover's host is now `.wz-card`, which is already
`position:relative`, and it spans `left:10px; right:10px` with no `width` at all.

**The lesson: a `right:0` that misbehaves is a question about which ancestor is
`position:relative`, not about the element's own width.** Any future "clamp it with a media
query" fix on this element is treating the symptom — the popover would still be anchored to
the wrong box, just less visibly.

### AA. The wizard destroyed hand-written fields whenever it re-answered a doctrine — FIXED (2026-08-29)

Not reported. Found by working through "assess how the wizard handles a belief added by
hand in the editor" with `node -e`, before touching any code.

`applyAnswer(..., {revisit: true})` deletes the existing node and rebuilds it from the
corpus. `web/wizard.js`'s `currentAnswer()` sends only `hold`/`tier`/`confidence`/`study`
for a `position` answer. So every other field fell through to a corpus default or to empty:

    BEFORE  todo: "My own open question."   link: ["some-other-node"]   why: "My own reason."
    AFTER   todo: ""                        link: []                    why: <corpus why>

Both files were correct against their own brief — the project's signature shape, a seam
rather than a function. What made it matter is that **the same round turned `revisit` from
a Back-button edge case into the normal path**: the area question list stopped linking to
`/edit?open=<slug>` and started opening the question screen in place, and
`revisit: !!existingNode(doctrine)` is true every time you reopen an answered one.

Fixed in `engine/wizard-generate.js` — where the model logic belongs — by capturing the
existing node before the splice and putting it between the answer and the corpus default:
`answer.x !== undefined ? answer.x : (prev.x || <corpus default> || '')`, with
`_intendedLinks` a de-duplicated union rather than a replacement. The `!== undefined` test
stays first so an explicit empty string still clears; `tests/wizard-generate.test.js` pins
that half separately, because a `prev.x ||` moved ahead of it would pass every other test
in the file.

**The lesson: when a change makes a rare path routine, audit that path before shipping the
change — not the code you edited.** Nothing about task 8's own diff was wrong.

### AB. A redraw performed while its container is `display:none` measures 0×0 and silently eats `needsCenter` — FIXED (2026-08-29)

Latent for as long as the editor opened on the Map tab; reachable the moment List became
the default. `MapView.redraw()` measures every box with `offsetWidth`/`offsetHeight`, which
are 0 for a subtree inside `display:none`. It consumed the `needsCenter` flag against that
zero rect, so the first time the person actually clicked Map, the layout was already
"centred" — on nothing — and the map sat parked off-screen.

The guard is in `editor.html`'s `setTab` (a `mapShown` flag that re-arms `needsCenter` the
first time the Map tab is really shown), **not** in `map-view.js`: `redraw` is
lockstep-bearing with `render.py`'s embedded Map view and must not change. Do not move it.

**The lesson: changing which pane is visible first changes what every measurement in the
hidden pane returns.** Any layout pass that reads `offsetWidth`/`offsetHeight` is a
candidate whenever a default tab, route or accordion state moves.

### AC. No route in the app rendered an unlisted map for its own owner — three correct decisions composing into a dead end — FIXED (2026-09-04, X3)

`api/map.py:31-39` deliberately does **not** guard its `user_id` read on `is_public`,
with a comment explaining that guarding it would lock an owner out of their own unlisted
map. `api/render.py:46` applied `is_public` to **both** branches, `user_id` included.
And `web/landing.html`'s "My map" tile points at `/view?name=`. Each of the three is
defensible on its own; together they mean that unlisting your map and then clicking
"My map" beside it answers *"This map is unlisted, so it does not render by name."*
Export HTML went with it. Neither file's own review would find this, because neither
file is wrong.

Fixed by applying the check to the `name` branch only, with a comment on both branches
naming X3 and pointing at `api/map.py:31-39` — the guard looks like an oversight, and
putting it back reopens the bug.

**The lesson: two routes disagreeing about what one credential authorises is invisible
from inside either route.** Ask what each caller is allowed to do with the same secret,
not whether each route's own check is correct.

### AD. `closestTradition` answered a four-way tie by naming one tradition, with full confidence — FIXED (2026-09-04, F1)

The highest-severity finding in either review. Three defects composed in four lines: the
sort ranked on `score` (a ratio) but broke ties on `numerator` (a raw count) — two
different scales; the tie check only ever inspected `ranked[1]`, so a three- or four-way
tie flagged at most two rows; and the tolerance was `gap <= 3` raw agreements, which
means something entirely different on a 12-question denominator than on an 86-question
one. On a 12-belief map — the likeliest state of any map in this church — four traditions
score 1.000 and the gap to the fourth is 8, so **nothing** was flagged joint and
`/compare` named Non-denominational alone. Reproduced against the real corpus from plain
`node`.

Fixed by comparing on one scale: every row within an epsilon of `ranked[0].score` is
`joint`. `denominatorNote` was deleted with it — it described only `ranked[0]` while the
sentence could name four.

**The lesson — the review's own amendment: what number does this feature say out loud,
and what asserts its value on realistic input?** Sixteen assertions passed throughout;
none of them built a small map and read the sentence back.

### AE. A newline typed into a belief split it into two nodes — FIXED (2026-09-04, B1)

`serializeNode` wrote user text straight into a line-oriented file format. A newline in
`hold` therefore ended the node's field block, and the real node lost its `refs` line to
the fragment: one belief in, two nodes out. Separately, a title containing ` · ` was
re-parsed by `headerTokens` as tier and confidence tokens. Reachable from every text
field in the wizard and the editor, and silent — nothing validated on the way back in.

Fixed at the write: `[\r\n]+` collapses to a space in every field, and `·`/`|` are
stripped from titles. Verified byte-identical output over `theology-map.md` and all
twelve tradition maps, so no existing data moved.

**The lesson: a serializer writing user input into a format with structural characters
needs a neutralisation step at the write, not a validation step at the read.** By the
time the parser sees it, the damage is indistinguishable from content.

### AF. `/learn`'s position cards had double the spacing they were written for — FIXED (2026-09-04)

Reported as "random spaces between lines" on the learn screen. `.lp-pos` (and
`.lp-mine`) are `display:flex; flex-direction:column; gap:8px`, and every row inside
them is a `<p>` — `.lp-pos-label` had no margin at all, so it kept the UA's `1em`
top *and* bottom margin, and `.lp-prose` carries `margin: 0 0 10px` for its use in
ordinary prose elsewhere on the page. **Flex gaps do not collapse margins, they add
to them**: a label sat at 11+8 = 19px below the paragraph above it and 11+8 = 19px
above its own paragraph, and prose-to-next-label was 10+8+11 = 29px, against the 8px
the card was designed around. Fixed by making the gap the only spacing authority
inside the cards — `.lp-pos > *, .lp-mine > * { margin: 0 }`, gap tightened to 6px,
and a 5px top margin on the label so it still reads as attached to the text under it.
Scoped with `>` because `.lp-prose` is also used outside these cards, where its bottom
margin is doing real work; placed after the `.lp-prose`/`.lp-hint`/`.lp-refs`
declarations so the equal-specificity reset wins on order.

**The lesson: in a gap-based flex or grid column, an element's own margin is
double-charged.** Reset margins on the children when you adopt `gap`, or the layout
silently means whatever the UA stylesheet says plus what you wrote.


### AG. Python's `write_text` rewrote three whole files to CRLF, and it shipped — FIXED (2026-09-04)

A twelve-line CSS edit committed as **1814 insertions and 1776 deletions**. `pathlib`'s
`read_text` reads with universal newlines (CRLF becomes `
` in memory) and `write_text`
writes back with `newline=None`, which on Windows translates every `
` to `os.linesep`
— so a script that only touched one selector re-encoded the entire file. The repo is
`core.autocrlf=false` and `.gitattributes` pins **only** the three generated files to
`eol=crlf`; everything else is LF in the index, so this was a real whole-file diff, not a
checkout artefact. It went in unnoticed because the diffstat was read after the commit,
not before.

**Any script editing a repo file on this machine must preserve bytes**: read and write in
binary, or pass `newline=''` (`Path.read_text` only accepts `newline` on Python 3.13+;
this machine is 3.11, so binary is the portable answer). And §P's rule is a *pre-commit*
check, not a post-mortem one — `git diff --stat` before `git commit`, every time.


### AH. A `position: fixed` iframe does not give its document a usable `100vh` on iOS — FIXED (2026-09-04)

`/view`'s first Fullscreen toggle took the map iframe out of flow with `position: fixed;
inset: 0`. The element filled the viewport correctly, but the map *inside* it rendered a
canvas less than half the screen tall with dead space under it: the rendered page sizes
its canvas as `#mapwrap { height: calc(100vh - 130px) }`, and iOS Safari did not resolve
that `100vh` against the iframe's new height. The same page had sized itself correctly
moments earlier as an ordinary in-flow flex child.

Fixed by not moving the iframe at all — `body.tm-enlarged` hides this page's own chrome
and the existing `display:flex; flex-direction:column` layout hands the frame the space.
The layout that already worked keeps working; only the amount of column changes.

**The lesson: an iframe's inner `vh` follows the iframe's used height, and taking the
element out of flow is exactly the case where a browser may not propagate that.** If
the framed document sizes itself in viewport units, resize the frame *within* its
layout — grow the container, don't reposition the frame.


### AI. One apostrophe blanked the whole Browse screen — FIXED (2026-09-04)

`/gallery` rendered nothing: no cards, no skeletons, no error. `/api/gallery` was
answering 200 with three maps the whole time. The cause was in the page's own module —

```js
p.textContent = user ? 'Continue answering questions or start from someone else's map.' : ...
```

an unescaped apostrophe inside a single-quoted string (phase 10, `fc4d7f7`). **A module
that fails to parse never runs at all**, so not one line of the file executed — which is
why even the loading skeletons, built at the top of the same script, never appeared. An
empty page looked like an empty database.

Nothing in the repo parsed the browser-side JavaScript, so a syntax error could reach
production. `py tests/syntax_check.py` now `node --check`s every inline `<script>` and
every `.js` file in `web/` and `engine/` — 28 files, and it found exactly this one.
**Run it before any push that touches browser code.**

**The lesson: "the page shows nothing" is a parse failure until proven otherwise.** Check
that the script parses before investigating what it fetches — a broken module is silent
in a way a broken fetch never is.


### AJ. The map rendered 300px wide on an iPad — an auto margin cancelled the flex stretch — FIXED (2026-09-04)

`/view` showed the map in a ~300px column in the middle of a 1366px iPad window, chrome
and all correct around it. The iframe carries `width: 100%`, so the width had to be
coming from its parent: `engine/theme.css` gives `.tm-main` `margin-inline: auto`, and
**an auto margin on a flex item's cross axis suppresses the stretch that would otherwise
give it the container's width** — the item falls back to shrink-to-fit. `width: 100%`
against a shrink-to-fit parent is circular, so the iframe resolved to its *intrinsic*
replaced-element width, 300px.

It survived review on a phone because 300px is most of a phone's width, so the frame
looked correct there and only a wide screen exposed it. `/view` is the one page that
makes `<body>` a flex column, which is what turned a harmless centring margin into a
sizing rule; every other page has text and grids whose max-content fills the space
anyway. Fixed with `width: 100%; box-sizing: border-box` on `.tm-main` in that page.

**The lesson: an element that is the wrong size is asking about its containing block,
not itself.** `width: 100%` cannot be wrong on its own — it can only resolve against a
parent that has no definite width. And `margin: auto` is a *sizing* declaration inside a
flex container, not just a centring one.


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
6. **A bug that looks like it's inside one file's logic and yet the file's own
   review found nothing wrong is very likely a seam bug.** Ask what environment or
   caller the file assumes, not what the file itself does — every real bug this
   project has produced so far fits that shape (§A–§F, §G).
7. **A button that "does nothing" on tap is a silent-failure report, not a mobile
   report, until proven otherwise.** §T looked platform-specific for two rounds of
   guessing (caching, CSS, touch) before the actual fix was adding a try/catch that
   surfaced the real exception on the first attempt. Any handler with no error
   path is a black box — wrap it before theorising about *why* it's failing.
8. **A bug report that quotes on-screen text is a report about that text.** Grep
   the exact words first. §U burned two hypotheses about broken imports and silent
   throws before `grep "Connect or upload"` found a hard-coded sentence written for
   a different runtime.
9. **"Importing a module script failed" is a 404 on the module, nearly always a
   path that resolved somewhere you did not expect.** Work out the URL the engine
   actually requested and `curl` it (§Y). Do not assume `<base href>` covers a
   dynamic `import()` — Safari does not apply it from an inline classic script.
10. **Before believing a screenshot describes current code, check what the origin
   actually serves.** `curl` the URL and grep for a string only the new build has,
   on every hostname the app answers to. A phone browser holding a stale page looks
   identical to a regression (§X) — and if the served build *is* current, the bug is
   in what the initial markup shows before JS runs, not in the JS.
11. **A class name used to clear elements is a namespace with one owner.** If two
   builders write the same class, one of them will be cleared or duplicated by the
   other's logic (§V). Grep every writer of a shared selector before editing either.
12. **A measurement taken inside `display:none` is zero, not stale.** If a layout
   looks right after a resize but wrong on first paint, ask what was hidden when
   the layout pass ran, and what one-shot flag that pass consumed (§AB). Moving a
   default tab or route is enough to expose it.
13. **When a change turns a rare code path into the common one, audit that path,
   not your diff.** §AA was a data-loss bug in `applyAnswer`'s revisit branch that
   had been latent for as long as revisit meant "the person pressed Back". The
   commit that made it reachable did not touch it.
14. **`wizard-generate.js` and `editor-core.js` are UMD and runnable from plain
   `node -e`, with no browser, DOM, or login needed** — §T was fully reproduced and
   fixed this way, using `WG.loadCorpusSync('content/wizard')`. Reach for this
   before asking a human to reproduce anything that touches the corpus or the
   node model; a `require()` on the same files the browser loads catches shape
   bugs (object identity, missing fields) directly.
15. **When two files answer the same question about the same credential, read them
   side by side, not one at a time.** §AC was three individually-correct decisions —
   one route guarding a lookup, another deliberately not, and a link choosing which
   route runs — that only failed in combination. If a file's comment explains why it
   *doesn't* check something, grep for every other reader of that same field before
   changing either.
16. **A number the UI says out loud needs an assertion on realistic input, not just a
   passing unit suite.** §AD shipped a confidently wrong answer past sixteen green
   assertions, because none of them built a small map and read the resulting sentence.
   These modules are UMD and run from plain `node` (rule 14) — build the smallest real
   case and print what the person would actually see.
17. **"Random" or uneven spacing in a `gap`-based flex/grid container is margins
   adding to the gap, not a broken rule.** Check the children's own margins —
   including the UA defaults on a bare `<p>` — before touching the gap (§AF).
18. **A page that renders *nothing* — not even its own loading state — is a syntax
   error in its module, not a data or network problem.** `py tests/syntax_check.py`
   answers it in one second; check that before reading the API (§AI).
19. **A `width: 100%` element that comes out too small is a question about its parent.**
   Percentages resolve against the containing block, so the parent has no definite
   width — in a flex container, an `auto` cross-axis margin is the usual reason (§AJ).
   Check a wide viewport too: a 300px intrinsic fallback looks correct on a phone.
