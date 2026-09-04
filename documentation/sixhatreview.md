# Six-hat review — phases 3 to 9

**Ran:** 2026-09-02, on a cold cloud checkout of `main` at `545b370`. Model: Opus,
main thread only, zero subagents — for the same reason `phase-2-review.md` gives:
every finding below came from holding two files in mind at once, which is what a
cold subagent cannot do.

**Scope:** everything built since phase 2 — phases 3 (UI/gallery/first-run), 4
(wizard), 5 (corpus), 6 (learn/compare/tradition maps), 7 (generated views), 8
(version history). Phase 9 has not run; where a finding is phase 9's to fix, it
says so.

**Interpreter note:** this cloud image has no `py`. Every command below was run
with `python3` (3.11.15) and `node` (v22.22.2). On Thomas's machine they are
`py` and `node`.

**Read first, in the order the brief gave:** `CLAUDE.md`, `decisions.md`,
`run-order.md`, `phase-2-review.md`. `theology-map.html` and
`documentation/verses.md` were not opened, per the house rule.

---

## Executive summary

The architecture has held. The renderer is still one implementation, both
parsers still agree field-for-field, the tradition build is genuinely
idempotent, and phase 2's two security fixes are intact — all four verified by
running, not by reading. Nothing here needs redoing. Three things need fixing:

1. **Compare names one "closest tradition" when four are tied at a perfect
   score.** `engine/compare-core.js:248-253` sorts on a ratio and then breaks
   ties on a raw count, and only ever considers the top two rows. On a
   12-belief map — the most likely state of any map in this church — four
   traditions score 1.000 and none is flagged joint, so `/compare` names
   Non-denominational alone. Reproduced against the real corpus.
2. **The locked coverage floor gates nothing.** `validate_content.py:537` warns
   below 60%; INC (15%), Restorationist (38%) and Anabaptist (53%) trip it and
   are still full scorecard columns and rankable "closest" candidates. This is
   what makes finding 1 bite hardest.
3. **A newline typed into any wizard or editor field silently splits one belief
   into two.** `engine/editor-core.js:123-136` writes user text into a
   line-oriented format with no neutralisation. Reproduced: one belief in, two
   nodes out, and the real node loses its `refs`. One line fixes it, and the fix
   is a verified no-op on every byte of existing content.

---

# Feature A — accounts, PIN login, and the admin surface

`api/auth.py`, `api/admin.py`, `api/_lib.py`, `web/admin.html`, `web/landing.html`

## White — what exists

Two tables (`users`, `map_versions`) and six routes. Sign-up is open: name +
4–12 char PIN, no email. `_lib.row_by_name()` is still the single place a name
becomes a row, and still decides by exact case-insensitive equality in Python
after `ilike` has merely narrowed the query — phase 2's B3 fix is intact.
`require_admin` is still called once in `api/admin.py:212`, before the dispatch
table, so the two actions phase 8 added (`versions`, `restore`) inherited the
check by construction. `api/admin.py` now has seven actions, up from five.

Verified by running:

- `python3 api/_test_lib.py` → `PASS`.
- `grep` over `api/` for `pin`: five hits, all of them server-side comparison,
  the reset-PIN write, or reading the field off a request body. **No response
  body on any route contains a PIN.**
- `grep -rn is_admin api/`: reads only. **No route writes the column.**

`web/admin.html` builds the user list with `createElement`/`textContent`
throughout, so it carries no escaping obligation at all — `escapeHtml` is
correctly absent from the file.

## Red — how it feels

The admin console is the calmest screen in the app and the one I trust most.
Caching the PIN in `sessionStorage` for an already-signed-in admin
(`web/admin.html:88`) reads as a real kindness rather than a corner cut, and the
comment justifying it is honest about exactly what it is.

What still nags: **the admin's locked power to "edit any map" has no button.**
`api/admin.py`'s `save_map` has been implemented and unreachable since phase 1d,
and `web/admin.html:218-224` carries a four-line comment explaining why. That
comment is now three phases old. A power you can only exercise by hand-crafting
a POST is not a power a person has.

## Black — where it breaks

- **A1. A name over 60 characters is a bare 500.** `api/auth.py:26` handles
  exactly two outcomes — 201, and 409/`23505` for a taken name. The
  `users_name_len` check constraint (1–60) returns 400/`23514`, which falls
  through to `error(self, 500, "server_error", "Could not create the
  account.")`. `web/landing.html:96` has no `maxlength` on the name input, so a
  pasted name produces an unexplained server error on the very first screen a
  stranger sees. *Read-only judgement.*
- **A2. `_signup` fetches the PIN back and relies on discipline not to ship
  it.** `api/auth.py:17` POSTs with `Prefer: return=representation` and no
  `select=`, so PostgREST returns every column, `pin` included, into `parsed`.
  The reply is built field by field so nothing leaks today — but this is the one
  path in the repo that pulls `pin` into a variable that a careless
  `reply(self, 200, row)` would ship. The house rule ("never `select=` the `pin`
  column on any path that reaches a reply body") is satisfied in spirit and
  unenforced in structure. Adding `&select=id,name,is_admin` to that POST makes
  it impossible. *Read-only judgement.*
- **A3. `_list_users` pulls every user's full markdown to compute one integer.**
  `api/admin.py:27` selects `markdown` across all rows and uses it only for
  `len(row["markdown"])` at line 38. At the 512 KB row cap that is the whole
  database over the wire on every console load. *Read-only judgement; the cost
  is measured under Feature C, which has the same shape.*

## Yellow — what works and must survive

1. **`require_admin` before the dispatch table** (`api/admin.py:212`). Phase 8
   added two admin actions and neither could have shipped unguarded.
2. **`_pick_exact` decides, the pattern only narrows** (`_lib.py:196-205`). The
   whole ILIKE-metacharacter class stays closed, and `api/_test_lib.py` pins it.
3. **The 403 is still byte-identical** across non-admin, wrong PIN, unknown
   name, and now missing field (`_lib.py:224`, phase 2's B4 fix).
4. **`web/admin.html` branches on `err.code`, never on the message**
   (`AUTH_FAIL_CODE = 'forbidden'`, line 94). The one caller that must tell a
   wrong PIN from a network hiccup does it on the contract, not on copy.

## Green — cheapest improvements

- A1: add `maxlength="60"` to the signup name input and a `len(name) > 60` check
  in `_signup`, returning 400 `name_too_long`. Two lines.
- A2: add `&select=id,name,is_admin` to the `_signup` POST path. One line.
- A3: PostgREST can compute the length server-side; failing that, the console
  can live without `markdown_length`, which is the least-used field on the tile.
- **The admin edit button.** `/edit?as=<target_id>` was never wired. The cheaper
  shape now is not `?as=` at all: `web/admin.html` already has a working
  `save_map` action and a versions panel: a textarea in the same panel, posting
  `save_map`, closes the locked power without touching `engine/editor.html` —
  which is the file the whole program is careful not to touch.

## Blue — coherence

Phase 2's amendment was: *"what does each route trust, and who else publishes
that value?"* I asked it of every route and action added since. The answers are
clean:

| Added since phase 2 | Trusts | Who else publishes it |
|---|---|---|
| `map.py` `copy_from` | `user_id` (credential) + `source_name` (public) | name is public by design; guarded on empty-target, public-source, not-self |
| `map.py` `versions` | `user_id` | returns version ids — **not** a credential, because `_restore` filters on `id` AND `user_id` (`map.py:243`) |
| `map.py` `restore` | `user_id` + `version_id` + token | as above |
| `map.py` `set_visibility` | `user_id` | nothing publishes an id since phase 2 |
| `map.py` `GET ?name=` | nothing | returns `markdown` + `updated_at` for public rows only, and **never an id** — so the B1 pair (id + token) is not reassembled |
| `admin.py` `versions`/`restore` | name+PIN, re-verified | — |

**No route added since phase 2 reintroduces B1's shape.** That is the single
most important thing this review checked and it is clean.

---

# Feature B — the map editor and autosave

`engine/editor.html`, `engine/editor-core.js`, `engine/storage-hosted.js`, `engine/storage-local.js`

## White — what exists

One page, two adapters, chosen by `HOSTED` in `boot()`. Autosave is hosted-only:
1200 ms debounce, 15 s ceiling, flush on `visibilitychange`, `sendBeacon` on
unload. Four empty-save guards, exactly as phase 2 enumerated them, all still
present at `editor.html:971` (guard 1), `987-995` (guard 2), `api/map.py:92`
(guard 3) and `1000/1004/1071` (guard 4).

Verified by running:

- **Both parsers agree field-for-field on all 99 nodes** of `theology-map.md`
  (`render.py`'s `parse_text` vs `EditorCore.parse`): 0 disagreements across
  `title, slug, domain, tier, confidence, flags, hold, why, vs, todo, refs,
  link`.
- **Round trip is byte-exact**: `serialize(parse(src)) === src` (LF-normalised),
  and `serialize(parse(serialize(...)))` is stable.

The lockstep obligation `CLAUDE.md` describes is therefore genuinely being met,
not merely asserted.

## Red — how it feels

`engine/editor.html` is still the file phase 2's red hat said it would dread,
and it is 1120 lines now rather than ~900. It remains the only file in the repo
that cannot be exercised from a terminal, and it is still the only file that can
destroy somebody's work. Phase 2 recommended extracting its controller; phase 3
did not, and phases 4–8 all added surface elsewhere instead. That is a defensible
sequence of local decisions with a bad aggregate: the untestable file got bigger
while everything around it got test coverage.

Genuine relief, though: phase 8 quietly defused the thing that worried phase 2
most. `force: true` still walks past guards 2 and 3, but it now *always*
snapshots (`_lib.snapshot_map(user_id, force)`, and the SQL function's force
exception). The scariest path in the app became recoverable without anyone
framing it that way.

## Black — where it breaks

- **B1. A newline in any field silently splits one belief into two. [HIGH]**
  `engine/editor-core.js:123-136` writes `'  ' + key.padEnd(6) + val` with no
  neutralisation of `val`, and every writing surface — the wizard's `hold`,
  `why`, `vs`, `todo` textareas, the editor's own fields, `addManualNode` —
  accepts multi-line input. **Reproduced:**

  ```
  hold = "I hold believer baptism.\n## Secretly Injected Belief · T1 · certain\n  hold  ..."
  → serialize → parse  ⇒  2 nodes, not 1
  → and the real node's `refs` line lands on the injected node instead
  ```

  The same hole exists in the header line: a title typed as
  `Baptism · T1 · certain` round-trips to `title="Baptism", tier=T1,
  confidence=certain`. `web/wizard.js:783` already collapses whitespace in a
  *title* (`.replace(/\s+/g, ' ')`) — so the class was recognised and fixed in
  exactly one place.

  **Scope, honestly:** the corpus path is *not* affected — I verified 0 newline
  values across the corpus, `theology-map.md` and all twelve tradition maps, and
  confirmed that `tests/build-traditions.test.js`'s round-trip assertion **would**
  catch a newline introduced by a phase 9 corpus edit. It is the *user-input*
  path that is ungated, and that path only became reachable by non-technical
  strangers when the wizard shipped in phase 4.

- **B2. The conflict dialog's Overwrite is still the widest path in the app.**
  `editor.html:1058-1067` re-GETs a token and calls `flushAutosave({force:
  true})`, skipping guards 2 and 3 on the path reached in the most confused
  state. Mitigated, not closed, by the forced snapshot. *Read-only judgement.*
- **B3. `maybeOfferDraftRestore` compares a client clock to a server clock.**
  `editor.html:1073-1074`: `draft.savedAt` is `Date.now()` (browser),
  `serverTime` is `Date.parse(token)` (Postgres `now()`). A device clock a few
  minutes slow means the draft-restore offer never appears — the safety net
  silently off. It fails in the safe direction (no offer rather than a stale
  offer), which is why it is low and not medium. *Read-only judgement.*
- **B4. `beaconFlush` still has no observable result** (phase 2's B8, unchanged).
  A 409 on unload is invisible at both ends.

## Yellow — what works

1. **The adapter seam held through five phases.** `storage-hosted.js` is 109
   lines and the local path never fetches it — the dynamic import behind
   `HOSTED` is intact, and phase 3's Safari fix made it absolute rather than
   converting it to a static tag.
2. **`storage-hosted.js` still refuses `apiFetch`,** with the reason written at
   the top of the file. A vanished account leaves the draft in place
   (`handleVanishedAccount`, line 1032) instead of yanking the page away.
3. **Guard 1 is a disarm, not a check.** `handleVanishedAccount` sets
   `saveToken = null`, which `scheduleAutosave` reads at line 971 — one variable
   turns the whole scheduler off. That is a better shape than a boolean flag
   every path has to remember.
4. **Phase 8's force-always-snapshots rule retroactively insured phase 2's B8.**

## Green — cheapest improvements

- **B1 is one line**, in the one serializer this repo has:

  ```js
  // engine/editor-core.js, serializeNode()
  const val = (node[key] || '').replace(/\s*[\r\n]+\s*/g, ' ').trim();
  ```

  plus the same treatment for `node.title` in `headerTokens()`, and stripping
  ` · ` / ` | ` from a title there. I verified this is a **no-op on every byte of
  existing content** (0 affected values in the corpus, in `theology-map.md`, in
  the twelve tradition maps), so it cannot move the byte-identity hashes or the
  tradition-map diff. Collapsing a newline to a space is also exactly what
  `parse()` already does to a continuation line, so it round-trips by
  construction rather than by luck.
- Add a round-trip assertion to `tests/wizard-generate.test.js` over an answer
  containing `\n`, `## `, and ` · `. Three cases, one test, and the class stays
  closed.
- B3: use the server's own clock — compare `draft.savedAt` against the
  `updated_at` the *draft* was written beside rather than against `Date.now()`.

## Blue — coherence

The editor is the one component the program has consistently chosen not to
refactor, and every phase has been right to make that choice locally. The
aggregate cost is now visible: B1 lives in `editor-core.js`, which *is* testable
and *is* covered — but nothing tests the *composition* of "user types prose" →
"serialize" → "parse". The tests verify the round trip on data the tests
themselves construct in the shape the format expects.

---

# Feature C — the gallery and the public landing page

`api/gallery.py`, `web/gallery.html`, `web/landing.html`

## White — what exists

`GET /api/gallery` returns public rows, newest first, capped at 200, with
`name`, `updated_at`, `node_count`, `open_count`, `tier_counts` and
`started_from`. **No `id`.** `/` is the landing page and the only sign-in
screen; `/thomas` is Thomas's map; signed-in visitors get four extra tiles built
in JS (My map, History, Compare, Unlist/Relist).

Verified by running: `api/gallery.py:57` now carries `limit=200`, which closes
phase 2's G7 — `decisions.md`'s 200-row ceiling was a decision nobody had
implemented, and now it is implemented.

## Red — how it feels

The gallery card is the best-designed object in the product. A tier bar, a
count, an open-question count, a relative time, and "Started from Sarah's map"
when it applies — it says exactly as much about a person as the brief permits
and no more. The skeleton rather than a spinner (`gallery.html:13-23`, citing
phase 2's own latency measurement) is the kind of thing that only happens when
somebody read the previous review.

## Black — where it breaks

- **C1. Two different numbers are both called "open questions". [LOW]**
  Measured on `theology-map.md`: `api/gallery.py:40` (`#study` **or**
  `confidence == 'open'`) gives **36**; `web/wizard.js:620` (`#study` only) gives
  **33**. `api/gallery.py:37-39` explicitly instructs that this definition be
  shared ("Phase 6 must use this same definition"), and the wizard does not.
  **Mitigated** by honest labelling — `web/wizard.html:383` reads "still open,
  flagged #study", so the launchpad is not lying, it is answering a different
  question with the same word. *Verified by running.*
- **C2. `/api/gallery` pulls every public map's full markdown on every
  unauthenticated page load.** `api/gallery.py:57` selects `markdown` for up to
  200 rows purely to count it. Measured parse cost alone: **0.2 s** for 200
  Thomas-sized maps, **4.1 s** for 200 rows at the 512 KB cap — and that is CPU
  only, on top of ~100 MB of PostgREST transfer in the worst case. Not a live
  problem for one church; it is the ceiling behind the 200-row cap, and the cap
  is the only thing holding it. *Verified by running.*
- **C3. `web/gallery.html:42-45` is a fourth hand-written copy of the tier
  ramp**, as raw hex in a JS object, where `wizard.js`, `learn.js` and
  `compare.js` all use `var(--t1)`. See the whole-application section — this is
  one instance of a five-copy problem.

## Yellow — what works

1. **`api/gallery.py` returns the minimum and says so in a comment that names
   the bug it is preventing.** Every phase since 1d has wanted to add a field.
2. **`started_from` is resolved without a second round trip or a self-join**
   (`gallery.py:66`), and a source that has since been unlisted simply goes
   unnamed rather than erroring.
3. **The parse failure is scoped to one row** (`gallery.py:75-81`), with a
   comment explaining why a whole-gallery failure is a different bug that
   already failed loudly at import.
4. **The import-time `parse_text` binding** (`gallery.py:21`) is the trap-turned-
   guard, and it works: my own verification script hit the two-modules-called-
   `render` trap live when I put `api/` on `sys.path` before `engine/`, and got
   an `AttributeError` rather than silent zeros.

## Green — cheapest improvements

- C1: export one `openCount(nodes)` helper — but it cannot be shared across the
  Python/JS boundary, so the honest fix is to make the wizard read
  `open_count`'s definition from `api/gallery.py`'s comment and match it, or to
  rename one of the two labels so no reader can compare them.
- C2: `node_count`/`open_count`/`tier_counts` are derivable at write time. That
  is a schema change and therefore stops and waits — recorded, not started.

## Blue — coherence

The gallery is the one place phase 2's lesson visibly changed behaviour: the
comment at `gallery.py:46-56` is a phase-2 finding written into the code at the
site that caused it. That is the right place for it.

---

# Feature D — the wizard

`web/wizard.js`, `web/wizard.html`, `engine/wizard-generate.js`, `content/wizard/*.json`

## White — what exists

Fourteen domains, **86 doctrines, 250 positions, 51 `tradition_overrides`**,
fourteen traditions of which twelve are `in_scorecard`. Verified by running
`python3 engine/validate_content.py`: **0 errors, 31 warnings, exit 0**, plus
the coverage matrix. The 31 warnings are 25 positions with no `held_by`, 4
doctrines with thin `refs`, and 3 thin-tradition coverage warnings.

`node tests/wizard-generate.test.js` → all passed, including "the real corpus
loads, and every domain file on disk is in it" and "answering the whole seed
corpus gives a map at every prefix".

Answer kinds: `position`, `open`, `custom`, plus `addManualNode` and the
browser-local "Ignore for now" third state.

## Red — how it feels

This is the feature that justifies the whole hosted program, and the question
screen is genuinely good — the position's own description *is* the editable
field, the glosses are gone, and "I haven't worked this out yet" is a real tile
rather than a skip. The launchpad's four stats and the per-area rows are the
right amount of structure.

The thing that made me uneasy: **the wizard writes prose straight into a
line-oriented file format** and the only place that recognises the danger is the
title (`wizard.js:783`). Every other textarea on that screen is a `<textarea>`
with `rows="2"`–`"5"`, which is an invitation to press Enter. See B1.

## Black — where it breaks

- **D1. B1 is reachable here by anyone.** The `hold` textarea is
  `wizard.js:489-491` (`rows = 5`); `why`/`vs`/`todo` are `textField(..., 2)`.
  Nothing between them and `Core.serialize(domains)` at `wizard.js:817` and
  `953`. This is the single highest-value fix in the review.
- **D2. `citeLink` commits fire-and-forget while the person is mid-answer.**
  `wizard.js:110`: `a.addEventListener('click', () => { if (chosen)
  commit(currentAnswer()); })` — unawaited. `commit` mutates `domains` via
  `applyAnswer` and may retry on a 409. If the person clicks a source and then
  immediately clicks Next, two `commit` calls interleave, the second computing
  `revisit` from a `domains` the first is still mutating. The locked decision
  (save before the tab opens) is right; the implementation needs the same
  in-flight guard `postMap` callers have elsewhere. *Read-only judgement.*
- **D3. Two rules for "which position produced this node".**
  `wizard.js:514` preselects on `existing.hold === position.hold` — exact string
  equality. `engine/compare-core.js:109` resolves the same question through
  `normalise` (lowercase, collapse whitespace, one trailing full stop, one layer
  of quotes). A hold differing only by a trailing space resolves to "agree" on
  `/compare` and preselects nothing in the wizard. `CompareCore.normalise` is
  exported and the wizard already loads `compare-core.js` nowhere — importing it
  is the fix, or extracting `normalise` to the shared module both can reach.
  *Read-only judgement.*
- **D4. `web/corpus.js:38-42` fetches the corpus sequentially.** Sixteen files,
  **809 KB measured**, one `await` per loop iteration. `web/compare.js:427`
  correctly uses `Promise.all` for its twelve tradition maps; the corpus loader
  does not. On a phone on mobile data that is sixteen serial round trips before
  the wizard paints anything, for an audience `decisions.md` describes as "his
  church, people he will send the link to by name". *Verified by running (size);
  read-only (the sequencing).*
- **D5. A missing domain file is still tolerated as normal.**
  `web/corpus.js:40-43` logs `console.info` and continues; `validate_content.py`
  rule 2 warns rather than errors. That was correct while phase 5 was
  outstanding. Phase 5 is complete and all fourteen files exist, so a 404 now
  means a broken deploy — and it would silently drop that domain's questions
  from the wizard, from `/learn`, and from every compare denominator, with
  nothing on screen. *Read-only judgement.*
- **D6. `openPicker` compares names case-sensitively.** `wizard.js:862`
  (`m.name !== user.name`) where `compare.js:373` uses `.toLowerCase()`. Names
  are unique on `lower(name)`, so the two differ in principle; harmless in
  practice because both sides come from the same stored string. *Read-only.*

## Yellow — what works

1. **`domainProgress`/`nextDoctrine` live in the pure module, not the UI**
   (`wizard-generate.js:129,160`), which is what keeps the whole
   content-to-markdown path runnable from plain `node` in a program that bans
   browser verification. This rule has held through three phases of pressure.
2. **The revisit fix is real and pinned in both directions.**
   `wizard-generate.js:242-275`'s `answer.x !== undefined ? answer.x : (prev.x
   || corpus || '')` chain preserves a hand-written `todo` and `link` while
   keeping explicit-clear semantics, and `tests/wizard-generate.test.js` holds
   both halves.
3. **`_intendedLinks` is a de-duplicated union, not a replacement**
   (`wizard-generate.js:289`), so links a person wrote by hand survive a
   wizard revisit.
4. **`pruneLinks` before every serialize** — `wizard.js:816` and `952` both do
   it, and `addBelief`'s rollback path does it again after removing the node.
5. **`addBelief` rolls the model back when the POST fails**
   (`wizard.js:824-830`) rather than leaving the screen lying about what saved.
6. **`commit`'s 409 path re-reads and re-applies one answer, and never
   force-saves** (`wizard.js:968-973`). That is the right call and the opposite
   of the editor's Overwrite.

## Green — cheapest improvements

- D4: `Promise.all(manifest.domains.map(e => get(e.file)))` in
  `web/corpus.js`. Four lines, and it is the largest single latency win
  available anywhere in the app.
- D5: make a missing domain file an error on the hosted path now that phase 5
  is complete — or at minimum surface it with `showError` rather than
  `console.info`.
- D2: reuse the `busy` flag that `addBelief` and `openPicker` already use.

## Blue — coherence

The wizard is the best-governed feature in the repo: model logic in the pure
module, UI in `web/`, a real test suite, and a documented rule about which is
which that has actually been obeyed. Its two weaknesses are both at the *edges*
it shares with other components — the serializer below it (D1) and the corpus
loader beside it (D4) — which is precisely the pattern phase 2's blue hat named:
*not one of this program's bugs has been inside a function.*

---

# Feature E — version history and restore

`supabase/migrations/20260823170000_map_versions.sql`, `api/map.py` (`versions`/`restore`), `api/admin.py`, `web/history.html`

## White — what exists

`map_versions(id, user_id, markdown, saved_at)`, RLS on with no policies, one
index on `(user_id, saved_at desc)`. The throttle (one per user per hour) and
the retention (last 20) live in the SQL function `public.snapshot_map`, not in
`api/`, so the call sites cannot drift. `execute` is revoked from `public` and
granted to `service_role` only — correct for a public repo.

Four write paths to `users.markdown` exist: `map.py`'s `_save_map` and
`_restore`, and `admin.py`'s `_save_map` and `_restore`. All four snapshot; the
two restores force. A fifth writer, `map.py`'s `_copy_from`, does **not**
snapshot — correctly, because it refuses to run unless the target map is empty
(`map.py:149`). `CLAUDE.md` names only two of these five paths; the code is right
and the doc is incomplete.

Neither `versions` route ever returns `markdown` (`map.py:182`, `admin.py:102`).

## Red — how it feels

This is the phase that made the rest of the app safe, and it is almost invisible
— which is right. The one confirmation dialog in the product is here, and
`history.html:100-101` says in a comment why it earns its place when the house
style is not to ask. That is the correct amount of ceremony.

## Black — where it breaks

- **E1. The Restore button uses a token captured at page load, and never
  refreshes it. [MEDIUM]** `web/history.html:49` fetches `/api/map` once, and
  `restoreVersion` at line 116 sends `expected_updated_at: map.updated_at` from
  that first fetch. Leave `/history` open in one tab while the editor autosaves
  in another — or simply leave it open — and every Restore click returns 409
  `conflict`, `apiFetch` shows "This map was changed somewhere else", `btn.disabled
  = false`, and the stale token stays stale. **The page never recovers**;
  `location.reload()` only runs on success, so the user must work out for
  themselves that reloading fixes it. The history page is exactly the page a
  person leaves open while poking at their map. *Read-only judgement.*
- **E2. An admin restore can be undone by the user seconds later, silently.**
  `api/admin.py:155` PATCHes with no `expected_updated_at` (deliberate — admin
  bypasses optimistic concurrency). The user's open editor then autosaves
  against a now-stale token → 409 → conflict dialog → **Overwrite** →
  `force: true` → the admin's restored map is replaced. It is *recoverable*,
  because the force save snapshots first, but neither party is told anything
  happened. *Read-only judgement.*
- **E3. `_versions` fetches up to 20 × 512 KB of markdown to compute
  `node_count`.** `api/map.py:196` selects `markdown` and line 208 parses it;
  the markdown never leaves the function, which is the point, but up to 10 MB
  crosses the PostgREST hop for a list of integers. The admin half
  (`admin.py:112`) has the same select and does not even use it — it computes
  only `bytes`. *Read-only judgement.*
- **E4. 20-row retention has still never been verified**, per
  `run-order.md`; it needs 21 saves an hour apart. Unchanged, and correctly
  declared. I did not verify it either — no database access from this session.

## Yellow — what works

1. **The two rules live in SQL, not in Python.** Two call sites, one
   implementation, one round trip on a path autosave hits constantly.
2. **A version id is not a credential**, and the check that keeps it from
   becoming one is filtering on `id` **and** `user_id` in both restores
   (`map.py:243`, `admin.py:145`), with a comment saying so at the first.
3. **`snapshot_map` swallows every failure and the route reports
   `snapshotted` anyway** (`map.py:105,124`). Losing a snapshot never costs a
   save, and the migration stays verifiable from outside — a genuinely
   thoughtful resolution of two requirements that pull opposite ways.
4. **Restoring forces a snapshot**, so the undo is undoable.

## Green — cheapest improvements

- E1: re-`GET /api/map` inside `restoreVersion` before posting — one extra round
  trip on a deliberate, confirmed action. Or, cheaper still, `location.reload()`
  in the catch when `err.code === 'conflict'`.
- E3: drop `markdown` from `admin.py:112`'s select entirely (it is unused), and
  for `map.py`, either accept the cost or drop `node_count`, which
  `history.html:84` already treats as optional.
- Update `CLAUDE.md` to name all five write paths and say why `copy_from` is the
  one that does not snapshot.

## Blue — coherence

Phase 8 is the tidiest phase in the program: no schema change, two route
actions, two small surfaces, and it retroactively insured a risk phase 2 had
flagged and phase 3 had declined to fix. Pulling it ahead of phase 5 was right.
Its one loose end (E1) is a client-side token-freshness bug of exactly the kind
that a browser-verification ban makes hard to catch — which is worth saying
plainly rather than treating as an oversight.

---

# Feature F — learn and compare

`web/learn.*`, `web/compare.*`, `engine/compare-core.js`, `engine/build_traditions.js`, `content/traditions/`

## White — what exists

Twelve generated tradition maps, **698 nodes**, plus `manifest.json` carrying
`corpus_sha256` (not a timestamp), `node_count` and `skipped` per tradition.
`/learn` works signed out; `/compare` requires an account.

Verified by running:

- `node tests/compare-core.test.js` → **16 checks, all pass**, including
  "normalise strips exactly four things and nothing else".
- `node tests/build-traditions.test.js` → **8 checks, all pass**.
- `python3 tests/check_tradition_maps.py` → 12 maps, **0 problems**.
- **`node engine/build_traditions.js` on the committed corpus leaves `git diff`
  completely empty.** The idempotence claim is not just gated in a test — it
  holds on the actual repository state. The on-disk maps that `/compare` and
  `/view?tradition=` serve are exactly what the corpus builds.

Coverage, measured from `content/traditions/manifest.json` against 86 doctrines:

| Tradition | Nodes | % of 86 |
|---|---|---|
| Reformed | 82 | 95.3% |
| Baptist | 81 | 94.2% |
| Roman Catholic | 76 | 88.4% |
| Non-denominational | 75 | 87.2% |
| Orthodox | 62 | 72.1% |
| Anglican | 61 | 70.9% |
| Pentecostal | 59 | 68.6% |
| Lutheran | 57 | 66.3% |
| Methodist | 53 | 61.6% |
| **Anabaptist** | **46** | **53.5%** |
| **Restorationist** | **33** | **38.4%** |
| **INC** | **13** | **15.1%** |

## Red — how it feels

`/learn` is the surface I would send a stranger to, and the tier chip saying
**suggested** with a legend and a `tier_note` is the difference between a
reference and a verdict. Somebody thought hard about that.

`/compare` made me uneasy immediately and it took a while to name why. The
copy is scrupulous — no percentages, no grades, the denominator stated in words,
no person-vs-person score — and then the number underneath it is doing something
the copy does not describe. Comparing "12 of 12" against "4 of 4" and picking a
winner is not a description; it is a comparison of two ratios over incomparable
denominators, and the smaller denominator wins ties by being smaller.

## Black — where it breaks

- **F1. `closestTradition` names one winner when several are tied. [HIGH]**
  `engine/compare-core.js:248-253`:

  ```js
  ranked.sort((a, b) => b.score - a.score || b.denominator - a.denominator);
  if (enough && ranked.length >= 2) {
    const gap = Math.abs(ranked[0].numerator - ranked[1].numerator);
    if (gap <= 3) { ranked[0].joint = true; ranked[1].joint = true; }
  }
  ```

  Two independent defects in four lines:

  1. **The sort key is a ratio; the tie predicate is a raw count.** Different
     scales.
  2. **Only `ranked[0]` and `ranked[1]` are ever considered.** An N-way tie
     collapses to at most two, and which two is decided by sort order among
     equal scores.

  **Reproduced against the real corpus and the real generated maps.** A map of
  the first 12 beliefs of the Non-denominational map — a very plausible state
  for a church member who has done one wizard sitting:

  ```
        Non-denominational evangelical     12/12   score=1.000
        Pentecostal / Charismatic           8/8    score=1.000
        Restorationist / Churches of Christ  6/6   score=1.000
        International Network of Churches   4/4    score=1.000
        Anabaptist / Mennonite              7/8    score=0.875
        ...
  traditions scoring 1.000: 4      flagged joint: 0
  ```

  `gap = |12 − 8| = 4 > 3`, so nothing is flagged, and `web/compare.js:181-192`
  falls to `[closest.ranked[0]]` and prints *"This tradition's answers are
  nearest to mine: **Non-denominational evangelical**. agrees with 12 of the 12
  questions where both have a position."* Every word of that sentence is true
  and the conclusion is wrong: three other traditions agree with this person on
  everything they have answered.

  The mirror case is worse. Given the INC map itself as input, all of
  Non-denominational, Pentecostal, INC and Restorationist score 1.000 — and
  **INC is not among the two flagged joint**. A member of Thomas's own movement,
  answering exactly as INC does, is told they are closest to something else.

- **F2. The locked coverage floor is defined, measured, reported and enforced
  nowhere. [HIGH]** `decisions.md` locks "a coverage floor gates publishing a
  thin tradition map under a real communion's name".
  `engine/validate_content.py:537` implements the measurement and warns below
  60% — INC, Restorationist and Anabaptist all trip it, confirmed in the
  validator output. `web/corpus.js:47-49` says `node_count` and `skipped` are
  carried "so a coverage floor can be applied without reloading and re-deriving
  anything". **Nothing applies one.** A `grep` for every use of `node_count`
  across `web/` and `engine/` finds only display text — `compare.js:346` prints
  "13 beliefs mapped" on the picker card and that is the whole of it. So INC, at
  15% coverage, is a full scorecard column, a rankable "closest tradition", and a
  denominator that can beat a tradition with six times its coverage. *Verified by
  running.*

  These two are one problem with two mechanisms, and F2 is what makes F1 fire on
  realistic data rather than on a contrived edge case.

- **F3. `/compare?tradition=` fetches ~1.3 MB before it can paint.**
  Measured: 809 KB of corpus (16 files, sequential — see D4) plus 475 KB of
  tradition maps (twelve, correctly parallel at `compare.js:427-432`) plus the
  target map. It is the heaviest page in the product by an order of magnitude,
  and it is the flagship of the phase. *Verified by running (sizes).*
- **F4. Tradition-map fetches have no `res.ok` check.** `compare.js:399` and
  `:430` are both `await (await fetch(...)).text()`. A 404 returns Vercel's HTML
  error page, `Core.parse` finds no `# ` or `## ` lines, and the result is an
  empty map — which compare renders as *"This tradition takes no position on
  it"* on all 86 rows, with no error anywhere. `web/view.html:100` does the same
  fetch inside a `try/catch` that produces a real message; `compare.js` does
  not. *Read-only judgement.*
- **F5. The denominator note describes only `ranked[0]`.** `compare-core.js:255`
  builds `denominatorNote` from `ranked[0]`, and `compare.js:194` appends it to a
  sentence that may have just named two traditions. A joint pair with different
  denominators gets one tradition's fraction attached to both names. *Read-only.*
- **F6. `compare-core.js:99` hardcodes the string `'undecided'`** as the
  open-answer sentinel, while `wizard-generate.js:239` writes `open.hold ||
  'Undecided.'`. Inert today — I checked all 86 doctrines and every one has
  `open.hold` exactly `"Undecided."` — but the schema permits bespoke wording,
  and the day one is written, that doctrine's "I don't know" answers start
  resolving as `own-wording` instead of `undecided` in every diff and every
  denominator. `validate_content.py` does not pin the string. *Verified inert by
  running; the risk is a read-only judgement.*
- **F7. `positionsInGroup` searches every doctrine for an
  `equivalence_group`** (`compare-core.js:192-201`). The file's own comment
  admits the group string is only meaningful within one doctrine, and argues the
  safety-critical use in `verdictFor` cannot cross doctrines — which is correct.
  But this exported helper can, and nothing prevents a future caller from using
  it as though it were scoped. *Read-only judgement.*
- **F8. `buildManifest` rebuilds every tradition a second time.**
  `build_traditions.js:164` calls `buildTradition` inside the manifest map,
  after `main()` at line 183 already built and wrote each one. Twenty-four builds
  per run. Harmless, and free to fix. *Read-only judgement.*
- **F9. `/learn` labels 80 of 250 positions "Contested".**
  `learn.js:192-197` renders a marker for any position with an
  `orthodoxy_note`, and all 80 `contested` positions have one.
  `phase-5-outcome.md` already warned that `contested` is over-applied and
  "should not be leaned on"; `/learn` leans on it as a visible banner. Counted by
  running. This is corpus work and therefore **phase 9's**, not a code fix.

## Yellow — what works, and must not be undone

1. **The build is genuinely deterministic and idempotent**, verified on the real
   repo and not merely in a fixture. A phase 9 corpus fix will show up as
   exactly the lines it changed. The decision to hash the inputs rather than
   stamp a clock is what buys this.
2. **`normalise` strips exactly four things**, and
   `tests/compare-core.test.js` pins it directly — because, as
   `phase-6-outcome.md` records, a strip-all-punctuation mutation passed every
   other test in the file. That test is the most valuable single assertion in
   the repo.
3. **There is no person-vs-person scorecard**, and the omission is defended in
   comments at three separate sites (`compare-core.js:263-267`,
   `compare.js:438-441`, `CLAUDE.md`). A later session will find the missing
   symmetry and want to add it. It must not.
4. **`tierDiff` measures against the corpus, not against other members**, and the
   comment at `compare-core.js:305-318` explains why an aggregate over a handful
   of accounts would be noise dressed as a finding — and would be a judgement
   about a person. Two tests pin the baseline.
5. **`findNode` joins on slug and domain, never on wording**
   (`compare-core.js:123-135`), with an `Array.isArray` guard that names the bug
   it fixed.
6. **`resolvePosition` reports `own-wording` honestly** rather than guessing,
   and `compare.js:163-177` has *different copy* for a hand-written map than for
   a thin one — "73 of 86 rows own-wording", verified against Thomas's own map by
   whoever wrote it. That is a rare piece of care.
7. **`superseded_holds` is read on both the position and the override path**
   (`compare-core.js:83,108`), so phase 9 can reword without orphaning maps.

## Green — cheapest improvements

- **F1, minimal fix:** compare on the same scale, and flag every row tied with
  the top, not just the second:

  ```js
  const top = ranked[0].score;
  const near = r => top - r.score <= 0.05;         // one scale, not two
  const tied = ranked.filter(near);
  if (enough && tied.length > 1) for (const r of tied) r.joint = true;
  ```

  and have `renderClosest` print each named tradition's *own* fraction (fixing
  F5 at the same time).
- **F1/F2, the real fix:** require a minimum denominator before a tradition is
  rankable at all. The floor already exists as a number
  (`validate_content.py:537`'s 60%) and the data already ships
  (`manifest.json`'s `node_count`). Excluding sub-floor traditions from
  `closestTradition`'s ranking — while keeping them as scorecard columns and as
  explicit picker targets — implements the locked decision with about ten lines
  and no schema change. It also answers phase 5's own hand-off note that "the
  thin-tradition coverage floor bites there first".
- F4: `if (!res.ok) throw new Error(...)` at both sites, matching `view.html`.
- F3/D4: `Promise.all` in `web/corpus.js`, and consider fetching the eleven
  non-target tradition maps only when the scorecard section is actually
  rendered.
- F6: add a validator rule pinning `open.hold` to `"Undecided."`, or have
  `resolvePosition` compare against the doctrine's own `open.hold` rather than a
  literal.

## Blue — coherence

Phase 6 is architecturally the best work in the program — one engine, two
surfaces, a pure UMD module runnable from `node`, and a build whose idempotence
is proven rather than asserted. Its failure is not in any of that. It is that
**the one number the engine produces that a person will actually repeat out loud
— "I'm closest to X" — is the least-tested thing in it.** The suite has sixteen
checks and not one of them asserts *which* tradition comes back closest for a
realistic partial map; the closest it gets is "a tradition map is closest to
itself", which is true for four traditions at once in the INC case and passes
anyway.

That is the same seam-shaped failure phase 2 diagnosed, one level up: the
components are individually correct and the composition is not checked.

---

# Feature G — the renderer and the generated views

`engine/render.py`, `theology-map.html`, `documentation/theology-map.mm`, `documentation/study-list.md`

## White — what exists

One renderer, two callers. `render_markdown(markdown, verses)` is pure;
`main()` is the file wrapper; `api/render.py:49` calls the pure function. Four
views. `python3 engine/render.py` reports **99 nodes across 14 domains, 33
`#study`, 0 `#assumed`, 156 references, 0 without text**, zero warnings.

Verified by running:

- **Byte identity holds exactly.** `render_markdown` on `theology-map.md`,
  LF-normalised, hashes to
  `0125f4df6710946d80b2ca03314e71823dfd9f1b450df69c7a69384981863767` — character
  for character the baseline `CLAUDE.md` records.
- **Phase 2's stored-XSS fix is intact.** `POST`-equivalent render of a map whose
  node title contains `</script><script>alert(document.domain)</script>`
  produces `</script><script>...` in the payload; the raw sequence does
  not appear. `render.py:271`.
- **`data-goto` is `esc()`'d** (`render.py:751`), alongside every neighbouring
  interpolation.

## Red — how it feels

The generated map is the artefact the whole project exists to produce, and it
still opens by double-click with no network. Phase 7's field labels — *What I
hold, Why, What I'd reject, Still working out, Texts, Related* — reading the
same in the generated views as in the editor is the kind of consistency users
notice without being able to name.

## Black — where it breaks

- **G1. The generated files are committed with CRLF and there is no
  `.gitattributes`. [MEDIUM]** Measured: the committed `theology-map.html` has
  **1021 CRLF** pairs; regenerating with `python3 engine/render.py` on Linux
  produces **0**. Same for `theology-map.mm` (328) and `study-list.md` (131). All
  three are byte-identical after LF-normalisation — the *content* is correct;
  only the line endings move.

  The consequence is that **any session that regenerates on Linux — every cloud
  session, and any future CI — produces a ~1500-line diff across three files that
  contains no content change at all**, and committing it would flip them to LF,
  after which Thomas's next Windows run flips them back. The project has already
  paid for this: `CLAUDE.md` maintains *two* hashes per baseline, CRLF and LF,
  and has had to move them three times.

  It is worth naming this against `build_traditions.js`'s explicit design goal —
  *"do not put a clock or any other varying value into a generated file… a real
  correction shows up as exactly the lines it changed"*. The tradition pipeline is
  protected against spurious diffs by construction. The render pipeline is
  protected by two hand-maintained hashes in a markdown file. *Verified by
  running.*
- **G2. The tier ramp is hand-copied five times and `engine/theme.css` has none
  of it.** See the whole-application section below.
- **G3. `web/view.html:165` detects an empty map by substring-matching
  `'mbox-leaf'` in the rendered HTML.** That class is generated markup
  (`render.py:993`) in a file phase 7 was explicitly licensed to restyle. If a
  future restyle renames it, every owner clicking "My map" is redirected to
  `/wizard` regardless of how full their map is. The comment at lines 156-164
  justifies the round-trip saving; it does not note the coupling. *Read-only.*

## Yellow — what works

1. **One renderer, two callers — still true, and still the most valuable thing
   in the codebase.** Phase 7 restyled inside `render_html` rather than adding a
   second renderer for the hosted case, exactly as phase 2's yellow hat demanded.
2. **Byte identity survived a restyle, using the right gate.** Phase 7 correctly
   recognised that byte identity does not apply to a phase that changes output on
   purpose, and substituted three artefacts that prove only presentation moved.
3. **`ship-only-cited-verses`** (`render.py:256`) keeps the hosted response from
   carrying the whole corpus's scripture text — 415 references in `verses.md`,
   156 cited, and only the 156 ship.
4. **`card()` and `mboxHTML()` share one `detailRows()` builder**, so the field
   labels cannot drift between the two view families again.

## Green — cheapest improvements

- G1: a three-line `.gitattributes`:

  ```
  theology-map.html            text eol=crlf
  documentation/theology-map.mm text eol=crlf
  documentation/study-list.md   text eol=crlf
  ```

  (or `eol=lf` throughout — either is fine, *pick one*). This makes the
  regenerate-anywhere diff empty, and lets `CLAUDE.md` carry one hash instead of
  two. It rewrites committed bytes once, which touches generated files, so it is
  Thomas's call rather than a session's.
- G3: check the embedded `<script id="data">` payload's `nodes` array length
  instead of a CSS class name — same round trip, no coupling to presentation.

## Blue — coherence

Phase 7 did the hardest thing well: it changed the look of the one file with a
byte-identity gate, and proved it had changed *only* the look. The process
lesson worth keeping is the substitution it made — when a gate cannot apply,
name three other artefacts that must not move and check those instead. That
technique is reusable and should be written down where the next restyle will
find it.

---

# The whole application — rolled up

## White

- **~10,600 lines** across `api/` (1,146 Python), `engine/` (2,700 Python +
  1,700 JS), `web/` (3,300), `tests/` (~800).
- **Nine runnable checks. I ran all nine; all nine pass.**

  | Command | Result |
  |---|---|
  | `python3 engine/validate_content.py` | 0 errors, 31 warnings, exit 0 |
  | `node tests/compare-core.test.js` | 16 ok |
  | `node tests/build-traditions.test.js` | 8 ok |
  | `node tests/wizard-generate.test.js` | all passed |
  | `node tests/refs.test.js` | all ok |
  | `python3 tests/check_tradition_maps.py` | 12 maps, 0 problems |
  | `python3 tests/test_validate_content.py` | OK |
  | `python3 api/_test_lib.py` | PASS |
  | `python3 engine/render.py` | 99 nodes / 14 domains / 156 refs, 0 warnings |

  Plus three checks of my own: byte-identity hash (exact match), parser lockstep
  (0 disagreements over 99 nodes), and `node engine/build_traditions.js` (empty
  `git diff`).
- Zero third-party dependencies. `requirements.txt` is still 0 bytes.

## Red

The product is in much better shape than a six-hat review's finding list makes
it sound. The two things that would actually embarrass Thomas in front of his
church are both in `/compare`, and both are about *confidence*: the page speaks
with more certainty than its arithmetic supports (F1), about traditions it does
not have enough data on (F2). Everything else on the list is smaller than that.

The second feeling, harder to shake: **the parts of this system that are tested
are excellent, and the parts that aren't are where every finding lives.**
`compare-core.js`, `wizard-generate.js`, `editor-core.js`, `build_traditions.js`
and `_lib.py` all have suites, and all five are clean. `web/*.js`,
`engine/editor.html` and the composition *between* tested modules have none, and
that is where B1, D2, E1, F1, F4 and F5 all sit. The browser-verification ban is
right, but it has been read as "the browser layer cannot be tested" when much of
what is wrong there is pure logic that could run under `node` today — F1 is four
lines of arithmetic and I reproduced it from the command line in about a minute.

## Black — what is only wrong in aggregate

- **X1. Five hand-maintained copies of the tier ramp, and the file documented as
  their home has none of them.** `CLAUDE.md` states the ramp lives in two
  hand-kept copies (`render.py`'s embedded `:root` and `engine/theme.css`).
  Measured, the six hexes appear in:

  | Location | Form |
  |---|---|
  | `engine/render.py:67-72` | Python tuples (legitimate — the file must be self-contained) |
  | `web/wizard.html:13` | `:root` block |
  | `web/learn.html:13` | `:root` block |
  | `web/compare.html:11` | `:root` block |
  | `web/gallery.html:43-44` | **JS object of raw hex** |

  and **`engine/theme.css` defines none of them.** All five currently agree, so
  this is a maintenance hazard rather than a live bug — but it is five, not two,
  and the documented single source of truth is not among them. Every `web/*.html`
  already links `theme.css`; moving `--t1`…`--t4` there deletes four copies and
  makes `CLAUDE.md`'s existing sentence true.

- **X2. Everything with a test suite is clean; everything without one holds
  every finding.** Not one finding in this review is inside a function that has a
  test. This is phase 2's blue-hat lesson restated a level up: the seams have no
  owner, and now they also have no harness.

- **X3. An owner cannot see their own unlisted map.** Three correct local
  decisions compose into a dead end:
  - `api/map.py:31-39` deliberately does **not** guard the `user_id` read on
    `is_public`, with a long comment explaining that guarding it "would lock an
    owner out of their own unlisted map".
  - `api/render.py:46` **does** apply `is_public` to both branches, `user_id`
    included.
  - `web/landing.html:137`'s "My map" tile points at `/view?name=`.

  So: unlist your map from the home page tile, then click the "My map" tile
  beside it, and you get *"This map is unlisted, so it does not render by name."*
  There is no route in the app that will render an unlisted map for its owner,
  and Export HTML goes with it. `web/view.html:167-171` handles this gracefully
  and honestly — the copy is good — but it is describing a capability the owner
  should not have lost. Two routes disagree about what the same credential
  authorises. *Read-only judgement, traced through three files.*

- **X4. `web/session.js:120` reads `sessionStorage` at module scope with no
  `try`/`catch`** — while `stashNotice` twelve lines above wraps its *write* with
  one and a `/* private mode */` comment. `session.js` is imported by every
  hosted page. In any context where storage access throws (Safari with "block
  all cookies", some embedded webviews, some enterprise policies) the whole
  module fails to evaluate and **every page in the app is blank**, with the
  failure originating in the module whose job is to degrade gracefully.
  `setUser`/`clearUser` (lines 16-22) are unwrapped too, so sign-in throws in the
  same environments. `getUser` is correctly wrapped. *Read-only judgement.*

- **X5. Payload weight is nobody's job.** `/compare` is ~1.3 MB; `/wizard` and
  `/learn` are 809 KB; `/gallery` transfers every public map's markdown to the
  server to count it. No single decision is wrong — the corpus is genuinely that
  size and the maps are genuinely needed for the scorecard. But the audience is
  phones, `decisions.md` says so, and `web/corpus.js:38-42` fetching sixteen
  files *sequentially* is the cheapest 800 ms in the product going unclaimed.

- **X6. `tests/README.md` names four of the nine checks, and says `py`.** For a
  program whose entire operating model is cold sessions reading documentation,
  the test index being 44% complete is a real defect. `compare-core.test.js`,
  `build-traditions.test.js`, `refs.test.js`, `check_tradition_maps.py` and
  `api/_test_lib.py` are all absent from it.

## Yellow — what this program should be proud of

1. **Every architectural rule that was written down has been kept.** One
   renderer, one parser pair in lockstep, one serializer, one Supabase file, one
   corpus loader, one session module, `require_admin` before dispatch, no
   dependencies, `is_admin` never written by a route, no PIN in any reply. I
   checked all of them by running or by grep, and did not find a single one
   violated across six phases.
2. **The comments are load-bearing and honest.** Repeatedly — `gallery.py:46`,
   `storage-hosted.js:8`, `map.py:31`, `compare-core.js:263`, `view.html:156` —
   a comment names the bug it prevents, the review that found it, and what will
   happen if someone "fixes" it back. This is the main reason a cold session can
   be useful here at all, and it is why several findings above are stated
   confidently: the code says what it meant to do, so a divergence is legible.
3. **The un-run declarations are still honest.** 20-row retention is still
   correctly listed as unverified rather than assumed.
4. **Phase 2's two security fixes have survived four phases and six new route
   actions**, and I could not construct a new instance of either class.
5. **The idempotent build is real**, not aspirational — an empty `git diff` on
   the actual repository.

## Green — where the next session should spend its time

In order of value per line changed:

1. **`engine/editor-core.js`'s `serializeNode`/`headerTokens`** — one line each,
   closes B1/D1, verified no-op on all existing data.
2. **`engine/compare-core.js:248-253`** — five lines, plus a rankability floor
   using data that already ships. Closes F1, F2 and F5.
3. **`web/corpus.js:38-42`** — `Promise.all`. Four lines, the biggest latency
   win in the app.
4. **`engine/theme.css`** — add six tier tokens, delete four copies. Makes an
   existing `CLAUDE.md` sentence true.
5. **`web/session.js:16-22, 120`** — three `try`/`catch` blocks.
6. **`.gitattributes`** — three lines, ends a three-year-old diff ping-pong.
   Thomas's call, because it rewrites committed bytes once.

Everything above is under about 40 lines in total and needs no schema change, no
new route, and no browser.

## Blue — process

**The phase structure worked.** Every phase merged, the chain never stalled, and
`run-order.md` plus the outcome files made a genuinely cold start productive —
I was reading code within twenty minutes and running verification within thirty.

**The one process change worth making.** Phase 2's amendment was *"what does
each route trust, and who else publishes that value?"*, and it worked: I asked it
of all six new route actions and the answers were clean. The equivalent question
for phases 3–9 is a level up from routes:

> **What number does this feature say out loud, and what test asserts its
> value — not its type, not that it was computed, but its value on realistic
> input?**

F1 falls out of that in one minute. So does C1 (two numbers called "open"), and
so does F2 (a floor that is measured and never compared against). The compare
suite has sixteen assertions and not one of them checks *which tradition comes
back closest*. `tally` is tested; `closestTradition`'s answer is not.

**On subagents:** this review used none, deliberately, matching phase 2's
reasoning. Every finding above required two files held simultaneously — B1 is
the wizard's textareas plus the serializer; F1 is the sort plus the UI that reads
its output; X3 is three files and a locked decision. A subagent briefed on any
one of them would have reported it clean.

**On the browser-verification ban:** it remains right, and it is being read too
broadly. F1, F5, C1 and D3 are all pure logic reachable from `node`, and they sit
in `web/` only because that is where somebody happened to type them. The rule
that made `wizard-generate.js` and `compare-core.js` pure and testable — *model
logic in the UMD module, painting in `web/`* — is stated in both files' headers
and is what should have caught F1. `closestTradition` *is* in the pure module;
what is missing is not testability but a test.

---

## Findings, prioritised

**V** = verified by running a command in this session. **R** = read-only
judgement from the code.

| # | Sev | Feature | Finding | Suggested fix | Conf |
|---|---|---|---|---|---|
| **F1** | **High** | Compare | **V** `compare-core.js:248-253` sorts on a ratio, breaks ties on a raw count, and only inspects the top two rows. On a 12-belief map four traditions score 1.000 and none is flagged joint; `/compare` names one. Given the INC map, INC itself is excluded from the pair. | Compare on one scale; flag every row tied with the top, not just `ranked[1]`; print each named tradition's own fraction. ~5 lines. | High |
| **F2** | **High** | Compare | **V** The locked coverage floor gates nothing. `validate_content.py:537` warns below 60% (INC 15%, Restorationist 38%, Anabaptist 53%); `corpus.js:47` says the data ships so a floor "can be applied"; no caller applies one. | Exclude sub-floor traditions from `closestTradition`'s ranking, using `manifest.json`'s `node_count`. Keep them as scorecard columns and picker targets. ~10 lines, no schema change. | High |
| **B1** | **High** | Editor / Wizard | **V** `editor-core.js:123-136` writes user text into a line format unneutralised. A newline in `hold` splits one belief into two nodes and moves the `refs` line; a title containing ` · ` is parsed as tier/confidence. | Collapse `[\r\n]+` to a space in `serializeNode`, and strip `·`/`|` in `headerTokens`. **Verified a no-op on all existing content.** Add a round-trip test with `\n`, `## `, ` · `. | High |
| **X3** | Med | Cross | **R** No route renders an unlisted map for its owner: `api/render.py:46` guards `is_public` on the `user_id` branch, which `api/map.py:31-39` documents as the thing that must not be done. Home → "My map" is a dead end after self-unlisting. | Drop the `is_public` check on `api/render.py`'s `user_id` branch, matching `api/map.py`'s stated reasoning. 1 line. | High |
| **X4** | Med | Cross | **R** `session.js:120` reads `sessionStorage` at module scope with no try/catch (`stashNotice:85` has one); `setUser`/`clearUser` unwrapped. A throwing storage API blanks every page. | Wrap the three. 3 lines. | Med |
| **E1** | Med | History | **R** `history.html:116` restores with a token captured at page load and never refreshed; a 409 leaves the page permanently unable to restore, with no hint that reloading helps. | Re-`GET /api/map` inside `restoreVersion`, or `location.reload()` when `err.code === 'conflict'`. | High |
| **G1** | Med | Renderer | **V** Generated files committed CRLF (1021/328/131 pairs) with no `.gitattributes`; regenerating on Linux rewrites every line ending with zero content change. Content verified identical after LF-normalisation; hash matches `CLAUDE.md` exactly. | Add `.gitattributes` pinning the three generated files to one EOL. Lets `CLAUDE.md` carry one hash, not two. Rewrites committed bytes once → **Thomas's call**. | High |
| **X1** | Med | Cross | **V** The tier ramp is hand-copied in five places (`render.py`, three `web/*.html` `:root` blocks, one JS object in `gallery.html`) and `engine/theme.css` — documented as their home — has none. All five currently agree. | Move `--t1`…`--t4` into `theme.css`; delete four copies; `gallery.html` uses `var(--t1)` like its three siblings. | High |
| **D4/F3** | Med | Wizard / Compare | **V** `web/corpus.js:38-42` fetches the 16-file, **809 KB** corpus sequentially; `/compare` additionally pulls **475 KB** of tradition maps (those correctly parallel). ~1.3 MB before first paint, on a phone audience. | `Promise.all` in `corpus.js`; consider lazy-loading the eleven non-target maps until the scorecard renders. | High |
| **F4** | Med | Compare | **R** `compare.js:399,430` fetch tradition maps with no `res.ok` check; a 404 parses as an empty map and renders "This tradition takes no position on it" ×86 with no error. | `if (!res.ok) throw`, matching `view.html:100`'s handling. | High |
| **E2** | Med | History / Editor | **R** Admin restore sends no `expected_updated_at`; the user's editor can undo it via the conflict dialog's force path seconds later. Recoverable (force always snapshots) but silent for both parties. | Surface a notice in the editor when a reload finds unexpected content; or have admin restore take a token. | Med |
| **D2** | Low | Wizard | **R** `wizard.js:110` commits fire-and-forget on a source-link click; can interleave with the Next-button commit and compute `revisit` from a mutating model. | Reuse the existing `busy` in-flight guard. | Med |
| **A1** | Low | Accounts | **R** A name over 60 chars returns a bare `500 server_error`; the signup form has no `maxlength`. | `maxlength="60"` + an explicit length check returning 400. | High |
| **A2** | Low | Accounts | **R** `auth.py:17` fetches the row back with `return=representation` and no `select=`, so `pin` enters a variable on the one path that must never ship it. Safe today by field-by-field construction. | `&select=id,name,is_admin` on the POST. 1 line. | High |
| **C1** | Low | Gallery / Wizard | **V** "Open questions" means two things: 36 (gallery, `#study` **or** `open`) vs 33 (wizard, `#study` only) on the same map. Mitigated by honest labelling in `wizard.html:383`. | Align the definitions, or rename one label so no reader compares them. | High |
| **F5** | Low | Compare | **R** `denominatorNote` describes only `ranked[0]` but is appended to a sentence that may name two traditions. | Fold into F1's fix — print each named tradition's own fraction. | High |
| **D3** | Low | Wizard | **R** `wizard.js:514` preselects on exact string equality where `compare-core.js:109` uses `normalise`. Two rules for one question. | Reuse `CompareCore.normalise`. | High |
| **F6** | Low | Compare | **V** `compare-core.js:99` hardcodes `'undecided'`; `wizard-generate.js:239` writes `open.hold || 'Undecided.'`. Inert today — all 86 doctrines use exactly `"Undecided."` — and unpinned by the validator. | Add a validator rule, or resolve against the doctrine's own `open.hold`. | High |
| **D5** | Low | Wizard | **R** `corpus.js:40-43` treats a missing domain file as normal (`console.info`). Phase 5 is complete, so a 404 now means a broken deploy silently dropping questions and denominators. | Make it an error on the hosted path, or at least `showError`. | Med |
| **G3** | Low | Renderer | **R** `view.html:165` detects an empty map by substring-matching the generated class `mbox-leaf`, coupling a redirect to markup phase 7 was licensed to change. | Read the `<script id="data">` payload's node count instead. | Med |
| **E3/A3/C2** | Low | Perf | **V/R** Three routes pull full markdown to compute integers: `admin.py:27` (all users), `map.py:196` + `admin.py:112` (20 versions), `gallery.py:57` (200 maps — measured 4.1 s parse at the cap). | Drop the unused select in `admin.py:112`; accept the rest until row counts justify denormalising (schema change → waits). | High |
| **B3** | Low | Editor | **R** `editor.html:1073` compares a client clock to a server timestamp to decide whether to offer a draft; a slow device clock silently disables the offer. Fails safe. | Compare against the `updated_at` stored beside the draft. | Med |
| **F8** | Low | Compare | **R** `build_traditions.js:164` rebuilds every tradition a second time inside `buildManifest`. 24 builds per run. | Build once, pass the results to `buildManifest`. | High |
| **F7** | Low | Compare | **R** `positionsInGroup` searches every doctrine for an `equivalence_group` the corpus scopes to one doctrine. Not reachable from the safety-critical path today. | Take a `doctrineId` and scope the search. | Med |
| **X6** | Low | Process | **V** `tests/README.md` names 4 of the 9 runnable checks and says `py`. | List all nine. | High |
| **F9** | Low | Corpus | **V** `/learn` renders a "Contested" banner on 80 of 250 positions; `phase-5-outcome.md` already warned the flag is over-applied. | **Phase 9's**, not a code fix — re-examine `orthodoxy: contested` during sourcing verification. | High |
| **D6** | Info | Wizard | **R** `wizard.js:862` compares names case-sensitively where `compare.js:373` lowercases. Harmless today. | Lowercase both. | High |
| **A-edit** | Info | Admin | **R** The locked "edit/restore any map" power has had no UI since phase 1d; `save_map` is reachable only by hand-crafted POST. | A textarea in the existing versions panel posting `save_map` — avoids touching `engine/editor.html` entirely. | High |
| **E4** | Info | History | **Not verified** by anyone yet: 20-row retention. Needs 21 saves an hour apart, and no session has database access. | Leave declared unverified, as `run-order.md` does. | — |

---

## What I did not get to

Stated plainly, because a gap named is worth more than a gap papered over:

- **No production verification of any kind.** This session made no network calls
  to the live site, the Vercel deployment or Supabase. Every route finding above
  is from reading the code and, where possible, exercising the pure functions it
  calls. Phase 2 could reproduce its findings live; I could not, and did not try.
  In particular I did **not** re-measure cold-start latency, did not confirm the
  three migrations are applied, and did not confirm `map_versions` has rows.
- **No browser behaviour was observed**, per the house rule. Everything about
  `engine/editor.html`'s dialogs, the wizard's screens, the `/compare` layout and
  every responsive rule is a reading of the source. Phase 2's B9 — the conflict
  dialog and the `unknown_user` redirect — remains unobserved by any session, and
  this review does not change that.
- **`engine/editor.html` was read selectively, not whole.** I read the autosave,
  conflict, draft-restore and escaping sections (roughly lines 960–1105) and
  grepped the rest. Its Map tab, its List form and `applyOpenParam()` were not
  reviewed line by line, and `engine/map-view.js` was not reviewed at all — I did
  not verify the three-function lockstep rule holds, only that
  `CLAUDE.md` states it. A future session should treat `map-view.js` and the
  editor's two tabs as genuinely unreviewed.
- **The corpus content was not assessed for theological accuracy.** I counted
  things (86 doctrines, 250 positions, 80 `contested`, 3 `outside`, per-tradition
  coverage) and checked structural consistency, but did not read a single entry
  against a source. That is phase 9's job and it has not run; F9 is the only
  content-shaped finding here and it is a *distribution* observation, not a
  judgement about any entry.
- **`engine/render.py` was read selectively.** I read the parser, `esc`, the
  payload construction, and grepped every interpolation site for escaping. The
  four view builders, the print stylesheet and the `.mm`/study-list writers were
  not read line by line — I relied on the byte-identity hash and the zero-warning
  run instead.
- **`web/wizard.html`'s 459 lines of markup and CSS** were grepped, not read.
- **Load and concurrency were reasoned about, not tested.** The gallery parse
  cost is a real local measurement; the 100 MB transfer figure and every
  two-tab/two-actor race (E2, D2) are arguments from the code, not observations.

## Decisions this review makes look wrong

Per the brief: locked decisions are not re-opened, and none of the below is a
recommendation to reverse one. Recorded and moved past.

- **"Public means comparable", no `is_comparable` column.** Sound as reasoning —
  compare only automates what a visitor could do by hand. But it composes with
  X3: a person's only lever over being compared is unlisting, and unlisting also
  costs them the ability to view or export their own map. Fixing X3 (one line)
  removes the collision without touching the decision.
- **"The file format stays frozen", so compare recovers a position by exact
  normalised match on the `hold` sentence.** Correct, and the honest
  `own-wording` result it produces is a genuine strength. The cost is now
  measurable: Thomas's own hand-written map resolves to `own-wording` on 73 of 86
  rows, so the largest and most useful map on the site — which `decisions.md`
  explicitly designates as a default comparison target — cannot be given a
  closest tradition at all. `compare.js:171-176` handles this with dedicated,
  accurate copy, which is the right response. Worth knowing that the decision's
  price is paid most heavily by the one map the decision also nominates as the
  primary target.
- **Security deliberately minimal.** Endorsed; nothing above proposes changing
  it. A2 and A1 are hygiene inside that posture, not steps toward real auth.
