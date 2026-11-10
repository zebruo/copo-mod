// ---------- polices : dossier de l'utilisateur (tous navigateurs) + polices installées (Chrome / Edge) ----------
const escHtml = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FONT_RE = /\.(ttf|otf|woff|ttc|svg)$/i;
let UF = [], ufSeq = 0, LF = null, lfFail = null, famU = new Map(), famS = new Map(), famV = new Map(), fpCur = null, ufArm = 0;
function parseFontBuf(buf, ps) {
  const dv = new DataView(buf);
  if (dv.getUint32(0) !== 0x74746366) return opentype.parse(buf);
  const n = dv.getUint32(8); let first = null;
  for (let k = 0; k < n; k++) {
    const off = dv.getUint32(12 + 4 * k), nt = dv.getUint16(off + 4), len = 12 + 16 * nt; let minOff = Infinity;
    for (let i = 0; i < nt; i++) minOff = Math.min(minOff, dv.getUint32(off + 12 + 16 * i + 8));
    if (minOff < len) continue;
    const copy = buf.slice(0); new Uint8Array(copy).set(new Uint8Array(buf, off, len), 0);
    try { const f = opentype.parse(copy); if (!first) first = f; const nm = f.names && f.names.postScriptName; if (!ps || (nm && Object.values(nm).includes(ps))) return f; } catch (e) { }
  }
  if (first) return first; throw new Error('collection');
}
function idb() { return new Promise((res, rej) => { try { const r = indexedDB.open('copo', 2); r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('fonts')) db.createObjectStore('fonts', { keyPath: 'name' }); if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); }
async function idbAll() { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('fonts').objectStore('fonts').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); }
async function idbPut(items) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('fonts', 'readwrite'), st = tx.objectStore('fonts'); items.forEach(it => st.put(it)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function idbClear() { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('fonts', 'readwrite'); tx.objectStore('fonts').clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
function nameOf(f, k) { const n = f.names && f.names[k]; return n ? (n.fr || n.en || Object.values(n)[0] || '') : ''; }
function registerUF(name, buf, src) {
  if (/\.svg$/i.test(name)) { let d; try { d = svgFontParseText(new TextDecoder().decode(buf), name); } catch (e) { return null; } UF = UF.filter(u => u.name !== name); const u = { kind: 'u', name, family: d.family, style: 'Regular', full: d.family, css: '', svg: true, font: svgFontFrom(d), src }; UF.push(u); return u; }
  if (!window.opentype) return null; let f; try { f = parseFontBuf(buf); } catch (e) { return null; }
  UF = UF.filter(u => u.name !== name);
  const family = nameOf(f, 'preferredFamily') || nameOf(f, 'fontFamily') || name.replace(FONT_RE, ''), style = nameOf(f, 'preferredSubfamily') || nameOf(f, 'fontSubfamily') || 'Regular';
  const full = nameOf(f, 'fullName') || family + ' ' + style, css = 'copo-uf-' + (++ufSeq);
  try { const ff = new FontFace(css, buf.slice(0)); ff.load().then(x => { document.fonts.add(x); }).catch(() => { }); } catch (e) { }
  const u = { kind: 'u', name, family, style, full, css, font: f, src }; UF.push(u); return u;
}
function updateUFCount() { const n = UF.filter(u => u.src !== 'copo').length, el = $('#ufCount'); el.hidden = !n; el.textContent = n ? n + ' police' + (n > 1 ? 's' : '') + ' dans votre dossier de polices COPO.' : ''; $('#ufClear').hidden = !UF.some(u => u.src === 'idb'); }
async function addFontFiles(files) {
  const list = files.filter(f => FONT_RE.test(f.name)); if (!list.length) { toast('Aucun fichier .ttf, .otf, .woff ou .svg dans cette sélection.'); return; }
  if (!window.opentype && !list.every(f => /\.svg$/i.test(f.name))) { toast('Lecteur de polices indisponible.'); return; }
  const ok = [], items = []; let bad = 0;
  for (const file of list) { try { const buf = await file.arrayBuffer(), u = registerUF(file.name, buf, 'idb'); if (u) { ok.push(u); items.push({ name: file.name, buf }); } else bad++; } catch (e) { bad++; } }
  let kept = true; try { await idbPut(items); } catch (e) { kept = false; }
  updateUFCount();
  if (!ok.length) { toast('Aucune police lisible dans cette sélection.'); return; }
  selectUF(ok[0], true);
  toast(ok.length + ' police' + (ok.length > 1 ? 's ajoutées' : ' ajoutée') + (bad ? ' · ' + bad + ' illisible' + (bad > 1 ? 's' : '') : '') + (kept ? '.' : ' (non mémorisées : stockage du navigateur indisponible).'));
  act('fpGoto'); fpOpen(true);
}
function selectUF(u, silent, keepOpen) {
  S.font = u.font; S.fontLabel = u.full; setTimeout(() => { txLive(); txUi(); }, 0); fpCur = { kind: 'u', family: u.family };
  const nm = $('#fontName'); nm.textContent = u.full; nm.style.fontFamily = u.css ? '"' + u.css + '", sans-serif' : '';
  $$('#fpStyles button').forEach(b => b.classList.toggle('on', b.textContent === u.style));
  LS.set('copo.font', 'u:' + u.name); fpMsg('');
  if (!keepOpen) fpClose();
  if (!silent) toast('Police « ' + u.full + ' » prête. Outil Texte : cliquez dans la vue 2D.');
  if (S.ui.tool === 'text') setTool('text');
}
function fpMsg(m) { const h = $('#fpHint'); h.textContent = m; h.hidden = !m; }
function fpClose() { $('#fpPop').hidden = true; $('#fpBtn').setAttribute('aria-expanded', 'false'); }
function groupBy(list) { const m = new Map(); for (const f of list) { if (!m.has(f.family)) m.set(f.family, []); m.get(f.family).push(f); } return new Map([...m].sort((a, b) => a[0].localeCompare(b[0], 'fr'))); }
async function fpOpen(force) {
  const pop = $('#fpPop'); if (!pop.hidden && !force) { fpClose(); return; }
  if ('queryLocalFonts' in window && !LF && !lfFail) { try { LF = await window.queryLocalFonts(); } catch (e) { lfFail = (e && e.name) || 'erreur'; } }
  famU = groupBy(UF); famS = LF ? groupBy(LF) : new Map(); famV = groupBy(VF);
  if (!famU.size && !famS.size && !famV.size) {
    fpMsg(!('queryLocalFonts' in window) ? 'Ce navigateur ne donne pas la liste des polices installées. Ouvrez votre dossier de polices avec le bouton ci-dessous : elles apparaîtront ici avec leur aperçu.'
      : lfFail === 'NotAllowedError' ? 'L’accès aux polices de l’ordinateur a été refusé. Autorisez-le dans les réglages du site, ou ouvrez un dossier de polices avec le bouton ci-dessous.'
      : 'Les polices de l’ordinateur ne sont pas accessibles ici. Ouvrez un dossier de polices avec le bouton ci-dessous.');
    return;
  }
  fpMsg(''); $('#fpSearch').value = ''; fpRender(''); pop.hidden = false; $('#fpBtn').setAttribute('aria-expanded', 'true'); $('#fpSearch').focus();
}
function fpShow() { try { const o = JSON.parse(LS.get('copo.fpShow') || 'null'); if (o) return { v: o.v !== false, s: o.s !== false }; } catch { } return { v: true, s: true }; }
function fpShowSet() { const o = { v: $('#fpShowV').checked, s: $('#fpShowS').checked }; try { LS.set('copo.fpShow', JSON.stringify(o)); } catch { } fpRender($('#fpSearch').value); }
function fpRender(q) {
  { const sh = fpShow(); $('#fpShowV').checked = sh.v; $('#fpShowS').checked = sh.s; }
  const ul = $('#fpList'), norm = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), nq = norm(q || ''), sample = String(S.ui.text || '').trim() || 'AaBbCc 0123';
  ul.innerHTML = ''; $('#fpStyles').innerHTML = ''; let n = 0;
  const famUo = groupBy(UF.filter(u => u.src !== 'copo')), famC = groupBy(UF.filter(u => u.src === 'copo'));
  const secs = [['Mon dossier de polices', famUo, 'u'], ['Polices à trait unique (fournies avec COPO)', famV, 'v'], ['Polices décoratives (fournies avec COPO)', famC, 'u', 'c'], ['Polices de l’ordinateur', famS, 's']];
  const show = fpShow();
  for (const [title, map, kind, grp] of secs) {
    if (!map.size || ((kind === 'v' || grp === 'c') && !show.v) || (kind === 's' && !show.s)) continue; let head = null;
    for (const [fam, list] of map) {
      if (nq && !norm(fam).includes(nq)) continue; if (++n > 800) break;
      if (!head) { head = document.createElement('li'); head.className = 'fp-sec'; head.textContent = title; ul.appendChild(head); }
      const li = document.createElement('li'); li.setAttribute('role', 'option'); li.tabIndex = -1; li.className = fpCur && fpCur.kind === kind && fpCur.family === fam ? 'on' : '';
      li.innerHTML = '<span class="fp-name"></span><span class="fp-prev"></span>'; li.querySelector('.fp-name').textContent = fam + (list.length > 1 ? ' · ' + list.length + ' styles' : '');
      const reg = list.find(f => /^(regular|normal|standard|book|roman)$/i.test(f.style)) || list[0], pv = li.querySelector('.fp-prev'); pv.textContent = sample;
      if (kind === 'v' || reg.svg) { pv.textContent = ''; pv.innerHTML = svgPreview(kind === 'v' ? vfFont(reg) : reg.font, sample.slice(0, 16)); } else pv.style.fontFamily = kind === 'u' ? '"' + reg.css + '", sans-serif' : '"' + fam.replace(/"/g, '') + '", sans-serif';
      li.onclick = () => fpPickFamily(kind, fam, li); li.onkeydown = e => { if (e.key === 'Enter') li.click(); };
      ul.appendChild(li);
    }
  }
  if (show.s && !famS.size && famU.size && !nq) { const li = document.createElement('li'); li.className = 'fp-none'; li.textContent = 'Polices de l’ordinateur : disponibles dans Chrome ou Edge.'; ul.appendChild(li); }
  if (!n) ul.insertAdjacentHTML('afterbegin', '<li class="fp-none">' + tr(nq ? 'Aucune police ne correspond.' : (!show.v && !show.s ? 'Cochez « Polices de COPO » ou « Polices de l’ordinateur ».' : 'Aucune police dans les catégories cochées.')) + '</li>');
}
function fpPickFamily(kind, fam, li) {
  $$('#fpList li.on').forEach(x => x.classList.remove('on')); li.classList.add('on');
  const list = (kind === 'u' ? famU : kind === 'v' ? famV : famS).get(fam), box = $('#fpStyles'); box.innerHTML = '';
  const reg = list.find(f => /^(regular|normal|standard|book|roman)$/i.test(f.style)) || list[0], load = (f, keep) => kind === 'u' ? selectUF(f, false, keep) : kind === 'v' ? selectVF(f, false, keep) : fpLoad(f, false, keep);
  if (list.length === 1) { load(reg, false); return; }
  for (const f of list) { const b = document.createElement('button'); b.type = 'button'; b.textContent = f.style; b.onclick = () => load(f, false); if (f === reg) b.classList.add('on'); if (kind === 'u') b.style.fontFamily = '"' + f.css + '", sans-serif'; box.appendChild(b); }
  load(reg, true);
}
async function fpLoad(fd, silent, keepOpen) {
  try {
    if (!window.opentype) throw new Error('lib');
    const buf = await (await fd.blob()).arrayBuffer(); S.font = parseFontBuf(buf, fd.postscriptName); S.fontLabel = fd.fullName; setTimeout(() => { txLive(); txUi(); }, 0); fpCur = { kind: 's', family: fd.family };
    const nm = $('#fontName'); nm.textContent = fd.fullName; nm.style.fontFamily = '"' + fd.family.replace(/"/g, '') + '", sans-serif';
    $$('#fpStyles button').forEach(b => b.classList.toggle('on', b.textContent === fd.style));
    LS.set('copo.font', 's:' + fd.postscriptName); fpMsg('');
    if (!keepOpen) fpClose();
    if (!silent) toast('Police « ' + fd.fullName + ' » prête. Outil Texte : cliquez dans la vue 2D.');
    if (S.ui.tool === 'text') setTool('text');
  } catch (e) { if (!silent) toast(e.message === 'lib' ? 'Lecteur de polices indisponible.' : 'Cette police ne peut pas être lue (format non pris en charge). Essayez un autre style ou une autre police.'); }
}
$('#fpShowV').onchange = $('#fpShowS').onchange = fpShowSet;
document.addEventListener('click', e => { if (!e.target.closest('#fontPick') && !e.target.closest('[data-act="fpGoto"]') && !$('#fpPop').hidden) fpClose(); });
$('#fpSearch').addEventListener('input', e => fpRender(e.target.value));
$('#fpSearch').addEventListener('keydown', e => { if (e.key === 'Escape') { fpClose(); $('#fpBtn').focus(); } if (e.key === 'ArrowDown') { const f = $('#fpList li[role=option]'); if (f) { e.preventDefault(); f.focus(); } } });
$('#fpList').addEventListener('keydown', e => { const li = e.target.closest('li'); if (!li) return; if (e.key === 'ArrowDown' && li.nextElementSibling) { e.preventDefault(); li.nextElementSibling.focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); (li.previousElementSibling || $('#fpSearch')).focus(); } if (e.key === 'Escape') { fpClose(); $('#fpBtn').focus(); } });
(async () => {
  try { for (const it of await idbAll()) registerUF(it.name, it.buf, 'idb'); } catch (e) { }
  if (/^https?:$/.test(location.protocol)) { try { const r = await fetch('fonts/fonts.json', { cache: 'no-cache' }); if (r.ok) { for (const n of await r.json()) { try { const b = await (await fetch('fonts/' + encodeURIComponent(n))).arrayBuffer(); registerUF(n, b, 'site'); } catch (e) { } } } } catch (e) { } }
  await new Promise(res => { if (window.COPO_DECO_FONTS) return res(); const sc = document.createElement('script'); sc.src = 'fonts/polices-decoratives.js'; sc.onload = sc.onerror = () => res(); document.head.appendChild(sc); });
  if (Array.isArray(window.COPO_DECO_FONTS)) for (const d of window.COPO_DECO_FONTS) { try { const bin = atob(d.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); const u = registerUF(d.name, u8.buffer, 'copo'); if (u && d.family) { u.family = d.family; u.full = d.family + ' ' + u.style; } } catch (e) { } }
  updateUFCount();
  const last = LS.get('copo.font') || '';
  await new Promise(res => { if (window.COPO_SVG_FONTS) return res(); const sc = document.createElement('script'); sc.src = 'fonts/polices-trait-unique.js'; sc.onload = sc.onerror = () => res(); document.head.appendChild(sc); }); registerVF();
  if (last.startsWith('v:')) { const v = VF.find(x => x.family === last.slice(2)); if (v) selectVF(v, true, true); return; }
  if (last.startsWith('u:')) { const u = UF.find(x => x.name === last.slice(2)); if (u) selectUF(u, true, true); return; }
  try { if (!last || !('queryLocalFonts' in window) || !navigator.permissions) return; const st = await navigator.permissions.query({ name: 'local-fonts' }); if (st.state !== 'granted') return; const r = await window.queryLocalFonts({ postscriptNames: [last.replace(/^s:/, '')] }); if (r && r[0]) fpLoad(r[0], true, true); } catch (e) { }
})();
function tabTpCur() { return S.tabTp && S.tps.find(x => x.id === S.tabTp); }
function tabCountUi() { const el = $('#tabCount'), tp = tabTpCur(); if (el) el.textContent = tp ? tp.name + ' · ' + ((tp.tabs || []).length) + ' pont(s)' : ''; }
function tabDown(p) {
  const tp = tabTpCur(); if (!tp || !tp.loops) { toast('Ouvrez un parcours de profil puis « Placer à la main ».'); return; }
  if (tp.p.tabMode !== 'manual') { tp.p.tabMode = 'manual'; tp.p.tabPts = (tp.tabs || []).map(t => [t.x, t.y]); }
  const rHit = Math.max(9 / S.view.s, ((+tp.p.tabL || 0) + 2) / 2), idx = tp.p.tabPts.findIndex(q => hyp(q, p) < rHit);
  if (idx >= 0) { drag = { mode: 'tabdrag', tp, idx, moved: false, start: p }; return; }
  const pr = projectOnLoops(tp.loops, p);
  if (pr && pr.d * S.view.s < 14) { tp.p.tabPts.push([pr.x, pr.y]); tabChanged(tp); }
  else toast('Cliquez sur le parcours pour y ajouter un pont.');
}
function tabChanged(tp) {
  tp.p.tabs = true;
  if (S.editTp === tp.id && S.form) { S.form.tabs = true; S.form.tabMode = tp.p.tabMode; S.form.tabPts = clone(tp.p.tabPts || []); }
  computeTP(tp); commit(false); gcDirty = true; renderTpList(); renderForm(); tabCountUi(); draw();
}
function shapeToSvgD(s, X, Y) {
  const f = v => String(Math.round(v * 10000) / 10000), P = (x, y) => f(X(x)) + ' ' + f(Y(y)), n0 = s.nodes[0]; let d = 'M' + P(n0.x, n0.y);
  for (let k = 0; k < nseg(s); k++) { const g = segOf(s, k); d += g.line ? ' L' + P(g.p3[0], g.p3[1]) : ' C' + P(g.c1[0], g.c1[1]) + ' ' + P(g.c2[0], g.c2[1]) + ' ' + P(g.p3[0], g.p3[1]); }
  return d + (s.closed ? ' Z' : '');
}
function exportSVG(onlySel) { const svg = svgString(onlySel); if (svg) saveFile(onlySel ? 'selection-copo.svg' : 'dessin-copo.svg', svg, 'SVG'); }
function svgString(onlySel) {
  const list = onlySel ? selShapes() : S.shapes.filter(shown); if (!list.length) { toast(onlySel ? 'Sélectionnez d’abord des vecteurs.' : 'Aucun vecteur à exporter.'); return null; }
  const b = bbox(list), x0 = onlySel ? b.x0 : Math.min(0, b.x0), y0 = onlySel ? b.y0 : Math.min(0, b.y0), x1 = onlySel ? b.x1 : Math.max(S.stock.w, b.x1), y1 = onlySel ? b.y1 : Math.max(S.stock.h, b.y1);
  const W = Math.max(0.01, x1 - x0), H = Math.max(0.01, y1 - y0), X = x => x - x0, Y = y => y1 - y, f = v => String(Math.round(v * 10000) / 10000), esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let body = '';
  for (const l of S.layers) { const ss = list.filter(sh => (sh.layer || S.layers[0].id) === l.id); if (!ss.length) continue; body += '  <g id="' + esc(l.name.replace(/\s+/g, '_')) + '" data-name="' + esc(l.name) + '" fill="none" stroke="' + esc(l.color || '#000000') + '" stroke-width="0.25">\n' + ss.map(sh => '    <path d="' + shapeToSvgD(sh, X, Y) + '"/>').join('\n') + '\n  </g>\n'; }
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + f(W) + 'mm" height="' + f(H) + 'mm" viewBox="0 0 ' + f(W) + ' ' + f(H) + '">\n  <title>COPO</title>\n' + body + '</svg>\n';
}
var textPick = null;
// texte déformé pour remplir l'espace entre une courbe du bas et une courbe du haut (enveloppe)
function textBetween(str, A, B, quiet) {
  const hb = +S.ui.textH || 20, loops = (+S.ui.textSpace ? textLine(str, hb, [0, 0]).map(l => Object.assign(l.nodes, { open: !l.closed })) : textNodes(str, hb, [0, 0])); if (!loops.length) { if (!quiet) toast(tr('Rien à écrire.')); return null; }
  const polys = loops.map(l => { const sh = refresh({ nodes: l.map(cloneNode), closed: !l.open }), P = sh.pts.slice(); if (sh.closed && P.length > 1 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-9) P.pop(); return { P, closed: sh.closed }; });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const { P } of polys) for (const q of P) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const W = Math.max(1e-6, x1 - x0), Hh = Math.max(1e-6, y1 - y0), dmax = Math.max(0.05, Math.min(W, Hh) / 60);
  const prep = sh => { let P = sh.pts.slice(); if (sh.closed) P.push(P[0]); if (P[P.length - 1][0] < P[0][0]) P = P.reverse(); const c = cumLen(P); return { P, c, L: c[c.length - 1] }; }, CA = prep(A), CB = prep(B);
  if (CA.L < 1e-6 || CB.L < 1e-6) { if (!quiet) toast(tr('Courbe trop courte.')); return null; }
  const at = (C, u) => ptAtOpen(C.P, C.c, Math.max(0, Math.min(1, u)) * C.L), mg = Math.max(0, +S.ui.textOff || 0), map = q => { const u = (q[0] - x0) / W, v = (q[1] - y0) / Hh; let a = at(CA, u), b = at(CB, u); if (mg) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.min(mg, L / 2 - 1e-3); if (L > 1e-9 && m > 0) { const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L; a = [a[0] + ux * m, a[1] + uy * m]; b = [b[0] - ux * m, b[1] - uy * m]; } } return [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v]; };
  return polys.map(({ P, closed }) => { const D = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; D.push(a); if (!closed && i === P.length - 1) break; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / dmax); for (let k = 1; k < n; k++) D.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    return { nodes: D.map(q => { const m = map(q); return NODE(m[0], m[1]); }), closed }; }).filter(l => l.nodes.length > 1);
}
// placement du texte : 'line' (droit), 'above' / 'on' / 'below' (au-dessus, sur, sous la courbe), 'between' (entre deux courbes)
function txMode() { let m = S.ui.textMode || 'line'; if (m === 'curve') m = S.ui.textSide === 'down' ? 'below' : 'above'; return ['line', 'above', 'on', 'below', 'between'].includes(m) ? m : 'line'; }
const TX_KEYS = ['text', 'textH', 'textSpace', 'textOff', 'textMode', 'textAlign', 'textOrient', 'textFlip'];
function txGlyphs(str, h) { const f = S.font, upm = f.unitsPerEm || 1000, cap = (f.tables.os2 && f.tables.os2.sCapHeight) || upm * 0.7, size = h * upm / cap, k = h / cap, sp = +S.ui.textSpace || 0, gl = f.stringToGlyphs(str), adv = gl.map((g, i) => (g.advanceWidth || 0) * k + (i < gl.length - 1 && f.getKerningValue ? f.getKerningValue(g, gl[i + 1]) * k : 0)), total = adv.reduce((a, b) => a + b, 0) + sp * Math.max(0, gl.length - 1); return { gl, adv, total, size, sp }; }
function textLine(str, h, at) { const G = txGlyphs(str, h), al = S.ui.textAlign || 'left', x0 = al === 'mid' ? -G.total / 2 : al === 'right' ? -G.total : 0, out = []; let x = x0;
  G.gl.forEach((g, i) => { for (const l of textNodes('', h, [at[0] + x, at[1]], g.getPath(0, 0, G.size).commands)) out.push({ nodes: l, closed: !l.open }); x += G.adv[i] + G.sp; }); return out; }
function txGen(A) { const str = String(S.ui.text || ''), h = +S.ui.textH || 20, m = txMode(); if (!S.font || !str.trim()) return null;
  if (m === 'line') return A.at ? textLine(str, h, A.at) : null;
  if (m === 'between') { const a = shapeById(A.a), b = shapeById(A.b); return a && b && a !== b ? textBetween(str, a, b, true) : null; }
  const c = shapeById(A.cid); if (!c || !A.click) return null; const r = textOnCurve(str, h, c, A.click); return r.loops.map(l => ({ nodes: l, closed: !l.open })); }
// texte « vivant » : tant que l'outil Texte reste actif, le dernier texte placé suit les réglages
function txShapes(tid) { return tid ? S.shapes.filter(x => x.txt && x.txt.tid === tid) : []; }
function txSnap(A, tid) { const o = { tid, anchor: A }; for (const k of TX_KEYS) o[k] = S.ui[k]; o.textMode = txMode(); o.font = S.fontLabel || ''; return o; }
function txCreate(A) { const loops = txGen(A); if (!loops || !loops.length) return null; const tid = uid(), g = loops.length > 1 ? uid() : null; S.sel.clear(); const tx = txSnap(A, tid);
  for (const l of loops) { const n = mkShape(l.nodes, l.closed, { g }); if (n) { n.txt = tx; S.sel.add(n.id); } } S.ui.liveTxt = tid; renderSel(); commit(); txUi(); return loops.length; }
let txRegT = 0, txComT = 0;
function txLive() { if (!S.ui.liveTxt || S.ui.tool !== 'text') return; cancelAnimationFrame(txRegT); txRegT = requestAnimationFrame(txRegen); }
function txRegen() { const tid = S.ui.liveTxt, old = txShapes(tid); if (!old.length) { S.ui.liveTxt = null; txUi(); return; } const A = old[0].txt.anchor, loops = txGen(A); if (!loops || !loops.length) return;
  const lay = old[0].layer, g = loops.length > 1 ? (old[0].g || uid()) : null, ids = old.map(x => x.id), tx = txSnap(A, tid); S.shapes = S.shapes.filter(x => !(x.txt && x.txt.tid === tid)); S.sel.clear();
  loops.forEach((l, i) => { const n = mkShape(l.nodes, l.closed, { g, layer: lay }); if (n) { if (i < ids.length) n.id = ids[i]; n.txt = tx; S.sel.add(n.id); } });
  renderSel(); draw(); clearTimeout(txComT); txComT = setTimeout(() => commit(), 450); }
function txEdit() { const ss = selShapes(), tid = ss.length && ss[0].txt && ss[0].txt.tid; if (!tid || !ss.every(x => x.txt && x.txt.tid === tid)) return; const t = ss[0].txt; for (const k of TX_KEYS) if (t[k] !== undefined) S.ui[k] = t[k]; setTool('text'); S.ui.liveTxt = tid; S.sel.clear(); txShapes(tid).forEach(x => S.sel.add(x.id)); renderSel(); bindK(); txUi(); if (t.font && t.font !== S.fontLabel) toast(trf('Ce texte a été écrit avec la police « {f} » : choisissez-la si besoin, le texte suivra.', { f: t.font })); }
function txSelIsText() { const ss = selShapes(), tid = ss.length && ss[0].txt && ss[0].txt.tid; return !!tid && ss.every(x => x.txt && x.txt.tid === tid); }
// aperçu en pointillé sous le pointeur
let txGhost = null, txGhRaf = 0, txGhP = null;
function txGhostReq(p) { txGhP = p; if (!txGhRaf) txGhRaf = requestAnimationFrame(() => { txGhRaf = 0; const p = txGhP, m = txMode(); let A = null;
  if (p) { if (m === 'line') A = { at: snap(p) }; else { const cs = hitEdge(p, 12); if (cs && !(cs.txt && cs.txt.tid === S.ui.liveTxt)) A = m === 'between' ? (textPick && cs.id !== textPick ? { a: textPick, b: cs.id } : null) : { cid: cs.id, click: p }; } }
  let L = null; try { L = A ? txGen(A) : null; } catch (e) { L = null; } txGhost = L ? L.map(l => refresh({ nodes: l.nodes.map(cloneNode), closed: l.closed })) : null; draw(); }); }
function drawTxGhost(C) { if (S.ui.tool !== 'text' || !txGhost) return; ctx.save(); ctx.strokeStyle = C.acc; ctx.globalAlpha = 0.75; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); for (const g of txGhost) { pathOf(g.pts, g.closed); ctx.stroke(); } ctx.restore(); }
function txUi() { const m = txMode(), cur = m !== 'line' && m !== 'between';
  $$('input[name="txMode"]').forEach(r => r.checked = r.value === m); $$('input[name="txAlign"]').forEach(r => r.checked = r.value === (S.ui.textAlign || (m === 'line' ? 'left' : 'mid'))); $$('input[name="txOrient"]').forEach(r => r.checked = r.value === (S.ui.textOrient || 'curve'));
  const sh = (id, on) => { const e = $(id); if (e) e.hidden = !on; }; sh('#txOffRow', m !== 'line'); sh('#txAlignRow', m !== 'between'); sh('#txOrientRow', cur); sh('#txFlipRow', cur);
  const w = $('#txWhat'); if (w) w.textContent = !S.font ? tr('Choisissez d’abord une police.') : m === 'line' ? tr('Cliquez dans la vue 2D au point de départ du texte (alignement : gauche = le texte commence au clic).') : m === 'between' ? tr(textPick ? 'Cliquez maintenant la courbe du haut.' : 'Cliquez la courbe du bas (ligne de base), puis la courbe du haut.') : tr('Cliquez sur une courbe ou un vecteur : ligne, arc, cercle, rectangle…');
  const lv = $('#txLive'); if (lv) lv.hidden = !(S.ui.liveTxt && S.ui.tool === 'text' && txShapes(S.ui.liveTxt).length); }
function textOnCurve(str, h, s, click) {
  const f = S.font, upm = f.unitsPerEm || 1000, cap = (f.tables.os2 && f.tables.os2.sCapHeight) || upm * 0.7, size = h * upm / cap, k = h / cap, sp = +S.ui.textSpace || 0;
  const gl = f.stringToGlyphs(str), adv = gl.map((g, i) => (g.advanceWidth || 0) * k + (i < gl.length - 1 && f.getKerningValue ? f.getKerningValue(g, gl[i + 1]) * k : 0));
  const total = adv.reduce((a, b) => a + b, 0) + sp * Math.max(0, gl.length - 1);
  let P = s.pts.slice(); if (s.closed) P.push(P[0]);
  let c = cumLen(P), per = c[c.length - 1];
  let sc = 0, bd = Infinity; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((click[0] - a[0]) * dx + (click[1] - a[1]) * dy) / L2)), d = Math.hypot(click[0] - a[0] - dx * t, click[1] - a[1] - dy * t); if (d < bd) { bd = d; sc = c[i - 1] + (c[i] - c[i - 1]) * t; } }
  const at = q => s.closed ? ptAtLoop(P, c, q) : ptAtOpen(P, c, q);
  const tA = at(sc - 0.5), tB = at(sc + 0.5);
  if ((tB[0] - tA[0] < 0) !== !!S.ui.textFlip) { P = P.slice().reverse(); c = cumLen(P); sc = per - sc; } /* lecture de gauche à droite ; « de l'autre côté » : sens inversé */
  const al = S.ui.textAlign || 'mid'; let start = s.closed ? (al === 'left' ? sc : al === 'right' ? sc - total : sc - total / 2) : (al === 'left' ? 0 : al === 'right' ? per - total : (per - total) / 2), warn = false;
  if (!s.closed) { if (start < 0) { start = 0; } if (start + total > per + 1e-6) { warn = true; } }
  const out = []; let acc = 0;
  gl.forEach((g, i) => {
    const mid = start + acc + adv[i] / 2; acc += adv[i] + sp;
    if (!s.closed && (mid < 0 || mid > per)) return;
    const Pt = at(mid), A = at(mid - 0.6), B = at(mid + 0.6), an = Math.atan2(B[1] - A[1], B[0] - A[0]), co = Math.cos(an), si = Math.sin(an), dOff = +S.ui.textOff || 0, md = txMode(), off = md === 'below' ? -h - dOff : md === 'on' ? -h / 2 + dOff : dOff, up = S.ui.textOrient === 'vertical';
    const loops = textNodes('', h, [0, 0], g.getPath(0, 0, size).commands), cx = Pt[0] - (off + h / 2) * si, cy = Pt[1] + (off + h / 2) * co;
    for (const l of loops) { const sh = { nodes: l, closed: !l.open }; transformShape(sh, q => { const lx = q[0] - adv[i] / 2; if (up) return [cx + lx, cy + q[1] - h / 2]; const ly = q[1] + off; return [Pt[0] + lx * co - ly * si, Pt[1] + lx * si + ly * co]; }); out.push(sh.nodes); }
  });
  return { loops: out, warn };
}
// saisie au clavier du point suivant : X/Y absolus, ou angle + longueur, ou dx/dy depuis le dernier point ; les six champs restent liés
const CI_IDS = ['ciX', 'ciY', 'ciAng', 'ciLen', 'ciDx', 'ciDy'];
function ciLast() { return pen.length ? outXY(pen[pen.length - 1].x, pen[pen.length - 1].y) : [0, 0]; }
function ciNum(id) { const el = $('#' + id); if (!el || el.value === '') return NaN; return parseFloat(String(el.value).replace(',', '.')); }
function ciPut(id, v) { const el = $('#' + id); if (el && document.activeElement !== el) el.value = isFinite(v) ? String(+v.toFixed(id === 'ciAng' ? 2 : 4)) : ''; }
function ciSync(src) {
  const L0 = ciLast(); let X, Y;
  if (src === 'ciX' || src === 'ciY') { X = ciNum('ciX'); Y = ciNum('ciY'); if (!isFinite(X)) X = isFinite(Y) ? L0[0] : NaN; if (!isFinite(Y)) Y = isFinite(X) ? L0[1] : NaN; }
  else if (src === 'ciDx' || src === 'ciDy') { const dx = ciNum('ciDx'), dy = ciNum('ciDy'); if (isFinite(dx) || isFinite(dy)) { X = L0[0] + (isFinite(dx) ? dx : 0); Y = L0[1] + (isFinite(dy) ? dy : 0); } }
  else { const a = ciNum('ciAng'), l = ciNum('ciLen'); if (isFinite(l)) { const r = (isFinite(a) ? a : 0) * Math.PI / 180; X = L0[0] + l * Math.cos(r); Y = L0[1] + l * Math.sin(r); } }
  const ok = isFinite(X) && isFinite(Y), dx = X - L0[0], dy = Y - L0[1];
  if (src !== 'ciX' && src !== 'ciY') { ciPut('ciX', X); ciPut('ciY', Y); }
  if (src !== 'ciDx' && src !== 'ciDy') { ciPut('ciDx', dx); ciPut('ciDy', dy); }
  if (src !== 'ciAng' && src !== 'ciLen') { ciPut('ciLen', ok ? Math.hypot(dx, dy) : NaN); ciPut('ciAng', ok && Math.hypot(dx, dy) > 1e-9 ? Math.atan2(dy, dx) * 180 / Math.PI : NaN); }
  const b = $('#ciAddB'); if (b) b.disabled = !ok; ciPrev = ok ? inXY(X, Y) : null; draw();
}
var ciPrev = null;
function ciClear() { CI_IDS.forEach(id => { const el = $('#' + id); if (el) el.value = ''; }); ciPrev = null; const b = $('#ciAddB'); if (b) b.disabled = true; }
function ciBind() {
  CI_IDS.forEach((id, k) => { const el = $('#' + id); if (!el) return; el.addEventListener('input', () => ciSync(id)); el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if ((id === 'ciX' || id === 'ciAng' || id === 'ciDx') && !$('#' + CI_IDS[k + 1]).value) { $('#' + CI_IDS[k + 1]).focus(); return; } act('ciAdd'); } else if (e.key === 'Escape') { ciClear(); el.blur(); draw(); } }); });
}
function ciAdd() {
  if (!$('#ciX')) return; const X = ciNum('ciX'), Y = ciNum('ciY');
  if (!isFinite(X) || !isFinite(Y)) { toast('Saisissez X et Y, ou un angle et une longueur, ou dx et dy.'); $('#ciX').focus(); return; }
  const q = inXY(X, Y), last = pen.length ? [pen[pen.length - 1].x, pen[pen.length - 1].y] : null;
  if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) < 1e-6) { toast('Ce point est déjà le dernier.'); return; }
  if (pen.length > 2 && Math.hypot(q[0] - pen[0].x, q[1] - pen[0].y) < 1e-6) { ciClear(); finishPen(true); toast('Forme fermée.'); return; }
  pen.push(NODE(q[0], q[1])); setCoords(q, pen.length + ' point' + (pen.length > 1 ? 's' : '')); ciClear(); draw(); const f = $('#ciX'); f.focus();
}
function ciUndo() { if (!pen.length) { toast('Aucun point à annuler.'); return; } pen.pop(); ciSync('ciX'); setCoords(pen.length ? [pen[pen.length - 1].x, pen[pen.length - 1].y] : [0, 0], pen.length ? pen.length + ' point' + (pen.length > 1 ? 's' : '') : ''); draw(); }
function syncNe() { const X = $('#neX'), Y = $('#neY'); if (!X) return; $$('#neMode button').forEach(b => b.setAttribute('aria-pressed', (b.value === 'rel') === !!S.ui.neRel)); X.title = Y.title = tr(S.ui.neRel ? 'Relatif : tapez un déplacement puis Entrée (tous les nœuds sélectionnés)' : 'Absolu : position du nœud'); const s = S.ne && shapeById(S.ne.sid), H = neHandle(), n = s && neSel().length ? s.nodes[neSel()[0]] : null; X.disabled = Y.disabled = !n && !H;
  { const w = $('#neWhat'); if (w) w.innerHTML = H ? '<b>' + escHtml(tr(H.w === 'i' ? 'Poignée d’entrée' : 'Poignée de sortie')) + '</b> ' + escHtml(trf('du nœud {n}', { n: H.i + 1 })) : n ? escHtml(neSel().length > 1 ? trf('{n} nœuds sélectionnés', { n: neSel().length }) : trf('Nœud {n}', { n: neSel()[0] + 1 })) : escHtml(tr('Cliquez un nœud ou une poignée.')); }
  { const r = $('#neHRow'); if (r) { r.hidden = !H; if (H) { const v = H.n[H.w], L = $('#neHL'), A = $('#neHA'); if (document.activeElement !== L) L.value = +Math.hypot(v[0], v[1]).toFixed(3); if (document.activeElement !== A) A.value = +(Math.atan2(v[1], v[0]) * 180 / Math.PI).toFixed(2); } } }
  if (H) { if (S.ui.neRel) { if (document.activeElement !== X) X.value = 0; if (document.activeElement !== Y) Y.value = 0; return; } const o = outXY(H.p[0], H.p[1]); if (document.activeElement !== X) X.value = +o[0].toFixed(3); if (document.activeElement !== Y) Y.value = +o[1].toFixed(3); return; } if (n && S.ui.neRel) { if (document.activeElement !== X) X.value = 0; if (document.activeElement !== Y) Y.value = 0; return; } if (!n) { if (document.activeElement !== X) X.value = ''; if (document.activeElement !== Y) Y.value = ''; return; } const o = outXY(n.x, n.y); if (document.activeElement !== X) X.value = +o[0].toFixed(3); if (document.activeElement !== Y) Y.value = +o[1].toFixed(3); }
// poignée sélectionnée (outil Nœuds) : nœud, côté et position
function neHandle() { const ne = S.ne, s = ne && shapeById(ne.sid); if (!s || !ne.h) return null; const n = s.nodes[ne.h.i], v = n && n[ne.h.w]; if (!v) return null; return { s, n, i: ne.h.i, w: ne.h.w, p: [n.x + v[0], n.y + v[1]] }; }
function neHandleSet(H, q) { const n = H.n, v = [q[0] - n.x, q[1] - n.y]; n[H.w] = v; const ow = H.w === 'i' ? 'o' : 'i'; if (n.sm && n.sym && n[ow]) n[ow] = [-v[0], -v[1]]; else if (n.sm && n[ow]) { const L = Math.hypot(n[ow][0], n[ow][1]), u = nrm(v); if (Math.hypot(v[0], v[1]) > 1e-9) n[ow] = [-u[0] * L, -u[1] * L]; } refresh(H.s); }
function neHandleLA() { const H = neHandle(); if (!H) return; const v = H.n[H.w], pv = id => { const x = parseFloat(String($(id).value).replace(',', '.')); return isFinite(x) ? x : null; };
  let L = pv('#neHL'), a = pv('#neHA'); if (L === null) L = Math.hypot(v[0], v[1]); if (a === null) a = Math.atan2(v[1], v[0]) * 180 / Math.PI; L = Math.max(0.001, L); const r = a * Math.PI / 180;
  neHandleSet(H, [H.n.x + L * Math.cos(r), H.n.y + L * Math.sin(r)]); commit(); syncNe(); draw(); }
function neFromInputs() { { const H = neHandle(); if (H) { const pv = id => { const v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) ? v : null; };
    if (S.ui.neRel) { const d0 = inXY(0, 0), d1 = inXY(pv('#neX') || 0, pv('#neY') || 0); neHandleSet(H, [H.p[0] + d1[0] - d0[0], H.p[1] + d1[1] - d0[1]]); }
    else { const o = outXY(H.p[0], H.p[1]), x = pv('#neX'), y = pv('#neY'); neHandleSet(H, inXY(x === null ? o[0] : x, y === null ? o[1] : y)); }
    commit(); syncNe(); draw(); return; } }
  if (S.ui.neRel) { const pv = id => { const v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) ? v : 0; }, d0 = inXY(0, 0), d1 = inXY(pv('#neX'), pv('#neY')); if (neMove(d1[0] - d0[0], d1[1] - d0[1])) { commit(); draw(); } syncNe(); return; } const s = S.ne && shapeById(S.ne.sid); if (!s || S.ne.ni === null) return; const n = s.nodes[S.ne.ni], o = outXY(n.x, n.y), x = parseFloat(String($('#neX').value).replace(',', '.')), y = parseFloat(String($('#neY').value).replace(',', '.')); const q = inXY(isFinite(x) ? x : o[0], isFinite(y) ? y : o[1]); n.x = q[0]; n.y = q[1]; refresh(s); commit(); draw(); }
// prolonger une ligne ouverte depuis une extrémité : direction de la tangente en ce bout
function penContAt(m) {
  if (!m || m.k !== 'end' || !m.ref || m.ref.ni === undefined || !m.ref.ids) return null; const sh = shapeById(m.ref.ids[0]); if (!sh || sh.closed || sh.nodes.length < 2) return null;
  const N = sh.nodes, last = N.length - 1, ni = m.ref.ni; if (ni !== 0 && ni !== last) return null; const start = ni === 0 && last > 0, E = N[ni];
  let d; if (start) d = E.o && Math.hypot(...E.o) > 1e-9 ? [-E.o[0], -E.o[1]] : [E.x - N[1].x, E.y - N[1].y]; else d = E.i && Math.hypot(...E.i) > 1e-9 ? [-E.i[0], -E.i[1]] : [E.x - N[last - 1].x, E.y - N[last - 1].y];
  const l = Math.hypot(d[0], d[1]); if (l < 1e-9) return null; return { sid: sh.id, start, dir: [d[0] / l, d[1] / l], len: null };
}
// poignée de départ dans l'axe de la ligne prolongée (longueur : 1/3 de la distance au point suivant, ou celle réglée au glisser)
function penTan(list) { if (!penCont || list.length < 2) return list; const a = list[0], b = list[1], L = penCont.len || Math.hypot(b.x - a.x, b.y - a.y) / 3; a.o = [penCont.dir[0] * L, penCont.dir[1] * L]; a.i = null; a.sm = false; return list; }
function finishPen(closed) {
  if (penCont) { const sh = shapeById(penCont.sid), P = penTan(pen.map(cloneNode)); if (sh && P.length > 1) {
      const N = sh.nodes.map(cloneNode), J = P[0], add = P.slice(1);
      if (penCont.start) { const rev = add.reverse().map(n => { const m = cloneNode(n); const t = m.i; m.i = m.o; m.o = t; return m; }); N[0].i = J.o; N[0].sm = !!N[0].o; sh.nodes = rev.concat(N); }
      else { const E = N[N.length - 1]; E.o = J.o; E.sm = !!E.i; sh.nodes = N.concat(add); }
      if (closed) sh.closed = true; refresh(sh); if (typeof snapVer !== 'undefined') snapVer++; S.sel.clear(); S.sel.add(sh.id); renderSel(); commit(); }
    penCont = null; pen = []; hover = null; draw(); return; }
  if ((closed && pen.length > 2) || (!closed && pen.length > 1)) { const s = mkShape(pen.map(cloneNode), closed); if (s) { S.sel.clear(); S.sel.add(s.id); renderSel(); commit(); } }
  pen = []; hover = null; draw();
}
function setCoords(p, extra) { const o = outXY(p[0], p[1]), pad = v => (UNIT.len === 'in' ? uNum(v, 'len', 3, true) : fr(v)).padStart(8, ' '); $('#coords').textContent = 'X ' + pad(o[0]) + '  Y ' + pad(o[1]); $('#coordsx').textContent = extra || ''; }
function showMeasure() { const m = S.measure, el = $('#measOut'); if (!m || !el) return; const dx = m.b[0] - m.a[0], dy = m.b[1] - m.a[1]; el.textContent = 'Distance ' + fr(Math.hypot(dx, dy)) + ' mm · ΔX ' + fr(dx) + ' · ΔY ' + fr(dy) + ' · ' + fr(Math.atan2(dy, dx) * 180 / Math.PI, 1) + '°'; }

window.addEventListener('keydown', e => {
  const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
  const k = e.key, mod = e.ctrlKey || e.metaKey;
  if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return; }
  if (mod && (k === 'd' || k === 'D')) { e.preventDefault(); act('dup'); return; }
  if (mod && !e.shiftKey && (k === 'c' || k === 'C') && !(window.getSelection && String(window.getSelection()))) { e.preventDefault(); act('clipCopy'); return; }
  if (mod && !e.shiftKey && (k === 'x' || k === 'X')) { e.preventDefault(); act('clipCut'); return; }
  if (mod && !e.shiftKey && (k === 'v' || k === 'V')) { e.preventDefault(); act('clipPaste'); return; }
  if (mod && (k === 'g' || k === 'G')) { e.preventDefault(); act(e.shiftKey ? 'ungroup' : 'group'); return; }
  if (mod && (e.code === 'BracketRight' || k === ']' || k === '}')) { e.preventDefault(); arrange(e.shiftKey ? 'zFront' : 'zUp'); return; }
  if (mod && (e.code === 'BracketLeft' || k === '[' || k === '{')) { e.preventDefault(); arrange(e.shiftKey ? 'zBack' : 'zDown'); return; }
  if (mod && (k === 's' || k === 'S')) { e.preventDefault(); act(e.shiftKey ? 'saveAs' : 'save'); return; }
  if (mod && (k === 'o' || k === 'O')) { e.preventDefault(); act('open'); return; }
  if (mod && (k === 'a' || k === 'A') && S.ui.tool === 'nodes' && S.ne && shapeById(S.ne.sid)) { e.preventDefault(); neSetSel(shapeById(S.ne.sid).nodes.map((_, i) => i)); syncNe(); draw(); return; }
  if (mod && (k === 'a' || k === 'A')) { e.preventDefault(); S.shapes.forEach(s => { if (editable(s)) S.sel.add(s.id); }); renderSel(); draw(); return; }
  if (k === ' ' && S.ui.tool === 'poly' && pen.length && !e.repeat) { e.preventDefault(); while (pen.length > 1 && Math.hypot(pen[pen.length - 1].x - pen[pen.length - 2].x, pen[pen.length - 1].y - pen[pen.length - 2].y) < 1e-6) pen.pop(); finishPen(false); ciClear(); toast(tr('Ligne terminée : cliquez pour en commencer une nouvelle.')); return; }
  if (k === ' ') { spaceDown = true; e.preventDefault(); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (S.imgSel && !S.sel.size) { imgAct('imgDel'); return; } if (S.relSel && !S.sel.size && (document.activeElement === document.body || document.activeElement === cv || (document.activeElement && document.activeElement.id === 'rvc'))) { imgAct('relDel'); return; } if (S.ui.tool === 'nodes' && S.ne && (neSel().length || (S.ne.seg !== null && S.ne.seg !== undefined))) act('neDel'); else if (S.selDim) { S.dims = S.dims.filter(d => d.id !== S.selDim); S.selDim = null; commit(false); draw(); } else act('del'); return; }
  if (k === 'Escape' && relClipPick) { act('relClipNo'); return; }
  if (k === 'Escape' && S.ui.tool === 'tabedit') { setTool('select'); return; }
  if (k === 'Escape' && S.ui.tool === 'extend' && extSt) { extSt = null; extHov = null; draw(); return; }
  if (k === 'Escape' && S.ui.dsec && S.ui.tool === 'select' && !S.sel.size) { S.ui.dsec = null; dRefresh(); return; }
  if (k === 'Escape') { if (pen.length) { pen = []; penCont = null; } else if (arcSt.length || dimSt.length) { arcSt = []; dimSt = []; } else if (S.ui.tool === 'nodes') { setTool('select'); dRefresh(); } else { S.sel.clear(); S.selDim = null; if (S.ne) S.ne = null; if (S.imgSel) { S.imgSel = null; renderImgPanel(); } renderSel(); } draw(); return; }
  if (k === 'Enter' && pen.length) { finishPen(false); return; }
  if (k.startsWith('Arrow') && S.imgSel && !S.sel.size) { e.preventDefault(); const d = nudgeStep(e); if (mod) nudgeTell(); imgSet(im => { im.x += k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0; im.y += k === 'ArrowDown' ? -d : k === 'ArrowUp' ? d : 0; }); return; }
  if (k.startsWith('Arrow') && S.ui.tool === 'nodes' && neSel().length) { e.preventDefault(); const d = nudgeStep(e); if (mod) nudgeTell(); if (neMove(k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, k === 'ArrowDown' ? -d : k === 'ArrowUp' ? d : 0)) { commit(); syncNe(); draw(); } return; }
  if (k.startsWith('Arrow') && S.sel.size) { e.preventDefault(); const d = nudgeStep(e); if (mod) nudgeTell(); const dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, dy = k === 'ArrowDown' ? -d : k === 'ArrowUp' ? d : 0; selShapes().forEach(s => transformShape(s, q => [q[0] + dx, q[1] + dy])); commit(); renderSel(); draw(); return; }
  if (mod) return;
  const map = { v: 'select', n: 'nodes', h: 'pan', r: 'rect', e: 'ellipse', c: 'circle', o: 'polygon', p: 'poly', a: 'arc', t: 'text', k: 'chamfer', f: 'fillet', b: 'dogbone', x: 'trim', u: 'cut', m: 'measure', d: 'dim' };
  if (map[k.toLowerCase()]) setTool(map[k.toLowerCase()]);
});
window.addEventListener('keyup', e => { if (e.key === ' ') spaceDown = false; });

