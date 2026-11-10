// Découpe index.html en fichiers sources dans src/ (voir commun.js pour l'organisation).
//
//   node outils/decouper.js
//
// Le script principal est coupé aux commentaires de section  // ---------- titre ----------  déjà présents
// dans le code : une section par fichier, numérotée de 10 en 10 (on peut en insérer une entre deux).
// Les lignes de plus de 4000 caractères (données) vont dans src/donnees/.
// À la fin, src/ est réassemblé en mémoire et comparé à index.html : la moindre différence arrête tout.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { SRC, INDEX, MARQUE_STYLE, MARQUE_JS, lire, lignes, assembler, jsonI18n, declarationI18n } = require('./commun');

const LIGNE_LONGUE = 4000;
const SECTION = /^\/\/ -{6,} (.+?) -{6,}/;

// Rangement des sections JS par domaine, d'après le début du nom de leur fichier (titre de la section).
// Une section absente de cette liste va dans js/divers/ (avec un avertissement). Le classement n'influe
// pas sur l'assemblage : l'ordre est celui des numéros. noyau = la zone CORE-START … CORE-END, celle
// que reprend aussi le calcul en tâche de fond.
const RANGEMENT = {
  base: ['debut', 'langue', 'unites-d-affichage', 'calques-et-formes', 'historique', 'calcul-des-parcours',
    'recalcul-des-parcours', 'onglets', 'actions', 'plein-ecran', 'fenetres-flottantes', 'divers', 'exemple',
    'demarrage', 'parametres'],
  noyau: ['geometrie-de-base', 'clipper', 'constructeur-de-mouvements', 'profil', 'poche', 'v-carving-repli',
    'v-carving-par-axe-median', 'usinage-du-relief', 'filetage', 'percage', 'coins-chanfrein', 'ponts-d-attache',
    'arcs-g2-g3', 'imbrication-forme-reelle', 'g-code', 'post-processeurs'],
  dessin: ['conge-chanfrein-sur-n-importe', 'vue', 'outils-de-dessin', 'accrochage', 'fenetre-regles-d-accroche',
    'tests-de-clic', 'texte', 'souris-tactile', 'panneau-dessin', 'operations', 'imbrication', 'lisser', 'rotation'],
  fichiers: ['import-svg', 'import-dxf', 'polices', 'fichiers', 'bibliotheque-de-dessins', 'vectorisation', 'import-pdf'],
  usinage: ['panneau-parcours', 'panneau-outils', 'bibliotheque-d-outils', 'panneau-g-code', 'fiche-de-gamme',
    'bibliotheque-de-machines', 'type-de-projet'],
  relief: ['relief', 'vues-2d-3d'],
  extensions: ['gadget-boite-a-entures', 'graduations-rotatives', 'touche-de-guitare', 'incrustation-en-v', 'inlay-en-poche'],
  aide: ['schemas-explicatifs', 'signaler-un-bug', 'bulles', 'infobulles', 'accueil'],
};
// domaine d'un fichier : le préfixe le plus long qui correspond (« panneau-dessin-grille » → dessin, « g-code » → noyau)
function domaine(nom) {
  const titre = nom.replace(/^\d{3}-/, '').replace(/\.js$/, '');
  let best = null;
  for (const [d, prefixes] of Object.entries(RANGEMENT)) {
    for (const p of prefixes) {
      if ((titre === p || titre.startsWith(p + '-')) && (!best || p.length > best.p.length)) best = { d, p };
    }
  }
  return best?.d;
}

// Parties de la feuille de style : on coupe avant chacun de ces commentaires (titres déjà présents dans le CSS).
// Ce qui précède le premier va dans 000-polices.css. Un titre introuvable est ignoré (avec un avertissement).
const COUPES_CSS = [
  [/^\/\* Layout :/, 'theme-sombre'],
  [/^\/\* Thème clair/, 'theme-clair'],
  [/^\/\* top bar \*\//, 'barre-du-haut'],
  [/^\/\* work area \*\//, 'zone-de-travail'],
  [/^\/\* panel \*\//, 'panneau'],
  [/^\/\* toolpath list \*\//, 'liste-des-parcours'],
  [/^\/\* dialog \*\//, 'dialogues'],
  [/^\/\* --- habillage atelier --- \*\//, 'habillage-atelier'],
  [/^\/\* barres flottantes communes/, 'barres-flottantes'],
  [/^\/\* panneau image compact \*\//, 'panneau-image'],
  [/^\/\* réglages chiffrés des outils/, 'reglages-des-outils'],
  [/^\/\* menu du clic droit \*\//, 'menu-du-clic-droit'],
  [/^\/\* =+ réglages à la place des outils/, 'reglages-a-la-place-des-outils'],
  [/^\/\* relief \*\//, 'relief-et-parcours'],
  [/^\/\* schémas \(projet, parcours/, 'schemas'],
];
function decouperCss(css) {
  const parts = [{ nom: 'polices', lignes: [] }], restants = [...COUPES_CSS];
  for (const l of lignes(css)) {
    const i = restants.findIndex(([re]) => re.test(l.trimStart()));
    if (i >= 0) {
      parts.push({ nom: restants[i][1], lignes: [] });
      restants.splice(0, i + 1); // les coupes restent dans l'ordre du fichier
    }
    parts.at(-1).lignes.push(l);
  }
  for (const [re] of restants) console.warn('Avertissement : titre CSS introuvable, pas de coupe : ' + re);
  return Object.fromEntries(parts.map((p, i) => [String(i * 10).padStart(3, '0') + '-' + p.nom + '.css', p.lignes.join('')]));
}
// déclaration du dictionnaire anglais et ses compléments : const I18N_EN = {…};  Object.assign(I18N_EN, {…});
// (éventuellement suivis d'un commentaire de version  // 1.283 : …, que le format JSON ne peut pas garder)
const BLOC_I18N = /^(?:const I18N_EN = |Object\.assign\(I18N_EN, )\{.*\}\)?;(?: *\/\/[^\n]*)?$/;

// Regroupe les blocs de traduction : le premier devient le marqueur /*@i18n en*/, les autres disparaissent.
// Renvoie le script marqué, le dictionnaire fusionné (dans l'ordre d'exécution : le dernier gagne)
// et le script attendu après assemblage (marqueur remplacé par la déclaration écrite à partir de en.json).
function regrouperI18n(js) {
  const blocs = [];
  let marque = '', attendu = '', fin0 = null;
  for (const l of lignes(js)) {
    const fin = l.match(/\r?\n$/)?.[0] || '', corps = l.slice(0, l.length - fin.length);
    if (!BLOC_I18N.test(corps)) { marque += l; attendu += l; continue; }
    blocs.push(corps);
    if (fin0 !== null) continue;
    fin0 = fin;
    marque += '/*@i18n en*/' + fin;
    attendu += '\u0000I18N\u0000' + fin; // remplacé ci-dessous, une fois le dictionnaire complet
  }
  if (!blocs.length) throw new Error('aucun bloc de traduction I18N_EN trouvé');
  // le dictionnaire tel que le navigateur le construit : on exécute vraiment les blocs, dans l'ordre
  const dico = vm.runInNewContext(blocs.join('\n') + '\nI18N_EN');
  attendu = attendu.replace('\u0000I18N\u0000', () => declarationI18n('en', dico, fin0 || '\n'));
  return { marque, attendu, dico: structuredClone(dico), blocs: blocs.length };
}
const memesCles = (a, b) => {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.hasOwn(b, k) && a[k] === b[k]);
};

const slug = (t, max = 40) => {
  const s = t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return s.length <= max ? s : s.slice(0, max).replace(/-[^-]*$/, '');
};

// la feuille de style principale et le script principal : les plus longs de la page
function plusLong(html, ouvrante, fermante) {
  let best = null;
  for (const m of html.matchAll(new RegExp(ouvrante, 'g'))) {
    const debut = m.index + m[0].length, fin = html.indexOf(fermante, debut);
    if (fin > debut && (!best || fin - debut > best.fin - best.debut)) best = { debut, fin };
  }
  if (!best) throw new Error('aucun bloc ' + ouvrante + ' dans index.html');
  return best;
}

function decouperJs(js) {
  const sections = [{ titre: 'debut', lignes: [] }];
  for (const l of lignes(js)) {
    const m = l.match(SECTION);
    if (m) sections.push({ titre: m[1], lignes: [] });
    sections.at(-1).lignes.push(l);
  }
  const fichiers = {}, donnees = {}, vus = new Map();
  sections.forEach((s, i) => {
    const nom = String(i * 10).padStart(3, '0') + '-' + (slug(s.titre) || 'section');
    let k = 0;
    const contenu = s.lignes.map(l => {
      const fin = l.match(/\r?\n$/)?.[0] || '', corps = l.slice(0, l.length - fin.length);
      if (corps.length <= LIGNE_LONGUE) return l;
      const decl = corps.match(/^\s*(?:(?:const|let|var)\s+(\w+)|Object\.assign\((\w+))/);
      let base = decl ? slug(decl[1] || decl[2]) : nom.slice(4) + '-' + (++k);
      const n = (vus.get(base) || 0) + 1;
      vus.set(base, n);
      if (n > 1 || decl?.[2]) base += '-' + n; // Object.assign(I18N_EN, …) répété : i18n-en-1, -2…
      donnees[base] = corps;
      return `/*@donnee ${base}*/` + fin;
    }).join('');
    fichiers[nom + '.js'] = contenu;
  });
  return { fichiers, donnees };
}

function main() {
  const html = lire(INDEX);
  const st = plusLong(html, '<style>', '</style>'), sc = plusLong(html, '<script>', '</script>');
  if (st.fin >= sc.debut) throw new Error('la feuille de style principale doit précéder le script principal');
  const page = html.slice(0, st.debut) + MARQUE_STYLE + html.slice(st.fin, sc.debut) + MARQUE_JS + html.slice(sc.fin);
  const i18n = regrouperI18n(html.slice(sc.debut, sc.fin));
  const { fichiers, donnees } = decouperJs(i18n.marque);

  const css = decouperCss(html.slice(st.debut, st.fin));

  fs.rmSync(SRC, { recursive: true, force: true });
  for (const d of ['css', 'js', 'donnees', 'i18n']) fs.mkdirSync(path.join(SRC, d), { recursive: true });
  fs.writeFileSync(path.join(SRC, 'page.html'), page);
  for (const [f, t] of Object.entries(css)) fs.writeFileSync(path.join(SRC, 'css', f), t);
  fs.writeFileSync(path.join(SRC, 'i18n', 'en.json'), jsonI18n(i18n.dico));
  const parDomaine = {};
  for (const [f, t] of Object.entries(fichiers)) {
    let d = domaine(f);
    if (!d) { d = 'divers'; console.warn(`Avertissement : section non classée, rangée dans js/divers/ : ${f}`); }
    fs.mkdirSync(path.join(SRC, 'js', d), { recursive: true });
    fs.writeFileSync(path.join(SRC, 'js', d, f), t);
    parDomaine[d] = (parDomaine[d] || 0) + 1;
  }
  for (const [f, t] of Object.entries(donnees)) fs.writeFileSync(path.join(SRC, 'donnees', f + '.js'), t);

  // 1. tout est identique à l'octet près, sauf la zone des traductions, réécrite à partir de en.json
  const attendu = html.slice(0, sc.debut) + i18n.attendu + html.slice(sc.fin), obtenu = assembler();
  if (obtenu !== attendu) throw new Error('ÉCHEC : src/ réassemblé ne redonne pas index.html (hors traductions) à l’identique.');
  // 2. le dictionnaire de l'index.html réassemblé, exécuté, est exactement celui de l'original
  const decl = lignes(obtenu).join('').match(/^const I18N_EN = \{[\s\S]*?\r?\n\};/m)[0];
  if (!memesCles(vm.runInNewContext(decl + '\nI18N_EN'), i18n.dico)) throw new Error('ÉCHEC : le dictionnaire réassemblé diffère de l’original.');

  const ko = n => Math.round(n / 1024) + ' Ko';
  console.log(`src/ écrit : page.html (${ko(page.length)}), ${Object.keys(css).length} fichiers css (${ko(st.fin - st.debut)}), ` +
    `${Object.keys(fichiers).length} fichiers js (${Object.entries(parDomaine).map(([d, n]) => d + ' ' + n).join(', ')}), ` +
    `${Object.keys(donnees).length} fichiers de données, ` +
    `i18n/en.json (${Object.keys(i18n.dico).length} traductions issues de ${i18n.blocs} blocs).`);
  console.log('Vérification : src/ réassemblé redonne index.html octet pour octet hors traductions, ' +
    'et un dictionnaire identique à l’original.');
}

try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
