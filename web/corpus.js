/* web/corpus.js — one way to load the wizard corpus in the browser, and one
   copy of the stance vocabulary.

   Phase 4 put both inside web/wizard.js because it was the only page that
   needed them. Phase 6 added two more (/learn and /compare), and three copies
   of a fetch loop over content/wizard/ is exactly the duplication the plan's
   Task 4 Step 3 told this phase to avoid. Nothing here is model logic —
   ordering, node building and "is this answered" still live in
   engine/wizard-generate.js, which is pure and tested from Node. */
import { showError } from '/web/session.js';

/* The stance vocabulary in plain English, in ONE place. phase-4-design.md
   section 4.4 defines the five; the wizard and the learn page both read it. */
export const STANCE_TEXT = {
  confessional: 'defined in its confessions',
  majority: 'the majority view in practice',
  permitted: 'one of several views its formularies allow',
  minority: 'a minority stream within it',
  historic: 'held historically, less common now',
};

/* Returns { manifest, traditions, domains } — the shape
   engine/wizard-generate.js and engine/compare-core.js both consume as
   `corpus` — or null, having already shown the reader an error. */
export async function loadCorpus() {
  const get = async (path) => {
    const res = await fetch('/content/wizard/' + path);
    return res.ok ? res.json() : null;
  };
  const manifest = await get('manifest.json');
  const registry = await get('traditions.json');
  if (!manifest || !registry) {
    showError('The question set could not be loaded. Please try again shortly.');
    return null;
  }
  // Phase 5 wrote all fourteen domain files, so on a hosted origin a missing
  // one means a broken deploy, not an unwritten domain — error it. file://
  // has no server behind it and no deploy to break, so stay tolerant there.
  const tolerant = typeof location !== 'undefined' && location.protocol === 'file:';
  const results = await Promise.all((manifest.domains || []).map((entry) => get(entry.file)));
  const files = {};
  const missing = [];
  (manifest.domains || []).forEach((entry, i) => {
    if (results[i]) files[entry.id] = results[i]; else missing.push(entry.id);
  });
  if (missing.length) {
    if (tolerant) {
      console.info('corpus: ' + missing.length + ' domain file(s) not found; skipped.');
    } else {
      showError('The question set could not be loaded. Please try again shortly.');
      return null;
    }
  }
  return { manifest, traditions: registry, domains: files };
}

/* The generated tradition maps' provenance file. Carries display_name, file,
   node_count and skipped per tradition — so a coverage floor can be applied
   without reloading and re-deriving anything. */
export async function loadTraditionManifest() {
  const res = await fetch('/content/traditions/manifest.json');
  return res.ok ? res.json() : null;
}
