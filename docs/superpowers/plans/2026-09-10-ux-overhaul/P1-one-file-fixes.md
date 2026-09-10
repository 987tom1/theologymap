# P1 — Correctness and one-file fixes

> **Read [`00-index.md`](00-index.md) first.** Its Global Constraints — the standing gate, the
> three-viewport requirement, the invariants, the model table — apply to every task here.

**Spec:** `docs/superpowers/specs/2026-09-10-theology-map-ux-overhaul-design.md` §7 P1.

**Goal:** Six one-file fixes with no dependencies on anything else in the program. **Ship
first regardless of everything else** — F1 is a live bug stranding first-time users in the
raw editor right now.

**Model:** Sonnet. **Depends on:** nothing. **Blocks:** nothing.

---

## Why these six travel together

They are the findings that need no token, no motion and no nav work underneath them. Each
touches a bounded file set, each is independently revertable, and one of them (F1) is a
broken promise in production.

## Files, and what each is responsible for

| File | Touched by | Responsibility after P1 |
|---|---|---|
| `web/learn.js` | T1 (F1), T4 (F9) | Routes an unanswered doctrine to the question, not the editor; reads `TIER_VAR` from `chrome.js` |
| `web/chrome.js` | T3 (F7), T4 (F9) | The one nav list (hosted half); the one `TIER_VAR` export |
| `engine/editor.html` | T3 (F7) | The hand-kept `file://` copy of the nav list, in step |
| `web/wizard.js` | T2 (F6), T4 (F9) | Links out to `/learn`; reads `TIER_VAR` |
| `web/compare.js` | T4 (F9) | Reads `TIER_VAR` |
| `web/gallery.html` | T4 (F9) | Reads `TIER_VAR` |
| `web/learn.html` | T4 (F9), T5 (F10) | No tier hex literals; no local copies of the four shared text styles |
| `engine/theme.css` | T5 (F10) | Owns the product's four secondary text styles |
| `web/compare.html`, `web/wizard.html` | T5 (F10) | Alias the shared text styles instead of copying them |
| `web/landing.html` | T6 (F8) | A front door for a first visit, a launchpad for a return visit |

## Execution order and batching

**Batch by file-disjointness. Two agents must never hold the same file.**

1. **Task 1 alone** — the live bug. Commit and ship it before anything else moves.
2. **Task 4 alone** — F9 is the collision hub (six files, four of them shared with other
   tasks). Run it on its own.
3. **Tasks 2, 3, 5, 6 in one parallel Sonnet batch** — file-disjoint from each other:
   `{wizard.js}`, `{chrome.js, editor.html}`, `{theme.css, compare.html, wizard.html,
   learn.html}`, `{landing.html}`.

## Verification note — read before Task 1

There is **no DOM test harness in this repo and this plan does not add one.** The mechanical
check for each task below is a `grep` assertion plus `py tests/syntax_check.py`, and the real
check is the three-viewport browser pass, which is a criterion of the task, not a review step.
`syntax_check.py` exists because an unescaped apostrophe in `web/gallery.html` blanked the
entire Browse screen in production; **a module that fails to parse runs none of its lines
while the server logs stay clean.** Run it.

---

### Task 1: F1 — "Answer this question" reaches a question, not an empty editor canvas

**The bug, in production right now.** `web/learn.js:313` sends both the answered and the
unanswered case to `/edit?open=<slug>`. For the unanswered case the slug resolves to nothing.
`engine/editor.html:472` switches to the Map tab on the *presence* of `?open=`, and `:498`
returns silently when it does not resolve. So a church member taps a link that says "Answer
this question" and lands on the raw editor's pan/zoom canvas of collapsed area boxes, with no
error, no target and no way back but the browser's Back button — three taps from the home page.

**Invariant this task is governed by** (CLAUDE.md §5, quoted so it is not violated):

> `/edit?open=<slug>` expands the area, opens the tile and selects the title — and is the one
> thing that opens on **Map**, because `applyOpenParam()` only knows how to drive `MapView`.
> **An unresolvable slug is ignored silently**; a stale bookmark must never be an error.

That rule is right for a *bookmark* and stays. It is wrong for a link the app itself just
generated for a node it knows does not exist. **This task does not touch
`engine/editor.html`** — the spec calls that second-order fix separable and lower priority,
and it touches the offline tool.

**Files:**
- Modify: `web/learn.js:312-313`

**Interfaces:**
- Consumes: `/wizard?doctrine=<id>`, already implemented at `web/wizard.js:1133-1137` and
  already used by `web/compare.js:129`. Signed-out visitors are bounced to `/` by
  `wizard.js:1073`, which is correct behaviour for this link.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Confirm the bug exists before fixing it**

Run:
```bash
grep -n "Answer this question" -A2 web/learn.js
```
Expected: the `edit.href` line immediately below is unconditionally
`'/edit?open=' + encodeURIComponent(doctrine.slug)`. If it is already conditional, stop —
someone has fixed this and the rest of the task is wrong.

- [ ] **Step 2: Confirm the target route exists**

Run:
```bash
grep -n "doctrine" web/wizard.js | grep -n "searchParams\|URLSearchParams" | head
grep -n "wizard?doctrine=" web/compare.js
```
Expected: `web/wizard.js` reads a `doctrine` query param, and `web/compare.js` already links
to `/wizard?doctrine=`. This is the proof that the fix routes somewhere real.

- [ ] **Step 3: Make the href conditional**

`web/learn.js`, replacing line 313. `node` is already in scope — it is the `const node`
resolved from the map a few lines above, and the label on line 312 already branches on it.

```js
  const edit = el('a', null, node ? 'Edit this belief' : 'Answer this question');
  edit.href = node
    ? '/edit?open=' + encodeURIComponent(doctrine.slug)
    : '/wizard?doctrine=' + encodeURIComponent(doctrine.id);
```

- [ ] **Step 4: Assert the fix mechanically**

Run:
```bash
grep -n "wizard?doctrine=" web/learn.js
py tests/syntax_check.py
```
Expected: the grep returns the new line; `syntax_check.py` passes with no error.

- [ ] **Step 5: Run the standing gate**

```bash
node --test tests/*.test.js
py tests/syntax_check.py
py engine/validate_content.py
py tests/test_validate_content.py
py api/_test_lib.py
py tests/check_tradition_maps.py
py tests/check_generated_map.py
```
Expected: all pass. `engine/render.py` is untouched, so no regeneration and no hash check.

- [ ] **Step 6: Browser verification — the acceptance criterion**

At **360px, 820px and 1440px**, in **both themes**, with **`prefers-reduced-motion: reduce`
on**:
1. Open `/learn?doctrine=<id>` for a doctrine **not** in your map. The action reads
   "Answer this question" and its `href` is `/wizard?doctrine=<id>`. Tap it: the question
   screen for that doctrine opens.
2. Open `/learn?doctrine=<id>` for a doctrine **that is** in your map. The action reads
   "Edit this belief" and still goes to `/edit?open=<slug>`, which still opens the tile.
3. Signed out, the unanswered link bounces to `/`. That is `wizard.js:1073` and it is correct.

Record which of the three widths you actually opened. A phone-only pass has shipped two bugs
before.

- [ ] **Step 7: Read the diffstat, then commit**

```bash
git diff --stat
```
Expected: `web/learn.js | 4 +-` or thereabouts. **A diffstat wildly bigger than the change is
a line-ending rewrite** — stop and investigate before committing.

```bash
git add web/learn.js
git commit -m "fix: route Learn's unanswered doctrines to the question, not the raw editor

An unanswered doctrine has no node, so /edit?open=<slug> resolved to nothing
and editor.html silently bailed on the Map tab. /wizard?doctrine= already
exists and /compare already uses it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ELsoNm64C71Ej5aUJkhSGQ"
```

---

### Task 2: F6 — the wizard links to Learn instead of reproducing it

**What is wrong.** "Read about this question" (`wizard.html:336-339`, filled at
`wizard.js:487-494`) renders `doctrine.framing`, `doctrine.learn_note` and `doctrine.sources`
— the same three fields `learn.js:327-341` and `:374-383` render — and there is **no link from
the question to `/learn?doctrine=<id>`**. A user who has answered 40 questions has never once
been shown the word "Learn" in context. Learn does not feel bolted on because it is badly
built; it feels bolted on because the wizard never admits it exists.

**Do not delete `#who` to deduplicate.** `wizard.html:363-366` / `wizard.js:363-393` is a
second, shorter, lens-ordered rendering of Learn's "Who holds what". It is correct in place.
The link is what closes the loop.

**Files:**
- Modify: `web/wizard.js` — the `#q-readmore-body` fill, around `:487-494`

**Interfaces:**
- Consumes: `onFollow` (`wizard.js:123`) — the existing commit-before-leaving handler that
  source links already use; `el` from `/web/chrome.js`, already imported at `:15`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Locate the insertion point**

Run:
```bash
grep -n "q-readmore-body" web/wizard.js
grep -n "function onFollow\|const onFollow" web/wizard.js
```
Expected: the `rm` fill block (framing, then `explainer(...)`) and `onFollow`'s definition.
Read both before editing.

- [ ] **Step 2: Append the link as the last line inside `#q-readmore-body`**

In `web/wizard.js`, immediately after
`rm.appendChild(explainer(doctrine.learn_note, doctrine.sources, true));`:

```js
  // The reverse of learn.js's "Answer this question" link: the question admits
  // Learn exists. Commits first, exactly like a source link does.
  const more = el('a', 'cite-link', 'Read the full page on this doctrine →');
  more.href = '/learn?doctrine=' + encodeURIComponent(doctrine.id);
  more.target = '_blank'; more.rel = 'noopener';
  more.addEventListener('click', onFollow);
  rm.appendChild(more);
```

`.cite-link` styling lives in `engine/theme.css` — one rule instead of a copy per page
(`wizard.html:180-181` says so). Do not add a local style for this link.

- [ ] **Step 3: Assert mechanically**

```bash
grep -n "learn?doctrine=" web/wizard.js
py tests/syntax_check.py
```
Expected: the grep returns the new line; syntax check passes.

- [ ] **Step 4: Run the standing gate**

The seven commands from `00-index.md`. Expected: all pass.

- [ ] **Step 5: Browser verification at 360px / 820px / 1440px, both themes, reduced-motion on**

1. On a question screen, open "Read about this question". The new link is the **last** thing
   in the disclosure, below the sources.
2. Tap it. A new tab opens on `/learn?doctrine=<id>` **and the answer you had selected is
   still selected when you come back** — that is `onFollow` doing its job. If the selection is
   lost, `onFollow` was not wired; do not ship.
3. At 360px the link wraps rather than overflowing the card.

- [ ] **Step 6: Diffstat, then commit**

```bash
git diff --stat
git add web/wizard.js
git commit -m "feat: link the question's read-more out to /learn

The wizard rendered the same three fields Learn does and never named it.
Commits via the existing onFollow handler, like a source link.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ELsoNm64C71Ej5aUJkhSGQ"
```

---

### Task 3: F7 — "Wizard" becomes "Questions" (label only, URL unchanged)

**Why.** CLAUDE.md locks the vocabulary: user-facing copy says **belief** and **area**, never
"node" or "domain"; `todo` is **Still working out**, never "Study". "Wizard" is the same class
of leak — a 1995 Windows installer term, invisible to a developer and opaque to a church
member.

**Keep the `/wizard` URL.** It is bookmarked, linked from `compare.js:129`, linked from
`learn.js` as of Task 1, and documented. Label and route are separable and only the label is
user-facing.

**Invariant this task is governed by** (CLAUDE.md §8, quoted):

> The nav list in `chrome.js` vs `editor.html` — **Permanent lockstep, by hand.** The
> documented `file://` exception. **Any nav change is two edits.**

**Files:**
- Modify: `web/chrome.js:48`
- Modify: `engine/editor.html:575`

**Interfaces:** none — a string change on both halves of a hand-kept lockstep.

- [ ] **Step 1: Find every user-facing occurrence**

```bash
grep -rn "'Wizard'\|\"Wizard\"\|>Wizard<" web/ engine/
```
Expected: exactly two hits — `web/chrome.js:48` and `engine/editor.html:575`. If there are
more, they are all in scope; a third copy of the nav label is a fork this task must not leave
behind.

- [ ] **Step 2: Edit the hosted nav**

`web/chrome.js:48`:
```js
    links.appendChild(link('/wizard', 'Questions'));
```

- [ ] **Step 3: Edit the hand-kept `file://` copy**

`engine/editor.html:575`:
```js
      navLink('/wizard', 'Questions');
```

- [ ] **Step 4: Assert both halves moved together**

```bash
grep -rn "'Wizard'\|\"Wizard\"" web/ engine/
grep -rn "'Questions'" web/chrome.js engine/editor.html
py tests/syntax_check.py
```
Expected: the first grep returns **nothing**; the second returns **two** hits. One without the
other is the lockstep broken.

- [ ] **Step 5: Run the standing gate.** Expected: all pass.

- [ ] **Step 6: Browser verification at 360px / 820px / 1440px, both themes**

1. Signed in, the nav on `/`, `/gallery`, `/learn`, `/compare` reads
   `Home · Questions · Edit · Browse · Sign out`.
2. Open `/edit` **on a real map** and confirm its own nav reads `Questions` too. The editor's
   nav is built inside an `if (HOSTED)` dynamic import; if it did not render at all, that is a
   different bug — check the console for a module 404.
3. At 360px the nav still scrolls horizontally; "Questions" is one character longer than
   "Wizard" and must not break the row.

- [ ] **Step 7: Diffstat, then commit**

```bash
git diff --stat
git add web/chrome.js engine/editor.html
git commit -m "copy: 'Wizard' becomes 'Questions' in both nav copies

Installer jargon in a product that bans jargon. URL unchanged - it is
bookmarked and linked from compare.js and learn.js.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ELsoNm64C71Ej5aUJkhSGQ"
```

---

### Task 4: F9 — delete the reintroduced tier fork, hoist `TIER_VAR` to `chrome.js`

**Run this task alone. It is the collision hub of P1.**

**What is wrong.** `web/learn.html:9-14` declares the tier ramp as hex literals in a `web/`
file:

```css
  /* Tier ramp — engine/render.py's ramp exactly, wizard.html's own copy of
     the same variables. Declared per page rather than in theme.css so the
     colour choice stays visible next to the markup that uses it. */
  :root {
    --t1:#7c2d3b; --t1-5:#8a4a24; --t2:#8c6a1f; --t2-5:#5f6b35; --t3:#2f6b63; --t4:#33526e;
  }
```

**Invariant this violates** (CLAUDE.md §7, quoted):

> **`--t1`…`--t4` live in `engine/theme.css`.** Four hand-copied duplicates in `web/` were
> deleted. **Do not reintroduce a tier hex literal in a `web/` file** — read the token.
> `render.py` keeps its copy for the self-containment reason above; that one is legitimate.

The comment defending it is the **pre-phase-10 rationale that phase 10 overturned**; the file
was written before the rule and never revisited. Delete the block and the comment — leaving
the comment leaves the next session an argument for putting it back.

One level up, the same idea is forked a fifth time: the `TIER_VAR` map from tier name to CSS
custom property is declared four times — `wizard.js:45-48`, `compare.js:36-39`,
`learn.js:20-23` and `gallery.html:42-45` (there named `TIER_COLOUR`). That is the
`el`/`slugify`/`escapeHtml` situation repeating. **Another copy of a shared helper is a bug in
waiting.**

**Files:**
- Modify: `web/learn.html` — delete the `:root` block and its comment
- Modify: `web/chrome.js` — export `TIER_VAR`
- Modify: `web/wizard.js`, `web/compare.js`, `web/learn.js`, `web/gallery.html` — import it

**Interfaces:**
- Produces: `export const TIER_VAR` from `/web/chrome.js` — an object keyed
  `'T1' | 'T1.5' | 'T2' | 'T2.5' | 'T3' | 'T4'` returning the CSS `var(--tN)` string. Later
  phases read this; do not rename it.
- Consumes: nothing.

- [ ] **Step 1: Audit every tier literal and every copy before changing anything**

```bash
grep -rn "7c2d3b\|8a4a24\|8c6a1f\|5f6b35\|2f6b63\|33526e" web/ engine/
grep -rn "TIER_VAR\|TIER_COLOUR" web/ engine/
```
Expected from the first: hits in `web/learn.html` and in `engine/theme.css` and
`engine/render.py` (both legitimate — theme.css is the home, render.py's output must be
self-contained). **Any other `web/` hit is in scope for this task.**
Expected from the second: four declarations plus their call sites. Note that
`gallery.html` names it `TIER_COLOUR`.

- [ ] **Step 2: Export `TIER_VAR` from `chrome.js`**

`web/chrome.js`, beside the existing `el` / `slugify` exports:

```js
/* The tier-name → token map, forked four ways before this (wizard.js, compare.js,
   learn.js, gallery.html). It reads engine/theme.css's --t1…--t4 rather than a hex,
   which is the phase-10 rule: do not reintroduce a tier hex literal in a web/ file. */
export const TIER_VAR = {
  'T1': 'var(--t1)', 'T1.5': 'var(--t1-5)', 'T2': 'var(--t2)',
  'T2.5': 'var(--t2-5)', 'T3': 'var(--t3)', 'T4': 'var(--t4)',
};
```

- [ ] **Step 3: Delete the three local declarations and import instead**

`web/wizard.js` — delete lines 45-48, and change line 15:
```js
import { mount, el, TIER_VAR } from '/web/chrome.js';
```

`web/compare.js` — delete lines 36-39, and change line 9:
```js
import { mount, el, TIER_VAR } from '/web/chrome.js';
```

`web/learn.js` — delete lines 20-23, and change line 12:
```js
import { mount, el, TIER_VAR } from '/web/chrome.js';
```

- [ ] **Step 4: Alias it in `gallery.html` rather than renaming its call sites**

`web/gallery.html:37` — the inline module already imports from `chrome.js`. Delete the local
`TIER_COLOUR` declaration (`:42-45`) and alias on import, so no other line in the file moves:

```js
import { mount, relTime, TIER_VAR as TIER_COLOUR } from '/web/chrome.js';
```

- [ ] **Step 5: Delete the reintroduced tier fork from `learn.html`**

Delete `web/learn.html:9-14` in full — **the four comment lines and the `:root` block**. Leave
the `<style>` open and the `[hidden] { display: none !important }` rule that follows it intact.

- [ ] **Step 6: Assert mechanically**

```bash
grep -rn "7c2d3b\|8a4a24\|8c6a1f\|5f6b35\|2f6b63\|33526e" web/
grep -rn "^const TIER_VAR\|^const TIER_COLOUR" web/
grep -rn "TIER_VAR" web/chrome.js web/wizard.js web/compare.js web/learn.js web/gallery.html
py tests/syntax_check.py
```
Expected: the first grep returns **nothing** — no tier hex literal survives anywhere under
`web/`. The second returns **nothing** — no local declaration survives. The third returns one
export and four imports. Syntax check passes; it is the gate that catches a broken inline
module in `gallery.html`, which is the exact failure this file has produced in production
before.

- [ ] **Step 7: Run the standing gate.** Expected: all pass.

- [ ] **Step 8: Browser verification at 360px / 820px / 1440px, both themes**

Tier colour is a **redundant channel** and must survive on all four surfaces. Check the
actual painted colour, not just that the page loads:
1. `/learn` — the tier chips on the doctrine list and the tier note. **These are the ones the
   deleted `:root` block was feeding; if the ramp is now grey, `theme.css` is not reaching
   this page and the `:root` block was load-bearing.** Stop and investigate rather than
   restoring it.
2. `/wizard` — the tier radio group's selected pill and the launchpad tier bar.
3. `/compare` — the row headers' left border and the suggested/mine tier pips.
4. `/gallery` — the per-map tier bars.
5. **Dark mode on all four.** The ramp is chosen for WCAG AA against white chip text; confirm
   nothing has fallen back to a UA default.

- [ ] **Step 9: Diffstat, then commit**

```bash
git diff --stat
git add web/learn.html web/chrome.js web/wizard.js web/compare.js web/learn.js web/gallery.html
git commit -m "refactor: one tier ramp, one TIER_VAR

learn.html had reintroduced the tier hexes that phase 10 deleted, with a
comment defending the overturned rationale. TIER_VAR was declared four times;
it now lives beside el and slugify in chrome.js.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ELsoNm64C71Ej5aUJkhSGQ"
```

---

### Task 5: F10 — promote the four secondary text styles to `theme.css`

**What is wrong.** `web/compare.html:90-95` carries the comment that states the case against
itself:

> *Three shapes borrowed from `web/wizard.html` so the two pages read as one product. Copied
> rather than hoisted into `theme.css`: they are page-local text styles there too, and moving
> them would touch the wizard mid-phase.*

**The mid-phase reason has expired.** `.wz-quiet`, `.wz-hint`, `.wz-framing` and `.lab` are
the product's four secondary text styles, declared in `wizard.html:63,169,178,93`,
`compare.html:93-95`, and `learn.html:20,76` as `.lp-lead` / `.lp-hint` — three near-identical
sets. This is the CSS-layer expression of the verdict: pages that look alike by copying, not
by sharing.

**Scope discipline.** `engine/theme.css` is loaded by the offline editor too. **Keep the
additions to text-only rules with no layout implications** — these four qualify. Alias the
existing class names for one round rather than renaming ~60 call sites at once; the rename is
P7's business, not this task's.

**Do not touch the values.** This task moves declarations, it does not restyle them. The type
scale lands in P7. If a value differs between two copies, adopt `wizard.html`'s — it is the
original — and note the difference in the commit message.

**Invariant this task is governed by** (CLAUDE.md §7, quoted):

> **`/learn`'s position cards let their `gap` own all vertical spacing.**
> `.lp-pos > *, .lp-mine > * { margin: 0 }` exists because every row is a `<p>` and flex gaps
> *add to* margins rather than collapsing them. The reset is scoped with `>` on purpose and
> must stay declared *after* `.lp-prose`/`.lp-hint`/`.lp-refs` to win on order.

`.lp-hint` is one of the classes being aliased. **If you alias it to a `theme.css` rule, the
`> *` reset in `learn.html` must still be declared after everything it resets** — a rule moved
into `theme.css` is now in a stylesheet that loads *before* the page's `<style>`, so the reset
still wins. Verify by eye at `/learn`, per Step 6.

**Files:**
- Modify: `engine/theme.css` — add `.tm-quiet`, `.tm-hint`, `.tm-framing`, `.tm-lab`
- Modify: `web/wizard.html` — alias `.wz-quiet`, `.wz-hint`, `.wz-framing`, `.lab`
- Modify: `web/compare.html` — delete the three copies, alias
- Modify: `web/learn.html` — alias `.lp-lead` / `.lp-hint`

**Interfaces:**
- Produces: `.tm-quiet`, `.tm-hint`, `.tm-framing`, `.tm-lab` in `engine/theme.css`. P7 and
  P11 read these names. Do not rename them.

- [ ] **Step 1: Audit the three sets before merging them**

```bash
grep -n "\.wz-quiet\|\.wz-hint\|\.wz-framing\|^\s*\.lab" web/wizard.html web/compare.html
grep -n "\.lp-lead\|\.lp-hint\|\.lp-pos-label" web/learn.html
```
Expected: the near-identical declarations quoted above. **Write down every place two copies
differ** — you will need it for the commit message and for P7.

- [ ] **Step 2: Add the four shared rules to `engine/theme.css`, with the page names as aliases**

CSS has no `@extend`. The alias is a **selector list on the shared rule itself**, which keeps
every name in one place instead of scattering alias stubs across three pages.

Append to `engine/theme.css`, near the existing `.tm-stat` / `details.optional` block:

```css
/* The product's four secondary text styles. Declared once here rather than
   copied into wizard.html, compare.html and learn.html - three near-identical
   sets was the CSS-layer expression of "pages that look alike by copying".
   Text only, no layout: engine/theme.css is loaded by the offline editor too.
   The page-local names ride along for one round; P7 renames the call sites. */
.tm-quiet, .wz-quiet         { margin: 0; font: 12.5px/1.5 var(--sans); color: var(--muted); }
.tm-hint, .wz-hint, .lp-hint { margin: 0; font: 12.5px/1.55 var(--serif); color: var(--muted);
                               max-width: 58ch; }
.tm-framing, .wz-framing     { margin: 0; font: 14px/1.55 var(--serif); color: var(--ink);
                               max-width: 58ch; }
.tm-lab, .lab, .lp-pos-label { margin: 0; font: 600 11px/1.4 var(--sans); letter-spacing: .04em;
                               text-transform: uppercase; color: var(--muted); }
```

Two notes on scope:

- `.tm-lab` **keeps `text-transform: uppercase` for now.** D4's reduction to one uppercase
  register is P7's job (design §5 small win 7); doing it here would make a visual change in a
  task that is meant to be a move.
- `.lp-hint`'s copy in `learn.html` is `13px/1.55` with `margin: 4px 0`, against `wizard.html`'s
  `12.5px/1.55` and `margin: 0`. **Adopt `wizard.html`'s** — it is the original — and note the
  difference in the commit message. `/learn`'s hints get very slightly smaller and lose a 4px
  margin the surrounding `gap` already provides.

- [ ] **Step 3: Delete `wizard.html`'s four declarations**

Delete the rule bodies at `web/wizard.html:63` (`.wz-quiet`), `:93` (`.wz-framing`), `:169`
(`.lab`) and `:178` (`.wz-hint`). **Keep the surrounding comments** where they explain
something other than the style — `:91-92` explains why the prose lives behind the disclosure
and is still true.

- [ ] **Step 4: Delete `compare.html`'s three copies**

Delete `web/compare.html:90-95` in full — the six-line comment and the three rules. **Keep
`:96-99`** (`.cmp-row .wz-framing` and `.cmp-row a`): those are genuine page-local overrides,
not copies.

- [ ] **Step 5: Delete `learn.html`'s two**

Delete `.lp-hint` (`web/learn.html:76`) and `.lp-pos-label` (`:84`).

**Leave `.lp-lead` (`:20`) alone.** It is `62ch`, `14px/1.55` serif, `margin: 0 0 16px` — a
lead paragraph, not a hint, and P7 gives it `--measure-wide`. Merging it here would change
how `/learn` opens.

**Do not move `.lp-pos > *, .lp-mine > * { margin: 0 }`.** It stays exactly where it is, after
the rules it resets — see the invariant quoted above.

- [ ] **Step 6: Assert mechanically**

```bash
grep -n "\.wz-quiet\s*{\|\.wz-hint\s*{\|\.wz-framing\s*{\|^\s*\.lab\s*{" web/wizard.html web/compare.html
grep -n "\.lp-hint\s*{\|\.lp-pos-label\s*{" web/learn.html
grep -n "tm-quiet\|tm-hint\|tm-framing\|tm-lab" engine/theme.css
py tests/syntax_check.py
```
Expected: the first two greps return **nothing**; the third returns the four new rules.

- [ ] **Step 7: Run the standing gate.** Expected: all pass. `engine/render.py` is untouched —
`theme.css` is not `render.py`'s embedded stylesheet — so no regeneration and no hash check.

- [ ] **Step 8: Browser verification at 360px / 820px / 1440px, both themes — this is a
      pixel-identity check**

**Nothing should look different.** This task moves declarations; it does not restyle.
1. `/wizard` — the question screen's framing text, hints, labels and the quiet lines under the
   actions row.
2. `/compare` — the row bodies. Their `.wz-framing` still gets `margin: 0 0 10px` from the
   surviving `.cmp-row .wz-framing` override.
3. `/learn` — **the position cards especially.** Uneven spacing here is the `> * { margin: 0 }`
   reset having lost its order fight (debug.md rule 13: *uneven spacing in a `gap`-based flex
   container is margins adding to the gap*). If rows have gone loose, that is the bug.
4. **Open `/edit` offline from `file://`** — `theme.css` is the offline editor's stylesheet
   too. Confirm the editor still renders. Four text-only rules cannot break it, but the
   check costs ten seconds and the offline contract is non-negotiable.

- [ ] **Step 9: Diffstat, then commit**

```bash
git diff --stat
git add engine/theme.css web/wizard.html web/compare.html web/learn.html
git commit -m "refactor: the four secondary text styles move to theme.css

compare.html's own comment said the mid-phase reason for copying them had a
shelf life. It expired. Page classes alias the shared rules for one round;
P7 renames the call sites. No values changed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ELsoNm64C71Ej5aUJkhSGQ"
```

---

### Task 6: F8 — `/` stops being a menu wearing a landing page

**What is wrong.** `landing.html:40-56` puts 350 words of first-visit explainer **above** a
signed-in user's own tiles, and `:147-155` mounts a permanently-disabled administrative toggle
as card seven of the primary grid. The same page is doing two jobs for two audiences and
optimising for the one that visits once.

**Note the ordering dependency this task does *not* have.** F2/P6 removes `/`'s role as the
only route to My map, which is what lets `/` be honest about being a front door. This task is
still shippable now — it improves `/` either way — but the full payoff arrives with P6.

**Invariants this task is governed by** (CLAUDE.md §7, quoted):

> **Unlist, never Hide.** `is_public` controls listing, not secrecy: anyone holding the row id
> still reads the map through `/api/map`. Unlisting is not privacy and the copy must not imply
> it is.

> **`#home-empty` is deleted.** Its third first-run offer — *start from someone else's map* —
> lives on `#screen-intro`, the screen a new account actually lands on. **Do not re-add a
> second empty-state home.**

`/` **keeps every tile it has.** Tiles and nav items are not rivals: tiles are the discoverable
surface for a first visit, the nav is the return path for visit forty. This task **collapses**
the explainer for a signed-in user and **relocates** one control. It deletes nothing.

**Files:**
- Modify: `web/landing.html` — the `.tm-prose` block and the Listing-status tile

**Interfaces:**
- Consumes: `details.optional` — the disclosure primitive already in `engine/theme.css:97-108`.
  Do not write a new one.

- [ ] **Step 1: Read what is there**

```bash
grep -n "tm-prose\|Listing status\|visBtn\|firstrun-grid" web/landing.html
```
Read `web/landing.html:40-56` and `:134-175` before editing. The Listing-status control carries
a live `is_public` GET and a toggle; **this task moves where it renders, not what it does.**

- [ ] **Step 2: Collapse the explainer for a signed-in visitor**

Wrap the existing `.tm-prose` div in markup that is a plain `<div>` signed out and a
`<details>` signed in. The `details.optional` primitive already exists; use it.

In `web/landing.html`'s markup, replace the opening `<div class="tm-prose">` with:

```html
  <details class="optional" id="what-it-is" open>
    <summary>What a theology map is</summary>
    <div class="tm-prose">
```

and close it with `</div></details>` after the last `<p>`. Then in the module script, beside
the existing `$('signed-out').hidden = !!user;`:

```js
// Signed out, this is the pitch and it stays open. Signed in, it is 350 words
// above your own tiles on visit forty; one line collapses it.
if (user) $('what-it-is').open = false;
```

- [ ] **Step 3: Move Listing status out of the primary grid**

It is a setting, not a destination. In the module script, change the two lines that append it
so it lands on a quiet line under the grid rather than as card seven:

```js
  // A setting, not a destination - it renders under the grid, not as its
  // seventh card. With P6 it also lives in the overflow menu.
  const visRow = document.createElement('p');
  visRow.className = 'tm-quiet';
  visRow.appendChild(visBtn);
  $('firstrun-grid').after(visRow);
```

and change `visBtn.className` from `'tm-card tm-cardlink'` to `'tm-action-btn'` — the
existing button register in `engine/theme.css:138-142`, which is what a setting should look
like. **Keep every string.** The wording says Unlist / Relist, never Hide, and says the map
stays readable to anyone holding a link; that copy is an invariant.

- [ ] **Step 4: Assert mechanically**

```bash
grep -n "what-it-is\|tm-action-btn\|Unlist\|Relist" web/landing.html
grep -n "home-empty" web/landing.html
py tests/syntax_check.py
```
Expected: the disclosure id and the button class are present; the Unlist/Relist wording is
unchanged; **`home-empty` returns nothing** — this task must not resurrect it.

- [ ] **Step 5: Run the standing gate.** Expected: all pass.

- [ ] **Step 6: Browser verification at 360px / 820px / 1440px, both themes, reduced-motion on**

1. **Signed out**, `/` shows the explainer open, the sign-in and create-account forms, and no
   tiles that need an account. This is the front door and it must still sell.
2. **Signed in**, `/` shows a collapsed "What a theology map is" summary, then the tile grid,
   then the Listing-status line under it. Expand the summary — it opens.
3. The Listing-status control still starts disabled with "Checking whether your map is
   listed…", enables when the GET answers, and toggling it still works both ways.
4. **820px especially** — the grid is two-up here rather than one-up or three-up, and the
   moved control must not leave a hole in the row.

- [ ] **Step 7: Diffstat, then commit**

```bash
git diff --stat
git add web/landing.html
git commit -m "ux: / is a front door signed out, a launchpad signed in

350 words of first-visit explainer sat above a returning user's own tiles,
and a permanently-disabled setting was card seven of the primary grid.
Explainer collapses for a signed-in visitor; Listing status moves under the
grid. Every tile stays. Unlist wording unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ELsoNm64C71Ej5aUJkhSGQ"
```

---

## P1 phase gate — before P1 is called done

- [ ] All six tasks committed, each as its own revertable commit.
- [ ] The full standing gate green on the final state, not just per-task.
- [ ] `grep -rn "7c2d3b\|8a4a24\|8c6a1f\|5f6b35\|2f6b63\|33526e" web/` returns nothing.
- [ ] `grep -rn "'Wizard'" web/ engine/` returns nothing.
- [ ] `git diff -U0 main -- engine/map-view.js | grep '^@@'` returns **nothing** — P1 does not
      touch the map engine, and the lockstep gate stays armed until P9.
- [ ] `engine/render.py` untouched; `theology-map.html` unchanged; no hash moved.
- [ ] All three viewports walked on the final state: **360px, 820px, 1440px**, **both themes**,
      **`prefers-reduced-motion: reduce` on**. Record which device or emulation was used for
      each — the 820px pass is the one historically checked by nobody.
- [ ] `/edit` opened from `file://` at least once. The offline contract is non-negotiable.
