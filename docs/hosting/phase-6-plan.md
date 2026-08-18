# Phase 6 — implementation plan: learn and compare

> **For the session executing this:** one phase, one branch, `phase-6-learn-compare`. Written
> to be pasted in cold with no memory of any other session. Steps use checkbox (`- [ ]`)
> syntax. Use `superpowers:subagent-driven-development` and push mechanical work to Sonnet
> subagents where the plan says so.

**Goal:** browse the corpus **by doctrine**, read each tradition as a real read-only map, and
compare my map against a tradition or another member — with all three compare shapes: the
per-doctrine diff, the closest-tradition summary, and the all-traditions scorecard.

**Architecture:** a Node build script generates one markdown map per tradition from the phase
4/5 corpus, using the project's only serializer. A pure UMD engine
(`engine/compare-core.js`) resolves both maps back to corpus positions and produces the
verdicts. Two static pages render learn and compare. **No new serverless function; no second
renderer; no second parser.**

**Tech stack:** Node v24 for the build script and tests, vanilla browser JS with no bundler
and no CDN imports, Python 3.11 standard library (as `py`) for the validator and the parse
checks, Vercel static hosting.

**Spec:** `docs/hosting/phase-6-design.md`, and `docs/hosting/phase-4-design.md` §4 for the
schema this phase consumes. **Read both alongside this plan.**

**Locked decisions:** `docs/hosting/decisions.md`. They override this plan.

---

## Global constraints

1. **One parser, one serializer, one renderer.** `EditorCore.parse` / `EditorCore.serialize`
   and `engine/render.py`. `editor-core.js`, `map-view.js` and `render.py`'s view code are not
   forked and not ported.
2. **Compare is descriptive, never evaluative.** No ranking of people, no leaderboard, no
   score attached to a named person, no colouring a difference as a deficiency. "Closest" is
   said of traditions only, always with its denominator.
3. **No tradition is caricatured.** Every generated tradition map is one its adherents would
   sign — which means every fix goes into the corpus, never into the generated file.
4. **`content/traditions/*.md` are generated. Never hand-edit them**, the same rule as
   `theology-map.html`.
5. **Never write verse text from memory.** References only; text via
   `py engine/fetch_verses.py`.
6. **Four views, not five.** `#thread` does not exist.
7. **`requirements.txt` stays empty.**
8. **The interpreter is `py`, not `python`.**
9. **No browser automation, ever.**
10. **The repo is public.** No secrets.
11. **Merging beats waiting.** Merge when this phase's verification passes. **Never
    force-push, never rewrite history, never merge on failed verification.**
12. **Anything touching the data model stops and waits.** In this phase that means: do not add
    an `is_comparable` column. See Task 6.

## Preconditions — check all four before writing anything

```bash
py engine/validate_content.py          # phase 5's corpus is clean
ls content/wizard/                     # 14 domain files + manifest + traditions
node --version                          # v24.x
curl -sI https://theologymap-thomas-l-s-projects.vercel.app/ | head -1   # 200
```

If the corpus is still phase 4's twelve-doctrine seed, **build against it and say so**, but do
not merge until it has been run against the full corpus. Everything in this plan works on
either.

## File structure this phase produces

| Path | Responsibility | Task |
|---|---|---|
| `engine/build_traditions.js` | corpus → one markdown map per tradition | 1 |
| `content/traditions/*.md` | **generated** read-only tradition maps | 1 |
| `content/traditions/manifest.json` | **generated** provenance and coverage | 1 |
| `engine/compare-core.js` | **pure** resolution and verdicts; UMD | 2 |
| `tests/compare-core.test.js` | the verdict table, fixture-driven | 2 |
| `tests/check_tradition_maps.py` | every tradition map parses clean under `render.py` | 1 |
| `web/learn.html`, `web/learn.js` | the by-doctrine reference surface | 4 |
| `web/compare.html`, `web/compare.js` | target picker, diff, closest, scorecard | 5 |
| `web/view.html` | **modified** — `?tradition=` branch | 3 |
| `api/map.py` | **modified if needed** — public-only guard | 6 |
| `vercel.json` | **modified** — `/learn`, `/compare` rewrites | 4, 5 |
| `docs/hosting/phase-6-outcome.md` | handover | 7 |
| `CLAUDE.md` | **modified** | 7 |

---

# Task 0: Branch and design canvas

- [ ] **Step 1: Branch**

```bash
git checkout main
git pull --rebase
git checkout -b phase-6-learn-compare
```

- [ ] **Step 2: Publish the design canvas** (`decisions.md` requires it for UI phases)

Use the `design` skill. Four artboards: the learn index and a doctrine page with three
traditions side by side; the compare target picker with its two choices; the per-doctrine diff
with one row expanded; the all-traditions scorecard with its column totals and its stated
denominator. Put the URL in the outcome file and the final report.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "phase 6: branch open, design canvas published"
```

---

# Task 1: Generate the tradition maps

**Files:**
- Create: `engine/build_traditions.js`, `tests/check_tradition_maps.py`
- Generates: `content/traditions/*.md`, `content/traditions/manifest.json`

**Interfaces:**
- Consumes: `EditorCore` (`newNode`, `serialize`, `parse`), the corpus in `content/wizard/`.
- Produces: `buildTradition(corpus, traditionId) -> {markdown, nodeCount, skipped[]}`, exported
  for the tests, plus a CLI entry point.

- [ ] **Step 1: Write the failing test**

```js
// tests/build-traditions.test.js
const assert = require('assert');
const EditorCore = require('../engine/editor-core.js');
const BT = require('../engine/build_traditions.js');

const corpus = BT.loadCorpusSync('content/wizard');

function test(name, fn) { fn(); console.log('ok -', name); }

test('a divided tradition without an override is a build error', () => {
  const broken = JSON.parse(JSON.stringify(corpus));
  const baptism = BT.findDoctrine(broken, 'church.baptism');
  delete baptism.tradition_overrides.anglican;
  assert.throws(() => BT.buildTradition(broken, 'anglican'), /anglican.*church\.baptism|church\.baptism.*anglican/i);
});

test('an override wins over a single matching position', () => {
  const out = BT.buildTradition(corpus, 'anglican');
  const domains = EditorCore.parse(out.markdown);
  const node = domains.flatMap(d => d.nodes).find(n => n.slug === 'baptism');
  const ov = BT.findDoctrine(corpus, 'church.baptism').tradition_overrides.anglican;
  assert.strictEqual(node.hold, ov.hold);
  assert.strictEqual(node.confidence, ov.confidence);
});

test('stance maps to confidence', () => {
  const out = BT.buildTradition(corpus, 'reformed');
  const domains = EditorCore.parse(out.markdown);
  const node = domains.flatMap(d => d.nodes).find(n => n.slug === 'baptism');
  assert.strictEqual(node.confidence, 'certain');   // confessional -> certain
});

test('a tradition with no position on a doctrine skips it and records it', () => {
  const out = BT.buildTradition(corpus, 'quaker');
  assert.ok(Array.isArray(out.skipped));
});

test('round-trip: parse -> serialize -> parse is identical', () => {
  for (const t of BT.scorecardTraditions(corpus)) {
    const md = BT.buildTradition(corpus, t.id).markdown;
    const once = EditorCore.parse(md);
    const twice = EditorCore.parse(EditorCore.serialize(once));
    assert.deepStrictEqual(once, twice, t.id);
  }
});

test('links are pruned to slugs present in that tradition map', () => {
  for (const t of BT.scorecardTraditions(corpus)) {
    const domains = EditorCore.parse(BT.buildTradition(corpus, t.id).markdown);
    const slugs = new Set(domains.flatMap(d => d.nodes).map(n => n.slug));
    for (const n of domains.flatMap(d => d.nodes))
      for (const l of n.link) assert.ok(slugs.has(l), `${t.id}: ${n.slug} -> ${l}`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node tests/build-traditions.test.js
```

Expected: `Cannot find module '../engine/build_traditions.js'`.

- [ ] **Step 3: Implement `engine/build_traditions.js`**

Node script, CommonJS, requiring `./editor-core.js`. It must implement design §2.2's
five-step algorithm exactly, including:

- the resolution rule with its **four branches**, where branch three **throws** with a message
  naming the doctrine id and the tradition id and saying "add a tradition_overrides entry";
- `stanceConfidence`: `confessional → certain`, `majority → confident`,
  `permitted|minority|historic → leaning`;
- node fields: tier `override.tier ?? position.tier ?? doctrine.suggested_tier`;
  `hold`/`why`/`vs` from the override or the position; `refs`
  `position.refs ?? doctrine.refs`; `todo` empty; flags from `override.flags || []`;
- domains ordered by `manifest.order`, nodes within a domain in tier order (T1 down to T4,
  untiered last) — the same convention the map itself uses;
- link pruning against that map's own slugs;
- `EditorCore.serialize(domains)` for the text — **never string concatenation**;
- writing `content/traditions/<id>.md` and `content/traditions/manifest.json` with
  `generated_at`, `corpus_schema_version`, per-tradition `node_count` and `skipped`.

CLI: `node engine/build_traditions.js` builds all `in_scorecard: true` traditions and prints
one line each plus a total. A non-zero exit on any resolution failure.

- [ ] **Step 4: Run until green, then build for real**

```bash
node tests/build-traditions.test.js
node engine/build_traditions.js
ls content/traditions/
```

- [ ] **Step 5: Every generated map parses clean under `render.py`**

```python
# tests/check_tradition_maps.py
"""Every generated tradition map must parse with zero warnings and no broken links."""
import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import render

fails = 0
paths = sorted((ROOT / "content" / "traditions").glob("*.md"))
for path in paths:
    nodes = render.parse_text(path.read_text(encoding="utf-8"))
    slugs = {n["slug"] for n in nodes}
    if not nodes:
        print(f"EMPTY {path.name}"); fails += 1
    for n in nodes:
        for target in n.get("link", []):
            if target not in slugs:
                print(f"BROKEN LINK {path.name}: {n['slug']} -> {target}"); fails += 1
        if not n.get("hold"):
            print(f"NO HOLD {path.name}: {n['slug']}"); fails += 1
    print(f"{path.name}: {len(nodes)} nodes")
print(f"{len(paths)} tradition maps checked, {fails} problems")
sys.exit(1 if fails else 0)
```

```bash
py tests/check_tradition_maps.py
```

Expected: one line per tradition, `0 problems`.

- [ ] **Step 6: Read one generated map end to end, by hand**

Open `content/traditions/reformed.md` and read every node. This is the "would an adherent sign
this" check and it does not go to a subagent. Any wince goes back into `content/wizard/`, not
into the generated file. Repeat for `roman-catholic.md` and `pentecostal.md`.

- [ ] **Step 7: Commit**

```bash
git add engine/build_traditions.js tests/build-traditions.test.js tests/check_tradition_maps.py content/traditions
git commit -m "phase 6: generate tradition maps from the corpus through the shared serializer"
```

---

# Task 2: The compare engine

**Files:**
- Create: `engine/compare-core.js`, `tests/compare-core.test.js`

**Interfaces:**
- Consumes: `EditorCore.parse`, the corpus.
- Produces, as `CompareCore`:
  - `resolvePosition(node, doctrine) -> {kind: "position"|"undecided"|"rejected"|"own-wording"|"unanswered", position?, node?}`
  - `diff(corpus, mineDomains, theirsDomains) -> [{doctrine, mine, theirs, verdict}]`
  - `closestTradition(corpus, mineDomains, traditionMaps) -> {ranked[], denominatorNote, enough: bool}`
  - `scorecard(corpus, mineDomains, traditionMaps) -> {rows[], columns[], totals[]}`
  - `canBeComparedAgainst(user) -> bool`
  - Verdict strings, exactly: `"agree"`, `"agree-in-substance"`, `"differ"`,
    `"mine-undecided"`, `"theirs-undecided"`, `"mine-own-wording"`, `"theirs-own-wording"`,
    `"mine-unanswered"`, `"theirs-unanswered"`, `"rejected"`.

- [ ] **Step 1: Write the failing test**

```js
// tests/compare-core.test.js
const assert = require('assert');
const fs = require('fs');
const EditorCore = require('../engine/editor-core.js');
const BT = require('../engine/build_traditions.js');
const CC = require('../engine/compare-core.js');

const corpus = BT.loadCorpusSync('content/wizard');
const traditionMaps = {};
for (const t of BT.scorecardTraditions(corpus))
  traditionMaps[t.id] = EditorCore.parse(BT.buildTradition(corpus, t.id).markdown);

function test(name, fn) { fn(); console.log('ok -', name); }

test('a tradition compared with itself agrees everywhere', () => {
  const rows = CC.diff(corpus, traditionMaps.reformed, traditionMaps.reformed);
  const bad = rows.filter(r => !['agree','agree-in-substance','mine-unanswered','theirs-unanswered'].includes(r.verdict));
  assert.deepStrictEqual(bad.map(r => `${r.doctrine.id}:${r.verdict}`), []);
  assert.ok(rows.some(r => r.verdict === 'agree'));
});

test('a tradition built from an override agrees with itself', () => {
  const rows = CC.diff(corpus, traditionMaps.anglican, traditionMaps.anglican);
  const row = rows.find(r => r.doctrine.slug === 'baptism');
  assert.ok(['agree', 'agree-in-substance'].includes(row.verdict), row.verdict);
});

test('a position inside an override span agrees in substance with that tradition', () => {
  const p = CC.findPosition(corpus, 'church.baptism/infant-covenant');
  const mine = EditorCore.parse(`# Church\n\n## Baptism · T3 · confident\n  hold  ${p.hold}\n`);
  const row = CC.diff(corpus, mine, traditionMaps.anglican).find(r => r.doctrine.slug === 'baptism');
  assert.strictEqual(row.verdict, 'agree-in-substance');
});

test('two different traditions differ somewhere', () => {
  const rows = CC.diff(corpus, traditionMaps.reformed, traditionMaps.baptist);
  assert.ok(rows.some(r => r.verdict === 'differ'));
});

test('an undecided node is never counted as a difference', () => {
  const mine = EditorCore.parse('# Church\n\n## Baptism · T3 · open · #study\n  hold  Undecided.\n  todo  Work this out.\n');
  const rows = CC.diff(corpus, mine, traditionMaps.reformed);
  const row = rows.find(r => r.doctrine.slug === 'baptism');
  assert.strictEqual(row.verdict, 'mine-undecided');
});

test('edited wording resolves to own-wording, not to a wrong position', () => {
  const mine = EditorCore.parse('# Church\n\n## Baptism · T3 · confident\n  hold  Something I wrote myself about water and faith.\n');
  const row = CC.diff(corpus, mine, traditionMaps.reformed).find(r => r.doctrine.slug === 'baptism');
  assert.strictEqual(row.verdict, 'mine-own-wording');
});

test('equivalence groups produce agree-in-substance, not differ', () => {
  const a = CC.findPosition(corpus, 'church.baptism/believer');
  const others = CC.positionsInGroup(corpus, a.equivalence_group).filter(p => p.id !== a.id);
  if (others.length === 0) { console.log('  (no equivalence pair in corpus — skipped)'); return; }
  const mine   = EditorCore.parse(`# Church\n\n## Baptism · T3 · confident\n  hold  ${a.hold}\n`);
  const theirs = EditorCore.parse(`# Church\n\n## Baptism · T3 · confident\n  hold  ${others[0].hold}\n`);
  assert.strictEqual(CC.diff(corpus, mine, theirs).find(r => r.doctrine.slug === 'baptism').verdict, 'agree-in-substance');
});

test('closest tradition refuses to answer on a thin map', () => {
  const mine = EditorCore.parse('# Church\n\n## Baptism · T3 · confident\n  hold  x\n');
  assert.strictEqual(CC.closestTradition(corpus, mine, traditionMaps).enough, false);
});

test('a tradition map is closest to itself', () => {
  const r = CC.closestTradition(corpus, traditionMaps.reformed, traditionMaps);
  assert.strictEqual(r.ranked[0].traditionId, 'reformed');
  assert.strictEqual(r.ranked[0].numerator, r.ranked[0].denominator);
});

test('scorecard totals equal the counted diff rows', () => {
  const total = CC.scorecard(corpus, traditionMaps.baptist, traditionMaps)
                  .totals.find(t => t.traditionId === 'reformed');
  const rows = CC.diff(corpus, traditionMaps.baptist, traditionMaps.reformed);
  const agree = rows.filter(r => r.verdict === 'agree' || r.verdict === 'agree-in-substance').length;
  assert.strictEqual(total.numerator, agree);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node tests/compare-core.test.js
```

- [ ] **Step 3: Implement `engine/compare-core.js`**

UMD, pure, no DOM, no fetch, mirroring `editor-core.js`'s wrapper. Implement design §4.2's
`resolvePosition` **exactly as written** — `normalise` lowercases, collapses whitespace, strips
one trailing full stop and surrounding quotes, and **nothing else**. No fuzzy matching, no
similarity threshold, no stemming. A near-match must resolve to `own-wording`.

**Implement the override candidates from design §4.2** — `candidates(doctrine)` is
`doctrine.positions` plus one synthetic candidate per `tradition_overrides` entry, with id
`"<doctrine.id>/@override:<traditionId>"`, the override's `hold`, and a `spans` array. Without
this, a tradition built from an override fails to agree with **itself**, and the
self-comparison test in Step 1 will catch it. Expose it as
`CompareCore.candidates(corpus, doctrineId)`.

`diff` walks every doctrine in the corpus in (tier, domain order, doctrine order) — the same
order the wizard asks in — and applies design §4.3's verdict table, plus the override rule: a
real position on one side and an override candidate on the other **agree in substance** when
that position is in the override's `spans`; two override candidates for the same tradition
plainly **agree**. `rejected` on either side yields `"rejected"` and is excluded from all
counts.

`closestTradition` implements design §4.4 including both guards: fewer than **eight**
resolvable doctrines → `enough: false`; a gap of **three or fewer** between the top two →
both flagged `joint: true`. No tier weighting. Return `numerator`, `denominator` and
`excludedCount` per tradition so the UI can state them.

`scorecard` implements §4.5, traditions only. **Do not add a person-vs-person scorecard**, and
add a comment in the file saying so and why, so a later session does not add one as an obvious
symmetry.

`canBeComparedAgainst(user)` is `user.is_public === true`, in **one** place with a comment
pointing at design §4.7 and the open question.

- [ ] **Step 4: Run until green**

```bash
node tests/compare-core.test.js
```

- [ ] **Step 5: Commit**

```bash
git add engine/compare-core.js tests/compare-core.test.js
git commit -m "phase 6: one comparison engine, exact matching, honest denominators"
```

---

# Task 3: Render a tradition map at `/view?tradition=`

**Files:**
- Modify: `web/view.html`

- [ ] **Step 1: Add the branch**

In `web/view.html`'s controller, before the existing `?id=` path:

```js
const params = new URLSearchParams(location.search);
const traditionId = params.get('tradition');

async function loadMarkdown() {
  if (traditionId) {
    const manifest = await (await fetch('/content/traditions/manifest.json')).json();
    const entry = manifest.traditions.find(t => t.id === traditionId);
    if (!entry) throw new Error('No such tradition: ' + traditionId);
    const markdown = await (await fetch('/content/traditions/' + entry.file)).text();
    return { markdown, label: entry.display_name, isTradition: true, entry };
  }
  // ... the existing member-map path, unchanged
}
```

Rendering is unchanged: POST `{markdown}` to `/api/render` and inject the HTML, exactly as the
member path already does. **Do not add a route, do not change `api/render.py`.**

- [ ] **Step 2: Add the standing header line**

Above the rendered map, when `isTradition`:

> *A generated summary of what this tradition confesses, not a person's map.*

followed by the `map.intro` from `content/wizard/traditions.json`, and a link to
`/learn?tradition=<id>`. Never a "compare" call to action framed as a challenge.

- [ ] **Step 3: Verify without a browser**

```bash
node -e "new (require('vm').Script)(require('fs').readFileSync('web/view.html','utf8').replace(/[\s\S]*?<script>/,'').replace(/<\/script>[\s\S]*/,''))" 2>/dev/null || echo "inline script extraction differs — check by reading"
grep -c 'tradition' web/view.html
```

- [ ] **Step 4: Commit**

```bash
git add web/view.html
git commit -m "phase 6: view a tradition map through the existing render route"
```

---

# Task 4: The learn surface

**Files:**
- Create: `web/learn.html`, `web/learn.js`
- Modify: `vercel.json` — `{ "source": "/learn", "destination": "/web/learn.html" }`

- [ ] **Step 1: Build the index**

`/learn` lists every doctrine grouped by domain in manifest order, each row showing
`node_title`, `suggested_tier` as a tier chip, and the count of positions. A text filter over
`node_title`, `question` and every `position.label`. Tier chips use the existing garnet→slate
ramp; **do not** introduce traffic-light colours.

- [ ] **Step 2: Build the doctrine page**

`/learn?doctrine=church.baptism` renders design §3's seven sections in order: question and
framing; `learn_note`; key texts as reference pills; the positions side by side with `label`,
`hold`, `why`, `vs`, `learn_detail`, `refs`, orthodoxy marker with its note, and sources; the
"who holds what" block; my own answer if signed in; deduplicated sources.

Two rules that are easy to get wrong:

- **A tradition with a `tradition_overrides` entry appears once**, spanning its positions,
  with the override `note` and `citation` — not once per position. That case is the entire
  reason this surface exists rather than only the maps.
- **`orthodoxy: "outside"` positions sort last** and carry the fixed marker text
  *Outside the historic creeds* plus the `orthodoxy_note` verbatim. Never a warning colour,
  never scare quotes, never omitted.

- [ ] **Step 3: Build the tradition index**

`/learn?tradition=reformed`: every doctrine that tradition has a position on, with its `hold`,
its stance in plain English (reuse the same `STANCE_TEXT` constant phase 4's wizard defined —
copy it into one shared place if it is not already reachable, and note the duplication if it
is unavoidable), its citation, and a link to the generated map.

- [ ] **Step 4: Verify**

```bash
node -e "new (require('vm').Script)(require('fs').readFileSync('web/learn.js','utf8'))" && echo "learn.js parses"
grep -niE '\byou\b|\byour\b' web/learn.js web/learn.html && echo "SECOND PERSON — fix" || echo "voice ok"
```

- [ ] **Step 5: Commit**

```bash
git add web/learn.html web/learn.js vercel.json
git commit -m "phase 6: learn by doctrine, every tradition side by side"
```

**Subagent note:** the index (step 1) and the doctrine page (step 2) are separable once the
element ids are fixed. Two Sonnet subagents in parallel, each given design §3 verbatim.

---

# Task 5: The compare surface

**Files:**
- Create: `web/compare.html`, `web/compare.js`
- Modify: `vercel.json` — `{ "source": "/compare", "destination": "/web/compare.html" }`

- [ ] **Step 1: The target picker**

`/compare` opens on the choice, per the approved wireframe: **a major tradition** (list from
`content/traditions/manifest.json`) or **another member** (list from `/api/gallery`, filtered
through `CompareCore.canBeComparedAgainst`). The member list carries the plain sentence that a
public map can be compared against. Deep links `/compare?tradition=reformed`,
`/compare?user=<id>` and `/compare?doctrine=church.baptism` skip the picker.

- [ ] **Step 2: Load both sides and run the engine**

```js
const mine   = EditorCore.parse((await apiFetch('/api/map?user_id=' + user.id)).markdown);
const theirs = targetIsTradition
  ? EditorCore.parse(await (await fetch('/content/traditions/' + file)).text())
  : EditorCore.parse((await apiFetch('/api/map?user_id=' + targetId)).markdown);
const rows = CompareCore.diff(corpus, mine, theirs);
```

- [ ] **Step 3: Render the per-doctrine diff**

Grouped by tier (T1 first), then domain, with per-group counts. Rows expand to both `hold`
sentences, both `why` lines, the corpus `framing`, and a link to `/learn?doctrine=`.
Differences are **not** sorted first and **not** coloured red. Copy per verdict, exactly:

```js
const VERDICT_TEXT = {
  'agree':              'We say the same thing here',
  'agree-in-substance': 'The same answer, worded differently',
  'differ':             'We answer this differently',
  'mine-undecided':     'I have not settled this yet',
  'theirs-undecided':   'Not settled on their side',
  'mine-own-wording':   'Worded my own way — shown side by side',
  'theirs-own-wording': 'Worded their own way — shown side by side',
  'mine-unanswered':    'Not in my map yet',
  'theirs-unanswered':  'This tradition takes no position on it',
  'rejected':           'Recorded as considered and rejected',
};
```

For a member target, replace `'theirs-unanswered'` with `'Not in their map yet'`. A
`mine-unanswered` row carries a link into `/wizard` at that doctrine.

- [ ] **Step 4: Closest tradition and the scorecard**

Both from `CompareCore`, shown when the target is a tradition. Print the fraction with its
denominator in words — *"agrees with 41 of the 58 questions where both have a position"* — and
the excluded count beside it. Honour both guards: no closest tradition below eight resolvable
doctrines, joint naming within three.

The scorecard scrolls horizontally inside its own `overflow-x: auto` container and collapses to
one tradition per accordion below 860px, matching the map view's breakpoint.

- [ ] **Step 5: Person-to-person restrictions**

When the target is a member: **no scorecard, no closest-tradition summary, no score.** Only the
per-doctrine diff and a neutral count of doctrines where both have settled something. Framing
copy: *"This is what our two maps say side by side."* Add a comment in `compare.js` saying the
omission is deliberate, citing design §4.6.

- [ ] **Step 6: Verify**

```bash
node -e "new (require('vm').Script)(require('fs').readFileSync('web/compare.js','utf8'))" && echo "compare.js parses"
grep -niE '\byou\b|\byour\b' web/compare.js web/compare.html && echo "SECOND PERSON — fix" || echo "voice ok"
grep -n 'scorecard' web/compare.js | head    # confirm it is gated on targetIsTradition
```

- [ ] **Step 7: Commit**

```bash
git add web/compare.html web/compare.js vercel.json
git commit -m "phase 6: compare against a tradition or a member, three shapes, one engine"
```

---

# Task 6: The public-map guard, and the question that stops and waits

**Files:**
- Modify: `api/map.py` (only if the guard is missing)

- [ ] **Step 1: Read the route**

```bash
grep -n "is_public\|user_id" api/map.py
```

- [ ] **Step 2: Add the guard if it is not there**

GET `/api/map?user_id=X` must return `markdown` for another user **only when that row's
`is_public` is true**. The owner always gets their own. A hidden map returns 404 with a plain
message, not an empty map. This is a one-line condition inside an existing route — not new
scope, and not a data-model change.

- [ ] **Step 3: Verify against the deployed site**

```bash
curl -s "https://theologymap-thomas-l-s-projects.vercel.app/api/map?user_id=<a-hidden-map-id>" | head -3
```

Expect a 404-shaped JSON error, not markdown. If there is no hidden map to test with, use the
admin route to hide one temporarily, test, then unhide — and say so in the outcome file.

- [ ] **Step 4: Do NOT add `is_comparable`**

`decisions.md` flagged "can a public map opt out of being a comparison target" as **not
decided**, and adding a column is a data-model change, which stops and waits. Instead:

- keep `canBeComparedAgainst` as the single predicate;
- ship the two no-schema mitigations from design §4.7 — the picker and the gallery say plainly
  that a public map can be compared against, and no comparison is ever notified, logged or
  counted;
- write the question into the outcome file with design §8's three options and its
  recommendation.

- [ ] **Step 5: Commit**

```bash
git add api/map.py
git commit -m "phase 6: only public maps are readable as a compare target"
```

---

# Task 7: Verification, documentation, merge

- [ ] **Step 1: The full suite**

```bash
py engine/validate_content.py            # 0 errors
node engine/build_traditions.js          # every in_scorecard tradition builds
node tests/build-traditions.test.js      # all ok
node tests/compare-core.test.js          # all ok
py  tests/check_tradition_maps.py        # 0 problems
py  engine/render.py                     # zero warnings
git diff --stat theology-map.html        # expect NO diff
```

- [ ] **Step 2: The three judgment checks that do not go to a subagent**

1. **Self-comparison**: `node -e` a tradition against itself — 100% agreement, zero
   differences. Covered by the test, but read the output once by eye.
2. **Cross-comparison plausibility**: Reformed vs Baptist. Read three rows against the corpus
   and confirm the diff says something a person from either tradition would recognise.
3. **Read `content/traditions/roman-catholic.md` and `orthodox.md` end to end.** These are the
   two traditions the audience knows least and the two most easily caricatured. Any wince goes
   into `content/wizard/`, then rebuild.

- [ ] **Step 3: Corpus references have text**

```bash
py engine/corpus_refs.py
py engine/fetch_verses.py
py engine/render.py | tail -5
```

A blank after fetching is a bad reference, not a network problem — check versification first
(Psalms, 2 Corinthians, Malachi).

- [ ] **Step 4: Write `docs/hosting/phase-6-outcome.md`**

Must contain:

- the design canvas URL;
- the per-tradition node counts and the skipped-doctrine lists, straight from
  `content/traditions/manifest.json` — this is the honest coverage statement;
- **the open question about comparison opt-out**, with design §8's three options and the
  recommendation, stated as needing Thomas's call because it is a data-model change;
- design §8's other five questions;
- the standing rule that `content/traditions/*.md` are generated and that a correction goes
  into the corpus;
- anything phase 5's corpus turned out to be missing for compare — that is the most useful
  thing this file can carry back.

- [ ] **Step 5: Update `CLAUDE.md`**

`content/traditions/` is generated by `node engine/build_traditions.js` and never hand-edited;
`engine/compare-core.js` joins the UMD lockstep family; `/learn`, `/compare` and
`/view?tradition=` exist; compare is descriptive and there is deliberately no person-vs-person
scorecard.

- [ ] **Step 6: Merge**

```bash
git add -A
git commit -m "phase 6: outcome file and CLAUDE.md"
git checkout main
git pull --rebase
git merge --no-ff phase-6-learn-compare -m "phase 6: learn by doctrine, tradition maps, one compare engine"
git push
```

**Never force-push. Never rewrite history. Never merge if Step 1 failed.**

- [ ] **Step 7: Verify the deploy**

```bash
sleep 60
curl -sI https://theologymap-thomas-l-s-projects.vercel.app/learn | head -1
curl -sI https://theologymap-thomas-l-s-projects.vercel.app/compare | head -1
curl -s  https://theologymap-thomas-l-s-projects.vercel.app/content/traditions/manifest.json | head -3
```

---

## Self-review notes for the executing session

- **The highest-value bug in this phase is a silent one**: a doctrine whose `slug` does not
  match between the corpus and a map reads as "unanswered on both sides" and disappears from
  every comparison without an error. `tests/check_tradition_maps.py` plus the self-comparison
  test are what catch it. Do not weaken either.
- If resolution rates are poor — many rows reading `own-wording` on a real member's map — the
  cause is almost always a `position.hold` in the corpus that no longer matches what the wizard
  wrote. Report the rate in the outcome file; do not fix it by loosening the match.
- Compare will be used by people who sit next to each other on a Sunday. If a screen makes one
  of them look wrong, that is a defect, not a finding.
