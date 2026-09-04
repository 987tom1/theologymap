/* compare-core.js — the comparison engine: my map vs a tradition, my map vs
 * another member's map, or my map against every scorecard tradition at once.
 *
 * Pure UMD, exactly like editor-core.js and wizard-generate.js: no DOM, no
 * fetch, runs under Node for headless verification. web/compare.js does the
 * fetching and rendering; this file only reasons about already-parsed maps
 * (EditorCore.parse output) and the wizard corpus.
 *
 * wizard-generate.js (WG) is taken as a UMD dependency, the same way
 * wizard-generate.js itself takes editor-core.js — required in the Node
 * branch, read off `root.WizardGenerate` in the browser branch. It is not
 * required at the top of this file, only inside that branch.
 *
 * build_traditions.js is deliberately NOT depended on here, even though it
 * exposes scorecardTraditions/buildTradition: it requires Node's `fs` at
 * its true top level with no UMD guard, so it can never run in a browser.
 * The two tiny corpus queries this file needs from it (which traditions are
 * in_scorecard, and looking one up by id) are pure and are reimplemented
 * below instead, so CompareCore stays runnable in both places.
 *
 * Spec: docs/hosting/phase-6-design.md sections 4.1-4.7.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./wizard-generate.js'));
  } else {
    root.CompareCore = factory(root.WizardGenerate);
  }
})(typeof self !== 'undefined' ? self : this, function (WG) {
  'use strict';

  /* design 4.2: lowercases, collapses whitespace, strips ONE trailing full
   * stop, strips surrounding quotes. Nothing else — no fuzzy matching, no
   * similarity threshold, no stemming. A near-match must resolve to
   * "own-wording": in a theology tool a confident wrong answer is worse
   * than an honest "cannot tell". */
  function normalise(s) {
    let t = String(s == null ? '' : s).toLowerCase().trim().replace(/\s+/g, ' ');
    if (t.length > 1 && t.charAt(t.length - 1) === '.') t = t.slice(0, -1);
    const pairs = [['"', '"'], ["'", "'"], ['‘', '’'], ['“', '”']];
    for (const [open, close] of pairs) {
      if (t.length >= 2 && t.charAt(0) === open && t.charAt(t.length - 1) === close) {
        t = t.slice(1, -1);
        break;
      }
    }
    return t;
  }

  /* Pure re-statement of build_traditions.js's scorecardTraditions/
   * findTradition (see the file-header note on why they aren't imported). */
  function scorecardTraditions(corpus) {
    return ((corpus.traditions || {}).traditions || [])
      .filter(t => t.in_scorecard)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function findTradition(corpus, traditionId) {
    return ((corpus.traditions || {}).traditions || []).find(t => t.id === traditionId) || null;
  }

  /* design 4.2's extended candidate list: every real position, plus one
   * synthetic candidate per tradition_overrides entry, carrying that
   * override's own hold and the `spans` of positions it stands for. Without
   * this a tradition built from an override (e.g. Anglican on baptism)
   * fails to agree with ITSELF, because the node its own map carries holds
   * the override's wording, which matches no single position. */
  function candidates(corpus, doctrineId) {
    const doctrine = WG.findDoctrine(corpus, doctrineId);
    if (!doctrine) return [];
    const out = (doctrine.positions || []).slice();
    const overrides = doctrine.tradition_overrides || {};
    for (const traditionId of Object.keys(overrides)) {
      const override = overrides[traditionId];
      const trad = findTradition(corpus, traditionId);
      out.push({
        id: doctrine.id + '/@override:' + traditionId,
        label: (trad ? trad.display_name : traditionId) + ': no single position',
        hold: override.hold,
        // phase 9 appends a position's previous wording here when it
        // rewords one, so a correction to the corpus does not orphan every
        // existing tradition map still carrying the old override text.
        superseded_holds: override.superseded_holds || [],
        spans: override.positions || [],
        isOverride: true,
        traditionId: traditionId,
      });
    }
    return out;
  }

  /* design 4.2, exactly. node may be undefined/null (doctrine never
   * answered). Returns {kind, position?, node?}. */
  function resolvePosition(node, doctrine, corpus) {
    if (!node) return { kind: 'unanswered' };

    const holdNorm = normalise(node.hold);
    const openIntent = node.confidence === 'open' || (node.flags || []).indexOf('study') !== -1;
    if (openIntent && (holdNorm === '' || holdNorm === 'undecided')) {
      return { kind: 'undecided', node: node };
    }

    let matched = null;
    for (const c of candidates(corpus, doctrine.id)) {
      // phase 9 reworks a position's `hold`; superseded_holds carries its
      // previous wording so an old map still matches the same position
      // instead of silently falling through to "own-wording".
      const wordings = [c.hold].concat(c.superseded_holds || []);
      if (wordings.some(h => normalise(h) === holdNorm)) { matched = c; break; }
    }

    if (node.confidence === 'rejected') {
      return matched ? { kind: 'rejected', position: matched, node: node }
                      : { kind: 'rejected', node: node };
    }
    if (matched) return { kind: 'position', position: matched, node: node };
    return { kind: 'own-wording', node: node };
  }

  /* Find the node in `domains` (EditorCore.parse output) belonging to a
   * doctrine. Joins on doctrine.slug AND the node's domain name matching
   * the doctrine's own domain — never on wording. */
  function findNode(domains, doctrine, corpus) {
    // `domains` is EditorCore.parse output — an ARRAY. Anything else means
    // "no map on that side", which is a legitimate call (tierDiff needs no
    // other side at all), not an error: `|| []` alone let a non-array
    // truthy value through and threw "is not iterable" at the for-of.
    if (!Array.isArray(domains)) return null;
    const domName = WG.domainName(corpus, doctrine);
    for (const d of domains) {
      if (d.name !== domName) continue;
      for (const n of d.nodes) if (n.slug === doctrine.slug) return n;
    }
    return null;
  }

  /* design 4.3's table plus the override rule. Both sides have already
   * resolved via resolvePosition, so this only decides the verdict string. */
  function verdictFor(mine, theirs) {
    if (mine.kind === 'rejected' || theirs.kind === 'rejected') return 'rejected';
    if (mine.kind === 'undecided') return 'mine-undecided';
    if (theirs.kind === 'undecided') return 'theirs-undecided';
    if (mine.kind === 'own-wording') return 'mine-own-wording';
    if (theirs.kind === 'own-wording') return 'theirs-own-wording';
    if (mine.kind === 'unanswered') return 'mine-unanswered';
    if (theirs.kind === 'unanswered') return 'theirs-unanswered';

    const mp = mine.position, tp = theirs.position;
    if (mp.id === tp.id) return 'agree';

    const mOv = !!mp.isOverride, tOv = !!tp.isOverride;
    if (mOv && tOv) {
      if (mp.traditionId === tp.traditionId) return 'agree';
      // Two traditions whose overrides span the same positions are not
      // disagreeing — Anglican and Lutheran both span infant-covenant and
      // regeneration on baptism. Design 4.2 only names the same-tradition
      // case; reporting "differ" for an overlap would be a difference the
      // corpus does not actually claim, which constraint 2 forbids.
      return mp.spans.some(id => tp.spans.indexOf(id) !== -1) ? 'agree-in-substance' : 'differ';
    }
    if (mOv && !tOv) return mp.spans.indexOf(tp.id) !== -1 ? 'agree-in-substance' : 'differ';
    if (!mOv && tOv) return tp.spans.indexOf(mp.id) !== -1 ? 'agree-in-substance' : 'differ';

    if (mp.equivalence_group && mp.equivalence_group === tp.equivalence_group) return 'agree-in-substance';
    return 'differ';
  }

  /* design 4.3: walks every doctrine in wizard order — (tier, domain order,
   * doctrine order), the same order the wizard asks in — resolving both
   * sides and applying the verdict table. */
  function diff(corpus, mineDomains, theirsDomains) {
    const rows = [];
    for (const doctrine of WG.orderedDoctrines(corpus)) {
      const mine = resolvePosition(findNode(mineDomains, doctrine, corpus), doctrine, corpus);
      const theirs = resolvePosition(findNode(theirsDomains, doctrine, corpus), doctrine, corpus);
      rows.push({ doctrine: doctrine, mine: mine, theirs: theirs, verdict: verdictFor(mine, theirs) });
    }
    return rows;
  }

  function findPosition(corpus, positionId) {
    return WG.findPosition(corpus, positionId);
  }

  /* Positions sharing an equivalence_group WITHIN one doctrine. The group
   * string is only meaningful inside the doctrine that declares it (design
   * 4.2/4.3), so the doctrine is a parameter rather than something this
   * search infers: scanning every doctrine would let two doctrines that
   * happened to reuse a group name answer for each other. verdictFor above
   * only ever compares two positions resolved for the SAME doctrine in the
   * same diff() row, so it was never reachable from there — the shape was
   * still wrong. */
  function positionsInGroup(corpus, doctrineId, group) {
    if (!group) return [];
    const doctrine = WG.findDoctrine(corpus, doctrineId);
    if (!doctrine) return [];
    return (doctrine.positions || []).filter(p => p.equivalence_group === group);
  }

  /* Tally mine vs one tradition's map into the design 4.4 numerator/
   * denominator: denominator counts doctrines where BOTH sides resolved to
   * an actual position (rejected excluded entirely, per 4.3); numerator is
   * the agree / agree-in-substance subset of those. */
  function tally(corpus, mineDomains, theirsDomains) {
    let numerator = 0, denominator = 0;
    for (const row of diff(corpus, mineDomains, theirsDomains)) {
      if (row.verdict === 'rejected') continue;
      if (row.mine.kind === 'position' && row.theirs.kind === 'position') {
        denominator++;
        if (row.verdict === 'agree' || row.verdict === 'agree-in-substance') numerator++;
      }
    }
    return { numerator: numerator, denominator: denominator };
  }

  /* design 4.4. Two guards: fewer than eight resolvable doctrines (mine
   * settled to an actual position, against ANY tradition) refuses to name a
   * closest tradition; and EVERY tradition tied at the top score is flagged
   * `joint: true`, not just the runner-up. The tie is decided on the score
   * alone — one scale — because the old test sorted on the ratio and then
   * broke the tie on a raw agreement count, with a tolerance of three
   * agreements that means something quite different on a 12-question
   * denominator than on an 86-question one. On a small map four traditions
   * commonly score 1.000; naming one of them alone is a confident wrong
   * answer of exactly the kind this file exists to refuse.
   * No `denominatorNote`: it described ranked[0] only, and the sentence can
   * name several traditions. Every row carries its own numerator/denominator
   * so the caller builds the phrase per tradition it names.
   * Deliberately no tier weighting — see design 4.4. */
  function closestTradition(corpus, mineDomains, traditionMaps) {
    const doctrines = WG.orderedDoctrines(corpus);
    const totalDoctrines = doctrines.length;

    let mineResolvedCount = 0;
    for (const doctrine of doctrines) {
      const mine = resolvePosition(findNode(mineDomains, doctrine, corpus), doctrine, corpus);
      if (mine.kind === 'position') mineResolvedCount++;
    }
    const enough = mineResolvedCount >= 8;

    const ranked = scorecardTraditions(corpus).map(t => {
      const theirsDomains = (traditionMaps || {})[t.id];
      const counted = theirsDomains ? tally(corpus, mineDomains, theirsDomains) : { numerator: 0, denominator: 0 };
      const score = counted.denominator > 0 ? counted.numerator / counted.denominator : 0;
      return {
        traditionId: t.id,
        displayName: t.display_name,
        numerator: counted.numerator,
        denominator: counted.denominator,
        excludedCount: totalDoctrines - counted.denominator,
        score: score,
      };
    });

    ranked.sort((a, b) => b.score - a.score || b.denominator - a.denominator);

    if (enough && ranked.length >= 2) {
      const top = ranked[0].score;
      const tied = ranked.filter(r => Math.abs(r.score - top) < 1e-9);
      if (tied.length >= 2) for (const r of tied) r.joint = true;
    }

    return { ranked: ranked, enough: enough };
  }

  /* design 4.5. Traditions only. There is deliberately NO person-vs-person
   * scorecard, and none should ever be added: a number attached to a named
   * person in a church is a ranking whatever the copy says (design 4.6). If
   * a later session wants comparison-to-a-friend, it gets the plain
   * per-doctrine diff() only, never this. */
  function scorecard(corpus, mineDomains, traditionMaps) {
    const columns = scorecardTraditions(corpus).map(t => ({ traditionId: t.id, displayName: t.display_name }));
    const doctrines = WG.orderedDoctrines(corpus);

    const rows = doctrines.map(doctrine => {
      const mine = resolvePosition(findNode(mineDomains, doctrine, corpus), doctrine, corpus);
      const cells = {};
      for (const col of columns) {
        const theirsDomains = (traditionMaps || {})[col.traditionId];
        const theirs = resolvePosition(findNode(theirsDomains, doctrine, corpus), doctrine, corpus);
        cells[col.traditionId] = verdictFor(mine, theirs);
      }
      return { doctrine: doctrine, mine: mine, cells: cells };
    });

    const totals = columns.map(col => {
      const theirsDomains = (traditionMaps || {})[col.traditionId];
      const counted = theirsDomains ? tally(corpus, mineDomains, theirsDomains) : { numerator: 0, denominator: 0 };
      return {
        traditionId: col.traditionId,
        numerator: counted.numerator,
        denominator: counted.denominator,
        excludedCount: doctrines.length - counted.denominator,
      };
    });

    return { rows: rows, columns: columns, totals: totals };
  }

  /* Tier comparison — a different question from every verdict above, and the
   * one theological triage actually turns on: two people can hold the SAME
   * position on baptism and still disagree about whether it is worth dividing
   * over. `diff()` cannot see that, because it resolves on the `hold`
   * sentence and ignores `tier` entirely.
   *
   * The baseline is the corpus's own `suggested_tier`. That is the only
   * "commonly held" tiering this app has as data: it ships with the corpus,
   * it is what the wizard offers as the default, and it is what /learn
   * publishes on every row. It is deliberately NOT an average over other
   * members' maps — with a handful of accounts such a number would be noise
   * dressed as a finding, and an aggregate saying "almost nobody tiers this
   * the way this person does" is a judgement about a person, which design 4.6
   * rules out. If a members-aggregate is ever wanted it needs its own
   * decision, not a quiet reuse of this function.
   *
   * `theirsTier` is filled in when the other side has a node for the same
   * doctrine, so a tradition comparison shows both baselines at once.
   *
   * Returns one row per doctrine where MY tier differs from the suggested
   * one — never a score, never a total, and no direction is "better".
   * `direction` is 'more-central' when my tier outranks the suggestion
   * (T1 is the most central), 'less-central' otherwise. */
  function tierDiff(corpus, mineDomains, theirsDomains) {
    const rows = [];
    for (const doctrine of WG.orderedDoctrines(corpus)) {
      const mineNode = findNode(mineDomains, doctrine, corpus);
      const mineTier = mineNode && mineNode.tier;
      const suggested = doctrine.suggested_tier;
      if (!mineTier || !suggested || mineTier === suggested) continue;

      const theirsNode = findNode(theirsDomains, doctrine, corpus);
      rows.push({
        doctrine: doctrine,
        mineTier: mineTier,
        suggestedTier: suggested,
        theirsTier: (theirsNode && theirsNode.tier) || null,
        direction: WG.tierRank(mineTier) < WG.tierRank(suggested)
          ? 'more-central' : 'less-central',
      });
    }
    return rows;
  }

  /* design 4.7. The ONE place this predicate is decided. decisions.md flags
   * and does NOT decide whether a person should be able to keep a map
   * public while opting out of being a comparison target (that needs an
   * `is_comparable` column, a data-model change, and is out of scope here).
   * Until that is decided: public means comparable. */
  function canBeComparedAgainst(user) {
    return !!user && user.is_public === true;
  }

  return {
    normalise,
    scorecardTraditions,
    diff, tierDiff, findPosition, positionsInGroup,
    closestTradition, scorecard, canBeComparedAgainst,
  };
});
