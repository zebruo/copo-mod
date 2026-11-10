// ---------- schémas explicatifs (sobres, monochromes + couleur d'accent) ----------
const SVG64 = b => '<svg viewBox="0 0 64 44" aria-hidden="true">' + b + '</svg>';
const SVG24 = b => '<svg viewBox="0 0 24 24" aria-hidden="true">' + b + '</svg>';
// double flèche de cote
const DIM = (x1, y1, x2, y2) => { const a = Math.atan2(y2 - y1, x2 - x1), h = 2.6, w = 1.6, head = (x, y, s) => { const c = Math.cos(a) * s, d = Math.sin(a) * s; return 'M' + (x - c * h - d * w).toFixed(1) + ' ' + (y - d * h + c * w).toFixed(1) + 'L' + x + ' ' + y + 'L' + (x - c * h + d * w).toFixed(1) + ' ' + (y - d * h - c * w).toFixed(1); }; return '<path class="dm" d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + head(x2, y2, 1) + head(x1, y1, -1) + '"/>'; };
// flèche de sens sur une trajectoire
const ARW = (x, y, ang) => { const c = Math.cos(ang), s = Math.sin(ang), p = (dx, dy) => (x + dx * c - dy * s).toFixed(1) + ' ' + (y + dx * s + dy * c).toFixed(1); return '<path class="aw" d="M' + p(-3.4, -2.6) + 'L' + p(1.4, 0) + 'L' + p(-3.4, 2.6) + 'z"/>'; };
const FLUTE = (x0, x1, y0, y1) => { let d = ''; for (let y = y0 + 4; y < y1 - 1; y += 5) d += 'M' + x0 + ' ' + (y + 2) + 'L' + x1 + ' ' + (y - 1.5); return '<path class="fl" d="' + d + '"/>'; };
const ICO = {
  type_profile: SVG24('<rect class="sm" x="8" y="8" width="8" height="8"/><rect class="sp" x="4" y="4" width="16" height="16" rx="4"/>'),
  type_pocket: SVG24('<rect class="sm" x="3.5" y="3.5" width="17" height="17" rx="1"/><rect class="sp" x="7" y="7" width="10" height="10"/><path class="sp" d="M10.5 10.5h3v3h-3z"/>'),
  type_vcarve: SVG24('<path class="sm" d="M2 7h6l4 11 4-11h6"/><path class="sp" d="M12 18V3"/>'),
  type_drill: SVG24('<circle class="sm" cx="7.5" cy="12" r="3.5"/><circle class="sm" cx="16.5" cy="12" r="3.5"/><circle class="dt" cx="7.5" cy="12" r="1"/><circle class="dt" cx="16.5" cy="12" r="1"/>'),
  type_relief: SVG24('<path class="sm" d="M3 18c3-1 4-9 7-9s3 5 5 5 3-4 6-4"/><path class="sp" d="M3 21h18"/>'),
  type_thread: SVG24('<circle class="sm" cx="12" cy="12" r="8"/><path class="sp" d="M12 6.5a5.5 5.5 0 1 1-5.4 6.6M12 9.5a2.5 2.5 0 1 1-2.4 3.2"/>'),
  side_out: SVG24('<rect class="sm" x="8" y="8" width="8" height="8"/><rect class="sp" x="4" y="4" width="16" height="16" rx="4"/>'),
  side_in: SVG24('<rect class="sm" x="4" y="4" width="16" height="16"/><rect class="sp" x="8" y="8" width="8" height="8" rx="1"/>'),
  side_on: SVG24('<rect class="sm" x="5" y="5" width="14" height="14" style="opacity:.45"/><rect class="sp sp2" x="5" y="5" width="14" height="14"/>'),
};
const BICO = {
  fit: SVG24('<path class="bo bd" d="M3 18l3-5 3 2 3-6 3 3 3-5 3 2"/><path class="bo" d="M3 17C7 9 10 9 12 12s5 3 9-6"/>'),
  rotate: SVG24('<rect class="bo" x="3.5" y="9.5" width="11" height="11" rx="1"/><path class="bo" d="M9.5 4.6a8.5 8.5 0 0 1 10.6 9.6"/><path class="bo" d="M17.4 12.2l2.7 2.6 2.4-2.9"/>'),
  boolU: SVG24('<path class="bf" d="M3 3h11v5.2A7 7 0 1 1 8.2 14H3z"/>'),
  boolS: SVG24('<path class="bf" d="M3 3h11v5.2A7 7 0 0 0 8.2 14H3z"/><circle class="bo" cx="15" cy="15" r="7"/>'),
  boolI: SVG24('<rect class="bo" x="3" y="3" width="11" height="11"/><circle class="bo" cx="15" cy="15" r="7"/><path class="bf" d="M8.2 14A7 7 0 0 1 14 8.2V14z"/>'),
  offset: SVG24('<rect class="bo bs" x="8" y="8" width="8" height="8"/><rect class="bo bd" x="3.5" y="3.5" width="17" height="17" rx="4"/>'),
  join: SVG24('<path class="bo bs" d="M3 19l8-8M13 11l8-6"/><circle class="bf" cx="12" cy="11" r="2.2"/>'),
  close: SVG24('<path class="bo bs" d="M5 18V6h14v12"/><path class="bo bd" d="M5 18h14"/>'),
  chamferAll: SVG24('<path class="bo bs" d="M4 20V10l6-6h10"/>'),
  filletAll: SVG24('<path class="bo bs" d="M4 20v-8a8 8 0 0 1 8-8h8"/>'),
  group: SVG24('<rect class="bo bd" x="2.5" y="2.5" width="19" height="19" rx="2"/><rect class="bo bs" x="6" y="6" width="6" height="6"/><circle class="bo bs" cx="15.5" cy="15.5" r="3"/>'),
  ungroup: SVG24('<rect class="bo bs" x="3" y="3" width="7" height="7"/><circle class="bo bs" cx="17" cy="17" r="3.5"/>'),
};
const CURFIG = {
  chamfer: () => SVG64('<path class="dl" d="M10 22V10h12"/><path class="vk" d="M10 40V22l12-12h34"/>' + DIM(4, 22, 4, 40).replace('dm', 'dm hide') + DIM(14, 26, 26, 14)),
  fillet: () => SVG64('<path class="dl" d="M10 26V10h16"/><path class="vk" d="M10 40V26a16 16 0 0 1 16-16h30"/><path class="dm" d="M26 26l-11.3-11.3"/><circle class="af" cx="26" cy="26" r="1.4"/>'),
  dogbone: () => (S.ui.dogKind === 'tbone'
    ? SVG64('<path class="dl" d="M10 24V10h10"/><circle class="tc" cx="10" cy="17" r="7"/><path class="vk" d="M10 40V24A7 7 0 0 1 10 10H56"/>')
    : SVG64('<path class="dl" d="M10 20V10h10"/><circle class="tc" cx="14.95" cy="14.95" r="7"/><path class="vk" d="M10 40V19.9A7 7 0 1 1 19.9 10H56"/>')),
  polygon: () => S.ui.polyStar ? SVG64('<path class="st" d="M32 3l6.2 12.6 13.8 2-10 9.8 2.4 13.8L32 34.7l-12.4 6.5 2.4-13.8-10-9.8 13.8-2z"/>') : SVG64('<path class="st" d="M32 3l17 9.8v19.6L32 42 15 32.4V12.8z"/>'),
  rect: () => S.ui.rectCorner === 'fillet' ? SVG64('<rect class="st" x="8" y="8" width="48" height="30" rx="7"/>') : S.ui.rectCorner === 'chamfer' ? SVG64('<path class="st" d="M15 8h34l7 7v16l-7 7H15l-7-7V15z"/>') : SVG64('<rect class="st" x="8" y="8" width="48" height="30"/>'),
};
// schémas du formulaire de parcours, même style que ceux des inlays : matière orange, outil gris, cotes à traits d'arrêt (lettres et cotes en bleu par CSS, comme la bibliothèque)
const FGC = { mat: '#c46a2b', tool: '#bdb9ae', out: '#1a1a1a', dim: '#8fb2ff', path: '#6d97ff', halo: '#262626' };
function FB(w, h) {
  const P = [], H = [], L = [], T = [], ln = (d, c, wd) => { H.push('<path d="' + d + '" fill="none" stroke="' + FGC.halo + '" stroke-width="' + (wd + 2.2) + '" stroke-linejoin="round"/>'); L.push('<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + wd + '" stroke-linejoin="round"/>'); };
  const b = {
    poly(d, f, ex = '') { P.push('<path d="' + d + '" fill="' + f + '" stroke="' + FGC.out + '" stroke-width="1.2" stroke-linejoin="round"' + ex + '/>'); return b; },
    raw(x) { P.push(x); return b; },
    dash(x1, y, x2) { if (x2 - x1 > 2) P.push('<path d="M' + x1 + ' ' + y + 'H' + x2 + '" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>'); return b; },
    ln(x1, y1, x2, y2, wd = 1.3) { ln('M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2, FGC.dim, wd); return b; },
    dv(x, y1, y2, t = 3.5) { return b.ln(x, y1, x, y2, 1.6).ln(x - t, y1, x + t, y1, 1.6).ln(x - t, y2, x + t, y2, 1.6); },
    dd(x1, y1, x2, y2, t = 3.5) { const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L * t, ny = (x2 - x1) / L * t, r = v => +v.toFixed(2); return b.ln(r(x1), r(y1), r(x2), r(y2), 1.6).ln(r(x1 - nx), r(y1 - ny), r(x1 + nx), r(y1 + ny), 1.6).ln(r(x2 - nx), r(y2 - ny), r(x2 + nx), r(y2 + ny), 1.6); },
    dh(y, x1, x2, t = 3.5) { return b.ln(x1, y, x2, y, 1.6).ln(x1, y - t, x1, y + t, 1.6).ln(x2, y - t, x2, y + t, 1.6); },
    path(d, dash) { H.push('<path d="' + d + '" fill="none" stroke="' + FGC.halo + '" stroke-width="4.6" stroke-linejoin="round" stroke-linecap="round"/>'); L.push('<path d="' + d + '" fill="none" stroke="' + FGC.path + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"' + (dash ? ' stroke-dasharray="5 3.5"' : '') + '/>'); return b; },
    arrow(x, y, a) { const c = Math.cos(a), s = Math.sin(a), q = (u, v) => (x + u * c - v * s).toFixed(1) + ' ' + (y + u * s + v * c).toFixed(1); L.push('<path d="M' + q(3, 0) + 'L' + q(-6, -4.5) + 'L' + q(-6, 4.5) + 'Z" fill="' + FGC.path + '" stroke="' + FGC.halo + '" stroke-width="1"/>'); return b; },
    dot(x, y, r = 4.5) { T.push('<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + FGC.tool + '" stroke="' + FGC.out + '" stroke-width="1.2"/>'); return b; },
    tool(x0, y0, w, h) { P.push('<path d="M' + (x0 + w * 0.2) + ' ' + (y0 - h * 0.35) + 'h' + (w * 0.6) + 'v' + (h * 0.35) + 'h-' + (w * 0.6) + 'Z" fill="' + FGC.tool + '" stroke="' + FGC.out + '" stroke-width="1.2"/><path d="M' + x0 + ' ' + y0 + 'h' + w + 'v' + h + 'h-' + w + 'Z" fill="' + FGC.tool + '" stroke="' + FGC.out + '" stroke-width="1.2"/>'); let d = ''; for (let k = 0; k < 4; k++) { const y = y0 + h * (k + 0.6) / 4; d += 'M' + x0 + ' ' + (y + w * 0.3).toFixed(1) + 'L' + (x0 + w) + ' ' + (y - w * 0.3).toFixed(1); } P.push('<path d="' + d + '" stroke="#5c5850" stroke-width="1.2"/>'); return b; },
    tx(x, y, t, an = 'middle') { T.push('<text x="' + x + '" y="' + y + '" text-anchor="' + an + '" fill="#fff" stroke="' + FGC.halo + '" stroke-width="3" paint-order="stroke">' + t + '</text>'); return b; },
    svg() { return '<svg class="tpfig" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true" font-family="sans-serif" font-size="15" font-weight="600" data-notr>' + P.join('') + H.join('') + L.join('') + T.join('') + '</svg>'; },
  };
  return b;
}
/*@donnee rlico*/
const FIG = {
  profDepth() { // profil ou poche : départ D, coupe C, passes P
    const G = 4, f = FB(132, 96).poly('M10 8H26V28H40V78H74V92H10Z', FGC.mat);
    [38, 48, 58, 68].forEach(y => f.dash(43, y, 72));
    f.ln(26 + G, 8, 116, 8).ln(40 + G, 28, 116, 28).ln(74 + G, 78, 116, 78).dv(112, 8, 28).dv(112, 28, 78).tx(124, 23, 'D').tx(124, 58, 'C');
    f.ln(75, 48, 92, 48).ln(75, 58, 92, 58).dv(88, 48, 58).tx(99, 58, 'P');
    return f.svg();
  },
  vDepth(open) { // V-carve : fond plat à la profondeur max, ou pointe si C = 0
    const G = 4, xb = open ? 45 : 38, sl = (xb - 22) / 62, xl = y => 22 + (y - 8) * sl, xr = y => 68 - (y - 8) * sl;
    const f = FB(132, 96).poly(open ? 'M8 8H22L45 70L68 8H84V92H8Z' : 'M8 8H22L38 70H52L68 8H84V92H8Z', FGC.mat);
    [24, 36, 48, 60].forEach(y => f.dash(+(xl(y) + 2).toFixed(1), y, +(xr(y) - 2).toFixed(1)));
    f.ln(84 + G, 8, 116, 8).ln(84 + G, 24, 116, 24).ln((open ? 45 : 52) + G, 70, 116, 70).dv(112, 8, 24).dv(112, 24, 70).tx(124, 21, 'D').tx(124, 52, 'C');
    f.ln(+(xr(36) + G).toFixed(1), 36, 96, 36).ln(+(xr(48) + G).toFixed(1), 48, 96, 48).dv(92, 36, 48).tx(102, 47, 'P');
    return f.svg();
  },
  drill(peck) { // perçage : départ D, longueur percée C (la pointe dépasse)
    const G = 4, f = FB(132, 96).poly('M8 8H50V70L58 78L66 70V8H96V92H8Z', FGC.mat).dash(51, 28, 65);
    f.raw('<path d="M55 0H61V10H55Z" fill="' + FGC.tool + '" stroke="' + FGC.out + '" stroke-width="1.2"/><path d="M52 10H64V56L58 62L52 56Z" fill="' + FGC.tool + '" stroke="' + FGC.out + '" stroke-width="1.2"/><path d="M52 18L64 14M52 28L64 24M52 38L64 34M52 48L64 44" stroke="#5c5850" stroke-width="1.2"/>');
    if (peck) f.path('M36 30V58').arrow(36, 60, Math.PI / 2).path('M26 58V32').arrow(26, 30, -Math.PI / 2);
    f.ln(96 + G, 8, 116, 8).ln(66 + G, 28, 116, 28).ln(66 + G, 70, 116, 70).dv(112, 8, 28).dv(112, 28, 70).tx(124, 23, 'D').tx(124, 54, 'C');
    return f.svg();
  },
  thread(out) { // filetage : départ D, longueur filetée C, pas P, diamètre nominal M
    const G = 4, T = 42, B = 90, p = 12, f = FB(132, 112); let d;
    if (!out) { // taraudage : filets dans la paroi du trou
      d = 'M8 22H46V' + T; for (let y = T; y < B; y += p) d += 'L50 ' + (y + p / 2) + 'L46 ' + (y + p); d += 'V98H86V' + B; for (let y = B; y > T; y -= p) d += 'L82 ' + (y - p / 2) + 'L86 ' + (y - p); d += 'V22H100V108H8Z';
      f.poly(d, FGC.mat).ln(46, 22 - G, 46, 6).ln(86, 22 - G, 86, 6).dh(10, 46, 86).tx(40, 15, 'M', 'end');
      f.ln(46 - G, T + p, 24, T + p).ln(46 - G, T + 2 * p, 24, T + 2 * p).dv(28, T + p, T + 2 * p).tx(17, T + 2 * p, 'P');
      f.ln(100 + G, 22, 120, 22).ln(86 + G, T, 120, T).ln(86 + G, B, 120, B);
    } else { // vis : filets sur le tenon
      d = 'M46 22H86V' + T; for (let y = T; y < B; y += p) d += 'L90 ' + (y + p / 2) + 'L86 ' + (y + p); d += 'V96H100V108H8V96H46V' + B; for (let y = B; y > T; y -= p) d += 'L42 ' + (y - p / 2) + 'L46 ' + (y - p); d += 'Z';
      f.poly(d, FGC.mat).ln(42, T + p / 2 - G, 42, 6).ln(90, T + p / 2 - G, 90, 6).dh(10, 42, 90).tx(36, 15, 'M', 'end');
      f.ln(42 - G, T + p / 2, 24, T + p / 2).ln(42 - G, T + 1.5 * p, 24, T + 1.5 * p).dv(28, T + p / 2, T + 1.5 * p).tx(17, T + 1.5 * p + 1, 'P');
      f.ln(86 + G, 22, 120, 22).ln(90 + G, T, 120, T).ln(90 + G, B, 120, B);
    }
    return f.dv(116, 22, T).dv(116, T, B).tx(127, 37, 'D').tx(127, 71, 'C').svg();
  },
  stock() { // brut en perspective : X, Y, Z
    const f = FB(100, 84).poly('M18 24L50 12L90 24L58 36Z', '#d98a4e').poly('M18 24L58 36V56L18 44Z', FGC.mat).poly('M58 36L90 24V44L58 56Z', '#a5551f');
    const side = (ax, ay, bx, by, lab) => { const L = Math.hypot(bx - ax, by - ay), nx = (by - ay) / L, ny = -(bx - ax) / L, o = 7, r = v => +v.toFixed(1);
      f.ln(r(ax + nx * 3), r(ay + ny * 3), r(ax + nx * 11), r(ay + ny * 11)).ln(r(bx + nx * 3), r(by + ny * 3), r(bx + nx * 11), r(by + ny * 11)).dd(ax + nx * o, ay + ny * o, bx + nx * o, by + ny * o).tx(r((ax + bx) / 2 + nx * 17), r((ay + by) / 2 + ny * 17 + 5), lab); };
    side(58, 56, 18, 44, 'Y'); side(90, 44, 58, 56, 'X');
    return f.ln(14, 24, 4, 24).ln(14, 44, 4, 44).dv(8, 24, 44).tx(8, 17, 'Z').svg();
  },
  zzero() { // zéro Z : dessus du brut ou table
    const top = (S.stock.originZ || 'top') !== 'bottom', y = top ? 16 : 40, f = FB(96, 62).poly('M18 16H80V40H18Z', FGC.mat).poly('M4 40H92V47H4Z', FGC.tool);
    return f.path('M8 ' + y + 'H90').dot(18, y, 3.5).tx(4, top ? 11 : 60, 'Z0', 'start').svg();
  },
  flip() { // retournement pour la face 2
    const y = (S.stock.flip || 'x') === 'y', f = FB(96, 64).poly('M18 12H78V52H18Z', FGC.mat);
    if (y) f.raw('<path d="M48 4V60" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>').path('M32 32c0-12 32-12 32 0').arrow(64, 33, Math.PI / 2);
    else f.raw('<path d="M8 32H88" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>').path('M40 18c-14 0-14 28 0 28').arrow(41, 46, 0);
    return f.svg();
  },
  allow() { const G = 4; return FB(96, 78).poly('M6 28H40V74H6Z', FGC.mat).tool(52, 30, 16, 44).ln(40, 28 - G, 40, 10).ln(52, 30 - G, 52, 10).dh(14, 40, 52).tx(46, 10, 'a').svg(); },
  dir(F) {
    const climb = F.dir !== 'conv', side = F.side || 'out', ccw = side === 'in' ? !climb : climb, f = FB(96, 72);
    if (side === 'in') f.poly('M8 6H88V66H8Z', FGC.mat).raw('<path d="M24 20H72V52H24Z" fill="' + FGC.halo + '" stroke="' + FGC.out + '" stroke-width="1.2"/>').path('M30 26H66V46H30Z');
    else if (side === 'on') f.poly('M20 16H76V56H20Z', FGC.mat).path('M20 16H76V56H20Z');
    else f.poly('M24 20H72V52H24Z', FGC.mat).path('M14 18a8 8 0 0 1 8-8h52a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z');
    const y = side === 'in' ? 26 : side === 'on' ? 16 : 10; f.arrow(48, y, ccw ? Math.PI : 0).dot(side === 'in' ? 30 : side === 'on' ? 20 : 17, side === 'out' ? 13 : y);
    return f.svg();
  },
  entry(F) {
    const e = F.entry || 'plunge', f = FB(96, 64);
    if (e === 'arc' || e === 'arcramp') return f.poly('M4 46H92V60H4Z', FGC.mat).path('M14 12a28 28 0 0 0 28 28h40', e === 'arcramp').arrow(84, 40, 0).dot(14, 12).svg();
    f.poly('M4 30H92V60H4Z', FGC.mat).tool(9, 6, 10, 22);
    const d = { plunge: 'M14 30V50H80', rampzz: 'M14 30L62 42L16 50H80', ramp: 'M14 30L50 50H80', helix: 'M14 30l8 3.5-8 3.5 8 3.5-8 3.5 8 3.5-8 2.5H80' }[e] || 'M14 30V50H80';
    return f.path(d).arrow(83, 50, 0).svg();
  },
  tabs() { return FB(96, 64).poly('M4 6H92V60H4Z', FGC.mat).raw('<path d="M12 14H84V52H12Z" fill="' + FGC.halo + '" stroke="' + FGC.out + '" stroke-width="1.2"/>').poly('M18 20H78V46H18Z', FGC.mat).poly('M42 13H54V21H42Z', '#e0a070').svg(); },
  ptype(k) {
    const f = FB(96, 64);
    if (k === 'rotary') { f.poly('M22 20H74A7 12 0 0 1 74 44H22A7 12 0 0 1 22 20Z', FGC.mat).raw('<ellipse cx="22" cy="32" rx="7" ry="12" fill="#e0a070" stroke="' + FGC.out + '" stroke-width="1.2"/>').path('M84 18A10 14 0 1 1 84 46').arrow(84, 46, Math.PI * 0.95).raw('<path d="M8 32H90" stroke="' + FGC.out + '" stroke-width="1" stroke-dasharray="4 3"/>'); return f.svg(); }
    f.poly('M10 34H86V50H10Z', FGC.mat);
    if (k === 'double') f.path('M24 26A24 16 0 0 1 72 26').arrow(72, 27, Math.PI * 0.42).poly('M10 34H86V38H10Z', '#e0a070');
    else f.tool(43, 8, 10, 20);
    return f.svg();
  },
  rz0() { // zéro Z rotatif : surface ou axe du cylindre (vue de côté)
    const ax = ((S.stock.rotary || {}).z0 || 'surface') === 'axis', f = FB(96, 64).poly('M18 14H78A6 18 0 0 1 78 50H18A6 18 0 0 1 18 14Z', FGC.mat).raw('<ellipse cx="18" cy="32" rx="6" ry="18" fill="#e0a070" stroke="' + FGC.out + '" stroke-width="1.2"/>');
    if (!ax) f.raw('<path d="M6 32H90" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>');
    const y = ax ? 32 : 14; return f.path('M8 ' + y + 'H90').dot(48, y, 3.5).tx(ax ? 70 : 60, ax ? 27 : 9, 'Z0').svg();
  },
  rax() { // axe de rotation : le long de X ou de Y
    const y = ((S.stock.rotary || {}).axis || 'x') === 'y', f = FB(96, 64);
    if (y) { f.poly('M33 18V52A15 6 0 0 0 63 52V18Z', FGC.mat).raw('<ellipse cx="48" cy="18" rx="15" ry="6" fill="#e0a070" stroke="' + FGC.out + '" stroke-width="1.2"/>').raw('<path d="M48 8V62" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>').dv(76, 14, 56).tx(86, 40, 'Y'); f.path('M30 30A18 6 0 0 0 66 30').arrow(66, 30, -Math.PI / 2.4); }
    else { f.poly('M18 24H74A6 12 0 0 1 74 48H18A6 12 0 0 1 18 24Z', FGC.mat).raw('<ellipse cx="18" cy="36" rx="6" ry="12" fill="#e0a070" stroke="' + FGC.out + '" stroke-width="1.2"/>').raw('<path d="M6 36H90" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>').dh(12, 14, 80).tx(48, 9, 'X'); f.path('M84 26A7 12 0 1 1 84 48').arrow(84, 48, Math.PI * 0.95); }
    return f.svg();
  },
  oxy() { // origine XY sur la feuille déroulée
    const o = (typeof originKey === 'function' ? originKey(S.stock) : S.stock.originXY) || 'bl', vy = ((S.stock.rotary || {}).axis || 'x') === 'y', x0 = vy ? 28 : 16, x1 = vy ? 68 : 80, y0 = vy ? 6 : 12, y1 = vy ? 58 : 52, X = { l: x0, c: (x0 + x1) / 2, r: x1 }[o[1]], Y = { t: y0, m: (y0 + y1) / 2, b: y1 }[o[0]], f = FB(96, 64).poly('M' + x0 + ' ' + y0 + 'H' + x1 + 'V' + y1 + 'H' + x0 + 'Z', FGC.mat); // feuille déroulée : le pointillé est le dessus du cylindre
    f.raw(vy ? '<path d="M48 ' + y0 + 'V' + y1 + '" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3"/>' : '<path d="M16 32H80" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3"/>').path('M' + X + ' ' + Y + 'h14').arrow(X + 15, Y, 0).path('M' + X + ' ' + Y + 'v-14').arrow(X, Y - 15, -Math.PI / 2).dot(X, Y, 4);
    return f.svg();
  },
  cyl() {
    const G = 4, f = FB(132, 96).poly('M20 30H96A10 18 0 0 1 96 66H20A10 18 0 0 1 20 30Z', FGC.mat).raw('<ellipse cx="20" cy="48" rx="10" ry="18" fill="#e0a070" stroke="' + FGC.out + '" stroke-width="1.2"/>');
    f.ln(10, 30 - G, 10, 12).ln(106, 30 - G, 106, 12).dh(16, 10, 106).tx(58, 12, 'L').ln(106 + G, 30, 124, 30).ln(106 + G, 66, 124, 66).dv(120, 30, 66).tx(112, 84, 'D', 'end');
    return f.svg();
  },
  // usinage de relief : coupes (ébauche en escalier, finition lisse, niveaux Z, balayage 3D) et vues de dessus (balayage, décalage)
  rlBound(k) { // limite d'usinage du relief : bloc orange en perspective, oiseau en relief, trait bleu selon le choix
    const wingL = 'M60 33C50 24 34 17 10 20L16 26L11 30L20 32L15 37L25 38L22 43L35 41L44 46L56 42Z', wingR = 'M60 33C70 24 86 17 110 20L104 26L109 30L100 32L105 37L95 38L98 43L85 41L76 46L64 42Z', body = 'M54 33C54 27 66 27 66 33L66 50L72 63L60 58L48 63L54 50Z', head = 'M56 27a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0', bird = wingL + wingR + body + head;
    const hw = 86, cx = hw + 5, cy = 5 + hw / 2, T = 15, BL = '#1f8fff', A = [cx, cy - hw / 2], B = [cx + hw, cy], C = [cx, cy + hw / 2], D = [cx - hw, cy], pt = a => a.map(x => +x.toFixed(1)).join(' ');
    const sc = 1.1, g = (inner, dy) => '<g transform="matrix(' + sc + ' 0 0 ' + sc / 2 + ' ' + (cx - 60 * sc).toFixed(1) + ' ' + (cy - 20.5 * sc + dy).toFixed(1) + ')">' + inner + '</g>'; // dessin à plat sur le dessus du brut (vu en biais)
    let b = '<defs><linearGradient id="rlbTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7b36a"/><stop offset="1" stop-color="#ee9a4c"/></linearGradient><linearGradient id="rlbBird" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6c8"/><stop offset="1" stop-color="#fbc589"/></linearGradient></defs>';
    b += '<path d="M' + pt(B) + 'L' + pt(C) + 'L' + pt([C[0], C[1] + T]) + 'L' + pt([B[0], B[1] + T]) + 'Z" fill="#b85f1d"/>';
    b += '<path d="M' + pt(D) + 'L' + pt(C) + 'L' + pt([C[0], C[1] + T]) + 'L' + pt([D[0], D[1] + T]) + 'Z" fill="#d9772c"/>';
    b += '<path d="M' + pt(A) + 'L' + pt(B) + 'L' + pt(C) + 'L' + pt(D) + 'Z" fill="url(#rlbTop)"/><path d="M' + pt(D) + 'L' + pt(C) + 'L' + pt(B) + '" fill="none" stroke="#ffd2a0" stroke-width=".9" stroke-linejoin="round"/>';
    // contour du modèle : trait bleu fin à quelques millimètres autour de l'oiseau ; sélection : une boucle libre autour
    if (k === 'model') b += g('<path d="' + bird + '" fill="none" stroke="' + BL + '" stroke-width="12" stroke-linejoin="round"/><path d="' + bird + '" fill="none" stroke="#f2a85f" stroke-width="7" stroke-linejoin="round"/>', 0);
    if (k === 'sel') b += g('<path d="M2 36C0 12 34 2 60 6C90 2 122 12 118 36C116 62 88 76 60 76C30 76 4 62 2 36Z" fill="none" stroke="' + BL + '" stroke-width="4" stroke-linejoin="round"/>', 0);
    // oiseau en relief : flancs plus sombres puis dessus clair
    for (let i = 0; i < 4; i++) b += g('<path d="' + bird + '" fill="' + (i ? '#c0601e' : '#9c4c18') + '"/>', -i);
    b += g('<path d="' + bird + '" fill="url(#rlbBird)" stroke="#d9772c" stroke-width=".8" stroke-linejoin="round"/><path d="M60 32V56M57 35C48 28 34 23 16 23M63 35C72 28 86 23 104 23M56 39C47 35 36 33 22 33M64 39C73 35 84 33 98 33" fill="none" stroke="#e48c3e" stroke-width="1.8" stroke-linecap="round"/>', -4);
    if (k === 'stock') b += '<path d="M' + pt(A) + 'L' + pt(B) + 'L' + pt(C) + 'L' + pt(D) + 'Z" fill="none" stroke="' + BL + '" stroke-width="3" stroke-linejoin="round"/>';
    return '<svg viewBox="0 0 ' + (2 * hw + 10) + ' ' + (hw + T + 10) + '" aria-hidden="true">' + b + '</svg>';
  },
  // usinage de relief : icônes en perspective (bloc orange, outil gris, trajets bleus) — générées par relprop/gen5.py
  relf(k) { return RLICO[k] || ''; },
  strat(k) {
    const f = FB(96, 64).poly('M6 6H90V58H6Z', FGC.mat), A = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]), D = P => 'M' + P.map(q => q.join(' ')).join('L');
    const SP = [[44, 32], [54, 32], [54, 40], [34, 40], [34, 24], [64, 24], [64, 48], [24, 48], [24, 16], [74, 16], [74, 50]];
    if (k === 'rings' || k === 'ringsIn') { const P = k === 'rings' ? SP : SP.slice().reverse(), n = P.length; f.path(D(P)).arrow(P[n - 1][0], P[n - 1][1], A(P[n - 2], P[n - 1])).dot(P[0][0], P[0][1], 4); }
    else { const x0 = k === 'raster' ? 20 : 14, x1 = k === 'raster' ? 76 : 82, y0 = k === 'raster' ? 19 : 14, ny = k === 'raster' ? 5 : 6, dy = k === 'raster' ? 6.5 : 7.2; let d = 'M' + x0 + ' ' + y0; for (let i = 0; i < ny; i++) { const y = +(y0 + i * dy).toFixed(1); d += (i ? 'L' + (i % 2 ? x1 : x0) + ' ' + y : '') + 'L' + (i % 2 ? x0 : x1) + ' ' + y; }
      if (k === 'raster') f.path('M12 12H84V52H12Z', true); f.path(d).dot(x0, y0, 4); }
    return f.svg();
  },
};
/* Illustrations des outils de la bibliothèque : outil gris à plat (ombre légère), cotes bleues = champs de la fiche outil */
const TOOLFIG = (() => {
  const C = { l: '#BAC1C9', m: '#AFB6BF', d: '#98A1AC', b: '#2E6AD1' };
  const n = v => +v.toFixed(1);
  const head = (x, y, dx, dy) => { const s = 8, w = 3.6, k = Math.hypot(dx, dy); dx /= k; dy /= k; const bx = x - dx * s, by = y - dy * s;
    return '<path d="M' + n(x) + ' ' + n(y) + 'L' + n(bx - dy * w) + ' ' + n(by + dx * w) + 'L' + n(bx + dy * w) + ' ' + n(by - dx * w) + 'Z" fill="' + C.b + '"/>'; };
  const ln = (x1, y1, x2, y2) => '<path d="M' + n(x1) + ' ' + n(y1) + 'L' + n(x2) + ' ' + n(y2) + '" stroke="' + C.b + '" stroke-width="1.6" fill="none"/>';
  const ex = (x1, y1, x2, y2) => '<path d="M' + n(x1) + ' ' + n(y1) + 'L' + n(x2) + ' ' + n(y2) + '" stroke="' + C.b + '" stroke-width="1" opacity=".8" fill="none"/>';
  const tx = (x, y, t, a = 'middle') => '<text x="' + n(x) + '" y="' + n(y) + '" fill="' + C.b + '" font-size="17" font-weight="600" font-style="' + (t === 'α' ? 'normal' : 'italic') + '" text-anchor="' + a + '" dominant-baseline="central" font-family="system-ui,Segoe UI,Arial,sans-serif">' + t + '</text>';
  const dimH = (y, x1, x2, t, below = true) => ln(x1, y, x2, y) + head(x1, y, -1, 0) + head(x2, y, 1, 0) + tx((x1 + x2) / 2, below ? y + 14 : y - 13, t);
  const dimV = (x, y1, y2, t, right = true) => ln(x, y1, x, y2) + head(x, y1, 0, -1) + head(x, y2, 0, 1) + tx(right ? x + 8 : x - 8, (y1 + y2) / 2, t, right ? 'start' : 'end');
  /* petite cote horizontale, flèches à l'extérieur pointant vers les lignes d'attache */
  const dimHo = (y, x1, x2, t) => ln(x1 - 18, y, x1, y) + head(x1, y, 1, 0) + ln(x2, y, x2 + 18, y) + head(x2, y, -1, 0) + tx(x2 + 24, y, t, 'start');
  const P = (cx, cy, r, a) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  /* cote d'angle : arc de a1 à a2 (degrés, sens croissant), flèches tangentes à l'arc, lignes d'attache depuis r0 */
  const dimA = (cx, cy, r, a1, a2, r0, lab) => {
    const [x1, y1] = P(cx, cy, r, a1), [x2, y2] = P(cx, cy, r, a2), t = a => [-Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)];
    const [e1x, e1y] = P(cx, cy, r0, a1), [f1x, f1y] = P(cx, cy, r + 6, a1), [e2x, e2y] = P(cx, cy, r0, a2), [f2x, f2y] = P(cx, cy, r + 6, a2);
    const t1 = t(a1), t2 = t(a2);
    return ex(e1x, e1y, f1x, f1y) + ex(e2x, e2y, f2x, f2y) +
      '<path d="M' + n(x1) + ' ' + n(y1) + 'A' + r + ' ' + r + ' 0 0 1 ' + n(x2) + ' ' + n(y2) + '" stroke="' + C.b + '" stroke-width="1.6" fill="none"/>' +
      head(x1, y1, -t1[0], -t1[1]) + head(x2, y2, t2[0], t2[1]) + tx(lab[0], lab[1], 'α', lab[2] || 'middle');
  };
  const body = (d, f = C.l) => '<path d="' + d + '" fill="' + f + '"/>';
  /* goujures : bandes obliques découpées dans la forme */
  const flutes = (id, d, x1, x2, y1, y2, pitch, slope, w) => { const rise = (x2 - x1) * slope; let s = '';
    for (let y = y1 - rise; y < y2 + pitch; y += pitch) s += '<path d="M' + x1 + ' ' + n(y) + 'L' + x2 + ' ' + n(y - rise) + 'V' + n(y - rise + w) + 'L' + x1 + ' ' + n(y + w) + 'Z" fill="' + C.d + '"/>';
    return '<clipPath id="' + id + '"><path d="' + d + '"/></clipPath><g clip-path="url(#' + id + ')">' + s + '</g>'; };
  const shade = (x, y, w, h) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + C.m + '"/>';
  const svg = b => '<svg viewBox="0 -24 200 286" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + b + '</svg>';

  const F = {
    flat(p) { const d = 'M76 20H124V215H76Z';
      return svg(body(d) + shade(106, 20, 18, 195) + flutes(p, 'M76 112H124V215H76Z', 76, 124, 112, 215, 30, .9, 13) +
        ex(76, 218, 76, 246) + ex(124, 218, 124, 246) + dimH(240, 76, 124, 'D')); },
    ball(p) { const d = 'M76 20H124V191A24 24 0 0 1 76 191Z';
      return svg(body(d) + shade(106, 20, 18, 172) + flutes(p, 'M76 112H124V191A24 24 0 0 1 76 191Z', 76, 124, 112, 220, 30, .9, 13) +
        ex(76, 194, 76, 246) + ex(124, 194, 124, 246) + dimH(240, 76, 124, 'D')); },
    drill(p) { const d = 'M80 20H120V195L100 207L80 195Z';
      return svg(body(d) + flutes(p, d, 80, 120, 30, 210, 46, .8, 16) +
        ex(80, 198, 80, 246) + ex(120, 198, 120, 246) + dimH(240, 80, 120, 'D') +
        dimA(100, 207, 40, 211, 329, 4, [52, 176, 'end'])); },
    v() { const d = 'M82 20H118V120H148V130L100 178L52 130V120H82Z';
      return svg(body(d) + shade(106, 20, 12, 100) + body('M118 120H148V130L118 160Z', C.m) +
        ex(52, 132, 52, 218) + ex(148, 132, 148, 218) + dimH(212, 52, 148, 'D') +
        dimA(100, 178, 40, 225, 315, 4, [100, 152])); },
    engrave() { const d = 'M80 20H120V135L104 163H96L80 135Z';
      return svg(body(d) + shade(108, 20, 12, 115) + body('M108 135H120L104 163H101Z', C.m) +
        ex(80, 18, 80, 4) + ex(120, 18, 120, 4) + dimH(10, 80, 120, 'D', false) +
        '<path d="M96 163L100 170L104 163" stroke="' + C.b + '" stroke-width="1" stroke-dasharray="3 2" opacity=".8" fill="none"/>' +
        dimA(100, 170, 30, 240, 300, 30, [76, 146, 'end']) +
        ex(96, 166, 96, 212) + ex(104, 166, 104, 212) + dimHo(205, 96, 104, 'd')); },
    taper(p) { const cone = 'M82 120H118L105 222A5 5 0 0 1 95 222Z';
      return svg(body('M82 20H118V120H82Z') + shade(106, 20, 12, 100) + body(cone, C.l) + flutes(p, cone, 80, 120, 124, 235, 17, .8, 7) +
        ex(82, 18, 82, 4) + ex(118, 18, 118, 4) + dimH(10, 82, 118, 'D', false) +
        ex(120, 120, 160, 120) + ex(102, 227, 160, 227) + dimV(152, 120, 227, 'L') +
        '<path d="M103.5 225.5L122 244" stroke="' + C.b + '" stroke-width="1.6" fill="none"/>' + head(103.5, 225.5, -1, -1) + tx(125, 249, 'R', 'start')); },
    thread() { const L = 'M70 20H100V206.2H85L50 186V182L85 161.8V75L70 62Z', R = 'M100 20H130V62L115 75V161.8L150 182V186L115 206.2H100Z';
      return svg(body(L) + body(R, C.l) + shade(115, 20, 15, 42) + body('M115 161.8L150 182V186L115 206.2Z', C.m) +
        dimA(46.5, 184, 34, 150, 210, 4, [17, 152]) +
        ex(117, 75, 184, 75) + ex(117, 206.2, 184, 206.2) + dimV(176, 75, 206.2, 'L') +
        ex(50, 189, 50, 246) + ex(150, 189, 150, 246) + dimH(240, 50, 150, 'D')); },
  };
  return (type, id = 'tf') => (F[type] || F.flat)(id + type);
})();
const ILL = {
  cyl() { return FIG.cyl(); },
  rz0() { return FIG.rz0(); },
  rax() { return FIG.rax(); },
  oxy() { return (S.stock.rotary || {}).on ? FIG.oxy() : ''; },
  curtool() { const f = CURFIG[S.ui.tool]; return f ? f() : ''; },
  depth(F) {
    if (F.type === 'profile' || F.type === 'pocket') return FIG.profDepth();
    if (F.type === 'vcarve') return FIG.vDepth(!(+F.depth > 0));
    if (F.type === 'vcarve-old') {
      const st = +F.vstart > 0;
      return SVG64('<path class="st" d="M3 10h11l11 23h13l11-23h12v30H3z"/><path class="dl" d="M17.3 17h28.4M46 17h12"/>' + DIM(8, 10, 8, 17) + DIM(55, 17, 55, 33) + '<text class="tx" x="1" y="16">D</text><text class="tx" x="58" y="28">C</text>' + '<path class="tl" d="M26.5 0h10v4l-5 17-5-17z"/>');
    }
    if (F.type === 'thread') return FIG.thread(F.thSide === 'out');
    if (F.type === 'thread-old') return SVG64('<path class="st" d="M3 12h22v24h14V12h22v28H3z"/><path class="ac" d="M27 34l10-3M27 29l10-3M27 24l10-3M27 19l10-3"/><path class="tl" d="M29 0h6v14h-6z"/><path class="tl" d="M27 14h10l-5 4z"/>' + DIM(57, 12, 57, 36));
    if (F.type === 'drill') return FIG.drill(+F.peck > 0);
    return SVG64('<path class="st" d="M3 10h11v7h7v16h22V17h7v-7h11v30H3z"/><path class="dl" d="M14 10h36M50 17h8"/><path class="tl" d="M27 0h10v33H27z"/>' + FLUTE(27, 37, 18, 33) + '<path class="ad" d="M21 22h22M21 27.5h22"/>' + DIM(8, 10, 8, 17) + DIM(55, 17, 55, 33) + '<text class="tx" x="1" y="16">D</text><text class="tx" x="58" y="28">C</text>');
  },
  allow() { return FIG.allow(); },
  strat(F) {
    const climb = F.dir !== 'conv';
    if (F.strategy === 'raster') { let d = 'M10 9'; for (let k = 0; k < 6; k++) { const y = 9 + k * 5.2; d += (k ? 'L' + (k % 2 ? 54 : 10) + ' ' + y.toFixed(1) : '') + 'L' + (k % 2 ? 10 : 54) + ' ' + y.toFixed(1); } return SVG64('<rect class="sh" x="5" y="4" width="54" height="36"/><path class="ac" d="' + d + '"/>' + ARW(32, 9, climb ? 0 : Math.PI) + '<circle class="tc" cx="54" cy="9" r="4"/>'); }
    return SVG64('<rect class="sh" x="5" y="4" width="54" height="36"/><rect class="ac" x="9.5" y="8.5" width="45" height="27" rx="1.5"/><rect class="ac" x="16" y="15" width="32" height="14"/><path class="ac" d="M22.5 21.5h19"/>' + ARW(32, 8.5, climb ? 0 : Math.PI) + '<circle class="tc" cx="9.5" cy="8.5" r="4"/>');
  },
  dir(F) { return F.type === 'profile' ? FIG.dir(F) : F.type === 'pocket' ? FIG.dir({ ...F, side: 'in' }) : ''; },
  entry(F) { return FIG.entry(F); },
  tabs() { return FIG.tabs(); },
  stock() { return FIG.stock(); },
  zzero() { return FIG.zzero(); },
  flip() { return FIG.flip(); },
  tool() {
    const t0 = libTool(libSel); if (!t0 || $('#lib').hidden) return '';
    return TOOLFIG(t0.type === 'engball' ? 'taper' : t0.type);
  },
};
function sfigInit() { document.querySelectorAll('[data-sfig]').forEach(el => { if (!el.firstChild) el.innerHTML = el.dataset.sfig.startsWith('rl') ? FIG.relf(el.dataset.sfig) : FIG.strat(el.dataset.sfig); }); }
function illRefresh() { sfigInit();
  const F = S.form || newForm();
  document.querySelectorAll('[data-ill]').forEach(el => { const f = ILL[el.dataset.ill]; if (!f) return; const h = f(F) || ''; if (el._h !== h) { el.innerHTML = h; el._h = h; } el.style.display = h ? '' : 'none'; if (el.parentElement.classList.contains('figrow')) el.parentElement.classList.toggle('nofig', !h); });
}
function icoInit() {
  document.querySelectorAll('[data-pane="dessin"] .row button[data-act]').forEach(b => { const ic = BICO[b.dataset.act]; if (ic && !b.querySelector('svg')) b.insertAdjacentHTML('afterbegin', ic.replace('<svg', '<svg class="bico"')); });
  document.querySelectorAll('.seg[data-f="type"] button, .seg[data-f="side"] button').forEach(b => { const k = (b.parentElement.dataset.f === 'type' ? 'type_' : 'side_') + b.value; if (ICO[k] && !b.querySelector('svg')) { b.insertAdjacentHTML('afterbegin', ICO[k]); b.parentElement.classList.add('ico'); } });
}
// panneau Dessin : une seule section ouverte à la fois (accordéon)
function accInit() {
  const blocks = [...document.querySelectorAll('[data-pane="dessin"] > details.blk')];
  blocks.forEach(d => d.addEventListener('toggle', () => { if (d.open) blocks.forEach(o => { if (o !== d && o.open) o.open = false; }); }));
}


