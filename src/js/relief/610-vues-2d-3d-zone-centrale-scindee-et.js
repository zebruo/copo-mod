// ---------- VUES 2D / 3D (zone centrale scindée) et visionneuse 3D du relief ----------
var VIEWS = (() => { try { const o = JSON.parse(LS.get('copo.views') || 'null'); if (o) return { d2: true, d3: true, split: o.split === 'h' ? 'h' : 'v', f: +o.f > 0.1 && +o.f < 0.9 ? +o.f : 0.5 }; } catch { } return { d2: true, d3: true, split: 'v', f: 0.5 }; })(); // à l'ouverture : plan 2D et vue 3D côte à côte
function viewsApply() {
  const v = $('#views'); if (!v) return; if (!VIEWS.d2 && !VIEWS.d3) VIEWS.d2 = true;
  $('#cw').hidden = !VIEWS.d2; $('#rv3').hidden = !VIEWS.d3; v.classList.toggle('both', VIEWS.d2 && VIEWS.d3); v.classList.toggle('v', VIEWS.split === 'v'); v.classList.toggle('h', VIEWS.split === 'h');
  const b2 = document.querySelector('[data-act="view2d"]'), b3 = document.querySelector('[data-act="view3d"]'); if (b2) b2.classList.toggle('on', VIEWS.d2); if (b3) b3.classList.toggle('on', VIEWS.d3);
  for (const [k, on] of [['splitV', VIEWS.split === 'v'], ['splitH', VIEWS.split === 'h']]) { const b = document.querySelector('[data-act="' + k + '"]'); if (b) { b.disabled = !(VIEWS.d2 && VIEWS.d3); b.setAttribute('aria-pressed', on && !b.disabled); } }
  vsplitApply();
  try { LS.set('copo.views', JSON.stringify({ d2: VIEWS.d2, d3: VIEWS.d3, split: VIEWS.split, f: VIEWS.f })); } catch { }
  if (VIEWS.d2) requestAnimationFrame(() => { resize(); }); if (VIEWS.d3) { if (!RV.gl) rvInit(); RV.sig = ''; RV.lsig = ''; rvSync(); rvReq(); }
}
// séparation entre les deux vues : position f (part de la vue 2D), glissable, double-clic = moitié-moitié
function vsplitApply() { const v = $('#views'), sp = $('#vsplit'); if (!v || !sp) return; const both = VIEWS.d2 && VIEWS.d3, f = VIEWS.f || 0.5; sp.hidden = !both; v.style.gridTemplateColumns = both && VIEWS.split === 'v' ? 'minmax(0,' + f + 'fr) minmax(0,' + (1 - f) + 'fr)' : ''; v.style.gridTemplateRows = both && VIEWS.split === 'h' ? 'minmax(0,' + f + 'fr) minmax(0,' + (1 - f) + 'fr)' : ''; sp.style.left = VIEWS.split === 'v' ? 'calc((100% - 8px) * ' + f + ')' : ''; sp.style.top = VIEWS.split === 'h' ? 'calc((100% - 8px) * ' + f + ')' : ''; }
(() => { const sp = document.getElementById('vsplit'); if (!sp) return; let on = false, raf = 0;
  const upd = () => { raf = 0; vsplitApply(); if (VIEWS.d2) resize(); if (typeof rvReq === 'function') rvReq(); };
  sp.addEventListener('pointerdown', e => { if (e.button !== 0) return; on = true; sp.setPointerCapture(e.pointerId); sp.classList.add('drag'); e.preventDefault(); });
  sp.addEventListener('pointermove', e => { if (!on) return; const r = $('#views').getBoundingClientRect(), f = VIEWS.split === 'v' ? (e.clientX - r.left) / Math.max(1, r.width - 8) : (e.clientY - r.top) / Math.max(1, r.height - 8); VIEWS.f = Math.max(0.12, Math.min(0.88, f)); if (!raf) raf = requestAnimationFrame(upd); });
  const end = () => { if (!on) return; on = false; sp.classList.remove('drag'); viewsApply(); }; sp.addEventListener('pointerup', end); sp.addEventListener('pointercancel', end);
  sp.addEventListener('dblclick', () => { VIEWS.f = 0.5; viewsApply(); }); })();
function viewToggle(k) { VIEWS[k] = !VIEWS[k]; if (!VIEWS.d2 && !VIEWS.d3) VIEWS[k === 'd2' ? 'd3' : 'd2'] = true; if (k === 'd3' && !VIEWS.d3) VIEWS.userHid3 = true; viewsApply(); }
var RV = (() => { let o = {}; try { o = JSON.parse(LS.get('copo.rv') || '{}') || {}; } catch { } return { gl: null, yaw: -Math.PI / 2 + 0.35, pitch: 0.75, dist: 500, tgt: [150, 100, -9], sig: '', lsig: '', raf: 0, showDraw: o.d !== false, showAxes: o.a !== false, showStock: true, showTp: true, cubeHover: null, fitted: false }; })();
function rvSave() { try { LS.set('copo.rv', JSON.stringify({ d: RV.showDraw, a: RV.showAxes, s: RV.showStock, t: RV.showTp })); } catch { } for (const [k, on] of [['rvDraw', RV.showDraw], ['rvAxes', RV.showAxes], ['rvStock', RV.showStock], ['rvTp', RV.showTp]]) { const b = document.querySelector('[data-act="' + k + '"]'); if (b) b.setAttribute('aria-pressed', on); } }
const RV_VS = `#version 300 es
precision highp float; in vec3 aP; in vec3 aN; uniform mat4 uMVP; out vec3 vN; out float vZ;
${WRAP_GLSL}
uniform vec3 uOff;
void main(){ vec3 p = aP + uOff; vN = wrapN(p, aN); vZ = p.z; gl_Position = uMVP * vec4(wrapP(p), 1.0); }`;
const RV_FS = `#version 300 es
precision highp float; in vec3 vN; in float vZ; out vec4 o; uniform vec3 uL; uniform vec3 uC;
void main(){ float d = abs(dot(normalize(vN), uL)); o = vec4(uC * (0.35 + 0.65 * d), 1.0); }`;
const RV_LVS = `#version 300 es
precision highp float; in vec3 aP; in vec3 aC; uniform mat4 uMVP; out vec3 vC;
${WRAP_GLSL}
void main(){ vC = aC; gl_Position = uMVP * vec4(wrapP(aP), 1.0); gl_Position.z -= 0.0004 * gl_Position.w; }`;
const RV_LFS = `#version 300 es
precision highp float; in vec3 vC; out vec4 o; void main(){ o = vec4(vC, 1.0); }`;
function rvInit() {
  const c = $('#rvc'), gl = c.getContext('webgl2', { antialias: true }); if (!gl) { $('#rvInfo').textContent = tr('La vue 3D demande WebGL 2.'); return false; }
  RV.gl = gl; RV.prog = glProg(gl, RV_VS, RV_FS); RV.lprog = glProg(gl, RV_LVS, RV_LFS); gl.enable(gl.DEPTH_TEST);
  // souris : voir nav3dAct (par défaut clic droit = tourner, clic molette = déplacer), molette = zoom, double-clic = tout le brut
  let drag = null;
  c.addEventListener('contextmenu', e => e.preventDefault());
  c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const gh = e.button === 0 ? rvGizmoHit(mx, my) : null;
    if (gh) { drag = { gz: gh, mx, my, x0: e.clientX, y0: e.clientY, it: relCur(), st: rvSnapIt(relCur()), moved: false }; if (gh.type === 'axis') relDragPrep(drag.it); return; }
    const act = nav3dAct(e); drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, mx, my, btn: e.button, pan: act === 'pan', rot: act === 'rot', sg: Math.cos(RV.pitch) < 0 ? -1 : 1 }; if (act === 'rot') drag.P = orbitPivot(RV, RV.mvp, c.clientWidth, c.clientHeight, mx, my, rvOrbitBox(), wrapInfo() ? null : RV.hf); if (act) { RV.touched = true; c.style.cursor = act === 'pan' ? 'move' : 'grabbing'; } });
  c.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); }); /* pas de défilement automatique au clic molette */
  c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (!drag) { const h = RV.tool ? rvGizmoHit(mx, my) : null, k = h ? h.k : null; if (k !== RV.hover) { RV.hover = k; rvReq(); } c.style.cursor = h || rvPickShape(mx, my) ? 'pointer' : 'grab'; return; }
    if (drag.gz) { drag.moved = true; rvGizmoDrag(drag, mx, my, e.ctrlKey || e.metaKey, e.shiftKey); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) { const k = RV.dist / c.clientHeight * 0.75, cy = Math.cos(RV.yaw), sy_ = Math.sin(RV.yaw), sp = Math.sin(RV.pitch), right = [-sy_, cy, 0], up = [-cy * sp, -sy_ * sp, Math.cos(RV.pitch)]; for (let i = 0; i < 3; i++) RV.tgt[i] += (-dx * right[i] + dy * up[i]) * k; }
    else if (drag.rot) camOrbit(RV, -dx * 0.008 * drag.sg, dy * 0.008, drag.P);
    else return;
    rvReq(); });
  const end = e => { if (drag && drag.gz) { if (drag.moved) rvGizmoEnd(drag); drag = null; return; }
    if (drag && e && e.button === 2 && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) { const d0 = drag; drag = null; c.style.cursor = 'grab'; cm3D(e, d0.mx, d0.my); return; }
    if (drag && e && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4 && drag.btn === 0) { const sh = rvPickShape(drag.mx, drag.my); if (sh) rvSelectShape(sh, e.shiftKey, drag.mx, drag.my); else { CTX3 = null; const id = rvPick(drag.mx, drag.my); if (id && !$('#tpWin').hidden) { tpRelPick(id); drag = null; return; } if (!id && S.sel.size && !e.shiftKey) { S.sel.clear(); renderSel(); dRefresh(); } if (id !== (S.relSel || null)) { if (id) selectRel(id); else { S.relSel = null; relPanel(); } } RELBAR = null; if (id) relBarShow('rv3', drag.mx, drag.my); draw(); rvSync(); rvReq(); } }
    drag = null; c.style.cursor = 'grab'; };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', () => { drag = null; });
  c.addEventListener('wheel', e => { e.preventDefault(); RV.touched = true; camZoom(RV, e, c, RV.mvp, Math.exp(e.deltaY * 0.0012), 5, 1e5); rvReq(); }, { passive: false });
  c.addEventListener('dblclick', () => rvFit(true));
  const cv = $('#rvcube'), pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointermove', e => { const h = v3CubeHit(...pos(e), RV), k = h ? h.k : null; if (k !== RV.cubeHover) { RV.cubeHover = k; v3Cube(cv, RV); } });
  cv.addEventListener('pointerleave', () => { RV.cubeHover = null; v3Cube(cv, RV); });
  cv.addEventListener('pointerdown', e => { e.stopPropagation(); const h = v3CubeHit(...pos(e), RV); if (h) v3AnimTo(h.yaw, h.pitch, RV, rvReq); });
  cv.addEventListener('dblclick', e => e.stopPropagation());
  new ResizeObserver(() => { if (!RV.touched && RV.fitted) rvFit(true); rvReq(); }).observe($('#rv3')); // tant qu'on n'a pas touché à la vue, elle reste cadrée quand la fenêtre change
  rvSave(); return true;
}
function rvFit(all) {
  const st = S.stock; let x0 = 0, y0 = 0, x1 = st.w, y1 = st.h;
  if (!all) { const sel = relCur(), its = sel ? [sel] : S.relief.items.filter(i => i.visible && relGrid[i.id]); if (its.length) { x0 = y0 = Infinity; x1 = y1 = -Infinity; for (const it of its) for (const q of imgFrame(it).corners) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } } }
  RV.tgt = [(x0 + x1) / 2, (y0 + y1) / 2, -st.t / 2]; RV.yaw = -Math.PI / 2 + 0.35; RV.pitch = 0.75; RV.touched = false;
  // recul calculé sur la boîte projetée et les proportions réelles de la vue (projection orthogonale) : tout le brut est visible, même vue étroite
  const c = $('#rvc'), asp = c && c.clientWidth > 10 && c.clientHeight > 10 ? c.clientWidth / c.clientHeight : 1.5, cy = Math.cos(RV.yaw), sy_ = Math.sin(RV.yaw), sp = Math.sin(RV.pitch), cp = Math.cos(RV.pitch), R3 = [-sy_, cy, 0], U3 = [-cy * sp, -sy_ * sp, cp];
  let ex = 0, ey = 0; for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [0, -st.t]) { const d = [x - RV.tgt[0], y - RV.tgt[1], z - RV.tgt[2]]; ex = Math.max(ex, Math.abs(d[0] * R3[0] + d[1] * R3[1])); ey = Math.max(ey, Math.abs(d[0] * U3[0] + d[1] * U3[1] + d[2] * U3[2])); }
  RV.dist = Math.max(10, Math.max(ey, ex / asp) * 1.06 / Math.tan(0.35)); rvReq();
}
function rvBuf(attrs, data, idx) { const gl = RV.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const stride = attrs.reduce((a, x) => a + x[1], 0) * 4; let off = 0; for (const [prog, n, name] of attrs) { const l = gl.getAttribLocation(prog, name); if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, stride, off); } off += n * 4; }
  if (idx) { const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); } gl.bindVertexArray(null); return vao; }
// reconstruit le maillage quand le relief ou le brut change, et les traits quand le dessin change
function rvSync() {
  if (!VIEWS.d3 || !RV.gl) return; const st = S.stock; relSyncLinks();
  const dr = RELDRAG, sig = JSON.stringify([st.w, st.h, st.t, S.relief.items.map(i => [i.id, dr && i.id === dr.id ? dr.x0 : i.x, dr && i.id === dr.id ? dr.y0 : i.y, i.w, i.h, i.rot, i.zH, dr && i.id === dr.id ? dr.t0 : i.top, i.rx, i.ry, i.mode, i.visible, i.smooth, i.invert, i.cut, relGid(relGrid[i.id]), relGrid[i.id] && relGrid[i.id].nx, relClipSig(i)])]);
  if (sig !== RV.sig) { const now = performance.now(), wait = Math.max(60, RV.cost || 0) - (now - (RV.lastEnd || 0)); if (RV.sig && wait > 0) { clearTimeout(RV.thT); RV.thT = setTimeout(() => { rvSync(); rvReq(); }, wait + 5); } else { RV.sig = sig; rvBuildMesh(); RV.lastEnd = performance.now(); RV.cost = RV.lastEnd - now; rvReq(); } } /* pendant une manipulation : maillage refait au plus une fois par intervalle */
  if (dr && !RV.dm) { const b = dr.q ? [80000, 150000, 250000][relLevel()] : 30000; RV.dm = { a: relOnly(i => i.id !== dr.id, () => rvMakeMesh(b)), b: relOnly(i => i.id === dr.id, () => rvMakeMesh(b)) }; rvReq(); } /* déplacement : deux maillages, l'élément déplacé est décalé à l'affichage */
  if (!RV.fitted && $('#rvc').clientWidth > 10) { rvFit(true); RV.fitted = true; }
  const lsig = JSON.stringify(wrapInfo()) + '|' + ((st.rotary || {}).z0 || '') + '|' + (typeof snapVer !== 'undefined' ? snapVer : 0) + '|' + st.w + '|' + st.h + '|' + st.t + '|' + st.originXY + '|' + S.shapes.length + '|' + [...S.sel].join(',') + '|' + S.tps.map(t => t.id + (t.visible ? 1 : 0) + (t.moves ? t.moves.length : 0) + (t.face || 1) + ':' + objId(t.moves) + ':' + objId(t.dmoves)).join(','); /* parcours recalculé avec le même nombre de mouvements : vu aussi */
  /* traits de la vue 3D : si leur construction est longue (gros dessin), on attend 0,25 s après la dernière modification */
  if (lsig !== RV.lsig) { if (RV.lsig && (RV.lnCost || 0) > 40 && !RV.lnGo) { clearTimeout(RV.lnT); RV.lnT = setTimeout(() => { RV.lnT = 0; RV.lnGo = true; try { rvSync(); } finally { RV.lnGo = false; } }, 250); } else { RV.lsig = lsig; const t0 = performance.now(); rvBuildLines(); RV.lnCost = performance.now() - t0; rvReq(); } }
}
function rvBuildMesh() {
  const gl = RV.gl; if (RV.mesh) gl.deleteVertexArray(RV.mesh.vao); RV.mesh = null; RV.depth = 0; clearTimeout(RV.fineT);
  if (!S.relief.items.some(i => i.visible && relGrid[i.id])) return;
  // grille d'affichage limitée à l'emprise des reliefs, assez fine pour un rendu lisse ; plus grossière pendant une manipulation, puis affinée à l'arrêt
  const now = performance.now(), rapid = now - (RV.lastBuild || 0) < 300; RV.lastBuild = now; if (rapid) RV.fineT = setTimeout(() => { RV.lastBuild = 0; rvBuildMesh(); rvReq(); }, 320);
  const m = rvMakeMesh(rapid ? 150000 : [200000, 700000, 1600000][relLevel()]); RV.hf = m ? m.R : null; if (m) { RV.mesh = m; RV.depth = m.depth; m.R = null; }
}
function rvMakeMesh(budget) {
  const gl = RV.gl; if (!S.relief.items.some(i => i.visible && relGrid[i.id])) return null;
  const st = S.stock, R = reliefCompose((w, h) => Math.max(0.02, Math.sqrt(w * h / budget)), true, null, true, true), { nx, ny, cx, cy, H, M, ox, oy } = R, N = nx * ny, vb = new Float32Array(N * 6);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = j * nx + i, z = Math.max(-st.t, H[q]), ir = i + 1 < nx && M[q + 1] ? i + 1 : i, il = i > 0 && M[q - 1] ? i - 1 : i, ju = j + 1 < ny && M[q + nx] ? j + 1 : j, jd = j > 0 && M[q - nx] ? j - 1 : j, hx = ir > il ? (H[j * nx + ir] - H[j * nx + il]) / ((ir - il) * cx) : 0, hy = ju > jd ? (H[ju * nx + i] - H[jd * nx + i]) / ((ju - jd) * cy) : 0, n = v3n([-hx, -hy, 1]); /* au bord : différence d'un seul côté (pas de liseré sombre en dents de scie) */ vb.set([ox + i * cx, oy + j * cy, z, n[0], n[1], n[2]], q * 6); }
  const CW = nx - 1, CH = ny - 1, has = new Uint8Array(CW * CH); let nt = 0;
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) { const a = j * nx + i, k = M[a] + M[a + 1] + M[a + nx + 1] + M[a + nx]; if (k >= 3) { has[j * CW + i] = k; nt += k === 4 ? 2 : 1; } } // 3 coins : un triangle (bord en diagonale au lieu d'escaliers)
  if (!nt) return null;
  const ix = new Uint32Array(nt * 6), zb = Math.max(-st.t, R.base), ex = []; let p = 0;
  const T = (u, v, w) => { ix[p++] = u; ix[p++] = v; ix[p++] = w; ix[p++] = N + u; ix[p++] = N + w; ix[p++] = N + v; }; // dessus et dessous (dessous à la base du relief)
  const bot = new Float32Array(N * 6); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) bot.set([ox + i * cx, oy + j * cy, zb, 0, 0, -1], (j * nx + i) * 6);
  const wix = []; let nv = 0, base = N * 2;
  const WL = [], NA = new Map(), acc = (v, x, y) => { const o = NA.get(v); if (o) { o[0] += x; o[1] += y; } else NA.set(v, [x, y]); };
  const wall = (a, b) => { const dx = ((b % nx) - (a % nx)) * cx, dy = (Math.floor(b / nx) - Math.floor(a / nx)) * cy, l = Math.hypot(dx, dy) || 1, x = dy / l, y = -dx / l; WL.push(a, b); acc(a, x, y); acc(b, x, y); }; // parois : normales moyennées aux sommets (rendu lisse, sans facettes)
  const hasC = (i, j) => i >= 0 && j >= 0 && i < CW && j < CH && has[j * CW + i];
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) { const k = has[j * CW + i]; if (!k) continue; const a = j * nx + i, b = a + 1, c = a + nx + 1, d = a + nx;
    if (k === 4) { T(a, b, c); T(a, c, d); }
    else if (!M[d]) { T(a, b, c); wall(c, a); } else if (!M[c]) { T(a, b, d); wall(b, d); } else if (!M[b]) { T(a, c, d); wall(a, c); } else { T(b, c, d); wall(d, b); }
    if (M[a] && M[b] && !hasC(i, j - 1)) wall(a, b); if (M[b] && M[c] && !hasC(i + 1, j)) wall(b, c); if (M[c] && M[d] && !hasC(i, j + 1)) wall(c, d); if (M[d] && M[a] && !hasC(i - 1, j)) wall(d, a); }
  // normale de paroi : opposée au gradient du masque flouté (flou gaussien approché par 3 flous de boîte, rayon ≈ 0,3 mm) ; lisse le long des bords en escalier, sans stries
  const BL = WL.length ? (() => { const r = Math.max(1, Math.min(24, Math.round(0.4 / Math.min(cx, cy)))), N2 = nx * ny, A = new Float32Array(N2), T = new Float32Array(Math.max(nx, ny)); for (let q = 0; q < N2; q++) A[q] = M[q];
    const pass = (n, cnt, idx) => { for (let l = 0; l < cnt; l++) { for (let it = 0; it < 3; it++) { let s = 0; for (let k = 0; k <= r && k < n; k++) s += A[idx(l, k)]; for (let k = 0; k < n; k++) { T[k] = s / (2 * r + 1); const ad = k + r + 1, rm = k - r; if (ad < n) s += A[idx(l, ad)]; if (rm >= 0) s -= A[idx(l, rm)]; } for (let k = 0; k < n; k++) A[idx(l, k)] = T[k]; } } };
    pass(nx, ny, (j, i) => j * nx + i); pass(ny, nx, (i, j) => j * nx + i); return A; })() : null, NC = new Map();
  const nrm = v => { const o0 = NC.get(v); if (o0) return o0; const vi = v % nx, vj = Math.floor(v / nx), at = (i, j) => BL[Math.max(0, Math.min(ny - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
    const gx = (at(vi + 1, vj) - at(vi - 1, vj)) / cx, gy = (at(vi, vj + 1) - at(vi, vj - 1)) / cy; let l = Math.hypot(gx, gy), out;
    if (l < 1e-9) { const o = NA.get(v); l = Math.hypot(o[0], o[1]) || 1; out = [o[0] / l, o[1] / l, 0, 0]; } else { const c0 = Math.min(cx, cy), d = Math.max(-c0, Math.min(c0, (at(vi, vj) - 0.5) / l)); out = [-gx / l, -gy / l, 0, d]; } NC.set(v, out); return out; };
  const XY = v => { const n = nrm(v); return [ox + (v % nx) * cx + n[0] * n[3], oy + Math.floor(v / nx) * cy + n[1] * n[3]]; }; /* bord recalé sur le contour lissé : plus d'escalier */
  for (let w = 0; w < WL.length; w += 2) { const a = WL[w], b = WL[w + 1], za = Math.max(-st.t, H[a]), zq = Math.max(-st.t, H[b]), A = XY(a), B = XY(b), na = nrm(a).slice(0, 3), nb = nrm(b).slice(0, 3), k = base + nv; ex.push(A[0], A[1], za, ...na, B[0], B[1], zq, ...nb, B[0], B[1], zb, ...nb, A[0], A[1], zb, ...na); nv += 4; wix.push(k, k + 1, k + 2, k, k + 2, k + 3); }
  for (const v of NC.keys()) { const p = XY(v); vb[v * 6] = bot[v * 6] = p[0]; vb[v * 6 + 1] = bot[v * 6 + 1] = p[1]; } /* sommets du dessus et du dessous suivent le bord recalé */
  const all = new Float32Array(N * 12 + ex.length); all.set(vb, 0); all.set(bot, N * 6); all.set(ex, N * 12);
  const idx = new Uint32Array(ix.length + wix.length); idx.set(ix, 0); idx.set(wix, ix.length);
  return { vao: rvBuf([[RV.prog, 3, 'aP'], [RV.prog, 3, 'aN']], all, idx), n: idx.length, depth: -R.min, R };
}
function rvBuildLines() {
  const gl = RV.gl, st = S.stock;
  /* traits des parcours : refaits seulement si un parcours, sa visibilité, le brut, l'enroulement ou les couleurs changent (pas à chaque retouche du dessin) */
  const tsig = S.tps.map(tp => [tp.id, tp.visible ? 1 : 0, tp.err ? 1 : 0, tp.face || 1, tp.type, objId(tp.moves), objId(tp.dmoves)].join(':')).join(',') + '|' + st.t + '|' + JSON.stringify(wrapInfo()) + '|' + ['--muted', '--pf', '--pk', '--vc', '--dr', '--th', '--rl'].map(tok).join(',') + '|' + objId(gl), keepTp = RV.lTp !== undefined && RV.tsig === tsig;
  for (const k of ['lStock', 'lAxes', 'lDraw', 'lTp']) if (RV[k] && !(k === 'lTp' && keepTp)) gl.deleteVertexArray(RV[k].vao);
  const mk = (segs0) => { const segs = wrapSegs(segs0, 6); const d = new Float32Array(segs.length * 6); segs.forEach((v, k) => d.set(v, k * 6)); return segs.length ? { vao: rvBuf([[RV.lprog, 3, 'aP'], [RV.lprog, 3, 'aC']], d), n: segs.length } : null; };
  const g = hex3(tok('--muted')), P = [[0, 0], [st.w, 0], [st.w, st.h], [0, st.h]], S2 = [];
  for (let k = 0; k < 4; k++) { const a = P[k], b = P[(k + 1) % 4]; for (const z of [0, -st.t]) S2.push([a[0], a[1], z, ...g], [b[0], b[1], z, ...g]); S2.push([a[0], a[1], 0, ...g], [a[0], a[1], -st.t, ...g]); }
  RV.lStock = mk(S2);
  const RT = st.rotary || {}, [ox, oy] = originOf(st), oz = RT.on ? (RT.z0 === 'axis' ? -st.t / 2 : 0) : st.originZ === 'bottom' ? -st.t : 0, L = Math.max(st.w, st.h) * 0.12, A2 = [];
  const O3 = wrapInfo() ? wrapPt([ox, oy, oz]) : [ox, oy, oz]; // vue enroulée : le repère est placé dans l'espace réel (sur l'axe du cylindre si le zéro Z y est)
  for (const [d, c] of [[[1, 0, 0], [0.9, 0.28, 0.3]], [[0, 1, 0], [0.19, 0.64, 0.42]], [[0, 0, 1], [0.24, 0.48, 0.98]]]) A2.push([...O3, ...c], [O3[0] + d[0] * L, O3[1] + d[1] * L, O3[2] + d[2] * L, ...c]);
  { const d = new Float32Array(A2.length * 6); A2.forEach((v, k) => d.set(v, k * 6)); RV.lAxes = { vao: rvBuf([[RV.lprog, 3, 'aP'], [RV.lprog, 3, 'aC']], d), n: A2.length, flat: true }; }
  const dc0 = hex3(tok('--draw')), ac = hex3(tok('--accent')), D2 = []; for (const sh of S.shapes) { if (typeof shown === 'function' && !shown(sh)) continue; const a = sh.pts || [], on = S.sel.has(sh.id), dc = on ? ac : dc0, z = on ? 0.06 : 0.02; for (let k = 0; k + 1 < a.length; k++) D2.push([a[k][0], a[k][1], z, ...dc], [a[k + 1][0], a[k + 1][1], z, ...dc]); if (sh.closed && a.length > 2) D2.push([a[a.length - 1][0], a[a.length - 1][1], z, ...dc], [a[0][0], a[0][1], z, ...dc]); }
  RV.lDraw = mk(D2);
  // parcours d'outils visibles : passes en couleur du type, déplacements rapides en gris
  if (keepTp) return; RV.tsig = tsig;
  const col = { profile: hex3(tok('--pf')), pocket: hex3(tok('--pk')), vcarve: hex3(tok('--vc')), drill: hex3(tok('--dr')), thread: hex3(tok('--th')), relief: hex3(tok('--rl')) }, rg = g.map(v => v * 0.8), ce = hex3(tok('--warn')), T2 = [];
  for (const tp of S.tps) { if (!tp.visible || tp.err) continue; const f2 = tp.face === 2, mv = f2 && tp.dmoves ? tp.dmoves : tp.moves; if (!mv) continue; const c = col[tp.type] || [0.3, 0.5, 1]; let pr = null;
    for (const m of mv) { if (typeof m.x !== 'number' || (m.g !== 0 && m.g !== 1)) continue; const q = [m.x, m.y, f2 ? -st.t - m.z : m.z]; if (pr) { const cc = m.g === 0 ? rg : m.e ? ce : c; T2.push([...pr, ...cc], [...q, ...cc]); } pr = q; } }
  RV.lTp = mk(T2);
}
function rvReq() { if (!RV.raf && VIEWS.d3) RV.raf = requestAnimationFrame(rvRender); }
// parcours mis en avant (survolé dans la liste, ou en cours d'édition) : affiché même si « Parcours » est décoché
function rvFocusTp() { const w = $('#tpWin'), id = RV.hoverTp || (w && !w.hidden && S.editTp) || null; return id ? S.tps.find(t => t.id === id && !t.err) || null : null; }
function rvFocusSync() {
  const tp = rvFocusTp(), sig = tp ? tp.id + '|' + (tp.moves ? tp.moves.length : 0) + '|' + (tp.face || 1) + '|' + S.stock.t + '|' + JSON.stringify(wrapInfo()) : '';
  if (sig === RV.fsig) return; RV.fsig = sig; const gl = RV.gl; if (RV.lTpX) { gl.deleteVertexArray(RV.lTpX.vao); RV.lTpX = null; } if (!tp) return;
  const st = S.stock, f2 = tp.face === 2, mv = f2 && tp.dmoves ? tp.dmoves : tp.moves; if (!mv) return;
  const c = hex3(tok({ profile: '--pf', pocket: '--pk', vcarve: '--vc', drill: '--dr', thread: '--th', relief: '--rl' }[tp.type] || '--accent')), rg = hex3(tok('--muted')).map(v => v * 0.8), ce = hex3(tok('--warn')), T = []; let pr = null;
  for (const m of mv) { if (typeof m.x !== 'number' || (m.g !== 0 && m.g !== 1)) continue; const q = [m.x, m.y, f2 ? -st.t - m.z : m.z]; if (pr) { const cc = m.g === 0 ? rg : m.e ? ce : c; T.push([...pr, ...cc], [...q, ...cc]); } pr = q; }
  if (!T.length) return; const T2 = wrapSegs(T, 6), d = new Float32Array(T2.length * 6); T2.forEach((v, k) => d.set(v, k * 6)); RV.lTpX = { vao: rvBuf([[RV.lprog, 3, 'aP'], [RV.lprog, 3, 'aC']], d), n: T.length };
}
// ----- sélection et transformations dans la vue 3D -----
function rvToolsSync() { for (const [k, t] of [['rvMove', 'move'], ['rvRotate', 'rotate'], ['rvScale', 'scale']]) { const b = document.querySelector('[data-act="' + k + '"]'); if (b) b.setAttribute('aria-pressed', RV.tool === t); } }
function rvProj(p) { const m = RV.mvp, c = $('#rvc'); if (!m) return [0, 0, -1]; p = wrapPt(p); const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [(x / w * 0.5 + 0.5) * c.clientWidth, (1 - (y / w * 0.5 + 0.5)) * c.clientHeight, w]; }
function rvOrbitBox() { const st = S.stock, RT = st.rotary || {}, [ox, oy] = originOf(st), oz = RT.on ? (RT.z0 === 'axis' ? -st.t / 2 : 0) : st.originZ === 'bottom' ? -st.t : 0, W = wrapInfo(); return { planes: !W, x0: 0, x1: st.w, y0: 0, y1: st.h, z0: -st.t, z1: 0, org: W ? wrapPt([ox, oy, oz]) : [ox, oy, oz] }; }
function rvEye() { const cp = Math.cos(RV.pitch); return [RV.tgt[0] + RV.dist * cp * Math.cos(RV.yaw), RV.tgt[1] + RV.dist * cp * Math.sin(RV.yaw), RV.tgt[2] + RV.dist * Math.sin(RV.pitch)]; }
function rvRay(mx, my) { const c = $('#rvc'), e = rvEye(), f = v3n(v3sub(RV.tgt, e)), rt = [-Math.sin(RV.yaw), Math.cos(RV.yaw), 0], up = v3cross(rt, f), hh = RV.dist * Math.tan(0.35), a = c.clientWidth / c.clientHeight, u = (mx / c.clientWidth * 2 - 1) * hh * a, v = (1 - my / c.clientHeight * 2) * hh; return { o: [e[0] + rt[0] * u + up[0] * v - f[0] * RV.dist * 10, e[1] + rt[1] * u + up[1] * v - f[1] * RV.dist * 10, e[2] + rt[2] * u + up[2] * v - f[2] * RV.dist * 10], d: f }; }
const rvZ = it => { const top = -(+it.top || 0); return { top, bot: top - (+it.zH || 0), mid: top - (+it.zH || 0) / 2 }; };
// élément sous le curseur : intersection du rayon avec la boîte de chaque élément (dans son repère tourné)
// vecteur du dessin le plus proche du clic dans la vue 3D (lignes posées sur le dessus du brut)
function rvPickShape(mx, my) {
  if (!RV.showDraw || !RV.mvp) return null; let best = null, bd = 7;
  for (const sh of S.shapes) { if ((typeof shown === 'function' && !shown(sh)) || (typeof editable === 'function' && !editable(sh))) continue; const a = sh.pts || []; if (a.length < 2) continue;
    const n = sh.closed ? a.length : a.length - 1; let pa = rvProj([a[0][0], a[0][1], 0.02]);
    for (let k = 0; k < n; k++) { const b = a[(k + 1) % a.length], pb = rvProj([b[0], b[1], 0.02]); if (pa[2] > 0 && pb[2] > 0) { const vx = pb[0] - pa[0], vy = pb[1] - pa[1], L = vx * vx + vy * vy, t = L ? Math.max(0, Math.min(1, ((mx - pa[0]) * vx + (my - pa[1]) * vy) / L)) : 0, d = Math.hypot(mx - pa[0] - vx * t, my - pa[1] - vy * t); if (d < bd) { bd = d; best = sh; } } pa = pb; } }
  return best;
}
function rvSelectShape(sh, add, mx, my) {
  if (S.imgSel) { S.imgSel = null; renderImgPanel(); } if (S.relSel) { S.relSel = null; RXF = false; relPanel(); } S.selDim = null;
  const ids = groupIds(sh); if (add) { const has = S.sel.has(sh.id); ids.forEach(id => has ? S.sel.delete(id) : S.sel.add(id)); } else { S.sel.clear(); ids.forEach(id => S.sel.add(id)); }
  CTX3 = mx != null && S.sel.size ? { x: mx, y: my, ids: [...S.sel] } : null;
  renderSel(); dRefresh(); draw(); rvSync(); rvReq();
}
// profondeur d'un profil autour de reliefs : jusqu'au bas du relief le plus profond (sans dépasser l'épaisseur du brut)
function tpRelDepth(ids) { let d = 0; for (const id of ids) { const it = S.relief.items.find(x => x.id === id); if (it) d = Math.max(d, (+it.top || 0) + (+it.zH || 0)); } return d > 0 ? +Math.min(d, S.stock.t).toFixed(2) : 0; }
// parcours en cours de réglage : un clic sur un relief l'ajoute (profil autour de son contour) ou le retire
function tpRelPick(id) {
  const F = S.form || {}, it = S.relief.items.find(x => x.id === id); if (!it) return;
  if (F.type !== 'profile') { toast(F.type === 'relief' ? tr('L’usinage de relief utilise tous les reliefs visibles : inutile de sélectionner le relief.') : tr('Un relief se choisit pour un parcours Profil : la fraise suit son contour. Pour projeter ce parcours sur le relief, cochez « Projeter sur le relief ».')); return; }
  S.tpRels = S.tpRels || new Set(); const on = !S.tpRels.has(id); on ? S.tpRels.add(id) : S.tpRels.delete(id);
  if (on && !relOutLoops(it).length) { S.tpRels.delete(id); toast(tr('Ce relief n’a pas d’emprise sur le brut.')); return; }
  const dep = on ? tpRelDepth(S.tpRels) : 0; if (dep) F.depth = dep;
  tpSelInfo(); renderForm(); draw(); if (typeof rvReq === 'function') rvReq();
  toast(on ? trf('Relief « {n} » choisi : le profil suivra son contour. Cliquez « {b} ».', { n: it.name, b: $('#tpApply').textContent }) + (dep ? ' ' + trf('Profondeur réglée sur le bas du relief : {d} mm.', { d: fr(dep, 2) }) : '') : trf('Relief « {n} » retiré du parcours.', { n: it.name }));
}
function rvPick(mx, my) { // relief touché par le rayon du pointeur : dessus, flancs ou fond (premier rencontré)
  const R = rvRay(mx, my), its = S.relief.items.filter(it => it.visible && relGrid[it.id]); if (!its.length) return null;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity; const Zs = new Map();
  for (const it of its) { const Z = rvZ(it); Zs.set(it.id, Z); for (const c of imgFrame(it).corners) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } z0 = Math.min(z0, Z.bot); z1 = Math.max(z1, Z.top); }
  let ta = -Infinity, tb = Infinity; const lo = [x0 - 1, y0 - 1, z0 - 1], hi = [x1 + 1, y1 + 1, z1 + 1];
  for (let k = 0; k < 3; k++) { if (Math.abs(R.d[k]) < 1e-12) { if (R.o[k] < lo[k] || R.o[k] > hi[k]) return null; continue; } let a = (lo[k] - R.o[k]) / R.d[k], b = (hi[k] - R.o[k]) / R.d[k]; if (a > b) [a, b] = [b, a]; ta = Math.max(ta, a); tb = Math.min(tb, b); }
  if (!(tb > ta)) return null; const N = 500, tol = Math.max(1.5, Math.max(S.stock.w, S.stock.h) / 150);
  for (let n = 0; n <= N; n++) { const t = ta + (tb - ta) * n / N, q = [R.o[0] + R.d[0] * t, R.o[1] + R.d[1] * t, R.o[2] + R.d[2] * t]; let best = null, ba = Infinity;
    for (const it of its) { const Z = Zs.get(it.id); if (q[2] > Z.top + 0.5 || q[2] < Z.bot - 0.5) continue; const l = imgLocal(it, q); if (Math.abs(l[0]) > it.w / 2 || Math.abs(l[1]) > it.h / 2) continue; if (!relNear(it, l[0], l[1], tol)) continue; const a = it.w * it.h; if (a < ba) { ba = a; best = it.id; } }
    if (best) return best; }
  return null;
}
// géométrie des poignées de l'élément sélectionné (en pixels), calculée à chaque rendu
function rvGizmo() { if (wrapInfo()) return null; /* vue enroulée : pas de poignées (elles agissent sur le relief à plat) */
  const it = relCur(); if (!it || !RV.tool || !it.visible || !RV.mvp) return null; const Z = rvZ(it), c = [it.x, it.y, Z.mid], L = Math.max(it.w, it.h) * 0.6 + 6, G = { it, c, L, items: [] };
  if (RV.tool === 'move') for (const [k, d, col] of [['x', [1, 0, 0], '#e5484d'], ['y', [0, 1, 0], '#30a46c'], ['z', [0, 0, 1], '#3e7bfa']]) G.items.push({ k, type: 'axis', d, col, a: rvProj(c), b: rvProj([c[0] + d[0] * L, c[1] + d[1] * L, c[2] + d[2] * L]) });
  if (RV.tool === 'rotate') { const stl = it.kind === 'stl'; for (const [k, ax, col] of [['rz', 2, '#3e7bfa'], ['rx', 0, '#e5484d'], ['ry', 1, '#30a46c']]) { if (ax !== 2 && !stl) continue; const pts = []; for (let i = 0; i <= 64; i++) { const t = i / 64 * 2 * Math.PI, u = Math.cos(t) * L * 0.8, v = Math.sin(t) * L * 0.8, q = ax === 2 ? [c[0] + u, c[1] + v, c[2]] : ax === 0 ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1], c[2] + v]; pts.push(rvProj(q)); } G.items.push({ k, type: 'ring', ax, col, pts }); } }
  if (RV.tool === 'scale') { const f = imgFrame(it), cs = f.corners, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], hs = [[cs[0], 'c0'], [cs[1], 'c1'], [cs[2], 'c2'], [cs[3], 'c3'], [mid(cs[0], cs[1]), 'e0'], [mid(cs[1], cs[2]), 'e1'], [mid(cs[2], cs[3]), 'e2'], [mid(cs[3], cs[0]), 'e3']];
    for (const [q, k] of hs) G.items.push({ k, type: 'handle', w: [q[0], q[1], Z.top], p: rvProj([q[0], q[1], Z.top]), col: '#ffffff' });
    G.items.push({ k: 'hz', type: 'handle', w: [it.x, it.y, Z.top], p: rvProj([it.x, it.y, Z.top]), col: '#3e7bfa', zAxis: rvProj([it.x, it.y, Z.top + 10]) }); }
  return G;
}
function rvGizmoHit(mx, my) {
  const G = rvGizmo(); if (!G) return null; const dseg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
  let best = null, bd = 9; for (const g of G.items) { let d = Infinity; if (g.type === 'axis') d = dseg([mx, my], g.a, g.b); else if (g.type === 'ring') for (let i = 0; i + 1 < g.pts.length; i++) d = Math.min(d, dseg([mx, my], g.pts[i], g.pts[i + 1])); else { const q = g.k === 'hz' ? g.zAxis : g.p; d = Math.hypot(mx - q[0], my - q[1]) - 2; } if (d < bd) { bd = d; best = g; } }
  return best ? { ...best, G } : null;
}
function snapPx(G, px) { const a = rvProj(G.c), b = rvProj([G.c[0] + G.L, G.c[1], G.c[2]]), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return Math.max(0.5, px * G.L / l); } // distance d'accroche en mm pour px pixels
function rvSnapIt(it) { return it ? { x: it.x, y: it.y, w: it.w, h: it.h, rot: it.rot || 0, top: +it.top || 0, zH: +it.zH || 0, rx: +it.rx || 0, ry: +it.ry || 0 } : null; }
function rvPlane(mx, my, z) { const R = rvRay(mx, my); if (Math.abs(R.d[2]) < 1e-9) return null; const t = (z - R.o[2]) / R.d[2]; return t > 0 ? [R.o[0] + R.d[0] * t, R.o[1] + R.d[1] * t] : null; }
function rvGizmoDrag(D, mx, my, shift, free) { // shift = pas (Ctrl), free = proportions libres (Maj)
  const it = D.it, g = D.gz, s0 = D.st; if (!it) return; const st = S.stock, rnd = v => shift ? Math.round(v) : v, snapT = snapPx(g.G, 12);
  if (g.type === 'axis') { relDragBegin(it); const a = g.a, b = g.b, ax = [b[0] - a[0], b[1] - a[1]], l2 = ax[0] * ax[0] + ax[1] * ax[1] || 1, t = ((mx - D.mx) * ax[0] + (my - D.my) * ax[1]) / l2 * g.G.L;
    if (g.k === 'z') { let top = s0.top - t; if (shift) top = Math.round(top); if (Math.abs(top) < snapT) top = 0; if (Math.abs(st.t - top - it.zH) < snapT) top = st.t - it.zH; it.top = top; }
    else { const k = g.k === 'x' ? 0 : 1; let v = (k ? s0.y : s0.x) + t; if (shift) v = Math.round(v); if (k) it.y = v; else it.x = v; const b2 = relBox(it); // accroche aux bords du brut
      if (!k) { if (Math.abs(b2.x0) < snapT) it.x -= b2.x0; else if (Math.abs(b2.x1 - st.w) < snapT) it.x -= b2.x1 - st.w; } else { if (Math.abs(b2.y0) < snapT) it.y -= b2.y0; else if (Math.abs(b2.y1 - st.h) < snapT) it.y -= b2.y1 - st.h; } } }
  else if (g.type === 'ring') { const c = rvProj(g.G.c), a0 = Math.atan2(D.my - c[1], D.mx - c[0]), a1 = Math.atan2(my - c[1], mx - c[0]), axis = [0, 0, 0]; axis[g.ax] = 1; const e = v3sub(rvEye(), g.G.c), facing = v3dot(axis, e) > 0; let dA = (a1 - a0) * 180 / Math.PI * (facing ? -1 : 1);
    const key = g.k === 'rz' ? 'rot' : g.k; let v = s0[key] + dA; if (shift) { const q = free ? 1 : 15; v = Math.round(v / q) * q; } v = ((v % 360) + 540) % 360 - 180; it[key] = v;
    if (g.k !== 'rz') { const now = performance.now(); if (!D.tR || now - D.tR > 150) { D.tR = now; rvReraster(it, false); } } }
  else if (g.k === 'hz') { const ax = [g.zAxis[0] - g.p[0], g.zAxis[1] - g.p[1]], l2 = ax[0] * ax[0] + ax[1] * ax[1] || 1, t = ((mx - D.mx) * ax[0] + (my - D.my) * ax[1]) / l2 * 10, bot = s0.top + s0.zH; let top = s0.top - t; if (shift) top = Math.round(top); if (Math.abs(top) < snapPx(g.G, 10)) top = 0; top = Math.min(top, bot - 0.1); it.top = top; it.zH = bot - top; }
  else { const q = rvPlane(mx, my, rvZ(it).top); if (!q) return; const a = (s0.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), sg = { c0: [-1, -1], c1: [1, -1], c2: [1, 1], c3: [-1, 1], e0: [0, -1], e1: [1, 0], e2: [0, 1], e3: [-1, 0] }[g.k];
    const anc = [s0.x - (sg[0] * s0.w / 2) * cs + (sg[1] * s0.h / 2) * sn, s0.y - (sg[0] * s0.w / 2) * sn - (sg[1] * s0.h / 2) * cs], d = [q[0] - anc[0], q[1] - anc[1]], lu = d[0] * cs + d[1] * sn, lv = -d[0] * sn + d[1] * cs;
    let w = sg[0] ? Math.max(0.5, lu * sg[0]) : s0.w, h = sg[1] ? Math.max(0.5, lv * sg[1]) : s0.h; const lock = !$('#rlLock') || $('#rlLock').checked;
    if (lock && sg[0] && sg[1] && !free) { let k = Math.max(w / s0.w, h / s0.h); if (shift) { const big = Math.max(s0.w, s0.h); k = Math.max(1, Math.round(big * k)) / big; } w = s0.w * k; h = s0.h * k; it.zH = s0.zH * k; } // coins : proportions gardées (Ctrl : la plus grande dimension au mm près ; Maj : libre) ; côtés : une seule dimension
    else if (shift) { w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); }
    it.w = w; it.h = h; const ox = (sg[0] || 0) * w / 2, oy = (sg[1] || 0) * h / 2; it.x = anc[0] + ox * cs - oy * sn; it.y = anc[1] + ox * sn + oy * cs; if (!sg[0]) { it.x = s0.x + (it.x - s0.x); } }
  relAfterXf(it, false);
}
function rvReraster(it, final) { const T = relMesh[it.id]; if (!T || it.kind !== 'stl') return; const R = stlRaster(T, it.orient || 'z', it.rx, it.ry), k = it.w / (it.nat ? it.nat[0] : R.W), kz = (+it.zH || 0) / (it.nat ? it.nat[2] : R.Z); it.nat = [R.W, R.H, R.Z]; it.w = R.W * k; it.h = R.H * k; it.zH = R.Z * kz; if (final) relStore(it.id, R.g); else { relGrid[it.id] = R.g; relSm.delete(it.id); } }
function rvGizmoEnd(D) { const it = D.it; if (!it) return; relDragEnd(); if (D.gz.type === 'ring' && D.gz.k !== 'rz') rvReraster(it, true); relAfterXf(it, true); }
// après une transformation : image liée, panneau, 2D, 3D, historique
function relAfterXf(it, done) { const im = relLinked(it); if (im) { im.x = it.x; im.y = it.y; im.w = it.w; im.h = it.h; im.rot = it.rot || 0; } relDirty = true; relPanel(true); draw(); rvReq(); if (done) { relBump(); commit(false); relPanel(); } }
function rvOverlay() {
  const cv = $('#rvov'), dpr = window.devicePixelRatio || 1, W2 = cv.clientWidth, H2 = cv.clientHeight; if (cv.width !== Math.round(W2 * dpr) || cv.height !== Math.round(H2 * dpr)) { cv.width = Math.round(W2 * dpr); cv.height = Math.round(H2 * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W2, H2); const it = relCur();
  // élément sélectionné : coins de la boîte englobante
  if (it && it.visible && RV.mvp) { const Z = rvZ(it), cs = imgFrame(it).corners; g.strokeStyle = tok('--accent'); g.lineWidth = 2;
    for (const z of [Z.top, Z.bot]) for (let k = 0; k < 4; k++) { const a = cs[k], b = cs[(k + 1) % 4], pr = cs[(k + 3) % 4], P = rvProj([a[0], a[1], z]), A = rvProj([a[0] + (b[0] - a[0]) * 0.18, a[1] + (b[1] - a[1]) * 0.18, z]), B = rvProj([a[0] + (pr[0] - a[0]) * 0.18, a[1] + (pr[1] - a[1]) * 0.18, z]), V = rvProj([a[0], a[1], z === Z.top ? z - (Z.top - Z.bot) * 0.25 : z + (Z.top - Z.bot) * 0.25]); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(P[0], P[1]); g.lineTo(B[0], B[1]); g.moveTo(P[0], P[1]); g.lineTo(V[0], V[1]); g.stroke(); } }
  const G = rvGizmo(); if (G) for (const q of G.items) { const hv = RV.hover === q.k; g.strokeStyle = q.col; g.fillStyle = q.col; g.lineWidth = hv ? 4 : 2.5;
    if (q.type === 'axis') { g.beginPath(); g.moveTo(q.a[0], q.a[1]); g.lineTo(q.b[0], q.b[1]); g.stroke(); const an = Math.atan2(q.b[1] - q.a[1], q.b[0] - q.a[0]); g.beginPath(); g.moveTo(q.b[0] + Math.cos(an) * 10, q.b[1] + Math.sin(an) * 10); g.lineTo(q.b[0] + Math.cos(an + 2.5) * 9, q.b[1] + Math.sin(an + 2.5) * 9); g.lineTo(q.b[0] + Math.cos(an - 2.5) * 9, q.b[1] + Math.sin(an - 2.5) * 9); g.closePath(); g.fill(); g.font = '700 12px sans-serif'; g.fillText(q.k.toUpperCase(), q.b[0] + Math.cos(an) * 16 - 4, q.b[1] + Math.sin(an) * 16 + 4); }
    else if (q.type === 'ring') { g.beginPath(); q.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
    else { g.fillStyle = q.col; g.strokeStyle = '#1b1b1b'; g.lineWidth = 1.5; const r = hv ? 7 : 5; if (q.k === 'hz') { g.beginPath(); g.moveTo(q.p[0], q.p[1]); g.lineTo(q.zAxis[0], q.zAxis[1]); g.strokeStyle = q.col; g.lineWidth = 2; g.stroke(); g.beginPath(); g.arc(q.zAxis[0], q.zAxis[1], r, 0, 7); g.fill(); } else { g.fillRect(q.p[0] - r, q.p[1] - r, 2 * r, 2 * r); g.strokeRect(q.p[0] - r, q.p[1] - r, 2 * r, 2 * r); } } }
  // infos (coin haut gauche)
  const el = $('#rvInfo'); if (it) { const Z = rvZ(it), o = outXY(it.x, it.y), f = v => fr(v, 2); el.textContent = it.name + '\n' + 'X ' + f(o[0]) + '  Y ' + f(o[1]) + '  ' + tr('(centre)') + '\n' + tr('Taille') + ' ' + f(it.w) + ' × ' + f(it.h) + ' × ' + f(+it.zH || 0) + ' mm\n' + tr('Haut brut → haut relief') + ' ' + f(+it.top || 0) + ' mm\n' + tr('Bas brut → bas relief') + ' ' + f(S.stock.t - (+it.top || 0) - (+it.zH || 0)) + ' mm\n' + tr('Rotation') + ' Z ' + fr(+it.rot || 0, 1) + '°' + (it.kind === 'stl' ? '  X ' + fr(+it.rx || 0, 1) + '°  Y ' + fr(+it.ry || 0, 1) + '°' : ''); }
  const dis = !it; document.querySelectorAll('.rvxf button').forEach(b => b.disabled = dis);
}
function rvRender() {
  RV.raf = 0; const gl = RV.gl, c = $('#rvc'); if (!gl || !VIEWS.d3) return;
  const dpr = window.devicePixelRatio || 1, Wd = Math.max(1, Math.round(c.clientWidth * dpr)), Hd = Math.max(1, Math.round(c.clientHeight * dpr)); if (c.width !== Wd || c.height !== Hd) { c.width = Wd; c.height = Hd; }
  gl.viewport(0, 0, Wd, Hd); const bg = hex3(tok('--canvas3d') || tok('--canvas')); gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const cp = Math.cos(RV.pitch), e = [RV.tgt[0] + RV.dist * cp * Math.cos(RV.yaw), RV.tgt[1] + RV.dist * cp * Math.sin(RV.yaw), RV.tgt[2] + RV.dist * Math.sin(RV.pitch)];
  const hh = RV.dist * Math.tan(0.35), hw = hh * Wd / Hd, fa = RV.dist * 20, ortho = [1 / hw, 0, 0, 0, 0, 1 / hh, 0, 0, 0, 0, -2 / (2 * fa), 0, 0, 0, 0, 1]; // projection orthogonale (pas d'effet de perspective)
  const mvp = m4mul(ortho, m4look(e, RV.tgt, camUp(RV))); RV.mvp = mvp;
  if (RV.mesh || RV.dm) { gl.useProgram(RV.prog); wrapU(gl, RV.prog); gl.uniformMatrix4fv(gl.getUniformLocation(RV.prog, 'uMVP'), false, mvp); gl.uniform3fv(gl.getUniformLocation(RV.prog, 'uL'), v3n([0.35, -0.55, 0.85])); gl.uniform3fv(gl.getUniformLocation(RV.prog, 'uC'), mat3d().top); const uO = gl.getUniformLocation(RV.prog, 'uOff'), dr = RELDRAG && RV.dm, dit = dr && S.relief.items.find(i => i.id === RELDRAG.id); for (const [m, o] of dr ? [[RV.dm.a, [0, 0, 0]], [RV.dm.b, dit ? [dit.x - RELDRAG.x0, dit.y - RELDRAG.y0, RELDRAG.t0 - (+dit.top || 0)] : [0, 0, 0]]] : [[RV.mesh, [0, 0, 0]]]) { if (!m) continue; gl.uniform3fv(uO, o); gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0); } gl.uniform3fv(uO, [0, 0, 0]); gl.bindVertexArray(null); }
  gl.useProgram(RV.lprog); wrapU(gl, RV.lprog); gl.uniformMatrix4fv(gl.getUniformLocation(RV.lprog, 'uMVP'), false, mvp);
  rvFocusSync(); for (const [k, on] of [['lStock', RV.showStock], ['lAxes', RV.showAxes], ['lDraw', RV.showDraw], ['lTp', RV.showTp], ['lTpX', !RV.showTp || !(rvFocusTp() || {}).visible]]) if (on && RV[k]) { if (RV[k].flat) gl.uniform4f(gl.getUniformLocation(RV.lprog, 'uWrap'), 0, 0, 0, 1); gl.bindVertexArray(RV[k].vao); gl.drawArrays(gl.LINES, 0, RV[k].n); if (RV[k].flat) wrapU(gl, RV.lprog); }
  gl.bindVertexArray(null); v3Cube($('#rvcube'), RV);
  const n = S.relief.items.filter(i => i.visible && relGrid[i.id]).length; if (!relCur()) $('#rvInfo').textContent = n ? trf('{n} élément(s) de relief · profondeur {d} mm', { n, d: fr(RV.depth || 0, 2) }) : tr('Aucun relief : importez un STL ou créez-en un dans l’onglet Relief.');
  rvOverlay();
}
// aperçu 3D du relief seul : le brut est creusé depuis le dessus, le point le plus haut à la surface
function relView3d() {
  if (!S.relief.items.some(i => i.visible && relGrid[i.id])) { toast(tr('Aucun relief à afficher.')); return; }
  v3HelpSync(); $('#v3d').hidden = false; if (!v3Init()) { $('#v3d').hidden = true; toast('L’aperçu 3D demande WebGL 2, absent de ce navigateur. Essayez Chrome, Edge ou Firefox récents.'); return; }
  const st = S.stock, t0 = performance.now(), cell = Math.max(+S.relief.res || 0.3, Math.sqrt(st.w * st.h / 1200000)), R = reliefCompose(cell), H = R.H;
  for (let i = 0; i < H.length; i++) H[i] = Math.max(-st.t - 0.01, Math.min(0, H[i]));
  const B = new Float32Array(R.nx * R.ny); B.fill(-st.t);
  V3.S3 = { w: st.w, h: st.h, t: st.t, nx: R.nx, ny: R.ny, cx: R.cx, cy: R.cy, H, B, floor: -st.t - 0.01, segs: [], cum: [], thr: [], total: 0, idx: 0, frac: 0, has2: false, relief: true };
  V3.toolMesh.clear(); $('#v3OneRow').hidden = true; $('#v3Show').value = 'stock'; v3BuildMesh(); v3BuildPaths(); v3BuildThreads(); v3ResetView(); V3.T = 0; V3.cur = null; V3.dirty = true; v3Play(false); v3Ui(); v3Req();
  $('#v3Info').textContent = tr('Relief') + ' · ' + R.nx + ' × ' + R.ny + ' points · ' + fr(R.cx, 2) + ' mm · ' + Math.round(performance.now() - t0) + ' ms';
}
