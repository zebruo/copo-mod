// ---------- outils de dessin ----------
// ligne d'aide visible + bulle ⓘ facultative (charte : 120 caractères au plus pour la ligne visible)
function hintSet(id, v, b) { const t = document.getElementById(id + 'T'), w = document.getElementById(id + 'W'), bb = document.getElementById(id + 'B'); if (!t) return; t.textContent = v || ''; w.hidden = !b; bb.textContent = b || ''; }
const HINTS = {
  select: ['Clic : sélectionner (le groupe entier) · Maj+clic : ajouter · glisser : déplacer · cadre : plusieurs', 'Flèches : déplacer de 1 mm (Maj : 10 mm).'],
  nodes: ['Cliquez un vecteur, puis un nœud ou un segment · Maj+clic ou cadre : plusieurs nœuds', 'Rond : lisse, losange : brisé, carré : coin vif ; Symétrique : poignées alignées et de même longueur. Supprimer retire le nœud ou le segment sélectionné ; double-clic sur un segment : ajouter un nœud. Flèches : déplacer (Maj ×10, Alt ÷10) ; Ctrl+A : tous. Poignée : un clic la sélectionne (X/Y ci-dessus), Alt en la tirant la casse, Maj la garde horizontale ou verticale ; nœuds et poignées s’accrochent aux lignes et à leur prolongement.'],
  pan: 'Glissez pour déplacer la vue · molette ou pincement : zoom',
  rect: 'Glissez pour tracer', ellipse: 'Glissez le cadre de l’ellipse · Maj : cercle', circle: 'Cliquez au centre puis glissez jusqu’au rayon',
  polygon: 'Cliquez au centre puis glissez : rayon et orientation',
  poly: ['Clic : point anguleux · cliquer-glisser : point courbe · clic droit : terminer', 'Le trait s’aligne sur l’horizontale ou la verticale du point précédent (Ctrl : angle par pas de 15°). Barre d’espace : termine la ligne et en commence une nouvelle ; clic sur le 1er point : fermer ; Échap : annuler. Commencer sur l’extrémité d’une ligne ouverte la prolonge, la courbe partant dans son axe. Vous pouvez aussi taper le point suivant ci-dessus (X/Y, angle et longueur, ou dx/dy), puis Entrée.'],
  arc: ['Clic : départ · clic : arrivée · déplacez la souris pour le bombé, puis cliquez', 'Mode « Centre » : cliquez au centre, puis au départ et à l’arrivée.'],
  text: 'Réglez le texte, la police et le placement ci-dessous ; le pointillé montre où le texte sera placé.',
  dogbone: 'Cliquez près d’un coin vif entre deux segments droits : dogbone en diagonale, T-bone le long du côté le plus long',
  chamfer: 'Cliquez près d’un coin vif (entre droites, arcs ou courbes)', fillet: 'Cliquez près d’un coin vif (entre droites, arcs ou courbes)',
  trim: 'Cliquez sur la portion de vecteur à supprimer entre deux intersections',
  cut: 'Cliquez sur un vecteur pour le couper à cet endroit',
  extend: ['Cliquez le trait ouvert à prolonger, puis un croisement (rond) sur son prolongement en pointillés', 'Approchez la souris d’une extrémité pour voir son prolongement et ses croisements ; le trait est prolongé jusqu’au croisement cliqué. Échap : choisir un autre trait.'],
  tabedit: ['Clic sur le parcours : ajouter un pont · clic sur un pont : le retirer · glisser : le déplacer', 'Un pont glissé reste sur le parcours. Échap ou « Terminer » pour finir.'],
  measure: 'Glissez pour mesurer', dim: ['Clic : 1er point · clic : 2e point · clic : position de la cote', 'Une extrémité accrochée à un nœud, un milieu ou un centre (point plein) suit le vecteur quand il bouge.'],
};
const TNAME = { extend: 'Étendre les vecteurs', dogbone: 'Dégagement', select: 'Sélection', nodes: 'Nœuds', pan: 'Vue', rect: 'Rectangle', ellipse: 'Ellipse', circle: 'Cercle', polygon: 'Polygone', poly: 'Plume', arc: 'Arc', text: 'Texte', chamfer: 'Chanfrein', fillet: 'Congé', trim: 'Ajuster', cut: 'Couper', tabedit: 'Ponts', measure: 'Mesure', dim: 'Cote' };
const DBL_TOOLS = ['select', 'pan', 'rect', 'ellipse', 'circle', 'polygon', 'arc', 'dim', 'measure'];
// clic droit : termine la ligne en cours, annule le tracé, revient à la sélection, puis désélectionne
function rightClick() {
  if (drag && drag.mode !== 'pan') { drag = null; draw(); }
  // un seul clic droit : termine le tracé en cours, revient à la sélection et désélectionne
  if (pen.length) finishPen(false);
  arcSt = []; dimSt = [];
  if (S.ui.tool !== 'select') { setTool('select'); S.xf = false; S.sel.clear(); S.selDim = null; if (S.imgSel) { S.imgSel = null; renderImgPanel(); } renderSel(); dRefresh(); draw(); return; }
  if (xfOn()) { S.xf = false; draw(); return; }
  if (S.ui.dsec) { S.ui.dsec = null; }
  S.sel.clear(); S.selDim = null; if (S.imgSel) { S.imgSel = null; renderImgPanel(); } renderSel(); dRefresh(); draw();
}
function setTool(t) {
  if (pen.length && t !== 'poly') finishPen(false);
  if (t !== 'text') { textPick = null; S.ui.liveTxt = null; txGhost = null; }
  arcSt = []; dimSt = []; extSt = null; extHov = null; if (t !== 'measure') S.measure = null;
  if (t === 'nodes') { const s = selShapes(); S.ne = s.length === 1 ? { sid: s[0].id, ni: null, seg: null } : null; } else S.ne = null;
  S.ui.tool = t; $$('.palette button, #dgrid [data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
  const ob = $('#optbar'); let extra = '';
  if (t === 'rect') extra = '<label>Coins<select data-k="rectCorner"><option value="none">Carrés</option><option value="fillet">Rayon externe</option><option value="inner">Rayon interne</option><option value="chamfer">Chanfreinés</option></select></label><label>Rayon / distance (mm)<input data-u="len" type="number" data-k="rectR" step="0.5" min="0"></label>';
  if (t === 'polygon') extra = '<label>Côtés ou branches<input type="number" data-k="polyN" step="1" min="3" max="100"></label><label class="chk"><input type="checkbox" data-k="polyStar"> Étoile</label><label>Rayon intérieur (%)<input type="number" data-k="polyInner" step="5" min="5" max="95"></label>';
  if (t === 'chamfer') extra = '<label>Distance (mm)<input data-u="len" type="number" data-k="chamfer" step="0.5" min="0"></label><button data-act="chamferAll">Tous les coins de la sélection</button>';
  if (t === 'fillet') extra = '<label>Rayon (mm)<input data-u="len" type="number" data-k="fillet" step="0.5" min="0"></label><button data-act="filletAll">Tous les coins de la sélection</button>';
  if (t === 'dogbone') extra = '<label>Type<select data-k="dogKind"><option value="dogbone">Dogbone</option><option value="tbone">T-bone</option></select></label><label>Diamètre de la fraise (mm)<input data-u="len" type="number" data-k="dogDia" step="0.1" min="0.1"></label>';
  if (t === 'text') extra = '';
  if (t === 'poly') extra = '<div class="ptnext"><b>Point suivant</b><div class="ptg"><label>X<input data-u="len" type="number" id="ciX" step="0.1"></label><label>Y<input data-u="len" type="number" id="ciY" step="0.1"></label><label>Angle<input type="number" id="ciAng" step="1" title="Angle en degrés depuis le dernier point (0° = vers la droite, 90° = vers le haut)"></label><label>L<input data-u="len" type="number" id="ciLen" step="0.1" min="0" title="Longueur depuis le dernier point"></label><label>dx<input data-u="len" type="number" id="ciDx" step="0.1"></label><label>dy<input data-u="len" type="number" id="ciDy" step="0.1"></label></div><div class="ptb"><button data-act="ciAdd" class="primary" id="ciAddB" disabled>Ajouter</button><button data-act="ciUndo" data-en="Undo">Annuler</button><button data-act="ciClose">Fermer</button><button data-act="ciEnd">Terminer</button></div></div>';
  if (t === 'nodes') extra = '<div class="nebar"><div class="newhat" id="neWhat"></div><div class="nexy"><label class="inl">X<input data-u="len" type="number" id="neX" step="0.1"></label><label class="inl">Y<input data-u="len" type="number" id="neY" step="0.1"></label></div><div class="nexy" id="neHRow" hidden><label class="inl" title="Longueur de la poignée (distance au nœud)">L<input data-u="len" type="number" id="neHL" step="0.1" min="0"></label><label class="inl" title="Angle de la poignée en degrés (0° = vers la droite, 90° = vers le haut)">Angle<input type="number" id="neHA" step="1"></label></div><div class="seg nemode" id="neMode" role="group" aria-label="Coordonnées"><button type="button" value="abs">Absolu</button><button type="button" value="rel">Relatif</button></div><div class="nerow"><button data-act="neCusp" class="nebtn"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18c3-6 6-9 9-9M12 9c3 0 6 3 9 9"/><path d="M12 9L6 4M12 9l6-5" class="nh"/><rect x="10" y="7" width="4" height="4" class="nf"/></svg>Brisé</button><button data-act="neCorner" class="nebtn"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19l9-11 9 11"/><rect x="10" y="6" width="4" height="4" class="nf"/></svg>Coin vif</button><button data-act="neSmooth" class="nebtn"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c4-10 14-10 18 0"/><path d="M5 9h14" class="nh"/><circle cx="5" cy="9" r="1.4" class="nf"/><circle cx="19" cy="9" r="1.4" class="nf"/><rect x="10" y="7" width="4" height="4" class="nf"/></svg>Lisse</button><button data-act="neSym" class="nebtn" title="Nœud symétrique : poignées alignées et de même longueur"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c4-10 14-10 18 0"/><path d="M5 9h14" class="nh"/><path d="M8.5 7.5v3M15.5 7.5v3" class="nh"/><circle cx="5" cy="9" r="1.4" class="nf"/><circle cx="19" cy="9" r="1.4" class="nf"/><circle cx="12" cy="9" r="2.2" class="nf"/></svg>Symétrique</button></div><div class="nerow"><button data-act="neCurve" class="nebtn"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18C6 6 14 18 20 6"/><rect x="2" y="16" width="4" height="4" class="nf"/><rect x="18" y="4" width="4" height="4" class="nf"/></svg>Segment courbe</button><button data-act="neLine" class="nebtn"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18L20 6"/><rect x="2" y="16" width="4" height="4" class="nf"/><rect x="18" y="4" width="4" height="4" class="nf"/></svg>Segment droit</button></div><div class="nerow"><button data-act="neAdd" class="nebtn"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c4-8 14-8 18 0"/><path d="M12 3v8M8 7h8" class="nh"/></svg>Ajouter</button><button data-act="neDel" class="nebtn"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c4-8 14-8 18 0"/><path d="M8 7h8" class="nh"/></svg>Supprimer</button><button data-act="neSplit" class="nebtn"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16c3-5 5-6 7-6M14 10c2 0 4 1 7 6"/><path d="M10 6l4 8M14 6l-4 8" class="nh"/></svg>Couper</button></div><div class="nerow"><button data-act="neExplode" class="nebtn" title="Coupe le profil à chaque nœud : chaque segment devient un vecteur séparé"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 19.5l3.5-7M9.5 9h5M18 12.5l3.5 7"/><path d="M5 11.5l2 2M17 11.5l2 2" class="nh"/><circle cx="7.6" cy="9.6" r="1" class="nf"/><circle cx="16.4" cy="9.6" r="1" class="nf"/></svg>Scinder</button><button data-act="neClose" class="nebtn"><svg class="neico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" stroke-dasharray="3 2.4"/></svg>Ouvrir / fermer</button></div></div>';
  if (CF_T.includes(t)) extra = cfHTML(t, extra);
  if (t === 'measure') extra = '<span class="mono meas" id="measOut">Glissez dans la vue 2D</span>';
  if (t === 'tabedit') extra = '<span class="mono meas" id="tabCount"></span><button data-act="tabDone" class="primary">Terminer</button>';
  // réglages de l'outil : en tête du panneau Dessin ; la barre au-dessus du plan ne sert plus qu'au placement des ponts
  const inBar = t === 'tabedit', wasHidden = ob.hidden;
  if (inBar) { ob.innerHTML = '<span class="tname">' + TNAME[t] + '</span>' + extra + '<span class="hint">' + HINTS[t] + '</span>'; ob.hidden = false; bindK(ob); tabCountUi(); }
  else {
    ob.hidden = true; ob.innerHTML = '';
    const pb = document.querySelector('.palette button[data-tool="' + t + '"]'); $('#tbIco').innerHTML = pb ? (pb.querySelector('svg') || {}).outerHTML || '' : '';
    $('#tbName').textContent = TNAME[t] || t; $('#tbBody').innerHTML = extra; { const h = HINTS[t]; Array.isArray(h) ? hintSet('tbHint', h[0], h[1]) : hintSet('tbHint', h || ''); } bindK($('#tbBody'));
    if (!['select', 'pan'].includes(t)) { S.ui.dsec = null; setTab('dessin'); }
    illRefresh();
  }
  const stg = ob.closest('.stage'); if (stg) stg.classList.toggle('nobar', ob.hidden);
  if (wasHidden !== ob.hidden) requestAnimationFrame(resize);
  if (typeof dRefresh === 'function') dRefresh();
  if (t === 'poly') ciBind();
  if (CF_T.includes(t)) cfBind(t);
  if (t === 'nodes') { ['#neX', '#neY'].forEach(id => $(id).addEventListener('change', neFromInputs)); ['#neHL', '#neHA'].forEach(id => $(id).addEventListener('change', neHandleLA)); $$('#neMode button').forEach(b => b.onclick = () => { S.ui.neRel = b.value === 'rel'; syncNe(); }); syncNe(); }
  hoverCorner = null; hoverEdge = null; cv.style.cursor = t === 'pan' ? 'grab' : (t === 'select' || t === 'nodes') ? 'default' : 'crosshair'; draw();
}
$$('.palette button').forEach(b => b.onclick = () => setTool(b.dataset.tool));
function bindK(root = document) { root.querySelectorAll('[data-k]').forEach(el => { if (el.type === 'checkbox') el.checked = !!S.ui[el.dataset.k]; else el.value = S.ui[el.dataset.k]; }); arrVis(); }
function readK(el) { return el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value; }
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; S.ui[k] = readK(e.target); if (TX_KEYS.includes(k)) { txLive(); txGhost = null; if (txGhP) txGhostReq(txGhP); } $$('[data-k="' + k + '"]').forEach(o => { if (o !== e.target) { if (o.type === 'checkbox') o.checked = e.target.checked; else o.value = e.target.value; } }); if (k === 'arrMode') arrVis(); });
document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.k; if (k) { S.ui[k] = readK(e.target); if (typeof illRefresh === 'function') illRefresh(); if (TX_KEYS.includes(k)) { txLive(); txUi(); } if (k === 'arrMode') arrVis(); } });
function arrVis() { $$('[data-arr]').forEach(el => el.hidden = el.dataset.arr !== S.ui.arrMode); $$('[data-arrfit]').forEach(el => el.hidden = !!S.ui.arrPFit); }

