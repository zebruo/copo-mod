// ---------- opérations ----------
function regionPaths(shapes) {
  const cl = shapes.filter(s => s.closed && s.pts.length > 2);
  return cl.map(s => { const a = Math.abs(area(s.pts)), depth = cl.filter(o => o !== s && Math.abs(area(o.pts)) > a && pip(s.pts[0], o.pts)).length; const pos = area(s.pts) > 0; return toCP(pos === (depth % 2 === 0) ? s.pts : s.pts.slice().reverse()); });
}
function cBool(type, subj, clip) { const c = new ClipperLib.Clipper(); c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true); if (clip.length) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true); const s = []; c.Execute(type, s, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero); return s; }
function simplifyLoop(l) { const q = l.map(p => [p[0], p[1], 0]); q.push(q[0]); const r = rdp3(q, 0.003); r.pop(); return r.map(p => [p[0], p[1]]); }
function replaceMany(olds, loops, layer) {
  const ids = new Set(olds.map(s => s.id)); S.shapes = S.shapes.filter(s => !ids.has(s.id)); S.sel.clear();
  const made = loops.map(l => mkShape(nodesFromPts(simplifyLoop(l)), true, { layer })).filter(Boolean); made.forEach(m => S.sel.add(m.id));
  for (const tp of S.tps) if (tp.shapeIds.some(id => ids.has(id))) tp.shapeIds = [...tp.shapeIds.filter(id => !ids.has(id)), ...made.map(m => m.id)];
  return made;
}
function arrange(kind) {
  const im = S.imgSel && imgById(S.imgSel);
  const reorder = (arr, isSel) => {
    if (kind === 'zFront') return arr.filter(x => !isSel(x)).concat(arr.filter(isSel));
    if (kind === 'zBack') return arr.filter(isSel).concat(arr.filter(x => !isSel(x)));
    const a = arr.slice();
    if (kind === 'zUp') { for (let i = a.length - 2; i >= 0; i--) if (isSel(a[i]) && !isSel(a[i + 1])) [a[i], a[i + 1]] = [a[i + 1], a[i]]; }
    else { for (let i = 1; i < a.length; i++) if (isSel(a[i]) && !isSel(a[i - 1])) [a[i], a[i - 1]] = [a[i - 1], a[i]]; }
    return a;
  };
  if (im && !S.sel.size) { S.images = reorder(S.images, x => x === im); commit(false); renderImgPanel(); draw(); return; }
  if (!S.sel.size) { toast('Sélectionnez des vecteurs ou une image.'); return; }
  S.shapes = reorder(S.shapes, x => S.sel.has(x.id)); commit(false); draw();
}
function doBool(kind) {
  const ord = selOrdered().filter(s => s.closed && s.pts.length > 2); if (ord.length < 2) return toast('Sélectionnez au moins deux formes fermées.');
  const first = ord[0], base = first.g ? ord.filter(s => s.g === first.g) : [first], others = ord.filter(s => !base.includes(s));
  let res;
  if (kind === 'union') res = cBool(ClipperLib.ClipType.ctUnion, regionPaths(ord), []);
  else { if (!others.length) return toast('Sélectionnez aussi les vecteurs à ' + (kind === 'sub' ? 'soustraire.' : 'croiser.')); res = cBool(kind === 'sub' ? ClipperLib.ClipType.ctDifference : ClipperLib.ClipType.ctIntersection, regionPaths(base), regionPaths(others)); }
  const loops = loopsOf(res); if (!loops.length) return toast('Le résultat est vide.');
  replaceMany(ord, loops, first.layer); commit(); renderSel(); draw(); toast(loops.length + ' contour(s) obtenu(s).');
}
function relMoveBy(it, dx, dy) { it.x += dx; it.y += dy; if (relLinked(it)) { const im = imgById(it.src); if (im) { im.x = it.x; im.y = it.y; } } }
function relOrgDone() { relBump(); relDirty = true; commit(false); relPanel(true); if (typeof renderImgPanel === 'function') renderImgPanel(true); draw(); }
const relItems = () => relSelIds().map(id => S.relief.items.find(i => i.id === id)).filter(Boolean);
const boxOf = bs => ({ x0: Math.min(...bs.map(b => b.x0)), y0: Math.min(...bs.map(b => b.y0)), x1: Math.max(...bs.map(b => b.x1)), y1: Math.max(...bs.map(b => b.y1)) });
function relAlign(kind) {
  let us = relItems(), ref; const mode = S.ui.alignRef || 'sel'; if (!us.length) return toast(tr('Sélectionnez un relief.'));
  if (mode === 'first') { if (us.length < 2) return toast(tr('Sélectionnez au moins deux reliefs (Maj + clic) : le premier sert de référence.')); ref = relBox(us[0]); us = us.slice(1); }
  else ref = mode === 'stock' || us.length === 1 ? { x0: 0, y0: 0, x1: S.stock.w, y1: S.stock.h } : boxOf(us.map(relBox));
  for (const it of us) { const b = relBox(it); let dx = 0, dy = 0;
    if (kind === 'L') dx = ref.x0 - b.x0; if (kind === 'CH') dx = (ref.x0 + ref.x1) / 2 - (b.x0 + b.x1) / 2; if (kind === 'R') dx = ref.x1 - b.x1;
    if (kind === 'T') dy = ref.y1 - b.y1; if (kind === 'CV') dy = (ref.y0 + ref.y1) / 2 - (b.y0 + b.y1) / 2; if (kind === 'B') dy = ref.y0 - b.y0; relMoveBy(it, dx, dy); }
  relOrgDone(); if (mode === 'sel' && us.length === 1) toast(tr('Un seul relief : aligné sur le brut.'));
}
function relDistribute(axis) {
  const mode = S.ui.alignRef || 'sel', all = relItems(), X = axis === 'x', lo = b => X ? b.x0 : b.y0, size = b => X ? b.w : b.h, mv = (it, d) => relMoveBy(it, X ? d : 0, X ? 0 : d);
  if (mode === 'first') { if (all.length < 2) return toast(tr('Sélectionnez au moins deux reliefs (Maj + clic) : le premier sert de point de départ.')); const gap = Math.max(0, +S.ui.distGap || 0); let pos = X ? relBox(all[0]).x1 : relBox(all[0]).y1;
    for (const it of all.slice(1)) { const b = relBox(it); mv(it, pos + gap - lo(b)); pos += gap + size(b); } return relOrgDone(); }
  const bs = all.map(it => ({ it, b: relBox(it) })).sort((a, c) => lo(a.b) - lo(c.b));
  if (mode === 'stock') { if (!bs.length) return toast(tr('Sélectionnez un relief.')); const Lg = X ? S.stock.w : S.stock.h, gap = (Lg - bs.reduce((a, o) => a + size(o.b), 0)) / (bs.length + 1); let pos = gap; for (const o of bs) { mv(o.it, pos - lo(o.b)); pos += size(o.b) + gap; } return relOrgDone(); }
  if (bs.length < 3) return toast(tr('Sélectionnez au moins trois reliefs (Maj + clic).'));
  const span = (X ? bs[bs.length - 1].b.x1 : bs[bs.length - 1].b.y1) - lo(bs[0].b), gap = (span - bs.reduce((a, o) => a + size(o.b), 0)) / (bs.length - 1); let pos = lo(bs[0].b);
  for (const o of bs) { mv(o.it, pos - lo(o.b)); pos += size(o.b) + gap; } relOrgDone();
}
function doAlign(kind) {
  const ss = selShapes(); if (!ss.length && relSelIds().length) return relAlign(kind); if (!ss.length) return toast('Sélectionnez des vecteurs.');
  const mode = S.ui.alignRef || 'sel', stockB = { x0: 0, y0: 0, x1: S.stock.w, y1: S.stock.h };
  let us = units(ss), ref;
  if (mode === 'first') { if (us.length < 2) return toast('Sélectionnez au moins deux vecteurs : le premier sert de référence.');
    const fu = firstUnit(us); ref = bbox(fu); us = us.filter(u => u !== fu); }
  else ref = mode === 'stock' || us.length === 1 ? stockB : bbox(ss);
  for (const u of us) { const b = bbox(u); let dx = 0, dy = 0;
    if (kind === 'L') dx = ref.x0 - b.x0; if (kind === 'CH') dx = (ref.x0 + ref.x1) / 2 - (b.x0 + b.x1) / 2; if (kind === 'R') dx = ref.x1 - b.x1;
    if (kind === 'T') dy = ref.y1 - b.y1; if (kind === 'CV') dy = (ref.y0 + ref.y1) / 2 - (b.y0 + b.y1) / 2; if (kind === 'B') dy = ref.y0 - b.y0;
    u.forEach(s => transformShape(s, q => [q[0] + dx, q[1] + dy])); }
  commit(); renderSel(); draw(); if (mode === 'sel' && us.length === 1) toast('Un seul vecteur : aligné sur le brut.');
}
function firstUnit(us) { const f = selOrdered()[0]; return us.find(u => u.includes(f)) || us[0]; }
function selOrderUnits(us) { const ord = selOrdered(), rank = u => Math.min(...u.map(s => { const k = ord.indexOf(s); return k < 0 ? 1e9 : k; })); return us.slice().sort((a, b) => rank(a) - rank(b)); }
function doDistribute(axis) {
  if (!selShapes().length && relSelIds().length) return relDistribute(axis);
  const mode = S.ui.alignRef || 'sel', all = units(selShapes());
  if (mode === 'first') {
    if (all.length < 2) return toast('Sélectionnez au moins deux vecteurs : le premier sert de point de départ.');
    const us = selOrderUnits(all), gap = Math.max(0, +S.ui.distGap || 0); let pos = axis === 'x' ? bbox(us[0]).x1 : bbox(us[0]).y1;
    for (const u of us.slice(1)) { const b = bbox(u), d = pos + gap - (axis === 'x' ? b.x0 : b.y0); u.forEach(s => transformShape(s, q => axis === 'x' ? [q[0] + d, q[1]] : [q[0], q[1] + d])); pos += gap + (axis === 'x' ? b.w : b.h); }
    commit(); renderSel(); draw(); return;
  }
  if (mode === 'stock') {
    if (!all.length) return toast('Sélectionnez des vecteurs.');
    const bs = all.map(u => ({ u, b: bbox(u) })).sort((a, c) => axis === 'x' ? a.b.x0 - c.b.x0 : a.b.y0 - c.b.y0), L = axis === 'x' ? S.stock.w : S.stock.h;
    const tot = bs.reduce((a, o) => a + (axis === 'x' ? o.b.w : o.b.h), 0), gap = (L - tot) / (bs.length + 1); let pos = gap;
    for (const o of bs) { const d = pos - (axis === 'x' ? o.b.x0 : o.b.y0); o.u.forEach(s => transformShape(s, q => axis === 'x' ? [q[0] + d, q[1]] : [q[0], q[1] + d])); pos += (axis === 'x' ? o.b.w : o.b.h) + gap; }
    commit(); renderSel(); draw(); if (gap < 0) toast('Les vecteurs sont plus grands que le brut.'); return;
  }
  const us = all; if (us.length < 3) return toast('Sélectionnez au moins trois vecteurs.');
  const bs = us.map(u => ({ u, b: bbox(u) })).sort((a, c) => axis === 'x' ? a.b.x0 - c.b.x0 : a.b.y0 - c.b.y0);
  const size = b => axis === 'x' ? b.w : b.h, lo = b => axis === 'x' ? b.x0 : b.y0;
  const span = (axis === 'x' ? bs[bs.length - 1].b.x1 : bs[bs.length - 1].b.y1) - lo(bs[0].b), gap = (span - bs.reduce((a, o) => a + size(o.b), 0)) / (bs.length - 1);
  let pos = lo(bs[0].b); for (const o of bs) { const d = pos - lo(o.b); o.u.forEach(s => transformShape(s, q => axis === 'x' ? [q[0] + d, q[1]] : [q[0], q[1] + d])); pos += size(o.b) + gap; }
  commit(); renderSel(); draw();
}
// copie la sélection sur un calque (les copies sont sélectionnées, les originaux restent en place)
function copyToLayer(ss, l) { const gm = new Map(), made = []; for (const s of ss) { const n = copyShapes([s], q => [q[0], q[1]], gm)[0]; if (!n) continue; n.layer = l.id; if (s.rot) n.rot = s.rot; made.push(n); } S.sel.clear(); made.forEach(n => S.sel.add(n.id)); commit(); renderLayers(); renderSel(); draw(); toast(trf('{n} vecteur(s) copié(s) sur le calque « {l} ».', { n: made.length, l: l.name })); }
// presse-papiers de COPO : vecteurs (gardé aussi dans le navigateur, pour coller dans un autre projet ou un autre onglet) ou relief
let CLIP = null, clipN = 0;
function clipCopy(cut) {
  const ss = selShapes();
  if (!ss.length && S.relSel) { CLIP = { kind: 'relief', id: S.relSel }; clipN = 0; toast(tr('Relief copié : Ctrl+V en colle une copie.')); return; }
  if (!ss.length) return toast(tr('Sélectionnez des vecteurs à copier.'));
  CLIP = { kind: 'shapes', items: ss.map(x => ({ nodes: x.nodes.map(cloneNode), closed: x.closed, layer: x.layer, g: x.g || null, rot: x.rot || 0 })) }; clipN = 0;
  try { LS.set('copo.clip', JSON.stringify(CLIP)); } catch { }
  if (cut) { const ids = new Set(ss.map(x => x.id)); S.shapes = S.shapes.filter(x => !ids.has(x.id)); S.sel.clear(); S.ne = null; commit(); renderSel(); draw(); }
  toast(trf(cut ? '{n} vecteur(s) coupé(s) : Ctrl+V pour les coller.' : '{n} vecteur(s) copié(s) : Ctrl+V pour les coller.', { n: ss.length }));
}
function clipPaste() {
  let C = CLIP; if (!C || C.kind === 'shapes') { try { const o = JSON.parse(LS.get('copo.clip') || 'null'); if (o && o.kind === 'shapes' && o.items) C = o; } catch { } }
  if (!C) return toast(tr('Rien à coller : copiez d’abord des vecteurs (Ctrl+C).'));
  if (C.kind === 'relief') { if (!S.relief.items.some(i => i.id === C.id)) return toast(tr('Le relief copié n’existe plus.')); selectRel(C.id); relDup(); return; }
  const d = 10 * ++clipN, gm = new Map(); S.sel.clear(); S.selDim = null; if (S.relSel) { S.relSel = null; relPanel(); }
  for (const it of C.items) { let g = null; if (it.g) { if (!gm.has(it.g)) gm.set(it.g, uid()); g = gm.get(it.g); }
    const n = mkShape(it.nodes.map(cloneNode), it.closed, { layer: S.layers.some(l => l.id === it.layer) ? it.layer : S.layerActive, g }); if (!n) continue; transformShape(n, q => [q[0] + d, q[1] - d]); if (it.rot) n.rot = it.rot; S.sel.add(n.id); }
  if (curTab !== 'dessin' && curTab !== 'parcours') setTab('dessin'); commit(); renderLayers(); renderSel(); draw(); toast(trf('{n} vecteur(s) collé(s), décalé(s) de {d} mm.', { n: S.sel.size, d }));
}
function copyShapes(ss, f, gmap) { return ss.map(s => { let g = null; if (s.g) { if (!gmap.has(s.g)) gmap.set(s.g, uid()); g = gmap.get(s.g); } const n = mkShape(s.nodes.map(cloneNode), s.closed, { layer: s.layer, g }); if (n) transformShape(n, f); return n; }).filter(Boolean); }
function doArray() {
  const ss = selShapes(); if (!ss.length) return toast('Sélectionnez les vecteurs à copier.'); const b = bbox(ss), made = [], U = S.ui;
  if (U.arrMode === 'path') { // répétition le long d'une courbe : la courbe est le dernier vecteur sélectionné
    const ids = [...S.sel], guide = shapeById(ids[ids.length - 1]), objs = ss.filter(x => x !== guide && !(guide.g && x.g === guide.g));
    if (!guide || !guide.pts || guide.pts.length < 2) return toast(tr('Sélectionnez en dernier la courbe guide.')); if (!objs.length) return toast(tr('Sélectionnez les vecteurs à répéter, puis en dernier la courbe guide (Maj+clic).'));
    const P = guide.closed ? guide.pts.concat([guide.pts[0]]) : guide.pts, cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); const L = cum[cum.length - 1]; if (L < 1e-6) return toast(tr('La courbe guide est trop courte.'));
    const at = d => { d = guide.closed ? ((d % L) + L) % L : Math.max(0, Math.min(L, d)); let k = 1; while (k < cum.length - 1 && cum[k] < d) k++; const t = (d - cum[k - 1]) / Math.max(1e-12, cum[k] - cum[k - 1]), a = P[k - 1], c = P[k]; return { p: [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t], ang: Math.atan2(c[1] - a[1], c[0] - a[0]) }; };
    const n = Math.max(1, Math.round(+U.arrPN || 1)), off = Math.max(0, +U.arrPOff || 0), D = [];
    if (U.arrPFit) { if (guide.closed) for (let k = 0; k < n; k++) D.push(off + k * L / n); else for (let k = 0; k < n; k++) D.push(n === 1 ? off : off + k * (L - off) / (n - 1)); }
    else { const gap = Math.max(0.1, +U.arrPGap || 10); for (let k = 0; k < n; k++) { const d = off + k * gap; if (!guide.closed && d > L + 1e-6) break; D.push(d); } }
    const ob = bbox(objs), cc = [ob.x0 + ob.w / 2, ob.y0 + ob.h / 2], a0 = at(D[0]).ang;
    for (const d of D) { const { p, ang } = at(d), r = U.arrPRot ? ang : 0, co = Math.cos(r), si = Math.sin(r); made.push(...copyShapes(objs, q => [p[0] + (q[0] - cc[0]) * co - (q[1] - cc[1]) * si, p[1] + (q[0] - cc[0]) * si + (q[1] - cc[1]) * co], new Map())); }
    if (!U.arrPKeep) { const del = new Set(objs.map(o => o.id)); S.shapes = S.shapes.filter(x => !del.has(x.id)); }
    S.sel.clear(); made.forEach(m => S.sel.add(m.id)); commit(); renderSel(); draw(); toast(trf('{n} copie(s) le long de la courbe.', { n: D.length })); return;
  }
  if (U.arrMode === 'grid') {
    const nx = Math.max(1, Math.round(U.arrNx)), ny = Math.max(1, Math.round(U.arrNy)); if (nx * ny < 2) return toast('Indiquez au moins 2 colonnes ou 2 lignes.');
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) { if (!r && !c) continue; const dx = c * (b.w + (+U.arrGx || 0)), dy = r * (b.h + (+U.arrGy || 0)); made.push(...copyShapes(ss, q => [q[0] + dx, q[1] + dy], new Map())); }
  } else {
    const n = Math.max(2, Math.round(U.arrN)), tot = +U.arrAng || 360, step = Math.abs(tot - 360) < 1e-6 ? 360 / n : tot / (n - 1), C = inXY(+U.arrCx || 0, +U.arrCy || 0), cc = [b.x0 + b.w / 2, b.y0 + b.h / 2];
    for (let j = 1; j < n; j++) { const a = step * j * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), rot = q => [C[0] + (q[0] - C[0]) * co - (q[1] - C[1]) * si, C[1] + (q[0] - C[0]) * si + (q[1] - C[1]) * co];
      if (U.arrRot) made.push(...copyShapes(ss, rot, new Map())); else { const rc = rot(cc), dx = rc[0] - cc[0], dy = rc[1] - cc[1]; made.push(...copyShapes(ss, q => [q[0] + dx, q[1] + dy], new Map())); } }
  }
  made.forEach(m => S.sel.add(m.id)); commit(); renderSel(); draw(); toast(made.length + ' vecteur(s) copiés.');
}

