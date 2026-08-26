// web/session.js — the single source of truth for who is signed in.
// Only this module touches localStorage for the signed-in user. No build step, no imports.

const KEY = 'theologymap:user';
const NOTICE_KEY = 'theologymap:notice';

export function getUser() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(u) {
  localStorage.setItem(KEY, JSON.stringify({ id: u.id, name: u.name, is_admin: u.is_admin }));
}

export function clearUser() {
  localStorage.removeItem(KEY);
}

// Every signed-in-only page funnels through here, so the "why am I suddenly on
// the sign-in page?" explanation is written once, not per page.
export function requireUser(why = 'Sign in first — that page needs an account.') {
  const u = getUser();
  if (!u) {
    stashNotice(why);
    window.location.href = '/';
    return null;
  }
  return u;
}

// JSON in, JSON out. It is the right call for every route that replies with
// JSON and the WRONG one for /api/render, which replies with text/html — a
// success body there would be silently nulled by the res.json() below. Callers
// that expect HTML use plain fetch() + res.text() (see web/view.html and
// engine/storage-hosted.js, both of which say so at the call site).
export async function apiFetch(path, options = {}) {
  const opts = { ...options, headers: { ...(options.headers || {}) } };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
  }
  if (opts.body) {
    opts.headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(path, opts);
  } catch (err) {
    showError('Could not reach the server. Check your connection and try again.');
    throw err;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 404 && body && body.error === 'unknown_user') {
      clearUser();
      stashNotice('That account no longer exists. Please sign in again.');
      window.location.href = '/';
      return null;
    }
    showError((body && body.message) || 'Something went wrong.');
    // The thrown Error carries the server's machine-readable `error` field as
    // `.code`, not just its prose. Callers that need to branch on WHY a call
    // failed (web/admin.html tells "wrong PIN" apart from "network hiccup")
    // must not have to string-match the message, which is copy and will change.
    // Same shape as engine/storage-hosted.js's mapError().
    const err = new Error((body && body.message) || `Request failed: ${res.status}`);
    err.code = body && body.error;
    err.status = res.status;
    throw err;
  }

  return body;
}

// ponytail: sessionStorage hand-off for a one-time notice, the simplest thing
// that survives a full-page redirect without a query-string round trip.
function stashNotice(message) {
  try { sessionStorage.setItem(NOTICE_KEY, message); } catch { /* private mode */ }
}

function banner(kind, message) {
  let el = document.getElementById('tm-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tm-banner';
    el.style.cssText = 'position:relative;padding:10px 36px 10px 12px;font:14px sans-serif;border-bottom:1px solid;';
    document.body.insertBefore(el, document.body.firstChild);
  }
  el.style.background = kind === 'error' ? '#fdd' : '#eef';
  el.style.borderColor = kind === 'error' ? '#c00' : '#88a';
  el.style.color = kind === 'error' ? '#600' : '#225';
  el.textContent = message;

  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss');
  close.style.cssText = 'position:absolute;right:8px;top:6px;background:none;border:none;font-size:16px;cursor:pointer;color:inherit;';
  close.onclick = () => el.remove();
  el.appendChild(close);
}

export function showError(message) {
  banner('error', message);
}

export function showNotice(message) {
  banner('notice', message);
}

// On load, if a notice was stashed across a redirect (see apiFetch's unknown_user
// handling), show it once and clear it.
if (typeof document !== 'undefined') {
  const pending = sessionStorage.getItem(NOTICE_KEY);
  if (pending) {
    sessionStorage.removeItem(NOTICE_KEY);
    if (document.body) {
      showNotice(pending);
    } else {
      document.addEventListener('DOMContentLoaded', () => showNotice(pending));
    }
  }
}
