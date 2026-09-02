# Phase 9 — subagent brief: verify one cluster of source documents

Repo: `C:\Users\ThomasPC\Desktop\AIProjects\Project 12 - Theology Mind Map`.
Branch `phase-9-sourcing` is already checked out. Python is `py`, never `python`.

**Read `docs/hosting/phase-5-agent-brief.md` first.** It is the schema contract and it
still governs every field. This file adds only what phase 9 changes. Do not read
`theology-map.html` or `documentation/verses.md`.

## Your job

You are assigned **one cluster of source documents**, listed at the bottom. Your
worklist file names every corpus entry that rests on them, with its current
`citation`, `note`, `hold` and `vs`.

**Retrieve each document with web access, read it, and check every entry against it.**
Phase 5 wrote this corpus from model knowledge and retrieved nothing. Where the INC
statement was finally read, thirteen entries were wrong in both directions. Assume
your cluster is equally unchecked.

For each entry, one of four outcomes:

1. **Supported** — the document does say this. Then:
   - `citation` names the document by its **real title and revision** ("Declaration of
     Faith, February 2022", not "Statement of Faith") **and** the section, article or
     paragraph it rests on.
   - `note` carries the **quoted sentence** the attribution stands on, so a reader can
     check it in a browser in under a minute.
   - the position's `sources` carries a **`url`** where a stable public one exists.
2. **Not supported** — the document does not address this at all. **Remove the
   `held_by` entry.** Do not soften it. An entry removed for lack of support is a
   success, not a regression.
3. **Missed** — the document is explicit about something the corpus does not
   attribute to this tradition. **Add** the `held_by` entry, with citation and quoted
   note.
4. **Wrong stance** — the document supports the claim but not at the strength
   claimed. Correct the `stance` against phase-5-agent-brief.md's stance table.
   `confessional` means **defined in binding confessional documents**; a movement
   that is non-creedal by its own self-description cannot hold anything
   `confessional`. A parachurch statement of faith is not a denomination's confession.

**Coverage is not the goal and must never be protected.** Do not invent support to
keep a number up.

## Correct the sourcing, not the prose

`citation`, `note`, `stance`, `held_by`, `learn_detail`, `learn_note` and `sources`
are **free to change** — change them freely.

`hold`, `label`, `id` are **expensive**. A changed `hold` silently breaks compare for
every user whose map already carries the old wording.

> **A `hold` may be changed only when it is genuinely factually wrong or would make
> an adherent wince, and only if the previous wording is appended to that position's
> (or override's) `superseded_holds` array in the same edit.**
> `engine/compare-core.js` reads it on both. See
> `content/wizard/creation-and-science.json` for the worked example.
> **Never change a `doctrine.id` or a `position.id`.** They are stable forever.

If you change a `hold`, report the old and new wording verbatim to the main thread.

## The four rules that cost phase 5 real time — verbatim

- **Save after every entry corrected.** Five of six agents in one phase-5 wave were
  killed mid-run by an account spend limit; the ones that had saved incrementally
  were the ones whose work survived.
- **`hold` is 320 characters or fewer**, and every `sources` entry needs a
  non-empty `citation`.
- **A bare Roman numeral `I`** (`Article I`, `Lambeth I.10`) trips the voice rule.
  Write `Article 1` or put it in `citation`, which is not voice-checked.
- **`tradition_overrides` sits on the doctrine, never on a position**, and is
  required whenever a tradition holds two of that doctrine's positions. Removing a
  `held_by` entry can make an existing override invalid — rule 16 will catch it.

## How to deliver your corrections — READ THIS, IT IS NOT LIKE PHASE 5

**Do not edit any `content/wizard/*.json` file.** Five other agents are working at
the same time and your clusters share files; concurrent writes would clobber each
other. **You edit nothing in the repo.**

Instead write **one file**, `%%OUT%%`, containing a JSON array of typed
operations. The main thread applies them with `py engine/apply_corrections.py`.

Write it **incrementally — append your ops as you go and save after every entry**,
so that if you are killed mid-run your finished work survives.

```json
[
  { "op": "held_by.set", "position": "scripture.inerrancy/full", "tradition": "inc",
    "fields": { "citation": "…real title, revision, section…",
                "note": "The statement says: “…quoted sentence…”",
                "stance": "confessional" } },

  { "op": "held_by.remove", "position": "church.membership/covenant", "tradition": "inc",
    "reason": "The Declaration of Faith does not address membership." },

  { "op": "held_by.add", "position": "church.baptism/believer", "tradition": "inc",
    "stance": "confessional", "citation": "…", "note": "The statement says: “…”" },

  { "op": "position.sources", "position": "scripture.inerrancy/full",
    "sources": [ { "label": "…", "citation": "…", "url": "https://…" } ] },

  { "op": "doctrine.sources", "doctrine": "scripture.inerrancy",
    "sources": [ { "label": "…", "citation": "…", "url": "https://…" } ] },

  { "op": "override.set", "doctrine": "church.baptism", "tradition": "anglican",
    "fields": { "citation": "…", "note": "…" } },

  { "op": "position.hold", "position": "…", "hold": "…new wording…" }
]
```

Rules the applier enforces, so do not fight them:

- `held_by.set` may only touch `citation`, `note` and `stance`. Anything else is an
  error. To change a `hold` use `position.hold`, which pushes the previous wording
  into `superseded_holds` for you — **you never write `superseded_holds` by hand.**
- `position.sources` and `doctrine.sources` **replace** the whole array, so include
  the entries you are keeping as well as the ones you are adding. This is how the
  `url` fields get added.
- `override.set` with a `hold` in `fields` does the same `superseded_holds` push.
- Every op must name a `position`/`doctrine` id that already exists. Never invent one.

No schema change and no new fields. If a field is genuinely missing for what you
found, **stop and write it down** in your report rather than inventing one.

## Do not

Do not edit any repo file. Do not run `git`. Do not commit, merge, or branch. Do not
edit `traditions.json` or `manifest.json` (tell the main thread if one needs a
change). Do not touch another agent's cluster. Do not run
`engine/apply_corrections.py` — the main thread runs it.

You may freely **read** any `content/wizard/*.json` file for context, and you should
read the ones your worklist names.

## Report back, under 40 lines

- entries checked / corrected / removed / added, as four numbers
- every entry **removed**, with the doctrine id and one line on why the document does
  not support it
- anything the source said that was **genuinely surprising**
- every `hold` changed, old and new wording
- anything you could not retrieve (dead link, paywall, no stable public text) — say so
  plainly rather than falling back on model knowledge. **Falling back to memory is the
  one thing this phase exists to stop.**
