# Locked decisions — hosting program

Recorded 2026-08-18 by Thomas, before the remote phases run. Every phase session
reads this file first. These are **his calls, already made**. Do not re-open them,
do not "improve" them, and do not ask — he is away and cannot answer.

If a phase's work makes one of these decisions look wrong, implement it as written,
then say so in that phase's outcome file under "decisions worth revisiting".

## Product

- **Audience:** his church, people he will send the link to by name. Not anonymous
  internet traffic, not a portfolio piece. Onboarding must work for a stranger, but
  the stranger is a real person he knows.
- **Ambition:** all phases 0-6 are expected to run. Order matters more than speed.
- **Tradition centre of gravity:** non-denominational / Pentecostal. That is the
  reader whose recognition matters most, and the reader least likely to already
  know what other traditions hold. Anglican, Reformed, Baptist, Roman Catholic and
  Orthodox must all be selectable and must all be gotten right.

## Accounts and data

- **Sign-up is open.** Anyone can pick a name + PIN. No invite code, no gate.
- **Admin account.** An `is_admin` column on `users`. Every admin action re-verifies
  name + PIN **server-side, in a serverless function**, before acting — the flag is
  never trusted from the client. Admin can: delete an account, reset another user's
  PIN, hide a map from the gallery, and edit/restore any map.
- **Maps are public by default.** `is_public` defaults true. The column exists from
  1a so phase 3 can add a toggle without a migration.
- **PINs never reach the client.** Comparison happens server-side against a column
  the anon key cannot select. Plaintext compare is fine; exposure is not.

## Saving

- **Autosave with debounce** is the hosted save model, decided now rather than in
  phase 3 because phase 2 must review it. Phase 1c implements it; phase 2's black
  hat must specifically cover: concurrent tabs, an empty save overwriting real work,
  and a `localStorage` user id with no matching row.
- The **local** workflow's explicit Save & render is unchanged. Autosave is hosted-only.

## Vocabulary

- **`tier`, `confidence` and `#study` all stay**, in the file format *and* in the
  user-facing UI. They are doing real teaching work; phase 3 explains them in place
  rather than renaming them.
- **`#thread` is removed entirely** — from the parser, the renderer's Threads view,
  the editor, `map-view.js`, the documentation, and the data in `theology-map.md`.
  See phase 0.5. After it, there are **four** views, not five.

## Wizard (phase 4)

- **Tier order: T1 first.** Ortlund's logic wins over retention — what a person
  thinks about scripture and Christ constrains everything downstream.
- **Tradition selection orders and annotates; it never pre-fills.** Choosing
  "Anglican" surfaces the Anglican position first and labels it as such. Every node
  is still answered by the user. Nothing appears in a person's map that they did not
  choose.
- **"I don't know" is a first-class answer**, mapping to `confidence: open` + `#study`.
- **No LLM call at wizard runtime.** Data-driven form, content baked in ahead of time.

## Research corpus (phase 5)

- **Views outside historic orthodoxy are included and plainly marked as outside**,
  with the reason. Not omitted, not presented as equal options.
- Every position stated so its own adherents would sign their name to it. Sourced
  from confessional documents, never from memory and never from a critic's summary.

## Phase 6 — learn and compare

Briefed now (not later) so phase 4's content schema carries what it needs.

- **All three compare shapes ship:** per-doctrine agree/differ/undecided diff, a
  "closest tradition" summary, and an all-traditions scorecard.
- **Two surfaces over one corpus:** traditions exist as real read-only maps rendered
  by `render.py` (so compare is map-vs-map and the gallery is reused), *and* a
  bespoke reference UI for learning, which can carry internal diversity, citations
  and "no single label" cases that map nodes would flatten.
- **Entry point is by doctrine** — "Baptism" → every tradition side by side.

## Working style for remote sessions

- **Merging beats waiting.** A broken deploy is acceptable; a stalled dependency
  chain is not. Never force-push, never rewrite `main`'s history, never merge a
  phase whose own verification failed.
- **Uncovered judgment calls: decide, document loudly** in the outcome file under
  "decisions I made for you" — **except anything touching the data model or a file
  format**, which stops and waits. Those are the expensive-to-reverse ones.
- **UI phases open with a published design canvas** (the `design` skill) of the key
  screens before building, so Thomas can review on a phone while away.
- No browser automation for verification, ever.
- Push mechanical work to Sonnet subagents in parallel.

## Outstanding action for Thomas

- **Vercel Authentication (deployment protection) is ON** and gates every URL behind
  SSO login. Until it is disabled in the dashboard, the site is not publicly
  reachable and no phase can be verified by fetching it. See `phase-0-outcome.md`.
