// ---------- ARCS G2/G3 ----------
function circ3(a, b, c) { const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-12) return null; const A = a[0] * a[0] + a[1] * a[1], B = b[0] * b[0] + b[1] * b[1], C = c[0] * c[0] + c[1] * c[1]; const x = (A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d, y = (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d; return { x, y, r: Math.hypot(a[0] - x, a[1] - y) }; }
function arcFit(pts, tol) {
  const k = pts.length - 1, c = circ3(pts[0], pts[k >> 1], pts[k]); if (!c || c.r > 2000 || c.r < 0.05) return null;
  let sweep = 0, sg = 0;
  for (let i = 0; i <= k; i++) {
    if (Math.abs(Math.hypot(pts[i][0] - c.x, pts[i][1] - c.y) - c.r) > tol) return null;
    if (i) { let d = Math.atan2(pts[i][1] - c.y, pts[i][0] - c.x) - Math.atan2(pts[i - 1][1] - c.y, pts[i - 1][0] - c.x); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; if (Math.abs(d) > 0.45 || Math.abs(d) < 1e-9) return null; const s = Math.sign(d); if (sg && s !== sg) return null; sg = s; sweep += d; }
    if (i > 0 && i < k) { const mx = (pts[i - 1][0] + pts[i][0]) / 2, my = (pts[i - 1][1] + pts[i][1]) / 2; if (Math.abs(Math.hypot(mx - c.x, my - c.y) - c.r) > tol * 3) return null; }
  }
  if (Math.abs(sweep) > 5.9) return null;
  if (pts[0].length > 2 && Math.abs(pts[k][2] - pts[0][2]) > 1e-9) { let cum = 0; for (let i = 1; i <= k; i++) { let d = Math.atan2(pts[i][1] - c.y, pts[i][0] - c.x) - Math.atan2(pts[i - 1][1] - c.y, pts[i - 1][0] - c.x); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; cum += d; if (Math.abs(pts[i][2] - (pts[0][2] + (pts[k][2] - pts[0][2]) * cum / sweep)) > 0.005) return null; } }
  return { cx: c.x, cy: c.y, dir: sweep > 0 ? 3 : 2 };
}
// regroupe les suites de G1 à Z et avance constants posées sur un cercle
function fitArcs(mv, tol) {
  const out = []; let i = 0;
  while (i < mv.length) {
    const m = mv[i], p = i ? mv[i - 1] : null;
    if (!p || m.g !== 1 || p.g === 4) { out.push(m); i++; continue; }
    let best = -1, bc = null, j = i;
    while (j + 1 < mv.length && mv[j + 1].g === 1 && mv[j + 1].f === m.f) {
      j++; if (j - i + 2 < 5) continue;
      const pts = [[p.x, p.y, p.z]]; for (let q = i; q <= j; q++) pts.push([mv[q].x, mv[q].y, mv[q].z]);
      const f = arcFit(pts, tol); if (f) { best = j; bc = f; } else if (best >= 0 ? j - best > 2 : j - i > 6) break;
    }
    if (best >= 0) { const e = mv[best]; out.push({ g: bc.dir, x: e.x, y: e.y, z: e.z, f: m.f, i: bc.cx - p.x, j: bc.cy - p.y }); i = best + 1; }
    else { out.push(m); i++; }
  }
  return out;
}

