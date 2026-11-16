// ---------- touche de guitare ----------
const FB_DEF = () => ({ L: 648, N: 22, Wn: 43, ref: '12', Wr: 52, over: 6, m: 2, dots: '3, 5, 7, 9, 15, 17, 19, 21', dots2: '12, 24', dia: 6, scale: true, zf: false, zd: 5 });
const FB_IDS = { L: '#fbL', N: '#fbN', Wn: '#fbWn', ref: '#fbRef', Wr: '#fbWr', over: '#fbOver', m: '#fbM', dots: '#fbDots', dots2: '#fbDots2', dia: '#fbDia', scale: '#fbScale', zf: '#fbZf', zd: '#fbZd' };
function fbLoad() { try { const o = JSON.parse(LS.get('copo.fretboard') || 'null'); if (o) return { ...FB_DEF(), ...o }; } catch { } return FB_DEF(); }
function fbFill(o) { for (const [k, id] of Object.entries(FB_IDS)) { if (k === 'scale') $(id).checked = o[k] !== false; else if (k === 'zf') $(id).checked = !!o[k]; else $(id).value = o[k]; } $('#fbZdRow').hidden = !o.zf; }
function fbRead() { const o = {}; for (const [k, id] of Object.entries(FB_IDS)) { if (k === 'scale' || k === 'zf') { o[k] = $(id).checked; continue; } const v = $(id).value; o[k] = ['ref', 'dots', 'dots2'].includes(k) ? v : +v; } return o; }
const fbList = t => [...new Set(String(t || '').split(/[^\d]+/).map(Number).filter(n => n > 0))];
function fbGeom(o) {
  const L = +o.L, N = Math.max(1, Math.min(36, Math.round(+o.N))), xr = o.ref === 'L' ? L : L / 2, w = x => +o.Wn + (+o.Wr - +o.Wn) * x / xr;
  const fx = n => L - L / Math.pow(2, n / 12), xEnd = fx(N) + Math.max(0, +o.over || 0), m = Math.max(0, +o.m || 0);
  const frets = [], dots = [], r = Math.max(0.25, (+o.dia || 6) / 2), d1 = fbList(o.dots), d2 = fbList(o.dots2);
  const x0 = o.zf ? -Math.max(0, +o.zd || 0) : 0;
  for (let n = o.zf ? 0 : 1; n <= N; n++) { const x = fx(n), h = w(x) / 2 - m; if (h > 0.5) frets.push({ n, x, y0: -h, y1: h }); }
  for (let n = 1; n <= N; n++) { const x = (fx(n - 1) + fx(n)) / 2; if (d2.includes(n)) { const q = w(x) / 4; dots.push({ n, x, y: -q, r }, { n, x, y: q, r }); } else if (d1.includes(n)) dots.push({ n, x, y: 0, r }); }
  const scale = o.scale === false ? null : { line: [[0, 0], [L, 0]], tick: [[L, -w(L) / 2], [L, w(L) / 2]], nut: [[0, -o.Wn / 2 - 4], [0, o.Wn / 2 + 4]] };
  return { L, N, x0, xEnd, scale, wN: +o.Wn, w0: w(x0), wE: w(xEnd), w12: w(L / 2), outline: [[x0, -w(x0) / 2], [xEnd, -w(xEnd) / 2], [xEnd, w(xEnd) / 2], [x0, w(x0) / 2]], frets, dots, f12: fx(12) };
}
function fbValid(o) { return o.L >= 100 && o.N >= 1 && o.Wn > 5 && o.Wr > 5; }
function fbOpen() { fbFill(fbLoad()); fwOpen('fb'); requestAnimationFrame(fbDraw); }
function fbDraw() {
  const o = fbRead(), cv2 = $('#fbCv'), info = $('#fbInfo'); if (!fbValid(o)) { info.textContent = tr('Vérifiez les valeurs.'); return; }
  $('#fbZdRow').hidden = !o.zf;
  const G = fbGeom(o), ext = (G.scale ? Math.max(G.xEnd, G.L) : G.xEnd) - G.x0, W = Math.max(200, cv2.parentElement.clientWidth - 44), pad = 10, k = (W - 2 * pad) / ext, Hmax = Math.max(G.wN, G.wE, G.scale ? G.wN + 8 : 0, G.scale ? Math.abs(G.scale.tick[0][1]) * 2 : 0), H = Math.round(Hmax * k + 2 * pad);
  cv2.width = W * devicePixelRatio; cv2.height = H * devicePixelRatio; cv2.style.height = H + 'px';
  const c = cv2.getContext('2d'); c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); c.clearRect(0, 0, W, H);
  const X = x => pad + (x - G.x0) * k, Y = y => H / 2 - y * k;
  c.beginPath(); G.outline.forEach((q, i) => i ? c.lineTo(X(q[0]), Y(q[1])) : c.moveTo(X(q[0]), Y(q[1]))); c.closePath(); c.fillStyle = '#3b2a1e'; c.fill(); c.strokeStyle = '#1b120c'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = '#e9d9b0'; c.lineWidth = Math.max(1, 0.6 * k); for (const f of G.frets) { c.beginPath(); c.moveTo(X(f.x), Y(f.y0)); c.lineTo(X(f.x), Y(f.y1)); c.stroke(); }
  c.fillStyle = '#f4efe6'; for (const d of G.dots) { c.beginPath(); c.arc(X(d.x), Y(d.y), Math.max(1.5, d.r * k), 0, 7); c.fill(); }
  if (G.scale) { c.strokeStyle = '#1f6fe0'; c.lineWidth = 1.2; c.setLineDash([6, 4]); for (const ln of [G.scale.line, G.scale.tick, G.scale.nut]) { c.beginPath(); c.moveTo(X(ln[0][0]), Y(ln[0][1])); c.lineTo(X(ln[1][0]), Y(ln[1][1])); c.stroke(); } c.setLineDash([]); }
  const F = v => LANG === 'fr' ? fr(v, 1) : v.toFixed(1);
  info.textContent = trf('Longueur de la touche {l} mm · 12e frette à {f} mm · largeur au bout {w} mm', { l: F(G.xEnd - G.x0), f: F(G.f12), w: F(G.wE) }) + (G.x0 < 0 ? ' · ' + trf('largeur au début {w} mm', { w: F(G.w0) }) : '') + (G.xEnd - G.x0 > S.stock.w ? ' · ' + tr('plus longue que le brut') : (G.scale && G.L > S.stock.w ? ' · ' + tr('le trait du diapason dépasse du brut') : ''));
}
function fbMake() {
  const o = fbRead(); if (!fbValid(o)) return toast('Vérifiez les valeurs.');
  try { LS.set('copo.fretboard', JSON.stringify(o)); } catch { }
  const G = fbGeom(o), ext = (G.scale ? Math.max(G.xEnd, G.L) : G.xEnd) - G.x0, ox = (S.stock.w - (ext <= S.stock.w ? ext : G.xEnd - G.x0)) / 2 - G.x0, oy = S.stock.h / 2, T = (x, y) => [ox + x, oy + y];
  const gO = uid(), gF = uid(), gD = uid(); S.sel.clear(); S.imgSel = null;
  const add = sh => { if (sh) S.sel.add(sh.id); };
  add(mkShape(G.outline.map(q => NODE(...T(q[0], q[1]))), true, { g: G.frets.length || G.dots.length ? gO : null }));
  for (const f of G.frets) add(mkShape([NODE(...T(f.x, f.y0)), NODE(...T(f.x, f.y1))], false, { g: gF }));
  for (const d of G.dots) { const c = T(d.x, d.y), ns = arcNodes(c, d.r, 0, 2 * Math.PI); const l = ns.pop(); ns[0].i = l.i; ns.forEach(n => n.sm = true); add(mkShape(ns, true, { g: gD })); }
  if (G.scale) { const gS = uid(); for (const ln of [G.scale.line, G.scale.nut, G.scale.tick]) add(mkShape(ln.map(q => NODE(...T(q[0], q[1]))), false, { g: gS })); }
  fwClose('fb'); commit(); renderSel(); fit(); setTool('select');
  toast(trf(G.scale ? 'Touche créée : contour, {f} frettes, {d} repères et trait du diapason (quatre groupes).' : 'Touche créée : contour, {f} frettes, {d} repères (trois groupes).', { f: G.frets.length, d: G.dots.length }) + (G.xEnd > S.stock.w ? ' ' + tr('Elle dépasse du brut : agrandissez-le dans l’onglet Projet.') : ''));
}
$('#fbZf').addEventListener('change', () => { $('#fbZdRow').hidden = !$('#fbZf').checked; });
Object.values(FB_IDS).forEach(id => { const el = document.querySelector(id); if (el) { el.addEventListener('input', () => fbDraw()); el.addEventListener('change', () => fbDraw()); } });
