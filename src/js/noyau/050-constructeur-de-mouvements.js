// ---------- constructeur de mouvements ----------
class MB {
  constructor(M) { this.M = M; this.m = []; this.x = null; this.y = null; this.z = M.safeZ; }
  same(x, y, z) { return this.x !== null && Math.abs(x - this.x) < 1e-6 && Math.abs(y - this.y) < 1e-6 && Math.abs(z - this.z) < 1e-6; }
  g0(x, y, z) { if (this.same(x, y, z)) return; this.m.push({ g: 0, x, y, z }); this.x = x; this.y = y; this.z = z; }
  g1(x, y, z, f) { if (this.same(x, y, z)) return; this.m.push({ g: 1, x, y, z, f }); this.x = x; this.y = y; this.z = z; }
  g1e(x, y, z, f) { if (this.same(x, y, z)) return; this.m.push({ g: 1, x, y, z, f, e: 1 }); this.x = x; this.y = y; this.z = z; } // descente en rampe ou en hélice
  up(h) { if (this.x !== null && this.z < h - 1e-9) this.g0(this.x, this.y, h); }
  approach(x, y, zTop, plunge) {
    if (this.x === null) { this.m.push({ g: 0, x, y, z: this.z }); this.x = x; this.y = y; }
    else { this.up(this.M.clearZ); this.g0(x, y, this.z); }
    const zz = zTop + 0.5; if (zz < this.z) this.g0(x, y, zz);
    this.g1(x, y, zTop, plunge);
  }
}
function depthLevels(depth, pass) { const n = Math.max(1, Math.ceil(depth / pass - 1e-9)); return Array.from({ length: n }, (_, i) => -depth * (i + 1) / n); }
function nearestIdx(pts, x, y) { let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; }
function cumLen(P) { const c = [0]; for (let i = 1; i < P.length; i++) c.push(c[i - 1] + hyp(P[i - 1], P[i])); return c; }
function ptAtLoop(P, c, s) { const per = c[c.length - 1]; s = ((s % per) + per) % per; let i = 1; while (i < c.length - 1 && c[i] < s) i++; const seg = (c[i] - c[i - 1]) || 1, t = (s - c[i - 1]) / seg; return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; }
function walkLoop(P, c, s0, s1) { const per = c[c.length - 1], o = []; for (let k = Math.floor(s0 / per); k <= Math.floor(s1 / per); k++) for (let i = 1; i < c.length; i++) { const s = k * per + c[i]; if (s > s0 + 1e-9 && s < s1 - 1e-9) o.push([P[i][0], P[i][1], s]); } const e = ptAtLoop(P, c, s1); o.push([e[0], e[1], s1]); return o; }
function ptAtOpen(P, c, s) { s = Math.max(0, Math.min(c[c.length - 1], s)); let i = 1; while (i < c.length - 1 && c[i] < s) i++; const seg = (c[i] - c[i - 1]) || 1, t = (s - c[i - 1]) / seg; return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; }
function walkOpen(P, c, s0, s1) { const o = []; for (let i = 0; i < c.length; i++) if (c[i] > s0 + 1e-9 && c[i] < s1 - 1e-9) o.push([P[i][0], P[i][1], c[i]]); const e = ptAtOpen(P, c, s1); o.push([e[0], e[1], s1]); return o; }

// Contour fermé à une profondeur, avec entrée plongée / rampe / arc
// entrée en hélice : descend en spirale autour d'un centre où le cercle tient dans la zone autorisée
const DIRS8 = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
function circleIn(C, r, region) { for (let k = 1; k < 24; k++) { const a = 2 * Math.PI * k / 24; if (!pipSet([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)], region)) return false; } return true; }
function helixEntry(mb, P0, z, o, region, pref) {
  if (!region) return false;
  const z0 = mb.z, drop = z0 - z; if (drop <= 1e-9) return true;
  let r = Math.max(0.1, o.helixR || o.arcR || 2); const dirs = pref ? [pref, ...DIRS8] : DIRS8;
  for (let tr = 0; tr < 7; tr++, r *= 0.7) for (const d of dirs) {
    const C = [P0[0] + d[0] * r, P0[1] + d[1] * r]; if (!circleIn(C, r, region)) continue;
    const sg = o.side >= 0 ? 1 : -1, a0 = Math.atan2(P0[1] - C[1], P0[0] - C[0]), pitch = o.helixPitch > 0 ? o.helixPitch : Math.max(0.05, 2 * Math.PI * r * Math.tan(rampAng() * Math.PI / 180)), turns = Math.max(1, Math.ceil(drop / pitch)), n = turns * 24;
    for (let i = 1; i <= n; i++) { const a = a0 + sg * 2 * Math.PI * i / 24; mb.g1e(C[0] + r * Math.cos(a), C[1] + r * Math.sin(a), z0 - drop * i / n, o.rf || o.feed); }
    for (let i = 1; i <= 24; i++) { const a = a0 + sg * 2 * Math.PI * i / 24; mb.g1(C[0] + r * Math.cos(a), C[1] + r * Math.sin(a), z, o.feed); }
    mb.g1(P0[0], P0[1], z, o.feed); return true;
  }
  return false;
}
function emitLoop(mb, loop, zTop, z, o, cont) {
  if (loop.length < 2) return;
  // après une sortie en arc, la passe suivante repart du même point d'entrée (sinon le départ glisse d'un rayon à chaque passe)
  const ref = mb.leadP0 && mb.x !== null && hyp(mb.leadP0, [mb.x, mb.y]) < (o.arcR || 0) * 2.5 + 1e-6 ? mb.leadP0 : null; mb.leadP0 = null;
  const idx = mb.x === null ? 0 : ref ? nearestIdx(loop, ref[0], ref[1]) : nearestIdx(loop, mb.x, mb.y);
  const P = loop.slice(idx).concat(loop.slice(0, idx)); P.push(P[0]);
  const c = cumLen(P), per = c[c.length - 1]; if (per < 1e-6) return;
  const zStart = cont ? mb.z : zTop;
  let entry = zStart > z + 1e-9 ? o.entry : 'none';
  if (entry === 'helix') {
    if (cont) mb.g1(P[0][0], P[0][1], mb.z, o.feed); else mb.approach(P[0][0], P[0][1], zTop, o.plunge);
    let j = 1; while (j < P.length - 1 && hyp(P[j], P[0]) < 1e-6) j++;
    const t = nrm(sub(P[j], P[0]));
    if (!helixEntry(mb, P[0], z, o, o.region, [-t[1] * o.side, t[0] * o.side])) {
      const z0 = mb.z, L = Math.min(Math.max(o.rampLen, 10), per / 2);
      for (const q of walkLoop(P, c, 0, L)) mb.g1e(q[0], q[1], z0 + (z - z0) * Math.min(q[2] / L, 1), o.rf || o.feed);
      const back = walkLoop(P, c, 0, L).map(q => [q[0], q[1]]).reverse().slice(1); back.push(P[0]);
      for (const q of back) mb.g1(q[0], q[1], z, o.feed);
    }
    for (let i = 1; i < P.length; i++) mb.g1(P[i][0], P[i][1], z, o.feed);
    return;
  }
  if (entry === 'arc' || entry === 'arcramp') {
    let j = 1; while (j < P.length - 1 && hyp(P[j], P[0]) < 1e-6) j++;
    const t = nrm(sub(P[j], P[0])), nv = [-t[1] * o.side, t[0] * o.side], r = o.arcR;
    const C = [P[0][0] + nv[0] * r, P[0][1] + nv[1] * r], A = [C[0] - t[0] * r, C[1] - t[1] * r];
    if (cont) mb.g1(A[0], A[1], mb.z, o.feed); else mb.approach(A[0], A[1], zTop, o.plunge);
    const z0 = mb.z, arc = arcPts(C, r, Math.atan2(-t[1], -t[0]), Math.atan2(-nv[1], -nv[0]));
    if (entry === 'arc') { mb.g1(A[0], A[1], z, o.plunge); for (const p of arc) mb.g1(p[0], p[1], z, o.feed); }
    else arc.forEach((p, i) => mb.g1e(p[0], p[1], z0 + (z - z0) * (i + 1) / arc.length, o.rf || o.feed));
    for (let i = 1; i < P.length; i++) mb.g1(P[i][0], P[i][1], z, o.feed);
    for (const p of arcPts(C, r, Math.atan2(-nv[1], -nv[0]), Math.atan2(t[1], t[0]))) mb.g1(p[0], p[1], z, o.feed);
    mb.leadP0 = [P[0][0], P[0][1]];
    return;
  }
  if (cont) mb.g1(P[0][0], P[0][1], mb.z, o.feed); else mb.approach(P[0][0], P[0][1], zTop, o.plunge);
  if (entry === 'rampzz' && o.rampLen > 0.01) {
    // aller en descendant sur L (bridé à la moitié du contour), retour au point de départ à pleine profondeur, puis tour complet
    const z0 = mb.z, L = Math.min(o.rampLen, per / 2);
    for (const q of walkLoop(P, c, 0, L)) mb.g1e(q[0], q[1], z0 + (z - z0) * Math.min(q[2] / L, 1), o.rf || o.feed);
    const back = walkLoop(P, c, 0, L).map(q => [q[0], q[1]]).reverse().slice(1); back.push(P[0]);
    for (const q of back) mb.g1(q[0], q[1], z, o.feed);
    for (let i = 1; i < P.length; i++) mb.g1(P[i][0], P[i][1], z, o.feed);
    return;
  }
  if (entry === 'ramp' && o.rampLen > 0.01) {
    const z0 = mb.z, L = o.rampLen;
    for (const q of walkLoop(P, c, 0, L)) mb.g1e(q[0], q[1], z0 + (z - z0) * Math.min(q[2] / L, 1), o.rf || o.feed);
    for (const q of walkLoop(P, c, L, L + per)) mb.g1(q[0], q[1], z, o.feed);
    return;
  }
  mb.g1(P[0][0], P[0][1], z, o.plunge);
  for (let i = 1; i < P.length; i++) mb.g1(P[i][0], P[i][1], z, o.feed);
}
// Ligne ouverte : aller-retour à chaque profondeur, ou toujours dans le même sens (oneWay) pour respecter avalant/opposition
function emitOpen(mb, path, levels, o, oneWay, ref) {
  let fwd = true; const useArc = oneWay && ref && (o.entry === 'arc' || o.entry === 'arcramp') && o.arcR > 0.01, ramp = !useArc && (o.entry === 'ramp' || o.entry === 'rampzz' || o.entry === 'arcramp') && o.rampLen > 0.01;
  // entrée / sortie en arc tangent, côté matière enlevée (opposé à la ligne d'origine)
  const arcEnds = P => { const R = o.arcR, n = P.length, d0 = nrm(sub(P[1], P[0])), dn = nrm(sub(P[n - 1], P[n - 2])), side = (q, d) => { let best = null, bd = Infinity; for (const r of ref) { const dd = hyp(r, q); if (dd < bd) { bd = dd; best = r; } } const c = d[0] * (best[1] - q[1]) - d[1] * (best[0] - q[0]); return c > 0 ? [d[1], -d[0]] : [-d[1], d[0]]; };
    const w0 = side(P[0], d0), wn = side(P[n - 1], dn), C0 = [P[0][0] + w0[0] * R, P[0][1] + w0[1] * R], Cn = [P[n - 1][0] + wn[0] * R, P[n - 1][1] + wn[1] * R], N = 10;
    const inA = [], outA = []; for (let k = 0; k <= N; k++) { const th = -Math.PI / 2 * (1 - k / N), c = Math.cos(th), sn = Math.sin(th); inA.push([C0[0] + R * (-c * w0[0] + sn * d0[0]), C0[1] + R * (-c * w0[1] + sn * d0[1])]); const th2 = Math.PI / 2 * k / N, c2 = Math.cos(th2), s2 = Math.sin(th2); outA.push([Cn[0] + R * (-c2 * wn[0] + s2 * dn[0]), Cn[1] + R * (-c2 * wn[1] + s2 * dn[1])]); }
    return { inA, outA }; };
  const get = i => typeof path === 'function' ? path(i) : path;
  levels.forEach((z, i) => {
    const base = get(i), P = fwd ? base : base.slice().reverse(), c = cumLen(P), len = c[c.length - 1];
    if (useArc) { const { inA, outA } = arcEnds(P), zTop = i ? levels[i - 1] : 0; if (mb.x !== null) mb.up(o.clearZ !== undefined ? o.clearZ : 2); mb.approach(inA[0][0], inA[0][1], zTop, o.plunge);
      if (o.entry === 'arcramp') inA.forEach((q, k) => mb.g1e(q[0], q[1], zTop + (z - zTop) * k / (inA.length - 1), o.rf || o.feed)); else { mb.g1(inA[0][0], inA[0][1], z, o.plunge); for (const q of inA) mb.g1(q[0], q[1], z, o.feed); }
      for (let k = 1; k < P.length; k++) mb.g1(P[k][0], P[k][1], z, o.feed); for (const q of outA) mb.g1(q[0], q[1], z, o.feed); return; }
    if (i === 0 || oneWay) mb.approach(P[0][0], P[0][1], i ? levels[i - 1] : 0, o.plunge);
    else if (Math.hypot(mb.x - P[0][0], mb.y - P[0][1]) > 1e-6) mb.g1(P[0][0], P[0][1], mb.z, o.feed);
    const z0 = mb.z;
    if (ramp) { const L = Math.min(o.rampLen, len); for (const q of walkOpen(P, c, 0, L)) mb.g1e(q[0], q[1], z0 + (z - z0) * q[2] / L, o.rf || o.feed); for (const q of walkOpen(P, c, L, len)) mb.g1(q[0], q[1], z, o.feed); }
    else { mb.g1(P[0][0], P[0][1], z, o.plunge); for (let k = 1; k < P.length; k++) mb.g1(P[k][0], P[k][1], z, o.feed); }
    if (!oneWay) fwd = !fwd;
  });
  if (ramp) { const last = get(levels.length - 1), P = (!oneWay && fwd) ? last : last.slice().reverse(); for (let k = 1; k < P.length; k++) mb.g1(P[k][0], P[k][1], levels[levels.length - 1], o.feed); }
}
// décalage d'une ligne ouverte d'un seul côté (gauche/droite dans le sens du tracé), arcs sur les angles extérieurs
function sideOffset(pts, d, side, sharp) {
  const sg = side === 'left' ? 1 : -1, P = dedupe(pts, false); if (P.length < 2 || !(d > 0)) return P;
  const segs = [];
  for (let i = 0; i < P.length - 1; i++) { const t = nrm(sub(P[i + 1], P[i])), n = [-t[1] * sg * d, t[0] * sg * d]; segs.push({ a: [P[i][0] + n[0], P[i][1] + n[1]], b: [P[i + 1][0] + n[0], P[i + 1][1] + n[1]], t, n }); }
  const out = [segs[0].a];
  for (let i = 0; i < segs.length - 1; i++) {
    const s1 = segs[i], s2 = segs[i + 1], cr = s1.t[0] * s2.t[1] - s1.t[1] * s2.t[0], dt = s1.t[0] * s2.t[0] + s1.t[1] * s2.t[1];
    if (Math.abs(cr) < 1e-9 && dt > 0) { out.push(s1.b); continue; }
    if (cr * sg < 0) { const V = P[i + 1];
      if (sharp) { const r = s1.t, q = s2.t, den = r[0] * q[1] - r[1] * q[0], u = ((s2.a[0] - s1.a[0]) * q[1] - (s2.a[1] - s1.a[1]) * q[0]) / den, M = [s1.a[0] + r[0] * u, s1.a[1] + r[1] * u]; if (Math.abs(den) > 1e-12 && hyp(M, V) <= 4 * d) { out.push(M); continue; } }
      out.push(s1.b); out.push(...arcPts(V, d, Math.atan2(s1.n[1], s1.n[0]), Math.atan2(s2.n[1], s2.n[0]))); }
    else { const r = s1.t, q = s2.t, den = r[0] * q[1] - r[1] * q[0]; if (Math.abs(den) < 1e-12) { out.push(s1.b, s2.a); continue; } const u = ((s2.a[0] - s1.a[0]) * q[1] - (s2.a[1] - s1.a[1]) * q[0]) / den; out.push([s1.a[0] + r[0] * u, s1.a[1] + r[1] * u]); }
  }
  out.push(segs[segs.length - 1].b);
  // supprime les boucles (croisements) puis les points qui entailleraient la ligne d'origine
  let Q = dedupe(out, false);
  for (let guard = 0; guard < 200; guard++) {
    let hit = null;
    for (let i = 0; i < Q.length - 1 && !hit; i++) for (let j = Q.length - 2; j > i + 1; j--) { const a = Q[i], b = Q[i + 1], c = Q[j], e = Q[j + 1], rx = b[0] - a[0], ry = b[1] - a[1], qx = e[0] - c[0], qy = e[1] - c[1], den = rx * qy - ry * qx; if (Math.abs(den) < 1e-12) continue; const t = ((c[0] - a[0]) * qy - (c[1] - a[1]) * qx) / den, u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den; if (t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9) { hit = [i, j, [a[0] + rx * t, a[1] + ry * t]]; break; } }
    if (!hit) break; Q = Q.slice(0, hit[0] + 1).concat([hit[2]], Q.slice(hit[1] + 1));
  }
  const near = q => { let b = Infinity; for (let i = 0; i < P.length - 1; i++) b = Math.min(b, segDist(q, P[i], P[i + 1])); return b; };
  const res = Q.filter((q, k) => k === 0 || k === Q.length - 1 || near(q) > d - Math.max(1e-3, d * 0.002));
  res.gouge = res.some(q => near(q) < d - Math.max(0.01, d * 0.01));
  return res;
}
function orderNN(items, ptOf, start) { const rem = items.slice(), out = []; let cur = start || [0, 0]; while (rem.length) { let bi = 0, bd = Infinity; rem.forEach((it, i) => { const d = hyp(ptOf(it, cur), cur); if (d < bd) { bd = d; bi = i; } }); const it = rem.splice(bi, 1)[0]; out.push(it); cur = ptOf(it, cur); } return out; }
const nearestPt = (loop, cur) => loop[nearestIdx(loop, cur[0], cur[1])];
function linkOK(a, b, region, maxLen) { if (hyp(a, b) > maxLen) return false; for (let i = 1; i < 16; i++) { const t = i / 16; if (!pipSet([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], region)) return false; } return true; }

// longueur de rampe : celle saisie, sinon (champ vide) calculée pour descendre la passe sous l'angle conseillé pour le matériau des outils :
// 10° bois tendre, MDF et plastiques ; 5° bois dur ; 4° aluminium et laiton ; jamais moins de 1,5 × Ø
const RAMP_ANG = { hardwood: 5, alu: 4, brass: 4 }, rampAng = () => RAMP_ANG[projMat()] || 10;
const rampAuto = (pass, tool) => { const D = +tool.dia || 0, ps = +pass > 0 ? +pass : (+tool.pass || D / 2); return +Math.max(1.5 * D, ps / Math.tan(rampAng() * Math.PI / 180)).toFixed(1); };
// hélice : alésage de 1,5 × Ø par défaut (centre de l'outil sur un cercle de 0,25 × Ø) ; anciens parcours : le rayon de l'arc
const helixROf = (p, tool) => { const D = +tool.dia || 0; return p.helixD === undefined ? Math.max(+p.arcR || 0, 0.1) : p.helixD === '' || p.helixD == null ? 0.25 * D : Math.max(0.05 * D, 0.1, (+p.helixD - D) / 2); };
// descente par tour : saisie, sinon celle qui suit l'angle de rampe du matériau sur le cercle de rayon r
const helixPitchOf = (p, r) => p.helixPitch === '' || p.helixPitch == null ? Math.max(0.05, 2 * Math.PI * r * Math.tan(rampAng() * Math.PI / 180)) : Math.max(0.1, +p.helixPitch || 1);
const rampLenOf = (p, tool) => p.rampLen === '' || p.rampLen == null ? rampAuto(p.pass, tool) : +p.rampLen || 0;
function commonOpts(p, tool) { const climb = p.dir !== 'conv'; return { climb, feed: tool.feed, plunge: tool.plunge, entry: tool.noCenter && (p.entry || 'plunge') === 'plunge' ? 'rampzz' : p.entry, rf: Math.max(1, Math.round((+tool.feed || 0) * 0.6)), rampLen: rampLenOf(p, tool), arcR: Math.max(+p.arcR || 0, 0.1), helixR: helixROf(p, tool), helixPitch: p.helixPitch === '' || p.helixPitch == null ? 0 : Math.max(0.1, +p.helixPitch || 1), side: climb ? 1 : -1 }; }

