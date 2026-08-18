# Phase 4 — design: the "build me a map" wizard

**Status:** design of record for phase 4. Written 2026-08-18 by a planning session,
with Thomas away. Read this alongside `docs/hosting/phase-4-plan.md`.

**Read first, in precedence order:**

1. `docs/hosting/decisions.md` — Thomas's locked calls, the wireframe amendments and
   the verified environment facts. **They override this document wherever they differ.**
2. This document.
3. `docs/hosting/phase-1-design.md` — the infrastructure being built on (§2 server-mediated
   data access, §6 route and page inventory, §7 the editor's storage-adapter seam, §8 autosave).
4. Project 12's `CLAUDE.md` — node syntax, field list, the four views.
5. `Project 13 - Prompt for Projects/phase-4-map-wizard.md` — the source brief.

**Do not read** `theology-map.html` (126 KB of generated output) or
`documentation/verses.md` (41 KB of scripture text). Nothing here needs either.

**On this machine the interpreter is `py`, not `python`.** Bare `python` hits a
Microsoft Store stub. Every command in this document and its plan is written with `py`.

> **§4 is the deliverable.** Phase 5's research sessions read §3 and §4 of this
> document and nothing else — not the wizard's code, not the plan. If §4 is wrong,
> phase 5's work is thrown away. Everything before §4 exists to justify its shape;
> everything after it exists to consume it.

---

# 1. What is being built

A guided question-and-answer flow at `/wizard` that turns recognition into structure.
Someone arrives knowing what they believe but not how to say it in this map's terms.
The wizard asks one doctrine at a time, shows the candidate positions in the exact
words each would put in their map, and writes the chosen answers into their
`theology-map.md` through the existing serializer.

It is a **data-driven form**, not a chat. No LLM call at runtime, ever. Every sentence
the wizard can ever emit is checked into the repo as JSON and is reviewable by Thomas
in a git diff.

## What phase 4 delivers

| Deliverable | Note |
|---|---|
| The **content schema** (§4) | the real deliverable; phase 5 fills it, phase 6 reads it |
| A **seed corpus** — two domains, twelve doctrines | proves the flow; phase 5 replaces it with the full corpus |
| The **generator** — corpus + answers → node model | pure, headless-testable, one function |
| The **wizard UI** — `/wizard` | one question per screen, per the approved wireframes |
| A **validator** — `engine/validate_content.py` | phase 5's own quality gate |
| A **ref-sync script** — `engine/corpus_refs.py` | corpus references get NET text like every other reference |

## What phase 4 does not deliver

- The content. Twelve doctrines of seed, not ninety-nine. Phase 5 fills the rest.
- Tradition maps, the learn surface, and compare. Those are phase 6 — designed in
  parallel in `phase-6-design.md` so that this schema already carries what they need.
- Any change to `theology-map.md`'s file format. See §2.

---

# 2. The constraints that actually shape the design

These are not background. Each one closed off a design that would otherwise have been
the obvious choice.

**C1. One parser, one serializer.** `engine/editor-core.js` holds the only serializer
in the project (`serialize(domains)` → markdown text). `engine/render.py` holds the only
Python parser. The wizard therefore **builds a node model and hands it to
`EditorCore.serialize`**. It never emits markdown by string concatenation. This single
constraint decides that the wizard is client-side JavaScript, because that is where the
serializer lives.

**C2. The file format is frozen.** `decisions.md` says uncovered judgment calls get
decided and documented loudly *except anything touching the data model or a file format,
which stops and waits*. So the wizard may not add a field to a node to record which
position was chosen, and may not add a column to `users` to record the wizard's answer
log. §5.4 shows how resumability and phase 6's matching are achieved without either.

**C3. Nothing appears in a map that the person did not choose.** Tradition selection
orders candidate positions and labels them; it never pre-fills, never pre-selects, and
never auto-answers a remaining question. A person who picks "Anglican" and then abandons
the wizard at question three has a three-node map, not a ninety-nine-node Anglican map.

**C4. "I don't know" is a first-class answer, never a skip.** It produces a real node:
`confidence: open`, flag `#study`, `hold` "Undecided.", and a `todo` line naming what is
left to work out. There is an existing precedent in Thomas's own map (the EFS / ESS node),
and the wizard follows it exactly.

**C5. Voice: first person or neutral, never second person.** Extended in §4.7 into a rule
phase 5 can check mechanically, because ninety-nine questions written by fourteen separate
sessions will drift otherwise.

**C6. Never write verse text from memory.** The corpus carries references only. Text comes
from `engine/fetch_verses.py` against the NET Bible API, into `documentation/verses.md`.

**C7. No LLM call at wizard runtime.** The wizard is fast, free, offline-capable and —
the point — *reviewable*.

**C8. Abandoning must yield a valid, renderable partial map.** "Finish here" is on every
screen. This is the strongest functional constraint in the phase and it drives §5.4's
save model and §5.6's link pruning.

---

# 3. Vocabulary — read this before §4

Phase 5's sessions will use these words in their entries. They are defined once, here.

| Term | Meaning |
|---|---|
| **domain** | one of the fourteen top-level sections of the map (`# Scripture`, `# God`, …). A `#` heading in `theology-map.md`. |
| **doctrine** | one question the wizard asks, producing at most one node. A `##` heading in `theology-map.md`. The unit of the corpus. |
| **position** | one candidate answer to a doctrine. Carries the exact wording it will put in a map. |
| **tradition** | a church family, stream or movement that can hold positions — Reformed, Anglican, Roman Catholic, Pentecostal, and so on. Registered once in `traditions.json`. |
| **stance** | how firmly a named tradition holds a named position: `confessional`, `majority`, `permitted`, `minority`, `historic`. Defined in §4.4. |
| **orthodoxy marker** | whether a position sits inside historic Christian orthodoxy: `historic`, `contested`, `outside`. Defined in §4.5. |
| **corpus** | all the content files together: the manifest, the tradition registry and the fourteen domain files. |
| **generated node** | the `theology-map.md` node a chosen position produces. |

**Doctrine ≠ node title.** A doctrine's `question` is what the wizard asks; its
`node_title` is what appears as the `##` heading. They are different strings and both
are required.

---

# 4. The content schema

**This is the deliverable of phase 4.** Phase 5 fills it; phase 6 reads it. It is
JSON, checked into the repo, in `content/wizard/`.

## 4.1 Why JSON, and why one file per domain

**JSON, not YAML.** Python's standard library parses JSON and does not parse YAML, and
`requirements.txt` must stay empty (phase 1 global constraint 9). The browser parses JSON
natively. YAML would buy nicer authoring at the cost of a dependency in two runtimes.
Rejected.

**One file per domain.** Phase 5 dispatches one research subagent per domain. Fourteen
separate files means fourteen subagents writing in parallel with zero merge conflicts, and
a reviewable per-domain diff. A single `content.json` would serialise the whole phase behind
one file.

**A manifest, because the browser cannot list a directory.** `content/wizard/manifest.json`
names the domain files and their order. Nothing globs.

```
content/
  wizard/
    manifest.json          domain list + order + schema version
    traditions.json        the tradition registry
    scripture.json         one file per domain, named by domain id
    church.json
    …                      (phase 5 adds the remaining twelve)
```

`content/` is served as a static asset by Vercel, so the wizard fetches
`/content/wizard/manifest.json` directly. No serverless function is involved in
delivering content. This keeps the function count at phase 1's six, leaving headroom
under the Hobby plan's twelve.

## 4.2 `manifest.json`

```json
{
  "schema_version": 1,
  "domains": [
    { "id": "scripture",  "name": "Scripture",  "order": 1,  "file": "scripture.json" },
    { "id": "god",        "name": "God",        "order": 2,  "file": "god.json" },
    { "id": "christ",     "name": "Christ",     "order": 3,  "file": "christ.json" }
  ]
}
```

- `id` — lowercase, hyphenated, stable forever. Referenced by every doctrine.
- `name` — **must exactly match the `#` domain heading in `theology-map.md`.** The
  fourteen current names are: Scripture, God, Christ, Holy Spirit, Humanity and sin,
  Salvation, Church, Last things, Creation and science, The unseen realm, Ethics,
  Formation and practice, Missions and world religions, Church history and authority.
  If a corpus domain name does not match one of these, the validator fails. Matching
  names are what make a wizard-built map, Thomas's map and a tradition map comparable.
- `order` — the order domains are asked in *within a tier*. See §5.2.
- `file` — relative to `content/wizard/`.

## 4.3 `traditions.json` — the tradition registry

Every `held_by` entry anywhere in the corpus must name an `id` from this file. This is
what stops fourteen parallel sessions inventing "Presbyterian", "Reformed/Presbyterian"
and "Calvinist" as three separate labels.

```json
{
  "schema_version": 1,
  "traditions": [
    {
      "id": "non-denominational",
      "display_name": "Non-denominational evangelical",
      "short_name": "Non-denom",
      "kind": "stream",
      "in_ui": true,
      "in_scorecard": true,
      "order": 1,
      "blurb": "Independent evangelical congregations without a binding confession, typically low-church and broadly Baptistic on the sacraments.",
      "confessional_sources": [],
      "map": {
        "title": "Non-denominational evangelical",
        "intro": "Where this stream has no single confessional answer, the entry says so rather than picking one."
      }
    },
    {
      "id": "reformed",
      "display_name": "Reformed / Presbyterian",
      "short_name": "Reformed",
      "kind": "tradition",
      "in_ui": true,
      "in_scorecard": true,
      "order": 5,
      "blurb": "Churches confessing the Westminster Standards or the Three Forms of Unity.",
      "confessional_sources": [
        "Westminster Confession of Faith (1646)",
        "Westminster Shorter and Larger Catechisms",
        "Canons of Dordt (1619)",
        "Belgic Confession (1561)",
        "Heidelberg Catechism (1563)"
      ],
      "map": {
        "title": "Reformed / Presbyterian",
        "intro": "Positions taken from the Westminster Standards and the Three Forms of Unity."
      }
    },
    {
      "id": "oneness-pentecostal",
      "display_name": "Oneness Pentecostalism",
      "short_name": "Oneness",
      "kind": "movement",
      "in_ui": false,
      "in_scorecard": false,
      "order": 90,
      "blurb": "Modalist Pentecostal bodies that reject the Trinity of persons.",
      "confessional_sources": ["United Pentecostal Church International, Articles of Faith"],
      "map": null
    }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | stable, lowercase-hyphenated. Never reused, never renamed. |
| `display_name` | yes | full label in the learn UI and on tradition maps |
| `short_name` | yes | chip label on a position card and a scorecard column header. Keep under 12 characters. |
| `kind` | yes | `tradition` (a church family with formularies), `stream` (a recognisable but unconfessional grouping), `movement` (a specific modern movement), `school` (a named theological school) |
| `in_ui` | yes | offered as a wizard tradition lens on the opening screen |
| `in_scorecard` | yes | gets a generated tradition map (phase 6) and a scorecard column |
| `order` | yes | display order. Thomas's centre of gravity is non-denominational / Pentecostal, so those sort first. |
| `blurb` | yes | one neutral sentence its own adherents would accept |
| `confessional_sources` | yes (may be empty) | the documents phase 5 must quote from for this tradition |
| `map` | required when `in_scorecard` is true | title and one-paragraph intro for the generated tradition map |

**The minimum UI set**, fixed by `decisions.md`: non-denominational evangelical,
Pentecostal / Charismatic, Baptist, Anglican, Reformed / Presbyterian, Roman Catholic,
Eastern Orthodox. Phase 5 adds Lutheran, Methodist / Wesleyan, Anabaptist and
Restorationist. `in_ui: false` entries exist so an outside-orthodoxy position can name
who actually holds it without that group being offered as a lens.

**"I'd rather not say" is always an option on the tradition screen**, and it is not a
lesser one. It leaves position order at the corpus's own order.

## 4.4 A domain file

```json
{
  "schema_version": 1,
  "domain": "scripture",
  "doctrines": [ /* one object per doctrine, in `order` */ ]
}
```

### The doctrine object

```json
{
  "id": "scripture.inerrancy",
  "node_title": "Inerrancy",
  "slug": "inerrancy",
  "domain": "scripture",
  "order": 1,
  "kind": "choice",
  "question": "How far does Scripture's truthfulness extend?",
  "framing": "Everyone in this conversation holds that Scripture is true. The question is the range of that claim — whether it covers history and cosmology as well as faith and salvation, and what counts as an error in a text that speaks phenomenally and in ancient genres.",
  "suggested_tier": "T1",
  "tier_note": "Ortlund places the authority of Scripture at the first tier: it is the ground every other doctrine is argued from.",
  "refs": "2 Tim 3:16-17; John 10:35",
  "links": ["canon", "hermeneutic-method"],
  "open": {
    "hold": "Undecided.",
    "todo": "Work out whether inerrancy extends to history and science or only to what Scripture teaches for salvation, and what the phenomenal language of the Bible implies either way.",
    "tier": "T1"
  },
  "positions": [ /* see below */ ],
  "tradition_overrides": { /* see §4.6 */ },
  "learn_note": "The Chicago Statement (1978) is the reference point for the full-inerrancy position in the English-speaking world; the Lausanne Covenant's phrase 'without error in all that it affirms' is the most widely shared wording across evangelicalism.",
  "sources": [
    { "label": "Chicago Statement on Biblical Inerrancy", "citation": "International Council on Biblical Inerrancy, 1978, Articles XII-XIII", "url": "https://www.etsjets.org/files/documents/Chicago_Statement.pdf" }
  ]
}
```

| Field | Required | Meaning and rules |
|---|---|---|
| `id` | yes | `"<domain>.<short-name>"`. Stable forever. The key phase 6 joins on. Changing wording is free; changing an `id` is not. |
| `node_title` | yes | the `##` heading text. Short noun phrase, sentence case, no trailing punctuation. |
| `slug` | yes | must equal `slugify(node_title)` — lowercase, `&`→`and`, apostrophes dropped, every other non-alphanumeric run collapsed to a hyphen, trimmed. Stored explicitly and **checked by the validator**, so a title edit that silently breaks a `link` is caught. |
| `domain` | yes | must equal the file's `domain` and exist in `manifest.json`. |
| `order` | yes | order within the domain. |
| `kind` | yes | `choice` — genuinely contested; the wizard shows candidates neutrally. `settled` — the historic church has one answer and the framing says so plainly rather than staging a false choice. A `settled` doctrine still offers "I haven't worked this out yet", and still offers any `orthodoxy: outside` positions phase 5 supplies, marked as outside. |
| `question` | yes | the wizard's headline. **Neutral interrogative, no pronouns** (§4.7). |
| `framing` | yes | two to four sentences setting up what is actually at stake, in terms every candidate holder would accept. Shown under the question and reused verbatim by phase 6's learn page. This is where the doctrine gets taught. |
| `suggested_tier` | yes | one of `T1`, `T1.5`, `T2`, `T2.5`, `T3`, `T4`. Pre-fills the tier control; always editable. |
| `tier_note` | yes | one sentence explaining the suggested tier. Shown in the tier control's in-place explanation. |
| `refs` | no | fallback scripture references for the doctrine, semicolon-separated, one to four. Used when a position carries none. Prefer the texts actually argued over, including those the rival view leans on. |
| `links` | no | array of **slugs of other doctrines** in the corpus. Emitted as `link` lines, but **pruned to slugs present in the user's own map** at generation time (§5.6). |
| `open` | yes | what "I haven't worked this out yet" generates. `hold` defaults to `"Undecided."`; `todo` is required and is the one place first-person voice is expected; `tier` optional, defaults to `suggested_tier`. |
| `positions` | yes | at least two for `kind: choice`, at least one for `kind: settled`. In the order the wizard shows them absent a tradition lens. |
| `tradition_overrides` | no | §4.6. Required whenever a tradition holds more than one position. |
| `learn_note` | no | context for phase 6's learn page that no single position owns — history, terminology, why the labels are contested. Never appears in a map. |
| `sources` | yes | at least one `{label, citation, url?}`. Doctrine-level sourcing for the framing and the taxonomy. Per-position sourcing is separate and also required. |

### The position object

```json
{
  "id": "scripture.inerrancy/full",
  "label": "Full inerrancy",
  "hold": "Scripture is without error in all that it affirms, including what it affirms about history and the created order.",
  "why": "Scripture's self-attestation and Christ's own use of the Old Testament treat it as true in what it asserts, not only in what it teaches for salvation.",
  "vs": "Limited infallibility — Scripture trustworthy on faith and salvation, errant on history and science.",
  "tier": null,
  "confidence_default": "confident",
  "refs": "2 Tim 3:16-17; John 10:35",
  "equivalence_group": null,
  "orthodoxy": "historic",
  "orthodoxy_note": null,
  "held_by": [
    { "tradition": "reformed", "stance": "confessional", "note": null, "citation": "Westminster Confession of Faith 1.4-1.5, 1.8" },
    { "tradition": "baptist", "stance": "confessional", "note": null, "citation": "Baptist Faith and Message (2000), Article I" },
    { "tradition": "pentecostal", "stance": "majority", "note": "The Assemblies of God's Statement of Fundamental Truths affirms verbal inspiration and infallibility; 'inerrancy' as a term is more recent than the movement.", "citation": "Assemblies of God, Statement of Fundamental Truths, Article 1" },
    { "tradition": "non-denominational", "stance": "majority", "note": null, "citation": "Lausanne Covenant (1974), Article 2" }
  ],
  "learn_detail": "Full inerrancy as codified at Chicago allows for phenomenal language, approximation, and topical rather than chronological arrangement; its defenders regard those as features of ordinary truthful speech rather than concessions.",
  "sources": [
    { "label": "Westminster Confession of Faith", "citation": "1646, ch. 1.4-1.5", "url": "https://www.pcaac.org/bco/westminster-confession/" }
  ]
}
```

| Field | Required | Meaning and rules |
|---|---|---|
| `id` | yes | `"<doctrine id>/<short-name>"`. Stable forever. **Phase 6's primary agreement key.** |
| `label` | yes | short handle: a chip on the card, a scorecard column header, a diff row label. Under 28 characters. A name adherents use, never a critic's name for it. |
| `hold` | yes | **the exact sentence that lands in the map.** One or two sentences. Voice-neutral (§4.7) so the same string is truthful in a member's map and in a tradition's map. This is what the wizard shows on the card — the person sees the words they are choosing, not a paraphrase of them. |
| `why` | no | the one-line rationale, in the position's own terms. Lands as `why`. |
| `vs` | no | the rival view this position rejects, **stated in a form its own holders would accept**. Lands as `vs`. Never a caricature, never scare-quoted. |
| `tier` | no | overrides `suggested_tier` when this particular answer changes the stakes. `null` when it does not. |
| `confidence_default` | yes | what the confidence control pre-fills: `certain`, `confident`, `leaning`, `open`, `rejected`. `certain` only for creedal positions. Always editable. |
| `refs` | no | position-specific references, semicolon-separated, one to four. Falls back to `doctrine.refs`. |
| `equivalence_group` | no | a shared string marking positions that are *the same answer under different names or with different reasoning*. Phase 6 reports these as "agree in substance" rather than "differ". Use sparingly, and only where an adherent of either would say "yes, that is my view too". |
| `orthodoxy` | yes | §4.5. |
| `orthodoxy_note` | required when `orthodoxy` is `contested` or `outside` | one or two sentences saying plainly what is at issue and, for `outside`, which conciliar definition or creedal article it falls outside of. |
| `held_by` | yes, may be empty | see the stance table below. Empty only for a position no registered tradition holds. |
| `learn_detail` | no | a paragraph for phase 6's learn page: internal diversity, common misunderstandings, terminology. Never appears in a map. |
| `sources` | yes | at least one `{label, citation, url?}`. A position without a traceable source is a position someone made up. |

### `held_by` entries and the stance vocabulary

```json
{ "tradition": "anglican", "stance": "permitted", "note": "…", "citation": "Thirty-Nine Articles, XXVII" }
```

| `stance` | Means | Tradition-map confidence (§4.6) |
|---|---|---|
| `confessional` | defined in the tradition's binding confessional documents | `certain` |
| `majority` | the predominant view in practice, not confessionally binding | `confident` |
| `permitted` | one of several views its formularies explicitly allow | `leaning` |
| `minority` | a real, self-identified minority stream within the tradition | `leaning` |
| `historic` | held historically, materially less common now | `leaning` |

`citation` is **required on every `held_by` entry**. It is the attribution claim — "the
Reformed hold this" — and it is the claim most likely to be wrong. `note` is optional and
is where genuine nuance goes ("the term post-dates the movement", "the 1963 revision
softened this").

## 4.5 Orthodoxy markers

`decisions.md`: *views outside historic orthodoxy are included and plainly marked as
outside, with the reason. Not omitted, not presented as equal options.*

| `orthodoxy` | Test | UI treatment |
|---|---|---|
| `historic` | compatible with the ecumenical creeds and the Chalcedonian definition | no marker |
| `contested` | inside the creeds, but a live and sharp intra-Christian dispute where one side regards the other as gravely mistaken | no marker; the dispute *is* the doctrine |
| `outside` | contradicts an ecumenical creed or conciliar definition | a plain, unemphatic line above the card — *Outside the historic creeds* — plus the `orthodoxy_note`, and the position sorts last regardless of the tradition lens |

`contested` exists so phase 5 does not have to choose between calling a serious
disagreement heretical and pretending it is trivial. The marker is descriptive, not a
warning label, and its wording is fixed in code so fourteen sessions cannot each invent
their own.

`outside` positions are still selectable. A person who holds one gets a map that says so.
That is the honest outcome, and `confidence: rejected` exists for the person who wants to
record having considered and rejected it.

## 4.6 `tradition_overrides` — the "no single answer" case

A tradition that genuinely holds two positions cannot be flattened into one node without
lying. The schema forces the honest answer rather than allowing a silent pick.

**The rule the generator and the validator both enforce:**

1. If `tradition_overrides[T]` exists for doctrine D, phase 6's tradition map uses it.
2. Else, if exactly one position in D has T in its `held_by`, that position is used.
3. Else, if **more than one** position names T and there is no override — **the build fails,
   loudly, naming D and T.** Phase 5 must supply an override.
4. Else (no position names T), D is omitted from T's map and listed in the coverage report.

```json
"tradition_overrides": {
  "anglican": {
    "positions": ["church.baptism/infant-covenant", "church.baptism/regeneration"],
    "hold": "Infant baptism is the church's normal practice, and the Articles hold it agreeable with the institution of Christ without settling what the water effects.",
    "why": "The Thirty-Nine Articles commend the baptism of young children and describe baptism as a sign of regeneration and an instrument of ingrafting — wording both wings of the tradition have read in their own sense for four centuries.",
    "vs": null,
    "tier": "T3",
    "confidence": "leaning",
    "flags": [],
    "note": "Anglican formularies are deliberately capacious here. An entry that picked either the evangelical or the Anglo-Catholic reading would be describing a party, not the tradition.",
    "citation": "Thirty-Nine Articles, XXVII; Book of Common Prayer (1662)"
  }
}
```

| Field | Required | Meaning |
|---|---|---|
| `positions` | yes | the position ids this override spans. The validator checks each exists in this doctrine. |
| `hold` | yes | the neutral sentence for the tradition's map node |
| `why`, `vs` | no | as in a position |
| `tier` | no | defaults to `suggested_tier` |
| `confidence` | no | defaults to `leaning` — a divided tradition is not certain |
| `flags` | no | array of flag names without the `#`. `["study"]` is legitimate for a tradition actively revisiting a question. |
| `note` | yes | shown on the learn page under the tradition's name |
| `citation` | yes | the formulary that permits the breadth |

An override may also exist for a tradition holding **one** position, when the map node
should read differently from that position's own `hold` — for example where a tradition
holds the substance but frames it in its own vocabulary. Rule 1 covers this: an override
always wins.

## 4.7 The voice rule, made checkable

Project 12's convention is *first person or neutral, never second person*. Ninety-nine
doctrines written by fourteen separate sessions will drift, so the rule is split by field
and made mechanical.

| Field | Voice | Test |
|---|---|---|
| `question` | **neutral interrogative, no pronouns at all** | "How far does Scripture's truthfulness extend?" — not "What do you believe about inerrancy?" and not "What do I hold about inerrancy?" |
| `framing`, `learn_note`, `learn_detail`, `blurb`, `note` | neutral third person | describes the debate, not the reader |
| `hold`, `why`, `vs` | **voice-neutral proposition** — no "I", no "you", no "we" | "Scripture is without error in all that it affirms." The same sentence must read truthfully in a member's map *and* in a tradition's map. This is why `hold` is not written as "I believe that…". |
| `open.todo` | **first person** | "Work out whether…" / "Decide, because…" — matching the existing map exactly (see the EFS / ESS node). Only ever appears in a member's map. |
| UI chrome (buttons, headings) | neutral or first person | "I haven't worked this out yet", "Word it my way", "Finish here" |

**The validator enforces the mechanical half:** it rejects `you`, `your`, `yours`,
`yourself` anywhere in `question`, `framing`, `hold`, `why`, `vs`, `label`, `note`, and
rejects `I`, `my`, `we`, `our` in `hold`, `why`, `vs`, `question`. Word-boundary matching,
case-insensitive. The judgment half stays human.

**Why `hold` is voice-neutral and not first person.** It is the single string that serves
both surfaces — the member's map and the tradition's map. Writing it as "I hold that…"
would make the tradition map read as a person; rewriting it per surface would mean two
strings that can drift apart. One neutral sentence, two truthful uses. This is the most
consequential small decision in the schema.

## 4.8 A complete worked example

`content/wizard/church.json`, one doctrine, filled the way phase 5 must fill all
ninety-nine. The citations here name real documents; phase 5 must still verify each against
the source rather than trusting this example.

```json
{
  "schema_version": 1,
  "domain": "church",
  "doctrines": [
    {
      "id": "church.baptism",
      "node_title": "Baptism",
      "slug": "baptism",
      "domain": "church",
      "order": 3,
      "kind": "choice",
      "question": "Who is baptism for, and what does it do?",
      "framing": "Every tradition baptises, and every tradition reads the same commission in Matthew 28. The disagreement runs along two axes at once: whether the infant children of believers are proper subjects, and whether baptism conveys what it signifies or signifies what has already been conveyed. The two axes are not independent — a view of what baptism does usually settles who it is for.",
      "suggested_tier": "T3",
      "tier_note": "Ortlund puts baptism at the third tier: it shapes which congregation a person can serve in, but it does not divide the gospel. Traditions that hold baptism to be regenerative reasonably tier it higher.",
      "refs": "Matt 28:19; Acts 2:38-39; Col 2:11-12; 1 Pet 3:21",
      "links": ["the-lords-supper", "church-membership"],
      "open": {
        "hold": "Undecided.",
        "todo": "Work out whether the household baptisms in Acts and the covenant argument from circumcision in Colossians 2 carry the weight the paedobaptist case puts on them, and decide what baptism actually effects before deciding who receives it.",
        "tier": "T3"
      },
      "positions": [
        {
          "id": "church.baptism/believer",
          "label": "Believer's baptism",
          "hold": "Baptism is for those who have professed faith, by immersion, as the public sign of a repentance already given.",
          "why": "Every baptism narrated in Acts follows a profession of faith, and the sign belongs to those the thing signified is true of.",
          "vs": "The baptism of infants on the ground of the covenant promise made to believers and their children.",
          "tier": null,
          "confidence_default": "confident",
          "refs": "Acts 2:38-39; Acts 8:36-38; Rom 6:3-4",
          "equivalence_group": "credobaptism",
          "orthodoxy": "historic",
          "orthodoxy_note": null,
          "held_by": [
            { "tradition": "baptist", "stance": "confessional", "note": null, "citation": "Baptist Faith and Message (2000), Article VII; Second London Baptist Confession (1689), 29.2" },
            { "tradition": "pentecostal", "stance": "confessional", "note": null, "citation": "Assemblies of God, Statement of Fundamental Truths, Article 6" },
            { "tradition": "non-denominational", "stance": "majority", "note": "Practice rather than confession; most independent evangelical congregations baptise on profession without holding a developed covenantal argument against the alternative.", "citation": "Lausanne Covenant (1974), Article 6" },
            { "tradition": "anabaptist", "stance": "confessional", "note": null, "citation": "Schleitheim Confession (1527), Article 1" },
            { "tradition": "restorationist", "stance": "confessional", "note": "Held together with baptismal regeneration, which most other credobaptists reject — see the regeneration position.", "citation": "Alexander Campbell, The Christian System (1839)" }
          ],
          "learn_detail": "Credobaptists divide over whether baptism is a bare sign, a means of grace to faith already present, or the appointed moment of remission. The subject of baptism is agreed among them; its effect is not.",
          "sources": [
            { "label": "Second London Baptist Confession", "citation": "1689, ch. 29", "url": "https://www.the1689confession.com/" },
            { "label": "Baptist Faith and Message", "citation": "SBC, 2000, Article VII", "url": "https://bfm.sbc.net/bfm2000/" }
          ]
        },
        {
          "id": "church.baptism/infant-covenant",
          "label": "Covenantal infant baptism",
          "hold": "Baptism is administered to the infant children of believers as the sign and seal of the covenant of grace, and to those who come to faith as adults.",
          "why": "The covenant sign was given to believers and their children under Abraham, and the New Testament nowhere withdraws that inclusion.",
          "vs": "Restricting baptism to those who have professed faith, which narrows a covenant sign the New Testament never narrows.",
          "tier": null,
          "confidence_default": "confident",
          "refs": "Gen 17:7; Acts 2:38-39; Col 2:11-12",
          "equivalence_group": null,
          "orthodoxy": "historic",
          "orthodoxy_note": null,
          "held_by": [
            { "tradition": "reformed", "stance": "confessional", "note": null, "citation": "Westminster Confession of Faith 28.4; Heidelberg Catechism Q.74" },
            { "tradition": "methodist", "stance": "confessional", "note": "Held with a stronger accent on prevenient grace than the Reformed covenantal argument carries.", "citation": "Articles of Religion of the Methodist Church, XVII" },
            { "tradition": "lutheran", "stance": "confessional", "note": "Lutherans affirm infant baptism but ground it in baptismal regeneration rather than covenant succession — see the regeneration position.", "citation": "Augsburg Confession, IX" }
          ],
          "learn_detail": "The covenantal argument is an argument from continuity: it places the burden on the credobaptist to show where the New Testament excludes the children who were included before.",
          "sources": [
            { "label": "Westminster Confession of Faith", "citation": "1646, ch. 28.4", "url": "https://www.pcaac.org/bco/westminster-confession/" },
            { "label": "Heidelberg Catechism", "citation": "1563, Q&A 74", "url": "https://www.crcna.org/welcome/beliefs/confessions/heidelberg-catechism" }
          ]
        },
        {
          "id": "church.baptism/regeneration",
          "label": "Baptismal regeneration",
          "hold": "Baptism is the instrument by which God gives new birth, forgiveness and union with Christ, and is therefore administered to infants and converts alike.",
          "why": "The New Testament attaches the gift itself to the washing — new birth of water and Spirit, baptism that now saves — rather than to a sign of it.",
          "vs": "Treating baptism as a sign of a grace given elsewhere, which detaches the promise from the act the New Testament attaches it to.",
          "tier": "T2",
          "confidence_default": "confident",
          "refs": "John 3:5; Titus 3:5; 1 Pet 3:21; Acts 22:16",
          "equivalence_group": null,
          "orthodoxy": "historic",
          "orthodoxy_note": null,
          "held_by": [
            { "tradition": "roman-catholic", "stance": "confessional", "note": null, "citation": "Catechism of the Catholic Church, 1213-1215, 1250" },
            { "tradition": "orthodox", "stance": "confessional", "note": "Administered with chrismation and communion in a single rite, so the question is less separable than in the West.", "citation": "Nicene Creed, 'one baptism for the remission of sins'; Confession of Dositheus (1672), Decree 16" },
            { "tradition": "lutheran", "stance": "confessional", "note": null, "citation": "Augsburg Confession, IX; Small Catechism, IV" },
            { "tradition": "anglican", "stance": "permitted", "note": "The Articles and the Prayer Book's baptismal office are read in this sense by the Anglo-Catholic and much of the central tradition; the evangelical wing reads the same texts as covenantal sign.", "citation": "Thirty-Nine Articles, XXVII; Book of Common Prayer (1662), Publick Baptism of Infants" },
            { "tradition": "restorationist", "stance": "confessional", "note": "Held with believer's baptism only, which distinguishes it sharply from the paedobaptist forms.", "citation": "Alexander Campbell, The Christian System (1839)" }
          ],
          "learn_detail": "Baptismal regeneration is not one position but a family: Rome and the East hold it with infant baptism, the Restorationist stream holds it with believer's baptism only. Grouping them by effect and splitting them by subject is the clearest way to read this doctrine.",
          "sources": [
            { "label": "Catechism of the Catholic Church", "citation": "1992, 1213-1215, 1250", "url": "https://www.vatican.va/archive/ENG0015/_INDEX.HTM" },
            { "label": "Augsburg Confession", "citation": "1530, Article IX", "url": "https://bookofconcord.org/augsburg-confession/" }
          ]
        },
        {
          "id": "church.baptism/not-required",
          "label": "No water baptism",
          "hold": "Water baptism belonged to an earlier stage of God's dealings and is not the practice of the church now; the baptism that matters is the Spirit's.",
          "why": "Ephesians speaks of one baptism, and the Spirit's baptism into the body is the one the New Testament makes constitutive of belonging to Christ.",
          "vs": "Continuing the water rite as a standing command of Christ to the church.",
          "tier": "T2",
          "confidence_default": "leaning",
          "refs": "Eph 4:5; 1 Cor 12:13",
          "equivalence_group": null,
          "orthodoxy": "contested",
          "orthodoxy_note": "Held by the Quaker tradition and by hyper-dispensationalist groups. It contradicts no creedal article directly, but it sets aside a practice every historic communion has treated as commanded, and the Nicene Creed's confession of 'one baptism for the remission of sins' is read by most traditions as the water rite.",
          "held_by": [
            { "tradition": "quaker", "stance": "confessional", "note": "Held on the ground that the outward sign is fulfilled in the inward reality, not that the sign is trivial.", "citation": "Robert Barclay, Apology for the True Christian Divinity (1678), Proposition XII" }
          ],
          "learn_detail": "Quakers do not argue that baptism is unimportant but that the inward baptism is the thing itself, and that maintaining the outward sign risks mistaking the shadow for the substance.",
          "sources": [
            { "label": "Barclay's Apology", "citation": "1678, Proposition XII", "url": "https://quakerheritagepress.com/qhpbooks/apology.htm" }
          ]
        }
      ],
      "tradition_overrides": {
        "anglican": {
          "positions": ["church.baptism/infant-covenant", "church.baptism/regeneration"],
          "hold": "Infant baptism is the church's normal practice, and the Articles hold it agreeable with the institution of Christ without settling what the water effects.",
          "why": "The Thirty-Nine Articles commend the baptism of young children and describe baptism as a sign of regeneration and an instrument of ingrafting — wording both wings of the tradition have read in their own sense for four centuries.",
          "vs": null,
          "tier": "T3",
          "confidence": "leaning",
          "flags": [],
          "note": "Anglican formularies are deliberately capacious here. An entry that picked either the evangelical or the Anglo-Catholic reading would be describing a party, not the tradition.",
          "citation": "Thirty-Nine Articles, XXVII; Book of Common Prayer (1662)"
        },
        "restorationist": {
          "positions": ["church.baptism/believer", "church.baptism/regeneration"],
          "hold": "Baptism is by immersion, on profession of faith, for the remission of sins.",
          "why": "Peter's answer at Pentecost joins repentance, baptism and forgiveness in a single sentence, and the Restorationist plea is to say no more and no less than that sentence says.",
          "vs": "Separating baptism from the moment of remission so that it becomes a testimony to a forgiveness already received.",
          "tier": "T2",
          "confidence": "confident",
          "flags": [],
          "note": "This is genuinely a third position rather than a compromise: credobaptist in subject, regenerative in effect. It is why the two-axis framing in this doctrine matters.",
          "citation": "Acts 2:38 as read in Alexander Campbell, The Christian System (1839)"
        }
      },
      "learn_note": "The cleanest way to hold this doctrine in mind is as two questions: who is baptised, and what does baptism do. Most traditions answer both together, and the Restorationist stream is the standing proof that the answers are separable.",
      "sources": [
        { "label": "Nicene-Constantinopolitan Creed", "citation": "381, 'one baptism for the remission of sins'", "url": "https://www.ccel.org/creeds/nicene.creed.html" }
      ]
    }
  ]
}
```

**Read what that example is doing**, because it is the standard:

- The `framing` teaches the two axes before asking anything, and does not say which axis matters.
- Every `hold` is a sentence its own holders would sign. None is a summary written by an opponent.
- Every `vs` states the rival in the rival's own terms — "on the ground of the covenant promise", not "sprinkling babies".
- Lutherans appear under **both** the covenantal-infant and the regeneration positions with a `note` saying why; Anglicans and Restorationists appear under two positions and therefore **require** an override. The schema forced all three to be handled rather than flattened.
- The `not-required` position is marked `contested`, not `outside`, with the reason stated and its holder named — included, not omitted, not presented as equivalent.
- Every `held_by` carries a citation naming a document, and every `sources` entry is a document rather than a website in general.
- `refs` are the texts actually argued over, and they include the ones the *other* side leans on.

## 4.9 What a chosen position generates

| Node part | Source | Rule |
|---|---|---|
| `##` title | `doctrine.node_title` | verbatim |
| tier token | the tier control, defaulting to `position.tier ?? doctrine.suggested_tier` | |
| confidence token | the confidence control, defaulting to `position.confidence_default` | |
| flags | `#study` when the answer is "I haven't worked this out yet", or when the person ticks "still working on this" | never `#assumed` — the wizard's output is chosen, not inferred |
| `hold` | `position.hold`, or the person's edited text from "Word it my way" | |
| `why` | `position.why` if present | dropped if the person clears it |
| `vs` | `position.vs` if present | dropped if the person clears it |
| `todo` | empty, except for the open answer, which uses `doctrine.open.todo` | |
| `refs` | `position.refs ?? doctrine.refs` | |
| `link` | `doctrine.links`, **pruned** to slugs present in the resulting map (§5.6) | |

The "I haven't worked this out yet" answer generates:

```
## Baptism · T3 · open · #study
  hold  Undecided.
  todo  Work out whether the household baptisms in Acts and the covenant argument from circumcision in Colossians 2 carry the weight the paedobaptist case puts on them, and decide what baptism actually effects before deciding who receives it.
  refs  Matt 28:19; Acts 2:38-39; Col 2:11-12; 1 Pet 3:21
```

That is a real map node with real study value. It is not a gap.

## 4.10 Validation rules — `engine/validate_content.py`

Run with `py engine/validate_content.py`. Exits non-zero on any error. Phase 5 runs it
after every domain lands; phase 4's own verification runs it over the seed.

**Errors (build fails):**

1. `schema_version` is 1 in every file.
2. Every file listed in `manifest.json` exists; every domain file's `domain` matches its manifest entry; every domain `name` matches one of the fourteen `#` headings in `theology-map.md`.
3. Every `doctrine.id` is globally unique; every `position.id` is globally unique and begins `"<doctrine.id>/"`.
4. `doctrine.slug == slugify(doctrine.node_title)`, using the same algorithm as `editor-core.js` and `render.py`.
5. Every `doctrine.slug` is unique across the corpus.
6. Every entry in `doctrine.links` resolves to a `doctrine.slug` in the corpus.
7. `suggested_tier` and `position.tier` are in `T1, T1.5, T2, T2.5, T3, T4`.
8. `confidence_default` and `tradition_overrides[*].confidence` are in `certain, confident, leaning, open, rejected`.
9. `kind` is `choice` or `settled`; a `choice` doctrine has at least two positions.
10. Every `held_by.tradition` and every `tradition_overrides` key resolves to a `traditions.json` id.
11. Every `held_by` entry has a non-empty `citation`.
12. Every doctrine and every position has at least one `sources` entry with a non-empty `label` and `citation`.
13. `orthodoxy` is `historic`, `contested` or `outside`; `orthodoxy_note` is non-empty when not `historic`.
14. `doctrine.open.todo` is non-empty.
15. **Ambiguity rule:** for every (doctrine, tradition) where the tradition appears in two or more positions' `held_by`, a `tradition_overrides` entry exists. The error names both.
16. Every `tradition_overrides[T].positions` id exists in that doctrine, and `T` appears in at least one of them.
17. `refs` fields are semicolon-separated, every part non-empty, at most four parts.
18. The voice rule (§4.7), word-boundary, case-insensitive.
19. No `hold`, `why` or `vs` lacks terminal punctuation, and none exceeds 320 characters.
20. Every `in_scorecard: true` tradition has a non-null `map` object.

**Warnings (reported, do not fail):**

- A doctrine no `in_ui` tradition holds any position in.
- An `in_scorecard: true` tradition holding positions in fewer than 60% of doctrines — a thin tradition map makes a misleading scorecard column.
- A position with an empty `held_by`.
- A doctrine with no doctrine-level `refs` and at least one position without `refs`.

The validator prints a **coverage matrix** at the end: doctrines down, `in_scorecard`
traditions across, one of `Y` (one position), `!` (override), `-` (no position). Phase 5's
outcome file pastes it in.

## 4.11 References and `verses.md`

Corpus references are not in `theology-map.md`, so `render.py`'s reference sync never sees
them. `engine/corpus_refs.py` closes that gap:

- walks the corpus and collects every `refs` string from doctrines and positions,
- splits on `;` the way `render.py` does,
- calls `render.py`'s **existing** verse-sync path to append empty stubs to
  `documentation/verses.md` for any reference not already present — reusing the renderer's
  code rather than reimplementing it,
- prints how many are new.

Then `py engine/fetch_verses.py` fills them from the NET Bible API. **A blank after fetching
is a bad reference, not a network failure** — usually versification, since the NET follows
the critical text. Psalms, 2 Corinthians and Malachi are the known trouble spots. Phase 5's
verification includes "every corpus reference resolves to text".

---

# 5. The wizard

## 5.1 Where it lives

| Path | File | Note |
|---|---|---|
| `/wizard` | `web/wizard.html` | new `vercel.json` rewrite, alongside phase 1's |
| — | `web/wizard.js` | UI controller only — screens, state, events |
| — | `engine/wizard-generate.js` | **pure**: `(corpus, answers, existingDomains) → domains model`. UMD like `editor-core.js`, so it runs under Node for headless verification. No DOM, no fetch. |
| — | `engine/editor-core.js` | **unmodified**. Provides `parse`, `serialize`, `newNode`, `slugify`. |
| — | `web/session.js` | phase 1b's module: the one place that knows the `localStorage` user key, plus `apiFetch` |

Signed out, `/wizard` redirects to `/app`, matching `/edit` and `/admin`.

**Splitting the generator out of the UI is the single most useful structural decision
here.** It makes the whole content-to-markdown path testable from the command line with
`node`, with no browser and no deploy — which matters enormously in a program that has
banned browser automation.

## 5.2 Order of questions

`decisions.md`: **tier order, T1 first.** Ortlund's logic wins over retention.

Sort key, ascending: `(tier_rank(suggested_tier), domain.order, doctrine.order)`, where
`tier_rank` is T1=0, T1.5=1, T2=2, T2.5=3, T3=4, T4=5.

So a person is asked about Scripture and Christ before the millennium, and within T1 the
domains come in the map's own order. The tradition lens does **not** reorder questions — it
orders positions within a question. Reordering questions by tradition would make the
wizard's shape itself an argument.

## 5.3 The screens

**Screen 0 — the opening.** What this is, how long it takes, that it can be left at any
point and picked up later, and that everything it writes is editable afterwards. Names the
number of questions remaining.

**Screen 1 — the tradition lens.** "Is there a tradition whose answers should be shown
first?" A list of `in_ui: true` traditions with their `blurb`, plus **"I'd rather not say"**,
presented as an equal option. The copy states plainly, on the screen: *this changes the order
positions are shown in and labels who holds what. It never fills anything in — every answer
below is mine.* Stored in `localStorage` under `tmm.wizard.tradition`, changeable at any
point from the question screen's header.

**Screen 2..N — one doctrine per screen.** Per the approved wireframes:

```
  Church · question 14 of 99                    [ lens: Baptist v ]   [ Finish here ]

  Who is baptism for, and what does it do?

  Every tradition baptises, and every tradition reads the same commission...
  (framing, two to four sentences)

  +--------------------------------------------------------------+
  | Believer's baptism            Baptist · Pentecostal · Anabap. |
  | "Baptism is for those who have professed faith, by immersion, |
  |  as the public sign of a repentance already given."           |
  |                                            [ Word it my way ] |
  +--------------------------------------------------------------+
  +--------------------------------------------------------------+
  | Covenantal infant baptism      Reformed · Methodist · Luth.   |
  | ...                                                           |
  +--------------------------------------------------------------+
  +--------------------------------------------------------------+
  | Outside the historic creeds — (orthodoxy_note)                |
  | ...                                                           |
  +--------------------------------------------------------------+

  ================================================================
  | I haven't worked this out yet                                 |
  | This becomes a real entry: confidence "open", flagged for      |
  | study, with a note of what is left to settle.                  |
  ================================================================

  > Who believes what?

  [ back ]                                                [ next ]
```

Load-bearing details:

- **The card shows the `hold` sentence verbatim** — the exact words that will land in the
  map, not a paraphrase. This is what makes "pick the one closest to mine" an honest act.
- **Tradition chips** come from `held_by`, using `short_name`, at most four then "+n more".
  The lens tradition's chip is emphasised. Chips are neutral labels, never rankings.
- **"I haven't worked this out yet"** is visually the equal of the position cards — not a
  skip link, not greyed, not below a fold. Its subtitle says what it produces, so choosing
  it is choosing something.
- **"Word it my way"** opens a textarea pre-filled with the position's `hold`. Editing is
  expected, not a correction. Copy: *my map, my words — the wording below is a starting
  point.* An edited `hold` is kept, and phase 6 reports it as "worded my own way" rather
  than guessing.
- **"Who believes what?"** expands to the full `held_by` list: display name, stance in plain
  English ("defined in its confessions" / "the majority view in practice" / "one of several
  views its formularies allow" / "a minority stream" / "held historically"), the `note`, and
  the citation. This is the learning affordance inside the wizard, and it uses exactly the
  data phase 6's learn page uses.
- **After a position is chosen**, tier and confidence controls appear beneath it, pre-filled,
  each with the in-place explanation phase 3 built, plus the `tier_note`. Changing them is
  one click. They are shown, not hidden behind "advanced".
- **"Finish here"** on every screen. It does not warn, does not guilt, does not ask "are you
  sure" — it saves and goes to the map. That is the whole point of C8.
- **Back** re-opens the previous doctrine with the previous answer selected and editable.

**Screen N+1 — the finish screen.** What was built: node count, tier spread, how many
questions are open and flagged for study, how many doctrines remain unasked. Three routes
onward: view my map, edit it, carry on with the wizard. Plus the sentence that matters:
*every entry here is mine to edit, and editing is expected.*

## 5.4 Persistence, resume, and why there is no answer log

The wizard writes into the map after **every** answer, through the phase 1c save path.
There is no separate wizard state on the server, and no new table or column.

```
answer chosen
  -> apply to the in-memory domains model
  -> EditorCore.serialize(domains)
  -> POST /api/map { user_id, markdown, expected_updated_at }
  -> store the returned updated_at as the new concurrency token
```

**Resume falls out of this for free.** On load, the wizard GETs the user's markdown, parses
it with `EditorCore.parse`, and treats *a doctrine whose `slug` already has a node in the
map* as answered. It resumes at the first unanswered doctrine in sort order and offers
"revisit answered questions" as a separate mode. No answer log, no schema change, no
`localStorage` truth that can go stale.

Consequences, accepted deliberately:

- A node the person wrote by hand in the editor counts as answered. That is correct — the
  wizard must not re-ask something already in the map, and must never overwrite it. The
  wizard **never modifies an existing node** unless the person explicitly revisits it.
- Which *position* was chosen is not recorded, only the resulting text. Phase 6 recovers it
  by matching `hold` against the corpus (`phase-6-design.md` §4) and reports "worded my own
  way" when it cannot. That is a truthful third state rather than a wrong guess.
- The `localStorage` key `tmm.wizard.tradition` holds only the lens. Losing it costs nothing.

**Why not record the position id in the markdown?** It is a file-format change, which
`decisions.md` says stops and waits. It would also put machine metadata into a file whose
entire premise is that a human reads and edits it. Flagged for Thomas in §8.

**Concurrency.** The wizard uses phase 1's `expected_updated_at` token exactly as the editor
does. A 409 means another tab or the editor saved in between: the wizard reloads, re-parses,
re-applies the current answer and retries once; a second 409 stops and says so in plain
words. It never force-saves.

## 5.5 Merging into an existing map

The model the wizard mutates is the parsed *current* map, never an empty one.

1. Find or create the domain section by `name` (exact match against the manifest name).
2. Within it, `EditorCore.newNode(node_title, domainName)`, then set the fields.
3. Insert **in tier order within the domain**, matching the map's own convention (T1 down to
   T4, untiered last), so a wizard-built map looks like a hand-built one.
4. Never touch a node the wizard did not create in this session.

A newly created domain section is appended in `manifest.order` position relative to existing
sections, so a map built in tier order still reads in domain order.

## 5.6 Link pruning — the constraint most likely to be missed

`render.py` warns on a `link` whose target slug matches no node. A partial map is the normal
case for this wizard, so most `doctrine.links` targets will not exist yet.

**Rule: at serialize time, every `link` is filtered to slugs present in the model being
serialized.** Applied on every save, not once at the end, because "Finish here" can happen at
any question.

**And the reverse:** when a later answer creates a node an earlier node links to, the link is
restored. Implementation: the generator stores intended links on the node as
`node._intendedLinks`, and a single `pruneLinks(domains)` pass — run immediately before every
`serialize` — recomputes `node.link` from the intersection of intended links and present
slugs. `_intendedLinks` is an in-memory field only and is never serialized, so nothing
reaches the file that the parser does not understand. On resume, intended links are
re-derived from the corpus by slug, so the pass is stateless across sessions.

Verification is explicit: build a map from **every prefix** of the answer sequence, render
each one, and require **zero warnings** from `render.py` on all of them.

## 5.7 Seed content for phase 4

Two domains, twelve doctrines, enough to prove every mechanism:

- **Scripture** (6): Inerrancy, Canon, Sufficiency of Scripture, Clarity of Scripture,
  Hermeneutic method, Translations.
- **Church** (6): Baptism, The Lord's Supper, Church government, Women in ministry,
  Church membership, Spiritual gifts today.

Chosen because between them they exercise every mechanism: a `settled` doctrine (Canon's
creedal core), traditions holding two positions (Anglican on baptism; Anglican and Methodist
on women in ministry), an `outside` / `contested` marker (baptism's Quaker position), a
position with an empty `held_by`, an equivalence group (credobaptism across Baptist and
Pentecostal wording), and cross-domain `links` in both directions.

**The seed is written to the same standard as phase 5's content** — real citations, real
sourcing, no placeholders. Content written to a lower bar would ship as real content if
phase 5 slipped. The tradition registry is seeded with **all** traditions phase 5 will need,
since a partial registry would force fourteen parallel subagents to edit one shared file.

---

# 6. What phase 6 takes from this schema

Stated here so a phase 5 session reading only this document knows which fields carry
downstream weight. The authoritative list is `phase-6-design.md` §4.

| Field | Phase 6 use |
|---|---|
| `doctrine.id`, `slug`, `node_title`, `domain`, `order` | join key between two maps; learn-page navigation |
| `doctrine.question`, `framing`, `learn_note` | the learn page's per-doctrine header |
| `doctrine.suggested_tier`, `tier_note` | tradition-map tiers; diff grouping by tier |
| `position.id` | **the agreement key** — the same id on both sides means agree |
| `position.hold` | how a map node is matched back to a position; the tradition map's `hold` |
| `position.label` | diff rows, scorecard headers |
| `position.equivalence_group` | "agree in substance" |
| `position.orthodoxy`, `orthodoxy_note` | the learn page's marker; never used to score anyone |
| `position.held_by[].tradition`, `.stance`, `.note`, `.citation` | tradition-map generation, the learn page's per-tradition column, scorecard membership |
| `position.learn_detail`, `sources` | the learn page's body |
| `tradition_overrides` | tradition-map generation where a tradition is divided |
| `traditions.json` (`display_name`, `short_name`, `in_scorecard`, `map`) | the target picker, scorecard columns, generated map headers |

**If a field in that list is missing from a phase 5 entry, phase 6 degrades rather than
fails** — a missing `equivalence_group` costs a nuance; a missing `held_by` citation costs an
attribution the learn page then cannot show. The validator's *errors* are exactly the fields
phase 6 genuinely cannot work without.

---

# 7. Decisions I made for Thomas

Every one is reversible, and none touches the data model or a file format.

1. **JSON, not YAML** (§4.1) — Python's standard library parses JSON, and `requirements.txt` must stay empty.
2. **One content file per domain plus a manifest** (§4.1) — fourteen parallel research subagents with no merge conflicts.
3. **Content served as static assets, not through a serverless function** (§4.1) — keeps the function count at six.
4. **The wizard is client-side JavaScript** (§5.1) — forced by "one serializer", which lives in `editor-core.js`.
5. **The generator is a separate pure module** (`engine/wizard-generate.js`, §5.1) — makes the whole content-to-markdown path testable under Node with no browser, in a program that has banned browser automation.
6. **No answer log anywhere; resume is derived from which node slugs already exist** (§5.4) — the alternative was a file-format or data-model change, which stops and waits.
7. **`hold` is voice-neutral rather than first person** (§4.7) — so one string serves both a member's map and a tradition's map without drifting into two.
8. **A five-value stance vocabulary, mapping to confidence on tradition maps** (§4.4) — a tradition's stated certainty should reflect how firmly it actually holds the view.
9. **A tradition holding two positions is a build error unless an override exists** (§4.6) — the schema forces the honest answer instead of allowing a silent pick.
10. **A third orthodoxy value, `contested`** (§4.5) — so phase 5 need not choose between calling a serious disagreement heretical and calling it trivial.
11. **The tradition lens lives in `localStorage`, not the database** (§5.3) — the gallery does not display denomination (locked amendment), so it is a UI preference, and a column would be a data-model change.
12. **Links are pruned at every serialize** (§5.6) — the only way "Finish here on every screen" and "zero render warnings" can both be true.
13. **The seed corpus is written to phase 5's full standard** (§5.7) — anything less would ship as real content if phase 5 slipped.

---

# 8. Questions for Thomas

None of these block phase 4. Each is recorded so a later session can raise it rather than
silently deciding.

1. **Should the map record which wizard position produced a node?** Today it does not, and
   phase 6 recovers it by matching text, reporting "worded my own way" when a person has
   edited. A single optional token on the heading line would make compare exact — but it is a
   file-format change, so it stopped and waited. The cost of not doing it: an edited answer
   compares as unresolvable rather than as the position it started from.
   **Recommendation: leave it out.** The file's readability is the project's premise, and
   "worded my own way" is an honest answer.

2. **Twelve seed doctrines, then phase 5 for the rest — or a fuller seed first?** Until phase
   5 lands, the wizard covers Scripture and Church only. If a usable-in-church wizard is
   wanted sooner, adding Salvation and Christ to the seed would make it feel complete, at the
   cost of a longer phase 4.

3. **The tradition list.** `traditions.json` seeds non-denominational evangelical,
   Pentecostal / Charismatic, Baptist, Anglican, Reformed / Presbyterian, Roman Catholic,
   Eastern Orthodox, Lutheran, Methodist / Wesleyan, Anabaptist and Restorationist as
   selectable, plus display-only entries for holders of outside positions. Is anything
   missing that his church would look for — Churches of Christ as distinct from
   Restorationist, Vineyard, the INC itself?

4. **Suggested tiers that differ from his own map.** Phase 5's brief already routes these to
   him. Phase 4 adds one case: where the corpus's `suggested_tier` disagrees with the tier on
   the same-slug node in `theology-map.md`, the validator *could* warn. It does not today.
   Worth turning on?

5. **What the wizard does with a doctrine already in the map.** Today: treated as answered,
   never overwritten, revisitable on request. The alternative — offering to replace a
   hand-written node with a corpus position — is more powerful and more dangerous. Left
   deliberately at the safe setting.

6. **Is `#study` right for every "I don't know"?** It is what `decisions.md` locks, and it is
   right for someone who wants to come back to the question. Someone with genuinely no
   interest in the millennium gets a study flag they did not ask for. No change made; noting
   only that a new user's study list will grow fast.
