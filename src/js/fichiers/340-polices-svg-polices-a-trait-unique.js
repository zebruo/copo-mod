// ---------- polices SVG (polices à trait unique : Hershey, EMS, Relief, Routed Gothic…) ----------
function svgFontFrom(data) {
  const upm = +data.upm || 1000, G = new Map(), K = new Map(), dflt = +data.adv || upm / 2;
  for (const ch in data.g) { const [adv, d] = data.g[ch]; G.set(ch, { u: ch, advanceWidth: adv == null ? dflt : +adv, d: d || '', _sub: null }); }
  for (const [a, b, k] of data.k || []) K.set(a + '\u0000' + b, -k);
  const sub = g => g._sub || (g._sub = (() => { if (!g.d) return []; try { return parsePathNodes(g.d); } catch (e) { return []; } })());
  let cap = 0; const H = G.get('H') || G.get('I') || G.get('E'); if (H) for (const s of sub(H)) for (const n of s.nodes) cap = Math.max(cap, n.y);
  if (!(cap > 0)) cap = +data.cap || upm * 0.7;
  const space = G.get(' ') || { u: ' ', advanceWidth: dflt * 0.6, d: '' };
  const gOf = ch => G.get(ch) || G.get(ch.normalize('NFD')[0]) || (/\s/.test(ch) ? space : { u: ch, advanceWidth: dflt, d: '' });
  const cmdsOf = (g, x, y, sc, out) => {
    for (const s of sub(g)) {
      const N = s.nodes; if (!N.length) continue; out.push({ type: 'M', x: x + N[0].x * sc, y: y - N[0].y * sc });
      const seg = (a, b) => { if (!a.o && !b.i) out.push({ type: 'L', x: x + b.x * sc, y: y - b.y * sc }); else out.push({ type: 'C', x1: x + (a.x + (a.o ? a.o[0] : 0)) * sc, y1: y - (a.y + (a.o ? a.o[1] : 0)) * sc, x2: x + (b.x + (b.i ? b.i[0] : 0)) * sc, y2: y - (b.y + (b.i ? b.i[1] : 0)) * sc, x: x + b.x * sc, y: y - b.y * sc }); };
      for (let i = 1; i < N.length; i++) seg(N[i - 1], N[i]); if (s.closed) { if (N.length > 1) seg(N[N.length - 1], N[0]); out.push({ type: 'Z' }); }
    }
    return out;
  };
  const f = {
    svg: true, singleLine: data.single !== false, unitsPerEm: upm, tables: { os2: { sCapHeight: cap } }, family: data.family,
    stringToGlyphs: str => [...str].map(gOf),
    getKerningValue: (a, b) => K.get(a.u + '\u0000' + b.u) || 0,
    getPath(str, x, y, size) { const sc = size / upm, out = [], gl = f.stringToGlyphs(str); let cx = x; gl.forEach((g, i) => { cmdsOf(g, cx, y, sc, out); cx += (g.advanceWidth + (i < gl.length - 1 ? f.getKerningValue(g, gl[i + 1]) : 0)) * sc; }); return { commands: out }; }
  };
  for (const g of [...G.values(), space]) g.getPath = (x, y, size) => ({ commands: cmdsOf(g, x, y, size / upm, []) });
  return f;
}
function svgFontParseText(txt, fname) {
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml'), fe = doc.getElementsByTagName('font')[0]; if (!fe) throw new Error('svgfont');
  const ff = doc.getElementsByTagName('font-face')[0], upm = +(ff && ff.getAttribute('units-per-em')) || 1000, meta = doc.getElementsByTagName('metadata')[0], mm = meta && /Font name:\s*(.+)/.exec(meta.textContent);
  const g = {}, names = {}; let nM = 0, nZ = 0;
  for (const e of doc.getElementsByTagName('glyph')) { const u = e.getAttribute('unicode'); if (u == null || [...u].length !== 1) continue; const d = e.getAttribute('d') || '', a = e.getAttribute('horiz-adv-x'); g[u] = [a == null ? null : +a, d]; const n = e.getAttribute('glyph-name'); if (n) names[n] = u; nM += (d.match(/[Mm]/g) || []).length; nZ += (d.match(/[Zz]/g) || []).length; }
  const ex = (us, gs) => [...(us ? us.split(',').map(t => t.trim()).filter(t => [...t].length === 1) : []), ...(gs ? gs.split(',').map(t => names[t.trim()]).filter(Boolean) : [])];
  const k = []; for (const e of doc.getElementsByTagName('hkern')) { const A = ex(e.getAttribute('u1'), e.getAttribute('g1')), B = ex(e.getAttribute('u2'), e.getAttribute('g2')), kv = +e.getAttribute('k') || 0; for (const a of A) for (const b of B) k.push([a, b, kv]); }
  return { family: ((mm && mm[1].trim()) || (ff && ff.getAttribute('font-family')) || fe.getAttribute('id') || String(fname || 'SVG').replace(/\.svg$/i, '')).replace(/\s+/g, ' '), upm, adv: +fe.getAttribute('horiz-adv-x') || upm / 2, cap: +(ff && ff.getAttribute('cap-height')) || null, single: nZ < 0.5 * Math.max(1, nM), g, k };
}
function svgPreview(font, txt, px) {
  px = px || 22; const cap = font.tables.os2.sCapHeight, size = px * 0.6 * font.unitsPerEm / cap, cm = font.getPath(txt, 2, px * 0.8, size).commands; let d = '', x1 = 10;
  const n = v => v.toFixed(1);
  for (const c of cm) { if (c.type === 'M') d += 'M' + n(c.x) + ' ' + n(c.y); else if (c.type === 'L') d += 'L' + n(c.x) + ' ' + n(c.y); else if (c.type === 'C') d += 'C' + n(c.x1) + ' ' + n(c.y1) + ' ' + n(c.x2) + ' ' + n(c.y2) + ' ' + n(c.x) + ' ' + n(c.y); else if (c.type === 'Z') d += 'Z'; if (c.x != null) x1 = Math.max(x1, c.x); }
  return '<svg viewBox="0 0 ' + Math.ceil(x1 + 4) + ' ' + px + '" height="' + px + '" style="max-width:100%;overflow:visible" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"' + (font.singleLine ? '' : ' fill-rule="evenodd"') + '/></svg>';
}
let VF = [];
function registerVF() { if (!Array.isArray(window.COPO_SVG_FONTS)) return; VF = window.COPO_SVG_FONTS.map(d => ({ kind: 'v', family: d.family, style: 'Regular', full: d.family, group: d.group, data: d, font: null })); }
function vfFont(v) { return v.font || (v.font = svgFontFrom(v.data)); }
function selectVF(v, silent, keepOpen) {
  S.font = vfFont(v); S.fontLabel = v.full; setTimeout(() => { txLive(); txUi(); }, 0); fpCur = { kind: 'v', family: v.family };
  const nm = $('#fontName'); nm.textContent = v.full; nm.style.fontFamily = '';
  LS.set('copo.font', 'v:' + v.family); fpMsg(''); if (!keepOpen) fpClose();
  if (!silent) toast('Police à trait unique « ' + v.full + ' » prête. Outil Texte : cliquez dans la vue 2D, puis usinez avec un profil « Sur la ligne ».');
  if (S.ui.tool === 'text') setTool('text');
}
