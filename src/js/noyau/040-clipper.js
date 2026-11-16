// ---------- Clipper ----------
const toCP = pts => pts.map(p => ({ X: Math.round(p[0] * SC), Y: Math.round(p[1] * SC) }));
const fromCP = path => path.map(q => [q.X / SC, q.Y / SC]);
function cUnion(paths) { const c = new ClipperLib.Clipper(); c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true); const s = []; c.Execute(ClipperLib.ClipType.ctUnion, s, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd); return s; }
function cOffsetJ(paths, d, sharp, endType) { if (!paths.length) return []; const co = new ClipperLib.ClipperOffset(4, 0.01 * SC); co.AddPaths(paths, sharp ? ClipperLib.JoinType.jtMiter : ClipperLib.JoinType.jtRound, endType || ClipperLib.EndType.etClosedPolygon); const s = []; co.Execute(s, d * SC); return s; }
function cOffset(paths, d) { if (!paths.length) return []; const co = new ClipperLib.ClipperOffset(2, 0.01 * SC); co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon); const s = []; co.Execute(s, d * SC); return s; }
const loopsOf = cp => cp.map(fromCP).filter(l => l.length > 2 && Math.abs(area(l)) > 1e-4);
function baseLoops(shapes) { const cl = shapes.filter(s => s.closed && s.pts.length > 2); if (!cl.length) return []; return loopsOf(cUnion(cl.map(s => toCP(s.pts)))); }
function offLoops(loops, d) { return loopsOf(cOffset(loops.map(toCP), d)); }
function comps(loops) {
  const outers = loops.filter(l => area(l) > 0).map(l => ({ outer: l, holes: [], a: area(l) }));
  for (const h of loops.filter(l => area(l) < 0)) { let best = null; for (const o of outers) if (pip(h[0], o.outer) && (!best || o.a < best.a)) best = o; if (best) best.holes.push(h); }
  return outers;
}

