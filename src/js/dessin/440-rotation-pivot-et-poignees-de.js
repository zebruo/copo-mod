// ---------- rotation : pivot et poignées de transformation ----------
const selKey = () => [...S.sel].sort().join(',');
let PIV = null;
const normDeg = a => { a = ((a % 360) + 540) % 360 - 180; return Math.abs(a) < 1e-9 ? 0 : +a.toFixed(6); };
function pivotPt() { const ss = selShapes(); if (!ss.length) return null; if (PIV && PIV.key === selKey()) return PIV.p; const b = bbox(ss); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; }
function pivotSet(q) { PIV = { key: selKey(), p: q.slice() }; rotSync(); draw(); }
const xfOn = () => !!S.xf && S.xfKey === selKey() && S.sel.size > 0;
const pivotShown = () => S.ui.tool === 'select' && S.sel.size > 0 && !S.imgSel && $('#tpWin').hidden && (xfOn() || S.ui.dsec === 'rotate');
function rotPts(c0, deg) { const an = deg * Math.PI / 180, c = Math.cos(an), sn = Math.sin(an); return q => [c0[0] + (q[0] - c0[0]) * c - (q[1] - c0[1]) * sn, c0[1] + (q[0] - c0[0]) * sn + (q[1] - c0[1]) * c]; }
function rotateSel(deg, piv) { const ss = selShapes(); if (!ss.length || !deg) return; const f = rotPts(piv || pivotPt(), deg); ss.forEach(o => { transformShape(o, f); o.rot = normDeg((+o.rot || 0) + deg); }); }
const selRot = () => { const ss = selShapes(); return ss.length ? (+ss[0].rot || 0) : 0; };
const fDeg = v => (LANG === 'fr' ? fr(v, 2) : String(+v.toFixed(2))) + '°';
function rotSync() {
  const sec = document.querySelector('section.dsec[data-sec="rotate"]'); if (!sec || sec.hidden) return;
  const mode = S.ui.rotMode || 'rel', ss = selShapes(), P = pivotPt();
  $$('#rotMode button').forEach(b => b.setAttribute('aria-pressed', b.value === mode));
  $$('#rotAnchor button').forEach(b => { const on = !!(P && ss.length) && (() => { const q = anchorPt(bbox(ss), b.dataset.a); return Math.hypot(q[0] - P[0], q[1] - P[1]) < 1e-6; })(); b.setAttribute('aria-pressed', on); });
  if (P) { const o = outXY(P[0], P[1]); if (document.activeElement !== $('#rotX')) $('#rotX').value = +o[0].toFixed(3); if (document.activeElement !== $('#rotY')) $('#rotY').value = +o[1].toFixed(3); } else { $('#rotX').value = ''; $('#rotY').value = ''; }
  ['#rotX', '#rotY', '#rotDeg'].forEach(id => { $(id).disabled = !ss.length; });
  $('#rotInfo').textContent = !ss.length ? tr('Sélectionnez les vecteurs à faire pivoter.') : mode === 'abs' ? trf('Absolue : la sélection prend l’angle indiqué. Angle actuel : {a}.', { a: fDeg(selRot()) }) : tr('Relative : la sélection tourne de l’angle indiqué. Angle positif = sens inverse des aiguilles d’une montre.');
}
function rotApply() {
  const ss = selShapes(); if (!ss.length) return toast(tr('Sélectionnez les vecteurs à faire pivoter.'));
  const deg = +$('#rotDeg').value || 0, d = (S.ui.rotMode || 'rel') === 'abs' ? normDeg(deg - selRot()) : deg;
  if (Math.abs(d) < 1e-9) return toast(tr('Angle nul : rien à faire.'));
  rotateSel(d); commit(); renderSel(); draw(); toast(trf('Rotation de {a} appliquée.', { a: fDeg(d) }));
}
for (const [nm, key] of [['txMode', 'textMode'], ['txAlign', 'textAlign'], ['txOrient', 'textOrient']]) $$('input[name="' + nm + '"]').forEach(r => r.addEventListener('change', () => { if (!r.checked) return; S.ui[key] = r.value; if (key === 'textMode') { textPick = null; if (!S.ui.textAlign || S.ui.textAlign === (r.value === 'line' ? 'mid' : 'left')) S.ui.textAlign = r.value === 'line' ? 'left' : 'mid'; } txUi(); txLive(); txGhost = null; if (txGhP) txGhostReq(txGhP); }));
{ const c = document.getElementById('selRotFrame'); if (c) c.addEventListener('change', () => { renderSel(); draw(); }); }
$$('#rotMode button').forEach(b => b.onclick = () => { S.ui.rotMode = b.value; if (b.value === 'abs') $('#rotDeg').value = +selRot().toFixed(2); rotSync(); });
$$('#rotAnchor button').forEach(b => b.onclick = () => { const ss = selShapes(); if (ss.length) pivotSet(anchorPt(bbox(ss), b.dataset.a)); });
['#rotX', '#rotY'].forEach(id => $(id).addEventListener('change', () => { if (!S.sel.size) return; pivotSet(inXY(+$('#rotX').value || 0, +$('#rotY').value || 0)); }));
$('#rotDeg').addEventListener('keydown', e => { if (e.key === 'Enter') rotApply(); });
// poignées : 8 carrés (redimensionner) et 4 ronds (tourner) autour de la sélection
// cadre rotatif : le cadre des poignées prend l'angle commun des formes sélectionnées
// angle propre d'une forme : son angle de rotation, ou pour une ligne droite (ou une polyligne alignée) son orientation
function shapeAng(o) { const r = +o.rot || 0; if (Math.abs(r) > 1e-6) return r; if (o.closed || !o.nodes || o.nodes.length < 2) return 0; const A = o.nodes[0], B = o.nodes[o.nodes.length - 1], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy); if (L < 1e-9) return 0;
  if (o.nodes.some(n => Math.abs((n.x - A.x) * dy - (n.y - A.y) * dx) / L > 1e-6 || (n.i && Math.abs(n.i[0] * dy - n.i[1] * dx) / L > 1e-6) || (n.o && Math.abs(n.o[0] * dy - n.o[1] * dx) / L > 1e-6))) return 0;
  let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a > 90) a -= 180; if (a <= -90) a += 180; return Math.abs(a) < 1e-6 ? 0 : a; }
function xfAng() { const c = $('#selRotFrame'); if (!c || !c.checked) return 0; const ss = selShapes(); if (!ss.length) return 0; const r = shapeAng(ss[0]); return Math.abs(r) > 1e-6 && ss.every(o => { const d = normDeg(shapeAng(o) - r); return Math.abs(d) < 1e-6 || Math.abs(Math.abs(d) - 180) < 1e-6; }) ? r : 0; }
function oFrame(deg) { const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), L = q => [q[0] * c + q[1] * sn, -q[0] * sn + q[1] * c], W = q => [q[0] * c - q[1] * sn, q[0] * sn + q[1] * c]; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const o of selShapes()) for (const q of o.pts) { const u = L(q); if (u[0] < x0) x0 = u[0]; if (u[0] > x1) x1 = u[0]; if (u[1] < y0) y0 = u[1]; if (u[1] > y1) y1 = u[1]; } return { x0, y0, x1, y1, L, W, c, sn }; }
function xfHandles() {
  if (!xfOn() || !pivotShown()) return []; const deg = xfAng(); if (deg) return xfHandlesRot(deg); const b = bbox(selShapes()), H = [], pad = 7, rp = 18;
  for (const cx of [-1, 0, 1]) for (const cy of [-1, 0, 1]) {
    if (!cx && !cy) continue;
    const wxp = cx < 0 ? b.x0 : cx > 0 ? b.x1 : (b.x0 + b.x1) / 2, wyp = cy < 0 ? b.y0 : cy > 0 ? b.y1 : (b.y0 + b.y1) / 2;
    const ax = cx < 0 ? b.x1 : cx > 0 ? b.x0 : wxp, ay = cy < 0 ? b.y1 : cy > 0 ? b.y0 : wyp;
    H.push({ k: 's', cx, cy, w: [wxp, wyp], a: [ax, ay], X: sx(wxp) + cx * pad, Y: sy(wyp) - cy * pad });
    if (cx && cy) H.push({ k: 'r', cx, cy, X: sx(wxp) + cx * rp, Y: sy(wyp) - cy * rp });
  }
  return H;
}
function xfHandlesRot(deg) { const F = oFrame(deg), H = [], pad = 7, rp = 18;
  for (const cx of [-1, 0, 1]) for (const cy of [-1, 0, 1]) { if (!cx && !cy) continue;
    const lw = [cx < 0 ? F.x0 : cx > 0 ? F.x1 : (F.x0 + F.x1) / 2, cy < 0 ? F.y0 : cy > 0 ? F.y1 : (F.y0 + F.y1) / 2], la = [cx < 0 ? F.x1 : cx > 0 ? F.x0 : lw[0], cy < 0 ? F.y1 : cy > 0 ? F.y0 : lw[1]], w = F.W(lw), dir = F.W([cx, cy]), dl = Math.hypot(dir[0], dir[1]) || 1;
    H.push({ k: 's', cx, cy, deg, lw, la, w, a: F.W(la), X: sx(w[0]) + dir[0] / dl * pad * (cx && cy ? 1.41 : 1), Y: sy(w[1]) - dir[1] / dl * pad * (cx && cy ? 1.41 : 1) });
    if (cx && cy) H.push({ k: 'r', cx, cy, X: sx(w[0]) + dir[0] / dl * rp * 1.41, Y: sy(w[1]) - dir[1] / dl * rp * 1.41 }); }
  return H; }
function xfHandleAt(X, Y) { if (!pivotShown()) return null; const P = pivotPt(); if (P && Math.hypot(sx(P[0]) - X, sy(P[1]) - Y) < 9) return { k: 'p' }; let best = null, bd = 8; for (const h of xfHandles()) { const d = Math.hypot(h.X - X, h.Y - Y); if (d < bd) { bd = d; best = h; } } return best; }
function xfCursor(X, Y) { const h = xfHandleAt(X, Y); if (!h) return null; if (h.k === 'p') return 'move'; if (h.k === 'r') return 'grab'; return !h.cx ? 'ns-resize' : !h.cy ? 'ew-resize' : h.cx * h.cy > 0 ? 'nesw-resize' : 'nwse-resize'; }
function drawXf(C) {
  if (!pivotShown()) return;
  const hs = xfHandles();
  if (hs.length) {
    const deg = xfAng(); ctx.save(); ctx.strokeStyle = C.acc; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    if (deg) { const F = oFrame(deg), m = 7 / S.view.s; ctx.beginPath(); [[F.x0 - m, F.y0 - m], [F.x1 + m, F.y0 - m], [F.x1 + m, F.y1 + m], [F.x0 - m, F.y1 + m]].forEach((q, i) => { const w = F.W(q); i ? ctx.lineTo(sx(w[0]), sy(w[1])) : ctx.moveTo(sx(w[0]), sy(w[1])); }); ctx.closePath(); ctx.stroke(); }
    else { const b = bbox(selShapes()); ctx.strokeRect(sx(b.x0) - 7, sy(b.y1) - 7, b.w * S.view.s + 14, b.h * S.view.s + 14); } ctx.setLineDash([]);
    for (const h of hs) { ctx.beginPath(); if (h.k === 's') ctx.rect(h.X - 4.5, h.Y - 4.5, 9, 9); else ctx.arc(h.X, h.Y, 5, 0, 7); ctx.fillStyle = h.k === 's' ? C.panel : C.acc; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = C.acc; ctx.stroke(); }
    ctx.restore();
  }
  const P = pivotPt(); if (!P) return; const X = sx(P[0]), Y = sy(P[1]);
  ctx.save(); ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 7, 0, 7); ctx.moveTo(X - 11, Y); ctx.lineTo(X + 11, Y); ctx.moveTo(X, Y - 11); ctx.lineTo(X, Y + 11); ctx.stroke(); ctx.restore();
}

