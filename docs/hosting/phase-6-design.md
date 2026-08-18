# Phase 6 — design: learn and compare

**Status:** design of record for phase 6. Written 2026-08-18 by a planning session, with
Thomas away. **There was no phase 6 brief in Project 13** — this document and
`phase-6-plan.md` are it. Written at the same sitting as phase 4's design, deliberately, so
that phase 4's content schema already carries what compare needs.

**Read first, in precedence order:**

1. `docs/hosting/decisions.md` — the locked calls and the 2026-08-18 wireframe amendments.
   **They override this document wherever they differ.**
2. `docs/hosting/phase-4-design.md` — **§4 is the content schema this phase consumes.** Read
   it before this document; nothing here makes sense without it.
3. This document.
4. `docs/hosting/phase-1-design.md` §2 (server-mediated access), §6 (routes and pages).
5. Project 12's `CLAUDE.md` — node syntax and the four views.

**Do not read** `theology-map.html` or `documentation/verses.md`.

**The interpreter on this machine is `py`, not `python`.**

**Precondition:** phase 5 has merged, so `content/wizard/` holds the full corpus. Phase 6 can
be *built* against phase 4's twelve-doctrine seed, and should be — but it does not merge until
it has run against the real corpus.

---

# 1. What phase 6 is

Two surfaces over one corpus, plus one comparison engine.

| Surface | Route | What it is |
|---|---|---|
| **Learn** | `/learn` | browse **by doctrine** — "Baptism" and then every tradition side by side, with citations, key texts, internal diversity and orthodoxy markers. A bespoke reference UI, because map nodes flatten exactly the things worth reading. |
| **Tradition maps** | `/view?tradition=reformed` | each tradition as a real, read-only `theology-map.md`, rendered by `engine/render.py` like every other map. |
| **Compare** | `/compare` | one engine, a target picker: my map against **a tradition** or against **another member's map**. Ships all three shapes — per-doctrine diff, closest tradition, all-traditions scorecard. |

`decisions.md` fixes all of that: two surfaces over one corpus; entry to learning is by
doctrine; two compare targets and therefore one engine with a target picker; all three
compare shapes ship.

## The rule that governs the whole phase

**Compare is descriptive, never evaluative.** It reports what two maps say. It never scores a
person, never ranks people against each other, never colours a difference as a deficiency,
and never implies a right answer. The word "closest" is used of traditions only — never of
people — and even there it is reported with its denominator. This is a church, and people
will look each other up.

---

# 2. Traditions as maps

## 2.1 They are files, not database rows

`decisions.md` says traditions exist as real read-only maps rendered by `render.py`, so
compare is map-vs-map and the gallery is reused. It does not say where they are stored.

**Decision: generated markdown files checked into the repo at `content/traditions/`, not
rows in `users`.**

Why:

- A `users` row for a tradition needs a column distinguishing it from a person (a
  data-model change, which `decisions.md` says stops and waits), or it collides with open
  sign-up's name space and shows up in the gallery as a member.
- A checked-in file is **reviewable in a git diff**. For a theology corpus that is not a
  nicety; it is the whole reason phase 4 banned an LLM at runtime.
- Regenerating after a phase 5 correction is one command, and its effect on eleven maps is
  visible in one diff.
- Vercel serves `content/` statically, so `/content/traditions/reformed.md` is fetchable by
  the compare page with no serverless function and no cold start.

Reversible: inserting the same markdown as rows later is an INSERT and a flag column, and
nothing else in this design changes, because everything downstream consumes *markdown text*.

## 2.2 The generator, and why it is Node

`engine/build_traditions.js` — a Node script that reads `content/wizard/` and writes
`content/traditions/<id>.md` plus `content/traditions/manifest.json`.

**It must be Node, not Python, because `engine/editor-core.js` holds the project's only
serializer** and the rule is one parser, one serializer. `editor-core.js` is UMD and already
exports under `module.exports`; Node v24.19.0 is present on this machine (verified in phase
1's plan). A Python builder would be a second serializer — the exact failure this program
exists to avoid.

Generation, per tradition T with `in_scorecard: true`:

1. For each doctrine D in corpus order (domain order, then doctrine order):
   - if `D.tradition_overrides[T]` exists → use it;
   - else if exactly one position in D lists T in `held_by` → use it;
   - else if two or more do and no override exists → **fail the build**, naming D and T;
   - else → skip D, and record it in the coverage report.
2. Build the node: title `D.node_title`; tier `override.tier ?? position.tier ??
   D.suggested_tier`; confidence `override.confidence ?? stance_confidence(stance)` per phase
   4 §4.4's table; `hold` / `why` / `vs` from the override or position; `refs` =
   `position.refs ?? D.refs`; `todo` empty; flags from `override.flags` (usually none).
3. Group nodes by domain, ordered by `manifest.order`; within a domain, tier order (T1 down
   to T4) matching the map's own convention.
4. Prune `link` lines to slugs present in **this** map — the same rule as phase 4 §5.6, since
   a tradition map is also partial.
5. `EditorCore.serialize(domains)` → the markdown text.
6. Write with a **provenance header comment**? No — the format has no comment syntax, and
   inventing one is a file-format change. Instead, provenance lives in
   `content/traditions/manifest.json`: generator version, corpus `schema_version`, build
   timestamp, node count, and the list of skipped doctrines per tradition. `README` text for
   each map comes from `traditions.json`'s `map.intro`, displayed by the page rather than
   embedded in the markdown.

**These files are generated. Never hand-edit them** — the same rule as `theology-map.html`.
A correction goes into the corpus and the maps are rebuilt. `engine/build_traditions.js`
prints a one-line summary per tradition and a total.

`content/traditions/manifest.json`:

```json
{
  "schema_version": 1,
  "generated_at": "2026-08-25T09:14:03Z",
  "corpus_schema_version": 1,
  "traditions": [
    { "id": "reformed", "display_name": "Reformed / Presbyterian", "short_name": "Reformed",
      "file": "reformed.md", "node_count": 71, "skipped": ["creation.animal-death", "ethics.gambling"] }
  ]
}
```

## 2.3 Rendering them

Unchanged from phase 1: the page fetches `/content/traditions/reformed.md` statically and
POSTs `{markdown}` to `/api/render`, which calls `render.render_markdown`. **No new
serverless function, no change to `api/render.py`, no second renderer.** `/view?tradition=`
is a client-side branch in `web/view.html`: with `?id=` it loads a member's map, with
`?tradition=` a tradition's file. Same page, same render call, same export button.

The tradition-map view carries a standing line at the top, from `traditions.json`:
*a generated summary of what this tradition confesses, not a person's map.* Plus the
`map.intro` and a link to the same doctrines on `/learn`.

---

# 3. The learn surface

**Entry is by doctrine** (locked). `/learn` is a doctrine index — grouped by domain,
filterable by text, with tier chips — and `/learn?doctrine=church.baptism` is the page that
matters.

The doctrine page, top to bottom:

1. **`question`** as the heading, then **`framing`** — the neutral setup, verbatim from the
   corpus.
2. **`learn_note`** if present — history and terminology no single position owns.
3. **Key texts** — the doctrine's `refs`, rendered as the same reference pills the map uses,
   with verse text from `verses.md` where it exists. Never fabricated (phase 4 §4.11).
4. **The positions, side by side** — one column or card each, in corpus order with `outside`
   positions last. Each shows: `label`, the `hold` sentence, `why`, `vs`, `learn_detail`, its
   `refs`, its orthodoxy marker if any with the `orthodoxy_note`, and its `sources`.
5. **Who holds what** — for each position, the `held_by` list: display name, stance in plain
   English, the `note`, the `citation`. Where a `tradition_overrides` entry exists, that
   tradition appears once, spanning its positions, with its override `note` and `citation` —
   which is the "no single label" case the bespoke UI exists to carry.
6. **My own answer, if I have one** — the person's current node for this doctrine, shown as
   it is, with a link to edit it and a link to the compare view for this doctrine. Never
   marked right or wrong.
7. **Sources** — the doctrine's `sources`, then every position's, deduplicated by `label`.

A **tradition index** at `/learn?tradition=reformed` is the transpose: every doctrine that
tradition has a position on, its `hold`, its stance and its citation, plus a link to the
generated map. It is a reading view of the same data, not a second corpus.

Nothing on the learn surface is generated at runtime by anything but the corpus JSON. The
whole surface is static fetch plus rendering.

---

# 4. The compare engine

## 4.1 One engine, two targets

```
                      my markdown
                           |
   target picker  ---------+--------  target markdown
     - a tradition (content/traditions/<id>.md)
     - another member (GET /api/map?user_id=)
                           |
                    compare-core.js
                           |
        +------------------+------------------+
        |                  |                  |
   per-doctrine        closest           all-traditions
       diff           tradition           scorecard
```

`engine/compare-core.js` is a pure UMD module — no DOM, no fetch — exactly like
`editor-core.js` and `wizard-generate.js`, so it runs under Node for headless verification.
`web/compare.js` does the fetching and the rendering; the engine does the reasoning.

Both maps are parsed with **`EditorCore.parse`**. One parser. The corpus is loaded to resolve
map text back to positions.

## 4.2 Resolving a node to a position

Phase 4 records no position id in the map (phase 4 §5.4, and §8 question 1). The engine
recovers it:

```
resolvePosition(node, doctrine):
  if node is absent                                  -> "unanswered"
  if node.confidence == "open" or "study" in flags
     and normalise(node.hold) is empty or "undecided" -> "undecided"
  for each position P in doctrine.positions:
     if normalise(node.hold) == normalise(P.hold)     -> P
  if node.confidence == "rejected"                    -> "rejected" (carrying the matched P if any)
  otherwise                                           -> "own-wording"
```

`normalise` lowercases, collapses whitespace, strips a single trailing full stop, and strips
surrounding quotes. Nothing cleverer: no fuzzy matching, no stemming, no similarity
threshold. **A near-match must not be reported as a match** — in a theology tool a confident
wrong answer is worse than an honest "cannot tell".

`own-wording` is a first-class outcome shown as *worded their own way — shown side by side*,
with both texts. It is never counted as agreement or as disagreement.

**Override holds must resolve too.** A tradition map node generated from a
`tradition_overrides` entry carries the *override's* `hold`, which matches no position's
`hold` and would otherwise resolve to `own-wording` — making a tradition fail to agree with
itself. So the matching loop runs over an extended candidate list per doctrine:

```
candidates(doctrine) = doctrine.positions
                     + [ synthetic position per tradition_overrides entry T:
                         { id: "<doctrine.id>/@override:<T>",
                           label: "<tradition display_name>: no single position",
                           hold: override.hold,
                           spans: override.positions } ]
```

An override candidate carries `spans`, and the verdict rule extends by one line: **a position
P on one side and an override candidate on the other agree in substance when P is in that
override's `spans`.** Two override candidates for the same tradition are a plain `agree`.
This is what makes "Anglican compared with Anglican" report agreement on baptism, and what
makes "my believer's baptism vs Anglican" read as *the Anglican formularies allow this* rather
than as a flat difference.

## 4.3 The per-doctrine diff

For every doctrine in the corpus, both sides resolve to one of: a position, `undecided`,
`rejected`, `own-wording`, `unanswered`. The pair yields one verdict:

| Mine | Theirs | Verdict |
|---|---|---|
| P | same P | **agree** |
| P | Q, same `equivalence_group` | **agree in substance** |
| P | Q, different | **differ** |
| `undecided` | anything | **I haven't settled this** |
| anything | `undecided` | **they haven't settled this** (traditions rarely) |
| `own-wording` | anything | **worded my own way** — both texts shown |
| anything | `own-wording` | **worded their own way** — both texts shown |
| `unanswered` | anything | **not in my map yet** — with a link into the wizard at that doctrine |
| anything | `unanswered` | **not in their map** / **this tradition takes no position** |

`rejected` on either side is shown as its own line — *recorded as considered and rejected* —
and is excluded from every count, because a rejection is not a position.

Presentation: grouped by tier (T1 first, matching the wizard and Ortlund's logic), then by
domain, with a per-group count. Differences are not sorted first, and are not coloured red.
Each row expands to the two `hold` sentences, the two `why` lines, the corpus's `framing`,
and a link to `/learn?doctrine=`.

A **doctrine-level entry point** from the learn page opens the diff scrolled to that row —
the same page, not a second implementation.

## 4.4 The closest tradition

Computed over `in_scorecard` traditions only. Never over people.

```
denominator D_t = doctrines where MY side resolves to a position
                  AND tradition t has a position
numerator   N_t = of those, the ones that agree or agree in substance
score_t         = N_t / D_t
```

Reported as **"agrees with 41 of the 58 questions where both have a position"**, not as a
percentage alone and never as a grade. Undecided, own-wording and unanswered doctrines are
excluded from both numerator and denominator, and their count is shown alongside, so a person
can see how much of their map the comparison actually covered.

Guards:

- Fewer than **eight** resolvable doctrines → no closest tradition is named. Copy:
  *not enough answered questions yet to say anything useful — here is what has been compared
  so far.*
- Where the top two are within **three** doctrines of each other, both are named as joint,
  with the sentence that this is a close call.
- The result is framed as *this tradition's answers are the nearest to mine*, never
  *I am Reformed*. A map is not a membership.
- Tier weighting is deliberately **not** applied. Weighting T1 agreement more heavily is
  defensible and is an argument; an unweighted count with a stated denominator is a
  description. Flagged for Thomas in §8.

## 4.5 The all-traditions scorecard

Doctrines down, `in_scorecard` traditions across, one cell per pair, using the §4.3 verdicts
collapsed to four glyphs: agree, agree in substance, differ, no position. My own undecided
rows render as a single greyed row across all traditions labelled *not settled yet*, and are
excluded from the column totals.

Column totals repeat §4.4's fraction with its denominator. Rows are grouped by tier and
domain, exactly like the diff. Wide, so it scrolls horizontally inside its own container and
collapses to one tradition per accordion below 860px, matching the map view's breakpoint.

The scorecard is **traditions only**. There is no people-vs-people scorecard and no
leaderboard, by design, and this is worth restating in the phase 6 outcome file so a later
session does not add one as an obvious symmetry.

## 4.6 Comparing against another member

Same engine, same three-column diff, with two differences:

- **No scorecard and no "closest" summary.** Person-to-person comparison ships the
  per-doctrine diff only. A number attached to a named person in a church is a ranking
  whatever the copy says.
- **The framing copy is different**: *this is what our two maps say side by side*, plus the
  count of doctrines where both have settled something. Agreement and difference are reported
  in the same visual weight.

## 4.7 Who can be compared against

Phase 1's `api/map.py` GET returns markdown for a `user_id`. Phase 6 requires it to return
markdown for another user **only when that row's `is_public` is true** (the owner always gets
their own). Phase 6's plan verifies this and adds the guard if it is missing — it is a
one-line change inside an existing route, not new scope.

The target list is produced by exactly one predicate, in one place in `compare-core.js`:

```js
function canBeComparedAgainst(user) {   // { id, name, is_public, ... } from /api/gallery
  return user.is_public === true;       // today: public means comparable
}
```

**This is the open question `decisions.md` flagged and did not decide**: whether a person can
keep a map public but opt out of being a comparison target. The design is ready for either
answer — one predicate, one call site — and phase 6 must **raise it rather than decide it**,
because implementing the opt-out means an `is_comparable` column, which is a data-model change
and therefore stops and waits. See §8.

Until it is decided, phase 6 ships two mitigations that need no schema at all:

- The gallery and the compare picker say plainly that a public map can be compared against.
- Comparison is never notified to the person compared against, never logged, and never counted.
  Nobody can find out who compared themselves to them.

---

# 5. Which schema fields the compare engine consumes

**Definitive list.** A phase 5 entry missing an item marked *required* breaks compare for that
doctrine; the rest degrade gracefully.

| Field | Required by compare? | Used for |
|---|---|---|
| `manifest.domains[].id` / `.name` / `.order` | **yes** | grouping both maps by domain; the `name` match is what makes two maps comparable at all |
| `doctrine.id` | **yes** | the row identity in diff and scorecard |
| `doctrine.slug` | **yes** | **the join key**: finds the node in each parsed map. A wrong slug means the doctrine silently reads as unanswered on both sides. |
| `doctrine.node_title` | **yes** | row label |
| `doctrine.domain`, `doctrine.order` | yes | row ordering |
| `doctrine.suggested_tier` | **yes** | tier grouping in the diff and scorecard; tradition-map tier when no override or position tier |
| `doctrine.question`, `framing` | no | expanded-row context; the learn page |
| `doctrine.tier_note`, `learn_note` | no | learn page only |
| `doctrine.refs` | no | tradition-map `refs` fallback; learn page key texts |
| `doctrine.links` | no | tradition-map `link` lines (pruned) |
| `doctrine.open.*` | no | not read by compare — undecided is detected from the *map node*, not the corpus |
| `doctrine.positions[].id` | **yes** | the agreement key |
| `doctrine.positions[].hold` | **yes** | **resolving a map node back to a position** (§4.2) and the tradition map's `hold`. If `hold` in the corpus differs by one character from what the wizard wrote, resolution fails and the row reads "worded their own way". |
| `doctrine.positions[].label` | **yes** | diff rows, scorecard cell tooltips |
| `doctrine.positions[].equivalence_group` | no | upgrades `differ` to `agree in substance` |
| `doctrine.positions[].why`, `vs`, `refs`, `tier` | no | tradition-map fields; expanded diff rows |
| `doctrine.positions[].confidence_default` | no | not read by compare |
| `doctrine.positions[].orthodoxy`, `orthodoxy_note` | no | learn page marker only. **Never used in scoring, ever.** |
| `doctrine.positions[].held_by[].tradition` | **yes** | which tradition map a position lands in; scorecard membership |
| `doctrine.positions[].held_by[].stance` | **yes** | the tradition map's confidence value |
| `doctrine.positions[].held_by[].note`, `.citation` | no | learn page |
| `doctrine.positions[].learn_detail`, `sources` | no | learn page |
| `tradition_overrides[T].hold` / `why` / `vs` / `tier` / `confidence` / `flags` | **yes when present** | the tradition map's node for a divided tradition |
| `tradition_overrides[T].positions` | **yes when present** | resolving that tradition's map node back to an agreement key: a member holding **any** position in that list counts as **agree in substance** with the tradition |
| `tradition_overrides[T].note`, `.citation` | no | learn page |
| `traditions[].id`, `display_name`, `short_name` | **yes** | picker, chips, scorecard headers |
| `traditions[].in_scorecard` | **yes** | which traditions get a map and a column |
| `traditions[].in_ui`, `order`, `blurb` | no | picker ordering and copy |
| `traditions[].map.title`, `.intro` | **yes when `in_scorecard`** | the generated map's header |
| `traditions[].confessional_sources`, `kind` | no | learn page |

**The three fields phase 5 must get exactly right, because everything else recovers:**
`doctrine.slug`, `position.id`, and `position.hold` — the last one character-for-character,
since the wizard writes it into a map and compare reads it back.

---

# 6. Pages, routes and files

| Path | File | New? |
|---|---|---|
| `/learn` | `web/learn.html` + `web/learn.js` | new |
| `/compare` | `web/compare.html` + `web/compare.js` | new |
| `/view?tradition=` | `web/view.html` | **modified** — one branch, same render call |
| — | `engine/compare-core.js` | new, pure, UMD |
| — | `engine/build_traditions.js` | new, Node, uses `editor-core.js`'s serializer |
| — | `content/traditions/*.md`, `content/traditions/manifest.json` | new, **generated** |
| — | `api/map.py` | **modified if needed** — public-only guard on reading another user's markdown |
| — | `vercel.json` | two rewrites |

**No new serverless function.** The count stays at phase 1's six, of twelve.

Entry points added elsewhere, kept minimal because phase 3 owns those pages: a "Learn" and a
"Compare" link in the shared header, and on a gallery card a "compare with mine" action for
maps the predicate allows.

---

# 7. Verification

Every check runs from the command line. No browser automation, ever.

1. `py engine/validate_content.py` — clean over the full corpus.
2. `node engine/build_traditions.js` — succeeds; every `in_scorecard` tradition produces a
   map; the ambiguity rule fires as an error, not a silent pick (tested by temporarily
   removing an override in a scratch copy).
3. **Every generated tradition map parses clean**: for each file, run `render.py`'s parser
   over it and require zero warnings — no unknown fields, no broken `link` targets.
4. **Round-trip on every tradition map**: parse → serialize → re-parse gives an identical
   model, using `editor-core.js` under Node.
5. `node tests/compare-core.test.js` — the engine's verdict table (§4.3) with fixtures for
   every row, including `own-wording`, `rejected`, and both `unanswered` directions.
6. **A tradition compared with itself gives 100% agreement and zero differences.** The single
   most valuable test in the phase: it proves resolution, matching and the scorecard at once.
7. **A tradition compared with a different tradition** produces a plausible, non-empty diff,
   spot-checked by hand on three doctrines against the corpus.
8. **The closest-tradition guard**: a three-node map names no closest tradition.
9. **Denominators are honest**: for one real map, the numbers in the scorecard column totals
   equal the counted rows in the per-doctrine diff.
10. Deploy verification by fetching the production URL — it returns 200 to unauthenticated
    requests as of 2026-08-18.

---

# 8. Questions for Thomas

1. **The flagged open question: can a public map opt out of being a comparison target?**
   `decisions.md` raised it and did not decide. Implementing it means an `is_comparable`
   column on `users`, which is a data-model change and therefore stops and waits.
   The design is one predicate in one place (§4.7), so either answer is cheap to adopt.
   The three live options:
   (a) **public means comparable** — today's behaviour, simplest, and the compare page says
   so plainly; (b) **an `is_comparable` column** defaulting true, with a toggle beside the
   public toggle; (c) **compare against people is opt-*in*** — safest socially, and probably
   leaves the feature unused. **Recommendation: (b)**, because the audience is one church and
   the cost of a person feeling examined is higher than the cost of a column. Phase 6 ships
   (a) and raises this rather than migrating unasked.

2. **Should tier weighting apply to "closest tradition"?** Today every doctrine counts once
   (§4.4). Weighting T1 agreement more heavily is theologically defensible — it is Ortlund's
   whole point — but it turns a description into an argument, and two people with the same
   answers could be ranked differently by a choice the tool made. Left unweighted; a weighted
   view could be a toggle, clearly labelled.

3. **Should person-to-person compare show a headline count at all?** Today it shows the
   per-doctrine diff and a neutral count of doctrines where both have settled something, and
   no score. Even that count could be read as a compatibility number. Removing it entirely is
   one line if wanted.

4. **How much of the corpus should be visible to someone who has not built a map?**
   `/learn` is currently readable signed out — it is a reference work, and phase 5's research
   is the most generally useful thing the site will hold. If it should be members-only, say so;
   it is a redirect.

5. **Which traditions get a generated map?** Every `in_scorecard: true` entry. Phase 5's
   coverage warning fires below 60% doctrine coverage, but a 62%-covered tradition map is
   still a thin thing to publish under a real communion's name. Worth setting a floor for
   which maps are published rather than merely built?

6. **Should Thomas's own map be a compare target?** It is a `users` row like any other, and it
   is public, so today it is. Given that he is the pastor-adjacent author of the tool, a
   member comparing themselves to his map is a different social act from comparing themselves
   to Westminster. No change made; naming it because it is invisible until it happens.
