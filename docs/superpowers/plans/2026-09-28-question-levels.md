# Question Levels (Light / Medium / Heavy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person building a map in `/wizard` choose Light (25 questions), Medium (55) or Heavy (all 86), changeable at any time, without ever hiding a question they have already answered.

**Architecture:** The level lists and one pure filter, `WG.levelCorpus(corpus, level, domains)`, live in `engine/wizard-generate.js`, so plain Node can test them. `web/wizard.js` sends its *ordering and progress* reads (`order`, `nextDoctrine`, `domainProgress`) through that filtered view. Everything that *writes* an answer keeps the full `corpus`. The level is stored per browser under `localStorage['tmm.wizard.level']`, next to the tradition preference. A native `<select class="wz-level">` appears on the intro, the launchpad and the question screen.

**Tech Stack:** Vanilla ES modules and UMD (`wizard-generate.js`), `node --test`, standard library only (no dependencies, CLAUDE.md §1).

**Spec:** Thomas's request, 2026-09-28, with the answers he gave. Levels are **areas, cumulative**: Light is 4 areas (≤25), Medium adds 6 areas (≤55 total), Heavy is all 14 (86). Answered questions always stay visible. The switch lives on the intro, the launchpad **and** the question screen. On first opening the intro, one very short sentence recommends starting on Light.

## Global Constraints

- No corpus change: nothing writes `content/wizard/*.json` (CLAUDE.md §3). The level lists are a constant in `engine/wizard-generate.js`.
- No renderer change: `render_markdown`'s byte-identity pair must not move (CLAUDE.md §1). Do not touch `engine/render.py`.
- `localStorage` access is wrapped in try/catch, the same way `LENS_KEY` is (CLAUDE.md §7, "Ignore for now"). This is a preference, not content.
- User-facing copy says **belief** and **area**, never "node" or "domain" (CLAUDE.md §4).
- Import paths stay absolute; no new files under `web/`.
- Run commands with `py`, never `python`.

## Review Focus

1. **Existing member with answers and no stored level:** they must see no change, so the default is `heavy` whenever the map has any answered slug. Pinned in Task 2 Step 3 (`initialLevel`).
2. **Switching Heavy→Light while on a Medium-only unanswered question:** the question leaves `order`, so the screen must move to the next Light question, not crash on `order[-1]`. Handled by `onLevelChange` in Task 2.
3. **An answered out-of-level question:** it stays in `order`, the area list and the counts. Pinned in the Task 1 test.
4. **`/wizard?doctrine=<id>` for a doctrine outside the level** (the link `/learn` and `/compare` produce): it must still open that question. Task 2 falls back to the full order for that visit only, without persisting the change.
5. **A typo in a level id** would silently shrink a level. The Task 1 test asserts that every id exists in the real corpus and that the counts are exactly 25 and 55.

---

### Task 1: Level lists and `levelCorpus` in the generator

**Files:**
- Modify: `engine/wizard-generate.js` (add the constants before `domainProgress` at ~line 129; add both names to the export list at ~line 357)
- Test: `tests/wizard-generate.test.js` (append)

**Interfaces:**
- Produces: `WG.LEVELS`, an object `{ light: Set<doctrineId>, medium: Set<doctrineId> }`. Heavy has no entry, and a missing entry means "everything".
- Produces: `WG.levelCorpus(corpus, level, domains) → corpus`, a shallow copy with the same shape (`{manifest, traditions, domains}`) whose `domains[id].doctrines` keeps only doctrines whose `id` is in the level **or** whose `slug` is already answered in `domains`. For `'heavy'` or any unknown level it returns `corpus` itself.

- [ ] **Step 1: Write the failing test.** Append to `tests/wizard-generate.test.js`:

```js
test('levels: every id exists, light 25, medium 55 and a superset, heavy is everything', () => {
  const real = WG.loadCorpusSync('content/wizard');
  const ids = new Set(WG.orderedDoctrines(real).map(d => d.id));
  for (const lv of ['light', 'medium']) {
    for (const id of WG.LEVELS[lv]) assert.ok(ids.has(id), lv + ' names unknown doctrine ' + id);
  }
  assert.strictEqual(WG.LEVELS.light.size, 25);
  assert.strictEqual(WG.LEVELS.medium.size, 55);
  for (const id of WG.LEVELS.light) assert.ok(WG.LEVELS.medium.has(id), 'medium lacks ' + id);
  const none = EditorCore.parse('');
  assert.strictEqual(WG.orderedDoctrines(WG.levelCorpus(real, 'light', none)).length, 25);
  assert.strictEqual(WG.orderedDoctrines(WG.levelCorpus(real, 'medium', none)).length, 55);
  assert.strictEqual(WG.levelCorpus(real, 'heavy', none), real);
});

test('levels: an answered question outside the level stays visible', () => {
  const real = WG.loadCorpusSync('content/wizard');
  const rapture = WG.findDoctrine(real, 'last-things.rapture');   // heavy-only
  assert.ok(!WG.LEVELS.medium.has(rapture.id));
  const domains = EditorCore.parse('# Last things\n\n## ' + rapture.node_title + ' · T4 · open\n');
  const slugs = WG.orderedDoctrines(WG.levelCorpus(real, 'light', domains)).map(d => d.slug);
  assert.ok(slugs.includes(rapture.slug), 'answered heavy-only doctrine was hidden');
  assert.strictEqual(slugs.length, 26);
});
```

- [ ] **Step 2: Run it and confirm it fails.**
Run: `node tests/wizard-generate.test.js`
Expected: FAIL, `Cannot read properties of undefined (reading 'light')`.
If the second test fails on the slug instead, check that `EditorCore.parse` slugifies `node_title` into `rapture.slug`. If it does not, build the heading from the title that `slugify` maps to `rapture.slug`.

- [ ] **Step 3: Implement.** In `engine/wizard-generate.js`, just above the `domainProgress` comment block:

```js
  /* Question levels (Thomas, 2026-09-28): areas, cumulative. Light is four
   * areas (Scripture, God, Christ, Salvation) less two technical questions;
   * Medium adds six areas less their most specialist questions; Heavy is
   * everything and has no entry. Hard-coded ids, not a corpus field, so the
   * corpus files stay untouched — tests/wizard-generate.test.js pins every id
   * against the real corpus. */
  const LIGHT = [
    'scripture.inerrancy', 'scripture.canon', 'scripture.sufficiency', 'scripture.clarity',
    'scripture.hermeneutic-method', 'scripture.translations',
    'god.trinity', 'god.eternal-generation', 'god.classical-theism', 'god.time',
    'god.open-theism', 'god.divine-foreknowledge',
    'christ.deity-and-humanity', 'christ.virgin-birth', 'christ.bodily-resurrection',
    'christ.impeccability', 'christ.atonement', 'christ.extent-of-the-atonement',
    'salvation.sovereignty-and-free-will', 'salvation.election', 'salvation.perseverance-and-apostasy',
    'salvation.assurance', 'salvation.lordship-salvation', 'salvation.justification',
    'salvation.regeneration-and-baptism',
  ];
  const MEDIUM = LIGHT.concat([
    'god.efs-ess', 'christ.divine-power',
    'holy-spirit.baptism-in-the-holy-spirit', 'holy-spirit.continuationism', 'holy-spirit.prophecy',
    'holy-spirit.tongues', 'holy-spirit.healing',
    'humanity-and-sin.image-of-god', 'humanity-and-sin.historical-adam', 'humanity-and-sin.original-sin',
    'humanity-and-sin.depravity-and-prevenient-grace', 'humanity-and-sin.age-of-accountability',
    'church.women-in-ministry', 'church.church-government', 'church.baptism', 'church.lords-supper',
    'last-things.second-coming', 'last-things.millennium', 'last-things.israel-and-the-church',
    'last-things.intermediate-state', 'last-things.hell', 'last-things.new-creation',
    'ethics.marriage-and-sexuality', 'ethics.divorce-and-remarriage', 'ethics.abortion',
    'ethics.prosperity-teaching', 'ethics.war-and-violence',
    'missions-and-world-religions.exclusivity-of-christ', 'missions-and-world-religions.the-unevangelised',
    'missions-and-world-religions.world-religions',
  ]);
  const LEVELS = { light: new Set(LIGHT), medium: new Set(MEDIUM) };

  /* The corpus as one level sees it. A doctrine whose slug is already on the
   * map always stays: a level narrows what is asked, never what was answered. */
  function levelCorpus(corpus, level, domains) {
    const keep = LEVELS[level];
    if (!keep) return corpus;
    const answered = answeredSlugs(domains || []);
    const out = {};
    for (const [id, file] of Object.entries(corpus.domains || {})) {
      out[id] = Object.assign({}, file, {
        doctrines: (file.doctrines || []).filter(d => keep.has(d.id) || answered.has(d.slug)),
      });
    }
    return Object.assign({}, corpus, { domains: out });
  }
```

Heavy-only (the ten medium-area questions left out): dichotomy-vs-trichotomy, sealing-of-the-spirit, church.membership, rapture, ivf-and-embryos, euthanasia, alcohol, church-and-the-public-square, contextualisation, israel-and-judaism.

Then add `LEVELS, levelCorpus,` to the returned export object at ~line 357.

- [ ] **Step 4: Run it and confirm it passes.**
Run: `node tests/wizard-generate.test.js`
Expected: every test passes, including both new ones.

- [ ] **Step 5: Commit.**

```bash
git add engine/wizard-generate.js tests/wizard-generate.test.js
git commit -m "wizard: Light/Medium/Heavy question levels in the generator"
```

---

### Task 2: Wire the level into `/wizard`

**Files:**
- Modify: `web/wizard.js`: state (~line 33 and ~line 62), `renderAreas` (~916), `renderArea` (~955), `startQuestions` (~1309), `ignoreCurrent` (~1325), `main` (~1352, ~1370, ~1395)
- Modify: `web/wizard.html`: intro (~line 441), `#home-lensrow` (~527), question screen before `.wz-nav` (~502)
- Modify: `CLAUDE.md` §7 "Behaviour that is silent and deliberate", plus one line in `documentation/changelog.md`

**Interfaces:**
- Consumes: `WG.levelCorpus(corpus, level, domains)` and `WG.LEVELS` from Task 1.

- [ ] **Step 1: Markup.** Put this select in three places. Its options are identical each time:

```html
<select class="wz-level" aria-label="Question set">
  <option value="light">Light</option>
  <option value="medium">Medium</option>
  <option value="heavy">Heavy</option>
</select>
```

  - Intro: directly after the `.wz-lead` div, add
    `<p class="tm-quiet"><label>Questions: SELECT</label> Start on Light; switch to Medium or Heavy any time.</p>`
    Replace SELECT with the select above.
  - Launchpad: inside `#home-lensrow`, after its `.tm-quiet` span, add `<label class="tm-quiet">Questions: SELECT</label>`.
  - Question screen: directly before `<div class="wz-nav">`, add `<label class="tm-quiet">Questions: SELECT</label>`.

  The intro sentence already reads `<span id="intro-count">`, which will now show the level's count.

- [ ] **Step 2: State.** In `web/wizard.js`, add this line below `const IGNORE_KEY …`:

```js
/* Light / Medium / Heavy (WG.LEVELS). A preference like the lens: this browser only. */
const LEVEL_KEY = 'tmm.wizard.level';
```

  Add `let level = 'heavy';` beside `let lens = null;`, and change `order`'s comment to `// WG.orderedDoctrines of the level's view`.

- [ ] **Step 3: Helpers.** Add these just above `function startQuestions()`:

```js
function view() { return WG.levelCorpus(corpus, level, domains); }

// A member who already has answers and no stored level keeps the full set
// they had before levels existed; a first-timer starts on Light.
function initialLevel() {
  let stored = null;
  try { stored = localStorage.getItem(LEVEL_KEY); } catch { /* private mode */ }
  if (stored === 'light' || stored === 'medium' || stored === 'heavy') return stored;
  return WG.answeredSlugs(domains).size ? 'heavy' : 'light';
}

function applyLevel(v) {
  level = v;
  try { localStorage.setItem(LEVEL_KEY, v); } catch { /* private mode */ }
  order = WG.orderedDoctrines(view());
  $('intro-count').textContent = String(order.length);
  for (const s of document.querySelectorAll('.wz-level')) s.value = v;
}

// The question on screen stays if the new level still holds it; otherwise
// move to the level's next question (or the launchpad when none is left).
function onLevelChange(v) {
  const cur = $('screen-question').hidden ? null : order[idx];
  applyLevel(v);
  if (cur) {
    const i = orderIndexOf(cur);
    if (i >= 0) {
      idx = i;
      $('wz-crumb').textContent =
        WG.domainName(corpus, cur) + ' · question ' + (idx + 1) + ' of ' + order.length;
    } else startQuestions();
  } else if (!$('screen-home').hidden) renderHome();
}
```

  The crumb line is copied verbatim from `renderQuestionUnsafe`. Re-rendering the question instead would throw away an unsaved selection.

- [ ] **Step 4: Route the reads through `view()`.** Replace `corpus` with `view()` in exactly these four calls, and nowhere else. Every other `corpus` use is a write path or a lookup, and those need the full corpus.
  - `renderAreas`: `WG.domainProgress(domains, view(), ignored)`
  - `renderArea`: `WG.domainProgress(domains, view(), ignored)`
  - `startQuestions`: `WG.nextDoctrine(domains, view(), ignored)`
  - `ignoreCurrent`: `WG.nextDoctrine(domains, view(), ignored)`

- [ ] **Step 5: `main()`.**
  - Delete `order = WG.orderedDoctrines(corpus);` and the `intro-count` line from inside the `try`. `order` now depends on `domains`, which is not loaded until after them.
  - After `clearSkel(skelHost);`, add:

```js
  applyLevel(initialLevel());
  for (const s of document.querySelectorAll('.wz-level')) s.onchange = () => onLevelChange(s.value);
```

  - In the `?doctrine=` block, replace the lookup with:

```js
    let at = order.findIndex(d => d.id === wanted);
    // ponytail: a link from /learn or /compare to a question outside the level
    // widens this visit's order to the full set, unpersisted; the selects keep
    // showing the stored level until the person changes it.
    if (at < 0 && WG.findDoctrine(corpus, wanted)) {
      order = WG.orderedDoctrines(corpus);
      at = order.findIndex(d => d.id === wanted);
    }
    if (at >= 0) { renderQuestion(at); return; }
```

- [ ] **Step 6: Gate.**

```
node --test tests/*.test.js
py tests/syntax_check.py
py engine/validate_content.py
py tests/check_generated_map.py
```

  Expected: all green, and `git status` shows no change to `theology-map.html`.

- [ ] **Step 7: Check the behaviour in Node.** This follows debug.md rules 21 and 22. Run:

```
node -e "const WG=require('./engine/wizard-generate.js'),C=require('./engine/editor-core.js');const c=WG.loadCorpusSync('content/wizard');const v=WG.levelCorpus(c,'light',C.parse(''));console.log(WG.domainProgress([],v,[]).filter(a=>a.total).map(a=>a.name+' '+a.total).join(' | '));console.log(WG.nextDoctrine([],v,[]).id)"
```

  Expected: `Scripture 6 | God 6 | Christ 6 | Salvation 7`, then a T1 id such as `scripture.inerrancy`.

- [ ] **Step 8: Docs.**
  - In CLAUDE.md §7 "Behaviour that is silent and deliberate", add one bullet: **Question levels** (`WG.LEVELS`, `localStorage['tmm.wizard.level']`). They narrow what is asked, never what was answered (`levelCorpus` keeps answered slugs). A member with answers and no stored level defaults to Heavy. A `?doctrine=` link outside the level widens that visit only. Changing the ids is a code change pinned by `tests/wizard-generate.test.js`, not a corpus edit.
  - Add one dated line to `documentation/changelog.md`.

- [ ] **Step 9: Commit and push.** Thomas's standing rule is that Project 12 goes straight to main.

```bash
git add web/wizard.js web/wizard.html CLAUDE.md documentation/changelog.md
git commit -m "wizard: Light/Medium/Heavy switch on intro, launchpad and question screen"
git push origin main
```

  After the push, grep the served `/web/wizard.js` for `tmm.wizard.level` to confirm the deploy (debug.md rule 1).
