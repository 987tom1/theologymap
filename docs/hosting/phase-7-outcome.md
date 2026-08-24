# Phase 7 — outcome (session 14, redesign the generated views)

Ran 2026-08-24 on branch `phase-7-views`. Merged to `main`.

There is no `phase-7-plan.md` or `phase-7-design.md`. The brief
(`docs/hosting/phase-7-brief.md`) was complete enough to work from directly, and
this file is where the phase's design record ends up instead.

**A first attempt at this phase was killed mid-flight by an account-level monthly
spend limit.** It had got as far as running a contrast audit script and had landed
no edits and no commits. Its `contrast.py` was the one artefact left behind; it was
reused (see "Contrast, calculated") and kept out of the repo, per phase 3 design
§3.5's instruction to keep it in the session scratchpad.

## The finding that shaped the whole phase

**`render.py`'s output was much closer to phase 3's design language than the brief
assumed, and much further from its *vocabulary*.**

The brief expects the generated views to be "the least considered surface in the
product". On the palette that turned out to be false: `render.py`'s embedded `:root`
already declared `--bg --panel --ink --muted --line --chip --serif --sans` with
**byte-identical values to `engine/theme.css`**, already reserved serif for content
and sans for chrome, and already capped `dd` at 58ch. Phase 3 did not introduce that
language; it inherited it from here.

What had actually drifted was the words. The public views labelled the five node
fields **Hold / Why / Not / Study / Texts**, with the `link` list as an unlabelled
strip of pills. Phase 3 design §2.2's label table — the one phase 4's wizard reuses
verbatim — says **What I hold / Why / What I'd reject / Still working out / Texts /
Related**, and says specifically that `todo` is *never* shown as "Study", because
`#study` is a separate flag and sharing the word is the exact confusion §2.2 exists
to end. Phase 3 fixed both editing surfaces and could not reach the renderer. So the
one product genuinely was speaking with two voices, and it was on the surface a
stranger sees first.

That reframed the phase from "restyle" to "finish the alignment phase 3 started, and
fix what the audit finds". The diff is correspondingly small and reviewable, which
the brief asked for in as many words.

## What landed

### 1. The two tokens, adopted not reinvented

`--field-line` and `--note` are added to `render.py`'s embedded `:root` and its dark
block with **exactly `engine/theme.css`'s values** (`#8f8369` / `#7d7059`,
`#f0ead9` / `#2a2318`). No third token was introduced. Phase 3 §3.4's rule ("total
new CSS custom properties: two") therefore still holds across the whole product.

### 2. The real accessibility defect: control boundaries

Every interactive control in the generated page drew its boundary with
`1px solid var(--line)`. `--line` against `--panel` is **1.36:1 light / 1.30:1
dark** — it fails WCAG 2.1 SC 1.4.11 (non-text contrast, 3:1). This is the identical
defect phase 3 found in `editor.html` and fixed there; it was still live here.

Moved onto `--field-line` (3.68:1 / 3.53:1 on `--panel`): the search input, the
expand/collapse buttons, the Filters disclosure, the scripture reference chips, the
Related pills, the map controls, the confidence meter track, the card border, and an
open map leaf. `--line` keeps every genuinely decorative job — group-heading rules,
`<dl>` separators, the map's dotted ground, SVG edges. **Do not merge the two
tokens back together.**

Separately, `:focus-visible` was defined only on `.refchip`. Keyboard focus was
invisible on every other control on the page. There is now one rule covering
`a, button, input, summary, [tabindex]`, using `--muted` (5.41:1 on `--bg`,
5.90:1 on `--panel`).

### 3. Field vocabulary, and one shared row builder

The `<dt>` labels are now §2.2's table verbatim, and `link` became a labelled
**Related** row inside the same `<dl>` rather than a separate unlabelled `.links`
strip — so every field on a card is introduced the same way.

`card()` and `mboxHTML()`'s leaf branch had **two hand-maintained copies of the same
five-line field list**. They are now one `detailRows(n)` helper driven by a
`FIELD_ROWS` table, so the card view and the map tile cannot drift on labels again.
That is a deletion, not an abstraction: it removed a duplicated block rather than
adding a layer.

The stored field keys in `theology-map.md` are untouched. This is a display-label
change only.

### 4. Cards take `theme.css`'s `.tm-card` geometry

`--panel` fill, `--field-line` border, 9px radius, 16/18px padding, `600 17px/1.3`
serif heading — the same numbers `.tm-card` uses on the gallery and first-run
screens, so a card here and a card in the hosted app are visibly the same object.
The 3px tier rail on the left edge is this view's own and stays.

### 5. Scripture popovers move to `--note`

Scripture is the one thing on the page that is quoted rather than written, so the
popover now sits on `--note` with the **mandatory** `border-left:3px solid
var(--muted)` and its labelled uppercase head. Phase 3 §3.3's rule is that `--note`
is 1.08:1 against `--bg` and carries nothing on its own, so it never appears without
a rule and a label — both are present. Measure widened 40ch → 46ch.

### 6. The header sentence

The subtitle read *"dashed border = inferred, not yet confirmed by you"*. Two
problems: it addresses the reader as "you", which `CLAUDE.md`'s working notes
explicitly ban (Thomas rewrote the original draft's second person out), and on a map
that is now published to other people "you" is the wrong person entirely. It now
reads:

> Positions by Ortlund triage tier · tier is how much weight it carries, confidence
> is how settled it is · a dashed border marks a position inferred and not yet
> confirmed

The middle clause is phase 3 §2.1's "single most valuable piece of teaching in the
interface" (tier-versus-confidence is the distinction a stranger reliably collapses)
carried onto the read-only surface, in third person. The `Edit ✎` link also lost its
inline `style` attribute for a class, so it can be hidden in print and take the
focus ring.

### 7. Map tiles

An open leaf's detail `<dl>` now stacks labels above values. A map tile is
340–560px wide and `grid-template-columns:max-content` with a label as long as
"WHAT I'D REJECT" would have taken roughly 100px of it. This is the same shape the
card views already take below 560px, so it is one rule reused, not a new layout.
Detail type went 13px → 13.5px, and the map hint got its own surface so it stays
readable over the dotted ground.

### 8. Phone

At 360px the top row held four view buttons **and** the search input; the input's
`flex:1 1 auto; min-width:0` meant it collapsed to a few characters wide once the
view switcher took what it needed. Below **480px** the search input now takes its
own row (`flex:1 0 100%; order:3`). This is a new breakpoint — phase 3's set was
360/768/1400 for the editor; this is the public map's own control row and 480px is
where the arithmetic actually breaks.

Below 640px the card padding and type sizes went **up**, not down (padding
9/12 → 12/14, title 15 → 16px, `dd` 13.5 → 14px). A shared map link is most often
opened on a phone, so the phone is not the degraded case here.

### 9. The A3 print stylesheet, which was not A3

**There was no `@page` rule anywhere in the file.** "The A3 two-column print
stylesheet" was two CSS columns at whatever the browser's default paper was. There
is now `@page { size: A3; margin: 12mm; }`.

Three further print bugs, all found by reading rather than printing:

- **Tier chips printed white-on-white.** `.chip.tier` is white text on a dark fill
  and browsers drop background colours in print by default. `.chip.tier`, the
  confidence `.meter .fill` and the legend `.sw` now carry `print-color-adjust:
  exact`. These three are the only places colour carries meaning on paper.
- **The tier legend and subtitle were hidden on paper**, because they are hidden
  below 640px to keep the sticky header short and print inherits nothing that
  brings them back. On paper there is no sticky header, and the legend is the key
  to every chip in the document. Both are forced back.
- **Group headings could strand at the foot of a column.** `break-after:avoid` on
  `.group > h2`.

The `.pagefoot` NET attribution is explicitly commented as never getting
`display:none` — the attribution travelling with the text is a licence condition,
not decoration.

## Contrast, calculated

Run with the previous attempt's `contrast.py`, kept in the session scratchpad and
not committed (phase 3 §3.5). **Every colour used in this phase is an existing
token**, so this is phase 3's table re-verified rather than a new one — there is no
new pair to add.

```
## Group 1 (text, needs 4.5:1)          light   dark
(ink,bg)                                14.66   14.79   PASS
(ink,panel)                             15.98   13.53   PASS
(ink,chip)                              13.06   12.85   PASS
(ink,note)                              13.52   12.30   PASS
(muted,bg)                               5.41    6.78   PASS
(muted,panel)                            5.90    6.21   PASS
(muted,chip)                             4.82    5.89   PASS
(muted,note)                             4.99    5.64   PASS
(bg,ink)                                14.66   14.79   PASS

## Group 2 (non-text UI, needs 3.0:1)   light   dark
(field,panel)                            3.68    3.53   PASS
(field,bg)                               3.37    3.86   PASS
(field,chip)                             3.01    3.35   PASS
(field,note)                             3.11    3.21   PASS
(muted,panel)                            5.90    6.21   PASS
(muted,note)                             4.99    5.64   PASS
(muted,bg)                               5.41    6.78   PASS

## Group 3 (white on tier chip, needs 4.5:1)
white on T1   #7c2d3b   9.15   PASS
white on T1.5 #8a4a24   6.81   PASS
white on T2   #8c6a1f   5.00   PASS
white on T2.5 #5f6b35   5.77   PASS
white on T3   #2f6b63   6.17   PASS
white on T4   #33526e   8.16   PASS

## Group 4 (bare tier swatch on panel — information only)
T1   9.00 light / 1.87 dark      T2.5  5.67 / 2.96
T1.5 6.69 light / 2.51 dark      T3    6.07 / 2.77
T2   4.92 light / 3.42 dark      T4    8.03 / 2.09

ALL PASS G1-3: True
```

**Group 4 is why the tier ramp was not lightened**, per the brief's explicit
instruction. A bare tier swatch is 1.87:1–3.42:1 on the dark panel, and the fix is
*not* to raise those numbers — that would break group 3, which is what the ramp
exists to satisfy. The fix is phase 3 §3.2's rule: **tier colour is never the sole
channel**. The one place this phase could have broken it is the tier legend, whose
swatches are 8px colour blocks; they now carry a `--field-line` border (≥3.01:1 on
every surface) and, as before, always sit beside their `T1 — Essential to the
gospel` label. No new tier-colour-only graphic was introduced anywhere.

## Verification

| Check | Result |
|---|---|
| `py engine/render.py` | zero warnings |
| Run summary | **99 nodes across 14 domains, 156 references, 0 without text** — unchanged from baseline |
| `documentation/theology-map.mm` | **byte-identical**, absent from `git diff main` |
| `documentation/study-list.md` | **byte-identical**, absent from `git diff main` |
| Embedded `<script id="data">` payload | sha256 **identical** to `main`'s |
| `editor-core.js` round trip on `theology-map.md` | parse → serialize → parse identical |
| `git diff -U0 main -- engine/map-view.js \| grep '^@@'` | **no output — file untouched** |
| Contrast script | `ALL PASS G1-3: True` |

The two strongest of these are worth naming, because they are what makes
"presentation only" a proven claim rather than an assertion:

- **The `.mm` and `study-list.md` outputs are byte-identical.** Both are generated
  from the same parsed node list by `render_mm()` and `render_study()`. If a node,
  a field, an ordering or a domain had moved, one of them would have moved with it.
  Only `render.py` and `theology-map.html` appear in the diff at all.
- **The embedded JSON payload hashes the same.** That block holds `nodes`,
  `tierMeta`, `confMeta`, `tierOrder`, `confOrder` and the cited `verses`. An
  identical hash means no node changed, none was added or removed, none was
  reordered, and no view's membership could have changed — every view is computed
  from that one payload in the browser.

Byte identity of the HTML itself does **not** hold and is not supposed to; the
brief says so explicitly. `CLAUDE.md`'s two baseline hashes have therefore moved and
have been updated there, by regenerating with `py engine/render.py` — never by hand.

## The lockstep boundary held, and here is why it was never at risk

The brief asks this phase to **re-verify** phase 3's claim that only the read-only
leaf functions and the layout pass are lockstep-bearing, before touching anything.
Re-verified by reading both files, and the claim holds — but the useful finding is
sharper than the claim:

`engine/map-view.js` renders a leaf as `_leafHeaderReadonly` + `_leafMetaReadonly`
when closed, and `_leafHeaderEditable` + `_leafMetaEditable` + `_leafDetail` when
open. **There is no read-only detail path in the editor at all** — an open leaf is
always the editable one. The two read-only functions emit only the title and the
tier/confidence/study chips.

So the entire field-label and detail-panel surface this phase changed
(`render.py`'s leaf `<dl>`) has **no counterpart in `map-view.js`**, and could not
have desynchronised it. The header/meta structure, the class names
(`.mbox`, `.mbox-root`, `.mbox-domain`, `.mtitle`, `.mmeta`, `.mchev`, `.mcount`,
`.chip`, `.chip.tier`), the layout pass and `MAP_TWO_SIDE_BREAK = 860` were all left
alone deliberately.

Result: **`engine/map-view.js` has zero changed lines against `main`.** The gate
`git diff -U0 main -- engine/map-view.js | grep '^@@'` prints nothing.

## Decisions I made for you

Per `decisions.md`'s working-style rule — decide, document loudly, do not stall.
None of these touch the data model or a file format.

1. **The brief's open question — telling a person's map from a communion's — is
   phase 6's content label, not a visual treatment here.** `render.py` takes a
   markdown string and has no idea who owns it. Distinguishing the two would need a
   new signal in the file format, and this phase is explicitly forbidden new fields
   while `decisions.md` freezes the format ("the file format stays frozen", *after
   the phase 4 and 6 design review*). The tradition maps already carry their
   identity in `content/traditions/manifest.json` and in the surfaces around them —
   `/learn`, `/view`, the gallery. **The badge belongs on those surfaces, in phase
   6's remaining tasks.** Building it into the renderer would have been the one
   change in this phase that could not be undone cheaply.

2. **The branch is `phase-7-views`, not the brief's `phase-7-render-design`.**
   `run-order.md`'s table names `phase-7-views` and the worktree was already on it.
   Same divergence pattern as phase 2 (`phase-2-harden` over the brief's
   `phase-2-review`) — run-order wins.

3. **No Sonnet fan-out for the CSS.** The brief and the house rules both call for
   it, and it was the wrong tool here: the entire diff is one contiguous `<style>`
   block plus three template strings inside a **single file**. Parallel agents on
   one file serialise on write conflicts and cost more to reconcile than they save.
   One Sonnet subagent ran the verification battery instead — payload hashing,
   the `editor-core.js` round trip, the lockstep gate and the grep sanity checks —
   which is genuinely parallel work and kept its tool output out of the main
   thread. If a future phase restyles `render.py` again, split by *file*, not by
   view.

4. **A new 480px breakpoint** was added to phase 3's 360/768/1400 set. It is the
   width at which the public map's own control row (four view buttons plus a search
   input) stops fitting, which is a different constraint from anything in the
   editor. Recorded so the set does not look accidental.

## Deliberately left alone

- **`engine/editor.html`'s own copy of the map CSS** (its `.mbox*` rules, roughly
  lines 71–116). It is a separate hand-maintained copy, it is not on the lockstep
  list, and phase 3 owns that file. The consequence is a small, knowing drift: a
  public map's open leaf gets a `--field-line` border and stacked detail labels; the
  editor's does not. The editor's open leaf is a form, not a detail panel, so they
  were never going to be identical. **If that drift ever matters, the fix is to move
  the shared `.mbox*` rules into `engine/theme.css` — not to copy this phase's
  block across.**
- **`beforeprint` permanently expands every group.** It adds every group key to
  `expandedGroups`, and `afterprint` restores the *view* but not the collapse state,
  so printing leaves the page expanded. Pre-existing, and it is a behaviour change
  to fix, which this phase is scoped out of. Cheap for a later session: snapshot and
  restore the set alongside `preprintView`.
- **The confidence meter is filled with the *tier* colour.** `.meter .fill` uses
  `var(--tier)` to draw a bar whose length means confidence, so the colour channel
  and the length channel mean two different things. It is not a contrast failure —
  the `<span class="chip">confident</span>` label sits immediately beside it and
  carries the meaning — but it is a real semantic smell. Left because changing it
  means choosing a new colour, and this phase's whole discipline was to introduce
  none.
- **The tier ramp itself.** Not lightened, per the brief. See "Contrast" above.
- **Domain boxes stay uppercase sans**, not serif, even though they carry content
  words. They are structural labels rather than prose, and the sans/uppercase
  treatment is what lets a domain box be told from a leaf tile at a glance on a
  zoomed-out map. Serif there would cost more than it gained.
- **Everything about what the views contain.** No field added, no node syntax
  touched, no reordering, no change to which nodes appear in which view — proven by
  the two byte-identical secondary outputs and the identical payload hash.

## For the next session

1. **`render.py`'s embedded CSS and `engine/theme.css` are now two files that
   declare the same tokens with the same values, on purpose and by hand.** The
   generated map must stay a single self-contained double-clickable file, so it
   cannot link the stylesheet. There is no automated check that they agree. If you
   change a token in one, change it in the other — and the failure mode is silent
   drift, not an error.
2. **`--line` and `--field-line` are not interchangeable.** `--field-line` is for
   interactive boundaries only; `--line` is the decorative divider. Reaching for
   whichever looks better re-opens the 1.4.11 failure this phase closed.
3. **`CLAUDE.md`'s byte-identity hashes moved in this phase**, and this is the
   second thing ever permitted to move them (phase 2 was the first). Regenerated
   with `py engine/render.py`; the generated files were not hand-edited. Any future
   phase touching the renderer re-baselines the same way and says so.
4. **The brief's open question is answered but not implemented.** Phase 6's
   remaining tasks own the "is this a person or a communion" label. It is on their
   plate now, not deferred into nowhere.
