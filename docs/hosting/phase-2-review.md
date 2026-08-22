# Phase 2 — six-hat review of phase 1

**Ran:** 2026-08-23. Model: Opus, main thread only, **zero subagents** — the brief
forbids delegating any hat, and the fix work turned out to be judgment all the way
down as well.

**Branch:** `phase-2-harden`. `phase-2-brief.md`'s Output section says
`phase-2-review`; `run-order.md` (written four days later) and
`phase-1e-outcome.md`'s hand-off both say `phase-2-harden`. The newer document
wins; the discrepancy is recorded here and in the outcome file.

**Verdict up front, so nobody reads six hats to find it:** phase 1's architecture
is sound and nothing needs redoing. But the review found **an unauthenticated
whole-map overwrite that was live on production**, reachable by any stranger with
a browser, using nothing but the public gallery's own JSON — and a **stored XSS in
the shared renderer** that turns any hosted user's map into script running on
theologymap's origin in every visitor's browser. Both are fixed on this branch.
Neither is a design failure; both are seam failures, of exactly the shape
`phase-1e-outcome.md` predicted the next bugs would have.

Preconditions checked: `phase-1e-outcome.md` exists, 1a–1e are all merged
(`54c606f` is on `main`), and no phase-1 outcome file reports a failed verification.

---

# White — what actually exists

Enumerated from the code on `main` at `384186f`, not from the outcome files.

## The database

One table, `public.users`, from `supabase/migrations/20260818120000_users.sql`:

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk, `gen_random_uuid()` | **also the write credential** — see Black 1 |
| `name` | text, unique on `lower(name)` | the login identifier |
| `pin` | text, 4–12 chars | plaintext, never selected into a reply body |
| `markdown` | text, ≤ 512 KB | the map |
| `is_admin` | bool, default false | set only by hand-run SQL; no route writes it |
| `is_public` | bool, default true | admin `set_visibility` is the only writer |
| `created_at`, `updated_at` | timestamptz | `updated_at` maintained by the `touch_updated_at` trigger, and used as the optimistic-concurrency token |

Plus `users_gallery_idx` (partial, `updated_at desc where is_public`), the three
length checks, and **RLS on with no policies** — so PostgREST's anon role can read
and write nothing, and every route reaches the table with the service-role key.

## The routes

Five real routes, two non-routed files. `api/_lib.py` and `api/_test_lib.py` both
begin with `_`, which Vercel does not route — confirmed live: `/api/_test_lib`
returns 404.

| Route | Verbs | Auth | Returns |
|---|---|---|---|
| `api/render.py` | POST | none | `text/html`; `{markdown}` or `{user_id}` (the latter re-checks `is_public`) |
| `api/auth.py` | POST | n/a | `{user_id, name, is_admin}`; `signup` / `login` |
| `api/map.py` | GET, POST | **`user_id` only — no PIN, no session** | `{markdown, updated_at, is_public, name}` / `{updated_at}` |
| `api/gallery.py` | GET | none | `[{id, name, updated_at}]`, `is_public` rows, newest first |
| `api/admin.py` | POST | `require_admin(name, pin)` on every call | five actions |

`api/_lib.py` is the only file in the repo that knows the word Supabase outside a
comment. `require_admin` is called **once**, in `api/admin.py`'s `do_POST`, *before*
the action dispatch — structurally stronger than the design's "every action calls
it", because a sixth action cannot be added without inheriting the check.

## Environment variables

Still **both-wide**: `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY`. The real names have never been
observed — only proved to resolve. 1a's advice to leave them alone stands.
Production-only scoping is unchanged: every DB check below ran against production.

## Entry points

`/` → `theology-map.html` (phase 0, untouched), `/app`, `/edit`, `/gallery`,
`/view`, `/admin`, plus `/api/*`. Six rewrites in `vercel.json`, one
`functions.includeFiles` entry.

## Drift against the spec

| Design said | Shipped | Verdict |
|---|---|---|
| `render.py` diff "roughly 15 lines" | **27 insertions, 8 deletions** (`git diff 1224162 main -- engine/render.py`) | Within tolerance; the excess is docstrings and the two thin wrappers, not logic. |
| One implementation of the renderer | `grep "def render_html\|def parse_text\|def render_markdown"` → **one each**, all in `engine/render.py` | Held. No copy crept back. |
| Four views | `map`, `domain`, `tier`, `confidence` — four buttons, four branches | Held. No fifth. |
| `requirements.txt` empty | **0 bytes**; no third-party import anywhere | Held. |
| `beaconFlush` not in the design's adapter interface | present, documented in `phase-1c-outcome.md` | Accepted deviation, correctly recorded. |
| Gallery capped at 200 rows (`decisions.md`) | **no `limit` in `api/gallery.py`** | Drift. The ceiling is a decision nobody implemented; today it returns every public row. Harmless at two rows; logged for phase 3. |
| `/edit?as=` wired for admin edit | not wired; the button was removed in 1e | Known gap, decided below (Green 5). |

## Verified by running, not by reading

- **Byte identity holds.** `render_markdown` on today's `theology-map.md` →
  `20d869…449ba` CRLF / `96d692…d4a2a2` LF; the committed `theology-map.html`
  hashes to `20d869…449ba`. Both baselines reproduce exactly, four sub-phases on.
- **The hosted route is the same renderer.** `POST /api/render` with the full map
  on production returned **`96d692…d4a2a2`** — the LF baseline, byte for byte.
- **Parser lockstep holds.** `once === twice === src` via `editor-core.js`;
  99 nodes from both parsers; `editor-core.js` and `map-view.js` untouched since
  `e4f7ba2` (phase 0.5).
- **`start_editor.bat` works, verified by running it.** `py engine/render_server.py`
  came up on 8420; `/engine/editor.html` (200, 38,145 B), `storage-local.js` (200),
  `editor-core.js` (200) all served; `POST /api/render` ran the full local chain
  (render.py → fetch_verses.py → render.py, "99 nodes across 14 domains", 0 verses
  to fetch so **no network call was made**) and `git status` was **clean**
  afterwards — the local write is byte-identical. `web/session.js` is never
  statically referenced by `editor.html`; the hosted adapter is a *dynamic* import
  behind `HOSTED`, so `file://` and `localhost` never request it. Offline by
  construction, not by luck.
- **No Supabase key or client in `web/` or `engine/`.** The only hit is the word
  "Supabase" in `storage-hosted.js`'s header comment.
- **No PIN in any response body.** Every body captured during this phase's live
  exercising (gallery, map GET, login, admin 403s, a rendered map) grepped for the
  literal test PIN and for `"pin"` — **zero hits**.
- **`is_admin` is read-only in code.** `grep -rn is_admin api/` → eight hits, all reads.

## Cold-start latency — the number `readiness.md` was missing

Measured from Australia against production, `curl -w '%{time_total}'`:

| Call | First hit after idle | Warm |
|---|---|---|
| `GET /` (static, no function) | — | **0.55 s** |
| `GET /api/gallery` | **2.09 s** | 0.72–1.13 s |
| `POST /api/render` (small map) | 1.41 s | 1.17 s |
| `POST /api/render` (full 27 KB map, 123 KB out) | — | 1.24–1.37 s |
| `POST /api/render` (450 KB map — 16× Thomas's) | — | **2.88 s, no timeout** |

**Read it as: the Python function costs ~0.2–0.9 s over the static baseline warm,
and ~1.5 s cold.** That is a perceptible pause, not a broken page, and it is
nowhere near a timeout even on a map 16× the size of the largest one that exists.
Phase 3 should design for it (a skeleton, not a spinner on white) rather than
architect around it.

---

# Red — instinct, before justifying anything

- **The gallery made me uneasy before I could say why.** A public JSON endpoint
  handing out a uuid per person, in an app whose save path takes a uuid and nothing
  else. It took ten minutes to turn that itch into Black 1, and it was worse than
  the itch.
- **`engine/editor.html` is the file I would dread opening in six months.** ~900
  lines of inline IIFE, now carrying an autosave scheduler, four guards, two
  dialogs, a BroadcastChannel, a draft-restore offer and a mode switch — none of it
  testable without a browser this program forbids. Every other file in the repo can
  be exercised from a terminal. This one cannot, and it is the one that can destroy
  a person's work.
- **The thing that would embarrass Thomas** is not a crash. It is somebody from his
  church opening `/gallery`, seeing two rows one of which is named
  `__phase2_victim_1787428073`, and concluding the site is a test harness. Test
  rows *are* the gallery whenever a session has been through. (This session left
  one too, and cleans it up — see the outcome file.)
- **The five admin actions still feel like a ghost limb.** Written, reviewed twice,
  fixed once, and never once executed. Three sessions have now handed them forward.
- **`force: true` bothers me more than the guards reassure me.** Four guards, and
  one boolean in a JSON body that walks past all four. The client is the only thing
  that decides when to send it, and the client is the untestable file above.

---

# Black — where it breaks

Nine findings. Every one is reproduced against production or pinned to a file and
line; nothing here is inferred from an outcome file's say-so.

## B1. Any stranger can overwrite any public map. No PIN, no account. **[FIXED]**

`api/map.py:31` — `POST /api/map` authenticates a write with `user_id` and
`expected_updated_at` and nothing else. `api/gallery.py:141` publishes, to
anyone, signed out: **`id` and `updated_at` for every public row.**

The gallery hands out both halves of the write credential.

Reproduced live on production against a test account created for the purpose
(never against Thomas's row):

```
GET /api/gallery
[{"id": "60e050c9-…", "name": "__phase2_victim_…", "updated_at": "2026-08-22T19:48:05.271808+00:00"}, …]

POST /api/map  {"user_id": "<that id>", "markdown": "# Beliefs\n## Vandalised by a stranger…",
                "expected_updated_at": "<that updated_at>"}
-> 200 {"updated_at": "2026-08-22T19:48:43.316461+00:00"}
```

**Thomas's own map was in that same gallery response, with its id and its token,
for anyone who looked.** The 512 KB limit, the `would_erase` guard and the shrink
guard do not help: replacing a map with different content of similar length defeats
all three, and `force: true` defeats `would_erase` anyway.

This is not the design being wrong. Design §11.8 chose "the `localStorage` id alone
authorises saving your own map" on the explicit assumption that the id is *secret*
— a capability-URL model, entirely reasonable for a church tool where security is
out of scope. 1d then published the capability, in a different sub-phase, for a
different feature, and nothing connected the two. **Neither file is wrong on its
own. The join is.**

**Fixed by taking the capability back out of public view** rather than by adding
auth the brief forbids: `api/gallery.py` no longer returns `id`, and the public
read path is keyed by `name` — which is already unique (`users_name_lower_key`),
already public, and already what the gallery displays. `/view?name=` replaces
`/view?id=`, and `api/render.py` accepts `{name}` alongside `{user_id}`. After the
fix the id appears in exactly two places: the owner's own `localStorage`, and an
admin's `list_users` reply. See Green 1 for the alternatives weighed.

## B2. Stored XSS in the renderer — a map that runs script on theologymap's origin. **[FIXED]**

`engine/render.py:532` — `<script id="data" type="application/json">__DATA__</script>`,
where `__DATA__` is `json.dumps(...)` with no escaping. `json.dumps` does not escape
`<`, so a node title containing `</script>` closes the data block early and
everything after it is parsed as HTML.

Proved through the live route (no database write needed):

```
POST /api/render  {"markdown": "# D\n## Innocent</script><script>alert(document.domain)</script>\n  hold x\n"}
-> 200, and the body contains, verbatim:
   ": [{"title": "Innocent</script><script>alert(document.domain)</script>", "slug": …
```

The exploitation path is `web/view.html:201`:
`<iframe sandbox="allow-scripts allow-same-origin" srcdoc=…>`. A `srcdoc` frame
inherits the parent's origin, and `allow-same-origin` keeps it — so script inside
someone else's map can read `parent.localStorage['theologymap:user']`, which is the
visitor's user id, which (before B1's fix, and by design after it) is their write
credential. **Read one map, lose your own.**

A second, smaller vector in the same file: `engine/render.py:649` interpolates a
`link` value into an attribute without escaping —
`<a href="#" data-goto="${l}">` — while every neighbouring interpolation on
lines 632–645 uses `esc()`. `link` is raw user text (`parse_text` appends the line
verbatim, `engine/render.py:141`), so a `"` in a link field breaks the attribute.
Code-level only; I did not build a runtime proof of this one, because it needs a
browser.

**Fixed at the root, in the renderer, so both callers and the export inherit it:**
every `<` in the JSON payload is emitted as its six-character JSON escape
`<` — still valid
JSON, and the identical string after `JSON.parse` — and `data-goto` is `esc()`'d
like its neighbours (the browser decodes the entity when it parses the attribute,
so `dataset.goto` is unchanged). **Plus** the
belt-and-braces fix at the other end: `allow-same-origin` is dropped from
`view.html`'s sandbox, which costs the rendered map nothing (it uses no storage, no
cookies, no same-origin API — grepped) and makes a future escaping slip
unexploitable against the parent page.

**Note this changes `theology-map.html`.** The embedded viewer JS is part of the
generated file, so the generated files are regenerated by `py engine/render.py` and
the recorded baseline hashes move. New values are in the outcome file. No generated
file was hand-edited.

## B3. `*` is still an ILIKE wildcard in the name match. **[FIXED]**

`api/_lib.py:115` — 1e escaped `\`, `%` and `_`. **PostgREST additionally maps `*`
to `%` in `like`/`ilike` values before Postgres ever sees the pattern**, so the hole
1e closed is still open through a different character.

Proved live, on production:

```
POST /api/auth {"action":"login","name":"__phase2_victim*","pin":"<the real PIN>"}
-> 200 {"user_id":"60e050c9-…","name":"__phase2_victim_1787428073","is_admin":false}
```

A name that is not that user's name logged in as that user. With `name: "*"` the
pattern matches **every row**, and with no `order=` in the query PostgREST returns
them in arbitrary order — so `rows[0]` can be anyone, including the admin, and a
four-digit PIN is all that stands behind it. `require_admin` routes through the same
function, so this is an admin-account exposure too, not just a login quirk.

**Fixed by not depending on the pattern at all.** Escaping the next metacharacter
is a game 1e already lost once. `verify_credentials` now selects the candidate rows
and then requires an **exact case-insensitive name equality in Python** before
comparing the PIN. That kills the whole class — any present or future PostgREST
pattern semantics, and the arbitrary-`rows[0]` ordering with it. `api/_test_lib.py`
gains the case as a runnable assertion.

## B4. A malformed admin call answers 500, not 403. **[FIXED]**

`api/admin.py:135` → `require_admin(body.get("name"), body.get("pin"))`. With no
`name` in the body, `_like_literal(None)` raises `AttributeError`, and `guard` turns
it into `500 server_error`. Live:

```
POST /api/admin {"action":"list_users"}   ->  500 {"error":"server_error"…}
```

Every *other* rejection — non-admin, wrong PIN, unknown name — is a byte-identical
403, which 1d verified and which is right. This one path is distinguishable and is
a crash rather than a decision. **Fixed** by making `verify_credentials` return
`None` for a non-string name or PIN, so the missing-field case joins the identical
403.

## B5. The admin self-delete guard compares strings, not rows. **[FIXED]**

`api/admin.py:50` — `if target_id == admin_row["id"]`. Postgres accepts a uuid in
any case; the string from the request body need not match the string PostgREST
returned. An admin passing their own id in uppercase passes `_lookup` (the database
matches) and fails the equality (Python does not) — and deletes their own row.

That is unrecoverable by any route in the app: **no route can set `is_admin`**, so
the site would have no admin until Thomas runs SQL by hand. **Fixed** by comparing
the *looked-up row's* id, which is always PostgREST's canonical form, against
`admin_row["id"]`.

## B6. Every PostgREST path is built by f-string interpolation. **[FIXED]**

`api/map.py:18,47,62`, `api/render.py:124`, `api/admin.py:18,53,69,85,103,116` —
`f"/users?id=eq.{user_id}"`, unquoted, with values that arrive from a query string
or a JSON body. Today nothing is exploitable: the column is `uuid`, so anything
that survives injection makes PostgREST 400, which the routes turn into
`unknown_user`. PostgREST also ANDs horizontal filters, so an injected filter can
only narrow a query, never widen it. I tried to build a leak through a duplicated
`select=` and could not — the routes index explicit keys, so a substituted
projection raises `KeyError` and becomes a 500.

It is one column-type change away from being real, and 1e already flagged it.
**Fixed** with `quote(str(value), safe="")` at every site — the laziest possible
hardening, no new abstraction.

## B7. `GET /api/map` has no ownership check — hidden maps stay readable. **[NOT FIXED — see Green 3]**

`api/map.py:12`. Anyone holding a `user_id` reads that user's markdown, including a
map an admin has hidden: the `is_public` gate lives in `api/render.py:128` and has
no counterpart here. 1e flagged it as the one genuine privacy hole.

**B1's fix substantially closes it in practice** — after this branch, ids are no
longer published, so "anyone holding a `user_id`" means "the owner, or an admin".
It does not close it in principle: an id noted from the gallery *before* this
deploy still reads a since-hidden map. Closing it properly means giving `/api/map` a
credential, which is an auth-model change the brief does not sanction and phase 3
would have to redesign around. Left open, deliberately, with the risk now much
smaller than 1e found it. **The right permanent answer is for `set_visibility` to
rotate the row's id**, which is a data-model question, so it waits for Thomas.

## B8. The four empty-save guards are all present; the gaps are between them.

Read line by line in `engine/editor.html`, not taken from 1c's account:

| Guard | Where | State |
|---|---|---|
| 1 — no token, no save | `scheduleAutosave` L747-8, `flushAutosave` L758 | present; `saveToken` is set only after a successful `load()` (L444) |
| 2 — client shrink guard | L764-772 | present; empty-while-nonempty, or under half of a >500-char previous |
| 3 — server `would_erase` | `api/map.py:56` | present, and **verified live**: empty markdown, no force → `409 would_erase`; with `force: true` → 200 |
| 4 — local draft | L777 write, L781 clear, L846 restore offer | present |

The residual risks, all real, none fixed here because each is a UX decision phase 3
owns and none can be tested without a browser:

- **`force: true` walks past guards 2 and 3 together**, and the only thing deciding
  to send it is `confirmShrink`'s dialog — a `<dialog>` whose OK button is relabelled
  by three different call sites (`engine/editor.html:800`).
- **The conflict dialog's "Overwrite" path** (L835) re-`GET`s a token and then calls
  `flushAutosave({force: true})` — so choosing "Overwrite" in a two-tab conflict
  bypasses the empty-save guards entirely, on the path *most* likely to be reached
  in a confused state.
- **`draftKey()` is the user's name** (L744). An admin `reset_pin` does not change
  it, but nothing stops a future rename from orphaning a draft.
- **`beaconFlush` on `beforeunload`** (L877-881) fires with no result path — a 409
  is unobservable, so "I closed the tab and it didn't save" is invisible on both
  ends.

## B9. Two client behaviours remain unobserved by anyone. **[STILL UNOBSERVED]**

`apiFetch`'s `unknown_user` → clear session → notice → redirect
(`web/session.js:61-66`), and the editor's conflict dialog
(`engine/editor.html:814-843`). The **server halves are proven live** in this phase:
`GET` and `POST /api/map` for a deleted id both return `404 unknown_user`, and a
stale token returns `409 conflict`. The browser halves have never been watched by
any session, and this program forbids browser automation. Recorded as unobserved
rather than inferred. Code review says both are correct; code review said that about
the three bugs 1e found too.

## The five admin actions — still un-run, and for a new reason

`GET /api/gallery` now returns a **real account named `Thomas`**, and the three
`__`-prefixed rows 1e reported are gone. So Thomas has signed up, and (since only an
admin's `set_visibility` or direct SQL could have removed those rows) he has very
likely run the bootstrap too.

**They are still un-runnable, for a different reason than 1e's.** Every admin action
requires `name` **and PIN**, re-verified server-side on every call. I do not have
Thomas's PIN, I will not guess it, and no route grants `is_admin` — nor may one be
built, temporarily or scoped (`decisions.md`, design §9, and 1d's own litigation of
exactly this). So `list_users`, `delete_account`, `reset_pin`, `set_visibility` and
admin `save_map` remain **declared un-run**, including the three carrying 1e's
PostgREST-204 fix. The reject path is re-verified live (B4 above, and 1d's table).

This is now a permanent condition of every remote session, not a transient one:
**no session without Thomas's PIN can ever verify the admin accept path.** It needs
five minutes from him, not another session. The outcome file says exactly what to
click.

---

# Yellow — what phase 1 got right, and must survive phases 3–7

Named with the file and function that embodies each, so a later phase cannot undo
one casually while chasing a UI goal.

1. **One renderer, two callers.** `engine/render.py:202 render_markdown()` — called
   by `api/render.py:131` and by nothing else on the hosted side, while `main()`
   still calls `parse(SRC)` for the local path. Proved again this phase at the byte
   level, in production. **This is the single most valuable thing in the codebase.**
   Phase 7 redesigns the generated views; it must do so *inside* `render_html`, not
   by adding a second renderer for the hosted case.

2. **The local workflow is genuinely untouched and genuinely offline.** `start_editor.bat`
   → `render_server.py` → `editor.html` runs with no network and writes a
   byte-identical file. The mechanism that keeps it that way is the **dynamic**
   import at `engine/editor.html:424` — hosted code is never fetched in local mode,
   so `file://` cannot 404. Phase 3 must not convert that to a static `<script>`
   for tidiness.

3. **`api/_lib.py` is the only file that knows Supabase.** One env resolver, one
   `pg()`, one `unknown_user()`. B3 and B6 were each *one* fix because of it. Any
   phase tempted to call PostgREST from a new route directly should not.

4. **`require_admin` before the dispatch table**, `api/admin.py:135`. Not per-action.
   A new admin action inherits the check by construction.

5. **The 403 is byte-identical across non-admin, wrong PIN and unknown name.** Verified
   live again. Easy to lose while adding a helpful error message in phase 3.

6. **`api/gallery.py` returns the minimum**, and after this phase, one field less.
   Every phase since 1d has wanted to add something to that reply. The discipline of
   asking "does the world need this field?" is what B1 will have been worth.

7. **The storage-adapter seam** (`engine/storage-local.js` / `storage-hosted.js`).
   Phase 3 wants to extract the 900-line controller out of `editor.html`; the seam
   is already the boundary that makes that a refactor rather than a fork.

8. **Honest un-run declarations.** Four outcome files in a row have said "this was
   not run" rather than claiming it. That is why this session could go straight at
   the admin gap instead of rediscovering it. Keep doing it.

---

# Green — cheapest fixes that are not rewrites

## G1. B1: three ways to fix it; the chosen one is the smallest

| Option | Cost | Verdict |
|---|---|---|
| **A. Stop publishing the id; key the public read path by `name`** | ~30 lines across 4 files, no schema, no auth change | **Chosen.** Names are already unique, already public, already displayed. |
| B. Require name+PIN on `POST /api/map` | forces a PIN into `localStorage` (design §11.8 calls this strictly worse) or a re-prompt per autosave | rejected — it is the "improve the PIN auth into a real auth system" that non-negotiable 8 forbids |
| C. A separate `share_id` / `edit_token` column | correct long-term shape | **data-model change → stops and waits** per `decisions.md` |

Option A also **unblocks something phase 3 already wants**: `phase-3-plan.md:953`
plans a "copy link to my map" button. Under the old scheme, sharing your map's link
handed the recipient write access to it. Under `/view?name=`, a shared link is
inert. Phase 3's two references to `/view?id=<id>` (lines 788 and 953) need the
parameter renamed; that is the whole amendment.

## G2. B2: fix the renderer, not the caller — but do both

Escaping `<` in the payload is one `.replace()` on one line and protects the
exported file, the local file and the hosted route together. Dropping
`allow-same-origin` is one attribute and makes the *next* escaping slip harmless.
Doing only the second would leave the export vulnerable; only the first leaves no
depth. Both together are four lines.

## G3. B7 and the `set_visibility` hole: wait, and say why

Hiding a map should rotate its id, so previously-published ids stop working. That is
a data-model behaviour change on the primary key, with a cascade into every stored
`localStorage` session for that user. **Not phase 2's call while Thomas is away.**
Recorded here so phase 3 does not design around the current behaviour by accident.

## G4. The `rev` column (design §8) — **close it: do not add one**

Four sessions of evidence now. `updated_at`-as-token has been proven at the raw
PostgREST level (1b), through `/api/map` (1c), end to end (1e) and again here
(`409 conflict` on a stale token, live). The timestamptz round-tripping worry that
motivated `rev` has not materialised once. Adding a column now buys nothing and
costs a migration. **Recommendation: drop the question.** It stays a data-model
change, so Thomas has the final word, but no session should keep carrying it
forward as an open risk. It is not one.

## G5. `map_versions` (design §1) — **not now, but the cheapest moment is phase 4**

The table is the only real answer to admin "restore" and to `force: true` walking
past four guards. It is a new table, so it stops and waits. The argument for doing
it *soon* rather than later is that the wizard (phase 4) will generate whole maps in
one shot — the first feature that can plausibly destroy a lot of work in one action.
So: not phase 2 (data model, Thomas away), and phase 4's session should be told to
raise it on day one rather than at the end.

## G6. What is cheaper to add now than after phase 3

Asked, and answered honestly: **almost nothing.** The schema is right, the routes
are right, and every candidate is either a data-model change (waits) or a UI
decision (phase 3 owns it). The exceptions are the six fixes on this branch, which
are cheaper now because phase 3 will otherwise build a gallery, a share button and a
first-run flow directly on top of B1.

## G7. Logged for phase 3, deliberately not fixed here

Cosmetics and UX, per the brief's "nothing else":

- `api/gallery.py` has **no `limit`** — `decisions.md`'s 200-row ceiling is unimplemented.
- `engine/storage-hosted.js:84-92` **both opens a tab and downloads a file** on
  Render. One of those is enough.
- The `<dialog id="dlgConfirm">` is relabelled by three call sites; a mislabelled OK
  button on the shrink guard is the one place that matters.
- `web/gallery.html` / `view.html` / `admin.html` are deliberately plain, per design §9.
- `beaconFlush` has no observable result (B8).

---

# Blue — process

**Was 1a–1e the right split?** Yes, on the evidence: every sub-phase merged, the
chain never stalled, and a dead window would have cost a diff review rather than a
phase. But the split has a cost nobody priced, and this phase paid it:

> **Every serious bug phase 1 produced lived in a seam between two sub-phases, and
> the seam had no owner.** 1b's relative import (rewrite ↔ URL), 1c's `<base href>`,
> 1d's `apiFetch` on an HTML body, 1e's PostgREST 204 and its ILIKE name match — and
> now B1, which is `api/map.py`'s auth model (1c) meeting `api/gallery.py`'s reply
> shape (1d). **Not one of phase 1's bugs was inside a function.** 1e was supposed to
> be the seam pass; it found three and missed B1, because it was scoped as a
> *de-duplication* pass — "one way to do each thing" — and B1 is not duplication.

**The concrete amendment, for phases 3–7:** an integration sub-phase's checklist
should include one question de-duplication does not ask —
**"what does each route trust, and who else publishes that value?"** For B1 that is
one grep (`id` appears in a public reply; `id` authorises a write) and the bug falls
out in a minute. It is now written into `CLAUDE.md`'s hosted-app section.

**Did Sonnet subagents help?** On the evidence of the outcome files: yes for volume,
and every single time a subagent's file was wrong, it was wrong *at its edges* —
`web/index.html`'s relative import (1b), `web/view.html`'s `apiFetch` (1d) — and the
main thread caught it in review. Each fix was one line. That is the fan-out working
as intended, not failing: the subagents were correct against their briefs, and the
briefs could not see the seam. **Keep fanning out; keep the review pass on the main
thread; budget for the seam every time.**

**Phase 2 itself used zero subagents**, per the brief, and that was right. Every
finding above came from holding two files in mind at once, which is exactly what a
cold subagent cannot do.

**What phases 3–5 should do differently:**

1. **Phase 3 must read B1 before its gallery task.** Its plan (lines 788, 953)
   embeds `/view?id=<id>` twice, and one of those is a share button that would have
   handed out write access. Amend the plan's parameter to `?name=`.
2. **Phase 3 should extract `editor.html`'s controller** — Red's answer to "which
   file would you dread" is the same file as the one holding the only data-loss code
   in the app. Design §7 already says the adapter seam makes this cheap. It is not a
   cosmetic refactor; it is the precondition for ever testing autosave.
3. **Phase 4's session should raise `map_versions` on day one** (G5), not discover
   the need at the end.
4. **Phase 5 needs nothing from this review.** It produces content.
5. **Every future phase: measure, then decide.** `readiness.md` carried "cold-start
   latency on every page load" as an unquantified risk through five sessions. It
   took four `curl` calls to replace with a number, and the number says it is a
   design detail, not an architecture problem. Cheap measurements should not wait
   for a review phase.

**On the one thing this phase was allowed to do:** the stop-and-wait condition
(something needs redoing rather than patching) was **not** triggered, and the
reasoning matters. B1 looks like an auth-model failure, which would be exactly that
condition. It is not: the model — possession of an unguessable id authorises writing
that row — is a deliberate, defensible choice for a tool whose brief says security is
out of scope, and it is intact. What failed was that one sub-phase published the
secret another sub-phase depended on. Un-publishing it is a patch in the honest
sense, not a paper-over, and it leaves the system in the state the design intended.
The genuinely better long-term shape (a separate share id, or an id that rotates on
hide) is a data-model change, and those stop and wait for Thomas by his own rule —
so it is written down here and in the outcome file rather than started.
