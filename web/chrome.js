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
// kept out of here entirely. Sign in's /#signin stops marking / for the
// same reason. (It used to have a second job: keeping Home ('/') and
// Listing status ('/#vis-row') from both claiming / while both sat in the
// overflow. Listing status is gone, so only Sign in exercises it now — the
// rule stands on its own terms and stays.)
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

/* The signed-in nav's visible budget: five items plus ⋯ at this width and
   up, four plus ⋯ below it (Browse drops into the overflow). engine/theme.css
   reads the same number for the nav's laptop type step, and engine/editor.html
   hand-copies it — three edits, as ever.

   Why 860: not because five labels stop fitting. At 600 var(--fs-00) the five
   are roughly 35 + 52 + 66 + 38 + 48px, plus a ~26px button, five var(--s3)
   gaps (60px) and .tm-chrome's var(--s5) side padding (48px) — about 373px,
   and ~400px once the laptop type step lands. Everything fits from a phone up;
   theme.css's 640px horizontal-scroll fallback is the width where things stop
   fitting. "Comfortably" is the actual criterion and it is a judgement, so
   this reuses 860px — already in theme.css as the Map view's phone fallback —
   rather than inventing a number.
   ponytail: hand-picked from an existing breakpoint, not a measured ceiling.
   If the nav ever grows a sixth label, measure it rather than nudging this. */
const WIDE_NAV = '(min-width: 860px)';

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
  // Home · My map · Questions · Learn · Browse · ⋯ signed in at WIDE_NAV and
  // up; Home · My map · Questions · Learn · ⋯ below it, with Browse in the
  // overflow. Learn · Browse · Sign in signed out, unaffected. History,
  // Edit, Compare, Admin and Sign out live in the ⋯ popover (Task 2).
  // Literal [href, label] pairs so a reorder or relabel is a one-line diff,
  // here and in editor.html's matching array — keep the two visually
  // identical line for line.
  const NAV = user
    ? [
        // Home moved out of the ⋯ overflow into the visible row on
        // 2026-09-18. It is never in both places and never in neither:
        // the visible row always carries it, and Browse is the item that
        // moves instead (see placeBrowse below).
        ['/', 'Home'],
        // Copied from web/landing.html:148's tile href, not reimplemented:
        // the empty-map redirect and unlisted-map message live in
        // web/view.html and stay there.
        ['/view?name=' + encodeURIComponent(user.name), 'My map'],
        ['/wizard', 'Questions'],
        ['/learn', 'Learn'],
        // Browse is NOT here: it is built below and placed into either this
        // row or the ⋯ menu depending on WIDE_NAV.
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
      // No Home entry: it is in the visible row now (see NAV above).
      // Browse is inserted at the top of this menu by placeBrowse below
      // when the viewport is narrower than WIDE_NAV.
      ['/edit', 'Edit'],
      ['/history', 'History'],
      ['/compare', 'Compare'],
      // No 'Listing status' /#vis-row entry any more — the nav shortcut is
      // gone, the Unlist/Relist control it deep-linked to is untouched and
      // still on / (web/landing.html's #vis-row). Removed from the matching
      // array in engine/editor.html in the same commit.
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
    // Into the nav's own flex row, not a sibling of it — a sibling <button>
    // after a flex-display .toplinks wraps onto its own line, breaking the
    // one-row nav this phase exists to deliver (and adding a header row on
    // the question screen). The popover <div> itself can stay outside the
    // flex row; it renders in the top layer regardless of DOM position.
    links.appendChild(moreBtn);

    // Browse is the item that moves. Being "in the overflow" is a different
    // DOM parent, not a hidden element, so this is a matchMedia listener and
    // not a CSS media query — but it moves ONE already-built node between
    // two parents rather than re-rendering the header, so aria-current and
    // every other bit of its state come along for free.
    const browse = link('/gallery', 'Browse');
    const browseCurrent = browse.hasAttribute('aria-current');
    const wide = matchMedia(WIDE_NAV);
    const placeBrowse = () => {
      if (wide.matches) links.insertBefore(browse, moreBtn);
      else more.insertBefore(browse, more.firstChild);
      // aria-current on the items inside .tm-more is invisible while the
      // menu is closed. Mirror it onto the button itself so the one thing
      // aria-current exists for — showing where you are — still works when
      // the current page lives in the overflow. Browse is part of that sum
      // only while it is actually in the menu, hence the recompute here
      // rather than a one-shot at build time.
      if (anyCurrent || (!wide.matches && browseCurrent)) moreBtn.setAttribute('aria-current', 'page');
      else moreBtn.removeAttribute('aria-current');
    };
    placeBrowse();
    wide.addEventListener('change', placeBrowse);

    // theme.css's @supports not (position-anchor: --x) fallback pins the
    // menu to the viewport's top-right corner, which on a laptop is a long
    // way from the ⋯ it belongs to — it reads as a stray panel. Same gate,
    // in JS, so an engine that HAS anchor positioning never runs a line of
    // this and keeps the pure-CSS anchoring. The fallback is position:
    // fixed, so getBoundingClientRect()'s viewport coordinates are already
    // the right coordinate space, and the rule's margin supplies the gap.
    if (!CSS.supports('position-anchor: --x')) {
      more.addEventListener('beforetoggle', (e) => {
        if (e.newState !== 'open') return;
        const r = moreBtn.getBoundingClientRect();
        more.style.top = r.bottom + 'px';
        more.style.right = (innerWidth - r.right) + 'px';
      });
    }
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
