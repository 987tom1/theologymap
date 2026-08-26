/* web/wizard.js — the /wizard controller. Screens, state, fetch, save.
   Spec: docs/hosting/phase-4-design.md section 5.3.

   An ES module, like web/chrome.js: session.js exports named bindings and puts
   nothing on window. editor-core.js and wizard-generate.js are the two
   exceptions — both are UMD, shared with the offline editor and with Node, so
   wizard.html loads them as classic scripts and they arrive on window.

   This file holds NO model logic. Ordering, node building, link pruning,
   per-area progress and "is this answered" all live in
   engine/wizard-generate.js, which is pure and tested from the command line;
   serialising lives in engine/editor-core.js. If something here starts sorting
   doctrines or deciding what counts as answered, it is a duplicate. */
import { getUser, apiFetch, showError } from '/web/session.js';
import { mount } from '/web/chrome.js';
// web/refs.js is a sibling agent's module. Contract: citationUrl(label,
// citation) always returns a usable https URL — a curated table for the works
// that recur, a search fallback for the long tail. There is exactly one
// implementation of that and it is not this file.
import { citationUrl } from '/web/refs.js';

const WG = window.WizardGenerate;
const Core = window.EditorCore;
const $ = (id) => document.getElementById(id);

const LENS_KEY = 'tmm.wizard.tradition';

/* The stance vocabulary in plain English, in ONE place. Design section 4.4
   defines the five; phase 6's learn page reads the same field, so if these
   sentences ever move they move once. */
const STANCE_TEXT = {
  confessional: 'defined in its confessions',
  majority: 'the majority view in practice',
  permitted: 'one of several views its formularies allow',
  minority: 'a minority stream within it',
  historic: 'held historically, less common now',
};
/* The tier ramp is engine/render.py's, declared as CSS variables in
   wizard.html. Referencing the variables rather than the hexes keeps one copy
   of the colours in this repo's CSS and none in its JS. */
const TIER_VAR = {
  'T1': 'var(--t1)', 'T1.5': 'var(--t1-5)', 'T2': 'var(--t2)',
  'T2.5': 'var(--t2-5)', 'T3': 'var(--t3)', 'T4': 'var(--t4)',
};

/* ------------------------------------------------------------------- state */

let user = null;
let corpus = null;
let traditions = [];        // the registry, as a flat array
let domains = [];           // the parsed map — the model everything mutates
let token = null;           // updated_at, the concurrency token
let order = [];             // WG.orderedDoctrines(corpus), computed once
let idx = 0;                // which doctrine is on screen
let lens = '';              // tradition id, '' for "I'd rather not say"
let lensReturn = 'intro';   // which screen the tradition picker was opened from
let chosen = null;          // { kind, position, hold } for the doctrine on screen
let controls = null;        // the live tier/confidence/hold/study inputs
let isPublic = true;
let chromeEl = null;        // the site nav header, once chrome.js has mounted it
let busy = false;

/* --------------------------------------------------------------- utilities */

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(cls, text, onClick) {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function labelled(text) { return el('p', 'lab', text); }

function tradition(id) {
  return traditions.find(t => t.id === id) || null;
}

/* Every citation the wizard shows is a link. A real `url` in the corpus wins;
   refs.js supplies one for everything else, so a printed confession is still
   one tap from the text of it. */
function citeLink(text, label, citation, url) {
  const a = el('a', null, text);
  a.href = url || citationUrl(label, citation || '');
  // A new tab, always: reading a confession is a detour, not an exit, and this
  // page holds an answer that has not been saved yet.
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  // Belt as well as braces. The new tab means the wizard is not navigated away
  // from, so nothing is lost either way — but somebody who reads a source,
  // closes the laptop and comes back tomorrow should find the answer they had
  // already chosen sitting in their map. Fire-and-forget: following the link
  // must never wait on a round trip, and commit() reports its own failures.
  a.addEventListener('click', () => { if (chosen) commit(currentAnswer()); });
  return a;
}

function sourceLine(src) {
  const p = el('p', 'wz-hint');
  const label = src.label + (src.citation ? ' — ' + src.citation : '');
  p.appendChild(citeLink(label, src.label, src.citation, src.url));
  return p;
}

/* The Read-more body. Its own class, NOT .wz-answer: sharing a class with the
   answer controls is what made select()'s clear-and-append duplicate the
   controls when Read more was open (see the report / debug.md). */
function explainer(note, sources) {
  const box = el('div', 'wz-explain');
  if (note) box.appendChild(el('p', 'wz-hint', note));
  for (const s of sources || []) box.appendChild(sourceLine(s));
  if ((sources || []).length) {
    box.appendChild(el('p', 'wz-quiet',
      'Sources open in a new tab, and anything answered on this screen is saved '
      + 'before the tab opens.'));
  }
  if (!box.childNodes.length) box.appendChild(el('p', 'wz-hint', 'No further notes on this one yet.'));
  return box;
}

/* ------------------------------------------------------------------ popover */

let openPop = null;

function closePop() {
  if (!openPop) return;
  openPop.pop.remove();
  openPop.btn.setAttribute('aria-expanded', 'false');
  openPop = null;
}
document.addEventListener('click', closePop);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });

/* Read more, anchored top-right of its card. Hover is unusable on touch, so
   this is click to open, click outside or Escape to dismiss. */
function readMoreButton(host, note, sources) {
  const btn = button('wz-more', 'Read more', (ev) => {
    ev.stopPropagation();
    const mine = openPop && openPop.btn === btn;
    closePop();
    if (mine) return;
    const pop = el('div', 'wz-pop');
    pop.appendChild(explainer(note, sources));
    pop.addEventListener('click', (e) => e.stopPropagation());
    host.appendChild(pop);
    btn.setAttribute('aria-expanded', 'true');
    openPop = { btn, pop };
  });
  btn.setAttribute('aria-expanded', 'false');
  return btn;
}

/* --------------------------------------------------------------- form bits */

let radioSeq = 0;

/* Tier and confidence are horizontal radio groups, not selects: one button per
   value, exactly one on. Real <input type=radio> visually restyled, so arrow
   keys, labels and the accessibility tree all come from the platform rather
   than from a hand-rolled role="radiogroup". They wrap; they never overflow. */
function radioGroup(values, value, ramp, label) {
  const wrap = el('div', 'wz-radios');
  wrap.setAttribute('role', 'radiogroup');
  if (label) wrap.setAttribute('aria-label', label);
  const name = 'wzr' + (++radioSeq);
  const items = [];
  const paint = () => {
    if (!ramp) return;
    for (const it of items) {
      const on = it.input.checked;
      it.span.style.background = on ? (TIER_VAR[it.v] || '') : '';
      it.span.style.color = on ? '#fff' : '';
      it.span.style.borderColor = on ? 'transparent' : '';
    }
  };
  for (const v of values) {
    const label = el('label', 'wz-radio');
    const input = el('input');
    input.type = 'radio';
    input.name = name;
    input.value = v;
    if (v === value) input.checked = true;
    const span = el('span', null, v);
    label.appendChild(input);
    label.appendChild(span);
    input.addEventListener('change', paint);
    items.push({ input, span, v });
    wrap.appendChild(label);
  }
  if (!items.some(i => i.input.checked) && items.length) items[0].input.checked = true;
  paint();
  return { wrap, get: () => (items.find(i => i.input.checked) || items[0]).v };
}

function textField(label, value, rows) {
  const wrap = el('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '4px';
  wrap.appendChild(labelled(label));
  const box = el('div', 'wz-holdfield');
  const input = el('textarea');
  input.rows = rows || 2;
  input.value = value || '';
  box.appendChild(input);
  wrap.appendChild(box);
  return { wrap, input };
}

function studyCheck() {
  const check = el('label', 'wz-check');
  const cb = el('input');
  cb.type = 'checkbox';
  check.appendChild(cb);
  const text = el('span');
  text.appendChild(el('strong', null, '#study'));
  text.appendChild(document.createTextNode(' — I still need to work this out'));
  check.appendChild(text);
  return { check, cb };
}

/* ------------------------------------------------------------------ screens */

const SCREENS = ['intro', 'lens', 'question', 'home', 'area'];

function showScreen(name) {
  for (const s of SCREENS) $('screen-' + s).hidden = (s !== name);
  // One header at a time. The question screen keeps the wizard's own brand
  // block plus the crumb and its two controls; every other screen wears the
  // site nav, which is where "My map", the gallery and sign-out live.
  const q = (name === 'question');
  $('wz-header').hidden = !q;
  if (chromeEl) chromeEl.hidden = q;
  closePop();
  window.scrollTo(0, 0);
}

function lensLabel() {
  const t = lens ? tradition(lens) : null;
  return 'Shown first: ' + (t ? t.short_name : 'no tradition') + ' ▾';
}

function paintLensLabels() {
  $('wz-lens-btn').textContent = lensLabel();
  $('home-lens-btn').textContent = lensLabel();
}

/* ------------------------------------------------------------- lens screen */

function openLens(from) {
  lensReturn = from;
  renderLens();
}

function renderLens() {
  const host = $('lens-list');
  host.textContent = '';
  const inUi = traditions.filter(t => t.in_ui).sort((a, b) => a.order - b.order);

  const card = (id, name, blurb, cls) => {
    const c = el('button', 'lens' + (cls ? ' ' + cls : ''));
    c.type = 'button';
    c.appendChild(el('strong', null, name));
    c.appendChild(el('span', null, blurb));
    if (id === lens) c.classList.add('sel');
    c.addEventListener('click', () => {
      lens = id;
      try { localStorage.setItem(LENS_KEY, id); } catch { /* private mode */ }
      paintLensLabels();
      renderLens();
    });
    return c;
  };

  for (const t of inUi) host.appendChild(card(t.id, t.display_name, t.blurb));
  host.appendChild(card('', "I'd rather not say",
    'Answers stay in their own order, with no tradition surfaced first. '
    + 'Nothing about the questions changes.', 'lens-none'));
  showScreen('lens');
}

/* Changing the tradition mid-map must leave the person on the question they
   are on and merely re-order its position cards — it used to run
   startQuestions(), which jumped to the next unanswered doctrine and relabelled
   the crumb "question 1 of N". */
function leaveLens() {
  if (lensReturn === 'question') renderQuestion(idx);
  else if (lensReturn === 'home') renderHome();
  else startQuestions();
}

/* --------------------------------------------------------- question screen */

/* The lens orders positions; it never filters and never pre-fills. An
   `outside` position sorts last whatever the lens says (design section 4.5). */
function orderedPositions(doctrine) {
  const held = p => (p.held_by || []).some(h => h.tradition === lens);
  return (doctrine.positions || []).map((p, i) => ({ p, i })).sort((a, b) => {
    const outside = (x) => (x.p.orthodoxy === 'outside' ? 1 : 0);
    return outside(a) - outside(b)
      || (lens ? (held(b.p) ? 1 : 0) - (held(a.p) ? 1 : 0) : 0)
      || a.i - b.i;
  }).map(x => x.p);
}

function chipRow(position) {
  const row = el('div', 'wz-chips');
  const ids = (position.held_by || []).map(h => h.tradition)
    .filter(id => tradition(id));
  // The lens tradition's chip comes first and is filled, so the person can see
  // at a glance where their own tradition sits. It is a label, not a ranking.
  ids.sort((a, b) => (b === lens ? 1 : 0) - (a === lens ? 1 : 0));
  const shown = ids.slice(0, 4);
  for (const id of shown) {
    row.appendChild(el('span', 'tchip' + (id === lens ? ' tchip-lens' : ''),
      tradition(id).short_name));
  }
  if (ids.length > shown.length) {
    row.appendChild(el('span', 'tchip', '+' + (ids.length - shown.length) + ' more'));
  }
  return row;
}

function whoBelievesWhat(doctrine) {
  const body = $('who-body');
  body.textContent = '';
  const dl = el('dl', 'who');
  for (const position of doctrine.positions || []) {
    for (const h of position.held_by || []) {
      const t = tradition(h.tradition);
      if (!t) continue;
      dl.appendChild(el('dt', null, t.display_name));
      const dd = el('dd');
      const words = STANCE_TEXT[h.stance];
      if (words) {
        dd.appendChild(el('span', 'stance',
          words.charAt(0).toUpperCase() + words.slice(1) + '.'));
        dd.appendChild(document.createTextNode(' ' + position.label + '.'));
      }
      if (h.note) dd.appendChild(document.createTextNode(' ' + h.note));
      if (h.citation) {
        dd.appendChild(document.createTextNode(' '));
        const em = el('em');
        em.appendChild(citeLink(h.citation, h.citation, h.citation, null));
        dd.appendChild(em);
      }
      dl.appendChild(dd);
    }
  }
  body.appendChild(dl);
  body.appendChild(el('p', 'wz-quiet',
    'Chips and stances describe who holds what. They are not a ranking, and '
    + 'they are not a recommendation.'));
}

/* The controls that appear in a chosen card's slot: tier, confidence, #study.
   No glosses — the two scales are explained once, on the launchpad. */
function answerControls(doctrine, position, kind) {
  const box = el('div', 'wz-fields');
  const state = {};
  const grid = el('div', 'wz-controls');

  const tierCell = el('div');
  tierCell.appendChild(labelled('Tier'));
  const startTier = kind === 'open'
    ? ((doctrine.open || {}).tier || doctrine.suggested_tier)
    : ((position && position.tier) || doctrine.suggested_tier);
  const tier = radioGroup(Core.TIERS, startTier, true, 'Tier');
  tierCell.appendChild(tier.wrap);
  grid.appendChild(tierCell);
  state.tier = tier;

  const confCell = el('div');
  confCell.appendChild(labelled('Confidence'));
  if (kind === 'open') {
    // "I don't know" is a first-class answer and its confidence is the whole
    // point of it, so it is stated rather than offered (decisions.md).
    confCell.appendChild(el('p', 'wz-hint', 'open'));
    state.todo = $('open-todo');
  } else {
    const conf = radioGroup(Core.CONFIDENCES,
      (position && position.confidence_default) || 'confident', false, 'Confidence');
    confCell.appendChild(conf.wrap);
    state.confidence = conf;
  }
  grid.appendChild(confCell);
  box.appendChild(grid);

  if (kind !== 'open') {
    const s = studyCheck();
    box.appendChild(s.check);
    state.study = s.cb;
  }

  controls = state;
  return box;
}

/* One selection at a time, across position cards, the open tile and the manual
   tile. Each of those carries a .wz-slot; nothing else in the question screen
   does, so the clear-and-fill below can never collide with a Read-more body
   the way the old shared .wz-answer class did. */
function select(card, kind, doctrine, position, holdEl, precomputed) {
  for (const c of document.querySelectorAll('#screen-question .sel')) c.classList.remove('sel');
  for (const s of document.querySelectorAll('#screen-question .wz-slot')) s.textContent = '';
  for (const t of document.querySelectorAll('#screen-question .wz-tick')) t.hidden = true;

  chosen = { kind, position, hold: holdEl };
  card.classList.add('sel');
  const tick = card.querySelector('.wz-tick');
  if (tick) tick.hidden = false;

  if (precomputed) { controls = precomputed; return; }
  const slot = card.querySelector('.wz-slot');
  if (slot) slot.appendChild(answerControls(doctrine, position, kind));
}

function tools(card, extra) {
  const box = el('div', 'wz-tools');
  const tick = el('span', 'wz-tick', '✓');
  tick.hidden = true;
  box.appendChild(tick);
  if (extra) box.appendChild(extra);
  card.appendChild(box);
  return box;
}

function renderQuestion(i) {
  try {
    renderQuestionUnsafe(i);
  } catch (err) {
    // Nothing upstream of this call catches, so a throw here used to mean the
    // tap just did nothing with no explanation — see debug.md §T.
    console.error('renderQuestion failed', err);
    showError('Could not load that question. Try reloading the page — '
      + 'if this keeps happening, it may be a stale cached copy of the question set.');
  }
}

function renderQuestionUnsafe(i) {
  idx = i;
  chosen = null;
  controls = null;
  const doctrine = order[idx];
  const existing = existingNode(doctrine);

  $('wz-crumb').textContent =
    WG.domainName(corpus, doctrine) + ' · question ' + (idx + 1) + ' of ' + order.length;
  paintLensLabels();
  $('q-title').textContent = doctrine.question;
  $('q-framing').textContent = doctrine.framing || '';

  $('q-readmore').open = false;
  const rm = $('q-readmore-body');
  rm.textContent = '';
  rm.appendChild(explainer(doctrine.learn_note, doctrine.sources));

  const host = $('positions');
  host.textContent = '';
  for (const position of orderedPositions(doctrine)) {
    const card = el('div', 'wz-card');

    if (position.orthodoxy === 'outside') {
      card.appendChild(el('p', 'wz-outside', 'Outside the historic creeds'));
      card.appendChild(el('p', 'wz-outside-note', position.orthodoxy_note || ''));
    }

    const head = el('div', 'wz-card-h');
    head.appendChild(el('strong', null, position.label));
    card.appendChild(head);
    card.appendChild(chipRow(position));

    // The card's own description IS the editable field — there is no second
    // "What I hold" box repeating the same sentence underneath.
    const holdBox = el('div', 'wz-holdfield');
    const area = el('textarea');
    area.rows = 3;
    area.value = position.hold || '';
    holdBox.appendChild(area);
    card.appendChild(holdBox);
    const pick = () => {
      if (!chosen || chosen.position !== position) select(card, 'position', doctrine, position, area);
    };
    area.addEventListener('input', pick);
    area.addEventListener('focus', pick);

    card.appendChild(el('div', 'wz-slot'));
    const toolbox = tools(card);
    toolbox.appendChild(readMoreButton(toolbox, position.learn_detail, position.sources));

    card.addEventListener('click', pick);
    host.appendChild(card);

    // Back re-opens a doctrine with its previous answer selected. Which
    // position produced a node is not recorded in the file — that is a
    // deliberate format decision — so it is recovered the way phase 6 recovers
    // it: exact match on the hold sentence. No match means the person reworded
    // it, and nothing is preselected rather than something wrong.
    if (existing && existing.hold === position.hold) select(card, 'position', doctrine, position, area);
  }

  // ---- "I haven't worked this out yet"
  const open = $('open-answer');
  open.classList.remove('sel');
  open.querySelector('.wz-slot').textContent = '';
  if (!open.querySelector('.wz-tools')) tools(open);
  open.querySelector('.wz-tick').hidden = true;
  const todo = $('open-todo');
  todo.value = (doctrine.open || {}).todo || '';
  const pickOpen = () => {
    if (!chosen || chosen.kind !== 'open') select(open, 'open', doctrine, null, null);
  };
  open.onclick = pickOpen;
  todo.oninput = pickOpen;

  buildCustom(doctrine);

  if (existing && existing.confidence === 'open' && !chosen) select(open, 'open', doctrine, null, null);

  whoBelievesWhat(doctrine);
  $('who').open = false;
  $('q-back').hidden = (idx === 0);
  showScreen('question');
}

/* The manual tile: for somebody whose position is not among the offered ones.
   Promoted / optional exactly as phase 3 split them — What I hold, Tier,
   Confidence and #study shown directly; Why, What I'd reject, Still working
   out, Texts and Related behind a disclosure. */
function buildCustom(doctrine) {
  const card = $('custom-answer');
  card.classList.remove('sel');
  const host = $('custom-fields');
  host.textContent = '';
  if (!card.querySelector('.wz-tools')) tools(card);
  card.querySelector('.wz-tick').hidden = true;

  const state = {};
  const wrap = el('div', 'wz-fields');

  const hold = textField('What I hold', '', 3);
  state.hold = hold.input;
  wrap.appendChild(hold.wrap);

  const grid = el('div', 'wz-controls');
  const tierCell = el('div');
  tierCell.appendChild(labelled('Tier'));
  const tier = radioGroup(Core.TIERS, doctrine.suggested_tier, true, 'Tier');
  tierCell.appendChild(tier.wrap);
  grid.appendChild(tierCell);
  state.tier = tier;

  const confCell = el('div');
  confCell.appendChild(labelled('Confidence'));
  const conf = radioGroup(Core.CONFIDENCES, 'leaning', false, 'Confidence');
  confCell.appendChild(conf.wrap);
  grid.appendChild(confCell);
  state.confidence = conf;
  wrap.appendChild(grid);

  const s = studyCheck();
  wrap.appendChild(s.check);
  state.study = s.cb;

  const adv = el('details', 'optional');
  adv.appendChild(el('summary', null, 'Advanced'));
  const body = el('div', 'wz-fields');
  const why = textField('Why', '', 2);
  const vs = textField("What I'd reject", '', 2);
  const still = textField('Still working out', '', 2);
  const texts = textField('Texts', '', 1);
  texts.input.placeholder = '2 Tim 3:16-17; Heb 1:1-2';
  const related = textField('Related', '', 1);
  related.input.placeholder = 'Titles of other beliefs, comma separated';
  for (const f of [why, vs, still, texts, related]) body.appendChild(f.wrap);
  adv.appendChild(body);
  wrap.appendChild(adv);
  state.why = why.input;
  state.vs = vs.input;
  state.todo = still.input;
  state.refs = texts.input;
  state.links = related.input;

  host.appendChild(wrap);

  const pick = () => {
    if (!chosen || chosen.kind !== 'custom') {
      select(card, 'custom', doctrine, null, state.hold, state);
    }
  };
  card.onclick = pick;
  state.hold.oninput = pick;
}

function existingNode(doctrine) {
  for (const d of domains) {
    const n = d.nodes.find(x => x.slug === doctrine.slug);
    if (n) return n;
  }
  return null;
}

/* -------------------------------------------------------------- launchpad */

function renderHome() {
  const nodes = domains.reduce((a, d) => a.concat(d.nodes), []);
  $('home-beliefs').textContent = String(nodes.length);
  $('home-areas').textContent = String(domains.length);
  $('home-open').textContent = String(nodes.filter(n => (n.flags || []).includes('study')).length);

  const answered = WG.answeredSlugs(domains);
  const remaining = order.filter(d => !answered.has(d.slug));
  $('home-remaining').textContent = String(remaining.length);

  const bar = $('home-tierbar');
  bar.textContent = '';
  const parts = [];
  for (const tier of WG.TIER_ORDER) {
    const count = nodes.filter(n => n.tier === tier).length;
    if (!count) continue;
    const seg = el('span', 'wz-seg');
    seg.style.flex = String(count);
    seg.style.background = TIER_VAR[tier];
    bar.appendChild(seg);
    parts.push(tier + ' ' + count);
  }
  $('home-tiercounts').textContent = parts.join(' · ');

  const empty = nodes.length === 0;
  $('home-empty').hidden = !empty;
  $('home-full').hidden = empty;

  if (!empty) {
    if (remaining.length) {
      $('home-carry').hidden = false;
      $('home-carry-note').textContent =
        'Next question: ' + remaining[0].node_title.toLowerCase() + '.';
      $('home-carry').onclick = () => renderQuestion(orderIndexOf(remaining[0]));
    } else {
      $('home-carry').hidden = true;
    }
    renderAreas();
  }

  paintLensLabels();
  renderVisibility();
  showScreen('home');
}

function renderAreas() {
  const host = $('home-areas-list');
  host.textContent = '';
  for (const area of WG.domainProgress(domains, corpus)) {
    if (!area.total) continue;   // a manifest area with no questions published
    const row = el('div', 'wz-area');
    row.appendChild(el('span', 'nm', area.name));
    const done = area.answered >= area.total;
    row.appendChild(el('span', 'pg' + (done ? ' done' : ''),
      done ? 'all ' + area.total + ' answered' : area.answered + ' of ' + area.total));
    if (!done) {
      row.appendChild(button('wz-ghost', 'Next question', () => {
        const first = area.doctrines.find(d => d.status === 'unasked');
        const i = first ? order.findIndex(d => d.slug === first.slug) : -1;
        if (i >= 0) renderQuestion(i);
      }));
    }
    row.appendChild(button('wz-ghost', 'List questions', () => renderArea(area)));
    host.appendChild(row);
  }
}

const STATUS_TEXT = { answered: 'answered', open: 'open', unasked: 'not yet asked' };

/* One line per belief, and clicking it goes to /edit?open=<slug>, which
   already opens the editor on that belief with its area expanded and its title
   selected. There is deliberately no editing UI here — that route is the
   reason this screen can stay four lines long. An unresolvable slug is ignored
   silently by the editor, on purpose; nothing here needs to check. */
function renderArea(area) {
  $('area-title').textContent = area.name;
  $('area-sub').textContent =
    area.answered + ' of ' + area.total + ' answered. Open one to edit it.';
  const host = $('area-list');
  host.textContent = '';
  for (const d of area.doctrines) {
    const a = el('a', 'wz-qrow');
    a.href = '/edit?open=' + encodeURIComponent(d.slug);
    a.appendChild(el('span', null, d.node_title));
    a.appendChild(el('span', 'st', STATUS_TEXT[d.status]));
    host.appendChild(a);
  }
  showScreen('area');
}

/* Unlisting is not privacy and the wording must keep saying so: it takes the
   map out of the gallery and turns off the name-keyed render, and anyone
   already holding a link can still read it. Hence Unlist / Relist, never Hide. */
function renderVisibility() {
  $('home-vis-btn').textContent = isPublic ? 'Unlist' : 'Relist';
  $('home-vis-note').textContent = isPublic
    ? 'Listed in the gallery. Unlisting takes it out of the gallery and stops the '
      + 'name-keyed render. That is not privacy.'
    : 'Unlisted: out of the gallery, and the name-keyed render is off. That is not '
      + 'privacy — anyone already holding a link can still read it.';
}

async function toggleVisibility() {
  const btn = $('home-vis-btn');
  btn.disabled = true;
  let res = null;
  try {
    res = await apiFetch('/api/map', {
      method: 'POST',
      body: { action: 'set_visibility', user_id: user.id, is_public: !isPublic },
    });
  } catch { /* apiFetch showed the banner */ }
  btn.disabled = false;
  if (res && typeof res.is_public === 'boolean') {
    isPublic = res.is_public;
    renderVisibility();
  }
}

/* ------------------------------------------ start from someone else's map */

/* Lifted verbatim in behaviour from the deleted web/first-run.js, which was the
   only caller and lived on the deleted /app. The server guards this: copy_from
   only works on an empty map. */
async function openPicker() {
  const dlg = el('dialog', 'tm-picker');
  dlg.appendChild(el('h2', null, "Start from someone else's map"));
  dlg.appendChild(el('p', 'tm-note',
    'It becomes my own copy to change however I like. Their map is not affected, '
    + 'and the card says whose it was until I edit it.'));
  const grid = el('div', 'tm-grid');
  dlg.appendChild(grid);
  const close = el('button', null, 'Cancel');
  close.addEventListener('click', () => dlg.close());
  dlg.appendChild(close);
  document.body.appendChild(dlg);
  dlg.showModal();

  let maps;
  try {
    maps = await apiFetch('/api/gallery');
  } catch {
    dlg.close();
    return;
  }
  maps = (maps || []).filter(m => m.node_count > 0 && m.name !== user.name);
  if (!maps.length) {
    grid.appendChild(el('p', 'tm-stat', 'No maps to start from yet. Try one of the other two.'));
    return;
  }
  for (const m of maps) {
    const c = el('div', 'tm-card');
    c.appendChild(el('h3', null, m.name));
    c.appendChild(el('p', null,
      m.node_count + ' belief' + (m.node_count === 1 ? '' : 's')
      + ' · ' + m.open_count + ' open question' + (m.open_count === 1 ? '' : 's')));
    c.appendChild(button(null, 'Start from this map', async () => {
      if (busy) return;
      busy = true;
      try {
        await apiFetch('/api/map', {
          method: 'POST',
          body: { action: 'copy_from', user_id: user.id, source_name: m.name },
        });
        // The map, the token and every count on the launchpad just changed
        // server-side. Re-entering through main() is one line and cannot drift
        // from it.
        location.reload();
      } catch {
        busy = false;
        dlg.close();
      }
    }));
    grid.appendChild(c);
  }
}

/* ------------------------------------------------------------------ saving */

function currentAnswer() {
  if (!chosen) return null;
  const doctrine = order[idx];
  const base = { doctrineId: doctrine.id, revisit: !!existingNode(doctrine) };

  if (chosen.kind === 'open') {
    return Object.assign(base, {
      kind: 'open', tier: controls.tier.get(), todo: controls.todo.value,
    });
  }
  if (chosen.kind === 'custom') {
    // Nothing written, nothing to save. An empty belief is worse than no
    // belief: it takes the doctrine out of the question queue for good.
    if (!controls.hold.value.trim()) return null;
    return Object.assign(base, {
      kind: 'custom',
      hold: controls.hold.value,
      why: controls.why.value,
      vs: controls.vs.value,
      todo: controls.todo.value,
      refs: controls.refs.value,
      links: controls.links.value.split(',').map(s => Core.slugify(s.trim())).filter(Boolean),
      tier: controls.tier.get(),
      confidence: controls.confidence.get(),
      study: controls.study.checked,
    });
  }
  return Object.assign(base, {
    kind: 'position', positionId: chosen.position.id,
    hold: chosen.hold.value, tier: controls.tier.get(),
    confidence: controls.confidence.get(), study: controls.study.checked,
  });
}

/* Deliberately NOT apiFetch: that helper pops the shared error banner on every
   non-2xx reply, and a 409 here is an expected, silently-recoverable state —
   another tab saved in between — not something to alarm somebody with
   mid-question. Every other call on this page still goes through apiFetch. */
async function postMap(markdown) {
  let res;
  try {
    res = await fetch('/api/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, markdown, expected_updated_at: token }),
    });
  } catch {
    return { status: 0, body: null };
  }
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function commit(answer) {
  if (!answer) return true;
  for (let attempt = 0; attempt < 2; attempt++) {
    WG.applyAnswer(domains, corpus, answer);
    WG.pruneLinks(domains);   // every serialize, never once at the end (5.6)
    const { status, body } = await postMap(Core.serialize(domains));
    if (status === 200 && body) {
      token = body.updated_at;
      return true;
    }
    if (status !== 409 || attempt === 1) {
      showError(status === 409
        ? 'This map was changed somewhere else — reload to carry on.'
        : ((body && body.message) || 'That answer could not be saved. Nothing was lost — try again.'));
      return false;
    }
    // First 409: re-read, re-parse, re-apply this one answer. Never force-save.
    const fresh = await apiFetch('/api/map?user_id=' + encodeURIComponent(user.id));
    if (!fresh) return false;
    domains = Core.parse(fresh.markdown);
    token = fresh.updated_at;
    answer = Object.assign({}, answer, { revisit: true });
  }
  return false;
}

async function advance(then) {
  const btn = $('q-next');
  btn.disabled = true;
  const ok = await commit(currentAnswer());
  btn.disabled = false;
  if (ok) then();
}

/* ------------------------------------------------------------------- start */

async function loadCorpus() {
  const get = async (path) => {
    const res = await fetch('/content/wizard/' + path);
    return res.ok ? res.json() : null;
  };
  const manifest = await get('manifest.json');
  const registry = await get('traditions.json');
  if (!manifest || !registry) {
    showError('The question set could not be loaded. Please try again shortly.');
    return null;
  }
  const files = {};
  let missing = 0;
  for (const entry of manifest.domains || []) {
    const data = await get(entry.file);
    // A domain phase 5 has not written yet is the normal state, not an error.
    if (data) files[entry.id] = data; else missing++;
  }
  if (missing) console.info('wizard: ' + missing + ' domain file(s) not published yet; skipped.');
  return { manifest, traditions: registry, domains: files };
}

// WG.nextDoctrine() calls WG.orderedDoctrines() itself, which rebuilds every
// doctrine object fresh (allDoctrines() wraps each with Object.assign) — so
// its result is never reference-equal to anything in `order`, and
// order.indexOf(next) silently returned -1 every time this ran, crashing
// renderQuestion(-1) downstream. Match on slug instead of identity (debug.md §T).
function orderIndexOf(doctrine) {
  return order.findIndex(d => d.slug === doctrine.slug);
}

function startQuestions() {
  let next;
  try {
    next = WG.nextDoctrine(domains, corpus);
  } catch (err) {
    console.error('startQuestions failed', err);
    showError('Could not load the question set. Try reloading the page — '
      + 'if this keeps happening, it may be a stale cached copy of it.');
    return;
  }
  if (next) renderQuestion(orderIndexOf(next)); else renderHome();
}

async function main() {
  user = getUser();
  // /app is gone; the landing page carries sign-in now.
  if (!user) { location.href = '/'; return; }

  mount('Build a map');
  chromeEl = document.querySelector('header.tm-chrome');

  corpus = await loadCorpus();
  if (!corpus) return;
  traditions = corpus.traditions.traditions || [];
  order = WG.orderedDoctrines(corpus);
  $('intro-count').textContent = String(order.length);

  const map = await apiFetch('/api/map?user_id=' + encodeURIComponent(user.id));
  if (!map) return;
  domains = Core.parse(map.markdown);
  token = map.updated_at;
  isPublic = map.is_public !== false;

  try { lens = localStorage.getItem(LENS_KEY) || ''; } catch { lens = ''; }
  paintLensLabels();

  $('intro-start').addEventListener('click', () => {
    if (lens) startQuestions(); else openLens('intro');
  });
  $('lens-next').addEventListener('click', leaveLens);
  $('wz-lens-btn').addEventListener('click', () => openLens('question'));
  $('home-lens-btn').addEventListener('click', () => openLens('home'));
  $('q-back').addEventListener('click', () => { if (idx > 0) renderQuestion(idx - 1); });
  $('q-next').addEventListener('click', () => advance(() => {
    if (idx + 1 < order.length) renderQuestion(idx + 1); else renderHome();
  }));
  // Finish here saves and goes back to the launchpad. No confirmation, no
  // warning, no guilt — that is the whole point of it (design section 5.3).
  // An in-page screen change, not a navigation: the launchpad IS this page.
  $('wz-finish').addEventListener('click', () => advance(renderHome));
  $('area-back').addEventListener('click', renderHome);
  $('home-start').addEventListener('click', startQuestions);
  $('home-copy').addEventListener('click', () => { if (!busy) openPicker(); });
  $('home-vis-btn').addEventListener('click', toggleVisibility);

  if (!order.length) {
    showError('There are no questions published yet.');
    return;
  }
  // Resume falls out of the map itself: a doctrine whose slug already has a
  // node counts as answered, so there is no wizard state on the server and
  // nothing in localStorage that can go stale (design 5.4). A genuine
  // first-timer gets the intro; everybody else lands on the launchpad.
  if (WG.answeredSlugs(domains).size) renderHome();
  else showScreen('intro');
}

main();
