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
