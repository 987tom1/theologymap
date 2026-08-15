# Map Tile Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Map" tab to `engine/editor.html` that shows the same pan/zoom node-link layout as the public `theology-map.html` Map view, but with expanded leaf tiles directly editable (title, tier, confidence, flags, hold/why/vs/todo, refs, links), plus add-node/add-domain/delete affordances — making it a second, visually-oriented way to edit the same live data the existing "List" tab edits, and the default view shown after a file loads.

**Architecture:** A new hand-ported file, `engine/map-view.js`, carries the layout/pan/zoom engine (copied from `render.py`'s embedded Map-view JS, the same "verified-in-sync duplicate" convention already used for `editor-core.js`), exposed as a `MapView` constructor that mounts into a container div and reads/writes the same live `domains` array `editor.html` already holds — no second data model. A second new file, `engine/shared-fields.js`, extracts the tag-chip link-editor widget (currently inline in `editor.html`) so both the List form and Map tiles call one implementation. `editor.html` gains a tab switcher (Map default, List available), a shared toolbar dirty-counter, and wiring for both files.

**Tech Stack:** Vanilla JS (no build step, no framework, no dependencies — matches every other file in `engine/`), served as plain `<script src>` includes from `editor.html`.

## Global Constraints

- No hand-editing of `theology-map.html`, `documentation/theology-map.mm`, or `documentation/study-list.md` — all three stay `render.py`-generated only.
- `editor-core.js` stays pure functions, no DOM (per its own file header) — DOM-touching shared widgets go in the new `engine/shared-fields.js`, not into `editor-core.js`.
- `map-view.js` is a hand-ported *duplicate* of the Map-view JS embedded in `render.py`'s generated-HTML template, not a shared/extracted single source — this is the established convention for `editor-core.js` vs. `render.py`'s `parse()`, and it applies here identically. Any future change to either copy must be checked against the other by hand.
- Visual design reuses the warm paper-and-ink tokens already defined in `editor.html`'s `<style>` (`--bg`, `--panel`, `--ink`, `--muted`, `--line`, `--chip`, `--good`, `--bad`, `--serif`, `--sans`) and the tier/confidence chip styling already defined in `theology-map.html` (`.chip`, `.chip.tier`) — no new palette, no new type choices.
- Field order everywhere is Title → Tier/Confidence → Flags → Hold → Why → Vs → Todo(labelled "Study" in the UI) → Refs(labelled "Texts") → Link — matches the List form and the file's own field convention.
- `touch()` in `editor.html` changes signature from `touch()` to `touch(node)` — every existing call site must be updated in the same commit that changes the signature, or edits silently stop being tracked.
- No automated test framework exists in this project (confirmed: no `package.json`, no test runner anywhere in `engine/`). Verification is manual, in a browser, following the same convention already used to verify `editor-core.js` against `render.py`'s parser (round-trip check, done by hand/via a throwaway Node script, not a permanent suite). Each task below ends with an explicit manual verification procedure instead of an automated test — do not invent a test framework as part of this work.
- Scope decision (not covered by the spec, resolved here): the read-only Map view in `theology-map.html` pulls `#thread`-flagged nodes out of their real domain into a synthetic "Cross-cutting threads" pseudo-domain for display. The editable Map tab does **not** do this — thread-flagged nodes stay inside their real domain box, same as the List tab's tree already shows them. Synthesizing a pseudo-domain would require reverse-mapping edits back to the node's real domain for no benefit, since the editor's `domains` array (unlike `render.py`'s flat `doctrine`/`threads` split) is already grouped by real domain. This keeps one code path instead of two and matches "the Map tab is functionally identical to the List tab, just presented differently."
- Scope decision: the Map tab does not get its own search/filter controls. `theology-map.html`'s Map view has a text filter and study/hide-assumed toggles; the editor's List tab already has its own search box. Duplicating filtering into the Map tab isn't requested by the spec and isn't needed for editing — YAGNI.

---

### Task 1: Extract the shared link-field widget

**Files:**
- Create: `engine/shared-fields.js`
- Modify: `engine/editor.html:406-461` (the existing inline `linkField` function), `engine/editor.html:158` (script includes), `engine/editor.html:348` (call site)

**Interfaces:**
- Produces: `SharedFields.renderLinkField(node, allSlugs, onChange)` → returns a DOM element (a `<div class="row">` containing the label, tag chips, add-input, hint, and a shared `<datalist id="slugList">`). `onChange` is called with no arguments after any add/remove, same as the List form's existing `touch()` call today (Task 6 will change what `onChange` does, not this task).

- [ ] **Step 1: Create `engine/shared-fields.js` with the extracted widget**

```javascript
/* shared-fields.js — DOM widgets shared between the List form and the Map
 * tab's editable tiles. Unlike editor-core.js this file DOES touch the DOM
 * on purpose; editor-core.js stays pure so it can run under Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SharedFields = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  /* node: the live node object (mutated in place — node.link is spliced/pushed).
   * allSlugs: array of every node slug in the file, for the <datalist>.
   * onChange: called after any add/remove so the caller can mark dirty + redraw. */
  function renderLinkField(node, allSlugs, onChange) {
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('label');
    label.textContent = 'Link — related node(s)';
    row.appendChild(label);

    const tags = document.createElement('div');
    tags.className = 'tags';
    function redraw() {
      tags.innerHTML = '';
      node.link.forEach((slug, i) => {
        const chip = document.createElement('span');
        chip.className = 'tagchip';
        chip.appendChild(document.createTextNode(slug));
        const rm = document.createElement('button');
        rm.textContent = '✕';
        rm.title = 'Remove link';
        rm.addEventListener('click', () => { node.link.splice(i, 1); onChange(); redraw(); });
        chip.appendChild(rm);
        tags.appendChild(chip);
      });
    }
    redraw();
    row.appendChild(tags);

    const addRow = document.createElement('div');
    addRow.className = 'addtag';
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('list', 'slugList');
    input.placeholder = 'slug-of-a-related-node';
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add link';
    addBtn.addEventListener('click', () => {
      const v = (window.EditorCore || {}).slugify ? window.EditorCore.slugify(input.value) : input.value.trim();
      if (!v) return;
      if (!node.link.includes(v)) { node.link.push(v); onChange(); redraw(); }
      input.value = '';
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
    addRow.appendChild(input);
    addRow.appendChild(addBtn);
    row.appendChild(addRow);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Must match another node\'s slug exactly, or render.py will warn about a broken link.';
    row.appendChild(hint);

    let list = document.getElementById('slugList');
    if (!list) { list = document.createElement('datalist'); list.id = 'slugList'; document.body.appendChild(list); }
    list.innerHTML = allSlugs.map(s => '<option value="' + escapeHtml(s) + '">').join('');

    return row;
  }

  return { renderLinkField };
});
```

- [ ] **Step 2: Add the script include in `editor.html`**

In `engine/editor.html`, change line 158 from:
```html
<script src="editor-core.js"></script>
```
to:
```html
<script src="editor-core.js"></script>
<script src="shared-fields.js"></script>
```

- [ ] **Step 3: Replace the List form's inline `linkField` with the shared one**

In `engine/editor.html`, delete the entire inline `function linkField(node) { ... }` block (lines 406-461) and replace the call site at line 348:
```javascript
formEl.appendChild(linkField(node));
```
with:
```javascript
formEl.appendChild(SharedFields.renderLinkField(node, core.allSlugs(domains), () => touch()));
```

- [ ] **Step 4: Manual verification**

Open `start_editor.bat`, connect `theology-map.md`, pick any node in the List tab, add a link via the datalist-backed input, remove it via the ✕ button, confirm the dirty status footer still reads "Unsaved changes" as before and Save still writes correctly. This confirms the extraction didn't change List-tab behavior — a prerequisite for Task 4 reusing the same widget on tiles.

- [ ] **Step 5: Commit**

```bash
git add engine/shared-fields.js engine/editor.html
git commit -m "Extract link-field widget into shared-fields.js"
```

---

### Task 2: Hand-port the map layout/pan/zoom engine (read-only)

**Files:**
- Create: `engine/map-view.js`

**Interfaces:**
- Produces: `MapView` constructor — `new MapView(container, { getDomains, tierMeta, confMeta, onLeafToggle })`. Public methods: `.redraw()` (rebuilds and repositions all boxes from the current `getDomains()` result), `.resetView()` (recenters pan/zoom on the root). This task builds the constructor with **read-only** leaf rendering (matching `theology-map.html`'s current `mboxHTML` output verbatim); Task 4 swaps the leaf renderer for the editable one without touching layout/pan/zoom code.
- Consumes: nothing from other new files yet (no dependency on `editor-core.js` or `shared-fields.js` in this task).

- [ ] **Step 1: Create `engine/map-view.js` with the ported layout engine**

```javascript
/* map-view.js — hand-ported copy of the Map-view layout/pan/zoom engine
 * embedded in render.py's generated theology-map.html (buildMapTree,
 * mboxHTML, redrawMap, and the pan/zoom pointer-event handlers). Kept in
 * lockstep with render.py by hand, same convention as editor-core.js
 * mirrors render.py's parse() — if you touch the Map view in render.py,
 * re-verify this file matches.
 *
 * Unlike render.py's version (which reads a flat `doctrine` array grouped
 * by a `.domain` string, plus a separate `threads` array), this version
 * reads the editor's `domains` array directly — already grouped by real
 * domain — and does NOT pull #thread-flagged nodes into a synthetic
 * "Cross-cutting threads" box. See the implementation plan's Global
 * Constraints for why.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MapView = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GAP_Y = 14;
  const DOMAIN_GAP = 60, LEAF_GAP = 70;
  const STAGGER_X = 110;
  const MAP_TWO_SIDE_BREAK = 860;
  const TIER_ORDER = ['T1', 'T1.5', 'T2', 'T2.5', 'T3', 'T4'];

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function refChips(s) {
    return (s || '').split(';').map(r => r.trim()).filter(Boolean)
      .map(r => `<button type="button" class="refchip" data-ref="${escapeHtml(r)}" aria-expanded="false">${escapeHtml(r)}</button>`)
      .join('');
  }

  function tierRank(n) {
    const i = TIER_ORDER.indexOf(n.tier);
    return i === -1 ? TIER_ORDER.length : i;
  }

  function sortByTier(list) {
    return list.slice().sort((a, b) => tierRank(a) - tierRank(b));
  }

  function MapView(container, opts) {
    this.container = container;
    this.getDomains = opts.getDomains;
    this.tierMeta = opts.tierMeta;
    this.confMeta = opts.confMeta;
    this.onLeafToggle = opts.onLeafToggle || function () {};

    this.mapDetailOpen = new Set();
    this.mapManualCollapsed = null; // Set, initialised lazily once domain names are known
    this.mapEls = new Map();
    this.panX = 0; this.panY = 0; this.zoom = 1;
    this.needsCenter = true;

    container.innerHTML =
      '<div class="mapcontrols"><button type="button" class="map-reset">Reset view</button></div>' +
      '<div class="maphint">Drag/swipe to pan &middot; scroll or pinch to zoom &middot; tap a leaf to expand</div>' +
      '<div class="map-panzoom"><svg class="map-svg"></svg><div class="map-boxes"></div></div>';
    this.wrap = container;
    this.panzoomEl = container.querySelector('.map-panzoom');
    this.svgEl = container.querySelector('.map-svg');
    this.boxesEl = container.querySelector('.map-boxes');
    container.querySelector('.map-reset').addEventListener('click', () => { this.needsCenter = true; this.redraw(); });

    this._bindClicks();
    this._bindPanZoom();
    window.addEventListener('resize', () => this.redraw());
  }

  MapView.prototype._domainIds = function () {
    return this.getDomains().map(d => 'domain:' + d.name);
  };

  MapView.prototype._buildTree = function () {
    if (!this.mapManualCollapsed) this.mapManualCollapsed = new Set(this._domainIds());
    const domains = this.getDomains();
    const twoSided = window.innerWidth >= MAP_TWO_SIDE_BREAK;
    const root = { id: 'root', type: 'root', title: 'My Theology', depth: 0, side: 0, twoSided, children: [] };
    let idx = 0;
    const nextSide = () => { const s = (twoSided && idx % 2 === 1) ? -1 : 1; idx++; return s; };
    domains.forEach(domain => {
      const members = sortByTier(domain.nodes);
      const id = 'domain:' + domain.name;
      const isOpen = !this.mapManualCollapsed.has(id);
      const side = nextSide();
      const dom = { id, type: 'domain', title: domain.name, depth: 1, side, total: members.length, children: [] };
      if (isOpen) dom.children = members.map(n => this._leafBox(n, 2, side));
      root.children.push(dom);
    });
    return root;
  };

  MapView.prototype._leafBox = function (n, depth, side) {
    return { id: n.slug, type: 'leaf', title: n.title, depth, side, node: n, children: [] };
  };

  function flatten(tree, acc) {
    acc.push(tree);
    tree.children.forEach(c => flatten(c, acc));
    return acc;
  }

  MapView.prototype._mboxHTML = function (box) {
    if (box.type === 'root') {
      return `<div class="mbox mbox-root" data-id="${escapeHtml(box.id)}">${escapeHtml(box.title)}</div>`;
    }
    if (box.type === 'domain') {
      const openState = box.children.length > 0;
      return `<div class="mbox mbox-domain${openState ? ' mopen' : ''}" data-id="${escapeHtml(box.id)}">
        <div class="mtitle"><b>${escapeHtml(box.title)}</b>${box.total ? '<span class="mchev">&#9656;</span>' : ''}</div>
        <div class="mmeta"><span class="mcount">${box.total} node${box.total === 1 ? '' : 's'}</span></div>
      </div>`;
    }
    // leaf — read-only rendering, same markup as theology-map.html's mboxHTML.
    // Task 4 replaces this branch with an editable version; layout code above
    // and pan/zoom code below never need to change for that.
    const n = box.node;
    const open = this.mapDetailOpen.has(n.slug);
    const tier = n.tier ? this.tierMeta[n.tier] : null;
    const conf = n.confidence ? this.confMeta[n.confidence] : null;
    const rows = [];
    if (n.hold) rows.push(`<dt>Hold</dt><dd>${escapeHtml(n.hold)}</dd>`);
    if (n.why) rows.push(`<dt>Why</dt><dd>${escapeHtml(n.why)}</dd>`);
    if (n.vs) rows.push(`<dt>Not</dt><dd>${escapeHtml(n.vs)}</dd>`);
    if (n.todo) rows.push(`<dt>Study</dt><dd class="todo">${escapeHtml(n.todo)}</dd>`);
    if (n.refs) rows.push(`<dt>Texts</dt><dd class="refs">${refChips(n.refs)}</dd>`);
    return `<div class="mbox mbox-leaf${open ? ' mopen' : ''}"
        data-id="${escapeHtml(box.id)}" style="--tier:${tier ? tier[1] : 'var(--line)'}">
      <div class="mtitle"><b>${escapeHtml(n.title)}</b><span class="mchev">&#9656;</span></div>
      <div class="mmeta">
        ${tier ? `<span class="chip tier" style="background:${tier[1]}">${n.tier}</span>` : ''}
        ${conf ? `<span class="chip">${n.confidence}</span>` : ''}
        ${n.flags.includes('study') ? '<span class="chip">study</span>' : ''}
      </div>
      ${open && rows.length ? `<div class="mdetail"><dl>${rows.join('')}</dl></div>` : ''}
    </div>`;
  };

  MapView.prototype.redraw = function () {
    const tree = this._buildTree();
    const list = flatten(tree, []);
    const liveIds = new Set(list.map(b => b.id));

    for (const [id, el] of [...this.mapEls.entries()]) {
      if (!liveIds.has(id)) { el.remove(); this.mapEls.delete(id); }
    }
    list.forEach(box => {
      let el = this.mapEls.get(box.id);
      if (!el) {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._mboxHTML(box);
        el = tmp.firstElementChild;
        this.boxesEl.appendChild(el);
        this.mapEls.set(box.id, el);
      } else {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._mboxHTML(box);
        const fresh = tmp.firstElementChild;
        el.className = fresh.className;
        el.innerHTML = fresh.innerHTML;
      }
      box.el = el;
    });

    list.forEach(box => { box.h = box.el.offsetHeight; box.w = box.el.offsetWidth; });

    const rootL = tree.twoSided ? -tree.w / 2 : 0;
    const rootR = tree.twoSided ? tree.w / 2 : tree.w;

    function assignX(box, parent) {
      if (box.type === 'root') box.x = rootL;
      else if (box.type === 'domain') box.x = box.side === 1 ? rootR + DOMAIN_GAP : rootL - DOMAIN_GAP - box.w;
      else box.x = box.side === 1 ? parent.x + parent.w + LEAF_GAP : parent.x - LEAF_GAP - box.w;
      box.children.forEach(c => assignX(c, box));
    }
    assignX(tree, null);

    let cursorRight = 0, cursorLeft = 0;
    function assignY(box) {
      if (!box.children.length) {
        if (box.side === -1) { box.y = cursorLeft; cursorLeft += box.h + GAP_Y; }
        else { box.y = cursorRight; cursorRight += box.h + GAP_Y; }
        return;
      }
      box.children.forEach(assignY);
      box.children.forEach((c, i) => {
        if (c.type === 'leaf' && i % 2 === 1) c.x += c.side === 1 ? STAGGER_X : -STAGGER_X;
      });
      if (box.type === 'domain') {
        const first = box.children[0], last = box.children[box.children.length - 1];
        box.y = (first.y + first.h / 2 + last.y + last.h / 2) / 2 - box.h / 2;
      }
    }
    assignY(tree);
    {
      let minY = Infinity, maxY = -Infinity;
      tree.children.forEach(dom => { minY = Math.min(minY, dom.y); maxY = Math.max(maxY, dom.y + dom.h); });
      if (minY === Infinity) { minY = 0; maxY = tree.h; }
      tree.y = (minY + maxY) / 2 - tree.h / 2;
    }

    list.forEach(box => { box.el.style.transform = `translate(${box.x}px, ${box.y}px)`; });

    let paths = '';
    function edges(box) {
      box.children.forEach(c => {
        const y1 = box.y + box.h / 2, y2 = c.y + c.h / 2;
        let x1, x2;
        if (c.side === 1) { x1 = box.x + box.w; x2 = c.x; }
        else { x1 = box.x; x2 = c.x + c.w; }
        const mx = (x1 + x2) / 2;
        const edgeClass = c.depth === 1 ? 'edge-domain' : 'edge-leaf';
        paths += `<path class="${edgeClass}" d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"></path>`;
        edges(c);
      });
    }
    edges(tree);
    this.svgEl.innerHTML = paths;

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    list.forEach(b => {
      minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w);
      minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y + b.h);
    });
    this.svgEl.setAttribute('width', maxX - minX + 40);
    this.svgEl.setAttribute('height', maxY - minY + 40);

    if (this.needsCenter) {
      const rect = this.wrap.getBoundingClientRect();
      this.zoom = 1;
      this.panX = rect.width / 2 - (tree.x + tree.w / 2);
      this.panY = rect.height / 2 - (tree.y + tree.h / 2);
      this.needsCenter = false;
    }
    this._applyPanZoom();
  };

  MapView.prototype._applyPanZoom = function () {
    this.panzoomEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  };

  MapView.prototype._bindClicks = function () {
    const self = this;
    this.boxesEl.addEventListener('click', e => {
      if (e.target.closest('.refchip') || e.target.closest('.versepop')) return;
      // Task 4 adds interactive form controls (inputs/selects/textareas) inside
      // expanded leaves — clicks on those must not toggle the tile shut.
      if (e.target.closest('input, select, textarea, .tagchip, .addtag, button.danger')) return;
      const box = e.target.closest('.mbox');
      if (!box) return;
      const id = box.dataset.id;
      if (id === 'root') return;
      if (id.startsWith('domain:')) {
        if (self.mapManualCollapsed.has(id)) self.mapManualCollapsed.delete(id); else self.mapManualCollapsed.add(id);
      } else {
        if (self.mapDetailOpen.has(id)) self.mapDetailOpen.delete(id); else self.mapDetailOpen.add(id);
        self.onLeafToggle(id, self.mapDetailOpen.has(id));
      }
      self.redraw();
    });
  };

  MapView.prototype._bindPanZoom = function () {
    const self = this;
    const wrap = this.wrap;
    const DRAG_THRESHOLD = 6;
    const pointers = new Map();
    let dragging = false, moved = false;
    let startX = 0, startY = 0, lastX = 0, lastY = 0;
    let pinchStartDist = 0, pinchStartZoom = 1;

    function zoomAt(mx, my, newZoom) {
      newZoom = Math.min(2.5, Math.max(0.3, newZoom));
      const cx = (mx - self.panX) / self.zoom, cy = (my - self.panY) / self.zoom;
      self.panX = mx - cx * newZoom;
      self.panY = my - cy * newZoom;
      self.zoom = newZoom;
    }

    function pinchGeometry() {
      const pts = [...pointers.values()];
      return {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        mx: (pts[0].x + pts[1].x) / 2,
        my: (pts[0].y + pts[1].y) / 2,
      };
    }

    wrap.addEventListener('pointerdown', e => {
      if (e.target.closest('.mbox') || e.target.closest('.mapcontrols')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
      if (pointers.size === 1) {
        dragging = true; moved = false;
        startX = lastX = e.clientX; startY = lastY = e.clientY;
        wrap.classList.add('dragging');
      } else if (pointers.size === 2) {
        dragging = false;
        const g = pinchGeometry();
        pinchStartDist = g.dist;
        pinchStartZoom = self.zoom;
      }
    });

    wrap.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size >= 2) {
        if (pinchStartDist <= 0) return;
        const rect = wrap.getBoundingClientRect();
        const g = pinchGeometry();
        const newZoom = pinchStartZoom * (g.dist / pinchStartDist);
        zoomAt(g.mx - rect.left, g.my - rect.top, newZoom);
        self._applyPanZoom();
        return;
      }

      if (!dragging) return;
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
      moved = true;
      self.panX += e.clientX - lastX; self.panY += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      self._applyPanZoom();
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStartDist = 0;
      if (pointers.size === 0) {
        dragging = false; wrap.classList.remove('dragging');
      } else if (pointers.size === 1) {
        const [[, p]] = pointers;
        dragging = true; moved = true; lastX = p.x; lastY = p.y;
      }
    }
    wrap.addEventListener('pointerup', endPointer);
    wrap.addEventListener('pointercancel', endPointer);

    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      if (Math.min(2.5, Math.max(0.3, self.zoom + delta)) === self.zoom) return;
      const rect = wrap.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, self.zoom + delta);
      self._applyPanZoom();
    }, { passive: false });
  };

  return MapView;
});
```

- [ ] **Step 2: Manual verification (no wiring into editor.html yet)**

Create a throwaway `tmp/map-view-smoke.html` (not committed) that loads `editor-core.js` and `map-view.js`, parses a small inline fixture string with `EditorCore.parse()`, and mounts a `MapView` into a `<div style="width:100%;height:600px">` with hard-coded `tierMeta`/`confMeta` matching `render.py`'s `TIER_META`/`CONF_META`. Open it directly in a browser (`file://`), confirm: domain boxes render and toggle open/closed on click, leaf boxes render read-only detail on click exactly like `theology-map.html`, pan/drag and wheel-zoom work, "Reset view" recenters. Delete the smoke-test file when done — it's scaffolding, not part of the shipped editor.

- [ ] **Step 3: Commit**

```bash
git add engine/map-view.js
git commit -m "Add hand-ported map-view.js layout/pan/zoom engine (read-only)"
```

---

### Task 3: Wire the Map/List tab switcher into editor.html

**Files:**
- Modify: `engine/editor.html` (layout markup ~line 129-136, script includes ~line 158-159, top of the IIFE ~line 160-220)

**Interfaces:**
- Consumes: `MapView` from Task 2 (`new MapView(container, {getDomains, tierMeta, confMeta})`).
- Produces: module-level `mapView` instance and `activeTab` ('map' | 'list') state that Tasks 4-6 read/mutate.

- [ ] **Step 1: Add tab markup and containers**

In `engine/editor.html`, replace the `<div class="layout">...</div>` block (lines 129-136) with:

```html
<div class="tabs" id="tabs" style="display:none">
  <button type="button" class="tabbtn active" data-tab="map">Map</button>
  <button type="button" class="tabbtn" data-tab="list">List</button>
</div>

<div class="layout" id="mapLayout" style="display:none">
  <div class="mapwrap" id="mapContainer"></div>
</div>

<div class="layout" id="listLayout" style="display:none">
  <nav class="tree" id="tree" aria-label="Domains and nodes"></nav>
  <main class="form" id="form">
    <p class="empty">Connect or upload <code>theology-map.md</code> above to start editing. Connecting
      (Chrome/Edge) lets Save write straight back to the file on disk. Uploading works in any browser
      but Save only copies the text — you'll paste it into the file yourself.</p>
  </main>
</div>
```

- [ ] **Step 2: Add tab and map-container CSS**

In `engine/editor.html`'s `<style>` block, after the existing `.layout` rule, add:

```css
.tabs { display:flex; gap:4px; padding:10px 20px 0; }
.tabbtn { font:600 12.5px/1 var(--sans); border:1px solid var(--line); background:var(--panel);
  color:var(--muted); padding:8px 16px; border-radius:6px 6px 0 0; border-bottom:none; cursor:pointer; }
.tabbtn.active { color:var(--ink); background:var(--bg); font-weight:700; }
.mapwrap { position:relative; width:100%; height:calc(100vh - 170px); overflow:hidden;
  background:var(--bg); background-image:radial-gradient(var(--line) 1px, transparent 1px);
  background-size:24px 24px; cursor:grab; touch-action:none; }
.mapwrap.dragging { cursor:grabbing; }
.map-panzoom { position:absolute; left:0; top:0; transform-origin:0 0; }
.map-svg { position:absolute; left:0; top:0; overflow:visible; pointer-events:none; }
.map-svg path { fill:none; stroke:var(--line); stroke-width:1.4; }
.map-svg path.edge-domain { stroke-width:1.6; opacity:.9; }
.map-svg path.edge-leaf { stroke-width:1.1; opacity:.75; }
.mbox { position:absolute; left:0; top:0; background:var(--panel); border:1px solid var(--line);
  border-radius:7px; padding:9px 12px; transition:transform .28s ease; cursor:pointer;
  font:13px/1.4 var(--sans); width:max-content; }
.mbox-root { width:150px; background:var(--ink); color:var(--bg); font-family:var(--serif);
  font-weight:700; font-size:14.5px; text-align:center; cursor:default; border-color:var(--ink); }
.mbox-domain { min-width:140px; max-width:min(240px, 80vw); font-weight:700; font-size:12px;
  letter-spacing:.03em; text-transform:uppercase; border-left:3px solid var(--muted); }
.mbox-leaf { min-width:150px; max-width:min(320px, 86vw); border-left:3px solid var(--tier, var(--line)); cursor:default; }
.mbox-leaf .mtitle { cursor:pointer; }
.mbox-leaf.mopen { min-width:min(340px, 80vw); max-width:min(560px, 92vw); }
.mbox-leaf .mtitle b { font-family:var(--serif); font-weight:600; }
.mtitle { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.mtitle b { font-weight:600; font-size:13.5px; }
.mchev { font-size:10px; color:var(--muted); transition:transform .15s ease; flex:0 0 auto; }
.mbox.mopen .mchev { transform:rotate(90deg); }
.mmeta { display:flex; gap:5px; flex-wrap:wrap; margin-top:6px; }
.mdetail { margin-top:8px; border-top:1px solid var(--line); padding-top:7px; }
.mcount { font-weight:400; color:var(--muted); font-size:11px; }
.chip { font:600 10px/1 var(--sans); letter-spacing:.05em; text-transform:uppercase;
  padding:3.5px 6.5px; border-radius:4px; background:var(--chip); color:var(--muted); }
.chip.tier { color:#fff; }
.mapcontrols { position:absolute; right:10px; top:10px; z-index:5; display:flex; gap:6px; }
.mapcontrols button { font:600 11.5px/1 var(--sans); border:1px solid var(--line);
  background:var(--panel); color:var(--muted); padding:5px 9px; border-radius:6px; cursor:pointer; }
.maphint { position:absolute; left:10px; bottom:8px; font:11px/1 var(--sans); color:var(--muted); z-index:5; }
```

- [ ] **Step 3: Include `map-view.js` and add tab-switching + `MapView` wiring in the script**

In `engine/editor.html`, change line 158-159 to:
```html
<script src="editor-core.js"></script>
<script src="shared-fields.js"></script>
<script src="map-view.js"></script>
```

Inside the IIFE, after the existing `const treeEl = ...` declarations, add:

```javascript
const tabsEl = $('tabs'), mapLayoutEl = $('mapLayout'), listLayoutEl = $('listLayout'), mapContainerEl = $('mapContainer');
let activeTab = 'map';
let mapView = null;

tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tabbtn');
  if (!btn) return;
  setTab(btn.dataset.tab);
});

function setTab(tab) {
  activeTab = tab;
  [...tabsEl.querySelectorAll('.tabbtn')].forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  mapLayoutEl.style.display = tab === 'map' ? 'flex' : 'none';
  listLayoutEl.style.display = tab === 'list' ? 'flex' : 'none';
  if (tab === 'map' && mapView) mapView.redraw();
}

function ensureMapView() {
  if (mapView) return mapView;
  mapView = new MapView(mapContainerEl, {
    getDomains: () => domains,
    tierMeta: TIER_META,
    confMeta: CONF_META,
  });
  return mapView;
}

// Copied from render.py's TIER_META / CONF_META (colour values must match —
// see the plan's Global Constraints on hand-porting).
const TIER_META = {
  'T1': ['Essential to the gospel', '#7c2d3b'],
  'T1.5': ['Near-essential', '#8a4a24'],
  'T2': ['Church-defining', '#8c6a1f'],
  'T2.5': ['Strains partnership', '#5f6b35'],
  'T3': ['Important, not divisive', '#2f6b63'],
  'T4': ['Matters of liberty', '#33526e'],
};
const CONF_META = {
  'certain': [100, 'Settled. I would teach and defend this.'],
  'confident': [78, 'Held with good reason, open to sharpening.'],
  'leaning': [55, 'A working position, not yet settled.'],
  'open': [25, 'Genuinely undecided.'],
  'rejected': [0, 'Considered and rejected.'],
};
```

- [ ] **Step 4: Show the tabs and default to Map after a file loads**

In both the `btnConnect` click handler and the `fileInput` change handler, after `markLoaded(...)` add:
```javascript
tabsEl.style.display = 'flex';
setTab('map');
ensureMapView().redraw();
```
(Leave the existing `renderTree(); renderForm();` calls in place — the List tab still needs its own state built even while hidden, so switching to it later shows current data immediately.)

- [ ] **Step 5: Manual verification**

Open `start_editor.bat`, connect `theology-map.md`. Confirm: the Map tab is shown by default and renders the full real map (all domains, correct tier colours) with working pan/zoom; clicking "List" switches to the existing form-based editor with no change in its behavior; clicking "Map" again re-shows the map at its last pan/zoom position. Confirm leaf tiles are still read-only at this point (editable tiles are Task 4).

- [ ] **Step 6: Commit**

```bash
git add engine/editor.html
git commit -m "Wire Map/List tab switcher into editor.html, Map as default"
```

---

### Task 4: Make leaf tiles editable

**Files:**
- Modify: `engine/map-view.js` (`_mboxHTML`'s leaf branch → replaced with an editable DOM builder; `redraw`'s el-reuse path)
- Modify: `engine/editor.html` (pass `core`, `SharedFields`, and mutation callbacks into `MapView`)

**Interfaces:**
- `MapView` constructor gains two more options: `getAllSlugs: () => string[]` and `onFieldChange: (node) => void` (called after any field edit — Task 6 wires this to change-tracking).
- Consumes: `EditorCore.TIERS`, `EditorCore.CONFIDENCES`, `EditorCore.slugify`, `SharedFields.renderLinkField` (all already defined; `map-view.js` receives `EditorCore`/`SharedFields` via `window` globals the same way `editor.html` already does, not as constructor params, since they're always loaded before `map-view.js` per Task 3's script order).

- [ ] **Step 1: Replace the leaf branch of `_mboxHTML` with a DOM-building method**

The existing `redraw()` method rebuilds every box's `innerHTML` from a string returned by `_mboxHTML(box)` on every call — that approach can't hold live `<input>`/`<textarea>` focus across redraws (typing a character would trigger a redraw that destroys and recreates the focused element). So leaf boxes need different handling: build their DOM once when first created, and on subsequent redraws only update non-focused-away parts (tier color var, open/closed class) rather than replacing `innerHTML`.

In `engine/map-view.js`, change the `redraw()` method's per-box loop from unconditionally re-stringifying every box, to branching on type — root/domain boxes keep the existing string-diff approach (they have no live inputs), leaf boxes get a new `_mountLeaf`/`_updateLeaf` pair:

```javascript
    list.forEach(box => {
      let el = this.mapEls.get(box.id);
      if (box.type === 'leaf') {
        if (!el) {
          el = this._mountLeaf(box);
          this.boxesEl.appendChild(el);
          this.mapEls.set(box.id, el);
        } else {
          this._updateLeaf(el, box);
        }
        box.el = el;
        return;
      }
      if (!el) {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._mboxHTML(box);
        el = tmp.firstElementChild;
        this.boxesEl.appendChild(el);
        this.mapEls.set(box.id, el);
      } else {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._mboxHTML(box);
        const fresh = tmp.firstElementChild;
        el.className = fresh.className;
        el.innerHTML = fresh.innerHTML;
      }
      box.el = el;
    });
```

Then add `_mountLeaf` and `_updateLeaf`, and delete the leaf branch from `_mboxHTML` (root/domain branches stay):

```javascript
  MapView.prototype._leafHeader = function (n, open) {
    const core = window.EditorCore;
    const wrap = document.createElement('div');
    wrap.className = 'mtitle';
    const title = document.createElement('input');
    title.type = 'text'; title.value = n.title; title.className = 'mtitle-input';
    title.addEventListener('input', () => { n.title = title.value; n.slug = core.slugify(title.value); this.onFieldChange(n); });
    title.addEventListener('click', e => e.stopPropagation());
    wrap.appendChild(title);
    const chev = document.createElement('span');
    chev.className = 'mchev'; chev.innerHTML = '&#9656;';
    wrap.appendChild(chev);
    return wrap;
  };

  MapView.prototype._leafMeta = function (n) {
    const core = window.EditorCore;
    const wrap = document.createElement('div');
    wrap.className = 'mmeta';

    const tierSel = document.createElement('select');
    tierSel.className = 'chip-select';
    [''].concat(core.TIERS).forEach(t => {
      const o = document.createElement('option'); o.value = t; o.textContent = t || 'Tier —';
      if (t === (n.tier || '')) o.selected = true;
      tierSel.appendChild(o);
    });
    tierSel.addEventListener('click', e => e.stopPropagation());
    tierSel.addEventListener('change', () => { n.tier = tierSel.value || null; this.onFieldChange(n); this.redraw(); });
    wrap.appendChild(tierSel);

    const confSel = document.createElement('select');
    confSel.className = 'chip-select';
    [''].concat(core.CONFIDENCES).forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c || 'Confidence —';
      if (c === (n.confidence || '')) o.selected = true;
      confSel.appendChild(o);
    });
    confSel.addEventListener('click', e => e.stopPropagation());
    confSel.addEventListener('change', () => { n.confidence = confSel.value || null; this.onFieldChange(n); });
    wrap.appendChild(confSel);

    [['study', 'study'], ['thread', 'thread']].forEach(([flag, label]) => {
      const lab = document.createElement('label');
      lab.className = 'flag-chip';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = n.flags.includes(flag);
      cb.addEventListener('click', e => e.stopPropagation());
      cb.addEventListener('change', () => {
        n.flags = cb.checked ? [...new Set([...n.flags, flag])] : n.flags.filter(f => f !== flag);
        this.onFieldChange(n);
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(label));
      wrap.appendChild(lab);
    });

    return wrap;
  };

  MapView.prototype._leafDetail = function (n) {
    const self = this;
    const wrap = document.createElement('div');
    wrap.className = 'mdetail';

    function field(labelText, value, onInput) {
      const row = document.createElement('div');
      row.className = 'mfield';
      const label = document.createElement('label');
      label.textContent = labelText;
      row.appendChild(label);
      const ta = document.createElement('textarea');
      ta.value = value || '';
      ta.rows = 2;
      ta.addEventListener('click', e => e.stopPropagation());
      ta.addEventListener('input', () => { onInput(ta.value); self.onFieldChange(n); autosize(ta); });
      row.appendChild(ta);
      autosize(ta);
      return row;
    }
    function autosize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

    wrap.appendChild(field('Hold', n.hold, v => { n.hold = v; }));
    wrap.appendChild(field('Why', n.why, v => { n.why = v; }));
    wrap.appendChild(field('Vs', n.vs, v => { n.vs = v; }));
    wrap.appendChild(field('Study', n.todo, v => { n.todo = v; }));

    const refsRow = document.createElement('div');
    refsRow.className = 'mfield';
    const refsLabel = document.createElement('label');
    refsLabel.textContent = 'Texts';
    refsRow.appendChild(refsLabel);
    const refsInput = document.createElement('input');
    refsInput.type = 'text'; refsInput.value = n.refs || '';
    refsInput.addEventListener('click', e => e.stopPropagation());
    refsInput.addEventListener('input', () => { n.refs = refsInput.value; self.onFieldChange(n); });
    refsRow.appendChild(refsInput);
    wrap.appendChild(refsRow);

    const linkWrap = document.createElement('div');
    linkWrap.addEventListener('click', e => e.stopPropagation());
    linkWrap.appendChild(window.SharedFields.renderLinkField(n, self.getAllSlugs(), () => self.onFieldChange(n)));
    wrap.appendChild(linkWrap);

    const del = document.createElement('button');
    del.type = 'button'; del.className = 'danger mdelete';
    del.textContent = 'Delete this node';
    del.addEventListener('click', e => { e.stopPropagation(); self.onDeleteNode(n); });
    wrap.appendChild(del);

    return wrap;
  };

  MapView.prototype._mountLeaf = function (box) {
    const n = box.node;
    const open = this.mapDetailOpen.has(n.slug);
    const el = document.createElement('div');
    el.className = 'mbox mbox-leaf' + (open ? ' mopen' : '');
    el.dataset.id = box.id;
    const tier = n.tier ? this.tierMeta[n.tier] : null;
    el.style.setProperty('--tier', tier ? tier[1] : 'var(--line)');
    el.appendChild(this._leafHeader(n, open));
    el.appendChild(this._leafMeta(n));
    if (open) el.appendChild(this._leafDetail(n));
    return el;
  };

  MapView.prototype._updateLeaf = function (el, box) {
    const n = box.node;
    const open = this.mapDetailOpen.has(n.slug);
    el.className = 'mbox mbox-leaf' + (open ? ' mopen' : '');
    const tier = n.tier ? this.tierMeta[n.tier] : null;
    el.style.setProperty('--tier', tier ? tier[1] : 'var(--line)');
    const hasDetail = !!el.querySelector('.mdetail');
    if (open && !hasDetail) el.appendChild(this._leafDetail(n));
    if (!open && hasDetail) el.querySelector('.mdetail').remove();
    // title/tier/confidence/flag inputs are left alone here (not rebuilt) so
    // an in-progress keystroke in a focused field is never clobbered by a
    // redraw triggered from elsewhere (e.g. resizing the window, or editing
    // a different node). They already reflect the live node object because
    // their own input handlers wrote to it directly.
  };
```

Delete the `if (box.type === 'leaf') { ... }` branch that used to live inside `_mboxHTML` (its logic has moved into `_mountLeaf`/`_leafDetail`); `_mboxHTML` now only handles `root` and `domain`.

- [ ] **Step 2: Add `getAllSlugs`/`onFieldChange`/`onDeleteNode` to the constructor options and CSS for the new controls**

In `map-view.js`'s `MapView` constructor, add:
```javascript
this.getAllSlugs = opts.getAllSlugs || function () { return []; };
this.onFieldChange = opts.onFieldChange || function () {};
this.onDeleteNode = opts.onDeleteNode || function () {};
```

In `engine/editor.html`'s `<style>`, add:
```css
.mtitle-input { flex:1; border:none; background:none; padding:0; font:inherit; color:var(--ink);
  font-family:var(--serif); font-weight:600; font-size:13.5px; border-bottom:1px solid transparent; }
.mtitle-input:focus { outline:none; border-bottom-color:var(--muted); }
.chip-select { font:600 10px/1 var(--sans); text-transform:uppercase; letter-spacing:.05em;
  padding:3.5px 6.5px; border-radius:4px; background:var(--chip); color:var(--muted);
  border:1px solid var(--line); }
.flag-chip { display:inline-flex; align-items:center; gap:4px; font:11px/1 var(--sans);
  color:var(--muted); }
.mfield { margin-top:8px; }
.mfield label { display:block; font:700 9.5px/1.6 var(--sans); letter-spacing:.06em;
  text-transform:uppercase; color:var(--muted); margin-bottom:2px; }
.mfield textarea, .mfield input[type=text] { width:100%; border:1px solid var(--line);
  background:var(--panel); color:var(--ink); padding:6px 8px; border-radius:5px;
  font:13px/1.5 var(--serif); resize:none; overflow:hidden; }
.mdelete { margin-top:10px; font-size:11.5px; padding:5px 9px; }
```

- [ ] **Step 3: Pass the new options from `editor.html`**

In `engine/editor.html`'s `ensureMapView()`, add the new options:
```javascript
function ensureMapView() {
  if (mapView) return mapView;
  mapView = new MapView(mapContainerEl, {
    getDomains: () => domains,
    tierMeta: TIER_META,
    confMeta: CONF_META,
    getAllSlugs: () => core.allSlugs(domains),
    onFieldChange: (node) => touch(node),
    onDeleteNode: (node) => confirmDeleteNodeFromMap(node),
  });
  return mapView;
}
```
(`touch(node)` and `confirmDeleteNodeFromMap` are defined in Tasks 5-6; leave `touch` as its current no-arg signature for now — Task 6 changes it. For this task, temporarily stub `confirmDeleteNodeFromMap` as `function confirmDeleteNodeFromMap(node) { alert('Delete wiring lands in Task 5'); }` so the app doesn't crash; Task 5 replaces the stub.)

- [ ] **Step 4: Manual verification**

Connect `theology-map.md`, switch to the Map tab, click a leaf to expand it. Confirm: title becomes an editable input pre-filled with the real title; tier/confidence render as selects with the current value pre-selected; study/thread checkboxes reflect existing flags; hold/why/vs/study fields are editable textareas pre-filled with real content and grow as you type; texts field is a plain editable input; the link editor shows existing links as removable chips and accepts a new one via the shared datalist. Confirm typing in any field does NOT collapse the tile or lose focus mid-keystroke. Confirm collapsing and re-expanding the tile shows the edit you just made. Confirm editing a field in the Map tab and then switching to the List tab shows the same edit there (proves both tabs share the live `domains` object).

- [ ] **Step 5: Commit**

```bash
git add engine/map-view.js engine/editor.html
git commit -m "Make Map tab leaf tiles directly editable"
```

---

### Task 5: Add-node, add-domain, and delete on the Map tab

**Files:**
- Modify: `engine/map-view.js` (`_buildTree` domain children, root children, `_mboxHTML`'s domain branch)
- Modify: `engine/editor.html` (`confirmDeleteNodeFromMap`, shared `confirmDeleteNode` logic)

**Interfaces:**
- Consumes: `EditorCore.newNode(title, domainName)` (existing), the existing `dlgConfirm` dialog and its `$('dlgTitle')`/`$('dlgBody')`/`$('dlgOk')`/`$('dlgCancel')` elements (existing, currently only wired to the List tab's `confirmDeleteNode`).
- Produces: `MapView.prototype.onAddNode`/`onAddDomain` constructor callbacks, mirroring `onDeleteNode`.

- [ ] **Step 1: Add "+ New node" tiles per domain and "+ New domain" at root**

In `map-view.js`'s `_buildTree`, after building each domain's `dom.children` (inside the `domains.forEach` loop, right after the `if (isOpen) ...` line), add a synthetic add-node child whenever the domain is open:
```javascript
      if (isOpen) {
        dom.children = members.map(n => this._leafBox(n, 2, side));
        dom.children.push({ id: 'addnode:' + domain.name, type: 'addnode', title: '+ New node', depth: 2, side, domainName: domain.name, children: [] });
      }
```
After the `domains.forEach` loop (still inside `_buildTree`, before `return root;`), add a synthetic add-domain root child:
```javascript
    root.children.push({ id: 'adddomain', type: 'adddomain', title: '+ New domain', depth: 1, side: nextSide(), children: [] });
```

- [ ] **Step 2: Render and lay out the two new box types**

In `_mboxHTML`, add two branches (alongside the existing `root`/`domain` branches, before the leaf handling was moved out — these are simple string-rendered boxes, same pattern as `domain`):
```javascript
    if (box.type === 'addnode' || box.type === 'adddomain') {
      return `<div class="mbox mbox-add" data-id="${escapeHtml(box.id)}">+ ${box.type === 'addnode' ? 'New node' : 'New domain'}</div>`;
    }
```

`assignY`'s leaf-packing branch keys off `!box.children.length` (true for `addnode`/`adddomain` boxes too, since they have none), so they already get packed into the vertical column alongside real leaves/domains with no further layout changes needed. Confirm this by reading `assignY` — no code change required here, just verify the existing condition covers the new types (it does: `addnode` boxes have `side` set the same way leaves do, so they stack correctly; `adddomain` has `side` set the same way domains do).

Add matching CSS in `engine/editor.html`:
```css
.mbox-add { border-style:dashed; color:var(--muted); font:600 12px/1 var(--sans);
  text-align:center; cursor:pointer; }
.mbox-add:hover { color:var(--ink); border-color:var(--muted); }
```

- [ ] **Step 3: Handle clicks on the new box types**

In `_bindClicks`, extend the id-dispatch after the existing `domain:` check:
```javascript
      if (id.startsWith('domain:')) {
        if (self.mapManualCollapsed.has(id)) self.mapManualCollapsed.delete(id); else self.mapManualCollapsed.add(id);
      } else if (id.startsWith('addnode:')) {
        const domainName = id.slice('addnode:'.length);
        const node = self.onAddNode(domainName);
        if (node) self.mapDetailOpen.add(node.slug);
      } else if (id === 'adddomain') {
        self.onAddDomain();
      } else {
        if (self.mapDetailOpen.has(id)) self.mapDetailOpen.delete(id); else self.mapDetailOpen.add(id);
        self.onLeafToggle(id, self.mapDetailOpen.has(id));
      }
      self.redraw();
```

In the constructor, add:
```javascript
this.onAddNode = opts.onAddNode || function () { return null; };
this.onAddDomain = opts.onAddDomain || function () {};
```

- [ ] **Step 4: Wire the callbacks and shared delete confirmation in `editor.html`**

Replace the Task 4 stub for `confirmDeleteNodeFromMap` and add the two new callbacks. First, generalize the existing `confirmDeleteNode` (which currently hard-codes `current.domainIndex`/`current.nodeIndex`) so both tabs can call it:
```javascript
function deleteNodeWithConfirm(domain, node, afterDelete) {
  $('dlgTitle').textContent = 'Delete "' + node.title + '"?';
  $('dlgBody').textContent = 'This removes the node from the editor. It only leaves the file once you save.';
  dlgConfirm.showModal();
  $('dlgOk').onclick = () => {
    domain.nodes.splice(domain.nodes.indexOf(node), 1);
    dlgConfirm.close();
    afterDelete();
  };
  $('dlgCancel').onclick = () => dlgConfirm.close();
}
```
Update the List tab's existing `confirmDeleteNode()` to call it:
```javascript
function confirmDeleteNode() {
  const node = domains[current.domainIndex].nodes[current.nodeIndex];
  deleteNodeWithConfirm(domains[current.domainIndex], node, () => {
    current = null; dirty = true;
    renderTree(); renderForm();
  });
}
```
Add the Map tab's version and the add-node/add-domain callbacks:
```javascript
function confirmDeleteNodeFromMap(node) {
  const domain = domains.find(d => d.nodes.includes(node));
  deleteNodeWithConfirm(domain, node, () => {
    dirty = true;
    mapView.mapDetailOpen.delete(node.slug);
    mapView.redraw();
    renderTreeList('');
  });
}

function addNodeFromMap(domainName) {
  const domain = domains.find(d => d.name === domainName);
  if (!domain) return null;
  const node = core.newNode('Untitled', domainName);
  domain.nodes.push(node);
  dirty = true;
  renderTreeList('');
  return node;
}

function addDomainFromMap() {
  const name = prompt('New domain name:');
  if (!name || !name.trim()) return;
  domains.push({ name: name.trim(), nodes: [] });
  dirty = true;
  renderTree();
  mapView.redraw();
}
```
Update `ensureMapView()`'s options object to use the real callbacks instead of the stub:
```javascript
    onDeleteNode: (node) => confirmDeleteNodeFromMap(node),
    onAddNode: (domainName) => addNodeFromMap(domainName),
    onAddDomain: () => addDomainFromMap(),
```

- [ ] **Step 5: Manual verification**

On the Map tab: click "+ New node" in an existing domain, confirm a new tile appears already expanded and editable, titled "Untitled"; rename it and confirm the List tab's tree shows the rename. Click "+ New domain", enter a name, confirm a new dashed domain box appears at the root level with its own "+ New node" tile. Expand a leaf and click "Delete this node", confirm the existing confirm dialog appears with the right title, confirm deletion removes the tile and the List tab no longer shows that node. Confirm the List tab's own add/delete flows still work unchanged (regression check on the generalized `deleteNodeWithConfirm`).

- [ ] **Step 6: Commit**

```bash
git add engine/map-view.js engine/editor.html
git commit -m "Add node/domain creation and deletion to the Map tab"
```

---

### Task 6: Change-tracking indicator and shared toolbar

**Files:**
- Modify: `engine/editor.html` (toolbar markup ~line 118-127, `touch()` and all its call sites, `btnSave`/`btnRender` handlers)

**Interfaces:**
- Produces: `touch(node)` (signature change from the current no-arg `touch()`), module-level `editedNodes`/`createdNodes`/`deletedCount`, `updateChangeIndicator()`.

- [ ] **Step 1: Add the toolbar indicator element**

In `engine/editor.html`'s `.filebar` div, after `fileStatus`, add:
```html
<span class="status" id="changeStatus">No changes.</span>
```

- [ ] **Step 2: Add change-tracking state and the indicator updater**

Near the top of the IIFE, alongside `let dirty = false;`, add:
```javascript
let editedNodes = new Set();
let createdNodes = new Set();
let deletedCount = 0;

function resetChangeTracking() {
  editedNodes = new Set();
  createdNodes = new Set();
  deletedCount = 0;
  updateChangeIndicator();
}

function updateChangeIndicator() {
  const el = $('changeStatus');
  const parts = [];
  if (editedNodes.size > 0) parts.push(editedNodes.size + ' node' + (editedNodes.size === 1 ? '' : 's') + ' edited');
  if (createdNodes.size > 0) parts.push(createdNodes.size + ' created');
  if (deletedCount > 0) parts.push(deletedCount + ' deleted');
  el.textContent = parts.length ? parts.join(', ') : 'No changes.';
  el.className = 'status' + (parts.length ? '' : ' ok');
}
```

- [ ] **Step 3: Change `touch()`'s signature and update every call site**

Replace the existing `touch()` function:
```javascript
function touch(node) {
  dirty = true;
  if (node && !createdNodes.has(node)) editedNodes.add(node);
  const status = document.getElementById('formStatus');
  if (status) { status.textContent = 'Unsaved changes in the editor.'; status.className = 'status'; }
  renderTreeList('');
  updateChangeIndicator();
}
```

Update every List-tab call site that currently calls `touch()` with no argument — in `renderForm()`'s field bindings (title, tier, confidence, flags, hold/why/vs/todo/refs), each currently reads e.g. `node.title = v; node.slug = core.slugify(v); touch();` — change each `touch()` call to `touch(node)`. There are 9 such call sites in the existing `renderForm()` body (title, tier, confidence, the two flag checkboxes share one, hold, why, vs, todo, refs) plus the `SharedFields.renderLinkField(node, ..., () => touch())` call from Task 1 — change that last one to `() => touch(node)`.

The Map tab's `onFieldChange: (node) => touch(node)` wiring from Task 4 already passes `node` — no change needed there.

- [ ] **Step 4: Track creation and deletion**

In `addNodeToDomain` (List tab) and `addNodeFromMap` (Map tab, from Task 5), after `dirty = true;` add:
```javascript
createdNodes.add(node);
updateChangeIndicator();
```

In `deleteNodeWithConfirm` (shared, from Task 5), inside the `$('dlgOk').onclick` callback, after the `domain.nodes.splice(...)` line add:
```javascript
if (createdNodes.has(node)) {
  createdNodes.delete(node);
} else {
  editedNodes.delete(node);
  deletedCount++;
}
updateChangeIndicator();
```
(This is the net-zero reconciliation rule: a node created and deleted in the same session before save never counts as "deleted" since it never existed in the saved file.)

`addDomain`/`addDomainFromMap` don't need their own counters — per the spec's Global design, domain creation isn't tracked separately; a domain only becomes visible in the indicator once nodes are added to it, which already calls `createdNodes.add(node)`.

- [ ] **Step 5: Reset on successful save**

In `btnSave`'s click handler, after `dirty = false;` add `resetChangeTracking();`. In `btnRender`'s click handler, after its own `dirty = false;` add `resetChangeTracking();`.

- [ ] **Step 6: Initialize on load**

In both `btnConnect`'s and `fileInput`'s load handlers, alongside the existing `current = null; dirty = false;`, add `resetChangeTracking();`.

- [ ] **Step 7: Manual verification**

Connect `theology-map.md`. Confirm the toolbar shows "No changes." initially. Edit a field on one node in the Map tab — confirm it changes to "1 node edited". Edit a second, different node — confirm "2 nodes edited". Add a new node — confirm "2 nodes edited, 1 created". Delete the newly-created node — confirm it drops back to "2 nodes edited" (net-zero rule). Delete one of the two edited nodes — confirm "1 node edited, 1 deleted". Click Save — confirm the indicator resets to "No changes." Repeat a quick check on the List tab to confirm the shared counter reacts identically there.

- [ ] **Step 8: Commit**

```bash
git add engine/editor.html
git commit -m "Add change-tracking indicator shared by both tabs"
```

---

### Task 7: End-to-end verification pass

**Files:** none (verification only — fix forward in the relevant file from Tasks 1-6 if something's off, no new files expected)

- [ ] **Step 1: Full round-trip check**

Connect the real `theology-map.md`. On the Map tab: edit an existing node's hold/why fields and tier, add a new node with full fields filled in, delete one unrelated existing node. Click "Preview & copy full text" and read the generated text: confirm the edited node's changes appear, the new node appears in the right domain with correct `## Title · Tier · Confidence` header formatting, and the deleted node is absent — this exercises `EditorCore.serialize()` unchanged by any of this work, confirming Map-tab edits produce byte-identical output to equivalent List-tab edits.

- [ ] **Step 2: Save & render check**

With `render_server.py` running (via `start_editor.bat`), click "Save & render" from a state with Map-tab edits pending. Confirm success status, then open `theology-map.html` fresh (or hard-refresh if already open) and confirm the edited/added/deleted nodes appear correctly in the regenerated public map — this exercises the full pipeline unchanged by this work (`render.py` → `fetch_verses.py` → `render.py`).

- [ ] **Step 3: Visual parity check against the public Map view**

Side-by-side, compare the editor's Map tab (collapsed state, then one expanded domain, then one expanded leaf) against `theology-map.html`'s own Map view for the same nodes. Confirm: tier colors match, box sizing/clamping matches, stagger pattern matches, pan/zoom range and behavior matches. Minor expected differences: editor leaf tiles show form controls instead of read-only `<dl>` rows, and editor domain boxes include the two new dashed add-affordance tiles that the public map doesn't have.

- [ ] **Step 4: Regression check on existing features**

Confirm unaffected existing behavior still works: "Preview & copy full text" dialog, Upload-a-copy read-only mode (Save/Save & render buttons stay disabled, Map tab still renders and is still editable in-memory even though nothing can be written back), the `beforeunload` guard still blocks navigation while `dirty` is true, dark mode (`prefers-color-scheme: dark`) renders the Map tab's new elements with correct colors (no hard-coded light-only colors were introduced — everything above uses existing `var(--…)` tokens).

- [ ] **Step 5: Final commit**

If Steps 1-4 required any fixes, they should already be committed individually per-fix. If everything passed clean with no fixes needed, no commit is required for this task — it's verification-only.

---

## Self-review notes

- **Spec coverage:** every section of `2026-08-15-map-tile-editor-design.md` maps to a task — architecture/data-flow → Tasks 2-3; tabs/toolbar/default-view → Task 3; change-tracking → Task 6; save/deploy model → unchanged code path, exercised in Task 7; tile edit-mode UI → Task 4; add/delete flows → Task 5; testing approach → Global Constraints + every task's manual-verification step.
- **Placeholder scan:** no TBD/TODO markers; the one stub (`confirmDeleteNodeFromMap` alert placeholder in Task 4 Step 3) is explicitly temporary and is replaced by real code in Task 5 Step 4 — flagged as such rather than left implicit.
- **Type/signature consistency:** `touch()` → `touch(node)` change is introduced once in Task 6 and every pre-existing call site is enumerated for update in the same task; `MapView` constructor options are introduced incrementally across Tasks 2-6 without renaming any existing option.
- **Scope check:** single cohesive feature, one plan. Each task leaves the editor in a working, manually-verifiable state (no task depends on a later task to avoid breaking existing functionality).
