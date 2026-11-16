// ---------- V-CARVING (repli par décalages) ----------
function buildVcarveRings(p, tool, shapes, M) {
  if (tool.type !== 'v') throw new Error('Le V-carving demande une fraise en V.');
  const gR = coneGeom(tool), th = gR.th, vs = Math.max(0.02, +p.vstep || 0.1), warns = [];
  const flute = gR.h(gR.R0);
  let maxD = +p.depth > 0 ? +p.depth : Infinity; let flat = false;
  if (maxD > flute) maxD = flute;
  const S0 = Math.max(0, Math.min(+p.vstart || 0, maxD));
  const o = commonOpts(p, tool), fix = l => o.climb ? l : l.slice().reverse();
  const base = baseLoops(shapes); if (!base.length) throw new Error('Sélectionnez au moins une forme fermée.');
  const mb = new MB(M); let n = 0, deepest = 0;
  for (const cp of orderNN(comps(base), c => centroid(c.outer))) {
    const loops = [cp.outer, ...cp.holes];
    for (let k = S0 > 0 ? 0 : 1; k < 5000; k++) {
      const d = k * vs; if (d < gR.rho - 1e-9) continue; const r = k ? offLoops(loops, -d) : loops; if (!r.length) break;
      const zr = -Math.min(S0 + gR.h(d), maxD); if (S0 + gR.h(d) > maxD) flat = true; deepest = Math.min(deepest, zr);
      for (const l of orderNN(r.map(fix), nearestPt, mb.x === null ? [0, 0] : [mb.x, mb.y])) {
        let cont = false;
        if (mb.x !== null && mb.z <= 1e-9) { const q = nearestPt(l, [mb.x, mb.y]); cont = hyp(q, [mb.x, mb.y]) <= Math.max(3 * vs, 0.6); }
        emitLoop(mb, l, 0, zr, { ...o, entry: 'plunge' }, cont); n++;
      }
    }
  }
  if (!n) throw new Error('Formes trop fines pour ce pas : réduisez le pas entre passes.');
  if (flat && maxD === flute && !(+p.depth > 0 && +p.depth <= flute)) warns.push('Fond plat imposé par la taille de la fraise (' + flute.toFixed(1).replace('.', ',') + ' mm max).');
  mb.up(M.safeZ);
  return { moves: mb.m, warns, info: n + ' contours · prof. max ' + (-deepest).toFixed(2).replace('.', ',') + ' mm' };
}


