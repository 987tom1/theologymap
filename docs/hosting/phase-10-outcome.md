# Phase 10 outcome — review remediation

Branch `phase-10`, branched from `a4a3ef8`, completed 2026-09-04 across two
sessions (the first ended on a 5-hour usage limit mid-fan-out; see "How the work
was run"). **Not merged — that is Thomas's call.**

Applied the actionable findings of `documentation/sixhatreview.md` (30 findings)
and `documentation/uxreview.md` (32 findings), as fourteen file-disjoint tasks.
No new dependency, no bundler, no framework; `requirements.txt` is still empty.
No schema change and no migration.

---

## The headline

Three of the sixty-two findings were the phase. The rest were worth doing and
none of them would have embarrassed anyone.

> **X3** — no route in the app rendered an unlisted map for its own owner.
> **F1** — `/compare` answered a four-way tie by naming one tradition, with full
> confidence, on the likeliest map any member of this church would have.
> **B1** — a newline typed into any field split one belief into two nodes.

All three lived in a seam, none inside a function that was wrong on its own
terms, and all three are now written up in `debug.md` §AC–§AE. F1 in particular
passed sixteen green assertions the whole time it was broken: nothing built a
small map and read the resulting sentence back.

---

## What landed, per task

| # | What | Findings | Commit |
|---|---|---|---|
| 3 | `engine/theme.css` — tier tokens given a real home, coarse-pointer tap targets, the 320px overflow, `body` margin, 58ch | X1, UX2, UX10, UX14, UX23 | `24075a9` |
| 1 | `.gitattributes`, `tests/README.md` all nine checks, two dead selectors, admin `<main>` | X6, G1, UX22, UX6 | `7478cc1` |
| 2 | Landing and gallery — signup anchor, tile copy, `maxlength`, tier tokens, "Unsettled" | UX18, UX19, UX25, A1, X1, C1 | `fc4d7f7` |
| 4 | `/compare` — `[hidden]` guard, `res.ok`, per-tradition fractions, voice | UX20, UX26, X1, F4, F5, F1 | `7d560d0` |
| 5 | `/view` and `/history` — owner button, data-payload emptiness, token refresh | UX11, G3, E1 | `e6b0aa7` |
| 6 | `session.js` storage guards, parallel corpus fetch, missing-domain error | X4, D4, F3, D5 | `8cdb5b1` |
| 7 | API routes — owner renders unlisted map, pin select, name length, admin select and restore token | X3, A2, A1, E3, E2 | `8519bc7` |
| 8 | `compare-core.js` — every tie flagged on one scale, per-row fractions, scoped group search | F1, F5, F7 | `51181bb` |
| 9 | `editor-core.js` — newlines and separators neutralised at the write | B1 | `441cbcd` |
| 10 | Build each tradition once; pin the "Undecided." sentence | F8, F6 | `b2c7768` |
| 11 | `engine/editor.html` — vocabulary, empty state, `--field-line` borders, draft clock | UX7, UX8, UX16, UX26, UX28, B3 | `3ff4065` |
| 12 | The wizard — first-run offers, answer order, tier glosses, overlap + twelve smaller items | UX1, UX3, UX4, UX5, UX12, UX13, UX17, UX21, UX24, UX26, UX29, UX30, UX31, X1, D2, D3, D6 | `62f4c3b` |
| 13 | `engine/render.py` + regenerated output — 44px controls, no Edit link when framed, centred `main` | UX9, UX15, UX27 | `3727f4c` |
| 14 | `CLAUDE.md`, `debug.md`, this file | — | this commit |

**The hashes moved, under phase 7's gate.** `documentation/theology-map.mm` and
`documentation/study-list.md` are byte-identical to their prior committed
versions, and the embedded `<script id="data">` payload hashes the same
(`4d8d919e…c8bd7e`). Only presentation moved. New `theology-map.html` values:
`3c4a33ca…c497d` as written on Windows, `1b9fade5…f1f9253` LF-normalised. They
do **not** converge — they are the same bytes with different line endings, which
is what `.gitattributes`' new `eol=crlf` pin exists to stop mattering on Linux.

---

## The carry-forward list — stated plainly

**This is the point of this file.** Nothing below was missed; each was declined,
deferred, or found still open.

### Declined by Thomas, or out of scope by the plan

| Item | Why it was not done |
|---|---|
| **F2** — a coverage floor gating `closestTradition` | Declined by Thomas. Excluding sub-floor traditions would make INC (15% coverage) unnameable as anyone's closest tradition. F1's per-tradition fraction now makes the thinness visible on screen instead. |
| **X2 / new test files** | Fixing the bugs was this round's scope. No new test files were added. Existing assertions were updated only where a task deliberately removed the field they asserted. |
| **UMD refactor** of `web/*.js` logic | Scope creep. |
| **A-edit** — an admin "edit any map" UI | Admin does not need to edit maps. |
| **E4** — 20-row version retention | Still unverified by anyone; verifying it needs 21 saves an hour apart. **Stays declared unverified** — do not record it as working. |
| **Lazy-loading the 11 non-target tradition maps** on `/compare` (475 KB) | Deferred. Recorded in `CLAUDE.md` as a growth marker: this is the next performance move if the page gets slow. |
| **Gallery and `map.py` full-markdown reads** (C2, A3) | Fixing them properly needs denormalised count columns and a migration; row counts do not justify it. Only `admin.py`'s genuinely unused select was dropped (E3). |

### F9 — checked, and still open

**The plan required an actual check rather than an assumption, so: F9 is not
closed.** `/learn` renders a "Contested" banner on **80 of 250 positions**, and
that count is unchanged today — verified by counting `"orthodoxy": "contested"`
across `content/` (80 contested, 167 historic, 3 outside). `phase-5-outcome.md`
had already warned the flag is over-applied and "should not be leaned on";
`/learn` leans on it as a visible banner.

Phase 9 did **not** close it. Phase 9 was citation verification — it never
touched `orthodoxy` at all (the word does not appear in `phase-9-outcome.md`),
and it states explicitly that it made no schema change and left all 250 positions
in place. F9 remains corpus work for a future phase: re-examine which positions
genuinely warrant `contested` rather than changing how `/learn` renders it.

### Raised by a task during this phase

- **`bytes` is gone from the admin versions response.** E3 dropped `markdown`
  from `api/admin.py`'s versions `select=`, and `bytes` was computed from it, so
  the restore button would have rendered `(NaN KB)`. Fixed inside this phase —
  the label now shows only the relative time. Noting it because the field is gone
  from the response, not merely unused.
- **`editor-core.js` now collapses runs of whitespace in a title**, which
  `render.py`'s parser does not mirror (it takes `parts[0]` verbatim). Safe
  today — no existing title has a double space, verified — but the two are the
  documented lockstep pair, so it is worth knowing.
- **`web/wizard.html` now loads `/engine/compare-core.js`** (absolute path,
  after `wizard-generate.js`), because D3 made the wizard reuse
  `CompareCore.normalise` rather than keep a second matching rule.
- **`api/admin.py`'s restore can now return `409 conflict`.** No new copy was
  needed: it surfaces through `web/admin.html`'s existing generic `apiFetch`
  error banner.

---

## Needs Thomas's phone check — three items

None of these can be settled without a browser, and this phase did no browser
verification by design. Each is a judgement about physical size on a real phone:

1. **The 38px radio targets** (Task 3, `engine/theme.css`). The UX review
   recommends 38px but says to fall back to **34px** if six radio labels wrap to
   a third row on a 360px phone. 38px shipped. If the wizard's tier or confidence
   rows wrap to three lines, drop to 34px.
2. **The `.wz-outside` overlap** (Task 12, `web/wizard.html`). `padding-right:
   88px` was added to `.wz-outside` and `.wz-outside-note` so the 44px "Read
   more" button stops covering the *Outside the historic creeds* note. The
   geometry is deterministic; the number of lines actually cleared is not. Check
   `god.trinity` — it is T1 and asked first, so it is the first question a
   stranger sees.
3. **The regenerated map's 44px controls** (Task 13, `engine/render.py`). The
   view switcher, reference pills and Filters disclosure were all below 44px and
   now carry `min-height: 44px` in the existing coarse-pointer block. Confirm
   nothing overflows its row on a narrow phone.

---

## Verification — all nine checks pass

Run on the branch tip, 2026-09-04, Python 3.11.9 / Node v24.19.0. Every command
exited 0.

```
py engine/validate_content.py      0 errors, 37 warnings
node tests/compare-core.test.js    all 16 ok
node tests/build-traditions.test.js  8 ok
node tests/wizard-generate.test.js   21 ok — all passed
node tests/refs.test.js              6 ok
py tests/check_tradition_maps.py   12 tradition maps checked, 0 problems
py tests/test_validate_content.py  OK 3 errors, 3 warnings
py api/_test_lib.py                PASS
py engine/render.py                99 nodes across 14 domains
                                   33 flagged #study, 0 inferred
                                   156 scripture references in use, 0 without text
```

`py engine/render.py` leaves the working tree clean — the three generated files
it writes are byte-identical to what is committed.

Two verifications beyond the nine, both run from plain `node` per `debug.md`
rule 14:

- **B1 is a no-op on existing data.** The serializer round trip over
  `theology-map.md` and all twelve files under `content/traditions/` — 13 files,
  **0 byte differences**, compared as raw buffers.
- **F1 is actually fixed.** On a 12-belief map against the real corpus, the four
  traditions scoring 1.000 now all come back `joint === true`; the old code
  flagged none of them and named Non-denominational alone.

**No browser verification was done.** That pass is Thomas's.

---

## How the work was run

Fourteen tasks, one subagent each, at the model the plan named. Task 3 ran first
and alone because it gates Tasks 2, 4 and 12 — it moves the tier ramp into
`theme.css`, and those three delete the hand-copied duplicates that were keeping
their pages working. The remaining tasks ran in parallel against a file-ownership
map that gives every file in the repo exactly one owning task.

The 5-hour limit landed during Task 12, exactly where the plan predicted. Because
every task commits its own work, the cost was two interrupted tasks (12 and 13),
both resumed from their uncommitted diffs rather than restarted.

Three things worth recording for the next parallel phase:

- **The plan's ownership map had one real collision.** Task 1's
  `git add --renormalize .` rewrites the three generated files that Task 13 owns
  and regenerates. Task 1 was held back until Task 13 committed, and its
  renormalize was scoped to the three paths by name. A repo-wide `git add` is not
  file-disjoint no matter how the tasks are partitioned.
- **A bare `git commit` commits the whole index, not just what an agent staged.**
  One task swept three other files into its commit and had to unwind it. Every
  agent brief after that carried an explicit instruction to `git status` and
  `git restore --staged` before committing.
- **Every commit was checked afterwards for file ownership.** All thirteen touch
  only the files their task owns.

## For the next session

The branch is `phase-10`, thirteen task commits plus this one, on top of `a4a3ef8`.
It is **not merged**. The nine checks pass. What is left is the browser pass and
the three phone-check items above; after that, merging to `main` is Thomas's call.
