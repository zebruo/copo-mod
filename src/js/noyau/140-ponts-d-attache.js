// ---------- PONTS D'ATTACHE ----------
function placeTabs(loop, n) {
  const P = loop.concat([loop[0]]), c = cumLen(P), per = c[c.length - 1], out = []; if (per < 1e-6) return out;
  for (let k = 0; k < n; k++) {
    const s = per * (k + 0.5) / n; let i = 1; while (i < c.length - 1 && c[i] < s) i++;
    const a = P[i - 1], b = P[i], t = (s - c[i - 1]) / ((c[i] - c[i - 1]) || 1);
    out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, a: Math.atan2(b[1] - a[1], b[0] - a[0]) });
  }
  return out;
}
function projectOnLoops(loops, q) {
  let best = null;
  for (const l of loops) { const n = l.length; for (let i = 0; i < n; i++) { const a = l[i], b = l[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; if (L2 < 1e-12) continue; let t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t)); const x = a[0] + dx * t, y = a[1] + dy * t, d = Math.hypot(q[0] - x, q[1] - y); if (!best || d < best.d) best = { x, y, a: Math.atan2(dy, dx), d }; } }
  return best;
}
// relève les passes sous le dessus des ponts : forme plate (marche) ou triangulaire (rampe)
function applyTabs(mv, tabs, rad, zBot, tabH, tri, plungeF) {
  if (!tabs.length || !(tabH > 0)) return mv;
  const zTop = zBot + tabH, lim = (x, y) => { let z = -Infinity; for (const c of tabs) { const d = Math.hypot(x - c.x, y - c.y); if (d < rad) z = Math.max(z, zBot + (tri ? tabH * (1 - d / rad) : tabH)); } return z; };
  const out = []; let prev = null;
  for (const m of mv) {
    if (m.g !== 1 || !prev || Math.min(prev.z, m.z) >= zTop - 1e-9) { out.push(m); prev = m; continue; }
    const dx = m.x - prev.x, dy = m.y - prev.y, L2 = dx * dx + dy * dy, ts = [];
    if (L2 > 1e-12) for (const c of tabs) {
      const fx = prev.x - c.x, fy = prev.y - c.y, bq = 2 * (fx * dx + fy * dy), cq = fx * fx + fy * fy - rad * rad, D = bq * bq - 4 * L2 * cq; if (D <= 0) continue;
      const sq = Math.sqrt(D), t1 = (-bq - sq) / (2 * L2), t2 = (-bq + sq) / (2 * L2);
      for (const t of [t1, t2]) if (t > 1e-9 && t < 1 - 1e-9) ts.push(t);
      if (tri) { const n = Math.ceil(Math.sqrt(L2) / 0.5); for (let k = 1; k < n; k++) { const t = k / n, X = prev.x + dx * t, Y = prev.y + dy * t; if (Math.hypot(X - c.x, Y - c.y) < rad) ts.push(t); } }
    }
    ts.sort((a, b) => a - b);
    const Z = t => { const X = prev.x + dx * t, Y = prev.y + dy * t, zc = prev.z + (m.z - prev.z) * t; return Math.max(zc, lim(X, Y)); };
    let lastZ = Z(0);
    for (const t of ts) {
      const X = prev.x + dx * t, Y = prev.y + dy * t, z0 = Z(Math.max(0, t - 1e-7)), z1 = Z(Math.min(1, t + 1e-7));
      out.push({ g: 1, x: X, y: Y, z: z0, f: z0 < lastZ - 1e-9 ? plungeF : m.f });
      if (Math.abs(z1 - z0) > 1e-6) out.push({ g: 1, x: X, y: Y, z: z1, f: z1 < z0 ? plungeF : m.f });
      lastZ = z1;
    }
    const zf = Z(1); out.push({ ...m, z: zf, f: zf < lastZ - 1e-6 && ts.length ? m.f : m.f });
    prev = m;
  }
  return out;
}

