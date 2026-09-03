# Phase 9 outcome — corpus sourcing verification

Branch `phase-9-sourcing`, completed 2026-09-03 across two sessions (the first
ended on a spend limit mid-fan-out; see "How the work was run" below).

**No schema change, no new fields, no code change.** Content only, as the brief
required. 86 doctrines, 250 positions and 53 `tradition_overrides` are unchanged
in number; no `doctrine.id` or `position.id` was touched; **no `hold` was changed**,
so `superseded_holds` was never needed and compare is unaffected for every existing
user map.

---

## The headline

Phase 5 wrote this corpus from model knowledge and retrieved nothing. Phase 9
retrieved the documents. **The claims were mostly defensible; the citations
frequently pointed at nothing.**

Sixteen clusters reported independently, and every one of them found citations
that did not check out. The same defect, over and over:

> **A plausible-looking reference number attached to whatever the tradition was
> presumed to believe, never checked against the text.**

It appears in three forms, all of them found more than once:

- **A number that doesn't exist.** Two entries cited "NAE Statement of Faith,
  Article 8". The document has seven articles.
- **A number from a different document.** Two entries cited Grudem's *Systematic
  Theology* ch. 32 and ch. 17 for divorce and prosperity. Those are "Election and
  Reprobation" and "Miracles"; the real material is in *Christian Ethics* (2018),
  a different book entirely.
- **One real citation reused as a catch-all.** Dordrecht Article 1 (God, Trinity,
  creation) was cited across nine unrelated doctrines. Thirty-Nine Articles
  Article 1 was cited across seven, of which four hold up. Formula of Concord
  Rule and Norm 1 is used correctly three times and wrongly stretched onto canon
  and clarity, which it never addresses.

This is why the phase existed, and it was worse than the INC case that prompted it.

## Counts

Counted from the worklists and the applied ops, not from agent self-reports.
"Assigned" is every `held_by` entry put in front of an agent; "corrected" is an
applied `held_by.set`. An assigned entry that was already correct and needed no
change shows in neither correction column, which is why the columns do not sum
to the assigned total.

| Tier | Entries assigned | Corrected | Removed | Added |
|---|---|---|---|---|
| A — highest risk | 172 | 58 | 13 | 1 |
| B — denominational statements | 202 | 127 | 69 | 1 |
| C — historic confessions | 128 | 88 | 17 | 0 |
| **Total** | **502** | **273** | **99** | **2** |

628 typed operations applied through `engine/apply_corrections.py`.

One caveat on Tier A's assigned figure: the named-authors worklist (A5) was built
by citation match and swept in entries citing Barclay, Stott, Calvin and Wimber,
who are outside that cluster. The agent correctly left them alone, so Tier A's
172 overstates what was actually examined by roughly the number of those entries.

`held_by` entries: **753 → 656**. Stance distribution moved as the evidence
required, not toward any target: confessional 382 → 344, majority 242 → 190,
minority 72 → 71, historic 5 → 5, permitted 52 → 46.

**Sources carrying a `url`** — an explicit phase-9 deliverable:

| | before | after |
|---|---|---|
| doctrine-level | 6 of 135 | **43 of 135** |
| position-level | 19 of 289 | **206 of 434** |

Every doctrine-level url reuses one a retrieval agent verified against the
document, matched by exact label + citation. None was invented.

## Coverage got worse, deliberately

The brief says coverage is not the goal and must never be protected. It fell, and
the fall is the phase working:

| tradition | before | after |
|---|---|---|
| non-denominational | (no warning) | 53% |
| pentecostal | (no warning) | 48% |
| lutheran | (no warning) | 56% |
| anabaptist | 53% | 43% |
| restorationist | 38% | 24% |
| INC | 15% | 15% |

Three traditions newly cross the validator's warning threshold. Nothing here
should be "fixed" by re-adding attributions; each removed entry rested on a
document that does not say what it was cited for.

## What was removed, and why

Grouped by cause. The full per-entry list with reasons is in the git history of
this branch (each `held_by.remove` op carries a `reason` field).

**Rested on something that is not a document (8).** Five restorationist entries
cited "common settled practice among Churches of Christ congregations"; others
cited "writings on the innocence of childhood", "standard Orthodox pastoral and
liturgical practice", and "read alongside the Homilies". These are unfalsifiable
by construction and cannot be checked in a browser, which is the standard the
brief set.

**The cited document is silent on the topic (87).** The largest group by far. The
NAE Statement of Faith is seven sentences and the Lausanne Covenant is about
evangelisation; between them they were carrying 33 attributions on canon,
election, hermeneutics, assurance, polity, baptism and the Supper. Dordrecht never
addresses divorce; the Thirty-Nine Articles never address body/soul constitution;
the Small Catechism's Third Article says nothing about demons or the intermediate
state.

**The document says something incompatible (4).** Fewest, and they matter most —
these are not missing citations but wrong claims:

- `salvation.justification/forensic-imputed` (restorationist) — chapter 19 of *The
  Christian System* never uses "imputed", "imputation" or "reckoned". Campbell
  ties justification to a change of state through faith, repentance and the
  ordinances. The corpus had the same tradition asserting two incompatible
  frameworks, and already stated the real one correctly under
  `regeneration-and-baptism`.
- `humanity-and-sin.image-of-god/structural` (lutheran) — Formula of Concord SD 1
  holds the image of God was *entirely lost* at the fall, directly contradicting
  the position's claim that reason and capacities are merely wounded.
- `christ.atonement/penal-substitution` (non-denominational) — Lausanne Article 4
  says only that Christ "died for our sins and was raised", with no penalty or
  wrath language. The document supports an atonement claim, but not this one.
- `missions-and-world-religions.world-religions/general-revelation`
  (non-denominational) — Lausanne Article 3 *rejects* syncretism rather than
  affirming rays of truth in other religions. The attribution was close to the
  inverse of the text.

**The two additions.** `salvation.election/corporate-in-christ` (restorationist)
replaced a removed `conditional-foreseen-faith` entry: Campbell grounds election
in Christ corporately — "the present elect of God are, then, those who are in
Christ, and not those out of him" — not in foreseen individual faith. The other
is a BF&M image-of-God re-attribution from `/functional` to `/structural`, the
position Article 3 actually supports.

## The addendum's three named assignments

**1. The free self-consistency sweep** ran first, as instructed, and is reported in
the previous session: 0 cross-communion citation mismatches, 0 label/`held_by`
mismatches. Re-run against the finished corpus, it is still 0 — this phase
introduced none.

**2. Orthodox grounds put back where they belong.** The addendum named five
positions whose shared prose is written from the Western side, and expected their
Orthodox citations to be "already in good shape". **They were not — four of the
five pointed at the wrong decree:**

| position | was cited | actually grounds it |
|---|---|---|
| `salvation.perseverance-and-apostasy/mortal-sin-restoration` | Dositheus Decree 14 (free will after the fall) | Decree 15 (Penance) + Philaret Qq. 351–353 |
| `salvation.assurance/present-grace-only` | Decree 9 (generic "faith needed") | Decree 13, which rejects assurance-by-faith-alone as "far from all Orthodoxy" |
| `humanity-and-sin.depravity-and-prevenient-grace/synergistic` | Decree 3 (predestination) | Decree 14, the grace-and-cooperation text |
| `humanity-and-sin.age-of-accountability/baptismal` | "standard Orthodox pastoral and liturgical practice" | Decree 16 (infant baptism remits original sin) |
| `god.divine-foreknowledge/simple` | John of Damascus, Book 2 ch. 30 | **already correct** — quote added |

Note on the fourth: Dositheus is silent on the fate of the unbaptised, so that
clause of the `hold` remains unevidenced by these texts. Flagged rather than
removed, because the position's main claim is supported.

**3. `creation-and-science.genre-of-genesis-1`, six-day literalism attributed to
Orthodoxy.** Left in place, deliberately, and this is a judgment call worth
recording. The attribution was re-sourced to Basil's *Hexaemeron* Homily 2.8
("twenty-four hours fill up the space of one day"), which is a real and quotable
patristic reading, and the entry was already stanced `historic` — the weakest
stance, "held historically, materially less common now" — so it was not claiming
Orthodox dogma. The `note` now says plainly that no council has dogmatised the
reading and that other fathers read it non-literally. **A future session that
prefers removal has a defensible case**; the reason for keeping it is that
`historic` + a real patristic citation is an honest description, and removal
would lose a true fact about the tradition's history.

## Two agent recommendations I overrode

Both are recorded because in one case the agent was wrong in a way that would have
destroyed correct data.

**1. Three NAE-resolution entries, held back from removal — and vindicated.** The
NAE/Lausanne agent proposed removing `ethics.abortion/protected-from-conception`,
`ethics.euthanasia/ordinary-means-only` and `ethics.war-and-violence/just-war`. But
those entries do not cite the NAE Statement of Faith; they cite NAE **resolutions**,
a separate body of documents the agent never retrieved and said so. Removing an
entry against a document that is not its source is the exact failure this phase
exists to stop. A follow-up agent retrieved the real documents: **all three are
supported** — *For the Health of the Nation* (2004) for abortion and just war, the
"Allowing Natural Death" resolution (2014) for euthanasia. Three correct
attributions would have been destroyed.

**2. A UMC stance downgraded from `confessional` to `majority`.** The modern-
denominational agent set `ethics.marriage-and-sexuality/covenantal-same-sex-union`
/ methodist to `confessional` on the strength of the 2024 General Conference. But
its own citation names ¶162.D, the **Social Principles**, which the Book of
Discipline states are not church law; the UMC's confessional standards are the
Articles of Religion and Confession of Faith under ¶104, fenced by the Restrictive
Rules. The stance contradicted its own citation. `majority` — "predominant in
practice, not confessionally binding" — is the honest fit. The agent's note was
good and was kept.

## Genuinely surprising things the sources said

- **The Smalcald Articles call the papacy "the very Antichrist."** Far sharper than
  the corpus's "fellow Christians, in error" framing of the Lutheran view of Rome.
  The tension is now in the note; the `hold` was left alone.
- **TEC's actual abortion policy has moved past the position it is attached to.**
  Resolution D083 (2022) affirms access "with no restriction on movement, autonomy,
  type, or timing", which is well beyond `permitted-in-tragic-cases`. The
  attribution was kept on the closest available position with the gap stated in the
  note. **The corpus has no position that fits TEC's actual stance** — a genuine
  gap, left for a future phase rather than papered over.
- **The ELCA citation was already stale before this session.** Its 2025 Churchwide
  Assembly amended the 2009 social statement, stripping the man-and-woman marriage
  language the corpus cites.
- **BioLogos replaced its numbered "What We Believe" articles with a shorter "Faith
  Commitments" page in 2024**, so the corpus's "articles 1-12" citation pointed at
  a document that no longer exists.
- **AiG's Statement of Faith has no lettered sections.** It was cited as "section D"
  four times; the real structure is eight numbered sections.
- **Thirty-Nine Articles Article 27 is stronger on baptismal regeneration than the
  corpus position it supports** — baptism is a sign "whereby, as by an instrument",
  those baptised are grafted into the Church. Kept as `permitted`, since the
  Anglican formularies are deliberately comprehensive here, with the tension noted.
- **Dordrecht Article 16 is a better basis for conditional perseverance** than the
  Article 17 the corpus cited, which is actually about shunning.

## What remains unverified — stated plainly

This is the part the brief asked not to imply away.

- **108 Tier C entries** in the Catholic, papal and creedal families —
  Trent, Vatican I and II, the Catechism of the Catholic Church, the ecumenical
  creeds, Westminster, Heidelberg, Belgic, Dordt. **These were sampled, not swept.**
  The 20% sample returned 12 of 12 clean on the Catholic and creedal citations,
  which is why they were not swept; that is evidence of a low defect rate, not
  proof of none.
- **Every `note` in the A5 named-authors cluster.** None of Grudem, Ware, Craig,
  Keathley, Walton, Heiser, Foster, Willard, MacArthur or Oord has a legitimate
  free full text, so chapter titles and tables of contents were verified but the
  quoted sentences the brief asks for could not be. The agent flagged this rather
  than writing quotes from memory, which was the right call and leaves the gap open.
- **`formation-and-practice.sanctification-progressive/theosis`** and
  **`missions-and-world-religions.the-unevangelised/inclusivism`** (orthodox) —
  no supporting passage found in the Catechism sections searched, but Palamas's
  *Triads* was not retrieved. Left unchanged rather than removed, because absence
  of a find in three documents is not absence of support in the tradition.
- **The BioLogos "Faith Commitments" wording** — biologos.org returned HTTP 429 on
  every direct fetch, so that note is paraphrase plus partial quote, not a verified
  block quote.
- **The 1662 Ordinal preface** (cited alongside Article 36 for episcopal
  government) and **the Books of Homilies** — not retrieved. The Homilies half of a
  citation contributed to one removal.

**A note on method for whoever verifies this work.** The BF&M agent found that
`WebFetch` runs page content through a summarising model, which paraphrased the
document on a first "give me the whole text" pass. It worked around this with short,
targeted "verbatim only" prompts cross-checked against known phrasing. Quoted notes
in this corpus are therefore high-confidence but not machine-guaranteed transcripts;
the `url` on each source is what makes them checkable, which is why adding urls
mattered.

## Why Tier C was swept in part

The brief said to sample about a fifth of Tier C and sweep only if the sample turned
up errors. The 45-entry sample (every 5th entry in a stable order, so it is
reproducible rather than cherry-picked) returned **5 defects, all concentrated in
two document families** — Thirty-Nine Articles and the Book of Concord — while
Catholic, CCC and creedal citations came back 12 of 12 clean.

So those two families were swept in full and the rest left sampled. That was the
right call on the evidence: **the sample's 5 defects stood in for 13 more.** The
Thirty-Nine Articles sweep found 7 defects in 34 entries where the sample had found
1 in 7; the Book of Concord sweep found 6 in 49. Sampling alone would have left
thirteen broken citations in place.

## How the work was run

Fan-out by **source document**, not by domain — one agent per cluster, so an agent
that had fetched the Book of Concord checked every Lutheran entry at once. Sixteen
Sonnet subagents with web access, in waves of three to five.

**Agents edited no repo files.** Each wrote a JSON array of typed operations applied
by `engine/apply_corrections.py`, because clusters share domain files and concurrent
writes would clobber. This worked and is worth reusing: it also made every
correction reviewable as a dry run before it touched the corpus, and made the two
overrides above possible — an ops file can be edited before it is applied.

**Two agents were killed mid-run by a session limit.** Both had been told to save
after every entry. One had already written all 44 of its entries and lost nothing;
the other had written nothing and was re-dispatched from scratch. The rule earned
its place in the brief for the second time in two phases.

One local error worth recording: a note fix applied with a direct `json.dump`
reformatted `church.json` wholesale (2026 changed lines instead of 4). Reverted and
redone through `apply_corrections.py`, which writes the corpus's canonical format.
**Corpus JSON should only ever be written by that applier or by `render.py`.**

## Verification

All green at merge, run after every apply, not just at the end:

- `py engine/validate_content.py` — **0 errors**, 37 warnings (all pre-existing
  categories: thin traditions and positions with no `held_by`; the coverage
  warnings are discussed above and are expected to be worse).
- `node tests/wizard-generate.test.js` — all passed, with `tests/out/` cleared first.
- `py tests/check_generated_map.py` — 90 prefix maps, 0 problems.
- `node engine/build_traditions.js` — 12 tradition maps, 606 nodes, clean
  regeneration. (698 before the phase; the drop is the removed attributions.)
- `py engine/corpus_refs.py` then `py engine/fetch_verses.py` — **0 blanks**.
- `py engine/render.py` — 0 warnings, no diff on the three generated files.
- **Byte identity `0125f4df6710946d80b2ca03314e71823dfd9f1b450df69c7a69384981863767`
  (LF-normalised) — MATCH**, verified after every commit.

The cheap-regeneration property the phase 6 addendum described held throughout:
corpus edits of a few hundred lines produced small, clean tradition-map diffs every
time.

## For the next session

- The corpus is now honest about what it can prove, and thinner for it. **Do not
  treat the coverage warnings as a defect to fix by adding attributions.** Add them
  only from a retrieved document, in the shape this phase established: real title
  and revision, section or article, quoted sentence in the `note`, `url` in
  `sources`.
- `docs/hosting/phase-9-work/` has been deleted, as its parking commit promised.
  The per-entry removal reasons live in the `held_by.remove` ops in this branch's
  history if any removal ever needs re-litigating.
- The unverified list above is the honest backlog. The largest single item is the
  108 sampled-not-swept Catholic and creedal Tier C entries.
