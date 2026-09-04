# Phase 10 — review remediation

> **For agentic workers:** this plan is executed by dispatching one subagent per
> task. Tasks are file-disjoint by construction: **every file in this repo has
> exactly one owning task.** Two agents must never open the same file.

**Goal:** Apply the actionable findings of `documentation/sixhatreview.md` (30
findings) and `documentation/uxreview.md` (32 findings), then update `CLAUDE.md`,
`debug.md` and write `docs/hosting/phase-10-outcome.md`.

**Architecture:** Findings are grouped **by file, not by finding**. One agent
opens `web/wizard.html` once and applies all eighteen of its items rather than
eighteen agents each paying to read it. Prescriptions are inlined below so **no
subagent ever opens a review file** — the two reviews are 70 KB each and reading
them is the single largest avoidable cost in this phase. Where a prescription
genuinely needs the review's own table, the task names an exact line range.

**Tech stack:** Python 3.11 (`py`, never `python`), Node v24, zero dependencies,
no bundler, no framework. `requirements.txt` is empty and stays empty.

**Branch:** `phase-10`, branched from `a4a3ef8`. Agents commit; agents never
merge. Thomas merges to `main` after the nine checks pass.

**Source reviews:** `documentation/sixhatreview.md`, `documentation/uxreview.md`
— both written 2026-09-02 against `545b370`, **before phase 9 merged**. Where a
task says "verify first", the review may be describing code phase 9 has changed.

---

## Global constraints

Every task's requirements implicitly include all of these.

1. **`py`, never `python`.** Bare `python` hits the Microsoft Store stub.
2. **No new dependency, no bundler, no CDN import, no framework.**
3. **No browser verification.** Thomas does that pass. Do not ask for it, do not
   claim it, do not block on it.
4. **Import by absolute path** in every `web/` and `engine/` module — static and
   dynamic. A relative `./x.js` 404s under Vercel's rewrite (`debug.md` §A, §Y).
5. **No response, on any route, ever contains a PIN.**
6. **`engine/theme.css` and `engine/render.py`'s embedded `:root` declare the
   same tokens by hand** and nothing checks that they agree. Change one, change
   the other.
7. **`--line` and `--field-line` are not interchangeable.** `--field-line` is for
   interactive control boundaries only (WCAG 1.4.11 needs 3:1). `--line` stays
   the decorative divider.
8. **Voice: second person throughout the UI prose.** This phase brings
   `/compare`, `/wizard`, `/learn`, `/view` and the editor into line with `/` and
   `/history`. **The six locked field labels do not change** — *What I hold, Why,
   What I'd reject, Still working out, Texts, Related* — nor does the **"My map"**
   tile. They are `phase-3-design.md` §2.2's table, shared verbatim by the editor,
   the wizard and the generated views; renaming them would move the renderer
   output and rewrite a locked design doc.
9. **Do not add a person-vs-person scorecard.** `compare-core.js` says so in a
   comment at `scorecard()`; it is load-bearing.
10. **Never open `theology-map.html` (129 KB) or `documentation/verses.md`
    (219 KB).** Nothing in this phase requires either.
11. **Commit per task**, message `phase 10: <task name> (<finding ids>)`.

### The nine checks — the merge gate

```
py engine/validate_content.py
node tests/compare-core.test.js
node tests/build-traditions.test.js
node tests/wizard-generate.test.js
node tests/refs.test.js
py tests/check_tradition_maps.py
py tests/test_validate_content.py
py api/_test_lib.py
py engine/render.py
```

All nine pass on `a4a3ef8` — verified 2026-09-04 on Python 3.11.9 / Node v24.19.0.
**An agent runs the subset its files can affect; Thomas runs all nine before merge.**

### Out of scope — declined, not missed

Record these in the outcome file. Do not implement them.

| Item | Why |
|---|---|
| **F2** — coverage floor gating `closestTradition` | Declined by Thomas. Excluding sub-floor traditions would make INC (15% coverage) unnameable as anyone's closest tradition. F1's per-tradition fraction makes the thinness visible on screen instead. |
| **X2 / new tests** | Fixing the bugs is this round's scope. No new test files. |
| **UMD refactor** of `web/*.js` logic | Scope creep. |
| **A-edit** — admin "edit any map" UI | Admin does not need to edit maps. |
| **E4** — 20-row retention | Still unverified by anyone; needs 21 saves an hour apart. Stays declared unverified. |
| **Lazy-loading the 11 non-target tradition maps** on `/compare` (475 KB) | Deferred. Task 14 records it in `CLAUDE.md` as a growth marker. |
| **Gallery and `map.py` full-markdown reads** (C2, A3) | Fixing them properly needs denormalised count columns and a migration. Row counts do not justify it. Only `admin.py`'s genuinely unused select is dropped (E3). |

---

## Ordering

**Task 3 must land before Tasks 2, 4 and 12.** It adds `--t1`…`--t4` to
`engine/theme.css`, and those three tasks delete the hand-copied duplicates that
currently keep their pages working. Deleting a copy before the shared token
exists ships four pages with no tier colours.

Everything else is parallel-safe: Tasks 1, 5, 6, 7, 8, 9, 10, 11 and 13 may all
run at once with Task 3.

Task 14 runs last, alone, on the main thread.

---

## Task 1 — docs, EOL, and two dead selectors

**Model: Haiku.** Purely mechanical, no judgment.

**Files:**
- Create: `.gitattributes`
- Modify: `tests/README.md`, `web/learn.html`, `web/admin.html`

**Findings:** X6, G1, UX 22, UX 6

- [ ] **Step 1 — G1: create `.gitattributes`.** The three generated files are
      committed CRLF with no `.gitattributes`, so regenerating on Linux rewrites
      every line ending with zero content change. Pin them:

```
theology-map.html                 text eol=crlf
documentation/theology-map.mm     text eol=crlf
documentation/study-list.md       text eol=crlf
```

Thomas has approved this rewriting the committed bytes once.

- [ ] **Step 2 — G1: normalise.** Run `git add --renormalize .`, then
      `git status`. If only those three files show as modified, that is the
      expected one-time rewrite. If any **other** file appears, stop and report —
      nothing else may be touched.

- [ ] **Step 3 — X6: fix `tests/README.md`.** It names four of the nine runnable
      checks and says `py` in some places and not others. Replace its list with
      all nine commands exactly as given in "The nine checks" above, each with a
      one-line note of what it covers. The five currently missing are
      `compare-core.test.js`, `build-traditions.test.js`, `refs.test.js`,
      `check_tradition_maps.py` and `api/_test_lib.py`.

- [ ] **Step 4 — UX 22: `web/learn.html:18-19`.** The selector `main.tm-page`
      matches nothing — `tm-page` is on `<body>`, not `<main>` — so `/learn`'s
      intended 900px cap has never applied. Change it to:

```css
body.tm-page main { max-width: 900px }
```

- [ ] **Step 5 — UX 6: `web/admin.html:39-59`.** `/admin` has no `<main>` and no
      `.tm-main`, so it gets an 8px UA gutter and no width cap while every other
      page has 28px and 1200px. Wrap the four existing top-level blocks in
      `<main class="tm-main">…</main>`. **Add no new CSS** — `.tm-main` already
      carries both rules in `engine/theme.css`.

- [ ] **Step 6 — commit.**

```bash
git add .gitattributes tests/README.md web/learn.html web/admin.html
git commit -m "phase 10: docs, EOL pinning, two dead selectors (X6, G1, UX22, UX6)"
```

---

## Task 2 — landing and gallery

**Model: Haiku.** Copy and markup only.

**Blocked by Task 3** (Step 4 deletes a tier-colour copy).

**Files:** `web/landing.html`, `web/gallery.html`

**Findings:** UX 18, UX 19, UX 25, A1 (markup half), X1 (gallery copy), C1 (label)

- [ ] **Step 1 — UX 18: `web/landing.html:59,117`.** The new-account tile links
      to `#signin`, which lands **above** the Sign in form, so a first-timer
      scrolls past sign-in to find create-account. Point the tile's `href` at
      `#signup-form`. Verify that id exists first; if the signup form carries a
      different id, use the real one and say so in the commit message.

- [ ] **Step 2 — UX 19: `web/landing.html:61-62` vs `:94`.** "A name and a short
      PIN" appears twice on one page, one scroll apart. **Keep `:94`** — it sits
      with the form, where the information is needed. Rewrite the tile body at
      `:61-62` so it says what the tile *does* rather than restating the
      requirement. Read `documentation/uxreview.md` lines **418-447** (§2.3) for
      the suggested replacement and use it.

- [ ] **Step 3 — A1 (markup half).** The signup name field has no length limit,
      and a name over 60 characters currently returns a bare `500 server_error`.
      Add `maxlength="60"` to the signup name input. The server-side 400 is
      Task 7's half.

- [ ] **Step 4 — X1 (gallery copy): `web/gallery.html:43-44`.** The tier ramp is
      a **JS object of raw hex** here — the only one of five copies that is not a
      `:root` block. Task 3 has by now added `--t1`…`--t4` to `engine/theme.css`,
      which this page already links. Delete the hex object and read the values
      through `var(--t1)`…`var(--t4)` the way this file's three siblings do. If a
      value is genuinely needed in JS rather than CSS, use
      `getComputedStyle(document.documentElement).getPropertyValue('--t1')`.
      **Do not leave a hex literal anywhere in this file.**

- [ ] **Step 5 — UX 25: `web/gallery.html:131`.** A signed-in member whose map is
      unlisted or empty is told to "Sign up free". Branch that card's copy on
      whether `user` is set: a signed-in member gets a line pointing at the
      wizard or at relisting; a signed-out visitor keeps the existing copy.

- [ ] **Step 6 — C1 (label): `web/gallery.html`.** "Open questions" means two
      different numbers in two places — the gallery counts nodes tagged `#study`
      **or** `open` (36 on Thomas's map), the wizard counts `#study` only (33).
      The definitions are **not** being aligned; the label is. Rename the
      gallery's label to **"Unsettled"** and leave the wizard's "Open questions"
      alone, so no reader is invited to compare the two numbers.

- [ ] **Step 7 — voice.** Convert this file's first-person UI prose to second
      person, per Global Constraint 8. **Do not touch the six locked field labels
      or the "My map" tile.**

- [ ] **Step 8 — commit.**

```bash
git add web/landing.html web/gallery.html
git commit -m "phase 10: landing and gallery copy, tier tokens, label (UX18, UX19, UX25, A1, X1, C1)"
```

---

## Task 3 — `engine/theme.css`

**Model: Sonnet.** Five findings in one stylesheet, with real layout
consequences.

**This task gates Tasks 2, 4 and 12. Run it first.**

**Files:** `engine/theme.css` (only)

**Findings:** X1, UX 2, UX 10, UX 14, UX 23

**Produces — Tasks 2, 4 and 12 consume this:** `--t1`, `--t2`, `--t3`, `--t4`
(plus the two further ramp hexes) defined on `:root` in `theme.css`, with the
same values they have today.

- [ ] **Step 1 — X1: add the tier tokens.** `CLAUDE.md` states the ramp lives in
      two hand-kept copies. It is actually **five**, and `theme.css` — documented
      as their home — has **none**. Add `--t1`…`--t4` and the two further ramp
      hexes to `theme.css`'s `:root`, taking the exact values from
      `engine/render.py:67-72`, which is the legitimate copy (that file must stay
      self-contained and double-clickable, so it cannot link a stylesheet). All
      five copies currently agree, so this is a byte-for-byte move, **not** a
      redesign. **Do not change any value.** Tasks 2, 4 and 12 delete the other
      four copies.

- [ ] **Step 2 — UX 2: top-nav tap targets.** `theme.css:80-93`. The
      coarse-pointer floor selects `button` and never `a`, so the top-nav links
      are **12px** tall on a phone against a 44px minimum. Add:

```css
.tm-chrome .toplinks a { padding: 16px 0 }
```

      and give the other link and `summary` rows the same treatment. Read
      `documentation/uxreview.md` lines **678-740** (§3.2) for the full list of
      rows and the exact rules. Note that section's own caveat: it recommends
      38px for the radio groups but says to fall back to 34px if six radio labels
      wrap to a third row on a 360px phone. **That cannot be tested without a
      browser — use 38px and flag it in the commit message for Thomas's phone
      check.**

- [ ] **Step 3 — UX 10: the 320px overflow.** `theme.css:123-125` uses
      `minmax(300px, 1fr)`, which overflows by 36px at a 320px viewport; the
      comment claiming otherwise checks only 360px. Change to:

```css
minmax(min(300px, 100%), 1fr)
```

      and fix the comment to say what was actually checked. This is pure box
      arithmetic — the review is confident in it without a browser.

- [ ] **Step 4 — UX 14: the stale body margin.** `theme.css:110-114` carries a
      comment justifying the absence of a `margin` rule. The justification is
      stale, and the resulting 8px UA body margin costs `/view` a permanent 16px
      horizontal scrollbar. Add `margin: 0` to the `body.tm-page` rule and
      **delete the stale comment** rather than updating it.

- [ ] **Step 5 — UX 23: one prose measure.** Four caps ship — 58ch, 62ch, 68ch,
      72ch — against `phase-3-design.md` §3's single stated **58ch**.
      Standardise on **58ch**. Change the caps that live in this file; read
      `documentation/uxreview.md` lines **884-904** (§3.7) for all four sites and
      **list the ones outside this file in your commit message** so Tasks 4, 11
      and 12 pick theirs up.

- [ ] **Step 6 — verify.** `py engine/render.py`; confirm it still reports
      **99 nodes / 14 domains / 156 refs, 0 warnings**. The renderer does not read
      `theme.css`, so this is a smoke check that nothing else moved.

- [ ] **Step 7 — commit.**

```bash
git add engine/theme.css
git commit -m "phase 10: tier tokens home, tap targets, 320px overflow, body margin, 58ch (X1, UX2, UX10, UX14, UX23)"
```

---

## Task 4 — `/compare`

**Model: Sonnet.**

**Blocked by Task 3** (Step 2 deletes a tier-colour copy).
**Coordinates with Task 8** — Task 8 changes what `closestTradition` returns;
this task changes what the page does with it.

**Files:** `web/compare.html`, `web/compare.js`

**Findings:** UX 20, UX 26 (part), X1 (part), F4, F5 (UI half), F1 (UI half)

**Interfaces — consumes from Task 8:**

```js
// CompareCore.closestTradition(...) returns:
{
  ranked: [ { traditionId, displayName, numerator, denominator,
              excludedCount, score, joint } ],   // joint === true on EVERY row
                                                 // tied with the top row
  enough: Boolean
}
// `denominatorNote` is REMOVED. Every row carries its own numerator and
// denominator; build the sentence per named tradition from those two fields.
```

- [ ] **Step 1 — UX 20: the `[hidden]` guard.** `web/compare.html:10-12` has no
      `[hidden] { display: none !important }` rule, and `#cmp-closest` at `:27`
      has the exact shape `debug.md` §Q documents — an author `display` rule on
      an ID selector, which outranks the browser's own `[hidden]` rule, so
      toggling the attribute does nothing visible. Latent today; the leak would
      be a closest-tradition line appearing on a person-to-person compare, which
      Global Constraint 9 forbids. Add the one-line guard, matching what
      `web/wizard.html` already carries.

- [ ] **Step 2 — X1 (part).** Delete the `:root` tier-ramp block at
      `web/compare.html:11`. This page links `theme.css`, which now defines them.

- [ ] **Step 3 — F4: `web/compare.js:399,430`.** Both fetch tradition maps with
      **no `res.ok` check**, so a 404 parses as an empty map and the page renders
      "This tradition takes no position on it" eighty-six times with no error at
      all. Add `if (!res.ok) throw new Error(...)` at both sites — matching how
      `web/view.html:100` already handles it — and route the throw into this
      page's existing error banner.

- [ ] **Step 4 — F1 + F5 (UI half).** The old code appended a single
      `denominatorNote` describing only `ranked[0]` to a sentence that could name
      two traditions; after Task 8 it may name **any number** of tied traditions.
      Rewrite the closest-tradition sentence to name every row where
      `joint === true` (or the single top row when nothing is tied), each with
      **its own** fraction. Target shape:

> You are equally close to **Anglican** (agrees with 12 of the 12 questions where
> you both have a position), **Reformed** (12 of 12), **Lutheran** (12 of 12) and
> **Non-denominational** (12 of 12).

      Naming four is fine — no "and N others" cap. The single-tradition case keeps
      a one-clause sentence. **Keep the existing `own-wording` copy at
      `compare.js:171-176` exactly as it is** — the review singles it out as
      accurate and well-judged.

- [ ] **Step 5 — UX 26 (part): `web/compare.html:120`.** One of four instructions
      explaining something the adjacent control already says. Read
      `documentation/uxreview.md` lines **509-532** (§2.6) and apply the
      replacement that names `compare.html:120`.

- [ ] **Step 6 — UX 23 (part).** If either file caps prose at anything other than
      58ch, change it to 58ch.

- [ ] **Step 7 — voice.** `web/compare.js:7` and this page's remaining prose go
      to second person, per Global Constraint 8.

- [ ] **Step 8 — verify.** `node tests/compare-core.test.js` must pass. This task
      does not touch `compare-core.js`, so a failure means Task 8's change has
      landed and disagrees with your reading of the interface above — **stop and
      reconcile**, do not edit the test.

- [ ] **Step 9 — commit.**

```bash
git add web/compare.html web/compare.js
git commit -m "phase 10: compare hidden guard, res.ok, per-tradition fractions, voice (UX20, UX26, X1, F4, F5, F1)"
```

---

## Task 5 — `/view` and `/history`

**Model: Sonnet.**

**Files:** `web/view.html`, `web/history.html`

**Findings:** UX 11, G3, E1

- [ ] **Step 1 — UX 11: `web/view.html:89`.** "Make my own map" renders
      unconditionally, including to a member reading their **own** map. Hide it
      when the viewer is the owner. For a signed-in visitor looking at someone
      else's map, relabel it **"Compare with mine"** and point it at
      `/compare?name=<that map's name>`. A signed-out visitor keeps the button
      and its current destination.

- [ ] **Step 2 — G3: `web/view.html:165`.** Empty-map detection
      substring-matches the generated class `mbox-leaf`, coupling a redirect to
      markup phase 7 was explicitly licensed to change. Replace it with a node
      count read from the rendered page's `<script id="data">` payload — parse
      the JSON and count. **Do not change the redirect's condition or its
      target**, only how emptiness is measured.

- [ ] **Step 3 — do not touch the owner redirect.** `web/view.html` deliberately
      gates its owner redirect on `res.ok`, because `/api/render` 404s an
      **unlisted** map as well as a missing one; `debug.md` §W is the write-up.
      Leave it exactly as it is. Task 7's X3 fix makes this path *less* likely to
      fire, not more.

- [ ] **Step 4 — E1: `web/history.html:116`.** `restoreVersion` uses an
      `expected_updated_at` token captured at page load and never refreshed, so
      once a 409 happens the page is **permanently** unable to restore and gives
      no hint that reloading would help. Re-`GET /api/map` inside
      `restoreVersion` to obtain a fresh token immediately before the restore
      call. If that still returns `conflict`, call `location.reload()` so the
      person sees current state rather than a dead button.

- [ ] **Step 5 — voice.** `/history` is already second person; bring `/view`'s
      prose into line, per Global Constraint 8.

- [ ] **Step 6 — commit.**

```bash
git add web/view.html web/history.html
git commit -m "phase 10: view owner button, data-payload emptiness, history token refresh (UX11, G3, E1)"
```

---

## Task 6 — `session.js` and `corpus.js`

**Model: Sonnet.**

**Files:** `web/session.js`, `web/corpus.js`

**Findings:** X4, D4/F3, D5

- [ ] **Step 1 — X4: `web/session.js:120`.** This line reads `sessionStorage` at
      **module scope** with no `try`/`catch`, while `stashNotice` twelve lines
      above wraps its *write* with one and a `/* private mode */` comment.
      `session.js` is imported by **every hosted page**, so wherever storage
      access throws — Safari with "block all cookies", some embedded webviews,
      some enterprise policies — the module fails to evaluate and **every page in
      the app renders blank**, with the failure originating in the module whose
      whole job is to degrade gracefully. Wrap it.

- [ ] **Step 2 — X4 continued: `web/session.js:16-22`.** `setUser` and
      `clearUser` are unwrapped too, so sign-in throws in the same environments.
      Wrap both. **`getUser` is already correctly wrapped — leave it.** Match
      `stashNotice`'s existing pattern and comment style; do not invent a new one.

- [ ] **Step 3 — D4/F3: `web/corpus.js:38-42`.** The 16-file, **809 KB** corpus
      is fetched **sequentially** in a `for` loop. The audience is phones and
      `decisions.md` says so; the review calls this the cheapest 800 ms in the
      product going unclaimed. Replace with `Promise.all`, preserving the
      per-file failure handling (which Step 4 then changes).

- [ ] **Step 4 — D5: `web/corpus.js:40-43`.** A missing domain file is treated as
      normal and logged with `console.info`, with a comment saying a domain phase
      5 has not written yet is the expected state. **Phase 5 is complete and all
      fourteen domains exist**, so a 404 now means a broken deploy silently
      dropping questions and denominators. On the hosted path, make it an error
      that reaches the screen through the page's `showError`. Keep the tolerant
      behaviour on the `file://` path if the module can distinguish them; if it
      cannot, error in both and rewrite the comment to say why.

- [ ] **Step 5 — verify.** `node tests/wizard-generate.test.js`. The suite loads
      the corpus through the UMD module, so this checks the corpus shape is
      unchanged, not the fetch.

- [ ] **Step 6 — commit.**

```bash
git add web/session.js web/corpus.js
git commit -m "phase 10: session storage guards, parallel corpus fetch, missing-domain error (X4, D4, F3, D5)"
```

---

## Task 7 — the API routes

**Model: Sonnet.** Read `CLAUDE.md`'s "`api/` — the six serverless functions"
section before starting. Every house rule there is load-bearing and breaking one
is silent.

**Files:** `api/render.py`, `api/auth.py`, `api/admin.py`

**Findings:** X3, A2, A1 (server half), E3, E2

- [ ] **Step 1 — X3: `api/render.py:46`.** This is the phase's one genuinely
      composite bug: three individually-correct decisions dead-ending together.
      `api/map.py:31-39` deliberately does **not** guard the `user_id` read on
      `is_public`, with a long comment explaining that guarding it "would lock an
      owner out of their own unlisted map". `api/render.py:46` **does** apply
      `is_public` to both branches, `user_id` included. And
      `web/landing.html:137`'s "My map" tile points at `/view?name=`. Result:
      unlist your map from the home page, click "My map" beside it, and you get
      *"This map is unlisted, so it does not render by name."* **No route in the
      app renders an unlisted map for its owner**, and Export HTML goes with it.

      **The fix:** apply the `is_public` check to the **`name` branch only**. The
      `user_id` branch must not check it — the id is a save-authorising secret,
      exactly as `api/map.py` documents. The current line is:

```python
if row is None or not row["is_public"]:
    return unknown_user(self)
```

      Split it so the `is_public` half applies only where `name` was the lookup
      key. **Leave a comment naming this finding and pointing at
      `api/map.py:31-39`**, in the house style — one that says what will break if
      somebody "fixes" it back.

- [ ] **Step 2 — A2: `api/auth.py:17`.** The signup POST uses
      `return=representation` with **no `select=`**, so the `pin` column enters a
      variable on the one code path that must never ship it. It is safe today
      only because the reply is constructed field by field. Add
      `&select=id,name,is_admin` to that POST — one line, and it makes the safety
      structural rather than incidental.

- [ ] **Step 3 — A1 (server half): `api/auth.py`.** A name over 60 characters
      returns a bare `500 server_error` from the database's own length
      constraint. Add an explicit length check **before** the insert returning
      `400` with a machine-readable error code and a sentence the signup form can
      display. Task 2 adds the matching `maxlength="60"`.

- [ ] **Step 4 — E3: `api/admin.py:112`.** The versions query selects `markdown`
      and never uses it, pulling the full text of twenty versions per user to
      compute integers. Delete `markdown` from that `select=`. **Only this one.**
      `api/admin.py:27`, `api/map.py:196` and `api/gallery.py:57` genuinely use
      the text they select; fixing those needs denormalised count columns and a
      migration, which this phase does not do.

- [ ] **Step 5 — E2: `api/admin.py`'s restore.** Admin restore sends no
      `expected_updated_at`, so the user's editor can undo it seconds later via
      the conflict dialog's force path — recoverable, because a force save always
      snapshots, but silent for both parties. Make admin restore pass the
      `updated_at` it read from the row as the PATCH filter, exactly the way
      `api/map.py`'s save does, so a user save landing in between returns
      `409 conflict` instead of being silently overwritten. **`web/admin.html` is
      Task 1's file** — if a copy change is needed there, put the exact sentence
      in your commit message and Task 14 will place it.

- [ ] **Step 6 — verify.** `py api/_test_lib.py` must **PASS**. It covers
      `_lib.py`'s pure helpers, which none of these edits touch — a failure means
      you edited something you should not have.

- [ ] **Step 7 — commit.**

```bash
git add api/render.py api/auth.py api/admin.py
git commit -m "phase 10: owner renders unlisted map, pin select, name length, admin select and restore token (X3, A2, A1, E3, E2)"
```

---

## Task 8 — `engine/compare-core.js`

**Model: Opus.** Finding F1 — the highest-severity item in either review, and the
one the six-hat reviewer says would most embarrass Thomas in front of his church.

**Files:** `engine/compare-core.js`, `tests/compare-core.test.js`

**Findings:** F1, F5, F7

**Produces — Task 4 consumes this:**

```js
closestTradition(...) -> {
  ranked: [ { traditionId, displayName, numerator, denominator,
              excludedCount, score, joint } ],
  enough: Boolean
}
// `joint === true` on EVERY row tied with the top row (not just ranked[1]).
// `denominatorNote` is REMOVED — the caller builds the sentence per row.
```

- [ ] **Step 1 — understand F1 before editing.** The current code at `:248-253`:

```js
ranked.sort((a, b) => b.score - a.score || b.denominator - a.denominator);

if (enough && ranked.length >= 2) {
  const gap = Math.abs(ranked[0].numerator - ranked[1].numerator);
  if (gap <= 3) { ranked[0].joint = true; ranked[1].joint = true; }
}
```

      Three defects compose here. It **sorts on `score`** (a ratio) but **breaks
      the tie on `numerator`** (a raw count) — two different scales. It **only
      ever inspects `ranked[1]`**, so a three- or four-way tie flags at most two
      rows. And `gap <= 3` is a tolerance measured in raw agreements, which means
      something entirely different on a 12-question denominator than on an
      86-question one. On a 12-belief map — the most likely state of any map in
      this church — **four traditions score 1.000 and none is flagged joint**, so
      `/compare` names Non-denominational alone, with full confidence. The
      reviewer reproduced this against the real corpus.

- [ ] **Step 2 — fix the tie detection.** Compare on **one scale**. After
      sorting, take `ranked[0].score` as the top score and set `joint = true` on
      **every** row whose score equals it — within a small epsilon for float
      comparison, **not** a raw-count tolerance. If exactly one row sits at the
      top score, no row is flagged joint and the single-tradition sentence
      applies. **Keep the existing `enough` gate exactly as it is** — it is not
      part of this finding.

- [ ] **Step 3 — F5: remove `denominatorNote`.** It describes only `ranked[0]`
      but was appended to a sentence that could name two traditions — and after
      Step 2 can name four. Every row already carries `numerator` and
      `denominator`. Delete the `denominatorNote` construction and its property
      from the returned object; Task 4 builds the phrase per named tradition.

- [ ] **Step 4 — F7: `positionsInGroup`.** It searches **every** doctrine for an
      `equivalence_group` that the corpus scopes to a single doctrine. Not
      reachable from the safety-critical path today, but the shape is wrong. Give
      it a `doctrineId` parameter and scope the search. Update its call sites
      **within this file**. If a call site lives in another file, **stop and
      report** rather than editing another task's file.

- [ ] **Step 5 — do not touch the scorecard comment.** The block at `:263`
      explaining why there is no person-vs-person scorecard stays verbatim.

- [ ] **Step 6 — verify.** `node tests/compare-core.test.js`; all 16 assertions
      must pass. **If one fails because it asserted the old `denominatorNote`
      string, update that assertion** — the field is deliberately removed. If one
      fails on tie behaviour, that is a real regression: stop and reconcile. Do
      not add new tests (out of scope).

- [ ] **Step 7 — verify against the real corpus.** Reproduce the reviewer's case
      from plain `node`, no browser, per `debug.md` rule 14: build a 12-belief
      map, call `closestTradition`, and confirm the four traditions scoring 1.000
      now all come back with `joint === true`. **Paste the output into the commit
      message.**

- [ ] **Step 8 — commit.**

```bash
git add engine/compare-core.js tests/compare-core.test.js
git commit -m "phase 10: closest tradition flags every tie on one scale, per-row fractions, scoped group search (F1, F5, F7)"
```

---

## Task 9 — `engine/editor-core.js`

**Model: Opus.** Finding B1 — silent data corruption reachable from every text
field in the wizard and the editor.

**Files:** `engine/editor-core.js` (only)

**Findings:** B1

- [ ] **Step 1 — understand the bug.** `serializeNode` at `:123-136` writes user
      text straight into a **line-oriented** file format with no neutralisation:

```js
function serializeNode(node) {
  const lines = ['## ' + headerTokens(node).join(' · ')];
  for (const key of ['hold', 'why', 'vs', 'todo']) {
    const val = (node[key] || '').trim();
    if (val) lines.push('  ' + key.padEnd(6) + val);
  }
  ...
}
```

      A newline typed into `hold` therefore **splits one belief into two nodes**,
      and the real node loses its `refs` line to the fragment. Separately, a title
      containing ` · ` is re-parsed by `headerTokens` as tier/confidence tokens.
      The reviewer reproduced both: one belief in, two nodes out.

- [ ] **Step 2 — fix `serializeNode`.** Collapse `[\r\n]+` to a single space in
      every field value before it is written. The fix is **silent** — Thomas's
      call: the person is not told their line break was flattened.

- [ ] **Step 3 — fix `headerTokens`.** Strip `·` and `|` from the title before it
      is joined into the `## ` header line.

- [ ] **Step 4 — prove it is a no-op on existing content.** The reviewer verified
      this fix changes **not one byte** of existing data. Reproduce that: run the
      round trip over `theology-map.md` and every file under `content/traditions/`
      and confirm the output is byte-identical to the input. From plain `node`,
      per `debug.md` rule 14 — this module is UMD and needs no browser, no DOM and
      no login. **Paste the result into the commit message.** If any byte moves,
      **stop**: the fix is wrong, not the data.

- [ ] **Step 5 — verify.** `node tests/wizard-generate.test.js`, then
      `py engine/render.py` (**99 nodes / 14 domains / 156 refs, 0 warnings**).
      `render.py`'s parser and `editor-core.js` are the documented lockstep pair,
      so the renderer's node count is the real check that serialization still
      round-trips.

- [ ] **Step 6 — commit.**

```bash
git add engine/editor-core.js
git commit -m "phase 10: neutralise newlines and separators in the serializer (B1)"
```

---

## Task 10 — the build and the validator

**Model: Sonnet.**

**Files:** `engine/build_traditions.js`, `engine/validate_content.py`

**Findings:** F8, F6

- [ ] **Step 1 — F8: `engine/build_traditions.js:164`.** `buildManifest`
      rebuilds **every tradition a second time** — 24 builds per run where 12
      would do. Build once, keep the results, and pass them into `buildManifest`
      rather than letting it rebuild.

- [ ] **Step 2 — verify idempotence, which is the real gate here.** Run
      `node engine/build_traditions.js`, then `git diff`. **The diff must be
      empty.** The build being genuinely idempotent is one of the five things the
      review says this program should be proud of; a non-empty diff means the
      refactor changed output and must be reverted.

- [ ] **Step 3 — F6: `engine/validate_content.py`.** `compare-core.js:99`
      hardcodes the string `'undecided'` while `wizard-generate.js:239` writes
      `open.hold || 'Undecided.'`. Inert today — all 86 doctrines use exactly
      `"Undecided."` — but nothing pins it, so a corpus edit could desynchronise
      the two silently. Add a validator rule asserting every doctrine's
      `open.hold` is exactly `"Undecided."` or absent (taking the default). Emit
      it as an **error**, not a warning: the current state passes, so this pins a
      green.

- [ ] **Step 4 — verify.** `py engine/validate_content.py` must still report
      **0 errors** (the warning count may change). Then
      `py tests/test_validate_content.py`, `py tests/check_tradition_maps.py`
      (**12 maps, 0 problems**) and `node tests/build-traditions.test.js`
      (**8 ok**).

- [ ] **Step 5 — commit.**

```bash
git add engine/build_traditions.js engine/validate_content.py
git commit -m "phase 10: build each tradition once, pin the undecided sentence (F8, F6)"
```

---

## Task 11 — `engine/editor.html`

**Model: Sonnet.** Read `CLAUDE.md`'s "The editor: one file, two storage
adapters" section first. The governing rule: **every visible string in this
file's markup is the `file://` tool's wording; anything hosted-specific belongs
in the `if (HOSTED)` branch, not in the HTML** (`debug.md` §U).

**Files:** `engine/editor.html` (only)

**Findings:** UX 7, UX 8, UX 16, UX 26 (part), UX 28, B3

- [ ] **Step 1 — UX 7: `engine/editor.html:568-570` and `:630-666`.** The hosted
      empty-map copy tells the person to press **"+ New node"** — a button that
      does not render until a domain exists, so the instruction is impossible to
      follow on a genuinely empty map. Point it at **"+ New area"** instead. Per
      §U's rule this string is hosted-specific, so make the change in the
      `if (HOSTED)` branch, not in the markup.

- [ ] **Step 2 — UX 8: the vocabulary.** Seven user-facing uses of *node* and
      *domain* survive at `:252, :324, :618, :653, :663, :717, :787, :877`,
      against `phase-3-design.md` §2.2's locked **belief** and **area** — and both
      words currently appear about 30px apart in the sidebar. Read
      `documentation/uxreview.md` lines **466-509** (§2.5) for the exact per-site
      replacement table and apply it. **Rename only user-facing text.** Variable
      names, CSS classes, data attributes and the file format's own vocabulary
      are untouched.

- [ ] **Step 3 — UX 16: `engine/editor.html:55, :64, :102, :121`.** Editor
      buttons, tabs and map-tile radios take their border from `--line` (1.36:1
      against `--panel`) where the project's own rule says interactive boundaries
      take `--field-line` (3.68:1) — Global Constraint 7. Swap the token in those
      **four rules only**. Decorative dividers keep `--line`.

- [ ] **Step 4 — UX 28: `engine/editor.html:280-282`.** The conflict dialog's
      body opens with a parenthetical sentence fragment. Replace with:

> Another tab or window saved over it. Your unsaved changes are still here.

- [ ] **Step 5 — UX 26 (part): `engine/editor.html:733`.** One of four
      instructions for something the adjacent control already says. Read
      `documentation/uxreview.md` lines **509-532** (§2.6) and apply the
      replacement that names `editor.html:733`.

- [ ] **Step 6 — B3: `engine/editor.html:1073`.** The draft-restore offer
      compares a **client clock** against a **server timestamp** to decide whether
      to offer a recovered draft, so a device with a slow clock silently never
      gets the offer. It fails safe, which is why nobody has noticed. Compare
      against the `updated_at` stored beside the draft in
      `localStorage['theologymap:draft:<name>']` instead of against `Date.now()`.

- [ ] **Step 7 — what not to touch.** Leave the autosave, conflict and escaping
      logic (roughly `:960-1105`) alone beyond the two edits above. Leave the
      hand-written nav copy alone — `CLAUDE.md` documents it as the `file://`
      exception kept in step with `web/chrome.js` by hand, **not** as drift.

- [ ] **Step 8 — voice and measure.** Second person for this file's prose per
      Global Constraint 8 — **the six locked field labels stay**. If this file
      caps prose at anything other than 58ch, change it to 58ch (UX 23).

- [ ] **Step 9 — commit.**

```bash
git add engine/editor.html
git commit -m "phase 10: editor vocabulary, empty-state copy, field-line borders, draft clock (UX7, UX8, UX16, UX26, UX28, B3)"
```

---

## Task 12 — the wizard

**Model: Opus.** The largest task in the phase — eighteen findings including four
of the UX review's five High items. The review's verdict on those four: they are
"the difference between a stranger finishing the wizard and abandoning it."

**Blocked by Task 3** (Step 14 deletes a tier-colour copy).

**Files:** `web/wizard.html`, `web/wizard.js`

**Findings:** UX 1, 3, 4, 5, 12, 13, 17, 21, 24, 26 (part), 29, 30, 31, X1,
C1 (wizard half), D2, D3, D6

Read `CLAUDE.md`'s "The UI round of 2026-08-29" section before starting — several
rules there are exactly what this task could undo by accident.

- [ ] **Step 1 — UX 1 (High): the missing third starting point.**
      `web/wizard.js:1090-1091`, `web/wizard.html:313-316`. One of Thomas's three
      **locked** first-run offers — *start from someone else's map* — is not on
      the screen a new account actually lands on. The markup exists in
      `#home-empty` and is reachable only by starting the questions and then
      abandoning them. Add a third `.wz-link` on `#screen-intro` wired to the
      existing `openPicker()`, then **delete `#home-empty` entirely** — Thomas has
      confirmed he does not want it kept as a fallback.

- [ ] **Step 2 — UX 4 (High): the answers are in the wrong order.**
      `web/wizard.html:335-376` and `:156-160`. The two escape hatches — "Ignore
      for now" and "I haven't worked this out yet" — sit **above** the answers,
      and the second wears the primary ink-on-paper fill, so on every single
      question **the loudest thing on screen is *I don't know***. Move
      `#positions` and `#custom-answer` **above** the two tiles, and give
      `#open-answer` the ordinary `.wz-card` surface instead of the primary fill.

- [ ] **Step 3 — UX 3 (High): the glosses removed on a false premise.**
      `web/wizard.js:373` vs `web/wizard.html:378-437`. `TIER_GLOSS` and
      `CONF_GLOSS` were deleted from the question screen on the stated grounds
      that the launchpad explains both scales. **The launchpad explains neither.**
      Add the one-line legend to `.wz-tier` and restore `TIER_GLOSS` as `title`
      attributes on the tier radios. Read `documentation/uxreview.md` lines
      **332-418** (§2.2) for the exact wording and the six places the scale is
      currently explained. **Keep tier and confidence as real
      `<input type="radio">` groups** — arrow-key operation and radiogroup
      semantics come from the platform, and `CLAUDE.md` forbids hand-rolling
      `role="radiogroup"`.

- [ ] **Step 4 — UX 5 (High): the "Read more" overlap.**
      `web/wizard.html:152-154`. The 44px touch-sized "Read more" button
      **overlaps the *Outside the historic creeds* note** on the three doctrines
      that carry one — including `god.trinity`, which is T1 and **asked first**,
      so it is a visible defect on the first question a stranger ever sees. Add
      `padding-right: 88px` to `.wz-outside` and `.wz-outside-note`. The geometry
      is deterministic given `position:absolute; top:8px` and the source order at
      `web/wizard.js:475-500`; the exact number of covered lines is not, so flag
      this in the commit message for Thomas's phone check.

- [ ] **Step 5 — UX 13: "I'd rather not say" is falsy.** `web/wizard.js:284,
      :1047`. The answer is stored as `''`, which is falsy, so the lens screen
      **re-asks a question the person already answered**. Thomas's call: gate on
      `getItem(...) !== null` rather than introducing a sentinel string.

- [ ] **Step 6 — UX 17: the lens screen's dead tap.** `web/wizard.html:329`,
      `web/wizard.js:1049`. The **Done** press carries no information — the choice
      is single-select and changeable afterwards from a persistent header control.
      Advance on card click and delete `#lens-next`.

- [ ] **Step 7 — UX 12: the reassurance said five times.** "Nothing is filled in
      for you" appears five times across four screens; two are the same sentence
      about the same control. **Keep the lens-screen statement.** Cut
      `wizard.html:395`, the second sentence of `:403`, and the second clause of
      `:362`. Read `documentation/uxreview.md` lines **285-332** (§2.1) if a site
      is ambiguous. **Do not cut anything §2.10 lists** (lines 593-621) — that
      section names copy that looks like fluff and is load-bearing.

- [ ] **Step 8 — UX 29: the new-tab notice.** `web/wizard.js:129-132`. The notice
      repeats in **every position's** Read-more popover as well as the doctrine's.
      Show it on the doctrine-level explainer only. **The sentence itself is a
      locked condition and its wording must not change** — this changes how often
      it renders, nothing else.

- [ ] **Step 9 — UX 24: launchpad rhythm.** `web/wizard.html:51, :399, :420,
      :432`. One flat 14px gap between every launchpad block, patched with three
      inline `margin-bottom`s. Set 26px between blocks in the stylesheet and
      delete the three inline styles.

- [ ] **Step 10 — UX 30: the header shift.** `web/wizard.html:27` vs
      `engine/theme.css:88`. The wizard's two headers use different insets, so the
      brand block jumps 4px left and 8px up on every entry into a question. Match
      `#wz-header`'s padding to `.tm-chrome`'s. **Change it here, in
      `wizard.html`** — `theme.css` belongs to Task 3 and is correct.

- [ ] **Step 11 — UX 21: a stale selector.** `web/wizard.html:240`. `#home-areas`
      now styles the stat numeral rather than the areas list, so the real list
      gets no `gap`. Rename to `#home-areas-list` and point the rule at the
      element that actually is the list.

- [ ] **Step 12 — UX 31: a wrong number.** `web/wizard.html:311` hard-codes
      `<span id="intro-count">99</span>` — the old node count. The corpus has
      **86**. JS overwrites it before display so nobody has seen it, but it is
      wrong in the file. Change to `86`.

- [ ] **Step 13 — UX 26 (part): `web/wizard.html:347` and `:352`.** Two of the
      four instructions for something the adjacent control already says. Read
      `documentation/uxreview.md` lines **509-532** (§2.6) and apply the two
      replacements naming those lines.

- [ ] **Step 14 — X1: delete the tier copy.** Remove the `:root` tier-ramp block
      at `web/wizard.html:13`. Task 3 has put the tokens in `theme.css`, which
      this page links.

- [ ] **Step 15 — C1 (wizard half): change nothing.** Leave the wizard's "Open
      questions" label and its `#study`-only definition **unchanged** — Task 2
      renames the gallery's differently-defined count to "Unsettled", so the two
      numbers are no longer invited into comparison.

- [ ] **Step 16 — D2: the fire-and-forget commit.** `web/wizard.js:110`. A
      source-link click commits without awaiting, so it can interleave with the
      Next-button commit and compute `revisit` from a model that is still
      mutating. **Reuse the existing `busy` in-flight guard** in this file — do
      not invent a second mechanism.

- [ ] **Step 17 — D3: two rules for one question.** `web/wizard.js:514`
      preselects on exact string equality where `compare-core.js:109` uses
      `normalise`. Import and reuse `CompareCore.normalise` so there is one rule.

- [ ] **Step 18 — D6: case sensitivity.** `web/wizard.js:862` compares names
      case-sensitively where `compare.js:373` lowercases. Harmless today.
      Lowercase both sides here.

- [ ] **Step 19 — voice and measure.** Second person for this file's prose per
      Global Constraint 8 — **the six locked field labels stay**. If this file
      caps prose at anything other than 58ch, change it to 58ch (UX 23).

- [ ] **Step 20 — three things not to undo.** `CLAUDE.md` documents each, and
      each is easy to break from this task:
      1. **"Ignore for now" is a third state living only in
         `localStorage['tmm.wizard.ignored']`**, wrapped in try/catch,
         deliberately not `session.js`'s key. Do not move it into the map or the
         database.
      2. **`applyAnswer`'s revisit rebuild preserves the person's own writing**
         via `answer.x !== undefined ? answer.x : (prev.x || <corpus default>)`.
         **Do not reorder `prev.x ||` ahead of the `!== undefined` test** — that
         is exactly what `tests/wizard-generate.test.js`'s second test exists to
         catch.
      3. **`domainProgress` lives in `engine/wizard-generate.js`, not here.** The
         UI decides what to ask; the pure UMD module does the model work. That
         split is what keeps the whole path runnable from plain `node`.

- [ ] **Step 21 — verify.** `node tests/wizard-generate.test.js` (all passed) and
      `node tests/refs.test.js` (all ok).

- [ ] **Step 22 — commit.**

```bash
git add web/wizard.html web/wizard.js
git commit -m "phase 10: wizard first-run offers, answer order, tier glosses, overlap, and twelve smaller items (UX1, UX3, UX4, UX5, UX12, UX13, UX17, UX21, UX24, UX26, UX29, UX30, UX31, X1, D2, D3, D6)"
```

---

## Task 13 — `engine/render.py` and the regenerated output

**Model: Sonnet.** This task **moves the documented hashes**. Read `CLAUDE.md`'s
"One render implementation, two callers" section before starting.

**Files:** `engine/render.py`, plus the three regenerated files
(`theology-map.html`, `documentation/theology-map.mm`,
`documentation/study-list.md`)

**Findings:** UX 9, UX 15, UX 27

**The gate.** Byte identity does **not** apply to a phase licensed to change the
output on purpose — this one is, for these three findings. What must hold instead
is **phase 7's gate**: `documentation/theology-map.mm` and
`documentation/study-list.md` byte-identical, and the embedded
`<script id="data">` payload hashing the same as before. Only *presentation* may
move.

- [ ] **Step 1 — capture the baseline.** Before any edit, record the SHA-256 of
      `documentation/theology-map.mm`, of `documentation/study-list.md`, and of
      `theology-map.html`'s `<script id="data">` block contents. Step 6 compares
      against these.

- [ ] **Step 2 — UX 9: tap targets in the generated map.**
      `engine/render.py:497-504`. The generated map is the surface most people
      read on a phone and it has **no control at 44px**: the view switcher is
      30.5px, reference pills 32.5px, the Filters disclosure 28px. Add a
      `min-height: 44px` line to the **existing** coarse-pointer block — do not
      create a new media query.

- [ ] **Step 3 — UX 15: the Edit link that cannot work.**
      `engine/render.py:581`. The generated map's "Edit ✎" link ships into
      `/view` **and** into the tradition maps, inviting a visitor to edit somebody
      else's map from inside a sandboxed frame where it cannot work. Remove the
      link when the document is framed — `window.self !== window.top` is the test.
      Read `documentation/uxreview.md` lines **220-243** (§1.6), which prints both
      the current and the proposed code in full.

- [ ] **Step 4 — UX 27: the offset footer.** `engine/render.py:347` vs `:415`.
      `main` is left-aligned at 1080px while `.pagefoot` centres at 1080px — a
      420px offset on a wide window. Add `margin-inline: auto` to `main`.

- [ ] **Step 5 — X1 note: keep the tier tuples.** `render.py:67-72` is the
      **legitimate** copy and stays — this file must remain a self-contained,
      double-clickable generator that links no stylesheet. Do not remove them and
      do not make it link `theme.css`. Global Constraint 6 still applies: if
      Task 3 changed a token *value* it would have to be mirrored here. It did
      not — Task 3 was a byte-for-byte move — so no change is expected.

- [ ] **Step 6 — regenerate and check the gate.** Run `py engine/render.py`.
      Confirm **99 nodes / 14 domains / 156 refs, 0 warnings**. Then compare
      against Step 1's baseline: **`.mm` and `study-list.md` must be
      byte-identical, and the `<script id="data">` payload must hash the same.**
      If any of the three moved, the change touched content and not just
      presentation — **revert and report**.

- [ ] **Step 7 — record the new hashes.** Compute the SHA-256 of the new
      `theology-map.html` both as written on Windows (CRLF) and LF-normalised.
      **Put both values in the commit message** — Task 14 writes them into
      `CLAUDE.md`. Task 1's `.gitattributes` may make the two values converge; if
      they do, say so explicitly, because that is the point of G1.

- [ ] **Step 8 — commit.**

```bash
git add engine/render.py theology-map.html documentation/theology-map.mm documentation/study-list.md
git commit -m "phase 10: 44px controls, no Edit link when framed, centred main; regenerated (UX9, UX15, UX27)"
```

---

## Task 14 — documentation

**Model: main thread.** Runs last, alone, after every other task has committed.

**Files:** `CLAUDE.md`, `debug.md`; create `docs/hosting/phase-10-outcome.md`

- [ ] **Step 1 — `CLAUDE.md`: correct the tier-ramp sentence.** It currently
      states the ramp lives in two hand-kept copies. It was **five**; after this
      phase it is genuinely **two** — `engine/theme.css` (the home) and
      `engine/render.py:67-72` (legitimate, because that file must stay
      self-contained). Rewrite the sentence so it is true, and say why `render.py`
      keeps its copy.

- [ ] **Step 2 — `CLAUDE.md`: the hashes.** Replace the two current values with
      Task 13's, and add one line to the existing blockquote recording that phase
      10 moved them and under which gate. If `.gitattributes` collapsed the two
      values into one, say so and simplify the sentence accordingly.

- [ ] **Step 3 — `CLAUDE.md`: one new section, kept short.** Thomas asked
      explicitly for minimal addition. Add **"The review round of 2026-09-04"** in
      the style of the two existing UI-round sections, containing **only what is
      easy to undo by accident**:
      - The `is_public` asymmetry in `api/render.py` is now **deliberate**: the
        `name` branch checks it, the `user_id` branch must not.
      - `--t1`…`--t4` live in `theme.css`; four copies were deleted. Do not
        reintroduce a hex literal in a `web/` file.
      - `serializeNode` neutralises newlines **silently**, verified a no-op on
        every existing byte.
      - `closestTradition` flags **every** tied row and no longer returns
        `denominatorNote`.
      - `#home-empty` is deleted; its third offer lives on `#screen-intro`.
      - **The growth marker Thomas asked for:** `/compare` still eagerly loads all
        475 KB of tradition maps. Lazy-loading the eleven non-target maps is the
        next perf move if the page gets slow.

- [ ] **Step 4 — `debug.md`: three entries only.** New lettered entries for the
      findings that were genuinely non-obvious **seams**, in the file's existing
      "index plus the lesson" format — not full narratives:
      - **X3** — three individually-correct decisions (`map.py`'s deliberate
        non-guard, `render.py`'s guard, the "My map" tile's `?name=` link)
        composing into a dead end no single file's review would find. *The lesson:
        two routes disagreeing about what one credential authorises is invisible
        from inside either route.*
      - **F1** — a sort that mixes two scales, breaks ties on a raw count, and
        inspects only `ranked[1]`, so it answers with full confidence on a
        four-way tie. *The lesson:* the review's own amendment — **what number
        does this feature say out loud, and what asserts its value on realistic
        input?**
      - **B1** — user text written unneutralised into a line-oriented format.
        *The lesson: a serializer writing user input into a format with structural
        characters needs a neutralisation step at the write, not a validation step
        at the read.*

- [ ] **Step 5 — `debug.md`: one or two new "Diagnosing a live failure" rules**
      drawn from those three. Do not restate rules already in the list.

- [ ] **Step 6 — write `docs/hosting/phase-10-outcome.md`.** Match the shape of
      `phase-9-outcome.md`. It must contain:
      - What landed, per task, with finding ids.
      - **The carry-forward list, stated plainly** — this is the point of the
        file. Every row of this plan's "Out of scope" table, plus **F9** (the
        over-applied `contested` flag: **actually check** whether phase 9 closed
        it and state the answer, rather than assuming either way), plus anything a
        task flagged.
      - The three items needing Thomas's phone check: the 38px radio compromise
        (Task 3), the `.wz-outside` overlap (Task 12), and the regenerated map's
        44px controls (Task 13).
      - Confirmation that all nine checks pass.

- [ ] **Step 7 — final gate.** Run all nine checks. Paste the results into the
      outcome file.

- [ ] **Step 8 — commit.**

```bash
git add CLAUDE.md debug.md docs/hosting/phase-10-outcome.md
git commit -m "phase 10: outcome file, CLAUDE.md and debug.md updates"
```

---

## File ownership map

Every file, its single owning task. An agent needing to edit a file it does not
own **stops and reports** instead of editing it.

| File | Task |
|---|---|
| `.gitattributes`, `tests/README.md`, `web/learn.html`, `web/admin.html` | 1 |
| `web/landing.html`, `web/gallery.html` | 2 |
| `engine/theme.css` | 3 |
| `web/compare.html`, `web/compare.js` | 4 |
| `web/view.html`, `web/history.html` | 5 |
| `web/session.js`, `web/corpus.js` | 6 |
| `api/render.py`, `api/auth.py`, `api/admin.py` | 7 |
| `engine/compare-core.js`, `tests/compare-core.test.js` | 8 |
| `engine/editor-core.js` | 9 |
| `engine/build_traditions.js`, `engine/validate_content.py` | 10 |
| `engine/editor.html` | 11 |
| `web/wizard.html`, `web/wizard.js` | 12 |
| `engine/render.py` + the three generated files | 13 |
| `CLAUDE.md`, `debug.md`, `docs/hosting/phase-10-outcome.md` | 14 |

Untouched by any task, deliberately: `api/map.py`, `api/gallery.py`,
`api/_lib.py`, `engine/wizard-generate.js`, `engine/map-view.js`,
`engine/shared-fields.js`, `web/chrome.js`, and everything under `content/` and
`supabase/`.
