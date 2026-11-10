// ---------- panneau Dessin ----------
function syncStock() {
  const st = S.stock; st.originXY = originKey(st); if (st.offX === undefined) st.offX = 0; if (st.offY === undefined) st.offY = 0;
  if (!st.flip) st.flip = 'x'; $('#stFlip').value = st.flip; rotAxSync();
  $('#stW').value = st.w; $('#stH').value = st.h; $('#stT').value = st.t; $('#stOZ').value = st.originZ; $('#stOX').value = st.offX; $('#stOY').value = st.offY;
  $$('#stOrigin button').forEach(b => b.setAttribute('aria-pressed', b.dataset.o === st.originXY));
  const o = originOf(st); $('#originHint').textContent = 'X0 Y0 du G-code : ' + originLabel(st) + ', soit à ' + fr(o[0]) + ' / ' + fr(o[1]) + ' mm du coin bas gauche du brut.';
}
function rotAxSync() { if (typeof pjModeSync === 'function') pjModeSync(); }
$('#stFlip').onchange = e => { S.stock.flip = e.target.value; illRefresh(); recomputeAll(); commit(false); };
$('#faceView').onchange = e => { S.ui.faceView = e.target.value; snapVer++; for (const id of [...S.sel]) { const s = shapeById(id); if (s && !shown(s)) S.sel.delete(id); } renderSel(); draw(); };
function originChanged() { syncStock(); commit(false); renderSel(); renderGuides(); draw(); gcDirty = true; if (curTab === 'gcode') renderGcode(); }
$$('#stOrigin button').forEach(b => b.onclick = () => { S.stock.originXY = b.dataset.o; originChanged(); });
$('#stOX').addEventListener('change', e => { S.stock.offX = +e.target.value || 0; originChanged(); });
$('#stOY').addEventListener('change', e => { S.stock.offY = +e.target.value || 0; originChanged(); });
[['#stW', 'w'], ['#stH', 'h'], ['#stT', 't']].forEach(([id, k]) => $(id).addEventListener('change', e => { const v = +e.target.value; if (v > 0) { S.stock[k] = v; originChanged(); } }));
$('#stOZ').onchange = e => { S.stock.originZ = e.target.value; illRefresh(); commit(false); gcDirty = true; };
function renderSel() {
  const ss = selShapes(), ids = ['#selX', '#selY', '#selW', '#selH']; $('#selCount').textContent = ss.length + (ss.length && units(ss).length !== ss.length ? ' · ' + units(ss).length + ' obj.' : '');
  if (!S.editTp) $('#tpApply').textContent = 'Calculer sur la sélection (' + S.sel.size + ')';
  tpSelInfo(); rotSync(); fitSoon(); draw();
  $$('#selAnchor button').forEach(b => b.setAttribute('aria-pressed', b.dataset.a === S.ui.selAnchor));
  if (!ss.length) { ids.forEach(i => { $(i).value = ''; $(i).disabled = true; }); $('#selHint').textContent = ''; { const b = $('#cfEditB'); if (b) b.hidden = true; } if (CF_T.includes(S.ui.tool)) cfBtns(S.ui.tool); return; }
  ids.forEach(i => $(i).disabled = false); const SF = selFrame(), b = { w: SF.w, h: SF.h }, pa = SF.pa, o = outXY(pa[0], pa[1]);
  $('#selHint').textContent = 'X / Y : position du point « ' + ORIGIN_LBL[S.ui.selAnchor] + ' » de la sélection, par rapport à l’origine. Largeur et hauteur changent en gardant ce point fixe.' + (SF.deg ? ' ' + tr('Cadre rotatif : largeur et hauteur sont mesurées dans le sens du vecteur tourné.') : '');
  { const b = $('#txEditB'); if (b) b.hidden = !txSelIsText(); }
  { const b = $('#cfEditB'); if (b) b.hidden = !(ss.length === 1 && ss[0].cf && cfFor(ss[0])); }
  if (CF_T.includes(S.ui.tool)) cfBtns(S.ui.tool);
  $('#selX').value = +o[0].toFixed(3); $('#selY').value = +o[1].toFixed(3); $('#selW').value = +b.w.toFixed(3); $('#selH').value = +b.h.toFixed(3);
  $('#selW').disabled = b.w < 1e-6; $('#selH').disabled = b.h < 1e-6;
  if (typeof dRefresh === 'function') dRefresh();
}
// boîte de la sélection dans le repère du cadre (tourné si « Cadre rotatif » est coché et que les formes ont un angle commun)
function selFrame() { const deg = typeof xfAng === 'function' ? xfAng() : 0; if (!deg) { const b = bbox(selShapes()); return { deg: 0, w: b.w, h: b.h, pa: anchorPt(b, S.ui.selAnchor) }; }
  const F = oFrame(deg), la = anchorPt({ x0: F.x0, y0: F.y0, x1: F.x1, y1: F.y1 }, S.ui.selAnchor); return { deg, F, la, w: F.x1 - F.x0, h: F.y1 - F.y0, pa: F.W(la) }; }
function applySelBox(which) {
  const ss = selShapes(); if (!ss.length) return; const b = bbox(ss), SF = selFrame();
  if (SF.deg) { const pa = SF.pa, F = SF.F;
    if (which === 'X' || which === 'Y') { const tgt = inXY(+$('#selX').value || 0, +$('#selY').value || 0); const dx = which === 'X' ? tgt[0] - pa[0] : 0, dy = which === 'Y' ? tgt[1] - pa[1] : 0; ss.forEach(s => transformShape(s, q => [q[0] + dx, q[1] + dy])); }
    else { const lock = $('#selLock').checked; let fx = SF.w > 1e-6 ? (+$('#selW').value || SF.w) / SF.w : 1, fy = SF.h > 1e-6 ? (+$('#selH').value || SF.h) / SF.h : 1; if (lock) { if (which === 'W') fy = fx; else fx = fy; } if (!(fx > 0) || !(fy > 0)) return; const la = SF.la; ss.forEach(s => transformShape(s, q => { const u = F.L(q); return F.W([la[0] + (u[0] - la[0]) * fx, la[1] + (u[1] - la[1]) * fy]); })); }
    commit(); renderSel(); draw(); return; }
  const pa = anchorPt(b, S.ui.selAnchor);
  if (which === 'X' || which === 'Y') { const tgt = inXY(+$('#selX').value || 0, +$('#selY').value || 0); const dx = which === 'X' ? tgt[0] - pa[0] : 0, dy = which === 'Y' ? tgt[1] - pa[1] : 0; ss.forEach(s => transformShape(s, q => [q[0] + dx, q[1] + dy])); }
  else { const lock = $('#selLock').checked; let fx = b.w > 1e-6 ? (+$('#selW').value || b.w) / b.w : 1, fy = b.h > 1e-6 ? (+$('#selH').value || b.h) / b.h : 1; if (lock) { if (which === 'W') fy = fx; else fx = fy; } if (!(fx > 0) || !(fy > 0)) return; ss.forEach(s => transformShape(s, q => [pa[0] + (q[0] - pa[0]) * fx, pa[1] + (q[1] - pa[1]) * fy])); }
  commit(); renderSel(); draw();
}
['X', 'Y', 'W', 'H'].forEach(k => $('#sel' + k).addEventListener('change', () => applySelBox(k)));
function anchorPt(b, k) { const r = k[0], c = k[1]; return [c === 'l' ? b.x0 : c === 'c' ? (b.x0 + b.x1) / 2 : b.x1, r === 'b' ? b.y0 : r === 'm' ? (b.y0 + b.y1) / 2 : b.y1]; }
$$('#selAnchor button').forEach(bt => bt.onclick = () => { S.ui.selAnchor = bt.dataset.a; renderSel(); draw(); });

// calques
// supprimer un calque : vide, il part tout de suite ; sinon on demande : déplacer ses vecteurs sur un autre calque, ou les supprimer avec lui
function layerDel(l) { const to = S.layers.find(x => x.id === S.layerActive && x !== l) || S.layers.find(x => x !== l); if (!to) return; const mine = S.shapes.filter(s => s.layer === l.id);
  const done = m => { S.layers = S.layers.filter(x => x !== l); if (S.layerActive === l.id) S.layerActive = to.id; commit(); renderLayers(); renderSel(); renderTpList(); draw(); toast(m); };
  if (!mine.length) return done(trf('Calque « {n} » supprimé.', { n: l.name }));
  const ids = new Set(mine.map(s => s.id)), used = S.tps.filter(t => (t.shapeIds || []).some(i => ids.has(i)));
  notice(trf('Le calque « {n} » contient {k} vecteur(s)', { n: l.name, k: mine.length }) + (used.length ? ' ' + trf('utilisé(s) par {p} parcours', { p: used.length }) : '') + '.', [
    { t: trf('Les déplacer sur « {m} »', { m: to.name }), primary: 1, fn: () => { mine.forEach(s => s.layer = to.id); done(trf('Calque supprimé ; ses vecteurs passent sur « {m} ».', { m: to.name })); } },
    { t: tr('Les supprimer aussi'), fn: () => { S.shapes = S.shapes.filter(s => !ids.has(s.id)); for (const id of ids) S.sel.delete(id); for (const t of used) { t.shapeIds = t.shapeIds.filter(i => !ids.has(i)); t.stale = true; } done(trf('Calque « {n} » et ses vecteurs supprimés.', { n: l.name }) + (used.length ? ' ' + tr('Vérifiez les parcours qui les utilisaient.') : '')); } }]); }
function renderLayers() { snapVer++;
  const ul = $('#layerList'); ul.innerHTML = '';
  for (const l of S.layers) {
    const n = S.shapes.filter(s => s.layer === l.id).length, li = document.createElement('li'); li.className = 'layer' + (l.id === S.layerActive ? ' on' : '');
    li.innerHTML = '<input type="radio" name="actLayer" aria-label="Calque actif"><input type="color" class="lcol" title="Couleur des traits du calque" aria-label="Couleur des traits du calque"><input type="text" aria-label="Nom du calque"><span class="chip mono"></span>'
      + '<button class="fbadge' + (l.face === 2 ? ' f2' : '') + '" data-l="face" title="Face usinée : cliquer pour changer (F1 = dessus, F2 = dessous)">' + (l.face === 2 ? 'F2' : 'F1') + '</button>'
      + '<button class="iconbtn" data-l="vis" title="' + (l.visible ? 'Masquer' : 'Afficher') + '" aria-label="Visibilité"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' + (l.visible ? '' : '<path d="M4 4l16 16"/>') + '</svg></button>'
      + '<button class="iconbtn" data-l="lock" title="' + (l.locked ? 'Déverrouiller' : 'Verrouiller') + '" aria-label="Verrou"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="1.5"/>' + (l.locked ? '<path d="M8 11V8a4 4 0 0 1 8 0v3"/>' : '<path d="M8 11V8a4 4 0 0 1 7.5-2"/>') + '</svg></button>'
      + '<button class="iconbtn" data-l="del" title="Supprimer le calque" aria-label="Supprimer"' + (S.layers.length > 1 ? '' : ' disabled') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>';
    const rad = li.querySelector('input[type=radio]'), name = li.querySelector('input[type=text]'), col = li.querySelector('input[type=color]'); rad.checked = l.id === S.layerActive; name.value = l.name;
    col.value = l.color || '#161616'; col.oninput = () => { l.color = col.value; draw(); }; col.onchange = () => { l.color = col.value; commit(false); draw(); }; li.querySelector('.chip').textContent = n;
    rad.onchange = () => { S.layerActive = l.id; renderLayers(); autosave(); };
    name.onchange = () => { l.name = name.value.trim() || l.name; commit(false); };
    li.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
      const a = b.dataset.l;
      if (a === 'face') { l.face = l.face === 2 ? 1 : 2; for (const tp of S.tps) { const sh = tp.shapeIds.map(shapeById).filter(Boolean); if (sh.length && sh.every(x => x.layer === l.id)) tp.face = l.face; } commit(true); renderLayers(); draw(); toast('Calque « ' + l.name + ' » : face ' + l.face + (l.face === 2 ? ' (dessous)' : ' (dessus)') + '.'); return; }
      if (a === 'vis') { l.visible = !l.visible; if (!l.visible) S.shapes.filter(s => s.layer === l.id).forEach(s => S.sel.delete(s.id)); }
      if (a === 'lock') { l.locked = !l.locked; if (l.locked) S.shapes.filter(s => s.layer === l.id).forEach(s => S.sel.delete(s.id)); }
      if (a === 'del') { layerDel(l); return; }
      commit(false); renderLayers(); renderSel(); draw();
    });
    ul.appendChild(li);
  }
}
// repères
function renderGuides() {
  const ul = $('#guideList'); ul.innerHTML = ''; const all = [...S.guides.x.map((v, i) => ['x', i, v]), ...S.guides.y.map((v, i) => ['y', i, v])];
  if (!all.length) { ul.innerHTML = '<li class="hint">Aucun repère.</li>'; return; }
  for (const [axis, i, v] of all) {
    const li = document.createElement('li'); li.dataset.g = axis + i; const lk = guideLk(axis); li.innerHTML = '<span class="mono"></span><input data-u="len" type="number" step="0.1" aria-label="Position du repère"><button class="iconbtn glk" aria-pressed="' + !!lk[i] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="' + (lk[i] ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2') + '"/></svg></button><button class="iconbtn gdel" title="Supprimer" aria-label="Supprimer le repère"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
    { const b = li.querySelector('.glk'), t = tr(lk[i] ? 'Débloquer le repère' : 'Bloquer le repère (il ne se déplace plus à la souris)'); b.title = t; b.setAttribute('aria-label', t); b.onclick = () => { lk[i] = !lk[i]; commit(false); renderGuides(); draw(); }; }
    li.querySelector('span').textContent = axis === 'x' ? 'Vertical X =' : 'Horizontal Y =';
    const inp = li.querySelector('input'); inp.value = +(axis === 'x' ? outXY(v, 0)[0] : outXY(0, v)[1]).toFixed(3);
    inp.onchange = () => { const w = axis === 'x' ? inXY(+inp.value, 0)[0] : inXY(0, +inp.value)[1]; S.guides[axis][i] = w; commit(false); draw(); };
    li.querySelector('.gdel').onclick = () => { guideDel(axis, i); commit(false); renderGuides(); draw(); };
    ul.appendChild(li);
  }
}

