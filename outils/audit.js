// Audit du code de COPO (src/) : code mort, doublons, passages répétés, CSS et HTML.
//
//   node outils/audit.js            rapport complet (Markdown) sur la sortie standard
//   node outils/audit.js > audit.md
//
// Le script principal est analysé avec acorn (lib/acorn.min.js, déjà fourni avec COPO). Chaque résultat
// indique le fichier de src/ et la ligne. Ce sont des pistes à vérifier, pas des certitudes : une fonction
// peut être appelée par son nom écrit dans une chaîne (colonne « cité en chaîne »).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('../lib/acorn.min.js');
const { SRC, lire, lignes, fichiersNumerotes, declarationI18n } = require('./commun');

// ---------------------------------------------------------------- script principal assemblé, avec la carte des fichiers
const MARQUE_DONNEE = /^\/\*@donnee ([\w-]+)\*\/$/, MARQUE_I18N = /^\/\*@i18n (\w+)\*\/$/;
const carte = []; // { debut, fin, f, ligne0 } : position dans le script → fichier de src/
let js = '', nLignes = 0;
for (const f of fichiersNumerotes(path.join(SRC, 'js'), 'js')) {
  const debut = js.length, ligne0 = nLignes;
  for (const l of lignes(lire(f))) {
    const fin = /\r?\n$/.exec(l)?.[0] || '', corps = l.slice(0, l.length - fin.length);
    let t = l;
    const d = MARQUE_DONNEE.exec(corps), i = MARQUE_I18N.exec(corps);
    if (d) t = lire(path.join(SRC, 'donnees', d[1] + '.js')).replace(/\r?\n$/, '') + fin;
    else if (i) t = declarationI18n(i[1], JSON.parse(lire(path.join(SRC, 'i18n', i[1] + '.json'))), fin || '\n') + fin;
    js += t;
    nLignes += t.split('\n').length - 1;
  }
  carte.push({ debut, fin: js.length, f: path.relative(SRC, f).replaceAll('\\', '/'), ligne0 });
}
const ou = pos => {
  const c = carte.find(x => pos >= x.debut && pos < x.fin) || carte.at(-1);
  return `${c.f}:${js.slice(c.debut, pos).split('\n').length}`;
};
const page = lire(path.join(SRC, 'page.html'));
const ast = acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'script' });
const jetons = [...acorn.tokenizer(js, { ecmaVersion: 'latest' })];

// ---------------------------------------------------------------- 1. code mort (déclarations globales jamais utilisées)
const decls = [];
const ajouter = (nom, n, decl) => decls.push({ nom, debut: decl.start, fin: decl.end, pos: n.start, genre: decl.type === 'FunctionDeclaration' ? 'fonction' : 'variable' });
for (const st of ast.body) {
  if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') ajouter(st.id.name, st.id, st);
  else if (st.type === 'VariableDeclaration') {
    for (const d of st.declarations) {
      if (d.id.type !== 'Identifier') continue;
      const fn = d.init && /Function/.test(d.init.type);
      decls.push({ nom: d.id.name, debut: d.start, fin: d.end, pos: d.id.start, genre: fn ? 'fonction' : 'variable' });
    }
  }
}
// occurrences de chaque nom (hors accès à une propriété  objet.nom), par position
const occ = new Map();
for (let k = 0; k < jetons.length; k++) {
  const t = jetons[k];
  if (t.type.label !== 'name') continue;
  const prec = jetons[k - 1];
  if (prec && (prec.type.label === '.' || prec.type.label === '?.')) continue;
  if (!occ.has(t.value)) occ.set(t.value, []);
  occ.get(t.value).push(t.start);
}
// les autres scripts de la page (petits scripts intégrés, attributs onclick…) comptent comme des utilisations
const ailleurs = page.replace(/\/\*@inclure (js|css)\*\//g, '');
const motDans = (nom, texte) => new RegExp(String.raw`(^|[^\w$.])${nom.replaceAll('$', String.raw`\$`)}(?![\w$])`).test(texte);
// une déclaration est morte si toutes ses occurrences sont dans une déclaration morte (elle-même comprise) : point fixe
const morts = new Set();
const parNom = new Map(decls.map(d => [d.nom, d]));
let change = true;
while (change) {
  change = false;
  for (const d of decls) {
    if (morts.has(d.nom) || motDans(d.nom, ailleurs)) continue;
    const vivantes = (occ.get(d.nom) || []).filter(p => {
      if (p === d.pos) return false;
      return !decls.some(e => (e === d || morts.has(e.nom)) && p >= e.debut && p < e.fin);
    });
    if (!vivantes.length) { morts.add(d.nom); change = true; }
  }
}
// cité dans une chaîne ou un commentaire ? (appel possible par son nom : WK_ROOTS, typeof…, window[…])
const chaines = jetons.filter(t => t.type.label === 'string' || t.type.label === 'template').map(t => String(t.value)).join('\n');
const mortsListe = [...morts].map(n => parNom.get(n)).map(d => ({ ...d, chaine: motDans(d.nom, chaines), taille: d.fin - d.debut }))
  .sort((a, b) => b.taille - a.taille);

// ---------------------------------------------------------------- 2. et 3. fonctions identiques ou presque
const fonctions = [];
(function parcourir(n, nomParent) {
  if (!n || typeof n.type !== 'string') return;
  let nom = null;
  if (n.type === 'FunctionDeclaration') nom = n.id.name;
  else if (n.type === 'VariableDeclarator' && n.init && /Function/.test(n.init.type) && n.id.type === 'Identifier') nom = n.id.name;
  else if (n.type === 'Property' && n.value && /Function/.test(n.value.type) && n.key) nom = (n.key.name || n.key.value) + ' (propriété)';
  if (nom) {
    const f = n.type === 'VariableDeclarator' ? n.init : n.type === 'Property' ? n.value : n;
    fonctions.push({ nom: nomParent ? nomParent + ' › ' + nom : nom, debut: f.start, fin: f.end, pos: n.start });
  }
  for (const k of Object.keys(n)) {
    const v = n[k];
    if (Array.isArray(v)) v.forEach(x => parcourir(x, nomParent));
    else if (v && typeof v.type === 'string') parcourir(v, nomParent);
  }
})(ast, null);
// jetons d'une fonction : bruts, et « alpha-renommés » (chaque nom local devient v0, v1… dans l'ordre d'apparition)
const jetonsDe = (debut, fin) => jetons.filter(t => t.start >= debut && t.end <= fin);
// valeur exacte d'un jeton : acorn range + et - (ou < et >) dans la même catégorie, il faut comparer l'opérateur lui-même
const val = t => (t.value === undefined ? t.type.label : t.type.label[0] + String(t.value));
const brut = tk => tk.map(val).join(' ');
function renomme(tk) {
  const m = new Map();
  return tk.map((t, k) => {
    if (t.type.label !== 'name') return val(t);
    const prec = tk[k - 1];
    if (prec && (prec.type.label === '.' || prec.type.label === '?.')) return t.value; // propriété : gardée
    if (!m.has(t.value)) m.set(t.value, 'v' + m.size);
    return m.get(t.value);
  });
}
for (const f of fonctions) {
  f.tk = jetonsDe(f.debut, f.fin);
  f.brut = brut(f.tk.slice(1)); // sans le mot-clé / nom en tête
  f.alpha = renomme(f.tk).join(' ');
}
const grosses = fonctions.filter(f => f.tk.length >= 25);
const grouper = cle => {
  const g = new Map();
  for (const f of grosses) {
    const k = f[cle];
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(f);
  }
  return [...g.values()].filter(x => x.length > 1 && new Set(x.map(f => f.debut)).size > 1);
};
const identiques = grouper('brut');
const dejaVus = new Set(identiques.flat().map(f => f.debut));
const alphaIdentiques = grouper('alpha').filter(g => !g.every(f => dejaVus.has(f.debut)));
// presque identiques : similarité de Jaccard des 4-grammes de jetons renommés, au moins 0,85
const gram = f => {
  const a = f.alpha.split(' '), s = new Set();
  for (let k = 0; k + 4 <= a.length; k++) s.add(a.slice(k, k + 4).join(' '));
  return s;
};
const candidates = fonctions.filter(f => f.tk.length >= 60).map(f => ({ f, g: gram(f) }));
const proches = [];
for (let i = 0; i < candidates.length; i++) {
  for (let j = i + 1; j < candidates.length; j++) {
    const a = candidates[i], b = candidates[j];
    if (a.f.debut <= b.f.debut && b.f.fin <= a.f.fin) continue; // l'une dans l'autre
    if (b.f.debut <= a.f.debut && a.f.fin <= b.f.fin) continue;
    const ta = a.g.size, tb = b.g.size;
    if (Math.min(ta, tb) / Math.max(ta, tb) < 0.85) continue;
    let inter = 0;
    for (const x of a.g) if (b.g.has(x)) inter++;
    const j2 = inter / (ta + tb - inter);
    if (j2 >= 0.85 && a.f.alpha !== b.f.alpha) proches.push({ a: a.f, b: b.f, j: j2 });
  }
}
proches.sort((x, y) => y.a.tk.length - x.a.tk.length);

// ---------------------------------------------------------------- 4. passages répétés (60 jetons identiques ou plus)
const L = 60, seq = jetons.map(val);
const vus = new Map();
for (let k = 0; k + L <= seq.length; k++) {
  if (jetons[k].type.label === 'string' && String(jetons[k].value).length > 200) continue; // données
  const cle = seq.slice(k, k + L).join('\u0001');
  if (!vus.has(cle)) vus.set(cle, []);
  vus.get(cle).push(k);
}
// on regroupe les fenêtres consécutives en passages, et on garde un passage par groupe d'emplacements
const repetes = [];
const pris = new Set();
for (const pos of vus.values()) {
  if (pos.length < 2 || pris.has(pos[0])) continue;
  // étendre tant que les fenêtres suivantes sont aussi répétées aux mêmes décalages
  let n = 0;
  while (pos.every(p => p + n + 1 + L <= seq.length) && vus.get(seq.slice(pos[0] + n + 1, pos[0] + n + 1 + L).join('\u0001'))?.length === pos.length) n++;
  for (let k = 0; k <= n; k++) pos.forEach(p => pris.add(p + k));
  if (pos.some((p, i) => i && p - pos[i - 1] < L + n)) continue; // chevauchement : motif répétitif, pas un copier-coller
  repetes.push({ pos: pos.map(p => jetons[p].start), jetons: L + n, extrait: js.slice(jetons[pos[0]].start, jetons[pos[0]].start + 110).replace(/\s+/g, ' ') });
}
repetes.sort((a, b) => b.jetons * b.pos.length - a.jetons * a.pos.length);

// ---------------------------------------------------------------- 5. CSS
const css = fichiersNumerotes(path.join(SRC, 'css'), 'css').map(f => ({ f: path.relative(SRC, f).replaceAll('\\', '/'), t: lire(f) }));
const regles = [];
for (const { f, t } of css) {
  const sans = t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  // règles simples  sélecteur { déclarations }  hors @media / @supports (traités comme des blocs à part)
  for (const m of sans.matchAll(/(^|[{}])\s*([^{}@][^{}]*?)\s*\{([^{}]*)\}/g)) {
    const sel = m[2].replace(/\s+/g, ' ').trim(), decl = m[3].split(';').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const avant = sans.slice(0, m.index);
    const media = (avant.match(/@media[^{]*\{/g) || []).length - 0; // indicatif
    regles.push({ f, l: t.slice(0, m.index + m[1].length).split('\n').length, sel, decl, media });
  }
}
const parSel = new Map();
for (const r of regles) for (const s of r.sel.split(',').map(x => x.trim())) {
  if (!parSel.has(s)) parSel.set(s, []);
  parSel.get(s).push(r);
}
const selMultiples = [...parSel.entries()].filter(([, rs]) => rs.length > 1).sort((a, b) => b[1].length - a[1].length);
const parBloc = new Map();
for (const r of regles) {
  if (r.decl.length < 3) continue;
  const k = [...r.decl].sort().join(';');
  if (!parBloc.has(k)) parBloc.set(k, []);
  parBloc.get(k).push(r);
}
const blocsIdentiques = [...parBloc.values()].filter(rs => rs.length > 1 && new Set(rs.map(r => r.sel)).size > 1);
const declDoublees = regles.map(r => {
  const props = r.decl.map(d => d.split(':')[0].trim()), dbl = props.filter((p, i) => props.indexOf(p) !== i && !p.startsWith('--'));
  return { r, dbl: [...new Set(dbl)] };
}).filter(x => x.dbl.length);

// ---------------------------------------------------------------- 6. HTML : identifiants en double
const ids = new Map();
for (const m of page.matchAll(/\sid="([^"]+)"/g)) {
  const l = page.slice(0, m.index).split('\n').length;
  if (!ids.has(m[1])) ids.set(m[1], []);
  ids.get(m[1]).push(l);
}
const idsDoubles = [...ids.entries()].filter(([, ls]) => ls.length > 1);

// ---------------------------------------------------------------- rapport
const out = [];
const p = s => out.push(s);
p('# Audit du code de COPO\n');
p(`Script principal : ${Math.round(js.length / 1024)} Ko, ${fonctions.length} fonctions, ${decls.length} déclarations globales. ` +
  `Feuille de style : ${regles.length} règles. Page : ${ids.size} identifiants.\n`);
p(`## 1. Code mort probable : ${mortsListe.length} déclarations globales jamais utilisées\n`);
p('Jamais référencées ailleurs que dans leur propre déclaration (ou seulement par d’autres déclarations mortes).\n');
p('| Nom | Genre | Taille | Où | Cité en chaîne |\n|---|---|---|---|---|');
for (const d of mortsListe) p(`| \`${d.nom}\` | ${d.genre} | ${d.taille} car. | ${ou(d.pos)} | ${d.chaine ? 'oui : à vérifier' : ''} |`);
p(`\n## 2. Fonctions identiques : ${identiques.length} groupes\n`);
for (const g of identiques) p(`- ${g.map(f => `\`${f.nom}\` (${ou(f.pos)})`).join(' = ')} — ${g[0].tk.length} jetons`);
p(`\n## 3. Fonctions identiques aux noms de variables près : ${alphaIdentiques.length} groupes\n`);
for (const g of alphaIdentiques) p(`- ${g.map(f => `\`${f.nom}\` (${ou(f.pos)})`).join(' ≈ ')} — ${g[0].tk.length} jetons`);
p(`\n## 4. Fonctions presque identiques (similarité ≥ 85 %) : ${proches.length} paires\n`);
for (const x of proches) p(`- \`${x.a.nom}\` (${ou(x.a.pos)}) et \`${x.b.nom}\` (${ou(x.b.pos)}) — ${Math.round(x.j * 100)} %, ${x.a.tk.length} / ${x.b.tk.length} jetons`);
p(`\n## 5. Passages de code répétés (${L} jetons ou plus) : ${repetes.length}\n`);
for (const r of repetes.slice(0, 40)) p(`- ${r.jetons} jetons × ${r.pos.length} : ${r.pos.map(ou).join(', ')}\n  \`${r.extrait.replaceAll('`', '\'')}…\``);
if (repetes.length > 40) p(`- … et ${repetes.length - 40} autres`);
p(`\n## 6. CSS\n`);
p(`### Sélecteurs définis dans plusieurs règles : ${selMultiples.length}\n`);
p('Souvent voulu (thème clair, état survolé, @media), parfois un reste d’ancienne règle.\n');
for (const [s, rs] of selMultiples.slice(0, 40)) p(`- \`${s}\` × ${rs.length} : ${rs.map(r => r.f + ':' + r.l).join(', ')}`);
if (selMultiples.length > 40) p(`- … et ${selMultiples.length - 40} autres`);
p(`\n### Règles au contenu identique sous des sélecteurs différents (à regrouper) : ${blocsIdentiques.length}\n`);
for (const rs of blocsIdentiques) p(`- ${rs.map(r => '`' + r.sel + '` (' + r.f + ':' + r.l + ')').join(', ')}`);
p(`\n### Propriété déclarée deux fois dans la même règle : ${declDoublees.length}\n`);
for (const x of declDoublees) p(`- \`${x.r.sel}\` (${x.r.f}:${x.r.l}) : ${x.dbl.join(', ')}`);
p(`\n## 7. HTML : identifiants en double : ${idsDoubles.length}\n`);
for (const [id, ls] of idsDoubles) p(`- \`${id}\` : lignes ${ls.join(', ')} de src/page.html`);
console.log(out.join('\n'));
