// ---------- signaler un bug ----------
const COPO_VERSION = '1.319', BUG_REPO = 'https://github.com/gbulleryahen-hash/copo';
const ERRLOG = [];
window.addEventListener('error', e => { ERRLOG.push((e.message || 'Erreur') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')); if (ERRLOG.length > 5) ERRLOG.shift(); });
window.addEventListener('unhandledrejection', e => { ERRLOG.push('Promise : ' + ((e.reason && e.reason.message) || e.reason)); if (ERRLOG.length > 5) ERRLOG.shift(); });
let bugPng = null;
function bugEnv() {
  const ua = navigator.userAgent, br = (ua.match(/(Edg|OPR|Firefox|Chrome|Version)\/([\d.]+)/g) || []).pop() || ua, os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '?';
  const st = S.stock, tps = S.tps.map(t => '  - ' + (TYPE_LBL[t.type] || t.type) + ' F' + (t.face || 1) + ' · ' + ((S.tools.find(x => x.id === t.toolId) || {}).name || '?') + (t.err ? ' · ERREUR : ' + t.err : '') + ((t.warns || []).length ? ' · ' + t.warns.length + ' avertissement(s)' : ''));
  return ['COPO ' + COPO_VERSION + ' · ' + (location.protocol === 'file:' ? 'hors ligne (fichier local)' : location.host),
    'Navigateur : ' + br.replace('Version/', 'Safari/').replace('/', ' ') + ' · ' + os + ' · écran ' + innerWidth + '×' + innerHeight + ' · WebGL ' + (window.WebGLRenderingContext ? 'oui' : 'non'),
    'Langue : ' + LANG + ' · unités : ' + UNIT.len + ', ' + UNIT.feed + ' · post-processeur : ' + S.machine.post,
    'Bibliothèques : Clipper ' + (window.ClipperLib ? 'oui' : 'NON') + ', opentype ' + (window.opentype ? 'oui' : 'NON') + ', d3-delaunay ' + (window.d3 && d3.Delaunay ? 'oui' : 'NON'),
    'Brut : ' + st.w + ' × ' + st.h + ' × ' + st.t + ' mm · origine ' + st.originXY + '/' + st.originZ + (st.flip ? ' · double face (' + st.flip + ')' : ''),
    'Vecteurs : ' + S.shapes.length + ' · calques : ' + S.layers.length + ' · parcours : ' + S.tps.length].concat(tps, ERRLOG.length ? ['Erreurs récentes :'].concat(ERRLOG.map(e => '  - ' + e)) : []).join('\n');
}
{ const v = document.getElementById('aboutVer'); if (v) v.textContent = COPO_VERSION; }
let bugMode = 'bug';
function bugOpen(mode) {
  bugMode = mode === 'idea' ? 'idea' : 'bug'; const idea = bugMode === 'idea';
  $('#bugT').textContent = tr(idea ? 'Proposer une amélioration' : 'Signaler un bug');
  $('#bugSub').textContent = tr(idea ? 'La proposition s’ouvre sur GitHub, prête à être envoyée (compte GitHub gratuit nécessaire).' : 'Le rapport s\'ouvre sur GitHub, prêt à être envoyé (compte GitHub gratuit nécessaire).');
  $('#bugWhatL').textContent = tr(idea ? 'Votre proposition' : 'Que s\'est-il passé ?'); $('#bugStepsL').textContent = tr(idea ? 'À quoi cela servirait (exemple, logiciel qui le fait déjà…)' : 'Étapes pour le reproduire');
  $('#bugWhat').placeholder = tr(idea ? 'Décrivez la fonction ou l’amélioration souhaitée.' : 'Décrivez le problème.'); $('#bugSteps').placeholder = idea ? '' : '1. …\n2. …\n3. …';
  $('#bugTitle').placeholder = tr(idea ? 'Ex. : pouvoir coter un angle' : 'Ex. : le congé échoue entre un arc et une droite');
  $('#bugExpRow').hidden = idea; $('#bugShot').checked = !idea; $('[data-act="bugSend"]').textContent = tr(idea ? 'Ouvrir la proposition sur GitHub' : 'Ouvrir le rapport sur GitHub');
  try { draw(); bugPng = cv.toDataURL('image/png'); } catch { bugPng = null; }
  $('#bugImg').hidden = !bugPng; if (bugPng) $('#bugImg').src = bugPng; $('#bugShot').disabled = !bugPng; if (!bugPng) $('#bugShot').checked = false;
  $('#bugInfo').textContent = bugEnv(); $('#bug').hidden = false; setTimeout(() => $('#bugTitle').focus(), 30);
}
async function bugSend() {
  const T = x => tr(x), title = $('#bugTitle').value.trim(), what = $('#bugWhat').value.trim(), steps = $('#bugSteps').value.trim(), exp = $('#bugExp').value.trim();
  if (!title && !what) { toast('Donnez au moins un titre ou une description.'); $('#bugTitle').focus(); return; }
  let shotNote = '';
  if ($('#bugShot').checked && bugPng) {
    const blob = await (await fetch(bugPng)).blob(); let ok = false;
    try { if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); ok = true; } } catch { }
    if (!ok && !window.claude) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'capture-copo.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
    shotNote = ok ? T('_(La capture est dans le presse-papiers : cliquez ici puis Ctrl+V pour la coller.)_') : T('_(Glissez ici le fichier « capture-copo.png » qui vient d\'être téléchargé.)_');
  }
  let projNote = '';
  if ($('#bugProj').checked) { const o = JSON.parse(snapState()); await saveFile('projet-bug-copo.copo', JSON.stringify(o), T('Projet COPO')); projNote = T('_(Glissez ici le fichier « projet-bug-copo.copo » qui vient d\'être téléchargé.)_'); }
  const sec = (h, v) => '### ' + T(h) + '\n' + (v || '_' + T('(non renseigné)') + '_') + '\n\n';
  const idea = bugMode === 'idea'; let body = idea ? sec('Proposition', what) + sec('À quoi cela servirait', steps) : sec('Que s\'est-il passé ?', what) + sec('Étapes pour le reproduire', steps) + sec('Résultat attendu', exp);
  if (shotNote) body += '### ' + T('Capture') + '\n' + shotNote + '\n\n';
  if (projNote) body += '### ' + T('Projet') + '\n' + projNote + '\n\n';
  let env = bugEnv(); const mk = e => body + '### ' + T('Informations techniques') + '\n```\n' + e + '\n```\n';
  let full = mk(env); while (encodeURIComponent(full).length > 6500 && env.length > 200) { env = env.slice(0, Math.floor(env.length * 0.8)) + '\n…'; full = mk(env); }
  const url = BUG_REPO + '/issues/new?labels=' + (idea ? 'enhancement' : 'bug') + '&title=' + encodeURIComponent((idea ? '[' + tr('Proposition') + '] ' : '') + (title || what.slice(0, 80))) + '&body=' + encodeURIComponent(full);
  const w = window.open(url, '_blank', 'noopener'); if (!w && window.claude) showText(T('Signaler un bug'), url, T('Ouvrez ce lien dans votre navigateur.'));
  $('#bug').hidden = true; toast(T(idea ? 'Proposition ouverte sur GitHub : vérifiez-la puis cliquez sur « Create »/« Submit new issue ».' : 'Rapport ouvert sur GitHub : vérifiez-le puis cliquez sur « Create »/« Submit new issue ».'));
}
// enregistrement du projet : après le premier « Enregistrer », le même fichier est réécrit sans redemander le dossier (Chrome, Edge, Brave, Vivaldi)
var projHandle = null;
function projKeep(h) { projHandle = h; try { idbPutImg('proj_handle', h || null).catch(() => { }); } catch { } } // mémorisé : Ctrl+S réécrit le même fichier même après avoir rechargé COPO
(async () => { try { const db = await idb(); const r = await new Promise((res, rej) => { const q = db.transaction('images').objectStore('images').get('proj_handle'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); if (r && r.src && r.src.kind === 'file' && !projHandle) projHandle = r.src; } catch { } })();
const COPO_TYPES = [{ description: 'Projet COPO', accept: { 'application/x-copo': ['.copo'] } }];
function projJSON() { const o = JSON.parse(snapState()); const d = {}; for (const im of S.images) if (imgData[im.id]) d[im.id] = imgData[im.id]; if (Object.keys(d).length) o.imgData = d; { const rd = {}; for (const it of S.relief.items) if (relGrid[it.id]) rd[it.id] = relPack(relGrid[it.id]); if (Object.keys(rd).length) o.relData = rd; const rm = {}; for (const it of S.relief.items) if (it.kind === 'stl' && relMesh[it.id]) rm[it.id] = f32ToB64(relMesh[it.id]); if (Object.keys(rm).length) o.relMesh = rm; } return JSON.stringify(o); } // le maillage STL voyage avec le projet
async function projSave(as) {
  const txt = projJSON();
  if (window.showSaveFilePicker && !window.claude) {
    try { if (!projHandle || as) projKeep(await window.showSaveFilePicker({ suggestedName: projHandle ? projHandle.name : projFileName(), types: COPO_TYPES }));
      else if (projHandle.queryPermission && (await projHandle.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await projHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') { toast(tr('Autorisation refusée : choisissez où enregistrer.')); projKeep(await window.showSaveFilePicker({ suggestedName: projHandle.name, types: COPO_TYPES })); }
      const w = await projHandle.createWritable(); await w.write(txt); await w.close(); projDirty(false); toast(trf('Projet enregistré dans « {f} ».', { f: projHandle.name })); return; }
    catch (e) { if (e && e.name === 'AbortError') return; projKeep(null); setTimeout(() => toast(trf('Écriture directe dans le fichier impossible ({e}) : le projet est téléchargé.', { e: (e && (e.name + (e.message ? ' — ' + e.message : ''))) || '?' })), 1500); }
  }
  saveFile(projFileName(), txt, 'Projet COPO'); projDirty(false); if (!window.showSaveFilePicker && !window.claude && !projSave.told) { projSave.told = true; setTimeout(() => toast(tr('Ce navigateur ne permet pas de réécrire le fichier : le projet est téléchargé à chaque enregistrement. Avec Chrome, Edge ou Vivaldi (ou Brave avec l’option « File System Access API » activée), Ctrl+S réécrit directement le même fichier.')), 1800); }
}
async function projOpen() {
  if (window.showOpenFilePicker && !window.claude) { try { const [h] = await window.showOpenFilePicker({ types: COPO_TYPES.concat([{ description: 'JSON', accept: { 'application/json': ['.json'] } }]), multiple: false }); openProjectText(await (await h.getFile()).text()); projKeep(/\.copo$/i.test(h.name) ? h : null); } catch (e) { if (!(e && e.name === 'AbortError')) toast(e.message || tr('Fichier illisible.')); } return; }
  projKeep(null); $('#fOpen').click();
}
function projFileName() { const n = String((S.meta && S.meta.name) || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim(); return (n || 'projet-copo') + '.copo'; }
async function saveFile(name, data, title) {
  if (DL) { try { await DL.save({ filename: name, data }); toast('Fichier enregistré.'); return; } catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { toast('Un enregistrement est déjà en attente.'); return; } } }
  if (!window.claude) { try { const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' })), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast('Fichier « ' + name + ' » téléchargé.'); return; } catch (e) { } }
  showText(title, data, 'Copiez ce contenu et collez-le dans un fichier « ' + name + ' ».');
}
const gcName = () => { const m = $('#gcFace') ? $('#gcFace').value : 'all', sfx = m === '1' ? '-face1' : m === '2' ? '-face2' : ''; const ex = S.machine.post === 'custom' ? ((S.machine.custom && S.machine.custom.ext) || 'nc') : postOf(S.machine).ext; return 'programme-copo' + sfx + (window.claude ? '.txt' : ex ? '.' + ex : ''); };
function showText(title, text, hint) { $('#dlgTitle').textContent = title; $('#dlgHint').textContent = hint || ''; $('#dlgText').value = text; $('#dlg').hidden = false; }
$('#dlgClose').onclick = () => { $('#dlg').hidden = true; };
$('#dlgCopy').onclick = () => copyText($('#dlgText'));
function copyText(ta) { const v = ta.value; const fb = () => { ta.focus(); ta.select(); try { document.execCommand('copy'); toast('Copié.'); } catch { toast('Sélection prête : copiez avec Ctrl+C.'); } }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(() => toast('Copié dans le presse-papiers.'), fb); else fb(); }
function readFile(input, cb, binary) { input.onchange = () => { const f = input.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { cb(r.result, f); } catch (e) { toast(e.message || 'Fichier illisible.'); } input.value = ''; }; binary ? r.readAsArrayBuffer(f) : r.readAsText(f); }; }
function f32ToB64(a) { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function b64ToF32(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Float32Array(u.buffer); }
function openProjectText(txt) { if (typeof RV !== 'undefined') { RV.fitted = false; RV.touched = false; } const o = JSON.parse(txt); if (!o.shapes || !o.stock) throw new Error('Ce fichier n’est pas un projet COPO.'); if (o.imgData) { for (const [k, v] of Object.entries(o.imgData)) { imgData[k] = v; IMG.delete(k); idbPutImg(k, v).catch(() => { }); } delete o.imgData; txt = JSON.stringify(o); } if (o.relData) { for (const [k, v] of Object.entries(o.relData)) { relGrid[k] = relUnpack(v); relSm.delete(k); idbPutImg('rel_' + k, v).catch(() => { }); } delete o.relData; txt = JSON.stringify(o); } if (o.relMesh) { for (const [k, v] of Object.entries(o.relMesh)) { try { const T = b64ToF32(v); relMesh[k] = T; idbPutImg('relm_' + k, T).catch(() => { }); } catch { } } delete o.relMesh; txt = JSON.stringify(o); } S.imgSel = null; hist = []; hi = -1; S.sel.clear(); S.editTp = null; S.activeTp = null; S.ne = null; restore(txt); if (relRegenOld()) { S.tps.filter(t => t.type === 'relief' || (t.p && t.p.proj)).forEach(computeTP); renderTpList(); } commit(false); S.form = newForm(); renderForm(); fit(); toast('Projet ouvert.'); }
readFile($('#fOpen'), txt => { projKeep(null); openProjectText(txt); });
// application installée : un double-clic sur un fichier .copo l'ouvre ici
if ('launchQueue' in window) launchQueue.setConsumer(async lp => { const h = lp.files && lp.files[0]; if (!h) return; try { openProjectText(await (await h.getFile()).text()); projKeep(h); } catch (e) { toast(e.message || 'Fichier illisible.'); } });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
let installEvt = null; addEventListener('beforeinstallprompt', e => { installEvt = e; });
addEventListener('appinstalled', () => { installEvt = null; toast(T('COPO est installé : les fichiers .copo s’ouvrent maintenant d’un double-clic.')); });
readFile($('#fSvg'), (txt, f) => importVecText(txt, f));
function importVecText(txt, f) {
  if (/\.dxf$/i.test(f.name) || (!/<svg[\s>]/i.test(txt) && /^\s*0\s*\r?\n\s*SECTION/m.test(txt))) {
    const r = importDXF(txt); commit(); renderSel(); fit(); setTool('select');
    const sk = Object.entries(r.skip).map(([k, v]) => v + ' ' + k).join(', ');
    toast(trf('DXF importé : {n} vecteur(s) dont {c} fermé(s), {w} × {h} mm', { n: r.n, c: r.nc, w: LANG === 'fr' ? fr(r.w, 1) : r.w.toFixed(1), h: LANG === 'fr' ? fr(r.h, 1) : r.h.toFixed(1) }) + (r.unit ? ' (' + tr('unité du fichier') + ' : ' + r.unit + ')' : ' (' + tr('sans unité : lu en mm') + ')') + (r.layers > 1 ? ', ' + trf('{n} calques', { n: r.layers }) : '') + (sk ? '. ' + tr('Ignorés') + ' : ' + sk : '') + '.');
    return;
  }
  const n = importSVG(txt); commit(); renderSel(); fit(); setTool('select'); toast(n + ' vecteur(s) importé(s) en mm, courbes conservées' + (n > 1 ? ', groupés.' : '.'));
}
{ const fs = $('#fSvg'), txtHandler = fs.onchange; fs.onchange = e => { const f = fs.files[0]; if (f && /\.(pdf|ai)$/i.test(f.name)) { fs.value = ''; importPdfFile(f); return; } txtHandler.call(fs, e); }; }
readFile($('#fTools'), function (txt) { return; /* remplacé par la bibliothèque */ }); void (txt => { const a = JSON.parse(txt); if (!Array.isArray(a) || !a.every(t => t && t.dia > 0)) throw new Error('Bibliothèque invalide.'); for (const t of a) { const i = S.tools.findIndex(x => x.id === t.id); if (i >= 0) S.tools[i] = t; else S.tools.push(t); } toolsChanged(); toast(a.length + ' outil(s) importé(s).'); });
$('#fFont').onchange = e => { const f = [...e.target.files]; e.target.value = ''; addFontFiles(f); };
$('#fFontDir').onchange = e => { const f = [...e.target.files]; e.target.value = ''; addFontFiles(f); };

