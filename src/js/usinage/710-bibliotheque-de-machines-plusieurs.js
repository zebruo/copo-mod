// ---------- bibliothèque de machines : plusieurs profils (nom, post-processeur, vitesses, Z, course, broche, notes) ----------
var MACH_DEF = { tcZ: -10, post: 'grbl', safeZ: 10, clearZ: 2, rapid: 3000, maxFeed: 2000, comments: true, arcs: true };
const MACH = { list: [], id: null };
function machStore() { const it = MACH.list.find(x => x.id === MACH.id); if (it) it.m = JSON.parse(JSON.stringify(S.machine)); LS.set('copo.machines', JSON.stringify(MACH.list)); LS.set('copo.machineId', MACH.id || ''); machUi(); if (typeof pjModeSync === 'function' && document.getElementById('stRotWarn')) pjModeSync(); }
function machLoad() {
  try { MACH.list = JSON.parse(LS.get('copo.machines') || '[]') || []; } catch { MACH.list = []; }
  if (!MACH.list.length) { const def = { id: 'm' + Date.now().toString(36), m: { ...MACH_DEF, name: 'Machine par défaut' } }; MACH.list = [def]; const old = S.machine; if (old && old.post && old.post !== 'grbl') { const it = { id: 'm' + (Date.now() + 1).toString(36), m: { ...JSON.parse(JSON.stringify(old)), name: old.name || 'Ma machine (réglages précédents)' } }; MACH.list.push(it); MACH.id = it.id; LS.set('copo.machineId', it.id); } }
  else if (!LS.get('copo.machFix1')) { const d = MACH.list.find(x => /^(Machine par défaut|Default machine)$/.test(x.m.name || '')); if (d && d.m.post !== 'grbl') { d.m.name = 'Ma machine (réglages précédents)'; MACH.list.unshift({ id: 'm' + Date.now().toString(36), m: { ...MACH_DEF, name: 'Machine par défaut' } }); } } LS.set('copo.machFix1', '1');
  for (const x of MACH.list) { if (x.m.name === 'Default machine') x.m.name = 'Machine par défaut'; else if (x.m.name === 'My machine (previous settings)') x.m.name = 'Ma machine (réglages précédents)'; } /* noms enregistrés en français, traduits à l'affichage */
  MACH.id = LS.get('copo.machineId'); if (!MACH.list.some(x => x.id === MACH.id)) MACH.id = MACH.list[0].id;
  S.machine = { ...MACH_DEF, ...JSON.parse(JSON.stringify(MACH.list.find(x => x.id === MACH.id).m)) }; syncMachine(); machStore();
}
function machPostLabel(m) { try { return tr(postOf(m).name || postOf(m).short || m.post); } catch { return m.post; } }
function machUi() {
  const M = S.machine, nm = M.name || tr('Machine'); const b = $('#pjMachName'); if (b) { b.textContent = nm; $('#pjMachPost').textContent = machPostLabel(M); }
  const w = $('#pjMachWarn'); if (w) { const st = S.stock, ax = +M.areaX || 0, ay = +M.areaY || 0, az = +M.areaZ || 0, out = []; if (ax && st.w > ax + 1e-6) out.push('X ' + fr(st.w, 1) + ' > ' + fr(ax, 1)); if (ay && st.h > ay + 1e-6) out.push('Y ' + fr(st.h, 1) + ' > ' + fr(ay, 1)); if (az && st.t > az + 1e-6) out.push('Z ' + fr(st.t, 1) + ' > ' + fr(az, 1));
    w.hidden = !out.length; if (out.length) w.textContent = '⚠ ' + trf('Le brut dépasse la course de « {m} » ({d} mm) : la machine n’atteindra pas tout le brut. Vérifiez ses dimensions ou la machine choisie.', { m: nm, d: out.join(', ') }); }
  const L = $('#machList'); if (L && !$('#machWin').hidden) { const same = L.children.length === MACH.list.length && MACH.list.every((it, i) => L.children[i].dataset.id === it.id); if (!same) L.innerHTML = ''; // éléments gardés d'un rendu à l'autre : un clic n'est jamais perdu pendant une mise à jour
    MACH.list.forEach((it, i) => { const m = it.id === MACH.id ? S.machine : it.m; let el = same ? L.children[i] : null; if (!el) { el = document.createElement('button'); el.type = 'button'; el.dataset.id = it.id; el.setAttribute('role', 'option'); el.innerHTML = '<i class="ck"></i><b></b><small></small>'; el.onclick = () => machUse(it.id); L.appendChild(el); }
      el.className = 'mach-it' + (it.id === MACH.id ? ' on' : ''); el.setAttribute('aria-selected', it.id === MACH.id); const zone = m.areaX && m.areaY ? ' · ' + fr(+m.areaX, 0) + ' × ' + fr(+m.areaY, 0) + (m.areaZ ? ' × ' + fr(+m.areaZ, 0) : '') + ' mm' : '';
      el.querySelector('b').textContent = m.name || tr('Machine'); el.querySelector('small').textContent = machPostLabel(m) + zone; });
    $('#machDelBtn').disabled = MACH.list.length < 2; }
}
function machFill() { const M = S.machine; $('#mName').value = M.name || ''; $('#mRot').checked = !!M.rotary; $('#mRotL').value = M.rotL || 'A'; $('#mRotLRow').hidden = !M.rotary; for (const [id, k] of [['#mAreaX', 'areaX'], ['#mAreaY', 'areaY'], ['#mAreaZ', 'areaZ'], ['#mRpmMin', 'rpmMin'], ['#mRpmMax', 'rpmMax']]) $(id).value = M[k] ? M[k] : ''; $('#mNotes').value = M.notes || ''; }
function machAfter() { syncMachine(); if (typeof vpUiSync === 'function') vpUiSync(); if (typeof rotAxSync === 'function') rotAxSync(); if (typeof libSyncProject === 'function') { libSyncProject(); libRender && libRender(); } pjSummary(); gcDirty = true; renderGcode(); machFill(); LS.set('copeau.machine', JSON.stringify(S.machine)); machStore(); }
function machUse(id) { if (id === MACH.id) return; machStore(); const it = MACH.list.find(x => x.id === id); if (!it) return; MACH.id = id; S.machine = { ...MACH_DEF, ...JSON.parse(JSON.stringify(it.m)) }; machAfter(); toast(trf('Machine « {m} » choisie.', { m: S.machine.name || '' })); }
function machNew() { machStore(); const n = MACH.list.length + 1, it = { id: 'm' + Date.now().toString(36), m: { ...MACH_DEF, name: trf('Nouvelle machine {n}', { n }) } }; MACH.list.push(it); MACH.id = it.id; S.machine = { ...it.m }; machAfter(); setTimeout(() => { $('#machBody').scrollTop = 0; const i = $('#mName'); i.focus(); i.select(); }, 30); }
function machDup() { machStore(); const src = S.machine, it = { id: 'm' + Date.now().toString(36), m: { ...JSON.parse(JSON.stringify(src)), name: (src.name || tr('Machine')) + ' ' + tr('(copie)') } }; MACH.list.push(it); MACH.id = it.id; S.machine = { ...it.m }; machAfter(); }
function machDel() { if (MACH.list.length < 2) return; const i = MACH.list.findIndex(x => x.id === MACH.id), nm = S.machine.name || ''; if (!confirmArm('machDelBtn')) return; MACH.list.splice(i, 1); MACH.id = MACH.list[Math.max(0, i - 1)].id; S.machine = { ...MACH_DEF, ...JSON.parse(JSON.stringify(MACH.list.find(x => x.id === MACH.id).m)) }; machAfter(); toast(trf('Machine « {m} » supprimée.', { m: nm })); }
function confirmArm(id) { const b = document.getElementById(id), now = Date.now(); if (b.dataset.arm && now - +b.dataset.arm < 3000) { delete b.dataset.arm; b.textContent = tr('Supprimer'); b.classList.remove('armed'); return true; } b.dataset.arm = now; b.textContent = tr('Confirmer ?'); b.classList.add('armed'); setTimeout(() => { if (b.dataset.arm && Date.now() - +b.dataset.arm >= 2900) { delete b.dataset.arm; b.textContent = tr('Supprimer'); b.classList.remove('armed'); } }, 3000); return false; }
function machOpen() { closeMenus(); machFill(); $('#machWin').hidden = false; machUi(); $('#machBody').scrollTop = 0; setTimeout(() => { const f = document.querySelector('#machList .mach-it.on'); if (f) f.focus({ preventScroll: true }); }, 0); }
function machClose() { const w = $('#machWin'); if (w && !w.hidden) { w.hidden = true; machStore(); pjSummary(); gcDirty = true; renderGcode(); } }
(function machInit() {
  $('#mName').addEventListener('input', e => { S.machine.name = e.target.value.trim(); machStore(); });
  for (const [id, k] of [['#mAreaX', 'areaX'], ['#mAreaY', 'areaY'], ['#mAreaZ', 'areaZ'], ['#mRpmMin', 'rpmMin'], ['#mRpmMax', 'rpmMax']]) $(id).addEventListener('change', e => { const v = +e.target.value; if (v > 0) S.machine[k] = v; else delete S.machine[k]; machStore(); if (k.startsWith('rpm')) { gcDirty = true; renderGcode(); } });
  $('#mNotes').addEventListener('change', e => { S.machine.notes = e.target.value; machStore(); });
  $('#mRot').addEventListener('change', e => { S.machine.rotary = e.target.checked; $('#mRotLRow').hidden = !e.target.checked; machStore(); pjModeSync && pjModeSync(); });
  $('#mRotL').addEventListener('change', e => { S.machine.rotL = e.target.value; machStore(); gcDirty = true; renderGcode(); pjModeSync && pjModeSync(); });
  $('#machWin').addEventListener('change', () => setTimeout(() => { pjSummary(); machStore(); }, 0));
  $('#machWin').addEventListener('click', e => { if (e.target.id === 'machWin') machClose(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#machWin').hidden && !document.querySelector('.cobub, .cowel')) { e.preventDefault(); machClose(); } });
  document.getElementById('pjMachine') && $('[data-pane="projet"]').addEventListener('change', () => setTimeout(machUi, 0));
  machLoad();
})();

