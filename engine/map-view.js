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
