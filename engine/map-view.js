/* map-view.js — THE Map-view layout/pan/zoom engine. One source, two consumers.
 *
 * Until P9 (2026-09-12) this file was a hand-ported copy of ~390 lines living
 * inside render.py's template string, the two kept in lockstep by hand. That
 * fork is gone: render.py now reads this file at import time and inlines it
 * into the generated theology-map.html beside the data payload. Edit the map
 * engine here and nowhere else.
 *
 * The two consumers differ in three ways, all of them options rather than
 * forks:
 *   - input shape. The generated map holds a flat array of nodes carrying a
 *     `.domain` string; the editor holds them already grouped. MapView.
 *     groupByDomain adapts the former to the latter.
 *   - the detail panel's body. A selected belief's detail shows in
 *     .map-panel, never inside its tile. Read-only, it is a <dl> built from
 *     render.py's own detailRows(), shared with its card views and injected as
 *     `opts.panelHTML`; in the editor it is DOM-built controls.
 *   - chrome. Rename, add-node and add-domain exist only in the editor;
 *     `opts.readonly` turns them off.
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

  function tierRank(n) {
    const i = TIER_ORDER.indexOf(n.tier);
    return i === -1 ? TIER_ORDER.length : i;
  }

  function sortByTier(list) {
    return list.slice().sort((a, b) => tierRank(a) - tierRank(b));
  }

  // The generated map holds a flat array of nodes each carrying a `.domain`
  // string; the editor holds them already grouped. This is the adapter between
  // the two, and the only shape difference between the two consumers.
  // Order is first appearance, which is the order the source file lists the
  // domains in and therefore the order the map's branches have always taken.
  //
  // It deliberately does NOT filter: the generated map builds its domain list
  // from every node and filters only the members, so a search matching nothing
  // in an area still shows that area's box reading "0 nodes". A caller that
  // pre-filters would silently drop empty areas instead.
  function groupByDomain(nodes) {
    const order = [];
    const byName = new Map();
    (nodes || []).forEach(n => {
      const name = n.domain;
      if (!byName.has(name)) { byName.set(name, []); order.push(name); }
      byName.get(name).push(n);
    });
    return order.map(name => ({ name, nodes: byName.get(name) }));
  }

  // Leaf boxes are keyed by a stable per-node id, not by n.slug — slug
  // changes the moment a title is edited, and using it as the DOM-element
  // cache key / "which tile is expanded" key meant renaming an open tile
  // silently collapsed it (and threw away its DOM element) on the very next
  // redraw. A WeakMap keyed on the node object itself is immune to renames.
  let _leafIdCounter = 0;
  const _leafIdMap = new WeakMap();
  function stableLeafId(n) {
    if (!_leafIdMap.has(n)) _leafIdMap.set(n, 'leaf' + (++_leafIdCounter));
    return _leafIdMap.get(n);
  }

  function MapView(container, opts) {
    this.container = container;
    this.getDomains = opts.getDomains;
    this.tierMeta = opts.tierMeta;
    this.confMeta = opts.confMeta;
    // One selected leaf, or none. A belief never expands inside the canvas any
    // more: its detail is shown in .map-panel, beside the map, at every width.
    this.selectedId = null;
    this.selectedNode = null;
    this.mapManualCollapsed = null; // Set, initialised lazily once domain names are known
    this.mapEls = new Map();
    // One-shot id of a leaf just created via the addnode click handler, so
    // redraw()'s mount branch can Settle exactly that tile in and nothing
    // else -- see _activate and redraw below.
    this._pendingEnterId = null;
    this.panX = 0; this.panY = 0; this.zoom = 1;
    this.needsCenter = true;
    this.getAllSlugs = opts.getAllSlugs || function () { return []; };
    this.onFieldChange = opts.onFieldChange || function () {};
    this.onDeleteNode = opts.onDeleteNode || function () {};
    this.onAddNode = opts.onAddNode || function () { return null; };
    this.onAddDomain = opts.onAddDomain || function () {};
    this.onRenameDomain = opts.onRenameDomain || function () {};

    // The read-only consumer (render.py's generated map). readonly drops the
    // editing chrome and routes leaves through leafHTML; escapeHtml is injected
    // rather than reached through window.EditorCore, which exists only in the
    // editor -- a local copy here would be a fourth copy of a helper that is
    // documented as living in exactly one place (CLAUDE.md, known forks).
    // forceOpen lets a consumer override a manually-collapsed domain, which is
    // how the generated map auto-expands areas holding a search match.
    this.readonly = !!opts.readonly;
    this.leafHTML = opts.leafHTML || null;
    this.panelHTML = opts.panelHTML || null;
    this.escapeHtml = opts.escapeHtml || function (s) { return window.EditorCore.escapeHtml(s); };
    this.forceOpen = opts.forceOpen || function () { return false; };

    container.innerHTML =
      '<div class="mapcontrols"><button type="button" class="map-reset">Reset view</button></div>' +
      '<div class="maphint">Drag to pan &middot; pinch or scroll to zoom &middot; tap a belief to read it</div>' +
      '<div class="map-panzoom"><svg class="map-svg"></svg><div class="map-boxes"></div></div>' +
      '<aside class="map-panel" role="region" hidden><div class="mp-head"><div class="mp-title"></div>' +
      '<button type="button" class="mp-close" aria-label="Close">&times;</button></div><div class="mp-body"></div></aside>';
    this.wrap = container;
    this.panzoomEl = container.querySelector('.map-panzoom');
    this.svgEl = container.querySelector('.map-svg');
    this.boxesEl = container.querySelector('.map-boxes');
    this.panel = container.querySelector('.map-panel');
    this.panelTitle = container.querySelector('.mp-title');
    this.panelBody = container.querySelector('.mp-body');
    container.querySelector('.map-reset').addEventListener('click', () => { this.needsCenter = true; this.redraw(); });

    this._bindClicks();
    this._bindPanZoom();
    this._bindKeyboard();
    this._bindPanel();
    // A redraw while the map is hidden measures every box as 0x0 and lays the
    // whole tree on top of itself at the origin. It self-heals on the next
    // visible redraw, so it was never visible -- it was just a full layout pass
    // thrown away on every resize, in whichever view was showing.
    //
    // offsetParent is null when the element or an ancestor is display:none,
    // which is how both consumers hide the map: the generated page takes
    // .active off #mapwrap, the editor sets display:none on the tab pane above
    // its container. It is ALSO null for a position:fixed element, for <body>,
    // and for a detached node -- none of which either wrap is. Give the map a
    // fixed-position wrap and this guard turns into "never redraw on resize",
    // silently; test it rather than assuming.
    window.addEventListener('resize', () => {
      if (this.wrap.offsetParent === null) return;
      this.redraw();
    });
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
      const isOpen = !this.mapManualCollapsed.has(id) || this.forceOpen(domain);
      const side = nextSide();
      const dom = { id, type: 'domain', title: domain.name, depth: 1, side, total: members.length, children: [] };
      if (isOpen) {
        dom.children = members.map(n => this._leafBox(n, 2, side));
        if (!this.readonly) {
          dom.children.push({ id: 'addnode:' + domain.name, type: 'addnode', title: '+ New node', depth: 2, side, domainName: domain.name, children: [] });
        }
      }
      root.children.push(dom);
    });
    if (!this.readonly) {
      root.children.push({ id: 'adddomain', type: 'adddomain', title: '+ New domain', depth: 1, side: nextSide(), children: [] });
    }
    return root;
  };

  MapView.prototype._leafBox = function (n, depth, side) {
    return { id: stableLeafId(n), type: 'leaf', title: n.title, depth, side, node: n, children: [] };
  };

  function flatten(tree, acc) {
    acc.push(tree);
    tree.children.forEach(c => flatten(c, acc));
    return acc;
  }

  MapView.prototype._mboxHTML = function (box) {
    const esc = this.escapeHtml;
    if (box.type === 'root') {
      return `<div class="mbox mbox-root" data-id="${esc(box.id)}">${esc(box.title)}</div>`;
    }
    if (box.type === 'domain') {
      const openState = box.children.length > 0;
      const chev = box.total ? '<span class="mchev">&#9656;</span>' : '';
      // The read-only map has nothing to rename, so it emits the bare chevron
      // the generated page has always emitted rather than an actions wrapper
      // holding a button it would never show.
      const actions = this.readonly ? chev
        : `<span class="mtitle-actions"><button type="button" class="mdomain-edit" data-domain="${esc(box.title)}" title="Rename domain">&#9998;</button>${chev}</span>`;
      return `<div class="mbox mbox-domain${openState ? ' mopen' : ''}" data-id="${esc(box.id)}" tabindex="0">
        <div class="mtitle"><b>${esc(box.title)}</b>${actions}</div>
        <div class="mmeta"><span class="mcount">${box.total} node${box.total === 1 ? '' : 's'}</span></div>
      </div>`;
    }
    if (box.type === 'addnode' || box.type === 'adddomain') {
      return `<div class="mbox mbox-add" data-id="${esc(box.id)}">+ ${box.type === 'addnode' ? 'New node' : 'New domain'}</div>`;
    }
    // Every leaf is a string now, in both consumers: render.py supplies its own
    // (a read-only tile carrying the `assumed` class), the editor takes the
    // default. The id is handed over because _bindClicks keys on data-id: a
    // leaf that labelled itself with its slug would select a key the view does
    // not hold.
    return this.leafHTML ? this.leafHTML(box.node, box.id) : this._leafTileHTML(box.node, box.id);
  };

  MapView.prototype._chipsHTML = function (n) {
    const esc = this.escapeHtml;
    const tier = n.tier ? this.tierMeta[n.tier] : null;
    return (tier ? `<span class="chip tier" style="background:${tier[1]}">${esc(n.tier)}</span>` : '') +
      (n.confidence && this.confMeta[n.confidence] ? `<span class="chip">${esc(n.confidence)}</span>` : '') +
      (n.flags.includes('study') ? '<span class="chip">study</span>' : '');
  };

  // Every leaf is a closed tile -- title and chips -- in both consumers. Its
  // detail lives in .map-panel, so a tile never changes size on a click and
  // never holds a focusable control a redraw could clobber.
  MapView.prototype._leafTileHTML = function (n, id) {
    const esc = this.escapeHtml;
    const tier = n.tier ? this.tierMeta[n.tier] : null;
    return `<div class="mbox mbox-leaf" data-id="${esc(id)}" tabindex="0" style="--tier:${tier ? tier[1] : 'var(--line)'}">` +
      `<div class="mtitle"><b>${esc(n.title)}</b></div><div class="mmeta">${this._chipsHTML(n)}</div></div>`;
  };

  MapView.prototype._leafHeaderEditable = function (n) {
    const core = window.EditorCore;
    const self = this;
    const wrap = document.createElement('div');
    wrap.className = 'mtitle';
    const title = document.createElement('input');
    title.type = 'text'; title.value = n.title; title.className = 'mtitle-input';
    title.setAttribute('aria-label', 'Belief');
    // redraw() so the closed tile shows the new title; the panel itself is
    // never rebuilt by a redraw, so this input keeps focus and caret.
    title.addEventListener('input', () => { n.title = title.value; n.slug = core.slugify(title.value); self.onFieldChange(n); self.redraw(); });
    wrap.appendChild(title);
    return wrap;
  };

  MapView.prototype._leafDetail = function (n) {
    const core = window.EditorCore;
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
      ta.addEventListener('input', () => { onInput(ta.value); self.onFieldChange(n); autosize(ta); });
      row.appendChild(ta);
      autosize(ta);
      return row;
    }
    function autosize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

    // Tier and Confidence as radio-chip groups, matching web/wizard.js's
    // .wz-radios: real <input type=radio> visually restyled, so arrow-key
    // operation and the radiogroup semantics come from the platform rather
    // than from us. The group name is keyed on this tile's own stable leaf id,
    // so a group never outlives or collides with another belief's.
    function radios(labelText, values, value, glossOf, ramp, onPick) {
      const cell = document.createElement('div');
      const lab = document.createElement('p');
      lab.className = 'mlab';
      lab.textContent = labelText;
      cell.appendChild(lab);
      const group = document.createElement('div');
      group.className = 'mradios';
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', labelText);
      const name = labelText.toLowerCase() + '-' + stableLeafId(n);
      const items = [];
      const paint = () => {
        if (!ramp) return;
        items.forEach(it => {
          const meta = it.input.checked ? self.tierMeta[it.v] : null;
          it.span.style.background = meta ? meta[1] : '';
          it.span.style.color = meta ? '#fff' : '';
          it.span.style.borderColor = meta ? 'transparent' : '';
        });
      };
      values.forEach(v => {
        const item = document.createElement('label');
        item.className = 'mradio';
        item.title = glossOf(v) || '';
        const input = document.createElement('input');
        input.type = 'radio'; input.name = name; input.value = v;
        if (v === value) input.checked = true;
        const span = document.createElement('span');
        span.textContent = v;
        input.addEventListener('change', () => { paint(); onPick(v); });
        item.appendChild(input);
        item.appendChild(span);
        items.push({ input, span, v });
        group.appendChild(item);
      });
      paint();
      cell.appendChild(group);
      return cell;
    }

    // Promoted: the one field that makes a belief worth having, then the two
    // classifications and the flag. Everything else sits behind the disclosure.
    wrap.appendChild(field('What I hold', n.hold, v => { n.hold = v; }));

    const controls = document.createElement('div');
    controls.className = 'mcontrols';
    // The gloss each chip shows on hover is already in the meta the consumer
    // passed in: tierMeta is [gloss, colour], confMeta is [percent, gloss].
    // They used to be hand-copied from render.py's TIER_META / CONF_META here.
    controls.appendChild(radios('Tier', core.TIERS, n.tier, v => (self.tierMeta[v] || [])[0], true,
      v => { n.tier = v; self.onFieldChange(n); self.redraw(); }));
    controls.appendChild(radios('Confidence', core.CONFIDENCES, n.confidence, v => (self.confMeta[v] || [])[1], false,
      v => { n.confidence = v; self.onFieldChange(n); self.redraw(); }));
    wrap.appendChild(controls);

    [['study', '#study — I still need to work this out']].forEach(([flag, label]) => {
      const lab = document.createElement('label');
      lab.className = 'mcheck';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = n.flags.includes(flag);
      cb.addEventListener('change', () => {
        n.flags = cb.checked ? [...new Set([...n.flags, flag])] : n.flags.filter(f => f !== flag);
        self.onFieldChange(n);
        self.redraw();   // the tile shows a study chip
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(label));
      wrap.appendChild(lab);
    });

    const opt = document.createElement('details');
    opt.className = 'optional';
    const sum = document.createElement('summary');
    sum.textContent = "Optional — why, what I'd reject, texts, related";
    opt.appendChild(sum);

    opt.appendChild(field('Why', n.why, v => { n.why = v; }));
    opt.appendChild(field("What I'd reject", n.vs, v => { n.vs = v; }));
    opt.appendChild(field('Still working out', n.todo, v => { n.todo = v; }));

    const refsRow = document.createElement('div');
    refsRow.className = 'mfield';
    const refsLabel = document.createElement('label');
    refsLabel.textContent = 'Texts';
    refsRow.appendChild(refsLabel);
    const refsInput = document.createElement('input');
    refsInput.type = 'text'; refsInput.value = n.refs || '';
    refsInput.placeholder = 'e.g. 2 Tim 3:16-17; Heb 1:1-2';
    refsInput.addEventListener('input', () => { n.refs = refsInput.value; self.onFieldChange(n); });
    refsRow.appendChild(refsInput);
    opt.appendChild(refsRow);

    // Related keeps shared-fields.js's tag-chip widget -- the one shared with
    // the List form -- it has simply moved behind the disclosure.
    opt.appendChild(window.SharedFields.renderLinkField(n, self.getAllSlugs(), () => self.onFieldChange(n)));

    // Existing content is never hidden behind a disclosure someone has to find.
    opt.open = !!(n.why || n.vs || n.todo || n.refs || (n.link && n.link.length));
    wrap.appendChild(opt);

    const del = document.createElement('button');
    del.type = 'button'; del.className = 'danger mdelete';
    del.textContent = 'Delete this belief';
    del.addEventListener('click', () => { self.onDeleteNode(n); });
    wrap.appendChild(del);

    return wrap;
  };

  MapView.prototype.redraw = function () {
    const self = this;
    const tree = this._buildTree();
    const list = flatten(tree, []);
    const liveIds = new Set(list.map(b => b.id));

    for (const [id, el] of [...this.mapEls.entries()]) {
      if (!liveIds.has(id)) { el.remove(); this.mapEls.delete(id); }
    }
    // A live search or a collapsed area can take the selected tile off the map;
    // a panel describing a belief nobody can see is worse than no panel.
    if (this.selectedId && !liveIds.has(this.selectedId)) this._clearSelection();
    list.forEach(box => {
      let el = this.mapEls.get(box.id);
      if (!el) {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._mboxHTML(box);
        el = tmp.firstElementChild;
        // Settle only the one leaf _activate's addnode branch just created --
        // every other fresh mount (initial page load, a cleared search filter
        // revealing previously-excluded boxes) must stay motionless, per the
        // "no motion on first paint" rule.
        if (box.id === this._pendingEnterId) el.classList.add('mbox-enter');
        this.boxesEl.appendChild(el);
        this.mapEls.set(box.id, el);
      } else {
        const tmp = document.createElement('div');
        tmp.innerHTML = this._mboxHTML(box);
        const fresh = tmp.firstElementChild;
        el.className = fresh.className;
        el.innerHTML = fresh.innerHTML;
        // An editor tile's --tier follows a tier change made in the panel.
        el.style.cssText = fresh.style.cssText;
      }
      el.classList.toggle('msel', box.id === this.selectedId);
      box.el = el;
    });
    // Single-use: cleared whether or not it matched a box this pass, so a
    // later redraw (resize, another toggle) never re-applies mbox-enter.
    this._pendingEnterId = null;

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
    // Leaf edges carry the child's tier at low opacity so the ramp reads as
    // structure -- zooming out shows warm edges clustering on one side of
    // the map and cool on the other. Domain edges stay --line (the CSS
    // rule), since the triage shape is a leaf-level signal.
    function edges(box) {
      box.children.forEach(c => {
        const y1 = box.y + box.h / 2, y2 = c.y + c.h / 2;
        let x1, x2;
        if (c.side === 1) { x1 = box.x + box.w; x2 = c.x; }
        else { x1 = box.x; x2 = c.x + c.w; }
        const mx = (x1 + x2) / 2;
        const edgeClass = c.depth === 1 ? 'edge-domain' : 'edge-leaf';
        let style = '';
        if (c.type === 'leaf' && c.id === self.selectedId) {
          style = ' style="stroke:var(--ink);opacity:1"';
        } else if (c.type === 'leaf') {
          const tier = c.node.tier ? self.tierMeta[c.node.tier] : null;
          style = ` style="stroke:${tier ? tier[1] : 'var(--line)'};opacity:.45"`;
        }
        paths += `<path class="${edgeClass}"${style} d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"></path>`;
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
    // Boxes carry .children but no back-reference to their parent. Stashing
    // the flat list here (rather than a separate parent-map nothing else
    // needs) lets the keyboard handler look a box up by id, and find its
    // parent by walking the list for whoever's .children holds it, without
    // rebuilding the tree.
    this._lastList = list;
    this._applyPanZoom();
  };

  // ---------------------------------------------------------- selection
  // select(node) takes the node object, not an id: leaf ids are a private
  // per-node token, so a consumer that knows a slug looks the node up itself
  // and hands it over. Returns false when the node is not on the map as drawn
  // (a live search hides it) -- the caller decides what to do instead.
  MapView.prototype.select = function (node) {
    const domain = this.getDomains().find(d => d.nodes.indexOf(node) !== -1);
    if (!domain) return false;
    if (!this.mapManualCollapsed) this.mapManualCollapsed = new Set(this._domainIds());
    this.mapManualCollapsed.delete('domain:' + domain.name);
    this._select(stableLeafId(node), node);
    return true;
  };

  MapView.prototype.deselect = function () { this._deselect(false); };

  // Rebuild the panel from the node as it is now -- for a consumer whose other
  // surface (the editor's List tab) may have edited it while the map was hidden.
  MapView.prototype.refreshPanel = function () { this._renderPanel(); };

  MapView.prototype._select = function (id, node) {
    // A Related link inside the panel selects another belief, which rebuilds
    // the panel and destroys the focused link -- focus would fall to <body>,
    // outside this map's Escape and arrow-key handlers. Land it on the newly
    // selected tile instead.
    const focusWasInPanel = this.panel.contains(document.activeElement);
    this.selectedId = id; this.selectedNode = node;
    this.redraw();
    this._renderPanel();
    this._reveal();
    const el = focusWasInPanel && this.mapEls.get(id);
    if (el) el.focus({ preventScroll: true });
  };

  MapView.prototype._deselect = function (returnFocus) {
    const id = this.selectedId;
    if (!id) return;
    this._clearSelection();
    this.redraw();
    const el = returnFocus && this.mapEls.get(id);
    if (el) el.focus({ preventScroll: true });
  };

  MapView.prototype._clearSelection = function () {
    this.selectedId = null; this.selectedNode = null;
    this._renderPanel();
  };

  // Built on selection change only, never from redraw(): a redraw (a resize, a
  // tier change re-sorting tiles) must not clobber a focused field's caret.
  MapView.prototype._renderPanel = function () {
    const n = this.selectedNode;
    this.panel.hidden = !n;
    this.container.classList.toggle('has-panel', !!n);
    this.panelTitle.innerHTML = '';
    this.panelBody.innerHTML = '';
    if (!n) return;
    this.panel.setAttribute('aria-label', n.title || 'Belief');
    if (this.readonly) {
      this.panelTitle.innerHTML = `<b>${this.escapeHtml(n.title)}</b><div class="mmeta">${this._chipsHTML(n)}</div>`;
      this.panelBody.innerHTML = this.panelHTML ? this.panelHTML(n) : '';
    } else {
      this.panelTitle.appendChild(this._leafHeaderEditable(n));
      this.panelBody.appendChild(this._leafDetail(n));
    }
    this.panel.scrollTop = 0;
  };

  // Pan (never zoom) the least distance that puts the selected tile inside the
  // part of the map the panel does not cover. Uses the layout numbers, not the
  // tile's DOM rect, because .mbox transitions its transform for 280ms.
  MapView.prototype._reveal = function () {
    const box = (this._lastList || []).find(b => b.id === this.selectedId);
    if (!box) return;
    const w = this.wrap.getBoundingClientRect();
    const view = { left: 0, top: 0, right: w.width, bottom: w.height };
    if (!this.panel.hidden) {
      const p = this.panel.getBoundingClientRect();
      // Docking is CSS's decision (side panel or bottom sheet); read it back
      // rather than re-deciding it here from the window width.
      if (p.left > w.left + 1) view.right = p.left - w.left; else view.bottom = p.top - w.top;
    }
    const z = this.zoom;
    const d = revealPan({ x: this.panX + box.x * z, y: this.panY + box.y * z, w: box.w * z, h: box.h * z }, view, 16);
    if (!d.dx && !d.dy) return;
    this.panX += d.dx; this.panY += d.dy;
    this._applyPanZoom();
  };

  MapView.prototype._bindPanel = function () {
    this.panel.querySelector('.mp-close').addEventListener('click', () => this._deselect(true));
    this.container.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.selectedId) this._deselect(true);
    });
  };

  // Expand-all / collapse-all drive the map from the page's own buttons.
  // expandAll opens every AREA: only one belief is ever open now -- in the
  // panel -- so there is no "every belief" to open. `nodes` (the caller's full
  // node list) is still accepted so neither caller has to change.
  MapView.prototype.expandAll = function () {
    this.mapManualCollapsed = new Set();
    this.redraw();
  };

  MapView.prototype.collapseAll = function () {
    this._clearSelection();
    this.mapManualCollapsed = new Set(this._domainIds());
    this.redraw();
  };

  // Called after a node is deleted elsewhere (e.g. from the List tab, or the
  // shared confirm dialog) so the panel does not keep describing it.
  MapView.prototype.forgetNode = function (node) {
    if (this.selectedId === stableLeafId(node)) this._clearSelection();
  };

  MapView.prototype._applyPanZoom = function () {
    const t = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.panzoomEl.style.transform = t;
    this.panzoomEl.style.setProperty('--zoom', this.zoom);
    // The grid used to be painted on this.wrap, which never transforms, while
    // .map-panzoom scaled and translated inside it -- so panning slid tiles
    // across a stationary grid and zooming grew them over a fixed one.
    // Coupling backgroundSize/backgroundPosition to the same transform makes
    // the grid the surface: it moves with the drag and its cells grow with
    // zoom, rather than reading as a texture painted behind a scaled <div>.
    const g = 24 * this.zoom;
    this.wrap.style.backgroundSize = `${g}px ${g}px`;
    this.wrap.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
  };

  MapView.prototype._bindClicks = function () {
    const self = this;
    this.boxesEl.addEventListener('click', e => {
      const editBtn = e.target.closest('.mdomain-edit');
      if (editBtn) { self.onRenameDomain(editBtn.dataset.domain); return; }
      const box = e.target.closest('.mbox');
      if (box) self._activate(box.dataset.id, false);
    });
  };

  // One entry point for a click and for Enter/Space on a focused box.
  MapView.prototype._activate = function (id, viaKeyboard) {
    if (id === 'root') return;
    if (id.startsWith('domain:')) {
      if (this.mapManualCollapsed.has(id)) this.mapManualCollapsed.delete(id); else this.mapManualCollapsed.add(id);
      this.redraw();
      return;
    }
    if (id.startsWith('addnode:')) {
      const node = this.onAddNode(id.slice('addnode:'.length));
      if (!node) return;
      this._pendingEnterId = stableLeafId(node);
      this._select(stableLeafId(node), node);
      const input = this.panel.querySelector('.mtitle-input');
      if (input) { input.focus(); input.select(); }
      return;
    }
    if (id === 'adddomain') { this.onAddDomain(); this.redraw(); return; }
    if (id === this.selectedId) { this._deselect(viaKeyboard); return; }
    const box = (this._lastList || []).find(b => b.id === id);
    if (!box || !box.node) return;
    this._select(id, box.node);
    // The panel follows every tile in DOM order; without this, Tab would walk
    // the whole map to reach it.
    if (viaKeyboard) this.panel.querySelector('.mp-close').focus();
  };

  function parentOf(list, box) {
    return list.find(b => b.children.indexOf(box) !== -1) || null;
  }

  // The pure half of arrow-key traversal: given the flat box list redraw()
  // stashes, the focused box's id, and an arrow key, return the box that
  // should receive focus (or null for a no-op). Exported so it is testable
  // under plain node -- _bindKeyboard is the DOM-touching half, and does
  // nothing but call this and .focus() the result.
  function traverseKey(list, currentId, key) {
    const current = list.find(b => b.id === currentId);
    if (!current) return null;

    if (key === 'ArrowRight') return current.children[0] || null;

    if (key === 'ArrowLeft') {
      const parent = parentOf(list, current);
      // The root box carries no tabindex, so there's nothing to focus when
      // a top-level domain's "parent" is the root.
      return (parent && parent.type !== 'root') ? parent : null;
    }

    const parent = parentOf(list, current);
    if (!parent) return null;
    const i = parent.children.indexOf(current);
    const j = key === 'ArrowDown' ? i + 1 : i - 1;
    return (j >= 0 && j < parent.children.length) ? parent.children[j] : null;
  }

  // The pure half of "reveal the selected tile": how far to pan so a tile sits
  // inside the visible part of the map -- the wrap minus whatever the detail
  // panel covers -- with `margin` to spare. Pans the least distance; a tile too
  // big to fit aligns its top-left, since that is where its title is.
  function revealAxis(pos, size, lo, hi, m) {
    if (size > hi - lo - 2 * m) return lo + m - pos;
    if (pos < lo + m) return lo + m - pos;
    if (pos + size > hi - m) return hi - m - (pos + size);
    return 0;
  }
  function revealPan(tile, view, margin) {
    return {
      dx: revealAxis(tile.x, tile.w, view.left, view.right, margin),
      dy: revealAxis(tile.y, tile.h, view.top, view.bottom, margin),
    };
  }

  // Arrow-key traversal moves focus only -- it never opens/closes a tile or
  // triggers a click, so it never calls redraw(). Delegated on boxesEl like
  // _bindClicks, keyed off the same data-id, but reading this._lastList
  // (stashed by redraw) rather than the DOM to find parent/siblings.
  MapView.prototype._bindKeyboard = function () {
    const self = this;
    const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    this.boxesEl.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('mbox')) {
        e.preventDefault();
        self._activate(e.target.dataset.id, true);
        return;
      }
      if (ARROWS.indexOf(e.key) === -1) return;
      const boxEl = e.target.closest('.mbox');
      if (!boxEl) return;
      // mirrors the control exemption in _bindClicks above, narrowed to what
      // arrow keys mean something to natively
      if (e.target.closest('input, select, textarea')) return;
      e.preventDefault();

      const target = traverseKey(self._lastList || [], boxEl.dataset.id, e.key);
      if (!target) return;
      const el = self.mapEls.get(target.id);
      if (el) el.focus({ preventScroll: true });
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
      if (e.target.closest('.mbox, .mapcontrols, .map-panel')) return;
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
      // Inside the panel a wheel scrolls the panel, natively.
      if (e.target.closest('.map-panel')) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      if (Math.min(2.5, Math.max(0.3, self.zoom + delta)) === self.zoom) return;
      const rect = wrap.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, self.zoom + delta);
      self._applyPanZoom();
    }, { passive: false });
  };

  MapView.groupByDomain = groupByDomain;
  MapView.traverseKey = traverseKey;
  MapView.revealPan = revealPan;

  return MapView;
});
