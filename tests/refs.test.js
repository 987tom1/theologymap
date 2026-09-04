// tests/refs.test.js
const assert = require('assert');
const { test } = require('node:test');
const { citationUrl } = require('../web/refs.js');

test('a curated work returns its curated host, not a google fallback', () => {
  const url = citationUrl('Catechism of the Catholic Church', '253-256');
  assert.ok(url.startsWith('https://www.vatican.va/'), url);
});

test('an unknown work returns the google search fallback', () => {
  const url = citationUrl('Some Obscure Tract Nobody Curated', 'p. 12');
  assert.ok(url.startsWith('https://www.google.com/search?q='), url);
  assert.ok(url.includes(encodeURIComponent('Some Obscure Tract')), url);
});

test('a bare citation with no label still resolves the work from its leading words', () => {
  const url = citationUrl('', 'Augsburg Confession, Art. IV');
  assert.strictEqual(url, 'https://bookofconcord.org/augsburg-confession/');
});

test('a bare citation with no digits or comma still resolves', () => {
  const url = citationUrl(undefined, 'Thirty-Nine Articles, Art. XVII');
  assert.ok(url.includes('churchofengland.org'), url);
});

test('a leading "The " and case differences do not block a match', () => {
  const url = citationUrl('The Westminster Confession of Faith', 'VI.1');
  assert.strictEqual(url, 'https://opc.org/confessions.html');
});

test('empty/undefined inputs return a string and do not throw', () => {
  assert.strictEqual(typeof citationUrl(), 'string');
  assert.strictEqual(typeof citationUrl('', ''), 'string');
  assert.strictEqual(typeof citationUrl(undefined, undefined), 'string');
  assert.ok(citationUrl().startsWith('https://'));
});
