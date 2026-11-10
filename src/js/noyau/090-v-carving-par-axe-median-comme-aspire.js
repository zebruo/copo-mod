// ---------- V-CARVING par axe médian (comme Aspire) ----------
function sharpCorners(loops) {
  const out = [];
  for (const l of loops) { const n = l.length; for (let i = 0; i < n; i++) { const P = l[(i - 1 + n) % n], V = l[i], N = l[(i + 1) % n]; const a = sub(V, P), b = sub(N, V); if (a[0] * b[1] - a[1] * b[0] > 1e-9 && cornerTh(l, true, i) < Math.PI * 0.94) out.push({ p: V, th: cornerTh(l, true, i) }); } }
  return out;
}
function medialAxis(loops, h, Delaunay) {
  const P = [], L = [], Sx = [], per = [];
  loops.forEach((l, li) => {
    const n = l.length; let s = 0, tot = 0; for (let i = 0; i < n; i++) tot += hyp(l[i], l[(i + 1) % n]); per[li] = tot;
    for (let i = 0; i < n; i++) { const a = l[i], b = l[(i + 1) % n], len = hyp(a, b), k = Math.max(1, Math.ceil(len / h)); for (let j = 0; j < k; j++) { const t = j / k; P.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); L.push(li); Sx.push(s + len * t); } s += len; }
  });
  const N = L.length; if (N < 3) return [];
  const D = new Delaunay(Float64Array.from(P)), T = D.triangles, HE = D.halfedges, nt = T.length / 3;
  const cx = new Float64Array(nt), cy = new Float64Array(nt), rr = new Float64Array(nt), ok = new Uint8Array(nt), inside = pipIndex(loops);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity; for (let i = 0; i < N; i++) { bx0 = Math.min(bx0, P[2 * i]); bx1 = Math.max(bx1, P[2 * i]); by0 = Math.min(by0, P[2 * i + 1]); by1 = Math.max(by1, P[2 * i + 1]); }
  for (let t = 0; t < nt; t++) {
    const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2]; const ax = P[2 * a], ay = P[2 * a + 1];
    const bxr = P[2 * b] - ax, byr = P[2 * b + 1] - ay, cxr = P[2 * c] - ax, cyr = P[2 * c + 1] - ay;
    const d = 2 * (bxr * cyr - byr * cxr); if (Math.abs(d) < 1e-12) continue;
    const b2 = bxr * bxr + byr * byr, c2 = cxr * cxr + cyr * cyr; const ux = (cyr * b2 - byr * c2) / d, uy = (bxr * c2 - cxr * b2) / d;
    const X = ax + ux, Y = ay + uy; if (X < bx0 || X > bx1 || Y < by0 || Y > by1) continue;
    if (!inside(X, Y)) continue;
    cx[t] = X; cy[t] = Y; rr[t] = Math.hypot(ux, uy); ok[t] = 1;
  }
  const adj = new Map(), link = (u, v) => { if (!adj.has(u)) adj.set(u, []); adj.get(u).push(v); };
  for (let e = 0; e < HE.length; e++) {
    const o = HE[e]; if (o < e) continue; const t1 = (e / 3) | 0, t2 = (o / 3) | 0; if (!ok[t1] || !ok[t2] || t1 === t2) continue;
    const i = T[e], j = T[e % 3 === 2 ? e - 2 : e + 1];
    let arc = Infinity; if (L[i] === L[j]) { const ds = Math.abs(Sx[i] - Sx[j]); arc = Math.min(ds, per[L[i]] - ds); }
    const chord = Math.hypot(P[2 * i] - P[2 * j], P[2 * i + 1] - P[2 * j + 1]);
    if (arc <= chord * 1.02 + 1e-9) continue;
    link(t1, t2); link(t2, t1);
  }
  // chaînage du graphe en polylignes
  const seen = new Set(), key = (u, v) => u < v ? u + ',' + v : v + ',' + u, deg = u => adj.get(u).length, chains = [];
  const walk = (start, nb) => { const path = [start]; let prev = start, cur = nb; seen.add(key(start, nb)); while (deg(cur) === 2 && cur !== start) { path.push(cur); const nx = adj.get(cur).find(v => v !== prev && !seen.has(key(cur, v))); if (nx === undefined) { cur = null; break; } seen.add(key(cur, nx)); prev = cur; cur = nx; } if (cur !== null) path.push(cur); return path; };
  for (const [u, ns] of adj) if (ns.length !== 2) for (const v of ns) if (!seen.has(key(u, v))) chains.push(walk(u, v));
  for (const [u, ns] of adj) for (const v of ns) if (!seen.has(key(u, v))) chains.push(walk(u, v));
  let out = chains.map(c => ({ pts: c.map(t => [cx[t], cy[t], rr[t]]), d0: deg(c[0]), d1: deg(c[c.length - 1]) }));
  // prolonge les branches jusqu'à la pointe exacte des coins vifs
  for (const k of sharpCorners(loops)) {
    let best = null, bd = Infinity;
    for (const ch of out) for (const end of [0, 1]) { if ((end ? ch.d1 : ch.d0) !== 1) continue; const q = end ? ch.pts[ch.pts.length - 1] : ch.pts[0]; const lim = q[2] / Math.sin(k.th / 2) * 1.6 + 3 * h; const dd = hyp(q, k.p); if (dd < lim && dd < bd) { bd = dd; best = [ch, end]; } }
    if (best) { const [ch, end] = best; if (end) { ch.pts.push([k.p[0], k.p[1], 0]); ch.d1 = 0; } else { ch.pts.unshift([k.p[0], k.p[1], 0]); ch.d0 = 0; } }
  }
  return out.filter(c => c.pts.length > 1).map(c => c.pts);
}
function rdp3(pts, tol) {
  if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  const d3s = (p, a, b) => { const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const L = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]; let t = L ? (w[0] * v[0] + w[1] * v[1] + w[2] * v[2]) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(w[0] - t * v[0], w[1] - t * v[1], w[2] - t * v[2]); };
  while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; for (let i = a + 1; i < b; i++) { const d = d3s(pts[i], pts[a], pts[b]); if (d > md) { md = d; mi = i; } } if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
function vcSplit(c, prev, lvl) { // garde les parties plus profondes que le palier précédent, limitées au palier courant
  const cl = q => [q[0], q[1], Math.max(q[2], -lvl)];
  { const o = [c[0]]; for (let i = 1; i < c.length; i++) { const a = c[i - 1], q = c[i]; if ((a[2] < -lvl) !== (q[2] < -lvl)) { const t = (-lvl - a[2]) / (q[2] - a[2]); o.push([a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t, -lvl]); } o.push(q); } c = o; } // sommet ajouté là où le trait passe sous le palier
  if (!(prev > 0)) return [c.map(cl)];
  const deep = q => -q[2] > prev + 1e-9, out = []; let cur = null;
  for (let i = 0; i < c.length; i++) {
    const q = c[i];
    if (i) { const a = c[i - 1]; if (deep(a) !== deep(q)) { const t = (-prev - a[2]) / (q[2] - a[2]), x = [a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t, -prev]; if (cur) { cur.push(cl(x)); if (cur.length > 1) out.push(cur); cur = null; } else cur = [cl(x)]; } }
    if (deep(q)) { if (!cur) cur = []; cur.push(cl(q)); }
  }
  if (cur && cur.length > 1) out.push(cur); return out;
}
const fstepC = th => Math.max(0.1, 0.2 * th);
// géométrie d'une fraise conique (outil du projet : type 'v', avec flat = Ø du plat, tipR = rayon du bout) :
// r(h) = rayon de coupe à la hauteur h au-dessus de la pointe, h(r) = son inverse, rho = rayon minimal atteignable en surface
function coneGeom(tool) {
  const R0 = (+tool.dia || 0) / 2, a = (+tool.angle || 90) * Math.PI / 360, th = Math.tan(a), Rb = Math.min(R0, Math.max(0, +tool.tipR || 0)), p = Math.min(R0, Math.max(0, +tool.flat || 0) / 2);
  if (Rb > 0) { const hj = Rb * (1 - Math.sin(a)), rj = Rb * Math.cos(a); return { kind: 'ball', th, R0, rho: rj, Rb, r: h => Math.min(R0, h <= 0 ? 0 : h <= hj ? Math.sqrt(Math.max(0, Rb * Rb - (Rb - h) ** 2)) : rj + (h - hj) * th), h: r => r <= rj ? Rb - Math.sqrt(Math.max(0, Rb * Rb - r * r)) : hj + (r - rj) / th }; }
  if (p > 0) return { kind: 'flat', th, R0, rho: p, r: h => Math.min(R0, p + Math.max(0, h) * th), h: r => r <= p ? 0 : (r - p) / th };
  return { kind: 'v', th, R0, rho: 0, r: h => Math.min(R0, Math.max(0, h) * th), h: r => r / th };
}
// largeur du bout pour vider un fond plat (bout rond : largeur à la hauteur de crête admise)
function coneFlatStep(g) { if (g.kind === 'ball') { const c = Math.min(0.05, g.Rb * 0.2); return Math.max(0.02, 2 * g.r(c) * 0.8); } return Math.max(0.02, 2 * g.rho * 0.8); }
// garde les tronçons d'axe médian où la fraise entre (rayon inscrit >= rho)
function vcRhoSplit(c, rho) { if (!(rho > 0)) return [c]; const out = []; let cur = null, ok = q => q[2] >= rho - 1e-9;
  for (let i = 0; i < c.length; i++) { const q = c[i]; if (i) { const a = c[i - 1]; if (ok(a) !== ok(q)) { const t = (rho - a[2]) / ((q[2] - a[2]) || 1e-12), x = [a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t, rho]; if (cur) { cur.push(x); if (cur.length > 1) out.push(cur); cur = null; } else cur = [x]; } } if (ok(q)) { if (!cur) cur = []; cur.push(q); } }
  if (cur && cur.length > 1) out.push(cur); return out; }
function cInterEO(a, b) { const c = new ClipperLib.Clipper(); c.AddPaths(a.map(toCP), ClipperLib.PolyType.ptSubject, true); c.AddPaths(b.map(toCP), ClipperLib.PolyType.ptClip, true); const r = []; c.Execute(ClipperLib.ClipType.ctIntersection, r, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd); return loopsOf(r); }
// reste laissé par la fraise de dégagement de rayon rc dans la zone Z (coins et passages trop étroits pour elle), élargi de ov vers la zone déjà vidée
function clrLeft(Z, rc, ov, keep) { const U = cDiffEO(Z, offLoops(offLoops(Z, -rc), rc)).filter(l => Math.abs(area(l)) > 1e-4); if (!U.length) return []; const K = keep ? cInterEO(U, keep) : U; return K.length ? cInterEO(offLoops(K, ov), Z) : []; }
function ringsIn(Z, st, fix) { const out = []; let r = Z; for (let k = 0; k < 4000 && r.length; k++) { if (k) r = offLoops(r, -st); if (r.length) out.push(r.map(fix)); } return out; }
function cDiffEO(a, b) { const c = new ClipperLib.Clipper(); c.AddPaths(a.map(toCP), ClipperLib.PolyType.ptSubject, true); c.AddPaths(b.map(toCP), ClipperLib.PolyType.ptClip, true); const r = []; c.Execute(ClipperLib.ClipType.ctDifference, r, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd); return loopsOf(r); }
function vcMaxD(p, tool) { const g = coneGeom(tool), th = g.th, flute = g.h(g.R0); return { g, th, flute, maxD: +p.depth > 0 ? Math.min(+p.depth, flute) : flute }; }
function buildVcarve(p, tool, shapes, M) {
  const Del = (typeof d3 !== 'undefined' && d3.Delaunay) ? d3.Delaunay : (typeof globalThis !== 'undefined' && globalThis.TestDelaunay);
  if (tool.type !== 'v') throw new Error('Le V-carving demande une fraise en V.');
  if (!Del) return buildVcarveRings(p, tool, shapes, M);
  const h = Math.min(2, Math.max(0.05, +p.vstep || 0.1)), warns = [];
  const { g, th, flute, maxD: mD } = vcMaxD(p, tool); let maxD = mD; const narrow = [];
  const S0 = Math.max(0, Math.min(+p.vstart || 0, maxD));
  const pass = +p.pass > 0 ? +p.pass : (+tool.pass || 0), lv = []; if (pass > 0) for (let d = S0 + pass; d < maxD - 1e-6; d += pass) lv.push(d); lv.push(maxD);
  const cts = typeof S !== 'undefined' ? vcClrTools(p) : [], ct = cts[cts.length - 1] || null, rc = ct ? ct.dia / 2 : 0;
  const o = commonOpts(p, tool), fix = l => o.climb ? l : l.slice().reverse();
  const fstepG = g.rho > 0 ? coneFlatStep(g) : Math.max(0.1, 0.2 * th);
  if (p.vChamfer) { // mâle d'incrustation avec dégagement : la fraise en V ne suit que le motif (paroi en pente), à W = profondeur × tan du bord ; le cadre et le fond plat sont laissés au dégagement
    const base = baseLoops(shapes); if (!base.length) throw new Error('Sélectionnez au moins une forme fermée.');
    const S1 = Math.max(0, +p.vS0 || 0), W = g.r(maxD), mbc = new MB(M), oc = { ...o, entry: 'plunge' }, ring = d => offLoops(base, d).map(fix);
    const zs = depthLevels(S1 + maxD, pass > 0 ? pass : S1 + maxD); // paliers depuis la surface, en z réels (pas de décalage de départ ensuite)
    for (const z of zs) for (const l of orderNN(ring(W), nearestPt, mbc.x === null ? [0, 0] : [mbc.x, mbc.y])) emitLoop(mbc, l, 0, z, oc, false);
    if (rc > 0) { const st = g.rho > 0 ? Math.min(fstepG, Math.max(0.2, 0.4 * W)) : Math.max(fstepC(th), 0.4 * W, 0.2), bb = bbox([{ pts: base.flat() }]), m = W + 4 * rc + 2, box = [[bb.x0 - m, bb.y0 - m], [bb.x1 + m, bb.y0 - m], [bb.x1 + m, bb.y1 + m], [bb.x0 - m, bb.y1 + m]], C = cDiffEO([box], offLoops(base, W));
      for (const rr of ringsIn(clrLeft(C, rc, st, offLoops(base, W + 2 * rc)), st, fix)) for (const l of rr) emitLoop(mbc, l, 0, -(S1 + maxD), oc, false); } // coins que la fraise de dégagement n'atteint pas
    mbc.up(M.safeZ); if (!mbc.m.length) throw new Error('Formes trop petites pour cette précision : réduisez la valeur.');
    return { noShift: true, moves: mbc.m, warns: ct ? [trf('Fonds plats et cadre vidés à la fraise « {n} » (parcours de dégagement) ; la fraise en V ne fait que la paroi du motif.', { n: ct.name })] : [], info: tr('paroi du motif') + ' · ' + zs.length + ' ' + tr(zs.length > 1 ? 'paliers' : 'palier') };
  }
  const base = baseLoops(shapes); if (!base.length) throw new Error('Sélectionnez au moins une forme fermée.');
  const mb = new MB(M); let nCh = 0, deepest = 0, flat = false;
  const fstep = Math.max(0.1, 0.2 * th);
  for (const cp of orderNN(comps(base), c => centroid(c.outer))) {
    const loops = [cp.outer, ...cp.holes];
    const ma = medialAxis(loops, h, Del); let maxR = 0; for (const c of ma) for (const q of c) if (q[2] > maxR) maxR = q[2];
    const chains = ma.flatMap(c => vcRhoSplit(c, g.rho)).map(c => rdp3(c.map(q => [q[0], q[1], -Math.min(S0 + g.h(q[2]), maxD)]), 0.01)); // profondeur h(w) ; là où w < rho la fraise n'entre pas
    if (g.rho > 0) { const op = offLoops(offLoops(loops, -g.rho), g.rho); narrow.push(...cDiffEO(loops, op).filter(l => Math.abs(area(l)) > 12 * g.rho * g.rho)); }
    /* rayon du plus grand cercle inscrit (axe médian) : inutile de décaler le contour (calcul lent) si aucune zone n'est assez large pour un fond plat */
    const offC = new Map(), offAt = d => { if (d > maxR + 2 * h + 0.05) return []; const k = d.toFixed(6); if (!offC.has(k)) offC.set(k, offLoops(loops, -d)); return offC.get(k); };
    const W = g.r(maxD - S0); if (offAt(W).length) { flat = true;
      if (!ct && !(g.rho > 0) && Math.max(0.1, 0.2 * th) / (2 * th) > 0.12) throw new Error(tr('Une fraise en V pointue ne peut pas vider un fond plat : ajoutez une fraise de dégagement ou choisissez une fraise javelot ou à bout rond.'));
      if (!ct && maxR / fstepG > 1500) throw new Error(trf('Fond plat trop large pour le bout de cette fraise ({n} passes) : ajoutez une fraise de dégagement.', { n: Math.round(maxR / fstepG) })); }
    let prev = 0;
    for (const lvl of lv) {
      // fond plat à ce palier : zones plus larges que ce que la fraise couvre à cette profondeur (avec fraise de dégagement : seulement le bord qu'elle n'atteint pas)
      const wl = g.r(lvl - S0), dmax = ct ? W + rc + fstep : Infinity, frg = wl > 1e-6 ? offAt(wl) : loops;
      if (frg.length) {
        const rings = [];
        const last = lvl >= maxD - 1e-9, st = last ? (g.rho > 0 && !ct ? fstepG : fstep) : Math.max(fstep, wl * 0.8); let r = frg; /* anneaux successifs : chacun décalé du précédent (même résultat, bien plus rapide) */ if (last && ct) rings.push(frg.map(fix), ...ringsIn(clrLeft(frg, rc, st), st, fix)); /* l'anneau du bord fait la paroi ; le reste seulement là où le dégagement n'est pas passé */ else for (let k = 0; k < 4000; k++) { const d = wl + k * st; if (d > (last ? dmax : ct ? W + st : Infinity)) break; if (k) r = offLoops(r, -st); if (!r.length) break; rings.push(r.map(fix)); }
        if (rings.length) { mb.up(M.clearZ); emitRings(mb, rings, 0, -lvl, { ...o, entry: 'plunge' }, frg, tool.dia); deepest = Math.min(deepest, -lvl); }
      }
      // axe médian : la fraise remonte jusqu'à la pointe des coins
      let rem = []; for (const c of chains) rem.push(...vcSplit(c, prev, lvl));
      while (rem.length) {
        const cur = mb.x === null ? [0, 0] : [mb.x, mb.y]; let bi = 0, bd = Infinity, rev = false;
        rem.forEach((c, i) => { const a = hyp(c[0], cur), b = hyp(c[c.length - 1], cur); if (a < bd) { bd = a; bi = i; rev = false; } if (b < bd) { bd = b; bi = i; rev = true; } });
        let c = rem.splice(bi, 1)[0]; if (rev) c = c.slice().reverse();
        const s0 = c[0];
        if (mb.x !== null && mb.z <= 1e-9 && bd < 3 * h) { mb.g1(s0[0], s0[1], Math.max(mb.z, s0[2]), o.feed); mb.g1(s0[0], s0[1], s0[2], o.plunge); }
        else { mb.approach(s0[0], s0[1], 0, o.plunge); mb.g1(s0[0], s0[1], s0[2], o.plunge); }
        for (let i = 1; i < c.length; i++) mb.g1(c[i][0], c[i][1], c[i][2], o.feed);
        for (const q of c) deepest = Math.min(deepest, q[2]);
        nCh++;
      }
      prev = lvl;
    }
  }
  if (!nCh) throw new Error('Formes trop petites pour cette précision : réduisez la valeur.');
  if (narrow.length) warns.push(trf('{n} zone(s) plus étroite(s) que le bout de la fraise (Ø {w} mm) : non usinée(s), en rouge dans la vue 2D.', { n: narrow.length, w: fr(2 * g.rho, 2) }));
  if (flat) warns.push(ct ? trf('Fonds plats vidés à la fraise « {n} » (parcours de dégagement).', { n: ct.name }) : maxD < flute - 1e-9 ? 'Fond plat à ' + maxD.toFixed(2).replace('.', ',') + ' mm (profondeur max demandée).' : 'Fond plat imposé par la taille de la fraise (' + flute.toFixed(1).replace('.', ',') + ' mm max).');
  mb.up(M.safeZ);
  return { narrow, moves: mb.m, warns, info: 'axe médian' + (lv.length > 1 ? ' · ' + lv.length + ' paliers' : '') + (S0 > 0 ? ' · départ ' + S0.toFixed(2).replace('.', ',') + ' mm' : '') + ' · prof. max ' + (-deepest).toFixed(2).replace('.', ',') + ' mm' };
}
// parcours de dégagement lié à un V-carve : poche à la fraise droite dans les zones où le V atteint sa profondeur maximale
function vcClrIds(p) { return (p.clrTools && p.clrTools.length ? p.clrTools.slice() : p.clrTool ? [p.clrTool] : []); }
function vcClrTools(p) { const seen = new Set(); return vcClrIds(p).map(id => S.tools.find(t => t.id === id && t.type === 'flat')).filter(Boolean).sort((a, b) => b.dia - a.dia).filter(t => { const k = t.dia.toFixed(3); if (seen.has(k)) return false; seen.add(k); return true; }); }
function vclrShapes(par) {
  const vt = S.tools.find(t => t.id === par.toolId); if (!vt || vt.type !== 'v') return { shapes: [], maxD: 0 };
  const { g, maxD } = vcMaxD(par.p, vt), loops = baseLoops(par.shapeIds.map(shapeById).filter(Boolean));
  return { shapes: offLoops(loops, -g.r(maxD)).map((l, i) => ({ id: 'vclr' + i, pts: l, closed: true })), maxD };
}
// reprise : « Après le parcours » ; « Faire un parcours… » ouvre la bibliothèque (grosse fraise) et créera une ébauche liée
document.addEventListener('change', e => { if (e.target.id !== 'fRestFrom' || !S.form) return; e.stopImmediatePropagation(); const v = e.target.value;
  if (v === '__pick') { e.target.value = S.form.restFrom || ''; $('#fRoughPick').click(); return; }
  S.form.restFrom = v; if (v !== '__new' && !(S.editTp && (S.tps.find(x => x.vclrOf === S.editTp) || {}).id === v)) S.form.roughTool = ''; restCopy(S.form); renderForm(); }, true);
// la reprise reprend d'abord la profondeur, la surépaisseur et son retrait du parcours de départ (modifiables ensuite)
function restCopy(F) { const src = S.tps.find(t => t.id === F.restFrom); if (!src || F._restCopied === src.id) return; F._restCopied = src.id; F.depth = src.p.depth; F.vstart = src.p.vstart || 0; F.allow = src.p.allow || 0; F.finish = src.p.finish || 'last'; }
function restLink(tp) { const c = tp.p && tp.p.roughTool && S.tps.find(x => x.vclrOf === tp.id); if (c && tp.p.restFrom !== c.id) { tp.p.restFrom = c.id; if (S.form && S.editTp === tp.id) { S.form.restFrom = c.id; S.form._restCopied = c.id; } } }
function vclrSync(tp) {
  const kids = S.tps.filter(x => x.vclrOf === tp.id).sort((a, b) => (a.clrIdx || 0) - (b.clrIdx || 0));
  const T = tp.type === 'vcarve' ? (tp.p.clrExt ? [] : vcClrTools(tp.p)) : tp.type === 'pocket' && tp.p.roughTool ? [S.tools.find(t => t.id === tp.p.roughTool)].filter(Boolean) : [];
  for (const c of kids.slice(T.length)) S.tps = S.tps.filter(x => x !== c);
  const cs = T.map((t, k) => { let c = kids[k]; if (!c) { c = { id: uid(), type: 'pocket', shapeIds: [], vclrOf: tp.id, toolId: t.id, p: { ...newForm(), type: 'pocket', allow: 0, zrel: 1 }, visible: true, face: tp.face }; const i = S.tps.indexOf(tp); S.tps.splice(i < 0 ? S.tps.length : i, 0, c); }
    c.clrIdx = k; c.toolId = t.id; if (c.nameAuto !== false) c.name = tpAutoName(tp.type === 'pocket' ? 'rough' : 'clr', tpnLayer(tp.shapeIds, tp.relIds), t, tp.face, c); return c; });
  cs.forEach(computeTP);
}
// garder les parcours liés comme parcours indépendants (suppression ou renommage du parcours principal) : vrais vecteurs, réglages figés
function vclrDetach(par) {
  const kids = S.tps.filter(x => x.vclrOf === par.id).sort((a, b) => (a.clrIdx || 0) - (b.clrIdx || 0)); if (!kids.length) return 0;
  let ids = (par.shapeIds || []).slice();
  if (par.type === 'vcarve') { const lay = (S.shapes.find(x => x.id === ids[0]) || {}).layer, sh = vclrShapes(par).shapes.map(v => mkShape(nodesFromPts(v.pts), true, lay ? { layer: lay } : undefined)).filter(Boolean); ids = sh.map(x => x.id); }
  for (const c of kids) { c.shapeIds = ids.slice(); c.ownShapes = par.type === 'vcarve'; delete c.vclrOf; delete c.clrIdx; c.p = { ...c.p }; }
  if (par.type === 'vcarve') par.p = { ...par.p, clrExt: true }; else par.p = { ...par.p, roughTool: '', restFrom: kids[kids.length - 1].id };
  return kids.length;
}

