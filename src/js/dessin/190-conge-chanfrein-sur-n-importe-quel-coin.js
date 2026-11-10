// ---------- congé / chanfrein sur n'importe quel coin (droite–courbe, courbe–courbe) ----------
function bezD(g, t) {
  if (g.line) return [g.p3[0] - g.p0[0], g.p3[1] - g.p0[1]];
  const u = 1 - t, f = (a, b, c, d) => 3 * (u * u * (b - a) + 2 * u * t * (c - b) + t * t * (d - c));
  return [f(g.p0[0], g.c1[0], g.c2[0], g.p3[0]), f(g.p0[1], g.c1[1], g.c2[1], g.p3[1])];
}
function cornerDirs(s, i) {
  const n = s.nodes.length, gA = segOf(s, (i - 1 + n) % n), gB = segOf(s, i);
  let a = bezD(gA, 1), b = bezD(gB, 0); a = [-a[0], -a[1]];
  if (Math.hypot(a[0], a[1]) < 1e-9) { const q = bez(gA, 0.999); a = [q[0] - gA.p3[0], q[1] - gA.p3[1]]; }
  if (Math.hypot(b[0], b[1]) < 1e-9) { const q = bez(gB, 0.001); b = [q[0] - gB.p0[0], q[1] - gB.p0[1]]; }
  return { gA, gB, u1: nrm(a), u2: nrm(b) };
}
function canCorner(s, i) {
  const n = s.nodes.length; if (n < (s.closed ? 2 : 3) || (!s.closed && (i === 0 || i === n - 1))) return false;
  const { u1, u2 } = cornerDirs(s, i); if (!isFinite(u1[0]) || !isFinite(u2[0])) return false;
  return Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))) < Math.PI * 0.97;
}
// modifie la forme sur place ; renvoie false si le coin ne peut pas être traité (rayon trop grand…)
function applyCorner(s, i, kind, val, frac) {
  const n = s.nodes.length, ip = (i - 1 + n) % n, iq = (i + 1) % n;
  if (!(val > 0)) return false;
  if (segIsLine(s, ip) && segIsLine(s, i)) { const nn = cornerNodes(s, i, kind, val, frac); if (nn.length < 2) return false; s.nodes.splice(i, 1, ...nn); refresh(s); return true; }
  const { gA, gB, u1, u2 } = cornerDirs(s, i), V = [s.nodes[i].x, s.nodes[i].y];
  const tMinA = 1 - frac, tMaxB = frac; let tA, tB, C = null, r = val;
  if (kind === 'chamfer') {
    const at = (g, d, lo, hi, fromEnd) => { const dd = t => hyp(bez(g, t), V) - d; if (dd(fromEnd ? lo : hi) < 0) return null; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if ((dd(m) < 0) === fromEnd) hi = m; else lo = m; } return (lo + hi) / 2; };
    tA = at(gA, val, tMinA, 1, true); tB = at(gB, val, 0, tMaxB, false); if (tA == null || tB == null) return false;
  } else {
    const bis = nrm([u1[0] + u2[0], u1[1] + u2[1]]), N = 400;
    const side = (g, tRef) => { const d = bezD(g, tRef), nn = nrm([-d[1], d[0]]); return nn[0] * bis[0] + nn[1] * bis[1] >= 0 ? 1 : -1; };
    const sgA = side(gA, 1), sgB = side(gB, 0);
    const off = (g, t, sg) => { const p = bez(g, t), d = nrm(bezD(g, t)); return [p[0] - d[1] * sg * r, p[1] + d[0] * sg * r]; };
    const OA = [], OB = []; for (let k = 0; k <= N; k++) { const ta = 1 - (1 - tMinA) * k / N, tb = tMaxB * k / N; OA.push([ta, off(gA, ta, sgA)]); OB.push([tb, off(gB, tb, sgB)]); }
    let best = Infinity;
    for (let a = 0; a < N; a++) { const p1 = OA[a][1], p2 = OA[a + 1][1];
      for (let b = 0; b < N; b++) { if (a + b > best) break; const q1 = OB[b][1], q2 = OB[b + 1][1], rx = p2[0] - p1[0], ry = p2[1] - p1[1], sx_ = q2[0] - q1[0], sy_ = q2[1] - q1[1], den = rx * sy_ - ry * sx_; if (Math.abs(den) < 1e-14) continue;
        const qx = q1[0] - p1[0], qy = q1[1] - p1[1], u = (qx * sy_ - qy * sx_) / den, v = (qx * ry - qy * rx) / den;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue; if (a + b < best) { best = a + b; C = [p1[0] + u * rx, p1[1] + u * ry]; tA = OA[a][0] + (OA[a + 1][0] - OA[a][0]) * u; tB = OB[b][0] + (OB[b + 1][0] - OB[b][0]) * v; } } }
    if (!C) return false;
  }
  const P = s.nodes[ip], Q = s.nodes[iq];
  const pa = splitSeg(gA, tA)[0], pb = splitSeg(gB, tB)[1], TA = pa.p3, TB = pb.p0;
  if (!pa.line) P.o = [pa.c1[0] - P.x, pa.c1[1] - P.y];
  if (!pb.line) Q.i = [pb.c2[0] - Q.x, pb.c2[1] - Q.y];
  const nA = NODE(TA[0], TA[1], pa.line ? null : [pa.c2[0] - TA[0], pa.c2[1] - TA[1]]), nB = NODE(TB[0], TB[1], null, pb.line ? null : [pb.c1[0] - TB[0], pb.c1[1] - TB[1]]);
  let mid = [nA, nB];
  if (kind !== 'chamfer') {
    const a0 = Math.atan2(TA[1] - C[1], TA[0] - C[0]); let sw = Math.atan2(TB[1] - C[1], TB[0] - C[0]) - a0;
    while (sw > Math.PI) sw -= 2 * Math.PI; while (sw <= -Math.PI) sw += 2 * Math.PI;
    mid = arcNodes(C, r, a0, sw); mid[0].i = nA.i; mid[mid.length - 1].o = nB.o;
  }
  s.nodes.splice(i, 1, ...mid); refresh(s); return true;
}
// dogbone / T-bone dessinés : un arc du diamètre de la fraise qui passe par le coin vif (entre deux segments droits)
function dogNodes(s, i, kind, D) {
  const n = s.nodes.length, Pn = s.nodes[(i - 1 + n) % n], V = s.nodes[i], Qn = s.nodes[(i + 1) % n], r = D / 2 + 0.05; // +0,05 mm : la fraise passe sans forcer
  const Vp = [V.x, V.y], a = [Pn.x - V.x, Pn.y - V.y], b = [Qn.x - V.x, Qn.y - V.y], la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
  if (la < 1e-9 || lb < 1e-9 || !(r > 0)) return null;
  const u1 = [a[0] / la, a[1] / la], u2 = [b[0] / lb, b[1] / lb], cs = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])), phi = Math.acos(cs);
  if (phi > Math.PI * 0.97 || phi < 0.02) return null;
  const ang = q => Math.atan2(q[1] - C[1], q[0] - C[0]), m2 = x => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); let C;
  if (kind === 'tbone') {
    const longFirst = la >= lb, ul = longFirst ? u1 : u2, uo = longFirst ? u2 : u1, lo = longFirst ? lb : la;
    const nIn = nrm([uo[0] - ul[0] * cs, uo[1] - ul[1] * cs]); C = [Vp[0] + nIn[0] * r, Vp[1] + nIn[1] * r];
    const t = 2 * r * (uo[0] * nIn[0] + uo[1] * nIn[1]); if (!(t > 1e-6) || t >= lo - 1e-6) return null;
    const Bp = [Vp[0] + uo[0] * t, Vp[1] + uo[1] * t], nS = nrm([ul[0] - uo[0] * cs, ul[1] - uo[1] * cs]);
    const S0 = longFirst ? Vp : Bp, S1 = longFirst ? Bp : Vp, a0 = ang(S0), s1 = m2(ang(S1) - a0);
    const mid = sw => { const am = a0 + sw / 2; return [C[0] + r * Math.cos(am), C[1] + r * Math.sin(am)]; };
    let sw = s1; const M = mid(sw); if ((M[0] - Vp[0]) * nS[0] + (M[1] - Vp[1]) * nS[1] > 0) sw = s1 - 2 * Math.PI;
    const arc = arcNodes(C, r, a0, sw); return arc;
  }
  const bis = nrm([u1[0] + u2[0], u1[1] + u2[1]]); C = [Vp[0] + bis[0] * r, Vp[1] + bis[1] * r];
  const c = 2 * r * Math.cos(phi / 2); if (c >= la - 1e-6 || c >= lb - 1e-6) return null;
  const A = [Vp[0] + u1[0] * c, Vp[1] + u1[1] * c], B = [Vp[0] + u2[0] * c, Vp[1] + u2[1] * c], a0 = ang(A), s1 = m2(ang(B) - a0), pv = m2(ang(Vp) - a0);
  return arcNodes(C, r, a0, pv < s1 ? s1 : s1 - 2 * Math.PI);
}
function applyDog(s, i, kind, D) {
  const n = s.nodes.length; if (!canCorner(s, i) || !segIsLine(s, (i - 1 + n) % n) || !segIsLine(s, i)) return false;
  const nn = dogNodes(s, i, kind, D); if (!nn || nn.length < 2) return false; s.nodes.splice(i, 1, ...nn); refresh(s); return true;
}
function cornerAllNodes(s, kind, val) {
  const idx = s.nodes.map((_, i) => i).filter(i => canCorner(s, i)); if (!idx.length) return 0;
  // limite de chaque coin calculée sur la forme d'origine (sinon les coins traités en dernier voient des côtés déjà raccourcis et sortent plus petits)
  const N = s.nodes.length, vals = new Map(), hz = v => !v || Math.hypot(v[0], v[1]) < 1e-9;
  for (const i of idx) { const P = s.nodes[(i - 1 + N) % N], V = s.nodes[i], Q = s.nodes[(i + 1) % N]; if (!hz(P.o) || !hz(V.i) || !hz(V.o) || !hz(Q.i)) continue;
    const a = [P.x - V.x, P.y - V.y], c = [Q.x - V.x, Q.y - V.y], la = Math.hypot(a[0], a[1]), lb = Math.hypot(c[0], c[1]); if (la < 1e-9 || lb < 1e-9) continue;
    const th = Math.acos(Math.max(-1, Math.min(1, (a[0] * c[0] + a[1] * c[1]) / (la * lb)))), lim = Math.min(la, lb) * 0.5; if (th > Math.PI * 0.97 || th < 1e-6) continue;
    vals.set(i, kind === 'chamfer' ? Math.min(val, lim) : (val / Math.tan(th / 2) > lim ? lim * Math.tan(th / 2) : val)); }
  let n = 0; for (const i of idx.sort((a, b) => b - a)) { const v = vals.has(i) ? vals.get(i) : val; if (applyCorner(s, i, kind, v, vals.has(i) ? 0.9999 : 0.5) || applyCorner(s, i, kind, v, 0.999)) n++; }
  return n;
}
// extrait le tronçon de u0 à u1 (u peut dépasser nseg sur une forme fermée : on boucle)
function extractNodes(s, u0, u1) {
  const ns = nseg(s), out = [], br = [u0];
  for (let k = Math.floor(u0 + 1e-9) + 1; k < u1 - 1e-9; k++) br.push(k);
  br.push(u1);
  for (let j = 0; j < br.length - 1; j++) {
    const ua = br[j], ub = br[j + 1]; if (ub - ua < 1e-9) continue;
    const k = Math.floor(ua + 1e-9), g = subSeg(segOf(s, ((k % ns) + ns) % ns), Math.max(0, ua - k), Math.min(1, ub - k));
    if (!out.length) out.push(NODE(g.p0[0], g.p0[1]));
    const last = out[out.length - 1];
    if (g.line) out.push(NODE(g.p3[0], g.p3[1]));
    else { last.o = [g.c1[0] - g.p0[0], g.c1[1] - g.p0[1]]; out.push(NODE(g.p3[0], g.p3[1], [g.c2[0] - g.p3[0], g.c2[1] - g.p3[1]], null)); }
  }
  return out;
}
function insertNode(s, u) {
  const ns = nseg(s), k = Math.min(ns - 1, Math.floor(u)), t = u - k; if (t < 1e-3 || t > 1 - 1e-3) return -1;
  const n = s.nodes.length, a = s.nodes[k], b = s.nodes[(k + 1) % n], g = segOf(s, k), [L, R] = splitSeg(g, t), F = L.p3;
  let nn;
  if (g.line) nn = NODE(F[0], F[1]);
  else { a.o = [L.c1[0] - L.p0[0], L.c1[1] - L.p0[1]]; nn = NODE(F[0], F[1], [L.c2[0] - F[0], L.c2[1] - F[1]], [R.c1[0] - F[0], R.c1[1] - F[1]], true); b.i = [R.c2[0] - R.p3[0], R.c2[1] - R.p3[1]]; }
  s.nodes.splice(k + 1, 0, nn); refresh(s); return k + 1;
}
// position paramétrique la plus proche d'un point
function paramAt(s, p) {
  const P = s.pts, U = s.map, n = P.length, ns = nseg(s), m = s.closed ? n : n - 1; let best = Infinity, bu = 0;
  for (let i = 0; i < m; i++) {
    const a = P[i], b = P[(i + 1) % n], ua = U[i], ub = i + 1 < n ? U[i + 1] : ns;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); if (d < best) { best = d; bu = ua + (ub - ua) * t; }
  }
  return { u: bu, d: best };
}
function segInt(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], q = [d[0] - c[0], d[1] - c[1]], den = r[0] * q[1] - r[1] * q[0]; if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) ? null : t;
}
const bbOf = pts => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return { x0, y0, x1, y1 }; };
function intersParams(s, others) {
  const P = s.pts, U = s.map, n = P.length, ns = nseg(s), m = s.closed ? n : n - 1, res = [], bs = bbOf(P);
  for (const o of others) {
    const Q = o.pts, mq = o.closed ? Q.length : Q.length - 1, bo = bbOf(Q);
    if (bo.x0 > bs.x1 || bo.x1 < bs.x0 || bo.y0 > bs.y1 || bo.y1 < bs.y0) continue;
    for (let i = 0; i < m; i++) {
      const a = P[i], b = P[(i + 1) % n], sx0 = Math.min(a[0], b[0]), sx1 = Math.max(a[0], b[0]), sy0 = Math.min(a[1], b[1]), sy1 = Math.max(a[1], b[1]);
      if (sx0 > bo.x1 || sx1 < bo.x0 || sy0 > bo.y1 || sy1 < bo.y0) continue;
      for (let j = 0; j < mq; j++) {
        const c = Q[j], d = Q[(j + 1) % Q.length];
        if (Math.max(c[0], d[0]) < sx0 || Math.min(c[0], d[0]) > sx1 || Math.max(c[1], d[1]) < sy0 || Math.min(c[1], d[1]) > sy1) continue;
        const t = segInt(a, b, c, d); if (t !== null) res.push(U[i] + ((i + 1 < n ? U[i + 1] : ns) - U[i]) * t);
      }
    }
  }
  res.sort((x, y) => x - y); const out = []; for (const x of res) if (!out.length || x - out[out.length - 1] > 1e-6) out.push(x);
  return out;
}
// ajuster : renvoie la liste des morceaux (listes de nœuds ouvertes) qui restent, ou null si rien à couper
function trimPieces(s, others, p) {
  const xs = intersParams(s, others), { u } = paramAt(s, p), ns = nseg(s);
  if (!xs.length) return [];
  if (!s.closed) {
    const a = xs.filter(x => x < u - 1e-9).pop(), b = xs.find(x => x > u + 1e-9), parts = [];
    if (a !== undefined && a > 1e-6) parts.push(extractNodes(s, 0, a));
    if (b !== undefined && b < ns - 1e-6) parts.push(extractNodes(s, b, ns));
    return parts;
  }
  if (xs.length < 2) return null;
  let a = xs.filter(x => x < u).pop(), b = xs.find(x => x > u);
  if (a === undefined) a = xs[xs.length - 1] - ns; if (b === undefined) b = xs[0] + ns;
  return [extractNodes(s, b, a + ns)];
}
function cutPieces(s, u) { const ns = nseg(s); if (s.closed) return [extractNodes(s, u, u + ns)]; if (u < 1e-6 || u > ns - 1e-6) return null; return [extractNodes(s, 0, u), extractNodes(s, u, ns)]; }
// joindre des vecteurs ouverts (chaînage glouton par extrémités)
// liaison lisse entre la fin d'un tracé (e, précédé de pe) et le début d'un autre (b, suivi de nb)
function bridgeNodes(e, pe, b, nb) {
  const d = Math.hypot(b.x - e.x, b.y - e.y); if (d < 1e-9) return; const L = d / 3, nr = v => { const l = Math.hypot(v[0], v[1]); return l > 1e-12 ? [v[0] / l, v[1] / l] : null; };
  const de = (e.i && nr([-e.i[0], -e.i[1]])) || (pe && nr([e.x - pe.x, e.y - pe.y])) || nr([b.x - e.x, b.y - e.y]);
  const db = (b.o && nr(b.o)) || (nb && nr([nb.x - b.x, nb.y - b.y])) || nr([b.x - e.x, b.y - e.y]);
  e.o = [de[0] * L, de[1] * L]; b.i = [-db[0] * L, -db[1] * L];
}
function joinNodes(list, tol, mode) {
  let chain = list[0].map(cloneNode); const rem = list.slice(1).map(l => l.map(cloneNode));
  const P = n => [n.x, n.y], curve = mode === 'curve';
  const attach = (front, add) => {
    if (front) { const a = add[add.length - 1], c = chain[0]; if (hyp(P(a), P(c)) < tol) { c.i = a.i; add = add.slice(0, -1); } else if (curve) bridgeNodes(a, add[add.length - 2], c, chain[1]); chain = add.concat(chain); }
    else { const c = chain[chain.length - 1], a = add[0]; if (hyp(P(a), P(c)) < tol) { c.o = a.o; add = add.slice(1); } else if (curve) bridgeNodes(c, chain[chain.length - 2], a, add[1]); chain = chain.concat(add); }
  };
  while (rem.length) {
    let best = null;
    rem.forEach((r, i) => {
      const e = P(chain[chain.length - 1]), s0 = P(chain[0]), rs = P(r[0]), re = P(r[r.length - 1]);
      [[hyp(e, rs), i, false, false], [hyp(e, re), i, false, true], [hyp(s0, re), i, true, false], [hyp(s0, rs), i, true, true]].forEach(c => { if (!best || c[0] < best[0]) best = c; });
    });
    const r = rem.splice(best[1], 1)[0]; attach(best[2], best[3] ? reverseNodes(r) : r);
  }
  let closed = false;
  if (chain.length > 2 && hyp(P(chain[0]), P(chain[chain.length - 1])) < tol) { chain[0].i = chain[chain.length - 1].i; chain.pop(); closed = true; }
  return { nodes: chain, closed };
}
/*NODES-END*/

// ======================================================================
// Application
// ======================================================================
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);
const fr = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
const clone = o => JSON.parse(JSON.stringify(o));
// nom automatique d'un parcours : calque_fonction_fraise (ex. femelle_degagement_6mm, femelle_vcarve_90deg)
const TPN_FN = { fr: { 'profile:out': 'profil-ext', 'profile:in': 'profil-int', 'profile:on': 'profil-ligne', pocket: 'poche', vcarve: 'vcarve', drill: 'percage', thread: 'filetage', clr: 'degagement', rough: 'ebauche', rest: 'reprise', 'relief:rough': 'ebauche-relief', 'relief:finish': 'finition-relief' },
  en: { 'profile:out': 'profile-out', 'profile:in': 'profile-in', 'profile:on': 'profile-on', pocket: 'pocket', vcarve: 'vcarve', drill: 'drill', thread: 'thread', clr: 'clearance', rough: 'roughing', rest: 'rest', 'relief:rough': 'relief-rough', 'relief:finish': 'relief-finish' } };
function tpnTool(t) { if (!t) return '?'; const n = v => String(+(+v).toFixed(3)).replace('.', LANG === 'fr' ? ',' : '.'); return t.type === 'v' ? n(t.angle) + 'deg' : n(t.dia) + 'mm'; }
function tpnLayer(ids, rids) { const sh = (ids || []).map(id => S.shapes.find(x => x.id === id)).find(Boolean); if (sh) { const l = S.layers.find(x => x.id === sh.layer); if (l) return l.name.trim().replace(/\s+/g, '-'); } const r = (rids || []).map(id => S.relief.items.find(x => x.id === id)).find(Boolean); return r ? String(r.name || 'relief').trim().replace(/\s+/g, '-') : (LANG === 'fr' ? 'calque' : 'layer'); }
function tpAutoName(fn, layer, tool, face, except) { const F = TPN_FN[LANG === 'fr' ? 'fr' : 'en']; let b = (face === 2 ? 'F2_' : '') + layer + '_' + (F[fn] || fn) + '_' + tpnTool(tool), nm = b, k = 2; while (S.tps.some(x => x !== except && x.name === nm)) nm = b + '_' + k++; return nm; }
function tpFn(type, p) { return type === 'profile' ? 'profile:' + (p.side || 'out') : type === 'relief' ? 'relief:' + (p.rlOp === 'finish' ? 'finish' : 'rough') : type === 'pocket' && p.rest ? 'rest' : type; }
const TYPE_LBL = { profile: 'Profil', pocket: 'Poche', vcarve: 'V-carving', drill: 'Perçage', thread: 'Filetage', relief: 'Relief' };
const SIDE_LBL = { out: 'extérieur', in: 'intérieur', on: 'sur la ligne' };
const TOOL_LBL = { flat: 'Fraise droite', ball: 'Hémisphérique', v: 'Fraise en V', drill: 'Foret', thread: 'Fraise à fileter' };
const LS = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { } } };
const RB = 18; // largeur des règles en px

const DEFAULT_TOOLS = () => [
  { id: 't1', num: 1, name: tr('Fraise droite 3,175 mm'), type: 'flat', dia: 3.175, flutes: 2, angle: 90, rpm: 18000, feed: 1200, plunge: 300, pass: 1.5, over: 40 },
  { id: 't2', num: 2, name: tr('Fraise droite 6 mm'), type: 'flat', dia: 6, flutes: 2, angle: 90, rpm: 18000, feed: 2000, plunge: 500, pass: 3, over: 40 },
  { id: 't3', num: 3, name: tr('Fraise V 90° Ø12'), type: 'v', dia: 12, flutes: 2, angle: 90, rpm: 18000, feed: 1500, plunge: 500, pass: 3, over: 20 },
  { id: 't4', num: 4, name: tr('Fraise V 60° Ø6,35'), type: 'v', dia: 6.35, flutes: 2, angle: 60, rpm: 18000, feed: 1200, plunge: 400, pass: 2, over: 20 },
  { id: 't6', num: 6, name: tr('Foret 6 mm'), type: 'drill', dia: 6, flutes: 2, angle: 118, rpm: 8000, feed: 1000, plunge: 400, pass: 3, over: 0 },
  { id: 't5', num: 5, name: tr('Fraise hémisphérique 3 mm'), type: 'ball', dia: 3, flutes: 2, angle: 90, rpm: 18000, feed: 1000, plunge: 300, pass: 1, over: 50 },
];
const DEFAULT_LAYERS = () => [{ id: 'l1', name: tr('Calque 1'), visible: true, locked: false }];
const S = {
  stock: { w: 300, h: 200, t: 18, originXY: 'bl', originZ: 'top', offX: 0, offY: 0, mat: 'softwood' },
  shapes: [], sel: new Set(), tools: DEFAULT_TOOLS(), tps: [],
  images: [], imgSel: null, relief: { items: [], show: true, res: 0.3 }, relSel: null, layers: DEFAULT_LAYERS(), layerActive: 'l1', guides: { x: [], y: [] }, dims: [], selDim: null,
  machine: { tcZ: -10, post: 'grbl', safeZ: 10, clearZ: 2, rapid: 3000, maxFeed: 2000, comments: true, arcs: true },
  ui: {
    tool: 'select', chamfer: 3, fillet: 5, offDist: 3, offSide: 'out', offSharp: true, offDel: false, text: 'COPO', textH: 30, textOff: 0, showTP: true, showCut: true, showOver: true, showEnds: true, snapGrid: true, gridStep: 1, snapVert: true, snapEnd: true, snapMid: true, snapInt: true, snapCen: true, snapTan: true, snapOn: true, textMode: 'line', textSide: 'up', textSpace: 0,
    rectCorner: 'none', rectR: 5, polyN: 6, polyStar: false, polyInner: 50, joinTol: 0.5, joinMode: 'line', fitType: 'arc', fitTol: 0.1, fitCorner: true, fitAng: 60, fitRepl: true, dsec: null, alignRef: 'sel', distGap: 10, dogKind: 'dogbone', dogDia: 6,
    selAnchor: 'bl', arrMode: 'grid', arrNx: 3, arrNy: 2, arrGx: 10, arrGy: 10, arrN: 6, arrAng: 360, arrCx: 150, arrCy: 100, arrRot: true, arrPN: 5, arrPOff: 0, arrPFit: true, arrPGap: 20, arrPRot: true, arrPKeep: false, nestN: 1, nestGap: 8, nestMargin: 10, nestRot: '90', nestQ: 'normal', nestTp: true,
  },
  view: { s: 2, ox: 0, oy: 0 },
  form: null, editTp: null, activeTp: null, toolSel: 't2', font: null, ne: null, measure: null,
};
// outil par défaut : la fraise droite de 6 mm du projet si elle convient, sinon le premier outil qui convient
const toolDef = ok => S.tools.find(t => ok(t) && t.type === 'flat' && Math.abs(t.dia - 6) < 0.01) || S.tools.find(ok);
const newForm = () => ({ type: 'profile', name: '', vstart: 0, roughTool: '', restFrom: '', toolId: (toolDef(t => t.type === 'flat' || t.type === 'ball') || S.tools[0] || {}).id, side: 'out', depth: 6, pass: '', allow: 0, finish: 'last', dir: 'climb', entry: 'rampzz', rlEntry: 'rampzz', rampLen: '', arcR: 5, vstep: 0.1, clrTool: '', peck: 0, dwell: 0, openSide: 'on', face: 'auto', tabs: false, proj: false, tabN: 4, tabL: 8, tabH: 2, tabShape: 'rect', tabMode: 'auto', tabPts: null, strategy: 'rings', rasterAng: 0, rest: false, restTool: '', helixPitch: '', helixD: '', helixHoles: false, thSide: 'in', thPitch: 1.25, thD: 0, thHand: 'R', thPasses: 2, rlOp: 'rough', rlStep: 40, rlAng: 0, rlAllow: 0.5, rlCross: false, rlBound: 'model', rlOff: 0, rlRStrat: 'z', rlFStrat: 'raster', rlDir: 'climb', rlItems: null, rlEdge: 'inside' });

