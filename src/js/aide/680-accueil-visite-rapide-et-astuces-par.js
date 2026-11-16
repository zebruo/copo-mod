// ---------- accueil, visite rapide et astuces par onglet (textes FR/EN en dur : la bulle n'est pas traduite par fragments) ----------
const CO = { ready: false, busy: false, tabT: 0 };
const coT = f => (LANG === 'en' && I18N_EN[f] !== undefined ? I18N_EN[f] : f); // accueil, visite, astuces : traduction exacte dans I18N_EN (jamais par morceaux, les textes contiennent du HTML)
const coL = o => (Array.isArray(o.fr) ? o.fr.map(coT) : coT(o.fr));
const coOn = k => LS.get(k) === '1';
const CO_TOUR = [
  { sel: ['.tabs'], fr: ['Les étapes', 'Le travail se fait de gauche à droite : <b>Projet</b> (le brut et la machine), <b>Dessin</b>, <b>Relief</b>, <b>Parcours</b>, puis <b>G-code</b>.'] },
  { sel: ['.viewsw', '.splitsw'], fr: ['Les vues 2D et 3D', 'Affichez la vue 2D, la vue 3D ou les deux. Ces boutons les mettent côte à côte ou l’une au-dessus de l’autre.'] },
  { sel: ['#cw .stbar', '#rv3 .rvtools', '#rv3 .rvxf'], fr: ['Les barres d’outils', 'Sous chaque vue : l’accroche, la grille et l’affichage en 2D ; l’orientation, le déplacement, la rotation et la taille en 3D.'] },
  { sel: ['#views'], fr: ['Le clic droit', 'Faites un clic droit sur un vecteur ou dans une vue : les actions utiles (copier, miroir, aligner, supprimer…) sont là.'] },
  { sel: ['#views'], fr: ['Ctrl et Maj', 'En redimensionnant ou en tournant à la souris : <b>Ctrl</b> arrondit à 1 mm ou à 15° (0, 15, 30…), <b>Ctrl + Maj</b> tourne par 1°, <b>Maj</b> libère les proportions. Avec les flèches : <b>Ctrl</b> déplace par petits pas, adaptés au zoom.'] },
  { sel: ['.menubar .menu:last-child .mtop'], fr: ['L’aide', 'Le guide complet, en PDF ou en ligne, est dans le menu <b>Aide</b>, où vous pouvez aussi relancer cette visite. Bon usinage !'] },
];
const CO_TIPS = {
  projet: [
    { sel: ['#stW', '#stOrigin'], up: 'section', fr: 'Indiquez la taille du brut et l’origine <b>Z0</b> (dessus ou dessous de la pièce) : tous les calculs en dépendent.' },
    { sel: ['#pjMachBtn'], fr: 'Choisissez votre <b>machine</b> ici. Chacune garde son post-processeur (58 fournis, ou le vôtre en .pp), ses vitesses et ses hauteurs de sécurité : « Changer… » ouvre la bibliothèque de machines.' },
    { sel: ['#stMode'], fr: '<b>Type de projet</b> : simple face, double face (pièce retournée) ou <b>rotatif</b> (4ᵉ axe, pièce cylindrique). Les réglages en dessous s’adaptent au choix.' },
  ],
  dessin: [
    { sel: ['#dgrid'], fr: 'Toutes les fonctions de dessin sont ici : créer (formes, texte, import SVG, DXF, PDF ou AI), modifier, disposer, mesurer. Cliquez sur un vecteur de la vue 2D pour saisir ses valeurs exactes.' },
    { sel: ['#dgrid [data-tool="text"]'], fr: 'Outil <b>Texte</b> : avec <b>Placement</b>, le texte peut suivre une ou deux courbes ; le <b>Décalage</b> l’en écarte.' },
    { sel: ['#mExt'], fr: 'Les <b>incrustations</b> (en V ou en poche), la touche de guitare et la boîte à entures sont dans le menu <b>Extensions</b> : elles créent d’un coup les dessins et leurs parcours.' },
  ],
  relief: [
    { sel: ['[data-pane="relief"] .rseg'], fr: 'Importez un modèle <b>STL</b> ou une image en <b>niveaux de gris</b>, ou créez un dôme, une extrusion, un lissage…' },
    { sel: ['[data-pane="relief"] > section.blk:nth-of-type(2)'], fr: 'Sélectionnez un élément pour l’orienter avec les <b>angles X, Y et Z</b>. Plusieurs reliefs peuvent s’<b>ajouter</b> ou se <b>soustraire</b>.' },
  ],
  parcours: [
    { sel: ['#tpNew'], fr: '<b>Sélectionnez d’abord</b> les vecteurs dans la vue, puis choisissez le type de parcours.' },
    { sel: ['#tpNew'], fr: 'Survolez un mot technique (rampe, ponts, pas latéral…) pour voir sa définition ; touchez-le sur une tablette.' },
    { sel: ['#tpList'], up: 'section', fr: 'L’œil masque un parcours : il ne sera pas exporté. L’ordre de la liste est l’ordre d’usinage.' },
  ],
  gcode: [
    { sel: ['[data-pane="gcode"] [data-act="gcSave"]'], fr: 'Vérifiez les faces à exporter, puis <b>enregistrez</b> le fichier. Le post-processeur se choisit avec la machine, dans l’onglet Projet.' },
    { sel: ['[data-pane="gcode"] [data-act="sheet"]'], fr: 'La <b>Fiche de gamme</b> imprime la liste des outils et des opérations pour l’atelier.' },
  ],
};
function coEls(step) {
  const out = [];
  for (const q of step.sel) for (let el of document.querySelectorAll(q)) { if (step.up) el = el.closest(step.up) || el; const r = el.getBoundingClientRect(); if (r.width > 2 && r.height > 2 && !el.closest('[hidden]')) out.push(el); }
  return out;
}
function coRect(els) {
  if (!els.length) return null; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const el of els) { const r = el.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
  const p = 5; x0 = Math.max(2, x0 - p); y0 = Math.max(2, y0 - p); x1 = Math.min(innerWidth - 2, x1 + p); y1 = Math.min(innerHeight - 2, y1 + p);
  return x1 - x0 > 4 && y1 - y0 > 4 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}
function coMk(cls, parent) { const d = document.createElement('div'); d.className = cls; d.dataset.notr = ''; (parent || document.body).appendChild(d); return d; }
function coPlace(bub, hole, r) {
  if (r) { hole.hidden = false; Object.assign(hole.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); } else hole.hidden = true;
  const bw = bub.offsetWidth, bh = bub.offsetHeight, m = 12, W = innerWidth, H = innerHeight; let x, y;
  if (!r) { x = (W - bw) / 2; y = (H - bh) / 2; }
  else if (r.y + r.h + m + bh < H - 8) { y = r.y + r.h + m; x = r.x + r.w / 2 - bw / 2; }
  else if (r.y - m - bh > 8) { y = r.y - m - bh; x = r.x + r.w / 2 - bw / 2; }
  else if (r.x - m - bw > 8) { x = r.x - m - bw; y = r.y + r.h / 2 - bh / 2; }
  else if (r.x + r.w + m + bw < W - 8) { x = r.x + r.w + m; y = r.y + r.h / 2 - bh / 2; }
  else { x = r.x + r.w / 2 - bw / 2; y = r.y + r.h / 2 - bh / 2; } // la zone remplit l'écran : bulle au milieu
  bub.style.left = Math.max(8, Math.min(x, W - bw - 8)) + 'px'; bub.style.top = Math.max(8, Math.min(y, H - bh - 8)) + 'px';
}
// une séquence de bulles ; opt : { dim, title(i), body(i), btns(i, n), onEnd(how) }
function coRun(steps, opt) {
  coStop(); CO.busy = true;
  const blk = opt.dim ? coMk('cotour-block') : null, hole = coMk('cohole ' + (opt.dim ? 'dim' : 'ring')), bub = coMk('cobub');
  bub.setAttribute('role', 'dialog'); bub.setAttribute('aria-live', 'polite'); let i = 0;
  const end = how => { cleanup(); CO.busy = false; opt.onEnd && opt.onEnd(how); };
  const show = () => {
    const st = steps[i], els = coEls(st); if (els[0] && els[0].scrollIntoView) { const pn = els[0].closest('.pane, .panel'); if (pn) els[0].scrollIntoView({ block: 'nearest' }); }
    bub.innerHTML = opt.html(i, steps.length); coPlace(bub, hole, coRect(coEls(st)));
    bub.querySelectorAll('[data-co]').forEach(b => b.onclick = e => { e.stopPropagation(); const a = b.dataset.co; if (a === 'next') { if (++i >= steps.length) end('done'); else show(); } else if (a === 'prev') { if (i > 0) { i--; show(); } } else end(a); });
    const f = bub.querySelector('.primary'); if (f) f.focus({ preventScroll: true });
  };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end('skip'); } else if (opt.dim && (e.key === 'ArrowRight')) { e.preventDefault(); e.stopPropagation(); bub.querySelector('[data-co="next"]').click(); } else if (opt.dim && e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); e.stopPropagation(); i--; show(); } };
  const re = () => show();
  const cleanup = () => { [blk, hole, bub].forEach(n => n && n.remove()); document.removeEventListener('keydown', key, true); removeEventListener('resize', re); CO.stop = null; };
  document.addEventListener('keydown', key, true); addEventListener('resize', re); CO.stop = cleanup; show();
}
function coStop() { if (CO.stop) CO.stop(); CO.busy = false; }
function coTour() {
  coStop(); closeMenus(); clearTimeout(CO.tabT);
  if (typeof VIEWS !== 'undefined' && !VIEWS.d3) { VIEWS.d3 = true; viewsApply(); }
  const T = coT;
  coRun(CO_TOUR, {
    dim: true,
    html: (i, n) => { const t = coL(CO_TOUR[i]); return '<h4>' + t[0] + '<small>' + (i + 1) + '/' + n + '</small></h4><p>' + t[1] + '</p><div class="cb-row">' + (i < n - 1 ? '<button class="lnk" data-co="skip">' + T('Passer') + '</button>' : '') + '<span class="sp"></span>' + (i ? '<button data-co="prev">' + T('Précédent') + '</button>' : '') + '<button class="primary" data-co="next">' + (i < n - 1 ? T('Suivant') : T('Terminer')) + '</button></div>'; },
    onEnd: how => { LS.set('copo.tourDone', '1'); if (how === 'skip') LS.set('copo.tipsOff', '1'); else coTabSoon(curTab, 700); }, // passer la visite coupe aussi les astuces
  });
}
function coTab(t) {
  if (!CO.ready || CO.busy || coOn('copo.tipsOff') || !$('#about').hidden || document.querySelector('.cowel')) return;
  const tips = CO_TIPS[t]; if (!tips) return; let seen = []; try { seen = JSON.parse(LS.get('copo.tipsSeen') || '[]'); } catch { }
  if (seen.includes(t)) return; const steps = tips.filter(st => coEls(st).length); if (!steps.length) return;
  const T = coT;
  coRun(steps, {
    dim: false,
    html: (i, n) => '<h4>' + T('Astuce') + (n > 1 ? '<small>' + (i + 1) + '/' + n + '</small>' : '') + '</h4><p>' + coL(steps[i]) + '</p><div class="cb-row"><button class="lnk" data-co="off">' + T('Ne plus afficher les astuces') + '</button><span class="sp"></span><button class="primary" data-co="next">' + T('J’ai compris') + '</button></div>',
    onEnd: how => { if (how === 'off') LS.set('copo.tipsOff', '1'); seen.push(t); LS.set('copo.tipsSeen', JSON.stringify(seen)); },
  });
}
function coTabSoon(t, ms) { clearTimeout(CO.tabT); if (!CO.ready) return; if (CO.busy && CO.stop && !document.querySelector('.cotour-block')) coStop(); CO.tabT = setTimeout(() => coTab(t), ms || 350); }
function coTipsReset() { LS.set('copo.tipsOff', ''); LS.set('copo.tipsSeen', '[]'); toast('Astuces réactivées : elles s’afficheront à l’ouverture de chaque onglet.'); coTabSoon(curTab, 500); }
function coWelClose() { const w = document.querySelector('.cowel'); if (w) { if (w.querySelector('#cwOff').checked) LS.set('copo.welcomeOff', '1'); w.remove(); } }
function coWelcome() {
  const T = coT, w = coMk('cowel'); w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'cwT');
  w.innerHTML = '<div class="about-card"><div class="about-head"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 24h12"/><path d="M15 24c4.5 0 8-2.4 8.8-6 .8-3.7-1.6-7-5.2-7-3 0-5.2 2.4-4.8 5.1.3 2.3 2.5 3.6 4.5 2.8 1.7-.7 2.3-2.6 1.4-4"/><path d="M24 24h5"/></svg><div><b id="cwT">' + T('Bienvenue dans COPO') + '</b><span class="mono">' + T('Version') + ' ' + ($('#aboutVer') ? $('#aboutVer').textContent : '') + '</span></div></div>'
    + '<p>' + T('Logiciel libre de FAO : dessinez, ajoutez du relief, créez vos parcours d’outils et sortez le G-code de votre machine, directement dans le navigateur.') + '</p>'
    + '<div class="cw-btns"><button class="primary" data-cw="tour"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>' + T('Visite rapide (1 min)') + '</button>'
    + '<button data-cw="sample"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="m4 15 4-4 4 4 3-3 5 5"/></svg>' + T('Ouvrir le projet d’exemple') + '</button>'
    + '<button data-cw="new"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/></svg>' + T('Commencer un projet vide') + '</button></div>'
    + '<div class="cw-foot"><label><input type="checkbox" id="cwOff"> ' + T('Ne plus afficher au démarrage') + '</label><span>' + T('La visite reste disponible dans le menu Aide.') + '</span></div></div>';
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-cw]'); if (!b && e.target !== w) return; const a = b ? b.dataset.cw : 'close'; coWelClose();
    if (a === 'tour') coTour();
    else { if (a === 'sample') act('sample'); else if (a === 'new') { act('new'); act('new'); setTab('projet'); } coTabSoon(curTab, 600); }
  });
  w.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); coWelClose(); coTabSoon(curTab, 600); } });
  setTimeout(() => { const f = w.querySelector('.primary'); if (f) f.focus(); }, 30);
}
(function coInit() {
  setTimeout(() => { CO.ready = true; if (!coOn('copo.welcomeOff')) coWelcome(); else coTabSoon(curTab, 800); }, 600);
})();


