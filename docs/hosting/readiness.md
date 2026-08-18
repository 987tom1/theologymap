# Readiness — what is left before the phases can run unattended

Written 2026-08-18. The question this answers: if Thomas is away and a fresh Claude
session is handed a phase, does it have everything it needs to finish without him?

Status key: **[T]** only Thomas can do it · **[C]** a Claude session can do it now ·
**[C-blocked]** a Claude session can do it, but only after something else lands.

---

## A. Blockers that stop work regardless of how good the briefs are

1. **[T] Turn off Vercel Authentication.** Dashboard → `theologymap` → Settings →
   Deployment Protection. Every URL currently 302s to SSO login, so no session can
   verify a deploy and no human can see the result. This is the single highest-cost
   item on the list: without it, six phases ship into a site nobody can look at.

2. **[T] Install a real Python 3.11+ and put it on PATH.** Two sessions have now hit
   this. Phase 0 found nothing; phase 0.5 got by on a Python 3.7 buried inside a QGIS
   install, which is a landmine — 3.7 is years past end-of-life and may render
   differently from whatever produced the committed HTML. Phase 1a's merge gate is a
   byte-identical render diff, so an unreliable interpreter means 1a cannot honestly
   merge, and everything after 1a is blocked behind it.

3. **[T] Confirm the GitHub Pages deploy is dead or intended.** `987tom1.github.io/theologymap`
   is serving a second copy of the site. A session that verifies against the wrong URL
   will report success on a stale build.

4. **[T, after 1a] Bootstrap the admin flag.** No route writes `is_admin` — with open
   sign-up, one that did would let anyone promote themselves. Setting it is one SQL
   statement in the Supabase editor against Thomas's own row. It can wait until 1a's
   schema exists, and it can be done from a phone.

---

## B. Planning work still to do — the actual deliverable

What exists now: `decisions.md` (locked calls + wireframe amendments),
`phase-0-outcome.md`, `phase-0.5-outcome.md`, `phase-1-design.md`, `phase-1-plan.md`.

What is missing:

5. **[C] Phase 2 session brief.** The six-hat protocol is well specified in Project 13's
   brief, but it needs converting into something runnable cold: which files to read,
   how to verify the local workflow still works rather than trusting the outcome files,
   and the specific black-hat checks the locked decisions created — autosave races
   across tabs, empty-save overwriting real work, an orphaned `localStorage` id, the
   admin routes' server-side re-verification, and a PIN column reachable after all.

6. **[C] Phase 3 design + plan.** Unblocked: the wireframes are approved. Needs the
   approved screens turned into a build plan — first-run with its three starting
   points, the node editor's promoted-vs-optional split, in-place explanations for
   tier and confidence, the gallery cards, and the provenance question that
   "start from someone else's map" raises (a data-model call, so it stops and asks).

7. **[C] Phase 4 design + plan.** The real deliverable is the content schema, because
   phase 5 fills it and phase 6 reads it. It must carry, per doctrine: the question,
   each candidate position with the wording it generates, a suggested tier, which
   traditions hold it, key texts, and a source citation. It must also carry enough
   per-tradition structure for phase 6 to assemble a whole tradition into a
   renderable map. Designing this without phase 6 in view is the most likely way to
   have to redo phase 5's research.

8. **[C] Phase 5 brief refresh.** Mostly written already. Needs: the tradition list
   fixed to the ones the UI offers, the "outside historic orthodoxy" treatment made
   concrete, and the per-domain subagent dispatch spelled out with the exact schema
   to return.

9. **[C] Phase 6 brief — does not exist yet.** Learn-by-doctrine browsing, traditions
   stored as read-only maps, and a compare engine with two targets (a tradition or
   another member). Plus the open question of whether a public map can opt out of
   being a comparison target.

10. **[C] Reconcile the stale source documents.** `hosting-brief.md` still says five
    views, still assumes the anon key ships in client code, has no admin concept, and
    defers autosave to phase 3. Project 13's `CLAUDE.md` table has no row for phase
    0.5 or phase 6. A cold session reading the requirements of record would be
    misled on four counts.

---

## C. Ordering once the briefs exist

11. **[C-blocked] Finish phase 0.5** — node deletion, regenerate, merge, push.
12. **[C-blocked] Run 1a → 1b → 1c → 1d → 1e**, each on its own branch, each merging
    itself, each reading the previous outcome file. 1a is gated on item 2 above.
13. **[C-blocked] Phase 2** once 1e is merged. This is the one phase permitted to stop
    and wait rather than proceed, and only if it finds something needing a rewrite.
14. **[C-blocked] Phase 3**, then **4**. **Phase 5 can run in parallel** with either,
    once phase 4's schema is fixed. **Phase 6 last** — it consumes phase 5's corpus.

---

## D. Known risks to carry forward

- **No browser verification anywhere in the program.** Phases 3, 4 and 6 are all UI
  work being merged unseen. The mitigation is that each UI phase publishes a design
  canvas for Thomas to review remotely, and that a bad deploy is cheap to revert.
- **The no-client-key decision in phase 1's design** routes every read through a
  Python serverless function. It is the right call for keeping PINs off the wire, but
  it puts cold-start latency on the gallery and every page load. Phase 2's black hat
  must measure it, not assume it.
- **`theology-map.md` is now edited by sessions.** Phase 0.5 deleted three nodes from
  it on Thomas's explicit instruction. That file's "hand-edited only" status is
  weaker than `CLAUDE.md` claims, and the next session to touch it should say so.
