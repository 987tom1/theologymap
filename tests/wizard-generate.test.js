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

test('the real corpus loads, and carries no doctrines until Task 6', () => {
  // Not a fixture: this is content/wizard as actually shipped. It proves the
  // manifest and registry parse and that loadCorpusSync tolerates the twelve
  // domain files phase 5 has not written yet. Task 6 turns the count positive.
  const real = WG.loadCorpusSync('content/wizard');
  assert.strictEqual(real.manifest.domains.length, 14);
  assert.strictEqual(real.traditions.traditions.length, 14);
  assert.strictEqual(WG.orderedDoctrines(real).length, 0);
  assert.strictEqual(WG.nextDoctrine([], real), null);
});

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
