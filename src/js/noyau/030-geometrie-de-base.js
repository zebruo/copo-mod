// ---------- géométrie de base ----------
const SC = 1000; // mm -> unités entières Clipper (1 µm)
const hyp = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const nrm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
function area(p) { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const q = p[i], r = p[(i + 1) % n]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
function centroid(p) { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }
function pip(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
// test point-dans-boucles rapide pour de nombreux points : arêtes rangées par bandes horizontales
function pipIndex(loops) { let y0 = Infinity, y1 = -Infinity, ne = 0; for (const l of loops) { ne += l.length; for (const q of l) { if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; } }
  const nb = Math.max(16, Math.min(4096, Math.round(Math.sqrt(ne) * 2))), bh = Math.max(1e-9, (y1 - y0) / nb), B = Array.from({ length: nb }, () => []);
  for (const l of loops) for (let i = 0, j = l.length - 1; i < l.length; j = i++) { const a = l[i], b = l[j], lo = Math.max(0, Math.floor((Math.min(a[1], b[1]) - y0) / bh)), hi = Math.min(nb - 1, Math.floor((Math.max(a[1], b[1]) - y0) / bh)); for (let k = lo; k <= hi; k++) B[k].push(a[0], a[1], b[0], b[1]); }
  return (x, y) => { if (y < y0 || y > y1) return false; const E = B[Math.min(nb - 1, Math.floor((y - y0) / bh))]; let c = false; for (let i = 0; i < E.length; i += 4) { const ay = E[i + 1], by = E[i + 3]; if ((ay > y) !== (by > y) && x < (E[i + 2] - E[i]) * (y - ay) / (by - ay) + E[i]) c = !c; } return c; }; }
function pipSet(pt, loops) { let c = false; for (const l of loops) if (pip(pt, l)) c = !c; return c; }
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function dedupe(pts, closed) { const o = []; for (const p of pts) { if (!o.length || hyp(o[o.length - 1], p) > 1e-4) o.push(p); } if (closed && o.length > 2 && hyp(o[0], o[o.length - 1]) < 1e-4) o.pop(); return o; }
function arcPts(C, r, a0, a1) { let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const n = Math.max(2, Math.ceil(Math.abs(d) / (Math.PI / 36))); const o = []; for (let i = 1; i <= n; i++) { const a = a0 + d * i / n; o.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]); } return o; }

