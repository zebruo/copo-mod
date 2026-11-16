// Contrôle des traductions anglaises (src/i18n/en.json) par rapport au code (src/).
//
//   node outils/i18n.js            résumé
//   node outils/i18n.js --detail   liste chaque texte concerné, avec son fichier et sa ligne
//   node outils/i18n.js --strict   code de sortie 1 s'il reste des textes non traduits
//
// Un texte est « non traduit » s'il resterait en français dans l'interface anglaise : la traduction est
// calculée avec le même algorithme que tr() dans COPO (traduction exacte, sinon remplacement des morceaux
// connus). Sont examinés : les textes passés à tr() et trf() dans le code, et les textes de la page
// (contenu des éléments, attributs title, aria-label et placeholder), traduits automatiquement par COPO.
// Une traduction est « probablement inutilisée » si son texte français n'apparaît nulle part dans src/
// (elle peut néanmoins servir à un texte construit par morceaux : à vérifier avant de la supprimer).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { SRC, lire, fichiersNumerotes } = require('./commun');

const dico = JSON.parse(lire(path.join(SRC, 'i18n', 'en.json')));

// ---------------------------------------------------------------- tr() de COPO, en anglais (voir trBuild et tr)
const LETTRE = '[A-Za-zÀ-ÿŒœ]', estLettre = c => /[A-Za-zÀ-ÿŒœ]/.test(c), esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cles = Object.keys(dico).filter(k => k.length >= 3 && /[A-Za-zÀ-ÿ]{2}/.test(k)).sort((a, b) => b.length - a.length);
const trRe = new RegExp(cles.map(k => (estLettre(k[0]) ? '(?<!' + LETTRE + ')' : '') + esc(k) + (estLettre(k.at(-1)) ? '(?!' + LETTRE + ')' : '')).join('|'), 'g');
const normal = s => s.replace(/\s+/g, ' ').trim();
function traduire(s) {
  const n = normal(s);
  if (dico[n] !== undefined) return dico[n];
  // comme tr() : morceaux connus remplacés, puis guillemets et ponctuation à l'anglaise
  return n.replace(trRe, m => dico[m] ?? m).replace(/[«“]\s+/g, '“').replace(/\s+[»”]/g, '”')
    .replace(/[   ]([:;!?])(?=\s|$)/g, '$1');
}
// un texte « à traduire » : au moins deux lettres qui se suivent (comme tr), hors noms de variables {n}
const aTraduire = s => /[A-Za-zÀ-ÿ]{2}/.test(s.replace(/\{\w+\}/g, ''));
// vocabulaire anglais : tous les mots des traductions existantes. « Machine », « Relief », « Rotation »
// s'écrivent pareil dans les deux langues : un texte fait uniquement de ces mots n'est pas un oubli.
const MOT = /[A-Za-zÀ-ÿŒœ]+(?:[’'][A-Za-zÀ-ÿŒœ]+)*/g;
const anglais = new Set(Object.values(dico).flatMap(v => v.match(MOT) || []).map(m => m.toLowerCase()));
// reste en français : la traduction ne change rien, et il contient un mot (3 lettres ou plus) absent de l'anglais
const resteFrancais = s => {
  const sans = s.replace(/\{\w+\}/g, '');
  if (!aTraduire(s) || traduire(s) !== normal(s)) return false;
  return (sans.match(MOT) || []).some(m => m.length >= 3 && !anglais.has(m.toLowerCase()));
};

// ---------------------------------------------------------------- sources
const fichiers = [path.join(SRC, 'page.html'),
  ...fichiersNumerotes(path.join(SRC, 'js'), 'js'),
  ...fs.readdirSync(path.join(SRC, 'donnees')).sort().map(f => path.join(SRC, 'donnees', f))];
const sources = fichiers.map(f => ({ f: path.relative(path.dirname(SRC), f).replace(/\\/g, '/'), t: lire(f) }));
const ligneDe = (t, i) => t.slice(0, i).split('\n').length;

// ---------------------------------------------------------------- 1. textes passés à tr() / trf() dans le code
const unescapeJs = s => s.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})|\\(.)/gi, (m, a, b, c, d) => {
  if (a || b || c) return String.fromCodePoint(Number.parseInt(a || b || c, 16));
  return { n: '\n', t: '\t', r: '\r' }[d] ?? d;
});
const APPEL = /\btrf?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*[,)]/g;
const nonTraduitsCode = [];
for (const { f, t } of sources.filter(s => s.f.endsWith('.js'))) {
  for (const m of t.matchAll(APPEL)) {
    if (m[1] === '`' && m[2].includes('${')) continue; // gabarit calculé : impossible à vérifier ici
    const s = unescapeJs(m[2]);
    if (resteFrancais(s)) nonTraduitsCode.push({ f, l: ligneDe(t, m.index), s: normal(s) });
  }
}

// ---------------------------------------------------------------- 2. textes de la page (traduits automatiquement)
const entites = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()] ?? m;
});
const nonTraduitsPage = [];
{
  const { f, t } = sources[0];
  // on blanchit scripts, styles et commentaires en gardant leur longueur (numéros de ligne justes)
  const blanc = m => m.replace(/[^\n]/g, ' ');
  const html = t.replace(/<script\b[\s\S]*?<\/script>/gi, blanc).replace(/<style\b[\s\S]*?<\/style>/gi, blanc).replace(/<!--[\s\S]*?-->/g, blanc);
  const vus = new Set();
  const noter = (s, i) => {
    s = normal(entites(s));
    if (vus.has(s) || !resteFrancais(s)) return;
    vus.add(s);
    nonTraduitsPage.push({ f, l: ligneDe(t, i), s });
  };
  for (const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>([^<]*)/gi)) {
    if (/\bdata-(en|notr)\b/.test(m[2])) continue; // traduction fournie dans data-en, ou pas de traduction voulue
    for (const a of m[2].matchAll(/\s(title|aria-label|placeholder)="([^"]*)"/g)) noter(a[2], m.index);
    if (m[3].trim()) noter(m[3], m.index + m[0].length - m[3].length);
  }
}

// ---------------------------------------------------------------- 3. traductions probablement inutilisées
const tout = sources.map(s => s.t).join('\n');
// le texte tel qu'il peut être écrit dans le code : brut, échappé en JS, en JSON, en HTML ;
// sans ses espaces de début et de fin (« 'Spirale du bord vers le milieu. ' + … » s'écrit souvent en morceaux)
const variantes = k => [k, k.trim()].flatMap(t => [t, t.replaceAll('\\', '\\\\').replaceAll("'", String.raw`\'`),
  JSON.stringify(t).slice(1, -1), t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')]).filter(Boolean);
const inutilisees = Object.keys(dico).filter(k => !variantes(k).some(v => tout.includes(v)));

// ---------------------------------------------------------------- rapport
const args = new Set(process.argv.slice(2)), detail = args.has('--detail');
const liste = (titre, l, fmt) => {
  console.log(`${titre} : ${l.length}`);
  if (detail) for (const x of l) console.log('   ' + fmt(x));
};
console.log(`Traductions anglaises (src/i18n/en.json) : ${Object.keys(dico).length}`);
liste('Textes de tr() / trf() qui resteraient en français', nonTraduitsCode, x => `${x.f}:${x.l}  ${x.s}`);
liste('Textes de la page qui resteraient en français', nonTraduitsPage, x => `${x.f}:${x.l}  ${x.s}`);
liste('Traductions probablement inutilisées', inutilisees, x => x);
if (!detail && nonTraduitsCode.length + nonTraduitsPage.length + inutilisees.length) console.log('(--detail pour la liste)');
if (args.has('--strict') && nonTraduitsCode.length + nonTraduitsPage.length) process.exitCode = 1;
