# Run order — one session per window

Written 2026-08-22. The question this answers: Thomas is executing phases 1–7
across many sessions, each capped by a 5-hour usage window. Which session runs
next, on which model, reading exactly what?

`decisions.md` still overrides everything. This file only sequences the work and
budgets its context; it decides nothing.

## Before session 1

- [ ] Commit any pending doc edits, so no session inherits a dirty tree.
- [ ] **`phase-3-plan.md` Task 8's "GATED. DO NOT START." is stale** — the
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
| 10 | Phase 4 Tasks 5–8 — wizard UI, seed content, merge | `phase-4-wizard` (same branch) | Opus | `phase-4-plan.md` L1–92 + L556–end |
| 11 | Phase 5 — denominational research corpus | `phase-5-corpus` | Opus main, Sonnet research subagents | `phase-5-brief.md` |
| 12 | Phase 6 Tasks 0–2 — tradition maps, compare engine | `phase-6-compare` | Opus | `phase-6-plan.md` L1–422 |
| 13 | Phase 6 Tasks 3–7 — render, learn, compare surfaces | `phase-6-compare` (same branch) | Opus | `phase-6-plan.md` L1–85 + L423–end |
| 14 | Phase 7 — redesign the generated views | `phase-7-views` | Sonnet | `phase-7-brief.md` |

**Phase 5 (session 11) may run in parallel** with 7–10 once phase 4's schema is
frozen — it produces content, not code. Everything else is sequential.

## Thomas's one action mid-chain

**After session 1 merges:** run the `is_admin` bootstrap SQL in the Supabase editor
against your own row (`readiness.md` A.4; the exact statement is in
`phase-1a-outcome.md`). One statement, doable from a phone. Session 4 (1d) needs it
and everything after inherits it.

Also still open, low cost: confirm whether `987tom1.github.io/theologymap` is a dead
GitHub Pages deploy (`readiness.md` A.3). If it is live, a session can verify against
a stale build and report a false green.

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
