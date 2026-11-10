// ---------- accrochage ----------
let snapMark = null;
// traits superposés : portions de segments colinéaires qui se recouvrent entre deux vecteurs différents (doublons, copies sur place, imports DXF)
let ovV = -1, ovC = null, ovG = null;
function overlaps() {
  if (ovV === snapVer && ovC) return ovC; ovV = snapVer;
  /* même géométrie qu'au dernier calcul (ordre des formes, tracés, visibilité) : on garde le résultat */
  const geo = S.shapes.map(sh => shown(sh) && sh.pts && sh.pts.length >= 2 ? sh.pts : null).concat(S.shapes.map(sh => !!sh.closed)); if (ovC && ovG && geo.length === ovG.length && geo.every((x, i) => x === ovG[i])) return ovC; ovG = geo;
  const segs = [], cell = 10, G = new Map(), out = [], pairs = new Map();
  S.shapes.forEach((sh, si) => { if (!shown(sh) || !sh.pts || sh.pts.length < 2) return; const P = sh.pts, n = sh.closed ? P.length : P.length - 1; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % P.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) continue; segs.push({ a, b, si }); } });
  if (segs.length > 80000) { ovC = { segs: [], pairs: [] }; return ovC; }
  segs.forEach((g, k) => { const i0 = Math.floor(Math.min(g.a[0], g.b[0]) / cell), i1 = Math.floor(Math.max(g.a[0], g.b[0]) / cell), j0 = Math.floor(Math.min(g.a[1], g.b[1]) / cell), j1 = Math.floor(Math.max(g.a[1], g.b[1]) / cell); if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) return; for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const key = i + ',' + j; let L = G.get(key); if (!L) G.set(key, L = []); L.push(k); } });
  /* longueur et direction de chaque segment calculées une fois ; le test « déjà vu » n'est fait que pour les paires qui se recouvrent (même résultat, une paire rejetée l'est partout) */
  const seen = new Set(), tol = 0.02, nS = segs.length, UX = new Float64Array(nS), UY = new Float64Array(nS), LA = new Float64Array(nS), SI = new Int32Array(nS);
  for (let k = 0; k < nS; k++) { const g = segs[k]; UX[k] = g.b[0] - g.a[0]; UY[k] = g.b[1] - g.a[1]; LA[k] = Math.hypot(UX[k], UY[k]); SI[k] = g.si; }
  for (const L of G.values()) for (let x = 0; x < L.length; x++) { const ka = L[x], sa = SI[ka], la = LA[ka], dx = UX[ka] / la, dy = UY[ka] / la; for (let y = x + 1; y < L.length; y++) {
    const kb = L[y]; if (sa === SI[kb]) continue; const vx = UX[kb], vy = UY[kb], lb = LA[kb];
    if (Math.abs(dx * vy - dy * vx) / lb > 2e-3) continue; const A = segs[ka], B = segs[kb]; const d1 = Math.abs((B.a[0] - A.a[0]) * dy - (B.a[1] - A.a[1]) * dx), d2 = Math.abs((B.b[0] - A.a[0]) * dy - (B.b[1] - A.a[1]) * dx); if (d1 > tol || d2 > tol) continue;
    const t1 = (B.a[0] - A.a[0]) * dx + (B.a[1] - A.a[1]) * dy, t2 = (B.b[0] - A.a[0]) * dx + (B.b[1] - A.a[1]) * dy, lo = Math.max(0, Math.min(t1, t2)), hi = Math.min(la, Math.max(t1, t2)); if (hi - lo < 0.2) continue;
    const key = ka < kb ? ka * 1e6 + kb : kb * 1e6 + ka; if (seen.has(key)) continue; seen.add(key);
    out.push([[A.a[0] + dx * lo, A.a[1] + dy * lo], [A.a[0] + dx * hi, A.a[1] + dy * hi]]); const pk = Math.min(A.si, B.si) + '-' + Math.max(A.si, B.si); pairs.set(pk, (pairs.get(pk) || 0) + (hi - lo));
  } }
  const per = si => { const P = S.shapes[si].pts; let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (S.shapes[si].closed) L += Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]); return L || 1; };
  const pl = [...pairs.entries()].filter(([, l]) => l >= 1).map(([k, l]) => { const [a, b] = k.split('-').map(Number); return { a, b, dup: l >= 0.95 * Math.min(per(a), per(b)) }; });
  ovC = { segs: out, pairs: pl }; return ovC;
}
function drawOverlaps() {
  if (S.ui.showOver === undefined) { S.ui.showOver = true; if (typeof refreshToggles === 'function') setTimeout(refreshToggles, 0); }
  const O = overlaps();
  if (!O.segs.length || S.ui.showOver === false) return; ctx.save(); ctx.strokeStyle = 'rgba(226,60,160,.5)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); for (const [a, c] of O.segs) { ctx.moveTo(sx(a[0]), sy(a[1])); ctx.lineTo(sx(c[0]), sy(c[1])); } ctx.stroke(); ctx.restore();
}
// accrochage aux objets : extrémités, milieux, intersections, centres d'arcs, tangentes
let snapVer = 0, snapCacheV = -1, snapCache = null, cenHint = [];
const SNAP_KEY = { end: 'snapEnd', mid: 'snapMid', int: 'snapInt', cen: 'snapCen', tan: 'snapTan', on: 'snapOn' }, SNAP_LBL = { ext: 'Prolongement', end: 'Extrémité', mid: 'Milieu', int: 'Intersection', cen: 'Centre', tan: 'Tangente', on: 'Sur le tracé', org: 'Origine', hor: 'Horizontale', ver: 'Verticale', ang: 'Angle', stk: 'Brut', gd: 'Repère' }; const SNAP_EN = { ext: 'Extension', end: 'Endpoint', mid: 'Midpoint', int: 'Intersection', cen: 'Center', tan: 'Tangent', on: 'On the path', org: 'Origin', hor: 'Horizontal', ver: 'Vertical', ang: 'Angle', stk: 'Stock', gd: 'Guide' }; // libellés dessinés dans la vue 2D : « Milieu » et « Centre » ont un sens propre ici
const snapOff = false;
/* points d'accroche gardés par forme (tracé, nœuds, fermeture) et intersections gardées par paire de formes : après une modification, seul ce qui touche la forme modifiée est recalculé. Même contenu et même ordre que le calcul complet */
const SNAPSH = new WeakMap(), SNAPINT = new WeakMap();
function snapShape(s) {
  let c = s.pts && SNAPSH.get(s.pts); if (c && c.nodes === s.nodes && c.closed === !!s.closed && c.id === s.id) return c;
  const pts = [], arcs = [], lines = [], seenC = new Set(); let hasCen = false;
  if (s.nodes.length < 3000) s.nodes.forEach((n, ni) => pts.push({ p: [n.x, n.y], k: 'end', ids: [s.id], ni }));
  const ns = nseg(s);
  if (ns < 3000) for (let k = 0; k < ns; k++) {
    const g = segOf(s, k); pts.push({ p: bez(g, 0.5), k: 'mid', ids: [s.id], seg: k }); if (g.line) lines.push({ a: g.p0, b: g.p3, id: s.id });
    if (!g.line) { const m = bez(g, 0.5), cc = circle3(g.p0, m, g.p3); if (cc && cc.r < 5000) { const q1 = bez(g, 0.25), q3 = bez(g, 0.75), tol = 0.01 + cc.r * 0.003; if (Math.abs(hyp(q1, cc.C) - cc.r) < tol && Math.abs(hyp(q3, cc.C) - cc.r) < tol) { arcs.push({ C: cc.C, r: cc.r, g, id: s.id }); const key = Math.round(cc.C[0] * 50) + ',' + Math.round(cc.C[1] * 50) + ',' + s.id; if (!seenC.has(key)) { seenC.add(key); pts.push({ p: cc.C, k: 'cen', ids: [s.id], seg: k, r: cc.r }); hasCen = true; } } } }
  }
  // cercle fait de segments droits (importé, vectorisé) : centre si tous les points sont à la même distance
  if (s.closed && s.pts && s.pts.length >= 12 && s.pts.length < 5000 && !hasCen) { const b = bbOf(s.pts), w = b.x1 - b.x0, h = b.y1 - b.y0, r = (w + h) / 4; if (r > 0 && Math.abs(w - h) < Math.max(0.05, r * 0.04)) { const Cc = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], tl = Math.max(0.03, r * 0.025); if (s.pts.every(q => Math.abs(hyp(q, Cc) - r) < tl)) pts.push({ p: Cc, k: 'cen', ids: [s.id], r }); } }
  c = { nodes: s.nodes, closed: !!s.closed, id: s.id, pts, arcs, lines, bb: bbOf(s.pts) }; if (s.pts) SNAPSH.set(s.pts, c); return c;
}
function snapPair(A, B, sa, sb) {
  const P = sa.pts, Q = sb.pts; let m = SNAPINT.get(P); if (!m) SNAPINT.set(P, m = new WeakMap()); let c = m.get(Q);
  if (c && c.ca === !!sa.closed && c.cb === !!sb.closed && c.ia === sa.id && c.ib === sb.id) return c.r;
  const r = [], mp = sa.closed ? P.length : P.length - 1, mq = sb.closed ? Q.length : Q.length - 1;
  for (let i = 0; i < mp; i++) {
    const p0 = P[i], p1 = P[(i + 1) % P.length], x0 = Math.min(p0[0], p1[0]), x1 = Math.max(p0[0], p1[0]), y0 = Math.min(p0[1], p1[1]), y1 = Math.max(p0[1], p1[1]);
    if (x0 > B.x1 || x1 < B.x0 || y0 > B.y1 || y1 < B.y0) continue;
    for (let j = 0; j < mq; j++) { const q0 = Q[j], q1 = Q[(j + 1) % Q.length]; if (Math.max(q0[0], q1[0]) < x0 || Math.min(q0[0], q1[0]) > x1 || Math.max(q0[1], q1[1]) < y0 || Math.min(q0[1], q1[1]) > y1) continue; const t = segInt(p0, p1, q0, q1); if (t !== null) r.push({ p: [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t], k: 'int', ids: [sa.id, sb.id] }); }
  }
  m.set(Q, { ca: !!sa.closed, cb: !!sb.closed, ia: sa.id, ib: sb.id, r }); return r;
}
function buildSnapCache() {
  const vis = S.shapes.filter(shown), pts = [], arcs = [], lines = [];
  const per = vis.map(snapShape); for (const c of per) { for (const x of c.pts) pts.push(x); for (const x of c.arcs) arcs.push(x); for (const x of c.lines) lines.push(x); }
  const bb = per.map(c => c.bb);
  for (let a = 0; a < vis.length; a++) for (let b = a + 1; b < vis.length; b++) {
    const A = bb[a], B = bb[b]; if (A.x0 > B.x1 || B.x0 > A.x1 || A.y0 > B.y1 || B.y0 > A.y1) continue;
    if (vis[a].pts.length * vis[b].pts.length > 3e6) continue;
    for (const x of snapPair(A, B, vis[a], vis[b])) pts.push(x);
  }
  return { pts, arcs, lines, shp: vis.filter(s => s.pts && s.pts.length > 1 && s.pts.length < 20000).map(s => ({ id: s.id, P: s.pts, closed: s.closed, bb: bbOf(s.pts) })) };
}
function getSnapCache() { if (snapCacheV !== snapVer) { snapCache = buildSnapCache(); snapCacheV = snapVer; } return snapCache; }
function snapFrom() { if (pen.length) { const n = pen[pen.length - 1]; return [n.x, n.y]; } if (arcSt.length) return arcSt[arcSt.length - 1]; if (dimSt.length) return dimSt[dimSt.length - 1]; if (drag && (drag.mode === 'rect' || drag.mode === 'circle' || drag.mode === 'polygon' || drag.mode === 'measure') && drag.p0) return drag.p0; return null; }
const stockPts = () => { const w = S.stock.w, h = S.stock.h; return [[0, 0], [w, 0], [w, h], [0, h], [w / 2, h / 2], [w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]; };
const snapTol = () => (+S.ui.snapR || 9) / S.view.s;
// point de la sélection saisi au clic (nœud, extrémité, milieu ou centre proche du curseur) : il servira de point d'accroche pendant le déplacement
function moveAnchor(p) { const tol = snapTol(); let best = null, bd = tol; for (const sh of selShapes()) { for (const n of sh.nodes) { const d = Math.hypot(n.x - p[0], n.y - p[1]); if (d < bd) { bd = d; best = [n.x, n.y]; } } } if (best) return best; const C = getSnapCache(); for (const c of C.pts) { if (!c.ids.some(id => S.sel.has(id)) || c.k === 'int') continue; const d = hyp(c.p, p); if (d < bd) { bd = d; best = c.p.slice(); } } return best; }
function snap(p, excl, opt) {
  snapMark = null; const tol = snapTol(); if (snapOff) return p.slice();
  const pen0 = { end: 0, int: 0.5, stk: 0.5, org: 0, cen: 1, mid: 1.5, tan: 2, on: 3.5, ext: 4 }; let best = null, bd = tol;
  const consider = (q, k, ref) => { if (SNAP_KEY[k] && S.ui[SNAP_KEY[k]] === false) return; const d = hyp(q, p) + pen0[k] / S.view.s; if (d < bd) { bd = d; best = { p: q, k, ref: ref || null }; } };
  if (S.ui.snapStock) for (const q of stockPts()) consider(q, 'stk');
  if (S.ui.snapVert || S.ui.snapStock || S.ui.snapGuide !== false) consider(originOf(S.stock), 'org'); // l'origine (X0 Y0) est toujours un point d'accroche
  cenHint = [];
  if (S.ui.snapVert) {
    const C = getSnapCache();
    if (S.ui.snapCen !== false) for (const c of C.pts) { if (c.k !== 'cen' || !c.r || (excl && c.ids.some(id => excl.has(id)))) continue; const d = hyp(c.p, p); if (Math.abs(d - c.r) < tol * 2.5 || d < tol * 3) { cenHint.push(c.p); if (cenHint.length > 8) break; } }
    for (const c of C.pts) { if (excl && c.ids.some(id => excl.has(id))) continue; if (Math.abs(c.p[0] - p[0]) > tol || Math.abs(c.p[1] - p[1]) > tol) continue; consider(c.p, c.k, c); }
    for (let i = 0; i < pen.length - 1; i++) consider([pen[i].x, pen[i].y], 'end');
    if (opt && opt.ext && S.ui.snapOn !== false) { // prolongement des segments droits (édition des nœuds et des poignées)
      const lines = []; for (const c of C.lines) if (!excl || !excl.has(c.id)) lines.push(c);
      if (opt.own) { const o = opt.own, mv = new Set(opt.moving || []), n = o.nodes.length; for (let k = 0; k < nseg(o); k++) { const g = segOf(o, k); if (g.line && !mv.has(k) && !mv.has((k + 1) % n)) lines.push({ a: g.p0, b: g.p3, id: o.id }); } }
      for (const L of lines) { const dx = L.b[0] - L.a[0], dy = L.b[1] - L.a[1], l2 = dx * dx + dy * dy; if (l2 < 1e-12) continue; const t = ((p[0] - L.a[0]) * dx + (p[1] - L.a[1]) * dy) / l2; if (t >= 0 && t <= 1) continue; const q = [L.a[0] + dx * t, L.a[1] + dy * t]; if (Math.abs(q[0] - p[0]) > tol || Math.abs(q[1] - p[1]) > tol) continue; consider(q, 'ext', { from: t > 1 ? L.b : L.a }); }
    }
    if (S.ui.snapOn !== false) for (const c of C.shp) { // n'importe quel point du tracé (le plus proche du curseur)
      if (excl && excl.has(c.id)) continue; const b = c.bb; if (p[0] < b.x0 - tol || p[0] > b.x1 + tol || p[1] < b.y0 - tol || p[1] > b.y1 + tol) continue;
      const P = c.P, n = c.closed ? P.length : P.length - 1; let bq = null, bdd = tol;
      for (let i = 0; i < n; i++) { const a = P[i], e = P[(i + 1) % P.length], dx = e[0] - a[0], dy = e[1] - a[1], L2 = dx * dx + dy * dy; if (!L2) continue; if (Math.max(a[0], e[0]) < p[0] - tol || Math.min(a[0], e[0]) > p[0] + tol || Math.max(a[1], e[1]) < p[1] - tol || Math.min(a[1], e[1]) > p[1] + tol) continue; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)), q = [a[0] + dx * t, a[1] + dy * t], d = hyp(q, p); if (d < bdd) { bdd = d; bq = q; } }
      if (bq) consider(bq, 'on');
    }
    const F = snapFrom();
    if (F && S.ui.snapTan !== false) for (const a of C.arcs) {
      if (excl && excl.has(a.id)) continue; const d = hyp(F, a.C); if (d <= a.r + 1e-6 || Math.abs(hyp(p, a.C) - a.r) > tol * 2) continue;
      const base = Math.atan2(F[1] - a.C[1], F[0] - a.C[0]), dl = Math.acos(a.r / d);
      for (const sg of [-1, 1]) { const T = [a.C[0] + a.r * Math.cos(base + sg * dl), a.C[1] + a.r * Math.sin(base + sg * dl)]; let md = Infinity; for (let k = 0; k <= 16; k++) md = Math.min(md, hyp(bez(a.g, k / 16), T)); if (md < Math.max(0.1, a.r * 0.15)) consider(T, 'tan'); }
    }
  }
  const F0 = pen.length || arcSt.length || dimSt.length || (drag && (drag.mode === 'measure' || drag.mode === 'polygon')) ? snapFrom() : null; // tracés de lignes et 2e point du polygone (pas les rectangles ni les cercles)
  if (F0 && ctrlHeld) { // Ctrl : angle par pas de 15° depuis le point précédent
    const dx = p[0] - F0[0], dy = p[1] - F0[1], L = Math.hypot(dx, dy); if (L > 1e-9) { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12); let l = L; if (S.ui.snapGrid) l = Math.max(S.ui.gridStep, Math.round(l / S.ui.gridStep) * S.ui.gridStep); const q = [F0[0] + l * Math.cos(a), F0[1] + l * Math.sin(a)]; snapMark = { p: q.slice(), k: 'ang', from: F0, a: Math.round(a * 180 / Math.PI) }; return q; } }
  if (best) { if (best.k === 'ext' && best.ref) best.from = best.ref.from; snapMark = best; return best.p.slice(); }
  const q = S.ui.snapGrid ? [Math.round(p[0] / S.ui.gridStep) * S.ui.gridStep, Math.round(p[1] / S.ui.gridStep) * S.ui.gridStep] : p.slice();
  if (F0 && S.ui.snapVert !== false) { const hz = Math.abs(p[1] - F0[1]) < tol, vt = Math.abs(p[0] - F0[0]) < tol; // horizontale / verticale depuis le point précédent
    if (hz && !vt) { q[1] = F0[1]; snapMark = { p: q.slice(), k: 'hor', from: F0 }; return q; } if (vt && !hz) { q[0] = F0[0]; snapMark = { p: q.slice(), k: 'ver', from: F0 }; return q; } }
  if (S.ui.snapGuide !== false) { let hit = false; for (const gx of S.guides.x) if (Math.abs(p[0] - gx) < tol) { q[0] = gx; hit = true; } for (const gy of S.guides.y) if (Math.abs(p[1] - gy) < tol) { q[1] = gy; hit = true; } if (hit) snapMark = { p: q.slice(), k: 'gd' }; }
  return q;
}
// alignement des bords et du centre d'une sélection déplacée sur les repères et le brut
function moveAlign(b, dx, dy) {
  if (!b || snapOff) return [dx, dy]; const tol = snapTol(), Lx = [], Ly = [];
  if (S.ui.snapGuide !== false) { Lx.push(...S.guides.x.map(v => [v, 'gd'])); Ly.push(...S.guides.y.map(v => [v, 'gd'])); }
  if (S.ui.snapStock) { const w = S.stock.w, h = S.stock.h; Lx.push([0, 'stk'], [w / 2, 'stk'], [w, 'stk']); Ly.push([0, 'stk'], [h / 2, 'stk'], [h, 'stk']); }
  if (!Lx.length && !Ly.length) return [dx, dy];
  const best = (L, E, d) => { let r = null, bd = tol; for (const [v, k] of L) for (const e of E) { const g = Math.abs(e + d - v); if (g < bd) { bd = g; r = { d: v - e, v, k }; } } return r; };
  const ax = best(Lx, [b.x0, (b.x0 + b.x1) / 2, b.x1], dx), ay = best(Ly, [b.y0, (b.y0 + b.y1) / 2, b.y1], dy);
  if (ax) dx = ax.d; if (ay) dy = ay.d;
  if (ax || ay) snapMark = { p: [ax ? ax.v : (b.x0 + b.x1) / 2 + dx, ay ? ay.v : (b.y0 + b.y1) / 2 + dy], k: (ax || ay).k };
  return [dx, dy];
}
