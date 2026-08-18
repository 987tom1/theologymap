# Phase 4 — implementation plan: the map wizard

> **For the session executing this:** this is one phase on one branch, `phase-4-wizard`.
> Every section is written to be pasted in cold with no memory of any other session. Steps
> use checkbox (`- [ ]`) syntax so progress is trackable. Use
> `superpowers:subagent-driven-development` and push the mechanical tasks to Sonnet subagents
> in parallel where the plan says so.

**Goal:** a guided, data-driven question flow at `/wizard` that turns twelve seeded doctrines
of real content into a valid `theology-map.md` for the signed-in user, through the existing
serializer, with "Finish here" working at every step.

**Architecture:** JSON content files in `content/wizard/`, served statically. A pure
generator (`engine/wizard-generate.js`) turns corpus + answers into a node model; the
existing `engine/editor-core.js` serializes it; phase 1c's `/api/map` saves it. The UI
(`web/wizard.html` + `web/wizard.js`) is a thin controller. No serverless function is added.

**Tech stack:** vanilla browser JS, no bundler, no CDN imports, UMD modules that also run
under Node; Python 3.11 standard library for the validator; Vercel static hosting.

**Spec:** `docs/hosting/phase-4-design.md`. **Read it alongside this plan** — the plan argues
from it and does not repeat its reasoning. §4 of that document is the content schema and is
normative.

**Locked decisions:** `docs/hosting/decisions.md`. Thomas's calls, already made. They
override the briefs and this plan. Do not re-open them and do not ask — he is away.

---

## Global constraints

Every task's requirements implicitly include all of these.

1. **One parser, one serializer.** The wizard builds a node model and calls
   `EditorCore.serialize`. It never concatenates markdown. `engine/editor-core.js` and
   `engine/map-view.js` are **not modified and not forked**.
2. **The local workflow must keep working, unmodified and offline.** `start_editor.bat` →
   `engine/render_server.py` → `engine/editor.html`, editing `theology-map.md` on disk. The
   wizard is additive and hosted-only.
3. **No LLM call at wizard runtime.** Data-driven form. Every sentence it can emit is in the
   repo.
4. **Never write verse text from memory.** `refs` are references only; text comes from
   `py engine/fetch_verses.py` against the NET Bible API.
5. **Voice: first person or neutral, never second person.** See design §4.7; the validator
   enforces the mechanical half.
6. **No tradition is caricatured.** Every position is one its own adherents would sign.
7. **Nothing appears in a map that the person did not choose.** The tradition lens orders and
   annotates; it never pre-fills.
8. **"I don't know" is a first-class answer**, never a skip: `confidence: open` + `#study`.
9. **Four views, not five.** `#thread` no longer exists. Do no thread work.
10. **`requirements.txt` stays empty.** Standard library only.
11. **`theology-map.md` at the repo root is Thomas's personal copy.** The wizard never writes
    to it. Test fixtures go in `tests/fixtures/`.
12. **Generated files are never hand-edited**: `theology-map.html`,
    `documentation/theology-map.mm`, `documentation/study-list.md`.
13. **The interpreter is `py`, not `python`.** Bare `python` hits a Microsoft Store stub.
14. **No browser automation, ever.** Verify by running code and reading responses.
15. **The repo is public.** No secrets.
16. **Merging beats waiting.** Merge to `main` when this phase's own verification passes.
    **Never force-push, never rewrite history, never merge on failed verification.**

## Environment facts a cold session needs

- Repo: `C:\Users\ThomasPC\Desktop\AIProjects\Project 12 - Theology Mind Map`, public at
  `github.com/987tom1/theologymap`.
- Production URL `https://theologymap-thomas-l-s-projects.vercel.app/` returns 200
  unauthenticated (verified 2026-08-18). Deployment protection is off.
- **Python 3.11.9 is reachable only as `py`.** Node v24.19.0 is present.
- Post-phase-0.5 baseline: 99 nodes across 14 domains.

## File structure this phase produces

| Path | Responsibility | Task |
|---|---|---|
| `content/wizard/manifest.json` | domain list, order, schema version | 2 |
| `content/wizard/traditions.json` | the full tradition registry | 2 |
| `content/wizard/scripture.json` | six seeded doctrines | 6 |
| `content/wizard/church.json` | six seeded doctrines | 6 |
| `engine/validate_content.py` | the corpus's quality gate; phase 5 lives on it | 3 |
| `engine/wizard-generate.js` | **pure**: corpus + answers → node model; UMD | 4 |
| `engine/corpus_refs.py` | corpus `refs` → `verses.md` stubs, via `render.py` | 7 |
| `web/wizard.html` | the wizard page markup and CSS | 5 |
| `web/wizard.js` | UI controller: screens, state, fetch, save | 5 |
| `vercel.json` | **modified** — `/wizard` rewrite | 5 |
| `tests/fixtures/*.md` | scratch maps for tests; never the real one | 4 |
| `tests/wizard-generate.test.js` | Node test for the generator | 4 |
| `tests/check_generated_map.py` | parses generated markdown with `render.py` | 4 |
| `docs/hosting/phase-4-outcome.md` | handover | 8 |
| `CLAUDE.md` | **modified** — the corpus and the wizard | 8 |

---

# Task 0: Branch, preconditions, and the design canvas

`decisions.md`: *UI phases open with a published design canvas of the key screens before
building, so Thomas can review on a phone while away.*

**Files:** none yet.

- [ ] **Step 1: Branch**

```bash
git checkout main
git pull --rebase
git checkout -b phase-4-wizard
```

- [ ] **Step 2: Verify the preconditions**

```bash
py -c "import sys; print(sys.version)"          # expect 3.11.9
node --version                                   # expect v24.x
py engine/render.py                              # expect zero warnings
git log --oneline -5
curl -sI https://theologymap-thomas-l-s-projects.vercel.app/ | head -1   # expect 200
```

If `py engine/render.py` warns, stop and fix that first — this phase's verification depends
on a clean baseline.

- [ ] **Step 3: Confirm phase 1c's save path exists**

Read `api/map.py` and `engine/storage-hosted.js`. Confirm the POST body shape
(`{user_id, markdown, expected_updated_at}`) and the 409 response. If phase 1c has not
merged, **stop** — the wizard has nowhere to save.

- [ ] **Step 4: Publish the design canvas**

Use the `design` skill. Five artboards, drawn from design §5.3: the opening screen, the
tradition-lens screen, a question screen with four positions (use Baptism — it is the richest),
the same screen with "Word it my way" open and "Who believes what?" expanded, and the finish
screen. Hand Thomas the URL in the outcome file and in the final report.

- [ ] **Step 5: Commit the branch point**

```bash
git commit --allow-empty -m "phase 4: branch open, design canvas published"
```

---

# Task 1: The tests' scaffolding

**Files:**
- Create: `tests/README.md`, `tests/fixtures/empty.md`, `tests/fixtures/partial.md`

**Interfaces:**
- Produces: fixture paths used by Tasks 3, 4 and 8.

- [ ] **Step 1: Create the fixtures directory and an empty-map fixture**

`tests/fixtures/empty.md` is a zero-byte file. `tests/fixtures/partial.md`:

```
# Scripture

## Inerrancy · T1 · certain
  hold  Scripture is without error in all that it affirms, including what it affirms about history and the created order.
  refs  2 Tim 3:16-17; John 10:35
```

- [ ] **Step 2: `tests/README.md`**

```markdown
# tests/

Run everything from the repo root.

    node tests/wizard-generate.test.js
    py tests/check_generated_map.py
    py engine/validate_content.py

Fixtures are scratch maps. `theology-map.md` at the repo root is Thomas's own map
and is never read or written by a test.
```

- [ ] **Step 3: Commit**

```bash
git add tests/
git commit -m "phase 4: test scaffolding and map fixtures"
```

---

# Task 2: The manifest and the tradition registry

**Files:**
- Create: `content/wizard/manifest.json`, `content/wizard/traditions.json`

**Interfaces:**
- Produces: the two files every later task reads. Shapes are normative in design §4.2 and §4.3.

- [ ] **Step 1: Write `manifest.json` with all fourteen domains**

Names must match the `#` headings in `theology-map.md` exactly. Get them with:

```bash
grep '^# ' theology-map.md
```

Ids are the slugified names. `order` is file order, 1..14. `file` is `<id>.json` for all
fourteen even though only two exist in this phase — Task 3's validator only checks files that
exist plus warns on the missing ones, so phase 5 adds files without editing the manifest.

- [ ] **Step 2: Write `traditions.json`**

Eleven `in_ui: true` entries in this order (`order` 1..11): non-denominational,
pentecostal, baptist, anglican, reformed, roman-catholic, orthodox, lutheran, methodist,
anabaptist, restorationist. Non-denominational and Pentecostal first — that is Thomas's
centre of gravity and the reader whose recognition matters most.

Plus `in_ui: false` display-only entries needed by the seed's outside/contested positions:
`quaker`, `oneness-pentecostal`. All eleven UI traditions get `in_scorecard: true` and a
non-null `map` object; the display-only ones get `in_scorecard: false` and `map: null`.

Every entry needs a real `blurb` its adherents would accept, and real
`confessional_sources`. Use design §4.3's worked entries as the pattern.

- [ ] **Step 3: Sanity-check the JSON parses**

```bash
py -c "import json;d=json.load(open('content/wizard/manifest.json'));print(len(d['domains']))"
py -c "import json;d=json.load(open('content/wizard/traditions.json'));print(len(d['traditions']))"
```

Expected: `14` and `13`.

- [ ] **Step 4: Commit**

```bash
git add content/wizard/manifest.json content/wizard/traditions.json
git commit -m "phase 4: content manifest and tradition registry"
```

---

# Task 3: The validator

Written **before** the content, so the seed is written against a working gate. This is the
tool phase 5 depends on most.

**Files:**
- Create: `engine/validate_content.py`

**Interfaces:**
- Produces: `py engine/validate_content.py` → exit 0 clean, exit 1 on any error. Also
  importable: `validate(root: Path) -> tuple[list[str], list[str]]` returning
  `(errors, warnings)`.

- [ ] **Step 1: Write the failing test**

Create `tests/fixtures/bad-corpus/manifest.json` and `bad-corpus/scripture.json` containing
one doctrine with three deliberate faults: a `slug` that does not match its `node_title`, a
`held_by.tradition` of `"calvinist"` (not in the registry), and the word "you" in its
`framing`. Then:

```python
# tests/test_validate_content.py
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "engine"))
from validate_content import validate

def main():
    errors, warnings = validate(pathlib.Path("tests/fixtures/bad-corpus"))
    joined = " | ".join(errors)
    assert any("slug" in e for e in errors), joined
    assert any("calvinist" in e for e in errors), joined
    assert any("second person" in e for e in errors), joined
    assert len(errors) >= 3, joined
    print("OK", len(errors), "errors,", len(warnings), "warnings")

main()
```

- [ ] **Step 2: Run it and watch it fail**

```bash
py tests/test_validate_content.py
```

Expected: `ModuleNotFoundError: No module named 'validate_content'`.

- [ ] **Step 3: Implement `engine/validate_content.py`**

Standard library only. Structure:

```python
#!/usr/bin/env python3
"""Validate the wizard content corpus against the phase-4 schema.

Spec: docs/hosting/phase-4-design.md section 4. Run:  py engine/validate_content.py
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TIERS = {"T1", "T1.5", "T2", "T2.5", "T3", "T4"}
CONFIDENCES = {"certain", "confident", "leaning", "open", "rejected"}
ORTHODOXY = {"historic", "contested", "outside"}
STANCES = {"confessional", "majority", "permitted", "minority", "historic"}
SECOND_PERSON = re.compile(r"\b(you|your|yours|yourself)\b", re.I)
FIRST_PERSON = re.compile(r"\b(i|my|we|our)\b", re.I)

def slugify(text):
    t = (text or "").lower().replace("&", "and")
    t = re.sub(r"['\u2019]", "", t)
    t = re.sub(r"[^a-z0-9]+", "-", t)
    return t.strip("-")

def validate(root):
    errors, warnings = [], []
    # ... implement every numbered rule from design section 4.10, appending
    #     "<file>: <doctrine id>: <message>" strings to errors or warnings.
    return errors, warnings

def main():
    errors, warnings = validate(ROOT / "content" / "wizard")
    for w in warnings: print("WARN ", w)
    for e in errors:   print("ERROR", e)
    print(f"{len(errors)} errors, {len(warnings)} warnings")
    if not errors:
        print_coverage_matrix(ROOT / "content" / "wizard")
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
```

`slugify` must match `editor-core.js`'s exactly — lowercase, `&`→`and`, apostrophes and
right single quotes dropped, every other non-alphanumeric run to a hyphen, trimmed.

Implement **all twenty error rules and all four warnings** from design §4.10. The messages
must name the file, the doctrine id and the field, because phase 5 reads them without reading
this code. Rule 15 (the ambiguity rule) must name both the doctrine and the tradition and say
"add a tradition_overrides entry".

`print_coverage_matrix` prints doctrines down, `in_scorecard` traditions across, cells
`Y` / `!` / `-`.

- [ ] **Step 4: Run the test until it passes**

```bash
py tests/test_validate_content.py
```

Expected: `OK 3 errors, ...` or more.

- [ ] **Step 5: Run it against the real (still empty) corpus**

```bash
py engine/validate_content.py
```

Expected at this point: warnings about the twelve missing domain files, zero errors.

- [ ] **Step 6: Commit**

```bash
git add engine/validate_content.py tests/test_validate_content.py tests/fixtures/bad-corpus
git commit -m "phase 4: content validator with the full schema rule set"
```

**Subagent note:** the twenty rules are mechanical once the file skeleton exists. Dispatch two
Sonnet subagents — rules 1–10 and rules 11–20 plus the matrix — against the same skeleton, then
merge. The test in step 1 gates both.

---

# Task 4: The generator

**Files:**
- Create: `engine/wizard-generate.js`, `tests/wizard-generate.test.js`,
  `tests/check_generated_map.py`

**Interfaces:**
- Consumes: `EditorCore` from `engine/editor-core.js` (`parse`, `serialize`, `newNode`,
  `slugify`) — unmodified.
- Produces, as `WizardGenerate`:
  - `orderedDoctrines(corpus) -> [doctrine]` — tier order, then domain order, then doctrine order.
  - `applyAnswer(domains, corpus, answer) -> domains` — mutates and returns the model.
  - `pruneLinks(domains) -> domains` — recomputes `link` from `_intendedLinks` ∩ present slugs.
  - `answeredSlugs(domains) -> Set<string>`.
  - `nextDoctrine(domains, corpus) -> doctrine | null`.
  - Answer shape:
    `{ doctrineId, kind: "position"|"open", positionId?, hold?, tier?, confidence?, study?: bool }`

- [ ] **Step 1: Write the failing test**

```js
// tests/wizard-generate.test.js
const assert = require('assert');
const fs = require('fs');
const EditorCore = require('../engine/editor-core.js');
const WG = require('../engine/wizard-generate.js');

const corpus = WG.loadCorpusSync('content/wizard');   // {manifest, traditions, domains:{id:file}}

function test(name, fn) { fn(); console.log('ok -', name); }

test('tier order puts T1 before T3', () => {
  const ds = WG.orderedDoctrines(corpus);
  const tiers = ds.map(d => d.suggested_tier);
  const rank = t => ['T1','T1.5','T2','T2.5','T3','T4'].indexOf(t);
  for (let i = 1; i < tiers.length; i++) assert.ok(rank(tiers[i-1]) <= rank(tiers[i]));
});

test('a chosen position generates the corpus hold verbatim', () => {
  let domains = EditorCore.parse('');
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.baptism', kind: 'position',
    positionId: 'church.baptism/believer', tier: 'T3', confidence: 'confident'
  });
  const node = domains[0].nodes[0];
  const pos = WG.findPosition(corpus, 'church.baptism/believer');
  assert.strictEqual(node.hold, pos.hold);
  assert.strictEqual(node.tier, 'T3');
  assert.strictEqual(node.title, 'Baptism');
});

test('the open answer is a real node, not a gap', () => {
  let domains = EditorCore.parse('');
  domains = WG.applyAnswer(domains, corpus, { doctrineId: 'church.baptism', kind: 'open' });
  const n = domains[0].nodes[0];
  assert.strictEqual(n.confidence, 'open');
  assert.ok(n.flags.includes('study'));
  assert.strictEqual(n.hold, 'Undecided.');
  assert.ok(n.todo.length > 20);
});

test('links are pruned to slugs present in the map', () => {
  let domains = EditorCore.parse('');
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.baptism', kind: 'position', positionId: 'church.baptism/believer' });
  WG.pruneLinks(domains);
  assert.deepStrictEqual(domains[0].nodes[0].link, []);
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.lords-supper', kind: 'open' });
  WG.pruneLinks(domains);
  const baptism = domains[0].nodes.find(n => n.slug === 'baptism');
  assert.deepStrictEqual(baptism.link, ['the-lords-supper']);
});

test('every prefix of the answer sequence serializes and re-parses identically', () => {
  const all = WG.orderedDoctrines(corpus);
  let domains = EditorCore.parse('');
  const out = [];
  for (const d of all) {
    domains = WG.applyAnswer(domains, corpus, {
      doctrineId: d.id, kind: 'position', positionId: d.positions[0].id });
    WG.pruneLinks(domains);
    const text = EditorCore.serialize(domains);
    assert.deepStrictEqual(EditorCore.parse(text), EditorCore.parse(EditorCore.serialize(EditorCore.parse(text))));
    out.push(text);
  }
  fs.mkdirSync('tests/out', { recursive: true });
  out.forEach((t, i) => fs.writeFileSync(`tests/out/prefix-${String(i).padStart(2,'0')}.md`, t));
});

test('the wizard never modifies an existing node', () => {
  const existing = fs.readFileSync('tests/fixtures/partial.md', 'utf8');
  let domains = EditorCore.parse(existing);
  const before = JSON.stringify(domains[0].nodes[0]);
  domains = WG.applyAnswer(domains, corpus, { doctrineId: 'scripture.canon', kind: 'open' });
  assert.strictEqual(JSON.stringify(domains[0].nodes.find(n => n.slug === 'inerrancy')), before);
});

test('answered doctrines are detected from slugs already in the map', () => {
  const domains = EditorCore.parse(fs.readFileSync('tests/fixtures/partial.md', 'utf8'));
  assert.ok(WG.answeredSlugs(domains).has('inerrancy'));
  assert.notStrictEqual(WG.nextDoctrine(domains, corpus).slug, 'inerrancy');
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node tests/wizard-generate.test.js
```

Expected: `Cannot find module '../engine/wizard-generate.js'`.

- [ ] **Step 3: Implement `engine/wizard-generate.js`**

UMD wrapper identical in shape to `editor-core.js`'s, so the same file works in the browser
(`window.WizardGenerate`) and under Node. It must:

- `loadCorpusSync(dir)` — Node-only convenience using `fs`, guarded by
  `typeof require !== 'undefined'`, so the browser bundle never touches it. The browser passes
  a corpus object it fetched itself.
- Never import the DOM. Never fetch. Never call `EditorCore.serialize` — the caller does that.
- `applyAnswer`: find or create the domain section by the manifest `name`; if a node with the
  doctrine's slug already exists **and this answer did not come from an explicit revisit**,
  return unchanged; otherwise build the node with `EditorCore.newNode(node_title, domainName)`
  and set fields per design §4.9; store `node._intendedLinks = doctrine.links || []`; insert in
  tier order within the domain (T1 down to T4, untiered last).
- `pruneLinks`: collect all slugs, then for each node set
  `node.link = (node._intendedLinks || node.link || []).filter(s => slugs.has(s))`.
- Never write `_intendedLinks` anywhere that gets serialized — `editor-core.js`'s
  `serializeNode` only reads known fields, so an underscore-prefixed property is inert. Assert
  that in the test by grepping the serialized text for `_intended`.

- [ ] **Step 4: Run until green**

```bash
node tests/wizard-generate.test.js
```

Expected: seven `ok -` lines.

- [ ] **Step 5: Write the Python-side check**

```python
# tests/check_generated_map.py
"""Parse every generated prefix map with render.py's own parser: zero warnings required."""
import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import render

fails = 0
for path in sorted((ROOT / "tests" / "out").glob("prefix-*.md")):
    nodes = render.parse_text(path.read_text(encoding="utf-8"))
    slugs = {n["slug"] for n in nodes}
    for n in nodes:
        for target in n.get("link", []):
            if target not in slugs:
                print(f"BROKEN LINK {path.name}: {n['slug']} -> {target}")
                fails += 1
    if not nodes:
        print(f"EMPTY {path.name}")
        fails += 1
print(f"{len(list((ROOT/'tests'/'out').glob('prefix-*.md')))} prefix maps checked, {fails} problems")
sys.exit(1 if fails else 0)
```

`render.parse_text` exists from phase 1a. If it does not, phase 1a has not merged — stop.

- [ ] **Step 6: Run it**

```bash
py tests/check_generated_map.py
```

Expected: `12 prefix maps checked, 0 problems`.

- [ ] **Step 7: Commit**

```bash
git add engine/wizard-generate.js tests/wizard-generate.test.js tests/check_generated_map.py
git commit -m "phase 4: pure wizard generator with prefix and link-pruning tests"
```

---

# Task 5: The wizard UI

**Files:**
- Create: `web/wizard.html`, `web/wizard.js`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `WizardGenerate` (Task 4), `EditorCore`, `web/session.js` (`getUser`, `apiFetch`).
- Produces: the `/wizard` route.

- [ ] **Step 1: Add the rewrite**

In `vercel.json`, alongside phase 1's rewrites:

```json
{ "source": "/wizard", "destination": "/web/wizard.html" }
```

- [ ] **Step 2: Build `web/wizard.html`**

Markup and CSS only, following phase 3's design language: warm paper-and-ink palette in both
themes, serif for content and sans for chrome, prose capped at 58ch, the existing tier colour
ramp. Do **not** reintroduce traffic-light tier colours. Sections, all present in the DOM and
toggled by the controller: `#screen-intro`, `#screen-lens`, `#screen-question`,
`#screen-finish`. The question screen contains, in order: a header strip (domain, "question N
of M", lens picker, **Finish here**), `h1` for the question, a `p` for the framing, a
`#positions` container, the emphasised open-answer card, the "Who believes what?" `<details>`,
and back/next.

Load scripts in this order, all same-origin, no CDN:

```html
<script src="/web/session.js"></script>
<script src="/engine/editor-core.js"></script>
<script src="/engine/wizard-generate.js"></script>
<script src="/web/wizard.js"></script>
```

- [ ] **Step 3: Build `web/wizard.js`**

Responsibilities, and nothing else:

1. Redirect to `/app` when `getUser()` is null.
2. Fetch `content/wizard/manifest.json`, `traditions.json`, and every listed domain file that
   returns 200 (a 404 for a phase-5 file that does not exist yet is skipped silently, with one
   `console.info`). Assemble the corpus object `WizardGenerate` expects.
3. `GET /api/map?user_id=` → `EditorCore.parse(markdown)` → the working model; keep
   `updated_at` as the concurrency token.
4. Screen state machine per design §5.3. The lens is read from and written to
   `localStorage['tmm.wizard.tradition']`.
5. Render a question: positions ordered by (lens holds it first), then corpus order, with
   `orthodoxy: "outside"` always last regardless of lens. Chips from `held_by` via
   `short_name`, max four then `+n more`. Cards show `position.hold` **verbatim**.
6. On choosing: reveal tier and confidence controls pre-filled from
   `position.tier ?? doctrine.suggested_tier` and `position.confidence_default`, each with its
   in-place explanation and the `tier_note`.
7. "Word it my way" → textarea pre-filled with `position.hold`; the edited text becomes
   `answer.hold`.
8. "Who believes what?" → the full `held_by` list with stances rendered in plain English via
   this exact map, which lives in one constant:

```js
const STANCE_TEXT = {
  confessional: 'defined in its confessions',
  majority:     'the majority view in practice',
  permitted:    'one of several views its formularies allow',
  minority:     'a minority stream within it',
  historic:     'held historically, less common now',
};
```

9. Save after every answer:
   `WizardGenerate.applyAnswer` → `WizardGenerate.pruneLinks` → `EditorCore.serialize` →
   `POST /api/map {user_id, markdown, expected_updated_at}`. On 409: re-GET, re-parse,
   re-apply this one answer, retry **once**; on a second 409 stop and show
   *this map was changed somewhere else — reload to carry on*. Never force-save.
10. **"Finish here" on every screen**: save, then go to `/edit`. No confirmation dialog, no
    warning, no guilt.
11. The finish screen's counts come from the model, not from a counter: node count, tier
    spread, `#study` count, doctrines remaining.

**Copy that is load-bearing — use these words:**

- Lens screen: *"This changes the order positions are shown in, and labels who holds what. It never fills anything in — every answer below is mine."*
- Open answer card title: *"I haven't worked this out yet"*, subtitle *"This becomes a real entry: confidence 'open', flagged for study, with a note of what is left to settle."*
- Edit affordance: *"Word it my way"*, helper *"My map, my words — the wording above is a starting point."*
- Outside-orthodoxy banner: *"Outside the historic creeds"* then the `orthodoxy_note` verbatim.
- Finish screen: *"Every entry here is mine to edit, and editing is expected."*

**Never** use "you" or "your" anywhere in the UI copy.

- [ ] **Step 4: Verify the page loads and the flow works without a browser**

No browser automation. Verify by reasoning over code plus these mechanical checks:

```bash
node -e "new (require('vm').Script)(require('fs').readFileSync('web/wizard.js','utf8'))" && echo "wizard.js parses"
grep -niE '\byou\b|\byour\b|\byours\b' web/wizard.js web/wizard.html && echo "SECOND PERSON FOUND — fix" || echo "voice ok"
grep -c 'Finish here' web/wizard.html
```

The last must be at least 1, and the finish control must be in the persistent header rather
than per-screen markup.

- [ ] **Step 5: Commit**

```bash
git add web/wizard.html web/wizard.js vercel.json
git commit -m "phase 4: wizard UI, one question per screen, finish-here everywhere"
```

**Subagent note:** step 2 (markup and CSS) and step 3 (controller) are separable once the
element ids above are fixed. Dispatch two Sonnet subagents in parallel, giving each the id
list and the copy block verbatim.

---

# Task 6: The seed content

**Files:**
- Create: `content/wizard/scripture.json`, `content/wizard/church.json`

**Interfaces:**
- Consumes: the schema in design §4, the registry from Task 2, the validator from Task 3.
- Produces: twelve doctrines the generator and the UI run against.

**Standard:** phase 5's, not a placeholder standard. Real confessional citations, every
position one its adherents would sign, `refs` that are the texts actually argued over
including those the other side leans on. Design §4.8 is the worked example and the bar.

- [ ] **Step 1: `church.json`**

Six doctrines: Baptism, The Lord's Supper, Church government, Women in ministry, Church
membership, Spiritual gifts today. **Copy design §4.8's Baptism entry verbatim** as the first
one — it is already written to standard, and copying it guarantees the seed exercises
`tradition_overrides`, `equivalence_group`, a `contested` marker and a cross-domain link.

The others must between them include: at least one more tradition holding two positions (women
in ministry — Anglican and Methodist), at least one position with an empty `held_by`, and one
`orthodoxy: "outside"` position if the domain honestly has one (cessationism/continuationism
does not; do not invent one).

- [ ] **Step 2: `scripture.json`**

Six doctrines: Inerrancy, Canon, Sufficiency of Scripture, Clarity of Scripture, Hermeneutic
method, Translations. Canon is `kind: "settled"` for the creedal core with the
Catholic/Orthodox canon differences as real positions — that is a genuine choice, so read
design §4.4's `kind` definition carefully before deciding which it is. Inerrancy is written in
full in design §4.4 and §4.8's position example; reuse it.

`node_title` values must match the existing map's titles exactly where they overlap
(`Inerrancy`, `Canon`, `Sufficiency of Scripture`, `Clarity of Scripture`,
`Hermeneutic method`, `Translations`) so that Thomas's map and a wizard map compare cleanly.
Confirm with:

```bash
grep '^## ' theology-map.md | head -10
```

- [ ] **Step 3: Validate**

```bash
py engine/validate_content.py
```

Expected: `0 errors`, warnings only for the twelve missing domain files. Fix every error;
do not suppress a rule.

- [ ] **Step 4: Re-run the generator tests against the real seed**

```bash
node tests/wizard-generate.test.js
py tests/check_generated_map.py
```

- [ ] **Step 5: Commit**

```bash
git add content/wizard/scripture.json content/wizard/church.json
git commit -m "phase 4: seed corpus, Scripture and Church, twelve doctrines"
```

**Subagent note:** two Sonnet subagents, one per domain file, each given design §3, §4 and
§4.8 and the tradition registry. They return filled JSON, not research notes. The main thread
checks every position against "would an adherent sign this" — that judgment does not go to a
subagent.

---

# Task 7: Corpus references reach `verses.md`

**Files:**
- Create: `engine/corpus_refs.py`

- [ ] **Step 1: Implement**

```python
#!/usr/bin/env python3
"""Append verses.md stubs for every scripture reference in the wizard corpus.

The corpus lives outside theology-map.md, so render.py's own reference sync never
sees it. This reuses render.py's sync rather than reimplementing it.

    py engine/corpus_refs.py      # then: py engine/fetch_verses.py
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import render

def corpus_refs(dirpath):
    refs = []
    manifest = json.loads((dirpath / "manifest.json").read_text(encoding="utf-8"))
    for entry in manifest["domains"]:
        path = dirpath / entry["file"]
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for doctrine in data["doctrines"]:
            for raw in [doctrine.get("refs")] + [p.get("refs") for p in doctrine["positions"]]:
                for part in (raw or "").split(";"):
                    part = part.strip()
                    if part:
                        refs.append(part)
    seen, out = set(), []
    for r in refs:
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out

def main():
    refs = corpus_refs(ROOT / "content" / "wizard")
    print(f"{len(refs)} distinct references in the corpus")
    render.sync_verses(refs)      # append-only; never overwrites existing text
    print("verses.md synced — now run: py engine/fetch_verses.py")

if __name__ == "__main__":
    main()
```

**Check `render.sync_verses`'s real signature before writing this** — read `engine/render.py`
around its definition. If it takes a different argument shape, adapt the call; do **not**
reimplement the appending logic.

- [ ] **Step 2: Run it, then fetch**

```bash
py engine/corpus_refs.py
py engine/fetch_verses.py
```

- [ ] **Step 3: Check for blanks**

```bash
py engine/render.py | tail -5
```

Any reference still lacking text after fetching is **a bad reference, not a network problem**
— usually versification, since the NET follows the critical text. Check Psalms, 2 Corinthians
and Malachi first. Fix the reference in the corpus, re-run, and record any correction in the
outcome file.

- [ ] **Step 4: Commit**

```bash
git add engine/corpus_refs.py documentation/verses.md
git commit -m "phase 4: corpus scripture references synced and fetched"
```

---

# Task 8: Verification, documentation, merge

- [ ] **Step 1: The full verification suite**

```bash
py engine/validate_content.py            # 0 errors
node tests/wizard-generate.test.js       # all ok
py tests/check_generated_map.py          # 0 problems
py tests/test_validate_content.py        # OK
py engine/render.py                      # zero warnings; Thomas's map still renders
git diff --stat theology-map.html        # expect NO diff — the wizard must not change his map
```

The last line matters: if `theology-map.html` changed, something touched `theology-map.md` or
the renderer. Investigate before merging.

- [ ] **Step 2: Abandonment check, explicitly**

Design §5.6 requires a valid map at every prefix. `tests/out/prefix-*.md` are those maps and
Step 1 already parsed them. Additionally render one by hand end to end:

```bash
cp tests/out/prefix-05.md /tmp/x.md 2>/dev/null || cp tests/out/prefix-05.md tests/out/x.md
py -c "import sys;sys.path.insert(0,'engine');import render;print(len(render.parse_text(open('tests/out/prefix-05.md',encoding='utf-8').read())),'nodes parsed')"
```

- [ ] **Step 3: Write `docs/hosting/phase-4-outcome.md`**

It must contain, because phase 5 and phase 6 read it:

- **A pointer, in the first paragraph, to `docs/hosting/phase-4-design.md` §4 as the schema of
  record.** Do not restate the schema; a second copy will drift.
- The design canvas URL from Task 0.
- What the seed covers and what it does not.
- The exact commands phase 5 runs: `py engine/validate_content.py`, `py engine/corpus_refs.py`,
  `py engine/fetch_verses.py`, `node tests/wizard-generate.test.js`.
- The coverage matrix the validator printed.
- Any place the schema already felt wrong while writing twelve real doctrines — **the most
  valuable thing this file can carry**, because it is cheaper to change the schema now than
  after ninety-nine entries exist.
- "Decisions I made for you" for anything uncovered by design §7.
- Design §8's Questions for Thomas, repeated so he finds them in one place.

- [ ] **Step 4: Update `CLAUDE.md`**

Add to Project 12's `CLAUDE.md`: `content/wizard/` and what it is, the wizard route, the rule
that `content/traditions/` (phase 6) is generated, `engine/wizard-generate.js` as a third UMD
module in the lockstep family, and the standing instruction that the corpus is validated with
`py engine/validate_content.py`.

- [ ] **Step 5: Merge**

```bash
git add -A
git commit -m "phase 4: outcome file and CLAUDE.md"
git checkout main
git pull --rebase
git merge --no-ff phase-4-wizard -m "phase 4: map wizard, content schema and seed corpus"
git push
```

**Never force-push. Never rewrite history. Never merge if Step 1 failed** — if it failed,
stop and write down precisely why in the outcome file.

- [ ] **Step 6: Verify the deploy**

```bash
sleep 60
curl -sI https://theologymap-thomas-l-s-projects.vercel.app/wizard | head -1
curl -s  https://theologymap-thomas-l-s-projects.vercel.app/content/wizard/manifest.json | head -3
```

Expect 200 and JSON. A 404 on the content path means Vercel is not serving `content/`
statically — fix by adding it to `vercel.json`'s rewrites or by confirming there is no
`.vercelignore` excluding it. Do not work around it by moving content into `web/` without
noting it in the outcome file, since phase 6 fetches the same paths.

---

## Self-review notes for the executing session

- If the schema turns out to be wrong while writing Task 6's real content, **say so loudly in
  the outcome file and fix the schema now**, before phase 5 fills ninety-nine entries against
  it. Changing it later is the single most expensive mistake available in this program.
- If phase 3's design language or shared header differs from what Task 5 assumes, follow phase
  3 and note the difference. Phase 3 owns the chrome.
- The wizard is the first thing a stranger from Thomas's church will use. If a screen feels
  like an exam rather than a conversation, that is a real defect — record it even if you
  cannot fix it in this phase.
