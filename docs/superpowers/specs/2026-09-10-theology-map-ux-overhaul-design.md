# Theology Mind Map — UX and design overhaul

**Date:** 2026-09-10
**Status:** approved design, ready for an implementation plan
**Sources merged:** `documentation/ux-firstprinciples-constrained.md`,
`documentation/ux-firstprinciples-unconstrained.md`,
`documentation/design-modern-feel.md`

---

## 1. The problem

Three independent assessments converged on one diagnosis, stated three ways:

> It is not one product with four screens; it is **four correct programs that share a
> stylesheet, and the person is the integration layer.**

The wizard, Learn, Compare and the map each work, and each owns its own copy of the same
idea. Because nothing is *structurally* one product, every seam has to be crossed by hand,
and every crossing is an unanimated `hidden` toggle or a `location.href`. The owner's four
complaints — getting between screens, going in and out of a question, Compare and Learn
feeling bolted on, and the whole thing moving like a static site — are **one problem, no
continuity of place**, reported from four angles.

A second, narrower diagnosis sits underneath the visual half: nothing that makes the app
read dated is caused by its palette. It is 22 font sizes, six uppercase label registers,
eight radii, a three-way-forked and already-drifted token block, a missing `color-scheme`,
a deleted focus ring, and no motion grammar at all.

## 2. Goals

1. One product, not four — the person should never be the integration layer.
2. "My map" reachable in one tap from anywhere, including mid-question.
3. Entering and leaving a question feels continuous, not like a page load.
4. The app works and looks deliberate on **a phone, an iPad and a desktop browser** —
   all three, every phase (§4).
5. Modern by craft: one type scale, one spacing scale, real interaction states, a motion
   vocabulary with four verbs and a written rule for when nothing moves.
6. The map becomes a place you are in, not a diagram you look at.

## 3. Non-goals

- **No rewrite.** No framework, no bundler, no CDN import, no npm dependency browser-side.
  The unconstrained assessment — the lane licensed to propose one — recommended against it.
  Python stays standard-library only; `requirements.txt` stays empty.
- **No anonymous start.** Accounts stay required before the question flow. Decided.
- **No person-vs-person scorecard**, no leaderboard, no score attached to a named person,
  no members-aggregate baseline. This is product ethics, not a feature gap. A later session
  will read the missing symmetry as an oversight. It is not.
- **No new auth.** The "security is deliberately minimal and that is the brief" posture
  stands.
- **No change to the offline tool's contract.** `start_editor.bat` keeps working from
  `file://`, offline, with no network and no database.

## 4. The three-viewport requirement

This is a first-class acceptance criterion, not a review step. CLAUDE.md records that the
2026-08-29 round was an explicitly phone-sized pass and **shipped two bugs that existed only
on a wide screen** — a map iframe rendering at its 300px intrinsic width, and a framed
header staying full height. Both read as *correct* on a phone.

**Every phase is checked at three widths before it is called done:**

| Target | Width | What it exercises |
|---|---|---|
| Phone | **360px** | the horizontally-scrolling nav, the Filters disclosure, stacked field labels (<560px), coarse-pointer tap targets |
| iPad portrait | **820px** | **below `MAP_TWO_SIDE_BREAK = 860`** — so the map is in its *single-sided left-to-right fallback*, the phone rules are off, and the 640px rules are off. This is the width that has historically been checked by nobody. |
| Desktop | **1440px** | `main.wide` in the Map view, the 1080px reading measure on card views, `/view`'s iframe stretch |

iPad landscape (1180px) is above the map breakpoint and behaves like desktop; it does not
need a separate pass, but the 820px pass is mandatory and is the one most likely to find
something.

Additional standing rules:
- Coarse-pointer targets are **44px minimum**. `theme.css:118`'s
  `.wz-radio span { min-height: 38px }` currently violates this inside the very block whose
  purpose is the 44px floor — and those are tier and confidence, the most-tapped controls in
  the product.
- Test in **both themes** and with **`prefers-reduced-motion: reduce`** on.
- iOS Safari specifics already learned the hard way stay respected: no
  `requestFullscreen()` on a non-video element; a `position: fixed` iframe does not
  re-resolve its document's `100vh`; `<base href>` does not cover a dynamic `import()`.

## 5. Decisions taken

| # | Decision | Rationale |
|---|---|---|
| D1 | **Lane A — evolve paper-and-ink — with the map's ground plane as a licensed exception** | Nothing dated is caused by the palette. The next-gen register is the visual language of *computed authority*, which this product's architecture spends its whole existence refusing to be. |
| D2 | **One phased program covering all five areas**, unfork included | Matches how every previous phase has been run. |
| D3 | **`render.py`'s `:root` may use modern CSS, and a restyle may move its output hash** | `color-mix()` and `@property` are plain CSS — no network, `file://`-safe. Hash movement is licensed by the phase-7 precedent, gated (§7). |
| D4 | **Drop four of the five uppercase label registers** | A voice change, and the right one: the product already bans "node" and "domain" from user-facing copy. |
| D5 | **The map grid/pan-zoom coupling waits for the unfork** | It touches the lockstep-bearing engine. Do not hand-copy it into two files. |
| D6 | **The nav becomes `My map · Questions · Learn · Browse · ⋯`** | Reverses the 2026-08-29 tile decision. See §6. |
| D7 | **Accounts stay required; no anonymous start** | Cheap to create, and every map stays real and saved. |

### D1 in detail — the seam rule

"Push the map further" without two design languages requires a rule that can be enforced
rather than felt. It is:

> **The canvas substrate is dimensional. Anything that contains the person's words is not.**

So: the map's *ground* recedes — a tinted background, an inset vignette, a grid that moves
and scales with the pan/zoom transform so it reads as a surface rather than a texture. The
*tiles* on it stay paper: flat, warm, `--e1`, serif content, no glass, no glow, no gradient.
Edges, the grid and the ground are canvas furniture and may be dimensional. A node is a
document and may not.

Any proposed effect is tested against that one sentence. If it puts depth, glow or gradient
behind somebody's stated belief, it is out.

### D6 in detail — reversing a documented decision

CLAUDE.md said:

> "My map", "History", Unlist/Relist, Learn and Compare are tiles on `/`, not nav links.
> Six nav items is what fits a phone.

Reversed on three counts:

1. **The premise is already false in this codebase's own CSS.** `theme.css:142-144` makes
   `.toplinks` `overflow-x: auto; white-space: nowrap` below 640px — the nav already scrolls
   horizontally, which is the concession you make when items do *not* fit. At 12px semibold
   with a 14px gap, roughly four to five are visible in 360px. The real choice made was
   *which* items go off-screen, and it favoured **Sign out** and **Admin** over **My map**.
2. **The budget is spent on cold paths.** Of the six, Sign out is monthly, Admin is one
   account, and Home's only job for a signed-in user is to be a menu of the items evicted
   from the nav. Three of six slots hold navigation-to-navigation.
3. **The stated alternative route does not exist from where the user is.** "Reach it the
   same way the other three do" assumes the chrome is on screen. On the question screen —
   where a person spends 86 turns — `wizard.js:269` hides the chrome entirely.

**New nav:** `My map · Questions · Learn · Browse · ⋯` — four visible items, *fewer* than
today, with `⋯` a native `popover` (anchor-positioned, light-dismiss, Escape and focus
management from the platform, zero JS) holding Edit, History, Compare, Listing status,
Admin, Sign out. Signed out: `Learn · Browse · Sign in`.

`/` **keeps every tile it has.** Tiles and nav items are not rivals: tiles are the
discoverable surface for a first visit, the nav is the return path for visit forty.

Taps to "my map" go from **3 + a ~1,100px scroll** (or 4 from inside a question) to **1**.

## 6. The design system

All tokens land in `engine/theme.css`. **Anything in `:root` incurs the hand-copy obligation
into `engine/render.py:278-297` and `engine/editor.html:18-27`.**

**Reconcile the three-way fork first.** It is not two-way as CLAUDE.md claimed, and it has
already drifted: `--good`/`--bad` missing from `render.py`, `--mono`/`--shadow` missing from
the other two, `--accent` dead in two of three.

Then add, with the exact values in `documentation/design-modern-feel.md` §3:

- **Spacing** — 4px base, eight steps `--s1`…`--s8`, replacing thirteen ad-hoc values.
  Rule: *gaps come from this scale or they are a bug.*
- **Radius** — four steps with assigned jobs. *A thing you press is `--r2` (8px); a thing
  that holds other things is `--r3` (12px); a thing that is a value is `--r1` (4px); a thing
  that is a state is a pill.* This resolves all eight current radii and explains why a tier
  chip and a citation chip should not look alike.
- **Elevation** — three steps, tinted via `color-mix(in oklab, var(--ink) …)` so a shadow on
  the cream theme is warm brown-grey (paper under paper), reverting to black in dark mode
  because `--ink` there is light and mixing it would produce a glow.
- **Motion** — three durations (`--dur-1` 120ms state, `--dur-2` 200ms arrival, `--dur-3`
  320ms travel) and three easings. **`prefers-reduced-motion` zeroes the tokens**, which
  guards every consuming rule by construction rather than by remembering a media query per
  rule; the blanket `*` guard stays as a backstop for anything hard-coding a duration.
- **Type** — seven steps against today's twenty-two, fluid `clamp()` above 15px only (fluid
  micro-type resizes into fractional pixels and looks blurry). `--measure: 58ch` unchanged.
- **`color-scheme: light dark`** and **`accent-color`** — see §7 P3.

## 7. The phases

Eleven phases. Each is independently shippable and independently revertable. Each ends with
the standing gate (§8) plus its own acceptance criteria at all three viewports (§4).

### P1 — Correctness and one-file fixes
No decision needed, no shared files, six one-file changes. **Ship first regardless of
everything else.**
- **F1 · the live bug.** `web/learn.js:312-313` sends *"Answer this question"* to
  `/edit?open=<slug>`, but an unanswered doctrine has no node, `editor.html:472` switches to
  the Map tab on the *presence* of the param, and `:498` bails silently — so a church member
  lands on the raw editor's pan/zoom canvas with nothing open, three taps from the home page.
  Point it at `/wizard?doctrine=<id>`, which already exists and which `/compare` already uses.
  **One expression.**
- F6 — the wizard reproduces Learn instead of linking to it.
- F7 — "Wizard" → "Questions" (label only, URL unchanged).
- F9 — the tier ramp has been forked back into `web/learn.html:12-14`, violating the phase-10
  rule *"do not reintroduce a tier hex literal in a `web/` file"*, with a stale comment
  defending the overturned rationale. Delete; hoist the token.
- F10 — Compare copies the wizard's text styles; move four rules to `theme.css`.
- F8 — `/` is a menu wearing a landing page.

### P2 — Token foundation · **zero visual diff**
Reconcile the three-way fork, add every scale from §6. **Nothing consumes them yet.** That
is what makes this phase verifiable: regenerate with `py engine/render.py` and confirm
`theology-map.html` differs *only* in the `:root` block, and that `documentation/study-list.md`
and the embedded `<script id="data">` payload are **byte-identical**.

### P3 — Interaction states and dark mode
Highest felt-quality-per-line in the whole program; depends only on P2.
- **`color-scheme: light dark`.** There is no `color-scheme` property anywhere in the repo —
  only media queries — so every native control, scrollbar, caret and `<dialog>` backdrop
  renders light-mode on a dark page. One declaration.
- **A real state system.** `web/wizard.html:177` deletes the focus outline from the belief
  textarea and no `:focus-within` exists anywhere: **the product's primary input has no
  visible focus state** (WCAG 2.4.7). Four disabled buttons across `landing.html` and
  `history.html` have no `:disabled` styling. `.tm-card` is a link with no hover and no press
  feedback. Add focus / hover / press / selection / disabled / `::selection` as one system.
- **Fix `theme.css:118`** — `.wz-radio span { min-height: 38px }` inside the 44px block.
- Dark-mode elevation, `accent-color`, and the cheap small wins that touch no layout.

### P4 — Motion
The constrained report's §4 mechanisms, adopting P2's tokens and this spec's grammar.
- Cross-document: `@view-transition { navigation: auto }` + `view-transition-name` on
  `.tm-chrome`. **Deploy this alone first and look at it** — it is a thirty-second test of
  whether the whole approach is right.
- Same-document: `startViewTransition` around `showScreen`, Holding `#q-title`, `#wz-crumb`
  and `.wz-nav`.
- `::details-content` + `interpolate-size` for disclosures; `@starting-style` for injected
  controls and the Read-more popover.
- **Add the reduced-motion guard the map's 280ms `.mbox` transition lacks.**
  `prefers-reduced-motion` is currently honoured in exactly one place in the repo
  (`gallery.html:20`), and the map's transition is the only substantive motion in the product.

**The vocabulary is four verbs and nothing else.** *Tint* (state under the finger — colour,
border, shadow, ≤.5% scale, `--dur-1`), *Settle* (something that did not exist arrives —
opacity + ≤8px translate toward its final position, `--dur-2`), *Travel* (something that
exists moves — transform only, `--dur-3`), *Hold* (something that must not move — a named
view-transition group). If a proposed animation is not one of the four, it is decoration.

**Hold is the most important verb and the easiest to forget.** What makes a transition read
as expensive is not what moves; it is what conspicuously does not. The header, crumb, nav row
and tier bar staying nailed in place while the question changes *is* the effect — the
crossfade underneath is almost incidental.

**Written rules for when nothing moves:** prose never animates; no scroll-triggered anything;
data never animates its value (no count-up on a stat); nothing loops except the skeleton, and
only while `aria-busy="true"`; one thing at a time; movement beats colour (a moving element
changing hue reads as a glitch); keystrokes never animate; **no motion on first paint** — a
staggered entrance on page load is the generated-UI signature.

### P5 — The question screen
It is **2.4 usable screens tall** (3.3 on six-position doctrines) and its primary action is
at the bottom. Three independent, individually revertable steps, in order:
1. `.wz-nav { position: sticky; bottom: 0 }` — one CSS rule, and it may be most of the fix.
2. Build `#custom-answer` lazily instead of eagerly on all 86 questions.
3. Swap unselected positions to a `<p>`, back to a textarea on select — five live textareas
   currently exist for choices nobody picked. Compatible with the standing rule that *the
   position's description **is** the editable hold field*.

Note the interaction with P4: a sticky `.wz-nav` that is also a named transition group holds
still across a question change. That is the intended effect and should be looked at once on a
real phone.

### P6 — The nav (D6)
Touches `web/chrome.js`, `engine/theme.css`, `wizard.js:262-272`, `wizard.html:291-301` and
**the hand-kept copy in `engine/editor.html:541-547`** — the documented `file://` exception.
`wizard.js` stops hiding the chrome; the wizard's own header keeps the crumb, tradition
control and "Finish here" and sits *below* the chrome rather than replacing it, which also
removes the height-swap jolt that is half of complaint (2). "My map" points at
`/view?name=<name>` exactly as the tile does today — **do not change that logic**, including
the empty-map redirect and the unlisted-map message.

Lands after P3 so the new nav ships with its active state and after P4 so the header morph is
already in place. Verification includes opening `/edit` on a real map.

### P7 — Type and spacing
Land the scales, page by page, each page independent. Large diff, no behaviour change; this
is most of what makes the pages read as one product. Fold in the "make two things agree"
small wins, and D4's label-register reduction: **one uppercase register with a stated job,
everything else sentence case.**

### P8 — Compare
Its picker does `location.href` to itself and re-downloads the corpus (16 files), the user's
map and all twelve tradition maps (~475KB) with **no loading state at all**, while `/gallery`
next door does skeletons correctly. Three independently shippable steps: skeleton (same
register as the gallery), then `pushState`, then lazy tradition maps. Step 2 needs care —
`?tradition=` and `?name=` must stay bookmarkable.

### P9 — The map-view unfork · **the pivot**
~390 lines inside `render.py`'s template string against ~430 in `engine/map-view.js`,
hand-kept in lockstep — the largest duplication in the repo and the enabling step for
"the map is the app". Make `map-view.js` the one source; `render.py` inlines it with a second
`.replace("__MAPJS__", …)` beside `__DATA__`. The two consumers read different input shapes —
a flat `nodes` array vs the editor's grouped `domains` — so it needs a small adapter.

**This is not test-covered and needs a real browser.** Pan, zoom, pinch and detail-open must
be verified by hand at all three viewports, including the 820px single-sided fallback. It
gets its own session and it does not share a session with anything else.

Until it lands, the existing lockstep rule holds exactly: only `_leafHeaderEditable`,
`_leafMetaEditable` and `_leafDetail` may be touched, and the merge gate is
`git diff -U0 main -- engine/map-view.js | grep '^@@'` showing hunks in those three and
nowhere else.

### P10 — The map itself (D1's licensed exception)
Blocked on P9. **Do not hand-copy any of this into two files.** Order inside the phase, each
step independently visible and revertable:
1. reduced-motion guard on the existing `.mbox` transition (correctness — ship alone)
2. `vector-effect: non-scaling-stroke` on the edges (one line, immediately visible at any zoom)
3. **grid coupling in `_applyPanZoom`** (six lines, the big one). Today the dot grid is
   painted on `#mapwrap`, which never transforms, while `#mapPanZoom` scales inside it — so
   panning slides tiles across a stationary grid and zooming grows tiles over a fixed one.
   The eye takes the grid as the world and the boxes as objects sliding on it, which is
   backwards. Couple `backgroundSize` and `backgroundPosition` to the transform and the grid
   *becomes* the surface: it moves with your finger and its cells grow as you zoom. This is
   the difference between "a diagram" and "a place", and it is the single best change in the
   design report.
4. tile geometry and tier tint → `--zoom` detail fade → substrate vignette → keyboard
   traversal and focus.

### P11 — The commit moment, and cleanup
The answer-commit beat (tier bar Travel + `view-transition-name`), safe to ship in its
tier-bar-only form first. Then the residual small wins: scroll masks, the gallery empty
state, `field-sizing: content` replacing `map-view.js:246`'s JS autosize, the `:target`
guard, the dark `--note` fix, the `.mbox` tab stop, and anchor positioning to replace
`wizard.html:117`'s four hand-copied `padding-right: 88px` gutters.

### Dependency summary

```
P1 ─────────────────────────────────────────────► (independent, ship first)
P2 ──► P3 ──► P4 ──► P5
        │      │      │
        └──────┴──────┴──► P6 ──► P7 ──► P8
                                          │
                              P9 ─────────┴──► P10 ──► P11
```

P9 depends on nothing but its own risk profile, and may be pulled forward if the map matters
more than the flow. P10 is hard-blocked on P9.

## 8. The standing gate

Every phase runs all of it before it is called done:

```
node --test tests/*.test.js          # glob, not directory — Node 24/Windows quirk
py tests/syntax_check.py             # before ANY push touching web/ or engine/
py engine/validate_content.py
py tests/test_validate_content.py
py api/_test_lib.py
py tests/check_tradition_maps.py
py tests/check_generated_map.py
```

Plus, for any phase touching `engine/render.py`:

- Regenerate with `py engine/render.py` — **never hand-edit a generated file to make a hash
  match.**
- **Two invariants must stay byte-identical:** `documentation/study-list.md` and the embedded
  `<script id="data">` payload. That is what proves only *presentation* moved.
- The output hash may move **only** in a phase that changes the output on purpose (P2 is
  explicitly not one — it must be a `:root`-only diff).
- Read `git diff --stat` **before** committing. A diffstat wildly bigger than your change is
  a line-ending rewrite; scripts that edit repo files read and write **bytes**.

And per §4: three viewports, both themes, reduced-motion on.

## 9. Risks

| Risk | Mitigation |
|---|---|
| **Two design registers drift within a round** — the reason Lane C was folded in rather than named | D1's seam rule is one enforceable sentence, and the dimensional half is confined to P10, behind P9 |
| **The token hand-copy drifts again** — it already has, three ways | P2 reconciles it before adding anything, and every later phase states the obligation at the point of change |
| **P9 breaks the map with no test coverage** | Own session, no other work in it, hand-verified at three viewports; the lockstep gate stays armed until it lands |
| **A wide-viewport regression ships** — has happened twice | 820px is a mandatory pass, not a review step (§4) |
| **`@view-transition` also reaches `/edit`**, the offline tool's file | Harmless — single page, no navigations from within it — but confirmed as accepted, and the offline `file://` path is unaffected either way |
| **A later session "fixes" a documented asymmetry back** | The invariants are consolidated in CLAUDE.md §7 rather than scattered through history |

## 10. Execution notes — model selection

Delegate to the cheapest model that can do the job correctly. Mechanical, well-specified,
verifiable-by-gate work is the bulk of this program.

| Work | Model | Why |
|---|---|---|
| Token snapping (thirteen spacings → eight, 22 font sizes → seven, eight radii → four), page by page | **Haiku**, one subagent per page, in parallel | Mechanical substitution against a fixed table; the gate catches errors |
| Grep audits — find every tier hex literal, every hard-coded duration, every ad-hoc radius, every `escapeHtml`/`el`/`slugify` copy | **Haiku** | Search and report, no judgement |
| Running the standing gate and reporting failures | **Haiku** | Fixed command list |
| Per-page CSS work against a written spec (P3 states, P7 type/spacing, P11 small wins) | **Sonnet**, file-disjoint parallel batches | Clear spec, bounded files, verifiable |
| P1's six one-file fixes | **Sonnet**, one batch | Small and independent |
| P4 motion, P5 question screen, P6 nav, P8 compare | **Sonnet** with the spec section quoted in the prompt | Bounded, but each touches a documented invariant — quote it |
| **P9 the unfork**, P10's `_applyPanZoom` coupling, anything lockstep-bearing, anything reversing a documented decision | **Opus / main session** | Not test-covered, needs browser verification and judgement about what may be touched |

**Batch by file-disjointness**, the way the 2026-08-27 and 2026-08-29 rounds were run — that
is what makes parallel subagents safe here. Two agents must never hold `engine/theme.css` at
once; the token phases are sequential for that reason even though their per-page work is not.

**Every subagent prompt carries:** the relevant spec section verbatim, the invariants its
files are governed by (CLAUDE.md §7), the standing gate, and the three-viewport requirement.
A subagent that has not been told an invariant will violate it — every documented "do not undo
this" in CLAUDE.md exists because somebody already did.

## 11. Success criteria

- "My map" is **one tap** from every screen including mid-question.
- No screen change in the wizard is a page load or a scroll jump.
- `/learn`'s "Answer this question" reaches a question, not an empty editor canvas.
- Every interactive element has a visible focus state; the belief textarea especially.
- Every coarse-pointer target is ≥44px, tier and confidence included.
- One type scale, one spacing scale, one radius system, one motion vocabulary, one token
  block reconciled across three files.
- `prefers-reduced-motion: reduce` produces a completely still product.
- The map's grid moves and scales with the pan/zoom, and the ground reads as recessed while
  every tile still reads as paper.
- Verified at 360px, 820px and 1440px, in both themes, on a real phone and a real iPad — not
  only in a resized desktop window.
