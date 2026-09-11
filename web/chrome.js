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
// Path only, unless the item's own href carries a query string — then that
// must match too. Without this, /view?name=<anyone> reads pathname-only as
// "/view" and "My map" marks itself current while looking at someone else's
// map, or a generated tradition summary (M1).
//
// An href carrying a FRAGMENT never marks the page current: it points at a
// region, not a destination. That is the same reason Sign out's href="#" is
// kept out of here entirely. It also settles what would otherwise be two
// current items on /, now that Home is in the overflow — Home ('/') and
// Listing status ('/#vis-row') both live at that pathname, and only one of
// them is the page. Sign in's /#signin stops marking / for the same reason.
function matchesPage(href) {
  const u = new URL(href, location.origin);
  if (u.hash) return false;
  return u.pathname === location.pathname
    && (u.search === '' || u.search === location.search);
}
function link(href, text) {
  const a = el('a', null, text);
  a.href = href;
  if (matchesPage(href)) a.setAttribute('aria-current', 'page');
  return a;
}

/* The tier-name → token map, forked four ways before this (wizard.js, compare.js,
   learn.js, gallery.html). It reads engine/theme.css's --t1…--t4 rather than a hex,
   which is the phase-10 rule: do not reintroduce a tier hex literal in a web/ file. */
export const TIER_VAR = {
  'T1': 'var(--t1)', 'T1.5': 'var(--t1-5)', 'T2': 'var(--t2)',
  'T2.5': 'var(--t2-5)', 'T3': 'var(--t3)', 'T4': 'var(--t4)',
};

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
  // P6: My map · Questions · Learn · Browse · ⋯ signed in; Learn · Browse ·
  // Sign in signed out. History, Edit, Compare, Listing status, Admin and
  // Sign out moved into the ⋯ popover (Task 2). No Home link any more —
  // §10's decision, not an oversight. Literal [href, label] pairs so a
  // reorder or relabel is a one-line diff, here and in editor.html's
  // matching array — keep the two visually identical line for line.
  const NAV = user
    ? [
        // Copied from web/landing.html:148's tile href, not reimplemented:
        // the empty-map redirect and unlisted-map message live in
        // web/view.html and stay there.
        ['/view?name=' + encodeURIComponent(user.name), 'My map'],
        ['/wizard', 'Questions'],
        ['/learn', 'Learn'],
        ['/gallery', 'Browse'],
      ]
    : [
        ['/learn', 'Learn'],
        ['/gallery', 'Browse'],
        ['/#signin', 'Sign in'],
      ];
  const links = el('div', 'toplinks');
  for (const [href, text] of NAV) links.appendChild(link(href, text));

  let more = null;
  if (user) {
    more = el('div', 'tm-more');
    more.id = 'tm-more';
    more.setAttribute('popover', '');
    const MORE = [
      // Home is in the overflow, not the visible row: D6's budget is four
      // visible items, and / is a genuine destination a signed-in user
      // reaches occasionally — which is exactly what this menu is for.
      // Without it the nav had no route back to / at all.
      ['/', 'Home'],
      ['/edit', 'Edit'],
      ['/history', 'History'],
      ['/compare', 'Compare'],
      // Not a page: the id this points at is created in JS, not static
      // markup — web/landing.html:168-172 sets visRow.id = 'vis-row' while
      // building the signed-in tile grid. The /#vis-row deep link works
      // because the HTML spec retries "scroll to the fragment" after the
      // document finishes loading, and that script runs before the load
      // event fires — but a refactor deferring the tile build past load
      // would silently break it. Nothing added to / either way.
      ['/#vis-row', 'Listing status'],
    ];
    if (user.is_admin) MORE.push(['/admin', 'Admin']);
    let anyCurrent = false;
    for (const [href, text] of MORE) {
      const a = link(href, text);
      if (a.hasAttribute('aria-current')) anyCurrent = true;
      more.appendChild(a);
    }
    // Sign out is an action, not a destination, so it is never run through
    // link()'s current-page match — built with el() directly, same as
    // always. (This is also why it can never itself set anyCurrent above.)
    const out = el('a', null, 'Sign out');
    out.href = '#';
    out.addEventListener('click', (e) => {
      e.preventDefault();
      clearUser();
      location.href = '/';
    });
    more.appendChild(out);

    // A native popover: light dismiss, Escape and focus-return are the
    // platform's job, not ours. The Sign out handler above is the only JS
    // this menu needs.
    const moreBtn = el('button', 'tm-morebtn', '⋯');
    moreBtn.type = 'button';
    moreBtn.id = 'tm-more-btn';
    moreBtn.setAttribute('popovertarget', 'tm-more');
    moreBtn.setAttribute('aria-label', 'More');
    // aria-current on the items inside .tm-more is invisible while the menu
    // is closed. Mirror it onto the button itself so the one thing
    // aria-current exists for — showing where you are — still works when
    // the current page lives in the overflow.
    if (anyCurrent) moreBtn.setAttribute('aria-current', 'page');
    // Into the nav's own flex row, not a sibling of it — a sibling <button>
    // after a flex-display .toplinks wraps onto its own line, breaking the
    // one-row nav this phase exists to deliver (and adding a header row on
    // the question screen). The popover <div> itself can stay outside the
    // flex row; it renders in the top layer regardless of DOM position.
    links.appendChild(moreBtn);
  }
  head.appendChild(links);
  if (more) head.appendChild(more);
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
