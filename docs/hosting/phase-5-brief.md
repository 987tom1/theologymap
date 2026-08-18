# Phase 5 — denominational research corpus (refreshed brief)

Written 2026-08-18, refreshing Project 13's `phase-5-denominational-research.md`
with the tradition list the UI actually offers, the "outside historic
orthodoxy" treatment made concrete, the per-domain subagent dispatch spelled
out, and a pointer at the schema instead of a copy of it.

**Goal:** fill phase 4's content schema with real positions from across the
Christian spectrum, so the wizard offers options a person from any tradition
can recognise as their own.

**Model:** Opus on the main thread for judgment and synthesis; research
subagents with web access, dispatched one per domain, for the gathering.

**Precondition:** phase 4's content schema is documented in
`docs/hosting/phase-4-outcome.md`. **Read that file and the schema it
describes before anything else in this brief.** The schema is being written
concurrently with this brief, in `docs/hosting/phase-4-design.md`, by a
different session — do not invent a schema shape here, do not guess at field
names, and do not read the wizard's code (`engine/` or `api/` wizard files,
if any exist yet) to infer the shape indirectly. If `phase-4-outcome.md`
does not exist yet when this phase starts, phase 5 is blocked — say so and
stop rather than proceeding against a guessed schema. (Per `decisions.md`
and `readiness.md`, phase 5 can run in parallel with phase 3 or phase 4's
*implementation*, but only once phase 4's schema is fixed and documented —
not before.)

**This phase can run in parallel with phase 3 or 4** once the schema is
fixed, because it produces content, not code.

## Read first

1. `docs/hosting/decisions.md` — Thomas's locked calls, in particular
   "Tradition centre of gravity" and "Research corpus (phase 5)". These
   override this brief and Project 13's original where they differ. Do not
   re-open them.
2. `docs/hosting/phase-4-outcome.md` and the schema it points at.
3. This file.

Do not read `theology-map.html` or `documentation/verses.md`.

## What is being produced

Per doctrine: the question, the candidate positions, the wording each
produces, a suggested tier, which traditions hold each, and the key texts —
**filled schema entries, matching phase 4's schema exactly, not prose and
not research notes.** If a subagent's return doesn't slot directly into the
schema's fields, it is not done.

## The standard every entry must meet — unchanged in substance from the original brief

This is the whole quality bar for the phase, and it is easy to fail without
noticing. **Each position must be stated in terms its own adherents would
accept** — the test is not "is this fair" but "would someone who holds it
sign their name to this sentence."

- **Use each tradition's own confessional documents** where they exist —
  Westminster, the Thirty-Nine Articles, the Catechism of the Catholic
  Church, the Augsburg Confession, Dordt, the Baptist Faith and Message, the
  Nicene and Chalcedonian definitions, and the equivalent documents for the
  traditions added below (see the tradition list). **Quote or paraphrase
  from the source, never from memory and never from a critic's summary.**
  If a source document must be found via web search, cite the specific
  document and section, not just "the tradition believes."
- **Avoid the strongest form of a view being paired with the weakest form of
  its rival.** Steelman every option, or the wizard becomes an argument
  rather than a mirror.
- **Note genuine internal diversity** rather than flattening it. "Baptists
  believe X" is usually false; there are several Baptist answers to most
  questions, and cessationist/continuationist, Calvinist/Arminian and
  similar internal splits should be represented as splits, not averaged
  into one invented middle position.
- **Where a position has no single label**, say so in the entry rather than
  inventing one.
- **Never write verse text from memory.** Supply the reference only;
  `fetch_verses.py` fetches the NET text. **Versification warning: the NET
  follows the critical text**, so references drawn from KJV-based sources
  can be off by one. **Check Psalms, 2 Corinthians and Malachi in
  particular** — these are the specific books Project 12's own `CLAUDE.md`
  and `engine/fetch_verses.py`'s working notes name as the known trouble
  spots (`2 Cor 13:14` was previously caught and corrected to `13:13`).

## The tradition list — fixed to what the UI offers

Do not research more broadly than this list, and do not silently narrow it
either — every one of these must get real, sourced coverage, because phase
4's wizard lets a user select any of them:

- Roman Catholic
- Eastern Orthodox
- Anglican
- Lutheran
- Reformed/Presbyterian
- Methodist/Wesleyan
- Baptist
- Pentecostal/Charismatic
- Anabaptist
- Restorationist
- The non-denominational evangelical mainstream

**The centre of gravity is non-denominational/Pentecostal.** This is
Thomas's own locked call (`decisions.md`, "Tradition centre of gravity"):
that is the reader whose recognition matters most, and — just as
importantly — the reader **least likely to already know what other
traditions hold**. Concretely, this changes how entries should be written,
not just which traditions are covered:

- Do not write the non-denominational/Pentecostal option as the unmarked
  default and every other tradition as a deviation from it. All eleven get
  the same sourcing discipline and the same steelmanning.
- Where a doctrine is one on which the non-denominational/Pentecostal
  mainstream has *no* single confessional document to cite (it characteristically
  doesn't — there is no non-denominational equivalent of Westminster), say
  so explicitly in the entry rather than inventing a false confessional
  citation. Ground it instead in widely-used statements of faith
  (e.g. the NAE/Lausanne-style statements, Assemblies of God's Statement of
  Fundamental Truths for the Pentecostal wing) or in the observable
  mainstream practice/preaching pattern, named as such.
- Because this reader is least likely to already know what, say, Anglicans
  or the Reformed hold, entries for the *other* ten traditions should be
  written assuming zero prior familiarity — define terms a Reformed or
  Catholic reader would take for granted (e.g. "means of grace,"
  "magisterium," "credobaptist") in context, briefly, rather than assuming
  the reader already has the vocabulary.

Anglican, Reformed, Baptist, Roman Catholic and Orthodox are named again in
`decisions.md` as the five that "must all be selectable and must all be
gotten right" — treat that as the floor of rigor, not the ceiling; all
eleven traditions get it.

## Views outside historic orthodoxy — included and plainly marked, not omitted

This is a locked decision (`decisions.md`, "Research corpus (phase 5)"), not
new scope: **views outside historic orthodoxy are included and plainly
marked as outside, with the reason. Not omitted, not presented as equal
options.**

Concretely:

- If, in the course of researching a doctrine across the eleven traditions
  above, a genuinely-held position among some part of that tradition (or a
  wider movement adjacent to it — e.g. Oneness Pentecostalism relative to
  Trinitarian Pentecostalism, or prosperity-gospel teaching relative to the
  broader Pentecostal/Charismatic mainstream) falls outside the historic
  creedal consensus (Nicene, Chalcedonian), **do not omit it and do not
  quietly fold it into the parent tradition's entry as if it were the same
  position.**
- Give it its own entry (or a clearly-flagged sub-entry within the relevant
  tradition's set, whichever the phase-4 schema supports — check the schema
  for how it represents "outside orthodoxy," and if the schema has no field
  for this, flag that as a gap for Thomas/phase 4 rather than inventing a
  workaround silently).
- State plainly and specifically **why** it sits outside historic
  orthodoxy — which creedal affirmation it conflicts with, named — not a
  vague "some consider this heterodox." E.g.: "Oneness theology denies the
  eternal distinction of the Persons affirmed at Nicaea and Constantinople;
  it is a real position within parts of the Pentecostal movement, and is
  represented here on those terms, marked as outside the historic
  consensus the other ten traditions share."
- This is not the same operation as steelmanning a minority-but-orthodox
  view (e.g. a credobaptist position within an overall Reformed
  entry-set) — those get folded in as ordinary internal diversity, no flag
  needed. The flag is reserved for positions that actually conflict with
  the creedal core itself.
- The historic creedal core section (see Coverage below) is where "the
  wizard should say so rather than pretending it is a choice" applies —
  Trinity, the two natures of Christ, and similar settled questions are not
  multiple-choice among the eleven traditions; they are one answer with
  eleven traditions agreeing, and the entry should say that plainly.

## Coverage

Aim for the breadth a stranger would need, not the breadth Thomas's own map
has:

- The historic creedal core (where there is one answer across all eleven
  traditions, and the wizard should say so rather than pretending it is a
  choice).
- Every doctrine domain phase 4's schema calls for, across all eleven
  traditions listed above.
- Where a view sits outside historic orthodoxy: flagged per the section
  above, never omitted, never presented as an equal option.

## Structure of the work — per-domain subagent dispatch

**One subagent per doctrinal domain, dispatched in parallel.** Use Project
12's own domain list as the starting partition (it currently has 14
domains — check `phase-4-outcome.md`/the schema for whether phase 4 kept,
merged or renamed any of them, since the wizard's domain boundaries are
authoritative for this phase, not the standalone map's).

Each subagent must:

- Receive: the schema (from `phase-4-outcome.md`), the tradition list above,
  the "outside historic orthodoxy" instructions above, the quality-bar
  rules, and the one or two doctrine domains it owns.
- Return: **filled schema entries only** — the question, each candidate
  position with generated wording, a suggested tier, which of the eleven
  traditions hold it (with sourcing), key texts (references only, no verse
  text), and a source citation per entry. Not a research summary the main
  thread has to convert.
- Do its own web research for confessional-document sourcing — the whole
  point of dispatching per-domain is that this is where the token-heavy web
  search work belongs, off the main thread.

**What the main thread does that no subagent can do, because it requires
seeing all domains at once:**

- **Cross-domain conflict resolution.** Soteriology and sacraments will
  collide (e.g. a tradition's baptismal theology has soteriological
  entailments that a soteriology-domain subagent and a
  sacraments-domain subagent may describe inconsistently). The main thread
  reconciles these — a subagent working one domain cannot see the other
  domain's draft.
- **Tone consistency across domains written separately.** Fourteen (or
  however many the schema ends up with) independently-written domains will
  drift in register, verbosity and how strictly they apply the
  steelmanning rule. The main thread is the only place that reads all of
  them side by side and levels this out.
- **Flagging calls for Thomas.** Collecting the "what needs Thomas, not
  you" list (below) into one place at the end, rather than leaving it
  scattered across fourteen subagent outputs where he'd have to hunt for it.
- **Schema conformance.** Verifying every subagent's return actually
  validates against phase 4's schema before it's treated as done — a
  subagent working from a copy-pasted schema description can still drift
  from the literal shape.

## What needs Thomas, not you

Some calls are his and should be collected into a single list at the end
rather than decided in the session:

- Which positions get a suggested tier that differs from his own map's
  tiering.
- Where a tradition's actual position conflicts with how the wizard would
  need to phrase the question.
- Anything where the research suggests his own map's framing of a doctrine
  is contestable. Note it; **do not edit `theology-map.md`.**
- Any case where the phase-4 schema has no field for the "outside historic
  orthodoxy" flag described above, or otherwise turned out to be the wrong
  shape for a real entry this phase needed to produce.

## Verification

- Every entry validates against the phase 4 schema — literally, field by
  field, not "close enough."
- Every `refs` reference resolves to text via `fetch_verses.py` — a blank
  after fetching means a bad reference, not a network problem. Re-check the
  Psalms/2 Corinthians/Malachi versification warning above before assuming
  a fetch failure is `fetch_verses.py`'s fault.
- Generate a full map from the wizard using the filled content and parse it
  with `render.py`: zero warnings.
- Spot-check: pick three traditions — at minimum one of the five
  `decisions.md` names explicitly (Anglican, Reformed, Baptist, Roman
  Catholic, Orthodox) and the non-denominational/Pentecostal mainstream
  given its centre-of-gravity status — read every option attributed to them
  end to end, and ask whether an adherent would sign it.

## Branch and handover

Branch `phase-5-content`, merge when the entries validate and the generated
map parses clean. Write `docs/hosting/phase-5-outcome.md` with coverage
gaps, the list of calls awaiting Thomas, and any place the schema turned out
to be the wrong shape for real content — that last one is the most valuable
thing this phase can report back, since phase 4's schema was written
concurrently with this brief and has not yet been tested against real
research output.
