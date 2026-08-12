# Theology Map

A personal mind map of theological positions, organised by tier of importance.

## The two files you'll ever need to click

They live in the project's root folder, one level up from this file.

| File | What it does |
|---|---|
| **`theology-map.html`** | The map itself. Double-click to view it in your browser. |
| **`start_editor.bat`** | Double-click to edit. Starts a small local server and opens the editor in your browser. Close the black window when you're done to stop it. |

`theology-map.md`, also at the root, is the one file you hand-edit directly
if you'd rather skip the editor. Everything in this `documentation/` folder
(`verses.md`, `theology-map.mm`, `study-list.md`, this README) is either
machine-managed or reference material. `engine/` holds the scripts and isn't
meant to be opened directly.

## Editing

1. Double-click `start_editor.bat`.
2. In the browser tab that opens, click **Connect theology-map.md** (Chrome
   or Edge) and pick the file — this lets the editor save your changes
   straight to disk.
3. Pick a node on the left, edit its fields, click **Save & render**. That
   writes the file, rebuilds `theology-map.html`, and fetches any new
   scripture text automatically.
4. Reopen `theology-map.html` to see the update.

If you're not on Chrome/Edge, use **Upload a copy instead** to load the file
read-only, then **Preview & copy full text** to copy your edits and paste
them into `theology-map.md` by hand.

## Everything else (`engine/`)

`engine/render.py`, `engine/fetch_verses.py` and `engine/render_server.py`
are the scripts behind the map and the editor — see `CLAUDE.md` for how they
fit together if you're changing them.
