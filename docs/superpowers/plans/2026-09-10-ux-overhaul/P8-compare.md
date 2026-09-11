# P8 — Compare

> **Read [`00-index.md`](00-index.md) first.** Global Constraints apply to every task here.

**Spec:** spec §7 P8. **Detail:** `documentation/ux-firstprinciples-constrained.md` F5
(`:415-448`).

**Goal:** Compare's picker does `location.href` **to itself** and re-downloads the corpus (16
files), the user's map and all twelve tradition maps (~475KB) with **no loading state at all**
— while `/gallery` next door does skeletons correctly. A tap that produces nothing for
several seconds reads as a broken tap, which is why people tap twice.

**Model:** Sonnet, spec section quoted. **Depends on:** P7. **Blocks:** P11.

---

## Three independently shippable steps, in this order

1. **Skeleton.** `main()` at `compare.js:483` mounts the header then awaits everything before
   painting anything — a bare header over an empty body for the whole time. Copy
   `gallery.html:143-150`'s three-card pattern: skeleton, `aria-busy`, **cleared on both
   success and failure.** `/wizard` has the same hole (`wizard.js:1075-1087`) — fix both.
   **Same register as the gallery.** This is the house style and phase 2 wrote down the reason:
   a skeleton shows the *shape* of what is coming; a spinner does not.
2. **`pushState`.** `compare.js:368` and `:388` reload the page to change one query param.
   Picker → results becomes an in-page screen swap plus `history.pushState`, with a `popstate`
   handler re-running the branch `main()` already has. **This step needs care.**
3. **Lazy tradition maps.** The scorecard is the only consumer of the eleven non-target maps
   and it sits below the closest-tradition line and the tier list. An `IntersectionObserver`
   on `#cmp-scorecard`, or a "Show the all-traditions scorecard" button, defers ~430KB
   entirely. CLAUDE.md already names this as the next performance move.

## The constraint on step 2 — quote it

**`?tradition=` and `?name=` must stay bookmarkable and unchanged.** Only the *internal*
transition stops reloading. A bookmarked `/compare?tradition=lutheran` must still land
directly on results, and Back from results must return to the picker rather than leaving the
page.

Also `?doctrine=` — `compare.js:129` links out to `/wizard?doctrine=`, and P1 Task 1 made
`/learn` do the same. Those inbound and outbound links are contracts.

## Invariants — quote all of these, this is the ethics-bearing surface

> **Compare is descriptive, never evaluative.** "Closest tradition" is said of **traditions
> only** and always with its denominator. There is deliberately **no person-vs-person
> scorecard, no score attached to a named person, and no leaderboard**, and no comparison is
> notified, logged or counted anywhere. … **A later session will find the missing
> people-vs-people scorecard and read it as an obvious symmetry to add. It is not. Do not add
> it.** Person-to-person gets the per-doctrine diff only.

> **Tier comparison is a separate question from the diff.** … **The baseline is the corpus
> suggestion, never an average over other members' maps.**

> **`closestTradition` flags *every* tied row** and does not return `denominatorNote`. Ties
> compare on one scale (`score`, within an epsilon), never a raw-count tolerance, and every
> row carries its own `numerator`/`denominator` for the caller to build the sentence.

> **`web/corpus.js` is the one browser-side corpus loader.** A fourth page fetching
> `content/wizard/*.json` itself is the duplication this file exists to prevent. **Step 3
> defers loads; it does not add a second loader.**

> **`apiFetch()` is the wrong tool for `/api/render`**, which replies `text/html`. **The Error
> `apiFetch` throws carries `.code` and `.status`** — a caller that must branch on *why* a
> call failed matches on the code, never the message.

Step 3 changes *when* tradition maps load. **It must not change what the scorecard says.**
`tests/compare-core.test.js` pins `normalise` and the tie handling; run it and mean it.

## The verification debug.md rule 22 demands

> **A number the UI says out loud needs an assertion on realistic input, not just a passing
> unit suite.** §AD shipped a confidently wrong answer past sixteen green assertions, because
> none built a small map and read the resulting sentence. **Build the smallest real case and
> print what the person would actually see.**

Before and after step 3, run the same real map through compare and **diff the rendered
sentences**, not the internals. `compare-core.js` is UMD and runs from plain `node` with no
browser or login (`WG.loadCorpusSync('content/wizard')`) — debug.md rule 21.

## Acceptance criteria

- [ ] **No tap produces a blank screen.** `/compare` and `/wizard` both show a skeleton in the
      gallery's register while the corpus loads, cleared on **both** success and failure.
- [ ] Picker → results no longer reloads the page.
- [ ] `/compare?tradition=<id>`, `?name=<name>` and `?doctrine=<id>` all still land directly,
      from a cold URL paste and from a bookmark.
- [ ] Back from results returns to the picker. Back again leaves the page. Forward works.
- [ ] The scorecard's numbers and sentences are **identical** before and after step 3, on a
      real map. Show the two outputs.
- [ ] Bytes transferred on first paint are measurably down. Put the before/after in the commit
      message.
- [ ] `node --test tests/*.test.js` green, `compare-core.test.js` especially.
- [ ] **360px / 820px / 1440px, both themes, reduced-motion on.** The skeleton must not loop
      under reduced motion — `gallery.html:20`'s pulse is already guarded; match it.
- [ ] `git diff -U0 main -- engine/map-view.js | grep '^@@'` returns nothing.

---

# Step detail — expanded 2026-09-11, session C

> Expanded after P7's step detail and before P7 executed. Line references were read on the
> tree at `bc9014b`; P7 does not touch `web/compare.js` or `web/wizard.js`, and touches
> `web/compare.html` and `web/wizard.html` in their `<style>` blocks only, so these
> references survive P7. **Re-read before editing anyway.**

## What is actually there, verified

| Fact | Where |
|---|---|
| `main()` mounts the header, then `await loadCorpus()`, then `await loadTraditionManifest()`, then branches to `renderPicker` or `renderResults`. Nothing paints in between. | `compare.js:470-497` |
| The picker's two card builders navigate with `location.href` | `compare.js:363` (tradition), `compare.js:383` (member) |
| "Change comparison" also navigates with `location.href = '/compare'` | `compare.js:477` |
| `renderResults` eagerly `Promise.all`s **every** tradition map, inside `if (isTradition)`, before rendering the closest line **or** the scorecard | `compare.js:429-448` |
| The scorecard host is `#cmp-scorecard`, hidden for the member branch | `compare.js:426` |
| The gallery's skeleton pattern: three `div.tm-card.tm-skel` with four `<span>`, `aria-hidden`, `aria-busy="true"` on the host, cleared on **both** success and failure | `gallery.html:138-166` |
| `.tm-skel`'s pulse is already `@media (prefers-reduced-motion: no-preference)`-guarded | `gallery.html:20-23` |
| `/wizard` has the same hole: `mount('Build a map')`, then `await loadCorpus()`, then `await apiFetch('/api/map')`, and `showScreen` is not reached until `:1247` | `wizard.js:1183-1247` |
| `showScreen`'s one-shot `painted` flag exists so the first screen does not animate in | `wizard.js:75-81`, `:258-275` |
| `compare-core.js` is UMD and runs from plain `node` with `WG.loadCorpusSync('content/wizard')` | debug.md rule 21 |

## Invariants — quoted into every P8 task, without exception

> **Compare is descriptive, never evaluative.** "Closest tradition" is said of **traditions
> only** and always with its denominator. There is deliberately **no person-vs-person
> scorecard, no score attached to a named person, and no leaderboard**, and no comparison is
> notified, logged or counted anywhere. **A later session will find the missing
> people-vs-people scorecard and read it as an obvious symmetry to add. It is not. Do not add
> it.** Person-to-person gets the per-doctrine diff only.

> **Tier comparison is a separate question from the diff.** `CompareCore.tierDiff` reports
> where a person's `tier` departs from the corpus `suggested_tier`. **The baseline is the
> corpus suggestion, never an average over other members' maps.**

> **`closestTradition` flags *every* tied row** and does not return `denominatorNote`. Ties
> compare on one scale (`score`, within an epsilon), never a raw-count tolerance, and every
> row carries its own `numerator`/`denominator` for the caller to build the sentence.

> **`normalise` strips exactly four things** — lowercase, collapse whitespace, one trailing
> full stop, one layer of surrounding quotes — and nothing else.

> **`web/corpus.js` is the one browser-side corpus loader.** A fourth page fetching
> `content/wizard/*.json` itself is the duplication that file exists to prevent. **Step 3
> defers loads; it does not add a second loader.**

> **`apiFetch()` is the wrong tool for `/api/render`**, which replies `text/html`. **The Error
> `apiFetch` throws carries `.code` and `.status`** — a caller that must branch on *why* a
> call failed matches on the code, never the message.

> **`?tradition=`, `?name=` and `?doctrine=` are contracts.** `compare.js:129` links out to
> `/wizard?doctrine=`, and P1 Task 1 made `/learn` do the same. A bookmarked
> `/compare?tradition=lutheran` must still land directly on results.

---

## Task 1 — the skeleton · Sonnet · one commit

**Files:** `web/compare.html`, `web/compare.js`, `web/wizard.html`, `web/wizard.js`.

- [ ] **Lift the gallery's skeleton into `engine/theme.css`? No.** `.tm-skel` is four rules in
      `gallery.html` and P7 has just closed that file. **Ruling: copy the four rules into
      `compare.html`'s and `wizard.html`'s `<style>` blocks as-is** rather than opening
      `theme.css` for a third consumer inside P8 — and **report the three-way duplication as a
      finding for P11**, which owns cleanup. (If the reviewer disagrees, promoting `.tm-skel`
      to `theme.css` is a clean follow-up commit; it is not worth blocking P8 on.)
- [ ] **`/compare`.** Before the first `await` in `main()`, paint three
      `div.tm-card.tm-skel` into `#picker-traditions` (the first thing a cold `/compare`
      shows) and set `aria-busy="true"` on it. Clear both on success **and** in a `catch` /
      early-return path — **`loadCorpus()` returning falsy and `loadTraditionManifest()`
      returning falsy are both early returns today (`:486`, `:488`) and both must clear the
      skeleton first.** Never leave a skeleton pretending to load.
- [ ] The results branch needs its own: when the URL carries `?tradition=` or `?name=`, the
      skeleton belongs where results will land, not in the picker. Paint it into
      `#screen-results`'s first content host and clear it in `renderResults`. Decide this from
      the params **before** the first `await`, since that is the whole point.
- [ ] **`/wizard`.** Same, into the screen that `main()` eventually shows. `wizard.js:1183`
      mounts the chrome, then awaits the corpus and the map. Paint a skeleton immediately
      after `mount(…)`; clear it before the first `showScreen(…)`, and on both early returns
      (`if (!corpus) return`, `if (!map) return`). **Do not touch `showScreen`'s one-shot
      `painted` flag** — clearing a skeleton is not a screen change and must not consume it.
- [ ] **Reduced motion.** Copy `gallery.html:20-23`'s guard verbatim. The pulse must not loop
      under `prefers-reduced-motion: reduce`. Nothing else in P8 animates.
- [ ] **Nothing in the wizard's render path may be deferred past the render** (CLAUDE.md §7).
      The skeleton is painted *before* the awaits and cleared *before* the first render; it is
      not queued behind a frame.
- [ ] Gate: `node --test tests/*.test.js`, `py tests/syntax_check.py`, and the rest of the
      standing gate.

## Task 2 — `pushState` · Sonnet · one commit · **this is the step that needs care**

**Files:** `web/compare.js` only.

- [ ] Extract the branch `main()` already has into a `route(params)` function: read
      `tradition`, `name`, `doctrine` from a `URLSearchParams`, then call `renderPicker` or
      `renderResults`. `main()` becomes "load the shared data once, then `route(new
      URLSearchParams(location.search))`".
- [ ] The three `location.href` sites become `history.pushState` + `route(…)`:
      - `:363` tradition card → `pushState(null, '', '/compare?tradition=' + encodeURIComponent(t.id))`
      - `:383` member card → `pushState(null, '', '/compare?name=' + encodeURIComponent(m.name))`
      - `:477` "Change comparison" → `pushState(null, '', '/compare')`
- [ ] `window.addEventListener('popstate', …)` re-runs `route(new
      URLSearchParams(location.search))`. **`popstate` does not fire for the `pushState` that
      created the entry**, so the handler must not be the only place `route` is called.
- [ ] **The acceptance criteria in order, each one a real check:**
      - `/compare?tradition=<id>` pasted cold lands directly on results.
      - `/compare?name=<name>` pasted cold lands directly on results.
      - `/compare?doctrine=<id>` still opens and scrolls that row (`:462-466`).
      - Picker → results does **not** reload.
      - **Back from results returns to the picker. Back again leaves the page. Forward works.**
        That means exactly one `pushState` per transition and no `replaceState` on load.
- [ ] `renderResults` currently leaves `changeBtn.hidden = false` and each render appends into
      hosts it first clears (`tHost.textContent = ''`, `mHost.textContent = ''`). **Re-entering
      `renderResults` or `renderPicker` a second time in the same document must be idempotent
      — audit every host it writes to, including `#cmp-closest`, `#sc-table-host`,
      `#sc-accordion-host`, `#cmp-tiers` and `#diff-groups`, and make sure each is cleared
      before it is filled.** A page that only ever ran once per document has never been
      tested for this. **Name each host and say whether it was already safe.**
- [ ] `changeBtn.hidden` must go back to `true` when `route` lands on the picker.
- [ ] `showError`'s banner from a failed previous route must not persist into the next one —
      check and state.
- [ ] **`?tradition=` and `?name=` must stay bookmarkable and unchanged. Only the *internal*
      transition stops reloading.**
- [ ] `main()` is called once at `:499` and `user`/`corpus`/`traditionList` are loaded once.
      Confirm `route` closes over them rather than re-fetching — that is half the point of
      the step.

## Task 3 — lazy tradition maps · Sonnet · one commit

**Files:** `web/compare.js`, `web/compare.html`.

- [ ] Today `renderResults` awaits **all twelve** tradition maps (~475KB) before rendering
      either the closest-tradition line **or** the scorecard (`:429-448`). But
      `closestTradition` needs them too. **Read `CompareCore.scorecardTraditions` and
      `closestTradition` and establish which maps each actually consumes.** If the closest
      line needs the full set, the deferral is the *scorecard* only and the closest line keeps
      its eager load — **in which case say so plainly and measure what is actually saved,
      rather than reporting the phase file's ~430KB figure unverified.**
- [ ] Whatever the split, the target tradition's own map (`:402-405`) stays eager — it is the
      comparison.
- [ ] The deferral mechanism: **an explicit "Show the all-traditions scorecard" button is the
      preferred form**, because `IntersectionObserver` on `#cmp-scorecard` starts a 430KB
      download from a scroll, and the motion vocabulary's written rule is *no scroll-triggered
      anything*. A button is one tap, is announceable, and cannot fire by accident. **Use the
      button.** If the implementer believes the observer is better, it must argue against that
      rule explicitly rather than defaulting past it.
- [ ] While the maps load, the button's host takes the same skeleton register Task 1
      introduced, with `aria-busy`, cleared on both success and failure. `showError('The
      tradition maps could not all be loaded.')` stays the failure path.
- [ ] **Step 3 changes *when* tradition maps load. It must not change what the scorecard
      says.**
- [ ] **debug.md rule 22 — the verification this task actually has to produce.** A number the
      UI says out loud needs an assertion on realistic input, not just a passing unit suite.
      §AD shipped a confidently wrong answer past sixteen green assertions because none built
      a small map and read the resulting sentence.
      **Before and after this task, run the same real map through `compare-core.js` from plain
      `node` (`WG.loadCorpusSync('content/wizard')`, no browser, no login) and diff the
      *rendered sentences* — the closest-tradition line with its denominator, and every
      scorecard row — not the internals. Paste both outputs into the report and into the
      commit message. Identical is the only pass.**
- [ ] `node --test tests/*.test.js`, **`tests/compare-core.test.js` especially — run it and
      mean it.** It pins `normalise` and the tie handling because a strip-all-punctuation
      mutation passed every other test in the file.
- [ ] **Bytes transferred on first paint are measurably down. Put the before/after in the
      commit message**, measured from the network panel or from the summed
      `content/traditions/*` file sizes, and say which.

---

## Whole-phase verification, batched for the human

Run at the end of P8, once, and hand the human a list rather than blocking per step:

- [ ] `/compare` cold, signed in, at **360px / 820px / 1440px**, both themes, reduced-motion
      on: skeleton appears instantly, in the gallery's register, and does not pulse under
      reduced motion.
- [ ] `/wizard` cold: same.
- [ ] Picker → a tradition → Back → picker → Back → off the page. Forward returns.
- [ ] `/compare?tradition=<id>`, `?name=<name>`, `?doctrine=<id>` pasted cold.
- [ ] The scorecard button, then the scorecard, and the closest-tradition sentence read
      word-for-word against the pre-change capture.
- [ ] `git diff --stat bc9014b..HEAD -- engine/map-view.js` empty.
