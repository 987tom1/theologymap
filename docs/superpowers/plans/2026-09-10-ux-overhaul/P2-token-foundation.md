# P2 — Token foundation · **zero visual diff**

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply to every task here.

**Spec:** spec §6 and §7 P2. **Token values:** `documentation/design-modern-feel.md` §3.1–3.6
(read §3 whole — it is 165 lines and it is the whole input to this phase).

**Goal:** Reconcile the three-way token fork, then add every scale from §6. **Nothing consumes
them yet.** That is what makes this phase verifiable.

**Model:** **Sonnet, sequential, sole holder of `engine/theme.css`.** No parallel agents in
this phase — the whole phase is one file plus its two hand-copies. **Depends on:** nothing.
**Blocks:** P3, and through it everything except P1 and P9.

**Session:** A, with P3. P3's Tasks 1–2 are the same three-file `:root` edit; one fork
reconciliation, one `render.py` regeneration and one hash check serve both. **P2's Task 8
verification runs in full before any P3 task starts.**

---

## The governing invariant — quote this into every task

> **`render.py`'s embedded `:root` and `engine/theme.css` declare the same tokens with the
> same values, by hand.** The generated map must stay one self-contained double-clickable
> file, so it cannot link the stylesheet. **Nothing checks that they agree.**

The fork is **three-way**, not two, and CLAUDE.md said two — `engine/theme.css:9-20`,
`engine/render.py:278-297`, `engine/editor.html:18-27`. **It has already drifted:**
`--good`/`--bad` missing from `render.py`; `--mono`/`--shadow` missing from the other two;
`--accent` dead in two of three. **Reconcile before adding anything.** Adding eight spacing
steps to a block that is already out of step multiplies the drift by three.

---

## Where the tokens go — settled for every task below

| File | Selector for new tokens | Insertion point |
|---|---|---|
| `engine/theme.css` | **`:where(:root)`** (specificity 0) | immediately **after** the tier-ramp `:root` block (`--t1`…`--t4`), before the `/* Interactive control boundaries … */` comment |
| `engine/render.py` | plain `:root`, inside the embedded `<style>` | after the dark-mode `:root` block, **before** `* { box-sizing: border-box; }` |
| `engine/editor.html` | plain `:root`, inside the inline `<style>` | after the dark-mode `:root` block, **before** `* { box-sizing: border-box; }` |

**Why `:where(:root)` in `theme.css`.** `engine/editor.html` links `theme.css` *after* its own
inline `<style>` (`editor.html:15` opens the style, `:215` is the `<link>`). A plain `:root`
in `theme.css` would therefore override the editor's inline block and reverse the ownership
the file's own header comment declares. `:where(:root)` is specificity 0, so the editor's
inline copy stays the owner there — exactly the pattern the existing base tokens use. Every
media-query override in `theme.css` (dark, reduced-motion) uses `:where(:root)` too and wins
on source order; in `editor.html` and `render.py` the overrides are plain `:root` and win the
same way.

**"Character for character"** binds token **names and values**. Whitespace and line-wrapping
follow each file's existing local style (`theme.css` and `editor.html` write `--good: #3d6b3d;`
in the light block and `--good:#7fbf7f;` in the dark one — keep that).

**Line numbers quoted in this file are pre-P1 and have drifted.** Locate every target by
selector or token name, never by line number.

---

## Tasks

### Task 1 — Audit the three copies · **DONE by the controller before dispatch**

Grep-only, no edits. Result recorded in the ledger at
`.superpowers/sdd/P2-token-foundation/progress.md`. Findings:

| Token | `theme.css` | `render.py` | `editor.html` | Consumed by |
|---|---|---|---|---|
| `--bg --panel --ink --muted --line --chip` | ✅ | ✅ | ✅ | everywhere |
| `--accent` | ✅ | ✅ | ✅ | **only** `render.py` (`label.tog input`) |
| `--good` / `--bad` | ✅ | ❌ **missing** | ✅ | `editor.html` ×6 |
| `--mono` | ❌ **missing** | ✅ | ❌ **missing** | `render.py` (`.refchip`) |
| `--shadow` | ❌ **missing** | ✅ | ❌ **missing** | `render.py` ×5 |
| `--field-line` / `--note` | ✅ | ✅ | ❌ (inherits from `theme.css`) | many |
| `--serif` / `--sans` | ✅ | ✅ | ✅ | everywhere |
| `--t1`…`--t4` | ✅ | ✅ (own copy) | ❌ (inherits) | many |

Confirms the plan's statement exactly. No surprises to rule on.

### Task 2 — Reconcile the fork · one commit

**Nothing in this task changes a value.** It adds missing declarations only.

- [ ] `engine/theme.css` — into the `:where(:root)` light block, after `--sans`:
      ```css
      --mono: ui-monospace, "Cascadia Mono", "Consolas", monospace;
      --shadow: 0 1px 2px rgba(30,24,12,.05), 0 6px 16px -10px rgba(30,24,12,.20);
      ```
- [ ] `engine/theme.css` — into the dark `:where(:root)` block, after `--bad:#d98a99;`:
      ```css
      --shadow: 0 1px 2px rgba(0,0,0,.35), 0 8px 20px -12px rgba(0,0,0,.55);
      ```
- [ ] `engine/editor.html` — the same two additions into its inline light `:root`, and the
      same dark `--shadow` into its dark `:root`.
- [ ] `engine/render.py` — into the embedded light `:root`, after `--chip: #ede6d6;`:
      ```css
      --good: #3d6b3d; --bad: #7c2d3b;
      ```
      and into the embedded dark `:root`:
      ```css
      --good:#7fbf7f; --bad:#d98a99;
      ```
- [ ] `--accent` stays in all three. It is dead in two of them today; **P3 Task 2 gives it a
      job.** Do not delete it.
- [ ] `py engine/render.py`, then the standing gate. Commit.

**`--mono` and `--shadow` are unconsumed in `theme.css` and `editor.html` after this task, and
that is correct.** Reconciliation makes the three copies agree; §3.3's elevation scale replaces
`--shadow`'s *uses* in a later phase, not here.

### Tasks 3–7 — the five scales · one commit each

Each task appends **one** block at the insertion point above, in **all three** files, and
regenerates. Values are `documentation/design-modern-feel.md` §3.1–§3.5 verbatim — transcribe,
do not re-derive.

#### Task 3 — Spacing (§3.1)

```css
/* Spacing — 4px base, eight steps. Gaps come from this scale or they are a bug. */
  --s1: .25rem;   /*  4px — inside a chip */
  --s2: .5rem;    /*  8px — between a label and its value */
  --s3: .75rem;   /* 12px — between rows in a card */
  --s4: 1rem;     /* 16px — card padding, gap in a grid */
  --s5: 1.5rem;   /* 24px — between blocks */
  --s6: 2rem;     /* 32px — between sections */
  --s7: 3rem;     /* 48px — page top/bottom */
  --s8: 4.5rem;   /* 72px — the one big silence, above a screen title */
```

#### Task 4 — Radius (§3.2)

```css
/* Radius — press it: --r2. Holds other things: --r3. Is a value: --r1.
   Is a state: --r-pill. */
  --r1: 4px;
  --r2: 8px;
  --r3: 12px;
  --r-pill: 999px;
```

#### Task 5 — Elevation (§3.3)

Light, on the base selector:

```css
/* Elevation — tinted off --ink so a cream-theme shadow is warm brown-grey
   (paper under paper), never the stock neutral SaaS-card grey. */
  --e1: 0 1px 2px -1px color-mix(in oklab, var(--ink) 20%, transparent);
  --e2: 0 2px 4px -2px color-mix(in oklab, var(--ink) 16%, transparent),
        0 8px 16px -12px color-mix(in oklab, var(--ink) 28%, transparent);
  --e3: 0 4px 8px -4px color-mix(in oklab, var(--ink) 18%, transparent),
        0 24px 40px -24px color-mix(in oklab, var(--ink) 40%, transparent);
```

Dark reverts to black — `--ink` is *light* there and mixing it would produce a glow. Add a
**new** `@media (prefers-color-scheme: dark)` block directly after the light one; do not merge
it into the existing dark block, keeping it beside its own light values is what makes the
pairing readable:

```css
@media (prefers-color-scheme: dark) {
  <selector> {
    --e1: 0 1px 2px -1px rgb(0 0 0 / .5);
    --e2: 0 2px 4px -2px rgb(0 0 0 / .45), 0 8px 20px -12px rgb(0 0 0 / .6);
    --e3: 0 4px 8px -4px rgb(0 0 0 / .5),  0 24px 44px -24px rgb(0 0 0 / .7);
  }
}
```

#### Task 6 — Motion (§3.4)

```css
/* Motion — three durations, three easings. --ease-out's control points are
   deliberately aggressive: a hard decelerate reads as immediate and physical,
   a gentle ease reads as floaty. */
  --dur-1: 120ms;   /* state under the finger: hover, selection tint, press */
  --dur-2: 200ms;   /* something appears or leaves */
  --dur-3: 320ms;   /* something that exists moves somewhere else */

  --ease-out:   cubic-bezier(.2, 0, 0, 1);    /* arriving — decelerate hard */
  --ease-in:    cubic-bezier(.4, 0, 1, 1);    /* leaving */
  --ease-move:  cubic-bezier(.4, 0, .2, 1);   /* moving between two on-screen places */
```

**And, in all three files, the guard that makes every later consuming rule safe by
construction:**

```css
@media (prefers-reduced-motion: reduce) {
  <selector> { --dur-1: 1ms; --dur-2: 1ms; --dur-3: 1ms; }
}
```

This block is not optional and is not deferrable to P4. Zeroing the tokens is a stronger
guarantee than remembering a media query per consuming rule.

#### Task 7 — Type (§3.5)

```css
/* Type — seven steps against today's twenty-two. vw appears only above 15px:
   fluid micro-type resizes into fractional pixels and looks blurry, so the
   label and meta steps stay fixed. */
  --fs-000: .6875rem;  /* 11px   — the ONE uppercase label register */
  --fs-00:  .78125rem; /* 12.5px — meta, counts, timestamps (sans) */
  --fs-0:   .875rem;   /* 14px   — secondary prose, hints */
  --fs-1: clamp(.9375rem, .89rem + .22vw, 1rem);      /* 15 → 16 body */
  --fs-2: clamp(1.0625rem, .99rem + .35vw, 1.1875rem);/* 17 → 19 card heading */
  --fs-3: clamp(1.25rem, 1.10rem + .70vw, 1.5rem);    /* 20 → 24 section heading */
  --fs-4: clamp(1.625rem, 1.32rem + 1.5vw, 2.25rem);  /* 26 → 36 screen title */

  --lh-tight: 1.2;   /* --fs-3 and up */
  --lh-snug:  1.35;  /* headings at --fs-2, chips, controls */
  --lh-body:  1.6;   /* serif prose */
  --lh-ui:    1.45;  /* sans UI text */

  --measure: 58ch;       /* the documented prose cap — unchanged */
  --measure-wide: 68ch;  /* lead paragraphs and notes only */
```

`--measure` is **new as a token**; it does not exist in any of the three files today. Adding it
consumes nothing — the existing `max-width: 58ch` rules are not rewritten to read it. That is P7.

### Task 8 — Verify zero visual diff · controller-run, no dispatch

See "The verification that defines this phase" below.

---

## What P2 does NOT do

- **Nothing consumes a new token.** No existing rule is rewritten to read `--s4` instead of
  `16px`. That is P7.
- **`color-scheme` and `accent-color` are P3**, not here — they are §3.6 and they *do* change
  appearance.
- No values change on an existing token. Reconciliation adds missing declarations; it does not
  retune present ones.

## The verification that defines this phase

```bash
py engine/render.py
git diff -- theology-map.html
```

**`theology-map.html` must differ only inside the `:root` block** — the light block, its dark
override, and the two new media-query blocks P2 adds beside them. Not one byte anywhere else.
Then:

- `documentation/study-list.md` — **byte-identical**, unchanged in `git status`
  (`sha256 f4a30fe1…f3df7`).
- The embedded `<script id="data">` payload — **byte-identical**. The hash is over the
  **inner text between the tags**, not including them: `4d8d919e…c8bd7e`.

### The full-output hash — ruling, 2026-09-10

**P2's original verification section contradicted itself.** It required both that
`theology-map.html` differ inside `:root` *and* that the full-output hash not move. Both cannot
hold: adding tokens to `render.py`'s embedded `:root` changes the file's bytes and therefore its
hash. The hash is not a proxy for "nothing rendered differently"; it is a proxy for "nothing
changed at all", which is not what this phase is.

**Ruling: the two named invariants are the real gate.** `study-list.md` byte-identical and the
`<script id="data">` payload byte-identical — those are what prove only *presentation* moved.
The full-output hash **moves in P2** and the new value is recorded as the baseline for later
phases. The zero-visual-diff claim is carried by the `:root`-only diff plus the three-viewport
browser walk, which is where it always actually lived.

**A second finding, same preflight:** the full-output hash recorded in `00-index.md` and
`CLAUDE.md` (`9a702faf…9d5fda` CRLF) was **already stale before P2 touched anything** —
`theology-map.html` last changed in `cb08cea` and neither document was updated. The true
pre-P2 baseline is:

| | CRLF (as written on Windows) | LF-normalised |
|---|---|---|
| pre-P2 `theology-map.html` | `f5396e31…6db99e` | `f383b636…75bcc2` |

Both the pre-P2 correction and the post-P2 value are written into `00-index.md` at the end of
this phase.

Then the standing gate, then:

```bash
git diff --stat
```

**A diffstat wildly bigger than the change is a line-ending rewrite.** `.gitattributes` pins
the generated files to `eol=crlf`; if it did not hold, stop.

## Acceptance criteria

- [ ] The three `:root` copies agree **character for character** on every shared token name
      and value. Prove it with a diff of the three extracted blocks, not by eye.
- [ ] `theology-map.html` diff is `:root`-only; `study-list.md` and the `<script id="data">`
      payload byte-identical; the new full-output hash recorded in `00-index.md`.
- [ ] Standing gate green.
- [ ] **360px / 820px / 1440px, both themes, reduced-motion on** — every page **looks exactly
      as it did before this phase.** This is a zero-visual-diff phase; anything that moved is
      a bug, not a bonus.
- [ ] `/edit` opened from `file://`. `editor.html` carries one of the three copies.
- [ ] `git diff -U0 main -- engine/map-view.js | grep '^@@'` returns nothing.
