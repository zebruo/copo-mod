// ---------- gadget : boîte à entures (assemblage à tenons droits) ----------
const BOX_DEF = () => ({ v: 2, W: 180, D: 140, H: 100, t: null, jw: 20, gap: 0.1, tool: null, dog: true, lid: 'tabbed', faces: { lid: true, bottom: true, s1: true, s2: true, e1: true, e2: true } });
function boxLoad() { let o = BOX_DEF(); try { const sv = JSON.parse(LS.get('copo.box') || '{}'); if (!sv.v) delete sv.lid; o = { ...o, ...sv, v: 2 }; o.faces = { ...BOX_DEF().faces, ...(o.faces || {}) }; } catch { } if (!(o.t > 0)) o.t = S.stock.t; return o; }
const boxTools = () => S.tools.filter(t => t.type === 'flat' || t.type === 'ball');
function boxRead() {
  const n = id => +$(id).value, o = { W: n('#bxW'), D: n('#bxD'), H: n('#bxH'), t: n('#bxT'), jw: n('#bxJ'), gap: Math.max(0, n('#bxG') || 0), tool: $('#bxTool').value, dog: $('#bxDog').checked, lid: $('#bxLid').value, faces: {}, v: 2 };
  document.querySelectorAll('#box [data-face]').forEach(c => { o.faces[c.dataset.face] = c.checked; }); return o;
}
function boxFill(o) {
  $('#bxW').value = o.W; $('#bxD').value = o.D; $('#bxH').value = o.H; $('#bxT').value = o.t; $('#bxJ').value = o.jw; $('#bxG').value = o.gap; $('#bxDog').checked = !!o.dog; $('#bxLid').value = o.lid;
  const sel = $('#bxTool'); sel.innerHTML = ''; for (const t of boxTools()) { const op = document.createElement('option'); op.value = t.id; op.textContent = t.name; sel.appendChild(op); } if (o.tool && boxTools().some(t => t.id === o.tool)) sel.value = o.tool;
  document.querySelectorAll('#box [data-face]').forEach(c => { c.checked = o.faces[c.dataset.face] !== false; });
}
const boxOdd = (L, jw) => { let n = Math.max(3, Math.round(L / Math.max(1, jw))); if (n % 2 === 0) n += n * jw > L ? -1 : 1; return Math.max(3, n); };
const boxPat = (n, tabsAtEnds) => Array.from({ length: n }, (_, k) => (k % 2 === 0) === tabsAtEnds);
// contour d'un panneau w × h : bords bas, droite, haut, gauche (motifs symétriques) ; tenon = au bord, creux = enfoncé de t
function boxPanel(w, h, t, gap, E) {
  const edges = [{ L: w, P: (u, d) => [u, d] }, { L: h, P: (u, d) => [w - d, u] }, { L: w, P: (u, d) => [w - u, h - d] }, { L: h, P: (u, d) => [d, h - u] }];
  const dep = (k, i) => E[k][i] ? 0 : t, pts = [];
  for (let k = 0; k < 4; k++) {
    // tenons répartis entre les coins : la zone de coin (épaisseur t) n'existe que si un panneau s'assemble sur le bord voisin ; le premier et le dernier tenon la couvrent
    const st = E[k], n = st.length, L = edges[k].L, c0 = E[(k + 3) % 4].length > 1 ? t : 0, c1 = E[(k + 1) % 4].length > 1 ? t : 0, seg = (L - c0 - c1) / n, u0 = dep((k + 3) % 4, E[(k + 3) % 4].length - 1), u1 = L - dep((k + 1) % 4, 0);
    const bnd = [0]; for (let i = 1; i < n; i++) { let b = c0 + i * seg; if (st[i - 1] !== st[i]) b += st[i - 1] ? -gap / 2 : gap / 2; bnd.push(b); } bnd.push(L);
    for (let i = 0; i < n; i++) { const a = Math.max(bnd[i], u0), b = Math.min(bnd[i + 1], u1); if (b <= a + 1e-9) continue; const d = dep(k, i); pts.push(edges[k].P(a, d), edges[k].P(b, d)); }
  }
  const out = []; for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p); }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-6) out.pop();
  // supprime les points alignés
  return out.filter((p, i) => { const a = out[(i - 1 + out.length) % out.length], b = out[(i + 1) % out.length]; return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-9; });
}
function boxGeom(o) {
  // un bord n'a de tenons que si le panneau qui s'y assemble est usiné ; sinon il reste droit
  const t = o.t, f = o.faces, tab = o.lid === 'tabbed' && f.lid, nW = boxOdd(o.W - (f.e1 ? t : 0) - (f.e2 ? t : 0), o.jw), nD = boxOdd(o.D - (f.s1 ? t : 0) - (f.s2 ? t : 0), o.jw), nH = boxOdd(o.H - (f.bottom ? t : 0) - (tab ? t : 0), o.jw), plain = [true], P = [];
  const J = (on, n, ends) => on ? boxPat(n, ends) : plain;
  if (f.bottom) P.push({ k: 'bottom', name: 'Fond de boîte', w: o.W, h: o.D, E: [J(f.s1, nW, false), J(f.e2, nD, true), J(f.s2, nW, false), J(f.e1, nD, true)] });
  if (f.lid) P.push({ k: 'lid', name: 'Dessus', w: o.W, h: o.D, E: tab ? [J(f.s1, nW, false), J(f.e2, nD, true), J(f.s2, nW, false), J(f.e1, nD, true)] : [plain, plain, plain, plain] });
  for (const k of ['s1', 's2']) if (f[k]) P.push({ k, name: k === 's1' ? 'Côté 1' : 'Côté 2', w: o.W, h: o.H, E: [J(f.bottom, nW, true), J(f.e2, nH, true), J(tab, nW, true), J(f.e1, nH, true)] });
  for (const k of ['e1', 'e2']) if (f[k]) P.push({ k, name: k === 'e1' ? 'Bout 1' : 'Bout 2', w: o.D, h: o.H, E: [J(f.bottom, nD, false), J(f.s2, nH, false), J(tab, nD, false), J(f.s1, nH, false)] });
  for (const p of P) p.pts = boxPanel(p.w, p.h, t, o.gap, p.E);
  return { P, nW, nD, nH };
}
function boxMinSeg(o, G) { const f = o.faces, t = o.t, tab = o.lid === 'tabbed' && f.lid; let m = Infinity; const c = (L, a, b, n) => { if (n > 1) m = Math.min(m, (L - (a ? t : 0) - (b ? t : 0)) / n); }; if (f.bottom || tab) c(o.W, f.e1, f.e2, G.nW), c(o.D, f.s1, f.s2, G.nD); if (f.e1 || f.e2) c(o.H, f.bottom, tab, G.nH); return m; }
function boxValid(o) { return o.W > 3 * o.t && o.D > 3 * o.t && o.H > 3 * o.t && o.t > 0 && o.jw >= 1; }
// disposition en rangées sur le brut
function boxLayout(P, sp) { let x = sp, y = sp, rowH = 0; const W = Math.max(S.stock.w, ...P.map(p => p.w + 2 * sp)); for (const p of P) { if (x + p.w > W - sp + 1e-6 && x > sp) { x = sp; y += rowH + sp; rowH = 0; } p.ox = x; p.oy = y; x += p.w + sp; rowH = Math.max(rowH, p.h); } return { w: Math.max(...P.map(p => p.ox + p.w)) + sp, h: y + rowH + sp }; }
function boxOpen() { boxFill(boxLoad()); fwOpen('box'); requestAnimationFrame(boxDraw); }
function boxDraw() {
  const o = boxRead(), info = $('#bxInfo'), cv2 = $('#bxCv'); if (!boxValid(o)) { info.textContent = tr('Vérifiez les valeurs : dimensions supérieures à 3 × l’épaisseur, largeur des tenons d’au moins 1 mm.'); const c0 = cv2.getContext('2d'); c0.setTransform(1, 0, 0, 1, 0, 0); c0.clearRect(0, 0, cv2.width, cv2.height); return; }
  const G = boxGeom(o), tool = S.tools.find(x => x.id === o.tool), sp = Math.max(6, (tool ? tool.dia : 6) * 2 + 4), Lw = boxLayout(G.P, sp);
  const Wc = Math.max(200, cv2.parentElement.clientWidth - 30), k = Wc / Lw.w, Hc = Math.max(60, Math.round(Lw.h * k));
  cv2.width = Wc * devicePixelRatio; cv2.height = Hc * devicePixelRatio; cv2.style.height = Hc + 'px';
  const c = cv2.getContext('2d'); c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); c.clearRect(0, 0, Wc, Hc);
  for (const p of G.P) { c.beginPath(); p.pts.forEach((q, i) => { const X = (p.ox + q[0]) * k, Y = Hc - (p.oy + q[1]) * k; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.fillStyle = 'rgba(196,160,112,.45)'; c.fill(); c.strokeStyle = '#5a4630'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#3b2a1e'; c.font = '600 11px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(tr(p.name), (p.ox + p.w / 2) * k, Hc - (p.oy + p.h / 2) * k + 4); }
  const F = v => LANG === 'fr' ? fr(v, 1) : v.toFixed(1);
  info.textContent = trf('{n} panneaux · tenons : {a} × {b} × {c} · surface utile {w} × {h} mm', { n: G.P.length, a: G.nW, b: G.nD, c: G.nH, w: F(Lw.w), h: F(Lw.h) }) + (Lw.w > S.stock.w + 1e-6 || Lw.h > S.stock.h + 1e-6 ? ' · ' + tr('plus grand que le brut') : '') + (Math.abs(o.t - S.stock.t) > 1e-6 ? ' · ' + tr('épaisseur différente de celle du brut') : '') + (tool && boxMinSeg(o, G) < tool.dia * 1.05 ? ' · ' + tr('creux plus étroits que la fraise : augmentez la largeur des tenons') : '');
}
function boxMake() {
  const o = boxRead(); if (!boxValid(o)) return toast(tr('Vérifiez les valeurs.'));
  try { LS.set('copo.box', JSON.stringify(o)); } catch { }
  const G = boxGeom(o); if (!G.P.length) return toast(tr('Cochez au moins une face à usiner.'));
  const tool = S.tools.find(x => x.id === o.tool), D = tool ? tool.dia : 6, sp = Math.max(6, D * 2 + 4), Lw = boxLayout(G.P, sp);
  S.sel.clear(); S.imgSel = null; let nd = 0;
  for (const p of G.P) {
    const sh = mkShape(p.pts.map(q => NODE(p.ox + q[0], p.oy + q[1])), true); if (!sh) continue;
    if (o.dog && tool) { // dégagement aux coins rentrants (fonds des creux) pour que les tenons entrent
      let ar = 0; const pt = sh.nodes; for (let i = 0; i < pt.length; i++) { const a = pt[i], b = pt[(i + 1) % pt.length]; ar += a.x * b.y - b.x * a.y; }
      for (let i = sh.nodes.length - 1; i >= 0; i--) { const n = sh.nodes.length, a = sh.nodes[(i - 1 + n) % n], v = sh.nodes[i], b = sh.nodes[(i + 1) % n], cr = (v.x - a.x) * (b.y - v.y) - (v.y - a.y) * (b.x - v.x); if (cr * ar < 0 && applyDog(sh, i, 'dogbone', D)) nd++; }
    }
    S.sel.add(sh.id);
  }
  fwClose('box'); commit(); renderSel(); fit(); setTool('select');
  toast(trf('Boîte créée : {n} panneaux', { n: G.P.length }) + (nd ? ', ' + trf('{d} dégagements', { d: nd }) : '') + '. ' + tr('Usinez-les en profil extérieur, avec des ponts.') + (Lw.w > S.stock.w + 1e-6 || Lw.h > S.stock.h + 1e-6 ? ' ' + tr('Ils dépassent du brut : agrandissez-le ou déplacez-les.') : ''));
}

['#bxW', '#bxD', '#bxH', '#bxT', '#bxJ', '#bxG', '#bxTool', '#bxLid', '#bxDog'].forEach(id => { const el = document.querySelector(id); if (el) { el.addEventListener('input', () => boxDraw()); el.addEventListener('change', () => boxDraw()); } });
document.querySelectorAll('#box [data-face]').forEach(c => c.addEventListener('change', () => boxDraw()));
