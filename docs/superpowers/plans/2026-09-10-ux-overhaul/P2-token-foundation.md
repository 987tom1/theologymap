# P2 — Token foundation · **zero visual diff**

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply to every task here.

**Spec:** spec §6 and §7 P2. **Token values:** `documentation/design-modern-feel.md` §3.1–3.6
(read §3 whole — it is 165 lines and it is the whole input to this phase).

**Goal:** Reconcile the three-way token fork, then add every scale from §6. **Nothing consumes
them yet.** That is what makes this phase verifiable.

**Model:** **Sonnet, sequential, sole holder of `engine/theme.css`.** No parallel agents in
this phase — the whole phase is one file plus its two hand-copies. **Depends on:** nothing.
**Blocks:** P3, and through it everything except P1 and P9.

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

## Tasks

1. **Audit the three copies side by side.** Haiku, grep only. Produce a table of every token
   name × the three files × its value. Do not edit.
2. **Reconcile.** Add `--mono` and `--shadow` to `theme.css` and `editor.html`; add
   `--good`/`--bad` to `render.py`; keep `--accent` in all three (P3 gives it a job as
   `accent-color`). **Values must be identical across all three, character for character.**
3. **Add spacing** — §3.1, eight steps `--s1`…`--s8`, into all three.
4. **Add radius** — §3.2, `--r1`/`--r2`/`--r3`/`--r-pill`, into all three.
5. **Add elevation** — §3.3, `--e1`/`--e2`/`--e3` with the `color-mix(in oklab, var(--ink) …)`
   tint and the dark-mode black revert. Into all three.
6. **Add motion** — §3.4, three durations, three easings, **and the
   `@media (prefers-reduced-motion: reduce)` block that zeroes the durations to `1ms`.**
   That guard is what makes every later consuming rule safe by construction.
7. **Add type** — §3.5, seven `--fs-*` steps, four `--lh-*`, `--measure` unchanged at `58ch`,
   `--measure-wide: 68ch`. Into all three. **`vw` only appears above 15px** — fluid micro-type
   resizes into fractional pixels and looks blurry.
8. **Verify zero visual diff** — the phase's whole point. See below.

Steps 3–7 may be one commit each; each is independently revertable.

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

**`theology-map.html` must differ only inside the `:root` block.** Then:

- `documentation/study-list.md` — **byte-identical**, unchanged in `git status`.
- The embedded `<script id="data">` payload — **byte-identical** (`4d8d919e…c8bd7e`).
- The full output hash **may not move.** P2 is explicitly not a phase licensed to change the
  output; a `:root`-only addition that changes no consuming rule must leave rendering
  identical. If the hash moved, something outside `:root` changed — find it, do not license it.

Then the standing gate, then:

```bash
git diff --stat
```

**A diffstat wildly bigger than the change is a line-ending rewrite.** `.gitattributes` pins
the generated files to `eol=crlf`; if it did not hold, stop.

## Acceptance criteria

- [ ] The three `:root` copies agree **character for character** on every shared token. Prove
      it with a diff of the three extracted blocks, not by eye.
- [ ] `theology-map.html` diff is `:root`-only; `study-list.md` and the `<script id="data">`
      payload byte-identical; full hash unmoved.
- [ ] Standing gate green.
- [ ] **360px / 820px / 1440px, both themes, reduced-motion on** — every page **looks exactly
      as it did before this phase.** This is a zero-visual-diff phase; anything that moved is
      a bug, not a bonus.
- [ ] `/edit` opened from `file://`. `editor.html` carries one of the three copies.
