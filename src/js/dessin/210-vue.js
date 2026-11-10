// ---------- vue ----------
const cv = $('#cv'), ctx = cv.getContext('2d'), cw = $('#cw');
/* identifiant stable d'un objet (pour savoir si un parcours a été recalculé) */
const OBJID = new WeakMap(); let objIdN = 0; const objId = o => { if (!o || typeof o !== 'object') return 0; let v = OBJID.get(o); if (!v) OBJID.set(o, v = ++objIdN); return v; };
let W = 0, H = 0, DPR = 1;
const sx = x => S.view.ox + x * S.view.s, sy = y => S.view.oy - y * S.view.s;
const wx = X => (X - S.view.ox) / S.view.s, wy = Y => (S.view.oy - Y) / S.view.s;
function resize() { const r = cw.getBoundingClientRect(); DPR = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); draw(); }
function fit() {
  const m = 40, st = S.stock; let x0 = 0, y0 = 0, x1 = st.w, y1 = st.h;
  for (const s of S.shapes) if (shown(s)) for (const p of s.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const aw = W - RB, ah = H - RB, s = Math.max(0.05, Math.min((aw - 2 * m) / (x1 - x0), (ah - 2 * m) / (y1 - y0)));
  S.view.s = s; S.view.ox = RB + (aw - (x1 - x0) * s) / 2 - x0 * s; S.view.oy = H - (ah - (y1 - y0) * s) / 2 + y0 * s; draw();
}
const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// thème : sombre par défaut, clair au choix (Paramètres › Affichage) ; la vue 2D se redessine d'elle-même (observateur de data-theme)
function themeSet(v) { const L = v === 'light'; if (L) document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme; try { localStorage.setItem('copo.theme', L ? 'light' : 'dark'); } catch { }
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = L ? '#FAF7F2' : '#262626'; setTimeout(() => { try { if (typeof rvReq === 'function') rvReq(); } catch { } window.dispatchEvent(new Event('resize')); }, 0); }
let drawQueued = false;
function draw() { if (drawQueued) return; drawQueued = true; requestAnimationFrame(() => { drawQueued = false; render(); }); }
function pathOf(pts, closed) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(sx(p[0]), sy(p[1])) : ctx.moveTo(sx(p[0]), sy(p[1]))); if (closed) ctx.closePath(); }
function gridSteps() { if (UNIT.len === 'in') { const st = [1 / 64, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 6, 12, 24, 48, 120].map(x => x * 25.4), g = st.find(v => v * S.view.s >= 9) || st[st.length - 1]; return [g, g < 25.4 ? (25.4 / g <= 16 ? 25.4 : g * 4) : g < 304.8 ? 304.8 : g * 4]; } const steps = [0.5, 1, 5, 10, 50, 100, 500]; const g = steps.find(s => s * S.view.s >= 9) || 500; return [g, g === 0.5 ? 1 : String(g)[0] === '5' ? g * 2 : g * 5]; }
/* ---------- formes d'un gros dessin (30 000 points et plus) : image en mémoire ----------
   Les formes non sélectionnées (et pas en cours d'édition) sont dessinées une fois dans une image, réaffichée telle quelle quand la vue se déplace ou qu'on édite une autre forme.
   Pendant un zoom, elles sont dessinées directement (points à moins d'un demi-pixel du précédent sautés) ; l'image est refaite dès que le zoom s'arrête. */
let SHC = null, shcTimer = 0, shcView = '';
function shpStroke(g, s, C, tpMode, deci) {
  const lk = layerOf(s).locked; g.strokeStyle = layerOf(s).color || (lk ? C.drawMuted : C.draw); if (lk) g.globalAlpha = 0.45; if (tpMode) g.globalAlpha = 0.4; g.lineWidth = 1.4; g.setLineDash(faceOf(s) === 2 ? (s.closed ? [9, 3, 2, 3] : [3, 3]) : []);
  const P = s.pts; g.beginPath();
  if (!deci) P.forEach((p, i) => i ? g.lineTo(sx(p[0]), sy(p[1])) : g.moveTo(sx(p[0]), sy(p[1])));
  else { let lx = sx(P[0][0]), ly = sy(P[0][1]); g.moveTo(lx, ly); for (let i = 1; i < P.length; i++) { const x = sx(P[i][0]), y = sy(P[i][1]); if (i === P.length - 1 || Math.abs(x - lx) + Math.abs(y - ly) >= 0.5) { g.lineTo(x, y); lx = x; ly = y; } } }
  if (s.closed) g.closePath(); g.stroke(); g.setLineDash([]);
  if (!s.closed && S.ui.showEnds !== false && P.length > 1) { g.fillStyle = g.strokeStyle; for (const q of [P[0], P[P.length - 1]]) { g.beginPath(); g.arc(sx(q[0]), sy(q[1]), 1.7, 0, 7); g.fill(); } }
  g.globalAlpha = 1;
}
/* renvoie l'ensemble des formes déjà affichées par l'image (ou null : dessin habituel, forme par forme) */
function shpLayer(C, tpMode) {
  let n = 0; for (const s of S.shapes) n += s.pts ? s.pts.length : 0; if (n < 30000) { SHC = null; return null; }
  const neId = S.ui.tool === 'nodes' && S.ne ? S.ne.sid : null, list = S.shapes.filter(s => s.pts && s.pts.length && shown(s) && !S.sel.has(s.id) && s.id !== neId); if (!list.length) return null;
  const sig = [W, H, DPR, C.draw, C.drawMuted, tpMode ? 1 : 0, S.ui.showEnds !== false ? 1 : 0, list.map(s => { const l = layerOf(s); return objId(s.pts) + (s.closed ? 'c' : 'o') + (l.color || '') + (l.locked ? 'L' : '') + faceOf(s); }).join(',')].join('|'), set = new Set(list);
  const v = S.view, vk = v.s + ',' + v.ox + ',' + v.oy; if (vk !== shcView) { shcView = vk; clearTimeout(shcTimer); shcTimer = setTimeout(() => { shcTimer = 0; draw(); }, 150); }
  const blit = c => { const X = Math.round(sx(c.wx) * DPR) / DPR, Y = Math.round(sy(c.wy) * DPR) / DPR; ctx.drawImage(c.cv, X, Y, c.w / DPR, c.h / DPR); };
  if (SHC && SHC.sig === sig && SHC.s === v.s) { const X = sx(SHC.wx), Y = sy(SHC.wy), exact = Math.abs(X * DPR - Math.round(X * DPR)) < 1e-6 && Math.abs(Y * DPR - Math.round(Y * DPR)) < 1e-6; /* décalage d'une fraction de pixel : image refaite exacte quand la vue s'arrête */
    if ((exact || shcTimer) && (SHC.full || (X <= 0.5 && Y <= 0.5 && X + SHC.w / DPR >= W - 0.5 && Y + SHC.h / DPR >= H - 0.5))) { blit(SHC); return set; } }
  if (SHC && SHC.sig === sig && SHC.s !== v.s && shcTimer) { for (const s of list) shpStroke(ctx, s, C, tpMode, true); return set; } /* zoom en cours */
  /* (re)dessin de l'image : tout le dessin s'il tient dans 2,5 fois la vue, sinon la vue élargie d'un quart de chaque côté */
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity; for (const s of list) { const b = bbOf(s.pts); if (b.x0 < bx0) bx0 = b.x0; if (b.y0 < by0) by0 = b.y0; if (b.x1 > bx1) bx1 = b.x1; if (b.y1 > by1) by1 = b.y1; }
  const m = 4 / v.s, BX0 = sx(bx0 - m), BX1 = sx(bx1 + m), BY0 = sy(by1 + m), BY1 = sy(by0 - m), big = (BX1 - BX0) * (BY1 - BY0) > 2.5 * W * H;
  const RX0 = big ? Math.max(BX0, -W / 4) : BX0, RX1 = big ? Math.min(BX1, W * 1.25) : BX1, RY0 = big ? Math.max(BY0, -H / 4) : BY0, RY1 = big ? Math.min(BY1, H * 1.25) : BY1;
  const X0 = Math.floor(RX0 * DPR) / DPR, Y0 = Math.floor(RY0 * DPR) / DPR, w = Math.ceil((RX1 - X0) * DPR), h = Math.ceil((RY1 - Y0) * DPR);
  if (!(RX1 > RX0 && RY1 > RY0) || w * h > 40e6) { SHC = null; return null; }
  const cv = (SHC && SHC.cv) || document.createElement('canvas'); cv.width = Math.max(1, Math.min(8192, w)); cv.height = Math.max(1, Math.min(8192, h)); const g = cv.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, -X0 * DPR, -Y0 * DPR); g.lineJoin = ctx.lineJoin; g.lineCap = ctx.lineCap;
  for (const s of list) shpStroke(g, s, C, tpMode, false);
  SHC = { sig, s: v.s, cv, w: cv.width, h: cv.height, wx: (X0 - v.ox) / v.s, wy: (v.oy - Y0) / v.s, full: !big }; blit(SHC); return set;
}
function render() {
  if (typeof rvSync === 'function') rvSync();
  const C = { dr: tok('--dr'), draw: tok('--draw'), drawMuted: tok('--draw-muted'), canvas: tok('--canvas'), grid: tok('--grid'), grid2: tok('--grid2'), stock: tok('--stock'), edge: tok('--stock-edge'), ink: tok('--ink'), muted: tok('--muted'), acc: tok('--accent'), pf: tok('--pf'), pk: tok('--pk'), vc: tok('--vc'), th: tok('--th'), rl: tok('--rl'), danger: tok('--danger'), panel: tok('--panel'), line: tok('--line'), guide: tok('--guide'), mono: tok('--f-mono') };
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = C.canvas; ctx.fillRect(0, 0, W, H);
  const [g, G] = gridSteps(), x0 = wx(0), x1 = wx(W), y0 = wy(H), y1 = wy(0);
  const st = S.stock, LT = document.documentElement.dataset.theme === 'light'; for (const [c, b, y] of LT ? [['rgba(60,45,25,.10)', 3, 2], ['rgba(60,45,25,.08)', 14, 6]] : [['rgba(0,0,0,.35)', 14, 3]]) { ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = b; ctx.shadowOffsetY = y; ctx.fillStyle = C.stock; ctx.fillRect(sx(0), sy(st.h), st.w * S.view.s, st.h * S.view.s); ctx.restore(); }
  ctx.lineWidth = 1;
  if (S.ui.showGrid !== false) for (const [step, col] of [[g, 'rgba(0,0,0,.07)'], [G, 'rgba(0,0,0,.15)']]) { ctx.strokeStyle = col; ctx.beginPath(); for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const X = Math.round(sx(x)) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, H); } for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const Y = Math.round(sy(y)) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(W, Y); } ctx.stroke(); }
  ctx.strokeStyle = C.edge; ctx.lineWidth = 1.2; ctx.strokeRect(sx(0), sy(st.h), st.w * S.view.s, st.h * S.view.s);
  const [Ox, Oy] = originOf(st);
  ctx.lineWidth = 2; ctx.strokeStyle = C.pf; ctx.beginPath(); ctx.moveTo(sx(Ox), sy(Oy)); ctx.lineTo(sx(Ox) + 28, sy(Oy)); ctx.stroke();
  ctx.strokeStyle = C.pk; ctx.beginPath(); ctx.moveTo(sx(Ox), sy(Oy)); ctx.lineTo(sx(Ox), sy(Oy) - 28); ctx.stroke();
  ctx.fillStyle = C.draw; ctx.font = '600 11px ' + C.mono; ctx.fillText('X', sx(Ox) + 31, sy(Oy) + 4); ctx.fillText('Y', sx(Ox) - 3, sy(Oy) - 32); ctx.beginPath(); ctx.arc(sx(Ox), sy(Oy), 4, 0, 7); ctx.fillStyle = C.acc; ctx.fill();
  drawRelief(C);
  drawImages(C);
  drawRotGuides(C);
  // repères
  ctx.strokeStyle = C.guide; ctx.lineWidth = 1; ctx.setLineDash([6, 4]); ctx.beginPath();
  for (const gx of S.guides.x) { const X = Math.round(sx(gx)) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, H); } /* bloqués : voir drawGuideLocks */
  for (const gy of S.guides.y) { const Y = Math.round(sy(gy)) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(W, Y); }
  ctx.stroke(); ctx.setLineDash([]);
  // parcours
  const tpMode = !$('#tpWin').hidden;
  if (S.ui.showTP) for (const tp of S.tps) { if (!tp.visible || !tp.moves) continue; TPA = tpMode && tp.id !== S.editTp ? 0.15 : 1; ctx.globalAlpha = TPA; drawTP(tp, { profile: C.pf, pocket: C.pk, vcarve: C.vc, drill: C.dr, thread: C.th, relief: C.rl }[tp.type], tp.id === S.activeTp); tpEntries(tp, tp.id === S.activeTp); ctx.globalAlpha = 1; TPA = 1; }
  if (tpMode && S.tpRels && S.tpRels.size && (S.form || {}).type === 'profile') { ctx.save(); ctx.strokeStyle = C.acc || tok('--accent'); ctx.lineWidth = 2; ctx.setLineDash([6, 4]); for (const id of S.tpRels) { const it = S.relief.items.find(x => x.id === id); for (const lp of relOutLoops(it)) { ctx.beginPath(); lp.forEach((q, i) => i ? ctx.lineTo(sx(q[0]), sy(q[1])) : ctx.moveTo(sx(q[0]), sy(q[1]))); ctx.closePath(); ctx.stroke(); } } ctx.restore(); }
  drawExt();
  drawOverlaps(); // halo sous les traits superposés
  // formes
  /* carrés des nœuds des formes sélectionnées : seulement s'il y en a au plus 20 000 en tout (au-delà ils sont illisibles et ralentissent tout) */
  let selNodes = 0; if (S.ui.tool !== 'nodes') for (const s of S.shapes) if (S.sel.has(s.id) && s.nodes && s.nodes.length < 300) { selNodes += s.nodes.length; if (selNodes > 20000) break; }
  const shpDone = shpLayer(C, tpMode);
  for (const s of S.shapes) {
    if (!shown(s) || (shpDone && shpDone.has(s))) continue; const sel = S.sel.has(s.id), lk = layerOf(s).locked;
    ctx.strokeStyle = sel ? C.acc : (layerOf(s).color || (lk ? C.drawMuted : C.draw)); if (lk && !sel) ctx.globalAlpha = 0.45; if (tpMode && !sel) ctx.globalAlpha = 0.4; ctx.lineWidth = sel ? (tpMode ? 2.8 : 2.2) : 1.4; ctx.setLineDash(faceOf(s) === 2 ? (s.closed ? [9, 3, 2, 3] : [3, 3]) : []);
    pathOf(s.pts, s.closed); ctx.stroke(); ctx.setLineDash([]);
    if (!s.closed && S.ui.showEnds !== false && s.pts.length > 1) { ctx.fillStyle = ctx.strokeStyle; const r = sel ? 2.2 : 1.7; for (const q of [s.pts[0], s.pts[s.pts.length - 1]]) { ctx.beginPath(); ctx.arc(sx(q[0]), sy(q[1]), r, 0, 7); ctx.fill(); } }
    ctx.globalAlpha = 1;
    if (sel && !s.closed && s.pts.length > 1) drawDirArrow(s, C.acc);
    if (sel && S.ui.tool !== 'nodes' && s.nodes.length < 300 && selNodes <= 20000) { ctx.fillStyle = C.acc; ctx.beginPath(); for (const n of s.nodes) ctx.rect(sx(n.x) - 2, sy(n.y) - 2, 4, 4); ctx.fill(); }
  }
  // cadre de sélection
  const ss = selShapes();
  if (ss.length && S.ui.tool !== 'nodes' && !tpMode && !xfOn()) { const b = bbox(ss); ctx.strokeStyle = C.acc; ctx.globalAlpha = 0.6; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeRect(sx(b.x0) - 4, sy(b.y1) - 4, b.w * S.view.s + 8, b.h * S.view.s + 8); ctx.setLineDash([]); ctx.globalAlpha = 1; const pa = anchorPt(b, S.ui.selAnchor), AX = sx(pa[0]), AY = sy(pa[1]); ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(AX, AY - 6); ctx.lineTo(AX + 6, AY); ctx.lineTo(AX, AY + 6); ctx.lineTo(AX - 6, AY); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  drawImgHandles(C); drawRelHandles(C);
  drawXf(C); drawTxGhost(C);
  drawFitPrev(C);
  // cotes
  dimsSync(); for (const d of S.dims) drawDim(d, d.id === S.selDim ? C.acc : C.drawMuted, C.mono);
  // édition des nœuds
  if (S.ui.tool === 'nodes' && S.ne) drawNodeEdit(C);
  if (S.ui.tool === 'nodes') syncNe();
  // aperçus en cours
  const D = drag;
  ctx.strokeStyle = C.acc; ctx.lineWidth = 1.6;
  if (D && (D.mode === 'band' || D.mode === 'nband')) { ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeRect(Math.min(D.sx0, D.sx1) + 0.5, Math.min(D.sy0, D.sy1) + 0.5, Math.abs(D.sx1 - D.sx0), Math.abs(D.sy1 - D.sy0)); ctx.setLineDash([]); }
  if (D && ['rect', 'ellipse', 'circle', 'polygon'].includes(D.mode)) { const tmp = previewShape(D); if (tmp) { pathOf(tmp.pts, true); ctx.stroke(); } }
  if (pen.length) { const tmp = refresh({ nodes: penTan(pen.map(cloneNode).concat(hover && !(D && D.mode === 'pen') ? [NODE(hover[0], hover[1])] : [])), closed: false }); pathOf(tmp.pts, false); ctx.stroke(); ctx.fillStyle = C.acc; for (const n of pen) ctx.fillRect(sx(n.x) - 3, sy(n.y) - 3, 6, 6); }
  if (S.ui.tool === 'text' && textPick) { const ts = shapeById(textPick); if (ts) { ctx.save(); ctx.strokeStyle = C.acc; ctx.lineWidth = 3; pathOf(ts.pts, ts.closed); ctx.stroke(); ctx.restore(); } } // courbe du bas choisie
  if (S.ui.tool === 'poly' && ciPrev) { ctx.save(); ctx.strokeStyle = C.acc; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3; if (pen.length) { const l = pen[pen.length - 1]; ctx.beginPath(); ctx.moveTo(sx(l.x), sy(l.y)); ctx.lineTo(sx(ciPrev[0]), sy(ciPrev[1])); ctx.stroke(); } ctx.setLineDash([]); ctx.beginPath(); ctx.arc(sx(ciPrev[0]), sy(ciPrev[1]), 4.5, 0, 7); ctx.stroke(); ctx.restore(); } // aperçu du point saisi au clavier
  if (arcSt.length && hover) { const a = arcSt[0]; if (arcSt.length === 1) { pathOf([a, hover], false); ctx.stroke(); } else { const tmp = refresh({ nodes: arcByMode(a, arcSt[1], hover).nodes, closed: false }); pathOf(tmp.pts, false); ctx.stroke(); } ctx.fillStyle = C.acc; for (const p of arcSt) ctx.fillRect(sx(p[0]) - 3, sy(p[1]) - 3, 6, 6); }
  if (dimSt.length && hover) { if (dimSt.length === 1) { pathOf([dimSt[0], hover], false); ctx.stroke(); } else drawDim(dimPreview(hover), C.acc, C.mono); }
  if (S.measure) { const m = S.measure; ctx.strokeStyle = C.danger; ctx.setLineDash([5, 3]); pathOf([m.a, m.b], false); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C.danger; for (const p of [m.a, m.b]) { ctx.beginPath(); ctx.arc(sx(p[0]), sy(p[1]), 3, 0, 7); ctx.fill(); } }
  if (hoverCorner) { ctx.strokeStyle = C.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(hoverCorner.p[0]), sy(hoverCorner.p[1]), 8, 0, 7); ctx.stroke(); }
  if (hoverEdge) { ctx.strokeStyle = C.danger; ctx.lineWidth = 3; ctx.globalAlpha = 0.6; pathOf(hoverEdge, false); ctx.stroke(); ctx.globalAlpha = 1; }
  drawSnapMark(C);
  if (S.ui.tool === 'tabedit') { const tp = tabTpCur(); if (tp && tp.loops) { ctx.save(); ctx.strokeStyle = C.acc; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); for (const l of tp.loops) { pathOf(l, true); ctx.stroke(); } ctx.setLineDash([]); for (const t of tp.tabs || []) { ctx.beginPath(); ctx.arc(sx(t.x), sy(t.y), 7, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); } ctx.restore(); } }
  drawRulers(C);
  placeCtx(); placeRelBar();
}
function drawDirArrow(s, col) {
  const P = s.pts; let L = 0, k = 1; const want = Math.min(28 / S.view.s, cumLen(P)[P.length - 1] * 0.4);
  while (k < P.length - 1 && L + hyp(P[k - 1], P[k]) < want) { L += hyp(P[k - 1], P[k]); k++; }
  const a = P[k - 1], b = P[k], sl = hyp(a, b) || 1, t = Math.min(1, (want - L) / sl), m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const X = sx(m[0]), Y = sy(m[1]), ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  ctx.save(); ctx.fillStyle = col; ctx.translate(X, Y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx(P[0][0]), sy(P[0][1]), 3.5, 0, 7); ctx.fill(); ctx.restore();
}
const rulTxt = v => UNIT.len === 'in' ? uNum(v, 'len', 3) : String(Math.round(v * 10) / 10);
function drawRulers(C) {
  const st = S.stock, [ox, oy] = originOf(st), [g, G] = gridSteps();
  const lab = G * S.view.s < 45 ? G * 2 : G;
  ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, RB); ctx.fillRect(0, 0, RB, H);
  ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(0, RB + 0.5); ctx.lineTo(W, RB + 0.5); ctx.moveTo(RB + 0.5, 0); ctx.lineTo(RB + 0.5, H); ctx.stroke();
  ctx.strokeStyle = C.muted; ctx.fillStyle = C.muted; ctx.font = '9px ' + C.mono; ctx.lineWidth = 1; ctx.beginPath();
  for (let v = Math.ceil((wx(RB) - ox) / g) * g; v <= wx(W) - ox; v += g) { const X = Math.round(sx(v + ox)) + 0.5, maj = Math.abs(v / G - Math.round(v / G)) < 1e-6; ctx.moveTo(X, RB); ctx.lineTo(X, RB - (maj ? 8 : 4)); if (Math.abs(v / lab - Math.round(v / lab)) < 1e-6) ctx.fillText(rulTxt(v), X + 2, 9); }
  for (let v = Math.ceil((wy(H) - oy) / g) * g; v <= wy(RB) - oy; v += g) { const Y = Math.round(sy(v + oy)) + 0.5, maj = Math.abs(v / G - Math.round(v / G)) < 1e-6; ctx.moveTo(RB, Y); ctx.lineTo(RB - (maj ? 8 : 4), Y); if (Math.abs(v / lab - Math.round(v / lab)) < 1e-6) { ctx.save(); ctx.translate(9, Y - 2); ctx.rotate(-Math.PI / 2); ctx.fillText(rulTxt(v), 0, 0); ctx.restore(); } }
  ctx.stroke(); ctx.fillStyle = C.panel; ctx.fillRect(0, 0, RB, RB);
}
let TPA = 1;
/* nouvelle passe de largeur de coupe quand la largeur change de plus de 0,05 mm (ou 4 %) : le découpage, donc l'intensité des chevauchements, est le même à tous les zooms */
const tpCutSplit = (wm, cw) => Math.abs(wm - cw) > Math.max(0.05, 0.04 * cw);
function drawTPCut(c, mv, col, alpha, wOf) {
  c.save(); c.globalAlpha = alpha; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  let pen_ = false, cw_ = -1; c.beginPath();
  for (let i = 1; i < mv.length; i++) {
    const a = mv[i - 1], b = mv[i];
    if (b.g === 1 && (b.z < -1e-6 || a.z < -1e-6)) { const wm = wOf(Math.min(a.z, b.z)); if (!pen_ || tpCutSplit(wm, cw_)) { c.stroke(); c.beginPath(); c.lineWidth = Math.max(1, wm * S.view.s); cw_ = wm; c.moveTo(sx(a.x), sy(a.y)); pen_ = true; } c.lineTo(sx(b.x), sy(b.y)); }
    else pen_ = false;
  }
  c.stroke(); c.restore();
}
/* gros parcours (plus de 2000 mouvements) : dessiné une fois par niveau de zoom dans deux images à part (largeur de coupe, trait + rapides), recollées tant que le parcours et le zoom ne changent pas :
   déplacer la vue, éditer des nœuds ou survoler ne redessinent plus le parcours. Pendant un zoom, l'ancienne image est mise à l'échelle ; à la pause, l'image nette est refaite par petites tranches entre deux images (l'interface ne bloque pas) */
const TPCUT = new Map(), TPCUTBOX = new WeakMap(), TPJOB = new Map(), TPOV = new Map(); /* TPOV : vue d'ensemble de la largeur de coupe (parcours entier, résolution réduite) */ let tpcTimer = 0, tpjRaf = 0;
function tpcSoon() { clearTimeout(tpcTimer); tpcTimer = setTimeout(() => { tpcTimer = 0; for (const id of TPCUT.keys()) if (!S.tps.some(t => t.id === id)) TPCUT.delete(id); for (const [id, j] of TPJOB) if (!S.tps.some(t => t.id === String(id).replace(/^ov:/, ''))) TPJOB.delete(id); for (const id of TPOV.keys()) if (!S.tps.some(t => t.id === id)) TPOV.delete(id); tpJobWant = true; draw(); }, 150); }
let tpJobWant = false, tpLastV = '';
function tpMovBox(mv) { let b = TPCUTBOX.get(mv); if (!b) { b = [Infinity, Infinity, -Infinity, -Infinity]; for (const m of mv) { if (typeof m.x !== 'number') continue; if (m.x < b[0]) b[0] = m.x; if (m.y < b[1]) b[1] = m.y; if (m.x > b[2]) b[2] = m.x; if (m.y > b[3]) b[3] = m.y; } TPCUTBOX.set(mv, b); } return b; }
/* traits du parcours dessinés directement pendant un zoom : lignes continues, points à moins d'un demi-pixel du précédent sautés (même aspect, beaucoup moins de segments) */
function tpLinesLive(mv, col, active) {
  const poly = (g, dash) => { ctx.beginPath(); let lx = NaN, ly = NaN, open = false;
    for (let i = 1; i < mv.length; i++) { const a = mv[i - 1], b = mv[i]; const on = g === 1 ? b.g === 1 : (b.g === 0 && (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) > 1e-6); if (!on) { if (open && (lx !== ex || ly !== ey)) ctx.lineTo(ex, ey); open = false; continue; }
      const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y);
      if (!open || Math.abs(ax - ex) > 1e-6 || Math.abs(ay - ey) > 1e-6) { if (open && (lx !== ex || ly !== ey)) ctx.lineTo(ex, ey); ctx.moveTo(ax, ay); lx = ax; ly = ay; open = true; }
      ex = bx; ey = by; if (Math.abs(bx - lx) + Math.abs(by - ly) >= 0.5) { ctx.lineTo(bx, by); lx = bx; ly = by; } }
    if (open && (lx !== ex || ly !== ey)) ctx.lineTo(ex, ey); ctx.stroke(); };
  let ex = NaN, ey = NaN; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = active ? 1.4 : 1; ctx.globalAlpha = TPA * (0.9); poly(1); ctx.globalAlpha = TPA * (0.45); ctx.setLineDash([3, 4]); poly(0); ctx.restore();
}
function tpTabs(tp, tool, col) { if (!tp.tabs) return; const L = Math.max(1.5, (+tp.p.tabL || 0)) * S.view.s, Wd = Math.max(3, tool.dia * S.view.s); ctx.save(); for (const t of tp.tabs) { ctx.save(); ctx.translate(sx(t.x), sy(t.y)); ctx.rotate(-t.a); ctx.fillStyle = col; ctx.globalAlpha = TPA * (0.85); ctx.fillRect(-L / 2, -Wd / 2, L, Wd); ctx.globalAlpha = TPA * (1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.strokeRect(-L / 2, -Wd / 2, L, Wd); ctx.restore(); } ctx.restore(); }
/* préparation d'une image nette pour la vue actuelle : zone du parcours entière si elle tient dans 2,5 fois la vue, sinon la vue élargie d'un quart de chaque côté */
function tpJobNew(tp, mv, tool, col, active, key) {
  const s = S.view.s, r = Math.max(+tool.dia || 0, 2) + 4 / s, bx = tpMovBox(mv), BX0 = sx(bx[0] - r), BX1 = sx(bx[2] + r), BY0 = sy(bx[3] + r), BY1 = sy(bx[1] - r), big = (BX1 - BX0) * (BY1 - BY0) > 2.5 * W * H;
  const RX0 = big ? Math.max(BX0, -W / 4) : BX0, RX1 = big ? Math.min(BX1, W * 1.25) : BX1, RY0 = big ? Math.max(BY0, -H / 4) : BY0, RY1 = big ? Math.min(BY1, H * 1.25) : BY1;
  const X0 = Math.floor(RX0 * DPR) / DPR, Y0 = Math.floor(RY0 * DPR) / DPR, w = Math.max(1, Math.min(8192, Math.ceil((RX1 - X0) * DPR))), h = Math.max(1, Math.min(8192, Math.ceil((RY1 - Y0) * DPR)));
  if (RX1 <= RX0 || RY1 <= RY0 || w * h > 40e6) return null;
  const mk = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, -X0 * DPR, -Y0 * DPR); return [cv, g]; };
  const cg = tool.type === 'v' ? coneGeom(tool) : null, wOf = z => cg ? Math.min(tool.dia, 2 * cg.r(Math.max(0, -z))) : tool.dia;
  const [cut, gc] = S.ui.showCut ? mk() : [null, null], [ln, gl] = mk();
  /* passes de la largeur de coupe, découpées exactement comme le dessin direct (nouvelle passe à chaque levée ou changement de largeur) */
  const rs = [], re = [], rw = []; if (S.ui.showCut) { let pen = false, cw = -1; for (let i = 1; i < mv.length; i++) { const a = mv[i - 1], b = mv[i]; if (b.g === 1 && (b.z < -1e-6 || a.z < -1e-6)) { const wm = wOf(Math.min(a.z, b.z)); if (!pen || tpCutSplit(wm, cw)) { rs.push(i); re.push(i); rw.push(Math.max(1, wm * s)); cw = wm; pen = true; } else re[re.length - 1] = i; } else pen = false; } }
  if (gc) { gc.globalAlpha = TPA * (active ? 0.3 : 0.17); gc.strokeStyle = col; gc.lineCap = 'round'; gc.lineJoin = 'round'; }
  gl.strokeStyle = col; gl.lineWidth = active ? 1.4 : 1;
  /* vue (pour placer l'image) figée au début : les tranches suivantes dessinent avec les mêmes coordonnées */
  return { tp, mv, key, tool, active, s, ox: S.view.ox, oy: S.view.oy, w, h, X0, Y0, cut, gc, ln, gl, wOf, col, rs, re, rw, r: 0, ri: 0, sc: null, ph: gc ? 0 : 1, i: 1, full: !big, wx: (X0 - S.view.ox) / s, wy: (S.view.oy - Y0) / s };
}
/* une tranche : dessine jusqu'à environ 10 ms ; le dessin est rendu effectif (getImageData) tous les 25 traits pour mesurer le vrai temps. all = tout d'un coup */
function tpJobStep(j, all) {
  const v = S.view, sv = [v.s, v.ox, v.oy]; v.s = j.s; v.ox = j.ox; v.oy = j.oy; const mv = j.mv, t0 = performance.now(), late = q => { if (all) return false; q.getImageData(0, 0, 1, 1); return performance.now() - t0 > 10; };
  try {
    if (j.ph === 0) { const g = j.gc, { rs, re, rw } = j; let r = j.r, k = 0;
      while (r < rs.length) { const n = re[r] - rs[r] + 1;
        if (n <= 1200) { g.beginPath(); g.lineWidth = rw[r]; let i = rs[r]; g.moveTo(sx(mv[i - 1].x), sy(mv[i - 1].y)); for (; i <= re[r]; i++) g.lineTo(sx(mv[i].x), sy(mv[i].y)); g.stroke(); r++; if (++k % 25 === 0 && late(g)) break; continue; }
        /* passe très longue : morceaux opaques sur une image auxiliaire, recollée ensuite avec la transparence (même rendu qu'un seul trait) */
        if (!j.sc) { const cv = document.createElement('canvas'); cv.width = j.w; cv.height = j.h; const q = cv.getContext('2d'); q.setTransform(DPR, 0, 0, DPR, -j.X0 * DPR, -j.Y0 * DPR); q.strokeStyle = j.col; q.lineCap = 'round'; q.lineJoin = 'round'; j.sc = q; }
        const q = j.sc; if (!j.ri) j.ri = rs[r]; let stop = false;
        while (j.ri <= re[r]) { const lim = Math.min(re[r], j.ri + 1199); q.beginPath(); q.lineWidth = rw[r]; q.moveTo(sx(mv[j.ri - 1].x), sy(mv[j.ri - 1].y)); for (let i = j.ri; i <= lim; i++) q.lineTo(sx(mv[i].x), sy(mv[i].y)); q.stroke(); j.ri = lim + 1; if (late(q)) { stop = true; break; } }
        if (j.ri > re[r]) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(q.canvas, 0, 0); g.restore(); q.save(); q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, j.w, j.h); q.restore(); j.ri = 0; r++; }
        if (stop || late(g)) break; }
      j.r = r; if (r >= rs.length) { j.ph = j.ov ? 3 : 1; j.i = 1; j.sc = null; } /* vue d'ensemble : la largeur de coupe seulement */
    } else if (j.ph === 1) { const g = j.gl; let i = j.i;
      while (i < mv.length) { const lim = all ? mv.length : Math.min(mv.length, i + 1500); g.beginPath(); for (; i < lim; i++) { const a = mv[i - 1], b = mv[i]; if (b.g === 1) { g.moveTo(sx(a.x), sy(a.y)); g.lineTo(sx(b.x), sy(b.y)); } } g.stroke(); if (late(g)) break; }
      j.i = i; if (i >= mv.length) j.ph = 2;
    } else if (!j.gl) j.ph = 3; else { const g = j.gl; g.save(); g.globalAlpha = 0.5; g.setLineDash([3, 4]); g.lineWidth = 1; g.beginPath(); for (let i = 1; i < mv.length; i++) { const a = mv[i - 1], b = mv[i]; if (b.g === 0 && (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) > 1e-6) { g.moveTo(sx(a.x), sy(a.y)); g.lineTo(sx(b.x), sy(b.y)); } } g.stroke(); g.restore(); j.ph = 3; }
  } finally { v.s = sv[0]; v.ox = sv[1]; v.oy = sv[2]; }
  return j.ph === 3;
}
/* vue d'ensemble d'un parcours : tout le parcours tient dans 1,5 fois la vue (préparée en tâche de fond après une image partielle) */
function tpOvNew(j0) {
  if (!S.ui.showCut) return null; const v = S.view, sv = [v.s, v.ox, v.oy], r = Math.max(+j0.tool.dia || 0, 2), bx = tpMovBox(j0.mv), bw = bx[2] - bx[0] + 2 * r, bh = bx[3] - bx[1] + 2 * r;
  const so = Math.min(v.s, 1.5 * W / bw, 1.5 * H / bh); if (!(so > 0)) return null; v.s = so; v.ox = -(bx[0] - r) * so + 8; v.oy = (bx[3] + r) * so + 8;
  try { const j = tpJobNew(j0.tp, j0.mv, j0.tool, j0.col, j0.active, j0.key); if (j) { j.ov = true; j.ln = null; j.gl = null; } return j; } finally { v.s = sv[0]; v.ox = sv[1]; v.oy = sv[2]; }
}
function tpJobsRun() { if (tpjRaf) return; tpjRaf = requestAnimationFrame(() => { tpjRaf = 0; const t0 = performance.now(); let more = false;
  for (const [id, j] of TPJOB) { while (performance.now() - t0 < 10) { if (tpJobStep(j, false)) { TPJOB.delete(id); const c = { mv: j.mv, key: j.key, s: j.s, cut: j.cut, ln: j.ln, w: j.w, h: j.h, wx: j.wx, wy: j.wy, full: j.full };
        if (j.ov) TPOV.set(j.tp.id, c); else { TPCUT.set(id, c); if (c.full) TPOV.set(id, c); else tpOvWant(j); } draw(); break; } } if (TPJOB.has(id)) more = true; }
  if (more) tpJobsRun(); }); }
function tpOvWant(j) { const o = TPOV.get(j.tp.id), id = 'ov:' + j.tp.id; if ((o && o.mv === j.mv && o.key === j.key) || TPJOB.has(id)) return; const oj = tpOvNew(j); if (oj) { TPJOB.set(id, oj); tpJobsRun(); } }
function drawTP(tp, col, active) {
  const tool = S.tools.find(t => t.id === tp.toolId), mv = tp.dmoves || tp.moves;
  if (!tool || !mv || mv.length <= 2000 || tp.holes || !faceShown(tp.face === 2 ? 2 : 1)) return drawTPDirect(tp, col, active);
  const s = S.view.s, key = [col, active, TPA, S.ui.showCut, tool.dia, tool.type, tool.angle, tool.tipR, tool.flat, DPR, W, H].join('|'); let c = TPCUT.get(tp.id);
  const blit = (c, k, live) => { const X = sx(c.wx), Y = sy(c.wy), w = c.w / DPR * k, h = c.h / DPR * k, px = k === 1 ? Math.round(X * DPR) / DPR : X, py = k === 1 ? Math.round(Y * DPR) / DPR : Y;
    if (live) tpOvDraw(c, X, Y, w, h); /* hors de l'image détaillée : vue d'ensemble */
    if (c.cut) ctx.drawImage(c.cut, px, py, w, h); tpTabs(tp, tool, col); if (live) { tpLinesLive(mv, col, active); return; } /* zoom en cours ou image incomplète : traits à leur vraie épaisseur */ ctx.save(); ctx.globalAlpha = TPA * 0.9; ctx.drawImage(c.ln, px, py, w, h); ctx.restore(); };
  const tpOvDraw = (c, X, Y, w, h) => { const o = TPOV.get(tp.id); if (!o || o === c || o.mv !== mv || o.key !== key || !o.cut) return; const k2 = s / o.s; ctx.save(); ctx.beginPath(); ctx.rect(-2, -2, W + 4, H + 4); ctx.rect(X, Y, w, h); ctx.clip('evenodd'); ctx.drawImage(o.cut, sx(o.wx), sy(o.wy), o.w / DPR * k2, o.h / DPR * k2); ctx.restore(); };
  const ok = c && c.mv === mv && c.key === key, k = ok ? s / c.s : 0, covers = ok && k === 1 && (c.full || (() => { const X = sx(c.wx), Y = sy(c.wy); return X <= 0.5 && Y <= 0.5 && X + c.w / DPR >= W - 0.5 && Y + c.h / DPR >= H - 0.5; })());
  if (covers) { TPJOB.delete(tp.id); blit(c, 1, false); return; }
  if (!ok || k <= 0.2 || k >= 5) { /* rien d'utilisable (premier affichage, parcours recalculé) : image faite tout de suite */ TPJOB.delete(tp.id); const j = tpJobNew(tp, mv, tool, col, active, key); if (!j) return drawTPDirect(tp, col, active); tpJobStep(j, true); tpJobStep(j, true); tpJobStep(j, true); c = { mv, key, s, cut: j.cut, ln: j.ln, w: j.w, h: j.h, wx: j.wx, wy: j.wy, full: j.full }; TPCUT.set(tp.id, c); if (c.full) TPOV.set(tp.id, c); else tpOvWant(j); blit(c, 1, !c.full && !(() => { const X = sx(c.wx), Y = sy(c.wy); return X <= 0.5 && Y <= 0.5 && X + c.w / DPR >= W - 0.5 && Y + c.h / DPR >= H - 0.5; })()); return; }
  /* zoom en cours ou vue sortie de l'image : ancienne image (mise à l'échelle) ; image nette préparée en tâche de fond quand la vue est stable */
  blit(c, k, true); let j = TPJOB.get(tp.id); const vk = s + ',' + S.view.ox + ',' + S.view.oy; if (vk !== tpLastV) { tpLastV = vk; tpJobWant = false; tpcSoon(); } /* la vue bouge : on attend qu'elle soit stable (un simple survol ne repousse pas l'attente) */
  if (j && (j.mv !== mv || j.key !== key || j.s !== s || j.ox !== S.view.ox || j.oy !== S.view.oy)) { TPJOB.delete(tp.id); j = null; }
  if (!j && tpJobWant) { j = tpJobNew(tp, mv, tool, col, active, key); if (j) { TPJOB.set(tp.id, j); tpJobsRun(); } }
  if (!j && !tpcTimer && !tpJobWant) tpcSoon();
}
// entrées en rampe ou en hélice : tracées par-dessus le parcours, dans la couleur d'avertissement
function tpNarrow(tp) { if (!tp.narrow || !faceShown(tp.face === 2 ? 2 : 1)) return; ctx.save(); ctx.globalAlpha = TPA * 0.55; ctx.fillStyle = tok('--danger') || '#c9402f'; ctx.beginPath(); for (const l of tp.narrow) { l.forEach((q, i) => i ? ctx.lineTo(sx(q[0]), sy(q[1])) : ctx.moveTo(sx(q[0]), sy(q[1]))); ctx.closePath(); } ctx.fill('evenodd'); ctx.restore(); }
function tpEntries(tp, active) { tpNarrow(tp); const mv = tp.dmoves || tp.moves; if (!mv || !faceShown(tp.face === 2 ? 2 : 1) || !mv.some(m => m.e)) return; ctx.save(); ctx.globalAlpha = TPA; ctx.strokeStyle = tok('--warn') || '#e0a020'; ctx.lineWidth = active ? 2.6 : 2; ctx.lineCap = 'round'; ctx.setLineDash([]); ctx.beginPath(); for (let i = 1; i < mv.length; i++) { const b = mv[i]; if (b.e) { const a = mv[i - 1]; ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); } } ctx.stroke(); ctx.restore(); }
function drawTPDirect(tp, col, active) {
  const tool = S.tools.find(t => t.id === tp.toolId); if (!tool) return;
  const th = tool.type === 'v' ? Math.tan((+tool.angle || 90) * Math.PI / 360) : 0;
  const cg = tool.type === 'v' ? coneGeom(tool) : null, wOf = z => cg ? Math.min(tool.dia, 2 * cg.r(Math.max(0, -z))) : tool.dia;
  const mv = tp.dmoves || tp.moves; if (!mv.length) return; if (!faceShown(tp.face === 2 ? 2 : 1)) return;
  if (tp.holes) { const r = Math.max(2, tool.dia / 2 * S.view.s); ctx.save(); for (const h of tp.holes) { const X = sx(h[0]), Y = sy(h[1]); if (S.ui.showCut) { ctx.globalAlpha = TPA * (active ? 0.45 : 0.3); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill(); } ctx.globalAlpha = TPA * (1); ctx.strokeStyle = col; ctx.lineWidth = active ? 1.6 : 1.1; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.moveTo(X - r - 3, Y); ctx.lineTo(X + r + 3, Y); ctx.moveTo(X, Y - r - 3); ctx.lineTo(X, Y + r + 3); ctx.stroke(); } ctx.globalAlpha = TPA * (0.45); ctx.setLineDash([3, 4]); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 1; i < mv.length; i++) { const a = mv[i - 1], b = mv[i]; if (b.g === 0 && (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) > 1e-6) { ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); } } ctx.stroke(); ctx.restore(); return; }
  if (S.ui.showCut) drawTPCut(ctx, mv, col, TPA * (active ? 0.3 : 0.17), wOf);
  if (tp.tabs) { const L = Math.max(1.5, (+tp.p.tabL || 0)) * S.view.s, Wd = Math.max(3, tool.dia * S.view.s); ctx.save(); for (const t of tp.tabs) { ctx.save(); ctx.translate(sx(t.x), sy(t.y)); ctx.rotate(-t.a); ctx.fillStyle = col; ctx.globalAlpha = TPA * (0.85); ctx.fillRect(-L / 2, -Wd / 2, L, Wd); ctx.globalAlpha = TPA * (1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.strokeRect(-L / 2, -Wd / 2, L, Wd); ctx.restore(); } ctx.restore(); }
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = active ? 1.4 : 1; ctx.globalAlpha = TPA * (0.9); ctx.beginPath();
  for (let i = 1; i < mv.length; i++) { const a = mv[i - 1], b = mv[i]; if (b.g === 1) { ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); } }
  ctx.stroke(); ctx.globalAlpha = TPA * (0.45); ctx.setLineDash([3, 4]); ctx.beginPath();
  for (let i = 1; i < mv.length; i++) { const a = mv[i - 1], b = mv[i]; if (b.g === 0 && (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) > 1e-6) { ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); } }
  ctx.stroke(); ctx.restore();
}
// cotes
// cotes associatives : une extrémité accrochée à un nœud, au milieu d'un segment ou au centre d'un arc suit l'objet
let dimRefs = [];
function snapRefOf(m) { if (!m || !m.ref || !m.ref.ids) return null; const r = m.ref; if (m.k === 'end' && r.ni !== undefined) return { sid: r.ids[0], k: 'end', i: r.ni }; if ((m.k === 'mid' || m.k === 'cen') && r.seg !== undefined) return { sid: r.ids[0], k: m.k, g: r.seg }; return null; }
function refPt(r) {
  const s = r && shapeById(r.sid); if (!s) return null;
  if (r.k === 'end') { const n = s.nodes[r.i]; return n ? [n.x, n.y] : null; }
  if (r.g >= nseg(s)) return null; const g = segOf(s, r.g);
  if (r.k === 'mid') return bez(g, 0.5);
  if (r.k === 'cen' && !g.line) { const c = circle3(g.p0, bez(g, 0.5), g.p3); return c ? c.C : null; }
  return null;
}
function dimsSync() { for (const d of S.dims) { if (d.ra) { const q = refPt(d.ra); if (q) d.a = q; } if (d.rb) { const q = refPt(d.rb); if (q) d.b = q; } } }
function dimGeom(d) { const v = nrm(sub(d.b, d.a)), nv = [-v[1], v[0]]; return { v, nv, A: [d.a[0] + nv[0] * d.off, d.a[1] + nv[1] * d.off], B: [d.b[0] + nv[0] * d.off, d.b[1] + nv[1] * d.off] }; }
function drawDim(d, col, mono) {
  const { v, nv, A, B } = dimGeom(d), ext = Math.sign(d.off || 1) * 2 / S.view.s * 3;
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx(d.a[0]), sy(d.a[1])); ctx.lineTo(sx(A[0] + nv[0] * ext), sy(A[1] + nv[1] * ext)); ctx.moveTo(sx(d.b[0]), sy(d.b[1])); ctx.lineTo(sx(B[0] + nv[0] * ext), sy(B[1] + nv[1] * ext)); ctx.moveTo(sx(A[0]), sy(A[1])); ctx.lineTo(sx(B[0]), sy(B[1])); ctx.stroke();
  const arrow = (P, dir) => { const X = sx(P[0]), Y = sy(P[1]), ang = Math.atan2(-dir[1], dir[0]); ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - 9 * Math.cos(ang - 0.3), Y - 9 * Math.sin(ang - 0.3)); ctx.lineTo(X - 9 * Math.cos(ang + 0.3), Y - 9 * Math.sin(ang + 0.3)); ctx.closePath(); ctx.fill(); };
  arrow(A, [-v[0], -v[1]]); arrow(B, v);
  for (const [P, r] of [[d.a, d.ra], [d.b, d.rb]]) if (r) { ctx.beginPath(); ctx.arc(sx(P[0]), sy(P[1]), 2.6, 0, 7); ctx.fill(); }
  let ang = Math.atan2(-(B[1] - A[1]), B[0] - A[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
  ctx.translate((sx(A[0]) + sx(B[0])) / 2, (sy(A[1]) + sy(B[1])) / 2); ctx.rotate(ang); ctx.font = '500 12px ' + mono; ctx.textAlign = 'center';
  const t = UNIT.len === 'in' ? uTxt(hyp(d.a, d.b)) : fr(hyp(d.a, d.b)) + ' mm', w = ctx.measureText(t).width; ctx.fillStyle = tok('--stock'); ctx.fillRect(-w / 2 - 3, -17, w + 6, 14); ctx.fillStyle = col; ctx.fillText(t, 0, -6);
  ctx.restore();
}
function dimPreview(p) { const a = dimSt[0], b = dimSt[1], v = nrm(sub(b, a)), nv = [-v[1], v[0]]; return { a, b, off: (p[0] - a[0]) * nv[0] + (p[1] - a[1]) * nv[1] }; }
// édition des nœuds
function visibleHandles(s) {
  const n = s.nodes.length, ni = S.ne.ni, all = n <= 80, out = [];
  s.nodes.forEach((nd, i) => {
    const near = neSel().some(k => i === k || i === (k + 1) % n || i === (k - 1 + n) % n);
    if (!all && !near) return;
    if (nd.i) out.push({ i, w: 'i', p: [nd.x + nd.i[0], nd.y + nd.i[1]] });
    if (nd.o) out.push({ i, w: 'o', p: [nd.x + nd.o[0], nd.y + nd.o[1]] });
  });
  return out;
}
function drawNodeEdit(C) {
  const s = shapeById(S.ne.sid); if (!s) { S.ne = null; return; }
  if (S.ne.seg !== null) { const k = S.ne.seg, pts = s.pts.filter((_, j) => s.map[j] >= k - 1e-9 && s.map[j] <= k + 1 + 1e-9); const g = segOf(s, k); pts.push(g.p3); ctx.strokeStyle = C.danger; ctx.lineWidth = 3; pathOf(pts, false); ctx.stroke(); }
  ctx.lineWidth = 1; ctx.strokeStyle = C.drawMuted;
  for (const h of visibleHandles(s)) { const nd = s.nodes[h.i], on = S.ne.h && S.ne.h.i === h.i && S.ne.h.w === h.w; ctx.beginPath(); ctx.moveTo(sx(nd.x), sy(nd.y)); ctx.lineTo(sx(h.p[0]), sy(h.p[1])); ctx.stroke(); ctx.beginPath(); ctx.arc(sx(h.p[0]), sy(h.p[1]), on ? 5 : 3.5, 0, 7); ctx.fillStyle = on ? '#ff9f1c' : '#ffffff'; ctx.fill(); ctx.stroke(); }
  const neS = new Set(neSel());
  s.nodes.forEach((nd, i) => { const X = sx(nd.x), Y = sy(nd.y), selN = neS.has(i); ctx.fillStyle = selN ? C.acc : '#ffffff'; ctx.strokeStyle = C.acc; ctx.lineWidth = 1.5; ctx.beginPath(); if (nd.sm) { ctx.arc(X, Y, 4.5, 0, 7); if (nd.sym) { ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.fillStyle = selN ? '#ffffff' : C.acc; ctx.arc(X, Y, 1.8, 0, 7); } } else if (nd.i || nd.o) { ctx.moveTo(X, Y - 5.5); ctx.lineTo(X + 5.5, Y); ctx.lineTo(X, Y + 5.5); ctx.lineTo(X - 5.5, Y); ctx.closePath(); } else ctx.rect(X - 4, Y - 4, 8, 8); ctx.fill(); ctx.stroke(); });
}

// ===== réglages chiffrés des outils de dessin (comme dans Aspire) =====
const CF_T = ['circle', 'ellipse', 'rect', 'polygon', 'arc'];
const CF_DEF = { circle: { x: 0, y: 0, dm: 'r', v: 25 }, ellipse: { anc: 'mc', x: 0, y: 0, w: 60, h: 40 }, rect: { anc: 'bl', x: 0, y: 0, w: 80, h: 50 }, polygon: { x: 0, y: 0, r: 30, rot: 90 }, arc: { x0: -30, y0: 0, x1: 30, y1: 0, r: 30, h: 30 } };
let cfLast = null, cfT = 0;
// chaque forme tracée avec ces outils garde ses réglages (s.cf) pour pouvoir les modifier plus tard
const CF_UI = { circle: [], ellipse: [], rect: ['rectCorner', 'rectR'], polygon: ['polyN', 'polyStar', 'polyInner'], arc: ['arcMode'] };
function cfStore(sh, t) { if (!sh) return; sh.cf = { t, P: JSON.parse(JSON.stringify(cfP(t))), u: Object.fromEntries(CF_UI[t].map(k => [k, S.ui[k]])) }; }
const cfLinked = t => !!(cfLast && cfLast.t === t && S.sel.size === 1 && S.sel.has(cfLast.id) && shapeById(cfLast.id));
function cfGen(t, P, u) { const keep = Object.fromEntries(CF_UI[t].map(k => [k, S.ui[k]])); Object.assign(S.ui, u || {}); try { return cfNodes(t, P); } finally { Object.assign(S.ui, keep); } }
function cfSame(a, b) { if (!a || a.length !== b.length) return false; let m = 0; for (const n of b) m = Math.max(m, Math.abs(n.x), Math.abs(n.y)); const tol = 0.01 + m * 1e-5; return a.every((n, i) => Math.abs(n.x - b[i].x) < tol && Math.abs(n.y - b[i].y) < tol); }
// réglages valables pour la forme telle qu'elle est maintenant (déplacée ou redimensionnée depuis : on les recalcule)
function cfFor(sh) {
  const c = sh && sh.cf; if (!c || !CF_T.includes(c.t)) return null; const t = c.t, cands = [c.P];
  const g = cfGen(t, c.P, c.u); if (g && g.nodes.length === sh.nodes.length) { const dx = sh.nodes[0].x - g.nodes[0].x, dy = sh.nodes[0].y - g.nodes[0].y, P = { ...c.P }; for (const k of ['x', 'x0', 'x1']) if (k in P) P[k] = +(+P[k] + dx).toFixed(3); for (const k of ['y', 'y0', 'y1']) if (k in P) P[k] = +(+P[k] + dy).toFixed(3); cands.push(P); }
  if (t === 'rect' || t === 'ellipse' || t === 'circle') { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const n of sh.nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); } const b = { x0, y0, x1, y1 }, P = { ...c.P };
    if (t === 'circle') { const o = cfOut([(x0 + x1) / 2, (y0 + y1) / 2]), r = (x1 - x0) / 2; P.x = o[0]; P.y = o[1]; P.v = +(P.dm === 'd' ? 2 * r : r).toFixed(3); }
    else { const o = cfOut(anchorPt(b, P.anc || 'bl')); P.x = o[0]; P.y = o[1]; P.w = +(x1 - x0).toFixed(3); P.h = +(y1 - y0).toFixed(3); }
    cands.push(P); }
  for (const P of cands) { const r = cfGen(t, P, c.u); if (r && cfSame(r.nodes, sh.nodes)) return { t, P, u: c.u }; }
  return null;
}
function cfEdit() { const ss = selShapes(); const c = ss.length === 1 ? cfFor(ss[0]) : null; if (!c) return toast(tr('Ce vecteur a été modifié autrement (nœuds, rotation…) : ses cotes d’origine ne s’appliquent plus.'));
  const id = ss[0].id; S.ui.cf = S.ui.cf || {}; S.ui.cf[c.t] = { ...c.P }; Object.assign(S.ui, c.u); setTool(c.t); S.sel.clear(); S.sel.add(id); cfLast = { t: c.t, id }; cfFill(c.t); renderSel(); }
function cfOk() { const t = S.ui.tool; clearTimeout(cfT); if (cfLinked(t)) commit(); cfLast = null; S.sel.clear(); renderSel(); cfBtns(t); draw(); }
function cfBtns(t) { const f = document.querySelector('.cfform[data-cft="' + t + '"]'); if (!f) return; const on = cfLinked(t); f.querySelector('[data-act="cfCreate"]').hidden = on; f.querySelector('[data-act="cfOk"]').hidden = !on; f.classList.toggle('linked', on);
  f.querySelector('.cfhint').textContent = tr(on ? 'Les valeurs modifient le vecteur sélectionné. « Valider » le termine : tracez ensuite le suivant.' : 'Tracez à la souris, ou saisissez les valeurs puis « Créer ».'); }
function cfP(t) { S.ui.cf = S.ui.cf || {}; return S.ui.cf[t] = { ...CF_DEF[t], ...(S.ui.cf[t] || {}) }; }
function cfRectNodes(x0, y0, x1, y1) { const k = S.ui.rectCorner, r = +S.ui.rectR || 0; if (k === 'inner' && r > 0) return rectInnerNodes(x0, y0, x1, y1, r); const s = refresh({ nodes: rectNodes(x0, y0, x1, y1), closed: true }); if (k && k !== 'none' && r > 0) cornerAllNodes(s, k, r); return s.nodes; }
const CF_FX = { l: 0, c: 0.5, r: 1 }, CF_FY = { b: 0, m: 0.5, t: 1 };
function cfBox(P) { const fx = CF_FX[P.anc[1]], fy = CF_FY[P.anc[0]], w = Math.max(0.01, +P.w || 0), h = Math.max(0.01, +P.h || 0), q = inXY(+P.x || 0, +P.y || 0); return { x0: q[0] - fx * w, y0: q[1] - fy * h, w, h }; }
function arcFromChord(S0, E, h) { const d = [E[0] - S0[0], E[1] - S0[1]], c = Math.hypot(d[0], d[1]); if (c < 1e-9 || Math.abs(h) < 1e-9) return [NODE(S0[0], S0[1]), NODE(E[0], E[1])]; const nl = [-d[1] / c, d[0] / c], M = [(S0[0] + E[0]) / 2 + nl[0] * h, (S0[1] + E[1]) / 2 + nl[1] * h]; return arc3Nodes(S0, E, M); }
function cfNodes(t, P) {
  if (t === 'circle') { const r = P.dm === 'd' ? (+P.v || 0) / 2 : +P.v || 0; if (!(r > 0)) return null; return { nodes: ellipseNodes(inXY(+P.x || 0, +P.y || 0), r, r), closed: true }; }
  if (t === 'ellipse') { const b = cfBox(P); return { nodes: ellipseNodes([b.x0 + b.w / 2, b.y0 + b.h / 2], b.w / 2, b.h / 2), closed: true }; }
  if (t === 'rect') { const b = cfBox(P); return { nodes: cfRectNodes(b.x0, b.y0, b.x0 + b.w, b.y0 + b.h), closed: true }; }
  if (t === 'polygon') { const r = +P.r || 0; if (!(r > 0)) return null; const c = inXY(+P.x || 0, +P.y || 0), n = Math.max(3, Math.min(100, Math.round(+S.ui.polyN) || 6)), rot = (+P.rot || 0) * Math.PI / 180; return { nodes: S.ui.polyStar ? starNodes(c, r, r * Math.max(0.05, Math.min(0.95, (+S.ui.polyInner || 50) / 100)), n, rot) : polyNodes(c, r, n, rot), closed: true }; }
  if (t === 'arc') return { nodes: arcFromChord(inXY(+P.x0 || 0, +P.y0 || 0), inXY(+P.x1 || 0, +P.y1 || 0), +P.h || 0), closed: false };
  return null;
}
function arcByMode(a, b, c) { // 3 points (départ, arrivée, bombé) ou centre, départ, arrivée
  if (S.ui.arcMode !== 'center') return { nodes: arc3Nodes(a, b, c), S: a, E: b, M: c };
  const r = hyp(a, b), a0 = Math.atan2(b[1] - a[1], b[0] - a[0]), a1 = Math.atan2(c[1] - a[1], c[0] - a[0]), tw = 2 * Math.PI;
  // sens de l'arc : celui dans lequel la souris tourne autour du centre depuis le point de départ (angle cumulé)
  const T = arcByMode.T, key = a[0] + ',' + a[1] + ',' + b[0] + ',' + b[1]; if (!T || T.key !== key) arcByMode.T = { key, last: a0, tot: 0 };
  const K = arcByMode.T; let dl = a1 - K.last; dl -= tw * Math.round(dl / tw); K.tot = Math.max(-tw, Math.min(tw, K.tot + dl)); K.last = a1;
  let sw = K.tot; if (Math.abs(sw) < 1e-6) sw = 1e-6; if (Math.abs(sw) > tw - 1e-6) sw = Math.sign(sw) * (tw - 1e-6);
  const E = [a[0] + r * Math.cos(a1), a[1] + r * Math.sin(a1)], am = a0 + sw / 2; return { nodes: r > 1e-9 ? arcNodes(a, r, a0, sw) : [NODE(b[0], b[1])], S: b, E, M: [a[0] + r * Math.cos(am), a[1] + r * Math.sin(am)] };
}
// hauteur (flèche) signée de l'arc S→E passant par M, et rayon
function arcHR(S0, E, M) { const d = [E[0] - S0[0], E[1] - S0[1]], c = Math.hypot(d[0], d[1]); if (c < 1e-9) return { h: 0, r: 0 }; const k = circle3(S0, E, M); if (!k) return { h: 0, r: 0 }; const nl = [-d[1] / c, d[0] / c], side = Math.sign((M[0] - S0[0]) * nl[0] + (M[1] - S0[1]) * nl[1]) || 1, mid = [(S0[0] + E[0]) / 2, (S0[1] + E[1]) / 2], cs = (k.C[0] - mid[0]) * nl[0] + (k.C[1] - mid[1]) * nl[1];
  const h = Math.abs(k.r + cs * side); return { h: side * h, r: k.r }; }
function cfOut(q) { const o = outXY(q[0], q[1]); return [+o[0].toFixed(3), +o[1].toFixed(3)]; }
function cfFromDrag(D, s) {
  const t = D.mode; if (!CF_T.includes(t)) return; const P = cfP(t);
  if (t === 'rect' || t === 'ellipse') { const b = bbox([s]), q = anchorPt(b, P.anc), o = cfOut(q); P.x = o[0]; P.y = o[1]; P.w = +b.w.toFixed(3); P.h = +b.h.toFixed(3); }
  if (t === 'circle') { const o = cfOut(D.p0), r = hyp(D.p0, D.p1); P.x = o[0]; P.y = o[1]; P.v = +(P.dm === 'd' ? 2 * r : r).toFixed(3); }
  if (t === 'polygon') { const o = cfOut(D.p0); P.x = o[0]; P.y = o[1]; P.r = +hyp(D.p0, D.p1).toFixed(3); P.rot = +(Math.atan2(D.p1[1] - D.p0[1], D.p1[0] - D.p0[0]) * 180 / Math.PI).toFixed(2); }
  cfLast = { t, id: s.id }; cfStore(s, t); cfFill(t);
}
function cfFromArc(A, s) { const P = cfP('arc'), a = cfOut(A.S), b = cfOut(A.E), k = arcHR(A.S, A.E, A.M); P.x0 = a[0]; P.y0 = a[1]; P.x1 = b[0]; P.y1 = b[1]; P.h = +k.h.toFixed(3); P.r = +k.r.toFixed(3); cfLast = { t: 'arc', id: s.id }; { const g = cfNodes('arc', P); if (g && g.nodes.length > 1) { s.nodes = g.nodes.map(cloneNode); refresh(s); } } cfStore(s, 'arc'); cfFill('arc'); }
function cfHTML(t, extra) {
  const L = (lbl, k, more = '') => '<label>' + lbl + '<input data-u="len" type="number" data-cf="' + k + '" step="0.1"' + more + '></label>';
  const anc = '<div class="ogrid sm cfanc" role="group" aria-label="Point de référence">' + ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'].map(a => '<button type="button" data-cfa="' + a + '"></button>').join('') + '</div>';
  let h = '';
  if (t === 'circle') h = '<div class="cfh">Point central</div><div class="g2">' + L('X', 'x') + L('Y', 'y') + '</div><div class="seg cfseg" data-cfseg="dm"><button type="button" value="r">Rayon</button><button type="button" value="d">Diamètre</button></div><div class="g2">' + L('<span><span id="cfRL">Rayon</span> (mm)</span>', 'v', ' min="0"') + '</div>';
  if (t === 'ellipse' || t === 'rect') h = '<div class="cfh">Point</div><div class="orow">' + anc + '<div class="g2">' + L('X', 'x') + L('Y', 'y') + '</div></div><div class="cfh">Taille</div><div class="g2">' + L('Largeur (X)', 'w', ' min="0.01"') + L('Hauteur (Y)', 'h', ' min="0.01"') + '</div>' + (t === 'rect' ? '<div class="cfh">Type de coin</div>' + extra : '');
  if (t === 'polygon') h = extra + '<div class="cfh">Centre</div><div class="g2">' + L('X', 'x') + L('Y', 'y') + L('Rayon (mm)', 'r', ' min="0"') + '<label>Angle (°)<input type="number" data-cf="rot" step="1"></label></div>';
  if (t === 'arc') h = '<div class="seg cfseg" data-cfseg="arcMode"><button type="button" value="3p">À travers 3 points</button><button type="button" value="center">Centre, départ, arrivée</button></div><div class="cfh">Point de départ</div><div class="g2">' + L('X', 'x0') + L('Y', 'y0') + '</div><div class="cfh">Point d’arrivée</div><div class="g2">' + L('X', 'x1') + L('Y', 'y1') + '</div><div class="g2">' + L('Rayon (mm)', 'r', ' min="0"') + L('Hauteur (mm)', 'h') + '</div>';
  return '<div class="cfform" data-cft="' + t + '">' + h + '<div class="row cfrow"><button type="button" class="primary" data-act="cfCreate">Créer</button><button type="button" class="primary" data-act="cfOk" hidden>Valider</button></div><p class="hint cfhint"></p></div>';
}
function cfFill(t) {
  const f = document.querySelector('.cfform[data-cft="' + t + '"]'); if (!f) return; const P = cfP(t);
  f.querySelectorAll('[data-cf]').forEach(el => { if (document.activeElement !== el) el.value = P[el.dataset.cf] ?? ''; });
  f.querySelectorAll('[data-cfa]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cfa === P.anc));
  const dm = f.querySelector('[data-cfseg="dm"]'); if (dm) { dm.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.value === (P.dm || 'r'))); const rl = $('#cfRL'); if (rl) rl.textContent = tr(P.dm === 'd' ? 'Diamètre' : 'Rayon'); }
  const am = f.querySelector('[data-cfseg="arcMode"]'); if (am) am.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.value === (S.ui.arcMode === 'center' ? 'center' : '3p')));
  cfBtns(t);
}
function cfLive(t, final) {
  const sh = cfLast && cfLast.t === t && S.sel.size === 1 && S.sel.has(cfLast.id) ? shapeById(cfLast.id) : null; if (!sh) return; const r = cfNodes(t, cfP(t)); if (!r || r.nodes.length < 2) return;
  sh.nodes = r.nodes.map(cloneNode); refresh(sh); cfStore(sh, t); if (typeof snapVer !== 'undefined') snapVer++; renderSel(); draw();
  clearTimeout(cfT); if (final) commit(); else cfT = setTimeout(() => commit(), 700);
}
function cfCreate() { const t = S.ui.tool; if (!CF_T.includes(t)) return; const r = cfNodes(t, cfP(t)); if (!r || r.nodes.length < 2) return toast(tr('Valeurs incomplètes : indiquez une taille.')); const s = mkShape(r.nodes.map(cloneNode), r.closed); if (!s) return; cfStore(s, t); S.sel.clear(); S.sel.add(s.id); cfLast = { t, id: s.id }; renderSel(); commit(); draw(); toast(tr('Forme créée.')); }
function cfBind(t) {
  const f = document.querySelector('.cfform[data-cft="' + t + '"]'); if (!f) return; uAttrs(f); cfFill(t);
  f.addEventListener('input', e => { const k = e.target.dataset.cf; if (!k) return; const P = cfP(t), v = parseFloat(String(e.target.value).replace(',', '.')); if (!isFinite(v)) return; P[k] = v;
    if (t === 'arc') { const c = Math.hypot((P.x1 - P.x0), (P.y1 - P.y0)); if (k === 'h') { P.r = Math.abs(P.h) > 1e-9 ? +((c * c / 4 + P.h * P.h) / (2 * Math.abs(P.h))).toFixed(3) : 0; } else if (k === 'r') { const r = Math.max(P.r, c / 2), big = Math.abs(P.h) > c / 2, sg = Math.sign(P.h) || 1; P.h = +(sg * (r + (big ? 1 : -1) * Math.sqrt(Math.max(0, r * r - c * c / 4)))).toFixed(3); } else { P.r = Math.abs(P.h) > 1e-9 ? +((c * c / 4 + P.h * P.h) / (2 * Math.abs(P.h))).toFixed(3) : 0; } cfFill(t); }
    cfLive(t); });
  f.addEventListener('change', e => { if (e.target.dataset.cf) cfLive(t, true); else if (e.target.dataset.k) setTimeout(() => cfLive(t, true), 0); });
  f.addEventListener('input', e => { if (e.target.dataset.k) setTimeout(() => cfLive(t), 0); });
  f.addEventListener('click', e => {
    const a = e.target.closest('[data-cfa]'); if (a) { const P = cfP(t), old = cfBox(P); P.anc = a.dataset.cfa; const q = anchorPt({ x0: old.x0, y0: old.y0, x1: old.x0 + old.w, y1: old.y0 + old.h }, P.anc), o = cfOut(q); P.x = o[0]; P.y = o[1]; cfFill(t); return; }
    const sb = e.target.closest('.cfseg button'); if (sb) { const g = sb.parentElement.dataset.cfseg, P = cfP(t); if (g === 'dm' && P.dm !== sb.value) { P.v = +(sb.value === 'd' ? (+P.v || 0) * 2 : (+P.v || 0) / 2).toFixed(3); P.dm = sb.value; } if (g === 'arcMode') { S.ui.arcMode = sb.value; arcSt = []; } cfFill(t); return; }
  });
}
// ===== miroir =====
function mirrorSel(a) {
  let ss = selShapes(); if (!ss.length) return toast('Sélectionnez un vecteur.');
  let f = null;
  if (a === 'mirLine') { const isLine = x => !x.closed && x.nodes.length === 2 && !x.nodes[0].o && !x.nodes[1].i; const ax = ss.filter(isLine); if (ax.length !== 1 || ss.length < 2) return toast(tr('Sélectionnez les vecteurs à retourner et une seule ligne droite (2 points) qui sert d’axe.')); const L = ax[0], A = [L.nodes[0].x, L.nodes[0].y], B = [L.nodes[1].x, L.nodes[1].y], u = nrm([B[0] - A[0], B[1] - A[1]]); ss = ss.filter(x => x !== L); f = q => { const d = [q[0] - A[0], q[1] - A[1]], k = d[0] * u[0] + d[1] * u[1], P = [A[0] + u[0] * k, A[1] + u[1] * k]; return [2 * P[0] - q[0], 2 * P[1] - q[1]]; }; }
  else { const b = bbox(ss), st = S.stock, cx = S.ui.mirStock ? st.w / 2 : b.x0 + b.w / 2, cy = S.ui.mirStock ? st.h / 2 : b.y0 + b.h / 2;
    f = { mirH: q => [2 * cx - q[0], q[1]], mirV: q => [q[0], 2 * cy - q[1]], mirL: q => [2 * b.x0 - q[0], q[1]], mirR: q => [2 * (b.x0 + b.w) - q[0], q[1]], mirT: q => [q[0], 2 * (b.y0 + b.h) - q[1]], mirB: q => [q[0], 2 * b.y0 - q[1]] }[a]; }
  const out = [];
  if (S.ui.mirCopy) { const gm = new Map(); for (const o of ss) { const g = o.g ? (gm.get(o.g) || (gm.set(o.g, uid()), gm.get(o.g))) : undefined; const n = mkShape(o.nodes.map(cloneNode), o.closed, { layer: o.layer, ...(g ? { g } : {}) }); if (n) { transformShape(n, f); out.push(n); } } }
  else ss.forEach(o => { transformShape(o, f); if (o.rot) o.rot = normDeg(-o.rot); out.push(o); });
  S.sel = new Set(out.map(o => o.id)); commit(); renderSel(); draw(); toast(S.ui.mirCopy ? trf('{n} copie(s) en miroir créée(s).', { n: out.length }) : tr('Sélection retournée.'));
}


// ===== étendre les tracés : prolonger deux vecteurs ouverts jusqu'au croisement de leurs tangentes d'extrémité =====
let extSt = null;
function extEnd(s, p) { // extrémité la plus proche du clic, point et direction sortante
  const n = s.nodes.length, A = s.nodes[0], Z = s.nodes[n - 1], dA = Math.hypot(p[0] - A.x, p[1] - A.y), dZ = Math.hypot(p[0] - Z.x, p[1] - Z.y), last = dZ <= dA;
  const N = last ? Z : A, M = last ? s.nodes[n - 2] : s.nodes[1]; let d;
  // une poignée minuscule (petit glissement de la plume) ne doit pas fausser la direction : on l'ignore
  const seg = Math.hypot(N.x - M.x, N.y - M.y), big = h => h && Math.hypot(h[0], h[1]) > Math.max(0.3, seg * 0.08);
  const hN = last ? N.i : N.o, hM = last ? M.o : M.i;
  d = big(hN) ? [-hN[0], -hN[1]] : big(hM) ? [N.x - (M.x + hM[0]), N.y - (M.y + hM[1])] : [N.x - M.x, N.y - M.y];
  return { sid: s.id, last, P: [N.x, N.y], d: nrm(d) };
}
let extHov = null; // côté visé : extrémité, direction, croisements du prolongement avec les autres vecteurs
function extRay(sh, p) {
  const e = extEnd(sh, p), L = Math.max(S.stock.w, S.stock.h) * 3 + 1000, hits = [];
  for (const o of S.shapes) { if (o.id === sh.id || !shown(o) || !o.pts || o.pts.length < 2) continue; const A = o.pts, n = o.closed ? A.length : A.length - 1;
    for (let k = 0; k < n; k++) { const a = A[k], b = A[(k + 1) % A.length], v = [b[0] - a[0], b[1] - a[1]], den = e.d[0] * v[1] - e.d[1] * v[0]; if (Math.abs(den) < 1e-12) continue;
      const w = [a[0] - e.P[0], a[1] - e.P[1]], t = (w[0] * v[1] - w[1] * v[0]) / den, u = (w[0] * e.d[1] - w[1] * e.d[0]) / den; if (t > 1e-6 && t < L && u >= -1e-9 && u <= 1 + 1e-9) hits.push({ t, X: [e.P[0] + e.d[0] * t, e.P[1] + e.d[1] * t] }); } }
  hits.sort((x, y) => x.t - y.t); const H = hits.filter((h, i) => !i || h.t - hits[i - 1].t > 1e-6); return { ...e, hits: H, L };
}
function extHover(p) {
  if (!extSt) { const s = hitEdge(p, 8); hoverEdge = null; extHov = null; draw(); return; }
  const sh = shapeById(extSt.sid); if (!sh) { extSt = null; extHov = null; return; }
  const r = extRay(sh, p); let near = -1, bd = 12; r.hits.forEach((h, i) => { const d = Math.hypot(sx(h.X[0]) - sx(p[0]), sy(h.X[1]) - sy(p[1])); if (d < bd) { bd = d; near = i; } }); r.near = near; extHov = r; draw();
}
function extClick(p) {
  if (extSt && extHov && extHov.near >= 0) { const sh = shapeById(extSt.sid), X = extHov.hits[extHov.near].X; if (sh) { const n = sh.nodes.length; if (extHov.last) { const N = sh.nodes[n - 1], M = sh.nodes[n - 2]; if (!N.i && !M.o) { N.x = X[0]; N.y = X[1]; } else { N.o = null; sh.nodes.push(NODE(X[0], X[1])); } } else { const N = sh.nodes[0], M = sh.nodes[1]; if (!N.o && !M.i) { N.x = X[0]; N.y = X[1]; } else { N.i = null; sh.nodes.unshift(NODE(X[0], X[1])); } } refresh(sh); if (typeof snapVer !== 'undefined') snapVer++; renderSel(); commit(); toast(tr('Tracé prolongé jusqu’au croisement.')); } extHover(p); return; }
  const s = hitEdge(p, 8);
  if (s && !s.closed && s.nodes.length >= 2) { extSt = { sid: s.id }; S.sel = new Set([s.id]); renderSel(); extHover(p); toast(tr('Approchez la souris d’une extrémité : le prolongement s’affiche en pointillés. Cliquez son croisement avec un autre vecteur.')); return; }
  if (s && s.closed) { toast(tr('Ce vecteur est fermé : il n’a pas d’extrémité à prolonger.')); return; }
  if (extSt) { toast(extHov && extHov.hits.length ? tr('Cliquez sur un point de croisement (rond) du prolongement en pointillés.') : tr('Le prolongement de ce côté ne croise aucun vecteur.')); return; }
  toast(tr('Cliquez d’abord le trait ouvert à prolonger.'));
}
function drawExt() {
  if (S.ui.tool !== 'extend' || !extSt) return; const sh = shapeById(extSt.sid); if (!sh) return; const ac = tok('--accent');
  ctx.save(); ctx.strokeStyle = ac; ctx.lineWidth = 3; pathOf(sh.pts, sh.closed); ctx.stroke();
  const r = extHov; if (r) { const end = r.hits.length ? r.hits[r.hits.length - 1].t : 0, Lv = Math.max(end + 20, 80 / S.view.s), P = r.P;
    ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx(P[0]), sy(P[1])); ctx.lineTo(sx(P[0] + r.d[0] * Lv), sy(P[1] + r.d[1] * Lv)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(sx(P[0]), sy(P[1]), 4, 0, 7); ctx.fill();
    r.hits.forEach((h, i) => { ctx.beginPath(); ctx.arc(sx(h.X[0]), sy(h.X[1]), i === r.near ? 7 : 4.5, 0, 7); ctx.fillStyle = i === r.near ? ac : '#fff'; ctx.strokeStyle = ac; ctx.lineWidth = 2; ctx.fill(); ctx.stroke(); });
    if (r.near >= 0) { const X = r.hits[r.near].X; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx(P[0]), sy(P[1])); ctx.lineTo(sx(X[0]), sy(X[1])); ctx.stroke(); } }
  ctx.restore();
}
// ===== petite barre près du pointeur quand on clique un relief (2D ou 3D) =====
let RELBAR = null;
function relBarShow(host, x, y) { const it = relCur(); RELBAR = it ? { host, x, y, id: it.id } : null; placeRelBar(); }
function placeRelBar() {
  { const b = $('#relbar'); if (b) b.hidden = true; return; }
  const bar = $('#relbar'); if (!bar) return;
  if (!RELBAR || S.relSel !== RELBAR.id || !$('#tpWin').hidden || (RELBAR.host === 'rv3' && !VIEWS.d3) || (RELBAR.host === 'cw' && !VIEWS.d2)) { bar.hidden = true; return; }
  const host = $('#' + RELBAR.host); if (bar.parentElement !== host) host.appendChild(bar);
  bar.hidden = false; const hw = host.clientWidth, hh = host.clientHeight, bw = bar.offsetWidth || 320, bh = bar.offsetHeight || 40;
  bar.style.left = Math.max(bw / 2 + 6, Math.min(hw - bw / 2 - 6, RELBAR.x)) + 'px'; bar.style.top = Math.max(6, Math.min(hh - bh - 6, RELBAR.y + 18)) + 'px';
}
function relDup() { const it = relCur(); if (!it) return; const g = relGrid[it.id]; if (!g) return toast(tr('Relief encore en chargement.')); const c = JSON.parse(JSON.stringify(it)); delete c.id; c.name = it.name + ' ' + tr('(copie)'); c.x = it.x + 10; c.y = it.y - 10; if (c.kind === 'image') c.linked = false; const oldMesh = relMesh[it.id]; relAdd(c, typeof structuredClone === 'function' ? structuredClone(g) : g); if (oldMesh) { relMesh[c.id] = oldMesh; idbPutImg('relm_' + c.id, oldMesh).catch(() => { }); } toast(tr('Relief dupliqué (décalé de 10 mm).')); }


// ===== menu du clic droit (2D et 3D) =====
const CMI = { dup: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>', del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>', mach: '<svg viewBox="0 0 24 24"><path d="M12 3v10M8 9l4 4 4-4M5 20h14"/></svg>', fit: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>', ctr: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/></svg>', eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>' };
function cmIco(k) { return CMI[k] || (DI[k] || BICO[k] || '').replace('<svg', '<svg class="bico"'); }
function cmClose() { document.querySelectorAll('.cmenu').forEach(m => m.remove()); }
function cmBuild(items, title) {
  const m = document.createElement('div'); m.className = 'cmenu'; m.setAttribute('role', 'menu');
  if (title) { const h = document.createElement('div'); h.className = 'cmh'; h.textContent = title; m.appendChild(h); }
  for (const it of items) {
    if (it === '-') { const hr = document.createElement('div'); hr.className = 'cmsep'; m.appendChild(hr); continue; }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cmi' + (it.sub ? ' sub' : '') + (it.danger ? ' danger' : ''); b.setAttribute('role', 'menuitem'); b.disabled = !!it.off;
    b.innerHTML = '<span class="cmic">' + (it.ico ? cmIco(it.ico) : '') + '</span><span class="cml"></span>' + (it.kbd ? '<kbd></kbd>' : '') + (it.sub ? '<span class="cmar">›</span>' : '');
    b.querySelector('.cml').textContent = tr(it.label); if (it.kbd) b.querySelector('kbd').textContent = it.kbd;
    if (it.sub) { const sm = cmBuild(it.sub); sm.classList.add('cmsub'); b.appendChild(sm); b.addEventListener('mouseenter', () => { m.querySelectorAll(':scope > .cmi > .cmsub').forEach(x => x.classList.toggle('on', x === sm)); cmFit(sm, true); }); b.addEventListener('click', e => { e.stopPropagation(); sm.classList.add('on'); cmFit(sm, true); }); }
    else { b.addEventListener('mouseenter', () => m.querySelectorAll(':scope > .cmi > .cmsub').forEach(x => x.classList.remove('on'))); b.addEventListener('click', e => { e.stopPropagation(); cmClose(); try { it.fn(); } catch (er) { toast(er.message || String(er)); } }); }
    m.appendChild(b);
  }
  return m;
}
function cmFit(sm) { sm.style.left = ''; sm.style.right = ''; sm.style.top = ''; const r = sm.getBoundingClientRect(); if (r.right > innerWidth - 4) { sm.style.left = 'auto'; sm.style.right = '100%'; } if (r.bottom > innerHeight - 4) sm.style.top = Math.min(0, innerHeight - 4 - r.bottom) + 'px'; }
let cmT = 0;
function cmOpen(items, x, y, title) {
  cmClose(); cmT = Date.now(); if (!items.length) return; const m = cmBuild(items, title); document.body.appendChild(m);
  const r = m.getBoundingClientRect(); m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px'; m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  const f = m.querySelector('.cmi:not(:disabled)'); if (f) f.focus({ preventScroll: true });
}
document.addEventListener('pointerdown', e => { if (!e.target.closest || !e.target.closest('.cmenu')) cmClose(); }, true);
// sous Windows, le menu du navigateur arrive après le relâchement du bouton : on le bloque sur notre menu et juste après son ouverture
document.addEventListener('contextmenu', e => { if ((e.target.closest && e.target.closest('.cmenu')) || Date.now() - cmT < 600) e.preventDefault(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.cmenu')) { cmClose(); e.stopPropagation(); } }, true);
window.addEventListener('blur', cmClose); window.addEventListener('resize', cmClose);
document.addEventListener('wheel', e => { if (!e.target.closest || !e.target.closest('.cmenu')) cmClose(); }, { capture: true, passive: true });
// listes d'actions selon l'objet visé
function cmVector(in3d) {
  const ss = selShapes(), us = units(ss), oneGroup = us.length === 1 && !!(ss[0] && ss[0].g), nc = ss.filter(x => x.closed).length;
  const title = trf(ss.length > 1 ? '{n} vecteurs' : '{n} vecteur', { n: ss.length });
  return [title, [
    { label: 'Usiner', ico: 'mach', sub: [{ label: 'Profil', fn: () => tpNew('profile') }, { label: 'Poche', fn: () => tpNew('pocket'), off: !nc }, { label: 'V-carve', fn: () => tpNew('vcarve'), off: !nc }, { label: 'Perçage', fn: () => tpNew('drill') }] },
    '-',
    { label: 'Dupliquer', ico: 'dup', kbd: 'Ctrl+D', fn: () => act('dup') },
    oneGroup ? { label: 'Dégrouper', ico: 'ungroup', kbd: 'Ctrl+Maj+G', fn: () => act('ungroup') } : { label: 'Grouper', ico: 'group', kbd: 'Ctrl+G', fn: () => act('group'), off: us.length < 2 },
    { label: 'Souder', ico: 'boolU', fn: () => act('boolU'), off: nc < 2 },
    { label: 'Contour décalé…', ico: 'offset', fn: () => { setTab('dessin'); dSec('offset'); } },
    { label: 'Miroir…', ico: 'mirror', fn: () => { setTab('dessin'); dSec('mirror'); } },
    { label: 'Rotation…', ico: 'rotate', fn: () => { setTab('dessin'); dSec('rotate'); } },
    { label: 'Centrer sur le brut', ico: 'ctr', fn: () => act('center') },
    '-',
    { label: 'Incrustation', sub: [{ label: 'En V…', fn: () => ilOpen(), off: !nc }, { label: 'En poche (fraise droite)…', fn: () => ipOpen(), off: !nc }] },
    { label: 'Créer un relief', sub: [{ label: 'Dôme', fn: () => relFromDrawing('dome'), off: !nc }, { label: 'Extrusion', fn: () => relFromDrawing('extrude') }] },
    { label: 'Mettre sur le calque', sub: S.layers.map(l => ({ label: l.name, fn: () => { ss.forEach(s => s.layer = l.id); commit(false); renderLayers(); renderSel(); draw(); toast(trf('Déplacé sur le calque « {n} ».', { n: l.name })); } })) },
    { label: 'Copier sur le calque', sub: S.layers.map(l => ({ label: l.name, fn: () => copyToLayer(ss, l) })) },
    '-',
    { label: 'Supprimer', ico: 'del', kbd: 'Suppr', danger: true, fn: () => act('del') }]];
}
function cmImage() {
  const im = S.imgSel && imgById(S.imgSel); if (!im) return null;
  return [tr('Image') + ' · ' + im.name, [
    { label: 'Vectoriser…', ico: 'traceOutline', fn: () => { setTab('dessin'); act('traceOutline'); } },
    { label: 'Transformer en relief (niveaux de gris)', fn: () => imgAct('relGray') },
    '-',
    { label: 'Ajuster au brut', ico: 'fit', fn: () => imgAct('imgFit') },
    { label: 'Centrer', ico: 'ctr', fn: () => imgAct('imgCenter') },
    { label: 'Premier plan', fn: () => act('zFront') }, { label: 'Arrière-plan', fn: () => act('zBack') },
    { label: im.locked ? 'Déverrouiller' : 'Verrouiller', fn: () => imgAct('imgLock') },
    '-',
    { label: 'Supprimer', ico: 'del', danger: true, fn: () => imgAct('imgDel') }]];
}
function cmRelief(in3d) {
  const it = relCur(); if (!it) return null;
  const finish = () => { tpNew('relief'); const b = document.querySelector('#tpForm [data-f="rlOp"] button[value="finish"]'); if (b) b.click(); };
  const L = [
    { label: 'Parcours d’ébauche', ico: 'mach', fn: () => tpNew('relief') },
    { label: 'Parcours de finition', fn: finish },
    { label: 'Parcours de profil (détourer)', fn: () => tpNew('profile') },
    { label: 'Créer le contour', ico: 'traceOutline', fn: () => relOutline(it) },
    '-'];
  if (in3d) L.push({ label: 'Déplacer', fn: () => { RV.tool = 'move'; rvToolsSync(); rvReq(); } }, { label: 'Tourner', fn: () => { RV.tool = 'rotate'; rvToolsSync(); rvReq(); } }, { label: 'Redimensionner', fn: () => { RV.tool = 'scale'; rvToolsSync(); rvReq(); } }, { label: 'Poser au fond du brut', fn: () => act('rvDropB') }, { label: 'Aligner sur le dessus du brut', fn: () => act('rvDropT') }, '-');
  L.push({ label: 'Dupliquer', ico: 'dup', fn: () => relDup() }, { label: 'Ajuster au brut', ico: 'fit', fn: () => imgAct('relFit') }, { label: 'Centrer', ico: 'ctr', fn: () => imgAct('relCenter') }, { label: 'Masquer', ico: 'eye', fn: () => { it.visible = false; relBump(); relDirty = true; commit(false); relPanel(); draw(); } }, '-', { label: 'Supprimer', ico: 'del', danger: true, fn: () => imgAct('relDel') });
  return [tr('Relief') + ' · ' + it.name, L];
}
function cm2D(e) {
  const r = cv.getBoundingClientRect(), X = e.clientX - r.left, Y = e.clientY - r.top, p = [wx(X), wy(Y)];
  const h = hitShape(p) || hitSelInside(p);
  if (h) { if (!S.sel.has(h.id)) { S.selDim = null; if (S.imgSel) { S.imgSel = null; renderImgPanel(); } if (S.relSel) { S.relSel = null; relPanel(); } S.sel.clear(); groupIds(h).forEach(id => S.sel.add(id)); renderSel(); dRefresh(); draw(); } const [t, L] = cmVector(false); cmOpen(L, e.clientX, e.clientY, t); return; }
  const hi = imgHit(p); if (hi) { if (S.imgSel !== hi.id) selectImg(hi.id); const c = cmImage(); if (c) cmOpen(c[1], e.clientX, e.clientY, c[0]); return; }
  const hr = relHit(p); if (hr) { if (S.relSel !== hr.id) selectRel(hr.id); const c = cmRelief(false); if (c) cmOpen(c[1], e.clientX, e.clientY, c[0]); return; }
  rightClick(); // dans le vide : ferme l'outil ou les réglages en cours et désélectionne, sans menu
}
function cm3D(e, mx, my) {
  const sh = rvPickShape(mx, my); if (sh) { if (!S.sel.has(sh.id)) rvSelectShape(sh, false); const [t, L] = cmVector(true); cmOpen(L, e.clientX, e.clientY, t); return; }
  const id = rvPick(mx, my); if (id) { if (S.relSel !== id) selectRel(id); const c = cmRelief(true); if (c) cmOpen(c[1], e.clientX, e.clientY, c[0]); return; }
  cmOpen([{ label: 'Tout voir', ico: 'fit', fn: () => rvFit(true) }, { label: 'Vue de dessus', fn: () => v3AnimTo(-Math.PI / 2, 1.5703, RV, rvReq) }, { label: 'Vue de face', fn: () => v3AnimTo(-Math.PI / 2, 0, RV, rvReq) }], e.clientX, e.clientY);
}

function previewShape(D) {
  const a = D.p0, b = D.p1; if (!a || !b) return null; let nodes = null;
  if (D.mode === 'rect') { if (Math.abs(b[0] - a[0]) < 1e-6 || Math.abs(b[1] - a[1]) < 1e-6) return null; return refresh({ nodes: cfRectNodes(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])), closed: true }); }
  if (D.mode === 'ellipse') { let rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2; if (D.shift) rx = ry = Math.max(rx, ry); if (rx < 1e-6 || ry < 1e-6) return null; const c = D.shift ? [a[0] + Math.sign(b[0] - a[0]) * rx, a[1] + Math.sign(b[1] - a[1]) * ry] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; nodes = ellipseNodes(c, rx, ry); }
  if (D.mode === 'circle') { const r = hyp(a, b); if (r < 1e-6) return null; nodes = ellipseNodes(a, r, r); }
  if (D.mode === 'polygon') { const r = hyp(a, b); if (r < 1e-6) return null; const rot = Math.atan2(b[1] - a[1], b[0] - a[0]), n = Math.max(3, Math.min(100, Math.round(+S.ui.polyN) || 6)); nodes = S.ui.polyStar ? starNodes(a, r, r * Math.max(0.05, Math.min(0.95, (+S.ui.polyInner || 50) / 100)), n, rot) : polyNodes(a, r, n, rot); }
  return nodes ? refresh({ nodes, closed: true }) : null;
}

