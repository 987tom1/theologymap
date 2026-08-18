# Phase 7 — Redesign the generated views

**Goal:** make `render.py`'s output look like it belongs to the same product as the
editor phase 3 rebuilt. Today the map is the thing strangers actually see, and after
phase 3 it will be the least considered surface in the product.

**Model:** Opus for the design decisions, Sonnet subagents for the mechanical CSS
once the token set is settled.
**Precondition:** phase 3 merged (it sets the design language this phase adopts) and
phase 6 merged (its tradition maps render through this same renderer, so redesigning
first would mean redesigning twice). Read `docs/hosting/phase-3-design.md` §2 for the
vocabulary contract and its calculated colour work, and `docs/hosting/decisions.md`
first — it overrides every brief where they differ.

**Why this is its own phase and not part of phase 3.** `engine/render.py` is ~1300
lines that generate HTML, CSS and view JS as strings, and it is shared with the local
offline workflow. Restyling it is a much larger job than restyling the editor, and
absorbing it into phase 3 would have meant a UI phase too large to review by reading —
which matters, because nothing in this program is verified in a browser.

## Scope

The four generated views (Map, Domain, Tier, Confidence), the sticky header and its
controls, the card and node-tile treatment, the scripture popovers, the phone layout,
and the print stylesheet.

**Presentation only.** This phase changes how the output looks, never what it says:
no new fields, no changed node syntax, no reordering of content, no change to which
nodes appear in which view.

## Constraints that must survive

- **One renderer.** `render.py` stays the only implementation. Do not port a view to
  JS, do not add a build step, do not introduce a CSS framework. The output must
  remain a single self-contained file that works by double-clicking it.
- **Offline.** `start_editor.bat` has no network. Every asset stays bundled — no CDN,
  no web font fetched at runtime. If a typeface is wanted, it must be embedded or the
  stack must fall back to system fonts gracefully.
- **Parser and view lockstep.** `engine/map-view.js` is a hand-maintained port of the
  Map view JS embedded in `render.py`. Phase 3's design doc records that only the
  read-only leaf functions and the layout pass are lockstep-bearing — re-verify that
  claim, then keep those in sync. Touching one without the other is this phase's
  likeliest way to break the editor silently.
- **The design language is phase 3's, not a new one.** Warm paper-and-ink in both
  themes, serif for content and sans for chrome, prose capped at 58ch. Adopt phase 3's
  token names so the two surfaces cannot drift.
- **The tier ramp's darkness is load-bearing.** Garnet→slate was chosen so white chip
  text passes WCAG AA. Do not lighten it to make bare swatches pass a different check —
  phase 3's design doc explains this trade and solves it by never making tier colour
  the sole channel.
- **Print still works.** The A3 two-column print stylesheet is a real feature: printing
  force-switches to the domain view expanded, then restores the on-screen view.
- **Mobile first among equals.** A shared map link is most often opened on a phone.

## Verification

The byte-identity bar from phase 1a **does not apply here** — this phase changes the
output on purpose. Verify instead that only presentation changed:

- `py engine/render.py` runs with zero warnings. (On this machine the interpreter is
  `py`; bare `python` hits a Microsoft Store stub and fails.)
- Node and reference counts in the run summary are unchanged: **99 nodes across 14
  domains, 156 references**. A change here means content moved, which is out of scope.
- Round-trip parse → serialize → re-parse of `theology-map.md` via `editor-core.js`
  gives an identical model.
- Every colour pair introduced is checked against WCAG AA **by calculation, not by
  eye**, and the numbers are recorded in the outcome file.
- Reason explicitly about 360px, 768px and 1400px, and about the print layout.
- No browser automation, per the program-wide rule. Keep the diff reviewable — a
  restyle that rewrites every view at once cannot be checked by reading.

Do not read `theology-map.html` or `documentation/verses.md` into context. Use grep
and the run summary for targeted checks.

## Branch and handover

Branch `phase-7-render-design`, merge to `main` when the code verifies. A broken
deploy is acceptable and fixable remotely; a stalled chain is not. Never force-push,
never rewrite history, never merge on failed verification.

Write `docs/hosting/phase-7-outcome.md`: what changed, the calculated contrast table,
what was deliberately left alone, and whether the lockstep boundary held.

## Open question for Thomas

Phase 6 publishes tradition maps through this renderer. A reader should be able to
tell at a glance whether they are looking at a person's map or a communion's
position — decide whether that is a visual treatment in this phase or a content
label phase 6 already supplies.
