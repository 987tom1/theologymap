# P10 — The map itself (D1's licensed exception)

> **Read [`00-index.md`](00-index.md) first**, including **the seam rule**. It is the test
> every step in this phase must pass.

**Spec:** spec §5 D1 and §7 P10. **Detail:** `documentation/design-modern-feel.md` §7
(`:894-1114`) and B5.

**Goal:** The map becomes a place you are in, not a diagram you look at.

**Model:** **Opus / main session for step 3** (`_applyPanZoom` — the engine). **Sonnet for the
CSS steps**, spec quoted. **Depends on: P9. HARD BLOCK.**

---

## **Do not start this phase until P9 has landed.**

> **Do not hand-copy any of this into two files.** Touching lockstep-bearing code in two
> places by hand is how the fork got expensive.

If P9 has not landed, the only step here that is safe is step 1 — and P4 already shipped it.

## The seam rule — every step is tested against this one sentence

> **The canvas substrate is dimensional. Anything that contains the person's words is not.**

The map's *ground* recedes: a tinted background, an inset vignette, a grid that moves and
scales with the pan/zoom transform. The *tiles* stay paper: flat, warm, `--e1`, serif content,
**no glass, no glow, no gradient.** Edges, the grid and the ground are canvas furniture and
may be dimensional. **A node is a document and may not.**

**If a proposed effect puts depth, glow or gradient behind somebody's stated belief, it is
out.** No exceptions, no "just a subtle one".

## Steps, in order, each independently visible and revertable

1. **The reduced-motion guard on the existing `.mbox` transition.** Correctness — ship alone.
   **P4 Task 6 already did this**; if P4 landed first, tick it and move on.
2. **`vector-effect: non-scaling-stroke` on the edges.** One line, immediately visible at any
   zoom. Without it, edges render as 3.5px ropes at 2.5× and invisible threads at 0.3×.
3. **Grid coupling in `_applyPanZoom` — six lines, the big one, and Opus does it.**
   Today the dot grid is painted on `#mapwrap`, which never transforms, while `#mapPanZoom`
   scales inside it. So panning slides tiles across a **stationary** grid and zooming grows
   tiles over a **fixed** one. **The eye takes the grid as the world and the boxes as objects
   sliding on it, which is backwards.** Couple `backgroundSize` and `backgroundPosition` to
   the transform and the grid *becomes* the surface: it moves with your finger and its cells
   grow as you zoom.

   > This is the difference between "a diagram" and "a place", and it is **the single best
   > change in the design report.**

   The six lines are in design §7 *Depth* verbatim. Set `--zoom` on the pan/zoom element in
   the same function — step 4 needs it.
4. **Then, in this order, each its own commit:**
   - **Tile geometry and tier tint** — `--r3`, `--e1`, `--s3 --s4` padding, and the **7%
     `color-mix` tier surface tint** on `.mbox-leaf`. The tint is the important part: at 0.5×
     a 3px rail is 1.5 device pixels and the ramp disappears — exactly the zoom level where
     you most want to see the shape of your tiers. **Colour stays a redundant channel: the
     rail and the chip both stay.**
   - **`--zoom` detail fade** — `@property --zoom` and the `clamp()` opacity on `.mmeta`.
     Below ~0.55× the chips fade and you are looking at tier-tinted shapes and edges: a real
     overview. This is progressive disclosure driven by apparent size, which is what zoom
     means. **Container queries would not work** — the tile's *layout* width does not change
     with zoom, only its rendered size.
   - **Substrate vignette** — the `color-mix` ground colour, the inset shadow, `--r3` on
     `#mapwrap`, and the dark-mode variant. **Two stops, no gradient mesh, no glow.**
   - **Keyboard traversal and focus** — `tabindex="0"` on leaf and domain boxes (small win
     21: the product's centrepiece is not keyboard-reachable), arrow-key traversal off the
     tree `_buildTree` already builds, and **two different marks for two different states**:
     `outline` for focus, `box-shadow: var(--e2), inset 0 0 0 2px var(--ink)` for selection.
     **Do not overload the ring.**
   - **Leaf edges take the child's tier at `.45` opacity.** Domain edges stay `--line`.
     Zooming out then shows warm edges clustering on one side and cool on the other — the
     triage shape at a glance, which is the whole reason the ramp is monotone.

## Deliberately refused, and it must stay refused

> **Momentum/inertia on pointerup.** ~15 lines, and the kind of feel-improvement that turns
> into three sessions of tuning against two input devices. **Note it, do not build it** until
> the map is the app and the owner has lived with the rest.

Wheel-zoom damping (~10 lines, `requestAnimationFrame`) and a Travel transition on "Reset
view" are *make*, not refuse — but the reset transition must be **added only for the duration
of the reset and removed before the next drag.** A transition left on the pan element makes
dragging feel like syrup.

## Invariants — quote these

> **`#mapwrap`'s height comes from `sizeMap()`**, which measures the header's real
> `offsetHeight` rather than a hand-tuned `calc(100vh - Npx)`. The CSS constants stay as the
> no-JS fallback. **`sizeMap()` runs before `redrawMap()`** — the redraw centres against the
> wrap's height. (Step 4's vignette adds a `border-radius` and a background to `#mapwrap`;
> it must not touch its height.)

> **A framed map trims its own header.** … hiding the kicker, subtitle and tier legend and
> visually-hiding the `h1`, because `/view`'s own chrome carries all four.

> **`/view`'s Fullscreen is not the Fullscreen API.** iOS Safari has no `requestFullscreen()`
> on a non-video element. It is `body.tm-enlarged`. **It deliberately does not fix-position
> the iframe** — iOS Safari does not re-resolve the inner `100vh` against a fixed frame's new
> height.

> **Do not reintroduce traffic-light tier colours** — the earlier amber values failed contrast.
> (The 7% tint is `color-mix` off the existing ramp. Do not retune the ramp to make the tint
> read better.)

## Gate additions

- P9 made `map-view.js` the single source, so a change here reaches **both** the generated map
  and the editor. Regenerate; **`study-list.md` and the `<script id="data">` payload
  byte-identical**; the hash moves on purpose.
- **Contrast check the tier tint.** 7% of the ramp over `--panel` is still ~18:1 for `--ink`
  text — verify it rather than trusting the number, in **both themes**.

## Acceptance criteria

- [ ] **The grid moves with your finger and its cells grow as you zoom.** This is the phase's
      headline; if it does not read that way, nothing else in P10 matters.
- [ ] **The ground reads as recessed and every tile still reads as paper.** Hold the seam rule
      up against the finished screen. No depth, glow or gradient behind anyone's words.
- [ ] Edges are hairlines at 0.3× and at 2.5×.
- [ ] Below ~0.55× zoom the map is a legible overview of tier-tinted shapes; above it, detail
      returns. No flicker at the threshold.
- [ ] **The map is operable from a keyboard.** Tab reaches leaf and domain boxes; arrows
      traverse; focus and selection are visibly different marks.
- [ ] **Pan, zoom, pinch and detail-open re-verified by hand at 360px / 820px / 1440px**,
      both themes, reduced-motion on. **820px is the single-sided fallback** — the grid
      coupling must be right there too.
- [ ] Verified on **all three consumers**: `theology-map.html` from `file://`, `/thomas`
      framed in `/view`, and `/edit`'s Map tab.
- [ ] `prefers-reduced-motion: reduce` — the map is completely still. Reset view snaps rather
      than Travels; the detail fade is instant.
- [ ] `#mapwrap`'s height still comes from `sizeMap()`; the framed header still trims;
      `/view`'s Fullscreen still works on iOS.
