// ---------- recalcul des parcours : seulement ceux dont les données ont changé ; manuel ou automatique ; barre de progression ----------
const shapeHash = (() => { const W = new WeakMap(); return s => { const P = s.pts || []; let h = W.get(P); if (h === undefined) { h = P.length * 0.913 + (s.closed ? 0.5 : 0); for (let i = 0; i < P.length; i++) h += P[i][0] * (1.37 + (i % 7) * 0.011) + P[i][1] * (2.11 + (i % 5) * 0.017); W.set(P, h); } return h; }; })();
function tpSig(tp) {
  const par = tp.vclrOf ? S.tps.find(x => x.id === tp.vclrOf) : null, src = par || tp, ids = src.shapeIds || []; let h = 0; for (const id of ids) { const sh = shapeById(id); h += sh ? shapeHash(sh) : 7.7; }
  const rel = tp.type === 'relief' || src.p.proj || (src.relIds && src.relIds.length) ? JSON.stringify([S.relief.ver || 0, S.relief.items.map(i => [i.id, i.x, i.y, i.w, i.h, i.rot, i.rx, i.ry, i.zH, i.top, i.visible, i.mode, i.invert, i.smooth, i.cut])]) : '';
  return JSON.stringify([tp.type, tp.toolId, tp.face, tp.p, tp.relIds, S.tools.find(t => t.id === tp.toolId), S.stock, S.machine, h.toFixed(5), ids.length, rel, par ? [par.p, par.toolId, par.face, S.tools.find(t => t.id === ((par.p || {}).clrTool || (par.p || {}).roughTool)), vcClrIds(par.p || {}).map(i => S.tools.find(t => t.id === i)), tp.clrIdx || 0] : 0, S.tools.find(t => t.id === (tp.p || {}).roughTool) || 0, (q => q ? [q.toolId, q.p.allow, q.p.finish, S.tools.find(t => t.id === q.toolId), S.tps.indexOf(q) > S.tps.indexOf(tp)] : 0)(tp.p && tp.p.restFrom && S.tps.find(x => x.id === tp.p.restFrom))]);
}
const TPC = new Map(), TPC_K = ['moves', 'dmoves', 'loops', 'holes', 'threads', 'tabs', 'stats', 'err', 'warns', 'info', 'relVer'];
/* cache par parcours : les 6 derniers résultats (annuler / rétablir les retrouvent sans recalcul) */
const tpHit = (tp, sig) => { const c = TPC.get(tp.id); return c ? c.list.find(x => x.sig === sig) : null; };
function tpRun(tp) { const had = !!tp.moves, sig = tpSig(tp), h = tpHit(tp, sig); if (h) { for (const k of TPC_K) tp[k] = h.r[k]; tp.stale = false; tp._sig = sig; return; } const t0 = performance.now(); computeTP(tp); const sg = tpSig(tp), r = {}; for (const k of TPC_K) r[k] = tp[k]; const c = TPC.get(tp.id) || { list: [], ms: 0 }; c.ms = performance.now() - t0; c.list = [{ sig: sg, r }, ...c.list.filter(x => x.sig !== sg)].slice(0, 6); TPC.set(tp.id, c); tp.stale = false; tp._sig = sg; if (had) tpSlowNote(tp, c.ms); }
const tpTodo = force => S.tps.filter(tp => force || !tp.moves || tp._sig !== tpSig(tp));
const tpManual = () => LS.get('copo.tpAuto') === 'manual';
let TP_BUSY = 0;
function recomputeDone() { gcDirty = true; renderTpList(); draw(); if (curTab === 'gcode') renderGcode(); tpStaleUi(); }
function recomputeAll(force) {
  let todo = tpTodo(force); if (!todo.length) { if (S.tps.some(t => t.stale)) S.tps.forEach(t => t.stale = false); recomputeDone(); return; }
  if (tpManual() && !force && !recomputeAll.now) { for (const tp of todo) { const c = TPC.get(tp.id); if (tp.moves && c && !tpHit(tp, tpSig(tp))) tp.stale = true; else tpRun(tp); } recomputeDone(); return; }
  /* automatique : un parcours long (plus de 0,5 s au dernier calcul) attend une pause de 1,5 s sans modification ; en attendant il est marqué ⟳ */
  if (!force && !recomputeAll.now && !recomputeAll.idle) { const slow = todo.filter(tp => { const c = TPC.get(tp.id); return tp.moves && c && c.ms > 500 && !tpHit(tp, tpSig(tp)); }); if (slow.length) { for (const tp of slow) tp.stale = true; tpLater(); todo = todo.filter(tp => !slow.includes(tp)); if (!todo.length) { recomputeDone(); return; } } }
  const est = todo.reduce((a, tp) => a + (tpHit(tp, tpSig(tp)) ? 0 : (TPC.get(tp.id) || {}).ms || 0), 0);
  if (est < 350 || typeof requestAnimationFrame !== 'function') { for (const tp of todo) tpRun(tp); recomputeDone(); return; }
  tpRunAsync(todo);
}
let tpLaterT = 0;
function tpLater() { clearTimeout(tpLaterT); tpLaterT = setTimeout(() => { tpLaterT = 0; if (tpManual() || !S.tps.some(t => t.stale)) return; if (drag || TP_BUSY) { tpLater(); return; } recomputeAll.idle = 1; try { recomputeAll(); } finally { recomputeAll.idle = 0; } }, 1500); }
/* parcours pas à jour (⟳, calcul en cours ou données changées) */
const tpPending = () => !!TP_BUSY || S.tps.some(tp => tp.stale || (tp.moves && tp._sig !== tpSig(tp)));
/* recalcule ce qui n'est pas à jour, puis continue (export, fiche de gamme, simulation) */
function tpRecalcThen(then) { clearTimeout(tpLaterT); tpLaterT = 0; recomputeAll.now = 1; try { recomputeAll(); } finally { recomputeAll.now = 0; } const t0 = Date.now(), wait = () => { if (!TP_BUSY) return then(); if (Date.now() - t0 < 300000) setTimeout(wait, 80); }; wait(); }
function tpEnsure(then, what) {
  if (!tpPending()) return then();
  if (!tpManual()) return tpRecalcThen(then);
  notice(trf('Des parcours ne sont pas à jour (⟳) : {w} correspondrait à l’ancien dessin.', { w: what }), [{ t: tr('Recalculer et continuer'), primary: 1, fn: () => tpRecalcThen(then) }, { t: tr('Pas maintenant') }]);
}
/* 2. calculs longs à répétition en mode automatique : proposer (une fois) le recalcul manuel */
const TP_SLOW = [];
function tpSlowNote(tp, ms) {
  if (ms < 1000 || tpManual() || recomputeAll.now || LS.get('copo.tpAsk') === 'no' || tpSlowNote.done) return; const now = Date.now(); TP_SLOW.push(now); while (TP_SLOW.length && now - TP_SLOW[0] > 300000) TP_SLOW.shift(); if (TP_SLOW.length < 3) return; tpSlowNote.done = 1;
  const sec = (ms / 1000).toFixed(1); setTimeout(() => notice(trf('Ce projet est long à recalculer (« {n} » : {s} s après chaque modification). Passer en recalcul manuel ? Les parcours seront alors recalculés quand vous cliquerez sur « Recalculer », et avant l’export du G-code.', { n: tp.name || '', s: LANG === 'en' ? sec : sec.replace('.', ',') }),
    [{ t: tr('Passer en manuel'), primary: 1, fn: () => { LS.set('copo.tpAuto', 'manual'); const sel = $('#cfgTpAuto'); if (sel) sel.value = 'manual'; tpStaleUi(); toast(tr('Recalcul manuel activé. Vous pouvez revenir en automatique dans Paramètres › Général.')); } }, { t: tr('Non, ne plus proposer'), fn: () => LS.set('copo.tpAsk', 'no') }]), 0);
}
// calcul long : un parcours à la fois, avec une barre de progression ; l'interface reste visible entre deux parcours
/* ---------- calculs en tâche de fond (Web Worker) ----------
   Le travailleur reprend au démarrage, dans ce même script, les fonctions de calcul dont il a besoin (analyse avec lib/acorn.min.js) : un seul code, donc des résultats identiques.
   Si le travailleur ne peut pas démarrer (navigateur, fichier ouvert en local…), tout se calcule comme avant sur le fil principal. */
const WK = { w: null, ready: null, off: false, n: 0, cb: new Map(), sent: new WeakSet() };
const WK_ROOTS = ['computeTP', 'tpSig', 'moveStats', 'simSeg'];
function wkBoot() {
  self.window = self;
  const build = (src, roots) => { /* déclarations de premier niveau utiles aux fonctions de départ, de proche en proche ; const/let deviennent var (initialisation protégée) */
    const ast = acorn.parse(src, { ecmaVersion: 'latest' }), decl = new Map(), order = [];
    const pat = (n, out) => { if (!n) return; if (n.type === 'Identifier') out.push(n.name); else if (n.type === 'ObjectPattern') n.properties.forEach(q => pat(q.value || q.argument, out)); else if (n.type === 'ArrayPattern') n.elements.forEach(q => pat(q, out)); else if (n.type === 'AssignmentPattern') pat(n.left, out); else if (n.type === 'RestElement') pat(n.argument, out); };
    for (const st of ast.body) { const names = []; if ((st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') && st.id) names.push(st.id.name); else if (st.type === 'VariableDeclaration') for (const d of st.declarations) pat(d.id, names); const r = { st, names }; order.push(r); for (const n of names) decl.set(n, r); }
    const refs = r => { const o = new Set(); let pv = null; for (const tk of acorn.tokenizer(src.slice(r.st.start, r.st.end), { ecmaVersion: 'latest' })) { if (tk.type.label === 'name' && !(pv && (pv.type.label === '.' || pv.type.label === '?.'))) o.add(tk.value); pv = tk; } return o; };
    /* instructions qui complètent un objet retenu : Object.assign(X, …), Object.defineProperty(X, …), X.p = … (le reste — interface, événements — est ignoré) */
    const tgt = st => { if (st.type !== 'ExpressionStatement') return null; const e = st.expression; if (e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && e.callee.object.name === 'Object' && /^(assign|defineProperty)$/.test(e.callee.property.name) && e.arguments[0] && e.arguments[0].type === 'Identifier') return e.arguments[0].name; if (e.type === 'AssignmentExpression' && e.left.type === 'MemberExpression' && e.left.object.type === 'Identifier') return e.left.object.name; return null; };
    const extra = order.filter(r => !r.names.length && tgt(r.st)), need = new Set(), q = roots.slice();
    for (let more = true; more;) { while (q.length) { const r = decl.get(q.pop()); if (!r || need.has(r)) continue; need.add(r); for (const x of refs(r)) if (decl.has(x)) q.push(x); }
      more = false; for (const r of extra) if (!need.has(r) && need.has(decl.get(tgt(r.st)))) { need.add(r); more = true; for (const x of refs(r)) if (decl.has(x)) q.push(x); } }
    let out = ''; for (const r of order) { if (!need.has(r)) continue; const st = r.st, t = src.slice(st.start, st.end);
      if (!r.names.length) out += 'try { ' + t + ' } catch (e) { }\n';
      else if (st.type === 'FunctionDeclaration') out += t + '\n';
      else if (st.type === 'ClassDeclaration') out += 'var ' + st.id.name + ' = ' + t + ';\n';
      else if (st.type === 'VariableDeclaration') { out += 'var ' + r.names.join(', ') + ';\n'; for (const d of st.declarations) if (d.init) out += 'try { (' + src.slice(d.id.start, d.id.end) + ' = ' + src.slice(d.init.start, d.init.end) + '); } catch (e) { }\n'; } }
    return out; };
  const ops = {
    init(m) { importScripts(...m.libs, m.acorn); (0, eval)(build(m.src, m.roots)); return true; },
    tp(m) { /* état du projet, langue, grilles de relief (seulement celles qui ont changé) ; le parcours est calculé dans la copie du projet */
      S = m.S; LANG = m.lang; for (const id of Object.keys(relGrid)) if (!m.gridIds.includes(id)) delete relGrid[id];
      for (const id in m.grids) { relGrid[id] = m.grids[id]; relSm.delete(id); } relDirty = true; relCache = null;
      const tp = S.tps.find(t => t.id === m.tid), t0 = performance.now(); computeTP(tp); const r = {}; for (const k of m.keys) r[k] = tp[k]; return { r, ms: performance.now() - t0 }; },
    sim(m) { /* segments reçus sous forme compacte (extrémités, outil, face) ; même passage complet que simTo jusqu'à la fin */
      const S3 = { w: m.w, h: m.h, t: m.t, nx: m.nx, ny: m.ny, cx: m.cx, cy: m.cy, ox: m.ox, oy: m.oy, floor: m.floor, H: new Float32Array(m.nx * m.ny), B: new Float32Array(m.nx * m.ny).fill(-m.t), last: null, idx: 0, frac: 0 }, A = m.A, n = m.F.length;
      for (let i = 0; i < n; i++) { const o = i * 6; simSeg(S3, { a: [A[o], A[o + 1], A[o + 2]], b: [A[o + 3], A[o + 4], A[o + 5]], K: m.Ks[m.KI[i]], face: m.F[i] }, 0, 1); }
      return { H: S3.H, B: S3.B }; }
  };
  onmessage = e => { const m = e.data; let r = null, err = null; try { r = ops[m.op](m); } catch (x) { err = (x && (x.stack || x.message)) || String(x); } const tr = r && r.H && r.B ? [r.H.buffer, r.B.buffer] : []; postMessage({ id: m.id, r, err }, tr); };
}
function wkFail(why) { WK.off = true; WK.ready = null; for (const c of WK.cb.values()) c.rej(new Error(why || 'worker')); WK.cb.clear(); try { WK.w && WK.w.terminate(); } catch { } WK.w = null; }
function wkStart() {
  if (WK.ready || WK.off) return WK.ready;
  try {
    if (typeof Worker !== 'function' || typeof Blob !== 'function' || LS.get('copo.noWorker') === '1') throw 0;
    const src = [...document.scripts].filter(s => !s.src).map(s => s.textContent).reduce((a, b) => b.length > a.length ? b : a, ''), libs = [...document.scripts].filter(s => s.src && /clipper|delaunay/i.test(s.src)).map(s => s.src);
    const url = URL.createObjectURL(new Blob(['(' + wkBoot.toString() + ')();'], { type: 'text/javascript' })), w = new Worker(url); setTimeout(() => URL.revokeObjectURL(url), 30000);
    WK.w = w; w.onmessage = e => { const m = e.data, c = WK.cb.get(m.id); if (!c) return; WK.cb.delete(m.id); if (m.err) c.rej(new Error(m.err)); else c.res(m.r); };
    w.onerror = e => { if (e && e.preventDefault) e.preventDefault(); wkFail(e && e.message); };
    WK.ready = new Promise((res, rej) => WK.cb.set(0, { res, rej })); w.postMessage({ id: 0, op: 'init', src, libs, acorn: new URL('lib/acorn.min.js', location.href).href, roots: WK_ROOTS });
    WK.ready.catch(e => { console.warn('COPO : calculs en tâche de fond indisponibles', e && e.message); wkFail(); });
  } catch (e) { WK.off = true; WK.ready = null; }
  return WK.ready;
}
/* envoie une tâche ; rejetée si le travailleur est indisponible (l'appelant calcule alors sur le fil principal) */
function wkCall(op, data, transfer) { const rd = wkStart(); if (!rd) return Promise.reject(new Error('off')); return rd.then(() => new Promise((res, rej) => { if (!WK.w) return rej(new Error('off')); const id = ++WK.n; WK.cb.set(id, { res, rej }); try { WK.w.postMessage({ ...data, id, op }, transfer || []); } catch (e) { WK.cb.delete(id); rej(e); } })); }
/* copie allégée d'un parcours (sans ses résultats) */
const wkStrip = t => { const o = {}; for (const k in t) if (!TPC_K.includes(k) && k !== '_sig') o[k] = t[k]; return o; };
/* calcule un parcours en tâche de fond ; résultat appliqué seulement si ses données n'ont pas changé entre-temps */
function tpRunWorker(tp) {
  const sig = tpSig(tp), h = tpHit(tp, sig); if (h) { tpRun(tp); return Promise.resolve(); }
  const had = !!tp.moves, par = tp.vclrOf, gridIds = Object.keys(relGrid), grids = {}; for (const id of gridIds) { const g = relGrid[id]; if (g && typeof g === 'object' && !WK.sent.has(g)) grids[id] = g; }
  const S2 = {}; for (const k of ['stock', 'shapes', 'tools', 'images', 'relief', 'layers', 'machine', 'ui', 'meta', 'font', 'guides']) S2[k] = S[k]; S2.tps = S.tps.map(t => t === tp || t.id !== par ? wkStrip(t) : t);
  return wkCall('tp', { S: S2, lang: LANG, gridIds, grids, tid: tp.id, keys: TPC_K.concat(['p', 'toolId', 'face']) }).then(res => {
    for (const id in grids) WK.sent.add(grids[id]);
    if (!S.tps.includes(tp)) return;
    if (tpSig(tp) !== sig) { tp.stale = true; if (!tpManual()) tpLater(); return; } /* modifié pendant le calcul : refait plus tard */
    const r = res.r; for (const k of TPC_K) tp[k] = r[k]; tp.toolId = r.toolId; tp.face = r.face; if (tp.vclrOf) tp.p = r.p; else Object.assign(tp.p, r.p);
    const sg = tpSig(tp), o = {}; for (const k of TPC_K) o[k] = tp[k]; const c = TPC.get(tp.id) || { list: [], ms: 0 }; c.ms = res.ms; c.list = [{ sig: sg, r: o }, ...c.list.filter(x => x.sig !== sg)].slice(0, 6); TPC.set(tp.id, c); tp.stale = false; tp._sig = sg; if (had) tpSlowNote(tp, c.ms);
  }, e => { if (e && e.message !== 'off') console.warn('COPO : calcul en tâche de fond impossible, calcul direct', e.message); if (S.tps.includes(tp)) tpRun(tp); });
}
function tpRunAsync(todo) { const run = ++TP_BUSY, bar = $('#tpProg'), tot = todo.reduce((a, tp) => a + Math.max(30, (TPC.get(tp.id) || {}).ms || 300), 0); let done = 0, k = 0; bar.hidden = false;
  const step = () => { if (run !== TP_BUSY) return; if (k >= todo.length) { bar.hidden = true; TP_BUSY = 0; recomputeDone(); return; } const tp = todo[k], w = Math.max(30, (TPC.get(tp.id) || {}).ms || 300);
    $('#tpProgT').textContent = trf('Calcul des parcours : {n} / {t} · {p}', { n: k + 1, t: todo.length, p: tp.name || '' }); bar.querySelector('b').style.width = Math.round(100 * done / tot) + '%'; bar.querySelector('b').style.setProperty('--w', Math.round(100 * w / tot) + '%');
    const next = () => { done += w; k++; renderTpList(); step(); };
    if (!WK.off && S.tps.includes(tp)) { tpRunWorker(tp).then(() => { if (run === TP_BUSY) next(); }); return; } /* en tâche de fond : l'interface reste utilisable */
    requestAnimationFrame(() => setTimeout(() => { if (run !== TP_BUSY) return; if (S.tps.includes(tp)) tpRun(tp); next(); }, 0)); };
  step(); }
function tpStaleUi() { const n = S.tps.filter(t => t.stale).length, b = $('#tpRecalc'); if (b) { b.classList.toggle('primary', n > 0); b.querySelector('span').textContent = n ? trf('Recalculer les parcours ({n} à mettre à jour)', { n }) : tr('Recalculer tous les parcours'); } const w = $('#gcStale'); if (w) w.hidden = !n; for (const t of ['parcours', 'gcode']) { const tb = document.querySelector('.tabs [data-tab="' + t + '"]'); if (tb) { tb.classList.toggle('stale', n > 0); if (n) tb.title = tr('Des parcours ne sont pas à jour (⟳)'); else tb.removeAttribute('title'); } } }
const fmtTime = m => { const s = Math.round(m * 60); return s >= 3600 ? Math.floor(s / 3600) + ' h ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') : Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s'; };

