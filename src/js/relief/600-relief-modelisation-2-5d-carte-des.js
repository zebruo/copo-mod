// ---------- RELIEF (modélisation 2,5D : carte des hauteurs) ----------
// chaque élément garde sa grille source (Uint16 : 0 = vide, 1..65535 = hauteur 0..1), posée dans un cadre x, y, w, h, rot comme une image
var relGrid = {}, relMesh = {}, relSm = new Map(), relDirty = true, relCache = null;
var relCur = () => S.relSel && S.relief.items.find(i => i.id === S.relSel);
function relPack(g) { const b = new Uint8Array(g.d.buffer, g.d.byteOffset, g.d.byteLength); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return { nx: g.nx, ny: g.ny, b64: btoa(s) }; }
function relUnpack(o) { if (!o || !o.b64) return null; const s = atob(o.b64), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return { nx: o.nx, ny: o.ny, d: new Uint16Array(b.buffer) }; }
// identifiant de la grille d'un relief : change quand la grille est refaite (profil d'un dôme, d'une extrusion…), pour que les vues se mettent à jour
const relGid = (() => { const W = new WeakMap(); let n = 0; return g => { if (!g) return 0; let v = W.get(g); if (!v) { v = ++n; W.set(g, v); } return v; }; })();
function relStore(id, g) { relGrid[id] = g; relSm.delete(id); idbPutImg('rel_' + id, relPack(g)).catch(() => { }); }
// grille lissée (flou en boîte, 2 passes), en Float32 avec NaN pour le vide
function relSrc(it) {
  const g = relGrid[it.id]; if (!g) return null; const cut = it.kind === 'image' ? (+it.cut || 0) / 100 : 0, k = it.id + ':' + (it.smooth || 0) + ':' + cut; if (relSm.has(it.id) && relSm.get(it.id).k === k) return relSm.get(it.id).f;
  const { nx, ny, d } = g, f = new Float32Array(nx * ny), img = it.kind === 'image'; for (let i = 0; i < f.length; i++) f[i] = d[i] ? (d[i] - 1) / 65534 : img ? 0 : NaN; // image : le transparent compte comme du noir
  if (cut > 0) for (let i = 0; i < f.length; i++) f[i] = Math.max(0, (f[i] - cut) / (1 - cut)); // fond noir : sous le seuil = rien, au-dessus la hauteur repart de zéro
  const r = Math.round(it.smooth || 0);
  if (r > 0) { const tmp = new Float32Array(f.length); for (let pass = 0; pass < 2; pass++) for (const [A, B, n, m, sa, sb] of [[f, tmp, nx, ny, 1, nx], [tmp, f, ny, nx, nx, 1]]) for (let j = 0; j < m; j++) { const o = j * sb; for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let q = Math.max(0, i - r); q <= Math.min(n - 1, i + r); q++) { const v = A[o + q * sa]; if (v === v) { s += v; c++; } } B[o + i * sa] = A[o + i * sa] === A[o + i * sa] ? s / c : NaN; } } }
  relSm.set(it.id, { k, f }); return f;
}
/* masque d'une image (opaque = 1) adouci sur deux cellules : le contour suit une courbe lisse au lieu des marches des pixels */
const relMaskSm = new Map();
function relMaskF(it) { const g = relGrid[it.id]; if (!g) return null; const cut = it.kind === 'image' ? (+it.cut || 0) / 100 : 0, c = relMaskSm.get(it.id); if (c && c.g === g && c.cut === cut) return c.f;
  const { nx, ny, d } = g, f = new Float32Array(nx * ny), tmp = new Float32Array(nx * ny); const th = 1 + cut * 65534; for (let i = 0; i < f.length; i++) f[i] = d[i] && (!cut || d[i] > th) ? 1 : 0;
  for (let pass = 0; pass < 2; pass++) for (const [A, B, n, m, sa, sb] of [[f, tmp, nx, ny, 1, nx], [tmp, f, ny, nx, nx, 1]]) for (let j = 0; j < m; j++) { const o = j * sb; for (let i = 0; i < n; i++) { let t = 0, k = 0; for (let q = Math.max(0, i - 2); q <= Math.min(n - 1, i + 2); q++) { t += A[o + q * sa]; k++; } B[o + i * sa] = t / k; } }
  relMaskSm.set(it.id, { g, f, cut }); return f; }
function relSample(f, nx, ny, u, v) { // u, v dans [0,1] ; bilinéaire, NaN si vide au plus proche
  const X = u * (nx - 1), Y = v * (ny - 1); if (X < 0 || Y < 0 || X > nx - 1 || Y > ny - 1) return NaN;
  const i = Math.min(nx - 2, Math.floor(X)), j = Math.min(ny - 2, Math.floor(Y)), a = X - i, b = Y - j, q = j * nx + i;
  const p00 = f[q], p10 = f[q + 1], p01 = f[q + nx], p11 = f[q + nx + 1];
  if (p00 === p00 && p10 === p10 && p01 === p01 && p11 === p11) return (p00 * (1 - a) + p10 * a) * (1 - b) + (p01 * (1 - a) + p11 * a) * b;
  const n = [[p00, (1 - a) * (1 - b)], [p10, a * (1 - b)], [p01, (1 - a) * b], [p11, a * b]].sort((x, y) => y[1] - x[1])[0][0]; return n;
}
// composition sur le brut : H (mm, au-dessus de la base 0), grille de pas « cell »
// élément lié à une image du dessin : il en reprend le cadre
function relLinked(it) { return it.kind === 'image' && it.src && it.linked !== false && imgById(it.src) ? imgById(it.src) : null; }
function relSyncLinks() { for (const it of S.relief.items) { const im = relLinked(it); if (im) { it.x = im.x; it.y = im.y; it.w = im.w; it.h = im.h; it.rot = im.rot || 0; } } }
function relBox(it) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of imgFrame(it).corners) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
// hauteurs absolues (0 = dessus du brut) : chaque élément est placé dans le brut par « haut du brut → haut du relief » (top) et son épaisseur zH
function reliefCompose(cell, wantMask, maskIds, ext, tight) {
  relSyncLinks();
  const st = S.stock; let X0 = 0, Y0 = 0, X1 = st.w, Y1 = st.h;
  if (tight) { X0 = Y0 = Infinity; X1 = Y1 = -Infinity; for (const it of S.relief.items) { if (!it.visible || !relGrid[it.id]) continue; const r = (it.rot || 0) * Math.PI / 180, ex = Math.abs(Math.cos(r)) * it.w / 2 + Math.abs(Math.sin(r)) * it.h / 2, ey = Math.abs(Math.sin(r)) * it.w / 2 + Math.abs(Math.cos(r)) * it.h / 2; X0 = Math.min(X0, it.x - ex); Y0 = Math.min(Y0, it.y - ey); X1 = Math.max(X1, it.x + ex); Y1 = Math.max(Y1, it.y + ey); } if (!(X1 > X0)) { X0 = 0; Y0 = 0; X1 = st.w; Y1 = st.h; } else if (typeof cell === 'function') cell = cell(X1 - X0, Y1 - Y0); }
  if (ext) for (const it of S.relief.items) { if (!it.visible || !relGrid[it.id]) continue; const r = (it.rot || 0) * Math.PI / 180, ex = Math.abs(Math.cos(r)) * it.w / 2 + Math.abs(Math.sin(r)) * it.h / 2, ey = Math.abs(Math.sin(r)) * it.w / 2 + Math.abs(Math.cos(r)) * it.h / 2; X0 = Math.min(X0, it.x - ex); Y0 = Math.min(Y0, it.y - ey); X1 = Math.max(X1, it.x + ex); Y1 = Math.max(Y1, it.y + ey); } // affichage : aussi la partie hors du brut
  if (ext) while (((X1 - X0) / cell + 1) * ((Y1 - Y0) / cell + 1) > 4e6) cell *= 1.25;
  const DW = X1 - X0, DH = Y1 - Y0, nx = Math.max(2, Math.round(DW / cell) + 1), ny = Math.max(2, Math.round(DH / cell) + 1), cx = DW / (nx - 1), cy = DH / (ny - 1), H = new Float32Array(nx * ny).fill(NaN), Mk = wantMask ? new Uint8Array(nx * ny) : null;
  for (const it of S.relief.items) {
    if (!it.visible) continue; const f = relSrc(it), g = relGrid[it.id]; if (!f) continue;
    const r = (it.rot || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), hw = it.w / 2, hh = it.h / 2, ex = Math.abs(cs) * hw + Math.abs(sn) * hh, ey = Math.abs(sn) * hw + Math.abs(cs) * hh;
    const i0 = Math.max(0, Math.floor((it.x - ex - X0) / cx)), i1 = Math.min(nx - 1, Math.ceil((it.x + ex - X0) / cx)), j0 = Math.max(0, Math.floor((it.y - ey - Y0) / cy)), j1 = Math.min(ny - 1, Math.ceil((it.y + ey - Y0) / cy));
    const zH = +it.zH || 0, topZ = -(+it.top || 0), bot = topZ - zH, inv = !!it.invert, mode = it.mode || 'add', CL = relClipMask(it, i0, i1, j0, j1, cx, cy, X0, Y0), cw = i1 - i0 + 1, fe = Math.max(1e-6, 0.2 * Math.min(hw, hh));
    for (let j = j0; j <= j1; j++) { const dy = Y0 + j * cy - it.y; for (let i = i0; i <= i1; i++) { const dx = X0 + i * cx - it.x, lu = dx * cs + dy * sn, lv = -dx * sn + dy * cs; if (Math.abs(lu) > hw || Math.abs(lv) > hh) continue; if (CL && !CL[(j - j0) * cw + (i - i0)]) continue;
      const su = lu / it.w + 0.5, sv = 0.5 - lv / it.h, v = relSample(f, g.nx, g.ny, su, sv); if (v !== v) continue; const h = zH * (inv ? 1 - v : v), q = j * nx + i, cur = H[q];
      if (Mk && (!maskIds || maskIds.includes(it.id)) && (it.kind !== 'image' || relSample(relMaskF(it), g.nx, g.ny, Math.max(0, Math.min(1, su)), Math.max(0, Math.min(1, sv))) >= 0.5)) Mk[q] = 1;
      let w = 0; if (mode === 'blend') { const t = Math.min(1, Math.min(hw - Math.abs(lu), hh - Math.abs(lv)) / fe); w = 0.5 * t * t * (3 - 2 * t); } // mélanger : moyenne des deux reliefs, fondue vers les bords
      H[q] = cur !== cur ? (mode === 'sub' ? topZ - h : bot + h) : mode === 'sub' ? cur - h : mode === 'max' ? Math.max(cur, bot + h) : mode === 'min' ? Math.min(cur, bot + h) : mode === 'blend' ? cur + (bot + h - cur) * w : cur + h; } }
  }
  // fond (zones sans relief) : le bas le plus bas des éléments
  let base = Infinity; for (const it of S.relief.items) if (it.visible && relGrid[it.id]) base = Math.min(base, -(+it.top || 0) - (+it.zH || 0)); if (base === Infinity) base = 0;
  let mx = -Infinity, mn = Infinity; for (let i = 0; i < H.length; i++) { if (H[i] !== H[i]) H[i] = base; if (H[i] > mx) mx = H[i]; if (H[i] < mn) mn = H[i]; }
  return { nx, ny, cx, cy, H, M: Mk, max: mx, min: mn, base, ox: X0, oy: Y0, dw: DW, dh: DH };
}
function relClipSig(it) { if (!it.clip) return ''; let h = 0; for (const id of it.clip) { const x = shapeById(id); if (!x || !x.pts) continue; h += x.pts.length * 7.3; for (const q of x.pts) h += q[0] * 1.37 + q[1] * 2.11; } return it.clip.join(',') + ':' + h.toFixed(4); }
// limite d'un relief par des vecteurs fermés : masque (pair-impair, les formes intérieures font des trous) sur la fenêtre de la grille
function relClipMask(it, i0, i1, j0, j1, cx, cy, ox = 0, oy = 0) {
  if (!it.clip || !it.clip.length) return null; const sh = it.clip.map(id => shapeById(id)).filter(x => x && x.closed && x.pts && x.pts.length > 2); if (!sh.length) return null;
  const w = i1 - i0 + 1, h = j1 - j0 + 1; if (w < 1 || h < 1) return null; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.beginPath(); for (const x of sh) { x.pts.forEach((q, k) => { const X = (q[0] - ox) / cx - i0 + 0.5, Y = (q[1] - oy) / cy - j0 + 0.5; k ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); } g.fillStyle = '#000'; g.fill('evenodd');
  const d = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h); for (let k = 0; k < m.length; k++) m[k] = d[k * 4 + 3] >= 128 ? 1 : 0; return m;
}
// aperçu 2D : ombrage sous le dessin
// déplacement d'un relief : le reste est figé et l'élément déplacé est affiché décalé, sans recalcul ; calcul complet au lâcher
let RELDRAG = null;
function relDragBegin(it) { const d0 = RELDRAG; if (d0) { if (!d0.q) { clearTimeout(d0.rt); d0.rt = setTimeout(() => relDragFine(d0), 350); } return; } if (!it || (it.clip && it.clip.length) || relLinked(it)) return; RELDRAG = { id: it.id, x0: it.x, y0: it.y, t0: +it.top || 0, q: 0 }; }
/* couches préparées dès l'appui : la pièce suit la souris dès le premier mouvement */
function relDragPrep(it) { relDragEnd(); relDragBegin(it); const d = RELDRAG; if (!d) return; const ids = S.relief.show !== false ? S.relief.items.filter(i => i.visible && relGrid[i.id] && (i.kind === 'stl' || i.kind === 'gen' || (i.kind === 'image' && !relLinked(i)))).map(i => i.id) : []; if (ids.length && VIEWS.d2) relDrag2D(ids); if (typeof rvSync === 'function') rvSync(); }
/* départ immédiat avec des couches grossières ; affinées dès que la souris marque une pause */
function relDragFine(d) { if (RELDRAG !== d || d.q) return; d.q = 1; d.l2 = null; if (typeof RV !== 'undefined' && RV.dm) { for (const m of [RV.dm.a, RV.dm.b]) if (m) RV.gl.deleteVertexArray(m.vao); RV.dm = null; } draw(); if (typeof rvReq === 'function') rvReq(); }
function relDragEnd() { const d = RELDRAG; if (!d) return; clearTimeout(d.rt); RELDRAG = null; if (typeof RV !== 'undefined' && RV.dm) { for (const m of [RV.dm.a, RV.dm.b]) if (m) RV.gl.deleteVertexArray(m.vao); RV.dm = null; } const it = S.relief.items.find(i => i.id === d.id); if (!it || (it.x === d.x0 && it.y === d.y0 && (+it.top || 0) === d.t0)) return; /* simple clic : rien à recalculer */ relDirty = true; drawRelief.last = 0; drawRelief.t1 = 0; if (typeof RV !== 'undefined') { RV.lastBuild = 0; RV.lastEnd = 0; } }
function relOnly(pred, fn) { const its = S.relief.items, sv = its.map(i => i.visible), d = RELDRAG, m = d && its.find(i => i.id === d.id), p = m && [m.x, m.y, m.top]; its.forEach(i => { if (!pred(i)) i.visible = false; }); if (m) { m.x = d.x0; m.y = d.y0; m.top = d.t0; } /* couches calculées à la position de départ, décalées ensuite à l'affichage */ try { return fn(); } finally { its.forEach((i, k) => { i.visible = sv[k]; }); if (m) { m.x = p[0]; m.y = p[1]; m.top = p[2]; } } }
function relShade(R, cv, min, max) {
  const { nx, ny, cx, cy, H } = R; cv = cv || document.createElement('canvas'); cv.width = nx; cv.height = ny;
  const g = cv.getContext('2d'), im = g.createImageData(nx, ny), span = Math.max(1e-6, max - min), L = v3n([-0.5, 0.6, 0.62]);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = j * nx + i, hx = (H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)]) / (2 * cx), hy = (H[Math.min(ny - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i]) / (2 * cy), n = v3n([-hx, -hy, 1]);
    const sh = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]), lv = 0.35 + 0.65 * (H[q] - min) / span, c = Math.round(255 * Math.min(1, 0.25 + 0.75 * sh) * (0.55 + 0.45 * lv)), o = ((ny - 1 - j) * nx + i) * 4;
    im.data[o] = c; im.data[o + 1] = Math.round(c * 0.96); im.data[o + 2] = Math.round(c * 0.9); im.data[o + 3] = R.M[q] ? 235 : 0; }
  g.putImageData(im, 0, 0); return cv;
}
function relDrag2D(ids) {
  const d = RELDRAG, it = S.relief.items.find(i => i.id === d.id); if (!it) { RELDRAG = null; return null; }
  if (!d.l2) { const b = d.q ? [250000, 400000, 600000][relLevel()] : 90000, cf = (w, h) => Math.max(0.015, Math.sqrt(w * h / b)), oth = ids.filter(i => i !== d.id), mk = (pred, mids) => mids.length ? relOnly(pred, () => reliefCompose(cf, true, mids, true, true)) : null;
    const A = mk(i => i.id !== d.id, oth), B = mk(i => i.id === d.id, ids.includes(d.id) ? [d.id] : []), min = Math.min(A ? A.min : Infinity, B ? B.min : Infinity), max = Math.max(A ? A.max : -Infinity, B ? B.max : -Infinity);
    d.l2 = [A && { R: A, cv: relShade(A, null, min, max) }, B && { R: B, cv: relShade(B, null, min, max) }]; }
  const [A, B] = d.l2, out = []; if (A) out.push([A, 0, 0]); if (B) out.push([B, it.x - d.x0, it.y - d.y0]); return out;
}
// aperçu 2D : ombrage sous le dessin
function drawRelief(C) {
  const shownIds = S.relief && S.relief.show !== false ? S.relief.items.filter(i => i.visible && relGrid[i.id] && (i.kind === 'stl' || i.kind === 'gen' || (i.kind === 'image' && !relLinked(i)))).map(i => i.id) : [];
  if (!shownIds.length) return;
  const sk = S.stock.w + 'x' + S.stock.h + 'x' + S.stock.t, now = performance.now(), lay = RELDRAG ? relDrag2D(shownIds) : null;
  if (!lay && relDirty && relCache && relCache.sk === sk && now - (drawRelief.t1 || 0) < Math.max(60, drawRelief.cost || 0)) { if (!drawRelief.th) drawRelief.th = setTimeout(() => { drawRelief.th = 0; draw(); }, Math.max(60, drawRelief.cost || 0)); } // recalcul au plus une fois par intervalle : l'image précédente reste affichée entre-temps
  else if (!lay && (relDirty || !relCache || relCache.sk !== sk)) { // image d'ombrage limitée à l'emprise des reliefs (fine même sur un grand brut)
    const rapid = now - (drawRelief.last || 0) < 300, R = reliefCompose((w, h) => Math.max(0.015, Math.sqrt(w * h / (rapid ? 300000 : [400000, 1500000, 3000000][relLevel()]))), true, shownIds, true, true), cv = relShade(R, relCache && relCache.cv, R.min, R.max);
    relCache = { cv, R, sk }; relDirty = false; drawRelief.last = now; drawRelief.t1 = performance.now(); drawRelief.cost = drawRelief.t1 - now; clearTimeout(drawRelief.fine); if (rapid) drawRelief.fine = setTimeout(() => { drawRelief.last = 0; relDirty = true; draw(); }, 320); /* pendant une manipulation : image plus grossière, affinée à l'arrêt */
  }
  ctx.save(); ctx.imageSmoothingEnabled = true; if (!$('#tpWin').hidden && (S.form || {}).type !== 'relief') ctx.globalAlpha = 0.3;
  for (const [Ly, dx, dy] of lay || [[relCache, 0, 0]]) { const Rc = Ly.R; ctx.drawImage(Ly.cv, sx(Rc.ox + dx), sy(Rc.oy + Rc.dh + dy), Rc.dw * S.view.s, Rc.dh * S.view.s); }
  ctx.restore();
  const it = curTab === 'relief' && S.ui.tool !== 'select' && relCur(); if (it) { const f = imgFrame(it), cs = f.corners.map(q => [sx(q[0]), sy(q[1])]); ctx.save(); ctx.strokeStyle = C.acc; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath(); cs.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke(); ctx.restore(); }
}
function relSummary() { const el = $('#relSum'); if (!el) return; const n = S.relief.items.length; if (!n) { el.textContent = tr('Aucun relief : importez un STL ou créez-en un à partir du dessin.'); return; } const R = reliefCompose(Math.max(1, Math.max(S.stock.w, S.stock.h) / 200)), dep = -R.min; const out = S.relief.items.some(i => { if (!i.visible) return false; const r = (i.rot || 0) * Math.PI / 180, ex = Math.abs(Math.cos(r)) * i.w / 2 + Math.abs(Math.sin(r)) * i.h / 2, ey = Math.abs(Math.sin(r)) * i.w / 2 + Math.abs(Math.cos(r)) * i.h / 2; return i.x - ex < -0.01 || i.y - ey < -0.01 || i.x + ex > S.stock.w + 0.01 || i.y + ey > S.stock.h + 0.01; }); el.textContent = trf('{n} élément(s) · profondeur du relief {d} mm (brut {t} mm).', { n, d: fr(dep, 2), t: fr(S.stock.t, 1) }) + (dep > S.stock.t + 1e-6 ? ' ⚠ ' + tr('Le relief dépasse l’épaisseur du brut : il sera coupé au fond. Augmentez l’épaisseur du brut (onglet Projet) ou réduisez l’épaisseur du relief.') : '') + (out ? ' ⚠ ' + tr('Un relief déborde du brut : la partie en dehors ne sera pas usinée.') : ''); el.classList.toggle('bad', dep > S.stock.t + 1e-6 || out); }
function relBump() { S.relief.ver = (S.relief.ver || 0) + 1; if (typeof renderTpList === 'function') renderTpList(); }
function relAdd(it, g) { if (it.top === undefined) it.top = 0; relBump(); if (typeof RV !== 'undefined') RV.fitted = false; it.id = 'r' + Math.random().toString(36).slice(2, 9); relStore(it.id, g); S.relief.items.push(it); S.relSel = it.id; relDirty = true; commit(false); relPanel(); setTab('relief'); draw(); }
function relSet(fn) { const it = relCur(); if (!it) return; fn(it); if (relLinked(it)) { const im = imgById(it.src); im.x = it.x; im.y = it.y; im.w = it.w; im.h = it.h; im.rot = it.rot || 0; renderImgPanel(true); } relBump(); relDirty = true; commit(false); relPanel(true); draw(); }
// image en niveaux de gris (le côté le plus long ramené à 1024 points)
function relGridFromImg(im) { const k = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight)), nx = Math.max(2, Math.round(im.naturalWidth * k)), ny = Math.max(2, Math.round(im.naturalHeight * k)), cv = document.createElement('canvas'); cv.width = nx; cv.height = ny; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, nx, ny); const px = g.getImageData(0, 0, nx, ny).data, d = new Uint16Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) { const a = px[i * 4 + 3]; d[i] = a < 128 ? 0 : 1 + Math.round((0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255 * 65534); } return { nx, ny, d }; }
// relief en niveaux de gris à partir d'une image du dessin (même position, taille et angle ; copie)
function relFromImage() {
  const im = (S.imgSel && imgById(S.imgSel)) || (S.images.length === 1 ? S.images[0] : null);
  if (!im) { toast(tr(S.images.length ? 'Sélectionnez dans la vue 2D l’image à transformer en relief.' : 'Insérez d’abord une image dans l’onglet Dessin (Importer › Image), puis sélectionnez-la.')); return; }
  const src = imgData[im.id]; if (!src) { toast(tr('Image illisible.')); return; }
  const el = new Image(); el.onload = () => { const g = relGridFromImg(el);
    S.images = S.images.filter(x => x !== im); S.imgSel = null; renderImgPanel(); // l'image devient le relief : elle quitte la vue 2D
    relAdd({ kind: 'image', linked: false, top: 0, name: (im.name || tr('Image')).replace(/\.[a-z0-9]{2,5}$/i, ''), x: im.x, y: im.y, w: im.w, h: im.h, rot: im.rot || 0, zH: Math.min(5, S.stock.t / 2), z0: 0, invert: false, smooth: 1, mode: 'add', visible: true }, g);
    commit(false); draw(); toast(tr('Image transformée en relief : déplacez-la et redimensionnez-la dans la vue 2D, réglez son épaisseur Z.')); };
  el.onerror = () => toast(tr('Image illisible.')); el.src = src;
}
function relImportImage(file) {
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = () => { const k = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight)), nx = Math.max(2, Math.round(im.naturalWidth * k)), ny = Math.max(2, Math.round(im.naturalHeight * k)), cv = document.createElement('canvas'); cv.width = nx; cv.height = ny; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, nx, ny); const px = g.getImageData(0, 0, nx, ny).data, d = new Uint16Array(nx * ny);
    for (let i = 0; i < nx * ny; i++) { const a = px[i * 4 + 3]; d[i] = a < 128 ? 0 : 1 + Math.round((0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255 * 65534); }
    URL.revokeObjectURL(url); const st = S.stock, ar = nx / ny, w = Math.min(st.w * 0.8, st.h * 0.8 * ar);
    relAdd({ kind: 'image', name: file.name.replace(/\.[^.]+$/, ''), x: st.w / 2, y: st.h / 2, w, h: w / ar, rot: 0, zH: Math.min(5, st.t / 2), z0: 0, invert: false, smooth: 1, mode: 'add', visible: true }, { nx, ny, d }); toast(tr('Relief importé : réglez sa taille et son épaisseur Z.')); };
  im.onerror = () => { URL.revokeObjectURL(url); toast(tr('Image illisible.')); }; im.src = url;
}
// STL binaire ou texte -> triangles (Float32, 9 valeurs par triangle)
function stlParse(buf) {
  const dv = new DataView(buf), n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  if (n && 84 + n * 50 === buf.byteLength) { const T = new Float32Array(n * 9); for (let t = 0; t < n; t++) { const o = 84 + t * 50 + 12; for (let k = 0; k < 9; k++) T[t * 9 + k] = dv.getFloat32(o + k * 4, true); } return T; }
  const txt = new TextDecoder().decode(new Uint8Array(buf)), re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g, v = []; let m; while ((m = re.exec(txt))) v.push(+m[1], +m[2], +m[3]);
  if (v.length < 9) throw new Error(tr('Fichier STL illisible.')); return new Float32Array(v.slice(0, v.length - v.length % 9));
}
function relOrMigrate(it) {
  if (!it || it.kind !== 'stl' || !it.orient || it.orient === 'z' || +it.rx || +it.ry) return;
  const f0 = STL_OR[it.orient]; if (!f0) return; const B = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], R = a => Math.round(a);
  for (const a of [0, 90, 180, -90]) for (const b of [0, 90, 180, -90]) {
    const ax = a * Math.PI / 180, ay = b * Math.PI / 180, cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    const ok = B.every(v => { let [p, q, r] = v; [q, r] = [q * cx - r * sx, q * sx + r * cx]; [p, r] = [p * cy + r * sy, -p * sy + r * cy]; const w = f0(...v); return R(p) === w[0] && R(q) === w[1] && R(r) === w[2]; });
    if (ok) { it.orient = 'z'; it.rx = a; it.ry = b; return; }
  }
}
var STL_OR = { z: (x, y, z) => [x, y, z], '-z': (x, y, z) => [x, -y, -z], y: (x, y, z) => [x, -z, y], '-y': (x, y, z) => [x, z, -y], x: (x, y, z) => [y, z, x], '-x': (x, y, z) => [y, -z, -x] };
// rastérisation vue de dessus : tampon de profondeur (on garde le Z le plus haut)
function stlRaster(T, orient, rx, ry) {
  const f0 = STL_OR[orient] || STL_OR.z, ax = (+rx || 0) * Math.PI / 180, ay = (+ry || 0) * Math.PI / 180, cl = v => Math.round(v * 1e12) / 1e12, cxr = cl(Math.cos(ax)), sxr = cl(Math.sin(ax)), cyr = cl(Math.cos(ay)), syr = cl(Math.sin(ay));
  const f = (ax || ay) ? (x, y, z) => { let [a, b, c] = f0(x, y, z); [b, c] = [b * cxr - c * sxr, b * sxr + c * cxr]; [a, c] = [a * cyr + c * syr, -a * syr + c * cyr]; return [a, b, c]; } : f0, n = T.length / 9, P = new Float32Array(T.length); let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n * 3; i++) { const q = f(T[i * 3], T[i * 3 + 1], T[i * 3 + 2]); P[i * 3] = q[0]; P[i * 3 + 1] = q[1]; P[i * 3 + 2] = q[2]; if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; if (q[2] < z0) z0 = q[2]; if (q[2] > z1) z1 = q[2]; }
  const W = x1 - x0, Hh = y1 - y0, Z = Math.max(1e-6, z1 - z0), c = Math.max(W, Hh) / 1023 || 1, nx = Math.max(2, Math.round(W / c) + 1), ny = Math.max(2, Math.round(Hh / c) + 1), zb = new Float32Array(nx * ny).fill(-Infinity);
  for (let t = 0; t < n; t++) { const o = t * 9, ax = (P[o] - x0) / c, ay = (y1 - P[o + 1]) / c, az = P[o + 2], bx = (P[o + 3] - x0) / c, by = (y1 - P[o + 4]) / c, bz = P[o + 5], qx = (P[o + 6] - x0) / c, qy = (y1 - P[o + 7]) / c, qz = P[o + 8];
    const den = (by - qy) * (ax - qx) + (qx - bx) * (ay - qy); if (Math.abs(den) < 1e-12) continue;
    const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, qx) - 1e-9)), i1 = Math.min(nx - 1, Math.floor(Math.max(ax, bx, qx) + 1e-9)), j0 = Math.max(0, Math.ceil(Math.min(ay, by, qy) - 1e-9)), j1 = Math.min(ny - 1, Math.floor(Math.max(ay, by, qy) + 1e-9));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const l1 = ((by - qy) * (i - qx) + (qx - bx) * (j - qy)) / den, l2 = ((qy - ay) * (i - qx) + (ax - qx) * (j - qy)) / den, l3 = 1 - l1 - l2; if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue; const z = l1 * az + l2 * bz + l3 * qz, q = j * nx + i; if (z > zb[q]) zb[q] = z; } }
  const d = new Uint16Array(nx * ny); for (let i = 0; i < d.length; i++) d[i] = zb[i] === -Infinity ? 0 : 1 + Math.round((zb[i] - z0) / Z * 65534);
  return { g: { nx, ny, d }, W, H: Hh, Z, tris: n };
}
// contour d'un relief vu de dessus (son empreinte) en vecteurs fermés, pour le détourer avec un parcours Profil
// contour d'un relief (boucles fermées, en mm), mis en cache tant que le relief ne change pas
const relOutC = new Map();
function relOutLoops(it) {
  if (!it || !relGrid[it.id]) return [];
  const key = JSON.stringify([it.x, it.y, it.w, it.h, it.rot, it.rx, it.ry, it.zH, it.mode, it.invert, relGid(relGrid[it.id]), relGrid[it.id].nx, relGrid[it.id].ny, typeof relClipSig === 'function' ? relClipSig(it) : '', S.stock.w, S.stock.h]), c0 = relOutC.get(it.id);
  if (c0 && c0.key === key) return c0.loops;
  const st = S.stock; let c = Math.max(0.08, Math.min(0.25, Math.max(it.w, it.h) / 1200)); while ((st.w / c + 1) * (st.h / c + 1) > 9e6) c *= 1.25;
  const R = reliefCompose(c, true, [it.id]), { nx, ny, cx, cy, M } = R, g = new Float32Array(nx * ny); let n = 0; for (let q = 0; q < g.length; q++) if (M[q]) { g[q] = 1; n++; }
  const loops = n ? vzTrace({ W: nx, H: ny, g, blur: new Map() }, 0.5, true, 2).map(lp => lp.map(p => [(p[0] - 0.5) * cx, (p[1] - 0.5) * cy])) : [];
  relOutC.set(it.id, { key, loops }); return loops;
}
// pseudo-vecteurs fermés suivant le contour des reliefs d'un parcours (non ajoutés au dessin)
function tpRelShapes(tp) { const out = []; for (const id of tp.relIds || []) { const it = S.relief.items.find(x => x.id === id); if (!it) continue; relOutLoops(it).forEach((pts, k) => out.push({ id: 'rel_' + id + '_' + k, pts, closed: true, nodes: pts.map(p => NODE(p[0], p[1])), layer: S.layerActive })); } return out; }
function relOutline(it) {
  const st = S.stock; let c = Math.max(0.08, Math.min(0.25, Math.max(it.w, it.h) / 1200)); while ((st.w / c + 1) * (st.h / c + 1) > 9e6) c *= 1.25;
  const R = reliefCompose(c, true, [it.id]), { nx, ny, cx, cy, M } = R, g = new Float32Array(nx * ny); let n = 0; for (let q = 0; q < g.length; q++) if (M[q]) { g[q] = 1; n++; }
  if (!n) { toast(tr('Ce relief n’a pas d’emprise sur le brut.')); return; }
  const loops = vzTrace({ W: nx, H: ny, g, blur: new Map() }, 0.5, true, 2); // léger flou : supprime l’escalier de la grille sans déplacer les bords droits if (!loops.length) { toast(tr('Contour introuvable.')); return; }
  const gid = loops.length > 1 ? uid() : null; S.sel.clear(); S.relSel = null; let k = 0;
  for (const lp of loops) { const nodes = lp.map(p => NODE((p[0] - 0.5) * cx, (p[1] - 0.5) * cy)); const sh = mkShape(nodes, true, gid ? { g: gid } : undefined); if (sh) { S.sel.add(sh.id); k++; } }
  commit(); renderSel(); relPanel(); setTab('dessin'); draw(); toast(trf('Contour du relief créé ({n} vecteur(s), sélectionnés) : créez un parcours Profil à l’extérieur pour détourer la pièce.', { n: k }));
}
// avertissement quand un relief ne tient pas dans le brut (rien n'est réduit automatiquement)
function relFitWarn(it) { const st = S.stock, m = []; if ((+it.top || 0) + (+it.zH || 0) > st.t + 1e-6) m.push(trf('hauteur {z} mm pour un brut de {t} mm', { z: fr((+it.top || 0) + (+it.zH || 0), 1), t: fr(st.t, 1) })); if (it.w > st.w + 1e-6 || it.h > st.h + 1e-6) m.push(trf('{w} × {h} mm pour un brut de {bw} × {bh} mm', { w: fr(it.w, 1), h: fr(it.h, 1), bw: fr(st.w, 1), bh: fr(st.h, 1) })); return m.length ? ' ⚠ ' + trf('Le modèle dépasse le brut ({m}) : agrandissez le brut dans l’onglet Projet, ou réduisez le modèle.', { m: m.join(', ') }) : ''; }
function relImportStl(file) {
  toast(tr('Lecture du STL…')); file.arrayBuffer().then(buf => { setTimeout(() => { try {
    const T = stlParse(buf), R = stlRaster(T, 'z'), st = S.stock, k = 1, zH = R.Z; // taille réelle, jamais réduite : le brut s'ajuste ensuite si besoin
    const it = { kind: 'stl', name: file.name.replace(/\.[^.]+$/, ''), x: st.w / 2, y: st.h / 2, w: R.W * k, h: R.H * k, rot: 0, zH, z0: 0, invert: false, smooth: 0, mode: 'add', visible: true, orient: 'z', nat: [R.W, R.H, R.Z], tris: R.tris };
    relAdd(it, R.g); relMesh[it.id] = T; idbPutImg('relm_' + it.id, T).catch(() => { });
    toast(trf('STL importé à sa taille réelle : {n} triangles, {w} × {h} × {z} mm.', { n: R.tris.toLocaleString(), w: fr(R.W, 1), h: fr(R.H, 1), z: fr(R.Z, 1) }) + relFitWarn(it));
  } catch (e) { toast(e.message || tr('Fichier STL illisible.')); } }, 30); });
}
function relReorient(it, o) {
  const T = relMesh[it.id]; if (!T) { toast(tr('Réimportez le STL pour changer son orientation (le maillage n’est plus en mémoire).')); relPanel(true); return; }
  const R = stlRaster(T, o, it.rx, it.ry), k = it.w / (it.nat ? it.nat[0] : R.W); relBump(); it.orient = o; it.nat = [R.W, R.H, R.Z]; it.h = R.H * k; it.zH = R.Z * k; relStore(it.id, R.g); relDirty = true; commit(false); relPanel(); draw();
}
function relPanel(soft) {
  const ul = $('#relList'), box = $('#relProps'); if (!ul) return; if (typeof rvReq === 'function') rvReq(); const it = relCur(); box.hidden = !it;
  if (it) {
    const o = outXY(it.x, it.y), set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
    const an = S.ui.relAnchor || 'mc', pa = anchorPt(relBox(it), an), oa = outXY(pa[0], pa[1]); $$('#rlAnchor button').forEach(b => b.setAttribute('aria-pressed', b.dataset.a === an));
    set('#rlName', it.name); set('#rlX', +oa[0].toFixed(2)); set('#rlY', +oa[1].toFixed(2)); set('#rlW', +it.w.toFixed(2)); set('#rlH', +it.h.toFixed(2)); set('#rlTop', +(+it.top || 0).toFixed(2)); set('#rlBot', +(S.stock.t - (+it.top || 0) - (+it.zH || 0)).toFixed(2)); const lk = relLinked(it); $('#rlLinkRow').hidden = !(it.kind === 'image' && it.src && imgById(it.src)); $('#rlLink').checked = !!lk; relOrMigrate(it); set('#rlR', +(it.rot || 0).toFixed(1)); set('#rlRx', +(+it.rx || 0).toFixed(1)); set('#rlRy', +(+it.ry || 0).toFixed(1)); $('#rlRxRow').hidden = $('#rlRyRow').hidden = it.kind !== 'stl'; set('#rlZ', +(+it.zH).toFixed(2)); set('#rlS', it.smooth || 0); $('#rlSv').textContent = it.smooth || 0; $('#rlMode').value = it.mode || 'add'; $('#rlInv').checked = !!it.invert;
    { const n = (it.clip || []).filter(id => { const x = shapeById(id); return x && x.closed; }).length, pk = relClipPick === it.id; $('#rlClipA').hidden = pk; $('#rlClipB').hidden = !pk; $('#rlClipT').textContent = pk ? trf('Cliquez dans la vue 2D les vecteurs fermés qui limitent le relief ({n} choisi(s)), puis validez.', { n: S.sel.size }) : n ? trf('Limité par {n} vecteur(s) fermé(s) : pas de relief en dehors.', { n }) : tr('Aucune limite : le relief occupe tout son cadre.'); $('#rlUnclip').disabled = !n; if (pk) $('#rlClipOk').disabled = !S.sel.size; }
    $('#rlInvRow').hidden = it.kind === 'stl' || !!it.gen;
    $('#rlCutRow').hidden = it.kind !== 'image'; $('#rlCut').checked = +it.cut > 0; $('#rlCutSRow').hidden = !(+it.cut > 0); $('#rlCutS').value = +it.cut || 8; $('#rlCutv').textContent = (+it.cut || 8) + ' %';
    { const G = it.gen; $('#rlGen').hidden = !G; if (G) { $('#rlGP').value = G.prof || 'round'; $('#rlGPRow').hidden = G.type === 'sweep'; $('#rlGSRow').hidden = !(G.type === 'sweep' && G.all); if (G.all) $('#rlGS').value = String(G.secIdx); set('#rlGW', +(+G.W || 0).toFixed(2)); $('#rlGWRow').hidden = G.type === 'sweep'; $('#rlGWL').textContent = tr(G.type === 'dome' ? 'Largeur du bord (mm, 0 = jusqu’au centre)' : 'Largeur (mm)'); $('#rlGERow').hidden = G.type !== 'sweep'; set('#rlGE', G.end ?? 100); $('#rlGPrRow').hidden = G.type !== 'sweep'; $('#rlGPr').checked = !!G.prop; $('#rlGFRow').hidden = !(G.all || G.profs); $('#rlGTRow').hidden = !(G.profs && G.profs.length > 1); $('#rlGT').checked = G.smoothT !== false; $('#rlGF').checked = !!G.secFlip; const pi = $('#rlGInfo'); if (pi) { pi.hidden = G.type !== 'sweep'; pi.textContent = G.type !== 'sweep' ? '' : G.profs ? trf('{n} profils, placés à {p} de la longueur des rails : la section passe de l’un à l’autre.', { n: G.profs.length, p: G.profs.map(q => Math.round(q.t * 100) + ' %').join(', ') }) : G.all ? tr('Un profil : la même section tout le long.') : tr('Sans profil : section ronde.'); } } } const g = relGrid[it.id];
    $('#rlInfo').textContent = (it.kind === 'stl' ? trf('Modèle STL {w} × {h} × {z} mm, {n} triangles.', { w: fr(it.nat[0], 1), h: fr(it.nat[1], 1), z: fr(it.nat[2], 1), n: (it.tris || 0).toLocaleString() }) + ' ' : '') + (g ? trf('Grille source {a} × {b} points ({p} mm par point).', { a: g.nx, b: g.ny, p: fr(it.w / (g.nx - 1), 2) }) : tr('Données absentes : réimportez le fichier.'));
  }
  $('#relShow').checked = S.relief.show !== false;
  if (soft) return; relSummary();
  ul.innerHTML = ''; if (!S.relief.items.length) { ul.innerHTML = '<li class="hint">' + tr('Aucun élément. Importez une image en niveaux de gris ou un modèle STL.') + '</li>'; return; }
  S.relief.items.forEach((x, k) => {
    const li = document.createElement('li'); li.className = 'imgrow' + (x.id === S.relSel ? ' on' : '');
    li.innerHTML = '<span class="relk"></span><span></span><button class="iconbtn" data-i="up" title="' + tr('Monter') + '" aria-label="' + tr('Monter') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 14l5-5 5 5"/></svg></button><button class="iconbtn" data-i="vis" title="' + tr(x.visible ? 'Masquer' : 'Afficher') + '" aria-label="' + tr('Visibilité') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>' + (x.visible ? '<circle cx="12" cy="12" r="3"/>' : '<path d="M4 20L20 4"/>') + '</svg></button><button class="iconbtn" data-i="del" title="' + tr('Supprimer ce relief') + '" aria-label="' + tr('Supprimer ce relief') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>';
    li.querySelector('.relk').textContent = x.kind === 'stl' ? 'STL' : x.gen ? { dome: 'DÔME', extrude: 'EXTR', sweep: 'RAIL' }[x.gen.type] : 'IMG'; li.children[1].textContent = x.name + ' · ' + tr({ add: 'Ajouter', sub: 'Soustraire', max: 'Garder le plus haut', min: 'Garder le plus bas', blend: 'Mélanger' }[x.mode || 'add']);
    li.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { e.stopPropagation(); if (b.dataset.i === 'del') { S.relSel = x.id; imgAct('relDel'); return; } if (b.dataset.i === 'vis') x.visible = !x.visible; else if (k > 0) { const A = S.relief.items; [A[k - 1], A[k]] = [A[k], A[k - 1]]; } relBump(); relDirty = true; commit(false); relPanel(); draw(); return; } S.relSel = x.id; relPanel(); draw(); };
    ul.appendChild(li);
  });
}
function bindRelPanel() {
  const num = id => parseFloat(String($(id).value).replace(',', '.'));
  $('#fRelImg').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) relImportImage(f); };
  $('#fRelStl').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) relImportStl(f); };
  $('#rlName').onchange = () => relSet(i => { i.name = $('#rlName').value.trim() || i.name; });
  $('#rlX').onchange = $('#rlY').onchange = () => relSet(i => { const q = inXY(isFinite(num('#rlX')) ? num('#rlX') : 0, isFinite(num('#rlY')) ? num('#rlY') : 0), pa = anchorPt(relBox(i), S.ui.relAnchor || 'mc'); i.x += q[0] - pa[0]; i.y += q[1] - pa[1]; });
  $$('#rlAnchor button').forEach(b => b.onclick = () => { S.ui.relAnchor = b.dataset.a; relPanel(true); });
  $('#rlTop').onchange = () => relSet(i => { const v = num('#rlTop'); if (isFinite(v)) i.top = v; });
  $('#rlBot').onchange = () => relSet(i => { const v = num('#rlBot'); if (isFinite(v)) i.top = S.stock.t - v - (+i.zH || 0); });
  $('#rlLink').onchange = () => relSet(i => { i.linked = $('#rlLink').checked; });
  const keepA = (i, fn) => { const an = S.ui.relAnchor || 'mc', pa = anchorPt(relBox(i), an); fn(); const pb = anchorPt(relBox(i), an); i.x += pa[0] - pb[0]; i.y += pa[1] - pb[1]; };
  $('#rlW').onchange = () => relSet(i => { const v = num('#rlW'); if (!(v > 0)) return; keepA(i, () => { if ($('#rlLock').checked) { i.h *= v / i.w; i.zH *= v / i.w; } i.w = v; }); });
  $('#rlH').onchange = () => relSet(i => { const v = num('#rlH'); if (!(v > 0)) return; keepA(i, () => { if ($('#rlLock').checked) { i.w *= v / i.h; i.zH *= v / i.h; } i.h = v; }); });
  $('#rlR').onchange = () => relSet(i => { const v = num('#rlR'); if (isFinite(v)) i.rot = v; });
  const relTilt = k => relSet(i => { const v = num(k === 'rx' ? '#rlRx' : '#rlRy'); if (!isFinite(v) || i.kind !== 'stl') return; i[k] = ((v % 360) + 540) % 360 - 180; rvReraster(i, true); });
  $('#rlRx').onchange = () => relTilt('rx'); $('#rlRy').onchange = () => relTilt('ry');
  $('#rlZ').onchange = () => relSet(i => { const v = num('#rlZ'); if (v >= 0) i.zH = v; });
  $('#rlS').oninput = () => { $('#rlSv').textContent = $('#rlS').value; }; $('#rlS').onchange = () => relSet(i => { i.smooth = +$('#rlS').value; });
  $('#rlMode').onchange = () => relSet(i => { i.mode = $('#rlMode').value; }); $('#rlInv').onchange = () => relSet(i => { i.invert = $('#rlInv').checked; });
  $('#rlCut').onchange = () => relSet(i => { i.cut = $('#rlCut').checked ? +$('#rlCutS').value || 8 : 0; }); $('#rlCutS').oninput = () => { $('#rlCutv').textContent = $('#rlCutS').value + ' %'; }; $('#rlCutS').onchange = () => relSet(i => { i.cut = +$('#rlCutS').value; });
  const regen = fn => { const it = relCur(); if (!it || !it.gen) return; fn(it.gen); try { relRegen(it); } catch (e) { toast(e.message); } relBump(); relDirty = true; commit(false); relPanel(true); draw(); };
  $('#rlGP').onchange = () => regen(G => { G.prof = $('#rlGP').value; });
  $('#rlGS').onchange = () => regen(G => { relSweepRoles(G, +$('#rlGS').value); });
  $('#rlGF').onchange = () => regen(G => { const f = $('#rlGF').checked; if (G.profs) { if (!!G.secFlip !== f) G.profs.forEach(q => q.sec = q.sec.slice().reverse()); G.secFlip = f; } else { G.secFlip = f; relSweepRoles(G, G.secIdx); } });
  $('#rlGT').onchange = () => regen(G => { G.smoothT = $('#rlGT').checked; });
  $('#rlGW').onchange = () => regen(G => { const v = num('#rlGW'); if (v >= 0) G.W = v; });
  $('#rlGE').onchange = () => regen(G => { const v = num('#rlGE'); if (v >= 0) G.end = v; });
  $('#rlGPr').onchange = () => regen(G => { G.prop = $('#rlGPr').checked; });
  $('#relShow').onchange = () => { S.relief.show = $('#relShow').checked; commit(false); draw(); };
}
// ---- formes créées à partir du dessin : dôme, extrusion le long d'un vecteur, lissage entre deux rails ----
// distance euclidienne exacte (Felzenszwalb) : f = 0 sur les germes, Infinity ailleurs ; renvoie la distance en points
function relEDT(f, nx, ny) {
  const BIG = 1e20, n = Math.max(nx, ny), v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(n), o = new Float64Array(n);
  for (let i = 0; i < f.length; i++) if (f[i] === Infinity) f[i] = BIG;
  const pass = len => { let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < len; q++) { let s = ((g[q] + q * q) - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); while (s <= z[k]) { k--; s = ((g[q] + q * q) - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); } k++; v[k] = q; z[k] = s; z[k + 1] = Infinity; }
    k = 0; for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; o[q] = (q - v[k]) * (q - v[k]) + g[v[k]]; } };
  for (let x = 0; x < nx; x++) { for (let y = 0; y < ny; y++) g[y] = f[y * nx + x]; pass(ny); for (let y = 0; y < ny; y++) f[y * nx + x] = o[y]; }
  for (let y = 0; y < ny; y++) { for (let x = 0; x < nx; x++) g[x] = f[y * nx + x]; pass(nx); for (let x = 0; x < nx; x++) f[y * nx + x] = o[x]; }
  for (let i = 0; i < f.length; i++) f[i] = f[i] >= BIG * 0.5 ? Infinity : Math.sqrt(f[i]);
  return f;
}
const relProf = (pr, t) => { t = Math.max(0, Math.min(1, t)); return pr === 'angular' ? t : pr === 'flat' ? 1 : pr === 'ogee' ? (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)) : Math.sqrt(1 - (1 - t) * (1 - t)); };
function relGenGrid(G) {
  const P = G.polys, pad = G.type === 'extrude' ? (+G.W || 1) / 2 + 0.5 : 0.5; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pl of P) for (const q of pl.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad; const W = x1 - x0, Hh = y1 - y0, c = Math.max(0.04, Math.max(W, Hh) / 1023), nx = Math.max(2, Math.round(W / c) + 1), ny = Math.max(2, Math.round(Hh / c) + 1), N = nx * ny;
  const X = i => x0 + i * c, Y = j => y1 - j * c, h = new Float32Array(N).fill(NaN);
  if (G.type === 'dome') {
    const ins = new Uint8Array(N); // remplissage pair-impair
    for (let j = 0; j < ny; j++) { const y = Y(j), xs = []; for (const pl of P) { const a = pl.pts; for (let k = 0; k < a.length; k++) { const A = a[k], B = a[(k + 1) % a.length]; if ((A[1] <= y) !== (B[1] <= y)) xs.push(A[0] + (y - A[1]) * (B[0] - A[0]) / (B[1] - A[1])); } } xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.max(0, Math.ceil((xs[k] - x0) / c)), i1 = Math.min(nx - 1, Math.floor((xs[k + 1] - x0) / c)); for (let i = i0; i <= i1; i++) ins[j * nx + i] = 1; } }
    const f = new Float64Array(N); for (let i = 0; i < N; i++) f[i] = ins[i] ? Infinity : 0; relEDT(f, nx, ny);
    let dm = 0; for (let i = 0; i < N; i++) if (ins[i] && f[i] > dm) dm = f[i]; const Wd = +G.W > 0 ? +G.W / c : dm; if (!dm) throw new Error(tr('Forme trop petite.'));
    for (let i = 0; i < N; i++) if (ins[i]) h[i] = relProf(G.prof, (f[i] - 0.5) / Math.max(0.5, Wd - 0.5));
  } else if (G.type === 'extrude') {
    const f = new Float64Array(N).fill(Infinity), hw = Math.max(c, (+G.W || 1) / 2);
    for (const pl of P) { const a = pl.closed ? [...pl.pts, pl.pts[0]] : pl.pts; for (let k = 0; k + 1 < a.length; k++) { const A = a[k], B = a[k + 1], n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / (c * 0.5))); for (let s = 0; s <= n; s++) { const x = A[0] + (B[0] - A[0]) * s / n, y = A[1] + (B[1] - A[1]) * s / n, i = Math.round((x - x0) / c), j = Math.round((y1 - y) / c); if (i >= 0 && j >= 0 && i < nx && j < ny) f[j * nx + i] = 0; } } }
    relEDT(f, nx, ny); for (let i = 0; i < N; i++) { const d = f[i] * c; if (d <= hw) h[i] = relProf(G.prof, 1 - d / hw); }
  } else { // lissage entre deux rails : bandes de quadrilatères A_i, A_i+1, B_i+1, B_i, paramètre u en travers
    const rs = pts => { const L = [0]; for (let k = 1; k < pts.length; k++) L.push(L[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); return { pts, L, T: L[L.length - 1] }; };
    const at = (r, t) => { const s = t * r.T; let k = 1; while (k < r.L.length - 1 && r.L[k] < s) k++; const a = r.pts[k - 1], b = r.pts[k], u = (s - r.L[k - 1]) / ((r.L[k] - r.L[k - 1]) || 1); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
    const sec = G.sec && G.sec.length > 1 ? G.sec : null, sAt = (S_, u) => { const x = Math.max(0, Math.min(1, u)) * (S_.length - 1), k = Math.min(S_.length - 2, Math.floor(x)); return S_[k] + (S_[k + 1] - S_[k]) * (x - k); }, secAt = u => sAt(sec, u);
    const PR = G.profs && G.profs.length ? G.profs : null, hm = PR ? Math.max(...PR.map(q => q.h)) || 1 : 1;
    const soft = G.smoothT !== false, multiAt = (u, t) => { const n = PR.length, val = k => sAt(PR[k].sec, u) * PR[k].h / hm; if (t <= PR[0].t) return val(0); if (t >= PR[n - 1].t) return val(n - 1); let k = 1; while (PR[k].t < t) k++;
      const a = k - 1, b = k, ta = PR[a].t, tb = PR[b].t, h = Math.max(1e-9, tb - ta), w = (t - ta) / h, va = val(a), vb = val(b); if (!soft) return va + (vb - va) * w;
      // transition douce : courbe d'Hermite passant par chaque profil, pentes nulles aux extrémités et aux sommets (pas de dépassement)
      const slope = i => { if (i <= 0 || i >= n - 1) return 0; const vp = val(i - 1), vi = val(i), vn = val(i + 1); if ((vi - vp) * (vn - vi) <= 0) return 0; return (vn - vp) / Math.max(1e-9, PR[i + 1].t - PR[i - 1].t); };
      const ma = slope(a) * h, mb = slope(b) * h, w2 = w * w, w3 = w2 * w; return Math.max(0, (2 * w3 - 3 * w2 + 1) * va + (w3 - 2 * w2 + w) * ma + (-2 * w3 + 3 * w2) * vb + (w3 - w2) * mb); }; // plusieurs profils : la section passe de l'un à l'autre le long des rails // plusieurs profils : la section passe de l'un à l'autre le long des rails
    let A = P[0].pts, B = P[1].pts; const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]); if (dd(A[0], B[0]) + dd(A[A.length - 1], B[B.length - 1]) > dd(A[0], B[B.length - 1]) + dd(A[A.length - 1], B[0])) B = B.slice().reverse();
    const ra = rs(A), rb = rs(B), M = Math.max(2, Math.ceil(Math.max(ra.T, rb.T) / (c * 2))), SA = [], SB = []; for (let k = 0; k <= M; k++) { SA.push(at(ra, k / M)); SB.push(at(rb, k / M)); }
    const wid = SA.map((q, k) => dd(q, SB[k])), w0 = Math.max(...wid) || 1, end = (G.end ?? 100) / 100;
    const tri = (P1, P2, P3) => { const [ax, ay] = P1, [bx, by] = P2, [qx, qy] = P3, den = (by - qy) * (ax - qx) + (qx - bx) * (ay - qy); if (Math.abs(den) < 1e-12) return;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, qx) - x0) / c)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, qx) - x0) / c)), j0 = Math.max(0, Math.floor((y1 - Math.max(ay, by, qy)) / c)), j1 = Math.min(ny - 1, Math.ceil((y1 - Math.min(ay, by, qy)) / c));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = X(i), y = Y(j), l1 = ((by - qy) * (x - qx) + (qx - bx) * (y - qy)) / den, l2 = ((qy - ay) * (x - qx) + (ax - qx) * (y - qy)) / den, l3 = 1 - l1 - l2; if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
        const u = l1 * P1[2] + l2 * P2[2] + l3 * P3[2], s2 = l1 * P1[3] + l2 * P2[3] + l3 * P3[3], wl = l1 * P1[4] + l2 * P2[4] + l3 * P3[4], amp = (1 + (end - 1) * s2) * (G.prop ? wl / w0 : 1), v = amp * (PR ? multiAt(u, s2) : sec ? secAt(u) : relProf('round', 1 - Math.abs(2 * u - 1))), q = j * nx + i; if (!(h[q] >= v)) h[q] = v; } };
    for (let k = 0; k < M; k++) { const a0 = [...SA[k], 0, k / M, wid[k]], a1 = [...SA[k + 1], 0, (k + 1) / M, wid[k + 1]], b0 = [...SB[k], 1, k / M, wid[k]], b1 = [...SB[k + 1], 1, (k + 1) / M, wid[k + 1]]; tri(a0, a1, b1); tri(a0, b1, b0); }
  }
  let mx = 0; for (let i = 0; i < N; i++) if (h[i] > mx) mx = h[i]; if (!(mx > 0)) mx = 1;
  const d = new Uint16Array(N); for (let i = 0; i < N; i++) d[i] = h[i] === h[i] ? 1 + Math.round(Math.max(0, h[i] / mx) * 65534) : 0;
  return { g: { nx, ny, d }, box: [x0, y0, x1, y1] };
}
// lissage à plusieurs profils : les deux rails sont les vecteurs que touchent les profils ; chaque profil s'applique là où il croise les rails
function relSweepMulti(G, polys) {
  const dSeg = (p, pl) => { let m = Infinity, tb = 0, acc = 0, best = 0; for (let k = 0; k + 1 < pl.length; k++) { const a = pl[k], b = pl[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)), d = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); if (d < m) { m = d; best = acc + Math.sqrt(L2) * t; } acc += Math.sqrt(L2); } return { d: m, s: best / (acc || 1) }; };
  const len = pl => { let L = 0; for (let k = 1; k < pl.length; k++) L += Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]); return L; };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const pl of polys) for (const q of pl.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const tol = Math.max(2, Math.hypot(x1 - x0, y1 - y0) * 0.03); let best = null;
  for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) { let n = 0; polys.forEach((pl, k) => { if (k === i || k === j) return; const e0 = pl.pts[0], e1 = pl.pts[pl.pts.length - 1], A = polys[i].pts, B = polys[j].pts; if ((dSeg(e0, A).d <= tol && dSeg(e1, B).d <= tol) || (dSeg(e1, A).d <= tol && dSeg(e0, B).d <= tol)) n++; }); const sc = n * 1e6 + len(polys[i].pts) + len(polys[j].pts); if (!best || sc > best.sc) best = { i, j, n, sc }; }
  if (!best || best.n < polys.length - 2) { toast(tr('Chaque profil doit toucher les deux rails par ses extrémités : dessinez-le en travers, d’un rail à l’autre.')); return false; }
  const A = polys[best.i].pts; let B = polys[best.j].pts; const dd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]), revB = dd(A[0], B[0]) + dd(A[A.length - 1], B[B.length - 1]) > dd(A[0], B[B.length - 1]) + dd(A[A.length - 1], B[0]);
  G.polys = [{ pts: A, closed: false }, { pts: B, closed: false }]; G.all = null; G.profs = [];
  polys.forEach((pl, k) => { if (k === best.i || k === best.j) return; let pr = pl.pts; if (dSeg(pr[0], A).d + dSeg(pr[pr.length - 1], B).d > dSeg(pr[pr.length - 1], A).d + dSeg(pr[0], B).d) pr = pr.slice().reverse();
    const tA = dSeg(pr[0], A).s, tB0 = dSeg(pr[pr.length - 1], B).s, tB = revB ? 1 - tB0 : tB0, r = relSecOf(pr); G.profs.push({ t: (tA + tB) / 2, sec: r.sec, h: r.h }); });
  G.profs.sort((a, b) => a.t - b.t); if (G.secFlip) G.profs.forEach(q => q.sec = q.sec.slice().reverse()); G.secH = Math.max(...G.profs.map(q => q.h)); return true;
}
// section d'un profil dessiné en travers : hauteur au-dessus de la corde, normalisée, du rail A (u = 0) au rail B (u = 1)
function relSecOf(pr) {
  const a = pr[0], b = pr[pr.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  const pts = pr.map(q => [((q[0] - a[0]) * ux + (q[1] - a[1]) * uy) / L, (q[0] - a[0]) * -uy + (q[1] - a[1]) * ux]); let sg = 0; for (const q of pts) sg += q[1]; if (sg < 0) for (const q of pts) q[1] = -q[1];
  const N = 128, sec = new Array(N + 1).fill(0); let mx = 0;
  for (let k = 0; k <= N; k++) { const u = k / N; let bst = null; for (let i = 0; i + 1 < pts.length; i++) { const p0 = pts[i], p1 = pts[i + 1]; if ((p0[0] - u) * (p1[0] - u) <= 0 && p1[0] !== p0[0]) { const y = p0[1] + (p1[1] - p0[1]) * (u - p0[0]) / (p1[0] - p0[0]); if (bst === null || y > bst) bst = y; } } sec[k] = Math.max(0, bst ?? 0); if (sec[k] > mx) mx = sec[k]; }
  return { sec: sec.map(v => mx > 0 ? v / mx : 0), h: mx };
}
function relSweepRoles(G, si) {
  const all = G.all, prof = all[si].pts, rails = all.filter((x, k) => k !== si); G.secIdx = si; G.polys = rails.map(x => ({ pts: x.pts, closed: false }));
  const dSeg = (p, pl) => { let m = Infinity; for (let k = 0; k + 1 < pl.length; k++) { const a = pl[k], b = pl[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); m = Math.min(m, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t)); } return m; };
  let pr = prof; const e0 = pr[0], e1 = pr[pr.length - 1]; if (dSeg(e0, rails[0].pts) + dSeg(e1, rails[1].pts) > dSeg(e1, rails[0].pts) + dSeg(e0, rails[1].pts)) pr = pr.slice().reverse();
  const a = pr[0], b = pr[pr.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  const pts = pr.map(q => [((q[0] - a[0]) * ux + (q[1] - a[1]) * uy) / L, (q[0] - a[0]) * -uy + (q[1] - a[1]) * ux]);
  let sg = 0; for (const q of pts) sg += q[1]; if (sg < 0) for (const q of pts) q[1] = -q[1]; // le côté où est la courbe = le haut
  const N = 128, sec = new Array(N + 1).fill(0); let mx = 0;
  for (let k = 0; k <= N; k++) { const u = k / N; let best = null; for (let i = 0; i + 1 < pts.length; i++) { const p0 = pts[i], p1 = pts[i + 1]; if ((p0[0] - u) * (p1[0] - u) <= 0 && p1[0] !== p0[0]) { const y = p0[1] + (p1[1] - p0[1]) * (u - p0[0]) / (p1[0] - p0[0]); if (best === null || y > best) best = y; } } sec[k] = Math.max(0, best ?? 0); if (sec[k] > mx) mx = sec[k]; }
  G.sec = sec.map(v => mx > 0 ? v / mx : 0); if (G.secFlip) G.sec.reverse(); G.secH = mx; G.secW = L;
}
const REL_GEN_V = 2; // version du générateur de formes (2 : transition douce entre profils)
function relRegenOld() { let n = 0; for (const it of S.relief.items) if (it.kind === 'gen' && it.gen && (it.gen.gv || 0) < REL_GEN_V) { try { it.gen.gv = REL_GEN_V; relRegen(it); n++; } catch (e) { } } if (n) { relDirty = true; relSm.clear(); } return n; }
function relRegen(it) { it.gen.gv = REL_GEN_V; relSm.delete(it.id); const R = relGenGrid(it.gen), ow = it.w || 1, k = it.gen.box ? ow / (it.gen.box[2] - it.gen.box[0]) : 1; it.w = (R.box[2] - R.box[0]) * k; it.h = (R.box[3] - R.box[1]) * k; it.gen.box = R.box; relStore(it.id, R.g); }
function relFromDrawing(type) {
  const sh = selShapes().filter(x => x.pts && x.pts.length > 1), lbl = { dome: 'Dôme', extrude: 'Extrusion', sweep: 'Lissage' }[type];
  let polys;
  if (type === 'dome') { polys = sh.filter(x => x.closed && x.pts.length > 2).map(x => ({ pts: x.pts.map(q => [q[0], q[1]]), closed: true })); if (!polys.length) { toast(tr('Sélectionnez une ou plusieurs formes fermées.')); return; } }
  else if (type === 'extrude') { polys = sh.map(x => ({ pts: x.pts.map(q => [q[0], q[1]]), closed: !!x.closed })); if (!polys.length) { toast(tr('Sélectionnez un ou plusieurs vecteurs.')); return; } }
  else { const op = sh.filter(x => !x.closed); if (op.length < 2) { toast(tr('Sélectionnez deux rails et, si vous voulez, un ou plusieurs profils dessinés en travers des rails (vecteurs ouverts).')); return; } polys = op.map(x => ({ pts: x.pts.map(q => [q[0], q[1]]), closed: false })); }
  const G = { type, polys, prof: 'round', W: type === 'extrude' ? 10 : 0, end: 100, prop: false, gv: REL_GEN_V };
  if (type === 'sweep' && polys.length > 3) { if (!relSweepMulti(G, polys)) return; }
  if (type === 'sweep' && polys.length === 3) { // profil : le vecteur qui relie les deux autres, sinon le dernier sélectionné
    G.all = polys; const dd = (p, pl) => Math.min(...pl.map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))), score = k => { const o = polys.filter((x, i) => i !== k), e = polys[k].pts; return Math.min(dd(e[0], o[0].pts) + dd(e[e.length - 1], o[1].pts), dd(e[0], o[1].pts) + dd(e[e.length - 1], o[0].pts)); };
    const sc = [0, 1, 2].map(score), best = sc.indexOf(Math.min(...sc)), tol = Math.max(2, Math.min(...polys.map(x => Math.hypot(x.pts[0][0] - x.pts[x.pts.length - 1][0], x.pts[0][1] - x.pts[x.pts.length - 1][1]))) * 0.25);
    relSweepRoles(G, sc[best] <= tol ? best : 2); }
  try { const R = relGenGrid(G); G.box = R.box; const st = S.stock;
    relAdd({ kind: 'gen', gen: G, name: tr(lbl) + ' ' + (S.relief.items.filter(i => i.gen && i.gen.type === type).length + 1), x: (R.box[0] + R.box[2]) / 2, y: (R.box[1] + R.box[3]) / 2, w: R.box[2] - R.box[0], h: R.box[3] - R.box[1], rot: 0, zH: G.sec || G.profs ? Math.max(0.5, G.secH) : Math.min(type === 'extrude' ? 4 : 8, st.t / 2), z0: 0, invert: false, smooth: 0, mode: 'add', visible: true }, R.g);
    toast(tr('Forme créée : réglez le profil, la largeur et l’épaisseur Z.')); } catch (e) { toast(e.message); }
}
