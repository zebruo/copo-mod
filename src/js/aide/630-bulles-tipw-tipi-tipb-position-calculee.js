// ---------- bulles ⓘ (.tipw > .tipi + .tipb) : position calculée à l'ouverture, au survol, au clic ou au toucher ----------
const TIP_GUIDE = [['[data-sec="text"]', 'texte', 'text'], ['[data-sec="nest"]', 'imbrication', 'nesting'], ['[data-sec="il"], [data-sec="ip"], #fb', 'lutherie', 'lutherie'], ['#box', 'boite', 'box'], ['#stDouble', 'double', 'double'], ['#machWin', 'machines', 'machines'], ['#cfg', 'param', 'settings'], ['#instDlg', 'installer', 'install'], ['#bug', 'bug', 'bug'], ['#lib', 'outils', 'tools'], ['#grad', 'graduations', 'graduations'], ['#tpWin, [data-pane="parcours"]', 'parcours', 'toolpaths'], ['[data-pane="gcode"]', 'gcode', 'gcode'], ['[data-pane="relief"]', 'relief', 'relief'], ['[data-pane="projet"]', 'brut', 'stock'], ['[data-pane="dessin"]', 'dessin', 'drawing']];
function tipMore(w) { const b = w.querySelector(':scope > .tipb'); if (!b) return; let a = b.querySelector(':scope > .tipmore'); const g = TIP_GUIDE.find(x => w.closest(x[0])); if (!g) { if (a) a.remove(); return; }
  if (!a) { a = document.createElement('a'); a.className = 'tipmore'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'En savoir plus'; b.appendChild(a); } a.href = 'guide.html#' + (LANG === 'en' ? 'en-' + g[2] : 'fr-' + g[1]); }
function tipbPlace(w) { if (!w) return; tipMore(w); const b = w.querySelector(':scope > .tipb'), i = w.querySelector(':scope > .tipi') || w; if (!b) return; const r = i.getBoundingClientRect(), bw = Math.min(280, innerWidth - 16), h = b.offsetHeight;
  let x = w.classList.contains('tipr') ? r.right - bw + 6 : r.left - 6; x = Math.max(8, Math.min(x, innerWidth - bw - 8)); let y = r.bottom + 6; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6); b.style.left = x + 'px'; b.style.top = y + 'px'; }
document.addEventListener('pointerover', e => { const w = e.target.closest && e.target.closest('.tipw'); if (w && !(e.relatedTarget && w.contains(e.relatedTarget))) tipbPlace(w); }, true);
document.addEventListener('focusin', e => { const w = e.target.closest && e.target.closest('.tipw'); if (w) tipbPlace(w); });
document.addEventListener('click', e => { const i = e.target.closest && e.target.closest('.tipi'); if (!i) return; e.preventDefault(); e.stopPropagation(); if (document.activeElement === i && e.pointerType !== 'mouse') i.blur(); else { i.focus(); tipbPlace(i.closest('.tipw')); } }, true); // dans un <summary>, le clic n'ouvre pas la section
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('tipi')) document.activeElement.blur(); }, true);
document.addEventListener('scroll', () => { const a = document.activeElement; if (a && a.classList && a.classList.contains('tipi')) a.blur(); }, true);
(() => { const d = document.getElementById('vzBox'); if (!d) return; try { d.open = LS.get('copo.vzOpen') === '1'; } catch { } d.addEventListener('toggle', () => { try { LS.set('copo.vzOpen', d.open ? '1' : '0'); } catch { } if (d.open && S.imgSel) { const im = imgById(S.imgSel); if (im) vzSync(im); } }); })();

function vzSync(im) {
  const p = vzP(im), G = vzGray(im), cvs = $('#vzCv'); if (!cvs) return;
  if (!G) { $('#vzInfo').textContent = tr('Image en cours de chargement…'); const el = ensureImg(im.id); if (el && !el.complete) el.addEventListener('load', () => { if (S.imgSel === im.id) vzSync(im); }, { once: true }); return; }
  if (p.t == null) p.t = vzOtsu(G);
  $('#vzT').value = p.t; $('#vzL').value = p.l; { const sm = $('#vzSum'); if (sm) sm.textContent = trf('seuil {t} · lissage {l}', { t: p.t, l: p.l }); } $('#vzInv').checked = !!p.inv; $('#vzTv').textContent = p.t; $('#vzLv').textContent = p.l;
  cancelAnimationFrame(vzRaf); vzRaf = requestAnimationFrame(() => {
    const loops = vzTrace(G, p.t, p.inv, p.l), Wc = Math.max(80, Math.min(Math.round(cvs.parentElement.clientWidth - 22 || 280), Math.round(170 * G.W / G.H))), k = Wc / G.W, Hc = Math.round(G.H * k);
    cvs.width = Wc * devicePixelRatio; cvs.height = Hc * devicePixelRatio; cvs.style.height = Hc + 'px';
    const c = cvs.getContext('2d'); c.setTransform(devicePixelRatio * k, 0, 0, devicePixelRatio * k, 0, 0); c.fillStyle = '#fff'; c.fillRect(0, 0, G.W, G.H);
    c.globalAlpha = 0.35; c.drawImage(ensureImg(im.id), 0, 0, G.W, G.H); c.globalAlpha = 1;
    c.beginPath(); for (const lp of loops) { c.moveTo(lp[0][0], lp[0][1]); for (const q of lp) c.lineTo(q[0], q[1]); c.closePath(); }
    c.fillStyle = 'rgba(30,30,30,.55)'; c.fill('evenodd'); c.lineWidth = 1.4 / k; c.strokeStyle = '#e8590c'; c.stroke();
    const nn = loops.reduce((a, lp) => a + lp.length, 0); $('#vzInfo').textContent = trf('{n} contours · {m} points', { n: loops.length, m: nn });
  });
}
function vzMake(im) {
  const p = vzP(im), G = vzGray(im); if (!G) return toast('Image pas encore chargée.');
  const loops = vzTrace(G, p.t ?? vzOtsu(G), p.inv, p.l); if (!loops.length) return toast('Aucun contour trouvé : ajustez le seuil ou cochez Inverser.');
  const f = imgFrame(im), map = q => f.P((q[0] / G.W - 0.5) * im.w, (0.5 - q[1] / G.H) * im.h), g = loops.length > 1 ? uid() : null;
  S.sel.clear(); S.imgSel = null; let n = 0;
  for (const lp of loops) { const sh = mkShape(vzNodes(lp, p.l, map), true, { g }); if (sh) { S.sel.add(sh.id); n++; } }
  commit(); renderImgPanel(); renderSel(); draw(); toast(trf('{n} contours créés (groupés). Vous pouvez masquer l’image.', { n }));
}
function imgSet(fn) { const im = S.imgSel && imgById(S.imgSel); if (!im) return; fn(im); commit(false); renderImgPanel(); draw(); }
function bindImgPanel() {
  const num = id => parseFloat(String($(id).value).replace(',', '.'));
  $('#imX').onchange = $('#imY').onchange = () => imgSet(im => { const q = inXY(isFinite(num('#imX')) ? num('#imX') : 0, isFinite(num('#imY')) ? num('#imY') : 0); im.x = q[0]; im.y = q[1]; });
  $('#imW').onchange = () => imgSet(im => { const v = num('#imW'); if (!(v > 0)) return; if ($('#imLockR').checked) im.h *= v / im.w; im.w = v; });
  $('#imH').onchange = () => imgSet(im => { const v = num('#imH'); if (!(v > 0)) return; if ($('#imLockR').checked) im.w *= v / im.h; im.h = v; });
  $('#imR').onchange = () => imgSet(im => { const v = num('#imR'); if (isFinite(v)) im.rot = ((v % 360) + 540) % 360 - 180; });
  $('#imO').oninput = () => { const im = S.imgSel && imgById(S.imgSel); if (!im) return; im.opacity = (+$('#imO').value) / 100; $('#imOv').textContent = $('#imO').value + ' %'; draw(); };
  $('#imO').onchange = () => commit(false);
  const vzIn = () => { const im = S.imgSel && imgById(S.imgSel); if (!im) return; const p = vzP(im); p.t = +$('#vzT').value; p.l = +$('#vzL').value; p.inv = $('#vzInv').checked; vzSync(im); };
  $('#vzT').oninput = $('#vzL').oninput = $('#vzInv').onchange = vzIn; $('#vzT').onchange = $('#vzL').onchange = () => commit(false);
  cw.addEventListener('dragover', e => { if ([...(e.dataTransfer.items || [])].some(i => i.kind === 'file')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  cw.addEventListener('drop', e => {
    const f = [...(e.dataTransfer.files || [])]; if (!f.length) return; e.preventDefault();
    const r = cv.getBoundingClientRect(), at = [wx(e.clientX - r.left), wy(e.clientY - r.top)];
    const pj = f.find(x => /\.(copo|json)$/i.test(x.name)); if (pj) { pj.text().then(t => { try { openProjectText(t); } catch (er) { toast(er.message || 'Fichier illisible.'); } }); return; }
    const im = f.find(x => /^image\//.test(x.type) && !/svg/.test(x.type)), sv = f.find(x => /svg/.test(x.type) || /\.svg$/i.test(x.name)), pd = f.find(x => /\.(pdf|ai)$/i.test(x.name) || x.type === 'application/pdf');
    if (pd) { importPdfFile(pd); return; }
    if (im) insertImageFile(im, at); else if (sv) sv.text().then(t => { try { const n = importSVG(t); commit(); renderSel(); fit(); toast(n + ' vecteur(s) importé(s).'); } catch (er) { toast(er.message); } });
    else toast('Déposez une image, un fichier SVG, PDF ou AI, ou un projet .copo.');
  });
  $('#fImg').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) insertImageFile(f); };
}
async function idbPutImg(id, src) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('images', 'readwrite'); tx.objectStore('images').put({ id, src }); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function idbGetImgs() { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('images').objectStore('images').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); }
async function loadImgData() { try { for (const r of await idbGetImgs()) { if (r.id.startsWith('rel_')) relGrid[r.id.slice(4)] = relUnpack(r.src); else if (r.id.startsWith('relm_')) relMesh[r.id.slice(5)] = r.src; else if (r.id !== 'send_dir' && r.id !== 'proj_handle') imgData[r.id] = r.src; } } catch (e) { } relRegenOld(); relDirty = true; { const T = S.tps.filter(t => t.type === 'relief' || (t.p && t.p.proj) || (t.relIds && t.relIds.length)); if (T.length) { T.forEach(computeTP); gcDirty = true; renderTpList(); } } relPanel(); renderImgPanel(); draw(); } // au démarrage, les reliefs arrivent après le calcul des parcours : on recalcule ceux qui en dépendent
function imgAct(a) {
  if (a === 'relImg') { $('#fRelImg').click(); return true; }
  if (a === 'relStl') { $('#fRelStl').click(); return true; }
  if (a === 'relFit') { relSet(i => { const st = S.stock, k = Math.min(st.w / i.w, st.h / i.h) * 0.98; if ($('#rlLock').checked) i.zH *= k; i.w *= k; i.h *= k; i.rot = 0; i.x = st.w / 2; i.y = st.h / 2; }); return true; }
  if (a === 'relClip') { const it = relCur(); if (!it) return true; relClipPick = it.id; S.sel.clear(); (it.clip || []).forEach(id => { if (shapeById(id)) S.sel.add(id); }); renderSel(); if (S.ui.tool !== 'select') setTool('select'); relPanel(true); draw(); return true; }
  if (a === 'relClipOk') { const it = S.relief.items.find(x => x.id === relClipPick), sh = selShapes().filter(x => x.closed && x.pts && x.pts.length > 2); relClipPick = null; if (it && sh.length) { S.relSel = it.id; S.sel.clear(); renderSel(); relSet(i => { i.clip = sh.map(x => x.id); }); toast(trf('Relief limité par {n} vecteur(s).', { n: sh.length })); } else { S.sel.clear(); renderSel(); relPanel(true); draw(); } return true; }
  if (a === 'relClipNo') { relClipPick = null; S.sel.clear(); renderSel(); relPanel(true); draw(); return true; }
  if (a === 'relUnclip') { relSet(i => { delete i.clip; }); return true; }
  if (a === 'relOutline') { const it = relCur(); if (!it) { toast(tr('Sélectionnez d’abord un relief.')); return true; } relOutline(it); return true; }
  if (a === 'relCenter') { const its = relItems(); if (its.length > 1) { const b = boxOf(its.map(relBox)), dx = S.stock.w / 2 - (b.x0 + b.x1) / 2, dy = S.stock.h / 2 - (b.y0 + b.y1) / 2; its.forEach(it => relMoveBy(it, dx, dy)); relOrgDone(); return true; } relSet(i => { i.x = S.stock.w / 2; i.y = S.stock.h / 2; }); return true; }
  if (a === 'relRot0') { relSet(i => { const t = (+i.rx || 0) || (+i.ry || 0); i.rot = 0; i.rx = 0; i.ry = 0; if (t && i.kind === 'stl') rvReraster(i, true); }); return true; }
  if (a === 'relDel') { const it = relCur(); if (!it) return true; relBump(); S.relief.items = S.relief.items.filter(x => x !== it); S.relSel = null; relDirty = true; commit(false); relPanel(); draw(); return true; }
  if (a === 'relView') { VIEWS.d3 = true; VIEWS.userHid3 = false; viewsApply(); return true; }
  if (a === 'relGray') { relFromImage(); return true; }
  if (a === 'relDome' || a === 'relExt' || a === 'relSweep') { relFromDrawing({ relDome: 'dome', relExt: 'extrude', relSweep: 'sweep' }[a]); return true; }
  const im = S.imgSel && imgById(S.imgSel);
  if (a === 'imgInsert') { $('#fImg').click(); return true; }
  if (!im) { if (a.startsWith('img')) { toast('Sélectionnez d’abord une image.'); return true; } return false; }
  if (a === 'imgFit') imgSet(i => { const st = S.stock, k = Math.min(st.w / i.w, st.h / i.h); i.w *= k; i.h *= k; i.rot = 0; i.x = st.w / 2; i.y = st.h / 2; });
  else if (a === 'imgCenter') imgSet(i => { i.x = S.stock.w / 2; i.y = S.stock.h / 2; });
  else if (a === 'imgLock') imgSet(i => { i.locked = !i.locked; });
  else if (a === 'imgReset') imgSet(i => { i.rot = 0; });
  else if (a === 'imgTraceAuto') { const g = vzGray(im); if (!g) return toast('Image pas encore chargée.'), true; vzP(im).t = vzOtsu(g); commit(false); vzSync(im); }
  else if (a === 'imgTrace') vzMake(im);
  else if (a === 'imgDel') { S.images = S.images.filter(i => i !== im); S.imgSel = null; commit(false); renderImgPanel(); draw(); toast('Image retirée.'); }
  else return false;
  return true;
}

