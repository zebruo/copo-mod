// ---------- panneau G-code ----------
$$('input[name=mTcMode]').forEach(r => r.addEventListener('change', e => { if (!e.target.checked) return; S.machine.tcMode = e.target.value === 'post' ? undefined : e.target.value; tcSync(); autosave(); gcDirty = true; renderGcode(); }));
[['#mTcPause', 'tcPause'], ['#mTcA', 'tcA'], ['#mTcB', 'tcB']].forEach(([id, k]) => $(id).addEventListener('change', e => { S.machine[k] = e.target.value; tcSync(); autosave(); gcDirty = true; renderGcode(); }));
$('#mTcN').addEventListener('change', e => { S.machine.tcN = e.target.checked; tcSync(); autosave(); gcDirty = true; renderGcode(); });
$('#mTcOn').addEventListener('change', e => { S.machine.tcOn = e.target.checked; $('#mTcZRow').hidden = !e.target.checked; autosave(); gcDirty = true; renderGcode(); });
$('#mTcZ').addEventListener('change', e => { const v = +e.target.value; if (!isFinite(v)) return; S.machine.tcZ = v; autosave(); gcDirty = true; renderGcode(); });
$('#uLen').onchange = e => setUnits({ len: e.target.value, feed: e.target.value === 'in' ? 'in/min' : 'mm/min' });
$('#uFeed').onchange = e => setUnits({ feed: e.target.value });
$('#uFrac').onchange = e => setUnits({ frac: e.target.checked });
$('#mG20').onchange = e => { S.machine.g20 = e.target.checked; autosave(); gcDirty = true; renderGcode(); };
function postSelFill() {
  const sel = $('#mPost'); sel.innerHTML = ''; const add = (par, k, lbl) => { const o = document.createElement('option'); o.value = k; o.textContent = lbl; par.appendChild(o); };
  for (const [k, p] of Object.entries(POSTS)) if (!p.group) add(sel, k, p.label);
  const g1 = document.createElement('optgroup'); g1.label = tr('Autres machines (format .pp)'); for (const [k, p] of Object.entries(POSTS)) if (p.group === 'vp') add(g1, k, LANG !== 'fr' && I18N_EN[p.label] !== undefined ? I18N_EN[p.label] : p.label); sel.appendChild(g1);
  const imp = vpUserList(); if (String(S.machine.post).startsWith('vpu:') && S.machine.vpText && !imp.some(x => 'vpu:' + x.id === S.machine.post)) imp.push({ id: S.machine.post.slice(4), name: S.machine.vpName || '?', text: S.machine.vpText });
  if (imp.length) { const g2 = document.createElement('optgroup'); g2.label = tr('Importés'); for (const x of imp) add(g2, 'vpu:' + x.id, x.name); sel.appendChild(g2); }
  vpUiSync();
}
function vpJetWarn(M) { const P = postOf(M || S.machine); if (!P.vp) return ''; const B = vpGet(P.vp).blocks, jetty = !!B.JET_TOOL_ON || (!!B.PLUNGE_MOVE && !B.PLUNGE_MOVE.some(t => /\[Z\]/i.test(t))); if (!jetty) return '';
  const bad = S.tps.filter(t => t.visible && (t.type === 'profile' || t.type === 'pocket') && (t.p.entry || 'plunge') !== 'plunge'); return bad.length ? trf('Ce post-processeur allume l’outil (jet, laser) à la plongée : {n} parcours ont une entrée en rampe, en arc ou en hélice, l’outil ne s’y allumerait pas. Choisissez « Plongée droite » pour ces parcours.', { n: bad.length }) : tr('Ce post-processeur allume l’outil (jet, laser) à la plongée : gardez l’entrée « Plongée droite » pour vos parcours.'); }
function vpUiSync() { if (typeof tcSync === 'function') tcSync(); const P = postOf(S.machine), vp = !!P.vp, h = $('#mVpHint'); $('#vpRemove').hidden = !String(S.machine.post).startsWith('vpu:'); $('#mCycRow').hidden = vp; $('#mComments').closest('label').hidden = vp;
  if (h) { h.hidden = !vp; if (vp) { const d = vpGet(P.vp); h.textContent = trf('Post-processeur au format .pp : unités ({u}), format des nombres, en-tête, changement d’outil et fin du programme viennent de sa définition ; fichier .{e}.', { u: d.inch ? tr('pouces') : 'mm', e: d.ext }) + (d.ignored.length ? ' ' + trf('Blocs non gérés, ignorés : {b}.', { b: d.ignored.join(', ') }) : '') + (vpJetWarn() ? ' ' + vpJetWarn() : '') + (/Drilloffset/.test(P.vp) ? ' ' + tr('Perceuse pneumatique ShopBot : à utiliser seulement avec des parcours de Perçage ; la machine doit avoir ses fichiers de décalage des perceuses (C#,90) configurés.') : ''); } } }
function tcSync() { const M = S.machine, P = postOf(M), m = ['none', 'pause', 'cmd'].includes(M.tcMode) ? M.tcMode : 'post'; const box = $('#mTcBox'); if (!box) return; box.hidden = !!P.vp;
  box.querySelectorAll('input[name=mTcMode]').forEach(r => r.checked = r.value === m); $('#mTcPause').value = M.tcPause ?? 'M0'; $('#mTcA').value = M.tcA ?? 'T'; $('#mTcN').checked = M.tcN !== false; $('#mTcB').value = M.tcB ?? ' M6';
  $('#mTcPause').disabled = m !== 'pause'; ['#mTcA', '#mTcN', '#mTcB'].forEach(id => $(id).disabled = m !== 'cmd');
  const n = 6, ex = m === 'none' ? tr('aucune ligne (l’outil n’est indiqué qu’en commentaire)') : m === 'pause' ? '« ' + (M.tcPause || 'M0') + ' »' : m === 'cmd' ? '« ' + String(M.tcA ?? 'T') + (M.tcN !== false ? n : '') + String(M.tcB ?? ' M6') + ' »' : tr('celui du post-processeur choisi');
  $('#mTcEx').textContent = tr('Exemple pour l’outil n° 6 :') + ' ' + ex; }
function syncMachine() {
  postSelFill(); tcSync();
  if (!POSTS[S.machine.post] && !(String(S.machine.post).startsWith('vpu:') && S.machine.vpText)) S.machine.post = 'grbl';
  const cp = { ...CUSTOM_POST(), ...(S.machine.custom || {}) }; $('#mcHead').value = cp.head; $('#mcTc').value = cp.tc; $('#mcFoot').value = cp.foot; $('#mcExt').value = cp.ext; $('#mcG911').checked = !!cp.g911; $('#mCustom').hidden = S.machine.post !== 'custom';
  cycSync(); $('#mPost').value = S.machine.post; $('#mRapid').value = S.machine.rapid; $('#mMaxFeed').value = S.machine.maxFeed || 2000; $('#mSafe').value = S.machine.safeZ; $('#mClear').value = S.machine.clearZ; $('#mComments').checked = S.machine.comments; $('#mArcs').checked = S.machine.arcs !== false; $('#mTcZ').value = S.machine.tcZ === undefined ? -10 : S.machine.tcZ; $('#mTcRow').hidden = S.machine.post !== 'grblm' && S.machine.post !== 'custom'; $('#mTcOn').checked = !!S.machine.tcOn; $('#mTcZRow').hidden = !S.machine.tcOn; }
[['#mPost', 'post', 0], ['#mRapid', 'rapid', 1], ['#mSafe', 'safeZ', 1], ['#mClear', 'clearZ', 1]].forEach(([id, k, n]) => $(id).addEventListener('change', e => { const v = n ? +e.target.value : e.target.value; if (n && !(v > 0)) return; S.machine[k] = v; autosave(); if (k === 'post') { $('#mTcRow').hidden = v !== 'grblm' && v !== 'custom'; $('#mCustom').hidden = v !== 'custom'; pjSummary(); gcDirty = true; renderGcode(); } else recomputeAll(); }));
$('#gcFace').onchange = () => { gcDirty = true; renderGcode(); };
[['#mcHead', 'head'], ['#mcTc', 'tc'], ['#mcFoot', 'foot'], ['#mcExt', 'ext'], ['#mcG911', 'g911']].forEach(([id, k]) => $(id).addEventListener('change', e => { S.machine.custom = { ...CUSTOM_POST(), ...(S.machine.custom || {}), [k]: e.target.type === 'checkbox' ? e.target.checked : (k === 'ext' ? e.target.value.replace(/[^\w]/g, '') || 'nc' : e.target.value) }; autosave(); gcDirty = true; renderGcode(); }));
$('#mMaxFeed').addEventListener('change', e => { const v = +e.target.value; if (!(v > 0)) return; S.machine.maxFeed = v; autosave(); libSyncProject(); libRender(); gcDirty = true; });
function cycSync() { $('#mCyc').checked = S.machine.cycles === undefined ? !!postOf(S.machine).cyc : !!S.machine.cycles; }
$('#mCyc').onchange = e => { S.machine.cycles = e.target.checked; autosave(); gcDirty = true; renderGcode(); };
$('#mPost').addEventListener('change', () => { setTimeout(rotAxSync, 0); const v = S.machine.post; if (String(v).startsWith('vpu:')) { const x = vpUserList().find(q => 'vpu:' + q.id === v); if (x) { S.machine.vpText = x.text; S.machine.vpName = x.name; } } vpUiSync(); pjSummary(); delete S.machine.cycles; autosave(); cycSync(); gcDirty = true; renderGcode(); });
$('#fVp').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; f.text().then(t => { const d = vpParse(t); if (!d.ok) return toast(tr('Ce fichier ne ressemble pas à un post-processeur .pp (blocs RAPID_MOVE et FEED_MOVE introuvables).'));
  const id = uid(), name = d.name || f.name.replace(/\.[^.]+$/, ''), list = vpUserList().filter(x => x.name !== name); list.push({ id, name, text: t }); try { LS.set('copo.vposts', JSON.stringify(list)); } catch { }
  S.machine.post = 'vpu:' + id; S.machine.vpText = t; S.machine.vpName = name; autosave(); syncMachine(); pjSummary(); gcDirty = true; renderGcode();
  toast(trf('Post-processeur « {n} » importé.', { n: name }) + (d.ignored.length ? ' ' + trf('Blocs non gérés, ignorés : {b}.', { b: d.ignored.join(', ') }) : '')); }); };
$('#mArcs').onchange = e => { S.machine.arcs = e.target.checked; autosave(); gcDirty = true; renderGcode(); };
$('#mComments').onchange = e => { S.machine.comments = e.target.checked; autosave(); gcDirty = true; renderGcode(); };
function gcTps() { const m = $('#gcFace').value, all = S.tps.filter(t => t.visible && !t.err && t.moves && t.moves.length); const f1 = all.filter(t => t.face !== 2), f2 = all.filter(t => t.face === 2); return m === '1' ? f1 : m === '2' ? f2 : f1.concat(f2); }
// deux outils différents du programme avec le même numéro : la machine prendrait le mauvais
function gcNumWarn(tps) { const by = new Map(); for (const tp of tps) { const t = S.tools.find(x => x.id === tp.toolId); if (!t) continue; const n = +t.num || 1; if (!by.has(n)) by.set(n, new Map()); by.get(n).set(t.id, t.name); }
  const bad = [...by].filter(([, m]) => m.size > 1); return bad.length ? ' · ⚠ ' + bad.map(([n, m]) => trf('T{n} est utilisé par plusieurs outils ({l}) : la machine prendrait le mauvais. Changez le numéro dans la bibliothèque d’outils', { n, l: [...m.values()].join(', ') })).join(' · ') : ''; }
function renderGcode() { if (!gcDirty) return; const tps = gcTps(); const g = makeGcode(tps, S.tools, S.stock, machineEff()); $('#gcOut').value = g; const lines = g.split('\n').length - 1, tot = tps.reduce((a, t) => a + ((t.stats && t.stats.min) || 0), 0); $('#gcStats').textContent = lines + ' lignes · ' + fmtTime(tot) + gcNumWarn(tps) + (vpJetWarn() && S.tps.some(t => t.visible && (t.type === 'profile' || t.type === 'pocket') && (t.p.entry || 'plunge') !== 'plunge') ? ' · ⚠ ' + vpJetWarn() : ''); gcDirty = false; }


// ======================================================================
// Aperçu 3D : simulation par carte de hauteurs + rendu WebGL2
// ======================================================================
/*SIM-START*/
function toolProf(tool) {
  const r = tool.dia / 2, th = Math.tan((+tool.angle || 90) * Math.PI / 360), R = +tool.tipR || 0;
  if (tool.type === 'ball') return d => r - Math.sqrt(Math.max(0, r * r - d * d));
  if ((tool.type === 'v') && R > 0) { const b = Math.atan(th), rt = R * Math.cos(b), ht = R * (1 - Math.sin(b)); return d => d <= rt ? R - Math.sqrt(Math.max(0, R * R - d * d)) : ht + (d - rt) / th; }
  if (tool.type === 'v' && +tool.flat > 0) { const fr = +tool.flat / 2; return d => d <= fr ? 0 : (d - fr) / th; }
  if (tool.type === 'v' || tool.type === 'drill') return d => d / th;
  return () => 0;
}
// hauteur de la pointe de l'outil posé sur le relief en (x, y) : maximum du relief moins le profil de la fraise sur son empreinte
function relProjector(tool) {
  const st = S.stock; let c = Math.max(0.05, Math.min(0.2, tool.dia / 30)); while ((st.w / c + 1) * (st.h / c + 1) > 6e6) c *= 1.2;
  // le bord de la fraise ne compte qu'à une maille près (grille de calcul + grille du relief) : une fraise qui longe une paroi verticale (contour du relief) ne saute plus d'une maille à l'autre entre le haut et le bas de la paroi
  const R = reliefCompose(c, true), { nx, ny, cx, cy, M } = R, H = R.H.map((v, q) => M[q] ? v : 0), gc = Math.max(0, ...S.relief.items.filter(i => i.visible && relGrid[i.id]).map(i => Math.max(i.w / relGrid[i.id].nx, i.h / relGrid[i.id].ny))), K = toolKernel(tool, cx, cy, Math.min(0.3, Math.max(cx, cy) * 0.75 + gc)), memo = new Float32Array(nx * ny).fill(NaN); // hors du relief : dessus du brut (jamais plus profond par surprise)
  const hc = (i, j) => { const q = j * nx + i; let v = memo[q]; if (v === v) return v; v = -Infinity; const { di, dj, dz, n } = K; for (let k = 0; k < n; k++) { const a = i + di[k], b = j + dj[k]; if (a < 0 || b < 0 || a >= nx || b >= ny) continue; const h = H[b * nx + a] - dz[k]; if (h > v) v = h; } if (v === -Infinity) v = R.base; memo[q] = v; return v; };
  const f = (x, y) => { const X = Math.max(0, Math.min(nx - 1.000001, x / cx)), Y = Math.max(0, Math.min(ny - 1.000001, y / cy)), i = Math.floor(X), j = Math.floor(Y), a = X - i, b = Y - j; return (hc(i, j) * (1 - a) + hc(i + 1, j) * a) * (1 - b) + (hc(i, j + 1) * (1 - a) + hc(i + 1, j + 1) * a) * b; };
  f.step = Math.max(0.1, Math.min(0.5, c * 1.5)); return f;
}
// les points sous le dessus du brut (z < 0) descendent de la hauteur du relief ; les segments sont redécoupés pour suivre la surface
function projectMoves(moves, zAt) {
  const out = [], step = zAt.step || 0.3, Z = (x, y, z) => z < 0 ? zAt(x, y) + z : z; let px = null, py = 0, pz = 0;
  for (const m of moves) {
    if (m.g !== 0 && m.g !== 1 || typeof m.x !== 'number') { out.push(m); continue; }
    if (m.g === 1 && px !== null && (pz < 0 || m.z < 0)) { const d = Math.hypot(m.x - px, m.y - py), n = Math.max(1, Math.ceil(d / step)); for (let k = 1; k <= n; k++) { const t = k / n, x = px + (m.x - px) * t, y = py + (m.y - py) * t, z = pz + (m.z - pz) * t; out.push({ ...m, x, y, z: Z(x, y, z) }); } }
    else out.push(m.z < 0 ? { ...m, z: Z(m.x, m.y, m.z) } : m);
    px = m.x; py = m.y; pz = m.z;
  }
  return out;
}
function toolKernel(tool, cx, cy, tol) {
  const r = tool.dia / 2 - (tol || 0), pf = toolProf(tool), ni = Math.ceil(r / cx) + 1, nj = Math.ceil(r / cy) + 1, di = [], dj = [], dz = [];
  for (let j = -nj; j <= nj; j++) for (let i = -ni; i <= ni; i++) {
    const d = Math.hypot(i * cx, j * cy); if (d > r + 1e-9) continue;
    di.push(i); dj.push(j); dz.push(pf(d));
  }
  return { di: Int32Array.from(di), dj: Int32Array.from(dj), dz: Float32Array.from(dz), n: di.length };
}
function makeSim(stock, tps, tools, rapid, target) {
  const w = stock.w, h = stock.h, t = stock.t;
  // zone réellement usinée (passes sous le dessus du brut, élargies du rayon de l'outil) : la grille ne couvre qu'elle, le reste du brut est dessiné plein
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (const tp of tps) { const tool = tools.find(x => x.id === tp.toolId); if (!tool || !tp.moves) continue; const r = (+tool.dia || 6) / 2 + 2; let p = null;
    for (const m of (tp.dmoves || tp.moves)) { if (m.g === 4) continue; if (p && (m.z < 0 || p[2] < 0)) { X0 = Math.min(X0, m.x - r, p[0] - r); Y0 = Math.min(Y0, m.y - r, p[1] - r); X1 = Math.max(X1, m.x + r, p[0] + r); Y1 = Math.max(Y1, m.y + r, p[1] + r); } p = [m.x, m.y, m.z]; } }
  X0 = Math.max(0, X0); Y0 = Math.max(0, Y0); X1 = Math.min(w, X1); Y1 = Math.min(h, Y1);
  if (!(X1 - X0 > 1 && Y1 - Y0 > 1) || (X1 - X0) * (Y1 - Y0) > 0.8 * w * h || (stock.rotary && stock.rotary.on)) { X0 = 0; Y0 = 0; X1 = w; Y1 = h; } // rotatif : tout le cylindre
  const RW = X1 - X0, RH = Y1 - Y0, cell = Math.max(0.03, Math.sqrt(RW * RH / target));
  const nx = Math.max(2, Math.round(RW / cell) + 1), ny = Math.max(2, Math.round(RH / cell) + 1), cx = RW / (nx - 1), cy = RH / (ny - 1);
  const segs = [], cum = [], kern = new Map(), thr = []; let T = 0;
  for (const tp of tps) {
    const tool = tools.find(x => x.id === tp.toolId); if (!tool || !tp.moves) continue;
    if (!kern.has(tool.id)) kern.set(tool.id, toolKernel(tool, cx, cy));
    const K = kern.get(tool.id), face = tp.face === 2 ? 2 : 1; let p = null;
    for (const m of (tp.dmoves || tp.moves)) {
      if (m.g === 4) { T += (m.p || 0) / 60; continue; }
      if (m.thS && tp.threads && tp.threads[m.thS - 1]) thr.push({ g: tp.threads[m.thS - 1], face, t0: T, t1: T });
      if (p) { const len = Math.hypot(m.x - p[0], m.y - p[1], m.z - p[2]), dt = len / (m.g === 0 ? rapid : (m.f || 1000)); segs.push({ a: p, b: [m.x, m.y, m.z], K, tool, g: m.g, face, tp: tp.id, type: tp.type }); T += dt; cum.push(T); }
      if (m.thE && thr.length) thr[thr.length - 1].t1 = T;
      p = [m.x, m.y, m.z];
    }
  }
  const B = new Float32Array(nx * ny); B.fill(-t); return { w, h, t, ox: X0, oy: Y0, nx, ny, cx, cy, H: new Float32Array(nx * ny), B, floor: -t - 0.01, segs, cum, thr, total: T, idx: 0, frac: 0, has2: segs.some(q => q.face === 2) };
}
/* petite empreinte (quelques dizaines de points) : le calcul direct est plus rapide */
function simStampD(S3, x, y, z, K, face) {
  const { nx, ny, cx, cy, H, B, floor, t } = S3, ci = Math.round((x - (S3.ox || 0)) / cx), cj = Math.round((y - (S3.oy || 0)) / cy), { di, dj, dz, n } = K;
  if (face === 2) { for (let k = 0; k < n; k++) { const i = ci + di[k], j = cj + dj[k]; if (i < 0 || j < 0 || i >= nx || j >= ny) continue; const q = j * nx + i, v = -t - (z + dz[k]); if (v > B[q]) B[q] = v > 0.01 ? 0.01 : v; } return; }
  for (let k = 0; k < n; k++) { const i = ci + di[k], j = cj + dj[k]; if (i < 0 || j < 0 || i >= nx || j >= ny) continue; const q = j * nx + i, v = z + dz[k]; if (v < H[q]) H[q] = v < floor ? floor : v; }
}
function simSegD(S3, s, f0, f1) {
  const a = s.a, b = s.b; if (a[2] >= 0 && b[2] >= 0) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * (f1 - f0), st = Math.max(1, Math.ceil(len / (Math.min(S3.cx, S3.cy) * 0.5)));
  for (let k = 0; k <= st; k++) { const f = f0 + (f1 - f0) * k / st, z = a[2] + (b[2] - a[2]) * f; if (z >= 0) continue; simStampD(S3, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, z, s.K, s.face); }
}
/* empreinte rangée par lignes (j) : début et longueur de chaque ligne, pour des boucles contiguës */
function kRows(K) {
  if (K.rows) return K.rows; const { di, dj, n } = K, J = [], I0 = [], S0 = [], N = [];
  for (let k = 0; k < n; k++) { const r = J.length - 1; if (r >= 0 && dj[k] === J[r] && di[k] === I0[r] + N[r]) N[r]++; else { J.push(dj[k]); I0.push(di[k]); S0.push(k); N.push(1); } }
  return (K.rows = { J: Int32Array.from(J), I0: Int32Array.from(I0), S0: Int32Array.from(S0), N: Int32Array.from(N), nr: J.length });
}
/* empreinte décalée d'une maille (sx, sy) depuis le tampon précédent. Pour chaque point : m = de combien la fraise était déjà plus basse au tampon précédent (Infinity s'il n'était pas couvert).
   Un point ne peut changer que si m > écart de Z. On prépare, pour quelques seuils, la plage de chaque ligne à traiter (plage un peu trop large = toujours exact). */
function kShift(K, sx, sy) {
  const key = (sy + 1) * 3 + sx + 1; K.sh = K.sh || []; if (K.sh[key]) return K.sh[key];
  const R = kRows(K), { di, dj, dz, n } = K; if (!K.at) { K.at = new Map(); for (let k = 0; k < n; k++) K.at.set((di[k] + 4096) * 8192 + dj[k] + 4096, k); }
  const m = new Float64Array(n), fin = [];
  for (let k = 0; k < n; k++) { const o = K.at.get((di[k] + sx + 4096) * 8192 + dj[k] + sy + 4096); m[k] = o === undefined ? Infinity : dz[o] - dz[k]; if (o !== undefined) fin.push(m[k]); }
  fin.sort((a, b) => a - b); const lv = [0]; for (let q = 1; q < 24; q++) lv.push(fin[Math.floor((fin.length - 1) * q / 24)]); if (fin.length) lv.push(fin[fin.length - 1]);
  const LV = Float64Array.from([...new Set(lv)].sort((a, b) => a - b)), nl = LV.length, lo = new Int32Array(nl * R.nr), hi = new Int32Array(nl * R.nr);
  for (let t = 0; t < nl; t++) for (let r = 0; r < R.nr; r++) { let a = -1, b = -2; for (let u = 0; u < R.N[r]; u++) if (m[R.S0[r] + u] > LV[t]) { if (a < 0) a = u; b = u; } lo[t * R.nr + r] = a < 0 ? 0 : a; hi[t * R.nr + r] = b; }
  return (K.sh[key] = { LV, lo, hi });
}
/* tampon de l'outil centré sur la maille (ci, cj) à la hauteur z. Résultat identique à l'empreinte complète : on saute seulement les points où le tampon précédent du même outil (une maille plus loin au plus) était déjà aussi bas */
function simStampC(S3, ci, cj, z, K, face) {
  const { nx, ny, H, B, floor, t } = S3, { dz } = K, R = kRows(K), L = S3.last; let sh = null, base = 0;
  if (L && L.K === K && L.face === face && Math.abs(ci - L.ci) <= 1 && Math.abs(cj - L.cj) <= 1) {
    const d = z - L.z, lim = d >= 0 ? Math.max(0, d - 1e-9) : d - 1e-9; /* Z égal ou plus haut et m <= 0 : rien ne change (comparaison exacte) */
    if (lim >= 0 || ci !== L.ci || cj !== L.cj) { sh = kShift(K, ci - L.ci, cj - L.cj); const LV = sh.LV; let tl = -1; for (let q = LV.length - 1; q >= 0; q--) if (LV[q] <= lim) { tl = q; break; } if (tl < 0) sh = null; else base = tl * R.nr; }
  }
  if (L) { L.K = K; L.face = face; L.ci = ci; L.cj = cj; L.z = z; } else S3.last = { K, face, ci, cj, z };
  for (let r = 0; r < R.nr; r++) {
    const j = cj + R.J[r]; if (j < 0 || j >= ny) continue;
    let a = 0, b = R.N[r] - 1; if (sh) { a = sh.lo[base + r]; b = sh.hi[base + r]; if (b < a) continue; }
    const i0 = ci + R.I0[r]; if (i0 + a < 0) a = -i0; if (i0 + b > nx - 1) b = nx - 1 - i0; if (b < a) continue;
    const row = j * nx + i0, s0 = R.S0[r];
    if (face === 2) { for (let u = a; u <= b; u++) { const q = row + u, v = -t - (z + dz[s0 + u]); if (v > B[q]) B[q] = v > 0.01 ? 0.01 : v; } }
    else for (let u = a; u <= b; u++) { const q = row + u, v = z + dz[s0 + u]; if (v < H[q]) H[q] = v < floor ? floor : v; }
  }
}
function simStamp(S3, x, y, z, K, face) { simStampC(S3, Math.round((x - (S3.ox || 0)) / S3.cx), Math.round((y - (S3.oy || 0)) / S3.cy), z, K, face); }
/* dans un même appel, l'ordre des tampons ne change rien (on garde toujours le plus bas) : les échantillons successifs sur la même maille sont fusionnés (seul le plus bas compte), et un segment qui descend est parcouru à l'envers, du point le plus bas au plus haut, pour que chaque tampon soit presque entièrement couvert par le précédent. L'état à la fin de l'appel est identique */
function simSeg(S3, s, f0, f1) {
  if (s.K.n < 30) return simSegD(S3, s, f0, f1);
  const a = s.a, b = s.b; if (a[2] >= 0 && b[2] >= 0) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * (f1 - f0), st = Math.max(1, Math.ceil(len / (Math.min(S3.cx, S3.cy) * 0.5))), ox = S3.ox || 0, oy = S3.oy || 0;
  let pi = 0, pj = 0, pz = 0, has = false;
  const down = b[2] < a[2];
  for (let kk = 0; kk <= st; kk++) { const k = down ? st - kk : kk, f = f0 + (f1 - f0) * k / st, z = a[2] + (b[2] - a[2]) * f; if (z >= 0) continue;
    const ci = Math.round((a[0] + (b[0] - a[0]) * f - ox) / S3.cx), cj = Math.round((a[1] + (b[1] - a[1]) * f - oy) / S3.cy);
    if (has && ci === pi && cj === pj) { if (z < pz) pz = z; continue; }
    if (has) simStampC(S3, pi, pj, pz, s.K, s.face); pi = ci; pj = cj; pz = z; has = true; }
  if (has) simStampC(S3, pi, pj, pz, s.K, s.face);
}
function simReset(S3) { S3.last = null; S3.H.fill(0); S3.B.fill(-S3.t); S3.idx = 0; S3.frac = 0; }
function simTo(S3, T) { // avance (seulement) jusqu'au temps T ; renvoie la position de l'outil
  const { segs, cum } = S3;
  while (S3.idx < segs.length) {
    const s = segs[S3.idx], t1 = cum[S3.idx], t0 = S3.idx ? cum[S3.idx - 1] : 0;
    if (T >= t1) { simSeg(S3, s, S3.frac, 1); S3.idx++; S3.frac = 0; continue; }
    const f = t1 > t0 ? Math.max(0, (T - t0) / (t1 - t0)) : 1; if (f > S3.frac) { simSeg(S3, s, S3.frac, f); S3.frac = f; }
    const a = s.a, b = s.b; return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], tool: s.tool, face: s.face };
  }
  const l = segs[segs.length - 1]; return l ? { p: l.b.slice(), tool: l.tool, face: l.face } : null;
}
/*SIM-END*/

const V3 = { gl: null, S3: null, playing: false, T: 0, last: 0, yaw: -Math.PI / 2 + 0.35, pitch: 0.75, dist: 500, tgt: [0, 0, 0], dirty: true, raf: 0, toolMesh: new Map(), cur: null };
function m4mul(a, b) { const r = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } return r; }
function m4persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; }
const v3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v3cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], v3n = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// caméra : vecteur haut continu (on peut tourner au-delà de la verticale, sans retournement brusque)
function camUp(ST) { const sp = Math.sin(ST.pitch); return [-Math.cos(ST.yaw) * sp, -Math.sin(ST.yaw) * sp, Math.cos(ST.pitch)]; }
function m4inv(a) { const o = new Array(16);
  o[0] = a[5]*a[10]*a[15]-a[5]*a[11]*a[14]-a[9]*a[6]*a[15]+a[9]*a[7]*a[14]+a[13]*a[6]*a[11]-a[13]*a[7]*a[10]; o[4] = -a[4]*a[10]*a[15]+a[4]*a[11]*a[14]+a[8]*a[6]*a[15]-a[8]*a[7]*a[14]-a[12]*a[6]*a[11]+a[12]*a[7]*a[10]; o[8] = a[4]*a[9]*a[15]-a[4]*a[11]*a[13]-a[8]*a[5]*a[15]+a[8]*a[7]*a[13]+a[12]*a[5]*a[11]-a[12]*a[7]*a[9]; o[12] = -a[4]*a[9]*a[14]+a[4]*a[10]*a[13]+a[8]*a[5]*a[14]-a[8]*a[6]*a[13]-a[12]*a[5]*a[10]+a[12]*a[6]*a[9];
  o[1] = -a[1]*a[10]*a[15]+a[1]*a[11]*a[14]+a[9]*a[2]*a[15]-a[9]*a[3]*a[14]-a[13]*a[2]*a[11]+a[13]*a[3]*a[10]; o[5] = a[0]*a[10]*a[15]-a[0]*a[11]*a[14]-a[8]*a[2]*a[15]+a[8]*a[3]*a[14]+a[12]*a[2]*a[11]-a[12]*a[3]*a[10]; o[9] = -a[0]*a[9]*a[15]+a[0]*a[11]*a[13]+a[8]*a[1]*a[15]-a[8]*a[3]*a[13]-a[12]*a[1]*a[11]+a[12]*a[3]*a[9]; o[13] = a[0]*a[9]*a[14]-a[0]*a[10]*a[13]-a[8]*a[1]*a[14]+a[8]*a[2]*a[13]+a[12]*a[1]*a[10]-a[12]*a[2]*a[9];
  o[2] = a[1]*a[6]*a[15]-a[1]*a[7]*a[14]-a[5]*a[2]*a[15]+a[5]*a[3]*a[14]+a[13]*a[2]*a[7]-a[13]*a[3]*a[6]; o[6] = -a[0]*a[6]*a[15]+a[0]*a[7]*a[14]+a[4]*a[2]*a[15]-a[4]*a[3]*a[14]-a[12]*a[2]*a[7]+a[12]*a[3]*a[6]; o[10] = a[0]*a[5]*a[15]-a[0]*a[7]*a[13]-a[4]*a[1]*a[15]+a[4]*a[3]*a[13]+a[12]*a[1]*a[7]-a[12]*a[3]*a[5]; o[14] = -a[0]*a[5]*a[14]+a[0]*a[6]*a[13]+a[4]*a[1]*a[14]-a[4]*a[2]*a[13]-a[12]*a[1]*a[6]+a[12]*a[2]*a[5];
  o[3] = -a[1]*a[6]*a[11]+a[1]*a[7]*a[10]+a[5]*a[2]*a[11]-a[5]*a[3]*a[10]-a[9]*a[2]*a[7]+a[9]*a[3]*a[6]; o[7] = a[0]*a[6]*a[11]-a[0]*a[7]*a[10]-a[4]*a[2]*a[11]+a[4]*a[3]*a[10]+a[8]*a[2]*a[7]-a[8]*a[3]*a[6]; o[11] = -a[0]*a[5]*a[11]+a[0]*a[7]*a[9]+a[4]*a[1]*a[11]-a[4]*a[3]*a[9]-a[8]*a[1]*a[7]+a[8]*a[3]*a[5]; o[15] = a[0]*a[5]*a[10]-a[0]*a[6]*a[9]-a[4]*a[1]*a[10]+a[4]*a[2]*a[9]+a[8]*a[1]*a[6]-a[8]*a[2]*a[5];
  let d = a[0]*o[0]+a[1]*o[4]+a[2]*o[8]+a[3]*o[12]; if (Math.abs(d) < 1e-30) return null; d = 1 / d; for (let i = 0; i < 16; i++) o[i] *= d; return o; }
function camRay(mvp, W, H, mx, my) { const iv = mvp && m4inv(mvp); if (!iv) return null; const x = mx / W * 2 - 1, y = 1 - my / H * 2, un = z => { const v = [0, 1, 2, 3].map(i => iv[i] * x + iv[4 + i] * y + iv[8 + i] * z + iv[12 + i]); return [v[0] / v[3], v[1] / v[3], v[2] / v[3]]; }, a = un(-1), b = un(1); return { o: a, d: v3n(v3sub(b, a)) }; }
// boutons de la souris dans les vues 3D : « cad » (comme Fusion, FreeCAD, Tinkercad : droit = tourner, molette = déplacer, gauche = sélection) ou « classic »
// aide sous la simulation : les gestes du mode souris choisi (Paramètres › Vues 3D)
function v3HelpSync() { const el = document.getElementById('v3Help'); if (el) el.textContent = (LS.get('copo.mouse3d') || 'cad') === 'cad' ? 'Clic droit maintenu : tourner · Clic molette maintenu : déplacer · Molette : zoom · Double-clic : tout voir' : 'Clic gauche maintenu : tourner · Clic droit maintenu : déplacer · Molette : zoom · Double-clic : tout voir'; }
function nav3dAct(e) { if (e.pointerType && e.pointerType !== 'mouse') return e.shiftKey ? 'pan' : 'rot'; if ((LS.get('copo.mouse3d') || 'cad') === 'cad') return e.button === 1 ? 'pan' : e.button === 2 ? (e.shiftKey ? 'pan' : 'rot') : null; return e.button === 0 && !e.shiftKey ? 'rot' : 'pan'; }
// centre de rotation : sous le pointeur (par défaut), centre de la vue ou origine
function orbitPivot(ST, mvp, W, H, mx, my, box, hf) {
  const mode = LS.get('copo.orbit') || 'cursor'; if (mode === 'center') return null; if (mode === 'origin') return box.org;
  const R = camRay(mvp, W, H, mx, my); if (!R) return null; const at = t => [R.o[0] + R.d[0] * t, R.o[1] + R.d[1] * t, R.o[2] + R.d[2] * t];
  if (hf && Math.abs(R.d[2]) > 1e-6) { let ta = (hf.max + 0.01 - R.o[2]) / R.d[2], tb = (hf.min - 0.01 - R.o[2]) / R.d[2]; if (ta > tb) [ta, tb] = [tb, ta]; ta = Math.max(0, ta); const stp = Math.max((tb - ta) / 6000, Math.min(hf.cx, hf.cy) * 0.6);
    for (let t = ta; t <= tb; t += stp) { const p = at(t), i = Math.round((p[0] - hf.ox) / hf.cx), j = Math.round((p[1] - hf.oy) / hf.cy); if (i < 0 || j < 0 || i >= hf.nx || j >= hf.ny) continue; const q = j * hf.nx + i; if (hf.M && !hf.M[q]) continue; if (p[2] <= hf.H[q]) return p; } }
  if (box.planes && Math.abs(R.d[2]) > 1e-9) { let best = null; for (const z of [box.z1, box.z0]) { const t = (z - R.o[2]) / R.d[2], p = at(t); if (t > 0 && p[0] >= box.x0 && p[0] <= box.x1 && p[1] >= box.y0 && p[1] <= box.y1 && (!best || t < best[0])) best = [t, p]; } if (best) return best[1]; }
  return at(v3dot(v3sub(ST.tgt, R.o), R.d)); /* dans le vide : à la profondeur du centre de la vue */
}
// rotation de la caméra autour d'un point (ou du centre de la vue) ; l'élévation n'est plus limitée
// zoom à la molette : vers le point sous le pointeur (par défaut) ou vers le centre de la vue
function camZoom(ST, e, c, mvp, f, dmin, dmax) { const d1 = Math.max(dmin, Math.min(dmax, ST.dist * f)), k = d1 / ST.dist; if ((LS.get('copo.zoom3d') || 'cursor') === 'cursor') { const r = c.getBoundingClientRect(), R = camRay(mvp, c.clientWidth, c.clientHeight, e.clientX - r.left, e.clientY - r.top); if (R) { const t = v3dot(v3sub(ST.tgt, R.o), R.d), P = [R.o[0] + R.d[0] * t, R.o[1] + R.d[1] * t, R.o[2] + R.d[2] * t]; ST.tgt = [0, 1, 2].map(i => P[i] + (ST.tgt[i] - P[i]) * k); } } ST.dist = d1; }
function camOrbit(ST, dyaw, dpitch, P) { const y1 = ST.yaw + dyaw;
  if (P) { let v = v3sub(ST.tgt, P); const c = Math.cos(dyaw), sn = Math.sin(dyaw); v = [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c, v[2]]; const r = [-Math.sin(y1), Math.cos(y1), 0], ct = Math.cos(-dpitch), st = Math.sin(-dpitch), rv = v3cross(r, v), rd = v3dot(r, v); v = [0, 1, 2].map(i => v[i] * ct + rv[i] * st + r[i] * rd * (1 - ct)); ST.tgt = [P[0] + v[0], P[1] + v[1], P[2] + v[2]]; }
  ST.yaw = y1; ST.pitch = ((ST.pitch + dpitch + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; }
function m4look(e, c, u) { const z = v3n(v3sub(e, c)), x = v3n(v3cross(u, z)), y = v3cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -v3dot(x, e), -v3dot(y, e), -v3dot(z, e), 1]; }
const hex3 = h => { h = (h || '#888888').trim().replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
function glProg(gl, vs, fs) {
  const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p;
}
const WRAP_GLSL = `uniform vec4 uWrap;
vec3 wrapP(vec3 p){ if (uWrap.x < 0.5) return p; float R = uWrap.w; if (uWrap.y < 0.5) { float th = (p.y - uWrap.z) / R, r = max(R + p.z, 0.0); return vec3(p.x, uWrap.z + r * sin(th), r * cos(th) - R); } float th = (p.x - uWrap.z) / R, r = max(R + p.z, 0.0); return vec3(uWrap.z + r * sin(th), p.y, r * cos(th) - R); }
vec3 wrapN(vec3 p, vec3 n){ if (uWrap.x < 0.5) return n; if (uWrap.y < 0.5) { float th = (p.y - uWrap.z) / uWrap.w, c = cos(th), s = sin(th); return vec3(n.x, n.y * c + n.z * s, -n.y * s + n.z * c); } float th = (p.x - uWrap.z) / uWrap.w, c = cos(th), s = sin(th); return vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c); }`;
const V3_VS = `#version 300 es
precision highp float; precision highp sampler2D;
${WRAP_GLSL}
in vec2 aGrid; in float aSide; in vec3 aN;
uniform sampler2D uH; uniform sampler2D uB; uniform vec2 uCell; uniform vec2 uOrg; uniform ivec2 uDim; uniform mat4 uMVP; uniform mat4 uModel; uniform float uT; uniform float uBot; uniform float uOnly;
out vec3 vN; out float vDepth; out float vThru; out float vRaw;
float H(ivec2 p){ p = clamp(p, ivec2(0), uDim - 1); return texelFetch(uH, p, 0).r; }
float Bv(ivec2 p){ p = clamp(p, ivec2(0), uDim - 1); return texelFetch(uB, p, 0).r; }
void main(){
  if (aSide > 2.5) { vec3 q = vec3(aGrid, aSide > 3.5 ? -uT : 0.0); vN = mat3(uModel) * wrapN(q, aN); vThru = 0.0; vDepth = 0.0; vRaw = 0.0; gl_Position = uMVP * uModel * vec4(wrapP(q), 1.0); return; }
  ivec2 g = ivec2(aGrid + 0.5); float h = H(g), b = Bv(g), z; vec3 n;
  vThru = h <= b + 0.002 ? 1.0 : 0.0; vRaw = 0.0;
  if (aSide < 0.5 && uBot < 0.5) { z = h; n = normalize(vec3((H(g + ivec2(-1,0)) - H(g + ivec2(1,0))) / (2.0 * uCell.x), (H(g + ivec2(0,-1)) - H(g + ivec2(0,1))) / (2.0 * uCell.y), 1.0)); vDepth = clamp(-z / uT, 0.0, 1.0); vRaw = h > -0.002 ? 1.0 : 0.0; }
  else if (aSide < 0.5) { z = vThru > 0.5 ? h : b; n = normalize(vec3((Bv(g + ivec2(1,0)) - Bv(g + ivec2(-1,0))) / (2.0 * uCell.x), (Bv(g + ivec2(0,1)) - Bv(g + ivec2(0,-1))) / (2.0 * uCell.y), -1.0)); vDepth = clamp((z + uT) / uT, 0.0, 1.0); vRaw = b < -uT + 0.002 ? 1.0 : 0.0; }
  else { z = aSide < 1.5 ? h : b; n = aN; vThru = 0.0; vDepth = 0.0; vRaw = 1.0; }
  vRaw *= uOnly;
  vec3 q = vec3(uOrg.x + float(g.x) * uCell.x, uOrg.y + float(g.y) * uCell.y, z);
  vN = mat3(uModel) * wrapN(q, n);
  gl_Position = uMVP * uModel * vec4(wrapP(q), 1.0);
}`;
const V3_FS = `#version 300 es
precision highp float;
in vec3 vN; in float vDepth; in float vThru; in float vRaw; out vec4 o;
uniform vec3 uL; uniform vec3 uTop; uniform vec3 uDeep;
void main(){ if (vThru > 0.999 || vRaw > 0.5) discard; vec3 n = normalize(vN); float d = abs(dot(n, uL)); float cut = step(0.002, vDepth);
  vec3 base = mix(uTop, mix(uTop * 0.93, uDeep, smoothstep(0.0, 1.0, vDepth)), cut); o = vec4(base * (0.38 + 0.62 * d), 1.0); }`;
const V3_TVS = `#version 300 es
precision highp float; in vec3 aP; in vec3 aN2; uniform mat4 uMVP; uniform mat4 uModel; uniform vec3 uOff; uniform float uTZ; out vec3 vN;
${WRAP_GLSL}
void main(){ vec3 q = vec3(aP.xy, aP.z * uTZ) + uOff; vN = mat3(uModel) * wrapN(uOff, vec3(aN2.xy, aN2.z * uTZ)); gl_Position = uMVP * uModel * vec4(wrapP(q), 1.0); }`;
const V3_TFS = `#version 300 es
precision highp float; in vec3 vN; out vec4 o; uniform vec3 uL; uniform vec3 uC;
void main(){ float d = abs(dot(normalize(vN), uL)); o = vec4(uC * (0.45 + 0.55 * d), 1.0); }`;
const V3_LVS = `#version 300 es
precision highp float; in vec3 aP; in vec3 aC; in float aT; in float aL; in float aR; uniform mat4 uMVP; uniform mat4 uModel; uniform float uLift;
out vec3 vC; out float vT; out float vL; out float vR;
${WRAP_GLSL}
void main(){ vC = aC; vT = aT; vL = aL; vR = aR; gl_Position = uMVP * uModel * vec4(wrapP(aP), 1.0); gl_Position.z -= uLift * gl_Position.w; }`;
const V3_LFS = `#version 300 es
precision highp float; in vec3 vC; in float vT; in float vL; in float vR; out vec4 o; uniform float uNow;
void main(){ if (vT > uNow) discard; if (vR > 0.5) { if (fract(vL / 3.0) > 0.5) discard; o = vec4(mix(vC, vec3(0.6), 0.45), 1.0); } else o = vec4(vC, 1.0); }`;
// trajectoires 3D : une paire de sommets par segment (position, couleur, temps, longueur cumulée, rapide)
function v3BuildPaths() {
  const gl = V3.gl, S3 = V3.S3, one = $('#v3One').checked && S.activeTp, col = { profile: hex3(tok('--pf')), pocket: hex3(tok('--pk')), vcarve: hex3(tok('--vc')), drill: hex3(tok('--dr')), thread: hex3(tok('--th')), relief: hex3(tok('--rl')) };
  /* sommets écrits directement dans un tableau de nombres (mêmes valeurs, même ordre qu'avant ; beaucoup plus rapide pour les gros parcours) */
  let vb = new Float32Array(Math.max(1024, S3.segs.length * 18 + 18)), nv = 0; let L = 0, last = null;
  const grow = k => { if (nv + k > vb.length) { const o = vb; vb = new Float32Array(Math.max(o.length * 2, nv + k)); vb.set(o); } };
  for (let i = 0; i < S3.segs.length; i++) { const sg = S3.segs[i];
    if (one && sg.tp !== S.activeTp) continue;
    const t1 = S3.cum[i], t0 = i ? S3.cum[i - 1] : 0, P = q => sg.face === 2 ? [q[0], q[1], -S3.t - q[2]] : q, a = P(sg.a), b = P(sg.b), c = col[sg.type] || [0.3, 0.5, 1], r = sg.g === 0 ? 1 : 0;
    if (!last || last !== sg.tp) L = 0; last = sg.tp; const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const nW = wrapN_(a, b); grow(nW * 18);
    for (let k = 0; k < nW; k++) { const f0 = k / nW, f1 = (k + 1) / nW;
      vb[nv++] = a[0] + (b[0] - a[0]) * f0; vb[nv++] = a[1] + (b[1] - a[1]) * f0; vb[nv++] = a[2] + (b[2] - a[2]) * f0; vb[nv++] = c[0]; vb[nv++] = c[1]; vb[nv++] = c[2]; vb[nv++] = t0 + (t1 - t0) * f0; vb[nv++] = L + len * f0; vb[nv++] = r;
      vb[nv++] = a[0] + (b[0] - a[0]) * f1; vb[nv++] = a[1] + (b[1] - a[1]) * f1; vb[nv++] = a[2] + (b[2] - a[2]) * f1; vb[nv++] = c[0]; vb[nv++] = c[1]; vb[nv++] = c[2]; vb[nv++] = t0 + (t1 - t0) * f1; vb[nv++] = L + len * f1; vb[nv++] = r; }
    L += len; }
  if (!V3.lvao) { V3.lvao = gl.createVertexArray(); V3.lvbo = gl.createBuffer(); }
  gl.bindVertexArray(V3.lvao); gl.bindBuffer(gl.ARRAY_BUFFER, V3.lvbo); gl.bufferData(gl.ARRAY_BUFFER, vb.subarray(0, nv), gl.STATIC_DRAW);
  const Pg = V3.lprog, at = (nm, sz, off) => { const l = gl.getAttribLocation(Pg, nm); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, 36, off); };
  at('aP', 3, 0); at('aC', 3, 12); at('aT', 1, 24); at('aL', 1, 28); at('aR', 1, 32); gl.bindVertexArray(null); V3.nLines = nv / 9;
  // dessin : vecteurs visibles, sur le dessus du brut (face 1) ou dessous (face 2)
  { const db = [], ink = hex3(tok('--draw')); let n1 = 0;
    for (const pass of [1, 2]) { if (pass === 2) n1 = db.length / 9; for (const sh of S.shapes) { if (!shown(sh) || sh.pts.length < 2 || (faceOf(sh) === 2) !== (pass === 2)) continue; const f2 = pass === 2, lc = layerOf(sh).color ? hex3(layerOf(sh).color) : ink, n = sh.pts.length, m = sh.closed ? n : n - 1;
      const P = q => [q[0], q[1], f2 ? -S3.t : 0]; // même repère que la simulation (coordonnées du plan)
      for (let i = 0; i < m; i++) { const a = P(sh.pts[i]), b = P(sh.pts[(i + 1) % n]), nW = wrapN_(a, b); for (let k = 0; k < nW; k++) { const A = [0, 1, 2].map(j => a[j] + (b[j] - a[j]) * k / nW), B = [0, 1, 2].map(j => a[j] + (b[j] - a[j]) * (k + 1) / nW); db.push(...A, ...lc, 0, 0, 0, ...B, ...lc, 0, 0, 0); } } } }
    if (!V3.dvao) { V3.dvao = gl.createVertexArray(); V3.dvbo = gl.createBuffer(); }
    gl.bindVertexArray(V3.dvao); gl.bindBuffer(gl.ARRAY_BUFFER, V3.dvbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(db), gl.STATIC_DRAW);
    at('aP', 3, 0); at('aC', 3, 12); at('aT', 1, 24); at('aL', 1, 28); at('aR', 1, 32); gl.bindVertexArray(null); V3.nDraw = db.length / 9; V3.nDraw1 = n1; }
  // relief dessiné : maillage de lignes sur sa surface, pour comparer avec la matière usinée
  { const rb = [], col = hex3(tok('--rl')); V3.nRel = 0;
    if (S.relief && S.relief.items.some(i => i.visible && relGrid[i.id])) { const st = S.stock, R = reliefCompose(Math.max(0.25, Math.sqrt(st.w * st.h / 90000)), true), { nx, ny, cx, cy, H, M } = R, stp = Math.max(1, Math.round(Math.max(st.w, st.h) / 70 / Math.min(cx, cy)));
      const P = (i, j) => [i * cx, j * cy, Math.max(-st.t, H[j * nx + i])], seg = (i0, j0, i1, j1) => { if (!M[j0 * nx + i0] || !M[j1 * nx + i1]) return; rb.push(...P(i0, j0), ...col, 0, 0, 0, ...P(i1, j1), ...col, 0, 0, 0); };
      for (let j = 0; j < ny; j += stp) for (let i = 0; i + 1 < nx; i++) seg(i, j, i + 1, j);
      for (let i = 0; i < nx; i += stp) for (let j = 0; j + 1 < ny; j++) seg(i, j, i, j + 1); }
    if (!V3.rvao) { V3.rvao = gl.createVertexArray(); V3.rvbo = gl.createBuffer(); }
    gl.bindVertexArray(V3.rvao); gl.bindBuffer(gl.ARRAY_BUFFER, V3.rvbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rb), gl.STATIC_DRAW);
    at('aP', 3, 0); at('aC', 3, 12); at('aT', 1, 24); at('aL', 1, 28); at('aR', 1, 32); gl.bindVertexArray(null); V3.nRel = rb.length / 9; }
  // cadre du brut (pour le mode « trajectoires seules »)
  const w = S3.w, h = S3.h, t = S3.t, E = [[0,0,0],[w,0,0],[w,h,0],[0,h,0],[0,0,-t],[w,0,-t],[w,h,-t],[0,h,-t]], ed = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]], g = [0.55, 0.55, 0.55], bb = [];
  for (const [p, q] of ed) bb.push(...E[p], ...g, 0, 0, 0, ...E[q], ...g, 0, 0, 0);
  if (!V3.bvao) { V3.bvao = gl.createVertexArray(); V3.bvbo = gl.createBuffer(); }
  gl.bindVertexArray(V3.bvao); gl.bindBuffer(gl.ARRAY_BUFFER, V3.bvbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bb), gl.STATIC_DRAW);
  at('aP', 3, 0); at('aC', 3, 12); at('aT', 1, 24); at('aL', 1, 28); at('aR', 1, 32); gl.bindVertexArray(null);
}
function v3Init() {
  if (V3.gl) return true;
  const c = $('#v3c'), gl = c.getContext('webgl2', { antialias: true });
  if (!gl) return false;
  V3.gl = gl; V3.prog = glProg(gl, V3_VS, V3_FS); V3.tprog = glProg(gl, V3_TVS, V3_TFS); V3.lprog = glProg(gl, V3_LVS, V3_LFS);
  const mkT = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST)); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE)); return t; };
  V3.tex = mkT(); V3.texB = mkT();
  gl.enable(gl.DEPTH_TEST);
  v3Events(c); return true;
}
function v3BuildMesh() {
  const gl = V3.gl, S3 = V3.S3, nx = S3.nx, ny = S3.ny, ox = S3.ox || 0, oy = S3.oy || 0, ex = ox + (nx - 1) * S3.cx, ey = oy + (ny - 1) * S3.cy, W = S3.w, Hs = S3.h;
  const vb = new Float32Array((nx * ny + 24 * (nx + ny) + 200) * 6); let nv = 0; const push = (i, j, side, n) => { vb.set([i, j, side, n[0], n[1], n[2]], nv * 6); return nv++; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) push(i, j, 0, [0, 0, 1]);
  const ib = new Uint32Array((nx - 1) * (ny - 1) * 6 + 40 * (nx + ny) + 800); let k = 0;
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; ib[k++] = a; ib[k++] = b; ib[k++] = d; ib[k++] = a; ib[k++] = d; ib[k++] = c; }
  V3.nGrid = k;
  const wall = (pts, n) => { let prev = null; for (const [i, j] of pts) { const t = push(i, j, 1, n), bo = push(i, j, 2, n); if (prev) { ib[k++] = prev[0]; ib[k++] = prev[1]; ib[k++] = bo; ib[k++] = prev[0]; ib[k++] = bo; ib[k++] = t; } prev = [t, bo]; } };
  const rng = n => Array.from({ length: n }, (_, i) => i);
  const e = 1e-6, tB = oy < e, tT = ey > Hs - e, tL = ox < e, tR = ex > W - e; // parois de la grille : seulement sur les bords du brut (à l'intérieur, le cadre plein prend le relais)
  if (tB) wall(rng(nx).map(i => [i, 0]), [0, -1, 0]); if (tT) wall(rng(nx).map(i => [i, ny - 1]), [0, 1, 0]); if (tL) wall(rng(ny).map(j => [0, j]), [-1, 0, 0]); if (tR) wall(rng(ny).map(j => [nx - 1, j]), [1, 0, 0]);
  V3.nNoFrame = k;
  // reste du brut, non usiné : dessus, dessous et flancs extérieurs (hors des bords déjà fermés par la grille)
  const quad = (P, n, side) => { const v = P.map(p => push(p[0], p[1], side, n)); ib[k++] = v[0]; ib[k++] = v[1]; ib[k++] = v[2]; ib[k++] = v[0]; ib[k++] = v[2]; ib[k++] = v[3]; };
  const rect = (x0, y0, x1, y1) => { if (x1 - x0 < e || y1 - y0 < e) return; quad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [0, 0, 1], 3); quad([[x0, y0], [x0, y1], [x1, y1], [x1, y0]], [0, 0, -1], 4); };
  // bandes collées à la grille découpées à chaque point de grille : sommets partagés, pas de fente visible le long de la jonction
  const xs = rng(nx).map(i => ox + i * S3.cx), ys = rng(ny).map(j => oy + j * S3.cy);
  if (!tL) { rect(0, 0, ox, oy); rect(0, ey, ox, Hs); for (let j = 0; j < ny - 1; j++) rect(0, ys[j], ox, ys[j + 1]); }
  if (!tR) { rect(ex, 0, W, oy); rect(ex, ey, W, Hs); for (let j = 0; j < ny - 1; j++) rect(ex, ys[j], W, ys[j + 1]); }
  if (!tB) for (let i = 0; i < nx - 1; i++) rect(xs[i], 0, xs[i + 1], oy);
  if (!tT) for (let i = 0; i < nx - 1; i++) rect(xs[i], ey, xs[i + 1], Hs);
  const side = (A, B2, n) => { if (Math.hypot(B2[0] - A[0], B2[1] - A[1]) < e) return; const a = push(A[0], A[1], 3, n), b = push(B2[0], B2[1], 3, n), c = push(B2[0], B2[1], 4, n), d = push(A[0], A[1], 4, n); ib[k++] = a; ib[k++] = b; ib[k++] = c; ib[k++] = a; ib[k++] = c; ib[k++] = d; };
  const edge = (A, B2, n, touch, lo, hi, ax) => { if (!touch) return side(A, B2, n); const P = (v) => ax === 'x' ? [v, A[1]] : [A[0], v], s0 = ax === 'x' ? A[0] : A[1], s1 = ax === 'x' ? B2[0] : B2[1], dir = s1 > s0 ? 1 : -1; // côté touché par la zone : seulement hors de la zone
    if (dir > 0) { side(P(s0), P(lo), n); side(P(hi), P(s1), n); } else { side(P(s0), P(hi), n); side(P(lo), P(s1), n); } };
  if (ox > e || oy > e || ex < W - e || ey < Hs - e) {
    edge([0, 0], [W, 0], [0, -1, 0], oy < e, ox, ex, 'x'); edge([W, Hs], [0, Hs], [0, 1, 0], ey > Hs - e, ox, ex, 'x');
    edge([0, Hs], [0, 0], [-1, 0, 0], ox < e, oy, ey, 'y'); edge([W, 0], [W, Hs], [1, 0, 0], ex > W - e, oy, ey, 'y');
  }
  if (!V3.vao) { V3.vao = gl.createVertexArray(); V3.vbo = gl.createBuffer(); V3.ibo = gl.createBuffer(); }
  gl.bindVertexArray(V3.vao); gl.bindBuffer(gl.ARRAY_BUFFER, V3.vbo); gl.bufferData(gl.ARRAY_BUFFER, vb.subarray(0, nv * 6), gl.STATIC_DRAW);
  const P = V3.prog, at = (nm, sz, off) => { const l = gl.getAttribLocation(P, nm); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, 24, off); };
  at('aGrid', 2, 0); at('aSide', 1, 8); at('aN', 3, 12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, V3.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ib.subarray(0, k), gl.STATIC_DRAW); V3.nIdx = k;
  gl.bindVertexArray(null);
  gl.bindTexture(gl.TEXTURE_2D, V3.tex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nx, ny, 0, gl.RED, gl.FLOAT, S3.H); gl.bindTexture(gl.TEXTURE_2D, V3.texB); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nx, ny, 0, gl.RED, gl.FLOAT, S3.B); V3.dirty = false;
}
function v3ToolMesh(tool) {
  if (V3.toolMesh.has(tool.id)) return V3.toolMesh.get(tool.id);
  const gl = V3.gl, r = tool.dia / 2, H = Math.max(25, tool.dia * 5), th = Math.tan((+tool.angle || 90) * Math.PI / 360);
  let prof; if (tool.type === 'thread') { const d = r * 0.32, t3 = Math.tan(Math.PI / 6), rn = r - d * 1.15, L = Math.max(+tool.flen || 0, tool.dia * 2.5), rs = Math.max(r, 3); prof = [[0, 0], [r - d, 0], [r, d * t3], [r - d, 2 * d * t3], [rn, 2 * d * t3 + 0.2], [rn, L], [rs, L + Math.max(0.5, rs - rn)], [rs, Math.max(H, L + 20)]]; }
  else if (tool.type === 'v' && +tool.tipR > 0) { const pf = toolProf(tool); prof = []; for (let i = 0; i <= 12; i++) { const d = r * i / 12; prof.push([d, pf(d)]); } prof.push([r, Math.max(H, pf(r) + 10)]); }
  else if (tool.type === 'v' && +tool.flat > 0) { const fr = Math.min(r, +tool.flat / 2); prof = [[0, 0], [fr, 0], [r, (r - fr) / th], [r, Math.max(H, (r - fr) / th + 10)]]; }
  else if (tool.type === 'v' || tool.type === 'drill') prof = [[0, 0], [r, r / th], [r, H]]; else if (tool.type === 'ball') { prof = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; prof.push([r * Math.sin(a), r - r * Math.cos(a)]); } prof.push([r, H]); } else prof = [[0, 0], [r, 0], [r, H]];
  prof.push([0, H]);
  const seg = 28, vb = [];
  for (let s = 0; s < seg; s++) {
    const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2;
    for (let k = 0; k < prof.length - 1; k++) {
      const [r0, z0] = prof[k], [r1, z1] = prof[k + 1], P = (rr, zz, a) => [rr * Math.cos(a), rr * Math.sin(a), zz];
      const A = P(r0, z0, a0), B = P(r0, z0, a1), C = P(r1, z1, a1), D = P(r1, z1, a0), n = v3n(v3cross(v3sub(C, A), v3sub(B, A)));
      for (const q of [A, B, C, A, C, D]) vb.push(q[0], q[1], q[2], -n[0], -n[1], -n[2]);
    }
  }
  const vao = gl.createVertexArray(), vbo = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vb), gl.STATIC_DRAW);
  const P = V3.tprog; let l = gl.getAttribLocation(P, 'aP'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 24, 0); l = gl.getAttribLocation(P, 'aN2'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 24, 12);
  gl.bindVertexArray(null); const m = { vao, n: vb.length / 6 }; V3.toolMesh.set(tool.id, m); return m;
}
function v3BuildThreads() {
  const gl = V3.gl; for (const m of (V3.thrMesh || [])) gl.deleteVertexArray(m.vao); V3.thrMesh = [];
  for (const T of (V3.S3.thr || [])) {
    const g = T.g, rW = g.inner ? g.D / 2 : g.Dm / 2, rT = g.inner ? g.Dm / 2 : g.D / 2, a = 0.4375 * g.P, b = 0.125 * g.P, N = 48, n = g.turns * N, vb = [];
    const clip = z => Math.max(g.zLo, Math.min(0, z));
    const pt = (i, rr, dz) => { const th = g.sg * 2 * Math.PI * i / N, zc = g.zS + (g.zE - g.zS) * i / n + g.P / 2; return [g.c[0] + rr * Math.cos(th), g.c[1] + rr * Math.sin(th), clip(zc + dz)]; };
    for (let i = 0; i < n; i++) {
      const prof = [[rW, -a], [rT, -b], [rT, b], [rW, a]];
      for (let k = 0; k < 3; k++) {
        const A = pt(i, prof[k][0], prof[k][1]), B = pt(i + 1, prof[k][0], prof[k][1]), C = pt(i + 1, prof[k + 1][0], prof[k + 1][1]), D = pt(i, prof[k + 1][0], prof[k + 1][1]);
        const nn = v3n(v3cross(v3sub(C, A), v3sub(B, A))); for (const q of [A, B, C, A, C, D]) vb.push(q[0], q[1], q[2], nn[0], nn[1], nn[2]);
      }
    }
    const vao = gl.createVertexArray(), vbo = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vb), gl.STATIC_DRAW);
    const P = V3.tprog; let l = gl.getAttribLocation(P, 'aP'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 24, 0); l = gl.getAttribLocation(P, 'aN2'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null); V3.thrMesh.push({ vao, n: vb.length / 6, per: 18, steps: n, t0: T.t0, t1: T.t1, face: T.face });
  }
}
// « Pièce finie seule » : la matière reliée au bord du brut sans passer par une découpe traversante est une chute ; on la cache (hauteur = fond)
function v3HDisp(S3) {
  const el = document.getElementById('v3Only'); V3.onlyKeep = false; if (!el || !el.checked) return S3.H;
  const tabT = Math.max(0.002, ...S.tps.filter(t => t.visible && t.p && t.p.tabs).map(t => (+t.p.tabH || 0) + 0.05)), { nx, ny, H, B } = S3, N = nx * ny, thru = q => H[q] <= B[q] + tabT, seen = new Uint8Array(N), st = new Int32Array(N); let sp = 0;
  const push = q => { if (!seen[q] && !thru(q)) { seen[q] = 1; st[sp++] = q; } };
  for (let i = 0; i < nx; i++) { push(i); push((ny - 1) * nx + i); } for (let j = 0; j < ny; j++) { push(j * nx); push(j * nx + nx - 1); }
  while (sp) { const q = st[--sp], i = q % nx, j = (q - i) / nx; if (i > 0) push(q - 1); if (i < nx - 1) push(q + 1); if (j > 0) push(q - nx); if (j < ny - 1) push(q + nx); }
  let keep = 0; for (let q = 0; q < N; q++) if (!seen[q] && !thru(q)) { keep = 1; break; } V3.onlyKeep = !!keep; if (!keep) return S3.H; // aucune pièce détourée : on montre tout
  const out = new Float32Array(N); for (let q = 0; q < N; q++) out[q] = seen[q] ? B[q] : H[q]; return out;
}
// couleur de la matière (relief de la vue 3D et simulation) : la même dans les deux vues
const MAT3D = { orange: { top: [0.95, 0.64, 0.35], deep: [0.62, 0.31, 0.11] }, gris: { top: [0.88, 0.855, 0.81], deep: [0.56, 0.53, 0.49] }, clair: { top: [0.95, 0.88, 0.72], deep: [0.70, 0.56, 0.36] }, fonce: { top: [0.55, 0.32, 0.22], deep: [0.27, 0.14, 0.09] }, bleu: { top: [0.64, 0.73, 0.96], deep: [0.22, 0.33, 0.68] } }; // bronze, aluminium, bois clair, bois foncé (palissandre), plastique
const mat3d = () => MAT3D[LS.get('copo.mat3d')] || MAT3D.orange;
function v3Render() {
  const gl = V3.gl, c = $('#v3c'), S3 = V3.S3; if (!gl || !S3) return;
  const dpr = window.devicePixelRatio || 1, W = Math.max(1, Math.round(c.clientWidth * dpr)), Hh = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
  gl.viewport(0, 0, W, Hh); const bg = hex3(tok('--canvas3d') || tok('--canvas')); gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (V3.dirty) { gl.bindTexture(gl.TEXTURE_2D, V3.tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S3.nx, S3.ny, gl.RED, gl.FLOAT, v3HDisp(S3)); gl.bindTexture(gl.TEXTURE_2D, V3.texB); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S3.nx, S3.ny, gl.RED, gl.FLOAT, S3.B); V3.dirty = false; }
  const cp = Math.cos(V3.pitch), e = [V3.tgt[0] + V3.dist * cp * Math.cos(V3.yaw), V3.tgt[1] + V3.dist * cp * Math.sin(V3.yaw), V3.tgt[2] + V3.dist * Math.sin(V3.pitch)];
  const mvp = m4mul(m4persp(0.7, W / Hh, V3.dist * 0.01, V3.dist * 20), m4look(e, V3.tgt, camUp(V3))); V3.mvp = mvp; const L = v3n([0.35, -0.55, 0.85]);
  gl.useProgram(V3.prog); wrapU(gl, V3.prog); const u = n => gl.getUniformLocation(V3.prog, n);
  gl.uniformMatrix4fv(u('uMVP'), false, mvp); gl.uniform2f(u('uCell'), S3.cx, S3.cy); gl.uniform2f(u('uOrg'), S3.ox || 0, S3.oy || 0); gl.uniform2i(u('uDim'), S3.nx, S3.ny); gl.uniform1f(u('uT'), S3.t);
  gl.uniform3fv(u('uL'), L); gl.uniform3fv(u('uTop'), mat3d().top); gl.uniform3fv(u('uDeep'), mat3d().deep); gl.uniform1f(u('uOnly'), 0);
  const flipV = $('#v3Face').value === 'f2', model = !flipV ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : S.stock.flip === 'y' ? [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, S3.w, 0, -S3.t, 1] : [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, S3.h, -S3.t, 1];
  gl.uniformMatrix4fv(u('uModel'), false, model);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, V3.tex); gl.uniform1i(u('uH'), 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, V3.texB); gl.uniform1i(u('uB'), 1);
  const show = $('#v3Show').value;
  if (show !== 'paths') { gl.bindVertexArray(V3.vao); gl.uniform1f(u('uBot'), 0); gl.drawElements(gl.TRIANGLES, V3.onlyKeep ? V3.nNoFrame : V3.nIdx, gl.UNSIGNED_INT, 0);
    if (!wrapInfo()) { gl.uniform1f(u('uBot'), 1); gl.drawElements(gl.TRIANGLES, V3.nGrid, gl.UNSIGNED_INT, 0); } gl.bindVertexArray(null); }
  if (show !== 'stock' && V3.lvao) {
    gl.useProgram(V3.lprog); wrapU(gl, V3.lprog); const lu = n => gl.getUniformLocation(V3.lprog, n);
    gl.uniformMatrix4fv(lu('uMVP'), false, mvp); gl.uniformMatrix4fv(lu('uModel'), false, model); gl.uniform1f(lu('uLift'), show === 'both' ? 0.0015 : 0);
    if (show === 'paths') { gl.uniform1f(lu('uNow'), 1e12); gl.bindVertexArray(V3.bvao); gl.drawArrays(gl.LINES, 0, 24); }
    gl.uniform1f(lu('uNow'), V3.T + 1e-6); gl.bindVertexArray(V3.lvao); gl.drawArrays(gl.LINES, 0, V3.nLines); gl.bindVertexArray(null);
  }
  if ($('#v3Draw').checked && V3.dvao && V3.nDraw) {
    gl.useProgram(V3.lprog); wrapU(gl, V3.lprog); const lu = n => gl.getUniformLocation(V3.lprog, n);
    gl.uniformMatrix4fv(lu('uMVP'), false, mvp); gl.uniformMatrix4fv(lu('uModel'), false, model); gl.uniform1f(lu('uLift'), 0.0003); gl.uniform1f(lu('uNow'), 1e12);
    // seuls les vecteurs de la face tournée vers le haut sont visibles
    gl.bindVertexArray(V3.dvao); if (flipV) gl.drawArrays(gl.LINES, V3.nDraw1, V3.nDraw - V3.nDraw1); else gl.drawArrays(gl.LINES, 0, V3.nDraw1); gl.bindVertexArray(null);
  }
  if ($('#v3Rel').checked && V3.rvao && V3.nRel && !flipV) {
    gl.useProgram(V3.lprog); wrapU(gl, V3.lprog); const lu = n => gl.getUniformLocation(V3.lprog, n);
    gl.uniformMatrix4fv(lu('uMVP'), false, mvp); gl.uniformMatrix4fv(lu('uModel'), false, model); gl.uniform1f(lu('uLift'), 0.0006); gl.uniform1f(lu('uNow'), 1e12);
    gl.bindVertexArray(V3.rvao); gl.drawArrays(gl.LINES, 0, V3.nRel); gl.bindVertexArray(null);
  }
  if (show !== 'paths' && V3.thrMesh && V3.thrMesh.length) {
    gl.useProgram(V3.tprog); wrapU(gl, V3.tprog); const t = n => gl.getUniformLocation(V3.tprog, n), st = mat3d().top;
    gl.uniformMatrix4fv(t('uMVP'), false, mvp); gl.uniformMatrix4fv(t('uModel'), false, model); gl.uniform3fv(t('uL'), L); gl.uniform3fv(t('uC'), [st[0] * 0.92, st[1] * 0.92, st[2] * 0.92]);
    for (const m of V3.thrMesh) { if (V3.T < m.t0) continue; const f = m.t1 > m.t0 ? Math.min(1, (V3.T - m.t0) / (m.t1 - m.t0)) : 1, cnt = Math.round(f * m.steps) * m.per; if (!cnt) continue;
      gl.uniform1f(t('uTZ'), m.face === 2 ? -1 : 1); gl.uniform3fv(t('uOff'), m.face === 2 ? [0, 0, -S3.t] : [0, 0, 0]); gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, cnt); }
    gl.bindVertexArray(null);
  }
  if ($('#v3Tool').checked && V3.cur && V3.cur.tool) {
    const m = v3ToolMesh(V3.cur.tool); gl.useProgram(V3.tprog); wrapU(gl, V3.tprog); const t = n => gl.getUniformLocation(V3.tprog, n);
    const c2 = V3.cur.face === 2, tp_ = c2 ? [V3.cur.p[0], V3.cur.p[1], -S3.t - V3.cur.p[2]] : V3.cur.p; gl.uniformMatrix4fv(t('uMVP'), false, mvp); gl.uniformMatrix4fv(t('uModel'), false, model); gl.uniform1f(t('uTZ'), c2 ? -1 : 1); gl.uniform3fv(t('uOff'), tp_); gl.uniform3fv(t('uL'), L); gl.uniform3fv(t('uC'), [0.78, 0.8, 0.84]);
    gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n); gl.bindVertexArray(null);
  }
  v3Cube();
}
// cube d'orientation (coin haut droit) : faces = vues orthogonales, coins = vues isométriques
const V3CUBE = [
  { n: [0, 0, 1], l: 'Dessus', u: [1, 0, 0], v: [0, -1, 0], yaw: -Math.PI / 2, pitch: 1.5703 },
  { n: [0, 0, -1], l: 'Dessous', u: [1, 0, 0], v: [0, 1, 0], yaw: -Math.PI / 2, pitch: -1.5703 },
  { n: [0, -1, 0], l: 'Avant', u: [1, 0, 0], v: [0, 0, -1], yaw: -Math.PI / 2, pitch: 0 },
  { n: [0, 1, 0], l: 'Arrière', u: [-1, 0, 0], v: [0, 0, -1], yaw: Math.PI / 2, pitch: 0 },
  { n: [1, 0, 0], l: 'Droite', u: [0, 1, 0], v: [0, 0, -1], yaw: 0, pitch: 0 },
  { n: [-1, 0, 0], l: 'Gauche', u: [0, -1, 0], v: [0, 0, -1], yaw: Math.PI, pitch: 0 }];
function v3CubeBasis(ST = V3) { const cp = Math.cos(ST.pitch), e = [cp * Math.cos(ST.yaw), cp * Math.sin(ST.yaw), Math.sin(ST.pitch)], rt = v3n([-Math.sin(ST.yaw), Math.cos(ST.yaw), 0]), up = v3cross(rt, [-e[0], -e[1], -e[2]]); return { e, rt, up: v3n(up) }; }
function v3CubeHit(mx, my, ST = V3) {
  const B = v3CubeBasis(ST), K = 30, P = q => [60 + K * (q[0] * B.rt[0] + q[1] * B.rt[1] + q[2] * B.rt[2]), 60 - K * (q[0] * B.up[0] + q[1] * B.up[1] + q[2] * B.up[2])];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const vis = sx * B.e[0] + sy * B.e[1] + sz * B.e[2] > 0.25; if (!vis) continue; const q = P([sx, sy, sz]); if (Math.hypot(q[0] - mx, q[1] - my) < 9) return { yaw: Math.atan2(sy, sx), pitch: sz * 0.6155, k: 'c' + sx + sy + sz }; }
  for (const f of V3CUBE) { if (f.n[0] * B.e[0] + f.n[1] * B.e[1] + f.n[2] * B.e[2] <= 0.02) continue; const c = f.n, Q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P([c[0] + a * f.u[0] + b * f.v[0], c[1] + a * f.u[1] + b * f.v[1], c[2] + a * f.u[2] + b * f.v[2]]));
    let ins = false; for (let i = 0, j = 3; i < 4; j = i++) if ((Q[i][1] > my) !== (Q[j][1] > my) && mx < (Q[j][0] - Q[i][0]) * (my - Q[i][1]) / (Q[j][1] - Q[i][1]) + Q[i][0]) ins = !ins; if (ins) return { yaw: f.yaw, pitch: f.pitch, k: f.l }; }
  return null;
}
function v3Cube(cvEl, ST = V3) {
  const cv = cvEl || $('#v3cube'); if (!cv || (ST === V3 && !V3.S3)) return; const dpr = window.devicePixelRatio || 1; if (cv.width !== 120 * dpr) { cv.width = cv.height = 120 * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, 120, 120);
  const B = v3CubeBasis(ST), K = 30, P = q => [60 + K * (q[0] * B.rt[0] + q[1] * B.rt[1] + q[2] * B.rt[2]), 60 - K * (q[0] * B.up[0] + q[1] * B.up[1] + q[2] * B.up[2])];
  const ink = tok('--ink'), acc = tok('--accent'), raised = tok('--raised'), line = tok('--line'), hv = ST.cubeHover;
  const fs = V3CUBE.map(f => ({ f, d: f.n[0] * B.e[0] + f.n[1] * B.e[1] + f.n[2] * B.e[2] })).filter(o => o.d > 0.02).sort((a, b) => a.d - b.d);
  for (const { f, d } of fs) {
    const c = f.n, Q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P([c[0] + a * f.u[0] + b * f.v[0], c[1] + a * f.u[1] + b * f.v[1], c[2] + a * f.u[2] + b * f.v[2]]));
    g.beginPath(); Q.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath();
    g.fillStyle = hv === f.l ? acc : raised; g.globalAlpha = 0.55 + 0.45 * d; g.fill(); g.globalAlpha = 1; g.strokeStyle = line; g.lineWidth = 1; g.stroke();
    if (d > 0.2) { const o = P(c), U = P([c[0] + f.u[0], c[1] + f.u[1], c[2] + f.u[2]]), Vv = P([c[0] + f.v[0], c[1] + f.v[1], c[2] + f.v[2]]); g.save(); g.transform(U[0] - o[0], U[1] - o[1], Vv[0] - o[0], Vv[1] - o[1], o[0], o[1]); const t = tr(f.l); g.font = '600 0.42px ' + (tok('--f-ui') || 'sans-serif'); const w = g.measureText(t).width; const k = w > 1.75 ? 1.75 / w : 1; g.scale(k, k); g.fillStyle = hv === f.l ? '#fff' : ink; g.globalAlpha = Math.min(1, (d - 0.2) * 2.5); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 0.02); g.restore(); g.globalAlpha = 1; }
  }
  // coins cliquables
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { if (sx * B.e[0] + sy * B.e[1] + sz * B.e[2] <= 0.25) continue; const q = P([sx, sy, sz]), k = 'c' + sx + sy + sz; g.beginPath(); g.arc(q[0], q[1], hv === k ? 5 : 3, 0, 7); g.fillStyle = hv === k ? acc : line; g.fill(); }
  // axes X (rouge) Y (vert) depuis le coin avant gauche bas
  const o = P([-1.35, -1.35, -1.35]), ax = [[[1, 0, 0], '#e5484d', 'X'], [[0, 1, 0], '#30a46c', 'Y'], [[0, 0, 1], '#3e7bfa', 'Z']];
  for (const [v, col, l] of ax) { const q = P([-1.35 + v[0] * 0.9, -1.35 + v[1] * 0.9, -1.35 + v[2] * 0.9]); g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(q[0], q[1]); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.fillStyle = col; g.font = '700 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l, q[0] + (q[0] - o[0]) * 0.25, q[1] + (q[1] - o[1]) * 0.25); }
}
function v3AnimTo(yaw, pitch, ST = V3, req = v3Req) {
  let y0 = ST.yaw, d = yaw - y0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  // vue de dessus/dessous : garde l'orientation actuelle si on y est déjà presque
  let p0 = ST.pitch; while (p0 - pitch > Math.PI) p0 -= 2 * Math.PI; while (pitch - p0 > Math.PI) p0 += 2 * Math.PI; const t0 = performance.now(), D = 320;
  const step = () => { const k = Math.min(1, Math.max(0, (performance.now() - t0) / D)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; ST.yaw = y0 + d * e; ST.pitch = p0 + (pitch - p0) * e; req(); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
(() => { const cv = document.getElementById('v3cube'); if (!cv) return; const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointermove', e => { const h = v3CubeHit(...pos(e)), k = h ? h.k : null; if (k !== V3.cubeHover) { V3.cubeHover = k; v3Cube(); } });
  cv.addEventListener('pointerleave', () => { V3.cubeHover = null; v3Cube(); });
  cv.addEventListener('pointerdown', e => { e.stopPropagation(); const h = v3CubeHit(...pos(e)); if (h) v3AnimTo(h.yaw, h.pitch); });
  cv.addEventListener('dblclick', e => e.stopPropagation()); cv.addEventListener('contextmenu', e => e.preventDefault()); })();
function v3Req() { if (!V3.raf) V3.raf = requestAnimationFrame(v3Frame); }
function v3Frame(ts) {
  V3.raf = 0; if ($('#v3d').hidden) return;
  if (V3.playing) {
    const dt = V3.last ? Math.min(0.1, (ts - V3.last) / 1000) : 0; V3.last = ts;
    V3.T = Math.min(V3.S3.total, V3.T + dt / 60 * (+$('#v3Speed').value || 50));
    V3.cur = simTo(V3.S3, V3.T) || V3.cur; V3.dirty = true;
    if (V3.T >= V3.S3.total) v3Play(false);
    v3Ui();
  }
  v3Render(); if (V3.playing) v3Req();
}
function v3Ui() { const S3 = V3.S3; $('#v3Pos').value = S3.total ? Math.round(V3.T / S3.total * 1000) : 1000; $('#v3Time').textContent = fmtTime(V3.T) + ' / ' + fmtTime(S3.total); }
function v3Play(on) { V3.playing = on; V3.last = 0; const b = $('#v3Play'); b.innerHTML = on ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>'; b.title = tr(on ? 'Pause (Espace)' : 'Lecture (Espace)'); if (on) v3Req(); }
function v3Step(dir) { const S3 = V3.S3; if (!S3 || !S3.cum.length) return; v3Play(false); const c = S3.cum, T = V3.T, eps = 1e-7; let t;
  if (dir > 0) { let lo = 0, hi = c.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] > T + eps) hi = m; else lo = m + 1; } t = c[lo] > T + eps ? c[lo] : S3.total; }
  else { let lo = 0, hi = c.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (c[m] < T - eps) { r = m; lo = m + 1; } else hi = m - 1; } t = r >= 0 ? c[r] : 0; }
  v3Seek(t); }
function v3Seek(T) { const S3 = V3.S3; if (T < V3.T - 1e-9) { simReset(S3); } V3.T = T; V3.cur = simTo(S3, T) || V3.cur; V3.dirty = true; v3Ui(); v3Req(); }
function v3ResetView() { const S3 = V3.S3; V3.tgt = [S3.w / 2, S3.h / 2, -S3.t / 2]; V3.dist = Math.max(S3.w, S3.h) * 1.55; V3.yaw = -Math.PI / 2 + 0.35; V3.pitch = 0.75; v3Req(); }
