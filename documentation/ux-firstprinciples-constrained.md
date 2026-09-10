# UX from first principles — the constrained assessment

Written 2026-09-10 against the repo at `Project 12 - Theology Mind Map`, after
reading `CLAUDE.md` in full and the eleven hosted surfaces it names. No browser
was opened: every measurement below is read out of the markup, the stylesheets
and the corpus, and anything that depends on rendered text length is derived
(the corpus was counted, not guessed) rather than asserted.

**Lane.** No framework, no bundler, no CDN, no npm, no new Python dependency.
`start_editor.bat` must keep working offline from `file://`. `render.py`'s
output stays under its byte-identity invariants. Native platform features are
the licensed toolkit and this report leans on them hard. Information
architecture is in scope, including reversing documented decisions; where I
reverse one I quote it and argue against its own stated reason.

---

## 1. Verdict

**This is not one product with four screens; it is four correct programs that
happen to share a stylesheet, and the person is the integration layer.** The
wizard, Learn, Compare and the map each solve their own problem well and each
own their own copy of the same idea — four `TIER_VAR` tables, a tier ramp forked
back into `web/learn.html:12-14` after phase 10 deleted exactly that fork, four
text styles copied into `web/compare.html:90-98` under a comment admitting it,
the wizard re-implementing Learn's doctrine prose inside a popover instead of
linking to it, and Learn handing a first-timer to the raw markdown editor while
Compare hands them to the wizard for the same act. Because nothing is
*structurally* one product, the seams have to be crossed by hand: the only route
to "my map" runs through the home page, the home page is a menu wearing a
landing page, the wizard deletes the site navigation entirely while you are
answering a question (`web/wizard.js:269`), and every crossing is an unanimated
`hidden` toggle or a `location.href` — the entire hosted surface contains
precisely two moving pixels' worth of CSS (`web/gallery.html:20-23` and
`engine/theme.css:106`). The owner's four complaints are not four problems. They
are one problem — *no continuity of place* — reported from four angles.

---

## 2. The walk

Device assumed: 360×780 phone, ~660px usable after browser chrome. Taps counted
as discrete finger-downs; scrolls counted separately and named.

### `/` — the front door (`web/landing.html`)

Signed out, cold. Above the fold: the site header (`kicker`, `h1`, five nav
links, `engine/theme.css:124-130`) then `web/landing.html:40-56` — five
paragraphs and a four-item list defining tiers. That is the whole first screen.
The three action tiles (`:58-76`) start below the fold. This is correct for a
first visit and it reads well.

Signed in, the same page. **The explainer is still first.** The tiles a returning
user actually wants are appended by JS *after* the three static ones
(`web/landing.html:134-155`), so the grid is: Make your own map → Browse
everyone's maps → Learn by doctrine → **My map** → History → Compare → Listing
status. Seven cards, one column on a phone, ~140px each, under ~350 words of
copy the owner has read a hundred times. "My map" is card four, roughly 1,100px
down. And card seven is a permanently-mounted administrative toggle ("Listing
status", `:147-155`) that loads in a disabled state saying "Checking whether
your map is listed…" and only becomes real after `/api/map` answers — an
in-flight spinner sitting in the same visual grid as the primary actions.

### `/wizard` launchpad (`web/wizard.html#screen-home`, `web/wizard.js:647`)

Signed in with any answered question, this is the landing screen. It is the best
screen in the product. Four stats (`:377-382`), a tier bar built from the actual
map (`web/wizard.js:657-669`), a one-paragraph legend that explains tier *and*
confidence in the place a person needs it, the tradition control, "Carry on" with
the literal next question named (`:677-678`), "Open the editor", and fourteen
area rows each with a *Next question* and a *List questions* button
(`web/wizard.js:694-724`). Nothing here is wrong.

One thing is missing and it is the same thing that is missing everywhere: from
here, "my map" is the site nav's **Home** link, then a scroll, then a tile.

### `/wizard` question screen (`web/wizard.html#screen-question`)

`showScreen('question')` (`web/wizard.js:262-272`) does three things at once:
unhides `#screen-question`, unhides `#wz-header`, and **hides the site chrome
entirely** (`:269`). The header that replaces it (`web/wizard.html:291-301`) is a
different height, carries a different brand block, and offers exactly two
controls: the tradition picker and "Finish here". There is no Home, no My map,
no Learn, no Browse, no Sign out. Then `window.scrollTo(0, 0)` fires (`:271`).
The net visual event is: everything vanishes, a shorter header of a different
shape appears, the page jumps to top. No transition of any kind.

The screen itself, for a typical doctrine (the corpus averages 2.91 positions
per doctrine across 86 doctrines; the distribution is 4×1, 26×2, 36×3, 16×4,
2×5, 2×6):

| Block | Source | Approx. height |
|---|---|---|
| `#wz-header` | `wizard.html:291-301` | ~90px |
| question `<h2>` (26px serif, ~2 lines) | `wizard.html:335` | ~65px |
| "Read about this question" summary | `wizard.html:336` | ~44px |
| 3 × position card — label, chips, **5-row textarea** | `wizard.js:499-533` | ~600px |
| `#custom-answer`, fully built whether chosen or not | `wizard.js:574-635` | ~400px |
| `#open-answer` + `#ignore-answer` | `wizard.html:350-361` | ~280px |
| `#who` summary | `wizard.html:363` | ~44px |
| `.wz-nav` — **Back and Next** | `wizard.html:368-371` | ~50px |

≈1,570px, or **2.4 usable screens**. On the two six-position doctrines
("Prima scriptura"), ≈2,170px — **3.3 screens**. Slightly over half of that
height is the two escape hatches plus a five-field form that nobody has asked
for yet.

Tapping a position card calls `select()` (`web/wizard.js:444-454`), which clears
every `.wz-slot`, appends `answerControls` into the chosen card's slot — tier
radios (6 chips, wrapping to two rows on a phone), confidence radios (5 chips),
and the `#study` checkbox, ~190px — and everything below shifts down instantly,
under the thumb, with no motion. Then Next is still ~800px below.

**Taps to answer one question**, returning user, steady state:

1. tap a position card *(scroll: the card may already be off-screen)*
2. *scroll ~800-1,300px past the other positions, the custom form and the two
   escape hatches*
3. tap **Next**

Two taps and a long scroll per question, forever. The taps are already minimal —
this is genuinely well-designed at the action level. The scroll is the whole
problem, and it repeats 86 times.

Cold start, brand-new account, first answer ever: `/` → *Make your own map*
(1, an in-page anchor to `#signup-form`) → two text fields → *Create account*
(2) → `location.href = '/wizard'` (`landing.html:209`) → `#screen-intro` →
*Start with the first question* (3) → the tradition screen, thirteen cards
(`wizard.js:291-319`) → pick one (4) → question one → tap a position (5) →
*Next* (6). Six taps, two fields, three full-page repaints, and one 13-card
interstitial before a single belief is banked.

### `/learn` (`web/learn.html`, `web/learn.js`)

The index is a clean filtered list, 86 rows grouped by domain, each with its
suggested-tier chip and position count (`learn.js:129-171`). The filter is
instant and client-side. Nothing here is bad.

A doctrine page (`learn.js:322-386`) is the best *reading* surface in the
product: framing, tier note, history, key texts, positions side by side, who
holds what, my own answer, sources. It works signed out.

Then the bottom of the page, `learn.js:311-317`:

```js
const edit = el('a', null, node ? 'Edit this belief' : 'Answer this question');
edit.href = '/edit?open=' + encodeURIComponent(doctrine.slug);
```

Both cases go to `/edit`. For the *unanswered* case — the one labelled "Answer
this question" — the slug by definition names no node in the person's map. In
`engine/editor.html`, `setTab(pendingOpenSlug ? 'map' : 'list')` (`:472`) tests
the *presence* of the parameter, not whether it resolved, and `applyOpenParam()`
(`:490-514`) bails at `:498` — `if (!node) return; // stale bookmark: silently
ignored, never an error`. So a non-technical church member who taps **Answer
this question** lands, with no explanation, on the pan-and-zoom node-link *Map*
tab of the raw markdown editor, with nothing opened. Three taps from the home
page to the worst screen in the product.

`/wizard?doctrine=<id>` exists, works, and is exactly the right destination
(`web/wizard.js:1133-1137`). Compare already uses it (`web/compare.js:127-130`).
Learn does not.

### `/compare` (`web/compare.html`, `web/compare.js`)

Signed-in only (`compare.js:476`). Arriving with no query string paints the
picker: twelve tradition cards plus the comparable members
(`compare.js:360-390`). Before the first pixel of *that*, `main()` has awaited
`loadCorpus()` — 16 fetches over `content/wizard/` (`web/corpus.js:269-299`) —
plus the tradition manifest. There is no skeleton, no spinner, no "loading"
copy; the page shows a bare header and an empty body for the duration.
`/gallery` handles exactly this situation correctly (`gallery.html:143-150`) and
Compare does not.

Picking a tradition does `location.href = '/compare?tradition=' + id`
(`compare.js:368`). A **full page reload** of a page whose corpus is already in
memory. The new load re-fetches the corpus (16 files), the tradition manifest,
your own map, the target tradition map, and then **all twelve tradition maps**
for the scorecard (`compare.js:435-448`) — the ~475KB `CLAUDE.md` already flags
as a growth marker. On a phone that is several seconds of blank page after a tap
that should have been an in-place swap.

The results themselves are excellent and I would not touch the substance:
differences are never sorted first and never coloured (`compare.html:64-67`,
`compare.js:135-137`), the closest-tradition line always carries its denominator
in words (`compare.js:180-200`), ties are all named (`:177-178`), and the
hand-written-map case gets its own honest sentence instead of "not enough
answers" (`:164-169`). The 860px table→accordion swap (`compare.html:46-49`) is
the right call.

### `/view` (`web/view.html`)

Reached from "My map" on `/`, from every gallery card, and from a tradition
page. It POSTs `/api/render` and drops the result into a sandboxed `srcdoc`
iframe (`:69`, `:215-243`). On a phone, this page's chrome plus the framed map's
own trimmed header leave the canvas small enough that **Fullscreen is effectively
mandatory** — and Fullscreen is a floating button in the bottom-right corner
(`:47-51`, `:118-120`) with no first-run affordance. So "my map" is not two taps,
it is three, and the third is a button the user has to notice.

The `body.tm-enlarged` approach itself is right and the comment at `:31-43`
explains why the Fullscreen API was correctly rejected. Keep it.

### `/gallery` (`web/gallery.html`)

The most polished page in the repo. Skeleton cards while `/api/gallery` (0.7-2.1s
measured in phase 2) runs, `aria-busy` toggled honestly, `prefers-reduced-motion`
already respected on the pulse, tier bars marked `aria-hidden`, the primary card
shown only when it is useful (`:161-166`). Nothing to fix.

### `/edit` (`engine/editor.html`)

Correct as the owner's power tool. Wrong as a destination for anybody else, which
is what Learn currently makes it (above) and what the wizard offers as a
co-equal tile on its launchpad ("Open the editor", `wizard.html:405-409`).

### Taps to "my map"

| From | Today | With the nav change in F2 |
|---|---|---|
| `/gallery`, `/learn`, `/compare`, `/wizard` launchpad | Home (1) → scroll ~1,100px → My map tile (2) → Fullscreen (3) | **1** (+ Fullscreen if wanted) |
| `/wizard` question screen | Finish here (1) → Home (2) → scroll → My map (3) → Fullscreen (4) | **1** |

---

## 3. Findings, severity-ranked

### F1 — "Answer this question" on Learn lands a first-timer in the raw editor's map canvas · **Critical** · S

**What.** `web/learn.js:312-313` sends both the answered and the unanswered case
to `/edit?open=<slug>`. For the unanswered case the slug resolves to nothing.
`engine/editor.html:472` switches to the Map tab on the *presence* of `?open=`,
and `:498` returns silently when it does not resolve.

**Why it's wrong.** Not taste — a broken promise. The link says "Answer this
question" and delivers a pan/zoom canvas of collapsed area boxes belonging to a
different tool, with no error, no target and no way back except the browser's
back button. `CLAUDE.md` states the silent-ignore rule deliberately ("a stale
bookmark must never be an error") and it is right for a *bookmark*; it is wrong
for a link the app itself just generated for a node it knows does not exist. It
is also the exact inconsistency behind complaint (3): Compare routes the same
act to the wizard, Learn routes it to the editor.

**Fix.** One expression in `web/learn.js`:

```js
const edit = el('a', null, node ? 'Edit this belief' : 'Answer this question');
edit.href = node
  ? '/edit?open=' + encodeURIComponent(doctrine.slug)
  : '/wizard?doctrine=' + encodeURIComponent(doctrine.id);
```

`/wizard?doctrine=` is already implemented (`web/wizard.js:1133-1137`) and
already used by `web/compare.js:129`. Signed-out visitors are bounced to `/` by
`wizard.js:1073`, which is the correct behaviour for that link anyway.

**Optionally**, second-order: change `engine/editor.html:472` to resolve the slug
before choosing the tab, so no future caller can reproduce this. That touches the
offline tool, so it is separable and lower priority.

**Files.** `web/learn.js` (+ optionally `engine/editor.html`).

---

### F2 — There is no route to "my map", and inside a question there is no route to anything · **Critical** · M

**What.** `web/chrome.js:45-64` builds the nav as Home · Wizard · Edit · Browse ·
[Admin] · Sign out. "My map" is not in it; it is a JS-appended tile, fourth of
seven, on `/` (`web/landing.html:136-137`). `web/wizard.js:269` hides the entire
chrome on the question screen.

**The decision I am reversing.** `CLAUDE.md`:

> **"My map", "History", Unlist/Relist, Learn and Compare are tiles on `/`, not
> nav links** (2026-08-29; Learn and Compare added by phase 6). Six nav items is
> what fits a phone, and `/learn` and `/compare` reach it the same way the other
> three do rather than pushing the nav to eight.

**Against its own reasoning, on three counts.**

1. *"Six nav items is what fits a phone" is already not true of this nav, and the
   codebase knows it.* `engine/theme.css:142-144` makes `.toplinks`
   `overflow-x: auto; white-space: nowrap` below 640px — the nav already scrolls
   horizontally, which is the concession you make when the items do **not** fit.
   At 12px semibold with a 14px gap, roughly four to five items are visible in
   360px. So the constraint being defended is not "six fit"; it is "some of them
   are off-screen and we chose which". The choice was made in favour of *Sign
   out* and *Admin* over *My map*.
2. *The count is a budget, and it is being spent on cold paths.* Of the six,
   **Sign out** is used once a month, **Admin** is one account, and **Home** is a
   page whose only job for a signed-in user is to be a menu of the items that
   were evicted from the nav. Three of six slots hold navigation-to-navigation.
3. *The stated alternative route does not exist from where the user is.* "reach
   it the same way the other three do" assumes the chrome is on screen. On the
   wizard's question screen — the screen a person spends 86 turns on — there is
   no chrome at all (`wizard.js:269`), so Learn, Compare, Browse, My map and Sign
   out are unreachable in zero taps and unreachable in one.

**Fix.** Fewer visible items than today, and My map among them.

- Nav becomes **My map · Questions · Learn · Browse · ⋯** (four plus overflow;
  signed out: **Learn · Browse · Sign in**). "My map" points at
  `/view?name=<name>` exactly as the tile does today, including the
  already-correct empty-map redirect and the unlisted-map message
  (`view.html:234-240`) — do not change that logic.
- **⋯** is a native `popover` holding Edit, History, Compare, Listing status,
  Admin, Sign out. No library, no JS positioning:

```html
<button popovertarget="tm-more" id="tm-more-btn" class="tm-morebtn">⋯</button>
<div popover id="tm-more" class="tm-more"> … links … </div>
```

```css
.tm-morebtn { anchor-name: --tm-more-anchor; }
.tm-more {
  position: absolute;
  position-anchor: --tm-more-anchor;
  top: anchor(bottom); right: anchor(right);
  margin: 6px 0 0;
  background: var(--panel); color: var(--ink);
  border: 1px solid var(--field-line); border-radius: 9px;
  padding: 6px; min-width: 180px;
  box-shadow: 0 8px 24px rgb(0 0 0 / .18);
}
/* No anchor positioning (Firefox today): fall back to the page corner. */
@supports not (position-anchor: --x) {
  .tm-more { position: fixed; inset: auto 12px auto auto; top: 64px; }
}
```

Light dismiss, Escape and focus management come from the platform. Zero bytes of
JS.
- `web/wizard.js:262-272` stops hiding the chrome. The wizard's own header keeps
  the crumb, the tradition control and "Finish here" and sits *below* the chrome
  rather than replacing it — which also removes the height-swap jolt that is half
  of complaint (2).
- `/` keeps every tile it has. Tiles and nav items are not rivals; the tiles are
  the discoverable surface for a first visit and the nav is the return path for
  visit forty.

**Cost to be honest about.** `engine/editor.html:541-547` carries a hand-written
copy of this list, documented as the `file://` exception. Any nav change is two
edits, and this one is three (chrome.js, theme.css, editor.html).

**Files.** `web/chrome.js`, `engine/theme.css`, `web/wizard.js:262-272`,
`web/wizard.html:291-301`, `engine/editor.html:541-547`.

---

### F3 — The question screen is 2.4 screens tall and its primary action is at the bottom · **High** · S then M

**What.** Measured in §2. Three contributors, in order of cheapness to fix:

(a) **Next is not reachable.** `.wz-nav` (`wizard.html:368-371`) is the last
element on a ~1,570px page.

(b) **`#custom-answer` is fully built on every question.** `buildCustom()`
(`wizard.js:574-635`) renders a hold textarea, two radio groups, a `#study`
checkbox and a five-field `Advanced` disclosure *before anyone has chosen it* —
~400px of form, on all 86 questions, for the minority case it serves.

(c) **Every unselected position renders a live 5-row textarea**
(`wizard.js:513-518`). Three choices each look like a form field, so the screen
reads as "fill in three essays" rather than "pick one".

**Why it's wrong.** Fitts and the cost of scroll-hunting, but concretely: the
person must traverse the entire decision space *after* deciding, on every one of
86 turns. That is the mechanical source of "clunky" — the taps are already
minimal, the travel is not.

**Fix (a) — one CSS rule, largest single win in this document:**

```css
.wz-nav {
  position: sticky; bottom: 0; z-index: 30;
  margin: 2px -18px -36px;              /* cancel .wz-screen-body's 18/36 inset */
  padding: 10px 18px calc(10px + env(safe-area-inset-bottom, 0px));
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(6px);
  border-top: 1px solid var(--line);
}
```

**Fix (b).** Wrap `#custom-answer`'s body in the card's own summary row and build
`buildCustom(doctrine)` lazily on first expand. It is already the only tile with
a `precomputed` control state (`wizard.js:451`, `:630`), so the selection path is
unaffected.

**Fix (c).** Render an unselected position's `hold` as a `<p class="wz-hold">`
and swap it for the textarea inside `select()`. This does **not** reverse the
documented decision — `CLAUDE.md` says *"The position's own description **is** the
editable `hold` field — there is no second 'What I hold' box any more"*, and the
swap keeps exactly that: one field, and it is the description. Do not autofocus
the textarea after the swap; on a phone that throws up the keyboard over the
choice the user just made.

**Files.** `web/wizard.html` (CSS), `web/wizard.js:444-454, 496-546, 574-635`.

---

### F4 — Nothing on this site moves, and the two things that do are unrelated · **High** · S

Full treatment in §4. Evidence for the severity: a `grep` for `transition`,
`animation`, `@keyframes`, `view-transition`, `@starting-style` across all of
`web/` and `engine/` (excluding `render.py`'s self-contained output) returns
**six lines** — `gallery.html:20-23` (skeleton pulse), `theme.css:106` (a 150ms
disclosure triangle), and two rules inside `editor.html`. Every screen change in
the wizard is a `hidden` flip plus `scrollTo(0, 0)`; every page-to-page move is
`location.href`. There is no state in this product that arrives rather than
appearing.

---

### F5 — Compare re-navigates to itself and re-downloads everything, with no loading state · **High** · M

**What.** `compare.js:368` and `:388` do `location.href = '/compare?…'`. The
reload re-runs `loadCorpus()` (16 fetches), `loadTraditionManifest()`,
`/api/map`, the target map, and all twelve tradition maps
(`compare.js:435-448`, ~475KB). `main()` awaits all of it before painting
anything: `mount()` at `:483` then two awaits before `renderPicker` or
`renderResults` — a bare header over an empty body for the whole time.
`/wizard` has the same hole (`wizard.js:1075-1087`).

**Why it's wrong.** A tap that produces nothing for several seconds reads as a
broken tap, which is why people tap twice. `gallery.html:143-150` already proves
the house style for this (skeleton, `aria-busy`, cleared on both success and
failure) and phase 2 established the principle in writing.

**Fix, in order.**

1. Skeleton on `/compare` and `/wizard` while the corpus loads — copy
   `gallery.html:143-150`'s three-card pattern.
2. Picker → results becomes an in-page screen swap plus `history.pushState`, with
   a `popstate` handler that re-runs the same branch `main()` already has. The
   `?tradition=` / `?name=` URLs stay bookmarkable and unchanged; only the
   *internal* transition stops reloading.
3. Lazily load the eleven non-target tradition maps. `CLAUDE.md` already names
   this: *"Growth marker: `/compare` still eagerly loads all 475 KB of tradition
   maps. Lazy-loading the eleven non-target maps is the next performance move."*
   The scorecard is the only consumer and it is below the closest-tradition line
   and the tier list, so an `IntersectionObserver` on `#cmp-scorecard`, or simply
   a "Show the all-traditions scorecard" button, defers it entirely.

**Files.** `web/compare.js`, `web/compare.html`, `web/wizard.js`.

---

### F6 — The wizard reproduces Learn instead of linking to it · **Medium** · S

**What.** "Read about this question" (`wizard.html:336-339`, filled at
`wizard.js:487-494`) renders `doctrine.framing`, `doctrine.learn_note` and
`doctrine.sources` — the same three fields `learn.js:327-341` and `:374-383`
render — and there is no link from the question to `/learn?doctrine=<id>`.
`#who` (`wizard.html:363-366`, `wizard.js:363-393`) is a second reproduction of
Learn's "Who holds what" (`learn.js:226-281`), minus the tradition-override
handling that `CLAUDE.md` calls *"the entire reason this surface exists"*.

**Why it's wrong.** This is the mechanism behind complaint (3). Learn does not
feel bolted on because it is badly built; it feels bolted on because the wizard
never admits it exists. A user who has answered 40 questions has never once been
shown the word "Learn" in context.

**Fix.** Last line inside `#q-readmore-body`:

```js
const more = el('a', 'cite-link', 'Read the full page on this doctrine →');
more.href = '/learn?doctrine=' + encodeURIComponent(doctrine.id);
more.target = '_blank'; more.rel = 'noopener';
more.addEventListener('click', onFollow);   // commits first, exactly like a source link
rm.appendChild(more);
```

`onFollow` (`wizard.js:123`) already exists and already does the
commit-before-leaving that this needs. The reverse link (`/learn` →
`/wizard?doctrine=`) is F1.

**Do not** delete `#who` to deduplicate. It is the shorter, lens-ordered version
and it is correct in place; the link is what closes the loop.

**Files.** `web/wizard.js`.

---

### F7 — "Wizard" is jargon in a product that has banned jargon · **Medium** · S

`CLAUDE.md` locks the vocabulary: *"user-facing copy says **belief** and **area**,
never 'node' or 'domain'"*, and *"`todo` is shown as **Still working out**, never
'Study' or 'Todo'"*. "Wizard" (`chrome.js:48`, and the `/wizard` path) is the same
class of leak — a 1995 Windows installer term, invisible to a developer and
opaque to a church member. Rename the **label** to **Questions**; keep the
`/wizard` URL, which is bookmarked, linked from `compare.js:129` and documented.
Label and route are separable and only the label is user-facing.

**Files.** `web/chrome.js`, `engine/editor.html:541-547`.

---

### F8 — `/` is a menu wearing a landing page · **Medium** · S

**What.** `landing.html:40-56` puts 350 words of first-visit explainer above a
signed-in user's own tiles, and `:147-155` mounts a permanently-disabled
administrative toggle as card seven of the primary grid.

**Why it's wrong.** The same page is doing two jobs with two different audiences
and optimising for the one that visits once. Given F2 removes `/`'s role as the
only route to My map, `/` can be honest about being a front door again.

**Fix.**
- Signed in, wrap `.tm-prose` in `<details class="optional"><summary>What a
  theology map is</summary>` — one `if (user)` line, and the `details.optional`
  primitive already exists in `theme.css:97-108`.
- Move "Listing status" out of `.tm-grid` and onto a quiet line under it. It is a
  setting, not a destination, and with F2 it also lives in the overflow menu.

**Files.** `web/landing.html`.

---

### F9 — The tier ramp has been forked back into `web/` after phase 10 deleted exactly that fork · **Medium** · S

`web/learn.html:12-14`:

```css
:root {
  --t1:#7c2d3b; --t1-5:#8a4a24; --t2:#8c6a1f; --t2-5:#5f6b35; --t3:#2f6b63; --t4:#33526e;
}
```

`CLAUDE.md`, phase 10 / X1: *"**`--t1`…`--t4` live in `engine/theme.css`.** Four
hand-copied duplicates in `web/` were deleted. Do not reintroduce a tier hex
literal in a `web/` file — read the token."* A `grep` for the hexes across
`web/` returns this one hit. Its own comment — *"Declared per page rather than in
theme.css so the colour choice stays visible next to the markup that uses it"* —
is the pre-phase-10 rationale that phase 10 overturned; the file was written
before the rule and never revisited.

Related, one level up: `TIER_VAR` is declared four times identically
(`wizard.js:45-48`, `compare.js:36-39`, `learn.js:20-23`, `gallery.html:42-45`).
That is the *fifth* fork of the same idea and it is the `el`/`slugify`/
`escapeHtml` situation from the audit round repeating.

**Fix.** Delete `learn.html:12-14`; export `TIER_VAR` from `web/chrome.js`
alongside `el` and `slugify`, which is where the audit round put the other
shared helpers, and import it in the four callers.

**Files.** `web/learn.html`, `web/chrome.js`, `web/wizard.js`, `web/compare.js`,
`web/learn.js`, `web/gallery.html`.

---

### F10 — Compare copies the wizard's text styles instead of sharing them · **Medium** · S

`web/compare.html:90-95`, with the comment stating the case against itself:

> *Three shapes borrowed from `web/wizard.html` so the two pages read as one
> product. Copied rather than hoisted into `theme.css`: they are page-local text
> styles there too, and moving them would touch the wizard mid-phase.*

The mid-phase reason has expired. `.wz-quiet`, `.wz-hint`, `.wz-framing` and
`.lab` are the product's four secondary text styles and they are declared in
`wizard.html:63,169,178,93`, `compare.html:93-95`, and `learn.html:20,76`
(as `.lp-lead` / `.lp-hint`) — three near-identical sets. This is the CSS-layer
expression of the verdict: pages that look alike by copying, not by sharing.

**Fix.** Promote four rules to `engine/theme.css` as `.tm-quiet`, `.tm-hint`,
`.tm-framing`, `.tm-lab` and alias the existing class names to them for one
round rather than renaming 60 call sites at once. `theme.css` is loaded by the
offline editor too, so keep the additions to text-only rules with no layout
implications — these four qualify.

**Files.** `engine/theme.css`, `web/compare.html`, `web/wizard.html`,
`web/learn.html`.

---

### F11 — The Read-more popover is hand-rolled where the platform now does it · **Low** · S

`wizard.js:156-184` maintains `openPop`, a `closePop()`, a document-level click
listener and a document-level Escape listener, plus `stopPropagation` calls at
`:172` and `:177` to stop the card's own click handler firing. The `popover`
attribute gives light-dismiss, Escape, top-layer stacking and the
`stopPropagation` dance for free, and `.wz-pop` is already absolutely positioned
against `.wz-card`, which `position-anchor` expresses directly. Roughly 28 lines
of JS deleted for ~8 lines of CSS. Purely a maintenance win; the current
behaviour is correct.

---

### F12 — On a phone, `/view` needs a third tap nobody advertises · **Low** · S

Fullscreen (`view.html:47-51`) is the difference between a usable map and a
letterbox, and it is an unlabelled floating button in the bottom-right. Do not
auto-enlarge — that would silently remove the nav on arrival. Remember the choice
per viewer in `localStorage` after the first manual use, and give the button its
`Fullscreen`/`Exit` label a `title` so it is not a mystery on hover.

---

### What is already good, and should be said

- **The tap count per answer is already 2.** The wizard's action design is right;
  the travel around it is not.
- **The launchpad** (`wizard.js:647-724`) — naming the literal next question in
  "Carry on", per-area progress with an explicit `ignored` count, and one legend
  that explains both scales in the place they are set.
- **The 409 path** (`wizard.js:996-1023`): re-read, re-parse, re-apply one
  answer, never force-save. Most products would have shipped `force: true`.
- **`onFollow`** (`wizard.js:123`): committing the current answer before a source
  link opens a tab. That is a real thought about a real user.
- **Real `<input type="radio">`** for tier and confidence (`wizard.js:194-229`),
  with arrow keys and the a11y tree from the platform.
- **The popover anchored to the card, not the button** (`wizard.html:135-148`) —
  a genuine phone bug fixed at the right level.
- **`[hidden] { display: none !important }` once per page** (`wizard.html:12-17`)
  instead of a dozen `#id[hidden]` overrides. Root-cause fix.
- **44px coarse-pointer targets** (`theme.css:110-119`), including the note that
  links are controls too.
- **`/gallery`'s skeleton** and its honest `aria-busy` teardown on both branches.
- **Compare's refusal to grade**: no colour on differences, no re-sorting them
  first, every fraction carrying its denominator, all ties named.
- **Learn's "suggested" framing** on every tier chip plus the rendered
  `tier_note`. Exactly right for a corpus rendering signed out.

---

## 4. Motion and transitions

The brief is not "add animation". It is: **every change of state should be
attributable to the tap that caused it.** Four native mechanisms, no
dependencies, all degrading to today's behaviour where unsupported.

### 4.1 Cross-document view transitions — `/`, `/learn`, `/gallery`, `/view`, `/compare`, `/edit`

Two rules in `engine/theme.css` and every page-to-page move in the product stops
being a white flash. This is the single highest-leverage change against
complaint (4) and against the verdict, because a shared header that *persists*
across a navigation is what makes four pages read as one app.

```css
/* engine/theme.css */
@view-transition { navigation: auto; }

/* The header is the same object on every page — morph it, don't cross-fade it.
   Exactly one .tm-chrome exists per document, so the name stays unique. */
.tm-chrome { view-transition-name: tm-chrome; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
```

Both documents must opt in, and every hosted page links this stylesheet, so this
covers all of them — including `/edit`, which reaches the same file through its
`<base href="/engine/">`. `engine/render.py`'s output is self-contained and does
not link `theme.css`, so the `/view` iframe is untouched and the byte-identity
invariants are not in play. Firefox has no cross-document view transitions today
and gets exactly the current behaviour.

### 4.2 Same-document view transitions — the wizard's five screens

`web/wizard.js:262-272`. Wrap the existing body; change nothing inside it.

```js
function showScreen(name) {
  const paint = () => {
    for (const s of SCREENS) $('screen-' + s).hidden = (s !== name);
    const q = (name === 'question');
    $('wz-header').hidden = !q;
    closePop();
    window.scrollTo(0, 0);   // stays instant: it must happen inside the snapshot
  };
  if (!document.startViewTransition ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return paint();
  document.startViewTransition(paint);
}
```

Note the line that is *gone*: `if (chromeEl) chromeEl.hidden = q;` — F2 removes
it, and with it the header height-swap that is the visible half of complaint (2).

Then name the three things that should hold still while the question changes, so
Next→next question morphs the title in place instead of repainting the page:

```css
/* web/wizard.html */
#q-title    { view-transition-name: q-title; }
#wz-crumb   { view-transition-name: q-crumb; }
.wz-nav     { view-transition-name: q-nav; }
```

Optional directional variant, if a crossfade reads as too soft — set
`document.documentElement.dataset.dir = 'fwd' | 'back'` before
`startViewTransition` in the `q-next` / `q-back` handlers
(`wizard.js:1103-1109`):

```css
@keyframes tm-out-left  { to   { opacity: 0; translate: -24px 0; } }
@keyframes tm-in-right  { from { opacity: 0; translate:  24px 0; } }
html[data-dir="fwd"]::view-transition-old(root)  { animation: tm-out-left .22s ease both; }
html[data-dir="fwd"]::view-transition-new(root)  { animation: tm-in-right .22s ease both; }
html[data-dir="back"]::view-transition-old(root) { animation: tm-out-left .22s ease reverse both; }
html[data-dir="back"]::view-transition-new(root) { animation: tm-in-right .22s ease reverse both; }
```

### 4.3 Disclosures that actually open — `/wizard`, `/compare`, `/learn`

"Going into and out of a question isn't very smooth" is, in the most literal
reading, this: `#q-readmore`, `#who`, `#custom-answer`'s Advanced, `.cmp-row`
and `.cmp-acc` all snap. `::details-content` plus `interpolate-size` animates a
`<details>` to its natural height with no JS and no measured pixel values.

```css
/* engine/theme.css */
:root { interpolate-size: allow-keywords; }

details.optional::details-content,
.cmp-row::details-content,
.cmp-acc::details-content {
  block-size: 0;
  overflow: clip;
  transition: block-size .25s ease, content-visibility .25s allow-discrete;
}
details.optional[open]::details-content,
.cmp-row[open]::details-content,
.cmp-acc[open]::details-content { block-size: auto; }
```

Where `::details-content` is unsupported the rules are simply dropped and the
disclosure snaps exactly as it does now. `theme.css:106`'s triangle rotation
already transitions and now has something to accompany.

### 4.4 Content that arrives — the injected answer controls and the popover

`select()` (`wizard.js:444-454`) appends ~190px into `.wz-slot` with zero
motion, and `readMoreButton` appends `.wz-pop` the same way. `@starting-style`
animates elements *on insertion* with no JS, no class toggling and no
`requestAnimationFrame` dance.

```css
/* web/wizard.html */
.wz-slot > *, .wz-pop {
  opacity: 1; translate: 0 0;
  transition: opacity .2s ease, translate .2s ease;
}
@starting-style {
  .wz-slot > * { opacity: 0; translate: 0 -6px; }
  .wz-pop      { opacity: 0; translate: 0 -8px; }
}

/* The selection tint is the only selection signal (a documented decision), so it
   is the one thing that must not appear instantly. */
.wz-card, .lens, .wz-qrow, .lp-row, .tm-card {
  transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease;
}
```

### 4.5 The global guard

```css
/* engine/theme.css — last rule in the file */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 4.6 Deliberately not doing

- **Scroll-driven animations.** A scroll-linked progress bar on the question
  screen is achievable with `animation-timeline: scroll()` and no JS, and it is
  ornament: the crumb already says "question 12 of 86" and F3 is about
  *removing* scroll, not decorating it.
- **Animating the map canvas.** `map-view.js` and `render.py`'s embedded copy are
  hand-kept in lockstep and `render.py`'s output is under byte-identity gates.
  Out of lane, and pan/zoom already has its own feel.
- **A page-load spinner.** F5 asks for skeletons, which show the *shape* of what
  is coming; `gallery.html` already sets that precedent and phase 2 wrote down
  the reason.

---

## 5. What I would not change

**The absence of a person-vs-person scorecard.** This is the one I was most
tempted by, because it is visible as an asymmetry in the code: the tradition
branch of `compare.js:434-452` gets a closest-tradition line, a twelve-column
scorecard and the tier list; the member branch (`:453-462`) gets one sentence
counting doctrines. It reads like an unfinished screen. `CLAUDE.md` anticipates
exactly this misreading — *"A later session will find the missing
people-vs-people scorecard and read it as an obvious symmetry to add. **It is
not. Do not add it.**"* — and the reasoning holds: a number attached to a named
person inside a church is a ranking whatever the copy says. Leave it. If the
thinness ever needs answering, answer it with copy, not a number.

**The byte-identity gates on `render.py`.** Porting the four views to JS would
let `/view` drop the iframe and share the site's transitions. It would also
double the largest duplication in the repo, break the "one render
implementation, two callers" table, and cost the offline
double-clickable-single-file property. Not worth it, and out of lane.

**Tier and confidence stay real radio inputs.** A tier slider is the obvious
"nicer" control and it is wrong: arrow keys, the radiogroup semantics and the
label association all come free today (`wizard.js:194-229`), and the ordinal
bands are named values, not a continuum. `CLAUDE.md` says *"do not hand-roll
`role='radiogroup'`"* and F3/F4 have no reason to.

**`normalise` stripping exactly four things** (`compare-core.js:37`). Every
"own-wording" verdict is a candidate for fuzzier matching and every fuzzier
match is a confident wrong answer where an honest one belongs. `CLAUDE.md`
records that a strip-all-punctuation mutation passed every test but the one
written for it.

**Unlist, never Hide.** F8 moves the control; it does not touch a word of its
copy (`landing.html:158-168`).

**"Ignore for now" staying in `localStorage`.** Tempting to move server-side so a
phone→iPad user keeps their skips. It would be a migration, a route, and a new
thing every save path must not clobber, for a "move past this" gesture that
`CLAUDE.md` argues is a preference rather than content. Worth revisiting *after*
F2/F5, not now — and if it ever moves, it moves as its own decision.

**`api/render.py`'s `is_public` asymmetry**, the `[hidden]` overrides, the
`storage-hosted.js` refusal to use `apiFetch`, the `<base>`-does-not-cover-
dynamic-`import()` absolute paths, and `slugify` living in two places for the
`file://` reason. All correctly reasoned, all documented, none of them UX.

**`/edit`'s existence and its List-tab default.** It is the owner's tool and it
is right for him. F1 stops it being a destination for anyone else; that is the
whole change needed.

---

## 6. Sequencing

**Round 1 — no decision required, no shared files, shippable this session.**
F1 (`learn.js`, one expression), F6 (`wizard.js`, five lines), F7 (label), F9
(delete three lines, hoist `TIER_VAR`), F10 (four rules to `theme.css`), F8
(`landing.html`). Six one-file changes. F1 is the only one that fixes something
a user would call a bug, so it goes first regardless of the rest.

**Round 2 — motion (§4). Depends on nothing; must land before Round 3.**
`theme.css` gets `@view-transition`, the `.tm-chrome` name, `interpolate-size` /
`::details-content`, and the reduced-motion guard. `wizard.html` gets
`@starting-style` and the card transitions. `wizard.js:262-272` gets the
`startViewTransition` wrapper. Landing this *before* the nav change means the new
nav ships already animated and the owner evaluates one change, not two
simultaneously. Also the cheapest possible test of whether §4 is even the right
answer: `@view-transition` alone, deployed, tells you in thirty seconds.

**Round 3 — F3, the question screen.** Sticky `.wz-nav` first, alone: it is one
CSS rule and it may be most of the fix. Then lazy `#custom-answer`, then the
`<p>`↔textarea swap. Three independent steps, each individually revertable. The
`.wz-nav` sticky rule and §4.2's `view-transition-name: q-nav` interact —
a sticky element that is also a named transition group holds still across a
question change, which is the intended effect but should be looked at once on a
real phone.

**Round 4 — F2, the navigation. Needs the owner's sign-off (§7).** Touches
`chrome.js`, `theme.css`, `wizard.js`, `wizard.html` and the hand-kept copy in
`editor.html`. Do it after Round 2 so the header morph is already in place, and
after Round 3 so the wizard's header is not being edited by two rounds at once.
Verification is `py tests/syntax_check.py` plus a look at `/edit` on a real map,
which `CLAUDE.md` already names as the standing gap in editor coverage.

**Round 5 — F5, Compare.** Largest and riskiest, depends on nothing, benefits
most from the others having landed. Its three steps are independently
shippable and should ship that way: skeleton, then `pushState`, then lazy
tradition maps. Steps 1 and 3 are strictly additive; step 2 is the one that
needs care, because `?tradition=` and `?name=` must stay bookmarkable.

**Then, once:** F11 (popover) and F12 (`/view`) as cleanup.

---

## 7. Decisions the owner has to make

1. **F2, the nav.** It reverses a documented decision. My case is §3/F2: the
   "six items fit a phone" premise is already false in this codebase's own CSS,
   and three of the six slots hold navigation-to-navigation. Proposal: **My map ·
   Questions · Learn · Browse · ⋯** — four visible items, fewer than today, with
   the rest in a native popover.
2. **F7, "Wizard" → "Questions"** (label only; URL unchanged). A one-word change
   with no technical cost that only he can decide, since it is his product's
   voice.
3. **F3(c), the `<p>`↔textarea swap.** I read it as compatible with
   *"the position's own description **is** the editable hold field"*, but it is
   his decision to confirm, since it is his rule.
4. **§4's scope.** `@view-transition { navigation: auto }` also affects `/edit`,
   which is the offline tool's file, reached hosted. Harmless (single-page, no
   navigations from within it) but it is his file and his call.
