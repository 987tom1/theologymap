// engine/storage-hosted.js — the hosted (Supabase-backed) storage adapter for editor.html.
//
// Adapter interface (see storage-local.js's header comment and editor.html's boot()/
// flushAutosave()/conflict-dialog/beforeunload call sites, which this must match exactly):
//   { mode, supportsAutosave, async init(ui), async load(), async save(text, token, force),
//     async render(text), beaconFlush(text, token), buttons: {connect, upload, save, render} }
//
// Deliberate deviation — do NOT "fix" this back to apiFetch:
// web/session.js's apiFetch() is the normal way to call JSON APIs in this app, but on a 404
// {"error":"unknown_user"} it unconditionally clearUser()s and redirects the whole page to
// /app. Inside the editor that's exactly the wrong move (docs/hosting/phase-1-design.md §8,
// failure mode 3): if a signed-in user's account vanishes mid-edit, the editor must NOT be
// yanked out from under them — it needs to keep their draft in localStorage and show a
// "copy your map out" message in place instead. So /api/map GET/POST go through plain
// fetch() here, and failures surface as Error objects carrying a `.code` (the server's
// `error` field) that editor.html's flushAutosave() branches on directly. requireUser() is
// still used to get the user id and for the "nobody's signed in at all" redirect, which IS
// still the right behaviour. render() needs no auth and has no unknown_user case that
// matters here, so it uses plain fetch() too, just for consistency.

import { requireUser } from '/web/session.js';

function mapError(body) {
  const err = new Error((body && body.message) || 'Something went wrong.');
  err.code = body && body.error;
  return err;
}

export function createHostedAdapter() {
  return {
    mode: 'hosted',
    supportsAutosave: true,

    async init(_ui) {
      // Hosted mode has no Connect/Upload buttons to wire up.
    },

    async load() {
      const user = requireUser('Sign in to edit your map.'); // redirects to /app if nobody is signed in
      if (!user) return { text: '', label: '', token: null }; // page is navigating away

      const res = await fetch('/api/map?user_id=' + encodeURIComponent(user.id));
      const body = await res.json().catch(() => null);
      if (!res.ok) throw mapError(body);

      return { text: (body && body.markdown) || '', label: user.name, token: body && body.updated_at };
    },

    async save(text, token, force) {
      const user = requireUser();
      if (!user) return { token: null }; // page is navigating away

      const payload = { user_id: user.id, markdown: text, expected_updated_at: token };
      if (force) payload.force = force;

      const res = await fetch('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw mapError(body);

      return { token: body && body.updated_at };
    },

    async render(text) {
      // requireUser() is still called for its redirect: nobody signed in has no
      // business on /edit at all. Its return value is unused now that Render no
      // longer names a download file after the user.
      requireUser();

      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body && body.message) || 'Render failed: ' + res.status);
      }

      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // Open it, and only open it. This used to also force a download of the
      // same blob, so one click on Render produced a new tab AND a file in
      // Downloads -- phase-2-review.md G7. Exporting a file is /view's Export
      // HTML button, which is a deliberate act rather than a side effect.
      window.open(url, '_blank', 'noopener');

      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },

    beaconFlush(text, token) {
      const user = requireUser();
      if (!user) return; // nothing to do — redirecting anyway
      const payload = JSON.stringify({ user_id: user.id, markdown: text, expected_updated_at: token });
      navigator.sendBeacon('/api/map', new Blob([payload], { type: 'application/json' }));
    },

    buttons: { connect: false, upload: false, save: false, render: true },
  };
}
