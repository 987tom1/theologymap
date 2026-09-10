# P3 — Interaction states and dark mode

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply to every task here.

**Spec:** spec §7 P3. **Detail:** `documentation/design-modern-feel.md` B2 (`:539-578`),
B3 (`:579-647`), §3.6, §5 small wins 6, 12, 18.

**Goal:** The highest felt-quality-per-line in the whole program. Three of these are
correctness, not polish.

**Model:** Sonnet. **Depends on:** P2 (needs `--e1`, `--r2`, `--dur-1`, `--ease-out`).
**Blocks:** P4, P6.

---

## Tasks

1. **`color-scheme: light dark`** — one declaration in all three `:root` copies. There is no
   `color-scheme` property anywhere in this repo, only media queries, so **every native
   control, scrollbar, caret and `<dialog>` backdrop renders light-mode on a dark page.**
   Largest visible-quality-per-character change in the codebase.
2. **`accent-color: var(--ink)`** on `:root` — small win 12. Fixes the browser-blue checkbox
   at `wizard.html:201` and gives the dead `--accent` token a job in all three copies.
3. **The state system** — B3's block into `engine/theme.css`: `:focus-visible`,
   `.wz-holdfield:focus-within`, press feedback, hover, `:disabled` / `[aria-disabled]`,
   `::selection`. **Delete `web/wizard.html:177`** (`.wz-holdfield textarea:focus { outline:
   none }`). `web/admin.html:20` and `engine/editor.html:58` can then drop their local
   `:disabled` rules.
4. **Fix `theme.css:118`.** `.wz-radio span, .mradio span { min-height: 38px }` sits **inside
   the `@media (pointer: coarse)` block whose whole purpose is the 44px floor** — and those
   are tier and confidence, the most-tapped controls in the product. Raise to 44px; the
   padding at `wizard.html:190` already allows it.
5. **Dark-mode elevation** — B2's second half. In dark, `--line: #372f22` on
   `--panel: #201b14` is ≈1.3:1, so **card edges are invisible and every screen flattens into
   one brown field.** Do not raise `--line` — it would shout in the light theme's borrowed
   rules. Give dark-mode containers `box-shadow: var(--e1)` instead.
6. **`caret-color: var(--ink)`** on inputs and textareas — small win 18.

Tasks 1+2 are one commit (both are `:root`, all three files). Tasks 3–6 are one commit each.

## Invariants to quote into the tasks that touch these files

> **`render.py`'s embedded `:root` and `engine/theme.css` declare the same tokens with the
> same values, by hand.** … **Nothing checks that they agree.**
> (Tasks 1 and 2 are `:root` changes: **all three copies**.)

> **`--line` and `--field-line` are not interchangeable.** `--field-line` is for interactive
> control boundaries *only* (WCAG 2.1 SC 1.4.11 needs 3:1; `--line` on `--panel` is 1.36:1).
> `--line` stays the decorative divider. (Task 5 exists *because* of this rule, not despite it.)

> **Tier and confidence stay real `<input type="radio">` on both surfaces.** Arrow-key
> operation and radiogroup semantics come from the platform. **Do not hand-roll
> `role="radiogroup"`.** (Task 4 touches these controls.)

> **`.sel`'s tint and border are the only selection signal.** The tick is gone deliberately.
> (Task 3's hover and press states must not compete with it.)

## Specificity note for Task 3

The blanket `:focus-visible` uses `:where(...)` (specificity 0), so any page-local ring still
wins. **Verify `.wz-radio input:focus-visible + span` (`wizard.html:194`) still applies** — it
does, on higher specificity, but check it rather than assume.

## Gate additions

- `render.py` is touched (Tasks 1, 2 — `:root` only). Regenerate; **`study-list.md` and the
  `<script id="data">` payload byte-identical.** `color-scheme` and `accent-color` change
  rendered appearance, so the **full output hash may move** — this is a phase licensed to
  change the output on purpose. Say so in the commit message.
- `engine/theme.css` and `engine/editor.html` load from `file://`. **Open `/edit` offline.**

## Acceptance criteria

- [ ] **Every interactive element has a visible focus state.** Tab through `/wizard`'s
      question screen end to end, `/landing`'s two forms, `/compare`'s picker, `/admin`.
      **The belief textarea especially** — this is WCAG 2.4.7 and it is currently failing.
- [ ] **Every coarse-pointer target is ≥44px**, tier and confidence included. Measure them,
      do not eyeball them.
- [ ] The four disabled buttons across `landing.html` and `history.html` read as disabled.
- [ ] `::selection` is warm olive, not system blue, on a drag over prose.
- [ ] **Dark mode: card edges are visible.** `/gallery`, `/wizard` launchpad, `/learn`
      position cards, `/compare` rows. No screen is one flat brown field.
- [ ] Native controls match the page in dark: the `<select>` on `/wizard`, the checkbox at
      `wizard.html:201`, the caret in every textarea, the scrollbars, the picker `<dialog>`
      backdrop.
- [ ] **Light mode re-checked.** `color-scheme` changes every form control in *both* themes.
      Walk `landing.html`'s two forms and `admin.html` in light as well.
- [ ] **360px / 820px / 1440px, both themes, reduced-motion on.** With reduced motion the
      press feedback is instant — B3's press block is inside
      `@media (prefers-reduced-motion: no-preference)` and must stay there.
- [ ] `/edit` opened from `file://`.
- [ ] `git diff -U0 main -- engine/map-view.js | grep '^@@'` returns nothing.
