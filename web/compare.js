/* web/compare.js — the /compare controller.
   Spec: docs/hosting/phase-6-design.md sections 4.4-4.6, phase 6 plan Task 5.

   No model logic lives here. engine/compare-core.js resolves both sides and
   decides every verdict, score and closest-tradition call; this file only
   fetches the two maps and the corpus, and paints what CompareCore returns.
   Written in second person throughout, per Global Constraint 8. */
import { getUser, requireUser, apiFetch, showError } from '/web/session.js';
import { mount, el, TIER_VAR } from '/web/chrome.js';
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
  mineCol.appendChild(el('p', 'tm-lab', 'Yours'));
  mineCol.appendChild(el('p', null, holdText(row.mine)));
  const mineWhy = whyText(row.mine);
  if (mineWhy) mineCol.appendChild(el('p', 'tm-hint', mineWhy));
  body.appendChild(mineCol);

  const theirsCol = el('div', 'cmp-col');
  theirsCol.appendChild(el('p', 'tm-lab', 'Theirs'));
  theirsCol.appendChild(el('p', null, holdText(row.theirs)));
  const theirsWhy = whyText(row.theirs);
  if (theirsWhy) theirsCol.appendChild(el('p', 'tm-hint', theirsWhy));
  body.appendChild(theirsCol);
  details.appendChild(body);

  if (row.doctrine.framing) details.appendChild(el('p', 'tm-framing', row.doctrine.framing));

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
  clearSkel(host);
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
    host.appendChild(el('p', 'tm-quiet',
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

/* The house skeleton, verbatim from web/gallery.html:139-146: three decoration
   cards plus aria-busy, cleared on every exit path (success and failure
   alike) by clearSkel. web/gallery.html:15-23 carries the matching CSS,
   duplicated here (finding routed to P11, see task-1-report.md). */
function paintSkel(host) {
  host.textContent = '';    // idempotent: a second paint (route()'s results branch, after main()'s cold-load paint) replaces rather than adds three more cards
  for (let i = 0; i < 3; i++) {
    const s = el('div', 'tm-card tm-skel');
    s.setAttribute('aria-hidden', 'true');
    for (let j = 0; j < 4; j++) s.appendChild(el('span'));
    host.appendChild(s);
  }
  host.setAttribute('aria-busy', 'true');
}
function clearSkel(host) {
  host.textContent = '';          // never leave a skeleton pretending to load
  host.setAttribute('aria-busy', 'false');
}

/* The one net for every entry point's awaited fetch chain. apiFetch throws
   on every failure but the unknown_user redirect and shows the shared
   #tm-banner itself before it does — but loadCorpus()'s and
   loadTraditionManifest()'s bare fetch() calls, and the bare fetch() at
   :534ish for a tradition's own map, reject on a dropped connection with no
   banner at all, and none of those four sites (this file's :534/:712,
   wizard.js's :1212/:1218) had a catch of their own. Without this, any of
   them left whichever skeleton was live pulsing forever with aria-busy still
   "true" — the loop the motion rule allows, made permanent.
   Attached at every entry point — main() below and, in compare.js, route()'s
   two other callers (navigate, popstate) — rather than at each of the four
   call sites: one guard where every path already routes through beats four
   scattered try/catches. Clears every skeleton host this page owns (cheap
   and harmless if a given one was never painted) rather than tracking which
   one was live. Shows the fallback banner only if apiFetch hasn't already
   put one up — checking the DOM, not the error's shape, is what makes that
   check correct for both apiFetch's two failure modes (network-catch throws
   a plain Error with no `.status`; !res.ok throws one with `.status`) as
   well as for a bare fetch() rejection, which carries neither and shows
   nothing on its own. console.error always runs, so a genuine programming
   error still leaves a trace instead of just going quiet behind a banner. */
function reportFatal(err) {
  console.error(err);
  clearSkel($('diff-groups'));
  clearSkel($('picker-traditions'));
  if (!document.getElementById('tm-banner')) {
    showError('Something went wrong loading this page. Try reloading.');
  }
}

/* P8 Task 3 — lazy tradition maps.
   engine/compare-core.js:230-264 (closestTradition) and :271-298 (scorecard)
   both key off scorecardTraditions() (:52-56) and both index traditionMaps
   by every scored tradition's id — there is no subset of the twelve that
   serves one and not the other. closestTradition's line sits ABOVE the
   scorecard and was the phase file's unexamined assumption ("the scorecard
   is the only consumer of the eleven non-target maps"): false, per this
   file's own report. Showing an honest closest-tradition line from a
   partial set is not on offer — an incomplete tally is exactly the
   "confident wrong answer" CLAUDE.md's ties/normalise invariants exist to
   refuse — so BOTH closestTradition and the scorecard wait behind the one
   button task-3-brief.md rules for (a real fetch of a few-hundred-KB
   payload needs a button's retry/disable/skeleton semantics; a mere
   re-render would not). See task-3-report.md for the full byte accounting.

   traditionMaps itself does not depend on which tradition is the target —
   it is the same twelve files either way — so it is cached once, at module
   scope, for the life of the page: the SECOND tradition a person compares
   against (same visit, no reload) renders instantly with no further fetch
   and no second button. */
async function loadTraditionMaps(seedId, seedDomains) {
  if (traditionMaps) return traditionMaps;             // same twelve regardless of target — see comment above
  const scTraditions = CompareCore.scorecardTraditions(corpus);
  const maps = {};
  if (seedId && seedDomains) maps[seedId] = seedDomains; // the target's own map is already fetched at :534 for the diff itself — don't fetch it twice
  await Promise.all(scTraditions.map(async (t) => {
    if (maps[t.id]) return;
    const entry = traditionList.find((x) => x.id === t.id);
    if (!entry) return;
    const res = await fetch('/content/traditions/' + entry.file);
    if (!res.ok) throw new Error('failed to load tradition map: ' + entry.file);
    maps[t.id] = Core.parse(await res.text());
  }));
  // Cached once no fetch failed — NOT once every registered scorecard
  // tradition is actually present. `if (!entry) return;` above silently
  // omits any scorecard tradition missing from traditionList, and this line
  // still caches whatever came back as good for the rest of the visit. That
  // is pre-existing (the identical line lived in the old inline loop) and
  // gated by tests/check_tradition_maps.py, so it holds in practice today —
  // but this comment must not promise a guarantee the code doesn't make.
  traditionMaps = maps;
  return traditionMaps;
}

/* Owns #cmp-closest and #cmp-scorecard's gated content for the tradition
   branch. Three states: a cache hit (already loaded this page, from this
   target or an earlier one) renders immediately; a cold state shows the
   button task-3-brief.md rules for; a failed fetch shows the shared error
   banner and puts the SAME button back so the person can retry — the old
   Promise.all's catch used to re-hide #cmp-closest/#cmp-scorecard here, but
   that would hide the retry button too, so this version does not: the two
   panes stay visible, showing the not-yet-loaded placeholder and an active
   retry button, and the banner alone carries the failure. */
async function setupScorecard({ mine, ownWording, targetTraditionId, targetDomains }) {
  const closestHost = $('cmp-closest');
  const scTableHost = $('sc-table-host');
  const scAccHost = $('sc-accordion-host');
  const loadHost = $('sc-load-host');
  // No closestHost.hidden = false here: renderResults:557 already set it
  // from isTradition before calling this function, and setupScorecard is
  // only ever reached from that branch — so it is always already false.

  function showButton() {
    loadHost.hidden = false;
    loadHost.textContent = '';
    closestHost.textContent = '';
    closestHost.appendChild(el('p', 'tm-quiet',
      'Shown once the full tradition-by-tradition comparison is loaded below.'));
    const btn = el('button', 'tm-action-btn', 'Show the all-traditions scorecard');
    btn.type = 'button';
    btn.addEventListener('click', run);
    loadHost.appendChild(btn);
  }

  async function run() {
    const btn = loadHost.querySelector('button');
    if (btn) btn.disabled = true;   // engine/theme.css's :disabled rule — the double-tap guard task-3-brief.md asks for
    paintSkel(closestHost);
    paintSkel(scTableHost);
    // #sc-table-wrap/#sc-table-host and #sc-accordion-host are the same
    // ≥861px/≤860px swap Task 1 never had to think about (web/compare.html's
    // @media (max-width: 860px) block) — exactly one of the two is actually
    // on screen at any width, but which one flips at the breakpoint, so both
    // need the skeleton or the pane a phone/tablet person can see (the
    // accordion, below 861px) shows nothing at all while the invisible one
    // (the table) pulses uselessly behind display:none.
    paintSkel(scAccHost);
    try {
      const maps = await loadTraditionMaps(targetTraditionId, targetDomains);
      clearSkel(closestHost);
      clearSkel(scTableHost);
      clearSkel(scAccHost);   // renderScorecard clears scAccHost's cards on success but never touches aria-busy — this call is what actually clears it
      renderClosest(closestHost, CompareCore.closestTradition(corpus, mine, maps), ownWording);
      renderScorecard(scTableHost, scAccHost, corpus, CompareCore.scorecard(corpus, mine, maps));
      loadHost.hidden = true;
    } catch {
      clearSkel(closestHost);
      clearSkel(scTableHost);
      clearSkel(scAccHost);
      showError('The tradition maps could not all be loaded.');
      showButton();   // put the trigger back so the person can retry
    }
  }

  if (traditionMaps) {
    loadHost.hidden = true;
    clearSkel(closestHost);
    clearSkel(scTableHost);
    renderClosest(closestHost, CompareCore.closestTradition(corpus, mine, traditionMaps), ownWording);
    renderScorecard(scTableHost, scAccHost, corpus, CompareCore.scorecard(corpus, mine, traditionMaps));
    return;
  }
  showButton();
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
  clearSkel(tHost);          // clears the skeleton main() painted, or a previous render's cards — renderPicker is re-entrant now that route() can call it more than once per document
  for (const t of traditionList) {
    tHost.appendChild(traditionCard(t,
      () => navigate('/compare?tradition=' + encodeURIComponent(t.id))));
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
    mHost.appendChild(el('p', 'tm-quiet', 'No other public maps to compare against yet.'));
  }
  for (const m of comparable) {
    mHost.appendChild(traditionCard({ display_name: m.name, node_count: m.node_count },
      () => navigate('/compare?name=' + encodeURIComponent(m.name))));
  }
}

async function renderResults(opts) {
  const { corpus, traditionList, traditionId, memberName, doctrineParam, user, changeBtn } = opts;
  $('screen-picker').hidden = true;
  $('screen-results').hidden = false;
  changeBtn.hidden = false;

  let mineRaw;
  try {
    mineRaw = await apiFetch('/api/map?user_id=' + encodeURIComponent(user.id));
  } catch {
    clearSkel($('diff-groups'));
    return; // apiFetch has already shown the error banner
  }
  if (!mineRaw) { clearSkel($('diff-groups')); return; }
  const mine = Core.parse(mineRaw.markdown);

  let theirs, targetLabel, isTradition = false;
  if (traditionId) {
    const entry = traditionList.find(t => t.id === traditionId);
    if (!entry) { clearSkel($('diff-groups')); showError('No such tradition: ' + traditionId); return; }
    isTradition = true;
    targetLabel = entry.display_name;
    const res = await fetch('/content/traditions/' + entry.file);
    if (!res.ok) { clearSkel($('diff-groups')); showError('That tradition’s map could not be loaded.'); return; }
    theirs = Core.parse(await res.text());
  } else {
    let res;
    try {
      res = await apiFetch('/api/map?name=' + encodeURIComponent(memberName));
    } catch {
      clearSkel($('diff-groups'));
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
    // P8 Task 3: the twelve-map fetch that used to block here is now
    // deferred behind setupScorecard's button (or served from cache) — see
    // that function's header comment for why closestTradition moved with
    // it instead of staying eager. `theirs` (the target's own map, already
    // fetched above) seeds the cache so the target's file is never fetched
    // twice.
    const ownWording = rows.filter((r) => r.mine.kind === 'own-wording').length;
    await setupScorecard({ mine, ownWording, targetTraditionId: traditionId, targetDomains: theirs });
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

/* Module-scope state, set once by main() before the first route() and never
   re-fetched afterwards — that is the whole point of this task. traditionMaps
   is the fourth cached value, Task 3's: unlike the other three it starts
   null and is filled in lazily (loadTraditionMaps, above) on first use
   rather than by main(), because whether it is ever needed at all depends
   on whether the person taps the scorecard button — but once filled it is
   never re-fetched, same as the other three, because it is the same twelve
   maps regardless of which tradition is the target (verified in
   task-3-report.md). */
let corpus, traditionList, user, changeBtn, traditionMaps = null;

/* The one place that decides picker vs. results from a URLSearchParams and
   renders it, closing over the module-scope state above rather than
   re-fetching it. Called once by main() for the initial load, then again by
   every internal navigation (navigate(), below) and by popstate.

   The two branches differ in what "re-entrant" needs: the picker branch
   fills #picker-traditions synchronously from the traditionList already in
   memory, so it never repaints Task 1's skeleton — renderPicker's own
   clearSkel(tHost) is enough. The results branch is NOT synchronous from
   memory: /api/map?user_id= and the target tradition/member map are fetched
   fresh over the network on every single results transition, corpus/
   traditionList caching notwithstanding. (Since P8 Task 3, the twelve
   scorecard maps are NOT fetched on every transition any more — see
   setupScorecard's and loadTraditionMaps's header comments — but that
   fetch, when it does happen, is not synchronous with renderResults either,
   for the same reason spelled out below.) renderClosest, renderTiers,
   renderScorecard and renderDiffGroups all clear their own hosts on the
   SUCCESS path already — the gap this closes is every early return in
   renderResults that happens BEFORE those helpers run: a throw/404 on the
   caller's own map, an unknown tradition, or a failed tradition/member
   fetch — all of which are before renderResults writes #cmp-closest /
   #cmp-scorecard / #cmp-framing's `hidden` flags from `isTradition`, so
   those panes are still at whatever the PREVIOUS comparison left them and
   would otherwise show its stale content. route() clears the content of
   all four panes (closest, scorecard, tiers, framing) — including
   #sc-load-host, Task 3's button/placeholder host — and re-hides them here,
   before handing off, so none of those early returns can leave the
   previous result visible or an empty box stranded on screen.

   Nothing analogous is needed AFTER that `hidden`-flags write any more.
   Before Task 3, the twelve-map scorecard Promise.all ran synchronously
   right there and its own catch had to re-hide #cmp-closest/#cmp-scorecard
   a second time, because route()'s upfront hide (above) runs before
   renderResults is even called and so cannot reach a failure that happens
   after it. Task 3 moved that fetch behind setupScorecard's button (or a
   module-scope cache hit): renderResults calls setupScorecard and returns
   without waiting on a click, so by the time any fetch failure could occur
   route() has already moved on to the next navigation, or the person is
   still looking at the very setupScorecard-painted state (placeholder +
   button, or a skeleton) that failure needs to fall back to — setupScorecard
   handles its own failure entirely (clearSkel, showError, put the button
   back for a retry) and deliberately does NOT re-hide #cmp-closest or
   #cmp-scorecard, because the retry button lives inside #cmp-scorecard and
   hiding it would hide the only way back. #cmp-tiers and #cmp-framing still
   need no such guard at all: renderTiers is the only thing that ever
   un-hides #cmp-tiers and it runs after every early return above, and
   #cmp-framing is only shown on the member branch, which never touches
   traditionMaps. */
async function route(params) {
  // Before pushState, every /compare transition reloaded the document, which
  // cleared web/session.js's #tm-banner for free. pushState doesn't, and
  // nothing else removes it, so a failure banner from one comparison ("No
  // such tradition: retired-id") would otherwise still be sitting above a
  // perfectly good result after "Change comparison" picked a real one.
  // web/session.js owns the element; this only removes it, at the top of
  // every route, before anything below has a chance to render.
  const banner = document.getElementById('tm-banner');
  if (banner) banner.remove();

  const traditionId = params.get('tradition');
  const memberName = params.get('name');
  const doctrineParam = params.get('doctrine');
  if (!traditionId && !memberName) {
    changeBtn.hidden = true;   // renderResults sets it false; route is the only path back to the picker, so it is the one place that must set it back
    await renderPicker(traditionList, user);
    return;
  }
  $('results-heading').textContent = '';
  $('cmp-closest').textContent = '';
  $('cmp-closest').hidden = true;
  $('cmp-scorecard').hidden = true;
  $('sc-table-host').textContent = '';
  $('sc-accordion-host').textContent = '';
  $('sc-load-host').textContent = '';
  $('cmp-framing').hidden = true;
  $('cmp-framing-text').textContent = '';
  $('cmp-tiers').textContent = '';
  $('cmp-tiers').hidden = true;
  paintSkel($('diff-groups'));   // idempotent — see paintSkel's own comment — so a cold ?tradition= load (which main() already skeletoned) does not double up
  await renderResults({ corpus, traditionList, traditionId, memberName, doctrineParam, user, changeBtn });
}

/* pushState + route, replacing the old location.href-to-self reload. popstate
   does not fire for the pushState that created the entry, so every internal
   link goes through this rather than relying on the popstate handler alone. */
function navigate(url) {
  history.pushState(null, '', url);
  route(new URLSearchParams(location.search)).catch(reportFatal);
}

async function main() {
  user = requireUser('Sign in first — comparing needs an account.');
  if (!user) return;

  changeBtn = el('button', 'tm-action-btn', 'Change comparison');
  changeBtn.type = 'button';
  changeBtn.hidden = true;
  changeBtn.addEventListener('click', () => navigate('/compare'));
  mount('Compare', [changeBtn]);

  // Decide the branch from the URL before the first await, so a cold
  // /compare?tradition=<id> skeletons where *results* will land, not in the
  // picker a plain /compare would show.
  const params = new URLSearchParams(location.search);
  const isResultsLoad = !!(params.get('tradition') || params.get('name'));

  // Paint the skeleton now, before either corpus/tradition-manifest fetch —
  // cleared on every exit path below: both early returns here, and inside
  // renderPicker / renderResults on their own exits (see task-1-report.md).
  let skelHost;
  if (isResultsLoad) {
    $('screen-picker').hidden = true;
    $('screen-results').hidden = false;
    skelHost = $('diff-groups');
  } else {
    skelHost = $('picker-traditions');
  }
  paintSkel(skelHost);

  // Wraps every awaited call below, including route(params) at the end: see
  // reportFatal's comment. loadCorpus()/loadTraditionManifest() are the
  // bare-fetch sites the review named (:712 for loadCorpus here); a rejected
  // route(params) is the same failure reaching this function from renderResults'
  // own bare fetch (:534) on a cold ?tradition=/?name= load.
  try {
    corpus = await loadCorpus();
    if (!corpus) { clearSkel(skelHost); return; }
    const tm = await loadTraditionManifest();
    if (!tm) { clearSkel(skelHost); showError('The tradition list could not be loaded.'); return; }
    traditionList = tm.traditions || [];

    // popstate does not fire for a pushState we just made ourselves, only for
    // Back/Forward, so this and navigate()'s direct call are both needed —
    // neither alone covers every transition.
    window.addEventListener('popstate', () =>
      route(new URLSearchParams(location.search)).catch(reportFatal));

    await route(params);
  } catch (err) {
    reportFatal(err);
  }
}

main();
