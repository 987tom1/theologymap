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
