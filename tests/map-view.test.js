// tests/map-view.test.js
//
// The one test P9's unfork can have. map-view.js is UMD and its pure exports
// run from plain node with no browser, DOM or login (debug.md rule 21) --
// MapView's prototype touches the DOM, but groupByDomain does not, and the
// factory itself touches nothing at module scope.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const MapView = require('../engine/map-view.js');

const { groupByDomain } = MapView;

const n = (domain, title) => ({ domain, title, slug: title.toLowerCase().replace(/\W+/g, '-') });

test('nodes are grouped under their own domain', () => {
  const out = groupByDomain([n('Scripture', 'Inerrancy'), n('Ethics', 'Marriage'), n('Scripture', 'Canon')]);
  assert.deepStrictEqual(out.map(d => d.name), ['Scripture', 'Ethics']);
  assert.deepStrictEqual(out[0].nodes.map(x => x.title), ['Inerrancy', 'Canon']);
  assert.deepStrictEqual(out[1].nodes.map(x => x.title), ['Marriage']);
});

test('domain order is first appearance, not alphabetical', () => {
  const out = groupByDomain([n('Zion', 'a'), n('Abel', 'b'), n('Zion', 'c')]);
  assert.deepStrictEqual(out.map(d => d.name), ['Zion', 'Abel']);
});

test('an empty or missing node list groups to nothing', () => {
  assert.deepStrictEqual(groupByDomain([]), []);
  assert.deepStrictEqual(groupByDomain(undefined), []);
});

test('a single domain yields one group holding every node', () => {
  const out = groupByDomain([n('Scripture', 'a'), n('Scripture', 'b')]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].nodes.length, 2);
});

test('every node survives grouping exactly once', () => {
  const nodes = [n('A', 'a'), n('B', 'b'), n('A', 'c'), n('C', 'd'), n('B', 'e')];
  const out = groupByDomain(nodes);
  const flat = out.flatMap(d => d.nodes);
  assert.strictEqual(flat.length, nodes.length);
  assert.deepStrictEqual(new Set(flat), new Set(nodes));
});

// debug.md rule 22: "N nodes" is a number the map says out loud on every domain
// box, so it needs an assertion on realistic input rather than a passing unit
// suite. This runs the adapter over the REAL node list -- the same
// <script id="data"> payload the generated page parses -- and prints the domain
// box labels a person actually reads. A capture where every row says "0 nodes"
// is a failed capture, not a pass.
test('the real map groups into area boxes whose counts reconcile', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'theology-map.html'), 'utf8');
  const m = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'no <script id="data"> payload found in theology-map.html');
  const nodes = JSON.parse(m[1]).nodes;
  assert.ok(nodes.length > 0, 'the real map parsed to zero nodes');

  const groups = groupByDomain(nodes);
  const labels = groups.map(d => `${d.name} — ${d.nodes.length} node${d.nodes.length === 1 ? '' : 's'}`);
  console.log('\n  Domain boxes as rendered:\n' + labels.map(l => '    ' + l).join('\n') + '\n');

  assert.strictEqual(groups.reduce((t, d) => t + d.nodes.length, 0), nodes.length);
  assert.strictEqual(new Set(groups.map(d => d.name)).size, groups.length, 'a domain was split across two boxes');
  assert.ok(groups.every(d => d.nodes.length > 0), 'a real area rendered as an empty box');
  assert.deepStrictEqual(groups.map(d => d.name), [...new Set(nodes.map(x => x.domain))],
    'box order departed from the order the source file lists the areas in');
});
