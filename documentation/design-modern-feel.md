# Modern feel — a visual and motion design review

*Written 2026-09-10. Report only; nothing in the app was changed.*

**Lane.** This is the third of three reviews. `ux-firstprinciples-constrained.md`
covered information architecture, flow and a motion plan (its §4); the
unconstrained one covered what the product would be if rebuilt. Neither is
repeated here. This one covers **feel**: what the surfaces look like, how they
respond to a finger, and what a design system for this product should actually
contain.

Everything below respects the settled decisions: the map becomes the app, the
`render.py` / `map-view.js` unfork goes ahead, accounts stay required, the nav
becomes **My map · Questions · Learn · Browse · ⋯**. Every mechanism proposed
here is native — no framework, no bundler, no CDN, no npm — and `engine/editor.html`
keeps working from `file://` with no network.

---

## 1. Honest read of how it looks today

### What is genuinely good

**The palette is real work and it should survive whatever else changes.**
`engine/theme.css:10-19` is a warm paper ground (`#f6f3ec`) with a panel a shade
*above* it (`#fffdf8`) rather than below — that inversion is the correct one for a
paper metaphor and most people get it backwards. The dark theme at `:17-19` is not
a mechanical inversion: `--bg:#15120d` and `--panel:#201b14` keep the same
panel-above-ground relationship and the same warm hue rotation. That is
deliberate and it reads.

**The tier ramp is the best single decision in the codebase.**
`engine/theme.css:39-46`. Six values, garnet → rust → ochre → olive → teal →
slate, one continuous warm-to-cool gradient rather than six status hues, every
one dark enough to hold white text at AA in both themes, with the amber failure
recorded so it cannot come back. That ramp is also *semantically correct*: triage
is an ordinal scale and the ramp is monotone along it, so a person can read
"further along the ramp" as "less central" without a legend. Do not touch it.

**The interactive-boundary split.** `--field-line` for controls, `--line` for
dividers, with the 1.36:1 measurement written down at `engine/theme.css:25` and
the rule "do not merge these two" at `:48-49`. That is a design system thinking
about itself.

**Content-driven map box widths.** `engine/render.py:453-461` clamps a collapsed
leaf to 150–320px and an expanded one to 340–560px "≈45–70ch at this font size".
Somebody measured a reading line inside a map node. That is craft.

**The 58ch cap actually applied**, not just declared: `engine/theme.css:169`,
`:88`, and `render.py:387`'s `max-width: min(58ch, 100%)` — the `min()` so a
narrow container (a map tile, a print column) does not overflow. Correct.

**`.tm-note` refusing to be a bare tint.** `render.py:283-285` records that
`--note` is 1.08:1 on `--bg`, "so it never appears without a rule and a label
beside it", and `theme.css:55-62` enforces it with a 3px left rule. That is the
right answer to a decorative surface.

**The tier swatch carrying a border.** `render.py:426-430`: the swatches are
1.87–3.42:1 on the dark panel alone, so each carries a `--field-line` border and
sits next to its label. Colour is never the sole channel. Written down, enforced.

### What reads as dated or unfinished

**The header is a document masthead, not a product bar.** `theme.css:124-130`:
a 10px uppercase kicker, a 22px serif h1, and a row of 12px sans links below.
That is a 2013 blog header. It also repeats the word "Theology Map" on every
single page above a page title (`chrome.js:36-37`), so the top 60px of every
screen carries no information. The nav change already agreed fixes half of this;
the masthead shape is the other half.

**Nothing indicates where you are.** `chrome.js:45-64` builds the link list with
no `aria-current`, no active state, no visual difference between the page you are
on and the four you are not.

**No `color-scheme` anywhere.** Grep across `web/`, `engine/theme.css` and
`engine/render.py` returns `prefers-color-scheme` media queries only — the
`color-scheme` *property* is never declared. Consequence in dark mode: every
native control renders in the browser's light appearance. The PIN field at
`landing.html:86`, the checkbox at `wizard.html:201`, the caret, the default focus
ring, the scrollbars, and the `<dialog>` backdrop are all light-mode widgets
sitting on a `#15120d` page. This is the most visible unfinished thing in the
product and it is one declaration.

**The focus ring is removed from the most important field in the app.**
`web/wizard.html:177`:

```css
.wz-holdfield textarea:focus, .wz-holdfield input:focus { outline: none; }
```

The wrapper `.wz-holdfield` (`:171-172`) has a static border and **no
`:focus-within` rule** — grep for `focus-within` across the whole repo returns
nothing. So the field where a person types the belief that goes on their map has
no visible focus state at all on any platform. That is a WCAG 2.4.7 failure on
the product's primary input.

**There is no disabled state.** `landing.html:151`, `:172`, `:199`,
`history.html:110` and `web/wizard.js` all set `button.disabled = true` in JS. The
only `:disabled` CSS in the hosted app is `admin.html:20`. So the Sign-in button
mid-request, the Restore button mid-request, and the Listing-status tile which
*loads disabled* (`landing.html:151`, showing "Checking whether your map is
listed…") are all pixel-identical to live controls.

**No `::selection`, no `accent-color`, no `caret-color`.** Selecting text on a
warm cream page paints it browser-default blue; `.wz-check input`
(`wizard.html:201`) is a browser-blue checkbox on that same page. `render.py:334`
sets `accent-color: var(--accent)` on one toggle in the generated map and no
other surface in the product does.

**Cards do not respond to the pointer.** `theme.css:78-93` styles `.tm-card`,
`:164` makes the whole card a link, `:166` gives it `:focus-visible` — and there
is no `:hover` and no `:active`. On a phone (`@media (hover: none)`) there is no
press feedback of any kind on the primary tiles of the front door and the gallery.

**Motion is effectively absent, and the one real animation is unreachable.** Grep
for `transition|animation|@keyframes` across `web/` and `theme.css` returns three
lines: `gallery.html:21-22` (skeleton pulse), `theme.css:106` (a 150 ms disclosure
triangle). The one substantive piece of motion in the entire product is
`render.py:447` / `map-view.js:486` — map boxes are positioned by `transform:
translate()` with `transition: transform .28s ease`, so the tree re-lays out with
a real 280 ms settle when you expand a domain. It is good, and on a phone it sits
behind three taps inside a sandboxed iframe. **`prefers-reduced-motion` is honoured
in exactly one place in the repo** (`gallery.html:20`) — that map transition is not
guarded.

**Horizontal scroll with no affordance.** `theme.css:142-144` makes the nav
scroll sideways below 640px. No fade, no scrollbar styling, no indication that
there is more. Same at `compare.html:28` (`#sc-table-wrap`) and `render.py:528`.

### What reads as "generated"

**Twenty-two distinct font sizes.** Counting declared `font:`/`font-size` values
across `theme.css`, `landing.html`, `wizard.html`, `learn.html`, `compare.html`,
`view.html`, `history.html`: 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5,
15, 15.5, 16, 17, 19, 20, 22, 23, 24, 26, 28, 32. Twenty-two steps to express
maybe six levels of hierarchy. Nothing is 0.5px more important than anything
else; those half-pixels are the fingerprint of each rule being tuned in isolation
against the paragraph next to it, which is exactly how a generated stylesheet
grows. A reader cannot learn a hierarchy with 22 levels, so the pages read as
flat despite considerable effort having gone into them.

**Five competing uppercase label registers.** `theme.css:125-126` (`.kicker`,
10px/.16em), `wizard.html:169-170` (`.lab`, 11px/.04em), `wizard.html:153-154`
(`.wz-outside`, 11.5px/.04em), `learn.html:84` (`.lp-pos-label`, 11px/.04em),
`learn.html:54-56` (`.lp-tiernote .lab`, 10.5px/.06em), plus `render.py:382-383`
(`dt`, 10px/.08em). Six sizes, four letter-spacings, one visual idea. Tracked-out
all-caps micro-labels above every block is *the* commonest tell of generated UI,
and here there are six variants of it.

**Four radii for the same object class.** 4px (`.chip`, `.lp-refchip`), 5px
(`landing.html` inputs and buttons), 6px (`.wz-more`, `.tm-action-btn`,
`history.html` list rows), 7px (`.wz-ghost`, `.wz-radio span`, `.mbox`), 8px
(`.lp-row`, `.wz-area`, `.cmp-acc`), 9px (`.tm-card`, `.wz-card`, `.lp-pos`),
20px (`render.py:417` `dd.rel a`), 99px (`.tchip`, `.lp-tier`, `.cmp-tier-pill`).
Eight radii, no rule for which is which.

**Hard-coded magic gutters repeated by hand.** `wizard.html:117`, `:119`, `:153`,
`:155` each carry `padding-right: 88px` to clear one absolutely-positioned button,
with a comment at `:113-115` explaining the number. Four hand-kept copies of a
measurement is a layout that has not been given a mechanism.

**Raw black shadows.** `wizard.html:146` `0 8px 24px rgba(0,0,0,.18)` and
`view.html:50` `0 1px 6px rgba(0,0,0,.28)`. Meanwhile `render.py:290` defines a
proper tinted `--shadow` with a warm rgba and a dark-mode variant — and
`theme.css` does not have it. Two of three surfaces roll their own black shadow
on a warm paper page, which is the grey-shadow-under-every-card tell.

**The token block is forked three ways and already out of step.** CLAUDE.md says
`render.py`'s `:root` and `theme.css` "declare the same tokens with the same
values, by hand". There is a third copy at `engine/editor.html:18-27`, and the
three do not agree:

| | `theme.css:9-20` | `render.py:278-297` | `editor.html:18-27` |
|---|---|---|---|
| `--good` / `--bad` | yes | **no** | yes |
| `--mono` | **no** | yes | no |
| `--shadow` | **no** | yes | no |
| `--accent` | declared, **never read** | read once (`:334`) | declared, never read |

`--accent` is a dead token in two of three copies. This is the drift the doc says
to watch for, already happened.

**A stated fork that phase 10 was supposed to have deleted.** `web/learn.html:12-14`
still declares its own `--t1`…`--t4`. Already logged as F9 in the constrained
report; noted here only because it is visible evidence that hand-copied token
blocks do not stay in step.

**Touch targets undercut by the file that sets them.** `theme.css:110-119` sets a
44px floor on coarse pointers — and `:118` sets `.wz-radio span, .mradio span
{ min-height: 38px }`, which is the tier and confidence pickers, the most-tapped
controls in the question flow, at 38px.

---

## 2. The fork: Lane A vs Lane B vs Lane C

### The honest tension

CLAUDE.md pins: *"warm paper-and-ink palette in both themes, serif reserved for
content and sans for chrome, prose capped at 58ch, tier colours a garnet→slate
warm-to-cool ramp chosen for WCAG AA contrast with white chip text."* The brief
asks for **modern, fluid, possibly high-tech / futuristic / next-gen.**

These are not the same request and there is no wording that makes them the same.
"Next-gen" as a visual register in 2026 means a specific, identifiable kit: dark
ground, translucent layered surfaces behind `backdrop-filter`, luminous accents,
gradient meshes, dimensional depth, kinetic type, hairline glows on focus. That
kit is coherent and it is genuinely current. It is also the opposite of paper.

### Lane B, argued properly before it is rejected

**What it would gain.** A real answer to "the app feels static". Depth is the
fastest route to perceived quality — a layered interface with consistent elevation
reads as more considered within about 200 ms of first paint, before any of the
typography is processed. The map canvas in particular would benefit: a graph on a
dimensional substrate is a genuinely better representation of a graph than a graph
on flat cream. And the owner's own repeat use is on desktop and iPad, where a dark
dimensional canvas is comfortable and where the extra GPU cost is free.

**What it would cost, concretely, not rhetorically:**

1. **The AA guarantee on the tier ramp dies.** The ramp's whole justification
   (`theme.css:32-38`) is 5.0–9.2:1 for white chip text — computed against known
   opaque backgrounds. `backdrop-filter` puts a *translucent* surface behind those
   chips whose effective background depends on what is scrolled underneath. The
   contrast becomes unknowable and therefore unguaranteeable. You would have to
   either re-derive the whole ramp for the worst case (darkening it until it is no
   longer a warm-to-cool ramp) or drop glass from every surface that carries a tier
   chip — which is most of them.
2. **The hand-copy obligation roughly triples.** Today `render.py:278-297` copies
   ~14 tokens. A depth system is elevation × 2 themes × 3-4 levels, plus glow
   colours, plus gradient stops. All of it hand-copied into a Python string that
   nothing checks. The table in §1 shows the three-way copy is *already* out of
   step at 14 tokens.
3. **`backdrop-filter` on a `file://` page with no network is fine, but a heavy
   layered editor is not.** `engine/editor.html` is 51 KB of self-contained page
   that must stay double-clickable. Every layer added is added there by hand too.
4. **Dark-first is wrong for the primary audience.** A church member on a phone,
   handed a link on a Sunday, in daylight. Light-first is not a stylistic
   preference there, it is legibility.
5. **The palette work is thrown away.** Not "adapted" — the warm paper ground has
   no role in a glass system; you would be starting the colour work over.

**And the subject-matter question, which is the deciding one.**

This product's entire ethical architecture is *refusal to compute a verdict*.
Compare is "descriptive, never evaluative" and CLAUDE.md defends that at length.
There is deliberately no score attached to a person, no leaderboard, no
aggregate. `/learn` says "suggested" on every tier chip specifically so a
stranger does not read a coloured `T1` as the site's judgement. Nothing appears
in a map that the person did not write.

The next-gen register is the visual language of *computed authority*. Glow,
gradient, depth, kinetic readouts — that is the vocabulary of dashboards,
analytics, trading, AI products: systems that have processed your data and are
telling you what it means. `theocompass.com` looks like that because it *does*
that: it computes your position and hands it to you on a compass chart.

If this app adopted that chrome it would be making a visual promise its
architecture spends its whole existence refusing to keep. A person would open a
glowing dimensional interface, answer eighteen questions, and expect a verdict —
and the honest, correct, carefully-defended answer is *there is no verdict, these
are your own words back*. That is not a mood mismatch. It is the interface
contradicting the product.

There is a second, quieter point. This is a record of a person's religious
convictions, held over years, revised slowly. The paper metaphor is not
decoration here; it says *this is a document you are keeping*, which is exactly
what it is. A commonplace book, a notebook, a confession — not a session with a
system.

### Lane C, taken seriously and then folded in

The seam I would actually defend is not "content vs map". It is **substrate vs
tile**: the map's *ground plane* is machinery — a computed layout, a pan/zoom
viewport, a coordinate space — and can legitimately be dimensional. The things
*on* it are documents and stay paper.

That seam is defensible, and §7 spends most of its length on it. But I will not
call it a third lane, and the reason is practical: naming it Lane C licenses two
design systems, and two design systems in a codebase that already forks its token
block three ways will drift within one round. Call it what it is — **one surface's
background layer, inside Lane A** — and it stays a single decision instead of a
second vocabulary.

### Recommendation: Lane A, with the map substrate as a named exception

**Evolve the paper-and-ink language into something that reads premium and
current. Modern by craft.**

The reason this is not a compromise: nothing in §1's "dated / generated" list is
caused by the palette. Twenty-two font sizes, six uppercase registers, eight
radii, a missing `color-scheme`, a removed focus ring, absent hover and disabled
states, black shadows on a warm page, no motion — every one of those is a
*systems* failure, and every one of them would still be there after a repaint in
glass. The app does not read dated because it is warm. It reads dated because
nothing in it agrees with anything else.

The products that read as most current right now and use none of the sci-fi kit —
Linear, Things, iA Writer, Readwise Reader, Are.na, Stripe's docs — share five
things, and all five are available here for free:

1. **A type scale with few steps and real jumps between them.**
2. **A spacing rhythm you can feel** — a small number of distances, used
   consistently, generously.
3. **Surfaces that are quiet and states that are loud** — the resting page is
   almost featureless; hover, focus, selection and disabled are unmistakable.
4. **Motion that is short, precise, and attributable** to the thing you just
   touched. Nothing floats.
5. **One colour system, used sparingly.** Here that is already the tier ramp, and
   it is better than a brand accent because it carries meaning.

Add the one licensed exception — the map canvas gets a real substrate with
depth, parallax-correct grid and zoom-aware detail — and the app gets a genuinely
"next-gen" moment exactly where the subject matter permits one: over the machine
artifact, not over the person's confession.

---

## 3. The design system, upgraded

All of this goes in `engine/theme.css`. **Anything landing in `:root` incurs the
hand-copy obligation into `engine/render.py:278-297` and
`engine/editor.html:18-27`.** Marked below.

Before adding anything: reconcile the three-way fork in §1. Add `--mono` and
`--shadow` to `theme.css` and `editor.html`; add `--good`/`--bad` to `render.py`
or delete them from the other two if the generated map genuinely has no status
text; **delete `--accent` from `theme.css` and `editor.html`** where it is read by
nothing, or better, keep it in all three and actually use it for `accent-color`
(§5, small win 12).

### 3.1 Spacing — 4px base, eight steps

```css
/* :root — HAND-COPY into render.py and editor.html */
:root {
  --s1: .25rem;   /*  4px — inside a chip */
  --s2: .5rem;    /*  8px — between a label and its value */
  --s3: .75rem;   /* 12px — between rows in a card */
  --s4: 1rem;     /* 16px — card padding, gap in a grid */
  --s5: 1.5rem;   /* 24px — between blocks */
  --s6: 2rem;     /* 32px — between sections */
  --s7: 3rem;     /* 48px — page top/bottom */
  --s8: 4.5rem;   /* 72px — the one big silence, above a screen title */
}
```

The current sheet uses 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 18, 20, 22 and 26px.
Snapping those to eight values is a large diff with no behaviour change, and it
is most of what makes the pages read as one product. The rule to write down:
**gaps come from this scale or they are a bug.**

### 3.2 Radius — four steps with assigned jobs

```css
:root {
  --r1: 4px;    /* data marks: reference chips, swatches, table cells */
  --r2: 8px;    /* controls: buttons, inputs, radio pills, ghost buttons */
  --r3: 12px;   /* containers: cards, panels, map tiles, popovers */
  --r-pill: 999px; /* status only: tier chips, the tier bar */
}
```

Four, with a rule: **a thing you press is `--r2`; a thing that holds other things
is `--r3`; a thing that is a value is `--r1`; a thing that is a state is a pill.**
That resolves all eight current radii and it explains why `.tchip` and
`.lp-refchip` should *not* look the same — one is a status, one is a citation.

`.tm-card` moving 9px → 12px is a felt change and it also moves `render.py:364`
(`.node`) and `:446` (`.mbox`). That is a presentation-only change, licensed by
the phase-7 precedent, and gated by the two surviving invariants:
`documentation/study-list.md` and the embedded `<script id="data">` payload must
stay byte-identical. Regenerate and check both.

### 3.3 Elevation — three steps, tinted, never black

```css
:root {
  --e1: 0 1px 2px -1px color-mix(in oklab, var(--ink) 20%, transparent);
  --e2: 0 2px 4px -2px color-mix(in oklab, var(--ink) 16%, transparent),
        0 8px 16px -12px color-mix(in oklab, var(--ink) 28%, transparent);
  --e3: 0 4px 8px -4px color-mix(in oklab, var(--ink) 18%, transparent),
        0 24px 40px -24px color-mix(in oklab, var(--ink) 40%, transparent);
}
@media (prefers-color-scheme: dark) {
  :root {
    --e1: 0 1px 2px -1px rgb(0 0 0 / .5);
    --e2: 0 2px 4px -2px rgb(0 0 0 / .45), 0 8px 20px -12px rgb(0 0 0 / .6);
    --e3: 0 4px 8px -4px rgb(0 0 0 / .5),  0 24px 44px -24px rgb(0 0 0 / .7);
  }
}
```

`color-mix(in oklab, …)` off `--ink` is the point: on the cream theme the shadow
is a warm brown-grey, not neutral grey, so it reads as paper under paper rather
than the stock `rgba(0,0,0,.1)` card shadow. Dark mode goes back to black because
`--ink` there is *light* and mixing it would produce a glow.

Assignment: `--e1` for resting cards and map tiles, `--e2` for popovers and open
map tiles, `--e3` for the picker `<dialog>` (`theme.css:178`) and nothing else.
This replaces `render.py:290`'s single `--shadow`, `wizard.html:146` and
`view.html:50`.

### 3.4 Motion tokens — three durations, three easings

```css
:root {
  --dur-1: 120ms;   /* state under the finger: hover, selection tint, press */
  --dur-2: 200ms;   /* something appears or leaves */
  --dur-3: 320ms;   /* something that exists moves somewhere else */

  --ease-out:   cubic-bezier(.2, 0, 0, 1);    /* arriving — decelerate hard */
  --ease-in:    cubic-bezier(.4, 0, 1, 1);    /* leaving */
  --ease-move:  cubic-bezier(.4, 0, .2, 1);   /* moving between two on-screen places */
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-1: 1ms; --dur-2: 1ms; --dur-3: 1ms; }
}
```

Zeroing the tokens under `prefers-reduced-motion` means every rule that uses them
is guarded by construction, which is a stronger guarantee than remembering a
media query per rule. The blanket `*` guard the constrained report proposes at its
§4.5 stays as well — it catches anything that hard-codes a duration.

`--ease-out`'s control points are deliberately aggressive. A gentle ease is what
makes motion read as floaty and slow; a hard decelerate at 200 ms reads as
*immediate and physical*, which is the actual difference between "animated" and
"responsive".

### 3.5 Type — seven steps, fluid, with line-height and measure

```css
:root {
  /* label/meta steps are fixed: fluid micro-type is jitter, not craft */
  --fs-000: .6875rem;  /* 11px   — the ONE uppercase label register */
  --fs-00:  .78125rem; /* 12.5px — meta, counts, timestamps (sans) */
  --fs-0:   .875rem;   /* 14px   — secondary prose, hints */
  /* content steps are fluid */
  --fs-1: clamp(.9375rem, .89rem + .22vw, 1rem);      /* 15 → 16 body */
  --fs-2: clamp(1.0625rem, .99rem + .35vw, 1.1875rem);/* 17 → 19 card heading */
  --fs-3: clamp(1.25rem, 1.10rem + .70vw, 1.5rem);    /* 20 → 24 section heading */
  --fs-4: clamp(1.625rem, 1.32rem + 1.5vw, 2.25rem);  /* 26 → 36 screen title */

  --lh-tight: 1.2;   /* --fs-3 and up */
  --lh-snug:  1.35;  /* headings at --fs-2, chips, controls */
  --lh-body:  1.6;   /* serif prose */
  --lh-ui:    1.45;  /* sans UI text */

  --measure: 58ch;       /* the documented prose cap — unchanged */
  --measure-wide: 68ch;  /* lead paragraphs and notes only */
}
```

Seven steps against today's twenty-two. The two rules that make it work:

- **The jumps are big enough to see.** 14 → 17 → 20 → 26 is a ~1.2 modular scale.
  Today's 13.5 → 14 → 14.5 is not a hierarchy, it is noise.
- **`vw` only appears above 15px.** Fluid 11px type resizes into fractional pixels
  and looks blurry; label sizes stay fixed.

`--fs-4` at 26 → 36px replaces `wizard.html:57`'s hard 32px and gives the intro
screen a real display size on an iPad while staying phone-safe.

### 3.6 The two declarations that change dark mode

```css
:root { color-scheme: light dark; }        /* HAND-COPY — see §4, B2 */
:root { accent-color: var(--ink); }
```

### 3.7 Native features this system leans on

`color-mix()` for elevation and tier tints; `clamp()` for type; `text-wrap:
balance` / `pretty`; `interpolate-size: allow-keywords` with `::details-content`
(constrained §4.3); `@starting-style` for arrival; View Transitions (constrained
§4.1–4.2); `@property` for the map's animatable `--zoom` (§7); `field-sizing:
content` to replace `map-view.js:246`'s JS autosize; `scrollbar-width` /
`scrollbar-color`; CSS anchor positioning as the eventual replacement for
`wizard.html:117`'s four hand-copied `padding-right: 88px` gutters and for the
hand-rolled `.wz-pop` (constrained F11). All degrade to today's behaviour where
unsupported.

---

## 4. Big wins

### B1 — Land the type and spacing scale across every surface · **L** · low risk

**What.** §3.1 and §3.5 into `theme.css`, then every `font:` shorthand and every
`gap`/`padding` in `web/*.html` rewritten against them.

**Why.** This is the single change that moves the app from "functional" to
"considered", and it is the one thing a glass repaint would *not* have fixed.
Twenty-two type sizes is why the pages read flat: there is no size at which the
eye can stop and say "this is the level above". Seven steps with visible jumps
gives every screen a spine.

```css
/* engine/theme.css — the primitives, then every page reads them */
body.tm-page { font: var(--fs-1)/var(--lh-body) var(--serif); }

.tm-card h3 { font: 600 var(--fs-2)/var(--lh-snug) var(--serif); margin: 0; }
.tm-card p  { font: var(--fs-0)/var(--lh-body) var(--serif); max-width: var(--measure); }
.tm-card    { padding: var(--s4); gap: var(--s2); border-radius: var(--r3); }
.tm-stat    { font: var(--fs-00)/var(--lh-ui) var(--sans); }
.tm-prose p { margin: 0 0 var(--s3); }
.tm-grid    { gap: var(--s4); }
```

```css
/* web/wizard.html — the screen titles get a real display size */
#screen-intro h2, #screen-lens h2, #screen-question h2,
#screen-home h2, #screen-area h2 {
  margin: 0;
  font: 400 var(--fs-3)/var(--lh-tight) var(--serif);
  letter-spacing: -.012em;
  max-width: 26ch;
  text-wrap: balance;
}
#screen-intro h2 { font-size: var(--fs-4); max-width: 17ch; }
```

Note `letter-spacing: -.012em` on the large serif steps: display-size serif needs
negative tracking to stop looking loose, and today only two rules do it
(`theme.css:127`, `wizard.html:35`) while the 26px and 32px titles do not.

**Files.** `engine/theme.css`, all eight `web/*.html`, and — for `:root` only —
`render.py:278-297` and `editor.html:18-27`.

**Risk.** Wide diff, no logic touched. Do it page by page; each page is
independently revertable. `py tests/syntax_check.py` is unaffected (CSS only).
If `render.py`'s body sizes change, regenerate and verify `study-list.md` and the
`<script id="data">` payload byte-identical.

---

### B2 — `color-scheme: light dark` and a dark mode that has structure · **S** · very low risk

**What.**

```css
/* engine/theme.css — HAND-COPY the :root line into render.py and editor.html */
:root { color-scheme: light dark; accent-color: var(--ink); }
```

Plus a dark-mode surface fix. In dark, `--line: #372f22` on `--panel: #201b14` is
≈1.3:1 — legitimate for a decorative divider (3:1 applies to controls, and
`--field-line` correctly covers those), but it means **card edges are invisible in
dark mode** and every screen flattens into one brown field. The fix is not to
raise `--line` (it would shout in the light theme's borrowed rules); it is to give
dark-mode containers elevation instead of relying on the edge:

```css
@media (prefers-color-scheme: dark) {
  .tm-card, .wz-card, .lp-pos, .lp-mine, .wz-area, .cmp-row, .cmp-acc,
  .tm-picker, .wz-stat {
    box-shadow: var(--e1);
    border-color: color-mix(in oklab, var(--line) 60%, var(--panel));
  }
}
```

**Why.** `color-scheme` is one declaration that repaints every native widget,
scrollbar, caret, default focus ring and `<dialog>` backdrop to match the page.
It is the largest visible-quality-per-character change available anywhere in this
codebase. The elevation half is what stops dark mode reading as a flat wash.

**Files.** `engine/theme.css`, `engine/render.py:278`, `engine/editor.html:18`.

**Risk.** `color-scheme` changes the appearance of every form control in both
themes — light-mode controls also become explicitly light rather than
default-light, which is a no-op in practice. Check `landing.html`'s two forms and
`admin.html` once in each theme.

---

### B3 — A real state system: focus, hover, press, selection, disabled · **S/M** · low risk

**What.** One block in `theme.css`, plus deleting `wizard.html:177`.

```css
/* engine/theme.css */

/* One focus ring for the whole product. --ink in light, --ink in dark (it is
   the light value there) so it reads against both grounds; the offset is what
   makes it visible on a bordered control. */
:where(a, button, summary, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
  border-radius: var(--r2);
}

/* The belief field. wizard.html:177 removes the ring from the textarea; the
   ring belongs on the WRAPPER, which is the thing that looks like the control. */
.wz-holdfield:focus-within {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
  border-color: var(--ink);
}

/* Press feedback, which coarse pointers get no hover substitute for today. */
@media (prefers-reduced-motion: no-preference) {
  .tm-card, .wz-card, .lens, .wz-qrow, .lp-row, .tm-action-btn, .wz-ghost {
    transition: border-color var(--dur-1) var(--ease-out),
                background-color var(--dur-1) var(--ease-out),
                box-shadow var(--dur-1) var(--ease-out);
  }
  :where(.tm-card, .wz-card, .lens, .wz-qrow, .lp-row, button):active {
    scale: .995;
    transition-duration: 60ms;
  }
}

a.tm-card:hover, .tm-cardlink:hover, .lp-row:hover, .wz-qrow:hover {
  border-color: var(--field-line);
  background: color-mix(in oklab, var(--chip) 45%, var(--panel));
  box-shadow: var(--e1);
}

:where(button, .tm-action-btn, .wz-primary, .wz-ghost):disabled,
[aria-disabled="true"] {
  opacity: .45;
  cursor: default;
  box-shadow: none;
}

::selection { background: color-mix(in oklab, var(--t2-5) 25%, transparent); }
```

**Why.** Three of these are correctness, not polish: the belief textarea currently
has no focus indicator at all; four disabled buttons across `landing.html` and
`history.html` look live; and a coarse pointer gets no acknowledgement that a tap
landed. The `::selection` line is the cheapest possible "this was designed" signal
— a warm olive selection on cream instead of system blue is noticed
subconsciously on the first drag.

**Files.** `engine/theme.css`; delete `web/wizard.html:177`; `web/admin.html:20`
and `engine/editor.html:58` can then drop their local `:disabled` rules.

**Risk.** The blanket `:focus-visible` uses `:where()` (specificity 0), so any
page-local ring still wins. Check `.wz-radio input:focus-visible + span`
(`wizard.html:194`) still applies — it does, higher specificity.

---

### B4 — The motion vocabulary, wired to the constrained report's §4 · **M** · medium risk

**What.** §3.4's tokens, then §6's four verbs applied. This *extends*
`ux-firstprinciples-constrained.md` §4 — it does not replace it. That report
specifies the mechanisms (cross-document `@view-transition`, same-document
`startViewTransition` around `showScreen`, `::details-content`,
`@starting-style`, the global guard). This adds the **grammar**: which duration,
which easing, how far, and the rule for what must not move.

The one thing to change in its §4.2: the directional keyframes there use `.22s
ease` and a 24px translate. Against §3.4 that becomes:

```css
@keyframes tm-out-left { to   { opacity: 0; translate: -12px 0; } }
@keyframes tm-in-right { from { opacity: 0; translate:  12px 0; } }
html[data-dir="fwd"]::view-transition-old(root) {
  animation: tm-out-left var(--dur-2) var(--ease-in) both; }
html[data-dir="fwd"]::view-transition-new(root) {
  animation: tm-in-right var(--dur-2) var(--ease-out) both; }
```

12px, not 24. A view transition is already communicating direction through the
crossfade; the translate is a hint, and 24px at 200 ms reads as a slide, which is
a heavier gesture than a question change deserves.

**Why.** Tokens without a grammar produce twelve different animations that each
looked fine alone. The grammar is what makes motion read as one system.

**Files.** `engine/theme.css`, `web/wizard.js:262-272`, `web/wizard.html`.

**Risk.** Cross-document view transitions apply to `/edit`, which is the offline
tool's file reached hosted. Harmless (it performs no navigations) but it is the
owner's file — flagged as decision 4 in the constrained report's §7 and still
open.

---

### B5 — The map substrate · **M** · medium risk · **blocked on the unfork**

Full treatment in §7. The headline: the dot grid at `render.py:436-437` is fixed
in page space while the boxes scale and translate, so zooming makes the tiles
grow *over a stationary background*. That single decoupling is why the map reads
as a scaled `<div>` rather than a surface you are moving across. Coupling the grid
to the pan/zoom transform is about six lines and it is the closest thing in this
review to the "next-gen" feel the brief asks for — earned, because it is a real
spatial cue, not a glow.

**Do this after the `render.py` / `map-view.js` unfork, not before.** Touching
lockstep-bearing code in two places by hand is how the fork got expensive.

---

### B6 — The answer-commit moment · **M** · low risk

**What.** The product's core loop is *answer a question → the map grows*, and
today the growth is invisible: a `POST /api/map` and a number on a launchpad you
have already left. One orchestrated moment, once per commit:

```css
/* web/wizard.html — the tier bar is the same object before and after */
#home-tierbar { view-transition-name: tierbar; }
#home-tierbar .wz-seg { transition: width var(--dur-3) var(--ease-move); }
```

```js
// web/wizard.js — around the existing commit path
function commitAndAdvance(fn) {
  if (!document.startViewTransition ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return fn();
  document.startViewTransition(fn);
}
```

The tier bar segments animate their `width` (they are already
percentage-widthed `<span>`s at `wizard.html:226-227`), so the bar *visibly
advances by one belief*. Nothing else moves. When the map becomes the app, the
same beat carries the node landing (§7).

**Why.** This is the one place in the product where a single orchestrated motion
is worth more than every hover transition combined, and it satisfies the "every
animation must justify itself" rule on the strongest possible ground: it is
feedback for the product's primary action, currently absent.

**Risk.** Low. The bar is presentational and `aria-hidden` in the gallery's
equivalent; keep the textual count (`#home-tiercounts`) as the accessible channel.

---

## 5. Small wins

Cheap, specific, each independently shippable.

1. **`text-wrap: balance`** on every `h1`, `h2`, `h3` and `.tm-card h3`; **`pretty`**
   on `p`, `dd`, `.tm-prose`, `.lp-prose`, `.wz-framing`. Kills widows and ragged
   two-word second lines everywhere. Two rules, zero risk.
2. **`font-variant-numeric: tabular-nums`** on `.wz-stat .num` (`wizard.html:222`),
   `.wz-area .pg`, `#wz-crumb`, `.tm-stat`, `.cmp-table`, and `relTime` output.
   Counts and timestamps currently shift width as they change.
3. **`aria-current="page"`** in `chrome.js:45-64` plus
   `.tm-chrome .toplinks a[aria-current] { color: var(--ink); border-bottom-color:
   var(--ink); }`. Tells you where you are; costs four lines.
4. **Scroll affordance on the nav.** `theme.css:142-144` scrolls horizontally with
   no cue. Add `scrollbar-width: none` and a fade:
   `mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent)`.
   Same treatment for `#sc-table-wrap` (`compare.html:28`) and `.views`
   (`render.py:528`).
5. **`scrollbar-color: var(--field-line) transparent`** on the two remaining
   scrolling containers. Native, one line, no custom scrollbar hacks.
6. **Fix the 38px radios.** `theme.css:118` sets `.wz-radio span, .mradio span
   { min-height: 38px }` inside a block whose whole point is a 44px floor. Raise
   to 44px; the padding at `wizard.html:190` already allows it.
7. **Collapse five uppercase registers into one.** Keep `.kicker` at `--fs-000`,
   `.16em`, uppercase. Drop `text-transform: uppercase` and the tracking from
   `.lab` (`wizard.html:169`), `.wz-outside` (`:153`), `.lp-pos-label`
   (`learn.html:84`), `.lp-tiernote .lab` (`:54`) — make them
   `600 var(--fs-000)/var(--lh-ui) var(--sans)` in `--muted`, sentence case.
   Six variants of one idea is the single loudest "generated" tell in the sheet.
8. **One radius per job** (§3.2). The visible change: `.tchip` and `.lp-tier`
   stay pills (they are statuses), `.lp-refchip` and `.chip` go to `--r1` (they
   are data), `render.py:417`'s 20px `dd.rel a` joins `--r2`.
9. **Tokenise the two raw black shadows.** `wizard.html:146` → `var(--e2)`;
   `view.html:50` → `var(--e2)`. A neutral grey shadow on a warm cream page is
   the SaaS-card tell and both instances are one word each.
10. **One `.tm-note` geometry.** `theme.css:58` uses `0 6px 6px 0`;
    `learn.html:52`'s `.lp-tiernote` uses `0 4px 4px 0` for the same object.
    Pick `0 var(--r2) var(--r2) 0` and delete the local rule.
11. **Empty state with an action.** `gallery.html:31` says "No public maps yet."
    and stops. It is the only thing on the screen for a first visitor to an empty
    instance. Append the existing `buildPrimaryCard` — the code is right there at
    `:122`.
12. **`accent-color: var(--ink)`** on `:root` — fixes the browser-blue checkbox at
    `wizard.html:201` and every future one, and finally gives the dead `--accent`
    token a job in all three copies.
13. **Loading state that looks like loading.** `landing.html:151-153` mounts the
    Listing-status tile `disabled` with the text "Checking whether your map is
    listed…" while looking exactly like a live tile. Give it `.tm-skel`
    (`gallery.html:15-19`) — the register already exists and is already
    reduced-motion-guarded.
14. **`.tm-working` is half a state.** `theme.css:176` sets `opacity:.6;
    pointer-events:none`. Add `cursor: progress` on the container and
    `aria-busy="true"` at the call site, so it announces as well as dims.
15. **Optical alignment of the tier chips.** `.lp-tier` (`learn.html:45-48`) and
    `.tchip` (`wizard.html:120-121`) use symmetric `5px 8px` padding on
    uppercase-ish sans in a pill. Pills need asymmetric horizontal padding to look
    centred: `5px 9px 5px 8px` reads level. Trivial, and it is the kind of thing
    that separates the two categories in the title of this report.
16. **Baseline-align the card header row.** `wizard.html:116` uses
    `align-items: baseline` (correct) but `.tm-card` (`theme.css:83`) is a plain
    flex column, so `h3` and `.tm-go` never share a baseline grid. Give
    `.tm-card` `gap: var(--s2)` and let `.tm-go` keep `margin-top: auto`.
17. **`field-sizing: content`** on `.wz-holdfield textarea` and the map's detail
    textareas. Native auto-grow; deletes `map-view.js:246`'s `autosize()` and its
    two call sites where supported (keep the JS as fallback until it is
    everywhere).
18. **`caret-color: var(--ink)`** on inputs and textareas. In dark mode the caret
    is currently the UA default and hard to find on `#201b14`; `color-scheme`
    (B2) fixes most of this, this pins it.
19. **`:target` and flash in the generated map.** `render.py:420-422` animates an
    outline over 1.4s with no `prefers-reduced-motion` guard. Wrap it, or replace
    the animation with a persistent `:target` outline plus `--dur-2` fade-in.
20. **Dark-mode `--note`.** `#2a2318` on `#15120d` is ~1.5:1 — the quiet-surface
    rule (`render.py:283-285`) says it must never appear without a rule and a
    label, and `theme.css:55-62` complies. Worth stating in the sheet that this
    is *why* the left rule is not optional in dark, because it is the first thing
    a future round will try to simplify away.
21. **`.mbox` needs `:focus-visible` and a tab stop.** It is a `<div>` with a
    click handler (`map-view.js:534-558`); the product's centrepiece is not
    keyboard-reachable. `tabindex="0"` on leaf and domain boxes plus the shared
    ring gets 80% of it for two attributes.
22. **`.wz-pop`'s 88px gutter, four times.** `wizard.html:117, 119, 153, 155`.
    Replace with CSS anchor positioning (`anchor-name` on `.wz-tools`,
    `position-area` on the flow content) or a two-column grid on `.wz-card`. Not
    urgent; it is the tell that the layout has a hand-tuned constant where it
    should have a mechanism.

---

## 6. Motion, systematised

### The vocabulary — four verbs, and nothing else

| Verb | When | Property | Distance | Duration | Easing |
|---|---|---|---|---|---|
| **Tint** | State changes on a thing under the pointer or finger | colour, border, shadow, `scale` ≤ .5% | none | `--dur-1` | `--ease-out` |
| **Settle** | Something that did not exist a moment ago arrives | `opacity` + `translate` | ≤ 8px, always toward its final position | `--dur-2` | `--ease-out` |
| **Travel** | Something that already exists moves to a different place | `transform` only | whatever the layout says | `--dur-3` | `--ease-move` |
| **Hold** | Something that must *not* move while everything else does | none — a named view-transition group | 0 | 0 | — |

Four verbs cover every surface in this product. If a proposed animation is not
one of them, it is decoration.

**Hold is the most important one and the easiest to forget.** Most of what makes
a transition read as expensive is not what moves — it is what conspicuously
*doesn't*. The header, the crumb, the nav row and the tier bar staying nailed in
place while a question changes is the entire effect; the crossfade underneath is
almost incidental.

### The rules for when something must NOT move

1. **Prose never animates.** Body text does not fade in, slide in, or stagger. If
   a person is reading it, it was there when they looked.
2. **No scroll-triggered anything.** No reveal-on-scroll, no parallax on content,
   no `animation-timeline: scroll()` on a progress indicator. The constrained
   report reaches the same conclusion at its §4.6 for its own reason (the crumb
   already says "question 12 of 86"); the general rule is that scroll is
   navigation, not a trigger.
3. **Data does not animate its value.** No count-up on `.wz-stat .num`, no
   easing a percentage. The number was always that number.
4. **Nothing loops.** The only permitted infinite animation is
   `gallery.html:21`'s skeleton, and only while `aria-busy="true"`.
5. **One thing at a time.** If two elements would animate for the same cause,
   either one of them is Holding or the other one is decoration.
6. **Movement beats colour.** If an element would both move and change colour, it
   Travels and the colour lands at the end — a moving element changing hue reads
   as a glitch.
7. **Keystrokes never animate.** Anything triggered from inside a text field
   (autosize, validation, a character count) is instant.
8. **No motion on a first paint.** `@starting-style` is for insertion *after*
   load, not for the page arriving. A staggered entrance on page load is the
   generated-UI signature.

### Mapped onto the actual surfaces

| Surface | Verb | Mechanism |
|---|---|---|
| `.tm-card` / `.wz-card` / `.lens` / `.lp-row` hover, focus, `.sel` tint | Tint | §4 B3 transition block |
| Any control on `:active` (coarse pointer) | Tint | `scale: .995`, 60 ms |
| `.wz-slot` injected answer controls (`wizard.js:444`) | Settle | `@starting-style`, 6px |
| `.wz-pop` Read-more (`wizard.js:527`) | Settle | `@starting-style`, 8px |
| `details.optional`, `.cmp-row`, `.cmp-acc` opening | Settle | `::details-content` + `interpolate-size` (constrained §4.3) |
| `theme.css:106` disclosure triangle | Tint | already correct; retime to `--dur-1` |
| Wizard screen ↔ screen (`showScreen`) | Travel + Hold | `startViewTransition`; Hold `#q-title`, `#wz-crumb`, `.wz-nav` (constrained §4.2) |
| Page ↔ page across the site | Travel + Hold | `@view-transition`; Hold `.tm-chrome` (constrained §4.1) |
| Tier bar after a commit | Travel | `width` transition + `view-transition-name: tierbar` (§4 B6) |
| Map tiles re-laying out | Travel | already exists (`render.py:447`) — **add the reduced-motion guard it lacks** |
| A node landing after an answer | Settle, over a Travel | §7 |
| Gallery loading | (skeleton) | already correct, already guarded |
| Compare loading | (skeleton) | constrained F5 — same register as the gallery |

Two coordination notes with the constrained report: its §4.2 CSS should adopt
§3.4's tokens rather than hard-coded `.22s ease` (see §4 B4), and its Round 2
should land before or with anything here, since every rule above assumes
`prefers-reduced-motion` is guarded globally.

---

## 7. The map, specifically

The map is the product's namesake and is about to become its main surface. Today
it is genuinely well-engineered and visually under-served.

### What is already right

Content-driven widths with measured reading clamps (`render.py:453-461`); tier
ordering within a domain; the alternating two-sided layout with independent
vertical cursors falling back to left-to-right below 860px; cursor-anchored zoom
clamped 0.3–2.5× (`map-view.js:570-576`); a 6px drag threshold so a tap is still a
tap (`:564`); cubic bezier edges with distinct domain/leaf stroke weights
(`:497`, `render.py:442-444`); and the 280 ms transform settle. That is a real map
engine. None of the below replaces any of it.

### Node geometry

A leaf tile is currently `--panel`, a 1px `--line` border, a 3px tier rail on the
left, 7px radius, `--shadow` (`render.py:445-459`).

```css
.mbox {
  border-radius: var(--r3);
  border: 1px solid var(--line);
  box-shadow: var(--e1);
  padding: var(--s3) var(--s4);
  transition: transform var(--dur-3) var(--ease-move),
              box-shadow var(--dur-1) var(--ease-out);
}
.mbox-leaf {
  border-left: 3px solid var(--tier, var(--line));
  /* the tier as a surface, not only a rail: 7% of the ramp value over --panel
     is still ~18:1 for --ink text, and it is legible at zoom levels where a
     3px rail is one screen pixel. Colour remains a redundant channel — the
     rail and the chip both stay. */
  background: color-mix(in oklab, var(--tier, var(--panel)) 7%, var(--panel));
}
.mbox-leaf.mopen { box-shadow: var(--e2); }
.mbox:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
```

The tint is the important part. At 0.5× zoom a 3px rail is 1.5 device pixels and
the ramp effectively disappears — which is exactly the zoom level at which you
most want to see the shape of your tiers across the whole map. A 7% surface tint
survives zoom-out and still leaves the tile reading as paper.

### Tier colour treatment across zoom

Register the zoom as an animatable custom property and let the tile shed detail
as it shrinks — the single most "high tech" thing in this review, and it is
functional (it is progressive disclosure driven by apparent size, which is what
zoom means):

```css
@property --zoom { syntax: '<number>'; inherits: true; initial-value: 1; }

/* set on the pan/zoom element alongside the transform */
.mbox .mmeta   { opacity: clamp(0, calc((var(--zoom) - .55) * 4), 1);
                 transition: opacity var(--dur-2) var(--ease-out); }
.mbox .mtitle b { font-size: 13.5px; }
```

```js
// map-view.js _applyPanZoom
this.panzoomEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
this.panzoomEl.style.setProperty('--zoom', this.zoom);
```

Below ~0.55× the chips fade and you are looking at tier-tinted shapes and edges —
a real overview. Above it, detail returns. Container queries would also work here
(`container-type: inline-size` per tile) but the tile's *layout* width does not
change with zoom, only its rendered size, so the registered property is the
correct mechanism.

### Edges

Two changes, both one line:

```css
#mapSvg path { vector-effect: non-scaling-stroke; }
```

Without it, edges at 2.5× zoom render as 3.5px ropes and at 0.3× as invisible
threads. `non-scaling-stroke` keeps every edge a hairline at every zoom, which is
what makes a node-link diagram read as a diagram rather than an illustration.

Second: give the leaf edges the child's tier at low opacity, so the ramp reads as
structure and not only as tags:

```js
paths += `<path class="${edgeClass}" style="stroke:${c.tierVar || 'var(--line)'}"
           opacity=".45" d="…"></path>`;
```

Domain edges stay `--line`. The result is that zooming out shows warm edges
clustering on one side of the map and cool on the other — the triage shape, at a
glance, which is the whole reason the ramp is monotone.

### Depth — the substrate, and the one licensed exception to Lane A

`render.py:434-437`:

```css
#mapwrap {
  background-image: radial-gradient(var(--line) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

The grid is painted on `#mapwrap`, which does **not** transform. `#mapPanZoom`
translates and scales inside it. So panning slides the tiles across a stationary
grid and zooming grows the tiles over a fixed one. That decoupling is precisely
why the map reads as a scaled `<div>` and not as a canvas you are moving over —
your eye takes the grid as the world and the boxes as objects sliding on top of
it, which is backwards.

```js
// map-view.js _applyPanZoom — six lines, no new dependency
MapView.prototype._applyPanZoom = function () {
  const t = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  this.panzoomEl.style.transform = t;
  this.panzoomEl.style.setProperty('--zoom', this.zoom);
  const g = 24 * this.zoom;
  this.wrap.style.backgroundSize = `${g}px ${g}px`;
  this.wrap.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
};
```

Now the grid *is* the surface: it moves with your finger and its cells grow as you
zoom in. That is a genuine spatial cue rather than a decorative texture, and it is
the difference between "a diagram" and "a place".

Then the substrate proper, and this is the whole of Lane B that I am
recommending:

```css
#mapwrap {
  /* a shallow vignette so the canvas reads as recessed under the page, and the
     tiles read as sitting on it. Two stops, no gradient mesh, no glow. */
  background-color: color-mix(in oklab, var(--ink) 4%, var(--bg));
  box-shadow: inset 0 1px 3px color-mix(in oklab, var(--ink) 12%, transparent);
  border-radius: var(--r3);
}
@media (prefers-color-scheme: dark) {
  #mapwrap { background-color: color-mix(in oklab, #000 35%, var(--bg)); }
}
```

The ground goes *below* the page, the tiles stay paper above it. That is the
substrate-vs-tile seam from §2, and it is one background colour and one inset
shadow — not a second design language.

### Pan and zoom feel

Two changes worth making, one worth refusing.

**Make.** Wheel zoom is currently applied per event with no damping, so a
trackpad's high-frequency wheel stream produces a jumpy zoom. Multiply the
delta into a smoothed target and apply on `requestAnimationFrame`. ~10 lines.

**Make.** "Reset view" (`needsCenter`, `map-view.js:512-518`) snaps. It should
Travel: it is an existing thing moving to a different place, which is the
definition of the verb. `transition: transform var(--dur-3) var(--ease-move)` on
`#mapPanZoom`, added only for the duration of a reset and removed before the next
drag — a transition left on the pan element would make dragging feel like syrup.

**Refuse (for now).** Momentum/inertia on pointerup. It is ~15 lines and it is the
kind of feel-improvement that turns into three sessions of tuning against two
input devices. Note it, do not build it until the map is the app and the owner has
lived with the rest.

### Focus and selection

`.mbox` is a `<div>` with a delegated click handler (`map-view.js:534-558`) and no
tab stop. When the map becomes the app this is the primary control surface and it
must be operable from a keyboard:

- `tabindex="0"` on leaf and domain boxes; the shared `:focus-visible` ring from
  §4 B3 covers the appearance.
- Arrow keys traverse the tree — `←`/`→` between depths, `↑`/`↓` between siblings.
  The tree is already built (`_buildTree`, `:86`) so the adjacency is in hand.
- Selection (as distinct from open) needs its own mark once compare colours the
  map: `outline: 2px solid var(--ink); outline-offset: 3px` for focus,
  `box-shadow: var(--e2), inset 0 0 0 2px var(--ink)` for selection. Two different
  states, two different marks — do not overload the ring.

### How a node "lands"

The payoff moment. Answer a question, the sheet closes, and the belief you just
wrote appears on the map. Composition:

1. Siblings **Travel** to make room — free, `render.py:447` / `map-view.js:486`
   already transition `transform`.
2. The new tile **Settles** into its final position — it did not exist a moment
   ago, so it fades and lifts 8px, never slides in from off-screen.
3. The tier bar **Travels** by one belief (§4 B6).
4. Everything else **Holds**.

```css
.mbox-leaf {
  opacity: 1; scale: 1;
  transition: opacity var(--dur-2) var(--ease-out),
              scale   var(--dur-2) var(--ease-out),
              transform var(--dur-3) var(--ease-move);
}
@starting-style {
  .mbox-leaf { opacity: 0; scale: .96; }
}
```

`@starting-style` fires on insertion only, so a tile already on the map when you
pan does not re-animate — which is exactly the "no motion on a first paint" rule.
Note the two durations on one element: it Settles in 200 ms and Travels in 320 ms,
and because they are different properties they do not fight.

**The existing `.mbox` transform transition has no reduced-motion guard.** Adding
one is a prerequisite for all of the above, and it is currently the single
unguarded animation in the repo.

---

## 8. What NOT to do

**Refused trends, with reasons:**

- **Glassmorphism / `backdrop-filter` on anything carrying text.** It makes the
  effective background of a tier chip unknowable, which destroys the AA guarantee
  that `theme.css:32-38` exists to record. If it ever appears, it appears on a
  surface with no text and no chips, or not at all.
- **A dark-first default.** The primary audience is a church member on a phone in
  daylight, once. Dark mode stays excellent (B2) and stays opt-in via the system.
- **Glow, neon accents, gradient text, animated gradient meshes.** All of them
  say "this system computed something for you". This system computed nothing for
  you, on purpose.
- **Traffic-light tier colours.** CLAUDE.md, and the amber values already failed
  contrast once.
- **A brand accent colour.** The tier ramp *is* the colour system and it carries
  meaning. A separate accent would compete with it on every screen and would make
  a T1 garnet chip beside a brand hue read as two unrelated signals. `--ink` as
  the "accent" (as `theme.css:11` already has it) is correct — but give the token
  a job or delete it (§5, small win 12).
- **Reveal-on-scroll, staggered section entrances, hover transitions on every
  card as a matter of course.** §6 rule 2 and rule 8.
- **Numbers that count up.** §6 rule 3.
- **A skeleton for anything under ~300 ms.** The gallery earns one (phase 2
  measured 0.7–2.1 s); a 120 ms fetch does not, and a skeleton that flashes is
  worse than nothing.
- **Custom-drawn scrollbars.** `scrollbar-width` and `scrollbar-color` only.
- **One radius on everything.** §3.2 exists because uniform rounding is the
  SaaS-card kit's signature; the radius should tell you what kind of object you
  are looking at.
- **A monospace label register.** `--mono` is used in exactly one place
  (`render.py:390`, `.refchip`) where it is genuinely right — a citation is data.
  Spreading it to stat labels or metadata would be the "monospace for small data
  labels" tell.
- **Tracked-out all-caps eyebrows above every block.** §5, small win 7 removes
  four of the five that exist.
- **Animating tier colour between compare states.** A doctrine changing colour as
  you switch comparison targets would read as a verdict arriving. Compare marks
  belong in a separate channel — a glyph, a border style — with the tier colour
  constant.

**Things in CLAUDE.md I was tempted by and am leaving alone:**

- **Porting the four generated views to JS** so `/view` drops the iframe and
  shares the site's transitions. Constrained §5 already refuses this and is right;
  the byte-identity gates and the double-clickable single file are worth more than
  a page transition.
- **The person-vs-person scorecard.** Already anticipated in CLAUDE.md and
  re-refused in the constrained report. Not a design question, but a design that
  made comparison *look* symmetrical would create the same pressure. The member
  branch should look deliberately different, not accidentally thinner.
- **A tier slider.** Real radios, arrow keys and radiogroup semantics come from
  the platform, and the bands are named values, not a continuum. `theme.css:118`'s
  38px is a bug to fix, not an argument for a new control.
- **Replacing the hand-rolled `.wz-pop` with `popover` immediately.** Constrained
  F11 has it; note only that the popover's anchoring decision
  (`wizard.html:135-148` — anchored to the card, not the button, because of a real
  phone overflow bug) must survive the port. CSS anchor positioning can express it;
  a naive `popover` + `anchor` on the button would reintroduce the bug.
- **Momentum panning.** §7. Real improvement, unbounded tuning cost, not now.
- **Fluid micro-typography.** `clamp()` on 11px labels. Looks systematic, produces
  fractional-pixel text. §3.5 keeps the label steps fixed on purpose.

---

## 9. Sequencing

**Round 0 — reconcile the token fork, then add the scales. Nothing consumes them.**
Add `--mono`, `--shadow` (as `--e1..3`), `--s*`, `--r*`, `--dur-*`, `--ease-*`,
`--fs-*`, `--lh-*`, `--measure*` to `engine/theme.css`; hand-copy the `:root`
additions into `engine/render.py:278-297` and `engine/editor.html:18-27`; resolve
`--accent` and `--good`/`--bad`. **Zero visual diff**, which makes it verifiable:
regenerate with `py engine/render.py` and confirm `theology-map.html` differs only
in the `:root` block, and that `documentation/study-list.md` and the embedded
`<script id="data">` payload are byte-identical. Also delete `web/learn.html:12-14`
here if the constrained report's F9 has not already.

**Round 1 — states and one-liners. Safe to ship alone, in any order.**
B2 (`color-scheme` + dark elevation), B3 (focus / hover / press / disabled /
`::selection`), and small wins 1, 2, 3, 5, 6, 12, 13, 14, 18. All additive, all
independently revertable, none touching layout. This is the round with the highest
felt-quality-per-line in the report and it depends on nothing but Round 0.

**Round 2 — motion.** The constrained report's §4 Round 2, adopting §3.4's tokens
and §6's grammar (see B4). Must land before anything in Round 4 or 5. Its own note
holds: deploy `@view-transition` alone first and look at it, before doing the rest.

**Round 3 — the type and spacing scale (B1).** Page by page, each independent.
Do it *after* Round 1 so the new states are already in place and the owner
evaluates one change at a time, and *after* Round 2 so the pages that get retyped
are already animated. Small wins 7, 8, 9, 10, 15, 16 fold into this round
naturally — they are all "make two things agree", which is what the round is.

**Round 4 — the map (B5, §7).** **Blocked on the `render.py` / `map-view.js`
unfork.** Do not hand-copy any of §7 into two files. Once unforked, the order
inside the round is: reduced-motion guard on the existing `.mbox` transition
(correctness, ship alone) → `vector-effect: non-scaling-stroke` (one line,
immediately visible) → grid coupling in `_applyPanZoom` (six lines, the big one)
→ tile geometry and tier tint → `--zoom` detail fade → substrate vignette →
keyboard traversal and focus. Each step is independently visible and revertable,
and the first three are worth shipping before the rest is designed.

**Round 5 — the commit moment (B6).** Depends on Round 2 for `startViewTransition`
and on Round 4 if the map is on screen by then. Safe to ship in its tier-bar-only
form first.

**Round 6 — cleanup.** Small wins 4 (scroll masks), 11 (gallery empty state), 17
(`field-sizing`), 19 (`:target` guard), 20 (dark `--note` note), 21 (`.mbox` tab
stop, if not already done in Round 4), 22 (anchor positioning for the 88px
gutter).

**Interlocks with the constrained report:** its Round 1 (F1/F6/F7/F8/F9/F10) is
independent of everything here and should go first regardless. Its Round 4 (the
nav) should land after Round 1 here, so the new nav ships with the active state
(small win 3) and the new header type (B1) rather than needing a third pass.

### What the owner has to decide

1. **The lane.** Lane A + the map substrate exception, as argued in §2. This is
   the decision everything else hangs off.
2. **`.tm-card` radius 9px → 12px**, which moves `render.py`'s output hash under
   the phase-7 restyle licence. Presentation-only, gated by two invariants. His
   file, his call.
3. **Removing four of the five uppercase label registers** (small win 7). It is a
   voice change as much as a visual one.
4. **`color-mix()` and `@property` inside `render.py`'s copied `:root`.** Both are
   plain CSS with no network dependency, so `file://` and the offline editor are
   unaffected — but they are newer than anything currently in that block, and it
   is the file that must stay bulletproof.
5. **Coupling the map's dot grid to the pan/zoom transform** (§7). It is the
   single best change in this report and it touches the lockstep-bearing engine.
   Confirm it waits for the unfork.
