// ---------- catalogue : machines 3 axes de la bibliothèque Fusion 360 (course, broche, commande) ----------
/*@donnee mach-cat*/
function machCatShow(on) { $('#machCatBox').hidden = !on; $('#machList').hidden = on; document.querySelector('#machWin .mach-act').hidden = on; if (on) { $('#machCatQ').value = ''; machCatRender(); setTimeout(() => $('#machCatQ').focus(), 0); } else machUi(); }
function machCatRender() { const L = $('#machCatList'), q = $('#machCatQ').value.trim().toLowerCase(), have = new Set(MACH.list.map(x => x.m.name)); L.innerHTML = '';
  MACH_CAT.forEach((c, i) => { const m = c.m; if (q && !(m.name + ' ' + c.ctrl).toLowerCase().includes(q)) return; const el = document.createElement('button'); el.type = 'button'; el.className = 'mach-it'; el.innerHTML = '<b></b><small></small>'; el.querySelector('b').textContent = m.name;
    el.querySelector('small').textContent = fr(m.areaX, 0) + ' × ' + fr(m.areaY, 0) + ' × ' + fr(m.areaZ, 0) + ' mm · ' + tr(c.ctrl) + (m.rpmMax ? ' · ' + fr(m.rpmMax, 0) + ' tr/min' : '') + (have.has(m.name) ? ' · ' + tr('déjà dans vos machines') : ''); el.onclick = () => machCatAdd(i); L.appendChild(el); });
  if (!L.children.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = tr('Aucune machine ne correspond.'); L.appendChild(p); } }
function machCatAdd(i) { const c = MACH_CAT[i]; if (!c) return; machStore(); const m = { ...MACH_DEF, ...JSON.parse(JSON.stringify(c.m)) }, names = new Set(MACH.list.map(x => x.m.name)); let nm = m.name, n = 2; while (names.has(nm)) nm = m.name + ' (' + n++ + ')'; m.name = nm;
  const it = { id: 'm' + Date.now().toString(36), m }; MACH.list.push(it); MACH.id = it.id; S.machine = { ...m }; machCatShow(false); machAfter(); toast(trf('Machine « {m} » ajoutée depuis le catalogue et choisie.', { m: nm })); }
function isoSync() { const b = $('#mIso'); if (!b) return; const on = postOf(S.machine).tc === 'iso'; b.hidden = !on; if (!on) return; const o = { ...ISO_DEF, ...(S.machine.isoOpt || {}) };
  $('#mIsoO').value = o.o; $('#mIsoCool').value = o.cool; $('#mIsoRet').value = o.ret; $('#mIsoM1').checked = !!o.m1; $('#mIsoPre').checked = !!o.pre; $('#mIsoN').checked = !!o.n; }
(function isoInit() { const upd = (k, v) => { S.machine.isoOpt = { ...ISO_DEF, ...(S.machine.isoOpt || {}), [k]: v }; autosave(); machStore(); gcDirty = true; renderGcode(); };
  $('#mIsoO').addEventListener('change', e => { const v = Math.round(+e.target.value); if (v > 0) upd('o', v); }); $('#mIsoCool').addEventListener('change', e => upd('cool', e.target.value)); $('#mIsoRet').addEventListener('change', e => upd('ret', e.target.value));
  for (const [id, k] of [['#mIsoM1', 'm1'], ['#mIsoPre', 'pre'], ['#mIsoN', 'n']]) $(id).addEventListener('change', e => upd(k, e.target.checked));
  $('#machCatQ').addEventListener('input', machCatRender); })();
function machExport() { machStore(); const data = JSON.stringify({ copo: 'machines', version: 1, machines: MACH.list.map(x => x.m) }, null, 1); saveFile('machines-copo.json', data, tr('Machines COPO')); }
