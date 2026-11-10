// ---------- POCHE ----------
function ringResidual(work, raw, R) { // zones que les anneaux ne balaient pas (souvent un fil au milieu d'une bande)
  const CT = ClipperLib.ClipType; let cov = [];
  for (const r of raw) { const band = cBool2(CT.ctDifference, offLoops(r, R * 0.995), offLoops(r, -R * 0.995)); cov = cov.length ? cBool2(CT.ctUnion, cov, band) : band; }
  let res = cBool2(CT.ctDifference, offLoops(work, R * 0.99), cov); res = offLoops(offLoops(res, -0.02), 0.02);
  return res.filter(l => Math.abs(area(l)) > 0.02);
}
function emitRings(mb, rings, zTop, z, o, region, dia, inward) {
  for (let n = 0; n < rings.length; n++) { const k = inward ? n : rings.length - 1 - n; // par défaut du milieu vers le bord ; « inward » : du bord vers le milieu
    const ord = orderNN(rings[k], nearestPt, mb.x === null ? [0, 0] : [mb.x, mb.y]);
    for (const l of ord) {
      let cont = false;
      if (mb.x !== null && mb.z <= zTop + 1e-9) { const q = nearestPt(l, [mb.x, mb.y]); cont = linkOK([mb.x, mb.y], q, region, dia * 2.5); }
      emitLoop(mb, l, zTop, z, { ...o, region: o.region || region }, cont);
    }
  }
}
function cBool2(type, a, b) { const c = new ClipperLib.Clipper(); c.AddPaths(a.map(toCP), ClipperLib.PolyType.ptSubject, true); c.AddPaths(b.map(toCP), ClipperLib.PolyType.ptClip, true); const r = []; c.Execute(type, r, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero); return loopsOf(r); }
// lignes de balayage dans une zone (centres d'outil), à l'angle donné
function rasterSegs(region, step, angDeg) {
  const th = angDeg * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), rot = q => [q[0] * c + q[1] * s, -q[0] * s + q[1] * c], un = q => [q[0] * c - q[1] * s, q[0] * s + q[1] * c];
  const L = region.map(l => l.map(rot)); let y0 = Infinity, y1 = -Infinity; for (const l of L) for (const q of l) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const n = Math.max(1, Math.ceil((y1 - y0) / step - 1e-9)), segs = [];
  for (let k = 0; k < n; k++) {
    const y = y0 + (y1 - y0) * (k + 0.5) / n, xs = [];
    for (const l of L) for (let i = 0; i < l.length; i++) { const a = l[i], b = l[(i + 1) % l.length]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 0.01) segs.push({ k, a: un([xs[i], y]), b: un([xs[i + 1], y]) });
  }
  return segs;
}
function emitRaster(mb, region, step, ang, zTop, z, o, allowed, dia) {
  const rem = rasterSegs(region, step, ang); if (!rem.length) return;
  while (rem.length) {
    const cur = mb.x === null ? rem[0].a : [mb.x, mb.y]; let bi = 0, bd = Infinity, rev = false;
    rem.forEach((g, i) => { const da = hyp(g.a, cur), db = hyp(g.b, cur); if (da < bd) { bd = da; bi = i; rev = false; } if (db < bd) { bd = db; bi = i; rev = true; } });
    const g = rem.splice(bi, 1)[0], A = rev ? g.b : g.a, B = rev ? g.a : g.b;
    if (mb.x !== null && mb.z <= z + 1e-9 && linkOK(cur, A, allowed, step * 2.2)) mb.g1(A[0], A[1], z, o.feed);
    else {
      mb.approach(A[0], A[1], zTop, o.plunge);
      const len = hyp(A, B), ent = o.entry;
      if (ent === 'helix' && helixEntry(mb, A, z, o, allowed, null)) { }
      else if ((ent === 'ramp' || ent === 'rampzz' || ent === 'helix') && len > 1) { const L = Math.min(Math.max(o.rampLen, 10), len), z0 = mb.z, E = [A[0] + (B[0] - A[0]) * L / len, A[1] + (B[1] - A[1]) * L / len]; mb.g1e(E[0], E[1], z, o.rf || o.feed); mb.g1(A[0], A[1], z, o.feed); }
      else mb.g1(A[0], A[1], z, o.plunge);
    }
    mb.g1(B[0], B[1], z, o.feed);
  }
}
function buildPocket(p, tool, shapes, M) {
  const R = tool.dia / 2, o = commonOpts(p, tool), warns = [];
  if (!(+p.depth >= 0) || p.depth === '') throw new Error('Indiquez une profondeur.');
  if (!(+p.depth > 0)) p = { ...p, depth: 0.001 }; // profondeur 0 : une passe à la profondeur de départ (surfaçage, ou fraise posée sur le relief projeté)
  const rest = !!p.rest && +p.restDia > tool.dia + 1e-6, raster = (p.strategy === 'raster' || p.strategy === 'zigzag') && !rest, contour = p.strategy !== 'zigzag', inward = p.strategy === 'ringsIn', allow = raster && !contour ? 0 : Math.max(0, +p.allow || 0);
  if (p.rest && !rest) warns.push('Reprise ignorée : les coins ne seront pas repris. Choisissez une fraise précédente plus grosse que celle-ci.');
  const levels = depthLevels(+p.depth, +p.pass > 0 ? +p.pass : tool.pass), last = levels.length - 1;
  const step = tool.dia * Math.max(0.05, 1 - (+tool.over || 0) / 100);
  const base = baseLoops(shapes); if (!base.length) throw new Error('Sélectionnez au moins une forme fermée.');
  const fix = l => o.climb ? l : l.slice().reverse();
  const ent = o.entry, oR0 = { ...o, entry: ent === 'rampzz' ? 'rampzz' : (ent === 'ramp' || ent === 'arcramp') ? 'ramp' : ent === 'helix' ? 'helix' : 'plunge' };
  const oF = { ...o, entry: (ent === 'arc' || ent === 'arcramp') ? 'arc' : 'plunge' };
  const mb = new MB(M); let nRest = 0; const crn = { n: 0 }, cmode = 'round';
  for (const cp of orderNN(comps(base), c => centroid(c.outer))) {
    const loops = [cp.outer, ...cp.holes], region = offLoops(loops, -R);
    if (!region.length) { warns.push('Une poche plus étroite que l’outil n’est pas usinée : prenez une fraise plus fine.'); continue; }
    const oR = { ...oR0, region };
    let work = offLoops(loops, -(R + allow));
    if (rest) {
      // la grosse fraise s'est arrêtée à la surépaisseur des parois : elle a balayé (contour − (Rb + surép.)) + Rb
      const Rb = +p.restDia / 2, aB = p.restAllow == null ? allow : Math.max(0, +p.restAllow || 0), opened = offLoops(offLoops(loops, -(Rb + aB)), Rb), inner = allow > 0 ? offLoops(loops, -allow) : loops;
      let left = opened.length ? cBool2(ClipperLib.ClipType.ctDifference, inner, opened) : inner;
      left = offLoops(offLoops(left, -0.03), 0.03);
      const wR = allow > 0 ? offLoops(loops, -(R + allow)) : region;
      work = left.length && wR.length ? cBool2(ClipperLib.ClipType.ctIntersection, wR, offLoops(left, R * 0.98)) : [];
      if (left.length && !work.length) warns.push('Reprise : certains coins restent trop étroits pour cette fraise et ne sont pas usinés. Ajoutez une reprise avec une fraise plus fine.');
      if (work.length) nRest += left.length;
      if (!work.length && !(allow > 0 && p.finish !== 'none')) continue; // sinon : rien à reprendre, mais la petite fraise finit les parois
    }
    if (!work.length && !rest) work = region;
    const raw = []; if (!raster) for (let k = 0; k < 4000; k++) { const r = k ? offLoops(work, -k * step) : work; if (!r.length) break; raw.push(r); }
    if (raw.length) { const res = ringResidual(work, raw, R); if (res.length) raw.push(res); } // matière restée entre le dernier anneau et le milieu (bande trop large pour un seul passage)
    const rings = raw.map(r => r.map(fix));
    const CR = (l, d, c) => cornerRelief(l, d, R, cmode, c);
    if (cmode !== 'round' && rings.length) rings[0] = rings[0].map(l => CR(l, R + allow, allow > 0 ? null : crn));
    const regionF = cmode !== 'round' ? region.map(l => fix(l)).map(l => CR(l, R, allow > 0 ? crn : null)) : region.map(fix), workF = cmode !== 'round' ? work.map(fix).map(l => CR(l, R + allow, raster && !(allow > 0) ? crn : null)) : work.map(fix);
    levels.forEach((z, i) => {
      const zTop = i ? levels[i - 1] : 0;
      if (mb.x !== null) mb.up(M.clearZ);
      if (raster) {
        emitRaster(mb, work, step, +p.rasterAng || 0, zTop, z, oR, region, tool.dia);
        if (contour) for (const l of workF) { const cont = mb.x !== null && mb.z <= z + 1e-9 && linkOK([mb.x, mb.y], nearestPt(l, [mb.x, mb.y]), region, tool.dia * 2.5); emitLoop(mb, l, zTop, z, { ...oR, entry: 'plunge' }, cont); }
      } else emitRings(mb, rings, zTop, z, oR, region, tool.dia, inward);
      if (allow > 0 && p.finish === 'last' && i === last) for (const l of regionF) { const cont = mb.x !== null && mb.z <= z + 1e-9 && linkOK([mb.x, mb.y], nearestPt(l, [mb.x, mb.y]), region, tool.dia * 2.5); emitLoop(mb, l, zTop, z, { ...oR, entry: 'plunge' }, cont); }
    });
    if (allow > 0 && p.finish === 'full') for (const l of regionF) emitLoop(mb, l, 0, levels[last], oF, false);
  }
  if (rest && !mb.m.length) warns.push('Aucune matière à reprendre : la fraise précédente atteint déjà tous les coins.');
  mb.up(M.safeZ);
  return { moves: mb.m, warns, info: levels.length + ' passe' + (levels.length > 1 ? 's' : '') + (rest ? ' · reprise de ' + nRest + ' zone(s)' : raster ? ' · aller-retour ' + (+p.rasterAng || 0) + '°' + (contour ? ' + contour' : '') : inward ? ' · spirale ext. → int.' : ' · spirale int. → ext.') + ' · pas latéral ' + step.toFixed(2).replace('.', ',') + ' mm' + (crn.n ? ' · ' + crn.n + ' ' + (cmode === 'tbone' ? 'T-bone' : 'dogbone') : '') };
}

