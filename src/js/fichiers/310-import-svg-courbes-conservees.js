// ---------- import SVG (courbes conservées) ----------
function parsePathNodes(d) {
  const s = d || '', subs = []; let i = 0, cur = null, x = 0, y = 0, sx0 = 0, sy0 = 0, cmd = null, lastC = '', lcx = 0, lcy = 0, lqx = 0, lqy = 0;
  const ws = () => { while (i < s.length && /[\s,]/.test(s[i])) i++; };
  const num = () => { ws(); const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i, i + 40)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
  const flag = () => { ws(); const ch = s[i]; if (ch !== '0' && ch !== '1') throw 0; i++; return ch === '1'; };
  const ensure = () => { if (!cur) cur = { nodes: [NODE(x, y)], closed: false }; };
  const last = () => cur.nodes[cur.nodes.length - 1];
  const line = (px, py) => { ensure(); cur.nodes.push(NODE(px, py)); };
  const cubic = (c1x, c1y, c2x, c2y, px, py) => { ensure(); const l = last(); l.o = [c1x - l.x, c1y - l.y]; cur.nodes.push(NODE(px, py, [c2x - px, c2y - py])); };
  const arc = (rx, ry, phi, fa, fs, x2, y2) => {
    if (!rx || !ry) { line(x2, y2); return; } rx = Math.abs(rx); ry = Math.abs(ry);
    const p = phi * Math.PI / 180, cp = Math.cos(p), sp = Math.sin(p), dx = (x - x2) / 2, dy = (y - y2) / 2;
    const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy; const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if (lam > 1) { const q = Math.sqrt(lam); rx *= q; ry *= q; }
    const nu = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, de = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    let co = de ? Math.sqrt(Math.max(0, nu / de)) : 0; if (fa === fs) co = -co;
    const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx, cx = cp * cxp - sp * cyp + (x + x2) / 2, cy = sp * cxp + cp * cyp + (y + y2) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry); let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
    const m = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9)), ph = dt / m, al = 4 / 3 * Math.tan(ph / 4);
    const E = t => [cx + cp * rx * Math.cos(t) - sp * ry * Math.sin(t), cy + sp * rx * Math.cos(t) + cp * ry * Math.sin(t)];
    const Ed = t => [-cp * rx * Math.sin(t) - sp * ry * Math.cos(t), -sp * rx * Math.sin(t) + cp * ry * Math.cos(t)];
    for (let k = 0; k < m; k++) { const ta = t1 + ph * k, tb = ta + ph, A = E(ta), B = E(tb), da = Ed(ta), db = Ed(tb); cubic(A[0] + al * da[0], A[1] + al * da[1], B[0] - al * db[0], B[1] - al * db[1], k === m - 1 ? x2 : B[0], k === m - 1 ? y2 : B[1]); }
  };
  try {
    while (true) {
      ws(); if (i >= s.length) break;
      if (/[a-zA-Z]/.test(s[i])) { cmd = s[i]; i++; } else if (!cmd) break;
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      if (C === 'M') { let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } if (cur && cur.nodes.length > 1) subs.push(cur); x = nx; y = ny; sx0 = x; sy0 = y; cur = { nodes: [NODE(x, y)], closed: false }; cmd = rel ? 'l' : 'L'; lastC = 'M'; continue; }
      if (C === 'Z') { if (cur) { const a = cur.nodes[0], b = last(); if (cur.nodes.length > 1 && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) { a.i = b.i; cur.nodes.pop(); } cur.closed = true; if (cur.nodes.length > 1) subs.push(cur); cur = null; } x = sx0; y = sy0; cmd = null; lastC = 'Z'; continue; }
      if (C === 'L') { let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } line(nx, ny); x = nx; y = ny; }
      else if (C === 'H') { let nx = num(); if (rel) nx += x; line(nx, y); x = nx; }
      else if (C === 'V') { let ny = num(); if (rel) ny += y; line(x, ny); y = ny; }
      else if (C === 'C') { let a = num(), b = num(), c = num(), e = num(), f = num(), g = num(); if (rel) { a += x; b += y; c += x; e += y; f += x; g += y; } cubic(a, b, c, e, f, g); lcx = c; lcy = e; x = f; y = g; }
      else if (C === 'S') { let c = num(), e = num(), f = num(), g = num(); if (rel) { c += x; e += y; f += x; g += y; } const r = lastC === 'C' || lastC === 'S'; cubic(r ? 2 * x - lcx : x, r ? 2 * y - lcy : y, c, e, f, g); lcx = c; lcy = e; x = f; y = g; }
      else if (C === 'Q') { let a = num(), b = num(), f = num(), g = num(); if (rel) { a += x; b += y; f += x; g += y; } cubic(x + (a - x) * 2 / 3, y + (b - y) * 2 / 3, f + (a - f) * 2 / 3, g + (b - g) * 2 / 3, f, g); lqx = a; lqy = b; x = f; y = g; }
      else if (C === 'T') { let f = num(), g = num(); if (rel) { f += x; g += y; } const r = lastC === 'Q' || lastC === 'T', a = r ? 2 * x - lqx : x, b = r ? 2 * y - lqy : y; cubic(x + (a - x) * 2 / 3, y + (b - y) * 2 / 3, f + (a - f) * 2 / 3, g + (b - g) * 2 / 3, f, g); lqx = a; lqy = b; x = f; y = g; }
      else if (C === 'A') { const rx = num(), ry = num(), ph = num(), fa = flag(), fs = flag(); let f = num(), g = num(); if (rel) { f += x; g += y; } ensure(); arc(rx, ry, ph, fa, fs, f, g); x = f; y = g; }
      else break;
      lastC = C;
    }
  } catch (e) { }
  if (cur && cur.nodes.length > 1) subs.push(cur);
  return subs;
}
function elementNodes(el) {
  const tag = el.tagName.toLowerCase(), A = n => parseFloat(el.getAttribute(n)) || 0;
  if (tag === 'path') return parsePathNodes(el.getAttribute('d'));
  if (tag === 'rect') { const x = A('x'), y = A('y'), w = A('width'), h = A('height'); if (w <= 0 || h <= 0) return []; const s = refresh({ nodes: rectNodes(x, y, x + w, y + h), closed: true }); const rx = Math.min(A('rx') || A('ry'), w / 2, h / 2); if (rx > 0) cornerAllNodes(s, 'fillet', rx); return [{ nodes: s.nodes, closed: true }]; }
  if (tag === 'circle') { const r = A('r'); return r > 0 ? [{ nodes: ellipseNodes([A('cx'), A('cy')], r, r), closed: true }] : []; }
  if (tag === 'ellipse') { const rx = A('rx'), ry = A('ry'); return rx > 0 && ry > 0 ? [{ nodes: ellipseNodes([A('cx'), A('cy')], rx, ry), closed: true }] : []; }
  if (tag === 'line') return [{ nodes: [NODE(A('x1'), A('y1')), NODE(A('x2'), A('y2'))], closed: false }];
  if (tag === 'polyline' || tag === 'polygon') { const v = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(parseFloat), nodes = []; for (let i = 0; i + 1 < v.length; i += 2) nodes.push(NODE(v[i], v[i + 1])); return nodes.length > 1 ? [{ nodes, closed: tag === 'polygon' }] : []; }
  return [];
}
function importSVG(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml'); const svg = doc.querySelector('svg'); if (!svg) throw new Error('Fichier SVG illisible.');
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-20000px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden';
  const node = document.importNode(svg, true);
  const vbA = (node.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(parseFloat), wA = node.getAttribute('width');
  if ((!wA || /%$/.test(wA)) && vbA.length === 4 && vbA[2] > 0) { node.setAttribute('width', vbA[2]); node.setAttribute('height', vbA[3]); }
  host.appendChild(node); document.body.appendChild(host);
  const k = 25.4 / 96, out = [];
  try {
    node.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon').forEach(el => {
      if (el.closest('defs,clipPath,mask,symbol,pattern,marker')) return;
      const m = el.getCTM(); if (!m) return;
      for (const sp of elementNodes(el)) { const s = { nodes: sp.nodes, closed: sp.closed }; transformShape(s, ([x, y]) => [(m.a * x + m.c * y + m.e) * k, -(m.b * x + m.d * y + m.f) * k]); if (s.pts.length > 1) out.push(s); }
    });
  } finally { host.remove(); }
  if (!out.length) throw new Error('Aucun vecteur trouvé dans ce SVG.');
  return placeImported(out);
}
function placeImported(out) {
  const bb = bbox(out), st = S.stock, fits = bb.w <= st.w && bb.h <= st.h;
  const dx = fits ? (st.w - bb.w) / 2 - bb.x0 : -bb.x0, dy = fits ? (st.h - bb.h) / 2 - bb.y0 : -bb.y0, g = out.length > 1 ? uid() : null;
  S.sel.clear(); for (const s of out) { transformShape(s, q => [q[0] + dx, q[1] + dy]); const n = mkShape(s.nodes, s.closed, { g }); if (n) S.sel.add(n.id); }
  return out.length;
}

