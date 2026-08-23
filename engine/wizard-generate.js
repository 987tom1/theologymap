/* wizard-generate.js — corpus + answers -> a theology-map.md node model.
 *
 * Pure. No DOM, no fetch, no markdown. The wizard UI decides what to ask and
 * collects answers; this file turns an answer into a node; editor-core.js
 * serializes the result. There is one parser and one serializer in this repo
 * and neither of them is here.
 *
 * Splitting this out of the UI is what makes the whole content-to-markdown
 * path testable from the command line with node, in a program that has banned
 * browser automation for verification. Spec: docs/hosting/phase-4-design.md
 * sections 4.9, 5.2 and 5.6.
 *
 * UMD, same shape as editor-core.js: window.WizardGenerate in the browser,
 * module.exports under Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./editor-core.js'));
  } else {
    root.WizardGenerate = factory(root.EditorCore);
  }
})(typeof self !== 'undefined' ? self : this, function (EditorCore) {
  'use strict';

  const TIER_ORDER = ['T1', 'T1.5', 'T2', 'T2.5', 'T3', 'T4'];

  /* Untiered sorts last, matching the Map and Domain views' ordering. */
  function tierRank(tier) {
    const i = TIER_ORDER.indexOf(tier);
    return i === -1 ? TIER_ORDER.length : i;
  }

  /* Node-only. The browser fetches the corpus itself and passes the object in,
   * so this is guarded rather than imported at the top: a bundler-free browser
   * load must never touch `require`. */
  function loadCorpusSync(dir) {
    if (typeof require === 'undefined') {
      throw new Error('loadCorpusSync is Node-only; the browser passes a corpus object.');
    }
    const fs = require('fs');
    const path = require('path');
    const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));

    const manifest = read('manifest.json');
    const traditions = read('traditions.json');
    const domains = {};
    for (const entry of manifest.domains || []) {
      // Phase 5 adds the remaining domain files; a manifest entry with no file
      // on disk yet is the normal state, not an error.
      if (fs.existsSync(path.join(dir, entry.file))) domains[entry.id] = read(entry.file);
    }
    return { manifest, traditions, domains };
  }

  function domainEntry(corpus, domainId) {
    return ((corpus.manifest || {}).domains || []).find(d => d.id === domainId) || null;
  }

  /* The `# ` heading a doctrine's node belongs under. It must match
   * theology-map.md's own heading exactly — that is what makes a wizard-built
   * map, Thomas's map and a tradition map comparable. */
  function domainName(corpus, doctrine) {
    const entry = domainEntry(corpus, doctrine.domain);
    return entry ? entry.name : doctrine.domain;
  }

  function allDoctrines(corpus) {
    const out = [];
    for (const [domainId, file] of Object.entries(corpus.domains || {})) {
      for (const doctrine of file.doctrines || []) {
        out.push(Object.assign({ domain: domainId }, doctrine));
      }
    }
    return out;
  }

  /* Tier order, T1 first — decisions.md, and design section 5.2: what a person
   * thinks about scripture and Christ constrains everything downstream. Within
   * a tier, the map's own domain order, then the doctrine's own order. */
  function orderedDoctrines(corpus) {
    const entries = allDoctrines(corpus).map(doctrine => {
      const entry = domainEntry(corpus, doctrine.domain);
      return { doctrine, domainOrder: entry ? entry.order : 999 };
    });
    entries.sort((a, b) =>
      tierRank(a.doctrine.suggested_tier) - tierRank(b.doctrine.suggested_tier) ||
      a.domainOrder - b.domainOrder ||
      (a.doctrine.order || 0) - (b.doctrine.order || 0));
    return entries.map(e => e.doctrine);
  }

  function findDoctrine(corpus, doctrineId) {
    return allDoctrines(corpus).find(d => d.id === doctrineId) || null;
  }

  function findPosition(corpus, positionId) {
    for (const doctrine of allDoctrines(corpus)) {
      for (const position of doctrine.positions || []) {
        if (position.id === positionId) return position;
      }
    }
    return null;
  }

  function answeredSlugs(domains) {
    const out = new Set();
    for (const domain of domains) for (const node of domain.nodes) out.add(node.slug);
    return out;
  }

  /* The next unanswered doctrine in wizard order, or null when the corpus is
   * exhausted. Answered is decided by slugs already in the map, not by an
   * answer log — that is why resume needs no stored state (design 5.4). */
  function nextDoctrine(domains, corpus) {
    const answered = answeredSlugs(domains);
    return orderedDoctrines(corpus).find(d => !answered.has(d.slug)) || null;
  }

  /* A new section goes in its manifest.order position relative to the sections
   * already there, so a map built in tier order still reads in domain order
   * (design 5.5). A section the person made up themselves has no manifest
   * order and keeps its place. */
  function findOrCreateDomain(domains, corpus, name) {
    let domain = domains.find(d => d.name === name);
    if (domain) return domain;

    domain = { name: name, nodes: [] };
    const entries = (corpus.manifest || {}).domains || [];
    const orderOf = n => {
      const e = entries.find(x => x.name === n);
      return e ? e.order : Infinity;
    };
    const mine = orderOf(name);
    let i = 0;
    while (i < domains.length && orderOf(domains[i].name) <= mine) i++;
    domains.splice(i, 0, domain);
    return domain;
  }

  /* Tier order within the domain, matching how both the Map view and the
   * Domain view already present a section. */
  function insertInTierOrder(domain, node) {
    const rank = tierRank(node.tier);
    let i = 0;
    while (i < domain.nodes.length && tierRank(domain.nodes[i].tier) <= rank) i++;
    domain.nodes.splice(i, 0, node);
  }

  /* Apply one answer, mutating and returning `domains`.
   *
   * Answer shape:
   *   { doctrineId, kind: "position"|"open", positionId?, hold?, why?, vs?,
   *     tier?, confidence?, study?: bool, revisit?: bool }
   *
   * An answer for a doctrine already in the map is ignored unless it carries
   * `revisit: true`. That is the rule protecting work the person did by hand:
   * the wizard adds beliefs, it never rewrites one already there.
   */
  function applyAnswer(domains, corpus, answer) {
    const doctrine = findDoctrine(corpus, (answer || {}).doctrineId);
    if (!doctrine) return domains;

    const existing = answeredSlugs(domains);
    if (existing.has(doctrine.slug) && !answer.revisit) return domains;

    const name = domainName(corpus, doctrine);
    const node = EditorCore.newNode(doctrine.node_title, name);
    const open = doctrine.open || {};

    if (answer.kind === 'open') {
      // "I don't know" is a first-class answer, never a skip: a real node with
      // real study value (decisions.md; design 4.9).
      node.hold = open.hold || 'Undecided.';
      node.todo = open.todo || '';
      node.confidence = 'open';
      node.flags = ['study'];
      node.tier = answer.tier || open.tier || doctrine.suggested_tier || null;
      node.refs = doctrine.refs || '';
    } else {
      const position = findPosition(corpus, answer.positionId);
      if (!position) return domains;
      // `hold` is the exact sentence the person chose, or their own wording
      // from "Word it my way". why/vs are droppable: an empty string clears.
      node.hold = answer.hold !== undefined ? answer.hold : (position.hold || '');
      node.why = answer.why !== undefined ? answer.why : (position.why || '');
      node.vs = answer.vs !== undefined ? answer.vs : (position.vs || '');
      node.tier = answer.tier || position.tier || doctrine.suggested_tier || null;
      node.confidence = answer.confidence || position.confidence_default || null;
      node.refs = position.refs || doctrine.refs || '';
      if (answer.study) node.flags = ['study'];
    }

    // Never #assumed: the wizard's output is chosen, not inferred.
    node.why = node.why || '';
    node.vs = node.vs || '';

    // Intended links are held here and resolved by pruneLinks. The underscore
    // matters: serializeNode only reads known fields, so this never reaches
    // the file — the test greps the serialized text to keep it that way.
    node._intendedLinks = (doctrine.links || []).slice();
    node.link = [];

    if (answer.revisit && existing.has(doctrine.slug)) {
      for (const domain of domains) {
        const i = domain.nodes.findIndex(n => n.slug === doctrine.slug);
        if (i !== -1) domain.nodes.splice(i, 1);
      }
    }

    insertInTierOrder(findOrCreateDomain(domains, corpus, name), node);
    return domains;
  }

  /* Recompute every node's `link` from its intended links intersected with the
   * slugs actually present. Run immediately before every serialize, not once
   * at the end: "Finish here" can happen at any question, and render.py warns
   * on a link whose target does not exist. It restores as well as prunes, so a
   * later answer revives an earlier node's link (design 5.6).
   *
   * Nodes with no intended links keep whatever they already have — the wizard
   * merges into maps it did not write, and those links are the person's own. */
  function pruneLinks(domains) {
    const slugs = answeredSlugs(domains);
    for (const domain of domains) {
      for (const node of domain.nodes) {
        const intended = node._intendedLinks || node.link || [];
        node.link = intended.filter(s => slugs.has(s));
      }
    }
    return domains;
  }

  return {
    TIER_ORDER, tierRank,
    loadCorpusSync, orderedDoctrines, allDoctrines,
    findDoctrine, findPosition, domainName,
    applyAnswer, pruneLinks, answeredSlugs, nextDoctrine,
  };
});
