/* editor-core.js — shared parse/serialize logic for the theology-map.md editor.
 *
 * Mirrors render.py's parse() field-for-field so the editor's model always
 * matches what render.py will see. Pure functions, no DOM — used by
 * editor.html in the browser and can be run under Node for round-trip
 * verification (see tmp/verify-roundtrip.js during development).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EditorCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FIELD_KEYS = ['hold', 'why', 'vs', 'todo', 'link', 'refs'];
  const TIERS = ['T1', 'T1.5', 'T2', 'T2.5', 'T3', 'T4'];
  const CONFIDENCES = ['certain', 'confident', 'leaning', 'open', 'rejected'];

  function slugify(text) {
    let t = (text || '').toLowerCase().replace(/&/g, 'and');
    t = t.replace(/['’]/g, '');
    t = t.replace(/[^a-z0-9]+/g, '-');
    t = t.replace(/^-+|-+$/g, '');
    return t;
  }

  function newNode(title, domain) {
    return {
      title: title || '',
      slug: slugify(title || ''),
      domain: domain || '',
      tier: null,
      confidence: null,
      flags: [],
      hold: '', why: '', vs: '', todo: '', refs: '',
      link: [],
    };
  }

  /* Parse theology-map.md text into an ordered list of domain sections:
   *   [{ name: 'Scripture', nodes: [ {...node}, ... ] }, ...]
   * Node shape matches render.py's parse() exactly (title/slug/domain/tier/
   * confidence/flags/hold/why/vs/todo/link/refs). */
  function parse(text) {
    const domains = [];
    let domain = null;
    let node = null;
    let lastField = null;

    const lines = text.split(/\r\n|\r|\n/);
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) {
        lastField = null;
        continue;
      }

      if (line.startsWith('# ')) {
        domain = { name: line.slice(2).trim(), nodes: [] };
        domains.push(domain);
        node = null;
        lastField = null;
        continue;
      }

      if (line.startsWith('## ')) {
        const parts = line.slice(3).trim().split(/\s+[·|]\s+/).map(s => s.trim());
        const title = parts[0];
        node = newNode(title, domain ? domain.name : 'Uncategorised');
        if (!domain) {
          domain = { name: 'Uncategorised', nodes: [] };
          domains.push(domain);
        }
        for (const token of parts.slice(1)) {
          const low = token.toLowerCase();
          if (TIERS.includes(token.toUpperCase())) {
            node.tier = token.toUpperCase();
          } else if (CONFIDENCES.includes(low)) {
            node.confidence = low;
          } else if (token.startsWith('#')) {
            node.flags.push(low.slice(1));
          }
        }
        domain.nodes.push(node);
        lastField = null;
        continue;
      }

      if (!node) continue;

      const stripped = line.trim();
      const m = stripped.match(/^(hold|why|vs|todo|link|refs)\s+(.*)$/);
      if (m) {
        const key = m[1];
        const value = m[2].trim();
        if (key === 'link') {
          node.link.push(value);
          lastField = null;
        } else {
          node[key] = node[key] ? (node[key] + ' ' + value).trim() : value;
          lastField = key;
        }
      } else if (lastField) {
        node[lastField] = (node[lastField] + ' ' + stripped).trim();
      }
    }

    return domains;
  }

  function headerTokens(node) {
    const tokens = [node.title];
    if (node.tier) tokens.push(node.tier);
    if (node.confidence) tokens.push(node.confidence);
    for (const f of node.flags) {
      if (f) tokens.push('#' + f);
    }
    return tokens;
  }

  function serializeNode(node) {
    const lines = ['## ' + headerTokens(node).join(' · ')];
    for (const key of ['hold', 'why', 'vs', 'todo']) {
      const val = (node[key] || '').trim();
      if (val) lines.push('  ' + key.padEnd(6) + val);
    }
    const refs = (node.refs || '').trim();
    if (refs) lines.push('  ' + 'refs'.padEnd(6) + refs);
    for (const l of (node.link || [])) {
      const val = (l || '').trim();
      if (val) lines.push('  ' + 'link'.padEnd(6) + val);
    }
    return lines.join('\n');
  }

  /* Serialize the domain/node model back into theology-map.md text.
   * Formatting matches the file's existing convention: one blank line
   * between nodes, two blank lines before each domain header (none before
   * the first), single trailing newline. */
  function serialize(domains) {
    const chunks = [];
    domains.forEach((domain, i) => {
      if (i > 0) { chunks.push(''); chunks.push(''); }
      chunks.push('# ' + domain.name);
      chunks.push('');
      domain.nodes.forEach((node, j) => {
        chunks.push(serializeNode(node));
        if (j < domain.nodes.length - 1) chunks.push('');
      });
    });
    return chunks.join('\n') + '\n';
  }

  function allSlugs(domains) {
    const out = [];
    for (const d of domains) for (const n of d.nodes) out.push(n.slug);
    return out;
  }

  return {
    FIELD_KEYS, TIERS, CONFIDENCES,
    slugify, newNode, parse, serialize, serializeNode, allSlugs,
  };
});
