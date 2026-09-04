# UX review — workflow, copy, spacing

Reviewed 2026-09-02, cold, from the repo alone. No browser was opened: every
measurement below is read out of the stylesheets and the markup, and every place
that depends on rendered text length is flagged as such rather than asserted.
`theology-map.html` and `documentation/verses.md` were not read, per the brief.

Scope of authority: `docs/hosting/decisions.md` and `docs/hosting/phase-3-design.md`
are treated as settled. Nothing here proposes a new palette, a new type pairing, a
new tier ramp, a rename of `tier` / `confidence` / `#study`, a denomination badge on
gallery cards, a person-vs-person scorecard, a dependency, a framework or a build
step. Several findings are the opposite: places where the shipped code has drifted
*away* from a locked call.

---

# 1. User workflow

**Three lines.** The single biggest problem is that one of Thomas's three locked
first-run starting points — *start from someone else's map* — is not on the screen a
new account actually lands on; the markup for it exists and is reachable only by
starting the questions and then abandoning them. The second is the question screen's
running order: the two escape hatches ("Ignore for now", "I haven't worked this out
yet") sit above the answers, and the second of them wears the primary
ink-on-paper fill, so on every question the loudest thing on screen is *I don't
know*. The third is a scatter of small steps that carry no information — a lens
screen that needs a second confirming tap, a "Done" that cannot tell "no tradition"
apart from "not asked yet", and a "Make my own map" button shown to people who are
looking at their own map.

## 1.1 The three first-run starting points: one of them is unreachable

`decisions.md` (Amendments 2026-08-18): *"Three starting points on first run, not
two: the wizard (primary), start from someone else's map, and add a belief by hand.
The second is new."*

All three are built, in `web/wizard.html:398-417` (`#home-empty`, "Three ways to
start"). But the routing never sends a new account there:

- `web/wizard.js:1090-1091` — `if (WG.answeredSlugs(domains).size) renderHome(); else showScreen('intro');`
- `engine/wizard-generate.js` `answeredSlugs()` returns **every** node slug in the
  map, so "size > 0" simply means "the map is not empty".
- A brand-new account has an empty map → `showScreen('intro')`.
- `#screen-intro` (`web/wizard.html:307-318`) offers exactly two things: **Start with
  the first question** and **Write a belief by hand instead**.
- `renderHome()` shows `#home-empty` only when `nodes.length === 0`
  (`web/wizard.js:640-642`) — a state `main()` never routes to. The only ways in are
  (a) start the questions, then press *Finish here* or *Back* without answering, or
  (b) press *Ignore for now* 86 times.

So the copy on the landing page promises something the next screen does not offer:

- `web/landing.html:61-62` — "A name and a short PIN is the whole sign-up. **Start
  from a blank page or from someone else's map.**" → sign up → intro screen, which
  has no such option.

**Suggested change** (`web/wizard.html:313-316`): put the third offer on the intro
screen beside the other two, as a third `.wz-link`, and wire it to the existing
`openPicker()` (`web/wizard.js:841`) — the picker is already written, already
guarded server-side, and already handles the empty-gallery case.

```html
<!-- current, web/wizard.html:313-316 -->
<div class="wz-actions">
  <button id="intro-start" type="button" class="wz-primary">Start with the first question</button>
  <a id="intro-byhand" href="/edit" class="wz-link">Write a belief by hand instead</a>
</div>

<!-- proposed -->
<div class="wz-actions">
  <button id="intro-start" type="button" class="wz-primary">Start with the first question</button>
  <button id="intro-copy" type="button" class="wz-link">Start from someone else's map</button>
  <a id="intro-byhand" href="/edit" class="wz-link">Write a belief by hand instead</a>
</div>
```

That also lets `#home-empty` (20 lines of markup with its own duplicate framing of
the same three offers — §2.4) be deleted outright. **This step does not need to
exist twice.**

## 1.2 The question screen answers in the wrong order

`web/wizard.html:335-376`, source order of the question screen:

1. `#q-title` — the question
2. `#q-readmore` — everything explanatory, behind a disclosure
3. **`#ignore-answer`** — "Ignore for now"
4. **`#open-answer`** — "I haven't worked this out yet"
5. `#positions` — the actual answers
6. `#custom-answer` — "My view is not one of these"
7. `#who` — "Who believes what?"
8. Back / Next

Two problems, both readable from the markup and CSS alone:

- **Order.** A person is asked to consider skipping and to declare ignorance before
  seeing a single position. On a 360px phone the heading (`font: 400 26px/1.25`,
  `max-width: 26ch`, so up to three lines ≈ 98px) plus the Read-more control (44px on
  touch, `engine/theme.css:81`) plus `#ignore-answer` (~70px) plus `#open-answer`
  (title + hint + label + a 3-row textarea ≈ 180px) plus four 14px gaps comes to
  roughly 450px of screen before position 1. The first real answer is below the fold
  on every question. *(Heading height depends on wrapped text I cannot measure — see
  §4.)*
- **Weight.** `#open-answer` (`web/wizard.html:156-160`) is
  `background: var(--ink); color: var(--bg)` — the exact treatment
  `engine/theme.css:60-63` reserves for `.tm-card-primary` and `web/wizard.html:67-71`
  for `.wz-primary`. It is the only filled block on the screen. The position cards
  are `var(--panel)` with a hairline. The visual hierarchy says *I don't know* is the
  recommended action.

**Suggested change.** Move `#positions` and `#custom-answer` above `#ignore-answer`
and `#open-answer`, and drop the inverted fill from `#open-answer` so it reads as a
peer of the position cards:

```css
/* current, web/wizard.html:156-160 */
#open-answer {
  position: relative;
  background: var(--ink); color: var(--bg); border-radius: 9px; padding: 14px;
  display: flex; flex-direction: column; gap: 7px; cursor: pointer;
}

/* proposed — the .wz-card shape, so it is an equal option, not the loud one */
#open-answer {
  position: relative;
  background: var(--panel); color: var(--ink);
  border: 1px solid var(--field-line); border-radius: 9px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 7px; cursor: pointer;
}
```

`web/wizard.html:162-163` (`#open-answer .lab`, `#open-answer .wz-holdfield`) then
become unnecessary and can go with it.

**Note on the lock.** `decisions.md` fixes *"'I don't know' is a first-class answer"*.
This does not reverse that: the tile stays, always present, on every question, still
producing a real node with `confidence: open` + `#study`. First-class means always
available, not visually loudest. Nothing here touches `applyAnswer`'s `open` branch.

## 1.3 The lens screen costs a tap that carries nothing, and cannot remember "no"

Two separate issues in `web/wizard.js:1046-1049` and `renderLens()`:

- **The confirming tap.** Picking a tradition card is a single-select that re-renders
  with `.sel` (`web/wizard.js:281-287`), and then the person must press **Done**
  (`web/wizard.html:329`). The screen itself says the choice is *"Changeable at any
  point"*, and both the question header and the launchpad carry a persistent
  "Shown first: X ▾" control (`web/wizard.html:301`, `394`). The Done press adds no
  information and no protection. **Suggested change:** make the card's own click
  handler call `leaveLens()` after storing the choice, and delete `#lens-next`.
  (Trade-off, stated: an accidental tap then advances — acceptable given the header
  control is one tap away and re-entering the lens does not disturb the current
  question, `web/wizard.js:302-306`.)
- **"I'd rather not say" is stored as `''`.** `web/wizard.js:284` writes
  `localStorage.setItem(LENS_KEY, id)` with `id === ''` for the no-tradition card, and
  `web/wizard.js:1047` tests `if (lens) startQuestions(); else openLens('intro');`.
  An empty string is falsy, so a person who deliberately answered "no tradition" is
  asked the same question again the next time they press *Start with the first
  question*. **Suggested change:** store a sentinel the code can tell apart — e.g.
  write `'none'` for that card and map it back to `''` on read — or gate on
  `localStorage.getItem(LENS_KEY) !== null` rather than on truthiness of `lens`.

## 1.4 Sign-up lands on the sign-in form

`web/landing.html:59` — the primary tile's href is `/#signin`. `#signin`
(`web/landing.html:79`) wraps **both** forms, and `#signed-out` is a grid
(`web/landing.html:24-25`, `auto-fit, minmax(280px, 1fr)`) which collapses to one
column on a phone with **Sign in** first and **Create an account** second. A
first-time visitor who taps "Make your own map" arrives at a *Sign in* heading and
has to scroll past it.

**Suggested change:** point the new-account tile at the account form and leave the
nav's "Sign in" pointing at `#signin`:

```html
<!-- current, web/landing.html:59 -->
<a class="tm-card tm-card-primary" id="make-own-tile" href="/#signin">
<!-- proposed -->
<a class="tm-card tm-card-primary" id="make-own-tile" href="/#signup-form">
```

and `web/landing.html:117` correspondingly:
`$('make-own-tile').href = user ? '/wizard' : '/#signup-form';`

## 1.5 `/view` offers "Make my own map" to people who have one

`web/view.html:89` — `makeMineBtn.hidden = false;` runs unconditionally, before any
branch. So a signed-in member reading **their own** map (the "My map" tile on `/`
links straight here, `web/landing.html:137`) is offered "Make my own map", and it
navigates to `/wizard`. A signed-in member reading someone else's map gets the same
button. The button is correct for exactly one visitor: a signed-out stranger.

**Suggested change** (`web/view.html:88-92`):

```js
// current
const user = getUser();
makeMineBtn.hidden = false;
makeMineBtn.addEventListener('click', () => {
  location.href = user ? '/wizard' : '/#signin';
});

// proposed — one label per audience, and nothing for the owner
const user = getUser();
const isOwner = !!user && !!name && user.name.toLowerCase() === name.toLowerCase();
if (!isOwner) {
  makeMineBtn.textContent = user ? 'Compare with mine' : 'Make my own map';
  makeMineBtn.hidden = false;
  makeMineBtn.addEventListener('click', () => {
    if (!user) { location.href = '/#signup-form'; return; }
    location.href = name ? '/compare?name=' + encodeURIComponent(name)
                         : '/compare?tradition=' + encodeURIComponent(traditionId);
  });
}
```

That also gives `/compare` an entry point from the thing a person is actually looking
at, which today it has only from a tile on `/`.

## 1.6 The generated map's "Edit ✎" link is wrong in two of its three homes

`engine/render.py:581` emits `<a class="editlink" href="engine/editor.html">Edit ✎</a>`
into the header of every rendered map. That is correct for the local double-clickable
file and (by rewrite) for `/thomas`. It is wrong everywhere else:

- On `/view?name=Sarah`, the HTML is injected as `iframe srcdoc` with
  `sandbox="allow-scripts"` and deliberately **no** `allow-same-origin`
  (`web/view.html:37`). A visitor reading Sarah's map is invited to edit it. Following
  the link cannot do anything useful — the frame has an opaque origin and no access to
  the session — so the best case is a dead control and the worst is a broken editor
  rendered inside the map frame.
- On `/view?tradition=anglican`, the same link appears on a generated tradition
  summary that nobody may edit.

**Suggested change:** the editable-map case is the one that knows it is editable, so
hide the link by default and let the two callers that own the file re-show it — e.g.
emit `class="editlink"` with `style="display:none"` plus a one-line inline script that
un-hides it when `window.top === window.self && location.protocol !== 'https:'`… which
is exactly the kind of cleverness this project avoids. The cheaper honest fix is to
gate it on frame-ness alone:

```python
# engine/render.py:581 — current
<a class="editlink" href="engine/editor.html">Edit &#9998;</a>
# proposed
<a class="editlink" id="editlink" href="engine/editor.html">Edit &#9998;</a>
```

plus, in the page's existing `<script>` block, `if (window.top !== window.self)
document.getElementById('editlink').remove();`. That removes it from both `/view`
cases and leaves the local file and `/thomas` untouched. **Needs a rendered check
before shipping** — see §4.

## 1.7 Step counts, path by path

Counted as *interactions the person makes*, from a cold start, reading the code.

| Path | Steps | Where a first-timer stalls | Removable |
|---|---|---|---|
| Sign up → first belief saved | 8: read `/` → tile → (scroll past Sign in) → name+PIN → Create → Start → pick a lens → **Done** → pick a position → Next | The lens screen: 12 unlabelled traditions + "I'd rather not say", with no statement of what happens if they get it wrong (the note says what it does, not what it costs) | The **Done** tap (§1.3); the scroll past Sign in (§1.4) |
| Start from someone else's map | Unreachable from the intro screen | — | n/a — it needs *adding*, §1.1 |
| Add a belief by hand (from intro) | intro → "Write a belief by hand instead" → `/edit` → **+ New domain** → name it → **+ New node in X** → fill → autosave | The empty-state copy names a button that does not exist yet (§2.5) | The domain step could be pre-seeded with `Beliefs`, which `decisions.md` already names as the starter area |
| Wizard → area list → one question | launchpad → *List questions* → row → answer → Back | Clean. The `returnTo` handling (`web/wizard.js:706-730`) is the best-worked path in the app | — |
| Gallery → read a map | `/gallery` → card → `/view` | Clean | — |
| `/learn` → a doctrine | `/learn` → row → doctrine page | Clean; works signed out as required | — |
| `/compare` → a result | `/` tile → picker → tradition or member card | The picker is two unlabelled grids under two headings; the tradition cards say only "N beliefs mapped" | — |
| Version history → restore | `/` tile → `/history` → Restore → confirm | Clean. The one `confirm()` in the app, and it earns it | — |
| Export | `/view` → **Export HTML** (header actions row) | Clean | — |
| Admin | `/admin` → PIN → Load users → per-user buttons | Clean for an admin; the page has no page padding (§3.3) | The name field is already skipped for a signed-in admin — good |

---

# 2. Copy: fluff and duplication

**Three lines.** The most valuable cut is not a sentence, it is a *category*: the
wizard states "nothing is filled in for you" **five separate times** across four
screens, and the app explains the tier scale in six places with four different
wordings. The most damaging omission is the mirror of that: the wizard removed its
tier and confidence glosses on the stated grounds that "the two scales are explained
once, on the launchpad" — and the launchpad does not explain them, so the one screen
carrying the tier control has no explanation of tiers anywhere on it. Finally, the
editor's copy still says **node** and **domain** in seven user-facing places, against
`phase-3-design.md`'s explicit rule that the words are *belief* and *area*.

## 2.1 The reassurance said five times

Same claim, five sites, four of them in the wizard:

| File:line | Current text |
|---|---|
| `web/landing.html:54-55` | "It is not a quiz and there is no score — nothing appears in a map that its owner did not put there." |
| `web/wizard.html:324-326` | "This changes the order positions are shown in, and labels who holds what. It never fills anything in — every answer below is mine." |
| `web/wizard.html:395` | "Re-orders answers. Never filters, never fills anything in." |
| `web/wizard.html:403` | "Twenty minutes of questions and there is a first map to edit. Nothing is added that was not chosen." |
| `web/wizard.html:362` | "Write it from scratch. Nothing here is prefilled, and nothing is inferred." |

The middle two are the same sentence about the *same control* — the lens — on two
screens. Keep the one attached to the choice itself and cut the launchpad restatement
to a label:

```html
<!-- current, web/wizard.html:394-395 -->
<button id="home-lens-btn" class="wz-ghost" type="button">Shown first: —</button>
<span class="wz-quiet">Re-orders answers. Never filters, never fills anything in.</span>

<!-- proposed -->
<button id="home-lens-btn" class="wz-ghost" type="button">Shown first: —</button>
<span class="wz-quiet">Ordering only.</span>
```

`web/wizard.html:403` loses its second sentence (the intro screen it duplicates is
already gone under §1.1):

```html
<!-- current --> <p>Twenty minutes of questions and there is a first map to edit. Nothing is added that was not chosen.</p>
<!-- proposed --> <p>Twenty minutes of questions and there is a first map to edit.</p>
```

`web/wizard.html:362` keeps "Nothing here is prefilled" (it is doing real work on a
blank form: the person needs to know the empty fields are empty on purpose) and loses
"and nothing is inferred", which restates it:

```html
<!-- current --> <p class="wz-hint">Write it from scratch. Nothing here is prefilled, and nothing is inferred.</p>
<!-- proposed --> <p class="wz-hint">Write it from scratch — nothing here is prefilled.</p>
```

**Not fluff, keep as-is:** `web/landing.html:54-55`. That is the canonical statement,
on the page a stranger reads first, and "it is not a quiz and there is no score" is
doing real work against the obvious wrong expectation.

## 2.2 The tier scale explained six ways — and not where the control is

Every explanation of the same scale:

| File:line | Wording |
|---|---|
| `web/landing.html:43-53` | Full: confidence band, T1–T4 list with glosses, half-steps |
| `web/learn.html:124-127` | "The coloured chip on each row is a **suggested** tier … a starting point, not a verdict … Each doctrine page says why it sits where it does." |
| `web/learn.js:97` | chip `title`: "Suggested tier: T2. A starting point, not a verdict." |
| `web/learn.js:106` | tier-note label: "Suggested tier T2 — why" |
| `web/compare.js:218-220` | "the suggested tier is a starting point, and moving it is what building a map is for." |
| `engine/render.py:591-592` | "tier is how much weight it carries, confidence is how settled it is" |
| `engine/editor.html:733-734` | "Tier is how much weight it carries. Confidence is how sure I am. They are two different questions." |
| `engine/editor.html:827-843` | `TIER_GLOSS` / `CONF_GLOSS`, per option in both selects |

And the gap. `web/wizard.js:373` says, in a comment above the control builder:

> *"The controls that appear in a chosen card's slot: tier, confidence, #study.
> **No glosses — the two scales are explained once, on the launchpad.**"*

The launchpad is `#screen-home` (`web/wizard.html:378-437`). It contains the stats
grid, a "Tier spread" bar, the lens row, the offers and the areas list. **It contains
no explanation of tier or of confidence.** `grep -i "ortlund\|triage\|essential\|
weight"` over `web/wizard.html` and `web/wizard.js` returns nothing but CSS variable
names. So the question screen — the only screen in the product where a person is
asked to *set* a tier — carries a six-button `T1 … T4` radio group with no gloss, no
tooltip and no link, and the promised canonical explanation is on `/`, a page they
last saw before signing up.

**Suggested change** — put it where the code already claims it is, in one line, using
the label that is already there:

```html
<!-- current, web/wizard.html:387-391 -->
<div class="wz-tier">
  <p class="lab">Tier spread</p>
  <div id="home-tierbar"></div>
  <p id="home-tiercounts" class="wz-quiet"></p>
</div>

<!-- proposed -->
<div class="wz-tier">
  <p class="lab">Tier spread</p>
  <div id="home-tierbar"></div>
  <p id="home-tiercounts" class="wz-quiet"></p>
  <p class="wz-quiet">Tier is how much weight a belief carries — T1 essential to the
    gospel, T2 church-defining, T3 important but not divisive, T4 a matter of liberty.
    Confidence is a separate question: how settled it is.</p>
</div>
```

and, at zero screen cost, give the radios the glosses the editor already has
(`engine/editor.html:827-843`) as `title` attributes — `web/wizard.js:199`:

```js
// current
const span = el('span', null, v);
// proposed
const span = el('span', null, v);
if (ramp && TIER_GLOSS[v]) span.title = TIER_GLOSS[v];
```

**Cut, same screen, `web/learn.html:127`:** "Each doctrine page says why it sits where
it does." That is an instruction for something obvious the moment a row is opened, and
the tier note is labelled "Suggested tier T2 — why" when it arrives.

```html
<!-- current, web/learn.html:124-127 -->
<p class="lp-lead lp-tierlegend">The coloured chip on each row is a <strong>suggested</strong> tier — how central that
  doctrine is usually taken to be, from T1 (the gospel itself) to T4 (a matter of opinion). It is a
  starting point, not a verdict: traditions reasonably tier the same doctrine differently, and anyone
  building a map sets their own. Each doctrine page says why it sits where it does.</p>

<!-- proposed -->
<p class="lp-lead lp-tierlegend">The coloured chip is a <strong>suggested</strong> tier — how central
  that doctrine is usually taken to be, from T1 (the gospel itself) to T4 (a matter of opinion).
  Traditions reasonably tier the same doctrine differently, and anyone building a map sets their own.</p>
```

**Not fluff, keep:** the word *suggested* on every chip, `web/learn.js:97`'s title, and
`web/learn.js:103-109`'s `tier_note`. `CLAUDE.md` states plainly why: the chip is
corpus data and renders signed out, so without "suggested" a stranger reads a
colour-coded `T1` as this site's verdict. Same for `web/compare.js:216-220` — it is
saying something the other two do not (that *moving* the tier is the point), and it is
the one place a person sees their own tiering held against a baseline.

## 2.3 The same sentence twice on `/`

`web/landing.html:61-62`, the primary tile:

> "A name and a short PIN is the whole sign-up. Start from a blank page or from
> someone else's map."

`web/landing.html:94`, in the form the tile links to:

> "A name and a short PIN. Nothing else, no email."

One screen, one scroll apart. The form's version carries the extra fact ("no email"),
so keep that one and let the tile say what the tile is for:

```html
<!-- current, web/landing.html:60-63 -->
<h3>Make your own map</h3>
<p>A name and a short PIN is the whole sign-up. Start from a blank page or
  from someone else's map.</p>
<span class="tm-go">Get started &rarr;</span>

<!-- proposed -->
<h3>Make your own map</h3>
<p>Answer the questions one at a time, or start from someone else's map.</p>
<span class="tm-go">Get started &rarr;</span>
```

(The second clause is only honest once §1.1 lands. If §1.1 is not taken, cut it.)

## 2.4 Two framings of the same three offers

`#screen-intro` and `#home-empty` describe the same wizard in different words:

- `web/wizard.html:311` — "86 questions, one at a time, starting with the ones
  everything else rests on. Answer a dozen and that is already a real map — it can be
  left at any point, and nothing here is locked once it is written."
- `web/wizard.html:403` — "Twenty minutes of questions and there is a first map to
  edit. Nothing is added that was not chosen."

Under §1.1 `#home-empty` is deleted and this resolves itself. If §1.1 is not taken,
delete `#home-empty`'s duplicate framing anyway and keep the intro's — it is the
better sentence and it is the one that gets read.

Also stale, same block: `web/wizard.html:311` hard-codes `<span id="intro-count">99</span>`.
The corpus holds **86** doctrines; 99 was the old node count of `theology-map.md`.
`web/wizard.js:1035` overwrites it before the screen is shown, so nobody sees it — but
the next person reading the markup will believe it.

## 2.5 The editor says "node" and "domain" — seven times

`phase-3-design.md` §2.2, quoted from the file: *"`node`, but the user-facing copy
says **"a belief"** and **"an area"**. Phase 4's wizard says the same. Code
identifiers are unchanged."* The wizard obeys this. The editor does not:

| File:line | Current | Proposed |
|---|---|---|
| `engine/editor.html:787` | `Delete this node` | `Delete this belief` |
| `engine/editor.html:877` | `This removes the node from the editor. It only leaves the file once you save.` | `This removes the belief from the editor. It only leaves the file once you save.` |
| `engine/editor.html:653` | `'+ New node in ' + domain.name` | `'+ New belief in ' + domain.name` |
| `engine/editor.html:663` | `+ New domain` | `+ New area` |
| `engine/editor.html:618` | placeholder `Filter nodes…` | `Filter beliefs…` |
| `engine/editor.html:717` | `Pick a node on the left, or add a new one.` | `Pick a belief on the left, or add a new one.` |
| `engine/editor.html:324` | `N node(s) edited` | `N belief(s) edited` |
| `engine/editor.html:252` | `aria-label="Domains and nodes"` | `aria-label="Areas and beliefs"` |

The mix is visible in one glance in the sidebar: the drawer summary already says
**"All beliefs (99)"** (`engine/editor.html:679`) and the button directly beneath it
says **"+ New node in Scripture"**. Two words for one thing, 30px apart.

**Consequential**, not cosmetic: `engine/editor.html:568-570`, the hosted empty-state,
tells a person with an empty map to use a control that is not on screen —

```js
// current
$('emptyIntro').textContent =
  'This map is empty. Answer the questions in the wizard to fill it in, '
  + 'or add a belief here with "+ New node".';
```

With no domains in the map, `renderTreeList()` (`engine/editor.html:630-666`) renders
**only** "+ New domain"; the per-domain "+ New node in X" button is inside the
`domains.forEach` loop and never runs. So the sentence names the one button that is
absent in exactly the state the sentence is written for.

```js
// proposed
$('emptyIntro').textContent =
  'This map is empty. Answer the questions in the wizard to fill it in, '
  + 'or start here with "+ New area".';
```

## 2.6 Explanations that are instructions for the obvious

- **`web/compare.html:120`** — "Any map that is public can be compared against from
  this page." The grid immediately below *is* the list of those maps, and
  `web/compare.js:375` already covers the empty case in words. **Cut the line.**
- **`web/wizard.html:347`**, the Ignore hint — "Takes this one out of the queue
  without writing anything. It can still be answered later." The first clause is queue
  jargon for what the button name already says; the second is the fact a person
  actually needs.
  → **"Nothing is written, and it can still be answered later."**
- **`web/wizard.html:352`**, the open-answer hint — "This becomes a real entry:
  confidence 'open', flagged for study, with a note of what is left to settle." The
  last clause describes the labelled textarea two lines below it
  (`web/wizard.html:353-354`, label **Still working out**).
  → **"This becomes a real entry: confidence 'open', flagged for study."**
- **`engine/editor.html:733-734`** — "Tier is how much weight it carries. Confidence
  is how sure I am. They are two different questions." sits directly above two selects
  whose every option already carries its gloss (`TIER_GLOSS` / `CONF_GLOSS`,
  `engine/editor.html:827-843`, wired in at `:738` and `:740`). Same screen, same
  information, twice.
  → keep the glosses (they are attached to the values), and cut the note to its one
  non-obvious sentence: **"Tier and confidence are two different questions."**

## 2.7 Copy that reads as an assertion with the reason missing

`web/landing.html:164-168`, the Unlist tile. The two states are not symmetrical: the
unlisted branch explains *why* it is not privacy, the listed branch just asserts it.

```js
// current
visP.textContent = isPublic
  ? 'Listed in the gallery. Unlisting takes it out of the gallery and stops the '
    + 'name-keyed render. That is not privacy.'
  : 'Unlisted: out of the gallery, and the name-keyed render is off. That is not '
    + 'privacy — anyone already holding a link can still read it.';

// proposed — one sentence each, both carrying the reason
visP.textContent = isPublic
  ? 'Listed in the gallery. Unlisting removes it and stops the name-keyed render — '
    + 'but anyone already holding a link can still read it.'
  : 'Unlisted: out of the gallery, name-keyed render off — but anyone already '
    + 'holding a link can still read it.';
```

Shorter *and* more informative in the listed state. The words **Unlist** / **Relist**
(`web/landing.html:163`) are untouched — that wording is locked in `decisions.md`
(2026-08-23, "Unlisting is not privacy") and must stay.

## 2.8 Wrong copy for a real state

`web/gallery.html:131` — the primary card's body is `'Sign up free and start mapping
your own beliefs.'` `web/gallery.html:164-166` shows that card to a **signed-in** user
whose own map is empty or unlisted, and `:125` sends them to `/wizard`. So a member
who has just unlisted their map is told to sign up.

```js
// current, web/gallery.html:128-131
h3.textContent = 'Make your own map';
p.textContent = 'Sign up free and start mapping your own beliefs.';

// proposed
h3.textContent = user ? 'Fill in your map' : 'Make your own map';
p.textContent = user
  ? 'Answer the questions and your map appears here alongside everyone else’s.'
  : 'Sign up free and start mapping your own beliefs.';
```

## 2.9 A sentence fragment in a dialog

`engine/editor.html:280-282`:

```html
<h2>This map was changed somewhere else</h2>
<p>(another tab or window). Your unsaved changes are still here.</p>
```

The body opens with a parenthetical that only parses as a continuation of the heading.

```html
<!-- proposed -->
<h2>This map was changed somewhere else</h2>
<p>Another tab or window saved over it. Your unsaved changes are still here.</p>
```

## 2.10 Text that looks like fluff and is not — do not cut these

- **`web/wizard.js:129-132`** — "Sources open in a new tab, and anything answered on
  this screen is saved before the tab opens." This looks like an instruction for
  something obvious. It is a **locked condition**: `decisions.md` (phase 4 session 10)
  records Thomas approving mid-wizard source links *"with two conditions … the link
  opens in a new tab, and any answer already chosen on that screen is saved before the
  tab opens … and the explainer says so in place."* Keep the sentence.
  The one safe improvement is *frequency*: `explainer()` appends it to every explainer
  that has sources, so it renders in the doctrine's Read-about box **and** again in
  every position card's Read-more popover. Passing a flag so only the doctrine-level
  explainer carries it honours the lock and stops the repetition.
- **`web/wizard.js:367-369`** — "Chips and stances describe who holds what. They are
  not a ranking, and they are not a recommendation." This is the descriptive-not-
  evaluative guarantee at the one place the app puts named traditions in a list. Keep.
- **`web/view.html:28`** — "A generated summary of what this tradition confesses, not
  a person's map." `CLAUDE.md` calls it a standing line. Keep.
- **`web/admin.html:41-43`** — the Unlisting note. It duplicates `/`'s tile copy, but
  the audiences and the powers differ (an admin unlists *someone else's* map), and it
  is the one place the "delete the account if a map must go" escape is stated. Keep.
- **`web/history.html:31-34`** — "No earlier versions yet — one is kept the first time
  you change a map you have already saved." Teaches the throttle rule, which is
  otherwise invisible. Keep.
- **`web/compare.js:171-176`** — the two-branch "no closest tradition" copy. The
  comment above it records that a hand-written map resolves to `own-wording` on 73 of
  86 rows, so the generic "not enough answered" sentence would read as a bug to its
  owner. Two branches here is correct.

## 2.11 One voice inconsistency, noted not prescribed

`web/compare.js:7` states the house rule: *"Written in first person / neutral voice
throughout — never second person."* `/compare`, `/learn` and `/wizard` hold to it
("my map", "What I hold", "I haven't worked this out yet"). `/` and `/history` do not:
"Make **your** own map", "See **your** map exactly as everyone else does",
"Sign in to see **your** map history", "This replaces **your** map…".

I am flagging rather than proposing, because it is arguably deliberate: second person
is the natural voice for an offer made to a stranger, first person for text that
speaks *as* the map. If it is deliberate it is worth one line in
`phase-3-design.md` saying where the boundary is, because the next session will read
`compare.js:7` as a blanket rule and "fix" the landing page.

---

# 3. Spacing — phone and desktop

**Three lines.** There is no spacing or type scale: 14 distinct gap/padding values and
**21 distinct font sizes** across `web/*.html` + `theme.css`, including five half-pixel
sizes used interchangeably with their integer neighbours. Three concrete defects are
worth fixing regardless of any scale work — the top navigation's tap targets are
**12px tall** on a phone, the wizard's "Read more" button overlaps the *Outside the
historic creeds* text on the three question screens that carry it, and `/admin` has no
page padding or width cap at all because it has no `<main>`. The prose measure is
capped in four different places at four different values (58ch, 62ch, 68ch, 72ch)
against `phase-3-design.md` §3's single stated cap of 58ch.

## 3.1 There is no scale

Measured over `web/*.html` and `engine/theme.css`:

- **gap / padding values:** `3 4 5 6 7 8 9 10 12 14 16 18 20 22` px — 14 distinct
  values, no common factor, no documented ladder.
- **font sizes:** `10 10.5 11 11.5 12 12.5 13 13.5 14 14.5 15 15.5 16 17 19 20 22 24
  26 28 32` px — 21 distinct values. The half-steps are not a system: `.tm-stat` is
  12px (`theme.css:65`), `.wz-quiet` is 12.5px (`wizard.html:65`), `.lp-row .count` is
  12px (`learn.html:44`), `.cmp-count` is 12px (`compare.html:80`), `.cmp-verdict` is
  12.5px (`compare.html:87`) — five muted metadata labels, two sizes, no rule
  distinguishing them.

**Suggested change** — no framework, no build step, no restyling: declare the ladder
once in `engine/theme.css` as tokens, and let new work reach for a token instead of a
number. Existing values stay until something is touched for another reason.

```css
/* engine/theme.css, after the :root block at line 27 */
:root {
  --s1: 4px;  --s2: 8px;  --s3: 12px; --s4: 16px; --s5: 22px; --s6: 32px;
  --fs-meta: 12px; --fs-body: 14px; --fs-lead: 15px; --fs-h3: 17px;
  --fs-h2: 20px; --fs-h1: 26px;
}
```

That is documentation with teeth rather than a refactor; nothing renders differently
on the day it lands.

## 3.2 Tap targets under 44px

`engine/theme.css:80-83` sets the floor:

```css
@media (pointer: coarse) {
  button, .tabbtn, select, .nodebtn, details.optional > summary { min-height: 44px; }
  .mdomain-edit, .tagchip button { min-width: 44px; min-height: 44px; }
}
```

It selects `button` — an element selector, specificity (0,0,1) — and it does not
select `a` at all. Both gaps are load-bearing.

| Control | File:line | Computed height | Why it escapes the floor |
|---|---|---|---|
| **Top nav links** (Home / Wizard / Edit / Browse / Sign out) | `engine/theme.css:92-93` | **12px** (`font: 600 12px/1` + a 1px transparent bottom border) | `a` is not in the coarse list. This is the product's primary navigation, on every page, and below 640px it also scrolls horizontally (`theme.css:107`) |
| `.wz-radio span` — every tier and confidence button | `web/wizard.html:194-202` | **30px** (`min-height: 30px`) | The tappable box is a `<span>` inside a `<label>`, not a `button` |
| `.mradio span` — the same controls in the editor's map tile | `engine/editor.html:120-122` | **30px** | same |
| `.wz-qrow` — every row of an area's question list | `web/wizard.html:260-265` | ~40px | It *is* a `<button>`, but `.wz-qrow { min-height: 24px }` is (0,1,0) and **beats** the (0,0,1) `button` rule regardless of load order |
| `.cmp-row > summary` — every diff row on `/compare` | `web/compare.html:83` | ~40px (`padding: 10px 0` + `14.5px/1.4`) | `details` without `.optional` |
| `.cmp-acc > summary` — the **phone-only** scorecard accordion | `web/compare.html:44` | ~34px (`padding: 8px 0` + `13.5px/1.3`) | same. The touch-only alternative to the table has sub-44px targets |
| `.lp-row` — every row of the `/learn` index | `web/learn.html:36-40` | ~42px (`padding: 10px 12px` + `14.5px/1.4` + 2px border) | `a` |
| `.lp-back`, `.lp-mine-actions a` | `web/learn.html:70-71`, `:101-102` | ~13px | `a` |
| `.wz-check` label — the `#study` checkbox row | `web/wizard.html:209-211` | ~20px (label), 16px (the box itself) | `label` |
| Error-banner close button | `web/session.js:101-105` | ~18×12px, `position:absolute`, no padding | Built in JS with an inline `cssText`, outside every stylesheet |

**Suggested change**, one edit, covering the top four rows:

```css
/* engine/theme.css:80-83 — current */
@media (pointer: coarse) {
  button, .tabbtn, select, .nodebtn, details.optional > summary { min-height: 44px; }
  .mdomain-edit, .tagchip button { min-width: 44px; min-height: 44px; }
}

/* proposed */
@media (pointer: coarse) {
  button, .tabbtn, select, .nodebtn, details.optional > summary { min-height: 44px; }
  .mdomain-edit, .tagchip button { min-width: 44px; min-height: 44px; }
  /* Links are controls too. Padding rather than min-height, so an inline link
     inside a paragraph is not turned into a block. */
  .tm-chrome .toplinks a { padding: 16px 0; }
  .lp-row { padding: 12px 12px; }
  .cmp-row > summary, .cmp-acc > summary { padding: 12px 0; }
  .wz-radio span, .mradio span { min-height: 38px; }
}
```

and remove the class-level override that defeats the floor:

```css
/* web/wizard.html:264 — current */  min-height: 24px; width: 100%; text-align: left; cursor: pointer;
/* proposed */                        width: 100%; text-align: left; cursor: pointer;
```

`.wz-radio span` at 38px rather than 44px is a deliberate compromise and should be
recorded as one: `web/wizard.html:192-193` says the 30px was chosen so eleven radios
stop wrapping on a phone, and 44px would put tier back onto three rows. 38px is a
~27% larger target for one extra wrapped row at most. **This is the one number here
that genuinely wants a rendered check** (§4).

## 3.3 `/admin` has no page layout at all

`engine/theme.css:115` supplies every page's gutter and width cap:

```css
body.tm-page main, body.tm-page .tm-main { padding:20px; max-width:1200px; margin-inline:auto; }
```

`web/admin.html` has **neither** a `<main>` nor a `.tm-main` — its four blocks
(`:41` the note, `:45` `#creds`, `:57` `#pin-reveal`, `:59` `#users-list`) are direct
children of `<body>`. So the admin console renders with the UA's default 8px body
margin and no width cap: `#users-list`'s `repeat(auto-fill, minmax(280px, 1fr))`
(`web/admin.html:22-23`) becomes nine columns on a 2560px monitor, and every block sits
8px from the edge on a phone while every other page sits at 28px.

```html
<!-- web/admin.html:39-59 — current -->
<div id="tmChrome"></div>
<p class="tm-note">…</p>
<div id="creds" class="tm-card">…</div>
<div id="pin-reveal" class="tm-note" hidden></div>
<div id="users-list" hidden></div>

<!-- proposed: one wrapper, no new CSS -->
<div id="tmChrome"></div>
<main class="tm-main">
  <p class="tm-note">…</p>
  <div id="creds" class="tm-card">…</div>
  <div id="pin-reveal" class="tm-note" hidden></div>
  <div id="users-list" hidden></div>
</main>
```

## 3.4 The stale `body` margin comment, and the 16px that costs `/view` a scrollbar

`engine/theme.css:110-113`:

> *"No `margin` here on purpose. These four pages still carry their own inline body
> rule with `margin:40px auto`, and `body.tm-page` outranks it…"*

No page carries that rule any more (`grep -n "body" web/*.html | grep -i margin`
returns one hit, and it is `.wz-screen-body`). The reason for the omission is gone, so
every `.tm-page` now carries the UA's default `margin: 8px` unintentionally.

It is harmless on most pages and not on `/view`, which is built to fill the viewport:

```css
/* web/view.html:13-15 */
html, body.tm-page { height: 100%; }
body.tm-page { display: flex; flex-direction: column; }
.tm-main { … flex: 1 1 auto; min-height: 0; }
```

`height: 100%` on a body with 8px top and bottom margins makes the page 16px taller
than the viewport, so the "fill the screen" map frame produces a permanent 16px
scroll. **Suggested change** (`engine/theme.css:114`):

```css
/* current */ body.tm-page { background:var(--bg); color:var(--ink); font:15px/1.6 var(--serif); }
/* proposed */ body.tm-page { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 var(--serif); }
```

and delete the four-line comment above it, which no longer describes anything.

## 3.5 Horizontal overflow at 320px

`engine/theme.css:123-125`:

```css
.tm-grid { display:grid; gap:14px; max-width:1200px; margin-inline:auto;
           grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); }
```

The comment above it claims *"Both collapse to one column below ~330px of track,
which covers 360px phones with no breakpoint."* True at 360px (360 − 16 body − 40
padding = 304px available, and a 300px track fits). At **320px** — iPhone SE first
generation, and any 360px phone at 125% text zoom — the available width is 264px while
`minmax(300px, 1fr)` floors the track at 300px, so the grid overflows its container by
36px and the page scrolls sideways. Every card grid in the app uses this: the gallery,
the landing tiles, the copy picker, the wizard's offers.

```css
/* proposed — the standard one-token fix, no breakpoint, no framework */
grid-template-columns:repeat(auto-fill, minmax(min(300px, 100%), 1fr));
```

Same edit applies to `.tm-firstrun` (`theme.css:125`), `#lens-list`
(`web/wizard.html:80`, 220px), `#picker-traditions, #picker-members`
(`web/compare.html:18-19`, 220px) and `#users-list` (`web/admin.html:23`, 280px).
The 220px ones do not overflow at 320px today; making them consistent costs nothing.

## 3.6 The "Read more" button overlaps the *Outside the historic creeds* text

`web/wizard.js:473-504` builds a position card in this order: the outside marker, then
`.wz-card-h`, then the chips, then the hold field, then `.wz-tools`. `.wz-tools` is
absolutely positioned:

```css
/* web/wizard.html:130-131 */
.wz-tools { position: absolute; top: 8px; right: 10px; display: flex;
            align-items: center; gap: 8px; }
```

Two rows reserve a gutter for it and say so —
`.wz-card-h { … padding-right: 88px }` (`:119`) and `.wz-chips { … padding-right: 88px }`
(`:121`). The two elements that render **above** both of them do not:

```css
/* web/wizard.html:152-154 */
.wz-outside { margin: 0; font: 600 11.5px/1.4 var(--sans); … }
.wz-outside-note { margin: 2px 0 0; font: 12.5px/1.55 var(--serif); … max-width: 62ch; }
```

Geometry, from the card's own padding (`12px 14px`, `:111`):

- `.wz-outside` occupies y ≈ 12–28px, full card width.
- `.wz-outside-note`'s first line occupies y ≈ 30–49px, full card width (`62ch` is
  wider than the card on a phone, so it wraps at the container).
- `.wz-more` is `padding: 6px 8px` at `font: 600 11.5px/1` (`:132-134`) → 25.5px tall,
  y ≈ 8–33.5px. **On a coarse pointer `engine/theme.css:81` raises it to 44px**,
  y ≈ 8–52px.

So the Read-more button overlaps the note's first line by ~4px on a mouse and covers
the first **two** lines on a phone, in a ~90px-wide strip at the right edge.

This is not hypothetical: three corpus doctrines carry an `outside` position, with
`orthodoxy_note` lengths of 206, 477 and 557 characters —

- `content/wizard/god.json` → `god.trinity` → **Oneness** (557 chars)
- `content/wizard/humanity-and-sin.json` → `…depravity-and-prevenient-grace` → **Pelagian** (206)
- `content/wizard/missions-and-world-religions.json` → `…exclusivity-of-christ` → **Pluralism** (477)

`god.trinity` is a T1 doctrine, and `decisions.md` fixes T1 first, so this is on one of
the first screens a new person sees. `decisions.md` also made exercising this treatment
phase 5's explicit job.

```css
/* proposed — web/wizard.html:152-154, the same gutter the other two rows reserve */
.wz-outside { margin: 0; padding-right: 88px; font: 600 11.5px/1.4 var(--sans);
              letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.wz-outside-note { margin: 2px 0 0; padding-right: 88px; font: 12.5px/1.55 var(--serif);
                   color: var(--muted); max-width: 62ch; }
```

## 3.7 Four prose measures for one design system

`phase-3-design.md` §3, in the list headed *"Unchanged and non-negotiable"*: **"Prose
capped at 58ch."**

| Value | Where |
|---|---|
| **58ch** | `engine/theme.css:45` `.tm-note`, `:58` `.tm-card p`, `:135` `.tm-prose`; `engine/render.py:389` `dd` |
| **62ch** | `web/wizard.html:61` `.wz-lead`, `:95` `.wz-framing`, `:154` `.wz-outside-note`, `:180` `.wz-hint`; `web/compare.html:59` `.cmp-tier-lead`, `:97-98` |
| **68ch** | `web/learn.html:76` `.lp-prose`, `:77` `.lp-hint`, `:98` `.lp-mine` |
| **72ch** | `engine/render.py:319` `.sub` |

68ch at `14.5px` serif is roughly 500px of running text — above the 45–75ch band and
above the project's own cap. The doctrine page (`web/learn.js:340`) puts the framing
paragraph straight into `<main>`, so it takes the full 68ch.

**Suggested change:** move the three `/learn` values to 58ch and the wizard's to 58ch,
or — if 62ch is the number Thomas actually wants — amend `phase-3-design.md` §3 to say
62ch and bring the other three into line. Either is fine; four numbers is not.

## 3.8 `/learn`'s width cap is a dead selector

```css
/* web/learn.html:18-19 */
main.tm-page { max-width: 900px; }
body.tm-page { max-width: none; }
```

`tm-page` is on the `<body>` (`web/learn.html:116`), never on the `<main>`
(`:120`). `main.tm-page` matches nothing, so `/learn` is capped at 1200px by
`engine/theme.css:115` like every other page — the author's intended 900px never
applies, and the second rule fights a `max-width` that `body.tm-page` never had.

```css
/* proposed */
body.tm-page main { max-width: 900px; }
```

(Same specificity class as theme.css's `body.tm-page main`, declared later on the page,
so it wins cleanly.)

## 3.9 Vertical rhythm: one flat gap, no grouping

`web/wizard.html:51-52` — `.wz-screen-body { … gap: 14px }` applies the same 14px
between *every* pair of blocks on the launchpad: the stats card ↔ the tier spread ↔
the lens row ↔ the offers ↔ the areas list. Inside those blocks the gaps are 3–8px
(`:231` `gap:3px`, `:235` `gap:7px`, `:240` `gap:6px`), so intra-section and
inter-section spacing differ by only 6–11px and the launchpad reads as one
undifferentiated column. Then the markup patches it back with inline styles —
`web/wizard.html:399` `style="margin-bottom:8px"`, `:420` `style="margin-bottom:14px"`,
`:432` `style="margin-bottom:8px"` — which is the symptom, not the fix.

```css
/* proposed, web/wizard.html:51-52 */
.wz-screen-body { max-width: 760px; margin: 0 auto; padding: 22px 18px 36px;
                   display: flex; flex-direction: column; gap: 26px; }
/* and, so the question screen's tighter stack is unaffected */
#screen-question .wz-screen-body { gap: 14px; }
```

With 26px between blocks the three inline `margin-bottom` patches can be deleted.

Related ad hoc value: `web/learn.html:50` `.lp-tierlegend { font-size: 13px;
margin-top: -8px; }` — a negative margin cancelling `.lp-lead`'s own `margin: 0 0 16px`
(`:21`) so two lead paragraphs sit closer. `.lp-lead + .lp-lead { margin-top: -8px }`
would at least say what it is doing; better, give the legend its own class with a
positive margin.

## 3.10 Three page gutters and two header insets

| Surface | Left inset | File:line |
|---|---|---|
| `/`, `/gallery`, `/history`, `/view`, `/compare` | 8 (body) + 20 = **28px** | `engine/theme.css:115` |
| Wizard screens | 8 + 18 = **26px** | `web/wizard.html:51` |
| Wizard question-screen header | 8 + 16 = **24px** | `web/wizard.html:27` |
| Site chrome header | 8 + 20 = **28px** | `engine/theme.css:88` |
| `/admin` | **8px** | no `<main>` — §3.3 |

The wizard is the visible one: `showScreen()` (`web/wizard.js:242-252`) swaps between
the site chrome (`padding: 16px 20px 12px`) and `#wz-header` (`padding: 8px 16px`) on
every entry to and exit from a question, so the brand block shifts 4px left and 8px up
each time. **Suggested change:** `#wz-header { padding: 16px 20px 12px; }` to match
`.tm-chrome`, and `.wz-screen-body { padding: 22px 20px 36px; }`.

## 3.11 Media queries: what changes, and what does not

Every breakpoint in the app:

| Breakpoint | File | What it does | Assessment |
|---|---|---|---|
| `(pointer: coarse)` | `theme.css:80-83` | 44px floor on buttons | Correct pattern (width-independent), incomplete coverage — §3.2 |
| `max-width: 640px` | `theme.css:106-108` | nav scrolls horizontally instead of wrapping | Correct, and the comment explaining why the inline `flexWrap` had to go is worth keeping |
| `max-width: 480px` | `wizard.html:221`, `learn.html:94` | the who-holds-what `<dl>` goes single-column | Correct |
| `max-width: 560px` | `wizard.html:230` | stats grid 4 → 2 columns | Correct |
| `max-width: 560px` | `wizard.html:287`, `compare.html:90` | 2-col card grids → 1 | Correct |
| `max-width: 860px` | `compare.html:49-52`, `learn.html:80` | scorecard table → accordion; positions 2-col → 1 | The best-handled responsive case in the app: the table stays inside `overflow-x:auto` **and** has a real alternative below the breakpoint |
| `max-width: 900px and min-width: 641px` | `editor.html:200` | tree 290 → 240px | Matches `phase-3-design.md` §9.3 |
| `max-width: 640px` | `editor.html:202-213` | tree becomes a top drawer, tabs full-width | Correct |
| `(pointer: coarse)` | `render.py:497-504` | bumps padding on the generated map's controls | **Under-specified — see below** |
| `max-width: 640px` | `render.py:507-532` | secondary filters behind a disclosure, kicker/sub/legend hidden | Correct, and the disclosure pattern is reused consistently |
| `max-width: 560px` | `render.py:534-538` | card `<dl>` stacks labels above values | Correct |
| `print` | `render.py:542-575` | A3, two columns, `print-color-adjust` on the three colour-carrying elements | Thorough |
| `prefers-reduced-motion` | `gallery.html:20-23` | skeleton pulse only when motion is welcome | Correct |
| `prefers-color-scheme: dark` | `theme.css:16,28`, `render.py:294`, `editor.html:23`, `wizard.html`/`learn.html`/`compare.html` tier ramps | token swap | Correct, but the ramp is copy-pasted into four files — see §3.13 |

**What should change and does not:** `engine/render.py:497-504` is the coarse-pointer
block for the generated map — the surface most people will actually browse on a phone,
since `/view` embeds it. Unlike `theme.css`, it bumps padding rather than setting a
floor, and nothing in it reaches 44px:

| Control | render.py:line | Coarse height |
|---|---|---|
| `.views button` (Map / Domain / Tier / Confidence) | `:499` | 12.5 + 18 = **30.5px** |
| `.seg button` (All / Only study / Hide study) | `:499` | 12 + 18 = **30px** |
| `.refchip` (every scripture pill) | `:498` | 16.5 + 14 + 2 = **32.5px** |
| `.btnrow button` (Expand all / Collapse all) | `:501` | 11.5 + 16 + 2 = **29.5px** |
| `.mapcontrols button` (Reset view) | `:503` | 11.5 + 16 + 2 = **29.5px** |
| `.filtersToggle` (the phone Filters control) | not in the block | 12 + 14 + 2 = **28px** |
| `label.tog` (hide inferred) | `:502` | **24px** |

```css
/* engine/render.py:497-504 — proposed, same house style as theme.css */
@media (pointer:coarse) {
  .refchip { padding:7px 10px; }
  .views button, .seg button { padding:9px 13px; }
  .group > h2 { padding-top:4px; padding-bottom:10px; }
  .btnrow button { padding:8px 12px; }
  label.tog { padding:6px 0; }
  .mapcontrols button { padding:8px 12px; }
  .views button, .seg button, .btnrow button, .mapcontrols button,
  .filtersToggle, .refchip, label.tog { min-height:44px; }
}
```

Note this changes generated output, so it moves the two hashes in `CLAUDE.md`. Per the
rule recorded there, that is legitimate only as a deliberate restyle with the `.mm`,
`study-list.md` and the embedded `<script id="data">` payload verified byte-identical
across it.

## 3.12 Two rules whose absence would go unnoticed

- **`web/compare.html` has no `[hidden] { display: none !important }`.** Both
  `web/wizard.html:21` and `web/learn.html:16` carry it, and `debug.md` §Q is the
  write-up of the bug it prevents: an author `display` rule on an ID beats the
  browser's `[hidden]` attribute rule. `/compare` has exactly that shape —
  `#cmp-closest { display: flex; … }` (`web/compare.html:27`) is toggled by
  `web/compare.js:420` (`.hidden = !isTradition`). It is invisible today only because
  `renderClosest()` is never called on the member branch, so the element is empty and
  collapses to zero height. The first edit that fills it before hiding it leaks a
  closest-tradition line onto a person-to-person comparison — which is the one thing
  `decisions.md` says compare must never do.

  ```css
  /* proposed — web/compare.html, beside the tier ramp at :10-12 */
  [hidden] { display: none !important; }
  ```

- **`#home-areas` is a stale selector applied to the wrong element.**
  `web/wizard.html:240` — `#home-areas { display: flex; flex-direction: column; gap: 6px; }`
  was written for the areas list, which is now `#home-areas-list`
  (`web/wizard.html:433`). The id `home-areas` today belongs to the *stat number span*
  at `:382` (`web/wizard.js:619` writes the domain count into it), so the rule turns a
  28px numeral into a block-level flex container and the real list has no `gap` at all
  (its rows are spaced only by `.wz-area`'s own borders).

  ```css
  /* proposed */ #home-areas-list { display: flex; flex-direction: column; gap: 6px; }
  ```

## 3.13 Interactive borders in the editor use the decorative token

`engine/theme.css:32-37` states the rule and enumerates what it covers:

> *"Interactive control boundaries take `--field-line`. Decorative dividers keep
> `--line`. Do not merge these two."*

`--line` on `--panel` is 1.36:1 and fails WCAG 2.1 SC 1.4.11; `--field-line` is 3.68:1.
The selector list covers inputs, selects, textareas and `.tm-card` — **not `button`**.
`engine/render.py` sets `--field-line` on its buttons by hand (`:338`, `:481`) and
`web/wizard.html`'s `.wz-ghost` (`:45`) does too. `engine/editor.html` does not:

| File:line | Current | Proposed |
|---|---|---|
| `engine/editor.html:55` | `button { … border:1px solid var(--line); … }` | `border:1px solid var(--field-line);` |
| `engine/editor.html:64-65` | `.tabbtn { … border:1px solid var(--line); … }` | `var(--field-line)` |
| `engine/editor.html:121` | `.mradio span { … border:1px solid var(--line); … }` | `var(--field-line)` |
| `engine/editor.html:102` | `.mapcontrols button { … var(--line) … }` | `var(--field-line)` |
| `engine/editor.html:140-141` | `nav.tree input[type=search] { … var(--line) … }` | already overridden by `theme.css:34-37`; harmless but misleading — align it |

So every button in the editor — Save, Save & render, the Map/List tabs, and the tier
and confidence radios inside an open map tile — draws its boundary at 1.36:1.

## 3.14 The generated map's content column does not centre; its footer does

```css
/* engine/render.py:347 */  main { padding:18px 22px 90px; max-width:1080px; }
/* engine/render.py:415 */  .pagefoot { max-width:1080px; margin:0 auto; padding:18px 22px 40px; }
```

Same cap, one centred and one not. On a 1920px window the cards sit hard against the
left edge and the NET attribution sits in the middle, 420px to their right.

```css
/* proposed */ main { padding:18px 22px 90px; max-width:1080px; margin-inline:auto; }
```

## 3.15 The map viewport height is a magic number in two places

```css
/* engine/render.py:436 */  #mapwrap { … height:calc(100vh - 130px); … }
/* engine/render.py:525 */  @media (max-width:640px) { #mapwrap { height:calc(100vh - 108px); } }
```

The subtracted value has to equal the sticky header's height, and that height is
content-dependent: above 640px the header carries the kicker, the title row, `.sub`,
the control bar **and** the six-swatch tier legend, which wraps. Adding the declared
box heights (`:304` padding 15+11, kicker 13, title row ~31, `.sub` 18.75 + 11 margin,
bar ~29, legend 10 + 11, 1px border) gives roughly **151px** against the 130px
subtracted — a permanent ~21px page scroll on desktop. Below 640px the kicker, `.sub`
and the legend are all hidden (`:509-512`), giving roughly **76px** against 108px —
~32px of viewport left unused on the screen that can least afford it.

I cannot confirm either number without rendering (§4). If they are wrong, the fix that
needs no build step and no new dependency is to measure once in the script block the
page already has:

```js
// after the header exists
const h = document.querySelector('header').offsetHeight;
document.documentElement.style.setProperty('--headerh', h + 'px');
// and in CSS: #mapwrap { height: calc(100vh - var(--headerh, 130px)); }
```

with a `resize` listener re-running it. Same output file, no new assets.

## 3.16 Card padding at narrow widths — holds up

Checked and fine, recorded so it is not re-litigated. At a 360px viewport the usable
card interior is 360 − 16 (body) − 36 (`.wz-screen-body`) − 28 (`.wz-card` padding) =
**280px**. `.wz-card-h`'s 88px right gutter leaves 192px for a position label, which
wraps rather than overflows. `.mbox-leaf`'s `max-width: min(320px, 86vw)` and
`.mbox-leaf.mopen`'s `min(560px, 92vw)` (`render.py:461-463`) are both viewport-relative
and cannot overflow. `input[type=search]`'s `min-width: 190px` (`render.py:332`) is
correctly reset to `min-width: 0` in the phone block (`:518`), so the title row
shrinks instead of overflowing. `.cmp-table`'s `min-width: 560px` is inside
`overflow-x: auto` (`compare.html:31-32`) and additionally replaced by an accordion
below 860px — the model the rest of the app should copy.

---

# 4. Not reviewed / could not verify

Stated plainly, because several of the numbers above would be settled in ten seconds
with a browser and the house rule forbids one.

**Everything measured here is computed from stylesheets, not observed.** Specifically:

- **Every height that depends on wrapped text.** The `#screen-question` "450px before
  the first position" figure (§1.2) assumes a three-line question heading at
  `26px/1.25` inside `max-width: 26ch`. Questions shorter than 26ch give two lines and
  the figure drops by ~33px. The direction of the finding does not depend on the
  number; the number does.
- **The `.wz-outside` overlap (§3.6).** The geometry is deterministic given
  `position:absolute; top:8px` and the source order in `web/wizard.js:475-500`, and I
  am confident the overlap is real — but the exact number of covered lines depends on
  the rendered width of `.wz-more`'s label and on the system sans metrics. **Open the
  Trinity question on a phone before and after the fix.**
- **`#mapwrap`'s `calc(100vh - 130px)` (§3.15).** My header arithmetic sums declared
  box heights and assumes the tier legend fits on one line; it may wrap to two on a
  narrow desktop window, making the mismatch worse. This one is a guess with a method,
  not a measurement.
- **The 38px radio compromise (§3.2).** Whether 38px pushes the tier group onto a
  third row on a 360px phone depends on the rendered width of six radio labels. Try
  38px; fall back to 34px if it wraps.
- **Font metrics generally.** `ui-serif` / `ui-sans-serif` resolve to different faces
  on Windows, macOS, iOS and Android, so every `ch`-based measure and every
  text-width estimate varies by platform. The 320px overflow (§3.5) does not — it is
  pure box arithmetic.
- **Colour contrast.** I have quoted the ratios the repo states about itself
  (`theme.css:25`, `render.py:285-287`, `phase-3-design.md` §3.1) and have not
  recomputed any of them. §3.13 is an argument from the project's own stated rule, not
  from a fresh measurement.

**Deliberately not read**, per the brief: `theology-map.html`, `documentation/verses.md`.

**Out of scope, not examined:** `api/*.py` beyond the request/response shapes the
browser code depends on (no security review, no route-level review); the SQL under
`supabase/`; `engine/render.py`'s map-layout JS (`assignX` / `assignY` / `redraw`) and
`engine/map-view.js`, both of which compute geometry at runtime from `offsetWidth` and
cannot be assessed from CSS — and both of which are lockstep-bearing, so a spacing
change there is a bigger decision than this review should make; the corpus content
itself; `engine/build_traditions.js`; the test suite.

**One thing I could not determine from the code:** whether the second-person voice on
`/` and `/history` (§2.11) is a deliberate boundary or drift. It needs Thomas, not a
reading.

---

# 5. Prioritised — all three areas

| # | Severity | Area | File:line | Finding | Suggested change |
|---|---|---|---|---|---|
| 1 | **High** | Workflow | `web/wizard.js:1090-1091`, `web/wizard.html:313-316` | "Start from someone else's map" — one of three locked first-run offers — is not on the screen a new account lands on; `#home-empty` is only reachable by starting the questions and abandoning them | Add a third `.wz-link` on `#screen-intro` wired to the existing `openPicker()`; delete `#home-empty` |
| 2 | **High** | Spacing | `engine/theme.css:80-93` | Top-nav links are **12px** tall on a phone — the coarse-pointer floor selects `button`, never `a` | Add `.tm-chrome .toplinks a { padding: 16px 0 }` and the other link/summary rows in §3.2 |
| 3 | **High** | Copy | `web/wizard.js:373` vs `web/wizard.html:378-437` | The glosses were removed from the tier/confidence controls on the stated grounds that the launchpad explains both scales; the launchpad explains neither | Add the one-line legend to `.wz-tier`; add `TIER_GLOSS` as radio `title`s |
| 4 | **High** | Workflow | `web/wizard.html:335-376`, `:156-160` | The question screen puts "Ignore" and "I don't know" above the answers, and gives "I don't know" the primary ink fill | Move `#positions`/`#custom-answer` above the two tiles; give `#open-answer` the `.wz-card` surface |
| 5 | **High** | Spacing | `web/wizard.html:152-154` | "Read more" (44px on touch) overlaps the *Outside the historic creeds* note on the 3 doctrines that carry one, `god.trinity` (T1, asked first) among them | Add `padding-right: 88px` to `.wz-outside` and `.wz-outside-note` |
| 6 | Medium | Spacing | `web/admin.html:39-59` | No `<main>` / `.tm-main`, so `/admin` has an 8px UA gutter and no width cap while every other page has 28px and 1200px | Wrap the four blocks in `<main class="tm-main">` |
| 7 | Medium | Copy | `engine/editor.html:568-570`, `:630-666` | The hosted empty-map copy tells the person to press "+ New node", which does not render until a domain exists | "…or start here with \"+ New area\"." |
| 8 | Medium | Copy | `engine/editor.html:252,324,618,653,663,717,787,877` | Seven user-facing uses of *node* / *domain*, against `phase-3-design.md` §2.2's locked *belief* / *area*; both words appear 30px apart in the sidebar | Table in §2.5 |
| 9 | Medium | Spacing | `engine/render.py:497-504` | The generated map — the surface most people read on a phone — has no control at 44px: view switcher 30.5px, reference pills 32.5px, Filters 28px | Add a `min-height: 44px` line to the existing coarse block (moves the output hashes — restyle rules apply) |
| 10 | Medium | Spacing | `engine/theme.css:123-125` + 4 sites | `minmax(300px, 1fr)` overflows by 36px at a 320px viewport; the comment claiming otherwise checks only 360px | `minmax(min(300px, 100%), 1fr)` |
| 11 | Medium | Workflow | `web/view.html:89` | "Make my own map" is shown unconditionally, including to a member reading their own map | Hide for the owner; relabel to "Compare with mine" for a signed-in visitor |
| 12 | Medium | Copy | 5 sites, §2.1 | "Nothing is filled in for you" is stated five times across four screens; two are the same sentence about the same control | Keep the lens-screen statement; cut `wizard.html:395`, `:403`'s second sentence, `:362`'s second clause |
| 13 | Medium | Workflow | `web/wizard.js:284,1047` | "I'd rather not say" is stored as `''`, which is falsy, so the lens screen re-asks a question the person already answered | Store a sentinel, or gate on `getItem(...) !== null` |
| 14 | Medium | Spacing | `engine/theme.css:110-114`, `web/view.html:13` | The comment justifying the missing `margin` is stale; the resulting 8px UA body margin costs `/view` a permanent 16px scroll | `body.tm-page { margin: 0; … }`; delete the comment |
| 15 | Medium | Workflow | `engine/render.py:581` | The generated map's "Edit ✎" link ships into `/view` and the tradition maps, inviting a visitor to edit someone else's map from inside a sandboxed frame where it cannot work | Remove the link when framed |
| 16 | Medium | Spacing | `engine/editor.html:55,64,102,121` | Editor buttons, tabs and map-tile radios border with `--line` (1.36:1) against the project's own rule that interactive boundaries take `--field-line` (3.68:1) | Swap the token in four rules |
| 17 | Low | Workflow | `web/wizard.html:329`, `web/wizard.js:1049` | The lens screen's **Done** press carries no information; the choice is single-select and changeable from a persistent header control | Advance on card click; delete `#lens-next` |
| 18 | Low | Workflow | `web/landing.html:59,117` | The new-account tile lands on `#signin`, above the *Sign in* form; a first-timer scrolls past it to create an account | Point the tile at `#signup-form` |
| 19 | Low | Copy | `web/landing.html:61-62` vs `:94` | "A name and a short PIN" appears twice on one page, one scroll apart | Rewrite the tile body (§2.3) |
| 20 | Low | Spacing | `web/compare.html:10-12`, `:27` | No `[hidden] { display:none !important }` guard, and `#cmp-closest` has the exact `display`-on-an-ID shape `debug.md` §Q documents — latent today, and the leak would be a closest-tradition line on a person-to-person compare | Add the one-line guard |
| 21 | Low | Spacing | `web/wizard.html:240` | `#home-areas` is a stale selector: it now styles the stat numeral, and the real areas list gets no `gap` | Rename to `#home-areas-list` |
| 22 | Low | Spacing | `web/learn.html:18-19` | `main.tm-page` matches nothing (`tm-page` is on `<body>`), so `/learn`'s intended 900px cap never applies | `body.tm-page main { max-width: 900px }` |
| 23 | Low | Spacing | 4 files, §3.7 | Prose capped at 58ch / 62ch / 68ch / 72ch against `phase-3-design.md` §3's single stated 58ch | Pick one; amend the design doc if it is not 58 |
| 24 | Low | Spacing | `web/wizard.html:51`, `:399`, `:420`, `:432` | One flat 14px gap between every launchpad block, patched with three inline `margin-bottom`s | 26px between blocks; delete the inline styles |
| 25 | Low | Copy | `web/gallery.html:131` | A signed-in member with an unlisted or empty map is told to "Sign up free" | Branch the card copy on `user` |
| 26 | Low | Copy | `web/compare.html:120`, `web/wizard.html:347`, `:352`, `engine/editor.html:733` | Four instructions for something the control beside them already says | Replacements in §2.6 |
| 27 | Low | Spacing | `engine/render.py:347` vs `:415` | `main` is left-aligned at 1080px while `.pagefoot` centres at 1080px — a 420px offset on a wide window | `margin-inline: auto` on `main` |
| 28 | Low | Copy | `engine/editor.html:280-282` | The conflict dialog's body opens with a parenthetical fragment | "Another tab or window saved over it. Your unsaved changes are still here." |
| 29 | Low | Copy | `web/wizard.js:129-132` | The new-tab notice repeats in every position's Read-more popover as well as the doctrine's — **the sentence itself is a locked condition and must stay** | Show it on the doctrine-level explainer only |
| 30 | Low | Spacing | `web/wizard.html:27` vs `engine/theme.css:88` | The wizard's two headers use different insets, so the brand block shifts 4px left and 8px up on every entry to a question | Match `#wz-header`'s padding to `.tm-chrome`'s |
| 31 | Low | Copy | `web/wizard.html:311` | `<span id="intro-count">99</span>` is the old node count; the corpus has 86. Overwritten by JS before display, so never seen — but wrong in the file | `86` |
| 32 | Info | Copy | `web/compare.js:7` vs `web/landing.html`, `web/history.html` | Second person on `/` and `/history`, first person everywhere else. May be deliberate | Needs Thomas; then one line in `phase-3-design.md` |

**If only five things get done:** 1, 2, 3, 4, 5. The first four are the difference
between a stranger finishing the wizard and abandoning it; the fifth is a visible
defect on the first T1 question in the product.
