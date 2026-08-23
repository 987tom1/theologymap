# Phase 5 — outcome

**Branch:** `phase-5-corpus` (the brief said `phase-5-content`; `run-order.md` and
the session prompt both say `phase-5-corpus`, and that name won). **Model:** Opus
main thread, eight Sonnet research subagents. **Merged to `main`** with `--no-ff`;
every gate below passed first.

**The corpus is complete: 14 of 14 domains, 86 doctrines, 250 positions, 51
`tradition_overrides`.** Phase 4 handed over 2 domains and 12 doctrines.

---

## The thing this phase was told to do deliberately, and did

`decisions.md`, *after phase 4 session 10*:

> **A seed with no `orthodoxy: "outside"` position is acceptable.** … **This becomes
> phase 5's job:** the *Outside the historic creeds* treatment … is built and reviewed
> but has never rendered real content. **Phase 5 must exercise it deliberately in its
> first domain and say in its outcome file that it did.** Do not assume it works
> because it renders.

**Done, in `god.json`, which is the first domain phase 5 wrote** (Scripture and
Church already existed, so God is the first new one, and it is `order: 2` in the
manifest — the first domain a wizard user meets after Scripture).

`god.trinity/oneness` — Oneness Pentecostalism, `orthodoxy: "outside"`, with an
`orthodoxy_note` naming the Nicene-Constantinopolitan Creed of 381 and the
Athanasian Creed's requirement that the persons not be confounded. It is **held by
a real registered tradition** (`oneness-pentecostal`, from the UPCI Articles of
Faith), which matters: the branch is now exercised by a position with a genuine
holder and a genuine citation, not by a strawman written to fill a slot. The
doctrine is `kind: "settled"`, so this also exercises the rule that a settled
doctrine still offers any `outside` positions phase 5 supplies.

**I wrote this file on the main thread rather than delegating it**, precisely
because it carried this requirement.

**Three `outside` positions exist in the finished corpus**, and only the first has a
holder:

| Position | `held_by` | Grounded in |
|---|---|---|
| `god.trinity/oneness` | `oneness-pentecostal` | Constantinople 381; the Athanasian Creed |
| `humanity-and-sin.depravity-and-prevenient-grace/pelagian` | *(empty)* | Carthage 418; Ephesus 431 |
| `missions-and-world-religions.exclusivity-of-christ/pluralism` | *(empty)* | Nicaea 381; Chalcedon 451 |

**What this still does not prove.** The branch is exercised by *content*, and the
whole content-to-markdown path runs green over it. It has not been seen on a screen
— no browser verification, per the standing rule — so what remains unverified is
whether the banner, the note and the sort-last actually *look* right. The first
person to open the Trinity question on a phone is doing a real check that no gate
here replaces.

---

## The second thing run-order.md asked this phase to watch

> `render.py` now ships only the verses a map actually cites, so watch
> `theology-map.html`'s size as domains are added.

**It holds exactly.** `documentation/verses.md` grew from 156 references to 415
across this phase — 259 new ones, all fetched — and `theology-map.html` is
**byte-identical at 123,870 bytes**, with `git diff` empty on all three generated
files. Phase 4's one-line fix is doing its job; without it this phase would have
inflated every hosted render by roughly 250 verses of scripture text.

The third flagged item — design §4.8's Lutheran `tradition_overrides` entry — was
already fixed before this session and needed nothing. It is present and correct in
`church.baptism`, and I spot-checked the Lutheran entries because of it.

---

## What landed

| Domain | Doctrines | Written by |
|---|---|---|
| `god` | 7 | **main thread** (carries the `outside` exercise) |
| `christ` | 7 | Sonnet |
| `holy-spirit` | 6 (1 pre-existing) | Sonnet |
| `humanity-and-sin` | 6 | Sonnet |
| `salvation` | 7 | Sonnet |
| `last-things` | 7 | Sonnet |
| `creation-and-science` | 6 | Sonnet |
| `the-unseen-realm` | 5 | Sonnet |
| `ethics` | 9 | Sonnet |
| `formation-and-practice` | 5 | Sonnet |
| `missions-and-world-religions` | 5 | Sonnet |
| `church-history-and-authority` | 5 | Sonnet |
| `scripture`, `church` | 11 | phase 4 |

Also `docs/hosting/phase-5-agent-brief.md` — see below.

---

## The spend limit hit again, harder, and the brief written for it worked

`run-order.md` warned: *two of four subagents were killed mid-run by an
account-level spend limit; phase 5 is the most fan-out-heavy phase left, so brief
each agent narrowly enough that the main thread can finish its file rather than
restart it.*

**Five of six agents in the second wave were killed by the monthly spend limit.**
What the brief bought:

- **Three of the five had already saved complete files** (`christ`, `ethics`,
  `creation-and-science`) because every brief said *save after each doctrine, so a
  partial file is still usable if you are cut off*. Their work survived entirely.
- **Two had written nothing** (`salvation`, `formation-and-practice`) — killed
  before their first save. Those two were the only ones that had to be re-run.
- The 24 validator errors the three dead-but-saved agents left were **finished on
  the main thread in one pass**, not by re-running the agents. That is the whole
  point of the instruction and it is worth keeping for any future fan-out phase.

**The one lever that mattered most was `docs/hosting/phase-5-agent-brief.md`** — the
schema of record's §4 compressed into a single self-contained contract, so a domain
agent reads ~9KB instead of `phase-4-design.md` (36KB) plus `phase-4-outcome.md`
(42KB) plus `decisions.md` (18KB). It is committed rather than thrown away, because
the corpus is not finished (see gaps below) and the next session filling a domain
should read it rather than reconstruct it.

**The errors the agents actually made**, all mechanical, all caught by the
validator, and all worth putting in the next fan-out brief verbatim — which I did,
in the second wave, and the second wave made almost none of them:

| Error | Count |
|---|---|
| `hold` longer than 320 characters (mostly in `tradition_overrides`) | 9 |
| a `sources` entry with a `label` and no `citation` | 9 |
| missing `tradition_overrides` where a tradition holds two positions (rule 15) | 3 |
| a bare Roman numeral `I` read as first person (`Lambeth Resolution I.10`) | 1 |
| missing `orthodoxy_note` on a non-`historic` position | 1 |

The Roman numeral is worth its own line: **`Article I` and `Session VI` and
`Lambeth I.10` all trip the voice rule**, because `I` is word-boundary-matched
case-insensitively. The fix is to write `Article 1` or move it into `citation`,
which is not voice-checked. It will happen again.

---

## Where the schema turned out to be the wrong shape for real content

The brief calls this *the most valuable thing this phase can report back*. Nothing
below was changed — the data model and the file format stop and wait, per
`decisions.md`.

1. **`orthodoxy: "contested"` has drifted into a default.** 80 of 250 positions
   carry it — nearly a third. §4.5 defines it as *a live and sharp intra-Christian
   dispute where one side regards the other as gravely mistaken*, which is not true
   of a third of the corpus; agents reached for it whenever a doctrine felt
   important. **It is currently harmless** — §4.5 gives `contested` no UI treatment
   at all — but phase 6's learn page is the first thing that might read it, and it
   would be reading noise. Either the field needs a tighter test in the validator,
   or phase 6 should ignore it.

2. **`orthodoxy: "outside"` gets reached for on the strength of a proof text.** Two
   positions arrived marked `outside` citing Acts 4:12. §4.5's test is *contradicts
   an ecumenical creed or conciliar definition* — a verse is not that, and `outside`
   is the one marker that puts a banner on a reader's screen. I regrounded
   `pluralism` in Nicaea and Chalcedon (Hick denies the incarnation, which is what
   actually puts it outside) and downgraded `dual-covenant` to `contested` (its
   holders confess the creeds without qualification). **The validator cannot check
   this** — rule 13 only requires the note to be non-empty, not that it names a
   council. A rule that required an `outside` note to cite a council by name would
   have caught both.

3. **The corpus can cite books the verse pipeline cannot serve.** `2 Macc 12:44-45`
   is the classic text for prayer for the departed and is canonical for the Orthodox
   and Catholic positions that need it — but `fetch_verses.py` queries the NET Bible
   API, which serves the Protestant canon only, so it can never resolve and looks
   exactly like a bad reference. I moved it out of `refs` into the position's
   `sources`. **This will recur**, because `scripture.canon` is itself a doctrine in
   this corpus and phase 6 will build a Catholic and an Orthodox tradition map. The
   honest options are a deuterocanon-aware source for `verses.md`, or a documented
   rule that deuterocanonical references live in `sources` and never in `refs`. It
   is a real gap between the schema and the traditions the schema exists to
   describe.

4. **`tradition_overrides` remains the most misreadable corner, now for a fourth
   reason.** Phase 4 recorded three agents getting it wrong three ways. This phase
   adds a fourth: agents write the override but omit it for the *second* tradition
   in the same doctrine, because the error message names one pair at a time and they
   fix only what was named. 51 overrides now exist and they are load-bearing for
   phase 6.

---

## Decisions I made for you

None touch the data model or the file format.

1. **Two orthodoxy markers regrounded**, as in point 2 above. Reversible, and both
   are on the list for you below.
2. **The Catholic option on the solas was relabelled** from `Grace, faith and works`
   to `Faith formed by charity`. The original is a Protestant's name for the
   position; *fides caritate formata* is Trent's own category. Caught by the brief's
   own spot-check, which is the strongest argument for keeping that step.
3. **Two phase-4 test assertions now derive from the corpus instead of freezing a
   number.** `tests/wizard-generate.test.js` pinned `orderedDoctrines(real).length`
   at 12 and the domain list at the three seed files. Phase 5's entire job is to
   grow past both, so they failed on the first domain that landed. They now assert
   that every manifest domain whose file exists on disk loads and no other, that the
   prefix count equals the doctrine count, and that the corpus never shrinks below
   12. **The test's real force is unchanged** — the mutation check below proves it.
4. **Node titles match `theology-map.md` exactly wherever the doctrine exists in
   your map**, including `Sanctification — progressive` with a U+2014 em dash
   verified byte-for-byte against the heading. Compare is per-doctrine and only
   lines up if the titles agree.
5. **Some of your nodes were deliberately not turned into wizard questions** — see
   the gaps section. Each omission is recorded in the relevant doctrine's
   `learn_note`.

---

## Calls awaiting you

The brief asks for these in one list rather than decided in the session.

1. **`Gender identity` and `Justice and race` are not in the corpus.** Both are in
   your Ethics domain at T2 and T2.5. I held them back rather than deciding: they
   are the two questions where a wizard screen offering a stranger a menu of
   positions is most likely to land badly on a real person from your church, and
   the sourcing problem is genuinely different from the other nine — the
   confessional documents mostly predate the question, so the honest citations are
   recent denominational statements that are themselves contested. **This is the
   biggest single content gap and it is deliberate.** Say the word and they can be
   written to the same standard as `ethics.marriage-and-sexuality`, which is in and
   which does carry both the traditional and the affirming position.

2. **`Territorial spirits` (T4) is not in the corpus.** Same reasoning, less
   weight: it is a position within one stream rather than a question the traditions
   answer, and no confession addresses it.

3. **`Pentecostal heritage`, `Sanctification — definitive`, `Sanctification —
   final`, and `Second coming`'s settled bookends.** The three sanctification
   nodes and `Pentecostal heritage` were skipped as either settled or specific to
   your own movement rather than cross-traditional. A wizard question with one
   answer is arguably not worth a screen — but you may want them present anyway so
   that a generated map has the same shape as yours.

4. **INC holds a position in 15% of doctrines** — 13 of 86, a standing validator
   warning and the lowest of the twelve. This is `decisions.md` working as written
   (*where a position cannot be traced to a published INC or affiliated statement,
   say so rather than generalising from Pentecostalism at large*), not neglect. But
   15% is thin enough that INC's scorecard column in phase 6 will be mostly blank,
   and the coverage floor `decisions.md` mentions for publishing a thin tradition
   map under a real communion's name will bite here first. Two ways out, both
   yours: accept a sparse INC column, or let INC inherit from `pentecostal` where
   INC is silent, which the schema does not currently support.
   **Restorationist (38%) and Anabaptist (53%)** are thin for the same honest
   reason and warn too.

5. **Two attributions in your own tradition are worth your eye**, because you will
   know better than any source I can cite:
   - **`Alcohol` → total abstinence, `majority` for Pentecostal.** True of classical
     American Pentecostalism; my impression is that it is materially less true of
     Australian Pentecostalism, which is your actual context.
   - **`Prima scriptura` → `The Bible alone`, `majority` for Pentecostal**, where the
     `hold` says no creed or confession holds any binding authority *even
     subordinate*. That is the biblicist position, and the AG's own Statement of
     Fundamental Truths arguably functions as a subordinate standard.

6. **`dual-covenant` as `contested` rather than `outside`** — decision 1 above, and
   the agent that wrote it explicitly asked for a reviewer. It is the single most
   sensitive entry in the corpus.

7. **Suggested tiers follow your map wherever a doctrine exists in it**, so nothing
   in this phase disagrees with your tiering. The doctrines with no counterpart in
   your map took a tier from the doctrine's own stakes; those are the only ones
   where a tier is mine rather than yours.

---

## Verification that gated the merge

Every command run, every output read, nothing inferred.

| Check | Result |
|---|---|
| `py engine/validate_content.py` on the real corpus | **PASS** — exit 0, **0 errors, 31 warnings**, coverage matrix printed |
| `node tests/wizard-generate.test.js` | **PASS** — all passed, fixture **and** real corpus |
| `py tests/check_generated_map.py` — `render.py`'s own parser over every prefix | **PASS** — **90 prefix maps, 0 problems** (4 fixture + 86 real) |
| `py engine/corpus_refs.py` → `py engine/fetch_verses.py` | **PASS** — 415 references in `verses.md`, **0 still blank** |
| Every corpus `refs` part resolves to text (checked directly, not via the map) | **PASS** — 378 distinct corpus references, 0 unresolved |
| `py engine/render.py` | **PASS** — **zero warnings**, 99 nodes, 156 refs in use, 0 without text |
| `git diff --stat` on the three generated files | **PASS** — **no diff** |
| **`theology-map.html` size**, the flagged risk | **PASS** — 123,870 bytes, unchanged, after `verses.md` grew 156 → 415 |
| **Byte identity**: `render_markdown` on the real map, LF-normalised | **PASS** — `eaedf3e4…1a90`, phase 2's baseline. **The hash did not move.** |
| **Lockstep**: `render.py`, `editor-core.js`, `map-view.js`, `theme.css`, `editor.html`, `wizard-generate.js` vs `main` | **PASS** — **zero changed lines in all six.** This phase touched no engine code |
| **Mutation check**: `pruneLinks` stops filtering | **BOTH gates bite** — the JS test fails **and** `check_generated_map.py` reports **1,960 broken links** across 90 prefixes. Restored, re-run green |
| Spot-check: Roman Catholic, every option end to end | **PASS after one fix** — the solas label, above |
| Spot-check: Pentecostal and INC, every option end to end | **PASS**, with two attributions raised for you rather than changed |
| Spot-check: Lutheran on the six sacramental/christological doctrines | **PASS** — `simul iustus et peccator`, *in, with and under*, and the *manducatio indignorum* all stated as the Formula of Concord has them |
| `Sanctification — progressive` em dash vs `theology-map.md` | **PASS** — U+2014 both sides, titles identical |
| No secrets or key material in anything added | **PASS** |

### A gate that did not bite, and why it looked like it did

My first mutation put `return;` at the top of `pruneLinks`. The JS test failed but
`check_generated_map.py` reported 0 problems, which looked like the parser gate
missing a regression. It was not: an early `return` leaves nodes with **no links at
all**, so there is nothing dangling to find. Phase 4's mutation is the correct one —
make `pruneLinks` *stop filtering* rather than stop running — and with that, both
gates bite hard (1,960 broken links). **Worth knowing before anyone concludes the
parser gate is weak.**

There is a smaller real finding underneath it: `check_generated_map.py` reads
whatever is in `tests/out/`, which the JS test only rewrites if it gets that far. A
JS failure early in the run can leave **stale** prefix files for the Python gate to
pass against. Clear `tests/out/` before trusting the two together.

### What could not be checked

- **Nothing in this phase touched the database or any route.** The corpus is static
  content served from `content/wizard/`, which phase 4 verified is served on
  production. No migration, no schema change, no new function — `decisions.md` says
  phases 5–7 need no DDL and this phase needed none.
- **No browser verification, per the standing rule.** In particular the *Outside the
  historic creeds* treatment is exercised by content and by the whole
  content-to-markdown path, but has not been seen rendered. Stated above in full.
- **The 20-row `map_versions` retention** is still unverified, as it has been since
  phase 4 — it needs 21 saves an hour apart and nothing in this phase touched it.

---

## Known limits carried forward

- **Two Ethics doctrines and three of your own nodes are deliberately absent** —
  items 1–3 in the calls list. Everything else in your map that is a genuine
  cross-traditional question is covered.
- **INC at 15%, Restorationist at 38%, Anabaptist at 53%** are standing warnings and
  will shape phase 6's scorecard.
- **`contested` is over-applied** (80 of 250) and phase 6 should not lean on it
  without the tightening described above.
- **Deuterocanonical references cannot enter `refs`** until `verses.md` has a source
  that serves them. Phase 6 builds Catholic and Orthodox tradition maps and will
  meet this directly.
- `tests/out/` now holds 90 prefix maps, 86 of them from the real corpus. They are
  regenerated by the test run and are not committed.
- **The two throwaway accounts from phase 8** (`zz-phase8-check`,
  `zz-phase8-check-2`) and phase 9's `zz-schema-check` are still in the gallery and
  still need an admin PIN to remove. Nothing in this phase could clear them.
