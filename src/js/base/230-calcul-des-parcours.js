// ---------- calcul des parcours ----------
function flipPt(q, st) { st = st || S.stock; return st.flip === 'y' ? [st.w - q[0], q[1]] : [q[0], st.h - q[1]]; }
function computeTP(tp) {
  let vc = null;
  if (tp.vclrOf) { const par = S.tps.find(x => x.id === tp.vclrOf); if (par && par.type === 'pocket') { tp.type = 'pocket'; tp.toolId = par.p.roughTool || tp.toolId; tp.face = par.face; tp.shapeIds = (par.shapeIds || []).slice(); tp.p = { ...par.p, rest: false, restTool: '', restDia: 0, roughTool: '', pass: '', finish: +par.p.allow > 0 ? 'none' : par.p.finish }; } // ébauche de poche : la grosse fraise garde toujours la surépaisseur, la petite finit
    else if (par) { vc = vclrShapes(par); const T = vcClrTools(par.p), k = tp.clrIdx || 0, prev = k ? S.tps.find(x => x.vclrOf === par.id && (x.clrIdx || 0) === k - 1) : null; tp.toolId = (T[k] || T[0] || {}).id || tp.toolId; tp.face = par.face; tp.p = { ...tp.p, depth: Math.max(0.01, vc.maxD), vstart: +par.p.vstart || 0, dir: par.p.dir, zrel: 1, rest: !!prev, restFrom: prev ? prev.id : '' }; } }
  const tool = S.tools.find(t => t.id === tp.toolId); const shapes = vc ? vc.shapes : tp.shapeIds.map(shapeById).filter(Boolean).concat(tp.type === 'profile' ? tpRelShapes(tp) : []);
  tp.err = null; tp.warns = []; tp.moves = []; tp.info = '';
  if (vc && !shapes.length) { tp.info = tr('Pas de fond plat assez large : rien à dégager.'); tp.stats = { min: 0, cut: 0 }; tp.dmoves = null; tp.loops = null; return; }
  try {
    if (!window.ClipperLib) throw new Error('Bibliothèque de calcul absente.');
    if (!tool) throw new Error("L'outil de ce parcours n'existe plus.");
    if (!shapes.length && (tp.type !== 'relief' || tp.shapeIds.length)) throw new Error(tp.relIds && tp.relIds.length ? tr('Le relief de ce parcours a été supprimé ou n’a pas d’emprise sur le brut.') : 'Les vecteurs de ce parcours ont été supprimés.');
    const fn = { profile: buildProfile, pocket: buildPocket, vcarve: buildVcarve, drill: buildDrill, thread: buildThread, relief: buildRelief }[tp.type];
    const f2 = tp.face === 2, sh = f2 ? shapes.map(sp => ({ ...sp, pts: sp.pts.map(q => flipPt(q)) })) : shapes;
    let pp = f2 && tp.p.openSide && tp.p.openSide !== 'on' ? { ...tp.p, openSide: tp.p.openSide === 'left' ? 'right' : 'left' } : tp.p; if (f2) pp = { ...pp, f2: true };
    if (f2 && Array.isArray(pp.tabPts)) pp = { ...pp, tabPts: pp.tabPts.map(q => flipPt(q)) };
    if (!tp.p.zrel) { if (tp.type === 'vcarve' && +tp.p.vstart > 0 && +tp.p.depth > 0) tp.p.depth = Math.max(0.01, +tp.p.depth - tp.p.vstart); tp.p.zrel = 1; }
    const z0 = +tp.p.vstart || 0; if (z0) pp = { ...pp, vstart: 0, vS0: z0 }; // D > 0 : sous la surface ; D < 0 : au-dessus (passes à vide, surface irrégulière)
    if (tp.type === 'pocket' && (tp.p.rest || tp.p.roughTool)) { // reprise : d'après le parcours de départ (fraise, et surépaisseur s'il l'a laissée)
      const src = S.tps.find(t => t.id === tp.p.restFrom), rt = tp.p.roughTool && S.tools.find(t => t.id === tp.p.roughTool), st = src && S.tools.find(t => t.id === src.toolId), legacy = !src && !rt && tp.p.restTool && S.tools.find(t => t.id === tp.p.restTool);
      if (rt && (!src || src.vclrOf === tp.id)) pp = { ...pp, rest: true, restDia: rt.dia, restAllow: +tp.p.allow > 0 ? +tp.p.allow : 0 };
      else if (st) pp = { ...pp, rest: true, restDia: st.dia, restAllow: src.p.finish === 'none' ? Math.max(0, +src.p.allow || 0) : 0 };
      else if (legacy) pp = { ...pp, rest: true, restDia: legacy.dia, restAllow: 0 };
      else throw new Error(tr('Reprise : le parcours de départ n’existe plus. Choisissez-en un autre.'));
      if (src && S.tps.indexOf(src) > S.tps.indexOf(tp) && S.tps.includes(tp)) tp._restLate = 1; else tp._restLate = 0; }
    const r = fn(pp, tool, sh, S.machine);
    if (tp._restLate) r.warns = (r.warns || []).concat([tr('Reprise : le parcours de départ est placé après celui-ci dans la liste. Remontez la reprise sous lui.')]);
    if (pp.proj && ['profile', 'pocket', 'vcarve'].includes(tp.type)) { // projection sur le relief : la fraise suit la surface (contact calculé avec sa forme)
      if (f2) r.warns = (r.warns || []).concat([tr('Projection sur le relief : seulement pour la face 1.')]);
      else if (!S.relief.items.some(i => i.visible && relGrid[i.id])) r.warns = (r.warns || []).concat([tr('Projection sur le relief : aucun relief visible.')]);
      else { r.moves = projectMoves(r.moves, relProjector(tool)); r.info = (r.info ? r.info + ' · ' : '') + tr('projeté sur le relief'); tp.relVer = S.relief.ver || 0; }
    }
    if (z0 && !r.noShift) { const cz = S.machine.clearZ - 1e-9; r.moves = r.moves.map(m => typeof m.z === 'number' && m.z < cz ? { ...m, z: m.z - z0 } : m); r.info = (r.info ? r.info + ' · ' : '') + trf('départ à {d} mm', { d: LANG === 'fr' ? fr(z0, 2) : z0.toFixed(2) }); }
    tp.moves = r.moves; tp.warns = r.warns; tp.info = r.info; if (tp.type === 'relief' || (tp.relIds && tp.relIds.length)) tp.relVer = S.relief.ver || 0;
    tp.dmoves = f2 ? r.moves.map(m => { const q = flipPt([m.x, m.y]); return { ...m, x: q[0], y: q[1] }; }) : null;
    tp.loops = r.loops ? (f2 ? r.loops.map(l => l.map(q => flipPt(q))) : r.loops) : null;
    tp.holes = r.holes ? (f2 ? r.holes.map(q => flipPt(q)) : r.holes) : null;
    tp.narrow = r.narrow && r.narrow.length ? (f2 ? r.narrow.map(l => l.map(q => flipPt(q))) : r.narrow) : null;
    tp.threads = r.threads ? r.threads.map(t => ({ ...t, c: f2 ? flipPt(t.c) : t.c, sg: f2 ? -t.sg : t.sg, zS: t.zS - z0, zE: t.zE - z0, zLo: t.zLo - z0 })) : null;
    tp.tabs = r.tabs && r.tabs.length ? (f2 ? r.tabs.map(t => { const q = flipPt([t.x, t.y]); return { x: q[0], y: q[1], a: S.stock.flip === 'y' ? Math.PI - t.a : -t.a }; }) : r.tabs) : null;
    tp.stats = moveStats(tp.moves, S.machine.rapid);
    if (!(S.stock.rotary || {}).on) { const st = S.stock, e = 1e-3; if ((tp.dmoves || tp.moves).some(m => m.g === 1 && m.z < -1e-6 && (m.x < -e || m.y < -e || m.x > st.w + e || m.y > st.h + e))) tp.warns = (tp.warns || []).concat([tr('Ce parcours sort du brut : la fraise y usinerait dans le vide (la simulation ne le montre pas). Déplacez les vecteurs ou agrandissez le brut.')]); }
    if (tp.p.ilId && tp.type === 'vcarve') { const o = S.tps.find(x => x !== tp && x.type === 'vcarve' && x.p && x.p.ilId === tp.p.ilId), t2 = o && S.tools.find(x => x.id === o.toolId), sig = t => [+t.angle || 0, +t.flat || 0, +t.tipR || 0, +t.dia || 0].map(v => v.toFixed(3)).join('|');
      if (t2 && sig(t2) !== sig(tool)) tp.warns = (tp.warns || []).concat([trf('Incrustation : la femelle et le mâle doivent utiliser la même fraise conique (même angle, même bout) ; « {n} » utilise une autre fraise.', { n: o.name })]); }
  } catch (e) { tp.err = e.message || String(e); tp.stats = { min: 0, cut: 0 }; }
}
let gcDirty = true;
