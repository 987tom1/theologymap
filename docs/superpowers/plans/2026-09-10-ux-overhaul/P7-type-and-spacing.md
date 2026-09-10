# P7 — Type and spacing

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply to every task here.

**Spec:** spec §6 and §7 P7, decision D4. **Detail:** `documentation/design-modern-feel.md`
B1 (`:489-538`), §3.1, §3.2, §3.5, §5 small wins 1, 2, 7, 8, 10, 15, 16.

**Goal:** Land P2's scales. Large diff, **no behaviour change**. This is most of what makes
the pages read as one product — the one thing a glass repaint would not have fixed.

**Model:** **Haiku, one subagent per page, in parallel** — mechanical substitution against a
fixed table, and the gate catches errors. **Sonnet reviews each page's diff.**
**Depends on:** P6. **Blocks:** P8.

---

## The batching rule that makes the parallelism safe

**Two agents must never hold `engine/theme.css` at once.** The per-page work is parallel; the
`theme.css` work is not. Run it in two stages:

**Stage 1, sequential, one agent:** `engine/theme.css`'s own rules, plus the `:root` hand-copy
into `render.py:278-297` and `editor.html:18-27` if any `:root` value changes.
**Stage 2, parallel, one Haiku per page, `theme.css` closed:** `web/landing.html`,
`web/wizard.html`, `web/learn.html`, `web/compare.html`, `web/gallery.html`,
`web/view.html`, `web/history.html`, `web/admin.html`. **Each page is one commit and is
independently revertable.**

`engine/render.py`'s embedded stylesheet is a **ninth unit** and it is the one with a
byte-identity gate. Run it last, alone.

## The substitution tables — the whole input to a Haiku prompt

- **Spacing (§3.1):** thirteen ad-hoc values — 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 18, 20, 22,
  26px — snap to eight steps `--s1`…`--s8`. **Rule: gaps come from this scale or they are a
  bug.**
- **Type (§3.5):** twenty-two sizes snap to seven `--fs-*` steps plus four `--lh-*`. **`vw`
  only above 15px.** `--measure: 58ch` unchanged. `--fs-4` at 26→36px replaces
  `wizard.html:57`'s hard 32px. **Add `letter-spacing: -.012em` on the large serif steps** —
  display-size serif needs negative tracking and today only two rules do it.
- **Radius (§3.2):** eight radii resolve to four. **A thing you press is `--r2`; a thing that
  holds other things is `--r3`; a thing that is a value is `--r1`; a thing that is a state is
  a pill.** The visible changes: `.tchip` and `.lp-tier` stay pills (statuses),
  `.lp-refchip` and `.chip` go to `--r1` (data), `render.py:417`'s 20px `dd.rel a` joins
  `--r2`, `.tm-card` moves 9px → 12px.

**A value that does not fit the scale is a finding, not a licence to add a ninth step.**
Report it; do not invent a token.

## D4 — the label-register reduction (small win 7)

**One uppercase register with a stated job; everything else sentence case.** Keep `.kicker` at
`--fs-000`, `.16em`, uppercase. **Drop `text-transform: uppercase` and the tracking** from
`.lab` (`wizard.html:169`), `.wz-outside` (`:153`), `.lp-pos-label` (`learn.html:84`),
`.lp-tiernote .lab` (`:54`) — make them `600 var(--fs-000)/var(--lh-ui) var(--sans)` in
`--muted`, sentence case.

**P1 Task 5 moved four of these into `theme.css` with `text-transform: uppercase` deliberately
retained.** This is the phase that removes it. Six variants of one idea is the single loudest
"generated" tell in the sheet.

**This is a voice change and it is the right one** — the product already bans "node" and
"domain" from user-facing copy.

## Fold in these small wins — they are the same edit, on the same lines

1. **`text-wrap: balance`** on every `h1`, `h2`, `h3`, `.tm-card h3`; **`pretty`** on `p`,
   `dd`, `.tm-prose`, `.lp-prose`, `.wz-framing`.
2. **`font-variant-numeric: tabular-nums`** on `.wz-stat .num`, `.wz-area .pg`, `#wz-crumb`,
   `.tm-stat`, `.cmp-table`, and `relTime` output. Counts and timestamps currently shift width
   as they change.
10. **One `.tm-note` geometry.** `theme.css:58` uses `0 6px 6px 0`; `learn.html:52`'s
    `.lp-tiernote` uses `0 4px 4px 0` for the same object. Pick `0 var(--r2) var(--r2) 0` and
    delete the local rule.
15. **Optical alignment of the tier chips.** `.lp-tier` and `.tchip` use symmetric `5px 8px`
    padding; pills need asymmetric horizontal padding to look centred — `5px 9px 5px 8px`.
16. **Baseline-align the card header row.** Give `.tm-card` `gap: var(--s2)` and let `.tm-go`
    keep `margin-top: auto`.

Also finish P1 Task 5's deferral: **rename the ~60 `.wz-quiet` / `.wz-hint` / `.wz-framing` /
`.lab` / `.lp-hint` / `.lp-pos-label` call sites to `.tm-*`** and drop the alias selectors from
`theme.css`. That was explicitly held for this phase.

## Invariants to quote — per page, only the ones that page is governed by

> **`/learn`'s position cards let their `gap` own all vertical spacing.**
> `.lp-pos > *, .lp-mine > * { margin: 0 }` … scoped with `>` on purpose and must stay
> declared *after* `.lp-prose`/`.lp-hint`/`.lp-refs` to win on order. **Add a row to these
> cards without a margin of its own.** → the `learn.html` agent.

> **`.tm-main` in `web/view.html` carries `width: 100%; box-sizing: border-box` and must keep
> it.** … without an explicit width the iframe collapses to its 300px intrinsic width, **which
> reads correct on a phone.** → the `view.html` agent.

> **The Map view sets `main.wide`** (`max-width: none`); the card views keep the 1080px
> reading measure. → the `render.py` unit.

> **A framed map trims its own header** … hiding the kicker, subtitle and tier legend and
> visually-hiding the `h1`. → the `render.py` unit.

> **`--line` and `--field-line` are not interchangeable.** → every agent.

> **Do not reintroduce traffic-light tier colours.** → every agent touching a chip.

> **Do not reintroduce a tier hex literal in a `web/` file** — read the token. → every agent.

> **`render.py`'s embedded `:root` and `engine/theme.css` declare the same tokens with the
> same values, by hand.** … **Nothing checks that they agree.** → the Stage 1 agent.

## Gate additions

- The `render.py` unit **is licensed to move the output hash** — `.tm-card` 9px → 12px moves
  `render.py:364` (`.node`) and `:446` (`.mbox`), and that is a presentation-only change
  licensed by the phase-7 precedent. **The gate is the two survivors:** `study-list.md` and
  the embedded `<script id="data">` payload **byte-identical**. Regenerate; never hand-edit.
- **Read `git diff --stat` before committing.** This phase produces the largest diffs in the
  program, which is exactly when a line-ending rewrite hides.

## Acceptance criteria

- [ ] **One type scale, one spacing scale, one radius system.** Grep-provable: a Haiku audit
      pass finds no font size outside the seven steps, no gap or padding outside the eight,
      no radius outside the four, across `web/` and `engine/theme.css`.
- [ ] **One uppercase register.** `grep -rn "text-transform: *uppercase" web/ engine/` returns
      `.kicker` and nothing else.
- [ ] No behaviour changed anywhere. This is a presentation phase.
- [ ] **The pages read as one product.** Look at `/`, `/wizard`, `/learn`, `/compare` and
      `/gallery` side by side at the same width and check that a heading at one level is the
      same size on all five.
- [ ] `study-list.md` and the `<script id="data">` payload byte-identical; hash movement
      declared in the commit message.
- [ ] **360px / 820px / 1440px, both themes, reduced-motion on, every page.** Fluid `clamp()`
      type means **820px is a genuinely different rendering**, not an interpolation you can
      infer from the other two. Open it.
- [ ] `/edit` opened from `file://` — `theme.css` is its stylesheet.
- [ ] `git diff -U0 main -- engine/map-view.js | grep '^@@'` returns nothing.
