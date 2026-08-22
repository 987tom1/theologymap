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
    label.textContent = 'Related';
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
    hint.textContent = 'Must match another belief\'s slug exactly, or render.py will warn about a broken link.';
    row.appendChild(hint);

    let list = document.getElementById('slugList');
    if (!list) { list = document.createElement('datalist'); list.id = 'slugList'; document.body.appendChild(list); }
    list.innerHTML = allSlugs.map(s => '<option value="' + escapeHtml(s) + '">').join('');

    return row;
  }

  return { renderLinkField };
});
