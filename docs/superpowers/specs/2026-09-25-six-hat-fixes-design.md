# Six-hat review fixes — design

Date: 2026-09-25. Source: a six-hat browser review of the live site at desktop (1568px) and
phone (390x844) widths. Approved by Thomas in chat the same day, with four decisions:
`/thomas` redirects to `/view?name=Thomas`; the phone map starts root-at-left; Thomas unlists
Test1/test2 himself in `/admin`; signed-out visitors land on the sign-up form with a reason.

Out of scope: an anonymous wizard start (declined 2026-09-10, CLAUDE.md §10), and the
signed-in screens (wizard, compare, history, edit, admin) — not reviewed.

## 1. Phone map home position — `engine/map-view.js`

**Defect.** `redraw()` (the `needsCenter` block, ~line 510) centres the root box in the wrap.
Below `MAP_TWO_SIDE_BREAK` (860px) every area is on the right (`side = 1`), so centring the
root pushes all fourteen areas past the right edge; Reset view reproduces the same state.

**Change.** A pure helper `homePan(tree, rect, twoSided, margin)` returns `{panX, panY}`:
- two-sided: today's behaviour (root centred on both axes);
- single-sided: `panX = margin - tree.x` (root's left edge `margin` px from the wrap's left,
  margin 16), `panY` centred as today.
`needsCenter` uses it; Reset view already sets `needsCenter`, so it inherits the fix.
Exported beside `revealPan`/`traverseKey` and pinned in `tests/map-view.test.js`.

**Opening an area.** When a person opens an area by tapping its box (not a search
auto-expand, not Expand all), after the redraw pan by `revealPan` over the rectangle spanning
the area box and its first up-to-three children, so the opened beliefs come into view.
Least-distance pan; nothing moves if they are already visible.

**Hash.** `render.py` inlines `map-view.js`, so the byte-identity pair (CLAUDE.md §1) moves.
Licensed; `documentation/study-list.md` and the `<script id="data">` payload must stay
byte-identical; update the pair in CLAUDE.md in the same commit.

## 2. Desktop map opens clipped — diagnose first

**Symptom.** On `/view?name=Thomas` at 1568px the root is clipped at the left and the top
areas above the canvas top; Reset view fixes it. **Hypothesis:** the first centring measures
the wrap before `sizeMap()` / the `/view` iframe's flex sizing settles. Reproduce and confirm
the cause (superpowers:systematic-debugging) before fixing. Likely fix: when the wrap's size
changes and the person has not yet panned or zoomed, re-arm `needsCenter`. Any pan, pinch,
wheel, keyboard traversal or selection counts as interaction and stops re-homing.

## 3. `/view` polish — `web/view.html`

- **Loading state** while `/api/render` is in flight, via the page's existing skeleton /
  `aria-busy` pattern. Cleared on success, 404 and thrown errors (CLAUDE.md §7: a page that
  pulses forever is worse than a blank one).
- **Not found:** the heading reads "Map not found", not "<name>'s map". Keep the `/view`
  owner-404 rule (§7 Access control) intact.
- **Tier legend** visible on `/view`: the framed map stops hiding its own legend
  (`html.framed .legend`), since `/view` carries none. No second legend is built. Still hidden
  at ≤640px by the generated page's existing phone rule.
- **No nested scrollbar** at desktop: the framed page's content (header, map, NET footer) fits
  the frame. The NET attribution must stay visible (§3 verses rule).

## 4. Drag does not select text — `engine/map-view.js`

While a pan drag is in progress (past the 6px threshold) set `user-select: none` on the wrap;
restore it when the pointer is released. The detail panel's text stays selectable at rest.

## 5. Signed-out flow — `web/session.js`, `web/wizard.js`, `web/landing.html`

- `requireUser(why)` redirects to `/#signin` instead of `/`.
- `/wizard` uses `requireUser('Create an account to build your map — a name and a PIN.')`
  instead of its bare `location.href = '/'`.
- `/` with `#signin` (on load and on hashchange, signed out): show the stashed notice inside
  the `#signin` section (above the two forms), scroll the section into view, focus the
  Create-account name field. With no stashed notice, the "Get started" tile's arrival shows
  the same wizard sentence.
- The existing top banner must not also show the same notice twice.

## 6. `/thomas` — `vercel.json`

Replace the `/thomas` rewrite with a non-permanent redirect to `/view?name=Thomas`.
`theology-map.html` is untouched (offline file). Update any in-repo links to `/thomas`.

## 7. Copy

- Corpus text shown on `/learn` that says "the wizard" (e.g. `content/wizard/god.json` Trinity
  `framing`) is reworded so it reads on Learn. One-string edits that keep the file's formatting
  byte-identical otherwise; not a `hold` (no `superseded_holds` needed). Gate:
  `py engine/validate_content.py`.
- `web/landing.html` Learn card: "every position side by side" → "the positions side by side".
- `/learn?doctrine=` pages with three or more positions get a row of jump links to each
  position card above "The positions". Anchors, no JS behaviour beyond what exists.

## 8. `ViewTransition` console exceptions

`InvalidStateError: Transition was aborted because of invalid state` on `/view` and `/thomas`,
seen during an iframe-driven test. Reproduce with ordinary top-level navigation. If real, fix
at the cause; if an artefact of the test harness, record that in `debug.md` and change nothing.

## Testing

Per task: the CLAUDE.md §9 gate (all seven commands), plus the §1 hash check when `render.py`
output moves. At the end, a live browser walk at desktop and 390px of every screen touched.
