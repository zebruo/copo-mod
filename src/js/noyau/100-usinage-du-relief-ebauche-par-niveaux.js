// ---------- USINAGE DU RELIEF (ébauche par niveaux, finition en balayage) ----------
// surface compensée : pour chaque nœud, Z le plus bas de la pointe sans entamer le relief (max sur l'empreinte de l'outil)
function buildRelief(p, tool, shapes, M) {
  if (!S.relief.items.some(i => i.visible && relGrid[i.id])) throw new Error(tr('Aucun relief : importez une image en niveaux de gris ou un STL dans l’onglet Relief.'));
  if (!tool) throw new Error("L'outil de ce parcours n'existe plus.");
  const fin = p.rlOp === 'finish', st = S.stock, D = tool.dia, step = Math.max(0.02, D * (+p.rlStep || (fin ? 10 : 40)) / 100);
  let c = Math.max(0.05, Math.min(0.3, D / 16, step / 2)); while ((st.w / c + 1) * (st.h / c + 1) > 7e6) c *= 1.25;
  const sel = Array.isArray(p.rlItems) ? p.rlItems.filter(id => S.relief.items.some(i => i.id === id && i.visible)) : null; if (sel && !sel.length) throw new Error(tr('Cochez au moins un relief à usiner.'));
  const R = reliefCompose(c, true, sel), { nx, ny, cx, cy } = R, H = R.H;
  const K = toolKernel(tool, cx, cy), memo = new Float32Array(nx * ny).fill(NaN), floor = -st.t, warns = [];
  if (-R.min > st.t + 1e-6) warns.push(trf('Le relief ({d} mm) est plus épais que le brut ({t} mm) : le bas sera coupé. Augmentez l’épaisseur du brut.', { d: fr(-R.min, 1), t: fr(st.t, 1) }));
  const hc = (i, j) => { const q = j * nx + i; let v = memo[q]; if (v === v) return v; v = -Infinity; const { di, dj, dz, n } = K; for (let k = 0; k < n; k++) { const a = i + di[k], b = j + dj[k]; if (a < 0 || b < 0 || a >= nx || b >= ny) continue; const h = H[b * nx + a] - dz[k]; if (h > v) v = h; } if (v === -Infinity) v = floor; memo[q] = v; return v; };
  const zAt = (x, y) => { const X = Math.max(0, Math.min(nx - 1.000001, x / cx)), Y = Math.max(0, Math.min(ny - 1.000001, y / cy)), i = Math.floor(X), j = Math.floor(Y), a = X - i, b = Y - j; return (hc(i, j) * (1 - a) + hc(i + 1, j) * a) * (1 - b) + (hc(i, j + 1) * (1 - a) + hc(i + 1, j + 1) * a) * b; };
  // limite d'usinage : masque sur la grille (contour du modèle, du brut ou tracés sélectionnés), puis décalage
  const bound = p.rlBound || (shapes.some(sh => sh.closed) ? 'sel' : 'model'), N = nx * ny; let Bm = new Uint8Array(N);
  if (bound === 'stock') Bm.fill(1);
  else if (bound === 'sel') { const loops = shapes.filter(sh => sh.closed && sh.pts.length > 2).map(sh => sh.pts); if (!loops.length) throw new Error(tr('Limite « Vecteurs sélectionnés » : sélectionnez des formes fermées.'));
    for (let j = 0; j < ny; j++) { const y = j * cy, xs = []; for (const a of loops) for (let k = 0; k < a.length; k++) { const A = a[k], B = a[(k + 1) % a.length]; if ((A[1] <= y) !== (B[1] <= y)) xs.push(A[0] + (y - A[1]) * (B[0] - A[0]) / (B[1] - A[1])); } xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.max(0, Math.ceil(xs[k] / cx)), i1 = Math.min(nx - 1, Math.floor(xs[k + 1] / cx)); for (let i = i0; i <= i1; i++) Bm[j * nx + i] = 1; } } }
  else Bm = R.M;
  const off = (+p.rlOff || 0) - (p.rlEdge === 'inside' ? D / 2 : 0); // bord de l'outil dans la limite : on rentre d'un rayon
  if (Math.abs(off) > 1e-6) { const f = new Float64Array(N); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = j * nx + i, edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1; f[q] = (off > 0 ? Bm[q] : (!Bm[q] || edge)) ? 0 : Infinity; } relEDT(f, nx, ny); const r = Math.abs(off) / cx, B2 = new Uint8Array(N); for (let i = 0; i < N; i++) B2[i] = off > 0 ? (Bm[i] || f[i] <= r ? 1 : 0) : (Bm[i] && f[i] > r ? 1 : 0); Bm = B2; }
  const spans = (A, B) => { // intervalles [t0,t1] de la ligne A->B à l'intérieur de la limite
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(1, Math.ceil(L / c)), out = []; let t0 = null;
    for (let k = 0; k <= n; k++) { const t = L * k / n, x = A[0] + (B[0] - A[0]) * t / L, y = A[1] + (B[1] - A[1]) * t / L, i = Math.round(x / cx), j = Math.round(y / cy), on = i >= 0 && j >= 0 && i < nx && j < ny && Bm[j * nx + i] === 1; if (on && t0 === null) t0 = t; if ((!on || k === n) && t0 !== null) { out.push([t0, on ? t : Math.max(t0, t - L / n)]); t0 = null; } }
    return out.filter(iv => iv[1] - iv[0] > 1e-6);
  };
  // lignes de balayage à l'angle donné, couvrant le brut
  const lines = ang => { const a = ang * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]], cs = [[0, 0], [st.w, 0], [st.w, st.h], [0, st.h]], pu = cs.map(q => q[0] * u[0] + q[1] * u[1]), pv = cs.map(q => q[0] * v[0] + q[1] * v[1]), u0 = Math.min(...pu) - 1, u1 = Math.max(...pu) + 1, v0 = Math.min(...pv), v1 = Math.max(...pv), L = [];
    for (let w = v0 + step / 2; w < v1; w += step) { const A = [u[0] * u0 + v[0] * w, u[1] * u0 + v[1] * w], B = [u[0] * u1 + v[0] * w, u[1] * u1 + v[1] * w], sp = spans(A, B); if (sp.length) L.push({ A, B, u, sp }); } return L; };
  // échantillonnage d'un intervalle (pas c) -> points [x, y, zSurface]
  const sample = (ln, t0, t1) => { const n = Math.max(1, Math.ceil(Math.abs(t1 - t0) / c)), P = []; for (let k = 0; k <= n; k++) { const t = t0 + (t1 - t0) * k / n, x = ln.A[0] + ln.u[0] * t, y = ln.A[1] + ln.u[1] * t; P.push([x, y, Math.max(floor, Math.min(0, zAt(x, y)))]); } return P; };
  // simplification (Douglas-Peucker en 3D, tolérance 0,005 mm)
  const simp = P => { if (P.length < 3) return P; const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; const st2 = [[0, P.length - 1]]; while (st2.length) { const [a, b] = st2.pop(); let md = 0, mi = -1; const A = P[a], B = P[b], d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1e-12; for (let i = a + 1; i < b; i++) { const q = P[i], t = Math.max(0, Math.min(1, ((q[0] - A[0]) * d[0] + (q[1] - A[1]) * d[1] + (q[2] - A[2]) * d[2]) / dd)), e = Math.hypot(q[0] - A[0] - d[0] * t, q[1] - A[1] - d[1] * t, q[2] - A[2] - d[2] * t); if (e > md) { md = e; mi = i; } } if (md > 0.005) { keep[mi] = 1; st2.push([a, mi], [mi, b]); } } return P.filter((q, i) => keep[i]); };
  const mb = new MB(M), feed = tool.feed, plunge = tool.plunge; let nl = 0, nlev = 0, nlift = 0;
  // liaison entre deux passes : si le trajet direct reste dans la limite et n'est pas trop long, on suit la surface (zf) ; sinon on remonte
  const inB = (x, y) => { const i = Math.round(x / cx), j = Math.round(y / cy); return i >= 0 && j >= 0 && i < nx && j < ny && Bm[j * nx + i] === 1; };
  const Lmax = Math.max(4 * D, 12 * step, 8);
  const rlEnt0 = p.rlOp !== 'finish' ? (p.rlEntry || 'plunge') : 'plunge', rlEnt = rlEnt0 === 'plunge' && tool.noCenter && p.rlOp !== 'finish' ? 'rampzz' : rlEnt0, rampL = rlEnt === 'rampzz' || rlEnt === 'helix' ? rampLenOf(p, tool) : 0;
  // entrée en hélice : alésage de 1,5 × Ø (centre de l'outil sur un cercle de 0,25 × Ø) près du début de la passe ; l'outil ne descend jamais sous
  // la profondeur permise (surface du relief + surépaisseur, forme de l'outil comprise) ; hors de la limite d'usinage, rampe à la place
  const hxR = p.helixD === undefined ? 0.25 * D : helixROf(p, tool), hxP = helixPitchOf(p, hxR), hxCW = p.rlDir === 'conv', rfE = Math.max(1, Math.round(feed * 0.6));
  const helixIn = (path, z0, zf) => { const N = 36, pt = (c, k) => { const a = (hxCW ? -1 : 1) * 2 * Math.PI * k / N; return [c[0] + hxR * Math.cos(a), c[1] + hxR * Math.sin(a)]; };
    // centre : le premier point de la passe où tout le cercle reste dans la limite et descend jusqu'au niveau de la passe
    let jc = -1, sd = 0; for (let j = 0; j < path.length && sd <= 6 * D; j++) { if (j) sd += Math.hypot(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]); const c = path[j]; let ok = true; for (let k = 0; k < N && ok; k++) { const q = pt(c, k); ok = inB(q[0], q[1]) && zf(q[0], q[1]) <= c[2] + 0.01; } if (ok) { jc = j; break; } }
    if (jc < 0) return false; const to = path[jc], zE = to[2], drop = z0 - zE, K = Math.max(N, Math.ceil(drop / hxP * N)), s0 = pt(to, 0); mb.approach(s0[0], s0[1], z0, plunge);
    for (let k = 1; k <= K + N; k++) { const q = pt(to, k), zl = k >= K ? zE : z0 - drop * k / K; if (k <= K) mb.g1e(q[0], q[1], Math.max(zl, zf(q[0], q[1])), rfE); else mb.g1(q[0], q[1], Math.max(zl, zf(q[0], q[1])), feed); } // descente puis un tour à plat
    mb.g1(to[0], to[1], zE, feed); for (let k = jc - 1; k >= 0; k--) mb.g1(path[k][0], path[k][1], path[k][2], feed); return true; }; // retour au début de la passe, à sa profondeur
  // entrée en rampe aller-retour : l'outil descend en suivant le début de la passe, puis revient à son départ à pleine profondeur
  const rampIn = (path, z0) => { const fw = [[path[0][0], path[0][1], 0, path[0][2]]]; let s0 = 0;
    for (let i = 1; i < path.length && s0 < rampL; i++) { const a = path[i - 1], b = path[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (s0 + d >= rampL) { const u = (rampL - s0) / (d || 1); fw.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, rampL, a[2] + (b[2] - a[2]) * u]); s0 = rampL; break; } s0 += d; fw.push([b[0], b[1], s0, b[2]]); }
    if (s0 < Math.max(0.5, D * 0.25)) return false; const zE = path[0][2]; mb.approach(path[0][0], path[0][1], z0, plunge);
    for (let k = 1; k < fw.length; k++) mb.g1e(fw[k][0], fw[k][1], Math.max(fw[k][3], z0 + (zE - z0) * fw[k][2] / s0), rfE);
    for (let k = fw.length - 2; k >= 0; k--) mb.g1(fw[k][0], fw[k][1], fw[k][3], feed); return true; };
  const link = (from, to, zf, zStart, path) => { const L = from ? Math.hypot(to[0] - from[0], to[1] - from[1]) : Infinity;
    if (from && L <= Lmax) { const n = Math.max(1, Math.ceil(L / c)), tol = Math.max(2, Math.ceil(step / c)); let outN = 0; for (let i = 1; i < n && outN <= tol; i++) if (!inB(from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n)) outN++; const ok = outN <= tol; // quelques points hors limite tolérés (bord en biais)
      if (ok) { for (let i = 1; i <= n; i++) { const x = from[0] + (to[0] - from[0]) * i / n, y = from[1] + (to[1] - from[1]) * i / n; mb.g1(x, y, i === n ? to[2] : zf(x, y), feed); } return; } }
    if (from) { mb.up(M.clearZ); nlift++; } if (rampL > 0 && zStart !== undefined && zStart > to[2] + 1e-6 && path && path.length > 1 && ((rlEnt === 'helix' && helixIn(path, zStart, zf)) || rampIn(path, zStart))) return; mb.approach(to[0], to[1], zStart ?? to[2], plunge); if (zStart !== undefined && zStart !== to[2]) mb.g1(to[0], to[1], to[2], plunge); };
  const zSurf = (x, y) => Math.max(floor, Math.min(0, zAt(x, y)));
  // ordre des tronçons de balayage : chaînes en zigzag qui restent dans une même zone (comme Aspire), au lieu de traverser toute la ligne
  const chainOrder = L => { const used = L.map(ln => ln.sp.map(() => false)), out = [];
    for (let k0 = 0; k0 < L.length; k0++) for (let j0 = 0; j0 < L[k0].sp.length; j0++) { if (used[k0][j0]) continue; let k = k0, j = j0, fwd = true;
      while (true) { used[k][j] = true; const [a, b] = L[k].sp[j]; out.push(fwd ? [L[k], a, b] : [L[k], b, a]); if (k + 1 >= L.length) break; let bj = -1, bo = 0;
        L[k + 1].sp.forEach(([c0, c1], jj) => { if (used[k + 1][jj]) return; const o = Math.min(b, c1) - Math.max(a, c0); if (o > bo) { bo = o; bj = jj; } }); if (bj < 0) break; k++; j = bj; fwd = !fwd; } }
    return out; };
  if (fin && p.rlFStrat === 'offset') {
    // courbes de niveau de la distance au bord de la limite (pas = pas latéral), suivies sur la surface
    const f = new Float64Array(N); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = j * nx + i; f[q] = Bm[q] && i > 0 && j > 0 && i < nx - 1 && j < ny - 1 ? Infinity : 0; } relEDT(f, nx, ny); let dmax = 0; for (let i = 0; i < N; i++) if (f[i] !== Infinity && f[i] > dmax) dmax = f[i];
    const lv = []; for (let v = 0.5; v < dmax; v += step / cx) lv.push(v);
    const v0 = 0.5, dv = step / cx, buckets = lv.map(() => []); // segments par niveau, en une passe sur la grille
    const Pt = (e, v) => { const [t, i, j] = e; const a = f[j * nx + i], b = t === 'h' ? f[j * nx + i + 1] : f[(j + 1) * nx + i], u = (v - a) / ((b - a) || 1e-9); return t === 'h' ? [(i + u) * cx, j * cy] : [i * cx, (j + u) * cy]; };
    for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
      const a = f[j * nx + i], b = f[j * nx + i + 1], c2 = f[(j + 1) * nx + i + 1], d = f[(j + 1) * nx + i], lo = Math.min(a, b, c2, d), hi = Math.max(a, b, c2, d); if (hi < v0) continue;
      for (let k = Math.max(0, Math.ceil((lo - v0) / dv)); k < lv.length && v0 + k * dv <= hi; k++) { const v = lv[k], cs = (a > v ? 1 : 0) | (b > v ? 2 : 0) | (c2 > v ? 4 : 0) | (d > v ? 8 : 0); if (cs === 0 || cs === 15) continue;
        const ctr = (a + b + c2 + d) / 4 > v, tab = { 1: ['LB'], 2: ['BR'], 3: ['LR'], 4: ['RT'], 5: ctr ? ['LT', 'BR'] : ['LB', 'RT'], 6: ['BT'], 7: ['LT'], 8: ['TL'], 9: ['BT'], 10: ctr ? ['BL', 'TR'] : ['BR', 'TL'], 11: ['RT'], 12: ['LR'], 13: ['BR'], 14: ['LB'] }[cs];
        for (const pr of tab) { const E = c => c === 'B' ? ['h', i, j] : c === 'R' ? ['v', i + 1, j] : c === 'T' ? ['h', i, j + 1] : ['v', i, j]; buckets[k].push([E(pr[0]), E(pr[1])]); } }
    }
    const iso = k => { const v = lv[k], segs = buckets[k].map(([e1, e2]) => [e1.join(','), e2.join(','), e1, e2]), key = new Map();
      segs.forEach((sg, id) => { for (const kk of [sg[0], sg[1]]) { if (!key.has(kk)) key.set(kk, []); key.get(kk).push(id); } });
      const used = new Uint8Array(segs.length), out = [];
      for (let s0 = 0; s0 < segs.length; s0++) { if (used[s0]) continue; used[s0] = 1; const ch = [segs[s0][2], segs[s0][3]], ks = [segs[s0][0], segs[s0][1]];
        for (const dir of [1, 0]) { let kk = dir ? ks[1] : ks[0]; while (true) { const nxt = (key.get(kk) || []).find(id => !used[id]); if (nxt === undefined) break; used[nxt] = 1; const sg = segs[nxt], fwd = sg[0] === kk; const e = fwd ? sg[3] : sg[2]; kk = fwd ? sg[1] : sg[0]; if (dir) ch.push(e); else ch.unshift(e); } }
        out.push(ch.map(e => Pt(e, v))); }
      return out; };
    let last = null;
    for (let k = 0; k < lv.length; k++) { const loops = iso(k);
      for (let pl of loops) { if (pl.length < 2) continue; const closed = Math.hypot(pl[0][0] - pl[pl.length - 1][0], pl[0][1] - pl[pl.length - 1][1]) < cx * 1.5; let ar = 0; for (let k = 0; k + 1 < pl.length; k++) ar += pl[k][0] * pl[k + 1][1] - pl[k + 1][0] * pl[k][1];
        if (closed && ((p.rlDir !== 'conv') === (ar > 0))) pl = pl.reverse(); // avalant : sens horaire
        if (closed && last) { let bi = 0, bd = Infinity; for (let k = 0; k < pl.length; k++) { const d = Math.hypot(pl[k][0] - last[0], pl[k][1] - last[1]); if (d < bd) { bd = d; bi = k; } } pl = [...pl.slice(bi), ...pl.slice(1, bi + 1)]; }
        const Pz = simp(pl.map(q => [q[0], q[1], Math.max(floor, Math.min(0, zAt(q[0], q[1])))])); nl++;
        link(last, Pz[0], zSurf); for (let k = 1; k < Pz.length; k++) mb.g1(Pz[k][0], Pz[k][1], Pz[k][2], feed); last = Pz[Pz.length - 1]; }
    }
  } else if (fin) {
    for (const ang of p.rlCross ? [+p.rlAng || 0, (+p.rlAng || 0) + 90] : [+p.rlAng || 0]) {
      const L = lines(ang); let last = null;
      for (const [ln, t0, t1] of chainOrder(L)) { const P = simp(sample(ln, t0, t1)); nl++; link(last, P[0], zSurf); for (let i = 1; i < P.length; i++) mb.g1(P[i][0], P[i][1], P[i][2], feed); last = P[P.length - 1]; }
      if (p.rlCross) { mb.up(M.clearZ); last = null; }
    }
  } else {
    const allow = Math.max(0, +p.rlAllow || 0), pass = Math.max(0.05, +p.pass > 0 ? +p.pass : (+tool.pass || D / 2)), L = lines(+p.rlAng || 0);
    const rows = [chainOrder(L).map(([ln, t0, t1]) => sample(ln, t0, t1).map(q => [q[0], q[1], Math.min(0, q[2] + allow)]))];
    let zmin = 0; for (const r of rows) for (const P of r) for (const q of P) if (q[2] < zmin) zmin = q[2];
    for (let z = -pass; z > zmin - pass + 1e-6; z -= pass) {
      const zk = Math.max(z, zmin), zPrev = zk + pass; nlev++;
      if (p.rlRStrat === 'raster') { // balayage 3D : chaque ligne suit la surface (plus surépaisseur) sans descendre sous le niveau
        const zr = (x, y) => Math.max(zk, Math.min(0, zAt(x, y) + allow)); let last = null;
        for (const r of rows) for (const P of r) { if (!P.some(q => q[2] < zk - 1e-6)) continue; nl++; const f0 = [P[0][0], P[0][1], Math.max(zk, P[0][2])]; link(last, f0, zr, Math.min(0, zPrev), rampL > 0 ? P.map(q => [q[0], q[1], Math.max(zk, q[2])]) : null); for (let i = 1; i < P.length; i++) mb.g1(P[i][0], P[i][1], Math.max(zk, P[i][2]), feed); last = [P[P.length - 1][0], P[P.length - 1][1], Math.max(zk, P[P.length - 1][2])]; }
        mb.up(M.clearZ);
        if (zk <= zmin) break; continue;
      }
      const zrz = (x, y) => Math.max(zk, Math.min(0, zAt(x, y) + allow)); let lastR = null;
      for (const r of rows) for (const P of r) {
        // tronçons où la surface (plus surépaisseur) est sous le niveau ; on suit la surface sur les petits écarts
        let run = null; const flush = () => { if (!run || run.length < 2) { run = null; return; } nl++; link(lastR, run[0], zrz, Math.min(0, zPrev), run); for (let i = 1; i < run.length; i++) mb.g1(run[i][0], run[i][1], run[i][2], feed); lastR = run[run.length - 1]; run = null; };
        let gap = 0, pend = [];
        for (const q of P) { const z2 = Math.max(zk, q[2]); if (q[2] < zk - 1e-6) { if (run && pend.length) run.push(...pend); pend = []; gap = 0; (run = run || []).push([q[0], q[1], z2]); } else if (run) { pend.push([q[0], q[1], z2]); gap += c; if (gap > D) { flush(); pend = []; gap = 0; } } }
        flush();
      }
      if (zk <= zmin) break;
    }
  }
  mb.up(M.safeZ);
  if (!mb.m.length) throw new Error(tr('Rien à usiner dans la limite choisie.'));
  if (-R.min > st.t + 1e-6) warns.push(tr('Le relief dépasse l’épaisseur du brut : il est coupé au fond. Augmentez l’épaisseur du brut ou réduisez la hauteur du relief.'));
  if (R.max > 1e-6) warns.push(tr('Une partie du relief dépasse le dessus du brut : elle n’est pas usinée. Abaissez le relief ou augmentez l’épaisseur du brut.'));
  if (fin && tool.type === 'flat') warns.push(tr('Finition avec une fraise droite : la surface sortira en marches. Préférez une fraise hémisphérique ou conique à bout sphérique.'));
  return { moves: mb.m, warns, info: (fin ? tr('finition') + ' · ' + (p.rlFStrat === 'offset' ? nl + ' ' + tr('contours décalés') : nl + ' ' + tr('lignes') + (p.rlCross ? ' ' + tr('croisées') : '')) : tr('ébauche') + ' · ' + (p.rlRStrat === 'raster' ? tr('balayage 3D') + ' · ' : '') + nlev + ' ' + tr('niveaux')) + ' · ' + tr('pas latéral') + ' ' + fr(step, 2) + ' mm' };
}

