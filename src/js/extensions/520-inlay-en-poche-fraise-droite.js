// ---------- inlay en poche (fraise droite) ----------
// contour commun : ouverture puis fermeture par le rayon de la fraise -> tous les angles ont au moins ce rayon,
// la poche (femelle) et la pièce rapportée (mâle) s'usinent alors exactement sur le même tracé
function ipCommon(base, r) { if (!base.length || !(r > 0)) return base; const o = offLoops(offLoops(base, -r), r); return offLoops(offLoops(o, r), -r); }
const ipArea = L => L.reduce((a, l) => a + area(l), 0);
/*@donnee ip-fig*/
function ipTools(pick) { const ft = S.tools.filter(t => t.type === 'flat'), sel = $('#ipTool'); sel.innerHTML = ''; if (!ft.length) { const o = document.createElement('option'); o.value = ''; o.textContent = tr('Aucune : choisissez dans la bibliothèque'); sel.appendChild(o); } for (const t of ft) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); } if (pick && ft.some(t => t.id === pick)) sel.value = pick; }
$('#ipSup').addEventListener('change', () => { $('#ipKind').value = $('#ipSup').checked ? 'plug' : 'cut'; ipInfo(); });
function gadSec(k) { if (k) { setTab('dessin'); if (S.ui.tool !== 'select') setTool('select'); } S.ui.dsec = k; dRefresh(); draw(); }
function ipOpen() {
  const ss = ilSel(); if (!ss.length) return toast(tr('Sélectionnez d’abord le motif à incruster (formes fermées).'));
  let o = { D: 3, gap: 0.1, kind: 'plug', c: '', tp: true }; try { const q = JSON.parse(LS.get('copo.inlayPocket') || '{}'); o = { ...o, ...q }; if (o.b == null) o.b = o.kind === 'cut' ? (o.th || o.D + 0.5) : o.D + (o.over || 1.5); } catch { o.b = 4.5; }
  ipTools(o.tool); $('#ipTp').checked = o.tp !== false; $('#ipSup').checked = o.kind !== 'cut'; $('#ipRough').checked = !!o.rough; $('#ipRoughBtn').dataset.id = o.roughTool || '';
  $('#ipD').value = o.D; $('#ipGap').value = o.gap; $('#ipKind').value = o.kind; $('#ipB').value = o.b; $('#ipC').value = o.c === '' || o.c == null ? '' : o.c; $('#ipCut').value = o.cut === '' || o.cut == null ? '' : o.cut;
  $('#ipSel').textContent = trf('{n} vecteur(s) sélectionné(s) comme motif.', { n: ss.length });
  gadSec('ip'); requestAnimationFrame(ipInfo);
}
function ipVals() { const D = +$('#ipD').value, b = +$('#ipB').value, cv = $('#ipC').value, kv = $('#ipCut').value; return { tool: S.tools.find(t => t.id === $('#ipTool').value), D, b, gap: Math.max(0, +$('#ipGap').value || 0), kind: $('#ipKind').value, over: b - D, th: b, c: cv === '' ? null : Math.max(0, +cv || 0), cut: kv === '' ? b : Math.max(0.1, +kv || b), cutSet: kv !== '', rough: $('#ipRough').checked, roughTool: S.tools.find(t => t.id === $('#ipRoughBtn').dataset.id && t.type === 'flat') }; }
function ipCheck(v) {
  if (!v.tool) return tr('Choisissez une fraise droite.'); if (!(v.D > 0)) return tr('Indiquez la profondeur de la poche.');
  if (v.kind === 'plug' && !(v.over > 0)) return tr('La hauteur du mâle sous le support (b) doit dépasser la profondeur de poche (a).');
  if (v.kind === 'cut' && !(v.th > 0)) return tr('Indiquez l’épaisseur de la pièce mâle (b).');
  if (v.kind === 'plug' && v.c != null && v.c < v.tool.dia + 0.2) return trf('Le débord du support (c) doit être plus grand que le diamètre de la fraise ({d} mm).', { d: fr(v.tool.dia, 2) });
  if (v.rough && !v.roughTool) return tr('Choisissez la fraise d’ébauche (bouton Changer…).');
  if (v.rough && v.roughTool.dia <= v.tool.dia + 1e-6) return tr('La fraise d’ébauche doit être plus grosse que la fraise droite principale.');
  const fl = +v.tool.flen || 0, need = v.kind === 'plug' ? v.D + v.over : v.cut; if (fl > 0 && Math.max(v.D, need) > fl + 1e-6) return trf('Trop profond pour cette fraise (longueur utile {f} mm).', { f: fr(fl, 1) });
  return '';
}
// largeur utile de la poche : rayon du plus grand cercle inscrit (recherche par décalages)
function ipInRadius(C) { let lo = 0, hi = 0; for (const l of C) for (const q of l) hi = Math.max(hi, Math.abs(q[0] - l[0][0]), Math.abs(q[1] - l[0][1])); hi = hi / 2 + 1; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (offLoops(C, -m).length) lo = m; else hi = m; } return lo; }
function ipRoughAdvice(v, G) {
  const d1 = v.tool.dia, R = ipInRadius(G.C), W = 2 * R, F = x => LANG === 'fr' ? fr(x, 1) : x.toFixed(1), depth = v.kind === 'plug' ? Math.max(v.D, v.D + v.over) : v.D;
  if (W < 3 * d1) return { txt: trf('Dégrossissage peu utile : la poche est étroite (jusqu’à {w} mm de large), la fraise de {d} mm suffit.', { w: F(W), d: F(d1) }), R };
  const cap = Math.min(1.6 * R, Math.max(6, 4 * d1)), fit = t => t.type === 'flat' && t.dia >= 1.5 * d1 - 1e-6 && t.dia <= cap + 1e-6 && !(+t.flen > 0 && +t.flen < depth);
  let c = S.tools.filter(fit).sort((a, b) => b.dia - a.dia)[0], lib = null;
  if (!c && typeof LIB !== 'undefined' && LIB.tools) { const L = LIB.tools.filter(t => t.type === 'flat').map(t => ({ t, v: libProjVals(t, projMat()) })).filter(o => fit({ type: 'flat', dia: +o.v.dia, flen: o.v.flen })).sort((a, b) => b.v.dia - a.v.dia)[0]; if (L) { lib = L.t; c = { name: L.v.name || L.t.name, dia: +L.v.dia }; } }
  if (c) return { best: lib ? null : c, lib, R, txt: trf('Dégrossissage conseillé : la poche fait jusqu’à {w} mm de large. Avec « {n} », environ {k} fois moins de trajet ; la fraise de {d} mm ne reprend ensuite que les angles et les passages étroits.', { w: F(W), n: c.name, k: F(c.dia / d1), d: F(d1) }) };
  return { R, txt: trf('Dégrossissage conseillé : la poche fait jusqu’à {w} mm de large. Une fraise droite de {a} à {b} mm conviendrait : choisissez-la dans la bibliothèque (bouton Changer…).', { w: F(W), a: F(2 * d1), b: F(cap) }) };
}
function ipGeom(v) { const base = baseLoops(ilSel()), r = v.tool.dia / 2, C = ipCommon(base, r), M = v.gap > 0 ? offLoops(C, -v.gap) : C; return { base, C, M, r }; }
function ipInfo() { pickSync();
  const v = ipVals(); $('#ipSup').checked = v.kind === 'plug'; $('#ipCRow').hidden = v.kind !== 'plug'; $('#ipCutRow').hidden = v.kind !== 'cut'; $('#ipBL').textContent = tr(v.kind === 'plug' ? 'Hauteur du mâle sous le support (b) (mm)' : 'Épaisseur de la pièce mâle (b) (mm)'); { const f = $('#ipFig'); if (f.dataset.k !== v.kind) { f.innerHTML = IP_FIG[v.kind]; f.dataset.k = v.kind; } }
  $('#ipHelp').textContent = tr(v.kind === 'plug' ? 'Pièce mâle sur support : le motif est usiné en miroir, en relief, sur un support épais (pièce placée à droite, sur un calque à part). Collez-la retournée dans la poche, puis sciez ou rabotez le support le long du trait rouge.' : 'Pièce mâle sans support : le motif est découpé dans une planchette, avec des ponts d’attache (pièce placée à droite, sur un calque à part). Cassez les ponts, poncez, puis collez la pièce dans la poche.');
  $('#ipSel').textContent = trf('{n} vecteur(s) sélectionné(s) comme motif.', { n: ilSel().length }); if (!ilSel().length) { $('#ipInfo').textContent = tr('Sélectionnez dans la vue 2D le motif à incruster (formes fermées).'); return; }
  { const rt = v.roughTool; $('#ipRoughRow').hidden = !v.rough; $('#ipRoughName').textContent = rt ? rt.name : tr('Choisir une fraise…'); }
  if (v.tool) { const G0 = ipGeom(v), A = G0.C.length ? ipRoughAdvice(v, G0) : null; if (A && v.rough && !v.roughTool && (A.best || A.lib)) { const t = A.best || libToProject(A.lib, projMat()); $('#ipRoughBtn').dataset.id = t.id; v.roughTool = t; $('#ipRoughName').textContent = t.name; }
    $('#ipRoughHint').textContent = A ? A.txt + (v.rough && v.roughTool && v.roughTool.dia > 2 * A.R ? ' ' + tr('Attention : la fraise d’ébauche est plus large que la poche, elle n’usinera presque rien.') : '') : ''; } else $('#ipRoughHint').textContent = '';
  const e = ipCheck(v), info = $('#ipInfo'); if (e) { info.textContent = e; return; }
  const G = ipGeom(v), a0 = Math.abs(ipArea(G.base)), a1 = Math.abs(ipArea(G.C)), cv2 = $('#ipCv');
  // aperçu : motif d'origine en pointillés rouges, contour commun rempli
  const all = G.base.flat(); if (all.length) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of all) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const W = Math.max(160, cv2.parentElement.clientWidth || 300), pad = 8, k = Math.min((W - 2 * pad) / Math.max(1e-6, x1 - x0), 150 / Math.max(1e-6, y1 - y0)), H = Math.round((y1 - y0) * k + 2 * pad);
    cv2.width = W * devicePixelRatio; cv2.height = H * devicePixelRatio; cv2.style.height = H + 'px'; const c = cv2.getContext('2d'); c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); c.clearRect(0, 0, W, H);
    const X = x => pad + (x - x0) * k + (W - 2 * pad - (x1 - x0) * k) / 2, Y = y => H - pad - (y - y0) * k, path = L => { c.beginPath(); for (const l of L) l.forEach((q, i) => i ? c.lineTo(X(q[0]), Y(q[1])) : c.moveTo(X(q[0]), Y(q[1]))); };
    path(G.C); c.closePath(); c.fillStyle = '#c99a6b'; c.fill('evenodd'); c.strokeStyle = '#4f7dff'; c.lineWidth = 1.5; c.stroke();
    c.setLineDash([4, 3]); c.strokeStyle = '#e5534b'; c.lineWidth = 1; path(G.base); c.stroke(); c.setLineDash([]); }
  const F = x => LANG === 'fr' ? fr(x, 2) : x.toFixed(2), lost = a0 > 0 ? Math.abs(a0 - a1) / a0 * 100 : 0, gone = G.base.filter(l => area(l) > 0).length - G.C.filter(l => area(l) > 0).length;
  info.textContent = trf('Rayon de la fraise {r} mm : tous les angles sont arrondis à au moins {r} mm (en bleu ; en pointillés rouges, le dessin d’origine). Surface modifiée : {p} %.', { r: F(G.r), p: lost < 0.05 ? '0' : (LANG === 'fr' ? fr(lost, 1) : lost.toFixed(1)) })
    + (gone > 0 ? ' ' + trf('Attention : {n} partie(s) plus fine(s) que la fraise disparaissent.', { n: gone }) : '')
    + ' ' + (v.kind === 'plug' ? trf('Bouchon en relief de {h} mm.', { h: F(v.D + v.over) }) : trf('Pièce mâle découpée dans une planchette d’épaisseur b = {b} mm, à {h} mm de profondeur, avec des ponts.', { b: F(v.th), h: F(v.cut) }) + (v.cut < v.th - 1e-9 ? ' ' + tr('La découpe ne traverse pas la planchette : il faudra finir à la main.') : v.cut <= v.th + 1e-9 ? ' ' + tr('Pour traverser franchement, mettez un peu plus que b (par exemple b + 0,2 mm) si votre martyr le permet.') : '') + (v.th < v.D - 1e-9 ? ' ' + trf('Attention : b est plus petit que a, la pièce restera {d} mm sous la surface.', { d: F(v.D - v.th) }) : v.th > v.D + 1e-9 ? ' ' + trf('Elle dépassera de {d} mm : à poncer après collage.', { d: F(v.th - v.D) }) : ''));
}
['#ipTool', '#ipD', '#ipGap', '#ipKind', '#ipB', '#ipC', '#ipCut', '#ipRough'].forEach(id => { const el = document.querySelector(id); if (el) { el.addEventListener('input', ipInfo); el.addEventListener('change', ipInfo); } });
function ipMake() {
  const v = ipVals(), e = ipCheck(v); if (e) return toast(e);
  const wantTp = $('#ipTp').checked; try { LS.set('copo.inlayPocket', JSON.stringify({ tool: v.tool.id, D: v.D, gap: v.gap, kind: v.kind, b: v.b, c: v.c == null ? '' : v.c, cut: v.cutSet ? v.cut : '', rough: v.rough, roughTool: v.roughTool ? v.roughTool.id : '', tp: wantTp })); } catch { }
  const ss = ilSel(), G = ipGeom(v); if (!G.C.length) return toast(tr('Le motif est plus fin que la fraise : rien à usiner. Choisissez une fraise plus petite.'));
  const lay = (name, color) => { let l = S.layers.find(x => x.name === name); if (!l) { l = { id: uid(), name, visible: true, locked: false, color }; S.layers.push(l); } return l; };
  const lf = lay(tr('Incrustation en poche · femelle'), '#d18a3a'), lm = lay(tr('Incrustation en poche · mâle'), '#9b3ad1'), face = faceOf(ss[0]) === 2 ? 2 : 1;
  const toShapes = (L, layer, g, f) => L.map(l => { const n = mkShape(dedupe(l, true).map(q => { const p = f ? f(q) : q; return NODE(p[0], p[1]); }), true, { layer: layer.id, g }); return n; }).filter(Boolean);
  // femelle : poche sur le contour commun
  const fem = toShapes(G.C, lf, G.C.length > 1 ? uid() : null), nf = newForm();
  const tf = { ownShapes: true, id: uid(), name: tr('Incrustation en poche · femelle'), type: 'pocket', toolId: v.tool.id, shapeIds: fem.map(x => x.id), p: { ...nf, type: 'pocket', depth: v.D, vstart: 0, zrel: 1, allow: 0, dir: 'climb' }, visible: true, face };
  // mâle, placé à droite du motif
  const bb = bbox(ss), margin = v.c != null && v.kind === 'plug' ? v.c : Math.max(3, v.tool.dia * 1.6 + 1), cx = bb.x0 + bb.w / 2, dx = bb.w + 2 * margin + 10, g = uid();
  let tm, made;
  if (v.kind === 'plug') {
    made = toShapes(G.M, lm, g, q => [2 * cx - q[0] + dx, q[1]]); // miroir : la planche est retournée pour le collage
    const mb = bbox(made), frame = mkShape(rectNodes(mb.x0 - margin, mb.y0 - margin, mb.x1 + margin, mb.y1 + margin), true, { layer: lm.id, g }); made.push(frame);
    tm = { ownShapes: true, id: uid(), name: tr('Incrustation en poche · mâle (bouchon à araser)'), type: 'pocket', toolId: v.tool.id, shapeIds: made.map(x => x.id), p: { ...nf, type: 'pocket', depth: v.D + v.over, vstart: 0, zrel: 1, allow: 0, dir: 'climb' }, visible: true, face: 1 };
  } else {
    made = toShapes(G.M, lm, g, q => [q[0] + dx, q[1]]);
    tm = { ownShapes: true, id: uid(), name: tr('Incrustation en poche · mâle (pièce découpée)'), type: 'profile', toolId: v.tool.id, shapeIds: made.map(x => x.id), p: { ...nf, type: 'profile', side: 'out', depth: v.cut, vstart: 0, zrel: 1, allow: 0, tabs: true, tabMode: 'auto', tabN: 3, tabL: 6, tabH: Math.min(1.5, v.th / 2) }, visible: true, face: 1 };
  }
  const list = [], rt = v.rough && v.roughTool;
  const rough = (t, name) => { const r = { ...t, id: uid(), name, toolId: rt.id, p: { ...t.p } }; t.p = { ...t.p, rest: true, restTool: rt.id, restDia: rt.dia, restFrom: r.id }; return r; };
  if (rt) { list.push(rough(tf, tr('Incrustation en poche · femelle, ébauche'))); tf.name = tr('Incrustation en poche · femelle, finition'); } list.push(tf);
  if (rt && tm.type === 'pocket') { list.push(rough(tm, tr('Incrustation en poche · mâle, ébauche'))); tm.name = tr('Incrustation en poche · mâle, finition'); } list.push(tm);
  if (wantTp) { list.forEach(computeTP); S.tps.push(...list); } S.sel = new Set(made.map(x => x.id));
  gadSec(null); commit(); gcDirty = true; renderLayers(); renderTpList(); renderSel(); draw();
  const mb = bbox(made), err = wantTp && (list.find(t => t.err) || {}).err;
  toast(err ? err : tr(wantTp ? 'Incrustation créée : poche femelle et pièce rapportée (calque à part), les deux parcours sont visibles.' : 'Incrustation créée : contours de la poche et de la pièce rapportée, sans parcours (calques « Incrustation en poche »).') + (mb.x1 > S.stock.w ? ' ' + tr('La pièce rapportée dépasse du brut : déplacez-la si besoin.') : ''));
}
