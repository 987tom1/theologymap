# CLAUDE.md history

Narrative moved out of `CLAUDE.md` on 2026-10-02. Nothing here is a live rule; the live
rules, and the current hash pair, stay in `CLAUDE.md`. Section numbers cited in source
comments (§1, §10) point at the headings there.

## §1 — Every move of the render byte-identity hash, with the reason

**Corrected 2026-09-10.** This file previously carried `9a702faf…9d5fda` / `43feab4f…9ea498`,
which had been **stale since `cb08cea`** — `theology-map.html` changed and neither this file nor
the plan index was updated, so the recorded gate had not matched the repo for several commits.
Regenerating on a clean tree hashed to `f5396e31…6db99e` (CRLF), not the recorded value. The
pair before this one (`84650d62…976146` CRLF / `ad8c2515…e220e44e` LF) was post-P3. **The pair
above is post-P4, updated again by the P4 whole-phase-review fix wave (F2)** — P4 Task 6 added
the reduced-motion guard to `render.py`'s own embedded `<style>` (it cannot link
`engine/theme.css`, so it carries a hand-copied second copy of that guard), which was a
licensed, on-purpose move of the full-output hash; that gave `27ae2c0f…f427f384` (CRLF) /
`6f7c7759…f7f057a1` (LF). F2 then found that `el.scrollIntoView({ behavior: 'smooth', ... })`
in that same embedded script overrides the computed `scroll-behavior`, so Task 6's guard did
not close it — jumping to a `:target` node still smooth-scrolled under
`prefers-reduced-motion: reduce`. Making `behavior` conditional on the media query moved the
hash a second time, to the pair above, for the same reason: still licensed, still
presentation-only. Both times, `documentation/study-list.md` and the embedded
`<script id="data">` payload stayed byte-identical, which is what proves only presentation
moved. **When a licensed phase moves the output, update this pair in the same commit** — a
gate nobody can pass is a gate the next session learns to ignore. **P7 Task 12 moved the pair
a third time**, to `20219445…777402` (CRLF) / `b780879c…da911e` (LF) — `.node`'s radius
(9px → `var(--r3)`, 12px) and the D4 label-register reduction (six selectors losing
`text-transform: uppercase` and their `letter-spacing`) are the licensed felt changes;
`documentation/study-list.md` and the `<script id="data">` payload again stayed
byte-identical, which is what proves only presentation moved this time too.

**P9 moved it a fourth time, to the pair above, and for a different reason than the other
three: not presentation, but the engine itself.** The Map view's ~390 embedded lines were
deleted and `engine/map-view.js` is now inlined in their place (§8), so the embedded script
is a different string. The same two invariants held —
`documentation/study-list.md` (`f4a30fe1…9f3df7`) and the `<script id="data">` payload
(`4d8d919e…c8bd7e`) — which is what proves the *content* did not move even though nearly a
thousand lines of the file did.

**P10 moved it a fifth time, to the pair above** — the grid-coupling, tier tint, `--zoom`
detail fade, substrate vignette, keyboard traversal/selection mark and leaf-edge tinting are
all licensed, felt changes to the map's presentation and behaviour, spread across seven
commits (`bb5a29c^..1dea3d6` — `^` because the two-dot form excludes its left endpoint). The
same two invariants held at every one of those commits:
`documentation/study-list.md` (`f4a30fe1…9f3df7`) and the `<script id="data">` payload
(`4d8d919e…c8bd7e`), unchanged throughout — proving the map's *content* never moved even
though its rendering did, seven times over.

**P10's own whole-phase review and its fix wave moved it a sixth and seventh time.** A fix
wave found three defects in what P10 shipped (an arrow-key/form-control conflict, a
dark-theme vignette that inverted into a highlight, and a focus call that could desync the
grid from a scroll) — the first two fix commits (`b768ce0`, then a trivial-polish commit)
each regenerated `render.py`'s output and moved the hash again, to the pair above. The two
invariants held at both of those commits too. **This pair was briefly wrong in this file for
several commits** — the phase's own doc-bookkeeping commit updated it once, before the fix
wave landed, and nobody updated it again afterward until an independent review caught the
staleness. Exactly the "a gate nobody can pass is a gate the next session learns to ignore"
failure this section already warns about once; update this pair **in the commit that moves
it**, not in a follow-up.

**P11 Task 2 moved it an eighth time, to the pair above.** The map's newly-added-node tile now
Settles in (`.mbox.mbox-enter` + `@starting-style`, opacity/scale) instead of appearing
instantly — a licensed, felt change to the map's presentation, even though this read-only
generated consumer never actually applies the class (`onAddNode` is never passed here, so
`_pendingEnterId` is never set; the CSS is carried only because `.mbox`'s base rule is itself
duplicated in this file). The same two invariants held: `documentation/study-list.md` and the
`<script id="data">` payload (`4d8d919e…c8bd7e`), unchanged — proving the map's *content* did
not move even though inert presentation CSS/JS did.

**P11 Part 2 win 4 moved it a ninth time, to the pair above.** The generated map's `.views`
view-switcher (Map/Domain/Tier/Confidence) is a horizontally-scrolling container on narrow
screens with no cue that there's more content — `scrollbar-width:thin` becomes `none` plus a
right-edge `mask-image` fade, matching the same treatment applied to `web/compare.html`'s
`#sc-table-wrap` and `engine/theme.css`'s nav. Licensed, felt (visible fade on scroll), the two
invariants held.

**Phone map phase 1 moved it a tenth time, to the pair above.** Beliefs no longer expand
inside the map: `.mbox-leaf.mopen`/`.mdetail` gave way to the `.map-panel` detail panel (right-hand
from 641px, a bottom sheet below), `mapLeafHTML` lost its open branch and `mapPanelHTML` joined it
(`docs/superpowers/specs/2026-09-23-phone-map-panel-and-outline-design.md`). Licensed, felt;
`documentation/study-list.md` and the `<script id="data">` payload unchanged. **Phase 1.5
moved it again, to the pair above:** the map-first phone header (one grid row, search inside
Filters) and a `ResizeObserver` that re-sizes the canvas when the header changes height.
Same two invariants held.

**Phone map phase 2 moved it again, to the pair above:** the Domain / Tier / Confidence views
became the outline — each belief a compact row button on a branch line that opens its detail
in place (`expandedBeliefs`), a tier-mix strip on each Domain group header, and print now
opening everything through a `printing` flag instead of writing into `expandedGroups`.
Licensed, felt; `documentation/study-list.md` and the `<script id="data">` payload unchanged.

**Six-hat fixes Task 1 moved it again, to the pair above.** The Map view's camera: `homePan`
replaces `redraw()`'s inline centring so a single-sided (phone) tree pins the root 16px from
the left instead of centring it off-screen; a `_touched` flag stops re-homing once the person
pans, zooms or taps, and a wrap `ResizeObserver` re-homes an untouched map through the size
settling `/view`'s iframe and `sizeMap()` do after first paint, which used to leave the desktop
map clipped until Reset view; opening an area by tap now pans its first three beliefs into view
(`_revealArea`); and a drag no longer selects page text. Licensed, felt; the two invariants
held — `documentation/study-list.md` and the `<script id="data">` payload
(`4d8d919e…c8bd7e`) unchanged. **Fix round 1 moved it a second time, to the pair above:**
`select(node)` now also sets `_touched`, because a consumer that programmatically selects a
belief (`/edit?open=<slug>`) has placed the camera on purpose — without this the same
`ResizeObserver` that fixed the desktop clip undid `select()`'s reveal pan on its first
callback. Same two invariants held. **Six-hat fixes Task 2 moved it a third time, to the pair
above:** `html.framed .legend` no longer hides the tier key, because `/view`'s own chrome
carries no legend of its own and the framed map had none at all; and `sizeMap()` now
subtracts the `.pagefoot` footer's height (plus its top margin) from the wrap height on
screens wider than 640px, so the NET attribution fits inside the frame instead of pushing the
page into a nested scrollbar. Licensed, felt; the two invariants held —
`documentation/study-list.md` and the `<script id="data">` payload (`4d8d919e…c8bd7e`)
unchanged. **The final-review fix wave moved it again, to the pair above:** `select(node)`
now sets `_touched` only after the `!domain` guard, so a lookup miss no longer latches the
camera as touched. Licensed, felt; the two invariants held —
`documentation/study-list.md` and the `<script id="data">` payload (`4d8d919e…c8bd7e`)
unchanged. **The 2026-09-27 follow-up moved it again, to the pair above:** the leaf stagger
runs only on a two-sided map (on a phone it pushed every second belief off-screen), and the
area count and editor add-tiles read "N beliefs", "+ New belief", "+ New area" instead of
"nodes"/"node"/"domain" (§4 copy rule). Same two invariants held.

## §10 — Fixed bugs, P8, and the P7 / P9 / P12 / six-hat round narratives

~~Known bug: `/learn`'s "Answer this question" points at `/edit?open=<slug>`~~ — **fixed in P1.**
`web/learn.js` now routes on whether the doctrine actually has a node: `/edit?open=<slug>` when
it does, `/wizard?doctrine=<id>` when it does not. An unanswered doctrine no longer lands a
first-timer on the raw editor's pan/zoom canvas with nothing open.

~~**Growth marker:** `/compare` still eagerly loads all 475 KB of tradition maps. Lazy-loading
the eleven non-target maps is the next performance move.~~ — **closed by P8 on 2026-09-12.**
Both halves of that sentence were wrong. The twelve maps are **408,501 bytes**, not 475 KB, and
the old code fetched the target's own file **twice** — once for the diff, once again inside the
scorecard's `Promise.all`. And it is **all twelve** that had to move, not "the eleven non-target"
ones: `CompareCore.closestTradition` (`engine/compare-core.js:230-264`) tallies **every** scorecard
tradition exactly as `scorecard` does, so the closest-tradition line is a second consumer of the
same full set, not a free rider on the target's map. **Deferring the scorecard alone would have
saved zero bytes.** Both consumers now sit behind one explicit "Show the all-traditions
scorecard" button — not an `IntersectionObserver`, because a scroll must never start a 400 KB
download — and the set is cached at module scope for the visit, since the twelve files are the
same twelve whichever tradition is the target. Eager bytes on first paint: **~416-464 KB down to
7,759-55,197**, the target's own map alone. **The cost is that the closest-tradition line is no
longer on the first screen** — it arrives on the same tap as the scorecard.

**P9 shipped 2026-09-12** (session D), four commits — **the pivot**. The map-view fork is
gone: `engine/map-view.js` is the one source and `render.py` inlines it at render time from a
file it reads at import. ~390 embedded lines deleted, `render.py` down 367 lines net. The
engine gained four options (`readonly`, `leafHTML`, `escapeHtml`, `forceOpen`) and two methods
(`expandAll`, `collapseAll`) so the generated read-only map and the editor share one
implementation instead of two hand-synced ones; the editor passes none of the four and is
unchanged. `MapView.groupByDomain` is the flat-to-grouped adapter, and
`tests/map-view.test.js` is the one test this phase could have (debug.md rule 21), including a
rule-22 read of the real data payload. **The lockstep gate is retired** — see §8 — which
unblocks P10.

**P7 shipped 2026-09-12** (session C), nine commits. **Type and spacing** — every `gap`,
`padding`, `margin`, `border-radius` and `font` shorthand in `engine/theme.css`, all eight
`web/` pages and `render.py`'s embedded stylesheet now reads a token. `.node` and `.tm-card`
share a radius again (9px → `var(--r3)`), which is the change the design review named as the
one that would be felt. **D4 landed: one uppercase register.** `grep -rn "text-transform:
*uppercase" web/ engine/` returns exactly three hits, all `.kicker` — one each in
`theme.css`, `render.py` and `editor.html`, which is the permanent three-way fork, not three
registers. Zero in `web/`. P1 Task 5's deferred rename finished: `.wz-quiet`/`.wz-hint`/
`.lp-hint`/`.wz-framing`/`.lab`/`.lp-pos-label` became four `.tm-*` names across ~41 call
sites in seven files, and the alias selectors are gone.

**Three more inert coarse-pointer floors were found and fixed** — `.lp-row`,
`.cmp-row > summary` and `.cmp-acc > summary` each tied with a later page-local rule and
lost, leaving targets at ~42.3, ~40.3 and ~33.6px. All three now win on **specificity**
(`a.lp-row`, `details.cmp-row > summary`, `details.cmp-acc > summary`), so no page-side edit
can defeat them again. That is the fourth, fifth and sixth instance of this one bug.

**`/compare`'s row summaries clear 44px by 0.29px at 360px** — `.cmp-q`'s
`var(--fs-1)/var(--lh-snug)` line box plus `var(--s3)` padding — and the margin depends on
the `vw` term of a token declared in a different file. **A one-step change to `--fs-1` or
`--lh-snug` drops a touch target under the WCAG floor silently.** Derived in
`engine/theme.css` beside the rule.

**Four questions the whole-phase review raised, all decided by Thomas on 2026-09-12:**

- **The 44px margin on `/compare` stands as documented.** It passes at every width and the
  derivation now sits beside the rule. Not widened — that would be a visual change to the
  diff rows' rhythm with no acceptance criterion behind it.
- **`engine/editor.html`'s header is independent**, not drifted. See §8.
- **The `-.012em` tracking stays**, on the large serif headings and off the small chips. It
  exceeded P7's own stated scope, but it is what design-modern-feel B1 asks for, and B1 notes
  only two rules in the repo were doing it before.
- **P7 ships unwalked, by decision.** Its criteria are greppable and green; nobody has seen a
  rendered page. If a layout problem surfaces during P8, check whether it is P7's before
  blaming the new code.

Left over from P7, not part of P11's brief: `render.py`'s `dd.rel a` went from a 20px pill to
`var(--r2)`, the one place in the phase a pill became a rounded rectangle; and `.tm-lead`,
`.tm-span` and `.chip-select` in `theme.css` still have no call site anywhere (all three were
already dead before P7, and P7 spent a substitution re-tokenising `.tm-lead`). **P11 gave
`.tm-working` a `cursor: progress` (small win 14) without resolving its own dead-code status.**
**All four were deleted 2026-10-01** — still no call site, and a class with none is not
waiting for one. `dd.rel a` stays a rounded rectangle; that was P7's call, not an oversight.

**P12 shipped 2026-09-18**, six sequential phases from a single bug/improvement list, each
gated on the full test suite and pushed to `main` on its own. None touched `render_markdown`'s
output — the byte-identity pair is still P11's.

- **Nav.** The ⋯ button now shares `align-items: center` with the visible links, and
  `engine/editor.html`'s hand-copied `.toplinks` moved off a literal `12px/1` onto the shared
  tokens — the worst of the three-way fork's drift, closed. The ⋯ menu's row padding came off
  its unconditional 8px floor; it only reaches the 44px touch target under
  `@media (pointer: coarse)` now. **Listing status is gone from the overflow — Home took the
  freed slot as a genuinely new fifth visible item**: `Home · My map · Questions · Learn ·
  Browse · ⋯`, with `Browse` folding back into the overflow below an 860px breakpoint
  (`WIDE_NAV` in `chrome.js`, mirrored by hand in `editor.html`, `ponytail:`-marked — the number
  is a judgement call about "comfortably fits," not a hard fitting limit; the five labels
  actually fit from phone width up, per the 640px scroll fallback already handling anything
  narrower). **This reverses the 2026-09-11 decision** (§10, D6) that kept Home in the overflow
  only — Thomas asked for it back in the visible row on 2026-09-18. Safari's missing
  `position-anchor` support, which pinned the ⋯ menu to the viewport's corner instead of the
  button, now gets a JS fallback (`getBoundingClientRect()` on `beforetoggle`) gated on
  `CSS.supports('position-anchor: --x')`, so anchor-capable engines run none of it. See
  `debug.md` rule 24.
- **Admin.** The PIN-skip-on-return-visit behaviour reported as missing was already correct
  (`sessionStorage` read-back on `init()`, verified end to end — no bug, no commit). The account
  tiles got the requested revamp: Visibility and Admin lead the meta rows now, Size and
  Last-updated stack onto their own line below 640px, and the action buttons dropped the
  blanket `min-height/width: 44px` — the sitewide `@media (pointer: coarse)` button rule still
  protects a touch visitor, so only the everyday mouse case shrank.
- **Wizard.** The in-question "Shown first" control (`#wz-lens-btn`) is gone — the Home Screen's
  own copy (`#home-lens-btn`) was always the real one, same `localStorage` key. `#q-readmore`'s
  blank strip was a `<details>` missing the `align-self: flex-start` its own `<summary>` already
  had. "+N more" tradition chips expand in place on click now — the only place in the app that
  ever truncated a denomination list this way; nowhere else needed the matching fix.
- **Editor.** `engine/map-view.js` was read, not touched, per §8's own warning against tempting
  edits there. The List tab gained a sticky Back/Next bar walking `domains[].nodes[]` in array
  order (disables, doesn't wrap, at either end — a linear list, not a ring). The Map tab got
  `/view`'s `body.tm-enlarged` fullscreen pattern, reimplemented locally as `body.editor-enlarged`
  since `editor.html` can't import `view.html`'s JS (the documented `file://` exception).
- **Learn — the substantial one.** `content/verses.json` is a new generated file (§2), written
  by `render.py`'s `main()` alongside its other writes, reusing the already-loaded `verses` dict
  — never re-parsed, never touching `render_markdown`. LF-written like `content/traditions/`'s
  JSON, so it needs no `.gitattributes` pin. It ships the whole 482-entry `verses.md` (§3
  now documents why that number is bigger than Thomas's own 156 cited references). `/learn`'s
  reference chips are `<button>`s now, opening one shared `<dialog id="versepop">`
  populated per click via `web/corpus.js`'s new `loadVerses()` (cached-promise, cleared on
  fetch failure so a dropped connection is never remembered as "no text"). This is a **deliberate
  simplification** against `render.py`'s existing anchored-popover version — `ponytail:`-marked
  in the code for whichever future session wants the fancier positioning. The doctrine page
  reordered (Key texts before History and terms), collapsed History-and-terms and Sources behind
  `<details>` (Key texts, the new contested section, positions, who-holds-what and my-answer stay
  expanded — they're what people came for), and replaced the per-position `orthodoxyMarker()`
  with one doctrine-level "Where this is contested" section, omitted entirely when nothing on a
  doctrine is flagged. **The underlying `orthodoxy`/`orthodoxy_note` corpus fields and their
  `validate_content.py` rules are unchanged — only where they render moved.** The positions grid
  goes to three columns at 1280px, deliberately bleeding past the page's own 900px reading
  measure (`margin-inline: -140px`) because three columns inside that measure would be 289px
  each — too narrow for the card content.
- **Compare.** `.cmp-body-wrap` centers at laptop widths now — it was the one page capping an
  inner wrapper without `margin: auto`. The all-traditions scorecard's bare "0 of 0" — correct,
  not a bug, for a hand-authored map like Thomas's own `theology-map.md`, where `tally()`'s
  exact-wording match legitimately has nothing to count — now reads "own wording only" with the
  fuller explanation on hover, in the same voice `renderClosest` already used for the identical
  case. "Theirs" became the actual name or tradition; "Yours" became "You." The page-level
  summary block — already first in DOM order, so the original report's "should be first" was
  already true — gained a one-line subtitle and tighter framing/closest-tradition copy, checked
  against `closestTradition`'s real return shape so the tie- and denominator-caveats survived
  the rewrite.

**Six-hat fixes shipped 2026-09-25, follow-up 2026-09-27.** Entry-point fixes from a
live review: phone map home position and area reveal, desktop re-home until touched, `/view`
loading and not-found, signed-out redirects to `/#signin` (reason beside the form) and
`/#signup`, `/thomas` redirect, Learn jump links, "beliefs"/"area" copy on the map. Narrative
in `documentation/changelog.md`. **Still open from that round:**

- **Thomas to unlist Test1 and test2 in `/admin`** — they sit in the public gallery beside
  his real map (Test1 is a clone of it). Needs the admin PIN, so no session can do it.

**Closed 2026-10-01.** Dragging and zooming inside `/view`'s frame verified by a Playwright
walk (drag pans 1:1 with the grid, wheel zoom stays under the cursor, area and belief taps,
Reset view) at 360/820/1440, both themes, reduced motion — also on `theology-map.html` from
`file://` and `/edit`'s Map tab. And the two-sided home view now **fits the tree's height**:
`homePan` takes the boxes' extent and zooms to fit, clamped to 0.6–1× so the `--zoom` detail
fade never fires on first paint. Single-sided (phone) stays 1× — one tall column fitted would
be unreadable.
