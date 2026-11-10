// ---------- post-processeurs au format .pp (syntaxe des fichiers Vectric) ----------
const VP_BLOCKS = ['HEADER', 'FOOTER', 'TOOLCHANGE', 'NEW_SEGMENT', 'RAPID_MOVE', 'FIRST_RAPID_MOVE', 'INITIAL_RAPID_MOVE', 'FIRST_FEED_MOVE', 'FEED_MOVE', 'PLUNGE_MOVE', 'RETRACT_MOVE', 'CW_ARC_MOVE', 'CCW_ARC_MOVE', 'FIRST_CW_ARC_MOVE', 'FIRST_CCW_ARC_MOVE', 'FEED_RATE_CHANGE', 'CW_HELICAL_ARC_MOVE', 'CCW_HELICAL_ARC_MOVE', 'FIRST_CW_HELICAL_ARC_MOVE', 'FIRST_CCW_HELICAL_ARC_MOVE', 'PLUNGE_CW_HELICAL_ARC_MOVE', 'PLUNGE_CCW_HELICAL_ARC_MOVE', 'DWELL_MOVE', 'JET_TOOL_ON', 'JET_TOOL_OFF', 'JET_TOOL_POWER'];
function vpParse(txt) {
  const d = { name: '', ext: 'nc', inch: false, rapidPlunge: true, wrap: null, subst: null, eol: '\r\n', ln: { start: 0, inc: 10, max: 999999 }, vars: {}, blocks: {} };
  const codes = s => s.replace(/\[([0-9a-fA-F]{1,3})\]/g, (m, c) => String.fromCharCode(/^\d+$/.test(c) ? +c : parseInt(c, 16)));
  let cur = null;
  for (const raw of String(txt || '').replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line[0] === '+') continue; let m;
    if (line[0] === '"') { const q = /^"(.*)"\s*$/.exec(line); if (cur && q) d.blocks[cur].push(q[1]); continue; }
    if ((m = /^begin\s+(\w+)/i.exec(line))) { cur = m[1].toUpperCase(); d.blocks[cur] = d.blocks[cur] || []; continue; }
    if ((m = /^VAR\s+\w+\s*=\s*\[([^\]]*)\]/i.exec(line))) { const f = m[1].split('|'), k = (f[0] || '').trim().toUpperCase(); if (!k) continue; const pp = String(f[3] || '1.0').trim().split('.');
      d.vars[k] = { mode: (f[1] || 'A').trim().toUpperCase() === 'C' ? 'C' : 'A', pre: f[2] || '', dec: +(pp[1] || 0) || 0, pad: /^0\d/.test(pp[0]) ? +pp[0] : 0, mul: f[4] !== undefined && String(f[4]).trim() !== '' ? (+f[4] || 1) : 1 }; continue; }
    if ((m = /^(\w+)\s*=\s*"?([^"]*)"?\s*$/.exec(line))) { const k = m[1].toUpperCase(), v = m[2].trim();
      if (k === 'POST_NAME') d.name = v; else if (k === 'FILE_EXTENSION') d.ext = v.replace(/[^\w]/g, ''); else if (k === 'UNITS') d.inch = /^inch/i.test(v); else if (k === 'RAPID_PLUNGE_TO_STARTZ') d.rapidPlunge = !/^no/i.test(v); else if (k === 'ROTARY_WRAP_X' || k === 'ROTARY_WRAP_Y') { if (!/^no/i.test(v)) d.wrap = { axis: k.slice(-1), sign: /^-/.test(v) ? -1 : 1, letter: /^-?A$/i.test(v) ? 'A' : /^-?B$/i.test(v) ? 'B' : '' }; } else if (k === 'SUBSTITUTE') d.subst = v; else if (k === 'LINE_ENDING') d.eol = codes(v) || '\r\n';
      else if (k === 'LINE_NUMBER_START') d.ln.start = +v || 0; else if (k === 'LINE_NUMBER_INCREMENT') d.ln.inc = +v || 1; else if (k === 'LINE_NUMBER_MAXIMUM') d.ln.max = +v || 999999; }
  }
  d.ignored = Object.keys(d.blocks).filter(b => !VP_BLOCKS.includes(b));
  d.ok = !!(d.blocks.RAPID_MOVE && (d.blocks.FEED_MOVE || d.blocks.FIRST_FEED_MOVE));
  return d;
}
const vpCache = new Map(), vpGet = t => { let d = vpCache.get(t); if (!d) { d = vpParse(t); vpCache.set(t, d); } return d; };
function vpNum(v, sp) { let s = (v * (sp.mul || 1)).toFixed(sp.dec || 0); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1); if (sp.pad) { const neg = s[0] === '-', [i, f] = (neg ? s.slice(1) : s).split('.'); s = (neg ? '-' : '') + i.padStart(sp.pad, '0') + (f !== undefined ? '.' + f : ''); } return s; }
function makeGcodeVP(tps, tools, stock, M, d) {
  const [ox, oy] = originOf(stock), oz = stock.originZ === 'bottom' ? stock.t : 0, U = v => d.inch ? v / 25.4 : v, p = d.inch ? 4 : 3;
  const D0 = (pre, dec, mode) => ({ mode: mode || 'A', pre, dec, pad: 0, mul: 1 });
  const DEF = { N: D0('N', 0), S: D0('S', 0), F: D0('F', 1, 'C'), FC: D0('F', 1, 'C'), FP: D0('F', 1, 'C'), X: D0('X', p, 'C'), Y: D0('Y', p, 'C'), Z: D0('Z', p, 'C'), XH: D0('X', p), YH: D0('Y', p), ZH: D0('Z', p), I: D0('I', p), J: D0('J', p), RADIUS: D0('R', p), SAFEZ: D0('Z', p), DWELL: D0('P', 2), POWER: D0('', 0), TOOL_DIA: D0('', p), TDIA: D0('', p), XMIN: D0('', p), XMAX: D0('', p), YMIN: D0('', p), YMAX: D0('', p), ZMIN: D0('', p), ZMAX: D0('', p), XLENGTH: D0('', p), YLENGTH: D0('', p), ZLENGTH: D0('', p), WRAP_DIA: D0('', p), X_ORIGIN_POS: D0('', p), Y_ORIGIN_POS: D0('', p) };
  const V = k => d.vars[k] || DEF[k], B = d.blocks, L = [], last = {}; let ln = d.ln.start, ctx = {};
  const RT = stock.rotary || {}, Dw = +stock.t || 0, W = d.wrap, zA = RT.on && RT.z0 === 'axis' ? Dw / 2 : 0, ang = v => W.sign * v / (Math.PI * Dw) * 360;
  const SUB = t => { if (!d.subst) return t; let o = String(t); for (let i = 0; i + 1 < d.subst.length; i += 2) o = o.split(d.subst[i]).join(d.subst[i + 1]); return o; };
  const usesR = Object.values(B).some(b => b.some(t => /\[radius\]/i.test(t)));
  const reset = () => { for (const k of ['X', 'Y', 'Z', 'F', 'FC', 'FP']) delete last[k]; };
  const val = k => ({ X: () => W && W.axis === 'X' && Dw ? ang(ctx.x) : U(ctx.x), Y: () => W && W.axis === 'Y' && Dw ? ang(ctx.y) : U(ctx.y), Z: () => U(ctx.z + zA), XH: () => 0, YH: () => 0, ZH: () => U(M.safeZ + oz + zA), SAFEZ: () => U(M.safeZ + oz + zA), WRAP_DIA: () => U(Dw), X_ORIGIN_POS: () => U(ox), Y_ORIGIN_POS: () => U(oy), F: () => U(ctx.f || 0), FC: () => U(+ctx.tool.feed || 0), FP: () => U(+ctx.tool.plunge || 0), S: () => rpmClamp(+ctx.tool.rpm || 0), I: () => U(ctx.i || 0), J: () => U(ctx.j || 0), RADIUS: () => U(ctx.r || 0), DWELL: () => +ctx.dwell || 0, POWER: () => +ctx.tool.power || 100, TOOL_DIA: () => U(+ctx.tool.dia || 0), TDIA: () => U(+ctx.tool.dia || 0),
    XMIN: () => U(-ox), XMAX: () => U(stock.w - ox), YMIN: () => U(-oy), YMAX: () => U(stock.h - oy), ZMIN: () => U(oz - stock.t), ZMAX: () => U(oz), XLENGTH: () => U(stock.w), YLENGTH: () => U(stock.h), ZLENGTH: () => U(stock.t) }[k] || (() => null))();
  const rend = t => { let nTok = '', nv = 0, nvOut = 0; const s = t.replace(/\[([^\]]*)\]/g, (m, raw) => { const k = raw.trim().toUpperCase();
      if (k === 'N') { const sp = V('N'); nTok = sp.pre + vpNum(ln, { ...sp, mul: 1 }); return nTok; }
      if (k === 'T') return String(ctx.tool.num || 1);
      if (k === 'TOOLPATH_NAME') return SUB(ctx.tpName || ''); if (k === 'TP_FILENAME') return SUB((S.meta && S.meta.name) || 'copo'); if (k === 'TP') return String(ctx.prevT || ''); if (k === 'TP_EXT') return d.ext; if (k === 'PATHNAME') return SUB(((S.meta && S.meta.name) || 'copo') + (d.ext ? '.' + d.ext : '')); if (k === 'TP_DIR') return ''; if (k === 'TOOLPATHS_OUTPUT') return SUB(list.map(o => o.tp.name).join(', ')); if (k === 'TOOLS_USED') return SUB([...new Set(list.map(o => o.tool.name))].join(', ')); if (k === 'FILE_NOTES') return SUB((S.meta && (S.meta.notes || S.meta.material)) || ''); if (k === 'TOOLPATH_NOTES') return SUB((ctx.tp && ctx.tp.notes) || ''); if (k === 'TOOLNAME' || k === 'TOOL_NAME') return SUB(ctx.tool.name || ''); if (k === 'Z_ORIGIN') return stock.originZ === 'bottom' ? 'Table Surface' : 'Material Surface'; if (k === 'XY_ORIGIN') return SUB(typeof originLabel === 'function' ? originLabel(stock) : ''); if (k === 'DATE') { const t = new Date(); return String(t.getDate()).padStart(2, '0') + '/' + String(t.getMonth() + 1).padStart(2, '0') + '/' + t.getFullYear(); } if (k === 'TIME') { const t = new Date(); return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); }
      const sp = V(k); if (sp) { const v = val(k); if (v === null) return ''; nv++; const str = vpNum(v, sp); if (sp.mode === 'C' && last[k] === str) return ''; last[k] = str; nvOut++; const pre = W && W.letter && Dw && (k === W.axis || k === W.axis + 'H') ? sp.pre.replace(/[A-Za-z](?=[^A-Za-z]*$)/, W.letter) : sp.pre; return pre + str; }
      if (/^\d{1,3}$/.test(raw)) return String.fromCharCode(+raw); if (/^[0-9a-f]{1,2}$/i.test(raw) && /\d/.test(raw)) return String.fromCharCode(parseInt(raw, 16));
      return m; });
    return { s, core: nTok ? s.split(nTok).join('') : s, n: !!nTok, empty: nv > 0 && nvOut === 0 }; };
  let lastCore = null; const emit = (b, mv) => { for (const t of (B[b] || [])) { if (t === '') { L.push(''); lastCore = null; continue; } const r = rend(t); if (!r.core.trim()) continue; if (mv && (r.core === lastCore || r.empty)) continue; L.push(r.s); lastCore = r.core; if (r.n) { ln += d.ln.inc; if (ln > d.ln.max) ln = d.ln.start; } } }; // mv : mouvement identique au précédent (machine sans Z) non répété
  const arcsOK = M.arcs !== false && !(stock.rotary && stock.rotary.on && d.wrap) && (B.CW_ARC_MOVE || B.FIRST_CW_ARC_MOVE) && (B.CCW_ARC_MOVE || B.FIRST_CCW_ARC_MOVE);
  const list = tps.map(tp => ({ tp, tool: tools.find(t => t.id === tp.toolId) })).filter(o => o.tool && o.tp.moves && o.tp.moves.length); if (!list.length) return '';
  ctx = { tool: list[0].tool, tp: list[0].tp, tpName: list[0].tp.name, f: +list[0].tool.feed || 0, x: 0, y: 0, z: M.safeZ + oz };
  emit('HEADER'); reset();
  let lastTool = null, lastFace = null, prev = null, pos = null, first = true;
  const pick = (k, b) => B[k] ? k : b;
  for (const { tp, tool } of list) {
    ctx.tool = tool; ctx.tpName = tp.name; ctx.tp = tp; const fc = tp.face === 2 ? 2 : 1;
    if (lastTool !== null) { if (tool.id !== lastTool || fc !== lastFace) { const pt = tools.find(t => t.id === lastTool); ctx.prevT = pt ? pt.num || 1 : ''; emit(B.TOOLCHANGE ? 'TOOLCHANGE' : 'NEW_SEGMENT'); reset(); } else emit('NEW_SEGMENT'); prev = null; }
    lastTool = tool.id; lastFace = fc;
    const moves = arcsOK ? fitArcs(tp.moves, 0.015) : tp.moves; let jetOn = false, jetTool = null;
    const jet = on => { if (!(B.JET_TOOL_ON || B.JET_TOOL_OFF)) return; if (on && !jetOn) { emit('JET_TOOL_ON'); if (jetTool !== tool.id) { emit('JET_TOOL_POWER'); jetTool = tool.id; } jetOn = true; } else if (!on && jetOn) { emit('JET_TOOL_OFF'); jetOn = false; } };
    const one = (m, x, y, z) => {
      const xyS = pos && Math.hypot(x - pos[0], y - pos[1]) < 1e-6, dz = pos ? z - pos[2] : 0; let blk;
      if (m.g === 2 || m.g === 3) { const hx = Math.abs(dz) > 1e-6, H = m.g === 2 ? 'CW_HELICAL_ARC_MOVE' : 'CCW_HELICAL_ARC_MOVE', useH = hx && (B[H] || B['FIRST_' + H] || B['PLUNGE_' + H]), k = (m.g === 2 ? 'cw' : 'ccw') + (useH ? 'h' : ''), A = useH ? H : m.g === 2 ? 'CW_ARC_MOVE' : 'CCW_ARC_MOVE';
        blk = useH && dz < 0 && B['PLUNGE_' + H] ? 'PLUNGE_' + H : prev === k && m.f === ctx.fSeq ? pick(A, 'FIRST_' + A) : pick('FIRST_' + A, A); if (!B[blk]) blk = pick(A, pick('FIRST_' + A, 'PLUNGE_' + A)); prev = k; ctx.fSeq = m.f;
        ctx.i = m.i; ctx.j = m.j; const cx = pos[0] + m.i, cy = pos[1] + m.j, r = Math.hypot(m.i, m.j); let sw = Math.atan2(y - cy, x - cx) - Math.atan2(pos[1] - cy, pos[0] - cx); if (m.g === 2) sw = -sw; sw = ((sw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); ctx.r = !usesR && sw > Math.PI + 1e-9 ? -r : r; }
      else if (m.g === 0) { blk = xyS && dz > 0 && B.RETRACT_MOVE ? 'RETRACT_MOVE' : first && B.INITIAL_RAPID_MOVE ? 'INITIAL_RAPID_MOVE' : prev !== 'rapid' && B.FIRST_RAPID_MOVE ? 'FIRST_RAPID_MOVE' : 'RAPID_MOVE'; prev = 'rapid'; ctx.f = M.rapid; }
      else if (xyS && dz < 0 && B.PLUNGE_MOVE) { blk = 'PLUNGE_MOVE'; prev = 'plunge'; }
      else if (xyS && dz > 0 && B.RETRACT_MOVE) { blk = 'RETRACT_MOVE'; prev = 'retract'; }
      else { blk = prev === 'feed' && m.f === ctx.fSeq ? pick('FEED_MOVE', 'FIRST_FEED_MOVE') : pick('FIRST_FEED_MOVE', 'FEED_MOVE'); prev = 'feed'; ctx.fSeq = m.f; }
      jet(m.g !== 0);
      if (m.g !== 0 && m.f) { if (B.FEED_RATE_CHANGE && m.f !== ctx.fOut) { ctx.f = m.f; emit('FEED_RATE_CHANGE'); ctx.fOut = m.f; } ctx.f = m.f; ctx.lastFeed = m.f; }
      ctx.x = x; ctx.y = y; ctx.z = z; emit(blk, true); pos = [x, y, z]; first = false;
    };
    for (const m of moves) {
      if (m.g === 4) { if (B.DWELL_MOVE) { ctx.dwell = m.p; emit('DWELL_MOVE'); } continue; }
      const x = m.x - ox, y = m.y - oy, z = m.z + oz;
      if (m.g === 0 && !d.rapidPlunge && pos && z < pos[2] - 1e-7 && Math.hypot(x - pos[0], y - pos[1]) < 1e-6) { one({ ...m, g: 1, f: +tool.plunge || m.f || 0 }, x, y, z); continue; } // pas de descente en rapide
      if ((m.g === 0 || m.g === 1) && pos && Math.abs(x - pos[0]) < 1e-7 && Math.abs(y - pos[1]) < 1e-7 && Math.abs(z - pos[2]) < 1e-7) continue;
      if ((m.g === 2 || m.g === 3) && !pos) { one({ ...m, g: 1 }, x, y, z); continue; }
      if ((m.g === 2 || m.g === 3) && Math.hypot(x - pos[0], y - pos[1]) < 1e-6) { // cercle complet : deux demi-arcs (le format R ne le permet pas d'un coup)
        const cx = pos[0] + m.i, cy = pos[1] + m.j, mx = 2 * cx - pos[0], my = 2 * cy - pos[1], mz = (pos[2] + z) / 2; one({ ...m, i: cx - pos[0], j: cy - pos[1] }, mx, my, mz); one({ ...m, i: cx - mx, j: cy - my }, x, y, z); continue; }
      if ((m.g === 2 || m.g === 3) && usesR) { const cx = pos[0] + m.i, cy = pos[1] + m.j, r = Math.hypot(m.i, m.j), a0 = Math.atan2(pos[1] - cy, pos[0] - cx); let sw = Math.atan2(y - cy, x - cx) - a0; if (m.g === 2) sw = -sw; sw = ((sw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (sw > Math.PI + 1e-9) { const am = a0 + (m.g === 2 ? -1 : 1) * sw / 2, mx = cx + r * Math.cos(am), my = cy + r * Math.sin(am), mz = (pos[2] + z) / 2; one({ ...m, i: cx - pos[0], j: cy - pos[1] }, mx, my, mz); one({ ...m, i: cx - mx, j: cy - my }, x, y, z); continue; } }
      one(m, x, y, z);
    }
    jet(false);
  }
  reset(); lastCore = null; ctx.f = ctx.lastFeed || +ctx.tool.feed || 0; emit('FOOTER');
  return L.join(d.eol) + d.eol;
}
const POSTS = {
  grbl: { label: "GRBL (pause M0 au changement d'outil)", short: 'GRBL', tc: 'pause', g911: false, ext: 'nc' },
  grblhal: { label: "grblHAL (pause M0 au changement d'outil, cycles de perçage)", short: 'grblHAL', tc: 'pause', g911: false, cyc: true, ext: 'nc' },
  grblm: { label: 'GRBL manuel (G53 + pause à chaque outil)', short: 'GRBL G53', tc: 'manual', g911: false, ext: 'nc' },
  carbide: { label: 'Carbide Motion (Shapeoko, Nomad)', short: 'Carbide Motion', tc: 'm6', m6: 'M6 T{T}', g911: false, ext: 'nc' },
  onefinity: { label: 'Onefinity / Buildbotics', short: 'Onefinity', tc: 'm6', m6: 'M6 T{T}', g911: false, ext: 'nc' },
  linuxcnc: { label: 'LinuxCNC (T… M6)', short: 'LinuxCNC', tc: 'm6', m6: 'T{T} M6', g911: true, cyc: true, ext: 'ngc', head: 'G40 G49 G80' },
  mach3: { label: 'Mach3 / Mach4', short: 'Mach3/4', tc: 'm6', m6: 'T{T} M6', g911: true, cyc: true, ext: 'tap', head: 'G40 G49 G80' },
  uccnc: { label: 'UCCNC', short: 'UCCNC', tc: 'm6', m6: 'T{T} M6', g911: true, cyc: true, ext: 'tap', head: 'G40 G49 G80' },
  masso: { label: 'MASSO', short: 'MASSO', tc: 'm6', m6: 'T{T} M6', g911: true, cyc: true, ext: 'nc', head: 'G40 G49 G80' },
  custom: { label: 'Personnalisé', short: 'Personnalisé', tc: 'custom', g911: false, ext: 'nc' },
};
const CUSTOM_POST = () => ({ head: '{UNITS} G90 G17 G94\nG0 Z{SAFEZ}', tc: 'M5\nT{T} M6\nS{S} M3\nG4 P3', foot: 'M5\nG0 X0 Y0\nM30', ext: 'nc', g911: false });
// machines au format .pp intégrées (définitions COPO réécrites d'après le comportement de chaque machine)
/*@donnee vposts*/
for (const [k, t] of Object.entries(VPOSTS)) { const d = vpParse(t); POSTS['vp_' + k] = { label: d.name, short: d.name.replace(/\s*\(\*\.\w+\)\s*$/, ''), tc: 'vp', vp: t, ext: d.ext, group: 'vp' }; }
const vpUserList = () => { try { const a = JSON.parse(LS.get('copo.vposts') || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const postOf = M => { if (M.post && String(M.post).startsWith('vpu:') && M.vpText) { const d = vpGet(M.vpText); return { label: M.vpName || d.name || 'Post-processeur importé', short: (M.vpName || d.name || 'Importé').replace(/\s*\(\*\.\w+\)\s*$/, ''), tc: 'vp', vp: M.vpText, ext: d.ext, group: 'vpu' }; } return POSTS[M.post] || POSTS.grbl; };
function makeGcode(tps, tools, stock, M, faceMode) {
  { const P0 = postOf(M); if (P0.vp) return makeGcodeVP(tps, tools, stock, M, vpGet(P0.vp)); }
  const RT = stock.rotary || {}, ROT = !!RT.on && +stock.t > 0, Dw = +stock.t || 0, angA = v => nf(v / (Math.PI * Dw) * 360);
  const [ox, oy] = originOf(stock), oz = ROT ? (RT.z0 === 'axis' ? Dw / 2 : 0) : stock.originZ === 'bottom' ? stock.t : 0;
  const KU = M.g20 ? 1 / 25.4 : 1, nx = v => M.g20 ? (v2 => { const t = (Math.round(v2 * 10000) / 10000).toFixed(4).replace(/\.?0+$/, ''); return t === '-0' ? '0' : t; })(v * KU) : nf(v), fF = v => M.g20 ? nf(v / 25.4) : Math.round(v), UL = M.g20 ? ' in' : ' mm';
  const RL = M.rotL === 'B' ? 'B' : 'A', cX = v => ROT && RT.axis === 'y' ? RL + angA(v) : 'X' + nx(v), cY = v => ROT && RT.axis !== 'y' ? RL + angA(v) : 'Y' + nx(v); // axe rotatif : la coordonnée enroulée sort en angle A (degrés)
  const L = [], cm = t => { if (M.comments) L.push('(' + String(typeof tr === 'function' ? tr(t) : t).replace(/[()]/g, '') + ')'); };
  cm('COPO FAO 2D'); if (ROT) cm('Cylindre L ' + nx(RT.axis === 'y' ? stock.h : stock.w) + ' x D ' + nx(Dw) + UL + ' (feuille deroulee ' + nx(stock.w) + ' x ' + nx(stock.h) + ')'); else cm('Brut ' + nx(stock.w) + ' x ' + nx(stock.h) + ' x ' + nx(stock.t) + UL);
  cm('Origine XY : ' + originLabel(stock) + ' - Z0 : ' + (ROT ? (RT.z0 === 'axis' ? 'axe du cylindre' : 'surface du cylindre') : stock.originZ === 'bottom' ? 'table' : 'dessus du brut'));
  const FL = stock.flip === 'y' ? "l'axe Y (gauche - droite)" : "l'axe X (haut - bas)", has2 = tps.some(t => t.face === 2), has1 = tps.some(t => t.face !== 2);
  if (has2 && !has1) cm('FACE 2 (dessous) - piece retournee autour de ' + FL + ', origine refaite au meme point');
  else if (has1 && has2) cm('Double face : face 1 puis pause M0 pour retourner la piece autour de ' + FL);
  const TC = ['none', 'pause', 'cmd'].includes(M.tcMode) ? M.tcMode : null, tcCmd = tool => TC === 'pause' ? String(M.tcPause || 'M0') : TC === 'cmd' ? String(M.tcA ?? 'T') + (M.tcN !== false ? (tool.num || 1) : '') + String(M.tcB ?? ' M6') : ''; // changement d'outil choisi dans la machine (sinon celui du post-processeur)
  const PP = postOf(M), MAN = PP.tc === 'manual', CUS = PP.tc === 'custom', CP = { ...CUSTOM_POST(), ...(M.custom || {}) }, G53 = M.tcOn ? 'G53 G0 Z' + nx(M.tcZ === undefined || M.tcZ === '' ? -10 : +M.tcZ) : 'G0 Z' + nx(M.safeZ + oz); // G53 seulement si activé dans la machine (sinon Z de sécurité)
  const tpl = (t, tool) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => { const v = { UNITS: M.g20 ? 'G20' : 'G21', SAFEZ: nx(M.safeZ + oz), TCZ: nx(M.tcZ === undefined || M.tcZ === '' ? -10 : +M.tcZ), T: tool ? (tool.num || 1) : '', S: tool ? rpmClamp(tool.rpm || 0) : '', D: tool && tool.dia ? nx(tool.dia) : '', TOOL: tool ? String(tool.name).replace(/[()]/g, '') : '' }[k]; return v === undefined ? m : v; }).split('\n').filter(x => x.trim() !== '' && (M.tcOn || !/G53/i.test(x))); // sans G53 activé, les lignes G53 des modèles sont retirées
  if (MAN) cm('Changement manuel : remontee en ' + G53 + ' puis pause M0 avant chaque outil');
  if (CUS) L.push(...tpl(CP.head)); else { L.push((M.g20 ? 'G20' : 'G21') + ' G90 G17 G94' + (PP.head ? ' ' + PP.head : '')); }
  if (M.arcs !== false && !ROT && (CUS ? CP.g911 : PP.g911)) L.push('G91.1');
  if (ROT) cm('Axe rotatif : ' + (RT.axis === 'y' ? 'X' : 'Y') + ' enroule en ' + RL + ' - diametre ' + nx(Dw) + UL + ' - Z0 ' + (RT.z0 === 'axis' ? 'sur l axe' : 'a la surface'));
  if (!MAN && !CUS) L.push('G0 Z' + nx(M.safeZ + oz));
  let lastTool = null, curFace = null, flipTool = null, st = { g: null, x: null, y: null, z: null, f: null };
  const CYC = M.cycles === undefined ? !!PP.cyc : !!M.cycles; let inCyc = false, lastCy = null; const endCyc = () => { if (inCyc) { L.push('G80'); inCyc = false; lastCy = null; st.g = null; } };
  for (const tp of tps) {
    const tool = tools.find(t => t.id === tp.toolId); if (!tool || !tp.moves || !tp.moves.length) continue;
    const fc = tp.face === 2 ? 2 : 1;
    if (curFace !== null && fc !== curFace) { L.push(MAN ? G53 : 'G0 Z' + nx(M.safeZ + oz)); L.push('M5'); flipTool = lastTool; L.push('G0 X0 Y0'); cm('RETOURNER LA PIECE autour de ' + FL + ', refaire X0 Y0 Z0 puis reprendre'); L.push('M0'); lastTool = null; st = { g: null, x: null, y: null, z: null, f: null }; }
    if (curFace !== fc) { if (!ROT) cm(fc === 2 ? '=== FACE 2 (dessous) ===' : '=== FACE 1 (dessus) ==='); curFace = fc; }
    if (lastTool !== tool.id) {
      if (MAN) {
        if (tool.id === flipTool) cm('Outil : ' + tool.name + ' (inchange)');
        else { if (lastTool !== null) L.push('M5'); L.push(G53); cm("Mettre l'outil : " + tool.name + (tool.dia ? ' D' + nx(tool.dia) : '') + ' - refaire le zero Z puis reprendre'); if (!TC) L.push('M0'); else if (TC !== 'none') L.push(tcCmd(tool)); }
        st = { g: null, x: null, y: null, z: null, f: null };
      } else if (lastTool !== null) { if (st.z === null || nx(st.z) !== nx(M.safeZ + oz)) L.push('G0 Z' + nx(M.safeZ + oz)); L.push('M5'); st.z = M.safeZ + oz; st.g = 0; }
      if (MAN) { }
      else if (TC) { cm((TC === 'pause' && lastTool !== null ? "Changer d'outil : " : 'Outil : ') + tool.name); if (TC === 'cmd' || (TC === 'pause' && lastTool !== null)) L.push(tcCmd(tool)); }
      else if (CUS) { cm('Outil : ' + tool.name); L.push(...tpl(CP.tc, tool)); }
      else if (PP.tc === 'pause') { cm((lastTool === null ? 'Outil : ' : "Changer d'outil : ") + tool.name); if (lastTool !== null) L.push('M0'); }
      else { cm('Outil : ' + tool.name); L.push(PP.m6.replace('{T}', tool.num || 1)); }
      if (!CUS || TC) { L.push('S' + rpmClamp(tool.rpm || 0) + ' M3'); L.push('G4 P3'); }
      lastTool = tool.id; flipTool = null;
    }
    cm('Parcours : ' + tp.name);
    for (const m of (M.arcs === false || ROT ? tp.moves : fitArcs(tp.moves, 0.015))) {
      if (CYC && m.cy) {
        if (m.cy === lastCy) continue;
        const c = m.cy, zc = M.clearZ + oz;
        if (!inCyc) { const X = c.x - ox, Y = c.y - oy; if (st.x === null || nx(st.x) !== nx(X) || nx(st.y) !== nx(Y)) L.push('G0 X' + nx(X) + ' Y' + nx(Y)); if (st.z === null || nx(st.z) !== nx(zc)) L.push('G0 Z' + nx(zc)); }
        L.push((inCyc ? '' : 'G98 ') + (c.q > 0 ? 'G83' : c.p > 0 ? 'G82' : 'G81') + ' ' + cX(c.x - ox) + ' ' + cY(c.y - oy) + ' Z' + nx(c.zb + oz) + ' R' + nx(c.r + oz) + (c.q > 0 ? ' Q' + nx(c.q) : c.p > 0 ? ' P' + nf(c.p) : '') + ' F' + fF(c.f));
        inCyc = true; lastCy = c; st = { ...st, g: null, x: c.x - ox, y: c.y - oy, z: zc, f: c.f }; continue;
      }
      endCyc();
      if (m.g === 4) { L.push('G4 P' + nf(m.p)); continue; }
      const x = m.x - ox, y = m.y - oy, z = m.z + oz, w = [];
      if (m.g === 2 || m.g === 3) { w.push('G' + m.g, cX(x), cY(y)); if (st.z === null || nx(z) !== nx(st.z)) w.push('Z' + nx(z)); w.push('I' + nx(m.i), 'J' + nx(m.j)); if (st.f !== m.f) { w.push('F' + fF(m.f)); st.f = m.f; } L.push(w.join(' ')); st = { ...st, g: m.g, x, y, z }; continue; }
      if (m.g === 0 && st.x === null && st.z === null) { L.push('G0 ' + cX(x) + ' ' + cY(y)); L.push('G0 Z' + nx(z)); st = { ...st, g: 0, x, y, z }; continue; }
      if (st.g !== m.g) w.push('G' + m.g);
      if (st.x === null || nx(x) !== nx(st.x)) w.push(cX(x));
      if (st.y === null || nx(y) !== nx(st.y)) w.push(cY(y));
      if (st.z === null || nx(z) !== nx(st.z)) w.push('Z' + nx(z));
      if (w.length === 1 && w[0][0] === 'G') continue;
      if (!w.length) continue;
      if (m.g === 1 && st.f !== m.f && m.f) { w.push('F' + fF(m.f)); st.f = m.f; }
      L.push(w.join(' ')); st = { ...st, g: m.g, x, y, z };
    }
    endCyc();
  }
  if (st.z === null || nx(st.z) !== nx(M.safeZ + oz)) L.push('G0 Z' + nx(M.safeZ + oz));
  if (CUS) L.push(...tpl(CP.foot)); else { L.push('M5'); if (MAN) L.push(G53); L.push('G0 ' + cX(0) + ' ' + cY(0)); L.push('M30'); }
  return L.join('\n') + '\n';
}
function moveStats(moves, rapid) { let t = 0, cut = 0, px = null, py, pz; for (const m of moves) { if (m.g === 4) { t += (m.p || 0) / 60; continue; } if (px !== null) { const d = Math.hypot(m.x - px, m.y - py, m.z - pz); if (m.g === 0) t += d / rapid; else { t += d / m.f; cut += d; } } px = m.x; py = m.y; pz = m.z; } return { min: t, cut }; }
/*CORE-END*/
/*NODES-START*/
// ======================================================================
// Courbes de Bézier : chaque forme = liste de nœuds {x,y,i,o,sm}
// i / o = poignées entrante / sortante (vecteurs relatifs) ou null
// ======================================================================
const K4 = 0.5522847498;
const NODE = (x, y, i = null, o = null, sm = false) => ({ x, y, i, o, sm });
const cloneNode = n => ({ x: n.x, y: n.y, i: n.i ? n.i.slice() : null, o: n.o ? n.o.slice() : null, sm: !!n.sm, ...(n.sym ? { sym: true } : {}) });
const nseg = s => s.closed ? s.nodes.length : s.nodes.length - 1;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function segOf(s, k) {
  const n = s.nodes.length, a = s.nodes[((k % n) + n) % n], b = s.nodes[(((k + 1) % n) + n) % n];
  const p0 = [a.x, a.y], p3 = [b.x, b.y];
  if (!a.o && !b.i) return { line: true, p0, p3 };
  return { line: false, p0, c1: [a.x + (a.o ? a.o[0] : 0), a.y + (a.o ? a.o[1] : 0)], c2: [b.x + (b.i ? b.i[0] : 0), b.y + (b.i ? b.i[1] : 0)], p3 };
}
function bez(g, t) {
  if (g.line) return lerp(g.p0, g.p3, t);
  const u = 1 - t;
  return [u * u * u * g.p0[0] + 3 * u * u * t * g.c1[0] + 3 * u * t * t * g.c2[0] + t * t * t * g.p3[0],
          u * u * u * g.p0[1] + 3 * u * u * t * g.c1[1] + 3 * u * t * t * g.c2[1] + t * t * t * g.p3[1]];
}
function splitSeg(g, t) {
  if (g.line) { const m = lerp(g.p0, g.p3, t); return [{ line: true, p0: g.p0, p3: m }, { line: true, p0: m, p3: g.p3 }]; }
  const A = lerp(g.p0, g.c1, t), B = lerp(g.c1, g.c2, t), C = lerp(g.c2, g.p3, t), D = lerp(A, B, t), E = lerp(B, C, t), F = lerp(D, E, t);
  return [{ line: false, p0: g.p0, c1: A, c2: D, p3: F }, { line: false, p0: F, c1: E, c2: C, p3: g.p3 }];
}
function subSeg(g, t0, t1) { if (t1 < 1 - 1e-12) g = splitSeg(g, t1)[0]; else t1 = 1; if (t0 > 1e-12) g = splitSeg(g, t0 / t1)[1]; return g; }
// aplatit la forme en polyligne (s.pts) et garde le paramètre u = segment + t de chaque point (s.map)
function refresh(s) {
  const pts = [], map = [], ns = nseg(s);
  for (let k = 0; k < ns; k++) {
    const g = segOf(s, k);
    if (g.line) { pts.push(g.p0); map.push(k); continue; }
    const L = hyp(g.p0, g.c1) + hyp(g.c1, g.c2) + hyp(g.c2, g.p3), m = Math.max(4, Math.min(400, Math.ceil(L / 0.3)));
    for (let j = 0; j < m; j++) { pts.push(bez(g, j / m)); map.push(k + j / m); }
  }
  if (!s.closed && s.nodes.length) { const l = s.nodes[s.nodes.length - 1]; pts.push([l.x, l.y]); map.push(ns); }
  const P = [], U = [];
  for (let i = 0; i < pts.length; i++) { if (P.length && hyp(P[P.length - 1], pts[i]) < 1e-5) continue; P.push(pts[i]); U.push(map[i]); }
  if (s.closed && P.length > 2 && hyp(P[0], P[P.length - 1]) < 1e-5) { P.pop(); U.pop(); }
  s.pts = P; s.map = U; return s;
}
const nodesFromPts = pts => pts.map(p => NODE(p[0], p[1]));
function ellipseNodes(c, rx, ry) {
  const kx = K4 * rx, ky = K4 * ry;
  return [NODE(c[0] + rx, c[1], [0, -ky], [0, ky], true), NODE(c[0], c[1] + ry, [kx, 0], [-kx, 0], true), NODE(c[0] - rx, c[1], [0, ky], [0, -ky], true), NODE(c[0], c[1] - ry, [-kx, 0], [kx, 0], true)];
}
function arcNodes(C, r, a0, sweep) {
  const m = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9)), ph = sweep / m, hl = 4 / 3 * Math.tan(ph / 4) * r, out = [];
  for (let j = 0; j <= m; j++) { const a = a0 + ph * j, t = [-Math.sin(a), Math.cos(a)]; out.push(NODE(C[0] + r * Math.cos(a), C[1] + r * Math.sin(a), j > 0 ? [-t[0] * hl, -t[1] * hl] : null, j < m ? [t[0] * hl, t[1] * hl] : null, j > 0 && j < m)); }
  return out;
}
const polyNodes = (c, r, n, rot) => Array.from({ length: n }, (_, i) => { const a = rot + 2 * Math.PI * i / n; return NODE(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)); });
const starNodes = (c, r1, r2, n, rot) => Array.from({ length: 2 * n }, (_, i) => { const a = rot + Math.PI * i / n, r = i % 2 ? r2 : r1; return NODE(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)); });
const rectNodes = (x0, y0, x1, y1) => [NODE(x0, y0), NODE(x1, y0), NODE(x1, y1), NODE(x0, y1)];
// rectangle à coins en rayon interne (arcs creusés, centrés sur les coins)
function rectInnerNodes(x0, y0, x1, y1, r) { r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 1e-6, (y1 - y0) / 2 - 1e-6)); if (!(r > 0)) return rectNodes(x0, y0, x1, y1); const P = Math.PI, h = -P / 2;
  return [...arcNodes([x0, y0], r, P / 2, h), ...arcNodes([x1, y0], r, P, h), ...arcNodes([x1, y1], r, -P / 2, h), ...arcNodes([x0, y1], r, 0, h)].filter((n, i, A) => !i || Math.hypot(n.x - A[i - 1].x, n.y - A[i - 1].y) > 1e-9); }
function circle3(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-9) return null;
  const A = a[0] * a[0] + a[1] * a[1], B = b[0] * b[0] + b[1] * b[1], Cc = c[0] * c[0] + c[1] * c[1];
  const C = [(A * (b[1] - c[1]) + B * (c[1] - a[1]) + Cc * (a[1] - b[1])) / d, (A * (c[0] - b[0]) + B * (a[0] - c[0]) + Cc * (b[0] - a[0])) / d];
  return { C, r: hyp(C, a) };
}
function arc3Nodes(a, b, c) { // arc de a à b passant par c
  const k = circle3(a, b, c); if (!k) return [NODE(a[0], a[1]), NODE(b[0], b[1])];
  const tw = 2 * Math.PI, md = x => ((x % tw) + tw) % tw;
  const a0 = Math.atan2(a[1] - k.C[1], a[0] - k.C[0]), a1 = Math.atan2(b[1] - k.C[1], b[0] - k.C[0]), ac = Math.atan2(c[1] - k.C[1], c[0] - k.C[0]);
  const s = md(a1 - a0), sc = md(ac - a0);
  return arcNodes(k.C, k.r, a0, sc < s ? s : s - tw);
}
function transformShape(s, f) {
  for (const n of s.nodes) {
    const p = f([n.x, n.y]);
    if (n.i) { const q = f([n.x + n.i[0], n.y + n.i[1]]); n.i = [q[0] - p[0], q[1] - p[1]]; }
    if (n.o) { const q = f([n.x + n.o[0], n.y + n.o[1]]); n.o = [q[0] - p[0], q[1] - p[1]]; }
    n.x = p[0]; n.y = p[1];
  }
  return refresh(s);
}
const reverseNodes = ns => ns.slice().reverse().map(n => { const c = cloneNode(n), t = c.i; c.i = c.o; c.o = t; return c; });
const segIsLine = (s, k) => { const n = s.nodes.length; return !s.nodes[((k % n) + n) % n].o && !s.nodes[(k + 1) % n].i; };
function cornerNodes(s, i, kind, val, frac) {
  const n = s.nodes.length, Pn = s.nodes[(i - 1 + n) % n], V = s.nodes[i], Qn = s.nodes[(i + 1) % n];
  const Vp = [V.x, V.y], a = [Pn.x - V.x, Pn.y - V.y], b = [Qn.x - V.x, Qn.y - V.y], la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
  if (la < 1e-9 || lb < 1e-9 || !(val > 0)) return [cloneNode(V)];
  const u1 = [a[0] / la, a[1] / la], u2 = [b[0] / lb, b[1] / lb];
  const th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))), lim = Math.min(la, lb) * frac;
  if (th > Math.PI * 0.97) return [cloneNode(V)];
  if (kind === 'chamfer') { const d = Math.min(val, lim); return [NODE(V.x + u1[0] * d, V.y + u1[1] * d), NODE(V.x + u2[0] * d, V.y + u2[1] * d)]; }
  let t = val / Math.tan(th / 2), r = val; if (t > lim) { t = lim; r = t * Math.tan(th / 2); }
  const T1 = [V.x + u1[0] * t, V.y + u1[1] * t], T2 = [V.x + u2[0] * t, V.y + u2[1] * t];
  const bis = nrm([u1[0] + u2[0], u1[1] + u2[1]]), dc = r / Math.sin(th / 2), C = [Vp[0] + bis[0] * dc, Vp[1] + bis[1] * dc];
  const a0 = Math.atan2(T1[1] - C[1], T1[0] - C[0]); let sw = Math.atan2(T2[1] - C[1], T2[0] - C[0]) - a0;
  while (sw > Math.PI) sw -= 2 * Math.PI; while (sw <= -Math.PI) sw += 2 * Math.PI;
  return arcNodes(C, r, a0, sw);
}
