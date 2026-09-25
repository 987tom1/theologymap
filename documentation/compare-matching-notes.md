# Compare matching: loosening "own-wording" — parked investigation

Started 2026-09-20 after Thomas noticed his own map's `/compare` results mark
doctrines he genuinely holds a listed position on as "own-wording," because he
phrased them in his own words rather than copying the corpus `hold` sentence.
Not implemented — this is a record of what was found and the options
considered, to resume from later.

## Why this happens (confirmed, not guessed)

`engine/compare-core.js`'s `resolvePosition()` matches a node's `hold` against
corpus candidates by **exact string equality** after `normalise()` — lowercase,
collapse whitespace, strip one trailing period, strip one layer of quotes.
Nothing fuzzy. This is a **pinned invariant**, not an oversight:

> "a near-match must resolve to own-wording: in a theology tool a confident
> wrong answer is worse than an honest 'cannot tell'."

`CLAUDE.md` §7 lists this explicitly and `tests/compare-core.test.js` pins it
against a strip-all-punctuation mutation. Any fix has to work within that
constraint, not against it.

## What the data actually looks like

Ran a one-off analysis (Node script, not committed) parsing `theology-map.md`
and scoring every "own-wording" node against its doctrine's closest corpus
candidate on token-overlap (Jaccard) + normalised Levenshtein similarity.

- 74 of 86 doctrines resolve to `own-wording`. 0 resolve to `position` (exact
  match). 1 `rejected`, 11 `undecided`.
- Best-candidate similarity scores: **0 nodes above 0.6**, only 3 above 0.4,
  the rest below. Even the closest pair (`inerrancy`, score 0.49) is Thomas's
  terse sentence against the corpus's longer, clause-qualified one.
- Reading the actual pairs (`inerrancy`, `justification`, `second-coming`,
  `canon`, `reformation-solas`...) confirms this isn't scattered rewording —
  it's a **systemic style gap**: Thomas writes short declarative sentences,
  the corpus writes full formal doctrinal-statement prose. Several of these
  are clearly the same position in substance (e.g. `justification`:
  "By grace through faith, on the ground of Christ's work alone" vs. the
  corpus's Reformation-solas-style paragraph) despite a low lexical score.

**Implication:** this rules out "just add a couple of alternate wordings" as
a full fix. It's closer to a one-time content project (a terse alt-wording
per position, across most of the 86 doctrines) than a handful of patches.

## Options considered

1. **AI/embedding similarity at compare time.** Rejected — directly violates
   the pinned invariant above and adds cost/latency/nondeterminism to code
   that was deliberately kept pure and offline-testable.
2. **Fuzzy string matching (edit distance / token threshold) at compare
   time.** Rejected for the same reason — worse, it can silently resolve to
   the *wrong* nearby position, which is exactly what `own-wording` exists to
   avoid. The scoring above also shows plain lexical similarity is a weak
   signal here: semantically identical answers can score under 0.3 against
   phrasing this different.
3. **Expand the existing alt-wording mechanism.** `superseded_holds` already
   lets a position carry more than one accepted string (built for corpus
   rewords, per `CLAUDE.md`: "Rewording a `hold` orphans every map still
   carrying the old wording... push the previous text into `superseded_holds`").
   The natural extension is letting a position carry an author-approved
   *terse* alternate the same way. Still exact match at runtime — just against
   more accepted strings per position.

## Recommendation: hybrid, curation only, never at compare time

- **Runtime stays exactly as it is.** `resolvePosition` keeps exact matching.
  No change to `compare-core.js`'s live logic or its pinned test.
- **Offline tooling proposes candidates; a human approves them.** A separate
  script (not part of the runtime bundle) runs the fuzzy/semantic comparison,
  flags likely reworded doctrines, and a human confirms each one before it's
  added to the corpus — via a new `apply_corrections.py` operation
  (e.g. `position.alt_holds.add`), following the same typed-operation /
  `--dry` / review pattern that file already uses for everything else.
- **AI is the better tool for the *suggestion* step, not the matching step.**
  The Jaccard/Levenshtein pass above under-detects real matches because
  lexical similarity is the wrong signal for "same doctrine, different
  register." An LLM read of the pairs would catch far more of them
  (confirmed informally on the top-20 list above). Run it **occasionally**,
  off the corpus + a map, never per-request: it drafts candidate alt-wordings
  with reasoning, a human reviews, `apply_corrections.py` applies. This
  touches the corpus's data, never the comparison algorithm.

Net effect: matching stays exact, deterministic and testable (the pinned
invariant is untouched); the corpus's vocabulary of accepted wordings per
position grows over time, curated by a human, drafted with AI help rather
than judged by it live.

## Not yet decided / next step when resumed

Offered to just do a one-off pass on Thomas's own map by hand (read the 74
own-wording pairs, propose alt-wordings for review) rather than building the
tooling first — no answer given yet before the session was parked. Start
there if resuming without a stronger reason to build the general tool first.
