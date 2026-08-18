
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
