# Phase 1a — outcome

**Branch:** `phase-1a-schema` → merged to `main`.
**Ran:** 2026-08-22. Model: Opus, main thread.

**Verdict: the code half of 1a is complete and verified. The database half is
blocked on Thomas and cannot be verified from a session.** The byte-identity
gate — 1a's stated bar — passes exactly, locally and through the deployed
serverless route. The `users` table has **not** been created, because the
theologymap Supabase project is not reachable from any tool available here.

**1b cannot start until the two actions in "What Thomas must do" are done.**
This is the single most important line in this file.

---

## The byte-identity gate — PASS

| Hash | Value |
|---|---|
| `BASELINE_HASH` (pristine worktree at HEAD, pre-refactor `py engine/render.py`) | `20d869374343bc41b248f9045a50e48bcafa19909653b860608dfe0a229449ba` |
| Committed `theology-map.html` | `20d869374343bc41b248f9045a50e48bcafa19909653b860608dfe0a229449ba` |
| Refactored `render.render_markdown()` output, written with `Path.write_text` | `20d869374343bc41b248f9045a50e48bcafa19909653b860608dfe0a229449ba` |

All three identical. The committed HTML was **not** stale — regenerating in the
pristine worktree produced no diff at all, so phase 0.5 did leave it current.
No HTML file was ever opened; every comparison is a hash.

`len(verses) == 156` in both runs, so `sync_verses()` added no stub between them
and the two `verses` dicts are the same by content.

### Parser lockstep — PASS

| Check | Before refactor | After refactor |
|---|---|---|
| `once === twice` (parse→serialize→re-parse idempotent) | true | true |
| `once === src` (informational) | true | — |
| Node count, `editor-core.js` | 99 | 99 |
| Node count, `render.py` | 99 | 99 |

99 nodes across 14 domains, matching the post-0.5 baseline in `decisions.md`.
`editor-core.js` and `map-view.js` were **not** touched, so lockstep is preserved
by construction — the refactor changed only how `parse_text` receives its input,
never how it interprets it.

### The `render.py` diff

27 insertions, 8 deletions, one file. `parse` became `parse_text(str)` with a
one-line loop-header change and a thin `parse(path)` wrapper restored under the
original name; the same split for `parse_verses`/`parse_verses_text`; plus the
new `render_markdown(markdown_text, verses)`. `render_html`, `render_mm`,
`render_study`, `sync_verses`, `collect_refs`, `slugify`, `esc`, `main()` and
every module constant are untouched. `main()` and `sync_verses()` still call
`parse(SRC)` unchanged.

**Watch out for this if you edit `render.py` on Windows:** writing the file back
with `Path.write_text` translates every LF to CRLF and turns a 27-line diff into
a 2,653-line one. Write bytes with explicit LF instead. The committed diff is
clean.

### Local workflow — PASS

`py engine/render.py` runs offline, prints its usual report (99 nodes, 14
domains, 33 `#study`, 156 references, 0 missing), and writes all three generated
files with no content change. `git status` after the run showed only the intended
`engine/render.py` modification.

---

## The hosted render route — PASS, with a precise newline note

`POST /api/render` with `{"markdown": <theology-map.md>}` on the preview
deployment returned the map as HTML.

| | sha256 | bytes |
|---|---|---|
| Hosted response | `96d692a50d31240fbd267062308cd4c330551f846bdf013d3a019145b8d4a2a2` | 122,938 |
| Local `Path.write_text` output | `20d869…449ba` | 123,865 |

**These differ by exactly 927 bytes, which is exactly the number of CRLF
sequences in the local file.** LF-normalising both makes them byte-identical:

```
LF-normalised identical: True
difference is exactly the CRs: True
```

So the renderer emits LF; the CRs in the local artefact come from Windows newline
translation inside `Path.write_text`, which is what `main()` does and is therefore
correct for the local workflow. Nothing was "fixed" in the renderer — per the
plan, the *local* gate is the one the brief names, and it passes exactly.
`96d692a5…` is the LF-normalised hash and is the number a Linux-side check should
compare against in later phases.

This is the end-to-end proof that the hosted route and the local renderer are the
same renderer, calling the same `render_markdown`.

---

## Environment variables 1b–1e must use

**Discovery did not succeed. There are no Supabase environment variables in the
Vercel Preview environment — under any name at all.**

How that was established, since it contradicts `Project 13/CLAUDE.md`'s
"Deployment facts as of 2026-08-18":

- `vercel env ls` — **the Vercel CLI is not installed** on this machine
  (`vercel: command not found`), and there is no `.vercel/` link directory in the
  repo.
- Vercel MCP tools — not attempted beyond noting phase 0's finding that they are
  blind to this project.
- The sanctioned throwaway route — deployed as `api/envcheck.py` to the
  `phase-1a-schema` **preview** deployment, returning environment variable
  **names only, never a value**, and **deleted before merge** (commit
  "1a: remove throwaway discovery route"; it is not on `main`).

The probe returned, first filtered to `SUPABASE|POSTGRES|DATABASE`:

```
env_names: []
```

and then, unfiltered, the complete environment: `AWS_*`, `LANG`, `LD_*`,
`NOW_REGION`, `NX_DAEMON`, `PATH`, `PWD`, `PYTHON*`, `SHLVL`, `TURBO_*`, `TZ`,
`VERCEL_*` and `__VC_*` — **Vercel's own built-ins and nothing else.** No Supabase
URL, no key, under any spelling.

**The resolver's candidate lists are therefore left at both candidates each**
(`SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` /
`SUPABASE_SECRET_KEY`), rather than being trimmed to a confirmed name as the plan
intended, because nothing was confirmed. When Thomas sets the variables, **1b's
first job is to re-run this discovery and cut each tuple down to the one real
name.**

`api/_lib.py` fails loudly and by name if they are missing: a `RuntimeError`
listing every candidate tried, turned by `guard()` into a 500 whose JSON body
carries the message verbatim. A missing variable produces a named error on the
screen, never an empty gallery.

**Two readings, and I could not distinguish them from here.** Either the
Vercel↔Supabase integration was never actually established for this project, or
it was established with its variables scoped to **Production only** and not to
Preview. Production could not be probed without putting the throwaway route on
`main`, which the plan forbids. Thomas can tell which in one glance at the
dashboard.

---

## The migration — written and committed, NOT applied

`supabase/migrations/20260818120000_users.sql` is checked in, verbatim from
design §1: `pgcrypto`, the `users` table (`id`, `name`, `pin`, `markdown`,
`is_admin` default false, `is_public` default **true**, `created_at`,
`updated_at`), the `lower(name)` unique index, the partial gallery index, the
three length checks, the `touch_updated_at` trigger, and RLS enabled with **no
policies**. The checked-in file is the source of truth.

**It has not been applied to any database, and no session should claim it has.**

The Supabase MCP tools authenticate to an account that can see exactly two
projects, and **neither is theologymap**:

| Project | What it actually is |
|---|---|
| `connection-made-simple` (`ltcblcudlzlzfcyzlhpc`) | a live church-connections app — `students` 737 rows, `service_attendance` 12,700 rows, `users` 21 rows |
| `my-youth-camp` (`nwfafrgojqkxylbppywo`) | a live youth-camp app — `people` 412 rows, `churches` 29 rows, `users` 69 rows |

Both already have a `public.users` table holding real data. **Applying this
migration to either would have been destructive, so I did not**, and a later
session must not either. If a tool offers you a project list, read the table names
before you touch it.

The Supabase CLI is also absent (`supabase: command not found`), as is `psql`. So
all three of the plan's application routes were unavailable.

### Therefore un-run, and honestly declared un-run

- **Task 1a.3 Step 3** — verifying the column shape and defaults came out right.
- **Task 1a.3 Step 4 — the concurrency smoke test.** Whether
  `PATCH /users?id=eq.<id>&updated_at=eq.<token>` with
  `Prefer: return=representation` returns 1 row for a fresh token and **0** for a
  stale one is **unknown**. 1c's autosave depends on this.
  **1b must run it as its first act** once the database exists, and if the equality
  filter on `timestamptz` misbehaves (text formatting, `+` in the offset needing
  URL encoding), add the documented `save_map(p_id, p_expected, p_markdown)` SQL
  function from design §8 to the same migration and say so, so 1c builds against
  the right mechanism.

---

## What Thomas must do — 1b is blocked until both are done

1. **Confirm the Supabase project exists, and connect it to Vercel.** Neither is
   visible to any tool a session has. In the Vercel dashboard, Project
   `theologymap` → Settings → Environment Variables: confirm a Supabase URL and a
   **service-role** key exist and are enabled for **Preview as well as
   Production** (Preview is where every phase verifies before merging). Note the
   exact variable names — 1b trims the resolver to them.

2. **Apply the migration**, by pasting
   `supabase/migrations/20260818120000_users.sql` into the Supabase SQL editor for
   the theologymap project. Then, once you have signed up in the app (1b), run the
   admin bootstrap, once:

   ```sql
   update public.users set is_admin = true where lower(name) = lower('Thomas');
   ```

   No API can set `is_admin` — sign-up is open, so a route that granted admin would
   let anyone promote themselves. `run-order.md` already lists this bootstrap as
   your one mid-chain action; it now has a prerequisite above it.

Still open from earlier phases, unchanged and low cost: confirm whether
`987tom1.github.io/theologymap` is a dead GitHub Pages deploy (`readiness.md` A.3).
A session could otherwise verify against a stale build and report a false green.

---

## What landed

| Path | State |
|---|---|
| `engine/render.py` | modified — `parse_text`, `parse_verses_text`, `render_markdown` added; `parse`/`parse_verses` kept as thin file wrappers |
| `supabase/migrations/20260818120000_users.sql` | new — **written, not applied** |
| `api/_lib.py` | new — the only file that knows Supabase |
| `api/render.py` | new — `{markdown}` or `{user_id}` in, HTML out |
| `requirements.txt` | new, **empty** (0 bytes) — makes Vercel detect the Python runtime |
| `vercel.json` | phase 0's `/` rewrite untouched; `functions.includeFiles` added |
| `.gitignore` | `.env` and `.env.*` added |

Standard library only. No third-party import anywhere. `requirements.txt` is
0 bytes and must stay that way.

### Deployment facts 1b–1e should not have to rediscover

- **The site and preview deployments are public.** Vercel Authentication is off:
  `https://theologymap-thomas-l-s-projects.vercel.app/` returns 200, and so does
  the branch preview. Live verification is available.
- **Branch previews are addressable without the CLI**, at
  `https://theologymap-git-<branch>-thomas-l-s-projects.vercel.app`. This is how 1a
  verified the render route. Push the branch, poll the URL, verify, then merge.
- **Vercel puts `/var/task` on `sys.path` but not `/var/task/api`.** A route
  importing a sibling module needs
  `sys.path.insert(0, str(Path(__file__).resolve().parent))` first, or it dies with
  `ModuleNotFoundError: No module named '_lib'` and a bare
  `FUNCTION_INVOCATION_FAILED` in the browser. `api/render.py` does this; **every
  route 1b–1d writes must do it too.** This cost a deploy cycle to find.
- **Files whose names begin with `_` are not routed.** `api/_envcheck.py` 404ed;
  renaming it to `api/envcheck.py` worked. `api/_lib.py` is correctly invisible as a
  route, which is what design §6 wanted — its 404-returning `handler` class is belt
  and braces, not load-bearing.
- **The whole repo is uploaded into the function bundle** — `engine/`,
  `documentation/verses.md`, even `theology-map.html` and `docs/` all appear under
  `/var/task`. `includeFiles` was kept anyway as a declaration of intent and because
  relying on undocumented whole-repo upload is how a future deploy breaks silently.
  `ROOT = Path(__file__).resolve().parent.parent` resolves to `/var/task` and
  `documentation/verses.md` reads fine, so the design's fallback (widening the glob)
  was not needed.
- Python is **`py`, not `python`**, on this machine — 3.11.9. Bare `python` hits the
  Microsoft Store stub. The Vercel runtime is **Python 3.12**.

---

## What would have to change if map history is wanted later

Copied from design §1, as the plan requires:

> Add `map_versions(id, user_id, markdown, saved_at)`; have `api/map.py`'s save
> insert a row there before the `UPDATE`; keep `users.markdown` as the head pointer
> so nothing else changes. The editor, gallery, render route and export all keep
> working untouched — they only ever read `users.markdown`. Retention would need a
> cap (last N per user, or an age-based purge) because autosave writes far more
> often than an explicit save button would.

---

## Decisions worth revisiting

- **No `rev` column** (design §8). Optimistic concurrency rides on `updated_at`, a
  column the brief already mandates, because adding one is a data-model change and
  `decisions.md` says those stop and wait. A `rev bigint` would be cleaner and
  immune to any timestamptz round-tripping quirk. **Phase 2 should take this with
  Thomas present** — and note that 1a could not run the smoke test that would have
  told us whether the quirk is real.
- **No verse fetching for hosted users** (design §4). `documentation/verses.md`
  ships as a bundled read-only asset, parsed once per cold start. A hosted user
  citing a reference Thomas has never cited gets "Not yet added to verses.md" —
  nothing breaks and nothing is fabricated, which keeps the program's hardest rule
  by construction. Filling those gaps needs a `verses(reference, text, fetched_at)`
  table: a new table, so it stops and waits.
- **Server-mediated data access instead of the brief's anon key** (design §2).
  `hosting-brief.md` assumed "the anon key will be in public client code". Phase 1
  puts **no** Supabase key of any kind in the browser; every read and write goes
  through `api/*.py` with the service-role key. The cost, stated honestly: that key
  bypasses RLS, so a bug in a route is a full-table bug. With one table and a
  dataset whose worst leak is a church member's four-digit PIN, that beats an
  RLS-policy mistake that fails open silently.
- **`api/_lib.py` was written on the main thread, not by a Sonnet subagent** as Task
  1a.5 directed. It is ~120 lines of known shape and this session's harness
  discourages spawning agents unasked; the round trip would have cost more than the
  file. The review Step 2 asked for was done: no key or URL appears in any response
  body, nothing secret is printed, and there is no third-party import.

## Decisions I made for you

- **Kept both env-var candidates in each resolver tuple** rather than trimming to
  one, because discovery failed. See above.
- **Did not apply the migration to either visible Supabase project.** Both hold live
  data belonging to other applications. This is not a judgment call I think is
  close.
- **Verified the render route on the branch preview URL rather than production**,
  since production builds from `main` and 1a had not merged yet. The route needs no
  database for the `{markdown}` path, so the gate was runnable despite the missing
  credentials.

## Verification summary

| Check | Result |
|---|---|
| Byte identity (**the bar**) | **PASS** — refactored output == `BASELINE_HASH` |
| Local workflow intact, offline | **PASS** — all three generated files written, no diff |
| Parser lockstep | **PASS** — `once === twice`; JS and Python both 99 nodes |
| `git diff engine/render.py` | **PASS** — 27+/8−, additive, no unrelated restructuring |
| Migration applied | **BLOCKED** — theologymap Supabase project unreachable |
| Concurrency mechanism | **BLOCKED** — needs the table; 1b must run it first |
| Secrets | **PASS** — no key, no URL, no `.env`; only the candidate *names* appear |
| `requirements.txt` empty | **PASS** — 0 bytes |
| Hosted route | **PASS** — HTML returned; identical to the local artefact modulo CRLF, explained above |

Merged on the strength of the gating local checks, with the two blocked database
checks declared here rather than claimed. Per `decisions.md`: merging beats
waiting, and claiming an unverified check does not.

---

## Post-merge verification on production

Run after the merge commit deployed, against
`https://theologymap-thomas-l-s-projects.vercel.app`:

- `POST /api/render` with the full `theology-map.md` returns
  `96d692a50d31240fbd267062308cd4c330551f846bdf013d3a019145b8d4a2a2` — the
  LF-normalised baseline hash, exactly. The hosted renderer and the local one agree
  in production, not only on a preview.
- `POST /api/render` with `{}` returns `400 {"error": "bad_request", "message":
  "Send either markdown or user_id."}` — the error path works and `guard()` is wired.
- `GET /api/envcheck` returns **404**. The throwaway discovery route is not on
  `main` and is not reachable.
- `GET /` still returns 200 and still serves `theology-map.html`. Phase 0's rewrite
  survived, and every link Thomas has already shared still works.

The first request after a deploy 404s while the function cold-builds; the second
succeeds. Poll the route itself, not `/`, when verifying a fresh deploy — `/` is
static and returns 200 before the Python functions are ready.
