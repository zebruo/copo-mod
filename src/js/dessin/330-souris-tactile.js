// ---------- souris / tactile ----------
let penCont = null, drag = null, pen = [], arcSt = [], dimSt = [], hover = null, hoverCorner = null, hoverEdge = null; const pointers = new Map(); let pinch = null, spaceDown = false;
const DRAG_MIN = () => lastPtrType === 'touch' || lastPtrType === 'pen' ? 10 : 6; // seuil (px) avant qu'un glisser ne déplace l'objet
let lastPtrType = 'mouse', shiftHeld = false, ctrlHeld = false; window.addEventListener('keydown', e => { if (e.key === 'Control' || e.key === 'Meta') ctrlHeld = true; }, true); window.addEventListener('keyup', e => { if (e.key === 'Control' || e.key === 'Meta') ctrlHeld = false; }, true); window.addEventListener('blur', () => { ctrlHeld = false; }); window.addEventListener('keydown', e => { if (e.key === 'Shift') shiftHeld = true; }, true); window.addEventListener('keyup', e => { if (e.key === 'Shift') shiftHeld = false; }, true); window.addEventListener('blur', () => { shiftHeld = false; }); const downHist = [];
const evPt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const restCursor = () => S.ui.tool === 'pan' ? 'grab' : (S.ui.tool === 'select' || S.ui.tool === 'nodes') ? 'default' : 'crosshair';
cv.addEventListener('pointerdown', e => {
  cv.focus({ preventScroll: true }); cv.setPointerCapture(e.pointerId); const [X, Y] = evPt(e); pointers.set(e.pointerId, [X, Y]); lastPtrType = e.pointerType;
  if (e.button === 0) { downHist.push({ xf: xfOn(), key: selKey(), tool: S.ui.tool }); if (downHist.length > 3) downHist.shift(); }
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s: S.view.s, ox: S.view.ox, oy: S.view.oy }; drag = null; return; }
  const p = [wx(X), wy(Y)], t = S.ui.tool;
  if (e.button === 1 || t === 'pan' || spaceDown) { drag = { mode: 'pan', X, Y, ox: S.view.ox, oy: S.view.oy }; cv.style.cursor = 'grabbing'; return; }
  if (e.button !== 0) return;
  if (X < RB || Y < RB) { if (X < RB && Y < RB) return; const axis = Y < RB ? 'y' : 'x'; S.guides[axis].push(axis === 'x' ? p[0] : p[1]); guideLk(axis); drag = { mode: 'guide', axis, i: S.guides[axis].length - 1 }; draw(); return; }
  if (t === 'select') {
    const ih = relHandleAt(X, Y) || imgHandleAt(X, Y);
    const xh = xfHandleAt(X, Y);
    if (xh) {
      const ss = selShapes(), orig = ss.map(s => [s, s.nodes.map(cloneNode), +s.rot || 0]), piv0 = PIV && PIV.key === selKey() ? PIV.p.slice() : null;
      if (xh.k === 'p') drag = { mode: 'pivot', moved: false };
      else if (xh.k === 'r') { const c = pivotPt().slice(); drag = { mode: 'srot', c, a0: Math.atan2(p[1] - c[1], p[0] - c[0]), orig, ra: orig.length ? shapeAng(orig[0][0]) : 0, ang: 0, moved: false }; cv.style.cursor = 'grabbing'; }
      else drag = { mode: 'sscale', h: xh, orig, piv0, moved: false };
      draw(); return;
    }
    if (ih) { const im = ih.im; drag = ih.kind === 'iedge' ? { mode: 'iedge', im, sgn: ih.sgn, anchor: ih.anchor, w0: im.w, h0: im.h, zH0: +im.zH || 0, rel: !!ih.rel, p0: p } : ih.kind === 'irot' ? { mode: 'irot', im, rot0: im.rot || 0, a0: Math.atan2(p[1] - im.y, p[0] - im.x), rel: !!ih.rel } : { mode: 'iscale', im, sgn: ih.sgn, anchor: ih.anchor, w0: im.w, h0: im.h, zH0: +im.zH || 0, rel: !!ih.rel }; draw(); return; }
    if (relClipPick) { const hc = hitShape(p); if (hc && hc.closed) { S.sel.has(hc.id) ? S.sel.delete(hc.id) : S.sel.add(hc.id); renderSel(); relPanel(true); draw(); } else if (hc) toast(tr('Ce vecteur est ouvert : seuls les vecteurs fermés peuvent limiter un relief.')); return; } // choix des vecteurs qui limitent le relief
    const h = hitShape(p) || (!e.shiftKey ? hitSelInside(p) : null);
    if (h) {
      S.selDim = null; if (S.imgSel) { S.imgSel = null; renderImgPanel(); } if (S.relSel) { S.relSel = null; relPanel(); } const ids = groupIds(h), wasSel = S.sel.has(h.id) && !e.shiftKey;
      if (e.shiftKey) { const has = S.sel.has(h.id); ids.forEach(id => has ? S.sel.delete(id) : S.sel.add(id)); } else if (!S.sel.has(h.id)) { S.sel.clear(); ids.forEach(id => S.sel.add(id)); }
      renderSel(); drag = { mode: 'move', X0: X, Y0: Y, anc: moveAnchor(p), praw: p.slice(), p0: snap(p, S.sel), bb0: bbox(selShapes()), orig: selShapes().map(s => [s, s.nodes.map(cloneNode)]), moved: false, wasSel, piv0: PIV && PIV.key === selKey() ? PIV.p.slice() : null };
    } else {
      const dm = hitDim(p), gd = hitGuide(X, Y);
      RELBAR = null; const hi = !dm && !gd ? imgHit(p) : null, hr = !dm && !gd && !hi ? relHit(p) : null;
      if (dm) { S.selDim = dm.id; S.sel.clear(); renderSel(); }
      else if (gd) { drag = { mode: 'guide', axis: gd.axis, i: gd.i }; }
      else if (hi) { const was = S.imgSel === hi.id; if (!was) { IXF = false; selectImg(hi.id); } drag = { mode: 'imove', im: hi, off: [hi.x - p[0], hi.y - p[1]], toggleXf: was, X0: X, Y0: Y }; }
      else if (hr && !$('#tpWin').hidden) { tpRelPick(hr.id); }
      else if (hr && e.shiftKey && S.relSel && S.relSel !== hr.id) { relMulti.add(S.relSel); if (relMulti.has(hr.id)) relMulti.delete(hr.id); else relMulti.add(hr.id); selectRel(hr.id, true); toast(trf('{n} reliefs sélectionnés : alignez-les ou répartissez-les (onglet Relief ou Dessin › Aligner et répartir).', { n: relSelIds().length })); }
      else if (hr) { const was = S.relSel === hr.id; if (!was) { RXF = false; selectRel(hr.id); if (curTab !== 'relief') setTab('relief'); } drag = { mode: 'imove', im: hr, off: [hr.x - p[0], hr.y - p[1]], rel: true, toggleXf: was, X0: X, Y0: Y }; relDragPrep(hr); }
      else { S.selDim = null; if (S.imgSel) { S.imgSel = null; renderImgPanel(); } if (S.relSel) { S.relSel = null; relPanel(); } if (!e.shiftKey) S.sel.clear(); renderSel(); drag = { mode: 'band', sx0: X, sy0: Y, sx1: X, sy1: Y }; }
    }
  } else if (t === 'nodes') nodesDown(p, e, X, Y);
  else if (['rect', 'ellipse', 'circle', 'polygon'].includes(t)) { const q = snap(p); drag = { mode: t, p0: q, p1: q, shift: e.shiftKey }; }
  else if (t === 'poly') {
    const q = snap(p);
    if (!pen.length) penCont = penContAt(snapMark);
    if (penCont && pen.length > 1) { const sh = shapeById(penCont.sid), O = sh && (penCont.start ? sh.nodes[sh.nodes.length - 1] : sh.nodes[0]); if (O && Math.hypot(q[0] - O.x, q[1] - O.y) * S.view.s < 10) { finishPen(true); return; } }
    else if (!penCont && pen.length > 2 && Math.hypot(q[0] - pen[0].x, q[1] - pen[0].y) * S.view.s < 10) { finishPen(true); return; }
    const n = NODE(q[0], q[1]); pen.push(n); drag = { mode: 'pen', node: n, p0: q };
    if (penCont && pen.length === 1) toast(tr('Prolongement de la ligne : le tracé part dans son axe (glissez depuis ce point pour régler la tension de la courbe).'));
  } else if (t === 'arc') {
    const q = snap(p); arcSt.push(q);
    if (arcSt.length === 3) { const A = arcByMode(arcSt[0], arcSt[1], arcSt[2]), s = mkShape(A.nodes, false); arcSt = []; if (s) { S.sel.clear(); S.sel.add(s.id); renderSel(); commit(); cfFromArc(A, s); } }
  } else if (t === 'dim') {
    const q = snap(p); if (dimSt.length < 2) { if (dimSt.length === 1 && hyp(q, dimSt[0]) < 1e-6) return; if (!dimSt.length) dimRefs = []; dimRefs[dimSt.length] = snapRefOf(snapMark); dimSt.push(q); } else { const d = dimPreview(q), nd = { id: uid(), a: d.a, b: d.b, off: d.off }; if (dimRefs[0]) nd.ra = dimRefs[0]; if (dimRefs[1]) nd.rb = dimRefs[1]; S.dims.push(nd); dimSt = []; dimRefs = []; commit(false); }
  } else if (t === 'measure') { const q = snap(p); S.measure = { a: q, b: q }; drag = { mode: 'measure' }; }
  else if (t === 'tabedit') tabDown(p);
  else if (t === 'text') {
    if (!S.font) { toast('Choisissez d’abord une police.'); act('fpGoto'); return; }
    if (!String(S.ui.text).trim()) { toast('Saisissez le texte à graver.'); return; }
    const m = txMode();
    if (m === 'between') { // texte entre deux courbes : 1er clic la base, 2e clic le haut
      const cs = hitEdge(p, 12); if (!cs) { toast(tr(textPick ? 'Cliquez la courbe du haut.' : 'Cliquez la courbe du bas (ligne de base), puis la courbe du haut.')); return; }
      if (!textPick) { textPick = cs.id; txUi(); draw(); toast(tr('Courbe du bas choisie : cliquez la courbe du haut.')); return; }
      const a = textPick; textPick = null; if (a === cs.id) { txUi(); toast(tr('Choisissez deux courbes différentes.')); return; }
      const n = txCreate({ a, b: cs.id }); if (n) toast(trf('Texte placé entre les deux courbes ({n} contours, groupés).', { n })); return;
    }
    if (m !== 'line') {
      const cs = hitEdge(p, 12); if (!cs) { toast(tr('Cliquez sur une courbe ou un vecteur : ligne, arc, cercle, rectangle…')); return; }
      const n = txCreate({ cid: cs.id, click: p.slice() }); if (n) toast(trf('Texte placé sur la courbe ({n} contours, groupés) : les réglages le modifient en direct.', { n })); return;
    }
    const n = txCreate({ at: snap(p) }); if (n) toast(S.font.singleLine ? trf('Texte à trait unique créé ({n} traits, groupés) : usinez-le avec un profil « Sur la ligne ».', { n }) : trf('{n} contours de texte créés (groupés) : les réglages le modifient en direct.', { n }));
  } else if (t === 'dogbone') {
    const c = findCorner(p); if (!c) { toast('Aucun coin vif à cet endroit.'); return; }
    const D = +S.ui.dogDia; if (!(D > 0)) { toast('Indiquez le diamètre de la fraise.'); return; }
    const n = c.s.nodes.length; if (!segIsLine(c.s, (c.i - 1 + n) % n) || !segIsLine(c.s, c.i)) { toast('Dogbone et T-bone : seulement entre deux segments droits.'); return; }
    if (!applyDog(c.s, c.i, S.ui.dogKind === 'tbone' ? 'tbone' : 'dogbone', D)) { toast('Côtés trop courts pour ce diamètre.'); return; } hoverCorner = null; commit();
  } else if (t === 'chamfer' || t === 'fillet') {
    const c = findCorner(p), J = !c && findJunction(p); if (!c && !J) { toast('Aucun coin vif à cet endroit.'); return; }
    const v = t === 'chamfer' ? +S.ui.chamfer : +S.ui.fillet; if (!(v > 0)) { toast('Indiquez une valeur supérieure à 0.'); return; }
    if (J) { if (!cornerByJoin(J, t, v)) { toast(t === 'fillet' ? 'Rayon trop grand pour ce coin : réduisez-le.' : 'Distance trop grande pour ce coin : réduisez-la.'); return; } hoverCorner = null; commit(); toast(tr('Les deux vecteurs ont été joints pour faire le coin.')); }
    else {
    if (!applyCorner(c.s, c.i, t, v, 0.999)) { toast(t === 'fillet' ? 'Rayon trop grand pour ce coin : réduisez-le.' : 'Distance trop grande pour ce coin : réduisez-la.'); return; } hoverCorner = null; commit(); }
  } else if (t === 'trim') {
    const s = hitEdge(p, 8); if (!s) { toast('Cliquez sur un vecteur.'); return; }
    const pieces = trimPieces(s, S.shapes.filter(o => o !== s && shown(o)), p);
    if (pieces === null) { toast('Il faut au moins deux intersections pour ajuster un contour fermé.'); return; }
    replaceShape(s, pieces.map(n => ({ nodes: n, closed: false }))); hoverEdge = null; renderSel(); commit();
  } else if (t === 'extend') { extClick(p); return;
  } else if (t === 'cut') {
    const s = hitEdge(p, 8); if (!s) { toast('Cliquez sur un vecteur.'); return; }
    const pieces = cutPieces(s, paramAt(s, p).u); if (!pieces) { toast('Impossible de couper à l’extrémité d’un vecteur ouvert.'); return; }
    replaceShape(s, pieces.map(n => ({ nodes: n, closed: false }))); renderSel(); commit(); toast(s.closed ? 'Contour ouvert à cet endroit.' : 'Vecteur coupé en deux.');
  }
  draw();
});
// nœuds sélectionnés (plusieurs avec Maj ou un cadre)
function neSel() { const ne = S.ne; if (!ne) return []; if (ne.ms && ne.ms.size > 1) return [...ne.ms]; return ne.ni !== null && ne.ni !== undefined ? [ne.ni] : []; }
function neSetSel(list, primary) { const ne = S.ne; if (!ne) return; ne.h = null; ne.ms = new Set(list); ne.ni = list.length ? (primary !== undefined && list.includes(primary) ? primary : list[list.length - 1]) : null; ne.seg = null; }
// pas des flèches : 1 mm (1/16 po), Maj ×10 ; Ctrl : pas fin selon le zoom (≈ 1 pixel de l'écran, arrondi à 1, 2 ou 5), Ctrl+Maj : 10 pixels ; Alt : ÷10
function nudgeStep(e) { const inch = UNIT.len === 'in', u = inch ? 25.4 : 1; let d;
  if (e.ctrlKey || e.metaKey) { const px = (e.shiftKey ? 10 : 1) / S.view.s / u, k = Math.pow(10, Math.floor(Math.log10(px))), m = px / k; d = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * k * u; }
  else d = inch ? (e.shiftKey ? 6.35 : 1.5875) : (e.shiftKey ? 10 : 1); if (e.altKey) d /= 10; NUDGE = d; return d; }
let NUDGE = 0, NUDGE_T = 0; const nudgeTell = () => { if (NUDGE === NUDGE_T) return; NUDGE_T = NUDGE; toast(trf('Pas fin des flèches (selon le zoom) : {d}', { d: UNIT.len === 'in' ? fr(NUDGE / 25.4, 4) + ' po' : fr(NUDGE, 3) + ' mm' })); };
function neMove(dx, dy) { const s = S.ne && shapeById(S.ne.sid), L = neSel(); if (!s || !L.length) return false; for (const i of L) { const n = s.nodes[i]; if (n) { n.x += dx; n.y += dy; } } refresh(s); return true; }
function nodesDown(p, e, X, Y) {
  const tol = 7 / S.view.s, s = S.ne && shapeById(S.ne.sid);
  if (s) {
    for (const h of visibleHandles(s)) if (hyp(h.p, p) < tol) { S.ne.h = { i: h.i, w: h.w }; syncNe(); drag = { mode: 'handle', s, i: h.i, w: h.w, alt: e.altKey, moved: false, X0: X, Y0: Y, off: [h.p[0] - p[0], h.p[1] - p[1]] }; draw(); return; }
    let bi = -1, bd = tol; s.nodes.forEach((n, i) => { const d = Math.hypot(n.x - p[0], n.y - p[1]); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) {
      const cur = neSel();
      if (e.shiftKey) { const set = new Set(cur); if (set.has(bi)) set.delete(bi); else set.add(bi); neSetSel([...set], set.has(bi) ? bi : undefined); draw(); return; }
      if (!cur.includes(bi)) neSetSel([bi]); else { S.ne.ni = bi; S.ne.h = null; }
      const L = neSel(); drag = { mode: 'node', X0: X, Y0: Y, s, i: bi, ids: L, orig: L.map(i => [s.nodes[i].x, s.nodes[i].y]), p0: [s.nodes[bi].x, s.nodes[bi].y], moved: false }; return;
    }
    if (edgeDist(s, p) < tol) { S.ne.h = null; const u = paramAt(s, p).u; S.ne.seg = Math.min(nseg(s) - 1, Math.floor(u)); S.ne.ni = null; S.ne.ms = null; return; }
    const h0 = hitEdge(p, 7);
    if (!h0 || h0.id === s.id) { drag = { mode: 'nband', sx0: X, sy0: Y, sx1: X, sy1: Y, add: e.shiftKey, s }; return; }
  }
  const h = hitShape(p);
  if (h) { S.ne = { sid: h.id, ni: null, seg: null }; S.sel.clear(); S.sel.add(h.id); renderSel(); }
  else { S.ne = null; S.sel.clear(); renderSel(); }
}
cv.addEventListener('pointermove', e => {
  const [X, Y] = evPt(e); if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [X, Y]);
  if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const s = Math.max(0.05, Math.min(200, pinch.s * d / pinch.d)); const wx0 = (pinch.c[0] - pinch.ox) / pinch.s, wy0 = (pinch.oy - pinch.c[1]) / pinch.s; S.view.s = s; S.view.ox = c[0] - wx0 * s; S.view.oy = c[1] + wy0 * s; draw(); return; }
  const p = [wx(X), wy(Y)], t = S.ui.tool, D = drag;
  if (!D && t === 'text') txGhostReq(p);
  if (D) {
    if (D.mode === 'pan') { S.view.ox = D.ox + X - D.X; S.view.oy = D.oy + Y - D.Y; draw(); return; }
    if (D.mode === 'guide') { const q = snap(p); S.guides[D.axis][D.i] = D.axis === 'x' ? q[0] : q[1]; setCoords(q, 'repère'); draw(); return; }
    if (D.mode === 'imove' || D.mode === 'iscale' || D.mode === 'irot' || D.mode === 'iedge') { if (D.mode === 'imove' && !D.moved && D.X0 !== undefined && Math.hypot(X - D.X0, Y - D.Y0) < DRAG_MIN()) return; imgDragMove(D, p, e); return; }
    if (D.mode === 'tabdrag') { const pr = projectOnLoops(D.tp.loops, p); if (pr) { D.tp.p.tabPts[D.idx] = [pr.x, pr.y]; if (D.tp.tabs && D.tp.tabs[D.idx]) D.tp.tabs[D.idx] = { x: pr.x, y: pr.y, a: pr.a }; if (hyp(p, D.start) * S.view.s > 3) D.moved = true; draw(); } return; }
    if (D.mode === 'pivot') { const q = snap(p); PIV = { key: selKey(), p: q }; D.moved = true; const o = outXY(q[0], q[1]); setCoords(q, tr('Pivot') + ' ' + fr(o[0]) + ' / ' + fr(o[1])); rotSync(); draw(); return; }
    if (D.mode === 'srot') { let ang = (Math.atan2(p[1] - D.c[1], p[0] - D.c[0]) - D.a0) * 180 / Math.PI; ang = normDeg(ang); const r0 = D.ra || 0; if (e.ctrlKey || e.metaKey) { const q = e.shiftKey ? 1 : 15; ang = normDeg(Math.round((r0 + ang) / q) * q - r0); } // Ctrl : angle absolu par 15° (0, 15, 30…), Ctrl + Maj : par 1°
    const f = rotPts(D.c, ang); for (const [s, o] of D.orig) { s.nodes = o.map(cloneNode); transformShape(s, f); } D.ang = ang; D.moved = D.moved || Math.abs(ang) > 1e-9; setCoords(p, tr('Angle') + ' ' + fDeg(normDeg(r0 + ang))); draw(); return; }
    if (D.mode === 'sscale' && D.h.deg) { const h = D.h, a = h.deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), L = v => [v[0] * c + v[1] * sn, -v[0] * sn + v[1] * c], Wf = v => [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c], q = L(snap(p, S.sel)), ax = h.la[0], ay = h.la[1], dxw = h.lw[0] - ax, dyw = h.lw[1] - ay;
      let kx = h.cx && Math.abs(dxw) > 1e-9 ? (q[0] - ax) / dxw : 1, ky = h.cy && Math.abs(dyw) > 1e-9 ? (q[1] - ay) / dyw : 1;
      if (h.cx && h.cy && ($('#selLock').checked !== e.shiftKey)) { const m = Math.abs(kx) > Math.abs(ky) ? kx : ky; kx = ky = m; }
      if (e.ctrlKey || e.metaKey) { const rd = (k, d) => Math.abs(d) > 1e-9 ? Math.sign(k || 1) * Math.max(1, Math.round(Math.abs(k * d))) / Math.abs(d) : k; if (h.cx) kx = rd(kx, dxw); if (h.cy) ky = rd(ky, dyw); }
      const cl = v => Math.abs(v) < 1e-3 ? (v < 0 ? -1e-3 : 1e-3) : v; kx = cl(kx); ky = cl(ky);
      const f = v => { const u = L(v); return Wf([ax + (u[0] - ax) * kx, ay + (u[1] - ay) * ky]); };
      for (const [s, o] of D.orig) { s.nodes = o.map(cloneNode); transformShape(s, f); }
      if (D.piv0) PIV = { key: selKey(), p: f(D.piv0) };
      D.moved = true; setCoords(p, fr(Math.abs((h.cx ? dxw * kx : 0) || (dyw * ky))) + ' mm'); draw(); return; }
    if (D.mode === 'sscale') {
      const h = D.h, q = snap(p, S.sel), ax = h.a[0], ay = h.a[1], dxw = h.w[0] - ax, dyw = h.w[1] - ay;
      let kx = h.cx && Math.abs(dxw) > 1e-9 ? (q[0] - ax) / dxw : 1, ky = h.cy && Math.abs(dyw) > 1e-9 ? (q[1] - ay) / dyw : 1;
      if (h.cx && h.cy && ($('#selLock').checked !== e.shiftKey)) { const m = Math.abs(kx) > Math.abs(ky) ? kx : ky; kx = ky = m; }
      if (e.ctrlKey || e.metaKey) { const rd = (k, d) => Math.abs(d) > 1e-9 ? Math.sign(k || 1) * Math.max(1, Math.round(Math.abs(k * d))) / Math.abs(d) : k; if (h.cx && h.cy && kx === ky) kx = ky = rd(kx, Math.max(Math.abs(dxw), Math.abs(dyw))); else { if (h.cx) kx = rd(kx, dxw); if (h.cy) ky = rd(ky, dyw); } }
      const cl = v => Math.abs(v) < 1e-3 ? (v < 0 ? -1e-3 : 1e-3) : v; kx = cl(kx); ky = cl(ky);
      const f = v => [ax + (v[0] - ax) * kx, ay + (v[1] - ay) * ky];
      for (const [s, o] of D.orig) { s.nodes = o.map(cloneNode); transformShape(s, f); }
      if (D.piv0) PIV = { key: selKey(), p: f(D.piv0) };
      D.moved = true; const b = bbox(selShapes()); setCoords(q, fr(b.w) + ' × ' + fr(b.h) + ' mm'); draw(); return;
    }
    if (D.mode === 'move' && !D.moved && D.X0 !== undefined && Math.hypot(X - D.X0, Y - D.Y0) < DRAG_MIN()) return; // un clic avec un léger tremblement ne déplace rien
    if (D.mode === 'move') { let dx, dy, q; if (D.anc) { q = snap([D.anc[0] + p[0] - D.praw[0], D.anc[1] + p[1] - D.praw[1]], S.sel); dx = q[0] - D.anc[0]; dy = q[1] - D.anc[1]; } else { q = snap(p, S.sel); dx = q[0] - D.p0[0]; dy = q[1] - D.p0[1]; } /* l'objet saisi par un de ses points : c'est ce point qui s'accroche */ if (!snapMark || snapMark.k === 'gd') [dx, dy] = moveAlign(D.bb0, dx, dy); for (const [s, o] of D.orig) { s.nodes = o.map(cloneNode); transformShape(s, v => [v[0] + dx, v[1] + dy]); } if (D.piv0) PIV = { key: selKey(), p: [D.piv0[0] + dx, D.piv0[1] + dy] }; D.moved = D.moved || Math.abs(dx) + Math.abs(dy) > 1e-9; setCoords(q, 'Δ ' + fr(dx) + ' / ' + fr(dy)); draw(); return; }
    if (D.mode === 'band') { D.sx1 = X; D.sy1 = Y; draw(); return; }
    if (D.mode === 'node' && !D.moved && D.X0 !== undefined && Math.hypot(X - D.X0, Y - D.Y0) < DRAG_MIN()) return;
    if (D.mode === 'node') { const q = snap(p, new Set([D.s.id]), { ext: true, own: D.s, moving: D.ids }), dx = q[0] - D.p0[0], dy = q[1] - D.p0[1]; D.ids.forEach((i, k) => { const n = D.s.nodes[i]; if (n) { n.x = D.orig[k][0] + dx; n.y = D.orig[k][1] + dy; } }); refresh(D.s); D.moved = true; setCoords(q, D.ids.length > 1 ? 'Δ ' + fr(dx) + ' / ' + fr(dy) : ''); draw(); return; }
    if (D.mode === 'nband') { D.sx1 = X; D.sy1 = Y; draw(); return; }
    if (D.mode === 'handle' && !D.moved && D.X0 !== undefined && Math.hypot(X - D.X0, Y - D.Y0) < 3) return;
    if (D.mode === 'handle') { const n = D.s.nodes[D.i], raw = [p[0] + (D.off ? D.off[0] : 0), p[1] + (D.off ? D.off[1] : 0)];
      let q, v; if (e.shiftKey) { const dx = raw[0] - n.x, dy = raw[1] - n.y, hz = Math.abs(dx) >= Math.abs(dy); v = hz ? [dx, 0] : [0, dy]; q = [n.x + v[0], n.y + v[1]]; snapMark = { p: q.slice(), k: hz ? 'hor' : 'ver', from: [n.x, n.y] }; } // Maj : poignée horizontale ou verticale par rapport au nœud
      else { q = snap(raw, new Set([D.s.id]), { ext: true, own: D.s, moving: [] }); v = [q[0] - n.x, q[1] - n.y]; } n[D.w] = v; setCoords(q, tr('Poignée')); const ow = D.w === 'i' ? 'o' : 'i'; if (n.sm && !D.alt && !e.altKey && n[ow]) { if (n.sym) n[ow] = [-v[0], -v[1]]; else { const L = Math.hypot(n[ow][0], n[ow][1]), u = nrm(v); n[ow] = [-u[0] * L, -u[1] * L]; } } else if (e.altKey || D.alt) { n.sm = false; delete n.sym; } refresh(D.s); D.moved = true; syncNe(); draw(); return; }
    if (D.mode === 'pen' && penCont && D.node === pen[0]) { const d = penCont.dir, v = [p[0] - D.p0[0], p[1] - D.p0[1]], l = v[0] * d[0] + v[1] * d[1]; if (Math.hypot(v[0], v[1]) * S.view.s > DRAG_MIN() + 4 && l > 0) { penCont.len = l; } else penCont.len = null; draw(); return; }
    if (D.mode === 'pen') { const v = [p[0] - D.p0[0], p[1] - D.p0[1]]; if (Math.hypot(v[0], v[1]) * S.view.s > DRAG_MIN() + 4) { D.node.o = v; D.node.i = [-v[0], -v[1]]; D.node.sm = true; } else { D.node.o = null; D.node.i = null; D.node.sm = false; } draw(); return; } // petit tremblement au clic : point anguleux, pas de poignée
    if (D.mode === 'measure') { const q = snap(p); S.measure.b = q; showMeasure(); draw(); return; }
    if (['rect', 'ellipse', 'circle', 'polygon'].includes(D.mode)) { D.p1 = snap(p); D.shift = e.shiftKey; const q = D.p1, a = D.p0; setCoords(q, D.mode === 'circle' || D.mode === 'polygon' ? 'R ' + fr(hyp(q, a)) + ' mm' : fr(Math.abs(q[0] - a[0])) + ' × ' + fr(Math.abs(q[1] - a[1])) + ' mm'); draw(); return; }
  }
  if (['poly', 'rect', 'ellipse', 'circle', 'polygon', 'text', 'arc', 'dim', 'measure'].includes(t)) {
    const q = snap(p); hover = q;
    if (pen.length) { const l = pen[pen.length - 1]; setCoords(q, fr(Math.hypot(q[0] - l.x, q[1] - l.y)) + ' mm · ' + fr(Math.atan2(q[1] - l.y, q[0] - l.x) * 180 / Math.PI, 1) + '°'); }
    else if (arcSt.length === 1 || dimSt.length === 1) { const a = (arcSt[0] || dimSt[0]); setCoords(q, fr(hyp(a, q)) + ' mm'); }
    else setCoords(q);
    draw(); return;
  }
  if (t === 'chamfer' || t === 'fillet' || t === 'dogbone') { hoverCorner = findCorner(p) || (t !== 'dogbone' ? findJunction(p) : null); draw(); }
  if (t === 'trim') { const s = hitEdge(p, 8); hoverEdge = s ? edgePortion(s, p) : null; draw(); }
  if (t === 'extend') extHover(p);
  if (t === 'select' && !spaceDown) cv.style.cursor = xfCursor(X, Y) || imgCursor(X, Y) || 'default';
  cenHint = []; if (snapMark) { snapMark = null; draw(); }
  setCoords(p);
});
function endPointer(e) {
  pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
  const D = drag; drag = null; if (!D) return;
  const [X, Y] = evPt(e);
  if (D.mode === 'pan') cv.style.cursor = restCursor();
  else if (D.mode === 'guide') { if (X < RB || Y < RB || X > W || Y > H) guideDel(D.axis, D.i); renderGuides(); commit(false); }
  else if (D.mode === 'move') { if (D.moved) { commit(); renderSel(); } else if (D.wasSel) { S.xf = !xfOn(); S.xfKey = selKey(); draw(); } }
  else if (D.mode === 'pivot') { rotSync(); draw(); }
  else if (D.mode === 'srot') { cv.style.cursor = 'grab'; if (D.moved) { for (const [s, , r0] of D.orig) s.rot = normDeg(r0 + D.ang); commit(); renderSel(); } }
  else if (D.mode === 'sscale') { if (D.moved) { commit(); renderSel(); } }
  else if (D.mode === 'tabdrag') { if (!D.moved) D.tp.p.tabPts.splice(D.idx, 1); tabChanged(D.tp); }
  else if (D.mode === 'imove' || D.mode === 'iscale' || D.mode === 'irot' || D.mode === 'iedge') { if (D.rel) { relDragEnd(); if (D.moved) { relBump(); relDirty = true; commit(false); draw(); } else { if (D.toggleXf) { RXF = !RXF; draw(); } relBarShow('cw', X, Y); } relPanel(); } else { if (D.moved) commit(false); else if (D.toggleXf) { IXF = !IXF; draw(); } renderImgPanel(); } }
  else if (D.mode === 'node' || D.mode === 'handle') { if (D.moved) commit(); }
  else if (D.mode === 'nband') {
    if (Math.abs(D.sx1 - D.sx0) + Math.abs(D.sy1 - D.sy0) <= 4) { if (!D.add) { S.ne = null; S.sel.clear(); renderSel(); } }
    else { const x0 = wx(Math.min(D.sx0, D.sx1)), x1 = wx(Math.max(D.sx0, D.sx1)), y0 = wy(Math.max(D.sy0, D.sy1)), y1 = wy(Math.min(D.sy0, D.sy1)); const inR = []; D.s.nodes.forEach((n, i) => { if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1) inR.push(i); }); neSetSel(D.add ? [...new Set([...neSel(), ...inR])] : inR); }
    syncNe();
  }
  else if (D.mode === 'band') {
    const a = [wx(Math.min(D.sx0, D.sx1)), wy(Math.max(D.sy0, D.sy1))], b = [wx(Math.max(D.sx0, D.sx1)), wy(Math.min(D.sy0, D.sy1))];
    if (Math.abs(D.sx1 - D.sx0) + Math.abs(D.sy1 - D.sy0) > 4) for (const s of S.shapes) { if (!editable(s)) continue; const bb = bbox([s]); if (bb.x0 >= a[0] && bb.x1 <= b[0] && bb.y0 >= a[1] && bb.y1 <= b[1]) groupIds(s).forEach(id => S.sel.add(id)); }
    renderSel();
  }
  else if (['rect', 'ellipse', 'circle', 'polygon'].includes(D.mode)) { const tmp = previewShape(D); if (tmp && tmp.pts.length > 2) { const s = mkShape(tmp.nodes, true); if (s) { S.sel.clear(); S.sel.add(s.id); renderSel(); commit(); cfFromDrag(D, s); } } }
  else if (D.mode === 'measure') showMeasure();
  snapMark = null; cenHint = []; draw();
}
$('#cw').addEventListener('contextmenu', e => { if (e.target.closest('input, select, textarea')) return; e.preventDefault(); if (lastPtrType === 'touch' || pointers.size > 1) return; if (e.target === cv && S.ui.tool === 'select' && !pen.length && !arcSt.length && !dimSt.length && !drag) { cm2D(e); return; } rightClick(); });
cv.addEventListener('pointerup', endPointer); cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerleave', () => { hover = null; if (txGhost) { txGhost = null; txGhP = null; } if (!drag) { hoverCorner = null; hoverEdge = null; snapMark = null; cenHint = []; draw(); } });
cv.addEventListener('dblclick', e => {
  const [X, Y] = evPt(e), p = [wx(X), wy(Y)];
  if (S.ui.tool === 'select' && !hitShape(p)) { const gd = hitGuide(X, Y, true); if (gd) { guideOpen(gd); return; } }
  if (S.ui.tool === 'select' && !hitShape(p)) { const hr = relHit(p); if (hr && !imgHit(p)) { selectRel(hr.id); setTab('relief'); return; } }
  if (DBL_TOOLS.includes(S.ui.tool) && X > RB && Y > RB) {
    const h = hitShape(p);
    if (h) {
      const first = downHist.length >= 2 ? downHist[downHist.length - 2] : null;
      if (S.ui.tool === 'select' && first && first.tool === 'select' && first.xf && first.key.split(',').includes(h.id)) { S.sel.clear(); S.sel.add(h.id); S.xf = false; setTool('nodes'); renderSel(); dRefresh(); toast(tr('Édition des nœuds : glissez les nœuds et les poignées. Clic droit ou Échap pour revenir à la sélection.')); draw(); return; }
      if (S.ui.tool !== 'select') setTool('select');
      if (S.imgSel) { S.imgSel = null; renderImgPanel(); }
      S.selDim = null; S.sel.clear(); groupIds(h).forEach(id => S.sel.add(id)); S.xf = true; S.xfKey = selKey(); drag = null;
      renderSel(); dRefresh(); draw(); return;
    }
  }
  if (S.ui.tool === 'poly' && pen.length) { while (pen.length > 1 && Math.hypot(pen[pen.length - 1].x - pen[pen.length - 2].x, pen[pen.length - 1].y - pen[pen.length - 2].y) < 1e-6) pen.pop(); finishPen(false); return; }
  if (S.ui.tool === 'nodes' && S.ne) { const s = shapeById(S.ne.sid); if (s && edgeDist(s, p) < 7 / S.view.s) { const k = insertNode(s, paramAt(s, p).u); if (k >= 0) { S.ne.ni = k; S.ne.ms = null; S.ne.seg = null; commit(); draw(); } } }
});
cv.addEventListener('wheel', e => { e.preventDefault(); const [X, Y] = evPt(e); const f = Math.exp(-e.deltaY * 0.0015); const s = Math.max(0.05, Math.min(200, S.view.s * f)); const px = wx(X), py = wy(Y); S.view.s = s; S.view.ox = X - px * s; S.view.oy = Y + py * s; draw(); }, { passive: false });
