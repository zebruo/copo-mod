// ---------- texte ----------
function textNodes(str, h, at, cmdsOver) {
  const f = S.font, upm = f.unitsPerEm || 1000, cap = (f.tables.os2 && f.tables.os2.sCapHeight) || upm * 0.7, size = h * upm / cap;
  const cmds = cmdsOver || f.getPath(str, 0, 0, size).commands, out = []; let cur = null;
  const P = (x, y) => [at[0] + x, at[1] - y];
  const flush = z => { if (cur) { if (z || !f.singleLine) { if (cur.length > 2) { const a = cur[0], b = cur[cur.length - 1]; if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) { a.i = b.i; cur.pop(); } out.push(cur); } } else if (cur.length >= 2) { cur.open = true; out.push(cur); } } cur = null; };
  for (const c of cmds) {
    if (c.type === 'M') { flush(false); const p = P(c.x, c.y); cur = [NODE(p[0], p[1])]; continue; }
    if (!cur) continue; const last = cur[cur.length - 1], p0 = [last.x, last.y];
    if (c.type === 'L') { const p = P(c.x, c.y); cur.push(NODE(p[0], p[1])); }
    else if (c.type === 'Q') { const q = P(c.x1, c.y1), p3 = P(c.x, c.y); last.o = [(q[0] - p0[0]) * 2 / 3, (q[1] - p0[1]) * 2 / 3]; cur.push(NODE(p3[0], p3[1], [(q[0] - p3[0]) * 2 / 3, (q[1] - p3[1]) * 2 / 3])); }
    else if (c.type === 'C') { const c1 = P(c.x1, c.y1), c2 = P(c.x2, c.y2), p3 = P(c.x, c.y); last.o = [c1[0] - p0[0], c1[1] - p0[1]]; cur.push(NODE(p3[0], p3[1], [c2[0] - p3[0], c2[1] - p3[1]])); }
    else if (c.type === 'Z') flush(true);
  }
  flush(false); return out;
}

