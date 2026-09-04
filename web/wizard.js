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
import { mount, el } from '/web/chrome.js';
// web/refs.js is a sibling agent's module. Contract: citationUrl(label,
// citation) always returns a usable https URL — a curated table for the works
// that recur, a search fallback for the long tail. There is exactly one
// implementation of that and it is not this file.
import { citeLink as sharedCiteLink, sourceLine as sharedSourceLine } from '/web/refs.js';
// Phase 6: the corpus loader and the stance vocabulary moved to
// web/corpus.js so /learn and /compare read the same two things.
import { loadCorpus, STANCE_TEXT } from '/web/corpus.js';

const WG = window.WizardGenerate;
const Core = window.EditorCore;
// UMD, loaded as a classic script by wizard.html. One thing is used from it —
// normalise — so that "is this the position that produced this node?" is
// decided by the same rule here and in compare-core.js:109.
const CompareCore = window.CompareCore;
const $ = (id) => document.getElementById(id);

const LENS_KEY = 'tmm.wizard.tradition';
/* "Ignore for now" is a third state and lives only in this browser: a slug list
   under one key beside the lens. It is a preference, not content — nothing in
   the map records it — so a private-mode browser degrades to "nothing ignored"
   rather than throwing. Every read and write is wrapped, exactly as the lens
   read is. */
const IGNORE_KEY = 'tmm.wizard.ignored';

/* The tier ramp is engine/render.py's, declared as CSS variables on :root in
   engine/theme.css, which wizard.html links. Referencing the variables rather
   than the hexes keeps one copy of the colours in this repo's CSS and none in
   its JS. */
const TIER_VAR = {
  'T1': 'var(--t1)', 'T1.5': 'var(--t1-5)', 'T2': 'var(--t2)',
  'T2.5': 'var(--t2-5)', 'T3': 'var(--t3)', 'T4': 'var(--t4)',
};

/* The same six strings as engine/editor.html's TIER_GLOSS and render.py's
   TIER_META. This is the only screen in the product where a person is asked to
   *set* a tier, so the values carry their meaning here too — as `title`, at
   zero screen cost. The launchpad's one-line legend (wizard.html, .wz-tier)
   is the prose version; neither replaces the other. */
const TIER_GLOSS = {
  'T1': 'Essential to the gospel',
  'T1.5': 'Near-essential',
  'T2': 'Church-defining',
  'T2.5': 'Strains partnership',
  'T3': 'Important, not divisive',
  'T4': 'Matters of liberty',
};

/* ------------------------------------------------------------------- state */

let user = null;
let corpus = null;
let traditions = [];        // the registry, as a flat array
let domains = [];           // the parsed map — the model everything mutates
let token = null;           // updated_at, the concurrency token
let order = [];             // WG.orderedDoctrines(corpus), computed once
let idx = 0;                // which doctrine is on screen
// tradition id; '' is the real answer "I'd rather not say", null is "not asked
// yet". '' is falsy, so a truthiness test cannot tell the two apart and the
// lens screen re-asked a question that had already been answered. Every "has
// this been answered?" test here is `lens !== null`.
let lens = null;
let lensReturn = 'intro';   // which screen the tradition picker was opened from
let ignored = new Set();    // slugs put aside with "Ignore for now"
let returnTo = null;        // area id the question screen was entered from, or null
let chosen = null;          // { kind, position, hold } for the doctrine on screen
let controls = null;        // the live tier/confidence/hold/study inputs
let chromeEl = null;        // the site nav header, once chrome.js has mounted it
let busy = false;

/* --------------------------------------------------------------- utilities */

function button(cls, text, onClick) {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function labelled(text) { return el('p', 'lab', text); }

function loadIgnored() {
  try { ignored = new Set(JSON.parse(localStorage.getItem(IGNORE_KEY)) || []); }
  catch { ignored = new Set(); }
}

function saveIgnored() {
  try { localStorage.setItem(IGNORE_KEY, JSON.stringify([...ignored])); }
  catch { /* private mode: the list is a preference, losing it costs nothing */ }
}

function tradition(id) {
  return traditions.find(t => t.id === id) || null;
}

/* Every citation the wizard shows is a link. A real `url` in the corpus wins;
   refs.js supplies one for everything else, so a printed confession is still
   one tap from the text of it. citeLink/sourceLine themselves are shared with
   web/learn.js (web/refs.js); what's wizard-specific is the onFollow below. */
// Belt as well as braces. The new tab means the wizard is not navigated away
// from, so nothing is lost either way — but somebody who reads a source,
// closes the laptop and comes back tomorrow should find the answer they had
// already chosen sitting in their map. Still not awaited — following a link
// must never wait on a round trip, and commit() reports its own failures —
// but commit() now holds `busy` for its whole run, so this can no longer
// interleave with the Next button's commit and have applyAnswer compute
// `revisit` from a model the other one is halfway through rebuilding.
const onFollow = () => { if (chosen) commit(currentAnswer()); };

function citeLink(text, label, citation, url) {
  return sharedCiteLink(el, text, label, citation, url, onFollow);
}

function sourceLine(src) {
  return sharedSourceLine(el, 'wz-hint', src, onFollow);
}

/* The Read-more body. Its own class, NOT .wz-answer: sharing a class with the
   answer controls is what made select()'s clear-and-append duplicate the
   controls when Read more was open (see the report / debug.md).

   `newTab` is set only by the doctrine-level explainer. The notice is a locked
   condition and its wording does not change — but it used to render again in
   every single position's popover on the same screen, which is the same
   promise up to eight times per question. Once per question is enough. */
function explainer(note, sources, newTab) {
  const box = el('div', 'wz-explain');
  if (note) box.appendChild(el('p', 'wz-hint', note));
  for (const s of sources || []) box.appendChild(sourceLine(s));
  if (newTab && (sources || []).length) {
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
    // `ramp` is true only for the tier group, which is what makes it the
    // identifier for "these values are tiers" here.
    if (ramp && TIER_GLOSS[v]) label.title = TIER_GLOSS[v];
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
  text.appendChild(document.createTextNode(' — you still need to work this out'));
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
    // The choice is single-select and changeable at any point from a header
    // control on every screen, so a Done press after it carried no
    // information. Picking a card IS the answer; it advances.
    c.addEventListener('click', () => {
      lens = id;
      try { localStorage.setItem(LENS_KEY, id); } catch { /* private mode */ }
      paintLensLabels();
      leaveLens();
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
   The tier values carry TIER_GLOSS as `title` (radioGroup): an earlier round
   dropped the glosses on the grounds that the launchpad explains both scales,
   and it did not explain either. It does now, and so does this. */
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

  chosen = { kind, position, hold: holdEl };
  card.classList.add('sel');

  if (precomputed) { controls = precomputed; return; }
  const slot = card.querySelector('.wz-slot');
  if (slot) slot.appendChild(answerControls(doctrine, position, kind));
}

function tools(card, extra) {
  const box = el('div', 'wz-tools');
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

  // Every word of prose about this doctrine is behind the disclosure — the
  // framing first, then the learn note and the sources.
  $('q-readmore').open = false;
  const rm = $('q-readmore-body');
  rm.textContent = '';
  if (doctrine.framing) rm.appendChild(el('p', 'wz-framing', doctrine.framing));
  // The one place the new-tab notice renders: doctrine level, once per question.
  rm.appendChild(explainer(doctrine.learn_note, doctrine.sources, true));

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
    area.rows = 5;
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
    // The popover's host is the CARD, not the tools box: .wz-tools is a narrow
    // absolutely-positioned box, so anchoring to it put the popover off the
    // left edge of a phone. .wz-card is position:relative already.
    toolbox.appendChild(readMoreButton(card, position.learn_detail, position.sources));

    card.addEventListener('click', pick);
    host.appendChild(card);

    // Back re-opens a doctrine with its previous answer selected. Which
    // position produced a node is not recorded in the file — that is a
    // deliberate format decision — so it is recovered the way phase 6 recovers
    // it: match on the hold sentence, through CompareCore.normalise, which is
    // the rule compare-core.js:109 already uses. Two rules for one question is
    // how the wizard preselected nothing on a map /compare called a match.
    // No match still means the person reworded it, and nothing is preselected
    // rather than something wrong.
    if (existing && CompareCore.normalise(existing.hold) === CompareCore.normalise(position.hold)) {
      select(card, 'position', doctrine, position, area);
    }
  }

  // ---- "I haven't worked this out yet"
  const open = $('open-answer');
  open.classList.remove('sel');
  open.querySelector('.wz-slot').textContent = '';
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
  $('q-back').hidden = (idx === 0 && !returnTo);
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
  const remaining = order.filter(d => !answered.has(d.slug) && !ignored.has(d.slug));
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

  // There is no separate empty launchpad any more: the three first-run offers
  // live on #screen-intro, which is the screen a new account actually lands
  // on. This one always shows Carry on and the areas, with or without nodes.
  $('home-full').hidden = false;
  if (remaining.length) {
    $('home-carry').hidden = false;
    $('home-carry-note').textContent =
      'Next question: ' + remaining[0].node_title.toLowerCase() + '.';
    $('home-carry').onclick = () => {
      returnTo = null;
      renderQuestion(orderIndexOf(remaining[0]));
    };
  } else {
    $('home-carry').hidden = true;
  }
  renderAreas();

  paintLensLabels();
  showScreen('home');
}

/* Two lines per area — name and progress, then the buttons — so a long area
   name and two buttons never have to share one row on a phone. */
function renderAreas() {
  const host = $('home-areas-list');
  host.textContent = '';
  for (const area of WG.domainProgress(domains, corpus, ignored)) {
    if (!area.total) continue;   // a manifest area with no questions published
    const row = el('div', 'wz-area');

    const top = el('div', 'top');
    top.appendChild(el('span', 'nm', area.name));
    // "all N answered" only when nothing at all is left — an ignored doctrine
    // is still outstanding, it has just been put aside.
    const done = area.answered >= area.total;
    top.appendChild(el('span', 'pg' + (done ? ' done' : ''),
      done ? 'all ' + area.total + ' answered'
           : area.answered + ' of ' + area.total
             + (area.ignored ? ' · ' + area.ignored + ' ignored' : '')));
    row.appendChild(top);

    const btns = el('div', 'btns');
    const first = area.doctrines.find(d => d.status === 'unasked');
    if (first) {
      btns.appendChild(button('wz-ghost', 'Next question', () => {
        const i = order.findIndex(d => d.slug === first.slug);
        if (i >= 0) { returnTo = null; renderQuestion(i); }
      }));
    }
    btns.appendChild(button('wz-ghost', 'List questions', () => renderArea(area.id)));
    row.appendChild(btns);
    host.appendChild(row);
  }
}

const STATUS_TEXT = {
  answered: 'answered', open: 'open', unasked: 'not answered', ignored: 'ignored',
};

/* One line per belief. A row opens the full question screen in place for that
   doctrine, with whatever was answered before preselected — the wizard already
   recovers that (existingNode), so this needs no editing UI of its own. It
   takes an area ID rather than an area object because progress moves under it:
   answering a question and coming back must re-read the counts. */
function renderArea(areaId) {
  const area = WG.domainProgress(domains, corpus, ignored).find(a => a.id === areaId);
  if (!area) { renderHome(); return; }
  $('area-title').textContent = area.name;
  $('area-sub').textContent =
    area.answered + ' of ' + area.total + ' answered'
    + (area.ignored ? ', ' + area.ignored + ' ignored' : '') + '. Open one to answer it.';
  const host = $('area-list');
  host.textContent = '';
  for (const d of area.doctrines) {
    const row = button('wz-qrow', null, () => {
      const i = order.findIndex(x => x.slug === d.slug);
      if (i < 0) return;
      returnTo = areaId;
      renderQuestion(i);
    });
    row.appendChild(el('span', null, d.node_title));
    row.appendChild(el('span', 'st', STATUS_TEXT[d.status]));
    host.appendChild(row);
  }
  $('area-add-panel').hidden = true;
  $('area-add-panel').textContent = '';
  $('area-add').onclick = () => buildAddBelief(areaId);
  showScreen('area');
}

/* "Add a doctrine": a belief the corpus has no question for. Same promoted /
   optional split as the custom answer tile (phase 3 design 2.2), plus a title,
   because there is no corpus doctrine to supply one. */
function buildAddBelief(areaId) {
  const panel = $('area-add-panel');
  panel.hidden = false;
  panel.textContent = '';

  const title = textField('Title', '', 1);
  title.input.placeholder = 'What this belief is called';
  const hold = textField('What I hold', '', 3);
  panel.appendChild(title.wrap);
  panel.appendChild(hold.wrap);

  const grid = el('div', 'wz-controls');
  const tierCell = el('div');
  tierCell.appendChild(labelled('Tier'));
  const tier = radioGroup(Core.TIERS, 'T3', true, 'Tier');
  tierCell.appendChild(tier.wrap);
  grid.appendChild(tierCell);
  const confCell = el('div');
  confCell.appendChild(labelled('Confidence'));
  const conf = radioGroup(Core.CONFIDENCES, 'leaning', false, 'Confidence');
  confCell.appendChild(conf.wrap);
  grid.appendChild(confCell);
  panel.appendChild(grid);

  const s = studyCheck();
  panel.appendChild(s.check);

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
  panel.appendChild(adv);

  const actions = el('div', 'wz-actions');
  const save = button('wz-primary', 'Add this belief', async () => {
    if (busy) return;
    busy = true;
    save.disabled = true;
    await addBelief(areaId, {
      // A title becomes a `## ` heading, so it is one line by definition.
      title: title.input.value.replace(/\s+/g, ' '),
      hold: hold.input.value, why: why.input.value, vs: vs.input.value,
      todo: still.input.value, refs: texts.input.value,
      links: related.input.value.split(',').map(x => Core.slugify(x.trim())).filter(Boolean),
      tier: tier.get(), confidence: conf.get(), study: s.cb.checked,
    });
    busy = false;
    save.disabled = false;
  });
  actions.appendChild(save);
  actions.appendChild(button('wz-link', 'Cancel', () => {
    panel.hidden = true;
    panel.textContent = '';
  }));
  panel.appendChild(actions);
  title.input.focus();
}

/* The model work is WG.addManualNode's; this only collects the fields, prunes
   and posts. pruneLinks runs immediately before the serialize, as it must
   before every serialize. */
async function addBelief(areaId, fields) {
  if (!fields.title.trim()) {
    showError('A belief needs a title.');
    return;
  }
  const count = () => domains.reduce((a, d) => a + d.nodes.length, 0);
  const before = count();
  WG.addManualNode(domains, corpus, Object.assign({ domainId: areaId }, fields));
  if (count() === before) {
    showError('There is already a belief with that title. Open it from the list instead.');
    return;
  }
  WG.pruneLinks(domains);   // every serialize, never once at the end (5.6)
  const { status, body } = await postMap(Core.serialize(domains));
  if (status === 200 && body) {
    token = body.updated_at;
    renderArea(areaId);
    return;
  }
  // The post failed, so the in-memory model is now ahead of the server. Drop
  // the node again rather than leave the screen lying about what was saved.
  const slug = Core.slugify(fields.title.trim());
  for (const d of domains) {
    const i = d.nodes.findIndex(n => n.slug === slug);
    if (i !== -1) d.nodes.splice(i, 1);
  }
  WG.pruneLinks(domains);
  showError(status === 409
    ? 'This map was changed somewhere else — reload to carry on.'
    : ((body && body.message) || 'That belief could not be saved. Nothing was lost — try again.'));
}

/* ------------------------------------------ start from someone else's map */

/* Lifted verbatim in behaviour from the deleted web/first-run.js, which was the
   only caller and lived on the deleted /app. The server guards this: copy_from
   only works on an empty map. */
async function openPicker() {
  const dlg = el('dialog', 'tm-picker');
  dlg.appendChild(el('h2', null, "Start from someone else's map"));
  dlg.appendChild(el('p', 'tm-note',
    'It becomes your own copy to change however you like. Their map is not '
    + 'affected, and the card says whose it was until you edit it.'));
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
  // Names are unique on lower(name), so "my own map" is a case-insensitive
  // test — the same one web/compare.js:373 makes.
  const mine = String(user.name || '').toLowerCase();
  maps = (maps || []).filter(m => m.node_count > 0 && String(m.name).toLowerCase() !== mine);
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
  // The one in-flight guard in this file, the same `busy` the copy-a-map path
  // uses. Two commits overlapping means the second calls applyAnswer on a
  // model the first is still rebuilding; a source-link click starting one
  // without awaiting it is how that became reachable. A refused commit is a
  // no-op — the caller simply does not advance, and pressing again works.
  if (busy) return false;
  busy = true;
  try {
    return await commitOnce(answer);
  } finally {
    busy = false;
  }
}

async function commitOnce(answer) {
  for (let attempt = 0; attempt < 2; attempt++) {
    WG.applyAnswer(domains, corpus, answer);
    WG.pruneLinks(domains);   // every serialize, never once at the end (5.6)
    const { status, body } = await postMap(Core.serialize(domains));
    if (status === 200 && body) {
      token = body.updated_at;
      // Answering by any other tile takes the doctrine back out of the ignored
      // list — it is no longer put aside, it is decided.
      const d = WG.findDoctrine(corpus, answer.doctrineId);
      if (d && ignored.delete(d.slug)) saveIgnored();
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
    next = WG.nextDoctrine(domains, corpus, ignored);
  } catch (err) {
    console.error('startQuestions failed', err);
    showError('Could not load the question set. Try reloading the page — '
      + 'if this keeps happening, it may be a stale cached copy of it.');
    return;
  }
  returnTo = null;
  if (next) renderQuestion(orderIndexOf(next)); else renderHome();
}

/* "Ignore for now" is not an answer: nothing is chosen, nothing is committed,
   and no node is written. It records the slug locally and moves on. */
function ignoreCurrent() {
  ignored.add(order[idx].slug);
  saveIgnored();
  const next = WG.nextDoctrine(domains, corpus, ignored);
  if (next) renderQuestion(orderIndexOf(next));
  else if (returnTo) renderArea(returnTo);
  else renderHome();
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

  // getItem returns null only when the key was never written. '' is a stored
  // answer and must survive the read, so no `|| ''` here.
  try { lens = localStorage.getItem(LENS_KEY); } catch { lens = null; }
  loadIgnored();
  paintLensLabels();

  $('intro-start').addEventListener('click', () => {
    if (lens !== null) startQuestions(); else openLens('intro');
  });
  $('wz-lens-btn').addEventListener('click', () => openLens('question'));
  $('home-lens-btn').addEventListener('click', () => openLens('home'));
  // Back and Finish here return to wherever the question screen was entered
  // from: the area's question list when a row opened it, the launchpad
  // otherwise. One variable, set at every entry point.
  $('q-back').addEventListener('click', () => {
    if (returnTo) renderArea(returnTo);
    else if (idx > 0) renderQuestion(idx - 1);
  });
  $('q-next').addEventListener('click', () => advance(() => {
    if (idx + 1 < order.length) renderQuestion(idx + 1); else renderHome();
  }));
  $('ignore-answer').addEventListener('click', ignoreCurrent);
  // Finish here saves and goes back to the launchpad. No confirmation, no
  // warning, no guilt — that is the whole point of it (design section 5.3).
  // An in-page screen change, not a navigation: the launchpad IS this page.
  $('wz-finish').addEventListener('click', () =>
    advance(() => { if (returnTo) renderArea(returnTo); else renderHome(); }));
  $('area-back').addEventListener('click', renderHome);
  // The third of the three first-run offers. It was only ever reachable by
  // starting the questions and abandoning them, which is not a first run.
  $('intro-copy').addEventListener('click', () => { if (!busy) openPicker(); });

  if (!order.length) {
    showError('There are no questions published yet.');
    return;
  }
  // Resume falls out of the map itself: a doctrine whose slug already has a
  // node counts as answered, so there is no wizard state on the server and
  // nothing in localStorage that can go stale (design 5.4). A genuine
  // first-timer gets the intro; everybody else lands on the launchpad.
  // Phase 6: /compare links an unanswered doctrine straight to the question
  // that fills it — `/wizard?doctrine=church.baptism`. The id is the stable
  // key (phase 4 schema); `order` holds doctrine objects, so match on it and
  // fall through to the normal landing when it names nothing.
  const wanted = new URLSearchParams(location.search).get('doctrine');
  if (wanted) {
    const at = order.findIndex(d => d.id === wanted);
    if (at >= 0) { renderQuestion(at); return; }
  }

  if (WG.answeredSlugs(domains).size) renderHome();
  else showScreen('intro');
}

main();
