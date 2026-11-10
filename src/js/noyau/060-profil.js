// ---------- PROFIL ----------
// dégagement des coins intérieurs : la fraise va toucher le coin vif (dogbone en diagonale, T-bone le long du côté le plus long)
// loop = trajectoire du centre (décalée de d), R = rayon de l'outil ; seuls les sommets vifs (coins que la fraise ne peut pas atteindre) sont traités
function cornerRelief(loop, d, R, mode, cnt) {
  if (!mode || mode === 'round' || loop.length < 3) return loop;
  const n = loop.length, out = [], nrm = v => { const l = Math.hypot(v[0], v[1]); return l > 1e-12 ? [v[0] / l, v[1] / l] : null; };
  for (let i = 0; i < n; i++) {
    const v = loop[i], a = loop[(i - 1 + n) % n], b = loop[(i + 1) % n], la = hyp(a, v), lb = hyp(b, v), ua = nrm([a[0] - v[0], a[1] - v[1]]), ub = nrm([b[0] - v[0], b[1] - v[1]]);
    if (!ua || !ub || la < R * 0.05 || lb < R * 0.05) { out.push(v); continue; }
    const cs = Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1])), phi = Math.acos(cs);
    if (phi > 150 * Math.PI / 180 || phi < 4 * Math.PI / 180) { out.push(v); continue; }
    const bis = nrm([ua[0] + ub[0], ua[1] + ub[1]]); if (!bis) { out.push(v); continue; }
    const dc = d / Math.sin(phi / 2), c = [v[0] - bis[0] * dc, v[1] - bis[1] * dc];
    let e;
    if (mode === 'tbone') { const u = la >= lb ? [-ua[0], -ua[1]] : [-ub[0], -ub[1]], t = -((v[0] - c[0]) * u[0] + (v[1] - c[1]) * u[1]); e = [v[0] + u[0] * t, v[1] + u[1] * t]; }
    else { const k = R / dc; e = [c[0] + (v[0] - c[0]) * k, c[1] + (v[1] - c[1]) * k]; }
    if (hyp(e, v) > 0.005) { out.push(v, e, v.slice()); if (cnt) cnt.n++; } else out.push(v);
  }
  return out;
}
function buildProfile(p, tool, shapes, M) {
  const R = tool.dia / 2, allow = p.side === 'on' ? 0 : Math.max(0, +p.allow || 0), o = commonOpts(p, tool), warns = [];
  if (!(+p.depth >= 0) || p.depth === '') throw new Error('Indiquez une profondeur.');
  if (!(+p.depth > 0)) p = { ...p, depth: 0.001 }; // profondeur 0 : une passe à la profondeur de départ (surfaçage, ou fraise posée sur le relief projeté)
  const levels = depthLevels(+p.depth, +p.pass > 0 ? +p.pass : tool.pass);
  const mb = new MB(M); let groups = [];
  if (p.side === 'on') {
    for (const s of shapes) if (s.closed) groups.push({ nom: s.pts, rough: s.pts, hole: false });
    o.side = 1;
  } else {
    const base = baseLoops(shapes);
    if (!base.length && !shapes.some(s => !s.closed && s.pts.length > 1)) throw new Error('Sélectionnez au moins un vecteur.');
    if (base.length) {
    const sg = p.side === 'out' ? 1 : -1;
    const nom = offLoops(base, sg * R), rough = allow > 0 ? offLoops(base, sg * (R + allow)) : nom;
    if (!nom.length) throw new Error("L'outil est trop gros pour ce contour intérieur.");
    const rev = p.side === 'out' ? o.climb : !o.climb, fix = l => rev ? l.slice().reverse() : l;
    for (const l of nom) {
      const h = area(l) < 0, cn = centroid(l); let best = null, bd = Infinity;
      for (const r of rough) { if ((area(r) < 0) !== h) continue; const d = hyp(centroid(r), cn) + Math.abs(Math.abs(area(r)) - Math.abs(area(l))) * 1e-3; if (d < bd) { bd = d; best = r; } }
      groups.push({ nom: fix(l), rough: fix(best || l), hole: h });
    }
    if (rough.length !== nom.length) warns.push('La surépaisseur referme certains passages étroits : ils ne seront pas usinés. Réduisez la surépaisseur ou prenez une fraise plus fine.');
    }
  }
  const crn = { n: 0 }, cmode = 'round';
  if (cmode !== 'round') for (const g of groups) { g.nom0 = g.nom; const r0 = g.rough; g.nom = cornerRelief(g.nom, R, R, cmode, crn); g.rough = r0 === g.nom0 ? g.nom : cornerRelief(r0, R + allow, R, cmode); }
  if (o.entry === 'helix' && p.side !== 'on' && groups.length) { const all = groups.flatMap(g => g.nom); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of all) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); } const box = [[x0 - 1e4, y0 - 1e4], [x1 + 1e4, y0 - 1e4], [x1 + 1e4, y1 + 1e4], [x0 - 1e4, y1 + 1e4]]; o.region = p.side === 'out' ? [box, ...groups.map(g => g.nom)] : groups.map(g => g.nom); }
  const ptOf = g => centroid(g.nom);
  const holes = orderNN(groups.filter(g => g.hole), ptOf), outs = orderNN(groups.filter(g => !g.hole), ptOf, holes.length ? ptOf(holes[holes.length - 1]) : [0, 0]);
  const last = levels.length - 1;
  for (const g of [...holes, ...outs]) {
    const lv = levels.map((z, i) => ({ z, zTop: i ? levels[i - 1] : 0, loop: (allow > 0 && !(p.finish === 'last' && i === last)) ? g.rough : g.nom }));
    if (allow > 0 && p.finish === 'full') lv.push({ z: levels[last], zTop: 0, loop: g.nom, fin: true });
    lv.forEach((L, i) => {
      const oo = L.fin ? { ...o, entry: (o.entry === 'arc' || o.entry === 'arcramp') ? 'arc' : 'plunge' } : o;
      emitLoop(mb, L.loop, L.zTop, L.z, oo, i > 0 && !L.fin);
    });
  }
  const open = shapes.filter(s => !s.closed && s.pts.length > 1), osD = p.side === 'on' ? (p.openSide || 'on') : (p.side === 'out' ? 'right' : 'left'), os = p.side !== 'on' && p.f2 ? (osD === 'left' ? 'right' : 'left') : osD, allowO = Math.max(0, +p.allow || 0), lastL = levels.length - 1;
  if (open.length) {
    for (const s of open) {
      mb.up(M.clearZ);
      if (os === 'on') { emitOpen(mb, s.pts, levels, o); continue; }
      const nom = sideOffset(s.pts, R, os), rough = allowO > 0 ? sideOffset(s.pts, R + allowO, os) : nom, orient = l => ((os === 'left') === o.climb) ? l : l.slice().reverse();
      if (nom.gouge) warns.push('Risque d’entaille : une ligne ouverte a une courbe plus serrée que le rayon de l’outil de ce côté. Vérifiez l’aperçu ou prenez une fraise plus fine.');
      emitOpen(mb, i => orient(allowO > 0 && !(p.finish === 'last' && i === lastL) ? rough : nom), levels, { ...o, clearZ: M.clearZ }, true, s.pts);
      if (allowO > 0 && p.finish === 'full') emitOpen(mb, () => orient(nom), [levels[lastL]], { ...o, clearZ: M.clearZ, entry: o.entry === 'arc' || o.entry === 'arcramp' ? 'arc' : 'plunge' }, true, s.pts);
    }
  }
  let tabs = [];
  if (p.tabs) {
    const tH = +p.tabH || 0, tN = Math.max(1, Math.round(+p.tabN || 0));
    if (!(tH > 0) || tH >= +p.depth) warns.push('Ponts ignorés : la pièce ne sera pas tenue en fin de coupe. Donnez-leur une épaisseur entre 0 et la profondeur de coupe.');
    else { if (p.tabMode === 'manual' && Array.isArray(p.tabPts)) { const lp = groups.map(g => g.nom0 || g.nom); for (const q of p.tabPts) { const pr = projectOnLoops(lp, q); if (pr) tabs.push({ x: pr.x, y: pr.y, a: pr.a }); } } else for (const g of groups) tabs.push(...placeTabs(g.nom0 || g.nom, tN)); mb.m = applyTabs(mb.m, tabs, (Math.max(0, +p.tabL || 0) + tool.dia) / 2, -(+p.depth), tH, p.tabShape === 'tri', tool.plunge); }
  }
  mb.up(M.safeZ);
  return { moves: mb.m, warns, tabs, loops: groups.map(g => g.nom0 || g.nom), info: levels.length + ' passe' + (levels.length > 1 ? 's' : '') + (tabs.length ? ' · ' + tabs.length + ' pont' + (tabs.length > 1 ? 's' : '') : '') + (crn.n ? ' · ' + crn.n + ' ' + (cmode === 'tbone' ? 'T-bone' : 'dogbone') : '') };
}

