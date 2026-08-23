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

## Amendments — 2026-08-18, after wireframe review

Thomas reviewed low-fidelity wireframes of the phase 3, 4 and 6 screens and approved
the shape, with three changes. These override anything above or in the phase briefs.

- **The gallery does not display a person's denomination.** The tradition a user picks
  is a lens for the wizard's ordering, not a badge shown next to their name. Gallery
  cards carry the map's own shape instead — node count, tier spread, how many
  questions are still open, last updated.

- **Three starting points on first run, not two:** the wizard (primary), *start from
  someone else's map*, and add a belief by hand. The second is new. It copies a
  public map's markdown into the new user's own row as a starting draft.
  - Only maps with `is_public` true can be used as a starting point.
  - The copy records where it came from until the person has edited it, so the
    gallery does not silently fill with duplicates of one map under many names.
    Whether that provenance is a column or a line in the markdown is a data-model
    call — phase 3's session raises it and waits rather than deciding.
  - This does not change the rule that a *tradition* never pre-fills a map, and it
    does not make `theology-map.md` a template. Copying is user-to-user only.

- **Phase 6's compare has two targets:** compare my map to a major tradition, or to
  another person's map. Because traditions are themselves stored as read-only maps,
  this is one comparison engine with a target picker, not two features. The compare
  screen opens on that choice.
  - Open question for phase 6, flagged not decided: whether a user can keep their map
    public but opt out of being a comparison target. The audience is one church and
    people will look each other up; the feature must stay descriptive and must never
    rank people against each other.

## Environment facts — verified 2026-08-18, after Thomas's fixes

Both blockers are cleared. Verified by running the commands, not by report:

- **The site is public.** `https://theologymap-thomas-l-s-projects.vercel.app/` returns
  200 to an unauthenticated request. Vercel Authentication is off. Deploy verification
  by fetching the production URL now works.
- **Python 3.11.9 is installed — but only reachable as `py`, not `python`.** Bare
  `python` still hits the Microsoft Store stub and fails. **Every brief and plan that
  says `python engine/render.py` should be read as `py engine/render.py`** on this
  machine. A session that trusts the literal command will conclude Python is missing,
  as two earlier sessions did.
- **The renderer is reproducible on 3.11.9.** `py engine/render.py` runs with zero
  warnings and regenerating produces **no diff** against the committed
  `theology-map.html`. Phase 1a's byte-identity gate is therefore achievable — the
  committed output already matches what this interpreter produces.
- **Post-phase-0.5 baseline:** 99 nodes across 14 domains (was 102 across 15).

## Amendments — 2026-08-18, after the phase 3 design review

- **Copy provenance is two columns on `users`:** `copied_from uuid`, `copied_at
  timestamptz`. Thomas chose this over a marker in the markdown specifically to leave
  the file format untouched — it has the most downstream dependents, and a marker
  would require `render.py` and `editor-core.js` parser changes in hand-maintained
  lockstep. **Phase 3 task 8 is unblocked.**
- **Provenance is visible to others**, worded on the gallery card as "Started from
  Sarah's map", and stops being shown once the copier has edited the map.
- **The starter node is `My first belief` in a domain called `Beliefs`.**
- **The 200-row gallery ceiling stands.** Going past it needs caching, which is a
  schema change, and is not worth one now.
- **`/` becomes a proper landing page** — it explains what the tool is and routes to
  sign-up or the gallery. This is a **scope increase on phase 3** and Thomas chose it
  knowingly. Constraint: links already shared point at `/`, and he is away and cannot
  warn anyone, so the landing page must keep his own map reachable at a stable URL and
  should link to it prominently rather than stranding those visitors.
- **Redesigning `render.py`'s generated views becomes phase 7**, with its own brief,
  rather than being absorbed into phase 3 or skipped. Phase 3 still does not touch the
  generated views. Expect the editor to look more considered than the map it surrounds
  until phase 7 runs; that is accepted, not an oversight.

## Amendments — 2026-08-18, after the phase 4 and 6 design review

- **Add INC (International Network of Churches) to `traditions.json`** — twelve
  traditions, not eleven. It is Thomas's own movement and the one his actual audience
  belongs to; without it the people he sends the link to cannot find themselves.
  Vineyard and Churches of Christ are **not** added.
  Phase 5 note: INC has far less confessional literature than Westminster or the
  Catechism. The sourcing standard does not relax for it. Where a position cannot be
  traced to a published INC or affiliated statement, say so in the entry rather than
  generalising from Pentecostalism at large or from Thomas's own map — and put it on
  the list of calls awaiting Thomas.
- **Public means comparable.** No `is_comparable` column. A public map is already
  readable node by node, so compare only automates what any visitor could do by hand.
- **Thomas's own map is a comparison target like anyone else's**, including as a
  default suggestion. It is the largest map on the site and the most useful thing to
  compare against while the corpus is young.
- **The file format stays frozen.** A generated node does **not** record which wizard
  position produced it. Compare recovers the position by exact normalised match on the
  `hold` sentence and reports `own-wording` honestly when someone has edited it.
  Readability of `theology-map.md` by a person is the premise of the project.
- Defaults confirmed, not separately asked: no tier weighting on "closest tradition"
  (weighting turns a description into an argument); `/learn` is readable signed out;
  person-to-person compare shows no headline agreement count; a coverage floor gates
  publishing a thin tradition map under a real communion's name; the validator warns
  when a suggested tier disagrees with Thomas's own map.

## Amendments — 2026-08-23, after the phase 2 review

Thomas walked through all five admin actions on production and confirmed them
working, and answered the two data-model questions `phase-2-outcome.md` left open.
These are locked calls; phases 3–7 implement them and do not re-open them.

- **The admin surface is verified.** `list_users`, `delete_account`, `reset_pin`,
  `set_visibility` and admin `save_map` were each exercised against a real
  `is_admin = true` account, on the real database, and all five behaved. This
  closes the un-run declaration that 1d, 1e and phase 2 each had to carry forward,
  and with it 1e's PostgREST-204 fix and phase 2's self-delete-guard fix. **No
  outcome file after this one should list them as unverified.**

- **Unlisting is not privacy, and `is_public` is not rotated.** An admin's
  "hide a map" power removes it from the gallery and stops it rendering by name.
  It does **not** make it unreadable to someone who already holds the row id —
  the id is a bearer credential in this design, and rotating it on hide was
  considered and **rejected**: it would sign the owner out of their own map, and
  phase 3's `copied_from uuid references public.users(id)` would be orphaned or
  corrupted by it. The honest fix is naming: the control reads **Unlist / Relist**
  and says so in place. Shipped in `web/admin.html` on 2026-08-23. **Phase 3 keeps
  that wording through the redesign.** If a map must genuinely go, delete the
  account. See `phase-2-review.md` B7.

- **`map_versions` lands at the top of phase 4, not in phase 3.** The wizard is the
  first feature that can replace a whole map in one action, and it is the case the
  four empty-save guards do not cover (`force: true` walks past all of them). The
  shape is design §1's, plus two rules phase 2's latency and autosave findings
  make necessary:
  - `map_versions(id, user_id, markdown, saved_at)`; insert **before** the write in
    both `api/map.py`'s save and `api/admin.py`'s `save_map`; `users.markdown`
    stays the head pointer, so the editor, gallery, render route and export are
    untouched.
  - **Throttle:** at most one snapshot per user per hour — **but always snapshot a
    `force: true` save.** A 1200 ms autosave debounce would otherwise fill the
    table with near-identical rows.
  - **Retention:** keep the last 20 per user.
  It is a new table, so it is a migration — write it, commit it, push it, verify it
  landed (`run-order.md`, "How the database actually gets changed").

## Amendment — 2026-08-23, after phase 4 session 9

Session 9 shipped `map_versions` and asked whether an undo with no button was
worth a phase of its own. Thomas: **yes — give it a phase.**

- **Phase 8 is version history and restore.** `map_versions` is written on every
  save today and read by nothing. Phase 8 gives it a reader: a list of a map's
  own earlier versions, and a restore.
- **It needs no schema change.** The table, the throttle and the retention are
  already live and verified. Phase 8 is a route action and a small surface.
- **It depends only on phase 4's table, so it may run any time after phase 4.**
  It is numbered last because phases 5–7 were already sequenced, not because it
  is blocked by them. Pull it forward if the wizard makes anyone nervous about
  losing work — that is the risk it insures against, and that risk goes live the
  day the wizard does.
- **Admin restore is already a locked power** ("Admin can: … edit/restore any
  map", under *Accounts and data*). Phase 8 is where "restore" stops being
  aspirational, so it covers the admin case too.

## Amendments — 2026-08-23, after phase 4 session 10

Thomas answered all six of session 10's questions. Locked calls; phases 5–8
implement them and do not re-open them. Four were actioned in the same session
and are marked **done**; the other two bind phase 5.

- **The wizard links out to sources mid-wizard.** Design §5.3 left open whether
  an external link mid-flow costs more momentum than it gains. It does not —
  **with two conditions Thomas set**: the link opens in a new tab, and any
  answer already chosen on that screen is **saved before the tab opens**. Both
  shipped: every `sources` entry carrying a `url` renders as
  `target="_blank" rel="noopener noreferrer"` and commits the pending answer on
  click, and the explainer says so in place. A source with no `url` stays plain
  text, never a dead link. **Done.**

- **`Spiritual gifts today` moves to `# Holy Spirit` and is renamed
  `Continuationism`.** It shipped in `church.json` because the plan listed it
  among Church's six, but Thomas's own map files that material under
  `# Holy Spirit` as `Continuationism · T2`, and compare is per-doctrine — a
  doctrine only compares if both maps call it the same thing in the same
  domain. Now `content/wizard/holy-spirit.json`, `id`
  `holy-spirit.continuationism`, slug `continuationism`, `suggested_tier` T2 to
  match his map. **Done.** Phase 5 inherits a `holy-spirit.json` with one
  doctrine in it and fills the rest around it.

- **Design §4.8's worked example is corrected, not just worked around.** As
  written it put Lutherans under two baptism positions with no
  `tradition_overrides` entry, so the example the plan tells every session to
  copy verbatim failed validator rule 15. The Lutheran override is now in the
  design document, with a note on what it demonstrates that the other two do
  not: **a tradition can need an override without being divided.** **Done.**

- **INC stays in the lens, third.** Confirmed, not merely accepted. No change.

- **`zz-schema-check` is Thomas's to delete** and he has it in hand. No session
  should touch it or re-raise it.

- **Phase 8 runs next, ahead of phase 5.** Confirmed 2026-08-23, after the wizard
  shipped. `map_versions` has preserved every save since session 9 and nothing can
  read one back; the wizard is precisely the feature that makes losing work
  possible, so the undo goes in before more content does. No schema change, no
  dependency on phases 5–7.

- **A seed with no `orthodoxy: "outside"` position is acceptable.** Phase 4's
  twelve doctrines honestly contain none, and inventing one is worse than
  shipping the branch unexercised. **This becomes phase 5's job:** the
  *Outside the historic creeds* treatment — the banner, the `orthodoxy_note`,
  sorting last regardless of the lens — is built and reviewed but has never
  rendered real content. **Phase 5 must exercise it deliberately in its first
  domain and say in its outcome file that it did.** Do not assume it works
  because it renders.
