// ---------- FICHE DE GAMME (fiche de réglage imprimable) ----------
const ENTRY_LBL = { plunge: 'Plongée droite', rampzz: 'Rampe aller-retour', ramp: 'Rampe continue', arc: 'Arc tangent', arcramp: 'Arc en rampe', helix: 'Hélice' };
const TOOLTYPE_LBL = { flat: 'Fraise droite', ball: 'Fraise hémisphérique', v: 'Fraise en V', drill: 'Foret', thread: 'Fraise à fileter' };
const fn = (v, d = 2) => LANG === 'fr' ? fr(v, d) : (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
const trf = (k, o) => tr(k).replace(/\{(\w+)\}/g, (m, x) => o[x] !== undefined ? o[x] : m);
const cap1 = x => x ? x[0].toUpperCase() + x.slice(1) : x;
const fL = (v, d) => UNIT.len === 'in' ? uNum(v, 'len', 3, true) : fn(v, d), fFd = v => uNum(v, 'feed');
const SEP = () => LANG === 'fr' ? ' : ' : ': ';
const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function m4ortho(l, r, b, t, n, f) { return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]; }
// rendu de la simulation en vue dimétrique (X et Y raccourcis de la même façon, Z différemment), sur fond blanc
function v3Snap(S3, face, W, H) {
  const gl = V3.gl, c = $('#v3c'); c.width = W; c.height = H; gl.viewport(0, 0, W, H); gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.bindTexture(gl.TEXTURE_2D, V3.tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S3.nx, S3.ny, gl.RED, gl.FLOAT, S3.H); gl.bindTexture(gl.TEXTURE_2D, V3.texB); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S3.nx, S3.ny, gl.RED, gl.FLOAT, S3.B);
  const yaw = -Math.PI / 4, pitch = 0.62, tgt = [S3.w / 2, S3.h / 2, -S3.t / 2], Dd = (S3.w + S3.h + S3.t) * 3;
  const e = [tgt[0] + Dd * Math.cos(pitch) * Math.cos(yaw), tgt[1] + Dd * Math.cos(pitch) * Math.sin(yaw), tgt[2] + Dd * Math.sin(pitch)], V = m4look(e, tgt, [0, 0, 1]);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const x of [0, S3.w]) for (const y of [0, S3.h]) for (const z of [0, -S3.t]) { const vx = V[0] * x + V[4] * y + V[8] * z + V[12], vy = V[1] * x + V[5] * y + V[9] * z + V[13], vz = V[2] * x + V[6] * y + V[10] * z + V[14]; x0 = Math.min(x0, vx); x1 = Math.max(x1, vx); y0 = Math.min(y0, vy); y1 = Math.max(y1, vy); z0 = Math.min(z0, vz); z1 = Math.max(z1, vz); }
  const m = 0.06, cxv = (x0 + x1) / 2, cyv = (y0 + y1) / 2; let hw = (x1 - x0) / 2 * (1 + m), hh = (y1 - y0) / 2 * (1 + m); if (hw / hh > W / H) hh = hw * H / W; else hw = hh * W / H;
  const mvp = m4mul(m4ortho(cxv - hw, cxv + hw, cyv - hh, cyv + hh, -z1 - 10, -z0 + 10), V), L = v3n([0.35, -0.55, 0.85]);
  gl.useProgram(V3.prog); wrapU(gl, V3.prog); const u = n => gl.getUniformLocation(V3.prog, n);
  gl.uniformMatrix4fv(u('uMVP'), false, mvp); gl.uniform2f(u('uCell'), S3.cx, S3.cy); gl.uniform2f(u('uOrg'), S3.ox || 0, S3.oy || 0); gl.uniform2i(u('uDim'), S3.nx, S3.ny); gl.uniform1f(u('uT'), S3.t);
  gl.uniform3fv(u('uL'), L); gl.uniform3fv(u('uTop'), mat3d().top); gl.uniform3fv(u('uDeep'), mat3d().deep);
  const model = face !== 2 ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : S.stock.flip === 'y' ? [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, S3.w, 0, -S3.t, 1] : [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, S3.h, -S3.t, 1];
  gl.uniformMatrix4fv(u('uModel'), false, model);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, V3.tex); gl.uniform1i(u('uH'), 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, V3.texB); gl.uniform1i(u('uB'), 1);
  gl.bindVertexArray(V3.vao); gl.uniform1f(u('uBot'), 0); gl.drawElements(gl.TRIANGLES, V3.nIdx, gl.UNSIGNED_INT, 0); gl.uniform1f(u('uBot'), 1); gl.drawElements(gl.TRIANGLES, V3.nGrid, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
  return c.toDataURL('image/jpeg', 0.9);
}
function sheetSim(tps) {
  if (!tps.length || !v3Init()) return null;
  const S3 = makeSim(S.stock, tps, S.tools, S.machine.rapid, 600000); V3.S3 = S3; V3.toolMesh.clear(); v3BuildMesh(); simTo(S3, S3.total);
  let vol = 0; const a = S3.cx * S3.cy; for (let i = 0; i < S3.H.length; i++) { const h = S3.H[i], b = S3.B[i]; vol += (h <= b + 1e-6 ? S3.t : Math.min(S3.t, Math.max(0, -h) + Math.max(0, b + S3.t))) * a; }
  const r = { f1: v3Snap(S3, 1, 1100, 680), f2: v3Snap(S3, 2, 1100, 680), vol, time: S3.total }; V3.dirty = true; return r;
}
// vue 2D d'une face, telle que vue sur la machine, avec l'origine et les cotes du brut
function sheetSvg2D(face, tps) {
  const st = S.stock, [ox, oy] = originOf(st), f2 = face === 2, lay = id => S.layers.find(l => l.id === id) || {};
  const shapes = S.shapes.filter(s => { const l = lay(s.layer); return l.visible !== false && ((l.face === 2) === f2); });
  const P = q => f2 ? flipPt(q) : q, all = [[0, 0], [st.w, st.h], [ox, oy]];
  shapes.forEach(s => s.pts.forEach(q => all.push(P(q))));
  let x0 = Math.min(...all.map(q => q[0])), x1 = Math.max(...all.map(q => q[0])), y0 = Math.min(...all.map(q => q[1])), y1 = Math.max(...all.map(q => q[1]));
  const sz = Math.max(x1 - x0, y1 - y0), pad = sz * 0.1, fs = sz * 0.042, X = x => (x - x0 + pad), Y = y => (y1 - y + pad), Wv = x1 - x0 + 2 * pad, Hv = y1 - y0 + 2 * pad;
  const col = { profile: tok('--pf'), pocket: tok('--pk'), vcarve: tok('--vc'), drill: tok('--dr'), thread: tok('--th'), relief: tok('--rl') };
  const poly = (pts, closed) => pts.length ? 'M' + pts.map(q => X(q[0]).toFixed(2) + ' ' + Y(q[1]).toFixed(2)).join('L') + (closed ? 'Z' : '') : '';
  let g = '<rect x="' + X(0) + '" y="' + Y(st.h) + '" width="' + st.w + '" height="' + st.h + '" fill="#f4eee2" stroke="#a8977a" stroke-width="1.2" vector-effect="non-scaling-stroke"/>';
  for (const tp of tps.filter(t => (t.face === 2) === f2)) {
    let d = '', cur = []; for (const m of tp.moves) { if (m.z < -1e-6 && m.g !== 0) { cur.push([m.x, m.y]); } else { if (cur.length > 1) d += poly(cur, false); cur = m.z < -1e-6 ? [[m.x, m.y]] : []; } }
    if (cur.length > 1) d += poly(cur, false);
    if (tp.type === 'drill') for (const m of tp.moves) if (m.z < -1e-6) d += 'M' + (X(m.x) - fs * 0.15).toFixed(2) + ' ' + Y(m.y).toFixed(2) + 'h' + (fs * 0.3).toFixed(2);
    g += '<path d="' + d + '" fill="none" stroke="' + (col[tp.type] || '#888') + '" stroke-opacity=".55" stroke-width="1.1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
  }
  for (const s of shapes) g += '<path d="' + poly(s.pts.map(P), s.closed) + '" fill="none" stroke="#1b1b1b" stroke-width="1" vector-effect="non-scaling-stroke"/>';
  // cotes du brut
  const dy = Y(0) + pad * 0.45, dx = X(0) - pad * 0.45, ar = fs * 0.35;
  g += '<g stroke="#555" stroke-width=".8" vector-effect="non-scaling-stroke" fill="none"><path d="M' + X(0) + ' ' + (Y(0) + pad * 0.12) + 'V' + (dy + ar) + 'M' + X(st.w) + ' ' + (Y(0) + pad * 0.12) + 'V' + (dy + ar) + 'M' + X(0) + ' ' + dy + 'H' + X(st.w) + '"/>'
    + '<path d="M' + (X(0) - pad * 0.12) + ' ' + Y(0) + 'H' + (dx - ar) + 'M' + (X(0) - pad * 0.12) + ' ' + Y(st.h) + 'H' + (dx - ar) + 'M' + dx + ' ' + Y(0) + 'V' + Y(st.h) + '"/></g>';
  g += '<text x="' + X(st.w / 2) + '" y="' + (dy - fs * 0.35) + '" font-size="' + fs + '" text-anchor="middle" fill="#333">' + fn(st.w, 1) + ' mm</text>';
  g += '<text x="' + (dx - fs * 0.35) + '" y="' + Y(st.h / 2) + '" font-size="' + fs + '" text-anchor="middle" fill="#333" transform="rotate(-90 ' + (dx - fs * 0.35) + ' ' + Y(st.h / 2) + ')">' + fn(st.h, 1) + ' mm</text>';
  // origine
  const L0 = sz * 0.09, oxs = X(ox), oys = Y(oy);
  g += '<g stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round"><path d="M' + oxs + ' ' + oys + 'h' + L0 + 'm' + (-fs * 0.4) + ' ' + (-fs * 0.25) + 'l' + (fs * 0.4) + ' ' + (fs * 0.25) + 'l' + (-fs * 0.4) + ' ' + (fs * 0.25) + '" stroke="#d93025" fill="none" vector-effect="non-scaling-stroke"/>'
    + '<path d="M' + oxs + ' ' + oys + 'v' + (-L0) + 'm' + (-fs * 0.25) + ' ' + (fs * 0.4) + 'l' + (fs * 0.25) + ' ' + (-fs * 0.4) + 'l' + (fs * 0.25) + ' ' + (fs * 0.4) + '" stroke="#188038" fill="none" vector-effect="non-scaling-stroke"/></g>'
    + '<circle cx="' + oxs + '" cy="' + oys + '" r="' + (fs * 0.32) + '" fill="#1a73e8" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>'
    + '<text x="' + (oxs + L0 + fs * 0.3) + '" y="' + (oys + fs * 0.35) + '" font-size="' + (fs * 0.9) + '" fill="#d93025" font-weight="700">X</text><text x="' + (oxs - fs * 0.3) + '" y="' + (oys - L0 - fs * 0.4) + '" font-size="' + (fs * 0.9) + '" fill="#188038" font-weight="700">Y</text>'
    + '<text x="' + (oxs + fs * 0.55) + '" y="' + (oys - fs * 0.55) + '" font-size="' + (fs * 0.85) + '" fill="#1a73e8" font-weight="700">X0 Y0</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + Wv.toFixed(2) + ' ' + Hv.toFixed(2) + '" font-family="Arial,Helvetica,sans-serif">' + g + '</svg>';
}
function sheetData() {
  const tps = gcTps(), st = S.stock, [ox, oy] = originOf(st), oz = st.originZ === 'bottom' ? st.t : 0, rows = [], warns = [], order = [];
  let zmin = 0, ex = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }, tot = 0, cut = 0;
  tps.forEach((tp, i) => {
    const tool = S.tools.find(t => t.id === tp.toolId) || {}, p = tp.p || {}, depth = +p.depth || 0, pass = +p.pass > 0 ? +p.pass : (+tool.pass || 0);
    let zl = 0; for (const m of tp.moves) { if (m.z < zl) zl = m.z; if (m.z < -1e-6 && m.g !== 0) { ex.x0 = Math.min(ex.x0, m.x - ox); ex.x1 = Math.max(ex.x1, m.x - ox); ex.y0 = Math.min(ex.y0, m.y - oy); ex.y1 = Math.max(ex.y1, m.y - oy); } }
    zmin = Math.min(zmin, zl);
    let kind = tr(TYPE_LBL[tp.type] || tp.type);
    if (tp.type === 'profile') kind += ' ' + tr(SIDE_LBL[p.side] || '');
    if (tp.type === 'pocket') kind += ' · ' + tr(p.rest ? 'reprise' : p.strategy === 'raster' ? 'aller-retour + contour' : p.strategy === 'zigzag' ? 'aller-retour' : p.strategy === 'ringsIn' ? 'spirale ext. → int.' : 'spirale int. → ext.');
    if (tp.type === 'relief') kind += ' · ' + tr(p.rlOp === 'finish' ? 'finition' : 'ébauche') + ' · ' + tr('pas latéral') + ' ' + (p.rlStep || 0) + ' %' + (p.rlOp !== 'finish' && p.rlAllow ? ' · ' + tr('surépaisseur') + ' ' + fL(+p.rlAllow, 2) : '');
    if (tp.type === 'thread') kind += ' · ' + (p.thSide === 'out' ? tr('extérieur') : tr('intérieur')) + ' · ' + tr('pas') + ' ' + fL(+p.thPitch || 0, 2) + (p.thHand === 'L' ? ' · ' + tr('à gauche') : '');
    if (tp.type === 'drill') kind += (p.peck > 0 ? ' · ' + tr('débourrage') + ' ' + fL(+p.peck, 1) : '') + (p.helixHoles ? ' · ' + tr('hélice') : '');
    const nP = tp.type === 'vcarve' ? (pass > 0 && depth > 0 ? Math.max(1, Math.ceil(depth / pass - 1e-6)) + ' × ' + fL(Math.min(pass, depth), 2) : '—') : pass > 0 ? Math.max(1, Math.ceil(depth / pass - 1e-6)) + ' × ' + fL(Math.min(pass, depth || pass), 2) : '—';
    const tabs = tp.type === 'profile' && p.tabs ? ((tp.tabs && tp.tabs.length) || p.tabN) + ' × ' + fL(+p.tabL || 0, 1) + ' × ' + fL(+p.tabH || 0, 1) : '—';
    rows.push({ n: i + 1, name: tp.name, face: tp.face === 2 ? 2 : 1, kind, tool, depth: (+p.vstart > 0 ? fL(+p.vstart, 2) + ' + ' : '') + (tp.type === 'vcarve' ? (depth > 0 ? fL(depth, 2) : tr('auto') + ' (' + fL(-zl, 2) + ')') : fL(depth, 2)), zlow: fL(-zl, 2), nP,
      allow: (tp.type === 'profile' || tp.type === 'pocket') && +p.allow > 0 ? fL(+p.allow, 2) : '—', entry: (tp.type === 'profile' || tp.type === 'pocket') ? tr(ENTRY_LBL[tool.noCenter && (p.entry || 'plunge') === 'plunge' ? 'rampzz' : p.entry] || '—') : tp.type === 'relief' && p.rlOp !== 'finish' ? tr(ENTRY_LBL[p.rlEntry] || 'Plongée droite') : tr('Plongée droite'), tabs,
      time: tp.stats ? tp.stats.min : 0, cut: tp.stats ? tp.stats.cut : 0 });
    if (tp.stats) { tot += tp.stats.min; cut += tp.stats.cut; }
    if (!order.length || order[order.length - 1].tool.id !== tool.id || order[order.length - 1].face !== (tp.face === 2 ? 2 : 1)) order.push({ tool, face: tp.face === 2 ? 2 : 1, names: [tp.name] }); else order[order.length - 1].names.push(tp.name);
    if (-zl > st.t + 1e-6) warns.push(trf('« {n} » traverse le brut de {d} mm : l’outil entamera la table. Posez une planche martyr.', { n: tp.name, d: fn(-zl - st.t, 2) }));
    if (tp.type === 'profile' && p.side !== 'on' && -zl >= st.t - 1e-6 && !p.tabs) warns.push(trf('« {n} » détoure sans ponts d’attache : la pièce peut bouger en fin de coupe. Ajoutez des ponts ou bridez la pièce.', { n: tp.name }));
    if (pass > (+tool.dia || 0) * 1.5 && tp.type !== 'vcarve' && tp.type !== 'drill' && tp.type !== 'thread' && !(tp.type === 'relief' && p.rlOp === 'finish')) warns.push(trf('« {n} » : risque de casser la fraise, la profondeur de passe ({d} mm) dépasse 1,5 fois son diamètre. Réduisez la profondeur de passe.', { n: tp.name, d: fn(pass, 2) }));
  });
  if (isFinite(ex.x0) && (ex.x0 < -ox - 1e-3 || ex.y0 < -oy - 1e-3 || ex.x1 > st.w - ox + 1e-3 || ex.y1 > st.h - oy + 1e-3)) warns.push(tr('Une partie de l’usinage sort du brut : l’outil peut toucher les brides. Vérifiez les dimensions et le bridage.'));
  const hidden = S.tps.filter(t => !t.visible).length, errs = S.tps.filter(t => t.visible && t.err).length;
  if (hidden) warns.push(trf('{n} parcours masqué(s), non inclus dans le G-code.', { n: hidden }));
  if (errs) warns.push(trf('{n} parcours en erreur, non inclus dans le G-code : ouvrez-les dans l’onglet Parcours pour voir la cause.', { n: errs }));
  const changes = order.length;
  return { tps, rows, warns, order, zmin, ex, tot, cut, changes, oz };
}
function sheetHTML(meta) {
  const st = S.stock, D = sheetData(), T = tr, sim = sheetSim(D.tps), M = S.machine, date = new Date().toLocaleDateString(LANG === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const has2 = D.tps.some(t => t.face === 2) || S.layers.some(l => l.face === 2), postL = T(postOf(M).label);
  const kv = (k, v) => '<tr><th>' + T(k) + '</th><td>' + v + '</td></tr>';
  const ext = isFinite(D.ex.x0) ? 'X ' + fL(D.ex.x0, 1) + ' → ' + fL(D.ex.x1, 1) + ' · Y ' + fL(D.ex.y0, 1) + ' → ' + fL(D.ex.y1, 1) : '—';
  const fig = (src, cap) => '<figure><div class="img">' + src + '</div><figcaption>' + T(cap) + '</figcaption></figure>';
  const zTxt = st.originZ === 'bottom' ? T('Table (dessous)') : T('Dessus du brut');
  let h = '<!doctype html><html lang="' + LANG + '"><head><meta charset="utf-8"><title>' + escH(T('Fiche de gamme') + ' — ' + (meta.name || 'COPO')) + '</title><style>'
    + '@font-face{font-family:"COPO Sans";font-weight:200 900;src:local("Source Sans 3"),url("lib/fonts/SourceSans3.ttf") format("truetype")}@font-face{font-family:"COPO Sans";font-style:italic;font-weight:200 900;src:local("Source Sans 3 Italic"),url("lib/fonts/SourceSans3-Italic.ttf") format("truetype")}'
    + '@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:10pt/1.4 "Source Sans 3","COPO Sans","Segoe UI",Arial,sans-serif;color:#1a1a1a;margin:0;padding:18px;background:#fff}'
    + 'header{display:flex;align-items:flex-start;gap:14px;border-bottom:2px solid #1a1a1a;padding-bottom:8px;margin-bottom:12px}header svg{width:34px;height:34px;flex:none}header h1{font-size:17pt;margin:0;line-height:1.1}header .sub{color:#555}header .meta{margin-left:auto;text-align:right;font-size:9pt;color:#333}'
    + 'h2{font-size:11.5pt;margin:16px 0 6px;padding-bottom:3px;border-bottom:1px solid #bbb;break-after:avoid}'
    + '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}table{border-collapse:collapse;width:100%}'
    + '.kv th{text-align:left;font-weight:600;color:#444;padding:3px 8px 3px 0;width:44%;vertical-align:top}.kv td{padding:3px 0;font-variant-numeric:tabular-nums}'
    + '.tb{font-size:8.4pt}.tb td:nth-child(2),.tb td:nth-child(5){min-width:22mm}.tb td:nth-child(4){min-width:20mm}.tb th{background:#eef0f3;text-align:left;padding:4px 5px;border:1px solid #c9ced6;font-weight:600}.tb td{padding:4px 5px;border:1px solid #d5d9e0;vertical-align:top;font-variant-numeric:tabular-nums}.tb td.n{text-align:right;white-space:nowrap}'
    + 'figure{margin:0;break-inside:avoid}figure .img{border:1px solid #ccc;border-radius:4px;padding:4px;background:#fff}figure img,figure svg{display:block;width:100%;height:auto}figcaption{font-size:8.5pt;color:#555;margin-top:3px}'
    + '.warn{border-left:3px solid #e8710a;background:#fff6ec;padding:6px 10px;margin:4px 0;break-inside:avoid}.ok{color:#188038}'
    + '.chk{list-style:none;padding:0;margin:0;columns:2;column-gap:20px}.chk li{padding:3px 0 3px 22px;position:relative;break-inside:avoid}.chk li::before{content:"";position:absolute;left:0;top:5px;width:12px;height:12px;border:1.5px solid #333;border-radius:2px}'
    + '.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:10px}.sign div{border-top:1px solid #333;padding-top:3px;font-size:8.5pt;color:#555;height:34px}'
    + '.notes{border:1px solid #ccc;border-radius:4px;padding:8px;min-height:50px;white-space:pre-wrap;break-inside:avoid}.leg span{display:inline-block;width:14px;height:3px;vertical-align:middle;margin:0 4px 0 10px}'
    + '.pb{break-before:page}footer{margin-top:14px;font-size:8pt;color:#777;border-top:1px solid #ddd;padding-top:5px}'
    + '@media print{body{padding:0}}</style></head><body>';
  h += '<header><svg viewBox="0 0 32 32" fill="none" stroke="#3560e6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 24h12"/><path d="M15 24c4.5 0 8-2.4 8.8-6 .8-3.7-1.6-7-5.2-7-3 0-5.2 2.4-4.8 5.1.3 2.3 2.5 3.6 4.5 2.8 1.7-.7 2.3-2.6 1.4-4"/><path d="M24 24h5"/></svg>'
    + '<div><h1>' + escH(meta.name || T('Projet COPO')) + '</h1><div class="sub">' + T('Fiche de gamme') + ' · ' + T('Usinage CNC') + '</div></div>'
    + '<div class="meta">' + escH(date) + '<br>' + T('Programme') + SEP() + escH(gcName()) + '<br>' + T('Post-processeur') + SEP() + escH(postL) + '</div></header>';
  h += '<div class="grid2"><div><h2>' + T('Brut et origine') + '</h2><table class="kv">'
    + kv('Matière', escH(meta.material || '—'))
    + kv('Dimensions', fn(st.w, 1) + ' × ' + fn(st.h, 1) + ' × ' + fn(st.t, 1) + ' mm')
    + kv('Origine X0 Y0', escH(cap1(T(originLabel(st)))))
    + kv('Zéro Z', zTxt)
    + (has2 ? kv('Retournement (face 2)', T(st.flip === 'y' ? 'Autour de l\'axe Y (gauche ↔ droite)' : 'Autour de l\'axe X (haut ↔ bas)')) : '')
    + kv('Z de sécurité', fn(M.safeZ, 1) + ' mm') + '</table></div>'
    + '<div><h2>' + T('Résumé') + '</h2><table class="kv">'
    + kv('Temps estimé', fmtTime(D.tot)) + kv('Parcours', String(D.rows.length)) + kv('Montages d’outil', String(D.changes))
    + kv('Profondeur maximale', fn(-D.zmin, 2) + ' mm' + (-D.zmin > st.t + 1e-6 ? ' <b style="color:#c5221f">(' + T('traverse le brut') + ')</b>' : ''))
    + kv('Emprise usinée (depuis l’origine)', ext)
    + kv('Longueur de coupe', (UNIT.len === 'in' ? fn(D.cut / 304.8, 1) + ' ft' : fn(D.cut / 1000, 2) + ' m'))
    + (sim ? kv('Volume enlevé (simulation)', (UNIT.len === 'in' ? fn(sim.vol / 16387.064, 1) + ' in³' : fn(sim.vol / 1000, 1) + ' cm³')) : '') + '</table></div></div>';
  h += '<h2>' + T('Vues de la pièce') + '</h2><div class="grid2">' + fig(sheetSvg2D(1, D.tps), 'Face 1 (dessus) · dessin, parcours et origine') + (has2 ? fig(sheetSvg2D(2, D.tps), 'Face 2 (dessous) · pièce retournée, telle que sur la machine') : (sim ? fig('<img src="' + sim.f1 + '" alt="">', 'Face 1 · vue dimétrique de la simulation') : '')) + '</div>';
  h += '<p class="leg" style="font-size:8.5pt;color:#555;margin:4px 0 0">' + T('Parcours') + ' :<span style="background:' + tok('--pf') + '"></span>' + T('Profil') + '<span style="background:' + tok('--pk') + '"></span>' + T('Poche') + '<span style="background:' + tok('--vc') + '"></span>V-carving<span style="background:' + tok('--dr') + '"></span>' + T('Perçage') + (S.tps.some(t => t.type === 'thread') ? '<span style="background:' + tok('--th') + '"></span>' + T('Filetage') : '') + '</p>';
  if (sim) h += '<div class="grid2" style="margin-top:10px">' + (has2 ? fig('<img src="' + sim.f1 + '" alt="">', 'Face 1 · vue dimétrique de la simulation') : '') + fig('<img src="' + sim.f2 + '" alt="">', 'Face 2 · vue dimétrique de la simulation (pièce retournée)') + '</div>';
  h += '<h2 class="pb">' + T('Ordre de montage des outils') + '</h2><table class="tb"><thead><tr><th>#</th><th>' + T('Outil') + '</th><th>T</th><th>' + T('Type') + '</th><th>Ø mm</th><th>' + T('Broche tr/min') + '</th><th>' + T('Avance mm/min') + '</th><th>' + T('Plongée mm/min') + '</th><th>' + T('Parcours') + '</th></tr></thead><tbody>';
  D.order.forEach((o, i) => { const t = o.tool; h += '<tr><td class="n">' + (i + 1) + '</td><td><b>' + escH(t.name) + '</b>' + (o.face === 2 ? ' <i>(F2)</i>' : '') + '</td><td class="n">' + (t.num || '—') + '</td><td>' + T(TOOLTYPE_LBL[t.type] || '') + (t.type === 'v' ? ' ' + (t.angle || 90) + '°' : '') + '</td><td class="n">' + fL(+t.dia || 0, 2) + '</td><td class="n">' + Math.round(t.rpm || 0) + '</td><td class="n">' + fFd(t.feed || 0) + '</td><td class="n">' + fFd(t.plunge || 0) + '</td><td>' + o.names.map(escH).join(', ') + '</td></tr>'; });
  h += '</tbody></table>';
  h += '<h2>' + T('Parcours d’outils') + '</h2><table class="tb"><thead><tr><th>#</th><th>' + T('Parcours') + '</th><th>F</th><th>' + T('Opération') + '</th><th>' + T('Outil') + '</th><th>' + T('Prof. mm') + '</th><th>' + T('Passes') + '</th><th>' + T('Surép.') + '</th><th>' + T('Entrée') + '</th><th>' + T('Ponts') + '</th><th>' + T('Avance / plongée') + '</th><th>' + T('Temps') + '</th></tr></thead><tbody>';
  for (const r of D.rows) h += '<tr><td class="n">' + r.n + '</td><td><b>' + escH(r.name) + '</b></td><td class="n">' + r.face + '</td><td>' + escH(r.kind) + '</td><td>' + escH(r.tool.name || '?') + ' <small>(T' + (r.tool.num || '—') + ')</small></td><td class="n">' + r.depth + '</td><td class="n">' + r.nP + '</td><td class="n">' + r.allow + '</td><td>' + escH(r.entry) + '</td><td class="n">' + r.tabs + '</td><td class="n">' + fFd(r.tool.feed || 0) + ' / ' + fFd(r.tool.plunge || 0) + '</td><td class="n">' + fmtTime(r.time) + '</td></tr>';
  h += '<tr><td colspan="11" style="text-align:right;font-weight:600">' + T('Total') + '</td><td class="n"><b>' + fmtTime(D.tot) + '</b></td></tr></tbody></table>';
  h += '<p style="font-size:8.5pt;color:#555;margin:4px 0">' + T('Passes : nombre × profondeur de passe (mm). Ponts : nombre × longueur × épaisseur (mm). Temps estimé avec les rapides à ') + Math.round(M.rapid) + ' mm/min.</p>';
  h += '<h2>' + T('Points de vigilance') + '</h2>' + (D.warns.length ? D.warns.map(w => '<div class="warn">' + escH(w) + '</div>').join('') : '<p class="ok">' + T('Aucun point particulier détecté.') + '</p>');
  const ck = [T('Brut fixé, brides et vis hors des parcours'), T('Planche martyr en place si l’usinage traverse'), ...[...new Map(D.order.map(o => [o.tool.id, o.tool])).values()].map(t => T('Outil monté et serré') + SEP() + t.name), T('Zéro X Y pris au point') + SEP() + T(originLabel(st)), T('Zéro Z pris sur') + SEP() + zTxt.toLowerCase(), T('Aspiration en marche'), T('Passage à vide effectué, outil au-dessus du brut'), T('Lunettes et protection auditive')];
  if (has2) ck.splice(5, 0, T('Repères ou pions de centrage pour le retournement'));
  h += '<h2>' + T('Avant de lancer') + '</h2><ul class="chk">' + ck.map(c => '<li>' + escH(c) + '</li>').join('') + '</ul>';
  h += '<h2>' + T('Remarques') + '</h2><div class="notes">' + escH(meta.notes || '') + '</div>';
  h += '<div class="sign"><div>' + T('Préparé par') + '</div><div>' + T('Usiné par / date') + '</div><div>' + T('Contrôle') + '</div></div>';
  h += '<footer>COPO ' + COPO_VERSION + ' · ' + T('Fiche générée le') + ' ' + escH(date) + ' · ' + T('Vérifiez toujours le G-code par un passage à vide avant d\'usiner.') + '</footer></body></html>';
  const bi = h.indexOf('<body>'), fx = t => { if (uOn()) t = uConv(t); return LANG === 'en' ? t.replace(/(\d),(\d)/g, '$1.$2') : t; }; return uOn() || LANG === 'en' ? h.slice(0, bi) + h.slice(bi).replace(/>([^<]+)</g, (x, t) => '>' + fx(t) + '<') : h; // unités et, en anglais, point décimal (texte seulement, jamais les attributs ni le dessin)
}
function sheetOpen() {
  if (!gcTps().length) { toast('Aucun parcours à mettre dans la fiche : calculez d’abord un parcours.'); return; }
  S.meta = S.meta || {}; $('#shName').value = S.meta.name || ''; $('#shMat').value = S.meta.material || ''; $('#shNotes').value = S.meta.notes || '';
  $('#shPrint').hidden = !!window.claude; $('#sheet').hidden = false; closeMenus(); setTimeout(sheetRefresh, 30);
}
function sheetRefresh() {
  S.meta = { name: $('#shName').value.trim(), material: $('#shMat').value.trim(), notes: $('#shNotes').value }; autosave();
  const t0 = performance.now(); let html; try { html = sheetHTML(S.meta); } catch (e) { console.error(e); toast('La fiche n’a pas pu être créée.'); return; }
  sheetLast = html; $('#shFrame').srcdoc = html; $('#shInfo').textContent = ''; $('#shFrame').title = tr('Aperçu de la fiche de gamme') + ' (' + Math.round(performance.now() - t0) + ' ms)';
}
let sheetLast = '';
