# Phase 6 — outcome (session 12, Tasks 0–2)

**Branch:** `phase-6-compare` (`run-order.md` and the session prompt both say
`phase-6-compare`; the plan's header says `phase-6-learn-compare` — the run-order name
won, same as phase 5). **Model:** Opus main thread, two Sonnet subagents.
**Session 13 (Tasks 3–7) is next, on the same branch.**

**Design canvas:** <https://claude.ai/code/artifact/2f7bf0db-0b6d-450a-b447-3611969c5277>
— four artboards: the `/learn` index and a doctrine page, the compare target picker, the
per-doctrine diff with a row expanded, and the all-traditions scorecard with its
denominators.

---

## The thing this session was told to do differently, and did

Thomas's instruction, ahead of the plan: **treat the corpus as regenerable input, not as
a one-time import.** Phase 9 will correct corpus entries after phase 6 ships, and phase
5's own outcome file says most of the corpus is still unverified against real sources. So
everything phase 6 derives from `content/wizard/` must come out of one deterministic,
idempotent command, and re-running it on an unchanged corpus must produce a zero diff —
gated the way phase 1a gated byte identity.

**Done, and it is gated in two places.**

- `node engine/build_traditions.js` is the one command. It writes all twelve
  `in_scorecard` tradition maps plus `content/traditions/manifest.json`, and nothing else
  in the repo derives from the corpus.
- `tests/build-traditions.test.js` carries a **determinism test**: every tradition built
  twice from two independently loaded copies of the corpus must be **byte-identical**
  markdown, and `buildManifest` must serialise identically. It is the phase-1a gate
  transposed onto this phase.
- Run for real: build, `git add`, build again, `git status` — **zero unstaged
  modification**. Verified, not assumed.

**The one design deviation this forced, and it is deliberate.** `phase-6-design.md` §2.2
specifies `generated_at` in the manifest. A clock in a generated file makes *every*
rebuild a diff and buries the real change in it — which defeats the whole point of §2.1's
"reviewable in a git diff" argument. **`generated_at` is replaced by `corpus_sha256`**, a
hash over the corpus JSON files in sorted-name order. It answers the question provenance
actually needs to answer ("which corpus was this built from?") and it is deterministic.
`corpus_schema_version` is unchanged.

**This paid for itself inside the same session.** The one content fix below changed
`content/wizard/salvation.json` by 13 lines; rebuilding changed exactly **two files, 4
insertions and 5 deletions** — the Roman Catholic election node, and the manifest's hash.
That is the phase 9 workflow demonstrated end to end before phase 9 exists.

### Joining on ids, never on wording

Every join in `build_traditions.js` is on `doctrine.id`, `position.id` and
`tradition.id` — the keys phase 4's schema promises are stable forever. Nothing joins on
wording. A test pins it: **`rewording a hold does not change which doctrines a tradition
holds`** rewords every `hold` in a corpus copy and asserts the Reformed map comes out with
the same node count, the same skipped list, and the same slug/tier pairs. Only the text
moves.

### Nothing corpus-derived lands in the database

Per design §2.1 the tradition maps are **files in the repo**, not rows in `users`. So the
"re-seeding must be idempotent and keyed" requirement has nothing to bite on in this
phase: there is no seed, no insert, and no migration. **Phase 6 ships no-schema, as
promised, and this session wrote no migration.**

---

## Task 1 — the tradition maps

`engine/build_traditions.js`, Node and CommonJS, implementing design §2.2's five-step
algorithm. **Twelve maps, 698 nodes.**

| Tradition | Nodes | Coverage of 86 doctrines |
|---|---|---|
| reformed | 82 | 95% |
| baptist | 81 | 94% |
| roman-catholic | 76 | 88% |
| non-denominational | 75 | 87% |
| orthodox | 62 | 72% |
| anglican | 61 | 71% |
| pentecostal | 59 | 69% |
| lutheran | 57 | 66% |
| methodist | 53 | 62% |
| anabaptist | 46 | 54% |
| restorationist | 33 | 38% |
| **inc** | **13** | **15%** |

**It is a thin layer over `wizard-generate.js`, on purpose.** `loadCorpusSync`,
`allDoctrines`, `domainName`, `tierRank`, `findDoctrine`, `findPosition` and — importantly
— `pruneLinks` are reused rather than reimplemented. `pruneLinks` is design §2.2 step 4
and phase 4 §5.6 and they are the same rule; writing it twice would be the second-parser
mistake in miniature. The serializer is `EditorCore.serialize`, never string
concatenation.

**Branch three throws, as specified.** A tradition named by two positions on one doctrine
with no `tradition_overrides` entry fails the build, naming both ids and saying "add a
tradition_overrides entry". `restorationist` on `church.baptism` is the test case.

### Two corrections to the plan's Task 1 Step 1 test file

Both because the plan's literal fixture does not exist in the real corpus. Recorded here
because the plan is not rewritten in place.

1. **The "divided tradition" test uses `restorationist`, not `anglican`.** Anglican is
   named by exactly *one* position on `church.baptism` (`regeneration`, at stance
   `permitted`), so deleting its override leaves branch two and no error. Restorationist
   is genuinely named by two (`believer` and `regeneration`). The plan's other anglican
   test — *an override wins over a single matching position* — is exactly right and
   passes; it is the same fact from the other side, and it is the case
   `decisions.md` describes as **"a tradition can need an override without being
   divided."**
2. **`quaker` is built explicitly**, because it is `in_scorecard: false` and so is not in
   `scorecardTraditions()`.

### Both parsers agree

`tests/check_tradition_maps.py` runs `render.py`'s own parser over every generated map:
**12 maps checked, 0 problems**, and its node counts match the JS side exactly, map for
map. That is the lockstep rule doing real work rather than being asserted.

---

## Task 1 Step 6 — the hand-read, and the one wince it found

Read end to end by hand on the main thread, not delegated: `reformed.md` (82 nodes),
`roman-catholic.md` (76) and `pentecostal.md` (59).

**Reformed and Pentecostal: an adherent would sign both.** The Reformed map states
cessationism, particular atonement with Dordt's minority stream named honestly,
compatibilist freedom and amillennialism-with-a-postmillennial-minority; the Pentecostal
map states initial-evidence tongues, healing in the atonement, conditional security and
pretribulational dispensationalism. Nothing caricatured, nothing flattened. The two
attributions phase 5 already flagged for Thomas (total abstinence on `Alcohol`, and
`prima scriptura` read as full biblicism) are visible in the Pentecostal map exactly as
phase 5 described them — they are on his list already and this session did not change
them.

**The wince, and it is a real one: the Roman Catholic map stated Molinism as the
communion's position on election.** `salvation.election/molinist` is the only election
position naming `roman-catholic` (stance `permitted`), so branch two fired and the
generated map put one permitted school in the whole church's mouth — while the *same
map's* `Divine foreknowledge` node correctly says the Thomist and Molinist accounts are
both allowed and neither may condemn the other. A Catholic reading it would not sign it.

**Fixed in `content/wizard/`, never in the generated file**, per global constraint 3 and
Step 6's own instruction: a `tradition_overrides["roman-catholic"]` on `salvation.election`
spanning the Molinist position, stating that predestination to evil is denied and saving
grace is wholly gratuitous while the grace/consent relation is left formally undefined,
cited to Trent Session 6 and to the Congregatio de Auxiliis closing in 1607 without a
definition. Same shape as the existing `anglican` baptism override and the `lutheran` one
`decisions.md` corrected.

This is a **content** entry in an existing field — no new field, no schema change, no
migration — so it does not trip `decisions.md`'s "anything touching the data model or a
file format stops and waits". Validator still exit 0, 0 errors, 31 warnings (unchanged).

### The deuterocanon problem did not materialise, and structurally cannot

Phase 5 flagged that `fetch_verses.py` serves the Protestant canon only, so a
deuterocanonical reference can never resolve — and that phase 6 meets this head-on when it
builds the Catholic and Orthodox maps. **It does not, and the reason is worth writing
down.** Checked directly: **0 unresolvable refs across all twelve tradition maps**, and
the Catholic and Orthodox `Canon` nodes carry `2 Pet 3:15-16`, which resolves.

Two things make it structural rather than lucky. Phase 5 already moved `2 Macc 12:44-45`
out of `refs` and into the position's `sources`. And the generator writes only
`hold`/`why`/`vs`/`todo`/`refs`/`link` — **`sources` has no path into a generated map at
all**, because the file format has no field for it. So the honest rule phase 5 asked for
("deuterocanonical references live in `sources` and never in `refs`") is enforced by the
map format itself on this path. It still needs stating in the corpus documentation for
the *wizard's* sake, which is where a `sources` entry does reach a reader.

### INC's map is thin and honestly shaped

13 nodes, and all thirteen are the high-tier doctrines the Declaration of Faith (February
2022) actually addresses: inerrancy, canon, sufficiency, the Trinity, the two natures, the
virgin birth, the bodily resurrection, the atonement, continuationism, baptism, the
Supper, the second coming, the exclusivity of Christ. It is not a map with holes in
random places; it is a short confession rendered faithfully. `decisions.md`'s coverage
floor for publishing a thin map under a real communion's name is a **Task 3/4 decision**,
and `manifest.json` now carries `node_count` and `skipped` per tradition so that task can
enforce a floor without recomputing anything.

---

## Verification run in this session

Every command run, every output read.

| Check | Result |
|---|---|
| `py engine/validate_content.py` | **PASS** — exit 0, 0 errors, 31 warnings (unchanged by the corpus fix) |
| `node tests/build-traditions.test.js` | **PASS** — 8/8 |
| `node engine/build_traditions.js` | **PASS** — 12 maps, 698 nodes |
| **Idempotence**: build, stage, build again, `git status` | **PASS** — zero unstaged modification |
| `py tests/check_tradition_maps.py` | **PASS** — 12 maps, **0 problems**, node counts match the JS side |
| Every `refs` part in every tradition map resolves in `verses.md` | **PASS** — **0 unresolvable** |
| `node tests/wizard-generate.test.js` (phase 4's gate, after the corpus edit) | **PASS** — all passed |
| `py tests/check_generated_map.py`, after `rm -rf tests/out` | **PASS** — 90 prefix maps, 0 problems |
| `py engine/render.py` | **PASS** — zero warnings, 99 nodes, 156 refs, 0 without text |
| `git status` on the three generated files | **PASS** — no diff |
| **Byte identity** on `theology-map.md` | **PASS** — `eaedf3e4…1a90`, phase 2's baseline. **Unmoved.** |
| **Lockstep**: the six engine files vs `main` | **PASS** — **zero changed lines in all six** |
| Static `content/` serving on production | **PASS** — `/content/wizard/manifest.json` returns **200**, so `/content/traditions/*.md` needs no new function |
| No secrets in anything added | **PASS** |
| **Post-merge, on production**: `/content/traditions/reformed.md`, `manifest.json` and `/engine/compare-core.js` | **PASS** — all **200**. The maps and the engine are served statically, with no new function, as design 2.1 predicted |

---

## Task 2 — the compare engine

`engine/compare-core.js`, 306 lines, pure UMD, no DOM and no fetch, running headless
under Node. `tests/compare-core.test.js`, **15 tests, all green.** Written by a Sonnet
subagent against design §4.2–4.7 verbatim; I re-ran the suite myself and read the file
end to end before committing, and made two changes to it (both below).

All ten verdict strings as specified. `resolvePosition` is design §4.2 exactly.
`closestTradition` carries both guards — fewer than eight resolvable doctrines refuses to
name a tradition, and a gap of three or fewer flags both as `joint` — with **no tier
weighting**, and returns `numerator`, `denominator` and `excludedCount` per tradition so
the UI can always state its denominator. `scorecard` is traditions only and says in a
comment why a person-vs-person one must never be added. `canBeComparedAgainst` is one
predicate in one place.

**`normalise` strips exactly four things**: it lowercases, collapses whitespace, strips
one trailing full stop and strips one layer of surrounding quotes. No fuzzy matching, no
stemming, no similarity threshold. A near-match resolves to `own-wording`, which is shown
honestly as *worded their own way* and counted as neither agreement nor difference.

### The dependency shape, and why it is right for a reason the brief did not give

`compare-core.js` takes `wizard-generate.js` as an injected UMD dependency and
deliberately does **not** import `build_traditions.js`, which requires `fs` at true top
level and so could never load in a browser. It therefore restates two four-line pure
helpers (`scorecardTraditions`, `findTradition`) rather than importing them.

The obvious tidier alternative — move those two helpers into `wizard-generate.js` and have
both files import them — is **wrong here, and the reason is the lockstep rule**:
`wizard-generate.js` is one of the six lockstep-bearing engine files phase 5 gates on, and
editing it would have cost this phase its "zero changed lines in all six" result for eight
lines of deduplication. Duplicating two trivial pure functions is the cheaper mistake.

### Two things I changed after reading it

1. **Two traditions whose overrides span the same positions were reported as `differ`.**
   Anglican and Lutheran both span `infant-covenant` and `regeneration` on
   `church.baptism`; design §4.2 names only the *same*-tradition case, so cross-tradition
   overlap fell through to a flat difference — a disagreement the corpus does not claim,
   which global constraint 2 forbids. Now: overlapping spans yield `agree-in-substance`.
   Pinned by a test.

2. **A mutation walked past the entire suite, and that is the more useful finding.**
   Replacing the trailing-full-stop strip in `normalise` with a strip-*all*-punctuation
   rule — a straightforwardly fuzzier matcher, exactly what §4.2 forbids — **failed zero
   tests**, because no two holds in this corpus differ by punctuation alone. The
   no-fuzzy-matching rule was the most important rule in the file and nothing pinned it.
   It now has a direct unit test on `normalise` itself, asserting both what it strips and
   the seven things it must leave alone. Re-mutated afterwards: **the gate bites.**

   The general lesson, and it is phase 5's lesson again from the other side: a gate that
   only tests a rule *through* real data tests the data, not the rule. Phase 5 found a
   mutation that looked like a weak gate and was not; this is a gate that looked strong
   and was not.

### The other mutation check

`pruneLinks` stops filtering in `build_traditions.js` → `check_tradition_maps.py` reports
**240 broken links** across the twelve maps and the JS suite fails. Both gates bite.
Restored and re-run green.

---

## The superseded-wording decision

Thomas's instruction: `decisions.md` freezes the file format, so compare recovers a user's
position by exact normalised match on the `hold` sentence — which means **rewording a
corpus `hold` in phase 9 silently breaks compare for every user whose map already carries
the old wording.** Every one of those maps would resolve to `own-wording`: not a wrong
answer, but a silent loss of every verdict the person had.

**Decision: `compare-core.js` reads an optional `superseded_holds` array on a position and
on a `tradition_overrides` entry, and matches a node's hold against any wording in it.
Nothing is written into the corpus by this phase, and neither the schema nor the validator
is touched.**

Where the alternatives fell:

- **Recording the position id in the map** is the obvious fix and is **forbidden** —
  `decisions.md`, *after the phase 4 and 6 design review*: "The file format stays frozen. A
  generated node does not record which wizard position produced it." The readability of
  `theology-map.md` by a person is the premise of the project.
- **A separate index file** mapping old wording → position id is a second source of truth
  about the corpus, sitting beside the corpus, updated by hand. It rots.
- **`superseded_holds` on the position itself** keeps the old wording next to the new one,
  in the file the person editing is already in, and makes a phase 9 correction a two-line
  edit: change the `hold`, push the previous text into `superseded_holds`.

Why it does not trip `decisions.md`'s "anything touching the data model or a file format
stops and waits": it adds no required field, no column, no migration, and **no change to
`theology-map.md`'s format at all**. It is an optional key in a JSON file, and the
validator was checked — it does not reject unknown keys, so the corpus stays valid with or
without it. The read side is three lines and is exercised by a test that reroutes a real
position's wording through it. **Nothing enforces that phase 9 actually populates it** —
that is a documentation obligation, recorded in `CLAUDE.md` and flagged here, not a gate.

---

## Decisions I made for you

None touch the data model or the file format.

1. **`generated_at` → `corpus_sha256` in `content/traditions/manifest.json`**, so the
   build is idempotent. Reasons above. Reversible in one line if you would rather have a
   timestamp than a zero diff.
2. **The Roman Catholic election override**, above. It is the only content this phase
   added, and it is the only kind of change Task 1 Step 6 is allowed to produce.
3. **The two plan-fixture corrections** (`restorationist` for the divided-tradition test,
   `quaker` built explicitly), because the plan's literal fixtures do not exist.
4. **Cross-tradition override overlap reads as `agree-in-substance`**, extending design
   §4.2 by one line rather than reporting a difference the corpus does not claim.
5. **`superseded_holds` is read but never written**, above.

## Raised, not decided — for you

1. **Can a person keep a map public but opt out of being a comparison target?**
   `decisions.md` flagged this and did not decide it. It needs an `is_comparable` column,
   which is a data-model change, so it **stops and waits** — plan Task 6, next session.
   `canBeComparedAgainst` is one predicate in one place and is ready for either answer.
   Until then: public means comparable, which is your own locked call.

2. **Three doctrines are named after one of their positions**, so a tradition that rejects
   that position gets a node whose title says the opposite of its `hold`: `Open theism`,
   `Continuationism` and `EFS / ESS`. The Reformed map reads `## Continuationism · T2 ·
   confident / hold The revelatory and sign gifts … ceased`. It is not a generator bug —
   `node_title` is the join key compare depends on, and `Continuationism` is what **your
   own map** calls it, which is why phase 5 matched it. But it reads oddly, and renaming
   any of them is a corpus change with compare consequences. Yours to call, and it belongs
   with phase 9.

3. **`orthodoxy: "contested"` was not leaned on**, per phase 5's warning (80 of 250). The
   compare engine ignores the field entirely. `/learn` in the next session is the first
   surface that might read it, and on this evidence should not.

## Known limits carried forward to session 13

- **Tasks 3–7 are not started**: `/view?tradition=`, `/learn`, `/compare`, the public-map
  guard on `api/map.py`, and the `vercel.json` rewrites. This session was scoped to Tasks
  0–2 by `run-order.md`.
- **Nothing here has been seen on a screen.** No browser verification, per the standing
  rule. The engine is verified headless and the maps are verified by two parsers, but the
  design canvas is a mockup, not a rendered page.
- **The coverage floor for a thin tradition map is not implemented.** INC is 15% (13 of
  86) and Restorationist 38%. `manifest.json` carries `node_count` and `skipped` per
  tradition so Task 3/4 can enforce a floor without recomputing anything.
- **`tests/out/` was cleared before `check_generated_map.py` ran**, per phase 5's finding.
  Do it again next session; it reads whatever is there.
- The throwaway accounts (`zz-phase8-check`, `zz-phase8-check-2`, `zz-schema-check`) are
  still in the gallery and still need an admin PIN. Nothing in this phase could clear them.

---
---

# Phase 6 — outcome (session 13, Tasks 3–7)

**Branch:** `phase-6-compare`, the same branch session 12 used. **Model:** Opus main
thread, two Sonnet subagents (one per surface, Tasks 4 and 5 in parallel).
**Design canvas:** unchanged — <https://claude.ai/code/artifact/2f7bf0db-0b6d-450a-b447-3611969c5277>

Tasks 3–7 are complete and merged. What follows is what landed, what the plan got
wrong about the repo as it now stands, and the findings the hand-read produced.

## What shipped

| Path | What it is |
|---|---|
| `web/view.html` | **modified** — a `?tradition=` branch, same page and same render call |
| `web/corpus.js` | **new** — one corpus loader and one `STANCE_TEXT`, shared by three pages |
| `web/learn.html` / `web/learn.js` | **new** — the by-doctrine reference surface, three views |
| `web/compare.html` / `web/compare.js` | **new** — picker, per-doctrine diff, closest tradition, scorecard |
| `api/map.py` | **modified** — a public `?name=` read path (see below) |
| `web/wizard.js` | **modified** — reads `corpus.js`; accepts `/wizard?doctrine=<id>` |
| `vercel.json` | **modified** — `/learn` and `/compare` rewrites |
| `content/wizard/*.json` | **modified** — seven corpus corrections, below |

## Three places the plan was wrong about the repo, and what was done instead

The plan was written before phase 7 and before the August UI rounds. None of these
are judgment calls; the repo had moved.

1. **Task 3's code assumes `/view?id=`. That parameter no longer exists.** `view.html`
   is keyed by `?name=` and POSTs `{name}` to `/api/render`, which fetches the map
   server-side (phase 2, B1: the row id authorises a save, so it is not public). The
   tradition branch therefore fetches `content/traditions/<file>` client-side and
   POSTs `{markdown}` — a shape `api/render.py` already supports. No route added, no
   change to `api/render.py`.

2. **Task 6 says to guard the `user_id` GET on `is_public`. Doing that would have
   been a bug.** With ids no longer public, the only callers holding one are the
   owner (wizard, editor) and the admin console — so an `is_public` guard there
   would lock an owner out of their own unlisted map. The exposure moved to the
   **name**, so the guard went there: `GET /api/map?name=` returns markdown **only**
   for a public map and 404s otherwise, and never returns an id. Same rule, applied
   where the public key actually is. `/compare?name=` is consequently the member
   deep link, not the plan's `?user=`.

3. **Task 5's member fetch (`/api/map?user_id=<targetId>`) is unreachable** for the
   same reason — `/api/gallery` publishes no ids. Compare uses `?name=`.

**The plan's byte-identity constant (`eaedf3e4…1a90`) is stale.** Phase 7 redesigned
the generated views and re-baselined deliberately; `CLAUDE.md` line 248 carries the
current hash. Verified against **that**: `0125f4df…3767`, exact match.

## The hand-read (Task 7 Step 2), and the six things it found

`roman-catholic.md` (76 nodes) and `orthodox.md` (62) read end to end on the main
thread. Both are broadly excellent — the Orthodox map's `Justification`,
`Sovereignty and free will`, `Prima scriptura`, `The Fathers`, `Intermediate state`
and `The creeds` entries are genuinely Eastern and well made, and the Catholic map's
`Divorce and remarriage`, `Church and the public square` and `Euthanasia` entries
would be signed without hesitation.

**Every problem found had one cause: a position shared with a Western tradition
carries prose written from the Western side.** The per-tradition `citation` fields
are consistently right (Dositheus, Philaret, John of Damascus for Orthodoxy); it is
the shared `hold`/`why` that leaks.

### 1. The Orthodox map confessed Lutheran eucharistic doctrine — the real defect

`orthodox` sat in `church.lords-supper/real-presence`'s `held_by`, whose `hold` is
the Lutheran *"in, with and under … received by all communicants whether or not they
believe"* and whose `vs` explicitly rejects *"a change in the substance of the
elements."*

**The corpus already knew this was wrong.** That same `held_by` entry's own note
reads *"The East affirms a real change but has historically declined to define it in
the Western scholastic vocabulary of substance and accident,"* cited to **Confession
of Dositheus (1672), Decree 17** — the decree that uses μετουσίωσις. The note
contradicted the position it was attached to. And because `build_traditions.js`
writes only `hold`/`why`/`vs`/`todo`/`refs`/`link`, **a `note` has no path into a
generated map**: the qualification was invisible and only the contradiction shipped.

Fixed in `content/wizard/church.json`: the Orthodox entry moved to the
`transubstantiation` position — the one position in the corpus that affirms a change
— plus a `tradition_overrides["orthodox"]` spanning it, so the generated node states
it in Orthodox terms (*the manner of the change confessed as a mystery rather than
defined in the scholastic vocabulary of substance and accident*) rather than under a
Latin label. Same shape and same reasoning as session 12's Roman Catholic election
override. Citation unchanged — Dositheus Decree 17, already in the corpus. Node
count unchanged.

**This is the class of error phase 9 exists to find, found by reading one map.** It
was not a sourcing gap: the source was right and the position was wrong.

### 2. Five `why` lines written from outside the tradition holding them

All five are shared positions. `why` is free to change — compare matches on `hold`
— so all five were corrected in place, five lines total:

| Position | Was | Now |
|---|---|---|
| `salvation.perseverance-and-apostasy/mortal-sin-restoration` | grounded in **Trent** | the shared logic, no council named |
| `salvation.assurance/present-grace-only` | grounded in **Trent** | as above |
| `humanity-and-sin.depravity-and-prevenient-grace/synergistic` | *"Catholic and Orthodox theology reject…"* | stated from inside |
| `humanity-and-sin.age-of-accountability/baptismal` | *"**Both traditions** treat baptism…"* — no antecedent in a single-tradition map | stated from inside |
| `god.divine-foreknowledge/simple` | *"the classical **Arminian** tradition has held exactly this since the Remonstrance"* — held by six traditions including Orthodoxy | no single tradition named |

An Orthodox reader was being told that **Trent** grounds their belief about grace and
assurance. That is the sharpest wince in either map after the Eucharist.

**Phase 9 should restore per-tradition grounds** — the right home for them is each
`held_by` entry's own `citation`, which is already correct and was not touched.

### 3. Two "Rome" holds — and the first real use of `superseded_holds`

`creation-and-science.miracles-and-science` and `.age-of-the-earth` each carried a
`roman-catholic` **override** whose `hold` began *"Rome affirms…"* / *"Rome takes no
confessional position…"* — the only two nodes in the map referring to the communion
in the third person, and a term many Catholics read as othering.

Because both live on an **override**, they reach only the Roman Catholic map, so the
blast radius is one tradition plus any member map carrying that exact wording.
Reworded, with the previous text pushed into **`superseded_holds`**.

**Session 12 shipped `superseded_holds` read-but-never-written and flagged that
nothing enforced a writer. This is its first writer, and the path is now proven end
to end**: a map carrying the old *"Rome takes no confessional position…"* wording
still resolves to
`creation-and-science.age-of-the-earth/@override:roman-catholic`, not to
`own-wording`. Verified by running it, not by reading the code. Phase 9 has a
worked example to copy.

### 4. Raised, not fixed — for Thomas and for phase 9

- **`creation-and-science.genre-of-genesis-1` attributes six-ordinary-day literalism
  to Orthodoxy as its position.** Orthodoxy has no dogmatic position here and the
  patristic readings vary widely. Left alone deliberately: correcting it means
  removing or re-sourcing a `held_by` entry, which is phase 9's job and needs a
  retrieved source, not a guess. **Flagged as a Tier A/B phase 9 item.**
- The Catholic `Atonement` node states satisfaction alone with penal substitution as
  its `vs`. Defensible and recognisable; noted, not changed.

## The finding that matters most for anyone testing this

**Compared against `theology-map.md` — Thomas's own hand-written map — every single
doctrine reads `own-wording`.** Measured: **73 of 86 rows own-wording, 12 undecided,
1 rejected, and zero resolved to a position.** No closest tradition is named and the
scorecard is empty of verdicts.

**This is correct behaviour, not a bug.** Compare recovers a position by exact
normalised match on the `hold` sentence, and Thomas wrote his holds by hand years
before the wizard existed. `CLAUDE.md` is explicit that his map "is not user 1's row
in the database." A **wizard-built** map resolves properly — a tradition map against
itself is 82 of 82 agree with zero differences, and Reformed vs Baptist is 50 agree,
10 agree-in-substance, 17 differ, which reads as a real and recognisable set of
disagreements (creeds recited vs affirmed; renewed vs replaced creation; meticulous
vs general providence).

Per the plan's own instruction, **the match was not loosened to improve this number.**

One copy fix was made instead. The closest-tradition guard fires below eight
resolvable doctrines, and its specified copy — *"not enough answered questions
yet"* — is actively misleading to someone whose map is complete but hand-written.
`compare.js` now distinguishes the two cases and says which one applies. **This is
the first thing to expect a "compare is broken" report about, and it will be Thomas's
own map that produces it.**

## Decisions made rather than waiting

1. **`web/corpus.js`.** Three pages needed `loadCorpus()` and `STANCE_TEXT`; phase 4
   had both private inside `wizard.js`. Extracted rather than copied twice — the
   plan's Task 4 Step 3 asked for exactly this. `wizard.js` imports them now.
2. **`/wizard?doctrine=<id>`.** The plan requires a `mine-unanswered` row to link
   "into `/wizard` at that doctrine" and no such deep link existed. Six lines in
   `wizard.js`'s `main()`, matching on `doctrine.id`.
3. **An override spanning one position no longer reads "No single position."** Three
   of the corpus's 53 overrides span exactly one, and each says in its own note that
   the tradition is *not* divided. `/learn` would have invented a division the corpus
   explicitly denies.
4. **Gallery rows reach `canBeComparedAgainst` as `{...row, is_public: true}`**, with
   a comment: `/api/gallery` is public-only by construction and carries no such
   field. One predicate, one gate — not a second one.
5. **Scorecard glyph collapse**: agree / agree-in-substance / differ keep their own
   glyph, everything else collapses to "no position". Design §4.5 names four glyphs
   without enumerating the mapping.

## Still open — needs Thomas, not a session

**Can a person keep a map public but opt out of being a comparison target?**
Unchanged from session 12 and still not decided. It needs an `is_comparable` column,
which is a data-model change, so it stops and waits. Design §8's three options stand.
Until then **public means comparable**, which is the locked call, and phase 6 ships
the two no-schema mitigations: the picker says plainly that a public map can be
compared against, and **no comparison is notified, logged or counted** — nothing in
`compare.js` records anything anywhere.

Session 12's other two open items also stand unchanged: the three doctrines named
after one of their positions (`Open theism`, `Continuationism`, `EFS / ESS`), and
`orthodoxy: "contested"` — which `/learn` now surfaces as a plain "Contested" label
with the corpus's own note, and which the compare engine still ignores entirely.

## Verification — every command run, every output read

| Check | Result |
|---|---|
| `py engine/validate_content.py` | **PASS** — exit 0, 0 errors, 31 warnings (unchanged by seven corpus edits) |
| `node engine/build_traditions.js` | **PASS** — 12 maps, **698 nodes**, unchanged |
| `node tests/build-traditions.test.js` | **PASS** — 8/8, exit 0 |
| `node tests/compare-core.test.js` | **PASS** — 14 ok, 1 skipped (no equivalence pair in corpus), exit 0 |
| `py tests/check_tradition_maps.py` | **PASS** — 12 maps, **0 problems** |
| `node tests/wizard-generate.test.js` (after `rm -rf tests/out`) | **PASS** — all passed |
| `py tests/check_generated_map.py` | **PASS** — 90 prefix maps, 0 problems |
| `py engine/corpus_refs.py` then `fetch_verses.py` | **PASS** — 482 entries, **0 blank** |
| Every `refs` part in all 12 tradition maps | **PASS** — 1608 ref parts, **0 unresolvable** |
| `py engine/render.py` | **PASS** — zero warnings, 99 nodes, 156 refs, 0 without text |
| `git diff` on the three generated files | **PASS** — no diff |
| **Byte identity** `theology-map.html` | **PASS** — `0125f4df…3767`, exactly `CLAUDE.md` line 248 |
| **Lockstep**: `git diff main -- engine/` | **PASS** — **zero changed lines**, all six files |
| `node --check` on `learn.js`, `compare.js`, `corpus.js`, `wizard.js` | **PASS** — all parse |
| Second-person voice grep, all four new files | **PASS** — none |
| `innerHTML` grep, all four new files | **PASS** — none |
| Self-comparison (reformed vs reformed) | **PASS** — 82 agree, **0 differ** |
| Cross-comparison plausibility (reformed vs baptist) | **PASS** — read by eye, three rows checked against the corpus |
| `superseded_holds` round trip on a reworded hold | **PASS** — old wording resolves to the position, not `own-wording` |
| Secrets in anything added | **PASS** — none |

**Not verified, and stated plainly**: nothing here has been seen on a screen. Browser
verification is forbidden by the standing rule, so the two new surfaces are verified
by parse, by grep, by reading them end to end, and by exercising every engine call
they make headlessly against real data — but no one has looked at `/learn` or
`/compare` in a browser. **That is the largest remaining risk in this phase**, and
it is a layout risk rather than a logic one.

## For the next session

- Phase 9 (`phase-9-corpus-sourcing-verification.md`) is the only phase left.
  It now has three concrete leads from this session: the Genesis 1 Orthodox
  attribution, the five `why` lines needing per-tradition grounds restored, and a
  proven `superseded_holds` workflow.
- **The pattern worth generalising for phase 9**: this session found a wrong
  attribution *without web access*, because **the corpus contradicted itself** — a
  `held_by` note that denied the position it was attached to. Cross-checking notes
  against their own position's `hold` and `vs` is cheap, needs no retrieval, and
  should run before the expensive tier-by-tier sweep.
- The throwaway accounts (`zz-phase8-check`, `zz-phase8-check-2`, `zz-schema-check`)
  are still in the gallery and still need an admin PIN.
