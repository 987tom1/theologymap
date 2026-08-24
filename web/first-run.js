/* web/first-run.js — the starting points, shown on /app while the map is empty.
   See docs/hosting/phase-3-design.md section 5.

   An ES module, not the IIFE the plan drafted: web/session.js exports named
   bindings and puts nothing on window, and every web/*.html page already loads
   its script with <script type="module">. Same correction session 7 made to
   web/chrome.js, for the same reason.

   EditorCore is the one exception — engine/editor-core.js is a UMD file shared
   with the offline editor, so index.html loads it as a classic script and it
   arrives on window. It is not re-implemented here; there is one serializer. */
import { apiFetch } from '/web/session.js';

// Phase 4 flipped this when /wizard shipped (session 10). Nothing else changed.
const WIZARD_ENABLED = true;

const STARTER_TITLE = 'My first belief';   // design section 14, Q3 — default taken
const STARTER_AREA = 'Beliefs';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function card({ heading, body, action, primary, onClick, href }) {
  const c = el(href ? 'a' : 'div', 'tm-card' + (primary ? ' tm-card-primary' : ''));
  if (href) { c.href = href; c.className += ' tm-cardlink'; }
  c.appendChild(el('h3', null, heading));
  c.appendChild(el('p', null, body));
  const go = el('span', 'tm-go', action + ' \u2192');
  c.appendChild(go);
  if (onClick) {
    c.classList.add('tm-cardlink');
    c.tabIndex = 0;
    c.setAttribute('role', 'button');
    c.addEventListener('click', onClick);
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
    });
  }
  return c;
}

/* ------------------------------------------------------ route 3: by hand */

async function startByHand(user, token, busy) {
  const core = window.EditorCore;
  const domains = [{ name: STARTER_AREA, nodes: [core.newNode(STARTER_TITLE, STARTER_AREA)] }];
  busy(true);
  try {
    // Save before redirecting: the row stops being empty, so first run does not
    // reappear on reload. Design section 5.2.
    await apiFetch('/api/map', {
      method: 'POST',
      body: { user_id: user.id, markdown: core.serialize(domains), expected_updated_at: token },
    });
    location.href = '/edit?open=' + encodeURIComponent(core.slugify(STARTER_TITLE));
  } catch {
    busy(false);   // apiFetch already showed the banner.
  }
}

/* --------------------------------------- route 2: start from someone else */

async function openPicker(user, busy) {
  const dlg = el('dialog', 'tm-picker');
  dlg.appendChild(el('h2', null, "Start from someone else's map"));
  dlg.appendChild(el('p', 'tm-note',
    'You get your own copy to change however you like. Their map is not affected, '
    + "and your card says whose it was until you edit it."));
  const grid = el('div', 'tm-grid');
  dlg.appendChild(grid);
  const close = el('button', null, 'Cancel');
  close.addEventListener('click', () => dlg.close());
  dlg.appendChild(close);
  document.body.appendChild(dlg);
  dlg.showModal();

  let maps;
  try {
    maps = await apiFetch('/api/gallery');
  } catch {
    dlg.close();
    return;
  }
  maps = (maps || []).filter(m => m.node_count > 0 && m.name !== user.name);
  if (!maps.length) {
    grid.appendChild(el('p', 'tm-stat', 'No maps to start from yet. Try one of the other two.'));
    return;
  }
  for (const m of maps) {
    const c = el('div', 'tm-card');
    c.appendChild(el('h3', null, m.name));
    c.appendChild(el('p', null,
      m.node_count + ' belief' + (m.node_count === 1 ? '' : 's')
      + ' \u00b7 ' + m.open_count + ' open question' + (m.open_count === 1 ? '' : 's')));
    const btn = el('button', null, 'Start from this map');
    btn.addEventListener('click', async () => {
      busy(true);
      try {
        await apiFetch('/api/map', {
          method: 'POST',
          body: { action: 'copy_from', user_id: user.id, source_name: m.name },
        });
        // Land on the map-home hub, not straight into the editor — same
        // reasoning as the wizard's Finish button: this just produced a map,
        // and the hub's View/Open-editor pair is the next-step choice.
        location.href = '/app';
      } catch {
        busy(false);
        dlg.close();
      }
    });
    c.appendChild(btn);
    grid.appendChild(c);
  }
}

/* ------------------------------------------------------------- the screen */

export function mountFirstRun(host, user, token) {
  host.textContent = '';
  const intro = el('div', 'tm-prose');
  intro.appendChild(el('p', null,
    'A theology map is your own beliefs, written down, sorted by how much weight '
    + 'each one carries. Nobody sees a draft until you are ready.'));
  intro.appendChild(el('p', 'tm-lead', 'Three ways to start:'));
  host.appendChild(intro);

  // One flag, checked by both card handlers. Two clicks on "Write my first
  // belief" would otherwise race two saves against the same concurrency token
  // and the second would come back 409.
  let working = false;
  const busy = (state) => {
    working = state;
    host.setAttribute('aria-busy', state ? 'true' : 'false');
    host.classList.toggle('tm-working', state);
  };

  const grid = el('div', 'tm-grid tm-firstrun');
  if (WIZARD_ENABLED) {
    const wizard = card({
      heading: 'Answer some questions',
      body: 'Twenty minutes of questions and you have a first map you can edit. '
          + 'Nothing is added that you did not choose.',
      action: 'Start', primary: true, href: '/wizard',
    });
    wizard.classList.add('tm-span');
    grid.appendChild(wizard);
  }
  grid.appendChild(card({
    heading: "Start from someone else's map",
    body: 'Take a copy of a map from the gallery and make it yours. It says whose '
        + 'it was until you start editing.',
    action: 'Browse maps',
    onClick: () => { if (!working) openPicker(user, busy); },
  }));
  grid.appendChild(card({
    heading: 'Add a belief by hand',
    body: 'Write one thing you hold and build from there. Good if you already know '
        + 'where to start.',
    action: 'Write my first belief',
    onClick: () => { if (!working) startByHand(user, token, busy); },
  }));
  host.appendChild(grid);

  const after = el('p', 'tm-stat');
  after.appendChild(document.createTextNode('Or just '));
  const g = el('a', null, 'look around the gallery');
  g.href = '/gallery';
  after.appendChild(g);
  after.appendChild(document.createTextNode(' first.'));
  host.appendChild(after);
}

export { WIZARD_ENABLED };
