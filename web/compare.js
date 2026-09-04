/* web/compare.js — the /compare controller.
   Spec: docs/hosting/phase-6-design.md sections 4.4-4.6, phase 6 plan Task 5.

   No model logic lives here. engine/compare-core.js resolves both sides and
   decides every verdict, score and closest-tradition call; this file only
   fetches the two maps and the corpus, and paints what CompareCore returns.
   Written in second person throughout, per Global Constraint 8. */
import { getUser, requireUser, apiFetch, showError } from '/web/session.js';
import { mount } from '/web/chrome.js';
import { loadCorpus, loadTraditionManifest } from '/web/corpus.js';

const WG = window.WizardGenerate;
const Core = window.EditorCore;
const CompareCore = window.CompareCore;
const $ = (id) => document.getElementById(id);

/* Copy per verdict, exactly as the phase 6 plan's Task 5 gives it. Verified
   against every string engine/compare-core.js's verdictFor() actually
   returns (module.exports keys checked by hand): agree, agree-in-substance,
   differ, mine-undecided, theirs-undecided, mine-own-wording,
   theirs-own-wording, mine-unanswered, theirs-unanswered, rejected — all ten
   match this table's keys exactly, nothing to reconcile. */
const VERDICT_TEXT = {
  'agree':              'You say the same thing here',
  'agree-in-substance': 'The same answer, worded differently',
  'differ':             'You answer this differently',
  'mine-undecided':     'You have not settled this yet',
  'theirs-undecided':   'Not settled on their side',
  'mine-own-wording':   'Worded your own way — shown side by side',
  'theirs-own-wording': 'Worded their own way — shown side by side',
  'mine-unanswered':    'Not in your map yet',
  'theirs-unanswered':  'This tradition takes no position on it',
  'rejected':           'Recorded as considered and rejected',
};

const TIER_VAR = {
  'T1': 'var(--t1)', 'T1.5': 'var(--t1-5)', 'T2': 'var(--t2)',
  'T2.5': 'var(--t2-5)', 'T3': 'var(--t3)', 'T4': 'var(--t4)',
};

const GLYPH = {
  'agree':              { g: '●', label: 'Agree' },
  'agree-in-substance':  { g: '◐', label: 'Agree in substance' },
  'differ':              { g: '○', label: 'Differ' },
  'no-position':         { g: '–', label: 'No position' },
};

/* design 4.5's four-glyph collapse. Deliberately no colour distinction
   between these — a difference is not a deficiency. */
function collapseVerdict(verdict) {
  if (verdict === 'agree' || verdict === 'agree-in-substance' || verdict === 'differ') return verdict;
  return 'no-position';
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* Groups diff/scorecard rows by (tier, domain), in the order CompareCore
   already returns them — WG.orderedDoctrines() is tier-first, domain-order
   second, doctrine-order third, so a simple "did the key change" walk is
   enough; nothing here re-sorts. */
function groupRows(corpus, rows) {
  const groups = [];
  let cur = null;
  for (const row of rows) {
    const tier = row.doctrine.suggested_tier || 'Untiered';
    const domain = WG.domainName(corpus, row.doctrine);
    if (!cur || cur.tier !== tier || cur.domain !== domain) {
      cur = { tier, domain, rows: [] };
      groups.push(cur);
    }
    cur.rows.push(row);
  }
  return groups;
}

function groupHeading(tier, domain, count) {
  const head = el('div', 'cmp-group-head');
  head.style.borderLeftColor = TIER_VAR[tier] || '';
  head.appendChild(el('h3', null, tier + ' · ' + domain));
  head.appendChild(el('span', 'cmp-count', count + (count === 1 ? ' doctrine' : ' doctrines')));
  return head;
}

/* The wording actually sitting in a map, not a re-derivation of it: a
   resolved node's own `hold` when there is one, otherwise a plain statement
   of absence. */
function holdText(resolved) {
  if (resolved.node && resolved.node.hold) return resolved.node.hold;
  if (resolved.kind === 'unanswered') return 'Not in the map.';
  if (resolved.kind === 'undecided') return 'Undecided.';
  return '(no wording recorded)';
}
function whyText(resolved) {
  return (resolved.node && resolved.node.why) || '';
}

function diffRow(row, verdictText) {
  const details = el('details', 'cmp-row');
  details.dataset.doctrineId = row.doctrine.id;
  const summary = el('summary');
  summary.appendChild(el('span', 'cmp-q', row.doctrine.question || row.doctrine.node_title));
  summary.appendChild(el('span', 'cmp-verdict', verdictText[row.verdict] || row.verdict));
  details.appendChild(summary);

  const body = el('div', 'cmp-body');
  const mineCol = el('div', 'cmp-col');
  mineCol.appendChild(el('p', 'lab', 'Yours'));
  mineCol.appendChild(el('p', null, holdText(row.mine)));
  const mineWhy = whyText(row.mine);
  if (mineWhy) mineCol.appendChild(el('p', 'wz-hint', mineWhy));
  body.appendChild(mineCol);

  const theirsCol = el('div', 'cmp-col');
  theirsCol.appendChild(el('p', 'lab', 'Theirs'));
  theirsCol.appendChild(el('p', null, holdText(row.theirs)));
  const theirsWhy = whyText(row.theirs);
  if (theirsWhy) theirsCol.appendChild(el('p', 'wz-hint', theirsWhy));
  body.appendChild(theirsCol);
  details.appendChild(body);

  if (row.doctrine.framing) details.appendChild(el('p', 'wz-framing', row.doctrine.framing));

  const learnLink = el('a', null, 'Read this on Learn');
  learnLink.href = '/learn?doctrine=' + encodeURIComponent(row.doctrine.id);
  details.appendChild(learnLink);

  // A doctrine not yet in my own map is the one row that carries a second
  // link — into the wizard to go answer it.
  if (row.verdict === 'mine-unanswered') {
    const wizardLink = el('a', null, 'Answer this in the wizard');
    wizardLink.href = '/wizard?doctrine=' + encodeURIComponent(row.doctrine.id);
    details.appendChild(wizardLink);
  }
  return details;
}

/* Differences are never sorted first and never coloured — the rows print in
   CompareCore's own tier/domain/doctrine order, exactly like the diff
   itself, and only carry text, not colour, as their verdict signal. */
function renderDiffGroups(host, corpus, rows, verdictText) {
  host.textContent = '';
  for (const group of groupRows(corpus, rows)) {
    const section = el('section', 'cmp-group');
    section.appendChild(groupHeading(group.tier, group.domain, group.rows.length));
    for (const row of group.rows) section.appendChild(diffRow(row, verdictText));
    host.appendChild(section);
  }
}

/* design 4.4: both guards, printed as the fraction with its denominator in
   words, "closest" said of a tradition only and never as a percentage or a
   grade. */
function renderClosest(host, closest, ownWordingCount) {
  host.textContent = '';
  host.hidden = false;
  if (!closest.ranked.length) { host.hidden = true; return; }

  if (!closest.enough) {
    // Two different situations reach this guard and they need different copy.
    // A map written by hand rather than built in the wizard resolves to
    // `own-wording` on every doctrine — correctly, since compare recovers a
    // position by exact match on the hold sentence — so its owner has in fact
    // answered plenty and would read the "not enough answered questions"
    // sentence as a bug. Say which case it is. (Verified against
    // theology-map.md, the hand-written map: 73 of 86 rows own-wording.)
    host.appendChild(el('p', 'tm-note', ownWordingCount >= 8
      ? 'No closest tradition here: this map states its beliefs in its own words rather '
        + 'than in the wording the question set offers, so there is nothing to match '
        + 'position for position. Every doctrine is still shown side by side below.'
      : 'Not enough answered questions yet to say anything useful — here is what has '
        + 'been compared so far.'));
    return;
  }

  // Every row where `joint` is true is tied with the top row; that is one row
  // in the ordinary case and any number when several traditions tie. Each
  // names its own numerator/denominator — there is no shared denominator note
  // any more, because ties don't imply matching counts.
  const joint = closest.ranked.filter(r => r.joint);
  const named = joint.length ? joint : [closest.ranked[0]];

  const fraction = (r, first) => first
    ? 'agrees with ' + r.numerator + ' of the ' + r.denominator
      + ' questions where you both have a position'
    : r.numerator + ' of ' + r.denominator;

  const line = el('p', 'cmp-closest-line');
  if (named.length === 1) {
    const r = named[0];
    line.appendChild(document.createTextNode('This tradition’s answers are nearest to yours: '));
    line.appendChild(el('strong', null, r.displayName));
    line.appendChild(document.createTextNode(' (' + fraction(r, true) + ').'));
  } else {
    line.appendChild(document.createTextNode('You are equally close to '));
    named.forEach((r, i) => {
      line.appendChild(el('strong', null, r.displayName));
      line.appendChild(document.createTextNode(' (' + fraction(r, i === 0) + ')'));
      if (i < named.length - 2) line.appendChild(document.createTextNode(', '));
      else if (i === named.length - 2) line.appendChild(document.createTextNode(' and '));
    });
    line.appendChild(document.createTextNode('.'));
  }
  host.appendChild(line);

  if (named.length === 1) {
    host.appendChild(el('p', 'wz-quiet',
      named[0].excludedCount + ' doctrine' + (named[0].excludedCount === 1 ? '' : 's')
      + ' excluded from that count (undecided, own wording, or unanswered on either side).'));
  }
}

/* Where my own tiering departs from the corpus's suggested tier — a question
   the per-doctrine diff cannot answer, because it resolves on the `hold`
   sentence and never looks at `tier`. Two people can hold exactly the same
   position on baptism and still disagree about whether it is worth dividing
   over, which is the whole point of theological triage.

   The baseline is the corpus suggestion, not an average over other members:
   see the comment on CompareCore.tierDiff for why. Shown for a tradition and
   a member target alike, because it says nothing about the other person. */
function renderTiers(host, rows, theirsLabel) {
  host.textContent = '';
  if (!rows.length) { host.hidden = true; return; }
  host.hidden = false;

  host.appendChild(el('h3', 'cmp-section-h', 'Where your tiering differs from the suggestion'));
  host.appendChild(el('p', 'cmp-tier-lead',
    rows.length + ' doctrine' + (rows.length === 1 ? ' sits' : 's sit')
    + ' at a different tier in your map than the question set suggests. That is not a '
    + 'disagreement with anyone — the suggested tier is a starting point, and moving '
    + 'it is what building a map is for.'));

  const list = el('ul', 'cmp-tier-list');
  for (const r of rows) {
    const li = el('li', 'cmp-tier-item');
    li.appendChild(el('span', 'nm', r.doctrine.node_title));

    const suggested = el('span', 'cmp-tier-pill', r.suggestedTier);
    suggested.style.background = TIER_VAR[r.suggestedTier] || 'var(--muted)';
    suggested.title = 'Suggested tier';
    li.appendChild(suggested);

    li.appendChild(el('span', 'cmp-tier-arrow', '→'));

    const mineP = el('span', 'cmp-tier-pill', r.mineTier);
    mineP.style.background = TIER_VAR[r.mineTier] || 'var(--muted)';
    mineP.title = 'My tier';
    li.appendChild(mineP);

    li.appendChild(el('span', 'cmp-tier-move', r.direction === 'more-central'
      ? 'You treat this as more central than suggested'
      : 'You treat this as less dividing than suggested'));

    // Only stated when the other side actually has a tier for it, and stated
    // flatly — no verdict is attached to the gap.
    if (r.theirsTier && r.theirsTier !== r.mineTier) {
      li.appendChild(el('span', 'cmp-tier-move',
        '· ' + theirsLabel + ': ' + r.theirsTier));
    }

    const link = el('a', null, 'Why this tier');
    link.href = '/learn?doctrine=' + encodeURIComponent(r.doctrine.id);
    li.appendChild(link);
    list.appendChild(li);
  }
  host.appendChild(list);
}

/* design 4.5: traditions-only table, my own undecided rows shown as one
   greyed row across every column, column totals repeating the 4.4 fraction. */
function renderScorecard(tableHost, accHost, corpus, sc) {
  tableHost.textContent = '';
  accHost.textContent = '';

  const table = el('table', 'cmp-table');
  const thead = el('thead');
  const headRow = el('tr');
  headRow.appendChild(el('th', null, 'Doctrine'));
  for (const col of sc.columns) headRow.appendChild(el('th', null, col.displayName));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el('tbody');
  let curTier = null, curDomain = null;
  for (const row of sc.rows) {
    const tier = row.doctrine.suggested_tier || 'Untiered';
    const domain = WG.domainName(corpus, row.doctrine);
    if (tier !== curTier || domain !== curDomain) {
      curTier = tier; curDomain = domain;
      const groupTr = el('tr', 'cmp-table-group');
      const th = el('th', null, tier + ' · ' + domain);
      th.colSpan = sc.columns.length + 1;
      groupTr.appendChild(th);
      tbody.appendChild(groupTr);
    }
    const tr = el('tr');
    tr.appendChild(el('td', 'cmp-doctrine', row.doctrine.node_title));
    if (row.mine.kind === 'undecided') {
      const td = el('td', 'cmp-undecided', 'not settled yet');
      td.colSpan = sc.columns.length;
      tr.appendChild(td);
    } else {
      for (const col of sc.columns) {
        const v = collapseVerdict(row.cells[col.traditionId]);
        const td = el('td', 'cmp-glyph', GLYPH[v].g);
        td.title = GLYPH[v].label;
        tr.appendChild(td);
      }
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const tfoot = el('tfoot');
  const totalTr = el('tr');
  totalTr.appendChild(el('th', null, 'Agrees'));
  for (const t of sc.totals) {
    totalTr.appendChild(el('td', null, t.numerator + ' of ' + t.denominator));
  }
  tfoot.appendChild(totalTr);
  table.appendChild(tfoot);
  tableHost.appendChild(table);

  // The below-860px alternative: one tradition per accordion, same grouping.
  for (const col of sc.columns) {
    const total = sc.totals.find(t => t.traditionId === col.traditionId);
    const det = el('details', 'cmp-acc');
    det.appendChild(el('summary', null,
      col.displayName + (total ? ' — ' + total.numerator + ' of ' + total.denominator : '')));
    let ct = null, cd = null;
    for (const row of sc.rows) {
      const tier = row.doctrine.suggested_tier || 'Untiered';
      const domain = WG.domainName(corpus, row.doctrine);
      if (tier !== ct || domain !== cd) {
        ct = tier; cd = domain;
        det.appendChild(el('p', 'cmp-acc-group', tier + ' · ' + domain));
      }
      const line = el('p', 'cmp-acc-row');
      if (row.mine.kind === 'undecided') {
        line.classList.add('cmp-grey');
        line.textContent = row.doctrine.node_title + ' — not settled yet';
      } else {
        const v = collapseVerdict(row.cells[col.traditionId]);
        line.textContent = row.doctrine.node_title + ' — ' + GLYPH[v].label;
      }
      det.appendChild(line);
    }
    accHost.appendChild(det);
  }
}

function traditionCard(entry, onPick) {
  const b = el('button', 'tm-card tm-cardlink');
  b.type = 'button';
  b.style.textAlign = 'left';
  b.appendChild(el('h3', null, entry.display_name));
  b.appendChild(el('p', null, entry.node_count + ' beliefs mapped'));
  b.addEventListener('click', onPick);
  return b;
}

async function renderPicker(traditionList, user) {
  $('screen-picker').hidden = false;
  $('screen-results').hidden = true;

  const tHost = $('picker-traditions');
  tHost.textContent = '';
  for (const t of traditionList) {
    tHost.appendChild(traditionCard(t,
      () => { location.href = '/compare?tradition=' + encodeURIComponent(t.id); }));
  }

  const mHost = $('picker-members');
  mHost.textContent = '';
  let gallery = [];
  try { gallery = (await apiFetch('/api/gallery')) || []; } catch { gallery = []; }
  // /api/gallery lists public maps only, by construction, and carries no
  // is_public field of its own. Mapping each row through is_public:true
  // before the one real predicate keeps CompareCore.canBeComparedAgainst the
  // single gate — this is not a second predicate, just satisfying the shape
  // the existing one expects.
  const comparable = gallery.filter(row =>
    CompareCore.canBeComparedAgainst(Object.assign({}, row, { is_public: true }))
    && row.name.toLowerCase() !== user.name.toLowerCase());
  if (!comparable.length) {
    mHost.appendChild(el('p', 'wz-quiet', 'No other public maps to compare against yet.'));
  }
  for (const m of comparable) {
    mHost.appendChild(traditionCard({ display_name: m.name, node_count: m.node_count },
      () => { location.href = '/compare?name=' + encodeURIComponent(m.name); }));
  }
}

async function renderResults(opts) {
  const { corpus, traditionList, traditionId, memberName, doctrineParam, user, changeBtn } = opts;
  $('screen-picker').hidden = true;
  $('screen-results').hidden = false;
  changeBtn.hidden = false;

  const mineRaw = await apiFetch('/api/map?user_id=' + encodeURIComponent(user.id));
  if (!mineRaw) return;
  const mine = Core.parse(mineRaw.markdown);

  let theirs, targetLabel, isTradition = false;
  if (traditionId) {
    const entry = traditionList.find(t => t.id === traditionId);
    if (!entry) { showError('No such tradition: ' + traditionId); return; }
    isTradition = true;
    targetLabel = entry.display_name;
    const res = await fetch('/content/traditions/' + entry.file);
    if (!res.ok) { showError('That tradition’s map could not be loaded.'); return; }
    theirs = Core.parse(await res.text());
  } else {
    let res;
    try {
      res = await apiFetch('/api/map?name=' + encodeURIComponent(memberName));
    } catch {
      return; // apiFetch has already shown the error (404 means not public)
    }
    targetLabel = memberName;
    theirs = Core.parse(res.markdown);
  }

  $('results-heading').textContent = isTradition
    ? 'Compared with ' + targetLabel
    : targetLabel + '’s map, side by side with yours';

  const rows = CompareCore.diff(corpus, mine, theirs);
  const verdictText = Object.assign({}, VERDICT_TEXT);
  if (!isTradition) verdictText['theirs-unanswered'] = 'Not in their map yet';

  $('cmp-closest').hidden = !isTradition;
  $('cmp-scorecard').hidden = !isTradition;
  $('cmp-framing').hidden = isTradition;

  if (isTradition) {
    const scTraditions = CompareCore.scorecardTraditions(corpus);
    const traditionMaps = {};
    try {
      await Promise.all(scTraditions.map(async (t) => {
        const entry = traditionList.find((x) => x.id === t.id);
        if (!entry) return;
        const res = await fetch('/content/traditions/' + entry.file);
        if (!res.ok) throw new Error('failed to load tradition map: ' + entry.file);
        traditionMaps[t.id] = Core.parse(await res.text());
      }));
    } catch {
      showError('The tradition maps could not all be loaded.');
      return;
    }
    const ownWording = rows.filter((r) => r.mine.kind === 'own-wording').length;
    renderClosest($('cmp-closest'), CompareCore.closestTradition(corpus, mine, traditionMaps), ownWording);
    renderScorecard($('sc-table-host'), $('sc-accordion-host'), corpus,
      CompareCore.scorecard(corpus, mine, traditionMaps));
  } else {
    // design §4.6: person-to-person comparison ships the per-doctrine diff
    // only. No scorecard, no closest-tradition summary, no score attached to
    // a named person — a number next to a name in a church is a ranking
    // whatever the copy says. This omission is deliberate, not an oversight.
    const bothSettled = rows.filter((r) => r.mine.kind === 'position' && r.theirs.kind === 'position').length;
    $('cmp-framing-text').textContent =
      'This is what your two maps say side by side. '
      + bothSettled + ' doctrine' + (bothSettled === 1 ? '' : 's') + ' where both have settled something.';
  }

  renderTiers($('cmp-tiers'), CompareCore.tierDiff(corpus, mine, theirs),
    isTradition ? targetLabel : targetLabel + "'s map");

  renderDiffGroups($('diff-groups'), corpus, rows, verdictText);

  if (doctrineParam) {
    const target = document.querySelector('[data-doctrine-id="' + CSS.escape(doctrineParam) + '"]');
    if (target) { target.open = true; target.scrollIntoView({ block: 'center' }); }
  }
}

async function main() {
  const user = requireUser('Sign in first — comparing needs an account.');
  if (!user) return;

  const changeBtn = el('button', 'tm-action-btn', 'Change comparison');
  changeBtn.type = 'button';
  changeBtn.hidden = true;
  changeBtn.addEventListener('click', () => { location.href = '/compare'; });
  mount('Compare', [changeBtn]);

  const corpus = await loadCorpus();
  if (!corpus) return;
  const tm = await loadTraditionManifest();
  if (!tm) { showError('The tradition list could not be loaded.'); return; }
  const traditionList = tm.traditions || [];

  const params = new URLSearchParams(location.search);
  const traditionId = params.get('tradition');
  const memberName = params.get('name');
  const doctrineParam = params.get('doctrine');

  if (!traditionId && !memberName) {
    await renderPicker(traditionList, user);
    return;
  }

  await renderResults({ corpus, traditionList, traditionId, memberName, doctrineParam, user, changeBtn });
}

main();
