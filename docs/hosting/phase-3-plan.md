# Phase 3 — implementation plan (interface revamp)

> **For agentic workers:** use `superpowers:subagent-driven-development` (recommended)
> or `superpowers:executing-plans` to work this plan task by task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** make the hosted tool usable by a stranger with no training — a first-run
screen with three starting points, a node editor that promotes only what matters, a
gallery worth visiting, and a phone layout the editor has never had.

**Architecture:** presentation-layer only. No schema change, no file-format change,
no parser change. `engine/editor-core.js` is not modified at all. `engine/render.py`
is not modified at all. `engine/map-view.js` is modified in exactly three functions,
none of which has a counterpart in `render.py`. New shared styling lives in one new
file, `engine/theme.css`, linked relatively so the offline editor keeps working.

**Tech stack:** plain HTML/CSS/JS, no build step, no dependencies. Python 3.11.9
serverless functions under `api/` using only the standard library.

**Spec:** `docs/hosting/phase-3-design.md` — read it first, in full. This plan
argues from it and does not restate its reasoning.

---

## Global Constraints

Copied verbatim from the spec and `decisions.md`. Every task's requirements
implicitly include this section.

- **The interpreter is `py`, not `python`.** Bare `python` hits the Microsoft Store
  stub and fails. Never write `python engine/render.py`.
- **`engine/editor-core.js` is not modified by this phase.** No field is added,
  removed or renamed.
- **`engine/render.py` is not modified by this phase.** Its four generated views are
  out of scope. `py engine/render.py` must produce **no diff** at every commit.
- **`engine/map-view.js`: only `_leafHeaderEditable`, `_leafMetaEditable` and
  `_leafDetail` may change.** `_leafHeaderReadonly`, `_leafMetaReadonly`,
  `_mboxHTML`, `redraw`, `assignX`, `assignY`, `edges` and `_bindPanZoom` are
  lockstep-bearing with `render.py`'s embedded Map view and **must not change**.
  `MAP_TWO_SIDE_BREAK = 860` must not change.
- **The local editor keeps working offline.** `start_editor.bat` has no network. No
  CDN, no web font, no icon library, no framework. Any new asset is bundled and
  reachable from `file://` by a relative path.
- **Two new CSS tokens only**: `--field-line` (light `#8f8369`, dark `#7d7059`) and
  `--note` (light `#f0ead9`, dark `#2a2318`). No other new colour.
- **No traffic-light tier colours.** The tier ramp is
  `T1 #7c2d3b · T1.5 #8a4a24 · T2 #8c6a1f · T2.5 #5f6b35 · T3 #2f6b63 · T4 #33526e`
  and is not altered.
- **Tier colour is never the sole channel** — any tier graphic carries a text line
  with the same counts (spec §3.2 Failure B).
- **Prose capped at 58ch. Serif for content, sans for chrome.**
- **No browser automation, ever.** Not for verification, not for screenshots.
- **The vocabulary in spec §2.2 is used verbatim.** Phase 4 must match it.
- **Autosave is not designed here.** It is inherited from phase 1c. Do not change
  its debounce, its guards, or `api/map.py`.
- **Data-model and file-format calls stop and wait.** They are not decided by the
  build session. Task 8 is the only one, and it is gated.
- **Merging beats waiting** on everything else. A broken deploy is cheap; a stalled
  chain is not. Never force-push. Never rewrite `main`'s history. Never merge a task
  whose own verification failed.

## Branch

`phase-3-ui`, branched from `main`. Merge with `--no-ff` and a message naming the
phase. `git pull --rebase` before every push — other agents work in this repo
concurrently.

## Verification, given that nothing can be looked at

There is no browser automation and no live user. Every task below therefore ends
with checks that are *readable*, and the phase as a whole leans on four:

1. **`py engine/render.py` produces no diff.** The strongest single alarm in the
   repo — it proves the generator, the parser and the committed HTML still agree.
2. **The editor-core round trip** — parse → serialize → parse gives an identical
   model over the real 99-node file.
3. **The lockstep diff gate** — `git diff` on `engine/map-view.js` shows hunks only
   inside the three permitted functions.
4. **The contrast script** (spec §3.5) prints `RESULT: all pass`.

Set the reusable commands up once, in Task 0, so every later task is one line.

---

## File structure this phase produces

| Path | Responsibility | Task |
|---|---|---|
| `engine/theme.css` | **new** — the two new tokens + shared chrome, card, `--note` and optional-disclosure primitives. Linked relatively by the editor, absolutely by the web pages. | 1 |
| `engine/editor.html` | **modified** — links `theme.css`; responsive layout; promoted/optional split in `renderForm()`; `?open=` deep link; autosave indicator placement | 1, 2, 3, 6 |
| `engine/map-view.js` | **modified** — three editable-leaf functions only | 2 |
| `web/chrome.js` | **new** — renders the shared header on the five product pages | 1 |
| `web/first-run.js` | **new** — the three-card first-run screen and `WIZARD_ENABLED` | 6 |
| `web/index.html` | **modified** — front door: signed-out pitch, signed-in home, first-run mount point | 6 |
| `web/gallery.html` | **modified** — rows → cards | 5 |
| `web/view.html` | **modified** — shared chrome, Copy link, primary "make your own" call to action | 7 |
| `web/admin.html` | **modified** — shared chrome only | 1 |
| `api/gallery.py` | **modified** — four derived count fields, markdown never in the body | 4 |
| `vercel.json` | **modified** — no new route in this phase; `/wizard` is phase 4's | — |
| `docs/hosting/phase-3-outcome.md` | **new** — the handover | 9 |
| `CLAUDE.md` | **modified** — the editor's new structure and the vocabulary table | 9 |

---

## Model assignment at a glance

| Task | Who | Why |
|---|---|---|
| 0 — harness | main thread | short, and everything depends on it |
| **0.5 — design canvas** | **main thread, `design` skill** | judgment; publishes for Thomas |
| 1 — theme.css + chrome | Sonnet subagent | mechanical CSS and markup once tokens are fixed |
| 2 — node editor split | **main thread** | the phase's central judgment call, and the lockstep risk |
| 3 — editor responsive | Sonnet subagent | mechanical CSS against an explicit breakpoint table |
| 4 — gallery API counts | Sonnet subagent | a pure function with a fixed interface |
| 5 — gallery cards | Sonnet subagent, parallel with 4 | interface fixed by Task 4's Produces block |
| 6 — first run | **main thread** | copy, hierarchy, and the wizard gate |
| 7 — sharing | Sonnet subagent | small and self-contained |
| 8 — start from a map | **GATED on Q1** | data-model call; not started until Thomas answers |
| 9 — integration, docs, merge | main thread | judgment |

Tasks **4 and 5 run in parallel**. Tasks **1 and 3 must not** — 3 edits the CSS 1
creates. Task 2 must land before 3 so the responsive rules see the final markup.

---

# Task 0: Verification harness

**Files:**
- Create: *(scratchpad only — nothing enters the repo)*

**Interfaces:**
- Produces: four shell commands every later task reuses by name.

- [ ] **Step 1: Branch.**

```bash
cd "C:/Users/ThomasPC/Desktop/AIProjects/Project 12 - Theology Mind Map"
git pull --rebase
git checkout -b phase-3-ui
```

- [ ] **Step 2: Establish the render baseline.** This must be clean *before* any
      edit, or a later failure cannot be attributed.

```bash
py engine/render.py
git diff --stat theology-map.html documentation/theology-map.mm documentation/study-list.md
```

Expected: **no output**. If there is a diff, stop — the working tree was already
dirty and nothing in this phase can be verified. Report and halt.

- [ ] **Step 3: Write the round-trip check** to the session scratchpad as
      `roundtrip.js` (not into the repo — `editor-core.js` is UMD and exports under
      Node already).

```js
const fs = require('fs');
const core = require('./engine/editor-core.js');
const text = fs.readFileSync('theology-map.md', 'utf8');
const a = core.parse(text);
const b = core.parse(core.serialize(a));
const ja = JSON.stringify(a), jb = JSON.stringify(b);
const nodes = a.reduce((n, d) => n + d.nodes.length, 0);
console.log('domains', a.length, 'nodes', nodes);
if (ja !== jb) { console.log('ROUND TRIP: FAIL'); process.exit(1); }
console.log('ROUND TRIP: PASS');
```

- [ ] **Step 4: Run it.**

```bash
node <scratchpad>/roundtrip.js
```

Expected: `domains 14 nodes 99` then `ROUND TRIP: PASS`. The counts are the
post-phase-0.5 baseline from `decisions.md`; if they differ, say so in the outcome
file rather than assuming the check is broken.

- [ ] **Step 5: Save the contrast script** from spec §3.5 to the scratchpad as
      `contrast.py` and run it.

```bash
py <scratchpad>/contrast.py
```

Expected final line: `RESULT: all pass`.

- [ ] **Step 6: Define the lockstep gate** as a command, for reuse:

```bash
git diff -U0 main -- engine/map-view.js | grep '^@@' 
```

Every hunk header must fall inside `_leafHeaderEditable`, `_leafMetaEditable` or
`_leafDetail` (currently around lines 179–290). Any hunk before line 179 or after
`_leafDetail`'s closing brace is out of scope and must be reverted.

- [ ] **Step 7: Commit the branch point.** Nothing to add yet; no commit. Record the
      four commands in the session's notes.

**Verification:** all three scripts pass on unmodified `main`.

---

# Task 0.5: Publish the design canvas — **do this before writing any UI code**

`decisions.md`, "Working style for remote sessions": *"UI phases open with a
published design canvas (the `design` skill) of the key screens before building, so
Thomas can review on a phone while away."* This is that step, and it is why it comes
before Task 1.

**Files:** none in the repo. The `design` skill publishes an Artifact.

- [ ] **Step 1: Invoke the `design` skill** and build a canvas with **five
      artboards**, in this order:

  1. **First run** — the three-card screen, spec §5.1, shown at 1400px *and* at
     360px side by side. Show card 2 in its gated "not yet" state, since that is
     what will actually ship, and card 1 present, since that is what Thomas
     approved.
  2. **Node editor, open leaf** — promoted block (title, What I hold, Tier,
     Confidence, `#study`) with the glosses visible, and the `<details>` shut
     beneath it. Show one node with the disclosure open so the optional five are
     legible.
  3. **Gallery** — three cards at 1400px, one card at 360px, with the tier-spread
     bar and its text line. **No denomination anywhere.**
  4. **Editor at 360px** — the tree as a closed drawer, the wrapped filebar with the
     autosave indicator first, the map filling the rest.
  5. **`/view` for a signed-out stranger** — the rendered map with shared chrome and
     the primary "Make your own map" card beneath it.

- [ ] **Step 2: Use the real palette.** Every colour on the canvas comes from spec
      §3.1 and §3.3. Show both themes for at least the first-run and gallery
      artboards.

- [ ] **Step 3: Publish and record the URL.** Put it at the top of
      `phase-3-outcome.md` when Task 9 writes that file, and report it in the
      session's final message so Thomas gets the link even if he never opens the
      repo.

- [ ] **Step 4: Do not wait for a reply.** `decisions.md`: merging beats waiting.
      Proceed to Task 1 immediately. If Thomas responds later with changes, they are
      a follow-up session, not a blocker.

**Verification:** the Artifact URL resolves and the canvas has five artboards.

---

# Task 1: `engine/theme.css` and the shared chrome

**Files:**
- Create: `engine/theme.css`
- Create: `web/chrome.js`
- Modify: `engine/editor.html` (add one `<link>` in `<head>`)
- Modify: `web/index.html`, `web/gallery.html`, `web/view.html`, `web/admin.html`
  (add the stylesheet link and the chrome mount)

**Interfaces:**
- Produces:
  - CSS custom properties `--field-line`, `--note` on `:root`, redefined under
    `@media (prefers-color-scheme: dark)`.
  - CSS classes `.tm-chrome`, `.tm-card`, `.tm-card-primary`, `.tm-note`,
    `.tm-stat`, `details.optional > summary`.
  - `window.TMChrome.mount(pageTitle)` — renders the shared header into
    `#tmChrome`, reading the signed-in user from `web/session.js`'s `getUser()`.
- Consumes: `web/session.js`'s `getUser()` / `clearUser()` (phase 1b).

**Sonnet subagent.** Hand it spec §3 and §4.2 verbatim.

- [ ] **Step 1: Create `engine/theme.css`** with only the additive tokens. It must
      **not** restate `--bg`, `--ink`, `--muted`, `--line`, `--chip`, `--good`,
      `--bad`, `--panel`, `--serif` or `--sans` — `editor.html`'s inline block owns
      those, and duplicating them creates two sources of truth.

```css
/* engine/theme.css — shared tokens and primitives for the hosted pages and the
 * editor. Additive only: it never restates a token editor.html already defines,
 * so if this file fails to load the editor degrades to its previous styling
 * rather than to unstyled markup. Bundled — never fetched from a CDN. */
:root {
  --field-line: #8f8369;   /* 3.68:1 on --panel, 3.37:1 on --bg — WCAG 1.4.11 */
  --note:       #f0ead9;   /* quiet surface; never used without a rule + label */
}
@media (prefers-color-scheme: dark) {
  :root { --field-line: #7d7059; --note: #2a2318; }
}

/* Interactive control boundaries take --field-line. Decorative dividers keep
   --line. Do not merge these two. */
input[type=text], input[type=search], select, textarea,
.tm-card, .chip-select, .mfield textarea, .mfield input[type=text] {
  border-color: var(--field-line);
}

.tm-note {
  background: var(--note);
  border-left: 3px solid var(--muted);
  padding: 10px 14px;
  border-radius: 0 6px 6px 0;
  font: 13px/1.55 var(--serif);
  max-width: 58ch;
}

.tm-card {
  background: var(--panel);
  border: 1px solid var(--field-line);
  border-radius: 9px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tm-card h3 { margin: 0; font: 600 17px/1.3 var(--serif); }
.tm-card p  { margin: 0; font: 13.5px/1.55 var(--serif); color: var(--ink); max-width: 58ch; }
.tm-card .tm-go { margin-top: auto; font: 600 12.5px/1 var(--sans); color: var(--muted); }
.tm-card-primary {
  background: var(--ink); color: var(--bg); border-color: var(--ink);
}
.tm-card-primary p, .tm-card-primary .tm-go { color: var(--bg); }

.tm-stat { font: 12px/1.5 var(--sans); color: var(--muted); }

details.optional > summary {
  cursor: pointer;
  font: 600 12px/1.6 var(--sans);
  letter-spacing: .04em;
  color: var(--muted);
  padding: 8px 0;
  list-style: none;
}
details.optional > summary::-webkit-details-marker { display: none; }
details.optional > summary::before { content: '\25B8\00a0'; display: inline-block; transition: transform .15s ease; }
details.optional[open] > summary::before { transform: rotate(90deg); }
details.optional > summary:hover { color: var(--ink); }

@media (pointer: coarse) {
  button, .tabbtn, select, .nodebtn, details.optional > summary { min-height: 44px; }
  .mdomain-edit, .tagchip button { min-width: 44px; min-height: 44px; }
}
```

- [ ] **Step 2: Link it from `engine/editor.html`.** A **relative** href, so
      `file://` resolves it as a sibling. Place it *after* the existing `<style>`
      block so it wins on the properties it defines.

```html
<link rel="stylesheet" href="theme.css">
```

- [ ] **Step 3: Link it from the four `web/*.html` pages** as `/engine/theme.css`
      (absolute — those pages are only ever served over HTTP).

- [ ] **Step 4: Create `web/chrome.js`.**

```js
/* web/chrome.js — the one shared header for /app, /gallery, /view, /edit, /admin.
   Depends on web/session.js. */
(function () {
  'use strict';
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(href, text) { const a = el('a', null, text); a.href = href; return a; }

  function mount(pageTitle) {
    const host = document.getElementById('tmChrome');
    if (!host) return;
    const user = (window.getUser && window.getUser()) || null;
    const head = el('header', 'tm-chrome');
    head.appendChild(el('p', 'kicker', 'Theology Map'));
    head.appendChild(el('h1', null, pageTitle));
    const links = el('div', 'toplinks');
    links.appendChild(link('/app', 'My map'));
    links.appendChild(link('/gallery', 'Gallery'));
    if (user && user.is_admin) links.appendChild(link('/admin', 'Admin'));
    if (user) {
      const out = el('a', null, 'Sign out');
      out.href = '#';
      out.addEventListener('click', (e) => {
        e.preventDefault();
        window.clearUser();
        location.href = '/app';
      });
      links.appendChild(out);
    } else {
      links.appendChild(link('/app', 'Sign in'));
    }
    head.appendChild(links);
    host.replaceWith(head);
  }
  window.TMChrome = { mount: mount };
})();
```

- [ ] **Step 5: Add `<div id="tmChrome"></div>` and the two script tags** to the
      four `web/*.html` pages, calling `TMChrome.mount('<page title>')` on load.
      Titles: `Your map`, `Gallery`, the map owner's name on `/view`,
      `Admin`. **Do not add chrome to `theology-map.html`** — it is generated.

- [ ] **Step 6: Verify.**

```bash
py engine/render.py && git diff --stat theology-map.html
py <scratchpad>/contrast.py
```

Expected: no diff; `RESULT: all pass`.

- [ ] **Step 7: Verify the editor still loads offline.** Open
      `engine/editor.html` from the filesystem path directly (not via a server) and
      confirm the page renders styled. If the relative `theme.css` link is blocked,
      the inline `:root` fallback means it still renders — note which happened in the
      outcome file.

- [ ] **Step 8: Commit.**

```bash
git add engine/theme.css engine/editor.html web/chrome.js web/*.html
git commit -m "phase 3: shared theme tokens and product chrome"
```

---

# Task 2: The node editor — promoted versus optional

**Main thread.** This is the phase's central judgment call and carries the lockstep
risk. Do not delegate it.

**Files:**
- Modify: `engine/map-view.js` — `_leafMetaEditable` (~195), `_leafDetail` (~241)
- Modify: `engine/editor.html` — `renderForm()` (~497–560)
- **Not modified:** `engine/editor-core.js`, `engine/render.py`

**Interfaces:**
- Consumes: `EditorCore.TIERS`, `EditorCore.CONFIDENCES`, `SharedFields.renderLinkField`
- Produces: nothing other tasks depend on. Task 3 restyles what this emits.

- [ ] **Step 1: Add the gloss tables** to `engine/map-view.js`, near the top of the
      factory, beside the existing helpers. These strings are copied from
      `render.py`'s `TIER_META` and `CONF_META` and must match spec §2.1 exactly.

```js
  const TIER_GLOSS = {
    'T1': 'Essential to the gospel',
    'T1.5': 'Near-essential',
    'T2': 'Church-defining',
    'T2.5': 'Strains partnership',
    'T3': 'Important, not divisive',
    'T4': 'Matters of liberty',
  };
  const CONF_GLOSS = {
    'certain': 'Settled. I would teach and defend this.',
    'confident': 'Held with good reason, open to sharpening.',
    'leaning': 'A working position, not yet settled.',
    'open': 'Genuinely undecided.',
    'rejected': 'Considered and rejected.',
  };
```

- [ ] **Step 2: In `_leafMetaEditable`, put the gloss on every option.** Replace the
      two option-building loops. The `<select>` element itself, its class and its
      change handler are unchanged — only the option text and the `title` attribute.

```js
    [''].concat(core.TIERS).forEach(t => {
      const o = document.createElement('option');
      o.value = t;
      o.textContent = t ? t + ' \u2014 ' + TIER_GLOSS[t] : 'Tier \u2014 not set yet';
      if (t === (n.tier || '')) o.selected = true;
      tierSel.appendChild(o);
    });
    tierSel.title = 'How much weight this carries. T1 is the gospel itself; T4 is a matter of liberty.';
```

```js
    [''].concat(core.CONFIDENCES).forEach(c => {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c ? c + ' \u2014 ' + CONF_GLOSS[c] : 'Confidence \u2014 not set yet';
      if (c === (n.confidence || '')) o.selected = true;
      confSel.appendChild(o);
    });
    confSel.title = 'How sure I am \u2014 not how important it is. Those are two different questions.';
```

- [ ] **Step 3: Relabel the `#study` checkbox** in the same function. Change the
      loop's label from `'study'` to the full phrase.

```js
    [['study', '#study \u2014 I still need to work this out']].forEach(([flag, label]) => {
```

- [ ] **Step 4: Restructure `_leafDetail`.** `hold` is promoted out of the group and
      rendered first; the other five move inside a `<details class="optional">`. The
      `field()` helper, the `autosize` helper, the `stopPropagation` guards and the
      `refs` / link-field code all move **verbatim** into the new container — do not
      rewrite them.

```js
    // Promoted: the one field that makes a node worth having.
    wrap.appendChild(field('What I hold', n.hold, v => { n.hold = v; }));

    const opt = document.createElement('details');
    opt.className = 'optional';
    const sum = document.createElement('summary');
    sum.textContent = "Optional \u2014 why, what I'd reject, texts, related";
    opt.appendChild(sum);
    opt.addEventListener('click', e => e.stopPropagation());

    opt.appendChild(field('Why', n.why, v => { n.why = v; }));
    opt.appendChild(field("What I'd reject", n.vs, v => { n.vs = v; }));
    opt.appendChild(field('Still working out', n.todo, v => { n.todo = v; }));
    // ...existing refs row markup, appended to `opt` instead of `wrap`...
    // ...existing linkWrap markup, appended to `opt` instead of `wrap`...

    // Existing content is never hidden behind a disclosure.
    opt.open = !!(n.why || n.vs || n.todo || n.refs || (n.link && n.link.length));

    // A <details> changes its own height after the layout pass measured it.
    // Without this, opening the section makes tiles overlap.
    opt.addEventListener('toggle', () => { self.redraw(); });

    wrap.appendChild(opt);
```

- [ ] **Step 5: Run the lockstep gate.**

```bash
git diff -U0 main -- engine/map-view.js | grep '^@@'
```

Expected: every hunk inside `_leafMetaEditable` / `_leafDetail`. If a hunk lands in
`_leafHeaderReadonly`, `_leafMetaReadonly`, `_mboxHTML`, `redraw`, `assignX`,
`assignY`, `edges` or `_bindPanZoom`, **revert it** — those are lockstep-bearing.

- [ ] **Step 6: Apply the same split in `editor.html`'s `renderForm()`.** Replace the
      flat sequence at lines ~505–545 with the promoted block followed by the
      disclosure. Reuse the file's existing `fieldRow` / `textArea` / `selectField`
      helpers; extend `selectField` to accept an optional gloss map so the option
      text matches Step 2's.

Order: Title → *What I hold* → Tier → Confidence → `#study` → `<details class="optional">`
containing Why → What I'd reject → Still working out → Texts → Related.

Add one `.tm-note` line above the Tier/Confidence pair:

> *Tier is how much weight it carries. Confidence is how sure I am. They are two
> different questions.*

- [ ] **Step 7: Remove the two-column Tier/Confidence row.** `.row.two`'s
      `grid-template-columns:1fr 1fr` puts two hard questions side by side and
      breaks at 360px. Stack them.

- [ ] **Step 8: Verify.**

```bash
py engine/render.py && git diff --stat theology-map.html
node <scratchpad>/roundtrip.js
git diff --stat engine/editor-core.js engine/render.py
```

Expected: no render diff; `ROUND TRIP: PASS` with `domains 14 nodes 99`; **zero
lines changed** in `editor-core.js` and `render.py`.

- [ ] **Step 9: Commit.**

```bash
git add engine/map-view.js engine/editor.html
git commit -m "phase 3: promote hold+tier+confidence, collapse the optional five"
```

---

# Task 3: The editor's responsive layout

**Files:**
- Modify: `engine/editor.html` (the `<style>` block only)

**Interfaces:**
- Consumes: the markup Task 2 produces, `theme.css`'s `pointer: coarse` block.
- Produces: nothing.

**Sonnet subagent.** Hand it spec §9 verbatim. Must run **after** Task 2.

- [ ] **Step 1: Delete the three magic viewport numbers** and replace with a flex
      column. This is the highest-value change in the task.

```css
  body { display:flex; flex-direction:column; min-height:100dvh; }
  .layout { flex:1 1 auto; min-height:0; }
  .mapwrap { flex:1 1 auto; min-height:0; height:auto; }
  nav.tree { overflow-y:auto; min-height:0; max-height:none; }
```

Removing: `.layout{min-height:calc(100vh - 128px)}`,
`.mapwrap{height:calc(100vh - 170px)}`, `nav.tree{max-height:calc(100vh - 128px)}`.
`100dvh` not `100vh` — mobile Safari's collapsing address bar overflows `100vh`.

- [ ] **Step 2: 1400px — stop the form hugging the tree.**

```css
  main.form { max-width:720px; margin-inline:auto; }
```

- [ ] **Step 3: 641–900px — narrower tree.**

```css
  @media (max-width:900px) and (min-width:641px) { nav.tree { width:240px; } }
```

- [ ] **Step 4: ≤640px — one column, tree as a drawer.**

```css
  @media (max-width:640px) {
    header .kicker, header .sub { display:none; }
    .filebar { padding:8px 12px; }
    .filebar .status { order:-1; flex-basis:100%; }
    .tabs { padding:8px 12px 0; }
    .tabbtn { flex:1; }
    .layout { flex-direction:column; }
    nav.tree { width:auto; border-right:none; border-bottom:1px solid var(--line);
               max-height:45vh; padding:10px 12px; }
    main.form { padding:16px 14px 48px; }
    .row.two { grid-template-columns:1fr; }
  }
```

- [ ] **Step 5: Make the tree a real drawer at ≤640px.** Wrap `nav.tree`'s contents
      in a `<details>` whose summary reads `All beliefs (N)`, closed by default, and
      close it in the existing `selectNode(di, ni)` when the viewport matches
      `(max-width:640px)`. Use `window.matchMedia('(max-width:640px)').matches` —
      not a resize listener.

- [ ] **Step 6: Confirm the map's own breakpoint is untouched.**

```bash
grep -n "MAP_TWO_SIDE_BREAK" engine/map-view.js engine/render.py
```

Expected: `860` in both, unchanged. That constant is lockstep-bearing.

- [ ] **Step 7: Reason about each width in writing** and paste the result into the
      outcome file. This substitutes for looking at the screen, so it must be
      specific: at **360px** state where the tree, filebar, tabs and map each sit and
      how tall the map ends up; at **768px** state the tree/form split in pixels; at
      **1400px** state the form's left margin. Spec §9 gives the expected answers —
      if the CSS produces something different, the CSS is wrong.

- [ ] **Step 8: Verify.**

```bash
py engine/render.py && git diff --stat theology-map.html
grep -c "calc(100vh" engine/editor.html
```

Expected: no diff; `0` remaining `100vh` calcs.

- [ ] **Step 9: Commit.**

```bash
git add engine/editor.html
git commit -m "phase 3: give the editor a phone layout"
```

---

# Task 4: Gallery counts in `api/gallery.py`

**Files:**
- Modify: `api/gallery.py`

**Interfaces:**
- Consumes: `render.parse_text(text)` — the pure function phase 1a extracted from
  `engine/render.py`. It returns the same structure `parse()` did: an ordered list
  of domain dicts, each with a `nodes` list whose nodes carry `tier`, `confidence`
  and `flags`. **Confirm the exact name against `phase-1a-outcome.md` before
  coding** — if 1a named it differently, use 1a's name and note the discrepancy.
- Produces: `GET /api/gallery` →

```json
[{"id": "uuid", "name": "Sarah", "updated_at": "2026-08-15T09:00:00Z",
  "node_count": 31, "open_count": 7,
  "tier_counts": {"T1": 4, "T1.5": 0, "T2": 9, "T2.5": 0, "T3": 2, "T4": 0, "untiered": 16}}]
```

**Sonnet subagent, parallel with Task 5.**

- [ ] **Step 1: Select `markdown` in the PostgREST query**, alongside
      `id,name,updated_at`, keeping `is_public=is.true` and
      `order=updated_at.desc`.

- [ ] **Step 2: Add the counting function.**

```python
TIER_KEYS = ("T1", "T1.5", "T2", "T2.5", "T3", "T4")

def map_stats(markdown):
    """Derived gallery numbers. Never returns any of the markdown itself."""
    counts = {k: 0 for k in TIER_KEYS}
    counts["untiered"] = 0
    total = 0
    open_count = 0
    for domain in parse_text(markdown or ""):
        for n in domain["nodes"]:
            total += 1
            tier = n.get("tier")
            counts[tier if tier in counts else "untiered"] += 1
            # "Open questions" = #study flagged, OR confidence 'open'. Deduplicated
            # by construction: one increment per node. Phase 6 must use this same
            # definition — see phase-3-design.md section 7.1.
            if "study" in (n.get("flags") or []) or n.get("confidence") == "open":
                open_count += 1
    return {"node_count": total, "open_count": open_count, "tier_counts": counts}
```

- [ ] **Step 3: Build each response row explicitly**, never by mutating the database
      row. This is what keeps `markdown` out of the body.

```python
out = []
for row in rows:
    item = {"id": row["id"], "name": row["name"], "updated_at": row["updated_at"]}
    item.update(map_stats(row.get("markdown")))
    out.append(item)
```

- [ ] **Step 4: Handle an unparseable map** — wrap `map_stats` so a malformed
      markdown body yields zeroes rather than a 500 that empties the whole gallery.
      One bad row must not take out everyone else's card.

- [ ] **Step 5: Prove `markdown` never leaves.** Add to the verification, run against
      the deployed function:

```bash
curl -s https://theologymap-thomas-l-s-projects.vercel.app/api/gallery | grep -c '"markdown"'
```

Expected: `0`. Also assert `"pin"` is absent, as phase 1 required.

- [ ] **Step 6: Sanity-check the numbers against a known map.** Thomas's own map is
      the fixture: 14 domains, 99 nodes, 33 `#study`. Run `map_stats` over
      `theology-map.md` locally:

```bash
py -c "import sys; sys.path.insert(0,'api'); sys.path.insert(0,'engine'); import gallery; print(gallery.map_stats(open('theology-map.md',encoding='utf-8').read()))"
```

Expected: `node_count` **99**, and `open_count` ≥ 33 (33 `#study` nodes plus any
node whose `confidence` is `open`). If `node_count` is not 99, the parse call is
wrong — stop and fix before Task 5 consumes it.

- [ ] **Step 7: Commit.**

```bash
git add api/gallery.py
git commit -m "phase 3: derive gallery counts server-side, markdown never in the body"
```

---

# Task 5: Gallery cards

**Files:**
- Modify: `web/gallery.html`

**Interfaces:**
- Consumes: Task 4's response shape, `theme.css`'s `.tm-card` / `.tm-stat`,
  `TMChrome.mount('Gallery')`.
- Produces: nothing.

**Sonnet subagent, parallel with Task 4** — the interface above is fixed, so it does
not need Task 4 finished. Hand it spec §7 verbatim.

- [ ] **Step 1: Replace the plain list with a grid.** No breakpoint needed — one
      declaration covers 360px through 1400px.

```css
  .tm-grid { display:grid; gap:14px; max-width:1200px; margin-inline:auto;
             grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); }
```

- [ ] **Step 2: Render one card per map**, exactly per spec §7.1: name (serif,
      17px), the tier-spread bar, the counts line, `N beliefs · N open questions`,
      and `Updated <relative>`. The whole card links to `/view?id=<id>`.

- [ ] **Step 3: Build the tier-spread bar.** Segments proportional to
      `tier_counts`, coloured with the ramp, untiered in `--line`.

```js
  const TIER_COLOUR = {
    'T1':'#7c2d3b','T1.5':'#8a4a24','T2':'#8c6a1f',
    'T2.5':'#5f6b35','T3':'#2f6b63','T4':'#33526e'
  };
```

The bar carries `aria-hidden="true"` and `role="presentation"`.

- [ ] **Step 4: Emit the text line that repeats the same counts.** Non-negotiable —
      spec §3.2 Failure B established that the tier ramp measures 1.87:1 to 3.42:1
      against the dark theme's panel, so colour alone is below the 3:1 non-text
      minimum. The text is the accessible content; the bar is decoration.

```js
  const parts = TIER_ORDER.filter(t => counts[t] > 0).map(t => counts[t] + ' ' + t);
  if (counts.untiered) parts.push(counts.untiered + ' untiered');
  statLine.textContent = parts.join(' \u00b7 ');
```

- [ ] **Step 5: Empty and error states.** A public map with zero nodes still gets a
      card, reading *"No beliefs yet"*, with no bar — do not silently hide people. A
      failed fetch uses `session.js`'s error banner, **never** a silent empty grid.

- [ ] **Step 6: Add the trailing "Make your own map" card**, `.tm-card-primary`,
      linking to `/app`. Shown to signed-out visitors and to signed-in users whose
      own map is empty.

- [ ] **Step 7: Confirm no denomination.** Locked by the 2026-08-18 wireframe
      amendment.

```bash
grep -niE "denomination|tradition|anglican|reformed|baptist|catholic|orthodox|pentecostal" web/gallery.html
```

Expected: **no matches**.

- [ ] **Step 8: Verify.**

```bash
py <scratchpad>/contrast.py
```

Expected `RESULT: all pass`. If any new colour pair was introduced, add it to the
script first.

- [ ] **Step 9: Commit.**

```bash
git add web/gallery.html
git commit -m "phase 3: gallery cards carrying each map's own shape"
```

---

# Task 6: First run

**Main thread.** Copy, hierarchy and the wizard gate are judgment calls.

**Files:**
- Create: `web/first-run.js`
- Modify: `web/index.html`
- Modify: `engine/editor.html` (the `?open=` deep link)

**Interfaces:**
- Consumes: `getUser()`, `apiFetch()` (phase 1b), `GET /api/map?user_id=`,
  `POST /api/map` (phase 1c), `EditorCore.serialize`, `.tm-card` / `.tm-card-primary`.
- Produces: `/edit?open=<slug>` — the deep-link contract Task 8 and phase 4 reuse.

- [ ] **Step 1: Create `web/first-run.js`** with the gate as its first line.

```js
/* web/first-run.js — the three starting points, shown on /app while the map is
   empty. See phase-3-design.md section 5. */
(function () {
  'use strict';

  // Phase 4 flips this to true when /wizard exists. Nothing else changes.
  const WIZARD_ENABLED = false;
```

- [ ] **Step 2: Render the screen** per spec §5.1 — the 58ch prose block, then the
      cards. With `WIZARD_ENABLED === false`, card 1 is **not rendered** and cards 2
      and 3 lay out two-up (one-up below 640px). With it `true`, card 1 spans full
      width above them. Never ship a dead primary call to action.

- [ ] **Step 3: Card 3, "Add a belief by hand".** Build the starter map with
      `EditorCore.serialize`, save it, then redirect. It must not hand back an empty
      screen.

```js
  async function startByHand() {
    const domains = [{ name: 'Beliefs', nodes: [EditorCore.newNode('My first belief', 'Beliefs')] }];
    const markdown = EditorCore.serialize(domains);
    await saveMap(markdown);           // POST /api/map, phase 1c's route
    location.href = '/edit?open=' + encodeURIComponent(EditorCore.slugify('My first belief'));
  }
```

Saving immediately is what stops first-run reappearing on reload — the row is no
longer empty.

- [ ] **Step 4: Card 2 renders in its gated state.** Visible, with its real heading
      and body copy from spec §5.1, plus a `.tm-note` line reading *"Not switched on
      yet."* — **not clickable**, `aria-disabled="true"`. The approved three-card
      layout is what Thomas reviews on the canvas; the behaviour arrives with Task 8.
      Do **not** wire the copy behaviour here — it is blocked on Q1.

- [ ] **Step 5: Mount it from `web/index.html`.** Signed out → the pitch plus sign
      in / sign up plus a gallery link. Signed in with empty `markdown` → first-run.
      Signed in with a map → the map home: Open the editor, View, Export, Copy link,
      and (when `WIZARD_ENABLED`) the quiet *"Answer the questions to fill gaps"*
      link.

Emptiness test is `!markdown || !markdown.trim()`. Nothing else.

- [ ] **Step 6: Implement `?open=<slug>` in `engine/editor.html`.** After the model
      loads: find the node by slug, switch to the Map tab, open that leaf, focus and
      select its `.mtitle-input`. **An unresolvable slug is ignored silently** — a
      stale bookmark must never be an error.

- [ ] **Step 7: Verify.**

```bash
py engine/render.py && git diff --stat theology-map.html
node <scratchpad>/roundtrip.js
grep -n "WIZARD_ENABLED" web/first-run.js
```

Expected: no diff; `ROUND TRIP: PASS`; the constant present and `false`.

- [ ] **Step 8: Verify the starter markdown round-trips.** The node first-run
      creates must survive `serialize → parse`:

```bash
node -e "const c=require('./engine/editor-core.js'); const d=[{name:'Beliefs',nodes:[c.newNode('My first belief','Beliefs')]}]; const t=c.serialize(d); console.log(JSON.stringify(t)); const p=c.parse(t); console.log(p.length, p[0].nodes.length, p[0].nodes[0].title);"
```

Expected: `1 1 My first belief`.

- [ ] **Step 9: Commit.**

```bash
git add web/first-run.js web/index.html engine/editor.html
git commit -m "phase 3: first-run with three starting points, wizard slot gated off"
```

---

# Task 7: Sharing

**Files:**
- Modify: `web/view.html`, `web/index.html`

**Interfaces:**
- Consumes: `POST /api/render` with `{user_id}` (phase 1a), `.tm-card-primary`.

**Sonnet subagent.**

- [ ] **Step 1: Add a Copy link button** to `/view` and to the signed-in map home.
      It copies the absolute `/view?id=<id>` URL. Use `navigator.clipboard.writeText`
      with the same `try/catch` + textarea fallback `editor.html`'s
      `btnCopyPreview` already uses — copy that pattern, do not invent a second one.
      Confirm in place: the button's label becomes `Copied` for 1.5s, then reverts.

- [ ] **Step 2: Add the primary "Make your own map" card beneath the rendered map on
      `/view`**, `.tm-card-primary`, linking to `/app`. Spec §4.1: `/view` is the
      screen a stranger actually lands on, so this is the product's real front door
      and takes the primary fill, not a text link.

- [ ] **Step 3: Keep the Export HTML button** phase 1d put there, unchanged. Do not
      build a second exporter — the render route's HTML output *is* the export.

- [ ] **Step 4: Check 360px.** The rendered map sits in a sandboxed
      `<iframe srcdoc>`; give it `width:100%` and a viewport-height-based height so
      it does not double-scroll on a phone. The call-to-action card sits below the
      iframe, not floating over it.

- [ ] **Step 5: Commit.**

```bash
git add web/view.html web/index.html
git commit -m "phase 3: copy link and a real call to action on shared maps"
```

---

# Task 8: Start from someone else's map — **GATED. DO NOT START.**

**Blocked on Question 1 in `phase-3-design.md` §14.** How provenance is stored is a
data-model call, and `decisions.md` is explicit that those stop and wait rather than
being decided by a session. The wireframe amendment names this one specifically.

**Do not implement either option speculatively.** Do not add a column. Do not add a
markdown marker. Merge phase 3 without this task; run it as its own short session
once Thomas answers.

When he answers, the work is:

- [ ] **Step 1:** If **Option A** — write
      `supabase/migrations/<timestamp>_copied_from.sql` adding `copied_from uuid
      references public.users(id) on delete set null` and `copied_at timestamptz`,
      and apply it. If **Option B** — teach `render.py`'s `parse()` and
      `editor-core.js`'s `parse()` to ignore the marker line, **in lockstep, in the
      same commit**, and re-run the round-trip check plus the byte-identical render
      diff before anything else.
- [ ] **Step 2:** Add a `copy_from` action to `api/map.py`: read the source row,
      **reject unless its `is_public` is true**, write its markdown into the caller's
      row, record provenance.
- [ ] **Step 3:** Clear provenance on first real edit — in `api/map.py`'s save, when
      the incoming markdown differs from what was copied.
- [ ] **Step 4:** Make first-run card 2 live: open a picker reusing `/api/gallery`
      and Task 5's card, button reading *Start from this map*.
- [ ] **Step 5:** Surface provenance per Thomas's answer to **Q2** (default if
      unanswered: on the gallery card, worded *"Started from Sarah's map"*).
- [ ] **Step 6:** Verify — a non-public map cannot be copied even by id; a copied map
      loses its provenance after one edit; `py engine/render.py` still produces no
      diff.

---

# Task 9: Integration, documentation, merge

**Main thread.**

**Files:**
- Create: `docs/hosting/phase-3-outcome.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: One way to do each thing.** Grep for duplicated implementations the
      phase may have introduced — two clipboard helpers, two chrome headers, two
      relative-time formatters. Collapse any to one.

- [ ] **Step 2: Fold in phase 2's backlog if it exists.**

```bash
ls docs/hosting/phase-2-review.md
```

If present, work its deferred-cosmetic list now. If absent, proceed — the source
brief's precondition is a preference, not a blocker (spec §12).

- [ ] **Step 3: Run every gate one final time.**

```bash
py engine/render.py && git diff --stat theology-map.html documentation/theology-map.mm documentation/study-list.md
node <scratchpad>/roundtrip.js
py <scratchpad>/contrast.py
git diff --stat main -- engine/editor-core.js engine/render.py
git diff -U0 main -- engine/map-view.js | grep '^@@'
grep -c "calc(100vh" engine/editor.html
grep -riE "denomination|#thread" web/ engine/theme.css
```

Expected, in order: no render diff · `ROUND TRIP: PASS` (`domains 14 nodes 99`) ·
`RESULT: all pass` · **zero** changed lines in `editor-core.js` and `render.py` ·
hunks only in the three editable-leaf functions · `0` · no matches.

**Any failure blocks the merge.** `decisions.md`: never merge a phase whose own
verification failed.

- [ ] **Step 4: Write `docs/hosting/phase-3-outcome.md`.** It must carry:
  - The **design canvas URL** from Task 0.5, at the top, where Thomas will find it.
  - The Vercel preview URL, so he has a before/after pair against production.
  - The full contrast script output, pasted — the substitute for looking at it.
  - The written 360 / 768 / 1400 reasoning from Task 3 Step 7.
  - **The vocabulary table from spec §2.2 reproduced in full**, flagged as the
    contract phase 4 must match.
  - **Where the wizard goes** (spec §8): `/wizard`, `web/wizard.html`, the two entry
    points, `WIZARD_ENABLED` in `web/first-run.js`, and the no-new-API contract.
  - **Task 8 listed as not done, and why** — Q1 unanswered.
  - **Questions for Thomas**, spec §14, restated so he does not have to open two
    files.
  - A "decisions worth revisiting" section, per `decisions.md`, if anything built
    made a locked decision look wrong.
  - The 200-row gallery ceiling from spec §7.2, as a known limit.

- [ ] **Step 5: Update `CLAUDE.md`.** Under "Editing via the browser form": the
      promoted-versus-optional split, the `todo` → "Still working out" relabel, the
      new `engine/theme.css` and why it is linked relatively, the editor's new phone
      layout, and the precise lockstep rule from spec §6.2 — that only the three
      editable-leaf functions in `map-view.js` are phase-3 territory. That rule is
      the single most useful thing this phase can leave the next session.

- [ ] **Step 6: Merge.**

```bash
git checkout main
git pull --rebase
git merge --no-ff phase-3-ui -m "phase 3: interface revamp — first run, node editor, gallery, phone layout"
git push
```

Never force-push. Never rewrite history.

- [ ] **Step 7: Report** the design canvas URL, the preview URL, the vocabulary
      decisions phase 4 must match, and the Questions for Thomas list.

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| §2 vocabulary | 2 (glosses, `#study`, `todo` relabel), 9 (recorded for phase 4) |
| §3 colour, contrast, tokens | 0 (script), 1 (tokens), 5 (tier bar), 9 (final run) |
| §4 page map, chrome, `/` untouched | 1 |
| §5 first run | 6 (cards 1, 3), 8 (card 2, gated) |
| §6 node editor split, lockstep, redraw trap | 2 |
| §7 gallery cards and counts | 4, 5 |
| §8 wizard slot | 6 (the gate), 9 (documented) |
| §9 responsive | 3 |
| §10 save indicator | 3 (`order:-1` at ≤640px); mechanism inherited, untouched |
| §11 rejected alternatives | none — nothing to build |
| §13 decisions made | 9 (into the outcome file) |
| §14 questions | 8 (gated), 9 (restated) |

No spec requirement is unassigned. Task 8 is the only one that does not run in this
phase, by design.
