# Theology Map — UX from first principles, unconstrained

*Written 2026-09-10. Report only; nothing in the app was changed.*

**Scope of the licence.** This document deliberately ignores the standing technical
brief (stdlib-only Python, vanilla JS, no bundler, no dependency, `requirements.txt`
stays empty). It asks what this product would be if it were designed today from
nothing. Section 6 then puts the money back on the table and asks honestly what any
of it would cost.

**Two things it does not touch, because they are product ethics and not tech
choices:**

1. Compare is descriptive, never evaluative. No person-vs-person scorecard, no
   leaderboard, no number attached to a named person. Everything below preserves
   this, including in the redesigned screens.
2. The content model is the person's own words. Nothing appears in a map that the
   person did not write or explicitly accept. No quiz result is ever imposed.

---

## 1. The verdict

**The product is built as a shelf of documents, not as one application over one
live model — and every symptom the owner named is a direct consequence of that.**
There is no persistent client-side state, no router, and no single addressable
object that all four surfaces agree is "my map". Instead, `/wizard`, `/learn`,
`/compare` and `/view` are four independent HTML files that each cold-boot the
entire world on arrival: 904 KB of corpus JSON across sixteen `fetch` calls
(`web/corpus.js:loadCorpus`), a fresh `GET /api/map`, and a full markdown re-parse
through `EditorCore.parse` — and `/compare` adds 436 KB of tradition maps on top of
that. Moving between them is `location.href = ...`, a full document teardown; moving
*within* one is `el.hidden = true` plus `window.scrollTo(0, 0)`
(`web/wizard.js:showScreen`), which is why "going into and out of questions isn't
very smooth" — there is literally nothing there to be smooth, no transition, no
shared element, no browser history entry, no back button. The entire product
contains exactly two animations: a skeleton pulse in `web/gallery.html` and a 150 ms
disclosure-triangle rotation in `engine/theme.css:106`. And the namesake artifact —
the map — is not a view of the person's data at all: it is a complete HTML document
generated server-side by Python `render_markdown`, handed back as a string and
injected as `srcdoc` into a sandboxed iframe (`web/view.html`), so nothing on the
site can link into it, click a belief inside it, or edit from it. "It's not simple
to get to *my map*" is not a nav-label problem. The map is a dead-end export of a
model the rest of the app never shows you.

---

## 2. The ideal product

### 2.1 The core loop

One object, one canvas, three lenses on it.

> **The map is the app.** It is on screen at all times. Everything else — a
> question, a doctrine explainer, a comparison — is a panel *over* the map, never a
> different place you navigate to.

The loop is: **see the map → find a gap → answer one question → watch the map gain a
node → repeat.** That last clause is the whole design. Today, answering a wizard
question produces a `POST /api/map` and an invisible state change; the person's
reward for eighteen questions is a number on a launchpad. In the ideal, answering a
question makes a node *appear on the map behind the sheet*, tinted with its tier
colour, with the sheet sliding down to reveal it. That is the loop's payoff, and it
costs one animation.

### 2.2 The screens

There are **four**, not eleven.

**1. Map (home, and the only real screen).** A pan/zoom canvas of the person's own
beliefs, grouped by area, coloured by tier. Empty areas are rendered as ghosted
placeholders showing how many unanswered questions live there — so the map itself is
the progress meter and the to-do list, and there is no separate launchpad with four
stat tiles. Tapping a node opens the **belief sheet** (2). Tapping a ghost opens the
**question sheet** (3). A persistent bottom-right FAB says *Next question* and always
does the obvious thing.

On desktop/iPad the canvas is the full window with a collapsible left rail listing
the fourteen areas. On a phone it is the canvas alone, pinch-zoomable, with the FAB.

**2. Belief sheet.** A bottom sheet (phone) / right panel (desktop) over the map,
opened from a node. It shows *What I hold* in the person's own words, tier,
confidence, and the five optional fields behind one disclosure — the phase 3 split,
kept verbatim, because it is correct. It is **editable in place**: no separate
`/edit` surface, no raw markdown form, no "Open the editor" card. Two tabs at the top
of the sheet: **Mine** and **Others** — *Others* is `/learn`'s doctrine page,
inlined: every position side by side, who holds each one, sources, the tier note.
That single tab move is what stops Learn feeling bolted on. Learn is not a place; it
is the second half of a belief.

**3. Question sheet.** The same sheet geometry, in "not answered yet" state. Position
cards, the person's own-words escape hatch, *I haven't worked this out yet*, *Ignore
for now*. Swipe left/right (or `←`/`→`) moves between questions *inside the sheet*
without the sheet ever closing — one card slides out, the next slides in, the map
never redraws. This is the direct answer to "going into and out of questions isn't
smooth": today, `renderQuestion` tears down and rebuilds the entire `#positions`
host, resets a dozen DOM ids, and scrolls to top; in the ideal, the sheet is a
persistent shell and only its card content transitions.

**4. Compare overlay.** Not a separate page with its own picker screen. From the map
you pick a tradition or a member from a single search-anywhere control, and the map
**recolours in place**: each node gets a small state mark — same / same in substance /
different / they take no position — and doctrines you have not answered appear as the
same ghost placeholders, now labelled with what the other side holds. Tapping a node
opens the belief sheet with a third tab, **Beside**, showing the two holds side by
side. Person-to-person stays exactly as constrained: per-doctrine only, no score
anywhere, no aggregate, no ranking. For a *tradition* the existing closest-tradition
sentence with its denominator can live in a dismissible strip at the top of the
overlay — it is descriptive, said of a tradition, and already carefully worded.

**That is it.** `/gallery`, `/history`, `/admin`, sign-in, unlist — all real, all
low-traffic, all fine as ordinary routed pages behind a menu. They are not the
product and should stop competing with it for nav slots. The current six-item nav
plus five home tiles plus a five-screen in-page state machine in the wizard is
sixteen destinations for a product with four ideas in it.

### 2.3 A first-time phone user, landing to finished map

1. Lands on `/`. One sentence, one button: **Start**. No sign-up wall. (Today they
   must create an account before seeing a single question — `web/wizard.js:main`
   redirects a signed-out visitor to `/`.)
2. Tapped Start → **question one is on screen in under a second**, with a faint
   empty map behind it. The corpus for *the first question only* has arrived; the
   rest streams in behind. No tradition-lens screen up front — asking a
   non-technical church member "is there a tradition whose answers should be shown
   first?" before question one is asking them to self-identify before they have
   done any thinking, which is both intimidating and the wrong order. Offer the lens
   after question five, as a one-tap strip: *Show [Baptist]'s answers first?*
3. They answer. The sheet drops, a node lands on the map, the sheet rises with
   question two. Sixty to ninety seconds per question, no page loads, no scroll
   jumps.
4. After roughly eight answers, a full-screen moment: the map, zoomed to fit, with
   their eight beliefs on it and the tier bar. *This is your map so far.* Then back
   into the loop. (Duolingo's end-of-lesson beat, and it is the single largest
   missing piece of motivation in the current flow.)
5. They stop whenever they like — the map is already saved and already theirs.
   Closing the tab is a legitimate ending. **Only now** does the app ask for a name
   and PIN, framed as *save this so you can come back*. The map they already built
   is the reason to sign up, not a promise of one.
6. A tap on **Share** gives the read-only link. Done. Total: one screen, N sheets,
   zero navigations.

### 2.4 The owner on visit 50, on an iPad

He opens the app and is looking at his own map — not a landing page with tiles, not a
launchpad with stats. He is a returning user; the map is home.

- **Search from anywhere** (`⌘K` / a persistent field): types "krypsis", jumps to the
  node, sheet opens, he edits a sentence, it saves. Ten seconds. Today that same
  errand is: `/` → *My map* tile → `/view?name=Thomas` → read the iframe → realise he
  cannot edit in it → nav → *Edit* → `/edit` → List tab → find the node in a sidebar
  tree → edit → Save. Eight steps and two different mental models of the same belief.
- **Deep links that survive.** `/#belief/krypsis` opens the map focused on that node
  with its sheet open. Every state in the app is a URL, so a bookmark, a back button
  and a shared link all work. Today the wizard has *five* screens and *zero* URLs;
  the browser back button on a question screen leaves the wizard entirely.
- **Review mode** — the repeat-thinking-tool feature the product does not yet have.
  A queue of his own beliefs surfaced by staleness and by `#study` / confidence
  `open`, one per sheet, with three actions: *still holds* / *changed my mind* /
  *needs work*. This is Anki's loop pointed at his own words rather than at
  flashcards, and it is what turns a one-time wizard into something worth opening on
  the fiftieth visit. The data to drive it already exists: `#study`, `confidence:
  open`, `todo`, and `map_versions.saved_at`.
- **Compare as a lens, not an errand.** Two taps to lay Reformed over his own map and
  see it recolour; two taps to take it off.

---

## 3. Where the current app diverges, ranked by cost to the user

Ranked by how much the user actually loses, not by how hard it is to fix.

### 1. The map is an iframe of a server-rendered document, so nothing connects to it
`web/view.html` POSTs to `/api/render`, gets a complete HTML page back as text, and
sets `frameEl.srcdoc = html` into a frame sandboxed without `allow-same-origin`.
Consequences that cost real usability every single visit: you cannot click a belief
in your map and edit it; you cannot deep-link a belief; the map cannot show compare
state; the map cannot show what is *missing*; and `render.py` had to grow a
`<html class="framed">` mode plus `sizeMap()` plus a `body.tm-enlarged` fullscreen
hack plus the `.tm-main { width:100% }` rule (all documented in CLAUDE.md, all real
bugs) purely to make a document pretend to be a view. **This is the single most
expensive divergence in the product**, because it is why the map — the thing the app
is named after — plays no part in the loop.

### 2. There is no persistent state or router, so every move is a cold boot
Every arrival at `/wizard`, `/learn` or `/compare` runs `loadCorpus()`: 16 fetches,
904 KB of JSON, then a full `Core.parse` of the person's markdown. `/compare` then
loads all twelve tradition maps, 436 KB, eagerly — CLAUDE.md already flags this as a
growth marker. On `/learn`, *every doctrine click is a full page navigation*
(`row.href = '/learn?doctrine=' + id`), which re-runs the entire boot to change one
panel of content. On a church member's phone on a church car park's 4G, that is the
felt clunk.

### 3. Question transitions have no continuity of any kind
`renderQuestion()` clears `#positions` with `host.textContent = ''`, rebuilds every
card, resets `#open-answer`, `#custom-answer`, `#who`, then `showScreen()` toggles
five `hidden` flags and calls `window.scrollTo(0, 0)`. No transition, no shared
element, no direction, no history entry. The screen simply *is different now*. This
is precisely the owner's "going into/out of questions isn't very smooth/dynamic",
and it is a structural absence rather than a missing CSS rule.

### 4. "My map" is four hops from where you spend your time
On a wizard question screen the site nav is *hidden entirely* — `showScreen()` sets
`chromeEl.hidden = q`, leaving only *Shown first* and *Finish here*. So: Finish here →
launchpad → nav → Home → scroll past three cards → *My map* tile → `/view` → iframe.
Four navigations and a scroll to see the thing you have spent twenty minutes
building. Worse, "My map" is a tile built at runtime in `web/landing.html`'s inline
module, so it is invisible to a signed-out visitor and unfindable by anyone who has
not scrolled the home page.

### 5. Learn and Compare route the same intent to two different places
On a `/learn` doctrine page, the action for an unanswered doctrine is
`edit.href = '/edit?open=' + doctrine.slug` — it drops you into the **raw markdown
form editor**. On `/compare`, the same intent is `'/wizard?doctrine=' + doctrine.id`
— the wizard question screen, correctly. Two surfaces, same user goal, different
destinations, different mental models, and one of them is a developer tool. This one
line is the clearest evidence that the three features were built as three programs.

### 6. Signup precedes value
`web/wizard.js:main` — `if (!user) { location.href = '/'; return; }`. A curious church
member cannot see question one without creating an account. TheoCompass's open beta
requires no account for its 30 questions and only proposes accounts at v2.0, for
saving results. The map should be the thing that earns the signup.

### 7. Nothing moves, and the type system knows it
Two animations in the entire codebase. `engine/theme.css` defines a genuinely good
palette — warm paper-and-ink, a garnet→slate tier ramp chosen for AA contrast, serif
for content and sans for chrome — and then never moves any of it. The design language
is *better* than most hobby projects; the motion vocabulary is absent. It reads as a
static site because, in every technical sense, it is one.

### 8. Small drift that signals the bigger problem
`web/learn.html:13` still declares its own copy of `--t1`…`--t4`, which CLAUDE.md
records as deleted from all four `web/` files in phase 10. One survivor. Harmless
today; symptomatic of eleven hand-maintained HTML files each carrying 150 lines of
page-local CSS.

---

## 4. The stack, if it were built today

Each piece has to earn its place against a solo hobbyist's maintenance budget. I have
listed the cost honestly, including the ones I would not take.

| Piece | Why it earns its place | What it costs |
|---|---|---|
| **SvelteKit** (over React/Next) | The app is one canvas plus sheets — a state problem, not a component-library problem. Svelte's stores give you the single live model that section 1 says is missing, and `svelte/transition` gives the sheet, the card slide and the node-lands animation as three one-word directives rather than a motion library. It compiles away: the runtime is ~10 KB, so a phone on 4G still boots fast. SvelteKit's file-based router turns every state into a URL, fixing divergence 3 and 4 at once. | A build step, `node_modules`, a `package.json` that will need bumping, and a framework the owner must learn. This is the single biggest cost in the table and the one to think hardest about. |
| **Vite** | Comes with SvelteKit. HMR means editing a sheet's layout is instant instead of save-and-reload. | Nothing beyond the above; it is the same dependency. |
| **TypeScript** | The corpus has real shape — doctrines, positions, `held_by`, `tradition_overrides`, `superseded_holds`. Generating types from the corpus JSON catches the class of bug CLAUDE.md documents repeatedly (`order.indexOf(next)` returning -1 for two months; `web/gallery.html`'s unescaped apostrophe blanking a screen). | Compile-time friction. Mitigated: `checkJs` on plain `.js` gets 80% of it with zero syntax change. |
| **A design-token layer (CSS custom properties + one `tokens.css`)** — *not* Tailwind | `engine/theme.css` is already 80% of a design system and the palette is genuinely good. Formalise it: spacing scale, radius scale, motion durations, elevation. Tailwind would throw away a real, considered palette in exchange for utility classes the owner would then have to learn. | Nearly free. This is the highest-value-per-cost item in the table. |
| **A real map renderer — D3-force or ELK, in the app, not in an iframe** | Kills divergence 1. The map becomes a component over live data: clickable, linkable, compare-colourable, gap-showing. `engine/map-view.js` and `render.py`'s embedded copy — the largest duplication in the repo, ~390 vs ~430 lines hand-kept in lockstep — both collapse into it. | A layout library (~30 KB) and a genuine rewrite of the most-tested, least-test-covered code in the project. Pan/zoom/pinch/detail-open needs browser verification, which this program has historically not had. |
| **Postgres + Supabase, kept** | Already there, already works, already free at this scale. | Nothing new. |
| **A real data model: `beliefs` as rows, not markdown in a `text` column** | Today every single answer serialises the *entire map* to markdown and POSTs 512 KB-capable text with optimistic concurrency on `updated_at`, plus four separate guards against an empty save erasing everything (`web/wizard.js:commitOnce`, `api/map.py`). One row per belief makes an answer a one-row upsert, makes conflict impossible in the common case, deletes three of the four guards, and makes "show me every belief that changed since March" a query instead of a diff of two blobs. Markdown becomes an *export format*, which is what it should have been. | A migration with real data in it, a rewrite of `EditorCore`, and the loss of the property that a map is one hand-editable file. That property is load-bearing for the offline tool. See section 6. |
| **PWA: manifest + service worker (Workbox)** | The corpus is 904 KB of static JSON that changes monthly. Cached once, the app opens instantly and works on a train. "Add to home screen" is what makes it feel native to a church member. | ~20 lines of config plus one genuine hazard: a stale service worker serving an old corpus. Needs a version-and-skip-waiting discipline. |
| **Python `api/` functions, kept** | They are small, correct, well-documented, and `_lib.py`'s "one file knows Supabase exists" rule is good architecture. | Nothing. Do not touch these. |
| **What I would NOT add** | No state library (Svelte stores suffice). No component library (the palette is the differentiator; MUI would erase it). No animation library — Framer Motion is 40 KB to do what `svelte/transition` and four CSS `@keyframes` do. No auth provider; the "security is deliberately minimal and that is the brief" posture is correct for a church directory of publicly-held opinions. No test framework beyond the `node:test` already in use. | — |

**Total honest cost of the ideal stack for a solo hobbyist:** one framework to learn,
a `node_modules` to keep patched, a build that can break a deploy in ways a static
file cannot, and the permanent end of "double-click the HTML file and it works".

---

## 5. Comparable products: what to steal, specifically

**TheoCompass** (theocompass.com) — 30-question open beta, 13 theological dimensions,
roadmap to 60 and 120-question modes; results are an interactive compass chart, a
"theological fingerprint" of per-dimension scores, a dynamic label cloud, and 230+
denominations you can expand card-by-card to see axis-by-axis alignment.
*Steal:* (a) **no account for the first run** — value first, signup second; (b) the
**expandable denomination card**, which is exactly the right shape for the *Others*
tab on a belief sheet; (c) the fact that the result is a **picture**, immediately,
which this app's result — a markdown file behind an iframe — is not.
*Do not steal:* the scoring. TheoCompass computes your position and hands it to you.
This app's whole ethical premise is the opposite: the person writes their own words
and sets their own tier. The compass chart is a great artifact of a model this
product has deliberately refused. Take the *immediacy* of the visual payoff, not the
mechanism.

**Kialo** (kialo.com) — structured argument maps as pro/con trees, with a persistent
**minimap** offering Tree or Sunburst navigation: the tree shows the full path from
thesis to the currently selected claim, dimming everything not on that path, plus
zoom/reset controls beneath it.
*Steal:* the **minimap-plus-breadcrumb-path**. Kialo solves precisely the problem this
app has — a structure too big for one screen — by keeping a small persistent
orientation widget and highlighting the route to where you are. That is what the
wizard's `#wz-crumb` ("Scripture · question 12 of 86") is *trying* to be and cannot,
because it is a text string with no spatial referent. In the ideal, the question
sheet's crumb is a live minimap of the map behind it, with your area lit.

**Duolingo** — one question per screen, a short bounded session, a progress bar that
visibly moves per answer, immediate animated feedback, and a distinct end-of-session
moment before you are released.
*Steal:* (a) the **bounded session** — 86 questions is a wall; "eight questions, about
five minutes" is a thing a person will start; (b) **the progress bar that moves as you
answer**, which this app has as a static count on a launchpad you have already left;
(c) **the end-of-session beat** — section 2.3 step 4. Duolingo's genuine insight is
that the reward has to be *visible and immediate*; here the reward is a node landing
on your map, which is better than a streak counter because it is actually the thing
you came for.
*Do not steal:* streaks, hearts, guilt. The wizard's "Finish here — no confirmation,
no warning, no guilt" note in `web/wizard.js` is exactly right and must survive.

**Anki** — a queue of one item at a time, keyboard-driven, where the *scheduling* is
the product: what you see is chosen by when you last saw it and how you rated it.
*Steal:* **review mode for the owner** (section 2.4). Anki is the answer to "what does
the fiftieth visit look like?" — not more new questions, but a queue of your own
positions resurfaced by staleness and by `#study`. Three buttons, one item, keyboard
shortcuts. This is the largest missing *feature* in the product, as opposed to the
largest missing *quality*.

**Obsidian Canvas / Roam** — an infinite canvas where nodes are the real documents,
not pictures of them: you drag them, edit them in place, and every link is
bidirectional and live.
*Steal:* **the map as a first-class editable surface**. The current app has a
pan/zoom map with content-driven box widths, tier ordering, staggered packing and
cursor-anchored zoom — genuinely good work in `engine/map-view.js` — and then serves
it inside a sandboxed iframe where none of it can be clicked through to anything.
Obsidian's canvas is the same layout problem solved with the nodes still alive. Also
steal **local-first**: Obsidian's files are yours on disk, which is the same instinct
as this project's `theology-map.md`, and is worth protecting (section 6).

**Notion** — progressive disclosure at scale: toggle blocks, a slash menu that hides
every command until you ask, and multiple views (table, board, timeline) over *one*
underlying database.
*Steal:* (a) **one dataset, many views** — Notion's core trick is that the table and
the board are not different pages, they are lenses. That is exactly the relationship
map / list / tier / confidence should have, and today they are four tabs inside a
generated document that nothing else can reach; (b) **the disclosure discipline** —
this app already does this well (`details.optional` for the five secondary fields,
"Read about this question" hiding all of a doctrine's prose) and should keep it
rather than reinventing it.

---

## 6. The honest migration question

### What a rewrite would actually cost

Not the fun parts. The parts that would hurt:

- **`engine/render.py` is ~1300 lines and is the renderer for two worlds.** The local
  `start_editor.bat` workflow depends on it entirely, offline, with no network and no
  database — CLAUDE.md states that as a hard constraint: *"If a change would make the
  local tool need either, it is the wrong change."* A SvelteKit app cannot render the
  local tool's map. So a rewrite either abandons the local tool or maintains two
  renderers forever, which is the fork problem the project already has, doubled.
- **Byte-identity gates would all die.** `render_markdown` hashing to a pinned value,
  `study-list.md` and the `<script id="data">` payload staying byte-identical across
  a restyle — these are the project's only real regression tests for the renderer, and
  they exist because there is no browser verification in the program. A rewrite
  deletes them and puts nothing in their place.
- **The corpus is the actual asset and is untouched by any of this.** 86 doctrines,
  250 positions, 53 `tradition_overrides`, 569 sources of which phase 9 verified every
  one and deleted 99 unsupported attributions. That is months of genuine work and it
  is plain JSON — it migrates for free. Worth saying plainly: *the expensive thing is
  already portable.*
- **`superseded_holds` and exact-normalised `hold` matching.** Compare recovers a
  position by exact match on the hold sentence with a deliberately narrow four-step
  `normalise`. A data-model change to one-row-per-belief must carry this rule across
  intact or every existing map silently stops resolving — and CLAUDE.md notes nothing
  enforces it today.
- **Realistically: 6–10 focused sessions** for a competent rewrite of the four
  surfaces, plus a data migration with live user data in it, plus browser
  verification of pan/zoom/pinch that this program has never had to do before. And a
  Vercel build that can now fail in ways a static file cannot.

### What would be lost

The offline double-clickable tool. The zero-dependency property. The ability of a
future session to read one file and understand the whole path. The `file://` editor.
And a large amount of hard-won, *documented* knowledge — `debug.md` §Q through §AK is
a real asset, and most of it is about DOM and CSS specifics that a rewrite discards
along with the bugs.

### What is reachable without a rewrite — and this is most of the felt improvement

Ranked by felt-improvement-per-unit-of-work. All of these are vanilla JS, no build
step, no dependency.

1. **Put the site nav back on the wizard question screen, and put "My map" in it.**
   `showScreen()` currently hides `chromeEl` on the question screen. Stop doing that,
   and add a "My map" link to `web/chrome.js`'s list. Divergence 4 is a two-line fix
   and it is the owner's most-cited pain.
2. **Make `/learn`'s unanswered action go to the wizard, not `/edit`.** One line:
   `edit.href = '/wizard?doctrine=' + doctrine.id` when there is no node yet. The
   wizard already handles that param. Divergence 5, mostly gone, for one line.
3. **Give the question screen a transition.** Wrap the `#positions` rebuild in a
   `View Transition` (`document.startViewTransition`, native in Chrome/Edge/Safari,
   graceful no-op elsewhere) or a 180 ms opacity+translate CSS class toggle. Ten
   lines. This directly addresses "going into/out of questions isn't smooth" without
   any framework.
4. **Stop `scrollTo(0, 0)` from being the transition.** Keep the sheet's shell —
   crumb, nav row, `#who` — mounted, and rebuild only the card list.
5. **`pushState` per wizard screen.** `history.pushState({screen, idx}, '', '?q=' + slug)`
   in `showScreen()`, plus a `popstate` handler that calls `renderQuestion`. Now the
   back button works, questions are bookmarkable, and the five-screen state machine
   becomes five URLs. ~20 lines, and it is most of what a router buys.
6. **Lazy-load the eleven non-target tradition maps on `/compare`.** CLAUDE.md already
   names this as the next performance move. Saves ~400 KB on the most-loaded page.
7. **Cache the corpus in `sessionStorage` or a service worker.** 904 KB fetched
   sixteen ways on every arrival at three different pages is the single biggest
   cause of the cold-boot feel, and one small service worker fixes it across all of
   them without touching a line of app code.
8. **Add a motion vocabulary to `engine/theme.css`.** Three tokens (`--dur-fast: 140ms`,
   `--dur: 220ms`, `--ease: cubic-bezier(.2,.8,.2,1)`), a `prefers-reduced-motion`
   guard, and use them on cards, disclosures, sheet-like panels and selection state.
   This alone changes "it moves like a static site" more than any framework would.
9. **A bounded session and an end-of-session beat.** After eight commits, show the
   tier bar and the count full-bleed with a *Keep going / I'm done for now* pair.
   Pure UI, no model change, and it is Duolingo's best idea.

**What is genuinely NOT reachable without structural change:** the map as a live,
clickable, compare-colourable surface (divergence 1 — that needs the iframe gone,
which needs a JS renderer, which needs the `render.py`/`map-view.js` fork resolved);
per-belief saves instead of whole-map serialisation; and review mode as anything more
than a static list.

### The recommendation

**Evolve. Do not rewrite — yet.** Items 1 through 9 above are perhaps two focused
sessions of work with no new dependency, no build step, and no risk to the offline
tool, and between them they address *all four* of the owner's stated complaints:
getting between screens (1, 2, 5), in and out of a question (3, 4, 9), compare and
learn feeling bolted on (2, 6), and visual/motion polish (3, 8). That is an
unusually good ratio and it would be dishonest to talk past it toward a rewrite that
is more interesting to build.

The rewrite question should be re-asked when — and only when — the owner wants the
thing that genuinely requires it: **the map as the app**, editable in place, with
compare as a colour layer over it. That is a real product improvement, not a
refactor, and it is worth a rewrite when he wants it. It is not worth one to make
the question screen fade nicely.

One thing worth doing *before* any of it: unforking the Map-view engine. ~390 lines
inside `render.py`'s template string against ~430 in `engine/map-view.js`, hand-kept
in lockstep, is the largest duplication in the repo, and CLAUDE.md already sketches
the fix (`render.py` inlines `map-view.js` via a second `.replace`, with a small
adapter for the two input shapes). It is the load-bearing prerequisite for the map
ever becoming a live surface, it is valuable on its own, and it is the one piece of
the ideal that the current architecture can absorb without becoming something else.
