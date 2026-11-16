// ---------- PERÇAGE ----------
// un trou au centre de chaque forme fermée ; débourrage écrit en G0/G1 (GRBL n'a pas de G83) ; chaque trou porte m.cy pour les cycles G81/G83
function buildDrill(p, tool, shapes, M) {
  const depth = +p.depth; if (!(depth > 0)) throw new Error('Indiquez une profondeur.');
  const holes = shapes.filter(s => s.closed && s.pts.length > 2).map(s => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of s.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } return { c: [(x0 + x1) / 2, (y0 + y1) / 2], d: Math.max(x1 - x0, y1 - y0) }; });
  if (!holes.length) throw new Error('Sélectionnez des cercles ou des formes fermées : chaque trou est percé en leur centre.');
  const peck = +p.peck > 0 ? +p.peck : depth, dwell = Math.max(0, +p.dwell || 0), up = Math.max(0.5, Math.min(M.clearZ, 2)), warns = [];
  const mb = new MB(M);
  const R = tool.dia / 2, climb = p.dir !== 'conv', stepH = tool.dia * Math.max(0.05, 1 - (+tool.over || 0) / 100); let nHel = 0;
  const helOK = h => p.helixHoles !== false && tool.type === 'flat' && h.d > tool.dia * 1.05;
  for (const h of orderNN(holes, o => o.c)) {
    const [x, y] = h.c;
    if (helOK(h)) {
      nHel++; const rF = h.d / 2 - R, radii = []; for (let r = rF; r > 1e-6; r -= stepH) radii.unshift(r); if (radii[0] > R * 0.9) radii.unshift(Math.min(R * 0.5, radii[0] / 2));
      const sg = climb ? 1 : -1;
      for (const r of radii) {
        mb.approach(x + r, y, 0, tool.plunge); const pitch = helixPitchOf(p, r), turns = Math.max(1, Math.ceil(depth / pitch)), n = turns * 36;
        for (let i = 1; i <= n; i++) { const a = sg * 2 * Math.PI * i / 36; mb.g1(x + r * Math.cos(a), y + r * Math.sin(a), -depth * i / n, tool.feed); }
        for (let i = 1; i <= 36; i++) { const a = sg * 2 * Math.PI * i / 36; mb.g1(x + r * Math.cos(a), y + r * Math.sin(a), -depth, tool.feed); }
        mb.g1(x + r * 0.5, y, -depth, tool.feed);
      }
      mb.up(M.clearZ); continue;
    }
    const s0 = mb.m.length; mb.approach(x, y, 0, tool.plunge); let cur = 0;
    while (cur > -depth + 1e-9) {
      const nz = Math.max(-depth, cur - peck);
      if (cur < 0) mb.g0(x, y, cur + 0.5);
      mb.g1(x, y, nz, tool.plunge); cur = nz;
      if (cur > -depth + 1e-9) mb.g0(x, y, up);
    }
    if (dwell > 0) mb.m.push({ g: 4, x, y, z: mb.z, p: dwell });
    mb.up(M.clearZ);
    // cycle : G81 simple, G82 avec temporisation, G83 avec débourrage (G83 n'a pas de temporisation : ce cas reste écrit en G0/G1)
    if (!(+p.peck > 0 && dwell > 0)) { const cy = { x, y, zb: -depth, r: up, q: +p.peck > 0 ? +p.peck : 0, p: dwell, f: tool.plunge }; for (let i = s0; i < mb.m.length; i++) mb.m[i].cy = cy; }
  }
  mb.up(M.safeZ);
  const big = holes.filter(h => h.d > tool.dia * 1.05 && !helOK(h)).length, small = holes.filter(h => h.d < tool.dia * 0.95).length;
  if (big && tool.type === 'flat') warns.push(trf('{n} trou(s) plus grand(s) que la fraise : percé(s) à Ø{d} au lieu du diamètre dessiné (cochez l’usinage en hélice).', { n: big, d: String(+(+tool.dia).toFixed(3)).replace('.', ',') }));
  if (small) warns.push(trf('{n} trou(s) dessiné(s) plus petit(s) que l’outil : ils sortent au diamètre de l’outil. Prenez un foret ou une fraise plus fine.', { n: small }));
  return { moves: mb.m, warns, holes: holes.map(h => h.c), info: holes.length + ' trou' + (holes.length > 1 ? 's' : '') + (nHel ? ' · ' + nHel + ' en hélice' : '') + (+p.peck > 0 ? ' · débourrage ' + String(+p.peck).replace('.', ',') + ' mm' : '') };
}

