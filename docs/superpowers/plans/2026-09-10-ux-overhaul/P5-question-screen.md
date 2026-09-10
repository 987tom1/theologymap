# P5 — The question screen

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply to every task here.

**Spec:** spec §7 P5. **Detail:** `documentation/ux-firstprinciples-constrained.md` F3
(`:351-401`) and §2's measurement (`:77-132`).

**Goal:** The question screen is **2.4 usable screens tall** (3.3 on six-position doctrines)
and its primary action is at the bottom. The person must traverse the entire decision space
*after* deciding, on every one of 86 turns. **That is the mechanical source of "clunky" — the
taps are already minimal, the travel is not.**

**Model:** Sonnet, spec section quoted. **Depends on:** P4. **Blocks:** nothing.

---

## Three tasks, in this order, each independently revertable

1. **`.wz-nav { position: sticky; bottom: 0 }`** — one CSS rule, and **it may be most of the
   fix**. Ship it alone and live with it before doing anything else in this phase. F3 gives
   the full rule including the negative margins that cancel `.wz-screen-body`'s 18/36 inset,
   the `env(safe-area-inset-bottom)` padding, and the `color-mix` + `backdrop-filter` ground.
   Snap the pixel values to P2's spacing scale.
2. **Build `#custom-answer` lazily.** `buildCustom()` (`wizard.js:574-635`) renders a hold
   textarea, two radio groups, a `#study` checkbox and a five-field Advanced disclosure
   *before anyone has chosen it* — ~400px of form, on all 86 questions, for the minority case
   it serves. Build on first expand. It is already the only tile with a `precomputed` control
   state (`wizard.js:451`, `:630`), so the selection path is unaffected.
3. **Swap unselected positions to a `<p>`.** Every unselected position currently renders a
   live 5-row textarea (`wizard.js:513-518`), so three choices each look like a form field and
   the screen reads as "fill in three essays" rather than "pick one". Render an unselected
   `hold` as `<p class="wz-hold">` and swap for the textarea inside `select()`.

## The interaction with P4 — look at this once on a real phone

A sticky `.wz-nav` that is **also a named view-transition group** (P4 Task 3) holds still
across a question change. **That is the intended effect.** It is the clearest instance of the
Hold verb in the product and it is the thing most likely to be tuned away by somebody who
does not know it was deliberate.

## The invariant Task 3 is governed by — quote it, it is the one most likely to be misread

> **The position's own description *is* the editable `hold` field — there is no second "What
> I hold" box any more.**

The `<p>` ⇄ textarea swap **keeps exactly that**: one field, and it is the description. This
is not a reversal. What it changes is what an *unselected* position looks like before you
pick it.

Also:

> **Tier and confidence stay real `<input type="radio">` on both surfaces.** Do not hand-roll
> `role="radiogroup"`. (Task 2 rebuilds those groups lazily — rebuild them as real radios.)

> **Any pane hidden by the `hidden` attribute needs its own `[hidden]` override if it also
> carries an author `display` rule on the same selector.** `web/wizard.html` carries one
> global `[hidden] { display: none !important }` as the root-cause fix. (Tasks 2 and 3 both
> toggle visibility — use the attribute, and do not add a same-selector `display` rule.)

**Do not autofocus the textarea after the swap.** On a phone that throws the keyboard up over
the choice the user just made. F3 says so explicitly.

## Data-safety check for Tasks 2 and 3

These tasks change *when* controls exist, and the revisit path reads them. Before shipping,
re-read this invariant and confirm the tasks do not disturb it:

> **`applyAnswer`'s revisit rebuild preserves the person's own writing.** Every fallback chain
> is `answer.x !== undefined ? answer.x : (prev.x || <corpus default> || '')` … **Do not
> reorder `prev.x ||` ahead of the `!== undefined` test** — `tests/wizard-generate.test.js`
> pins both halves precisely because a mutation that did so passed every other test.

A control that no longer exists at read time must not be read as `undefined` where it
previously read as an empty string. **`node --test tests/*.test.js` is the gate and it is a
real one here** — `wizard-generate.test.js` has caught exactly this class of mutation before.

## Acceptance criteria

- [ ] **Next is reachable without scrolling** on a 360px phone, on a three-position doctrine
      and on a six-position one.
- [ ] The screen's total height is materially down. Measure it before and after and put both
      numbers in the commit message.
- [ ] Choosing a position still works; **revisiting a question still shows what you wrote**,
      including on a custom answer and on a position whose textarea you edited.
- [ ] `#custom-answer` still selects correctly on first expand and on revisit.
- [ ] **No autofocus after the swap.** On a phone, picking a position does not raise the
      keyboard.
- [ ] `node --test tests/*.test.js` green — `wizard-generate.test.js` especially.
- [ ] **360px / 820px / 1440px, both themes, reduced-motion on.** At **1440px** the sticky nav
      must not become a full-width bar floating over a 1080px reading measure — check it, this
      is the width class that has shipped two bugs.
- [ ] With P4 landed: the sticky nav **holds still** across a question change.
- [ ] `git diff -U0 main -- engine/map-view.js | grep '^@@'` returns nothing.
