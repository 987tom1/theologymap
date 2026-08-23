/* build-traditions.test.js — the corpus -> tradition map generator.
 *
 * Fixture note (deviations from phase-6-plan.md Task 1 Step 1, both because the
 * plan's literal fixture does not exist in the real corpus):
 *   - the "divided tradition" case uses `restorationist`, not `anglican`.
 *     Anglican is named by exactly one position on church.baptism, so deleting
 *     its override leaves branch two, not the build error. Restorationist is
 *     genuinely named by two (believer + regeneration).
 *   - `quaker` is in_scorecard: false, so it is built explicitly rather than
 *     via scorecardTraditions().
 */
const assert = require('assert');
const EditorCore = require('../engine/editor-core.js');
const BT = require('../engine/build_traditions.js');

const corpus = BT.loadCorpusSync('content/wizard');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); }
  catch (e) { failed++; console.log('FAIL -', name, '\n   ', e.message); }
}

test('a divided tradition without an override is a build error', () => {
  const broken = BT.loadCorpusSync('content/wizard');
  const baptism = BT.findDoctrine(broken, 'church.baptism');
  delete baptism.tradition_overrides.restorationist;
  assert.throws(() => BT.buildTradition(broken, 'restorationist'),
    /restorationist.*church\.baptism|church\.baptism.*restorationist/i);
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
  assert.ok(out.skipped.length > 0, 'quaker should skip most doctrines');
  assert.strictEqual(out.nodeCount + out.skipped.length, BT.allDoctrines(corpus).length);
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

/* The regenerable-corpus gate, phase 1a's byte-identity rule applied to this
 * phase: building twice from an unchanged corpus must be bit-for-bit equal, so
 * `node engine/build_traditions.js` is safe to re-run after any phase 9
 * correction and its diff shows only what the correction changed. */
test('the build is deterministic — twice from one corpus is byte-identical', () => {
  for (const t of BT.scorecardTraditions(corpus)) {
    const a = BT.buildTradition(corpus, t.id);
    const b = BT.buildTradition(BT.loadCorpusSync('content/wizard'), t.id);
    assert.strictEqual(a.markdown, b.markdown, t.id);
  }
  assert.strictEqual(
    JSON.stringify(BT.buildManifest(corpus)),
    JSON.stringify(BT.buildManifest(BT.loadCorpusSync('content/wizard'))));
});

/* Join on ids, never on wording. Rewording a hold must move the text and
 * nothing else — the same doctrines, the same tiers, the same node count. */
test('rewording a hold does not change which doctrines a tradition holds', () => {
  const reworded = BT.loadCorpusSync('content/wizard');
  for (const d of BT.allDoctrines(reworded))
    for (const p of (d.positions || [])) p.hold = 'Reworded: ' + p.hold;
  const before = BT.buildTradition(corpus, 'reformed');
  const after = BT.buildTradition(reworded, 'reformed');
  assert.strictEqual(after.nodeCount, before.nodeCount);
  assert.deepStrictEqual(after.skipped, before.skipped);
  const slugs = m => EditorCore.parse(m).flatMap(d => d.nodes).map(n => n.slug + ':' + n.tier);
  assert.deepStrictEqual(slugs(after.markdown), slugs(before.markdown));
});

process.exit(failed ? 1 : 0);
