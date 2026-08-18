# Phase 3 — design (interface revamp)

Written 2026-08-18 by a planning session, for a build session starting cold with no
memory of the conversation that produced it. The companion document is
`phase-3-plan.md`; read this one first.

**Goal, restated from the brief:** someone who has never seen the tool can land on
it, make an account, and build a map of their own beliefs without being told how.

Phase 1 made the tool multi-user. Phase 3 makes it multi-*person*.

---

## Inputs, in precedence order

1. `docs/hosting/decisions.md` — Thomas's locked calls, the 2026-08-18 wireframe
   amendments, and the verified environment facts. **These override everything
   below.** Do not re-open them.
2. This document and `phase-3-plan.md`.
3. `docs/hosting/phase-1-design.md` §6 (route and page inventory), §7 (the editor's
   adapter seam), §8 (autosave) — the infrastructure being redesigned.
4. `Project 13 - Prompt for Projects/phase-3-ui-revamp.md` — the source brief.
5. `Project 12 - Theology Mind Map/CLAUDE.md` — the design language, the four views,
   the phone layout, the editor's current structure.

Where the source brief and `decisions.md` differ, `decisions.md` wins. The three
places they do differ are listed in "Where the brief is now out of date" below.

## Environment facts that bite

- **The interpreter is `py`, not `python`.** Bare `python` hits the Microsoft Store
  stub and fails. Every command in these two documents says `py`. Two earlier
  sessions concluded Python was missing because they trusted a literal `python`.
- The production site is public and returns 200 unauthenticated:
  `https://theologymap-thomas-l-s-projects.vercel.app/`.
- Post-phase-0.5 baseline: **99 nodes across 14 domains**, **four views not five**,
  `#thread` gone entirely.
- `py engine/render.py` regenerates `theology-map.html` with **no diff**. That is the
  regression alarm for every step in this phase.

---

# 1. What is actually wrong today

Read the four files before designing anything: `engine/editor.html` (716 lines —
230 of CSS, ~470 of inline controller), `engine/editor-core.js` (166),
`engine/map-view.js` (582), `engine/shared-fields.js` (79).

Five concrete findings, each of which a screen below answers:

1. **`engine/editor.html` contains no width media query at all.** Its only `@media`
   is `prefers-color-scheme`. `nav.tree` is a hard `width:290px; flex:none` inside a
   `display:flex` layout, and `.mapwrap` is `height:calc(100vh - 170px)` — a magic
   number that assumes the filebar occupies exactly one row. On a 360px phone the
   tree eats 81% of the viewport and the filebar wraps to three rows, so the map is
   ~170px shorter than the calc believes. The editor has never had a phone layout.
   The *public* map has a considered one; the editor does not.

2. **Every node field is presented with equal weight.** `renderForm()` emits Title,
   then a two-column Tier/Confidence row, then flags, then Hold, Why, Vs, Todo,
   Refs, Links — nine decisions, flat. A stranger cannot tell that a node with only
   a title and a `hold` is already a useful node.

3. **The vocabulary is unexplained at the point of use.** The List form's tier
   `<select>` offers bare `T1 … T4`. The Map tile's offers `Tier —`, `T1`, `T2`…
   Meanwhile `engine/render.py` already carries a one-line gloss for every value in
   `TIER_META` and `CONF_META` — *the explanations exist and are simply not shown in
   the editor.*

4. **The same field is called two different things.** `map-view.js:266` labels the
   `todo` field **"Study"**; `editor.html:540` labels it **"Todo — what still needs
   working out"**. Separately there is a `#study` *flag*, which is a different thing
   entirely. One product, two voices, on the one concept most likely to confuse.

5. **There is no first-run screen.** A new account gets an editor whose empty state
   reads *"Connect or upload theology-map.md above to start editing"* — copy written
   for a local file workflow that does not exist for a hosted user.

---

# 2. Vocabulary — the contract phase 4 must match

Locked by `decisions.md`: **`tier`, `confidence` and `#study` keep their names**, in
the file format *and* in the user-facing UI, explained inline at the point of use.
No glossary page. No renaming. `#thread` does not exist.

This phase adds no new concept nouns. What it fixes is that the existing ones are
never explained and one of them is labelled inconsistently.

## 2.1 The words, and the sentence shown beside each

Every string below is **already in `engine/render.py`** (`TIER_META`, `CONF_META`).
Phase 3 surfaces them in the editor rather than inventing new copy. Phase 4's wizard
must use these same strings.

**Tier** — the label is the word "Tier". Options render as `value — gloss`:

| Stored | Shown in the editor |
|---|---|
| *(unset)* | `Tier — not set yet` |
| `T1` | `T1 — Essential to the gospel` |
| `T1.5` | `T1.5 — Near-essential` |
| `T2` | `T2 — Church-defining` |
| `T2.5` | `T2.5 — Strains partnership` |
| `T3` | `T3 — Important, not divisive` |
| `T4` | `T4 — Matters of liberty` |

Helper line under the control, shown once per node the first time its optional
section is opened, and always in the List form:
> *How much weight this carries. T1 is the gospel itself; T4 is a matter of liberty.
> Leaving it unset is fine.*

**Confidence** — options render as `value — gloss`:

| Stored | Shown in the editor |
|---|---|
| *(unset)* | `Confidence — not set yet` |
| `certain` | `certain — Settled. I would teach and defend this.` |
| `confident` | `confident — Held with good reason, open to sharpening.` |
| `leaning` | `leaning — A working position, not yet settled.` |
| `open` | `open — Genuinely undecided.` |
| `rejected` | `rejected — Considered and rejected.` |

Helper line:
> *How sure I am — not how important it is. Those are two different questions.*

That last sentence is the single most valuable piece of teaching in the interface,
because tier-versus-confidence is the one distinction a stranger reliably collapses.

**`#study`** — a checkbox, labelled exactly:
> `#study — I still need to work this out`

**The `todo` field is renamed in the UI to "Still working out"**, in both the List
form and the Map tile. This resolves finding 4. The field key in
`theology-map.md` stays `todo` — no parser change, no format change.

Rationale for keeping `#study` and `todo` as separate things rather than merging
them: `#study` is a *filter* (the public map has a three-way study filter, and
`study-list.md` is generated from it); `todo` is *prose about what is unresolved*.
A person can flag a node for study with nothing written yet, and can write a
paragraph of unresolved reasoning on a node they are not currently studying.

## 2.2 The full label table phase 4 must reuse verbatim

| Concept | Stored as | UI label | Never say |
|---|---|---|---|
| tier | `T1`…`T4` | **Tier** + gloss | "importance", "priority", "level" |
| confidence | `certain`…`rejected` | **Confidence** + gloss | "certainty %", "how sure (1-5)" |
| study flag | `#study` | **`#study` — I still need to work this out** | "needs review", "TODO" |
| `hold` | `hold` | **What I hold** | "position", "belief", "answer" |
| `why` | `why` | **Why** | "reasoning", "justification" |
| `vs` | `vs` | **What I'd reject** | "against", "opposing view" |
| `todo` | `todo` | **Still working out** | "Study", "Todo" |
| `refs` | `refs` | **Texts** | "verses", "scripture", "citations" |
| `link` | `link` | **Related** | "links", "see also" |
| a node | — | **belief** in prose, **node** never | "node" in user-facing copy |
| a domain | `# Heading` | **area** in prose, heading in the tree | "domain" in user-facing copy |

The last two rows matter: the file format's word is `domain` and the code's word is
`node`, but the user-facing copy says **"a belief"** and **"an area"**. Phase 4's
wizard says the same. Code identifiers are unchanged.

---

# 3. Design language — what must survive, and the two additions

Unchanged and non-negotiable, from `CLAUDE.md` and the brief:

- Warm paper-and-ink palette in both themes.
- Serif for content (`--serif`), sans for chrome (`--sans`). Never the reverse.
- Prose capped at **58ch**.
- The tier ramp is **garnet → rust → ochre → olive → teal → slate**, chosen for AA
  contrast with white chip text. **Do not reintroduce traffic-light tier colours** —
  the earlier amber values failed contrast.
- Any new asset is **bundled, never fetched from a CDN**. `start_editor.bat` has no
  network. No web fonts, no icon library, no CSS framework. Everything below is
  plain CSS on the system font stacks already declared.

## 3.1 The existing tokens (unchanged)

```
light  --bg #f6f3ec  --panel #fffdf8  --ink #23201a  --muted #6b6255
       --line #e2dbcb  --chip #ede6d6  --good #3d6b3d  --bad #7c2d3b
dark   --bg #15120d  --panel #201b14  --ink #ece4d5  --muted #a89a85
       --line #372f22  --chip #271f16  --good #7fbf7f  --bad #d98a99
tiers  T1 #7c2d3b  T1.5 #8a4a24  T2 #8c6a1f  T2.5 #5f6b35  T3 #2f6b63  T4 #33526e
```

## 3.2 Contrast audit — calculated, not eyeballed

Run with the script in §3.5. WCAG 2.1 relative luminance, sRGB.

**Text pairs already in use — all pass AA (4.5:1):**

| Pair | Light | Dark |
|---|---|---|
| `--ink` on `--bg` | 14.66:1 | 14.79:1 |
| `--ink` on `--panel` | 15.98:1 | 13.53:1 |
| `--ink` on `--chip` | 13.06:1 | 12.85:1 |
| `--muted` on `--bg` | 5.41:1 | 6.78:1 |
| `--muted` on `--panel` | 5.90:1 | 6.21:1 |
| `--muted` on `--chip` | 4.82:1 | 5.89:1 |
| `--good` on `--panel` | 6.13:1 | 7.87:1 |
| `--bad` on `--panel` | 9.00:1 | 6.55:1 |
| `--bg` on `--ink` (primary button) | 14.66:1 | 14.79:1 |

**Tier chips, white text — all pass AA:**

| Tier | Ratio |
|---|---|
| T1 `#7c2d3b` | 9.15:1 |
| T1.5 `#8a4a24` | 6.81:1 |
| T2 `#8c6a1f` | 5.00:1 |
| T2.5 `#5f6b35` | 5.77:1 |
| T3 `#2f6b63` | 6.17:1 |
| T4 `#33526e` | 8.16:1 |

**Two failures found, both pre-existing, both fixed by this phase:**

**Failure A — form control borders (WCAG 2.1 SC 1.4.11, needs 3:1).**
`--line` against `--panel` is **1.36:1 light / 1.30:1 dark**. Every `input`,
`select` and `textarea` in `editor.html` uses `border:1px solid var(--line)`, so the
only thing marking a field as a field fails the non-text contrast minimum. It is
invisible to a low-vision user and marginal on a phone in sunlight.

Fix: a new token used **only for interactive control boundaries**, leaving `--line`
as the decorative divider it currently is everywhere else.

```
--field-line   light #8f8369   dark #7d7059
```

| `--field-line` against | Light | Dark |
|---|---|---|
| `--panel` | 3.68:1 | 3.53:1 |
| `--bg` | 3.37:1 | 3.86:1 |
| `--chip` | 3.01:1 | 3.35:1 |
| `--note` (below) | 3.11:1 | 3.21:1 |

All ≥ 3:1 on every surface a control can sit on. The existing focus treatment
(`outline:2px solid var(--muted)`) already passes at 5.90:1 / 6.21:1 and is kept.

**Failure B — tier colour as a sole channel in dark mode.** The tier ramp is a set
of dark, saturated hues engineered to hold *white text*. As a bare swatch against
the dark theme's panel they measure **1.87:1 (T1) to 3.42:1 (T2)** — below the 3:1
needed for a meaningful non-text graphic:

| Tier | vs light `--panel` | vs dark `--panel` |
|---|---|---|
| T1 | 9.00 | **1.87** |
| T1.5 | 6.69 | **2.51** |
| T2 | 4.92 | 3.42 |
| T2.5 | 5.67 | **2.96** |
| T3 | 6.07 | **2.77** |
| T4 | 8.03 | **2.09** |

This is harmless today, because tier colour only ever appears as a filled chip whose
white label carries the meaning, or as a 3px left border that is redundant with that
chip. It becomes a real defect the moment phase 3 introduces the **tier-spread bar
on gallery cards**, where colour would be the only carrier.

**Rule, therefore, binding on every screen in this phase and on phases 4 and 6:**
> Tier colour is never the sole channel. Any tier-spread graphic ships with a text
> line stating the same counts. Do not lighten the ramp to fix this — the ramp's
> darkness is what makes white chip text pass AA, and lightening it would reopen the
> contrast failure the ramp was chosen to solve.

## 3.3 The one new surface token

The provenance notice (§5.3) and the inline explanations need a surface that is
distinct from `--panel` without introducing a colour.

```
--note   light #f0ead9   dark #2a2318
```

`--ink` on `--note` is 13.52:1 light / 12.30:1 dark; `--muted` on `--note` is 4.99:1
/ 5.64:1. Both pass AA.

**But `--note` against `--bg` is only 1.08:1 light / 1.20:1 dark** — a deliberately
quiet surface that is *not perceivable on its own*. So it is never used alone:
every `--note` block also carries `border-left:3px solid var(--muted)` and an
explicit text label. The fill is atmosphere; the rule and the words do the work.

## 3.4 Total new CSS custom properties: two

`--field-line` and `--note`. That is the whole palette change. Every other colour in
this phase is an existing token. This is deliberate — a UI phase merged unseen
should not be able to break the palette.

## 3.5 The contrast script

The build session **runs this and pastes the output into `phase-3-outcome.md`**. It
is the substitute for looking at the screen. Save it to the session's scratchpad,
not into the repo.

```python
# py contrast.py
def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def L(h):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def cr(a, b):
    l1, l2 = L(a), L(b)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)

LIGHT = dict(bg='#f6f3ec', panel='#fffdf8', ink='#23201a', muted='#6b6255',
             line='#e2dbcb', chip='#ede6d6', good='#3d6b3d', bad='#7c2d3b',
             note='#f0ead9', field='#8f8369')
DARK  = dict(bg='#15120d', panel='#201b14', ink='#ece4d5', muted='#a89a85',
             line='#372f22', chip='#271f16', good='#7fbf7f', bad='#d98a99',
             note='#2a2318', field='#7d7059')
TIERS = {'T1': '#7c2d3b', 'T1.5': '#8a4a24', 'T2': '#8c6a1f',
         'T2.5': '#5f6b35', 'T3': '#2f6b63', 'T4': '#33526e'}

TEXT = [('ink', 'bg'), ('ink', 'panel'), ('ink', 'chip'), ('ink', 'note'),
        ('muted', 'bg'), ('muted', 'panel'), ('muted', 'chip'), ('muted', 'note'),
        ('good', 'panel'), ('bad', 'panel')]
UI = [('field', 'panel'), ('field', 'bg'), ('field', 'chip'), ('field', 'note'),
      ('muted', 'panel')]

fail = False
for name, P in (('LIGHT', LIGHT), ('DARK', DARK)):
    print('---', name, '---')
    for a, b in TEXT:
        r = cr(P[a], P[b])
        ok = r >= 4.5
        fail |= not ok
        print(f'  text {a:6s} on {b:6s} = {r:5.2f}:1 {"AA" if ok else "FAIL"}')
    for a, b in UI:
        r = cr(P[a], P[b])
        ok = r >= 3.0
        fail |= not ok
        print(f'  ui   {a:6s} on {b:6s} = {r:5.2f}:1 {"AA" if ok else "FAIL"}')
for t, c in TIERS.items():
    r = cr('#ffffff', c)
    fail |= r < 4.5
    print(f'  tier #fff on {t:5s} = {r:5.2f}:1 {"AA" if r >= 4.5 else "FAIL"}')
print('RESULT:', 'FAIL' if fail else 'all pass')
```

Expected final line: `RESULT: all pass`. **If it says FAIL, the phase does not
merge.** Any colour pair a build step introduces that is not in this script must be
added to it before that step commits.

---

# 4. Where things live — the page map after phase 3

Phase 1 established these. Phase 3 changes what is *on* them, and adds one route.

| URL | File | Phase 3 change |
|---|---|---|
| `/` | `theology-map.html` | **none — untouched** |
| `/app` | `web/index.html` | becomes the front door: signed-out pitch, signed-in map home, **first-run** |
| `/gallery` | `web/gallery.html` | rows → cards |
| `/view?id=` | `web/view.html` | shared chrome + Copy link + Export |
| `/edit` | `engine/editor.html?mode=hosted` | node editor split, responsive layout |
| `/admin` | `web/admin.html` | picks up the shared chrome; no other change |
| `/wizard` | *(does not exist yet)* | **reserved for phase 4** — see §8 |

## 4.1 The front door question, and why `/` is not touched

`phase-1-design.md` §11.3 recorded "`/` still serves `theology-map.html`; phase 3
owns the front door". Phase 3's answer: **leave it.**

- Every link Thomas has already sent points at `/`. Breaking them costs him
  personally, while he is away and cannot repair them.
- `theology-map.html` is generated by `engine/render.py`. Putting product chrome on
  it means editing the ~1300-line generator, which the brief explicitly rules out of
  this phase.
- The screen a stranger actually lands on is **`/view?id=`** — a shared *person's*
  map, not Thomas's. That page is ours (`web/view.html`) and we control its chrome
  completely. The onboarding pressure is on `/view`, not on `/`.

Consequence: `web/view.html` must carry the strongest "make one of these yourself"
call to action in the product. §6.3.

Changing `/` later is one line of `vercel.json`. Logged as **Q4** for Thomas.

## 4.2 Shared chrome

One header on all five product pages (`/app`, `/gallery`, `/view`, `/edit`,
`/admin`). It reuses the editor's existing `header` + `.toplinks` markup, which is
already the right shape.

```
THEOLOGY MAP                       (kicker, sans, uppercase, --muted)
<page title>                       (h1, serif)
My map · Gallery · [Admin] · [Sign out / Sign in]     (.toplinks, sans)
```

`Admin` renders only when `getUser().is_admin` — cosmetic only, the server
re-verifies every call (phase 1 §9). Below 640px the `<h1>` and kicker stay (they
are two short lines) and `.toplinks` scrolls horizontally rather than wrapping into
a tall block.

**Where the chrome's CSS lives, given the offline constraint.** The editor must keep
working from `file://` with no network, so it cannot `<link>` an absolute
`/web/app.css`. Solution: a new **`engine/theme.css`** holding the tokens and the
shared primitives. `engine/editor.html` links it **relatively**
(`<link rel="stylesheet" href="theme.css">`) — a sibling file, which loads fine over
`file://` in Chrome, Edge and Firefox. The `web/*.html` pages link it as
`/engine/theme.css`.

Belt and braces: `editor.html` **keeps its existing inline `:root` block**. If the
relative link ever fails, the editor degrades to today's styling rather than to
unstyled markup. `theme.css` only *adds* `--field-line`, `--note` and the shared
primitives; it never restates a token the inline block already defines.

---

# 5. Screen: first run — the highest-leverage screen in the product

Shown on `/app` when the signed-in user's `markdown` is empty or whitespace. It is
not a modal, not a dismissible tour, and not a checklist. It is what the page *is*
until there is a map.

## 5.1 Copy and structure

```
THEOLOGY MAP
Your map

A theology map is your own beliefs, written down, sorted by how much
weight each one carries. Nobody sees a draft until you are ready.

Three ways to start:

┌──────────────────────────────┐  ← primary, --ink fill, --bg text
│ Answer some questions        │     [PHASE 4 SLOT — see §8]
│ Twenty minutes of questions  │
│ and you have a first map you │
│ can edit. Nothing is added   │
│ that you did not choose.     │
│                              │
│ Start →                      │
└──────────────────────────────┘

┌──────────────────────────────┐  ┌──────────────────────────────┐
│ Start from someone else's    │  │ Add a belief by hand         │
│ map                          │  │                              │
│ Take a copy of a map from    │  │ Write one thing you hold and │
│ the gallery and make it      │  │ build from there. Good if you│
│ yours. It says whose it was  │  │ already know where to start. │
│ until you start editing.     │  │                              │
│ Browse maps →                │  │ Write my first belief →      │
└──────────────────────────────┘  └──────────────────────────────┘

Or just look around the gallery first.
```

The prose block is capped at 58ch. Card body text is serif; card headings and the
call-to-action lines are sans, matching the design language.

Card 1 is `--ink` fill with `--bg` text (14.66:1 / 14.79:1). Cards 2 and 3 are
`--panel` with a `--field-line` border — they are interactive surfaces, so they take
the 3:1 boundary token, not the 1.3:1 decorative one.

## 5.2 Route 3 — "Add a belief by hand"

The whole point is that it does not hand back an empty screen. It:

1. Creates one node with the title `My first belief`, in a domain named `Beliefs`.
2. Saves immediately via the phase-1c autosave path, so the row is no longer empty
   and first-run does not reappear on reload.
3. Redirects to `/edit`, with the new node **already open** and its title input
   focused and text-selected.

The node arrives with `tier` and `confidence` unset — the person's first act is
writing what they hold, not classifying it. That ordering is the whole argument of
§6.1.

Deep link contract: `/edit?open=<slug>`. `editor.html`'s boot reads `open`, finds the
node by slug, opens it in the Map tab, and focuses `.mtitle-input`. If the slug does
not resolve it is ignored silently — a stale bookmark must never be an error.

## 5.3 Route 2 — "Start from someone else's map" — **GATED, do not build blind**

Approved by Thomas at wireframe review. Behaviour:

- The picker lists **only `is_public` maps**, reusing `/api/gallery` and the §7 card
  design, with the button reading *Start from this map* instead of *Open*.
- Choosing one copies that map's markdown into the new user's own row.
- **The copy records where it came from, until the person has edited it** — so the
  gallery does not silently fill with duplicates of one map under many names.

**How provenance is stored is a data-model call.** `decisions.md` is explicit: a
phase session decides uncovered judgment calls and documents them loudly, *except
anything touching the data model or a file format, which stops and waits.* The
wireframe amendment names this one specifically: *"Whether that provenance is a
column or a line in the markdown is a data-model call — phase 3's session raises it
and waits rather than deciding."*

Both available shapes are in the forbidden category, so **the build session must not
pick one.** They are set out here so Thomas can answer in one line. This is **Q1**.

**Option A — two columns on `users`.**

```sql
alter table public.users add column copied_from uuid references public.users(id) on delete set null;
alter table public.users add column copied_at   timestamptz;
```

Provenance clears when the person edits: `api/map.py`'s save sets both to `NULL`
whenever the incoming markdown differs from what was copied.

- *For:* invisible to the parser and the renderer; `theology-map.md`'s format is
  untouched, so `engine/render.py`, `editor-core.js` and the lockstep rule are all
  unaffected. The gallery can filter or badge unedited copies with one query. An
  exported HTML file carries no trace, which is right — an export is the person's
  own artefact.
- *Against:* a migration while Thomas is away, and `on delete set null` means
  deleting the source account quietly erases the attribution.

**Option B — a line in the markdown.**

A first-line marker such as `<!-- copied-from: <name> -->`, stripped on first edit.

- *For:* no migration; travels with an export.
- *Against:* this is a **file-format change**. `render.py`'s `parse()` and
  `editor-core.js`'s `parse()` would both need to learn to ignore it, in lockstep,
  by hand — precisely the pairing `CLAUDE.md` warns is maintained manually. It also
  makes `theology-map.md` carry a hosted-only concept, and the marker would surface
  as stray text in any tool that reads the file naively.

**Planner's recommendation, non-binding: Option A.** It keeps the file format clean,
and the file format is the asset with the most downstream dependents (`render.py`,
`editor-core.js`, `fetch_verses.py`, the `.mm` export, phase 5's corpus, phase 6's
tradition maps). But it is Thomas's call and the build session must wait.

**What the build session does in the meantime:** Task 8 of the plan is written and
ready but **is not started**. Cards 1 and 3 ship; card 2 renders in a "not yet"
state (visible, explaining that it is coming, not clickable) so the approved
three-card layout is what Thomas reviews on the canvas. Everything else in phase 3
merges without it. When Thomas answers, one short session runs Task 8 alone.

## 5.4 What first-run deliberately is not

- **Not a modal.** A modal is something to dismiss, and the dismissed state is an
  empty screen — the exact problem being solved.
- **Not a product tour.** Coach marks are clicked past and then not available when
  the question actually arises. The inline glosses of §2.1 put the explanation
  *where the decision is made*, which is what `decisions.md` asked for.
- **Not a template.** `decisions.md`: a *tradition* never pre-fills a map, and
  `theology-map.md` is not a template. Copying is **user-to-user only**.
- **Not skippable into nothing.** "Or just look around the gallery first" goes to
  `/gallery`; first-run is still there when they come back, because the map is still
  empty. There is no dismiss state to persist, and therefore no dismiss bug.

---

# 6. Screen: the node editor

## 6.1 Promoted versus optional

Locked by `decisions.md`: the node editor promotes **only `hold` + tier +
confidence**; `why` / `vs` / `todo` / `refs` / `link` are collapsed under "optional"
and **must look optional**.

**Promoted, in this order:**

1. **Title**
2. **What I hold** (`hold`) — a textarea, serif, capped at 58ch, ~3 rows,
   placeholder *"The position I hold, in a sentence or two."*
3. **Tier** — labelled select, glosses per §2.1
4. **Confidence** — labelled select, glosses per §2.1
5. **`#study`** — checkbox, labelled per §2.1

Order argument: a person knows *what they think* before they know how much it
weighs or how sure they are. Putting tier first (as today's two-column row does)
asks the hardest question first and is where a stranger stalls. This is the same
logic `decisions.md` applies to the wizard's tier ordering, applied one level down.

**Optional, collapsed:**

```html
<details class="optional">
  <summary>Optional — why, what I'd reject, texts, related</summary>
  ...
</details>
```

Containing, in order: **Why**, **What I'd reject** (`vs`), **Still working out**
(`todo`), **Texts** (`refs`), **Related** (`link`).

**"Must look optional" is a visual requirement, not just a structural one.** The
`<summary>` renders in `--muted` sans at 12px with a disclosure triangle — the same
weight as the tree's domain summaries, which the product already treats as
secondary. It is not a button, it does not use `--ink`, and it never carries the
primary fill.

**Auto-open rule:** if a node already has any of the five optional fields populated,
the `<details>` renders with `open` set. Existing content is never hidden behind a
disclosure a person has to discover. Empty ones stay shut. This matters immediately:
Thomas's own 99 nodes are heavily populated, so for him almost every node opens
expanded and the editor behaves as it does today; for a stranger's new node it opens
collapsed. One rule, two correct behaviours.

## 6.2 Applying this in both tabs, and the parser-lockstep rule

The split is applied in **two** places, because the editor has two editing surfaces:

- **List tab** — `editor.html`'s `renderForm()`, around lines 497–560.
- **Map tab** — `map-view.js`'s editable leaf rendering.

**The lockstep rule, stated precisely so the build session can check it
mechanically.** `CLAUDE.md` requires `map-view.js` to stay in sync with the Map view
JS embedded in `render.py`. But `render.py`'s Map view is **read-only** — it has no
editable leaf at all. So the lockstep surface is exactly these three functions:

| `map-view.js` function | Lockstep with `render.py`? | Phase 3 may change it? |
|---|---|---|
| `_leafHeaderReadonly` (line ~144) | **yes** | **no** |
| `_leafMetaReadonly` (line ~156) | **yes** | **no** |
| `_mboxHTML`, `redraw`, `assignX/assignY`, `edges`, `_bindPanZoom` | **yes** | **no** |
| `_leafHeaderEditable` (line ~179) | no counterpart | yes |
| `_leafMetaEditable` (line ~195) | no counterpart | yes |
| `_leafDetail` (line ~241) | no counterpart | yes |

**Phase 3 touches only the bottom three rows.** That makes lockstep verifiable by
reading a diff rather than by trusting a claim: if `git diff engine/map-view.js`
shows a hunk inside any function in the top three rows, the change is out of scope
and must be reverted. Stated again as a gate in the plan.

`editor-core.js` is **not modified at all** by this phase — no field is added,
removed or renamed in the model. Its lockstep with `render.py`'s `parse()` is
therefore preserved by construction, and the round-trip check still runs as proof.

## 6.3 The layout-measurement trap

`map-view.js` measures each tile with `offsetWidth` / `offsetHeight` after mounting,
then runs a layout pass. A `<details>` element **changes its own height when
toggled**, after measurement. If nothing re-runs the layout, opening the optional
section makes a tile overlap its neighbour.

Fix: the `<details>`'s `toggle` event calls the map view's existing `redraw()`. This
is one listener and it is the single most likely bug in the phase — it is called out
again as a step and a verification line in the plan.

---

# 7. Screen: the gallery

Locked by the wireframe amendment: **cards, no denomination label.** A person's
tradition is a wizard lens, not a badge. Cards carry the map's own shape: node
count, tier spread, open questions, last updated.

## 7.1 The card

```
┌─────────────────────────────────────────┐
│ Sarah                                   │  serif, 17px
│                                         │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░         │  tier-spread bar
│ 4 T1 · 9 T2 · 2 T3                      │  sans, --muted, 11px
│                                         │
│ 31 beliefs · 7 open questions           │  sans, --muted, 12px
│ Updated 3 days ago                      │  sans, --muted, 11.5px
└─────────────────────────────────────────┘
```

- **No denomination, no tradition, no avatar, nothing about the person.** The card
  is about the *map*.
- The tier-spread bar is segments in the tier ramp, widths proportional to node
  count. **The text line beneath repeats the same counts**, because §3.2 Failure B
  established that tier colour alone fails non-text contrast in dark mode. The bar
  is `aria-hidden="true"`; the text line is the accessible content.
- **"Open questions" is defined as: nodes flagged `#study`, plus nodes with
  `confidence: open`, deduplicated.** That definition is written down here because
  phase 6's compare screen will want the same number and the two must agree.
- Untiered nodes get a `--line` segment and a trailing `· 3 untiered` in the text.
- Empty map: the row still appears if `is_public`, reading *"No beliefs yet"*, with
  no bar. Do not silently hide people.

## 7.2 Where the numbers come from

`/api/gallery` currently returns `id, name, updated_at`. It gains four derived
fields: `node_count`, `open_count`, `tier_counts` (an object keyed `T1`…`T4` plus
`untiered`), and `updated_at`.

**This is not a schema change.** The numbers are computed on read, server-side, by
calling `render.parse_text()` — the pure function phase 1a already extracted from
`engine/render.py` — over each row's markdown.

**The one hard rule:** `api/gallery.py` must now `select` the `markdown` column in
order to count, but **the markdown must never appear in the response body.** Phase
1's design was explicit that the gallery returns nothing but `id`, `name`,
`updated_at`; the derived counts are additive, the body is not. A test asserts the
response contains no `markdown` key.

Cost: parsing every public map on every gallery request. For a church-sized gallery
(tens of maps, ~27 KB each) this is a few milliseconds and it runs inside a function
that already pays a cold start. **Ceiling:** if the gallery ever exceeds 200 rows,
this needs a cached or denormalised count — which *would* be a schema change and a
separate decision. Written into the outcome file as a known limit, not solved now.

## 7.3 Signed-out

The gallery works signed out (phase 1). Cards are identical; the trailing card is a
`--ink` "Make your own map" card linking to `/app`. On `/view?id=`, the same call to
action sits under the map — per §4.1 this is the real front door for a stranger, so
it gets the primary fill, not a text link.

---

# 8. The wizard slot — exactly where phase 4 goes

Phase 4 is being planned in parallel and will read this section for the agreed shape.

**Route:** `/wizard` → `web/wizard.html`, rewritten in `vercel.json`. The file does
not exist after phase 3. Nothing else is reserved.

**Entry points, both created by phase 3:**

1. **First-run card 1**, `#startWizard` — the primary card, §5.1. Phase 3 ships its
   markup complete and its href pointing at `/wizard`.
2. **`/app` signed-in, non-empty map** — a quiet `--muted` text link, *"Answer the
   questions to fill gaps"*. Also gated.

**The gate is one constant**, at the top of `web/first-run.js`:

```js
// Phase 4 flips this to true when /wizard exists. Nothing else changes.
const WIZARD_ENABLED = false;
```

When `false`: card 1 is **not rendered**, and cards 2 and 3 lay out as a two-up grid
(one-up below 640px). When `true`: three cards, card 1 spanning full width above the
other two, as wireframed. Phase 3 must not ship a dead primary call to action, and
phase 4 must not have to redesign the screen to enable itself.

**The contract phase 4 must satisfy — no new API surface:**

- The wizard is a client-side, data-driven form. `decisions.md`: **no LLM call at
  wizard runtime.**
- It builds `theology-map.md`-format markdown in the browser using
  `engine/editor-core.js`'s `serialize()`. It does **not** get its own writer.
- It saves through the **existing** `POST /api/map` with the phase-1c optimistic
  concurrency token. No new route, no new column.
- On finish it redirects to `/edit`, because the map the wizard produces is a draft
  to edit, not a finished artefact.
- It uses §2.2's labels **verbatim**. `decisions.md` requires tier order **T1
  first**, tradition selection that **orders and annotates but never pre-fills**,
  and **"I don't know" as a first-class answer mapping to `confidence: open` +
  `#study`** — all three are consistent with the vocabulary above and need no change
  to it.

**Layout budget:** phase 4 owns the whole `/wizard` viewport below the shared
chrome. It inherits `engine/theme.css` and must not add colour tokens.

---

# 9. Responsive behaviour — 360px, 768px, 1400px

The editor has **no width media query today** (§1, finding 1). This section is
therefore mostly new work, and it is the part of the phase Thomas is most likely to
be looking at, since he will review on a phone.

## 9.1 Kill the magic numbers first

Before any breakpoint, replace the two hard-coded viewport calculations:

- `.layout { min-height: calc(100vh - 128px) }`
- `.mapwrap { height: calc(100vh - 170px) }`
- `nav.tree { max-height: calc(100vh - 128px) }`

Both constants assume the header + filebar occupy a fixed height, which is false as
soon as the filebar wraps — and on a 360px phone it wraps to three rows. Replace
with a flex column:

```css
body { display: flex; flex-direction: column; min-height: 100dvh; }
.layout { flex: 1 1 auto; min-height: 0; }
.mapwrap { flex: 1 1 auto; min-height: 0; height: auto; }
nav.tree { overflow-y: auto; min-height: 0; }
```

`100dvh` rather than `100vh` because mobile Safari's collapsing address bar makes
`100vh` overflow. This deletes three magic numbers and fixes the phone map height as
a side effect.

## 9.2 360px — one column, tree as a drawer

- `.layout` becomes `flex-direction: column`.
- `nav.tree` loses its `width:290px` and becomes a `<details>` drawer above the form,
  summary reading *"All beliefs (99)"*, **closed by default**. Selecting a node
  closes it. This is the same disclosure pattern the public map already uses for its
  "Filters" block below 640px, so it is consistent rather than novel.
- `.filebar` wraps; the autosave indicator (§10) is `order:-1` so it is the first
  thing on the row rather than pushed to a second line.
- `header`'s kicker and `.sub` hide, matching the public map's phone rule.
- Tabs go full-width, two equal halves.
- The Map tab already falls back to the single-sided left-to-right layout below
  `MAP_TWO_SIDE_BREAK = 860` — that constant is in **both** `map-view.js:24` and
  `render.py:795` and **must not be changed**; it is lockstep-bearing.
- Open leaf tiles: `max-width: min(560px, 92vw)` already handles 360px, giving 331px.
- **Touch targets.** Today's buttons are `padding:7px 12px` at `font-size:12px` —
  about 26px tall, well under the 44px guidance, and a real problem on the filebar
  where Save sits next to Render. Add, matching `render.py`'s existing house style:

  ```css
  @media (pointer: coarse) {
    button, .tabbtn, select, .nodebtn { min-height: 44px; }
    .mdomain-edit, .tagchip button { min-width: 44px; min-height: 44px; }
  }
  ```

  Keyed on `pointer:coarse`, not on width, so a 1400px touchscreen also gets it and
  a 360px desktop window does not get bloated chrome.
- Gallery cards: one column, full width.
- First-run cards: one column, stacked, card 1 first.

## 9.3 768px — two columns, narrower tree

- Tree returns as a sidebar but at **240px**, not 290px. At 768px a 290px tree
  leaves 478px for the form; 240px leaves 528px, which holds a 58ch serif measure
  at 14px without the fields feeling pinched.
- Gallery: two columns (`repeat(auto-fill, minmax(300px, 1fr))` handles this without
  a breakpoint).
- First-run: cards 2 and 3 side by side, card 1 full width above.
- The map is still single-sided (768 < 860). Correct and unchanged.

## 9.4 1400px — stop the form hugging the tree

- Tree back to 290px.
- `main.form` keeps `max-width:720px` but gains `margin-inline: auto` so it centres
  in the remaining ~1100px instead of hugging the sidebar. Prose fields stay capped
  at 58ch inside it.
- Gallery: three to four columns via the same `auto-fill` grid, with the grid itself
  capped at `max-width: 1200px; margin-inline: auto` so cards do not stretch to
  absurd widths on a wide monitor.
- The map is two-sided (1400 ≥ 860), as today.

## 9.5 Breakpoints used

`640px` and `900px` for the editor layout; `860px` inside the map view (existing,
untouched). 640px matches the public map's existing phone breakpoint, so the two
halves of the product change shape at the same width. **No new breakpoint values are
invented.**

---

# 10. The save model

**Nothing about autosave is decided in this phase.** `decisions.md` is explicit:
autosave with debounce is the hosted save model, phase 1c implements it, and its
concurrent-tab / empty-save / orphaned-id guards are phase 1's and phase 2's
concern. Phase 3 **inherits** it.

Phase 3's only responsibility is that the indicator is legible and correctly placed:

| State | Text | Colour | Contrast |
|---|---|---|---|
| idle, clean | `Saved 10:42` | `--muted` | 5.90 / 6.21 |
| saving | `Saving…` | `--muted` | 5.90 / 6.21 |
| saved just now | `Saved` | `--good` | 6.13 / 7.87 |
| failed | `Not saved — <reason>` | `--bad` | 9.00 / 6.55 |

Rules: it is never silent; a failure never looks like a success; and on a phone it
is `order:-1` in the wrapped filebar so it is visible without scrolling. The
existing `.status.ok` / `.status.err` classes already carry these colours — this is
a placement and wording change, not a new mechanism.

The **local** editor keeps its explicit **Save to file** / **Save & render**
buttons, unchanged. `storage-local.supportsAutosave === false` already drives this;
phase 3 must not make the indicator appear in local mode.

---

# 11. Alternatives considered and rejected

| Rejected | Why |
|---|---|
| Rename tier → "how much it matters", confidence → "how sure I am" | Directly violates a locked decision. `decisions.md`: the words are "doing real teaching work; phase 3 explains them in place rather than renaming them." |
| A `/glossary` page linked from the editor | Explicitly ruled out. A glossary is read once, or more often never; the gloss belongs at the control. |
| A dismissible product tour / coach marks over the editor | Clicked past, then unavailable when the question arises. Also needs a persisted dismiss state, which is a new failure mode for no benefit. |
| Traffic-light tier colours (green/amber/red) | The earlier amber values **failed contrast**. `CLAUDE.md` forbids reintroducing them, and §3.2's numbers show the current ramp is doing real work. |
| Lightening the tier ramp so swatches pass 3:1 in dark mode | Would break white chip text at AA — the exact failure the ramp was chosen to avoid. Solved instead by never letting tier colour be the sole channel (§3.2). |
| Extracting `editor.html`'s ~470-line inline controller into `engine/editor-app.js` | `phase-1-design.md` §7 anticipated phase 3 might want this. Rejected **for this phase**: it produces a diff where every line moved, which cannot be checked by reading — and reading is the only verification available. Phase 3's editor changes are localised to three `map-view.js` functions and one `renderForm()`. Propose as its own phase if a second hosted entry point is ever needed. |
| Redesigning `engine/render.py`'s four generated views | Out of scope by the brief. If the review says they need one, it is **its own phase** — call it phase 3.5. The gallery card and the shared chrome are deliberately built so that they do not depend on it. |
| Denomination badge on gallery cards | Overridden by the 2026-08-18 wireframe amendment. Tradition is a wizard lens, not a badge. |
| Storing gallery counts as denormalised columns | A schema change, therefore stops and waits. Computing on read costs milliseconds at this scale (§7.2). |
| A CSS framework, an icon font, or web fonts for the new screens | `start_editor.bat` has no network. Everything must be bundled; system font stacks and inline SVG only. |
| Deciding the provenance representation myself | Forbidden category — data model / file format. Raised as **Q1**. |
| Making `/` the app front door in this phase | Breaks links Thomas has already sent, and requires editing the 1300-line generator. One line of `vercel.json` whenever he wants it. Raised as **Q4**. |

---

# 12. Where the source brief is now out of date

`Project 13/phase-3-ui-revamp.md` predates `decisions.md` and its amendments. Three
of its instructions must **not** be followed:

| The brief says | Actually |
|---|---|
| *"'Tier', 'confidence', '#study' and '#thread' … need plain-language labels"* | `#thread` **does not exist** — removed in phase 0.5. There are four views, not five. The other three keep their names by locked decision. |
| *"The save model. Decide whether [explicit save] survives contact with strangers"* | Already decided. Autosave with debounce, implemented in **phase 1c**. Phase 3 inherits it (§10) and does not choose. |
| *"Read `docs/hosting/phase-2-review.md` first — its red-hat findings are this phase's backlog"* | That file may not exist when this phase runs. If it does, read it and fold its deferred-cosmetic list into Task 9. If it does not, **proceed anyway** — `decisions.md`: merging beats waiting. |

The brief's precondition "phase 2 merged" stands as a preference, not a blocker, for
the same reason.

---

# 13. Decisions I made for you

Every one is reversible and none touches the data model or a file format.

1. **`/` is left serving `theology-map.html`** (§4.1). One line of `vercel.json` to
   change. Raised as Q4.
2. **`engine/theme.css` as a relatively-linked shared stylesheet**, with
   `editor.html`'s inline `:root` kept as an offline fallback (§4.2).
3. **Two new tokens only** — `--field-line`, `--note` (§3.3, §3.4).
4. **`todo` is labelled "Still working out" in both tabs**, resolving the existing
   Study/Todo contradiction (§2.1). Presentation only; the field key is unchanged.
5. **The optional `<details>` auto-opens when any optional field has content**
   (§6.1), so Thomas's 99 populated nodes behave as they do today.
6. **`WIZARD_ENABLED = false` gates first-run card 1** (§8) rather than shipping a
   dead primary call to action.
7. **"Open questions" = `#study` ∪ `confidence: open`, deduplicated** (§7.1).
   Written down because phase 6 must use the same definition.
8. **Gallery counts computed on read via `render.parse_text`**, not stored (§7.2),
   with a documented 200-row ceiling.
9. **Deep-link contract `/edit?open=<slug>`**, silently ignored if unresolvable
   (§5.2).
10. **Breakpoints reuse 640px and 900px**; the map's 860px constant is untouched
    because it is lockstep-bearing (§9.5).
11. **The editor's inline controller is not extracted** in this phase (§11).

---

# 14. Questions for Thomas

Numbered so a one-line reply can answer them. Only **Q1 blocks** anything.

**Q1 — BLOCKING one task. Provenance for "start from someone else's map": column or
markdown line?** Both options are set out in §5.3 with their trade-offs. This is the
data-model call the wireframe amendment said phase 3 must raise rather than decide.
The planner's non-binding recommendation is **Option A, two columns
(`copied_from uuid`, `copied_at timestamptz`)**, because it keeps the file format —
the asset with the most downstream dependents — untouched. Everything else in phase
3 merges without an answer; Task 8 is written and waiting.

**Q2 — Should provenance be shown to *other* people, or only to the copier?** The
amendment's stated purpose is "so the gallery does not silently fill with duplicates
of one map under many names", which implies it is visible on the gallery card. But
a card reading *"copied from Sarah, not yet edited"* is a slightly exposing thing to
show a church member who is mid-draft. Default taken if unanswered: **visible on the
gallery card, worded neutrally** — *"Started from Sarah's map"*. Part of Task 8, so
it waits with Q1.

**Q3 — What should the "Add a belief by hand" starter node be called?** Currently
`My first belief` in a domain called `Beliefs`. Both are placeholder wording a
person immediately overwrites, but `Beliefs` becomes a real domain heading in their
`theology-map.md` if they never rename it. An alternative is to use the first domain
name from Thomas's own map's vocabulary, e.g. `Scripture`. Default taken:
`Beliefs`. Trivially changeable.

**Q4 — What should `/` be, long term?** Phase 3 leaves it as Thomas's own map, on
the reasoning in §4.1. The alternative is `/` → the product front door with Thomas's
map at `/thomas`. This becomes more attractive once the gallery has several real
maps in it. One line of `vercel.json`, reversible at any time.

**Q5 — Is the 200-row gallery ceiling acceptable?** §7.2 parses every public map on
every gallery request. Fine for one church. If Thomas expects the gallery to grow
past a couple of hundred maps, the counts need caching or denormalising, which is a
schema change and therefore a separate decision.

**Q6 — Does `engine/render.py`'s generated map need its own design phase?** Phase 3
deliberately does not touch it, and after this phase the editor and the product
pages will be visibly more considered than the rendered map they surround. If that
gap bothers him when he sees it, it wants a phase 3.5 rather than being absorbed
here.
