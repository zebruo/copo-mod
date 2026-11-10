// ---------- bibliothèque d'outils : lecture des bibliothèques Aspire (.vtdb = SQLite) ----------
// Lecteur SQLite minimal, en lecture seule : tables à rowid, pages de débordement, encodage UTF-8.
function sqliteRead(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (String.fromCharCode(...u8.slice(0, 15)) !== 'SQLite format 3') throw new Error('Ce fichier n’est pas une base SQLite.');
  let ps = dv.getUint16(16); if (ps === 1) ps = 65536; const U = ps - u8[20], td = new TextDecoder('utf-8');
  const pg = n => (n - 1) * ps;
  const varint = o => { let v = 0; for (let i = 0; i < 8; i++) { const b = u8[o + i]; v = v * 128 + (b & 127); if (b < 128) return [v, o + i + 1]; } return [v * 256 + u8[o + 8], o + 9]; };
  const payload = (o, P) => { // contenu local + débordement
    const X = U - 35; if (P <= X) return u8.subarray(o, o + P);
    const M = Math.floor((U - 12) * 32 / 255) - 23, K = M + ((P - M) % (U - 4)), L = K <= X ? K : M, out = new Uint8Array(P); out.set(u8.subarray(o, o + L)); let got = L, nx = dv.getUint32(o + L);
    while (got < P && nx) { const b = pg(nx), n = Math.min(U - 4, P - got); out.set(u8.subarray(b + 4, b + 4 + n), got); got += n; nx = dv.getUint32(b); }
    return out;
  };
  const record = p => { const d = new DataView(p.buffer, p.byteOffset, p.byteLength); let [hs, o] = (() => { let v = 0, i = 0; for (; i < 9; i++) { const b = p[i]; v = v * 128 + (b & 127); if (b < 128) break; } return [v, i + 1]; })(); const types = []; while (o < hs) { let v = 0; for (let i = 0; i < 9; i++) { const b = p[o++]; v = v * 128 + (b & 127); if (b < 128) break; } types.push(v); }
    let q = hs; const vals = [];
    for (const t of types) {
      if (t === 0) vals.push(null); else if (t === 8) vals.push(0); else if (t === 9) vals.push(1);
      else if (t >= 1 && t <= 6) { const n = [0, 1, 2, 3, 4, 6, 8][t]; let v = 0; for (let i = 0; i < n; i++) v = v * 256 + p[q + i]; if (p[q] & 128) v -= Math.pow(2, 8 * n); vals.push(v); q += n; }
      else if (t === 7) { vals.push(d.getFloat64(q)); q += 8; }
      else if (t >= 12) { const n = (t - (t % 2 ? 13 : 12)) / 2; const s = p.subarray(q, q + n); vals.push(t % 2 ? td.decode(s) : s.slice()); q += n; }
    }
    return vals;
  };
  const scan = (root, cb) => { const st = [root], seen = new Set(); while (st.length) { const n = st.pop(); if (seen.has(n)) continue; seen.add(n); const b = pg(n) + (n === 1 ? 100 : 0), type = u8[b], nc = dv.getUint16(b + 3), hdr = type === 5 || type === 2 ? 12 : 8;
      for (let i = 0; i < nc; i++) { const co = pg(n) + dv.getUint16(b + hdr + i * 2);
        if (type === 13) { let [P, o] = varint(co); let r; [r, o] = varint(o); cb(r, record(payload(o, P))); }
        else if (type === 5) st.push(dv.getUint32(co)); }
      if (type === 5) st.push(dv.getUint32(b + 8)); } };
  const cols = sql => { const a = sql.indexOf('('), b = sql.lastIndexOf(')'); const body = sql.slice(a + 1, b), out = []; let dep = 0, cur = ''; for (const ch of body) { if (ch === '(') dep++; if (ch === ')') dep--; if (ch === ',' && !dep) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur);
    return out.map(x => x.trim()).filter(x => x && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(x)).map(x => x.match(/^["`\[]?([^"`\]\s]+)/)[1]); };
  const tables = {};
  scan(1, (r, v) => { if (v[0] === 'table' && v[3]) tables[v[1]] = { root: v[3], cols: cols(v[4] || '') }; });
  const rows = name => { const t = tables[name]; if (!t) return []; const out = []; scan(t.root, (r, v) => { const o = {}; t.cols.forEach((c, i) => o[c] = i < v.length ? v[i] : null); out.push(o); }); return out; };
  return { tables, rows };
}
const LIB_MATS = [['softwood', 'Bois tendre'], ['hardwood', 'Bois dur'], ['mdf', 'MDF'], ['acrylic', 'Acrylique'], ['pvc', 'PVC'], ['hdpe', 'PEHD'], ['alu', 'Aluminium'], ['brass', 'Laiton']];
const VT_MAT = { softwood: 'softwood', hardwood: 'hardwood', mdf: 'mdf', acrylic: 'acrylic', 'bois tendre': 'softwood', 'bois dur': 'hardwood', acrylique: 'acrylic', pvc: 'pvc', aluminium: 'alu', aluminum: 'alu', laiton: 'brass', brass: 'brass', pehd: 'hdpe', hdpe: 'hdpe', pe: 'hdpe', 'pe-hd': 'hdpe' };
const VT_TYPE = { 0: 'ball', 1: 'flat', 3: 'v', 4: 'engrave', 6: 'drill' }; // 8 : outil de forme, 9 : pointe diamant (non gérés)
const VT_RATE = { 0: 60, 1: 1, 2: 1000, 3: 1524, 4: 25.4, 5: 304.8 };
function inchFrac(inch) { for (const d of [1, 2, 4, 8, 16, 32, 64]) { const n = inch * d; if (Math.abs(n - Math.round(n)) < 1e-4) { const w = Math.floor(Math.round(n) / d), r = Math.round(n) - w * d; return (w ? w + (r ? ' ' : '') : '') + (r ? r + '/' + d : '') + '"'; } } return String(+inch.toFixed(4)) + '"'; }
// fraise conique à bout sphérique : demi-angle du cône tangent à la bille de rayon R et passant par le Ø D à la longueur L
function taperHalfAngle(D, R, L) { const a = D / 2, b = L - R; if (!(a > R) || !(b > 0)) return 0; const rho = Math.hypot(a, b); return (Math.acos(R / rho) - Math.atan2(b, a)) * 180 / Math.PI; }
function libToolName(t) {
  const D = t.units === 'in' ? inchFrac(t.dia / 25.4) : String(+t.dia.toFixed(3)).replace('.', ',') + ' mm', f2 = v => String(+(+v || 0).toFixed(2)).replace('.', ',');
  // noms des catalogues : Fraise V 90° Ø12 mm ; Javelot 30° × 0,2 mm – Ø3,175 mm (1 dent) ; Fraise V à bout rond R0,25 – L15 – Ø3,175 mm
  if (t.type === 'taper') return 'Fraise V à bout rond R' + f2(t.tipR) + ' – L' + f2(t.flen) + ' – Ø' + D; // comme les catalogues : rayon, longueur de coupe, diamètre de queue (l'angle s'en déduit)
  if (t.type === 'v') return 'Fraise V ' + (+(+t.angle).toFixed(1)) + '° Ø' + D;
  if (t.type === 'engrave') return 'Javelot ' + (+(+t.angle || 0).toFixed(1)) + '° × ' + f2(t.flat) + ' mm – Ø' + D + ' (' + (t.flutes || 1) + ((t.flutes || 1) > 1 ? ' dents)' : ' dent)');
  return t.type === 'flat' ? 'Fraise droite (' + D + ')' : t.type === 'ball' ? 'Fraise hémisphérique (' + D + ')' : t.type === 'v' ? 'Fraise en V (' + (+t.angle.toFixed(1)) + '° - ' + D + ')'
    : t.type === 'engball' ? 'Gravure bout rond (' + (+(t.angle / 2).toFixed(1)) + '°, R ' + String(+(+t.tipR || 0).toFixed(2)).replace('.', ',') + ' mm - ' + D + ')'
    : t.type === 'engrave' ? 'Javelot (' + (+(+t.angle || 0).toFixed(1)) + '°, plat ' + String(+(t.flat || 0).toFixed(2)).replace('.', ',') + ' mm - ' + D + ')' : t.type === 'drill' ? 'Foret (' + (+t.angle.toFixed(0)) + '° - ' + D + ')' : t.type === 'thread' ? 'Fraise à fileter (' + (+(t.angle || 60).toFixed(0)) + '° - ' + D + ')' : D;
}
// avance par dent pour CNC de loisir (mm/dent) : [Ø, bas, conseillé, haut], interpolée selon le diamètre.
// Conseillé : tableau CncFraises « hobby, très prudent » (Ø ≥ 1 mm) recoupé avec Sorotec pour les petits diamètres ;
// bas et haut : bornes au-delà desquelles la fraise frotte (brûle, s'use) ou risque de casser.
const FZ_TAB = {
  softwood: [[0.5, .006, .010, .020], [1, .008, .015, .030], [2, .012, .025, .045], [3, .020, .035, .060], [4, .022, .050, .090], [6, .030, .080, .150], [8, .040, .100, .180]],
  hardwood: [[0.5, .005, .008, .017], [1, .007, .012, .026], [2, .010, .020, .038], [3, .017, .030, .051], [4, .019, .045, .077], [6, .022, .070, .128], [8, .030, .085, .153]],
  mdf: [[0.5, .006, .010, .025], [1, .008, .015, .050], [2, .012, .030, .080], [3, .020, .050, .120], [4, .030, .080, .180], [6, .040, .120, .300], [8, .050, .150, .400]],
  acrylic: [[0.5, .003, .005, .014], [1, .005, .010, .022], [2, .010, .018, .035], [3, .015, .025, .060], [4, .018, .045, .080], [6, .025, .070, .120], [8, .030, .085, .140]],
  pvc: [[0.5, .003, .006, .020], [1, .005, .012, .040], [2, .010, .022, .060], [3, .015, .030, .150], [4, .018, .055, .200], [6, .025, .085, .350], [8, .030, .100, .400]],
  hdpe: [[0.5, .006, .010, .025], [1, .010, .020, .040], [2, .020, .040, .070], [3, .030, .060, .120], [4, .040, .080, .160], [6, .060, .120, .250], [8, .080, .150, .300]],
  alu: [[0.5, .002, .003, .006], [1, .003, .005, .010], [2, .006, .008, .016], [3, .008, .012, .025], [4, .010, .015, .030], [6, .015, .020, .050], [8, .020, .030, .060]],
  brass: [[0.5, .002, .003, .006], [1, .003, .005, .010], [2, .006, .008, .016], [3, .010, .015, .030], [4, .012, .022, .040], [6, .020, .035, .060], [8, .025, .045, .070]],
};
const VC_TAB = { softwood: 500, hardwood: 450, mdf: 450, acrylic: 250, pvc: 300, hdpe: 300, alu: 125, brass: 200 }; // vitesse de coupe (m/min)
// profondeur de passe ap = k × Ø (CncFraises ; sous Ø 2, non donné par CncFraises, repris des réglages éprouvés) : matériaux tendres, durs (acrylique), aluminium et laiton ; bois dur entre les deux
const AP_K = { tendre: [[0, 0.4], [2, 0.5], [3, 0.8], [4, 1]], dur: [[0, 0.35], [2, 0.35], [3, 0.4], [4, 0.5], [5, 0.6]], alu: [[0, 0.1], [2, 0.1], [3, 0.2], [4, 0.25], [5, 0.35]] };
function apK(mat, D) { const st = rows => { let r = rows[0][1]; for (const x of rows) if (D >= x[0]) r = x[1]; return r; }; return (mat === 'alu' || mat === 'brass') ? st(AP_K.alu) : mat === 'acrylic' ? st(AP_K.dur) : mat === 'hardwood' ? 0.7 * st(AP_K.tendre) : st(AP_K.tendre); }
function fzRow(mat, D) { const rows = FZ_TAB[mat] || FZ_TAB.softwood; if (D <= rows[0][0]) return rows[0].slice(1); for (let i = 1; i < rows.length; i++) if (D <= rows[i][0]) { const a = rows[i - 1], b = rows[i], u = (D - a[0]) / (b[0] - a[0]); return [1, 2, 3].map(k => a[k] + (b[k] - a[k]) * u); } return rows[rows.length - 1].slice(1); }
function fzRange(mat, D) { const r = fzRow(mat, D); return [r[0], r[2]]; }
// conseils par matériau (tableau CncFraises et règles d'usage)
const MAT_TIPS = {
  softwood: 'Bois tendre : visez des copeaux, pas de la poussière. Bois brûlé : rotation trop haute ou avance trop faible.',
  hardwood: 'Bois dur : passes moins profondes que dans le bois tendre (environ 0,5 × Ø). Des brûlures viennent d’une avance trop faible ou d’une fraise émoussée.',
  mdf: 'MDF : il accepte une forte avance par dent mais use vite les fraises. Poussière très fine : aspiration et masque indispensables.',
  acrylic: 'Acrylique : fraise 1 dent conseillée. Si la matière fond et colle à la fraise, augmentez l’avance ou baissez la rotation ; un souffle d’air aide à évacuer les copeaux.',
  pvc: 'PVC : fraise 1 dent conseillée. Le PVC expansé (Forex) accepte une avance par dent bien plus forte que le PVC rigide. Ne le laissez pas chauffer : ses fumées sont toxiques.',
  hdpe: 'PEHD : il fond facilement. Fraise 1 dent bien affûtée, avance élevée, sans s’attarder sur place. Il est souple : bridez-le bien et évacuez les longs copeaux.',
  alu: 'Aluminium : fraise 1 dent ou spéciale alu, lubrification indispensable (alcool, huile de coupe ou micro-pulvérisation), passes faibles (0,1 à 0,35 × Ø).',
  brass: 'Laiton : fraise 1 dent ou spéciale alu, passes faibles, lubrification conseillée. Les copeaux sont coupants : lunettes indispensables.',
};
// familles de fraises : conseils et matériaux déconseillés (tableau CncFraises)
const FAM_TIPS = { jav1: 'Pointe javelot 1 dent : conseillée pour les plastiques, le stratifié, le laiton et l’aluminium.', jav2: 'Pointe javelot 2 dents : bois, MDF et plastiques ; pour l’aluminium, prenez une 1 dent.', carv: 'Fraise carving : bois, MDF et plastiques ; déconseillée pour les métaux et le stratifié.' };
const libFam = t => t.fam === 'jav' ? ((+t.flutes || 2) > 1 ? 'jav2' : 'jav1') : t.fam === 'carv' ? 'carv' : '';
const libAvoid = (t, mat) => { const f = libFam(t); return f === 'jav2' ? mat === 'alu' : f === 'carv' ? (mat === 'alu' || mat === 'brass') : false; };
// estimations pour les matériaux absents (machine de loisir, broche 8 000 à 18 000 tr/min, avance plafonnée à 2 000 mm/min) :
// fraises droites et hémisphériques d'après les tableaux ci-dessus ; passe = k × Ø × 0,6 (× 0,4 pour les métaux) car la fraise travaille souvent sur toute sa largeur, 3 mm au plus
function libEstimate(t, mat, base) {
  const r2 = (v, n = 2) => +v.toFixed(n), D = t.dia, z = Math.max(1, t.flutes || 2), rpmOf = (vc, lo = 8000, hi = 18000) => Math.round(Math.min(hi, Math.max(lo, vc * 1000 / (Math.PI * D))) / 100) * 100;
  if (mat === 'pvc') return base.acrylic ? { ...base.acrylic, est: 1 } : null;
  const mill = t.type === 'flat' || t.type === 'ball', metal = mat === 'alu' || mat === 'brass';
  if (mat === 'hdpe' && !mill) { const b = base.pvc || base.acrylic; return b ? { ...b, est: 1 } : null; }
  if (mill && FZ_TAB[mat]) {
    const fz = fzRow(mat, D)[1]; let rpm = rpmOf(VC_TAB[mat]); if (fz * z * rpm > 2000) rpm = Math.max(metal ? 8000 : 10000, Math.round(2000 / (fz * z) / 100) * 100);
    const feed = Math.round(Math.min(2000, fz * z * rpm) / 10) * 10;
    return { rpm, feed, plunge: Math.round(Math.min(metal ? 300 : 1000, feed / 3) / 10) * 10, pass: r2(Math.min(3, Math.max(0.02, apK(mat, D) * D * (metal ? 0.4 : 0.6))) * (t.type === 'ball' ? 0.8 : 1)), step: r2(D * (metal ? 0.3 : 0.4)), est: 1 };
  }
  if (!metal) return null;
  const brass = mat === 'brass', bf = brass ? 0.8 : 1;
  if (t.type === 'drill') { const rpm = rpmOf(brass ? 50 : 80), plunge = Math.round(0.01 * D * bf * rpm / 10) * 10; return { rpm, feed: plunge, plunge, pass: r2(D), step: 0, est: 1 }; }
  if (t.type === 'v' || t.type === 'engrave' || t.type === 'engball') { const rpm = 18000, feed = Math.round(Math.min(600, 0.01 * bf * z * rpm) / 10) * 10; return { rpm, feed, plunge: Math.round(feed / 3 / 10) * 10, pass: t.type === 'engrave' && +t.flat > 0 ? r2(Math.min(0.15, Math.max(0.05, t.flat * 0.5))) : 0.15, step: base.softwood ? base.softwood.step : r2(D * 0.1), est: 1 }; }
  return null;
}
// fraises ajoutées en 1.296 : pointes javelots carbure (queue 3,175 mm) et fraises carving en V carbure (queue 6 mm)
function libStdNew(vg) {
  const out = [], rd = v => Math.round(v / 10) * 10;
  for (const [a, f, z] of [[15, .1, 2], [15, .2, 2], [20, .2, 2], [22, .1, 2], [30, .1, 1], [30, .2, 2], [45, .1, 1], [45, .2, 2], [60, .1, 1], [60, .2, 2], [90, .1, 1], [90, .2, 2]]) {
    const fk = f < 0.15 ? 0.6 : 0.8, p = f < 0.15 ? 0.3 : 0.4, c = (feed, pass) => ({ rpm: 18000, feed: rd(feed * fk), plunge: rd(feed * fk / 3), pass: +pass.toFixed(2), step: +(f * 0.4).toFixed(3) });
    out.push({ id: 'std-jav-' + a + '-' + String(f).replace('.', '_') + '-' + z, group: 'grp-javelot', order: out.length, fam: 'jav', type: 'engrave', units: 'mm', dia: 3.175, angle: a, flat: f, flutes: z, notes: '', num: null,

      cut: { softwood: c(1000, p), hardwood: c(720, p * 0.8), mdf: c(900, p), acrylic: c(z > 1 ? 600 : 700, p * 0.6), pvc: c(z > 1 ? 600 : 700, p * 0.6), hdpe: c(800, p * 0.8) } });
  }
  const V = (rpm, feed, pass) => ({ rpm, feed, plunge: rd(feed / 3.5), pass, step: 0.25 });
  for (const [a, d] of [[45, 10], [60, 32], [90, 32], [120, 32], [150, 32]]) {
    const big = d > 20, t = { id: 'std-carv-' + a + '-' + d, group: vg, order: 20 + out.length, fam: 'carv', type: 'v', units: 'mm', dia: d, angle: a, flat: 0, flutes: 2, notes: '', num: null,
      cut: big ? { softwood: V(12000, 1300, 3), hardwood: V(12000, 950, 2.5), mdf: V(14000, 1600, 3), acrylic: V(12000, 1100, 2), pvc: V(12000, 1100, 2), hdpe: V(12000, 1200, 2.5) }
        : { softwood: V(16000, 900, 1.5), hardwood: V(16000, 650, 1.2), mdf: V(18000, 1000, 2), acrylic: V(16000, 700, 1), pvc: V(16000, 700, 1), hdpe: V(16000, 800, 1.2) } };
    t.name = libToolName(t); out.push(t);
  }
  for (const t of out) if (!t.name) t.name = libToolName(t);
  return out;
}
// bibliothèque v5 : PEHD, javelots et carving (sans doublon d'une fraise de même géométrie), estimations recalculées
function libUpgrade(o) {
  if ((+o.v || 0) >= 5) return libUpgrade6(o);
  o.materials = o.materials.filter(m => m.id !== 'hdpe'); const ip = o.materials.findIndex(m => m.id === 'pvc'); o.materials.splice(ip < 0 ? o.materials.length : ip + 1, 0, { id: 'hdpe', name: 'PEHD' });
  const met = (o.groups.find(g => !g.parent && /m[ée]tri/i.test(g.name)) || {}).id || null, vg = (o.groups.find(g => g.parent === met && /en V/i.test(g.name)) || {}).id || 'grp-javelot';
  if (!o.groups.some(g => g.id === 'grp-javelot')) o.groups.push({ id: 'grp-javelot', name: 'Javelots (carbure)', parent: met, order: 5 });
  const same = (a, b) => a.type === b.type && Math.abs(a.dia - b.dia) < 0.01 && Math.abs((a.angle || 0) - (b.angle || 0)) < 0.5 && (a.type !== 'engrave' || (Math.abs((a.flat || 0) - (b.flat || 0)) < 0.01 && (a.flutes || 2) === (b.flutes || 2)));
  for (const t of libStdNew(vg)) { const x = o.tools.find(x => x.id === t.id || same(x, t)); if (!x) o.tools.push(t); else if (!x.fam && t.fam === 'carv') x.fam = 'carv'; }
  for (const t of o.tools) for (const m in (t.cut || {})) if (t.cut[m] && t.cut[m].est) { const es = libEstimate(t, m, t.cut); if (es) t.cut[m] = es; }
  o.v = 5; return libUpgrade6(o);
}
// bibliothèque v6 : les deux fraises de gravure d'Aspire (et leurs équivalents en pouces) laissent la place aux javelots et aux fraises en V de 30°
const LIB_ENGR_OLD = ['c702876f-6690-4252-a694-c11d46f6ef67', '4c065674-20ee-4214-898c-58b93792b97f', '8c64bdc7-a4ac-4111-9911-d690a409e8c9', '44230771-834e-47a8-b2f2-d1c8de39d683'];
// bibliothèque v7 : rangement par famille (Fraises en V, Fraises javelot, Fraises V à bout rond) dans chaque dossier métrique / impérial,
// dossiers « Gravure » et « Javelots (carbure) » supprimés une fois vides, noms des catalogues pour les fraises nommées automatiquement
function libUpgrade7(o) {
  if ((+o.v || 0) >= 7) return libUpgrade8(o);
  const roots = { mm: (o.groups.find(g => !g.parent && /m[ée]tri/i.test(g.name)) || {}).id, in: (o.groups.find(g => !g.parent && /imp[ée]ri|pouce/i.test(g.name)) || {}).id };
  const fam = { v: ['Fraises en V', 2, /^fraises en v$/i], engrave: ['Fraises javelot', 3, /^fraises javelot$/i], taper: ['Fraises V à bout rond', 4, /^fraises v à bout rond$/i] };
  const grp = (root, k) => { const [nm, ord, re] = fam[k]; let g = o.groups.find(x => x.parent === root && re.test(x.name)); if (!g) { g = { id: 'grp-' + k + '-' + root, name: nm, parent: root, order: ord }; o.groups.push(g); } return g.id; };
  const old = new Set(o.groups.filter(g => /^(gravure|javelots \(carbure\)|fraises en v|outils de forme)$/i.test(g.name) || g.id === 'grp-javelot').map(g => g.id));
  for (const t of o.tools) { if (!fam[t.type]) continue; const root = roots[t.units === 'in' ? 'in' : 'mm']; if (!root || !(old.has(t.group) || !t.group)) continue; t.group = grp(root, t.type); }
  if (roots.mm) for (const k of ['v', 'engrave', 'taper']) grp(roots.mm, k); // les trois dossiers existent toujours en métrique
  o.groups = o.groups.filter(g => !(/^(gravure|javelots \(carbure\))$/i.test(g.name) && !o.tools.some(t => t.group === g.id) && !o.groups.some(x => x.parent === g.id)));
  for (const t of o.tools) if (fam[t.type] && /^(Fraise en V \(|Fraise V \d|Gravure \(|Gravure bout rond|Javelot |Fraise conique à bout)/.test(t.name || '')) t.name = libToolName(t);
  o.v = 7; return libUpgrade8(o);
}
// bibliothèque v8 : fraises V à bout rond du catalogue (R, longueur de coupe L, Ø de queue) ; réglages d'après le tableau du fabricant
// (diamètre de coupe = 2 R, bas de la plage, broche limitée à 18 000 tr/min), bois dur et plastiques 20 % plus bas, laiton comme l'alu moins 20 %
const VBR_CAT = [[0.25, 15, 3.175], [0.5, 15, 3.175], [0.75, 15, 3.175], [1, 15, 3.175], [0.25, 15, 4], [0.5, 15, 4], [0.75, 15, 4], [1, 15, 4], [0.25, 20.5, 4], [0.5, 20.5, 4], [0.75, 20.5, 4], [1, 20.5, 4],
  [0.25, 20, 6], [0.5, 20, 6], [0.75, 20, 6], [1, 20, 6], [1.5, 20, 6], [2, 20, 6], [0.25, 30.5, 6], [0.5, 30.5, 6], [0.75, 30.5, 6], [1, 30.5, 6], [1.5, 30.5, 6], [2, 30.5, 6], [0.5, 47, 8], [0.75, 47, 8], [1, 47, 8], [1.5, 47, 8], [2, 47, 8]];
// tableau « Recommend Cutting Parameters » : [Ø de coupe, tr/min bois (bas), avance bois (bas), avance alu/cuivre (bas)]
const VBR_CUT = [[0.5, 16000, 600, 500], [1, 14000, 800, 600], [1.5, 14000, 1000, 800], [2, 14000, 1100, 800], [2.5, 14000, 1200, 800], [3.1, 14000, 1400, 900], [4, 14000, 2000, 1200]];
function vbrCut(R) { const d = 2 * R; let r = VBR_CUT[0]; for (const x of VBR_CUT) if (d >= x[0] - 1e-9) r = x; const rpm = Math.min(18000, r[1]), w = r[2], al = r[3], pw = +Math.min(2, 2 * R).toFixed(2), pa = +Math.min(1, R).toFixed(2), st = +(2 * R * 0.15).toFixed(3), C = (feed, pass) => ({ rpm, feed, plunge: Math.round(feed / 3 / 10) * 10, pass, step: st });
  return { softwood: C(w, pw), mdf: C(w, pw), hardwood: C(Math.round(w * 0.8 / 10) * 10, +(pw * 0.8).toFixed(2)), acrylic: C(Math.round(w * 0.8 / 10) * 10, +(pw * 0.6).toFixed(2)), pvc: C(Math.round(w * 0.8 / 10) * 10, +(pw * 0.6).toFixed(2)), hdpe: C(Math.round(w * 0.9 / 10) * 10, +(pw * 0.8).toFixed(2)), alu: C(al, pa), brass: C(Math.round(al * 0.8 / 10) * 10, pa) }; }
function libUpgrade8(o) {
  if ((+o.v || 0) >= 8) return o;
  const root = (o.groups.find(g => !g.parent && /m[ée]tri/i.test(g.name)) || {}).id || null;
  let gid = (o.groups.find(g => g.parent === root && /^fraises v à bout rond$/i.test(g.name)) || {}).id; if (!gid) { gid = 'grp-taper-' + root; o.groups.push({ id: gid, name: 'Fraises V à bout rond', parent: root, order: 4 }); }
  o.tools = o.tools.filter(t => !(/^std-vbr-/.test(t.id) && !Object.values(t.cut || {}).some(c => c && c.user))); // les trois fraises provisoires de la 1.308
  VBR_CAT.forEach(([R, L, D], i) => { const t = { id: 'std-vbr-' + [R, L, D].map(v => String(v).replace('.', '_')).join('-'), group: gid, order: i, type: 'taper', units: 'mm', dia: D, tipR: R, flen: L, flat: 0, flutes: 2, notes: '', num: null, cut: vbrCut(R) };
    t.angle = +(2 * taperHalfAngle(D, R, L)).toFixed(3); t.name = libToolName(t);
    if (!o.tools.some(x => x.id === t.id || (x.type === 'taper' && Math.abs(x.dia - D) < 0.01 && Math.abs((+x.tipR || 0) - R) < 0.01 && Math.abs((+x.flen || 0) - L) < 0.05))) o.tools.push(t); });
  for (const t of o.tools) if (t.type === 'taper' && /^Fraise (V à bout rond \d|conique à bout)/.test(t.name || '')) t.name = libToolName(t);
  o.v = 8; return o;
}
function libUpgrade6(o) {
  if ((+o.v || 0) >= 6) return libUpgrade7(o);
  o.tools = o.tools.filter(t => !(LIB_ENGR_OLD.includes(t.id) && !Object.values(t.cut || {}).some(c => c && c.user)));
  o.groups = o.groups.filter(g => !(/^gravure$/i.test(g.name) && !o.tools.some(t => t.group === g.id) && !o.groups.some(x => x.parent === g.id)));
  const met = (o.groups.find(g => !g.parent && /m[ée]tri/i.test(g.name)) || {}).id || null, vg = (o.groups.find(g => g.parent === met && /en V/i.test(g.name)) || {}).id || met;
  const V = (feed, pass) => ({ rpm: 18000, feed, plunge: Math.round(feed / 3 / 10) * 10, pass, step: 0.2 });
  for (const d of [3.175, 6]) { const k = d > 4 ? 1.2 : 1, t = { id: 'std-v30-' + String(d).replace('.', '_'), group: vg, order: 1, type: 'v', units: 'mm', dia: d, angle: 30, flat: 0, flutes: 2, notes: '', num: null,
    cut: { softwood: V(Math.round(900 * k), d > 4 ? 1.5 : 1), hardwood: V(Math.round(650 * k), d > 4 ? 1.2 : 0.8), mdf: V(Math.round(900 * k), d > 4 ? 1.5 : 1), acrylic: V(Math.round(600 * k), d > 4 ? 1 : 0.6), pvc: V(Math.round(600 * k), d > 4 ? 1 : 0.6), hdpe: V(Math.round(700 * k), d > 4 ? 1.2 : 0.8) } };
    t.name = libToolName(t); if (!o.tools.some(x => x.id === t.id || (x.type === 'v' && Math.abs(x.dia - d) < 0.01 && Math.abs((x.angle || 0) - 30) < 0.5))) o.tools.push(t); }
  o.v = 6; return libUpgrade7(o);
}
// conversion d'une base Aspire en bibliothèque COPO ; machineName : réglages de la machine à reprendre (sinon la première qui a des données)
function vtdbToLib(db, machineName) {
  const mats = db.rows('material'), macs = db.rows('machine'), tree = db.rows('tool_tree_entry'), geo = db.rows('tool_geometry'), cut = db.rows('tool_cutting_data'), ent = db.rows('tool_entity');
  const cutBy = new Map(cut.map(c => [c.id, c])), geoBy = new Map(geo.map(g => [g.id, g])), matKey = new Map(mats.map(m => [m.id, VT_MAT[String(m.name).toLowerCase()] || ('m_' + String(m.name).toLowerCase().replace(/[^a-z0-9]+/g, '_'))])), extraMats = mats.filter(m => !VT_MAT[String(m.name).toLowerCase()]).map(m => [matKey.get(m.id), m.name]);
  const withData = new Set(ent.filter(e => e.material_id).map(e => e.machine_id)); let mac = macs.find(m => m.name === machineName && withData.has(m.id)) || macs.find(m => withData.has(m.id)) || macs[0];
  const lib = { v: 3, source: 'Aspire' + (mac ? ' · ' + mac.name : ''), materials: LIB_MATS.concat(extraMats).map(([id, name]) => ({ id, name })), groups: [], tools: [] };
  const GN = { 'imperial tools': 'Outils impériaux (pouces)', 'metric tools': 'Outils métriques (mm)', 'end mills': 'Fraises droites', 'ball nose': 'Fraises hémisphériques', 'v-bits': 'Fraises en V', 'form tools': 'Outils de forme', engraving: 'Gravure', specialist: 'Spécialisés', drills: 'Forets' };
  const skipped = [];
  for (const e of tree) {
    if (!e.tool_geometry_id) { lib.groups.push({ id: e.id, name: GN[String(e.name || '').toLowerCase()] || e.name || 'Dossier', parent: e.parent_group_id || null, order: e.sibling_order || 0 }); continue; }
    const g = geoBy.get(e.tool_geometry_id); if (!g) continue; let type = VT_TYPE[g.tool_type]; if (+g.tip_radius > 0 && +g.included_angle > 0 && (!type || type === 'v' || type === 'engrave')) type = 'taper'; else if (type === 'v' && +g.flat_diameter > 0) type = 'engrave'; if (!type) { skipped.push(g.name_format); continue; }
    const k = g.units === 1 ? 25.4 : 1, t = { id: g.id, group: e.parent_group_id || null, order: e.sibling_order || 0, type, units: g.units === 1 ? 'in' : 'mm', dia: +(g.diameter * k).toFixed(4), angle: g.included_angle || (type === 'drill' ? 118 : type === 'v' ? 90 : 0), flat: g.flat_diameter ? +(g.flat_diameter * k).toFixed(3) : 0, flutes: g.num_flutes || (type === 'engrave' ? 1 : 2), notes: g.notes || '', num: null, cut: {} };
    if (type === 'taper') { const a = t.angle / 2 * Math.PI / 180, R = +(g.tip_radius * k).toFixed(4); t.tipR = R; t.flat = 0; t.flen = +(R * (1 - Math.sin(a)) + (t.dia / 2 - R * Math.cos(a)) / Math.tan(a)).toFixed(2); }
    for (const en of ent.filter(x => x.tool_geometry_id === g.id && (!mac || x.machine_id === mac.id))) {
      const c = cutBy.get(en.tool_cutting_data_id); if (!c) continue;
      if (!en.material_id) { if (c.tool_number) t.num = c.tool_number; continue; }
      const rk = VT_RATE[c.rate_units] || 1, lk = c.length_units === 1 ? 25.4 : 1, m = matKey.get(en.material_id);
      t.cut[m] = { rpm: c.spindle_speed || 0, feed: Math.round((c.feed_rate || c.plunge_rate || 0) * rk), plunge: Math.round((c.plunge_rate || 0) * rk), pass: +((c.stepdown || 0) * lk).toFixed(3), step: +((c.stepover || 0) * lk).toFixed(3) };
      if (c.notes) t.cut[m].notes = c.notes;
    }
    for (const [mid] of LIB_MATS) if (!t.cut[mid]) { const es = libEstimate(t, mid, t.cut); if (es) t.cut[mid] = es; }
    t.name = /\{/.test(g.name_format) ? libToolName(t) : g.name_format; lib.tools.push(t);
  }
  // dossiers vides (outils non gérés) retirés
  for (let ch = true; ch;) { ch = false; lib.groups = lib.groups.filter(g => { const keep = lib.tools.some(t => t.group === g.id) || lib.groups.some(x => x.parent === g.id); if (!keep) ch = true; return keep; }); }
  return { lib, skipped };
}
const DEFAULT_LIB = () => libUpgrade(JSON.parse(DEFAULT_LIB_JSON));
let LIBDEF = null; const libDefTool = id => (LIBDEF || (LIBDEF = DEFAULT_LIB())).tools.find(t => t.id === id);
/*@donnee default-lib-json*/
let LIB = (() => { try { const o = JSON.parse(LS.get('copo.toollib') || 'null'); if (o && o.tools && o.groups) { if ((+o.v || 0) < 4) { const D = DEFAULT_LIB(), ids = new Set(o.tools.map(t => t.id)), gids = new Set(o.groups.map(g => g.id)); for (const t of D.tools) if (/^std-/.test(t.id) && !ids.has(t.id) && gids.has(t.group)) o.tools.push(t); o.v = 4; try { LS.set('copo.toollib', JSON.stringify(o)); } catch { } } return o; } } catch { } return DEFAULT_LIB(); })(); // v4 : fraises et forets standard ajoutés aux bibliothèques existantes
for (const [id, name] of LIB_MATS) if (!LIB.materials.some(m => m.id === id)) LIB.materials.push({ id, name });
if ((LIB.v || 1) < 3) { for (const t of LIB.tools) for (const m of ['softwood', 'hardwood', 'mdf', 'acrylic', 'alu', 'brass', 'pvc']) if (!t.cut[m] || t.cut[m].est) { const es = libEstimate(t, m, t.cut); if (es) t.cut[m] = es; } LIB.v = 3; try { LS.set('copo.toollib', JSON.stringify(LIB)); } catch { } }
if ((+LIB.v || 0) < 8) { libUpgrade(LIB); try { LS.set('copo.toollib', JSON.stringify(LIB)); } catch { } } // v5 : PEHD, javelots, carving en V
let libSel = null, libPick = null, libOpenG = new Set((() => { try { return JSON.parse(LS.get('copo.libOpen') || '[]'); } catch { return []; } })()), libResetArm = 0, libPendingDb = null;
if (!LIB.thr) {
  const par = (LIB.groups.find(g => !g.parent && /m[ée]tri/i.test(g.name)) || {}).id || null, gid = 'grp-thread';
  if (!LIB.groups.some(g => g.id === gid)) LIB.groups.push({ id: gid, name: 'Fraises à fileter', parent: par, order: 7 });
  const num = Math.max(0, ...LIB.tools.map(t => +t.num || 0));
  const cut = (w, a) => ({ softwood: { rpm: 16000, feed: w, plunge: 300, pass: 20, step: 0, est: 1 }, mdf: { rpm: 16000, feed: w, plunge: 300, pass: 20, step: 0, est: 1 }, hardwood: { rpm: 16000, feed: Math.round(w * 0.75), plunge: 250, pass: 20, step: 0, est: 1 }, acrylic: { rpm: 12000, feed: Math.round(w * 0.6), plunge: 200, pass: 20, step: 0, est: 1 }, pvc: { rpm: 12000, feed: Math.round(w * 0.6), plunge: 200, pass: 20, step: 0, est: 1 }, alu: { rpm: 12000, feed: a, plunge: 150, pass: 20, step: 0, est: 1 }, brass: { rpm: 10000, feed: Math.round(a * 0.8), plunge: 120, pass: 20, step: 0, est: 1 } });
  LIB.tools.push({ id: 'thr-4', group: gid, order: 0, type: 'thread', units: 'mm', dia: 4, angle: 60, flat: 0, flen: 12, flutes: 3, num: num + 1, notes: 'Monodent, carbure : du M5 au M12 environ.', name: 'Fraise à fileter (60° - 4 mm)', cut: cut(700, 250) });
  LIB.tools.push({ id: 'thr-8', group: gid, order: 1, type: 'thread', units: 'mm', dia: 8, angle: 60, flat: 0, flen: 20, flutes: 3, num: num + 2, notes: 'Monodent, carbure : à partir du M10.', name: 'Fraise à fileter (60° - 8 mm)', cut: cut(900, 350) });
  LIB.thr = 1; try { LS.set('copo.toollib', JSON.stringify(LIB)); } catch { }
}
// fraise ajoutée par erreur en 1.81 (dimensions déduites d'un angle) : retirée de la bibliothèque
if (!LIB.engbDel) { LIB.tools = LIB.tools.filter(t => t.id !== 'engb-10-025'); LIB.engb = 1; LIB.engbDel = 1; try { LS.set('copo.toollib', JSON.stringify(LIB)); } catch { } }
// une « gravure à bout rond » est une fraise conique à bout sphérique : conversion en D, R, L (L = hauteur où le cône atteint D)
{ let ch = false; for (const t of LIB.tools) if (t.type === 'engball') { const b = (+t.angle || 20) / 2 * Math.PI / 180, R = +t.tipR || 0.25, rt = R * Math.cos(b), L = R * (1 - Math.sin(b)) + (t.dia / 2 - rt) / Math.tan(b); t.type = 'taper'; t.flen = +L.toFixed(2); t.angle = +(2 * taperHalfAngle(t.dia, R, t.flen)).toFixed(3); t.name = libToolName(t); ch = true; } if (ch) try { LS.set('copo.toollib', JSON.stringify(LIB)); } catch { } }
{ let ch = false; const D0 = t => t.units === 'in' ? inchFrac(t.dia / 25.4) : String(+t.dia.toFixed(2)).replace('.', ',') + ' mm';
  for (const t of LIB.tools) {
    if (t.type === 'v' && +t.flat > 0) { t.type = 'engrave'; ch = true; }
    if (t.type === 'v' && +t.tipR > 0) { const a = (+t.angle || 20) / 2 * Math.PI / 180, R = +t.tipR; t.type = 'taper'; t.flen = +(R * (1 - Math.sin(a)) + (t.dia / 2 - R * Math.cos(a)) / Math.tan(a)).toFixed(2); t.name = libToolName(t); ch = true; }
    if (t.type === 'engrave' && t.name === 'Gravure (' + (+(t.angle / 2).toFixed(1)) + '°, pointe ' + String(+(t.flat || 0).toFixed(2)).replace('.', ',') + ' mm - ' + D0(t) + ')') { t.name = libToolName(t); ch = true; }
    if (t.type === 'taper' && /^Fraise conique à bout sphérique \(/.test(t.name)) { t.name = t.name.replace('bout sphérique', 'bout rond'); ch = true; } }
  if (ch) try { LS.set('copo.toollib', JSON.stringify(LIB)); } catch { } }
function libSave() { try { LS.set('copo.toollib', JSON.stringify(LIB)); } catch { } }
const projMat = () => (S.stock && LIB.materials.some(m => m.id === S.stock.mat)) ? S.stock.mat : (LIB.materials[0] || { id: 'softwood' }).id;
const libMatName = id => { const m = LIB.materials.find(x => x.id === id); return m ? tr(m.name) : id; };
const libTool = id => LIB.tools.find(t => t.id === id);
// réglages d'origine d'un outil pour un matériau : ceux livrés avec COPO, sinon l'estimation ; null si aucun
function libOrigCut(t, mat) { const d = libDefTool(t.id); if (d && d.cut && d.cut[mat]) return { ...d.cut[mat] }; const b = { ...t.cut }; delete b[mat]; return libEstimate(t, mat, b); }
// réglages modifiés par l'utilisateur (marqués depuis la 1.296, ou différents de ceux livrés avec COPO)
function libIsUser(t, mat) { const c = t.cut && t.cut[mat]; if (!c || c.est) return false; if (c.user) return true; const d = libDefTool(t.id), o = d && d.cut && d.cut[mat]; return !!o && ['rpm', 'feed', 'plunge', 'pass', 'step'].some(k => Math.abs((+c[k] || 0) - (+o[k] || 0)) > 1e-6); }
let libWarned = false; function libEditWarn() { if (libWarned) return; libWarned = true; toast(tr('Réglage enregistré dans la bibliothèque : il servira à tous les parcours et projets qui utilisent cet outil avec ce matériau. « Revenir aux valeurs d’origine » l’annule.')); }
const pct = (a, b) => b > 0 ? Math.round(100 * a / b) : 0;
// réglages de l'outil pour un matériau (repli : estimation, puis bois tendre, puis premier disponible)
// débourrage conseillé selon le matériau : métaux à copeaux longs (aluminium, cuivre, laiton) 0,5 × D ; aciers et fontes 1 × D ; plastiques 1 × D (évite de fondre) ; bois et MDF 2 × D
function peckK(mat) { const m = (LIB.materials.find(x => x.id === mat) || {}).name || mat || '', s = (mat + ' ' + m).toLowerCase(); return /alu|cuivre|copper|laiton|brass|bronze|zamak/.test(s) ? 0.5 : /acier|steel|fonte|iron|inox|titan/.test(s) ? 1 : /acryl|pvc|plast|pmma|polyc|abs|nylon|delrin|pom|hdpe|pehd/.test(s) ? 1 : 2; }
const peckDef = (dia, mat) => Math.max(0.5, Math.round(peckK(mat) * (+dia || 0) * 2) / 2);
function libCut(t, mat) { if (t.cut && t.cut[mat]) return { ...t.cut[mat], src: 'lib' }; const es = libEstimate(t, mat, t.cut || {}); if (es) return { ...es, src: 'est' }; const k = Object.keys(t.cut || {}); const c = t.cut.softwood || (k.length ? t.cut[k[0]] : null); return c ? { ...c, src: 'other' } : { rpm: 18000, feed: 1000, plunge: 300, pass: +(t.dia / 2).toFixed(2), step: +(t.dia * 0.4).toFixed(2), src: 'none' }; }
function libFlat(t, mat) { const c = libCut(t, mat), step = +c.step || t.dia * 0.4; return { tipR: t.tipR || '', flen: t.flen || '', name: t.name, type: t.type, dia: t.dia, angle: t.angle || (t.type === 'drill' ? 118 : 90), flat: t.flat || 0, flutes: t.flutes || 2, num: t.num || '', notes: t.notes || '', peck: c.peck ?? peckDef(t.dia, mat), rpm: c.rpm || 0, feed: c.feed || c.plunge || 0, plunge: c.plunge || Math.round((c.feed || 0) / 3), pass: c.pass || +(t.dia / 2).toFixed(2), step: +step.toFixed(3), stepPct: pct(step, t.dia), over: Math.max(0, Math.min(95, Math.round(100 * (1 - step / t.dia)))), src: c.src, est: !!c.est }; }
// outil de la bibliothèque → outil du projet (copie des réglages pour le matériau du projet)
function libProjVals(t, mat) { const f = libFlat(t, mat), mx = (S.machine && +S.machine.maxFeed) || Infinity; return { ...(+t.num > 0 ? { num: +t.num } : {}), name: t.name, type: (t.type === 'engrave' || t.type === 'taper' || t.type === 'engball') ? 'v' : t.type, dia: t.dia, angle: t.angle || (t.type === 'drill' ? 118 : t.type === 'thread' ? 60 : 90), flen: +t.flen || 0, tipR: t.type === 'taper' || t.type === 'engball' ? +t.tipR || 0 : 0, flat: t.type === 'engrave' ? Math.min(+t.flat || 0, t.dia * 0.99) : 0, noCenter: !!t.noCenter && (t.type === 'flat' || t.type === 'ball'), flutes: f.flutes, rpm: f.rpm, feed: Math.min(f.feed, mx), plunge: Math.min(f.plunge, mx), pass: f.pass, over: f.over, peck: f.peck }; }
function libToProject(t, mat) {
  let pt = S.tools.find(x => x.libId === t.id); const v = libProjVals(t, mat || projMat());
  if (!pt) { let num = +t.num; if (!(num > 0)) { num = 1; while (S.tools.some(x => +x.num === num)) num++; } pt = { id: uid(), libId: t.id, num, ...v }; S.tools.push(pt); } else Object.assign(pt, v);
  return pt;
}
function libSyncProject() { const mat = projMat(); let ch = false; for (const pt of S.tools) { const t = pt.libId && libTool(pt.libId); if (t) { Object.assign(pt, libProjVals(t, mat)); ch = true; } } if (ch) { recomputeAll(); if (typeof renderForm === 'function') renderForm(); } }
// relie les outils d'un projet à la bibliothèque (même type et même diamètre), sinon les y ajoute
function libLinkProject() {
  let added = 0;
  for (const pt of S.tools) {
    if (pt.libId && libTool(pt.libId)) continue;
    const m = LIB.tools.find(t => (t.type === pt.type || (pt.type === 'v' && (t.type === 'engrave' || t.type === 'engball'))) && Math.abs(t.dia - pt.dia) < 0.01 && (pt.type === 'flat' || pt.type === 'ball' || Math.abs((t.angle || 0) - (pt.angle || 0)) < 0.5));
    if (m) { pt.libId = m.id; continue; }
    let g = LIB.groups.find(x => x.id === 'g_proj'); if (!g) { g = { id: 'g_proj', name: 'Outils des projets', parent: null, order: 99 }; LIB.groups.push(g); }
    const step = pt.dia * Math.max(0.05, 1 - (+pt.over || 40) / 100), t = { id: 'u' + uid(), group: g.id, order: LIB.tools.length, type: pt.type, units: 'mm', dia: pt.dia, angle: pt.angle || 0, flat: 0, flutes: pt.flutes || 2, num: pt.num || null, notes: '', name: pt.name, cut: { [projMat()]: { rpm: pt.rpm, feed: pt.feed, plunge: pt.plunge, pass: pt.pass, step: +step.toFixed(3) } } };
    LIB.tools.push(t); pt.libId = t.id; added++;
  }
  if (added) libSave();
}
// compatibilité outil / type de parcours
const libFits = (ft, t) => !ft || (ft === 'flatonly' ? t.type === 'flat' : ft === 'vonly' ? (t.type === 'v' || t.type === 'engrave' || t.type === 'taper') : ft === 'thread' ? t.type === 'thread' : ft === 'relief' ? (t.type === 'flat' || t.type === 'ball' || t.type === 'v' || t.type === 'taper' || t.type === 'engrave' || t.type === 'engball') : t.type === 'thread' ? false : ft === 'vcarve' ? (t.type === 'v' || t.type === 'engrave' || t.type === 'taper' || t.type === 'engball') : ft === 'drill' ? (t.type !== 'engrave' && t.type !== 'taper') : ft === 'profile' ? t.type !== 'drill' : (t.type === 'flat' || t.type === 'ball' || t.type === 'v'));
const LIB_ICO = { engball: '<path d="M9 3h6v4H9zM9 7h6l-2.2 11.5a.8.8 0 0 1-1.6 0z"/>', thread: '<path d="M9 3h6v4H9zM11 7h2v12h-2z"/><path d="M8 19l4-2 4 2-4 2z"/>', taper: '<path d="M9 3h6v4H9zM9 7h6l-2 12a1 1 0 0 1-2 0z"/>', flat: '<path d="M9 3h6v4H9zM10 7h4v14h-4z"/>', ball: '<path d="M9 3h6v4H9zM10 7h4v11a2 2 0 0 1-4 0z"/>', v: '<path d="M9 3h6v4H9zM9 7h6l-3 14z"/>', engrave: '<path d="M9 3h6v4H9zM9 7h6l-2 13h-2z"/>', drill: '<path d="M9 3h6v4H9zM10 7h4v11l-2 3-2-3z"/>' };
const GRP_ICO = '<path d="M3 7h6l2 2h10v10H3z"/>';
function libCardSync() { const el = document.getElementById('libCardSub'); if (!el) return; const n = new Set(S.tps.map(t => t.toolId)).size; el.textContent = trf('{m} · {n} outil(s) utilisé(s)', { m: libMatName(projMat()), n }); }
function libMatSync() { libCardSync(); for (const id of ['#libMat', '#pjLibMat']) { const sel = $(id); if (!sel) continue; sel.innerHTML = ''; for (const m of LIB.materials) { const o = document.createElement('option'); o.value = m.id; o.textContent = tr(m.name); sel.appendChild(o); } sel.value = projMat(); } }
function libSetMat(id) { S.stock.mat = id; libMatSync(); libSyncProject(); commit(false); pjSummary(); libRender(); }
function libRender() {
  const box = $('#lib'); if (!box || box.hidden) return; libMatSync();
  const q = ($('#libSearch').value || '').trim().toLowerCase(), ul = $('#libTree'); ul.innerHTML = '';
  const used = new Set(S.tools.filter(x => S.tps.some(tp => tp.toolId === x.id)).map(x => x.libId)), ft = libPick && libPick.ftype;
  const kids = pid => LIB.groups.filter(g => (g.parent || null) === pid).sort((a, b) => (a.order || 0) - (b.order || 0)), toolsIn = gid => LIB.tools.filter(t => (t.group || null) === gid && (!q || t.name.toLowerCase().includes(q))).sort((a, b) => String(a.type).localeCompare(String(b.type)) || (+a.dia || 0) - (+b.dia || 0) || String(a.name).localeCompare(String(b.name), 'fr', { numeric: true }));
  const hasMatch = gid => toolsIn(gid).length || kids(gid).some(g => hasMatch(g.id));
  const add = (html, cls, dep, onclick) => { const li = document.createElement('li'); li.className = cls; li.style.paddingLeft = (6 + dep * 16) + 'px'; li.innerHTML = html; li.onclick = onclick; ul.appendChild(li); return li; };
  const walk = (pid, dep) => {
    for (const g of kids(pid)) { if (q && !hasMatch(g.id)) continue; const open = q || libOpenG.has(g.id); const li = add('<span class="tw">' + (open ? '▾' : '▸') + '</span><svg viewBox="0 0 24 24">' + GRP_ICO + '</svg><span></span>', 'grp' + (libSel === g.id ? ' on' : ''), dep, () => { if (libOpenG.has(g.id)) libOpenG.delete(g.id); else libOpenG.add(g.id); try { LS.set('copo.libOpen', JSON.stringify([...libOpenG])); } catch { } libSel = g.id; libRender(); }); li.querySelector('span:last-child').textContent = tr(g.name); li.ondblclick = e => { e.stopPropagation(); const nm = window.prompt && window.prompt(tr('Nom du dossier'), tr(g.name)); if (nm && nm.trim()) { g.name = nm.trim(); libSave(); libRender(); } }; if (open) walk(g.id, dep + 1); }
    for (const t of toolsIn(pid)) { const li = add('<svg viewBox="0 0 24 24">' + (LIB_ICO[t.type] || LIB_ICO.flat) + '</svg><span></span>' + (used.has(t.id) ? '<span class="used">' + tr('utilisé') + '</span>' : ''), (libSel === t.id ? 'on' : '') + (ft && !libFits(ft, t) ? ' off' : ''), dep, () => { libSel = t.id; libRender(); }); li.querySelector('span').textContent = t.name; li.ondblclick = () => { if (libPick) act('libUse'); }; }
  };
  walk(null, 0);
  const t = libTool(libSel), form = $('#toolForm'); form.hidden = !t; $('#libEmpty').hidden = !!t;
  if (t) {
    const mat = projMat(), f = libFlat(t, mat);
    form.querySelectorAll('[data-t]').forEach(el => { if (el.type === 'checkbox') el.checked = !!t[el.dataset.t]; else if (document.activeElement !== el) el.value = f[el.dataset.t] ?? ''; });
    $$('#toolForm [data-tshow]').forEach(el => { el.style.display = el.dataset.tshow.split(' ').includes(t.type) ? '' : 'none'; });
    $('#tAngLbl').textContent = tr(t.type === 'drill' ? 'Angle de pointe α (°)' : t.type === 'thread' ? 'Angle du filet α (°)' : 'Angle du V α (°)'); $('#tDiaLbl').textContent = tr(t.type === 'taper' ? 'Diamètre de queue D (mm)' : 'Diamètre D (mm)');
    $('#libCutH').textContent = trf('Réglages de coupe — {m}', { m: libMatName(mat) });
    const est = $('#libEst'); est.hidden = f.src === 'lib' && !f.est; est.textContent = f.src === 'none' ? tr('Aucun réglage pour ce matériau : valeurs génériques, à adapter.') : f.src === 'other' ? tr('Pas de réglage pour ce matériau : valeurs reprises d’un autre matériau, à adapter.') : tr('Valeurs de départ estimées pour une CNC de loisir, d’après les tableaux CncFraises et Sorotec (réglages prudents ; PVC comme l’acrylique). Validez-les par un essai et corrigez-les : elles deviendront les vôtres.');
    const usr = libIsUser(t, mat), org = usr && libOrigCut(t, mat); $('#libUser').hidden = !usr; $('#libOrig').hidden = !org;
    const av = $('#libAvoid'); av.hidden = !libAvoid(t, mat); av.textContent = av.hidden ? '' : tr(mat === 'brass' ? 'Fraise déconseillée pour le laiton (tableau CncFraises).' : 'Fraise déconseillée pour l’aluminium (tableau CncFraises).');
    $('#libTip').textContent = [FAM_TIPS[libFam(t)], MAT_TIPS[mat]].filter(Boolean).map(tr).join(' ');
    const flat = { ...f, type: (t.type === 'engrave' || t.type === 'taper' || t.type === 'engball') ? 'v' : t.type };
    toolFzSync(flat); $('#toolCalc').textContent = t.type === 'taper' ? (() => { const h = taperHalfAngle(t.dia, t.tipR, t.flen); return h > 0 ? trf('Angle déduit : {a}° de dépouille (angle inclus {b}°)', { a: fr(h, 2), b: fr(2 * h, 2) }) : tr('Vérifiez D, R et L : il faut D/2 > R et L > R.'); })() : toolCalcText(flat);
  }
  illRefresh();
  const use = $('#libUse'); use.hidden = !libPick; if (libPick) { const ok = t && libFits(ft, t); use.disabled = !ok; $('#libPickInfo').textContent = !t ? tr('Choisissez l’outil du parcours (double-clic pour l’utiliser).') : ok ? '' : tr('Cet outil ne convient pas à ce type de parcours.'); } else $('#libPickInfo').textContent = '';
}
function libOpen(pick) {
  libPick = pick || null; libLinkProject();
  if (pick && pick.toolId) { const pt = S.tools.find(x => x.id === pick.toolId); if (pt && pt.libId) libSel = pt.libId; }
  if (!libTool(libSel) && !LIB.groups.some(g => g.id === libSel)) libSel = null;
  // ouvre les dossiers qui mènent à l'outil sélectionné
  const t = libTool(libSel); if (t) { let g = t.group; while (g) { libOpenG.add(g); const gg = LIB.groups.find(x => x.id === g); g = gg && gg.parent; } }
  if (!libOpenG.size) LIB.groups.filter(g => !g.parent).forEach(g => libOpenG.add(g.id));
  $('#lib').hidden = false; closeMenus && closeMenus(); libRender();
}
function libClose() { $('#lib').hidden = true; libPick = null; $('#libMach').hidden = true; illRefresh(); }
function libChanged(t) { libSave(); const pt = S.tools.find(x => x.libId === t.id); if (pt) { Object.assign(pt, libProjVals(t, projMat())); clearTimeout(libChanged.tm); libChanged.tm = setTimeout(() => { recomputeAll(); commit(false); renderForm(); }, 350); } }
$('#toolForm').addEventListener('input', e => {
  const k = e.target.dataset.t, t = libTool(libSel); if (!k || !t) return; const mat = projMat(), v = e.target.value, num = +v;
  if (k === 'noCenter') { t.noCenter = e.target.checked; libChanged(t); libRender(); return; }
  const geo = ['name', 'type', 'dia', 'angle', 'flat', 'tipR', 'flen', 'flutes', 'num', 'notes'];
  if (geo.includes(k)) { const auto = t.name === libToolName(t); t[k] = (k === 'name' || k === 'type' || k === 'notes') ? v : num; if (t.type === 'taper') { if (!(t.tipR > 0)) t.tipR = 1; if (!(t.flen > 0)) t.flen = 20; t.angle = +(2 * taperHalfAngle(t.dia, t.tipR, t.flen)).toFixed(3); } if (auto && k !== 'name' && k !== 'notes') t.name = libToolName(t); }
  else { const c = t.cut[mat] = { ...libCut(t, mat) }; delete c.src; delete c.est; c.user = 1; libEditWarn(); if (k === 'stepPct') c.step = +(t.dia * num / 100).toFixed(3); else c[k] = num; }
  if (t.type === 'engrave' && ['flat', 'dia'].includes(k) && !(+t.flat > 0 && +t.flat < +t.dia)) toast(tr('Le diamètre du plat doit être plus grand que 0 et plus petit que le diamètre de la fraise.'));
  if (t.type === 'taper' && ['tipR', 'dia'].includes(k) && !(+t.tipR > 0 && +t.tipR < +t.dia / 2)) toast(tr('Le rayon du bout doit être plus grand que 0 et plus petit que la moitié du diamètre.'));
  libChanged(t); libRender();
});
// diamètre modifié (validé) : vitesses, avances, passe et pas latéral suivent le rapport des estimations entre l'ancien et le nouveau diamètre
let libDia0 = null;
$('#toolForm').addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.t === 'dia') { const t = libTool(libSel); libDia0 = t ? { id: t.id, d: +t.dia } : null; } });
$('#toolForm').addEventListener('change', e => { if (!e.target.dataset || e.target.dataset.t !== 'dia' || !libDia0) return; const t = libTool(libSel); if (!t || t.id !== libDia0.id) return; const d0 = libDia0.d, d1 = +t.dia; libDia0 = { id: t.id, d: d1 };
  if (!(d0 > 0) || !(d1 > 0) || Math.abs(d1 - d0) < 1e-6 || (t.type !== 'flat' && t.type !== 'ball')) return; let n = 0;
  for (const m in t.cut) { const c = t.cut[m]; if (!c) continue; const e0 = libEstimate({ ...t, dia: d0 }, m, {}), e1 = libEstimate(t, m, {}); if (!e0 || !e1) continue; n++;
    if (c.est) { t.cut[m] = e1; continue; } const k = f => +e0[f] > 0 ? +e1[f] / +e0[f] : d1 / d0;
    t.cut[m] = { ...c, rpm: Math.round(c.rpm * k('rpm') / 100) * 100, feed: Math.round(c.feed * k('feed') / 10) * 10, plunge: Math.round(c.plunge * k('plunge') / 10) * 10, pass: +(c.pass * k('pass')).toFixed(2), step: +(c.step * d1 / d0).toFixed(3) }; }
  if (n) { libChanged(t); libRender(); toast(trf('Diamètre modifié : vitesses, avances, passes et pas latéraux recalculés pour {n} matériau(x). Vérifiez-les.', { n })); } });
$('#tFz').addEventListener('input', e => { e.stopPropagation(); const t = libTool(libSel); const fz = +e.target.value; if (!t) return; const mat = projMat(), c = t.cut[mat] = { ...libCut(t, mat) }; delete c.src; delete c.est; c.user = 1; libEditWarn(); if (!(fz > 0) || !(+c.rpm > 0)) return; c.feed = Math.round(fz * c.rpm * (t.flutes || 2)); libChanged(t); libRender(); });
$('#libSearch').addEventListener('input', () => libRender());
$('#libMat').addEventListener('change', e => libSetMat(e.target.value));
document.getElementById('pjLibMat').addEventListener('change', e => libSetMat(e.target.value));
function libCurGroup() { const t = libTool(libSel); if (t) return t.group || null; if (LIB.groups.some(g => g.id === libSel)) return libSel; return (LIB.groups.find(g => !g.parent) || {}).id || null; }
function libImportLib(src, label) { // fusionne une bibliothèque dans un dossier racine
  const root = { id: 'g' + uid(), name: label, parent: null, order: Math.max(0, ...LIB.groups.filter(g => !g.parent).map(g => g.order || 0)) + 1 }, map = new Map();
  LIB.groups.push(root); for (const g of src.groups) { const ng = { ...g, id: 'g' + uid() }; map.set(g.id, ng.id); LIB.groups.push(ng); }
  for (const g of LIB.groups) if (map.has(g.parent)) g.parent = map.get(g.parent); for (const g of src.groups) { const ng = LIB.groups.find(x => x.id === map.get(g.id)); if (!g.parent) ng.parent = root.id; }
  for (const m of src.materials || []) if (!LIB.materials.some(x => x.id === m.id)) LIB.materials.push(m);
  let n = 0; for (const t of src.tools) { LIB.tools.push({ ...t, id: 't' + uid(), group: map.get(t.group) || root.id }); n++; }
  libOpenG.add(root.id); libSave(); libRender(); return n;
}
function libDoImportDb(db, mac) { const { lib, skipped } = vtdbToLib(db, mac); const n = libImportLib(lib, trf('Import Aspire {d}', { d: new Date().toLocaleDateString(LANG === 'fr' ? 'fr-FR' : 'en-GB') })); $('#libMach').hidden = true; toast(trf('{n} outils importés', { n }) + (skipped.length ? ' · ' + trf('{k} ignorés (outils de forme, pointe diamant)', { k: skipped.length }) : '') + '.'); }
readFile($('#fLib'), (data, f) => {
  if (/\.json$/i.test(f.name)) { const o = JSON.parse(new TextDecoder().decode(data));
    if (o && o.tools && o.groups) { const n = libImportLib(o, f.name.replace(/\.json$/i, '')); toast(trf('{n} outils importés', { n }) + '.'); return; }
    if (Array.isArray(o) && o.every(t => t && t.dia > 0)) { const mat = projMat(), lib = { groups: [], tools: o.map((t, i) => ({ id: t.id || uid(), group: null, order: i, type: t.type || 'flat', units: 'mm', dia: t.dia, angle: t.angle || 0, flat: 0, flutes: t.flutes || 2, num: t.num || null, notes: '', name: t.name || libToolName(t), cut: { [mat]: { rpm: t.rpm, feed: t.feed, plunge: t.plunge, pass: t.pass, step: +(t.dia * Math.max(0.05, 1 - (+t.over || 40) / 100)).toFixed(3) } } })) }; const n = libImportLib(lib, f.name.replace(/\.json$/i, '')); toast(trf('{n} outils importés', { n }) + '.'); return; }
    throw new Error(tr('Bibliothèque invalide.')); }
  const db = sqliteRead(data), mats = db.rows('material'), macs = db.rows('machine'), ent = db.rows('tool_entity'), withData = macs.filter(m => ent.some(e => e.machine_id === m.id && e.material_id));
  if (!db.tables.tool_geometry) throw new Error(tr('Ce fichier n’est pas une bibliothèque d’outils Aspire.'));
  if (withData.length > 1) { libPendingDb = db; const box = $('#libMach'); box.innerHTML = '<span>' + escH(tr('Réglages de quelle machine ?')) + '</span>'; for (const m of withData) { const b = document.createElement('button'); b.textContent = m.name; b.onclick = () => libDoImportDb(libPendingDb, m.name); box.appendChild(b); } box.hidden = false; return; }
  libDoImportDb(db, withData[0] && withData[0].name);
}, true);

