// ---------- FILETAGE (fraise à fileter monodent, interpolation hélicoïdale) ----------
// filet ISO à 60° : intérieur jusqu'au Ø nominal, extérieur jusqu'au Ø de fond d = D − 1,2269·P ; toujours en avalant :
// intérieur = G3 (vers le haut à droite, vers le bas à gauche), extérieur = G2 (vers le bas à droite, vers le haut à gauche)
function threadGeo(p, tool, d0) {
  const P = Math.max(0.2, +p.thPitch || 1.25), D = +p.thD > 0 ? +p.thD : d0, rt = tool.dia / 2, inner = p.thSide !== 'out';
  const D1 = D - 1.0825 * P, d3 = D - 1.2269 * P;
  return { P, D, rt, inner, D1, d3, tap: D - P, r0: inner ? D1 / 2 - rt : D / 2 + rt, rf: inner ? D / 2 - rt : d3 / 2 + rt };
}
function buildThread(p, tool, shapes, M) {
  if (!tool || tool.type !== 'thread') throw new Error('Choisissez une fraise à fileter (type « Fraise à fileter » dans la bibliothèque).');
  const depth = +p.depth; if (!(depth > 0)) throw new Error('Indiquez la longueur filetée (profondeur de coupe).');
  const holes = shapes.filter(s => s.closed && s.pts.length > 2).map(s => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of s.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } return { c: [(x0 + x1) / 2, (y0 + y1) / 2], d: Math.max(x1 - x0, y1 - y0) }; });
  if (!holes.length) throw new Error('Sélectionnez des cercles : chaque filetage est centré sur un cercle.');
  const mb = new MB(M), warns = [], n = Math.max(1, Math.min(10, Math.round(+p.thPasses || 1))), RH = p.thHand !== 'L';
  const nSeg = (R, sweep) => Math.max(Math.ceil(sweep / (Math.PI / 18)), Math.ceil(sweep / (2 * Math.acos(Math.max(-1, 1 - 0.01 / Math.max(R, 0.02))))));
  let g0 = null; const threads = [];
  for (const h of orderNN(holes, o => o.c)) {
    const G = threadGeo(p, tool, h.d); g0 = g0 || G; const [x, y] = h.c, P = G.P, sg = G.inner ? 1 : -1, up = G.inner === RH;
    if (G.inner && G.r0 < 0.05) throw new Error(trf('Fraise trop grosse : Ø{t} pour un taraudage Ø{d} au pas de {p} (perçage préalable Ø{a}).', { t: fr(tool.dia).replace(/,?0+$/, ''), d: fr(G.D).replace(/,?0+$/, ''), p: fr(P).replace(/,?0+$/, ''), a: fr(G.D1) }));
    if (!G.inner && G.rf <= G.rt + 0.05) throw new Error('Diamètre de vis trop petit pour ce pas.');
    const turns = Math.ceil(depth / P) + 1, zLo = -depth, zHi = zLo + turns * P, zS = up ? zLo : zHi, zE = up ? zHi : zLo;
    const radii = []; for (let k = 1; k <= n; k++) radii.push(G.r0 + (G.rf - G.r0) * k / n);
    const out = G.r0 + 2; // extérieur : départ à 2 mm du Ø nominal
    radii.forEach((r, ri) => {
      const fc = Math.max(10, Math.round(tool.feed * r / (G.inner ? r + G.rt : Math.max(0.1, r - G.rt)))); // avance au centre de l'outil, tranchant à l'avance de l'outil
      const zT = zS > 0 ? zS : 0;
      if (G.inner) { mb.approach(x, y, zT, tool.plunge); mb.g1(x, y, zS, tool.plunge); }
      else { mb.approach(x + out, y, zT, tool.plunge); mb.g1(x + out, y, zS, tool.plunge); }
      // entrée tangente en demi-cercle
      const rr = G.inner ? r / 2 : (out - r) / 2;
      const NL = nSeg(rr, Math.PI), N = nSeg(r, 2 * Math.PI);
      if (G.inner) for (let i = 1; i <= NL; i++) { const t = Math.PI + Math.PI * i / NL; mb.g1(x + r / 2 + rr * Math.cos(t), y + rr * Math.sin(t), zS, fc); }
      else for (let i = 1; i <= NL; i++) { const t = Math.PI * i / NL; mb.g1(x + (r + out) / 2 + rr * Math.cos(t), y + rr * Math.sin(t), zS, fc); }
      // hélice (la dernière passe porte les repères de temps de l'aperçu 3D)
      const last = ri === radii.length - 1, k = threads.length;
      for (let i = 1; i <= turns * N; i++) { const a = sg * 2 * Math.PI * i / N; mb.g1(x + r * Math.cos(a), y + r * Math.sin(a), zS + (zE - zS) * i / (turns * N), fc); if (last && i === 1) mb.m[mb.m.length - 1].thS = k + 1; if (last && i === turns * N) mb.m[mb.m.length - 1].thE = k + 1; }
      // sortie tangente
      if (G.inner) for (let i = 1; i <= NL; i++) { const t = Math.PI * i / NL; mb.g1(x + r / 2 + rr * Math.cos(t), y + rr * Math.sin(t), zE, fc); }
      else for (let i = 1; i <= NL; i++) { const t = Math.PI + Math.PI * i / NL; mb.g1(x + (r + out) / 2 + rr * Math.cos(t), y + rr * Math.sin(t), zE, fc); }
      mb.up(M.clearZ);
    });
    threads.push({ c: [x, y], inner: G.inner, D: G.D, Dm: G.inner ? G.D1 : G.d3, P, zS, zE, zLo, sg, turns });
  }
  mb.up(M.safeZ);
  if (+tool.flen > 0 && depth > +tool.flen) warns.push(trf('Risque de casse : la longueur filetée ({l} mm) dépasse la longueur utile de la fraise ({f} mm). Réduisez la longueur filetée ou prenez une fraise plus longue.', { l: fr(depth, 1), f: fr(+tool.flen, 1) }));
  if (!g0.inner) warns.push(tr('Filetage extérieur : l’outil descend à côté du cylindre et casse s’il rencontre la matière. Videz d’abord le tour de la vis (poche).'));
  const nm = (g0.D % 1 ? fr(g0.D, 1) : String(g0.D)) + ' × ' + String(+g0.P.toFixed(3)).replace('.', ',');
  return { moves: mb.m, warns, threads, info: holes.length + ' × ' + (g0.inner ? 'M' : 'vis M') + nm + (RH ? '' : ' ' + tr('à gauche')) + (g0.inner ? ' · ' + tr('perçage préalable') + ' Ø' + fr(g0.tap, 2).replace(/,?0+$/, '') : '') + (n > 1 ? ' · ' + n + ' ' + tr('passes') : '') };
}

