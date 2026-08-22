# Phase 1b — outcome

**Branch:** `phase-1b-auth` → merged to `main` (`--no-ff`, commit `1e6d98a`), followed by
three small direct-to-`main` commits for the smoke-test route's lifecycle (added, scoped
cleanup added, removed) — see "How the smoke test actually ran" below for why those
landed outside the usual single-merge shape.

**Ran:** 2026-08-22. Model: Sonnet, main thread; three Sonnet subagents for 1b.2–1b.4.

**Verdict: 1b is complete. All verification-table checks pass on production. The
concurrency smoke test 1a couldn't run — ran, and answered the open question. 1c is
unblocked and knows which mechanism to build against.**

---

## The concurrency answer — 1c builds directly on this

**The plain PostgREST conditional PATCH works. No `save_map` RPC fallback is needed.**

Ran against production (see below for why it had to be production, not preview):
insert a throwaway row, read `updated_at` as the token, `PATCH /users?id=eq.<id>&updated_at=eq.<token>`
with `Prefer: return=representation`, twice — once while the token is still fresh, once
after (now stale, since the first PATCH's trigger already advanced `updated_at`):

```json
{"fresh_status": 200, "fresh_rows": 1, "stale_status": 200, "stale_rows": 0, "pass": true}
```

Exactly the semantics design §8 needs: a fresh token updates and returns 1 row; a stale
token matches nothing and returns 0 rows, `updated_at`'s timestamptz equality filter
round-trips correctly through PostgREST with no text-formatting or `+`-offset encoding
problem. **1c should implement `api/map.py`'s optimistic concurrency exactly as design §8
specifies** — the conditional PATCH, 0 rows ⇒ 409 `conflict` — with no schema change and
no `save_map(p_id, p_expected, p_markdown)` function. That fallback function was never
written; it isn't needed.

## How the smoke test actually ran — an environment constraint, not a plan deviation

The plan's own instructions for this session said to probe the branch preview first and,
if it comes back `500 misconfigured` (no DB there), verify on production after merging.
That's exactly what happened, but the smoke test needed this *before* 1c can be briefed,
so the sequence was:

1. Wrote `api/smoketest.py` (self-contained — it only ever inserts and deletes a row it
   creates itself in the same request; it never accepts a caller-supplied id, so a stray
   hit while it was briefly live could not touch a real user's row) alongside Task 1b.1's
   credential helpers, on `phase-1b-auth`.
2. Probed the branch preview: `POST .../api/render {"user_id":"000...0"}` → `500
   misconfigured` — confirmed, as expected, that branch previews still have no Supabase
   credentials.
3. Built and reviewed the rest of 1b (auth.py, session.js, index.html) on the same branch,
   merged the whole branch to `main` once the checks that *could* run pre-merge (local
   workflow, syntax, static PIN-leakage grep, code review) passed.
4. Ran the smoke test against **production** immediately post-merge (the first request
   404s while the function cold-builds; the second succeeds, as documented in
   `phase-1a-outcome.md`).
5. Ran the full auth verification table against production too, since it's equally
   DB-dependent (see table below).
6. The verification table's signup checks necessarily created one real row
   (`__phase1b_verify_<timestamp>`) in production. Added a narrowly-scoped `DELETE`
   handler to the same throwaway route — restricted to `name=like.__*` (double-underscore
   prefix only, the convention this file already used for all its test data), so it could
   never delete a real user's row regardless of who might hit it in the brief window it
   was live — ran it (`{"deleted": 1}`), then confirmed via `POST /api/render
   {"user_id": "<that id>"}` returning `404 unknown_user` that the row was really gone.
7. Removed `api/smoketest.py` entirely with a final commit, confirmed `POST
   /api/smoketest` now 404s on production.

Three small commits landed directly on `main` after the merge commit (add cleanup handler,
run it, remove the whole file) rather than going through a branch-and-merge cycle each
time — merging beats waiting, and round-tripping a one-line throwaway addition through a
fresh branch would have cost more than the file. `main` was never left in a broken state
between these commits; each one deploys and is immediately usable on its own.

**Why this couldn't happen on a branch preview at all:** confirmed again here — Preview
environments have no Supabase env vars under any name (`phase-1a-outcome.md`). Any route
that touches the database can only be exercised on production. A future phase needing
another one-off DB check should expect the same shape: throwaway route, merge, run, clean
up, remove — not a preview cycle.

## Verification table — all PASS, run against production

| Check | Result |
|---|---|
| Signup (new name) | `200 {"user_id": "...", "name": "__phase1b_verify_...", "is_admin": false}` |
| Duplicate name, same case | `409 name_taken` |
| Duplicate name, different case | `409 name_taken` — confirms `ilike` matches the `lower(name)` unique index correctly |
| Login good | `200` with `user_id` |
| Login bad PIN | `401 bad_credentials`, `"Incorrect name or PIN."` |
| Login unknown name | `401 bad_credentials`, **identical** message and code to bad PIN |
| PIN leakage | grepped every captured response body for the test PIN — **zero hits** |
| Bad method (`GET /api/auth`) | `405 method_not_allowed` |
| New-row defaults | confirmed via `POST /api/render {"user_id": ...}` returning `200` with rendered (empty) HTML rather than `404` — proves `is_public` defaulted `true`; response never includes `pin` at any point so it can't be checked directly, but the column is never selected in any route that reaches a reply body |
| Local workflow | `py engine/render.py` runs clean; `git status` after every commit showed nothing under `engine/` touched |
| `/app` reachable | `200`, serves the sign-in page |
| `/web/session.js` reachable | `200` — needed because `web/index.html` imports it by absolute path (see bug below) |

## A bug caught in review, fixed before merge

`web/index.html` (written by a subagent, correctly per its brief) originally imported
`./session.js` — a relative path. **This 404s in production.** `/app` is a Vercel
*rewrite* to `/web/index.html`, not a redirect: the browser's address bar and its
relative-URL base stay at `/app`, so `./session.js` resolves to `/session.js`, which
doesn't exist. Fixed to the absolute `/web/session.js` before merging.

**1c and 1d must use absolute `/web/session.js` imports too** — `/edit`, `/gallery`,
`/view`, `/admin` are all the same rewrite shape (design §6), so every one of them would
hit this exact bug with a relative import.

## `web/session.js` — the interface 1c and 1d import

```js
export function getUser()      // -> {id, name, is_admin} | null
export function setUser(u)     // persists {id, name, is_admin}; never stores a pin
export function clearUser()
export function requireUser()  // getUser() or redirects to /app
export async function apiFetch(path, options)
  // JSON in/out. Non-2xx: shows the shared banner via showError(body.message) and
  // throws/rejects — callers don't need to duplicate error display, just catch to
  // stop their own flow (e.g. re-enable a submit button in a finally).
  // 404 unknown_user specifically: clears the session, stashes a one-time notice in
  // sessionStorage (key 'theologymap:notice'), and redirects to /app, which shows it
  // once on load and clears the key.
export function showError(message)
export function showNotice(message)
  // Both write/update a single #tm-banner div at the top of <body>, never stack.
```

No default export. No framework, no build step — loaded as `<script type="module">`.

## `api/auth.py` — the interface

`POST /api/auth` `{action: "signup"|"login", name, pin}` → `{user_id, name, is_admin}` on
success. Errors: `400 bad_request` (blank name; PIN outside 4–12 chars; unknown action),
`409 name_taken` (signup), `401 bad_credentials` (login, one message for both unknown-name
and wrong-PIN). Every other HTTP method → `405 method_not_allowed`. `pin` is read from the
request body and sent once to PostgREST on insert/lookup — it is never placed in any reply
body, on any path; grepped and confirmed above.

## What goes to Sonnet subagents — done as planned

1b.2 (`api/auth.py`), 1b.3 (`web/session.js`), 1b.4 (`web/index.html` + `vercel.json`
rewrite) dispatched in parallel, each a fresh agent with no shared context, none running
git commands (avoids concurrent-write races on one working tree — the main thread did a
single review-and-commit pass afterward, per Task 1b.5). All three came back `DONE` with
no blocking concerns. Task 1b.1 (credential helpers) and the smoke-test route stayed on
the main thread, per the plan.

## Decisions I made for you

- **Ran the concurrency smoke test via a temporary production route**, not preview,
  because previews have no database credentials and this answer has to exist before 1c's
  session starts. Self-limited to never touch a caller-supplied row; used, verified,
  cleaned up, removed — full lifecycle in one session, documented above.
- **Fixed the `./session.js` → `/web/session.js` import bug directly during review**
  rather than bouncing the file back to the subagent that wrote it — a one-line fix on a
  file another agent had already produced correctly against the letter of its own brief
  (the bug is in how Vercel rewrites interact with relative URLs, not something the brief
  called out).
- **Three small commits landed directly on `main` after the phase merge** for the
  smoke-test route's cleanup lifecycle, rather than a second branch-and-merge cycle. Never
  left `main` broken between them.

## Decisions worth revisiting

- None new. `phase-1a-outcome.md`'s "no `rev` column" note stands, and this session's
  result makes it slightly less urgent to revisit: the `updated_at`-based conditional PATCH
  it was worried about (timestamptz round-tripping) is now proven to work correctly against
  the real database, not just in theory.

## For Thomas — the one action mid-chain

**Now that accounts exist, sign up in the app** (`/app` on
`https://theologymap-thomas-l-s-projects.vercel.app/app`), then run this once in the
Supabase SQL editor for the `theologymap` project:

```sql
update public.users set is_admin = true where lower(name) = lower('Thomas');
```

This is the only SQL a human runs in the whole program (per `run-order.md` and
`phase-1a-outcome.md`) — it can't be a route or a migration because sign-up is open, so any
route that could grant admin could grant it to anyone. Session 4 (1d, the admin surface)
needs `is_admin = true` on your row to be testable, and everything after inherits it.
