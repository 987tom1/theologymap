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

---

# Step detail — expanded 2026-09-11, session C

> Everything above this line is the phase as written in the planning round. Everything
> below is the executable expansion. Where the two disagree on a **line number**, the
> expansion wins — the planning round's references were taken before P4/P5/P6 moved them.
> Where they disagree on **intent**, the planning round wins.

## Scope ruling — what "snap to the scale" reaches, and what it must not touch

**Snap:** `gap`, `padding`, `margin`, `border-radius`, and the `font-size`/`line-height`
inside a `font:` shorthand.

**Never snap — these are not spacing, they are load-bearing measurements:**

- **Breakpoints.** `480`, `560`, `640`, `860`, `900`, `1080`, `1200px` and
  `MAP_TWO_SIDE_BREAK = 860`. A breakpoint is a device fact.
- **`width` / `min-width` / `max-width` / `height` / `min-height` / `flex-basis` /
  `grid-template-columns` track sizes.** `.tm-more`'s `min-width: 180px`, `.who`'s `150px`
  label column, `.lp-who`'s `170px`, `.cmp-table`'s `min-width: 560px`, `.tm-grid`'s
  `minmax(min(300px, 100%), 1fr)`, the `.mbox-*` clamps, `.tm-tierbar`'s `height: 6px`,
  `#home-tierbar`'s `height: 12px`, `.wz-check input`'s `16px` box, `.meter .track`'s
  `46px × 5px`, `.sw`'s `10px`.
- **Border widths, outline widths and outline offsets.** The `3px` left rule on `.tm-note` /
  `.lp-tiernote` / `.mbox-domain` / `.node` is a rule, not a gap. The focus ring's `2px` and
  `outline-offset: 2px` are the product's one focus ring and are settled.
- **`letter-spacing`**, `z-index`, `scroll-margin-top`, `background-size`, `stroke-width`,
  `max-height: 52vh`, `calc(100vh - 130px)`.
- **The 44px coarse-pointer floor itself.** 44 is a WCAG figure, not a spacing step.

**A value bound by a comment to another value moves with its partner or not at all.**
**Check for a binding comment before every substitution; if one exists and this expansion
has not listed it, stop and report it.**

| Value | Bound to | Ruling |
|---|---|---|
| `.wz-nav`'s `margin: 2px -18px -36px` (`wizard.html:274`) | `.wz-screen-body`'s `padding: 22px 18px 36px` (`:55`) | **Neither moves in P7.** They must be equal and opposite for the sticky bar's bleed. Moving both is a real change with a real risk and no acceptance criterion; it is a finding routed to P11, not a substitution. The `2px` top margin stays `2px` so the shorthand still reads as a pair. |
| `.wz-card-h` / `.wz-chips` / `.wz-outside` / `.wz-outside-note`'s `padding-right: 88px` | `.wz-tools`'s `top: 8px; right: 10px` plus `.wz-more`'s rendered box | **Frozen.** Small win 22 already names this as the hand-tuned constant that should be a mechanism, and defers it. All four 88s and `.wz-tools`'s offsets stay exactly as they are. |
| `.wz-pop`'s `top: 42px; left: 10px; right: 10px` | `.wz-tools`'s `top: 8px` + `.wz-more`'s rendered height | **Frozen**, same reason. **Therefore `.wz-more` is frozen too** — font, padding and radius. |
| `#mapwrap`'s `calc(100vh - 130px)` (`render.py`) | `sizeMap()`'s measured header height | Frozen. CLAUDE.md §7 records the CSS constant as the no-JS fallback. |
| `.node`'s `scroll-margin-top: 96px` (`render.py`) | the sticky header's real height | Frozen. |

## Cascade ruling — the twice-burned lesson, stated as a procedure

Every `web/*.html` page links `engine/theme.css` **before** its own `<style>`;
`engine/editor.html` links it **after**. A `@media` query adds **nothing** to specificity.

**Before changing any declaration that also exists in `theme.css`, and before adding any
declaration to `theme.css` that a page also declares, the agent must write out:**

1. every rule in the repo whose selector matches the same element for that property,
2. each one's specificity as `(a,b,c)`,
3. which file it is in, and where in source order,
4. **the single declaration that wins**, named explicitly.

**A report that does not contain this derivation for every shared-rule change is rejected.**
A comment whose arithmetic describes a rule that does not win is worse than no comment: two
review rounds passed exactly that in session B.

### The two coarse-pointer traps, ruled on up front

`engine/theme.css:203-212`'s `@media (pointer: coarse)` block contains
`.tm-chrome .toplinks a { padding: 16px 0 }`. It survives **only** because the base
`.tm-chrome .toplinks a` rule at `:222` — declared *later*, at the same (0,2,1) — sets no
padding at all. The 16px is not decorative: with `.toplinks`'s current `font: 600 12px/1`
the box is exactly `16 + 12 + 16 = 44.0px`. **There is no margin at all.**

**Ruling A.** Task 1 **moves** `.tm-chrome .toplinks a { padding: 16px 0 }` out of the `:203`
block into the late coarse block at `:297` — the one C4 already created below the base rules,
next to `.tm-more a` — so it wins on source order the way C4's comment describes and cannot be
defeated by a future base-rule edit. It is a move, not a re-tokenise: the `16px` stays a
literal, because its job is to reach 44 and `var(--s4)` only coincidentally equals 16.

**Ruling B.** Task 1 sets `.tm-chrome .toplinks` to `600 var(--fs-00)/var(--lh-ui) var(--sans)`
— a 12.5 × 1.45 = **18.13px** line box, so the coarse total becomes
`16 + 18.13 + 16 = 50.1px`. That is a real improvement on today's exact-44.0, and it is why
the step is chosen deliberately rather than mechanically. **Task 1 must state this arithmetic
in its report.** Any font step whose line box is under 12px is forbidden on `.toplinks`.

**Ruling C.** Task 1 must **not** add `padding` — or any shorthand containing padding — to
`.tm-chrome .toplinks a` at `:222`. Doing so re-creates the inert-44px bug for the third time.

**Ruling D.** `.tm-more a`'s coarse override at `theme.css:297` is `padding: 16px 0`, which
clears 44px vertically but **zeroes the base rule's `var(--s4)` horizontal inset**, so on a
touch device the overflow menu's labels sit flush against the popover edge. Task 1 changes it
to `padding: 16px var(--s4)`. Confirmed by P6's review and deliberately held for this phase.
`.tm-more a`'s base font becomes `600 var(--fs-00)/var(--lh-snug)` = 12.5 × 1.35 = 16.88px,
so the coarse total is `16 + 16.88 + 16 = 48.9px`. State it.

**Ruling E.** **Do not add a bare `button {}` rule to `web/wizard.html`.** `#q-back` is a
`.wz-link` with `padding: 0 0 2px`; its 44px coarse floor comes entirely from
`theme.css:204`'s element-selector `button { min-height: 44px }`, unopposed in that file only
because `wizard.html` declares no `button` rule of its own. The comment at `wizard.html:262-271`
says so. This binds every page task, not only wizard.

## Motion ruling

P7 is **no behaviour change** and therefore **adds no motion, no transition, no animation and
no `@media (prefers-reduced-motion)` block of its own.** `--dur-1/2/3` are zeroed under the
query in all three `:root` copies and `engine/theme.css`'s blanket `!important` backstop is
the **last rule in the file**; `engine/render.py`'s hand-copied second copy is the **last rule
in its embedded stylesheet**. **Anything either task appends goes above the backstop.** Both
tasks verify the backstop is still last, by line number, in their report.

## Lockstep gate

`engine/map-view.js` is frozen. The index's `git diff -U0 main -- engine/map-view.js` is
vacuous when executing on `main`. **The gate for this session is:**

```
git diff --stat bc9014b..HEAD -- engine/map-view.js
```

It must print nothing. `bc9014b` is session C's base. P9 has not landed.

## Rulings on the items routed into this phase

**Routed 1 — P3's parked dark `border-color`.** `theme.css:405`'s dark block sets
`border-color: color-mix(in oklab, var(--line) 60%, var(--panel))` on nine selectors. Seven
(`.wz-card`, `.wz-area`, `.lp-pos`, `.lp-mine`, `.cmp-row`, `.cmp-acc`, `.wz-stat`) declare an
unconditional `border` shorthand in their own page styles at equal specificity and later source
order, so it never reaches them. The two it does reach — `.tm-card` and `.tm-picker` — already
border on `--field-line`, and mixing toward `--panel` makes those borders **dimmer, not
clearer**, the opposite of what B2 wanted it for. **Ruling: delete the `border-color`
declaration.** Keep `box-shadow: var(--e1)`, the half that does the work and lands on all nine.
This closes P3's parked Important by deletion rather than by escalating specificity across
seven page-local rules. Task 1.

**Routed 2 — P3's parked `engine/editor.html:181` `.mtitle-input:focus { outline: none }`.**
Specificity (0,2,0), beats the shared ring, same bug class as the wizard textarea P3 fixed.
**Ruling: delete the `outline: none` declaration** and let `theme.css`'s `:focus-visible` ring
apply. `editor.html` links `theme.css` *after* its own `<style>`, so the shared ring wins there
on source order once the local override is gone — derive and confirm. Task 10.

**Routed 3 — `.tm-morebtn` / `.tm-more a` raw values.** The `18px` on `.tm-morebtn` is the `⋯`
glyph's optical size, not a type step: **keep `18px` as a literal with an
`/* optical: the ⋯ glyph, not a type step */` comment.** `padding: 0 2px` → `0 var(--s1)` is a
2px→4px change on a button whose 44px floor comes from `button { min-height: 44px }` and is
unaffected. `.tm-more a` → `600 var(--fs-00)/var(--lh-snug)` per Ruling D. `.tm-more`'s
`min-width: 180px` is a **measure** and stays numeric — repeated here so no agent "fixes" it.
Task 1.

**Routed 4 — `web/wizard.html`'s `env(safe-area-inset-bottom, 0px)`.** Inert because the
viewport meta at `:6` has no `viewport-fit=cover`. **Ruling: P7 does not add
`viewport-fit=cover`.** Adding it is page-wide: it pushes content under the notch on every
edge, so it obliges a matching `env(safe-area-inset-left/right)` audit of the chrome, the
sticky nav and every full-bleed rule, and none of that is verifiable on the desktop-browser
walk this session ends with — it needs the real iPhone. P7 is a presentation phase with a
no-behaviour-change acceptance criterion. The armed `env()` and its explanatory comment stay
exactly as they are. **Routed to P11**, which owns cleanup and by then has a device pass behind
it. Recorded so a later session does not re-discover it as a one-word win.

**Routed 5 — `#open-answer` and `#custom-answer` side by side.** P5's register pass named
`#custom-answer` only, so the recommended escape hatch is a collapsed `<details>` while the
non-recommended one is still an always-open tile with `padding: 14px; gap: 7px` and a `15.5px`
serif `<strong>` — the most form-like thing on the screen. **Ruling: P7 brings `#open-answer`
into the same *typographic and spatial* register as `#custom-answer` — padding, gap and the
`<strong>` step — and does not change what it is.** Making it a `<details>` is a behaviour
change and a `pick()`-path change (`currentAnswer()` reads `chosen.hold.value`; CLAUDE.md §7
pins every path that sets `chosen` for a position through `pick()`), which is P11's business,
not a presentation phase's. Task 3, plus a finding.

**Routed 6 — the nav's "Listing status" vs the control's runtime "Unlist"/"Relist".** D4 is a
*typographic* register reduction: one uppercase register, everything else sentence case. Both
strings are already sentence case, so D4 does not reach them. Aligning them is a copy change,
and the two are **not** interchangeable: "Listing status" names a destination that is true in
both states, while "Unlist" is a verb that is a lie once the map is already unlisted. The
`Unlist, never Hide` invariant constrains the copy, not the nav label. **Ruling: no change.**
Sourcing the overflow item's label from the control's own state would be a behaviour change
*and* a two-file lockstep edit (`web/chrome.js` + `engine/editor.html:541-547`). **Routed to
P11** as a copy question, not a P7 substitution.

**Routed 7 — D4's reach into `engine/`.** The acceptance criterion greps `web/` **and**
`engine/`. `engine/render.py`'s embedded stylesheet is already a P7 unit (Task 12).
`engine/editor.html` is **not** in B1's file list except for `:root`. **Ruling: `editor.html`
becomes a tenth unit (Task 10) scoped to D4 and Routed 2 only** — drop `text-transform:
uppercase` and its tracking from the label registers, delete the `outline: none`, and
**nothing else**. No spacing snap, no type snap, no `:root` change. That satisfies the
criterion with the smallest diff and leaves the offline tool's own visual language alone.

---

## Stage 1 — sequential, sole holder of `engine/theme.css`

### Task 1 — `engine/theme.css` · Sonnet · commit alone

**Files:** `engine/theme.css` only. **No other agent may hold this file while Task 1 runs.**

- [ ] Snap every `gap`, `padding`, `margin` and `border-radius` in this file's own rules to
      `--s1`…`--s8` and `--r1`/`--r2`/`--r3`/`--r-pill`, and every `font:` shorthand to the
      seven `--fs-*` steps and four `--lh-*` steps. **The token blocks themselves**
      (`:9-19`, `:29-35`, `:44-51`, `:53-62`, `:64-71`, `:73-89`, `:91-113`, `:115-126`)
      are P2's output and **do not change** — this task edits the rules below them.
- [ ] **Radius, by job.** `.tm-card` 9px → `var(--r3)`. `.tm-picker` 9px → `var(--r3)`.
      `.tm-action-btn` 6px → `var(--r2)`. `.tm-note`'s `0 6px 6px 0` →
      `0 var(--r2) var(--r2) 0` (small win 10; `learn.html`'s `.lp-tiernote` is Task 4's).
      The focus ring's `border-radius: var(--r2)` is already correct.
- [ ] **`.tm-card`, per B1:** `padding: var(--s4)`, `gap: var(--s2)` (small win 16 — it lets
      `h3` and `.tm-go` share a baseline grid, and `.tm-go` keeps `margin-top: auto`),
      `border-radius: var(--r3)`. `h3` → `600 var(--fs-2)/var(--lh-snug) var(--serif)`;
      `p` → `var(--fs-0)/var(--lh-body) var(--serif)` with `max-width: var(--measure)`;
      `.tm-go` → `600 var(--fs-00)/var(--lh-ui) var(--sans)`.
- [ ] **`--measure`.** Replace every literal `58ch` in this file with `var(--measure)`:
      `.tm-prose`, `.tm-card p`, `.tm-note`, `.tm-hint`, `.tm-framing`.
- [ ] **Small win 1.** `text-wrap: balance` on `h1, h2, h3, .tm-card h3`; `text-wrap: pretty`
      on `p, dd, .tm-prose, .tm-hint, .tm-framing`. Two rules, **above** the backstop.
- [ ] **Small win 2.** `font-variant-numeric: tabular-nums` on `.tm-stat`. The other sites
      (`.wz-stat .num`, `.wz-area .pg`, `#wz-crumb`, `.cmp-table`) belong to Tasks 3 and 5;
      `relTime`'s output is styled by its callers and is covered by Tasks 6, 8 and 9.
- [ ] **D4.** `theme.css:188`'s `.tm-lab, .lab, .lp-pos-label` loses `text-transform:
      uppercase` **and** `letter-spacing: .04em`, and becomes
      `600 var(--fs-000)/var(--lh-ui) var(--sans)` in `var(--muted)`. `theme.css:219`'s
      `.tm-chrome .kicker` **keeps** uppercase and `.16em` — it is the one surviving register
      — and its font becomes `600 var(--fs-000)/var(--lh-ui) var(--sans)`.
      `details.optional > summary`'s `letter-spacing: .04em` also goes (a control label, not
      a register); its font becomes `600 var(--fs-00)/var(--lh-body) var(--sans)`.
- [ ] **Ruling A** — move `.tm-chrome .toplinks a { padding: 16px 0 }` from the `:203` coarse
      block down into the `:297` coarse block, beside `.tm-more a`. Keep `16px` literal, and
      carry a comment naming the winning declaration.
- [ ] **Ruling B** — `.tm-chrome .toplinks` → `600 var(--fs-00)/var(--lh-ui) var(--sans)`,
      `gap: var(--s3)`. State the 50.1px arithmetic in the report.
- [ ] **Ruling C** — `.tm-chrome .toplinks a` at `:222` gains **no** padding.
- [ ] **Ruling D** — `.tm-more a`'s coarse override → `padding: 16px var(--s4)`.
- [ ] **Routed 3** — `.tm-morebtn` keeps `18px` with the optical comment; `padding: 0 2px` →
      `0 var(--s1)`. `.tm-more`'s `min-width: 180px` stays numeric.
- [ ] **Routed 1** — delete the `border-color: color-mix(…)` declaration from the
      `@media (prefers-color-scheme: dark)` block at `:400-407`. Keep the `box-shadow`, and
      replace the comment's last sentence with the ruling's reasoning.
- [ ] `.tm-chrome`'s `padding: 16px 20px 12px` → `var(--s4) var(--s5) var(--s3)`;
      `.tm-chrome h1` → `var(--fs-3)/var(--lh-tight)` with `letter-spacing: -.012em`
      (B1: negative tracking on the large serif steps — today only two rules do it).
      `.kicker`'s and `h1`'s `margin: 0 0 3px` → `0 0 var(--s1)`.
- [ ] `.tm-grid`'s `gap: 14px` → `var(--s4)` (B1). `body.tm-page main`'s `padding: 20px` →
      `var(--s5)`. `body.tm-page`'s `font: 15px/1.6` → `var(--fs-1)/var(--lh-body)`.
      `.tm-prose p`'s `margin: 0 0 12px` → `0 0 var(--s3)`. `.tm-lead` →
      `600 var(--fs-0)/var(--lh-body) var(--sans)`. `.tm-picker h2` →
      `600 var(--fs-3)/var(--lh-snug) var(--serif)` + `letter-spacing: -.012em`;
      `.tm-picker`'s `padding: 20px` → `var(--s5)`, `.tm-picker .tm-grid`'s `margin: 16px 0`
      → `var(--s4) 0`. `.tm-chrome-titlerow`/`.tm-chrome-actions` gaps → `var(--s3)`/`var(--s2)`.
      `.tm-action-btn` → `600 var(--fs-000)/var(--lh-ui) var(--sans)`,
      `padding: var(--s2) var(--s3)`. `.tm-note`'s `padding: 10px 14px` →
      `var(--s3) var(--s4)`, `font: 13px/1.55` → `var(--fs-00)/var(--lh-body) var(--serif)`.
- [ ] **The alias selectors stay for now.** `.wz-quiet`, `.wz-hint`, `.lp-hint`,
      `.wz-framing`, `.lab`, `.lp-pos-label` keep riding along until Task 11 renames the call
      sites. Removing them here breaks six live pages.
- [ ] **Verify the reduced-motion `*` backstop is still the last rule in the file**, by line
      number, and say so in the report.
- [ ] Cascade derivation, per the procedure, for every rule this task changes that a `web/`
      page also declares. At minimum: `.tm-card`, `.tm-note`, `.tm-chrome .toplinks a`,
      `.tm-more a`, `.wz-quiet`/`.wz-hint`/`.wz-framing`/`.lab`, `details.optional > summary`,
      `body.tm-page main` vs `web/learn.html`'s and `web/compare.html`'s own `main` rules.
- [ ] `git diff --stat` read **before** the controller commits. CSS-only; a diffstat far
      larger than the change is a line-ending rewrite.

**Invariants quoted into Task 1:** `render.py`'s embedded `:root` and `engine/theme.css`
declare the same tokens with the same values, by hand — **nothing checks that they agree**
(this task changes no `:root` value, so no hand-copy is due; confirm that in the report);
`--line` and `--field-line` are not interchangeable; do not reintroduce traffic-light tier
colours; `--t1`…`--t4` live here and nowhere in `web/`; `.sel`'s tint and border are the only
selection signal; the reduced-motion backstop stays last.

---

## Stage 2 — parallel, nine agents, `engine/theme.css` closed

Each is one file, one commit, independently revertable. **No agent runs any `git` write
command** — see the ledger's Ruling 1. Each reports its diff and its cascade derivations; the
controller commits with an explicit pathspec.

Every Stage 2 task carries: the scope ruling table, the cascade procedure, Ruling E, the
motion ruling, the three-viewport requirement, and **"`--line` and `--field-line` are not
interchangeable"**, **"do not reintroduce a tier hex literal in a `web/` file — read the
token"**, and **"do not reintroduce traffic-light tier colours."**

### Task 2 — `web/landing.html` · Haiku

- [ ] Twelve raw values in a 23-line block. `.tm-main`'s `gap: 22px` → `var(--s5)`;
      `.tm-prose h2` → `600 var(--fs-3)/var(--lh-snug) var(--serif)` +
      `letter-spacing: -.012em`, `margin: 0 0 var(--s2)`; `li { margin-bottom: var(--s2) }`;
      `ul { padding-left: var(--s5) }`; `form` radius 9px → `var(--r3)`,
      `padding: 16px 18px` → `var(--s4)`; `form h2` →
      `600 var(--fs-2)/var(--lh-snug) var(--serif)`, `margin: 0 0 var(--s1)`;
      `label` → `600 var(--fs-000)/var(--lh-ui) var(--sans)`, `margin-top: var(--s3)`;
      `input` `padding: var(--s2)`, `margin-top: var(--s1)`, radius 5px → `var(--r2)`,
      `font: var(--fs-1) var(--sans)`; `button` `padding: var(--s3) var(--s4)`,
      `margin-top: var(--s4)`, radius 5px → `var(--r2)`, `font: 600 var(--fs-00) var(--sans)`;
      `#signed-out { gap: var(--s4) }`; `.quiet` → `var(--fs-00) var(--sans)`.
- [ ] `minmax(280px, 1fr)` and `max-width: 780px` are **measures** — untouched.
- [ ] **Small win 13 (the Listing-status loading tile) is P11's, not this task's.** It is a
      behaviour change. Leave `#vis-row` alone.
- [ ] Cascade: `button`, `input` and `label` are element selectors here, and
      `theme.css:204`'s coarse `button { min-height: 44px }` is also an element selector —
      derive which wins for `min-height` (nothing here sets it, so the floor holds; **say so
      explicitly**, and do not add one).

### Task 3 — `web/wizard.html` · **Sonnet, not Haiku** · the trap-bearing page

100 raw-value lines, four frozen bindings, and the `#q-back` floor. Model upgraded by the
ledger's Ruling 2.

- [ ] **Frozen, do not touch:** `.wz-nav`'s `margin: 2px -18px -36px` and its
      `padding: var(--s3) 18px calc(…)`; `.wz-screen-body`'s `padding: 22px 18px 36px`; the
      four `padding-right: 88px`; `.wz-tools`'s `top: 8px; right: 10px`; `.wz-pop`'s
      `top: 42px; left: 10px; right: 10px`; `.wz-more` entirely; the viewport meta at `:6`;
      every `@media (max-width: …)` value; `.wz-radio span`'s `min-height: 30px` (it loses on
      specificity to `theme.css`'s `.wz-radio input + span` (0,1,2) 44px floor — **derive that
      and leave both alone**); `.who`'s `150px` track; `.wz-check input`'s `16px`.
- [ ] **Ruling E: add no `button {}` rule.** Verify there are still zero `button` selectors in
      this file, and say so.
- [ ] **B1's screen titles, verbatim.** `#screen-intro h2, #screen-lens h2, #screen-question
      h2, #screen-home h2, #screen-area h2` → `margin: 0; font: 400 var(--fs-3)/var(--lh-tight)
      var(--serif); letter-spacing: -.012em; max-width: 26ch; text-wrap: balance;` and
      `#screen-intro h2 { font-size: var(--fs-4); max-width: 17ch; }` — `--fs-4` (26→36px)
      replaces the hard `32px`, `17ch` replaces `16ch`.
- [ ] **D4.** `.wz-outside` (`:157`) loses `text-transform: uppercase` and
      `letter-spacing: .04em` → `600 var(--fs-000)/var(--lh-ui) var(--sans)` in `--muted`,
      keeping its frozen `padding-right: 88px`. `#q-readmore > summary`'s
      `letter-spacing: .04em` goes with it.
- [ ] **Small win 2.** `font-variant-numeric: tabular-nums` on `.wz-stat .num`, `.wz-area .pg`
      and `#wz-crumb`.
- [ ] **Small win 9.** `.wz-pop`'s `box-shadow: 0 8px 24px rgba(0,0,0,.18)` → `var(--e2)`.
      A neutral grey shadow on a warm cream page is the SaaS-card tell; `--e2` is tinted off
      `--ink` and reverts to black in dark. One word, and `.wz-pop`'s geometry stays frozen.
- [ ] **Small win 15.** `.tchip`'s `padding: 5px 8px` → `5px 9px 5px 8px`; radius `99px` →
      `var(--r-pill)` — it is a status.
- [ ] **Routed 5.** `#open-answer { cursor: pointer; padding: var(--s4); gap: var(--s2); }`
      and `#open-answer > strong { font: 600 var(--fs-2)/var(--lh-snug) var(--serif) }` — the
      same steps `#custom-answer`'s tile uses, so the two escape hatches read as one register.
      `#ignore-answer strong` takes the same step. **Do not make `#open-answer` a
      `<details>`** — report it as a finding for P11 instead.
- [ ] Everything else snaps mechanically: `.wz-ghost`, `.wz-primary`, `.wz-link`, `.lens` and
      `.lens strong`/`span`, `.wz-card`, `.wz-card-h strong`, `.wz-chips`, `.wz-foot`,
      `.wz-holdfield` and its textarea, `.wz-hold`, `.wz-radios`, `.wz-radio span`'s
      padding/radius/font, `.wz-controls`, `.wz-check`, `.wz-fields`, `#who-body`, `.who dt`,
      `.who dd`, `.wz-stat` and `.num`, `.wz-tier`, `#home-areas-list`, `.wz-area` and its
      `.nm`/`.pg`, `.wz-block`, `#home-lensrow`, `.wz-qlist`, `.wz-qrow` and `.st`,
      `#ignore-answer`, `#area-add-panel`, `#wz-header`, `#wz-crumb`, `#wz-headright`,
      `#screen-home .wz-screen-body`/`#home-full`'s `gap: 26px` → `var(--s5)`, `#q-readmore`,
      `#q-readmore-body`, `#positions`, `.wz-slot`, `.wz-explain`, `.wz-lead`, `.wz-actions`,
      `#lens-list`, `.wz-outside-note`, `#custom-answer`'s three `7px`s, `#home-tierbar`'s
      `99px` → `var(--r-pill)`.
- [ ] Every `58ch` → `var(--measure)`.
- [ ] **The three `view-transition-name` declarations at `:42-44` are untouched.** A second
      rendered element sharing one aborts the whole transition, silently. `.wz-nav`'s is a
      **class**, so a second `.wz-nav` anywhere kills every transition on the page.
- [ ] Cascade derivations required for: `.wz-radio span`; `.wz-card`/`.wz-qrow`/`.lens`
      (theme.css's press-feedback and `:hover` rules match them); `.wz-quiet`/`.wz-hint`/
      `.wz-framing`/`.lab` (theme.css `:185-188` vs this page); `#custom-answer > .wz-hint`;
      `body.wz main` vs `body.tm-page main`.

**Invariants quoted into Task 3:** tier and confidence stay real `<input type="radio">` on
both surfaces — **do not hand-roll `role="radiogroup"`**; `.sel`'s tint and border are the
only selection signal, the tick is gone deliberately; `#home-empty` is deleted, **do not
re-add a second empty-state home**; any pane hidden by the `hidden` attribute needs the
global `[hidden] { display: none !important }` at `:17` — **do not remove it**; a second
rendered element sharing a `view-transition-name` aborts the entire transition, silently,
with no console error.

### Task 4 — `web/learn.html` · Sonnet

- [ ] **D4, three registers on this page.** `.lp-filter-row label` (`:17`),
      `.lp-tiernote .lab` (`:47-49`) and `.lp-outside` (`:81-82`) all lose
      `text-transform: uppercase` and their tracking, and become
      `600 var(--fs-000)/var(--lh-ui) var(--sans)` in `var(--muted)`.
- [ ] **Small win 10.** `.lp-tiernote`'s `border-radius: 0 4px 4px 0` is the same object as
      `theme.css`'s `.tm-note`. **Read `web/learn.js` first** to see whether the element also
      carries `.tm-note`: if it does, delete the local `border-radius` (and the local
      `background`/`border-left`/`padding` that duplicate it) and let `.tm-note` own the
      geometry; if it does not, give `.lp-tiernote` `0 var(--r2) var(--r2) 0` instead of
      deleting. **Report which of the two it was.**
- [ ] **Small win 15.** `.lp-tier`'s `padding: 5px 8px` → `5px 9px 5px 8px`; `99px` →
      `var(--r-pill)` (status). `.lp-refchip`'s `border-radius: 4px` → `var(--r1)` (data) —
      §3.2's stated reason why a tier chip and a citation chip must not look alike.
      `.lp-refchip`'s `padding: 2.5px 7px` is optical on a 1px-bordered micro-pill: **keep the
      values, add a comment, and report it as a scale finding** rather than rounding it.
- [ ] The rest snaps: `.lp-lead`, `.lp-filter-row`, `#lp-filter`, `.lp-domain`, `.lp-domain h2`
      (→ `400 var(--fs-3)/var(--lh-snug)` + `letter-spacing: -.012em`), `.lp-rows`, `.lp-row`,
      `.lp-row .nm`/`.meta`/`.count`, `.lp-tierlegend`, `.lp-tiernote p`, `.lp-refs`,
      `.lp-back`, `.lp-section`, `.lp-section h2`/`h3`, `.lp-prose`, `.lp-positions`,
      `.lp-pos`, `.lp-outside-note`, `.lp-who dt`/`dd`, `.lp-mine`, `.lp-mine-actions`,
      `.lp-sources`. `62ch` → `var(--measure-wide)` where it caps prose; `58ch` →
      `var(--measure)`. `170px` and every `@media` width are measures.
- [ ] **`.lp-tierlegend`'s `margin-top: -8px`** is a negative pull against `.lp-lead`'s
      `margin: 0 0 16px`. Snap both or neither: make `.lp-lead` `0 0 var(--s4)` and
      `.lp-tierlegend` `margin-top: calc(var(--s2) * -1)`, and **state the pair** in the
      report.

**Invariant quoted verbatim into Task 4:** *"`/learn`'s position cards let their `gap` own all
vertical spacing. `.lp-pos > *, .lp-mine > * { margin: 0 }` exists because every row is a `<p>`
and flex gaps add to margins rather than collapsing them. The reset is scoped with `>` on
purpose and must stay declared **after** `.lp-prose`/`.lp-hint`/`.lp-refs` to win on order.
Add a row to these cards without a margin of its own."* — **so this task must not reorder the
`<style>` block**, and `.lp-pos > .lp-pos-label`'s `margin-top: 5px` → `var(--s1)` is the one
margin those cards are allowed. Also: *"`/learn` says **suggested** on every tier chip, carries
a legend explaining the ramp, and renders each doctrine's `tier_note`."* — the legend and the
note stay.

### Task 5 — `web/compare.html` · Sonnet

- [ ] Forty-eight raw-value lines, no frozen bindings, no uppercase register. Snap
      `.cmp-body-wrap`, `#picker-traditions`/`#picker-members`, `.cmp-section-h`,
      `#results-heading`, `#cmp-framing`, `#cmp-closest`, `.cmp-closest-line`,
      `#sc-table-wrap`, `.cmp-table` and its cells, `#sc-accordion-host`, `.cmp-acc` and its
      summary/group/row, `#diff-groups`, `#cmp-tiers`, `.cmp-tier-*`, `.cmp-group*`,
      `.cmp-count`, `.cmp-row`, `.cmp-q`, `.cmp-verdict`, `.cmp-body`, `.cmp-col`,
      `.cmp-row a`.
- [ ] `h1 { font-size: 1.4em }` → `var(--fs-3)`. `#results-heading`'s `400 24px/1.3` →
      `400 var(--fs-3)/var(--lh-snug)` + `letter-spacing: -.012em`. `.cmp-section-h`'s
      `400 20px/1.3` → the same step.
- [ ] **Small win 2.** `font-variant-numeric: tabular-nums` on `.cmp-table`.
- [ ] **Small win 8.** `.cmp-tier-pill`'s `99px` → `var(--r-pill)` (status).
      `#sc-table-wrap`, `.cmp-acc`, `.cmp-row` and `.cmp-tier-item` resolve by the job rule —
      a thing that holds other things is `--r3`, a thing you press is `--r2`. **State which
      job you assigned each and why.**
- [ ] `min-width: 560px`, `max-width: 26ch`, `flex: 1 1 240px`, `border-top: 2px` and every
      `@media` width are measures.
- [ ] `.cmp-row .wz-framing`'s selector stays until Task 11 renames it.

**Invariants quoted into Task 5 — this is the ethics-bearing surface:** *"Compare is
descriptive, never evaluative. 'Closest tradition' is said of traditions only and always with
its denominator. There is deliberately no person-vs-person scorecard, no score attached to a
named person, and no leaderboard … A later session will find the missing people-vs-people
scorecard and read it as an obvious symmetry to add. It is not. Do not add it."* And, from
this page's own comment: *"The move is stated, never coloured good or bad: a person who tiers
a doctrine higher than the suggestion is not thereby wrong, and neither is one who tiers it
lower. Same weight for both directions."* — `.cmp-tier-move` keeps `var(--muted)` and one
weight; **do not** give the two directions different colours while tidying the sheet.

### Task 6 — `web/gallery.html` · Haiku

- [ ] Four raw-value lines, all inside `.tm-tierbar` and `.tm-skel`. **Every one is a
      measure** — bar heights, skeleton-line heights and widths, and `border-radius: 3px` on a
      6px bar (`--r1`'s 4px would round a 6px bar into a lozenge). **Ruling: this page is
      expected to be a no-op for the substitution tables.** Verify that and report it rather
      than inventing a change.
- [ ] The skeleton's `@media (prefers-reduced-motion: no-preference)` guard at `:20-23` is
      **correct and is the pattern P8 copies**. Confirm it is intact; change nothing.
- [ ] **Small win 11 (empty state with an action) is P11's.** `#empty` stays as it is.
- [ ] `relTime`'s output lands in a `.tm-stat` (`:103`), which Task 1 gave
      `font-variant-numeric: tabular-nums`. Confirm by reading `:95-110`; add nothing.

### Task 7 — `web/view.html` · Haiku

- [ ] `.tm-main`'s `gap: 10px` → `var(--s3)`; `#tradition-note p`'s `margin: 2px 0` →
      `var(--s1) 0`; `iframe`'s `border-radius: 6px` → `var(--r2)`; `h1`'s `1.4em` →
      `var(--fs-3)`; `#tradition-note`'s `.92em` → `var(--fs-0)`.
- [ ] **Small win 9.** The Fullscreen button's `box-shadow: 0 1px 6px rgba(0,0,0,.28)` →
      `var(--e2)`.
- [ ] `min-height: 320px`, `right: 12px`, `bottom: calc(12px + env(…))` and `z-index: 51` are
      measures and positions — untouched. The `env(safe-area-inset-bottom)` here is on a
      **fixed button**, not a bleed, and stays.

**Invariants quoted verbatim into Task 7:** *"`.tm-main` in `web/view.html` carries
`width: 100%; box-sizing: border-box` and must keep it. `/view` is the only page making
`<body>` a flex column, and `theme.css`'s `margin-inline: auto` on a flex item cancels the
cross-axis stretch — without an explicit width the iframe collapses to its 300px intrinsic
width, which reads correct on a phone."* *"`/view`'s Fullscreen is not the Fullscreen API …
it deliberately does not fix-position the iframe."* *"`/view` must not redirect an owner on a
404."* — this task touches CSS only and must not go near the script.

### Task 8 — `web/history.html` · Haiku

- [ ] `.tm-main` `gap: 20px` → `var(--s5)`; `button` `padding: 9px 15px` →
      `var(--s3) var(--s4)`, radius 5px → `var(--r2)`, `font: 600 var(--fs-00) var(--sans)`;
      `#versions-section h2` → `600 var(--fs-2)/var(--lh-snug) var(--serif)`,
      `margin: 0 0 var(--s2)`; `#versions-list` `gap: var(--s2)`; `li` `gap: var(--s3)`,
      `padding: var(--s2) var(--s3)`, radius → `var(--r2)`; `li span` →
      `var(--fs-00) var(--sans)` **plus `font-variant-numeric: tabular-nums`** (small win 2 —
      this is a `relTime` output site); `li button` `padding: var(--s1) var(--s3)`,
      `font-size: var(--fs-00)`.
- [ ] Cascade: this page declares a bare `button {}` rule. It sets no `min-height`, so
      `theme.css:204`'s coarse floor still applies — **derive it and say so**, and do not add
      a `min-height` here.

### Task 9 — `web/admin.html` · Haiku

- [ ] `h1` `1.4em` → `var(--fs-3)`; `#creds` `margin-bottom: var(--s5)`; `#creds h2` and
      `.user-tile h3` → `600 var(--fs-2)/var(--lh-snug) var(--serif)`; `label` →
      `600 var(--fs-000)/var(--lh-ui) var(--sans)`, `margin-top: var(--s2)`; `input`
      `padding: var(--s2)`, `margin-top: var(--s1)`, radius → `var(--r2)`,
      `font: var(--fs-0)/var(--lh-ui) var(--sans)`; `button` `margin-top: var(--s3)`,
      `padding: var(--s2) var(--s4)`, radius → `var(--r2)`, `font: 600 var(--fs-00)/1
      var(--sans)`; `#users-list` `gap: var(--s4)`, `margin-top: var(--s2)`; `.user-meta`
      `gap: var(--s1) var(--s3)`, `font: var(--fs-00)/var(--lh-ui) var(--sans)` **plus
      `font-variant-numeric: tabular-nums`**; `.user-actions` `gap: var(--s2)`,
      `margin-top: var(--s2)`; `#pin-reveal.tm-note` `margin-top: var(--s3)`.
- [ ] `.user-actions button`'s `min-height: 44px; min-width: 44px` is the coarse floor made
      unconditional — **leave both**. `max-width: 320px` and `minmax(280px, 1fr)` are measures.
- [ ] Cascade: this page declares `button {}` **and** `input {}` as element selectors and
      links `theme.css` first, so anything `theme.css` declares on those elements at (0,0,1)
      loses here on source order. Derive it for `min-height` and for the shared focus ring
      (`theme.css`'s ring is `:where(a, button, …):focus-visible` — `:where()` contributes
      **zero**, so the ring is (0,1,0); check what this page opposes it with and state it).

### Task 10 — `engine/editor.html` · Sonnet · **D4 and Routed 2 only**

- [ ] **Scope is exactly two things. Do not snap spacing or type in this file.**
- [ ] **D4.** Eight `text-transform: uppercase` sites (`:113`, `:156`, `:172`, `:190`, `:204`,
      `:216`, `:244`; `:251`'s `none` is already correct). For each: if it is this page's
      `.kicker`-equivalent — the one register with a stated job — it keeps uppercase and its
      tracking. **Every other one loses `text-transform: uppercase` and its `letter-spacing`**
      and becomes `600 var(--fs-000)/var(--lh-ui) var(--sans)` in `var(--muted)`, sentence
      case. **Identify which single one is the kicker by reading the markup, and say which.**
- [ ] **Routed 2.** `:181`'s `.mtitle-input:focus { outline: none }` — delete the
      `outline: none` declaration only. `engine/editor.html` links `theme.css` **after** its
      own `<style>` (`:289`), so the shared `:focus-visible` ring wins there on source order
      once the local override is gone. **Derive that and name the winning declaration.** The
      rule also substitutes a border-bottom colour change; keep that.
- [ ] **`:root` at `:18-27` does not change.** Task 1 changed no token value, so no hand-copy
      is due. Confirm by diffing this file's `:root` against `theme.css`'s and **report any
      pre-existing drift as a finding — do not fix drift in this task.**
- [ ] **`.addbtn`'s deliberate 34px opt-out stays.** It uses a class to beat the
      element-selector 44px floor precisely because this file links `theme.css` last.

**Invariants quoted into Task 10:** *"The nav list in `web/chrome.js` and
`engine/editor.html:541-547` is a permanent hand-kept lockstep — the documented `file://`
exception. Any nav change is two edits."* — this task makes no nav change. *"No change to the
offline tool's contract. `start_editor.bat` keeps working from `file://`, offline, with no
network and no database."* *"Every visible string in `editor.html`'s markup is the offline
tool's wording"* — D4 changes CSS, never copy.

---

## Stage 3 — sequential, cross-file

### Task 11 — the `.tm-*` rename · Sonnet · commit alone

Finishes P1 Task 5's explicit deferral. ~41 call sites across seven files plus the CSS.

- [ ] Rename in the markup and in the `el()` calls: `wz-quiet` → `tm-quiet`,
      `wz-hint` → `tm-hint`, `lp-hint` → `tm-hint`, `wz-framing` → `tm-framing`,
      `lab` → `tm-lab`, `lp-pos-label` → `tm-lab`. Files: `web/wizard.html` (15),
      `web/wizard.js` (7), `web/compare.js` (7), `web/learn.js` (12), `web/learn.html`,
      `web/compare.html`, `web/refs.js`. **Grep, do not guess** — `lab` is a substring of
      ordinary words, so match `class="…"` and `el('tag', '…')` forms only.
- [ ] Update the CSS selectors that *consume* an alias: `web/wizard.html`'s
      `#custom-answer > .wz-hint`, `web/compare.html`'s `.cmp-row .wz-framing`,
      `web/learn.html`'s `.lp-tiernote .lab` and `.lp-pos > .lp-pos-label,
      .lp-mine > .lp-pos-label`.
- [ ] Then drop the alias selectors from `engine/theme.css:185-188`, leaving `.tm-quiet`,
      `.tm-hint`, `.tm-framing`, `.tm-lab`, and delete the comment sentence that says the
      page-local names ride along for one round.
- [ ] **Then grep the whole repo for every old name and prove zero remain.** A missed call
      site is an unstyled paragraph, which reads as a content bug, not a CSS one.
- [ ] Full standing gate. This task touches `.js`, so `py tests/syntax_check.py` is live.

### Task 12 — `engine/render.py`'s embedded stylesheet · Sonnet · **alone, last, hash-bearing**

- [ ] `:root` at `:277-300` does not change. Everything below it does.
- [ ] **Radius.** `.node`'s `9px` → `var(--r3)` (12px) and `.mbox`'s `7px` → `var(--r3)` —
      §3.2 names both as the felt change that moves this file. `dd.rel a`'s `20px` →
      `var(--r2)` (small win 8: it is a pressable, not a pill). `.refchip`'s and `.chip`'s
      `4px` → `var(--r1)` (data). `#mapwrap`'s `9px` and `.versepop`'s `0 9px 9px 0` →
      `var(--r3)` (containers). `.views`/`.seg`'s `7px` and their buttons' `5px`,
      `input[type=search]`'s `6px`, `.btnrow button`'s and `.mapcontrols button`'s `6px` →
      `var(--r2)` (controls).
- [ ] **D4.** Keep `.kicker` (`:377-378`) uppercase with its `.16em` — it is the one register.
      Drop `text-transform: uppercase` **and** the tracking from `.group > h2` (`:422`),
      `.chip` (`:445`), `dt` (`:457`), `.versepop-head` (`:481`) and `.mbox-domain` (`:526`),
      making each `600 var(--fs-000)/var(--lh-ui) var(--sans)` in `var(--muted)`.
      **`.chip.tier` keeps `color: #fff`** and its tier background — dropping the transform is
      a no-op for a `T2` code and is exactly the point for an `assumed` chip.
- [ ] **Type.** `body` `15px/1.6` → `var(--fs-1)/var(--lh-body)`; `h1` `23px` → `var(--fs-3)`
      with `letter-spacing: -.012em`; `.ntitle` `17px` → `var(--fs-2)`; `dd` `14.5px/1.6` →
      `var(--fs-0)/var(--lh-body)`; and `.sub`, `.views button`, `.seg button`,
      `input[type=search]`, `label.tog`, `.btnrow button`, `.dom`, `.mcount`, `.legend`,
      `.pagefoot`, `.versepop-body`/`-empty`/`-attr`, `.maphint`, `.mapcontrols button`,
      `.mtitle b`, `.mchev`, `.mbox`, `.mbox-root`, `.mdetail dd` to the nearest step.
      Every `58ch` → `var(--measure)`; `min(58ch, 100%)` keeps its `min()` wrapper.
- [ ] **Spacing.** `header`'s `15px 22px 11px`, `main`'s `18px 22px 90px`, `main.wide`'s
      `16px`, `.group`'s `margin-bottom: 22px`, `.node`'s `14px 18px 15px` and
      `margin-bottom: 10px`, `dl`'s `margin`/`padding`/`gap`, `.mbox`'s `9px 12px`,
      `.mdetail`'s `margin-top: 9px`/`padding-top: 8px`, `.pagefoot`'s `18px 22px 40px`,
      `.versepop`'s `12px 16px 13px`, and every `gap` → the eight steps.
- [ ] **Frozen in this file:** `#mapwrap`'s `calc(100vh - 130px)` and
      `background-size: 24px 24px`; `.node`'s `scroll-margin-top: 96px`; every `.mbox-*`
      min/max-width clamp and `.mbox-root`'s `width: 150px`; `.meter`'s `46px × 5px`; `.sw`'s
      `10px`; `main`'s `max-width: 1080px` and `main.wide`'s `max-width: none`; the `3px` left
      rules; `stroke-width`; `.views`/`.seg`'s `gap: 2px` and `padding: 3px` (a
      segmented-control inset, not a spacing step — **comment it as such**);
      `.refchip`'s `padding: 2.5px 7px` (optical micro-pill — comment and report as a finding).
- [ ] **The reduced-motion guard hand-copied from `theme.css` must remain the last rule in
      this file's embedded stylesheet.** Report its line number before and after.
- [ ] **Regenerate with `py engine/render.py`. Never hand-edit a generated file to make a hash
      match.**
- [ ] **The two byte-identity invariants must hold exactly:** `documentation/study-list.md`
      unchanged, and the embedded `<script id="data">` payload still `4d8d919e…c8bd7e`. That
      is what proves only *presentation* moved.
- [ ] **The full-output hash moves, and this task is licensed to move it.** Compute both the
      CRLF and LF-normalised hashes of `theology-map.html` and **write the new pair into BOTH
      `docs/superpowers/plans/2026-09-10-ux-overhaul/00-index.md`'s baseline table (a new
      "post-P7 — read against this" row) and `CLAUDE.md` §1, in the same commit.** The current
      post-P4 pair is `886d64a6…a7b58e` CRLF / `d448206d…0e1480` LF and both files agree with
      the tree right now.
- [ ] **Read `git diff --stat` before the controller commits.** This is the largest diff in
      the phase, which is exactly when a line-ending rewrite hides.
- [ ] Gate: `py engine/validate_content.py` (**0 errors / 37 warnings is the real baseline on
      this tree — unchanged is pass**), `py tests/check_generated_map.py`,
      `py tests/check_tradition_maps.py`, `py tests/syntax_check.py`.

**Invariants quoted into Task 12:** *"The Map view sets `main.wide` (`max-width: none`); the
card views keep the 1080px reading measure."* *"A framed map trims its own header … hiding the
kicker, subtitle and tier legend and visually-hiding the `h1`."* *"`#mapwrap`'s height comes
from `sizeMap()` … the CSS constants stay as the no-JS fallback."* *"`render.py`'s embedded
`:root` and `engine/theme.css` declare the same tokens with the same values, by hand. Nothing
checks that they agree."* *"`render.py` keeps its copy of `--t1`…`--t4` for the
self-containment reason; that one is legitimate."* *"Do not reintroduce traffic-light tier
colours."* *"`--line` and `--field-line` are not interchangeable."*

---

## Stage 4 — the audit

### Task 13 — the grep audit · Haiku · **read-only, no edits**

Produces the evidence for the acceptance criteria. Reports findings; fixes nothing.

- [ ] `grep -rn "text-transform: *uppercase" web/ engine/` → `.kicker` in `theme.css` and
      `.kicker` in `render.py`, and the one register kept in `editor.html`. List every hit.
- [ ] Every `font-size` and `font:` shorthand across `web/` and `engine/theme.css`: list any
      literal size that is not one of the seven steps, with file:line and the value.
- [ ] Every `gap` / `padding` / `margin`: list any literal that is not one of the eight steps
      and is not on the frozen list above, with file:line.
- [ ] Every `border-radius`: list any literal that is not one of the four.
- [ ] `git diff --stat bc9014b..HEAD -- engine/map-view.js` → empty.
- [ ] **A value that does not fit the scale is a finding, not a licence to add a ninth step.**
      Report it; do not invent a token, and do not edit anything.
