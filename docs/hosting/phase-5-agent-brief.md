# Phase 5 — the contract every research subagent reads

Written by session 11's main thread so a domain agent needs **this file and nothing
else** — not `phase-4-design.md` (36KB), not `phase-4-outcome.md` (42KB), not
`decisions.md`. It is the schema of record's §4 compressed to what a domain file
needs, plus the four mistakes previous agents actually made.

Repo: `C:\Users\ThomasPC\Desktop\AIProjects\Project 12 - Theology Mind Map`.
Branch `phase-5-corpus` is already checked out. Python is `py`, never `python`.

---

## Your job

Write **one file**: `content/wizard/<domain>.json`. Nothing else. Do not edit
`theology-map.md`, `manifest.json`, `traditions.json`, any other domain file, or any
code. Do not commit. Do not merge.

Write the file incrementally — **doctrine by doctrine, saving after each** — so that
if you are killed mid-run (it happened twice in phase 4, to an account spend limit)
the main thread inherits a partial file it can finish rather than an empty one.
Finish with `py engine/validate_content.py` and fix what it names about *your* file.

---

## The quality bar, which is the whole point of the phase

**Each position must be stated in terms its own adherents would accept.** A Reformed
reader must not wince at the Reformed option; a Roman Catholic must not wince at the
Catholic one. The test is not "is this fair" but "would someone who holds it sign
their name to this sentence".

- **Use each tradition's own confessional documents.** Westminster, the Thirty-Nine
  Articles, the Catechism of the Catholic Church, the Book of Concord, Dordt, the
  Baptist Faith and Message, Schleitheim/Dordrecht, Wesley's Articles, the AG
  Statement of Fundamental Truths, the conciliar definitions. Paraphrase from the
  source, never from a critic's summary, never from memory of a polemic.
- **Steelman every option.** Never pair the strongest form of one view with the
  weakest form of its rival.
- **Note genuine internal diversity** rather than flattening it. "Baptists believe X"
  is usually false.
- **Where a position has no single label**, say so in the entry rather than inventing
  one.
- **A citation you cannot trace is worse than a gap.** If a tradition has no published
  position on a doctrine, leave it out of `held_by` — do not generalise. INC
  especially: it has a short statement of faith and no confession, and the standard
  does not relax for it. A domain where INC holds a position in half the doctrines is
  the correct shape, not a failure.
- **Never write verse text.** Supply the reference only; a later step fetches the NET
  text. Prefer plainly-versified references; the NET follows the critical text, so
  Psalms, 2 Corinthians and Malachi are the known off-by-one trouble spots.

---

## File shape

```json
{
  "schema_version": 1,
  "domain": "<your domain id>",
  "doctrines": [ /* doctrine objects, in ascending `order` from 1 */ ]
}
```

### Doctrine object — every field

```json
{
  "id": "<domain>.<short-name>",
  "node_title": "Inerrancy",
  "slug": "inerrancy",
  "domain": "<domain>",
  "order": 1,
  "kind": "choice",
  "question": "How far does Scripture's truthfulness extend?",
  "framing": "Two to four sentences on what is actually at stake, in terms every candidate holder would accept. This is where the doctrine gets taught.",
  "suggested_tier": "T1",
  "tier_note": "One sentence explaining the suggested tier.",
  "refs": "2 Tim 3:16-17; John 10:35",
  "links": ["canon", "hermeneutic-method"],
  "open": {
    "hold": "Undecided.",
    "todo": "Work out whether … — first person, and the only first-person field in the schema.",
    "tier": "T1"
  },
  "positions": [ /* see below */ ],
  "tradition_overrides": { /* see below; omit or {} if none needed */ },
  "learn_note": "Context no single position owns — history, terminology, why the labels are contested. Optional. Never appears in a map.",
  "sources": [
    { "label": "Chicago Statement on Biblical Inerrancy", "citation": "ICBI, 1978, Articles XII-XIII", "url": "https://…" }
  ]
}
```

| Field | Req | Rules |
|---|---|---|
| `id` | yes | `<domain>.<short-name>`, globally unique, stable forever. |
| `node_title` | yes | the `##` heading text. Sentence case, no trailing punctuation. **Use the exact title from `theology-map.md` where your task list gives one** — compare is per-doctrine and only lines up if both maps use the same title in the same domain. |
| `slug` | yes | must equal `slugify(node_title)`: lowercase, `&`→`and`, apostrophes dropped, every other non-alphanumeric run → one hyphen, trimmed. `"EFS / ESS"` → `"efs-ess"`. Checked by the validator. |
| `domain` | yes | equals the file's `domain`. |
| `order` | yes | 1, 2, 3 … within the file. |
| `kind` | yes | `choice` (genuinely contested — needs **≥2** positions) or `settled` (the historic church has one answer and the framing says so plainly rather than staging a false choice — **≥1** position). |
| `question` | yes | the wizard's headline. **Neutral interrogative, no pronouns at all.** |
| `framing` | yes | 2–4 sentences, neutral third person. |
| `suggested_tier` | yes | one of `T1 T1.5 T2 T2.5 T3 T4`. Use the tier your task list gives from Thomas's own map where there is one. |
| `tier_note` | yes | one sentence. |
| `refs` | no | doctrine-level fallback references, `;`-separated, **1–4 parts**. Prefer the texts actually argued over, including those the rival view leans on. |
| `links` | no | **slugs** of other doctrines anywhere in the corpus. Pruned at generation time to what is in the user's map, so a link to a domain that does not exist yet is not an error — but it **must** resolve to a real slug in the corpus at validation time, so only link to doctrines in your own file or to the slugs your task list names as safe. |
| `open` | yes | `todo` required and **first person** ("Work out whether…", "Decide, because…"). `hold` normally `"Undecided."`. `tier` optional. |
| `positions` | yes | in the order the wizard shows them absent a tradition lens. |
| `tradition_overrides` | see below | required whenever a tradition appears in two positions' `held_by`. |
| `learn_note` | no | never appears in a map. |
| `sources` | yes | ≥1 `{label, citation, url?}`. `url` optional — omit it rather than guessing one. |

### Position object — every field

```json
{
  "id": "<doctrine id>/<short-name>",
  "label": "Full inerrancy",
  "hold": "The exact sentence that lands in someone's map.",
  "why": "The one-line rationale, in the position's own terms.",
  "vs": "The rival view this position rejects, stated in a form its own holders would accept.",
  "tier": null,
  "confidence_default": "confident",
  "refs": "2 Tim 3:16-17; John 10:35",
  "equivalence_group": null,
  "orthodoxy": "historic",
  "orthodoxy_note": null,
  "held_by": [
    { "tradition": "reformed", "stance": "confessional", "note": null, "citation": "Westminster Confession of Faith 1.4-1.5" }
  ],
  "learn_detail": "A paragraph for the learn page: internal diversity, common misunderstandings, terminology. Optional. Never appears in a map.",
  "sources": [ { "label": "…", "citation": "…" } ]
}
```

| Field | Req | Rules |
|---|---|---|
| `id` | yes | `<doctrine.id>/<short-name>`, globally unique, must begin with the doctrine's id and a slash. |
| `label` | yes | **under 28 characters.** A name adherents use, never a critic's name for it. |
| `hold` | yes | **the exact sentence that lands in the map.** One or two sentences, **≤320 characters, terminal punctuation required.** Voice-neutral, so the same string is truthful in a member's map *and* in a tradition's map — never "I believe that…". |
| `why` | no | ≤320 chars, terminal punctuation. |
| `vs` | no | ≤320 chars, terminal punctuation. Never a caricature, never scare-quoted. |
| `tier` | no | overrides `suggested_tier` only when this particular answer changes the stakes. Usually `null`. |
| `confidence_default` | yes | `certain confident leaning open rejected`. **`certain` only for creedal positions.** |
| `refs` | no | 1–4 `;`-separated parts. Falls back to the doctrine's. |
| `equivalence_group` | no | a shared string marking positions that are the *same answer under different names*. **A group of one is always a mistake** — tag every member or use `null`. Scope is corpus-global, so prefix it with your domain unless you mean to join across domains. |
| `orthodoxy` | yes | `historic` / `contested` / `outside` — see below. |
| `orthodoxy_note` | when not `historic` | one or two sentences saying plainly what is at issue, and for `outside` **which conciliar definition or creedal article it falls outside of**. |
| `held_by` | yes, may be `[]` | see stances. Empty only for a position no registered tradition holds. |
| `learn_detail` | no | never appears in a map. |
| `sources` | yes | ≥1 `{label, citation, url?}`. |

### `orthodoxy`

| Value | Test |
|---|---|
| `historic` | compatible with the ecumenical creeds and the Chalcedonian definition |
| `contested` | inside the creeds, but a live and sharp intra-Christian dispute where one side regards the other as gravely mistaken. Use this rather than choosing between calling a serious disagreement heretical and pretending it is trivial. |
| `outside` | contradicts an ecumenical creed or conciliar definition. Still selectable; gets a plain *Outside the historic creeds* line and sorts last. Include one only where the domain honestly has one — **do not invent one.** |

### `held_by` stances

| `stance` | Means |
|---|---|
| `confessional` | defined in the tradition's binding confessional documents |
| `majority` | predominant in practice, not confessionally binding |
| `permitted` | one of several views its formularies explicitly allow |
| `minority` | a real, self-identified minority stream within the tradition |
| `historic` | held historically, materially less common now |

`citation` is **required on every `held_by` entry** — it is the attribution claim, and
it is the claim most likely to be wrong. `note` is optional and is where nuance goes.

### `tradition_overrides` — read this twice

This is the schema's most misreadable corner: **three separate agents got it wrong in
phase 4, three different ways.**

- It sits on the **doctrine**, never on a position.
- Keyed by tradition id. Required for every tradition that appears in **two or more**
  of that doctrine's positions' `held_by` — otherwise the build fails, naming both.
- Every id in `positions` must exist in that doctrine, **and the keyed tradition must
  actually appear in at least one of them.**
- A tradition can need an override **without being divided** — use one whenever the
  tradition's map node should read differently from the position's own `hold`.

```json
"tradition_overrides": {
  "anglican": {
    "positions": ["church.baptism/infant-covenant", "church.baptism/regeneration"],
    "hold": "Neutral sentence for the tradition's own map node.",
    "why": "Optional.",
    "vs": null,
    "tier": "T3",
    "confidence": "leaning",
    "flags": [],
    "note": "Required. Shown on the learn page under the tradition's name.",
    "citation": "Required. The formulary that permits the breadth."
  }
}
```

`confidence` defaults to `leaning` — a divided tradition is not certain. `flags` is
flag names without the `#`; `["study"]` is legitimate for a tradition actively
revisiting a question.

---

## The voice rule — mechanically enforced, so read it

| Field | Voice |
|---|---|
| `question` | neutral interrogative, **no pronouns at all** |
| `framing`, `learn_note`, `learn_detail`, `note` | neutral third person |
| `hold`, `why`, `vs` | **voice-neutral proposition** |
| `open.todo` | **first person** — the only place |

The validator rejects `you your yours yourself` in `question`, `framing`, `hold`,
`why`, `vs`, `label`, `note`; and rejects `I my we our` in `hold`, `why`, `vs`,
`question`. Word-boundary, case-insensitive. **`our` catches "our Lord"** — write
"the Lord". **`I` catches a bare Roman numeral I** — write out "Article 1" or put it
in `citation`, which is not checked.

---

## Tradition ids — copy exactly

`non-denominational` `pentecostal` `inc` `baptist` `anglican` `reformed`
`roman-catholic` `orthodox` `lutheran` `methodist` `anabaptist` `restorationist`
(these twelve are in the scorecard and the wizard's lens), plus `quaker` and
`oneness-pentecostal` (registered but not in the UI — usable in `held_by`, and the
natural holders of some `contested` and `outside` positions).

Read `content/wizard/traditions.json` for each one's confessional sources. That file
is 14 short entries and is worth the read.

## The model to copy

`content/wizard/holy-spirit.json` — one complete doctrine, one file, correct.
`content/wizard/scripture.json` and `content/wizard/church.json` are longer and also
correct. **Read one of them before writing**, and match its shape and register.

## Before you report back

```
py engine/validate_content.py
```

Exit 0 required. It prints `<file>: <doctrine id>: <what is wrong>`, so you can fix
content without reading the validator. Warnings are fine and expected — a thin
tradition, an empty `held_by`, a doctrine no `in_ui` tradition holds. Errors are not.

**Other files may have errors that are not yours. Fix only your own file** and say so.

Report back in under 30 lines: doctrines written, anything you could not source and
left out, anything where the schema was the wrong shape for the content, and any call
you think belongs to Thomas rather than to you.
