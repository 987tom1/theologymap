/* web/wizard.js — the /wizard controller. Screens, state, fetch, save.
   Spec: docs/hosting/phase-4-design.md section 5.3.

   An ES module, like web/first-run.js and web/chrome.js: session.js exports
   named bindings and puts nothing on window. editor-core.js and
   wizard-generate.js are the two exceptions — both are UMD, shared with the
   offline editor and with Node, so wizard.html loads them as classic scripts
   and they arrive on window.

   This file holds NO model logic. Ordering, node building, link pruning and
   "is this answered" all live in engine/wizard-generate.js, which is pure and
   tested from the command line; serialising lives in engine/editor-core.js.
   If something here starts sorting doctrines, it is a duplicate. */
import { getUser, apiFetch, showError } from '/web/session.js';

const WG = window.WizardGenerate;
const Core = window.EditorCore;
const $ = (id) => document.getElementById(id);

const LENS_KEY = 'tmm.wizard.tradition';

/* Phase 3's vocabulary, unchanged — engine/editor.html owns the originals and
   the two must read the same or the wizard teaches a different meaning than
   the editor the person lands in afterwards. */
const TIER_GLOSS = {
  'T1': 'Essential to the gospel',
  'T1.5': 'Near-essential',
  'T2': 'Church-defining',
  'T2.5': 'Strains partnership',
  'T3': 'Important, not divisive',
  'T4': 'Matters of liberty',
};
const CONF_GLOSS = {
  'certain': 'Settled. I would teach and defend this.',
  'confident': 'Held with good reason, open to sharpening.',
  'leaning': 'A working position, not yet settled.',
  'open': 'Genuinely undecided.',
  'rejected': 'Considered and rejected.',
};
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
let chosen = null;          // { kind, position } for the doctrine on screen
let controls = null;        // the live tier/confidence/hold/study inputs
let mapName = '';

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

function tradition(id) {
  return traditions.find(t => t.id === id) || null;
}

/* A source renders as a link only when it has one. A citation with no url is
   the normal case for a printed confession, and a dead link would be worse
   than plain text. */
function sourceLine(src) {
  const p = el('p', 'wz-hint');
  const label = src.label + (src.citation ? ' — ' + src.citation : '');
  if (src.url) {
    const a = el('a', null, label);
    a.href = src.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    p.appendChild(a);
  } else {
    p.textContent = label;
  }
  return p;
}

function explainer(note, sources) {
  const box = el('div', 'wz-answer');
  if (note) box.appendChild(el('p', 'wz-hint', note));
  for (const s of sources || []) box.appendChild(sourceLine(s));
  if (!box.childNodes.length) box.appendChild(el('p', 'wz-hint', 'No further notes on this one yet.'));
  return box;
}

/* ------------------------------------------------------------------ screens */

function showScreen(name) {
  for (const s of ['intro', 'lens', 'question', 'finish']) {
    $('screen-' + s).hidden = (s !== name);
  }
  // The header is one element for the whole flow: the brand block on the two
  // ends, the crumb and the two controls in the middle. Matches the canvas.
  const working = (name === 'lens' || name === 'question');
  $('wz-brand').hidden = working;
  $('wz-crumb').hidden = !working;
  $('wz-headright').hidden = !working;
  $('wz-lens-btn').hidden = (name !== 'question');
  if (name === 'lens') $('wz-crumb').textContent = 'Before the questions start';
  window.scrollTo(0, 0);
}

function lensLabel() {
  const t = lens ? tradition(lens) : null;
  return 'Shown first: ' + (t ? t.short_name : 'no tradition') + ' ▾';
}

/* ------------------------------------------------------------- lens screen */

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
      $('wz-lens-btn').textContent = lensLabel();
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
    const chip = el('span', 'tchip' + (id === lens ? ' tchip-lens' : ''),
      tradition(id).short_name);
    row.appendChild(chip);
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
        dd.appendChild(el('em', null, h.citation));
      }
      dl.appendChild(dd);
    }
  }
  body.appendChild(dl);
  body.appendChild(el('p', 'wz-quiet',
    'Chips and stances describe who holds what. They are not a ranking, and '
    + 'they are not a recommendation.'));
}

function labelled(text) { return el('p', 'lab', text); }

function selectField(options, value, gloss) {
  const wrap = el('div');
  const sel = el('select');
  for (const o of options) {
    const opt = el('option', null, o);
    opt.value = o;
    sel.appendChild(opt);
  }
  sel.value = value || options[0];
  const note = el('p', 'wz-hint', gloss[sel.value] || '');
  sel.addEventListener('change', () => { note.textContent = gloss[sel.value] || ''; });
  wrap.appendChild(sel);
  return { wrap, sel, note };
}

/* The controls that appear once a position is chosen: the wording, the tier,
   the confidence and #study. Shown, not hidden behind "advanced" — design
   section 5.3 is explicit that changing them is one click. */
function answerControls(doctrine, position) {
  const box = el('div', 'wz-answer');
  const state = {};

  if (position) {
    box.appendChild(labelled('What I hold'));
    const field = el('div', 'wz-holdfield');
    const area = el('textarea');
    area.rows = 3;
    area.value = position.hold || '';
    field.appendChild(area);
    box.appendChild(field);
    box.appendChild(el('p', 'wz-hint',
      'My map, my words — the wording above is a starting point.'));
    state.hold = area;
  } else {
    box.appendChild(el('p', 'wz-hint', doctrine.open.todo));
  }

  const grid = el('div', 'wz-controls');

  const tierCell = el('div');
  tierCell.appendChild(labelled('Tier'));
  const startTier = (position && position.tier)
    || (position ? doctrine.suggested_tier : (doctrine.open.tier || doctrine.suggested_tier));
  const tier = selectField(Core.TIERS, startTier, TIER_GLOSS);
  const chip = el('span', 'tierchip', tier.sel.value);
  chip.style.background = TIER_VAR[tier.sel.value] || 'var(--muted)';
  tier.sel.addEventListener('change', () => {
    chip.textContent = tier.sel.value;
    chip.style.background = TIER_VAR[tier.sel.value] || 'var(--muted)';
  });
  const tierRow = el('div', 'wz-foot');
  tierRow.appendChild(chip);
  tierRow.appendChild(tier.wrap);
  tierCell.appendChild(tierRow);
  tierCell.appendChild(tier.note);
  if (doctrine.tier_note) tierCell.appendChild(el('p', 'wz-hint', doctrine.tier_note));
  grid.appendChild(tierCell);
  state.tier = tier.sel;

  const confCell = el('div');
  confCell.appendChild(labelled('Confidence'));
  if (position) {
    const conf = selectField(Core.CONFIDENCES, position.confidence_default, CONF_GLOSS);
    confCell.appendChild(conf.wrap);
    confCell.appendChild(conf.note);
    state.confidence = conf.sel;
  } else {
    // "I don't know" is a first-class answer and its confidence is the whole
    // point of it, so it is stated rather than offered (decisions.md).
    confCell.appendChild(el('p', 'wz-hint', 'open — ' + CONF_GLOSS.open));
  }
  grid.appendChild(confCell);
  box.appendChild(grid);

  if (position) {
    const check = el('label', 'wz-check');
    const cb = el('input');
    cb.type = 'checkbox';
    check.appendChild(cb);
    const text = el('span');
    text.appendChild(el('strong', null, '#study'));
    text.appendChild(document.createTextNode(' — I still need to work this out'));
    check.appendChild(text);
    box.appendChild(check);
    state.study = cb;
  }

  controls = state;
  return box;
}

function select(card, kind, doctrine, position) {
  for (const c of document.querySelectorAll('.wz-card.sel, #open-answer.sel')) {
    c.classList.remove('sel');
    const old = c.querySelector('.wz-answer');
    if (old) old.remove();
  }
  chosen = { kind, position };
  card.classList.add('sel');
  card.appendChild(answerControls(doctrine, position));
}

function renderQuestion(i) {
  idx = i;
  chosen = null;
  controls = null;
  const doctrine = order[idx];
  const existing = existingNode(doctrine);

  $('wz-crumb').textContent =
    WG.domainName(corpus, doctrine) + ' · question ' + (idx + 1) + ' of ' + order.length;
  $('wz-lens-btn').textContent = lensLabel();
  $('q-title').textContent = doctrine.question;
  $('q-framing').textContent = doctrine.framing;

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
    head.appendChild(chipRow(position));
    card.appendChild(head);
    card.appendChild(el('p', 'hold', position.hold));

    const foot = el('div', 'wz-foot');
    foot.appendChild(button('wz-link', 'Word it my way', (ev) => {
      ev.stopPropagation();
      if (!chosen || chosen.position !== position) select(card, 'position', doctrine, position);
      if (controls && controls.hold) controls.hold.focus();
    }));
    const more = explainer(position.learn_detail, position.sources);
    more.hidden = true;
    const moreBtn = button('wz-link', 'Read more', (ev) => {
      ev.stopPropagation();
      more.hidden = !more.hidden;
      moreBtn.setAttribute('aria-expanded', more.hidden ? 'false' : 'true');
    });
    moreBtn.setAttribute('aria-expanded', 'false');
    foot.appendChild(moreBtn);
    card.appendChild(foot);
    card.appendChild(more);

    card.addEventListener('click', () => {
      if (!chosen || chosen.position !== position) select(card, 'position', doctrine, position);
    });
    host.appendChild(card);

    // Back re-opens a doctrine with its previous answer selected. Which
    // position produced a node is not recorded in the file — that is a
    // deliberate format decision — so it is recovered the way phase 6 will
    // recover it: exact match on the hold sentence. No match means the person
    // reworded it, and nothing is preselected rather than something wrong.
    if (existing && existing.hold === position.hold) select(card, 'position', doctrine, position);
  }

  const open = $('open-answer');
  open.classList.remove('sel');
  const staleOpen = open.querySelector('.wz-answer');
  if (staleOpen) staleOpen.remove();
  open.onclick = () => { if (!chosen || chosen.kind !== 'open') select(open, 'open', doctrine, null); };
  if (existing && existing.confidence === 'open' && !chosen) select(open, 'open', doctrine, null);

  whoBelievesWhat(doctrine);
  $('who').open = false;
  $('q-back').hidden = (idx === 0);
  showScreen('question');
}

function existingNode(doctrine) {
  for (const d of domains) {
    const n = d.nodes.find(x => x.slug === doctrine.slug);
    if (n) return n;
  }
  return null;
}

/* --------------------------------------------------------------- finishing */

function renderFinish() {
  const nodes = domains.reduce((a, d) => a.concat(d.nodes), []);
  $('fin-beliefs').textContent = String(nodes.length);
  $('fin-areas').textContent = String(domains.length);
  $('fin-open').textContent = String(nodes.filter(n => (n.flags || []).includes('study')).length);

  const answered = WG.answeredSlugs(domains);
  const remaining = order.filter(d => !answered.has(d.slug));
  $('fin-remaining').textContent = String(remaining.length);

  const bar = $('fin-tierbar');
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
  $('fin-tiercounts').textContent = parts.join(' · ');

  const carry = $('fin-carry');
  if (remaining.length) {
    $('fin-carry-note').textContent =
      'Next question: ' + remaining[0].node_title.toLowerCase() + '.';
    carry.hidden = false;
    carry.onclick = (ev) => {
      ev.preventDefault();
      renderQuestion(order.indexOf(remaining[0]));
    };
  } else {
    carry.hidden = true;
  }
  if (mapName) $('fin-view').href = '/view?name=' + encodeURIComponent(mapName);
  showScreen('finish');
}

/* ------------------------------------------------------------------ saving */

function currentAnswer() {
  if (!chosen) return null;
  const doctrine = order[idx];
  const revisit = !!existingNode(doctrine);
  if (chosen.kind === 'open') {
    return { doctrineId: doctrine.id, kind: 'open', tier: controls.tier.value, revisit };
  }
  return {
    doctrineId: doctrine.id, kind: 'position', positionId: chosen.position.id,
    hold: controls.hold.value, tier: controls.tier.value,
    confidence: controls.confidence.value, study: controls.study.checked, revisit,
  };
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

async function main() {
  user = getUser();
  if (!user) { location.href = '/app'; return; }

  corpus = await loadCorpus();
  if (!corpus) return;
  traditions = corpus.traditions.traditions || [];
  order = WG.orderedDoctrines(corpus);
  $('intro-count').textContent = String(order.length);
  $('intro-count-chip').textContent = String(order.length);

  const map = await apiFetch('/api/map?user_id=' + encodeURIComponent(user.id));
  if (!map) return;
  domains = Core.parse(map.markdown);
  token = map.updated_at;
  mapName = map.name || '';

  try { lens = localStorage.getItem(LENS_KEY) || ''; } catch { lens = ''; }
  $('wz-lens-btn').textContent = lensLabel();

  $('intro-start').addEventListener('click', () => {
    if (lens) startQuestions(); else renderLens();
  });
  $('lens-next').addEventListener('click', startQuestions);
  $('wz-lens-btn').addEventListener('click', renderLens);
  $('q-back').addEventListener('click', () => { if (idx > 0) renderQuestion(idx - 1); });
  $('q-next').addEventListener('click', () => advance(() => {
    if (idx + 1 < order.length) renderQuestion(idx + 1); else renderFinish();
  }));
  // Finish here saves and goes. No confirmation, no warning, no guilt — that
  // is the whole point of it (design section 5.3).
  $('wz-finish').addEventListener('click', () => advance(() => { location.href = '/edit'; }));

  // Resume falls out of the map itself: a doctrine whose slug already has a
  // node counts as answered, so there is no wizard state on the server and
  // nothing in localStorage that can go stale (design 5.4).
  const next = WG.nextDoctrine(domains, corpus);
  if (!order.length) {
    showError('There are no questions published yet.');
  } else if (WG.answeredSlugs(domains).size) {
    if (next) renderQuestion(order.indexOf(next)); else renderFinish();
  } else {
    showScreen('intro');
  }
}

function startQuestions() {
  const next = WG.nextDoctrine(domains, corpus);
  if (next) renderQuestion(order.indexOf(next)); else renderFinish();
}

main();
