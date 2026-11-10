// ---------- panneau Dessin : grille d'icônes + zone de contexte ----------
const DI = {
  arrPath: SVG24('<path class="bo bd" d="M2.5 19c4-11 15-11 19-3"/><rect class="bo" x="3" y="12.5" width="4" height="4" transform="rotate(-55 5 14.5)"/><rect class="bo" x="10" y="6.5" width="4" height="4"/><rect class="bo" x="16.5" y="9" width="4" height="4" transform="rotate(35 18.5 11)"/>'),
  neExplode: SVG24('<path class="bo" d="M2.5 19.5l3.5-7M9.5 9h5M18 12.5l3.5 7"/><path class="bo bd" d="M7 13.5l2-2M15 11.5l2 2"/>'),
  img: SVG24('<rect class="bo" x="2.5" y="4.5" width="19" height="15" rx="1.5"/><circle class="bo bd" cx="16.5" cy="9" r="2"/><path class="bo" d="M3 18l5.5-6.5 3.5 4 2.5-2.5L21 18"/>'),
  img0: SVG24('<rect class="bo" x="3" y="5" width="18" height="14" rx="1.5"/><circle class="bo" cx="8.5" cy="10" r="1.6"/><path class="bo" d="M3.5 17l5-5 4 4 3-3 5 5"/>'),
  align: SVG24('<path class="bo" d="M4 3v18"/><rect class="bo" x="7" y="6" width="12" height="4"/><rect class="bo" x="7" y="14" width="7" height="4"/>'),
  array: SVG24('<rect class="bo" x="3" y="3" width="5" height="5"/><rect class="bo" x="10" y="3" width="5" height="5"/><rect class="bo" x="17" y="3" width="4" height="5"/><rect class="bo" x="3" y="10" width="5" height="5"/><rect class="bo" x="10" y="10" width="5" height="5"/><rect class="bo" x="3" y="17" width="5" height="4"/>'),
  nest: SVG24('<rect class="bo bd" x="2.5" y="2.5" width="19" height="19" rx="1"/><path class="bo" d="M5 5h6v5H5zM13 5l6 0-3 6zM5 13h4v6H5zM12 14a3 3 0 1 0 6 0 3 3 0 1 0-6 0"/>'),
  center: SVG24('<rect class="bo bd" x="2.5" y="4.5" width="19" height="15" rx="1"/><rect class="bo" x="8" y="9" width="8" height="6"/><path class="bo" d="M12 2v4M12 18v4"/>'),
  mirH: SVG24('<path class="bo bd" d="M12 2v20"/><path class="bo" d="M9 6L3 18h6zM15 6l6 12h-6z"/>'),
  mirV: SVG24('<path class="bo bd" d="M2 12h20"/><path class="bo" d="M6 9L18 3v6zM6 15l12 6v-6z"/>'),
  guides: SVG24('<path class="bo bd" d="M8 2v20M2 15h20"/><path class="bo" d="M14 5h6M17 2v6"/>'),
  dlibOpen: SVG24('<path class="bo" d="M5 4v16M9 4v16M13 4v16"/><path class="bo bd" d="M16.5 4.5l3.5 15"/>'),
  fb: SVG24('<path class="bo" d="M2 8l20-2v12L2 16z"/><path class="bo" d="M7 7.5v9M11 7.1v9.8M14.5 6.8v10.4M17.5 6.5v11"/>'),
  box: SVG24('<path class="bo" d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path class="bo" d="M3 8l9 4 9-4M12 12v9"/><path class="bo bd" d="M6 10.5v2.5M9 12v2.5M15 12v2.5M18 10.5v2.5"/>'),
  gr: SVG24('<ellipse class="bo" cx="6" cy="12" rx="3" ry="8"/><path class="bo" d="M6 4h12M6 20h12M18 4a3 8 0 0 1 0 16"/><path class="bo bd" d="M9 7.5h4M9.5 12h7M9 16.5h4"/>'),
  ip: SVG24('<path class="bo" d="M3 10h5v4h8v-4h5"/><path class="bo bd" d="M8.5 4.5h7v5h-7z"/>'),
  il: SVG24('<path class="bo" d="M3 7h6l3 5 3-5h6"/><path class="bo bd" d="M3 17h6l3-5 3 5h6"/>'),
};
DI.mirror = DI.mirH;
DI.traceOutline = SVG24('<path class="bo" d="M6.5 16.5l3.4-5.2 2.4 2.8 2-2.6 3.2 5"/><path class="bo" stroke-dasharray="2.6 2" d="M3.5 7.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z"/>');
const DGRID = [ // [titre, zone de la grille, colonnes, icônes]
  ['Sélection', 'sel', 2, [['t', 'select'], ['t', 'nodes']]],
  ['Bibliothèque', 'lib', 1, [['a', 'dlibOpen', 'Bibliothèque de dessins et d’images', 0]]],
  ['Mesurer', 'mes', 3, [['t', 'measure'], ['t', 'dim'], ['s', 'guides', 'Repères']]],
  ['Créer', 'cre', 4, [['t', 'poly'], ['t', 'rect'], ['t', 'circle'], ['t', 'arc'], ['t', 'ellipse'], ['t', 'polygon'], ['t', 'text'], ['s', 'offset', 'Contour décalé'], ['s', 'img', 'Importer (image / vectoriel)'], ['a', 'traceOutline', 'Contour : vectoriser l’image sélectionnée ou créer le contour du relief sélectionné', 0]]],
  ['Modifier', 'mod', 3, [['t', 'chamfer'], ['t', 'fillet'], ['t', 'dogbone'], ['t', 'trim'], ['t', 'cut'], ['t', 'extend'], ['s', 'join', 'Joindre et relier des vecteurs'], ['s', 'fit', 'Lisser (adapter des courbes)'], ['a', 'neExplode', 'Scinder : couper le profil à chaque nœud', 1]]],
  ['Disposer', 'dis', 4, [['s', 'align', 'Aligner et répartir'], ['s', 'rotate', 'Rotation'], ['s', 'array', 'Copie en réseau'], ['a', 'arrPath', 'Répéter le long d’une courbe', 2], ['s', 'nest', 'Imbrication'], ['a', 'center', 'Centrer sur le brut', 1], ['s', 'mirror', 'Miroir']]],
  ['Combiner', 'com', 3, [['a', 'boolU', 'Souder', 2], ['a', 'boolS', 'Soustraire (à partir du premier vecteur sélectionné)', 2], ['a', 'boolI', 'Intersection (à partir du premier vecteur sélectionné)', 2], ['a', 'group', 'Grouper (Ctrl+G)', 2], ['a', 'ungroup', 'Dégrouper (Ctrl+Maj+G)', 1]]],
];
function offSegSync() { const v = S.ui.offSide || 'out'; document.querySelectorAll('#offSeg button').forEach(b => b.setAttribute('aria-pressed', b.value === v)); }
function dgInit() {
  document.querySelectorAll('#offSeg button').forEach(b => b.onclick = () => { S.ui.offSide = b.value; offSegSync(); }); offSegSync();
  const g = $('#dgrid'); if (!g || g.childElementCount) return;
  for (const [title, area, cols, items] of DGRID) {
    const grp = document.createElement('div'); grp.className = 'dg-group'; grp.style.gridArea = area; grp.innerHTML = '<span>' + title + '</span><div class="dg-icons"></div>'; const box = grp.lastChild; box.style.setProperty('--n', cols);
    for (const [kind, key, label, need] of items) {
      const b = document.createElement('button'); b.type = 'button';
      if (kind === 't') { const pb = document.querySelector('.palette button[data-tool="' + key + '"]'); if (!pb) continue; b.dataset.tool = key; b.title = pb.title || pb.dataset.tip || ''; b.setAttribute('aria-label', pb.getAttribute('aria-label') || pb.title); b.innerHTML = pb.querySelector('svg').outerHTML; b.onclick = () => { S.ui.dsec = null; setTool(key); }; }
      else if (kind === 's') { b.dataset.sec = key; b.title = label; b.setAttribute('aria-label', label); b.innerHTML = (DI[key] || BICO[key] || '').replace('<svg', '<svg class="bico"'); b.onclick = () => dSec(key); }
      else { b.dataset.dact = key; b.dataset.need = need || 0; b.title = label; b.setAttribute('aria-label', label); b.innerHTML = ((BICO[key] || DI[{ fbOpen: 'fb', ilOpen: 'il', ipOpen: 'ip', boxOpen: 'box', grOpen: 'gr' }[key] || key]) || '').replace('<svg', '<svg class="bico"'); b.onclick = () => act(key); }
      box.appendChild(b);
    }
    g.appendChild(grp);
  }
}
function dSec(key) { const same = S.ui.dsec === key && S.ui.tool === 'select'; if (S.ui.tool !== 'select') setTool('select'); S.ui.dsec = same ? null : key; if (key === 'img' && !same && !S.images.length) { } dRefresh(); }
function dRefresh() {
  const t = S.ui.tool, pane = document.querySelector('[data-pane="dessin"]'); if (!pane) return;
  const toolForm = !['select', 'pan'].includes(t) && t !== 'tabedit';
  let show = null;
  if (toolForm) show = t === 'text' ? 'text' : t === 'dim' ? 'guides' : null;
  else if (S.ui.dsec) show = S.ui.dsec;
  else if (S.imgSel) show = 'img';
  else if (S.sel.size) show = 'sel';
  $('#toolBlk').hidden = !toolForm;
  pane.querySelectorAll('.dsec').forEach(el => { el.hidden = el.dataset.sec !== show; });
  $('#dEmpty').hidden = !!(toolForm || show);
  const n = S.sel.size;
  pane.querySelectorAll('#dgrid [data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
  pane.querySelectorAll('#dgrid [data-sec]').forEach(b => b.setAttribute('aria-pressed', !toolForm && b.dataset.sec === show && !!S.ui.dsec));
  pane.querySelectorAll('#dgrid [data-dact]').forEach(b => { b.disabled = n < +b.dataset.need; });
  { const setm = !!(toolForm || S.ui.dsec); pane.classList.toggle('setm', setm); pane.classList.toggle('imgsel', !!S.imgSel); if (!setm) peekSet(pane, false); }
  rotSync(); joinSync(); fitPreview(); if (show === 'text') txUi(); if (show === 'ip' && typeof ipInfo === 'function') ipInfo(); if (show === 'il' && typeof ilInfo === 'function') { const e = document.getElementById('ilSel'); if (e) e.textContent = trf('{n} vecteur(s) sélectionné(s) comme motif.', { n: ilSel().length }); ilInfo(); } draw();
}

