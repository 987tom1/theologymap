# Phase 2 — six-hat review and harden (runnable brief)

Written 2026-08-18 to turn Project 13's `phase-2-review-and-harden.md` into
something a cold session can run end to end, with no other file open. Thomas is
away; do not wait for him except where stated below.

**Model:** Opus, main thread only. This phase is almost entirely judgment — do
not push any of the six hats to a subagent, and do not push the fix work to a
subagent either unless a fix turns out to be pure mechanical CRUD with no
judgment left in it once the finding is written down.

**Goal:** decide whether what phase 1 built is worth building a UI on top of
(phase 3), and fix what it is not. This is the most important review point in
the whole program — after it, phase 3 and phase 4 make the infrastructure far
more expensive to change. Review here or pay for it twice.

## Precondition

`docs/hosting/phase-1e-outcome.md` exists and 1a–1e are all merged to `main`.
If any of 1a–1e is missing or its outcome file says its own verification
failed, **stop and say so** — phase 2 reviews finished work, it does not
finish phase 1 for it.

## Read first, in this order

1. `docs/hosting/decisions.md` — Thomas's locked calls. They override
   everything below, including this brief, where they differ. Do not re-open
   them.
2. `docs/hosting/phase-1a-outcome.md` through `phase-1e-outcome.md` — what
   each phase-1 session thought it did.
3. `docs/hosting/phase-1-design.md` and `phase-1-plan.md` — what phase 1 was
   *supposed* to build, so drift is visible against a spec, not just against
   the outcome files' own account of themselves.
4. The diff of `main` against the commit phase 0 ended on. That diff is the
   actual subject of the review — the outcome files are a guide to reading
   it, not a replacement for reading it.
5. `Project 13/hosting-brief.md` — the requirements of record, to check
   drift. Note: as of this writing that file has four open amendments (views
   count, client key, admin, autosave-in-phase-3) — read the "Superseded by"
   blocks in place rather than trusting the original prose on those four
   points; `decisions.md` and `phase-1-design.md` are the sources of truth
   for what actually shipped.

**Do not read** `theology-map.html` or `documentation/verses.md` — nothing in
this phase requires either; verify by hashing and by running code, per phase
1's own convention.

## The six hats, in order

Work them in this order and write each one's findings down before moving to
the next. **Sequential, not blended** — the method depends on not mixing a
risk-hunting mindset with a "what's good here" mindset in the same pass. Do
not let a Black-hat finding bleed into the White-hat enumeration, and do not
let Green-hat fix ideas leak into Black before Black is finished.

**White — facts.** What actually exists now? Enumerate the routes, tables,
columns, env vars and entry points. How many lines changed in `render.py` —
does it match the ~15-line diff phase 1's design predicted? Is the extracted
pure function genuinely one implementation, or did a copy creep back in
somewhere (grep for a second `render_html`-shaped function, a second
`parse_text`)? Does `start_editor.bat` still work offline — **verify by
running it**, not by believing the outcome files (see the specific check
below). Confirm the four views (Map, Domain, Tier, Confidence) are what
ships, with no fifth.

**Red — instinct.** Where does this feel wrong? Which file would you dread
opening in six months? Which part of the flow would embarrass Thomas if
someone from his church tried it? Record the reaction without justifying it
yet — that comes in Black and Green.

**Black — risk.** Where does it break? This is the hat with the most
specific work in this phase, because the locked decisions in `decisions.md`
created concrete new failure surfaces that phase 1's own outcome files may
have merely asserted rather than proven. Each of the following **must be
independently verified in this phase**, not taken on the strength of a
phase-1 outcome file's say-so:

- **Autosave races across concurrent tabs.** Open (or simulate via two
  parallel `curl`/script sessions) two editing sessions against the same
  user, edit both, let both autosave. Confirm the optimistic-concurrency
  scheme actually works as phase 1c built it: `GET /api/map` returns
  `updated_at` as a token; `POST /api/map` sends `expected_updated_at`; a
  stale token gets **0 rows back and a 409 `conflict`**, not a silent
  overwrite. Confirm phase 1c's outcome file states whether the
  `updated_at=eq.` conditional PATCH worked or whether the `save_map` RPC
  fallback from design §8 was needed, and confirm whichever one is live
  actually behaves this way against the real database — do not assume the
  design doc's intent was what got built.
- **A debounced save writing empty content over real work.** Confirm all
  four guards from design §8 are actually present in the shipped code, not
  just described in the outcome file: (1) no save scheduler exists before
  `load()` succeeds; (2) the client shrink guard (empty, or under half the
  prior length past 500 chars, blocks the autosave and requires an explicit
  confirm-and-`force`); (3) the server-side `would_erase` 409 in
  `api/map.py` when `markdown` is empty/whitespace and the stored row is
  not, absent `force: true`; (4) the `localStorage` draft write before each
  scheduled save. Test at least guard (3) directly: POST an empty markdown
  against a user with a non-empty stored map, without `force`, and confirm
  409 `would_erase` — not 200.
- **A `localStorage` user id with no matching row.** Delete a test user's
  row directly in the database, then exercise the app with that id still in
  `localStorage`: every route should return 404 `unknown_user`; `session.js`
  should clear the id and redirect to `/app` with a message everywhere
  **except** the editor, which per design §8 must instead stop autosaving,
  keep the local draft, and show the copy-out message next to "Preview &
  copy full text" — confirm the editor is actually the one place this
  differs, since it is the easiest of the four guards to have forgotten.
- **The admin routes actually re-verifying name+PIN server-side on every
  action, and no route ever writing `is_admin`.** Read `api/admin.py` and
  `api/_lib.py`'s `require_admin` line by line. Confirm every one of the
  five actions (`list_users`, `delete_account`, `reset_pin`,
  `set_visibility`, `save_map`) calls `require_admin(name, pin)` before
  doing anything, and that a non-admin's or wrong-PIN's 403 is
  indistinguishable from the other. Then `grep -rn "is_admin" api/` and
  confirm every hit is a *read* — there must be no route, anywhere, that
  writes the column. `is_admin` is set only by the one-time SQL statement in
  `phase-1a-outcome.md`, run by Thomas directly against the database.
- **The PIN column genuinely unreachable from the client.** Confirm §2 of
  the design was actually built as specified: no Supabase key of any kind in
  any file under `web/` or `engine/`, and no PostgREST/Supabase REST call
  originates from the browser (`grep -rn "supabase\|postgrest\|SUPABASE" web/
  engine/` should be empty). Then confirm no response body from any route,
  anywhere, ever contains a `pin` field — grep actual captured responses,
  not just the route source, for the literal test PIN used during this
  phase's own exercising of the app.
- **Cold-start latency, measured not assumed.** Phase 1's design routes
  every read (gallery, view, editor load, render) through a Python
  serverless function rather than putting a key in the browser — a deliberate
  trade named explicitly in design §2 and flagged as a risk in
  `readiness.md`. Measure it: `curl -w '%{time_total}\n' -o /dev/null -s
  <url>/api/gallery` and the same against `/api/render` with a real
  markdown body, cold (first hit after a period of no traffic, or a fresh
  preview deploy) and warm (immediately after). Record both numbers in the
  outcome file. There is no pass/fail threshold handed down from above —
  the job here is to replace "it puts cold-start latency on the gallery and
  every page load" (readiness.md's own hedge) with an actual number, so
  Yellow/Green/Blue and phase 3 can reason about whether it is a problem
  worth designing around (a loading skeleton, a warm-up ping) or a
  non-issue.
- **`start_editor.bat` still working offline, verified by running it.** Turn
  off networking (or simply don't rely on any network call succeeding —
  disconnect Wi-Fi/pull the ethernet cable if convenient, or set an invalid
  proxy) and run `start_editor.bat`. Confirm it launches
  `engine/render_server.py`, serves `engine/editor.html`, that Connect /
  Upload a copy / Save & render all work exactly as before, and that the
  hosted-mode script injection (`web/session.js`) is never requested from
  `file://` or `localhost:8420` (confirm via the `HOSTED` detection logic in
  `editor.html`, and by watching for a 404 in the browser console if you
  have one available — no `claude-in-chrome`, read server logs / the page's
  own error surface instead). This is not optional and not satisfiable by
  reading 1c's outcome file — that file's own claim is exactly what is being
  checked.

Beyond this named list, also look for anything else that breaks: the render
route timing out on a large map, a missing env var in preview deploys versus
production, an inconsistency between what `api/gallery.py` returns and what
`web/gallery.html` expects. Be specific — name the file and line for every
finding.

**Yellow — value.** What did phase 1 get genuinely right that should be
protected through phases 3 and 4? Usually the single-renderer discipline
(one `render_markdown`, two callers) and the untouched local workflow. Name
these explicitly, with the file/function that embodies them, so a later
phase does not casually undo them while chasing a UI goal.

**Green — alternatives.** For the two or three worst Black-hat findings,
what is the cheapest fix that is not a rewrite? Also ask: is there anything
phase 3 or 4 will obviously need that would be far cheaper to add now, while
the schema is young and has no real user data in it yet? (The `rev` column
question from design §8, and the `map_versions` table design §1 sketches for
history/restore, are both candidates already flagged as "decisions worth
revisiting" by phase 1c/1d's outcome files — decide here whether either is
cheap enough to do now, or confirm they should wait.)

**Blue — process.** Was the 1a–1e split the right shape? Did Sonnet
subagents help, or produce work that had to be redone by the main thread?
What should phases 3–5 do differently, given what actually happened in
phase 1 (not what the plan predicted would happen)? This feeds directly into
how the remaining briefs get run — say so explicitly if a phase-3/4/5 brief
should be amended as a result.

## Then fix

From the findings, produce a ranked list, then implement:

- **Everything that risks data loss or silent corruption.** Non-negotiable —
  this is almost certainly where the Black-hat findings above land if any of
  them fail their check.
- **Everything that would be materially more expensive to fix after phase
  3.** Judge this against the Yellow/Green findings above, not by feel.
- **Nothing else.** Cosmetic issues belong to phase 3 — log them there
  rather than fixing them here, or the phases blur and this review's budget
  disappears into styling.

## The one thing this phase is allowed to do that no other phase is

**Phase 2 is the one phase in the whole program permitted to stop and wait
rather than proceed** — and only under one condition: the review concludes
something phase 1 built needs **redoing rather than patching**. This is not
about deploy risk (a broken deploy is cheap to revert, per `decisions.md`'s
working-style section, and that rule still applies to phase 2's own fix
work). It is that a half-finished rewrite, discovered days later by a
session with no memory of why it started, is far more expensive to recover
from than an unstarted one. If you reach that conclusion:

- Write the case up in full in `phase-2-review.md` — what specifically needs
  redoing, why patching it in place would leave a worse system than not
  touching it, and what the redo would look like at a high level.
- Do **not** start the rewrite yourself.
- Still merge whatever smaller fixes from the ranked list above are safe and
  complete on their own — "flag the rewrite, merge the rest" is the right
  combination, not "block everything on Thomas."
- Say so plainly at the top of `phase-2-outcome.md` so the next session (and
  Thomas, on his next remote check-in) sees it immediately rather than
  discovering it by reading between the lines.

Absent that specific condition, phase 2 follows the same "merging beats
waiting" rule as every other phase in `decisions.md`.

## Output

- `docs/hosting/phase-2-review.md` — the six hats' findings in full, kept as
  a permanent record. Phase 3 and phase 4 both read it before they start.
- `docs/hosting/phase-2-outcome.md` — what was fixed, what was deliberately
  deferred and to which phase, and the stop-and-wait verdict if triggered.
- A branch (`phase-2-review`) with the fix work, merged to `main` once it
  verifies, following the same "never force-push, never merge on a failed
  verification" rules as every prior phase.
