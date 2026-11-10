// ---------- type de projet (simple face, double face, rotatif) et 4ᵉ axe ----------
function wrapInfo() { const st = S.stock, R = st.rotary || {}; if (!R.on || R.view3d === false) return null; const D = +st.t || 0; if (!(D > 0)) return null; const ax = R.axis === 'y' ? 1 : 0; return { ax, c: ax ? st.w / 2 : st.h / 2, R: D / 2 }; }
function wrapU(gl, prog) { const W = wrapInfo(), l = gl.getUniformLocation(prog, 'uWrap'); if (l) gl.uniform4f(l, W ? 1 : 0, W ? W.ax : 0, W ? W.c : 0, W ? W.R : 1); }
function wrapPt(p) { const W = wrapInfo(); if (!W) return p; const r = Math.max(W.R + p[2], 0); if (!W.ax) { const th = (p[1] - W.c) / W.R; return [p[0], W.c + r * Math.sin(th), r * Math.cos(th) - W.R]; } const th = (p[0] - W.c) / W.R; return [W.c + r * Math.sin(th), p[1], r * Math.cos(th) - W.R]; }
function wrapN_(a, b) { const W = wrapInfo(); if (!W) return 1; return Math.max(1, Math.min(400, Math.ceil(Math.abs((W.ax ? b[0] - a[0] : b[1] - a[1])) / 1.5))); } // nombre de morceaux pour suivre la courbure
function wrapSegs(segs, st) { if (!wrapInfo()) return segs; const out = []; for (let k = 0; k + 1 < segs.length; k += 2) { const a = segs[k], b = segs[k + 1], n = wrapN_(a, b); for (let i = 0; i < n; i++) { const A = a.map((v, j) => j < 3 ? v + (b[j] - v) * i / n : v), B = a.map((v, j) => j < 3 ? v + (b[j] - v) * (i + 1) / n : b[j]); out.push(A, B); } } return out; }
function stMode() { const st = S.stock; if ((st.rotary || {}).on) return 'rotary'; if (st.mode === 'single' || st.mode === 'double') return st.mode; return S.layers.some(l => l.face === 2) ? 'double' : 'single'; }
function rotDims() { const st = S.stock, R = st.rotary || {}; return { L: R.axis === 'y' ? st.h : st.w, D: +st.t || 0 }; }
function rotStockApply(L, D) { const st = S.stock, R = st.rotary || {}, C = +(Math.PI * D).toFixed(4); st.t = D; if (R.axis === 'y') { st.h = L; st.w = C; } else { st.w = L; st.h = C; } }
function pjAfter() { syncStock(); commit(false); recomputeAll(); pjSummary(); gcDirty = true; renderGcode(); if (typeof RV !== 'undefined') { RV.fitted = false; RV.touched = false; } machUi && machUi(); draw(); }
function setStMode(m) {
  const st = S.stock, was = stMode(); if (m === was) return; st.mode = m === 'rotary' ? 'single' : m;
  if (m === 'rotary') { st.flatDims = { w: st.w, h: st.h, t: st.t, o: st.originXY }; const L = st.w, D = st.t; st.rotary = { axis: 'x', z0: 'surface', view3d: true, ...(st.rotary || {}), on: true }; rotStockApply(L, D); st.originXY = st.rotary.axis === 'y' ? 'bc' : 'ml'; st.offX = 0; st.offY = 0; st.originZ = 'top'; }
  else if (was === 'rotary') { st.rotary = { ...(st.rotary || {}), on: false }; if (st.flatDims) { st.w = st.flatDims.w; st.h = st.flatDims.h; st.t = st.flatDims.t; if (st.flatDims.o) st.originXY = st.flatDims.o; } } // retour au brut plat d'avant
  pjAfter(); toast(m === 'rotary' ? trf('Projet rotatif : dessinez sur la surface déroulée du cylindre ({c} mm de tour).', { c: fr(Math.PI * st.t, 2) }) : m === 'double' ? tr('Projet double face : réglez le retournement ci-dessous.') : tr('Projet simple face.'));
}
function pjModeSync() {
  const m = stMode(), rot = m === 'rotary', st = S.stock, R = st.rotary || {}; $$('#stMode button').forEach(b => b.setAttribute('aria-pressed', b.value === m));
  $('#stFlatSize').hidden = rot; $('#stRotSize').hidden = $('#stRotInfo').hidden = !rot; $('#stDouble').hidden = m !== 'double'; $('#stOrient').hidden = !rot; $('#stOZRow').hidden = rot; $('#stRotZSec').hidden = !rot; $('#stOriginT').textContent = tr(rot ? 'Origine XY' : 'Origine'); { const or = document.querySelector('[data-pane="projet"] .orow'); if (or) or.classList.toggle('rot', rot); } { const zz = document.querySelector('[data-pane="projet"] .ofields [data-ill="zzero"]'); if (zz) zz.hidden = rot; } $('#stSizeT').textContent = tr(rot ? 'Taille du travail' : 'Brut');
  { const w = $('#stRotWarn'), M = S.machine; w.hidden = !(rot && !M.rotary); if (!w.hidden) w.textContent = '⚠ ' + trf('La machine « {m} » n’a pas d’axe rotatif déclaré. Vous pouvez dessiner et simuler, mais vérifiez avant d’usiner : Machine › Changer… › « Axe rotatif (4ᵉ axe) installé ».', { m: M.name || tr('Machine') }); }
  if (!rot) return; const d = rotDims(); $('#stRL').value = +d.L.toFixed(3); $('#stRD').value = +d.D.toFixed(3); $$('#stRotAxSeg button').forEach(b => b.setAttribute('aria-pressed', b.value === (R.axis || 'x'))); $$('#stRotZSeg button').forEach(b => b.setAttribute('aria-pressed', b.value === (R.z0 || 'surface'))); $('#stRotView').checked = R.view3d !== false;
  $('#stRotInfo').textContent = trf('Tour du cylindre : π × D = {c} mm. C’est la largeur de la feuille déroulée sur laquelle vous dessinez ({w}, de 0° à 360°) ; le milieu de la feuille est le dessus du cylindre.', { c: fr(Math.PI * d.D, 2), w: tr(R.axis === 'y' ? 'en X' : 'en Y') });
  const P = postOf(S.machine), W = P.vp ? vpGet(P.vp).wrap : null; $('#stRotPost').textContent = W ? (W.axis === (R.axis === 'y' ? 'X' : 'Y') ? tr('Le post-processeur choisi enroule bien cet axe : il sort en angle (axe A).') : tr('Attention : le post-processeur choisi enroule l’autre axe ; changez l’axe de rotation ou le post-processeur.')) : trf('Le post-processeur de la machine sortira la coordonnée enroulée en angle {l} (en degrés), sans arcs G2/G3.', { l: S.machine.rotL === 'B' ? 'B' : 'A' });
}
function drawRotGuides(C) { // 2D : lignes tous les 90° et jonction (0° = 360°) sur la feuille déroulée
  const st = S.stock, R = st.rotary || {}; if (!R.on || !(st.t > 0)) return; const ax = R.axis === 'y', tour = Math.PI * st.t, o = originOf(st), z = ax ? o[0] : o[1], len = ax ? st.w : st.h;
  ctx.save(); ctx.font = '600 10px ' + C.mono; ctx.lineWidth = 1;
  for (let k = -8; k <= 8; k++) { const v = z + k * tour / 4; if (v < -1e-6 || v > len + 1e-6) continue; const ang = ((k * 90) % 360 + 360) % 360, seam = Math.abs(v) < 1e-6 || Math.abs(v - len) < 1e-6;
    ctx.strokeStyle = seam ? C.acc : 'rgba(80,120,220,.55)'; ctx.setLineDash(seam ? [] : [6, 5]); ctx.beginPath(); if (ax) { ctx.moveTo(sx(v), sy(0)); ctx.lineTo(sx(v), sy(st.h)); } else { ctx.moveTo(sx(0), sy(v)); ctx.lineTo(sx(st.w), sy(v)); } ctx.stroke();
    ctx.fillStyle = C.acc; const lbl = ang + '°'; if (ax) ctx.fillText(lbl, sx(v) + 3, sy(st.h) + 12); else ctx.fillText(lbl, sx(st.w) + 4, sy(v) + 3); }
  ctx.restore();
}
function pfigInit() { document.querySelectorAll('[data-pfig]').forEach(el => { if (!el.firstChild) el.innerHTML = FIG.ptype(el.dataset.pfig); }); }
(function pjTypeInit() {
  pfigInit(); $$('#stMode button').forEach(b => b.onclick = () => setStMode(b.value));
  $('#stRL').addEventListener('change', e => { const L = +e.target.value; if (!(L > 0)) return; rotStockApply(L, rotDims().D); pjAfter(); });
  $('#stRD').addEventListener('change', e => { const D = +e.target.value; if (!(D > 0)) return; rotStockApply(rotDims().L, D); pjAfter(); });
  $$('#stRotAxSeg button').forEach(b => b.onclick = () => { if (((S.stock.rotary || {}).axis || 'x') === b.value) return; const d = rotDims(); S.stock.rotary = { ...(S.stock.rotary || {}), axis: b.value }; rotStockApply(d.L, d.D); S.stock.originXY = b.value === 'y' ? 'bc' : 'ml'; pjAfter(); });
  $$('#stRotZSeg button').forEach(b => b.onclick = () => { S.stock.rotary = { ...(S.stock.rotary || {}), z0: b.value }; commit(false); gcDirty = true; renderGcode(); pjModeSync(); pjSummary(); draw(); });
  $('#stRotView').addEventListener('change', e => { S.stock.rotary = { ...(S.stock.rotary || {}), view3d: e.target.checked }; commit(false); if (typeof RV !== 'undefined') { RV.sig = ''; RV.lsig = ''; RV.fsig = ''; RV.fitted = false; rvSync && rvSync(); rvReq && rvReq(); } });
  pjModeSync();
})();

function machExport() { machStore(); const data = JSON.stringify({ copo: 'machines', version: 1, machines: MACH.list.map(x => x.m) }, null, 1); saveFile('machines-copo.json', data, tr('Machines COPO')); }
function machImportText(txt) {
  let o; try { o = JSON.parse(txt); } catch { return toast(tr('Fichier de machines illisible.')); }
  const arr = Array.isArray(o) ? o : Array.isArray(o.machines) ? o.machines : o && o.post ? [o] : null; if (!arr || !arr.length) return toast(tr('Aucune machine dans ce fichier.'));
  machStore(); const names = new Set(MACH.list.map(x => x.m.name)); let n = 0;
  for (const raw of arr) { const m0 = raw && raw.m ? raw.m : raw; if (!m0 || typeof m0 !== 'object' || !m0.post) continue; const m = { ...MACH_DEF, ...JSON.parse(JSON.stringify(m0)) }; let nm = m.name || tr('Machine'); if (names.has(nm)) nm += ' ' + tr('(importée)'); m.name = nm; names.add(nm); MACH.list.push({ id: 'm' + Date.now().toString(36) + (n++), m }); }
  if (!n) return toast(tr('Aucune machine dans ce fichier.')); machStore(); machUi(); toast(trf('{n} machine(s) importée(s) : cliquez sur une machine pour la choisir.', { n }));
}
$('#fMach').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) f.text().then(machImportText); });
