// ---------- graduations rotatives (traits équidistants sur le tour, 4ᵉ axe) ----------
const GR_DEF = () => ({ n: 36, span: 360, a0: 0, off: 0, ref: 's', pos: 0, L: 5, me: 5, mL: 7.5, le: 10, lL: 10 });
const GR_IDS = { n: '#grN', span: '#grSpan', a0: '#grA0', off: '#grOff', pos: '#grPos', L: '#grL', me: '#grMe', mL: '#grML', le: '#grLe', lL: '#grLL' };
function grLoad() { try { const o = JSON.parse(LS.get('copo.grad') || 'null'); if (o) return { ...GR_DEF(), ...o }; } catch { } return GR_DEF(); }
function grRead() { const o = { ref: S.ui.grRef || 's' }; for (const [k, id] of Object.entries(GR_IDS)) o[k] = +$(id).value || 0; return o; }
function grFill(o) { for (const [k, id] of Object.entries(GR_IDS)) $(id).value = o[k]; S.ui.grRef = o.ref || 's'; grPad(); }
/* repère du cylindre : ax = axe le long de Y ; u = coordonnée le long de l'axe, v = coordonnée enroulée */
function grRot() { const st = S.stock, R = st.rotary || {}; if (!R.on || !(st.t > 0)) return null; const ax = R.axis === 'y', o = originOf(st); return { ax, tour: Math.PI * st.t, D: +st.t, uo: ax ? o[1] : o[0], vo: ax ? o[0] : o[1], ulen: ax ? st.h : st.w, vlen: ax ? st.w : st.h }; }
function grPad() {
  const r = grRot(), ax = r ? r.ax : false, pad = $('#grRef'), ref = S.ui.grRef || 's';
  pad.classList.toggle('v', ax);
  /* axe le long de Y : début en bas, fin en haut ; on range les points de haut en bas */
  const order = ax ? ['e', 'c', 's'] : ['s', 'c', 'e'];
  order.forEach(a => pad.appendChild(pad.querySelector('[data-a="' + a + '"]')));
  const L = { s: ax ? 'Début du trait (bas)' : 'Début du trait (gauche)', c: 'Milieu du trait', e: ax ? 'Fin du trait (haut)' : 'Fin du trait (droite)' };
  pad.querySelectorAll('button').forEach(b => { const t = tr(L[b.dataset.a]); b.title = t; b.setAttribute('aria-label', t); b.setAttribute('aria-pressed', b.dataset.a === ref); });
  $('#grPosL').textContent = ax ? 'Y' : 'X';
  $('#grRefHint').textContent = trf('{a} : position du point « {p} » de chaque trait, par rapport à l’origine. Les traits plus longs partent du même point.', { a: ax ? 'Y' : 'X', p: tr({ s: 'début', c: 'milieu', e: 'fin' }[ref]) });
}
function grGeom(o, r) {
  const N = Math.max(1, Math.round(o.n)), span = Math.min(360, Math.max(0.001, o.span || 360)), full = span >= 360 - 1e-9, cnt = Math.min(3600, full ? N : N + 1), step = span / N;
  const md = (a, m) => ((a % m) + m) % m, off = Math.round(o.off || 0), me = Math.round(o.me || 0), le = Math.round(o.le || 0), segs = [];
  let out = 0, nM = 0, nL = 0;
  for (let i = 0; i < cnt; i++) {
    const k = i + off, lvl = le > 0 && md(k, le) === 0 ? 2 : me > 0 && md(k, me) === 0 ? 1 : 0, L = Math.max(0.01, [o.L, o.mL, o.lL][lvl] || o.L);
    const a = (o.a0 || 0) + i * step, v0 = md(r.vo + a / 360 * r.tour, r.tour), v = r.tour - v0 < 1e-3 ? 0 : v0, u = r.uo + (o.pos || 0), u0 = o.ref === 'c' ? u - L / 2 : o.ref === 'e' ? u - L : u, u1 = u0 + L;
    if (v > r.vlen + 1e-3 || u0 < -1e-3 || u1 > r.ulen + 1e-3) out++;
    if (lvl === 1) nM++; else if (lvl === 2) nL++;
    segs.push({ lvl, a, p: r.ax ? [[v, u0], [v, u1]] : [[u0, v], [u1, v]] });
  }
  return { segs, cnt, step, out, nM, nL, pitch: step / 360 * r.tour };
}
function grOpen() { grFill(grLoad()); fwOpen('grad'); requestAnimationFrame(grDraw); }
function grDraw() {
  const r = grRot(), cv2 = $('#grCv'), info = $('#grInfo');
  $('#grWarn').hidden = !!r; $('#grMakeB').disabled = !r; grPad();
  $('#grAxis').textContent = r ? trf('Traits parallèles à l’axe du cylindre ({a}), répartis sur le tour (Ø {d} mm, tour {c} mm) : graduations, vernier, cannelures, dents d’engrenage.', { a: r.ax ? 'Y' : 'X', d: LANG === 'fr' ? fr(r.D, 1) : r.D.toFixed(1), c: LANG === 'fr' ? fr(r.tour, 2) : r.tour.toFixed(2) }) : '';
  const c = cv2.getContext('2d');
  if (!r) { info.textContent = ''; cv2.style.height = '0px'; cv2.width = 1; cv2.height = 1; return; }
  const o = grRead(), G = grGeom(o, r), st = S.stock, W = Math.max(160, cv2.parentElement.clientWidth - 2), pad = 14, k = Math.min((W - 2 * pad - 30) / st.w, 380 / st.h), H = Math.round(st.h * k + 2 * pad);
  cv2.width = W * devicePixelRatio; cv2.height = H * devicePixelRatio; cv2.style.height = H + 'px';
  c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); c.clearRect(0, 0, W, H);
  const X0 = (W - st.w * k) / 2 - 12, X = x => X0 + x * k, Y = y => H - pad - y * k;
  c.fillStyle = '#f3efe4'; c.fillRect(X(0), Y(st.h), st.w * k, st.h * k); c.strokeStyle = '#9a8f78'; c.lineWidth = 1; c.strokeRect(X(0), Y(st.h), st.w * k, st.h * k);
  /* repères tous les 90°, comme dans la vue 2D */
  c.font = '600 10px ui-monospace, monospace'; c.setLineDash([5, 4]);
  for (let q = -8; q <= 8; q++) { const v = r.vo + q * r.tour / 4; if (v < -1e-6 || v > r.vlen + 1e-6) continue; c.strokeStyle = 'rgba(80,120,220,.6)'; c.beginPath(); if (r.ax) { c.moveTo(X(v), Y(0)); c.lineTo(X(v), Y(st.h)); } else { c.moveTo(X(0), Y(v)); c.lineTo(X(st.w), Y(v)); } c.stroke(); c.fillStyle = '#3a6fd8'; const lb = (((q * 90) % 360) + 360) % 360 + '°'; if (r.ax) c.fillText(lb, X(v) + 3, Y(st.h) - 3); else c.fillText(lb, X(st.w) + 4, Y(v) + 3); }
  c.setLineDash([]); c.lineCap = 'round';
  for (const g of G.segs) { c.strokeStyle = g.lvl === 2 ? '#1b1b1b' : g.lvl === 1 ? '#3a3a3a' : '#555'; c.lineWidth = g.lvl === 2 ? 1.8 : g.lvl === 1 ? 1.4 : 1.1; c.beginPath(); c.moveTo(X(g.p[0][0]), Y(g.p[0][1])); c.lineTo(X(g.p[1][0]), Y(g.p[1][1])); c.stroke(); }
  /* origine */
  const oo = originOf(st); c.fillStyle = '#1f6fe0'; c.beginPath(); c.arc(X(oo[0]), Y(oo[1]), 3, 0, 7); c.fill();
  const F = (v, d) => LANG === 'fr' ? fr(v, d) : v.toFixed(d);
  info.textContent = trf('{n} traits (dont {m} moyens, {l} longs) · pas {a}° = {p} mm sur la surface', { n: G.cnt, m: G.nM, l: G.nL, a: F(G.step, 3).replace(/[.,]?0+$/, ''), p: F(G.pitch, 3) })
    + (G.out ? ' · ' + trf('{k} traits sortent du brut', { k: G.out }) : '')
    + (Math.abs(r.vlen - r.tour) > 0.01 ? ' · ' + tr('le brut n’a pas la longueur du tour (Projet › ajuster)') : '');
}
function grMake() {
  const r = grRot(); if (!r) return toast(tr('Passez le projet en rotatif (onglet Projet › Type de projet).'));
  const o = grRead(); if (!(o.n >= 1) || !(o.L > 0)) return toast(tr('Vérifiez les valeurs.'));
  try { LS.set('copo.grad', JSON.stringify(o)); } catch { }
  const G = grGeom(o, r), g = uid(); S.sel.clear(); S.imgSel = null; let n = 0;
  for (const sg of G.segs) { const sh = mkShape(sg.p.map(q => NODE(q[0], q[1])), false, { g }); if (sh) { S.sel.add(sh.id); n++; } }
  fwClose('grad'); commit(); renderSel(); setTool('select'); draw();
  toast(trf('{n} traits créés (groupe).', { n }) + (G.out ? ' ' + trf('{k} traits sortent du brut.', { k: G.out }) : ''));
}
$$('#grRef button').forEach(b => b.onclick = () => { S.ui.grRef = b.dataset.a; grDraw(); });
Object.values(GR_IDS).forEach(id => { const el = $(id); if (el) { el.addEventListener('input', () => grDraw()); el.addEventListener('change', () => grDraw()); } });
