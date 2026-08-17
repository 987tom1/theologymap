# Web hosting brief — multi-user Supabase/Vercel deployment

Status: not started. This is an input brief for a future session, not an
implementation plan itself — see "Next session prompt" at the bottom.

## What this is

Turn the local, single-file theology mind map tool into a hosted site where
anyone can make an account, log in with a PIN, and create/edit/save/view/export
their own map, plus browse other people's maps. **Security and privacy are not
a concern for this feature** — PIN auth can be a plaintext comparison, no
hashing, no session framework, no rate limiting.

## Chosen approach: Option A

Reuse `engine/render.py` as-is rather than porting its rendering logic to JS.

- **Storage**: Supabase Postgres. A `users` table (name, pin, markdown,
  updated_at) is enough for one map per user; add a separate `maps` table only
  if map history/versioning turns out to matter.
- **Auth**: name + PIN checked as plaintext against the row. Store the
  matched user id in `localStorage` client-side. No hashing, no cookies/JWT
  library.
- **Rendering**: Vercel supports Python serverless functions natively
  (`api/*.py`). Wrap `render.py`'s existing generation logic as an API route —
  POST markdown in, get back the same HTML `render.py` already produces
  locally. This is the piece that keeps the build honest: **one render
  implementation, not two.** Do not fork or reimplement the Domain / Tier /
  Confidence / Threads views or the print stylesheet in JS.
- **Gallery ("view other people's maps")**: a page listing rows from `users`;
  clicking one fetches that user's stored markdown and renders it read-only
  through the same render API route.
- **Export**: the render API's HTML output *is* the export — trigger a
  download of the response body.
- **Editor reuse**: `engine/editor.html` / `editor-core.js` / `map-view.js`
  already do in-browser parsing, live map preview, and serialization against
  an in-memory model. Repoint their load/save calls at Supabase instead of the
  File System Access API / `render_server.py` — the editing UI itself should
  need minimal change.

## Two constraints specific to this deployment

1. **Native Vercel/Supabase wiring, minimal manual config.** Provision
   Supabase through Vercel's own Supabase integration (the Marketplace
   integration that links a Supabase project to the Vercel project and syncs
   env vars automatically) rather than standing up Supabase separately and
   hand-copying keys into Vercel env vars. Use `vercel link` / the standard
   Vercel CLI project flow. Goal: no manual `.env` juggling beyond what the
   integration does for you.

2. **The local workflow must keep working unmodified.** Double-clicking
   `start_editor.bat` today launches `engine/render_server.py`, which serves
   `engine/editor.html` against the local `theology-map.md` on disk via the
   File System Access API, with **Save & render** POSTing to the local server
   to rerun `render.py` → `fetch_verses.py` → `render.py`. None of that should
   break or require a network connection. The hosted app is **additive**: a
   new surface (new pages/API routes, a Supabase-backed variant of the
   editor/viewer) that coexists with the existing local, file-based tool.
   `theology-map.md` at the repo root stays Thomas's personal reference copy,
   edited the same way it is today. Concretely, this likely means
   `render.py`'s core generation function needs to be callable from both
   `render_server.py` (local, given a file path) and the new Vercel Python API
   route (hosted, given a markdown string in a request body) without
   duplicating the function.

## Next session prompt

When implementation work on this brief starts, follow this sequence:

1. Invoke the `superpowers:brainstorming` skill first to work through the
   design (data model, route/file layout, how `render.py` gets shared between
   `render_server.py` and the new Vercel API route, how the editor's
   load/save wiring changes) — do not skip straight to a plan or to code.
2. Once the design is settled, invoke `superpowers:writing-plans` to produce
   the implementation plan.
3. **Skip `claude-in-chrome` verification** — do not drive a real browser to
   verify this feature; verify by other means (reading responses, running the
   render function directly, etc.).
4. **Use Sonnet subagents for mechanical/independent work** where the plan
   has tasks that don't need to run on the main thread (e.g. writing
   boilerplate CRUD routes, wiring a known-shape Supabase client, repetitive
   UI wiring) — dispatch those in parallel to conserve tokens, per this
   user's established preference for pushing mechanical work to Sonnet
   subagents and reserving the main thread for judgment calls.
5. This file is the requirements input for both steps 1 and 2 — read it in
   full before starting the design.
