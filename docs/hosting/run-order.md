# Run order — one session per window

Written 2026-08-22. The question this answers: Thomas is executing phases 1–7
across many sessions, each capped by a 5-hour usage window. Which session runs
next, on which model, reading exactly what?

`decisions.md` still overrides everything. This file only sequences the work and
budgets its context; it decides nothing.

## Before session 1

- [x] **Session 1 (1a) ran 2026-08-22 and is merged to `main`.** Byte-identity gate
      passed exactly; the `users` table exists and is verified. **Session 2 (1b) is
      next.** Read `phase-1a-outcome.md`'s amendment before its body — the session
      merged with two database checks declared unrun, and both were resolved within
      hours.
- [ ] Commit any pending doc edits, so no session inherits a dirty tree.
- [x] **`phase-3-plan.md` Task 8's "GATED. DO NOT START." is stale** — and session
      8 ran it (2026-08-23). Left here as the worked example: a plan is not
      rewritten in place when a decision supersedes it, so a session reading only
      its plan section will skip work Thomas has already paid for.
      *(original note follows)*
- [x] **`phase-3-plan.md` Task 8's "GATED. DO NOT START." is stale** — the
      provenance question it waits on is answered in `decisions.md` ("Copy
      provenance is two columns on `users`", Option A). Task 8 runs inside phase
      3. Do not spend a separate session on it.

## The order

Each row is one session in one window. "Reads" is exhaustive — a session opens
nothing else unless its own plan section names the file.

| # | Session | Branch | Model | Reads |
|---|---|---|---|---|
| 1 | 1a — data model, Supabase wiring, render API | `phase-1a-schema` | Opus | `phase-1-plan.md` L1–123 + L124–563 |
| 2 | 1b — accounts and PIN login | `phase-1b-auth` | Sonnet | `phase-1-plan.md` L1–123 + L564–755, `phase-1a-outcome.md` |
| 3 | 1c — hosted editor with autosave | `phase-1c-editor` | Sonnet | `phase-1-plan.md` L1–123 + L756–988, `1a`+`1b` outcomes |
| 4 | 1d — gallery, export, admin surface | `phase-1d-gallery` | Sonnet | `phase-1-plan.md` L1–123 + L989–1140, `1a`–`1c` outcomes |
| 5 | 1e — integration pass | `phase-1e-integration` | Opus | `phase-1-plan.md` L1–123 + L1141–end, all `1x` outcomes |
| 6 | Phase 2 — six-hat review + fixes | `phase-2-harden` | Opus | `phase-2-brief.md` |
| 7 | Phase 3 Tasks 0–4 — theme, node editor, layout | `phase-3-ui` | Opus + Sonnet fan-out | `phase-3-plan.md` L1–764 |
| 8 | Phase 3 Tasks 5–9 — cards, first run, sharing, merge | `phase-3-ui` (same branch) | Opus + Sonnet fan-out | `phase-3-plan.md` L1–125 + L765–end |
| 9 | Phase 4 Tasks 0–4 — schema, validator, generator | `phase-4-wizard` | Opus | `phase-4-plan.md` L1–555 |
| 10 | Phase 4 Tasks 5–8 — wizard UI, seed content, merge — **done** | `phase-4-wizard` (same branch) | Opus | `phase-4-plan.md` L1–92 + L556–end |
| 11 | Phase 5 — denominational research corpus | `phase-5-corpus` | Opus main, Sonnet research subagents | `phase-5-brief.md` |
| 12 | Phase 6 Tasks 0–2 — tradition maps, compare engine | `phase-6-compare` | Opus | `phase-6-plan.md` L1–422 |
| 13 | Phase 6 Tasks 3–7 — render, learn, compare surfaces | `phase-6-compare` (same branch) | Opus | `phase-6-plan.md` L1–85 + L423–end |
| 14 | Phase 7 — redesign the generated views | `phase-7-views` | Sonnet | `phase-7-brief.md` |
| 15 | Phase 8 — version history and restore | `phase-8-versions` | Sonnet | `phase-8-brief.md` |

**Phase 5 (session 11) may run in parallel** with 7–10 once phase 4's schema is
frozen — it produces content, not code.

**Phase 8 now runs next, ahead of phase 5 — Thomas's call, 2026-08-23.** The
wizard went live the same day, and phase 8 is the undo that insures against it.
It needs only `map_versions`, live and verified since session 9. Run it as the
next session on `phase-8-versions`; phases 5–7 keep their order behind it.

**Phase 8 (session 15) is last by convenience, not by dependency.** It needs only
`map_versions`, which shipped and was verified in session 9, so it can run any
time after phase 4 — pull it forward if losing work to the wizard is a live
worry. Everything else is sequential.

## Progress

- **Thomas answered all six of session 10's questions on 2026-08-23**, and four
  were actioned the same day (`decisions.md`, *after phase 4 session 10*):
  outward source links now open in a new tab and save first, `Continuationism`
  moved from `church.json` to a new `content/wizard/holy-spirit.json` to match
  where his own map files it, design §4.8's worked example is corrected, and INC
  stays third in the lens. **The corpus is now three domain files, not two.**
  One answer binds the next content session: the seed has **no
  `orthodoxy: "outside"` position**, and **phase 5 must exercise that branch
  deliberately in its first domain** and say so in its outcome file.

- **Session 10 (phase 4, Tasks 5–8) ran 2026-08-23 and is merged. Phase 4 is
  complete.** The wizard is live at `/wizard` (`web/wizard.html` +
  `web/wizard.js`, no new serverless function), the seed corpus is twelve
  doctrines across Scripture and Church, `engine/corpus_refs.py` put its 44 new
  references into `verses.md` and all of them fetched, and `WIZARD_ENABLED` is
  `true`. **Session 11 (phase 5) is next** — or session 15 (phase 8), which is
  now the better call: the wizard is the feature that makes losing work
  possible, and phase 8 is the undo. Three things for the next session in
  `phase-4-outcome.md`: **design §4.8's worked example fails validator rule 15**
  as written (its Lutheran baptism entry needs a `tradition_overrides` entry,
  and every phase 5 session will copy that example); the seed contains **no
  `orthodoxy: "outside"` position**, so that whole UI branch ships unexercised;
  and `render.py` now ships only the verses a map actually cites — without that,
  every domain phase 5 adds would inflate `theology-map.html` and every hosted
  render. **Two of the four Sonnet subagents were killed mid-run by an
  account-level spend limit**; phase 5 is the most fan-out-heavy phase left, so
  brief each agent narrowly enough that the main thread can finish its file
  rather than restart it.

- **Session 9 (phase 4, Tasks 0–4) ran 2026-08-23 and is merged.** `map_versions`
  (written first, by the locked decision, and **verified applied on production** —
  the table, the throttle and the force exception all exercised against the real
  database), the content manifest and the fourteen-tradition registry, the
  validator with all twenty rules, and the pure generator. **Session 10 (Tasks
  5–8) is next**, on the same `phase-4-wizard` branch. Three things for it to
  read in `phase-4-outcome.md` before touching the plan: `traditions.json` has
  **fourteen** entries not thirteen (`decisions.md` adds INC), the validator's
  missing-file check is a **warning** not an error, and **Task 4's tests read
  `tests/fixtures/corpus/`, not `content/wizard/`** — the plan's Task 4 asserts
  on doctrines Task 6 has not written yet. Task 8's suite must add a run against
  the real corpus. The design canvas is linked at the top of the outcome file.
  One thing for Thomas: a throwaway account `zz-schema-check` is in the gallery
  and can be deleted from `/admin`.

- **Session 8 (phase 3, Tasks 5–9) ran 2026-08-23 and is merged.** Gallery cards,
  first run with three live starting points, sharing, **Task 8 (start from someone
  else's map — it was unblocked, not gated)**, and `/` as a landing page with
  Thomas's map moved to `/thomas`. Phase 3 is complete; `phase-3-outcome.md` is
  finished. **Session 9 (phase 4, Tasks 0–4) is next**, and `map_versions` opens it.
  Two things for that session to read first: the outcome file's "Where the wizard
  goes" section (the `WIZARD_ENABLED` gate and the no-new-API contract), and its
  note that `supabase/migrations/20260823120000_copied_from.sql` must be **verified
  as applied**, not assumed.
- **Session 7 (phase 3, Tasks 0–4) ran 2026-08-23 and is merged** (`c5029f9`, plus
  three follow-up commits on `main`). Theme tokens and shared chrome, the node
  editor's promoted/optional split in both editing surfaces, the editor's first
  responsive layout, and server-derived gallery counts. Byte identity holds and the
  phase-2 baseline hashes did not move. **Session 8 (Tasks 5–9) is next, on the
  same `phase-3-ui` branch**, and finishes `phase-3-outcome.md`. Read that file's
  "wrong turn" section before touching `api/gallery.py` — its zero counts on
  production are correct, not a bug. The design canvas Thomas can review is linked
  at the top of it.
- **Sessions 1–6 (1a, 1b, 1c, 1d, 1e, phase 2) are complete and merged.**
  Phase 2 ran 2026-08-23 on `phase-2-harden` (the brief's `phase-2-review` name was
  superseded by this file); it closed an unauthenticated map-overwrite and a stored
  XSS, and its review is `phase-2-review.md`.
- **Thomas's one manual action is done.** The `is_admin` bootstrap ran, and on
  2026-08-23 he walked all five admin actions through on production — all green.
  Nothing in the chain is waiting on him.
- Two calls were locked on 2026-08-23 and bind phases 3 and 4: **unlisting is not
  privacy** (no id rotation; the control reads Unlist/Relist) and **`map_versions`
  opens phase 4**. Both are in `decisions.md`; both plans are amended in place.

## Thomas's one action mid-chain — done

**After you have signed up in the app (session 2, 1b):** run the `is_admin`
bootstrap SQL in the Supabase editor against your own row (`readiness.md` A.4; the
exact statement is in `phase-1a-outcome.md`). One statement, doable from a phone.
Session 4 (1d) needs it and everything after inherits it.

This is **the only SQL a human runs in the whole program.** It cannot be a
migration and cannot be a route: sign-up is open, so anything that could grant
admin could grant it to anyone.

## How the database actually gets changed — read before writing any migration

Established 2026-08-22 while running session 1. Three facts that are not obvious
and cost that session a merge:

- **Migrations deploy themselves.** Thomas has the Supabase↔**GitHub** integration
  as well as the Supabase↔Vercel one. It watches `supabase/migrations/` and applies
  new files on push to the production branch. 1a's migration applied itself on the
  merge push; nobody pasted SQL. **Write the file, commit it, push it — then verify
  it landed** with `supabase/verify-users-migration.sql`, adapted. Committed is not
  the same as applied.
- **The Supabase and Vercel projects live on a different account from the one this
  machine's Claude MCP tools authenticate to.** Permanent, not a misconfiguration.
  **No session can apply a migration, read an env var, or inspect a table through
  MCP.** `list_projects` returns two *unrelated* live applications that both have
  their own `users` tables — `connection-made-simple` and `my-youth-camp`. **Never
  run DDL against either.**
- **Branch previews have no database.** The Supabase env vars are scoped to
  Production only, so a preview deployment's DB routes return
  `500 misconfigured`. Probe before you rely on it:

  ```
  POST <base>/api/render {"user_id":"00000000-0000-0000-0000-000000000000"}
  ```

  `404 unknown_user` means credentials resolved. `500 misconfigured` means they did
  not — verify on production after merging instead, and say so in your outcome file
  rather than claiming a check you could not run.

Phase 3 Task 8's migration (`copied_from uuid`, `copied_at timestamptz`) was
written and pushed by session 8 on 2026-08-23 —
`supabase/migrations/20260823120000_copied_from.sql`. **Committed is not applied:
the next session verifies it landed before trusting `copy_from` or the gallery's
`started_from` field.** ~~One further migration remains, **phase 4's `map_versions`**.~~ **Written,
pushed and verified applied on 2026-08-23 by session 9** —
`supabase/migrations/20260823170000_map_versions.sql`, plus the
`public.snapshot_map` RPC the throttle and retention live in. **The program has
no remaining migrations**, apart from the `save_map` RPC fallback only if 1b's
smoke test ever demands it. Phases 5–7 need no DDL; phase 6 ships deliberately
no-schema.

**Verifying `map_versions` needed a new trick, because the usual one does not
work.** `api/_lib.py`'s `snapshot_map()` swallows every failure by design (a lost
snapshot must never cost somebody their save) and no route reads the table, so a
missing table is indistinguishable from a healthy throttled save. The save reply
therefore carries `snapshotted: true|false`, and the check is a real save through
`POST /api/map` — see `phase-4-outcome.md`, "How I made it verifiable".

~~Also still open: confirm whether `987tom1.github.io/theologymap` is a dead GitHub
Pages deploy.~~ **Closed 2026-08-23 by session 8: it 404s.** There is one live
deployment, the Vercel one, and no stale build to report a false green against.

## Why 1b–1d are not fanned out in parallel from session 1

They are strictly sequential, by their own preconditions: 1b needs 1a's migration
and **the env var names 1a discovered**, 1c needs `api/auth.py` and `web/session.js`
from 1b, 1d needs `verify_credentials`/`require_admin` from 1b and `api/map.py` from
1c. Parallel subagents would each invent a contract that does not exist yet, and the
reconciliation costs more than the sessions saved.

The fan-out that does pay is **inside** each sub-phase — every one has a
`## What goes to Sonnet subagents` section naming exactly which tasks are
independent. 1b fans out 3 ways, 1d fans out 4. 1e fans out none, deliberately.

## Session prompt template

```
Read "C:\Users\ThomasPC\Desktop\AIProjects\Project 13 - Prompt for Projects\CLAUDE.md",
then in this repo: docs/hosting/decisions.md, docs/hosting/run-order.md, and
docs/hosting/phase-<N>-plan.md lines <A>-<B>, plus docs/hosting/phase-<prev>-outcome.md.
Nothing else unless the plan section names it.

Execute that section on branch <branch>. Python is `py`, not `python`.
Dispatch the tasks its "What goes to Sonnet subagents" section names, in parallel.
Run the section's verification. If it passes, merge to main yourself and write
docs/hosting/phase-<N>-outcome.md. If it fails, stop and write down why.
Do not stop at a PR waiting for review. No browser verification.
```

## Keeping each session inside its window

The levers, in order of payoff:

1. **Never compact — restart.** Re-summarising a long thread costs more than a cold
   session reading a 400-line plan section. When a window ends, start fresh.
2. **Read the plan *section*, not the plan.** `phase-1-plan.md` is 1,243 lines; five
   sessions reading it whole is roughly four wasted copies. Hence the line ranges.
3. **Model per session.** 1b/1c/1d and phase 7 are mechanical wiring against a
   finished design. Opus only where judgment lives: 1a, 1e, 2, 3, 4, 6.
4. **Fan out to Sonnet subagents.** Their tool output never enters the main thread.
   Phase 5 especially — the research volume stays in the subagents.
5. **Never open `theology-map.html` (126KB) or `documentation/verses.md` (41KB).**
   Nothing in these phases requires either. Skip `phase-N-design.md` too unless the
   plan points at a specific section; the plans are self-contained.

## If a window dies mid-session

Do not resume the transcript. The next session reads `git diff main...<branch>` plus
the same plan section, and continues from what the diff shows landed. This is why
the sub-phase splits exist — a dead window costs a diff review, not a phase.
