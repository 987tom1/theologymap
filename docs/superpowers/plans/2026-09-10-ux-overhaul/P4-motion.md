# P4 — Motion

> **Read [`00-index.md`](00-index.md) first**, including **the motion vocabulary** — the four
> verbs and the written rules for when nothing moves. They are the acceptance criteria here,
> not background reading.

**Spec:** spec §7 P4. **Mechanisms:** `documentation/ux-firstprinciples-constrained.md`
§4.1–4.6 (`:627-789`). **Grammar:** `documentation/design-modern-feel.md` B4 and §6.

**Goal:** Every change of state becomes attributable to the tap that caused it. Four native
mechanisms, no dependencies, all degrading to today's behaviour where unsupported.

**Model:** Sonnet, **with spec §7 P4 and the vocabulary quoted verbatim in the prompt.**
**Depends on:** P3. **Blocks:** P5, P6.

---

## Tasks, in this order — Task 1 is a thirty-second test of the whole approach

1. **Cross-document view transitions, alone.** `@view-transition { navigation: auto }` plus
   `.tm-chrome { view-transition-name: tm-chrome }` and the reduced-motion `::view-transition-*`
   guard, in `engine/theme.css`. **Deploy this alone and look at it before writing any other
   task in this phase.** If the header morph does not read right, the rest of P4 is wrong and
   this is the cheapest possible place to find that out. Firefox has no cross-document view
   transitions today and gets exactly the current behaviour.
2. **The global reduced-motion guard** — constrained §4.5, as the **last rule in
   `theme.css`**. It is the backstop for anything hard-coding a duration; P2's zeroed tokens
   are the primary guarantee.
3. **Same-document view transitions** — `startViewTransition` around `showScreen`
   (`wizard.js:262-272`), plus Hold on `#q-title`, `#wz-crumb` and `.wz-nav`.
   **Note the line that disappears:** `if (chromeEl) chromeEl.hidden = q;`. **P6 removes it.**
   If P6 has not landed yet, leave it and let P6 delete it — do not remove the chrome-hiding
   here, that is P6's reversal of a documented decision and it needs P6's verification.
4. **`::details-content` + `interpolate-size`** — constrained §4.3. `#q-readmore`, `#who`,
   `#custom-answer`'s Advanced, `.cmp-row`, `.cmp-acc`. Where `::details-content` is
   unsupported the rules drop and the disclosure snaps exactly as it does now.
5. **`@starting-style`** — constrained §4.4. The injected `.wz-slot` controls and the
   `.wz-pop` Read-more popover **Settle**: opacity + ≤8px translate toward final position.
6. **The reduced-motion guard the map's `.mbox` transition lacks.** `prefers-reduced-motion`
   is currently honoured in exactly one place in the repo (`gallery.html:20`), and the map's
   280ms transform transition is **the only substantive motion in the product**. This is
   correctness, and it is the one P4 task that touches the map.

## The directional variant — take design B4's numbers, not constrained §4.2's

Constrained §4.2 offers optional directional keyframes at `.22s` and a **24px** translate.
**Against the P2 tokens that becomes `var(--dur-2)` and 12px**, per design B4:

> 12px, not 24. A view transition is already communicating direction through the crossfade;
> the translate is a hint, and 24px at 200 ms reads as a slide, which is a heavier gesture
> than a question change deserves.

Ship the plain crossfade first. Add the directional variant only if the crossfade reads as
too soft, and look at it on a real phone before keeping it.

## Deliberately not doing — spec and both reports agree

- **No scroll-driven animations.** A scroll-linked progress bar on the question screen is
  achievable with `animation-timeline: scroll()` and no JS, and it is ornament: the crumb
  already says "question 12 of 86" and P5 is about *removing* scroll, not decorating it.
- **No page-load spinner.** P8 asks for skeletons, which show the *shape* of what is coming.
- **No animation of the map canvas beyond Task 6's guard.** That is P10, and it is blocked
  on P9.

## The invariant Task 6 is governed by — quote it

> Only `_leafHeaderEditable`, `_leafMetaEditable` and `_leafDetail` may be touched in
> `engine/map-view.js`. … The merge gate is
> `git diff -U0 main -- engine/map-view.js | grep '^@@'` showing hunks in those three
> functions and nowhere else.

Task 6 is a **CSS** guard. Add it in the stylesheet, not by editing a lockstep-bearing
function. If the `.mbox` transition is declared inside `render.py`'s embedded stylesheet and
`engine/theme.css` separately, both need the guard — and the `render.py` half is a
byte-identity event.

## Accepted risk, already decided (spec §9)

> **`@view-transition` also reaches `/edit`**, the offline tool's file. Harmless — single
> page, no navigations from within it — but **confirmed as accepted**, and the offline
> `file://` path is unaffected either way.

Do not re-open this. It was decision 4 in the constrained report's §7 and it is settled.

## Gate additions

- If `render.py`'s embedded stylesheet gains the `.mbox` guard: regenerate; **`study-list.md`
  and the `<script id="data">` payload byte-identical**; the full hash may move, on purpose.

## Acceptance criteria

- [ ] **`prefers-reduced-motion: reduce` produces a completely still product.** Walk every
      page with it on. Nothing moves, nothing fades, nothing scales — including the map's
      `.mbox`, which today is unguarded. This is the single most important criterion in P4.
- [ ] Page-to-page navigation morphs the header rather than flashing white — `/` → `/learn` →
      `/gallery` → `/compare` → `/view`.
- [ ] Next → next question morphs the title in place. **`#q-title`, `#wz-crumb` and `.wz-nav`
      conspicuously do not move.** That stillness *is* the effect; the crossfade underneath is
      almost incidental.
- [ ] Every disclosure opens to its natural height instead of snapping.
- [ ] Injected answer controls Settle rather than appearing.
- [ ] **No motion on first paint** on any page. A staggered entrance on page load is the
      generated-UI signature and it must not appear.
- [ ] **360px / 820px / 1440px, both themes.** Look at the question transition **on a real
      phone** — a desktop emulation does not tell you whether 200ms reads as immediate.
- [ ] `/edit` opened from `file://` and once hosted.
- [ ] `git diff -U0 main -- engine/map-view.js | grep '^@@'` returns nothing.

---

# Step detail — expanded 2026-09-11, session B

Line numbers below were re-read against the tree at `a9e99f0`, post-P1/P2/P3. **Locate every
target by selector or function name, not by line number** — P1–P3 already moved several.

## Cascade derivation for this phase (required reading — session A shipped an inert fix here)

Every `web/*.html` page links `theme.css` **before** its own `<style>`; `engine/editor.html`
links it **after** (`engine/editor.html:289`, after the `<style>` at `:16`). So a `theme.css`
rule at equal specificity **loses** to a `web/` page and **wins** in the editor.

Derived, declaration by declaration, for what P4 adds:

| New rule | Rival declaration anywhere? | Which wins, and why |
|---|---|---|
| `@view-transition { navigation: auto }` | none — at-rule, no selector | n/a |
| `.tm-chrome { view-transition-name: tm-chrome }` | `view-transition-name` is declared **nowhere** in the repo today (grep it before you write it) | uncontested |
| `::view-transition-*` reduced-motion guard | none | `animation: none !important` — wins on **importance**, load order irrelevant |
| `*, *::before, *::after` reduced-motion backstop (Task 2) | every hard-coded duration in the repo, incl. `engine/editor.html:151` `.mbox { transition: transform .28s ease }` and `:167` `.mchev` | **`!important` on each declaration** — wins on importance in **both** load orders. This is the only rule in P4 that must beat a page, and it does not depend on presence or order. |
| `:root { interpolate-size: allow-keywords }` | `editor.html:18-27` inline `:root` declares tokens only, not `interpolate-size` | uncontested. Use **plain `:root`**, not `:where(:root)` — the `:where` wrapper exists so `editor.html` stays the owner of *token values*; `interpolate-size` is not a token and has no second copy. |
| `details.optional::details-content`, `.cmp-row::details-content`, `.cmp-acc::details-content` | no page declares any `::details-content` rule | uncontested. `.cmp-row`/`.cmp-acc`'s own rules live page-local in `web/compare.html:40,79` and set no `block-size` on the pseudo. |
| `.wz-slot > *`, `.wz-pop` transition + `@starting-style` (Task 5) | goes in **`web/wizard.html`'s own `<style>`**, page-local, where `.wz-slot`/`.wz-pop` already live (`:157-159`, `:139-140`) | same file, later in the block — no cross-file contest at all |
| `#q-title` / `#wz-crumb` / `.wz-nav` `view-transition-name` (Task 3) | none | uncontested; page-local in `wizard.html` |

**Nothing in P4 relies on a `theme.css` rule beating a `web/` page on presence.** If a step
you are about to write does, stop and re-derive it.

## Task 1 — Cross-document view transitions, alone

- [ ] Append a new commented section to **`engine/theme.css`**, after the dark-elevation block
      and the `input, textarea { caret-color }` line, i.e. at the end of the file **but leaving
      room below it for Task 2's guard, which must be last**:
      `@view-transition { navigation: auto; }` /
      `.tm-chrome { view-transition-name: tm-chrome; }` /
      `@media (prefers-reduced-motion: reduce) { ::view-transition-group(*),
      ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; } }`
- [ ] Comment in place that exactly one `.tm-chrome` exists per document (`web/chrome.js`'s
      `mount()` replaces `#tmChrome` with a single `header.tm-chrome`), which is what keeps the
      name unique — a second one on any page silently disables the whole transition.
- [ ] `engine/editor.html` has **no** `.tm-chrome` (its header is `#editorToplinks`'s own
      markup), so `/edit` gets `@view-transition` with no named group. That is the accepted
      risk in the phase file. Do not add a name there.
- [ ] `engine/render.py`'s output does **not** link `theme.css` and is untouched by this task.
      No regeneration, no hash event.
- [ ] Standing gate. Commit **this task alone**, message naming it as the thirty-second test.

## Task 2 — The global reduced-motion guard, last rule in `theme.css`

- [ ] Append constrained §4.5 verbatim as the **final rule in `engine/theme.css`**, with a
      comment saying it is a backstop for hard-coded durations and that **P2's zeroed
      `--dur-1/2/3` are the primary guarantee** — any rule reading those tokens is already
      guarded by construction.
- [ ] **Do not add a per-rule `@media (prefers-reduced-motion)` anywhere in this phase.** One
      backstop plus P2's tokens is the whole mechanism. A per-rule copy is the thing that rots.
- [ ] This covers `web/*.html` and `engine/editor.html` (both link `theme.css`; `!important`
      wins either order). It does **not** reach `engine/render.py`'s self-contained output —
      that is Task 6, and it is the only reason Task 6 exists.
- [ ] Verify `gallery.html:20`'s existing skeleton guard still behaves (it is a
      `prefers-reduced-motion` block of its own and is not in conflict).
- [ ] Standing gate. Own commit.

## Task 3 — Same-document view transitions around `showScreen`

- [ ] `web/wizard.js`, `showScreen(name)` (currently `:253-263`). Extract the existing body
      verbatim into `const paint = () => { … }` and return `paint()` when
      `!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches`,
      else `document.startViewTransition(paint)`.
- [ ] **Change nothing inside the body.** `window.scrollTo(0, 0)` stays inside `paint` — it
      must happen inside the snapshot or the transition captures the wrong scroll position.
- [ ] **Keep `if (chromeEl) chromeEl.hidden = q;`.** P6 Task 3 deletes it. Do not remove it
      here; that is P6's reversal of a documented decision and it needs P6's verification.
- [ ] **Expected P4-only artifact, do not "fix" it:** while that line survives, `.tm-chrome` is
      a named group that exists in the old snapshot and not the new one when you enter a
      question, so the chrome fades rather than Holding. P6 removes the cause. Say so in the
      commit message so the next reader does not chase it.
- [ ] `web/wizard.html` own `<style>`: `#q-title { view-transition-name: q-title; }`,
      `#wz-crumb { view-transition-name: q-crumb; }`, `.wz-nav { view-transition-name: q-nav; }`.
- [ ] **Hold is the acceptance criterion.** Those three conspicuously not moving *is* the
      effect; the crossfade underneath is incidental.
- [ ] **Ship the plain crossfade. Do not add the directional keyframes.** If it reads too soft
      on a real phone, the variant is design B4's numbers — `var(--dur-2)` and **12px**, never
      constrained §4.2's `.22s` and 24px — and it is a separate decision after a look.
- [ ] Standing gate, `node --test tests/*.test.js` especially. Own commit.

## Task 4 — `::details-content` + `interpolate-size`

- [ ] `engine/theme.css`, in P4's section: `:root { interpolate-size: allow-keywords; }` (plain
      `:root`, per the derivation table above).
- [ ] Then the pseudo-element rules, **using P2's tokens, not `.25s ease`** — design B4's
      coordination note is explicit that constrained §4.3's hard-coded values are superseded:
      `transition: block-size var(--dur-2) var(--ease-out), content-visibility var(--dur-2) allow-discrete;`
      with `block-size: 0; overflow: clip;` closed and `block-size: auto` on `[open]`.
- [ ] Selector list is `details.optional::details-content, .cmp-row::details-content,
      .cmp-acc::details-content`. Confirm by grep that this covers all five named targets:
      `#q-readmore` (`wizard.html:330`, `class="optional"`), `#who` (`:356`, `class="optional"`),
      `#custom-answer`'s Advanced (`wizard.js` `buildCustom`, `el('details', 'optional')`),
      `.cmp-row` and `.cmp-acc` (`web/compare.html`).
- [ ] `theme.css:200`'s `details.optional[open] > summary::before` triangle rotation already
      transitions; retime it to `--dur-1` if it is not already on a token (design §6 maps it as
      Tint). Check before editing — P3 may have done it.
- [ ] `overflow: clip` risk check: nothing absolutely positioned escapes any of these five.
      `.wz-pop` is appended to `.wz-card`, not inside a `<details>` (`wizard.js`'s
      `readMoreButton` hosts on the card — the comment there says why). Verify by reading, then
      say so.
- [ ] Where `::details-content` is unsupported the rules drop and the disclosure snaps exactly
      as today. No JS fallback, no measured pixel heights.
- [ ] Standing gate. Own commit.

## Task 5 — `@starting-style` for the injected controls and the popover

- [ ] `web/wizard.html` own `<style>`, next to the existing `.wz-slot` / `.wz-pop` rules:
      `.wz-slot > *, .wz-pop { opacity: 1; translate: 0 0; transition: opacity var(--dur-2)
      var(--ease-out), translate var(--dur-2) var(--ease-out); }` then
      `@starting-style { .wz-slot > * { opacity: 0; translate: 0 -6px; } .wz-pop { opacity: 0;
      translate: 0 -8px; } }`.
- [ ] Both are **Settle**: opacity + ≤8px translate **toward** final position. 6px and 8px are
      inside the ceiling; do not raise them.
- [ ] **Do not re-add constrained §4.4's second block** — the
      `.wz-card, .lens, .wz-qrow, .lp-row, .tm-card` transition it prescribes **already
      shipped in P3**, in `engine/theme.css`'s press-feedback block (`transition: border-color
      var(--dur-1) …` under `@media (prefers-reduced-motion: no-preference)`). Read it, confirm
      it, and add nothing. A second copy at different durations is exactly the "twelve
      animations that each looked fine alone" failure design §6 is written against.
- [ ] **No motion on first paint** — verify structurally, not by eye: `.wz-slot` is empty in
      the markup and populated only by `select()`, and `.wz-pop` does not exist until
      `readMoreButton`'s handler runs, so `@starting-style` cannot fire on load. State that in
      the commit message.
- [ ] Standing gate. Own commit.

## Task 6 — The reduced-motion guard `render.py`'s output lacks

This is the one hash-moving task in P4 and the one that touches the map's surface.

- [ ] **Root cause, one guard, not five.** `engine/render.py`'s embedded stylesheet
      (`<style>` at `:277` to `</style>` at `:662`) honours `prefers-reduced-motion` **nowhere**,
      and it hard-codes four animations: `.mbox { transition: transform .28s ease }` (`:521`),
      `.mchev { transition: transform .15s ease }` (`:540`), `.group > h2 .chev` (`:427`) and the
      `@keyframes flash` `:target` outline (`:494-496`). Append **one** copy of the same
      `*, *::before, *::after` guard as Task 2 as the **last rule before `</style>`** — after the
      closing `}` of the `@media print` block. That covers all four at once.
- [ ] **Do not edit `engine/map-view.js`.** This is a CSS guard. `engine/editor.html`'s own
      `.mbox` copy (`:151`) needs **no** edit either — it links `theme.css` and Task 2's guard is
      `!important`. Confirm that by reading `editor.html:289`'s link position, and say so.
- [ ] Lockstep gate, in the session-base form (the plan's `main`-relative form is vacuous while
      executing on `main`): `git diff --stat a9e99f0..HEAD -- engine/map-view.js` must be
      **empty**. P9 has not landed.
- [ ] Regenerate: `py engine/render.py`. **Never hand-edit the generated file to make a hash
      match.**
- [ ] Byte-identity, both invariants, before committing:
      `git diff --stat -- documentation/study-list.md` empty, and the embedded
      `<script id="data">` payload (`4d8d919e…c8bd7e`) unchanged — extract it from
      `theology-map.html` and hash it, do not eyeball it.
- [ ] `git diff --stat` **before** commit. A diffstat much larger than the change is a
      line-ending rewrite.
- [ ] **The full-output hash is licensed to move here.** Compute both forms — CRLF as written on
      Windows, and LF-normalised — and write the new pair into **both**
      `docs/superpowers/plans/2026-09-10-ux-overhaul/00-index.md`'s baseline table (a new
      `post-P4` row, marked read-against) **and `CLAUDE.md` §1** `:63-68`, **in this same
      commit**. That pair went stale for several commits because nobody did this.
- [ ] Standing gate incl. `py tests/check_generated_map.py`. Own commit.

## Verification to batch for Thomas (browser passes are his)

Grouped so one walk covers several criteria. Widths **360 / 820 / 1440**, both themes.

1. **Reduced-motion on, every page** — `/`, `/wizard` (question screen, next/back), `/learn`,
   `/gallery`, `/compare`, `/view`, `/edit`, and a generated map opened from `/view`'s iframe
   **and** double-clicked from disk. Nothing moves, nothing fades, nothing scales. The map's
   `.mbox` especially — it was unguarded until Task 6, and the double-clicked file is the only
   surface Task 2 does not reach.
2. **Reduced-motion off, page to page** — `/` → `/learn` → `/gallery` → `/compare` → `/view`.
   The header should morph, not flash white. Firefox gets today's behaviour; that is expected.
3. **Reduced-motion off, question to question** at 360px **on a real phone** — Next, then Back.
   Watch `#q-title`, `#wz-crumb` and `.wz-nav`: they must be nailed in place. Expect the chrome
   to fade on entering a question until P6 lands.
4. **Disclosures** — `#q-readmore`, `#who`, `#custom-answer`'s Advanced, and `/compare`'s
   `.cmp-row` / `.cmp-acc`. Each opens to its natural height rather than snapping.
5. **Injected controls** — pick a position, watch `.wz-slot`; tap Read more, watch `.wz-pop`.
   Both Settle downward into place. Then reload each page and confirm **nothing** animates on
   arrival.
