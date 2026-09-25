# Six-hat review fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the entry-point defects a six-hat browser review found: the phone map opens with every area off-screen, the desktop map opens clipped, `/view` has no loading or not-found state, signed-out visitors are bounced without explanation, `/thomas` is a stray second viewer, and a few copy slips.

**Architecture:** Plain static pages + one shared map engine (`engine/map-view.js`) that `engine/render.py` inlines into every generated map and `engine/editor.html` loads directly. No build step. Fixes land in the file that owns the behaviour; nothing is duplicated.

**Tech Stack:** Vanilla ES modules in `web/`, UMD `engine/map-view.js`, Python 3.11 stdlib (`py`, never `python`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-25-six-hat-fixes-design.md`

## Global Constraints

- Read `CLAUDE.md` §1, §4, §6, §7 before editing. Its rules win over this plan if they conflict — stop and report the conflict rather than breaking one.
- Standard library only. No npm dependency, no CDN, no framework. `requirements.txt` stays empty.
- Edit the map engine in `engine/map-view.js` and nowhere else (§8).
- **Byte-identity protocol** — any task that changes `engine/map-view.js` or `engine/render.py` moves the generated map's hash. Before your first edit, on the clean tree, record the payload hash (command below). After your change run `py engine/render.py`, then:
  - `git diff --quiet documentation/study-list.md` must exit 0 (content unchanged);
  - the payload hash must equal the one you recorded;
  - compute the new CRLF/LF pair and replace the pair quoted at the top of `CLAUDE.md` §1 (the two `a776eb4d…`/`c480bd33…` bullets — or whatever pair is there when you start) **in the same commit**, plus one short paragraph under §1's history saying which task moved it and why ("licensed, felt; the two invariants held").
  - Commit the regenerated `theology-map.html` (and `content/verses.json` only if it changed — it should not).

  ```
  py -c "import re,hashlib;s=open('theology-map.html','rb').read();m=re.search(rb'<script id=\"data\"[^>]*>(.*?)</script>',s,re.S);print('payload',hashlib.sha256(m.group(1)).hexdigest())"
  py -c "import hashlib;b=open('theology-map.html','rb').read();print('crlf',hashlib.sha256(b).hexdigest());print('lf',hashlib.sha256(b.replace(b'\r\n',b'\n')).hexdigest())"
  ```
- **The gate** (CLAUDE.md §9) — run all seven before every commit that touches code; all must pass:
  ```
  node --test tests/*.test.js
  py tests/syntax_check.py
  py engine/validate_content.py
  py tests/test_validate_content.py
  py api/_test_lib.py
  py tests/check_tradition_maps.py
  py tests/check_generated_map.py
  ```
- Read `git diff --stat` before committing. Scripts that edit files must read/write bytes (CRLF safety, §7).
- User-facing copy says **belief** and **area**, never "node" or "domain".
- Do not push. The controller pushes to `origin/main` after all tasks.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018PbcS1eeeWATNeFQ3EuEAC
  ```

---

### Task 1: Map camera — home position, area reveal, re-home until touched, no text selection on drag

**Files:**
- Modify: `engine/map-view.js` (constructor ~line 94 and ~128; `redraw()` `needsCenter` block ~line 510; `_activate` ~line 669; `_bindPanZoom` ~line 770; exports ~line 858)
- Test: `tests/map-view.test.js`
- Regenerate: `theology-map.html`; update `CLAUDE.md` §1 pair and §4 Map bullet

**Interfaces:**
- Produces: `MapView.homePan(root, rect, twoSided, margin) -> { panX, panY }` (pure, exported). `MapView.prototype._revealArea(id)`. Instance flag `this._touched` (bool).

**Background.** `redraw()` centres the root box (`this.panX = rect.width / 2 - (tree.x + tree.w / 2)`). Below 860px (`MAP_TWO_SIDE_BREAK`) the tree is single-sided — every area has `side = 1` and sits right of the root — so centring the root pushes all areas off the right edge of a phone. Reset view sets `needsCenter` and reproduces the same state. Separately, on desktop inside `/view`'s iframe the first centring happens before the wrap reaches its final size (`sizeMap()` runs from a header `ResizeObserver` without redrawing), so the map opens clipped until Reset view is pressed.

- [ ] **Step 1: Write the failing tests** — append to `tests/map-view.test.js`:

```js
const { homePan } = MapView;

test('two-sided home centres the root on both axes', () => {
  const root = { x: -60, y: 100, w: 120, h: 40 };
  assert.deepStrictEqual(homePan(root, { width: 1000, height: 600 }, true, 16), { panX: 500, panY: 180 });
});

test('single-sided home pins the root to the left margin, centred vertically', () => {
  const root = { x: 0, y: 100, w: 120, h: 40 };
  assert.deepStrictEqual(homePan(root, { width: 390, height: 700 }, false, 16), { panX: 16, panY: 230 });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node tests/map-view.test.js`
Expected: FAIL — `homePan is not a function`.

- [ ] **Step 3: Add `homePan` beside `revealPan`** (above `// Arrow-key traversal moves focus only`):

```js
  // Where the first paint and Reset view put the map. Two-sided: the root
  // centred, areas either side. Single-sided (below MAP_TWO_SIDE_BREAK) every
  // area runs to the right of the root, so centring the root pushed all of
  // them past the right edge of a phone -- pin the root `margin` px from the
  // left instead. Vertical centring is the same in both.
  function homePan(root, rect, twoSided, margin) {
    return {
      panX: twoSided ? rect.width / 2 - (root.x + root.w / 2) : margin - root.x,
      panY: rect.height / 2 - (root.y + root.h / 2),
    };
  }
```

and export it: `MapView.homePan = homePan;` beside `MapView.revealPan = revealPan;`.

- [ ] **Step 4: Use it in `redraw()`** — replace the body of `if (this.needsCenter) { … }`:

```js
    if (this.needsCenter) {
      const rect = this.wrap.getBoundingClientRect();
      const home = homePan(tree, rect, tree.twoSided, 16);
      this.zoom = 1;
      this.panX = home.panX;
      this.panY = home.panY;
      this.needsCenter = false;
    }
```

- [ ] **Step 5: Run tests** — `node tests/map-view.test.js` → PASS.

- [ ] **Step 6: Re-home until the person moves the map.** In the constructor, beside `this.needsCenter = true;` add `this._touched = false;`. Change the Reset view listener to:

```js
    container.querySelector('.map-reset').addEventListener('click', () => { this._touched = false; this.needsCenter = true; this.redraw(); });
```

Change the constructor's existing `window.addEventListener('resize', …)` body to re-home when untouched, and add a wrap `ResizeObserver` (the generated page's `sizeMap()` changes the wrap's height from a header observer without any redraw — that is the desktop clipping):

```js
    window.addEventListener('resize', () => {
      if (this.wrap.offsetParent === null) return;
      if (!this._touched) this.needsCenter = true;
      this.redraw();
    });
    // Until the person pans, zooms or taps, the map's first frame is not final:
    // /view's iframe and sizeMap() settle the wrap's size after the first
    // redraw, which left the desktop map opening clipped until Reset view.
    // Re-home on every size change until then; never after.
    if (window.ResizeObserver) {
      let lastW = 0, lastH = 0;
      new ResizeObserver(() => {
        if (this._touched || this.wrap.offsetParent === null) return;
        const r = this.wrap.getBoundingClientRect();
        if (r.width === lastW && r.height === lastH) return;
        lastW = r.width; lastH = r.height;
        this.needsCenter = true;
        this.redraw();
      }).observe(this.wrap);
    }
```

Set `self._touched = true` (or `this._touched = true`) at each of these points and nowhere else:
- `_bindPanZoom` `pointermove`: on the line `moved = true;` (a real drag past the 6px threshold) and inside the `pointers.size >= 2` pinch branch before `zoomAt`;
- `_bindPanZoom` `wheel`: just before `zoomAt(...)`;
- `_activate`: at the top, after `if (id === 'root') return;` (any tap/Enter on an area or belief);
- `_bindKeyboard`: just before `el.focus(...)` for arrow traversal.

- [ ] **Step 7: Reveal an area's first beliefs when a person opens it.** Replace the `domain:` branch of `_activate`:

```js
    if (id.startsWith('domain:')) {
      const opening = this.mapManualCollapsed.has(id);
      if (opening) this.mapManualCollapsed.delete(id); else this.mapManualCollapsed.add(id);
      this.redraw();
      if (opening) this._revealArea(id);
      return;
    }
```

Add after `_reveal`:

```js
  // Opening an area on a phone put its beliefs past the right edge. Pan (never
  // zoom) the least distance that shows the area box and its first three
  // beliefs; a span too big to fit aligns its top-left. Layout numbers, not DOM
  // rects, for the same transition reason as _reveal.
  MapView.prototype._revealArea = function (id) {
    const box = (this._lastList || []).find(b => b.id === id);
    if (!box) return;
    const shown = [box].concat(box.children.slice(0, 3));
    const x0 = Math.min.apply(null, shown.map(b => b.x));
    const y0 = Math.min.apply(null, shown.map(b => b.y));
    const x1 = Math.max.apply(null, shown.map(b => b.x + b.w));
    const y1 = Math.max.apply(null, shown.map(b => b.y + b.h));
    const w = this.wrap.getBoundingClientRect();
    const z = this.zoom;
    const d = revealPan({ x: this.panX + x0 * z, y: this.panY + y0 * z, w: (x1 - x0) * z, h: (y1 - y0) * z },
      { left: 0, top: 0, right: w.width, bottom: w.height }, 16);
    if (!d.dx && !d.dy) return;
    this.panX += d.dx; this.panY += d.dy;
    this._applyPanZoom();
  };
```

Only the tap/Enter path calls it — `expandAll`, search `forceOpen` and `select()` do not.

- [ ] **Step 8: No text selection while dragging.** In `_bindPanZoom`'s `pointerdown`, in the `pointers.size === 1` branch after `wrap.classList.add('dragging');` add `wrap.style.userSelect = 'none';`. In `endPointer`'s `pointers.size === 0` branch after `wrap.classList.remove('dragging');` add `wrap.style.userSelect = '';`. (pointerdown already returns early for `.mbox, .mapcontrols, .map-panel`, so the panel stays selectable.)

- [ ] **Step 9: Regenerate, run the byte-identity protocol and the full gate** (Global Constraints). Update `CLAUDE.md` §1 pair + one paragraph; in §4's **Map** bullet add one sentence: "The first paint and Reset view put the root centred when two-sided and 16px from the left when single-sided (`MapView.homePan`); until the person pans, zooms or taps, a size change re-homes it. Opening an area by tap pans its first three beliefs into view (`_revealArea`)."

- [ ] **Step 10: Commit**

```bash
git add engine/map-view.js tests/map-view.test.js theology-map.html CLAUDE.md
git commit -m "map-view: phone map opens root-left, re-homes until touched, reveals opened areas"
```

---

### Task 2: Framed map — show the tier legend, fit the NET footer inside the frame

**Files:**
- Modify: `engine/render.py` (framed CSS ~line 706; `sizeMap()` ~line 1039)
- Regenerate: `theology-map.html`; update `CLAUDE.md` §1 pair and §7 "The framed map"

**Interfaces:** none new.

**Background.** `html.framed .legend { display:none }` hides the tier key on the premise that `/view`'s chrome carries one — it does not, so `/view` has no legend at all. Phones already hide `.legend` at ≤640px (render.py ~line 717), so un-hiding it in the frame only affects wider screens. Separately, `sizeMap()` sets the map height to `innerHeight - header - 24`, so the `<footer class="pagefoot">` NET attribution below it overflows and the framed page scrolls inside the iframe (a nested scrollbar). The attribution must stay visible (CLAUDE.md §3).

- [ ] **Step 1: Record the payload hash** on the clean tree (Global Constraints).

- [ ] **Step 2: Un-hide the legend in the frame.** Change `html.framed .kicker, html.framed .sub, html.framed .legend { display:none; }` to `html.framed .kicker, html.framed .sub { display:none; }` and update the comment above it: the legend now stays, because `/view` has no legend of its own.

- [ ] **Step 3: Fit the footer on wider screens.** In `sizeMap()`:

```js
  // Below 640px the canvas runs to the frame's edge (map-first, phase 1.5);
  // wider screens keep the 24px breathing room under the bordered canvas, and
  // leave room for the NET footer so the page -- and /view's iframe -- never
  // scrolls behind the map.
  const wide = !matchMedia('(max-width:640px)').matches;
  const foot = wide ? document.querySelector('.pagefoot') : null;
  const footH = foot ? foot.offsetHeight + parseFloat(getComputedStyle(foot).marginTop || 0) : 0;
  const allowance = wide ? 24 + footH : 0;
  wrap.style.height = Math.max(240, window.innerHeight - head.offsetHeight - allowance) + 'px';
```

- [ ] **Step 4: Regenerate and check by hand.** `py engine/render.py`, then open `theology-map.html` in a browser at ≥1024px: the map + footer fit the window with no page scrollbar in Map view. (If you have no browser, say so in your report — the controller walks it live.)

- [ ] **Step 5: Byte-identity protocol + full gate.** Update the §1 pair + one paragraph. In §7 "The framed map", change the first bullet so it lists the kicker, subtitle and `h1` as trimmed and says the legend stays (since this task) because `/view` carries none; add to the `sizeMap()` bullet that wider screens subtract the footer.

- [ ] **Step 6: Commit**

```bash
git add engine/render.py theology-map.html CLAUDE.md
git commit -m "render: framed map keeps its tier legend; canvas leaves room for the NET footer"
```

---

### Task 3: `/view` — loading state and a real not-found heading

**Files:**
- Modify: `web/view.html`

**Interfaces:** none new.

**Background.** Between page load and `/api/render` replying (2–3s on a cold function) `/view` shows an empty framed box with no indicator. On a 404 the heading still reads "<name>'s map" above "Map not found." Keep the owner-unlisted branch and the `res.ok` gating exactly as they are (CLAUDE.md §7 Access control).

- [ ] **Step 1: Add the loading line** after `<p id="not-found" hidden>Map not found.</p>`:

```html
  <p id="loading" class="tm-muted" role="status">Loading map…</p>
```

(Check `engine/theme.css` for a muted-text class; use whichever exists — `tm-muted`, `quiet` or similar — and do not add a colour literal.)

- [ ] **Step 2: Clear it on every exit.** In the module script, after `const frameEl = …` add:

```js
const loadingEl = document.getElementById('loading');
const tmMain = document.querySelector('.tm-main');
tmMain.setAttribute('aria-busy', 'true');
// Cleared on every exit, including throws: a page that says "loading" forever
// is worse than the blank box it replaced (CLAUDE.md §7).
function doneLoading() { loadingEl.remove(); tmMain.removeAttribute('aria-busy'); }
function notFoundHeading() {
  const h1 = document.querySelector('#tmChrome h1');
  if (h1) h1.textContent = 'Map not found';
  document.title = 'Theology Map — Map not found';
}
```

Wrap the whole `if (traditionId) { … } else if (!name) { … } else { … }` chain in `try { … } finally { doneLoading(); }`. (The `location.replace('/wizard')` path is fine inside it.)

- [ ] **Step 3: Set the heading on the not-found paths.** Call `notFoundHeading()`:
- in the `!tradition` branch (before showing "No such tradition"),
- in the `else if (!name)` branch,
- in the `!res.ok` branch **only when `!isOwner`** (the owner's unlisted message keeps their heading),
- in the member-map `catch`.

- [ ] **Step 4: Gate** — `py tests/syntax_check.py` plus the full gate.

- [ ] **Step 5: Commit**

```bash
git add web/view.html
git commit -m "view: loading line while the map renders; not-found says so in the heading"
```

---

### Task 4: Signed-out visitors land on the sign-up form with a reason

**Files:**
- Modify: `web/session.js` (`requireUser` ~line 26; the on-load notice block at the end; add `takeNotice`)
- Modify: `web/wizard.js` (`main()` ~line 1332)
- Modify: `web/landing.html` (`#signin` markup ~line 97; module script)
- Modify: `CLAUDE.md` §6 (`/` row of the URL table, and the `web/session.js` paragraph)

**Interfaces:**
- Produces: `export function takeNotice() -> string|null` in `web/session.js` (reads and clears the stashed notice).

**Background.** `/compare` and `/history` call `requireUser(why)`, which stashes a notice and redirects to `/`; the notice shows as a banner at the top while the sign-in form is below the fold. `/wizard` does a bare `location.href = '/'` with no notice at all. The landing's "Get started" tile links `/#signin` with no explanation. Decision (Thomas, 2026-09-25): all four land on `/#signin`, which scrolls the form into view, shows the reason inside the sign-in section, and focuses Create-account's name field. Accounts stay required (CLAUDE.md §10) — do not add an anonymous path.

- [ ] **Step 1: `session.js`.** In `requireUser`, change `window.location.href = '/';` to `window.location.href = '/#signin';`. Add:

```js
// The landing page shows a redirect's reason beside the sign-in form rather
// than as a banner above the fold; it takes the notice itself.
export function takeNotice() {
  try {
    const m = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return m;
  } catch { return null; }
}
```

In the on-load block, skip the banner when the landing will take it — change the opening to:

```js
if (typeof document !== 'undefined' && !(location.pathname === '/' && location.hash === '#signin')) {
```

(The `unknown_user` redirect in `apiFetch` still goes to `/` with no hash, so it keeps its banner.)

- [ ] **Step 2: `wizard.js`.** Import `requireUser` from `/web/session.js` (add to the existing import) and replace

```js
  // /app is gone; the landing page carries sign-in now.
  if (!user) { location.href = '/'; return; }
```

with

```js
  // Accounts come before the question flow (CLAUDE.md §10); say why, at the form.
  user = requireUser('Create an account to build your map — a name and a PIN.');
  if (!user) return;
```

(`user = getUser();` on the line above becomes redundant — remove it.)

- [ ] **Step 3: `landing.html` markup.** Inside `<div id="signin">`, before `<div id="signed-out" hidden>`, add:

```html
    <p id="signin-note" role="status" hidden></p>
```

Style it with an existing `theme.css` notice/callout class if one exists; otherwise add a rule to landing's own `<style>` using only tokens (e.g. `padding: var(--s3) var(--s4); border-left: 3px solid var(--ink); background: var(--panel);`) — no colour literals.

- [ ] **Step 4: `landing.html` script.** Import `takeNotice` alongside `getUser, setUser, apiFetch`. After `$('make-own-tile').href = …` add:

```js
// Every signed-out route into the app ends here: Get started, /wizard,
// /compare and /history. Show why, at the form, and put the cursor in it.
function arriveAtSignin() {
  if (user || location.hash !== '#signin') return;
  const note = $('signin-note');
  note.textContent = takeNotice() || 'Create an account to build your map — a name and a PIN.';
  note.hidden = false;
  $('signin').scrollIntoView({ block: 'start' });
  $('signup-form').elements.name.focus({ preventScroll: true });
}
arriveAtSignin();
window.addEventListener('hashchange', arriveAtSignin);
```

- [ ] **Step 5: Gate** — full gate (syntax_check covers the inline module).

- [ ] **Step 6: Docs.** `CLAUDE.md` §6: in the `/` row add "signed-out redirects land on `/#signin`, which shows the reason beside the form and focuses Create account"; in the `web/session.js` paragraph mention `takeNotice()` and that `requireUser` redirects to `/#signin`.

- [ ] **Step 7: Commit**

```bash
git add web/session.js web/wizard.js web/landing.html CLAUDE.md
git commit -m "session: signed-out redirects land on the sign-up form with the reason beside it"
```

---

### Task 5: `/thomas` redirect, copy fixes, Learn jump links

**Files:**
- Modify: `vercel.json`
- Modify: `web/landing.html` (Learn card copy ~line 91)
- Modify: `content/wizard/god.json`, `content/wizard/church-history-and-authority.json`, `content/wizard/the-unseen-realm.json` (one string each)
- Modify: `web/learn.js` (`positionCard` ~line 227; positions section ~line 449), `web/learn.html` (`<style>`)
- Modify: `CLAUDE.md` §6 URL table (`/thomas` row)

**Interfaces:** none new.

- [ ] **Step 1: `/thomas` redirect.** In `vercel.json` delete `{ "source": "/thomas", "destination": "/theology-map.html" },` from `rewrites` and add a top-level key:

```json
  "redirects": [
    { "source": "/thomas", "destination": "/view?name=Thomas", "permanent": false }
  ],
```

Validate: `py -c "import json;json.load(open('vercel.json'))"`. `theology-map.html` itself is untouched — it is the offline file. Update the `/thomas` row in CLAUDE.md §6's URL table: "redirects (302) to `/view?name=Thomas` — one hosted way to view a map; `theology-map.html` stays the offline file."

- [ ] **Step 2: Landing copy.** In `web/landing.html`'s Learn card change "One question at a time, with every position side by side and the" to "One question at a time, with the positions side by side and the". (Some doctrines have one position, so "every … side by side" over-promised.)

- [ ] **Step 3: Corpus copy that says "the wizard".** These strings render on `/learn`, where "the wizard" means nothing. Reword only the phrase, with the Edit tool on the exact substring, so the rest of each file stays byte-identical (CLAUDE.md §3: nothing else may reformat corpus JSON). None of them is a `hold`, so no `superseded_holds` entry is needed.
- `content/wizard/god.json` Trinity `framing`: "and the wizard says so rather than staging a false choice" → "and this site says so rather than staging a false choice".
- `content/wizard/church-history-and-authority.json` `learn_note` "…an attack on someone using the wizard…" → "…an attack on someone building their map…".
- `content/wizard/the-unseen-realm.json` `learn_note`: read the whole sentence containing "wizard" and reword that phrase only, the same way (describe the person or the map, not the tool).

Then `grep -n "wizard" content/wizard/*.json` over visible prose fields (`framing`, `learn_note`, `tier_note`, `history`, `hold`, `why`, `vs`) must return nothing, and `py engine/validate_content.py` must exit 0. If `node engine/build_traditions.js` produces a diff afterwards, commit it with this task.

- [ ] **Step 4: Learn jump links.** In `web/learn.js` `positionCard`, after `const card = el('div', 'lp-pos');` add `card.id = 'pos-' + position.id;` (check the position objects' id field name in `content/wizard/god.json` and use it). In the positions section, before the `grid` is appended:

```js
  // Long doctrines stack their cards on a phone; a row of jumps saves the scroll.
  if (positions.length >= 3) {
    const jump = el('nav', 'lp-jump');
    jump.setAttribute('aria-label', 'Jump to a position');
    for (const p of positions) {
      const a = el('a', null, p.label);
      a.href = '#pos-' + p.id;
      a.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('pos-' + p.id).scrollIntoView({ block: 'start' });
      });
      jump.appendChild(a);
    }
    posSec.appendChild(jump);
  }
```

(`preventDefault` + `scrollIntoView` keeps `/learn`'s `?doctrine=` URL and any popstate routing untouched.) In `web/learn.html`'s `<style>` add, near `.lp-positions`:

```css
  .lp-jump { display: flex; flex-wrap: wrap; gap: var(--s2); margin: 0 0 var(--s3); font: var(--fs-00)/var(--lh-ui) var(--sans); }
  .lp-jump a { padding: var(--s1) var(--s2); border: 1px solid var(--field-line); border-radius: var(--r2); color: var(--ink); text-decoration: none; }
```

(Use only tokens that exist in `engine/theme.css`; check each name before using it.)

- [ ] **Step 5: Gate** — full gate.

- [ ] **Step 6: Commit**

```bash
git add vercel.json web/landing.html web/learn.js web/learn.html content/wizard CLAUDE.md
git commit -m "thomas redirects to /view; Learn copy no longer says 'the wizard'; jump links on long doctrines"
```

---

## Controller-only steps (not for subagents)

- **Push** `main` to `origin` after Task 5's review passes (a push is a live deploy).
- **Live walk** at desktop and a 390px frame: `/`, `/#signin`, `/wizard` signed out, `/compare` signed out, `/gallery`, `/view?name=Thomas` (first paint, Reset view, open an area, drag, legend, no nested scrollbar), `/view?name=nobody`, `/thomas`, `/learn?doctrine=god.trinity`.
- **ViewTransition exceptions** (spec §8): with ordinary top-level navigation, watch the console on `/view` and `/thomas`. Real → new task; harness artefact → note in `debug.md`.
- **Thomas:** unlist Test1 and test2 in `/admin`.
