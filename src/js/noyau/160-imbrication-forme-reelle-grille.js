// ---------- IMBRICATION (forme réelle, grille + placement bas-gauche) ----------
function nestRaster(loops, lines, ang, cell) {
  const co = Math.cos(ang), si = Math.sin(ang), R = q => [q[0] * co - q[1] * si, q[0] * si + q[1] * co];
  const L = loops.map(l => l.map(R)), PL = lines.map(l => l.map(R)), P = PL.flat(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  for (const l of L) for (const q of l) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const w = Math.max(1, Math.floor((x1 - x0) / cell) + 1), h = Math.max(1, Math.floor((y1 - y0) / cell) + 1), bm = new Uint8Array(w * h);
  const mark = (x, y) => { const i = Math.min(w - 1, Math.max(0, Math.floor((x - x0) / cell))), j = Math.min(h - 1, Math.max(0, Math.floor((y - y0) / cell))); bm[j * w + i] = 1; };
  for (let j = 0; j < h; j++) {
    const y = y0 + (j + 0.5) * cell, xs = [];
    for (const l of L) for (let k = 0; k < l.length; k++) { const a = l[k], b = l[(k + 1) % l.length]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.max(0, Math.floor((xs[k] - x0) / cell)), i1 = Math.min(w - 1, Math.floor((xs[k + 1] - x0) / cell)); for (let i = i0; i <= i1; i++) bm[j * w + i] = 1; }
  }
  const seg = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (cell * 0.5))); for (let k = 0; k <= n; k++) mark(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n); };
  for (const l of L) for (let k = 0; k < l.length; k++) seg(l[k], l[(k + 1) % l.length]);
  for (const l of PL) { for (let k = 1; k < l.length; k++) seg(l[k - 1], l[k]); if (l.length === 1) mark(l[0][0], l[0][1]); }
  const rows = []; for (let j = 0; j < h; j++) { const r = []; let st = -1; for (let i = 0; i <= w; i++) { const v = i < w && bm[j * w + i]; if (v && st < 0) st = i; if (!v && st >= 0) { r.push([st, i - 1]); st = -1; } } rows.push(r); }
  return { w, h, rows, ox: x0, oy: y0, area: bm.reduce((a, b) => a + b, 0) };
}
function mergeIv(iv) { iv.sort((a, b) => a[0] - b[0]); const o = []; for (const v of iv) { if (o.length && v[0] <= o[o.length - 1][1] + 1) o[o.length - 1][1] = Math.max(o[o.length - 1][1], v[1]); else o.push([v[0], v[1]]); } return o; }
function nestDilate(m, rs) {
  const rows = [];
  for (let j = -rs; j < m.h + rs; j++) { const iv = []; for (let dy = -rs; dy <= rs; dy++) { const r = m.rows[j + dy]; if (!r) continue; const e = Math.floor(Math.sqrt(Math.max(0, rs * rs - dy * dy))); for (const [a, b] of r) iv.push([a - e, b + e]); } rows.push(mergeIv(iv)); }
  return { rows, off: -rs };
}
// parts : [{ id, loops, pts }] ; sheet : { x0, y0, w, h } ; renvoie les placements et les pièces non placées
function nestParts(parts, sheet, o) {
  const cell = o.cell, rs = Math.max(0, Math.ceil(o.spacing / cell)), mg = Math.max(0, Math.ceil(o.margin / cell));
  const Gw = Math.floor(sheet.w / cell), Gh = Math.floor(sheet.h / cell), occ = Array.from({ length: Gh }, () => []);
  const prep = parts.map(p => ({ p, var: o.angles.map(a => { const m = nestRaster(p.loops, p.lines || (p.pts ? [p.pts] : []), a, cell); return { a, m, d: nestDilate(m, rs) }; }) }));
  prep.sort((A, B) => B.var[0].m.area - A.var[0].m.area);
  const placed = [], failed = []; let used = 0;
  for (const it of prep) {
    let best = null;
    for (const v of it.var) {
      const m = v.m, xmin = mg, xmax = Gw - mg - m.w, ymin = mg, ymax = Gh - mg - m.h; if (xmax < xmin || ymax < ymin) continue;
      for (let Y = ymin; Y <= ymax; Y++) {
        if (best && Y > best.Y) break;
        const forb = [];
        for (let k = 0; k < v.d.rows.length; k++) { const r = Y + k + v.d.off; if (r < 0 || r >= Gh) continue; const oc = occ[r]; if (!oc.length) continue; for (const [a, b] of v.d.rows[k]) for (const [pp, qq] of oc) forb.push([pp - b, qq - a]); }
        const fm = mergeIv(forb); let X = xmin;
        for (const [a, b] of fm) { if (b < X) continue; if (a > X) break; X = b + 1; }
        if (X <= xmax) { if (!best || Y < best.Y || (Y === best.Y && X < best.X)) best = { Y, X, v }; break; }
      }
    }
    if (!best) { failed.push(it.p.id); continue; }
    const m = best.v.m; for (let j = 0; j < m.h; j++) { const r = best.Y + j; occ[r] = mergeIv(occ[r].concat(m.rows[j].map(([a, b]) => [a + best.X, b + best.X]))); }
    used += m.area;
    placed.push({ id: it.p.id, ang: best.v.a, tx: sheet.x0 + best.X * cell - m.ox, ty: sheet.y0 + best.Y * cell - m.oy });
  }
  return { placed, failed, usage: used / Math.max(1, Gw * Gh) };
}

