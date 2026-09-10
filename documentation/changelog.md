# changelog.md — Theology Mind Map (Project 12)

**This file is history, not instruction.** `CLAUDE.md` carries every rule that is still
live; this carries the round-by-round narrative those rules came out of, moved here on
2026-09-10 so `CLAUDE.md` stops spending a session's context on chronology.

Read it when you need to know *why* a decision was made, or what a phase actually did.
Do not treat anything here as a current instruction — where this file and `CLAUDE.md`
disagree, `CLAUDE.md` wins. Phase-level accounts are in `docs/hosting/phase-*-outcome.md`.

Everything before 2026-09-10 is also recoverable in full from git:
`git show 4e78bda:CLAUDE.md`.

---

## The byte-identity gate, and the six times it moved

History only — the current values and the live rule are in `CLAUDE.md`.

`69d0c9dabd2b4eef2c3593c4d61b69530b22ecf4a705752d0652a7903a5987c7` when written
with `Path.write_text` on Windows (`7284f25cec1c37d959b9feb4a4fcaae21e0b7f744e660cc6e3b798e51454ce10`
LF-normalised, which is what a Linux-side or hosted-response check compares
against). Re-run it after any change to `render.py`.

> These two hashes have moved twice, and this is the only thing that may move
> them: the renderer changed, so the generated files were **regenerated** by
> `py engine/render.py` (never hand-edited). The phase-1 values were
> `20d869…449ba` / `96d692…d4a2a2`; phase 2 escaped `<` in the embedded JSON
> payload and `esc()`'d the `data-goto` attribute, closing a stored XSS
> (`docs/hosting/phase-2-review.md`, B2), giving `6b6483…4cf76` /
> `eaedf3…301a90`. **Phase 7 restyled the four views**, which the phase-7 brief
> licenses explicitly — byte identity does not apply to a phase that changes the
> output on purpose. What phase 7 proved instead is that only *presentation*
> moved: `documentation/theology-map.mm` and `documentation/study-list.md` are
> byte-identical, and the embedded `<script id="data">` payload hashes the same
> as before. Use those as the gate for any future restyle
> (`docs/hosting/phase-7-outcome.md`) — **but the gate is now two invariants, not
> three**: the audit round of 2026-09-05 deleted `render_mm` and the `.mm` export,
> so `documentation/study-list.md` and the embedded `<script id="data">` payload
> are what a restyle must leave byte-identical. The `.mm` hashes recorded below
> are history, not a check you can still run. **The UI round of 2026-08-29 moved them a
> third time**, for the same reason and under the same gate: the rendered map's
> sticky header put the filter field and the Filters button on the `<h1>`'s own
> row, to shorten it on a phone. The pre-round values were `ced6cabd…8fe10` /
> `380dfefd…46598`; the `.mm`, `study-list.md` and the embedded `<script
> id="data">` payload were all verified byte-identical across it. **Phase 10
> moved them a fourth time**, under that same gate — 44px controls in the
> generated map, no Edit link when the document is framed, and `main` centred
> (`docs/hosting/phase-10-outcome.md`, UX9/UX15/UX27). The pre-round values were
> `a2ed6d2f…509bf7` / `0125f4df…863767`; the `.mm`, `study-list.md` and the
> `<script id="data">` payload (`4d8d919e…c8bd7e`) were all verified unchanged.
> **The wide-map change of 2026-09-04 moved them a fifth time**, under the same gate:
> `render()` now sets `main.wide` in the Map view so the map uses the whole window
> instead of 1080px. The pre-change values were `3c4a33ca…c497d` / `1b9fade5…f9253`;
> `documentation/theology-map.mm` (`826951f3…`), `documentation/study-list.md`
> (`f4a30fe1…`) and the `<script id="data">` payload (`4d8d919e…`) were all verified
> byte-identical across it, so again only presentation moved. **The framed-header
> change later the same day moved them a sixth time**, same gate, same three

---

### Post-launch UI fixes (2026-08-24)

Three fixes from a user bug report, none of them where the report's own wording
suggested. Full write-ups in `debug.md` §Q-§S.

- **The sign-in/create-account boxes on `/app` showed for signed-in users too.**
  Not a session or logic bug — `#signed-out`'s own `display: grid` rule (an ID
  selector) outranked the browser's `[hidden] { display: none }` (an attribute
  selector), so toggling the `hidden` attribute never actually hid it.
  `#signed-out[hidden] { display: none; }` fixes it. **Any pane hidden by the
  `hidden` attribute needs its own `[hidden]` override if it also carries an
  author `display` rule on the same selector.**
- **The wizard's Finish button and `first-run.js`'s `copy_from` now land on
  `/app`, not `/edit`.** Both used to drop straight into the raw form editor
  right after producing a real map — correct for "Write my first belief" (there's
  nothing to view yet) but wrong for these two, which reuse the existing
  map-home hub (`View and export` / `Open the editor`) instead of adding a new
  screen.
- **`engine/editor.html` gained hosted-only nav links** (`My map` / `Gallery` /
  `Sign out`, appended into the existing `.toplinks`). It never imported
  `web/chrome.js` at all — correct given the offline tool must load from
  `file://` with no network — but that left the *hosted* editor with no way back
  to the rest of the site short of the browser back button. Gated behind the
  same `if (HOSTED)` branch that already dynamically imports
  `storage-hosted.js`, so the local tool's `file://` path is untouched.

### The wizard's question screen never actually worked — FIXED (2026-08-25)

Reported as a phone-only "the button doesn't show the screen"; it wasn't phone-specific.
`startQuestions()` (`#lens-next`, and `#intro-start` on a return visit) and `main()`'s
resume branch both did `order.indexOf(next)`, but `next` comes from `WG.nextDoctrine()`,
which rebuilds every doctrine as a fresh object on each call (`allDoctrines()` wraps each
one in `Object.assign`) — so it's never reference-equal to anything in `order`,
`indexOf` always returned `-1`, and `renderQuestion(-1)` crashed reading `order[-1].slug`
one line in. This was true on every platform, every time; nobody had hit it because the
render path had no error handling at all, so a throw there just looked like the button
did nothing. Fixed by matching on `.slug` instead of identity (`orderIndexOf()` in
`web/wizard.js`). Full account, including how it was reproduced in plain `node -e` with
no browser: `debug.md` §T.

### The UI round of 2026-08-27 — `/app` deleted, the wizard rebuilt

Twenty-six items off a single user bug/improvement list. The parts worth knowing
because they are easy to undo by accident:

- **`/edit` was never broken; its *copy* was.** Reported as "the edit screen says
  no file uploaded yet and offers Connect theology-map.md". Hosted mode has always
  hidden Connect/Upload and autoloaded the map from the database — what showed was
  `engine/editor.html`'s **empty-state paragraph**, local-tool prose naming a file
  bar that hosted mode does not render and a file a hosted user does not have. The
  hosted branch of `boot()` now rewrites the title, subtitle, "open the map" link
  and that empty-state sentence. **Every visible string in `editor.html`'s markup
  is the `file://` tool's wording; anything hosted-specific belongs in the
  `if (HOSTED)` branch, not in the HTML.** Full account: `debug.md` §U.
- **Unlisting is now self-service.** `POST /api/map {action: "set_visibility",
  user_id, is_public}`. `user_id` is the credential exactly as it is for save and
  restore — no new trust. (The control itself has since moved twice: it was a link
  in the editor nav and on the wizard launchpad, and since 2026-08-29 it is a tile
  on `/` and nowhere else. The adapter's `setVisibility` went with it.)
  The wording rule is unchanged and still load-bearing: **Unlist, never Hide.**
  Unlisting is not privacy.
- **`/view` must not redirect an owner on a 404.** The nav's "My map" points at
  `/view?name=`, which redirects an owner whose map is empty to `/wizard`. That
  test is gated on `res.ok` on purpose: `/api/render` 404s an **unlisted** map as
  well as a missing one, so redirecting on any 404 would bounce an owner who had
  just unlisted their own map back to the wizard every single time they clicked
  "My map". Caught in review, never shipped — `debug.md` §W.
- **The wizard's finish screen became its launchpad.** `/wizard` now opens on a
  home screen carrying the stats, the tier bar, the tradition control, the
  listed/unlisted toggle, the first-run offers when the map is empty, and the
  fourteen areas with per-area progress and two buttons each: *Next question*, and
  *List questions* → a per-doctrine list. **Those rows opened `/edit?open=<slug>`
  until 2026-08-29; they now open the wizard's own question screen in place** —
  see that round's section below. "Finish here" changes screen rather than
  navigating.
- **`domainProgress(domains, corpus)` is in `engine/wizard-generate.js`, not
  `web/wizard.js`.** The rule has not moved: the UI decides what to ask, the pure
  UMD module does the model work, and that is what keeps the whole path runnable
  from plain `node`. Two new answer kinds live there too — `custom` (the "write my
  own view" tile: hold/tier/confidence/#study promoted, the other five behind
  `details.optional`, phase 3's split verbatim) and `answer.todo` on the `open`
  branch so "I haven't worked this out yet" is editable rather than fixed.
- **The question screen lost its glosses on purpose.** `TIER_GLOSS` and
  `CONF_GLOSS` are gone; both scales are explained once, on the launchpad. Tier and
  confidence are wrapping radio groups, not `<select>`s. The position's own
  description **is** the editable `hold` field — there is no second "What I hold"
  box any more, and no "Word it my way" button.
- **`web/refs.js` linkifies every citation.** `citationUrl(label, citation)` always
  returns a usable https URL: a curated table of the ~20 works that actually recur
  in the corpus (verified live, one at a time), and a Google-search fallback for the
  long tail. **Phase 9 changed the arithmetic here without changing the design:**
  249 of the corpus's 569 `sources` now carry a real `url` (it was 25 of 424), so
  the curated table and the search fallback are load-bearing for a much smaller
  share of citations than when this was written. The fallback still exists because
  the remaining 320 have no stable free public text — and because no `held_by`
  citation carries a `url` field at all, the schema having no place for one. A
  real `url` in the corpus still wins.
  `tests/refs.test.js` is the gate. **Schleitheim Confession and the Longer
  Catechism of St Philaret are deliberately absent from the table** — no live
  free-text host could be verified, and this project's rule is that a dead link is
  worse than plain text.
- **`web/admin.html` may cache the admin PIN in `sessionStorage`**
  (`theologymap:adminpin`), a deliberate relaxation of the old "never store it
  anywhere" comment: it dies with the tab, never reaches localStorage, a cookie, a
  URL or a log, and it is consistent with the stated "security is deliberately
  minimal and that is the brief" posture. The users table is now responsive stacked
  tiles built with `createElement`/`textContent`, which removes the escaping
  obligation rather than restating it — `escapeHtml` is gone from that file.
- **`web/wizard.html` carries one `[hidden] { display: none !important }`** instead
  of a dozen per-id overrides. It toggles about twelve panes and several carry
  their own `display` rules; this is the root-cause fix for the whole class of
  bug `debug.md` §Q describes on one element.

### The UI round of 2026-08-29 — a phone-sized pass over every screen

Twenty-four items off a single user bug/improvement list, run as four
file-disjoint batches. Full per-bug write-ups in `debug.md` §Z–§AB. The parts
worth knowing because they are easy to undo by accident:

- **"Ignore for now" is a third state, and it lives only in the browser.**
  `localStorage['tmm.wizard.ignored']`, a JSON slug array beside
  `tmm.wizard.tradition`. It is a *preference, not content* — nothing in the map
  records it — so every read and write is wrapped in try/catch and a private-mode
  browser degrades to "nothing ignored". It is deliberately **not**
  `web/session.js`'s key and does not belong to the session module. The reason it
  is not in the markdown: a node is the only thing the file format can hold, and a
  node for a question you skipped would put a belief you never stated onto your
  map. The reason it is not a column: it would be a migration, a route and a new
  thing every save path must not clobber, for a "move past this" gesture.
  Ignored doctrines are skipped by the queue and counted separately — an area
  reads `4 of 12 · 2 ignored`, and "all N answered" only when nothing is left at
  all.
- **The wizard's area question list opens the question screen in place.** A
  module-level `returnTo` (an area id, or null) decides where Back and "Finish
  here" land. This is what made the revisit data loss below reachable in normal
  use; the two changes shipped together and the second is the reason the first is
  safe.
- **`applyAnswer`'s revisit rebuild now preserves the person's own writing.**
  It deletes and rebuilds the node from the corpus, and `currentAnswer()` sends
  only hold/tier/confidence/#study for a `position` answer — so `todo` and
  hand-written `link`s were destroyed and `why`/`vs`/`refs` overwritten with
  corpus text. Every fallback chain is now
  `answer.x !== undefined ? answer.x : (prev.x || <corpus default> || '')`, which
  keeps the explicit-clear semantics (an empty string still clears), and
  `_intendedLinks` is a de-duplicated union rather than a replacement.
  `tests/wizard-generate.test.js` pins both halves — the preserve *and* the
  clear. **Do not reorder `prev.x ||` ahead of the `!== undefined` test**; that
  is what the second test exists to catch.
- **Every word of prose about a doctrine is behind one disclosure.** The
  question screen shows the title and the answer tiles; the framing paragraph
  joined the learn note and the sources under a summary renamed **"Read about
  this question"** and styled as a real bordered control. `#q-framing` is gone.
- **Tier and confidence stayed real `<input type="radio">` on both surfaces.**
  They were only resized (11.5px, `7px 9px`, `inline-flex` centred, `min-height:30px`)
  so they stop wrapping on a phone. The editor's open map tile now uses the same
  shape, sized to match. Arrow-key operation and the radiogroup semantics come
  from the platform in both places — do not hand-roll `role="radiogroup"`.
- **The selection tick is gone.** `.sel`'s tint and border are the only selection
  signal, and the gutter both `.wz-card-h` and `.wz-chips` reserve for the
  Read-more button shrank accordingly.

**Task 21's standing assessment — the wizard against a hand-edited map.** Two
findings beyond the revisit fix, both deliberate rather than bugs, both worth
knowing:

- `domainProgress()` iterates the **corpus manifest**, so an area a person
  invented never appears in the launchpad's Areas list, and neither does a
  hand-written belief inside a corpus area whose slug is not a corpus doctrine.
  Both still count in "beliefs written" and "areas covered", which read the map.
  The two numbers mean different things on purpose. Ordering is safe:
  `findOrCreateDomain` gives an off-manifest area `orderOf === Infinity`, so a
  corpus area added later inserts before it.
- Slug matching is global, so `## Inerrancy` written under `# Ethics` marks the
  *Scripture* doctrine answered; answering it moves the node to Scripture and
  leaves an empty `# Ethics` heading. Defensible — one belief, one slug is the
  rule `pruneLinks` and `compare-core.js` both rest on — but it is silent.

### The review round of 2026-09-04

Sixty-two findings off two independent reviews (`documentation/sixhatreview.md`,
`documentation/uxreview.md`), run as fourteen file-disjoint tasks. Full account in
`docs/hosting/phase-10-outcome.md`; new seam write-ups in `debug.md` §AC–§AE. Only
the things that are easy to undo by accident:

- **The `is_public` asymmetry in `api/render.py` is deliberate.** The `name`
  branch checks it; the **`user_id` branch must not**. The id is a
  save-authorising secret, and guarding it locks an owner out of their own
  unlisted map — which is exactly what happened, silently, to every unlisted map
  and its Export HTML until X3. `api/map.py:31-39` documents the same rule from
  the other side. Making the two branches "consistent" reopens the bug.
- **`--t1`…`--t4` live in `engine/theme.css`.** Four hand-copied duplicates in
  `web/` were deleted. Do not reintroduce a tier hex literal in a `web/` file —
  read the token. (`render.py` keeps its copy; see the phase 7 note above.)
- **`serializeNode` neutralises newlines silently.** A newline in a field used to
  split one belief into two nodes and strand its `refs` line. Fields are now
  collapsed to a single line, and `·`/`|` are stripped from titles, with no
  message to the person — Thomas's call. Verified a byte-for-byte no-op on
  `theology-map.md` and all twelve tradition maps.
- **`closestTradition` flags *every* tied row and no longer returns
  `denominatorNote`.** Ties are compared on one scale (`score`, within an
  epsilon), never on a raw-count tolerance, and every row carries its own
  `numerator`/`denominator` for the caller to build the sentence from. The old
  code named one tradition with full confidence on a four-way tie.
- **`#home-empty` is deleted.** Its third first-run offer — *start from someone
  else's map* — now lives on `#screen-intro`, which is the screen a new account
  actually lands on. Do not re-add a second empty-state home.
- **Growth marker: `/compare` still eagerly loads all 475 KB of tradition maps.**
  Lazy-loading the eleven non-target maps is the next performance move if the
  page gets slow. Deliberately not done yet.

### Shipping phase 10, and the tablet round of 2026-09-04

**Phase 10 had never been deployed.** Its sixteen commits sat on the local
`phase-10` branch while production ran the pre-phase-10 build, so every phase 10
change above — the tier-token cleanup, the unlisted-map fix, the wizard work —
went live only on 2026-09-04, in one fast-forward merge to `main`. If a phase's
outcome file says something shipped, check `git log origin/main` before believing
it: **committed is not deployed**, the same way `docs/hosting/decisions.md` says
committed is not applied for a migration.

Everything below came out of using the live site on a phone and an iPad
afterwards. Five bugs: two were reported from the phone (§AF, §AH), two were not
viewport-related at all (§AG, §AI), and **the last two only existed on a wide
screen**. `/view`'s iframe had been rendering at its 300px intrinsic width the
whole time (§AJ) and the framed map's header stayed at full height above 640px —
both read as correct on a phone, which is narrow enough that 300px and a trimmed
header look deliberate. The 2026-08-29 round was explicitly a phone-sized pass;
this is what that missed. **Check one wide viewport before calling a layout
done.**

Write-ups: `debug.md` §AF–§AJ.

- **`/learn`'s position cards let their `gap` own all vertical spacing.**
  `.lp-pos > *, .lp-mine > * { margin: 0 }` is there because every row in those
  cards is a `<p>` and flex gaps *add to* margins rather than collapsing them — the
  cards were rendering at roughly double their intended spacing (`debug.md` §AF).
  The reset is scoped with `>` on purpose: `.lp-prose` is used outside the cards
  too, where its bottom margin is wanted, and it must stay declared *after*
  `.lp-prose`/`.lp-hint`/`.lp-refs` to win on order. Add a row to these cards
  without a margin of its own.

- **A framed map trims its own header, and the map canvas measures rather than
  subtracts** (2026-09-04). `render.py` marks `<html class="framed">` when
  `window.top !== window.self` — the same test that already removed the Edit link —
  and that hides the kicker, subtitle and tier legend and visually-hides the `h1`,
  because `/view`'s own chrome already carries all four. Below 640px the phone query
  dropped these anyway, which is why a framed map looked right on a phone and
  top-heavy on an iPad. **`#mapwrap`'s height now comes from `sizeMap()`**, which
  measures the header's real `offsetHeight`, so the canvas follows whatever the header
  turns out to be instead of needing a third hand-tuned `calc(100vh - Npx)`. The CSS
  constants stay as the no-JS fallback. `sizeMap()` runs before `redrawMap()` — that
  order matters, since the redraw centres against the wrap's height.
- **The rendered map's Map view sets `main.wide`** (2026-09-04), which is
  `max-width: none` — the card views keep the 1080px reading measure, the map takes the
  whole window. The class was already defined in `render.py` and had no caller; `render()`
  is now it. This is what makes `/view`'s fullscreen useful on an iPad or a laptop, where
  1080px of a 1600px window left the map boxed in.
- **`.tm-main` in `web/view.html` carries `width: 100%; box-sizing: border-box`, and
  must keep it.** `/view` is the only page that makes `<body>` a flex column, and
  `theme.css`'s `margin-inline: auto` on a flex item cancels the cross-axis stretch —
  without an explicit width the container shrink-to-fits and the iframe collapses to its
  300px intrinsic width, which reads as correct on a phone and is obviously broken on an
  iPad (`debug.md` §AJ).
- **`/view` has a Fullscreen toggle** (2026-09-04). It is **not** the Fullscreen API —
  iOS Safari does not support `requestFullscreen()` on a non-video element, and a phone
  is the case it was asked for. It is `body.tm-enlarged`, which hides this page's chrome
  and lets the existing flex column give the iframe the whole viewport. **It deliberately
  does not fix-position the iframe**: the rendered map sizes its canvas with `#mapwrap {
  height: calc(100vh - 130px) }`, and iOS Safari does not re-resolve that `100vh` against
  a `position: fixed` iframe's new height — the first attempt shipped a map filling less
  than half the screen with dead space beneath it (`debug.md` §AH). The button is a
  standalone fixed element in the bottom-right, outside `mount()`'s actions row, in the
  same spot whichever state it is in. Escape also exits, and it is the only other way
  out, since the frame is sandboxed without `allow-same-origin` so no key pressed inside
  it reaches the page.

- **`py tests/syntax_check.py` is the gate that did not exist.** An unescaped
  apostrophe in `web/gallery.html` blanked the entire Browse screen in production
  (`debug.md` §AI) — a module that fails to parse runs none of its lines, so the
  page rendered nothing at all while `/api/gallery` answered 200 the whole time.
  Nothing here parsed browser-side JS, so it shipped. Run it before any push that
  touches `web/` or `engine/`.
- **Scripts that edit repo files must read and write bytes.** `pathlib`'s
  `write_text` translates `\n` to `os.linesep` on Windows, which silently
  re-encoded three LF files to CRLF and committed 1814 insertions for a twelve-line
  change (`debug.md` §AG). `Path.read_text(newline='')` only exists on Python 3.13+
  and this machine is 3.11, so binary is the portable answer. **Read
  `git diff --stat` before committing, not after.**

### The ponytail audit round of 2026-09-05

A whole-repo scan for over-engineering, then sixteen cuts: **125 insertions, 645
deletions across 29 files.** No behaviour change was intended anywhere, and the full
gate above passed after it (51/51 JS checks, 0 syntax failures, 0 validator errors, and
`render.py` regenerating `theology-map.html` with a one-comment diff). What the round
established, beyond the diff:

- **The helpers this repo forks are `el`, `escapeHtml` and `slugify`.** All three had
  drifted into three or four copies. They now live in one place each — `el` and
  `slugify` exported from `web/chrome.js`, `escapeHtml` from `engine/editor-core.js`
  (which `editor.html` loads first, so the global is there for `map-view.js` and
  `shared-fields.js`). **Another copy of any of them is a bug in waiting**, and
  `web/view.html`'s `slugify` proved it — see `debug.md` §AK. One fork survives on
  purpose: `slugify` exists in both `editor-core.js` and `chrome.js`, because an ES
  module cannot import the former and `file://`-served `editor.html` cannot load the
  latter. Both are correct today; change one, change the other, and `render.py`'s too.
- **`citeLink`/`sourceLine` live in `web/refs.js`**, parameterised by class name and an
  optional `onFollow`, which is how the wizard keeps its commit-on-click without a
  second copy of the function. `refs.js` stays DOM-free and takes `el` as an argument
  rather than importing `chrome.js`: `tests/refs.test.js` `require()`s it under plain
  Node, where an absolute `/web/...` import resolves against the filesystem root and
  fails.
- **`.cite-link` in `engine/theme.css`** replaces the forked `.wz-hint a` / `.lp-hint a`
  rules. The class goes on the anchor inside the shared `citeLink()`, so neither page
  needs per-container selectors.
- **Deleted as unreachable, each verified by grep before cutting:** `api/admin.py`'s
  `save_map` action (no caller), `api/_lib.py`'s placeholder `handler` class (a leading
  `_` is not routed), the `do_PUT`/`do_DELETE`/`do_PATCH` aliases in `auth.py` and
  `gallery.py` (`BaseHTTPRequestHandler` already answers 501), `storage-local.js`'s
  `load()` (its whole body was a `throw`), `editor-core.js`'s `FIELD_KEYS`, and six
  exports that only had internal callers. `shared-fields.js` lost its UMD wrapper —
  it touches the DOM on purpose and nothing ever `require`d it.
- **`engine/validate_content.py` imports `render.slugify`** instead of re-typing it.
  Its own docstring had said drift there was the bug rule 4 exists to catch.
- **`render_mm` and the `.mm` export are gone** — nothing in the app read the file and
  it shipped 40KB to Vercel on every deploy. This shortens the restyle gate to two
  invariants; see the phase 7 note above.

**Shipped and live.** Merged fast-forward to `main` and pushed 2026-09-05
(`cb08cea` code, `94fd056` docs); Vercel deployed it. Verified against the live site,
signed out: `/learn`'s index and a doctrine page (25 `a.cite-link` anchors, correct
`target`/`rel`, underlined, `--ink`), `/gallery` (counts, `relTime`, "Started from
Thomas's map"), and `/view?name=Thomas` (the map renders through `/api/render`'s public
`name` path, so `render.py` still produces a working map after `render_mm` came out).
No console errors on any of them. **The editor's runtime paths are the gap**: `/edit`
needs a signed-in user, so `EditorCore.escapeHtml`, `SharedFields.renderLinkField` and
`MapView` were confirmed only to *load and parse*, not to run. The next session with an
editor open should open the List and Map tabs on a real map and check a title
containing `<`, `&` or a quote renders as text rather than markup.

**Left in deliberately.** `_lib.py`'s `URL_CANDIDATES`/`KEY_CANDIDATES` still try two
env-var names each, and the comment still says to trim once discovery succeeds — only
the live Vercel environment shows which name is set, and guessing takes the site down.
And **the Map-view layout/pan-zoom engine is still forked**: ~390 lines inside
`render.py`'s template string against ~430 in `engine/map-view.js`, hand-kept in
lockstep, the largest single duplication in the repo. Unforking it means making
`map-view.js` the one source and having `render.py` inline it with a second
`.replace("__MAPJS__", ...)` beside `__DATA__`; the two consumers read different input
shapes (a flat `nodes` array vs the editor's grouped `domains`), so it needs a small
adapter and a browser to verify pan, zoom, pinch and detail-open. It is not a
test-covered change and should get its own session.

