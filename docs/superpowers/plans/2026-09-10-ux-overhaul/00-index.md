# Theology Map — UX and design overhaul · Implementation plan (index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement each phase file task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn four correct programs that share a stylesheet into one product — continuous
navigation, a real design system, and a map that reads as a place — in eleven independently
shippable, independently revertable phases.

**Architecture:** No rewrite. No framework, no bundler, no CDN import, no npm dependency
browser-side; Python stays standard-library only. Every mechanism is a native platform
feature (`@view-transition`, `startViewTransition`, `popover`, `::details-content`,
`@starting-style`, `color-mix()`, `@property`, `field-sizing`, anchor positioning) that
degrades to today's behaviour where unsupported. Tokens land in `engine/theme.css` and are
hand-copied into `engine/render.py` and `engine/editor.html` where they touch `:root`.

**Tech Stack:** Vanilla ES modules under `web/`, UMD modules under `engine/`, Python 3.11
stdlib (`engine/render.py`), Node 24 test runner, Vercel + Supabase.

**Spec:** `docs/superpowers/specs/2026-09-10-theology-map-ux-overhaul-design.md` — the source
of truth. Its decisions are settled: **do not re-litigate them, do not re-run the assessments,
do not propose a rewrite.** The assessment lane licensed to propose one recommended against it.

**Supporting sources** (read only the sections a phase cites — they total ~2,600 lines):
- `documentation/ux-firstprinciples-constrained.md` — F1–F12, §4 motion mechanisms
- `documentation/ux-firstprinciples-unconstrained.md`
- `documentation/design-modern-feel.md` — §3 token values, B1–B6, §5 small wins, §7 the map

---

## Phase files

| File | Phase | Model | Depends on |
|---|---|---|---|
| [P1](P1-one-file-fixes.md) | Correctness and one-file fixes | Sonnet, one batch | — **ship first** |
| [P2](P2-token-foundation.md) | Token foundation · zero visual diff | Sonnet (sequential, sole holder of `theme.css`) | — |
| [P3](P3-states-dark-mode.md) | Interaction states and dark mode | Sonnet | P2 |
| [P4](P4-motion.md) | Motion | Sonnet, spec quoted | P3 |
| [P5](P5-question-screen.md) | The question screen | Sonnet, spec quoted | P4 |
| [P6](P6-nav.md) | The nav (D6) | Sonnet, spec quoted | P3, P4 |
| [P7](P7-type-and-spacing.md) | Type and spacing | Haiku per page, Sonnet review | P6 |
| [P8](P8-compare.md) | Compare | Sonnet, spec quoted | P7 |
| [P9](P9-map-unfork.md) | **The map-view unfork · the pivot** | **Opus / main session, own session, nothing else in it** | — (own risk profile) |
| [P10](P10-map-substrate.md) | The map itself | Opus for `_applyPanZoom`; Sonnet for the CSS steps | **P9 (hard block)** |
| [P11](P11-commit-moment.md) | The commit moment, and cleanup | Sonnet / Haiku | P8, P10 |

```
P1 ─────────────────────────────────────────────► (independent, ship first)
P2 ──► P3 ──► P4 ──► P5
        │      │      │
        └──────┴──────┴──► P6 ──► P7 ──► P8
                                          │
                              P9 ─────────┴──► P10 ──► P11
```

P9 depends on nothing but its own risk profile and may be pulled forward. P10 is hard-blocked
on P9.

## Sessions

P1 is shipped. The ten remaining phases run in five sessions. The dependency graph above is
unchanged — this is only a grouping of phases into working sessions, so that phases sharing a
reconciliation, a regeneration or a hash check pay for it once.

| Session | Phases | Why grouped |
|---|---|---|
| **A** | P2 + P3 | P3's tasks 1–2 are the same three-file `:root` edit as P2. One fork reconciliation, one `render.py` regeneration, one hash check serves both. Separate commits, and P2's zero-visual-diff verification runs in full **before** any P3 task. |
| **B** | P4 → P5 + P6 | P5 and P6 are siblings off P4 and are file-disjoint. P4 lands first, then P5 and P6. |
| **C** | P7 + P8 | P8 depends on P7; consecutive and same surface family. |
| **D** | P9 alone | The unfork. Opus, own session, nothing else in it — the phase file is emphatic and correct. |
| **E** | P10 + P11 | P10 is hard-blocked on P9; P11 closes out behind it. |

Sequencing between sessions still obeys the graph: A → B → C, and D before E. D may be pulled
forward at any point.

**Depth status.** P1 is written to full step detail and is ready to execute. P2–P11 carry
their goal, files, governing invariants, gate, acceptance criteria and model assignment;
their step-by-step task bodies are expanded from the cited spec/assessment sections
immediately before that phase is executed. Expand a phase file at the start of its session,
not before.

---

## Global Constraints

**Every task in every phase file implicitly includes this section.**

### Non-negotiable project constraints (spec §3)

- **No rewrite.** No framework, no bundler, no CDN import, no npm dependency browser-side.
  Python is **standard-library only**; `requirements.txt` is empty and stays empty.
- **No anonymous start.** Accounts stay required before the question flow. Decided.
- **No person-vs-person scorecard**, no leaderboard, no score attached to a named person, no
  members-aggregate baseline. This is product ethics, not a feature gap.
- **No new auth.** The "security is deliberately minimal and that is the brief" posture stands.
- **No change to the offline tool's contract.** `start_editor.bat` keeps working from
  `file://`, offline, with no network and no database. If a change would make the local tool
  need either, it is the wrong change.
- **`py`, not `python`.** Bare `python` hits the Microsoft Store stub. Python is 3.11.9.
- **Import by absolute path** — every module path under `web/`, static or dynamic. A relative
  `./session.js` resolves to `/session.js` and 404s. `<base href>` does **not** cover a
  dynamic `import()`.

### The standing gate (spec §8) — every phase runs all of it before it is called done

```
node --test tests/*.test.js          # glob, not directory — Node 24/Windows quirk
py tests/syntax_check.py             # before ANY push touching web/ or engine/
py engine/validate_content.py
py tests/test_validate_content.py
py api/_test_lib.py
py tests/check_tradition_maps.py
py tests/check_generated_map.py
```

**Additionally, for any phase touching `engine/render.py`:**

- Regenerate with `py engine/render.py`. **Never hand-edit a generated file to make a hash
  match.**
- **Two invariants must stay byte-identical:** `documentation/study-list.md` and the embedded
  `<script id="data">` payload (`4d8d919e…c8bd7e`). That is what proves only *presentation*
  moved.
- The full-output hash may move **only** in a phase licensed to change the output on purpose.
  **Current baseline, as of P2 (2026-09-10):**

  | | CRLF (as written on Windows) | LF-normalised |
  |---|---|---|
  | **post-P2 — read against this** | `795195db…b50297` | `6c9e7a6c…c06379b` |
  | pre-P2, for reference | `f5396e31…6db99e` | `f383b636…75bcc2` |

  **Two corrections are folded into that table.** First, the value this document carried
  before (`9a702faf…9d5fda` CRLF / `43feab4f…9ea498` LF) was **already stale before P2
  touched anything** — `theology-map.html` last changed in `cb08cea` and neither this file nor
  CLAUDE.md §1 was updated; regenerating on a clean tree at `9e91ebb` produced no diff and
  hashed to the pre-P2 row above. **CLAUDE.md §1 still carries the stale pair and needs the
  same correction.** Second, P2's own verification section demanded both a `:root`-only diff
  *and* an unmoved full hash, which cannot both hold — adding tokens to `render.py`'s embedded
  `:root` changes the file's bytes and therefore its hash. **The two named byte-identity
  invariants above are the real gate**; the zero-visual-diff claim is carried by the
  `:root`-only diff plus the three-viewport walk. P2's diff was two hunks, 72 insertions, zero
  deletions, every line inside a `:root` block or a media query wrapping one.
- Read `git diff --stat` **before** committing. A diffstat wildly bigger than your change is
  a line-ending rewrite; **scripts that edit repo files read and write bytes** (`pathlib`'s
  `write_text` translates `\n` to `os.linesep` on Windows; `read_text(newline='')` needs 3.13
  and this machine is 3.11).

### The three-viewport requirement (spec §4) — a per-phase acceptance criterion, not a review step

CLAUDE.md records that the 2026-08-29 round was an explicitly phone-sized pass and **shipped
two bugs that existed only on a wide screen**. Both read as *correct* on a phone.

| Target | Width | What it exercises |
|---|---|---|
| Phone | **360px** | horizontally-scrolling nav, Filters disclosure, stacked field labels (<560px), coarse-pointer tap targets |
| iPad portrait | **820px** | **below `MAP_TWO_SIDE_BREAK = 860`** — the map's *single-sided left-to-right fallback*, phone rules off, 640px rules off. The width historically checked by nobody. |
| Desktop | **1440px** | `main.wide` in Map view, the 1080px reading measure on card views, `/view`'s iframe stretch |

Plus, on every phase:
- **Both themes.** Light (cream) and dark.
- **`prefers-reduced-motion: reduce` on.** The product must be completely still.
- **Coarse-pointer targets ≥ 44px.**
- iOS Safari specifics stay respected: no `requestFullscreen()` on a non-video element; a
  `position: fixed` iframe does not re-resolve its document's `100vh`; `<base href>` does not
  cover a dynamic `import()`.

### Model selection (spec §10)

| Work | Model |
|---|---|
| Token snapping page by page, grep audits, gate runs | **Haiku**, one subagent per page, parallel |
| Per-page CSS against a written spec, P1's six fixes, P4/P5/P6/P8 | **Sonnet**, file-disjoint parallel batches |
| **P9 the unfork**, P10's `_applyPanZoom`, anything lockstep-bearing, anything reversing a documented decision | **Opus / main session** |

**Batch by file-disjointness.** **Two agents must never hold `engine/theme.css` at once** —
the token phases are sequential for that reason even though their per-page work is not.

**Every subagent prompt carries:** the relevant spec section verbatim, the invariants its
files are governed by, the standing gate, and the three-viewport requirement. **A subagent
that has not been told an invariant will violate it** — every documented "do not undo this"
in CLAUDE.md exists because somebody already did.

### Invariants that govern more than one phase

Quote the ones a task's files are governed by *into that task*. The full set is CLAUDE.md §7.

- **The token `:root` block is forked three ways** — `engine/theme.css:9-20`,
  `engine/render.py:278-297`, `engine/editor.html:18-27` — and is **currently out of step**
  (`--good`/`--bad` missing from `render.py`; `--mono`/`--shadow` from the other two;
  `--accent` dead in two of three). Both generated and `file://` files must be
  self-contained, so this fork is **permanent**. Change one, change all three.
  **Nothing checks that they agree.**
- **`--t1`…`--t4` live in `engine/theme.css`.** Four hand-copied duplicates in `web/` were
  deleted. **Do not reintroduce a tier hex literal in a `web/` file** — read the token.
  `render.py` keeps its copy for the self-containment reason above; that one is legitimate.
- **The nav list in `web/chrome.js` and `engine/editor.html:541-547` is a permanent
  hand-kept lockstep** — the documented `file://` exception. **Any nav change is two edits.**
- **`el` and `slugify` are exported from `web/chrome.js`; `escapeHtml` from
  `engine/editor-core.js`.** Another copy of any of them is a bug in waiting.
- **`--line` and `--field-line` are not interchangeable.** `--field-line` is for interactive
  control boundaries *only* (WCAG 2.1 SC 1.4.11 needs 3:1). `--line` stays the decorative
  divider.
- **Any pane hidden by the `hidden` attribute needs its own `[hidden]` override if it also
  carries an author `display` rule on the same selector.** `web/wizard.html` carries one
  global `[hidden] { display: none !important }` as the root-cause fix.
- **Tier and confidence stay real `<input type="radio">` on both surfaces.** Do not hand-roll
  `role="radiogroup"`.
- **`.sel`'s tint and border are the only selection signal.** The tick is gone deliberately.
- **`/learn`'s position cards let their `gap` own all vertical spacing** —
  `.lp-pos > *, .lp-mine > * { margin: 0 }`, scoped with `>` on purpose, declared *after*
  `.lp-prose`/`.lp-hint`/`.lp-refs` to win on order. **Add a row to these cards without a
  margin of its own.**
- **`.tm-main` in `web/view.html` keeps `width: 100%; box-sizing: border-box`.** Without it
  the iframe collapses to its 300px intrinsic width, which reads correct on a phone.
- **Do not reintroduce traffic-light tier colours.** The earlier amber values failed contrast.
- **`#home-empty` is deleted.** Do not re-add a second empty-state home.

### The seam rule (spec §5, D1) — the one sentence every visual proposal is tested against

> **The canvas substrate is dimensional. Anything that contains the person's words is not.**

The map's *ground* recedes. The *tiles* on it stay paper: flat, warm, `--e1`, serif content,
no glass, no glow, no gradient. Edges, the grid and the ground are canvas furniture and may
be dimensional. A node is a document and may not. **If a proposed effect puts depth, glow or
gradient behind somebody's stated belief, it is out.**

### The motion vocabulary (spec §7, P4) — four verbs and nothing else

- **Tint** — state under the finger. Colour, border, shadow, ≤.5% scale. `--dur-1`.
- **Settle** — something that did not exist arrives. Opacity + ≤8px translate *toward* its
  final position. `--dur-2`.
- **Travel** — something that exists moves. Transform only. `--dur-3`.
- **Hold** — something that must not move. A named view-transition group.

**Hold is the most important verb and the easiest to forget.** What makes a transition read
as expensive is not what moves; it is what conspicuously does not.

**Written rules for when nothing moves:** prose never animates; no scroll-triggered anything;
data never animates its value; nothing loops except the skeleton, and only while
`aria-busy="true"`; one thing at a time; movement beats colour; keystrokes never animate;
**no motion on first paint** — a staggered entrance on page load is the generated-UI signature.

### The map-view lockstep gate — armed until P9 lands

Only `_leafHeaderEditable`, `_leafMetaEditable` and `_leafDetail` may be touched in
`engine/map-view.js`. `_leafHeaderReadonly`, `_leafMetaReadonly`, `_mboxHTML`, `redraw`,
`assignX`, `assignY`, `edges`, `_bindPanZoom` and `MAP_TWO_SIDE_BREAK = 860` are
lockstep-bearing and must not change. The merge gate is:

```
git diff -U0 main -- engine/map-view.js | grep '^@@'
```

showing hunks in those three functions and nowhere else. **Every phase before P9 is bound by
this.**

---

## Success criteria (spec §11)

- "My map" is **one tap** from every screen including mid-question.
- No screen change in the wizard is a page load or a scroll jump.
- `/learn`'s "Answer this question" reaches a question, not an empty editor canvas.
- Every interactive element has a visible focus state; the belief textarea especially.
- Every coarse-pointer target is ≥44px, tier and confidence included.
- One type scale, one spacing scale, one radius system, one motion vocabulary, one token
  block reconciled across three files.
- `prefers-reduced-motion: reduce` produces a completely still product.
- The map's grid moves and scales with the pan/zoom, and the ground reads as recessed while
  every tile still reads as paper.
- Verified at 360px, 820px and 1440px, in both themes, on a real phone and a real iPad — not
  only in a resized desktop window.
