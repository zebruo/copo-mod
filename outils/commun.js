// Partie commune à decouper.js et assembler.js : organisation de src/ et assemblage de index.html.
//
// src/page.html        la page, où le contenu de la feuille de style et du script principal est remplacé
//                      par  /*@inclure css*/  et  /*@inclure js*/
// src/css/NNN-nom.css  la feuille de style principale, une partie par fichier (dans l'ordre des numéros)
// src/js/<domaine>/NNN-nom.js   le script principal, une section par fichier, rangée par domaine
//                      (noyau, dessin, usinage…) ; l'ordre d'assemblage est celui des numéros, tous dossiers confondus
// src/donnees/nom.js   les lignes de données très longues (post-processeurs, exemples…) ;
//                      dans le fichier de la section, la ligne est remplacée par  /*@donnee nom*/
// src/i18n/en.json     les traductions anglaises (texte français → texte anglais), triées, une par ligne ;
//                      dans le fichier de la section, la déclaration est remplacée par  /*@i18n en*/
//                      et l'assemblage écrit  const I18N_EN = {…};  (une traduction par ligne)
//
// L'assemblage recolle tout à l'identique, sauf la zone des traductions, réécrite à partir de en.json.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.resolve(__dirname, '..');
const SRC = path.join(RACINE, 'src');
const INDEX = path.join(RACINE, 'index.html');
const MARQUE_STYLE = '/*@inclure css*/';
const MARQUE_JS = '/*@inclure js*/';
const MARQUE_DONNEE = /^\/\*@donnee ([\w-]+)\*\/$/;
const MARQUE_I18N = /^\/\*@i18n (\w+)\*\/$/;

// tri des traductions : ordre alphabétique français (stable d'une machine à l'autre)
const triFr = new Intl.Collator('fr', { sensitivity: 'variant', numeric: true }).compare;
function trier(dico) {
  const o = {};
  for (const k of Object.keys(dico).sort((a, b) => triFr(a, b) || (a < b ? -1 : 1))) o[k] = dico[k];
  return o;
}
// fichier src/i18n/<langue>.json : un objet trié, une traduction par ligne
const jsonI18n = dico => JSON.stringify(trier(dico), null, 2) + '\n';
// déclaration écrite dans index.html, une traduction par ligne, avec les fins de ligne du fichier
function declarationI18n(langue, dico, fin) {
  const entrees = Object.entries(trier(dico)).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v));
  return `const I18N_${langue.toUpperCase()} = {` + fin + entrees.join(',' + fin) + fin + '};';
}

const lire = f => fs.readFileSync(f, 'utf8');
// un éditeur peut ajouter une fin de ligne en fin de fichier : une donnée tient sur une seule ligne, on l'ôte
const sansFinDeLigne = t => t.replace(/\r?\n$/, '');

// découpe un texte en lignes en gardant chaque fin de ligne (\n ou \r\n) avec sa ligne
const lignes = t => (t ? t.split(/(?<=\n)/) : []);

// fichiers NNN-nom.ext d'un dossier et de ses sous-dossiers, dans l'ordre des numéros (tous dossiers confondus)
function fichiersNumerotes(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile() && new RegExp(String.raw`^\d{3}-[\w-]+\.${ext}$`).test(e.name)) out.push(path.join(e.parentPath ?? e.path, e.name));
  }
  const num = f => path.basename(f).slice(0, 3);
  out.sort((a, b) => num(a).localeCompare(num(b)) || path.basename(a).localeCompare(path.basename(b)));
  const vus = new Map();
  for (const f of out) {
    if (vus.has(path.basename(f))) throw new Error(`deux fichiers portent le même nom : ${vus.get(path.basename(f))} et ${f}`);
    vus.set(path.basename(f), f);
  }
  return out;
}

function assemblerJs(dossier) {
  const dirDon = path.join(dossier, 'donnees');
  let js = '';
  for (const f of fichiersNumerotes(path.join(dossier, 'js'), 'js')) {
    for (const l of lignes(lire(f))) {
      const fin = l.match(/\r?\n$/)?.[0] || '', corps = l.slice(0, l.length - fin.length);
      const d = corps.match(MARQUE_DONNEE), t = corps.match(MARQUE_I18N);
      if (d) js += sansFinDeLigne(lire(path.join(dirDon, d[1] + '.js'))) + fin;
      else if (t) js += declarationI18n(t[1], JSON.parse(lire(path.join(dossier, 'i18n', t[1] + '.json'))), fin || '\n') + fin;
      else js += l;
    }
  }
  return js;
}

function assembler(dossier = SRC) {
  const page = lire(path.join(dossier, 'page.html'));
  for (const marque of [MARQUE_STYLE, MARQUE_JS]) {
    if (page.split(marque).length !== 2) throw new Error(`src/page.html doit contenir une seule fois ${marque}`);
  }
  const css = () => fichiersNumerotes(path.join(dossier, 'css'), 'css').map(lire).join('');
  return page.replace(MARQUE_STYLE, css).replace(MARQUE_JS, () => assemblerJs(dossier));
}

module.exports = { RACINE, SRC, INDEX, MARQUE_STYLE, MARQUE_JS, lire, lignes, assembler, fichiersNumerotes, jsonI18n, declarationI18n };
