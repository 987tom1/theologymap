/* The generator's gate. Run from the repo root:  node tests/wizard-generate.test.js
 *
 * It reads tests/fixtures/corpus/, NOT content/wizard/ — see that directory's
 * README for why. The generator is a pure function over a schema, so its tests
 * pin the schema; the real corpus is exercised by Task 8's suite.
 */
const assert = require('assert');
const fs = require('fs');
const EditorCore = require('../engine/editor-core.js');
const WG = require('../engine/wizard-generate.js');

const corpus = WG.loadCorpusSync('tests/fixtures/corpus');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); }
  catch (err) { failures++; console.log('FAIL -', name, '\n   ', err.message); }
}

test('tier order puts T1 before T3', () => {
  const ds = WG.orderedDoctrines(corpus);
  assert.ok(ds.length >= 4, 'fixture corpus should have at least four doctrines');
  const rank = t => WG.TIER_ORDER.indexOf(t);
  const tiers = ds.map(d => d.suggested_tier);
  for (let i = 1; i < tiers.length; i++) assert.ok(rank(tiers[i - 1]) <= rank(tiers[i]));
  assert.strictEqual(tiers[0], 'T1');
  assert.strictEqual(tiers[tiers.length - 1], 'T3');
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
  assert.strictEqual(node.confidence, 'confident');
  assert.strictEqual(node.title, 'Baptism');
  assert.strictEqual(domains[0].name, 'Church');
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
    assert.deepStrictEqual(EditorCore.parse(text),
      EditorCore.parse(EditorCore.serialize(EditorCore.parse(text))));
    // _intendedLinks is an in-memory field. If it ever reaches the file, the
    // parser will not understand it and render.py will warn.
    assert.ok(!text.includes('_intended'), '_intendedLinks leaked into the markdown');
    out.push(text);
  }
  fs.mkdirSync('tests/out', { recursive: true });
  out.forEach((t, i) => fs.writeFileSync(`tests/out/prefix-${String(i).padStart(2, '0')}.md`, t));
});

test('the wizard never modifies an existing node', () => {
  const existing = fs.readFileSync('tests/fixtures/partial.md', 'utf8');
  let domains = EditorCore.parse(existing);
  const before = JSON.stringify(domains[0].nodes[0]);
  domains = WG.applyAnswer(domains, corpus, { doctrineId: 'scripture.canon', kind: 'open' });
  assert.strictEqual(JSON.stringify(domains[0].nodes.find(n => n.slug === 'inerrancy')), before);
});

test('a doctrine already in the map is not answered again', () => {
  const existing = fs.readFileSync('tests/fixtures/partial.md', 'utf8');
  let domains = EditorCore.parse(existing);
  const count = domains[0].nodes.length;
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'scripture.inerrancy', kind: 'position',
    positionId: 'scripture.inerrancy/limited' });
  assert.strictEqual(domains[0].nodes.length, count);
  assert.ok(domains[0].nodes[0].hold.startsWith('Scripture is without error'));
});

test('answered doctrines are detected from slugs already in the map', () => {
  const domains = EditorCore.parse(fs.readFileSync('tests/fixtures/partial.md', 'utf8'));
  assert.ok(WG.answeredSlugs(domains).has('inerrancy'));
  assert.notStrictEqual(WG.nextDoctrine(domains, corpus).slug, 'inerrancy');
});

test('an open answer takes the person s own "still working out" text', () => {
  let domains = EditorCore.parse('');
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.baptism', kind: 'open', todo: 'Read Beasley-Murray first.' });
  const n = domains[0].nodes[0];
  assert.strictEqual(n.todo, 'Read Beasley-Murray first.');
  assert.strictEqual(n.confidence, 'open');
  // An omitted todo still falls back to the corpus wording.
  let d2 = WG.applyAnswer(EditorCore.parse(''), corpus,
    { doctrineId: 'church.baptism', kind: 'open' });
  assert.ok(d2[0].nodes[0].todo.length > 20);
});

test('a custom answer builds a node from the person s own fields only', () => {
  let domains = EditorCore.parse('');
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.baptism', kind: 'custom',
    hold: 'My own wording.', why: 'Because.', vs: 'Not that.',
    todo: 'Still reading.', refs: 'Acts 2:38', links: ['the-lords-supper'],
    tier: 'T4', confidence: 'leaning', study: true });
  const n = domains[0].nodes[0];
  assert.strictEqual(n.title, 'Baptism');          // the doctrine supplies the title
  assert.strictEqual(domains[0].name, 'Church');   // ...and the area
  assert.strictEqual(n.hold, 'My own wording.');
  assert.strictEqual(n.why, 'Because.');
  assert.strictEqual(n.vs, 'Not that.');
  assert.strictEqual(n.todo, 'Still reading.');
  assert.strictEqual(n.refs, 'Acts 2:38');
  assert.strictEqual(n.tier, 'T4');
  assert.strictEqual(n.confidence, 'leaning');
  assert.deepStrictEqual(n.flags, ['study']);
  // Never #assumed: the wizard's output is chosen, not inferred.
  assert.ok(!n.flags.includes('assumed'));
  // The person's own Related entries join the doctrine's intended links and
  // are pruned by the same rule as everything else.
  assert.ok(n._intendedLinks.includes('the-lords-supper'));
  WG.pruneLinks(domains);
  assert.deepStrictEqual(n.link, []);
  const text = EditorCore.serialize(domains);
  assert.ok(!text.includes('_intended'), '_intendedLinks leaked into the markdown');
  assert.deepStrictEqual(EditorCore.parse(text),
    EditorCore.parse(EditorCore.serialize(EditorCore.parse(text))));
});

test('a revisit keeps the person s own writing that the answer does not carry', () => {
  // A node written by hand in the editor: its own todo, refs, why and link,
  // none of which the question screen's position answer sends.
  const md = '# Scripture\n\n## Inerrancy \u00b7 T1 \u00b7 certain\n'
    + '  hold  My own hand-written wording.\n'
    + '  why   My own reason.\n'
    + '  todo  My own open question.\n'
    + '  refs  Gen 1:1\n'
    + '  link  some-other-node\n';
  let domains = EditorCore.parse(md);
  const doctrine = WG.findDoctrine(corpus, 'scripture.inerrancy');
  const position = doctrine.positions[0];

  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'scripture.inerrancy', kind: 'position', positionId: position.id,
    hold: position.hold, tier: 'T2', confidence: 'confident', study: false,
    revisit: true });

  const n = domains[0].nodes.find(x => x.slug === 'inerrancy');
  // The answer's own fields land...
  assert.strictEqual(n.hold, position.hold);
  assert.strictEqual(n.tier, 'T2');
  assert.strictEqual(n.confidence, 'confident');
  // ...and everything it does not carry survives.
  assert.strictEqual(n.todo, 'My own open question.');
  assert.strictEqual(n.refs, 'Gen 1:1');
  assert.strictEqual(n.why, 'My own reason.');
  assert.ok(n._intendedLinks.includes('some-other-node'),
    'a hand-written link was dropped on revisit');
  for (const l of doctrine.links || []) assert.ok(n._intendedLinks.includes(l));
  assert.strictEqual(new Set(n._intendedLinks).size, n._intendedLinks.length);
});

test('a revisit still clears a field the answer empties explicitly', () => {
  const md = '# Scripture\n\n## Inerrancy \u00b7 T1 \u00b7 certain\n'
    + '  hold  My own hand-written wording.\n'
    + '  why   My own reason.\n'
    + '  todo  My own open question.\n'
    + '  refs  Gen 1:1\n';
  let domains = EditorCore.parse(md);
  const position = WG.findDoctrine(corpus, 'scripture.inerrancy').positions[0];

  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'scripture.inerrancy', kind: 'position', positionId: position.id,
    why: '', vs: '', todo: '', refs: '', revisit: true });

  const n = domains[0].nodes.find(x => x.slug === 'inerrancy');
  assert.strictEqual(n.why, '');
  assert.strictEqual(n.vs, '');
  assert.strictEqual(n.todo, '');
  assert.strictEqual(n.refs, '');
});

test('domainProgress lists the areas in manifest order with real statuses', () => {
  let domains = EditorCore.parse('');
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.baptism', kind: 'position',
    positionId: 'church.baptism/believer' });
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.lords-supper', kind: 'open' });

  const areas = WG.domainProgress(domains, corpus);
  assert.strictEqual(areas.length, corpus.manifest.domains.length);
  assert.deepStrictEqual(areas.map(a => a.name),
    corpus.manifest.domains.slice().sort((a, b) => a.order - b.order).map(d => d.name));

  const church = areas.find(a => a.id === 'church');
  assert.ok(church.total >= 2);
  assert.strictEqual(church.answered, 2);
  assert.strictEqual(church.doctrines.find(d => d.slug === 'baptism').status, 'answered');
  assert.strictEqual(church.doctrines.find(d => d.slug === 'the-lords-supper').status, 'open');

  // An area with no file published yet reports zero rather than throwing — the
  // launchpad skips those.
  for (const a of areas) {
    assert.strictEqual(a.total, a.doctrines.length);
    assert.ok(a.answered <= a.total);
  }
  const untouched = areas.find(a => a.id === 'scripture');
  assert.ok(untouched.doctrines.every(d => d.status === 'unasked'));
});

test('domainProgress reports ignored doctrines as a third state', () => {
  let domains = EditorCore.parse('');
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.baptism', kind: 'position',
    positionId: 'church.baptism/believer' });

  // No third argument at all is "nothing ignored" — the old behaviour.
  const plain = WG.domainProgress(domains, corpus).find(a => a.id === 'church');
  assert.strictEqual(plain.ignored, 0);
  assert.strictEqual(plain.doctrines.find(d => d.slug === 'the-lords-supper').status, 'unasked');

  // An array and a Set are both accepted.
  for (const ignored of [['the-lords-supper'], new Set(['the-lords-supper'])]) {
    const church = WG.domainProgress(domains, corpus, ignored).find(a => a.id === 'church');
    assert.strictEqual(church.doctrines.find(d => d.slug === 'the-lords-supper').status, 'ignored');
    assert.strictEqual(church.ignored, 1);
    // answered still means nodes present — an ignored one is not answered.
    assert.strictEqual(church.answered, 1);
  }

  // A doctrine with a node wins over the ignored list: it is answered.
  const both = WG.domainProgress(domains, corpus, ['baptism']).find(a => a.id === 'church');
  assert.strictEqual(both.doctrines.find(d => d.slug === 'baptism').status, 'answered');
  assert.strictEqual(both.ignored, 0);
});

test('nextDoctrine skips ignored doctrines', () => {
  const first = WG.nextDoctrine([], corpus);
  assert.ok(first);
  const second = WG.nextDoctrine([], corpus, [first.slug]);
  assert.notStrictEqual(second.slug, first.slug);
  // Ignoring everything exhausts the queue rather than throwing.
  const all = WG.orderedDoctrines(corpus).map(d => d.slug);
  assert.strictEqual(WG.nextDoctrine([], corpus, all), null);
  // No third argument is unchanged.
  assert.strictEqual(WG.nextDoctrine([], corpus).slug, first.slug);
});

test('addManualNode adds a belief the corpus has no question for', () => {
  let domains = EditorCore.parse('');
  domains = WG.addManualNode(domains, corpus, {
    domainId: 'church', title: 'Foot washing', hold: 'A practice, not an ordinance.',
    why: 'John 13 is example, not institution.', vs: 'Treating it as a third sacrament.',
    todo: 'Read the Anabaptists.', refs: 'John 13:14',
    links: ['baptism'], tier: 'T4', confidence: 'leaning', study: true });

  assert.strictEqual(domains.length, 1);
  assert.strictEqual(domains[0].name, 'Church');
  const n = domains[0].nodes[0];
  assert.strictEqual(n.title, 'Foot washing');
  assert.strictEqual(n.slug, EditorCore.slugify('Foot washing'));
  assert.strictEqual(n.hold, 'A practice, not an ordinance.');
  assert.strictEqual(n.why, 'John 13 is example, not institution.');
  assert.strictEqual(n.vs, 'Treating it as a third sacrament.');
  assert.strictEqual(n.todo, 'Read the Anabaptists.');
  assert.strictEqual(n.refs, 'John 13:14');
  assert.strictEqual(n.tier, 'T4');
  assert.strictEqual(n.confidence, 'leaning');
  assert.deepStrictEqual(n.flags, ['study']);
  assert.ok(!n.flags.includes('assumed'));

  // An unresolvable intended link is pruned; adding its target revives it.
  WG.pruneLinks(domains);
  assert.deepStrictEqual(n.link, []);
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.baptism', kind: 'position',
    positionId: 'church.baptism/believer' });
  WG.pruneLinks(domains);
  assert.deepStrictEqual(n.link, ['baptism']);

  const text = EditorCore.serialize(domains);
  assert.ok(!text.includes('_intended'), '_intendedLinks leaked into the markdown');
  assert.deepStrictEqual(EditorCore.parse(text),
    EditorCore.parse(EditorCore.serialize(EditorCore.parse(text))));
  // ...and it survives a round trip through the file format.
  const back = EditorCore.parse(text)[0].nodes.find(x => x.slug === 'foot-washing');
  assert.strictEqual(back.hold, 'A practice, not an ordinance.');
  assert.strictEqual(back.tier, 'T4');
  assert.deepStrictEqual(back.link, ['baptism']);
});

test('addManualNode refuses an empty title or a slug already in the map', () => {
  let domains = EditorCore.parse('');
  assert.strictEqual(WG.addManualNode(domains, corpus, { domainId: 'church', title: '   ' }), domains);
  assert.strictEqual(domains.length, 0);
  domains = WG.applyAnswer(domains, corpus, {
    doctrineId: 'church.baptism', kind: 'position',
    positionId: 'church.baptism/believer' });
  const count = domains[0].nodes.length;
  WG.addManualNode(domains, corpus, { domainId: 'church', title: 'Baptism', hold: 'Mine.' });
  assert.strictEqual(domains[0].nodes.length, count);
  assert.ok(domains[0].nodes[0].hold.length > 10);
});

/* ------------------------------------------------------------ the real corpus
 *
 * Everything above runs against tests/fixtures/corpus/, which pins the SCHEMA
 * and must not move when phase 5 adds content. What follows runs against
 * content/wizard/ as actually shipped, because the fixture cannot tell anyone
 * whether the seed itself generates a map render.py will accept. Session 9's
 * version of the first test asserted zero doctrines; Task 6 is what turned it
 * positive, and updating it is how this session knew Task 6 had landed. */

const real = WG.loadCorpusSync('content/wizard');

test('the real corpus loads, and every domain file on disk is in it', () => {
  assert.strictEqual(real.manifest.domains.length, 14);
  assert.strictEqual(real.traditions.traditions.length, 14);
  // Phase 4 pinned this to its three seed domains and a doctrine count of 12.
  // Phase 5's whole job is to grow past that, so the assertion is derived from
  // the corpus rather than frozen: every manifest domain whose file exists on
  // disk must load, and no other. loadCorpusSync tolerates a missing file, and
  // a manifest entry with no file is the normal state until phase 5 finishes.
  const onDisk = real.manifest.domains
    .filter(d => fs.existsSync(`content/wizard/${d.file}`))
    .map(d => d.id).sort();
  assert.deepStrictEqual(Object.keys(real.domains).sort(), onDisk);
  const counted = onDisk.reduce((n, id) => n + real.domains[id].doctrines.length, 0);
  assert.strictEqual(WG.orderedDoctrines(real).length, counted);
  assert.ok(counted >= 12, 'the corpus never shrinks below phase 4 s seed');
  assert.ok(WG.nextDoctrine([], real), 'an empty map has a first question');
});

test('the seed sorts T1 first and every doctrine has a distinct slug', () => {
  const ds = WG.orderedDoctrines(real);
  const rank = t => WG.TIER_ORDER.indexOf(t);
  for (let i = 1; i < ds.length; i++) {
    assert.ok(rank(ds[i - 1].suggested_tier) <= rank(ds[i].suggested_tier),
      'wizard order is not tier-ascending');
  }
  assert.strictEqual(new Set(ds.map(d => d.slug)).size, ds.length);
  // slug must equal EditorCore's own slugify, or a link silently breaks.
  for (const d of ds) assert.strictEqual(d.slug, EditorCore.slugify(d.node_title));
});

test('answering the whole seed corpus gives a map at every prefix', () => {
  const all = WG.orderedDoctrines(real);
  let domains = EditorCore.parse('');
  const out = [];
  for (const d of all) {
    // The open answer on every third doctrine, so the prefixes exercise both
    // branches of applyAnswer against real content rather than only positions.
    const kind = out.length % 3 === 2 ? 'open' : 'position';
    domains = WG.applyAnswer(domains, real, {
      doctrineId: d.id, kind,
      positionId: kind === 'position' ? d.positions[0].id : undefined });
    WG.pruneLinks(domains);
    const text = EditorCore.serialize(domains);
    assert.deepStrictEqual(EditorCore.parse(text),
      EditorCore.parse(EditorCore.serialize(EditorCore.parse(text))));
    assert.ok(!text.includes('_intended'), '_intendedLinks leaked into the markdown');
    out.push(text);
  }
  assert.strictEqual(out.length, WG.orderedDoctrines(real).length);
  // Named prefix-* so tests/check_generated_map.py picks them up with the
  // fixture ones and runs render.py's parser over both.
  fs.mkdirSync('tests/out', { recursive: true });
  out.forEach((t, i) => fs.writeFileSync(`tests/out/prefix-real-${String(i).padStart(2, '0')}.md`, t));
});

test('the seed never puts a tradition in two positions without an override', () => {
  // The validator owns this rule (rule 15) over the whole corpus. Asserting it
  // here too is deliberate: the generator is what would silently pick one of
  // the two, and this is the test that fails when it does.
  for (const d of WG.orderedDoctrines(real)) {
    const seen = {};
    for (const p of d.positions || []) {
      for (const h of p.held_by || []) (seen[h.tradition] = seen[h.tradition] || []).push(p.id);
    }
    for (const [t, ids] of Object.entries(seen)) {
      if (ids.length > 1) {
        assert.ok((d.tradition_overrides || {})[t],
          `${d.id}: ${t} holds ${ids.length} positions with no tradition_overrides entry`);
      }
    }
  }
});

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
