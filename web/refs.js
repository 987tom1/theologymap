// web/refs.js — turn a corpus citation into a followable URL.
//
// The wizard corpus cites confessions, catechisms, councils and books, and
// most of those citations carry no URL at all. Hand-curating one per
// citation (1600+) is out of scope, so this is a small curated table of the
// works that actually recur across the corpus, plus a search-URL fallback
// for everything else. citationUrl() always returns a usable https URL.
//
// Every curated base URL below was verified live with curl before being
// added (see the task report) — a dead link is worse than plain text here.
//
// This file stays DOM-free and importable under plain Node (tests/refs.test.js
// requires it directly), so citeLink/sourceLine below take `el` as a
// parameter rather than importing it from web/chrome.js.

const CURATED = [
  { aliases: ['catechism of the catholic church', 'catechism of catholic church', 'ccc'],
    url: 'https://www.vatican.va/archive/ENG0015/_INDEX.HTM' },
  { aliases: ['westminster confession'],
    url: 'https://opc.org/confessions.html' },
  { aliases: ['assemblies of god', 'statement of fundamental truths'],
    url: 'https://web.archive.org/web/20230328145850/https://ag.org/Beliefs/Statement-of-Fundamental-Truths' },
  { aliases: ['baptist faith and message'],
    url: 'https://bfm.sbc.net/bfm2000/' },
  { aliases: ['dordrecht confession'],
    url: 'https://en.wikisource.org/wiki/Dordrecht_Confession_of_Faith' },
  { aliases: ['augsburg confession'],
    url: 'https://bookofconcord.org/augsburg-confession/' },
  { aliases: ['thirty-nine articles', '39 articles', 'articles of religion'],
    url: 'https://www.churchofengland.org/prayer-and-worship/worship-texts-and-resources/book-common-prayer/articles-religion' },
  { aliases: ['second london baptist confession', 'london baptist confession', '1689 baptist confession'],
    url: 'https://www.the1689confession.com/1689/' },
  { aliases: ['formula of concord'],
    url: 'https://bookofconcord.org/formula-of-concord-epitome/' },
  { aliases: ['confession of dositheus', 'dositheus'],
    url: 'https://www.crivoice.org/creeddositheus.html' },
  { aliases: ['council of trent'],
    url: 'https://www.ewtn.com/catholicism/library/council-of-trent-2418' },
  { aliases: ['canons of dordt', 'canons of dort'],
    url: 'https://www.crcna.org/welcome/beliefs/confessions/canons-dort' },
  { aliases: ['lausanne covenant'],
    url: 'https://lausanne.org/statement/lausanne-covenant' },
  { aliases: ['nicene-constantinopolitan creed', 'nicene constantinopolitan creed', 'nicene creed'],
    url: 'https://www.ccel.org/creeds/nicene.creed.html' },
  { aliases: ['chalcedonian definition', 'definition of chalcedon', 'chalcedon'],
    url: 'https://www.newadvent.org/fathers/3811.htm' },
  { aliases: ['book of common prayer'],
    url: 'https://www.churchofengland.org/prayer-and-worship/worship-texts-and-resources/book-common-prayer' },
  { aliases: ['summa theologiae', 'summa theologica'],
    url: 'https://www.newadvent.org/summa/' },
  { aliases: ['lumen gentium'],
    url: 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html' },
  { aliases: ['nostra aetate'],
    url: 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651028_nostra-aetate_en.html' },
  { aliases: ['confession of faith in a mennonite perspective'],
    url: 'https://www.mennoniteusa.org/what-we-believe/confession-of-faith/' },
  { aliases: ['national association of evangelicals', 'nae'],
    url: 'https://www.nae.org/statement-of-faith/' },
];

// Lowercase, collapse whitespace, strip one leading "The ".
function normalise(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^\s*the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// No label? The work's name is the leading words of the citation, i.e.
// everything before its first digit or its first comma — "Augsburg
// Confession, Art. IV" -> "Augsburg Confession"; "Catechism of the Catholic
// Church 253-256" -> "Catechism of the Catholic Church".
function deriveWork(label, citation) {
  if (label) return label;
  const m = String(citation || '').match(/^[^,0-9]+/);
  return m ? m[0] : (citation || '');
}

export function citationUrl(label, citation) {
  const work = normalise(deriveWork(label, citation));
  if (work) {
    for (const entry of CURATED) {
      if (entry.aliases.some(a => work.includes(a))) return entry.url;
    }
  }
  return 'https://www.google.com/search?q=' + encodeURIComponent(`${label || ''} ${citation || ''}`.trim());
}

// citeLink/sourceLine — shared by web/wizard.js and web/learn.js, which used
// to carry byte-for-byte copies differing only in hint class name and (on the
// wizard's side) an onFollow callback for its commit-on-click behaviour.
//
// Every citation on these pages is a link. A real `url` wins; citationUrl()
// supplies one for everything else.
export function citeLink(el, text, label, citation, url, onFollow) {
  // .cite-link (engine/theme.css) is what makes this read as a link rather
  // than plain prose inside .wz-hint/.wz-explain/.wz-pop/.who/.lp-prose/etc.
  const a = el('a', 'cite-link', text);
  a.href = url || citationUrl(label, citation || '');
  // A new tab, always: reading a confession is a detour, not an exit.
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  if (onFollow) a.addEventListener('click', onFollow);
  return a;
}

export function sourceLine(el, hintClass, src, onFollow) {
  const p = el('p', hintClass);
  const label = src.label + (src.citation ? ' — ' + src.citation : '');
  p.appendChild(citeLink(el, label, src.label, src.citation, src.url, onFollow));
  return p;
}
