# Map-first chrome (phase 1.5) Implementation Plan

> For agentic workers: superpowers:executing-plans. Spec: `docs/superpowers/specs/2026-09-23-phone-map-panel-and-outline-design.md` (Addendum 2026-09-23).

**Goal:** the map canvas gets ≥520px of a 390×664 phone in `/view` without Fullscreen; Fullscreen removed.

**Global constraints:** as the phase 1 plan (stdlib only; byte-identity pair moves, study-list `f4a30fe1…` and payload `4d8d919e…` must not; never stage Thomas's CLAUDE.md row; `py`; glob for node tests). New CSS that must beat a page rule wins on specificity.

**Check:** a headless Chromium run (scratchpad, iPhone 13 device profile) of `/view?tradition=anglican` against the local server with `/api/render` routed to the local renderer, measuring the canvas height before and after, plus phase 1's 34 checks.

### Task 1 — generated page header (engine/render.py)
≤640px: header is a two-column grid (`.titlerow`, `.titlefilters`, `.bar` → `display:contents`); `.viewrow` col 1, `#filtersToggle` col 2; `#q` spans both columns and shows only while `.secondary.open`; `h1` visually hidden; toggle gets `::after` dot while `#q` has text (`:has`). `#mapwrap` border 0 / radius 0 at ≤640px; `sizeMap()` drops its 24px allowance at ≤640px. Regenerate, check invariants, record the pair.

### Task 2 — site chrome compact mode + /view (web/chrome.js, engine/theme.css, web/view.html)
`mount(title, actions, opts)`; `opts.compact` adds `.tm-chrome--compact` and a `⋯` disclosure button (`aria-expanded`, `aria-controls`) toggling `.menu-open`. theme.css ≤640px: compact hides kicker, truncates h1, hides `.tm-chrome-actions`/`.toplinks` unless `.menu-open`. view.html: pass `{ compact: true }`; delete Fullscreen (CSS, button, handlers); ≤640px `.tm-main` padding/gap 0, iframe border/radius 0, tradition intro hidden.

### Task 3 — editor header (engine/editor.html)
Add a `⋯` disclosure button in the header (≤640px only) toggling `header.menu-open`; ≤640px hides `#fileStatus`, `.toplinks`, `.hactions` unless open. Delete Fullscreen (`#full-btn`, `editor-enlarged`, `setEnlarged`, its Escape handler).

### Task 4 — docs, check, push
CLAUDE.md §4 phone paragraph, §6 `mount()` signature, §7 framed-map Fullscreen bullet, §5 editor Fullscreen mention. Full §9 gate, headless check, push.
