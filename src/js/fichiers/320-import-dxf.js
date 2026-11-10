// ---------- import DXF ----------
function dxfPairs(text) {
  const L = text.split(/\r?\n/), out = [];
  for (let i = 0; i + 1 < L.length; i += 2) { const c = parseInt(L[i].trim(), 10); if (isNaN(c)) { i--; continue; } out.push([c, L[i + 1].replace(/\s+$/, '')]); }
  return out;
}
function dxfParse(text) {
  if (/^AutoCAD Binary DXF/.test(text)) throw new Error('DXF binaire non pris en charge : réenregistrez-le en DXF ASCII (texte).');
  const P = dxfPairs(text), hdr = {}, blocks = {}, ents = [];
  let sec = null, i = 0, cur = null, blk = null, var_ = null, list = ents;
  const flush = () => { if (cur) { (blk ? blk.ents : list).push(cur); cur = null; } };
  for (; i < P.length; i++) {
    const [c, v] = P[i];
    if (c === 0 && v === 'SECTION') { flush(); const n = P[i + 1]; sec = n && n[0] === 2 ? n[1] : null; i++; continue; }
    if (c === 0 && v === 'ENDSEC') { flush(); sec = null; continue; }
    if (sec === 'HEADER') { if (c === 9) var_ = v; else if (var_ && hdr[var_] === undefined) hdr[var_] = v; continue; }
    if (sec === 'BLOCKS') {
      if (c === 0 && v === 'BLOCK') { flush(); blk = { name: '', bx: 0, by: 0, ents: [], head: true }; continue; }
      if (c === 0 && v === 'ENDBLK') { flush(); if (blk) blocks[blk.name] = blk; blk = null; continue; }
      if (blk && blk.head) { if (c === 0) blk.head = false; else { if (c === 2) blk.name = v; if (c === 10) blk.bx = +v; if (c === 20) blk.by = +v; continue; } }
    }
    if (sec !== 'ENTITIES' && !(sec === 'BLOCKS' && blk)) continue;
    if (c === 0) { flush(); cur = { type: v, g: [] }; continue; }
    if (cur) cur.g.push([c, v]);
  }
  flush();
  return { hdr, blocks, ents };
}
const dxfGet = (e, c, d) => { const p = e.g.find(x => x[0] === c); return p ? (isNaN(+p[1]) ? p[1] : +p[1]) : d; };
const dxfAll = (e, c) => e.g.filter(x => x[0] === c).map(x => +x[1]);
// arc de cercle unité transformé par une matrice affine (a,b,c,d,e,f) : x' = a x + c y + e ; y' = b x + d y + f
function dxfArcNodes(cx, cy, r, a0, sweep, M) { return arcNodes([cx, cy], r, a0, sweep).map(n => dxfTN(n, M)); }
function dxfTN(n, M) { const x = M[0] * n.x + M[2] * n.y + M[4], y = M[1] * n.x + M[3] * n.y + M[5], tv = h => h ? [M[0] * h[0] + M[2] * h[1], M[1] * h[0] + M[3] * h[1]] : null; return NODE(x, y, tv(n.i), tv(n.o), n.sm); }
const dxfMul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
// ajoute un tronçon (liste de nœuds) à une suite en fusionnant le point commun
function dxfAppend(path, seg) { if (!seg.length) return; if (!path.length) { path.push(...seg); return; } const t = path[path.length - 1]; t.o = seg[0].o; for (let k = 1; k < seg.length; k++) path.push(seg[k]); }
function dxfBulgeSeg(p1, p2, b, M) {
  if (!b || Math.abs(b) < 1e-9) return [dxfTN(NODE(p1[0], p1[1]), M), dxfTN(NODE(p2[0], p2[1]), M)];
  const vx = p2[0] - p1[0], vy = p2[1] - p1[1], L = Math.hypot(vx, vy); if (L < 1e-12) return [dxfTN(NODE(p1[0], p1[1]), M)];
  const k = (1 - b * b) / (4 * b), cx = (p1[0] + p2[0]) / 2 - vy * k, cy = (p1[1] + p2[1]) / 2 + vx * k, r = Math.hypot(p1[0] - cx, p1[1] - cy);
  const nodes = dxfArcNodes(cx, cy, r, Math.atan2(p1[1] - cy, p1[0] - cx), 4 * Math.atan(b), M);
  nodes[0].sm = false; nodes[nodes.length - 1].sm = false; return nodes;
}
function dxfPoly(verts, closed, M) {
  const path = []; const n = verts.length; if (n < 2) return null;
  for (let k = 0; k < (closed ? n : n - 1); k++) { const a = verts[k], b = verts[(k + 1) % n]; dxfAppend(path, dxfBulgeSeg([a.x, a.y], [b.x, b.y], a.b, M)); }
  if (closed && path.length > 2) { const f = path[0], l = path[path.length - 1]; if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) { f.i = l.i; path.pop(); } }
  return { nodes: path, closed: closed && path.length > 2 };
}
function dxfSpline(e, M) {
  const deg = dxfGet(e, 71, 3), kn = dxfAll(e, 40), xs = dxfAll(e, 10), ys = dxfAll(e, 20), ws = dxfAll(e, 41), closed = !!(dxfGet(e, 70, 0) & 1);
  let pts = [];
  if (xs.length > deg && kn.length >= xs.length + deg + 1) {
    const cp = xs.map((x, k) => [x, ys[k] || 0, ws[k] || 1]), n = cp.length, lo = kn[deg], hi = kn[n], N = Math.max(24, n * 12);
    const ev = t => { let s = deg; while (s < n - 1 && t >= kn[s + 1]) s++; const d = []; for (let j = 0; j <= deg; j++) { const q = cp[s - deg + j]; d.push([q[0] * q[2], q[1] * q[2], q[2]]); }
      for (let r = 1; r <= deg; r++) for (let j = deg; j >= r; j--) { const ii = s - deg + j, den = kn[ii + deg - r + 1] - kn[ii], a = den ? (t - kn[ii]) / den : 0; d[j] = [0, 1, 2].map(m => (1 - a) * d[j - 1][m] + a * d[j][m]); }
      return [d[deg][0] / d[deg][2], d[deg][1] / d[deg][2]]; };
    for (let k = 0; k <= N; k++) pts.push(ev(lo + (hi - lo) * Math.min(k / N, 1 - 1e-12)));
    pts[pts.length - 1] = ev(hi - 1e-9 * (hi - lo));
  } else { const fx = dxfAll(e, 11), fy = dxfAll(e, 21); pts = (fx.length ? fx : xs).map((x, k) => [x, (fx.length ? fy : ys)[k] || 0]); }
  if (pts.length < 2) return null;
  const simp = pts.filter((p, k) => k === 0 || Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) > 1e-6);
  let isClosed = closed || (simp.length > 2 && Math.hypot(simp[0][0] - simp[simp.length - 1][0], simp[0][1] - simp[simp.length - 1][1]) < 1e-6);
  if (isClosed && simp.length > 2 && Math.hypot(simp[0][0] - simp[simp.length - 1][0], simp[0][1] - simp[simp.length - 1][1]) < 1e-6) simp.pop();
  return { nodes: simp.map(p => dxfTN(NODE(p[0], p[1]), M)), closed: isClosed && simp.length > 2 };
}
function dxfEntity(e, M, D, out, depth) {
  const ocs = dxfGet(e, 230, 1) < 0, Mo = ocs ? dxfMul(M, [-1, 0, 0, 1, 0, 0]) : M, push = (r, kind) => { if (r && r.nodes.length > 1) out.push({ ...r, layer: String(dxfGet(e, 8, '0')) }); else if (kind) D.skip[kind] = (D.skip[kind] || 0) + 1; };
  switch (e.type) {
    case 'LINE': push({ nodes: [dxfTN(NODE(dxfGet(e, 10, 0), dxfGet(e, 20, 0)), M), dxfTN(NODE(dxfGet(e, 11, 0), dxfGet(e, 21, 0)), M)], closed: false }); break;
    case 'CIRCLE': { const ns = dxfArcNodes(dxfGet(e, 10, 0), dxfGet(e, 20, 0), dxfGet(e, 40, 0), 0, 2 * Math.PI, Mo); const l = ns.pop(); ns[0].i = l.i; ns.forEach(n => n.sm = true); push({ nodes: ns, closed: true }); break; }
    case 'ARC': { let a0 = dxfGet(e, 50, 0), a1 = dxfGet(e, 51, 360); let sw = a1 - a0; while (sw <= 0) sw += 360; push({ nodes: dxfArcNodes(dxfGet(e, 10, 0), dxfGet(e, 20, 0), dxfGet(e, 40, 0), a0 * Math.PI / 180, sw * Math.PI / 180, Mo), closed: false }); break; }
    case 'ELLIPSE': {
      const cx = dxfGet(e, 10, 0), cy = dxfGet(e, 20, 0), mx = dxfGet(e, 11, 1), my = dxfGet(e, 21, 0), ra = dxfGet(e, 40, 1), t0 = dxfGet(e, 41, 0), t1 = dxfGet(e, 42, 2 * Math.PI);
      const ext = dxfGet(e, 230, 1) < 0 ? -1 : 1, E = [mx, my, -my * ra * ext, mx * ra * ext, cx, cy];
      let sw = t1 - t0; while (sw <= 1e-9) sw += 2 * Math.PI; const full = Math.abs(sw - 2 * Math.PI) < 1e-6, ns = dxfArcNodes(0, 0, 1, t0, sw, dxfMul(M, E));
      if (full) { const l = ns.pop(); ns[0].i = l.i; ns.forEach(n => n.sm = true); } push({ nodes: ns, closed: full }); break;
    }
    case 'LWPOLYLINE': { const xs = dxfAll(e, 10), verts = []; let v = null; for (const [c, val] of e.g) { if (c === 10) { v = { x: +val, y: 0, b: 0 }; verts.push(v); } else if (v && c === 20) v.y = +val; else if (v && c === 42) v.b = +val; } if (xs.length) push(dxfPoly(verts, !!(dxfGet(e, 70, 0) & 1), Mo)); break; }
    case 'POLYLINE': { const fl = dxfGet(e, 70, 0); if (fl & (16 | 64)) { D.skip['POLYLINE 3D'] = (D.skip['POLYLINE 3D'] || 0) + 1; break; } push(dxfPoly(e.verts || [], !!(fl & 1), (fl & 8) ? M : Mo)); break; }
    case 'SPLINE': push(dxfSpline(e, M), 'SPLINE'); break;
    case 'INSERT': {
      const b = D.blocks[dxfGet(e, 2, '')]; if (!b || depth > 8) break;
      const sx = dxfGet(e, 41, 1), sy = dxfGet(e, 42, 1), r = dxfGet(e, 50, 0) * Math.PI / 180, co = Math.cos(r), si = Math.sin(r), ix = dxfGet(e, 10, 0), iy = dxfGet(e, 20, 0);
      const nc = Math.max(1, dxfGet(e, 70, 1)), nr = Math.max(1, dxfGet(e, 71, 1)), dc = dxfGet(e, 44, 0), dr = dxfGet(e, 45, 0);
      for (let ci = 0; ci < nc; ci++) for (let ri = 0; ri < nr; ri++) {
        const ox = ix + co * ci * dc - si * ri * dr, oy = iy + si * ci * dc + co * ri * dr;
        let T = [co * sx, si * sx, -si * sy, co * sy, ox, oy]; T = dxfMul(T, [1, 0, 0, 1, -b.bx, -b.by]); if (ocs) T = dxfMul([-1, 0, 0, 1, 0, 0], T);
        for (const be of b.ents) dxfEntity(be, dxfMul(M, T), D, out, depth + 1);
      }
      break;
    }
    default: if (!['VERTEX', 'SEQEND', 'ATTRIB', 'ATTDEF', 'VIEWPORT'].includes(e.type)) D.skip[e.type] = (D.skip[e.type] || 0) + 1;
  }
}
// regroupe les POLYLINE et leurs VERTEX
function dxfGroupPolylines(list) {
  const out = []; let pl = null;
  for (const e of list) {
    if (e.type === 'POLYLINE') { pl = e; pl.verts = []; out.push(e); continue; }
    if (e.type === 'VERTEX' && pl) { if (!(dxfGet(e, 70, 0) & 16)) pl.verts.push({ x: dxfGet(e, 10, 0), y: dxfGet(e, 20, 0), b: dxfGet(e, 42, 0) }); continue; }
    if (e.type === 'SEQEND') { pl = null; continue; }
    out.push(e);
  }
  return out;
}
// relie bout à bout les tracés ouverts dont les extrémités coïncident
function dxfChain(items, tol) {
  const open = items.filter(it => !it.closed), done = items.filter(it => it.closed), used = new Uint8Array(open.length), grid = new Map(), key = (x, y) => Math.round(x / tol) + ',' + Math.round(y / tol);
  const ends = it => [it.nodes[0], it.nodes[it.nodes.length - 1]];
  open.forEach((it, k) => { for (const n of ends(it)) { const kk = key(n.x, n.y); (grid.get(kk) || grid.set(kk, []).get(kk)).push(k); } });
  const find = (n, layer) => { const gx = Math.round(n.x / tol), gy = Math.round(n.y / tol); let best = -1, bd = tol;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const k of grid.get((gx + a) + ',' + (gy + b)) || []) { if (used[k] || open[k].layer !== layer) continue; for (const m of ends(open[k])) { const d = Math.hypot(m.x - n.x, m.y - n.y); if (d <= bd) { bd = d; best = k; } } }
    return best; };
  for (let k = 0; k < open.length; k++) {
    if (used[k]) continue; used[k] = 1; let ch = open[k].nodes.map(cloneNode); const layer = open[k].layer;
    for (let side = 0; side < 2; side++) {
      for (;;) {
        if (ch.length > 2 && Math.hypot(ch[0].x - ch[ch.length - 1].x, ch[0].y - ch[ch.length - 1].y) <= tol) break;
        const tip = side ? ch[0] : ch[ch.length - 1], j = find(tip, layer); if (j < 0) break; used[j] = 1;
        let add = open[j].nodes.map(cloneNode); const a0 = add[0];
        if (side === 0) { if (Math.hypot(a0.x - tip.x, a0.y - tip.y) > tol) add = reverseNodes(add); tip.o = add[0].o; tip.sm = false; ch = ch.concat(add.slice(1)); }
        else { if (Math.hypot(add[add.length - 1].x - tip.x, add[add.length - 1].y - tip.y) > tol) add = reverseNodes(add); tip.i = add[add.length - 1].i; ch = add.slice(0, -1).concat(ch); }
      }
    }
    const f = ch[0], l = ch[ch.length - 1]; let closed = false;
    if (ch.length > 2 && Math.hypot(f.x - l.x, f.y - l.y) <= tol) { f.i = l.i; ch.pop(); closed = true; }
    done.push({ nodes: ch, closed, layer });
  }
  return done;
}
function importDXF(text) {
  const D = dxfParse(text); D.skip = {};
  const units = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 8: 0.0254, 9: 0.0000254, 10: 914.4 }, iu = parseInt(D.hdr.$INSUNITS, 10), k = units[iu] || 1;
  for (const b of Object.values(D.blocks)) b.ents = dxfGroupPolylines(b.ents);
  const raw = []; for (const e of dxfGroupPolylines(D.ents)) dxfEntity(e, [k, 0, 0, k, 0, 0], D, raw, 0);
  if (!raw.length) { const sk = Object.entries(D.skip).map(([k, v]) => v + ' ' + k).join(', '); throw new Error(tr('Aucun vecteur 2D trouvé dans ce DXF.') + (sk ? ' ' + tr('Éléments non pris en charge') + ' : ' + sk + '.' : '')); }
  const items = dxfChain(raw, 0.01);
  // calques DXF → calques COPO (si le fichier en a plusieurs)
  const names = [...new Set(items.map(it => it.layer))], lmap = {};
  if (names.length > 1) { const pal = ['#161616', '#c0392b', '#1f6fe0', '#12935a', '#9b3ad1', '#d35400', '#00838f', '#7f8c8d'];
    for (const n of names) { let l = S.layers.find(x => x.name === 'DXF · ' + n); if (!l) { l = { id: uid(), name: 'DXF · ' + n, visible: true, locked: false, color: pal[S.layers.length % pal.length] }; S.layers.push(l); } lmap[n] = l.id; } }
  const shapes = items.map(it => ({ nodes: it.nodes, closed: it.closed, layer: lmap[it.layer] })).filter(s => s.nodes.length > 1);
  shapes.forEach(s => refresh(s));
  const bb = bbox(shapes), st = S.stock, fits = bb.w <= st.w && bb.h <= st.h;
  const dx = fits ? (st.w - bb.w) / 2 - bb.x0 : -bb.x0, dy = fits ? (st.h - bb.h) / 2 - bb.y0 : -bb.y0, g = shapes.length > 1 ? uid() : null;
  S.sel.clear(); let n = 0, nc = 0;
  for (const s of shapes) { transformShape(s, q => [q[0] + dx, q[1] + dy]); const m = mkShape(s.nodes, s.closed, { g, layer: s.layer }); if (m) { S.sel.add(m.id); n++; if (m.closed) nc++; } }
  if (names.length > 1) renderLayers();
  return { n, nc, unit: { 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' }[iu] || null, skip: D.skip, w: bb.w, h: bb.h, layers: names.length };
}

