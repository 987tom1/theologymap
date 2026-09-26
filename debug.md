# debug.md — Theology Mind Map (Project 12)

Non-obvious failure modes found while building and hosting this project. **Read this
file before touching `api/*.py`, `engine/render.py`, `engine/editor.html`, or anything
under `web/`.**

This is the working file: the diagnostic rules, and what is still open. The
thirty-seven full write-ups they were distilled from (§A–§AK) live in
`documentation/debug-archive.md` — go there when a rule is not enough and you need the
narrative. Phase-level accounts are in `docs/hosting/phase-*-outcome.md`.

**The pattern behind nearly every real bug this project has produced: it lived in a
seam between two files or two sub-phases, never inside a function's own logic.** A
relative import under a rewrite, a response's content type, a PostgREST status code,
an interpreter's name, a public reply publishing a private write credential. Each file
was individually correct against its own brief. **Check the joins, not the parts.**

## Diagnosing a live failure

Twenty-nine rules, each earned by a real bug. The `§` reference points at the
write-up in `documentation/debug-archive.md`.

### Before you believe the symptom

1. **A build that is committed is not a build that is deployed.** Confirm the branch
   you fixed is the branch production serves before believing any screenshot —
   phase 10 sat unpushed for a fortnight while every session assumed it was live.
   `git rev-list --left-right --count HEAD...origin/main` costs a second. Then grep
   the served file for a string **only the new build contains**; a sentinel present in
   both builds reports a success that never happened. (§X)
2. **A committed migration is not an applied migration.** Same rule, other half of the
   stack. Probe the RPC — `POST /rest/v1/rpc/snapshot_map` answers `404 PGRST202` when
   the function does not exist.
3. **A bug report that quotes on-screen text is a report about that text.** Grep the
   exact words first. §U burned two hypotheses about broken imports before
   `grep "Connect or upload"` found a hard-coded sentence written for a different
   runtime. (§U)
4. **A button that "does nothing" on tap is a silent-failure report, not a mobile
   report,** until proven otherwise. §T looked platform-specific for two rounds of
   guessing before a try/catch surfaced the real exception on the first attempt. Any
   handler with no error path is a black box — wrap it before theorising. (§T)
5. **Check one wide viewport before calling a layout done.** A 300px intrinsic
   fallback and a trimmed header both read as *correct* on a phone. Two bugs shipped
   this way after an explicitly phone-sized review round. (§AJ)

### Where the bug actually is

6. **A bug that looks like it is inside one file's logic, where that file's own review
   found nothing wrong, is very likely a seam bug.** Ask what environment or caller the
   file assumes, not what the file does. (§A–§G)
7. **When two files answer the same question about the same credential, read them side
   by side, not one at a time.** §AC was three individually-correct decisions that only
   failed in combination. If a file's comment explains why it *doesn't* check
   something, grep every other reader of that field before changing either. (§AC)
8. **When a change turns a rare code path into the common one, audit that path, not
   your diff.** §AA was a data-loss bug latent for as long as revisit meant "the person
   pressed Back". The commit that made it reachable did not touch it. (§AA)
9. **A class name used to clear elements is a namespace with one owner.** If two
   builders write the same class, one will be cleared or duplicated by the other's
   logic. Grep every writer of a shared selector before editing either. (§V)
10. **Check what the database actually holds before concluding the code is wrong.**
    A gallery returning `node_count: 0` was chased as a counting bug; the row was
    simply empty. (§O)

### CSS and layout

11. **A pane that will not hide despite correct JS is a CSS specificity bug.** An
    author `#id { display: ... }` rule beats the browser's own
    `[hidden] { display: none }`, so toggling the attribute does nothing visible.
    Check the stylesheet for a same-selector `display` rule before reading the JS a
    second time. `web/wizard.html` carries one global
    `[hidden] { display: none !important }` as the root-cause fix for the class. (§Q)
12. **A measurement taken inside `display:none` is zero, not stale.** If a layout is
    right after a resize but wrong on first paint, ask what was hidden when the layout
    pass ran, and what one-shot flag that pass consumed. Moving a default tab is enough
    to expose it. (§AB)
13. **Uneven spacing in a `gap`-based flex/grid container is margins adding to the gap,
    not a broken rule.** Check the children's own margins — including the UA default on
    a bare `<p>`. (§AF)
14. **A `width: 100%` element that comes out too small is a question about its
    parent.** Percentages resolve against the containing block; in a flex container an
    `auto` cross-axis margin cancels the stretch and leaves no definite width. (§AJ)
15. **`position: fixed` does not give an iframe's document a usable `100vh` on iOS.**
    Safari does not re-resolve the inner `100vh` against the frame's new height.
    `/view`'s old fullscreen was a class on `<body>`, not the Fullscreen API, for this
    reason and because iOS Safari has no `requestFullscreen()` on a non-video element; it
    was removed in phase 1.5 in favour of map-first chrome. (§AH)

### Modules, builds and the toolchain

16. **A page that renders *nothing* — not even its own loading state — is a syntax
    error in its module,** not a data or network problem. A module that fails to parse
    runs none of its lines while the server logs stay clean.
    `py tests/syntax_check.py` answers it in one second. (§AI)
17. **"Importing a module script failed" is a 404 on the module** — nearly always a
    path that resolved somewhere you did not expect. Work out the URL the engine
    actually requested and `curl` it. **Do not assume `<base href>` covers a dynamic
    `import()`** — Safari does not apply it from an inline classic script. (§Y)
18. **A route importing `render.py` that returns plausible zeros, not an error, may be
    bound to the wrong same-named module.** `api/render.py` is a sibling of
    `engine/render.py` on the same `sys.path`. Check `vercel.json`'s `includeFiles` for
    that function before trusting a count. (§N)
19. **`py`, never `python`.** Bare `python` hits the Microsoft Store stub and fails
    with no useful error. Any doc saying `python engine/...` is wrong. (§F)
20. **A diffstat wildly bigger than your change is a line-ending rewrite.**
    `pathlib`'s `write_text` translates `\n` to `os.linesep` on Windows.
    `Path.read_text(newline='')` needs 3.13 and this machine is 3.11, so **scripts that
    edit repo files read and write bytes.** Read `git diff --stat` *before* committing,
    not after. (§P, §AG)

### Verifying a fix

21. **These modules run from plain `node`, with no browser, DOM or login.**
    `wizard-generate.js`, `editor-core.js` and `compare-core.js` are UMD;
    `WG.loadCorpusSync('content/wizard')` loads the real corpus. §T was fully
    reproduced and fixed this way. Reach for it before asking a human to reproduce
    anything touching the corpus or the node model. (§T)
22. **A number the UI says out loud needs an assertion on realistic input, not just a
    passing unit suite.** §AD shipped a confidently wrong answer past sixteen green
    assertions, because none built a small map and read the resulting sentence. Build
    the smallest real case and print what the person would actually see. (§AD)
23. **`render_markdown` byte identity is the fastest check that the renderer has not
    drifted.** Only a change that alters the output *on purpose* may move it, and only
    by regenerating with `py engine/render.py` — never by hand. Current values and the
    two surviving invariants are in `CLAUDE.md`.
24. **A `@supports not (position-anchor: ...)` fallback that pins to the viewport's
    corner, not the trigger element, is what "menu renders on the wrong side of the
    screen" looks like on an engine without CSS anchor positioning** (Safari, at least
    as of this writing). Found in `web/chrome.js`'s ⋯ popover, 2026-09-18: the fallback
    was `position: fixed; top/right: var(--s4)` — anchored to the viewport, not the
    button. Fixed with a JS `getBoundingClientRect()` fallback on the button's own
    toggle, gated on `CSS.supports('position-anchor: --x')` so anchor-capable engines
    run none of it. Check any other `[popover]`/`position-anchor` element the same way
    before trusting it on a laptop.

### Map-first phases (2026-09-23)

No archive write-ups; the commits carry the detail.

25. **Rebuilding DOM that contains the focused element drops focus to `<body>`.** Hit
    twice: a Related link inside the map's detail panel reselected, the panel rebuilt,
    and Escape/arrow keys stopped working (`c8674a5`); and the editor's `touch()` rebuilt
    the whole List on every keystroke, which once the form sat inline threw away the
    caret and the typed text. The pattern: build a panel on selection change only,
    update a row in place on an edit, and if a structural rebuild must move a focused
    node, restore focus to the same element afterwards.
26. **`el.style.cssText = …` replaces every inline property, including `transform`.**
    `.mbox` transitions `transform`, so a redraw that copied a fresh tile's whole style
    made every tile fly in from the origin (`64891ad`). Set the one property you mean
    (`style.setProperty('--tier', …)`).
27. **Anything that changes a header's height must re-size what was sized from it.**
    `sizeMap()` ran on render and window resize only; opening the phone Filters
    disclosure grew the header, a search re-rendered, and closing it left the canvas a
    third short. A `ResizeObserver` on the header is the fix; a `resize` listener never
    fires for it.
28. **A page-local bare element rule leaks into shared components that do not reset
    it.** `web/landing.html` gives every `button` a `margin-top`; the shared ⋯ button
    did not reset margin, so on `/` alone it sat 8px below the nav labels. Shared
    components reset the box properties a page might set.
29. **What a headless check cannot see, it passes.** `document.getAnimations()` did not
    report the flying-tiles transition, so a check built on it passed against the bug;
    a `MutationObserver` with `attributeOldValue: true` on the tile's `style` caught the
    intermediate state. Prove a new check against the broken code before trusting it.
    Tooling note: the Chrome extension cannot reach this machine's localhost —
    Playwright (Chromium; installed under Project 11.1's `node_modules`) against
    `py engine/render_server.py` at `127.0.0.1:8420` is what works.
30. **Check `document.visibilityState` before believing a Chrome-extension walk.** With
    the Chrome window hidden, screenshots time out ("renderer may be frozen") and
    `/view`'s sandboxed map frame neither paints nor takes input, while page JS runs
    normally — it reads exactly like a hung map. Two six-hat-review (2026-09-25)
    "bugs" were this, plus harness artefacts: the `ViewTransition … InvalidStateError`
    seen on `/view` and `/thomas` came from `document.write`-ing an iframe wrapper and
    does not occur on ordinary navigation. A same-origin `<iframe style="width:390px">`
    wrapper is still a good phone-width check for everything else.

## Still open

Not bugs — state a fresh session needs. Delete each line as it is closed.

1. **`storage-local.js` has no `load()` any more.** It only ever threw. The three
   `.load()` call sites in `editor.html` were traced as hosted-only. If a local-mode
   session ever reports "adapter.load is not a function", that trace was wrong and the
   guard belongs back.
2. **`_lib.py` still tries two names each for the Supabase URL and key.** Its own
   comment says trim to the confirmed one; only the live Vercel environment shows which
   is set, and guessing takes the site down. Read the dashboard, then cut.
3. ~~**The Map-view engine is still forked**~~ — **closed by P9 on 2026-09-12.**
   `engine/map-view.js` is the one source and `render.py` inlines it. The lockstep gate that
   restricted edits to three functions is retired with it: edit the map engine there and
   nowhere else. See `CLAUDE.md` § *Known forks*.
