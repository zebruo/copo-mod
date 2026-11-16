// ---------- fiche de gamme en PDF (A4, sans boîte d'impression) ----------
function loadScript(src) { return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); }
async function jsPdfLib() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  try { await loadScript('lib/jspdf.umd.min.js'); } catch (e) { }
  if (!(window.jspdf && window.jspdf.jsPDF)) { try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js'); } catch (e) { } }
  return window.jspdf && window.jspdf.jsPDF;
}
async function sheetPdf() {
  if (!gcTps().length) { toast(tr('Aucun parcours à mettre dans la fiche : calculez d’abord un parcours.')); return; }
  closeMenus && closeMenus();
  if (!$('#sheet').hidden) S.meta = { name: $('#shName').value.trim(), material: $('#shMat').value.trim(), notes: $('#shNotes').value };
  toast(tr('Création du PDF…'));
  const JsPDF = await jsPdfLib(); if (!JsPDF) { toast(tr('Bibliothèque PDF introuvable : placez lib/jspdf.umd.min.js à côté de COPO ou connectez-vous à Internet.')); return; }
  let html; try { html = sheetHTML(S.meta || {}); } catch (e) { console.error(e); toast(tr('La fiche n’a pas pu être créée.')); return; }
  const MW = 186, MH = 273, MX = 12, MY = 12, scale = 2.4; let PX = 704, pageH = PX * MH / MW;
  const fr0 = document.createElement('iframe'); fr0.setAttribute('aria-hidden', 'true'); fr0.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + PX + 'px;height:1200px;border:0;visibility:hidden';
  document.body.appendChild(fr0);
  try {
    await new Promise(res => { fr0.onload = res; fr0.srcdoc = html.replace('</head>', '<style>@page{margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important}body,body *{font-family:Arial,"Liberation Sans",Helvetica,sans-serif!important}.mono,code,kbd{font-family:"Courier New","Liberation Mono",monospace!important}</style></head>'); });
    const doc = fr0.contentDocument; await Promise.all([...doc.images].map(im => im.decode ? im.decode().catch(() => { }) : null)); if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
    // contenu plus large que la page (grand tableau) : on le met à l'échelle comme le ferait l'impression
    const wide = Math.ceil(doc.documentElement.scrollWidth); if (wide > PX) { PX = wide; pageH = PX * MH / MW; fr0.style.width = PX + 'px'; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
    const total = Math.ceil(doc.documentElement.scrollHeight); fr0.style.height = total + 'px';
    // coupures possibles : entre les blocs, jamais au milieu d'une ligne de tableau, d'un titre, d'une image ou d'un bloc « insécable »
    const atoms = [], forced = []; const top = el => el.getBoundingClientRect().top + doc.defaultView.scrollY, bot = el => el.getBoundingClientRect().bottom + doc.defaultView.scrollY;
    doc.querySelectorAll('body *').forEach(el => { const cs = doc.defaultView.getComputedStyle(el); if (cs.display === 'none') return; if (cs.breakBefore === 'page' || cs.pageBreakBefore === 'always') forced.push(top(el)); if (/^(TR|IMG|SVG|CANVAS|H1|H2|H3|H4|P|LI|FIGURE|CAPTION|THEAD)$/i.test(el.tagName) || cs.breakInside === 'avoid' || cs.pageBreakInside === 'avoid') { const a = top(el), b = bot(el); if (b - a > 1) atoms.push([a, b]); } if (cs.breakAfter === 'avoid' && el.nextElementSibling) { const nx = el.nextElementSibling, nb = Math.min(bot(nx), top(nx) + 120); atoms.push([top(el), nb]); } });
    const okCut = y => !atoms.some(([a, b]) => a < y - 0.5 && b > y + 0.5 && b - a < pageH);
    const cuts = [0]; let y0 = 0; forced.sort((a, b) => a - b);
    while (y0 < total - 2) {
      const f = forced.find(v => v > y0 + 20 && v <= y0 + pageH); if (f !== undefined) { cuts.push(f); y0 = f; continue; }
      let y = Math.min(total, y0 + pageH); if (y < total) { let c = y; while (c > y0 + pageH * 0.4 && !okCut(c)) c -= 2; y = c > y0 + pageH * 0.4 ? c : y; }
      cuts.push(y); y0 = y;
    }
    // rendu de la page entière dans une image SVG (foreignObject), puis découpe
    const xml = new XMLSerializer().serializeToString(doc.documentElement);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + PX + '" height="' + total + '"><foreignObject x="0" y="0" width="100%" height="100%">' + xml + '</foreignObject></svg>';
    const img = new Image(); img.decoding = 'sync'; await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const pdf = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], h = b - a; if (h < 1) continue;
      const c = document.createElement('canvas'); c.width = Math.round(PX * scale); c.height = Math.round(h * scale); const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, a, PX, h, 0, 0, c.width, c.height);
      if (i) pdf.addPage('a4');
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', MX, MY, MW, h * MW / PX);
    }
    pdf.setProperties({ title: tr('Fiche de gamme') + ' — ' + ((S.meta && S.meta.name) || 'COPO'), creator: 'COPO ' + COPO_VERSION });
    const nm = (S.meta && S.meta.name ? S.meta.name.replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() : 'copo') || 'copo';
    await saveFile('fiche-' + nm + '.pdf', pdf.output('arraybuffer'), tr('Fiche de gamme'));
  } catch (e) { console.error(e); toast(tr('Le PDF n’a pas pu être créé.') + ' ' + tr('Utilisez « Imprimer » puis « Enregistrer au format PDF ».')); }
  finally { fr0.remove(); }
}
$('#shPdf').onclick = () => tpEnsure(sheetPdf, tr('la fiche de gamme'));
function v3Open() {
  const tps = S.tps.filter(t => t.visible && !t.err && t.moves && t.moves.length);
  if (!tps.length) { toast('Aucun parcours à simuler : calculez d’abord un parcours.'); return; }
  v3HelpSync(); $('#v3d').hidden = false; { const sv = LS.get('copo.v3show'); if (sv && ['stock', 'both', 'paths'].includes(sv)) $('#v3Show').value = sv; } $('#v3OneRow').hidden = !S.activeTp; if (!S.activeTp) $('#v3One').checked = false;
  if (!v3Init()) { $('#v3d').hidden = true; toast('L’aperçu 3D demande WebGL 2, absent de ce navigateur. Essayez Chrome, Edge ou Firefox récents.'); return; }
  closeMenus && closeMenus();
  const t0 = performance.now(), q = +$('#v3Q').value || 1;
  const S3 = V3.S3 = makeSim(S.stock, tps, S.tools, S.machine.rapid, [500000, 1500000, 3500000][Math.max(0, Math.min(2, q - 1))]); V3.toolMesh.clear();
  v3BuildMesh(); v3BuildPaths(); v3BuildThreads(); v3ResetView(); V3.T = 0;
  const info = () => { const ms = Math.round(performance.now() - t0); $('#v3Info').textContent = S3.nx + ' × ' + S3.ny + ' points · ' + fr(S3.cx, 2) + ' mm' + (S3.ox || S3.oy || S3.nx * S3.cx < S3.w - 0.01 || S3.ny * S3.cy < S3.h - 0.01 ? ' (' + tr('zone usinée') + ')' : '') + ' · calcul ' + ms + ' ms'; };
  const fin = () => { V3.busy = false; v3Busy(false); V3.cur = simTo(S3, S3.total); V3.T = S3.total; V3.dirty = true; v3Play(false); v3Ui(); v3Req(); info(); };
  /* simulation longue : calcul en tâche de fond, la fenêtre 3D reste utilisable (brut affiché en attendant) ; résultat identique au calcul direct */
  if (!WK.off && S3.segs.length > 20000) {
    const n = S3.segs.length, A = new Float64Array(n * 6), KI = new Int32Array(n), F = new Uint8Array(n), Ks = [];
    for (let i = 0; i < n; i++) { const g = S3.segs[i], o = i * 6; A[o] = g.a[0]; A[o + 1] = g.a[1]; A[o + 2] = g.a[2]; A[o + 3] = g.b[0]; A[o + 4] = g.b[1]; A[o + 5] = g.b[2]; let k = Ks.indexOf(g.K); if (k < 0) { k = Ks.length; Ks.push(g.K); } KI[i] = k; F[i] = g.face; }
    V3.busy = true; v3Busy(true); V3.cur = simTo(S3, 0); V3.dirty = true; v3Play(false); v3Ui(); v3Req(); $('#v3Info').textContent = tr('Calcul de la simulation…');
    wkCall('sim', { w: S3.w, h: S3.h, t: S3.t, nx: S3.nx, ny: S3.ny, cx: S3.cx, cy: S3.cy, ox: S3.ox, oy: S3.oy, floor: S3.floor, A, KI, F, Ks: Ks.map(K => ({ di: K.di, dj: K.dj, dz: K.dz, n: K.n })) }, [A.buffer, KI.buffer, F.buffer])
      .then(r => { if (V3.S3 !== S3) return; S3.H.set(r.H); S3.B.set(r.B); S3.idx = S3.segs.length; S3.frac = 0; S3.last = null; fin(); }, () => { if (V3.S3 === S3) fin(); });
    return;
  }
  fin();
}
/* pendant le calcul en tâche de fond : lecture et déplacement dans le temps désactivés */
function v3Busy(on) { for (const id of ['v3First', 'v3Prev', 'v3Play', 'v3Next', 'v3Last', 'v3Pos', 'v3Q']) { const e = $('#' + id); if (e) e.disabled = !!on; } }
function v3Close() { v3Play(false); $('#v3d').hidden = true; }
function v3Events(c) {
  let drag = null; const pts = new Map(); let pinch = null;
  c.addEventListener('contextmenu', e => e.preventDefault());
  c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: V3.dist }; drag = null; return; } const act = nav3dAct(e), r = c.getBoundingClientRect(); drag = act ? { x: e.clientX, y: e.clientY, pan: act === 'pan', sg: Math.cos(V3.pitch) < 0 ? -1 : 1 } : null; if (act === 'rot' && V3.S3) { const S3 = V3.S3, [ox, oy] = originOf(S.stock), RT = S.stock.rotary || {}, oz = RT.on ? (RT.z0 === 'axis' ? -S3.t / 2 : 0) : S.stock.originZ === 'bottom' ? -S3.t : 0, Wr = wrapInfo(); drag.P = orbitPivot(V3, V3.mvp, c.clientWidth, c.clientHeight, e.clientX - r.left, e.clientY - r.top, { planes: !Wr, x0: 0, x1: S3.w, y0: 0, y1: S3.h, z0: -S3.t, z1: 0, org: Wr ? wrapPt([ox, oy, oz]) : [ox, oy, oz] }, null); } });
  c.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
  c.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; V3.dist = Math.max(5, pinch.dist * pinch.d / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]))); v3Req(); return; }
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) { const k = V3.dist / c.clientHeight * 0.75, cy = Math.cos(V3.yaw), sy_ = Math.sin(V3.yaw), sp = Math.sin(V3.pitch), right = [-sy_, cy, 0], up = [-cy * sp, -sy_ * sp, Math.cos(V3.pitch)]; for (let i = 0; i < 3; i++) V3.tgt[i] += (-dx * right[i] + dy * up[i]) * k; }
    else camOrbit(V3, -dx * 0.008 * drag.sg, dy * 0.008, drag.P);
    v3Req();
  });
  const end = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; drag = null; };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  c.addEventListener('wheel', e => { e.preventDefault(); camZoom(V3, e, c, V3.mvp, Math.exp(e.deltaY * 0.0012), 5, 20000); v3Req(); }, { passive: false });
  c.addEventListener('dblclick', v3ResetView);
  $('#v3Play').onclick = () => { if (!V3.playing && V3.T >= V3.S3.total - 1e-9) v3Seek(0); v3Play(!V3.playing); };
  $('#v3Pos').oninput = e => { v3Play(false); v3Seek(V3.S3.total * e.target.value / 1000); };
  $('#v3First').onclick = () => { v3Play(false); v3Seek(0); }; $('#v3Last').onclick = () => { v3Play(false); v3Seek(V3.S3.total); };
  $('#v3Prev').onclick = () => v3Step(-1); $('#v3Next').onclick = () => v3Step(1);
  document.addEventListener('keydown', e => { if ($('#v3d').hidden || e.target.closest('input,select,textarea')) return; const k = e.key;
    if (k === 'ArrowRight') { e.preventDefault(); v3Step(1); } else if (k === 'ArrowLeft') { e.preventDefault(); v3Step(-1); } else if (k === 'Home') { e.preventDefault(); $('#v3First').click(); } else if (k === 'End') { e.preventDefault(); $('#v3Last').click(); } else if (k === ' ') { e.preventDefault(); $('#v3Play').click(); } }, true);
  $('#v3Q').onchange = () => { LS.set('copo.simQ', $('#v3Q').value); v3Open(); }; { const q = LS.get('copo.simQ'); if (q === '1' || q === '2' || q === '3') $('#v3Q').value = q; }
  $('#v3Tool').onchange = () => v3Req();
  try { $('#v3Draw').checked = LS.get('copo.v3draw') !== '0'; } catch { $('#v3Draw').checked = true; }
  $('#v3Draw').onchange = e => { try { LS.set('copo.v3draw', e.target.checked ? '1' : '0'); } catch { } v3Req(); };
  for (const [id, key, def] of [['v3Rel', 'copo.v3rel', '0'], ['v3Only', 'copo.v3only', '0']]) { let v = def; try { v = LS.get(key) || def; } catch { } $('#' + id).checked = v === '1'; $('#' + id).onchange = e => { try { LS.set(key, e.target.checked ? '1' : '0'); } catch { } V3.dirty = true; v3Req(); }; }
  $('#v3Show').onchange = () => { try { LS.set('copo.v3show', $('#v3Show').value); } catch { } v3Req(); };
  $('#v3One').onchange = () => { v3BuildPaths(); v3Req(); };
  $('#v3Face').onchange = () => v3Req();
  $('#v3Reset').onclick = v3ResetView;
  $('#v3Close').onclick = v3Close;
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#v3d').hidden) { e.stopPropagation(); v3Close(); } }, true);
  window.addEventListener('resize', () => { if (!$('#v3d').hidden) v3Req(); });
}


// ======================================================================
// Images de fond (calque de référence, non usinées)
// ======================================================================
const IMG = new Map(); let imgData = {};
const imgById = id => S.images.find(i => i.id === id);
function ensureImg(id) { if (IMG.has(id) || !imgData[id]) return IMG.get(id); const im = new Image(); im.onload = () => draw(); im.src = imgData[id]; IMG.set(id, im); return im; }
function imgFrame(im) { const r = (im.rot || 0) * Math.PI / 180, u = [Math.cos(r), Math.sin(r)], v = [-Math.sin(r), Math.cos(r)], P = (a, b) => [im.x + u[0] * a + v[0] * b, im.y + u[1] * a + v[1] * b]; return { u, v, P, corners: [P(-im.w / 2, -im.h / 2), P(im.w / 2, -im.h / 2), P(im.w / 2, im.h / 2), P(-im.w / 2, im.h / 2)] }; }
function imgLocal(im, p) { const f = imgFrame(im), d = [p[0] - im.x, p[1] - im.y]; return [d[0] * f.u[0] + d[1] * f.u[1], d[0] * f.v[0] + d[1] * f.v[1]]; }
function imgHit(p) { for (let k = S.images.length - 1; k >= 0; k--) { const im = S.images[k]; if (!im.visible || im.locked) continue; const l = imgLocal(im, p); if (Math.abs(l[0]) <= im.w / 2 && Math.abs(l[1]) <= im.h / 2) return im; } return null; }
function imgRotHandle(im) { const f = imgFrame(im), top = f.P(0, im.h / 2), off = 26 / S.view.s; return { base: top, h: [top[0] + f.v[0] * off, top[1] + f.v[1] * off] }; }
var IXF = false; // 2e clic sur l'image sélectionnée : poignées façon objets
function imgHandleAt(X, Y) {
  const im = S.imgSel && imgById(S.imgSel); if (!im || im.locked || !im.visible || !IXF) return null;
  let best = null, bd = 8; for (const h of relXfHandles(im)) { const d = Math.hypot(h.X - X, h.Y - Y); if (d < bd) { bd = d; best = h; } } if (!best) return null;
  if (best.k === 'r') return { kind: 'irot', im };
  const opp = [im.x - (best.w[0] - im.x), im.y - (best.w[1] - im.y)];
  return best.cx && best.cy ? { kind: 'iscale', im, sgn: [best.cx, best.cy], anchor: opp } : { kind: 'iedge', im, sgn: [best.cx, best.cy], anchor: opp };
}
function drawImages(C) {
  for (const im of S.images) {
    if (!im.visible) continue; const el = ensureImg(im.id), X = sx(im.x), Y = sy(im.y), w = im.w * S.view.s, h = im.h * S.view.s;
    ctx.save(); ctx.translate(X, Y); ctx.rotate(-(im.rot || 0) * Math.PI / 180); ctx.globalAlpha = im.opacity ?? 0.6;
    if (el && el.complete && el.naturalWidth) ctx.drawImage(el, -w / 2, -h / 2, w, h);
    else { ctx.strokeStyle = C.drawMuted; ctx.setLineDash([6, 4]); ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.stroke(); }
    ctx.restore();
  }
}
// hauteur (0..1) du relief à un point local, NaN là où il n'a pas de matière (trou d'une extrusion, fond transparent…)
function relAtLocal(it, lu, lv) { const f = relSrc(it), g = relGrid[it.id]; if (!f || !g) return NaN; const su = lu / it.w + 0.5, sv = 0.5 - lv / it.h; if (it.kind === 'image') { const i = Math.round(Math.max(0, Math.min(1, su)) * (g.nx - 1)), j = Math.round(Math.max(0, Math.min(1, sv)) * (g.ny - 1)); if (!(relSample(relMaskF(it), g.nx, g.ny, su, sv) >= 0.5)) return NaN; } const v = relSample(f, g.nx, g.ny, su, sv); return v !== v ? NaN : (it.invert ? 1 - v : v); }
// matière du relief au point local ou tout près (rayon r) : un STL ajouré ou une fine gravure reste facile à attraper
function relNear(it, lu, lv, r) { if (relAtLocal(it, lu, lv) === relAtLocal(it, lu, lv)) return true; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; for (const rr of [r * 0.5, r]) { const v = relAtLocal(it, lu + rr * Math.cos(a), lv + rr * Math.sin(a)); if (v === v) return true; } } return false; }
function relPickAt(p, r) { let best = null, ba = Infinity; // parmi les reliefs qui ont de la matière sous le curseur (ou tout près), le plus petit : souvent celui posé sur l'autre
  for (let k = S.relief.items.length - 1; k >= 0; k--) { const it = S.relief.items[k]; if (!it.visible || !relGrid[it.id] || relLinked(it)) continue; const l = imgLocal(it, p); if (Math.abs(l[0]) > it.w / 2 || Math.abs(l[1]) > it.h / 2) continue; if (!relNear(it, l[0], l[1], r)) continue; const a = it.w * it.h; if (a < ba) { ba = a; best = it; } }
  return best; }
function relHit(p) { if (!S.relief || S.relief.show === false) return null; return relPickAt(p, Math.max(1.5, 6 / S.view.s)); }
var RXF = false; // 2e clic sur l'élément sélectionné : poignées de taille et de rotation
function relXfHandles(it) { const a = (it.rot || 0) * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]], H = [], pad = 7, rp = 18;
  for (const cx of [-1, 0, 1]) for (const cy of [-1, 0, 1]) { if (!cx && !cy) continue; const w = [it.x + u[0] * cx * it.w / 2 + v[0] * cy * it.h / 2, it.y + u[1] * cx * it.w / 2 + v[1] * cy * it.h / 2], dX = u[0] * cx + v[0] * cy, dY = u[1] * cx + v[1] * cy, dl = Math.hypot(dX, dY) || 1;
    H.push({ k: 's', cx, cy, w, X: sx(w[0]) + dX / dl * pad, Y: sy(w[1]) - dY / dl * pad }); if (cx && cy) H.push({ k: 'r', cx, cy, X: sx(w[0]) + dX / dl * rp, Y: sy(w[1]) - dY / dl * rp }); }
  return H; }
function relHandleAt(X, Y) {
  const it = typeof relCur === 'function' && relCur(); if (!it || !it.visible || S.relief.show === false || S.ui.tool !== 'select' || relLinked(it) || !RXF) return null;
  let best = null, bd = 8; for (const h of relXfHandles(it)) { const d = Math.hypot(h.X - X, h.Y - Y); if (d < bd) { bd = d; best = h; } } if (!best) return null;
  if (best.k === 'r') return { kind: 'irot', im: it, rel: true };
  const opp = [it.x - (best.w[0] - it.x), it.y - (best.w[1] - it.y)];
  return best.cx && best.cy ? { kind: 'iscale', im: it, sgn: [best.cx, best.cy], anchor: opp, rel: true } : { kind: 'iedge', im: it, sgn: [best.cx, best.cy], anchor: opp, rel: true };
}
var relLastSel = null, relClipPick = null;
let relMulti = new Set(); // reliefs choisis en plus (Maj + clic), pour aligner et répartir
function relSelIds() { const ids = [...relMulti]; if (S.relSel && !ids.includes(S.relSel)) ids.push(S.relSel); return ids.filter(id => S.relief.items.some(i => i.id === id)); }
function selectRel(id, keep) { if (!keep) relMulti.clear(); if (S.relSel !== id) RXF = false; S.relSel = id; if (id) relLastSel = id; if (id) { S.sel.clear(); S.selDim = null; if (S.imgSel) { S.imgSel = null; renderImgPanel(); } renderSel(); } relPanel(); dRefresh(); draw(); }
function drawRelHandles(C) {
  if (relMulti.size && S.relief.show !== false) { ctx.save(); ctx.strokeStyle = C.acc; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); for (const it of relItems()) { if (it.id === S.relSel || !it.visible) continue; const cs = imgFrame(it).corners.map(q => [sx(q[0]), sy(q[1])]); ctx.beginPath(); cs.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke(); } ctx.restore(); }
  const it = typeof relCur === 'function' && relCur(); if (!it || !it.visible || S.relief.show === false || S.ui.tool !== 'select' || relLinked(it)) return;
  const f = imgFrame(it), cs = f.corners.map(q => [sx(q[0]), sy(q[1])]);
  ctx.save(); ctx.strokeStyle = C.acc; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath(); cs.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  if (RXF) for (const h of relXfHandles(it)) { ctx.beginPath(); if (h.k === 's') ctx.rect(h.X - 4.5, h.Y - 4.5, 9, 9); else ctx.arc(h.X, h.Y, 5, 0, 7); ctx.fillStyle = h.k === 's' ? C.panel : C.acc; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = C.acc; ctx.stroke(); }
  ctx.restore();
}
function drawImgHandles(C) {
  const im = S.imgSel && imgById(S.imgSel); if (!im || !im.visible || S.ui.tool !== 'select') return;
  const f = imgFrame(im), cs = f.corners.map(q => [sx(q[0]), sy(q[1])]);
  ctx.save(); ctx.strokeStyle = C.acc; ctx.lineWidth = 1; ctx.setLineDash(im.locked ? [2, 3] : [4, 3]); ctx.beginPath(); cs.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  if (IXF && !im.locked) for (const h of relXfHandles(im)) { ctx.beginPath(); if (h.k === 's') ctx.rect(h.X - 4.5, h.Y - 4.5, 9, 9); else ctx.arc(h.X, h.Y, 5, 0, 7); ctx.fillStyle = h.k === 's' ? C.panel : C.acc; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = C.acc; ctx.stroke(); }
  ctx.restore();
}
function imgCursor(X, Y) { const h = relHandleAt(X, Y) || imgHandleAt(X, Y); if (h) return h.kind === 'irot' ? 'grab' : h.kind === 'iedge' ? 'move' : 'nwse-resize'; return null; }
function imgDragMove(D, p, e) {
  const im = D.im;
  if (D.mode === 'imove') { if (D.rel) relDragBegin(im); const q = snap([p[0] + D.off[0], p[1] + D.off[1]]); im.x = q[0]; im.y = q[1]; setCoords(p, 'Centre ' + fr(outXY(im.x, im.y)[0]) + ' / ' + fr(outXY(im.x, im.y)[1])); }
  else if (D.mode === 'iscale') {
    const r = (im.rot || 0) * Math.PI / 180, u = [Math.cos(r), Math.sin(r)], v = [-Math.sin(r), Math.cos(r)], d = [p[0] - D.anchor[0], p[1] - D.anchor[1]];
    let w = Math.max(1, (d[0] * u[0] + d[1] * u[1]) * D.sgn[0]), h = Math.max(1, (d[0] * v[0] + d[1] * v[1]) * D.sgn[1]);
    if (!e.shiftKey) { let k = Math.max(w / D.w0, h / D.h0); if (e.ctrlKey || e.metaKey) { const big = Math.max(D.w0, D.h0); k = Math.max(1, Math.round(big * k)) / big; } w = D.w0 * k; h = D.h0 * k; } else if (e.ctrlKey || e.metaKey) { w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); }
    if (D.rel && !e.shiftKey && (!$('#rlLock') || $('#rlLock').checked)) im.zH = D.zH0 * w / D.w0;
    im.w = w; im.h = h; im.x = D.anchor[0] + u[0] * D.sgn[0] * w / 2 + v[0] * D.sgn[1] * h / 2; im.y = D.anchor[1] + u[1] * D.sgn[0] * w / 2 + v[1] * D.sgn[1] * h / 2;
    setCoords(p, fr(im.w) + ' × ' + fr(im.h) + ' mm' + (e.shiftKey ? ' (libre)' : ''));
  } else if (D.mode === 'iedge') { // poignée de côté : une seule dimension, côté opposé fixe
    const r = (im.rot || 0) * Math.PI / 180, u = [Math.cos(r), Math.sin(r)], v = [-Math.sin(r), Math.cos(r)], d = [p[0] - D.anchor[0], p[1] - D.anchor[1]], ax = D.sgn[0] ? u : v, sg = D.sgn[0] || D.sgn[1];
    const ds = (d[0] * ax[0] + d[1] * ax[1]) * sg; if (D.off === undefined) { const d0 = [D.p0[0] - D.anchor[0], D.p0[1] - D.anchor[1]]; D.off = (d0[0] * ax[0] + d0[1] * ax[1]) * sg - (D.sgn[0] ? D.w0 : D.h0); } let L = Math.max(1, ds - D.off); if (e.ctrlKey || e.metaKey) L = Math.max(1, Math.round(L));
    if (D.sgn[0]) im.w = L; else im.h = L; // poignée de côté : seule cette dimension change
    im.x = D.anchor[0] + ax[0] * sg * L / 2; im.y = D.anchor[1] + ax[1] * sg * L / 2; setCoords(p, fr(im.w) + ' × ' + fr(im.h) + ' mm');
  } else if (D.mode === 'irot') {
    let a = D.rot0 + (Math.atan2(p[1] - im.y, p[0] - im.x) - D.a0) * 180 / Math.PI; if (e.ctrlKey || e.metaKey) { const q = e.shiftKey ? 1 : 15; a = Math.round(a / q) * q; }
    im.rot = ((a % 360) + 540) % 360 - 180; setCoords(p, 'Angle ' + fr(im.rot, 1) + '°');
  }
  D.moved = true; if (D.rel) { const now = performance.now(); if (!D.tR || now - D.tR > 70) { relDirty = true; D.tR = now; } relPanel(true); } else renderImgPanel(true); draw();
}
function selectImg(id) { if (S.imgSel !== id) IXF = false; S.imgSel = id; if (id) { S.sel.clear(); S.selDim = null; S.relSel = null; renderSel(); relPanel(); } renderImgPanel(); dRefresh(); draw(); }
async function insertImageFile(file, at) {
  if (!file || !/^image\//.test(file.type)) { toast('Choisissez une image (JPG, PNG, WebP, GIF, BMP).'); return; }
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const el = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = url; }).catch(() => null);
  if (!el) { toast('Cette image ne peut pas être lue.'); return; }
  let src = url; const MAX = 2600, nw = el.naturalWidth, nh = el.naturalHeight;
  if (Math.max(nw, nh) > MAX || file.size > 3e6) { const k = Math.min(1, MAX / Math.max(nw, nh)), c = document.createElement('canvas'); c.width = Math.round(nw * k); c.height = Math.round(nh * k); c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); src = /png|gif|webp/.test(file.type) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9); }
  const id = uid(); imgData[id] = src; try { await idbPutImg(id, src); } catch (e) { }
  const st = S.stock, ratio = nh / nw; let w = st.w * 0.8, h = w * ratio; if (h > st.h * 0.8) { h = st.h * 0.8; w = h / ratio; }
  const c = at || [st.w / 2, st.h / 2];
  S.images.push({ id, name: file.name || 'image', x: c[0], y: c[1], w, h, rot: 0, opacity: 0.6, locked: false, visible: true });
  selectImg(id); commit(false); setTool('select'); toast('Image insérée. Poignées : coins pour redimensionner, rond pour pivoter.');
}
function renderImgPanel(soft) {
  const box = $('#imgProps'), ul = $('#imgList'); if (!box) return;
  const im = S.imgSel && imgById(S.imgSel); box.hidden = !im;
  if (im) {
    const o = outXY(im.x, im.y), set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
    set('#imX', +o[0].toFixed(2)); set('#imY', +o[1].toFixed(2)); set('#imW', +im.w.toFixed(2)); set('#imH', +im.h.toFixed(2)); set('#imR', +(im.rot || 0).toFixed(1)); set('#imO', Math.round((im.opacity ?? 0.6) * 100));
    $('#imOv').textContent = Math.round((im.opacity ?? 0.6) * 100) + ' %'; { const lb = $('#imLockBtn'), lt = tr(im.locked ? 'Déverrouiller' : 'Verrouiller'); lb.title = lt; lb.setAttribute('aria-label', lt); lb.setAttribute('aria-pressed', !!im.locked); lb.querySelector('path').setAttribute('d', im.locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'); }
    if (!soft) vzSync(im);
  }
  if (soft) return;
  ul.innerHTML = ''; if (!S.images.length) { ul.innerHTML = '<li class="hint">Aucune image. Insérez une photo ou un croquis pour dessiner par-dessus.</li>'; return; }
  for (const it of S.images.slice().reverse()) {
    const li = document.createElement('li'); li.className = 'imgrow' + (it.id === S.imgSel ? ' on' : '');
    li.innerHTML = '<img alt=""><span></span><button class="iconbtn" data-i="vis" aria-label="Visibilité" title="' + (it.visible ? 'Masquer' : 'Afficher') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' + (it.visible ? '' : '<path d="M4 4l16 16"/>') + '</svg></button><button class="iconbtn" data-i="lock" aria-label="Verrou" title="' + (it.locked ? 'Déverrouiller' : 'Verrouiller') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="1.5"/>' + (it.locked ? '<path d="M8 11V8a4 4 0 0 1 8 0v3"/>' : '<path d="M8 11V8a4 4 0 0 1 7.5-2"/>') + '</svg></button>';
    if (imgData[it.id]) li.querySelector('img').src = imgData[it.id]; li.querySelector('span').textContent = it.name;
    li.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { e.stopPropagation(); if (b.dataset.i === 'vis') it.visible = !it.visible; else it.locked = !it.locked; commit(false); renderImgPanel(); draw(); return; } selectImg(it.id); };
    ul.appendChild(li);
  }
}
