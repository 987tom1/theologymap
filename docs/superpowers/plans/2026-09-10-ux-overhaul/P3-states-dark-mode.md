# P3 — Interaction states and dark mode

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply to every task here.

**Spec:** spec §7 P3. **Detail:** `documentation/design-modern-feel.md` B2 (`:539-578`),
B3 (`:579-647`), §3.6, §5 small wins 6, 12, 18.

**Goal:** The highest felt-quality-per-line in the whole program. Three of these are
correctness, not polish.

**Model:** Sonnet. **Depends on:** P2 (needs `--e1`, `--r2`, `--dur-1`, `--ease-out`).
**Blocks:** P4, P6.

**Session:** A, behind P2. **P2's Task 8 zero-visual-diff verification must be complete and
committed before Task 1 here starts.** P2's whole verifiability comes from nothing consuming
the new tokens; P3 is the phase that starts consuming them, and its work must not blur that
signal.

**Line numbers quoted in this file are pre-P1 and have drifted** (`wizard.html:177` is now
`:173`; `theme.css:118` is now `:131`). Locate every target by selector, never by line number.

---

## Tasks

### Tasks 1 + 2 — `color-scheme` and `accent-color` · **one commit**, all three `:root` copies

Both are `:root` declarations, so both incur the three-way hand-copy. Same insertion point P2
used: `:where(:root)` in `engine/theme.css`, plain `:root` in `engine/render.py` and
`engine/editor.html`.

- [ ] Add to the base token block in all three:
      ```css
      color-scheme: light dark;
      accent-color: var(--ink);
      ```
- [ ] **Task 1's why:** there is no `color-scheme` property anywhere in this repo, only media
      queries. Without it every native control, scrollbar, caret and `<dialog>` backdrop
      renders **light-mode on a dark page**. One declaration repaints all of them. Largest
      visible-quality-per-character change in the codebase.
- [ ] **Task 2's why (small win 12):** fixes the browser-blue checkbox on `/wizard`
      (`.wz-check input`) and every future one, and gives the dead `--accent` token a job.
      `render.py` already writes `label.tog input { accent-color: var(--accent) }`; leave that
      rule alone — `--accent` and `--ink` carry the same value in both themes, so the page-wide
      declaration and the local one agree.
- [ ] `py engine/render.py`. **`study-list.md` and the `<script id="data">` payload stay
      byte-identical.** The **full output hash moves** — this is a phase licensed to change
      the output on purpose. **Say so in the commit message.**
- [ ] Standing gate. Commit.

### Task 3 — The state system · one commit

B3's block into `engine/theme.css`, plus three deletions. Transcribe the CSS verbatim.

- [ ] Append to `engine/theme.css`:
      ```css
      /* One focus ring for the whole product. --ink reads against both grounds
         (it is the light value in dark mode); the offset is what makes it
         visible on an already-bordered control. */
      :where(a, button, summary, input, select, textarea, [tabindex]):focus-visible {
        outline: 2px solid var(--ink);
        outline-offset: 2px;
        border-radius: var(--r2);
      }

      /* The belief field. The ring belongs on the WRAPPER, which is the thing
         that looks like the control. */
      .wz-holdfield:focus-within {
        outline: 2px solid var(--ink);
        outline-offset: 2px;
        border-color: var(--ink);
      }

      /* Press feedback, which coarse pointers get no hover substitute for today. */
      @media (prefers-reduced-motion: no-preference) {
        .tm-card, .wz-card, .lens, .wz-qrow, .lp-row, .tm-action-btn, .wz-ghost {
          transition: border-color var(--dur-1) var(--ease-out),
                      background-color var(--dur-1) var(--ease-out),
                      box-shadow var(--dur-1) var(--ease-out);
        }
        :where(.tm-card, .wz-card, .lens, .wz-qrow, .lp-row, button):active {
          scale: .995;
          transition-duration: 60ms;
        }
      }

      a.tm-card:hover, .tm-cardlink:hover, .lp-row:hover, .wz-qrow:hover {
        border-color: var(--field-line);
        background: color-mix(in oklab, var(--chip) 45%, var(--panel));
        box-shadow: var(--e1);
      }

      :where(button, .tm-action-btn, .wz-primary, .wz-ghost):disabled,
      [aria-disabled="true"] {
        opacity: .45;
        cursor: default;
        box-shadow: none;
      }

      ::selection { background: color-mix(in oklab, var(--t2-5) 25%, transparent); }
      ```
- [ ] **Delete** `web/wizard.html`'s `.wz-holdfield textarea:focus, .wz-holdfield input:focus
      { outline: none; }`. This rule is why the product's primary input has no focus indicator
      at all — a live WCAG 2.4.7 failure, not a polish item.
- [ ] **Delete** `web/admin.html`'s local `button:disabled { opacity: .5; cursor: default; }`
      — the shared rule covers it.
- [ ] **Delete** `engine/editor.html`'s local `button:disabled { opacity:.4;
      cursor:not-allowed; }` — same. `editor.html` links `theme.css`, so this is safe from
      `file://` too.
- [ ] The press block stays **inside** `@media (prefers-reduced-motion: no-preference)`. Under
      reduced motion the press feedback must be instant, not slowed.
- [ ] Standing gate. Commit.

### Task 4 — The 38px radios · one commit

- [ ] In `engine/theme.css`, inside the `@media (pointer: coarse)` block, change
      `.wz-radio span, .mradio span { min-height: 38px; }` to `44px`.
- [ ] This rule sits inside the block whose entire purpose is the 44px floor, and it governs
      **tier and confidence — the most-tapped controls in the product.** The padding on
      `.wz-radio span` in `web/wizard.html` already allows 44px; no other change is needed.
- [ ] **Measure the rendered target, do not eyeball it.**
- [ ] Standing gate. Commit.

### Task 5 — Dark-mode elevation · one commit

- [ ] Append to `engine/theme.css`:
      ```css
      /* In dark, --line (#372f22) on --panel (#201b14) is ~1.3:1, so card edges
         are invisible and every screen flattens into one brown field. Raising
         --line is not the fix — it would shout in the light theme's borrowed
         rules. Give dark containers elevation instead of relying on the edge. */
      @media (prefers-color-scheme: dark) {
        .tm-card, .wz-card, .lp-pos, .lp-mine, .wz-area, .cmp-row, .cmp-acc,
        .tm-picker, .wz-stat {
          box-shadow: var(--e1);
          border-color: color-mix(in oklab, var(--line) 60%, var(--panel));
        }
      }
      ```
- [ ] **Do not raise `--line`.** `--line` and `--field-line` are not interchangeable and this
      task exists *because* of that rule, not despite it.
- [ ] `.wz-card`, `.lp-mine`, `.wz-area` and `.wz-stat` are declared in `web/` page styles,
      not in `theme.css`. The rule still applies — `theme.css` loads for every `web/` page.
      Do not move those declarations.
- [ ] Standing gate. Commit.

### Task 6 — `caret-color` · one commit

- [ ] Append to `engine/theme.css`:
      ```css
      input, textarea { caret-color: var(--ink); }
      ```
- [ ] Small win 18. `color-scheme` (Task 1) fixes most of this; this pins it.
- [ ] Standing gate. Commit.

---

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
wins. **Verify `.wz-radio input:focus-visible + span` (`web/wizard.html`) still applies** — it
does, on higher specificity, but check it rather than assume.

## Gate additions

- `render.py` is touched (Tasks 1, 2 — `:root` only). Regenerate; **`study-list.md` and the
  `<script id="data">` payload byte-identical.** `color-scheme` and `accent-color` change
  rendered appearance, so the **full output hash may move** — this is a phase licensed to
  change the output on purpose. Say so in the commit message. Record the new hash in
  `00-index.md` at the end of the phase.
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
- [ ] Native controls match the page in dark: the `<select>` on `/wizard`, the checkbox on
      `/wizard`, the caret in every textarea, the scrollbars, the picker `<dialog>` backdrop.
- [ ] **Light mode re-checked.** `color-scheme` changes every form control in *both* themes.
      Walk `landing.html`'s two forms and `admin.html` in light as well.
- [ ] **360px / 820px / 1440px, both themes, reduced-motion on.** With reduced motion the
      press feedback is instant — B3's press block is inside
      `@media (prefers-reduced-motion: no-preference)` and must stay there.
- [ ] `/edit` opened from `file://`.
- [ ] `git diff -U0 main -- engine/map-view.js | grep '^@@'` returns nothing.
