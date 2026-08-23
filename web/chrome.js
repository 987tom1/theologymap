/* web/chrome.js — the one shared header for /app, /gallery, /view and /admin.
   An ES module, like web/session.js, because that is how every page here loads
   its script and session.js exports no globals. */
import { getUser, clearUser } from '/web/session.js';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function link(href, text) { const a = el('a', null, text); a.href = href; return a; }

export function mount(pageTitle) {
  const host = document.getElementById('tmChrome');
  if (!host) return;
  const user = getUser();
  const head = el('header', 'tm-chrome');
  head.appendChild(el('p', 'kicker', 'Theology Map'));
  head.appendChild(el('h1', null, pageTitle));
  const links = el('div', 'toplinks');
  links.appendChild(link('/app', 'My map'));
  links.appendChild(link('/gallery', 'Gallery'));
  if (user && user.is_admin) links.appendChild(link('/admin', 'Admin'));
  if (user) {
    const out = el('a', null, 'Sign out');
    out.href = '#';
    out.addEventListener('click', (e) => {
      e.preventDefault();
      clearUser();
      location.href = '/app';
    });
    links.appendChild(out);
  } else {
    links.appendChild(link('/app', 'Sign in'));
  }
  head.appendChild(links);
  host.replaceWith(head);
}

/* One clipboard implementation for the hosted pages. /view and /app both offer
   "Copy link" and phase 3 briefly had a copy of this in each; Task 9's rule is
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
   table is data, not branching logic. Shared by /gallery and /app (phase 8's
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
