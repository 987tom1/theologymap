# Phase 1e — outcome

**Branch:** `phase-1e-integration` → merged to `main` (`--no-ff`, commit `54c606f`).
**Ran:** 2026-08-23. Model: Opus, main thread, **zero subagents** — the plan's own
"What goes to Sonnet subagents" section for 1e says "Nothing", and it was right:
every change this session made came out of deciding whether something was
duplication or legitimate similarity, which is the call a cold subagent cannot make.

**Verdict: 1e is complete and phase 1 is closed.** Every gate in the verification
table passes. 28 live checks ran against production after the merge, all green.
Three seam bugs were found and fixed — **two of which would have broken the product
in the hands of a real user**, and neither of which any earlier sub-phase could have
caught, for reasons that turn out to be the most useful thing in this file.

**The one thing that did not run is the admin *accept* path**, and this session
established — with evidence rather than the "unknown" 1d had to record — **why it
cannot run: there is no admin account, because Thomas has not signed up yet.** See
"The `is_admin` bootstrap, finally settled" below. Phase 2 must not start by
assuming otherwise.

---

## The three bugs

### 1. Every successful admin write returned a 500 (`api/admin.py`)

`_reset_pin`, `_set_visibility` and `_save_map` each ended with:

```python
status, _, _ = pg("PATCH", f"/users?id=eq.{target_id}", {...})
if status != 200:
    return error(self, 500, "server_error", "Could not reset that PIN.")
```

**PostgREST answers a write with `204 No Content` unless the caller asks for
`Prefer: return=representation`.** None of these three ask. So the write *succeeded*
and the route reported `500 server_error` — the worst shape of bug there is: the
admin sees a failure, retries, and the database has been changed all along.
`_delete_account` in the same file already had it right (`status not in (200, 204)`),
which is what made the inconsistency visible.

Fixed by making all four checks `not in (200, 204)`, with a comment above them
saying why. The fix is correct under either reading — if PostgREST *did* return 200
it would still pass — so it needed no live admin account to be safe to ship.

**Why 1d could not catch it:** 1d had no admin account, so it exercised only the
reject path (`require_admin` → 403), which is the half that worked. Its outcome file
says plainly that the accept half rested on code review; this is what code review
missed, because the bug is not in the code's logic but in an undocumented assumption
about what PostgREST returns. **Three of the five admin actions were broken on
`main` for a day and nobody could have known.**

### 2. `%` and `_` in a name were ILIKE wildcards (`api/_lib.py`)

`verify_credentials` matched names with `name=ilike.` + the raw name. `ilike` is a
pattern match, so a user named `%` matching *every row* — and, with no `order=` in
the query, PostgREST returning them in arbitrary order — meant `rows[0]` could be
somebody else entirely. Two failure modes, both real:

- A person whose name legitimately contains `_` (or the `__`-prefixed test accounts
  three sessions have now created) can be handed the wrong row on login.
- Signing up as `%` and logging in matches the whole table and picks an arbitrary
  row; if that row's PIN happened to match the one supplied, you are signed in as
  them.

Sign-up itself was never affected — it relies on the `lower(name)` unique index,
not on `ilike` — so this is a login/admin-verify bug only.

Fixed at the root, in the one shared function all four credential paths route
through, by escaping `\`, `%` and `_` before the comparison. `api/_test_lib.py` is
a runnable self-check for it (`py api/_test_lib.py`); it is `_`-prefixed so Vercel
does not route it, which was confirmed live (`/api/_test_lib` → 404).

**This is not "improving the PIN auth into a real auth system"** — the thing
`CLAUDE.md` non-negotiable 8 forbids. Plaintext comparison, no hashing, no rate
limiting and no JWT all stand exactly as before. This only makes the name match the
name it was asked to match.

### 3. `start_editor.bat` could not start (repo root)

The launcher's last line was `python engine\render_server.py`. **On this machine
bare `python` hits the Microsoft Store stub and exits 9009** — the environment fact
`decisions.md` records and that has already cost two earlier sessions. So
double-clicking `start_editor.bat`, the single entry point to the entire local
workflow, opened the Microsoft Store instead of starting the render server.

This **predates phase 1 entirely** — `git log` puts the line at `60ca70a`, the
original editor commit. Nothing phase 1 did caused it. But 1e's verification table
says in as many words that `start_editor.bat` must work offline end to end, so
finding it broken and merging anyway was not an option.

Fixed to `py`, with a comment naming the trap. Verified afterwards by running the
launcher's exact command and fetching `/engine/editor.html` (200, 38,145 bytes),
`/engine/storage-local.js` (200) and `POST /api/render` (200, "99 nodes across 14
domains") off `localhost:8420`, then stopping the server. No network involved.

> **Worth internalising for phases 2–7:** this is the third bug in three sub-phases
> that lived in a *launcher or a seam*, not in a function — 1b's relative
> `./session.js` import, 1c's `<base href>` under a rewrite, 1d's `apiFetch` on an
> HTML response, and now this. Each was invisible to the code review of the file
> that contained it, because the file was correct; what was wrong was an assumption
> about the environment it ran in. **Check the joins, not the parts.**

---

## The `is_admin` bootstrap, finally settled

1d recorded this as unknown and could not do better. It is now **known**, and the
answer is no.

`GET /api/gallery` returns every row with `is_public = true`, and `is_public`
defaults to true with no route able to change it except an admin's `set_visibility`.
So the gallery *is* the whole table unless an admin has hidden something, and no
admin exists to have done so. The gallery, live on production, contains exactly
three rows:

```
__phase1e_a_1787420673   (this session's)
__phase1d_verify_a_1787419204
__phase1d_verify_b_1787419204
```

**No account named Thomas exists. No non-test account exists at all.** The bootstrap
statement targets `lower(name) = lower('Thomas')`, so it cannot have been run — it
would have matched nothing. Nobody has signed up.

This is *not* a failure of 1b–1d. It is the one action `run-order.md` reserves for
Thomas, he is away, and the chain was explicitly designed to keep moving without it.
But it means the following are **un-run, not failed, not "probably fine"**:

| Un-run | Needs |
|---|---|
| `list_users` happy path | a real `is_admin = true` row |
| `delete_account` | same |
| `reset_pin` → old PIN fails, new PIN logs in | same |
| `set_visibility` → hidden map leaves the gallery and 404s from `/api/render` | same |
| admin `save_map` | same |

**Two of those five (`reset_pin`, `set_visibility`) plus `save_map` are the exact
three this session just fixed.** The fix is sound by construction and reviewed, but
it has never been executed against the real database. Phase 2 must run these five
first, before anything else it plans to do.

No route was built to grant `is_admin`, temporary or scoped. 1d reached the same
conclusion after starting to write one, and its reasoning is correct and is not
re-opened here: `decisions.md` and design §9 say no route, full stop, and "just for
testing" is not a carve-out that exists.

### What Thomas has to do — two statements, one sitting

1. **Sign up** at `https://theologymap-thomas-l-s-projects.vercel.app/app` with the
   name `Thomas`, then in the Supabase SQL editor for the `theologymap` project:

   ```sql
   update public.users set is_admin = true where lower(name) = lower('Thomas');
   ```

2. **While you are in there, clear the three test rows** — they are currently the
   *entire* gallery, and they are the first thing a visitor would see:

   ```sql
   delete from public.users where name like '\_\_%';
   ```

   Or, once step 1 is done, delete them through `/admin`'s own Delete button — which
   is simultaneously the live test of `delete_account` that the table above lists as
   un-run. Two birds.

No throwaway cleanup route was built for this. 1b and 1c each built one because they
were unblocking a check that *gated their merge*; here it is housekeeping that
Thomas's own required first admin action already covers, and 1d's session hit a
harness permission block attempting exactly this shape of route. Not worth repeating
for tidiness.

---

## Task-by-task

### 1e.1 — One way to do each thing: **clean**

| Grep | Result |
|---|---|
| `localStorage` outside `web/session.js` | **clean.** Real hits are `session.js` (key `theologymap:user`) and `editor.html`'s four `draftKey()` calls (`theologymap:draft:<name>`), which the task explicitly permits. Everything else is a comment. **One way to get the user id: `getUser()`/`requireUser()`.** |
| `SUPABASE`/`postgrest` | **clean.** Only `api/_lib.py`, plus three comment lines that name it without knowing it. **One place knows the config.** |
| `fetch(` | **three deviations, all deliberate, all documented in place** — see below. |

The `fetch(` grep is the one that does not come back literally empty, and deciding
what to do about it is most of what "1e is judgment" means. The three:

- **`engine/storage-local.js`** → `http://localhost:8420/api/render`. Not an `/api/`
  route at all; it is the *local* render server, in the adapter whose entire job is
  to not be hosted. Correct as-is.
- **`engine/storage-hosted.js`** → `/api/map`, `/api/render`. `apiFetch`'s 404
  `unknown_user` handling clears the session and redirects the whole page, which
  design §8 failure mode 3 forbids mid-edit — a vanished account must leave the
  draft in `localStorage` and say so in place. 1c documented this at the top of the
  file. Correct as-is.
- **`web/view.html`** → `/api/render`. `apiFetch` always calls `res.json()`, which
  silently nulls an HTML body. 1d documented this at the call site. Correct as-is.

Both real deviations exist for the *same* underlying reason — `apiFetch` is
JSON-in/JSON-out and two call sites need otherwise — and both were discovered the
hard way, one sub-phase apart. 1d's outcome file recommended writing it down in
`session.js` itself. **Done**: `apiFetch` now carries a comment naming the
`text/html` trap and pointing at both call sites, so the third person to hit it
does not have to.

**What was deduplicated:** `api/render.py` open-coded
`error(self, 404, "unknown_user", "No such map.")` twice instead of calling
`_lib.unknown_user()`, the function whose docstring calls itself "the single
canonical 404". Now calls it.

**What was deliberately left duplicated**, and why, since 1e is supposed to say:
`slugify` exists in `render.py`, `editor-core.js` and again in `web/view.html`.
Only the third is new-ish duplication, six lines, used to name a download file.
Reusing `editor-core.js`'s would mean pulling the whole hand-maintained parser into
a page that has no other use for it, or inventing a shared web module to hold one
function. Both cost more than they save, and neither is load-bearing — a slightly
different download filename is not a bug. **Legitimate similarity; left alone.**

### 1e.2 — Errors reach the user: **pass**

`console.error` sweep: exactly one hit, `storage-local.js:82`, and the very next
line throws an `Error` whose message the editor's status line shows
("render.py reported a problem — see console"). The console line is the *detail*
behind a visible message, which is what the rule asks for. No silent failures.

Every failure the task names was forced and the reply read, not inferred:

| Forced failure | Result |
|---|---|
| Supabase env var missing | `500 misconfigured` naming **every candidate tried** (`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`). Verified twice: in-process locally, and live on the branch preview, which genuinely has no credentials. |
| Row missing | `404 unknown_user`, "No such map." |
| 409 conflict (stale token) | `409 conflict`, "This map was changed somewhere else." |
| 409 would_erase | `409 would_erase`, "This would erase the whole map. Confirm to continue." |
| 413 too_large | `413 too_large`, "That map is too large to save (512 KB limit)." |
| 403 forbidden | `403 forbidden`, "Forbidden." — **byte-identical** for non-admin, wrong PIN, and unknown name |
| 401 bad_credentials | identical body for wrong PIN and unknown name — no user enumeration |
| Unexpected exception | generic `500 server_error` with **no internal detail in the body** (checked with a `KeyError("pin")`) |
| Network down | `apiFetch`'s `catch` shows "Could not reach the server…". Code review only — a real network failure is not reproducible from here without browser automation, which is forbidden. |

Two client-side behaviours are **code review only** and are named as such rather
than claimed: `apiFetch`'s `unknown_user` → clear session → notice → redirect (the
server half is verified; the browser half is not), and the editor's conflict dialog.
Both need a browser. Phase 2 inherits them.

### 1e.3 — Signed-out visitors: **pass, with one deliberate departure from the plan**

With no session: `/api/gallery` returns 200 and a list, `/gallery` and `/view`
serve, and `/` still serves `theology-map.html` **byte-for-byte identical to the
committed file** (same sha256, same 123,865 bytes). Phase 0's rewrite is intact and
every link Thomas has already shared still resolves.

`/edit` signed out redirects to `/app` — but *silently*, which the task says is not
good enough ("with an explanation"). Fixed in the one place all signed-in-only pages
funnel through: `requireUser(why)` now stashes a message through the same
`sessionStorage` one-shot the `unknown_user` redirect already used, so `/app` shows
"Sign in to edit your map." on arrival. One function, every current and future
caller.

**`/admin` deliberately does not redirect**, against the plan's literal wording.
`web/admin.html` never uses the `localStorage` session at all — admin identity is
name + PIN re-entered and re-verified server-side on *every single call*, which is
what `decisions.md` requires. A signed-out admin visiting `/admin` gets a
credentials form and can work; redirecting them to `/app` would break a working
flow to satisfy a sentence whose actual intent ("coherent, not a half-rendered page
or a raw error") is already met. Recorded here rather than silently done, per the
house rule.

### 1e.4 — Dead code: **clean**

No `api/_envcheck.py`, no `api/envcheck.py`, no `api/smoketest.py` on `main` or on
the branch — 1a, 1b and 1c each removed their own throwaway route and all three
stayed removed (`/api/envcheck`, `/api/smoketest` both 404 live). No orphaned File
System Access branches in the hosted path — 1c moved them wholesale into
`storage-local.js` rather than leaving them behind. `requirements.txt` is **0
bytes**. No `.env` is tracked (`git ls-files | grep -i env` is empty), and no key
material appears in any client file (`web/`, `engine/`, `theology-map.html`,
`vercel.json` all clean against a JWT/service-role/env-name pattern).

One thing *was* removed as dead: `web/admin.html`'s "Edit map" link — see below.

### 1e.5 — `CLAUDE.md`: **done**

+199 lines, one new `## The hosted app` section between the local editor
documentation and the node syntax, covering all six things the task lists: the
`api/` layer file by file and `_lib.py` as the only file that knows Supabase;
`render_markdown` vs `main()` as one implementation with two callers, with both
baseline hashes written down; the hosted-vs-local adapter split, the `HOSTED`
switch and the standing rule that `start_editor.bat` keeps working offline; the
schema as a table plus the admin bootstrap SQL; autosave as hosted-only with the
local Save & render unchanged; and `web/` with the URL map.

Added beyond the list, because each cost a sub-phase real time to discover: the
`sys.path.insert`-before-`_lib`-import rule, the absolute-`/web/session.js` rule,
the `<base href>` rewrite trap, "never `select=` the pin column", the PostgREST
204 rule this session just paid for, and the Production-only env vars with the
one-line probe.

Also swept `python` → `py` throughout, with a note saying why. The old file told
its reader to run a command that does not work on this machine — the same trap that
had just broken `start_editor.bat`.

### 1e.6 — Full-system pass: **28 live checks, 0 failed**

Signup → duplicate-name rejection → login → GET map → save → reload → forced
failures → gallery → view → export → admin auth, run end to end against
**production** after the merge (branch previews have no database — the probe
returned `500 misconfigured` exactly as expected, confirming the established fact
still holds).

Highlights beyond the forced-failure table above: signup defaults `is_admin` false
and `is_public` true; a duplicate name in a different case is `409 name_taken`;
`GET`-then-save-then-`GET` round-trips the markdown exactly; the gallery returns
**only** `id`/`name`/`updated_at`; a `text/plain` body (the shape
`navigator.sendBeacon` sends a `Blob` as) still parses and saves; and
`POST /api/render {user_id}` and `POST /api/render {markdown}` return **identical
bytes**, which is the whole export-equals-view chain in one comparison.

**No PIN appeared in any response body**, checked by grepping every one of the ~30
bodies captured during the run, not by grepping the source.

Login as `%` now correctly returns `401 bad_credentials` instead of matching an
arbitrary row — bug 2, verified live, on the real database.

| Gate | Result |
|---|---|
| Byte identity | **PASS** — `render_markdown` → `20d86937…449ba`, equal to `BASELINE_HASH` and to the committed `theology-map.html`, after four sub-phases of change. Hosted route → `96d692a5…d4a2a2`, the LF-normalised baseline, exactly. |
| Parser round-trip | **PASS** — `once === twice === src` via `editor-core.js`; 99 nodes / 14 domains from both `editor-core.js` and `render.py` |
| Parser lockstep | **PASS** — `editor-core.js` and `map-view.js` last changed at `e4f7ba2` (phase 0.5), i.e. **untouched across all of 1a–1e** |
| Local workflow offline | **PASS**, after fixing the launcher (bug 3) |
| Signed out | **PASS** — gallery and view work; `/edit` redirects with an explanation; `/` unchanged byte-for-byte |
| `CLAUDE.md` | **PASS** |
| Secrets | **PASS** — no tracked `.env`, no key in any client file, `requirements.txt` 0 bytes |

---

## Decisions I made for you

- **Fixed three bugs in an "integration pass" that the plan describes as "not new
  features".** Each is a seam between two sub-phases (admin route ↔ PostgREST,
  four credential paths ↔ one name match, launcher ↔ interpreter), which is exactly
  what 1e is for, and shipping a known-broken `reset_pin` into phase 2's review
  would have wasted that session's time rediscovering it. None touches the data
  model or a file format, so per `decisions.md` these were mine to decide and
  document rather than stop and wait on.
- **`/admin` does not redirect when signed out**, against 1e.3's literal wording.
  Reasoning above.
- **Removed `web/admin.html`'s "Edit map" link** rather than wiring `?as=`. Reasoning
  in the next section.
- **Did not build a cleanup route** for the three test rows. Reasoning above.
- **Left `slugify` duplicated** in `web/view.html`. Reasoning above.
- **Added `api/_test_lib.py`**, one small file with one assert-based check for the
  new escaping helper. It is `_`-prefixed so it is not a route (verified: 404), and
  it needs no framework and no network. The plan does not ask for tests; a
  four-branch string transformation on a credential path earns one.

## `/edit?as=<target_id>` — deferred to phase 2, and the link removed

**1e does not wire it.** Stating the call plainly, since 1d left it ambiguous and
asked for it not to be left ambiguous twice.

Wiring it properly needs three things: the editor detecting `?as=`, loading via
`GET /api/map?user_id=<target>` instead of the signed-in user's own id, and routing
saves through `admin.save_map` with admin credentials re-prompted on every call —
which means bypassing the optimistic-concurrency path entirely, because
`admin.save_map` carries no `expected_updated_at`. That is a **second save path
through the autosave scheduler**, in the 1c seam that four guards and a conflict
dialog already make delicate, and it is a save path that **cannot be tested at all
today** because no admin account exists. Building an unverifiable second write path
into the one place in this app that can destroy a user's work is the wrong trade
for a sub-phase whose job is to make existing seams sound.

**But the link could not stay.** `admin.html` pointed "Edit map" at
`/edit?as=<id>`, and `editor.html` ignores `?as=` completely — so clicking it beside
Sarah's row opened *the admin's own map*, in hosted mode, with autosave armed. An
admin who edited what they believed was Sarah's map would have silently overwritten
their own. That is a live data-loss footgun sitting behind a button labelled as
something else, so the link is gone, replaced by a comment saying what happened,
where the decision is recorded, and that `api/admin.py`'s `save_map` action is
implemented and untouched — it simply has no UI path until phase 2 builds one.

Removing a broken button is a smaller diff than wiring a feature, and it leaves
phase 2 a clean choice rather than a half-built one.

## Decisions worth revisiting

- **No `rev` column** (design §8), restated from 1a, 1b and 1c. Three sessions have
  now proven `updated_at`-based optimistic concurrency works — raw PostgREST (1b),
  through `/api/map` (1c), and again here. The case for adding `rev bigint` is now
  weak. It is still a data-model change, so still **phase 2's call with Thomas
  present**.
- **The service-role key everywhere** (design §2). Every route bypasses RLS, so a
  bug in any route is a full-table bug. Phase 1 accepted this over an RLS policy
  that fails open silently. **Bug 2 in this file is precisely the shape of thing
  that assumption makes expensive** — a name-matching slip in one shared function
  reached across four credential paths with nothing underneath to catch it. Worth
  re-weighing now that there is evidence rather than argument.
- **No verse text for hosted users** (design §4). Unchanged; needs a `verses` table,
  which stops and waits.
- **`api/map.py`'s `GET` has no ownership check.** Anyone who knows a `user_id` can
  read that user's markdown, **including a map an admin has hidden**, because the
  `is_public` gate lives in `api/render.py` and not in `api/map.py`. The editor
  needs the unguarded read (it is how you load your own map), so closing it means
  giving `/api/map` a credential — an auth-model change, not a one-line fix.
  Deliberately not touched here. **On phase 2's list below.**
- **URL-parameter interpolation.** Routes build PostgREST paths with f-strings —
  `f"/users?id=eq.{user_id}"` — without quoting. A non-uuid value makes PostgREST
  400, which surfaces as `unknown_user`, so nothing is currently exploitable, but
  it is one column-type change away from being a real injection surface. Cheap to
  harden; deliberately out of scope for an integration pass.

---

## What phase 2's review should attack first

Ordered. The first four are the ones `decisions.md` and the plan name explicitly;
the rest are what this session found or could not close.

1. **Run the five admin actions against a real `is_admin = true` account, before
   anything else.** `list_users`, `delete_account`, `reset_pin`, `set_visibility`,
   admin `save_map`. Three of them contain a fix made this session that has never
   executed against the real database, and until Thomas signs up there is no admin
   account at all. **Confirm the account exists before believing any admin result.**

2. **Concurrent tabs** (`decisions.md`, for the black hat). The `409 conflict` is
   proven at the route. What is *not* proven is the editor's behaviour around it:
   two tabs both armed with the 1200 ms debounce, the non-dismissable `#dlgConflict`,
   and whether "reload and lose my edits" is genuinely the only exit a person has.
   Needs a browser or a very careful reading; this program forbids the browser.

3. **An empty save overwriting real work** (`decisions.md`). Four guards exist and
   the server-side `would_erase` is verified live. Attack the gaps *between* them:
   `force: true` bypasses the server guard entirely and the client decides when to
   set it; the `localStorage` draft is keyed by **user name**, so an admin's PIN
   reset or a rename would orphan a draft; and `beaconFlush` on `beforeunload` sends
   with no guard and no way to see the result.

4. **A `localStorage` user id with no matching row** (`decisions.md`). The server
   half is verified (`404 unknown_user` from both `/api/map` verbs). The client half
   — `apiFetch` clearing the session and redirecting with a one-shot notice, and the
   editor deliberately *not* doing that so a draft survives — is **code review only**
   in every sub-phase including this one. Nobody has ever watched it happen.

5. **The service-role-key-everywhere choice** (design §2) — see above; bug 2 is the
   evidence this decision was waiting for.

6. **The `rev`-column question** (design §8) — three sessions of evidence say the
   `updated_at` token works; this is now a data-model call to close, not an open risk.

7. **Hosted maps have no verse text** (design §4) — reference pills with no popover
   for anything Thomas has never cited. A product question before a technical one:
   is a visible blank acceptable to a stranger from his church?

8. **`api/map.py`'s unguarded `GET`** — hidden maps are readable by id. The one
   finding in this file that is a genuine privacy hole rather than a correctness bug.

9. **Every remaining f-string PostgREST path** — hardening, not a live bug.

10. **`/edit?as=` — wire it or delete `admin.save_map`.** Right now the capability
    exists in the API with no way to reach it. Decide which half survives.

11. **The pattern behind bugs 1–3 and 1b/1c/1d's.** Every bug phase 1 has produced
    lived in a join — a rewrite's effect on relative URLs, a response's content type,
    a PostgREST status code, an interpreter's name. None was in a function's logic.
    A review that reads files one at a time will find none of the next ones either.

---

## What landed across all of phase 1

| Sub-phase | Shipped |
|---|---|
| 1a | `users` migration (self-applying via the Supabase↔GitHub integration), `api/_lib.py`, `api/render.py`, `render.py`'s three pure functions, empty `requirements.txt`, byte-identity gate |
| 1b | `api/auth.py`, `web/session.js`, `web/index.html`, the concurrency mechanism answered against the real database |
| 1c | `api/map.py`, the storage-adapter seam, `engine/storage-local.js` + `storage-hosted.js`, hosted autosave with four empty-save guards |
| 1d | `api/gallery.py`, `api/admin.py`, `web/gallery.html` + `view.html` + `admin.html`, export |
| 1e | three seam bugs fixed, one dead link removed, `CLAUDE.md`, the full-system pass |

Six serverless functions, five static pages, two storage adapters, one table, one
renderer. **`requirements.txt` is still 0 bytes and there is still no third-party
import anywhere in the repo.**

**Deferred out of phase 1, deliberately:** `/edit?as=` wiring (phase 2), an
ownership check on `GET /api/map` (phase 2), the five un-run admin checks (phase 2,
blocked on Thomas), verse text for hosted users (needs a table), map history (needs
a table), and any redesign of the generated views (phase 7).

Then hand off to **phase 2** — `docs/hosting/phase-2-brief.md`, branch
`phase-2-harden`, Opus.
