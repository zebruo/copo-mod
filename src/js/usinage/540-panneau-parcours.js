// ---------- panneau Parcours ----------
// renommer un parcours sur place (double-clic sur le nom, ou F2) : aucun recalcul, les parcours liés gardent leur nom
function tpRenameInline(tp, b) { const inp = document.createElement('input'); inp.type = 'text'; inp.value = tp.name; inp.className = 'tpren'; inp.setAttribute('aria-label', tr('Nom du parcours')); b.replaceWith(inp); inp.focus(); inp.select(); let done = false;
  const fin = ok => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v && v !== tp.name) { tp.name = v; tp.nameAuto = false; if (S.editTp === tp.id && S.form) S.form.name = v; commit(false); gcDirty = true; } renderTpList(); if (S.editTp === tp.id) renderForm(); };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); }; inp.onblur = () => fin(true); inp.onclick = e => e.stopPropagation(); }
function renderTpList() { if (typeof libCardSync === 'function') libCardSync();
  const ul = $('#tpList'); if (!S.tps.length) { ul.innerHTML = '<li class="empty">Aucun parcours. Sélectionnez des vecteurs dans la vue 2D, réglez le formulaire ci-dessous puis cliquez sur Calculer.</li>'; $('#tpTotal').textContent = ''; $('#topstats').textContent = ''; return; }
  ul.innerHTML = ''; let tot = 0;
  S.tps.forEach((tp, idx) => {
    const tool = S.tools.find(t => t.id === tp.toolId); if (tp.visible) tot += (tp.stats && tp.stats.min) || 0;
    const li = document.createElement('li'); li.className = 'tpitem' + (tp.id === S.activeTp ? ' on' : '') + (tp.visible ? '' : ' off'); li.tabIndex = 0;
    li.style.setProperty('--c', 'var(' + { profile: '--pf', pocket: '--pk', vcarve: '--vc', drill: '--dr', thread: '--th', relief: '--rl' }[tp.type] + ')');
    const sub = (tp.face === 2 ? 'Face 2 · ' : '') + TYPE_LBL[tp.type] + (tp.type === 'profile' ? ' ' + SIDE_LBL[tp.p.side] : '') + ' · ' + (tool ? tool.name : '?') + (tp.info ? ' · ' + tp.info : '') + (tp.stats && tp.stats.min ? ' · ' + fmtTime(tp.stats.min) : '');
    const wl = [...((tp.type === 'relief' || ((tp.p.proj || (tp.relIds && tp.relIds.length)) && tp.relVer !== undefined)) && tp.relVer !== (S.relief.ver || 0) ? [tr('Relief modifié depuis le calcul : mettez à jour le parcours.')] : []), ...(tp.warns || [])];
    li.innerHTML = '<span class="sw"></span><div class="tpt"><b></b>' + (tp.stale ? '<i class="tpbad stale" title="' + escHtml(tr('Le dessin a changé : parcours à recalculer')) + '" aria-label="' + escHtml(tr('À recalculer')) + '">⟳</i>' : '') + (tp.err ? '<i class="tpbad err" aria-label="Erreur">!</i>' : wl.length ? '<i class="tpbad wrn" aria-label="Avertissement">!</i>' : '') + '</div><div class="acts">'
      + '<button class="iconbtn" data-a="up" title="Monter" aria-label="Monter"' + (idx ? '' : ' disabled') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 15 6-6 6 6"/></svg></button>'
      + '<button class="iconbtn" data-a="down" title="Descendre" aria-label="Descendre"' + (idx < S.tps.length - 1 ? '' : ' disabled') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>'
      + '<button class="iconbtn" data-a="vis" title="' + (tp.visible ? 'Masquer et exclure du G-code' : 'Afficher et inclure') + '" aria-label="Visibilité"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' + (tp.visible ? '' : '<path d="M4 4l16 16"/>') + '</svg></button>'
      + '<button class="iconbtn" data-a="del" title="Supprimer" aria-label="Supprimer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></div>';
    li.querySelector('b').textContent = tp.name; li.querySelector('.tpt').dataset.tip = [tp.name, sub, tr('Double-clic sur le nom pour le renommer.'), tp.err ? '⚠ ' + tp.err : '', ...wl.map(w => '⚠ ' + w)].filter(Boolean).join('\n'); // titre seul, détails au survol
    li.onclick = e => {
      const a = e.target.closest('[data-a]'); if (a) { e.stopPropagation();
        if (a.dataset.a === 'del' && S.tps.some(x => x.vclrOf === tp.id) && !a.dataset.go) { const n = S.tps.filter(x => x.vclrOf === tp.id).length, kind = tr(tp.type === 'pocket' ? 'ébauche' : 'dégagement');
          notice(trf('« {n} » a {k} parcours de {t} lié(s).', { n: tp.name, k: n, t: kind }), [{ t: tr('Les garder (indépendants)'), primary: 1, fn: () => { vclrDetach(tp); a.dataset.go = 1; a.click(); } }, { t: tr('Les supprimer aussi'), fn: () => { a.dataset.go = 1; a.click(); } }]); return; }
        if (a.dataset.a === 'del') { S.tps = S.tps.filter(x => x !== tp && x.vclrOf !== tp.id); if (tp.ownShapes) { const used = new Set(S.tps.flatMap(x => x.shapeIds)), ids = new Set(tp.shapeIds.filter(id => !used.has(id))); if (ids.size) { const lids = new Set(S.shapes.filter(x => ids.has(x.id)).map(x => x.layer)); S.shapes = S.shapes.filter(x => !ids.has(x.id)); for (const id of ids) S.sel.delete(id); S.layers = S.layers.filter(l => !lids.has(l.id) || S.shapes.some(x => x.layer === l.id) || S.layers.length < 2); if (!S.layers.some(l => l.id === S.layerActive) && S.layers[0]) S.layerActive = S.layers[0].id; renderLayers(); renderSel(); toast(tr('Parcours supprimé avec les contours qu’il avait créés.')); } } if (S.editTp === tp.id) { S.editTp = null; S.form = newForm(); fwClose('tpWin'); } commit(false); gcDirty = true; renderTpList(); renderForm(); draw(); }
        if (a.dataset.a === 'vis') { tp.visible = !tp.visible; commit(false); gcDirty = true; renderTpList(); draw(); }
        if (a.dataset.a === 'up' && idx) { S.tps.splice(idx - 1, 0, S.tps.splice(idx, 1)[0]); commit(false); gcDirty = true; renderTpList(); }
        if (a.dataset.a === 'down' && idx < S.tps.length - 1) { S.tps.splice(idx + 1, 0, S.tps.splice(idx, 1)[0]); commit(false); gcDirty = true; renderTpList(); }
        return; }
      let t = tp; if (t.vclrOf) { const par = S.tps.find(x => x.id === t.vclrOf); if (par) { toast(trf('Parcours lié : réglez-le dans « {n} ».', { n: par.name })); t = par; } }
      S.editTp = t.id; S.activeTp = t.id; S.form = { ...newForm(), ...clone(t.p), type: t.type, toolId: t.toolId, name: t.name, face: String(t.face === 2 ? 2 : 1) };
      S.sel = new Set(t.shapeIds.filter(id => shapeById(id))); S.tpRels = new Set(t.relIds || []); renderSel(); renderForm(); renderTpList(); draw(); fwOpen('tpWin');
    };
    li.querySelector('b').ondblclick = e => { e.stopPropagation(); tpRenameInline(tp, e.currentTarget); };
    li.onkeydown = e => { if (e.target.tagName === 'INPUT') return; if (e.key === 'Enter') li.click(); if (e.key === 'F2') tpRenameInline(tp, li.querySelector('b')); };
    li.onmouseenter = () => { RV.hoverTp = tp.id; if (typeof rvReq === 'function') rvReq(); }; li.onmouseleave = () => { if (RV.hoverTp === tp.id) { RV.hoverTp = null; rvReq(); } };
    ul.appendChild(li);
  });
  $('#tpTotal').textContent = 'Temps d’usinage estimé : ' + fmtTime(tot) + ' (parcours visibles).';
  $('#topstats').textContent = S.tps.length + ' parcours · ' + fmtTime(tot);
}
function tpSelInfo() {
  const el = document.getElementById('tpSelInfo'); if (!el) return; const ss = selShapes(), nc = ss.filter(x => x.closed).length, no = ss.length - nc, F = S.form || {};
  const rn = F.type === 'profile' ? [...(S.tpRels || [])].map(id => S.relief.items.find(x => x.id === id)).filter(Boolean).map(x => x.name) : [];
  if (rn.length) { el.classList.remove('bad'); el.textContent = trf('Contour du relief : {n}', { n: rn.join(', ') }) + (ss.length ? ' + ' + trf(ss.length > 1 ? '{n} vecteurs sélectionnés' : '{n} vecteur sélectionné', { n: ss.length }) : ''); return; }
  el.classList.toggle('bad', !ss.length && (F.type !== 'relief' || F.rlBound === 'sel'));
  if (!ss.length && F.type === 'relief' && F.rlBound !== 'sel') { el.textContent = tr('Aucun vecteur nécessaire pour cette limite.'); return; }
  if (!ss.length) { el.textContent = F.type === 'profile' && S.relief.items.length ? tr('Aucun vecteur sélectionné : cliquez dans la vue 2D les vecteurs à usiner (Maj pour en ajouter), ou cliquez un relief (2D ou 3D) pour suivre son contour.') : tr('Aucun vecteur sélectionné : cliquez dans la vue 2D les vecteurs à usiner (Maj pour en ajouter).'); return; }
  const parts = []; if (nc) parts.push(trf(nc > 1 ? '{n} fermés' : '{n} fermé', { n: nc })); if (no) parts.push(trf(no > 1 ? '{n} ouverts' : '{n} ouvert', { n: no }));
  let t = trf(ss.length > 1 ? '{n} vecteurs sélectionnés' : '{n} vecteur sélectionné', { n: ss.length }) + ' (' + parts.join(', ') + ')';
  el.textContent = t;
  if (no && F.type && F.type !== 'profile') el.insertAdjacentHTML('beforeend', ' <small>' + escH(tr(nc ? 'Les vecteurs ouverts sont ignorés par ce parcours.' : 'Ce parcours demande des formes fermées.')) + '</small>');
  if (no && !nc && F.type && F.type !== 'profile') el.classList.add('bad');
}
function renderForm() { setTimeout(tpTypeSync, 0); { const d = $('#tpAdvR'); if (d && !d.dataset.init) { d.dataset.init = 1; d.open = LS.get('copo.tpAdvR') !== '0'; d.addEventListener('toggle', () => LS.set('copo.tpAdvR', d.open ? '1' : '0')); } } { const d = $('#tpAdv'); if (d && !d.dataset.init) { d.dataset.init = 1; d.open = LS.get('copo.tpAdv') === '1'; d.addEventListener('toggle', () => LS.set('copo.tpAdv', d.open ? '1' : '0')); } }
  const F = S.form || (S.form = newForm()), root = $('#tpForm');
  $('#tpFormTitle').textContent = S.editTp ? 'Modifier le parcours' : 'Nouveau parcours';
  $('#tpApply').textContent = S.editTp ? 'Mettre à jour' : (F.type === 'relief' && (!S.sel.size || F.rlBound !== 'sel') ? tr('Calculer') : (S.sel.size || F.type !== 'profile' || !(S.tpRels && S.tpRels.size) ? 'Calculer sur la sélection (' + S.sel.size + ')' : tr('Calculer autour du relief')));
  $('#tpCancel').hidden = !S.editTp;
  { const by = f => S.tools.filter(f), mill = t => t.type === 'flat' || t.type === 'ball', list = F.type === 'vcarve' ? [...by(t => t.type === 'v'), ...by(mill)] : F.type === 'drill' ? [...by(t => t.type === 'drill'), ...by(mill), ...by(t => t.type === 'v')] : F.type === 'thread' ? by(t => t.type === 'thread') : F.type === 'relief' ? (F.rlOp === 'finish' ? [...by(t => t.type === 'ball'), ...by(t => t.type === 'v'), ...by(t => t.type === 'flat')] : [...by(t => t.type === 'flat'), ...by(t => t.type === 'ball')]) : [...by(mill), ...by(t => t.type === 'v')];
  if (!S.tools.find(t => t.id === F.toolId)) F.toolId = list[0] && list[0].id; }
  if (F.type === 'drill') { const t = S.tools.find(x => x.id === F.toolId); if (F._peckTool === undefined && S.editTp) F._peckTool = F.toolId; else if (t && F._peckTool !== F.toolId) { F._peckTool = F.toolId; F.peck = t.peck ?? peckDef(t.dia, projMat()); } } /* perçage : débourrage repris de l'outil (selon le matériau) */
  { const t = S.tools.find(x => x.id === F.toolId); $('#fToolName').textContent = t ? t.name : tr('Choisir un outil…'); $('#fToolBtn').classList.toggle('bad', !t); }
  root.querySelectorAll('[data-f]').forEach(el => { const k = el.dataset.f; if (el.classList.contains('seg')) el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.value === F[k])); else if (el.type === 'checkbox') el.checked = !!F[k]; else el.value = F[k] ?? ''; });
  root.querySelectorAll('[data-show]').forEach(el => { el.hidden = !el.dataset.show.split(' ').includes(F.type); });
  if (F.type === 'profile' && F.side === 'on' && (F.openSide || 'on') === 'on') $('#allowRow').hidden = true;
  $('#openSideRow').hidden = !(F.type === 'profile' && F.side === 'on');
  if (F.type === 'pocket' && F.roughTool && !F.rest) F.rest = true; // projets 1.287 : l'ébauche liée est une reprise
  $('#tabRow').hidden = $('#tabShapeRow').hidden = $('#tabEditRow').hidden = !F.tabs;
  { const man = F.tabMode === 'manual', ti = $('#tabModeInfo'); ti.hidden = !F.tabs; ti.textContent = man ? 'Ponts placés à la main : ' + ((F.tabPts || []).length) + '. « Nombre par contour » est ignoré.' : (S.editTp ? 'Répartition automatique. « Placer à la main » pour ajouter, retirer ou glisser des ponts dans la vue 2D.' : 'Calculez le parcours, puis vous pourrez placer les ponts à la main.'); $('[data-f="tabN"]').disabled = man; }
  { const t = S.tools.find(x => x.id === F.toolId); root.querySelectorAll('[data-f="rampLen"]').forEach(el => { el.placeholder = t ? trf('auto : {v} ({a}°)', { v: uNum(rampAuto(F.pass, t), 'len', 1), a: rampAng() }) : tr('auto : 1,5 × Ø'); });
    const hr = t ? helixROf({ helixD: F.helixD ?? '', arcR: F.arcR }, t) : 0;
    root.querySelectorAll('[data-f="helixD"]').forEach(el => { el.placeholder = t ? trf('auto : {v}', { v: uNum(2 * hr + t.dia, 'len', 1) }) : 'auto'; });
    root.querySelectorAll('[data-f="helixPitch"]').forEach(el => { el.placeholder = t && F.type !== 'drill' ? trf('auto : {v} ({a}°)', { v: uNum(helixPitchOf({ helixPitch: '' }, hr), 'len', 2), a: rampAng() }) : tr('auto (angle du matériau)'); }); }
  root.querySelectorAll('[data-entry]').forEach(el => { const ok = { ramp: ['ramp', 'rampzz'], arc: ['arc', 'arcramp'], helix: ['helix'] }[el.dataset.entry] || []; el.hidden = !ok.includes(F.entry); });
  $('#rasterAngRow').hidden = (F.strategy !== 'raster' && F.strategy !== 'zigzag') || !!F.rest; if (F.type === 'pocket' && F.strategy === 'zigzag' && !F.rest) $('#allowRow').hidden = true; /* aller-retour seul : aucune passe sur le bord, donc pas de surépaisseur */ $('#restPrevRow').hidden = !F.rest; { const ht = S.tools.find(x => x.id === F.toolId), flat = !!ht && ht.type === 'flat'; if (F.type === 'drill' && !flat) $('#helixHolesRow').hidden = true; $('#drillPitchRow').hidden = F.helixHoles === false || !flat;
    let nb = 0; if (F.type === 'drill' && flat && F.helixHoles === false) { const ids = S.editTp ? ((S.tps.find(t => t.id === S.editTp) || {}).shapeIds || []) : [...S.sel]; for (const sh of ids.map(shapeById).filter(x => x && x.closed && x.pts && x.pts.length > 2)) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of sh.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } if (Math.max(x1 - x0, y1 - y0) > ht.dia * 1.05) nb++; } }
    if (F.type === 'thread') { const ti = $('#thInfo'), tl = S.tools.find(x => x.id === F.toolId), ids = S.editTp ? ((S.tps.find(t => t.id === S.editTp) || {}).shapeIds || []) : [...S.sel], sh = ids.map(shapeById).find(x => x && x.closed && x.pts && x.pts.length > 2); let d0 = 0; if (sh) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of sh.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } d0 = Math.max(x1 - x0, y1 - y0); } const G = threadGeo(F, tl || { dia: 0 }, d0); ti.textContent = G.D > 0 ? (G.inner ? trf('M{d} × {p} : perçage préalable Ø{a} (fond de filet Ø{m}).', { d: fr(G.D, 2).replace(/,?0+$/, ''), p: String(+G.P.toFixed(3)).replace('.', ','), a: fr(G.tap, 2).replace(/,?0+$/, ''), m: fr(G.D1, 2) }) : trf('Vis Ø{d} × {p} : cylindre au Ø{d}, fond de filet Ø{m}.', { d: fr(G.D, 2).replace(/,?0+$/, ''), p: String(+G.P.toFixed(3)).replace('.', ','), m: fr(G.d3, 2) })) + (tl && G.inner && tl.dia >= G.D1 ? ' ' + tr('Fraise trop grosse pour ce diamètre.') : '') : tr('Sélectionnez un cercle ou indiquez le diamètre nominal.'); }
    if (F.type === 'relief') { const fin = F.rlOp === 'finish', fo = fin && F.rlFStrat === 'offset'; $('#rlPassRow').hidden = fin; $('#rlAllowRow').hidden = fin; $('#rlEntryRow').hidden = fin; $('#rlRampRow').hidden = fin || F.rlEntry !== 'rampzz'; $('#rlHelixRow').hidden = $('#rlHelixDRow').hidden = fin || F.rlEntry !== 'helix'; $('#rlCrossRow').hidden = !fin || fo; $('#rlRStratRow').hidden = fin; $('#rlFStratRow').hidden = !fin; $('#rlDirRow').hidden = !fo; $('#rlAngRow').hidden = fo;
      { const box = $('#rlItemsBox'), its = S.relief.items.filter(i => relGrid[i.id]); box.innerHTML = ''; if (!its.length) box.innerHTML = '<span class="hint">' + tr('Aucun relief : importez-le dans l’onglet Relief.') + '</span>';
        for (const it of its) { const l = document.createElement('label'); l.className = 'chk'; const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !Array.isArray(F.rlItems) || F.rlItems.includes(it.id); c.disabled = !it.visible; c.onchange = () => { const all = its.map(i => i.id); let cur = Array.isArray(F.rlItems) ? F.rlItems.slice() : all.slice(); cur = c.checked ? [...new Set([...cur, it.id])] : cur.filter(x => x !== it.id); F.rlItems = all.every(x => cur.includes(x)) ? null : cur; }; l.append(c, ' ' + it.name + (it.visible ? '' : ' (' + tr('masqué') + ')')); box.appendChild(l); } }
      const nb = (S.editTp ? ((S.tps.find(t => t.id === S.editTp) || {}).shapeIds || []) : [...S.sel]).map(shapeById).filter(x => x && x.closed).length;
      { const f = $('#rlBoundFig'), k = F.rlBound || 'model'; if (f && f.dataset.k !== k) { f.innerHTML = FIG.rlBound(k); f.dataset.k = k; } }
      $('#rlTpInfo').textContent = F.rlBound === 'sel' ? (nb ? trf('Limite : {n} forme(s) fermée(s) sélectionnée(s).', { n: nb }) : tr('Sélectionnez dans la vue 2D les formes fermées qui limitent l’usinage.')) : F.rlBound === 'stock' ? tr('Limite : tout le brut.') : tr('Limite : contour des reliefs cochés (sans le fond transparent des images).'); }
    const dw = $('#drillWarn'); dw.hidden = !nb; if (nb) dw.textContent = trf('{n} trou(s) plus grand(s) que la fraise : percé(s) à Ø{d} au lieu du diamètre dessiné (cochez l’usinage en hélice).', { n: nb, d: String(+(+ht.dia).toFixed(3)).replace('.', ',') }); }
  { const rs = $('#fRestFrom'), cur = S.tools.find(t => t.id === F.toolId), me = S.editTp ? S.tps.findIndex(t => t.id === S.editTp) : S.tps.length, own = S.editTp ? S.tps.find(x => x.vclrOf === S.editTp) : null;
    const ids = new Set(S.editTp ? ((S.tps.find(t => t.id === S.editTp) || {}).shapeIds || []) : [...S.sel]), tl = t => S.tools.find(x => x.id === t.toolId);
    const ok = S.tps.slice(0, me < 0 ? S.tps.length : me).filter(t => t.type === 'pocket' && (!t.vclrOf || t === own) && (t.shapeIds || []).some(i => ids.has(i)) && tl(t) && cur && tl(t).dia > cur.dia + 1e-6);
    if (F.rest && F.restFrom !== '__new' && !ok.some(t => t.id === F.restFrom)) { // projets d'avant la 1.288 : la fraise indiquée retrouve sa poche
      const byTool = F.restTool && ok.filter(t => t.toolId === F.restTool).pop(); F.restFrom = (own && own.id) || (byTool && byTool.id) || (ok[ok.length - 1] || {}).id || ''; if (F.restFrom) restCopy(F); }
    if (F.restFrom !== '__new' && !(own && F.restFrom === own.id)) F.roughTool = '';
    rs.innerHTML = ''; const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; rs.appendChild(o); };
    if (!ok.length && F.restFrom !== '__new') add('', tr('Aucune poche avant, avec une fraise plus grosse'));
    for (const t of ok) add(t.id, t.name + ' (' + tl(t).name + ')');
    const nt = F.restFrom === '__new' && S.tools.find(x => x.id === F.roughTool); if (nt) add('__new', trf('Nouvelle ébauche ({t})', { t: nt.name }));
    add('__pick', tr('Faire un parcours…')); rs.value = F.restFrom || ''; }
  { const T = vcClrTools(F), L = $('#fClrList'); F.clrTools = T.map(t => t.id); L.innerHTML = ''; $('#fClrNone').hidden = !!T.length; T.forEach((t, i) => { const li = document.createElement('li'); li.innerHTML = '<b>' + (i + 1) + '</b><span></span><button type="button" title="Retirer" aria-label="Retirer">✕</button>'; li.querySelector('span').textContent = t.name; li.querySelector('button').onclick = () => { F.clrTools = F.clrTools.filter(x => x !== t.id); renderForm(); }; L.appendChild(li); }); }
  $('#depthLbl').textContent = tr(F.type === 'vcarve' ? 'Prof. coupe max (C) (0 = illimitée)' : F.type === 'thread' ? 'Longueur filetée (C) (mm)' : 'Prof. coupe (C) (mm)');
  const tool = S.tools.find(t => t.id === F.toolId); let h = ''; const hb = [];
  if (tool) {
    const pass = +F.pass > 0 ? +F.pass : tool.pass, nP = +F.depth > 0 && pass > 0 ? depthLevels(+F.depth, pass).length : 0, passes = nP ? ' ' + trf(nP > 1 ? '{n} passes de {p} mm.' : '{n} passe de {p} mm.', { n: nP, p: fr(+F.depth / nP) }) : '';
    if (F.type === 'profile') {
      if (F.side === 'out') { h = tr('L’outil passe à l’extérieur du vecteur : la pièce est conservée.'); hb.push(tr('Sur une ligne ouverte, il passe à droite, dans le sens où elle a été dessinée.')); }
      else if (F.side === 'in') { h = tr('L’outil passe à l’intérieur du vecteur : l’intérieur est évidé ou découpé.'); hb.push(tr('Sur une ligne ouverte, il passe à gauche, dans le sens où elle a été dessinée.')); }
      else if ((F.openSide || 'on') === 'on') h = tr('L’axe de l’outil suit le vecteur, lignes ouvertes comprises.');
      else { h = tr(F.openSide === 'left' ? 'L’axe de l’outil suit les vecteurs fermés et passe à gauche des lignes ouvertes.' : 'L’axe de l’outil suit les vecteurs fermés et passe à droite des lignes ouvertes.'); hb.push(tr('La gauche et la droite se comptent dans le sens où la ligne a été dessinée (flèche bleue dans la vue 2D ; Dessin › Inverser le sens pour le changer).')); }
      h += passes;
      if (F.tabs) hb.push(trf('Ponts : {n} par contour, {l} mm de long et {e} mm d’épaisseur, au fond de la coupe.', { n: F.tabN || 4, l: fr(+F.tabL || 0), e: fr(+F.tabH || 0) }));
    }

    if (F.type === 'pocket' && F.rest) { const src = S.tps.find(t => t.id === F.restFrom), nt = F.restFrom === '__new' && S.tools.find(t => t.id === F.roughTool), bt = nt || (src && S.tools.find(t => t.id === src.toolId)), fin = +F.allow > 0 && F.finish !== 'none';
      h = bt ? trf('Reprise après « {p} » : seuls les restes de la fraise « {t} » sont usinés.', { p: nt ? tr('nouvelle ébauche') : src.name, t: bt.name }) + passes : tr('Choisissez le parcours de départ, ou « Faire un parcours… ».');
      if (nt) hb.push(tr('Une ébauche liée, avec la grosse fraise, sera créée avant ce parcours ; elle se règle ici.'));
      hb.push(tr(fin ? 'La petite fraise reprend les coins et finit les parois.' : +F.allow > 0 ? 'La petite fraise reprend les coins en laissant la surépaisseur (« Ne pas enlever la surépaisseur »).' : 'La petite fraise ne reprend que les coins que la grosse n’a pas atteints.'), tr('Profondeur, surépaisseur et retrait sont repris du parcours de départ : gardez la même profondeur.')); }
    else if (F.type === 'pocket') {
      h = (F.strategy === 'raster' ? trf('Lignes parallèles à {a}°, puis un tour du bord pour le nettoyer.', { a: +F.rasterAng || 0 }) : F.strategy === 'zigzag' ? trf('Lignes parallèles à {a}°, sans tour du bord.', { a: +F.rasterAng || 0 }) : F.strategy === 'ringsIn' ? tr('Spirale du bord vers le milieu.') : tr('Spirale du milieu vers le bord.'))
        + ' ' + trf('Pas latéral {s} mm.', { s: fr(tool.dia * Math.max(0.05, 1 - tool.over / 100)) }) + passes;
      if (F.strategy === 'zigzag') hb.push(tr('Sans tour du bord, les bords restent légèrement festonnés.'));
      hb.push(trf('Recouvrement : {o} % du diamètre de l’outil. La rampe sert aux passes d’ébauche ; l’arc ne s’applique qu’au contour des parois.', { o: tool.over }));
    }
    if (F.type === 'relief') {
      const fo = F.rlOp === 'finish' && F.rlFStrat === 'offset', rr = F.rlOp !== 'finish' && F.rlRStrat === 'raster', fi = F.rlOp === 'finish';
      h = tr(fo ? 'Finition en contours décalés, du bord de la limite vers l’intérieur.' : rr ? 'Ébauche en balayage 3D : chaque ligne suit la surface, plus la surépaisseur.' : fi ? 'Finition en balayage : l’outil suit la surface avec sa forme réelle.' : 'Ébauche par niveaux de Z à la fraise droite, en laissant la surépaisseur pour la finition.');
      hb.push(tr(fo ? 'L’outil épouse la surface avec sa forme réelle.' : rr ? 'L’outil ne descend jamais sous le niveau en cours, et remonte moins souvent qu’en niveaux de Z.' : fi ? 'Préférez une fraise hémisphérique ou conique à bout sphérique. Un pas latéral de 8 à 12 % donne une surface lisse.' : 'Chaque niveau descend de la profondeur de passe.'));
    }
    else if (F.type === 'thread') {
      h = tr(F.thSide === 'out' ? 'Filetage autour de chaque cercle sélectionné. Dégagez d’abord la matière autour du cylindre.' : 'Filetage dans chaque cercle sélectionné. Percez d’abord le trou au diamètre de perçage.');
      hb.push(tr('Dessinez le cercle au diamètre nominal (8 pour M8) ou indiquez-le ci-dessus.'), tr(F.thSide === 'out' ? 'L’outil tourne autour du cylindre en descendant.' : 'L’outil remonte en hélice depuis le fond.'), tr('Un tour d’hélice = un pas. L’avance indiquée est celle du tranchant : COPO la corrige au centre de l’outil.'));
    }
    else if (F.type === 'drill') {
      h = tr('Un trou au centre de chaque forme fermée sélectionnée.') + ' ' + (+F.peck > 0 ? trf('Débourrage tous les {p} mm.', { p: fr(+F.peck) }) : tr('Descente en une fois, sans débourrage.'));
      hb.push(tr('Dessinez un cercle à chaque emplacement.'));
      if (tool.type === 'drill') hb.push(trf('Foret : chaque trou a le diamètre du foret. La pointe dépasse de {p} mm la profondeur à pleine section : ajoutez-la pour un trou débouchant.', { p: fr(tool.dia / 2 / Math.tan((+tool.angle || 118) * Math.PI / 360)) }));
      else if (tool.type === 'flat' && F.helixHoles !== false) hb.push(tr('Les cercles plus grands que l’outil sont usinés en hélice au diamètre dessiné (fraise droite).'));
      if (+F.peck > 0) hb.push(tr('Débourrage : l’outil remonte au-dessus de la surface pour évacuer les copeaux.'));
      hb.push(trf('Vitesse de descente : {f} mm/min.', { f: tool.plunge }));
    }
    if (F.type === 'vcarve') {
      if (tool.type !== 'v') h = tr('Choisissez une fraise en V.');
      else {
        const vmax = tool.dia / 2 / Math.tan(tool.angle * Math.PI / 360), nv = +F.depth > 0 && pass > 0 ? Math.max(1, Math.ceil(Math.min(+F.depth, vmax) / pass - 1e-6)) : 0;
        h = tr('La fraise suit l’axe médian du vecteur : elle descend là où le trait est large.') + (nv ? ' ' + trf(nv > 1 ? 'Gravure en {n} paliers de {p} mm au plus.' : 'Gravure en {n} palier de {p} mm au plus.', { n: nv, p: fr(pass || 0) }) : '');
        hb.push(tr('Elle remonte jusqu’à la pointe de chaque coin. Une précision plus petite donne des pointes plus nettes, mais un calcul plus long.'), trf('Profondeur maximale de cette fraise : {p} mm ; au-delà, le fond devient plat.', { p: fr(vmax) }), tr('Paliers : profondeur de passe, celle de l’outil si elle est vide.'));
        { const T = vcClrTools(F); if (F.clrExt && T.length) hb.push(tr('Les fonds plats sont vidés par des parcours de dégagement indépendants ; la fraise en V ne reprend que le bord.')); else if (T.length > 1) hb.push(trf('Les fonds plats sont d’abord vidés à la fraise « {a} », puis chaque fraise plus petite reprend ce que la précédente n’a pas pu enlever (parcours « dégagement » ajoutés avant celui-ci) ; la fraise en V ne reprend que le bord.', { a: T[0].name })); else if (T.length) hb.push(tr('Les fonds plats sont d’abord vidés à la fraise droite (parcours « dégagement » ajouté avant celui-ci) ; la fraise en V ne reprend que le bord.')); }
      }
    }
    if ((F.type === 'profile' || F.type === 'pocket') && F.entry === 'helix') { const t = S.tools.find(x => x.id === F.toolId), hr = t ? helixROf({ helixD: F.helixD ?? '', arcR: F.arcR }, t) : 0; if (t) hb.push(trf('Hélice : l’outil descend en spirale ({p} mm par tour, Ø {d} mm, réduit si la place manque) ; sinon il passe en rampe.', { p: fr(helixPitchOf(F, hr), 2), d: fr(2 * hr + t.dia, 1) })); }
    if ((F.type === 'profile' || F.type === 'pocket') && F.entry === 'rampzz') hb.push(tr('Rampe aller-retour : l’outil descend en avançant, revient au point de départ à pleine profondeur, puis fait le tour : chaque passe commence et finit au même point.'));
    if ((F.type === 'profile' || F.type === 'pocket') && F.entry === 'ramp') hb.push(tr('Rampe continue : l’outil descend en avançant et enchaîne le tour ; la portion de rampe est recoupée à la fin.'));
    if (F.allow > 0 && (F.type === 'profile' || F.type === 'pocket') && !(F.type === 'pocket' && F.rest) && !(F.type === 'profile' && F.side === 'on')) hb.push(tr(F.finish === 'last' ? 'Surépaisseur retirée à la dernière passe.' : F.finish === 'none' ? 'Surépaisseur laissée en place : à enlever par un autre parcours (finition).' : 'Surépaisseur retirée par une passe de finition sur toute la hauteur.'));
  }
  { const t = S.tools.find(x => x.id === F.toolId); if (t && t.noCenter && (((F.type === 'profile' || F.type === 'pocket') && (F.entry || 'plunge') === 'plunge') || (F.type === 'relief' && F.rlOp !== 'finish' && (F.rlEntry || 'plunge') === 'plunge'))) h = tr('Cette fraise ne coupe pas au centre : COPO entre en rampe aller-retour au lieu de plonger.') + ' ' + h; if (t && t.noCenter && F.type === 'drill') h = tr('Cette fraise ne coupe pas au centre : ne percez qu’en hélice, dans des trous plus grands qu’elle.') + ' ' + h; }
  hintSet('tpHint', h, hb.join(' ')); tpSelInfo();
  illRefresh();
}
$('#tpForm').addEventListener('click', e => { const b = e.target.closest('.seg button'); if (!b) return; const k = b.parentElement.dataset.f, F = S.form; const prev = F[k]; F[k] = b.value;
  if (k === 'rlOp' && prev !== b.value) { F.rlStep = b.value === 'finish' ? 10 : 40; const pick = b.value === 'finish' ? (S.tools.filter(t => t.type === 'ball' || (t.type === 'v' && +t.tipR > 0)).sort((a, c) => a.dia - c.dia)[0]) : S.tools.filter(t => t.type === 'flat').sort((a, c) => c.dia - a.dia)[0]; if (pick) F.toolId = pick.id; }
  if (k === 'type' && prev !== b.value) { const okT = t => b.value === 'vcarve' ? t.type === 'v' : b.value === 'drill' ? t.type === 'drill' : b.value === 'thread' ? t.type === 'thread' : b.value === 'relief' ? (t.type === 'flat' || t.type === 'ball' || t.type === 'v') : (t.type === 'flat' || t.type === 'ball'); const cur = S.tools.find(t => t.id === F.toolId); if (!cur || !okT(cur)) { const t = toolDef(okT) || (b.value === 'drill' ? toolDef(t => t.type === 'flat') : null); if (t) F.toolId = t.id; } if (b.value === 'vcarve') F.depth = 0; else if (!(+F.depth > 0)) F.depth = b.value === 'pocket' ? 4 : (b.value === 'drill' || b.value === 'thread') ? 10 : 6; }
  renderForm(); });
$('#tpForm').addEventListener('input', e => { const k = e.target.dataset.f; if (!k) return; const el = e.target; S.form[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value; clearTimeout(renderForm.t); renderForm.t = setTimeout(renderForm, 250); });
$('#tpForm').addEventListener('change', e => { if (e.target.dataset.f) renderForm(); });
function applyForm() {
  const F = S.form, ids = [...S.sel], rids = F.type === 'profile' ? [...(S.tpRels || [])].filter(id => S.relief.items.some(x => x.id === id)) : [];
  const p = { side: F.side, depth: +F.depth || 0, pass: F.pass === '' ? '' : +F.pass, allow: +F.allow || 0, finish: F.finish, dir: F.dir, entry: F.entry, rlEntry: F.rlEntry || 'plunge', rampLen: F.rampLen === '' ? '' : +F.rampLen || 0, arcR: +F.arcR || 0, vstep: +F.vstep || 0.1, clrTools: F.type === 'vcarve' ? vcClrTools(F).map(t => t.id) : [], clrTool: F.type === 'vcarve' ? ((vcClrTools(F)[0] || {}).id || '') : '', clrExt: F.type === 'vcarve' && !!F.clrExt, vstart: +F.vstart || 0, zrel: 1, peck: +F.peck || 0, dwell: +F.dwell || 0, openSide: F.openSide || 'on', tabs: !!F.tabs, proj: !!F.proj, tabN: +F.tabN || 4, tabL: F.tabL === '' ? 8 : +F.tabL, tabH: +F.tabH || 2, tabShape: F.tabShape || 'rect', tabMode: F.tabMode === 'manual' ? 'manual' : 'auto', tabPts: F.tabMode === 'manual' && Array.isArray(F.tabPts) ? clone(F.tabPts) : null, strategy: F.strategy || 'rings', rasterAng: +F.rasterAng || 0, rest: F.type === 'pocket' && !!F.rest, roughTool: F.type === 'pocket' && F.rest ? (F.roughTool || '') : '', restFrom: F.type === 'pocket' && F.rest && F.restFrom !== '__new' ? (F.restFrom || '') : '', restTool: '', restDia: 0, helixPitch: F.helixPitch === '' || F.helixPitch == null ? '' : +F.helixPitch || 1, helixD: F.helixD === '' || F.helixD == null ? '' : +F.helixD, helixHoles: F.helixHoles !== false, thSide: F.thSide === 'out' ? 'out' : 'in', thPitch: Math.max(0.2, +F.thPitch || 1.25), thD: Math.max(0, +F.thD || 0), thHand: F.thHand === 'L' ? 'L' : 'R', thPasses: Math.max(1, Math.min(10, Math.round(+F.thPasses || 1))), rlOp: F.rlOp === 'finish' ? 'finish' : 'rough', rlStep: Math.max(2, Math.min(95, +F.rlStep || 40)), rlAng: +F.rlAng || 0, rlAllow: Math.max(0, +F.rlAllow || 0), rlCross: !!F.rlCross, rlBound: ['model', 'stock', 'sel'].includes(F.rlBound) ? F.rlBound : 'model', rlOff: +F.rlOff || 0, rlRStrat: F.rlRStrat === 'raster' ? 'raster' : 'z', rlFStrat: F.rlFStrat === 'offset' ? 'offset' : 'raster', rlDir: F.rlDir === 'conv' ? 'conv' : 'climb', rlEdge: F.rlEdge === 'center' ? 'center' : 'inside', rlItems: Array.isArray(F.rlItems) ? F.rlItems.slice() : null };
  const autoFace = sh => sh.length && sh.every(x => faceOf(x) === 2) ? 2 : 1, faceFor = idl => F.face === 'auto' || !F.face ? autoFace(idl.map(shapeById).filter(Boolean)) : +F.face;
  if (S.editTp) { const tp = S.tps.find(t => t.id === S.editTp); if (!tp) return;
    const nf = faceFor(ids.length ? ids : tp.shapeIds), emp = v => v == null || v === '' || v === 0 || v === false || (Array.isArray(v) && !v.length), peq = Object.keys(p).every(k => JSON.stringify(tp.p[k]) === JSON.stringify(p[k]) || (emp(tp.p[k]) && emp(p[k]))), same = peq && tp.type === F.type && tp.toolId === F.toolId && (tp.face || 1) === nf && ((!ids.length && !rids.length) || (JSON.stringify(tp.shapeIds) === JSON.stringify(ids) && JSON.stringify(tp.relIds || []) === JSON.stringify(rids)));
    const typed = (F.name || '').trim(); if (typed && typed !== tp.name) tp.nameAuto = false;
    if (same && !tp.stale) { if (typed && typed !== tp.name) { tp.name = typed; commit(false); gcDirty = true; renderTpList(); toast(tr('Parcours renommé (rien n’est recalculé).')); } else toast(tr('Rien n’a changé.')); return; }
    tp.face = nf; tp.type = F.type; tp.toolId = F.toolId; tp.p = p; if (ids.length || rids.length) { tp.shapeIds = ids; tp.relIds = rids; }
    if (typed && tp.nameAuto === false) tp.name = typed; else if (tp.nameAuto) { tp.name = tpAutoName(tpFn(tp.type, p), tpnLayer(tp.shapeIds, tp.relIds), S.tools.find(t => t.id === tp.toolId), tp.face, tp); S.form.name = tp.name; }
    computeTP(tp); vclrSync(tp); restLink(tp); commit(false); gcDirty = true; renderTpList(); draw();
    toast(tp.err ? tp.err : 'Parcours mis à jour.'); return; }
  if (!ids.length && !rids.length && (F.type !== 'relief' || F.rlBound === 'sel')) { toast(F.type === 'relief' ? tr('Limite « Vecteurs sélectionnés » : sélectionnez d’abord les formes fermées dans la vue 2D.') : 'Sélectionnez d’abord les vecteurs à usiner dans la vue 2D.'); return; }
  const n = S.tps.filter(t => t.type === F.type).length + 1;
  const fc = F.type === 'relief' || (!ids.length && rids.length) ? 1 : faceFor(ids), tp = { id: uid(), name: F.name || tpAutoName(tpFn(F.type, p), tpnLayer(ids, rids), S.tools.find(t => t.id === F.toolId), fc), nameAuto: !F.name, type: F.type, toolId: F.toolId, shapeIds: ids, relIds: rids, p, visible: true, face: fc };
  computeTP(tp); S.tps.push(tp); vclrSync(tp); restLink(tp); S.activeTp = tp.id; S.editTp = tp.id; S.form.name = tp.name; commit(false); gcDirty = true; renderTpList(); renderForm(); draw();
  toast(tp.err ? tp.err : 'Parcours calculé' + (tp.stats && tp.stats.min ? ' · ' + fmtTime(tp.stats.min) : '') + '.');
}

