/* web/learn.js — the /learn controller. Three views chosen by query string:
   the doctrine index (/learn), the doctrine page (/learn?doctrine=), and the
   tradition index (/learn?tradition=). Spec: docs/hosting/phase-6-design.md
   section 3.

   Static fetch plus rendering only — no model logic lives here. Ordering,
   tier ranking and doctrine lookup are engine/wizard-generate.js's
   (window.WizardGenerate); parsing a saved map is engine/editor-core.js's
   (window.EditorCore); the corpus loader and the stance vocabulary are
   web/corpus.js's; a citation becomes a link only through web/refs.js. */
import { getUser, apiFetch } from '/web/session.js';
import { mount, el } from '/web/chrome.js';
import { citeLink as sharedCiteLink, sourceLine as sharedSourceLine } from '/web/refs.js';
import { loadCorpus, STANCE_TEXT } from '/web/corpus.js';

const WG = window.WizardGenerate;
const Core = window.EditorCore;
const $ = (id) => document.getElementById(id);

const TIER_VAR = {
  'T1': 'var(--t1)', 'T1.5': 'var(--t1-5)', 'T2': 'var(--t2)',
  'T2.5': 'var(--t2-5)', 'T3': 'var(--t3)', 'T4': 'var(--t4)',
};

/* --------------------------------------------------------------- helpers */

function showScreen(name) {
  for (const s of ['index', 'doctrine', 'tradition']) $('view-' + s).hidden = (s !== name);
  $('lp-notfound').hidden = true;
}

function notFound(message) {
  for (const s of ['index', 'doctrine', 'tradition']) $('view-' + s).hidden = true;
  $('lp-notfound').textContent = message;
  $('lp-notfound').hidden = false;
}

/* Every citation on this page is a link. A real `url` wins; refs.js supplies
   one for everything else — same contract web/wizard.js uses. citeLink/
   sourceLine themselves are shared with web/wizard.js (web/refs.js); /learn
   passes no onFollow, since there is no in-progress answer to commit here. */
function citeLink(text, label, citation, url) {
  return sharedCiteLink(el, text, label, citation, url);
}
function sourceLine(src) {
  return sharedSourceLine(el, 'lp-hint', src);
}

/* Deduplicated by label, first occurrence wins — design section 3.7. */
function dedupeSources(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const s of list || []) {
      if (!s || !s.label || seen.has(s.label)) continue;
      seen.add(s.label);
      out.push(s);
    }
  }
  return out;
}

/* `refs` is a semicolon-separated string of scripture references (the same
   format theology-map.md's own `refs` field uses). Nothing here fetches or
   invents verse text — the corpus has no client-reachable copy of
   verses.md (it is bundled server-side for /api/render only), so a plain
   pill with the reference and no text is the honest rendering. */
function refPills(refsStr) {
  const box = el('div', 'lp-refs');
  const refs = String(refsStr || '').split(';').map(s => s.trim()).filter(Boolean);
  for (const r of refs) box.appendChild(el('span', 'lp-refchip', r));
  return box;
}

/* The chip carries `suggested_tier`, which is a property of the DOCTRINE, not
   of any reader — which is why it renders signed out, unlike section 6's "my
   own answer". It is a starting point a person is free to move, and some
   traditions reasonably tier the same doctrine higher or lower, so it must
   never read as this site's verdict on how much a doctrine matters. The word
   "suggested" and the tier_note below it are what keep that honest. */
function tierChip(tier) {
  const chip = el('span', 'lp-tier', tier);
  chip.style.background = TIER_VAR[tier] || 'var(--muted)';
  chip.title = 'Suggested tier: ' + tier + '. A starting point, not a verdict.';
  return chip;
}

/* The corpus's own explanation of why a doctrine sits where it does. It exists
   on every doctrine and, until now, was rendered nowhere. */
function tierNote(doctrine) {
  if (!doctrine.tier_note) return null;
  const box = el('div', 'lp-tiernote');
  box.appendChild(el('span', 'lab', 'Suggested tier ' + (doctrine.suggested_tier || '') + ' — why'));
  box.appendChild(el('p', null, doctrine.tier_note));
  return box;
}

function traditionById(corpus, id) {
  return (corpus.traditions.traditions || []).find(t => t.id === id) || null;
}

/* Doctrines grouped by domain, in manifest order, each domain's doctrines in
   their own `order`. WG.allDoctrines already walks corpus.domains in
   manifest order and tags each doctrine with `.domain`; this only groups
   what is already contiguous rather than re-deriving the order. */
function domainGroups(corpus) {
  const bySlug = {};
  for (const doctrine of WG.allDoctrines(corpus)) {
    (bySlug[doctrine.domain] = bySlug[doctrine.domain] || []).push(doctrine);
  }
  const domains = (corpus.manifest.domains || []).slice().sort((a, b) => a.order - b.order);
  return domains
    .map(d => ({ id: d.id, name: d.name, doctrines: (bySlug[d.id] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)) }))
    .filter(g => g.doctrines.length);
}

/* `outside` sorts last; everything else keeps corpus order (design 3, step
   2's first hard rule — same rule web/wizard.js's orderedPositions applies,
   just without the lens re-ordering the wizard also does). */
function orderedPositions(doctrine) {
  return (doctrine.positions || [])
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.orthodoxy === 'outside' ? 1 : 0) - (b.p.orthodoxy === 'outside' ? 1 : 0) || a.i - b.i)
    .map(x => x.p);
}

/* -------------------------------------------------------------- index view */

function renderIndex(corpus) {
  const groups = domainGroups(corpus);
  const host = $('lp-index-list');
  host.textContent = '';

  for (const group of groups) {
    const box = el('div', 'lp-domain');
    box.appendChild(el('h2', null, group.name));
    const rows = el('div', 'lp-rows');
    for (const doctrine of group.doctrines) {
      const row = el('a', 'lp-row');
      row.href = '/learn?doctrine=' + encodeURIComponent(doctrine.id);
      row.dataset.searchText = [
        doctrine.node_title, doctrine.question,
        ...(doctrine.positions || []).map(p => p.label),
      ].join(' \n ').toLowerCase();
      row.appendChild(el('span', 'nm', doctrine.node_title));
      const meta = el('span', 'meta');
      meta.appendChild(tierChip(doctrine.suggested_tier));
      const n = (doctrine.positions || []).length;
      meta.appendChild(el('span', 'count', n + ' position' + (n === 1 ? '' : 's')));
      row.appendChild(meta);
      rows.appendChild(row);
    }
    box.appendChild(rows);
    host.appendChild(box);
  }

  $('lp-filter').addEventListener('input', () => {
    const q = $('lp-filter').value.trim().toLowerCase();
    for (const box of host.querySelectorAll('.lp-domain')) {
      let any = false;
      for (const row of box.querySelectorAll('.lp-row')) {
        const hit = !q || row.dataset.searchText.includes(q);
        row.hidden = !hit;
        if (hit) any = true;
      }
      box.hidden = !any;
    }
  });

  showScreen('index');
}

/* ----------------------------------------------------------- doctrine page */

function orthodoxyMarker(position) {
  // Only `contested` and `outside` ever carry an orthodoxy_note in the
  // corpus (verified against every domain file) — `historic` is the
  // unremarked default and gets no marker at all.
  if (!position.orthodoxy_note) return null;
  const box = el('div');
  const label = position.orthodoxy === 'outside' ? 'Outside the historic creeds' : 'Contested';
  box.appendChild(el('p', 'lp-outside', label));
  box.appendChild(el('p', 'lp-outside-note', position.orthodoxy_note));
  return box;
}

function positionCard(doctrine, position) {
  const card = el('div', 'lp-pos');
  const marker = orthodoxyMarker(position);
  if (marker) card.appendChild(marker);
  card.appendChild(el('h3', null, position.label));
  if (position.hold) card.appendChild(el('p', 'lp-prose', position.hold));
  if (position.why) {
    card.appendChild(el('p', 'lp-pos-label', 'Why'));
    card.appendChild(el('p', 'lp-prose', position.why));
  }
  if (position.vs) {
    card.appendChild(el('p', 'lp-pos-label', 'What it rejects'));
    card.appendChild(el('p', 'lp-prose', position.vs));
  }
  if (position.learn_detail) {
    card.appendChild(el('p', 'lp-pos-label', 'More'));
    card.appendChild(el('p', 'lp-prose', position.learn_detail));
  }
  if (position.refs) {
    card.appendChild(el('p', 'lp-pos-label', 'Texts'));
    card.appendChild(refPills(position.refs));
  }
  if ((position.sources || []).length) {
    card.appendChild(el('p', 'lp-pos-label', 'Sources'));
    const box = el('div', 'lp-sources');
    for (const s of position.sources) box.appendChild(sourceLine(s));
    card.appendChild(box);
  }
  return card;
}

/* "Who holds what" — one entry per position's held_by, except a tradition
   that has a tradition_overrides entry on this doctrine appears exactly
   once, spanning its positions, carrying the override's own note and
   citation. This is the rule design section 3 calls "the entire reason this
   surface exists rather than only the maps": the corpus lists an override
   tradition in held_by under every position it spans (so the maps stay
   generatable one position at a time), but that must never show here as the
   same tradition repeated with a different stance each time. */
function whoHoldsWhat(corpus, doctrine, positions) {
  const overrides = doctrine.tradition_overrides || {};
  const overrideIds = new Set(Object.keys(overrides));

  const dl = el('dl', 'lp-who');
  for (const position of positions) {
    for (const h of position.held_by || []) {
      if (overrideIds.has(h.tradition)) continue;
      const t = traditionById(corpus, h.tradition);
      if (!t) continue;
      dl.appendChild(el('dt', null, t.display_name));
      const dd = el('dd');
      const words = STANCE_TEXT[h.stance];
      if (words) {
        dd.appendChild(el('span', 'stance', words.charAt(0).toUpperCase() + words.slice(1) + '.'));
        dd.appendChild(document.createTextNode(' ' + position.label + '.'));
      }
      if (h.note) dd.appendChild(document.createTextNode(' ' + h.note));
      if (h.citation) {
        dd.appendChild(document.createTextNode(' '));
        dd.appendChild(citeLink(h.citation, h.citation, h.citation, null));
      }
      dl.appendChild(dd);
    }
  }

  for (const [traditionId, override] of Object.entries(overrides)) {
    const t = traditionById(corpus, traditionId);
    if (!t) continue;
    dl.appendChild(el('dt', null, t.display_name));
    const dd = el('dd');
    const spans = (override.positions || [])
      .map(pid => (doctrine.positions || []).find(p => p.id === pid))
      .filter(Boolean)
      .map(p => p.label);
    // An override does NOT imply a divided tradition. Three of the 53 in
    // the corpus span a single position and say so in their own note
    // ("it is not a divided tradition here") — the override exists because
    // the position's label or wording alone would misstate the tradition,
    // not because it holds two. Saying "no single position" of those would
    // invent a division the corpus explicitly denies.
    if (spans.length > 1) {
      dd.appendChild(el('span', 'stance', 'No single position — spans ' + spans.join(', ') + '.'));
    } else if (spans.length === 1) {
      dd.appendChild(el('span', 'stance', 'Stated in its own terms, under ' + spans[0] + '.'));
    }
    if (override.note) dd.appendChild(document.createTextNode(' ' + override.note));
    if (override.citation) {
      dd.appendChild(document.createTextNode(' '));
      dd.appendChild(citeLink(override.citation, override.citation, override.citation, null));
    }
    dl.appendChild(dd);
  }

  return dl;
}

/* The person's own current node for this doctrine, shown as it is — never
   marked right or wrong. Section 6 is skipped entirely when nobody is
   signed in, per the task brief: /learn has to work signed out. */
async function myOwnAnswer(doctrine) {
  const user = getUser();
  if (!user) return null;

  const map = await apiFetch('/api/map?user_id=' + encodeURIComponent(user.id));
  if (!map) return null;
  const domains = Core.parse(map.markdown);
  let node = null;
  for (const d of domains) {
    const found = d.nodes.find(n => n.slug === doctrine.slug);
    if (found) { node = found; break; }
  }

  const box = el('div', 'lp-mine');
  if (!node) {
    box.appendChild(el('p', 'lp-prose', 'Not yet in the map.'));
  } else {
    box.appendChild(el('p', 'lp-prose', node.hold || '(no hold recorded)'));
    if (node.why) { box.appendChild(el('p', 'lp-pos-label', 'Why')); box.appendChild(el('p', 'lp-prose', node.why)); }
    if (node.vs) { box.appendChild(el('p', 'lp-pos-label', "What it rejects")); box.appendChild(el('p', 'lp-prose', node.vs)); }
    if (node.todo) { box.appendChild(el('p', 'lp-pos-label', 'Still working out')); box.appendChild(el('p', 'lp-prose', node.todo)); }
    const meta = el('p', 'lp-hint');
    meta.textContent = [node.tier, node.confidence].filter(Boolean).join(' · ');
    if (meta.textContent) box.appendChild(meta);
  }
  const actions = el('div', 'lp-mine-actions');
  const edit = el('a', null, node ? 'Edit this belief' : 'Answer this question');
  edit.href = '/edit?open=' + encodeURIComponent(doctrine.slug);
  actions.appendChild(edit);
  const compare = el('a', null, 'Compare this doctrine');
  compare.href = '/compare?doctrine=' + encodeURIComponent(doctrine.id);
  actions.appendChild(compare);
  box.appendChild(actions);
  return box;
}

async function renderDoctrine(corpus, doctrine) {
  const host = $('lp-doctrine-body');
  host.textContent = '';

  // 1. question (the page title, via mount) + framing.
  if (doctrine.framing) host.appendChild(el('p', 'lp-prose', doctrine.framing));

  // 1b. Why this doctrine sits at the tier the chip shows. The index can only
  // fit the chip; this is where the sentence behind it belongs.
  const tn = tierNote(doctrine);
  if (tn) host.appendChild(tn);

  // 2. learn_note, if present.
  if (doctrine.learn_note) {
    const sec = el('div', 'lp-section');
    sec.appendChild(el('h2', null, 'History and terms'));
    sec.appendChild(el('p', 'lp-prose', doctrine.learn_note));
    host.appendChild(sec);
  }

  // 3. key texts.
  if (doctrine.refs) {
    const sec = el('div', 'lp-section');
    sec.appendChild(el('h2', null, 'Key texts'));
    sec.appendChild(refPills(doctrine.refs));
    host.appendChild(sec);
  }

  // 4. the positions, side by side.
  const positions = orderedPositions(doctrine);
  const posSec = el('div', 'lp-section');
  posSec.appendChild(el('h2', null, 'The positions'));
  const grid = el('div', 'lp-positions');
  for (const position of positions) grid.appendChild(positionCard(doctrine, position));
  posSec.appendChild(grid);
  host.appendChild(posSec);

  // 5. who holds what.
  const whoSec = el('div', 'lp-section');
  whoSec.appendChild(el('h2', null, 'Who holds what'));
  whoSec.appendChild(whoHoldsWhat(corpus, doctrine, positions));
  host.appendChild(whoSec);

  // 6. my own answer, if signed in.
  const mine = await myOwnAnswer(doctrine);
  if (mine) {
    const mineSec = el('div', 'lp-section');
    mineSec.appendChild(el('h2', null, 'My own answer'));
    mineSec.appendChild(mine);
    host.appendChild(mineSec);
  }

  // 7. sources — the doctrine's, then every position's, deduplicated.
  const sources = dedupeSources([doctrine.sources, ...positions.map(p => p.sources)]);
  if (sources.length) {
    const srcSec = el('div', 'lp-section');
    srcSec.appendChild(el('h2', null, 'Sources'));
    const box = el('div', 'lp-sources');
    for (const s of sources) box.appendChild(sourceLine(s));
    srcSec.appendChild(box);
    host.appendChild(srcSec);
  }

  showScreen('doctrine');
}

/* ----------------------------------------------------------- tradition index */

function renderTradition(corpus, t) {
  const host = $('lp-tradition-body');
  host.textContent = '';

  const lead = el('p', 'lp-lead');
  lead.appendChild(document.createTextNode('Every doctrine this tradition takes a position on. '));
  const mapLink = el('a', null, 'Read the generated map');
  mapLink.href = '/view?tradition=' + encodeURIComponent(t.id);
  lead.appendChild(mapLink);
  lead.appendChild(document.createTextNode('.'));
  host.appendChild(lead);

  for (const group of domainGroups(corpus)) {
    const rows = [];
    for (const doctrine of group.doctrines) {
      const overrides = doctrine.tradition_overrides || {};
      if (overrides[t.id]) {
        rows.push({ doctrine, hold: overrides[t.id].hold, stanceText: null, citation: overrides[t.id].citation });
        continue;
      }
      for (const position of doctrine.positions || []) {
        const h = (position.held_by || []).find(x => x.tradition === t.id);
        if (h) {
          rows.push({ doctrine, hold: position.hold, stanceText: STANCE_TEXT[h.stance] || null, citation: h.citation });
          break;
        }
      }
    }
    if (!rows.length) continue;

    const box = el('div', 'lp-domain');
    box.appendChild(el('h2', null, group.name));
    const list = el('div', 'lp-rows');
    for (const row of rows) {
      const card = el('div', 'lp-pos');
      const link = el('a', null, row.doctrine.node_title);
      link.href = '/learn?doctrine=' + encodeURIComponent(row.doctrine.id);
      const h3 = el('h3');
      h3.appendChild(link);
      card.appendChild(h3);
      if (row.hold) card.appendChild(el('p', 'lp-prose', row.hold));
      if (row.stanceText) {
        card.appendChild(el('p', 'lp-hint',
          row.stanceText.charAt(0).toUpperCase() + row.stanceText.slice(1) + '.'));
      }
      if (row.citation) {
        const p = el('p', 'lp-hint');
        p.appendChild(citeLink(row.citation, row.citation, row.citation, null));
        card.appendChild(p);
      }
      list.appendChild(card);
    }
    box.appendChild(list);
    host.appendChild(box);
  }

  showScreen('tradition');
}

/* -------------------------------------------------------------------- main */

/* mount() replaces #tmChrome with the rendered header on its first call and
   does nothing on a second (chrome.js: "if (!host) return"), so the title
   for whichever view is showing has to be known before the one call is
   made — not decided by a per-view function that might call mount() again
   after the header already exists. */
async function main() {
  const corpus = await loadCorpus();
  if (!corpus) { mount('Learn'); return; }

  const params = new URLSearchParams(location.search);
  const doctrineId = params.get('doctrine');
  const traditionId = params.get('tradition');

  if (doctrineId) {
    const doctrine = WG.findDoctrine(corpus, doctrineId);
    mount(doctrine ? doctrine.question : 'Learn');
    if (!doctrine) { notFound('No such doctrine: ' + doctrineId); return; }
    await renderDoctrine(corpus, doctrine);
  } else if (traditionId) {
    const t = traditionById(corpus, traditionId);
    mount(t ? t.display_name : 'Learn');
    if (!t) { notFound('No such tradition: ' + traditionId); return; }
    renderTradition(corpus, t);
  } else {
    mount('Learn');
    renderIndex(corpus);
  }
}

main();
