/* build_traditions.js — the corpus in content/wizard/ -> one read-only
 * theology-map.md per tradition in content/traditions/.
 *
 * Node, not Python, because engine/editor-core.js holds this project's ONLY
 * serializer and the house rule is one parser, one serializer, one renderer.
 * A Python builder would be a second serializer. Spec: phase-6-design.md 2.2.
 *
 * THE OUTPUT IS GENERATED. Never hand-edit content/traditions/*.md — the same
 * rule as theology-map.html. A correction goes into content/wizard/ and the
 * maps are rebuilt.
 *
 * The corpus is REGENERABLE INPUT, not a one-time import. Phase 9 corrects
 * corpus entries after phase 6 ships, so this build is deterministic and
 * idempotent: `node engine/build_traditions.js` on an unchanged corpus writes
 * byte-identical files and leaves `git diff` empty. That is why the manifest
 * records a hash of its inputs rather than a build timestamp — a clock in a
 * generated file would make every rebuild a diff and hide the real change.
 * Gated by tests/build-traditions.test.js.
 *
 * Everything here joins on doctrine.id, position.id and tradition.id, which
 * phase 4's schema promises are stable forever. Nothing joins on wording.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EditorCore = require('./editor-core.js');
const WG = require('./wizard-generate.js');

const OUT_DIR = path.join(__dirname, '..', 'content', 'traditions');
const CORPUS_DIR = path.join(__dirname, '..', 'content', 'wizard');

/* phase-4-design.md 4.4's table, restated in phase-6-design.md 2.2 step 2. */
const STANCE_CONFIDENCE = {
  confessional: 'certain',
  majority: 'confident',
  permitted: 'leaning',
  minority: 'leaning',
  historic: 'leaning',
};

function stanceConfidence(stance) {
  return STANCE_CONFIDENCE[stance] || 'leaning';
}

function scorecardTraditions(corpus) {
  return ((corpus.traditions || {}).traditions || [])
    .filter(t => t.in_scorecard)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function findTradition(corpus, id) {
  return ((corpus.traditions || {}).traditions || []).find(t => t.id === id) || null;
}

/* Corpus order: domain by manifest.order, then the doctrine's own order.
 * Deliberately NOT wizard order (which is tier-first) — a map file reads by
 * domain, and step 3 sorts within a domain by tier afterwards. */
function corpusOrderedDoctrines(corpus) {
  const rank = id => {
    const e = ((corpus.manifest || {}).domains || []).find(d => d.id === id);
    return e ? e.order : 999;
  };
  return WG.allDoctrines(corpus)
    .map((d, i) => ({ d, i }))
    .sort((a, b) => rank(a.d.domain) - rank(b.d.domain) ||
                    (a.d.order || 0) - (b.d.order || 0) ||
                    a.i - b.i)
    .map(e => e.d);
}

/* phase-6-design.md 2.2 step 1, all four branches. Branch three throws: a
 * tradition named by two positions with no tradition_overrides entry is a
 * corpus bug (validator rule 15), and generating either half of it would put
 * a position in a tradition's mouth that it does not hold alone. */
function resolve(doctrine, traditionId) {
  const override = (doctrine.tradition_overrides || {})[traditionId];
  if (override) return { kind: 'override', override };

  const held = (doctrine.positions || []).filter(p =>
    (p.held_by || []).some(h => h.tradition === traditionId));

  if (held.length === 1) {
    const entry = (held[0].held_by || []).find(h => h.tradition === traditionId);
    return { kind: 'position', position: held[0], stance: entry.stance };
  }
  if (held.length > 1) {
    throw new Error(
      traditionId + ' is named by ' + held.length + ' positions on ' + doctrine.id +
      ' (' + held.map(p => p.id).join(', ') + ') with no override — ' +
      'add a tradition_overrides entry for ' + traditionId + ' to ' + doctrine.id);
  }
  return { kind: 'skip' };
}

function nodeFor(corpus, doctrine, res) {
  const node = EditorCore.newNode(doctrine.node_title, WG.domainName(corpus, doctrine));
  const src = res.kind === 'override' ? res.override : res.position;

  node.tier = src.tier || doctrine.suggested_tier || null;
  node.confidence = res.kind === 'override'
    ? (res.override.confidence || 'leaning')
    : stanceConfidence(res.stance);
  node.hold = src.hold || '';
  node.why = src.why || '';
  node.vs = src.vs || '';
  node.todo = '';                                   // a tradition has no homework
  node.refs = (res.kind === 'override' ? null : res.position.refs) || doctrine.refs || '';
  node.flags = (src.flags || []).slice();
  node._intendedLinks = (doctrine.links || []).slice();
  node.link = [];
  return node;
}

/* -> { markdown, nodeCount, skipped[] } */
function buildTradition(corpus, traditionId) {
  const byDomain = new Map();       // domain name -> nodes, in manifest order
  const skipped = [];

  for (const doctrine of corpusOrderedDoctrines(corpus)) {
    const res = resolve(doctrine, traditionId);
    if (res.kind === 'skip') { skipped.push(doctrine.id); continue; }
    const name = WG.domainName(corpus, doctrine);
    if (!byDomain.has(name)) byDomain.set(name, []);
    byDomain.get(name).push(nodeFor(corpus, doctrine, res));
  }

  // Step 3: tier order within a domain, matching the map's own convention.
  // Array.prototype.sort is stable, so equal tiers keep corpus order.
  const domains = [...byDomain.entries()].map(function (entry) {
    return {
      name: entry[0],
      nodes: entry[1].slice().sort((a, b) => WG.tierRank(a.tier) - WG.tierRank(b.tier)),
    };
  });

  WG.pruneLinks(domains);           // step 4, the same rule as phase 4 5.6

  return {
    markdown: EditorCore.serialize(domains),
    nodeCount: domains.reduce((n, d) => n + d.nodes.length, 0),
    skipped: skipped,
  };
}

/* A hash of the inputs, so the manifest states which corpus a map was built
 * from without putting a clock in a generated file. */
function corpusHash(dir) {
  const h = crypto.createHash('sha256');
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
    h.update(name);
    h.update(fs.readFileSync(path.join(dir, name)));
  }
  return h.digest('hex');
}

/* built: optional Map of tradition id -> buildTradition() result. main()
 * passes the builds it already did (F8: one build per tradition, not two) —
 * a caller with no builds on hand (tests, other scripts) may omit it and
 * buildManifest builds each tradition itself, as before. */
function buildManifest(corpus, hash, built) {
  return {
    schema_version: 1,
    corpus_schema_version: (corpus.manifest || {}).schema_version || null,
    corpus_sha256: hash || null,
    traditions: scorecardTraditions(corpus).map(function (t) {
      const out = (built && built.get(t.id)) || buildTradition(corpus, t.id);
      return {
        id: t.id,
        display_name: t.display_name,
        short_name: t.short_name,
        file: t.id + '.md',
        node_count: out.nodeCount,
        skipped: out.skipped,
      };
    }),
  };
}

function main() {
  const corpus = WG.loadCorpusSync(CORPUS_DIR);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let nodes = 0, maps = 0;
  const built = new Map();

  for (const t of scorecardTraditions(corpus)) {
    const out = buildTradition(corpus, t.id);          // throws on branch three
    built.set(t.id, out);
    fs.writeFileSync(path.join(OUT_DIR, t.id + '.md'), out.markdown, 'utf8');
    nodes += out.nodeCount; maps++;
    console.log(t.id.padEnd(20) + String(out.nodeCount).padStart(3) +
                ' nodes, ' + out.skipped.length + ' skipped');
  }

  const manifest = buildManifest(corpus, corpusHash(CORPUS_DIR), built);
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(maps + ' tradition maps, ' + nodes + ' nodes, corpus ' +
              manifest.corpus_sha256.slice(0, 12));
}

module.exports = {
  loadCorpusSync: WG.loadCorpusSync,
  allDoctrines: WG.allDoctrines,
  findDoctrine: WG.findDoctrine,
  findPosition: WG.findPosition,
  stanceConfidence: stanceConfidence,
  scorecardTraditions: scorecardTraditions,
  findTradition: findTradition,
  corpusOrderedDoctrines: corpusOrderedDoctrines,
  resolve: resolve,
  buildTradition: buildTradition,
  buildManifest: buildManifest,
  corpusHash: corpusHash,
};

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('BUILD FAILED:', e.message); process.exit(1); }
}
