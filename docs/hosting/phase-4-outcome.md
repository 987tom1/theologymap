# Phase 4 — outcome

**Design canvas (Task 0 Step 4), for review on a phone:**
<https://claude.ai/code/artifact/12356ef5-922c-4233-8272-a22a1746940b>

Five artboards, drawn from design §5.3: the opening screen, the tradition lens,
a question screen (Baptism, four positions including one outside the historic
creeds), the same question answered with the wording field and *Who believes
what?* open, and the finish screen. Every colour and font is the phase 3 theme;
the vocabulary table is used verbatim. Sticky notes on the canvas carry the
judgement calls made while drawing it.

**Branch:** `phase-4-wizard`. **Model:** Opus main thread, two Sonnet subagents.
**Merged to `main`** with `--no-ff` (`3465288`); every gate below passed first.

> **This file is written across two sessions.** Session 9 ran Tasks 0–4 and
> merged them; session 10 runs Tasks 5–8 on the same branch and finishes it.
> Everything below is session 9.

---

## Session 9 — Tasks 0–4

### What landed

| Task | Who | What |
|---|---|---|
| **0 — `map_versions`** | main thread | `supabase/migrations/20260823170000_map_versions.sql`, `_lib.snapshot_map()`, both save paths wired, `supabase/verify-map-versions-migration.sql` |
| 1 — scaffolding | main thread | `tests/README.md`, `tests/fixtures/empty.md`, `tests/fixtures/partial.md` |
| 2 — manifest + registry | main thread | `content/wizard/manifest.json` (14 domains), `content/wizard/traditions.json` (14 traditions, 12 `in_ui`) |
| 3 — the validator | **2 Sonnet subagents** + main thread | `engine/validate_content.py` — 20 error rules, 4 warnings, coverage matrix; `tests/test_validate_content.py`, `tests/fixtures/bad-corpus/` |
| 4 — the generator | main thread | `engine/wizard-generate.js`, `tests/wizard-generate.test.js`, `tests/check_generated_map.py`, `tests/fixtures/corpus/` |

Commits, in order: `a135069` (Task 0), `008d77c` (Task 1), `a3bfb2e` (Task 2),
`67cdb8e` (Task 3), `cade8e2` (Task 4), `18f107f` (domain ordering fix),
`62c048c` (`CLAUDE.md`), `3465288` (the merge), `62a6dbf` (line endings),
`208b883` (the save reply's `snapshotted` field).

**Nothing a visitor sees has changed.** No `/wizard` route, no `web/wizard.*`,
`WIZARD_ENABLED` still `false`. Tasks 5–8 are session 10.

---

## `map_versions` — written first, and verified on the real database

`decisions.md` (2026-08-23) opens phase 4 with it, ahead of the plan's own
ordering, because the wizard is the first feature that can replace a whole map
in one action and `force: true` walks past all four empty-save guards.

**Shape, exactly as locked:** `map_versions(id, user_id, markdown, saved_at)`,
`users.markdown` still the head pointer. The editor, gallery, render route and
export are untouched, and **nothing reads the table yet** — it is write-only
until something is built to restore from it.

### The one design call I made: the rules live in SQL, not in `api/`

The throttle and the retention are a `plpgsql` function,
`public.snapshot_map(p_user_id uuid, p_force boolean)`, called by one PostgREST
RPC from `api/_lib.py`. The alternative was three round trips of Python in each
of the two call sites.

- **They cannot drift.** `api/map.py`'s save and `api/admin.py`'s `save_map`
  both call the same function; there is no second copy of "one per hour" to fall
  out of step.
- **One round trip on the hot path.** Autosave's 1200 ms debounce hits this
  constantly, and the function reads `users.markdown` itself, so the markdown is
  never sent over the wire a second time.
- **Retention is atomic.** A read-then-delete from Python races itself.

`snapshot_map()` in `_lib.py` **never raises and never blocks the save** —
losing a snapshot is a far smaller failure than losing the ability to save.
`revoke all … from public; grant execute … to service_role` because the repo is
public and Postgres grants EXECUTE to PUBLIC by default.

### Verified on production, after the merge

Branch previews have no database, so all of this ran on production. Every row is
a command that was run and an output that was read.

| Check | Result |
|---|---|
| **Phase 3's `copied_from` migration had actually applied** (checked *before* stacking a second migration on it, per the session brief) | **PASS** — `GET /api/gallery` → 200 with rows. `api/gallery.py`'s select names `copied_from`; a missing column would make PostgREST answer 400 and the route return `500 server_error` |
| Credentials resolve (`POST /api/render {"user_id":"000…0"}`) | **PASS** — `404 unknown_user`, not `500 misconfigured` |
| **`map_versions` applied.** Save #2 on a row with real content | **PASS** — `{"snapshotted": true}`. That single `true` proves the table, the function, the `service_role` grant and the insert all exist |
| Save #1, empty row → content (nothing to preserve) | **PASS** — `snapshotted: false`, correctly |
| **Throttle.** Save #3, seconds later | **PASS** — `snapshotted: false` |
| **The force exception.** Save #4, `force: true`, seconds later, and an *empty* markdown — the exact case the four guards do not cover | **PASS** — `snapshotted: true`. The content was preserved before being erased |
| Retention (last 20 per user) | **NOT VERIFIED** — see below |

### How I made it verifiable, and why that needed a change

**`snapshot_map()` swallowing every failure means it cannot report one**, and no
route reads `map_versions`. So a missing table is *indistinguishable* from a
healthy throttled save: the site looks perfectly fine either way. That is the
same shape as the `import render` trap in `CLAUDE.md` — a silent wrong answer
that reads as health.

`api/map.py`'s save reply therefore carries **`snapshotted: true|false`**.
Additive field on an existing route — no new route, no credential, and nothing
on the client reads the reply shape (`grep` over `storage-hosted.js` and
`web/*.js`: no matches). Without it this section would say "committed, not
verified", which is the outcome `run-order.md` exists to prevent.

**The cost, which is Thomas's to reverse.** The probe needed a real account, so
sign-up is open and I made one: **`zz-schema-check`**, PIN `481902`. Its map is
empty and it now sits in the gallery next to `Test1`. **Delete it from
`/admin`** whenever convenient — one click, and nothing depends on it. I could
not delete it myself: that needs an admin PIN, which no session holds.

**Retention could not be checked.** It needs 21 saves an hour apart, or a read
path that does not exist. It is one `delete … where id not in (select … limit
20)` clause in the migration, reviewed but not exercised. If it is wrong the
symptom is unbounded growth, not data loss.

---

## Where the plan is stale, and what I believed instead

`run-order.md`'s checklist and Progress section are authoritative over the plan
where they differ, per the session brief. Three places bit this session; all
three are the same pattern phase 3 wrote up — **a plan is not rewritten in place
when a decision supersedes it.**

### 1. `traditions.json` has fourteen entries, not thirteen

The plan's Task 2 Step 2 says eleven `in_ui` traditions plus two display-only,
and Step 3 expects `13`. `decisions.md` — *Amendments — 2026-08-18, after the
phase 4 and 6 design review* — is later and explicit:

> **Add INC (International Network of Churches) to `traditions.json`** — twelve
> traditions, not eleven. It is Thomas's own movement and the one his actual
> audience belongs to.

So: **twelve `in_ui` + `quaker` + `oneness-pentecostal` = fourteen.** Vineyard
and Churches of Christ are not added, per the same amendment. (Restorationist /
Churches of Christ *is* in the eleven the plan already listed — the amendment
declines to add "Churches of Christ" as a *separate* thirteenth entry.)

**Where INC sorts is a judgement call I made:** `order: 3`, directly after
non-denominational and Pentecostal. `decisions.md` fixes that INC is included
and that non-denominational/Pentecostal are the centre of gravity; it does not
say where INC goes. Third puts Thomas's audience's own movement in the first
row of the lens screen without displacing the two the decision names. Moving it
is a one-line edit to `traditions.json`.

**INC's sourcing is deliberately thin and says so.** Per the same amendment, the
standard does not relax for it: two `confessional_sources`, both the movement's
own statements, and a `map.intro` that states in as many words that where a
position cannot be traced to a published INC or affiliated statement, the entry
will say so rather than generalising from Pentecostalism at large. **Phase 5
should treat every INC entry as needing a real citation or an explicit
"unsourced" note**, and put the unsourceable ones on the list awaiting Thomas.

### 2. Task 3 Step 5 expects twelve missing-file warnings; it is fourteen

The plan assumed `scripture.json` and `church.json` already existed at Task 3.
They are **Task 6's** output — session 10's. With none of the fourteen domain
files present, `py engine/validate_content.py` reports **0 errors, 14 warnings**.

**Rule 2's file-existence half is therefore a warning, not an error.** Design
§4.10 lists it under errors, but as an error phase 4 could never pass its own
validator and phase 5 could not add domain files one at a time. The manifest
lists all fourteen from the start precisely so phase 5 adds files without
editing it; a missing file has to be a warning for that to work.

### 3. Task 4's tests point at a fixture corpus, not `content/wizard`

This is the one that could not simply be believed-around, so it is written up in
full in `tests/fixtures/corpus/README.md`. Short version:

The plan's Task 4 test calls `WG.loadCorpusSync('content/wizard')` and asserts
on `church.baptism`, `church.lords-supper` and `scripture.canon` — doctrines
**Task 6** writes, in session 10. As written, **Task 4 could not be verified in
the session `run-order.md` assigns it to.** The options were to pull Task 6
forward (its content must meet phase 5's citation standard — a session's work,
not a step's) or to give the generator a fixture.

I gave it a fixture: `tests/fixtures/corpus/`, four doctrines across Scripture
and Church, enough to exercise tier ordering, the open answer, cross-domain
links in both directions, and "never modify an existing node".

**That is the better arrangement anyway, and should stay.** The generator is a
pure function over a *schema*; its tests should pin the schema, not the content.
Pointed at `content/wizard`, every domain file phase 5 lands would shift
`orderedDoctrines`' output and break tests that have nothing to do with content.
The fixture's README says in as many words that it is **not** seed content and
must never be copied into `content/wizard/`.

**Task 8's suite must run the validator and the generator against the real
corpus** — the fixture does not substitute for that. One test in
`wizard-generate.test.js` already loads `content/wizard` and asserts fourteen
domains, fourteen traditions and *zero* doctrines; when Task 6 lands, that
assertion is the one to update, and it will fail loudly until someone does.

---

## Decisions I made for you

None touch the data model or the file format — those stop and wait, and none of
this session's work needed them. `theology-map.md`'s format is untouched.

1. **The snapshot rules live in SQL, not in `api/`.** Reasoned above. The
   alternative was three round trips per autosave and a racy retention delete.
2. **`api/map.py`'s save reply carries `snapshotted`.** Without it the migration
   is unverifiable from outside. Additive, no new route, no client depends on it.
3. **A throwaway account, `zz-schema-check`, exists on production.** The only way
   to exercise a write path without one of your PINs. Delete it from `/admin`.
4. **INC sorts third in `traditions.json`.** Reasoned above.
5. **Rule 2's file-existence check is a warning.** Reasoned above.
6. **The generator's tests read a fixture corpus.** Reasoned above.
7. **The `#study` checkbox on an answered question**, drawn on the canvas, is
   labelled exactly as phase 3's table requires — *`#study` — I still need to
   work this out*. Design §5.3 does not name that control; §4.9 implies it
   ("or when the person ticks 'still working on this'"), and the generator
   already accepts `answer.study`.
8. **The wizard mockups show a `Read more` link on the question and on each
   position card**, per §5.3's tooltip note. §5.3 leaves open whether an external
   link mid-wizard costs more momentum than it gains — **the canvas draws the
   inline explainer and leaves the outward links for phase 6's learn page**,
   which is §5.3's own stated fallback. Session 10 builds what the canvas shows
   unless you say otherwise.
9. **Task 0 Step 5's empty branch-point commit was skipped.** Real commits
   existed by then; an empty marker adds nothing to a history someone has to
   read.

---

## The thing that nearly hid a 60-line change in a 2,200-line diff

**`pathlib.Path.write_text` translates newlines on Windows.** Every file I edited
through Python was silently rewritten to CRLF — `api/_lib.py`, `api/map.py`,
`api/admin.py` and `CLAUDE.md` among them. The merge commit's stat showed
`CLAUDE.md | 1121 ++++----`, `api/_lib.py | 512 ++++----` for what is actually a
28-line addition.

Caught at the merge, fixed on `main` in `62a6dbf` (LF restored on all nine
files, every gate re-run including byte identity), never force-pushed. **The
repo is LF everywhere except `documentation/verses.md`, which was already CRLF
and was left alone.**

**Use `write_bytes`, or pass `newline=""`, when editing a repo file from Python
on this machine.** There is no `.gitattributes` to catch it, and a session that
does not read `git merge`'s stat will not notice.

---

## What the generator does, for the session that wires the UI to it

`engine/wizard-generate.js`, UMD like `editor-core.js` — `window.WizardGenerate`
in the browser, `module.exports` under Node. **No DOM, no fetch, and it never
produces markdown**: it builds a node model and the caller calls
`EditorCore.serialize`. That split is what lets the whole content-to-markdown
path be verified from the command line, in a program that has banned browser
verification.

| Export | Contract |
|---|---|
| `loadCorpusSync(dir)` | **Node only** — guarded by `typeof require`. The browser fetches the corpus itself and passes the object in. Tolerates manifest entries whose file is not on disk yet |
| `orderedDoctrines(corpus)` | `(tier_rank, domain.order, doctrine.order)` ascending. T1 first, per `decisions.md` |
| `applyAnswer(domains, corpus, answer)` | mutates and returns. `{doctrineId, kind: "position"\|"open", positionId?, hold?, why?, vs?, tier?, confidence?, study?, revisit?}` |
| `pruneLinks(domains)` | **run immediately before every `serialize`.** Recomputes `link` from `_intendedLinks ∩ present slugs` — it restores as well as prunes |
| `answeredSlugs(domains)` / `nextDoctrine(domains, corpus)` | answered is decided by slugs already in the map. No answer log, no schema change, resume for free |
| `findDoctrine` / `findPosition` / `domainName` / `tierRank` | lookups the UI will want |

Four behaviours worth knowing before you build on it:

- **A doctrine already in the map is not answered again** unless the answer
  carries `revisit: true`. A belief someone wrote by hand counts as answered.
  This is the rule protecting their work; do not weaken it.
- **`_intendedLinks` is in-memory only.** `serializeNode` reads known fields, so
  an underscore-prefixed property is inert — and the test greps the serialized
  text for `_intended` to keep it that way.
- **A new domain section is inserted in `manifest.order` position**, not
  appended (design §5.5 point 4). Answering a Church doctrine before a Scripture
  one gives `Scripture | Church`. This was wrong in my first pass and is fixed in
  `18f107f`.
- **`why` and `vs` are droppable.** `answer.why === ''` clears them; omitting the
  key takes the position's own.

---

## The validator, for phase 5

`py engine/validate_content.py` — exit 0 clean, exit 1 on any error, and
importable as `validate(root) -> (errors, warnings)`. Every message reads
`<file>: <doctrine id>: <what is wrong>` so a phase 5 session fixes content
without reading the code.

All twenty error rules and four warnings from design §4.10, plus the coverage
matrix, which prints only when there are no errors. Run against the fixture
corpus it already produces a real matrix (doctrines down, the twelve
`in_scorecard` traditions across, `Y` / `!` / `-`).

**Two Sonnet subagents wrote it**, rules 1–10 and rules 11–20 plus the matrix,
against a skeleton the main thread wrote (`load()`, `slugify()`, `where()`, the
constant sets) so the halves could not collide. Both came back green against
their own briefs. **Both put `tradition_overrides` on the *position* rather than
the doctrine** — design §4.4 and §4.6 put it on the doctrine — which would have
made rules 8 and 10's override checks dead code that never fires. Corrected on
the main thread before merging. Worth knowing: two independent agents made the
same schema mistake, so it is the schema's most misreadable corner.

`slugify()` is a hand-port of `editor-core.js`'s and must stay one. Rule 4
exists to catch a title edit that silently breaks a `link`, and it can only do
that if the two agree byte for byte.

---

## Verification that gated the merge

Every command run, output read, nothing inferred. Re-run in full after the line-
ending fix.

| Check | Result |
|---|---|
| `py engine/render.py` → no diff on the three generated files | **PASS** |
| **Byte identity**: `render_markdown` on the real map, LF-normalised | **PASS** — `eaedf3e4…1a90`, phase 2's baseline exactly. **The hash did not move.** |
| `engine/editor-core.js`, `engine/map-view.js`, `engine/render.py`, `engine/theme.css`, `engine/editor.html` vs `main` | **PASS** — **zero changed lines in all five.** No lockstep risk this session |
| `node --check engine/wizard-generate.js` | **PASS** |
| `py -m py_compile api/*.py engine/validate_content.py tests/check_generated_map.py` | **PASS** |
| `py api/_test_lib.py` | **PASS** |
| `node tests/wizard-generate.test.js` | **PASS** — 9 of 9 |
| `py tests/check_generated_map.py` — every prefix map parsed by **`render.py`'s own parser** | **PASS** — 4 prefix maps, 0 problems |
| **Mutation check**: disable `pruneLinks` | **Both gates bite** — the JS test fails, and `check_generated_map.py` reports `BROKEN LINK prefix-00` and `prefix-02`. Restored, re-run green |
| `py tests/test_validate_content.py` | **PASS** — `OK 3 errors, 3 warnings`; catches the slug, the unknown tradition and the second person |
| `py engine/validate_content.py` on the real corpus | **PASS** — 0 errors, 14 warnings, exit 0 |
| `manifest.json` → 14 domains, names matching `theology-map.md`'s `# ` headings | **PASS** |
| `traditions.json` → 14 traditions, 12 `in_ui`, every `in_scorecard` has a `map`, every `short_name` under 12 characters | **PASS** |
| **Local workflow, run not read**: `py engine/render_server.py`, fetch `engine/editor.html`, `engine/theme.css`, `engine/editor-core.js`, then `POST /api/render` | **PASS** — 200 on all four; server stopped, `git status` clean afterwards; **no network call** |
| No secrets, no key material in anything added | **PASS** |
| `#thread` anywhere in the corpus | **PASS** — no matches |

### What could not be checked before merging

- **Nothing on the branch could touch the real database.** Branch previews have
  no database (Supabase env vars are Production-only), and the Supabase/Vercel
  account is unreachable from this machine's MCP tools. Everything database-side
  ran on production after the merge and is in the table above.
- **`map_versions` retention.** See above.

---

## Questions for Thomas

1. **Delete `zz-schema-check` from `/admin`.** The account exists only because
   verifying the migration needed a write path. PIN `481902` if you want to look
   at it first.
2. **Does INC belong third in the lens list?** My call, easily changed.
3. **Read-more links: inline only, or out to sources mid-wizard?** Design §5.3
   flags this as open. The canvas takes §5.3's own fallback — explain inline,
   keep the outward links for phase 6. Session 10 builds what the canvas shows
   unless you say otherwise.
4. ~~**Nothing reads `map_versions` yet.** Worth a phase, or leave it as
   insurance?~~ **Answered 2026-08-23: give it a phase.** It is **phase 8** —
   `decisions.md`'s *Amendment — 2026-08-23, after phase 4 session 9*, the brief
   is `phase-8-version-history.md` in Project 13, and it is session 15 in
   `run-order.md`. No schema change; it needs only the table this session shipped,
   so it is numbered last but blocked by nothing after phase 4 and can be pulled
   forward.

## Decisions worth revisiting

- **The plan's Task 3 and Task 4 assume Task 6's content already exists.** Both
  are worked around above and both work-arounds should stay, but the plan itself
  still reads as though the seed comes first. Session 10 should not be surprised
  when Task 6's content changes nothing about how the tests are wired.

## Known limits carried forward

- `map_versions` is write-only. Nothing reads it, and retention is unexercised.
- The corpus has **no domain files**. `orderedDoctrines` over the real corpus
  returns `[]`, and the validator's coverage matrix says "nothing to cover yet".
  Task 6 is what turns both positive.
- The wizard does not exist: no `/wizard` rewrite, no `web/wizard.*`,
  `WIZARD_ENABLED` still `false`.
- `engine/corpus_refs.py` (Task 7) is not written, so corpus `refs` have not
  reached `documentation/verses.md`.

---

# Session 10 — Tasks 5–8

**Phase 4 is complete and merged.** The wizard exists at `/wizard`, the seed
corpus is twelve doctrines across two domains, and `WIZARD_ENABLED` is `true`,
so a new account's first-run screen now offers all three starting points.

**The schema of record is `docs/hosting/phase-4-design.md` §4.** It is not
restated here and it must not be — a second copy drifts. Phase 5 reads §4 and
this file's "Where the schema felt wrong" section, in that order.

## What landed

| Task | Who | What |
|---|---|---|
| 5 — the wizard UI | 1 Sonnet subagent (markup) + main thread (controller) | `web/wizard.html`, `web/wizard.js`, `/wizard` rewrite in `vercel.json`, `WIZARD_ENABLED` flipped |
| 6 — the seed content | 1 Sonnet subagent (Scripture) + main thread (Church, and every correction) | `content/wizard/scripture.json`, `content/wizard/church.json` — 12 doctrines, 30 positions |
| 7 — corpus refs | main thread | `engine/corpus_refs.py`; 44 new references in `documentation/verses.md`, all filled |
| 8 — verification, docs, merge | main thread | the real-corpus half of `tests/wizard-generate.test.js`, `CLAUDE.md`, this file, the merge |
| — (unplanned) | main thread | `engine/render.py` ships only the verses a map cites — found by Task 8's own gate, see below |

Commits: `968e824` (Task 5), `8b2c2fd` (Task 6), `f618f14` (Task 7),
`ffcd31b` (the `render.py` fix), then Task 8's docs and the merge.

## The subagent fan-out half-failed, and that shaped the session

Four Sonnet subagents were dispatched in parallel, as the plan's "Subagent
note" blocks specify: markup, controller, `scripture.json`, `church.json`.
**Two of the four were killed mid-run by an account-level monthly spend limit**
— not by anything in the work. The markup agent and the Scripture agent
finished; the controller agent died having written nothing, and the Church
agent died having written a file it never validated (it had three rule
violations).

Both were finished on the main thread. **This is worth knowing for phase 5**,
which is the most subagent-heavy phase in the program: budget for a fan-out
that returns two of four, and give every subagent a brief narrow enough that
the main thread can finish its file rather than restart it. The contract file
this session wrote for the two Task 5 agents did exactly that — the markup and
the controller were written by different authors, hours apart, and every id and
class matched on the first run.

## What the wizard actually is

Four screens in one page, one section shown at a time, a persistent header.
`web/wizard.html` is markup and CSS; `web/wizard.js` is the controller and holds
**no model logic** — ordering, node building, link pruning and "is this
answered" all stay in `engine/wizard-generate.js`, which is why the whole
content-to-markdown path is still verifiable from the command line.

**The load order in the plan's Task 5 Step 2 is stale.** It shows four classic
`<script>` tags including `web/session.js`. Phase 1b made `session.js` an ES
module that exports named bindings and puts nothing on `window`, and every
`web/*.html` page loads its script as a module. So `editor-core.js` and
`wizard-generate.js` load as classic UMD scripts (they are shared with the
offline editor and with Node) and `wizard.js` loads as `type="module"`. Same
correction sessions 7 and 8 made to `chrome.js` and `first-run.js`.

**Saving does not go through `apiFetch`.** That helper pops the shared error
banner on every non-2xx, and a 409 here is an expected, silently-recoverable
state — another tab saved in between — not something to alarm somebody with
mid-question. The wizard's one `POST /api/map` uses plain `fetch` and reads the
status itself; on a first 409 it re-GETs, re-parses, re-applies that one answer
and retries once; on a second it stops and says *this map was changed somewhere
else — reload to carry on*. It never force-saves and never sends `force: true`.
Every other call on the page still goes through `apiFetch`.

**Which position produced a node is not recorded**, per the frozen file format.
"Back" recovers the previous answer the way phase 6 will: exact match of the
node's `hold` against the corpus. No match means the person reworded it, and
nothing is preselected rather than something wrong.

## The gate that earned its keep: `theology-map.html` grew by one line

Task 8 Step 1 says that if `theology-map.html` changes, something touched
`theology-map.md` or the renderer, and to investigate before merging. It
changed. Neither had been touched.

**`render_html` embedded the whole of `verses.md`, not the references in use.**
Until this phase those two sets were identical — Thomas's map cites 156
references and `verses.md` held exactly those — so nothing had ever exposed it.
Task 7's job is to put the corpus's references into `verses.md` so a
wizard-built map's popovers have text, and the moment it did, 44 verses nobody
cites were inlined into `theology-map.html` **and into every hosted
`/api/render` response**. Phase 5 multiplies that by fourteen domains.

Fixed at the root, in one line: `render_html` now ships
`{r: verses[r] for r in collect_refs(nodes)}`. **It changes no existing output
byte** — phase 2's baseline hash `eaedf3e4…1a90` is unchanged and
`theology-map.html` has no diff — because today the filter is a no-op on
Thomas's map. It stops being one for every map the wizard builds.

This touches `engine/render.py`, which phase 4 was not supposed to need. It
carries **no lockstep obligation**: `render_html`'s payload construction has no
counterpart in `editor-core.js` or `map-view.js`, and both files are byte-for-
byte unchanged this phase, as are `theme.css` and `editor.html`.

## What the seed covers, and what it does not

**Covers:** 12 doctrines, 30 positions. A `settled` doctrine (Canon). Four
`tradition_overrides` — Anglican and Lutheran and Restorationist on baptism,
Anglican on women in ministry, Baptist on translations. Two `contested`
positions (the "infallible instrument" reading of inerrancy, and KJV-onlyism)
plus the Friends' position on baptism, from §4.8. One position with an empty
`held_by`. Two equivalence groups. Cross-domain `links` in both directions.
Every one of the twelve `in_scorecard` traditions appears.

**Does not cover:**

- **No `orthodoxy: "outside"` position anywhere in the seed.** Design §5.7 says
  not to invent one where the domain honestly has none, and neither Scripture
  nor Church has one. So the wizard's outside treatment — the *Outside the
  historic creeds* line, the `orthodoxy_note`, sorting last regardless of the
  lens — is **built and reviewed but not exercised by real content.** Phase 5
  is the first chance to exercise it; do not assume it works because it renders.
- **INC holds a position in only 6 of 12 doctrines** (a standing validator
  warning). Deliberate, per `decisions.md`: INC has no traceable published
  position on canon extent, KJV-onlyism, the perspicuity axis or the inerrancy
  range, so it is left out rather than generalised from Pentecostalism at
  large. **This is the shape phase 5 should copy.**
- Twelve of the fourteen domains have no file at all. That is phase 5's job.

### The commands phase 5 runs

```
py engine/validate_content.py        # 0 errors required; warnings are readable
node tests/wizard-generate.test.js   # the schema AND the real corpus
py tests/check_generated_map.py      # render.py's own parser over every prefix
py engine/corpus_refs.py             # new refs -> verses.md stubs
py engine/fetch_verses.py            # fill them from the NET Bible API
py engine/render.py                  # zero warnings; no diff on the three outputs
```

### The coverage matrix, as printed

```
doctrine                      Non-denom  Pentecostal  INC  Baptist  Anglican  Reformed  Catholic  Orthodox  Lutheran  Methodist  Anabaptist  Restoration
--------------------------------------------------------------------------------------------------------------------------------------------------------
scripture.inerrancy           Y          Y            -    Y        Y         Y         -         -         -         Y          Y           Y
scripture.canon               Y          Y            -    Y        Y         Y         Y         Y         Y         Y          Y           Y
scripture.sufficiency         Y          Y            Y    Y        Y         Y         Y         Y         Y         Y          Y           Y
scripture.clarity             Y          Y            -    Y        Y         Y         Y         Y         Y         Y          Y           Y
scripture.hermeneutic-method  Y          Y            Y    Y        Y         Y         Y         Y         Y         -          Y           Y
scripture.translations        Y          Y            -    !        Y         Y         Y         -         -         Y          -           -
church.women-in-ministry      Y          Y            -    Y        !         Y         -         -         -         !          Y           Y
church.church-government      Y          Y            Y    Y        Y         Y         Y         Y         Y         Y          Y           Y
church.baptism                Y          Y            -    Y        !         Y         Y         Y         !         Y          Y           !
church.lords-supper           Y          Y            Y    Y        Y         Y         Y         Y         Y         Y          Y           Y
church.membership             Y          Y            Y    Y        Y         Y         Y         Y         Y         -          Y           Y
church.spiritual-gifts        Y          Y            Y    Y        Y         Y         Y         -         -         -          -           -
legend: Y = exactly one position names this tradition, ! = covered by tradition_overrides, - = no position names it
```

## Where the schema felt wrong while writing twelve real doctrines

**The most valuable thing this file carries**, because it is far cheaper to
change the schema now than after ninety-nine entries exist. Nothing below was
changed — the data model and the file format stop and wait, per `decisions.md`
— but all four are real and all four are Thomas's call.

1. **§4.8's own worked example fails validator rule 15.** It puts Lutherans
   under both `infant-covenant` and `regeneration`, with `note`s explaining
   why, and supplies `tradition_overrides` for Anglican and Restorationist but
   **not** for Lutheran. The plan says to copy that entry verbatim; copying it
   verbatim is a build failure. The override is written now. **The design
   document should be corrected**, because every phase 5 session will read §4.8
   as the model of a complete entry.

2. **`tradition_overrides` is the schema's most misreadable corner, twice over.**
   Session 9 recorded that both its subagents put it on the *position* rather
   than the doctrine. This session's Church agent put it in the right place but
   wrote overrides for two traditions that appeared in **neither** listed
   position's `held_by` — rule 16 caught it. Three independent agents, three
   different mistakes, one field. If anything in the schema is worth a worked
   counter-example in §4.6, it is this.

3. **`kind: "settled"` is unenforced prose discipline.** A `settled` doctrine
   with two live positions is structurally identical to a `choice` doctrine;
   the only thing making Canon honest is that its `framing` names the agreed
   creedal core before naming the narrow open question. Nothing in the schema
   requires that. An explicit `agreed_core` string, separate from `positions`,
   would put the distinction in a field rather than in a convention fourteen
   sessions have to keep.

4. **`equivalence_group`'s scope is not stated, and a group of one is inert.**
   §4.4 does not say whether the string is doctrine-local or corpus-global, and
   §4.8 tags only *one* position `credobaptism` — so as written that group has
   a single member and joins nothing. The Scripture agent reproduced the same
   shape; corrected here by tagging both members of each pair. Phase 6 matches
   on a shared string, so **a group of one is always a mistake** and the
   validator could say so.

## Decisions I made for you

None touch the data model or the file format. Everything below is reversible.

1. **`render.py` ships only the verses a map cites.** Reasoned above. The one
   change outside phase 4's stated surface, and the byte-identity gate is what
   found it.
2. **The membership doctrine is titled `Membership and discipline`**, not the
   plan's "Church membership" — because that is the heading in `theology-map.md`
   and matching it is what lets the two maps compare.
3. **`Spiritual gifts today` lands under `# Church`**, because it lives in
   `church.json` and a doctrine's domain is its file. **Thomas's own map files
   the same material under `# Holy Spirit` as `Continuationism`.** So compare
   will not line those two up. The honest fix is to move the doctrine to
   `holy-spirit.json` when phase 5 writes that file, and to decide then whether
   the node title should be `Continuationism`. Left alone here rather than
   half-solved.
4. **Canon stays `kind: "settled"`.** The plan explicitly left this open. Its
   framing names what is agreed and then the narrow live question, which is what
   §4.4 asks a settled doctrine to do.
5. **Methodist holds one position on women in ministry, not two.** The plan
   asserts Anglican *and* Methodist are divided here. Anglicanism genuinely is,
   by province, and both entries are sourced to the Measures and the House of
   Bishops' Declaration. Methodism is not: Wesley licensed women to preach and
   the mainline Wesleyan bodies ordain them. A complementarian Methodist
   `held_by` entry would have needed a citation that does not exist, so the
   tradition sits on the egalitarian position with an override describing the
   minority. **The sourcing standard beat the plan's expectation.**
6. **"Finish here" is on the lens and question screens, not on the opening and
   finish screens.** The plan says every screen; the design canvas draws the
   brand header on those two and no Finish button. There is nothing to finish
   before the first answer, and the finish screen already offers three routes.
   The canvas wins, per this session's brief.
7. **The canvas's own copy was rewritten into first person where it used the
   second.** `Main.dc.html` and `Finish.dc.html` were drawn with second-person
   prose, which design §4.7 forbids and Task 5 Step 4's grep gate fails the
   build on. The layout, type, colour and structure are the canvas's exactly;
   only the voice moved. **The canvas was not republished** — no screen changed,
   only wording inside one — so it still shows the old prose on those two
   artboards.
8. **The `Read more` explainers are inline, with outward links.** Session 9's
   canvas took §5.3's fallback of explaining inline and leaving outward links
   for phase 6. Built as drawn, with one addition: a source that carries a
   `url` renders as a link (`target="_blank" rel="noopener noreferrer"`), and a
   source without one renders as plain citation text, never a dead link — which
   is §5.3's own stated rule for the tooltip.
9. **The open answer offers a tier control but not a confidence control.**
   "I haven't worked this out yet" *is* `confidence: open`; offering to change
   it would make the answer mean something else. The tier still matters and is
   editable.

## Verification that gated the merge

Every command run, every output read, nothing inferred.

| Check | Result |
|---|---|
| `py engine/validate_content.py` on the real corpus | **PASS** — exit 0, **0 errors, 16 warnings**, coverage matrix printed |
| `node tests/wizard-generate.test.js` | **PASS** — 13 of 13, fixture **and** real corpus |
| `py tests/check_generated_map.py` | **PASS** — **16** prefix maps (4 fixture + 12 real), 0 problems |
| `py tests/test_validate_content.py` | **PASS** — `OK 3 errors, 3 warnings` |
| `py engine/render.py` | **PASS** — zero warnings, 99 nodes, 156 refs, **0 without text** |
| `git diff --stat` on the three generated files | **PASS** — **no diff** |
| **Byte identity**, `render_markdown` on the real map, LF-normalised | **PASS** — `eaedf3e4…1a90`, phase 2's baseline. **The hash did not move**, including after the `render.py` change |
| **Lockstep**: `editor-core.js`, `map-view.js`, `theme.css`, `editor.html` vs `main` | **PASS** — **zero changed lines in all four**. `render.py` +11/−1, in a function with no JS counterpart |
| `node --check` on `web/wizard.js` as an ES module | **PASS** |
| `py -m py_compile api/*.py engine/validate_content.py engine/corpus_refs.py tests/check_generated_map.py` | **PASS** |
| `py api/_test_lib.py` | **PASS** |
| **Voice gate**: the second-person grep over `web/wizard.js` and `web/wizard.html` | **PASS** — no matches |
| `grep -c 'Finish here' web/wizard.html`, and it is in the persistent header | **PASS** — 1, inside `#wz-header` |
| Every id `wizard.js` drives exists exactly once in `wizard.html`; every class it builds is styled | **PASS** — 34 ids, 24 classes, no gaps |
| **Abandonment** (design §5.6): `render.py` parses `tests/out/prefix-real-05.md` by hand | **PASS** — 6 nodes parsed |
| **Mutation check A**: `pruneLinks` returns early | **JS gate bites** — the pruning test fails |
| **Mutation check B**: `pruneLinks` stops filtering | **BOTH gates bite** — the JS test fails *and* `check_generated_map.py` reports **27 broken links** across the real-corpus prefixes. This is the gap the fixture left, and it is now closed |
| LF line endings on every file touched | **PASS** — 0 CRLF in all of them |
| No secrets or key material in anything added | **PASS** |

### What could not be checked

- **Nothing on the branch could touch the real database**, as in every previous
  phase: branch previews have no database and the Supabase/Vercel account is
  unreachable from this machine's MCP tools. The wizard's save path is phase
  1c's `/api/map`, already exercised on production by sessions 3 and 9; the
  wizard adds no route and no column.
- **No browser verification, per the standing rule.** The wizard was verified by
  parsing it, by cross-checking every id and class against the markup, and by
  running the entire content-to-markdown path under Node and `render.py`.
  **What that cannot tell anyone is whether the screens feel right in a hand.**
  The first person to open `/wizard` on a phone is doing a real check that no
  gate here replaces.

## Questions for Thomas

Session 9's three are still open and are repeated here so they are in one place:

1. **Delete `zz-schema-check` from `/admin`.** The throwaway account session 9
   made to verify the `map_versions` migration. PIN `481902`.
2. **Does INC belong third in the lens list?** A judgement call, one line to
   change in `traditions.json`.
3. **Read-more links: inline only, or out to sources mid-wizard?** §5.3 flags it
   as open. Built inline, with source links on the explainers.

And three new ones:

4. **`Spiritual gifts today` under `# Church` versus `Continuationism` under
   `# Holy Spirit`.** Decision 3 above. It is a real compare mismatch against
   your own map, and phase 5 is where it gets settled.
5. **Should §4.8 in the design document be corrected?** Its Lutheran baptism
   entry fails the validator as written, and every phase 5 session will copy it.
6. **The seed contains no `outside` position**, so that treatment ships
   unexercised. Worth a deliberate one in phase 5's first domain.

## Known limits carried forward

- `map_versions` is still write-only. **Phase 8 is its reader**, and it is
  unblocked — the wizard is exactly the feature that makes losing work possible,
  so pulling phase 8 forward ahead of phase 5 is now the defensible order.
- The corpus has 2 of 14 domains. `orderedDoctrines` returns 12.
- The wizard's `outside` branch and its second-409 path are both built and
  reviewed but not exercised by a test.
- `tests/out/` now holds 16 prefix maps, 12 of them from the real corpus. They
  are regenerated by the test run and are not committed.
