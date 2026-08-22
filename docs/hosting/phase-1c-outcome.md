# Phase 1c — outcome

**Branch:** `phase-1c-editor` → merged to `main` (`--no-ff`, commit `ebec861`), followed by
two small direct-to-`main` commits for the post-merge DB verification route's lifecycle
(added, used, removed) — same shape 1b used and for the same reason (see below).

**Ran:** 2026-08-22. Model: Opus, main thread, for the seam surgery (Task 1c.2) and the
autosave scheduler/guards/conflict UI (Task 1c.4); two Sonnet subagents in parallel for
`api/map.py` (Task 1c.1) and `engine/storage-hosted.js` (Task 1c.3), dispatched once the
adapter interface was fixed. Parser lockstep re-verification (Task 1c.5) on the main thread.

**Verdict: 1c is complete.** All verification-table checks pass, including every
DB-dependent one, run against production. `main` now has a working hosted editor with
autosave. 1d is unblocked.

---

## The adapter interface, as built

```js
{
  mode: 'local' | 'hosted',
  supportsAutosave: boolean,
  async init(ui),                    // ui = { elements: {btnConnect, btnUpload, fileInput}, onLoaded(text, label, writable), setStatus(msg, kind) }
  async load(),                      // -> { text, label, token }  — hosted only; local's load() throws (loading is button-driven via init())
  async save(text, token, force),    // -> { token }  |  throws Error with .code set to the server's error string
  async render(text),                // side-effecting; throws Error(message) on failure
  beaconFlush(text, token),          // SYNCHRONOUS, hosted only — fire-and-forget via navigator.sendBeacon for the beforeunload flush
  buttons: { connect, upload, save, render },
}
```

One addition beyond design §7's four methods: **`beaconFlush(text, token)`**. The design
named `navigator.sendBeacon('/api/map', blob)` as part of autosave's beforeunload handling
but didn't put it in the adapter interface. Since the hosted adapter is the only place that
knows how to identify the current user and build the request body, and local mode has no
equivalent (its `beforeunload` dirty-guard is the existing `e.preventDefault()`, unchanged),
`beaconFlush` lives on the adapter and is called conditionally (`adapter.beaconFlush &&
...`) rather than being a required part of every adapter.

## Autosave constants actually used

Exactly as design §8 specifies: **1200 ms idle debounce**, **15000 ms (15 s) forced-flush
ceiling**, flush on `visibilitychange → hidden`, best-effort flush on `beforeunload` via
`sendBeacon`. The existing `beforeunload` dirty-guard (`e.preventDefault()`) is unchanged
and still fires regardless of adapter/mode.

## The four empty-save guards — all four implemented

1. **No token, no save.** `scheduleAutosave()` and `flushAutosave()` both bail if `saveToken`
   is unset. `saveToken` is only ever set after a successful `adapter.load()`, so a failed
   load leaves the scheduler permanently disarmed rather than empty-and-armed.
2. **Client shrink guard.** Before every scheduled save: empty-while-previously-nonempty, or
   under half the previous length when the previous length was over 500 characters. Either
   condition opens a confirm dialog ("Save anyway?") that retries with `force: true`.
3. **Server guard.** `api/map.py` returns 409 `would_erase` under the same condition,
   checked server-side against the row's *actual* stored markdown (looked up first, before
   any write), independent of whatever the client believes `lastSavedText` is. Verified
   directly against production (see below) — force bypasses it, its absence doesn't.
4. **Local draft.** Every scheduled save writes `{text, savedAt}` to
   `localStorage['theologymap:draft:<name>']` before the network call, cleared on confirmed
   success. On load, if a draft is newer than the server's `updated_at` and differs from the
   just-loaded text, the editor offers to restore it (reusing the existing confirm dialog).

## Concurrency mechanism — the plain conditional PATCH, confirmed again

`api/map.py` implements exactly what `phase-1b-outcome.md` already proved against
production: `PATCH /users?id=eq.<id>&updated_at=eq.<quoted token>&select=updated_at` with
`Prefer: return=representation`. **No `save_map` RPC fallback exists or was needed.**
Re-confirmed end-to-end through the real route (not just the raw PostgREST call 1b tested)
in this session's production verification below — fresh token → 200 with a new token;
stale/reused token → 409 `conflict`, zero rows.

---

## Files touched

| Path | What |
|---|---|
| `engine/editor.html` | modified — adapter seam, mode switch (`HOSTED` detection unchanged from design §7), `boot()`, autosave scheduler + all four guards, conflict dialog (`#dlgConflict`, new), draft-restore-offer (reuses `#dlgConfirm`), `<base href="/engine/">` fix in `<head>` |
| `engine/storage-local.js` | new — local adapter, lifted verbatim from the pre-1c inline handlers |
| `engine/storage-hosted.js` | new — hosted adapter, written by a Sonnet subagent against the fixed interface |
| `api/map.py` | new — written by a Sonnet subagent against the concurrency/empty-save/size-limit contract, verbatim from design §8 and 1b's confirmed mechanism |
| `vercel.json` | modified — `/edit` → `engine/editor.html?mode=hosted` rewrite |
| `engine/editor-core.js`, `engine/map-view.js`, `engine/shared-fields.js`, `engine/render.py`, `engine/render_server.py` | **not touched**, confirmed by `git diff` |

## A bug this sub-phase had to prevent from being reintroduced

1b's outcome file flagged that `/edit`-style Vercel rewrites don't change the browser's
address bar, so any *relative* URL in the served document resolves against the requested
path (`/edit`) rather than the file's real path (`/engine/editor.html`) — the exact bug that
hit `web/session.js`'s import in `web/index.html`. Introducing `/edit` in this sub-phase
would have reproduced the identical bug for **five** relative resources at once
(`editor-core.js`, `shared-fields.js`, `map-view.js`, `storage-local.js`, and the "Open the
map" link to `../theology-map.html`), not just one.

**Fix:** one line in `<head>` — `if (location.pathname === '/edit')
document.write('<base href="/engine/">')` — so relative resolution is only altered on the
one path that actually needs it, and every other way of reaching this file (direct
`/engine/editor.html`, `file://`, `localhost:8420`) is untouched. `storage-hosted.js` (never
statically included, only reached via a dynamic `import('./storage-hosted.js')` from inside
the already-`<base>`-corrected document) resolves correctly through the same mechanism, and
its own internal `import ... from '/web/session.js'` uses the established absolute-path
convention regardless.

**Verified directly against the branch preview**, not by inference: fetched `/edit`'s HTML
and confirmed the `<base>` script is present, then fetched
`/engine/{editor-core,shared-fields,map-view,storage-local,storage-hosted}.js` and
`/theology-map.html` (what `../theology-map.html` resolves to once based at `/engine/`) —
all seven returned 200. This is a network-response check, not browser automation.

Small, functionally inert observation: design §7's literal rewrite destination
(`engine/editor.html?mode=hosted`) doesn't actually reach `location.search` on the client —
a Vercel rewrite doesn't change what the browser's address bar (and therefore
`location`) shows, so `?mode=hosted` has no client-visible effect when arrived at through
`/edit`. This doesn't matter: `HOSTED` is independently true for any non-`file:`,
non-`localhost` origin regardless of the query string, which `/edit` always is in
production. The query param's only real effect is the documented escape hatch — manually
visiting `http://localhost:8420/engine/editor.html?mode=hosted` to exercise hosted-mode
code against a local server. Kept `vercel.json`'s destination exactly as design §7 wrote it,
for fidelity, noting this here rather than "fixing" a rewrite that isn't broken.

## The one deliberate deviation from `web/session.js`'s normal usage

`engine/storage-hosted.js` does **not** use `web/session.js`'s `apiFetch()` for `/api/map`
calls. `apiFetch()`'s built-in 404 `unknown_user` handling unconditionally clears the
session and redirects to `/app` — correct everywhere else in the app, but exactly the
behaviour design §8's failure mode 3 (and Task 1c.4 Step 9) forbid inside the editor: a
vanished account must leave the draft in `localStorage` and show a copy-out message in
place, not yank the page out from under an active edit. `storage-hosted.js` uses
`requireUser()` (still correct — "nobody signed in at all" should still redirect) but makes
the actual `/api/map` HTTP calls with plain `fetch()`, throwing typed errors (`.code` from
the response body) that `editor.html`'s `flushAutosave()` branches on directly. This is
called out in a comment at the top of the file so it isn't "fixed" back to `apiFetch` later.
`render()` and `beaconFlush()` don't need this treatment (no `unknown_user` case that
matters to a signed-in editor session) but use plain `fetch()`/`sendBeacon` too, for
consistency.

## Other implementation choices worth recording

- **`scheduleAutosave()` is hooked into `updateChangeIndicator()`**, not only `touch(node)`.
  `updateChangeIndicator()` is the one function every mutation path already called (field
  edits via `touch()`, add/delete node, add domain) or was made to call (domain rename, which
  didn't call it before this sub-phase and now does) — a single hook point covers every way
  the model can change, rather than only field-level edits.
- **A new `#dlgConflict` dialog**, rather than repurposing the existing delete-confirmation
  `#dlgConfirm` a third time. The conflict banner's contract — exactly two buttons, no
  Escape-to-dismiss, never resolves itself — genuinely differs from `#dlgConfirm`'s normal
  cancelable Cancel/OK shape, so giving it its own element (with a `cancel` event listener
  that calls `preventDefault()`) was more honest than bolting non-dismissability onto a
  dialog other flows still need to be dismissable.
- **`#dlgConfirm` reused for the shrink-guard prompt and the draft-restore offer**, each
  call site now explicitly setting `$('dlgOk').textContent` (including the original delete
  flow, which never had to before because nothing else used the dialog).
- **`btnRender`'s transient button label was simplified** from the original two-phase
  "Saving…" → "Rendering…" to a single "Working…", since `adapter.render()` now does the
  whole local write-then-render sequence atomically with no progress hook exposed to the
  caller. The **status-line wording** (`setStatus()` messages — "Saved and rendered — reopen
  the map to see it.", the render-server-unreachable message, etc.) is preserved character
  for character, which is the wording Task 1c.2 Step 3 actually cared about preserving.
- **`draftKey()` uses the user's name** (`currentLabel`), not a separate id — names are
  already the unique login identifier, so this needs no extra plumbing to carry a `user_id`
  into `localStorage` key construction.

---

## Verification table

| Check | Result |
|---|---|
| Local, offline (parser lockstep stands in for browser-driven Connect/Save, per the no-browser-automation rule) | `py engine/render.py` reproduces the byte-identical generated files (99 nodes / 14 domains / 156 refs, 0 missing) with zero diff, both before and after this sub-phase's changes |
| Parser lockstep | `once === twice === src` via `editor-core.js`; node count 99, matching `render.py`; **zero diff** to `editor-core.js` / `map-view.js` |
| `engine/editor.html` inline scripts | both `<script>` blocks pass `node --check` |
| `api/map.py` | `py -m py_compile` clean; no `pin` in any query `select=` or response body (grepped) |
| `engine/storage-hosted.js` | passes `node --check` as an ES module |
| Branch preview deploys | `/`, `/edit` both 200; DB probe (`GET /api/map?user_id=...`) correctly `500 misconfigured` (no Preview credentials, expected per established fact) |
| `/edit` relative-resolution fix | `/engine/{editor-core,shared-fields,map-view,storage-local,storage-hosted}.js` and `/theology-map.html` all 200 on the preview, confirming the `<base>` fix actually works under the rewrite |
| Hosted load/save (production) | signup → `GET /api/map` returns the fresh empty row; `POST /api/map` with a fresh token → 200 with a new token |
| **Concurrent tabs** (production) | reusing a stale token → **409 `conflict`**, exactly as 1b's raw-PostgREST test predicted, now proven through the real route |
| **Empty save** (production) | empty markdown without `force` → **409 `would_erase`**; with `force: true` → 200 |
| Size limit (production) | markdown over 512 KB → **413 `too_large`**, before any database write |
| **Vanished account** (production) | row deleted directly, then both `GET /api/map` and `POST /api/map` for that id → **404 `unknown_user`** |
| sendBeacon-compatible body (production) | `POST /api/map` with `Content-Type: text/plain` (mimicking a `Blob`-typed beacon) and a JSON body still parses and saves correctly — `_lib.read_json()` needed no changes |
| `pin` never in a response | grepped every captured response body across all of the above — zero hits |
| Post-cleanup sanity | throwaway route removed, confirmed 404; `/`, `/edit`, and a real `/api/map` call all still 200/expected on production afterward |

All DB-dependent checks ran against **production**, immediately after merging, via a
throwaway `api/smoketest.py` cleanup route scoped to `name=like.__*` (same convention and
same add-use-remove lifecycle as 1b's smoketest route) — branch previews have no Supabase
credentials, so this is the only place these checks can run, per `run-order.md`.

---

## Decisions I made for you

- **`beaconFlush` added to the adapter interface** beyond design §7's four named methods —
  see above. It's the only place that could own the "who is the current user" knowledge the
  beforeunload flush needs.
- **A new `#dlgConflict` dialog** rather than reusing `#dlgConfirm` a third time with
  different dismissability semantics.
- **Bypassed `web/session.js`'s `apiFetch` for `/api/map`** in `storage-hosted.js` — required
  by design §8 failure mode 3, but implemented as a deliberate, commented deviation rather
  than silently diverging from the established convention.
- **Simplified `btnRender`'s transient two-phase button label to one phase** ("Working…"),
  since `adapter.render()` doesn't expose a mid-operation hook. Status-line wording is
  unaffected and preserved exactly.
- **Ran the DB-dependent verification via a throwaway production route**, not preview, for
  the same environment reason 1b did, with the identical self-limiting/cleanup discipline.

## Decisions worth revisiting

- **No `rev` column** (design §8, restated from `phase-1a-outcome.md` and
  `phase-1b-outcome.md`). Now proven correct **through the actual `/api/map` route**, not
  just the raw PostgREST call — a fresh token saves, a stale one 409s, `updated_at`'s
  timestamptz round-trips correctly with no offset-encoding issue. This makes the case for
  adding a `rev bigint` column later even weaker than 1b already left it — the mechanism
  works and has now been exercised by the exact code that ships. Still a data-model change,
  so still **phase 2's call to take with Thomas present**, per `decisions.md`.
- **Vercel's `?mode=hosted` rewrite destination has no client-visible effect via `/edit`**
  (see above) — harmless today because of how `HOSTED` is detected, but worth knowing if a
  later phase ever tries to rely on that query string actually appearing in
  `location.search` when reached through a rewrite. It won't.

## For the next session (1d)

`api/map.py` exists and is the pattern to follow for `api/gallery.py` and `api/admin.py`:
`sys.path.insert` + `from _lib import ...`, lookup-then-act where a guard needs the current
row, and never `select=`-ing `pin`. `web/session.js`'s `apiFetch` remains the right choice
for 1d's pages (gallery, view, admin) — the `apiFetch`-bypass in `storage-hosted.js` is
specific to the editor's autosave contract and should not be copied elsewhere without the
same justification.
