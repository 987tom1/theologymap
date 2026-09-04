// tests/compare-core.test.js
const assert = require('assert');
const EditorCore = require('../engine/editor-core.js');
const BT = require('../engine/build_traditions.js');
const CC = require('../engine/compare-core.js');
const WG = require('../engine/wizard-generate.js');

const corpus = BT.loadCorpusSync('content/wizard');
const traditionMaps = {};
for (const t of BT.scorecardTraditions(corpus))
  traditionMaps[t.id] = EditorCore.parse(BT.buildTradition(corpus, t.id).markdown);

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    failed++;
    console.log('FAIL -', name);
    console.log('   ', e.message);
  }
}

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
  const others = CC.positionsInGroup(corpus, 'church.baptism', a.equivalence_group).filter(p => p.id !== a.id);
  if (others.length === 0) { console.log('  (no equivalence pair in corpus — skipped)'); return; }
  const mine   = EditorCore.parse(`# Church\n\n## Baptism · T3 · confident\n  hold  ${a.hold}\n`);
  const theirs = EditorCore.parse(`# Church\n\n## Baptism · T3 · confident\n  hold  ${others[0].hold}\n`);
  assert.strictEqual(CC.diff(corpus, mine, theirs).find(r => r.doctrine.slug === 'baptism').verdict, 'agree-in-substance');
});

// Correction 2: church.baptism/believer's group 'credobaptism' has no
// partner in the corpus, so the assertion above always skips. This corpus
// really does have two pairs sharing a group, so assert one of them for real.
test('a real equivalence pair in the corpus agrees in substance', () => {
  const pairs = [
    { doctrineId: 'scripture.sufficiency', doctrineSlug: 'sufficiency-of-scripture', domain: 'Scripture', header: 'Sufficiency of Scripture', group: 'sola-scriptura' },
    { doctrineId: 'scripture.hermeneutic-method', doctrineSlug: 'hermeneutic-method', domain: 'Scripture', header: 'Hermeneutic method', group: 'grammatical-historical' },
  ];
  let checked = false;
  for (const pair of pairs) {
    const members = CC.positionsInGroup(corpus, pair.doctrineId, pair.group);
    if (members.length < 2) continue;
    const [a, b] = members;
    const mine   = EditorCore.parse(`# ${pair.domain}\n\n## ${pair.header} · T1 · confident\n  hold  ${a.hold}\n`);
    const theirs = EditorCore.parse(`# ${pair.domain}\n\n## ${pair.header} · T1 · confident\n  hold  ${b.hold}\n`);
    const row = CC.diff(corpus, mine, theirs).find(r => r.doctrine.slug === pair.doctrineSlug);
    assert.strictEqual(row.verdict, 'agree-in-substance', `${pair.group}: ${row && row.verdict}`);
    checked = true;
  }
  assert.ok(checked, 'expected at least one real equivalence-group pair in the corpus');
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

// Correction 3: the corpus is regenerable input (phase 9 rewords positions).
// A reworded `hold` must not orphan a map that still carries the old text —
// superseded_holds is how a correction avoids silently turning every
// existing map's answer into "own-wording".
test('superseded wording still resolves to the position, not to own-wording', () => {
  const original = CC.findPosition(corpus, 'church.baptism/infant-covenant');
  const oldHold = original.hold;
  const newHold = 'REWORDED: ' + oldHold;

  // A deep-enough copy of the corpus with just this one position reworded,
  // its old wording pushed into superseded_holds.
  const fakeCorpus = JSON.parse(JSON.stringify(corpus));
  for (const domain of Object.values(fakeCorpus.domains)) {
    for (const doctrine of domain.doctrines || []) {
      for (const position of doctrine.positions || []) {
        if (position.id === 'church.baptism/infant-covenant') {
          position.hold = newHold;
          position.superseded_holds = [oldHold];
        }
      }
    }
  }

  // One map still carries the pre-reword text (an old save); one carries
  // the new text. They must still agree, not fall through to own-wording.
  const oldMap = EditorCore.parse(`# Church\n\n## Baptism · T3 · confident\n  hold  ${oldHold}\n`);
  const newMap = EditorCore.parse(`# Church\n\n## Baptism · T3 · confident\n  hold  ${newHold}\n`);
  const row = CC.diff(fakeCorpus, oldMap, newMap).find(r => r.doctrine.slug === 'baptism');
  assert.strictEqual(row.verdict, 'agree', row.verdict);
  assert.strictEqual(row.mine.kind, 'position');
});

/* normalise IS the no-fuzzy-matching rule, so it gets a direct test rather
 * than being covered only through diff(). Found by mutation: replacing the
 * trailing-full-stop strip with a strip-all-punctuation rule passed every
 * other test in this file, because no two corpus holds differ by punctuation
 * alone. The rule has to be pinned where it lives. */
test('normalise strips exactly four things and nothing else', () => {
  assert.strictEqual(CC.normalise('  Two   spaces.  '), 'two spaces');
  assert.strictEqual(CC.normalise('One dot..'), 'one dot.');      // ONE, not all
  assert.strictEqual(CC.normalise('"quoted"'), 'quoted');
  // Everything below must survive: stripping any of it is fuzzy matching,
  // and a near-match must resolve to own-wording, not to a wrong position.
  for (const s of ['a, b', 'a; b', "God's", 'a — b', 'a: b', 'a-b', '(a) b'])
    assert.strictEqual(CC.normalise(s), s.toLowerCase(), s);
});

/* Two traditions whose overrides span the same positions are not disagreeing.
 * Anglican and Lutheran both span infant-covenant and regeneration on baptism;
 * reporting "differ" there would be a difference the corpus never claims. */
test('overlapping overrides from two traditions agree in substance', () => {
  const row = CC.diff(corpus, traditionMaps.anglican, traditionMaps.lutheran)
                .find(r => r.doctrine.slug === 'baptism');
  assert.strictEqual(row.verdict, 'agree-in-substance', row.verdict);
});

/* tierDiff is the only thing in this file that reads `tier`. diff() ignores it
 * entirely, so nothing else here would fail if tierDiff silently stopped
 * reporting — hence a direct test.
 * NL/MID are just newline and the middot separator, kept out of the string
 * literals so this stays readable. */
const NL = String.fromCharCode(10);
const MID = String.fromCharCode(183);
/* The domain heading has to be the doctrine's REAL domain name: findNode
   matches on domain name first and slug second, so a map filed under the
   wrong heading resolves to nothing at all — which is what the first draft of
   this test did, and it passed the "nothing moved" assertion for entirely the
   wrong reason. */
function oneNodeMap(doctrine, tier) {
  return EditorCore.parse(
    ['# ' + WG.domainName(corpus, doctrine), '',
     '## ' + doctrine.node_title + ' ' + MID + ' ' + tier + ' ' + MID + ' confident',
     '  hold  Anything at all.', ''].join(NL));
}

test('tierDiff reports only doctrines whose tier moved, with the direction', () => {
  const doctrine = BT.allDoctrines(corpus).find(d => d.suggested_tier === 'T3');
  assert.ok(doctrine, 'corpus has a T3 doctrine to move');

  // Sitting at the SUGGESTED tier: nothing moved, nothing reported.
  assert.strictEqual(
    CC.tierDiff(corpus, oneNodeMap(doctrine, doctrine.suggested_tier), {}).length, 0);

  // Pulled up to T1: exactly one row, more central.
  const rows = CC.tierDiff(corpus, oneNodeMap(doctrine, 'T1'), {});
  assert.strictEqual(rows.length, 1, 'one moved tier, got ' + rows.length);
  assert.strictEqual(rows[0].doctrine.id, doctrine.id);
  assert.strictEqual(rows[0].mineTier, 'T1');
  assert.strictEqual(rows[0].suggestedTier, doctrine.suggested_tier);
  assert.strictEqual(rows[0].direction, 'more-central');

  // Pushed down to T4: less central.
  assert.strictEqual(
    CC.tierDiff(corpus, oneNodeMap(doctrine, 'T4'), {})[0].direction, 'less-central');
});

/* The baseline is the CORPUS suggestion, never the other side. Otherwise
 * "tiered differently" silently becomes "tiered differently from whoever is
 * being compared against", which is a different and much weaker claim. */
test('tierDiff measures against the corpus, not against the other side', () => {
  const rows = CC.tierDiff(corpus, traditionMaps.reformed, traditionMaps.baptist);
  for (const r of rows) {
    assert.notStrictEqual(r.mineTier, r.suggestedTier);
    assert.strictEqual(r.doctrine.suggested_tier, r.suggestedTier);
  }
});

process.exit(failed ? 1 : 0);
