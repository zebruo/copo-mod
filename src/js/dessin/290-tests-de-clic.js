// ---------- tests de clic ----------
function edgeDist(s, p) { const n = s.pts.length; let b = Infinity; for (let i = 0; i < n - (s.closed ? 0 : 1); i++) b = Math.min(b, segDist(p, s.pts[i], s.pts[(i + 1) % n])); return b; }
function hitEdge(p, px = 7) { const tol = px / S.view.s; let best = null, bd = tol; for (const s of S.shapes) { if (!editable(s)) continue; const d = edgeDist(s, p); if (d < bd) { bd = d; best = s; } } return best; }
function hitShape(p) { return hitEdge(p, 6) || null; } // sélection sur le trait uniquement (les formes empilées restent accessibles)
function hitSelInside(p) { let best = null, ba = Infinity; for (const s of selShapes()) if (editable(s) && s.closed && pip(p, s.pts)) { const a = Math.abs(area(s.pts)); if (a < ba) { ba = a; best = s; } } return best; } // glisser une sélection depuis l'intérieur
function hitDim(p) { const tol = 6 / S.view.s; for (const d of S.dims) { const { A, B } = dimGeom(d); if (segDist(p, A, B) < tol) return d; } return null; }
function guideLk(axis) { const g = S.guides, k = axis === 'x' ? 'lx' : 'ly'; if (!Array.isArray(g[k])) g[k] = []; while (g[k].length < g[axis].length) g[k].push(false); g[k].length = g[axis].length; return g[k]; }
function guideDel(axis, i) { guideLk(axis).splice(i, 1); S.guides[axis].splice(i, 1); }
function hitGuide(X, Y, all) { for (const axis of ['x', 'y']) { const L = guideLk(axis); for (let i = 0; i < S.guides[axis].length; i++) if (Math.abs((axis === 'x' ? sx(S.guides.x[i]) - X : sy(S.guides.y[i]) - Y)) < 4 && (all || !L[i])) return { axis, i }; } return null; }
function guideOpen(gd) { if (curTab !== 'dessin') setTab('dessin'); if (S.ui.tool !== 'select') setTool('select'); S.ui.dsec = 'guides'; dRefresh(); renderGuides(); const li = $('#guideList').querySelector('[data-g="' + gd.axis + gd.i + '"]'); if (li) { li.classList.add('hl'); li.scrollIntoView({ block: 'nearest' }); const inp = li.querySelector('input'); if (inp) { inp.focus(); inp.select(); } setTimeout(() => li.classList.remove('hl'), 1500); } }
// extrémités de deux vecteurs ouverts (ou d'un même vecteur) qui se touchent près du point : un coin à joindre avant le congé
function findJunction(p) { const tol = Math.max(0.05, +S.ui.joinTol || 0.5), pr = 12 / S.view.s, E = [];
  for (const s of S.shapes) { if (!editable(s) || s.closed || s.nodes.length < 2) continue; const N = s.nodes; for (const k of [0, N.length - 1]) if (Math.hypot(N[k].x - p[0], N[k].y - p[1]) < pr) E.push({ s, k, n: N[k] }); }
  for (let a = 0; a < E.length; a++) for (let b = a + 1; b < E.length; b++) { const A = E[a], B = E[b]; if (A.s === B.s && (A.k === B.k || A.s.nodes.length < 3)) continue; if (Math.hypot(A.n.x - B.n.x, A.n.y - B.n.y) <= tol) return { A, B, p: [A.n.x, A.n.y], join: true }; }
  return null; }
function cornerByJoin(J, kind, val) { const keep = S.shapes.slice(), tps = S.tps.map(t => t.shapeIds.slice()), tol = Math.max(0.05, +S.ui.joinTol || 0.5); let s, i;
  if (J.A.s === J.B.s) { s = J.A.s; const N = s.nodes, f = N[0], l = N[N.length - 1]; f.i = l.i; N.pop(); s.closed = true; refresh(s); i = 0; }
  else { const r = joinNodes([J.A.s.nodes, J.B.s.nodes], tol, 'line'), ids = new Set([J.A.s.id, J.B.s.id]); S.shapes = S.shapes.filter(x => !ids.has(x.id)); s = mkShape(r.nodes, r.closed, { layer: J.A.s.layer, g: J.A.s.g });
    if (!s) { S.shapes = keep; return false; } for (const tp of S.tps) if (tp.shapeIds.some(id => ids.has(id))) tp.shapeIds = [...tp.shapeIds.filter(id => !ids.has(id)), s.id]; let bd = Infinity; s.nodes.forEach((n, k) => { const d = Math.hypot(n.x - J.p[0], n.y - J.p[1]); if (d < bd) { bd = d; i = k; } }); }
  if (canCorner(s, i) && applyCorner(s, i, kind, val, 0.999)) return true;
  S.shapes = keep; S.tps.forEach((t, k) => t.shapeIds = tps[k]); if (J.A.s === J.B.s) { const N = J.A.s.nodes; J.A.s.closed = false; N.push(NODE(J.B.n.x, J.B.n.y, J.B.n.i)); N[0].i = null; refresh(J.A.s); } return false; }
function findCorner(p) { let best = null, bd = 12 / S.view.s; for (const s of S.shapes) { if (!editable(s)) continue; s.nodes.forEach((n, i) => { const d = Math.hypot(n.x - p[0], n.y - p[1]); if (d < bd && canCorner(s, i)) { bd = d; best = { s, i, p: [n.x, n.y] }; } }); } return best; }
function edgePortion(s, p) { // portion qui serait supprimée par Ajuster (pour l'aperçu)
  const others = S.shapes.filter(o => o !== s && shown(o)), xs = intersParams(s, others), { u } = paramAt(s, p), ns = nseg(s);
  if (!xs.length) return s.pts.concat(s.closed ? [s.pts[0]] : []);
  let a = xs.filter(x => x < u).pop(), b = xs.find(x => x > u);
  if (s.closed) { if (xs.length < 2) return null; if (a === undefined) a = xs[xs.length - 1] - ns; if (b === undefined) b = xs[0] + ns; } else { if (a === undefined) a = 0; if (b === undefined) b = ns; }
  return refresh({ nodes: extractNodes(s, a < 0 ? a + ns : a, (a < 0 ? a + ns : a) + (b - a)), closed: false }).pts;
}

