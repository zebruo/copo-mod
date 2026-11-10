// ---------- actions ----------
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b); });
let openMenu = null;
function closeMenus() { $$('.mdrop').forEach(d => d.hidden = true); $$('.mtop').forEach(b => b.setAttribute('aria-expanded', 'false')); openMenu = null; }
function refreshToggles() { $$('[data-tgl]').forEach(b => { const on = S.ui[b.dataset.tgl] !== false && !!S.ui[b.dataset.tgl]; b.classList.toggle('on', on); if (b.classList.contains('tg')) b.setAttribute('aria-pressed', on); }); }
$$('.mtop').forEach(b => {
  b.onclick = e => { e.stopPropagation(); const d = b.nextElementSibling, was = !d.hidden; closeMenus(); if (!was) { refreshToggles(); d.hidden = false; b.setAttribute('aria-expanded', 'true'); openMenu = b; } };
  b.onmouseenter = () => { if (openMenu && openMenu !== b) b.click(); };
});
document.addEventListener('click', e => { if (!e.target.closest('.menu')) closeMenus(); else if ((e.target.closest('.mdrop [data-act]') || e.target.closest('.mdrop a')) && !e.target.closest('[data-keep]')) setTimeout(closeMenus, 0); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openMenu) closeMenus(); if (e.key === 'Escape' && !$('#about').hidden) $('#about').hidden = true; if (e.key === 'Escape' && !$('#instDlg').hidden) $('#instDlg').hidden = true; });
$('#about').addEventListener('click', e => { if (e.target.id === 'about') e.target.hidden = true; });
$('#shRefresh').onclick = () => sheetRefresh();
$('#shClose').onclick = () => { $('#sheet').hidden = true; };
$('#shSave').onclick = () => { if (!sheetLast) sheetRefresh(); const nm = (S.meta && S.meta.name ? S.meta.name.replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() : 'copo') || 'copo'; saveFile('fiche-' + nm + '.html', sheetLast, tr('Fiche de gamme')); };
$('#shPrint').onclick = () => { try { $('#shFrame').contentWindow.focus(); $('#shFrame').contentWindow.print(); } catch (e) { toast('Impression impossible ici : enregistrez la fiche puis imprimez-la depuis votre navigateur.'); } };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden && e.target.tagName !== 'TEXTAREA') $('#sheet').hidden = true; });
let CTX3 = null; // (barre flottante remplacée par le menu du clic droit)
function placeCtx() {
  { const b = $('#ctxbar'); if (b) b.hidden = true; return; }
  const bar = $('#ctxbar'), ss = selShapes();
  if (CTX3 && (!VIEWS.d3 || !ss.length || !ss.some(x => CTX3.ids.includes(x.id)))) CTX3 = null;
  const host = CTX3 ? $('#rv3') : $('#cw'); if (bar.parentElement !== host) host.appendChild(bar);
  if (CTX3) { if (S.ui.tool !== 'select' || !$('#tpWin').hidden) { bar.hidden = true; return; } const us = units(ss), oneGroup = us.length === 1 && !!ss[0].g, gb = $('#cxGroup'); gb.hidden = !(oneGroup || us.length > 1); gb.dataset.act = oneGroup ? 'ungroup' : 'group'; gb.textContent = oneGroup ? 'Dégrouper' : 'Grouper'; $('#cxWeld').hidden = ss.filter(x => x.closed).length < 2;
    bar.hidden = false; const hw = host.clientWidth, hh = host.clientHeight, bw = bar.offsetWidth || 300, bh = bar.offsetHeight || 40; bar.style.left = Math.max(bw / 2 + 6, Math.min(hw - bw / 2 - 6, CTX3.x)) + 'px'; bar.style.top = Math.max(6, Math.min(hh - bh - 6, CTX3.y + 18)) + 'px'; return; }
  if (S.ui.tool !== 'select' || !ss.length || !$('#tpWin').hidden || (drag && (drag.mode === 'move' || drag.mode === 'band'))) { bar.hidden = true; return; }
  const b = bbox(ss), us = units(ss), oneGroup = us.length === 1 && !!ss[0].g;
  const gb = $('#cxGroup'); gb.hidden = !(oneGroup || us.length > 1); gb.dataset.act = oneGroup ? 'ungroup' : 'group'; gb.textContent = oneGroup ? 'Dégrouper' : 'Grouper';
  $('#cxWeld').hidden = ss.filter(s => s.closed).length < 2;
  bar.hidden = false; const bw = bar.offsetWidth || 360, bh = bar.offsetHeight || 40;
  const gap = xfOn() ? 34 : 16; let X = (sx(b.x0) + sx(b.x1)) / 2, Y = sy(b.y0) + gap;
  if (Y + bh > H - 8) Y = sy(b.y1) - bh - gap; X = Math.max(bw / 2 + RB + 6, Math.min(W - bw / 2 - 6, X)); Y = Math.max(RB + 6, Math.min(H - bh - 6, Y));
  bar.style.left = X + 'px'; bar.style.top = Y + 'px';
}
let newArm = 0;
function act(a, btn) {
  if ((a.startsWith('img') || a.startsWith('rel')) && imgAct(a)) return;
  const ss = selShapes(), ne = S.ne, nes = ne && shapeById(ne.sid);
  switch (a) {
    case 'new': {
      const b = $('#btnNew'); if (Date.now() - newArm > 3000) { newArm = Date.now(); b.textContent = 'Tout effacer ?'; b.classList.add('armed'); setTimeout(() => { b.textContent = 'Nouveau'; b.classList.remove('armed'); }, 3000); return; }
      newArm = 0; b.textContent = 'Nouveau'; b.classList.remove('armed'); closeMenus(); projKeep(null); S.shapes = []; S.tps = []; S.dims = []; S.images = []; S.imgSel = null; S.relief = { items: [], show: true, res: 0.3 }; S.relSel = null; relGrid = {}; relMesh = {}; relSm.clear(); relDirty = true; relCache = null; if (typeof RXF !== 'undefined') RXF = false; S.guides = { x: [], y: [] }; S.layers = DEFAULT_LAYERS(); S.layerActive = 'l1'; S.sel.clear(); S.editTp = null; S.activeTp = null; S.ne = null; S.form = newForm(); S.meta = {}; commit(); renderSel(); renderForm(); renderLayers(); renderGuides(); fit(); if (typeof RV !== 'undefined') { RV.fitted = false; RV.touched = false; } setTab('projet'); toast('Projet vide.'); return;
    }
    case 'v3d': tpEnsure(v3Open, tr('la simulation')); return;
    case 'fpOpen': fpOpen(); return;
    case 'txEdit': txEdit(); return;
    case 'dlibOpen': dlibOpen(); return;
    case 'dlibClose': $('#dlib').hidden = true; return;
    case 'dlibCfg': cfgOpen('dlib'); return;
    case 'dlibPickDir': dlibPickDir().then(() => { dlibCfgSync(); if (!$('#dlib').hidden) dlibRender(); }); return;
    case 'dlibMkdir': dlibMkdir(); return;
    case 'dlibAddFiles': $('#dlibFiles').click(); return;
    case 'dlibAddDir': $('#dlibDirIn').click(); return;
    case 'dlibImport': $('#dlibLibIn').click(); return;
    case 'dlibExport': dlibExport(); return;
    case 'dlibSaveCur': dlibSaveAsk(); return;
    case 'dlibSaveCurMenu': dlibOpen().then(() => dlibSaveAsk()); return;
    case 'dlibSaveOk': dlibSaveCur(); return;
    case 'dlibSaveNo': $('#dlibName').hidden = true; return;
    case 'dlibUse': dlibUse(DLB.sel); return;
    case 'dlibCopy': dlibCopy(); return;
    case 'fpGoto': { setTab('dessin'); if (S.ui.tool !== 'text') { S.ui.dsec = 'text'; setTool('select'); S.ui.dsec = 'text'; dRefresh(); } const d = document.querySelector('[data-sec="text"]'); d.scrollIntoView({ block: 'nearest' }); if ($('#fpPop').hidden) fpOpen(); return; }
    case 'tabEdit': { const tp = S.editTp && S.tps.find(x => x.id === S.editTp); if (!tp) return toast('Calculez d’abord le parcours.'); if (tp.type !== 'profile') return toast('Les ponts concernent les parcours de profil.'); if (!tp.p.tabs) { tp.p.tabs = true; if (S.form) S.form.tabs = true; computeTP(tp); } if (!tp.loops || !tp.loops.length) return toast('Ce parcours n’a pas de contour fermé.'); S.tabTp = tp.id; S.activeTp = tp.id; setTool('tabedit'); renderTpList(); return; }
    case 'tabAuto': { const tp = S.editTp && S.tps.find(x => x.id === S.editTp); if (!tp) return; tp.p.tabMode = 'auto'; tp.p.tabPts = null; if (S.form) { S.form.tabMode = 'auto'; S.form.tabPts = null; } computeTP(tp); commit(false); gcDirty = true; renderTpList(); renderForm(); draw(); toast('Ponts répartis automatiquement.'); return; }
    case 'tabDone': setTool('select'); return;
    case 'svgAll': exportSVG(false); return;
    case 'svgSel': exportSVG(true); return;
    case 'ciAdd': ciAdd(); return;
    case 'ciClose': if (pen.length > 2) finishPen(true); else toast('Il faut au moins trois points pour fermer.'); return;
    case 'ciUndo': ciUndo(); return;
    case 'ciEnd': if (pen.length > 1) finishPen(false); else toast('Il faut au moins deux points.'); return;
    case 'tgl': { const id = btn && btn.dataset.tgl, cb = id && $('#' + id); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); } else if (id) S.ui[id] = !S.ui[id]; if (SNAP_PREF.includes(id)) { snapVer++; snapSave(); if (!$('#cfg').hidden) snapFill(); } refreshToggles(); draw(); return; }
    case 'selAll': S.shapes.forEach(s => { if (editable(s)) S.sel.add(s.id); }); renderSel(); draw(); return;
    case 'tpRecalc': { const st = S.tps.some(t => t.stale); if (!st) for (const c of TPC.values()) c.list = []; recomputeAll.now = 1; try { recomputeAll(!st); } finally { recomputeAll.now = 0; } return; }
    case 'gcExport': tpEnsure(() => { setTab('gcode'); renderGcode(); saveFile(gcName(), $('#gcOut').value, 'G-code'); }, tr('le G-code exporté')); return;
    case 'tabParcours': setTab('parcours'); if (!S.editTp) { S.form = S.form || newForm(); const os = selShapes(); if (os.length && os.every(x => !x.closed)) { S.form.type = 'profile'; S.form.side = 'on'; } renderForm(); } fwOpen('tpWin'); return;
    case 'tabOutils': case 'libOpen': libOpen(); return;
    case 'libClose': libClose(); return;
    case 'tpToolPick': libOpen({ ftype: (S.form || {}).type, toolId: (S.form || {}).toolId }); return;
    case 'libUse': { const t = libTool(libSel); if (!t || !libPick || !libFits(libPick.ftype, t)) return; const pt = libToProject(t, projMat()); if (libPick.cb) { const cb = libPick.cb; libClose(); cb(pt); commit(false); return; } S.form.toolId = pt.id; S.form.pass = pt.pass; commit(false); libClose(); renderForm(); toast(trf('Outil « {n} » choisi ; profondeur de passe {p} mm.', { n: t.name, p: fr(pt.pass) })); return; }
    case 'libAdd': { const g = libCurGroup(), t = { id: 'u' + uid(), group: g, order: LIB.tools.length, type: 'flat', units: 'mm', dia: 6, angle: 0, flat: 0, flutes: 2, num: null, notes: '', cut: {} }; t.name = libToolName(t); LIB.tools.push(t); if (g) libOpenG.add(g); libSel = t.id; libSave(); libRender(); return; }
    case 'libFolder': { const t = libTool(libSel), parent = t ? (t.group || null) : (LIB.groups.some(g => g.id === libSel) ? libSel : null), g = { id: 'g' + uid(), name: tr('Nouveau dossier'), parent, order: LIB.groups.length }; LIB.groups.push(g); if (parent) libOpenG.add(parent); libSel = g.id; libSave(); libRender(); return; }
    case 'libDup': { const t = libTool(libSel); if (!t) return toast(tr('Choisissez un outil.')); const n = { ...JSON.parse(JSON.stringify(t)), id: 'u' + uid(), name: t.name + ' ' + tr('(copie)'), order: (t.order || 0) + 0.5 }; LIB.tools.push(n); libSel = n.id; libSave(); libRender(); return; }
    case 'libDel': { const t = libTool(libSel); if (t) { if (S.tools.some(x => x.libId === t.id && S.tps.some(tp => tp.toolId === x.id))) return toast(tr('Cet outil sert à un parcours du projet : changez d’outil dans ces parcours d’abord.')); LIB.tools = LIB.tools.filter(x => x !== t); S.tools.forEach(x => { if (x.libId === t.id) delete x.libId; }); libSel = null; libSave(); libRender(); return; } const g = LIB.groups.find(x => x.id === libSel); if (!g) return toast(tr('Choisissez un outil ou un dossier.')); if (LIB.tools.some(x => x.group === g.id) || LIB.groups.some(x => x.parent === g.id)) return toast(tr('Videz d’abord ce dossier.')); LIB.groups = LIB.groups.filter(x => x !== g); libSel = null; libSave(); libRender(); return; }
    case 'libOrig': { const t = libTool(libSel); if (!t) return; const mat = projMat(), o = libOrigCut(t, mat); if (!o) return; if (o.est) delete t.cut[mat]; else t.cut[mat] = o; libChanged(t); libRender(); toast(trf('Réglages d’origine rétablis pour {m}.', { m: libMatName(mat) })); return; }
    case 'libImport': $('#fLib').click(); return;
    case 'libExport': saveFile('bibliotheque-outils-copo.json', JSON.stringify(LIB, null, 1), tr('Bibliothèque d’outils')); return;
    case 'libReset': { if (Date.now() - libResetArm > 3000) { libResetArm = Date.now(); toast(tr('Cliquez encore une fois pour revenir à la bibliothèque par défaut (vos modifications seront perdues).')); return; } libResetArm = 0; LIB = DEFAULT_LIB(); libSel = null; libSave(); libLinkProject(); libSyncProject(); libRender(); toast(tr('Bibliothèque par défaut rétablie.')); return; }
    case 'libMatAdd': { const nm = (window.prompt && window.prompt(tr('Nom du nouveau matériau'), '')) || ''; if (!nm.trim()) return; const id = 'm_' + uid(); LIB.materials.push({ id, name: nm.trim() }); libSave(); libSetMat(id); return; }
    case 'tabGcode': setTab('gcode'); return;
    case 'sample': loadSample(); toast('Projet d’exemple chargé.'); return;
    case 'sampleRot': loadSample(true); setTab('projet'); toast('Exemple rotatif chargé : cylindre Ø 90 mm, texte en V-carving et filet enroulés autour.'); return;
    case 'open': projOpen(); return;
    case 'import': $('#fSvg').click(); return;
    case 'font': $('#fFont').click(); return;
    case 'fontDir': $('#fFontDir').click(); return;
    case 'ufClear': { const b = $('#ufClear'); if (Date.now() - ufArm > 3000) { ufArm = Date.now(); b.textContent = 'Vider ?'; b.classList.add('armed'); setTimeout(() => { b.textContent = 'Vider'; b.classList.remove('armed'); }, 3000); return; } ufArm = 0; b.textContent = 'Vider'; b.classList.remove('armed'); idbClear().catch(() => { }); UF = UF.filter(u => u.src !== 'idb'); updateUFCount(); if (!$('#fpPop').hidden) fpOpen(true); toast('Dossier de polices vidé (les fichiers sur votre ordinateur ne sont pas touchés).'); return; }
    case 'save': projSave(false); return;
    case 'saveAs': projSave(true); return;
    case 'undo': undo(); return;
    case 'redo': redo(); return;
    case 'fit': fit(); return;
    case 'clipCopy': case 'clipCut': clipCopy(a === 'clipCut'); return;
    case 'clipPaste': clipPaste(); return;
    case 'del': if (!ss.length) return; { const ids = new Set(ss.map(s => s.id)); S.shapes = S.shapes.filter(s => !ids.has(s.id)); S.sel.clear(); S.ne = null; commit(); renderSel(); draw(); } return;
    case 'dup': { if (!ss.length) return; S.sel.clear(); copyShapes(ss, q => [q[0], q[1]], new Map()).forEach(n => S.sel.add(n.id)); commit(); renderSel(); draw(); toast(tr('Copie créée sur place et sélectionnée : faites-la glisser ou utilisez les flèches pour la déplacer.')); return; } // sur place, comme dans la plupart des logiciels de dessin
    case 'center': { if (!ss.length && relSelIds().length) { imgAct('relCenter'); return; } if (!ss.length) return; const b = bbox(ss), dx = S.stock.w / 2 - (b.x0 + b.w / 2), dy = S.stock.h / 2 - (b.y0 + b.h / 2); ss.forEach(s => transformShape(s, q => [q[0] + dx, q[1] + dy])); commit(); renderSel(); draw(); return; }
    case 'rotate': case 'rot90': { if (!ss.length) return toast(tr('Sélectionnez un vecteur.')); rotateSel(+(btn && btn.dataset.q) || 90); commit(); renderSel(); draw(); return; }
    case 'rotApply': rotApply(); return;
    case 'fitApply': fitApply(); return;
    case 'dsecClose': S.ui.dsec = null; dRefresh(); draw(); return;
    case 'relSetClose': { RXF = false; S.relSel = null; if (typeof RV !== 'undefined') RV.tool = null; relPanel(); draw(); return; }
    case 'setClose': { if (pen.length) finishPen(false); arcSt = []; dimSt = []; if (!['select', 'pan'].includes(S.ui.tool)) setTool('select'); S.ui.dsec = null; dRefresh(); draw(); return; }
    case 'mirH': case 'mirV': case 'mirT': case 'mirB': case 'mirL': case 'mirR': case 'mirLine': mirrorSel(a); return;
    case 'traceOutline': {
      if (S.imgSel) { S.ui.dsec = null; if (S.ui.tool !== 'select') setTool('select'); dRefresh(); const d = $('#vzBox'); if (d) { d.open = true; d.scrollIntoView({ block: 'nearest' }); } toast(tr('Réglez le seuil et le lissage, puis cliquez « Créer les contours ».')); return; }
      const it = relCur(); if (it) { relOutline(it); return; }
      toast(tr('Sélectionnez d’abord une image (dans la vue 2D) ou un relief (dans la vue 2D, dans la vue 3D ou dans l’onglet Relief).')); return; }
    case 'cfCreate': cfCreate(); return;
    case 'cfOk': cfOk(); return;
    case 'cfEdit': cfEdit(); return;
    case 'relBarMachine': { RELBAR = null; tpNew('relief'); return; }
    case 'relBarProfile': { RELBAR = null; tpNew('profile'); return; }
    case 'relBarDup': relDup(); return;
    case 'reverse': { if (!ss.length) return toast('Sélectionnez des vecteurs.'); ss.forEach(s => { s.nodes = reverseNodes(s.nodes); refresh(s); }); commit(); draw(); toast('Sens inversé.'); return; }
    case 'zFront': case 'zUp': case 'zDown': case 'zBack': arrange(a); return;
    case 'group': { if (ss.length < 2) return toast('Sélectionnez au moins deux vecteurs.'); const g = uid(); ss.forEach(s => s.g = g); commit(false); renderSel(); toast('Groupe créé (' + ss.length + ' vecteurs).'); return; }
    case 'ungroup': { if (!ss.some(s => s.g)) return toast('La sélection ne contient pas de groupe.'); ss.forEach(s => s.g = null); commit(false); renderSel(); toast('Groupe défait.'); return; }
    case 'alignL': case 'alignCH': case 'alignR': case 'alignT': case 'alignCV': case 'alignB': doAlign(a.slice(5)); return;
    case 'distH': doDistribute('x'); return;
    case 'distV': doDistribute('y'); return;
    case 'boolU': doBool('union'); return;
    case 'boolS': doBool('sub'); return;
    case 'boolI': doBool('inter'); return;
    case 'array': doArray(); return;
    case 'arrPath': S.ui.arrMode = 'path'; dSec('array'); bindK(); return;
    case 'nest': doNest(); return;
    case 'sheet': tpEnsure(sheetOpen, tr('la fiche de gamme')); return;
    case 'sheetPdf': tpEnsure(sheetPdf, tr('la fiche de gamme')); return;
    case 'lang': setLang(btn.dataset.lang); fsSync(); return;
    case 'about': $('#about').hidden = false; return;
    case 'bugOpen': bugOpen('bug'); return;
    case 'ideaOpen': bugOpen('idea'); return;
    case 'install': if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; }); return; } { const st = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone; $('#instDone').hidden = !st; $('#instHow').hidden = !!st; $('#instDlg').hidden = false; } return;
    case 'instClose': $('#instDlg').hidden = true; return;
    case 'fbOpen': fbOpen(); return;
    case 'boxOpen': boxOpen(); return;
    case 'boxClose': fwClose('box'); return;
    case 'boxReset': { const o = BOX_DEF(); o.t = S.stock.t; boxFill(o); boxDraw(); return; }
    case 'boxMake': boxMake(); return;
    case 'grOpen': grOpen(); return;
    case 'grClose': fwClose('grad'); return;
    case 'grReset': grFill(GR_DEF()); grDraw(); return;
    case 'grMake': grMake(); return;
    case 'ilOpen': ilOpen(); return;
    case 'ilClose': gadSec(null); return;
    case 'ipOpen': ipOpen(); return;
    case 'ipClose': gadSec(null); return;
    case 'ipMake': ipMake(); return;
    case 'rotFit': { const st = S.stock, C = +(Math.PI * st.t).toFixed(3); if ((st.rotary || {}).axis === 'y') st.w = C; else st.h = C; syncStock(); commit(false); recomputeAll(); draw(); toast(trf('Brut ajusté : {c} mm dans le sens enroulé.', { c: fr(C, 2) })); return; }
    case 'vpImport': $('#fVp').click(); return;
    case 'vpRemove': { const id = String(S.machine.post).slice(4); try { LS.set('copo.vposts', JSON.stringify(vpUserList().filter(x => x.id !== id))); } catch { } S.machine.post = 'grbl'; delete S.machine.vpText; delete S.machine.vpName; autosave(); syncMachine(); pjSummary(); gcDirty = true; renderGcode(); toast(tr('Post-processeur retiré.')); return; }
    case 'ipRoughLib': libOpen({ ftype: 'flatonly', toolId: $('#ipRoughBtn').dataset.id, cb: pt => { $('#ipRoughBtn').dataset.id = pt.id; $('#ipRough').checked = true; ipInfo(); toast(trf('Fraise « {n} » choisie.', { n: pt.name })); } }); return;
    case 'ipLib': libOpen({ ftype: 'flatonly', toolId: $('#ipTool').value, cb: pt => { ipTools(pt.id); ipInfo(); toast(trf('Fraise « {n} » choisie.', { n: pt.name })); } }); return;
    case 'tpRoughLib': libOpen({ ftype: 'flatonly', toolId: S.form && S.form.roughTool, cb: pt => { const cur = S.tools.find(t => t.id === S.form.toolId); if (cur && pt.dia <= cur.dia + 1e-6) { toast(tr('Choisissez une fraise plus grosse que celle du parcours.')); return; } S.form.roughTool = pt.id; S.form.restFrom = '__new'; S.form.rest = true; renderForm(); toast(trf('Fraise « {n} » choisie.', { n: pt.name })); } }); return;
    case 'tpClrLib': libOpen({ ftype: 'flatonly', cb: pt => { const F = S.form; F.clrTools = vcClrIds(F); if (!F.clrTools.includes(pt.id)) F.clrTools.push(pt.id); F.clrTools = vcClrTools(F).map(t => t.id); renderForm(); toast(trf('Fraise « {n} » ajoutée.', { n: pt.name })); } }); return;
    case 'ilClrLib': libOpen({ ftype: 'flatonly', cb: pt => { if (!ilClrIds.includes(pt.id)) ilClrIds.push(pt.id); ilClrRender(); ilInfo(); toast(trf('Fraise « {n} » ajoutée.', { n: pt.name })); } }); return;
    case 'ilLib': libOpen({ ftype: 'vonly', toolId: $('#ilTool').value, cb: pt => { ilFill('#ilTool', 'v', pt.id); ilInfo(); toast(trf('Fraise « {n} » choisie.', { n: pt.name })); } }); return;
    case 'ilMake': ilMake(); return;
    case 'fbClose': fwClose('fb'); return;
    case 'fullscreen': fsToggle(); return;
    case 'snapOpen': snapOpen(); return;
    case 'snapClose': case 'cfgClose': cfgClose(); return;
    case 'cfgOpen': cfgOpen(); return;
    case 'cfgMachine': case 'machOpen': machOpen(); return;
    case 'machClose': machClose(); return;
    case 'machNew': machNew(); return;
    case 'machDup': machDup(); return;
    case 'machDel': machDel(); return;
    case 'machExport': machExport(); return;
    case 'machImport': $('#fMach').click(); return;
    case 'snapReset': Object.assign(S.ui, SNAP_DEF); snapSave(); snapBarSync(); snapFill(); draw(); return;
    case 'fbReset': fbFill(FB_DEF()); fbDraw(); return;
    case 'fbMake': fbMake(); return;
    case 'bugClose': $('#bug').hidden = true; return;
    case 'bugSend': bugSend(); return;
    case 'aboutClose': $('#about').hidden = true; return;
    case 'tourStart': cfgClose(); coWelClose(); coTour(); return;
    case 'tipsReset': coTipsReset(); return;
    case 'nestOpen': { setTab('dessin'); dSec('nest'); return; }
    case 'dsecGo': { setTab('dessin'); if (S.ui.tool !== 'select') setTool('select'); S.ui.dsec = btn.dataset.sec; dRefresh(); return; }
    case 'toolGo': { setTab('dessin'); setTool(btn.dataset.tool); dRefresh(); return; }
    case 'join': {
      const open = selOrdered().filter(s => !s.closed); if (!open.length) return toast('Sélectionnez des vecteurs ouverts.');
      const r = joinNodes(open.map(s => s.nodes), Math.max(0.001, +S.ui.joinTol || 0.5), S.ui.joinMode), first = open[0];
      const ids = new Set(open.map(s => s.id)); S.shapes = S.shapes.filter(s => !ids.has(s.id)); S.sel.clear();
      const n = mkShape(r.nodes, r.closed, { layer: first.layer, g: first.g }); if (n) S.sel.add(n.id);
      for (const tp of S.tps) if (tp.shapeIds.some(id => ids.has(id))) tp.shapeIds = [...tp.shapeIds.filter(id => !ids.has(id)), n.id];
      commit(); renderSel(); draw(); toast(open.length + ' vecteur(s) joint(s)' + (r.closed ? ', contour fermé.' : '.')); return;
    }
    case 'close': {
      const open = ss.filter(s => !s.closed && s.nodes.length > 2); if (!open.length) return toast('Sélectionnez un vecteur ouvert d’au moins trois points.');
      for (const s of open) { const N = s.nodes, f = N[0], l = N[N.length - 1]; if (Math.hypot(f.x - l.x, f.y - l.y) < Math.max(0.001, +S.ui.joinTol || 0.5)) { f.i = l.i; N.pop(); } else if (S.ui.joinMode === 'curve') bridgeNodes(l, N[N.length - 2], f, N[1]); s.closed = true; refresh(s); }
      commit(); draw(); toast(open.length + ' vecteur(s) fermé(s).'); return;
    }
    case 'toolDog': setTool('dogbone'); return;
    case 'chamferAll': case 'filletAll': {
      const cl = ss.filter(s => s.nodes.length > 2); if (!cl.length) return toast('Sélectionnez au moins un vecteur.');
      const kind = a === 'chamferAll' ? 'chamfer' : 'fillet', v = kind === 'chamfer' ? +S.ui.chamfer : +S.ui.fillet; if (!(v > 0)) return toast('Indiquez une valeur supérieure à 0.');
      let n = 0; for (const s of cl) n += cornerAllNodes(s, kind, v);
      if (!n) return toast('Aucun coin vif dans la sélection.'); commit(); renderSel(); draw(); toast(n + ' coin(s) modifié(s).'); return;
    }
    case 'offset': {
      let d = +S.ui.offDist; if (!d) return toast('Indiquez une distance.');
      let side = S.ui.offSide || 'out'; if (d < 0) { d = -d; side = side === 'out' ? 'in' : side === 'in' ? 'out' : side; } // distance négative : de l'autre côté
      const sharp = S.ui.offSharp !== false, cl = ss.filter(x => x.closed && x.pts.length > 2), op = ss.filter(x => !x.closed && x.pts.length > 1);
      if (!cl.length && !op.length) return toast('Sélectionnez des vecteurs (ouverts ou fermés).');
      const made = [], add = (pts, closed) => { const q = pts.map(p => [p[0], p[1], 0]); if (closed) q.push(q[0]); let r = rdp3(q, 0.003); if (closed) r.pop(); const n = mkShape(nodesFromPts(r.map(p => [p[0], p[1]])), closed); if (n) made.push(n); };
      if (cl.length) { const base = baseLoops(cl); for (const sg of side === 'both' ? [1, -1] : [side === 'in' ? -1 : 1]) for (const l of loopsOf(cOffsetJ(base.map(toCP), sg * d, sharp))) add(l, true); }
      for (const o of op) {
        if (side === 'both') { for (const l of loopsOf(cOffsetJ([toCP(o.pts)], d, sharp, sharp ? ClipperLib.EndType.etOpenButt : ClipperLib.EndType.etOpenRound))) add(l, true); }
        else { const r = sideOffset(o.pts, d, side === 'in' ? 'left' : 'right', sharp); if (r && r.length > 1) add(r, false); }
      }
      if (!made.length) return toast('Le décalage intérieur fait disparaître le vecteur.');
      if (S.ui.offDel) { const ids = new Set(ss.map(x => x.id)); S.shapes = S.shapes.filter(x => !ids.has(x.id)); for (const tp of S.tps) tp.shapeIds = tp.shapeIds.filter(id => !ids.has(id)); }
      S.sel.clear(); made.forEach(n => S.sel.add(n.id)); commit(); renderSel(); draw(); toast(made.length + ' vecteur(s) décalé(s) créé(s).'); return;
    }
    case 'layerAdd': { const pal = ['#161616', '#c0392b', '#1f6fe0', '#12935a', '#9b3ad1', '#d35400', '#00838f', '#7f8c8d'], l = { id: uid(), name: tr('Calque') + ' ' + (S.layers.length + 1), visible: true, locked: false, color: pal[S.layers.length % pal.length] }; S.layers.push(l); S.layerActive = l.id; commit(false); renderLayers(); return; }
    case 'layerCopy': { if (!ss.length) return toast(tr('Sélectionnez des vecteurs.')); const l = S.layers.find(x => x.id === S.layerActive); if (l) copyToLayer(ss, l); return; }
    case 'layerMove': { if (!ss.length) return toast('Sélectionnez des vecteurs.'); ss.forEach(s => s.layer = S.layerActive); commit(false); renderLayers(); draw(); toast(ss.length + ' vecteur(s) déplacé(s) sur le calque actif.'); return; }
    case 'guideV': S.guides.x.push(S.stock.w / 2); guideLk('x'); commit(false); renderGuides(); draw(); return;
    case 'guideH': S.guides.y.push(S.stock.h / 2); guideLk('y'); commit(false); renderGuides(); draw(); return;
    case 'guideClear': S.guides = { x: [], y: [] }; commit(false); renderGuides(); draw(); return;
    case 'dimClear': S.dims = []; S.selDim = null; commit(false); draw(); return;
    // nœuds
    case 'neExplode': { // scinder : chaque segment devient un vecteur ouvert
      const src = S.ui.tool === 'nodes' && S.ne && shapeById(S.ne.sid) ? [shapeById(S.ne.sid)] : selShapes().filter(x => x.nodes && x.nodes.length > 1);
      if (!src.length) return toast(tr('Sélectionnez un profil à scinder.')); let n = 0; const ids = [];
      for (const sh of src) { const ns = nseg(sh); if (ns < 2 && !sh.closed) continue; const pieces = []; for (let k = 0; k < ns; k++) pieces.push(extractNodes(sh, k, k + 1)); const made = replaceShape(sh, pieces.map(nd => ({ nodes: nd, closed: false }))); n += made.length; made.forEach(m => ids.push(m.id)); }
      if (!n) return toast(tr('Ce profil n’a qu’un segment.')); S.ne = null; S.sel.clear(); ids.forEach(id => S.sel.add(id)); commit(); renderSel(); draw(); toast(trf('Profil scindé en {n} vecteurs.', { n })); return;
    }
    case 'neSmooth': case 'neSym': case 'neCusp': case 'neCorner': case 'neDel': case 'neSplit': {
      const L = neSel();
      if (a === 'neDel' && nes && !L.length && ne.seg !== null && ne.seg !== undefined) { // supprimer le segment sélectionné
        const N = nes.nodes.map(cloneNode), n = N.length, k = ne.seg, pieces = [];
        if (nes.closed) { const P = N.slice(k + 1).concat(N.slice(0, k + 1)); P[0].i = null; P[P.length - 1].o = null; pieces.push(P); }
        else { const A = N.slice(0, k + 1), B = N.slice(k + 1); if (A.length) A[A.length - 1].o = null; if (B.length) B[0].i = null; if (A.length > 1) pieces.push(A); if (B.length > 1) pieces.push(B); }
        const made = replaceShape(nes, pieces.map(nd => ({ nodes: nd, closed: false })));
        if (!made.length) { S.ne = null; toast(tr('Segment supprimé : la ligne n’avait plus assez de nœuds et a été effacée.')); } else toast(tr(made.length > 1 ? 'Segment supprimé : la ligne est coupée en deux.' : 'Segment supprimé.'));
        commit(); renderSel(); draw(); return;
      }
      if (!nes || !L.length) return toast(tr('Sélectionnez un nœud ou un segment avec l’outil Nœuds.'));
      if (a === 'neSplit') { const pieces = cutPieces(nes, ne.ni !== null ? ne.ni : L[0]); if (!pieces) return toast('Impossible de couper à l’extrémité d’un vecteur ouvert.'); replaceShape(nes, pieces.map(nd => ({ nodes: nd, closed: false }))); commit(); renderSel(); draw(); return; }
      if (a === 'neDel') { const N = nes.nodes.length, min = nes.closed ? 3 : 2; if (N - L.length < min) return toast('Le vecteur doit garder au moins ' + min + ' nœuds.'); [...L].sort((x, y) => y - x).forEach(i => nes.nodes.splice(i, 1)); ne.ni = null; ne.ms = null; refresh(nes); commit(); syncNe(); draw(); return; }
      const N = nes.nodes.length;
      for (const idx of L) {
        const n = nes.nodes[idx]; if (!n) continue;
        if (a !== 'neSym') delete n.sym;
        if (a === 'neCorner') { n.sm = false; n.i = null; n.o = null; }
        if (a === 'neCusp') { // nœud brisé : deux poignées indépendantes
          const prev = nes.closed || idx > 0 ? nes.nodes[(idx - 1 + N) % N] : null, next = nes.closed || idx < N - 1 ? nes.nodes[(idx + 1) % N] : null;
          n.sm = false; if (!n.i && prev) n.i = [(prev.x - n.x) / 3, (prev.y - n.y) / 3]; if (!n.o && next) n.o = [(next.x - n.x) / 3, (next.y - n.y) / 3];
        }
        if (a === 'neSmooth' || a === 'neSym') {
          const prev = nes.closed || idx > 0 ? nes.nodes[(idx - 1 + N) % N] : null, next = nes.closed || idx < N - 1 ? nes.nodes[(idx + 1) % N] : null;
          let dir; if (n.i && n.o) dir = nrm([n.o[0] - n.i[0], n.o[1] - n.i[1]]); else dir = nrm([(next || n).x - (prev || n).x, (next || n).y - (prev || n).y]);
          const li = n.i ? Math.hypot(...n.i) : prev ? Math.hypot(n.x - prev.x, n.y - prev.y) / 3 : 0, lo = n.o ? Math.hypot(...n.o) : next ? Math.hypot(n.x - next.x, n.y - next.y) / 3 : 0;
          const lm = a === 'neSym' && prev && next ? (li + lo) / 2 : null; n.i = prev ? [-dir[0] * (lm ?? li), -dir[1] * (lm ?? li)] : null; n.o = next ? [dir[0] * (lm ?? lo), dir[1] * (lm ?? lo)] : null; n.sm = true; if (a === 'neSym') n.sym = true;
        }
      }
      refresh(nes); commit(); draw(); return;
    }
    case 'neLine': case 'neCurve': case 'neAdd': {
      if (!nes) return toast('Sélectionnez un vecteur avec l’outil Nœuds.');
      let k = ne.seg; if (k === null && ne.ni !== null) k = Math.min(ne.ni, nseg(nes) - 1); if (k === null || k < 0) return toast('Cliquez d’abord sur un segment.');
      const A = nes.nodes[k], B = nes.nodes[(k + 1) % nes.nodes.length];
      if (a === 'neLine') { A.o = null; B.i = null; A.sm = false; B.sm = false; }
      if (a === 'neCurve') { if (!A.o) A.o = [(B.x - A.x) / 3, (B.y - A.y) / 3]; if (!B.i) B.i = [(A.x - B.x) / 3, (A.y - B.y) / 3]; }
      if (a === 'neAdd') { refresh(nes); const idx = insertNode(nes, k + 0.5); ne.ni = idx; ne.ms = null; ne.seg = null; commit(); draw(); return; }
      refresh(nes); commit(); draw(); return;
    }
    case 'neClose': {
      if (!nes) return toast('Sélectionnez un vecteur avec l’outil Nœuds.');
      if (nes.closed) { const pieces = cutPieces(nes, ne.ni !== null ? ne.ni : 0); replaceShape(nes, pieces.map(nd => ({ nodes: nd, closed: false }))); }
      else { if (nes.nodes.length < 3) return toast('Il faut au moins trois nœuds pour fermer.'); const f = nes.nodes[0], l = nes.nodes[nes.nodes.length - 1]; if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-3) { f.i = l.i; nes.nodes.pop(); } nes.closed = true; refresh(nes); }
      commit(); renderSel(); draw(); return;
    }
    case 'tpApply': applyForm(); return;
    case 'view2d': case 'view3d': viewToggle(a === 'view2d' ? 'd2' : 'd3'); return;
    case 'splitV': case 'splitH': VIEWS.split = a === 'splitV' ? 'v' : 'h'; viewsApply(); return;
    case 'rvDraw': RV.showDraw = !RV.showDraw; rvSave(); rvReq(); return;
    case 'rvAxes': RV.showAxes = !RV.showAxes; rvSave(); rvReq(); return;
    case 'rvStock': RV.showStock = !RV.showStock; rvSave(); rvReq(); return;
    case 'rvTp': RV.showTp = !RV.showTp; rvSave(); rvReq(); return;
    case 'rvFit': rvFit(false); return;
    case 'rvMove': case 'rvRotate': case 'rvScale': { const t = { rvMove: 'move', rvRotate: 'rotate', rvScale: 'scale' }[a]; RV.tool = RV.tool === t ? null : t; rvToolsSync(); rvReq(); return; }
    case 'rvDropB': case 'rvDropT': { const it = relCur(); if (!it) { toast(tr('Sélectionnez un relief (clic dans la vue 3D, dans la vue 2D ou dans la liste).')); return; } it.top = a === 'rvDropT' ? 0 : S.stock.t - (+it.zH || 0); relAfterXf(it, true); return; }
    case 'tpCancel': S.editTp = null; S.activeTp = null; S.form = newForm(); fwClose('tpWin'); if (S.ui.tool === 'tabedit') setTool('select'); renderForm(); renderTpList(); draw(); return;
    case 'toolAdd': { const t = { id: uid(), num: Math.max(0, ...S.tools.map(x => +x.num || 0)) + 1, name: tr('Nouvelle fraise 4 mm'), type: 'flat', dia: 4, angle: 90, rpm: 18000, feed: 1500, plunge: 400, pass: 2, over: 40 }; S.tools.push(t); S.toolSel = t.id; toolsChanged(); fwOpen('toolWin'); return; }
    case 'toolDup': { const t0 = S.tools.find(t => t.id === S.toolSel); if (!t0) return; const t = { ...t0, id: uid(), num: Math.max(0, ...S.tools.map(x => +x.num || 0)) + 1, name: t0.name + tr(' (copie)') }; S.tools.push(t); S.toolSel = t.id; toolsChanged(); fwOpen('toolWin'); return; }
    case 'toolDel': { const used = S.tps.filter(t => t.toolId === S.toolSel).length; if (used) return toast('Cet outil sert à ' + used + ' parcours : changez-les d’abord.'); S.tools = S.tools.filter(t => t.id !== S.toolSel); S.toolSel = S.tools[0] && S.tools[0].id; fwClose('toolWin'); toolsChanged(); return; }
    case 'toolsExport': saveFile('bibliotheque-outils.json', JSON.stringify(S.tools, null, 2), 'Bibliothèque d’outils'); return;
    case 'toolsImport': $('#fTools').click(); return;
    case 'mcReset': S.machine.custom = CUSTOM_POST(); syncMachine(); autosave(); gcDirty = true; renderGcode(); return;
    case 'gcSave': { renderGcode(); saveFile(gcName(), $('#gcOut').value, 'G-code'); return; }
    case 'gcCopy': { renderGcode(); copyText($('#gcOut')); return; }
  }
}

