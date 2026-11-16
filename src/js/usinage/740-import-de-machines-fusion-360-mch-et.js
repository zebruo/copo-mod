// ---------- import de machines Fusion 360 (.mch) et FreeCAD 1.2+ (.fcm) ----------
// Le post-processeur d'origine (nom du .cps Fusion ou file_name FreeCAD) est relié au plus proche de COPO.
const MACH_POST_GUESS = [[/haas.*(next|ngc)/, 'haas'], [/haas/, 'haaspre'], [/robodrill/, 'robodrill'], [/makino/, 'makino'], [/yasnac|yaskawa/, 'yasnac'], [/meldas|mitsubishi/, 'meldas'],
  [/syntec/, 'syntec'], [/hurco/, 'hurco'], [/centroid|acorn/, 'centroid'], [/fadal/, 'fadal'], [/fanuc/, 'fanuc'], [/grblhal/, 'grblhal'], [/carbide|shapeoko|nomad/, 'carbide'],
  [/onefinity|buildbotics/, 'onefinity'], [/linuxcnc|rs274|emc2?\b|pathpilot/, 'linuxcnc'], [/mach ?[34]/, 'mach3'], [/stepcraft/, 'stepcraft'], [/uccnc/, 'uccnc'], [/masso/, 'masso'],
  [/estlcam/, 'estlcam'], [/tinyg|g2core/, 'tinyg'], [/wincnc/, 'wincnc'], [/winpc/, 'winpcnc'], [/grbl|smoothie|marlin|generic/, 'grbl']];
function machPostGuess(name) { const n = String(name || '').toLowerCase(); for (const [re, k] of MACH_POST_GUESS) if (re.test(n) && POSTS[k]) return k; return null; }
function machNotePost(m, src, post0, warn) { if (m.post === 'grbl' && !/grbl|generic|smoothie|marlin/i.test(post0)) warn.push(trf('post-processeur « {p} » inconnu de COPO : GRBL choisi, à changer', { p: post0 || '?' })); }
function machFromFusion(o, fn) {
  const g = o.general || {}, caps = g.capabilities || [], warn = [];
  if (caps.length && !caps.includes('milling')) return { err: trf('Machine Fusion non importée : ce n’est pas une fraiseuse ({c}).', { c: caps.join(', ') }) };
  const K = (o.kinematics && o.kinematics.default) || {}, k = (K.units && K.units.length) === 'inch' ? 25.4 : 1, lin = {}, rot = [], sp = [];
  (function walk(ps) { for (const p of ps || []) { if (p.type === 'linear' && /^[XYZ]$/.test(p.name || p.id)) lin[p.name || p.id] = p; else if (p.type === 'rotary') rot.push(p); if (p.spindle) sp.push(p.spindle); walk(p.parts); } })(K.parts);
  if (rot.length > 1) return { err: trf('Machine Fusion non importée : « {m} » a {n} axes rotatifs (5 axes). COPO usine en 3 axes, avec un 4ᵉ axe enroulé au plus.', { m: g.description || fn, n: rot.length }) };
  const C = (o.controller && (o.controller.default || o.controller.synced_configuration)) || {}, P = C.parts || {}, vmax = key => Math.max(0, ...['X', 'Y', 'Z'].map(a => +((P[a] || {})[key]) || 0));
  const post0 = String(((o.post || {}).default || {}).path || '').replace(/^.*[\/:]/, '').replace(/\.cps$/i, '');
  const m = { ...MACH_DEF, name: String(g.description || [g.vendor, g.model].filter(Boolean).join(' ') || fn.replace(/\.mch$/i, '')).trim(), post: machPostGuess(post0) || 'grbl' };
  for (const a of 'XYZ') { const L = lin[a]; if (L && isFinite(L.max - L.min) && L.max - L.min > 0) m['area' + a] = Math.round((L.max - L.min) * k); }
  const s0 = sp[0]; if (s0 && s0.max_speed > 0 && s0.max_speed < 99999) m.rpmMax = Math.round(s0.max_speed); if (s0 && s0.min_speed > 0) m.rpmMin = Math.round(s0.min_speed);
  const r = vmax('max_rapid_speed'), f = vmax('max_normal_speed'); if (r) m.rapid = Math.round(r * k); if (f) m.maxFeed = Math.round(f * k);
  if (rot.length === 1) { const n = String(rot[0].name || '').toUpperCase(); if (n === 'A' || n === 'B') { m.rotary = true; m.rotL = n; } else warn.push(trf('axe rotatif {a} non repris (COPO enroule en A ou B)', { a: n || '?' })); }
  const T = (o.tooling && o.tooling.default) || {}, notes = [trf('Importée de Fusion 360 ({f}).', { f: fn }), post0 ? trf('Post-processeur Fusion : {p}.', { p: post0 }) : ''];
  if (T.number_of_tools > 1) notes.push(trf('Magasin : {n} outils.', { n: T.number_of_tools }));
  machNotePost(m, 'Fusion', post0, warn); if (!m.areaX) warn.push(tr('course non trouvée'));
  m.notes = notes.filter(Boolean).join('\n'); return { m, warn };
}
function machFromFcm(o, fn) {
  const M0 = o.machine || {}, k = M0.units === 'imperial' ? 25.4 : 1, warn = [], lin = {}, rot = [];
  for (const [n, a] of Object.entries(M0.axes || {})) { if (!a || typeof a !== 'object') continue; const L = a.limits || a, ax = { n: n.toUpperCase(), min: +L.min, max: +L.max, v: +a.max_velocity || 0 }; if (a.type === 'linear') lin[ax.n] = ax; else if (a.type === 'rotary' || a.type === 'angular') rot.push(ax); }
  const heads = M0.toolheads || M0.spindles || [], h = heads[0] || {}, ht = String(h.toolhead_type || 'rotary').toLowerCase();
  if (/edm|wire/.test(ht)) return { err: trf('Machine FreeCAD non importée : « {m} » est une machine à fil (électroérosion).', { m: M0.name || fn }) };
  if (rot.length > 1) return { err: trf('Machine FreeCAD non importée : « {m} » a {n} axes rotatifs (5 axes). COPO usine en 3 axes, avec un 4ᵉ axe enroulé au plus.', { m: M0.name || fn, n: rot.length }) };
  const post0 = String((o.postprocessor || {}).file_name || ''), m = { ...MACH_DEF, name: String(M0.name || fn.replace(/\.fcm$/i, '')).replace(/_/g, ' ').trim(), post: machPostGuess(post0) || 'grbl' };
  for (const a of 'XYZ') { const L = lin[a]; if (L && isFinite(L.max - L.min) && L.max - L.min > 0) m['area' + a] = Math.round((L.max - L.min) * k); }
  if (h.max_rpm > 0) m.rpmMax = Math.round(h.max_rpm); if (h.min_rpm > 0) m.rpmMin = Math.round(h.min_rpm);
  const v = Math.max(0, ...Object.values(lin).map(a => a.v)); if (v) m.rapid = Math.round(v * k);
  if (rot.length === 1) { const n = rot[0].n; if (n === 'A' || n === 'B') { m.rotary = true; m.rotL = n; } else warn.push(trf('axe rotatif {a} non repris (COPO enroule en A ou B)', { a: n })); }
  if (POSTS[m.post] && POSTS[m.post].tc === 'iso' && (h.coolant_flood || h.coolant_mist)) m.isoOpt = { ...ISO_DEF, cool: h.coolant_flood ? 'M8' : 'M7' };
  const notes = [trf('Importée de FreeCAD ({f}).', { f: fn }), post0 ? trf('Post-processeur FreeCAD : {p}.', { p: post0 }) : '', M0.manufacturer ? trf('Fabricant : {m}.', { m: M0.manufacturer }) : '', M0.description || ''];
  if (h.tool_change === 'automatic') notes.push(tr('Changeur d’outil automatique.'));
  if (ht !== 'rotary') { notes.push(trf('Tête {t} : choisir un post-processeur laser, plasma ou jet d’eau (groupe .pp).', { t: ht })); warn.push(trf('tête {t}', { t: ht })); }
  machNotePost(m, 'FreeCAD', post0, warn); if (!m.areaX) warn.push(tr('course non trouvée'));
  m.notes = notes.filter(Boolean).join('\n'); return { m, warn };
}
function machImportText(txt, fn) {
  let o; try { o = JSON.parse(txt); } catch { return toast(tr('Fichier de machines illisible.')); }
  fn = String(fn || ''); const conv = o && o.kinematics && o.general ? machFromFusion(o, fn) : o && o.machine && typeof o.machine === 'object' && (o.freecad_version || o.postprocessor) ? machFromFcm(o, fn) : null;
  if (conv) { if (conv.err) return toast(conv.err); machStore(); const names = new Set(MACH.list.map(x => x.m.name)); let nm = conv.m.name || tr('Machine'); if (names.has(nm)) nm += ' ' + tr('(importée)'); conv.m.name = nm;
    const it = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), m: conv.m }; MACH.list.push(it); MACH.id = it.id; S.machine = { ...conv.m }; machAfter();
    return toast(trf('Machine « {m} » importée ({p}) et choisie.', { m: nm, p: postOf(conv.m).short || conv.m.post }) + (conv.warn.length ? ' ' + tr('À vérifier :') + ' ' + conv.warn.join(' ; ') + '.' : '')); }
  const arr = Array.isArray(o) ? o : Array.isArray(o.machines) ? o.machines : o && o.post ? [o] : null; if (!arr || !arr.length) return toast(tr('Aucune machine dans ce fichier.'));
  machStore(); const names = new Set(MACH.list.map(x => x.m.name)); let n = 0;
  for (const raw of arr) { const m0 = raw && raw.m ? raw.m : raw; if (!m0 || typeof m0 !== 'object' || !m0.post) continue; const m = { ...MACH_DEF, ...JSON.parse(JSON.stringify(m0)) }; let nm = m.name || tr('Machine'); if (names.has(nm)) nm += ' ' + tr('(importée)'); m.name = nm; names.add(nm); MACH.list.push({ id: 'm' + Date.now().toString(36) + (n++), m }); }
  if (!n) return toast(tr('Aucune machine dans ce fichier.')); machStore(); machUi(); toast(trf('{n} machine(s) importée(s) : cliquez sur une machine pour la choisir.', { n }));
}
$('#fMach').addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; for (const f of fs) f.text().then(t => machImportText(t, f.name)); });
