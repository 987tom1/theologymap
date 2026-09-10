# P6 — The nav (D6)

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply to every task here.

**Spec:** spec §5 D6 and §7 P6 — **read D6 in detail; it is the argument for reversing a
documented decision and the executor needs it, not a summary.**
**Detail:** `documentation/ux-firstprinciples-constrained.md` F2 (`:265-350`).

**Goal:** "My map" is **one tap from every screen including mid-question**. Today it is three
taps plus a ~1,100px scroll, or four from inside a question.

**Model:** Sonnet with spec §5 D6 quoted verbatim — **but the decision reversal itself is
already made.** Do not re-argue it and do not ask a subagent to evaluate it.
**Depends on:** P3 (so the new nav ships with its active state) and P4 (so the header morph
is already in place). **Blocks:** P7.

---

## This phase reverses a documented decision. That is licensed and it is spec §5 D6.

CLAUDE.md §10 already records the reversal as Thomas's decision. The three counts against the
old reasoning are in D6; the short form:

1. **The premise is already false in this codebase's own CSS.** `theme.css:142-144` makes
   `.toplinks` `overflow-x: auto; white-space: nowrap` below 640px — the nav already scrolls
   horizontally, which is the concession you make when items do *not* fit. The real choice
   made was *which* items go off-screen, and it favoured **Sign out** and **Admin** over
   **My map**.
2. **The budget is spent on cold paths.** Sign out is monthly, Admin is one account, and
   Home's only job for a signed-in user is to be a menu of the items evicted from the nav.
   Three of six slots hold navigation-to-navigation.
3. **The stated alternative route does not exist from where the user is.**
   `wizard.js:269` hides the chrome entirely on the question screen — the screen a person
   spends 86 turns on.

**New nav:** `My map · Questions · Learn · Browse · ⋯` — **four visible items, fewer than
today.** Signed out: `Learn · Browse · Sign in`. `⋯` is a native `popover` holding Edit,
History, Compare, Listing status, Admin, Sign out — anchor-positioned, light-dismiss, Escape
and focus management from the platform, **zero JS**, with an `@supports not
(position-anchor: --x)` page-corner fallback for Firefox.

## Tasks

1. **The nav list itself** — `web/chrome.js` and **the hand-kept copy in
   `engine/editor.html:541-547`**, in the same commit.
2. **The `⋯` popover** — markup in `chrome.js`, styles in `engine/theme.css`. F2 gives both
   verbatim; snap its pixel values to P2's `--r*` and `--s*` scales.
3. **`wizard.js` stops hiding the chrome** — `:262-272`, `:291-301` in `wizard.html`. The
   wizard's own header keeps the crumb, tradition control and "Finish here" and sits **below**
   the chrome rather than replacing it. **That also removes the height-swap jolt**, which is
   half of the "going in and out of a question" complaint.
4. **`aria-current="page"`** — design §5 small win 3. Four lines, and it is what tells you
   where you are in a nav that now has an overflow.

## The invariants — quote every one of these

> The nav list in `chrome.js` vs `editor.html` — **Permanent lockstep, by hand.** The
> documented `file://` exception. **Any nav change is two edits.**
> This one is **three**: `chrome.js`, `theme.css`, `editor.html`.

> **`chrome.js` used to set `flexWrap` inline, and an inline style beats a media query, so
> that rule was dead from the day it was written. Do not put the wrap styles back on the
> element.**

> **`/view` must not redirect an owner on a 404.** The "My map" test is gated on `res.ok` on
> purpose: `/api/render` 404s an **unlisted** map as well as a missing one, so redirecting on
> any 404 bounces an owner who just unlisted their own map back to the wizard every time.

**"My map" points at `/view?name=<name>` exactly as the tile does today — do not change that
logic**, including the empty-map redirect and the unlisted-map message
(`view.html:234-240`). Copy the href construction; do not reimplement it.

> **Unlist, never Hide.** (Listing status moves into the overflow menu. Its copy does not
> change.)

> **Every visible string in `editor.html`'s markup is the `file://` tool's wording.** Anything
> hosted-specific belongs in the `if (HOSTED)` branch, not in the HTML.

**`/` keeps every tile it has.** Tiles and nav items are not rivals: tiles are the
discoverable surface for a first visit, the nav is the return path for visit forty. **This
phase adds nothing to `/` and removes nothing from it.**

## Accessibility — the popover is the reason this is cheap, and the reason it can go wrong

Light dismiss, Escape and focus management come from the platform **only if it is a real
`popover` attribute**. If you find yourself writing a click-outside handler or a focus trap,
stop — you have hand-rolled what the platform does, and that is the thing this design chose
against.

## Acceptance criteria

- [ ] **"My map" is one tap from every screen, including mid-question.** Walk it: `/`,
      `/gallery`, `/learn`, `/compare`, `/history`, `/edit`, and **the question screen at
      question 40**.
- [ ] The signed-out nav is `Learn · Browse · Sign in`, and nothing in it 404s or bounces.
- [ ] `⋯` opens, light-dismisses on an outside tap, closes on Escape, and returns focus to
      its button. **In Firefox** (no anchor positioning today) it lands in the page corner
      via the `@supports` fallback rather than somewhere unreachable.
- [ ] **The wizard chrome no longer disappears on the question screen**, and the header does
      not change height when you enter or leave a question. That height swap is half of the
      original complaint.
- [ ] `aria-current="page"` marks the right item on every page.
- [ ] **`/edit` opened on a real map** and its nav matches `chrome.js`'s, item for item.
      This is the lockstep and it is verified by looking, because nothing checks it.
- [ ] **360px** — four items plus `⋯` fit or scroll cleanly; the popover does not overflow the
      viewport. **820px** — the nav is above the 640px breakpoint here, so the phone rules are
      **off**; check it separately. **1440px** — the popover anchors to the button, not to a
      1200px-capped container's edge.
- [ ] Both themes, reduced-motion on.
- [ ] `git diff -U0 main -- engine/map-view.js | grep '^@@'` returns nothing.

---

# Step detail — expanded 2026-09-11, session B

Re-read against the tree at `a9e99f0`, post-P1/P2/P3 **and post-P4**. Locate targets by
selector or function name.

**Current line numbers, verified:** `chrome.js`'s nav build `web/chrome.js:53-72` (inside
`mount()`); the hand-kept copy `engine/editor.html:634-656` (the `if (HOSTED)` branch, **not**
`:541-547` — it has moved); the nav markup stub `engine/editor.html:302-304`; `showScreen`
`web/wizard.js:253-263`; `#wz-header` markup `web/wizard.html:285-296`, its rule `:21-32`;
`theme.css`'s chrome rules `:215-238`, the 640px `.toplinks` scroll block `:235-237`, the
coarse-pointer `.tm-chrome .toplinks a { padding: 16px 0 }` `:208`.

**Today's nav is `Home · Questions · Edit · Browse · [Admin] · Sign out`** — note that
"Learn", "History" and "Compare" are not in it at all, and neither is "My map". The phase
file's list is the target, not a diff of today's.

## The decision is made. Do not re-argue it.

Spec §5 D6 and CLAUDE.md §10 record the reversal as Thomas's decision. It is quoted in the
phase body above. **Do not evaluate it, do not ask whether it is right, do not propose a
compromise nav.** `/` keeps every tile it has — this phase adds nothing to `/` and removes
nothing from it.

## Cascade derivation for this phase

`theme.css` loads **before** every `web/*.html` page's own `<style>` and **after**
`engine/editor.html`'s (`editor.html:289`). Two consequences that decide where P6's CSS goes:

| New rule | Rival | Which wins, and why |
|---|---|---|
| `.toplinks a[aria-current]` — specificity **(0,2,1)** | `theme.css:222` `.tm-chrome .toplinks a` — also **(0,2,1)**; `editor.html:117` `.toplinks a` — **(0,1,1)** | Ties with the `theme.css` rule, so it **must be declared after `:222`, in the same file** — then it wins on source order. It beats `editor.html`'s local rule outright on specificity. **Do not** write it as `.tm-chrome .toplinks a[aria-current]`: that is (0,3,1) and would not apply in the editor at all, whose header has no `.tm-chrome`. One selector, both surfaces. |
| the `⋯` button and popover — `.tm-morebtn`, `.tm-more` | none; new class names | Uncontested. **Scope them on their own classes with no `.tm-chrome` ancestor**, precisely so the same rules serve `web/`'s `.tm-chrome .toplinks` and the editor's bare `.toplinks`. A `.tm-chrome`-scoped rule would leave the editor's popover unstyled. |
| `.tm-morebtn` needs its own type/colour | `editor.html:117` styles `.toplinks a`, not `button` | The `⋯` is a `<button>`, so it inherits none of the link styling on either surface. Give it the full font/colour/padding in `theme.css`. |

Nothing in P6 depends on a `theme.css` rule beating a `web/` page on presence.

## Task 1 — The nav list itself (`chrome.js` **and** `editor.html`, same commit)

- [ ] **`web/chrome.js`**, in `mount()`. Signed in:
      `My map` → `'/view?name=' + encodeURIComponent(user.name)`,
      `Questions` → `/wizard`, `Learn` → `/learn`, `Browse` → `/gallery`, then the `⋯` button
      (Task 2). Signed out: `Learn` → `/learn`, `Browse` → `/gallery`,
      `Sign in` → `/#signin`. Nothing else.
- [ ] **Copy the "My map" href construction from `web/landing.html:148`, do not reimplement
      it.** It is `'/view?name=' + encodeURIComponent(user.name)` and that is all — the
      empty-map redirect and the unlisted-map message live in `web/view.html:221-241` and stay
      exactly where they are. **`/view` must not redirect an owner on a 404:** the "My map"
      test is gated on `res.ok` on purpose, because `/api/render` 404s an *unlisted* map as well
      as a missing one. **Read that comment block before touching anything near it, and change
      nothing in it.**
- [ ] **`engine/editor.html`**, the `if (HOSTED)` branch. Repurpose `#editorMapLink` (today
      rewritten to `Home`) to **`My map`** → `'/view?name=' + encodeURIComponent(me.name)`,
      still dropping `target`/`rel`. Then `navLink('/wizard', 'Questions')`,
      `navLink('/learn', 'Learn')`, `navLink('/gallery', 'Browse')`, then the `⋯` popover
      (Task 2). Delete the `Admin` and `Sign out` top-level links — they move into the overflow.
      Guard on `me` being present, as the current code does.
- [ ] Update the stale comment at `editor.html:633-636` ("'My map' is not a nav item any more —
      it is a tile on the home page") — it now states the reversed decision. Keep the *reason*
      the copy is a copy: **the offline tool must load from `file://` with no network, so
      `editor.html` cannot import `chrome.js`.** That is the documented `file://` exception, not
      drift.
- [ ] **Every visible string in `editor.html`'s markup is the `file://` tool's wording.**
      Everything this task adds is hosted-specific and belongs **inside the `if (HOSTED)`
      branch**, never in the HTML. The `#editorMapLink` stub in the markup keeps its
      `Open the map ↗` text for the offline tool.
- [ ] **Any nav change is two edits — this one is three** (`chrome.js`, `theme.css`,
      `editor.html`) and they land in the same commit. Nothing checks that the two lists agree;
      it is verified by looking.
- [ ] **`chrome.js` used to set `flexWrap` inline, and an inline style beats a media query, so
      that rule was dead from the day it was written. Do not put the wrap styles back on the
      element.** No inline styles on the nav, at all.
- [ ] Standing gate. Own commit, both files together.

## Task 2 — The `⋯` popover (markup in the two JS/HTML builders, styles in `theme.css`)

- [ ] Markup, built identically in `web/chrome.js`'s `mount()` and `engine/editor.html`'s
      `if (HOSTED)` branch:
      `<button popovertarget="tm-more" id="tm-more-btn" class="tm-morebtn" aria-label="More">⋯</button>`
      and a sibling `<div popover id="tm-more" class="tm-more">…</div>` holding, in this order:
      **Edit** → `/edit`, **History** → `/history`, **Compare** → `/compare`,
      **Listing status** → `/#vis-row`, **Admin** → `/admin` (only when `user.is_admin`),
      **Sign out** (the existing `clearUser()` handler).
- [ ] **Ruling on "Listing status".** It is not a page — it is a `<button>` built into `/` by
      `web/landing.html:158-172`, rendered under the grid in a `<p class="tm-quiet"
      id="vis-row">`. The overflow item therefore links to `/#vis-row`, where the control
      already lives. That element already carries the id; **add nothing to `/`.**
      Its copy does not change: **Unlist, never Hide.** `is_public` controls listing, not
      secrecy, and the wording must not imply otherwise.
- [ ] **Ruling on "Home".** D6's list has no Home item, on its own count 3 ("Home's only job
      for a signed-in user is to be a menu of the items evicted from the nav"). `/#vis-row` is
      therefore the only route back to `/` from the nav, and `/` is still reachable that way,
      from the browser's own controls, and from `/`-hosted links. This is faithful to the spec.
      **Flag it in the commit message for Thomas to accept or reject in his pass** — do not
      invent a wordmark-is-home link to cover it.
- [ ] Styles, in **`engine/theme.css`**, F2's block verbatim except its pixel values snapped to
      P2's scales: `border-radius: var(--r3)` for `9px`, `padding: var(--s1)` for `6px`,
      `margin: var(--s2) 0 0` for the `6px` offset, and `box-shadow: var(--e3)` — the floating-layer step, tinted off `--ink` — instead of the
      raw `0 8px 24px rgb(0 0 0 / .18)` — **a neutral raw-black shadow on a warm cream page is
      the SaaS-card tell, and P3 already tokenised the two that existed.** `min-width: 180px`
      stays numeric (it is a measure, not a spacing step).
- [ ] The `@supports not (position-anchor: --x)` page-corner fallback is **required**, not
      optional — Firefox has no anchor positioning today and without it the popover lands
      somewhere unreachable. Ship both branches.
- [ ] **Light dismiss, Escape and focus management come from the platform only if it is a real
      `popover` attribute. If you find yourself writing a click-outside handler or a focus
      trap, stop — you have hand-rolled what the platform does, and that is the thing this
      design chose against.** Zero JS beyond the `Sign out` click handler that already exists.
- [ ] Coarse-pointer floor: `theme.css:203`'s `@media (pointer: coarse)` block already gives
      `button { min-height: 44px }`, which covers `.tm-morebtn`. The **links inside the
      popover** are not covered by `.tm-chrome .toplinks a`'s `padding: 16px 0` — add
      `.tm-more a { padding: … }` to that coarse block so every item is ≥44px. Derive it, do
      not assume the existing rule reaches them.
- [ ] Standing gate. Own commit.

## Task 3 — `wizard.js` stops hiding the chrome

- [ ] `web/wizard.js`, `showScreen`: delete `if (chromeEl) chromeEl.hidden = q;` (`:260`). P4
      Task 3 deliberately left it. Deleting it is also what removes P4's chrome-fade artifact.
- [ ] `chromeEl` is then only assigned and never read (`:74`, `:1074`). **Delete the variable
      and its assignment too** — a dead `querySelector` on a header is a bug in waiting.
- [ ] `web/wizard.html:285-296`: `#wz-header` sits **below** `<div id="tmChrome">` already, so
      the ordering is right. But it duplicates the chrome exactly — `mount('Build a map')`
      (`wizard.js:1073`) puts the same `Theology Map` kicker and `Build a map` h1 in
      `.tm-chrome`. **Delete `#wz-brand`'s `.kicker` and `h1`, keep `#wz-crumb`.** F2: the
      wizard's own header keeps *the crumb, the tradition control and "Finish here"* and nothing
      else. Drop the now-unused `#wz-brand .kicker` / `#wz-brand h1` rules (`wizard.html:31-33`).
- [ ] `#wz-crumb`'s `view-transition-name: q-crumb` (P4 Task 3) stays. `.tm-chrome`'s
      `view-transition-name: tm-chrome` now Holds across a screen change instead of fading,
      which is the whole point.
- [ ] **Honest note on the height-swap criterion.** `.tm-chrome` no longer changes at all — that
      is the half of complaint (2) this fixes. `#wz-header` is still `hidden` off the question
      screen, so a thin crumb bar still appears and disappears. That is F2's design as written
      (the wizard header *exists* only on the question screen); it is not a leftover. Record it
      in the commit message and let Thomas judge the residue in his pass.
- [ ] Standing gate, `node --test tests/*.test.js` included. Own commit.

## Task 4 — `aria-current="page"`

- [ ] `web/chrome.js`: after building each link, set `aria-current="page"` when its href's path
      matches `location.pathname`. Compare **paths only** — `My map`'s href carries a query
      string and `Sign in`'s a fragment, and a raw string compare marks nothing.
- [ ] `engine/editor.html`'s `navLink` helper: the same one line, so the two lists stay in
      lockstep on behaviour as well as content.
- [ ] `engine/theme.css`, **declared after `:222`'s `.tm-chrome .toplinks a`** (they tie at
      (0,2,1); order decides — see the derivation table):
      `.toplinks a[aria-current] { color: var(--ink); border-bottom-color: var(--ink); }`
      One selector, unprefixed, so it applies on `web/` pages *and* in the editor.
- [ ] `theme.css:222` sets `border-bottom: 1px solid transparent` on every nav link, so only
      the colour needs overriding — no layout shift when the marker moves. Confirm that before
      writing a `border-bottom` shorthand.
- [ ] `/edit` marks its own `Edit` item inside the popover. That is correct, not a bug.
- [ ] Standing gate. Own commit.

## Verification to batch for Thomas

Widths **360 / 820 / 1440**, both themes, one reduced-motion pass.

1. **"My map" in one tap** from `/`, `/gallery`, `/learn`, `/compare`, `/history`, `/edit`, and
   **the question screen at question 40**. Then unlist the map and click "My map" again — it
   must show the unlisted message, **not** bounce to `/wizard`.
2. **Signed out** — the nav is `Learn · Browse · Sign in` and nothing in it 404s or bounces.
3. **The `⋯` popover** — opens; light-dismisses on an outside tap; Escape closes it and focus
   returns to the button. **In Firefox** it must land in the page corner via the `@supports`
   fallback, not somewhere unreachable. At **1440px** it anchors to the button, not to the
   1200px-capped container's edge. At **360px** it must not overflow the viewport.
4. **`/edit` on a real map** — its nav matches `chrome.js`'s **item for item**. This is the
   lockstep and nothing checks it.
5. **Entering and leaving a question** — the chrome no longer disappears, and `.tm-chrome` does
   not change height. Judge the residual `#wz-header` crumb bar (see Task 3's note).
6. **`aria-current`** marks the right item on `/`, `/wizard`, `/learn`, `/gallery`, `/compare`,
   `/history`, `/edit`, `/admin`.
7. **360px vs 820px separately** — 820px is *above* the 640px breakpoint, so the horizontal
   scroll rules are **off** there. Four items plus `⋯` must fit or scroll cleanly at 360px.
