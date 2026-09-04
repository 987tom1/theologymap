/* web/chrome.js — the one shared header for /, /gallery, /view, /history and /admin.
   An ES module, like web/session.js, because that is how every page here loads
   its script and session.js exports no globals. */
import { getUser, clearUser } from '/web/session.js';

// The one el() in this codebase — /web/wizard.js, /web/learn.js and
// /web/compare.js all import it from here rather than keeping their own copy.
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function link(href, text) { const a = el('a', null, text); a.href = href; return a; }

// Same algorithm as engine/editor-core.js's slugify (a UMD/global module, not
// importable from an ES module page like /view). Kept in lockstep by hand,
// same as the rest of that file's documented pairs.
export function slugify(text) {
  let t = (text || '').toLowerCase().replace(/&/g, 'and');
  t = t.replace(/['’]/g, '');
  t = t.replace(/[^a-z0-9]+/g, '-');
  t = t.replace(/^-+|-+$/g, '');
  return t;
}

// actions: optional array of already-built elements, right-aligned in the
// header. Defaults to none so every existing caller is unchanged.
export function mount(pageTitle, actions = []) {
  const host = document.getElementById('tmChrome');
  if (!host) return;
  const user = getUser();
  const head = el('header', 'tm-chrome');
  const titleRow = el('div', 'tm-chrome-titlerow');
  const titleCol = el('div');
  titleCol.appendChild(el('p', 'kicker', 'Theology Map'));
  titleCol.appendChild(el('h1', null, pageTitle));
  titleRow.appendChild(titleCol);
  if (actions.length) {
    const actionsRow = el('div', 'tm-chrome-actions');
    for (const a of actions) actionsRow.appendChild(a);
    titleRow.appendChild(actionsRow);
  }
  head.appendChild(titleRow);
  const links = el('div', 'toplinks');
  links.appendChild(link('/', 'Home'));
  if (user) {
    links.appendChild(link('/wizard', 'Wizard'));
    links.appendChild(link('/edit', 'Edit'));
  }
  links.appendChild(link('/gallery', 'Browse'));
  if (user && user.is_admin) links.appendChild(link('/admin', 'Admin'));
  if (user) {
    const out = el('a', null, 'Sign out');
    out.href = '#';
    out.addEventListener('click', (e) => {
      e.preventDefault();
      clearUser();
      location.href = '/';
    });
    links.appendChild(out);
  } else {
    links.appendChild(link('/#signin', 'Sign in'));
  }
  head.appendChild(links);
  host.replaceWith(head);
}

/* One clipboard implementation for the hosted pages. /view offers "Copy link"
   and phase 3 briefly had a copy of this logic duplicated; Task 9's rule is
   one way to do each thing.

   engine/editor.html keeps its own copy on purpose and that is not drift: the
   editor must load from file:// with no network, so it cannot import anything
   under /web. This is the same pattern, not a second design. */
export function copyButton(btn, getText, label = 'Copy link') {
  btn.addEventListener('click', async () => {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Safari and any non-secure context: clipboard API absent or blocked.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = label; }, 1500);
  });
}

/* Native RelativeTimeFormat, not a hand-rolled ladder. It doesn't pick a unit
   for you, so this still walks a table from largest to smallest — but that
   table is data, not branching logic. Shared by /gallery and /history (phase 8's
   version list) so there is one way to say "2 hours ago", not two. */
const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const REL_UNITS = [
  ['year', 31536000000], ['month', 2592000000], ['week', 604800000],
  ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000]
];
export function relTime(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  for (const [unit, ms] of REL_UNITS) {
    if (Math.abs(diff) >= ms) return RTF.format(Math.round(diff / ms), unit);
  }
  return RTF.format(0, 'second');
}
