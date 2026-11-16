// ---------- vectorisation d'image (contours) ----------
const VZ = new Map(), VZ_MAX = 700;
function vzP(im) { if (!im.trace) im.trace = { t: null, l: 3, inv: false }; return im.trace; }
function vzGray(im) {
  const el = ensureImg(im.id); if (!el || !el.complete || !el.naturalWidth) return null;
  const c = VZ.get(im.id); if (c && c.src === el.src) return c;
  const k = Math.min(1, VZ_MAX / Math.max(el.naturalWidth, el.naturalHeight)), W = Math.max(2, Math.round(el.naturalWidth * k)), H = Math.max(2, Math.round(el.naturalHeight * k));
  const cn = document.createElement('canvas'); cn.width = W; cn.height = H; const cx = cn.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); cx.drawImage(el, 0, 0, W, H);
  const d = cx.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2];
  const r = { src: el.src, W, H, g, blur: new Map() }; VZ.set(im.id, r); return r;
}
function vzOtsu(G) { const h = new Float64Array(256); for (const v of G.g) h[Math.min(255, v | 0)]++; const N = G.g.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i]; let sb = 0, wb = 0, best = 0, t = 128; for (let i = 0; i < 256; i++) { wb += h[i]; if (!wb) continue; const wf = N - wb; if (!wf) break; sb += i * h[i]; const mb = sb / wb, mf = (sum - sb) / wf, v = wb * wf * (mb - mf) * (mb - mf); if (v > best) { best = v; t = i; } } return Math.max(1, Math.min(254, t + 1)); }
function vzBlur(G, n) {
  if (!n) return G.g; if (G.blur.has(n)) return G.blur.get(n);
  const { W, H } = G; let a = Float32Array.from(G.g), b = new Float32Array(W * H);
  for (let p = 0; p < n; p++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; b[i] = (a[i - (x > 0)] + a[i] + a[i + (x < W - 1)]) / 3; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; a[i] = (b[i - (y > 0) * W] + b[i] + b[i + (y < H - 1) * W]) / 3; }
  }
  G.blur.set(n, a); return a;
}
// marching squares sur le champ (seuil - gris), avec interpolation ; renvoie des boucles en pixels
function vzTrace(G, t, inv, l) {
  const { W, H } = G, src = vzBlur(G, Math.round(l / 2)), GW = W + 2, GH = H + 2, f = new Float32Array(GW * GH).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = src[y * W + x]; f[(y + 1) * GW + x + 1] = inv ? v - t : t - v; }
  const pt = new Map(), adj = new Map();
  const ep = id => { if (pt.has(id)) return; const k = id >> 1, x = k % GW, y = (k / GW) | 0, a = f[k], b = (id & 1) ? f[k + GW] : f[k + 1], u = a / (a - b); pt.set(id, (id & 1) ? [x - 0.5, y + u - 0.5] : [x + u - 0.5, y - 0.5]); };
  const link = (e1, e2) => { ep(e1); ep(e2); (adj.get(e1) || adj.set(e1, []).get(e1)).push(e2); (adj.get(e2) || adj.set(e2, []).get(e2)).push(e1); };
  for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW - 1; x++) {
    const i = y * GW + x, tl = f[i] > 0, tr = f[i + 1] > 0, br = f[i + GW + 1] > 0, bl = f[i + GW] > 0, c = tl * 8 + tr * 4 + br * 2 + bl; if (!c || c === 15) continue;
    const T = 2 * i, B = 2 * (i + GW), L = 2 * i + 1, R = 2 * (i + 1) + 1;
    switch (c) {
      case 1: case 14: link(L, B); break; case 2: case 13: link(B, R); break; case 3: case 12: link(L, R); break;
      case 4: case 11: link(T, R); break; case 6: case 9: link(T, B); break; case 7: case 8: link(L, T); break;
      case 5: case 10: { const ctr = (f[i] + f[i + 1] + f[i + GW] + f[i + GW + 1]) > 0; if ((c === 5) === ctr) { link(L, T); link(B, R); } else { link(T, R); link(L, B); } break; }
    }
  }
  const seen = new Set(), loops = [];
  for (const s0 of adj.keys()) {
    if (seen.has(s0)) continue; const loop = []; let prev = -1, cur = s0;
    while (cur !== undefined && !seen.has(cur)) { seen.add(cur); loop.push(pt.get(cur)); const n = adj.get(cur); const nx = n[0] !== prev ? n[0] : n[1]; prev = cur; cur = nx; }
    if (loop.length > 2) loops.push(loop);
  }
  const area = l => { let a = 0; for (let i = 0; i < l.length; i++) { const p = l[i], q = l[(i + 1) % l.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const minA = Math.max(4, (1 + l) * (1 + l) * 1.5), tol = 0.35 + 0.22 * l;
  return loops.filter(lp => Math.abs(area(lp)) >= minA).map(lp => vzRdp(lp, tol)).filter(lp => lp.length > 2);
}
function vzRdp(lp, tol) {
  // fermeture : on découpe la boucle au point le plus éloigné du premier
  let far = 0, fd = -1; for (let i = 1; i < lp.length; i++) { const d = Math.hypot(lp[i][0] - lp[0][0], lp[i][1] - lp[0][1]); if (d > fd) { fd = d; far = i; } }
  const rd = pts => { const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
    while (st.length) { const [a, b] = st.pop(); const A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1e-9; let md = -1, mi = -1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - A[0]) * dy - (pts[i][1] - A[1]) * dx) / L; if (d > md) { md = d; mi = i; } }
      if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
    return pts.filter((_, i) => keep[i]); };
  const a = rd(lp.slice(0, far + 1)), b = rd(lp.slice(far).concat([lp[0]]));
  return a.concat(b.slice(1, -1));
}
function vzNodes(lp, l, map) {
  const n = lp.length, P = lp.map(map), out = [];
  for (let i = 0; i < n; i++) {
    const p = P[i], a = P[(i - 1 + n) % n], b = P[(i + 1) % n], u = [p[0] - a[0], p[1] - a[1]], v = [b[0] - p[0], b[1] - p[1]];
    const ang = Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]));
    if (l > 0 && ang < 1.0) { const t = [(b[0] - a[0]) / 6, (b[1] - a[1]) / 6], lu = Math.hypot(...u), lv = Math.hypot(...v), lt = Math.hypot(...t) * 2 || 1e-9;
      out.push(NODE(p[0], p[1], [-t[0] * lu / lt, -t[1] * lu / lt], [t[0] * lv / lt, t[1] * lv / lt], true)); }
    else out.push(NODE(p[0], p[1]));
  }
  return out;
}

// ===== croix de fermeture et formulaire de parcours dans le panneau =====
function peekSet(pane, on) { if (!pane) return; pane.classList.toggle('peek', !!on); const b = pane.querySelector('.peektab'); if (b) { b.setAttribute('aria-expanded', !!on); const t = on ? tr('Masquer') : (pane.dataset.pane === 'dessin' ? tr('Afficher les outils de dessin') : tr('Afficher les opérations et la liste des parcours')); b.title = t; b.setAttribute('aria-label', t); } }
(() => {
  document.querySelectorAll('.peektab').forEach(b => {
    const pane = b.closest('.pane'), zone = pane.dataset.pane === 'dessin' ? [b, pane.querySelector('#dgrid')] : [b, ...pane.querySelectorAll(':scope > section.blk')]; let t = 0;
    const open = () => { clearTimeout(t); if (pane.classList.contains('setm')) peekSet(pane, true); };
    const later = () => { clearTimeout(t); t = setTimeout(() => peekSet(pane, false), 400); };
    b.addEventListener('mouseenter', open);
    b.addEventListener('click', () => { clearTimeout(t); peekSet(pane, !pane.classList.contains('peek')); });
    zone.forEach(z => { if (!z) return; z.addEventListener('mouseenter', () => { if (pane.classList.contains('peek')) clearTimeout(t); }); z.addEventListener('mouseleave', e => { if (e.pointerType === 'touch') return; later(); }); });
    zone.slice(1).forEach(z => z && z.addEventListener('click', e => { if (e.target.closest('button,[data-tool],li')) setTimeout(() => peekSet(pane, false), 0); }));
  });
  // formulaire de parcours : intégré au panneau Parcours
  const w = $('#tpWin'), pp = document.querySelector('[data-pane="parcours"]'); if (!w || !pp) return;
  w.classList.add('docked'); w.setAttribute('role', 'region'); pp.appendChild(w);
  const sync = () => { const on = !w.hidden; pp.classList.toggle('setm', on); if (!on) { peekSet(pp, false); w.classList.remove('chgtype'); } else pp.scrollTop = 0; };
  new MutationObserver(sync).observe(w, { attributes: true, attributeFilter: ['hidden'] }); sync();
  $('#tpTypeLine').addEventListener('click', e => { if (e.target.closest('a')) { e.preventDefault(); w.classList.toggle('chgtype'); } });
  w.addEventListener('click', e => { if (e.target.closest('.seg[data-f="type"] button')) setTimeout(() => w.classList.remove('chgtype'), 0); });
})();
function relSetm() { const p = document.querySelector('[data-pane="relief"]'); if (p) p.classList.toggle('setm', !!(typeof relCur === 'function' && relCur())); }
{ const _rp = relPanel; relPanel = function (...a) { const r = _rp.apply(this, a); relSetm(); return r; }; }
{ const _rc = rightClick; rightClick = function () { if (!$('#tpWin').hidden) { act('tpCancel'); return; } if (S.relSel && curTab === 'relief') { act('relSetClose'); } return _rc(); }; }
function tpTypeSync() {
  const F = S.form || {}, b = document.querySelector('#tpForm .seg[data-f="type"] button[value="' + F.type + '"]'), el = $('#tpTypeLine'); if (!el) return;
  const nm = b ? b.textContent.trim() : '', tp = S.editTp && S.tps.find(x => x.id === S.editTp);
  el.innerHTML = '<span></span><a role="button" tabindex="0"></a>'; el.firstChild.textContent = tr('Type :') + ' ' + nm; el.lastChild.textContent = tr('changer');
  if (tp) $('#tpFormTitle').textContent = tp.name;
}
let vzRaf = 0;
