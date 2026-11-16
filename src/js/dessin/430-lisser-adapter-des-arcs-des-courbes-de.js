// ---------- lisser : adapter des arcs, des courbes de Bézier ou des lignes aux tracés ----------
const v2 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1]], add: (a, b) => [a[0] + b[0], a[1] + b[1]], mul: (a, k) => [a[0] * k, a[1] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1], len: a => Math.hypot(a[0], a[1]), norm: a => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; } };
function segDist2(p, a, b) { const d = v2.sub(b, a), L = v2.dot(d, d); let t = L > 0 ? v2.dot(v2.sub(p, a), d) / L : 0; t = Math.max(0, Math.min(1, t)); const q = [a[0] + d[0] * t - p[0], a[1] + d[1] * t - p[1]]; return q[0] * q[0] + q[1] * q[1]; }
// indices conservés par Douglas-Peucker (polyligne ouverte)
function rdpIdx(P, i0, i1, tol, out) {
  let md = -1, mi = -1; const t2 = tol * tol;
  for (let k = i0 + 1; k < i1; k++) { const d = segDist2(P[k], P[i0], P[i1]); if (d > md) { md = d; mi = k; } }
  if (md > t2 && mi > 0) { rdpIdx(P, i0, mi, tol, out); out.push(mi); rdpIdx(P, mi, i1, tol, out); }
}
// densifie les segments plus longs que le pas, en gardant l'indice d'origine de chaque point
function fitDensify(P, closed, step) {
  const out = [], org = [], n = P.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) { const a = P[i], b = P[(i + 1) % n], L = v2.len(v2.sub(b, a)), k = Math.max(1, Math.ceil(L / step)); org.push(out.length); for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); }
  if (!closed) { org.push(out.length); out.push(P[n - 1].slice()); }
  return { D: out, org };
}
// --- courbes de Bézier (méthode de Schneider) ---
function bzPt(b, t) { const s = 1 - t; return [s * s * s * b[0][0] + 3 * s * s * t * b[1][0] + 3 * s * t * t * b[2][0] + t * t * t * b[3][0], s * s * s * b[0][1] + 3 * s * s * t * b[1][1] + 3 * s * t * t * b[2][1] + t * t * t * b[3][1]]; }
function bzD1(b, t) { const s = 1 - t; return [3 * (s * s * (b[1][0] - b[0][0]) + 2 * s * t * (b[2][0] - b[1][0]) + t * t * (b[3][0] - b[2][0])), 3 * (s * s * (b[1][1] - b[0][1]) + 2 * s * t * (b[2][1] - b[1][1]) + t * t * (b[3][1] - b[2][1]))]; }
function bzD2(b, t) { const s = 1 - t; return [6 * (s * (b[2][0] - 2 * b[1][0] + b[0][0]) + t * (b[3][0] - 2 * b[2][0] + b[1][0])), 6 * (s * (b[2][1] - 2 * b[1][1] + b[0][1]) + t * (b[3][1] - 2 * b[2][1] + b[1][1]))]; }
function bzGen(P, u, t1, t2) {
  const p0 = P[0], p3 = P[P.length - 1]; let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < P.length; i++) {
    const t = u[i], s = 1 - t, b0 = s * s * s, b1 = 3 * s * s * t, b2 = 3 * s * t * t, b3 = t * t * t, A1 = v2.mul(t1, b1), A2 = v2.mul(t2, b2);
    c00 += v2.dot(A1, A1); c01 += v2.dot(A1, A2); c11 += v2.dot(A2, A2);
    const tmp = v2.sub(P[i], v2.add(v2.mul(p0, b0 + b1), v2.mul(p3, b2 + b3))); x0 += v2.dot(A1, tmp); x1 += v2.dot(A2, tmp);
  }
  const det = c00 * c11 - c01 * c01, seg = v2.len(v2.sub(p3, p0)), eps = 1e-6 * seg;
  let a1 = det !== 0 ? (x0 * c11 - x1 * c01) / det : 0, a2 = det !== 0 ? (c00 * x1 - c01 * x0) / det : 0;
  if (!(a1 > eps) || !(a2 > eps) || a1 > seg * 2 || a2 > seg * 2) { a1 = a2 = seg / 3; }
  return [p0, v2.add(p0, v2.mul(t1, a1)), v2.add(p3, v2.mul(t2, a2)), p3];
}
function bzFitRun(P, t1, t2, tol, out, depth = 0) {
  if (P.length === 2) { const d = v2.len(v2.sub(P[1], P[0])) / 3; out.push([P[0], v2.add(P[0], v2.mul(t1, d)), v2.add(P[1], v2.mul(t2, d)), P[1]]); return; }
  let u = [0]; for (let i = 1; i < P.length; i++) u.push(u[i - 1] + v2.len(v2.sub(P[i], P[i - 1]))); const L = u[u.length - 1] || 1; u = u.map(x => x / L);
  let b = bzGen(P, u, t1, t2), e = bzErr(P, b, u);
  if (e.d <= tol * tol) { out.push(b); return; }
  if (e.d <= 16 * tol * tol) for (let it = 0; it < 6; it++) {
    u = u.map((t, i) => { const d = v2.sub(bzPt(b, t), P[i]), d1 = bzD1(b, t), d2 = bzD2(b, t), num = v2.dot(d, d1), den = v2.dot(d1, d1) + v2.dot(d, d2); return Math.abs(den) > 1e-12 ? Math.max(0, Math.min(1, t - num / den)) : t; });
    b = bzGen(P, u, t1, t2); e = bzErr(P, b, u); if (e.d <= tol * tol) { out.push(b); return; }
  }
  let k = e.i; if (k <= 0) k = 1; if (k >= P.length - 1) k = P.length - 2;
  if (depth > 40) { out.push(b); return; }
  const tc = v2.norm(v2.sub(P[k - 1], P[k + 1]));
  bzFitRun(P.slice(0, k + 1), t1, tc, tol, out, depth + 1); bzFitRun(P.slice(k), v2.mul(tc, -1), t2, tol, out, depth + 1);
}
function bzErr(P, b, u) { let d = 0, i = Math.floor(P.length / 2); for (let k = 1; k < P.length - 1; k++) { const q = v2.sub(bzPt(b, u[k]), P[k]), dd = v2.dot(q, q); if (dd >= d) { d = dd; i = k; } } return { d, i }; }
// tangente estimée sur quelques points (à une distance d'au moins w)
function tanAt(P, i, dir, w) { const a = P[i]; let j = i + dir, best = null; while (j >= 0 && j < P.length) { best = P[j]; if (v2.len(v2.sub(P[j], a)) >= w) break; j += dir; } return best ? v2.norm(v2.sub(best, a)) : [1, 0]; }
// --- arcs : extension gloutonne d'arcs (ou de droites) tant que l'écart reste sous la tolérance ---
function arcFitRun(P, tol, push) {
  const n = P.length;
  const test = (i, j) => {
    if (j - i < 2) return { line: true };
    let lineOk = true; for (let k = i + 1; k < j; k++) if (segDist2(P[k], P[i], P[j]) > tol * tol) { lineOk = false; break; }
    if (lineOk) return { line: true };
    const m = (i + j) >> 1, c = circle3(P[i], P[m], P[j]); if (!c || c.r > 1e5) return null;
    for (let k = i + 1; k < j; k++) if (Math.abs(v2.len(v2.sub(P[k], c.C)) - c.r) > tol) return null;
    const a0 = Math.atan2(P[i][1] - c.C[1], P[i][0] - c.C[0]), a1 = Math.atan2(P[j][1] - c.C[1], P[j][0] - c.C[0]), am = Math.atan2(P[m][1] - c.C[1], P[m][0] - c.C[0]), T = 2 * Math.PI, nm = a => ((a % T) + T) % T;
    const s1 = nm(a1 - a0), sweep = nm(am - a0) < s1 ? s1 : s1 - T;
    // les points doivent progresser dans le même sens que l'arc
    let prev = 0; for (let k = i + 1; k <= j; k++) { const ak = Math.atan2(P[k][1] - c.C[1], P[k][0] - c.C[0]), r = sweep > 0 ? nm(ak - a0) : nm(a0 - ak); if (r + 1e-6 < prev && k < j) return null; prev = r; }
    return { C: c.C, r: c.r, a0, sweep };
  };
  let i = 0;
  while (i < n - 1) {
    let lo = i + 1, f = test(i, lo), step = 2, hi = null;
    while (true) { const j = Math.min(n - 1, i + step); const t = test(i, j); if (t) { lo = j; f = t; if (j === n - 1) break; step *= 2; } else { hi = j; break; } }
    if (hi !== null) { while (hi - lo > 1) { const mid = (lo + hi) >> 1, t = test(i, mid); if (t) { lo = mid; f = t; } else hi = mid; } }
    push(i, lo, f); i = lo;
  }
}
function fitNodesPush(out, seg) { if (out.length && Math.hypot(out[out.length - 1].x - seg[0].x, out[out.length - 1].y - seg[0].y) < 1e-6) { out[out.length - 1].o = seg[0].o; out.push(...seg.slice(1)); } else out.push(...seg); }
function fitShape(s, o) {
  let P = s.pts.map(q => q.slice()); const closed = s.closed && P.length > 2;
  if (P.length < 2) return null;
  const tol = Math.max(0.001, +o.tol || 0.1);
  // coins : sommets Douglas-Peucker dont le changement de direction dépasse l'angle max
  const keep = [0]; if (closed) { let far = 0, fd = -1; for (let k = 1; k < P.length; k++) { const d = v2.len(v2.sub(P[k], P[0])); if (d > fd) { fd = d; far = k; } } const Q = P.concat([P[0]]); rdpIdx(Q, 0, far, tol, keep); keep.push(far); rdpIdx(Q, far, P.length, tol, keep); } else { rdpIdx(P, 0, P.length - 1, tol, keep); keep.push(P.length - 1); }
  if (o.type === 'line') { let idx = [...new Set(keep)].sort((a, b) => a - b); if (closed && idx[idx.length - 1] === P.length) idx.pop(); return { nodes: idx.map(k => NODE(P[k][0], P[k][1])), closed }; }
  const corners = [];
  if (o.corner) { const K = [...new Set(keep)].filter(k => k < P.length).sort((a, b) => a - b), lim = (+o.ang || 60) * Math.PI / 180; K.forEach((k, j) => { if (!closed && (j === 0 || j === K.length - 1)) return; const a = P[K[(j - 1 + K.length) % K.length]], b = P[k], c = P[K[(j + 1) % K.length]], d1 = v2.norm(v2.sub(b, a)), d2 = v2.norm(v2.sub(c, b)), t = Math.acos(Math.max(-1, Math.min(1, v2.dot(d1, d2)))); if (t > lim) corners.push(k); }); }
  // densifie pour que l'écart soit contrôlé le long des segments droits
  const step = Math.max(tol, 0.05), { D, org } = fitDensify(P, closed, step); let Dc = D, cIdx = corners.map(k => org[k]);
  if (Dc.length > 40000) return null;
  let runs = [], loop = false;
  if (closed) {
    if (cIdx.length) { const s0 = cIdx[0], R = Dc.slice(s0).concat(Dc.slice(0, s0)), n = Dc.length; const cc = cIdx.map(k => (k - s0 + n) % n).sort((a, b) => a - b); R.push(R[0]); cc.push(n); for (let j = 0; j < cc.length - 1; j++) runs.push(R.slice(cc[j], cc[j + 1] + 1)); }
    else { const R = Dc.concat([Dc[0]]); runs.push(R); loop = true; }
  } else { const cc = [0, ...cIdx.sort((a, b) => a - b), Dc.length - 1]; for (let j = 0; j < cc.length - 1; j++) if (cc[j + 1] > cc[j]) runs.push(Dc.slice(cc[j], cc[j + 1] + 1)); }
  const out = [], w = Math.max(tol * 2, step * 2);
  for (const R of runs) {
    if (R.length < 2) continue;
    if (o.type === 'bez') {
      let t1 = tanAt(R, 0, 1, w), t2 = tanAt(R, R.length - 1, -1, w);
      if (loop) { const tt = v2.norm(v2.sub(tanAt(R, 0, 1, w), tanAt(R, R.length - 1, -1, w))); t1 = tt; t2 = v2.mul(tt, -1); }
      const segs = []; bzFitRun(R, t1, t2, tol, segs);
      for (const b of segs) { const flat = segDist2(b[1], b[0], b[3]) < (tol * 0.05) ** 2 && segDist2(b[2], b[0], b[3]) < (tol * 0.05) ** 2; fitNodesPush(out, flat ? [NODE(b[0][0], b[0][1]), NODE(b[3][0], b[3][1])] : [NODE(b[0][0], b[0][1], null, [b[1][0] - b[0][0], b[1][1] - b[0][1]]), NODE(b[3][0], b[3][1], [b[2][0] - b[3][0], b[2][1] - b[3][1]], null)]); }
    } else {
      arcFitRun(R, tol, (i, j, f) => { if (f.line) fitNodesPush(out, [NODE(R[i][0], R[i][1]), NODE(R[j][0], R[j][1])]); else fitNodesPush(out, arcNodes(f.C, f.r, f.a0, f.sweep)); });
    }
  }
  if (closed && out.length > 1) { const f = out[0], l = out[out.length - 1]; if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) { f.i = l.i; out.pop(); } }
  // nœuds lisses : poignées alignées
  for (const nd of out) if (nd.i && nd.o) { const a = v2.norm(v2.mul(nd.i, -1)), b = v2.norm(nd.o); nd.sm = v2.dot(a, b) > Math.cos(4 * Math.PI / 180); }
  return out.length >= 2 ? { nodes: out, closed } : null;
}
let FITPREV = null, fitT = 0;
const fitOpts = () => ({ type: S.ui.fitType || 'arc', tol: +S.ui.fitTol || 0.1, corner: S.ui.fitCorner !== false, ang: +S.ui.fitAng || 60 });
function fitPreview() {
  const sec = document.querySelector('section.dsec[data-sec="fit"]'); if (!sec || sec.hidden) { if (FITPREV) { FITPREV = null; draw(); } return; }
  $$('#fitType button').forEach(b => b.setAttribute('aria-pressed', b.value === (S.ui.fitType || 'arc')));
  $('#fitAngRow').hidden = (S.ui.fitType || 'arc') === 'line' || S.ui.fitCorner === false; $('#fitCornerRow').hidden = (S.ui.fitType || 'arc') === 'line';
  const ss = selShapes(), o = fitOpts(); let n0 = 0, n1 = 0; FITPREV = [];
  for (const s of ss) { const r = fitShape(s, o); n0 += s.nodes.length; if (r) { r.pts = refresh({ nodes: r.nodes, closed: r.closed }).pts; FITPREV.push(r); n1 += r.nodes.length; } else n1 += s.nodes.length; }
  $('#fitInfo').textContent = ss.length ? trf('{s} vecteur(s) : {a} nœuds → {b} nœuds', { s: ss.length, a: n0, b: n1 }) : tr('Sélectionnez les vecteurs à lisser.');
  draw();
}
function fitSoon() { clearTimeout(fitT); fitT = setTimeout(fitPreview, 120); }
function fitApply() {
  const ss = selShapes(); if (!ss.length) return toast(tr('Sélectionnez les vecteurs à lisser.'));
  const o = fitOpts(), repl = S.ui.fitRepl !== false; let n = 0; const made = [];
  for (const s of ss) { const r = fitShape(s, o); if (!r) continue; n++; if (repl) { s.nodes = r.nodes; s.closed = r.closed; refresh(s); } else { const m = mkShape(r.nodes, r.closed, { layer: s.layer }); if (m) made.push(m.id); } }
  if (!repl && made.length) { S.sel.clear(); made.forEach(id => S.sel.add(id)); }
  commit(); renderSel(); fitPreview(); toast(n ? trf('{n} vecteur(s) lissé(s).', { n }) : tr('Rien à lisser.'));
}
function drawFitPrev(C) {
  if (!FITPREV || !FITPREV.length) return; ctx.save(); ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 3]);
  for (const r of FITPREV) { pathOf(r.pts, r.closed); ctx.stroke(); }
  ctx.setLineDash([]); ctx.fillStyle = '#ff9f1c'; for (const r of FITPREV) for (const nd of r.nodes) ctx.fillRect(sx(nd.x) - 2, sy(nd.y) - 2, 4, 4);
  ctx.restore();
}
$$('#fitType button').forEach(b => b.onclick = () => { S.ui.fitType = b.value; fitPreview(); });
document.querySelector('section.dsec[data-sec="fit"]').addEventListener('input', fitSoon); document.querySelector('section.dsec[data-sec="fit"]').addEventListener('change', fitSoon);
function joinSync() { $$('#joinMode button').forEach(b => b.setAttribute('aria-pressed', b.value === (S.ui.joinMode || 'line'))); }
$$('#joinMode button').forEach(b => b.onclick = () => { S.ui.joinMode = b.value; joinSync(); });
