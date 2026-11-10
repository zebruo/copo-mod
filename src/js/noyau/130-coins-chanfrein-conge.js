// ---------- coins (chanfrein / congé) ----------
function cornerTh(pts, closed, i) {
  const n = pts.length; if (!closed && (i === 0 || i === n - 1)) return Math.PI;
  const P = pts[(i - 1 + n) % n], V = pts[i], N = pts[(i + 1) % n];
  const a = sub(P, V), b = sub(N, V), la = Math.hypot(...a), lb = Math.hypot(...b); if (la < 1e-6 || lb < 1e-6) return Math.PI;
  return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (la * lb))));
}
function cornerPts(pts, i, kind, val, frac) {
  const n = pts.length, P = pts[(i - 1 + n) % n], V = pts[i], N = pts[(i + 1) % n];
  const a = sub(P, V), b = sub(N, V), la = Math.hypot(...a), lb = Math.hypot(...b);
  const u1 = [a[0] / la, a[1] / la], u2 = [b[0] / lb, b[1] / lb];
  const th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))), lim = Math.min(la, lb) * frac;
  if (!(val > 0) || th > Math.PI * 0.97) return [V];
  if (kind === 'chamfer') { const d = Math.min(val, lim); return [[V[0] + u1[0] * d, V[1] + u1[1] * d], [V[0] + u2[0] * d, V[1] + u2[1] * d]]; }
  let t = val / Math.tan(th / 2), r = val; if (t > lim) { t = lim; r = t * Math.tan(th / 2); }
  const T1 = [V[0] + u1[0] * t, V[1] + u1[1] * t], T2 = [V[0] + u2[0] * t, V[1] + u2[1] * t];
  const bis = nrm([u1[0] + u2[0], u1[1] + u2[1]]), dc = r / Math.sin(th / 2), C = [V[0] + bis[0] * dc, V[1] + bis[1] * dc];
  return [T1, ...arcPts(C, r, Math.atan2(T1[1] - C[1], T1[0] - C[0]), Math.atan2(T2[1] - C[1], T2[0] - C[0]))];
}
const isSharp = (pts, closed, i) => cornerTh(pts, closed, i) < Math.PI * 0.94;
function cornerAll(shape, kind, val) { const o = []; shape.pts.forEach((V, i) => { if (isSharp(shape.pts, shape.closed, i)) o.push(...cornerPts(shape.pts, i, kind, val, 0.5)); else o.push(V); }); return dedupe(o, shape.closed); }

