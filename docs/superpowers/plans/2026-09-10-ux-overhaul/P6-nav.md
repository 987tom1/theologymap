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
