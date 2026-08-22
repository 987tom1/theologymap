# Phase 2 — outcome

**Branch:** `phase-2-harden` → merged to `main` (`--no-ff`, commit `4404de6`),
followed by two direct-to-`main` commits for a throwaway cleanup route's lifecycle
(added, run, removed) — the same shape and the same reason as 1b's and 1c's.

**Ran:** 2026-08-23. Model: Opus, main thread, **zero subagents**, per the brief.

**No stop-and-wait.** The one condition that lets phase 2 halt — "something phase 1
built needs redoing rather than patching" — was **not** met, and the reasoning is in
`phase-2-review.md` under Blue. Phase 3 is unblocked and should start.

**But read this first, because it was live on production for a day:**

> **Any signed-out stranger could overwrite any public map, including Thomas's.**
> `POST /api/map` authorises a save with the row `id` and the `updated_at` token
> and nothing else, and `GET /api/gallery` published exactly those two fields for
> every public row. Reproduced on production against a test account, not inferred.
> **Fixed and verified fixed on production.** Full account: `phase-2-review.md` B1.
>
> The second finding is nearly as bad and had the same blast radius:
> **a stored XSS in `render.py`** meant any hosted user's map could run script on
> theologymap's origin in any visitor's browser, and read that visitor's session
> out of `localStorage`. Also fixed and verified.

Nothing was fixed on `theology-map.md`, on Thomas's row, or on any generated file
by hand. His map's `updated_at` is unchanged from where the session found it
(`2026-08-22T19:38:38.947112+00:00`).

**Branch name discrepancy, as instructed:** `phase-2-brief.md`'s Output section
names the branch `phase-2-review`; `run-order.md` and `phase-1e-outcome.md`'s
hand-off both name `phase-2-harden`. `run-order.md` is the newer document and was
followed. `phase-2-review.md` is the review *document*, which is probably where the
brief's wording came from.

---

## What was fixed, ranked as the brief asks

The rule was: everything that risks data loss or silent corruption, plus anything
materially more expensive to fix after phase 3, and **nothing else**.

| # | Finding | Class | Verified on production |
|---|---|---|---|
| B1 | Unauthenticated overwrite of any public map | **data loss** | gallery returns no `id`; `/view?name=` and `POST /api/render {name}` work; unknown name 404s |
| B2 | Stored XSS via `</script>` in the JSON payload, plus an unescaped `data-goto` attribute | **corruption / credential theft** | the live route's output carries the `<` escape and no raw breakout |
| B3 | `*` still an ILIKE wildcard — `name=__phase2_victim*` logged in as that user | **account takeover** | that login now 401s; `%` 401s; the real name and its uppercase form still 200 |
| B4 | A missing `name` on `/api/admin` returned 500, not the identical 403 | error shape | now `403 forbidden`, byte-identical to the others |
| B5 | Admin self-delete guard compared the caller's string, not the row's canonical id | **irrecoverable data loss** | code fix; the accept path is un-runnable (below) |
| B6 | Ten f-string PostgREST paths, unquoted | hardening | all values now go through `_lib.q()` |

Each is cheaper now than after phase 3 for the same reason: phase 3 builds a
gallery, a share button and a first-run flow directly on top of B1's shape.

`api/_test_lib.py` gained runnable assertions for the two new pure helpers
(`_pick_exact`, `q`) — the name match is a credential path with four branches, so
it earns one. `py api/_test_lib.py` → PASS.

## What was deliberately **not** fixed, and where it goes

| Finding | Why not | Goes to |
|---|---|---|
| **B7** `GET /api/map` has no ownership check | closing it means giving the route a credential — an auth-model change. B1's fix already shrinks it from "anyone who read the gallery" to "the owner or an admin". The clean answer is for `set_visibility` to rotate the row id, which is a data-model change. | **Thomas**, then phase 3 |
| **B8** the gaps *between* the four empty-save guards (`force: true` bypassing both; the conflict dialog's Overwrite path forcing; `draftKey()` keyed by name; `beaconFlush` with no result path) | every one is a UX decision, and none can be exercised without a browser | **phase 3** |
| **B9** `apiFetch`'s `unknown_user` redirect and the editor's conflict dialog | need a browser; forbidden program-wide | permanently unobserved unless Thomas looks |
| `/edit?as=` | still unwired, and still un-testable without an admin account. 1e removed the broken button; nothing was added back. | **phase 3**, once an admin login exists |
| Gallery `limit` (the "200-row ceiling" in `decisions.md` is not implemented) | cosmetic at two rows | **phase 3** |
| `storage-hosted.js` opening a tab *and* downloading on Render; `URL.revokeObjectURL` fired immediately after `a.click()` in `view.html`'s export; `#dlgConfirm` relabelled by three call sites | cosmetic | **phase 3** |
| The `rev` column | closed, not deferred — see below | — |

## The five admin actions are still un-run, and now permanently so without Thomas

A real account named **`Thomas`** exists (the gallery shows it, and the three
`__`-prefixed rows 1e reported are gone), so the sign-up half of the bootstrap has
happened and the `is_admin` half very likely has too.

**They remain un-runnable anyway, for a reason 1e did not face:** every admin action
re-verifies **name + PIN** server-side, and no session has Thomas's PIN. Guessing it
was not attempted, and no route may grant `is_admin` — not temporary, not scoped
(`decisions.md`, design §9, and 1d already litigated this).

So `list_users`, `delete_account`, `reset_pin`, `set_visibility` and admin
`save_map` are **declared un-run**, exactly as 1d and 1e declared them — including
the three that carry 1e's PostgREST-204 fix and the one that carries this phase's
B5 fix. The *reject* path is re-verified live, again, this phase.

### Thomas: this needs five minutes from you, and only you can do it

Sign in at `/admin` with your name and PIN, and:

1. **Click through all five actions once**, on a throwaway account you create for
   the purpose (sign up as `test1` at `/app`, then act on it from `/admin`):
   list users → hide it → check it left `/gallery` → reset its PIN → sign in with
   the new PIN → delete it. If any of them shows an error, say which one; three of
   them have never executed against the real database.
2. **Confirm `is_admin` is actually set on your row** — if `/admin` returns
   "Forbidden" with your correct PIN, the bootstrap SQL never ran:

   ```sql
   update public.users set is_admin = true where lower(name) = lower('Thomas');
   ```

3. **Two questions only you can answer**, both recorded below as decisions worth
   revisiting: whether hiding a map should rotate its id (B7), and whether map
   history (`map_versions`) is wanted before the wizard lands.

## The baseline hashes moved. This is why, and it is legitimate

`render.py` changed (B2), so its output changed, so the generated files were
**regenerated** with `py engine/render.py` — never hand-edited.

| | Phase 1 | Phase 2 onward |
|---|---|---|
| Local file, `Path.write_text` (CRLF) | `20d869…449ba` | **`6b64839d4f60506d55e297b966e6be341998e5a0ec3a0984a7c60942bf74cf76`** |
| LF-normalised (hosted response) | `96d692…d4a2a2` | **`eaedf3e4f85bd41accb08e894e1df6be870567c3ee57b63dbc3fb8ab57301a90`** |

Both are recorded in `CLAUDE.md` with a note saying what moved them. Verified after
the merge: `POST /api/render` with the full map on production returns the new LF
hash exactly, and `GET /` serves bytes identical to the committed
`theology-map.html`. `documentation/theology-map.mm` and `study-list.md` are
unchanged — the escaping only touches the HTML.

## Verification that gated the merge

| Check | Result |
|---|---|
| Byte identity, new baseline | **PASS** — function output == committed file == production response |
| One renderer | **PASS** — one `render_html`, one `parse_text`, one `render_markdown` |
| Parser lockstep | **PASS** — `once === twice === src`, 99 nodes both parsers, `editor-core.js` / `map-view.js` untouched |
| `start_editor.bat` offline | **PASS** — run, not read: server up, editor + all scripts served, full Save & render chain, `git status` clean afterwards, no network call |
| `py -m py_compile` on every `api/*.py` | **PASS** |
| `py api/_test_lib.py` | **PASS** |
| Branch preview | **PASS** — routes import, error shapes right, DB probe correctly `500 misconfigured` |
| B1 fixed | **PASS**, production |
| B2 fixed | **PASS**, production |
| B3 fixed, with both controls | **PASS**, production |
| B4 fixed | **PASS**, production |
| Save round trip, stale token 409, empty save 409, oversize 413, unknown user 404, `text/plain` beacon body | **PASS**, production |
| Admin reject path — three shapes, byte-identical 403 | **PASS**, production |
| Method guards, `/api/_test_lib` 404 | **PASS**, production |
| All six pages 200 signed out | **PASS**, production |
| No PIN in any captured body | **PASS** — zero hits across the whole run |
| Test rows cleaned up | **PASS** — gallery is now exactly one row: `Thomas` |

## Decisions I made for you

- **Keyed the public read path by `name` instead of adding auth or a column** (B1).
  The two alternatives were a PIN on every save (which non-negotiable 8 forbids in
  spirit and design §11.8 in letter) and a separate share-id column (a data-model
  change, which stops and waits). Names are already unique and already public.
  **Consequence you should know about:** `/view?id=` no longer works. Nobody has
  shared such a link — the gallery went live yesterday and the only real row is
  yours — so no compatibility shim was built. `/` is untouched and every link you
  have actually sent still resolves.
- **Regenerated the generated files** rather than leaving a known XSS in place to
  preserve a hash. The hash is a guard against *accidental* renderer drift, not a
  reason to ship a vulnerability.
- **Dropped `allow-same-origin`** from `view.html`'s iframe as defence in depth,
  in addition to fixing the escaping.
- **Amended `phase-3-plan.md` in place** (two lines, dated, marked as phase 2's
  amendment) rather than only mentioning it here — its Task 7 "copy link" button
  would have handed out write access verbatim.
- **Built one throwaway cleanup route** to delete this phase's `__`-prefixed test
  row, then removed it. 1d's session was blocked from doing this and left rows in
  the gallery; with the gallery down to two rows and one of them a test account,
  tidiness stopped being cosmetic.
- **Did not attempt Thomas's PIN**, in any form, for any check.

## Decisions worth revisiting

- **The `rev` column: close it.** Four sessions of evidence say `updated_at` as the
  concurrency token works — raw PostgREST (1b), through `/api/map` (1c), end to end
  (1e), and a stale token → `409 conflict` again this phase. The timestamptz
  round-tripping worry never materialised. **Recommendation: drop the question**
  rather than keep carrying it. It is a data-model change so it is still Thomas's
  word, but it is not an open risk and no future outcome file should list it as one.
- **Should `set_visibility` rotate the row id?** (B7.) Hiding a map does not
  currently stop anyone who already noted its id from reading it through
  `/api/map`. Rotating the id on hide is the clean fix and is a data-model
  behaviour change on the primary key. **Thomas's call.**
- **`map_versions` (design §1).** Still the only real answer to admin "restore" and
  to `force: true` walking past all four empty-save guards. New table, so it waits —
  but **phase 4's session should raise it on day one**, because the wizard is the
  first feature that can generate or replace a whole map in one action.
- **The service-role key everywhere** (design §2). 1e flagged this after its bug 2;
  phase 2 found two more full-table-reach bugs (B3, B5) in the same shared helper.
  The pattern is real: one slip in `api/_lib.py` reaches every row. It is still the
  right trade against a silently-failing RLS policy, but it is now a trade with
  three data points, not zero.
- **No verse text for hosted users** (design §4). Unchanged; needs a table.

## For phase 3 — read before starting

1. **Read `phase-2-review.md` B1 before writing the gallery.** Its plan is amended
   in two places; the reasoning is not, and the reasoning is what generalises.
2. **The row `id` is a credential.** It belongs in the owner's `localStorage` and
   in an admin's `list_users` reply, and nowhere else. `CLAUDE.md` now says so.
3. **Extract `editor.html`'s controller.** It is ~900 lines of inline IIFE holding
   the only code in the app that can destroy someone's work, and it cannot be
   exercised without a browser. Design §7 already says the adapter seam makes the
   extraction cheap. It is a precondition for ever testing autosave, not a tidy-up.
4. **Budget for cold start, do not architect around it:** ~0.2–0.9 s over static
   warm, ~1.5 s cold, measured. A loading skeleton is the right answer.
5. **The seam question, every time you add a route:** *what does this route trust,
   and who else publishes that value?* Every serious bug phase 1 produced — and
   both of phase 2's worst — lived in a join between two sub-phases, and not one
   lived inside a function.
