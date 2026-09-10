# P9 — The map-view unfork · **the pivot**

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply.

# THIS PHASE GETS ITS OWN SESSION AND SHARES IT WITH NOTHING

Not with P8's leftovers. Not with a "quick" P10 step. Not with a doc update.
**Open a session, do this, close it.**

**Spec:** spec §7 P9 and §9's risk row. **Detail:** CLAUDE.md §8 *The map-view unfork —
decided work*.

**Model:** **Opus / main session.** Not a subagent. It is not test-covered, it touches the
lockstep-bearing engine, it needs a real browser, and it needs judgement about what may be
touched.

**Depends on:** nothing but its own risk profile — **it may be pulled forward** if the map
matters more than the flow. **Hard-blocks:** P10.

---

## What it is

~390 lines inside `render.py`'s template string against ~430 in `engine/map-view.js`,
hand-kept in lockstep. **The largest duplication in the repo**, and the enabling step for
"the map is the app".

**The sketch, from CLAUDE.md §8 — this is the decided approach, not a proposal:**

> Make `map-view.js` the one source and have `render.py` inline it with a second
> `.replace("__MAPJS__", …)` beside `__DATA__`. The two consumers read different input shapes
> — a flat `nodes` array vs the editor's grouped `domains` — so **it needs a small adapter**,
> and a browser to verify pan, zoom, pinch and detail-open. **Not a test-covered change.**

## Why it cannot be delegated

> **`_leafMetaEditable` deliberately returns an empty `DocumentFragment`**: `_mountLeaf` /
> `_updateLeaf` append meta before detail, so moving every editable control into `_leafDetail`
> is how an open tile gets the wizard's field order without touching those two
> lockstep-bearing builders. **Anyone "tidying" it back into returning a `.mmeta` div will
> re-order the tile.**

That is one of several places where the current shape looks like an accident and is not. A
subagent reading `map-view.js` cold will tidy at least one of them.

## The lockstep gate — armed on entry, retired on exit

Until this phase lands, only `_leafHeaderEditable`, `_leafMetaEditable` and `_leafDetail` may
be touched. `_leafHeaderReadonly`, `_leafMetaReadonly`, `_mboxHTML`, `redraw`, `assignX`,
`assignY`, `edges`, `_bindPanZoom` and **`MAP_TWO_SIDE_BREAK = 860`** are lockstep-bearing.

```
git diff -U0 main -- engine/map-view.js | grep '^@@'
```

**This phase is the one that is allowed to fail that gate.** Every other phase in the program
must pass it. **When P9 lands, update CLAUDE.md §8 and debug.md's "Still open" item 4** — the
gate is retired because the fork is gone, and leaving the rule armed against a file that is
now the single source will confuse the next session into thinking it may not touch the engine
at all.

## Suggested task order

1. **Read both copies side by side and diff them mechanically.** Where have they already
   drifted? A silent drift is the real state of the world and the adapter has to accommodate
   whichever behaviour is correct — decide which, deliberately, and write down why.
2. **Define the adapter.** Flat `nodes` array (generated map) → grouped `domains` (editor), or
   the reverse. One small pure function. Whichever direction, it is testable from plain
   `node` — **write the one test this phase can have** (debug.md rule 21: `map-view.js`'s
   siblings run UMD from plain node with no browser).
3. **Add `__MAPJS__` to `render.py`'s template** beside `__DATA__`, and the `.replace()` that
   fills it by reading `engine/map-view.js` from disk at render time.
4. **Delete the embedded copy.** This is the payoff; do not stop before it.
5. **Regenerate and verify.** The output hash **moves** — the embedded JS is now a different
   string. **The two survivors must stay byte-identical:** `documentation/study-list.md` and
   the embedded `<script id="data">` payload.
6. **Verify in a real browser.** See below. This is the majority of the phase's cost and it
   is not optional.

## The path dependency to check in step 3

`render.py` resolves `ROOT` as `Path(__file__).parent.parent`. Reading `map-view.js` at render
time makes the renderer **depend on a second file on disk**. Check what that does to:

- **`api/render.py`** on Vercel — it imports `engine/render.py`, and `vercel.json`'s
  `includeFiles` must now bundle `engine/map-view.js` too. **debug.md rule 18:** a route
  importing `render.py` that returns plausible zeros may be bound to the wrong same-named
  module; a missing bundle is the same class of silent failure. Resolve it at import time so
  a missing file is a 500 on the first request, not a blank map.
- **The offline contract.** `start_editor.bat` → `render_server.py` → `render.py` runs from
  the repo, so the file is there. Confirm, do not assume.

## Browser verification — the phase is not done without it

**At all three viewports, in both themes:**

| Check | 360px | 820px | 1440px |
|---|---|---|---|
| Pan (drag / swipe) | ✔ | ✔ | ✔ |
| Zoom (wheel / pinch), cursor-anchored, 0.3–2.5× | ✔ | ✔ | ✔ |
| Tap still registers as a tap (6px threshold) | ✔ | ✔ | ✔ |
| Detail-open on a leaf | ✔ | ✔ | ✔ |
| Domain box collapse/expand | ✔ | ✔ | ✔ |
| Edges redraw correctly after open | ✔ | ✔ | ✔ |

**820px is the one that matters most here.** It is **below `MAP_TWO_SIDE_BREAK = 860`**, so
the map is in its **single-sided left-to-right fallback** — a code path the two-sided layout
never exercises. It has historically been checked by nobody.

**On both consumers, not one:**
- `theology-map.html` opened directly from `file://` (the generated map, self-contained)
- `/thomas` hosted, and **framed inside `/view`** — a framed map trims its own header
- `/edit`'s Map tab on a real map, hosted **and** from `file://`

**And the editor-only behaviour the fork exists to protect:**
- An open tile's field order — **meta before detail, wizard field order.** If the tile
  re-orders, `_leafMetaEditable`'s empty fragment was tidied away.
- `/edit?open=<slug>` still expands the area, opens the tile and selects the title.
  **An unresolvable slug is still ignored silently.**
- The ✎ rename-in-place on a domain box.
- `#mapwrap`'s height still comes from `sizeMap()` measuring the header's real
  `offsetHeight`, and **`sizeMap()` still runs before `redrawMap()`**.
- A node title containing `<`, `&` or a quote renders as **text, not markup** — debug.md's
  open item 1 says the editor was never click-tested after the 2026-09-05 `escapeHtml`
  consolidation, and this phase is the natural moment to close that.

## Acceptance criteria

- [ ] `engine/map-view.js` is the **one** source. `render.py`'s embedded Map JS is **deleted**,
      not commented out.
- [ ] `documentation/study-list.md` and the `<script id="data">` payload **byte-identical**.
      Hash movement declared and explained in the commit message.
- [ ] The adapter has a runnable test under plain `node`.
- [ ] Standing gate green. `py tests/check_generated_map.py` especially.
- [ ] `vercel.json` bundles `engine/map-view.js` for every function importing `render`, and
      the import resolves at import time.
- [ ] **Every row of the browser table above, ticked, at three viewports, both themes,
      reduced-motion on.** Write down what device or emulation each was done on.
- [ ] `theology-map.html` opens and works from `file://` with no network.
- [ ] **CLAUDE.md §8 and debug.md "Still open" item 4 updated** — the fork is resolved and the
      lockstep gate is retired.
- [ ] **Nothing else is in this commit range.** If a P8 fix or a P10 CSS line snuck in, split
      it out. This phase's revertability is the mitigation for its risk.
