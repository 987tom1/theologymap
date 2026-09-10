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

---

# Step detail — expanded 2026-09-11, session B

Re-read against the tree at `a9e99f0`, post-P1/P2/P3 **and post-P4**. Locate targets by
selector or function name; the phase file's line numbers pre-date P1.

**Current line numbers, verified:** `showScreen` `wizard.js:253-263`; `select()` `:434-444`;
the position loop `:493-545` (the 5-row textarea at `:513-518`); the open tile `:546-560`;
`buildCustom` `:570-631`; `currentAnswer` `:926-957`. `.wz-nav` markup `wizard.html:362-365`,
its rule `:208`; `#custom-answer` markup `:338-342`; `.wz-screen-body` `:49`.

## Cascade note for this phase

Every rule P5 adds goes in **`web/wizard.html`'s own `<style>`**, which is the last stylesheet
on that page — nothing here needs to beat a shared rule, and nothing here belongs in
`theme.css`. `.wz-nav` and `.wz-hold` are wizard-only selectors. No `theme.css` edit in P5.

## Task 1 — `.wz-nav { position: sticky; bottom: 0 }`

Ship alone, look at it, then continue. It may be most of the fix.

- [ ] Extend the existing `.wz-nav` rule in `web/wizard.html:208` (do not add a second one) with
      F3's block:
      `position: sticky; bottom: 0; z-index: 30;`
      `margin: 2px -18px -36px;`
      `padding: 10px 18px calc(10px + env(safe-area-inset-bottom, 0px));`
      `background: color-mix(in srgb, var(--bg) 88%, transparent);`
      `backdrop-filter: blur(6px);`
      `border-top: 1px solid var(--line);`
- [ ] **Ruling on "snap the pixel values to P2's spacing scale":** the horizontal `-18px` and
      the `-36px` bottom are **not free to move** — they exist to cancel
      `.wz-screen-body { padding: 22px 18px 36px }` (`wizard.html:49`) so the bar bleeds to the
      body edge, and they must equal that padding exactly. Snapping them to `--s4`/`--s6` breaks
      the bleed by 2px and 4px. **Snap only the vertical padding** (`10px` → `var(--s3)`) and
      leave the two bleed values numeric **with a comment saying they are bound to
      `.wz-screen-body`'s padding, not to the scale.** P7 owns the spacing pass; if it retunes
      that padding it must retune these with it.
- [ ] `z-index: 30` is below `.wz-pop`'s `z-index: 40` (`wizard.html:140`) on purpose — the
      Read-more popover must still cover the nav. Verify both numbers by reading; do not raise
      30.
- [ ] `#screen-question` uses the plain `.wz-screen-body`, not `.wz-narrow`/`.wz-wide`, so the
      22/18/36 padding above is the one in force. Confirm that before trusting the margins.
- [ ] **1440px is safe by construction, but check it anyway:** `.wz-screen-body` is
      `max-width: 760px; margin: 0 auto`, so the sticky bar is 760px wide and centred, never a
      full-width bar over the reading measure. State that derivation in the commit message —
      the criterion exists because 1440px has shipped two bugs.
- [ ] `backdrop-filter` is a progressive enhancement; the `color-mix` background at 88% is
      already opaque enough to read against without it. No fallback needed, no `@supports`.
- [ ] **Measure and record.** Before the change and after, at 360px, capture
      `document.getElementById('screen-question').scrollHeight` (or the body's) on a
      three-position doctrine and on a six-position one. **Put both numbers in the commit
      message** — the acceptance criterion asks for them explicitly.
- [ ] With P4 landed, `.wz-nav` already carries `view-transition-name: q-nav`. A sticky element
      that is also a named group **holds still across a question change — that is the intended
      effect and the clearest instance of Hold in the product.** Do not tune it away, and say so
      in the commit message so a later reader does not.
- [ ] Standing gate. Own commit.

## Task 2 — Build `#custom-answer` lazily

- [ ] `web/wizard.html:338-342`: turn `#custom-answer` into a disclosure —
      `<details id="custom-answer" class="wz-card optional">` with
      `<summary><strong>My view is not one of these</strong></summary>` and the existing
      `.wz-hint` plus `#custom-fields` as the body. Keep `#custom-answer { position: relative }`
      (`:161`).
- [ ] `web/wizard.js`: `buildCustom(doctrine)` keeps its body **unchanged**, but is called from
      a one-shot `toggle` listener instead of unconditionally from `renderQuestionUnsafe`
      (`:557`). On the question render, only reset the tile: `card.classList.remove('sel')`,
      `card.open = false`, `$('custom-fields').textContent = ''`, and arm the listener.
- [ ] Expanding the tile **is** choosing it: on `toggle` with `card.open === true`, build the
      fields if they are not built, then run the existing `pick()`. Closing it selects nothing
      and clears nothing — `select()` on another card already removes `.sel` and empties every
      `.wz-slot`.
- [ ] **Rebuild the radio groups as real radios.** `buildCustom` already calls `radioGroup()`,
      which builds `<input type="radio">` and sets `role="radiogroup"` on the wrapper. Do not
      touch that function and do not hand-roll `role="radiogroup"` — *tier and confidence stay
      real `<input type="radio">` on both surfaces.*
- [ ] **`#custom-answer` is the only tile with a `precomputed` control state** (`select()`'s
      sixth argument, `wizard.js:434`/`:626`), so `controls` is set directly from `state` and
      the selection path is unaffected by *when* `state` came into existence. Re-read both call
      sites and confirm that before shipping.
- [ ] **Toggle by attribute, never by a same-selector `display` rule.** `web/wizard.html`
      carries one global `[hidden] { display: none !important }` as the root-cause fix; a new
      `display` rule on `#custom-answer` would resurrect the whole class of bug. Here the
      mechanism is `<details open>`, which needs neither.
- [ ] **Data safety.** `currentAnswer()`'s custom branch reads `controls.hold/.why/.vs/.todo/
      .refs/.links/.tier/.confidence/.study`. It is only reachable when `chosen.kind ===
      'custom'`, which only `pick()` sets, which now only runs after the build. Trace that and
      say so. Nothing in `applyAnswer`'s revisit chain reads these controls — it reads the saved
      `answer`, and the fallback chain `answer.x !== undefined ? answer.x : (prev.x || …)`
      is untouched. **Do not reorder `prev.x ||` ahead of the `!== undefined` test.**
- [ ] Note for the record, not a regression to fix here: `buildCustom` prefills nothing from
      `existingNode(doctrine)` today, so a revisited custom answer already shows an empty tile.
      Lazy building must not make that *worse*; it is not licensed to make it better.
- [ ] `node --test tests/*.test.js` is a real gate here — `wizard-generate.test.js` has caught
      this exact class of mutation before. Then the rest of the standing gate. Own commit.

## Task 3 — Swap unselected positions to a `<p>`

- [ ] `web/wizard.js`, the position loop (`:493-545`). Replace the eager
      `.wz-holdfield` + `<textarea rows=5>` with `el('p', 'wz-hold', position.hold || '')`
      appended straight to the card — **not** inside a `.wz-holdfield`. The bordered box is what
      makes an unpicked choice read as a form field, and removing it is the point of the task.
- [ ] Rewrite `pick()` to materialise on demand, keeping the existing guard:

      ```js
      let holdEl = el('p', 'wz-hold', position.hold || '');
      let area = null;
      card.appendChild(holdEl);
      const pick = () => {
        if (chosen && chosen.position === position) return;
        if (!area) {
          area = el('textarea');
          area.rows = 5;
          area.value = position.hold || '';
          area.addEventListener('input', pick);
          const box = el('div', 'wz-holdfield');
          box.appendChild(area);
          holdEl.replaceWith(box);
          holdEl = box;
        }
        select(card, 'position', doctrine, position, area);
      };
      ```

- [ ] **Do not autofocus `area` after the swap.** On a phone that throws the keyboard up over
      the choice the person just made. F3 says so explicitly. The old `area.addEventListener(
      'focus', pick)` may stay on the created textarea (it is harmless and covers tab-in), but
      nothing calls `.focus()`.
- [ ] The revisit preselect at the foot of the loop currently calls
      `select(card, 'position', doctrine, position, area)` directly. **It must call `pick()`
      instead**, or `chosen.hold` is `null` and `currentAnswer()`'s `chosen.hold.value`
      (`wizard.js:955`) throws on a revisited question. This is the one line in P5 that can
      break saving; verify it by revisiting a real answered question.
- [ ] Leave the `CompareCore.normalise(existing.hold) === CompareCore.normalise(position.hold)`
      match untouched — it reads `position.hold` from the corpus, never the DOM.
- [ ] Add `.wz-hold` to `wizard.html`'s `<style>`, immediately after `.wz-holdfield textarea`
      so the two stay adjacent: `margin: 0; font: 14.5px/1.55 var(--serif); color: inherit;`
      — **the same font as `.wz-holdfield textarea`**, so the swap does not reflow the text.
- [ ] `ponytail:` a card that was selected and then deselected keeps its textarea rather than
      reverting to a `<p>`. Deliberate — reverting costs a second code path for at most one
      card per question, and the initial paint (the thing the phase measures) is already down
      by every unselected position. Mark it with a `ponytail:` comment naming that ceiling.
- [ ] **The invariant this task is most likely to be misread against:** *the position's own
      description **is** the editable `hold` field — there is no second "What I hold" box any
      more.* The `<p>` ⇄ textarea swap keeps exactly that: one field, and it is the description.
      This is **not** a reversal. What changes is what an *unselected* position looks like
      before you pick it.
- [ ] Re-measure at 360px and put the number in the commit message alongside Task 1's.
- [ ] `node --test tests/*.test.js`, then the rest of the standing gate. Own commit.

## Verification to batch for Thomas

Widths **360 / 820 / 1440**, both themes, reduced-motion on for one pass.

1. **360px, three-position doctrine and six-position doctrine** — Next reachable without
   scrolling, both times.
2. **1440px** — the sticky nav stays inside the 760px measure and does not become a full-width
   bar. This is the width class that has shipped two bugs.
3. **Selection round trip** — pick a position, edit its textarea, Next, Back. What you wrote is
   still there. Then pick a *different* position on the same question and Next/Back again.
4. **Custom answer** — expand `#custom-answer` on a fresh question, fill it, Next; then Back.
   Then expand it, collapse it, pick a position instead, and Next — the position must be what
   saves.
5. **Phone keyboard** — on a real phone, tapping a position must **not** raise the keyboard.
6. **With P4** — Next/Back with motion on: the sticky nav holds still.
