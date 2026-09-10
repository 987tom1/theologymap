# P11 — The commit moment, and cleanup

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply to every task here.

**Spec:** spec §7 P11. **Detail:** `documentation/design-modern-feel.md` B6 (`:700-735`) and
§5 small wins 4, 5, 11, 13, 14, 17, 19, 20, 21, 22.

**Goal:** The product's core loop is *answer a question → the map grows*, and today the growth
is invisible: a `POST /api/map` and a number on a launchpad you have already left. Give it one
orchestrated moment. Then sweep the residual small wins.

**Model:** Sonnet for the commit moment; **Haiku for the mechanical sweep**, file-disjoint.
**Depends on:** P8 and P10.

---

## Part 1 — the answer-commit beat

**Ship it in its tier-bar-only form first.** It is safe alone and it is most of the value.

The tier bar segments are already percentage-widthed `<span>`s (`wizard.html:226-227`), so:

```css
#home-tierbar { view-transition-name: tierbar; }
#home-tierbar .wz-seg { transition: width var(--dur-3) var(--ease-move); }
```

plus a `startViewTransition` wrapper around the existing commit path, with the
`prefers-reduced-motion` and no-support bail-outs. The bar **visibly advances by one belief.
Nothing else moves.** That is the Travel verb doing its whole job.

> This is the one place in the product where a single orchestrated motion is worth more than
> every hover transition combined, and it satisfies the "every animation must justify itself"
> rule on the strongest possible ground: **it is feedback for the product's primary action,
> currently absent.**

**Keep `#home-tiercounts` as the accessible channel.** The bar is presentational; the text
count is what a screen reader gets, and it must stay.

**With P10 landed**, the same beat can carry the node landing — siblings **Travel** to make
room, the new tile **Settles** (opacity + scale via `@starting-style`, never sliding in from
off-screen), the tier bar **Travels**, everything else **Holds**. `@starting-style` fires on
insertion only, so a tile already on the map when you pan does not re-animate — which is
exactly the **no motion on first paint** rule.

## Part 2 — the residual small wins

Each is independently shippable. Batch file-disjointly.

| # | Win | Files |
|---|---|---|
| 4 | **Scroll masks.** `theme.css:142-144`'s nav scrolls horizontally with no cue. `scrollbar-width: none` + a 24px `mask-image` fade. Same for `#sc-table-wrap` (`compare.html:28`) and `.views` (`render.py:528`). | `theme.css`, `compare.html`, `render.py` |
| 5 | `scrollbar-color: var(--field-line) transparent` on the two remaining scrolling containers. | `theme.css` |
| 11 | **Gallery empty state with an action.** `gallery.html:31` says "No public maps yet." and stops — the only thing on screen for a first visitor to an empty instance. Append the existing `buildPrimaryCard` at `:122`. | `gallery.html` |
| 13 | **Loading state that looks like loading.** `landing.html`'s Listing-status control mounts `disabled` saying "Checking whether your map is listed…" while looking like a live control. Give it `.tm-skel`. *(P1 Task 6 moved it out of the grid; this styles it.)* | `landing.html` |
| 14 | **`.tm-working` is half a state.** `theme.css:176` sets `opacity:.6; pointer-events:none`. Add `cursor: progress` and `aria-busy="true"` at the call site. | `theme.css` + call sites |
| 17 | **`field-sizing: content`** on `.wz-holdfield textarea` and the map's detail textareas — native auto-grow, replacing `map-view.js:246`'s `autosize()`. **Keep the JS as fallback until support is everywhere.** | `theme.css`, `map-view.js` |
| 19 | **The `:target` guard.** `render.py:420-422` animates an outline over 1.4s with **no `prefers-reduced-motion` guard**. Wrap it, or replace with a persistent `:target` outline plus a `--dur-2` fade-in. | `render.py` |
| 20 | **Dark `--note`.** `#2a2318` on `#15120d` is ~1.5:1. **Do not raise it — state in the sheet why the left rule is not optional in dark**, because it is the first thing a future round will try to simplify away. | `theme.css` (comment + rule) |
| 21 | **`.mbox` tab stop.** *(P10 does this. If P10 landed, tick it.)* | — |
| 22 | **Anchor positioning replaces `wizard.html:117`'s four hand-copied `padding-right: 88px` gutters** (`:117, 119, 153, 155`). `anchor-name` on `.wz-tools` + `position-area`, or a two-column grid on `.wz-card`. Not urgent — it is the tell that the layout has a hand-tuned constant where it should have a mechanism. | `wizard.html` |

## Invariants — quote per task

> **The quiet-surface rule** (`render.py:283-285`): a quiet surface must never appear without
> a rule and a label. `theme.css:55-62` complies. → win 20.

> **Only `_leafHeaderEditable`, `_leafMetaEditable` and `_leafDetail` may be touched** in
> `engine/map-view.js` … → win 17, **unless P9 has landed**, in which case the gate is retired
> and `map-view.js` is the single source. Check which world you are in before editing it.

> **`#home-empty` is deleted.** Do not re-add a second empty-state home. → win 11 touches
> `gallery.html`'s empty state, which is a **different** thing. Do not let it grow into a
> second home.

> **`.tm-main` in `web/view.html` carries `width: 100%; box-sizing: border-box`.** → win 4
> touches `render.py:528`'s `.views`, inside the framed document.

## Gate additions

- Wins 4 and 19 touch `render.py`. Regenerate; **`study-list.md` and the `<script id="data">`
  payload byte-identical**; the hash moves on purpose.

## Acceptance criteria

- [ ] **Answering a question visibly advances the tier bar by one belief, and nothing else
      moves.** One thing at a time — that is the rule and this is the test of it.
- [ ] `#home-tiercounts` still reads the counts aloud. The bar is not the accessible channel.
- [ ] **`prefers-reduced-motion: reduce`: the commit beat does not animate**, and the
      `:target` flash in the generated map does not either. Win 19 closes the last unguarded
      animation in the repo.
- [ ] Every horizontally scrolling container has a visible cue at 360px.
- [ ] `/gallery` on an empty instance offers an action, not a full stop.
- [ ] The Listing-status control reads as loading while it is loading.
- [ ] `field-sizing` auto-grow works where supported and the JS fallback still works where it
      is not. **Test both** — disable the CSS feature or check a browser without it.
- [ ] The four 88px gutters are gone and `.wz-tools` still does not overlap the flow content
      at **360px, 820px and 1440px**. This one is a layout change wearing a cleanup's clothes;
      check it at all three widths and both themes.
- [ ] Standing gate green; `study-list.md` and the data payload byte-identical.
- [ ] **360px / 820px / 1440px, both themes, reduced-motion on**, every touched surface.
