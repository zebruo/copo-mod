// ---------- incrustation en V (inlay) ----------
function ilSel() { return selShapes().filter(s => s.closed && s.pts.length > 2); }
function ilFill(selId, type, pick) { const ft = S.tools.filter(t => t.type === type), sel = $(selId); sel.innerHTML = ''; if (!ft.length) { const o = document.createElement('option'); o.value = ''; o.textContent = tr('Aucune : choisissez dans la bibliothèque'); sel.appendChild(o); } for (const t of ft) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); } if (pick && ft.some(t => t.id === pick)) sel.value = pick; }
function ilOpen() {
  const ss = ilSel(); if (!ss.length) return toast('Sélectionnez d’abord le motif à incruster (formes fermées).');
  let o = { D: 4, gap: 0.5, Sg: 1.5, name: tr('Incrustation V'), clr: false, margin: '', tp: true }; try { const q = JSON.parse(LS.get('copo.inlay') || '{}'); if (q.F != null && q.Sg == null) q.Sg = Math.max(0, q.F - (q.D || 4) + (q.gap || 0)); o = { ...o, ...q }; } catch { }
  ilFill('#ilTool', 'v', o.tool); ilClrIds = (o.clrTools || (o.clrTool ? [o.clrTool] : [])).filter(id => S.tools.some(t => t.id === id)); ilClrRender();
  $('#ilD').value = o.D; $('#ilGap').value = o.gap; $('#ilB').value = +(o.D - o.gap + o.Sg).toFixed(3); $('#ilName').value = o.name && o.name !== tr('Incrustation V') ? o.name : ''; $('#ilClr').checked = !!o.clr; $('#ilMargin').value = o.margin === '' || o.margin == null ? '' : o.margin; $('#ilTp').checked = o.tp !== false;
  $('#ilSel').textContent = trf('{n} vecteur(s) sélectionné(s) comme motif.', { n: ss.length });
  gadSec('il'); ilInfo();
}
let ilClrIds = [];
function ilClrTools() { const seen = new Set(); return ilClrIds.map(id => S.tools.find(t => t.id === id)).filter(Boolean).sort((a, b) => b.dia - a.dia).filter(t => { const k = t.dia.toFixed(3); if (seen.has(k)) return false; seen.add(k); return true; }); } // une fraise par diamètre
function ilClrRender() { const L = $('#ilClrList'); if (!L) return; const T = ilClrTools(); ilClrIds = T.map(t => t.id); L.innerHTML = ''; T.forEach((t, i) => { const li = document.createElement('li'); li.innerHTML = '<b>' + (i + 1) + '</b><span></span><button type="button" title="Retirer" aria-label="Retirer">✕</button>'; li.querySelector('span').textContent = t.name; li.querySelector('button').onclick = () => { ilClrIds = ilClrIds.filter(x => x !== t.id); ilClrRender(); ilInfo(); }; L.appendChild(li); }); }
function ilVals() { const tool = S.tools.find(t => t.id === $('#ilTool').value), D = +$('#ilD').value, gap = Math.max(0, +$('#ilGap').value || 0), Sg = (+$('#ilB').value || 0) - (D - gap), clr = $('#ilClr').checked, clrTools = ilClrTools(), clrTool = clrTools[0], mg = $('#ilMargin').value; return { tool, D, gap, Sg, S: D - gap, F: D - gap + Sg, clr, clrTool, clrTools, margin: mg === '' ? null : Math.max(0, +mg || 0), name: $('#ilName').value.trim(), tp: $('#ilTp').checked }; }
function ilCheck(v) {
  if (!v.tool) return tr('Choisissez une fraise en V.'); if (!(v.D > 0)) return tr('Indiquez la profondeur de la poche femelle.');
  if (!(v.S > 0)) return tr('Le jeu doit être plus petit que la profondeur de la poche.'); if (!(v.Sg > 0)) return tr('La hauteur du mâle (b) doit dépasser la profondeur de poche moins le jeu (a − g), pour qu’il reste un écart à raboter.');
  const cg = coneGeom(v.tool), fl = cg.h(cg.R0); if (v.D > fl + 1e-6 || v.F > fl + 1e-6) return trf('Trop profond pour cette fraise ({f} mm max).', { f: fr(fl, 1) });
  if (v.clr && !v.clrTools.length) return tr('Ajoutez au moins une fraise de dégagement.');
  return '';
}
function pickSync() { document.querySelectorAll('[data-pickof]').forEach(sp => { const sel = document.getElementById(sp.dataset.pickof), o = sel && sel.selectedOptions[0]; sp.textContent = o && o.value ? o.textContent : tr('Choisir une fraise…'); sp.closest('.toolpick').classList.toggle('bad', !(o && o.value)); }); }
function ilInfo() { pickSync(); const v = ilVals(), e = ilCheck(v), F = x => LANG === 'fr' ? fr(x, 2) : x.toFixed(2); $('#ilClrRow').hidden = !$('#ilClr').checked; const sl = $('#ilSel'); if (sl) sl.textContent = trf('{n} vecteur(s) sélectionné(s) comme motif.', { n: ilSel().length }); $('#ilInfo').textContent = e || trf('Le mâle s’enfonce de {s} mm et laisse {g} mm de jeu au fond ; il dépasse de {p} mm avant rabotage.', { s: F(v.S), g: F(v.gap), p: F(v.Sg) }); }
['#ilTool', '#ilD', '#ilGap', '#ilB', '#ilClr', '#ilMargin'].forEach(id => { const el = document.querySelector(id); if (el) { el.addEventListener('input', ilInfo); el.addEventListener('change', ilInfo); } });
function ilMake() {
  const v = ilVals(), e = ilCheck(v); if (e) return toast(e);
  try { LS.set('copo.inlay', JSON.stringify({ tool: v.tool.id, D: v.D, gap: v.gap, Sg: v.Sg, name: v.name, clr: v.clr, clrTools: v.clrTools.map(t => t.id), margin: v.margin == null ? '' : v.margin, tp: v.tp })); } catch { }
  const ss = ilSel(), cg = coneGeom(v.tool), rW = h => cg.r(h), bb = bbox(ss), margin = v.margin != null ? v.margin : Math.max(3, 2 * rW(v.Sg) + 1.5, v.clr && v.clrTools.length ? rW(v.Sg) + rW(v.F) + 1.5 : 0); // avec dégagement : assez de marge pour que la fraise en V ne grave pas le cadre du mâle
  const nf0 = { ...newForm(), type: 'vcarve', dir: 'climb', vstep: 0.1 }, face = faceOf(ss[0]) === 2 ? 2 : 1, out = [];
  const lay = (name, color, vis = true) => { let l = S.layers.find(x => x.name === name); if (l) l.visible = true; if (!l) { l = { id: uid(), name, visible: vis, locked: false, color }; S.layers.push(l); } return l; };
  const lm = lay(tr('mâle'), '#9b3ad1');
  const cx = bb.x0 + bb.w / 2, dx = bb.w + 2 * margin + 10, g = uid(), made = [];
  for (const sh of ss) { const n = mkShape(sh.nodes.map(cloneNode), true, { layer: lm.id, g }); if (!n) continue; transformShape(n, q => [2 * cx - q[0] + dx, q[1]]); made.push(n); }
  const mb = bbox(made), frame = mkShape(rectNodes(mb.x0 - margin, mb.y0 - margin, mb.x1 + margin, mb.y1 + margin), true, { layer: lm.id, g });
  // fraise à bout plat ou rond (rho > 0) : femelle et mâle usinés sur la même forme de travail R̃ = fermeture(ouverture(R)), pointes et coins arrondis au même rayon ; le dessin n'est pas modifié
  let femSh = ss, maleSh = made; const rho = cg.rho;
  if (v.tp && rho > 1e-9) { const lk = lay(tr('incrustation (calcul)'), '#999999'), rt = ipCommon(baseLoops(ss), rho), mk = L => L.map(l => mkShape(dedupe(l, true).map(q => NODE(q[0], q[1])), true, { layer: lk.id })).filter(Boolean);
    femSh = mk(rt); maleSh = mk(rt.map(l => l.map(q => [2 * cx - q[0] + dx, q[1]]))); if (!femSh.length || !maleSh.length) { femSh = ss; maleSh = made; } }
  if (v.tp) {
    const pre = v.name ? v.name.replace(/\s+/g, '-') + '_' : '', fL = pre + tpnLayer(ss.map(x => x.id)), mL = pre + lm.name.replace(/\s+/g, '-'), ck = v.clr && v.clrTools.length ? { clrTools: v.clrTools.map(t => t.id), clrTool: v.clrTools[0].id, clrExt: true } : {}; // la fraise en V ne refait pas les fonds vidés par le dégagement
    const fem = { ...(femSh !== ss ? { ownShapes: true } : {}), id: uid(), name: tpAutoName('vcarve', fL, v.tool, face), nameAuto: false, type: 'vcarve', toolId: v.tool.id, shapeIds: femSh.map(x => x.id), p: { ...nf0, depth: v.D, vstart: 0, zrel: 1, ilId: g, ilRole: 'fem', ...ck }, visible: true, face };
    const male = { ownShapes: true, id: uid(), name: tpAutoName('vcarve', mL, v.tool, 1), nameAuto: false, type: 'vcarve', toolId: v.tool.id, shapeIds: [frame.id, ...maleSh.map(x => x.id)], p: { ...nf0, depth: v.Sg, vstart: v.S, zrel: 1, ilId: g, ilRole: 'male', ...ck }, visible: true, face: 1 };
    if (v.clr && v.clrTools.length) { // fonds plats vidés d'abord : la plus grosse fraise, puis chaque suivante en reprise de la précédente
      const lc = lay(tr('dégagement'), '#7a8a99'), n = v.clrTools.length;
      const chain = (L, base, depth, vis, fc) => { const sh = L.map(l => mkShape(dedupe(l, true).map(q => NODE(q[0], q[1])), true, { layer: lc.id })).filter(Boolean); if (!sh.length) return []; let prev = null;
        return v.clrTools.map((t, i) => { const tp = { ownShapes: true, id: uid(), name: tpAutoName('clr', base, t, fc), nameAuto: false, type: 'pocket', toolId: t.id, shapeIds: sh.map(x => x.id), p: { ...newForm(), type: 'pocket', depth, vstart: 0, zrel: 1, allow: 0, dir: 'climb', ...(prev ? { rest: true, restFrom: prev.id } : {}) }, visible: vis, face: fc }; prev = tp; return tp; }); };
      const cf = chain(offLoops(baseLoops(femSh), -rW(v.D)), fL, v.D, true, face);
      // mâle : le dégagement va jusqu'au cadre (paroi droite) ; la fraise en V ne travaille qu'autour du motif, dans une bande qui finit dans la zone déjà vidée
      // mâle : le dégagement vide tout jusqu'au cadre, à la profondeur F, sauf la paroi du motif (largeur Sg × tan) que fait la fraise en V
      const cm = chain(loopsOf(cUnion([...baseLoops([frame]), ...offLoops(baseLoops(maleSh), rW(v.Sg))].map(toCP))), mL, v.F, true, 1);
      if (cm.length) { male.shapeIds = maleSh.map(x => x.id); male.p = { ...male.p, vChamfer: true }; }
      out.push(...cf, fem, ...cm, male);
      if (!cf.length && !cm.length) toast(tr('Pas de fond plat assez large pour la fraise de dégagement : seule la fraise en V travaille.'));
    } else out.push(fem, male);
    S.tps.push(...out); out.forEach(computeTP); // les reprises trouvent leur parcours de départ dans la liste
  }
  S.sel.clear(); made.forEach(m => S.sel.add(m.id)); S.sel.add(frame.id);
  gadSec(null); commit(); gcDirty = true; renderLayers(); renderTpList(); renderSel(); draw();
  const err = out.map(t => t.err).find(Boolean); toast(err ? err : tr(v.tp ? 'Incrustation créée : calques et parcours femelle et mâle, tous visibles.' : 'Incrustation créée : pièce mâle dessinée, sans parcours.') + (mb.x1 + margin > S.stock.w ? ' ' + tr('La pièce mâle dépasse du brut : déplacez-la si besoin.') : ''));
}
