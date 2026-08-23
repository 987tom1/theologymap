# Phase 8 — outcome

**Branch:** `phase-8-versions`. **Model:** Sonnet, one session, pulled forward
ahead of phase 5 per `decisions.md`'s 2026-08-23 amendment.
**Merged to `main`** with `--no-ff` (`b6ba2d3`, commit `6189943`); every gate
below passed first, and it is pushed and live.

---

## What landed

`map_versions` has been write-only since phase 4. This phase gives it a
reader, on the two existing routes the brief named — no new serverless
function, no schema change.

| Where | What |
|---|---|
| `api/map.py` | Two new actions: `{action: "versions", user_id}` — the caller's own list, newest first, `[{id, saved_at, bytes, node_count}]`, **never markdown**. `{action: "restore", user_id, version_id, expected_updated_at}` — filters the version on `user_id` AND `id`, snapshots the current map first with `force=True`, then the same optimistic-concurrency PATCH the ordinary save uses. |
| `api/admin.py` | Same two actions, keyed by `target_id` instead of the caller's own id — the locked "edit/restore any map" admin power stops being aspirational. The admin version list skips `node_count` (see "One judgment call" below). |
| `vercel.json` | `api/map.py` gets its own `includeFiles: "{engine/render.py}"` entry, because it now imports `engine/render.py` for `node_count` — same pattern `api/gallery.py` already uses, bound at import time so a missing bundle 500s on the first request instead of silently returning zero. |
| `web/index.html` | An **Earlier versions** section on the map-home pane: relative time, size, belief count where the parse succeeds, a Restore button. Confirming shows the locked wording — *this replaces your map with the version from `<when>`. Your current map is saved first, so you can come back.* Empty state is the locked copy, verbatim. |
| `web/admin.html` | A **Versions** button per user row that toggles an inline panel of Restore buttons, same confirm wording, scoped to that admin's target. |
| `web/chrome.js` | `relTime()` moved here from `gallery.html`'s local copy, so `index.html` doesn't duplicate the `Intl.RelativeTimeFormat` setup — one shared helper, not two. |

Vocabulary throughout is **belief** and **area**, never "node" or "domain",
per `phase-3-design.md` §2.2.

## One judgment call

**The admin version list drops `node_count`.** The brief allows this
explicitly for the self-service list ("if that feels like too much for a
count, drop `node_count` and ship `bytes` alone") and I extended the same call
to the admin route: giving it `node_count` too would mean a second
`engine/render.py` import and a second `vercel.json` includeFiles entry in
`api/admin.py`, for a nicety the brief already marked optional once. `bytes`
and `saved_at` are enough to pick a version to restore from the admin table.

## Verification

Every check the brief lists, run and read.

| Check | Result |
|---|---|
| `py engine/render.py` | No diff on the three generated files — nothing in `git status` after running it |
| Byte identity | `render_markdown` on `theology-map.md`, LF-normalised, hashes to `eaedf3e4f85bd41accb08e894e1df6be870567c3ee57b63dbc3fb8ab57301a90` — **MATCH** |
| `git diff --numstat main -- engine/render.py engine/editor-core.js engine/map-view.js` | Empty |
| `py -m py_compile api/*.py` | Clean |
| `py api/_test_lib.py` | `PASS` |
| `node --check` on every touched module | `web/chrome.js` directly; `web/index.html`, `web/gallery.html`, `web/admin.html`'s inline `<script type="module">` blocks extracted to `.mjs` and checked the same way — all clean |
| `py engine/validate_content.py` | exit 0, 15 warnings — all pre-existing (missing domain files, `holy-spirit.json`/`traditions.json` coverage notes), none introduced by this phase |
| `node tests/wizard-generate.test.js` | all 12 assertions pass |
| `py tests/check_generated_map.py` | 16 prefix maps checked, 0 problems |
| Local workflow, run not read | Started `py engine/render_server.py`, fetched `engine/editor.html` (200) and `engine/theme.css` (200), `POST /api/render` with a small markdown body (200), stopped the server, confirmed `git status` showed only the intended seven-file diff |

### On production, after merging and pushing

Branch previews have no database, so all four of these ran against
`https://theologymap-thomas-l-s-projects.vercel.app` after the merge landed.
Confirmed the new deploy was live first: `POST /api/map {"action":"versions",
"user_id":"00000000-0000-0000-0000-000000000000"}` returned `unknown_user`,
not the old route's `"Missing markdown."` — proof the new action code was
actually serving, not a stale deploy.

| Check | Result |
|---|---|
| `versions` on a real account returns a list with no `markdown` field | **PASS** — grepped the raw response body for the literal string `markdown`; not present |
| `versions` with someone else's `version_id` in `restore` → refused | **PASS** — a second throwaway account restoring with the first account's `version_id` got `404 unknown_version` |
| A real restore round trip: save A, save B with `force`, restore A, confirm the map is A and B is now itself a version | **PASS** — saved "Version A" (`snapshotted: false`, nothing to preserve on an empty row), saved "Version B" with `force: true` (`snapshotted: true` — A preserved), listed versions (one entry, A, no `markdown` key), restored A (`snapshotted: true` — B preserved), re-fetched the map (`markdown` is Version A's), listed versions again (**two** entries — B's snapshot and A's original snapshot) |
| The 409 path: restore with a stale `expected_updated_at` | **PASS** — `409 conflict`, `"This map was changed somewhere else."` |
| Retention (last 20 per user) | **NOT VERIFIED.** Needs 21 saves an hour apart, same as phase 4 found. Saying so plainly rather than claiming a check that wasn't run: the retention `delete … where id not in (select … limit 20)` clause is reviewed SQL from phase 4, unexercised then and still unexercised now. If it's wrong the symptom is unbounded row growth per user, not data loss. |
| Admin `versions`/`restore` against production | **NOT RUN.** No session holds the admin PIN — same posture phase 1e and phase 2 declared for the rest of the admin surface before Thomas exercised it by hand on 2026-08-23. `py -m py_compile` and the route wiring are the only checks available here; they pass. |

**Two throwaway accounts from this verification are still in the gallery:**
`zz-phase8-check` and `zz-phase8-check-2`, PINs `593817` and `284739`. Same
shape as phase 4's `zz-schema-check` — the probe needed real accounts, and
deleting one needs an admin PIN no session holds. `zz-phase8-check` now holds
"Version A" content from the restore test; both are otherwise empty of real
data. Delete them from `/admin` whenever convenient.

**`zz-schema-check` was not touched**, per `decisions.md`'s "No session should
touch it or re-raise it" — this phase left it alone and did not check whether
Thomas has removed it yet.

## Decisions worth revisiting

None. The brief's design held exactly as written — no schema surprises, no
design question left open.
