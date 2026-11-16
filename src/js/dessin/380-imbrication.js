// ---------- imbrication ----------
function nestPartOf(u) {
  const cl = u.filter(s => s.closed && s.pts.length > 2), area = l => Math.abs(l.reduce((a, q, i) => { const r = l[(i + 1) % l.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0) / 2);
  const outer = cl.filter(a => !cl.some(b => b !== a && area(b.pts) > area(a.pts) && pip(a.pts[0], b.pts)));
  const lines = u.filter(s => !s.closed || s.pts.length <= 2).map(s => s.pts.map(q => [q[0], q[1]]));
  return { loops: outer.map(s => s.pts.map(q => [q[0], q[1]])), lines };
}
function doNest() {
  const U = S.ui; let ss = selShapes(); const all = !ss.length; if (all) ss = S.shapes.slice(); if (!ss.length) return toast('Rien à imbriquer : dessinez ou sélectionnez des pièces.');
  const us = units(ss), N = Math.max(1, Math.round(+U.nestN || 1)), st = S.stock;
  const angs = { none: [0], '180': [0, 180], '90': [0, 90, 180, 270], '45': [0, 45, 90, 135, 180, 225, 270, 315] }[U.nestRot] || [0];
  const q = { fast: 1.8, normal: 1, fine: 0.55 }[U.nestQ] || 1, cell = Math.max(0.25, Math.min(6, Math.sqrt(st.w * st.h) / 500 * q));
  const parts = [], info = [];
  us.forEach((u, k) => { const pp = nestPartOf(u); if (!pp.loops.length && !pp.lines.length) return; for (let c = 0; c < N; c++) parts.push({ id: k + ':' + c, loops: pp.loops, lines: pp.lines }); info[k] = u; });
  if (!parts.length) return toast('Aucune pièce exploitable dans la sélection.');
  const t0 = performance.now();
  const r = nestParts(parts, { x0: 0, y0: 0, w: st.w, h: st.h }, { cell, spacing: Math.max(0, +U.nestGap || 0), margin: Math.max(0, +U.nestMargin || 0), angles: angs.map(a => a * Math.PI / 180) });
  const byUnit = new Map(); for (const pl of r.placed) { const k = +pl.id.split(':')[0]; if (!byUnit.has(k)) byUnit.set(k, []); byUnit.get(k).push(pl); }
  S.sel.clear(); let copies = 0;
  info.forEach((u, k) => {
    if (!u) return; const pls = byUnit.get(k) || [];
    if (!pls.length) { u.forEach(s => S.sel.add(s.id)); return; }
    const fOf = pl => { const co = Math.cos(pl.ang), si = Math.sin(pl.ang); return qq => [qq[0] * co - qq[1] * si + pl.tx, qq[0] * si + qq[1] * co + pl.ty]; };
    pls.slice(1).forEach(pl => {
      const f = fOf(pl);
      const made = copyShapes(u, f, new Map()); copies++;
      if (U.nestTp) { const ids = new Map(u.map((s, i) => [s.id, made[i] && made[i].id])); for (const tp of S.tps) if (tp.shapeIds.some(id => ids.has(id))) tp.shapeIds = [...tp.shapeIds, ...tp.shapeIds.filter(id => ids.has(id)).map(id => ids.get(id)).filter(Boolean)]; }
    });
    const f0 = fOf(pls[0]); u.forEach(s => transformShape(s, f0));
  });
  const miss = r.failed.length, pc = Math.round(r.usage * 100);
  const msg = r.placed.length + ' pièce(s) placée(s)' + (copies ? ' dont ' + copies + ' copie(s)' : '') + (miss ? ' · ' + miss + ' ne tienne(nt) pas sur le brut (laissée(s) sélectionnée(s))' : '') + ' · occupation ' + pc + ' %';
  $('#nestInfo').textContent = msg + ' · ' + Math.round(performance.now() - t0) + ' ms. Annulez avec Ctrl+Z si le résultat ne convient pas.';
  commit(); renderSel(); draw(); toast(msg + '.');
}

