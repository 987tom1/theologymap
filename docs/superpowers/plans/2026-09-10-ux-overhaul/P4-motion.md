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
