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

const { groupByDomain, traverseKey } = MapView;

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

// Keyboard traversal: right/left move between depths (child/parent), up/down
// move between siblings, no wraparound, and the root (no tabindex) is never
// a traversal target. traverseKey is the pure half -- _bindKeyboard only
// adds the DOM lookup and .focus() call around it.
const box = (id, type, children) => ({ id, type, children: children || [] });

test('ArrowRight moves from a domain to its first child', () => {
  const leaf1 = box('leaf1', 'leaf');
  const leaf2 = box('leaf2', 'leaf');
  const domain = box('domain:A', 'domain', [leaf1, leaf2]);
  const root = box('root', 'root', [domain]);
  const list = [root, domain, leaf1, leaf2];
  assert.strictEqual(traverseKey(list, 'domain:A', 'ArrowRight'), leaf1);
});

test('ArrowDown/ArrowUp move between siblings with no wraparound', () => {
  const leaf1 = box('leaf1', 'leaf');
  const leaf2 = box('leaf2', 'leaf');
  const domain = box('domain:A', 'domain', [leaf1, leaf2]);
  const root = box('root', 'root', [domain]);
  const list = [root, domain, leaf1, leaf2];
  assert.strictEqual(traverseKey(list, 'leaf1', 'ArrowDown'), leaf2);
  assert.strictEqual(traverseKey(list, 'leaf2', 'ArrowUp'), leaf1);
  assert.strictEqual(traverseKey(list, 'leaf1', 'ArrowUp'), null);
  assert.strictEqual(traverseKey(list, 'leaf2', 'ArrowDown'), null);
});

test('ArrowLeft moves from a leaf back to its domain, and stops there', () => {
  const leaf1 = box('leaf1', 'leaf');
  const domain = box('domain:A', 'domain', [leaf1]);
  const root = box('root', 'root', [domain]);
  const list = [root, domain, leaf1];
  assert.strictEqual(traverseKey(list, 'leaf1', 'ArrowLeft'), domain);
  assert.strictEqual(traverseKey(list, 'domain:A', 'ArrowLeft'), null,
    'the root has no tabindex and must never be a traversal target');
});

test('an unknown id or a leaf with no children is a no-op', () => {
  const leaf1 = box('leaf1', 'leaf');
  const domain = box('domain:A', 'domain', [leaf1]);
  const root = box('root', 'root', [domain]);
  const list = [root, domain, leaf1];
  assert.strictEqual(traverseKey(list, 'nope', 'ArrowRight'), null);
  assert.strictEqual(traverseKey(list, 'leaf1', 'ArrowRight'), null);
});

// revealPan: how far to pan so the selected tile sits clear of the detail
// panel. A bottom sheet shrinks view.bottom; a side panel shrinks view.right.
const { revealPan } = MapView;
const VIEW = { left: 0, top: 0, right: 400, bottom: 800 };

test('revealPan: a tile already inside the view does not move', () => {
  assert.deepStrictEqual(revealPan({ x: 50, y: 50, w: 100, h: 40 }, VIEW, 16), { dx: 0, dy: 0 });
});
test('revealPan: a tile off the left edge pans right to the margin', () => {
  assert.deepStrictEqual(revealPan({ x: -120, y: 50, w: 100, h: 40 }, VIEW, 16), { dx: 136, dy: 0 });
});
test('revealPan: a tile off the right edge pans left to the margin', () => {
  assert.deepStrictEqual(revealPan({ x: 350, y: 50, w: 100, h: 40 }, VIEW, 16), { dx: -66, dy: 0 });
});
test('revealPan: a tile under a bottom sheet pans up above it', () => {
  const sheet = { left: 0, top: 0, right: 400, bottom: 480 };
  assert.deepStrictEqual(revealPan({ x: 50, y: 600, w: 100, h: 40 }, sheet, 16), { dx: 0, dy: -176 });
});
test('revealPan: a tile under a side panel pans left clear of it', () => {
  const side = { left: 0, top: 0, right: 600, bottom: 800 };
  assert.deepStrictEqual(revealPan({ x: 700, y: 50, w: 200, h: 40 }, side, 16), { dx: -316, dy: 0 });
});
test('revealPan: a tile bigger than the view aligns its top-left', () => {
  assert.deepStrictEqual(revealPan({ x: 100, y: 100, w: 900, h: 900 }, VIEW, 16), { dx: -84, dy: -84 });
});

// homePan: where the first paint and Reset view put the map.
const { homePan } = MapView;

test('two-sided home centres the root on both axes', () => {
  const root = { x: -60, y: 100, w: 120, h: 40 };
  assert.deepStrictEqual(homePan(root, { width: 1000, height: 600 }, true, 16), { panX: 500, panY: 180 });
});

test('single-sided home pins the root to the left margin, centred vertically', () => {
  const root = { x: 0, y: 100, w: 120, h: 40 };
  assert.deepStrictEqual(homePan(root, { width: 390, height: 700 }, false, 16), { panX: 16, panY: 230 });
});
